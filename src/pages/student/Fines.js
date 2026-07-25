// src/pages/student/Fines.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertOctagon,
  BookOpen,
  Home,
  Book,
  ClipboardList,
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  QrCode,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  Upload
} from "lucide-react";

const CATEGORY_STYLES = {
  "Disciplinary": { bg: "rgba(239, 68, 68, 0.14)", color: "var(--danger)", icon: <AlertOctagon size={16} /> },
  "Academic": { bg: "rgba(37, 99, 235, 0.14)", color: "var(--highlight)", icon: <BookOpen size={16} /> },
  "Hostel": { bg: "rgba(139, 92, 246, 0.14)", color: "#8b5cf6", icon: <Home size={16} /> },
  "Library": { bg: "rgba(245, 158, 11, 0.14)", color: "var(--warning)", icon: <Book size={16} /> },
  "Other": { bg: "rgba(148, 163, 184, 0.14)", color: "var(--text-muted)", icon: <ClipboardList size={16} /> }
};

export default function StudentFines() {
  const { currentUser, userProfile } = useAuth();
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper to calculate daily interest breakdown (10% per day past due date)
  function getFineBreakdown(fine, studentUid) {
    const baseAmount = fine.amount || 0;
    if (!fine.dueDate) {
      return { total: baseAmount, daysLate: 0, lateFee: 0 };
    }

    const payment = fine.payments?.[studentUid];
    if (payment && (payment.status === "verified" || payment.status === "pending" || payment.paidAt)) {
      const totalPaid = payment.amountPaid || baseAmount;
      return { total: totalPaid, daysLate: 0, lateFee: totalPaid - baseAmount };
    } else if (fine.studentUid && (fine.status === "paid" || fine.paymentDetails?.status === "pending" || fine.paymentDetails?.paidAt)) {
      const totalPaid = fine.paymentDetails?.amountPaid || baseAmount;
      return { total: totalPaid, daysLate: 0, lateFee: totalPaid - baseAmount };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(fine.dueDate);
    due.setHours(0, 0, 0, 0);

    if (today > due) {
      const diffTime = today - due;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        const lateFee = baseAmount * 0.1 * diffDays;
        return { total: baseAmount + lateFee, daysLate: diffDays, lateFee };
      }
    }

    return { total: baseAmount, daysLate: 0, lateFee: 0 };
  }

  // Helper to compress screenshot to Base64 locally
  function compressAndToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const maxDim = 1000;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  }

  // Modal & Payment states
  const [payingFine, setPayingFine] = useState(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [currentTab, setCurrentTab] = useState("active");
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch fines assigned to student or matching student's dept/year
  async function fetchMyFines() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "fines"));
      const allFines = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const myFines = allFines.filter(f => {
        if (f.studentUid) {
          return f.studentUid === currentUser.uid;
        }
        const deptMatch = f.targetDept === "all" || f.targetDept === userProfile.dept;
        const yearMatch = f.targetYear === "all" || f.targetYear === userProfile.year;
        return deptMatch && yearMatch;
      });

      myFines.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setFines(myFines);
    } catch (err) {
      console.error("Failed to fetch fines:", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (currentUser && userProfile) {
      fetchMyFines();
    }
  }, [currentUser, userProfile]);

  function getStudentFineStatus(fine) {
    if (fine.studentUid) {
      return fine.status;
    }
    const payment = fine.payments?.[currentUser.uid];
    if (!payment) return "active";
    if (payment.status === "verified") return "paid";
    if (payment.status === "pending") return "pending";
    if (payment.status === "rejected") return "rejected";
    return "active";
  }

  const activeFinesList = fines.filter(f => {
    const s = getStudentFineStatus(f);
    return s === "active" || s === "pending" || s === "rejected";
  });

  const historyFinesList = fines.filter(f => getStudentFineStatus(f) === "paid");

  const activeTabFines = currentTab === "active" ? activeFinesList : historyFinesList;

  const categories = Array.from(new Set(activeTabFines.map(f => f.category || "Other")));

  const filteredFines = filterCategory === "all"
    ? activeTabFines
    : activeTabFines.filter(f => (f.category || "Other") === filterCategory);

  const unpaidCount = activeFinesList.filter(f => getStudentFineStatus(f) === "active" || getStudentFineStatus(f) === "rejected").length;
  const totalAmount = activeFinesList.reduce((sum, f) => {
    const s = getStudentFineStatus(f);
    if (s === "active" || s === "rejected") {
      return sum + getFineBreakdown(f, currentUser.uid).total;
    }
    return sum;
  }, 0);

  function getAmountColor(amount) {
    if (amount > 1000) return "var(--danger)";
    if (amount > 500) return "var(--warning)";
    return "var(--highlight)";
  }

  function getUpiUri(fine) {
    const breakdown = getFineBreakdown(fine, currentUser.uid);
    const amount = breakdown.total;
    const upiId = "9842491176@ptsbi";
    const name = encodeURIComponent("College Portal Fines");
    const note = encodeURIComponent(`Fine: ${fine.title || "College Fine"}`);
    return `upi://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR&tn=${note}`;
  }

  async function handlePaymentSubmit(e) {
    e.preventDefault();
    if (!payingFine) return;

    if (!screenshotFile) {
      setErrorMsg("Please select a screenshot file.");
      return;
    }

    if (!/^\d{12}$/.test(utrNumber.trim())) {
      setErrorMsg("Please enter a valid 12-digit UPI Transaction ID (UTR number).");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    setUploadProgress(10);

    try {
      setUploadProgress(50);
      const screenshotUrl = await compressAndToBase64(screenshotFile);
      setUploadProgress(100);

      const fineDocRef = doc(db, "fines", payingFine.id);
      const timestamp = new Date().toISOString();
      const currentCalculatedAmount = getFineBreakdown(payingFine, currentUser.uid).total;

      if (payingFine.studentUid) {
        await updateDoc(fineDocRef, {
          status: "pending_verification",
          paymentDetails: {
            transactionId: utrNumber.trim(),
            screenshotUrl,
            paidAt: timestamp,
            status: "pending",
            amountPaid: currentCalculatedAmount
          }
        });
      } else {
        await updateDoc(fineDocRef, {
          [`payments.${currentUser.uid}`]: {
            transactionId: utrNumber.trim(),
            screenshotUrl,
            paidAt: timestamp,
            status: "pending",
            studentName: userProfile?.name || "Student",
            studentRegisterNo: userProfile?.registerNo || "N/A",
            studentDept: userProfile?.dept || "",
            studentYear: userProfile?.year || "",
            amountPaid: currentCalculatedAmount
          }
        });
      }

      setPayingFine(null);
      setUtrNumber("");
      setScreenshotFile(null);
      setUploadProgress(0);
      await fetchMyFines();
    } catch (err) {
      console.error("Payment submission failed:", err);
      setErrorMsg("Failed to upload files or submit transaction details. Please try again.");
    }
    setSubmitting(false);
  }

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>My Fines & Penalties</h1>
          <p>{userProfile?.dept} Department • Year {userProfile?.year}</p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <AlertOctagon size={24} color="var(--danger)" />
            </div>
            <div className="stat-value" style={{ color: unpaidCount > 0 ? "var(--danger)" : "var(--success)" }}>
              {loading ? "..." : unpaidCount}
            </div>
            <div className="stat-label">Active Fines</div>
            {!loading && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                {unpaidCount > 0 ? "Pending payment" : "All cleared"}
              </div>
            )}
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <DollarSign size={24} color="var(--warning)" />
            </div>
            <div className="stat-value" style={{ color: totalAmount > 0 ? "var(--danger)" : "var(--success)" }}>
              {loading ? "..." : `₹${totalAmount.toLocaleString("en-IN")}`}
            </div>
            <div className="stat-label">Unpaid Fine Amount</div>
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <ClipboardList size={24} color="var(--highlight)" />
            </div>
            <div className="stat-value">{loading ? "..." : categories.length}</div>
            <div className="stat-label">Categories</div>
          </div>
        </div>

        {/* Active Unpaid Alert */}
        {!loading && totalAmount > 0 && (
          <div style={{
            padding: "16px 20px", borderRadius: "var(--radius-md)", marginBottom: 24,
            background: totalAmount > 500 ? "rgba(239, 68, 68, 0.1)" : "rgba(245, 158, 11, 0.1)",
            border: `1px solid ${totalAmount > 500 ? "rgba(239, 68, 68, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
            display: "flex", alignItems: "center", gap: 14
          }}>
            <AlertTriangle size={24} color={totalAmount > 500 ? "var(--danger)" : "var(--warning)"} />
            <div>
              <div style={{
                fontWeight: 700, fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 15,
                color: totalAmount > 500 ? "var(--danger)" : "var(--warning)"
              }}>
                Pending Fine Total: ₹{totalAmount.toLocaleString("en-IN")}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
                You have {unpaidCount} unpaid fine{unpaidCount > 1 ? "s" : ""}. Click "Pay Now" to make a secure online payment.
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
          <button
            onClick={() => { setCurrentTab("active"); setFilterCategory("all"); }}
            style={{
              padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.2s ease",
              background: currentTab === "active" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
              color: currentTab === "active" ? "var(--highlight)" : "var(--text-muted)"
            }}
          >
            Fines to Pay ({activeFinesList.length})
          </button>
          <button
            onClick={() => { setCurrentTab("history"); setFilterCategory("all"); }}
            style={{
              padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.2s ease",
              background: currentTab === "history" ? "rgba(16, 185, 129, 0.18)" : "rgba(255,255,255,0.04)",
              color: currentTab === "history" ? "var(--success)" : "var(--text-muted)"
            }}
          >
            Payment History ({historyFinesList.length})
          </button>
        </div>

        {/* No Fines State */}
        {!loading && activeTabFines.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <CheckCircle2 size={48} color="var(--success)" />
            </div>
            <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 18, marginBottom: 8 }}>
              {currentTab === "active" ? "All Cleared" : "No Payments Found"}
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
              {currentTab === "active" ? "You have no pending fines assigned." : "You haven't submitted any payments yet."}
            </p>
          </div>
        )}

        {/* Category Filters */}
        {!loading && activeTabFines.length > 0 && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              <button
                onClick={() => setFilterCategory("all")}
                style={{
                  padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, transition: "all 0.2s ease",
                  background: filterCategory === "all" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)",
                  color: filterCategory === "all" ? "var(--text)" : "var(--text-muted)"
                }}
              >
                All ({activeTabFines.length})
              </button>
              {categories.map(cat => {
                const style = CATEGORY_STYLES[cat] || CATEGORY_STYLES["Other"];
                const count = activeTabFines.filter(f => f.category === cat).length;
                if (count === 0) return null;
                return (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    style={{
                      padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                      fontSize: 12, fontWeight: 600, transition: "all 0.2s ease",
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: filterCategory === cat ? style.bg : "rgba(255,255,255,0.04)",
                      color: filterCategory === cat ? style.color : "var(--text-muted)"
                    }}
                  >
                    {style.icon} {cat} ({count})
                  </button>
                );
              })}
            </div>

            {/* Fines List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {filteredFines.map(fine => {
                const breakdown = getFineBreakdown(fine, currentUser.uid);
                const catStyle = CATEGORY_STYLES[fine.category] || CATEGORY_STYLES["Other"];
                const amtColor = getAmountColor(fine.amount);
                const fineStatus = getStudentFineStatus(fine);

                let statusBadge = null;
                let cardBorder = amtColor;
                if (fineStatus === "pending") {
                  statusBadge = { text: "Pending Verification", bg: "rgba(245,158,11,0.14)", color: "var(--warning)" };
                  cardBorder = "var(--warning)";
                } else if (fineStatus === "paid") {
                  statusBadge = { text: "Paid & Verified", bg: "rgba(16,185,129,0.14)", color: "var(--success)" };
                  cardBorder = "var(--success)";
                } else if (fineStatus === "rejected") {
                  statusBadge = { text: "Payment Rejected", bg: "rgba(239,68,68,0.14)", color: "var(--danger)" };
                  cardBorder = "var(--danger)";
                }

                const rejectionReason = fine.studentUid 
                  ? fine.paymentDetails?.rejectionReason 
                  : fine.payments?.[currentUser.uid]?.rejectionReason;

                return (
                  <div key={fine.id} className="card" style={{
                    borderLeft: `4px solid ${cardBorder}`,
                    display: "flex", flexDirection: "row", justifyContent: "space-between",
                    alignItems: "center", gap: 24, flexWrap: "wrap", padding: "20px 24px"
                  }}>
                    {/* Left Column: Details & Metadata */}
                    <div style={{ flex: "1 1 450px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                          background: catStyle.bg, color: catStyle.color
                        }}>
                          {catStyle.icon} {fine.category || "General"}
                        </div>

                        {statusBadge && (
                          <div style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                            background: statusBadge.bg, color: statusBadge.color
                          }}>
                            {fineStatus === "pending" && <Clock size={14} />}
                            {fineStatus === "paid" && <CheckCircle2 size={14} />}
                            {fineStatus === "rejected" && <XCircle size={14} />}
                            {statusBadge.text}
                          </div>
                        )}
                      </div>

                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 6, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                        {fine.title}
                      </h3>
                      {fine.description && (
                        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
                          {fine.description}
                        </p>
                      )}

                      {fineStatus === "rejected" && rejectionReason && (
                        <div style={{
                          padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "rgba(239, 68, 68, 0.12)",
                          border: "1px solid rgba(239, 68, 68, 0.3)", color: "var(--danger)",
                          fontSize: 13, marginBottom: 12, fontWeight: 500
                        }}>
                          <strong>Rejection Reason:</strong> {rejectionReason}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)", flexWrap: "wrap" }}>
                        {fine.dueDate && (
                          <div style={{ color: "var(--danger)", fontWeight: 600 }}>
                            Due Date: {new Date(fine.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        )}
                        <div>
                          Imposed: {fine.createdAt ? new Date(fine.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "N/A"} • By {fine.createdBy || "Office"}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Amount & Action Button */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12, flex: "0 0 200px", minWidth: 150 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Fine Amount</div>
                        <div style={{
                          fontSize: 26, fontWeight: 800, fontFamily: "Plus Jakarta Sans, sans-serif",
                          color: cardBorder, marginTop: 2
                        }}>
                          ₹{breakdown.total.toLocaleString("en-IN")}
                        </div>
                        {breakdown.daysLate > 0 && (
                          <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4, fontWeight: 500 }}>
                            {breakdown.daysLate} days late (+₹{breakdown.lateFee.toLocaleString("en-IN")})
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      {fineStatus === "active" && (
                        <button
                          onClick={() => setPayingFine(fine)}
                          className="btn-primary"
                          style={{ padding: "8px 16px", fontSize: 13, width: "auto" }}
                        >
                          <CreditCard size={14} /> Pay Now (UPI)
                        </button>
                      )}
                      {fineStatus === "rejected" && (
                        <button
                          onClick={() => setPayingFine(fine)}
                          className="btn-primary"
                          style={{ padding: "8px 16px", fontSize: 13, background: "var(--danger)", width: "auto" }}
                        >
                          <RefreshCw size={14} /> Resubmit Payment
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* UPI Payment Modal */}
      {payingFine && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          backdropFilter: "blur(8px)"
        }}>
          <div className="card" style={{
            width: "100%", maxWidth: 480, padding: 28, borderRadius: "var(--radius-lg)",
            overflowY: "auto", maxHeight: "90vh", margin: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <QrCode size={22} color="var(--highlight)" />
                <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 18, color: "var(--text)", fontWeight: 700 }}>
                  UPI Payment Gateway
                </h3>
              </div>
              <button
                onClick={() => {
                  setPayingFine(null);
                  setErrorMsg("");
                  setUtrNumber("");
                  setScreenshotFile(null);
                }}
                style={{
                  background: "transparent", border: "none", color: "var(--text-muted)",
                  cursor: "pointer"
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Fine Header */}
            <div style={{
              background: "rgba(11, 19, 43, 0.6)", padding: 16, borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)", marginBottom: 20
            }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Payment Item</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>{payingFine.title}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Category: {payingFine.category}</span>
                <div style={{ textAlign: "right" }}>
                  {getFineBreakdown(payingFine, currentUser.uid).daysLate > 0 && (
                    <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 2 }}>
                      Base: ₹{payingFine.amount} + Late Fee: ₹{getFineBreakdown(payingFine, currentUser.uid).lateFee.toLocaleString("en-IN")}
                    </div>
                  )}
                  <span style={{ fontSize: 22, fontWeight: 800, color: "var(--success)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                    ₹{getFineBreakdown(payingFine, currentUser.uid).total.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            {/* Local QR Code */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{
                background: "white", padding: 14, borderRadius: "var(--radius-md)",
                display: "inline-block", boxShadow: "var(--shadow-md)"
              }}>
                <QRCodeSVG value={getUpiUri(payingFine)} size={170} />
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
                Scan using Google Pay, PhonePe, Paytm, or BHIM UPI app
              </p>
            </div>

            {/* Pay via UPI App (Mobile deep link) */}
            <div style={{ marginBottom: 20 }}>
              <a
                href={getUpiUri(payingFine)}
                className="btn-primary"
                style={{
                  textDecoration: "none", width: "100%", textAlign: "center"
                }}
              >
                <CreditCard size={16} /> Pay via UPI App (Mobile Only)
              </a>
            </div>

            <div style={{ height: 1, background: "var(--border)", marginBottom: 20 }}></div>

            {/* Submission Form */}
            <form onSubmit={handlePaymentSubmit}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>12-Digit UPI Transaction ID (UTR) *</label>
                <input
                  type="text"
                  placeholder="e.g. 304589214732"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  maxLength={12}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Upload Payment Screenshot *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setScreenshotFile(e.target.files[0])}
                  required
                />
              </div>

              {errorMsg && <div className="error-msg">{errorMsg}</div>}

              <button
                type="submit"
                className="btn-primary"
                disabled={submitting}
              >
                {submitting ? `Submitting... ${uploadProgress}%` : "Submit Payment Verification"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
