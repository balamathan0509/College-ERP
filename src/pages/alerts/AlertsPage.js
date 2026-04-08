// src/pages/alerts/AlertsPage.js
import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { notifyStudentAlert } from "../../utils/notifications";

const ALERT_TYPES = [
  { value: "leave", label: "Leave Alert", color: "#f6ad55" },
  { value: "circular", label: "Circular", color: "#4299e1" },
  { value: "general", label: "General", color: "#48bb78" }
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

  const roleOk = alert.roleTarget === "all" || alert.roleTarget === role;
  const deptOk = alert.deptTarget === "all" || alert.deptTarget === dept;

  if (role !== "student") {
    return roleOk && deptOk;
  }
  const yearOk = alert.yearTarget === "all" || alert.yearTarget === year;
  return roleOk && deptOk && yearOk;
}

function getAudienceLabel(alert) {
  const roleLabel = alert.roleTarget === "all"
    ? "All Roles"
    : alert.roleTarget?.toUpperCase();
  const deptLabel = alert.deptTarget === "all" ? "All Departments" : alert.deptTarget;
  const yearLabel = alert.yearTarget === "all" ? "All Years" : alert.yearTarget;

  if (alert.roleTarget === "student") {
    return `${roleLabel} - ${deptLabel} - ${yearLabel}`;
  }
  return `${roleLabel} - ${deptLabel}`;
}

export default function AlertsPage() {
  const { currentUser, userProfile } = useAuth();
  const role = userProfile?.role;
  const canCreate = role === "staff" || role === "hod";

  const [alerts, setAlerts] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [listError, setListError] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    type: "circular",
    title: "",
    message: "",
    targetRole: "student",
    targetYear: "all",
    deptScope: "dept"
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  useEffect(() => {
    if (!userProfile) return;
    fetchAlerts();
  }, [userProfile]);

  useEffect(() => {
    if (form.targetRole !== "student" && form.targetYear !== "all") {
      setForm(prev => ({ ...prev, targetYear: "all" }));
    }
  }, [form.targetRole]);

  async function fetchAlerts() {
    setFetching(true);
    setListError("");
    try {
      const snap = await getDocs(collection(db, "alerts"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const visible = list.filter(a => isVisibleToUser(a, userProfile));
      setAlerts(visible);
      if (currentUser && visible.length > 0) {
        localStorage.setItem(`alerts_last_seen_${currentUser.uid}`, visible[0].createdAt);
      }
    } catch (err) {
      setListError("Failed to load alerts. Please try again.");
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

    if (!form.title.trim() || !form.message.trim()) {
      return setFormError("Please fill all fields.");
    }

    const deptTarget = role === "hod" && form.deptScope === "all"
      ? "all"
      : userProfile?.dept;
    const yearTarget = form.targetRole === "student" ? form.targetYear : "all";

    setSaving(true);
    try {
      await addDoc(collection(db, "alerts"), {
        title: form.title.trim(),
        message: form.message.trim(),
        type: form.type,
        roleTarget: form.targetRole,
        deptTarget,
        yearTarget,
        createdById: currentUser.uid,
        createdByName: userProfile?.name || "Staff",
        createdByRole: role,
        createdByDept: userProfile?.dept || "",
        createdAt: new Date().toISOString()
      });

      // 📧 Send SMS + Email to all targeted students
      if (form.targetRole === "student") {
        try {
          // Build query for target students
          let studentQuery;
          if (deptTarget === "all" && yearTarget === "all") {
            studentQuery = query(collection(db, "users"), where("role", "==", "student"));
          } else if (deptTarget === "all") {
            studentQuery = query(
              collection(db, "users"),
              where("role", "==", "student"),
              where("year", "==", yearTarget)
            );
          } else if (yearTarget === "all") {
            studentQuery = query(
              collection(db, "users"),
              where("role", "==", "student"),
              where("dept", "==", deptTarget)
            );
          } else {
            studentQuery = query(
              collection(db, "users"),
              where("role", "==", "student"),
              where("dept", "==", deptTarget),
              where("year", "==", yearTarget)
            );
          }

          const studSnap = await getDocs(studentQuery);
          const students = studSnap.docs.map(d => ({ id: d.id, ...d.data() }));

          // Send notification to each student
          for (const student of students) {
            await notifyStudentAlert({
              email: student.email || "",
              phone: student.phone || "",
              name: student.name,
              title: form.title.trim(),
              message: form.message.trim()
            });
          }
          console.log(`✅ Notifications sent to ${students.length} student(s)`);
        } catch (notifyErr) {
          console.error("Error sending notifications:", notifyErr);
        }
      }

      setFormSuccess("Alert sent successfully and notifications sent to students!");
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

  const roleOptions = role === "hod"
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
          <h1>Alerts Center</h1>
          <p>Share leave alerts, circulars, and announcements based on role</p>
        </div>

        <div className={`alerts-layout ${canCreate ? "" : "single"}`}>
          {canCreate && (
            <div className="card" style={{ height: "fit-content" }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 20 }}>Create Alert</h3>
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
                  <label>Alert Type</label>
                  <select name="type" value={form.type} onChange={handleFormChange}>
                    {ALERT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    name="title"
                    placeholder="Short, clear title"
                    value={form.title}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-group">
                  <label>Message</label>
                  <textarea
                    name="message"
                    rows={4}
                    placeholder="Write the alert details..."
                    value={form.message}
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

                <div className="form-group">
                  <label>Send To</label>
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

                {form.targetRole === "student" && (
                  <div className="form-group">
                    <label>Year</label>
                    <select name="targetYear" value={form.targetYear} onChange={handleFormChange}>
                      <option value="all">All Years</option>
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                )}

                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Sending..." : "Send Alert"}
                </button>
              </form>
            </div>
          )}

          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 6 }}>Latest Alerts</h3>
                  <p style={{ color: "#a0aec0", fontSize: 13 }}>
                    {role === "student" ? `${userProfile?.dept} - ${userProfile?.year}` : userProfile?.dept}
                  </p>
                </div>
                <button
                  onClick={fetchAlerts}
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
                  onClick={() => setFilterType("all")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: filterType === "all" ? "rgba(233,69,96,0.2)" : "transparent",
                    color: "white",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  All
                </button>
                {ALERT_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setFilterType(t.value)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      border: `1px solid ${t.color}55`,
                      background: filterType === t.value ? `${t.color}22` : "transparent",
                      color: t.color,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 16 }}>
                <input
                  type="text"
                  placeholder="Search alerts..."
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
            ) : filteredAlerts.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 60 }}>
                <div style={{ fontSize: 42, marginBottom: 12 }}>No Alerts</div>
                <p style={{ color: "#a0aec0" }}>Nothing to show for the selected filters.</p>
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
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                            <span style={{
                              padding: "4px 10px",
                              borderRadius: 20,
                              background: `${typeMeta.color}22`,
                              color: typeMeta.color,
                              fontSize: 12,
                              fontWeight: 700
                            }}>
                              {typeMeta.label}
                            </span>
                            {createdByMe && (
                              <span style={{
                                padding: "4px 10px",
                                borderRadius: 20,
                                background: "rgba(233,69,96,0.2)",
                                color: "#e94560",
                                fontSize: 12,
                                fontWeight: 700
                              }}>
                                You
                              </span>
                            )}
                          </div>
                          <div style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                            {alert.title}
                          </div>
                          <div style={{ color: "#a0aec0", fontSize: 14, lineHeight: 1.6 }}>
                            {alert.message}
                          </div>
                        </div>

                        <div style={{ minWidth: 180, textAlign: "right" }}>
                          <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 6 }}>
                            {getAudienceLabel(alert)}
                          </div>
                          <div style={{ fontSize: 12, color: "#a0aec0" }}>
                            {formatDate(alert.createdAt)}
                          </div>
                          <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 6 }}>
                            {alert.createdByName} - {alert.createdByRole?.toUpperCase()}
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
