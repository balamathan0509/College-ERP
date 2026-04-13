// src/pages/staff/Results.js
import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import {
  collection, query, where, getDocs, addDoc
} from "firebase/firestore";

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const EXAM_TYPES = ["Internal", "Semester"];

export default function StaffResults() {
  const { userProfile } = useAuth();

  // Setup state
  const [selectedYear, setSelectedYear] = useState(YEARS[0]);
  const [examType, setExamType] = useState(EXAM_TYPES[0]);
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");

  // Student list state
  const [students, setStudents] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState(false);

  // Marks state — { studentId: { mark: "", result: "Pass" } }
  const [marksMap, setMarksMap] = useState({});

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // History state — past submissions by this staff
  const [tab, setTab] = useState("entry"); // "entry" | "history"
  const [history, setHistory] = useState([]);
  const [historyFetching, setHistoryFetching] = useState(false);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // Fetch students for selected year + dept
  async function fetchStudents() {
    if (!userProfile?.dept) return;
    setFetching(true);
    setFetched(false);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", userProfile.dept),
        where("year", "==", selectedYear)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setStudents(list);

      // Initialize marks map
      const initial = {};
      list.forEach(s => {
        initial[s.id] = { mark: "", result: "Pass" };
      });
      setMarksMap(initial);
      setFetched(true);
    } catch (err) {
      showToast("Failed to fetch students.", "error");
    }
    setFetching(false);
  }

  // Auto-calculate pass/fail when mark changes
  function handleMarkChange(studentId, value) {
    const numericValue = value.replace(/[^0-9]/g, "");
    const mark = numericValue === "" ? "" : parseInt(numericValue, 10);
    const result = mark !== "" && mark < 50 ? "Fail" : "Pass";
    setMarksMap(prev => ({
      ...prev,
      [studentId]: { mark: numericValue, result }
    }));
  }

  function handleResultToggle(studentId, value) {
    setMarksMap(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], result: value }
    }));
  }

  // Submit & Forward to HOD
  async function handleSubmit() {
    if (!subjectName.trim() || !subjectCode.trim()) {
      return showToast("Please enter Subject Name and Subject Code.", "error");
    }
    if (students.length === 0) {
      return showToast("No students to submit results for.", "error");
    }

    // Check all marks are filled
    const incomplete = students.filter(s => marksMap[s.id]?.mark === "" || marksMap[s.id]?.mark === undefined);
    if (incomplete.length > 0) {
      return showToast(`Please enter marks for all students. ${incomplete.length} student(s) missing.`, "error");
    }

    setSubmitting(true);
    try {
      // Build marks object with student names for HOD reference
      const marksData = {};
      students.forEach(s => {
        marksData[s.id] = {
          name: s.name,
          registerNo: s.registerNo || "",
          mark: parseInt(marksMap[s.id].mark, 10),
          result: marksMap[s.id].result
        };
      });

      await addDoc(collection(db, "exam_results"), {
        dept: userProfile.dept,
        year: selectedYear,
        examType,
        subjectName: subjectName.trim(),
        subjectCode: subjectCode.trim(),
        staffId: userProfile.uid,
        staffName: userProfile.name,
        status: "pending_hod",
        marks: marksData,
        totalStudents: students.length,
        passCount: students.filter(s => marksMap[s.id].result === "Pass").length,
        failCount: students.filter(s => marksMap[s.id].result === "Fail").length,
        createdAt: new Date().toISOString()
      });

      showToast("✅ Results submitted & forwarded to HOD successfully!");
      // Reset form
      setSubjectName("");
      setSubjectCode("");
      setFetched(false);
      setStudents([]);
      setMarksMap({});
    } catch (err) {
      showToast("Failed to submit results: " + err.message, "error");
    }
    setSubmitting(false);
  }

  // Fetch history
  const fetchHistory = useCallback(async () => {
    if (!userProfile) return;
    setHistoryFetching(true);
    try {
      const q = query(
        collection(db, "exam_results"),
        where("staffId", "==", userProfile.uid)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setHistory(list);
    } catch (err) {}
    setHistoryFetching(false);
  }, [userProfile]);

  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [tab, fetchHistory]);

  const passCount = students.filter(s => marksMap[s.id]?.result === "Pass").length;
  const failCount = students.filter(s => marksMap[s.id]?.result === "Fail").length;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        {/* Toast */}
        {toast && (
          <div style={{
            position: "fixed", top: 24, right: 24, zIndex: 3000,
            padding: "14px 24px", borderRadius: 14,
            background: toast.type === "error" ? "rgba(252,129,129,0.95)" : "rgba(72,187,120,0.95)",
            color: "white", fontWeight: 600, fontSize: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            animation: "slideIn 0.3s ease", maxWidth: 420
          }}>
            {toast.message}
          </div>
        )}

        <div className="page-header">
          <h1>🧾 Exam Results Entry</h1>
          <p>{userProfile?.dept} Department — Staff Panel</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          {[
            { key: "entry", label: "📝 New Entry" },
            { key: "history", label: "📋 My Submissions" }
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer",
              fontFamily: "Syne", fontWeight: 600, fontSize: 14,
              background: tab === t.key ? "#7f9cf5" : "rgba(255,255,255,0.07)",
              color: "white", transition: "all 0.2s"
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "entry" && (
          <>
            {/* Setup Card */}
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 20 }}>📋 Exam Setup</h3>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                {/* Year Selection */}
                <div className="form-group">
                  <label>Year</label>
                  <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                {/* Exam Type */}
                <div className="form-group">
                  <label>Exam Type</label>
                  <select value={examType} onChange={e => setExamType(e.target.value)}>
                    {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Subject Name */}
                <div className="form-group">
                  <label>Subject Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Mathematics"
                    value={subjectName}
                    onChange={e => setSubjectName(e.target.value)}
                  />
                </div>

                {/* Subject Code */}
                <div className="form-group">
                  <label>Subject Code</label>
                  <input
                    type="text"
                    placeholder="e.g. MA101"
                    value={subjectCode}
                    onChange={e => setSubjectCode(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <button
                  onClick={fetchStudents}
                  disabled={fetching}
                  style={{
                    padding: "12px 28px", borderRadius: 12, border: "none", cursor: "pointer",
                    background: "linear-gradient(135deg, #7f9cf5, #667eea)", color: "white",
                    fontFamily: "Syne", fontWeight: 700, fontSize: 14,
                    boxShadow: "0 4px 16px rgba(127,156,245,0.3)",
                    opacity: fetching ? 0.6 : 1
                  }}
                >
                  {fetching ? "Loading..." : "📥 Fetch Students"}
                </button>
              </div>
            </div>

            {/* Students Mark Entry */}
            {fetched && (
              <>
                {/* Stats */}
                <div className="stats-grid" style={{ marginBottom: 24 }}>
                  <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <div className="stat-value">{students.length}</div>
                    <div className="stat-label">Total Students</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">✅</div>
                    <div className="stat-value" style={{ color: "#48bb78" }}>{passCount}</div>
                    <div className="stat-label">Pass</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">❌</div>
                    <div className="stat-value" style={{ color: "#fc8181" }}>{failCount}</div>
                    <div className="stat-label">Fail</div>
                  </div>
                </div>

                {/* Info Banner */}
                <div style={{
                  background: "rgba(127,156,245,0.1)", border: "1px solid rgba(127,156,245,0.2)",
                  borderRadius: 14, padding: "14px 20px", marginBottom: 20,
                  display: "flex", alignItems: "center", gap: 12
                }}>
                  <span style={{ fontSize: 20 }}>📌</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#7f9cf5" }}>
                      {examType} — {subjectName} ({subjectCode})
                    </div>
                    <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 2 }}>
                      {selectedYear} • {userProfile?.dept} • {students.length} students (sorted alphabetically)
                    </div>
                  </div>
                </div>

                {students.length === 0 ? (
                  <div className="card" style={{ textAlign: "center", padding: 60 }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                    <p style={{ color: "#a0aec0" }}>No students found for {selectedYear} in {userProfile?.dept}.</p>
                  </div>
                ) : (
                  <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                            {["S.No", "Student Name", "Register No", "Mark", "Result"].map(h => (
                              <th key={h} style={{
                                padding: "14px 18px", textAlign: "left", fontSize: 11,
                                color: "#a0aec0", textTransform: "uppercase", letterSpacing: 1,
                                fontWeight: 600, fontFamily: "'DM Sans', sans-serif"
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((student, idx) => {
                            const entry = marksMap[student.id] || { mark: "", result: "Pass" };
                            return (
                              <tr key={student.id} style={{
                                borderBottom: "1px solid rgba(255,255,255,0.05)",
                                background: entry.result === "Fail" ? "rgba(252,129,129,0.05)" : "transparent"
                              }}>
                                <td style={{ padding: "12px 18px", fontSize: 13, color: "#a0aec0" }}>{idx + 1}</td>
                                <td style={{ padding: "12px 18px" }}>
                                  <div style={{ fontWeight: 600, fontSize: 14, color: "white" }}>{student.name}</div>
                                </td>
                                <td style={{ padding: "12px 18px", fontSize: 13, color: "#a0aec0" }}>
                                  {student.registerNo || "—"}
                                </td>
                                <td style={{ padding: "12px 18px" }}>
                                  <input
                                    type="text"
                                    value={entry.mark}
                                    onChange={e => handleMarkChange(student.id, e.target.value)}
                                    placeholder="0-100"
                                    style={{
                                      width: 80, padding: "8px 12px",
                                      background: "rgba(255,255,255,0.07)",
                                      border: "1px solid rgba(255,255,255,0.12)",
                                      borderRadius: 8, color: "white", fontSize: 14,
                                      textAlign: "center", outline: "none",
                                      fontFamily: "'DM Sans', sans-serif"
                                    }}
                                  />
                                </td>
                                <td style={{ padding: "12px 18px" }}>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button
                                      onClick={() => handleResultToggle(student.id, "Pass")}
                                      style={{
                                        padding: "6px 14px", borderRadius: 8, border: "none",
                                        cursor: "pointer", fontSize: 12, fontWeight: 700,
                                        background: entry.result === "Pass" ? "rgba(72,187,120,0.2)" : "rgba(255,255,255,0.05)",
                                        color: entry.result === "Pass" ? "#48bb78" : "#a0aec0"
                                      }}
                                    >
                                      ✅ Pass
                                    </button>
                                    <button
                                      onClick={() => handleResultToggle(student.id, "Fail")}
                                      style={{
                                        padding: "6px 14px", borderRadius: 8, border: "none",
                                        cursor: "pointer", fontSize: 12, fontWeight: 700,
                                        background: entry.result === "Fail" ? "rgba(252,129,129,0.2)" : "rgba(255,255,255,0.05)",
                                        color: entry.result === "Fail" ? "#fc8181" : "#a0aec0"
                                      }}
                                    >
                                      ❌ Fail
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Submit Button */}
                    <div style={{ padding: "20px 24px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        style={{
                          padding: "14px 32px", borderRadius: 12, border: "none", cursor: "pointer",
                          background: "linear-gradient(135deg, #48bb78, #38a169)", color: "white",
                          fontFamily: "Syne", fontWeight: 700, fontSize: 15,
                          boxShadow: "0 4px 16px rgba(72,187,120,0.3)",
                          opacity: submitting ? 0.6 : 1
                        }}
                      >
                        {submitting ? "Submitting..." : "➡️ Submit & Forward to HOD"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* History Tab */}
        {tab === "history" && (
          historyFetching ? (
            <div style={{ textAlign: "center", padding: 60 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
          ) : history.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
              <p style={{ color: "#a0aec0" }}>No previous submissions found.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {history.map(item => (
                <div key={item.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 18 }}>{item.examType === "Internal" ? "📝" : "🎓"}</span>
                        <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16 }}>
                          {item.subjectName} ({item.subjectCode})
                        </div>
                        <span style={{
                          padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: item.examType === "Internal" ? "rgba(127,156,245,0.15)" : "rgba(159,122,234,0.15)",
                          color: item.examType === "Internal" ? "#7f9cf5" : "#9f7aea"
                        }}>{item.examType}</span>
                      </div>
                      <div style={{ color: "#a0aec0", fontSize: 13 }}>
                        {item.year} • {item.dept} • {item.totalStudents} students • ✅ {item.passCount} Pass • ❌ {item.failCount} Fail
                      </div>
                      <div style={{ color: "#a0aec0", fontSize: 12, marginTop: 6 }}>
                        📅 {new Date(item.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span style={{
                        padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: item.status === "verified" ? "rgba(72,187,120,0.15)" : item.status === "rejected" ? "rgba(252,129,129,0.15)" : "rgba(245,166,35,0.15)",
                        color: item.status === "verified" ? "#48bb78" : item.status === "rejected" ? "#fc8181" : "#f5a623"
                      }}>
                        {item.status === "verified" ? "✅ Verified by HOD" : item.status === "rejected" ? "❌ Rejected" : "⏳ Pending HOD Review"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>
      </main>
    </div>
  );
}
