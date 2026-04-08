// src/pages/staff/Attendance.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { notifyStudentAbsent, notifyHodAbsentSummary } from "../../utils/notifications";
import {
  collection, query, where, getDocs, doc, setDoc
} from "firebase/firestore";


const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export default function StaffAttendance() {
  const { userProfile } = useAuth();
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function fetchStudents() {
    if (!selectedYear) return;
    setFetching(true);
    setSaved(false);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", userProfile.dept),
        where("year", "==", selectedYear)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(list);

      // Fetch existing attendance for this date
      const attDocId = `${userProfile.dept}_${selectedYear}_${selectedDate}`.replace(/\s+/g, "_");
      const attQ = query(
        collection(db, "attendance"),
        where("dept", "==", userProfile.dept),
        where("year", "==", selectedYear),
        where("date", "==", selectedDate)
      );
      const attSnap = await getDocs(attQ);
      if (!attSnap.empty) {
        setAttendance(attSnap.docs[0].data().records || {});
      } else {
        // Default all present
        const defaultAtt = {};
        list.forEach(s => { defaultAtt[s.id] = true; });
        setAttendance(defaultAtt);
      }
    } catch (err) {}
    setFetching(false);
  }

  function toggleAttendance(studentId) {
    setAttendance(prev => ({ ...prev, [studentId]: !prev[studentId] }));
  }

  function markAllPresent() {
    const all = {};
    students.forEach(s => { all[s.id] = true; });
    setAttendance(all);
  }

  function markAllAbsent() {
    const all = {};
    students.forEach(s => { all[s.id] = false; });
    setAttendance(all);
  }

  async function saveAttendance() {
    setSaving(true);
    try {
      const absentStudents = students.filter(s => !attendance[s.id]);
      const attDocId = `${userProfile.dept}_${selectedYear}_${selectedDate}`.replace(/\s+/g, "_");

      await setDoc(doc(db, "attendance", attDocId), {
        dept: userProfile.dept,
        year: selectedYear,
        date: selectedDate,
        records: attendance,
        absentCount: absentStudents.length,
        totalCount: students.length,
        markedBy: userProfile.name,
        markedAt: new Date().toISOString()
      });

      // Save absent alerts for HOD
      for (const student of absentStudents) {
        const alertId = `absent_${student.id}_${selectedDate}`;
        await setDoc(doc(db, "attendance_alerts", alertId), {
          studentId: student.id,
          studentName: student.name,
          registerNo: student.registerNo,
          dept: userProfile.dept,
          year: selectedYear,
          date: selectedDate,
          markedBy: userProfile.name,
          seen: false,
          createdAt: new Date().toISOString()
        });
      }

      // Notify absent students
      for (const student of absentStudents) {
        await notifyStudentAbsent({
          email: student.email || "",
          phone: student.phone || "",
          name: student.name,
          date: selectedDate,
          dept: userProfile.dept
        });
      }

      // Notify HOD with daily absent summary
      if (absentStudents.length > 0) {
        const hodQuery = query(
          collection(db, "users"),
          where("role", "==", "hod"),
          where("dept", "==", userProfile.dept)
        );
        const hodSnap = await getDocs(hodQuery);
        if (!hodSnap.empty) {
          const hodUser = hodSnap.docs[0].data();
          await notifyHodAbsentSummary({
            email: hodUser.email || "",
            phone: hodUser.phone || "",
            name: hodUser.name,
            date: selectedDate,
            absentStudents: absentStudents.map(s => s.name),
            dept: userProfile.dept,
            year: selectedYear
          });
        }
      }

      setSaved(true);
    } catch (err) {}
    setSaving(false);
  }

  useEffect(() => {
    if (selectedYear) fetchStudents();
  }, [selectedYear, selectedDate]);

  const presentCount = students.filter(s => attendance[s.id]).length;
  const absentCount = students.length - presentCount;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>✅ Mark Attendance</h1>
          <p>{userProfile?.dept} Department</p>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="form-row">
            <div className="form-group" style={{ margin: 0 }}>
              <label>Select Year</label>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                <option value="">Choose Year</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        {students.length > 0 && (
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-value">{students.length}</div>
              <div className="stat-label">Total Students</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-value" style={{ color: "#48bb78" }}>{presentCount}</div>
              <div className="stat-label">Present</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">❌</div>
              <div className="stat-value" style={{ color: "#fc8181" }}>{absentCount}</div>
              <div className="stat-label">Absent</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-value" style={{ color: "#f5a623" }}>
                {students.length ? Math.round((presentCount / students.length) * 100) : 0}%
              </div>
              <div className="stat-label">Attendance %</div>
            </div>
          </div>
        )}

        {/* Student List */}
        {fetching ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div className="spinner" style={{ margin: "0 auto" }}></div>
          </div>
        ) : students.length > 0 ? (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18 }}>
                {selectedYear} — {selectedDate}
              </h3>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={markAllPresent} style={{
                  padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(72,187,120,0.3)",
                  background: "rgba(72,187,120,0.1)", color: "#48bb78", cursor: "pointer", fontSize: 13, fontWeight: 600
                }}>✅ All Present</button>
                <button onClick={markAllAbsent} style={{
                  padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(252,129,129,0.3)",
                  background: "rgba(252,129,129,0.1)", color: "#fc8181", cursor: "pointer", fontSize: 13, fontWeight: 600
                }}>❌ All Absent</button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>S.No</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>Name</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>Register No</th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>Present</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => (
                    <tr
                      key={student.id}
                      onClick={() => toggleAttendance(student.id)}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        background: attendance[student.id] ? "rgba(72,187,120,0.05)" : "rgba(252,129,129,0.05)",
                        cursor: "pointer", transition: "all 0.15s"
                      }}
                    >
                      <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 14 }}>{idx + 1}</td>
                      <td style={{ padding: "14px 16px", fontWeight: 600, fontSize: 15 }}>{student.name}</td>
                      <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 14 }}>{student.registerNo}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, margin: "0 auto",
                          border: attendance[student.id] ? "2px solid #48bb78" : "2px solid #fc8181",
                          background: attendance[student.id] ? "#48bb78" : "rgba(252,129,129,0.2)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, transition: "all 0.2s", color: "white", fontWeight: 700
                        }}>
                          {attendance[student.id] ? "✓" : "✗"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center" }}>
              <button className="btn-primary" onClick={saveAttendance} disabled={saving} style={{ width: "auto", padding: "12px 32px" }}>
                {saving ? "Saving..." : "💾 Save Attendance"}
              </button>
              {saved && (
                <span style={{ color: "#48bb78", fontWeight: 600, fontSize: 14 }}>
                  ✅ Saved! Absent list forwarded to HOD.
                </span>
              )}
            </div>
          </div>
        ) : selectedYear ? (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
            <p style={{ color: "#a0aec0" }}>No students found for {selectedYear} - {userProfile?.dept}</p>
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ color: "#a0aec0" }}>Select Year and Date to mark attendance</p>
          </div>
        )}
      </main>
    </div>
  );
}