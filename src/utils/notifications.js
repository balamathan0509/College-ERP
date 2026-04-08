// src/utils/notifications.js
// =====================================================
// EMAILJS CONFIG
// Get from: https://emailjs.com → Account → API Keys
// =====================================================
const EMAILJS_SERVICE_ID = "nagaraj4647";
const EMAILJS_TEMPLATE_ID = "template_5os93o8";
const EMAILJS_PUBLIC_KEY = "7jOW3OsIoEZkvOnxz";

// =====================================================
// FAST2SMS CONFIG
// Get from: https://fast2sms.com → Dashboard → API
// =====================================================
const FAST2SMS_API_KEY = "zNxk3HgAujCLOWYhndwSip4RfMBJ6qeZsIcGDQXbva82PUVmy7wrekxA1H6YyP7vgIJ4LfctzbZO3ijK";

// =====================================================
// CORE — SEND EMAIL
// =====================================================
export async function sendEmail({ toEmail, toName, subject, message }) {
  if (!toEmail || EMAILJS_SERVICE_ID === "YOUR_SERVICE_ID") {
    console.log("📧 Email skipped — not configured");
    return;
  }
  try {
    await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: { to_email: toEmail, to_name: toName, subject, message }
      })
    });
    console.log(`📧 Email sent to ${toEmail}`);
  } catch (err) { console.error("Email error:", err); }
}

// =====================================================
// CORE — SEND SMS
// =====================================================
export async function sendSMS({ phone, message }) {
  if (!phone || FAST2SMS_API_KEY === "YOUR_FAST2SMS_API_KEY") {
    console.log("📱 SMS skipped — not configured");
    return;
  }
  const cleanPhone = phone?.replace(/^\+91|^0/, "").trim();
  
  // Validate phone number
  if (!cleanPhone || cleanPhone.length !== 10) {
    console.error(`📱 SMS error: Invalid phone number "${cleanPhone}" (must be 10 digits)`);
    return;
  }
  
  try {
    console.log(`📱 SMS sending to ${cleanPhone}...`);
    const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: { 
        "authorization": FAST2SMS_API_KEY, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        route: "q", 
        message, 
        language: "english", 
        flash: 0, 
        numbers: cleanPhone 
      })
    });
    
    const data = await res.json();
    console.log(`📱 SMS API Response:`, data);
    
    // Fast2SMS returns status code in response
    if (data.return === true || data.status === "success") {
      console.log(`✅ SMS sent to ${cleanPhone}`);
    } else {
      console.error(`❌ SMS failed for ${cleanPhone}:`, data);
    }
  } catch (err) { 
    console.error(`❌ SMS error for ${cleanPhone}:`, err); 
  }
}

// =====================================================
// CORE — NOTIFY (Email + SMS together)
// =====================================================
export async function notify({ email, phone, name, subject, message }) {
  await Promise.all([
    sendEmail({ toEmail: email, toName: name, subject, message }),
    sendSMS({ phone, message: `${subject}: ${message}` })
  ]);
}

// =====================================================
// 🎒 STUDENT NOTIFICATIONS
// =====================================================

// Gate pass approved
export async function notifyStudentGatePassApproved({ email, phone, name, token, outDate, outTime, place }) {
  await notify({
    email, phone, name,
    subject: "✅ Gate Pass Approved",
    message: `Hi ${name}, your gate pass is approved! Token: ${token}. Out: ${outDate} at ${outTime}. Place: ${place}. Show token to security.`
  });
}

// Gate pass rejected
export async function notifyStudentGatePassRejected({ email, phone, name, reason }) {
  await notify({
    email, phone, name,
    subject: "❌ Gate Pass Rejected",
    message: `Hi ${name}, your gate pass request was rejected. ${reason ? `Reason: ${reason}` : "Please contact your staff for details."}`
  });
}

// Gate pass approved notification for gate/security
export async function notifyGatePassApproved({ email, phone, name, token, outDate, outTime }) {
  await notify({
    email, phone, name,
    subject: "✅ Gate Pass Approved",
    message: `Hi ${name}, gate pass for token ${token} is approved. Out at ${outDate} ${outTime}. Please allow the student to exit.`
  });
}

// Gate pass rejected notification for gate/security
export async function notifyGatePassRejected({ email, phone, name }) {
  await notify({
    email, phone, name,
    subject: "❌ Gate Pass Rejected",
    message: `Hi ${name}, the gate pass request has been rejected.`
  });
}

// Absent alert
export async function notifyStudentAbsent({ email, phone, name, date, dept }) {
  await notify({
    email, phone, name,
    subject: "⚠️ Attendance Alert",
    message: `Hi ${name}, you were marked absent on ${date} in ${dept} department. If incorrect, contact your class staff immediately.`
  });
}

// Fees pending
export async function notifyStudentFeesPending({ email, phone, name, feesType, dept }) {
  await notify({
    email, phone, name,
    subject: "💰 Fees Payment Reminder",
    message: `Hi ${name}, your ${feesType} payment is pending for ${dept} department. Please pay at the office immediately to avoid penalties.`
  });
}

// Complaint status update
export async function notifyStudentComplaintUpdate({ email, phone, name, complaintTitle, status }) {
  await notify({
    email, phone, name,
    subject: `📝 Complaint ${status}`,
    message: `Hi ${name}, your complaint "${complaintTitle}" has been marked as "${status}". Login to college portal for details.`
  });
}

// New alert/circular
export async function notifyStudentAlert({ email, phone, name, title, message }) {
  await notify({
    email, phone, name,
    subject: `📢 ${title}`,
    message: `Hi ${name}, new alert from college: ${message}`
  });
}

// Placement alert
export async function notifyStudentPlacement({ email, phone, name, company, role, deadline }) {
  await notify({
    email, phone, name,
    subject: `💼 New Placement Drive — ${company}`,
    message: `Hi ${name}, ${company} is hiring for ${role}. Last date: ${deadline}. Login to college portal to apply!`
  });
}

// =====================================================
// 👨‍🏫 STAFF NOTIFICATIONS
// =====================================================

// New gate pass request from student
export async function notifyStaffNewGatePass({ email, phone, name, studentName, reason, outDate }) {
  await notify({
    email, phone, name,
    subject: "🚪 New Gate Pass Request",
    message: `Hi ${name}, ${studentName} has submitted a gate pass request. Reason: ${reason}. Out date: ${outDate}. Please review in college portal.`
  });
}

// Absent list summary
export async function notifyStaffAbsentSummary({ email, phone, name, date, absentCount, dept, year }) {
  await notify({
    email, phone, name,
    subject: "📋 Attendance Marked",
    message: `Hi ${name}, attendance for ${dept} ${year} on ${date} is saved. ${absentCount} student(s) absent. HOD has been notified.`
  });
}

// =====================================================
// 🏛️ HOD NOTIFICATIONS
// =====================================================

// Gate pass forwarded from staff
export async function notifyHodGatePass({ email, phone, name, studentName, staffName, reason, outDate }) {
  await notify({
    email, phone, name,
    subject: "🚪 Gate Pass Needs Your Approval",
    message: `Hi ${name}, ${studentName}'s gate pass approved by ${staffName} is waiting for your final approval. Reason: ${reason}. Date: ${outDate}.`
  });
}

// Daily absent summary
export async function notifyHodAbsentSummary({ email, phone, name, date, absentStudents, dept, year }) {
  await notify({
    email, phone, name,
    subject: `⚠️ Absent Alert — ${dept} ${year}`,
    message: `Hi ${name}, ${absentStudents.length} student(s) absent on ${date} in ${dept} ${year}: ${absentStudents.join(", ")}.`
  });
}

// New complaint
export async function notifyHodNewComplaint({ email, phone, name, studentName, category }) {
  await notify({
    email, phone, name,
    subject: "📝 New Complaint Received",
    message: `Hi ${name}, ${studentName} has filed a new complaint under "${category}". Please review in college portal.`
  });
}

// =====================================================
// 🏠 WARDEN NOTIFICATIONS
// =====================================================

// Student gate pass approved — warden knows student is going out
export async function notifyWardenStudentOut({ email, phone, name, studentName, token, outDate, outTime, inDate, inTime, place }) {
  await notify({
    email, phone, name,
    subject: "🚪 Student Going Out",
    message: `Hi ${name}, ${studentName} has an approved gate pass. Token: ${token}. Out: ${outDate} ${outTime}. In: ${inDate} ${inTime}. Place: ${place}.`
  });
}

// =====================================================
// 🏢 OFFICE STAFF NOTIFICATIONS
// =====================================================

// Fees collection reminder to self
export async function notifyOfficeStaffFeesSummary({ email, phone, name, dept, year, feesType, pendingCount }) {
  await notify({
    email, phone, name,
    subject: "💰 Fees Collection Summary",
    message: `Hi ${name}, ${pendingCount} student(s) in ${dept} ${year} have pending ${feesType}. Please follow up.`
  });
}