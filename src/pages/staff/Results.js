// src/pages/staff/Results.js
import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export default function StaffResults() {
  const { userProfile } = useAuth();
  const [selectedYear, setSelectedYear] = useState(YEARS[0]);
  const [students, setStudents] = useState([]);
  const [resultsMap, setResultsMap] = useState({});
  const [editValues, setEditValues] = useState({});
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState({});

  async function fetchResults() {
    setFetching(true);
    try {
      const studQ = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", userProfile.dept),
        where("year", "==", selectedYear)
      );
      const studSnap = await getDocs(studQ);
      const studentList = studSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      studentList.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(studentList);

      const resultsQ = query(
        collection(db, "results"),
        where("dept", "==", userProfile.dept),
        where("year", "==", selectedYear)
      );
      const resultsSnap = await getDocs(resultsQ);
      const loaded = {};
      resultsSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.studentId) {
          loaded[data.studentId] = data;
        } else {
          loaded[docSnap.id] = data;
        }
      });
      setResultsMap(loaded);
      setEditValues(
        studentList.reduce((acc, student) => {
          acc[student.id] = loaded[student.id]?.summary || "";
          return acc;
        }, {})
      );
    } catch (err) {
      setStudents([]);
      setResultsMap({});
      setEditValues({});
    }
    setFetching(false);
  }

  useEffect(() => {
    if (userProfile) {
      fetchResults();
    }
  }, [userProfile, selectedYear]);

  async function saveResult(student) {
    const value = editValues[student.id] || "";
    setSaving((prev) => ({ ...prev, [student.id]: true }));
    try {
      await setDoc(doc(db, "results", student.id), {
        studentId: student.id,
        studentName: student.name,
        dept: userProfile.dept,
        year: selectedYear,
        summary: value,
        updatedBy: userProfile.name,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setResultsMap((prev) => ({ ...prev, [student.id]: { ...(prev[student.id] || {}), summary: value } }));
    } catch (err) {
      console.error("Failed to save result", err);
    }
    setSaving((prev) => ({ ...prev, [student.id]: false }));
  }

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>🧾 Update Results</h1>
          <p>{userProfile?.dept} Department — Staff Entry</p>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontFamily: "Syne", fontSize: 18 }}>Year Selection</h3>
              <p style={{ margin: 0, color: "#a0aec0" }}>Enter or update results for your department's students.</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {YEARS.map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: selectedYear === year ? "1px solid #7f9cf5" : "1px solid rgba(255,255,255,0.12)",
                    background: selectedYear === year ? "rgba(127,156,245,0.16)" : "rgba(255,255,255,0.05)",
                    color: selectedYear === year ? "white" : "#a0aec0",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600
                  }}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{fetching ? "..." : students.length}</div>
            <div className="stat-label">Students</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📝</div>
            <div className="stat-value" style={{ color: "#48bb78" }}>{fetching ? "..." : Object.keys(resultsMap).filter((id) => resultsMap[id]?.summary).length}</div>
            <div className="stat-label">Entries Saved</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-value" style={{ color: "#f5a623" }}>{fetching ? "..." : students.length - Object.keys(resultsMap).filter((id) => resultsMap[id]?.summary).length}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>

        {fetching ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div className="spinner" style={{ margin: "0 auto" }}></div>
          </div>
        ) : (
          <div className="card">
            {students.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#a0aec0" }}>
                No students found for {selectedYear}.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {students.map((student) => {
                  const existing = resultsMap[student.id] || {};
                  return (
                    <div key={student.id} style={{ padding: 18, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{student.name}</div>
                          <div style={{ fontSize: 13, color: "#a0aec0", marginTop: 4 }}>{student.registerNo || student.email}</div>
                        </div>
                        <div style={{ minWidth: 120, textAlign: "right" }}>
                          <div style={{ fontSize: 12, color: "#a0aec0" }}>{student.year} • {student.dept}</div>
                          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: existing.summary ? "#48bb78" : "#f5a623" }}>
                            {existing.summary ? "Has result" : "No result yet"}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 16 }}>
                        <label style={{ display: "block", marginBottom: 8, color: "#a0aec0", fontSize: 13 }}>Result summary / grade</label>
                        <textarea
                          value={editValues[student.id] || ""}
                          onChange={(e) => setEditValues((prev) => ({ ...prev, [student.id]: e.target.value }))}
                          rows={3}
                          style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "white", padding: 12, resize: "vertical" }}
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                        <button
                          onClick={() => saveResult(student)}
                          disabled={saving[student.id]}
                          style={{
                            padding: "10px 20px",
                            borderRadius: 10,
                            border: "none",
                            background: "#7f9cf5",
                            color: "white",
                            fontWeight: 700,
                            cursor: "pointer"
                          }}
                        >
                          {saving[student.id] ? "Saving..." : "Save Result"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
