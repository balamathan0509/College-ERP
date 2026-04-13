// src/pages/hod/Results.js
import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";

export default function HodResults() {
  const { userProfile } = useAuth();
  const [tab, setTab] = useState("pending");
  const [pendingResults, setPendingResults] = useState([]);
  const [approvedResults, setApprovedResults] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [toast, setToast] = useState(null);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  const fetchResults = useCallback(async () => {
    if (!userProfile?.dept) return;
    setFetching(true);
    try {
      // Pending HOD approval
      const q1 = query(
        collection(db, "exam_results"),
        where("dept", "==", userProfile.dept),
        where("status", "==", "pending_hod")
      );
      const snap1 = await getDocs(q1);
      const pending = snap1.docs.map(d => ({ id: d.id, ...d.data() }));
      pending.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setPendingResults(pending);

      // Verified
      const q2 = query(
        collection(db, "exam_results"),
        where("dept", "==", userProfile.dept),
        where("status", "==", "verified")
      );
      const snap2 = await getDocs(q2);
      const approved = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      approved.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setApprovedResults(approved);
    } catch (err) {
      showToast("Failed to fetch results.", "error");
    }
    setFetching(false);
  }, [userProfile]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  async function handleAction(item, action) {
    setActionLoading(item.id + action);
    try {
      await updateDoc(doc(db, "exam_results", item.id), {
        status: action === "verify" ? "verified" : "rejected",
        hodActionAt: new Date().toISOString(),
        hodName: userProfile.name
      });
      showToast(action === "verify"
        ? `✅ Results for ${item.subjectName} verified!`
        : `❌ Results for ${item.subjectName} rejected.`
      );
      setPendingResults(prev => prev.filter(p => p.id !== item.id));
      fetchResults();
    } catch (err) {
      showToast("Failed to update result status.", "error");
    }
    setActionLoading("");
  }

  function toggleExpand(id) {
    setExpandedId(prev => prev === id ? null : id);
  }

  function renderMarksTable(marks) {
    if (!marks) return null;
    const entries = Object.entries(marks);
    entries.sort((a, b) => (a[1].name || "").localeCompare(b[1].name || ""));

    return (
      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {["S.No", "Student Name", "Register No", "Mark", "Result"].map(h => (
                <th key={h} style={{
                  padding: "10px 14px", textAlign: "left", fontSize: 11,
                  color: "#a0aec0", textTransform: "uppercase", letterSpacing: 1,
                  fontWeight: 600, fontFamily: "'DM Sans', sans-serif"
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(([, data], idx) => (
              <tr key={idx} style={{
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                background: data.result === "Fail" ? "rgba(252,129,129,0.05)" : "transparent"
              }}>
                <td style={{ padding: "10px 14px", fontSize: 13, color: "#a0aec0" }}>{idx + 1}</td>
                <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 14, color: "white" }}>{data.name}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, color: "#a0aec0" }}>{data.registerNo || "—"}</td>
                <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 14, color: "white" }}>{data.mark}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{
                    padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: data.result === "Pass" ? "rgba(72,187,120,0.15)" : "rgba(252,129,129,0.15)",
                    color: data.result === "Pass" ? "#48bb78" : "#fc8181"
                  }}>
                    {data.result === "Pass" ? "✅ Pass" : "❌ Fail"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderResultCard(item, showActions) {
    const isExpanded = expandedId === item.id;
    return (
      <div key={item.id} className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 20 }}>{item.examType === "Internal" ? "📝" : "🎓"}</span>
              <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 17 }}>
                {item.subjectName} ({item.subjectCode})
              </div>
              <span style={{
                padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: item.examType === "Internal" ? "rgba(127,156,245,0.15)" : "rgba(159,122,234,0.15)",
                color: item.examType === "Internal" ? "#7f9cf5" : "#9f7aea"
              }}>{item.examType}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>YEAR</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.year}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>SUBMITTED BY</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>👨‍🏫 {item.staffName}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>STUDENTS</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.totalStudents}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>PASS / FAIL</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  <span style={{ color: "#48bb78" }}>{item.passCount}</span> / <span style={{ color: "#fc8181" }}>{item.failCount}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>DATE</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{new Date(item.createdAt).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Expand/Collapse */}
            <button
              onClick={() => toggleExpand(item.id)}
              style={{
                marginTop: 14, padding: "8px 18px", borderRadius: 8,
                border: "1px solid rgba(127,156,245,0.3)",
                background: isExpanded ? "rgba(127,156,245,0.15)" : "rgba(255,255,255,0.05)",
                color: "#7f9cf5", fontSize: 13, fontWeight: 700, cursor: "pointer"
              }}
            >
              {isExpanded ? "🔼 Hide Marks" : "🔽 View All Marks"}
            </button>

            {isExpanded && renderMarksTable(item.marks)}
          </div>

          {showActions && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 180 }}>
              <button onClick={() => handleAction(item, "verify")} disabled={!!actionLoading} style={{
                padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(72,187,120,0.3)",
                background: "rgba(72,187,120,0.15)", color: "#48bb78", fontWeight: 700, fontSize: 14, cursor: "pointer"
              }}>
                {actionLoading === item.id + "verify" ? "..." : "✅ Verify Results"}
              </button>
              <button onClick={() => handleAction(item, "reject")} disabled={!!actionLoading} style={{
                padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(252,129,129,0.3)",
                background: "rgba(252,129,129,0.1)", color: "#fc8181", fontWeight: 700, fontSize: 14, cursor: "pointer"
              }}>
                {actionLoading === item.id + "reject" ? "..." : "❌ Reject"}
              </button>
            </div>
          )}

          {!showActions && (
            <div>
              <span style={{
                padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: "rgba(72,187,120,0.15)", color: "#48bb78"
              }}>
                ✅ Verified
              </span>
              {item.hodActionAt && (
                <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 6, textAlign: "right" }}>
                  {new Date(item.hodActionAt).toLocaleDateString()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        {/* Toast */}
        {toast && (
          <div style={{
            position: "fixed", top: 24, right: 24, zIndex: 3000,
            padding: "14px 24px", borderRadius: 14,
            background: toast.type === "error" ? "rgba(252,129,129,0.95)" : "rgba(72,187,120,0.95)",
            color: "white", fontWeight: 600, fontSize: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            animation: "slideIn 0.3s ease", maxWidth: 420
          }}>
            {toast.message}
          </div>
        )}

        <div className="page-header">
          <h1>🧧 Results Verification</h1>
          <p>{userProfile?.dept} Department — HOD Panel</p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-value" style={{ color: "#f5a623" }}>{pendingResults.length}</div>
            <div className="stat-label">Pending Review</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value" style={{ color: "#48bb78" }}>{approvedResults.length}</div>
            <div className="stat-label">Verified</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          {[
            { key: "pending", label: `⏳ Pending Review (${pendingResults.length})` },
            { key: "approved", label: `✅ Verified (${approvedResults.length})` }
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer",
              fontFamily: "Syne", fontWeight: 600, fontSize: 14,
              background: tab === t.key ? "#48bb78" : "rgba(255,255,255,0.07)",
              color: "white", transition: "all 0.2s"
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Pending Tab */}
        {tab === "pending" && (
          fetching ? (
            <div style={{ textAlign: "center", padding: 60 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
          ) : pendingResults.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <p style={{ color: "#a0aec0" }}>No pending result submissions to review.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {pendingResults.map(item => renderResultCard(item, true))}
            </div>
          )
        )}

        {/* Verified Tab */}
        {tab === "approved" && (
          fetching ? (
            <div style={{ textAlign: "center", padding: 60 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
          ) : approvedResults.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
              <p style={{ color: "#a0aec0" }}>No verified results yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {approvedResults.map(item => renderResultCard(item, false))}
            </div>
          )
        )}

        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>
      </main>
    </div>
  );
}
