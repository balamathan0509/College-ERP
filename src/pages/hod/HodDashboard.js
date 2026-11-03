// src/pages/hod/HodDashboard.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, where, getDocs } from "../../supabase/supabaseAdapter";
import { useNavigate } from "react-router-dom";
import {
  DoorOpen,
  CreditCard,
  UserX,
  Award,
  MessageSquareWarning,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Calendar,
  Bell,
  Users,
  GraduationCap,
  TrendingUp,
  Layers,
  CheckSquare,
  BarChart2,
  FileText
} from "lucide-react";

import { getCalendarEventForDate, getUpcomingExamReminder } from "../../utils/academicCalendarUtils";

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export default function HodDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [todayEvent, setTodayEvent] = useState(null);
  const [upcomingReminder, setUpcomingReminder] = useState(null);
  const [stats, setStats] = useState({
    pendingGatePasses: 0,
    totalStudents: 0,
    openComplaints: 0,
    todayAbsent: 0,
    pendingFinesCount: 0,
    facultyCount: 0,
    activeCoursesCount: 0
  });
  const [yearSummary, setYearSummary] = useState(() => YEARS.reduce((acc, year) => {
    acc[year] = { students: 0, absent: 0, feesPending: 0 };
    return acc;
  }, {}));
  const [selectedYear, setSelectedYear] = useState(YEARS[0]);
  const [selectedYearData, setSelectedYearData] = useState({ students: 0, absent: 0, feesPending: 0 });
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [classLogs, setClassLogs] = useState([]);

  async function fetchStats() {
    try {
      const today = new Date().toISOString().split("T")[0];
      const deptName = userProfile?.dept || "CSE";

      // 1. Check Today's Academic Event & Upcoming Exam Reminder
      const calEv = await getCalendarEventForDate(deptName, today);
      setTodayEvent(calEv);

      const reminder = await getUpcomingExamReminder(deptName, 3);
      if (reminder) {
        const isDismissed = localStorage.getItem(`dismissed_exam_${reminder.id}_${today}`);
        if (!isDismissed) {
          setUpcomingReminder(reminder);
        }
      }

      // 2. Pending gate passes for HOD approval
      let pendingGatePasses = 0;
      try {
        const gpQ = query(
          collection(db, "gate_pass"),
          where("dept", "==", deptName),
          where("status", "==", "pending_hod")
        );
        const gpSnap = await getDocs(gpQ);
        pendingGatePasses = gpSnap.size;
      } catch (e) {
        console.warn("Gatepass fetch error:", e);
      }

      // 3. Total students and year breakdown
      let totalStudents = 0;
      const ySummary = YEARS.reduce((acc, year) => {
        acc[year] = { students: 0, absent: 0, feesPending: 0 };
        return acc;
      }, {});
      try {
        const studQ = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("dept", "==", deptName)
        );
        const studSnap = await getDocs(studQ);
        const fetchedStudents = studSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        totalStudents = fetchedStudents.length;
        setStudents(fetchedStudents);

        fetchedStudents.forEach(s => {
          if (ySummary[s.year]) ySummary[s.year].students += 1;
        });
      } catch (e) {
        console.warn("Students fetch error:", e);
      }

      // 4. Department Faculty count
      let facultyCount = 0;
      try {
        const facSnap = await getDocs(query(
          collection(db, "users"),
          where("dept", "==", deptName)
        ));
        facultyCount = facSnap.docs.filter(d => {
          const r = (d.data().role || "").toLowerCase();
          return r === "staff" || r === "faculty" || r === "dept_admin" || r === "teacher";
        }).length;
      } catch (e) {
        console.warn("Faculty fetch error:", e);
      }

      // 5. Today absent count
      let todayAbsent = 0;
      try {
        const attQ = query(
          collection(db, "attendance"),
          where("dept", "==", deptName),
          where("date", "==", today)
        );
        const attSnap = await getDocs(attQ);
        if (!attSnap.empty) {
          const records = attSnap.docs[0].data().records || {};
          todayAbsent = Object.values(records).filter(v => v === false).length;
        }
      } catch (e) {
        console.warn("Attendance fetch error:", e);
      }

      // 6. Fines pending verification
      let pendingFinesCount = 0;
      try {
        const finesSnap = await getDocs(collection(db, "fines"));
        pendingFinesCount = finesSnap.docs.filter(d => {
          const data = d.data();
          return (data.targetDept === deptName || data.targetDept === "all") && data.status === "pending_verification";
        }).length;
      } catch (e) {
        console.warn("Fines fetch error:", e);
      }

      // 7. Open complaints
      let openComplaints = 0;
      try {
        const compQ = query(
          collection(db, "complaints"),
          where("dept", "==", deptName),
          where("status", "==", "open")
        );
        const compSnap = await getDocs(compQ);
        openComplaints = compSnap.size;
      } catch (e) {
        console.warn("Complaints fetch error:", e);
      }

      // 8. Active department courses
      let activeCoursesCount = 0;
      try {
        const crsSnap = await getDocs(collection(db, "courses"));
        activeCoursesCount = crsSnap.docs.filter(d => {
          const data = d.data();
          const dept = (data.department || data.programme || "").toUpperCase();
          return dept.includes(deptName.toUpperCase()) || (deptName === "CSE" && dept.includes("COMPUTER"));
        }).length;
      } catch (e) {
        console.warn("Courses fetch error:", e);
      }

      // 9. Class completion logs for this department
      try {
        const logsQ = query(
          collection(db, "class_logs"),
          where("dept", "==", deptName)
        );
        const logsSnap = await getDocs(logsQ);
        const logs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        logs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        setClassLogs(logs.slice(0, 10));
      } catch (err) {
        console.warn("Class logs error:", err);
      }

      setStats({
        pendingGatePasses,
        totalStudents,
        openComplaints,
        todayAbsent,
        pendingFinesCount,
        facultyCount,
        activeCoursesCount
      });
      setYearSummary(ySummary);
    } catch (err) {
      console.warn("fetchStats error:", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (userProfile) {
      fetchStats();
    }
  }, [userProfile]);

  useEffect(() => {
    setSelectedYearData(yearSummary[selectedYear] || { students: 0, absent: 0, feesPending: 0 });
  }, [selectedYear, yearSummary]);

  const handleClearReminder = () => {
    const today = new Date().toISOString().split("T")[0];
    if (upcomingReminder?.id) {
      localStorage.setItem(`dismissed_exam_${upcomingReminder.id}_${today}`, "true");
    }
    setUpcomingReminder(null);
  };

  // Fixed 5-Boxes Layout matching Staff & Student Dashboards
  const statCards = [
    { 
      label: "Pending Gate Passes", 
      value: stats.pendingGatePasses, 
      icon: <DoorOpen size={14} color="#2563eb" />, 
      iconBg: "#eff6ff", 
      path: "/hod/gatepass", 
      hasAction: true 
    },
    { 
      label: "Today's Attendance", 
      value: stats.todayAbsent > 0 ? `${stats.todayAbsent} Absent` : "All Present", 
      icon: <CheckSquare size={14} color={stats.todayAbsent > 0 ? "#f59e0b" : "#16a34a"} />, 
      iconBg: stats.todayAbsent > 0 ? "#fffbeb" : "#f0fdf4", 
      path: "/hod/attendance",
      hasAction: true 
    },
    { 
      label: "Department Students", 
      value: stats.totalStudents, 
      icon: <Users size={14} color="#7c3aed" />, 
      iconBg: "#f5f3ff", 
      path: "/config/general/student",
      hasAction: true 
    },
    { 
      label: "Faculty Members", 
      value: stats.facultyCount || 0, 
      icon: <GraduationCap size={14} color="#0891b2" />, 
      iconBg: "#ecfeff", 
      path: "/config/general/faculty", 
      hasAction: true 
    },
    { 
      label: "Open Complaints", 
      value: stats.openComplaints, 
      icon: <MessageSquareWarning size={14} color="#ea580c" />, 
      iconBg: "#fff7ed", 
      path: "/hod/complaints", 
      hasAction: true 
    }
  ];

  const quickActions = [
    { 
      icon: <BarChart2 size={20} color="#2563eb" />, 
      label: "Result Analysis", 
      desc: "Full department performance",
      action: () => navigate("/cia/result-analysis"),
      tag: "CIA"
    },
    { 
      icon: <Calendar size={20} color="#3b82f6" />, 
      label: "Academic Calendar", 
      desc: "Events & schedules",
      action: () => navigate("/academics/academic-calendar") 
    },
    { 
      icon: <DoorOpen size={20} color="#6366f1" />, 
      label: "Gate Pass Approval", 
      desc: `${stats.pendingGatePasses} requests pending`,
      action: () => navigate("/hod/gatepass"), 
      badge: stats.pendingGatePasses 
    },
    { 
      icon: <BookOpen size={20} color="#059669" />, 
      label: "Course Allocation", 
      desc: "Assign staff to subjects",
      action: () => navigate("/academics/course-allocation") 
    },
    { 
      icon: <FileText size={20} color="#8b5cf6" />, 
      label: "QP Review", 
      desc: "Faculty exam papers",
      action: () => navigate("/hod/cia/question-papers") 
    },
    { 
      icon: <CreditCard size={20} color="#10b981" />, 
      label: "Fees Overview", 
      desc: "Department collections",
      action: () => navigate("/hod/fees") 
    },
    { 
      icon: <Users size={20} color="#d97706" />, 
      label: "Student Details", 
      desc: "Profiles & records",
      action: () => navigate("/config/general/student") 
    },
    { 
      icon: <AlertOctagon size={20} color="#ef4444" />, 
      label: "Verify Fines", 
      desc: `${stats.pendingFinesCount} pending review`,
      action: () => navigate("/hod/fines"), 
      badge: stats.pendingFinesCount 
    }
  ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <DateTimeHeader />

        {/* Header - Matching Faculty Dashboard style */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px 0", color: "#0f172a" }}>
              HOD DASHBOARD
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748b", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>{userProfile?.name || "Dr. Nathiya"}</span>
              <span>•</span>
              <span>Head of Department</span>
              <span>•</span>
              <span>{userProfile?.dept || "CSE"} Department</span>
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
                👑 HOD
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => navigate("/cia/result-analysis")}
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
              <BarChart2 size={16} /> Result Analysis
            </button>
            <button
              onClick={() => navigate("/academics/course-allocation")}
              style={{
                padding: "9px 16px",
                borderRadius: 8,
                background: "#f8fafc",
                color: "#334155",
                border: "1px solid #e2e8f0",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s ease"
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#f1f5f9")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#f8fafc")}
            >
              <BookOpen size={16} /> Course Allocation
            </button>
          </div>
        </div>

        {/* Upcoming Exam Alert */}
        {upcomingReminder && (
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
              <Bell size={16} color="#d97706" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                Upcoming Exam: {upcomingReminder.title} ({upcomingReminder.startDate}) — {upcomingReminder.daysRemaining} Day{upcomingReminder.daysRemaining > 1 ? "s" : ""} Away
              </span>
            </div>
            <button
              onClick={handleClearReminder}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                color: "#64748b",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Simple Calendar Banner - Identical to Faculty Dashboard */}
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
            <Calendar size={16} color="#2563eb" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
              {todayEvent
                ? `${todayEvent.title} — ${todayEvent.type.toUpperCase()}`
                : `Today: Regular Working Day — ${userProfile?.dept || "CSE"} Department`}
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

        {/* Alert for pending fines */}
        {!loading && stats.pendingFinesCount > 0 && (
          <div style={{ 
            padding: "10px 18px", borderRadius: 8, marginBottom: 14, 
            background: "#fff5f5", border: "1px solid #fed7d7", 
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <AlertTriangle size={16} color="#dc2626" />
              <div style={{ color: "#991b1b", fontWeight: 600, fontSize: 13 }}>
                {stats.pendingFinesCount} student fine payment{stats.pendingFinesCount > 1 ? "s" : ""} pending verification
              </div>
            </div>
            <button className="btn-primary" onClick={() => navigate("/hod/fines")} style={{ padding: "4px 14px", fontSize: 12, background: "#dc2626" }}>
              Verify Now <ArrowRight size={12} />
            </button>
          </div>
        )}

        {/* Stat Cards - Fixed 5-Boxes Layout matching Staff & Student */}
        <div className="dashboard-stats-grid">
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
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: card.iconBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  {card.icon}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>
                  {loading ? "—" : card.value}
                </span>
                {card.hasAction && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#2563eb", display: "inline-flex", alignItems: "center", gap: 2 }}>
                    View →
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Department Overview: Year-wise Distribution & Status */}
        <div className="card" style={{ marginTop: 14, marginBottom: 14, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                <Layers size={18} color="#2563eb" /> {userProfile?.dept || "CSE"} Department — Student Distribution
              </h3>
              <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
                Total {stats.totalStudents} enrolled students across 4 academic years
              </p>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {YEARS.map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    border: "1px solid",
                    borderColor: selectedYear === year ? "#2563eb" : "#e2e8f0",
                    background: selectedYear === year ? "#eff6ff" : "#ffffff",
                    color: selectedYear === year ? "#1d4ed8" : "#475569",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  {year} ({yearSummary[year]?.students || 0})
                </button>
              ))}
            </div>
          </div>

          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", 
            gap: 12, 
            padding: "12px", 
            background: "#f8fafc", 
            borderRadius: 8,
            border: "1px solid #f1f5f9"
          }}>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>Active in {selectedYear}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
                {selectedYearData.students} Students
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>Department Courses</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#2563eb", marginTop: 2 }}>
                {stats.activeCoursesCount} Mapped
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>Department Faculty</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#059669", marginTop: 2 }}>
                {stats.facultyCount} Members
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <button
                onClick={() => navigate("/config/general/student")}
                className="btn-primary"
                style={{ padding: "6px 14px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                View Roll Sheet <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions - Modern Grid matching Faculty Dashboard */}
        <div className="card" style={{ marginBottom: 14, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
              Quick Actions
            </h3>
            <TrendingUp size={16} color="#64748b" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {quickActions.map((action) => (
              <div 
                key={action.label} 
                onClick={action.action} 
                style={{
                  padding: "14px 16px", 
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  cursor: "pointer", 
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  position: "relative"
                }}
                onMouseOver={e => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.borderColor = "#cbd5e1";
                  e.currentTarget.style.boxShadow = "0 3px 8px rgba(0, 0, 0, 0.04)";
                }}
                onMouseOut={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {action.badge > 0 && (
                  <div style={{ 
                    position: "absolute", top: 8, right: 8, 
                    padding: "1px 6px", borderRadius: 10, 
                    background: "#ef4444", color: "white", 
                    fontSize: 10, fontWeight: 700 
                  }}>
                    {action.badge}
                  </div>
                )}
                {action.tag && (
                  <div style={{ 
                    position: "absolute", top: 8, right: 8, 
                    padding: "1px 6px", borderRadius: 4, 
                    background: "#e0e7ff", color: "#3730a3", 
                    fontSize: 9, fontWeight: 700 
                  }}>
                    {action.tag}
                  </div>
                )}
                <div style={{ 
                  width: 38, height: 38, borderRadius: 8, 
                  background: "#f8fafc", border: "1px solid #f1f5f9",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 
                }}>
                  {action.icon}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {action.label}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {action.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Forwarded Live Class Completion & Syllabus Reports */}
        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                <BookOpen size={18} color="#2563eb" /> Forwarded Class Completion & Syllabus Logs
              </h3>
              <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
                Real-time class logs submitted by staff for {userProfile?.dept || "CSE"} Department
              </p>
            </div>
            <span style={{ fontSize: 11, background: "#f1f5f9", padding: "3px 8px", borderRadius: 4, color: "#475569", fontWeight: 600 }}>
              Live Department Activity
            </span>
          </div>

          {classLogs.length === 0 ? (
            <div style={{ padding: "30px 20px", textAlign: "center", background: "#f8fafc", borderRadius: 8, color: "#64748b" }}>
              <Clock size={28} style={{ marginBottom: 6, opacity: 0.5 }} />
              <div style={{ fontSize: 13 }}>No class completion logs received yet today for {userProfile?.dept || "CSE"}.</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ padding: "10px 12px", textAlign: "left" }}>Date / Period</th>
                    <th style={{ padding: "10px 12px", textAlign: "left" }}>Class & Sec</th>
                    <th style={{ padding: "10px 12px", textAlign: "left" }}>Subject</th>
                    <th style={{ padding: "10px 12px", textAlign: "left" }}>Faculty</th>
                    <th style={{ padding: "10px 12px", textAlign: "left" }}>Topic Covered</th>
                    <th style={{ padding: "10px 12px", textAlign: "center" }}>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {classLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{log.date}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>Period {log.period} ({log.timeSlot || "N/A"})</div>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ padding: "2px 8px", background: "#eff6ff", color: "#1d4ed8", borderRadius: 4, fontWeight: 600, fontSize: 12 }}>
                          {log.year} {log.section}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{log.subjectName}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 500, color: "#0f172a" }}>{log.staffName}</div>
                        {log.staffDept && log.staffDept !== (userProfile?.dept || "CSE") && (
                          <span style={{ fontSize: 10, background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: 3, fontWeight: 600 }}>
                            {log.staffDept} Faculty
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#334155", maxWidth: 260 }}>{log.topicCovered || "—"}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <span style={{ 
                          padding: "3px 8px", 
                          borderRadius: 12, 
                          fontSize: 11, 
                          fontWeight: 700,
                          background: (log.attendancePercent || 0) >= 75 ? "#dcfce7" : "#fee2e2",
                          color: (log.attendancePercent || 0) >= 75 ? "#166534" : "#991b1b"
                        }}>
                          {log.attendancePercent !== undefined ? `${log.attendancePercent}%` : "Recorded"}
                        </span>
                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                          {log.presentCount || 0} / {log.totalStudents || 0} Present
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
