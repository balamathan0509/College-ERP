// src/pages/ManagementDashboard.js
import React from "react";

export default function ManagementDashboard() {
  return (
    <div style={{ padding: 24, minHeight: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>College Management</h1>
          <p style={{ color: "#64748b", maxWidth: 720 }}>You have management-level access. Use the URL bar or sidebar to visit any module and manage the portal.</p>
        </div>
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ padding: 20, borderRadius: 12, background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <h2 style={{ marginBottom: 10, fontSize: 18, color: "#1e293b" }}>Full portal control</h2>
            <p style={{ color: "#475569" }}>Your role can access page routes across all portal sections, including student, staff, HOD, security, warden, and office staff areas.</p>
          </div>
          <div style={{ padding: 20, borderRadius: 12, background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <h2 style={{ marginBottom: 10, fontSize: 18, color: "#1e293b" }}>Useful links</h2>
            <ul style={{ color: "#2563eb", paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
              <li><a href="/student" style={{ color: "#2563eb" }}>Student dashboard: /student</a></li>
              <li><a href="/staff" style={{ color: "#2563eb" }}>Staff dashboard: /staff</a></li>
              <li><a href="/hod" style={{ color: "#2563eb" }}>HOD dashboard: /hod</a></li>
              <li><a href="/security/verify" style={{ color: "#2563eb" }}>Security verify: /security/verify</a></li>
              <li><a href="/officestaff/fees" style={{ color: "#2563eb" }}>Office staff fees: /officestaff/fees</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
