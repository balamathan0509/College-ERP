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
  { value: "open", label: "Open", color: "#f6ad55" },
  { value: "in_progress", label: "In Progress", color: "#4299e1" },
  { value: "resolved", label: "Resolved", color: "#48bb78" },
  { value: "rejected", label: "Rejected", color: "#fc8181" }
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
  const canManage = role === "staff" || role === "hod";

  const [complaints, setComplaints] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [listError, setListError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    category: "Academic",
    title: "",
    description: ""
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [actionState, setActionState] = useState({});

  useEffect(() => {
    if (!userProfile || !currentUser) return;
    fetchComplaints();
  }, [userProfile, currentUser]);

  async function fetchComplaints() {
    setFetching(true);
    setListError("");
    try {
      let q;
      if (role === "student") {
        q = query(
          collection(db, "complaints"),
          where("createdById", "==", currentUser.uid)
        );
      } else {
        q = query(
          collection(db, "complaints"),
          where("dept", "==", userProfile.dept)
        );
      }
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setComplaints(list);
    } catch (err) {
      setListError("Failed to load complaints. Please try again.");
    }
    setFetching(false);
  }

  function handleFormChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!currentUser || !userProfile) {
      return setFormError("Please wait for your profile to load.");
    }
    if (!form.title.trim() || !form.description.trim()) {
      return setFormError("Please fill all fields.");
    }

    setSaving(true);
    try {
      await addDoc(collection(db, "complaints"), {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        status: "open",
        dept: userProfile.dept,
        year: userProfile.year || "",
        registerNo: userProfile.registerNo || "",
        createdById: currentUser.uid,
        createdByName: userProfile.name,
        createdByRole: role,
        createdAt: new Date().toISOString(),
        actionNote: "",
        actionByName: "",
        actionByRole: "",
        actionAt: ""
      });
      setFormSuccess("Complaint submitted successfully.");
      setForm({ category: "Academic", title: "", description: "" });
      fetchComplaints();
    } catch (err) {
      setFormError("Failed to submit complaint. Try again.");
    }
    setSaving(false);
  }

  function updateActionState(id, updates) {
    setActionState(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
  }

  async function saveAction(complaint) {
    const current = actionState[complaint.id] || {};
    const newStatus = current.status || complaint.status || "open";
    const note = (current.note || "").trim();

    updateActionState(complaint.id, { saving: true });
    try {
      const payload = {
        status: newStatus,
        actionByName: userProfile.name,
        actionByRole: role,
        actionAt: new Date().toISOString()
      };
      if (note) {
        payload.actionNote = note;
      }
      await updateDoc(doc(db, "complaints", complaint.id), payload);
      setComplaints(prev =>
        prev.map(c => {
          if (c.id !== complaint.id) return c;
          return {
            ...c,
            ...payload,
            actionNote: note ? note : c.actionNote
          };
        })
      );
      updateActionState(complaint.id, { saving: false, note: "" });
    } catch (err) {
      setListError("Failed to update complaint. Please try again.");
      updateActionState(complaint.id, { saving: false });
    }
  }

  const filteredComplaints = useMemo(() => {
    return complaints.filter(c => {
      const matchesStatus = filterStatus === "all" || c.status === filterStatus;
      const searchText = search.trim().toLowerCase();
      if (!searchText) return matchesStatus;
      const hay = `${c.title || ""} ${c.description || ""} ${c.category || ""}`.toLowerCase();
      return matchesStatus && hay.includes(searchText);
    });
  }, [complaints, filterStatus, search]);

  const statusMap = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s.value] = s;
    return acc;
  }, {});

  const openCount = complaints.filter(c => c.status === "open").length;
  const progressCount = complaints.filter(c => c.status === "in_progress").length;
  const resolvedCount = complaints.filter(c => c.status === "resolved").length;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Complaints</h1>
          <p>Raise and track complaints based on your role</p>
        </div>

        <div className={`complaints-layout ${canCreate ? "" : "single"}`}>
          {canCreate && (
            <div className="card" style={{ height: "fit-content" }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 20 }}>File a Complaint</h3>
              {formError && <div className="error-msg">{formError}</div>}
              {formSuccess && (
                <div style={{
                  background: "rgba(72,187,120,0.1)",
                  border: "1px solid rgba(72,187,120,0.3)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  color: "#48bb78",
                  fontSize: 14,
                  marginBottom: 20
                }}>
                  {formSuccess}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Category</label>
                  <select name="category" value={form.category} onChange={handleFormChange}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    name="title"
                    placeholder="Short summary"
                    value={form.title}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    name="description"
                    rows={5}
                    placeholder="Explain the issue in detail"
                    value={form.description}
                    onChange={handleFormChange}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 12,
                      color: "white",
                      fontSize: 15,
                      fontFamily: "DM Sans, sans-serif",
                      outline: "none",
                      resize: "vertical"
                    }}
                  />
                </div>
                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Submitting..." : "Submit Complaint"}
                </button>
              </form>
            </div>
          )}

          <div>
            {canManage && (
              <div className="stats-grid" style={{ marginBottom: 20 }}>
                <div className="stat-card">
                  <div className="stat-value">{openCount}</div>
                  <div className="stat-label">Open</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{progressCount}</div>
                  <div className="stat-label">In Progress</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{resolvedCount}</div>
                  <div className="stat-label">Resolved</div>
                </div>
              </div>
            )}

            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 6 }}>
                    {role === "student" ? "My Complaints" : "Department Complaints"}
                  </h3>
                  <p style={{ color: "#a0aec0", fontSize: 13 }}>
                    {role === "student"
                      ? `${userProfile?.dept} - ${userProfile?.year}`
                      : userProfile?.dept}
                  </p>
                </div>
                <button
                  onClick={fetchComplaints}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.05)",
                    color: "white",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600
                  }}
                >
                  Refresh
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                <button
                  onClick={() => setFilterStatus("all")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: filterStatus === "all" ? "rgba(233,69,96,0.2)" : "transparent",
                    color: "white",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  All
                </button>
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setFilterStatus(s.value)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      border: `1px solid ${s.color}55`,
                      background: filterStatus === s.value ? `${s.color}22` : "transparent",
                      color: s.color,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 16 }}>
                <input
                  type="text"
                  placeholder="Search complaints..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 10,
                    color: "white",
                    fontSize: 14,
                    outline: "none"
                  }}
                />
              </div>
            </div>

            {listError && <div className="error-msg">{listError}</div>}

            {fetching ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : filteredComplaints.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 60 }}>
                <div style={{ fontSize: 16, marginBottom: 12 }}>No complaints found</div>
                <p style={{ color: "#a0aec0" }}>Nothing to show for the selected filters.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {filteredComplaints.map(c => {
                  const meta = statusMap[c.status] || STATUS_OPTIONS[0];
                  const action = actionState[c.id] || { status: c.status, note: "" };
                  return (
                    <div key={c.id} className="card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
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
                            <span style={{ fontSize: 12, color: "#a0aec0" }}>{c.category}</span>
                          </div>
                          <div style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                            {c.title}
                          </div>
                          <div style={{ color: "#a0aec0", fontSize: 14, lineHeight: 1.6 }}>
                            {c.description}
                          </div>
                        </div>

                        <div style={{ minWidth: 200, textAlign: "right" }}>
                          <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 6 }}>
                            {formatDate(c.createdAt)}
                          </div>
                          <div style={{ fontSize: 12, color: "#a0aec0" }}>
                            {c.createdByName}
                            {c.registerNo ? ` - ${c.registerNo}` : ""}
                          </div>
                          {c.year && (
                            <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>
                              {c.year}
                            </div>
                          )}
                        </div>
                      </div>

                      {c.actionNote && (
                        <div style={{
                          marginTop: 14,
                          padding: "10px 14px",
                          borderRadius: 10,
                          background: "rgba(255,255,255,0.05)",
                          border: "1px dashed rgba(255,255,255,0.15)",
                          color: "#cbd5e0",
                          fontSize: 13
                        }}>
                          <div style={{ fontWeight: 600, marginBottom: 6 }}>Latest Update</div>
                          <div>{c.actionNote}</div>
                          {c.actionByName && (
                            <div style={{ marginTop: 6, fontSize: 12, color: "#a0aec0" }}>
                              {c.actionByName} - {c.actionByRole?.toUpperCase()} - {formatDate(c.actionAt)}
                            </div>
                          )}
                        </div>
                      )}

                      {canManage && (
                        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <select
                            value={action.status || c.status}
                            onChange={e => updateActionState(c.id, { status: e.target.value })}
                            style={{ minWidth: 160 }}
                          >
                            {STATUS_OPTIONS.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Action note (optional)"
                            value={action.note || ""}
                            onChange={e => updateActionState(c.id, { note: e.target.value })}
                            style={{ flex: 1, minWidth: 220 }}
                          />
                          <button
                            onClick={() => saveAction(c)}
                            disabled={action.saving}
                            style={{
                              padding: "10px 16px",
                              borderRadius: 10,
                              border: "1px solid rgba(233,69,96,0.4)",
                              background: "rgba(233,69,96,0.2)",
                              color: "#e94560",
                              cursor: "pointer",
                              fontWeight: 600,
                              minWidth: 120
                            }}
                          >
                            {action.saving ? "Saving..." : "Update"}
                          </button>
                        </div>
                      )}
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
