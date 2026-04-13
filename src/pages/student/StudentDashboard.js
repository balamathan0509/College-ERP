// src/pages/student/StudentDashboard.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function StudentDashboard() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    attendancePercent: null,
    totalDays: 0,
    presentDays: 0,
    gatePassCount: 0,
    pendingFees: 0,
    newAlerts: 0
  });
  const [loading, setLoading] = useState(true);

  async function fetchStats() {
    try {
      // Attendance
      const attQ = query(
        collection(db, "attendance"),
        where("dept", "==", userProfile.dept),
        where("year", "==", userProfile.year)
      );
      const attSnap = await getDocs(attQ);
      const attRecords = attSnap.docs.map(d => d.data());
      const totalDays = attRecords.filter(r => r.records?.[currentUser.uid] !== undefined).length;
      const presentDays = attRecords.filter(r => r.records?.[currentUser.uid] === true).length;
      const attendancePercent = totalDays ? Math.round((presentDays / totalDays) * 100) : null;

      // Gate Pass
      const gpQ = query(
        collection(db, "gate_pass"),
        where("studentId", "==", currentUser.uid)
      );
      const gpSnap = await getDocs(gpQ);
      const gatePassCount = gpSnap.size;

      // Pending Fees
      const feesQ = query(
        collection(db, "fees"),
        where("dept", "==", userProfile.dept),
        where("year", "==", userProfile.year)
      );
      const feesSnap = await getDocs(feesQ);
      const pendingFees = feesSnap.docs.filter(d => !d.data().payments?.[currentUser.uid]).length;

      // Alerts
      const alertQ = query(
        collection(db, "alerts"),
        where("dept", "in", [userProfile.dept, "all"])
      );
      const alertSnap = await getDocs(alertQ);
      const newAlerts = alertSnap.size;

      setStats({ attendancePercent, totalDays, presentDays, gatePassCount, pendingFees, newAlerts });
    } catch (err) {}
    setLoading(false);
  }

  useEffect(() => { if (userProfile) fetchStats(); }, [userProfile]);

  const quickActions = [
    { icon: "🚪", label: "Gate Pass", path: "/student/gatepass", color: "#e94560" },
    { icon: "📋", label: "Attendance", path: "/student/attendance", color: "#f5a623" },
    { icon: "💰", label: "Fees", path: "/student/fees", color: "#48bb78" },
    { icon: "📅", label: "Timetable", path: "/student/timetable", color: "#4299e1" },
    { icon: "💼", label: "Placements", path: "/student/placements", color: "#9f7aea" },
    { icon: "📢", label: "Alerts", path: "/student/alerts", color: "#f6ad55" },
    { icon: "📝", label: "Complaints", path: "/student/complaints", color: "#fc8181" }
  ];

  const attColor = stats.attendancePercent === null ? "#a0aec0" :
    stats.attendancePercent >= 75 ? "#48bb78" :
    stats.attendancePercent >= 60 ? "#f5a623" : "#fc8181";

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <DateTimeHeader />
        <div className="page-header">
          <h1>Welcome back, {userProfile?.name?.split(" ")[0]} 👋</h1>
          <p>{userProfile?.dept} • {userProfile?.year} • {userProfile?.registerNo}
            {userProfile?.studentType && (
              <span style={{ marginLeft: 8, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: userProfile.studentType === "hosteller" ? "rgba(66,153,225,0.15)" : "rgba(159,122,234,0.15)", color: userProfile.studentType === "hosteller" ? "#4299e1" : "#9f7aea" }}>
                {userProfile.studentType === "hosteller" ? "🏠 Hosteller" : "🏡 Day Scholar"}
              </span>
            )}
          </p>
        </div>

        {/* Live Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/student/attendance")}>
            <div className="stat-icon">📋</div>
            <div className="stat-value" style={{ color: attColor }}>
              {loading ? "..." : stats.attendancePercent !== null ? `${stats.attendancePercent}%` : "N/A"}
            </div>
            <div className="stat-label">Attendance</div>
            {!loading && stats.totalDays > 0 && (
              <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 4 }}>{stats.presentDays}/{stats.totalDays} days</div>
            )}
          </div>

          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/student/gatepass")}>
            <div className="stat-icon">🚪</div>
            <div className="stat-value">{loading ? "..." : stats.gatePassCount}</div>
            <div className="stat-label">Gate Passes</div>
          </div>

          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/student/fees")}>
            <div className="stat-icon">💰</div>
            <div className="stat-value" style={{ color: stats.pendingFees > 0 ? "#fc8181" : "#48bb78" }}>
              {loading ? "..." : stats.pendingFees}
            </div>
            <div className="stat-label">Pending Fees</div>
            {!loading && <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 4 }}>{stats.pendingFees > 0 ? "Pay now!" : "All clear ✅"}</div>}
          </div>

          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/student/alerts")}>
            <div className="stat-icon">📢</div>
            <div className="stat-value">{loading ? "..." : stats.newAlerts}</div>
            <div className="stat-label">Alerts</div>
          </div>
        </div>

        {/* Low attendance warning */}
        {!loading && stats.attendancePercent !== null && stats.attendancePercent < 75 && (
          <div style={{ padding: "14px 20px", borderRadius: 12, marginBottom: 24, background: "rgba(252,129,129,0.1)", border: "1px solid rgba(252,129,129,0.3)", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ color: "#fc8181", fontWeight: 700, fontFamily: "Syne" }}>Low Attendance Warning!</div>
              <div style={{ color: "#e2e8f0", fontSize: 13 }}>Your attendance is {stats.attendancePercent}% — below required 75%. Please attend classes regularly.</div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="card">
          <h3 style={{ marginBottom: 20, fontFamily: "Syne", fontSize: 18 }}>Quick Actions</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16 }}>
            {quickActions.map((action) => (
              <div key={action.path} onClick={() => navigate(action.path)} style={{
                padding: "20px 16px", borderRadius: 14,
                border: `1px solid ${action.color}30`,
                background: `${action.color}10`,
                cursor: "pointer", textAlign: "center", transition: "all 0.2s"
              }}
                onMouseOver={e => e.currentTarget.style.transform = "translateY(-3px)"}
                onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                <div style={{ fontSize: 32, marginBottom: 10 }}>{action.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>{action.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}