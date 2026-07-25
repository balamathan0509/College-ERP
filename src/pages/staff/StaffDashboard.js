// src/pages/staff/StaffDashboard.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  DoorOpen,
  CheckSquare,
  Award,
  Calendar,
  Briefcase,
  Bell,
  MessageSquareWarning,
  AlertOctagon,
  Users,
  AlertTriangle,
  ArrowRight
} from "lucide-react";

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
    { icon: <DoorOpen size={24} color="#3b82f6" />, label: "Gate Pass Approvals", path: "/staff/gatepass" },
    { icon: <CheckSquare size={24} color="#10b981" />, label: "Mark Attendance", path: "/staff/attendance" },
    { icon: <Award size={24} color="#6366f1" />, label: "Update Results", path: "/staff/results" },
    { icon: <Calendar size={24} color="#06b6d4" />, label: "Post Timetable", path: "/staff/timetable" },
    { icon: <Briefcase size={24} color="#8b5cf6" />, label: "Post Job Alert", path: "/staff/placements" },
    { icon: <Bell size={24} color="#f59e0b" />, label: "Send Alert", path: "/staff/alerts" },
    { icon: <MessageSquareWarning size={24} color="#ec4899" />, label: "View Complaints", path: "/staff/complaints" },
    { icon: <AlertOctagon size={24} color="#ef4444" />, label: "Impose Fine", path: "/staff/fines" }
  ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <DateTimeHeader />
        <div className="page-header">
          <h1>Faculty Dashboard</h1>
          <p>{userProfile?.dept} Department</p>
        </div>

        {/* Live Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/staff/gatepass")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <DoorOpen size={24} color="#3b82f6" />
            </div>
            <div className="stat-value" style={{ color: stats.pendingGatePasses > 0 ? "var(--danger)" : "var(--success)" }}>
              {loading ? "..." : stats.pendingGatePasses}
            </div>
            <div className="stat-label">Pending Gate Passes</div>
          </div>

          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/staff/attendance")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <CheckSquare size={24} color="#10b981" />
            </div>
            <div className="stat-value" style={{ color: stats.todayAttendanceMarked ? "var(--success)" : "var(--danger)" }}>
              {loading ? "..." : stats.todayAttendanceMarked ? "Done" : "Pending"}
            </div>
            <div className="stat-label">Today's Attendance</div>
          </div>

          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/staff/complaints")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <MessageSquareWarning size={24} color="#ec4899" />
            </div>
            <div className="stat-value" style={{ color: stats.openComplaints > 0 ? "var(--warning)" : "var(--success)" }}>
              {loading ? "..." : stats.openComplaints}
            </div>
            <div className="stat-label">Open Complaints</div>
          </div>

          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Users size={24} color="#8b5cf6" />
            </div>
            <div className="stat-value">{loading ? "..." : stats.totalStudents}</div>
            <div className="stat-label">Total Students</div>
          </div>
        </div>

        {/* Attendance reminder */}
        {!loading && !stats.todayAttendanceMarked && (
          <div style={{ padding: "14px 20px", borderRadius: "var(--radius-md)", marginBottom: 24, background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <AlertTriangle size={20} color="var(--warning)" />
              <div style={{ color: "var(--warning)", fontWeight: 600 }}>Today's attendance not marked yet!</div>
            </div>
            <button className="btn-primary" onClick={() => navigate("/staff/attendance")} style={{ width: "auto", padding: "6px 16px", fontSize: 13 }}>
              Mark Now <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Student Directory */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 20, fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>Student Directory - {userProfile?.dept} Department</h3>
          {YEARS.map(year => {
            const yearStudents = students.filter(s => s.year === year);
            if (yearStudents.length === 0) return null;
            return (
              <div key={year} style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>{year} ({yearStudents.length} Students)</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {yearStudents.map(student => (
                    <div key={student.id} style={{
                      padding: 14,
                      borderRadius: "var(--radius-md)",
                      background: "rgba(11, 19, 43, 0.4)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>{student.name}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{student.email}</div>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{student.year} • {student.registerNo || "N/A"}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {students.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>
              No students found in this department.
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h3 style={{ marginBottom: 20, fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>Quick Actions</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 16 }}>
            {quickActions.map((action) => (
              <div key={action.path} onClick={() => navigate(action.path)} style={{
                padding: "20px 14px", 
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                background: "rgba(11, 19, 43, 0.4)",
                cursor: "pointer", 
                textAlign: "center", 
                transition: "all 0.2s ease",
                position: "relative"
              }}
                onMouseOver={e => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.borderColor = "rgba(37, 99, 235, 0.4)";
                  e.currentTarget.style.background = "rgba(37, 99, 235, 0.08)";
                }}
                onMouseOut={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.background = "rgba(11, 19, 43, 0.4)";
                }}
              >
                {action.label === "Gate Pass Approvals" && stats.pendingGatePasses > 0 && (
                  <div style={{
                    position: "absolute", top: -6, right: -6,
                    width: 20, height: 20, borderRadius: "50%",
                    background: "var(--danger)", color: "white",
                    fontSize: 11, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>{stats.pendingGatePasses}</div>
                )}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>{action.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{action.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}