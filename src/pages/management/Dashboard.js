// src/pages/management/Dashboard.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIDS", "AIML"];

export default function ManagementDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalStaff: 0,
    totalHods: 0,
    pendingGatePasses: 0,
    openComplaints: 0,
    totalFeesPending: 0,
    lowAttendanceCount: 0,
    todayAbsent: 0
  });
  const [deptStats, setDeptStats] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchStats() {
    try {
      const today = new Date().toISOString().split("T")[0];

      // Total users
      const usersSnap = await getDocs(collection(db, "users"));
      const users = usersSnap.docs.map(d => d.data());
      const totalStudents = users.filter(u => u.role === "student").length;
      const totalStaff = users.filter(u => u.role === "staff").length;
      const totalHods = users.filter(u => u.role === "hod").length;

      // Pending gate passes (all depts)
      const gpSnap = await getDocs(query(collection(db, "gate_pass"), where("status", "in", ["pending_staff", "pending_hod"])));
      const pendingGatePasses = gpSnap.size;

      // Open complaints
      const compSnap = await getDocs(query(collection(db, "complaints"), where("status", "==", "open")));
      const openComplaints = compSnap.size;

      // Today absent (all depts)
      const attSnap = await getDocs(query(collection(db, "attendance"), where("date", "==", today)));
      let todayAbsent = 0;
      attSnap.docs.forEach(d => {
        const records = d.data().records || {};
        todayAbsent += Object.values(records).filter(v => v === false).length;
      });

      // Fees pending
      const feesSnap = await getDocs(collection(db, "fees"));
      let totalFeesPending = 0;
      feesSnap.docs.forEach(d => {
        const payments = d.data().payments || {};
        totalFeesPending += Object.values(payments).filter(v => !v).length;
      });

      // Low attendance
      const allAttSnap = await getDocs(collection(db, "attendance"));
      const allAtt = allAttSnap.docs.map(d => d.data());
      const students = users.filter(u => u.role === "student");
      let lowAttendanceCount = 0;
      students.forEach(s => {
        const total = allAtt.filter(r => r.records?.[s.uid] !== undefined).length;
        const present = allAtt.filter(r => r.records?.[s.uid] === true).length;
        if (total > 0 && Math.round((present / total) * 100) < 75) lowAttendanceCount++;
      });

      // Dept wise stats
      const deptData = DEPARTMENTS.map(dept => {
        const deptStudents = users.filter(u => u.role === "student" && u.dept === dept).length;
        const deptStaff = users.filter(u => u.role === "staff" && u.dept === dept).length;
        return { dept, students: deptStudents, staff: deptStaff };
      });

      setStats({ totalStudents, totalStaff, totalHods, pendingGatePasses, openComplaints, totalFeesPending, lowAttendanceCount, todayAbsent });
      setDeptStats(deptData);
    } catch (err) {}
    setLoading(false);
  }

  useEffect(() => { fetchStats(); }, []);

  const quickActions = [
    { icon: "👥", label: "All Users", path: "/management/users", color: "#4299e1" },
    { icon: "🚪", label: "Gate Passes", path: "/management/gatepass", color: "#e94560" },
    { icon: "📋", label: "Attendance", path: "/management/attendance", color: "#f5a623" },
    { icon: "💰", label: "Fees Overview", path: "/management/fees", color: "#48bb78" },
    { icon: "📢", label: "Post Alert", path: "/management/alerts", color: "#9f7aea" },
    { icon: "📝", label: "Complaints", path: "/management/complaints", color: "#fc8181" },
    { icon: "💼", label: "Placements", path: "/management/placements", color: "#f6ad55" },
    { icon: "👤", label: "Profile", path: "/management/profile", color: "#68d391" }
  ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <DateTimeHeader />
        <div className="page-header">
          <h1>👔 Management Dashboard</h1>
          <p>College-wide overview — Full Access</p>
        </div>

        {/* Overall Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div className="stat-icon">🎒</div>
            <div className="stat-value">{loading ? "..." : stats.totalStudents}</div>
            <div className="stat-label">Total Students</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👨‍🏫</div>
            <div className="stat-value">{loading ? "..." : stats.totalStaff}</div>
            <div className="stat-label">Total Staff</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏛️</div>
            <div className="stat-value">{loading ? "..." : stats.totalHods}</div>
            <div className="stat-label">HODs</div>
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/management/gatepass")}>
            <div className="stat-icon">🚪</div>
            <div className="stat-value" style={{ color: stats.pendingGatePasses > 0 ? "#fc8181" : "#48bb78" }}>
              {loading ? "..." : stats.pendingGatePasses}
            </div>
            <div className="stat-label">Pending Gate Passes</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">❌</div>
            <div className="stat-value" style={{ color: stats.todayAbsent > 0 ? "#f5a623" : "#48bb78" }}>
              {loading ? "..." : stats.todayAbsent}
            </div>
            <div className="stat-label">Absent Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⚠️</div>
            <div className="stat-value" style={{ color: stats.lowAttendanceCount > 0 ? "#fc8181" : "#48bb78" }}>
              {loading ? "..." : stats.lowAttendanceCount}
            </div>
            <div className="stat-label">Low Attendance</div>
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/management/fees")}>
            <div className="stat-icon">💰</div>
            <div className="stat-value" style={{ color: stats.totalFeesPending > 0 ? "#fc8181" : "#48bb78" }}>
              {loading ? "..." : stats.totalFeesPending}
            </div>
            <div className="stat-label">Fees Pending</div>
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/management/complaints")}>
            <div className="stat-icon">📝</div>
            <div className="stat-value" style={{ color: stats.openComplaints > 0 ? "#f5a623" : "#48bb78" }}>
              {loading ? "..." : stats.openComplaints}
            </div>
            <div className="stat-label">Open Complaints</div>
          </div>
        </div>

        {/* Dept wise table */}
        <div className="card" style={{ marginBottom: 28 }}>
          <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 20 }}>🏫 Department Overview</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  {["Department", "Students", "Staff"].map((h, i) => (
                    <th key={i} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deptStats.map(d => (
                  <tr key={d.dept} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 600, background: "rgba(66,153,225,0.15)", color: "#4299e1" }}>{d.dept}</span>
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: 600, fontSize: 15 }}>🎒 {d.students}</td>
                    <td style={{ padding: "14px 16px", fontWeight: 600, fontSize: 15 }}>👨‍🏫 {d.staff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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