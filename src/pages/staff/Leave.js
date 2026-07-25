// src/pages/staff/Leave.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, addDoc, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { sendEmail } from "../../utils/notifications";
import {
  ClipboardList,
  GraduationCap,
  FilePlus,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  Inbox
} from "lucide-react";

const LEAVE_TYPES = ["Sick Leave", "Personal Leave", "Family Emergency", "Medical", "Other"];

export default function StaffLeave() {
  const { currentUser, userProfile } = useAuth();
  const [tab, setTab] = useState("student_leaves");
  const [leaves, setLeaves] = useState([]);
  const [myLeaves, setMyLeaves] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [actionLoading, setActionLoading] = useState("");

  const [form, setForm] = useState({
    fromDate: "", toDate: "", reason: "", leaveType: "", otherReason: ""
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState("");
  const [formError, setFormError] = useState("");

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function fetchStudentLeaves() {
    setFetching(true);
    try {
      const q = query(
        collection(db, "leave_requests"),
        where("department", "==", userProfile.dept),
        where("status", "==", "pending_staff")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setLeaves(list);
    } catch (err) {}
    setFetching(false);
  }

  async function fetchMyLeaves() {
    setFetching(true);
    try {
      const q = query(
        collection(db, "leave_requests"),
        where("studentId", "==", currentUser.uid)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setMyLeaves(list);
    } catch (err) {}
    setFetching(false);
  }

  async function handleApprove(leave) {
    setActionLoading(leave.id);
    try {
      await updateDoc(doc(db, "leave_requests", leave.id), {
        status: "pending_hod",
        staffApprovedBy: userProfile.name,
        staffApprovedAt: new Date().toISOString()
      });

      const hodQ = query(
        collection(db, "users"),
        where("role", "==", "hod"),
        where("dept", "==", userProfile.dept)
      );
      const hodSnap = await getDocs(hodQ);
      if (!hodSnap.empty) {
        const hodData = hodSnap.docs[0].data();
        if (hodData.email) {
          sendEmail({
            toEmail: hodData.email,
            toName: hodData.name,
            subject: "Leave Request Approved by Staff — HOD Approval Required",
            message: `Staff ${userProfile.name} approved leave for ${leave.name} (${leave.registerNo}). Please review and grant final approval.`
          });
        }
      }

      fetchStudentLeaves();
    } catch (err) {}
    setActionLoading("");
  }

  async function handleReject(leave) {
    setActionLoading(leave.id);
    try {
      await updateDoc(doc(db, "leave_requests", leave.id), {
        status: "rejected",
        rejectedBy: userProfile.name,
        rejectedAt: new Date().toISOString()
      });

      if (leave.email) {
        sendEmail({
          toEmail: leave.email,
          toName: leave.name,
          subject: "Leave Application Status Update",
          message: `Your leave request from ${leave.fromDate} to ${leave.toDate} was rejected by Staff ${userProfile.name}.`
        });
      }

      fetchStudentLeaves();
    } catch (err) {}
    setActionLoading("");
  }

  async function handleApplyLeave(e) {
    e.preventDefault();
    setFormError(""); setFormSuccess("");
    if (!form.fromDate || !form.toDate || !form.reason || !form.leaveType) {
      return setFormError("Please fill all required fields.");
    }
    if (new Date(form.toDate) < new Date(form.fromDate)) {
      return setFormError("To Date cannot be before From Date.");
    }
    setFormLoading(true);
    try {
      const reasonText = form.leaveType === "Other" ? form.otherReason : form.reason;

      await addDoc(collection(db, "leave_requests"), {
        studentId: currentUser.uid,
        name: userProfile.name,
        email: currentUser.email,
        registerNo: userProfile.employeeId || "FACULTY",
        department: userProfile.dept,
        year: "Staff",
        phone: userProfile.phone || "",
        fromDate: form.fromDate,
        toDate: form.toDate,
        reason: reasonText,
        leaveType: form.leaveType,
        role: "staff",
        status: "pending_hod",
        createdAt: new Date().toISOString()
      });

      const hodQ = query(
        collection(db, "users"),
        where("role", "==", "hod"),
        where("dept", "==", userProfile.dept)
      );
      const hodSnap = await getDocs(hodQ);
      if (!hodSnap.empty) {
        const hodData = hodSnap.docs[0].data();
        if (hodData.email) {
          sendEmail({
            toEmail: hodData.email,
            toName: hodData.name,
            subject: "Faculty Leave Application",
            message: `Faculty Staff ${userProfile.name} has submitted a Leave request (${form.leaveType}) from ${form.fromDate} to ${form.toDate}.\nReason: ${reasonText}`
          });
        }
      }

      setFormSuccess("Leave request submitted successfully! Pending HOD approval.");
      setForm({ fromDate: "", toDate: "", reason: "", leaveType: "", otherReason: "" });
    } catch (err) {
      setFormError("Failed to submit. Try again.");
    }
    setFormLoading(false);
  }

  function getDayCount(from, to) {
    const diff = new Date(to) - new Date(from);
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  useEffect(() => {
    if (tab === "student_leaves") fetchStudentLeaves();
    if (tab === "my_leaves") fetchMyLeaves();
  }, [tab]);

  const statusInfo = {
    pending_staff: { label: "Pending Staff Approval", color: "var(--warning)" },
    pending_hod: { label: "Pending HOD Approval", color: "var(--warning)" },
    approved: { label: "Leave Approved", color: "var(--success)" },
    rejected: { label: "Leave Rejected", color: "var(--danger)" }
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Leave Management (Faculty)</h1>
          <p>Verify student leave applications & submit faculty leave requests</p>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap", borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
          {[
            { key: "student_leaves", label: "Student Leave Requests", icon: <GraduationCap size={16} /> },
            { key: "apply_leave", label: "Apply My Leave", icon: <FilePlus size={16} /> },
            { key: "my_leaves", label: "My Leave History", icon: <ClipboardList size={16} /> }
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.2s ease", display: "inline-flex", alignItems: "center", gap: 6,
              background: tab === t.key ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
              color: tab === t.key ? "var(--highlight)" : "var(--text-muted)"
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Student Leave Requests */}
        {tab === "student_leaves" && (
          fetching ? (
            <div style={{ textAlign: "center", padding: 60 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
          ) : leaves.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 50 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <Inbox size={48} color="var(--text-muted)" />
              </div>
              <p style={{ color: "var(--text-muted)" }}>No pending student leave applications for {userProfile?.dept}.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {leaves.map(leave => (
                <div key={leave.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                          {leave.name} ({leave.registerNo})
                        </span>
                        <span className="badge" style={{ background: "rgba(37, 99, 235, 0.14)", color: "var(--highlight)", border: "1px solid rgba(37, 99, 235, 0.3)" }}>
                          {leave.year}
                        </span>
                      </div>
                      <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 6 }}>
                        Category: <strong>{leave.leaveType}</strong> • Reason: {leave.reason}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        From: {leave.fromDate} → To: {leave.toDate} ({getDayCount(leave.fromDate, leave.toDate)} days)
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button
                        onClick={() => handleApprove(leave)}
                        disabled={actionLoading === leave.id}
                        style={{
                          padding: "6px 14px", borderRadius: "var(--radius-sm)",
                          background: "var(--success)", border: "none", color: "white",
                          fontSize: 12, fontWeight: 600, cursor: "pointer"
                        }}
                      >
                        Approve & Forward
                      </button>
                      <button
                        onClick={() => handleReject(leave)}
                        disabled={actionLoading === leave.id}
                        style={{
                          padding: "6px 14px", borderRadius: "var(--radius-sm)",
                          background: "var(--danger)", border: "none", color: "white",
                          fontSize: 12, fontWeight: 600, cursor: "pointer"
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Faculty Apply Leave Form */}
        {tab === "apply_leave" && (
          <div className="card" style={{ maxWidth: 640 }}>
            <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, marginBottom: 24, fontWeight: 700 }}>
              Faculty Leave Application
            </h3>
            {formError && <div className="error-msg">{formError}</div>}
            {formSuccess && (
              <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "var(--radius-md)", padding: "12px 16px", color: "var(--success)", fontSize: 14, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={16} /> {formSuccess}
              </div>
            )}
            <form onSubmit={handleApplyLeave}>
              <div className="form-group">
                <label>Leave Category *</label>
                <select name="leaveType" value={form.leaveType} onChange={handleChange} required>
                  <option value="">Select Category</option>
                  {LEAVE_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Reason *</label>
                <textarea name="reason" placeholder="Explain reason for leave..." value={form.reason} onChange={handleChange} required rows={3} />
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
              <button className="btn-primary" type="submit" disabled={formLoading} style={{ marginTop: 8 }}>
                {formLoading ? "Submitting..." : <>Submit Faculty Leave <ArrowRight size={16} /></>}
              </button>
            </form>
          </div>
        )}

        {/* My Faculty Leaves */}
        {tab === "my_leaves" && (
          fetching ? (
            <div style={{ textAlign: "center", padding: 60 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
          ) : myLeaves.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 50 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <Inbox size={48} color="var(--text-muted)" />
              </div>
              <p style={{ color: "var(--text-muted)" }}>No personal leave records found.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {myLeaves.map(leave => (
                <div key={leave.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                    <div>
                      <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 6, color: "var(--text)" }}>{leave.leaveType}</h3>
                      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 8 }}>{leave.reason}</p>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        From: {leave.fromDate} → To: {leave.toDate} ({getDayCount(leave.fromDate, leave.toDate)} days)
                      </div>
                    </div>
                    <span className="badge" style={{
                      background: `${statusInfo[leave.status]?.color}20`,
                      color: statusInfo[leave.status]?.color,
                      border: `1px solid ${statusInfo[leave.status]?.color}40`,
                      padding: "6px 14px", fontSize: 12
                    }}>
                      {statusInfo[leave.status]?.label}
                    </span>
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
