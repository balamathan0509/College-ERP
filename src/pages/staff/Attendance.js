import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, where, getDocs, doc, setDoc } from "../../supabase/supabaseAdapter";
import toast, { Toaster } from "react-hot-toast";
import {
  CheckSquare,
  Users,
  CheckCircle2,
  Briefcase,
  XCircle,
  Calendar,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Clock,
  Layers,
  FileCheck
} from "lucide-react";
import { getDepartmentCalendar, getCalendarEventForDate } from "../../utils/academicCalendarUtils";
import {
  PERIOD_NUMBERS,
  normalizeYear,
  fetchDayPeriodAttendance,
  buildStudentMatrix
} from "../../utils/periodAttendanceUtils";
import { useNavigate } from "react-router-dom";

export default function StaffAttendance() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [selectedClassIdx, setSelectedClassIdx] = useState(0);

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [activeTab, setActiveTab] = useState("periods"); // "periods" | "daily"

  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [fetchingStudents, setFetchingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Period attendance state
  const [periodsMap, setPeriodsMap] = useState({});
  const [fetchingPeriods, setFetchingPeriods] = useState(false);

  // Academic Calendar event restriction state
  const [calendarBlockedEvent, setCalendarBlockedEvent] = useState(null);

  useEffect(() => {
    fetchAssignments();
  }, [userProfile]);

  async function fetchAssignments() {
    setLoadingAssignments(true);
    try {
      const uid = userProfile.uid;
      const today = selectedDate;

      // 1. Fetch Permanent Assignments
      const permQ = query(collection(db, "class_incharges"), where("facultyId", "==", uid));
      const permSnap = await getDocs(permQ);
      let permClasses = permSnap.docs.map(d => ({ ...d.data(), type: "Permanent" }));

      // 2. Filter out permanent classes that have an active substitute today
      const subExclusionQ = query(collection(db, "substitute_incharges"), where("permanentFacultyId", "==", uid));
      const subExclusionSnap = await getDocs(subExclusionQ);
      const activeExclusions = subExclusionSnap.docs
        .map(d => d.data())
        .filter(s => s.fromDate <= today && s.toDate >= today);

      permClasses = permClasses.filter(pc =>
        !activeExclusions.some(ex => ex.dept === pc.dept && ex.year === pc.year && ex.section === pc.section)
      );

      // 3. Fetch Substitute Assignments for this user
      const subActiveQ = query(collection(db, "substitute_incharges"), where("substituteFacultyId", "==", uid));
      const subActiveSnap = await getDocs(subActiveQ);
      const activeSubs = subActiveSnap.docs
        .map(d => d.data())
        .filter(s => s.fromDate <= today && s.toDate >= today)
        .map(s => ({ ...s, type: "Substitute" }));

      // Combine
      const allAssigned = [...permClasses, ...activeSubs].sort((a, b) => (a.year || "").localeCompare(b.year || ""));
      setAssignedClasses(allAssigned);
      if (allAssigned.length > 0) setSelectedClassIdx(0);
    } catch (err) {
      toast.error("Failed to fetch assigned classes.");
    }
    setLoadingAssignments(false);
  }

  const selectedClass = assignedClasses[selectedClassIdx];

  useEffect(() => {
    if (selectedClass) {
      fetchStudents(selectedClass);
      loadPeriods(selectedClass, selectedDate);
    }
  }, [selectedClassIdx, assignedClasses, selectedDate]);

  async function loadPeriods(cls, date) {
    if (!cls) return;
    setFetchingPeriods(true);
    try {
      const pMap = await fetchDayPeriodAttendance(cls.dept, cls.year, cls.section, date);
      setPeriodsMap(pMap);
    } catch (err) {
      console.warn("Failed to load period attendance:", err);
    }
    setFetchingPeriods(false);
  }

  async function fetchStudents(cls) {
    setFetchingStudents(true);
    setSaved(false);
    setCalendarBlockedEvent(null);
    try {
      // Check Department Academic Calendar
      const calData = await getDepartmentCalendar(cls.dept);
      if (calData) {
        const activeEvent = await getCalendarEventForDate(calData, selectedDate, cls.year);
        if (activeEvent && activeEvent.suspendClasses !== false) {
          setCalendarBlockedEvent(activeEvent);
        }
      }

      // Fetch all students for this department
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", cls.dept)
      );
      const snap = await getDocs(q);
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Match year flexibly
      const normalizedTargetYear = normalizeYear(cls.year);
      list = list.filter(st => {
        const stYear = normalizeYear(st.year || st.semester);
        return stYear === normalizedTargetYear;
      });

      // Match section if specified
      const sec = (cls.section || "").trim().toLowerCase();
      if (sec && sec !== "none" && sec !== "." && sec !== "all") {
        const filteredBySec = list.filter(st => {
          const sSec = (st.section || "").trim().toLowerCase();
          return !sSec || sSec === sec || sSec === "." || sSec === "none";
        });
        if (filteredBySec.length > 0) list = filteredBySec;
      }

      list.sort((a, b) => (a.registerNo || a.registerNumber || a.name || "").localeCompare(b.registerNo || b.registerNumber || b.name || ""));
      setStudents(list);

      // Fetch Daily Attendance record
      const docId = `${cls.dept}_${cls.year}_${cls.section}_${selectedDate}`.replace(/\s+/g, "_");
      const attQ = query(
        collection(db, "daily_attendance"),
        where("date", "==", selectedDate),
        where("dept", "==", cls.dept)
      );
      const attSnap = await getDocs(attQ);

      const matchingDaily = attSnap.docs.find(d => {
        const data = d.data();
        return normalizeYear(data.year) === normalizedTargetYear;
      });

      if (matchingDaily) {
        const records = matchingDaily.data().records || {};
        setAttendance(records);
        setSaved(true);
      } else {
        const defaultMap = {};
        list.forEach(s => { defaultMap[s.id] = "P"; });
        setAttendance(defaultMap);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch students.");
    }
    setFetchingStudents(false);
  }

  function handleStatusChange(studentId, status) {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
    setSaved(false);
  }

  function handleMarkAll(status) {
    const updated = {};
    students.forEach(s => { updated[s.id] = status; });
    setAttendance(updated);
    setSaved(false);
  }

  async function handleSave() {
    if (!selectedClass) return;
    setSaving(true);
    try {
      const docId = `${selectedClass.dept}_${selectedClass.year}_${selectedClass.section}_${selectedDate}`.replace(/\s+/g, "_");

      const rawRecords = {};
      Object.entries(attendance).forEach(([uid, st]) => { rawRecords[uid] = st; });

      await setDoc(doc(db, "daily_attendance", docId), {
        dept: selectedClass.dept,
        year: selectedClass.year,
        section: selectedClass.section,
        date: selectedDate,
        session: "Daily",
        records: rawRecords,
        totalCount: students.length,
        markedBy: userProfile.uid,
        markedByName: userProfile.name,
        assignmentType: selectedClass.type,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      toast.success("Daily attendance saved successfully!");
      setSaved(true);
    } catch (err) {
      toast.error("Save failed.");
    }
    setSaving(false);
  }

  // Sync 8-Period records into Daily Attendance
  function handleSyncPeriodsToDaily() {
    const matrix = buildStudentMatrix(students, periodsMap);
    const updated = {};
    matrix.forEach(row => {
      // If student was present for at least half the marked periods, mark P, else A
      if (row.totalMarked === 0) {
        updated[row.student.id] = "P";
      } else if (row.totalAttended >= Math.ceil(row.totalMarked / 2)) {
        updated[row.student.id] = row.odCount > row.presentCount ? "OD" : "P";
      } else {
        updated[row.student.id] = "A";
      }
    });

    setAttendance(updated);
    setActiveTab("daily");
    setSaved(false);
    toast.success("Synchronized from period records! Review and click Save.");
  }

  const presentCount = students.filter(s => attendance[s.id] === "P").length;
  const absentCount = students.filter(s => attendance[s.id] === "A").length;
  const odCount = students.filter(s => attendance[s.id] === "OD").length;
  const attendancePercentage = students.length ? Math.round(((presentCount + odCount) / students.length) * 100) : 0;

  const markedPeriodsCount = PERIOD_NUMBERS.filter(p => periodsMap[p] !== null).length;
  const matrixData = buildStudentMatrix(students, periodsMap);

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Class Incharge Attendance Portal</h1>
              <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 14 }}>
                Monitor live period-wise attendance marked by subject faculty and manage consolidated daily records
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  if (selectedClass) loadPeriods(selectedClass, selectedDate);
                }}
                disabled={fetchingPeriods}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}
              >
                <RefreshCw size={14} className={fetchingPeriods ? "animate-spin" : ""} /> Live Refresh
              </button>
            </div>
          </div>
        </div>

        {loadingAssignments ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Checking assignments...</div>
        ) : assignedClasses.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <Calendar size={48} color="var(--border)" style={{ marginBottom: 16 }} />
            <h3 style={{ color: "var(--text-muted)" }}>No Active Assignments</h3>
            <p style={{ color: "var(--text-muted)", marginTop: 8 }}>You are not currently assigned as a Class Incharge or Substitute for today.</p>
          </div>
        ) : (
          <>
            {/* Top Selector Card */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
                    My Assigned Class
                  </label>
                  <select
                    className="input-field"
                    style={{ width: "100%", padding: "10px 14px", fontSize: 15, fontWeight: 600 }}
                    value={selectedClassIdx}
                    onChange={e => setSelectedClassIdx(Number(e.target.value))}
                  >
                    {assignedClasses.map((cls, idx) => (
                      <option key={idx} value={idx}>
                        {cls.dept} • {cls.year} • Section {cls.section} ({cls.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ minWidth: 180 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>
                    Select Date
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", fontSize: 14, fontWeight: 600 }}
                  />
                </div>
              </div>
            </div>

            {/* Academic Calendar Notice Banner */}
            {calendarBlockedEvent && (
              <div style={{
                padding: "16px 20px",
                borderRadius: 12,
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 12
              }}>
                <AlertTriangle size={22} color="#f59e0b" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#b45309" }}>
                    Academic Calendar Notice: {calendarBlockedEvent.title}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                    This date ({selectedDate}) is listed in the Academic Calendar. Regular lectures may be suspended.
                  </div>
                </div>
              </div>
            )}

            {/* Tabs Toggle */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
              <button
                onClick={() => setActiveTab("periods")}
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
                  background: activeTab === "periods" ? "#2563eb" : "rgba(255,255,255,0.05)",
                  color: activeTab === "periods" ? "#ffffff" : "var(--text-muted)"
                }}
              >
                <Layers size={16} /> 8-Period Live Class Log ({markedPeriodsCount}/8 Completed)
              </button>

              <button
                onClick={() => setActiveTab("daily")}
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
                  background: activeTab === "daily" ? "#2563eb" : "rgba(255,255,255,0.05)",
                  color: activeTab === "daily" ? "#ffffff" : "var(--text-muted)"
                }}
              >
                <FileCheck size={16} /> Daily Consolidated Attendance
              </button>
            </div>

            {/* TAB 1: 8-PERIOD LIVE CLASS LOG */}
            {activeTab === "periods" && (
              <>
                {/* 8 Periods Timeline Cards */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                      Live Status of All 8 Periods ({selectedDate})
                    </h3>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      Updates automatically when subject faculty saves attendance
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

                {/* 8-Period Master Matrix Table */}
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text)" }}>
                        Student Attendance Matrix (Periods 1 to 8)
                      </h3>
                      <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>
                        Detailed period-by-period attendance for all {students.length} students of {selectedClass.dept} {selectedClass.year}
                      </p>
                    </div>

                    <button
                      className="btn-primary"
                      onClick={handleSyncPeriodsToDaily}
                      disabled={markedPeriodsCount === 0}
                      style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, background: "#4f46e5" }}
                    >
                      <FileCheck size={16} /> Sync Periods to Daily Attendance <ArrowRight size={14} />
                    </button>
                  </div>

                  {fetchingStudents ? (
                    <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading students...</div>
                  ) : students.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No students found in this class.</div>
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
              </>
            )}

            {/* TAB 2: DAILY CONSOLIDATED ATTENDANCE */}
            {activeTab === "daily" && (
              <>
                {students.length > 0 && !fetchingStudents && (
                  <div className="stats-grid" style={{ marginBottom: 24 }}>
                    <div className="stat-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <Users size={24} color="var(--highlight)" />
                      </div>
                      <div className="stat-value">{students.length}</div>
                      <div className="stat-label">Total Students</div>
                    </div>
                    <div className="stat-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <CheckCircle2 size={24} color="var(--success)" />
                      </div>
                      <div className="stat-value" style={{ color: "var(--success)" }}>{presentCount}</div>
                      <div className="stat-label">Present</div>
                    </div>
                    <div className="stat-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <Briefcase size={24} color="var(--warning)" />
                      </div>
                      <div className="stat-value" style={{ color: "var(--warning)" }}>{odCount}</div>
                      <div className="stat-label">On Duty (OD)</div>
                    </div>
                    <div className="stat-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <XCircle size={24} color="var(--danger)" />
                      </div>
                      <div className="stat-value" style={{ color: "var(--danger)" }}>{absentCount}</div>
                      <div className="stat-label">Absent</div>
                    </div>
                    <div className="stat-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <CheckSquare size={24} color="var(--highlight)" />
                      </div>
                      <div className="stat-value" style={{ color: "var(--highlight)" }}>{attendancePercentage}%</div>
                      <div className="stat-label">Attendance Rate</div>
                    </div>
                  </div>
                )}

                <div className="card">
                  {fetchingStudents ? (
                    <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading students...</div>
                  ) : students.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No students found in this class.</div>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button className="btn-secondary" onClick={() => handleMarkAll("P")} style={{ margin: 0, padding: "8px 14px", fontSize: 13, width: "auto" }}>
                            Mark All Present
                          </button>
                          <button className="btn-secondary" onClick={() => handleMarkAll("A")} style={{ margin: 0, padding: "8px 14px", fontSize: 13, width: "auto" }}>
                            Mark All Absent
                          </button>
                        </div>

                        <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ width: "auto", padding: "8px 24px", opacity: saved ? 0.7 : 1 }}>
                          {saving ? "Saving..." : saved ? "Update Today's Attendance" : "Save Today's Attendance"}
                        </button>
                      </div>

                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left", color: "var(--text-muted)" }}>
                              <th style={{ padding: 12 }}>S.No</th>
                              <th style={{ padding: 12 }}>Reg No</th>
                              <th style={{ padding: 12 }}>Student Name</th>
                              <th style={{ padding: 12, textAlign: "center" }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {students.map((student, idx) => {
                              const status = attendance[student.id] || "P";
                              return (
                                <tr key={student.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                  <td style={{ padding: 12, color: "var(--text-muted)" }}>{idx + 1}</td>
                                  <td style={{ padding: 12, fontFamily: "monospace", fontWeight: 600 }}>{student.registerNo || student.registerNumber || "N/A"}</td>
                                  <td style={{ padding: 12, fontWeight: 600 }}>{student.name}</td>
                                  <td style={{ padding: 12, textAlign: "center" }}>
                                    <div style={{ display: "inline-flex", gap: 4, background: "var(--bg-secondary)", padding: 4, borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                                      <button onClick={() => handleStatusChange(student.id, "P")} style={{ padding: "6px 16px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s", background: status === "P" ? "var(--success)" : "transparent", color: status === "P" ? "white" : "var(--text-muted)" }}>P</button>
                                      <button onClick={() => handleStatusChange(student.id, "OD")} style={{ padding: "6px 16px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s", background: status === "OD" ? "var(--warning)" : "transparent", color: status === "OD" ? "white" : "var(--text-muted)" }}>OD</button>
                                      <button onClick={() => handleStatusChange(student.id, "A")} style={{ padding: "6px 16px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s", background: status === "A" ? "var(--danger)" : "transparent", color: status === "A" ? "white" : "var(--text-muted)" }}>A</button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}