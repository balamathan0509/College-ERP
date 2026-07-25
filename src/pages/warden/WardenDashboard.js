// src/pages/warden/WardenDashboard.js
import React from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { DoorOpen, Users, CheckSquare, Bell, UserX } from "lucide-react";

export default function WardenDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const quickActions = [
    { icon: <DoorOpen size={28} color="#3b82f6" />, label: "Gate Pass Records", path: "/warden/gatepass" },
    { icon: <Users size={28} color="#8b5cf6" />, label: "Student Details", path: "/warden/students" },
    { icon: <CheckSquare size={28} color="#10b981" />, label: "Attendance View", path: "/warden/attendance" },
    { icon: <Bell size={28} color="#f59e0b" />, label: "Alerts & Circulars", path: "/warden/alerts" }
  ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <DateTimeHeader />
        <div className="page-header">
          <h1>Hostel Warden Dashboard</h1>
          <p>Hostel Administration — {userProfile?.name || "Warden"}</p>
        </div>

        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <DoorOpen size={24} color="#3b82f6" />
            </div>
            <div className="stat-value">--</div>
            <div className="stat-label">Gate Passes Today</div>
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Users size={24} color="#8b5cf6" />
            </div>
            <div className="stat-value">--</div>
            <div className="stat-label">Total Hostellers</div>
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <UserX size={24} color="#ef4444" />
            </div>
            <div className="stat-value">--</div>
            <div className="stat-label">Absent Today</div>
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Bell size={24} color="#f59e0b" />
            </div>
            <div className="stat-value">--</div>
            <div className="stat-label">New Notifications</div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 20, fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>Quick Access</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
            {quickActions.map((action) => (
              <div
                key={action.path}
                onClick={() => navigate(action.path)}
                style={{
                  padding: "24px 16px", 
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  background: "rgba(11, 19, 43, 0.4)",
                  cursor: "pointer", 
                  textAlign: "center", 
                  transition: "all 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
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
                <div style={{ marginBottom: 12 }}>{action.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{action.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}