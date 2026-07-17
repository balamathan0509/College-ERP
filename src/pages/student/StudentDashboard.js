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
    newAlerts: 0,
    activeFines: 0,
    totalFineAmount: 0
  });
  const [loading, setLoading] = useState(true);
  const [upcomingFines, setUpcomingFines] = useState([]);

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

      // Fines
      const finesSnap = await getDocs(collection(db, "fines"));
      const allFines = finesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const myFines = allFines.filter(f => {
        if (f.studentUid) {
          return f.studentUid === currentUser.uid && f.status === "active";
        }
        const deptMatch = f.targetDept === "all" || f.targetDept === userProfile.dept;
        const yearMatch = f.targetYear === "all" || f.targetYear === userProfile.year;
        return deptMatch && yearMatch && f.status === "active";
      });
      const activeFines = myFines.length;
      const totalFineAmount = myFines.reduce((sum, f) => sum + (f.amount || 0), 0);

      // Check for approaching due dates (expired or expiring in <= 2 days)
      const approachingFines = myFines.filter(f => {
        if (!f.dueDate) return false;

        const today = new Date();
        today.setHours(0,0,0,0);
        const due = new Date(f.dueDate);
        due.setHours(0,0,0,0);

        const diffTime = due - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 2;
      });
      setUpcomingFines(approachingFines);

      setStats({ attendancePercent, totalDays, presentDays, gatePassCount, pendingFees, newAlerts, activeFines, totalFineAmount });
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
    { icon: "📝", label: "Complaints", path: "/student/complaints", color: "#fc8181" },
    { icon: "⚠️", label: "Fines", path: "/student/fines", color: "#e94560" }
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

        {/* Approaching/Expired Fines Alert banner */}
        {!loading && upcomingFines.length > 0 && (
          <div style={{ 
            padding: "16px 24px", borderRadius: 16, marginBottom: 28, 
            background: "rgba(233,69,96,0.12)", border: "1px solid rgba(233,69,96,0.3)", 
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
            boxShadow: "0 4px 15px rgba(233,69,96,0.1)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 28 }}>⏰</span>
              <div>
                <div style={{ color: "#e94560", fontWeight: 700, fontSize: 15, fontFamily: "Syne" }}>
                  Fine Due Date Warning!
                </div>
                <div style={{ color: "#a0aec0", fontSize: 13, marginTop: 4 }}>
                  You have {upcomingFines.length} fine(s) that are past due or expiring within 2 days. Pay today to avoid daily 10% late fees!
                </div>
              </div>
            </div>
            <button 
              onClick={() => navigate("/student/fines")} 
              style={{ 
                padding: "10px 22px", borderRadius: 10, border: "none", 
                background: "#e94560", color: "white", fontWeight: 700, 
                cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6,
                transition: "all 0.2s"
              }}
              onMouseOver={e => e.currentTarget.style.transform = "scale(1.03)"}
              onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
            >
              Pay Now 💳
            </button>
          </div>
        )}

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

          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/student/fines")}>
            <div className="stat-icon">⚠️</div>
            <div className="stat-value" style={{ color: stats.activeFines > 0 ? "#fc8181" : "#48bb78" }}>
              {loading ? "..." : stats.activeFines}
            </div>
            <div className="stat-label">Active Fines</div>
            {!loading && stats.activeFines > 0 && (
              <div style={{ fontSize: 11, color: "#fc8181", marginTop: 4 }}>₹{stats.totalFineAmount.toLocaleString("en-IN")}</div>
            )}
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