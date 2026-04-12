// src/pages/staff/Leave.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, addDoc, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { sendEmail } from "../../utils/notifications";

const LEAVE_TYPES = ["Sick Leave", "Personal Leave", "Family Emergency", "Medical", "Other"];

export default function StaffLeave() {
  const { currentUser, userProfile } = useAuth();
  const [tab, setTab] = useState("student_leaves");
  const [leaves, setLeaves] = useState([]);
  const [myLeaves, setMyLeaves] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [actionLoading, setActionLoading] = useState("");

  // Staff's own leave form state
  const [form, setForm] = useState({
    fromDate: "", toDate: "", reason: "", leaveType: "", otherReason: ""
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState("");
  const [formError, setFormError] = useState("");

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // Fetch student leave requests for staff's department
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

  // Fetch staff's own leave requests
  async function fetchMyLeaves() {
    setFetching(true);
    try {
      const q = query(
        collection(db, "leave_requests"),
        where("studentId", "==", currentUser.uid),
        where("role", "==", "staff")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setMyLeaves(list);
    } catch (err) {}
    setFetching(false);
  }

  // Handle approve/reject student leave
  async function handleAction(leave, action) {
    setActionLoading(leave.id + action);
    try {
      await updateDoc(doc(db, "leave_requests", leave.id), {
        status: action === "approve" ? "pending_hod" : "rejected",
        staffActionAt: new Date().toISOString(),
        staffName: userProfile.name
      });

      if (action === "approve") {
        // Email to HOD
        const hodQ = query(
          collection(db, "users"),
          where("role", "==", "hod"),
          where("dept", "==", userProfile.dept)
        );
        const hodSnap = await getDocs(hodQ);
        const hodList = hodSnap.docs.map(d => d.data());

        for (const hod of hodList) {
          if (hod.email) {
            await sendEmail({
              toEmail: hod.email,
              toName: hod.name,
              subject: `📋 Leave Approved by Staff — ${leave.name}`,
              message: `Hi ${hod.name},

${leave.name} (${leave.registerNo}, ${leave.year} - ${leave.department})'s leave request has been approved by ${userProfile.name} (Staff) and requires your final approval.

📋 Leave Type: ${leave.leaveType}
📝 Reason: ${leave.reason}
📅 From: ${leave.fromDate}
📅 To: ${leave.toDate}
📞 Phone: ${leave.phone || "Not provided"}

Please login to College Portal to give Final Approval or Reject.

Regards,
College Portal`
            });
          }
        }
      } else {
        // Rejected — email to student
        if (leave.email) {
          await sendEmail({
            toEmail: leave.email,
            toName: leave.name,
            subject: `❌ Leave Request Rejected — ${leave.leaveType}`,
            message: `Hi ${leave.name},

Your leave request has been rejected by ${userProfile.name} (Staff, ${userProfile.dept}).

📋 Leave Type: ${leave.leaveType}
📝 Reason: ${leave.reason}
📅 From: ${leave.fromDate}
📅 To: ${leave.toDate}

If you have any queries, please contact your class staff directly.

Regards,
College Portal`
          });
        }
      }

      setLeaves(prev => prev.filter(p => p.id !== leave.id));
    } catch (err) {}
    setActionLoading("");
  }

  // Staff submits their own leave
  async function handleStaffLeaveSubmit(e) {
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
      await addDoc(collection(db, "leave_requests"), {
        studentId: currentUser.uid,
        name: userProfile.name,
        email: currentUser.email,
        department: userProfile.dept,
        phone: userProfile.phone || "",
        fromDate: form.fromDate,
        toDate: form.toDate,
        reason: form.reason,
        leaveType: form.leaveType === "Other" ? form.otherReason : form.leaveType,
        role: "staff",
        status: "pending_hod",
        createdAt: new Date().toISOString()
      });

      // Notify HOD
      const hodQ = query(
        collection(db, "users"),
        where("role", "==", "hod"),
        where("dept", "==", userProfile.dept)
      );
      const hodSnap = await getDocs(hodQ);
      const hodList = hodSnap.docs.map(d => d.data());

      for (const hod of hodList) {
        if (hod.email) {
          await sendEmail({
            toEmail: hod.email,
            toName: hod.name,
            subject: `📋 Staff Leave Request — ${userProfile.name}`,
            message: `Hi ${hod.name},

${userProfile.name} (Staff, ${userProfile.dept}) has submitted a leave request.

📋 Leave Type: ${form.leaveType === "Other" ? form.otherReason : form.leaveType}
📝 Reason: ${form.reason}
📅 From: ${form.fromDate}
📅 To: ${form.toDate}
📞 Phone: ${userProfile.phone || "Not provided"}

Please login to College Portal to Approve or Reject.

Regards,
College Portal`
          });
        }
      }

      setFormSuccess("Leave request submitted! HOD has been notified via email.");
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
          <h1>📋 Leave Management</h1>
          <p>Manage student leaves & apply for your own</p>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
          {[
            { key: "student_leaves", label: "🎒 Student Leaves" },
            { key: "apply_leave", label: "📝 Apply My Leave" },
            { key: "my_leaves", label: "📋 My Leaves" }
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer",
              fontFamily: "Syne", fontWeight: 600, fontSize: 14,
              background: tab === t.key ? "#e94560" : "rgba(255,255,255,0.07)",
              color: "white", transition: "all 0.2s"
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Student Leave Requests */}
        {tab === "student_leaves" && (
          fetching ? (
            <div style={{ textAlign: "center", padding: 60 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
          ) : leaves.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <p style={{ color: "#a0aec0", fontSize: 16 }}>No pending student leave requests!</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {leaves.map(leave => (
                <div key={leave.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(233,69,96,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎒</div>
                        <div>
                          <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16 }}>{leave.name}</div>
                          <div style={{ color: "#a0aec0", fontSize: 13 }}>{leave.registerNo} • {leave.year} • {leave.department}</div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 16 }}>
                        <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>LEAVE TYPE</div><div style={{ fontWeight: 600, fontSize: 14 }}>{leave.leaveType}</div></div>
                        <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>REASON</div><div style={{ fontWeight: 600, fontSize: 14 }}>{leave.reason}</div></div>
                        <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>FROM</div><div style={{ fontWeight: 600, fontSize: 14 }}>📅 {leave.fromDate}</div></div>
                        <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>TO</div><div style={{ fontWeight: 600, fontSize: 14 }}>📅 {leave.toDate}</div></div>
                        <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>DURATION</div><div style={{ fontWeight: 600, fontSize: 14 }}>⏱️ {getDayCount(leave.fromDate, leave.toDate)} day(s)</div></div>
                        {leave.phone && <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>PHONE</div><div style={{ fontWeight: 600, fontSize: 14 }}>📞 {leave.phone}</div></div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 160 }}>
                      <button onClick={() => handleAction(leave, "approve")} disabled={!!actionLoading} style={{
                        padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(72,187,120,0.3)",
                        background: "rgba(72,187,120,0.15)", color: "#48bb78", fontWeight: 700, fontSize: 14, cursor: "pointer"
                      }}>
                        {actionLoading === leave.id + "approve" ? "..." : "✅ Approve → HOD"}
                      </button>
                      <button onClick={() => handleAction(leave, "reject")} disabled={!!actionLoading} style={{
                        padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(252,129,129,0.3)",
                        background: "rgba(252,129,129,0.1)", color: "#fc8181", fontWeight: 700, fontSize: 14, cursor: "pointer"
                      }}>
                        {actionLoading === leave.id + "reject" ? "..." : "❌ Reject"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Staff Apply Leave */}
        {tab === "apply_leave" && (
          <div className="card" style={{ maxWidth: 600 }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 24 }}>Apply for Leave</h3>
            {formError && <div className="error-msg">{formError}</div>}
            {formSuccess && (
              <div style={{ background: "rgba(72,187,120,0.1)", border: "1px solid rgba(72,187,120,0.3)", borderRadius: 10, padding: "12px 16px", color: "#48bb78", fontSize: 14, marginBottom: 20 }}>
                ✅ {formSuccess}
              </div>
            )}
            <form onSubmit={handleStaffLeaveSubmit}>
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
              <button className="btn-primary" type="submit" disabled={formLoading}>
                {formLoading ? "Submitting..." : "Submit Leave Request →"}
              </button>
            </form>
          </div>
        )}

        {/* Staff's Own Leaves History */}
        {tab === "my_leaves" && (
          fetching ? (
            <div style={{ textAlign: "center", padding: 40 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
          ) : myLeaves.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
              <p style={{ color: "#a0aec0" }}>No leave requests yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {myLeaves.map(leave => (
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
