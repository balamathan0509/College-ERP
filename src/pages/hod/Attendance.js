// src/pages/hod/Attendance.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export default function HodAttendance() {
  const { userProfile } = useAuth();
  const [selectedYear, setSelectedYear] = useState("1st Year");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [tab, setTab] = useState("daily");
  const [records, setRecords] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [students, setStudents] = useState([]);
  const [fetching, setFetching] = useState(false);

  async function fetchDailyAttendance() {
    setFetching(true);
    try {
      const q = query(
        collection(db, "attendance"),
        where("dept", "==", userProfile.dept),
        where("year", "==", selectedYear),
        where("date", "==", selectedDate)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setRecords(snap.docs[0].data());
      } else {
        setRecords(null);
      }

      // Fetch student names
      const sq = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", userProfile.dept),
        where("year", "==", selectedYear)
      );
      const sSnap = await getDocs(sq);
      setStudents(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {}
    setFetching(false);
  }

  async function fetchAlerts() {
    setFetching(true);
    try {
      const q = query(
        collection(db, "attendance_alerts"),
        where("dept", "==", userProfile.dept)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      setAlerts(list);
    } catch (err) {}
    setFetching(false);
  }

  useEffect(() => {
    if (tab === "daily") fetchDailyAttendance();
    else fetchAlerts();
  }, [tab, selectedYear, selectedDate]);

  const absentStudents = records
    ? students.filter(s => {
        const val = records.records?.[s.id];
        return val === false || val === "A";
      })
    : [];
  const odStudents = records
    ? students.filter(s => records.records?.[s.id] === "OD")
    : [];
  const presentStudents = records
    ? students.filter(s => {
        const val = records.records?.[s.id];
        return val === true || val === "P" || val === undefined;
      })
    : [];

  const presentPercentage = records && records.totalCount
    ? Math.round(((presentStudents.length + odStudents.length) / records.totalCount) * 100)
    : 0;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>📊 Attendance Overview</h1>
          <p>{userProfile?.dept} Department — HOD View</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          {["daily", "alerts"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "10px 24px", borderRadius: 10, border: "none",
              cursor: "pointer", fontFamily: "Syne", fontWeight: 600, fontSize: 14,
              background: tab === t ? "#e94560" : "rgba(255,255,255,0.07)",
              color: "white", transition: "all 0.2s"
            }}>
              {t === "daily" ? "📅 Daily View" : `🔔 Absent Alerts (${alerts.length})`}
            </button>
          ))}
        </div>

        {tab === "daily" && (
          <>
            {/* Filters */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="form-row">
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Year</label>
                  <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Date</label>
                  <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                </div>
              </div>
            </div>

            {fetching ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : records ? (
              <>
                {/* Stats */}
                <div className="stats-grid" style={{ marginBottom: 24 }}>
                  <div className="stat-card" style={{ border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="stat-icon">👥</div>
                    <div className="stat-value">{records.totalCount}</div>
                    <div className="stat-label">Total</div>
                  </div>
                  <div className="stat-card" style={{ border: "1px solid rgba(72,187,120,0.15)" }}>
                    <div className="stat-icon">✅</div>
                    <div className="stat-value" style={{ color: "#48bb78" }}>{presentStudents.length}</div>
                    <div className="stat-label">Present</div>
                  </div>
                  <div className="stat-card" style={{ border: "1px solid rgba(245,158,11,0.15)" }}>
                    <div className="stat-icon">💼</div>
                    <div className="stat-value" style={{ color: "#f5a623" }}>{odStudents.length}</div>
                    <div className="stat-label">On Duty (OD)</div>
                  </div>
                  <div className="stat-card" style={{ border: "1px solid rgba(252,129,129,0.15)" }}>
                    <div className="stat-icon">❌</div>
                    <div className="stat-value" style={{ color: "#fc8181" }}>{absentStudents.length}</div>
                    <div className="stat-label">Absent</div>
                  </div>
                  <div className="stat-card" style={{ border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="stat-icon">📊</div>
                    <div className="stat-value" style={{ color: presentPercentage >= 75 ? "#48bb78" : "#fc8181" }}>
                      {presentPercentage}%
                    </div>
                    <div className="stat-label">Present %</div>
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 20 }}>
                    {selectedYear} — {selectedDate}
                  </h3>

                  {absentStudents.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 13, color: "#fc8181", fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                        ❌ Absent ({absentStudents.length})
                      </div>
                      {absentStudents.map((s, i) => (
                        <div key={s.id} style={{
                          display: "flex", justifyContent: "space-between",
                          padding: "12px 16px", borderRadius: 10, marginBottom: 8,
                          background: "rgba(252,129,129,0.05)", border: "1px solid rgba(252,129,129,0.15)"
                        }}>
                          <span style={{ fontWeight: 600 }}>{i + 1}. {s.name}</span>
                          <span style={{ color: "#a0aec0", fontSize: 13 }}>{s.registerNo}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {odStudents.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 13, color: "#f5a623", fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                        💼 On Duty (OD) ({odStudents.length})
                      </div>
                      {odStudents.map((s, i) => (
                        <div key={s.id} style={{
                          display: "flex", justifyContent: "space-between",
                          padding: "12px 16px", borderRadius: 10, marginBottom: 8,
                          background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)"
                        }}>
                          <span style={{ fontWeight: 600 }}>{i + 1}. {s.name}</span>
                          <span style={{ color: "#a0aec0", fontSize: 13 }}>{s.registerNo}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {presentStudents.length > 0 && (
                    <div>
                      <div style={{ fontSize: 13, color: "#48bb78", fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                        ✅ Present ({presentStudents.length})
                      </div>
                      {presentStudents.map((s, i) => (
                        <div key={s.id} style={{
                          display: "flex", justifyContent: "space-between",
                          padding: "12px 16px", borderRadius: 10, marginBottom: 8,
                          background: "rgba(72,187,120,0.05)", border: "1px solid rgba(72,187,120,0.15)"
                        }}>
                          <span style={{ fontWeight: 600 }}>{i + 1}. {s.name}</span>
                          <span style={{ color: "#a0aec0", fontSize: 13 }}>{s.registerNo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="card" style={{ textAlign: "center", padding: 60 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                <p style={{ color: "#a0aec0" }}>No attendance marked for {selectedDate}</p>
              </div>
            )}
          </>
        )}

        {tab === "alerts" && (
          fetching ? (
            <div style={{ textAlign: "center", padding: 60 }}>
              <div className="spinner" style={{ margin: "0 auto" }}></div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <p style={{ color: "#a0aec0" }}>No absent alerts!</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {alerts.map(alert => (
                <div key={alert.id} className="card" style={{ borderLeft: "4px solid #fc8181" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16 }}>{alert.studentName}</div>
                      <div style={{ color: "#a0aec0", fontSize: 13, marginTop: 4 }}>
                        {alert.registerNo} • {alert.year} • Marked by {alert.markedBy}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#fc8181", fontWeight: 700 }}>❌ Absent</div>
                      <div style={{ color: "#a0aec0", fontSize: 13 }}>{alert.date}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}