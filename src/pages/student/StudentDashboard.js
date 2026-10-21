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
  TrendingUp, User, ChevronRight
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
    { label:"Attendance", value: loading?"—": stats.attendancePercent!==null?`${stats.attendancePercent}%`:"N/A",
      sub: !loading&&stats.totalDays>0?`${stats.presentDays}/${stats.totalDays} days`:"No records yet",
      icon:<CheckSquare size={22} color="#fff"/>, iconBg:"linear-gradient(135deg,#10b981,#059669)",
      badge:"Live", badgeColor:"#10b981", valueColor:attColor, path:"/student/attendance", shadow:"0 8px 24px rgba(16,185,129,0.25)" },
    { label:"Gate Passes", value:loading?"—":stats.gatePassCount, sub:"Total requests",
      icon:<DoorOpen size={22} color="#fff"/>, iconBg:"linear-gradient(135deg,#3b82f6,#1d4ed8)",
      valueColor:"#3b82f6", path:"/student/gatepass", shadow:"0 8px 24px rgba(59,130,246,0.25)" },
    { label:"Pending Fees", value:loading?"—":stats.pendingFees,
      sub:stats.pendingFees>0?"Payment required":"All cleared ✓",
      icon:<CreditCard size={22} color="#fff"/>, iconBg:"linear-gradient(135deg,#06b6d4,#0284c7)",
      valueColor:stats.pendingFees>0?"#ef4444":"#10b981", path:"/student/fees", shadow:"0 8px 24px rgba(6,182,212,0.25)" },
    { label:"Notifications", value:loading?"—":stats.newAlerts, sub:"Unread alerts",
      icon:<Bell size={22} color="#fff"/>, iconBg:"linear-gradient(135deg,#f59e0b,#d97706)",
      valueColor:"#f59e0b", path:"/student/alerts", shadow:"0 8px 24px rgba(245,158,11,0.25)" },
    { label:"Active Fines", value:loading?"—":stats.activeFines,
      sub:!loading&&stats.activeFines>0?`Rs.${stats.totalFineAmount.toLocaleString("en-IN")} due`:"No fines",
      icon:<AlertOctagon size={22} color="#fff"/>, iconBg:"linear-gradient(135deg,#ef4444,#dc2626)",
      valueColor:stats.activeFines>0?"#ef4444":"#10b981", path:"/student/fines", shadow:"0 8px 24px rgba(239,68,68,0.25)" }
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
      <main className="main-content" style={{ background:"#f3f4f8" }}>
        <DateTimeHeader />

        {/* Hero Header */}
        <div style={{ background:"linear-gradient(135deg,#1e3a5f 0%,#405189 60%,#6366f1 100%)", borderRadius:16, padding:"28px 32px", marginBottom:24, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16, boxShadow:"0 12px 40px rgba(64,81,137,0.3)", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-40, right:-40, width:160, height:160, borderRadius:"50%", background:"rgba(255,255,255,0.05)", pointerEvents:"none" }}/>
          <div style={{ position:"absolute", bottom:-30, right:100, width:90, height:90, borderRadius:"50%", background:"rgba(255,255,255,0.04)", pointerEvents:"none" }}/>
          <div style={{ display:"flex", alignItems:"center", gap:18, zIndex:1 }}>
            <div style={{ width:56, height:56, borderRadius:"50%", background:"rgba(255,255,255,0.15)", border:"2px solid rgba(255,255,255,0.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <User size={26} color="#fff"/>
            </div>
            <div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.65)", fontWeight:500, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Welcome Back 👋</div>
              <h1 style={{ color:"#fff", fontSize:22, fontWeight:700, margin:0 }}>{userProfile?.name || "Student"}</h1>
            </div>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", zIndex:1 }}>
            {[{label:"Department",value:userProfile?.dept||"—"},{label:"Year",value:userProfile?.year||"—"},{label:"Reg No",value:userProfile?.registerNo||"—"}].map(item => (
              <div key={item.label} style={{ background:"rgba(255,255,255,0.12)", backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:10, padding:"10px 18px", textAlign:"center", minWidth:85 }}>
                <div style={{ color:"rgba(255,255,255,0.6)", fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>{item.label}</div>
                <div style={{ color:"#fff", fontSize:14, fontWeight:700, marginTop:3 }}>{item.value}</div>
              </div>
            ))}
            {userProfile?.studentType && (
              <div style={{ background:"rgba(255,230,0,0.15)", border:"1px solid rgba(255,230,0,0.35)", borderRadius:10, padding:"10px 16px", textAlign:"center" }}>
                <div style={{ color:"rgba(255,255,255,0.6)", fontSize:10, fontWeight:600, textTransform:"uppercase" }}>Type</div>
                <div style={{ color:"#ffe600", fontSize:13, fontWeight:700, marginTop:3 }}>{userProfile.studentType==="hosteller"?"🏠 Hosteller":"🚌 Day Scholar"}</div>
              </div>
            )}
          </div>
        </div>

        {/* Calendar Banner */}
        {todayEvent ? (
          <div style={{ padding:"13px 18px", borderRadius:12, marginBottom:18, background:todayEvent.type==="holiday"?"rgba(239,68,68,0.07)":"rgba(245,158,11,0.07)", border:`1px solid ${todayEvent.type==="holiday"?"rgba(239,68,68,0.22)":"rgba(245,158,11,0.22)"}`, display:"flex", alignItems:"center", gap:10 }}>
            <Calendar size={18} color={todayEvent.type==="holiday"?"#ef4444":"#f59e0b"}/>
            <span style={{ fontWeight:700, fontSize:13, color:todayEvent.type==="holiday"?"#dc2626":"#b45309" }}>{todayEvent.title} — {todayEvent.type.toUpperCase()}</span>
            <span style={{ fontSize:12, color:"#64748b" }}>{todayEvent.type==="holiday"?"Classes suspended.":"Special event day."}</span>
          </div>
        ) : (
          <div style={{ padding:"11px 16px", borderRadius:12, marginBottom:18, background:"rgba(16,185,129,0.07)", border:"1px solid rgba(16,185,129,0.18)", display:"flex", alignItems:"center", gap:8 }}>
            <Calendar size={15} color="#10b981"/>
            <span style={{ fontSize:13, color:"#047857", fontWeight:600 }}>📅 Today: Regular Working Day — {userProfile?.dept} Department</span>
          </div>
        )}

        {/* Warnings */}
        {!loading && upcomingFines.length > 0 && (
          <div style={{ padding:"14px 20px", borderRadius:12, marginBottom:18, background:"rgba(239,68,68,0.07)", border:"1px solid rgba(239,68,68,0.22)", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <Clock size={18} color="#ef4444"/>
              <div>
                <div style={{ color:"#dc2626", fontWeight:700, fontSize:13 }}>⚠️ Fine Due Date Warning</div>
                <div style={{ color:"#64748b", fontSize:12 }}>{upcomingFines.length} fine(s) expiring within 2 days.</div>
              </div>
            </div>
            <button onClick={() => navigate("/student/fines")} style={{ padding:"7px 16px", borderRadius:8, background:"#ef4444", color:"#fff", border:"none", fontWeight:600, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>Pay Now <ArrowRight size={13}/></button>
          </div>
        )}
        {!loading && stats.attendancePercent !== null && stats.attendancePercent < 75 && (
          <div style={{ padding:"13px 18px", borderRadius:12, marginBottom:18, background:"rgba(239,68,68,0.07)", border:"1px solid rgba(239,68,68,0.22)", display:"flex", alignItems:"center", gap:10 }}>
            <AlertTriangle size={18} color="#ef4444"/>
            <div>
              <div style={{ color:"#dc2626", fontWeight:700, fontSize:13 }}>⚠️ Low Attendance Warning</div>
              <div style={{ color:"#64748b", fontSize:12 }}>Your attendance is {stats.attendancePercent}% — below the 75% threshold.</div>
            </div>
          </div>
        )}

        {/* Stat Cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))", gap:18, marginBottom:24 }}>
          {statCards.map((card, i) => (
            <div key={i} onClick={() => navigate(card.path)}
              style={{ background:"#fff", borderRadius:16, padding:"22px 20px", cursor:"pointer", border:"1px solid rgba(0,0,0,0.05)", boxShadow:"0 2px 10px rgba(0,0,0,0.05)", transition:"all 0.24s ease", position:"relative" }}
              onMouseEnter={e => { e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.boxShadow=card.shadow; }}
              onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="0 2px 10px rgba(0,0,0,0.05)"; }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
                <div style={{ width:48, height:48, borderRadius:14, background:card.iconBg, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:card.shadow }}>{card.icon}</div>
                {card.badge && <span style={{ fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20, background:"rgba(16,185,129,0.1)", color:card.badgeColor }}>{card.badge}</span>}
              </div>
              <div style={{ fontSize:30, fontWeight:800, color:card.valueColor, lineHeight:1, marginBottom:5 }}>{card.value}</div>
              <div style={{ fontSize:13, fontWeight:600, color:"#374151", marginBottom:3 }}>{card.label}</div>
              <div style={{ fontSize:11, color:"#94a3b8" }}>{card.sub}</div>
              <ChevronRight size={15} color="#cbd5e1" style={{ position:"absolute", bottom:16, right:16 }}/>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div style={{ background:"#fff", borderRadius:16, padding:"24px", boxShadow:"0 2px 10px rgba(0,0,0,0.05)", border:"1px solid rgba(0,0,0,0.05)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
            <div>
              <h3 style={{ fontSize:15, fontWeight:700, color:"#1e293b", margin:0 }}>Quick Actions</h3>
              <p style={{ fontSize:12, color:"#94a3b8", margin:"3px 0 0 0" }}>Navigate to any section quickly</p>
            </div>
            <TrendingUp size={17} color="#405189"/>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(105px,1fr))", gap:12 }}>
            {quickActions.map((action) => (
              <div key={action.path} onClick={() => navigate(action.path)}
                style={{ padding:"16px 8px", borderRadius:14, border:"1.5px solid transparent", background:"#f8fafc", cursor:"pointer", textAlign:"center", transition:"all 0.2s ease", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}
                onMouseEnter={e => { e.currentTarget.style.background=action.bg; e.currentTarget.style.borderColor=action.color+"40"; e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow=`0 8px 20px ${action.color}25`; }}
                onMouseLeave={e => { e.currentTarget.style.background="#f8fafc"; e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}>
                <div style={{ width:52, height:52, borderRadius:"50%", background:action.bg, border:`1.5px solid ${action.color}30`, display:"flex", alignItems:"center", justifyContent:"center" }}>{action.icon}</div>
                <div style={{ fontSize:11, fontWeight:600, color:"#374151", lineHeight:1.3 }}>{action.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
