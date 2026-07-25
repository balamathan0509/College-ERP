// src/pages/hod/Leave.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { sendEmail } from "../../utils/notifications";
import {
  GraduationCap,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  Inbox,
  Calendar
} from "lucide-react";

export default function HodLeave() {
  const { userProfile } = useAuth();
  const [tab, setTab] = useState("student_leaves");
  const [studentLeaves, setStudentLeaves] = useState([]);
  const [staffLeaves, setStaffLeaves] = useState([]);
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [actionLoading, setActionLoading] = useState("");

  async function fetchLeaves() {
    setFetching(true);
    try {
      const q1 = query(
        collection(db, "leave_requests"),
        where("department", "==", userProfile.dept),
        where("status", "==", "pending_hod"),
        where("role", "==", "student")
      );
      const snap1 = await getDocs(q1);
      const students = snap1.docs.map(d => ({ id: d.id, ...d.data() }));
      students.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setStudentLeaves(students);

      const q2 = query(
        collection(db, "leave_requests"),
        where("department", "==", userProfile.dept),
        where("status", "==", "pending_hod"),
        where("role", "==", "staff")
      );
      const snap2 = await getDocs(q2);
      const staff = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      staff.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setStaffLeaves(staff);

      const q3 = query(
        collection(db, "leave_requests"),
        where("department", "==", userProfile.dept),
        where("status", "==", "approved")
      );
      const snap3 = await getDocs(q3);
      const approved = snap3.docs.map(d => ({ id: d.id, ...d.data() }));
      approved.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setApprovedLeaves(approved);
    } catch (err) {}
    setFetching(false);
  }

  useEffect(() => {
    if (userProfile) fetchLeaves();
  }, [userProfile]);

  async function handleAction(leave, action) {
    setActionLoading(leave.id + action);
    try {
      const ref = doc(db, "leave_requests", leave.id);
      const timestamp = new Date().toISOString();

      if (action === "approve") {
        await updateDoc(ref, {
          status: "approved",
          hodApprovedBy: userProfile.name,
          hodApprovedAt: timestamp
        });
        if (leave.email) {
          sendEmail({
            toEmail: leave.email,
            toName: leave.name,
            subject: "Leave Application Approved by HOD",
            message: `Your leave application from ${leave.fromDate} to ${leave.toDate} has been granted approval by HOD ${userProfile.name}.`
          });
        }
      } else if (action === "forward") {
        await updateDoc(ref, {
          status: "pending_principal",
          hodForwardedBy: userProfile.name,
          hodForwardedAt: timestamp
        });

        const prinQ = query(collection(db, "users"), where("role", "==", "principal"));
        const prinSnap = await getDocs(prinQ);
        if (!prinSnap.empty) {
          const prinUser = prinSnap.docs[0].data();
          if (prinUser.email) {
            sendEmail({
              toEmail: prinUser.email,
              toName: prinUser.name,
              subject: "Leave Request Forwarded by HOD",
              message: `HOD ${userProfile.name} (${userProfile.dept}) has forwarded a leave request for ${leave.name} (${leave.role.toUpperCase()}) to Principal review.`
            });
          }
        }
      } else if (action === "reject") {
        await updateDoc(ref, {
          status: "rejected",
          rejectedBy: userProfile.name,
          rejectedAt: timestamp
        });
        if (leave.email) {
          sendEmail({
            toEmail: leave.email,
            toName: leave.name,
            subject: "Leave Application Status Update",
            message: `Your leave application from ${leave.fromDate} to ${leave.toDate} was rejected by HOD ${userProfile.name}.`
          });
        }
      }

      fetchLeaves();
    } catch (err) {}
    setActionLoading("");
  }

  function getDayCount(from, to) {
    const diff = new Date(to) - new Date(from);
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  function renderLeaveCard(leave) {
    return (
      <div key={leave.id} className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                {leave.name}
              </span>
              <span className="badge" style={{ background: "rgba(37, 99, 235, 0.14)", color: "var(--highlight)", border: "1px solid rgba(37, 99, 235, 0.3)" }}>
                {leave.registerNo} • {leave.year}
              </span>
              <span className="badge badge-warning">{leave.leaveType}</span>
            </div>

            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
              Reason: <strong>{leave.reason}</strong>
            </p>

            <div style={{ display: "flex", gap: 20, fontSize: 12, color: "var(--text-muted)", flexWrap: "wrap" }}>
              <div>From: <strong>{leave.fromDate}</strong></div>
              <div>To: <strong>{leave.toDate}</strong></div>
              <div>Duration: <strong>{getDayCount(leave.fromDate, leave.toDate)} days</strong></div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {leave.role === "student" && (
              <button
                onClick={() => handleAction(leave, "approve")}
                disabled={!!actionLoading}
                style={{
                  padding: "8px 16px", borderRadius: "var(--radius-sm)",
                  background: "var(--success)", border: "none", color: "white",
                  fontSize: 12, fontWeight: 600, cursor: "pointer"
                }}
              >
                Grant Approval
              </button>
            )}
            <button
              onClick={() => handleAction(leave, "forward")}
              disabled={!!actionLoading}
              style={{
                padding: "8px 16px", borderRadius: "var(--radius-sm)",
                background: "rgba(37, 99, 235, 0.2)", border: "1px solid rgba(37, 99, 235, 0.4)", color: "var(--highlight)",
                fontSize: 12, fontWeight: 600, cursor: "pointer"
              }}
            >
              Forward to Principal
            </button>
            <button
              onClick={() => handleAction(leave, "reject")}
              disabled={!!actionLoading}
              style={{
                padding: "8px 16px", borderRadius: "var(--radius-sm)",
                background: "var(--danger)", border: "none", color: "white",
                fontSize: 12, fontWeight: 600, cursor: "pointer"
              }}
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Department Leave Approvals</h1>
          <p>{userProfile?.dept} Department • HOD Executive Portal</p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <GraduationCap size={24} color="var(--danger)" />
            </div>
            <div className="stat-value" style={{ color: studentLeaves.length > 0 ? "var(--danger)" : "var(--success)" }}>
              {studentLeaves.length}
            </div>
            <div className="stat-label">Pending Student Leaves</div>
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Users size={24} color="var(--warning)" />
            </div>
            <div className="stat-value" style={{ color: staffLeaves.length > 0 ? "var(--warning)" : "var(--success)" }}>
              {staffLeaves.length}
            </div>
            <div className="stat-label">Pending Staff Leaves</div>
          </div>
          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <CheckCircle2 size={24} color="var(--success)" />
            </div>
            <div className="stat-value" style={{ color: "var(--success)" }}>
              {approvedLeaves.length}
            </div>
            <div className="stat-label">Approved Department Leaves</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
          <button
            onClick={() => setTab("student_leaves")}
            style={{
              padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.2s ease",
              background: tab === "student_leaves" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
              color: tab === "student_leaves" ? "var(--highlight)" : "var(--text-muted)"
            }}
          >
            Student Leaves ({studentLeaves.length})
          </button>
          <button
            onClick={() => setTab("staff_leaves")}
            style={{
              padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.2s ease",
              background: tab === "staff_leaves" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
              color: tab === "staff_leaves" ? "var(--highlight)" : "var(--text-muted)"
            }}
          >
            Staff Leaves ({staffLeaves.length})
          </button>
          <button
            onClick={() => setTab("approved")}
            style={{
              padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.2s ease",
              background: tab === "approved" ? "rgba(16, 185, 129, 0.18)" : "rgba(255,255,255,0.04)",
              color: tab === "approved" ? "var(--success)" : "var(--text-muted)"
            }}
          >
            Approved History ({approvedLeaves.length})
          </button>
        </div>

        {/* Content */}
        {fetching ? (
          <div style={{ textAlign: "center", padding: 60 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
        ) : tab === "student_leaves" ? (
          studentLeaves.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 50 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <Inbox size={48} color="var(--text-muted)" />
              </div>
              <p style={{ color: "var(--text-muted)" }}>No student leave requests pending HOD approval.</p>
            </div>
          ) : (
            studentLeaves.map(renderLeaveCard)
          )
        ) : tab === "staff_leaves" ? (
          staffLeaves.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 50 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <Inbox size={48} color="var(--text-muted)" />
              </div>
              <p style={{ color: "var(--text-muted)" }}>No staff leave requests pending HOD approval.</p>
            </div>
          ) : (
            staffLeaves.map(renderLeaveCard)
          )
        ) : (
          approvedLeaves.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 50 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <Inbox size={48} color="var(--text-muted)" />
              </div>
              <p style={{ color: "var(--text-muted)" }}>No approved leave history found.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {approvedLeaves.map(leave => (
                <div key={leave.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                          {leave.name}
                        </span>
                        <span className="badge badge-success">Approved</span>
                      </div>
                      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 4 }}>
                        Category: {leave.leaveType} • Reason: {leave.reason}
                      </p>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        From: {leave.fromDate} → To: {leave.toDate} ({getDayCount(leave.fromDate, leave.toDate)} days)
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
