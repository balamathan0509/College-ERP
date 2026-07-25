// src/pages/staff/Timetable.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import {
  Calendar,
  FileSpreadsheet,
  Clock,
  Coffee,
  Utensils,
  Plus,
  Trash2,
  Save,
  Upload
} from "lucide-react";

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SECTIONS = ["FN (10:00AM - 11:30AM)", "AN (2:30PM - 4:00PM)"];

const PERIODS = [
  { label: "9:10 - 9:55", isBreak: false },
  { label: "9:55 - 10:40", isBreak: false },
  { label: "10:45 - 11:00", isBreak: true, breakLabel: "Short Break" },
  { label: "11:00 - 11:45", isBreak: false },
  { label: "11:45 - 12:30", isBreak: false },
  { label: "12:50 - 1:30", isBreak: true, breakLabel: "Lunch Break" },
  { label: "1:30 - 2:15", isBreak: false },
  { label: "2:15 - 3:00", isBreak: false },
  { label: "2:50 - 3:00", isBreak: true, breakLabel: "Short Break" },
  { label: "3:00 - 3:45", isBreak: false },
  { label: "3:45 - 4:20", isBreak: false }
];

const emptyExamRow = (year = "") => ({
  date: "",
  section: "FN (10:00AM - 11:30AM)",
  subCode: "",
  subjectName: "",
  year,
});

export default function StaffTimetable() {
  const { userProfile } = useAuth();
  const [tab, setTab] = useState("regular");
  const [selectedYear, setSelectedYear] = useState("");

  // Regular Tab States
  const [timetable, setTimetable] = useState({});
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Exam Tab States
  const [examType, setExamType] = useState("Internal Exam");
  const [examRows, setExamRows] = useState([emptyExamRow("")]);
  const [examFetching, setExamFetching] = useState(false);
  const [examSaving, setExamSaving] = useState(false);
  const [examSaved, setExamSaved] = useState(false);

  async function fetchTimetable() {
    if (!selectedYear) return;
    setFetching(true);
    setSaved(false);
    try {
      const q = query(
        collection(db, "timetable"),
        where("dept", "==", userProfile.dept),
        where("year", "==", selectedYear),
        where("type", "==", "Regular")
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setTimetable(snap.docs[0].data().schedule || {});
      } else {
        const initial = {};
        DAYS.forEach(day => {
          initial[day] = {};
          PERIODS.forEach(p => { if (!p.isBreak) initial[day][p.label] = ""; });
        });
        setTimetable(initial);
      }
    } catch (err) {}
    setFetching(false);
  }

  function handleCellChange(day, periodLabel, val) {
    setTimetable(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        [periodLabel]: val
      }
    }));
    setSaved(false);
  }

  async function handleSaveRegular() {
    if (!selectedYear) return;
    setSaving(true);
    try {
      const docId = `${userProfile.dept}_${selectedYear}_Regular`.replace(/\s+/g, "_");
      await setDoc(doc(db, "timetable", docId), {
        dept: userProfile.dept,
        year: selectedYear,
        type: "Regular",
        schedule: timetable,
        updatedAt: new Date().toISOString(),
        updatedBy: userProfile.name
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {}
    setSaving(false);
  }

  async function fetchExamSchedule() {
    if (!selectedYear) return;
    setExamFetching(true);
    setExamSaved(false);
    try {
      const q = query(
        collection(db, "timetable"),
        where("dept", "==", userProfile.dept),
        where("year", "==", selectedYear),
        where("type", "==", "Exam"),
        where("examType", "==", examType)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const rows = snap.docs[0].data().examRows || [];
        setExamRows(rows.length > 0 ? rows : [emptyExamRow(selectedYear)]);
      } else {
        setExamRows([emptyExamRow(selectedYear)]);
      }
    } catch (err) {}
    setExamFetching(false);
  }

  function updateExamRow(idx, field, val) {
    setExamRows(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
    setExamSaved(false);
  }

  function addExamRow() {
    setExamRows(prev => [...prev, emptyExamRow(selectedYear)]);
    setExamSaved(false);
  }

  function removeExamRow(idx) {
    if (examRows.length === 1) return;
    setExamRows(prev => prev.filter((_, i) => i !== idx));
    setExamSaved(false);
  }

  async function handleSaveExam() {
    if (!selectedYear) return;
    setExamSaving(true);
    try {
      const docId = `${userProfile.dept}_${selectedYear}_Exam_${examType}`.replace(/\s+/g, "_");
      await setDoc(doc(db, "timetable", docId), {
        dept: userProfile.dept,
        year: selectedYear,
        type: "Exam",
        examType,
        examRows,
        updatedAt: new Date().toISOString(),
        updatedBy: userProfile.name
      }, { merge: true });
      setExamSaved(true);
      setTimeout(() => setExamSaved(false), 3000);
    } catch (err) {}
    setExamSaving(false);
  }

  useEffect(() => {
    if (selectedYear) {
      if (tab === "regular") fetchTimetable();
      else fetchExamSchedule();
    }
  }, [selectedYear, tab, examType]);

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Timetable & Exam Scheduling</h1>
          <p>{userProfile?.dept} Department • Faculty Portal</p>
        </div>

        {/* Tab Toggle */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
          <button
            onClick={() => setTab("regular")}
            style={{
              padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.2s ease",
              background: tab === "regular" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
              color: tab === "regular" ? "var(--highlight)" : "var(--text-muted)"
            }}
          >
            Class Timetable Editor
          </button>
          <button
            onClick={() => setTab("exam")}
            style={{
              padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.2s ease",
              background: tab === "exam" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
              color: tab === "exam" ? "var(--highlight)" : "var(--text-muted)"
            }}
          >
            Exam Schedule Editor
          </button>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="form-row">
            <div className="form-group" style={{ margin: 0 }}>
              <label>Select Year *</label>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                <option value="">Choose Year</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {tab === "exam" && (
              <div className="form-group" style={{ margin: 0 }}>
                <label>Exam Type *</label>
                <select value={examType} onChange={e => setExamType(e.target.value)}>
                  <option value="Internal Exam">Internal Exam</option>
                  <option value="Model Exam">Model Exam</option>
                  <option value="Semester Exam">Semester Exam</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Regular Timetable Editor */}
        {tab === "regular" && selectedYear && (
          <div className="card">
            {fetching ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
                  <div>
                    <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>
                      Class Schedule Matrix ({userProfile?.dept} • {selectedYear})
                    </h3>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>Edit subject codes per period block</p>
                  </div>

                  <button
                    className="btn-primary"
                    onClick={handleSaveRegular}
                    disabled={saving}
                    style={{ width: "auto", padding: "8px 24px" }}
                  >
                    {saving ? "Publishing..." : saved ? "Published!" : "Publish Timetable"}
                  </button>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ minWidth: 110 }}>Day</th>
                        {PERIODS.map((p, i) => (
                          <th key={i} style={{
                            textAlign: "center", fontSize: 11,
                            minWidth: p.isBreak ? 80 : 110,
                            color: p.isBreak ? "var(--warning)" : "var(--text-muted)",
                            background: p.isBreak ? "rgba(245,158,11,0.06)" : "transparent"
                          }}>
                            {p.isBreak ? p.breakLabel : p.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map(day => (
                        <tr key={day}>
                          <td style={{ fontWeight: 700 }}>{day}</td>
                          {PERIODS.map((period, i) => {
                            const val = timetable[day]?.[period.label] || "";
                            return (
                              <td key={i} style={{ padding: "6px", textAlign: "center", background: period.isBreak ? "rgba(245,158,11,0.04)" : "transparent" }}>
                                {period.isBreak ? (
                                  <div style={{ color: "var(--warning)", fontSize: 11 }}>{period.breakLabel}</div>
                                ) : (
                                  <input
                                    type="text"
                                    placeholder="Subject"
                                    value={val}
                                    onChange={e => handleCellChange(day, period.label, e.target.value)}
                                    style={{ padding: "6px 8px", fontSize: 12, textAlign: "center" }}
                                  />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Exam Schedule Editor */}
        {tab === "exam" && selectedYear && (
          <div className="card">
            {examFetching ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
                  <div>
                    <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>
                      {examType} Timetable ({selectedYear})
                    </h3>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>Define exam dates, sessions, & subject codes</p>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      className="btn-secondary"
                      onClick={addExamRow}
                      style={{ margin: 0, padding: "8px 14px", fontSize: 13, width: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Plus size={14} /> Add Row
                    </button>
                    <button
                      className="btn-primary"
                      onClick={handleSaveExam}
                      disabled={examSaving}
                      style={{ width: "auto", padding: "8px 24px" }}
                    >
                      {examSaving ? "Publishing..." : examSaved ? "Published!" : "Publish Schedule"}
                    </button>
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>#</th>
                        <th>Exam Date</th>
                        <th>Session</th>
                        <th>Subject Code</th>
                        <th>Subject Title</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {examRows.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                          <td>
                            <input
                              type="date"
                              value={row.date || ""}
                              onChange={e => updateExamRow(idx, "date", e.target.value)}
                              style={{ padding: "6px 8px", fontSize: 12 }}
                            />
                          </td>
                          <td>
                            <select
                              value={row.session || SECTIONS[0]}
                              onChange={e => updateExamRow(idx, "session", e.target.value)}
                              style={{ padding: "6px 8px", fontSize: 12 }}
                            >
                              {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              placeholder="e.g. CS8591"
                              value={row.code || ""}
                              onChange={e => updateExamRow(idx, "code", e.target.value)}
                              style={{ padding: "6px 8px", fontSize: 12, fontFamily: "monospace" }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              placeholder="Subject name"
                              value={row.subject || ""}
                              onChange={e => updateExamRow(idx, "subject", e.target.value)}
                              style={{ padding: "6px 8px", fontSize: 12 }}
                            />
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              onClick={() => removeExamRow(idx)}
                              disabled={examRows.length === 1}
                              style={{
                                background: "rgba(239, 68, 68, 0.12)", border: "none", color: "var(--danger)",
                                padding: "6px 10px", borderRadius: "var(--radius-sm)", cursor: "pointer"
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}