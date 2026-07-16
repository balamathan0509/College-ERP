// src/pages/principal/GatePass.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { sendEmail } from "../../utils/notifications";
import QRCode from "react-qr-code";

function generateToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 6; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

export default function PrincipalGatePass() {
  const { userProfile } = useAuth();
  const [tab, setTab] = useState("pending");
  const [passes, setPasses] = useState([]);
  const [approved, setApproved] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [sortOrder, setSortOrder] = useState("recent");

  async function fetchPasses() {
    setFetching(true);
    try {
      // Fetch pending_principal requests (forwarded by HOD)
      const q1 = query(
        collection(db, "gate_pass"),
        where("status", "==", "pending_principal")
      );
      const snap1 = await getDocs(q1);
      const pending = snap1.docs.map(d => ({ id: d.id, ...d.data() }));
      pending.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setPasses(pending);

      // Fetch approved by principal
      const q2 = query(
        collection(db, "gate_pass"),
        where("status", "==", "approved"),
        where("approvedByPrincipal", "==", true)
      );
      const snap2 = await getDocs(q2);
      const approvedList = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      approvedList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setApproved(approvedList);
    } catch (err) {
      console.error("Error fetching passes:", err);
    }
    setFetching(false);
  }

  async function handleAction(pass, action) {
    setActionLoading(pass.id + action);
    try {
      if (action === "approve") {
        const token = generateToken();
        await updateDoc(doc(db, "gate_pass", pass.id), {
          status: "approved",
          token,
          principalActionAt: new Date().toISOString(),
          principalName: userProfile.name,
          approvedByPrincipal: true
        });

        if (pass.studentEmail) {
          await sendEmail({
            toEmail: pass.studentEmail,
            toName: pass.studentName,
            subject: `✅ Gate Pass Approved by Principal`,
            message: `Hi ${pass.studentName},

Great news! Your gate pass request has been approved by the Principal, ${userProfile.name}.

📋 Reason: ${pass.reason}
📍 Place: ${pass.place}
🕐 Out: ${pass.outDate} at ${pass.outTime}
🕐 In: ${pass.inDate} at ${pass.inTime}
${pass.hodName ? `👑 Forwarded by HOD: ${pass.hodName}` : ""}

⚠️ Important:
- Your Gate Pass QR Code is ready. Please login to the College Portal to view your QR Code.
- Show the QR Code to the security at the gate.
- Return on time as mentioned above.
- This gate pass is valid only for the mentioned dates.

Regards,
${userProfile.name}
Principal
Renganayagi Varatharaj College of Engineering`
          });
        }
      } else {
        // Reject
        await updateDoc(doc(db, "gate_pass", pass.id), {
          status: "rejected",
          principalActionAt: new Date().toISOString(),
          principalName: userProfile.name,
          rejectedByPrincipal: true
        });

        if (pass.studentEmail) {
          await sendEmail({
            toEmail: pass.studentEmail,
            toName: pass.studentName,
            subject: `❌ Gate Pass Rejected by Principal`,
            message: `Hi ${pass.studentName},

We regret to inform you that your gate pass request has been rejected by the Principal, ${userProfile.name}.

📋 Reason for request: ${pass.reason}
📍 Place: ${pass.place}
🕐 Out: ${pass.outDate} at ${pass.outTime}
${pass.hodName ? `👑 Forwarded by HOD: ${pass.hodName}` : ""}

If you have any questions, please contact your HOD.

Regards,
${userProfile.name}
Principal
Renganayagi Varatharaj College of Engineering`
          });
        }
      }

      setPasses(prev => prev.filter(p => p.id !== pass.id));
      if (action === "approve") fetchPasses();
    } catch (err) {
      console.error("Error handling action:", err);
    }
    setActionLoading("");
  }

  // Group pending by department for summary
  const pendingByDept = {};
  passes.forEach(p => {
    const dept = p.dept || "Unknown";
    if (!pendingByDept[dept]) pendingByDept[dept] = 0;
    pendingByDept[dept]++;
  });

  const sortedPasses = [...passes].sort((a, b) => {
    if (sortOrder === "recent") return new Date(b.createdAt) - new Date(a.createdAt);
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  const sortedApproved = [...approved].sort((a, b) => {
    if (sortOrder === "recent") return new Date(b.createdAt) - new Date(a.createdAt);
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  useEffect(() => { fetchPasses(); }, []);

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>🏛️ Gate Pass — Principal Approval</h1>
          <p>Requests forwarded by HODs for your decision</p>
        </div>

        {/* Stats Bar */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: "#a0aec0", marginBottom: 12 }}>Forwarded gate pass requests by department</div>
              {Object.keys(pendingByDept).length > 0 ? (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {Object.entries(pendingByDept).map(([dept, count]) => (
                    <div key={dept} style={{
                      padding: "8px 16px", borderRadius: 10,
                      background: "rgba(128,90,213,0.12)", border: "1px solid rgba(128,90,213,0.25)",
                      color: "#805ad5", fontWeight: 700, fontSize: 13
                    }}>
                      {dept}: {count}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "#4a5568", fontSize: 13 }}>No pending requests</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,0.05)", minWidth: 130 }}>
                <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 6 }}>Pending</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#805ad5" }}>{passes.length}</div>
              </div>
              <div style={{ padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,0.05)", minWidth: 130 }}>
                <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 6 }}>Approved</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#48bb78" }}>{approved.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs & Sort */}
        <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {["pending", "approved"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer",
                fontFamily: "Syne", fontWeight: 600, fontSize: 14,
                background: tab === t ? "#805ad5" : "rgba(255,255,255,0.07)",
                color: "white", transition: "all 0.2s"
              }}>
                {t === "pending" ? `⏳ Pending (${passes.length})` : `✅ Approved (${approved.length})`}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setSortOrder("recent")} style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)",
              background: sortOrder === "recent" ? "rgba(128,90,213,0.2)" : "rgba(255,255,255,0.05)",
              color: sortOrder === "recent" ? "#805ad5" : "#a0aec0", fontWeight: 600, fontSize: 13,
              cursor: "pointer", transition: "all 0.2s"
            }}>
              📅 Recent First
            </button>
            <button onClick={() => setSortOrder("oldest")} style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)",
              background: sortOrder === "oldest" ? "rgba(128,90,213,0.2)" : "rgba(255,255,255,0.05)",
              color: sortOrder === "oldest" ? "#805ad5" : "#a0aec0", fontWeight: 600, fontSize: 13,
              cursor: "pointer", transition: "all 0.2s"
            }}>
              📅 Oldest First
            </button>
          </div>
        </div>

        {/* Pending Tab */}
        {tab === "pending" && (
          fetching ? (
            <div style={{ textAlign: "center", padding: 60 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
          ) : passes.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <p style={{ color: "#a0aec0" }}>No pending gate pass requests forwarded to you.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {sortedPasses.map(pass => (
                <div key={pass.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(128,90,213,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎒</div>
                          <div>
                            <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16 }}>{pass.studentName}</div>
                            <div style={{ color: "#a0aec0", fontSize: 13 }}>{pass.registerNo} • {pass.year} • {pass.dept}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right", fontSize: 12, color: "#a0aec0" }}>
                          <div>📍 {new Date(pass.createdAt).toLocaleDateString()}</div>
                          <div>{new Date(pass.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>

                      {/* Forwarded by HOD badge */}
                      {pass.hodName && (
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 8,
                          padding: "6px 14px", borderRadius: 8,
                          background: "rgba(128,90,213,0.1)", border: "1px solid rgba(128,90,213,0.2)",
                          marginBottom: 14, fontSize: 12, color: "#805ad5", fontWeight: 600
                        }}>
                          👑 Forwarded by HOD: {pass.hodName} • {pass.dept}
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 16 }}>
                        <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>REASON</div><div style={{ fontWeight: 600, fontSize: 14 }}>{pass.reason}</div></div>
                        <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>PLACE</div><div style={{ fontWeight: 600, fontSize: 14 }}>📍 {pass.place}</div></div>
                        <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>OUT</div><div style={{ fontWeight: 600, fontSize: 14 }}>{pass.outDate} {pass.outTime}</div></div>
                        <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>IN</div><div style={{ fontWeight: 600, fontSize: 14 }}>{pass.inDate} {pass.inTime}</div></div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 180 }}>
                      <button onClick={() => handleAction(pass, "approve")} disabled={!!actionLoading} style={{
                        padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(72,187,120,0.3)",
                        background: "rgba(72,187,120,0.15)", color: "#48bb78", fontWeight: 700, fontSize: 14, cursor: "pointer"
                      }}>
                        {actionLoading === pass.id + "approve" ? "..." : "✅ Approve & Generate QR"}
                      </button>
                      <button onClick={() => handleAction(pass, "reject")} disabled={!!actionLoading} style={{
                        padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(252,129,129,0.3)",
                        background: "rgba(252,129,129,0.1)", color: "#fc8181", fontWeight: 700, fontSize: 14, cursor: "pointer"
                      }}>
                        {actionLoading === pass.id + "reject" ? "..." : "❌ Reject"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Approved Tab */}
        {tab === "approved" && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {approved.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 60 }}>
                  <p style={{ color: "#a0aec0" }}>No approved passes yet.</p>
                </div>
              ) : sortedApproved.map(pass => (
                <div key={pass.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                    <div>
                      <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16 }}>{pass.studentName}</div>
                      <div style={{ color: "#a0aec0", fontSize: 13, marginTop: 4 }}>{pass.registerNo} • {pass.year} • {pass.dept} • {pass.reason}</div>
                      {pass.hodName && <div style={{ color: "#805ad5", fontSize: 12, marginTop: 4 }}>👑 Forwarded by: {pass.hodName}</div>}
                      <div style={{ color: "#a0aec0", fontSize: 12, marginTop: 6 }}>📅 {new Date(pass.createdAt).toLocaleDateString()} • 🕐 {new Date(pass.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
                      <div style={{ padding: "10px", background: "white", borderRadius: 12, textAlign: "center", border: "2px solid #48bb78" }}>
                        <QRCode value={pass.token} size={60} level="L" />
                      </div>
                      <div style={{ fontSize: 12, color: "#48bb78", fontWeight: 700, textAlign: "center" }}>✅ Approved</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
