import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { Scanner } from "@yudiel/react-qr-scanner";
import { toast, Toaster } from "react-hot-toast";

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getPassLabel(pass) {
  if (!pass) return "Pending";
  if (pass.status === "verified_by_security") return "Verified by Security";
  if (pass.status === "approved") return "Approved";
  if (pass.status === "rejected") return "Rejected";
  return pass.status || "Pending";
}

export default function VerifyGatePass() {
  const { userProfile } = useAuth();
  const [verifyToken, setVerifyToken] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState("");
  const [recentScans, setRecentScans] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const verifiedCount = recentScans.length;

  async function loadRecentScans() {
    setLoadingRecent(true);
    try {
      const q = query(
        collection(db, "gate_pass"),
        where("status", "==", "verified_by_security")
      );
      const snap = await getDocs(q);
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aTime = new Date(a.verifiedBySecurityAt || a.hodActionAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.verifiedBySecurityAt || b.hodActionAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        });
      setRecentScans(list.slice(0, 5));
    } catch (err) {
      setRecentScans([]);
    }
    setLoadingRecent(false);
  }

  useEffect(() => {
    loadRecentScans();
  }, []);

  async function handleVerify(event, scannedToken = null) {
    if (event) event.preventDefault();
    const token = (scannedToken || verifyToken).trim().toUpperCase();
    if (!token) return;

    setVerifying(true);
    setError("");
    setVerifyResult(null);

    try {
      const q = query(
        collection(db, "gate_pass"),
        where("token", "==", token)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setVerifyResult({ valid: false, reason: "Invalid Token - Not Found", token });
      } else {
        const pass = { id: snap.docs[0].id, ...snap.docs[0].data() };
        if (pass.status === "verified_by_security") {
          setVerifyResult({ valid: false, reason: "Already Verified / Used Token", pass, token });
        } else if (pass.status === "approved") {
          setVerifyResult({ valid: true, pass });
        } else {
          setVerifyResult({ valid: false, reason: `Invalid Status: ${pass.status}`, pass, token });
        }
      }
    } catch (err) {
      if (err?.message?.includes("offline") || err?.code === "unavailable") {
        setError("Connection issue. Please check your internet and try again.");
      } else {
        setError("Failed to verify token. Try again.");
      }
    }

    setVerifying(false);
  }

  async function handleMarkAsVerified() {
    if (!verifyResult?.pass?.id) return;

    setMarking(true);
    setError("");

    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, "gate_pass", verifyResult.pass.id), {
        status: "verified_by_security",
        verifiedBySecurityAt: now,
        verifiedBySecurityName: userProfile?.name || "Security"
      });

      setVerifyResult((prev) =>
        prev
          ? {
              ...prev,
              pass: {
                ...prev.pass,
                status: "verified_by_security",
                verifiedBySecurityAt: now,
                verifiedBySecurityName: userProfile?.name || "Security"
              },
              marked: true
            }
          : prev
      );

      await loadRecentScans();
    } catch (err) {
      if (err?.message?.includes("offline") || err?.code === "unavailable") {
        setError("Connection issue. Please check your internet and try again.");
      } else {
        setError("Failed to mark as verified. Try again.");
      }
    }

    setMarking(false);
  }

  return (
    <div className="dashboard-wrapper">
      <Toaster position="top-center" />
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Gate Security Verification</h1>
          <p>Scan or type the student gate pass token to verify at the gate</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, color: "#a0aec0" }}>Security User</div>
            <div style={{ marginTop: 6, fontWeight: 800, fontFamily: "Syne" }}>{userProfile?.name || "Security"}</div>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, color: "#a0aec0" }}>Recent Verified</div>
            <div style={{ marginTop: 6, fontWeight: 800, fontFamily: "Syne", color: "#48bb78" }}>{verifiedCount}</div>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, color: "#a0aec0" }}>Current Mode</div>
            <div style={{ marginTop: 6, fontWeight: 800, fontFamily: "Syne", color: "#e94560" }}>Live Checkpoint</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1.1fr) minmax(280px, 0.9fr)", gap: 24, alignItems: "start" }}>
          <div className="card">
            <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 16 }}>Verify Gate Pass Token</h3>

            {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}

            <div style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: "100%",
                maxWidth: "400px",
                aspectRatio: "1",
                borderRadius: "24px",
                overflow: "hidden",
                border: verifying ? "4px solid rgba(245,166,35,0.7)" : "4px solid rgba(72,187,120,0.5)",
                boxShadow: verifying
                  ? "0 0 30px rgba(245,166,35,0.3), 0 10px 30px rgba(0,0,0,0.3)"
                  : "0 0 20px rgba(72,187,120,0.15), 0 10px 30px rgba(0,0,0,0.3)",
                position: "relative",
                background: "#000",
                transition: "border-color 0.3s, box-shadow 0.3s"
              }}>
                <Scanner
                  onScan={(result) => {
                    if (result && result.length > 0 && result[0].rawValue) {
                      const tokenString = result[0].rawValue;
                      if (!verifying) {
                        toast.success("QR Scanned!");
                        setVerifyToken(tokenString);
                        handleVerify(null, tokenString);
                      }
                    }
                  }}
                  components={{
                    audio: true,
                    onOff: true,
                    torch: true,
                    zoom: true,
                    finder: true,
                  }}
                  styles={{
                    container: { width: '100%', height: '100%' },
                    video: { width: '100%', height: '100%', objectFit: 'cover' }
                  }}
                />
                {/* Scanning animation overlay */}
                <div style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0, bottom: 0,
                  pointerEvents: "none",
                  overflow: "hidden",
                  borderRadius: 20
                }}>
                  {/* Scanning line */}
                  <div style={{
                    position: "absolute",
                    left: "10%", right: "10%",
                    height: 3,
                    background: "linear-gradient(90deg, transparent, #48bb78, #48bb78, transparent)",
                    boxShadow: "0 0 15px rgba(72,187,120,0.8), 0 0 30px rgba(72,187,120,0.4)",
                    animation: "scanLine 2.5s ease-in-out infinite",
                    borderRadius: 2
                  }} />
                  {/* Corner brackets */}
                  <div style={{ position: "absolute", top: 20, left: 20, width: 40, height: 40, borderTop: "3px solid #48bb78", borderLeft: "3px solid #48bb78", borderRadius: "4px 0 0 0" }} />
                  <div style={{ position: "absolute", top: 20, right: 20, width: 40, height: 40, borderTop: "3px solid #48bb78", borderRight: "3px solid #48bb78", borderRadius: "0 4px 0 0" }} />
                  <div style={{ position: "absolute", bottom: 20, left: 20, width: 40, height: 40, borderBottom: "3px solid #48bb78", borderLeft: "3px solid #48bb78", borderRadius: "0 0 0 4px" }} />
                  <div style={{ position: "absolute", bottom: 20, right: 20, width: 40, height: 40, borderBottom: "3px solid #48bb78", borderRight: "3px solid #48bb78", borderRadius: "0 0 4px 0" }} />
                </div>
              </div>

              {/* Scanning status indicator */}
              <div style={{
                marginTop: 16, display: "flex", alignItems: "center", gap: 10,
                padding: "10px 20px", borderRadius: 12,
                background: verifying ? "rgba(245,166,35,0.1)" : "rgba(72,187,120,0.1)",
                border: `1px solid ${verifying ? "rgba(245,166,35,0.2)" : "rgba(72,187,120,0.2)"}`,
                transition: "all 0.3s"
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: verifying ? "#f5a623" : "#48bb78",
                  animation: "statusPulse 1.5s infinite",
                  boxShadow: `0 0 8px ${verifying ? "rgba(245,166,35,0.6)" : "rgba(72,187,120,0.6)"}`
                }} />
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: verifying ? "#f5a623" : "#48bb78",
                  fontFamily: "Syne", letterSpacing: 0.5
                }}>
                  {verifying ? "⏳ Verifying Token..." : "📷 Camera Active — Scanning for QR Code"}
                </span>
              </div>

              <div style={{ marginTop: 8, fontSize: 12, color: "#4a5568", fontWeight: 500 }}>
                Point camera at student's Gate Pass QR Code
              </div>
            </div>

            {/* Animations */}
            <style>{`
              @keyframes scanLine {
                0% { top: 15%; opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { top: 85%; opacity: 0; }
              }
              @keyframes statusPulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(0.8); }
              }
            `}</style>

            {verifyResult && (
              <div
                style={{
                  marginTop: 20,
                  padding: 20,
                  borderRadius: 12,
                  background: verifyResult.valid ? "rgba(72,187,120,0.1)" : "rgba(252,129,129,0.1)",
                  border: `1px solid ${verifyResult.valid ? "rgba(72,187,120,0.3)" : "rgba(252,129,129,0.3)"}`
                }}
              >
                {verifyResult.valid ? (
                  <div>
                    <div style={{ color: "#48bb78", fontFamily: "Syne", fontWeight: 700, fontSize: 18, marginBottom: 12 }}>
                      Valid Gate Pass
                    </div>
                    <div style={{ color: "#e2e8f0", fontSize: 14, display: "grid", gap: 6 }}>
                      <span>Student: {verifyResult.pass.studentName} ({verifyResult.pass.registerNo})</span>
                      <span>Year / Dept: {verifyResult.pass.year} - {verifyResult.pass.dept}</span>
                      <span>Reason: {verifyResult.pass.reason}</span>
                      <span>Place: {verifyResult.pass.place}</span>
                      <span>Out: {verifyResult.pass.outDate} {verifyResult.pass.outTime}</span>
                      <span>In: {verifyResult.pass.inDate} {verifyResult.pass.inTime}</span>
                      <span>Token: {verifyResult.pass.token}</span>
                    </div>
                    <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", color: "#a0aec0", fontSize: 13 }}>
                      Status: {getPassLabel(verifyResult.pass)}
                    </div>

                    {verifyResult.marked || verifyResult.pass.status === "verified_by_security" ? (
                      <div
                        style={{
                          marginTop: 16,
                          padding: 12,
                          background: "rgba(72,187,120,0.2)",
                          borderRadius: 8,
                          color: "#48bb78",
                          fontFamily: "Syne",
                          fontWeight: 600,
                          textAlign: "center"
                        }}
                      >
                        Verified by Security
                      </div>
                    ) : (
                      <button
                        className="btn-primary"
                        onClick={handleMarkAsVerified}
                        disabled={marking}
                        style={{ marginTop: 16, width: "100%" }}
                      >
                        {marking ? "Marking..." : "Mark as Verified"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ color: "#fc8181", fontFamily: "Syne", fontWeight: 700, fontSize: 16, textAlign: "center" }}>
                    🚫 {verifyResult.reason}
                    {verifyResult.pass && (
                      <div style={{ marginTop: 12, fontSize: 13, color: "#e2e8f0", fontWeight: 400 }}>
                        Student: {verifyResult.pass.studentName} <br/>
                        Token: {verifyResult.token}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 16 }}>Recent Verifications</h3>
            {loadingRecent ? (
              <div style={{ textAlign: "center", padding: 30 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : recentScans.length === 0 ? (
              <div style={{ color: "#a0aec0", fontSize: 14 }}>
                No verified gate passes yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {recentScans.map((pass) => (
                  <div
                    key={pass.id}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{pass.studentName}</div>
                        <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>
                          {pass.registerNo} - {pass.year}
                        </div>
                      </div>
                      <div style={{ color: "#48bb78", fontWeight: 700, fontFamily: "Syne" }}>
                        {pass.token}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 10, display: "grid", gap: 4 }}>
                      <span>Verified at: {formatDateTime(pass.verifiedBySecurityAt)}</span>
                      <span>By: {pass.verifiedBySecurityName || "Security"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
