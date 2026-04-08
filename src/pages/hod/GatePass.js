// src/pages/hod/GatePass.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { sendEmail } from "../../utils/notifications";

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
  const [selectedYear, setSelectedYear] = useState("1st Year");
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
    } catch (err) {}
    setFetching(false);
  }

  async function handleAction(pass, action) {
    setActionLoading(pass.id + action);
    try {
      const token = action === "approve" ? generateToken() : null;

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
            subject: `✅ Gate Pass Approved — Token: ${token}`,
            message: `Hi ${pass.studentName},

Great news! Your gate pass request has been approved by ${userProfile.name} (HOD, ${userProfile.dept}).

🎟️ YOUR TOKEN: ${token}

📋 Reason: ${pass.reason}
📍 Place: ${pass.place}
🕐 Out: ${pass.outDate} at ${pass.outTime}
🕐 In: ${pass.inDate} at ${pass.inTime}

⚠️ Important:
- Show this token to the security at the gate
- Return on time as mentioned above
- This token is valid only for the mentioned dates

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

      setPasses(prev => prev.filter(p => p.id !== pass.id));
      if (action === "approve") fetchPasses();
    } catch (err) {}
    setActionLoading("");
  }

  const pendingByYear = passes.filter(pass => pass.year === selectedYear);
  const approvedByYear = approved.filter(pass => pass.year === selectedYear);
  const totalRequestsByYear = pendingByYear.length + approvedByYear.length;

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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: "#a0aec0", marginBottom: 12 }}>Filter gate pass requests by year</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {YEARS.map(year => (
                  <button
                    key={year}
                    onClick={() => handleYearChange(year)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 12,
                      border: selectedYear === year ? "1px solid #e94560" : "1px solid rgba(255,255,255,0.12)",
                      background: selectedYear === year ? "rgba(233,69,96,0.15)" : "rgba(255,255,255,0.05)",
                      color: "white",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", opacity: yearChanging ? 0.5 : 1, transition: "opacity 0.3s" }}>
              <div style={{ padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,0.05)", minWidth: 140 }}>
                <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 6 }}>Requests</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{totalRequestsByYear}</div>
              </div>
              <div style={{ padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,0.05)", minWidth: 140 }}>
                <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 6 }}>Pending</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#e94560" }}>{pendingByYear.length}</div>
              </div>
              <div style={{ padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,0.05)", minWidth: 140 }}>
                <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 6 }}>Approved</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#48bb78" }}>{approvedByYear.length}</div>
              </div>
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
                        {actionLoading === pass.id + "approve" ? "..." : "✅ Approve + Send Token"}
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
              <div key={pass.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                  <div>
                    <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16 }}>{pass.studentName}</div>
                    <div style={{ color: "#a0aec0", fontSize: 13, marginTop: 4 }}>{pass.registerNo} • {pass.year} • {pass.reason}</div>
                    <div style={{ color: "#a0aec0", fontSize: 12, marginTop: 6 }}>📅 {new Date(pass.createdAt).toLocaleDateString()} • 🕐 {new Date(pass.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
                    <div style={{ padding: "10px 20px", background: "rgba(72,187,120,0.1)", border: "1px solid rgba(72,187,120,0.3)", borderRadius: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>TOKEN</div>
                      <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "Syne", color: "#48bb78", letterSpacing: 4 }}>{pass.token}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "#48bb78" }}>✅ Approved</div>
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
      </main>
    </div>
  );
}