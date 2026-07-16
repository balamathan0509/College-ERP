// src/pages/student/Leave.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { sendEmail } from "../../utils/notifications";

const LEAVE_TYPES = ["Sick Leave", "Personal Leave", "Family Emergency", "Medical", "Other"];

export default function StudentLeave() {
  const { currentUser, userProfile } = useAuth();
  const [tab, setTab] = useState("apply");
  const [form, setForm] = useState({
    fromDate: "", toDate: "", reason: "", leaveType: "", otherReason: ""
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [leaves, setLeaves] = useState([]);
  const [fetching, setFetching] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.fromDate || !form.toDate || !form.reason || !form.leaveType) {
      return setError("Please fill all required fields.");
    }
    if (new Date(form.toDate) < new Date(form.fromDate)) {
      return setError("To Date cannot be before From Date.");
    }
    setLoading(true);
    try {
      const reasonText = form.leaveType === "Other" ? form.otherReason : form.reason;

      await addDoc(collection(db, "leave_requests"), {
        studentId: currentUser.uid,
        name: userProfile.name,
        email: currentUser.email,
        registerNo: userProfile.registerNo,
        department: userProfile.dept,
        year: userProfile.year,
        phone: userProfile.phone || "",
        fromDate: form.fromDate,
        toDate: form.toDate,
        reason: reasonText,
        leaveType: form.leaveType,
        role: "student",
        status: "pending_staff",
        createdAt: new Date().toISOString()
      });

      // Notify staff of same department
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
            subject: `📋 Leave Request — ${userProfile.name}`,
            message: `Hi ${staff.name},

${userProfile.name} (${userProfile.registerNo}, ${userProfile.year} - ${userProfile.dept}) has submitted a leave request.

📋 Leave Type: ${form.leaveType}
📝 Reason: ${reasonText}
📅 From: ${form.fromDate}
📅 To: ${form.toDate}
📞 Phone: ${userProfile.phone || "Not provided"}

Please login to College Portal to Approve or Reject this request.

Regards,
College Portal`
          });
        }
      }

      setSuccess("Leave request submitted! Staff has been notified via email.");
      setForm({ fromDate: "", toDate: "", reason: "", leaveType: "", otherReason: "" });
    } catch (err) {
      setError("Failed to submit. Try again.");
    }
    setLoading(false);
  }

  async function fetchLeaves() {
    setFetching(true);
    try {
      const q = query(collection(db, "leave_requests"), where("studentId", "==", currentUser.uid));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setLeaves(list);
    } catch (err) {}
    setFetching(false);
  }

  useEffect(() => { if (tab === "history") fetchLeaves(); }, [tab]);

  const statusInfo = {
    pending_staff: { label: "⏳ Waiting for Staff", color: "#f6ad55" },
    pending_hod: { label: "🔄 Waiting for HOD", color: "#4299e1" },
    approved: { label: "✅ Approved", color: "#48bb78" },
    rejected: { label: "❌ Rejected", color: "#fc8181" }
  };

  function getDayCount(from, to) {
    const diff = new Date(to) - new Date(from);
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>📋 Leave Management</h1>
          <p>Apply for leave or check status</p>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
          {["apply", "history"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer",
              fontFamily: "Syne", fontWeight: 600, fontSize: 14,
              background: tab === t ? "#e94560" : "rgba(255,255,255,0.07)",
              color: "white", transition: "all 0.2s"
            }}>
              {t === "apply" ? "📝 Apply Leave" : "📋 My Leaves"}
            </button>
          ))}
        </div>

        {tab === "apply" && (
          <div className="card" style={{ maxWidth: 600 }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 24 }}>New Leave Request</h3>
            {error && <div className="error-msg">{error}</div>}
            {success && (
              <div style={{ background: "rgba(72,187,120,0.1)", border: "1px solid rgba(72,187,120,0.3)", borderRadius: 10, padding: "12px 16px", color: "#48bb78", fontSize: 14, marginBottom: 20 }}>
                ✅ {success}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Leave Type</label>
                <select name="leaveType" value={form.leaveType} onChange={handleChange} required>
                  <option value="">Select Leave Type</option>
                  {LEAVE_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {form.leaveType === "Other" && (
                <div className="form-group">
                  <label>Specify Leave Type</label>
                  <input type="text" name="otherReason" placeholder="Enter leave type" value={form.otherReason} onChange={handleChange} />
                </div>
              )}
              <div className="form-group">
                <label>Reason for Leave</label>
                <textarea name="reason" placeholder="Explain your reason for leave..." value={form.reason} onChange={handleChange} required
                  style={{ minHeight: 80, resize: "vertical", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 16px", color: "white", fontSize: 14, fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>From Date</label>
                  <input type="date" name="fromDate" value={form.fromDate} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>To Date</label>
                  <input type="date" name="toDate" value={form.toDate} onChange={handleChange} required />
                </div>
              </div>
              {form.fromDate && form.toDate && new Date(form.toDate) >= new Date(form.fromDate) && (
                <div style={{ background: "rgba(66,153,225,0.1)", border: "1px solid rgba(66,153,225,0.2)", borderRadius: 10, padding: "10px 16px", color: "#4299e1", fontSize: 13, marginBottom: 20, fontWeight: 600 }}>
                  📅 Duration: {getDayCount(form.fromDate, form.toDate)} day(s)
                </div>
              )}
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? "Submitting..." : "Submit Leave Request →"}
              </button>
            </form>
          </div>
        )}

        {tab === "history" && (
          fetching ? (
            <div style={{ textAlign: "center", padding: 40 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
          ) : leaves.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
              <p style={{ color: "#a0aec0" }}>No leave requests yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {leaves.map(leave => (
                <div key={leave.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <div style={{ padding: "4px 12px", borderRadius: 8, background: "rgba(233,69,96,0.15)", color: "#e94560", fontSize: 12, fontWeight: 700 }}>
                          {leave.leaveType}
                        </div>
                      </div>
                      <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{leave.reason}</div>
                      <div style={{ color: "#a0aec0", fontSize: 14, display: "flex", flexDirection: "column", gap: 4 }}>
                        <span>📅 From: {leave.fromDate}</span>
                        <span>📅 To: {leave.toDate}</span>
                        <span>⏱️ Duration: {getDayCount(leave.fromDate, leave.toDate)} day(s)</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        padding: "6px 14px", borderRadius: 20,
                        background: `${statusInfo[leave.status]?.color}20`,
                        color: statusInfo[leave.status]?.color,
                        fontSize: 13, fontWeight: 600
                      }}>
                        {statusInfo[leave.status]?.label}
                      </div>
                      <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 8 }}>
                        {new Date(leave.createdAt).toLocaleDateString()}
                      </div>
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
