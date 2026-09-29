// src/pages/hod/HodDashboard.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, where, getDocs, limit, orderBy } from "../../supabase/supabaseAdapter";
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
  Clock
} from "lucide-react";

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export default function HodDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    pendingGatePasses: 0,
    totalStudents: 0,
    lowAttendanceCount: 0,
    pendingFeesCount: 0,
    openComplaints: 0,
    todayAbsent: 0,
    pendingFinesCount: 0
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

      // Pending gate passes for HOD approval
      const gpQ = query(
        collection(db, "gate_pass"),
        where("dept", "==", userProfile.dept),
        where("status", "==", "pending_hod")
      );
      const gpSnap = await getDocs(gpQ);
      const pendingGatePasses = gpSnap.size;

      // Total students and year breakdown
      const studQ = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", userProfile.dept)
      );
      const studSnap = await getDocs(studQ);
      const students = studSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const totalStudents = students.length;
      setStudents(students);

      const yearSummary = YEARS.reduce((acc, year) => {
        acc[year] = { students: 0, absent: 0, feesPending: 0 };
        return acc;
      }, {});
      students.forEach(s => {
        if (yearSummary[s.year]) yearSummary[s.year].students += 1;
      });

      // Today absent count
      const attQ = query(
        collection(db, "attendance"),
        where("dept", "==", userProfile.dept),
        where("date", "==", today)
      );
      const attSnap = await getDocs(attQ);
      let todayAbsent = 0;
      if (!attSnap.empty) {
        const records = attSnap.docs[0].data().records || {};
        todayAbsent = Object.values(records).filter(v => v === false).length;
      }

      // Fines pending verification
      const finesSnap = await getDocs(collection(db, "fines"));
      const pendingFines = finesSnap.docs.filter(d => {
        const data = d.data();
        return (data.targetDept === userProfile.dept || data.targetDept === "all") && data.status === "pending_verification";
      });

      // Open complaints
      const compQ = query(
        collection(db, "complaints"),
        where("dept", "==", userProfile.dept),
        where("status", "==", "open")
      );
      const compSnap = await getDocs(compQ);
      const openComplaints = compSnap.size;

      // Class completion logs for this department
      try {
        const logsQ = query(
          collection(db, "class_logs"),
          where("dept", "==", userProfile.dept)
        );
        const logsSnap = await getDocs(logsQ);
        const logs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        logs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        setClassLogs(logs.slice(0, 10));
      } catch (err) {
        console.error("Error loading class logs:", err);
      }

      setStats({
        pendingGatePasses,
        totalStudents,
        openComplaints,
        todayAbsent,
        pendingFinesCount: pendingFines.length
      });
      setYearSummary(yearSummary);
    } catch (err) {}
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

  const quickActions = [
    { icon: <DoorOpen size={28} color="#3b82f6" />, label: "Gate Pass Approval", action: () => navigate("/hod/gatepass"), badge: stats.pendingGatePasses },
    { icon: <CreditCard size={28} color="#10b981" />, label: "Fees Overview", action: () => navigate("/hod/fees") },
    { icon: <UserX size={28} color="#f59e0b" />, label: "Today's Absentees", action: () => navigate("/hod/attendance"), badge: stats.todayAbsent },
    { icon: <Award size={28} color="#6366f1" />, label: "Department Results", action: () => navigate("/hod/results") },
    { icon: <MessageSquareWarning size={28} color="#ec4899" />, label: "Student Complaints", action: () => navigate("/hod/complaints"), badge: stats.openComplaints },
    { icon: <AlertOctagon size={28} color="#ef4444" />, label: "Verify Fines", action: () => navigate("/hod/fines"), badge: stats.pendingFinesCount }
  ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <DateTimeHeader />
        <div className="page-header">
          <h1>HOD Dashboard</h1>
          <p>{userProfile?.dept} Department Head</p>
        </div>

        {/* Alert for pending fines */}
        {!loading && stats.pendingFinesCount > 0 && (
          <div style={{ 
            padding: "14px 20px", borderRadius: "var(--radius-md)", marginBottom: 24, 
            background: "#fef2f2", border: "1px solid #fecaca", 
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <AlertTriangle size={20} color="#dc2626" />
              <div style={{ color: "#dc2626", fontWeight: 600 }}>{stats.pendingFinesCount} student fine payments pending verification!</div>
            </div>
            <button className="btn-primary" onClick={() => navigate("/hod/fines")} style={{ width: "auto", padding: "6px 16px", fontSize: 13, background: "#dc2626" }}>
              Verify Now <ArrowRight size={14} />
            </button>
          </div>
        )}

        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 20, fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>Quick Actions</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20 }}>
            {quickActions.map((action) => (
              <div 
                key={action.label} 
                onClick={action.action} 
                style={{
                  padding: "24px 20px", 
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  background: '#ffffff',
                  cursor: "pointer", 
                  textAlign: "center", 
                  transition: "all 0.2s ease",
                  minHeight: 140,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  position: "relative"
                }}
                onMouseOver={e => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.borderColor = "rgba(37, 99, 235, 0.4)";
                  e.currentTarget.style.background = "rgba(37, 99, 235, 0.04)";
                }}
                onMouseOut={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.background = "#ffffff";
                }}
              >
                {action.badge > 0 && (
                  <div style={{ position: "absolute", top: 12, right: 12, width: 22, height: 22, borderRadius: "50%", background: "#ef4444", color: "white", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{action.badge}</div>
                )}
                <div style={{ marginBottom: 12 }}>{action.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{action.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Forwarded Live Class Completion & Syllabus Reports */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                <BookOpen size={20} color="#2563eb" /> Forwarded Class Completion & Syllabus Reports
              </h3>
              <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0 0" }}>
                Real-time class logs submitted by staff (including visiting faculty from other departments)
              </p>
            </div>
          </div>

          {classLogs.length === 0 ? (
            <div style={{ padding: "30px 20px", textAlign: "center", background: "#f8fafc", borderRadius: 8, color: "#64748b" }}>
              <Clock size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
              <div>No class completion logs received yet today.</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ padding: 12, textAlign: "left" }}>Date / Period</th>
                    <th style={{ padding: 12, textAlign: "left" }}>Class & Sec</th>
                    <th style={{ padding: 12, textAlign: "left" }}>Subject</th>
                    <th style={{ padding: 12, textAlign: "left" }}>Faculty</th>
                    <th style={{ padding: 12, textAlign: "left" }}>Topic Covered</th>
                    <th style={{ padding: 12, textAlign: "center" }}>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {classLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{log.date}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>Period {log.period} ({log.timeSlot || "N/A"})</div>
                      </td>
                      <td style={{ padding: 12 }}>
                        <span style={{ padding: "2px 8px", background: "#eff6ff", color: "#1d4ed8", borderRadius: 4, fontWeight: 600, fontSize: 12 }}>
                          {log.year} {log.section}
                        </span>
                      </td>
                      <td style={{ padding: 12, fontWeight: 600 }}>{log.subjectName}</td>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 500, color: "#0f172a" }}>{log.staffName}</div>
                        {log.staffDept && log.staffDept !== userProfile?.dept && (
                          <span style={{ fontSize: 10, background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: 3, fontWeight: 600 }}>
                            {log.staffDept} Faculty
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 12, color: "#334155", maxWidth: 300 }}>{log.topicCovered || "—"}</td>
                      <td style={{ padding: 12, textAlign: "center" }}>
                        <span style={{ 
                          padding: "4px 10px", 
                          borderRadius: 12, 
                          fontSize: 12, 
                          fontWeight: 700,
                          background: (log.attendancePercent || 0) >= 75 ? "#dcfce7" : "#fee2e2",
                          color: (log.attendancePercent || 0) >= 75 ? "#166534" : "#991b1b"
                        }}>
                          {log.attendancePercent !== undefined ? `${log.attendancePercent}%` : "Recorded"}
                        </span>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
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