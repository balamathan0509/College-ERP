// src/pages/student/Fines.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";

const CATEGORY_STYLES = {
  "Disciplinary": { bg: "rgba(252,129,129,0.12)", color: "#fc8181", icon: "⚠️" },
  "Academic": { bg: "rgba(66,153,225,0.12)", color: "#4299e1", icon: "📚" },
  "Hostel": { bg: "rgba(159,122,234,0.12)", color: "#9f7aea", icon: "🏠" },
  "Library": { bg: "rgba(246,173,85,0.12)", color: "#f6ad55", icon: "📖" },
  "Other": { bg: "rgba(160,174,192,0.12)", color: "#a0aec0", icon: "📋" }
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

    // If student already paid/pending, check if amountPaid is saved
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
  
  // Tabs: "active" (unpaid/rejected), "history" (pending verification/paid)
  const [currentTab, setCurrentTab] = useState("active");
  const [filterCategory, setFilterCategory] = useState("all");

  // Payment Modal State
  const [payingFine, setPayingFine] = useState(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function fetchMyFines() {
    setLoading(true);
    try {
      // Fetch all fines in the system
      const snap = await getDocs(collection(db, "fines"));
      const allFines = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      allFines.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      // Filter fines applicable to this student
      const myDept = userProfile?.dept;
      const myYear = userProfile?.year;
      const myUid = currentUser?.uid;

      const applicable = allFines.filter(f => {
        if (f.studentUid) {
          return f.studentUid === myUid;
        }
        const deptMatch = f.targetDept === "all" || f.targetDept === myDept;
        const yearMatch = f.targetYear === "all" || f.targetYear === myYear;
        return deptMatch && yearMatch;
      });

      setFines(applicable);
    } catch (err) {
      console.error("Error fetching student fines:", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (userProfile && currentUser) {
      fetchMyFines();
    }
  }, [userProfile, currentUser]);

  // Helper to categorize fine status for current student
  function getStudentFineStatus(fine) {
    if (fine.studentUid) {
      // Individual fine
      const pStatus = fine.paymentDetails?.status;
      if (fine.status === "paid" || pStatus === "approved") return "paid";
      if (fine.status === "pending_verification" || pStatus === "pending") return "pending";
      if (fine.status === "payment_rejected" || pStatus === "rejected") return "rejected";
      return "active";
    } else {
      // Group fine
      const myPayment = fine.payments?.[currentUser.uid];
      if (myPayment) {
        if (myPayment.status === "verified") return "paid";
        if (myPayment.status === "pending") return "pending";
        if (myPayment.status === "rejected") return "rejected";
      }
      return fine.status === "active" ? "active" : "inactive";
    }
  }

  // Get active unpaid (and rejected) fines
  const activeFinesList = fines.filter(f => {
    const s = getStudentFineStatus(f);
    return s === "active" || s === "rejected";
  });

  // Get payment history (pending or paid)
  const historyFinesList = fines.filter(f => {
    const s = getStudentFineStatus(f);
    return s === "pending" || s === "paid";
  });

  const activeTabFines = currentTab === "active" ? activeFinesList : historyFinesList;
  const filteredFines = filterCategory === "all" ? activeTabFines : activeTabFines.filter(f => f.category === filterCategory);

  // Stats calculation
  const unpaidCount = activeFinesList.length;
  const totalAmount = activeFinesList.reduce((sum, f) => sum + (f.amount || 0), 0);
  const categories = [...new Set(fines.map(f => f.category))];

  function getAmountColor(amt) {
    if (amt <= 200) return "#48bb78";
    if (amt <= 500) return "#f5a623";
    return "#fc8181";
  }

  // UPI deep link generation
  function getUpiUri(fine) {
    const collegeVpa = "hassankamala666@okaxis";
    const collegeName = "Sri Vidyanikethan College ERP";
    const totalAmount = getFineBreakdown(fine, currentUser.uid).total;
    const refNote = `Fine - ${fine.title} - ${userProfile?.registerNo || ""}`.substring(0, 50);
    return `upi://pay?pa=${collegeVpa}&pn=${encodeURIComponent(collegeName)}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(refNote)}`;
  }

  // Helper to compress and convert image file to Base64 (Data URL)
  function compressAndToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.6));
        };
        img.onerror = (e) => reject(e);
      };
      reader.onerror = (e) => reject(e);
    });
  }

  // Handle fine payment submission
  async function handlePaymentSubmit(e) {
    e.preventDefault();
    if (!payingFine || !utrNumber.trim() || !screenshotFile) return;

    // Validate 12-digit UTR
    if (!/^\d{12}$/.test(utrNumber.trim())) {
      setErrorMsg("Please enter a valid 12-digit UPI Transaction ID (UTR number).");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    setUploadProgress(10);

    try {
      // 1. Convert and compress image to Base64 locally (instant & bypasses storage rules!)
      setUploadProgress(50);
      const screenshotUrl = await compressAndToBase64(screenshotFile);
      setUploadProgress(100);

      // 2. Update Firestore document
      const fineDocRef = doc(db, "fines", payingFine.id);
      const timestamp = new Date().toISOString();
      const currentCalculatedAmount = getFineBreakdown(payingFine, currentUser.uid).total;

      if (payingFine.studentUid) {
        // Individual fine
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
        // Group fine: Record payment inside map
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

      // Success cleanup
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
          <h1>⚠️ My Fines</h1>
          <p>{userProfile?.dept} • {userProfile?.year}</p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card" style={{ borderLeft: "4px solid #fc8181" }}>
            <div className="stat-icon">📋</div>
            <div className="stat-value" style={{ color: unpaidCount > 0 ? "#fc8181" : "#48bb78" }}>
              {loading ? "..." : unpaidCount}
            </div>
            <div className="stat-label">Active Fines</div>
            {!loading && (
              <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 4 }}>
                {unpaidCount > 0 ? "Pending payment" : "All clear ✅"}
              </div>
            )}
          </div>
          <div className="stat-card" style={{ borderLeft: "4px solid #fc8181" }}>
            <div className="stat-icon">💰</div>
            <div className="stat-value" style={{ color: totalAmount > 0 ? "#fc8181" : "#48bb78" }}>
              {loading ? "..." : `₹${totalAmount.toLocaleString("en-IN")}`}
            </div>
            <div className="stat-label">Unpaid Fine Amount</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-value">{loading ? "..." : categories.length}</div>
            <div className="stat-label">Categories</div>
          </div>
        </div>

        {/* Active Unpaid Alert */}
        {!loading && totalAmount > 0 && (
          <div style={{
            padding: "16px 20px", borderRadius: 12, marginBottom: 24,
            background: totalAmount > 500 ? "rgba(252,129,129,0.1)" : "rgba(245,166,35,0.1)",
            border: `1px solid ${totalAmount > 500 ? "rgba(252,129,129,0.3)" : "rgba(245,166,35,0.3)"}`,
            display: "flex", alignItems: "center", gap: 14
          }}>
            <span style={{ fontSize: 28 }}>💸</span>
            <div>
              <div style={{
                fontWeight: 700, fontFamily: "Syne", fontSize: 16,
                color: totalAmount > 500 ? "#fc8181" : "#f5a623"
              }}>
                Pending Fine: ₹{totalAmount.toLocaleString("en-IN")}
              </div>
              <div style={{ color: "#e2e8f0", fontSize: 13, marginTop: 4 }}>
                You have {unpaidCount} unpaid fine{unpaidCount > 1 ? "s" : ""}. Click "Pay Now" next to any fine to make a secure UPI payment.
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 12 }}>
          <button
            onClick={() => { setCurrentTab("active"); setFilterCategory("all"); }}
            style={{
              padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.2s",
              background: currentTab === "active" ? "rgba(233,69,96,0.2)" : "rgba(255,255,255,0.04)",
              color: currentTab === "active" ? "#e94560" : "#a0aec0"
            }}
          >
            Fines to Pay ({activeFinesList.length})
          </button>
          <button
            onClick={() => { setCurrentTab("history"); setFilterCategory("all"); }}
            style={{
              padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.2s",
              background: currentTab === "history" ? "rgba(72,187,120,0.2)" : "rgba(255,255,255,0.04)",
              color: currentTab === "history" ? "#48bb78" : "#a0aec0"
            }}
          >
            Payment History ({historyFinesList.length})
          </button>
        </div>

        {/* No Fines State */}
        {!loading && activeTabFines.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h3 style={{ fontFamily: "Syne", fontSize: 20, marginBottom: 8 }}>
              {currentTab === "active" ? "All Cleared!" : "No Payments Found"}
            </h3>
            <p style={{ color: "#a0aec0", fontSize: 14 }}>
              {currentTab === "active" ? "Great job! You have no pending fines." : "You haven't submitted any payments yet."}
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
                  fontSize: 12, fontWeight: 600, transition: "all 0.2s",
                  background: filterCategory === "all" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)",
                  color: filterCategory === "all" ? "white" : "#a0aec0"
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
                      fontSize: 12, fontWeight: 600, transition: "all 0.2s",
                      background: filterCategory === cat ? style.bg : "rgba(255,255,255,0.04)",
                      color: filterCategory === cat ? style.color : "#a0aec0"
                    }}
                  >
                    {style.icon} {cat} ({count})
                  </button>
                );
              })}
            </div>

            {/* Fines List (Full-Width Rows) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {filteredFines.map(fine => {
                const breakdown = getFineBreakdown(fine, currentUser.uid);
                const catStyle = CATEGORY_STYLES[fine.category] || CATEGORY_STYLES["Other"];
                const amtColor = getAmountColor(fine.amount);
                const fineStatus = getStudentFineStatus(fine);

                // Determine border and text styling based on verification status
                let statusBadge = null;
                let cardBorder = amtColor;
                if (fineStatus === "pending") {
                  statusBadge = { text: "⏳ Pending Verification", bg: "rgba(245,166,35,0.15)", color: "#f5a623" };
                  cardBorder = "#f5a623";
                } else if (fineStatus === "paid") {
                  statusBadge = { text: "✅ Paid & Verified", bg: "rgba(72,187,120,0.15)", color: "#48bb78" };
                  cardBorder = "#48bb78";
                } else if (fineStatus === "rejected") {
                  statusBadge = { text: "❌ Payment Rejected", bg: "rgba(252,129,129,0.15)", color: "#fc8181" };
                  cardBorder = "#fc8181";
                }

                // Get rejection details
                const rejectionReason = fine.studentUid 
                  ? fine.paymentDetails?.rejectionReason 
                  : fine.payments?.[currentUser.uid]?.rejectionReason;

                return (
                  <div key={fine.id} className="card" style={{
                    borderLeft: `5px solid ${cardBorder}`,
                    position: "relative", overflow: "hidden",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    display: "flex", flexDirection: "row", justifyContent: "space-between",
                    alignItems: "center", gap: 24, flexWrap: "wrap", padding: "20px 24px"
                  }}
                    onMouseOver={e => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {/* Left Column: Details & Metadata */}
                    <div style={{ flex: "1 1 450px" }}>
                      {/* Badge Row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                          background: catStyle.bg, color: catStyle.color
                        }}>
                          {catStyle.icon} {fine.category}
                        </div>
                        {statusBadge && (
                          <span style={{
                            padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: statusBadge.bg, color: statusBadge.color
                          }}>
                            {statusBadge.text}
                          </span>
                        )}
                        <span style={{
                          padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: "rgba(66,153,225,0.12)", color: "#4299e1"
                        }}>
                          Dept: {fine.targetDept === "all" ? "All" : fine.targetDept}
                        </span>
                        <span style={{
                          padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: "rgba(159,122,234,0.12)", color: "#9f7aea"
                        }}>
                          Year: {fine.targetYear === "all" ? "All" : fine.targetYear}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, marginBottom: 6, color: "white" }}>
                        {fine.title}
                      </h3>
                      {fine.description && (
                        <p style={{ fontSize: 13, color: "#a0aec0", marginBottom: 12, lineHeight: 1.5 }}>
                          {fine.description}
                        </p>
                      )}

                      {/* Rejection Alert Banner */}
                      {fineStatus === "rejected" && rejectionReason && (
                        <div style={{
                          padding: "10px 12px", borderRadius: 8, background: "rgba(252,129,129,0.08)",
                          border: "1px solid rgba(252,129,129,0.2)", color: "#fc8181", fontSize: 12,
                          marginBottom: 12
                        }}>
                          ⚠️ <strong>Reason:</strong> {rejectionReason}
                        </div>
                      )}

                      {/* Metadata Row */}
                      <div style={{
                        fontSize: 12, color: "#a0aec0", display: "flex", gap: 16, flexWrap: "wrap",
                        borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10
                      }}>
                        {fine.dueDate && (
                          <div style={{ color: "#fc8181", fontWeight: 600 }}>
                            ⚠️ Due Date: {new Date(fine.dueDate).toLocaleDateString("en-IN", {
                              day: "numeric", month: "short", year: "numeric"
                            })}
                          </div>
                        )}
                        <div>
                          📅 Imposed: {fine.createdAt ? new Date(fine.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric"
                          }) : ""} • by {fine.createdBy}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Amount & Action Button */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12, flex: "0 0 200px", minWidth: 150 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: "#a0aec0" }}>Fine Amount</div>
                        <div style={{
                          fontSize: 26, fontWeight: 800, fontFamily: "Syne",
                          color: cardBorder, marginTop: 2
                        }}>
                          ₹{breakdown.total.toLocaleString("en-IN")}
                        </div>
                        {breakdown.daysLate > 0 && (
                          <div style={{ fontSize: 10, color: "#fc8181", marginTop: 4 }}>
                            {breakdown.daysLate} days late (+10%/day: +₹{breakdown.lateFee.toLocaleString("en-IN")})
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      {fineStatus === "active" && (
                        <button
                          onClick={() => setPayingFine(fine)}
                          className="btn-primary"
                          style={{ padding: "8px 16px", fontSize: 12, background: "#e94560", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, width: "auto" }}
                        >
                          💳 Pay Now (UPI)
                        </button>
                      )}
                      {fineStatus === "rejected" && (
                        <button
                          onClick={() => setPayingFine(fine)}
                          className="btn-primary"
                          style={{ padding: "8px 16px", fontSize: 12, background: "#fc8181", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, width: "auto" }}
                        >
                          🔄 Resubmit Payment
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
          display: "flex", alignItems: "center", justifycontent: "center", padding: 20
        }}>
          <div className="card" style={{
            width: "100%", maxWidth: 460, background: "#161625", padding: 24, borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            overflowY: "auto", maxHeight: "90vh", margin: "auto"
          }}>
            <div style={{ display: "flex", justifycontent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, color: "white" }}>
                📱 UPI Payment Gateway
              </h3>
              <button
                onClick={() => {
                  setPayingFine(null);
                  setErrorMsg("");
                  setUtrNumber("");
                  setScreenshotFile(null);
                }}
                style={{
                  background: "transparent", border: "none", color: "#a0aec0",
                  fontSize: 20, cursor: "pointer"
                }}
              >✕</button>
            </div>

            {/* Fine Header */}
            <div style={{
              background: "rgba(255,255,255,0.03)", padding: 14, borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.05)", marginBottom: 20
            }}>
              <div style={{ fontSize: 12, color: "#a0aec0" }}>Payment for:</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "white", marginTop: 2 }}>{payingFine.title}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 10 }}>
                <span style={{ fontSize: 11, color: "#a0aec0" }}>Category: {payingFine.category}</span>
                <div style={{ textAlign: "right" }}>
                  {getFineBreakdown(payingFine, currentUser.uid).daysLate > 0 && (
                    <div style={{ fontSize: 10, color: "#fc8181", marginBottom: 2 }}>
                      Base: ₹{payingFine.amount} + Late Fee: ₹{getFineBreakdown(payingFine, currentUser.uid).lateFee.toLocaleString("en-IN")}
                    </div>
                  )}
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#48bb78", fontFamily: "Syne" }}>
                    ₹{getFineBreakdown(payingFine, currentUser.uid).total.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            {/* Local QR Code */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{
                background: "white", padding: 12, borderRadius: 12,
                display: "inline-block", boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
              }}>
                <QRCodeSVG value={getUpiUri(payingFine)} size={180} />
              </div>
              <p style={{ fontSize: 11, color: "#a0aec0", marginTop: 8 }}>
                Scan this QR code using GPay, PhonePe, Paytm, or BHIM app
              </p>
            </div>

            {/* Pay via UPI App (Mobile deep link) */}
            <div style={{ marginBottom: 20 }}>
              <a
                href={getUpiUri(payingFine)}
                style={{
                  display: "flex", alignItems: "center", justifycontent: "center", gap: 8,
                  textDecoration: "none", background: "#e94560", color: "white",
                  padding: "12px 16px", borderRadius: 10, fontWeight: 600, fontSize: 14,
                  textAlign: "center", transition: "background 0.2s"
                }}
              >
                <span>📲</span> Pay via UPI App (Mobile Only)
              </a>
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 20 }}></div>

            {/* Submission Form */}
            <form onSubmit={handlePaymentSubmit}>
              {/* UTR Input */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>12-Digit UPI Transaction ID (UTR) *</label>
                <input
                  type="text"
                  placeholder="e.g. 304589214732"
                  value={utrNumber}
                  onChange={e => setUtrNumber(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  required
                  style={{ textTransform: "uppercase" }}
                />
                <small style={{ color: "#a0aec0", fontSize: 10, marginTop: 4, display: "block" }}>
                  Enter the 12-digit transaction ID found in your payment history details.
                </small>
              </div>

              {/* Screenshot Input */}
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Upload Payment Screenshot (JPEG/PNG) *</label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={e => setScreenshotFile(e.target.files[0])}
                  required
                  style={{
                    background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.15)",
                    padding: "10px", borderRadius: 8, color: "white", width: "100%"
                  }}
                />
              </div>

              {/* Error messages */}
              {errorMsg && (
                <div style={{
                  padding: "10px 12px", borderRadius: 8, background: "rgba(252,129,129,0.1)",
                  border: "1px solid rgba(252,129,129,0.3)", color: "#fc8181", fontSize: 12,
                  marginBottom: 16
                }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Progress bar */}
              {submitting && uploadProgress > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifycontent: "space-between", fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>
                    <span>Uploading screenshot proof...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${uploadProgress}%`, height: "100%", background: "#48bb78", borderRadius: 3, transition: "width 0.1s ease" }}></div>
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting || !utrNumber || !screenshotFile}
                  style={{ flex: 1, height: 42, background: "#48bb78", border: "none" }}
                >
                  {submitting ? "Submitting..." : "Submit Payment Details"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPayingFine(null);
                    setErrorMsg("");
                    setUtrNumber("");
                    setScreenshotFile(null);
                  }}
                  disabled={submitting}
                  style={{
                    padding: "0 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)",
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
    </div>
  );
}
