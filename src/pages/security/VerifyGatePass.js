// src/pages/security/VerifyGatePass.js
import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { Scanner } from "@yudiel/react-qr-scanner";
import { toast, Toaster } from "react-hot-toast";
import {
  ShieldCheck,
  Camera,
  CheckCircle2,
  XCircle,
  Search,
  Clock,
  UserCheck,
  QrCode,
  AlertCircle
} from "lucide-react";

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
      setRecentScans(list.slice(0, 10));
    } catch (err) {}
    setLoadingRecent(false);
  }

  useEffect(() => {
    loadRecentScans();
  }, []);

  async function handleVerify(e, scanToken = null) {
    if (e) e.preventDefault();
    const tokenToUse = (scanToken || verifyToken).trim().toUpperCase();
    if (!tokenToUse) {
      setError("Please enter or scan a gate pass token.");
      return;
    }

    setVerifying(true);
    setError("");
    setVerifyResult(null);

    try {
      const q = query(collection(db, "gate_pass"), where("token", "==", tokenToUse));
      const snap = await getDocs(q);

      if (snap.empty) {
        setVerifyResult({
          valid: false,
          reason: "Invalid Token — No matching gate pass record found.",
          token: tokenToUse
        });
      } else {
        const passDoc = snap.docs[0];
        const passData = { id: passDoc.id, ...passDoc.data() };

        if (passData.status === "rejected") {
          setVerifyResult({
            valid: false,
            reason: "Gate Pass Rejected — Access Denied.",
            pass: passData,
            token: tokenToUse
          });
        } else if (passData.status === "pending") {
          setVerifyResult({
            valid: false,
            reason: "Gate Pass Pending Approval — Not yet approved by HOD.",
            pass: passData,
            token: tokenToUse
          });
        } else if (passData.status === "approved" || passData.status === "verified_by_security") {
          setVerifyResult({
            valid: true,
            pass: passData,
            token: tokenToUse
          });
        } else {
          setVerifyResult({
            valid: false,
            reason: `Invalid Status: ${passData.status}`,
            pass: passData,
            token: tokenToUse
          });
        }
      }
    } catch (err) {
      setError("Failed to verify token. Try again.");
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
        verifiedBySecurityName: userProfile?.name || "Security Officer"
      });

      setVerifyResult((prev) =>
        prev
          ? {
              ...prev,
              pass: {
                ...prev.pass,
                status: "verified_by_security",
                verifiedBySecurityAt: now,
                verifiedBySecurityName: userProfile?.name || "Security Officer"
              },
              marked: true
            }
          : prev
      );
      await loadRecentScans();
    } catch (err) {
      setError("Failed to mark as verified.");
    }
    setMarking(false);
  }

  return (
    <div className="dashboard-wrapper">
      <Toaster position="top-center" />
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Campus Gate Verification</h1>
          <p>Real-time QR Code scanning and gate pass token validation</p>
        </div>

        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <UserCheck size={24} color="var(--highlight)" />
            </div>
            <div className="stat-value">{userProfile?.name || "Security"}</div>
            <div className="stat-label">Security Officer</div>
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <ShieldCheck size={24} color="var(--success)" />
            </div>
            <div className="stat-value" style={{ color: "var(--success)" }}>{verifiedCount}</div>
            <div className="stat-label">Verified Gate Passes</div>
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <QrCode size={24} color="var(--warning)" />
            </div>
            <div className="stat-value" style={{ color: "var(--warning)" }}>Active</div>
            <div className="stat-label">QR Scanner Status</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1.1fr) minmax(280px, 0.9fr)", gap: 24, alignItems: "start" }}>
          <div className="card">
            <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 16 }}>
              Scan QR or Enter Pass Token
            </h3>

            {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}

            <form onSubmit={e => handleVerify(e)} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  placeholder="e.g. GP-9X82K"
                  value={verifyToken}
                  onChange={e => setVerifyToken(e.target.value)}
                  style={{ fontFamily: "monospace", textTransform: "uppercase", fontSize: 15 }}
                />
                <button type="submit" className="btn-primary" disabled={verifying} style={{ width: "auto", padding: "0 20px" }}>
                  {verifying ? "Checking..." : "Verify"}
                </button>
              </div>
            </form>

            <div style={{ padding: "16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: "100%", maxWidth: "360px", aspectRatio: "1", borderRadius: "var(--radius-md)",
                overflow: "hidden", border: verifying ? "3px solid var(--warning)" : "3px solid var(--success)",
                position: "relative", background: "#000"
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
                />
              </div>

              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
                <Camera size={16} color="var(--success)" /> Camera active. Align student's QR code in frame.
              </div>
            </div>

            {verifyResult && (
              <div style={{
                marginTop: 20, padding: 18, borderRadius: "var(--radius-md)",
                background: verifyResult.valid ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                border: `1px solid ${verifyResult.valid ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
              }}>
                {verifyResult.valid ? (
                  <div>
                    <div style={{ color: "var(--success)", fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 17, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                      <CheckCircle2 size={20} /> Valid Gate Pass Verified
                    </div>
                    <div style={{ color: "var(--text)", fontSize: 14, display: "grid", gap: 6 }}>
                      <div><strong>Student:</strong> {verifyResult.pass.studentName} ({verifyResult.pass.registerNo})</div>
                      <div><strong>Department:</strong> {verifyResult.pass.dept} • Year {verifyResult.pass.year}</div>
                      <div><strong>Reason:</strong> {verifyResult.pass.reason}</div>
                      <div><strong>Destination:</strong> {verifyResult.pass.place}</div>
                      <div><strong>Return Time:</strong> {verifyResult.pass.inDate} {verifyResult.pass.inTime}</div>
                      <div><strong>Pass Token:</strong> <code style={{ color: "var(--highlight)" }}>{verifyResult.pass.token}</code></div>
                    </div>

                    {verifyResult.marked || verifyResult.pass.status === "verified_by_security" ? (
                      <div style={{
                        marginTop: 16, padding: "10px 14px", borderRadius: "var(--radius-sm)",
                        background: "rgba(16, 185, 129, 0.2)", color: "var(--success)",
                        fontWeight: 700, textAlign: "center", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8
                      }}>
                        <ShieldCheck size={18} /> Marked Verified & Gate Exit Granted
                      </div>
                    ) : (
                      <button
                        className="btn-primary"
                        onClick={handleMarkAsVerified}
                        disabled={marking}
                        style={{ marginTop: 16 }}
                      >
                        {marking ? "Recording Exit..." : "Grant Exit & Mark Verified"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ color: "var(--danger)", textAlign: "center" }}>
                    <AlertCircle size={28} color="var(--danger)" style={{ margin: "0 auto 8px" }} />
                    <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 16 }}>Access Denied</div>
                    <div style={{ fontSize: 13, marginTop: 4, opacity: 0.9 }}>{verifyResult.reason}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 16 }}>
              Recent Security Log
            </h3>
            {loadingRecent ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : recentScans.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 30 }}>
                No recent gate pass scans logged today.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {recentScans.map((pass) => (
                  <div key={pass.id} style={{
                    padding: "12px 14px", borderRadius: "var(--radius-sm)",
                    background: "rgba(11, 19, 43, 0.4)", border: "1px solid var(--border)"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{pass.studentName}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                          {pass.registerNo} • {pass.year}
                        </div>
                      </div>
                      <span className="badge badge-success" style={{ fontFamily: "monospace" }}>
                        {pass.token}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                      Verified: {formatDateTime(pass.verifiedBySecurityAt)}
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
