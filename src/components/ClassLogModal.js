// src/components/ClassLogModal.js
import React, { useState, useEffect } from "react";
import { db } from "../supabase/supabaseAdapter";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "../supabase/supabaseAdapter";
import { useAuth } from "../context/AuthContext";
import { X, BookOpen, Send, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { getDepartmentCalendar, getCalendarEventForDate } from "../utils/academicCalendarUtils";

const PERIODS = [
  "Period 1 (09:00 AM - 10:00 AM)",
  "Period 2 (10:00 AM - 11:00 AM)",
  "Period 3 (11:15 AM - 12:15 PM)",
  "Period 4 (12:15 PM - 01:15 PM)",
  "Period 5 (02:00 PM - 03:00 PM)",
  "Period 6 (03:00 PM - 04:00 PM)",
  "Period 7 (04:00 PM - 05:00 PM)"
];

export default function ClassLogModal({ isOpen, onClose, onSuccess }) {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Allocated subjects for staff
  const [myAllocations, setMyAllocations] = useState([]);
  const [selectedAllocId, setSelectedAllocId] = useState("");
  
  // Form fields
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [period, setPeriod] = useState(PERIODS[0]);
  const [topicCovered, setTopicCovered] = useState("");
  
  // Students & attendance
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); // { studentId: true/false }
  const [calendarBlockedEvent, setCalendarBlockedEvent] = useState(null);

  useEffect(() => {
    if (isOpen && userProfile?.uid) {
      fetchAllocatedSubjects();
    }
  }, [isOpen, userProfile]);

  async function fetchAllocatedSubjects() {
    setLoading(true);
    try {
      // 1. Fetch permanent subject allocations for this staff (across all departments)
      const qPerm = query(
        collection(db, "subject_allocations"),
        where("facultyId", "==", userProfile.uid),
        where("status", "==", "Active")
      );
      const snapPerm = await getDocs(qPerm);
      const permList = snapPerm.docs.map(d => ({ id: d.id, ...d.data(), isSub: false }));

      // 2. Fetch substitute allocations for this staff
      const qSub = query(
        collection(db, "subject_substitutes"),
        where("substituteFacultyId", "==", userProfile.uid),
        where("status", "==", "Active")
      );
      const snapSub = await getDocs(qSub);
      const subList = snapSub.docs.map(d => ({ id: d.id, ...d.data(), isSub: true }));

      const combined = [...permList, ...subList];
      setMyAllocations(combined);

      if (combined.length > 0) {
        setSelectedAllocId(combined[0].id);
        fetchStudentsForAlloc(combined[0], date);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load assigned subjects.");
    }
    setLoading(false);
  }

  const handleSubjectChange = (e) => {
    const allocId = e.target.value;
    setSelectedAllocId(allocId);
    const alloc = myAllocations.find(a => a.id === allocId);
    if (alloc) {
      fetchStudentsForAlloc(alloc, date);
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setDate(newDate);
    const alloc = myAllocations.find(a => a.id === selectedAllocId);
    if (alloc) {
      fetchStudentsForAlloc(alloc, newDate);
    }
  };

  async function fetchStudentsForAlloc(alloc, selectedDateStr) {
    setCalendarBlockedEvent(null);
    try {
      const dept = alloc.department || alloc.targetDept || alloc.dept || userProfile.dept;
      const year = alloc.year ? `${alloc.year}${alloc.year.includes("Year") ? "" : "st Year"}` : "";
      
      // Check Academic Calendar for date restriction
      const calData = await getDepartmentCalendar(dept);
      if (calData) {
        const activeEvent = await getCalendarEventForDate(calData, selectedDateStr, year);
        if (activeEvent && activeEvent.suspendClasses !== false) {
          setCalendarBlockedEvent(activeEvent);
        }
      }

      let studQ = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", dept)
      );
      const snap = await getDocs(studQ);
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (alloc.section) {
        list = list.filter(s => !s.section || s.section === alloc.section);
      }
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      setStudents(list);

      // Default attendance to ALL PRESENT
      const initialAtt = {};
      list.forEach(s => { initialAtt[s.id] = true; });
      setAttendance(initialAtt);
    } catch (err) {
      console.error(err);
    }
  }

  const toggleAttendance = (id) => {
    if (calendarBlockedEvent) return;
    setAttendance(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectAll = (status) => {
    if (calendarBlockedEvent) return;
    const updated = {};
    students.forEach(s => { updated[s.id] = status; });
    setAttendance(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAllocId) {
      toast.error("Please select a subject.");
      return;
    }
    if (calendarBlockedEvent) {
      toast.error(`Class log cannot be submitted on "${calendarBlockedEvent.title}" dates according to the Academic Calendar.`);
      return;
    }
    if (!topicCovered.trim()) {
      toast.error("Please enter the topic covered in this class.");
      return;
    }

    setSubmitting(true);
    try {
      const selectedAlloc = myAllocations.find(a => a.id === selectedAllocId);
      const targetDept = selectedAlloc.department || selectedAlloc.targetDept || selectedAlloc.dept || userProfile.dept;
      const targetYear = selectedAlloc.year || "All";
      const targetSection = selectedAlloc.section || "A";
      const subjectCode = selectedAlloc.subjectCode || selectedAlloc.courseCode || "SUB";
      const subjectName = selectedAlloc.subjectName || selectedAlloc.courseName || "Subject";

      const presentStudents = [];
      const absentStudents = [];

      students.forEach(s => {
        if (attendance[s.id]) {
          presentStudents.push({ id: s.id, name: s.name, regNo: s.registerNo });
        } else {
          absentStudents.push({ id: s.id, name: s.name, regNo: s.registerNo });
        }
      });

      const totalCount = students.length;
      const presentCount = presentStudents.length;
      const attPct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 100;

      // Create class log report
      const logData = {
        allocationId: selectedAllocId,
        facultyId: userProfile.uid,
        facultyName: userProfile.name || userProfile.email,
        facultyDept: userProfile.dept || "GENERAL",
        targetDept: targetDept,
        year: targetYear,
        section: targetSection,
        subjectCode: subjectCode,
        subjectName: subjectName,
        date: date,
        period: period,
        topicCovered: topicCovered.trim(),
        totalStudents: totalCount,
        presentCount: presentCount,
        absentCount: absentStudents.length,
        attendancePercentage: `${attPct}%`,
        absentStudents: absentStudents,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "class_logs"), logData);

      toast.success("Class completed & report forwarded to HOD / Class Incharge!");
      setTopicCovered("");
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit class log.");
    }
    setSubmitting(false);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2500,
      background: "rgba(15, 23, 42, 0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16
    }} onClick={onClose}>
      <div style={{
        background: "#ffffff", borderRadius: 12, width: "100%", maxWidth: 620,
        maxHeight: "90vh", overflowY: "auto", border: "1px solid #e2e8f0",
        boxShadow: "0 10px 25px rgba(0,0,0,0.1)", padding: 24, color: "#0f172a"
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
              <BookOpen size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Log Completed Class & Topic</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#64748b" }}>Record syllabus progress & period attendance</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><X size={20} /></button>
        </div>

        {/* Academic Calendar Block Warning */}
        {calendarBlockedEvent && (
          <div style={{
            padding: 14, borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca",
            marginBottom: 16, display: "flex", alignItems: "center", gap: 10, color: "#991b1b"
          }}>
            <AlertTriangle size={20} color="#dc2626" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 12 }}>
              <strong>⛔ Class Logging Suspended ({calendarBlockedEvent.title}):</strong> Date {date} is marked in the Academic Calendar. Regular classes were suspended on this date.
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#64748b" }}>Loading assigned subjects...</div>
        ) : myAllocations.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "#64748b", fontSize: 13 }}>
            No assigned subjects found. Please contact HOD for subject allocation.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Subject Selector */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Select Subject & Class *</label>
              <select value={selectedAllocId} onChange={handleSubjectChange} required style={{
                width: "100%", padding: 9, borderRadius: 6, border: "1px solid #cbd5e1",
                background: "#ffffff", color: "#0f172a", fontSize: 13, fontWeight: 600
              }}>
                {myAllocations.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.subjectCode || a.courseCode} - {a.subjectName || a.courseName} ({a.department || a.targetDept || a.dept} {a.year} Sec {a.section || 'A'}) {a.isSub ? '[Temp Substitute]' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Date & Period */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Class Date *</label>
                <input type="date" value={date} onChange={handleDateChange} required style={{
                  width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1",
                  background: "#ffffff", color: "#0f172a", fontSize: 13
                }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Class Period / Hour *</label>
                <select value={period} onChange={e => setPeriod(e.target.value)} required style={{
                  width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1",
                  background: "#ffffff", color: "#0f172a", fontSize: 13
                }}>
                  {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {/* Topic Covered Input */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Topic / Syllabus Covered in Class *</label>
              <textarea
                placeholder="e.g. Unit 2: Binary Search Trees - Node Insertion & Deletion Algorithms"
                value={topicCovered}
                onChange={e => setTopicCovered(e.target.value)}
                disabled={!!calendarBlockedEvent}
                required
                rows={3}
                style={{
                  width: "100%", padding: 10, borderRadius: 6, border: "1px solid #cbd5e1",
                  background: calendarBlockedEvent ? "#f1f5f9" : "#ffffff", color: "#0f172a", fontSize: 13, resize: "vertical", outline: "none"
                }}
              />
            </div>

            {/* Attendance List Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#1e40af", textTransform: "uppercase" }}>
                Class Attendance ({students.length} Students)
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => handleSelectAll(true)} disabled={!!calendarBlockedEvent} style={{ padding: "3px 8px", borderRadius: 4, background: "#ecfdf5", border: "1px solid #6ee7b7", color: "#047857", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>All Present</button>
                <button type="button" onClick={() => handleSelectAll(false)} disabled={!!calendarBlockedEvent} style={{ padding: "3px 8px", borderRadius: 4, background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>All Absent</button>
              </div>
            </div>

            {/* Student Attendance List */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, maxHeight: 180, overflowY: "auto", padding: 8, marginBottom: 16, opacity: calendarBlockedEvent ? 0.5 : 1, pointerEvents: calendarBlockedEvent ? "none" : "auto" }}>
              {students.length === 0 ? (
                <div style={{ textAlign: "center", padding: 12, color: "#64748b", fontSize: 12 }}>No enrolled students found for this class section.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 6 }}>
                  {students.map(s => {
                    const isPresent = attendance[s.id] !== false;
                    return (
                      <div key={s.id} onClick={() => toggleAttendance(s.id)} style={{
                        padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                        background: isPresent ? "#ffffff" : "#fef2f2",
                        border: isPresent ? "1px solid #cbd5e1" : "1px solid #fca5a5",
                        display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: isPresent ? "#0f172a" : "#dc2626" }}>{s.name}</div>
                          <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>{s.registerNo || "N/A"}</div>
                        </div>
                        <span style={{
                          padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800,
                          background: isPresent ? "#ecfdf5" : "#fef2f2",
                          color: isPresent ? "#047857" : "#dc2626"
                        }}>
                          {isPresent ? "PRESENT" : "ABSENT"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={onClose} style={{
                flex: 1, padding: "9px 16px", borderRadius: 6, border: "1px solid #cbd5e1",
                background: "#ffffff", color: "#334155", fontWeight: 600, cursor: "pointer"
              }}>Cancel</button>
              <button type="submit" disabled={submitting || !!calendarBlockedEvent} style={{
                flex: 1, padding: "9px 16px", borderRadius: 6, border: "none",
                background: "#2563eb", color: "#ffffff", fontWeight: 700, cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                opacity: (submitting || calendarBlockedEvent) ? 0.6 : 1
              }}>
                <Send size={15} /> {submitting ? "Submitting Log..." : calendarBlockedEvent ? "Class Suspended Today" : "Submit & Forward Report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
