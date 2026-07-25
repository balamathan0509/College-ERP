// src/pages/student/Attendance.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import {
  Calendar,
  CheckCircle2,
  Briefcase,
  XCircle,
  PieChart,
  AlertTriangle,
  Inbox
} from "lucide-react";

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
        const rawStatus = data.records?.[currentUser.uid];
        let status = "P";
        if (rawStatus === false || rawStatus === "A") {
          status = "A";
        } else if (rawStatus === "OD") {
          status = "OD";
        } else {
          status = "P";
        }
        return {
          date: data.date,
          status,
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

  const presentDays = records.filter(r => r.status === "P").length;
  const absentDays = records.filter(r => r.status === "A").length;
  const odDays = records.filter(r => r.status === "OD").length;
  const totalDays = records.length;
  const percentage = totalDays ? Math.round(((presentDays + odDays) / totalDays) * 100) : 0;

  const percentColor = percentage >= 75 ? "var(--success)" : percentage >= 60 ? "var(--warning)" : "var(--danger)";

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>My Attendance Analytics</h1>
          <p>{userProfile?.dept} Department • Year {userProfile?.year}</p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Calendar size={24} color="var(--highlight)" />
            </div>
            <div className="stat-value">{totalDays}</div>
            <div className="stat-label">Total Days</div>
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <CheckCircle2 size={24} color="var(--success)" />
            </div>
            <div className="stat-value" style={{ color: "var(--success)" }}>{presentDays}</div>
            <div className="stat-label">Present Days</div>
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Briefcase size={24} color="var(--warning)" />
            </div>
            <div className="stat-value" style={{ color: "var(--warning)" }}>{odDays}</div>
            <div className="stat-label">On Duty (OD)</div>
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <XCircle size={24} color="var(--danger)" />
            </div>
            <div className="stat-value" style={{ color: "var(--danger)" }}>{absentDays}</div>
            <div className="stat-label">Absent Days</div>
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <PieChart size={24} color={percentColor} />
            </div>
            <div className="stat-value" style={{ color: percentColor }}>{percentage}%</div>
            <div className="stat-label">Attendance Percentage</div>
          </div>
        </div>

        {/* Warning */}
        {percentage < 75 && totalDays > 0 && (
          <div style={{
            padding: "16px 20px", borderRadius: "var(--radius-md)", marginBottom: 24,
            background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)",
            display: "flex", alignItems: "center", gap: 14
          }}>
            <AlertTriangle size={24} color="var(--danger)" />
            <div>
              <div style={{ color: "var(--danger)", fontWeight: 700, fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 16, marginBottom: 2 }}>
                Low Attendance Warning
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Your current attendance is {percentage}%, which is below the mandatory 75% threshold. Please ensure regular attendance.
              </div>
            </div>
          </div>
        )}

        {/* Records */}
        {fetching ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div className="spinner" style={{ margin: "0 auto" }}></div>
          </div>
        ) : records.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 50 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <Inbox size={48} color="var(--text-muted)" />
            </div>
            <p style={{ color: "var(--text-muted)" }}>No attendance records recorded yet.</p>
          </div>
        ) : (
          <div className="card">
            <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, marginBottom: 20, fontWeight: 700 }}>
              Attendance History & Log
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Recorded By</th>
                    <th style={{ textAlign: "center" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, idx) => {
                    const dateObj = new Date(record.date);
                    const day = dateObj.toLocaleDateString("en-US", { weekday: "long" });
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{record.date}</td>
                        <td style={{ color: "var(--text-muted)" }}>{day}</td>
                        <td style={{ color: "var(--text-muted)" }}>{record.markedBy || "Faculty"}</td>
                        <td style={{ textAlign: "center" }}>
                          {record.status === "P" && (
                            <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <CheckCircle2 size={13} /> Present
                            </span>
                          )}
                          {record.status === "OD" && (
                            <span className="badge badge-warning" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <Briefcase size={13} /> On Duty (OD)
                            </span>
                          )}
                          {record.status === "A" && (
                            <span className="badge badge-danger" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <XCircle size={13} /> Absent
                            </span>
                          )}
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