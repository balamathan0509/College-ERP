// src/pages/staff/Attendance.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { notifyStudentAbsent, notifyHodAbsentSummary } from "../../utils/notifications";
import {
  collection, query, where, getDocs, doc, setDoc
} from "firebase/firestore";
import {
  CheckSquare,
  Users,
  CheckCircle2,
  Briefcase,
  XCircle,
  Save,
  PieChart,
  Calendar
} from "lucide-react";

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

      const attQ = query(
        collection(db, "attendance"),
        where("dept", "==", userProfile.dept),
        where("year", "==", selectedYear),
        where("date", "==", selectedDate)
      );
      const attSnap = await getDocs(attQ);
      if (!attSnap.empty) {
        const records = attSnap.docs[0].data().records || {};
        const mappedRecords = {};
        list.forEach(s => {
          const val = records[s.id];
          if (val === "OD") mappedRecords[s.id] = "OD";
          else if (val === false || val === "A") mappedRecords[s.id] = "A";
          else mappedRecords[s.id] = "P";
        });
        setAttendance(mappedRecords);
      } else {
        const defaultMap = {};
        list.forEach(s => { defaultMap[s.id] = "P"; });
        setAttendance(defaultMap);
      }
    } catch (err) {}
    setFetching(false);
  }

  function handleStatusChange(studentId, status) {
    setAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));
    setSaved(false);
  }

  function handleMarkAll(status) {
    const updated = {};
    students.forEach(s => { updated[s.id] = status; });
    setAttendance(updated);
    setSaved(false);
  }

  async function handleSave() {
    if (!selectedYear) return;
    setSaving(true);
    try {
      const docId = `${userProfile.dept}_${selectedYear}_${selectedDate}`.replace(/\s+/g, "_");

      const rawRecords = {};
      Object.entries(attendance).forEach(([uid, st]) => {
        rawRecords[uid] = st;
      });

      const absentStudents = students.filter(s => attendance[s.id] === "A");

      await setDoc(doc(db, "attendance"), {
        dept: userProfile.dept,
        year: selectedYear,
        date: selectedDate,
        records: rawRecords,
        totalCount: students.length,
        markedBy: userProfile.name,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      for (const student of absentStudents) {
        await notifyStudentAbsent({
          email: student.email || "",
          phone: student.phone || "",
          name: student.name,
          date: selectedDate,
          dept: userProfile.dept
        });
      }

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

  const presentCount = students.filter(s => attendance[s.id] === "P").length;
  const absentCount = students.filter(s => attendance[s.id] === "A").length;
  const odCount = students.filter(s => attendance[s.id] === "OD").length;
  const attendancePercentage = students.length 
    ? Math.round(((presentCount + odCount) / students.length) * 100) 
    : 0;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Mark Student Attendance</h1>
          <p>{userProfile?.dept} Department • Faculty Portal</p>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="form-row">
            <div className="form-group" style={{ margin: 0 }}>
              <label>Select Year *</label>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                <option value="">Choose Year</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Attendance Date *</label>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Users size={24} color="var(--highlight)" />
              </div>
              <div className="stat-value">{students.length}</div>
              <div className="stat-label">Total Students</div>
            </div>
            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <CheckCircle2 size={24} color="var(--success)" />
              </div>
              <div className="stat-value" style={{ color: "var(--success)" }}>{presentCount}</div>
              <div className="stat-label">Present</div>
            </div>
            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Briefcase size={24} color="var(--warning)" />
              </div>
              <div className="stat-value" style={{ color: "var(--warning)" }}>{odCount}</div>
              <div className="stat-label">On Duty (OD)</div>
            </div>
            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <XCircle size={24} color="var(--danger)" />
              </div>
              <div className="stat-value" style={{ color: "var(--danger)" }}>{absentCount}</div>
              <div className="stat-label">Absent</div>
            </div>
            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <PieChart size={24} color="var(--highlight)" />
              </div>
              <div className="stat-value" style={{ color: "var(--highlight)" }}>{attendancePercentage}%</div>
              <div className="stat-label">Attendance Rate</div>
            </div>
          </div>
        )}

        {/* Student List */}
        {selectedYear && (
          <div className="card">
            {fetching ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : students.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                No students enrolled in {selectedYear}.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      className="btn-secondary"
                      onClick={() => handleMarkAll("P")}
                      style={{ margin: 0, padding: "8px 14px", fontSize: 13, width: "auto" }}
                    >
                      Mark All Present
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleMarkAll("A")}
                      style={{ margin: 0, padding: "8px 14px", fontSize: 13, width: "auto" }}
                    >
                      Mark All Absent
                    </button>
                  </div>

                  <button
                    className="btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                    style={{ width: "auto", padding: "8px 24px" }}
                  >
                    {saving ? "Saving..." : saved ? "Saved!" : "Save Attendance"}
                  </button>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Reg No</th>
                        <th>Student Name</th>
                        <th style={{ textAlign: "center" }}>Attendance Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, idx) => {
                        const status = attendance[student.id] || "P";
                        return (
                          <tr key={student.id}>
                            <td style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                            <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{student.registerNo || "N/A"}</td>
                            <td style={{ fontWeight: 600 }}>{student.name}</td>
                            <td style={{ textAlign: "center" }}>
                              <div style={{ display: "inline-flex", gap: 8, background: "rgba(11, 19, 43, 0.6)", padding: 4, borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                                <button
                                  onClick={() => handleStatusChange(student.id, "P")}
                                  style={{
                                    padding: "6px 14px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer",
                                    fontSize: 12, fontWeight: 700, transition: "all 0.2s ease",
                                    background: status === "P" ? "var(--success)" : "transparent",
                                    color: status === "P" ? "white" : "var(--text-muted)"
                                  }}
                                >
                                  Present
                                </button>
                                <button
                                  onClick={() => handleStatusChange(student.id, "OD")}
                                  style={{
                                    padding: "6px 14px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer",
                                    fontSize: 12, fontWeight: 700, transition: "all 0.2s ease",
                                    background: status === "OD" ? "var(--warning)" : "transparent",
                                    color: status === "OD" ? "white" : "var(--text-muted)"
                                  }}
                                >
                                  OD
                                </button>
                                <button
                                  onClick={() => handleStatusChange(student.id, "A")}
                                  style={{
                                    padding: "6px 14px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer",
                                    fontSize: 12, fontWeight: 700, transition: "all 0.2s ease",
                                    background: status === "A" ? "var(--danger)" : "transparent",
                                    color: status === "A" ? "white" : "var(--text-muted)"
                                  }}
                                >
                                  Absent
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}