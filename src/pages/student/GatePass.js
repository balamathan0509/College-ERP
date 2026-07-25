// src/pages/student/GatePass.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { sendEmail } from "../../utils/notifications";
import QRCode from "react-qr-code";
import {
  DoorOpen,
  ClipboardList,
  FilePlus,
  MapPin,
  Clock,
  CheckCircle2,
  Inbox,
  ArrowRight
} from "lucide-react";

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
            subject: "New Gate Pass Request",
            message: `${userProfile.name} (${userProfile.registerNo}) has submitted a Gate Pass request for: ${reasonText}.\nPlace: ${form.place}\nOut: ${form.outDate} ${form.outTime}\nIn: ${form.inDate} ${form.inTime}`
          });
        }
      });

      setSuccess("Gate pass request submitted successfully! Pending faculty approval.");
      setForm({ reason: "", otherReason: "", outDate: "", outTime: "", inDate: "", inTime: "", place: "" });
    } catch (err) {
      setError("Failed to submit request. Try again.");
    }
    setLoading(false);
  }

  async function fetchPasses() {
    setFetching(true);
    try {
      const q = query(
        collection(db, "gate_pass"),
        where("studentId", "==", currentUser.uid)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setPasses(list);
    } catch (err) {}
    setFetching(false);
  }

  useEffect(() => {
    if (tab === "history" && currentUser) fetchPasses();
  }, [tab, currentUser]);

  const statusInfo = {
    pending_staff: { label: "Pending Staff Approval", color: "var(--warning)" },
    pending_hod: { label: "Pending HOD Approval", color: "var(--warning)" },
    pending_principal: { label: "Pending Principal Approval", color: "var(--warning)" },
    approved: { label: "Approved (Gate Pass Issued)", color: "var(--success)" },
    rejected: { label: "Rejected", color: "var(--danger)" }
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Gate Pass System</h1>
          <p>Request outgoing permission & view status QR codes</p>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
          <button onClick={() => setTab("apply")} style={{
            padding: "10px 22px", borderRadius: "var(--radius-md)", border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8,
            background: tab === "apply" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
            color: tab === "apply" ? "var(--highlight)" : "var(--text-muted)", transition: "all 0.2s ease"
          }}>
            <FilePlus size={16} /> Apply Pass
          </button>
          <button onClick={() => setTab("history")} style={{
            padding: "10px 22px", borderRadius: "var(--radius-md)", border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8,
            background: tab === "history" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
            color: tab === "history" ? "var(--highlight)" : "var(--text-muted)", transition: "all 0.2s ease"
          }}>
            <ClipboardList size={16} /> My Requests
          </button>
        </div>

        {tab === "apply" && (
          <div className="card" style={{ maxWidth: 640 }}>
            <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, marginBottom: 24, fontWeight: 700 }}>
              New Gate Pass Application
            </h3>
            {error && <div className="error-msg">{error}</div>}
            {success && (
              <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "var(--radius-md)", padding: "12px 16px", color: "var(--success)", fontSize: 14, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={16} /> {success}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Reason for Leave *</label>
                <select name="reason" value={form.reason} onChange={handleChange} required>
                  <option value="">Select Reason</option>
                  {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {form.reason === "Other" && (
                <div className="form-group">
                  <label>Specify Reason *</label>
                  <input type="text" name="otherReason" placeholder="Enter your specific reason" value={form.otherReason} onChange={handleChange} required />
                </div>
              )}
              <div className="form-group">
                <label>Destination / Place to Visit *</label>
                <input type="text" name="place" placeholder="e.g. Government Hospital, Chennai" value={form.place} onChange={handleChange} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Out Date *</label>
                  <input type="date" name="outDate" value={form.outDate} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Out Time *</label>
                  <input type="time" name="outTime" value={form.outTime} onChange={handleChange} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Expected Return Date *</label>
                  <input type="date" name="inDate" value={form.inDate} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Expected Return Time *</label>
                  <input type="time" name="inTime" value={form.inTime} onChange={handleChange} required />
                </div>
              </div>
              <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
                {loading ? "Submitting..." : <>Submit Request <ArrowRight size={16} /></>}
              </button>
            </form>
          </div>
        )}

        {tab === "history" && (
          fetching ? (
            <div style={{ textAlign: "center", padding: 40 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
          ) : passes.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 50 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <Inbox size={48} color="var(--text-muted)" />
              </div>
              <p style={{ color: "var(--text-muted)" }}>No gate pass requests found.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {passes.map(pass => (
                <div key={pass.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                    <div>
                      <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8, color: "var(--text)" }}>{pass.reason}</h3>
                      <div style={{ color: "var(--text-muted)", fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><MapPin size={14} color="var(--highlight)" /> Destination: {pass.place}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Clock size={14} /> Out: {pass.outDate} at {pass.outTime}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Clock size={14} /> Expected Return: {pass.inDate} at {pass.inTime}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className="badge" style={{
                        background: `${statusInfo[pass.status]?.color}20`,
                        color: statusInfo[pass.status]?.color,
                        border: `1px solid ${statusInfo[pass.status]?.color}40`,
                        padding: "6px 14px", fontSize: 12
                      }}>
                        {statusInfo[pass.status]?.label}
                      </span>
                      {pass.status === "approved" && pass.token && (
                        <div style={{ marginTop: 14, padding: "16px", background: "white", borderRadius: "var(--radius-md)", textAlign: "center", display: "inline-block", boxShadow: "var(--shadow-sm)" }}>
                          <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginBottom: 8, letterSpacing: "0.05em" }}>APPROVED GATE PASS</div>
                          <div style={{ background: "white", padding: "8px", borderRadius: "8px" }}>
                            <QRCode value={pass.token} size={110} level="M" />
                          </div>
                          <div style={{ fontSize: 11, color: "#475569", marginTop: 8, fontWeight: 600 }}>Scan at Gate Security</div>
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