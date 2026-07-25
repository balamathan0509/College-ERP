// src/pages/student/StudentDashboard.js
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
  CreditCard,
  Calendar,
  Briefcase,
  Bell,
  MessageSquareWarning,
  AlertOctagon,
  Clock,
  AlertTriangle,
  ArrowRight
} from "lucide-react";

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

      // Check for approaching due dates
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
    { icon: <DoorOpen size={24} color="#3b82f6" />, label: "Gate Pass", path: "/student/gatepass" },
    { icon: <CheckSquare size={24} color="#10b981" />, label: "Attendance", path: "/student/attendance" },
    { icon: <CreditCard size={24} color="#06b6d4" />, label: "Fees", path: "/student/fees" },
    { icon: <Calendar size={24} color="#6366f1" />, label: "Timetable", path: "/student/timetable" },
    { icon: <Briefcase size={24} color="#8b5cf6" />, label: "Placements", path: "/student/placements" },
    { icon: <Bell size={24} color="#f59e0b" />, label: "Alerts", path: "/student/alerts" },
    { icon: <MessageSquareWarning size={24} color="#ec4899" />, label: "Complaints", path: "/student/complaints" },
    { icon: <AlertOctagon size={24} color="#ef4444" />, label: "Fines", path: "/student/fines" }
  ];

  const attColor = stats.attendancePercent === null ? "var(--text-muted)" :
    stats.attendancePercent >= 75 ? "var(--success)" :
    stats.attendancePercent >= 60 ? "var(--warning)" : "var(--danger)";

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <DateTimeHeader />
        <div className="page-header">
          <h1>Welcome back, {userProfile?.name?.split(" ")[0]}</h1>
          <p>{userProfile?.dept} Department • Year {userProfile?.year} • Reg No: {userProfile?.registerNo}
            {userProfile?.studentType && (
              <span className="badge" style={{ marginLeft: 12, background: "rgba(37, 99, 235, 0.12)", color: "var(--highlight)", border: "1px solid rgba(37, 99, 235, 0.3)" }}>
                {userProfile.studentType === "hosteller" ? "Hosteller" : "Day Scholar"}
              </span>
            )}
          </p>
        </div>

        {/* Approaching/Expired Fines Alert banner */}
        {!loading && upcomingFines.length > 0 && (
          <div style={{ 
            padding: "16px 24px", borderRadius: "var(--radius-lg)", marginBottom: 28, 
            background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", 
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Clock size={24} color="var(--danger)" />
              <div>
                <div style={{ color: "var(--danger)", fontWeight: 700, fontSize: 15, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                  Fine Due Date Warning
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
                  You have {upcomingFines.length} fine(s) past due or expiring within 2 days. Pay today to avoid late charges.
                </div>
              </div>
            </div>
            <button 
              onClick={() => navigate("/student/fines")} 
              className="btn-primary"
              style={{ width: "auto", padding: "8px 18px", fontSize: 13, background: "var(--danger)" }}
            >
              Pay Now <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Live Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/student/attendance")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <CheckSquare size={24} color="var(--highlight)" />
              <span className="badge badge-success">Live</span>
            </div>
            <div className="stat-value" style={{ color: attColor }}>
              {loading ? "..." : stats.attendancePercent !== null ? `${stats.attendancePercent}%` : "N/A"}
            </div>
            <div className="stat-label">Attendance</div>
            {!loading && stats.totalDays > 0 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{stats.presentDays}/{stats.totalDays} Days Present</div>
            )}
          </div>

          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/student/gatepass")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <DoorOpen size={24} color="#3b82f6" />
            </div>
            <div className="stat-value">{loading ? "..." : stats.gatePassCount}</div>
            <div className="stat-label">Gate Passes</div>
          </div>

          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/student/fees")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <CreditCard size={24} color="#06b6d4" />
            </div>
            <div className="stat-value" style={{ color: stats.pendingFees > 0 ? "var(--danger)" : "var(--success)" }}>
              {loading ? "..." : stats.pendingFees}
            </div>
            <div className="stat-label">Pending Fees</div>
            {!loading && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{stats.pendingFees > 0 ? "Payment required" : "All cleared"}</div>}
          </div>

          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/student/alerts")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Bell size={24} color="#f59e0b" />
            </div>
            <div className="stat-value">{loading ? "..." : stats.newAlerts}</div>
            <div className="stat-label">Notifications</div>
          </div>

          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/student/fines")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <AlertOctagon size={24} color="#ef4444" />
            </div>
            <div className="stat-value" style={{ color: stats.activeFines > 0 ? "var(--danger)" : "var(--success)" }}>
              {loading ? "..." : stats.activeFines}
            </div>
            <div className="stat-label">Active Fines</div>
            {!loading && stats.activeFines > 0 && (
              <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>₹{stats.totalFineAmount.toLocaleString("en-IN")}</div>
            )}
          </div>
        </div>

        {/* Low attendance warning */}
        {!loading && stats.attendancePercent !== null && stats.attendancePercent < 75 && (
          <div style={{ padding: "14px 20px", borderRadius: "var(--radius-md)", marginBottom: 24, background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", display: "flex", alignItems: "center", gap: 12 }}>
            <AlertTriangle size={20} color="var(--danger)" />
            <div>
              <div style={{ color: "var(--danger)", fontWeight: 700, fontFamily: "Plus Jakarta Sans, sans-serif" }}>Low Attendance Warning</div>
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Your attendance is {stats.attendancePercent}% — below the required 75% threshold. Please ensure regular attendance.</div>
            </div>
          </div>
        )}

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