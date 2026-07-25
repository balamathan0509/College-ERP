// src/pages/management/Dashboard.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserCheck,
  Award,
  DoorOpen,
  UserX,
  AlertTriangle,
  CreditCard,
  MessageSquareWarning,
  CheckSquare,
  Bell,
  Briefcase,
  User,
  Building2
} from "lucide-react";

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
    { icon: <Users size={24} color="#3b82f6" />, label: "All Users", path: "/management/users" },
    { icon: <DoorOpen size={24} color="#ef4444" />, label: "Gate Passes", path: "/management/gatepass" },
    { icon: <CheckSquare size={24} color="#10b981" />, label: "Attendance", path: "/management/attendance" },
    { icon: <CreditCard size={24} color="#06b6d4" />, label: "Fees Overview", path: "/management/fees" },
    { icon: <Bell size={24} color="#f59e0b" />, label: "Post Alert", path: "/management/alerts" },
    { icon: <MessageSquareWarning size={24} color="#ec4899" />, label: "Complaints", path: "/management/complaints" },
    { icon: <Briefcase size={24} color="#8b5cf6" />, label: "Placements", path: "/management/placements" },
    { icon: <User size={24} color="#6366f1" />, label: "Profile", path: "/management/profile" }
  ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <DateTimeHeader />
        <div className="page-header">
          <h1>Management Portal</h1>
          <p>Institutional Executive Overview & Decision Analytics</p>
        </div>

        {/* Overall Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Users size={24} color="#3b82f6" />
            </div>
            <div className="stat-value">{loading ? "..." : stats.totalStudents}</div>
            <div className="stat-label">Total Students</div>
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <UserCheck size={24} color="#10b981" />
            </div>
            <div className="stat-value">{loading ? "..." : stats.totalStaff}</div>
            <div className="stat-label">Faculty Staff</div>
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Award size={24} color="#8b5cf6" />
            </div>
            <div className="stat-value">{loading ? "..." : stats.totalHods}</div>
            <div className="stat-label">HODs</div>
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/management/gatepass")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <DoorOpen size={24} color="#ef4444" />
            </div>
            <div className="stat-value" style={{ color: stats.pendingGatePasses > 0 ? "var(--danger)" : "var(--success)" }}>
              {loading ? "..." : stats.pendingGatePasses}
            </div>
            <div className="stat-label">Pending Gate Passes</div>
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <UserX size={24} color="#f59e0b" />
            </div>
            <div className="stat-value" style={{ color: stats.todayAbsent > 0 ? "var(--warning)" : "var(--success)" }}>
              {loading ? "..." : stats.todayAbsent}
            </div>
            <div className="stat-label">Absent Today</div>
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <AlertTriangle size={24} color="#ef4444" />
            </div>
            <div className="stat-value" style={{ color: stats.lowAttendanceCount > 0 ? "var(--danger)" : "var(--success)" }}>
              {loading ? "..." : stats.lowAttendanceCount}
            </div>
            <div className="stat-label">Low Attendance</div>
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/management/fees")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <CreditCard size={24} color="#06b6d4" />
            </div>
            <div className="stat-value" style={{ color: stats.totalFeesPending > 0 ? "var(--danger)" : "var(--success)" }}>
              {loading ? "..." : stats.totalFeesPending}
            </div>
            <div className="stat-label">Fees Pending</div>
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/management/complaints")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <MessageSquareWarning size={24} color="#ec4899" />
            </div>
            <div className="stat-value" style={{ color: stats.openComplaints > 0 ? "var(--warning)" : "var(--success)" }}>
              {loading ? "..." : stats.openComplaints}
            </div>
            <div className="stat-label">Open Complaints</div>
          </div>
        </div>

        {/* Dept wise table */}
        <div className="card" style={{ marginBottom: 28 }}>
          <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Departmental Overview</h3>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  {["Department", "Students", "Faculty"].map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deptStats.map(d => (
                  <tr key={d.dept}>
                    <td>
                      <span className="badge" style={{ background: "rgba(37, 99, 235, 0.12)", color: "var(--highlight)", border: "1px solid rgba(37, 99, 235, 0.3)" }}>{d.dept}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{d.students} Students</td>
                    <td style={{ fontWeight: 600 }}>{d.staff} Faculty</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h3 style={{ marginBottom: 20, fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>Quick Actions</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 16 }}>
            {quickActions.map((action) => (
              <div 
                key={action.path} 
                onClick={() => navigate(action.path)} 
                style={{
                  padding: "20px 14px", 
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  background: "rgba(11, 19, 43, 0.4)",
                  cursor: "pointer", 
                  textAlign: "center", 
                  transition: "all 0.2s ease"
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