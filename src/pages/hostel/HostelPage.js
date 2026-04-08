// src/pages/hostel/HostelPage.js
import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where
} from "firebase/firestore";

// Constants
const ROOM_TYPES = ["Single", "Double", "Triple", "Four-sharing"];
const COMPLAINT_CATS = ["Plumbing", "Electrical", "Cleaning", "Furniture", "WiFi", "Mess", "Security", "Other"];
const COMPLAINT_STATUS = [
  { value: "open", label: "Open", color: "#f6ad55" },
  { value: "in_progress", label: "In Progress", color: "#4299e1" },
  { value: "resolved", label: "Resolved", color: "#48bb78" },
  { value: "closed", label: "Closed", color: "#a0aec0" }
];
const GATEPASS_STATUS = [
  { value: "pending", label: "Pending", color: "#f6ad55" },
  { value: "approved", label: "Approved", color: "#48bb78" },
  { value: "rejected", label: "Rejected", color: "#fc8181" }
];
const FEE_STATUS = [
  { value: "pending", label: "Pending", color: "#f6ad55" },
  { value: "paid", label: "Paid", color: "#48bb78" },
  { value: "overdue", label: "Overdue", color: "#fc8181" }
];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEALS = ["Breakfast", "Lunch", "Dinner"];

// Helpers
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d) ? v : d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

// TAB: Attendance (Warden)
function AttendanceTab({ attendance, allotments, currentUser, userProfile, refresh }) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [present, setPresent] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(""); const [suc, setSuc] = useState("");

  const activeStudents = allotments.filter(a => a.status === "active");
  const todayAtt = attendance.filter(a => a.date === date);

  async function saveAttendance() {
    setErr(""); setSuc(""); setSaving(true);
    try {
      await Promise.all(activeStudents.map(s =>
        addDoc(collection(db, "hostel_attendance"), {
          studentId: s.studentId, studentName: s.studentName, registerNo: s.registerNo || "",
          dept: s.dept, blockName: s.blockName, roomNo: s.roomNo,
          date, present: present.has(s.studentId),
          markedById: currentUser.uid, markedByName: userProfile.name, markedAt: new Date().toISOString()
        })
      ));
      setSuc(`Attendance saved for ${date}.`); refresh();
    } catch { setErr("Failed to save attendance."); }
    setSaving(false);
  }

  function toggleAll() {
    if (present.size === activeStudents.length) setPresent(new Set());
    else setPresent(new Set(activeStudents.map(s => s.studentId)));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <h3 style={{ fontFamily: "Syne", fontSize: 18, margin: 0 }}>Mark Attendance</h3>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ minWidth: 160 }} />
            <button onClick={toggleAll} style={btnGhost}>Toggle All</button>
            <button onClick={saveAttendance} disabled={saving} style={btnPrimary}>{saving ? "Saving..." : "Save Attendance"}</button>
          </div>
        </div>
        <ErrMsg msg={err} /><SuccessMsg msg={suc} />
        <div style={{ fontSize: 13, color: "#a0aec0", marginBottom: 12 }}>
          Present: {present.size} / {activeStudents.length}
        </div>
        {activeStudents.length === 0 ? <div style={{ color: "#a0aec0", fontSize: 13 }}>No active residents found.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activeStudents.map(s => (
              <label key={s.studentId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: present.has(s.studentId) ? "rgba(72,187,120,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${present.has(s.studentId) ? "rgba(72,187,120,0.3)" : "rgba(255,255,255,0.08)"}`, cursor: "pointer" }}>
                <input type="checkbox" checked={present.has(s.studentId)} onChange={() => {
                  const ns = new Set(present);
                  ns.has(s.studentId) ? ns.delete(s.studentId) : ns.add(s.studentId);
                  setPresent(ns);
                }} style={{ width: 16, height: 16 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.studentName} {s.registerNo ? `- ${s.registerNo}` : ""}</div>
                  <div style={{ fontSize: 12, color: "#a0aec0" }}>{s.dept} | {s.blockName} - Room {s.roomNo}</div>
                </div>
                <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: present.has(s.studentId) ? "#48bb78" : "#fc8181" }}>
                  {present.has(s.studentId) ? "Present" : "Absent"}
                </span>
              </label>
            ))}
          </div>
        )}
      </Card>

      {todayAtt.length > 0 && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 17, margin: 0 }}>Saved - {fmtDate(date)}</h3>
            <button onClick={() => exportCSV(todayAtt.map(a => [a.studentName, a.registerNo, a.dept, a.blockName, a.roomNo, a.present ? "Present" : "Absent", fmtDT(a.markedAt)]), ["Name", "Reg No", "Dept", "Block", "Room", "Status", "Marked At"], `attendance_${date}.csv`)} style={btnGhost}>Export CSV</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {todayAtt.map(a => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.studentName} {a.registerNo ? `- ${a.registerNo}` : ""}</div>
                  <div style={{ fontSize: 12, color: "#a0aec0" }}>{a.dept} | {a.blockName} - Room {a.roomNo}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: a.present ? "#48bb78" : "#fc8181" }}>{a.present ? "Present" : "Absent"}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// TAB: Mess Menu
function MessTab({ messmenu, isStudent, currentUser, userProfile, refresh }) {
  const [menuForm, setMenuForm] = useState({ day: "Monday", meal: "Breakfast", items: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(""); const [suc, setSuc] = useState("");
  const [fbForm, setFbForm] = useState({ rating: "4", comment: "", meal: "Breakfast" });
  const [fbSaving, setFbSaving] = useState(false);

  async function saveMenu(e) {
    e.preventDefault(); setErr(""); setSuc("");
    if (!menuForm.items.trim()) return setErr("Menu items required.");
    setSaving(true);
    try {
      const existing = messmenu.find(m => m.day === menuForm.day && m.meal === menuForm.meal);
      if (existing) {
        await updateDoc(doc(db, "hostel_mess", existing.id), { items: menuForm.items.trim(), updatedAt: new Date().toISOString() });
      } else {
        await addDoc(collection(db, "hostel_mess"), { ...menuForm, items: menuForm.items.trim(), createdAt: new Date().toISOString() });
      }
      setSuc("Menu saved."); setMenuForm(p => ({ ...p, items: "" })); refresh();
    } catch { setErr("Failed to save menu."); }
    setSaving(false);
  }

  async function submitFeedback(e) {
    e.preventDefault();
    setFbSaving(true);
    try {
      await addDoc(collection(db, "hostel_mess_feedback"), {
        ...fbForm, rating: Number(fbForm.rating),
        studentId: currentUser.uid, studentName: userProfile.name,
        createdAt: new Date().toISOString()
      });
      setSuc("Feedback submitted."); setFbForm({ rating: "4", comment: "", meal: "Breakfast" });
    } catch { setErr("Failed to submit feedback."); }
    setFbSaving(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {!isStudent && (
        <Card>
          <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 16 }}>Update Mess Menu</h3>
          <ErrMsg msg={err} /><SuccessMsg msg={suc} />
          <form onSubmit={saveMenu}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12 }}>
              <div className="form-group">
                <label>Day</label>
                <select value={menuForm.day} onChange={e => setMenuForm(p => ({ ...p, day: e.target.value }))}>
                  {DAYS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Meal</label>
                <select value={menuForm.meal} onChange={e => setMenuForm(p => ({ ...p, meal: e.target.value }))}>
                  {MEALS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Items</label>
                <input value={menuForm.items} placeholder="Idli, Sambar, Chutney" onChange={e => setMenuForm(p => ({ ...p, items: e.target.value }))} />
              </div>
            </div>
            <button className="btn-primary" type="submit" disabled={saving} style={{ marginTop: 8 }}>{saving ? "Saving..." : "Save Menu"}</button>
          </form>
        </Card>
      )}

      <Card>
        <h3 style={{ fontFamily: "Syne", fontSize: 17, marginBottom: 16 }}>Weekly Menu</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "#a0aec0", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Day</th>
                {MEALS.map(m => <th key={m} style={{ textAlign: "left", padding: "8px 12px", color: "#a0aec0", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day, i) => (
                <tr key={day} style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{day}</td>
                  {MEALS.map(meal => {
                    const entry = messmenu.find(m => m.day === day && m.meal === meal);
                    return <td key={meal} style={{ padding: "10px 12px", color: entry ? "white" : "#a0aec0" }}>{entry?.items || "-"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {isStudent && (
        <Card>
          <h3 style={{ fontFamily: "Syne", fontSize: 17, marginBottom: 14 }}>Rate Today's Meal</h3>
          <ErrMsg msg={err} /><SuccessMsg msg={suc} />
          <form onSubmit={submitFeedback}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12 }}>
              <div className="form-group">
                <label>Meal</label>
                <select value={fbForm.meal} onChange={e => setFbForm(p => ({ ...p, meal: e.target.value }))}>
                  {MEALS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Rating (1-5)</label>
                <select value={fbForm.rating} onChange={e => setFbForm(p => ({ ...p, rating: e.target.value }))}>
                  {[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Comment</label>
                <input value={fbForm.comment} placeholder="Great food / needs improvement..." onChange={e => setFbForm(p => ({ ...p, comment: e.target.value }))} />
              </div>
            </div>
            <button className="btn-primary" type="submit" disabled={fbSaving} style={{ marginTop: 8 }}>{fbSaving ? "Submitting..." : "Submit Feedback"}</button>
          </form>
        </Card>
      )}
    </div>
  );
}

// TAB: Notices
function NoticesTab({ notices, isStudent, isWarden, isAdmin, currentUser, userProfile, refresh }) {
  const [form, setForm] = useState({ title: "", content: "", priority: "normal" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(""); const [suc, setSuc] = useState("");

  async function postNotice(e) {
    e.preventDefault(); setErr(""); setSuc("");
    if (!form.title || !form.content) return setErr("Title and content required.");
    setSaving(true);
    try {
      await addDoc(collection(db, "hostel_notices"), {
        ...form, postedById: currentUser.uid, postedByName: userProfile.name,
        postedByRole: userProfile.role, createdAt: new Date().toISOString()
      });
      setSuc("Notice posted."); setForm({ title: "", content: "", priority: "normal" });
      refresh();
    } catch { setErr("Failed to post notice."); }
    setSaving(false);
  }

  async function deleteNotice(id) {
    try { await deleteDoc(doc(db, "hostel_notices", id)); refresh(); }
    catch { setErr("Failed to delete."); }
  }

  const priorityColor = { urgent: "#fc8181", important: "#f6ad55", normal: "#4299e1" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {(isWarden || isAdmin) && (
        <Card>
          <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 16 }}>Post Notice</h3>
          <ErrMsg msg={err} /><SuccessMsg msg={suc} />
          <form onSubmit={postNotice}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label>Title</label>
                <input value={form.title} placeholder="Notice title" onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Content</label>
              <textarea rows={4} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                placeholder="Notice content..."
                style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "white", fontSize: 15, resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Posting..." : "Post Notice"}</button>
          </form>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {notices.length === 0 ? (
          <Card><div style={{ textAlign: "center", padding: 40, color: "#a0aec0" }}>No notices yet.</div></Card>
        ) : notices.map(n => (
          <div key={n.id} style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.04)", borderLeft: `4px solid ${priorityColor[n.priority] || "#4299e1"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700 }}>{n.title}</span>
                  {n.priority !== "normal" && (
                    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${priorityColor[n.priority]}22`, color: priorityColor[n.priority], textTransform: "uppercase" }}>{n.priority}</span>
                  )}
                </div>
                <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.6 }}>{n.content}</div>
                <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 8 }}>
                  Posted by {n.postedByName} ({n.postedByRole}) - {fmtDT(n.createdAt)}
                </div>
              </div>
              {(isWarden || isAdmin) && (
                <button onClick={() => deleteNotice(n.id)} style={{ ...btnRed, alignSelf: "flex-start" }}>Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// TAB: Reports (Admin)
function ReportsTab({ allotments, fees, complaints, attendance, blocks }) {
  const active = allotments.filter(a => a.status === "active");
  const totalCapacity = blocks.reduce((s, b) => s + (Number(b.capacity) || 0), 0);
  const occupancyPct = totalCapacity ? Math.round((active.length / totalCapacity) * 100) : 0;
  const totalFeeAmt = fees.reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const paidAmt = fees.filter(f => f.status === "paid").reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const overdueAmt = fees.filter(f => f.status === "overdue").reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const resolvedComplaints = complaints.filter(c => c.status === "resolved" || c.status === "closed").length;
  const openComplaints = complaints.filter(c => c.status === "open").length;

  const blockOccupancy = blocks.map(b => ({
    name: b.blockName,
    active: active.filter(a => a.blockId === b.id).length,
    capacity: b.capacity || 0
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
        {[
          { label: "Total Residents", value: active.length, color: "#4299e1" },
          { label: "Occupancy", value: `${occupancyPct}%`, color: "#48bb78" },
          { label: "Total Fee Collected", value: `Rs.${paidAmt.toLocaleString()}`, color: "#48bb78" },
          { label: "Pending Fees", value: `Rs.${(totalFeeAmt - paidAmt).toLocaleString()}`, color: "#f6ad55" },
          { label: "Overdue Fees", value: `Rs.${overdueAmt.toLocaleString()}`, color: "#fc8181" },
          { label: "Open Complaints", value: openComplaints, color: "#fc8181" },
          { label: "Resolved Complaints", value: resolvedComplaints, color: "#48bb78" }
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "Syne" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ fontFamily: "Syne", fontSize: 17, margin: 0 }}>Block-wise Occupancy</h3>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => exportCSV(blockOccupancy.map(b => [b.name, b.active, b.capacity, b.capacity ? Math.round((b.active / b.capacity) * 100) + "%" : "-"]), ["Block", "Occupied", "Capacity", "Occupancy %"], "block_occupancy.csv")} style={btnGhost}>Export CSV</button>
          </div>
        </div>
        {blockOccupancy.length === 0 ? <div style={{ color: "#a0aec0", fontSize: 13 }}>No blocks configured.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {blockOccupancy.map(b => {
              const pct = b.capacity ? Math.round((b.active / b.capacity) * 100) : 0;
              return (
                <div key={b.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{b.name}</span>
                    <span style={{ color: "#a0aec0" }}>{b.active} / {b.capacity} ({pct}%)</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.1)" }}>
                    <div style={{ height: "100%", borderRadius: 4, width: `${Math.min(pct, 100)}%`, background: pct > 90 ? "#fc8181" : pct > 70 ? "#f6ad55" : "#48bb78", transition: "width 0.3s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <h3 style={{ fontFamily: "Syne", fontSize: 17, marginBottom: 16 }}>Export Data</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => exportCSV(allotments.map(a => [a.studentName, a.registerNo, a.dept, a.year, a.blockName, a.roomNo, a.roomType, a.status, fmtDate(a.allottedAt)]), ["Name", "Reg No", "Dept", "Year", "Block", "Room", "Type", "Status", "Allotted On"], "allotments.csv")} style={btnGhost}>Allotments CSV</button>
          <button onClick={() => exportCSV(fees.map(f => [f.studentName, f.registerNo, f.dept, f.semester, f.amount, f.status, fmtDate(f.dueDate), fmtDate(f.paidAt)]), ["Name", "Reg No", "Dept", "Semester", "Amount", "Status", "Due Date", "Paid On"], "fees.csv")} style={btnGhost}>Fees CSV</button>
          <button onClick={() => exportCSV(complaints.map(c => [c.studentName, c.registerNo, c.dept, c.category, c.description, c.status, fmtDT(c.createdAt), fmtDT(c.resolvedAt)]), ["Name", "Reg No", "Dept", "Category", "Description", "Status", "Raised", "Resolved"], "complaints.csv")} style={btnGhost}>Complaints CSV</button>
          <button onClick={() => exportCSV(attendance.map(a => [a.studentName, a.registerNo, a.dept, a.blockName, a.roomNo, a.date, a.present ? "Present" : "Absent"]), ["Name", "Reg No", "Dept", "Block", "Room", "Date", "Status"], "attendance.csv")} style={btnGhost}>Attendance CSV</button>
        </div>
      </Card>
    </div>
  );
}

// TAB: Complaints
function ComplaintsTab({ complaints, isStudent, currentUser, userProfile, refresh, myAllotment }) {
  const [form, setForm] = useState({ category: "Plumbing", description: "", roomNo: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(""); const [suc, setSuc] = useState("");
  const [actionState, setActionState] = useState({});
  const [filter, setFilter] = useState("all");

  const displayComplaints = filter === "all" ? complaints : complaints.filter(c => c.status === filter);

  async function submitComplaint(e) {
    e.preventDefault(); setErr(""); setSuc("");
    if (!form.description.trim()) return setErr("Description required.");
    setSaving(true);
    try {
      await addDoc(collection(db, "hostel_complaints"), {
        ...form, studentId: currentUser.uid, studentName: userProfile.name,
        registerNo: userProfile.registerNo || "", dept: userProfile.dept,
        blockName: myAllotment?.blockName || "", assignedBlock: myAllotment?.blockId || "",
        roomNo: myAllotment?.roomNo || form.roomNo,
        status: "open", createdAt: new Date().toISOString(), actionNote: ""
      });
      setSuc("Complaint submitted."); setForm({ category: "Plumbing", description: "", roomNo: "" });
      refresh();
    } catch { setErr("Failed to submit complaint."); }
    setSaving(false);
  }

  async function updateComplaint(id) {
    const a = actionState[id] || {};
    try {
      await updateDoc(doc(db, "hostel_complaints", id), {
        status: a.status, actionNote: a.note || "", resolvedAt: a.status === "resolved" ? new Date().toISOString() : "",
        resolvedByName: userProfile.name
      });
      refresh();
    } catch { setErr("Failed to update."); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {isStudent && (
        <Card>
          <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 16 }}>Raise Complaint</h3>
          <ErrMsg msg={err} /><SuccessMsg msg={suc} />
          <form onSubmit={submitComplaint}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {COMPLAINT_CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Room No (if different)</label>
                <input value={form.roomNo} placeholder={myAllotment?.roomNo || "Your room"} onChange={e => setForm(p => ({ ...p, roomNo: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Describe the issue in detail..."
                style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "white", fontSize: 15, resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Submitting..." : "Submit Complaint"}</button>
          </form>
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <h3 style={{ fontFamily: "Syne", fontSize: 17, margin: 0 }}>{isStudent ? "My Complaints" : "All Complaints"}</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["all", "open", "in_progress", "resolved", "closed"].map(s => (
              <button key={s} onClick={() => setFilter(s)} style={{ ...btnGhost, background: filter === s ? "rgba(233,69,96,0.2)" : "rgba(255,255,255,0.05)", color: filter === s ? "#e94560" : "white", fontSize: 12 }}>
                {s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {displayComplaints.length === 0 ? <div style={{ color: "#a0aec0", fontSize: 13 }}>No complaints found.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {displayComplaints.map(c => {
              const a = actionState[c.id] || { status: c.status, note: c.actionNote || "" };
              return (
                <div key={c.id} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      {!isStudent && <div style={{ fontWeight: 600 }}>{c.studentName} {c.registerNo ? `- ${c.registerNo}` : ""}</div>}
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginTop: isStudent ? 0 : 4 }}>
                        [{c.category}] {c.description}
                      </div>
                      <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>
                        {c.blockName} {c.roomNo ? `- Room ${c.roomNo}` : ""} | {fmtDT(c.createdAt)}
                      </div>
                      {c.actionNote && <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>Note: {c.actionNote}</div>}
                      {c.resolvedAt && <div style={{ fontSize: 12, color: "#48bb78", marginTop: 4 }}>Resolved: {fmtDT(c.resolvedAt)} by {c.resolvedByName}</div>}
                    </div>
                    <Badge value={c.status} options={COMPLAINT_STATUS} />
                  </div>
                  {!isStudent && (
                    <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                      <select value={a.status} onChange={e => setActionState(p => ({ ...p, [c.id]: { ...p[c.id], status: e.target.value } }))} style={{ minWidth: 150 }}>
                        {COMPLAINT_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                      <input placeholder="Resolution note" value={a.note} onChange={e => setActionState(p => ({ ...p, [c.id]: { ...p[c.id], note: e.target.value } }))} style={{ flex: 1, minWidth: 180 }} />
                      <button onClick={() => updateComplaint(c.id)} style={btnPrimary}>Update</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// TAB: Gate Pass
function GatePassTab({ gatepasses, isStudent, currentUser, userProfile, refresh, myAllotment }) {
  const [form, setForm] = useState({ reason: "", destination: "", fromDate: "", toDate: "", returnDate: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(""); const [suc, setSuc] = useState("");

  async function submitPass(e) {
    e.preventDefault(); setErr(""); setSuc("");
    if (!form.reason || !form.fromDate) return setErr("Reason and from date required.");
    setSaving(true);
    try {
      await addDoc(collection(db, "hostel_gatepasses"), {
        ...form, studentId: currentUser.uid, studentName: userProfile.name,
        registerNo: userProfile.registerNo || "", dept: userProfile.dept,
        blockId: myAllotment?.blockId || "", blockName: myAllotment?.blockName || "",
        roomNo: myAllotment?.roomNo || "", status: "pending",
        requestedAt: new Date().toISOString()
      });
      setSuc("Gate pass requested."); setForm({ reason: "", destination: "", fromDate: "", toDate: "", returnDate: "" });
      refresh();
    } catch { setErr("Failed to submit."); }
    setSaving(false);
  }

  async function updatePass(id, status, note = "") {
    try {
      await updateDoc(doc(db, "hostel_gatepasses", id), {
        status, actionNote: note, actionByName: userProfile.name, actionAt: new Date().toISOString()
      });
      refresh();
    } catch { setErr("Failed to update."); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {isStudent && (
        <Card>
          <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 16 }}>Request Gate Pass</h3>
          <ErrMsg msg={err} /><SuccessMsg msg={suc} />
          <form onSubmit={submitPass}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Reason</label>
                <input value={form.reason} placeholder="Home visit, medical, etc." onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Destination</label>
                <input value={form.destination} placeholder="City / place" onChange={e => setForm(p => ({ ...p, destination: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>From Date</label>
                <input type="date" value={form.fromDate} onChange={e => setForm(p => ({ ...p, fromDate: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>To Date</label>
                <input type="date" value={form.toDate} onChange={e => setForm(p => ({ ...p, toDate: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Expected Return</label>
                <input type="date" value={form.returnDate} onChange={e => setForm(p => ({ ...p, returnDate: e.target.value }))} />
              </div>
            </div>
            <button className="btn-primary" type="submit" disabled={saving} style={{ marginTop: 8 }}>{saving ? "Requesting..." : "Request Pass"}</button>
          </form>
        </Card>
      )}

      <Card>
        <h3 style={{ fontFamily: "Syne", fontSize: 17, marginBottom: 14 }}>{isStudent ? "My Gate Passes" : "Gate Pass Requests"}</h3>
        {gatepasses.length === 0 ? <div style={{ color: "#a0aec0", fontSize: 13 }}>No gate passes found.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {gatepasses.map(g => (
              <div key={g.id} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    {!isStudent && <div style={{ fontWeight: 600 }}>{g.studentName} {g.registerNo ? `- ${g.registerNo}` : ""} <span style={{ color: "#a0aec0", fontWeight: 400, fontSize: 13 }}>({g.blockName} - {g.roomNo})</span></div>}
                    <div style={{ fontSize: 14, marginTop: isStudent ? 0 : 4 }}>{g.reason} {g.destination ? `-> ${g.destination}` : ""}</div>
                    <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>
                      {fmtDate(g.fromDate)} to {fmtDate(g.toDate)} | Return: {fmtDate(g.returnDate)}
                    </div>
                    <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 2 }}>Requested: {fmtDT(g.requestedAt)}</div>
                    {g.actionNote && <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>Note: {g.actionNote}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    <Badge value={g.status} options={GATEPASS_STATUS} />
                    {!isStudent && g.status === "pending" && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => updatePass(g.id, "approved")} style={btnGreen}>Approve</button>
                        <button onClick={() => updatePass(g.id, "rejected", "Not approved")} style={btnRed}>Reject</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// TAB: Visitors
function VisitorsTab({ visitors, isStudent, currentUser, userProfile, refresh }) {
  const [form, setForm] = useState({ visitorName: "", relation: "", phone: "", studentName: "", studentRegNo: "", blockName: "", roomNo: "", purpose: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(""); const [suc, setSuc] = useState("");

  const myVisitors = visitors.filter(v => v.studentId === currentUser?.uid);
  const displayVisitors = isStudent ? myVisitors : visitors;

  async function logVisitor(e) {
    e.preventDefault(); setErr(""); setSuc("");
    if (!form.visitorName || !form.studentRegNo) return setErr("Visitor name and student reg no required.");
    setSaving(true);
    try {
      await addDoc(collection(db, "hostel_visitors"), {
        ...form, loggedById: currentUser.uid, loggedByName: userProfile.name,
        visitedAt: new Date().toISOString(), exitedAt: ""
      });
      setSuc("Visitor logged."); setForm({ visitorName: "", relation: "", phone: "", studentName: "", studentRegNo: "", blockName: "", roomNo: "", purpose: "" });
      refresh();
    } catch { setErr("Failed to log visitor."); }
    setSaving(false);
  }

  async function logExit(id) {
    try { await updateDoc(doc(db, "hostel_visitors", id), { exitedAt: new Date().toISOString() }); refresh(); }
    catch { setErr("Failed to log exit."); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {!isStudent && (
        <Card>
          <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 16 }}>Log Visitor Entry</h3>
          <ErrMsg msg={err} /><SuccessMsg msg={suc} />
          <form onSubmit={logVisitor}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {[["Visitor Name", "visitorName", "Full name"], ["Relation", "relation", "Parent/Friend"], ["Phone", "phone", "9876543210"], ["Student Name", "studentName", "Student name"], ["Student Reg No", "studentRegNo", "22CS001"], ["Block", "blockName", "A Block"], ["Room No", "roomNo", "101"], ["Purpose", "purpose", "Weekend visit"]].map(([l, n, p]) => (
                <div className="form-group" key={n}>
                  <label>{l}</label>
                  <input value={form[n]} placeholder={p} onChange={e => setForm(prev => ({ ...prev, [n]: e.target.value }))} />
                </div>
              ))}
            </div>
            <button className="btn-primary" type="submit" disabled={saving} style={{ marginTop: 8 }}>{saving ? "Logging..." : "Log Entry"}</button>
          </form>
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ fontFamily: "Syne", fontSize: 17, margin: 0 }}>{isStudent ? "My Visitors" : "Visitor Log"}</h3>
          {!isStudent && <button onClick={() => exportCSV(visitors.map(v => [v.visitorName, v.relation, v.phone, v.studentName, v.studentRegNo, v.blockName, v.roomNo, v.purpose, fmtDT(v.visitedAt), fmtDT(v.exitedAt)]), ["Visitor", "Relation", "Phone", "Student", "Reg No", "Block", "Room", "Purpose", "Entry", "Exit"], "visitors.csv")} style={btnGhost}>Export CSV</button>}
        </div>
        {displayVisitors.length === 0 ? <div style={{ color: "#a0aec0", fontSize: 13 }}>No visitor records.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {displayVisitors.map(v => (
              <div key={v.id} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{v.visitorName} <span style={{ color: "#a0aec0", fontWeight: 400, fontSize: 13 }}>({v.relation})</span></div>
                    <div style={{ fontSize: 13, color: "#a0aec0", marginTop: 4 }}>
                      Visiting: {v.studentName} - {v.studentRegNo} | {v.blockName} Room {v.roomNo}
                    </div>
                    <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>
                      Purpose: {v.purpose} | Phone: {v.phone}
                    </div>
                    <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>
                      Entry: {fmtDT(v.visitedAt)} {v.exitedAt ? `| Exit: ${fmtDT(v.exitedAt)}` : ""}
                    </div>
                  </div>
                  {!isStudent && !v.exitedAt && (
                    <button onClick={() => logExit(v.id)} style={btnGhost}>Log Exit</button>
                  )}
                  {!v.exitedAt && (
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: "rgba(72,187,120,0.2)", color: "#48bb78" }}>Inside</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// TAB: Allotment
function AllotmentTab({ blocks, allotments, isAdmin, isWarden, isStudent, currentUser, userProfile, refresh, myAllotment }) {
  const [form, setForm] = useState({ studentName: "", studentId: "", registerNo: "", dept: "", year: "", blockId: "", roomNo: "", floor: "", roomType: "Double", validTill: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(""); const [suc, setSuc] = useState("");
  const [reqErr, setReqErr] = useState(""); const [reqSuc, setReqSuc] = useState("");
  const [reqForm, setReqForm] = useState({ preferredBlock: "", roomType: "Double", reason: "" });
  const [reqSaving, setReqSaving] = useState(false);
  const [search, setSearch] = useState("");

  const blockMap = Object.fromEntries(blocks.map(b => [b.id, b]));

  const filtered = allotments.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.studentName?.toLowerCase().includes(q) || a.registerNo?.toLowerCase().includes(q) || a.roomNo?.toLowerCase().includes(q);
  });

  async function handleAllot(e) {
    e.preventDefault(); setErr(""); setSuc("");
    if (!form.studentName || !form.blockId || !form.roomNo) return setErr("Name, block and room are required.");
    const block = blockMap[form.blockId];
    setSaving(true);
    try {
      await addDoc(collection(db, "hostel_allotments"), {
        ...form, blockName: block?.blockName || "",
        status: "active", allottedAt: new Date().toISOString(),
        allottedById: currentUser.uid, allottedByName: userProfile.name
      });
      setSuc("Room allotted successfully.");
      setForm({ studentName: "", studentId: "", registerNo: "", dept: "", year: "", blockId: "", roomNo: "", floor: "", roomType: "Double", validTill: "" });
      refresh();
    } catch { setErr("Failed to allot room."); }
    setSaving(false);
  }

  async function vacate(id) {
    try { await updateDoc(doc(db, "hostel_allotments", id), { status: "vacated", vacatedAt: new Date().toISOString() }); refresh(); }
    catch { setErr("Failed to vacate."); }
  }

  async function submitRequest(e) {
    e.preventDefault(); setReqErr(""); setReqSuc("");
    if (!reqForm.roomType) return setReqErr("Room type required.");
    setReqSaving(true);
    try {
      await addDoc(collection(db, "hostel_allotments"), {
        studentId: currentUser.uid, studentName: userProfile.name,
        registerNo: userProfile.registerNo || "", dept: userProfile.dept,
        year: userProfile.year || "", preferredBlock: reqForm.preferredBlock,
        roomType: reqForm.roomType, reason: reqForm.reason,
        status: "requested", requestedAt: new Date().toISOString()
      });
      setReqSuc("Allotment request submitted."); setReqForm({ preferredBlock: "", roomType: "Double", reason: "" });
      refresh();
    } catch { setReqErr("Failed to submit request."); }
    setReqSaving(false);
  }

  if (isStudent) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {myAllotment ? <MyRoomTab allotment={myAllotment} block={blocks.find(b => b.id === myAllotment.blockId)} /> : (
        <Card>
          <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 16 }}>Request Room Allotment</h3>
          <ErrMsg msg={reqErr} /><SuccessMsg msg={reqSuc} />
          <form onSubmit={submitRequest}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label>Preferred Block</label>
                <select value={reqForm.preferredBlock} onChange={e => setReqForm(p => ({ ...p, preferredBlock: e.target.value }))}>
                  <option value="">Any block</option>
                  {blocks.map(b => <option key={b.id} value={b.id}>{b.blockName}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Room Type</label>
                <select value={reqForm.roomType} onChange={e => setReqForm(p => ({ ...p, roomType: e.target.value }))}>
                  {ROOM_TYPES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Reason / Special requirements</label>
              <textarea rows={3} value={reqForm.reason} onChange={e => setReqForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Medical needs, study group, etc."
                style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "white", fontSize: 15, resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <button className="btn-primary" type="submit" disabled={reqSaving}>{reqSaving ? "Submitting..." : "Submit Request"}</button>
          </form>
        </Card>
      )}

      {allotments.filter(a => a.studentId === currentUser?.uid).map(a => (
        <Card key={a.id}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{a.blockName || blockMap[a.blockId]?.blockName || "Any block"} {a.roomNo ? `- Room ${a.roomNo}` : ""}</div>
              <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>
                {a.roomType} | {a.status === "requested" ? `Requested on ${fmtDate(a.requestedAt)}` : `Allotted on ${fmtDate(a.allottedAt)}`}
              </div>
            </div>
            <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: a.status === "active" ? "rgba(72,187,120,0.2)" : "rgba(160,174,192,0.2)", color: a.status === "active" ? "#48bb78" : "#a0aec0" }}>
              {a.status}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 16 }}>Allot Room</h3>
        <ErrMsg msg={err} /><SuccessMsg msg={suc} />
        <form onSubmit={handleAllot}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {[
              ["Student Name", "studentName", "Full name"],
              ["Student ID (uid)", "studentId", "Firebase UID"],
              ["Register No", "registerNo", "22CS001"],
              ["Department", "dept", "CSE"],
              ["Year", "year", "2nd Year"],
              ["Room No", "roomNo", "101"],
              ["Floor", "floor", "1"]
            ].map(([l, n, p]) => (
              <div className="form-group" key={n}>
                <label>{l}</label>
                <input value={form[n]} placeholder={p} onChange={e => setForm(prev => ({ ...prev, [n]: e.target.value }))} />
              </div>
            ))}
            <div className="form-group">
              <label>Block</label>
              <select value={form.blockId} onChange={e => setForm(p => ({ ...p, blockId: e.target.value }))}>
                <option value="">Select block</option>
                {blocks.map(b => <option key={b.id} value={b.id}>{b.blockName}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Room Type</label>
              <select value={form.roomType} onChange={e => setForm(p => ({ ...p, roomType: e.target.value }))}>
                {ROOM_TYPES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Valid Till</label>
              <input type="date" value={form.validTill} onChange={e => setForm(p => ({ ...p, validTill: e.target.value }))} />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={saving} style={{ marginTop: 8 }}>{saving ? "Allotting..." : "Allot Room"}</button>
        </form>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ fontFamily: "Syne", fontSize: 17, margin: 0 }}>All Allotments</h3>
          <div style={{ display: "flex", gap: 10 }}>
            <input placeholder="Search student / room" value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth: 200 }} />
            <button onClick={() => exportCSV(allotments.map(a => [a.studentName, a.registerNo, a.dept, a.year, a.blockName, a.roomNo, a.roomType, a.status, fmtDate(a.allottedAt)]),
              ["Name", "Reg No", "Dept", "Year", "Block", "Room", "Type", "Status", "Allotted On"], "allotments.csv")} style={btnGhost}>Export CSV</button>
          </div>
        </div>
        {filtered.length === 0 ? <div style={{ color: "#a0aec0", fontSize: 13 }}>No allotments found.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(a => (
              <div key={a.id} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.studentName} {a.registerNo ? `- ${a.registerNo}` : ""}</div>
                    <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 3 }}>
                      {a.dept} | {a.year} | {a.blockName} - Room {a.roomNo} ({a.roomType})
                    </div>
                    <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 2 }}>
                      {a.status === "requested" ? `Requested: ${fmtDate(a.requestedAt)}` : `Allotted: ${fmtDate(a.allottedAt)}`}
                      {a.validTill ? ` | Valid till: ${fmtDate(a.validTill)}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: a.status === "active" ? "rgba(72,187,120,0.2)" : a.status === "requested" ? "rgba(246,173,85,0.2)" : "rgba(160,174,192,0.2)", color: a.status === "active" ? "#48bb78" : a.status === "requested" ? "#f6ad55" : "#a0aec0" }}>{a.status}</span>
                    {a.status === "active" && <button onClick={() => vacate(a.id)} style={btnRed}>Vacate</button>}
                    {a.status === "requested" && <button onClick={async () => { await updateDoc(doc(db, "hostel_allotments", a.id), { status: "active", allottedAt: new Date().toISOString(), allottedById: currentUser.uid }); refresh(); }} style={btnGreen}>Approve</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// TAB: Fees
function FeesTab({ fees, isStudent, currentUser, refresh }) {
  const [form, setForm] = useState({ studentName: "", studentId: "", registerNo: "", dept: "", amount: "", semester: "", dueDate: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(""); const [suc, setSuc] = useState("");
  const [filter, setFilter] = useState("all");

  const myFees = fees.filter(f => f.studentId === currentUser?.uid);
  const displayFees = isStudent ? myFees : fees;
  const filtered = filter === "all" ? displayFees : displayFees.filter(f => f.status === filter);

  async function addFee(e) {
    e.preventDefault(); setErr(""); setSuc("");
    if (!form.studentName || !form.amount) return setErr("Student name and amount required.");
    setSaving(true);
    try {
      await addDoc(collection(db, "hostel_fees"), {
        ...form, amount: Number(form.amount), status: "pending",
        createdAt: new Date().toISOString(), createdById: currentUser.uid
      });
      setSuc("Fee record added."); setForm({ studentName: "", studentId: "", registerNo: "", dept: "", amount: "", semester: "", dueDate: "", description: "" });
      refresh();
    } catch { setErr("Failed to add fee record."); }
    setSaving(false);
  }

  async function markPaid(id) {
    try { await updateDoc(doc(db, "hostel_fees", id), { status: "paid", paidAt: new Date().toISOString() }); refresh(); }
    catch { setErr("Failed to update."); }
  }

  async function markOverdue(id) {
    try { await updateDoc(doc(db, "hostel_fees", id), { status: "overdue" }); refresh(); }
    catch { setErr("Failed to update."); }
  }

  const totalDue = displayFees.filter(f => f.status !== "paid").reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const totalPaid = displayFees.filter(f => f.status === "paid").reduce((s, f) => s + (Number(f.amount) || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div className="card" style={{ flex: 1, minWidth: 150, padding: "16px 20px" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#48bb78", fontFamily: "Syne" }}>Rs.{totalPaid.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>Total Paid</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 150, padding: "16px 20px" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fc8181", fontFamily: "Syne" }}>Rs.{totalDue.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>Total Pending</div>
        </div>
      </div>

      {!isStudent && (
        <Card>
          <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 16 }}>Add Fee Record</h3>
          <ErrMsg msg={err} /><SuccessMsg msg={suc} />
          <form onSubmit={addFee}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {[["Student Name", "studentName", "text", "Full name"], ["Register No", "registerNo", "text", "22CS001"], ["Dept", "dept", "text", "CSE"], ["Amount (Rs.)", "amount", "number", "5000"], ["Semester", "semester", "text", "Sem 3 2025"], ["Description", "description", "text", "Hostel fee"]].map(([l, n, t, p]) => (
                <div className="form-group" key={n}>
                  <label>{l}</label>
                  <input type={t} value={form[n]} placeholder={p} onChange={e => setForm(prev => ({ ...prev, [n]: e.target.value }))} />
                </div>
              ))}
              <div className="form-group">
                <label>Due Date</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
              </div>
            </div>
            <button className="btn-primary" type="submit" disabled={saving} style={{ marginTop: 8 }}>{saving ? "Saving..." : "Add Record"}</button>
          </form>
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ fontFamily: "Syne", fontSize: 17, margin: 0 }}>{isStudent ? "My Fee Records" : "All Fee Records"}</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {["all", "pending", "paid", "overdue"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ ...btnGhost, background: filter === f ? "rgba(233,69,96,0.2)" : "rgba(255,255,255,0.05)", color: filter === f ? "#e94560" : "white" }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            {!isStudent && <button onClick={() => exportCSV(displayFees.map(f => [f.studentName, f.registerNo, f.dept, f.semester, f.amount, f.status, fmtDate(f.dueDate), fmtDate(f.paidAt)]), ["Name", "Reg No", "Dept", "Semester", "Amount", "Status", "Due Date", "Paid On"], "fees.csv")} style={btnGhost}>Export CSV</button>}
          </div>
        </div>
        {filtered.length === 0 ? <div style={{ color: "#a0aec0", fontSize: 13 }}>No records found.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(f => (
              <div key={f.id} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    {!isStudent && <div style={{ fontWeight: 600 }}>{f.studentName} {f.registerNo ? `- ${f.registerNo}` : ""} <span style={{ color: "#a0aec0", fontWeight: 400, fontSize: 13 }}>({f.dept})</span></div>}
                    <div style={{ fontSize: 14, marginTop: isStudent ? 0 : 4 }}>
                      <span style={{ fontWeight: 700, color: "#48bb78" }}>Rs.{Number(f.amount).toLocaleString()}</span>
                      {f.semester ? ` - ${f.semester}` : ""}
                      {f.description ? ` | ${f.description}` : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>
                      Due: {fmtDate(f.dueDate)}{f.paidAt ? ` | Paid on: ${fmtDate(f.paidAt)}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <Badge value={f.status} options={FEE_STATUS} />
                    {!isStudent && f.status === "pending" && <>
                      <button onClick={() => markPaid(f.id)} style={btnGreen}>Mark Paid</button>
                      <button onClick={() => markOverdue(f.id)} style={btnRed}>Mark Overdue</button>
                    </>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
function fmtDT(v) {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d) ? v : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
function exportCSV(rows, headers, filename) {
  const csv = [headers, ...rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`))].map(r => r.join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
}

// UI primitives
function Badge({ value, options }) {
  const meta = options.find(o => o.value === value) || options[0];
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
      background: `${meta.color}22`, color: meta.color
    }}>{meta.label}</span>
  );
}
function Card({ children, style }) {
  return <div className="card" style={style}>{children}</div>;
}
function ErrMsg({ msg }) {
  return msg ? <div className="error-msg">{msg}</div> : null;
}
function SuccessMsg({ msg }) {
  return msg ? (
    <div style={{
      background: "rgba(72,187,120,0.1)", border: "1px solid rgba(72,187,120,0.3)",
      borderRadius: 10, padding: "12px 16px", color: "#48bb78", fontSize: 14, marginBottom: 16
    }}>{msg}</div>
  ) : null;
}
const btnPrimary = {
  padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(233,69,96,0.4)",
  background: "rgba(233,69,96,0.2)", color: "#e94560", cursor: "pointer", fontWeight: 600, fontSize: 14
};
const btnGhost = {
  padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.05)", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 600
};
const btnGreen = {
  padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(72,187,120,0.4)",
  background: "rgba(72,187,120,0.15)", color: "#48bb78", cursor: "pointer", fontSize: 13, fontWeight: 600
};
const btnRed = {
  padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(252,129,129,0.4)",
  background: "rgba(252,129,129,0.15)", color: "#fc8181", cursor: "pointer", fontSize: 13, fontWeight: 600
};

// Tabs definition
const STUDENT_TABS = [
  { key: "myroom", label: "My Room" },
  { key: "fees", label: "Fees" },
  { key: "complaints", label: "Complaints" },
  { key: "gatepass", label: "Gate Pass" },
  { key: "visitors", label: "Visitors" },
  { key: "mess", label: "Mess Menu" },
  { key: "notices", label: "Notices" }
];
const WARDEN_TABS = [
  { key: "allotment", label: "Allotment" },
  { key: "fees", label: "Fees" },
  { key: "complaints", label: "Complaints" },
  { key: "gatepass", label: "Gate Pass" },
  { key: "visitors", label: "Visitors" },
  { key: "attendance", label: "Attendance" },
  { key: "mess", label: "Mess Menu" },
  { key: "notices", label: "Notices" }
];
const ADMIN_TABS = [
  { key: "setup", label: "Block & Room Setup" },
  { key: "allotment", label: "Allotment" },
  { key: "fees", label: "Fees" },
  { key: "complaints", label: "Complaints" },
  { key: "gatepass", label: "Gate Pass" },
  { key: "reports", label: "Reports" },
  { key: "notices", label: "Notices" }
];

export default function HostelPage() {
  const { currentUser, userProfile } = useAuth();
  const role = userProfile?.role;
  const isStudent = role === "student";
  const isWarden = role === "staff";
  const isAdmin = role === "hod";

  const tabs = isStudent ? STUDENT_TABS : isWarden ? WARDEN_TABS : ADMIN_TABS;
  const [tab, setTab] = useState(tabs[0].key);

  const [blocks, setBlocks] = useState([]);
  const [allotments, setAllotments] = useState([]);
  const [fees, setFees] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [gatepasses, setGatepasses] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [messmenu, setMessmenu] = useState([]);
  const [notices, setNotices] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [globalErr, setGlobalErr] = useState("");

  useEffect(() => { if (userProfile && currentUser) fetchAll(); }, [userProfile, currentUser]);

  async function fetchAll() {
    setFetching(true); setGlobalErr("");
    try {
      const [bSnap, alSnap, fSnap, cSnap, gpSnap, vSnap, attSnap, mSnap, nSnap] = await Promise.all([
        getDocs(collection(db, "hostel_blocks")),
        getDocs(collection(db, "hostel_allotments")),
        getDocs(isStudent
          ? query(collection(db, "hostel_fees"), where("studentId", "==", currentUser.uid))
          : isWarden
            ? query(collection(db, "hostel_fees"), where("dept", "==", userProfile.dept))
            : collection(db, "hostel_fees")),
        getDocs(isStudent
          ? query(collection(db, "hostel_complaints"), where("studentId", "==", currentUser.uid))
          : isWarden
            ? query(collection(db, "hostel_complaints"), where("assignedBlock", "==", userProfile.blockAssigned || "__none__"))
            : collection(db, "hostel_complaints")),
        getDocs(isStudent
          ? query(collection(db, "hostel_gatepasses"), where("studentId", "==", currentUser.uid))
          : isWarden
            ? query(collection(db, "hostel_gatepasses"), where("blockId", "==", userProfile.blockAssigned || "__none__"))
            : collection(db, "hostel_gatepasses")),
        getDocs(isStudent
          ? query(collection(db, "hostel_visitors"), where("studentId", "==", currentUser.uid))
          : collection(db, "hostel_visitors")),
        getDocs(isStudent
          ? query(collection(db, "hostel_attendance"), where("studentId", "==", currentUser.uid))
          : collection(db, "hostel_attendance")),
        getDocs(collection(db, "hostel_mess")),
        getDocs(collection(db, "hostel_notices"))
      ]);
      const s = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBlocks(s(bSnap).sort((a, b) => a.blockName?.localeCompare(b.blockName)));
      setAllotments(s(alSnap).sort((a, b) => new Date(b.allottedAt) - new Date(a.allottedAt)));
      setFees(s(fSnap).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setComplaints(s(cSnap).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setGatepasses(s(gpSnap).sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)));
      setVisitors(s(vSnap).sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt)));
      setAttendance(s(attSnap).sort((a, b) => new Date(b.date) - new Date(a.date)));
      setMessmenu(s(mSnap));
      setNotices(s(nSnap).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (e) {
      setGlobalErr("Failed to load hostel data. Please try again.");
    }
    setFetching(false);
  }

  const myAllotment = useMemo(() => allotments.find(a => a.studentId === currentUser?.uid && a.status === "active"), [allotments, currentUser]);
  const myBlock = useMemo(() => blocks.find(b => b.id === myAllotment?.blockId), [blocks, myAllotment]);

  function renderTab() {
    if (fetching) return <div style={{ textAlign: "center", padding: 60 }}><div className="spinner" style={{ margin: "0 auto" }} /></div>;
    switch (tab) {
      case "myroom": return <MyRoomTab allotment={myAllotment} block={myBlock} />;
      case "setup": return <BlockSetupTab blocks={blocks} refresh={fetchAll} currentUser={currentUser} />;
      case "allotment": return <AllotmentTab blocks={blocks} allotments={allotments} isAdmin={isAdmin} isWarden={isWarden} isStudent={isStudent} currentUser={currentUser} userProfile={userProfile} refresh={fetchAll} myAllotment={myAllotment} />;
      case "fees": return <FeesTab fees={fees} isStudent={isStudent} currentUser={currentUser} refresh={fetchAll} />;
      case "complaints": return <ComplaintsTab complaints={complaints} isStudent={isStudent} currentUser={currentUser} userProfile={userProfile} refresh={fetchAll} myAllotment={myAllotment} />;
      case "gatepass": return <GatePassTab gatepasses={gatepasses} isStudent={isStudent} currentUser={currentUser} userProfile={userProfile} refresh={fetchAll} myAllotment={myAllotment} />;
      case "visitors": return <VisitorsTab visitors={visitors} isStudent={isStudent} currentUser={currentUser} userProfile={userProfile} refresh={fetchAll} allotments={allotments} />;
      case "attendance": return <AttendanceTab attendance={attendance} allotments={allotments} currentUser={currentUser} userProfile={userProfile} refresh={fetchAll} />;
      case "mess": return <MessTab messmenu={messmenu} isStudent={isStudent} currentUser={currentUser} userProfile={userProfile} refresh={fetchAll} />;
      case "notices": return <NoticesTab notices={notices} isStudent={isStudent} isWarden={isWarden} isAdmin={isAdmin} currentUser={currentUser} userProfile={userProfile} refresh={fetchAll} />;
      case "reports": return <ReportsTab allotments={allotments} fees={fees} complaints={complaints} attendance={attendance} blocks={blocks} />;
      default: return null;
    }
  }

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Hostel Management</h1>
          <p>Manage rooms, fees, complaints and more</p>
        </div>

        {isStudent && (
          <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            {[
              { label: "My Room", value: myAllotment ? `${myAllotment.blockName} - ${myAllotment.roomNo}` : "Not allotted", color: "#4299e1" },
              { label: "Pending Fees", value: fees.filter(f => f.status === "pending" || f.status === "overdue").length, color: "#f6ad55" },
              { label: "Open Complaints", value: complaints.filter(c => c.status === "open" || c.status === "in_progress").length, color: "#fc8181" },
              { label: "Gate Passes", value: gatepasses.filter(g => g.status === "approved").length, color: "#48bb78" }
            ].map(s => (
              <div key={s.label} className="card" style={{ flex: 1, minWidth: 150, padding: "16px 20px" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: "Syne" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {!isStudent && (
          <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            {[
              { label: "Total Rooms", value: blocks.reduce((s, b) => s + (b.totalRooms || 0), 0), color: "#4299e1" },
              { label: "Occupied", value: allotments.filter(a => a.status === "active").length, color: "#48bb78" },
              { label: "Pending Fees", value: fees.filter(f => f.status === "pending" || f.status === "overdue").length, color: "#f6ad55" },
              { label: "Open Complaints", value: complaints.filter(c => c.status === "open").length, color: "#fc8181" }
            ].map(s => (
              <div key={s.label} className="card" style={{ flex: 1, minWidth: 140, padding: "16px 20px" }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: s.color, fontFamily: "Syne" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {globalErr && <ErrMsg msg={globalErr} />}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "9px 18px", borderRadius: 10, border: "none", cursor: "pointer",
              fontFamily: "Syne", fontWeight: 600, fontSize: 13,
              background: tab === t.key ? "#e94560" : "rgba(255,255,255,0.07)", color: "white"
            }}>{t.label}</button>
          ))}
        </div>

        {renderTab()}
      </main>
    </div>
  );
}

// TAB: My Room (Student)
function MyRoomTab({ allotment, block }) {
  if (!allotment) return (
    <Card>
      <div style={{ textAlign: "center", padding: 60 }}>
        <div style={{ fontSize: 16, marginBottom: 8 }}>No room allotted yet</div>
        <p style={{ color: "#a0aec0" }}>Contact your warden or raise an allotment request.</p>
      </div>
    </Card>
  );
  return (
    <Card>
      <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 20 }}>My Room Details</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
        {[
          ["Block", allotment.blockName],
          ["Room No", allotment.roomNo],
          ["Room Type", allotment.roomType],
          ["Floor", allotment.floor || "-"],
          ["Allotted On", fmtDate(allotment.allottedAt)],
          ["Valid Till", fmtDate(allotment.validTill)],
          ["Warden", block?.wardenName || "-"],
          ["Block Address", block?.address || "-"]
        ].map(([k, v]) => (
          <div key={k} style={{ padding: "14px 16px", background: "rgba(255,255,255,0.05)", borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>{k}</div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{v}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// TAB: Block & Room Setup (Admin)
function BlockSetupTab({ blocks, refresh, currentUser }) {
  const [form, setForm] = useState({ blockName: "", address: "", totalRooms: "", capacity: "", wardenName: "", wardenEmail: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(""); const [suc, setSuc] = useState("");
  const [editId, setEditId] = useState(null); const [editForm, setEditForm] = useState({});

  async function handleAdd(e) {
    e.preventDefault(); setErr(""); setSuc("");
    if (!form.blockName.trim()) return setErr("Block name required.");
    setSaving(true);
    try {
      await addDoc(collection(db, "hostel_blocks"), {
        ...form, totalRooms: Number(form.totalRooms) || 0,
        capacity: Number(form.capacity) || 0,
        createdAt: new Date().toISOString(), createdById: currentUser.uid
      });
      setSuc("Block added."); setForm({ blockName: "", address: "", totalRooms: "", capacity: "", wardenName: "", wardenEmail: "" });
      refresh();
    } catch { setErr("Failed to add block."); }
    setSaving(false);
  }

  async function handleEdit(e) {
    e.preventDefault(); setErr("");
    try {
      await updateDoc(doc(db, "hostel_blocks", editId), {
        ...editForm, totalRooms: Number(editForm.totalRooms) || 0, capacity: Number(editForm.capacity) || 0
      });
      setEditId(null); refresh();
    } catch { setErr("Failed to update."); }
  }

  async function handleDelete(id) {
    try { await deleteDoc(doc(db, "hostel_blocks", id)); refresh(); }
    catch { setErr("Failed to delete."); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 16 }}>Add Block</h3>
        <ErrMsg msg={err} /><SuccessMsg msg={suc} />
        <form onSubmit={handleAdd}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {[
              ["Block Name", "blockName", form.blockName, "A Block"],
              ["Address", "address", form.address, "North Campus"],
              ["Total Rooms", "totalRooms", form.totalRooms, "50"],
              ["Capacity (students)", "capacity", form.capacity, "100"],
              ["Warden Name", "wardenName", form.wardenName, "Mr. Kumar"],
              ["Warden Email", "wardenEmail", form.wardenEmail, "warden@college.edu"]
            ].map(([l, n, v, p]) => (
              <div className="form-group" key={n}>
                <label>{l}</label>
                <input name={n} value={v} placeholder={p}
                  onChange={e => setForm(prev => ({ ...prev, [n]: e.target.value }))} />
              </div>
            ))}
          </div>
          <button className="btn-primary" type="submit" disabled={saving} style={{ marginTop: 8 }}>
            {saving ? "Saving..." : "Add Block"}
          </button>
        </form>
      </Card>

      {blocks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {blocks.map(b => (
            <Card key={b.id}>
              {editId === b.id ? (
                <form onSubmit={handleEdit}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                    {["blockName", "address", "totalRooms", "capacity", "wardenName", "wardenEmail"].map(n => (
                      <div className="form-group" key={n}>
                        <label style={{ textTransform: "capitalize" }}>{n.replace(/([A-Z])/g, " $1")}</label>
                        <input value={editForm[n] || ""} onChange={e => setEditForm(p => ({ ...p, [n]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                    <button type="submit" style={btnPrimary}>Save</button>
                    <button type="button" onClick={() => setEditId(null)} style={btnGhost}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: "Syne", fontSize: 17, fontWeight: 700 }}>{b.blockName}</div>
                    <div style={{ color: "#a0aec0", fontSize: 13, marginTop: 4 }}>{b.address}</div>
                    <div style={{ color: "#a0aec0", fontSize: 12, marginTop: 4 }}>
                      Rooms: {b.totalRooms} | Capacity: {b.capacity} | Warden: {b.wardenName || "-"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <button onClick={() => { setEditId(b.id); setEditForm(b); }} style={btnGhost}>Edit</button>
                    <button onClick={() => handleDelete(b.id)} style={btnRed}>Delete</button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
