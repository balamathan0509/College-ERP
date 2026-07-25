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
  updateDoc
} from "firebase/firestore";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  Award,
  PlusCircle
} from "lucide-react";

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const STATUS_OPTIONS = [
  { value: "applied", label: "Applied", color: "var(--warning)" },
  { value: "shortlisted", label: "Shortlisted", color: "var(--highlight)" },
  { value: "selected", label: "Selected", color: "var(--success)" },
  { value: "rejected", label: "Rejected", color: "var(--danger)" }
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
  return today > deadline;
}

function StatusBadge({ status }) {
  if (status === "selected") {
    return <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={12} /> Selected</span>;
  }
  if (status === "shortlisted") {
    return <span className="badge" style={{ background: "rgba(37, 99, 235, 0.14)", color: "var(--highlight)", border: "1px solid rgba(37, 99, 235, 0.3)", display: "inline-flex", alignItems: "center", gap: 4 }}><Award size={12} /> Shortlisted</span>;
  }
  if (status === "rejected") {
    return <span className="badge badge-danger" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><XCircle size={12} /> Rejected</span>;
  }
  return <span className="badge badge-warning" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={12} /> Applied</span>;
}

export default function PlacementsPage() {
  const { currentUser, userProfile } = useAuth();
  const role = userProfile?.role || "student";
  const isStudent = role === "student";
  const canCreate = role === "staff" || role === "hod" || role === "principal" || role === "management" || role === "admin";

  const [drives, setDrives] = useState([]);
  const [applications, setApplications] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [listError, setListError] = useState("");
  const [tab, setTab] = useState("open");

  const [form, setForm] = useState({
    company: "", title: "", role: "", package: "", location: "",
    applyDeadline: "", driveDate: "", minCgpa: "", yearTarget: "all",
    deptScope: "dept", description: ""
  });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [applyDriveId, setApplyDriveId] = useState(null);
  const [applyForm, setApplyForm] = useState({ cgpa: "", resumeUrl: "" });
  const [applyError, setApplyError] = useState("");
  const [applySaving, setApplySaving] = useState(false);

  const [expandedDrive, setExpandedDrive] = useState(null);
  const [searchFilter, setSearchFilter] = useState({});
  const [cgpaFilter, setCgpaFilter] = useState({});
  const [selectedApps, setSelectedApps] = useState({});
  const [bulkStatus, setBulkStatus] = useState({});

  const [actionState, setActionState] = useState({});

  const [editDriveId, setEditDriveId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [withdrawConfirm, setWithdrawConfirm] = useState(null);

  async function fetchAll() {
    setFetching(true);
    setListError("");
    try {
      const driveSnap = await getDocs(collection(db, "placement_drives"));
      const driveList = driveSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      driveList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setDrives(driveList);

      const appSnap = await getDocs(collection(db, "placement_applications"));
      const appList = appSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setApplications(appList);
    } catch (err) {
      console.error(err);
      setListError("Failed to fetch placement records.");
    }
    setFetching(false);
  }

  useEffect(() => {
    if (userProfile) fetchAll();
  }, [userProfile]);

  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleCreateDrive(e) {
    e.preventDefault();
    setFormError(""); setFormSuccess("");

    if (!form.company.trim() || !form.title.trim() || !form.role.trim()) {
      setFormError("Company, Drive Title, and Role are required.");
      return;
    }

    setSaving(true);
    try {
      let deptTarget = userProfile?.dept || "all";
      if (role === "principal" || role === "management" || role === "admin") {
        deptTarget = "all";
      } else if (role === "hod" && form.deptScope === "all") {
        deptTarget = "all";
      }

      await addDoc(collection(db, "placement_drives"), {
        company: form.company.trim(),
        title: form.title.trim(),
        role: form.role.trim(),
        package: form.package.trim(),
        location: form.location.trim(),
        applyDeadline: form.applyDeadline || null,
        driveDate: form.driveDate || null,
        minCgpa: form.minCgpa ? Number(form.minCgpa) : null,
        deptTarget,
        yearTarget: form.yearTarget,
        description: form.description.trim(),
        manuallyClosed: false,
        createdById: currentUser?.uid || "",
        createdByName: userProfile?.name || "Staff",
        createdByRole: role,
        createdAt: new Date().toISOString()
      });

      setFormSuccess("Placement Drive created successfully!");
      setForm({
        company: "", title: "", role: "", package: "", location: "",
        applyDeadline: "", driveDate: "", minCgpa: "", yearTarget: "all",
        deptScope: "dept", description: ""
      });
      fetchAll();
    } catch (err) {
      setFormError("Failed to create drive. Try again.");
    }
    setSaving(false);
  }

  async function handleApply(drive) {
    setApplyError("");
    if (!applyForm.cgpa) {
      setApplyError("CGPA is required.");
      return;
    }

    setApplySaving(true);
    try {
      await addDoc(collection(db, "placement_applications"), {
        driveId: drive.id,
        driveTitle: drive.title,
        company: drive.company,
        role: drive.role,
        studentId: currentUser?.uid || "",
        studentName: userProfile?.name || "Student",
        studentEmail: currentUser?.email || "",
        registerNo: userProfile?.registerNo || "",
        dept: userProfile?.dept || "",
        year: userProfile?.year || "",
        cgpa: Number(applyForm.cgpa),
        resumeUrl: applyForm.resumeUrl.trim(),
        status: "applied",
        appliedAt: new Date().toISOString()
      });

      setApplyDriveId(null);
      setApplyForm({ cgpa: "", resumeUrl: "" });
      fetchAll();
    } catch (err) {
      setApplyError("Failed to submit application.");
    }
    setApplySaving(false);
  }

  async function withdrawApplication(appId) {
    try {
      await deleteDoc(doc(db, "placement_applications", appId));
      setWithdrawConfirm(null);
      fetchAll();
    } catch (err) {
      alert("Failed to withdraw application.");
    }
  }

  async function toggleDriveStatus(drive) {
    try {
      const docRef = doc(db, "placement_drives", drive.id);
      await updateDoc(docRef, { manuallyClosed: !drive.manuallyClosed });
      fetchAll();
    } catch (err) {
      alert("Failed to update status.");
    }
  }

  async function handleDeleteDrive(driveId) {
    if (!window.confirm("Are you sure you want to delete this drive and all associated applications?")) return;
    try {
      await deleteDoc(doc(db, "placement_drives", driveId));
      const relatedApps = applications.filter(a => a.driveId === driveId);
      for (const a of relatedApps) {
        await deleteDoc(doc(db, "placement_applications", a.id));
      }
      fetchAll();
    } catch (err) {
      alert("Failed to delete drive.");
    }
  }

  function startEditDrive(drive) {
    setEditDriveId(drive.id);
    setEditForm({
      company: drive.company || "",
      title: drive.title || "",
      role: drive.role || "",
      package: drive.package || "",
      location: drive.location || "",
      applyDeadline: drive.applyDeadline || "",
      driveDate: drive.driveDate || "",
      minCgpa: drive.minCgpa || "",
      yearTarget: drive.yearTarget || "all",
      description: drive.description || ""
    });
  }

  async function handleEditDrive(e) {
    e.preventDefault();
    setEditError("");
    setEditSaving(true);
    try {
      const docRef = doc(db, "placement_drives", editDriveId);
      await updateDoc(docRef, {
        company: editForm.company.trim(),
        title: editForm.title.trim(),
        role: editForm.role.trim(),
        package: editForm.package.trim(),
        location: editForm.location.trim(),
        applyDeadline: editForm.applyDeadline || null,
        driveDate: editForm.driveDate || null,
        minCgpa: editForm.minCgpa ? Number(editForm.minCgpa) : null,
        yearTarget: editForm.yearTarget,
        description: editForm.description.trim(),
        updatedAt: new Date().toISOString()
      });

      setEditDriveId(null);
      fetchAll();
    } catch (err) {
      setEditError("Failed to update drive.");
    }
    setEditSaving(false);
  }

  function updateActionState(appId, patch) {
    setActionState(prev => ({
      ...prev,
      [appId]: { ...prev[appId], ...patch }
    }));
  }

  async function updateApplication(app) {
    const action = actionState[app.id] || {};
    const newStatus = action.status || app.status;
    const note = action.note !== undefined ? action.note : (app.actionNote || "");

    updateActionState(app.id, { saving: true });
    try {
      const docRef = doc(db, "placement_applications", app.id);
      await updateDoc(docRef, {
        status: newStatus,
        actionNote: note.trim(),
        actionAt: new Date().toISOString(),
        actionByName: userProfile?.name || "Staff"
      });
      fetchAll();
    } catch (err) {
      alert("Failed to update application.");
    }
    updateActionState(app.id, { saving: false });
  }

  function toggleSelectApp(driveId, appId) {
    setSelectedApps(prev => {
      const current = new Set(prev[driveId] || []);
      if (current.has(appId)) current.delete(appId);
      else current.add(appId);
      return { ...prev, [driveId]: current };
    });
  }

  function toggleSelectAll(driveId, appIds) {
    setSelectedApps(prev => {
      const current = new Set(prev[driveId] || []);
      const allSelected = appIds.every(id => current.has(id));
      if (allSelected) {
        appIds.forEach(id => current.delete(id));
      } else {
        appIds.forEach(id => current.add(id));
      }
      return { ...prev, [driveId]: new Set(current) };
    });
  }

  async function handleBulkUpdate(driveId) {
    const selectedIds = Array.from(selectedApps[driveId] || []);
    if (selectedIds.length === 0) return;
    const targetStatus = bulkStatus[driveId] || "shortlisted";

    try {
      for (const id of selectedIds) {
        const docRef = doc(db, "placement_applications", id);
        await updateDoc(docRef, {
          status: targetStatus,
          actionAt: new Date().toISOString(),
          actionByName: userProfile?.name || "Staff"
        });
      }
      setSelectedApps(prev => ({ ...prev, [driveId]: new Set() }));
      fetchAll();
    } catch (err) {
      alert("Failed bulk update.");
    }
  }

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

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Campus Placements & Drives</h1>
          <p>Institutional recruitment drives, application tracking, and hiring analytics</p>
        </div>

        {/* Student Stats */}
        {isStudent && (
          <div className="stats-grid" style={{ marginBottom: 28 }}>
            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Briefcase size={24} color="var(--warning)" />
              </div>
              <div className="stat-value" style={{ color: "var(--warning)" }}>{myApplications.length}</div>
              <div className="stat-label">My Applications</div>
            </div>
            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Award size={24} color="var(--highlight)" />
              </div>
              <div className="stat-value" style={{ color: "var(--highlight)" }}>
                {myApplications.filter(a => a.status === "shortlisted").length}
              </div>
              <div className="stat-label">Shortlisted</div>
            </div>
            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <CheckCircle2 size={24} color="var(--success)" />
              </div>
              <div className="stat-value" style={{ color: "var(--success)" }}>
                {myApplications.filter(a => a.status === "selected").length}
              </div>
              <div className="stat-label">Selected</div>
            </div>
            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Building2 size={24} color="var(--text-muted)" />
              </div>
              <div className="stat-value">{openDrives.length}</div>
              <div className="stat-label">Active Drives</div>
            </div>
          </div>
        )}

        <div className={`placements-layout ${canCreate ? "" : "single"}`}>
          {/* Create Drive Form */}
          {canCreate && (
            <div className="card" style={{ height: "fit-content" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <PlusCircle size={20} color="var(--highlight)" />
                <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>Create Drive</h3>
              </div>

              {formError && <div className="error-msg">{formError}</div>}
              {formSuccess && (
                <div style={{
                  background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "var(--radius-md)", padding: "12px 16px", color: "var(--success)",
                  fontSize: 14, marginBottom: 20, display: "flex", alignItems: "center", gap: 8
                }}>
                  <CheckCircle2 size={16} /> {formSuccess}
                </div>
              )}

              <form onSubmit={handleCreateDrive}>
                {[
                  { name: "company", label: "Company Name *", placeholder: "e.g. Google or TCS" },
                  { name: "title", label: "Drive Title *", placeholder: "e.g. Campus Hiring 2026" },
                  { name: "role", label: "Job Role *", placeholder: "e.g. Software Engineer" },
                  { name: "package", label: "Package (CTC)", placeholder: "e.g. 6.5 LPA" },
                  { name: "location", label: "Work Location", placeholder: "e.g. Chennai / Hybrid" }
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
                    <input name="minCgpa" value={form.minCgpa} onChange={handleFormChange} placeholder="e.g. 7.5" />
                  </div>
                  <div className="form-group">
                    <label>Target Year</label>
                    <select name="yearTarget" value={form.yearTarget} onChange={handleFormChange}>
                      <option value="all">All Years</option>
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Description & Requirements</label>
                  <textarea name="description" rows={4} value={form.description} onChange={handleFormChange} placeholder="Job description, interview rounds..." />
                </div>
                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Publishing Drive..." : "Publish Drive"}
                </button>
              </form>
            </div>
          )}

          {/* Drives List */}
          <div>
            {isStudent && (
              <div style={{ display: "flex", gap: 12, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
                <button onClick={() => setTab("open")} style={{
                  padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 600, transition: "all 0.2s ease",
                  background: tab === "open" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
                  color: tab === "open" ? "var(--highlight)" : "var(--text-muted)"
                }}>
                  Active Drives ({openDrives.length})
                </button>
                <button onClick={() => setTab("applications")} style={{
                  padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 600, transition: "all 0.2s ease",
                  background: tab === "applications" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
                  color: tab === "applications" ? "var(--highlight)" : "var(--text-muted)"
                }}>
                  My Applications ({myApplications.length})
                </button>
              </div>
            )}

            {listError && <div className="error-msg">{listError}</div>}

            {fetching ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div className="spinner" style={{ margin: "0 auto" }} />
              </div>
            ) : (
              <>
                {isStudent && tab === "applications" && (
                  myApplications.length === 0 ? (
                    <div className="card" style={{ textAlign: "center", padding: 50 }}>
                      <p style={{ color: "var(--text-muted)" }}>You have not submitted any drive applications yet.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {myApplications.map(app => {
                        const drive = driveMap[app.driveId];
                        return (
                          <div key={app.id} className="card">
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                              <div>
                                <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
                                  {drive?.title || app.driveTitle}
                                </h3>
                                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                                  {drive?.company || app.company} • {drive?.role || app.role}
                                </div>
                                <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>
                                  Applied on {formatDate(app.appliedAt)}
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <StatusBadge status={app.status} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {(!isStudent || tab === "open") && (
                  (isStudent ? openDrives : visibleDrives).length === 0 ? (
                    <div className="card" style={{ textAlign: "center", padding: 50 }}>
                      <p style={{ color: "var(--text-muted)" }}>No placement drives currently available.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {(isStudent ? openDrives : visibleDrives).map(drive => {
                        const apps = applicationsByDrive[drive.id] || [];
                        const applied = apps.find(a => a.studentId === currentUser?.uid);
                        const closed = isClosed(drive) || drive.manuallyClosed;

                        return (
                          <div key={drive.id} className="card">
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                              <div style={{ flex: 1, minWidth: 220 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                                  <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700, color: "var(--text)" }}>{drive.title}</h3>
                                  {closed && <span className="badge badge-danger">Closed</span>}
                                </div>
                                <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 8 }}>
                                  <strong>{drive.company}</strong> • {drive.role}
                                </div>
                                <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)", flexWrap: "wrap" }}>
                                  {drive.package && <span><strong>Package:</strong> {drive.package}</span>}
                                  {drive.location && <span><strong>Location:</strong> {drive.location}</span>}
                                  {drive.minCgpa && <span><strong>Min CGPA:</strong> {drive.minCgpa}</span>}
                                </div>
                              </div>

                              <div style={{ textAlign: "right" }}>
                                {isStudent && (
                                  applied ? (
                                    <StatusBadge status={applied.status} />
                                  ) : (
                                    <button
                                      className="btn-primary"
                                      onClick={() => setApplyDriveId(drive.id)}
                                      disabled={closed}
                                      style={{ width: "auto" }}
                                    >
                                      Apply Now
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
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