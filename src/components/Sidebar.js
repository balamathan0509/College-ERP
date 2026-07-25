// src/components/Sidebar.js
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  DoorOpen,
  ClipboardList,
  CheckSquare,
  CreditCard,
  Calendar,
  Briefcase,
  Bell,
  MessageSquareWarning,
  AlertOctagon,
  User,
  ShieldCheck,
  Building2,
  Utensils,
  Users,
  PieChart,
  Clock,
  GraduationCap,
  MapPin,
  LogOut,
  Award,
  X
} from "lucide-react";

const studentNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/student" },
  { icon: <DoorOpen size={18} />, label: "Gate Pass", path: "/student/gatepass" },
  { icon: <ClipboardList size={18} />, label: "Leave", path: "/student/leave" },
  { icon: <CheckSquare size={18} />, label: "Attendance", path: "/student/attendance" },
  { icon: <CreditCard size={18} />, label: "Fees", path: "/student/fees" },
  { icon: <Calendar size={18} />, label: "Timetable", path: "/student/timetable" },
  { icon: <Briefcase size={18} />, label: "Placements", path: "/student/placements" },
  { icon: <Bell size={18} />, label: "Alerts", path: "/student/alerts" },
  { icon: <MessageSquareWarning size={18} />, label: "Complaints", path: "/student/complaints" },
  { icon: <AlertOctagon size={18} />, label: "Fines", path: "/student/fines" },
  { icon: <User size={18} />, label: "Profile", path: "/student/profile" }
];

const staffNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/staff" },
  { icon: <DoorOpen size={18} />, label: "Gate Pass", path: "/staff/gatepass" },
  { icon: <ClipboardList size={18} />, label: "Leave", path: "/staff/leave" },
  { icon: <CheckSquare size={18} />, label: "Attendance", path: "/staff/attendance" },
  { icon: <Award size={18} />, label: "Results", path: "/staff/results" },
  { icon: <Calendar size={18} />, label: "Timetable", path: "/staff/timetable" },
  { icon: <Briefcase size={18} />, label: "Placements", path: "/staff/placements" },
  { icon: <Bell size={18} />, label: "Alerts", path: "/staff/alerts" },
  { icon: <MessageSquareWarning size={18} />, label: "Complaints", path: "/staff/complaints" },
  { icon: <AlertOctagon size={18} />, label: "Fines", path: "/staff/fines" },
  { icon: <User size={18} />, label: "Profile", path: "/staff/profile" }
];

const hodNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/hod" },
  { icon: <ClipboardList size={18} />, label: "Leave", path: "/hod/leave" },
  { icon: <Award size={18} />, label: "Results", path: "/hod/results" },
  { icon: <Calendar size={18} />, label: "Timetable", path: "/hod/timetable" },
  { icon: <Briefcase size={18} />, label: "Placements", path: "/hod/placements" },
  { icon: <Bell size={18} />, label: "Alerts", path: "/hod/alerts" },
  { icon: <AlertOctagon size={18} />, label: "Verify Fines", path: "/hod/fines" },
  { icon: <User size={18} />, label: "Profile", path: "/hod/profile" }
];

const wardenNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/warden" },
  { icon: <DoorOpen size={18} />, label: "Gate Pass Records", path: "/warden/gatepass" },
  { icon: <Users size={18} />, label: "Student Details", path: "/warden/students" },
  { icon: <CheckSquare size={18} />, label: "Attendance", path: "/warden/attendance" },
  { icon: <Bell size={18} />, label: "Alerts", path: "/warden/alerts" },
  { icon: <User size={18} />, label: "Profile", path: "/warden/profile" }
];

const officestaffNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/officestaff" },
  { icon: <CreditCard size={18} />, label: "Fees Collection", path: "/officestaff/fees" },
  { icon: <PieChart size={18} />, label: "Fees Overview", path: "/officestaff/overview" },
  { icon: <Bell size={18} />, label: "Fees Alerts", path: "/officestaff/alerts" },
  { icon: <Clock size={18} />, label: "Verify Fees", path: "/officestaff/verify-fees" },
  { icon: <User size={18} />, label: "Profile", path: "/officestaff/profile" }
];

const managementNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/management" },
  { icon: <DoorOpen size={18} />, label: "Gate Passes", path: "/management/gatepass" },
  { icon: <CheckSquare size={18} />, label: "Attendance", path: "/management/attendance" },
  { icon: <CreditCard size={18} />, label: "Fees", path: "/management/fees" },
  { icon: <Utensils size={18} />, label: "Mess", path: "/management/mess" },
  { icon: <Building2 size={18} />, label: "Hostel", path: "/management/hostel" },
  { icon: <Bell size={18} />, label: "Alerts", path: "/management/alerts" },
  { icon: <MessageSquareWarning size={18} />, label: "Complaints", path: "/management/complaints" },
  { icon: <User size={18} />, label: "Profile", path: "/management/profile" },
  { icon: <MapPin size={18} />, label: "Campus Map", path: "/campus-map" }
];

const securityNav = [
  { icon: <ShieldCheck size={18} />, label: "Verify Gate Pass", path: "/security/verify" },
  { icon: <User size={18} />, label: "Profile", path: "/security/profile" }
];

const principalNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/principal" },
  { icon: <DoorOpen size={18} />, label: "Gate Pass", path: "/principal/gatepass" },
  { icon: <ClipboardList size={18} />, label: "Leave Requests", path: "/principal/leave" },
  { icon: <Bell size={18} />, label: "Circulars", path: "/principal/alerts" },
  { icon: <User size={18} />, label: "Profile", path: "/principal/profile" }
];

const adminNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/admin" },
  { icon: <User size={18} />, label: "Profile", path: "/admin/profile" }
];

export default function Sidebar() {
  const { userProfile, logout, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = userProfile?.role;
  const navItems =
    isSuperAdmin ? adminNav :
    role === "student" ? studentNav :
    role === "staff" ? staffNav :
    role === "hod" ? hodNav :
    role === "warden" ? wardenNav :
    role === "officestaff" ? officestaffNav :
    role === "security" ? securityNav :
    role === "management" ? managementNav :
    role === "principal" ? principalNav : [];

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  function handleNavClick(path) {
    navigate(path);
    setMobileOpen(false);
  }

  const roleColors = {
    student: "#3b82f6",
    staff: "#10b981",
    hod: "#6366f1",
    warden: "#0284c7",
    officestaff: "#06b6d4",
    security: "#f59e0b",
    management: "#8b5cf6",
    principal: "#ec4899",
    admin: "#ef4444"
  };
  const color = isSuperAdmin ? "#ef4444" : (roleColors[role] || "#3b82f6");

  const sidebarContent = (
    <>
      <div className="sidebar-logo">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(37, 99, 235, 0.15)",
              border: "1px solid rgba(37, 99, 235, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <GraduationCap size={22} color="#3b82f6" />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text)" }}>Campus ERP</h2>
              <p style={{ color, fontSize: 10, fontWeight: 700, letterSpacing: "1px", margin: 0 }}>
                {isSuperAdmin ? "SUPER ADMIN" : role?.toUpperCase()} PORTAL
              </p>
            </div>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="sidebar-close-btn"
            style={{
              display: "none",
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4
            }}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <div
            key={item.path}
            className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
            onClick={() => handleNavClick(item.path)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="user-info">
          <div className="user-name">{userProfile?.name || "User"}</div>
          <div className="user-role" style={{ color }}>
            {isSuperAdmin ? "Super Admin" : (userProfile?.dept ? `${userProfile.dept} • ${role}` : role)}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button 
            className="btn-theme"
            style={{ flex: 1, padding: "8px 10px", margin: 0, fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }} 
            onClick={() => handleNavClick(isSuperAdmin ? "/admin/profile" : `/${role}/profile`)}
          >
            <User size={14} /> Profile
          </button>
          <button 
            className="btn-logout" 
            style={{ flex: 1, margin: 0, padding: "8px 10px", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }} 
            onClick={handleLogout}
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Hamburger Button — mobile only */}
      <button
        className="hamburger-btn"
        onClick={() => setMobileOpen(true)}
        style={{
          display: "none",
          position: "fixed",
          top: 16,
          left: 16,
          zIndex: 1001,
          background: color,
          border: "none",
          borderRadius: 10,
          width: 42,
          height: 42,
          cursor: "pointer",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
        }}
      >
        <div style={{ width: 18, height: 2, background: "white", borderRadius: 2 }}></div>
        <div style={{ width: 18, height: 2, background: "white", borderRadius: 2 }}></div>
        <div style={{ width: 18, height: 2, background: "white", borderRadius: 2 }}></div>
      </button>

      {/* Overlay — mobile only */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1002,
            display: "none"
          }}
          className="sidebar-overlay"
        />
      )}

      {/* Desktop Sidebar */}
      <div className="sidebar sidebar-desktop">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar */}
      <div
        className={`sidebar sidebar-mobile ${mobileOpen ? "open" : ""}`}
        style={{
          position: "fixed",
          top: 0, left: 0,
          height: "100vh",
          zIndex: 1003,
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s ease"
        }}
      >
        {sidebarContent}
      </div>
    </>
  );
}
