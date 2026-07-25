// src/pages/student/Fees.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, getDocs, query, where, doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  DollarSign,
  QrCode,
  X,
  Upload,
  ArrowRight
} from "lucide-react";

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

const MONTHLY_FEE_TYPES = ["Mess Fees"];

export default function StudentFees() {
  const { currentUser, userProfile } = useAuth();
  const [feesStatus, setFeesStatus] = useState([]);
  const [fetching, setFetching] = useState(true);

  // Payment Form States
  const [payingFee, setPayingFee] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [utrNumber, setUtrNumber] = useState("");
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function getUpiUri(feesType, amount) {
    const collegeVpa = "9842491176@ptsbi";
    const collegeName = "Sri Vidyanikethan College ERP";
    const refNote = `Fees - ${feesType} - ${userProfile?.registerNo || ""}`.substring(0, 50);
    return `upi://pay?pa=${collegeVpa}&pn=${encodeURIComponent(collegeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(refNote)}`;
  }

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

  function handleOpenPayModal(feeItem) {
    setPayingFee(feeItem);
    setPayAmount(feeItem.amount || DEFAULT_FEE_AMOUNTS[feeItem.feesType] || "");
    setUtrNumber("");
    setScreenshotFile(null);
    setUploadProgress(0);
    setErrorMsg("");
  }

  async function handlePaymentSubmit(e) {
    e.preventDefault();
    if (!payingFee) return;

    if (!screenshotFile) {
      setErrorMsg("Please select a transaction screenshot.");
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

      const timestamp = new Date().toISOString();
      const amountPaidNum = Number(payAmount) || payingFee.amount || 0;

      const paymentData = {
        status: "pending",
        transactionId: utrNumber.trim(),
        screenshotUrl,
        amountPaid: amountPaidNum,
        paidAt: timestamp,
        studentName: userProfile?.name || "Student",
        studentRegisterNo: userProfile?.registerNo || "N/A",
        studentDept: userProfile?.dept || "",
        studentYear: userProfile?.year || ""
      };

      if (payingFee.docId) {
        const feeDocRef = doc(db, "fees", payingFee.docId);
        await updateDoc(feeDocRef, {
          [`payments.${currentUser.uid}`]: paymentData
        });
      } else {
        const isMonthly = MONTHLY_FEE_TYPES.includes(payingFee.feesType);
        let docId = `${userProfile.dept}_${userProfile.year}_${payingFee.feesType}`.replace(/\s+/g, "_");
        let extraFields = {};

        if (isMonthly) {
          docId += `_${CURRENT_MONTH.replace(/\s+/g, "_")}`;
          extraFields = { month: CURRENT_MONTH };
        }

        const feeDocRef = doc(db, "fees", docId);
        await setDoc(feeDocRef, {
          dept: userProfile.dept,
          year: userProfile.year,
          feesType: payingFee.feesType,
          amount: payingFee.amount || DEFAULT_FEE_AMOUNTS[payingFee.feesType] || 0,
          updatedAt: timestamp,
          ...extraFields,
          payments: {
            [currentUser.uid]: paymentData
          }
        }, { merge: true });
      }

      setPayingFee(null);
      setSubmitting(false);
      fetchFeesStatus();
    } catch (err) {
      console.error("Payment submission failed:", err);
      setErrorMsg("Failed to upload screenshot or submit payment details. Please try again.");
      setSubmitting(false);
    }
  }

  async function fetchFeesStatus() {
    if (!userProfile) return;
    setFetching(true);
    try {
      const results = [];
      for (const feesType of FEES_TYPES) {
        try {
          const isMonthly = MONTHLY_FEE_TYPES.includes(feesType);
          if (isMonthly) {
            const snap = await getDocs(query(
              collection(db, "fees"),
              where("dept", "==", userProfile.dept),
              where("year", "==", userProfile.year),
              where("feesType", "==", feesType),
              where("month", "==", CURRENT_MONTH)
            ));

            let docId = null;
            let paid = false;
            let data = {};
            let studentAmount = userProfile.feeAmounts?.[feesType] !== undefined
              ? Number(userProfile.feeAmounts[feesType])
              : DEFAULT_FEE_AMOUNTS[feesType];

            if (!snap.empty) {
              const docSnap = snap.docs[0];
              data = docSnap.data();
              docId = docSnap.id;
              paid = data.payments?.[currentUser.uid] || false;
              if (data.amount) studentAmount = data.amount;
            }

            results.push({
              feesType: `${feesType} (${CURRENT_MONTH})`,
              rawType: feesType,
              paid,
              updatedAt: data.updatedAt,
              docId,
              amount: studentAmount,
              isMonthly: true
            });
          } else {
            const snap = await getDocs(query(
              collection(db, "fees"),
              where("dept", "==", userProfile.dept),
              where("year", "==", userProfile.year),
              where("feesType", "==", feesType)
            ));

            if (!snap.empty) {
              const docSnap = snap.docs[0];
              const data = docSnap.data();
              const paid = data.payments?.[currentUser.uid] || false;
              const studentAmount = userProfile.feeAmounts?.[feesType] !== undefined
                ? Number(userProfile.feeAmounts[feesType])
                : (data.amount || DEFAULT_FEE_AMOUNTS[feesType]);

              results.push({
                feesType,
                rawType: feesType,
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
                rawType: feesType,
                paid: null,
                amount: studentAmount
              });
            }
          }
        } catch (e) {
          results.push({ feesType, rawType: feesType, paid: null });
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
          <h1>My Fees & Tuition Status</h1>
          <p>{userProfile?.dept} Department • Year {userProfile?.year}</p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <CheckCircle2 size={24} color="var(--success)" />
            </div>
            <div className="stat-value" style={{ color: "var(--success)" }}>{paidCount}</div>
            <div className="stat-label">Fees Paid</div>
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Clock size={24} color="var(--danger)" />
            </div>
            <div className="stat-value" style={{ color: "var(--danger)" }}>{pendingCount}</div>
            <div className="stat-label">Fees Pending</div>
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <CreditCard size={24} color="var(--highlight)" />
            </div>
            <div className="stat-value">{feesStatus.filter(f => f.paid === null).length}</div>
            <div className="stat-label">Not Updated</div>
          </div>
        </div>

        {/* Fees List */}
        {fetching ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div className="spinner" style={{ margin: "0 auto" }}></div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {feesStatus.map((feeItem) => {
              const { feesType, paid, updatedAt, amount } = feeItem;
              const isPaid = paid === true || paid?.status === "approved";
              const isPending = paid?.status === "pending";
              const isRejected = paid?.status === "rejected";
              const isUnpaid = paid === false;
              
              let statusLabel = "Not Generated";
              let statusBg = "rgba(148, 163, 184, 0.14)";
              let statusColor = "var(--text-muted)";
              let borderLeftColor = "var(--text-muted)";
              let StatusIcon = Clock;

              if (isPaid) {
                statusLabel = "Paid & Verified";
                statusBg = "rgba(16, 185, 129, 0.14)";
                statusColor = "var(--success)";
                borderLeftColor = "var(--success)";
                StatusIcon = CheckCircle2;
              } else if (isPending) {
                statusLabel = "Verification Pending";
                statusBg = "rgba(245, 158, 11, 0.14)";
                statusColor = "var(--warning)";
                borderLeftColor = "var(--warning)";
                StatusIcon = Clock;
              } else if (isRejected) {
                statusLabel = "Payment Rejected";
                statusBg = "rgba(239, 68, 68, 0.14)";
                statusColor = "var(--danger)";
                borderLeftColor = "var(--danger)";
                StatusIcon = XCircle;
              } else if (isUnpaid) {
                statusLabel = "Unpaid";
                statusBg = "rgba(239, 68, 68, 0.14)";
                statusColor = "var(--danger)";
                borderLeftColor = "var(--danger)";
                StatusIcon = XCircle;
              }

              return (
                <div key={feesType} className="card" style={{
                  borderLeft: `4px solid ${borderLeftColor}`,
                  display: "flex", flexDirection: "column", justifyContent: "space-between"
                }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                        background: statusBg, color: statusColor
                      }}>
                        <StatusIcon size={14} /> {statusLabel}
                      </span>
                      {amount && (
                        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                          ₹{amount.toLocaleString("en-IN")}
                        </div>
                      )}
                    </div>

                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                      {feesType}
                    </h3>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
                      Academic Year {userProfile?.year} Fee Structure
                    </p>

                    {isRejected && paid?.rejectionReason && (
                      <div style={{
                        padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "rgba(239, 68, 68, 0.12)",
                        border: "1px solid rgba(239, 68, 68, 0.3)", color: "var(--danger)",
                        fontSize: 12, marginBottom: 16
                      }}>
                        <strong>Rejection Reason:</strong> {paid.rejectionReason}
                      </div>
                    )}
                  </div>

                  <div>
                    {!isPaid && !isPending && (
                      <button
                        onClick={() => handleOpenPayModal(feeItem)}
                        className="btn-primary"
                        style={{ width: "100%", padding: "10px", fontSize: 13, marginTop: 8 }}
                      >
                        <CreditCard size={14} /> Pay via UPI
                      </button>
                    )}

                    {isPending && (
                      <div style={{ fontSize: 12, color: "var(--warning)", textAlign: "center", padding: "8px 0" }}>
                        Payment UTR submitted. Office Staff verification in progress.
                      </div>
                    )}

                    {isPaid && (
                      <div style={{ fontSize: 12, color: "var(--success)", textAlign: "center", padding: "8px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <CheckCircle2 size={14} /> Payment verified and settled
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Pay Modal */}
      {payingFee && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          backdropFilter: "blur(8px)"
        }}>
          <div className="card" style={{
            width: "100%", maxWidth: 460, padding: 28, borderRadius: "var(--radius-lg)",
            overflowY: "auto", maxHeight: "90vh", margin: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <QrCode size={22} color="var(--highlight)" />
                <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 18, color: "var(--text)", fontWeight: 700 }}>
                  UPI Fee Payment
                </h3>
              </div>
              <button
                onClick={() => setPayingFee(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              background: "rgba(11, 19, 43, 0.6)", padding: 16, borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)", marginBottom: 20
            }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Paying For</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>{payingFee.feesType}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--success)", fontFamily: "Plus Jakarta Sans, sans-serif", marginTop: 8 }}>
                ₹{Number(payAmount).toLocaleString("en-IN")}
              </div>
            </div>

            {/* QR Code */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{
                background: "white", padding: 14, borderRadius: "var(--radius-md)",
                display: "inline-block", boxShadow: "var(--shadow-md)"
              }}>
                <QRCodeSVG value={getUpiUri(payingFee.rawType || payingFee.feesType, payAmount)} size={170} />
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
                Scan using GPay, PhonePe, Paytm, or BHIM app
              </p>
            </div>

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
                {submitting ? `Submitting... ${uploadProgress}%` : "Submit Fee Payment"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}