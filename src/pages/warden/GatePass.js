// src/pages/warden/GatePass.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, getDocs } from "firebase/firestore";

const statusInfo = {
  pending_staff: { label: "Waiting for Staff", color: "#f6ad55" },
  pending_hod: { label: "Waiting for HOD", color: "#4299e1" },
  approved: { label: "Approved ✅", color: "#48bb78" },
  rejected: { label: "Rejected ❌", color: "#fc8181" }
};

export default function WardenGatePass() {
  const { userProfile } = useAuth();
  const [passes, setPasses] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  async function fetchPasses() {
    setFetching(true);
    try {
      // All departments — warden pakkuvan
      const snap = await getDocs(collection(db, "gate_pass"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setPasses(list);
    } catch (err) {}
    setFetching(false);
  }

  useEffect(() => { fetchPasses(); }, []);

  const filtered = passes
    .filter(p => filter === "all" || p.status === filter)
    .filter(p =>
      p.studentName?.toLowerCase().includes(search.toLowerCase()) ||
      p.registerNo?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>🚪 Gate Pass Records</h1>
          <p>All Departments — View Only</p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-value">{passes.length}</div>
            <div className="stat-label">Total Requests</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value" style={{ color: "#48bb78" }}>{passes.filter(p => p.status === "approved").length}</div>
            <div className="stat-label">Approved</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-value" style={{ color: "#f6ad55" }}>{passes.filter(p => p.status === "pending_staff" || p.status === "pending_hod").length}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">❌</div>
            <div className="stat-value" style={{ color: "#fc8181" }}>{passes.filter(p => p.status === "rejected").length}</div>
            <div className="stat-label">Rejected</div>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Search Student</label>
            <input
              type="text"
              placeholder="Search by name or register no..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {["all", "approved", "pending_staff", "pending_hod", "rejected"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "8px 18px", borderRadius: 10, border: "none",
              cursor: "pointer", fontFamily: "Syne", fontWeight: 600, fontSize: 13,
              background: filter === f ? "#e94560" : "rgba(255,255,255,0.07)",
              color: "white", transition: "all 0.2s"
            }}>
              {f === "all" ? `All (${passes.length})` : statusInfo[f]?.label}
            </button>
          ))}
        </div>

        {fetching ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div className="spinner" style={{ margin: "0 auto" }}></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <p style={{ color: "#a0aec0" }}>No gate pass records found.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filtered.map(pass => (
              <div key={pass.id} className="card" style={{ borderLeft: `4px solid ${statusInfo[pass.status]?.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{pass.studentName}</div>
                    <div style={{ color: "#a0aec0", fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
                      <span>🎓 {pass.registerNo} • {pass.year} • {pass.dept}</span>
                      <span>📋 {pass.reason}</span>
                      <span>📍 {pass.place}</span>
                      <span>🕐 Out: {pass.outDate} {pass.outTime} → In: {pass.inDate} {pass.inTime}</span>
                      {pass.phone && <span>📞 {pass.phone}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{
                      padding: "6px 14px", borderRadius: 20,
                      background: `${statusInfo[pass.status]?.color}20`,
                      color: statusInfo[pass.status]?.color,
                      fontSize: 13, fontWeight: 600
                    }}>
                      {statusInfo[pass.status]?.label}
                    </div>
                    {pass.token && (
                      <div style={{ marginTop: 8, padding: "8px 14px", background: "rgba(72,187,120,0.1)", border: "1px solid rgba(72,187,120,0.3)", borderRadius: 10, textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 2 }}>TOKEN</div>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "Syne", color: "#48bb78", letterSpacing: 3 }}>{pass.token}</div>
                      </div>
                    )}
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