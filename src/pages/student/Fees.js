// src/pages/student/Fees.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, getDocs, query, where, doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";

const FEES_TYPES = ["College Fees", "Bus Fees", "Mess Fees", "Exam Fees", "Library Fees", "Other"];

const DEFAULT_FEE_AMOUNTS = {
  "College Fees": 25000,
  "Bus Fees": 8000,
  "Mess Fees": 6000,
  "Exam Fees": 1500,
  "Library Fees": 500,
  "Other": 1000
};

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CURRENT_MONTH = monthNames[new Date().getMonth()] + " " + new Date().getFullYear();

// Fee types that are charged monthly (auto-created each month)
const MONTHLY_FEE_TYPES = ["Mess Fees"];

export default function StudentFees() {
  const { currentUser, userProfile } = useAuth();
  const [feesStatus, setFeesStatus] = useState([]);
  const [fetching, setFetching] = useState(true);

  // Payment Form States
  const [payingFee, setPayingFee] = useState(null); // fee item object
  const [payAmount, setPayAmount] = useState("");
  const [utrNumber, setUtrNumber] = useState("");
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // UPI deep link generation
  function getUpiUri(feesType, amount) {
    const collegeVpa = "hassankamala666@okaxis";
    const collegeName = "Sri Vidyanikethan College ERP";
    const refNote = `Fees - ${feesType} - ${userProfile?.registerNo || ""}`.substring(0, 50);
    return `upi://pay?pa=${collegeVpa}&pn=${encodeURIComponent(collegeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(refNote)}`;
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

  // Handle fee payment submission
  async function handlePaymentSubmit(e) {
    e.preventDefault();
    if (!payingFee || !utrNumber.trim() || !screenshotFile || !payAmount) return;

    // Validate 12-digit UTR
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

      const feeDocRef = doc(db, "fees", payingFee.docId);
      const timestamp = new Date().toISOString();

      await updateDoc(feeDocRef, {
        [`payments.${currentUser.uid}`]: {
          status: "pending",
          transactionId: utrNumber.trim(),
          screenshotUrl,
          amountPaid: Number(payAmount),
          submittedAt: timestamp,
          studentName: userProfile?.name || "Student",
          studentRegisterNo: userProfile?.registerNo || "N/A",
          studentDept: userProfile?.dept || "",
          studentYear: userProfile?.year || ""
        }
      });

      // Cleanup
      setPayingFee(null);
      setPayAmount("");
      setUtrNumber("");
      setScreenshotFile(null);
      setUploadProgress(0);
      await fetchFeesStatus();
    } catch (err) {
      console.error("Fees payment submit failed:", err);
      setErrorMsg("Failed to submit payment details. Please try again.");
    }
    setSubmitting(false);
  }

  async function fetchFeesStatus() {
    setFetching(true);
    try {
      const results = [];
      for (const feesType of FEES_TYPES) {
        // Exclude fees that are not applicable to this student
        const isApplicable = userProfile.applicableFees
          ? userProfile.applicableFees[feesType] !== false
          : (
              feesType !== "Mess Fees" && feesType !== "Bus Fees"
            ) || (
              feesType === "Mess Fees" && userProfile.studentType === "hosteller"
            ) || (
              feesType === "Bus Fees" && userProfile.busUser === true
            );

        if (!isApplicable) continue;

        const isMonthly = MONTHLY_FEE_TYPES.includes(feesType);

        // Skip monthly mess fees if office staff has disabled it for this student
        if (isMonthly && feesType === "Mess Fees" && userProfile.monthlyMessFees === false) continue;

        try {
          if (isMonthly) {
            // Monthly fees: use deterministic docId per dept/year/type/month
            const monthDocId = `${userProfile.dept}_${userProfile.year}_${feesType}_${CURRENT_MONTH}`.replace(/\s+/g, "_");
            const monthDocRef = doc(db, "fees", monthDocId);
            let monthDoc = await getDoc(monthDocRef);

            // Auto-create this month's mess fees document if it doesn't exist
            if (!monthDoc.exists()) {
              const studentAmount = userProfile.feeAmounts?.[feesType] !== undefined
                ? Number(userProfile.feeAmounts[feesType])
                : DEFAULT_FEE_AMOUNTS[feesType];

              await setDoc(monthDocRef, {
                dept: userProfile.dept,
                year: userProfile.year,
                feesType: feesType,
                month: CURRENT_MONTH,
                amount: studentAmount,
                payments: {},
                updatedAt: new Date().toISOString(),
                updatedBy: "System (Auto-generated)",
                autoGenerated: true
              });
              monthDoc = await getDoc(monthDocRef);
            }

            const data = monthDoc.data();
            const paid = data.payments?.[currentUser.uid] || false;
            const studentAmount = userProfile.feeAmounts?.[feesType] !== undefined
              ? Number(userProfile.feeAmounts[feesType])
              : (data.amount || DEFAULT_FEE_AMOUNTS[feesType]);

            results.push({
              feesType,
              paid,
              updatedAt: data.updatedAt,
              docId: monthDocId,
              amount: studentAmount,
              month: CURRENT_MONTH,
              isMonthly: true
            });
          } else {
            // Non-monthly fees: original query logic
            const snap = await getDocs(query(collection(db, "fees"), where("dept", "==", userProfile.dept), where("year", "==", userProfile.year), where("feesType", "==", feesType)));
            if (!snap.empty) {
              const docSnap = snap.docs[0];
              const data = docSnap.data();
              const paid = data.payments?.[currentUser.uid] || false;
              const studentAmount = userProfile.feeAmounts?.[feesType] !== undefined
                ? Number(userProfile.feeAmounts[feesType])
                : (data.amount || DEFAULT_FEE_AMOUNTS[feesType]);

              results.push({ 
                feesType, 
                paid, 
                updatedAt: data.updatedAt, 
                docId: docSnap.id, 
                amount: studentAmount 
              });
            } else {
              const studentAmount = userProfile.feeAmounts?.[feesType] !== undefined
                ? Number(userProfile.feeAmounts[feesType])
                : DEFAULT_FEE_AMOUNTS[feesType];

              results.push({ 
                feesType, 
                paid: null,
                amount: studentAmount
              });
            }
          }
        } catch (e) {
          results.push({ feesType, paid: null });
        }
      }
      setFeesStatus(results);
    } catch (err) {}
    setFetching(false);
  }

  useEffect(() => { fetchFeesStatus(); }, []);

  const paidCount = feesStatus.filter(f => f.paid === true || f.paid?.status === "approved").length;
  const pendingCount = feesStatus.filter(f => f.paid === false || f.paid?.status === "pending" || f.paid?.status === "rejected").length;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>💰 My Fees Status</h1>
          <p>{userProfile?.dept} • {userProfile?.year}</p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value" style={{ color: "#48bb78" }}>{paidCount}</div>
            <div className="stat-label">Fees Paid</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-value" style={{ color: "#fc8181" }}>{pendingCount}</div>
            <div className="stat-label">Fees Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-value">{feesStatus.filter(f => f.paid === null).length}</div>
            <div className="stat-label">Not Updated Yet</div>
          </div>
        </div>

        {/* Fees List */}
        {fetching ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div className="spinner" style={{ margin: "0 auto" }}></div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {feesStatus.map((feeItem) => {
              const { feesType, paid, updatedAt, amount } = feeItem;
              const isPaid = paid === true || paid?.status === "approved";
              const isPending = paid?.status === "pending";
              const isRejected = paid?.status === "rejected";
              const isUnpaid = paid === false;
              
              let statusLabel = "— N/A";
              let statusBg = "rgba(160,174,192,0.15)";
              let statusColor = "#a0aec0";
              let borderLeftColor = "#a0aec0";

              if (isPaid) {
                statusLabel = "✅ Paid";
                statusBg = "rgba(72,187,120,0.15)";
                statusColor = "#48bb78";
                borderLeftColor = "#48bb78";
              } else if (isPending) {
                statusLabel = "⏳ Verification Pending";
                statusBg = "rgba(245,166,35,0.15)";
                statusColor = "#f5a623";
                borderLeftColor = "#f5a623";
              } else if (isRejected) {
                statusLabel = "❌ Rejected";
                statusBg = "rgba(252,129,129,0.15)";
                statusColor = "#fc8181";
                borderLeftColor = "#fc8181";
              } else if (isUnpaid) {
                statusLabel = "❌ Pending";
                statusBg = "rgba(252,129,129,0.15)";
                statusColor = "#fc8181";
                borderLeftColor = "#fc8181";
              }

              return (
                <div key={feesType} className="card" style={{
                  borderLeft: `4px solid ${borderLeftColor}`,
                  position: "relative", overflow: "hidden",
                  display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12
                }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div>
                        <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                          {feesType}
                          {feeItem.isMonthly && (
                            <span style={{
                              padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700,
                              background: "rgba(66,153,225,0.15)", color: "#4299e1"
                            }}>
                              📅 Monthly
                            </span>
                          )}
                        </div>
                        {feeItem.month && (
                          <div style={{ fontSize: 12, color: "#4299e1", fontWeight: 600, marginBottom: 2 }}>
                            {feeItem.month}
                          </div>
                        )}
                        {updatedAt && (
                          <div style={{ fontSize: 11, color: "#a0aec0" }}>
                            Updated: {new Date(updatedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <div style={{
                        padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: statusBg, color: statusColor, whiteSpace: "nowrap"
                      }}>
                        {statusLabel}
                      </div>
                    </div>

                    {/* Amount Info */}
                    {amount !== undefined && (
                      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 10, color: "white" }}>
                        Amount: <span style={{ color: "#48bb78" }}>₹{amount.toLocaleString("en-IN")}</span>
                      </div>
                    )}

                    {/* Rejected Reason Alert */}
                    {isRejected && paid?.rejectionReason && (
                      <div style={{
                        marginTop: 10, padding: "8px 10px", background: "rgba(252,129,129,0.08)",
                        borderRadius: 8, fontSize: 12, color: "#fc8181", border: "1px solid rgba(252,129,129,0.15)"
                      }}>
                        ⚠️ <strong>Reason:</strong> {paid.rejectionReason}
                      </div>
                    )}

                    {/* Pending details summary */}
                    {isPending && (
                      <div style={{
                        marginTop: 10, padding: "8px 10px", background: "rgba(245,166,35,0.06)",
                        borderRadius: 8, fontSize: 12, color: "#a0aec0", border: "1px solid rgba(245,166,35,0.12)"
                      }}>
                        UTR: <span style={{ color: "white", fontFamily: "monospace" }}>{paid.transactionId}</span>
                        <div style={{ marginTop: 4 }}>Submitted: {new Date(paid.submittedAt).toLocaleDateString()}</div>
                      </div>
                    )}
                  </div>

                  {/* Actions buttons */}
                  {(isUnpaid || isRejected) && (
                    <button
                      onClick={() => {
                        setPayingFee(feeItem);
                        setPayAmount(amount || "");
                      }}
                      className="btn-primary"
                      style={{
                        padding: "8px 16px", fontSize: 12, background: isRejected ? "#fc8181" : "#e94560",
                        border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, width: "100%", marginTop: 8
                      }}
                    >
                      {isRejected ? "🔄 Resubmit Payment" : "💳 Pay Online (UPI)"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

      {/* UPI Fee Payment Modal */}
      {payingFee && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div className="card" style={{
            width: "100%", maxWidth: 460, background: "#161625", padding: 24, borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            overflowY: "auto", maxHeight: "90vh", margin: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, color: "white" }}>
                📱 Fee Payment Gateway
              </h3>
              <button
                onClick={() => {
                  setPayingFee(null);
                  setErrorMsg("");
                  setPayAmount("");
                  setUtrNumber("");
                  setScreenshotFile(null);
                }}
                style={{
                  background: "transparent", border: "none", color: "#a0aec0",
                  fontSize: 20, cursor: "pointer"
                }}
              >✕</button>
            </div>

            {/* Form */}
            <form onSubmit={handlePaymentSubmit}>
              {/* Editable Amount Group */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Amount to Pay (INR) *</label>
                <input
                  type="number"
                  required
                  placeholder="Enter amount to pay"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="form-control"
                  style={{ background: "#0f0f1b", border: "1px solid rgba(255,255,255,0.1)", color: "white", padding: 10, borderRadius: 8, width: "100%", marginTop: 6 }}
                />
              </div>

              {/* Dynamic QR Code Display */}
              {Number(payAmount) > 0 && (
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{
                    background: "white", padding: 12, borderRadius: 12,
                    display: "inline-block", boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
                  }}>
                    <QRCodeSVG value={getUpiUri(payingFee.feesType, payAmount)} size={180} />
                  </div>
                  <p style={{ fontSize: 11, color: "#a0aec0", marginTop: 8 }}>
                    Scan QR code with GPay, PhonePe, Paytm, or BHIM
                  </p>
                  
                  <div style={{ marginTop: 14 }}>
                    <a
                      href={getUpiUri(payingFee.feesType, payAmount)}
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                        textDecoration: "none", background: "#e94560", color: "white",
                        padding: "10px 18px", borderRadius: 8, fontWeight: 600, fontSize: 13,
                        textAlign: "center", width: "100%"
                      }}
                    >
                      📲 Pay via UPI App (Mobile)
                    </a>
                  </div>
                </div>
              )}

              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 16 }}></div>

              {/* UTR Input */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>12-Digit UPI Transaction ID (UTR) *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter UTR transaction number"
                  maxLength={12}
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, ""))}
                  className="form-control"
                  style={{ background: "#0f0f1b", border: "1px solid rgba(255,255,255,0.1)", color: "white", padding: 10, borderRadius: 8, width: "100%", marginTop: 6 }}
                />
              </div>

              {/* Screenshot Proof */}
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Screenshot Payment Proof *</label>
                <input
                  type="file"
                  required
                  accept="image/*"
                  onChange={(e) => setScreenshotFile(e.target.files[0])}
                  className="form-control"
                  style={{ color: "#a0aec0", padding: "10px 0", cursor: "pointer", width: "100%", marginTop: 6 }}
                />
              </div>

              {/* Error messages */}
              {errorMsg && (
                <div style={{ color: "#fc8181", fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Progress bar */}
              {uploadProgress > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>
                    <span>Compressing & uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${uploadProgress}%`, height: "100%", background: "#48bb78", transition: "width 0.2s" }}></div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
                style={{
                  width: "100%", padding: "12px", borderRadius: 10, border: "none",
                  background: "#48bb78", color: "white", fontWeight: 700, fontSize: 14,
                  cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? "Submitting Payment..." : "Submit Payment Details"}
              </button>
            </form>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}