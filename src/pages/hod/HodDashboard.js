// src/pages/hod/HodDashboard.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";


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
    todayAbsent: 0
  });
  const [yearSummary, setYearSummary] = useState(() => YEARS.reduce((acc, year) => {
    acc[year] = { students: 0, absent: 0, feesPending: 0 };
    return acc;
  }, {}));
  const [selectedYear, setSelectedYear] = useState(YEARS[0]);
  const [selectedYearData, setSelectedYearData] = useState({ students: 0, absent: 0, feesPending: 0 });
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [showLowAttendanceAlert, setShowLowAttendanceAlert] = useState(true);

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

      // Attendance and absent counts per year
      const allAttQ = query(
        collection(db, "attendance"),
        where("dept", "==", userProfile.dept)
      );
      const allAttSnap = await getDocs(allAttQ);
      allAttSnap.docs.forEach(doc => {
        const data = doc.data();
        const year = data.year;
        if (!yearSummary[year]) return;
        const records = data.records || {};
        const absentCount = Object.values(records).filter(v => v === false).length;
        yearSummary[year].absent += absentCount;
      });

      // Fees pending per year
      const feesQ = query(collection(db, "fees"), where("dept", "==", userProfile.dept));
      const feesSnap = await getDocs(feesQ);
      feesSnap.docs.forEach(doc => {
        const data = doc.data();
        const year = data.year;
        if (!yearSummary[year]) return;
        const payments = data.payments || {};
        yearSummary[year].feesPending += Object.values(payments).filter(v => !v).length;
      });

      // Open complaints
      const compQ = query(
        collection(db, "complaints"),
        where("dept", "==", userProfile.dept),
        where("status", "==", "open")
      );
      const compSnap = await getDocs(compQ);
      const openComplaints = compSnap.size;

      let lowAttendanceCount = 0;
      students.forEach(s => {
        const total = allAttSnap.docs.filter(r => r.data().records?.[s.id] !== undefined).length;
        const present = allAttSnap.docs.filter(r => r.data().records?.[s.id] === true).length;
        const percent = total ? Math.round((present / total) * 100) : 100;
        if (total > 0 && percent < 75) lowAttendanceCount++;
      });

      setStats({ pendingGatePasses, totalStudents, lowAttendanceCount, pendingFeesCount: Object.values(yearSummary).reduce((sum, y) => sum + y.feesPending, 0), openComplaints, todayAbsent });
      setYearSummary(yearSummary);
    } catch (err) {}
    setLoading(false);
  }

  useEffect(() => {
    if (userProfile) {
      setShowLowAttendanceAlert(true);
      fetchStats();
    }
  }, [userProfile]);

  useEffect(() => {
    setSelectedYearData(yearSummary[selectedYear] || { students: 0, absent: 0, feesPending: 0 });
  }, [selectedYear, yearSummary]);

  const quickActions = [
    { icon: "🚪", label: "Gate Pass Approval", action: () => navigate("/hod/gatepass"), color: "#e94560", badge: stats.pendingGatePasses },
    { icon: "💰", label: "Fees Pending", action: () => navigate("/hod/fees"), color: "#48bb78" },
    { icon: "❌", label: "Absentees", action: () => navigate("/hod/attendance"), color: "#f5a623", badge: stats.todayAbsent },
    { icon: "🧾", label: "Results", action: () => navigate("/hod/results"), color: "#7f9cf5" },
    { icon: "📝", label: "Complaints", action: () => navigate("/hod/complaints"), color: "#f6ad55", badge: stats.openComplaints }
  ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <DateTimeHeader />
        <div className="page-header">
          <h1>HOD Dashboard 🏛️</h1>
          <p>{userProfile?.dept} Department Head</p>
        </div>








        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 20, fontFamily: "Syne", fontSize: 18 }}>Quick Actions</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
            {quickActions.map((action) => (
              <div key={action.label} onClick={action.action} style={{
                padding: "28px 20px", borderRadius: 18,
                border: `1px solid ${action.color}30`,
                background: `${action.color}10`,
                cursor: "pointer", textAlign: "center", transition: "all 0.2s",
                minHeight: 180,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                position: "relative"
              }}
                onMouseOver={e => e.currentTarget.style.transform = "translateY(-3px)"}
                onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                {action.badge > 0 && (
                  <div style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#fc8181", color: "white", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{action.badge}</div>
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