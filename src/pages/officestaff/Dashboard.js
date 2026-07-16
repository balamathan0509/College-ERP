// src/pages/officestaff/Dashboard.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function OfficeStaffDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalCollected: 0,
    totalPending: 0,
    collectionRate: 0,
    pendingFeesCount: 0
  });
  const [loading, setLoading] = useState(true);

  async function fetchStats() {
    try {
      // All students
      const studQ = query(collection(db, "users"), where("role", "==", "student"));
      const studSnap = await getDocs(studQ);
      const totalStudents = studSnap.size;

      // All fees records
      const feesSnap = await getDocs(collection(db, "fees"));
      let totalCollected = 0;
      let totalPending = 0;

      feesSnap.docs.forEach(d => {
        const payments = d.data().payments || {};
        totalCollected += Object.values(payments).filter(Boolean).length;
        totalPending += Object.values(payments).filter(v => !v).length;
      });

      const total = totalCollected + totalPending;
      const collectionRate = total ? Math.round((totalCollected / total) * 100) : 0;

      // Pending fees verification count
      let pendingFeesCount = 0;
      feesSnap.docs.forEach(doc => {
        const payments = doc.data().payments || {};
        Object.values(payments).forEach(p => {
          if (p && typeof p === "object" && p.status === "pending") {
            pendingFeesCount++;
          }
        });
      });

      setStats({ totalStudents, totalCollected, totalPending, collectionRate, pendingFeesCount });
    } catch (err) {}
    setLoading(false);
  }

  useEffect(() => { if (userProfile) fetchStats(); }, [userProfile]);

  const quickActions = [
    { icon: "💰", label: "Fees Collection", path: "/officestaff/fees", color: "#48bb78" },
    { icon: "📊", label: "Fees Overview", path: "/officestaff/overview", color: "#4299e1" },
    { icon: "📢", label: "Fees Alerts", path: "/officestaff/alerts", color: "#f5a623" },
    { icon: "⏳", label: "Verify Fees", path: "/officestaff/verify-fees", color: "#fc8181", badge: stats.pendingFeesCount },
    { icon: "👤", label: "Profile", path: "/officestaff/profile", color: "#9f7aea" }
  ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <DateTimeHeader />
        <div className="page-header">
          <h1>🏢 Office Staff Dashboard</h1>
          <p>Fees Management — {userProfile?.name}</p>
        </div>

        {/* Live Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{loading ? "..." : stats.totalStudents}</div>
            <div className="stat-label">Total Students</div>
          </div>

          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/officestaff/overview")}>
            <div className="stat-icon">✅</div>
            <div className="stat-value" style={{ color: "#48bb78" }}>{loading ? "..." : stats.totalCollected}</div>
            <div className="stat-label">Fees Collected</div>
          </div>

          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/officestaff/alerts")}>
            <div className="stat-icon">⏳</div>
            <div className="stat-value" style={{ color: stats.totalPending > 0 ? "#fc8181" : "#48bb78" }}>
              {loading ? "..." : stats.totalPending}
            </div>
            <div className="stat-label">Fees Pending</div>
            {!loading && stats.totalPending > 0 && <div style={{ fontSize: 11, color: "#fc8181", marginTop: 4 }}>Send alerts!</div>}
          </div>

          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-value" style={{ color: stats.collectionRate >= 75 ? "#48bb78" : stats.collectionRate >= 50 ? "#f5a623" : "#fc8181" }}>
              {loading ? "..." : `${stats.collectionRate}%`}
            </div>
            <div className="stat-label">Collection Rate</div>
          </div>
        </div>

        {/* Alert for pending */}
        {!loading && stats.totalPending > 0 && (
          <div style={{ padding: "14px 20px", borderRadius: 12, marginBottom: 24, background: "rgba(252,129,129,0.1)", border: "1px solid rgba(252,129,129,0.3)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20 }}>💰</span>
              <div style={{ color: "#fc8181", fontWeight: 600 }}>{stats.totalPending} pending fee payments! Send alerts to students.</div>
            </div>
            <button onClick={() => navigate("/officestaff/alerts")} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#e94560", color: "white", fontWeight: 600, cursor: "pointer" }}>Send Alerts →</button>
          </div>
        )}

        {/* Alert for pending fees */}
        {!loading && stats.pendingFeesCount > 0 && (
          <div style={{ 
            padding: "14px 20px", borderRadius: 12, marginBottom: 24, 
            background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)", 
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div style={{ color: "#f5a623", fontWeight: 600 }}>{stats.pendingFeesCount} student fee payments pending verification!</div>
            </div>
            <button onClick={() => navigate("/officestaff/verify-fees")} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#f5a623", color: "white", fontWeight: 600, cursor: "pointer" }}>Verify Now →</button>
          </div>
        )}

        {/* Quick Actions */}
        <div className="card">
          <h3 style={{ marginBottom: 20, fontFamily: "Syne", fontSize: 18 }}>Quick Actions</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
            {quickActions.map((action) => (
              <div key={action.path} onClick={() => navigate(action.path)} style={{
                padding: "24px 16px", borderRadius: 14,
                border: `1px solid ${action.color}30`,
                background: `${action.color}10`,
                cursor: "pointer", textAlign: "center", transition: "all 0.2s",
                position: "relative"
              }}
                onMouseOver={e => e.currentTarget.style.transform = "translateY(-3px)"}
                onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                {action.badge > 0 && (
                  <div style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", background: "#fc8181", color: "white", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {action.badge}
                  </div>
                )}
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