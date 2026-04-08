// src/pages/ManagementDashboard.js
import React from "react";

export default function ManagementDashboard() {
  return (
    <div style={{ padding: 24, minHeight: "100vh", background: "#0f172a", color: "white" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "Syne", fontSize: 42, marginBottom: 8 }}>College Management</h1>
          <p style={{ color: "#94a3b8", maxWidth: 720 }}>You have management-level access. Use the URL bar or sidebar to visit any module and manage the portal.</p>
        </div>
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ padding: 20, borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 style={{ marginBottom: 10 }}>Full portal control</h2>
            <p style={{ color: "#cbd5e1" }}>Your role can access page routes across all portal sections, including student, staff, HOD, security, warden, and office staff areas.</p>
          </div>
          <div style={{ padding: 20, borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 style={{ marginBottom: 10 }}>Useful links</h2>
            <ul style={{ color: "#cbd5e1", paddingLeft: 20, margin: 0 }}>
              <li>Student dashboard: /student</li>
              <li>Staff dashboard: /staff</li>
              <li>HOD dashboard: /hod</li>
              <li>Security verify: /security/verify</li>
              <li>Office staff fees: /officestaff/fees</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
