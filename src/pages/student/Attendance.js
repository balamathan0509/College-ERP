// src/pages/student/Attendance.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function StudentAttendance() {
  const { currentUser, userProfile } = useAuth();
  const [records, setRecords] = useState([]);
  const [fetching, setFetching] = useState(true);

  async function fetchAttendance() {
    setFetching(true);
    try {
      const q = query(
        collection(db, "attendance"),
        where("dept", "==", userProfile.dept),
        where("year", "==", userProfile.year)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          date: data.date,
          present: data.records?.[currentUser.uid] ?? null,
          total: data.totalCount,
          markedBy: data.markedBy
        };
      });
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecords(list);
    } catch (err) {}
    setFetching(false);
  }

  useEffect(() => { fetchAttendance(); }, []);

  const presentDays = records.filter(r => r.present === true).length;
  const absentDays = records.filter(r => r.present === false).length;
  const totalDays = records.filter(r => r.present !== null).length;
  const percentage = totalDays ? Math.round((presentDays / totalDays) * 100) : 0;

  const percentColor = percentage >= 75 ? "#48bb78" : percentage >= 60 ? "#f6ad55" : "#fc8181";

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>📋 My Attendance</h1>
          <p>{userProfile?.dept} • {userProfile?.year}</p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-value">{totalDays}</div>
            <div className="stat-label">Total Days</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value" style={{ color: "#48bb78" }}>{presentDays}</div>
            <div className="stat-label">Present</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">❌</div>
            <div className="stat-value" style={{ color: "#fc8181" }}>{absentDays}</div>
            <div className="stat-label">Absent</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-value" style={{ color: percentColor }}>{percentage}%</div>
            <div className="stat-label">Attendance %</div>
          </div>
        </div>

        {/* Warning */}
        {percentage < 75 && totalDays > 0 && (
          <div style={{
            padding: "16px 20px", borderRadius: 12, marginBottom: 24,
            background: "rgba(252,129,129,0.1)", border: "1px solid rgba(252,129,129,0.3)"
          }}>
            <div style={{ color: "#fc8181", fontWeight: 700, fontFamily: "Syne", fontSize: 16, marginBottom: 4 }}>
              ⚠️ Low Attendance Warning
            </div>
            <div style={{ color: "#e2e8f0", fontSize: 14 }}>
              Your attendance is {percentage}% which is below the required 75%. Please attend classes regularly.
            </div>
          </div>
        )}

        {/* Records */}
        {fetching ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div className="spinner" style={{ margin: "0 auto" }}></div>
          </div>
        ) : records.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <p style={{ color: "#a0aec0" }}>No attendance records found yet.</p>
          </div>
        ) : (
          <div className="card">
            <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 20 }}>Attendance History</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>Date</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>Day</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>Marked By</th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, idx) => {
                    const dateObj = new Date(record.date);
                    const day = dateObj.toLocaleDateString("en-US", { weekday: "long" });
                    return (
                      <tr key={idx} style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        background: record.present ? "rgba(72,187,120,0.03)" : "rgba(252,129,129,0.03)"
                      }}>
                        <td style={{ padding: "14px 16px", fontWeight: 600, fontSize: 14 }}>{record.date}</td>
                        <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 14 }}>{day}</td>
                        <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 14 }}>{record.markedBy || "Staff"}</td>
                        <td style={{ padding: "14px 16px", textAlign: "center" }}>
                          <span style={{
                            padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                            background: record.present ? "rgba(72,187,120,0.15)" : "rgba(252,129,129,0.15)",
                            color: record.present ? "#48bb78" : "#fc8181"
                          }}>
                            {record.present ? "✅ Present" : "❌ Absent"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}