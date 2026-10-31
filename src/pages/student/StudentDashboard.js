// src/pages/student/StudentDashboard.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, where, getDocs } from "../../supabase/supabaseAdapter";
import { useNavigate } from "react-router-dom";
import {
  DoorOpen, CheckSquare, CreditCard, Calendar,
  Briefcase, Bell, MessageSquareWarning, AlertOctagon,
  Clock, AlertTriangle, ArrowRight, BookOpen, HelpCircle,
  TrendingUp, ChevronRight
} from "lucide-react";
import { getCalendarEventForDate } from "../../utils/academicCalendarUtils";

export default function StudentDashboard() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [todayEvent, setTodayEvent] = useState(null);
  const [stats, setStats] = useState({
    attendancePercent: null, totalDays: 0, presentDays: 0,
    gatePassCount: 0, pendingFees: 0, newAlerts: 0, activeFines: 0, totalFineAmount: 0
  });
  const [loading, setLoading] = useState(true);
  const [upcomingFines, setUpcomingFines] = useState([]);

  async function fetchStats() {
    try {
      const today = new Date().toISOString().split("T")[0];
      if (userProfile?.dept) {
        const calEv = await getCalendarEventForDate(userProfile.dept, today, userProfile.year);
        setTodayEvent(calEv);
      }
      const attQ = query(collection(db, "attendance"), where("dept", "==", userProfile.dept), where("year", "==", userProfile.year));
      const attSnap = await getDocs(attQ);
      const attRecords = attSnap.docs.map(d => d.data());
      const totalDays = attRecords.filter(r => r.records?.[currentUser.uid] !== undefined).length;
      const presentDays = attRecords.filter(r => r.records?.[currentUser.uid] === true).length;
      const attendancePercent = totalDays ? Math.round((presentDays / totalDays) * 100) : null;

      const gpSnap = await getDocs(query(collection(db, "gate_pass"), where("studentId", "==", currentUser.uid)));
      const gatePassCount = gpSnap.size;

      const feesSnap = await getDocs(query(collection(db, "fees"), where("dept", "==", userProfile.dept), where("year", "==", userProfile.year)));
      const pendingFees = feesSnap.docs.filter(d => !d.data().payments?.[currentUser.uid]).length;

      const alertSnap = await getDocs(query(collection(db, "alerts"), where("dept", "in", [userProfile.dept, "all"])));
      const newAlerts = alertSnap.size;

      const finesSnap = await getDocs(collection(db, "fines"));
      const myFines = finesSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(f => {
        if (f.studentUid) return f.studentUid === currentUser.uid && f.status === "active";
        return (f.targetDept === "all" || f.targetDept === userProfile.dept) &&
               (f.targetYear === "all" || f.targetYear === userProfile.year) && f.status === "active";
      });
      const activeFines = myFines.length;
      const totalFineAmount = myFines.reduce((sum, f) => sum + (f.amount || 0), 0);
      setUpcomingFines(myFines.filter(f => {
        if (!f.dueDate) return false;
        const now = new Date(); now.setHours(0,0,0,0);
        const due = new Date(f.dueDate); due.setHours(0,0,0,0);
        return Math.ceil((due - now) / 86400000) <= 2;
      }));
      setStats({ attendancePercent, totalDays, presentDays, gatePassCount, pendingFees, newAlerts, activeFines, totalFineAmount });
    } catch (err) {}
    setLoading(false);
  }

  useEffect(() => { if (userProfile) fetchStats(); }, [userProfile]);

  const attColor = stats.attendancePercent === null ? "#64748b"
    : stats.attendancePercent >= 75 ? "#10b981"
    : stats.attendancePercent >= 60 ? "#f59e0b" : "#ef4444";

  const statCards = [
    {
      label: "Attendance",
      value: loading ? "—" : stats.attendancePercent !== null ? `${stats.attendancePercent}%` : "N/A",
      sub: !loading && stats.totalDays > 0 ? `${stats.presentDays}/${stats.totalDays} days` : "No records yet",
      icon: <CheckSquare size={15} color="#10b981" strokeWidth={2.2}/>,
      iconBg: "#ecfdf5", badge: "Live", valueColor: attColor, path: "/student/attendance"
    },
    {
      label: "Gate Passes",
      value: loading ? "—" : stats.gatePassCount,
      sub: "Total requests",
      icon: <DoorOpen size={15} color="#2563eb" strokeWidth={2.2}/>,
      iconBg: "#eff6ff", valueColor: "#2563eb", path: "/student/gatepass"
    },
    {
      label: "Pending Fees",
      value: loading ? "—" : stats.pendingFees,
      sub: stats.pendingFees > 0 ? "Payment required" : "All cleared ✓",
      icon: <CreditCard size={15} color={stats.pendingFees > 0 ? "#ef4444" : "#10b981"} strokeWidth={2.2}/>,
      iconBg: stats.pendingFees > 0 ? "#fee2e2" : "#ecfdf5",
      valueColor: stats.pendingFees > 0 ? "#ef4444" : "#10b981", path: "/student/fees"
    },
    {
      label: "Notifications",
      value: loading ? "—" : stats.newAlerts,
      sub: "Unread alerts",
      icon: <Bell size={15} color="#f59e0b" strokeWidth={2.2}/>,
      iconBg: "#fef3c7", valueColor: "#f59e0b", path: "/student/alerts"
    },
    {
      label: "Active Fines",
      value: loading ? "—" : stats.activeFines,
      sub: !loading && stats.activeFines > 0 ? `Rs.${stats.totalFineAmount.toLocaleString("en-IN")} due` : "No fines",
      icon: <AlertOctagon size={15} color={stats.activeFines > 0 ? "#ef4444" : "#10b981"} strokeWidth={2.2}/>,
      iconBg: stats.activeFines > 0 ? "#fee2e2" : "#ecfdf5",
      valueColor: stats.activeFines > 0 ? "#ef4444" : "#10b981", path: "/student/fines"
    }
  ];

  const quickActions = [
    { icon:<DoorOpen size={26} color="#3b82f6"/>, label:"Gate Pass", path:"/student/gatepass", bg:"rgba(59,130,246,0.1)", color:"#3b82f6" },
    { icon:<CheckSquare size={26} color="#10b981"/>, label:"Attendance", path:"/student/attendance", bg:"rgba(16,185,129,0.1)", color:"#10b981" },
    { icon:<CreditCard size={26} color="#06b6d4"/>, label:"Fees", path:"/student/fees", bg:"rgba(6,182,212,0.1)", color:"#06b6d4" },
    { icon:<Calendar size={26} color="#6366f1"/>, label:"Timetable", path:"/student/timetable", bg:"rgba(99,102,241,0.1)", color:"#6366f1" },
    { icon:<Briefcase size={26} color="#8b5cf6"/>, label:"Placements", path:"/student/placements", bg:"rgba(139,92,246,0.1)", color:"#8b5cf6" },
    { icon:<Bell size={26} color="#f59e0b"/>, label:"Alerts", path:"/student/alerts", bg:"rgba(245,158,11,0.1)", color:"#f59e0b" },
    { icon:<MessageSquareWarning size={26} color="#ec4899"/>, label:"Complaints", path:"/student/complaints", bg:"rgba(236,72,153,0.1)", color:"#ec4899" },
    { icon:<AlertOctagon size={26} color="#ef4444"/>, label:"Fines", path:"/student/fines", bg:"rgba(239,68,68,0.1)", color:"#ef4444" },
    { icon:<BookOpen size={26} color="#0891b2"/>, label:"Question Papers", path:"/student/question-papers", bg:"rgba(8,145,178,0.1)", color:"#0891b2" },
    { icon:<HelpCircle size={26} color="#64748b"/>, label:"Help Center", path:"/student/help", bg:"rgba(100,116,139,0.1)", color:"#64748b" },
  ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content" style={{ background: "#f3f4f8" }}>
        <DateTimeHeader />

        {/* Student Profile Card — clean white, same style as StaffDashboard */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            padding: "18px 24px",
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)"
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: "700",
                color: "#0f172a",
                fontFamily: "Plus Jakarta Sans, sans-serif",
                letterSpacing: "-0.01em"
              }}
            >
              STUDENT DASHBOARD
            </h1>
            <div
              style={{
                margin: "6px 0 0 0",
                color: "#64748b",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap"
              }}
            >
              <strong style={{ color: "#0f172a" }}>{userProfile?.name || "Student"}</strong>
              <span style={{ color: "#cbd5e1" }}>•</span>
              <span>{userProfile?.dept} Department</span>
              <span style={{ color: "#cbd5e1" }}>•</span>
              <span>{userProfile?.year}</span>
              {userProfile?.registerNo && (
                <>
                  <span style={{ color: "#cbd5e1" }}>•</span>
                  <span>Reg No: <strong style={{ color: "#334155" }}>{userProfile.registerNo}</strong></span>
                </>
              )}
              {userProfile?.studentType && (
                <span
                  style={{
                    padding: "2px 8px",
                    background: "#fef3c7",
                    border: "1px solid #fde68a",
                    color: "#92400e",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  {userProfile.studentType === "hosteller" ? "🏠 Hosteller" : "🚌 Day Scholar"}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate("/student/attendance")}
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              background: "#2563eb",
              color: "#ffffff",
              border: "none",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
              transition: "background 0.15s ease"
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#1d4ed8")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#2563eb")}
          >
            <CheckSquare size={16} /> My Attendance
          </button>
        </div>

        {/* Fine Due Warning */}
        {!loading && upcomingFines.length > 0 && (
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #fed7aa",
              padding: "10px 18px",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Clock size={16} color="#d97706" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>
                ⚠️ {upcomingFines.length} fine(s) due within 2 days — Pay to avoid penalty
              </span>
            </div>
            <button
              onClick={() => navigate("/student/fines")}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                background: "#f59e0b",
                color: "#ffffff",
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4
              }}
            >
              Pay Now <ArrowRight size={12} />
            </button>
          </div>
        )}

        {/* Low Attendance Warning */}
        {!loading && stats.attendancePercent !== null && stats.attendancePercent < 75 && (
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #fed7aa",
              padding: "10px 18px",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <AlertTriangle size={16} color="#d97706" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>
                ⚠️ Low Attendance — {stats.attendancePercent}% (below 75% threshold)
              </span>
            </div>
            <button
              onClick={() => navigate("/student/attendance")}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                color: "#64748b",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              View Details
            </button>
          </div>
        )}

        {/* Calendar Banner — same style as StaffDashboard */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            padding: "10px 18px",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Calendar size={16} color={todayEvent?.type === "holiday" ? "#ef4444" : "#2563eb"} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
              {todayEvent
                ? `${todayEvent.title} — ${todayEvent.type.toUpperCase()}`
                : `Today: Regular Working Day — ${userProfile?.dept || ""} Department`}
            </span>
            {todayEvent?.type === "holiday" && (
              <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 500 }}>(Holiday)</span>
            )}
          </div>
          <button
            onClick={() => navigate("/academics/academic-calendar")}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              color: "#334155",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer"
            }}
          >
            View Calendar
          </button>
        </div>

        {/* Stat Cards — compact white bordered, same style as StaffDashboard */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
          {statCards.map((card, i) => (
            <div
              key={i}
              onClick={() => card.path && navigate(card.path)}
              style={{
                background: "#ffffff",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: 74,
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
                transition: "all 0.15s ease",
                cursor: card.path ? "pointer" : "default"
              }}
              onMouseEnter={e => {
                if (card.path) {
                  e.currentTarget.style.borderColor = "#cbd5e1";
                  e.currentTarget.style.boxShadow = "0 3px 8px rgba(0, 0, 0, 0.05)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={e => {
                if (card.path) {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.03)";
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {card.label}
                </span>
                <div style={{
                  width: 26, height: 26, borderRadius: 6,
                  background: card.iconBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0
                }}>
                  {card.icon}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <div>
                  <span style={{ fontSize: 18, fontWeight: 700, color: card.valueColor || "#0f172a", lineHeight: 1 }}>
                    {card.value}
                  </span>
                  {card.badge && (
                    <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 20, background: "rgba(16,185,129,0.1)", color: "#10b981", verticalAlign: "middle" }}>
                      {card.badge}
                    </span>
                  )}
                  {card.sub && (
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{card.sub}</div>
                  )}
                </div>
                {card.path && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#2563eb", display: "inline-flex", alignItems: "center", gap: 2 }}>
                    View <ArrowRight size={10} />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "24px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: 0 }}>Quick Actions</h3>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "3px 0 0 0" }}>Navigate to any section quickly</p>
            </div>
            <TrendingUp size={17} color="#1d4ed8"/>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(105px,1fr))", gap: 12 }}>
            {quickActions.map((action, idx) => (
              <div key={idx} onClick={() => navigate(action.path)}
                style={{ padding: "16px 8px", borderRadius: 14, border: "1.5px solid transparent", background: "#f8fafc", cursor: "pointer", textAlign: "center", transition: "all 0.2s ease", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
                onMouseEnter={e => { e.currentTarget.style.background = action.bg; e.currentTarget.style.borderColor = action.color + "40"; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 8px 20px ${action.color}25`; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: action.bg, border: `1.5px solid ${action.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>{action.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", lineHeight: 1.3 }}>{action.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
