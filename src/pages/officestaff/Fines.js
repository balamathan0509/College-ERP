// src/pages/officestaff/Fines.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import {
  AlertOctagon,
  BookOpen,
  Home,
  Book,
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  X
} from "lucide-react";

const CATEGORY_STYLES = {
  "Disciplinary": { bg: "rgba(239, 68, 68, 0.14)", color: "var(--danger)", icon: <AlertOctagon size={16} /> },
  "Academic": { bg: "rgba(37, 99, 235, 0.14)", color: "var(--highlight)", icon: <BookOpen size={16} /> },
  "Hostel": { bg: "rgba(139, 92, 246, 0.14)", color: "#8b5cf6", icon: <Home size={16} /> },
  "Library": { bg: "rgba(245, 158, 11, 0.14)", color: "var(--warning)", icon: <Book size={16} /> },
  "Other": { bg: "rgba(148, 163, 184, 0.14)", color: "var(--text-muted)", icon: <ClipboardList size={16} /> }
};

export default function OfficeStaffFines() {
  const { userProfile } = useAuth();
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState("pending");
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  const [rejectionFine, setRejectionFine] = useState(null);
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

  const submissions = [];
  fines.forEach(fine => {
    if (fine.studentUid) {
      const hasPayment = fine.paymentDetails;
      if (hasPayment) {
        submissions.push({
          fineId: fine.id,
          isGroup: false,
          studentUid: fine.studentUid,
          studentName: fine.studentName || "Student",
          studentRegisterNo: fine.studentRegisterNo || "N/A",
          studentDept: fine.studentDept || "",
          studentYear: fine.studentYear || "",
          fineTitle: fine.title,
          category: fine.category,
          originalAmount: fine.amount,
          amountPaid: fine.paymentDetails.amountPaid || fine.amount,
          transactionId: fine.paymentDetails.transactionId,
          screenshotUrl: fine.paymentDetails.screenshotUrl,
          paidAt: fine.paymentDetails.paidAt,
          status: fine.paymentDetails.status || "pending",
          rejectionReason: fine.paymentDetails.rejectionReason,
          rawFine: fine
        });
      }
    } else if (fine.payments) {
      Object.entries(fine.payments).forEach(([studentUid, payment]) => {
        submissions.push({
          fineId: fine.id,
          isGroup: true,
          studentUid,
          studentName: payment.studentName || "Student",
          studentRegisterNo: payment.studentRegisterNo || "N/A",
          studentDept: payment.studentDept || fine.targetDept || "",
          studentYear: payment.studentYear || fine.targetYear || "",
          fineTitle: fine.title,
          category: fine.category,
          originalAmount: fine.amount,
          amountPaid: payment.amountPaid || fine.amount,
          transactionId: payment.transactionId,
          screenshotUrl: payment.screenshotUrl,
          paidAt: payment.paidAt,
          status: payment.status || "pending",
          rejectionReason: payment.rejectionReason,
          rawFine: fine
        });
      });
    }
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
    if (!window.confirm(`Approve fine payment of ₹${sub.amountPaid} for ${sub.studentName}?`)) return;

    setActionLoading(true);
    try {
      const fineRef = doc(db, "fines", sub.fineId);
      const verifiedAt = new Date().toISOString();

      if (!sub.isGroup) {
        await updateDoc(fineRef, {
          status: "paid",
          "paymentDetails.status": "verified",
          "paymentDetails.verifiedAt": verifiedAt,
          "paymentDetails.verifiedBy": userProfile?.name || "Office Staff"
        });
      } else {
        await updateDoc(fineRef, {
          [`payments.${sub.studentUid}.status`]: "verified",
          [`payments.${sub.studentUid}.verifiedAt`]: verifiedAt,
          [`payments.${sub.studentUid}.verifiedBy`]: userProfile?.name || "Office Staff"
        });
      }

      await fetchFines();
    } catch (err) {
      console.error("Failed to approve payment:", err);
      alert("Error approving payment.");
    }
    setActionLoading(false);
  }

  async function handleConfirmReject() {
    if (!rejectionFine) return;
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejecting the payment.");
      return;
    }

    setActionLoading(true);
    try {
      const sub = rejectionFine;
      const fineRef = doc(db, "fines", sub.fineId);
      const rejectedAt = new Date().toISOString();

      if (!sub.isGroup) {
        await updateDoc(fineRef, {
          status: "active",
          "paymentDetails.status": "rejected",
          "paymentDetails.rejectionReason": rejectionReason.trim(),
          "paymentDetails.rejectedAt": rejectedAt,
          "paymentDetails.rejectedBy": userProfile?.name || "Office Staff"
        });
      } else {
        await updateDoc(fineRef, {
          [`payments.${sub.studentUid}.status`]: "rejected",
          [`payments.${sub.studentUid}.rejectionReason`]: rejectionReason.trim(),
          [`payments.${sub.studentUid}.rejectedAt`]: rejectedAt,
          [`payments.${sub.studentUid}.rejectedBy`]: userProfile?.name || "Office Staff"
        });
      }

      setRejectionFine(null);
      setRejectionReason("");
      await fetchFines();
    } catch (err) {
      console.error("Failed to reject payment:", err);
      alert("Error rejecting payment.");
    }
    setActionLoading(false);
  }

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Fine Verification & Audit</h1>
          <p>Review student UPI payment submissions & verify UTR records</p>
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
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading fine submissions...</div>
          ) : activeSubmissions.length === 0 ? (
            <div style={{ textAlign: "center", padding: 50, color: "var(--text-muted)" }}>
              No submissions found in this category.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Student Details</th>
                    <th>Fine Title & Category</th>
                    <th>12-Digit UTR Number</th>
                    <th>Amount Paid</th>
                    <th>Payment Date</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSubmissions.map((sub, idx) => {
                    const catStyle = CATEGORY_STYLES[sub.category] || CATEGORY_STYLES["Other"];

                    return (
                      <tr key={`${sub.fineId}-${sub.studentUid}-${idx}`}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{sub.studentName}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            Reg: {sub.studentRegisterNo} • {sub.studentDept} (Yr {sub.studentYear})
                          </div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 600 }}>{sub.fineTitle}</div>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                            background: catStyle.bg, color: catStyle.color, marginTop: 4
                          }}>
                            {catStyle.icon} {sub.category}
                          </span>
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
                                  onClick={() => { setRejectionFine(sub); setRejectionReason(""); }}
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
                    );
                  })}
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
      {rejectionFine && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          backdropFilter: "blur(8px)"
        }}>
          <div className="card" style={{ maxWidth: 440, width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 16, color: "var(--danger)" }}>Reject Payment</h3>
              <button
                onClick={() => setRejectionFine(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              Please enter the reason for rejecting {rejectionFine.studentName}'s payment. This will be shown to the student.
            </p>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Rejection Reason *</label>
              <textarea
                rows={3}
                placeholder="e.g. UTR number does not match bank records or screenshot is blurry"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                required
              />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                className="btn-secondary"
                onClick={() => setRejectionFine(null)}
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
