// src/pages/warden/Alerts.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";

export default function WardenAlerts() {
  const { userProfile } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [fetching, setFetching] = useState(true);

  async function fetchAlerts() {
    setFetching(true);
    try {
      const q = query(
        collection(db, "alerts"),
        where("dept", "in", [userProfile.dept, "all"])
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAlerts(list);
    } catch (err) {}
    setFetching(false);
  }

  useEffect(() => { fetchAlerts(); }, []);

  const typeColors = {
    leave: "#f5a623",
    circular: "#4299e1",
    announcement: "#48bb78",
    urgent: "#e94560"
  };

  const typeIcons = {
    leave: "🏖️",
    circular: "📄",
    announcement: "📢",
    urgent: "🚨"
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>📢 Alerts & Circulars</h1>
          <p>{userProfile?.dept} Department — View Only</p>
        </div>

        {fetching ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div className="spinner" style={{ margin: "0 auto" }}></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <p style={{ color: "#a0aec0" }}>No alerts yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {alerts.map(alert => (
              <div key={alert.id} className="card" style={{ borderLeft: `4px solid ${typeColors[alert.type] || "#a0aec0"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>{typeIcons[alert.type] || "📢"}</span>
                      <span style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16 }}>{alert.title}</span>
                      <span style={{
                        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: `${typeColors[alert.type] || "#a0aec0"}20`,
                        color: typeColors[alert.type] || "#a0aec0"
                      }}>{alert.type?.toUpperCase()}</span>
                    </div>
                    <p style={{ color: "#cbd5e0", fontSize: 14, lineHeight: 1.6 }}>{alert.message}</p>
                    <div style={{ color: "#a0aec0", fontSize: 12, marginTop: 8 }}>
                      Posted by {alert.postedBy} • {alert.createdAt ? new Date(alert.createdAt).toLocaleDateString() : ""}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}