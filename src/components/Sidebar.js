// src/components/Sidebar.js
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

const studentNav = [
  { icon: "🏠", label: "Dashboard", path: "/student" },
  { icon: "🚪", label: "Gate Pass", path: "/student/gatepass" },
  { icon: "📋", label: "Leave", path: "/student/leave" },
  { icon: "📋", label: "Attendance", path: "/student/attendance" },
  { icon: "💰", label: "Fees", path: "/student/fees" },
  { icon: "📅", label: "Timetable", path: "/student/timetable" },
  { icon: "💼", label: "Placements", path: "/student/placements" },
  { icon: "📢", label: "Alerts", path: "/student/alerts" },
  { icon: "📝", label: "Complaints", path: "/student/complaints" },
  { icon: "⚠️", label: "Fines", path: "/student/fines" },
  { icon: "👤", label: "Profile", path: "/student/profile" }
];

const staffNav = [
  { icon: "🏠", label: "Dashboard", path: "/staff" },
  { icon: "🚪", label: "Gate Pass", path: "/staff/gatepass" },
  { icon: "📋", label: "Leave", path: "/staff/leave" },
  { icon: "✅", label: "Attendance", path: "/staff/attendance" },
  { icon: "🧧", label: "Results", path: "/staff/results" },
  { icon: "📅", label: "Timetable", path: "/staff/timetable" },
  { icon: "💼", label: "Placements", path: "/staff/placements" },
  { icon: "📢", label: "Alerts", path: "/staff/alerts" },
  { icon: "📝", label: "Complaints", path: "/staff/complaints" },
  { icon: "⚠️", label: "Fines", path: "/staff/fines" },
  { icon: "👤", label: "Profile", path: "/staff/profile" }
];

const hodNav = [
  { icon: "🏠", label: "Dashboard", path: "/hod" },
  { icon: "📋", label: "Leave", path: "/hod/leave" },
  { icon: "🧧", label: "Results", path: "/hod/results" },
  { icon: "📅", label: "Timetable", path: "/hod/timetable" },
  { icon: "💼", label: "Placements", path: "/hod/placements" },
  { icon: "📢", label: "Alerts", path: "/hod/alerts" },
  { icon: "⚠️", label: "Verify Fines", path: "/hod/fines" },
  { icon: "👤", label: "Profile", path: "/hod/profile" }
];

const wardenNav = [
  { icon: "🏠", label: "Dashboard", path: "/warden" },
  { icon: "🚪", label: "Gate Pass Records", path: "/warden/gatepass" },
  { icon: "👥", label: "Student Details", path: "/warden/students" },
  { icon: "📋", label: "Attendance", path: "/warden/attendance" },
  { icon: "📢", label: "Alerts", path: "/warden/alerts" },
  { icon: "👤", label: "Profile", path: "/warden/profile" }
];

const officestaffNav = [
  { icon: "🏠", label: "Dashboard", path: "/officestaff" },
  { icon: "💰", label: "Fees Collection", path: "/officestaff/fees" },
  { icon: "📊", label: "Fees Overview", path: "/officestaff/overview" },
  { icon: "📢", label: "Fees Alerts", path: "/officestaff/alerts" },
  { icon: "⏳", label: "Verify Fees", path: "/officestaff/verify-fees" },
  { icon: "👤", label: "Profile", path: "/officestaff/profile" }
];

const managementNav = [
  { icon: "🏠", label: "Dashboard", path: "/management" },
  { icon: "🚪", label: "Gate Passes", path: "/management/gatepass" },
  { icon: "📋", label: "Attendance", path: "/management/attendance" },
  { icon: "💰", label: "Fees", path: "/management/fees" },
  { icon: "🍽️", label: "Mess", path: "/management/mess" },
  { icon: "🏨", label: "Hostel", path: "/management/hostel" },
  { icon: "📢", label: "Alerts", path: "/management/alerts" },
  { icon: "📝", label: "Complaints", path: "/management/complaints" },
  { icon: "👤", label: "Profile", path: "/management/profile" },
  { path: "/campus-map", label: "Campus Map", icon: "🗺️" }
];

const securityNav = [
  { icon: "V", label: "Verify Gate Pass", path: "/security/verify" },
  { icon: "P", label: "Profile", path: "/security/profile" }
];

const principalNav = [
  { icon: "🏠", label: "Dashboard", path: "/principal" },
  { icon: "🚪", label: "Gate Pass", path: "/principal/gatepass" },
  { icon: "📋", label: "Leave Requests", path: "/principal/leave" },
  { icon: "📢", label: "Circulars", path: "/principal/alerts" },
  { icon: "👤", label: "Profile", path: "/principal/profile" }
];

const adminNav = [
  { icon: "⚡", label: "Dashboard", path: "/admin" },
  { icon: "👤", label: "Profile", path: "/admin/profile" }
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
    student: "#e94560",
    staff: "#f5a623",
    hod: "#48bb78",
    warden: "#4299e1",
    officestaff: "#48bb78",
    security: "#e94560",
    management: "#9f7aea",
    principal: "#805ad5",
    admin: "#e53e3e"
  };
  const color = isSuperAdmin ? "#e53e3e" : (roleColors[role] || "#e94560");

  const sidebarContent = (
    <>
      <div className="sidebar-logo">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2>🎓 College Portal</h2>
            <p style={{ color }}>{isSuperAdmin ? "SUPER ADMIN" : role?.toUpperCase()} PANEL</p>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="sidebar-close-btn"
            style={{
              display: "none",
              background: "transparent",
              border: "none",
              color: "white",
              fontSize: 24,
              cursor: "pointer",
              padding: 4
            }}
          >✕</button>
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
            {isSuperAdmin ? "⚡ Super Admin" : (userProfile?.dept ? `${userProfile.dept} • ${role}` : role)}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button 
            className="btn-theme"
            style={{ flex: 1, padding: "10px", margin: 0, fontSize: "14px" }} 
            onClick={() => handleNavClick(isSuperAdmin ? "/admin/profile" : `/${role}/profile`)}
          >
            👤 Profile
          </button>
          <button 
            className="btn-logout" 
            style={{ flex: 1, margin: 0, padding: "10px", fontSize: "14px", marginTop: 0 }} 
            onClick={handleLogout}
          >
            🚪 Logout
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
