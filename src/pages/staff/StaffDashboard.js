// src/pages/staff/StaffDashboard.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export default function StaffDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    pendingGatePasses: 0,
    todayAttendanceMarked: false,
    openComplaints: 0,
    totalStudents: 0
  });
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);

  async function fetchStats() {
    try {
      const today = new Date().toISOString().split("T")[0];

      // Pending gate passes for this dept
      const gpQ = query(
        collection(db, "gate_pass"),
        where("dept", "==", userProfile.dept),
        where("status", "==", "pending_staff")
      );
      const gpSnap = await getDocs(gpQ);
      const pendingGatePasses = gpSnap.size;

      // Today attendance marked?
      const attQ = query(
        collection(db, "attendance"),
        where("dept", "==", userProfile.dept),
        where("date", "==", today)
      );
      const attSnap = await getDocs(attQ);
      const todayAttendanceMarked = !attSnap.empty;

      // Total students in dept
      const studQ = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", userProfile.dept)
      );
      const studSnap = await getDocs(studQ);
      const students = studSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const totalStudents = students.length;
      setStudents(students);

      // Open complaints
      const compQ = query(
        collection(db, "complaints"),
        where("dept", "==", userProfile.dept),
        where("status", "==", "open")
      );
      const compSnap = await getDocs(compQ);
      const openComplaints = compSnap.size;

      setStats({ pendingGatePasses, todayAttendanceMarked, openComplaints, totalStudents });
    } catch (err) {}
    setLoading(false);
  }

  useEffect(() => { if (userProfile) fetchStats(); }, [userProfile]);

  const quickActions = [
    { icon: "🚪", label: "Gate Pass Approvals", path: "/staff/gatepass", color: "#e94560" },
    { icon: "✅", label: "Mark Attendance", path: "/staff/attendance", color: "#f5a623" },
    { icon: "🧾", label: "Update Results", path: "/staff/results", color: "#7f9cf5" },
    { icon: "📅", label: "Post Timetable", path: "/staff/timetable", color: "#4299e1" },
    { icon: "💼", label: "Post Job Alert", path: "/staff/placements", color: "#9f7aea" },
    { icon: "📢", label: "Send Alert", path: "/staff/alerts", color: "#f6ad55" },
    { icon: "📝", label: "View Complaints", path: "/staff/complaints", color: "#fc8181" }
  ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Staff Dashboard 👨‍🏫</h1>
          <p>{userProfile?.dept} Department</p>
        </div>

        {/* Live Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/staff/gatepass")}>
            <div className="stat-icon">🚪</div>
            <div className="stat-value" style={{ color: stats.pendingGatePasses > 0 ? "#fc8181" : "#48bb78" }}>
              {loading ? "..." : stats.pendingGatePasses}
            </div>
            <div className="stat-label">Pending Gate Passes</div>
            {!loading && stats.pendingGatePasses > 0 && <div style={{ fontSize: 11, color: "#fc8181", marginTop: 4 }}>Action needed!</div>}
          </div>

          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/staff/attendance")}>
            <div className="stat-icon">📋</div>
            <div className="stat-value" style={{ color: stats.todayAttendanceMarked ? "#48bb78" : "#fc8181" }}>
              {loading ? "..." : stats.todayAttendanceMarked ? "Done" : "Pending"}
            </div>
            <div className="stat-label">Today's Attendance</div>
            {!loading && <div style={{ fontSize: 11, color: stats.todayAttendanceMarked ? "#48bb78" : "#fc8181", marginTop: 4 }}>
              {stats.todayAttendanceMarked ? "Marked ✅" : "Not marked yet!"}
            </div>}
          </div>

          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/staff/complaints")}>
            <div className="stat-icon">📝</div>
            <div className="stat-value" style={{ color: stats.openComplaints > 0 ? "#f5a623" : "#48bb78" }}>
              {loading ? "..." : stats.openComplaints}
            </div>
            <div className="stat-label">Open Complaints</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{loading ? "..." : stats.totalStudents}</div>
            <div className="stat-label">Total Students</div>
          </div>
        </div>

        {/* Attendance reminder */}
        {!loading && !stats.todayAttendanceMarked && (
          <div style={{ padding: "14px 20px", borderRadius: 12, marginBottom: 24, background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div style={{ color: "#f5a623", fontWeight: 600 }}>Today's attendance not marked yet!</div>
            </div>
            <button onClick={() => navigate("/staff/attendance")} style={{
              padding: "8px 20px", borderRadius: 8, border: "none",
              background: "#f5a623", color: "white", fontWeight: 600, cursor: "pointer"
            }}>Mark Now →</button>
          </div>
        )}

        {/* Student Directory */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 20, fontFamily: "Syne", fontSize: 18 }}>Student Directory - {userProfile?.dept} Department</h3>
          {YEARS.map(year => {
            const yearStudents = students.filter(s => s.year === year);
            if (yearStudents.length === 0) return null;
            return (
              <div key={year} style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 16, color: "#a0aec0", marginBottom: 12 }}>{year} ({yearStudents.length} students)</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {yearStudents.map(student => (
                    <div key={student.id} style={{
                      padding: 14,
                      borderRadius: 12,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "white" }}>{student.name}</div>
                        <div style={{ fontSize: 13, color: "#a0aec0" }}>{student.email}</div>
                      </div>
                      <div style={{ fontSize: 12, color: "#a0aec0", whiteSpace: "nowrap" }}>{student.year} • {student.registerNo || "N/A"}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {students.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: 30, color: "#a0aec0" }}>
              No students found in this department.
            </div>
          )}
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
                cursor: "pointer", textAlign: "center", transition: "all 0.2s",
                position: "relative"
              }}
                onMouseOver={e => e.currentTarget.style.transform = "translateY(-3px)"}
                onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                {action.label === "Gate Pass Approvals" && stats.pendingGatePasses > 0 && (
                  <div style={{
                    position: "absolute", top: -6, right: -6,
                    width: 20, height: 20, borderRadius: "50%",
                    background: "#fc8181", color: "white",
                    fontSize: 11, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>{stats.pendingGatePasses}</div>
                )}
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