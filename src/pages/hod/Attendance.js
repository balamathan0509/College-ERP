// src/pages/hod/Attendance.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import {
  CheckSquare,
  Users,
  CheckCircle2,
  Briefcase,
  XCircle,
  PieChart,
  AlertTriangle,
  Inbox
} from "lucide-react";

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
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAlerts(list);
    } catch (err) {}
    setFetching(false);
  }

  useEffect(() => {
    if (tab === "daily") fetchDailyAttendance();
    if (tab === "alerts") fetchAlerts();
  }, [selectedYear, selectedDate, tab]);

  const rawRecs = records?.records || {};
  const presentStudents = students.filter(s => rawRecs[s.id] === "P" || rawRecs[s.id] === true);
  const absentStudents = students.filter(s => rawRecs[s.id] === "A" || rawRecs[s.id] === false);
  const odStudents = students.filter(s => rawRecs[s.id] === "OD");

  const presentPercentage = records?.totalCount
    ? Math.round(((presentStudents.length + odStudents.length) / records.totalCount) * 100)
    : 0;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Department Attendance Monitor</h1>
          <p>{userProfile?.dept} Department • HOD Executive Dashboard</p>
        </div>

        {/* Tab Toggle */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
          <button
            onClick={() => setTab("daily")}
            style={{
              padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.2s ease",
              background: tab === "daily" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
              color: tab === "daily" ? "var(--highlight)" : "var(--text-muted)"
            }}
          >
            Daily Attendance Log
          </button>
          <button
            onClick={() => setTab("alerts")}
            style={{
              padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.2s ease",
              background: tab === "alerts" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
              color: tab === "alerts" ? "var(--highlight)" : "var(--text-muted)"
            }}
          >
            Low Attendance Alerts ({alerts.length})
          </button>
        </div>

        {tab === "daily" && (
          <div>
            {/* Filter */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="form-row">
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Select Year *</label>
                  <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Select Date *</label>
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
                  <div className="stat-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <Users size={24} color="var(--highlight)" />
                    </div>
                    <div className="stat-value">{records.totalCount}</div>
                    <div className="stat-label">Total Enrolled</div>
                  </div>
                  <div className="stat-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <CheckCircle2 size={24} color="var(--success)" />
                    </div>
                    <div className="stat-value" style={{ color: "var(--success)" }}>{presentStudents.length}</div>
                    <div className="stat-label">Present</div>
                  </div>
                  <div className="stat-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <Briefcase size={24} color="var(--warning)" />
                    </div>
                    <div className="stat-value" style={{ color: "var(--warning)" }}>{odStudents.length}</div>
                    <div className="stat-label">On Duty (OD)</div>
                  </div>
                  <div className="stat-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <XCircle size={24} color="var(--danger)" />
                    </div>
                    <div className="stat-value" style={{ color: "var(--danger)" }}>{absentStudents.length}</div>
                    <div className="stat-label">Absent</div>
                  </div>
                  <div className="stat-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <PieChart size={24} color={presentPercentage >= 75 ? "var(--success)" : "var(--danger)"} />
                    </div>
                    <div className="stat-value" style={{ color: presentPercentage >= 75 ? "var(--success)" : "var(--danger)" }}>
                      {presentPercentage}%
                    </div>
                    <div className="stat-label">Attendance Rate</div>
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 20 }}>
                    {selectedYear} • Date: {selectedDate}
                  </h3>

                  {absentStudents.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 13, color: "var(--danger)", fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                        <XCircle size={16} /> Absent Students ({absentStudents.length})
                      </div>
                      {absentStudents.map((s, i) => (
                        <div key={s.id} style={{
                          display: "flex", justifyContent: "space-between",
                          padding: "12px 16px", borderRadius: "var(--radius-sm)", marginBottom: 8,
                          background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.25)"
                        }}>
                          <span style={{ fontWeight: 600, color: "var(--text)" }}>{i + 1}. {s.name}</span>
                          <span style={{ color: "var(--text-muted)", fontSize: 13, fontFamily: "monospace" }}>{s.registerNo}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {odStudents.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 13, color: "var(--warning)", fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                        <Briefcase size={16} /> On Duty (OD) Students ({odStudents.length})
                      </div>
                      {odStudents.map((s, i) => (
                        <div key={s.id} style={{
                          display: "flex", justifyContent: "space-between",
                          padding: "12px 16px", borderRadius: "var(--radius-sm)", marginBottom: 8,
                          background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.25)"
                        }}>
                          <span style={{ fontWeight: 600, color: "var(--text)" }}>{i + 1}. {s.name}</span>
                          <span style={{ color: "var(--text-muted)", fontSize: 13, fontFamily: "monospace" }}>{s.registerNo}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {presentStudents.length > 0 && (
                    <div>
                      <div style={{ fontSize: 13, color: "var(--success)", fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                        <CheckCircle2 size={16} /> Present Students ({presentStudents.length})
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                        {presentStudents.map(s => (
                          <div key={s.id} style={{
                            padding: "10px 14px", borderRadius: "var(--radius-sm)",
                            background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.25)",
                            fontSize: 13, fontWeight: 500, color: "var(--text)"
                          }}>
                            {s.name} <span style={{ opacity: 0.7, fontSize: 12 }}>({s.registerNo})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="card" style={{ textAlign: "center", padding: 50 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                  <Inbox size={48} color="var(--text-muted)" />
                </div>
                <p style={{ color: "var(--text-muted)" }}>Attendance not marked for {selectedYear} on {selectedDate}.</p>
              </div>
            )}
          </div>
        )}

        {tab === "alerts" && (
          <div>
            {fetching ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : alerts.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 50 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                  <Inbox size={48} color="var(--text-muted)" />
                </div>
                <p style={{ color: "var(--text-muted)" }}>No low attendance alerts recorded for {userProfile?.dept}.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {alerts.map(a => (
                  <div key={a.id} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <AlertTriangle size={18} color="var(--danger)" />
                          <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                            {a.studentName} ({a.registerNo})
                          </h3>
                          <span className="badge badge-danger">{a.percentage}% Attendance</span>
                        </div>
                        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 4 }}>
                          Year {a.year} • {userProfile?.dept} Department
                        </p>
                        <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
                          Triggered on: {new Date(a.createdAt).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}