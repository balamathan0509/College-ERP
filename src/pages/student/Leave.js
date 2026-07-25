// src/pages/student/Leave.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { sendEmail } from "../../utils/notifications";
import {
  Calendar,
  ClipboardList,
  FilePlus,
  CheckCircle2,
  Clock,
  Inbox,
  ArrowRight
} from "lucide-react";

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

      const staffQ = query(
        collection(db, "users"),
        where("role", "==", "staff"),
        where("dept", "==", userProfile.dept)
      );
      const staffSnap = await getDocs(staffQ);
      staffSnap.docs.forEach(d => {
        const staffData = d.data();
        if (staffData.email) {
          sendEmail({
            toEmail: staffData.email,
            toName: staffData.name,
            subject: "New Student Leave Application",
            message: `${userProfile.name} (${userProfile.registerNo}) has submitted a Leave request (${form.leaveType}) from ${form.fromDate} to ${form.toDate}.\nReason: ${reasonText}`
          });
        }
      });

      setSuccess("Leave request submitted successfully! Pending faculty review.");
      setForm({ fromDate: "", toDate: "", reason: "", leaveType: "", otherReason: "" });
    } catch (err) {
      setError("Failed to submit leave request. Try again.");
    }
    setLoading(false);
  }

  async function fetchLeaves() {
    setFetching(true);
    try {
      const q = query(
        collection(db, "leave_requests"),
        where("studentId", "==", currentUser.uid)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setLeaves(list);
    } catch (err) {}
    setFetching(false);
  }

  useEffect(() => {
    if (tab === "history" && currentUser) fetchLeaves();
  }, [tab, currentUser]);

  const statusInfo = {
    pending_staff: { label: "Pending Staff Approval", color: "var(--warning)" },
    pending_hod: { label: "Pending HOD Approval", color: "var(--warning)" },
    pending_principal: { label: "Pending Principal Approval", color: "var(--warning)" },
    approved: { label: "Leave Approved", color: "var(--success)" },
    rejected: { label: "Leave Rejected", color: "var(--danger)" }
  };

  function getDayCount(from, to) {
    if (!from || !to) return 0;
    const diff = new Date(to) - new Date(from);
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Student Leave Management</h1>
          <p>Submit leave applications & view approval tracking</p>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
          <button onClick={() => setTab("apply")} style={{
            padding: "10px 22px", borderRadius: "var(--radius-md)", border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8,
            background: tab === "apply" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
            color: tab === "apply" ? "var(--highlight)" : "var(--text-muted)", transition: "all 0.2s ease"
          }}>
            <FilePlus size={16} /> Apply Leave
          </button>
          <button onClick={() => setTab("history")} style={{
            padding: "10px 22px", borderRadius: "var(--radius-md)", border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8,
            background: tab === "history" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
            color: tab === "history" ? "var(--highlight)" : "var(--text-muted)", transition: "all 0.2s ease"
          }}>
            <ClipboardList size={16} /> My Leaves
          </button>
        </div>

        {tab === "apply" && (
          <div className="card" style={{ maxWidth: 640 }}>
            <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, marginBottom: 24, fontWeight: 700 }}>
              New Leave Application
            </h3>
            {error && <div className="error-msg">{error}</div>}
            {success && (
              <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "var(--radius-md)", padding: "12px 16px", color: "var(--success)", fontSize: 14, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={16} /> {success}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Leave Type *</label>
                <select name="leaveType" value={form.leaveType} onChange={handleChange} required>
                  <option value="">Select Leave Category</option>
                  {LEAVE_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {form.leaveType === "Other" && (
                <div className="form-group">
                  <label>Specify Leave Category *</label>
                  <input type="text" name="otherReason" placeholder="Enter leave category" value={form.otherReason} onChange={handleChange} required />
                </div>
              )}
              <div className="form-group">
                <label>Reason for Leave *</label>
                <textarea name="reason" placeholder="Explain your reason for leave in detail..." value={form.reason} onChange={handleChange} required rows={3} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>From Date *</label>
                  <input type="date" name="fromDate" value={form.fromDate} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>To Date *</label>
                  <input type="date" name="toDate" value={form.toDate} onChange={handleChange} required />
                </div>
              </div>
              {form.fromDate && form.toDate && new Date(form.toDate) >= new Date(form.fromDate) && (
                <div style={{ background: "rgba(37, 99, 235, 0.12)", border: "1px solid rgba(37, 99, 235, 0.3)", borderRadius: "var(--radius-sm)", padding: "10px 16px", color: "var(--highlight)", fontSize: 13, marginBottom: 20, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={16} /> Duration: {getDayCount(form.fromDate, form.toDate)} day(s)
                </div>
              )}
              <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
                {loading ? "Submitting..." : <>Submit Leave Request <ArrowRight size={16} /></>}
              </button>
            </form>
          </div>
        )}

        {tab === "history" && (
          fetching ? (
            <div style={{ textAlign: "center", padding: 40 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
          ) : leaves.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 50 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <Inbox size={48} color="var(--text-muted)" />
              </div>
              <p style={{ color: "var(--text-muted)" }}>No leave applications found.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {leaves.map(leave => (
                <div key={leave.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <span className="badge" style={{ background: "rgba(37, 99, 235, 0.14)", color: "var(--highlight)", border: "1px solid rgba(37, 99, 235, 0.3)" }}>
                          {leave.leaveType}
                        </span>
                      </div>
                      <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8, color: "var(--text)" }}>{leave.reason}</h3>
                      <div style={{ color: "var(--text-muted)", fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Calendar size={14} /> From: {leave.fromDate}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Calendar size={14} /> To: {leave.toDate}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Clock size={14} /> Duration: {getDayCount(leave.fromDate, leave.toDate)} day(s)</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className="badge" style={{
                        background: `${statusInfo[leave.status]?.color}20`,
                        color: statusInfo[leave.status]?.color,
                        border: `1px solid ${statusInfo[leave.status]?.color}40`,
                        padding: "6px 14px", fontSize: 12
                      }}>
                        {statusInfo[leave.status]?.label}
                      </span>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
                        Submitted: {new Date(leave.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
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
