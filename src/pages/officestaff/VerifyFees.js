// src/pages/officestaff/VerifyFees.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";

export default function VerifyFees() {
  const { userProfile } = useAuth();
  const [feesDocs, setFeesDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState("pending"); // pending, approved, rejected
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  const [rejectionFee, setRejectionFee] = useState(null); // Fee submission currently being rejected
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  async function fetchFees() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "fees"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFeesDocs(list);
    } catch (err) {
      console.error("Error fetching fees documents:", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchFees();
  }, []);

  // Process fees documents into individual student submissions
  const submissions = [];
  feesDocs.forEach(feeDoc => {
    const payments = feeDoc.payments || {};
    Object.entries(payments).forEach(([studentUid, payment]) => {
      const hasDetails = typeof payment === "object" && payment !== null;
      if (hasDetails) {
        submissions.push({
          docId: feeDoc.id,
          feesType: feeDoc.feesType,
          dept: feeDoc.dept,
          year: feeDoc.year,
          month: feeDoc.month,
          studentUid,
          studentName: payment.studentName || "Student",
          studentRegisterNo: payment.studentRegisterNo || "N/A",
          studentDept: payment.studentDept || feeDoc.dept,
          studentYear: payment.studentYear || feeDoc.year,
          status: payment.status || "pending",
          transactionId: payment.transactionId,
          screenshotUrl: payment.screenshotUrl,
          amountPaid: payment.amountPaid,
          submittedAt: payment.submittedAt,
          rejectionReason: payment.rejectionReason,
          verifiedAt: payment.verifiedAt,
          verifiedBy: payment.verifiedBy,
          rejectedAt: payment.rejectedAt,
          rejectedBy: payment.rejectedBy
        });
      } else if (payment === true) {
        submissions.push({
          docId: feeDoc.id,
          feesType: feeDoc.feesType,
          dept: feeDoc.dept,
          year: feeDoc.year,
          month: feeDoc.month,
          studentUid,
          studentName: "Marked Manually",
          studentRegisterNo: "N/A",
          studentDept: feeDoc.dept,
          studentYear: feeDoc.year,
          status: "approved",
          amountPaid: 0,
          submittedAt: feeDoc.updatedAt
        });
      }
    });
  });

  const pendingSubmissions = submissions.filter(s => s.status === "pending");
  const approvedSubmissions = submissions.filter(s => s.status === "approved");
  const rejectedSubmissions = submissions.filter(s => s.status === "rejected");

  const activeSubmissions =
    filterTab === "pending" ? pendingSubmissions :
    filterTab === "approved" ? approvedSubmissions : rejectedSubmissions;

  async function handleApprove(sub) {
    if (window.confirm(`Are you sure you want to approve the fee payment of ₹${sub.amountPaid} for ${sub.studentName}?`)) {
      setActionLoading(true);
      try {
        const feeDocRef = doc(db, "fees", sub.docId);
        await updateDoc(feeDocRef, {
          [`payments.${sub.studentUid}`]: {
            status: "approved",
            transactionId: sub.transactionId || "",
            screenshotUrl: sub.screenshotUrl || "",
            amountPaid: sub.amountPaid || 0,
            submittedAt: sub.submittedAt || "",
            verifiedAt: new Date().toISOString(),
            verifiedBy: userProfile?.name || "Office Staff"
          }
        });
        await fetchFees();
      } catch (err) {
        console.error("Error approving payment:", err);
        alert("Failed to approve payment. Please try again.");
      }
      setActionLoading(false);
    }
  }

  async function handleRejectSubmit(e) {
    e.preventDefault();
    if (!rejectionReason.trim() || !rejectionFee) return;
    setActionLoading(true);
    const sub = rejectionFee;
    try {
      const feeDocRef = doc(db, "fees", sub.docId);
      await updateDoc(feeDocRef, {
        [`payments.${sub.studentUid}`]: {
          status: "rejected",
          transactionId: sub.transactionId || "",
          screenshotUrl: sub.screenshotUrl || "",
          amountPaid: sub.amountPaid || 0,
          submittedAt: sub.submittedAt || "",
          rejectionReason: rejectionReason.trim(),
          rejectedAt: new Date().toISOString(),
          rejectedBy: userProfile?.name || "Office Staff"
        }
      });
      setRejectionFee(null);
      setRejectionReason("");
      await fetchFees();
    } catch (err) {
      console.error("Error rejecting payment:", err);
      alert("Failed to reject payment. Please try again.");
    }
    setActionLoading(false);
  }

  const tabContainerStyle = {
    display: "flex", gap: 12, marginBottom: 24, borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: 12
  };

  const statCardPending = { borderLeft: "4px solid #f5a623" };
  const statCardApproved = { borderLeft: "4px solid #48bb78" };
  const statCardRejected = { borderLeft: "4px solid #fc8181" };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>💰 Verify Student Fees</h1>
          <p>Office Staff Portal • Review fee payments & screenshots</p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card" style={statCardPending}>
            <div className="stat-icon">⏳</div>
            <div className="stat-value" style={{ color: "#f5a623" }}>
              {loading ? "..." : pendingSubmissions.length}
            </div>
            <div className="stat-label">Pending Verification</div>
          </div>
          <div className="stat-card" style={statCardApproved}>
            <div className="stat-icon">✅</div>
            <div className="stat-value" style={{ color: "#48bb78" }}>
              {loading ? "..." : approvedSubmissions.length}
            </div>
            <div className="stat-label">Approved Payments</div>
          </div>
          <div className="stat-card" style={statCardRejected}>
            <div className="stat-icon">❌</div>
            <div className="stat-value" style={{ color: "#fc8181" }}>
              {loading ? "..." : rejectedSubmissions.length}
            </div>
            <div className="stat-label">Rejected Payments</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={tabContainerStyle}>
          {[
            { id: "pending", label: "Pending", count: pendingSubmissions.length, color: "#f5a623", bg: "rgba(245,166,35,0.15)" },
            { id: "approved", label: "Approved", count: approvedSubmissions.length, color: "#48bb78", bg: "rgba(72,187,120,0.15)" },
            { id: "rejected", label: "Rejected", count: rejectedSubmissions.length, color: "#fc8181", bg: "rgba(252,129,129,0.15)" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              style={{
                padding: "10px 20px", borderRadius: 20, border: "none", cursor: "pointer",
                fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8,
                transition: "all 0.2s",
                background: filterTab === tab.id ? tab.bg : "rgba(255,255,255,0.04)",
                color: filterTab === tab.id ? tab.color : "#a0aec0"
              }}
            >
              {tab.label} <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(255,255,255,0.1)", color: filterTab === tab.id ? "white" : "#a0aec0" }}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Submissions list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div className="spinner" style={{ margin: "0 auto" }}></div>
          </div>
        ) : activeSubmissions.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 60, color: "#a0aec0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <h3>No submissions found</h3>
            <p style={{ marginTop: 8 }}>There are no payments in the "{filterTab}" category.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: 20 }}>
            {activeSubmissions.map((sub, i) => (
              <div key={`${sub.docId}_${sub.studentUid}_${i}`} className="card" style={{
                borderLeft: `4px solid ${sub.status === "pending" ? "#f5a623" : sub.status === "approved" ? "#48bb78" : "#fc8181"}`,
                display: "flex", flexDirection: "column", justifyContent: "space-between"
              }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
                    <span style={{
                      padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: "rgba(66, 153, 225, 0.15)", color: "#4299e1"
                    }}>
                      💰 {sub.feesType}
                    </span>
                    <span style={{ fontSize: 11, color: "#a0aec0" }}>{sub.month}</span>
                  </div>

                  <h3 style={{ fontFamily: "Syne", fontSize: 17, fontWeight: 700, marginBottom: 12 }}>
                    🧑‍🎓 {sub.studentName}
                  </h3>

                  {/* Student details panel */}
                  <div style={{
                    padding: "10px 12px", borderRadius: 8, background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)", marginBottom: 16
                  }}>
                    <div style={{ fontSize: 12, color: "#e94560", fontWeight: 600 }}>{sub.studentRegisterNo}</div>
                    <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>{sub.studentDept} • {sub.studentYear}</div>
                  </div>

                  {/* Payment Info */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 12, marginBottom: 16 }}>
                    <div>
                      {sub.transactionId && (
                        <>
                          <div style={{ fontSize: 11, color: "#a0aec0" }}>UTR / UPI Transaction ID</div>
                          <div style={{ fontSize: 14, color: "white", fontFamily: "monospace", fontWeight: 700, marginTop: 2 }}>{sub.transactionId}</div>
                        </>
                      )}
                      
                      <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 10 }}>Amount Paid</div>
                      <div style={{ fontSize: 18, color: "#48bb78", fontWeight: 800, fontFamily: "Syne", marginTop: 2 }}>₹{sub.amountPaid?.toLocaleString("en-IN")}</div>

                      {sub.submittedAt && (
                        <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 10 }}>
                          Submitted: {new Date(sub.submittedAt).toLocaleString("en-IN")}
                        </div>
                      )}
                    </div>

                    {/* Screenshot proof */}
                    <div>
                      <div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4, textAlign: "center" }}>Proof</div>
                      {sub.screenshotUrl ? (
                        <div 
                          onClick={() => setSelectedScreenshot(sub.screenshotUrl)}
                          style={{
                            width: "100%", height: 80, borderRadius: 8, overflow: "hidden", 
                            border: "1px solid rgba(255, 255, 255, 0.15)", cursor: "pointer",
                            position: "relative", background: "#0f0f1b"
                          }}
                        >
                          <img 
                            src={sub.screenshotUrl} 
                            alt="Proof screenshot" 
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: "#a0aec0", textAlign: "center", paddingTop: 20 }}>No Proof</div>
                      )}
                    </div>
                  </div>

                  {/* Rejection / Approval Info banner */}
                  {sub.status === "rejected" && sub.rejectionReason && (
                    <div style={{
                      padding: "10px 12px", borderRadius: 8, background: "rgba(252,129,129,0.06)",
                      border: "1px solid rgba(252,129,129,0.12)", color: "#fc8181", fontSize: 12, marginBottom: 12
                    }}>
                      <strong>Reason:</strong> {sub.rejectionReason}
                      {sub.rejectedBy && <div style={{ fontSize: 10, color: "#a0aec0", marginTop: 4 }}>By: {sub.rejectedBy}</div>}
                    </div>
                  )}

                  {sub.status === "approved" && sub.verifiedBy && (
                    <div style={{
                      padding: "10px 12px", borderRadius: 8, background: "rgba(72,187,120,0.06)",
                      border: "1px solid rgba(72,187,120,0.12)", color: "#48bb78", fontSize: 12, marginBottom: 12
                    }}>
                      Approved by {sub.verifiedBy}
                    </div>
                  )}
                </div>

                {/* Verification Actions */}
                {sub.status === "pending" && (
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button
                      disabled={actionLoading}
                      onClick={() => handleApprove(sub)}
                      className="btn-primary"
                      style={{ flex: 1, height: 34, fontSize: 13, background: "#48bb78", border: "none" }}
                    >
                      Approve
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={() => setRejectionFee(sub)}
                      className="btn-primary"
                      style={{ flex: 1, height: 34, fontSize: 13, background: "#fc8181", border: "none" }}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Proof Viewer Modal */}
      {selectedScreenshot && (
        <div 
          onClick={() => setSelectedScreenshot(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.9)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20
          }}
        >
          <img 
            src={selectedScreenshot} 
            alt="Proof enlarged" 
            style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 8, border: "2px solid rgba(255,255,255,0.2)" }}
          />
        </div>
      )}

      {/* Rejection Dialog Modal */}
      {rejectionFee && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div className="card" style={{ width: "100%", maxWidth: 450, background: "#161625", padding: 24, borderRadius: 16 }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 18, color: "white", marginBottom: 12 }}>Reject Fee Payment</h3>
            <form onSubmit={handleRejectSubmit}>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Reason for Rejection *</label>
                <textarea
                  required
                  placeholder="e.g. UTR matches an existing receipt, invalid screenshot..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="form-control"
                  style={{
                    background: "#0f0f1b", border: "1px solid rgba(255,255,255,0.1)",
                    color: "white", padding: 10, borderRadius: 8, width: "100%", minHeight: 100, marginTop: 6, resize: "vertical"
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => {
                    setRejectionFee(null);
                    setRejectionReason("");
                  }}
                  className="btn-primary"
                  style={{ background: "#4a5568", border: "none", padding: "8px 16px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary"
                  style={{ background: "#fc8181", border: "none", padding: "8px 16px" }}
                >
                  Reject Submission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
