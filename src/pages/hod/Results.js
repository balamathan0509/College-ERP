// src/pages/hod/Results.js
import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export default function HodResults() {
  const { userProfile } = useAuth();
  const [selectedYear, setSelectedYear] = useState(YEARS[0]);
  const [students, setStudents] = useState([]);
  const [resultsMap, setResultsMap] = useState({});
  const [fetching, setFetching] = useState(true);

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
      resultsSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.studentId) {
          loaded[data.studentId] = data;
        } else {
          loaded[doc.id] = data;
        }
      });
      setResultsMap(loaded);
    } catch (err) {
      setStudents([]);
      setResultsMap({});
    }
    setFetching(false);
  }

  useEffect(() => {
    if (userProfile) {
      fetchResults();
    }
  }, [userProfile, selectedYear]);

  const publishedCount = students.filter((s) => resultsMap[s.id]).length;
  const pendingCount = students.length - publishedCount;

  function formatSummary(result) {
    if (!result) return "No result published yet.";
    if (result.summary) return result.summary;
    if (result.marks) {
      return Object.entries(result.marks)
        .map(([subject, value]) => `${subject}: ${value}`)
        .join(" · ");
    }
    if (result.grade) return `Grade: ${result.grade}`;
    if (result.cgpa) return `CGPA: ${result.cgpa}`;
    return "Result recorded.";
  }

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>🧾 Student Results</h1>
          <p>{userProfile?.dept} Department — HOD Overview</p>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontFamily: "Syne", fontSize: 18 }}>Year Selection</h3>
              <p style={{ margin: 0, color: "#a0aec0" }}>View published results for each academic year.</p>
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
            <div className="stat-label">Students in {selectedYear}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value" style={{ color: "#48bb78" }}>{fetching ? "..." : publishedCount}</div>
            <div className="stat-label">Results Published</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-value" style={{ color: "#f5a623" }}>{fetching ? "..." : pendingCount}</div>
            <div className="stat-label">Pending Publication</div>
          </div>
        </div>

        {fetching ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div className="spinner" style={{ margin: "0 auto" }}></div>
          </div>
        ) : (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: "Syne", fontSize: 18 }}>{selectedYear} Result Summary</h3>
                <p style={{ margin: 0, color: "#a0aec0" }}>Published results are shown by student. Use staff result entry to upload marks.</p>
              </div>
            </div>

            {students.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#a0aec0" }}>
                No students found for {selectedYear}.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {students.map((student) => {
                  const result = resultsMap[student.id];
                  return (
                    <div
                      key={student.id}
                      style={{
                        padding: 18,
                        borderRadius: 14,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{student.name}</div>
                          <div style={{ fontSize: 13, color: "#a0aec0", marginTop: 4 }}>{student.registerNo || student.email}</div>
                        </div>
                        <div style={{ textAlign: "right", minWidth: 120 }}>
                          <div style={{ fontSize: 12, color: "#a0aec0" }}>{student.year} • {student.dept}</div>
                          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: result ? "#48bb78" : "#f5a623" }}>
                            {result ? "Published" : "Pending"}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 14, color: "#e2e8f0", fontSize: 13, lineHeight: 1.6 }}>
                        {formatSummary(result)}
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
