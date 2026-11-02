import React from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, Calendar } from "lucide-react";

export default function DeptAdminDashboard() {
  return (
    <div className="dashboard-container">
      <div className="dashboard-header" style={{ background: "#1e3a8a", padding: "20px", color: "white", borderRadius: "8px", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
          <LayoutDashboard size={24} /> Department Admin Dashboard
        </h2>
        <p style={{ margin: "5px 0 0 0", opacity: 0.8 }}>Manage Department Timetable</p>
      </div>

      <div className="dashboard-grid">
        <Link to="/dept-admin/timetable" style={{ textDecoration: "none" }}>
          <div className="dashboard-card" style={{ padding: "24px", border: "1px solid var(--border)", borderRadius: "8px", background: "white", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", transition: "transform 0.2s" }}>
            <Calendar size={48} color="var(--primary)" />
            <h3 style={{ margin: 0, color: "var(--text)" }}>Timetable Management</h3>
            <p style={{ margin: 0, color: "var(--text-muted)", textAlign: "center" }}>Create and edit class timetables, assign staff and subjects.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
