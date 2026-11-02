// src/pages/hod/Attendance.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, where, getDocs } from "../../supabase/supabaseAdapter";
import {
  CheckSquare,
  Users,
  CheckCircle2,
  Briefcase,
  XCircle,
  PieChart,
  AlertTriangle,
  Inbox,
  RefreshCw,
  Layers,
  FileCheck,
  Calendar
} from "lucide-react";

import { getCalendarEventForDate } from "../../utils/academicCalendarUtils";
import {
  PERIOD_NUMBERS,
  normalizeYear,
  fetchDayPeriodAttendance,
  buildStudentMatrix
} from "../../utils/periodAttendanceUtils";

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const SECTIONS = ["All", "A", "B", "None"];

export default function HodAttendance() {
  const { userProfile } = useAuth();
  const [selectedYear, setSelectedYear] = useState("4th Year"); // Default to 4th Year where testing occurred
  const [selectedSection, setSelectedSection] = useState("All");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);

  const [tab, setTab] = useState("periods"); // "periods" | "daily" | "alerts"
  const [calendarEvent, setCalendarEvent] = useState(null);

  // Daily records state
  const [records, setRecords] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [students, setStudents] = useState([]);
  const [fetching, setFetching] = useState(false);

  // Period attendance state
  const [periodsMap, setPeriodsMap] = useState({});
  const [fetchingPeriods, setFetchingPeriods] = useState(false);

  // Fetch 8-period records
  async function fetchPeriodData() {
    if (!userProfile?.dept) return;
    setFetchingPeriods(true);
    try {
      const pMap = await fetchDayPeriodAttendance(userProfile.dept, selectedYear, selectedSection, selectedDate);
      setPeriodsMap(pMap);

      // Fetch students for this year
      const sq = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", userProfile.dept)
      );
      const sSnap = await getDocs(sq);
      let list = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const targetYearNorm = normalizeYear(selectedYear);
      list = list.filter(st => {
        const stYear = normalizeYear(st.year || st.semester);
        return stYear === targetYearNorm;
      });

      if (selectedSection && selectedSection !== "All") {
        list = list.filter(st => {
          const sSec = (st.section || "").trim().toLowerCase();
          const targetSec = selectedSection.trim().toLowerCase();
          return sSec === targetSec || (!st.section && targetSec === "none") || sSec === ".";
        });
      }

      list.sort((a, b) => (a.registerNo || a.registerNumber || a.name || "").localeCompare(b.registerNo || b.registerNumber || b.name || ""));
      setStudents(list);
    } catch (err) {
      console.warn("Failed to fetch period data:", err);
    }
    setFetchingPeriods(false);
  }

  // Fetch Daily Attendance
  async function fetchDailyAttendance() {
    setFetching(true);
    try {
      if (userProfile?.dept) {
        const calEv = await getCalendarEventForDate(userProfile.dept, selectedDate);
        setCalendarEvent(calEv);
      } else {
        setCalendarEvent(null);
      }

      const q = query(
        collection(db, "attendance"),
        where("dept", "==", userProfile.dept),
        where("year", "==", selectedYear),
        where("date", "==", selectedDate)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setRecords(snap.docs[0].data());
      } else {
        // Fallback to daily_attendance
        const dq = query(
          collection(db, "daily_attendance"),
          where("dept", "==", userProfile.dept),
          where("date", "==", selectedDate)
        );
        const dSnap = await getDocs(dq);
        const match = dSnap.docs.find(d => normalizeYear(d.data().year) === normalizeYear(selectedYear));
        if (match) {
          setRecords(match.data());
        } else {
          setRecords(null);
        }
      }

      const sq = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", userProfile.dept)
      );
      const sSnap = await getDocs(sq);
      let list = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const targetYearNorm = normalizeYear(selectedYear);
      list = list.filter(st => normalizeYear(st.year || st.semester) === targetYearNorm);
      list.sort((a, b) => (a.registerNo || a.registerNumber || a.name || "").localeCompare(b.registerNo || b.registerNumber || b.name || ""));
      setStudents(list);
    } catch (err) {}
    setFetching(false);
  }

  async function fetchAlerts() {
    setFetching(true);
    try {
      const q = query(
        collection(db, "attendance_alerts"),
        where("dept", "==", userProfile?.dept || "")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAlerts(list);
    } catch (err) {}
    setFetching(false);
  }

  useEffect(() => {
    if (tab === "periods") fetchPeriodData();
    if (tab === "daily") fetchDailyAttendance();
    if (tab === "alerts") fetchAlerts();
  }, [selectedYear, selectedSection, selectedDate, tab]);

  const rawRecs = records?.records || {};
  const presentStudents = students.filter(s => rawRecs[s.id] === "P" || rawRecs[s.id] === true);
  const absentStudents = students.filter(s => rawRecs[s.id] === "A" || rawRecs[s.id] === false);
  const odStudents = students.filter(s => rawRecs[s.id] === "OD");

  const presentPercentage = records?.totalCount
    ? Math.round(((presentStudents.length + odStudents.length) / records.totalCount) * 100)
    : 0;

  const markedPeriodsCount = PERIOD_NUMBERS.filter(p => periodsMap[p] !== null).length;
  const matrixData = buildStudentMatrix(students, periodsMap);

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Department Attendance Monitor</h1>
              <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 14 }}>
                {userProfile?.dept} Department • HOD Real-time Period & Daily Attendance Monitoring
              </p>
            </div>
            {tab === "periods" && (
              <button
                className="btn-secondary"
                onClick={fetchPeriodData}
                disabled={fetchingPeriods}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}
              >
                <RefreshCw size={14} className={fetchingPeriods ? "animate-spin" : ""} /> Live Refresh
              </button>
            )}
          </div>
        </div>

        {/* Tab Toggle */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
          <button
            onClick={() => setTab("periods")}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.2s ease",
              background: tab === "periods" ? "#2563eb" : "rgba(255,255,255,0.05)",
              color: tab === "periods" ? "#ffffff" : "var(--text-muted)"
            }}
          >
            <Layers size={16} /> 8-Period Live Monitor ({markedPeriodsCount}/8 Marked)
          </button>

          <button
            onClick={() => setTab("daily")}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.2s ease",
              background: tab === "daily" ? "#2563eb" : "rgba(255,255,255,0.05)",
              color: tab === "daily" ? "#ffffff" : "var(--text-muted)"
            }}
          >
            <FileCheck size={16} /> Daily Attendance Log
          </button>

          <button
            onClick={() => setTab("alerts")}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.2s ease",
              background: tab === "alerts" ? "#2563eb" : "rgba(255,255,255,0.05)",
              color: tab === "alerts" ? "#ffffff" : "var(--text-muted)"
            }}
          >
            <AlertTriangle size={16} /> Low Attendance Alerts ({alerts.length})
          </button>
        </div>

        {/* Global Filter Card */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="form-row" style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div className="form-group" style={{ margin: 0, minWidth: 160, flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>
                Select Year
              </label>
              <select
                className="input-field"
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", fontSize: 14, fontWeight: 600 }}
              >
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {tab === "periods" && (
              <div className="form-group" style={{ margin: 0, minWidth: 140 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>
                  Section
                </label>
                <select
                  className="input-field"
                  value={selectedSection}
                  onChange={e => setSelectedSection(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", fontSize: 14, fontWeight: 600 }}
                >
                  {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>
                Select Date
              </label>
              <input
                type="date"
                className="input-field"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", fontSize: 14, fontWeight: 600 }}
              />
            </div>
          </div>
        </div>

        {/* TAB 1: 8-PERIOD LIVE MONITOR */}
        {tab === "periods" && (
          <div>
            {/* 8 Periods Status Cards */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                  {userProfile?.dept} • {selectedYear} • 8-Period Status ({selectedDate})
                </h3>
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
                  {markedPeriodsCount} of 8 Periods Conducted
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
                {PERIOD_NUMBERS.map(pNum => {
                  const p = periodsMap[pNum];
                  const isMarked = !!p;

                  return (
                    <div
                      key={pNum}
                      className="card"
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        border: isMarked ? "1.5px solid #10b981" : "1px dashed var(--border)",
                        background: isMarked ? "rgba(16, 185, 129, 0.04)" : "var(--card-bg)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 14, color: isMarked ? "#059669" : "var(--text-muted)" }}>
                            Period {pNum}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "3px 8px",
                              borderRadius: 12,
                              background: isMarked ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.12)",
                              color: isMarked ? "#10b981" : "var(--text-muted)"
                            }}
                          >
                            {isMarked ? "Marked" : "Pending"}
                          </span>
                        </div>

                        {isMarked ? (
                          <>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                              {p.subjectCode} {p.subjectName ? `• ${p.subjectName}` : ""}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                              Faculty: <strong>{p.markedByName || "Staff"}</strong>
                              {p.isAltered && (
                                <span style={{ color: "#d97706", display: "block", fontSize: 11 }}>
                                  (Proxy for {p.originalFacultyName})
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", marginTop: 4 }}>
                            Awaiting faculty submission...
                          </div>
                        )}
                      </div>

                      {isMarked && (
                        <div style={{ display: "flex", gap: 10, marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.06)", fontSize: 12 }}>
                          <span style={{ color: "#16a34a", fontWeight: 700 }}>P: {p.presentCount || 0}</span>
                          <span style={{ color: "#dc2626", fontWeight: 700 }}>A: {p.absentCount || 0}</span>
                          {p.odCount > 0 && <span style={{ color: "#d97706", fontWeight: 700 }}>OD: {p.odCount}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Matrix Sheet */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text)" }}>
                    Period-wise Student Attendance Sheet
                  </h3>
                  <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>
                    {userProfile?.dept} • {selectedYear} • {students.length} students enrolled
                  </p>
                </div>
              </div>

              {fetchingPeriods ? (
                <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
                  <div className="spinner" style={{ margin: "0 auto 12px" }}></div>
                  Loading period attendance records...
                </div>
              ) : students.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                  No students found in {selectedYear}.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left", color: "var(--text-muted)", fontSize: 12 }}>
                        <th style={{ padding: "10px 8px" }}>#</th>
                        <th style={{ padding: "10px 8px" }}>Reg No</th>
                        <th style={{ padding: "10px 8px" }}>Student Name</th>
                        {PERIOD_NUMBERS.map(pNum => (
                          <th key={pNum} style={{ padding: "10px 6px", textAlign: "center", background: periodsMap[pNum] ? "rgba(16, 185, 129, 0.05)" : "transparent" }}>
                            P{pNum}
                          </th>
                        ))}
                        <th style={{ padding: "10px 8px", textAlign: "center" }}>Attended</th>
                        <th style={{ padding: "10px 8px", textAlign: "center" }}>Day Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrixData.map(row => (
                        <tr key={row.student.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "10px 8px", color: "var(--text-muted)", fontSize: 12 }}>{row.index}</td>
                          <td style={{ padding: "10px 8px", fontFamily: "monospace", fontWeight: 600, fontSize: 13 }}>
                            {row.student.registerNo || row.student.registerNumber || "N/A"}
                          </td>
                          <td style={{ padding: "10px 8px", fontWeight: 600, fontSize: 13 }}>
                            {row.student.name}
                          </td>

                          {PERIOD_NUMBERS.map(pNum => {
                            const st = row.periodStatuses[pNum];
                            const isGreen = st === "P";
                            const isRed = st === "A";
                            const isAmber = st === "OD";

                            return (
                              <td key={pNum} style={{ padding: "8px 4px", textAlign: "center" }}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    width: 28,
                                    height: 26,
                                    lineHeight: "26px",
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 800,
                                    background: isGreen
                                      ? "#dcfce7"
                                      : isRed
                                      ? "#fee2e2"
                                      : isAmber
                                      ? "#fef3c7"
                                      : "rgba(0,0,0,0.04)",
                                    color: isGreen
                                      ? "#15803d"
                                      : isRed
                                      ? "#b91c1c"
                                      : isAmber
                                      ? "#b45309"
                                      : "var(--text-muted)"
                                  }}
                                >
                                  {st}
                                </span>
                              </td>
                            );
                          })}

                          <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, fontSize: 13 }}>
                            <span style={{ color: row.totalAttended === row.totalMarked ? "#16a34a" : row.absentCount > 0 ? "#dc2626" : "var(--text)" }}>
                              {row.totalAttended} / {row.totalMarked || 8}
                            </span>
                          </td>

                          <td style={{ padding: "10px 8px", textAlign: "center" }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 12,
                                background: row.dayStatus === "Full Present"
                                  ? "rgba(16, 185, 129, 0.12)"
                                  : row.dayStatus === "Partial Present"
                                  ? "rgba(245, 158, 11, 0.12)"
                                  : row.dayStatus === "Absent"
                                  ? "rgba(239, 68, 68, 0.12)"
                                  : "rgba(100, 116, 139, 0.1)",
                                color: row.dayStatus === "Full Present"
                                  ? "#10b981"
                                  : row.dayStatus === "Partial Present"
                                  ? "#d97706"
                                  : row.dayStatus === "Absent"
                                  ? "#ef4444"
                                  : "var(--text-muted)"
                              }}
                            >
                              {row.dayStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DAILY ATTENDANCE LOG */}
        {tab === "daily" && (
          <div>
            {/* Calendar Event Alert */}
            {calendarEvent && (
              <div style={{
                padding: "16px 20px", borderRadius: "var(--radius-md)", marginBottom: 24,
                background: calendarEvent.type === "holiday" ? "rgba(239, 68, 68, 0.1)" : "rgba(245, 158, 11, 0.1)",
                border: calendarEvent.type === "holiday" ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
                display: "flex", alignItems: "center", gap: 14
              }}>
                <Calendar size={22} color={calendarEvent.type === "holiday" ? "#ef4444" : "#f59e0b"} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: calendarEvent.type === "holiday" ? "#dc2626" : "#b45309" }}>
                    Academic Calendar Event: {calendarEvent.title} ({calendarEvent.type.toUpperCase()})
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                    This selected date ({selectedDate}) is listed in the {userProfile?.dept} Department Academic Calendar.
                  </div>
                </div>
              </div>
            )}

            {fetching ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : records ? (
              <>
                {/* Stats */}
                <div className="stats-grid" style={{ marginBottom: 24 }}>
                  <div className="stat-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <Users size={24} color="var(--highlight)" />
                    </div>
                    <div className="stat-value">{records.totalCount}</div>
                    <div className="stat-label">Total Enrolled</div>
                  </div>
                  <div className="stat-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <CheckCircle2 size={24} color="var(--success)" />
                    </div>
                    <div className="stat-value" style={{ color: "var(--success)" }}>{presentStudents.length}</div>
                    <div className="stat-label">Present</div>
                  </div>
                  <div className="stat-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <Briefcase size={24} color="var(--warning)" />
                    </div>
                    <div className="stat-value" style={{ color: "var(--warning)" }}>{odStudents.length}</div>
                    <div className="stat-label">On Duty (OD)</div>
                  </div>
                  <div className="stat-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <XCircle size={24} color="var(--danger)" />
                    </div>
                    <div className="stat-value" style={{ color: "var(--danger)" }}>{absentStudents.length}</div>
                    <div className="stat-label">Absent</div>
                  </div>
                  <div className="stat-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <PieChart size={24} color={presentPercentage >= 75 ? "var(--success)" : "var(--danger)"} />
                    </div>
                    <div className="stat-value" style={{ color: presentPercentage >= 75 ? "var(--success)" : "var(--danger)" }}>
                      {presentPercentage}%
                    </div>
                    <div className="stat-label">Attendance Rate</div>
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 20 }}>
                    {selectedYear} • Date: {selectedDate}
                  </h3>

                  {absentStudents.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 13, color: "var(--danger)", fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                        <XCircle size={16} /> Absent Students ({absentStudents.length})
                      </div>
                      {absentStudents.map((s, i) => (
                        <div key={s.id} style={{
                          display: "flex", justifyContent: "space-between",
                          padding: "12px 16px", borderRadius: "var(--radius-sm)", marginBottom: 8,
                          background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.25)"
                        }}>
                          <span style={{ fontWeight: 600, color: "var(--text)" }}>{i + 1}. {s.name}</span>
                          <span style={{ color: "var(--text-muted)", fontSize: 13, fontFamily: "monospace" }}>{s.registerNo}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {presentStudents.length > 0 && (
                    <div>
                      <div style={{ fontSize: 13, color: "var(--success)", fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                        <CheckCircle2 size={16} /> Present Students ({presentStudents.length})
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                        {presentStudents.map(s => (
                          <div key={s.id} style={{
                            padding: "10px 14px", borderRadius: "var(--radius-sm)",
                            background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.25)",
                            fontSize: 13, fontWeight: 500, color: "var(--text)"
                          }}>
                            {s.name} <span style={{ opacity: 0.7, fontSize: 12 }}>({s.registerNo})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="card" style={{ textAlign: "center", padding: 50 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                  <Inbox size={48} color="var(--text-muted)" />
                </div>
                <p style={{ color: "var(--text-muted)" }}>Attendance not marked for {selectedYear} on {selectedDate}.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LOW ATTENDANCE ALERTS */}
        {tab === "alerts" && (
          <div>
            {fetching ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : alerts.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 50 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                  <Inbox size={48} color="var(--text-muted)" />
                </div>
                <p style={{ color: "var(--text-muted)" }}>No low attendance alerts recorded for {userProfile?.dept}.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {alerts.map(a => (
                  <div key={a.id} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <AlertTriangle size={18} color="var(--danger)" />
                          <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                            {a.studentName} ({a.registerNo})
                          </h3>
                          <span className="badge badge-danger">{a.percentage}% Attendance</span>
                        </div>
                        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 4 }}>
                          Year {a.year} • {userProfile?.dept} Department
                        </p>
                        <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
                          Triggered on: {new Date(a.createdAt).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}