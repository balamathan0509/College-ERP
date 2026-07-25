// src/pages/officestaff/VerifyFees.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  CreditCard,
  Building2,
  Calendar
} from "lucide-react";

export default function VerifyFees() {
  const { userProfile } = useAuth();
  const [feesDocs, setFeesDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState("pending");
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  const [rejectionFee, setRejectionFee] = useState(null);
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
          amountPaid: payment.amountPaid || feeDoc.amount,
          transactionId: payment.transactionId,
          screenshotUrl: payment.screenshotUrl,
          paidAt: payment.paidAt,
          status: payment.status || "pending",
          rejectionReason: payment.rejectionReason,
          rawFeeDoc: feeDoc
        });
      }
    });
  });

  const pendingSubmissions = submissions.filter(s => s.status === "pending");
  const approvedSubmissions = submissions.filter(s => s.status === "verified");
  const rejectedSubmissions = submissions.filter(s => s.status === "rejected");

  const activeSubmissions = filterTab === "pending"
    ? pendingSubmissions
    : filterTab === "approved"
    ? approvedSubmissions
    : rejectedSubmissions;

  async function handleApprove(sub) {
    if (!window.confirm(`Approve fee payment of ₹${sub.amountPaid} for ${sub.studentName}?`)) return;

    setActionLoading(true);
    try {
      const docRef = doc(db, "fees", sub.docId);
      const verifiedAt = new Date().toISOString();

      await updateDoc(docRef, {
        [`payments.${sub.studentUid}`]: {
          ...sub.rawFeeDoc.payments?.[sub.studentUid],
          status: "verified",
          verifiedAt,
          verifiedBy: userProfile?.name || "Office Staff"
        }
      });

      await fetchFees();
    } catch (err) {
      console.error("Failed to approve fee payment:", err);
      alert("Error approving payment.");
    }
    setActionLoading(false);
  }

  async function handleConfirmReject() {
    if (!rejectionFee) return;
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejecting the payment.");
      return;
    }

    setActionLoading(true);
    try {
      const sub = rejectionFee;
      const docRef = doc(db, "fees", sub.docId);
      const rejectedAt = new Date().toISOString();

      await updateDoc(docRef, {
        [`payments.${sub.studentUid}`]: {
          ...sub.rawFeeDoc.payments?.[sub.studentUid],
          status: "rejected",
          rejectionReason: rejectionReason.trim(),
          rejectedAt,
          rejectedBy: userProfile?.name || "Office Staff"
        }
      });

      setRejectionFee(null);
      setRejectionReason("");
      await fetchFees();
    } catch (err) {
      console.error("Failed to reject fee payment:", err);
      alert("Error rejecting payment.");
    }
    setActionLoading(false);
  }

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Fee Payment Verification</h1>
          <p>Verify student tuition & mess fee payments (UTR & Screenshot Audit)</p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setFilterTab("pending")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Clock size={24} color="var(--warning)" />
            </div>
            <div className="stat-value" style={{ color: pendingSubmissions.length > 0 ? "var(--warning)" : "var(--success)" }}>
              {loading ? "..." : pendingSubmissions.length}
            </div>
            <div className="stat-label">Pending Verification</div>
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setFilterTab("approved")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <CheckCircle2 size={24} color="var(--success)" />
            </div>
            <div className="stat-value" style={{ color: "var(--success)" }}>{loading ? "..." : approvedSubmissions.length}</div>
            <div className="stat-label">Approved Payments</div>
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setFilterTab("rejected")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <XCircle size={24} color="var(--danger)" />
            </div>
            <div className="stat-value" style={{ color: "var(--danger)" }}>{loading ? "..." : rejectedSubmissions.length}</div>
            <div className="stat-label">Rejected Submissions</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
          <button
            onClick={() => setFilterTab("pending")}
            style={{
              padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.2s ease",
              background: filterTab === "pending" ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.04)",
              color: filterTab === "pending" ? "var(--warning)" : "var(--text-muted)"
            }}
          >
            Pending Verification ({pendingSubmissions.length})
          </button>
          <button
            onClick={() => setFilterTab("approved")}
            style={{
              padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.2s ease",
              background: filterTab === "approved" ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.04)",
              color: filterTab === "approved" ? "var(--success)" : "var(--text-muted)"
            }}
          >
            Approved History ({approvedSubmissions.length})
          </button>
          <button
            onClick={() => setFilterTab("rejected")}
            style={{
              padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.2s ease",
              background: filterTab === "rejected" ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.04)",
              color: filterTab === "rejected" ? "var(--danger)" : "var(--text-muted)"
            }}
          >
            Rejected History ({rejectedSubmissions.length})
          </button>
        </div>

        {/* Submissions Table / Cards */}
        <div className="card">
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading fee verification requests...</div>
          ) : activeSubmissions.length === 0 ? (
            <div style={{ textAlign: "center", padding: 50, color: "var(--text-muted)" }}>
              No fee submissions found in this category.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Student Details</th>
                    <th>Fee Type & Details</th>
                    <th>12-Digit UTR Number</th>
                    <th>Amount Paid</th>
                    <th>Payment Date</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSubmissions.map((sub, idx) => (
                    <tr key={`${sub.docId}-${sub.studentUid}-${idx}`}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{sub.studentName}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          Reg: {sub.studentRegisterNo} • {sub.studentDept} (Yr {sub.studentYear})
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {sub.feesType === "mess" ? "Monthly Mess Fee" : sub.feesType === "tuition" ? "Tuition Fee" : sub.feesType || "College Fee"}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                          {sub.month ? `Month: ${sub.month}` : `Dept: ${sub.dept || "All"} (Yr ${sub.year || "All"})`}
                        </div>
                      </td>

                      <td>
                        <div style={{
                          fontFamily: "monospace", fontSize: 13, fontWeight: 700,
                          color: "var(--highlight)", background: "rgba(37, 99, 235, 0.1)",
                          padding: "4px 10px", borderRadius: "var(--radius-sm)", display: "inline-block"
                        }}>
                          {sub.transactionId || "N/A"}
                        </div>
                      </td>

                      <td style={{ fontWeight: 700, color: "var(--success)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                        ₹{sub.amountPaid.toLocaleString("en-IN")}
                      </td>

                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {sub.paidAt ? new Date(sub.paidAt).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                        }) : "N/A"}
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                          {sub.screenshotUrl && (
                            <button
                              onClick={() => setSelectedScreenshot(sub.screenshotUrl)}
                              className="btn-secondary"
                              style={{ margin: 0, padding: "6px 12px", fontSize: 12, width: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              <Eye size={14} /> View Slip
                            </button>
                          )}

                          {filterTab === "pending" && (
                            <>
                              <button
                                onClick={() => handleApprove(sub)}
                                disabled={actionLoading}
                                style={{
                                  padding: "6px 14px", borderRadius: "var(--radius-sm)",
                                  background: "var(--success)", border: "none", color: "white",
                                  fontSize: 12, fontWeight: 600, cursor: "pointer"
                                }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => { setRejectionFee(sub); setRejectionReason(""); }}
                                disabled={actionLoading}
                                style={{
                                  padding: "6px 14px", borderRadius: "var(--radius-sm)",
                                  background: "var(--danger)", border: "none", color: "white",
                                  fontSize: 12, fontWeight: 600, cursor: "pointer"
                                }}
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Screenshot Preview Modal */}
      {selectedScreenshot && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          backdropFilter: "blur(8px)"
        }}>
          <div className="card" style={{ maxWidth: 600, width: "100%", textAlign: "center", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 16 }}>Payment Receipt Screenshot</h3>
              <button
                onClick={() => setSelectedScreenshot(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>
            <img
              src={selectedScreenshot}
              alt="Payment Slip"
              style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}
            />
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectionFee && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          backdropFilter: "blur(8px)"
        }}>
          <div className="card" style={{ maxWidth: 440, width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 16, color: "var(--danger)" }}>Reject Fee Payment</h3>
              <button
                onClick={() => setRejectionFee(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              Please enter the reason for rejecting {rejectionFee.studentName}'s fee payment.
            </p>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Rejection Reason *</label>
              <textarea
                rows={3}
                placeholder="e.g. UTR number incorrect or invalid transaction slip"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                required
              />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                className="btn-secondary"
                onClick={() => setRejectionFee(null)}
                style={{ width: "auto", margin: 0 }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmReject}
                disabled={actionLoading}
                style={{ width: "auto", background: "var(--danger)" }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
