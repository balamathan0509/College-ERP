// src/pages/placements/PlacementsPage.js
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

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const STATUS_OPTIONS = [
  { value: "applied", label: "Applied", color: "#f6ad55" },
  { value: "shortlisted", label: "Shortlisted", color: "#4299e1" },
  { value: "selected", label: "Selected", color: "#48bb78" },
  { value: "rejected", label: "Rejected", color: "#fc8181" }
];

function formatDate(value) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function isEligible(drive, profile) {
  if (!profile) return false;
  const deptOk = drive.deptTarget === "all" || drive.deptTarget === profile.dept;
  const yearOk = drive.yearTarget === "all" || drive.yearTarget === profile.year;
  return deptOk && yearOk;
}

function isClosed(drive) {
  if (!drive.applyDeadline) return false;
  const deadline = new Date(drive.applyDeadline);
  if (Number.isNaN(deadline.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return deadline < today;
}

// ── CSV export helper ──────────────────────────────────────────────────────────
function exportToCSV(apps, driveTitle) {
  const headers = ["Name", "Register No", "Dept", "Year", "CGPA", "Status", "Resume", "Applied At", "Note"];
  const rows = apps.map(a => [
    a.studentName,
    a.registerNo || "",
    a.dept,
    a.year || "",
    a.cgpa,
    a.status,
    a.resumeUrl || "",
    formatDateTime(a.appliedAt),
    a.actionNote || ""
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${driveTitle.replace(/\s+/g, "_")}_applicants.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Badge component ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const meta = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  return (
    <span style={{
      padding: "4px 10px",
      borderRadius: 20,
      background: `${meta.color}22`,
      color: meta.color,
      fontSize: 12,
      fontWeight: 700
    }}>
      {meta.label}
    </span>
  );
}

export default function PlacementsPage() {
  const { currentUser, userProfile } = useAuth();
  const role = userProfile?.role;
  const isStudent = role === "student";
  const canCreate = role === "staff" || role === "hod";

  const [drives, setDrives] = useState([]);
  const [applications, setApplications] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [listError, setListError] = useState("");

  const [tab, setTab] = useState("open");

  // ── Create drive form ────────────────────────────────────────────────────────
  const emptyForm = {
    company: "", title: "", role: "", location: "", package: "",
    applyDeadline: "", driveDate: "", minCgpa: "",
    yearTarget: "all", deptScope: "dept", description: ""
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // ── Edit drive ───────────────────────────────────────────────────────────────
  const [editDriveId, setEditDriveId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // ── Apply form ───────────────────────────────────────────────────────────────
  const [applyDriveId, setApplyDriveId] = useState(null);
  const [applyForm, setApplyForm] = useState({ cgpa: "", resumeUrl: "" });
  const [applyError, setApplyError] = useState("");
  const [applySaving, setApplySaving] = useState(false);

  // ── Staff applicant view ─────────────────────────────────────────────────────
  const [actionState, setActionState] = useState({});
  const [expandedDrive, setExpandedDrive] = useState("");
  const [selectedApps, setSelectedApps] = useState({});  // driveId -> Set of appIds
  const [bulkStatus, setBulkStatus] = useState({});       // driveId -> status string
  const [cgpaFilter, setCgpaFilter] = useState({});       // driveId -> min cgpa string
  const [searchFilter, setSearchFilter] = useState({});   // driveId -> name string

  // ── Withdraw confirm ─────────────────────────────────────────────────────────
  const [withdrawConfirm, setWithdrawConfirm] = useState(null); // appId

  // ── Close drive confirm ──────────────────────────────────────────────────────
  const [closeDriveConfirm, setCloseDriveConfirm] = useState(null);

  useEffect(() => {
    if (!userProfile || !currentUser) return;
    fetchData();
  }, [userProfile, currentUser]);

  async function fetchData() {
    setFetching(true);
    setListError("");
    try {
      const drivesSnap = await getDocs(collection(db, "placement_drives"));
      const drivesList = drivesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      drivesList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setDrives(drivesList);

      let appsSnap;
      if (role === "student") {
        const q = query(collection(db, "placement_applications"), where("studentId", "==", currentUser.uid));
        appsSnap = await getDocs(q);
      } else if (role === "staff") {
        const q = query(collection(db, "placement_applications"), where("dept", "==", userProfile.dept));
        appsSnap = await getDocs(q);
      } else {
        appsSnap = await getDocs(collection(db, "placement_applications"));
      }
      const appsList = appsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      appsList.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
      setApplications(appsList);
    } catch {
      setListError("Failed to load placement data. Please try again.");
    }
    setFetching(false);
  }

  // ── Create drive ─────────────────────────────────────────────────────────────
  function handleFormChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleCreateDrive(e) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    if (!form.company.trim() || !form.title.trim()) return setFormError("Company and title are required.");
    const deptTarget = role === "hod" && form.deptScope === "all" ? "all" : userProfile?.dept;
    setSaving(true);
    try {
      await addDoc(collection(db, "placement_drives"), {
        company: form.company.trim(),
        title: form.title.trim(),
        role: form.role.trim(),
        location: form.location.trim(),
        package: form.package.trim(),
        applyDeadline: form.applyDeadline,
        driveDate: form.driveDate,
        minCgpa: form.minCgpa ? Number(form.minCgpa) : "",
        yearTarget: form.yearTarget,
        deptTarget,
        description: form.description.trim(),
        createdById: currentUser.uid,
        createdByName: userProfile?.name || "Staff",
        createdByRole: role,
        createdByDept: userProfile?.dept || "",
        createdAt: new Date().toISOString(),
        manuallyClosed: false
      });
      setFormSuccess("Placement drive created.");
      setForm(emptyForm);
      fetchData();
    } catch {
      setFormError("Failed to create drive. Try again.");
    }
    setSaving(false);
  }

  // ── Edit drive ───────────────────────────────────────────────────────────────
  function startEdit(drive) {
    setEditDriveId(drive.id);
    setEditForm({
      company: drive.company || "",
      title: drive.title || "",
      role: drive.role || "",
      location: drive.location || "",
      package: drive.package || "",
      applyDeadline: drive.applyDeadline || "",
      driveDate: drive.driveDate || "",
      minCgpa: drive.minCgpa || "",
      yearTarget: drive.yearTarget || "all",
      description: drive.description || ""
    });
    setEditError("");
  }

  async function handleEditDrive(e) {
    e.preventDefault();
    setEditError("");
    if (!editForm.company.trim() || !editForm.title.trim()) return setEditError("Company and title are required.");
    setEditSaving(true);
    try {
      await updateDoc(doc(db, "placement_drives", editDriveId), {
        company: editForm.company.trim(),
        title: editForm.title.trim(),
        role: editForm.role.trim(),
        location: editForm.location.trim(),
        package: editForm.package.trim(),
        applyDeadline: editForm.applyDeadline,
        driveDate: editForm.driveDate,
        minCgpa: editForm.minCgpa ? Number(editForm.minCgpa) : "",
        yearTarget: editForm.yearTarget,
        description: editForm.description.trim()
      });
      setEditDriveId(null);
      fetchData();
    } catch {
      setEditError("Failed to update drive.");
    }
    setEditSaving(false);
  }

  // ── Close drive manually ─────────────────────────────────────────────────────
  async function closeDrive(driveId) {
    try {
      await updateDoc(doc(db, "placement_drives", driveId), { manuallyClosed: true });
      setCloseDriveConfirm(null);
      fetchData();
    } catch {
      setListError("Failed to close drive.");
    }
  }

  // ── Apply ────────────────────────────────────────────────────────────────────
  function startApply(driveId) {
    setApplyDriveId(driveId);
    setApplyForm({ cgpa: "", resumeUrl: "" });
    setApplyError("");
  }

  async function submitApply(drive) {
    setApplyError("");
    if (!currentUser || !userProfile) return setApplyError("Profile not loaded.");
    const cgpaValue = Number(applyForm.cgpa);
    if (!applyForm.cgpa || Number.isNaN(cgpaValue)) return setApplyError("Enter valid CGPA.");
    if (drive.minCgpa && cgpaValue < Number(drive.minCgpa))
      return setApplyError(`Minimum CGPA required: ${drive.minCgpa}`);
    setApplySaving(true);
    try {
      await addDoc(collection(db, "placement_applications"), {
        driveId: drive.id,
        driveTitle: drive.title,
        company: drive.company,
        role: drive.role,
        studentId: currentUser.uid,
        studentName: userProfile.name,
        registerNo: userProfile.registerNo || "",
        dept: userProfile.dept,
        year: userProfile.year || "",
        cgpa: cgpaValue,
        resumeUrl: applyForm.resumeUrl.trim(),
        status: "applied",
        appliedAt: new Date().toISOString(),
        actionNote: "",
        actionByName: "",
        actionByRole: "",
        actionAt: ""
      });
      setApplyDriveId(null);
      setApplyForm({ cgpa: "", resumeUrl: "" });
      fetchData();
    } catch {
      setApplyError("Failed to apply. Try again.");
    }
    setApplySaving(false);
  }

  // ── Withdraw application ─────────────────────────────────────────────────────
  async function withdrawApplication(appId) {
    try {
      await deleteDoc(doc(db, "placement_applications", appId));
      setWithdrawConfirm(null);
      fetchData();
    } catch {
      setListError("Failed to withdraw application.");
    }
  }

  // ── Update single application ────────────────────────────────────────────────
  function updateActionState(id, updates) {
    setActionState(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }));
  }

  async function updateApplication(app) {
    const current = actionState[app.id] || {};
    const newStatus = current.status || app.status || "applied";
    const note = (current.note || "").trim();
    updateActionState(app.id, { saving: true });
    try {
      const payload = {
        status: newStatus,
        actionByName: userProfile.name,
        actionByRole: role,
        actionAt: new Date().toISOString()
      };
      if (note) payload.actionNote = note;
      await updateDoc(doc(db, "placement_applications", app.id), payload);
      setApplications(prev =>
        prev.map(a => a.id !== app.id ? a : { ...a, ...payload, actionNote: note || a.actionNote })
      );
      updateActionState(app.id, { saving: false, note: "" });
    } catch {
      setListError("Failed to update application.");
      updateActionState(app.id, { saving: false });
    }
  }

  // ── Bulk status update ───────────────────────────────────────────────────────
  async function handleBulkUpdate(driveId) {
    const sel = selectedApps[driveId];
    if (!sel || sel.size === 0) return;
    const status = bulkStatus[driveId] || "shortlisted";
    const payload = {
      status,
      actionByName: userProfile.name,
      actionByRole: role,
      actionAt: new Date().toISOString()
    };
    try {
      await Promise.all([...sel].map(appId => updateDoc(doc(db, "placement_applications", appId), payload)));
      setApplications(prev => prev.map(a => sel.has(a.id) ? { ...a, ...payload } : a));
      setSelectedApps(prev => ({ ...prev, [driveId]: new Set() }));
    } catch {
      setListError("Bulk update failed.");
    }
  }

  function toggleSelectApp(driveId, appId) {
    setSelectedApps(prev => {
      const set = new Set(prev[driveId] || []);
      set.has(appId) ? set.delete(appId) : set.add(appId);
      return { ...prev, [driveId]: set };
    });
  }

  function toggleSelectAll(driveId, appIds) {
    setSelectedApps(prev => {
      const set = prev[driveId] || new Set();
      const allSelected = appIds.every(id => set.has(id));
      return { ...prev, [driveId]: allSelected ? new Set() : new Set(appIds) };
    });
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const applicationsByDrive = useMemo(() => {
    const map = {};
    applications.forEach(app => {
      if (!map[app.driveId]) map[app.driveId] = [];
      map[app.driveId].push(app);
    });
    return map;
  }, [applications]);

  const driveMap = useMemo(() => {
    const map = {};
    drives.forEach(d => { map[d.id] = d; });
    return map;
  }, [drives]);

  const visibleDrives = useMemo(() => {
    if (!userProfile) return [];
    if (isStudent) return drives.filter(d => isEligible(d, userProfile));
    if (role === "staff") return drives.filter(d => d.deptTarget === "all" || d.deptTarget === userProfile.dept);
    return drives;
  }, [drives, userProfile, isStudent, role]);

  const openDrives = useMemo(() => visibleDrives.filter(d => !isClosed(d) && !d.manuallyClosed), [visibleDrives]);

  const myApplications = useMemo(() => applications.filter(app => app.studentId === currentUser?.uid), [applications, currentUser]);

  // ── Placement stats for student (batch totals) ────────────────────────────────
  const batchStats = useMemo(() => {
    if (!isStudent) return null;
    const total = applications.length;
    const selected = applications.filter(a => a.status === "selected").length;
    const shortlisted = applications.filter(a => a.status === "shortlisted").length;
    return { total, selected, shortlisted };
  }, [applications, isStudent]);

  const statusMap = STATUS_OPTIONS.reduce((acc, s) => { acc[s.value] = s; return acc; }, {});

  // ── Shared input style ────────────────────────────────────────────────────────
  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    color: "white",
    fontSize: 15,
    fontFamily: "DM Sans, sans-serif",
    outline: "none",
    boxSizing: "border-box"
  };

  const btnPrimary = {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid rgba(233,69,96,0.4)",
    background: "rgba(233,69,96,0.2)",
    color: "#e94560",
    cursor: "pointer",
    fontWeight: 600
  };

  const btnGhost = {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Placements</h1>
          <p>Manage placement drives and applications</p>
        </div>

        {/* ── Student stats bar ─────────────────────────────────────────────── */}
        {isStudent && batchStats && (
          <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            {[
              { label: "My Applications", value: myApplications.length, color: "#f6ad55" },
              { label: "Shortlisted", value: myApplications.filter(a => a.status === "shortlisted").length, color: "#4299e1" },
              { label: "Selected", value: myApplications.filter(a => a.status === "selected").length, color: "#48bb78" },
              { label: "Open Drives", value: openDrives.length, color: "#a0aec0" }
            ].map(stat => (
              <div key={stat.label} className="card" style={{ flex: 1, minWidth: 140, padding: "16px 20px" }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: stat.color, fontFamily: "Syne" }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className={`placements-layout ${canCreate ? "" : "single"}`}>

          {/* ── Create drive form ──────────────────────────────────────────────── */}
          {canCreate && (
            <div className="card" style={{ height: "fit-content" }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 20 }}>Create Drive</h3>
              {formError && <div className="error-msg">{formError}</div>}
              {formSuccess && (
                <div style={{
                  background: "rgba(72,187,120,0.1)", border: "1px solid rgba(72,187,120,0.3)",
                  borderRadius: 10, padding: "12px 16px", color: "#48bb78", fontSize: 14, marginBottom: 20
                }}>{formSuccess}</div>
              )}
              <form onSubmit={handleCreateDrive}>
                {[
                  { name: "company", label: "Company", placeholder: "Company name" },
                  { name: "title", label: "Drive Title", placeholder: "Campus Hiring 2026" },
                  { name: "role", label: "Role", placeholder: "Software Engineer" },
                  { name: "package", label: "Package (CTC)", placeholder: "6 LPA" },
                  { name: "location", label: "Location", placeholder: "Chennai" }
                ].map(f => (
                  <div className="form-group" key={f.name}>
                    <label>{f.label}</label>
                    <input name={f.name} value={form[f.name]} onChange={handleFormChange} placeholder={f.placeholder} />
                  </div>
                ))}
                <div className="form-row">
                  <div className="form-group">
                    <label>Apply Deadline</label>
                    <input type="date" name="applyDeadline" value={form.applyDeadline} onChange={handleFormChange} />
                  </div>
                  <div className="form-group">
                    <label>Drive Date</label>
                    <input type="date" name="driveDate" value={form.driveDate} onChange={handleFormChange} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Minimum CGPA</label>
                    <input name="minCgpa" value={form.minCgpa} onChange={handleFormChange} placeholder="7.0" />
                  </div>
                  <div className="form-group">
                    <label>Target Year</label>
                    <select name="yearTarget" value={form.yearTarget} onChange={handleFormChange}>
                      <option value="all">All Years</option>
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
                {role === "hod" && (
                  <div className="form-group">
                    <label>Department Scope</label>
                    <select name="deptScope" value={form.deptScope} onChange={handleFormChange}>
                      <option value="dept">My Department ({userProfile?.dept})</option>
                      <option value="all">All Departments</option>
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>Description</label>
                  <textarea name="description" rows={4} value={form.description} onChange={handleFormChange}
                    placeholder="Drive details, rounds, links, etc." style={{ ...inputStyle, resize: "vertical" }} />
                </div>
                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Create Drive"}
                </button>
              </form>
            </div>
          )}

          {/* ── Right column ───────────────────────────────────────────────────── */}
          <div>
            {/* Student tabs */}
            {isStudent && (
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                {["open", "applications"].map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer",
                    fontFamily: "Syne", fontWeight: 600, fontSize: 14,
                    background: tab === t ? "#e94560" : "rgba(255,255,255,0.07)", color: "white"
                  }}>
                    {t === "open" ? "Open Drives" : "My Applications"}
                  </button>
                ))}
              </div>
            )}

            {listError && <div className="error-msg">{listError}</div>}

            {fetching ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div className="spinner" style={{ margin: "0 auto" }} />
              </div>
            ) : (
              <>
                {/* ── Student: My Applications tab ───────────────────────────── */}
                {isStudent && tab === "applications" && (
                  myApplications.length === 0 ? (
                    <div className="card" style={{ textAlign: "center", padding: 60 }}>
                      <div style={{ fontSize: 16, marginBottom: 12 }}>No applications yet</div>
                      <p style={{ color: "#a0aec0" }}>Apply for a drive to see your status here.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {myApplications.map(app => {
                        const drive = driveMap[app.driveId];
                        const closed = drive ? (isClosed(drive) || drive.manuallyClosed) : true;
                        return (
                          <div key={app.id} className="card">
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                              <div>
                                <div style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                                  {drive?.title || app.driveTitle}
                                </div>
                                <div style={{ color: "#a0aec0", fontSize: 13 }}>
                                  {drive?.company || app.company} — {drive?.role || app.role}
                                </div>
                                <div style={{ color: "#a0aec0", fontSize: 12, marginTop: 6 }}>
                                  Applied on {formatDate(app.appliedAt)}
                                </div>
                                {app.actionNote && (
                                  <div style={{ marginTop: 6, fontSize: 12, color: "#a0aec0" }}>
                                    Note: {app.actionNote}
                                  </div>
                                )}
                              </div>
                              <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                                <StatusBadge status={app.status} />
                                {/* Withdraw — only if not selected and deadline not passed */}
                                {app.status !== "selected" && !closed && (
                                  <>
                                    {withdrawConfirm === app.id ? (
                                      <div style={{ display: "flex", gap: 8 }}>
                                        <button onClick={() => withdrawApplication(app.id)}
                                          style={{ ...btnGhost, color: "#fc8181", borderColor: "rgba(252,129,129,0.4)" }}>
                                          Confirm
                                        </button>
                                        <button onClick={() => setWithdrawConfirm(null)} style={btnGhost}>Cancel</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => setWithdrawConfirm(app.id)}
                                        style={{ ...btnGhost, fontSize: 11 }}>
                                        Withdraw
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {/* ── Drives list (student open tab OR staff/hod all) ─────────── */}
                {(!isStudent || tab === "open") && (
                  (isStudent ? openDrives : visibleDrives).length === 0 ? (
                    <div className="card" style={{ textAlign: "center", padding: 60 }}>
                      <div style={{ fontSize: 16, marginBottom: 12 }}>No drives found</div>
                      <p style={{ color: "#a0aec0" }}>Create a drive or check back later.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {(isStudent ? openDrives : visibleDrives).map(drive => {
                        const apps = applicationsByDrive[drive.id] || [];
                        const applied = apps.find(a => a.studentId === currentUser?.uid);
                        const eligible = isEligible(drive, userProfile);
                        const closed = isClosed(drive) || drive.manuallyClosed;
                        const minCgpa = drive.minCgpa ? Number(drive.minCgpa) : null;

                        const appliedCount = apps.length;
                        const shortlistedCount = apps.filter(a => a.status === "shortlisted").length;
                        const selectedCount = apps.filter(a => a.status === "selected").length;
                        const rejectedCount = apps.filter(a => a.status === "rejected").length;

                        // Filtered apps for staff view
                        const minCgpaF = parseFloat(cgpaFilter[drive.id]) || 0;
                        const nameF = (searchFilter[drive.id] || "").toLowerCase();
                        const filteredApps = apps.filter(a => {
                          const cgpaOk = !minCgpaF || (a.cgpa >= minCgpaF);
                          const nameOk = !nameF || a.studentName.toLowerCase().includes(nameF) || (a.registerNo || "").toLowerCase().includes(nameF);
                          return cgpaOk && nameOk;
                        });

                        const selSet = selectedApps[drive.id] || new Set();
                        const filteredIds = filteredApps.map(a => a.id);
                        const allChecked = filteredIds.length > 0 && filteredIds.every(id => selSet.has(id));

                        return (
                          <div key={drive.id} className="card">
                            {/* ── Drive header ──────────────────────────────── */}
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                              <div style={{ flex: 1, minWidth: 220 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                                  <div style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700 }}>{drive.title}</div>
                                  {closed && (
                                    <span style={{
                                      padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                                      background: "rgba(252,129,129,0.15)", color: "#fc8181"
                                    }}>Closed</span>
                                  )}
                                </div>
                                <div style={{ color: "#a0aec0", fontSize: 13 }}>
                                  {drive.company} — {drive.role || "Role not specified"}
                                </div>
                                <div style={{ color: "#a0aec0", fontSize: 12, marginTop: 6 }}>
                                  Package: {drive.package || "Not specified"} | Location: {drive.location || "Not specified"}
                                </div>
                                <div style={{ color: "#a0aec0", fontSize: 12, marginTop: 6 }}>
                                  Deadline: {drive.applyDeadline ? formatDate(drive.applyDeadline) : "Open"}
                                  {" | "}
                                  Drive Date: {drive.driveDate ? formatDate(drive.driveDate) : "TBD"}
                                </div>
                                <div style={{ color: "#a0aec0", fontSize: 12, marginTop: 6 }}>
                                  Eligibility: {drive.deptTarget === "all" ? "All Depts" : drive.deptTarget}
                                  {" | "}
                                  {drive.yearTarget === "all" ? "All Years" : drive.yearTarget}
                                  {minCgpa ? ` | Min CGPA ${minCgpa}` : ""}
                                </div>
                                {drive.description && (
                                  <div style={{ marginTop: 10, color: "#a0aec0", fontSize: 13 }}>{drive.description}</div>
                                )}
                              </div>

                              {/* ── Staff/HOD right panel ──────────────────── */}
                              {!isStudent && (
                                <div style={{ minWidth: 220, textAlign: "right" }}>
                                  <div style={{ fontSize: 12, color: "#a0aec0" }}>
                                    By {drive.createdByName} ({drive.createdByRole?.toUpperCase()})
                                  </div>
                                  <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 6 }}>
                                    Applications: {appliedCount}
                                  </div>
                                  <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>
                                    Shortlisted: {shortlistedCount} | Selected: {selectedCount} | Rejected: {rejectedCount}
                                  </div>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 12 }}>
                                    <button onClick={() => setExpandedDrive(expandedDrive === drive.id ? "" : drive.id)} style={btnGhost}>
                                      {expandedDrive === drive.id ? "Hide Applicants" : "View Applicants"}
                                    </button>
                                    <button onClick={() => startEdit(drive)} style={btnGhost}>Edit</button>
                                    {!closed && (
                                      <button
                                        onClick={() => setCloseDriveConfirm(drive.id)}
                                        style={{ ...btnGhost, color: "#fc8181", borderColor: "rgba(252,129,129,0.3)" }}>
                                        Close Drive
                                      </button>
                                    )}
                                    {apps.length > 0 && (
                                      <button onClick={() => exportToCSV(apps, drive.title)} style={btnGhost}>
                                        Export CSV
                                      </button>
                                    )}
                                  </div>
                                  {closeDriveConfirm === drive.id && (
                                    <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                      <span style={{ fontSize: 12, color: "#a0aec0", alignSelf: "center" }}>Close this drive?</span>
                                      <button onClick={() => closeDrive(drive.id)}
                                        style={{ ...btnGhost, color: "#fc8181", borderColor: "rgba(252,129,129,0.4)" }}>Yes</button>
                                      <button onClick={() => setCloseDriveConfirm(null)} style={btnGhost}>No</button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* ── Student right panel ────────────────────── */}
                              {isStudent && (
                                <div style={{ minWidth: 180, textAlign: "right" }}>
                                  {applied ? (
                                    <StatusBadge status={applied.status} />
                                  ) : closed ? (
                                    <span style={{
                                      padding: "4px 10px", borderRadius: 20,
                                      background: "rgba(252,129,129,0.2)", color: "#fc8181", fontSize: 12, fontWeight: 700
                                    }}>Closed</span>
                                  ) : eligible ? (
                                    <button onClick={() => startApply(drive.id)} style={btnPrimary}>Apply</button>
                                  ) : (
                                    <span style={{
                                      padding: "4px 10px", borderRadius: 20,
                                      background: "rgba(255,255,255,0.1)", color: "#a0aec0", fontSize: 12, fontWeight: 700
                                    }}>Not Eligible</span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* ── Apply inline form ──────────────────────────────── */}
                            {isStudent && applyDriveId === drive.id && (
                              <div style={{ marginTop: 16 }}>
                                {applyError && <div className="error-msg">{applyError}</div>}
                                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                  <input type="number" step="0.1" placeholder="Your CGPA"
                                    value={applyForm.cgpa}
                                    onChange={e => setApplyForm(prev => ({ ...prev, cgpa: e.target.value }))}
                                    style={{ flex: 1, minWidth: 160 }} />
                                  <input type="text" placeholder="Resume Link (optional)"
                                    value={applyForm.resumeUrl}
                                    onChange={e => setApplyForm(prev => ({ ...prev, resumeUrl: e.target.value }))}
                                    style={{ flex: 2, minWidth: 200 }} />
                                  <button onClick={() => submitApply(drive)} disabled={applySaving} style={{ ...btnPrimary, minWidth: 120 }}>
                                    {applySaving ? "Applying..." : "Submit"}
                                  </button>
                                  <button onClick={() => setApplyDriveId(null)} style={btnGhost}>Cancel</button>
                                </div>
                              </div>
                            )}

                            {/* ── Edit drive inline form ─────────────────────────── */}
                            {!isStudent && editDriveId === drive.id && (
                              <div style={{
                                marginTop: 16, padding: 16, borderRadius: 12,
                                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)"
                              }}>
                                <div style={{ fontFamily: "Syne", fontSize: 15, marginBottom: 14 }}>Edit Drive</div>
                                {editError && <div className="error-msg">{editError}</div>}
                                <form onSubmit={handleEditDrive}>
                                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                    {[
                                      { name: "company", placeholder: "Company" },
                                      { name: "title", placeholder: "Drive Title" },
                                      { name: "role", placeholder: "Role" },
                                      { name: "package", placeholder: "Package" },
                                      { name: "location", placeholder: "Location" }
                                    ].map(f => (
                                      <input key={f.name} placeholder={f.placeholder}
                                        value={editForm[f.name]}
                                        onChange={e => setEditForm(prev => ({ ...prev, [f.name]: e.target.value }))}
                                        style={{ flex: "1 1 180px" }} />
                                    ))}
                                    <input type="date" value={editForm.applyDeadline}
                                      onChange={e => setEditForm(prev => ({ ...prev, applyDeadline: e.target.value }))}
                                      style={{ flex: "1 1 150px" }} />
                                    <input type="date" value={editForm.driveDate}
                                      onChange={e => setEditForm(prev => ({ ...prev, driveDate: e.target.value }))}
                                      style={{ flex: "1 1 150px" }} />
                                    <input placeholder="Min CGPA" value={editForm.minCgpa}
                                      onChange={e => setEditForm(prev => ({ ...prev, minCgpa: e.target.value }))}
                                      style={{ flex: "1 1 120px" }} />
                                    <select value={editForm.yearTarget}
                                      onChange={e => setEditForm(prev => ({ ...prev, yearTarget: e.target.value }))}
                                      style={{ flex: "1 1 140px" }}>
                                      <option value="all">All Years</option>
                                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                    <textarea placeholder="Description" rows={2} value={editForm.description}
                                      onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                      style={{ ...inputStyle, flex: "1 1 100%", resize: "vertical" }} />
                                  </div>
                                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                                    <button type="submit" disabled={editSaving} style={btnPrimary}>
                                      {editSaving ? "Saving..." : "Save Changes"}
                                    </button>
                                    <button type="button" onClick={() => setEditDriveId(null)} style={btnGhost}>Cancel</button>
                                  </div>
                                </form>
                              </div>
                            )}

                            {/* ── Applicants expanded panel ──────────────────────── */}
                            {!isStudent && expandedDrive === drive.id && (
                              <div style={{ marginTop: 16 }}>
                                {apps.length === 0 ? (
                                  <div style={{ color: "#a0aec0", fontSize: 13 }}>No applications yet.</div>
                                ) : (
                                  <>
                                    {/* Filter row */}
                                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                                      <input placeholder="Search name / reg no"
                                        value={searchFilter[drive.id] || ""}
                                        onChange={e => setSearchFilter(prev => ({ ...prev, [drive.id]: e.target.value }))}
                                        style={{ flex: 2, minWidth: 160 }} />
                                      <input type="number" step="0.1" placeholder="Min CGPA filter"
                                        value={cgpaFilter[drive.id] || ""}
                                        onChange={e => setCgpaFilter(prev => ({ ...prev, [drive.id]: e.target.value }))}
                                        style={{ flex: 1, minWidth: 140 }} />
                                      <span style={{ alignSelf: "center", color: "#a0aec0", fontSize: 12 }}>
                                        {filteredApps.length} of {apps.length} shown
                                      </span>
                                    </div>

                                    {/* Bulk action row */}
                                    {filteredApps.length > 0 && (
                                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
                                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#a0aec0", cursor: "pointer" }}>
                                          <input type="checkbox" checked={allChecked}
                                            onChange={() => toggleSelectAll(drive.id, filteredIds)}
                                            style={{ width: 15, height: 15 }} />
                                          Select all ({selSet.size} selected)
                                        </label>
                                        {selSet.size > 0 && (
                                          <>
                                            <select value={bulkStatus[drive.id] || "shortlisted"}
                                              onChange={e => setBulkStatus(prev => ({ ...prev, [drive.id]: e.target.value }))}
                                              style={{ minWidth: 140 }}>
                                              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                            </select>
                                            <button onClick={() => handleBulkUpdate(drive.id)} style={btnPrimary}>
                                              Update {selSet.size} selected
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )}

                                    {/* Applicant rows */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                      {filteredApps.map(app => {
                                        const action = actionState[app.id] || { status: app.status, note: "" };
                                        const checked = selSet.has(app.id);
                                        return (
                                          <div key={app.id} style={{
                                            padding: "12px 14px", borderRadius: 12,
                                            border: `1px solid ${checked ? "rgba(233,69,96,0.3)" : "rgba(255,255,255,0.08)"}`,
                                            background: checked ? "rgba(233,69,96,0.05)" : "rgba(255,255,255,0.03)"
                                          }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                                <input type="checkbox" checked={checked}
                                                  onChange={() => toggleSelectApp(drive.id, app.id)}
                                                  style={{ width: 15, height: 15, marginTop: 3 }} />
                                                <div>
                                                  <div style={{ fontWeight: 600 }}>
                                                    {app.studentName} {app.registerNo ? `— ${app.registerNo}` : ""}
                                                  </div>
                                                  <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>
                                                    {app.dept} {app.year ? `| ${app.year}` : ""} | CGPA: {app.cgpa}
                                                  </div>
                                                  {app.resumeUrl && (
                                                    <div style={{ fontSize: 12, marginTop: 4 }}>
                                                      <a href={app.resumeUrl} target="_blank" rel="noopener noreferrer"
                                                        style={{ color: "#4299e1", textDecoration: "none" }}>
                                                        View Resume ↗
                                                      </a>
                                                    </div>
                                                  )}
                                                  {app.actionNote && (
                                                    <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>
                                                      Note: {app.actionNote}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                              <div style={{ textAlign: "right" }}>
                                                <StatusBadge status={app.status} />
                                                <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 6 }}>
                                                  Applied: {formatDateTime(app.appliedAt)}
                                                </div>
                                                {app.actionAt && (
                                                  <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 2 }}>
                                                    Updated: {formatDateTime(app.actionAt)} by {app.actionByName}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                                              <select value={action.status || app.status}
                                                onChange={e => updateActionState(app.id, { status: e.target.value })}
                                                style={{ minWidth: 160 }}>
                                                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                              </select>
                                              <input type="text" placeholder="Action note (optional)"
                                                value={action.note || ""}
                                                onChange={e => updateActionState(app.id, { note: e.target.value })}
                                                style={{ flex: 1, minWidth: 200 }} />
                                              <button onClick={() => updateApplication(app)} disabled={action.saving}
                                                style={{ ...btnPrimary, padding: "8px 14px" }}>
                                                {action.saving ? "Saving..." : "Update"}
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}