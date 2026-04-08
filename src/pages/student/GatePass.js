// src/pages/student/GatePass.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { sendEmail } from "../../utils/notifications";

const REASONS = ["Medical Emergency", "Family Function", "Bank / Government Work", "Personal Work", "Other"];

export default function StudentGatePass() {
  const { currentUser, userProfile } = useAuth();
  const [tab, setTab] = useState("apply");
  const [form, setForm] = useState({
    reason: "", otherReason: "", outDate: "", outTime: "",
    inDate: "", inTime: "", place: ""
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [passes, setPasses] = useState([]);
  const [fetching, setFetching] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.reason || !form.outDate || !form.outTime || !form.inDate || !form.inTime || !form.place) {
      return setError("Please fill all fields.");
    }
    setLoading(true);
    try {
      const reasonText = form.reason === "Other" ? form.otherReason : form.reason;

      // Save gate pass
      await addDoc(collection(db, "gate_pass"), {
        studentId: currentUser.uid,
        studentName: userProfile.name,
        studentEmail: currentUser.email,
        registerNo: userProfile.registerNo,
        dept: userProfile.dept,
        year: userProfile.year,
        phone: userProfile.phone || "",
        reason: reasonText,
        outDate: form.outDate,
        outTime: form.outTime,
        inDate: form.inDate,
        inTime: form.inTime,
        place: form.place,
        status: "pending_staff",
        token: null,
        createdAt: new Date().toISOString()
      });

      // Send email to staff of same dept
      const staffQ = query(
        collection(db, "users"),
        where("role", "==", "staff"),
        where("dept", "==", userProfile.dept)
      );
      const staffSnap = await getDocs(staffQ);
      const staffList = staffSnap.docs.map(d => d.data());

      for (const staff of staffList) {
        if (staff.email) {
          await sendEmail({
            toEmail: staff.email,
            toName: staff.name,
            subject: `🚪 Gate Pass Request — ${userProfile.name}`,
            message: `Hi ${staff.name},

${userProfile.name} (${userProfile.registerNo}, ${userProfile.year} - ${userProfile.dept}) has submitted a gate pass request.

📋 Reason: ${reasonText}
📍 Place: ${form.place}
🕐 Out: ${form.outDate} at ${form.outTime}
🕐 In: ${form.inDate} at ${form.inTime}
📞 Phone: ${userProfile.phone || "Not provided"}

Please login to College Portal to Approve or Reject this request.

Regards,
College Portal`
          });
        }
      }

      setSuccess("Gate pass submitted! Staff has been notified via email.");
      setForm({ reason: "", otherReason: "", outDate: "", outTime: "", inDate: "", inTime: "", place: "" });
    } catch (err) {
      setError("Failed to submit. Try again.");
    }
    setLoading(false);
  }

  async function fetchPasses() {
    setFetching(true);
    try {
      const q = query(collection(db, "gate_pass"), where("studentId", "==", currentUser.uid));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setPasses(list);
    } catch (err) {}
    setFetching(false);
  }

  useEffect(() => { if (tab === "history") fetchPasses(); }, [tab]);

  const statusInfo = {
    pending_staff: { label: "⏳ Waiting for Staff", color: "#f6ad55" },
    pending_hod: { label: "🔄 Waiting for HOD", color: "#4299e1" },
    approved: { label: "✅ Approved", color: "#48bb78" },
    rejected: { label: "❌ Rejected", color: "#fc8181" }
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>🚪 Gate Pass</h1>
          <p>Apply for gate pass or check status</p>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
          {["apply", "history"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer",
              fontFamily: "Syne", fontWeight: 600, fontSize: 14,
              background: tab === t ? "#e94560" : "rgba(255,255,255,0.07)",
              color: "white", transition: "all 0.2s"
            }}>
              {t === "apply" ? "📝 Apply" : "📋 My Requests"}
            </button>
          ))}
        </div>

        {tab === "apply" && (
          <div className="card" style={{ maxWidth: 600 }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 24 }}>New Gate Pass Request</h3>
            {error && <div className="error-msg">{error}</div>}
            {success && (
              <div style={{ background: "rgba(72,187,120,0.1)", border: "1px solid rgba(72,187,120,0.3)", borderRadius: 10, padding: "12px 16px", color: "#48bb78", fontSize: 14, marginBottom: 20 }}>
                ✅ {success}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Reason for Leave</label>
                <select name="reason" value={form.reason} onChange={handleChange} required>
                  <option value="">Select Reason</option>
                  {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {form.reason === "Other" && (
                <div className="form-group">
                  <label>Specify Reason</label>
                  <input type="text" name="otherReason" placeholder="Enter your reason" value={form.otherReason} onChange={handleChange} />
                </div>
              )}
              <div className="form-group">
                <label>Place to Visit</label>
                <input type="text" name="place" placeholder="e.g. Government Hospital, Chennai" value={form.place} onChange={handleChange} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Out Date</label>
                  <input type="date" name="outDate" value={form.outDate} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Out Time</label>
                  <input type="time" name="outTime" value={form.outTime} onChange={handleChange} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>In Date</label>
                  <input type="date" name="inDate" value={form.inDate} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>In Time</label>
                  <input type="time" name="inTime" value={form.inTime} onChange={handleChange} required />
                </div>
              </div>
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? "Submitting..." : "Submit Request →"}
              </button>
            </form>
          </div>
        )}

        {tab === "history" && (
          fetching ? (
            <div style={{ textAlign: "center", padding: 40 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
          ) : passes.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
              <p style={{ color: "#a0aec0" }}>No gate pass requests yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {passes.map(pass => (
                <div key={pass.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{pass.reason}</div>
                      <div style={{ color: "#a0aec0", fontSize: 14, display: "flex", flexDirection: "column", gap: 4 }}>
                        <span>📍 {pass.place}</span>
                        <span>🕐 Out: {pass.outDate} at {pass.outTime}</span>
                        <span>🕐 In: {pass.inDate} at {pass.inTime}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        padding: "6px 14px", borderRadius: 20,
                        background: `${statusInfo[pass.status]?.color}20`,
                        color: statusInfo[pass.status]?.color,
                        fontSize: 13, fontWeight: 600
                      }}>
                        {statusInfo[pass.status]?.label}
                      </div>
                      {pass.status === "approved" && pass.token && (
                        <div style={{ marginTop: 12, padding: "10px 16px", background: "rgba(72,187,120,0.1)", border: "1px solid rgba(72,187,120,0.3)", borderRadius: 10, textAlign: "center" }}>
                          <div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>YOUR TOKEN</div>
                          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "Syne", color: "#48bb78", letterSpacing: 4 }}>{pass.token}</div>
                          <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 4 }}>Show to security</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}