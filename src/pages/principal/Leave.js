// src/pages/principal/Leave.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { sendEmail } from "../../utils/notifications";

export default function PrincipalLeave() {
  const { userProfile } = useAuth();
  const [tab, setTab] = useState("pending");
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [sortOrder, setSortOrder] = useState("recent");

  async function fetchLeaves() {
    setFetching(true);
    try {
      // Leaves pending Principal approval
      const q1 = query(
        collection(db, "leave_requests"),
        where("status", "==", "pending_principal")
      );
      const snap1 = await getDocs(q1);
      const pending = snap1.docs.map(d => ({ id: d.id, ...d.data() }));
      pending.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setPendingLeaves(pending);

      // Approved leaves by principal (if we want to track them, we can check principalActionAt, but easier to just show all approved for now)
      // Showing all approved leaves across college or just a subset might be overwhelming, but we'll limit to approved here for simple functionality.
      const q3 = query(
        collection(db, "leave_requests"),
        where("status", "==", "approved")
      );
      const snap3 = await getDocs(q3);
      const approved = snap3.docs.map(d => ({ id: d.id, ...d.data() }));
      approved.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Filter locally for leaves that the principal actually touched
      const principalApproved = approved.filter(l => l.principalActionAt);
      setApprovedLeaves(principalApproved);
    } catch (err) {}
    setFetching(false);
  }

  async function handleAction(leave, action) {
    setActionLoading(leave.id + action);
    try {
      await updateDoc(doc(db, "leave_requests", leave.id), {
        status: action === "approve" ? "approved" : "rejected",
        principalActionAt: new Date().toISOString(),
        principalName: userProfile.name
      });

      if (action === "approve") {
        // Email to requester
        if (leave.email) {
          await sendEmail({
            toEmail: leave.email,
            toName: leave.name,
            subject: `✅ Leave Request Approved — ${leave.leaveType}`,
            message: `Hi ${leave.name},

Great news! Your leave request has been finally approved by the Principal (${userProfile.name}).

📋 Leave Type: ${leave.leaveType}
📝 Reason: ${leave.reason}
📅 From: ${leave.fromDate}
📅 To: ${leave.toDate}

Please ensure you complete all pending work before your leave begins.

Regards,
${userProfile.name}
Principal
Renganayagi Varatharaj College of Engineering`
          });
        }
      } else {
        // Rejected — email to requester
        if (leave.email) {
          await sendEmail({
            toEmail: leave.email,
            toName: leave.name,
            subject: `❌ Leave Request Rejected`,
            message: `Hi ${leave.name},

We regret to inform you that your leave request has been rejected by the Principal (${userProfile.name}).

📋 Leave Type: ${leave.leaveType}
📝 Reason: ${leave.reason}
📅 From: ${leave.fromDate}
📅 To: ${leave.toDate}

If you have any questions, please contact the administration office.

Regards,
${userProfile.name}
Principal
Renganayagi Varatharaj College of Engineering`
          });
        }
      }

      setPendingLeaves(prev => prev.filter(p => p.id !== leave.id));
      if (action === "approve" || action === "reject") fetchLeaves();
    } catch (err) {}
    setActionLoading("");
  }

  function getDayCount(from, to) {
    const diff = new Date(to) - new Date(from);
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  useEffect(() => { fetchLeaves(); }, []);

  const sortedPendingLeaves = [...pendingLeaves].sort((a, b) => {
    if (sortOrder === "recent") return new Date(b.createdAt) - new Date(a.createdAt);
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  const sortedApprovedLeaves = [...approvedLeaves].sort((a, b) => {
    if (sortOrder === "recent") return new Date(b.createdAt) - new Date(a.createdAt);
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  function renderLeaveCard(leave) {
    return (
      <div key={leave.id} className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: leave.role === "staff" ? "rgba(245,166,35,0.15)" : "rgba(233,69,96,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  {leave.role === "staff" ? "👨‍🏫" : "🎒"}
                </div>
                <div>
                  <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16 }}>{leave.name}</div>
                  <div style={{ color: "#a0aec0", fontSize: 13 }}>
                    {leave.registerNo ? `${leave.registerNo} • ` : ""}{leave.year ? `${leave.year} • ` : ""}{leave.department}
                    <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 6, background: leave.role === "staff" ? "rgba(245,166,35,0.15)" : "rgba(233,69,96,0.15)", color: leave.role === "staff" ? "#f5a623" : "#e94560", fontSize: 11, fontWeight: 700 }}>{leave.role.toUpperCase()}</span>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: 12, color: "#a0aec0" }}>
                <div>📅 Forwarded on {new Date(leave.hodActionAt || leave.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 16 }}>
              <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>LEAVE TYPE</div><div style={{ fontWeight: 600, fontSize: 14 }}>{leave.leaveType}</div></div>
              <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>REASON</div><div style={{ fontWeight: 600, fontSize: 14 }}>{leave.reason}</div></div>
              <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>FROM</div><div style={{ fontWeight: 600, fontSize: 14 }}>📅 {leave.fromDate}</div></div>
              <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>TO</div><div style={{ fontWeight: 600, fontSize: 14 }}>📅 {leave.toDate}</div></div>
              <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>DURATION</div><div style={{ fontWeight: 600, fontSize: 14 }}>⏱️ {getDayCount(leave.fromDate, leave.toDate)} day(s)</div></div>
              {leave.hodName && <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>FORWARDED BY (HOD)</div><div style={{ fontWeight: 600, fontSize: 14, color: "#48bb78" }}>👑 {leave.hodName}</div></div>}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 180 }}>
            <button onClick={() => handleAction(leave, "approve")} disabled={!!actionLoading} style={{
              padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(72,187,120,0.3)",
              background: "rgba(72,187,120,0.15)", color: "#48bb78", fontWeight: 700, fontSize: 14, cursor: "pointer"
            }}>
              {actionLoading === leave.id + "approve" ? "..." : "✅ Final Approve"}
            </button>
            <button onClick={() => handleAction(leave, "reject")} disabled={!!actionLoading} style={{
              padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(252,129,129,0.3)",
              background: "rgba(252,129,129,0.1)", color: "#fc8181", fontWeight: 700, fontSize: 14, cursor: "pointer"
            }}>
              {actionLoading === leave.id + "reject" ? "..." : "❌ Reject"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>🏛️ Final Leave Approvals</h1>
          <p>Office of the Principal</p>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,0.05)", minWidth: 140 }}>
              <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 6 }}>Pending Reviews</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#805ad5" }}>{pendingLeaves.length}</div>
            </div>
            <div style={{ padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,0.05)", minWidth: 140 }}>
              <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 6 }}>Approved by You</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#48bb78" }}>{approvedLeaves.length}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { key: "pending", label: `⏳ Pending Approvals (${pendingLeaves.length})` },
              { key: "approved", label: `✅ Approved Records (${approvedLeaves.length})` }
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer",
                fontFamily: "Syne", fontWeight: 600, fontSize: 14,
                background: tab === t.key ? "#805ad5" : "rgba(255,255,255,0.07)",
                color: "white", transition: "all 0.2s"
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "pending" && (
          fetching ? (
            <div style={{ textAlign: "center", padding: 60 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
          ) : sortedPendingLeaves.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <p style={{ color: "#a0aec0" }}>All clear! No pending leave requests to approve.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {sortedPendingLeaves.map(leave => renderLeaveCard(leave))}
            </div>
          )
        )}

        {tab === "approved" && (
          fetching ? (
            <div style={{ textAlign: "center", padding: 60 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
          ) : sortedApprovedLeaves.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
              <p style={{ color: "#a0aec0" }}>No approved leave records yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {sortedApprovedLeaves.map(leave => (
                <div key={leave.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 20 }}>{leave.role === "staff" ? "👨‍🏫" : "🎒"}</span>
                        <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16 }}>{leave.name}</div>
                        <span style={{ padding: "2px 10px", borderRadius: 6, background: leave.role === "staff" ? "rgba(245,166,35,0.15)" : "rgba(233,69,96,0.15)", color: leave.role === "staff" ? "#f5a623" : "#e94560", fontSize: 11, fontWeight: 700 }}>{leave.role.toUpperCase()}</span>
                      </div>
                      <div style={{ color: "#a0aec0", fontSize: 13, marginTop: 4 }}>
                        {leave.registerNo ? `${leave.registerNo} • ` : ""}{leave.leaveType} • 📅 {leave.fromDate} to {leave.toDate}
                      </div>
                      <div style={{ color: "#a0aec0", fontSize: 12, marginTop: 6 }}>📝 {leave.reason}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                      <div style={{ padding: "6px 14px", borderRadius: 20, background: "rgba(72,187,120,0.15)", color: "#48bb78", fontSize: 13, fontWeight: 600 }}>
                        ✅ Final Approved
                      </div>
                      <div style={{ fontSize: 12, color: "#a0aec0" }}>
                        {new Date(leave.principalActionAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}
