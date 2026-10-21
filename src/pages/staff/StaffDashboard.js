import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import ClassLogModal from "../../components/ClassLogModal";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, where, getDocs } from "../../supabase/supabaseAdapter";
import { useNavigate } from "react-router-dom";
import {
  DoorOpen, CheckSquare, Award, Calendar, Briefcase, Bell,
  MessageSquareWarning, Users, AlertTriangle,
  ArrowRight, BookOpen, Plus, TrendingUp, HelpCircle
} from "lucide-react";
import { getCalendarEventForDate, getUpcomingExamReminder } from "../../utils/academicCalendarUtils";

export default function StaffDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [todayEvent, setTodayEvent] = useState(null);
  const [upcomingReminder, setUpcomingReminder] = useState(null);
  const [stats, setStats] = useState({ pendingGatePasses:0, todayAttendanceMarked:false, openComplaints:0, totalStudents:0 });
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [inchargeInfo, setInchargeInfo] = useState(() => {
    try {
      const cached = localStorage.getItem("faculty_incharge_cache");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  async function fetchStats() {
    try {
      const today = new Date().toISOString().split("T")[0];
      if (userProfile?.dept) {
        const calEv = await getCalendarEventForDate(userProfile.dept, today);
        setTodayEvent(calEv);
        const reminder = await getUpcomingExamReminder(userProfile.dept, 3);
        if (reminder && !localStorage.getItem(`dismissed_exam_${reminder.id}_${today}`)) setUpcomingReminder(reminder);
      }
      let pendingGatePasses = 0, openComplaints = 0;
      if (userProfile?.dept) {
        const gpSnap = await getDocs(query(collection(db,"gate_pass"), where("dept","==",userProfile.dept), where("status","==","pending_staff")));
        pendingGatePasses = gpSnap.size;
        const compSnap = await getDocs(query(collection(db,"complaints"), where("dept","==",userProfile.dept), where("status","==","open")));
        openComplaints = compSnap.size;
      }
      const incSnap = await getDocs(query(collection(db,"class_incharges"), where("facultyId","==",userProfile.uid)));
      let inchargeData = null;
      if (!incSnap.empty) {
        inchargeData = incSnap.docs[0].data();
        setInchargeInfo(inchargeData);
        try { localStorage.setItem("faculty_incharge_cache", JSON.stringify(inchargeData)); } catch {}
      } else {
        setInchargeInfo(null);
        try { localStorage.removeItem("faculty_incharge_cache"); } catch {}
      }
      let fetchedStudents = [], todayAttendanceMarked = false;
      if (inchargeData) {
        const studSnap = await getDocs(query(collection(db,"users"), where("role","==","student"), where("dept","==",inchargeData.dept)));
        let tmp = studSnap.docs.map(d=>({id:d.id,...d.data()})).filter(s=>s.year===inchargeData.year);
        if (inchargeData.section && inchargeData.section!==".") tmp = tmp.filter(s=>s.section===inchargeData.section);
        fetchedStudents = tmp;
        const attSnap = await getDocs(query(collection(db,"daily_attendance"), where("date","==",today), where("dept","==",inchargeData.dept), where("year","==",inchargeData.year)));
        if (inchargeData.section && inchargeData.section!==".") todayAttendanceMarked = attSnap.docs.filter(d=>d.data().section===inchargeData.section||!d.data().section).length>0;
        else todayAttendanceMarked = !attSnap.empty;
      }
      setStudents(fetchedStudents);
      setStats({ pendingGatePasses, todayAttendanceMarked, openComplaints, totalStudents:fetchedStudents.length });
      if (userProfile?.uid) {
        const [allocSnap, courseAllocSnap] = await Promise.all([
          getDocs(query(collection(db,"subject_allocations"), where("facultyId","==",userProfile.uid), where("status","==","Active"))),
          getDocs(query(collection(db,"course_allocations"), where("facultyId","==",userProfile.uid)))
        ]);
        const list1 = allocSnap.docs.map(d=>({id:d.id,...d.data()}));
        const list2 = courseAllocSnap.docs.map(d=>{
          const data = d.data();
          const sem = Number(data.semester) || 1;
          const yearNum = Math.ceil(sem / 2);
          const yearStr = yearNum === 1 ? '1st Year' : yearNum === 2 ? '2nd Year' : yearNum === 3 ? '3rd Year' : '4th Year';
          return {
            id: d.id,
            ...data,
            department: data.department || userProfile?.dept || 'CSE',
            year: yearStr,
            semester: String(data.semester || 1),
            section: data.section || 'A',
            subjectId: data.courseId,
            subjectCode: data.courseCode,
            subjectName: data.courseName,
            status: 'Active'
          };
        });
        const combinedAssigned = [...list1];
        for (const c of list2) {
          if (!combinedAssigned.some(a => (a.subjectCode === c.subjectCode && String(a.semester) === String(c.semester)) || a.courseAllocationId === c.id)) {
            combinedAssigned.push(c);
          }
        }
        setAssignedSubjects(combinedAssigned);
        const logsSnap = await getDocs(query(collection(db,"class_logs"), where("facultyId","==",userProfile.uid)));
        const logsList = logsSnap.docs.map(d=>({id:d.id,...d.data()}));
        logsList.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
        setRecentLogs(logsList.slice(0,5));

      }
    } catch(err){ console.error(err); }
    setLoading(false);
  }

  useEffect(()=>{ if(userProfile) fetchStats(); },[userProfile]);

  const handleClearReminder = () => {
    const today = new Date().toISOString().split("T")[0];
    if (upcomingReminder?.id) localStorage.setItem(`dismissed_exam_${upcomingReminder.id}_${today}`,"true");
    setUpcomingReminder(null);
  };

  const statCards = [
    {
      label: "Pending Gate Passes",
      value: loading ? "—" : stats.pendingGatePasses,
      icon: <DoorOpen size={15} color="#2563eb" strokeWidth={2.2}/>,
      iconBg: "#eff6ff",
      path: "/staff/gatepass"
    },
    {
      label: "Today's Attendance",
      value: loading ? "—" : (inchargeInfo ? (stats.todayAttendanceMarked ? "Done ✓" : "Pending") : "N/A"),
      isStatus: true,
      statusType: !inchargeInfo ? "neutral" : (stats.todayAttendanceMarked ? "success" : "warning"),
      icon: <CheckSquare size={15} color={inchargeInfo ? (stats.todayAttendanceMarked ? "#059669" : "#d97706") : "#64748b"} strokeWidth={2.2}/>,
      iconBg: inchargeInfo ? (stats.todayAttendanceMarked ? "#ecfdf5" : "#fef3c7") : "#f1f5f9",
      path: inchargeInfo ? "/staff/attendance" : null
    },
    {
      label: "Open Complaints",
      value: loading ? "—" : stats.openComplaints,
      icon: <MessageSquareWarning size={15} color={stats.openComplaints > 0 ? "#ef4444" : "#10b981"} strokeWidth={2.2}/>,
      iconBg: stats.openComplaints > 0 ? "#fee2e2" : "#ecfdf5",
      path: "/staff/complaints"
    },
    {
      label: "Total Students",
      value: loading ? "—" : (inchargeInfo ? stats.totalStudents : "—"),
      icon: <Users size={15} color="#8b5cf6" strokeWidth={2.2}/>,
      iconBg: "#f5f3ff",
      path: inchargeInfo ? "/staff/students" : null
    },
    {
      label: "My Subjects",
      value: loading ? "—" : assignedSubjects.length,
      icon: <BookOpen size={15} color="#0891b2" strokeWidth={2.2}/>,
      iconBg: "#e0f2fe",
      path: "/staff/my-subjects"
    }
  ];

  const quickActions = [
    { icon:<Calendar size={26} color="#2563eb"/>, label:"Academic Calendar", path:"/academics/academic-calendar", bg:"rgba(37,99,235,0.1)", color:"#2563eb" },
    { icon:<BookOpen size={26} color="#059669"/>, label:"Log Class & Topic", onClick:()=>setIsLogModalOpen(true), bg:"rgba(5,150,105,0.1)", color:"#059669" },
    { icon:<Award size={26} color="#7c3aed"/>, label:"5-Internal Marks", path:"/cia/mark-entry", bg:"rgba(124,58,237,0.1)", color:"#7c3aed" },
    { icon:<DoorOpen size={26} color="#3b82f6"/>, label:"Gate Pass Approvals", path:"/staff/gatepass", bg:"rgba(59,130,246,0.1)", color:"#3b82f6" },
    { icon:<CheckSquare size={26} color="#10b981"/>, label:"Mark Attendance", path:"/staff/attendance", bg:"rgba(16,185,129,0.1)", color:"#10b981" },
    { icon:<Calendar size={26} color="#06b6d4"/>, label:"Post Timetable", path:"/staff/timetable", bg:"rgba(6,182,212,0.1)", color:"#06b6d4" },
    { icon:<Briefcase size={26} color="#8b5cf6"/>, label:"Post Job Alert", path:"/staff/placements", bg:"rgba(139,92,246,0.1)", color:"#8b5cf6" },
    { icon:<Bell size={26} color="#f59e0b"/>, label:"Send Alert", path:"/staff/alerts", bg:"rgba(245,158,11,0.1)", color:"#f59e0b" },
    { icon:<MessageSquareWarning size={26} color="#ec4899"/>, label:"View Complaints", path:"/staff/complaints", bg:"rgba(236,72,153,0.1)", color:"#ec4899" },
    { icon:<HelpCircle size={26} color="#64748b"/>, label:"Help Center", path:"/staff/help", bg:"rgba(100,116,139,0.1)", color:"#64748b" },
  ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content" style={{ background:"#f3f4f8" }}>
        <DateTimeHeader />

        {/* Faculty Profile & Action Card (2nd Image Box) */}
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
              FACULTY DASHBOARD
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
              <strong style={{ color: "#0f172a" }}>{userProfile?.name || "Faculty"}</strong>
              <span style={{ color: "#cbd5e1" }}>•</span>
              <span>{userProfile?.designation || "Faculty"}</span>
              <span style={{ color: "#cbd5e1" }}>•</span>
              <span>{userProfile?.dept} Department</span>
              {userProfile?.staffId && (
                <>
                  <span style={{ color: "#cbd5e1" }}>•</span>
                  <span>Staff ID: <strong style={{ color: "#334155" }}>{userProfile.staffId}</strong></span>
                </>
              )}
              {inchargeInfo && (
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
                  ⭐ Class In-Charge: {inchargeInfo.year}{inchargeInfo.section !== "." ? ` Sec ${inchargeInfo.section}` : ""}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsLogModalOpen(true)}
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
            <Plus size={16} /> Log Class
          </button>
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

        {/* Simple Calendar Banner */}
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

        {/* Simple Attendance Alert */}
        {!loading && inchargeInfo && !stats.todayAttendanceMarked && (
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
                Today's attendance not marked yet for your class
              </span>
            </div>
            <button
              onClick={() => navigate("/staff/attendance")}
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
              Mark Now <ArrowRight size={12} />
            </button>
          </div>
        )}

        {/* Stat Cards - Compact, Simple & Fixed 5-Boxes Layout */}
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

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                {card.isStatus ? (
                  <span style={{
                    padding: "2px 7px",
                    borderRadius: 5,
                    fontSize: 11,
                    fontWeight: 700,
                    background: card.statusType === "success" ? "#dcfce7" : card.statusType === "warning" ? "#fef3c7" : "#f1f5f9",
                    color: card.statusType === "success" ? "#15803d" : card.statusType === "warning" ? "#b45309" : "#64748b",
                    border: `1px solid ${card.statusType === "success" ? "#bbf7d0" : card.statusType === "warning" ? "#fde68a" : "#e2e8f0"}`
                  }}>
                    {card.value}
                  </span>
                ) : (
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>
                    {card.value}
                  </span>
                )}
                {card.path && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#2563eb", display: "inline-flex", alignItems: "center", gap: 2 }}>
                    View <ArrowRight size={10} />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* My Allocated Subjects */}
        <div style={{ background:"#fff", borderRadius:16, padding:"24px", marginBottom:24, boxShadow:"0 2px 10px rgba(0,0,0,0.05)", border:"1px solid rgba(0,0,0,0.05)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <div>
              <h3 style={{ fontSize:15, fontWeight:700, color:"#1e293b", margin:0 }}>My Allocated Subjects & Classes</h3>
              <p style={{ fontSize:12, color:"#94a3b8", margin:"3px 0 0 0" }}>Assigned subjects across all departments</p>
            </div>
            <button onClick={()=>setIsLogModalOpen(true)} style={{ padding:"8px 14px", borderRadius:8, background:"#eff6ff", border:"1px solid #bfdbfe", color:"#1d4ed8", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}><Plus size={13}/> Log Topic</button>
          </div>
          {assignedSubjects.length===0 ? (
            <div style={{ textAlign:"center", padding:24, color:"#64748b", fontSize:13 }}>No active subject allocations. Contact your HOD.</div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:12 }}>
              {assignedSubjects.map(sub=>(
                <div key={sub.id} style={{ padding:14, borderRadius:12, background:"#f8fafc", border:"1px solid #e2e8f0", transition:"all 0.2s" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#bfdbfe"; e.currentTarget.style.background="#eff6ff";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.background="#f8fafc";}}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:"#1e40af" }}>{sub.subjectCode||sub.courseCode}</span>
                    <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:"#dbeafe", color:"#1d4ed8", fontWeight:700 }}>{sub.department||sub.targetDept||sub.dept}</span>
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginBottom:6 }}>{sub.subjectName||sub.courseName}</div>
                  <div style={{ fontSize:11, color:"#64748b", display:"flex", gap:8, fontWeight:600, marginBottom:10 }}>
                    <span>Year: {sub.year}</span><span>•</span><span>Sec: {sub.section||"A"}</span>{sub.semester&&<><span>•</span><span>Sem {sub.semester}</span></>}
                  </div>
                  <button onClick={()=>setIsLogModalOpen(true)} style={{ width:"100%", padding:"6px 10px", borderRadius:8, background:"#fff", border:"1px solid #cbd5e1", color:"#2563eb", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                    <BookOpen size={12}/> Log Topic & Attendance
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Class Logs */}
        {recentLogs.length>0 && (
          <div style={{ background:"#fff", borderRadius:16, padding:"24px", marginBottom:24, boxShadow:"0 2px 10px rgba(0,0,0,0.05)", border:"1px solid rgba(0,0,0,0.05)" }}>
            <h3 style={{ fontSize:15, fontWeight:700, color:"#1e293b", marginBottom:16 }}>Recent Submitted Class Reports</h3>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ background:"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
                    {["Date & Period","Subject","Dept & Class","Topic Covered","Attendance"].map(h=>(
                      <th key={h} style={{ padding:"10px 12px", textAlign:"left", color:"#475569", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map(log=>(
                    <tr key={log.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                      <td style={{ padding:"10px 12px", fontWeight:600, color:"#0f172a" }}><div>{log.date}</div><div style={{ fontSize:11, color:"#64748b" }}>{log.period}</div></td>
                      <td style={{ padding:"10px 12px", fontWeight:700, color:"#1e40af" }}>{log.subjectCode} - {log.subjectName}</td>
                      <td style={{ padding:"10px 12px", color:"#334155" }}>{log.targetDept} {log.year} Sec {log.section}</td>
                      <td style={{ padding:"10px 12px", color:"#0f172a", maxWidth:200, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{log.topicCovered}</td>
                      <td style={{ padding:"10px 12px" }}><span style={{ padding:"3px 8px", borderRadius:20, background:"#ecfdf5", color:"#047857", fontWeight:700, fontSize:11 }}>{log.presentCount}/{log.totalStudents} ({log.attendancePercentage})</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div style={{ background:"#fff", borderRadius:16, padding:"24px", boxShadow:"0 2px 10px rgba(0,0,0,0.05)", border:"1px solid rgba(0,0,0,0.05)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
            <div>
              <h3 style={{ fontSize:15, fontWeight:700, color:"#1e293b", margin:0 }}>Quick Actions</h3>
              <p style={{ fontSize:12, color:"#94a3b8", margin:"3px 0 0 0" }}>Navigate to any section quickly</p>
            </div>
            <TrendingUp size={17} color="#1d4ed8"/>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(105px,1fr))", gap:12 }}>
            {quickActions.map((action,idx)=>(
              <div key={idx} onClick={()=>action.onClick?action.onClick():navigate(action.path)}
                style={{ padding:"16px 8px", borderRadius:14, border:"1.5px solid transparent", background:"#f8fafc", cursor:"pointer", textAlign:"center", transition:"all 0.2s ease", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}
                onMouseEnter={e=>{ e.currentTarget.style.background=action.bg; e.currentTarget.style.borderColor=action.color+"40"; e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow=`0 8px 20px ${action.color}25`; }}
                onMouseLeave={e=>{ e.currentTarget.style.background="#f8fafc"; e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}>
                <div style={{ width:52, height:52, borderRadius:"50%", background:action.bg, border:`1.5px solid ${action.color}30`, display:"flex", alignItems:"center", justifyContent:"center" }}>{action.icon}</div>
                <div style={{ fontSize:11, fontWeight:600, color:"#374151", lineHeight:1.3 }}>{action.label}</div>
              </div>
            ))}
          </div>
        </div>

        <ClassLogModal isOpen={isLogModalOpen} onClose={()=>setIsLogModalOpen(false)} onSuccess={fetchStats}/>
      </main>
    </div>
  );
}
