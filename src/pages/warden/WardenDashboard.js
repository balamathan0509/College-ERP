// src/pages/warden/WardenDashboard.js
import React from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function WardenDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const quickActions = [
    { icon: "🚪", label: "Gate Pass Records", path: "/warden/gatepass", color: "#e94560" },
    { icon: "👥", label: "Student Details", path: "/warden/students", color: "#4299e1" },
    { icon: "📋", label: "Attendance View", path: "/warden/attendance", color: "#f5a623" },
    { icon: "📢", label: "Alerts & Circulars", path: "/warden/alerts", color: "#48bb78" }
  ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <DateTimeHeader />
        <div className="page-header">
          <h1>🏠 Warden Dashboard</h1>
          <p>{userProfile?.dept} Department</p>
        </div>

        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div className="stat-icon">🚪</div>
            <div className="stat-value">--</div>
            <div className="stat-label">Gate Passes Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">--</div>
            <div className="stat-label">Total Students</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">❌</div>
            <div className="stat-value">--</div>
            <div className="stat-label">Absent Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📢</div>
            <div className="stat-value">--</div>
            <div className="stat-label">New Alerts</div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 20, fontFamily: "Syne", fontSize: 18 }}>Quick Access</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
            {quickActions.map((action) => (
              <div
                key={action.path}
                onClick={() => navigate(action.path)}
                style={{
                  padding: "24px 16px", borderRadius: 14,
                  border: `1px solid ${action.color}30`,
                  background: `${action.color}10`,
                  cursor: "pointer", textAlign: "center", transition: "all 0.2s"
                }}
                onMouseOver={e => e.currentTarget.style.transform = "translateY(-3px)"}
                onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                <div style={{ fontSize: 36, marginBottom: 10 }}>{action.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>{action.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}