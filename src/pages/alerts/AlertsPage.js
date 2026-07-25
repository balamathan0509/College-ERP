// src/pages/alerts/AlertsPage.js
import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { notifyStudentAlert } from "../../utils/notifications";
import {
  Bell,
  Megaphone,
  RefreshCw,
  Search,
  PlusCircle,
  CheckCircle2,
  Inbox
} from "lucide-react";

const ALERT_TYPES = [
  { value: "leave", label: "Leave Alert", color: "var(--warning)" },
  { value: "circular", label: "Circular", color: "var(--highlight)" },
  { value: "general", label: "General", color: "var(--success)" }
];

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

function formatDate(value) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function isVisibleToUser(alert, userProfile) {
  if (!userProfile) return false;
  const role = userProfile.role;
  const dept = userProfile.dept;
  const year = userProfile.year;

  let roleOk = alert.roleTarget === "all" || alert.roleTarget === role;
  if (alert.roleTarget === "hod_only") roleOk = role === "hod";
  else if (alert.roleTarget === "staff_hod") roleOk = role === "staff" || role === "hod";

  const deptOk = alert.deptTarget === "all" || alert.deptTarget === dept;

  if (role !== "student") {
    return roleOk && deptOk;
  }
  const yearOk = alert.yearTarget === "all" || alert.yearTarget === year;
  return roleOk && deptOk && yearOk;
}

function getAudienceLabel(alert) {
  let roleLabel = alert.roleTarget === "all"
    ? "Common to All"
    : alert.roleTarget?.toUpperCase();

  if (alert.roleTarget === "hod_only") roleLabel = "All Dept HODs Only";
  if (alert.roleTarget === "staff_hod") roleLabel = "All Staff and HODs";

  const deptLabel = alert.deptTarget === "all"
    ? "All Depts"
    : alert.deptTarget;

  const yearLabel = alert.yearTarget === "all"
    ? "All Years"
    : alert.yearTarget;

  if (alert.roleTarget === "student") {
    return `${roleLabel} • ${deptLabel} • ${yearLabel}`;
  }

  return `${roleLabel} • ${deptLabel}`;
}

export default function AlertsPage() {
  const { currentUser, userProfile } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  const [form, setForm] = useState({
    type: "leave",
    targetRole: "student",
    deptScope: "dept",
    title: "",
    message: "",
    targetYear: "all"
  });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const role = userProfile?.role || "student";
  const canCreate = role === "staff" || role === "hod" || role === "principal" || role === "officestaff" || role === "warden" || role === "admin" || role === "management";

  async function fetchAlerts() {
    setFetching(true);
    setListError("");
    try {
      const snap = await getDocs(collection(db, "alerts"));
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const visible = list.filter(alert => isVisibleToUser(alert, userProfile));
      visible.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setAlerts(visible);
    } catch (err) {
      console.error(err);
      setListError("Failed to fetch alerts.");
    }
    setFetching(false);
  }

  useEffect(() => {
    if (userProfile) {
      fetchAlerts();
    }
  }, [userProfile]);

  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!form.title.trim() || !form.message.trim()) {
      setFormError("Title and message are required.");
      return;
    }

    setSaving(true);
    try {
      let deptTarget = userProfile?.dept || "all";
      if (role === "principal") {
        deptTarget = "all";
      } else if (role === "hod" && form.deptScope === "all") {
        deptTarget = "all";
      }

      const roleTarget = role === "principal"
        ? (form.targetRole || "all")
        : (form.targetRole || "all");

      const yearTarget = (roleTarget === "student" || roleTarget === "all")
        ? form.targetYear
        : "all";

      const newAlert = {
        type: form.type,
        roleTarget,
        deptTarget,
        yearTarget,
        title: form.title.trim(),
        message: form.message.trim(),
        createdById: currentUser?.uid || "",
        createdByName: userProfile?.name || "Staff",
        createdByRole: role,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "alerts"), newAlert);

      if (roleTarget === "student" || roleTarget === "all") {
        notifyStudentAlert({
          title: form.title.trim(),
          message: form.message.trim(),
          targetDept: deptTarget,
          targetYear: yearTarget
        });
      }

      setFormSuccess("Alert broadcasted successfully!");
      setForm(prev => ({
        ...prev,
        title: "",
        message: "",
        targetYear: "all"
      }));
      fetchAlerts();
    } catch (err) {
      setFormError("Failed to send alert. Try again.");
    }
    setSaving(false);
  }

  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      const matchesType = filterType === "all" || alert.type === filterType;
      const searchText = search.trim().toLowerCase();
      if (!searchText) return matchesType;
      const hay = `${alert.title || ""} ${alert.message || ""}`.toLowerCase();
      return matchesType && hay.includes(searchText);
    });
  }, [alerts, filterType, search]);

  const typeStyles = ALERT_TYPES.reduce((acc, t) => {
    acc[t.value] = t;
    return acc;
  }, {});

  const roleOptions = role === "principal"
    ? [
      { value: "hod_only", label: "All Dept HODs Only" },
      { value: "staff_hod", label: "All Staff and HODs" },
      { value: "all", label: "Common to All" }
    ]
    : role === "hod"
    ? [
      { value: "student", label: "Students" },
      { value: "staff", label: "Staff" },
      { value: "hod", label: "HOD" },
      { value: "all", label: "All Roles" }
    ]
    : [
      { value: "student", label: "Students" },
      { value: "staff", label: "Staff" }
    ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Alerts & Broadcast Center</h1>
          <p>Institutional announcements, circulars, and role-based notifications</p>
        </div>

        <div className={`alerts-layout ${canCreate ? "" : "single"}`}>
          {canCreate && (
            <div className="card" style={{ height: "fit-content" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <PlusCircle size={20} color="var(--highlight)" />
                <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>Create Alert</h3>
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
                  <label>Alert Category *</label>
                  <select name="type" value={form.type} onChange={handleFormChange}>
                    {ALERT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Title *</label>
                  <input
                    type="text"
                    name="title"
                    placeholder="Short, clear title"
                    value={form.title}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Message Content *</label>
                  <textarea
                    name="message"
                    rows={4}
                    placeholder="Write the complete announcement details..."
                    value={form.message}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Target Audience *</label>
                  <select name="targetRole" value={form.targetRole} onChange={handleFormChange}>
                    {roleOptions.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
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

                {(form.targetRole === "student" || form.targetRole === "all") && (
                  <div className="form-group">
                    <label>Year Filter</label>
                    <select name="targetYear" value={form.targetYear} onChange={handleFormChange}>
                      <option value="all">All Years</option>
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                )}

                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Broadcasting..." : "Broadcast Alert"}
                </button>
              </form>
            </div>
          )}

          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>Latest Alerts</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
                    {role === "student" ? `${userProfile?.dept} • ${userProfile?.year}` : userProfile?.dept || "All Departments"}
                  </p>
                </div>
                <button
                  onClick={fetchAlerts}
                  className="btn-secondary"
                  style={{ margin: 0, padding: "8px 16px", fontSize: 13, width: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                <button
                  onClick={() => setFilterType("all")}
                  style={{
                    padding: "6px 14px", borderRadius: 20, border: "none",
                    background: filterType === "all" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
                    color: filterType === "all" ? "var(--highlight)" : "var(--text-muted)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease"
                  }}
                >
                  All
                </button>
                {ALERT_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setFilterType(t.value)}
                    style={{
                      padding: "6px 14px", borderRadius: 20, border: "none",
                      background: filterType === t.value ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
                      color: filterType === t.value ? t.color : "var(--text-muted)",
                      fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease"
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 16 }}>
                <input
                  type="text"
                  placeholder="Search alerts by title or content..."
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
            ) : filteredAlerts.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 50 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                  <Inbox size={48} color="var(--text-muted)" />
                </div>
                <p style={{ color: "var(--text-muted)" }}>No alerts match your current view.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {filteredAlerts.map(alert => {
                  const typeMeta = typeStyles[alert.type] || ALERT_TYPES[0];
                  const createdByMe = alert.createdById === currentUser?.uid;
                  return (
                    <div key={alert.id} className="card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                            <span className="badge" style={{
                              background: "rgba(37, 99, 235, 0.14)", color: typeMeta.color,
                              border: "1px solid rgba(37, 99, 235, 0.3)"
                            }}>
                              {typeMeta.label}
                            </span>
                            {createdByMe && (
                              <span className="badge badge-success">You</span>
                            )}
                          </div>
                          <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>
                            {alert.title}
                          </h3>
                          <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6 }}>
                            {alert.message}
                          </p>
                        </div>

                        <div style={{ minWidth: 180, textAlign: "right" }}>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                            {getAudienceLabel(alert)}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {formatDate(alert.createdAt)}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--highlight)", fontWeight: 600, marginTop: 6 }}>
                            {alert.createdByName} • {alert.createdByRole?.toUpperCase()}
                          </div>
                        </div>
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
