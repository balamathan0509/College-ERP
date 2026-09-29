// src/pages/hod/GatePass.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { sendEmail } from "../../utils/notifications";
import QRCode from "react-qr-code";

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

function generateToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 6; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

export default function HodGatePass() {
  const { userProfile } = useAuth();
  const [tab, setTab] = useState("pending");
  const [selectedYear, setSelectedYear] = useState("4th Year");
  const [passes, setPasses] = useState([]);
  const [approved, setApproved] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [yearChanging, setYearChanging] = useState(false);
  const [sortOrder, setSortOrder] = useState("recent");
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  async function fetchPasses() {
    setFetching(true);
    try {
      const q1 = query(
        collection(db, "gate_pass"),
        where("dept", "==", userProfile.dept),
        where("status", "==", "pending_hod")
      );
      const snap1 = await getDocs(q1);
      const pending = snap1.docs.map(d => ({ id: d.id, ...d.data() }));
      pending.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setPasses(pending);

      const q2 = query(
        collection(db, "gate_pass"),
        where("dept", "==", userProfile.dept),
        where("status", "==", "approved")
      );
      const snap2 = await getDocs(q2);
      const approvedList = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      approvedList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setApproved(approvedList);

      // Auto-select the year that has pending passes first, then approved
      const allPasses = [...pending, ...approvedList];
      if (allPasses.length > 0) {
        // Prefer year with pending passes
        const yearWithPending = pending[0]?.year;
        const yearWithApproved = approvedList[0]?.year;
        const autoYear = yearWithPending || yearWithApproved;
        if (autoYear && YEARS.includes(autoYear)) {
          setSelectedYear(autoYear);
        }
      }
    } catch (err) {}
    setFetching(false);
  }

  async function handleAction(pass, action) {
    setActionLoading(pass.id + action);
    try {
      const token = action === "approve" ? generateToken() : null;

      if (action === "forward") {
        // Forward to Principal
        await updateDoc(doc(db, "gate_pass", pass.id), {
          status: "pending_principal",
          hodActionAt: new Date().toISOString(),
          hodName: userProfile.name,
          forwardedByHod: true
        });
        // Email to student about forwarding
        if (pass.studentEmail) {
          await sendEmail({
            toEmail: pass.studentEmail,
            toName: pass.studentName,
            subject: `🔀 Gate Pass Forwarded to Principal`,
            message: `Hi ${pass.studentName},

Your gate pass request has been forwarded to the Principal for final approval by ${userProfile.name} (HOD, ${userProfile.dept}).

📋 Reason: ${pass.reason}
📍 Place: ${pass.place}
🕐 Out: ${pass.outDate} at ${pass.outTime}
🕐 In: ${pass.inDate} at ${pass.inTime}

Please wait for the Principal's decision.

Regards,
${userProfile.name}
HOD, ${userProfile.dept} Department
Renganayagi Varatharaj College of Engineering`
          });
        }
      } else {
        await updateDoc(doc(db, "gate_pass", pass.id), {
          status: action === "approve" ? "approved" : "rejected",
          token,
          hodActionAt: new Date().toISOString(),
          hodName: userProfile.name
        });

        if (action === "approve") {
          // Email to student with token
          if (pass.studentEmail) {
            await sendEmail({
              toEmail: pass.studentEmail,
              toName: pass.studentName,
              subject: `✅ Gate Pass Approved`,
              message: `Hi ${pass.studentName},

Great news! Your gate pass request has been approved by ${userProfile.name} (HOD, ${userProfile.dept}).

📋 Reason: ${pass.reason}
📍 Place: ${pass.place}
🕐 Out: ${pass.outDate} at ${pass.outTime}
🕐 In: ${pass.inDate} at ${pass.inTime}

⚠️ Important:
- Your Gate Pass QR Code is ready. Please login to the College Portal to view your QR Code.
- Show the QR Code to the security at the gate.
- Return on time as mentioned above.
- This gate pass is valid only for the mentioned dates.

Regards,
${userProfile.name}
HOD, ${userProfile.dept} Department
Renganayagi Varatharaj College of Engineering`
            });
          }
        } else {
          // Rejected — email to student
          if (pass.studentEmail) {
            await sendEmail({
              toEmail: pass.studentEmail,
              toName: pass.studentName,
              subject: `❌ Gate Pass Request Rejected`,
              message: `Hi ${pass.studentName},

We regret to inform you that your gate pass request has been rejected by ${userProfile.name} (HOD, ${userProfile.dept}).

📋 Reason for request: ${pass.reason}
📍 Place: ${pass.place}
🕐 Out: ${pass.outDate} at ${pass.outTime}

If you have any questions, please meet your HOD personally.

Regards,
${userProfile.name}
HOD, ${userProfile.dept} Department
Renganayagi Varatharaj College of Engineering`
            });
          }
        }
      }

      setPasses(prev => prev.filter(p => p.id !== pass.id));
      if (action === "approve") fetchPasses();
    } catch (err) {}
    setActionLoading("");
  }

  const pendingByYear = passes.filter(pass => pass.year === selectedYear);
  const approvedByYear = approved.filter(pass => pass.year === selectedYear);
  const totalRequestsByYear = pendingByYear.length + approvedByYear.length;

  // Count pending requests per year for badges
  const pendingCountByYear = {};
  YEARS.forEach(year => {
    pendingCountByYear[year] = passes.filter(p => p.year === year).length;
  });

  const sortedPendingByYear = [...pendingByYear].sort((a, b) => {
    if (sortOrder === "recent") return new Date(b.createdAt) - new Date(a.createdAt);
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  const sortedApprovedByYear = [...approvedByYear].sort((a, b) => {
    if (sortOrder === "recent") return new Date(b.createdAt) - new Date(a.createdAt);
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  const handleYearChange = (year) => {
    setYearChanging(true);
    setSelectedYear(year);
    setTimeout(() => setYearChanging(false), 300);
  };

  function handleClearHistoryClick() {
    setShowClearConfirm(true);
  }

  async function confirmClearHistory() {
    setShowClearConfirm(false);
    setClearing(true);
    try {
      for (const pass of approvedByYear) {
        await deleteDoc(doc(db, "gate_pass", pass.id));
      }
      setApproved(prev => prev.filter(p => p.year !== selectedYear));
    } catch (err) {
      alert("Error clearing history. Please try again.");
    }
    setClearing(false);
  }

  function cancelClearHistory() {
    setShowClearConfirm(false);
  }

  useEffect(() => { fetchPasses(); }, []);

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>🚪 Gate Pass — Final Approval</h1>
          <p>{userProfile?.dept} Department</p>
        </div>

        <div className="card" style={{ marginBottom: 24, opacity: yearChanging ? 0.7 : 1, transition: "opacity 0.3s" }}>
          {/* Year filter buttons — full width row */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "#a0aec0", marginBottom: 12 }}>Filter gate pass requests by year</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {YEARS.map(year => (
                <button
                  key={year}
                  onClick={() => handleYearChange(year)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 12,
                    border: selectedYear === year ? "2px solid #e94560" : "1.5px solid #e2e8f0",
                    background: selectedYear === year ? "rgba(233,69,96,0.1)" : "#f7fafc",
                    color: selectedYear === year ? "#e94560" : "#4a5568",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    position: "relative",
                    paddingRight: pendingCountByYear[year] > 0 ? 36 : 20
                  }}
                >
                  {year}
                  {pendingCountByYear[year] > 0 && (
                    <span style={{
                      position: "absolute",
                      top: -6, right: -6,
                      minWidth: 22, height: 22,
                      borderRadius: 11,
                      background: "linear-gradient(135deg, #e94560, #c0392b)",
                      color: "white", fontSize: 11, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "0 5px",
                      boxShadow: "0 2px 8px rgba(233,69,96,0.5)",
                      animation: "badgePulse 2s infinite"
                    }}>
                      {pendingCountByYear[year]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", opacity: yearChanging ? 0.5 : 1, transition: "opacity 0.3s", borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
            <div style={{ padding: "12px 20px", borderRadius: 14, background: "#f7fafc", border: "1px solid #e2e8f0", flex: 1, minWidth: 100 }}>
              <div style={{ fontSize: 12, color: "#718096", marginBottom: 4 }}>Requests</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#2d3748" }}>{totalRequestsByYear}</div>
            </div>
            <div style={{ padding: "12px 20px", borderRadius: 14, background: "#fff5f5", border: "1px solid #fed7d7", flex: 1, minWidth: 100 }}>
              <div style={{ fontSize: 12, color: "#718096", marginBottom: 4 }}>Pending</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#e94560" }}>{pendingByYear.length}</div>
            </div>
            <div style={{ padding: "12px 20px", borderRadius: 14, background: "#f0fff4", border: "1px solid #c6f6d5", flex: 1, minWidth: 100 }}>
              <div style={{ fontSize: 12, color: "#718096", marginBottom: 4 }}>Approved</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#38a169" }}>{approvedByYear.length}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {["pending", "approved"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer",
                fontFamily: "Syne", fontWeight: 600, fontSize: 14,
                background: tab === t ? "#e94560" : "rgba(255,255,255,0.07)",
                color: "white", transition: "all 0.2s"
              }}>
                {t === "pending" ? `⏳ Pending (${pendingByYear.length})` : `✅ Approved (${approvedByYear.length})`}
              </button>
            ))}
          </div>
          
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setSortOrder("recent")} style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)",
              background: sortOrder === "recent" ? "rgba(233,69,96,0.2)" : "rgba(255,255,255,0.05)",
              color: sortOrder === "recent" ? "#e94560" : "#a0aec0", fontWeight: 600, fontSize: 13,
              cursor: "pointer", transition: "all 0.2s"
            }}>
              📅 Recent First
            </button>
            <button onClick={() => setSortOrder("oldest")} style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)",
              background: sortOrder === "oldest" ? "rgba(233,69,96,0.2)" : "rgba(255,255,255,0.05)",
              color: sortOrder === "oldest" ? "#e94560" : "#a0aec0", fontWeight: 600, fontSize: 13,
              cursor: "pointer", transition: "all 0.2s"
            }}>
              📅 Oldest First
            </button>
          </div>
        </div>

        {/* Pending */}
        {tab === "pending" && (
          fetching ? (
            <div style={{ textAlign: "center", padding: 60 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
          ) : pendingByYear.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <p style={{ color: "#a0aec0" }}>No pending gate pass requests for {selectedYear}.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {sortedPendingByYear.map(pass => (
                <div key={pass.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(233,69,96,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎒</div>
                          <div>
                            <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16 }}>{pass.studentName}</div>
                            <div style={{ color: "#a0aec0", fontSize: 13 }}>{pass.registerNo} • {pass.year} • {pass.staffName || "Self"}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right", fontSize: 12, color: "#a0aec0" }}>
                          <div>📍 {new Date(pass.createdAt).toLocaleDateString()}</div>
                          <div>{new Date(pass.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
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
                      <button onClick={() => handleAction(pass, "forward")} disabled={!!actionLoading} style={{
                        padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(128,90,213,0.3)",
                        background: "rgba(128,90,213,0.15)", color: "#805ad5", fontWeight: 700, fontSize: 14, cursor: "pointer"
                      }}>
                        {actionLoading === pass.id + "forward" ? "..." : "🔀 Forward to Principal"}
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

        {/* Approved */}
        {tab === "approved" && (
          <div>
            {approvedByYear.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, padding: "12px 16px", background: "rgba(72,187,120,0.1)", borderRadius: 12, border: "1px solid rgba(72,187,120,0.2)" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#48bb78" }}>📊 Approved Records: {approvedByYear.length}</div>
                  <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>These records can be cleared to clean up the history</div>
                </div>
                <button onClick={handleClearHistoryClick} disabled={clearing || approvedByYear.length === 0} style={{
                  padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(252,129,129,0.3)",
                  background: "rgba(252,129,129,0.1)", color: "#fc8181", fontWeight: 700, fontSize: 13,
                  cursor: "pointer", transition: "all 0.2s"
                }}>
                  {clearing ? "Clearing..." : "🗑️ Clear History"}
                </button>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {approvedByYear.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 60 }}>
                <p style={{ color: "#a0aec0" }}>No approved passes for {selectedYear}.</p>
              </div>
            ) : sortedApprovedByYear.map(pass => (
              <div key={pass.id} className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid rgba(72,187,120,0.3)" }}>
                {/* Green Header */}
                <div style={{ background: "linear-gradient(135deg, #1a6b3c, #2ecc71)", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🚪</div>
                    <div>
                      <div style={{ color: "white", fontWeight: 800, fontSize: 15, fontFamily: "Syne" }}>GATE PASS — APPROVED</div>
                      <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>{pass.dept} Department · {pass.year}</div>
                    </div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 10, padding: "6px 14px", textAlign: "center" }}>
                    <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>TOKEN</div>
                    <div style={{ color: "white", fontWeight: 900, fontSize: 18, letterSpacing: 3, fontFamily: "monospace" }}>{pass.token}</div>
                  </div>
                </div>
                {/* Body */}
                <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{pass.studentName}</div>
                    <div style={{ color: "#a0aec0", fontSize: 13, marginBottom: 12 }}>{pass.registerNo}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 14px" }}>
                        <div style={{ fontSize: 10, color: "#a0aec0", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>REASON</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{pass.reason}</div>
                      </div>
                      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 14px" }}>
                        <div style={{ fontSize: 10, color: "#a0aec0", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>PLACE</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>📍 {pass.place}</div>
                      </div>
                      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 14px" }}>
                        <div style={{ fontSize: 10, color: "#a0aec0", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>OUT</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#fc8181" }}>🕐 {pass.outDate} {pass.outTime}</div>
                      </div>
                      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 14px" }}>
                        <div style={{ fontSize: 10, color: "#a0aec0", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>IN</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#48bb78" }}>🕐 {pass.inDate} {pass.inTime}</div>
                      </div>
                    </div>
                  </div>
                  {/* QR Code */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div style={{ padding: 10, background: "white", borderRadius: 12, border: "3px solid #48bb78", boxShadow: "0 4px 20px rgba(72,187,120,0.3)" }}>
                      <QRCode value={pass.token || "NO_TOKEN"} size={90} level="M" />
                    </div>
                    <div style={{ fontSize: 11, color: "#48bb78", fontWeight: 700 }}>✅ Show to Security</div>
                    <div style={{ fontSize: 11, color: "#a0aec0" }}>Approved by {pass.hodName || "HOD"}</div>
                  </div>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}

        {/* Clear History Modal */}
        {showClearConfirm && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, backdropFilter: "blur(4px)"
          }}>
            <div style={{
              background: "#16213e", borderRadius: 20, padding: 32, maxWidth: 420,
              border: "1px solid rgba(233,69,96,0.3)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(252,129,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🗑️</div>
                <div>
                  <h3 style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 20, color: "white", marginBottom: 4 }}>Clear History?</h3>
                  <p style={{ color: "#a0aec0", fontSize: 13 }}>This action cannot be undone</p>
                </div>
              </div>
              
              <div style={{ background: "rgba(252,129,129,0.1)", border: "1px solid rgba(252,129,129,0.2)", borderRadius: 12, padding: 16, marginBottom: 24 }}>
                <p style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.6 }}>
                  You are about to delete all <strong>{approvedByYear.length} approved gate pass records</strong> for <strong>{selectedYear}</strong>. This will remove them permanently from the database.
                </p>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={cancelClearHistory} style={{
                  flex: 1, padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.05)", color: "white", fontFamily: "Syne", fontWeight: 700,
                  cursor: "pointer", transition: "all 0.2s"
                }}>
                  Cancel
                </button>
                <button onClick={confirmClearHistory} disabled={clearing} style={{
                  flex: 1, padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(252,129,129,0.3)",
                  background: "rgba(252,129,129,0.2)", color: "#fc8181", fontFamily: "Syne", fontWeight: 700,
                  cursor: "pointer", transition: "all 0.2s", opacity: clearing ? 0.6 : 1
                }}>
                  {clearing ? "Clearing..." : "🗑️ Delete Records"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Badge pulse animation */}
        <style>{`
          @keyframes badgePulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
        `}</style>
      </main>
    </div>
  );
}