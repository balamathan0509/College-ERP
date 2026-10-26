import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, where, getDocs, doc, getDoc, setDoc, addDoc } from "../../supabase/supabaseAdapter";
import { normalizeYear, fetchDayPeriodAttendance, PERIOD_NUMBERS } from "../../utils/periodAttendanceUtils";
import toast, { Toaster } from "react-hot-toast";
import { CheckSquare, Users, CheckCircle2, XCircle, Briefcase, Clock, ArrowRight, ArrowLeftRight, FileText } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function PeriodAttendance() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Query params support (for direct redirection from timetable or alteration)
  const searchParams = new URLSearchParams(location.search);
  const paramDate = searchParams.get("date");
  const paramPeriod = searchParams.get("period");
  const paramDept = searchParams.get("dept");
  const paramYear = searchParams.get("year");
  const paramSection = searchParams.get("section");
  const paramCode = searchParams.get("code");

  const [date, setDate] = useState(() => paramDate || new Date().toISOString().split("T")[0]);
  const [dayName, setDayName] = useState("");
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);

  // Custom filter if no slot selected
  const [manualMode, setManualMode] = useState(false);
  const [manualDept, setManualDept] = useState(paramDept || "");
  const [manualYear, setManualYear] = useState(paramYear || "III");
  const [manualSection, setManualSection] = useState(paramSection || "A");
  const [manualPeriod, setManualPeriod] = useState(paramPeriod ? Number(paramPeriod) : 1);
  const [manualSubject, setManualSubject] = useState(paramCode || "");

  // Student list & Attendance state
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [fetchingStudents, setFetchingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dayPeriodsMap, setDayPeriodsMap] = useState({});

  // Month name calculation
  const dateObj = new Date(date);
  const monthName = dateObj.toLocaleString("default", { month: "long" });

  useEffect(() => {
    if (date) {
      const d = new Date(date);
      setDayName(DAYS[d.getDay()]);
      loadScheduleForDate(date, DAYS[d.getDay()]);
    }
  }, [date, userProfile]);

  async function loadScheduleForDate(targetDate, day) {
    if (!userProfile?.uid) return;
    setLoadingSchedule(true);
    try {
      const userUid = userProfile.uid;
      const userName = (userProfile.name || "").trim().toLowerCase();
      const userEmail = (userProfile.email || "").trim().toLowerCase();

      // 1. Fetch all timetable slots for this day
      const snap = await getDocs(collection(db, "timetable_slots"));
      const daySlots = [];
      snap.docs.forEach(d => {
        const data = d.data();
        if (data && data.day === day) {
          daySlots.push({ id: d.id, ...data });
        }
      });

      // 2. Fetch alterations for this date
      const altQ = query(collection(db, "hour_alterations"), where("date", "==", targetDate), where("status", "==", "Approved"));
      const altSnap = await getDocs(altQ);
      const approvedAlts = altSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Find alterations where user is original faculty (transferred OUT)
      const transferredOutPeriodMap = new Set(
        approvedAlts.filter(a => a.originalFacultyId === userUid).map(a => Number(a.period))
      );

      // Find alterations where user is substitute faculty (transferred IN)
      const transferredInSlots = approvedAlts
        .filter(a => a.substituteFacultyId === userUid)
        .map(a => ({
          period: Number(a.period),
          dept: a.dept,
          year: a.year || a.semester,
          semester: a.semester || a.year,
          section: a.section || "A",
          subject_code: a.subjectCode,
          subject_name: a.subjectName,
          isAltered: true,
          originalFacultyName: a.originalFacultyName
        }));

      // 3. User's permanent slots for today (excluding transferred out)
      const myPermanentSlots = [];
      daySlots.forEach(slot => {
        const staffUid = slot.staff_uid;
        const staffName = (slot.staff_name || "").trim().toLowerCase();
        const staffEmail = (slot.staff_email || "").trim().toLowerCase();

        const matches = (staffUid && String(staffUid) === String(userUid)) ||
          (staffEmail && staffEmail === userEmail) ||
          (staffName && userName && (staffName === userName || staffName.includes(userName) || userName.includes(staffName)));

        if (matches) {
          // If this period was altered to someone else today, skip
          if (!transferredOutPeriodMap.has(Number(slot.period))) {
            myPermanentSlots.push({
              period: Number(slot.period),
              dept: slot.dept,
              year: slot.year || slot.semester,
              semester: slot.semester || slot.year,
              section: slot.section || "A",
              subject_code: slot.subject_code,
              subject_name: slot.subject_name,
              isAltered: false
            });
          }
        }
      });

      // Combine and sort by period
      const combined = [...myPermanentSlots, ...transferredInSlots].sort((a, b) => a.period - b.period);
      setTodaySchedule(combined);

      if (combined.length > 0) {
        // If paramPeriod provided, try to select that
        if (paramPeriod) {
          const matchIdx = combined.findIndex(c => Number(c.period) === Number(paramPeriod));
          setSelectedSlotIndex(matchIdx >= 0 ? matchIdx : 0);
        } else {
          setSelectedSlotIndex(0);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load today's lecture schedule.");
    }
    setLoadingSchedule(false);
  }

  const activeSlot = manualMode
    ? {
        period: manualPeriod,
        dept: manualDept || userProfile?.dept || "CSE",
        year: manualYear,
        section: manualSection,
        subject_code: manualSubject || "Course Lecture",
        subject_name: "",
        isAltered: false
      }
    : todaySchedule[selectedSlotIndex];

  function getPossibleYearKeys(val) {
    if (!val) return [];
    const s = String(val).trim().toUpperCase();
    const num = parseInt(s, 10);
    if (num === 7 || num === 8 || s === "IV" || s === "4" || s.includes("FINAL") || s.includes("4TH") || s.includes("IV")) {
      return ["IV", "4", "4TH YEAR", "IV YEAR", "FINAL YEAR", "7", "8"];
    }
    if (num === 5 || num === 6 || s === "III" || s === "3" || s.includes("3RD") || s.includes("III")) {
      return ["III", "3", "3RD YEAR", "III YEAR", "5", "6"];
    }
    if (num === 3 || num === 4 || s === "II" || s === "2" || s.includes("2ND") || s.includes("II")) {
      return ["II", "2", "2ND YEAR", "II YEAR", "3", "4"];
    }
    if (num === 1 || num === 2 || s === "I" || s === "1" || s.includes("1ST") || s.includes("I")) {
      return ["I", "1", "1ST YEAR", "I YEAR", "1", "2"];
    }
    return [s];
  }

  // Fetch students when activeSlot or date changes
  useEffect(() => {
    if (activeSlot && activeSlot.dept) {
      fetchStudentsAndAttendance(activeSlot);
      fetchDayPeriodAttendance(activeSlot.dept, activeSlot.year, activeSlot.section, date).then(res => {
        setDayPeriodsMap(res || {});
      });
    } else {
      setStudents([]);
      setDayPeriodsMap({});
    }
  }, [activeSlot, date]);

  async function fetchStudentsAndAttendance(slot) {
    setFetchingStudents(true);
    setSaved(false);
    try {
      // 1. Fetch Students from users collection for this department
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", slot.dept)
      );
      const snap = await getDocs(q);
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Match year / semester intelligently
      const targetYearKeys = getPossibleYearKeys(slot.semester || slot.year);
      if (targetYearKeys.length > 0) {
        const filteredByYear = list.filter(st => {
          const stYear = String(st.year || "").trim().toUpperCase();
          const stSem = String(st.semester || "").trim();
          return targetYearKeys.includes(stYear) || targetYearKeys.includes(stSem);
        });
        if (filteredByYear.length > 0) {
          list = filteredByYear;
        }
      }

      // Match section if specified and not 'None' / '.'
      const sec = (slot.section || "").trim();
      if (sec && sec.toLowerCase() !== "none" && sec !== ".") {
        const filteredBySec = list.filter(st => !st.section || st.section === sec);
        if (filteredBySec.length > 0) {
          list = filteredBySec;
        }
      }

      list.sort((a, b) => (a.registerNo || a.registerNumber || a.name || "").localeCompare(b.registerNo || b.registerNumber || b.name || ""));
      setStudents(list);

      // 2. Fetch existing period attendance record
      const docId = `${slot.dept}_${slot.year}_${slot.section}_${date}_period_${slot.period}`.replace(/\s+/g, "_");
      let existingRecords = null;

      try {
        const directSnap = await getDoc(doc(db, "period_attendance", docId));
        if (directSnap.exists() && directSnap.data()?.records) {
          existingRecords = directSnap.data().records;
        }
      } catch (_) {}

      if (!existingRecords) {
        const attQ = query(
          collection(db, "period_attendance"),
          where("date", "==", date),
          where("period", "==", Number(slot.period)),
          where("dept", "==", slot.dept)
        );
        const attSnap = await getDocs(attQ);
        if (!attSnap.empty) {
          existingRecords = attSnap.docs[0].data()?.records || null;
        }
      }

      if (existingRecords) {
        const defaultMap = { ...existingRecords };
        list.forEach(s => {
          if (!defaultMap[s.id]) defaultMap[s.id] = "P";
        });
        setAttendance(defaultMap);
        setSaved(true);
      } else {
        // Default all students to "P" (Present)
        const defaultMap = {};
        list.forEach(s => {
          defaultMap[s.id] = "P";
        });
        setAttendance(defaultMap);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch students for this class.");
    }
    setFetchingStudents(false);
  }

  function handleStatusChange(studentId, status) {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
    setSaved(false);
  }

  function handleMarkAll(status) {
    const updated = {};
    students.forEach(s => {
      updated[s.id] = status;
    });
    setAttendance(updated);
    setSaved(false);
  }

  async function handleSaveAttendance() {
    if (!activeSlot || students.length === 0) return;
    setSaving(true);
    try {
      const docId = `${activeSlot.dept}_${activeSlot.year}_${activeSlot.section}_${date}_period_${activeSlot.period}`.replace(/\s+/g, "_");

      const presentCount = students.filter(s => (attendance[s.id] || "P") === "P").length;
      const absentCount = students.filter(s => attendance[s.id] === "A").length;
      const odCount = students.filter(s => attendance[s.id] === "OD").length;

      const payload = {
        dept: activeSlot.dept,
        year: activeSlot.year,
        section: activeSlot.section,
        date: date,
        month: monthName,
        day: dayName,
        period: Number(activeSlot.period),
        subjectCode: activeSlot.subject_code,
        subjectName: activeSlot.subject_name || "",
        isAltered: !!activeSlot.isAltered,
        originalFacultyName: activeSlot.originalFacultyName || "",
        records: attendance,
        totalCount: students.length,
        presentCount,
        absentCount,
        odCount,
        markedBy: userProfile?.uid || userProfile?.id || "faculty",
        markedByName: userProfile?.name || "Faculty",
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, "period_attendance", docId), payload, { merge: true });
      toast.success(`Period ${activeSlot.period} Attendance saved successfully!`);
      setSaved(true);

      // Refresh day's 8 periods
      fetchDayPeriodAttendance(activeSlot.dept, activeSlot.year, activeSlot.section, date).then(res => {
        setDayPeriodsMap(res || {});
      });

      // 1. Notify HOD of activeSlot.dept
      try {
        const hodQ = query(
          collection(db, "users"),
          where("role", "==", "hod"),
          where("dept", "==", activeSlot.dept)
        );
        const hodSnap = await getDocs(hodQ);
        hodSnap.docs.forEach(async (hDoc) => {
          await addDoc(collection(db, "notifications"), {
            userId: hDoc.id,
            title: `Period ${activeSlot.period} Attendance Marked`,
            body: `${userProfile?.name || "Faculty"} marked Period ${activeSlot.period} (${activeSlot.subject_code}) for ${activeSlot.dept} ${activeSlot.year} (Sec ${activeSlot.section}). Present: ${presentCount}, Absent: ${absentCount}, OD: ${odCount}.`,
            data: {
              type: "PERIOD_ATTENDANCE",
              dept: activeSlot.dept,
              year: activeSlot.year,
              section: activeSlot.section,
              period: activeSlot.period,
              date: date
            },
            read: false,
            createdAt: new Date().toISOString()
          });
        });
      } catch (notifyHodErr) {
        console.warn("Could not notify HOD:", notifyHodErr);
      }

      // 2. Notify Class Incharge of this class
      try {
        const inchargeQ = query(
          collection(db, "class_incharges"),
          where("dept", "==", activeSlot.dept)
        );
        const inchargeSnap = await getDocs(inchargeQ);
        const normalizedTargetYear = normalizeYear(activeSlot.year);
        const matchingIncharges = inchargeSnap.docs.filter(d => {
          const incData = d.data();
          const incYear = normalizeYear(incData.year);
          return incYear === normalizedTargetYear && 
            (!activeSlot.section || activeSlot.section === "None" || activeSlot.section === "." || incData.section === "." || incData.section === activeSlot.section);
        });

        matchingIncharges.forEach(async (incDoc) => {
          const facultyId = incDoc.data().facultyId;
          if (facultyId && facultyId !== userProfile?.uid) {
            await addDoc(collection(db, "notifications"), {
              userId: facultyId,
              title: `Period ${activeSlot.period} Attendance Marked (${activeSlot.subject_code})`,
              body: `${userProfile?.name || "Faculty"} marked Period ${activeSlot.period} for your class (${activeSlot.dept} ${activeSlot.year} - Sec ${activeSlot.section}). Present: ${presentCount}, Absent: ${absentCount}, OD: ${odCount}.`,
              data: {
                type: "PERIOD_ATTENDANCE",
                dept: activeSlot.dept,
                year: activeSlot.year,
                section: activeSlot.section,
                period: activeSlot.period,
                date: date
              },
              read: false,
              createdAt: new Date().toISOString()
            });
          }
        });
      } catch (notifyIncErr) {
        console.warn("Could not notify Class Incharge:", notifyIncErr);
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Failed to save period attendance.");
    }
    setSaving(false);
  }

  // Stats calculation
  const totalStudents = students.length;
  const presentCount = students.filter(s => (attendance[s.id] || "P") === "P").length;
  const absentCount = students.filter(s => attendance[s.id] === "A").length;
  const odCount = students.filter(s => attendance[s.id] === "OD").length;
  const percentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(16, 185, 129, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
                <CheckSquare size={24} />
              </div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text)" }}>Period-wise Student Attendance</h1>
                <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 14 }}>
                  Mark attendance for individual lecture hours (Periods 1 to 8) as per timetable or altered proxy hours
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              className="btn-secondary"
              onClick={() => navigate("/staff/hour-alteration")}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600 }}
            >
              <ArrowLeftRight size={16} /> Hour Alteration / Proxy
            </button>
            {activeSlot && (
              <button
                className="btn-primary"
                onClick={() => navigate(`/staff/classwork-record?dept=${activeSlot.dept}&year=${activeSlot.year}&section=${activeSlot.section}&subject=${activeSlot.subject_code}&period=${activeSlot.period}&date=${date}`)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, background: "#4f46e5" }}
              >
                <FileText size={16} /> Record Classwork for Period {activeSlot.period} <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Date & Mode Selector Bar */}
        <div className="card" style={{ padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Date</label>
                <input
                  type="date"
                  className="input-field"
                  style={{ padding: "8px 12px", fontSize: 14, fontWeight: 600 }}
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Day & Month</label>
                <div style={{ padding: "9px 14px", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontWeight: 700, fontSize: 13, color: "#4f46e5" }}>
                  {dayName}, {monthName}
                </div>
              </div>
            </div>

            <div>
              <button
                onClick={() => setManualMode(!manualMode)}
                style={{
                  background: manualMode ? "rgba(79, 70, 229, 0.1)" : "transparent",
                  color: manualMode ? "#4f46e5" : "var(--text-muted)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                {manualMode ? "Switch to Timetable Hours" : "Manual Class Selection"}
              </button>
            </div>
          </div>
        </div>

        {/* Timetable Period Chips (when not in manual mode) */}
        {!manualMode && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Today's Scheduled Lecture Hours ({todaySchedule.length} Hours Assigned)
            </div>

            {loadingSchedule ? (
              <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                Loading your lectures for {dayName}...
              </div>
            ) : todaySchedule.length === 0 ? (
              <div className="card" style={{ padding: 32, textAlign: "center" }}>
                <Clock size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                <h3 style={{ color: "var(--text)", fontSize: 16 }}>No Lecture Slots for {dayName}</h3>
                <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
                  You have no timetable hours or approved proxy alterations for this date. You can click "Manual Class Selection" to mark attendance for any class.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
                {todaySchedule.map((slot, idx) => {
                  const isSelected = selectedSlotIndex === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedSlotIndex(idx)}
                      style={{
                        padding: "14px 18px",
                        borderRadius: "var(--radius-md)",
                        border: isSelected ? "2px solid #10b981" : "1px solid var(--border)",
                        background: isSelected ? "rgba(16, 185, 129, 0.08)" : "var(--bg-secondary)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        position: "relative"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontWeight: 800, fontSize: 15, color: isSelected ? "#059669" : "var(--text)" }}>
                          Period {slot.period}
                        </span>
                        {slot.isAltered ? (
                          <span style={{ fontSize: 10, background: "#fef3c7", color: "#b45309", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                            Proxy / Altered
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, background: "rgba(0,0,0,0.06)", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                            Regular
                          </span>
                        )}
                      </div>

                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
                        {slot.subject_code}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {slot.dept} • Sem {slot.semester || slot.year}{slot.section && slot.section !== "None" && slot.section !== "." ? ` (Sec ${slot.section})` : ""}
                      </div>
                      {slot.isAltered && (
                        <div style={{ fontSize: 11, color: "#d97706", marginTop: 4, fontStyle: "italic" }}>
                          From: {slot.originalFacultyName}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Manual Selection Mode Form */}
        {manualMode && (
          <div className="card" style={{ padding: "18px 22px", marginBottom: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Period</label>
                <select className="input-field" style={{ width: "100%", padding: "8px 10px" }} value={manualPeriod} onChange={e => setManualPeriod(Number(e.target.value))}>
                  {PERIODS.map(p => <option key={p} value={p}>Period {p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Department</label>
                <select className="input-field" style={{ width: "100%", padding: "8px 10px" }} value={manualDept} onChange={e => setManualDept(e.target.value)}>
                  {["CSE", "ECE", "MECH", "IT", "CIVIL", "AIDS", "EEE"].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Year</label>
                <select className="input-field" style={{ width: "100%", padding: "8px 10px" }} value={manualYear} onChange={e => setManualYear(e.target.value)}>
                  {["I", "II", "III", "IV"].map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Section</label>
                <select className="input-field" style={{ width: "100%", padding: "8px 10px" }} value={manualSection} onChange={e => setManualSection(e.target.value)}>
                  {["A", "B", "C"].map(s => <option key={s} value={s}>Section {s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Subject Code</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: "100%", padding: "8px 10px" }}
                  placeholder="e.g. CS8501"
                  value={manualSubject}
                  onChange={e => setManualSubject(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Stats Row matching Photo 2 */}
        {activeSlot && students.length > 0 && (
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Users size={20} color="var(--highlight)" />
              </div>
              <div className="stat-value">{totalStudents}</div>
              <div className="stat-label">Total Registered</div>
            </div>

            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <CheckCircle2 size={20} color="#16a34a" />
              </div>
              <div className="stat-value" style={{ color: "#16a34a" }}>{presentCount}</div>
              <div className="stat-label">Present</div>
            </div>

            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <XCircle size={20} color="#dc2626" />
              </div>
              <div className="stat-value" style={{ color: "#dc2626" }}>{absentCount}</div>
              <div className="stat-label">No. of Absentees</div>
            </div>

            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Briefcase size={20} color="#d97706" />
              </div>
              <div className="stat-value" style={{ color: "#d97706" }}>{odCount}</div>
              <div className="stat-label">On Duty (OD)</div>
            </div>

            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <CheckSquare size={20} color="#4f46e5" />
              </div>
              <div className="stat-value" style={{ color: "#4f46e5" }}>{percentage}%</div>
              <div className="stat-label">Attendance Rate</div>
            </div>
          </div>
        )}

        {/* Student Attendance Sheet (Matching Photo 2) */}
        {activeSlot && (
          <div className="card" style={{ padding: 24 }}>
            {fetchingStudents ? (
              <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
                Loading students for {activeSlot.dept} Year {activeSlot.year} Section {activeSlot.section}...
              </div>
            ) : students.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
                No students found enrolled in {activeSlot.dept} Year {activeSlot.year} Section {activeSlot.section}.
              </div>
            ) : (
              <>
                {/* 8-Period Tracker for this Class Today */}
                <div style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "14px 18px",
                  marginBottom: 20
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                      Today's 8-Period Status for {activeSlot.dept} Year {activeSlot.year} ({date})
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                      {Object.values(dayPeriodsMap).filter(Boolean).length} of 8 periods marked by faculty
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8 }}>
                    {PERIOD_NUMBERS.map(pNum => {
                      const pData = dayPeriodsMap[pNum];
                      const isCurrent = Number(activeSlot.period) === pNum;
                      return (
                        <div
                          key={pNum}
                          style={{
                            padding: "8px 6px",
                            borderRadius: 8,
                            textAlign: "center",
                            background: isCurrent
                              ? "rgba(16, 185, 129, 0.15)"
                              : pData
                              ? "rgba(37, 99, 235, 0.08)"
                              : "rgba(0,0,0,0.03)",
                            border: isCurrent
                              ? "2px solid #10b981"
                              : pData
                              ? "1px solid rgba(37, 99, 235, 0.3)"
                              : "1px dashed var(--border)"
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 700, color: isCurrent ? "#059669" : pData ? "#2563eb" : "var(--text-muted)" }}>
                            Period {pNum} {isCurrent && "★ (Active)"}
                          </div>
                          <div style={{ fontSize: 10, marginTop: 3, fontWeight: 600, color: pData ? "#16a34a" : "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {pData ? `${pData.markedByName || "Marked"}` : "Pending"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Header info matching Photo 2 */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                      Attendance Sheet — Period {activeSlot.period} ({activeSlot.subject_code})
                    </h3>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                      Date: <strong>{date}</strong> • Month: <strong>{monthName}</strong> • Class: <strong>{activeSlot.dept} - {activeSlot.year} (Sec {activeSlot.section})</strong>
                      {activeSlot.isAltered && (
                        <span style={{ marginLeft: 8, color: "#d97706", fontWeight: 700 }}>
                          [Proxy Lecture for {activeSlot.originalFacultyName}]
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      className="btn-secondary"
                      onClick={() => handleMarkAll("P")}
                      style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600, width: "auto" }}
                    >
                      All Present
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleMarkAll("A")}
                      style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600, width: "auto" }}
                    >
                      All Absent
                    </button>

                    <button
                      className="btn-primary"
                      onClick={handleSaveAttendance}
                      disabled={saving}
                      style={{
                        padding: "8px 24px",
                        fontSize: 13,
                        fontWeight: 700,
                        width: "auto",
                        background: saved ? "#16a34a" : "var(--highlight)"
                      }}
                    >
                      {saving ? "Saving..." : saved ? "✓ Update Period Attendance" : "Save Period Attendance"}
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left", color: "var(--text-muted)", fontSize: 13 }}>
                        <th style={{ padding: "12px 14px" }}>S.No</th>
                        <th style={{ padding: "12px 14px" }}>Reg No</th>
                        <th style={{ padding: "12px 14px" }}>Student Name</th>
                        <th style={{ padding: "12px 14px", textAlign: "center" }}>Period {activeSlot.period} Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, idx) => {
                        const status = attendance[student.id] || "P";
                        return (
                          <tr key={student.id} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s ease" }}>
                            <td style={{ padding: "12px 14px", color: "var(--text-muted)", fontSize: 13 }}>{idx + 1}</td>
                            <td style={{ padding: "12px 14px", fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "var(--text)" }}>
                              {student.registerNo || student.registerNumber || student.rollNo || "N/A"}
                            </td>
                            <td style={{ padding: "12px 14px", fontWeight: 600, fontSize: 14, color: "var(--text)" }}>
                              {student.name}
                            </td>
                            <td style={{ padding: "12px 14px", textAlign: "center" }}>
                              <div style={{ display: "inline-flex", gap: 4, background: "var(--bg-secondary)", padding: 4, borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(student.id, "P")}
                                  style={{
                                    padding: "6px 16px",
                                    borderRadius: "var(--radius-sm)",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: 13,
                                    fontWeight: 700,
                                    transition: "all 0.15s ease",
                                    background: status === "P" ? "#16a34a" : "transparent",
                                    color: status === "P" ? "#ffffff" : "var(--text-muted)"
                                  }}
                                >
                                  P
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(student.id, "OD")}
                                  style={{
                                    padding: "6px 16px",
                                    borderRadius: "var(--radius-sm)",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: 13,
                                    fontWeight: 700,
                                    transition: "all 0.15s ease",
                                    background: status === "OD" ? "#d97706" : "transparent",
                                    color: status === "OD" ? "#ffffff" : "var(--text-muted)"
                                  }}
                                >
                                  OD
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(student.id, "A")}
                                  style={{
                                    padding: "6px 16px",
                                    borderRadius: "var(--radius-sm)",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: 13,
                                    fontWeight: 700,
                                    transition: "all 0.15s ease",
                                    background: status === "A" ? "#dc2626" : "transparent",
                                    color: status === "A" ? "#ffffff" : "var(--text-muted)"
                                  }}
                                >
                                  A
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer summary matching Photo 2 */}
                <div style={{ marginTop: 24, padding: "16px 20px", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
                  <div style={{ fontSize: 13, color: "var(--text)" }}>
                    <strong>Signature of Faculty:</strong> {userProfile.name}
                    {activeSlot.isAltered && ` (Proxy for ${activeSlot.originalFacultyName})`}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    Total Absent: <strong style={{ color: "#dc2626" }}>{absentCount}</strong> | Total Present: <strong style={{ color: "#16a34a" }}>{presentCount}</strong>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
