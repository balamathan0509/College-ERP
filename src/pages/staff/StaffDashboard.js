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
  const [inchargeInfo, setInchargeInfo] = useState(null);

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

      // Open complaints
      const compQ = query(
        collection(db, "complaints"),
        where("dept", "==", userProfile.dept),
        where("status", "==", "open")
      );
      const compSnap = await getDocs(compQ);
      const openComplaints = compSnap.size;

      // Class In-charge info
      const incQ = query(
        collection(db, "class_incharges"),
        where("facultyId", "==", userProfile.uid)
      );
      const incSnap = await getDocs(incQ);
      let inchargeData = null;
      if (!incSnap.empty) {
        inchargeData = incSnap.docs[0].data();
        setInchargeInfo(inchargeData);
      }

      // Total students in class & Attendance Check
      let fetchedStudents = [];
      let todayAttendanceMarked = false;
      if (inchargeData) {
        const studQ = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("dept", "==", inchargeData.dept)
        );
        const studSnap = await getDocs(studQ);
        let tempStudents = studSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Filter by year
        tempStudents = tempStudents.filter(s => s.year === inchargeData.year);
        // Filter by section if applicable
        if (inchargeData.section && inchargeData.section !== ".") {
          tempStudents = tempStudents.filter(s => s.section === inchargeData.section);
        }
        fetchedStudents = tempStudents;

        // Check if attendance is marked for this class today
        const attQ = query(
          collection(db, "daily_attendance"),
          where("date", "==", today),
          where("dept", "==", inchargeData.dept),
          where("year", "==", inchargeData.year)
        );
        const attSnap = await getDocs(attQ);
        if (inchargeData.section && inchargeData.section !== ".") {
          const classAtt = attSnap.docs.filter(d => d.data().section === inchargeData.section || !d.data().section);
          todayAttendanceMarked = classAtt.length > 0;
        } else {
          todayAttendanceMarked = !attSnap.empty;
        }
      }
      setStudents(fetchedStudents);
      const totalStudents = fetchedStudents.length;

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
        <div className="page-header" style={{ marginBottom: 24 }}>
          <div>
            <h1>Faculty Dashboard</h1>
            <p style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", marginTop: 6, flexWrap: "wrap" }}>
              <span>{userProfile?.dept} Department</span>
              {inchargeInfo && (
                <span style={{ 
                  fontSize: 12, 
                  background: "rgba(37, 99, 235, 0.1)", 
                  color: "#3b82f6", 
                  padding: "3px 12px", 
                  borderRadius: "50px", // Fully rounded, circle-like edges
                  border: "1px solid rgba(37, 99, 235, 0.2)",
                  fontWeight: 600
                }}>
                  Class In-Charge: {inchargeInfo.year} {inchargeInfo.section !== "." ? `(Sec ${inchargeInfo.section})` : ""}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card" style={{ display: "block", cursor: "pointer", position: "relative", padding: "22px" }} onClick={() => navigate("/staff/gatepass")}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "var(--text-muted)", fontWeight: 500, marginBottom: 12 }}>Pending Gate Passes</div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>
              {loading ? "..." : stats.pendingGatePasses}
            </div>
            <div style={{
              position: "absolute", right: 20, top: 20,
              width: 50, height: 50, borderRadius: "50%",
              background: "#eff6ff",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <DoorOpen size={24} color="#2563eb" />
            </div>
          </div>

          {inchargeInfo && (
            <div className="stat-card" style={{ display: "block", cursor: "pointer", position: "relative", padding: "22px" }} onClick={() => navigate("/staff/attendance")}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "var(--text-muted)", fontWeight: 500, marginBottom: 12 }}>Today's Attendance</div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)", paddingTop: 4 }}>
                {loading ? "..." : stats.todayAttendanceMarked ? "Done" : "Pending"}
              </div>
              <div style={{
                position: "absolute", right: 20, top: 20,
                width: 50, height: 50, borderRadius: "50%",
                background: "#ecfdf5",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <CheckSquare size={24} color="#059669" />
              </div>
            </div>
          )}

          <div className="stat-card" style={{ display: "block", cursor: "pointer", position: "relative", padding: "22px" }} onClick={() => navigate("/staff/complaints")}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "var(--text-muted)", fontWeight: 500, marginBottom: 12 }}>Open Complaints</div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>
              {loading ? "..." : stats.openComplaints}
            </div>
            <div style={{
              position: "absolute", right: 20, top: 20,
              width: 50, height: 50, borderRadius: "50%",
              background: "#fff1f2",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <MessageSquareWarning size={24} color="#e11d48" />
            </div>
          </div>

          {inchargeInfo && (
            <div className="stat-card" style={{ display: "block", position: "relative", padding: "22px" }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "var(--text-muted)", fontWeight: 500, marginBottom: 12 }}>Total Students</div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>
                {loading ? "..." : stats.totalStudents}
              </div>
              <div style={{
                position: "absolute", right: 20, top: 20,
                width: 50, height: 50, borderRadius: "50%",
                background: "#f3e8ff",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <Users size={24} color="#9333ea" />
              </div>
            </div>
          )}
        </div>

        {/* Attendance reminder */}
        {!loading && inchargeInfo && !stats.todayAttendanceMarked && (
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

        {/* Quick Actions */}
        <div className="card">
          <h3 style={{ marginBottom: 20, fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>Quick Actions</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 16 }}>
            {quickActions.map((action) => (
              <div key={action.path} onClick={() => navigate(action.path)} style={{
                padding: "20px 14px", 
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                background: "var(--bg-color)",
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
                  e.currentTarget.style.background = "var(--bg-color)";
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