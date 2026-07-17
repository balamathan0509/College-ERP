// src/pages/officestaff/Fines.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";

const CATEGORY_STYLES = {
  "Disciplinary": { bg: "rgba(252,129,129,0.12)", color: "#fc8181", icon: "⚠️" },
  "Academic": { bg: "rgba(66,153,225,0.12)", color: "#4299e1", icon: "📚" },
  "Hostel": { bg: "rgba(159,122,234,0.12)", color: "#9f7aea", icon: "🏠" },
  "Library": { bg: "rgba(246,173,85,0.12)", color: "#f6ad55", icon: "📖" },
  "Other": { bg: "rgba(160,174,192,0.12)", color: "#a0aec0", icon: "📋" }
};

export default function OfficeStaffFines() {
  const { userProfile } = useAuth();
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState("pending"); // pending, approved, rejected
  const [selectedScreenshot, setSelectedScreenshot] = useState(null); // URL of screenshot to show in modal
  const [rejectionFine, setRejectionFine] = useState(null); // Fine object currently being rejected
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  async function fetchFines() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "fines"));
      const allFines = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      allFines.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setFines(allFines);
    } catch (err) {
      console.error("Error fetching fines:", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchFines();
  }, []);

  // Process fines into individual submission items
  const submissions = [];
  fines.forEach(fine => {
    if (fine.studentUid) {
      // Individual fine
      const hasPayment = fine.paymentDetails;
      if (hasPayment) {
        submissions.push({
          fineId: fine.id,
          type: "individual",
          studentUid: fine.studentUid,
          studentName: fine.studentName,
          studentRegisterNo: fine.studentRegisterNo,
          studentDept: fine.studentDept,
          studentYear: fine.studentYear,
          title: fine.title,
          category: fine.category,
          amount: fine.paymentDetails.amountPaid || fine.amount,
          baseAmount: fine.amount,
          dueDate: fine.dueDate,
          createdAt: fine.createdAt,
          createdBy: fine.createdBy,
          status: fine.paymentDetails.status || (fine.status === "paid" ? "approved" : "pending"),
          transactionId: fine.paymentDetails.transactionId,
          screenshotUrl: fine.paymentDetails.screenshotUrl,
          paidAt: fine.paymentDetails.paidAt,
          rejectionReason: fine.paymentDetails.rejectionReason,
          originalFine: fine
        });
      }
    } else if (fine.payments) {
      // Group/department-wide fine where students have paid
      Object.entries(fine.payments).forEach(([studentUid, payment]) => {
        submissions.push({
          fineId: fine.id,
          type: "group",
          studentUid: studentUid,
          studentName: payment.studentName || "Group Student",
          studentRegisterNo: payment.studentRegisterNo || "N/A",
          studentDept: payment.studentDept || fine.targetDept,
          studentYear: payment.studentYear || fine.targetYear,
          title: fine.title,
          category: fine.category,
          amount: payment.amountPaid || fine.amount,
          baseAmount: fine.amount,
          dueDate: fine.dueDate,
          createdAt: fine.createdAt,
          createdBy: fine.createdBy,
          status: payment.status || "pending",
          transactionId: payment.transactionId,
          screenshotUrl: payment.screenshotUrl,
          paidAt: payment.paidAt,
          rejectionReason: payment.rejectionReason,
          originalFine: fine
        });
      });
    }
  });

  // Filter submissions by user role (Only HOD is allowed to see/verify fine payments)
  const filteredSubmissions = submissions.filter(sub => {
    if (userProfile?.role === "hod") {
      return sub.studentDept === userProfile.dept;
    }
    return false;
  });

  // Filter submissions by tab
  const pendingSubmissions = filteredSubmissions.filter(s => s.status === "pending");
  const approvedSubmissions = filteredSubmissions.filter(s => s.status === "approved" || s.status === "verified");
  const rejectedSubmissions = filteredSubmissions.filter(s => s.status === "rejected" || s.status === "payment_rejected");

  const activeSubmissions = 
    filterTab === "pending" ? pendingSubmissions :
    filterTab === "approved" ? approvedSubmissions : rejectedSubmissions;

  async function handleApprove(sub) {
    if (window.confirm(`Are you sure you want to approve payment of ₹${sub.amount} for ${sub.studentName}?`)) {
      setActionLoading(true);
      try {
        const fineRef = doc(db, "fines", sub.fineId);
        if (sub.type === "individual") {
          await updateDoc(fineRef, {
            status: "paid",
            "paymentDetails.status": "approved",
            "paymentDetails.verifiedAt": new Date().toISOString(),
            "paymentDetails.verifiedBy": userProfile?.name || "Super Admin"
          });
        } else {
          // Group fine
          await updateDoc(fineRef, {
            [`payments.${sub.studentUid}.status`]: "verified",
            [`payments.${sub.studentUid}.verifiedAt`]: new Date().toISOString(),
            [`payments.${sub.studentUid}.verifiedBy`]: userProfile?.name || "Super Admin"
          });
        }
        await fetchFines();
      } catch (err) {
        console.error("Error approving payment:", err);
        alert("Failed to approve payment. Please try again.");
      }
      setActionLoading(false);
    }
  }

  async function handleRejectSubmit(e) {
    e.preventDefault();
    if (!rejectionReason.trim() || !rejectionFine) return;
    setActionLoading(true);
    const sub = rejectionFine;
    try {
      const fineRef = doc(db, "fines", sub.fineId);
      if (sub.type === "individual") {
        await updateDoc(fineRef, {
          status: "payment_rejected",
          "paymentDetails.status": "rejected",
          "paymentDetails.rejectionReason": rejectionReason.trim(),
          "paymentDetails.rejectedAt": new Date().toISOString(),
          "paymentDetails.rejectedBy": userProfile?.name || "Super Admin"
        });
      } else {
        // Group fine
        await updateDoc(fineRef, {
          [`payments.${sub.studentUid}.status`]: "rejected",
          [`payments.${sub.studentUid}.rejectionReason`]: rejectionReason.trim(),
          [`payments.${sub.studentUid}.rejectedAt`]: new Date().toISOString(),
          [`payments.${sub.studentUid}.rejectedBy`]: userProfile?.name || "Super Admin"
        });
      }
      setRejectionFine(null);
      setRejectionReason("");
      await fetchFines();
    } catch (err) {
      console.error("Error rejecting payment:", err);
      alert("Failed to reject payment. Please try again.");
    }
    setActionLoading(false);
  }

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>⚠️ Verify Student Fines</h1>
          <p>{userProfile?.dept} Department HOD Portal • Review UPI Payments & screenshots</p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card" style={{ borderLeft: "4px solid #f5a623" }}>
            <div className="stat-icon">⏳</div>
            <div className="stat-value" style={{ color: "#f5a623" }}>
              {loading ? "..." : pendingSubmissions.length}
            </div>
            <div className="stat-label">Pending Verification</div>
          </div>
          <div className="stat-card" style={{ borderLeft: "4px solid #48bb78" }}>
            <div className="stat-icon">✅</div>
            <div className="stat-value" style={{ color: "#48bb78" }}>
              {loading ? "..." : approvedSubmissions.length}
            </div>
            <div className="stat-label">Approved Payments</div>
          </div>
          <div className="stat-card" style={{ borderLeft: "4px solid #fc8181" }}>
            <div className="stat-icon">❌</div>
            <div className="stat-value" style={{ color: "#fc8181" }}>
              {loading ? "..." : rejectedSubmissions.length}
            </div>
            <div className="stat-label">Rejected Payments</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: 12 }}>
          {[
            { id: "pending", label: "Pending Verifications", count: pendingSubmissions.length, color: "#f5a623", bg: "rgba(245,166,35,0.15)" },
            { id: "approved", label: "Approved Payments", count: approvedSubmissions.length, color: "#48bb78", bg: "rgba(72,187,120,0.15)" },
            { id: "rejected", label: "Rejected Payments", count: rejectedSubmissions.length, color: "#fc8181", bg: "rgba(252,129,129,0.15)" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              style={{
                padding: "10px 20px",
                borderRadius: 20,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.2s",
                background: filterTab === tab.id ? tab.bg : "rgba(255,255,255,0.04)",
                color: filterTab === tab.id ? tab.color : "#a0aec0"
              }}
            >
              {tab.label} <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(255,255,255,0.1)", color: filterTab === tab.id ? "white" : "#a0aec0" }}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Content Body */}
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
            {activeSubmissions.map((sub, i) => {
              const catStyle = CATEGORY_STYLES[sub.category] || CATEGORY_STYLES["Other"];
              return (
                <div key={`${sub.fineId}_${sub.studentUid}_${i}`} className="card" style={{
                  borderLeft: `4px solid ${sub.status === "pending" ? "#f5a623" : sub.status === "approved" || sub.status === "verified" ? "#48bb78" : "#fc8181"}`,
                  display: "flex", flexDirection: "column", justifyContent: "space-between"
                }}>
                  <div>
                    {/* Top Badges */}
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: catStyle.bg, color: catStyle.color
                      }}>
                        {catStyle.icon} {sub.category}
                      </span>
                      <span style={{ fontSize: 12, color: "#a0aec0" }}>
                        Type: {sub.type === "individual" ? "Individual" : "Group"}
                      </span>
                    </div>

                    {/* Fine Title */}
                    <h3 style={{ fontFamily: "Syne", fontSize: 17, fontWeight: 700, marginBottom: 12 }}>
                      {sub.title}
                    </h3>

                    {/* Student details panel */}
                    <div style={{
                      padding: "10px 12px", borderRadius: 8, background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.06)", marginBottom: 16
                    }}>
                      <div style={{ fontWeight: 600, color: "white", fontSize: 14 }}>🧑‍🎓 {sub.studentName}</div>
                      <div style={{ fontSize: 12, color: "#e94560", fontWeight: 600, marginTop: 2 }}>{sub.studentRegisterNo}</div>
                      <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>{sub.studentDept} • {sub.studentYear}</div>
                    </div>

                    {/* Payment Info */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 12, marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#a0aec0" }}>UTR / UPI Transaction ID</div>
                        <div style={{ fontSize: 14, color: "white", fontFamily: "monospace", fontWeight: 700, marginTop: 2 }}>{sub.transactionId}</div>
                        
                        <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 10 }}>Amount Paid</div>
                        <div style={{ fontSize: 18, color: "#48bb78", fontWeight: 800, fontFamily: "Syne", marginTop: 2 }}>
                          ₹{sub.amount?.toLocaleString("en-IN")}
                        </div>
                        {sub.amount > sub.baseAmount && (
                          <div style={{ fontSize: 10, color: "#fc8181", marginTop: 4 }}>
                            Includes ₹{(sub.amount - sub.baseAmount).toLocaleString("en-IN")} late fee (+10%/day)
                          </div>
                        )}

                        {sub.paidAt && (
                          <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 10 }}>
                            Paid On: {new Date(sub.paidAt).toLocaleString("en-IN")}
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
                            <div style={{
                              position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              opacity: 0, transition: "opacity 0.2s", color: "white", fontSize: 10, fontWeight: 600
                            }}
                            onMouseOver={e => e.currentTarget.style.opacity = 1}
                            onMouseOut={e => e.currentTarget.style.opacity = 0}
                            >
                              🔍 View
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            width: "100%", height: 80, borderRadius: 8, 
                            border: "1px dashed rgba(255, 255, 255, 0.15)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, color: "#a0aec0", textAlign: "center"
                          }}>No Image</div>
                        )}
                      </div>
                    </div>

                    {/* Rejection reason display */}
                    {sub.rejectionReason && (
                      <div style={{
                        padding: "10px 12px", borderRadius: 8, background: "rgba(252, 129, 129, 0.08)",
                        border: "1px solid rgba(252, 129, 129, 0.2)", color: "#fc8181", fontSize: 12, marginBottom: 16
                      }}>
                        <strong>Rejection Reason:</strong> {sub.rejectionReason}
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  {sub.status === "pending" && (
                    <div style={{
                      display: "flex", gap: 10, marginTop: 12, paddingTop: 12,
                      borderTop: "1px solid rgba(255,255,255,0.06)"
                    }}>
                      <button
                        onClick={() => handleApprove(sub)}
                        disabled={actionLoading}
                        style={{
                          flex: 1, padding: "10px 14px", borderRadius: 8, border: "none",
                          background: "#48bb78", color: "white", fontWeight: 600, cursor: "pointer",
                          fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                        }}
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => setRejectionFine(sub)}
                        disabled={actionLoading}
                        style={{
                          flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(252, 129, 129, 0.4)",
                          background: "rgba(252, 129, 129, 0.08)", color: "#fc8181", fontWeight: 600, cursor: "pointer",
                          fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                        }}
                      >
                        ❌ Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Screenshot Preview */}
        {selectedScreenshot && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20
          }}
          onClick={() => setSelectedScreenshot(null)}
          >
            <div style={{
              position: "relative", maxWidth: "90%", maxHeight: "90%",
              background: "#161625", padding: 10, borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 10px 25px rgba(0,0,0,0.5)"
            }}
            onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedScreenshot(null)}
                style={{
                  position: "absolute", top: -15, right: -15, width: 30, height: 30,
                  borderRadius: "50%", background: "#e94560", border: "none", color: "white",
                  fontSize: 16, fontWeight: "bold", cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.3)"
                }}
              >✕</button>
              <img 
                src={selectedScreenshot} 
                alt="Payment proof zoom" 
                style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", borderRadius: 8 }}
              />
            </div>
          </div>
        )}

        {/* Modal: Reject Reason Request */}
        {rejectionFine && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20
          }}>
            <div style={{
              width: "100%", maxWidth: 450, background: "#161625", padding: 24, borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
              margin: "auto"
            }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 12, color: "#fc8181" }}>
                ❌ Reject Payment Verification
              </h3>
              <p style={{ color: "#a0aec0", fontSize: 13, marginBottom: 16 }}>
                Please specify the reason for rejecting the payment of ₹{rejectionFine.amount} submitted by {rejectionFine.studentName}. This reason will be shown to the student to help them resubmit.
              </p>

              <form onSubmit={handleRejectSubmit}>
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label>Rejection Reason *</label>
                  <textarea
                    rows="3"
                    placeholder="e.g. Screenshot blur, incorrect UTR number, amount mismatch..."
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    required
                    style={{
                      width: "100%", padding: 12, borderRadius: 10,
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      color: "white", fontFamily: "inherit", fontSize: 14, resize: "none"
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={actionLoading || !rejectionReason.trim()}
                    style={{ width: "auto", padding: "10px 20px", background: "#fc8181", border: "none" }}
                  >
                    {actionLoading ? "Rejecting..." : "Confirm Rejection"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectionFine(null);
                      setRejectionReason("");
                    }}
                    style={{
                      padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)",
                      background: "transparent", color: "white", cursor: "pointer", fontSize: 14
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
