// src/services/notificationService.js
// ─────────────────────────────────────────────────────────────
//  Full FCM Notification Service
//  Roles: student | staff | hod | officestaff | security | warden | mess | placements
// ─────────────────────────────────────────────────────────────

import { db } from "../firebase/config";
import {
  collection, query, where, getDocs,
  doc, setDoc, addDoc, serverTimestamp,
} from "firebase/firestore";

const FCM_SERVER_KEY = process.env.REACT_APP_FCM_SERVER_KEY;
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3002";

// ─────────────────────────────────────────────────────────────
// 1. SAVE USER TOKEN
// ─────────────────────────────────────────────────────────────
export async function saveUserToken(userId, token, role, dept, year = null) {
  try {
    await setDoc(doc(db, "fcmTokens", userId), {
      userId, token, role, dept, year,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) { console.error("saveUserToken:", err); }
}

// ─────────────────────────────────────────────────────────────
// 2. GET TOKENS
// ─────────────────────────────────────────────────────────────
export async function getTokenByUserId(userId) {
  try {
    const snap = await getDocs(query(collection(db, "fcmTokens"), where("userId", "==", userId)));
    if (!snap.empty) return snap.docs[0].data().token;
  } catch (err) {}
  return null;
}

export async function getTokensByRole(role, dept) {
  try {
    const snap = await getDocs(query(collection(db, "fcmTokens"), where("role", "==", role), where("dept", "==", dept)));
    return snap.docs.map(d => d.data().token).filter(Boolean);
  } catch (err) {}
  return [];
}

export async function getTokensByYear(dept, year) {
  try {
    const snap = await getDocs(query(collection(db, "fcmTokens"), where("dept", "==", dept), where("year", "==", year)));
    return snap.docs.map(d => d.data().token).filter(Boolean);
  } catch (err) {}
  return [];
}

export async function getAllStudentTokens(dept) {
  try {
    const snap = await getDocs(query(collection(db, "fcmTokens"), where("role", "==", "student"), where("dept", "==", dept)));
    return snap.docs.map(d => d.data().token).filter(Boolean);
  } catch (err) {}
  return [];
}

// All tokens for multiple roles
async function getTokensByRoles(roles, dept) {
  const all = await Promise.all(roles.map(r => getTokensByRole(r, dept)));
  return [...new Set(all.flat().filter(Boolean))];
}

// ─────────────────────────────────────────────────────────────
// 3. CORE SEND FUNCTION
// ─────────────────────────────────────────────────────────────
export async function sendNotification({ tokens, title, body, data = {}, imageUrl = null }) {
  if (!tokens || tokens.length === 0) return;
  const unique = [...new Set((Array.isArray(tokens) ? tokens : [tokens]).filter(Boolean))];

  try {
    const response = await fetch(`${API_BASE_URL}/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens: unique, title, body, data }),
    });
    if (!response.ok) throw new Error('Failed to send notification');
    const result = await response.json();
    console.log('Notification sent:', result);
  } catch (err) { console.error("sendNotification:", err); }
  await logNotification({ tokens: unique, title, body, data });
}

async function logNotification({ tokens, title, body, data }) {
  try {
    const snap = await getDocs(collection(db, "fcmTokens"));
    const map = {};
    snap.docs.forEach(d => { map[d.data().token] = d.data().userId; });
    const userIds = tokens.map(t => map[t]).filter(Boolean);
    for (const userId of userIds) {
      await addDoc(collection(db, "notifications"), {
        userId, title, body, data: data || {}, read: false, createdAt: serverTimestamp(),
      });
    }
  } catch (err) {}
}

// ═════════════════════════════════════════════════════════════
// 4. NOTIFICATION TRIGGERS — ALL ROLES
// ═════════════════════════════════════════════════════════════

// ── 🚪 GATE PASS ─────────────────────────────────────────────

// Student requests → Staff + HOD get notified
export async function notifyGatePassRequest({ studentName, studentId, reason, dept, staffId, hodId }) {
  const tokens = (await Promise.all([getTokenByUserId(hodId), getTokenByUserId(staffId)])).filter(Boolean);
  await sendNotification({ tokens, title: "🚪 New Gate Pass Request", body: `${studentName} requested a gate pass — "${reason}"`, data: { type: "gate_pass_request", studentId, screen: "GatePass" } });
}

// HOD/Staff approves → Student + Security notified
export async function notifyGatePassApproved({ studentId, studentName, approvedBy, dept, gatePassId }) {
  const studentToken = await getTokenByUserId(studentId);
  const securityTokens = await getTokensByRole("security", dept);
  const tokens = [studentToken, ...securityTokens].filter(Boolean);
  await sendNotification({ tokens, title: "✅ Gate Pass Approved", body: `${studentName}'s gate pass approved by ${approvedBy}. Security please verify.`, data: { type: "gate_pass_approved", studentId, gatePassId, screen: "GatePass" } });
}

// HOD/Staff rejects → Student notified
export async function notifyGatePassRejected({ studentId, rejectedBy, reason }) {
  const token = await getTokenByUserId(studentId);
  await sendNotification({ tokens: [token], title: "❌ Gate Pass Rejected", body: `Your gate pass was rejected by ${rejectedBy}${reason ? ` — ${reason}` : ""}`, data: { type: "gate_pass_rejected", screen: "GatePass" } });
}

// Security scans gate pass → HOD + Staff notified
export async function notifyGatePassScanned({ studentName, studentId, dept, time, direction }) {
  const tokens = await getTokensByRoles(["hod", "staff"], dept);
  await sendNotification({ tokens, title: `🔍 Gate Pass Scanned`, body: `${studentName} ${direction === "out" ? "exited" : "returned to"} campus at ${time}`, data: { type: "gate_pass_scanned", studentId, screen: "GatePass" } });
}

// ── 📋 LEAVE REQUEST ─────────────────────────────────────────

// Student applies leave → Staff + HOD
export async function notifyLeaveRequest({ studentName, studentId, fromDate, toDate, dept, staffId, hodId }) {
  const tokens = (await Promise.all([getTokenByUserId(staffId), getTokenByUserId(hodId)])).filter(Boolean);
  await sendNotification({ tokens, title: "📋 Leave Request", body: `${studentName} applied leave from ${fromDate} to ${toDate}`, data: { type: "leave_request", studentId, screen: "LeaveRequests" } });
}

// Leave approved → Student + Warden (if hosteller)
export async function notifyLeaveApproved({ studentId, approvedBy, fromDate, toDate, isHosteller, dept }) {
  const studentToken = await getTokenByUserId(studentId);
  const wardenTokens = isHosteller ? await getTokensByRole("warden", dept) : [];
  const tokens = [studentToken, ...wardenTokens].filter(Boolean);
  await sendNotification({ tokens, title: "✅ Leave Approved", body: `Leave from ${fromDate} to ${toDate} approved by ${approvedBy}`, data: { type: "leave_approved", screen: "MyLeave" } });
}

// Leave rejected → Student
export async function notifyLeaveRejected({ studentId, rejectedBy, reason }) {
  const token = await getTokenByUserId(studentId);
  await sendNotification({ tokens: [token], title: "❌ Leave Rejected", body: `Leave rejected by ${rejectedBy}${reason ? ` — ${reason}` : ""}`, data: { type: "leave_rejected", screen: "MyLeave" } });
}

// ── ✅ ATTENDANCE ─────────────────────────────────────────────

// Student below 75% → Student notified
export async function notifyLowAttendance({ studentId, percentage }) {
  const token = await getTokenByUserId(studentId);
  await sendNotification({ tokens: [token], title: "⚠️ Low Attendance Alert", body: `Your attendance is ${percentage}% — below required 75%. Please attend classes.`, data: { type: "low_attendance", screen: "Attendance" } });
}

// OD request → HOD + Staff
export async function notifyODRequest({ studentName, studentId, reason, date, dept, staffId, hodId }) {
  const tokens = (await Promise.all([getTokenByUserId(hodId), getTokenByUserId(staffId)])).filter(Boolean);
  await sendNotification({ tokens, title: "📄 OD Request", body: `${studentName} applied for OD on ${date} — "${reason}"`, data: { type: "od_request", studentId, screen: "OD" } });
}

// OD approved → Student
export async function notifyODApproved({ studentId, approvedBy, date }) {
  const token = await getTokenByUserId(studentId);
  await sendNotification({ tokens: [token], title: "✅ OD Approved", body: `Your OD for ${date} approved by ${approvedBy}`, data: { type: "od_approved", screen: "OD" } });
}

// ── 🏢 PLACEMENTS ─────────────────────────────────────────────

// New drive posted → Students (by year or all)
export async function notifyPlacementDrive({ title, company, date, eligibleYear, dept, package: pkg }) {
  const tokens = eligibleYear && eligibleYear !== "All"
    ? await getTokensByYear(dept, eligibleYear)
    : await getAllStudentTokens(dept);
  await sendNotification({
    tokens, title: `🏢 Placement Drive — ${company}`,
    body: `${title} on ${date}${pkg ? ` | Package: ${pkg} LPA` : ""}${eligibleYear && eligibleYear !== "All" ? ` | Eligible: ${eligibleYear}` : " | All years"}`,
    data: { type: "placement_drive", company, screen: "Placements" },
  });
}

// Shortlist announced → Only shortlisted students
export async function notifyPlacementShortlist({ studentIds, company, nextRound }) {
  const tokens = (await Promise.all(studentIds.map(id => getTokenByUserId(id)))).filter(Boolean);
  await sendNotification({ tokens, title: `🎯 Shortlisted — ${company}`, body: `You are shortlisted for ${nextRound} round. Check placement portal for details.`, data: { type: "placement_shortlist", company, screen: "Placements" } });
}

// Result announced → placed students
export async function notifyPlacementResult({ studentIds, company, package: pkg }) {
  const tokens = (await Promise.all(studentIds.map(id => getTokenByUserId(id)))).filter(Boolean);
  await sendNotification({ tokens, title: `🎉 Placed at ${company}!`, body: `Congratulations! You are placed at ${company}${pkg ? ` with ${pkg} LPA` : ""}`, data: { type: "placement_result", company, screen: "Placements" } });
}

// ── 📅 TIMETABLE ─────────────────────────────────────────────

// Regular timetable updated → Students of that year
export async function notifyTimetableUpdate({ dept, year, updatedBy }) {
  const tokens = await getTokensByYear(dept, year);
  await sendNotification({ tokens, title: "📅 Timetable Updated", body: `Your ${year} timetable updated by ${updatedBy}`, data: { type: "timetable_update", screen: "Timetable" } });
}

// Exam schedule posted → Students of that year
export async function notifyExamSchedule({ dept, year, examType, updatedBy }) {
  const tokens = await getTokensByYear(dept, year);
  await sendNotification({ tokens, title: `📝 ${examType} Schedule Posted`, body: `${examType} timetable for ${year} posted by ${updatedBy}`, data: { type: "exam_schedule", screen: "Timetable" } });
}

// ── 💰 FEES (Office Staff) ────────────────────────────────────

// Fee reminder → Student
export async function notifyFeeReminder({ studentId, amount, dueDate }) {
  const token = await getTokenByUserId(studentId);
  await sendNotification({ tokens: [token], title: "💰 Fee Payment Reminder", body: `₹${amount} due by ${dueDate}. Pay now to avoid late charges.`, data: { type: "fee_reminder", screen: "Fees" } });
}

// Fee paid → Office Staff notified
export async function notifyFeePaid({ studentName, studentId, amount, dept, officeStaffId }) {
  const token = await getTokenByUserId(officeStaffId);
  await sendNotification({ tokens: [token], title: "💳 Fee Payment Received", body: `${studentName} paid ₹${amount}. Please generate receipt.`, data: { type: "fee_paid", studentId, screen: "FeeManagement" } });
}

// Hall ticket blocked → Student
export async function notifyHallTicketBlocked({ studentId, reason }) {
  const token = await getTokenByUserId(studentId);
  await sendNotification({ tokens: [token], title: "🚫 Hall Ticket Blocked", body: `Your hall ticket is blocked — ${reason}. Contact office staff.`, data: { type: "hall_ticket_blocked", screen: "Fees" } });
}

// Hall ticket released → Student
export async function notifyHallTicketReleased({ studentId, examType }) {
  const token = await getTokenByUserId(studentId);
  await sendNotification({ tokens: [token], title: "🎟️ Hall Ticket Available", body: `Your ${examType} hall ticket is now available. Download from the portal.`, data: { type: "hall_ticket_released", screen: "Fees" } });
}

// ── 🏠 HOSTEL (Warden) ────────────────────────────────────────

// Student late return → Warden notified
export async function notifyHostelLateReturn({ studentName, studentId, dept, expectedTime, actualTime }) {
  const tokens = await getTokensByRole("warden", dept);
  await sendNotification({ tokens, title: "🌙 Late Hostel Return", body: `${studentName} returned at ${actualTime} (expected: ${expectedTime})`, data: { type: "hostel_late_return", studentId, screen: "Hostel" } });
}

// Hostel leave approved → Student + Security
export async function notifyHostelLeaveApproved({ studentId, studentName, fromDate, toDate, dept }) {
  const studentToken = await getTokenByUserId(studentId);
  const securityTokens = await getTokensByRole("security", dept);
  const tokens = [studentToken, ...securityTokens].filter(Boolean);
  await sendNotification({ tokens, title: "✅ Hostel Leave Approved", body: `${studentName}'s hostel leave from ${fromDate} to ${toDate} approved`, data: { type: "hostel_leave_approved", studentId, screen: "Hostel" } });
}

// Hostel complaint → Warden
export async function notifyHostelComplaint({ studentName, studentId, dept, complaint }) {
  const tokens = await getTokensByRole("warden", dept);
  await sendNotification({ tokens, title: "🏠 Hostel Complaint", body: `${studentName}: "${complaint}"`, data: { type: "hostel_complaint", studentId, screen: "Hostel" } });
}

// Room allotment → Student
export async function notifyRoomAllotment({ studentId, roomNumber, blockName }) {
  const token = await getTokenByUserId(studentId);
  await sendNotification({ tokens: [token], title: "🏠 Room Allotted", body: `You have been allotted Room ${roomNumber} in ${blockName}. Report to warden.`, data: { type: "room_allotment", screen: "Hostel" } });
}

// ── 🍽️ MESS ─────────────────────────────────────────────────

// Mess menu updated → All students in dept
export async function notifyMessMenuUpdate({ dept, menuDate, specialItem }) {
  const tokens = await getAllStudentTokens(dept);
  await sendNotification({ tokens, title: "🍽️ Mess Menu Updated", body: `Menu for ${menuDate} is available${specialItem ? ` — Special: ${specialItem}` : ""}`, data: { type: "mess_menu", screen: "Mess" } });
}

// Mess complaint → Mess staff
export async function notifyMessComplaint({ studentName, studentId, dept, complaint, messStaffId }) {
  const token = await getTokenByUserId(messStaffId);
  await sendNotification({ tokens: [token], title: "🍽️ Mess Complaint", body: `${studentName}: "${complaint}"`, data: { type: "mess_complaint", studentId, screen: "Mess" } });
}

// Mess complaint resolved → Student
export async function notifyMessComplaintResolved({ studentId, resolvedBy }) {
  const token = await getTokenByUserId(studentId);
  await sendNotification({ tokens: [token], title: "✅ Mess Complaint Resolved", body: `Your mess complaint has been resolved by ${resolvedBy}`, data: { type: "mess_resolved", screen: "Mess" } });
}

// Mess off day → All students
export async function notifyMessOffDay({ dept, date, reason }) {
  const tokens = await getAllStudentTokens(dept);
  await sendNotification({ tokens, title: "⚠️ Mess Closed", body: `Mess is closed on ${date}${reason ? ` — ${reason}` : ""}. Alternative arrangements will be made.`, data: { type: "mess_off", screen: "Mess" } });
}

// ── 🔔 COMPLAINTS ─────────────────────────────────────────────

// New complaint → HOD
export async function notifyNewComplaint({ studentName, studentId, dept, category, hodId }) {
  const token = await getTokenByUserId(hodId);
  await sendNotification({ tokens: [token], title: `📣 New Complaint — ${category}`, body: `${studentName} filed a complaint. Review and take action.`, data: { type: "new_complaint", studentId, screen: "Complaints" } });
}

// Complaint resolved → Student
export async function notifyComplaintResolved({ studentId, complaintTitle, resolvedBy }) {
  const token = await getTokenByUserId(studentId);
  await sendNotification({ tokens: [token], title: "✅ Complaint Resolved", body: `Your complaint "${complaintTitle}" resolved by ${resolvedBy}`, data: { type: "complaint_resolved", screen: "Complaints" } });
}

// ── 📢 ANNOUNCEMENTS ──────────────────────────────────────────

// HOD posts announcement → by role or all
export async function notifyAnnouncement({ dept, title, message, targetRole = "all" }) {
  let tokens = [];
  if (targetRole === "all") {
    const [students, staff, officestaff] = await Promise.all([
      getAllStudentTokens(dept),
      getTokensByRole("staff", dept),
      getTokensByRole("officestaff", dept),
    ]);
    tokens = [...students, ...staff, ...officestaff];
  } else if (targetRole === "student") {
    tokens = await getAllStudentTokens(dept);
  } else {
    tokens = await getTokensByRole(targetRole, dept);
  }
  await sendNotification({ tokens, title: `📢 ${title}`, body: message, data: { type: "announcement", screen: "Dashboard" } });
}

// ── 📊 MARKS ─────────────────────────────────────────────────

// Marks published → Students of that year
export async function notifyMarksPublished({ dept, year, subject, publishedBy }) {
  const tokens = await getTokensByYear(dept, year);
  await sendNotification({ tokens, title: "📊 Marks Published", body: `${subject} marks for ${year} published by ${publishedBy}`, data: { type: "marks_published", screen: "Marks" } });
}

// ── 🔒 SECURITY ──────────────────────────────────────────────

// Suspicious activity → HOD + Staff
export async function notifySuspiciousActivity({ dept, description, location, reportedBy }) {
  const tokens = await getTokensByRoles(["hod", "staff"], dept);
  await sendNotification({ tokens, title: "🚨 Security Alert", body: `${description} at ${location} — reported by ${reportedBy}`, data: { type: "security_alert", screen: "Security" } });
}

// Visitor entry → HOD (if needed)
export async function notifyVisitorEntry({ visitorName, visitingFor, dept, hodId }) {
  const token = await getTokenByUserId(hodId);
  await sendNotification({ tokens: [token], title: "👤 Visitor Arrived", body: `${visitorName} is here to meet ${visitingFor}. Please confirm.`, data: { type: "visitor_entry", screen: "Security" } });
}