// src/pages/officestaff/Dashboard.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  CreditCard,
  PieChart,
  Bell,
  Clock,
  User,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight
} from "lucide-react";

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
      const studQ = query(collection(db, "users"), where("role", "==", "student"));
      const studSnap = await getDocs(studQ);
      const totalStudents = studSnap.size;

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
    { icon: <CreditCard size={28} color="#10b981" />, label: "Fees Collection", path: "/officestaff/fees" },
    { icon: <PieChart size={28} color="#3b82f6" />, label: "Fees Overview", path: "/officestaff/overview" },
    { icon: <Bell size={28} color="#f59e0b" />, label: "Fees Alerts", path: "/officestaff/alerts" },
    { icon: <Clock size={28} color="#ef4444" />, label: "Verify Fees", path: "/officestaff/verify-fees", badge: stats.pendingFeesCount },
    { icon: <User size={28} color="#8b5cf6" />, label: "Profile", path: "/officestaff/profile" }
  ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <DateTimeHeader />
        <div className="page-header">
          <h1>Office Staff Dashboard</h1>
          <p>Fees & Accounts — {userProfile?.name}</p>
        </div>

        {/* Live Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Users size={24} color="#8b5cf6" />
            </div>
            <div className="stat-value">{loading ? "..." : stats.totalStudents}</div>
            <div className="stat-label">Total Students</div>
          </div>

          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/officestaff/overview")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <CheckCircle2 size={24} color="#10b981" />
            </div>
            <div className="stat-value" style={{ color: "var(--success)" }}>{loading ? "..." : stats.totalCollected}</div>
            <div className="stat-label">Fees Collected</div>
          </div>

          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/officestaff/alerts")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Clock size={24} color="#ef4444" />
            </div>
            <div className="stat-value" style={{ color: stats.totalPending > 0 ? "var(--danger)" : "var(--success)" }}>
              {loading ? "..." : stats.totalPending}
            </div>
            <div className="stat-label">Fees Pending</div>
          </div>

          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <PieChart size={24} color="#3b82f6" />
            </div>
            <div className="stat-value" style={{ color: stats.collectionRate >= 75 ? "var(--success)" : stats.collectionRate >= 50 ? "var(--warning)" : "var(--danger)" }}>
              {loading ? "..." : `${stats.collectionRate}%`}
            </div>
            <div className="stat-label">Collection Rate</div>
          </div>
        </div>

        {/* Alert for pending fees verification */}
        {!loading && stats.pendingFeesCount > 0 && (
          <div style={{ 
            padding: "14px 20px", borderRadius: "var(--radius-md)", marginBottom: 24, 
            background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", 
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <AlertTriangle size={20} color="var(--warning)" />
              <div style={{ color: "var(--warning)", fontWeight: 600 }}>{stats.pendingFeesCount} student fee payments pending verification!</div>
            </div>
            <button className="btn-primary" onClick={() => navigate("/officestaff/verify-fees")} style={{ width: "auto", padding: "6px 16px", fontSize: 13, background: "var(--warning)" }}>
              Verify Now <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Quick Actions */}
        <div className="card">
          <h3 style={{ marginBottom: 20, fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>Quick Actions</h3>
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
                  position: "relative",
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
                {action.badge > 0 && (
                  <div style={{ position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: "50%", background: "var(--danger)", color: "white", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {action.badge}
                  </div>
                )}
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