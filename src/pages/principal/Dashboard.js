// src/pages/principal/Dashboard.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function PrincipalDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    pendingLeaves: 0,
    activeCirculars: 0
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const qLeaves = query(collection(db, "leave_requests"), where("status", "==", "pending_principal"));
        const snapLeaves = await getDocs(qLeaves);

        const qAlerts = query(collection(db, "alerts"), where("createdById", "==", userProfile.uid));
        const snapAlerts = await getDocs(qAlerts);
        
        setStats({
          pendingLeaves: snapLeaves.size,
          activeCirculars: snapAlerts.size
        });
      } catch (err) {}
    }
    fetchStats();
  }, []);

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>🏛️ Principal Dashboard</h1>
          <p>Welcome back, {userProfile?.name}</p>
        </div>

        <div className="stats-grid" style={{ marginTop: 24, marginBottom: 32 }}>
          <div className="stat-card" onClick={() => navigate("/principal/leave")} style={{ cursor: "pointer", border: "1px solid rgba(128,90,213,0.3)", boxShadow: "0 10px 25px rgba(128,90,213,0.15)" }}>
            <div className="stat-icon">📋</div>
            <div className="stat-value" style={{ color: "#805ad5" }}>{stats.pendingLeaves}</div>
            <div className="stat-label">Leaves Pending Approval</div>
          </div>
          <div className="stat-card" onClick={() => navigate("/principal/alerts")} style={{ cursor: "pointer", border: "1px solid rgba(66,153,225,0.3)", boxShadow: "0 10px 25px rgba(66,153,225,0.15)" }}>
            <div className="stat-icon">📢</div>
            <div className="stat-value" style={{ color: "#4299e1" }}>{stats.activeCirculars}</div>
            <div className="stat-label">Your Active Circulars</div>
          </div>
        </div>
      </main>
    </div>
  );
}
