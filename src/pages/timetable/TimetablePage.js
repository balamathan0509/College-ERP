// src/pages/timetable/TimetablePage.js
import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

function timeToMinutes(value) {
  if (!value) return 0;
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTimeRange(start, end) {
  if (!start || !end) return "Time not set";
  return `${start} - ${end}`;
}

export default function TimetablePage() {
  const { currentUser, userProfile } = useAuth();
  const role = userProfile?.role;
  const isStudent = role === "student";
  const canCreate = role === "staff";

  const [entries, setEntries] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [listError, setListError] = useState("");
  const [dayFilter, setDayFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  const [form, setForm] = useState({
    year: "",
    day: "",
    startTime: "",
    endTime: "",
    subject: "",
    room: "",
    section: ""
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  useEffect(() => {
    if (!userProfile || !currentUser) return;
    fetchEntries();
  }, [userProfile, currentUser]);

  async function fetchEntries() {
    setFetching(true);
    setListError("");
    try {
      let q;
      if (role === "student") {
        q = query(
          collection(db, "timetable_entries"),
          where("dept", "==", userProfile.dept),
          where("year", "==", userProfile.year)
        );
      } else {
        q = query(
          collection(db, "timetable_entries"),
          where("dept", "==", userProfile.dept)
        );
      }
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      setEntries(list);
    } catch (err) {
      setListError("Failed to load timetable. Please try again.");
    }
    setFetching(false);
  }

  function handleFormChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!form.year || !form.day || !form.startTime || !form.endTime || !form.subject || !form.room) {
      return setFormError("Please fill all required fields.");
    }

    setSaving(true);
    try {
      await addDoc(collection(db, "timetable_entries"), {
        dept: userProfile.dept,
        year: form.year,
        day: form.day,
        startTime: form.startTime,
        endTime: form.endTime,
        subject: form.subject.trim(),
        room: form.room.trim(),
        section: form.section.trim(),
        staffName: userProfile.name,
        createdById: currentUser.uid,
        createdByRole: role,
        createdAt: new Date().toISOString()
      });
      setFormSuccess("Timetable entry created.");
      setForm({ year: "", day: "", startTime: "", endTime: "", subject: "", room: "", section: "" });
      fetchEntries();
    } catch (err) {
      setFormError("Failed to create entry. Try again.");
    }
    setSaving(false);
  }

  const visibleEntries = useMemo(() => {
    return entries.filter(entry => {
      const dayOk = dayFilter === "all" || entry.day === dayFilter;
      const yearOk = role !== "hod" || yearFilter === "all" || entry.year === yearFilter;
      return dayOk && yearOk;
    });
  }, [entries, dayFilter, yearFilter, role]);

  const grouped = useMemo(() => {
    const map = {};
    DAYS.forEach(day => { map[day] = []; });
    visibleEntries.forEach(entry => {
      if (!map[entry.day]) map[entry.day] = [];
      map[entry.day].push(entry);
    });
    Object.keys(map).forEach(day => {
      map[day].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    });
    return map;
  }, [visibleEntries]);

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Timetable</h1>
          <p>Role-based timetable view and management</p>
        </div>

        <div className={`timetable-layout ${canCreate ? "" : "single"}`}>
          {canCreate && (
            <div className="card" style={{ height: "fit-content" }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 20 }}>Create Timetable Entry</h3>
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
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label>Year</label>
                  <select name="year" value={form.year} onChange={handleFormChange}>
                    <option value="">Select Year</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Day</label>
                  <select name="day" value={form.day} onChange={handleFormChange}>
                    <option value="">Select Day</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Start Time</label>
                    <input type="time" name="startTime" value={form.startTime} onChange={handleFormChange} />
                  </div>
                  <div className="form-group">
                    <label>End Time</label>
                    <input type="time" name="endTime" value={form.endTime} onChange={handleFormChange} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Subject</label>
                  <input name="subject" value={form.subject} onChange={handleFormChange} placeholder="Subject name" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Room</label>
                    <input name="room" value={form.room} onChange={handleFormChange} placeholder="Room or lab" />
                  </div>
                  <div className="form-group">
                    <label>Section (optional)</label>
                    <input name="section" value={form.section} onChange={handleFormChange} placeholder="A / B" />
                  </div>
                </div>
                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Add Entry"}
                </button>
              </form>
            </div>
          )}

          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 6 }}>
                    {isStudent ? "My Timetable" : "Department Timetable"}
                  </h3>
                  <p style={{ color: "#a0aec0", fontSize: 13 }}>
                    {isStudent
                      ? `${userProfile?.dept} - ${userProfile?.year}`
                      : userProfile?.dept}
                  </p>
                </div>
                <button
                  onClick={fetchEntries}
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

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
                <div style={{ minWidth: 180 }}>
                  <label style={{ fontSize: 12, color: "#a0aec0" }}>Day</label>
                  <select value={dayFilter} onChange={e => setDayFilter(e.target.value)}>
                    <option value="all">All Days</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                {role === "hod" && (
                  <div style={{ minWidth: 180 }}>
                    <label style={{ fontSize: 12, color: "#a0aec0" }}>Year</label>
                    <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                      <option value="all">All Years</option>
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {listError && <div className="error-msg">{listError}</div>}

            {fetching ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {(dayFilter === "all" ? DAYS : [dayFilter]).map(day => (
                  <div key={day} className="card">
                    <div style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                      {day}
                    </div>
                    {grouped[day] && grouped[day].length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {grouped[day].map(entry => (
                          <div key={entry.id} style={{
                            padding: "12px 14px",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "rgba(255,255,255,0.03)",
                            display: "flex",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 10
                          }}>
                            <div>
                              <div style={{ fontWeight: 700 }}>
                                {entry.subject}
                                {entry.section ? ` - ${entry.section}` : ""}
                              </div>
                              <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>
                                {formatTimeRange(entry.startTime, entry.endTime)}
                                {" | "}
                                Room: {entry.room}
                              </div>
                              <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>
                                Staff: {entry.staffName}
                              </div>
                            </div>
                            {!isStudent && (
                              <div style={{ textAlign: "right", fontSize: 12, color: "#a0aec0" }}>
                                Year: {entry.year}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: "#a0aec0", fontSize: 13 }}>No classes scheduled.</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
