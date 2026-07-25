// src/pages/principal/Dashboard.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { DoorOpen, ClipboardList, Bell } from "lucide-react";

export default function PrincipalDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    pendingLeaves: 0,
    activeCirculars: 0,
    pendingGatePasses: 0
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const qLeaves = query(collection(db, "leave_requests"), where("status", "==", "pending_principal"));
        const snapLeaves = await getDocs(qLeaves);

        const qAlerts = query(collection(db, "alerts"), where("createdById", "==", userProfile.uid));
        const snapAlerts = await getDocs(qAlerts);

        const qGatePasses = query(collection(db, "gate_pass"), where("status", "==", "pending_principal"));
        const snapGatePasses = await getDocs(qGatePasses);
        
        setStats({
          pendingLeaves: snapLeaves.size,
          activeCirculars: snapAlerts.size,
          pendingGatePasses: snapGatePasses.size
        });
      } catch (err) {}
    }
    fetchStats();
  }, []);

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <DateTimeHeader />
        <div className="page-header">
          <h1>Principal Dashboard</h1>
          <p>Institutional Administration — {userProfile?.name}</p>
        </div>

        <div className="stats-grid" style={{ marginTop: 24, marginBottom: 32 }}>
          <div className="stat-card" onClick={() => navigate("/principal/gatepass")} style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <DoorOpen size={24} color="#8b5cf6" />
            </div>
            <div className="stat-value" style={{ color: "#8b5cf6" }}>{stats.pendingGatePasses}</div>
            <div className="stat-label">Gate Passes Forwarded</div>
          </div>
          <div className="stat-card" onClick={() => navigate("/principal/leave")} style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <ClipboardList size={24} color="#8b5cf6" />
            </div>
            <div className="stat-value" style={{ color: "#8b5cf6" }}>{stats.pendingLeaves}</div>
            <div className="stat-label">Leaves Pending Approval</div>
          </div>
          <div className="stat-card" onClick={() => navigate("/principal/alerts")} style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Bell size={24} color="#3b82f6" />
            </div>
            <div className="stat-value" style={{ color: "#3b82f6" }}>{stats.activeCirculars}</div>
            <div className="stat-label">Active Circulars</div>
          </div>
        </div>
      </main>
    </div>
  );
}
