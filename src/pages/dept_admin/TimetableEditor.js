import React, { useState, useEffect } from "react";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, getDocs, setDoc, doc, where, deleteDoc } from "../../supabase/supabaseAdapter";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { Calendar, Save, Trash2, CheckCircle, AlertTriangle, User, BookOpen, Clock, Loader2, Info, Sparkles, Lock } from "lucide-react";
import toast, { Toaster } from 'react-hot-toast';
import { DEFAULT_TIMETABLE_SCHEDULE, getCachedSchedule, fetchScheduleFromDB, saveScheduleToDB, getTimetableColumns } from "../../utils/timetableSchedule";

const DEGREES = ["B.E", "B.Tech", "M.E", "MBA", "MCA"];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const SECTIONS = ["A", "B", "C", "D", "E", "None"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export const ACADEMIC_YEARS = [
  { year: 1, label: "1st Year", sems: [1, 2] },
  { year: 2, label: "2nd Year", sems: [3, 4] },
  { year: 3, label: "3rd Year", sems: [5, 6] },
  { year: 4, label: "4th Year", sems: [7, 8] }
];

const DEFAULT_CSE_COURSES = [
  { id: "AI3021", courseCode: "AI3021", courseName: "IT in agricultural system", semester: 7, department: "CSE" },
  { id: "CBM348", courseCode: "CBM348", courseName: "foundation skills in integrated product development", semester: 7, department: "CSE" },
  { id: "GE3752", courseCode: "GE3752", courseName: "total quality management", semester: 7, department: "CSE" },
  { id: "GE3791", courseCode: "GE3791", courseName: "human values and ethics", semester: 7, department: "CSE" }
];

const DEFAULT_CSE_FACULTY = [
  { id: "d22cae45-affb-416b-9f63-22a5449bd302", uid: "d22cae45-affb-416b-9f63-22a5449bd302", name: "Ramya G", dept: "CSE" },
  { id: "40ad6a37-84db-4ce1-8fa6-3cc5e6d60521", uid: "40ad6a37-84db-4ce1-8fa6-3cc5e6d60521", name: "V.VASANTH", dept: "CSE" },
  { id: "abc861b9-1fad-42a5-91b2-c136c815930a", uid: "abc861b9-1fad-42a5-91b2-c136c815930a", name: "Sivasakthivel S", dept: "CSE" },
  { id: "24235382-de75-4dbf-871f-3daec808b334", uid: "24235382-de75-4dbf-871f-3daec808b334", name: "Deepika Eswari V", dept: "CSE" }
];

export const COURSE_PALETTES = [
  { bg: "#eef2ff", border: "#c7d2fe", accent: "#4f46e5", code: "#3730a3", name: "#4338ca", staff: "#475569" }, // Indigo
  { bg: "#f0fdf4", border: "#bbf7d0", accent: "#16a34a", code: "#166534", name: "#15803d", staff: "#475569" }, // Emerald
  { bg: "#faf5ff", border: "#e9d5ff", accent: "#9333ea", code: "#6b21a8", name: "#7e22ce", staff: "#475569" }, // Purple
  { bg: "#fffbeb", border: "#fde68a", accent: "#d97706", code: "#92400e", name: "#b45309", staff: "#475569" }, // Amber
  { bg: "#f0fdfa", border: "#99f6e4", accent: "#0d9488", code: "#115e59", name: "#0f766e", staff: "#475569" }, // Teal
  { bg: "#fff1f2", border: "#fecdd3", accent: "#e11d48", code: "#9f1239", name: "#be123c", staff: "#475569" }, // Rose
  { bg: "#f0f9ff", border: "#bae6fd", accent: "#0284c7", code: "#075985", name: "#0369a1", staff: "#475569" }, // Sky
  { bg: "#fefce8", border: "#fef08a", accent: "#ca8a04", code: "#854d0e", name: "#a16207", staff: "#475569" }  // Warm Yellow
];

export function getCourseTheme(code = "") {
  if (!code) return COURSE_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash << 5) - hash + code.charCodeAt(i);
  }
  return COURSE_PALETTES[Math.abs(hash) % COURSE_PALETTES.length];
}

export const SUBJECT_SHORT_NAMES = {
  "AI3021": "Agri IT",
  "CBM348": "FSIPD",
  "GE3752": "TQM",
  "GE3791": "Ethics"
};

export const SUBJECT_THEMES = {
  "AI3021": { code: "#2563eb" },
  "CBM348": { code: "#2563eb" },
  "GE3752": { code: "#2563eb" },
  "GE3791": { code: "#2563eb" },
};

export function getSubjectColorTheme(code) {
  if (code && SUBJECT_THEMES[code]) return SUBJECT_THEMES[code];
  return { code: "#2563eb" };
}

export function getShortSubjectName(code, rawName) {
  if (code && SUBJECT_SHORT_NAMES[code]) return SUBJECT_SHORT_NAMES[code];
  if (!rawName) return code || "";
  const name = rawName.trim();
  if (/agricultural/i.test(name)) return "Agri IT";
  if (/product development|integrated product|fsipd|ipd/i.test(name)) return "FSIPD";
  if (/quality management/i.test(name)) return "TQM";
  if (/human values|ethics/i.test(name)) return "Ethics";
  if (name.length <= 12) {
    return name.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }
  return code || name.slice(0, 10);
}

export function formatCourseTitle(name = "") {
  if (!name) return "";
  return name.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

export default function TimetableEditor() {
  const { userProfile } = useAuth();
  
  // Selection State (persist so HOD/Admin doesn't lose selected year on refresh)
  const [semester, setSemester] = useState(() => {
    try {
      const saved = sessionStorage.getItem("erp_tt_sem");
      if (saved) return Number(saved);
    } catch {}
    return 7; // Default to active Semester 7 (4th Year)
  });
  const [section, setSection] = useState(() => {
    try {
      const saved = sessionStorage.getItem("erp_tt_sec");
      if (saved) return saved;
    } catch {}
    return "None";
  });

  useEffect(() => {
    try {
      sessionStorage.setItem("erp_tt_sem", String(semester));
      sessionStorage.setItem("erp_tt_sec", section);
    } catch {}
  }, [semester, section]);
  
  // Data State - Initialize from cache or defaults immediately so UI never has empty flash
  const [courses, setCourses] = useState(() => {
    try {
      const saved = sessionStorage.getItem("erp_tt_courses");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CSE_COURSES;
  });
  const [faculty, setFaculty] = useState(() => {
    try {
      const saved = sessionStorage.getItem("erp_tt_faculty");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CSE_FACULTY;
  });
  const [allocations, setAllocations] = useState(() => {
    try {
      const saved = sessionStorage.getItem("erp_tt_allocations");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [timetable, setTimetable] = useState({}); // Key: `${day}-${period}`, Value: Slot object
  
  // Loading State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Modal State
  const [activeCell, setActiveCell] = useState(null); // { day, period }
  const [slotForm, setSlotForm] = useState({ subject_code: "", staff_uid: "", room: "" });
  const [conflicts, setConflicts] = useState([]);
  const [autoStaffNote, setAutoStaffNote] = useState("");

  // Schedule / Timings State
  const [schedule, setSchedule] = useState(() => getCachedSchedule(userProfile?.dept));
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState(DEFAULT_TIMETABLE_SCHEDULE);
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    if (userProfile?.dept) {
      fetchMasterData();
      fetchScheduleFromDB(userProfile.dept).then(s => {
        if (s) setSchedule(s);
      });
    }
    const handleScheduleUpdate = (e) => {
      if (e.detail) setSchedule(e.detail);
    };
    window.addEventListener("timetable_schedule_changed", handleScheduleUpdate);
    return () => window.removeEventListener("timetable_schedule_changed", handleScheduleUpdate);
  }, [userProfile]);

  useEffect(() => {
    if (userProfile?.dept && semester && section) {
      fetchTimetable();
    }
  }, [semester, section, userProfile]);

  async function fetchMasterData() {
    try {
      // 1. Fetch all courses
      const courseSnap = await getDocs(collection(db, "courses"));
      const courseList = courseSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // 2. Fetch all staff across all departments (including HOD & Dept Admin)
      const facQ = query(collection(db, "users"), where("role", "in", ["staff", "hod", "dept_admin"]));
      const facSnap = await getDocs(facQ);
      const facList = facSnap.docs.map(d => ({
        id: d.id,
        uid: d.data()?.uid || d.id,
        name: d.data()?.name || "Faculty",
        dept: d.data()?.dept || "",
        role: d.data()?.role || "staff",
        facultyCode: d.data()?.facultyCode || d.data()?.staffCode || d.id
      }));
      setFaculty(facList);

      // 3. Fetch course_allocations and subject_allocations for auto-matching faculty
      const [caSnap, saSnap] = await Promise.all([
        getDocs(collection(db, "course_allocations")).catch(() => ({ docs: [] })),
        getDocs(collection(db, "subject_allocations")).catch(() => ({ docs: [] }))
      ]);

      const allocList = [];
      caSnap.docs.forEach(d => {
        const data = d.data();
        if (data) {
          allocList.push({
            id: d.id,
            source: "course_allocations",
            courseCode: data.courseCode || "",
            courseId: data.courseId || "",
            courseName: data.courseName || "",
            facultyId: data.facultyId || "",
            facultyName: data.facultyName || "",
            facultyCode: data.facultyCode || "",
            semester: data.semester ? String(data.semester) : "",
            section: data.section || "",
            department: data.department || ""
          });
        }
      });

      saSnap.docs.forEach(d => {
        const data = d.data();
        if (data) {
          allocList.push({
            id: d.id,
            source: "subject_allocations",
            courseCode: data.subjectCode || data.courseCode || "",
            courseId: data.subjectId || data.courseId || "",
            courseName: data.subjectName || data.courseName || "",
            facultyId: data.facultyId || "",
            facultyName: data.facultyName || "",
            facultyCode: data.facultyCode || "",
            semester: data.semester ? String(data.semester) : "",
            section: data.section || "",
            department: data.department || ""
          });
        }
      });
      setAllocations(allocList);

      // Supplement any courses that are in allocations but not yet in courseList
      const existingCodes = new Set(courseList.map(c => (c.courseCode || c.id || "").toUpperCase()));
      allocList.forEach(a => {
        const code = (a.courseCode || a.courseId || "").trim();
        if (code && !existingCodes.has(code.toUpperCase())) {
          existingCodes.add(code.toUpperCase());
          courseList.push({
            id: a.courseId || a.id,
            courseCode: a.courseCode || code,
            courseName: a.courseName || code,
            department: a.department || userProfile?.dept || "CSE",
            semester: a.semester || ""
          });
        }
      });

      setCourses(courseList);
      try {
        sessionStorage.setItem("erp_tt_courses", JSON.stringify(courseList));
        sessionStorage.setItem("erp_tt_faculty", JSON.stringify(facList));
        sessionStorage.setItem("erp_tt_allocations", JSON.stringify(allocList));
      } catch {}
    } catch (err) {
      console.error("fetchMasterData error:", err);
      toast.error("Failed to load master data.");
    }
  }

  async function fetchTimetable() {
    setLoading(true);
    setTimetable({});
    try {
      const q = query(collection(db, "timetable_slots"), 
        where("dept", "==", userProfile.dept),
        where("semester", "==", semester),
        where("section", "==", section)
      );
      const snap = await getDocs(q);
      
      const newTimetable = {};
      snap.docs.forEach(d => {
        const data = d.data();
        newTimetable[`${data.day}-${data.period}`] = { id: d.id, ...data };
      });
      setTimetable(newTimetable);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load timetable. Check if the timetable_slots table exists.");
    }
    setLoading(false);
  }

  // Find previously allocated faculty for a course
  const findAllocatedFaculty = (subjectCode) => {
    if (!subjectCode) return null;
    const cleanSub = subjectCode.trim().toUpperCase();

    // 1. Try matching with courseCode + current semester + current section (if specified)
    let match = allocations.find(a => 
      (a.courseCode?.trim().toUpperCase() === cleanSub || a.courseId === subjectCode) &&
      String(a.semester) === String(semester) &&
      section && section !== "None" && a.section === section
    );

    // 2. Try matching with courseCode + current semester
    if (!match) {
      match = allocations.find(a => 
        (a.courseCode?.trim().toUpperCase() === cleanSub || a.courseId === subjectCode) &&
        String(a.semester) === String(semester)
      );
    }

    // 3. Try matching with courseCode across any semester
    if (!match) {
      match = allocations.find(a => 
        (a.courseCode?.trim().toUpperCase() === cleanSub || a.courseId === subjectCode)
      );
    }

    // 4. Default allocation fallback for CSE if allocations fetch was slow
    if (!match) {
      if (cleanSub.includes("AI3021")) {
        match = { facultyName: "Ramya G", facultyId: "d22cae45-affb-416b-9f63-22a5449bd302" };
      } else if (cleanSub.includes("CBM348")) {
        match = { facultyName: "V.VASANTH", facultyId: "40ad6a37-84db-4ce1-8fa6-3cc5e6d60521" };
      } else if (cleanSub.includes("GE3752")) {
        match = { facultyName: "Sivasakthivel S", facultyId: "abc861b9-1fad-42a5-91b2-c136c815930a" };
      } else if (cleanSub.includes("GE3791")) {
        match = { facultyName: "Deepika Eswari V", facultyId: "24235382-de75-4dbf-871f-3daec808b334" };
      }
    }

    return match || null;
  };

  const openSlotModal = (day, period) => {
    const existing = timetable[`${day}-${period}`];
    setActiveCell({ day, period });
    if (existing) {
      setSlotForm({
        subject_code: existing.subject_code || "",
        staff_uid: existing.staff_uid || "",
        room: existing.room || ""
      });
      const alloc = findAllocatedFaculty(existing.subject_code);
      if (alloc) {
        setAutoStaffNote(`Assigned Faculty: ${alloc.facultyName}`);
      } else {
        setAutoStaffNote("");
      }
    } else {
      setSlotForm({ subject_code: "", staff_uid: "", room: "" });
      setAutoStaffNote("");
    }
    setConflicts([]);
  };

  const closeSlotModal = () => {
    setActiveCell(null);
    setConflicts([]);
    setAutoStaffNote("");
  };

  // When subject changes, automatically pre-fill assigned faculty
  const handleSubjectChange = (newSubjectCode) => {
    const alloc = findAllocatedFaculty(newSubjectCode);
    let matchedStaffUid = slotForm.staff_uid;
    let note = "";

    if (alloc) {
      // Find matching staff in faculty list by ID, UID, facultyCode, or Name
      const matchedFac = faculty.find(f => 
        (alloc.facultyId && (f.uid === alloc.facultyId || f.id === alloc.facultyId)) ||
        (alloc.facultyCode && f.facultyCode && f.facultyCode === alloc.facultyCode) ||
        (alloc.facultyName && f.name && f.name.trim().toLowerCase() === alloc.facultyName.trim().toLowerCase())
      );

      if (matchedFac) {
        matchedStaffUid = matchedFac.uid || matchedFac.id;
        note = `Auto-selected: ${matchedFac.name} (${matchedFac.dept || userProfile?.dept || 'CSE'})`;
      } else if (alloc.facultyId) {
        matchedStaffUid = alloc.facultyId;
        note = `Auto-selected: ${alloc.facultyName || "Assigned Faculty"}`;
      }
    } else {
      note = "";
    }

    setAutoStaffNote(note);
    setSlotForm(prev => ({
      ...prev,
      subject_code: newSubjectCode,
      staff_uid: matchedStaffUid
    }));
  };

  const checkConflicts = async (staff_uid, room, day, period) => {
    const currentConflicts = [];
    try {
      // We check all timetable slots across all departments for the given day and period
      const q = query(collection(db, "timetable_slots"), 
        where("day", "==", day),
        where("period", "==", period)
      );
      const snap = await getDocs(q);
      
      snap.docs.forEach(d => {
        const slot = d.data();
        // Ignore the slot if it's the exact same class we are editing
        if (slot.dept === userProfile.dept && slot.semester === semester && slot.section === section) {
          return;
        }

        if (staff_uid && slot.staff_uid === staff_uid) {
          currentConflicts.push(`Staff ${slot.staff_name} is already assigned to ${slot.dept} - Sem ${slot.semester} Sec ${slot.section}.`);
        }
        if (room && slot.room === room) {
          currentConflicts.push(`Room ${room} is already booked by ${slot.dept} - Sem ${slot.semester} Sec ${slot.section}.`);
        }
      });
    } catch (err) {
      console.error("Conflict check error:", err);
    }
    return currentConflicts;
  };

  const saveSlot = async () => {
    if (!slotForm.subject_code || !slotForm.staff_uid) {
      toast.error("Please select a subject");
      return;
    }

    setSaving(true);
    const selectedCourse = courses.find(c => c.courseCode === slotForm.subject_code || c.id === slotForm.subject_code) ||
      DEFAULT_CSE_COURSES.find(c => c.courseCode === slotForm.subject_code || c.id === slotForm.subject_code);
    const selectedStaff = faculty.find(f => (f.uid && f.uid === slotForm.staff_uid) || (f.id && f.id === slotForm.staff_uid)) ||
      DEFAULT_CSE_FACULTY.find(f => (f.uid && f.uid === slotForm.staff_uid) || (f.id && f.id === slotForm.staff_uid));
    
    // Check conflicts (only staff conflicts since room is removed)
    const conflictList = await checkConflicts(slotForm.staff_uid, "", activeCell.day, activeCell.period);
    
    if (conflictList.length > 0) {
      setConflicts(conflictList);
      setSaving(false);
      return;
    }

    const slotId = timetable[`${activeCell.day}-${activeCell.period}`]?.id || 
                   `slot_${userProfile.dept}_${semester}_${section}_${activeCell.day}_${activeCell.period}`;

    const slotData = {
      id: slotId,
      dept: userProfile.dept,
      semester,
      section,
      day: activeCell.day,
      period: activeCell.period,
      subject_code: selectedCourse?.courseCode || slotForm.subject_code,
      subject_name: selectedCourse?.courseName || "",
      subject_dept: selectedCourse?.department || "",
      staff_uid: selectedStaff?.uid || selectedStaff?.id || slotForm.staff_uid,
      staff_name: selectedStaff?.name || "",
      staff_dept: selectedStaff?.dept || "",
      room: "",
      status: "draft",
      created_by: userProfile.uid,
      updated_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "timetable_slots", slotId), slotData);
      
      setTimetable(prev => ({
        ...prev,
        [`${activeCell.day}-${activeCell.period}`]: slotData
      }));
      
      toast.success("Slot saved!");
      closeSlotModal();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save slot. Check table schema.");
    }
    setSaving(false);
  };

  const deleteSlot = async () => {
    const slotId = timetable[`${activeCell.day}-${activeCell.period}`]?.id;
    if (!slotId) {
      closeSlotModal();
      return;
    }

    try {
      await deleteDoc(doc(db, "timetable_slots", slotId));
      
      const newTimetable = { ...timetable };
      delete newTimetable[`${activeCell.day}-${activeCell.period}`];
      setTimetable(newTimetable);
      
      toast.success("Slot cleared!");
      closeSlotModal();
    } catch (err) {
      console.error(err);
      toast.error("Failed to clear slot.");
    }
  };

  const publishTimetable = async () => {
    const slots = Object.values(timetable);
    if (slots.length === 0) {
      toast.error("No slots to publish");
      return;
    }
    
    setLoading(true);
    try {
      // In a real app we might batch this
      for (const slot of slots) {
        if (slot.status !== "published") {
          await setDoc(doc(db, "timetable_slots", slot.id), { ...slot, status: "published" }, { merge: true });
        }
      }
      await fetchTimetable(); // Refresh
      toast.success("Timetable published successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to publish timetable");
    }
    setLoading(false);
  };

  const isFullyPublished = Object.values(timetable).length > 0 && Object.values(timetable).every(s => s.status === 'published');

  const openScheduleModal = () => {
    setScheduleForm({
      periods: { ...(schedule?.periods || DEFAULT_TIMETABLE_SCHEDULE.periods) },
      teaBreak: schedule?.teaBreak || DEFAULT_TIMETABLE_SCHEDULE.teaBreak,
      teaBreakAfter: schedule?.teaBreakAfter !== undefined ? schedule.teaBreakAfter : DEFAULT_TIMETABLE_SCHEDULE.teaBreakAfter,
      lunchBreak: schedule?.lunchBreak || DEFAULT_TIMETABLE_SCHEDULE.lunchBreak,
      lunchBreakAfter: schedule?.lunchBreakAfter !== undefined ? schedule.lunchBreakAfter : DEFAULT_TIMETABLE_SCHEDULE.lunchBreakAfter,
      afternoonBreak: schedule?.afternoonBreak || DEFAULT_TIMETABLE_SCHEDULE.afternoonBreak,
      afternoonBreakAfter: schedule?.afternoonBreakAfter !== undefined ? schedule.afternoonBreakAfter : DEFAULT_TIMETABLE_SCHEDULE.afternoonBreakAfter
    });
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      await saveScheduleToDB(userProfile?.dept, scheduleForm);
      setSchedule(scheduleForm);
      setShowScheduleModal(false);
      toast.success("Schedule timings and breaks saved successfully!");
    } catch (err) {
      console.error("Save schedule error:", err);
      toast.error("Failed to save schedule timings.");
    }
    setSavingSchedule(false);
  };

  // STRICT: Only show subjects belonging to the currently selected semester!
  const allCoursesList = courses && courses.length > 0 ? courses : DEFAULT_CSE_COURSES;
  const displayCourses = allCoursesList.filter(c => String(c.semester) === String(semester));
  const displayFaculty = faculty && faculty.length > 0 ? faculty : DEFAULT_CSE_FACULTY;
  const selectedYear = Math.ceil(semester / 2) || 1;

  const renderPeriodCell = (day, period) => {
    const slot = timetable[`${day}-${period}`];
    const theme = slot ? getSubjectColorTheme(slot.subject_code) : null;
    return (
      <td key={`${day}-${period}`} 
          onClick={() => openSlotModal(day, period)}
          style={{ 
            padding: "10px 4px", 
            borderBottom: "1px solid #e2e8f0", 
            borderRight: "1px solid #e2e8f0",
            cursor: "pointer",
            verticalAlign: "middle",
            textAlign: "center",
            background: "transparent",
            height: "56px",
            transition: "background 0.15s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f8fafc";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
      >
        {slot ? (
          <div 
            title={`${slot.subject_code} - ${slot.subject_name || ''}\nFaculty: ${slot.staff_name}`}
            style={{ 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center", 
              justifyContent: "center", 
              gap: "3px" 
            }}
          >
            <div style={{ 
              fontWeight: 700, 
              color: theme.code, 
              fontSize: "13.5px", 
              letterSpacing: "0.2px", 
              lineHeight: 1.2
            }}>
              {getShortSubjectName(slot.subject_code, slot.subject_name)}
            </div>
            <div style={{ 
              color: "#64748b", 
              fontSize: "12px", 
              fontWeight: 500, 
              maxWidth: "115px", 
              whiteSpace: "nowrap", 
              overflow: "hidden", 
              textOverflow: "ellipsis", 
              lineHeight: 1.2
            }}>
              {slot.staff_name ? slot.staff_name.replace(/\s*\([^)]*\)/, '').trim() : ''}
            </div>
          </div>
        ) : (
          <div style={{ color: "#cbd5e1", fontSize: "14px" }}>
            -
          </div>
        )}
      </td>
    );
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f3f4f6" }}>
      <Sidebar />
      <div className="main-content" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <Toaster position="top-right" />
      
      <div style={{ background: "white", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "12px", fontFamily: "Plus Jakarta Sans, sans-serif", color: "var(--text)" }}>
            <Calendar size={28} color="#1e3a8a" /> Department Class Timetable
          </h2>
          <p style={{ margin: "8px 0 0 0", color: "var(--text-muted)" }}>View & manage class schedules for 1st, 2nd, 3rd, and 4th Year ({userProfile?.dept || "Department"})</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <button 
            onClick={openScheduleModal}
            style={{ 
              background: "#f8fafc", 
              color: "#1e293b", 
              border: "1px solid #cbd5e1", 
              padding: "10px 16px", 
              borderRadius: "6px", 
              fontWeight: "600", 
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px"
            }}
          >
            <Clock size={16} color="#2563eb" /> Edit Timings & Breaks
          </button>
          <button 
            onClick={publishTimetable}
            disabled={loading || Object.values(timetable).length === 0}
            style={{ 
              background: isFullyPublished ? "#10b981" : "#1e3a8a", 
              color: "white", 
              border: "none", 
              padding: "10px 20px", 
              borderRadius: "6px", 
              fontWeight: "bold", 
              cursor: loading || Object.values(timetable).length === 0 ? "not-allowed" : "pointer",
              opacity: loading || Object.values(timetable).length === 0 ? 0.6 : 1,
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            {isFullyPublished ? <><CheckCircle size={18} /> Published</> : "Publish Timetable"}
          </button>
        </div>
      </div>

      {/* Year & Semester Switcher for HOD / Dept Admin */}
      <div style={{ background: "white", padding: "20px 24px", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
        {/* Header row: Dept name, Current selection, Section buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "#1e3a8a", background: "#dbeafe", padding: "4px 10px", borderRadius: "6px" }}>
              {userProfile?.dept || "CSE"}
            </span>
            <span style={{ fontSize: "15px", fontWeight: "700", color: "#1e293b" }}>
              {ACADEMIC_YEARS.find(y => y.year === selectedYear)?.label} • Semester {semester} {section && section !== 'None' ? `(Sec ${section})` : ''}
            </span>
          </div>

          {/* Section Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12.5px", fontWeight: "600", color: "#64748b" }}>Section:</span>
            <div style={{ display: "flex", gap: "4px", background: "#f8fafc", padding: "3px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              {SECTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSection(s)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: section === s ? "#1e3a8a" : "transparent",
                    color: section === s ? "white" : "#475569",
                    fontWeight: section === s ? "700" : "500",
                    fontSize: "12px",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  {s === "None" ? "None" : `Sec ${s}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 1st, 2nd, 3rd, 4th Year Big Selection Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          {ACADEMIC_YEARS.map(y => {
            const isSelected = selectedYear === y.year;
            return (
              <button
                key={y.year}
                type="button"
                onClick={() => {
                  const isCurrentEven = semester % 2 === 0;
                  setSemester(isCurrentEven ? y.sems[1] : y.sems[0]);
                }}
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: isSelected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                  background: isSelected ? "#eff6ff" : "#f8fafc",
                  color: isSelected ? "#1d4ed8" : "#334155",
                  fontWeight: isSelected ? "700" : "600",
                  fontSize: "15px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  boxShadow: isSelected ? "0 4px 12px rgba(37, 99, 235, 0.12)" : "none",
                  transition: "all 0.15s ease",
                  textAlign: "center"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>{y.label}</span>
                  {isSelected && <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#2563eb" }} />}
                </div>
                <div style={{ fontSize: "11px", color: isSelected ? "#3b82f6" : "#64748b", fontWeight: "500" }}>
                  Sem {y.sems[0]} & Sem {y.sems[1]}
                </div>
              </button>
            );
          })}
        </div>

        {/* Semester Buttons within Selected Year */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", paddingTop: "14px", borderTop: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12.5px", fontWeight: "600", color: "#475569" }}>Select Semester:</span>
            <div style={{ display: "flex", gap: "8px" }}>
              {ACADEMIC_YEARS.find(y => y.year === selectedYear)?.sems.map(semNum => (
                <button
                  key={semNum}
                  type="button"
                  onClick={() => setSemester(semNum)}
                  style={{
                    padding: "6px 18px",
                    borderRadius: "20px",
                    border: semester === semNum ? "1.5px solid #2563eb" : "1px solid #cbd5e1",
                    background: semester === semNum ? "#2563eb" : "white",
                    color: semester === semNum ? "white" : "#475569",
                    fontWeight: semester === semNum ? "700" : "500",
                    fontSize: "12.5px",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  Semester {semNum} {semNum % 2 !== 0 ? "(Odd)" : "(Even)"}
                </button>
              ))}
            </div>
          </div>
          
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            Showing <strong>Semester {semester}</strong> timetable
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          <Loader2 className="spin" size={40} style={{ margin: "0 auto 16px" }} />
          <p>Loading Timetable...</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto", background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1050px" }}>
            <thead>
              <tr>
                <th style={{ padding: "12px 10px", background: "#f8fafc", borderBottom: "2px solid #e2e8f0", borderRight: "1px solid #e2e8f0", width: "100px", color: "#334155", fontWeight: "600", fontSize: "13px" }}>
                  Day / Period
                </th>
                {getTimetableColumns(schedule).map((col, idx, arr) => {
                  const isLast = idx === arr.length - 1;
                  if (col.type === "period") {
                    return (
                      <th key={`head-p-${col.period}`} style={{ padding: "10px 4px", background: "#f8fafc", borderBottom: "2px solid #e2e8f0", borderRight: isLast ? "none" : "1px solid #e2e8f0", minWidth: "95px", color: "#334155" }}>
                        <div style={{ fontWeight: "600", fontSize: "13px" }}>Period {col.period}</div>
                        <div style={{ fontWeight: "400", fontSize: "11px", color: "#64748b", marginTop: "3px" }}>{col.timing}</div>
                      </th>
                    );
                  }
                  return (
                    <th key={`head-brk-${col.id}-${idx}`} style={{ padding: "10px 4px", background: "#f1f5f9", borderBottom: "2px solid #e2e8f0", borderRight: isLast ? "none" : "1px solid #e2e8f0", width: col.type === "lunch" ? "80px" : "75px", color: "#475569" }}>
                      <div style={{ fontWeight: "700", fontSize: "11.5px", letterSpacing: "0.3px", textTransform: "uppercase" }}>{col.name}</div>
                      <div style={{ fontWeight: "400", fontSize: "10.5px", color: "#64748b", marginTop: "3px" }}>{col.timing}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => {
                const cols = getTimetableColumns(schedule);
                return (
                  <tr key={day}>
                    <td style={{ padding: "12px 10px", fontWeight: "600", fontSize: "13px", color: "#1e293b", borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0", background: "#f8fafc", textAlign: "center" }}>
                      {day}
                    </td>
                    {cols.map((col, idx) => {
                      const isLast = idx === cols.length - 1;
                      if (col.type === "period") {
                        return renderPeriodCell(day, col.period);
                      }
                      return (
                        <td key={`cell-${day}-${col.id}-${idx}`} style={{ 
                          padding: "6px 2px", 
                          borderBottom: "1px solid #e2e8f0", 
                          borderRight: isLast ? "none" : "1px solid #e2e8f0", 
                          background: "#f8fafc", 
                          textAlign: "center", 
                          verticalAlign: "middle" 
                        }}>
                          <span style={{ fontSize: "10.5px", fontWeight: "600", color: "#94a3b8", letterSpacing: "1px", textTransform: "uppercase" }}>
                            {col.name}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Subject & Faculty Details Reference Legend */}
      {!loading && (
        <div style={{ marginTop: "20px", background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "16px 20px" }}>
          <h4 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Subject & Faculty Reference
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
            {[
              { short: "Agri IT", code: "AI3021", name: "IT in Agricultural System", staff: "Ramya G", color: "#2563eb" },
              { short: "FSIPD", code: "CBM348", name: "Foundation Skills in Integrated Product Dev", staff: "V.VASANTH", color: "#2563eb" },
              { short: "TQM", code: "GE3752", name: "Total Quality Management", staff: "Sivasakthivel S", color: "#2563eb" },
              { short: "Ethics", code: "GE3791", name: "Human Values and Ethics", staff: "Deepika Eswari V", color: "#2563eb" }
            ].map((item) => (
              <div key={item.code} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontWeight: 700, fontSize: "12px", color: item.color, background: "white", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: "6px", minWidth: "54px", textAlign: "center" }}>
                  {item.short}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={item.name}>
                    {item.code} - {item.name}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                    {item.staff}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Slot Modal */}
      {activeCell && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: "white", borderRadius: "12px", width: "100%", maxWidth: "500px", overflow: "hidden", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "20px", background: "var(--primary)", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "18px" }}>Assign {activeCell.day} - Period {activeCell.period}</h3>
              <div style={{ background: "rgba(255,255,255,0.2)", padding: "4px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: "bold" }}>
                Sem {semester} - {section}
              </div>
            </div>
            
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              
              {conflicts.length > 0 && (
                <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "16px", borderRadius: "8px", border: "1px solid #fca5a5" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "bold", marginBottom: "8px" }}>
                    <AlertTriangle size={18} /> Conflict Detected
                  </div>
                  <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "14px" }}>
                    {conflicts.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px" }}>Subject (Cross-Dept enabled)</label>
                <select 
                  value={slotForm.subject_code} 
                  onChange={e => handleSubjectChange(e.target.value)}
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "14px", backgroundColor: "white" }}
                >
                  <option value="">-- Select Subject --</option>
                  {displayCourses.length === 0 ? (
                    <option value="" disabled>No subjects available for Semester {semester}</option>
                  ) : (
                    displayCourses.map(c => {
                      const alloc = findAllocatedFaculty(c.courseCode || c.id);
                      const staffHint = alloc?.facultyName ? ` (${alloc.facultyName})` : '';
                      return (
                        <option key={c.id || c.courseCode} value={c.courseCode || c.id}>
                          {c.courseCode} - {c.courseName}{staffHint}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px" }}>
                  Staff (Cross-Dept enabled)
                </label>
                <select 
                  value={slotForm.staff_uid} 
                  disabled={Boolean(autoStaffNote || slotForm.staff_uid)}
                  onChange={e => {
                    setSlotForm({...slotForm, staff_uid: e.target.value});
                  }}
                  style={{ 
                    width: "100%", 
                    padding: "12px", 
                    borderRadius: "8px", 
                    border: "1px solid var(--border)", 
                    fontSize: "14px",
                    backgroundColor: (autoStaffNote || slotForm.staff_uid) ? "#f8fafc" : "white",
                    cursor: (autoStaffNote || slotForm.staff_uid) ? "not-allowed" : "pointer",
                    color: (autoStaffNote || slotForm.staff_uid) ? "#1e293b" : "inherit",
                    fontWeight: (autoStaffNote || slotForm.staff_uid) ? 600 : "normal"
                  }}
                >
                  <option value="">-- Select Staff --</option>
                  {displayFaculty.map(f => (
                    <option key={f.uid || f.id} value={f.uid || f.id}>{f.name} ({f.dept})</option>
                  ))}
                </select>
              </div>

            </div>
            
            <div style={{ padding: "16px 24px", background: "#f8fafc", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
              {timetable[`${activeCell.day}-${activeCell.period}`] ? (
                <button onClick={deleteSlot} style={{ padding: "10px 16px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: 500 }}>
                  <Trash2 size={16} /> Clear Slot
                </button>
              ) : <div></div>}
              
              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={closeSlotModal} style={{ padding: "10px 16px", background: "white", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "6px", cursor: "pointer", fontWeight: 500 }}>
                  Cancel
                </button>
                <button onClick={saveSlot} disabled={saving} style={{ padding: "10px 20px", background: "#1e3a8a", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold" }}>
                  {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Schedule / Timings & Breaks Modal */}
      {showScheduleModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: "white", borderRadius: "12px", width: "100%", maxWidth: "600px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "20px", background: "#1e3a8a", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Clock size={20} /> Edit Timings & Breaks
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.85 }}>
                  Set period timings, tea break, and lunch break for {userProfile?.dept}
                </p>
              </div>
              <button 
                onClick={() => setShowScheduleModal(false)}
                style={{ background: "transparent", border: "none", color: "white", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Period Timings Section */}
              <div>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  Period Timings (1 to 8)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                    <div key={p}>
                      <label style={{ display: "block", fontSize: "11.5px", fontWeight: "600", color: "#334155", marginBottom: "3px" }}>
                        Period {p} Timing
                      </label>
                      <input 
                        type="text" 
                        value={scheduleForm.periods?.[p] || ""} 
                        onChange={e => setScheduleForm({ ...scheduleForm, periods: { ...scheduleForm.periods, [p]: e.target.value } })}
                        placeholder={DEFAULT_TIMETABLE_SCHEDULE.periods[p]}
                        style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", boxSizing: "border-box" }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Breaks Configuration Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Breaks & Placement Settings
                </div>

                {/* 1. Morning / Tea Break */}
                <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ fontSize: "12.5px", fontWeight: "700", color: "#0f172a" }}>
                      ☕ Morning Break / Tea Break
                    </label>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#64748b", marginBottom: "3px" }}>Break Timing</label>
                      <input 
                        type="text" 
                        value={scheduleForm.teaBreak || ""} 
                        onChange={e => setScheduleForm({ ...scheduleForm, teaBreak: e.target.value })}
                        placeholder="10:40 - 11:00"
                        style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", boxSizing: "border-box", background: "white" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#64748b", marginBottom: "3px" }}>Place Break After</label>
                      <select 
                        value={scheduleForm.teaBreakAfter ?? 2} 
                        onChange={e => setScheduleForm({ ...scheduleForm, teaBreakAfter: Number(e.target.value) })}
                        style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", boxSizing: "border-box", background: "white" }}
                      >
                        <option value={1}>After Period 1 (between 1 & 2)</option>
                        <option value={2}>After Period 2 (between 2 & 3 - Default)</option>
                        <option value={3}>After Period 3 (between 3 & 4)</option>
                        <option value={0}>Don't show morning break</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Lunch Break */}
                <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ fontSize: "12.5px", fontWeight: "700", color: "#0f172a" }}>
                      🍽️ Lunch Break
                    </label>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#64748b", marginBottom: "3px" }}>Lunch Timing</label>
                      <input 
                        type="text" 
                        value={scheduleForm.lunchBreak || ""} 
                        onChange={e => setScheduleForm({ ...scheduleForm, lunchBreak: e.target.value })}
                        placeholder="12:40 - 01:30"
                        style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", boxSizing: "border-box", background: "white" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#64748b", marginBottom: "3px" }}>Place Lunch After</label>
                      <select 
                        value={scheduleForm.lunchBreakAfter ?? 4} 
                        onChange={e => setScheduleForm({ ...scheduleForm, lunchBreakAfter: Number(e.target.value) })}
                        style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", boxSizing: "border-box", background: "white" }}
                      >
                        <option value={3}>After Period 3 (between 3 & 4)</option>
                        <option value={4}>After Period 4 (between 4 & 5 - Default)</option>
                        <option value={5}>After Period 5 (between 5 & 6)</option>
                        <option value={0}>Don't show lunch break</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Afternoon Break */}
                <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ fontSize: "12.5px", fontWeight: "700", color: "#0f172a" }}>
                      ☕ Afternoon Break
                    </label>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#64748b", marginBottom: "3px" }}>Break Timing</label>
                      <input 
                        type="text" 
                        value={scheduleForm.afternoonBreak || ""} 
                        onChange={e => setScheduleForm({ ...scheduleForm, afternoonBreak: e.target.value })}
                        placeholder="03:10 - 03:25"
                        style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", boxSizing: "border-box", background: "white" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#64748b", marginBottom: "3px" }}>Place Break After</label>
                      <select 
                        value={scheduleForm.afternoonBreakAfter ?? 6} 
                        onChange={e => setScheduleForm({ ...scheduleForm, afternoonBreakAfter: Number(e.target.value) })}
                        style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", boxSizing: "border-box", background: "white" }}
                      >
                        <option value={5}>After Period 5 (between 5 & 6)</option>
                        <option value={6}>After Period 6 (between 6 & 7 - Default)</option>
                        <option value={7}>After Period 7 (between 7 & 8)</option>
                        <option value={0}>Don't show afternoon break</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

            </div>
            
            <div style={{ padding: "16px 24px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button 
                type="button" 
                onClick={() => setScheduleForm({ ...DEFAULT_TIMETABLE_SCHEDULE })}
                style={{ padding: "8px 14px", background: "white", color: "#64748b", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontSize: "12.5px", fontWeight: "600" }}
              >
                Reset to Defaults
              </button>
              <div style={{ display: "flex", gap: "10px" }}>
                <button 
                  type="button" 
                  onClick={() => setShowScheduleModal(false)}
                  style={{ padding: "8px 16px", background: "white", color: "#334155", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "500" }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleSaveSchedule}
                  disabled={savingSchedule}
                  style={{ padding: "8px 18px", background: "#1e3a8a", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  {savingSchedule ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Save Timings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
