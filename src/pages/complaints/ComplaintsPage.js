// src/pages/complaints/ComplaintsPage.js
import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where
} from "firebase/firestore";
import {
  MessageSquareWarning,
  PlusCircle,
  CheckCircle2,
  RefreshCw,
  Clock,
  XCircle,
  Inbox,
  AlertTriangle
} from "lucide-react";

const CATEGORIES = [
  "Academic",
  "Hostel",
  "Transport",
  "Fees",
  "Facilities",
  "Discipline",
  "Other"
];

const STATUS_OPTIONS = [
  { value: "open", label: "Open", color: "var(--warning)" },
  { value: "in_progress", label: "In Progress", color: "var(--highlight)" },
  { value: "resolved", label: "Resolved", color: "var(--success)" },
  { value: "rejected", label: "Rejected", color: "var(--danger)" }
];

function formatDate(value) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function ComplaintsPage() {
  const { currentUser, userProfile } = useAuth();
  const role = userProfile?.role;
  const canCreate = role === "student";
  const canManage = role === "staff" || role === "hod" || role === "management" || role === "principal" || role === "admin" || role === "warden" || role === "officestaff";

  const [complaints, setComplaints] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [listError, setListError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    category: CATEGORIES[0],
    title: "",
    description: ""
  });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [updatingId, setUpdatingId] = useState(null);
  const [updateStatus, setUpdateStatus] = useState("open");
  const [updateRemark, setUpdateRemark] = useState("");

  async function fetchComplaints() {
    setFetching(true);
    setListError("");
    try {
      let q;
      if (role === "student") {
        q = query(collection(db, "complaints"), where("studentId", "==", currentUser?.uid));
      } else if (role === "staff" || role === "hod") {
        q = query(collection(db, "complaints"), where("dept", "==", userProfile?.dept));
      } else {
        q = collection(db, "complaints");
      }

      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setComplaints(list);
    } catch (err) {
      console.error(err);
      setListError("Failed to fetch complaints.");
    }
    setFetching(false);
  }

  useEffect(() => {
    if (userProfile) {
      fetchComplaints();
    }
  }, [userProfile]);

  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!form.title.trim() || !form.description.trim()) {
      setFormError("Title and description are required.");
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, "complaints"), {
        studentId: currentUser?.uid || "",
        studentName: userProfile?.name || "Student",
        registerNo: userProfile?.registerNo || "N/A",
        dept: userProfile?.dept || "",
        year: userProfile?.year || "",
        category: form.category,
        title: form.title.trim(),
        description: form.description.trim(),
        status: "open",
        createdAt: new Date().toISOString()
      });

      setFormSuccess("Complaint registered successfully!");
      setForm({
        category: CATEGORIES[0],
        title: "",
        description: ""
      });
      fetchComplaints();
    } catch (err) {
      setFormError("Failed to register complaint. Try again.");
    }
    setSaving(false);
  }

  async function handleStatusUpdate(complaintId) {
    if (!updateRemark.trim()) {
      alert("Please provide a remark before updating status.");
      return;
    }

    setUpdatingId(complaintId);
    try {
      const docRef = doc(db, "complaints", complaintId);
      await updateDoc(docRef, {
        status: updateStatus,
        remark: updateRemark.trim(),
        updatedAt: new Date().toISOString(),
        updatedByName: userProfile?.name || "Staff",
        updatedByRole: role
      });

      setUpdateRemark("");
      setUpdatingId(null);
      fetchComplaints();
    } catch (err) {
      console.error(err);
      alert("Failed to update status.");
      setUpdatingId(null);
    }
  }

  const filteredComplaints = useMemo(() => {
    return complaints.filter(item => {
      const matchesStatus = filterStatus === "all" || item.status === filterStatus;
      const searchText = search.trim().toLowerCase();
      if (!searchText) return matchesStatus;
      const hay = `${item.title || ""} ${item.description || ""} ${item.category || ""}`.toLowerCase();
      return matchesStatus && hay.includes(searchText);
    });
  }, [complaints, filterStatus, search]);

  const statusMeta = STATUS_OPTIONS.reduce((acc, item) => {
    acc[item.value] = item;
    return acc;
  }, {});

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Grievance & Complaints Desk</h1>
          <p>Lodge, track, and resolve institutional student grievances</p>
        </div>

        <div className={`complaints-layout ${canCreate ? "" : "single"}`}>
          {canCreate && (
            <div className="card" style={{ height: "fit-content" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <PlusCircle size={20} color="var(--highlight)" />
                <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>File a Complaint</h3>
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

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Category *</label>
                  <select name="category" value={form.category} onChange={handleFormChange}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Title / Subject *</label>
                  <input
                    type="text"
                    name="title"
                    placeholder="Short summary of grievance"
                    value={form.title}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Description *</label>
                  <textarea
                    name="description"
                    rows={5}
                    placeholder="Explain the issue in detail..."
                    value={form.description}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Submitting..." : "Submit Complaint"}
                </button>
              </form>
            </div>
          )}

          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>Registered Complaints</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
                    {role === "student" ? "Your filed grievances" : `${userProfile?.dept || "All Departments"} Scope`}
                  </p>
                </div>
                <button
                  onClick={fetchComplaints}
                  className="btn-secondary"
                  style={{ margin: 0, padding: "8px 16px", fontSize: 13, width: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                <button
                  onClick={() => setFilterStatus("all")}
                  style={{
                    padding: "6px 14px", borderRadius: 20, border: "none",
                    background: filterStatus === "all" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
                    color: filterStatus === "all" ? "var(--highlight)" : "var(--text-muted)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease"
                  }}
                >
                  All ({complaints.length})
                </button>
                {STATUS_OPTIONS.map(s => {
                  const count = complaints.filter(c => c.status === s.value).length;
                  return (
                    <button
                      key={s.value}
                      onClick={() => setFilterStatus(s.value)}
                      style={{
                        padding: "6px 14px", borderRadius: 20, border: "none",
                        background: filterStatus === s.value ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
                        color: filterStatus === s.value ? s.color : "var(--text-muted)",
                        fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease"
                      }}
                    >
                      {s.label} ({count})
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 16 }}>
                <input
                  type="text"
                  placeholder="Search complaints by title or category..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            {listError && <div className="error-msg">{listError}</div>}

            {fetching ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : filteredComplaints.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 50 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                  <Inbox size={48} color="var(--text-muted)" />
                </div>
                <p style={{ color: "var(--text-muted)" }}>No complaints found matching selection.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {filteredComplaints.map(item => {
                  const statusInfo = statusMeta[item.status] || STATUS_OPTIONS[0];

                  return (
                    <div key={item.id} className="card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                            <span className="badge" style={{
                              background: "rgba(37, 99, 235, 0.14)", color: "var(--highlight)",
                              border: "1px solid rgba(37, 99, 235, 0.3)"
                            }}>
                              {item.category}
                            </span>
                            <span className="badge" style={{
                              background: `${statusInfo.color}20`, color: statusInfo.color,
                              border: `1px solid ${statusInfo.color}40`
                            }}>
                              {statusInfo.label}
                            </span>
                          </div>

                          <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>
                            {item.title}
                          </h3>
                          <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
                            {item.description}
                          </p>

                          {item.remark && (
                            <div style={{
                              padding: "10px 14px", borderRadius: "var(--radius-sm)",
                              background: "rgba(37, 99, 235, 0.1)", border: "1px solid rgba(37, 99, 235, 0.2)",
                              color: "var(--text)", fontSize: 13, marginBottom: 12
                            }}>
                              <strong>Staff Remark ({item.updatedByName}):</strong> {item.remark}
                            </div>
                          )}

                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            By {item.studentName} ({item.registerNo}) • {item.dept} Yr {item.year} • {formatDate(item.createdAt)}
                          </div>
                        </div>

                        {canManage && (
                          <div style={{ minWidth: 220, background: "rgba(11, 19, 43, 0.4)", padding: 14, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>Update Status</div>
                            <select
                              value={updateStatus}
                              onChange={e => setUpdateStatus(e.target.value)}
                              style={{ padding: "6px 10px", fontSize: 12, marginBottom: 8 }}
                            >
                              {STATUS_OPTIONS.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="Enter action remark"
                              value={updateRemark}
                              onChange={e => setUpdateRemark(e.target.value)}
                              style={{ padding: "6px 10px", fontSize: 12, marginBottom: 10 }}
                            />
                            <button
                              className="btn-primary"
                              onClick={() => handleStatusUpdate(item.id)}
                              disabled={updatingId === item.id}
                              style={{ padding: "6px 12px", fontSize: 12 }}
                            >
                              {updatingId === item.id ? "Saving..." : "Save Status"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
