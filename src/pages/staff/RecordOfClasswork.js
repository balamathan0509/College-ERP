import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, where, getDocs, doc, setDoc, addDoc } from "../../supabase/supabaseAdapter";
import toast, { Toaster } from "react-hot-toast";
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Save, 
  Printer, 
  Layers, 
  RefreshCw, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  GraduationCap, 
  FileText,
  Send,
  UserCheck,
  ShieldCheck,
  AlertCircle,
  XCircle,
  AlertTriangle
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { getDepartmentCalendar, isDateInEvent } from "../../utils/academicCalendarUtils";

// Standard options
export const CONTENT_DELIVERY_MODES = [
  "Lecture (L)",
  "Power Point Presentation",
  "Demonstration",
  "Video Lectures",
  "Simulation",
  "Animation",
  "NPTEL Lecture",
  "Lab Visit",
  "Industrial Visit"
];

export const TEACHING_AIDS = [
  "Chalk Board (CB) / White Board (WB)",
  "LCD Projectors (LCD)",
  "Models / Charts",
  "Lecture Capturing System"
];

export const ITLM_METHODS = [
  "None / Standard",
  "Flipped Classroom",
  "Z-A Approach",
  "Think - Pair - Share",
  "Jigsaw / Reciprocal Teaching",
  "Group Discussion",
  "Quiz",
  "Student Seminar",
  "Mind Mapping",
  "Assignment",
  "Interactive Lecture"
];

function normalizeYear(yr) {
  if (!yr) return "";
  const s = String(yr).trim().toUpperCase();
  if (s === "1" || s === "1ST" || s === "I") return "I";
  if (s === "2" || s === "2ND" || s === "II") return "II";
  if (s === "3" || s === "3RD" || s === "III") return "III";
  if (s === "4" || s === "4TH" || s === "IV") return "IV";
  return s;
}

const DEFAULT_UNITS = [
  { unit: "UNIT - 1", num: "1", title: "" },
  { unit: "UNIT - 2", num: "2", title: "" },
  { unit: "UNIT - 3", num: "3", title: "" },
  { unit: "UNIT - 4", num: "4", title: "" },
  { unit: "UNIT - 5", num: "5", title: "" }
];

export default function RecordOfClasswork() {
  const { userProfile } = useAuth();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const paramDept = searchParams.get("dept");
  const paramYear = searchParams.get("year");
  const paramSection = searchParams.get("section");
  const paramSubject = searchParams.get("subject");
  const paramPeriod = searchParams.get("period");
  const paramDate = searchParams.get("date");
  const paramUnit = searchParams.get("unit");

  // Selection states
  const [selectedSubject, setSelectedSubject] = useState(paramSubject || "");
  const [selectedDept, setSelectedDept] = useState(paramDept || userProfile?.dept || "CSE");
  const [selectedYear, setSelectedYear] = useState(paramYear || "IV");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedSection, setSelectedSection] = useState(paramSection || "None");
  const [selectedUnit, setSelectedUnit] = useState(paramUnit || "UNIT - 1");
  const [unitTitle, setUnitTitle] = useState("");

  // Faculty's subjects list
  const [subjectList, setSubjectList] = useState([]);
  
  // Planned topics from Course Contents & Plan
  const [plannedTopics, setPlannedTopics] = useState([]);
  const [currentAllocationId, setCurrentAllocationId] = useState(null);

  // Table rows for regular topics
  const [topicRows, setTopicRows] = useState([]);

  // Content Beyond Syllabus Rows
  const [beyondRows, setBeyondRows] = useState([]);

  // Summary fields
  const [periodsPlanned, setPeriodsPlanned] = useState("0");
  const [reasonForDeviation, setReasonForDeviation] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);

  // Verification & Approval info (HOD & Class In-Charge)
  const [hodStatus, setHodStatus] = useState("Pending Review");
  const [hodApprovedBy, setHodApprovedBy] = useState("");
  const [hodApprovedAt, setHodApprovedAt] = useState("");
  const [hodRemarks, setHodRemarks] = useState("");

  const [inchargeStatus, setInchargeStatus] = useState("Pending Review");
  const [inchargeVerifiedBy, setInchargeVerifiedBy] = useState("");
  const [inchargeVerifiedAt, setInchargeVerifiedAt] = useState("");
  const [classInchargeInfo, setClassInchargeInfo] = useState(null);

  const [recordFacultyName, setRecordFacultyName] = useState("");
  const [recordFacultyId, setRecordFacultyId] = useState("");
  const [submittedAt, setSubmittedAt] = useState("");

  // Academic Calendar Suspension Check
  const [deptCalendar, setDeptCalendar] = useState(null);
  const [calendarBlockedMap, setCalendarBlockedMap] = useState({}); // { [actualDate]: eventObj }

  const isHod = userProfile?.role === "hod" || userProfile?.role === "principal";
  const isClassIncharge = Boolean(
    classInchargeInfo &&
    (classInchargeInfo.facultyId === userProfile?.uid ||
      (classInchargeInfo.email && userProfile?.email && classInchargeInfo.email.toLowerCase() === userProfile.email.toLowerCase()))
  );

  // Load Department Academic Calendar
  useEffect(() => {
    async function loadDeptCal() {
      if (!selectedDept) {
        setDeptCalendar(null);
        return;
      }
      try {
        const cal = await getDepartmentCalendar(selectedDept);
        setDeptCalendar(cal);
      } catch (err) {
        console.warn("Could not load department academic calendar:", err);
      }
    }
    loadDeptCal();
  }, [selectedDept]);

  // Check if any actualDate in topicRows or beyondRows falls on suspended academic calendar date
  useEffect(() => {
    if (!deptCalendar?.events || !Array.isArray(deptCalendar.events)) {
      setCalendarBlockedMap({});
      return;
    }
    const map = {};
    const allDates = [...topicRows, ...beyondRows].map(r => r.actualDate).filter(Boolean);

    allDates.forEach(dateStr => {
      if (!map[dateStr]) {
        const blockedEvent = deptCalendar.events.find(evt => {
          const matchDate = isDateInEvent(dateStr, evt.startDate, evt.endDate);
          if (!matchDate) return false;
          if (evt.suspendClasses === false) return false;
          if (evt.targetYear && evt.targetYear !== "All Years" && evt.targetYear !== "all") {
            const tNorm = normalizeYear(evt.targetYear);
            const yNorm = normalizeYear(selectedYear);
            if (tNorm && yNorm && tNorm !== yNorm) return false;
          }
          return true;
        });
        if (blockedEvent) {
          map[dateStr] = blockedEvent;
        }
      }
    });
    setCalendarBlockedMap(map);
  }, [deptCalendar, selectedYear, topicRows, beyondRows]);

  useEffect(() => {
    fetchStaffSubjects();
  }, [userProfile]);

  // Lookup Class In-Charge for current department, year, and section
  useEffect(() => {
    async function fetchClassIncharge() {
      if (!selectedDept || !selectedYear) return;
      try {
        const qInc = query(collection(db, "class_incharges"), where("dept", "==", selectedDept));
        const incSnap = await getDocs(qInc);
        const normSelectedYear = normalizeYear(selectedYear);
        const matched = incSnap.docs.map(d => ({ id: d.id, ...d.data() })).find(inc => {
          const incYearNorm = normalizeYear(inc.year);
          const secMatch = !selectedSection || selectedSection === "None" || selectedSection === "." || inc.section === "." || inc.section === selectedSection;
          return incYearNorm === normSelectedYear && secMatch;
        });
        setClassInchargeInfo(matched || null);
      } catch (e) {
        console.warn("Error fetching class incharge:", e);
      }
    }
    fetchClassIncharge();
  }, [selectedDept, selectedYear, selectedSection]);

  // Fetch subjects allocated to faculty (or all department subjects if HOD)
  async function fetchStaffSubjects() {
    if (!userProfile?.uid) return;
    try {
      const map = new Map();
      const isHodOrPrincipal = userProfile?.role === "hod" || userProfile?.role === "principal";

      // 1. Fetch from course_allocations (LMS)
      try {
        const qAlloc = isHodOrPrincipal
          ? (userProfile?.role === "principal"
              ? collection(db, "course_allocations")
              : query(collection(db, "course_allocations"), where("department", "==", userProfile?.dept || "CSE")))
          : query(collection(db, "course_allocations"), where("facultyId", "==", userProfile.uid));

        const snapAlloc = await getDocs(qAlloc);
        snapAlloc.docs.forEach(d => {
          const data = d.data();
          if (data?.courseCode) {
            const sem = Number(data.semester) || 1;
            const yearNum = Math.ceil(sem / 2);
            const yearStr = ["I", "II", "III", "IV"][yearNum - 1] || "IV";
            map.set(data.courseCode, {
              id: d.id,
              allocationId: d.id,
              code: data.courseCode,
              name: data.facultyName && isHodOrPrincipal
                ? `${data.courseName || data.courseCode} (${data.facultyName})`
                : data.courseName || data.courseCode,
              dept: data.department || data.programme || userProfile?.dept || "CSE",
              year: yearStr,
              semester: String(data.semester || 1),
              section: data.section || "None",
              facultyName: data.facultyName || ""
            });
          }
        });
      } catch (e) {
        console.warn("course_allocations fetch error:", e);
      }

      // 2. Fetch from subject_allocations
      try {
        const qSubj = isHodOrPrincipal
          ? (userProfile?.role === "principal"
              ? collection(db, "subject_allocations")
              : query(collection(db, "subject_allocations"), where("department", "==", userProfile?.dept || "CSE")))
          : query(collection(db, "subject_allocations"), where("facultyId", "==", userProfile.uid));

        const snapSubj = await getDocs(qSubj);
        snapSubj.docs.forEach(d => {
          const data = d.data();
          const code = data?.subjectCode || data?.subjectId;
          if (code && !map.has(code)) {
            map.set(code, {
              id: d.id,
              allocationId: d.id,
              code: code,
              name: data.facultyName && isHodOrPrincipal
                ? `${data.subjectName || code} (${data.facultyName})`
                : data.subjectName || code,
              dept: data.department || userProfile?.dept || "CSE",
              year: data.year || "IV",
              semester: String(data.semester || ""),
              section: data.section || "None",
              facultyName: data.facultyName || ""
            });
          }
        });
      } catch (e) {
        console.warn("subject_allocations fetch error:", e);
      }

      // 3. Fallback: Fetch from timetable_slots
      try {
        const snap = await getDocs(collection(db, "timetable_slots"));
        const userUid = userProfile?.uid;
        const userName = (userProfile?.name || "").trim().toLowerCase();
        const userEmail = (userProfile?.email || "").trim().toLowerCase();

        snap.docs.forEach(d => {
          const data = d.data();
          if (!data?.subject_code) return;
          const staffUid = data.staff_uid;
          const staffName = (data.staff_name || "").trim().toLowerCase();
          const staffEmail = (data.staff_email || "").trim().toLowerCase();

          const matches =
            isHodOrPrincipal ||
            (staffUid && String(staffUid) === String(userUid)) ||
            (staffEmail && staffEmail === userEmail) ||
            (staffName && userName && (staffName === userName || staffName.includes(userName) || userName.includes(staffName)));

          if (matches && !map.has(data.subject_code)) {
            map.set(data.subject_code, {
              id: d.id,
              allocationId: null,
              code: data.subject_code,
              name: data.staff_name && isHodOrPrincipal
                ? `${data.subject_name || data.subject_code} (${data.staff_name})`
                : data.subject_name || data.subject_code,
              dept: data.dept || "CSE",
              year: data.year || "IV",
              semester: data.semester || "",
              section: data.section || "None",
              facultyName: data.staff_name || ""
            });
          }
        });
      } catch (e) {
        console.warn("timetable_slots fetch error:", e);
      }

      const list = Array.from(map.values());
      setSubjectList(list);

      if (list.length > 0) {
        const initial = paramSubject ? list.find(s => s.code === paramSubject) || list[0] : list[0];
        setSelectedSubject(initial.code);
        setSelectedDept(initial.dept);
        setSelectedYear(initial.year);
        setSelectedSemester(initial.semester || "");
        setSelectedSection(paramSection || initial.section || "None");
        setCurrentAllocationId(initial.allocationId || null);
      }
    } catch (err) {
      console.error("Error fetching staff subjects:", err);
    }
  }

  // Trigger loading record and course plan topics when subject or unit changes
  useEffect(() => {
    if (selectedSubject && selectedUnit) {
      loadDataForCurrentSelection();
    }
  }, [selectedSubject, selectedUnit, selectedDept, selectedYear, selectedSection]);

  // Handle URL param period and date
  useEffect(() => {
    if (paramPeriod && paramDate) {
      setTopicRows(prev => {
        const exists = prev.some(r => r.actualDate === paramDate && String(r.period) === String(paramPeriod));
        if (!exists) {
          return [
            ...prev,
            {
              plannedDate: paramDate,
              actualDate: paramDate,
              period: paramPeriod,
              topic: "",
              mode: "Lecture (L)",
              aid: "Chalk Board (CB) / White Board (WB)",
              itlm: "None / Standard"
            }
          ];
        }
        return prev;
      });
    }
  }, [paramPeriod, paramDate]);

  // Load both Course Plan topics and Classwork Logbook record
  async function loadDataForCurrentSelection() {
    if (!selectedSubject) return;
    setLoadingRecord(true);
    try {
      const unitNum = selectedUnit.replace(/\D/g, "") || "1";

      // 1. Fetch Planned Topics from 'course_plans' (Course Contents & Plan)
      let planDocs = [];
      try {
        // Query by courseCode
        const qCode = query(
          collection(db, "course_plans"),
          where("courseCode", "==", selectedSubject)
        );
        const snap = await getDocs(qCode);
        planDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // If not found by courseCode and we have allocationId, query by allocationId
        if (planDocs.length === 0 && currentAllocationId) {
          const qAlloc = query(
            collection(db, "course_plans"),
            where("allocationId", "==", currentAllocationId)
          );
          const snapAlloc = await getDocs(qAlloc);
          planDocs = snapAlloc.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (planErr) {
        console.warn("Could not fetch course_plans:", planErr);
      }

      // Filter plans for this specific unit
      const unitPlans = planDocs.filter(p => String(p.unit).trim() === String(unitNum).trim());
      setPlannedTopics(unitPlans);

      // Calculate total planned hours for this unit
      const totalPlannedHrs = unitPlans.reduce((sum, p) => sum + (Number(p.plannedHours) || 1), 0);

      // 2. Fetch Classwork Logbook Record from 'classwork_records'
      const docId = `classwork_${selectedSubject}_${selectedDept}_${selectedYear}_${selectedSection}_${selectedUnit}`.replace(/\s+/g, "_");
      const qRecord = query(collection(db, "classwork_records"), where("recordId", "==", docId));
      const recordSnap = await getDocs(qRecord);

      if (!recordSnap.empty) {
        // Record exists: load saved data
        const data = recordSnap.docs[0].data();
        setTopicRows(data.topicRows || []);
        setBeyondRows(data.beyondRows || []);
        setUnitTitle(data.unitTitle || "");
        setPeriodsPlanned(data.periodsPlanned || String(totalPlannedHrs || 0));
        setReasonForDeviation(data.reasonForDeviation || "");
        setHodStatus(data.hodStatus || "Pending Review");
        setHodApprovedBy(data.hodApprovedBy || "");
        setHodApprovedAt(data.hodApprovedAt || "");
        setHodRemarks(data.hodRemarks || "");
        setInchargeStatus(data.inchargeStatus || "Pending Review");
        setInchargeVerifiedBy(data.inchargeVerifiedBy || "");
        setInchargeVerifiedAt(data.inchargeVerifiedAt || "");
        setRecordFacultyName(data.facultyName || "");
        setRecordFacultyId(data.facultyId || "");
        setSubmittedAt(data.submittedAt || data.updatedAt || "");
      } else {
        // No saved record yet:
        // Start with one clean blank row (do NOT auto-fill all topics)
        setTopicRows([
          {
            plannedDate: new Date().toISOString().split("T")[0],
            actualDate: new Date().toISOString().split("T")[0],
            period: "1",
            topic: "",
            mode: "Lecture (L)",
            aid: "Chalk Board (CB) / White Board (WB)",
            itlm: "None / Standard"
          }
        ]);
        setPeriodsPlanned(String(totalPlannedHrs || "0"));
        setBeyondRows([]);
        setUnitTitle("");
        setReasonForDeviation("");
        setHodStatus("Pending Review");
        setHodApprovedBy("");
        setHodApprovedAt("");
        setHodRemarks("");
        setInchargeStatus("Pending Review");
        setInchargeVerifiedBy("");
        setInchargeVerifiedAt("");
        setRecordFacultyName(userProfile?.name || "");
        setRecordFacultyId(userProfile?.uid || "");
        setSubmittedAt("");
      }
    } catch (err) {
      console.error("Error loading classwork record:", err);
      toast.error("Failed to load records.");
    } finally {
      setLoadingRecord(false);
    }
  }

  // Import / Sync topics directly from Course Plan
  function handleSyncFromCoursePlan() {
    if (plannedTopics.length === 0) {
      toast("No planned topics found for this unit in Course Contents & Plan.", { icon: "ℹ️" });
      return;
    }
    const newRows = plannedTopics.map((p, idx) => ({
      plannedDate: new Date().toISOString().split("T")[0],
      actualDate: new Date().toISOString().split("T")[0],
      period: String((idx % 7) + 1),
      topic: p.subtopic ? `${p.topic} - ${p.subtopic}` : p.topic,
      mode: "Lecture (L)",
      aid: "Chalk Board (CB) / White Board (WB)",
      itlm: "None / Standard"
    }));
    setTopicRows(newRows);
    const totalHrs = plannedTopics.reduce((sum, p) => sum + (Number(p.plannedHours) || 1), 0);
    setPeriodsPlanned(String(totalHrs));
    toast.success(`Imported ${plannedTopics.length} topics from Course Plan!`);
  }

  function handleAddTopicRow() {
    setTopicRows(prev => [
      ...prev,
      {
        plannedDate: new Date().toISOString().split("T")[0],
        actualDate: new Date().toISOString().split("T")[0],
        period: String(((prev.length) % 7) + 1),
        topic: "",
        mode: "Lecture (L)",
        aid: "Chalk Board (CB) / White Board (WB)",
        itlm: "None / Standard"
      }
    ]);
  }

  function handleRemoveTopicRow(index) {
    setTopicRows(prev => prev.filter((_, idx) => idx !== index));
  }

  function handleTopicChange(index, field, value) {
    setTopicRows(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  function handleAddBeyondRow() {
    setBeyondRows(prev => [
      ...prev,
      {
        plannedDate: new Date().toISOString().split("T")[0],
        actualDate: new Date().toISOString().split("T")[0],
        period: "1",
        topic: "",
        mode: "Lecture (L)",
        aid: "Chalk Board (CB) / White Board (WB)",
        itlm: "None / Standard"
      }
    ]);
  }

  function handleRemoveBeyondRow(index) {
    setBeyondRows(prev => prev.filter((_, idx) => idx !== index));
  }

  function handleBeyondChange(index, field, value) {
    setBeyondRows(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  async function handleSaveRecord() {
    if (!selectedSubject) {
      toast.error("Please select a subject.");
      return;
    }

    const blockedDatesList = Object.keys(calendarBlockedMap);
    if (blockedDatesList.length > 0) {
      const firstDate = blockedDatesList[0];
      const evt = calendarBlockedMap[firstDate];
      toast.error(`Cannot save: Date ${firstDate} is marked as "${evt?.title || "Class Suspended"}" in Academic Calendar. Please change Actual Date.`);
      return;
    }

    setSaving(true);
    try {
      const docId = `classwork_${selectedSubject}_${selectedDept}_${selectedYear}_${selectedSection}_${selectedUnit}`.replace(/\s+/g, "_");
      const totalHandled = topicRows.length + beyondRows.length;
      const nowIso = new Date().toISOString();

      const payload = {
        recordId: docId,
        subjectCode: selectedSubject,
        dept: selectedDept,
        year: selectedYear,
        section: selectedSection,
        unit: selectedUnit,
        unitTitle: unitTitle.trim(),
        facultyId: recordFacultyId || userProfile?.uid,
        facultyName: recordFacultyName || userProfile?.name || "Staff",
        topicRows: topicRows,
        beyondRows: beyondRows,
        periodsPlanned: periodsPlanned,
        periodsHandled: totalHandled,
        reasonForDeviation: reasonForDeviation.trim(),
        hodStatus: hodStatus === "Approved" ? "Approved" : "Pending Review",
        hodApprovedBy: hodApprovedBy || "",
        hodApprovedAt: hodApprovedAt || "",
        hodRemarks: hodRemarks || "",
        inchargeStatus: inchargeStatus || "Pending Review",
        inchargeVerifiedBy: inchargeVerifiedBy || "",
        inchargeVerifiedAt: inchargeVerifiedAt || "",
        inchargeName: classInchargeInfo?.facultyName || null,
        inchargeId: classInchargeInfo?.facultyId || null,
        submittedAt: submittedAt || nowIso,
        updatedAt: nowIso
      };

      await setDoc(doc(db, "classwork_records", docId), payload, { merge: true });
      setRecordFacultyId(payload.facultyId);
      setRecordFacultyName(payload.facultyName);
      setSubmittedAt(payload.submittedAt);

      const staffDisplayName = userProfile?.name || "Staff";
      const classSecText = selectedSection && selectedSection !== "None" ? ` Sec ${selectedSection}` : "";
      const classLabel = `${selectedDept} ${selectedYear}${classSecText}`;

      // 1. Notify HOD of this Department
      try {
        const hodQ = query(
          collection(db, "users"),
          where("role", "==", "hod"),
          where("dept", "==", selectedDept)
        );
        const hodSnap = await getDocs(hodQ);
        for (const hDoc of hodSnap.docs) {
          const hId = hDoc.id;
          if (hId !== userProfile?.uid) {
            await addDoc(collection(db, "notifications"), {
              userId: hId,
              title: `Classwork Logbook Submitted: ${selectedSubject} (${selectedUnit})`,
              body: `${staffDisplayName} submitted Unit ${selectedUnit} Record of Classwork for ${classLabel}. Ready for review.`,
              data: {
                type: "CLASSWORK_RECORD",
                dept: selectedDept,
                year: selectedYear,
                section: selectedSection,
                subject: selectedSubject,
                unit: selectedUnit
              },
              read: false,
              createdAt: nowIso
            });
          }
        }

        // Add to alerts collection for HOD view
        await addDoc(collection(db, "alerts"), {
          title: `Classwork Logbook: ${selectedSubject} (${selectedUnit})`,
          message: `${staffDisplayName} submitted Unit ${selectedUnit} Record of Classwork for ${classLabel}. Pending your review.`,
          type: "general",
          deptTarget: selectedDept,
          roleTarget: "hod_only",
          createdAt: nowIso
        });
      } catch (notifyHodErr) {
        console.warn("Could not notify HOD:", notifyHodErr);
      }

      // 2. Notify Class In-Charge of this Class
      try {
        if (classInchargeInfo?.facultyId && classInchargeInfo.facultyId !== userProfile?.uid) {
          await addDoc(collection(db, "notifications"), {
            userId: classInchargeInfo.facultyId,
            title: `Class Logbook Updated: ${selectedSubject} (${selectedUnit})`,
            body: `${staffDisplayName} updated Record of Classwork for your class (${classLabel}).`,
            data: {
              type: "CLASSWORK_RECORD",
              dept: selectedDept,
              year: selectedYear,
              section: selectedSection,
              subject: selectedSubject,
              unit: selectedUnit
            },
            read: false,
            createdAt: nowIso
          });

          // Targeted alert for Class In-Charge
          await addDoc(collection(db, "alerts"), {
            title: `Class Logbook: ${selectedSubject} (${selectedUnit})`,
            message: `${staffDisplayName} updated Record of Classwork for your class (${classLabel}). Click to inspect.`,
            type: "general",
            deptTarget: selectedDept,
            roleTarget: "staff",
            targetUid: classInchargeInfo.facultyId,
            createdAt: nowIso
          });
        }
      } catch (notifyIncErr) {
        console.warn("Could not notify Class In-Charge:", notifyIncErr);
      }

      toast.success("Record saved & sent to HOD & Class In-Charge!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save classwork record.");
    }
    setSaving(false);
  }

  // HOD Approval Action
  async function handleHodApproval(newStatus) {
    if (!selectedSubject) return;
    try {
      const docId = `classwork_${selectedSubject}_${selectedDept}_${selectedYear}_${selectedSection}_${selectedUnit}`.replace(/\s+/g, "_");
      let remarks = hodRemarks;
      if (newStatus === "Needs Revision") {
        const inputRemarks = window.prompt("Enter remarks / reason for revision:", hodRemarks || "");
        if (inputRemarks === null) return;
        remarks = inputRemarks;
        setHodRemarks(remarks);
      }

      const nowIso = new Date().toISOString();
      const updateData = {
        hodStatus: newStatus,
        hodApprovedBy: userProfile?.name || "HOD",
        hodApprovedAt: nowIso,
        hodRemarks: remarks || "",
        updatedAt: nowIso
      };

      await setDoc(doc(db, "classwork_records", docId), updateData, { merge: true });
      setHodStatus(newStatus);
      setHodApprovedBy(userProfile?.name || "HOD");
      setHodApprovedAt(nowIso);

      // Notify the instructor
      const targetInstructorId = recordFacultyId || userProfile?.uid;
      if (targetInstructorId && targetInstructorId !== userProfile?.uid) {
        await addDoc(collection(db, "notifications"), {
          userId: targetInstructorId,
          title: `Logbook ${newStatus === "Approved" ? "Approved" : "Revision Requested"} by HOD`,
          body: `HOD ${userProfile?.name || ""} ${newStatus === "Approved" ? "approved" : "requested revision on"} your Unit ${selectedUnit} Logbook for ${selectedSubject}.${remarks ? ` Remarks: ${remarks}` : ""}`,
          data: {
            type: "CLASSWORK_RECORD",
            dept: selectedDept,
            year: selectedYear,
            section: selectedSection,
            subject: selectedSubject,
            unit: selectedUnit
          },
          read: false,
          createdAt: nowIso
        });
      }

      toast.success(`HOD status updated: ${newStatus}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update HOD status.");
    }
  }

  // Class In-Charge Verification Action
  async function handleInchargeVerification() {
    if (!selectedSubject) return;
    try {
      const docId = `classwork_${selectedSubject}_${selectedDept}_${selectedYear}_${selectedSection}_${selectedUnit}`.replace(/\s+/g, "_");
      const nowIso = new Date().toISOString();
      const updateData = {
        inchargeStatus: "Verified",
        inchargeVerifiedBy: userProfile?.name || classInchargeInfo?.facultyName || "Class In-Charge",
        inchargeVerifiedAt: nowIso,
        updatedAt: nowIso
      };

      await setDoc(doc(db, "classwork_records", docId), updateData, { merge: true });
      setInchargeStatus("Verified");
      setInchargeVerifiedBy(userProfile?.name || "Class In-Charge");
      setInchargeVerifiedAt(nowIso);

      // Notify the course instructor
      const targetInstructorId = recordFacultyId || userProfile?.uid;
      if (targetInstructorId && targetInstructorId !== userProfile?.uid) {
        await addDoc(collection(db, "notifications"), {
          userId: targetInstructorId,
          title: `Logbook Verified by Class In-Charge`,
          body: `Class In-Charge ${userProfile?.name || ""} verified Unit ${selectedUnit} Logbook for ${selectedSubject}.`,
          data: {
            type: "CLASSWORK_RECORD",
            dept: selectedDept,
            year: selectedYear,
            section: selectedSection,
            subject: selectedSubject,
            unit: selectedUnit
          },
          read: false,
          createdAt: nowIso
        });
      }

      toast.success("Verified by Class In-Charge successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to verify as Class In-Charge.");
    }
  }

  const periodsHandledCount = topicRows.length + beyondRows.length;
  const currentSubjectObj = subjectList.find(s => s.code === selectedSubject);
  const blockedDatesList = Object.keys(calendarBlockedMap);
  const isAnyDateBlocked = blockedDatesList.length > 0;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content" style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px 32px" }}>
        <Toaster position="top-right" />



        {/* Page Top Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)"
            }}>
              <BookOpen size={24} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#0f172a", letterSpacing: "-0.01em" }}>
                  Record of Classwork (Logbook)
                </h1>
                <span style={{
                  background: "#e0e7ff",
                  color: "#4338ca",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 6
                }}>
                  NBA / NAAC Compliance
                </span>
              </div>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                Unit-wise lecture tracking, delivery modes, and course plan execution
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => window.print()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 600,
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                color: "#334155",
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#f1f5f9"}
              onMouseLeave={e => e.currentTarget.style.background = "#ffffff"}
            >
              <Printer size={15} /> Print Logbook
            </button>
            {hodStatus === "Approved" && (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 700,
                background: "#dcfce7",
                color: "#166534",
                borderRadius: 8,
                border: "1px solid #86efac"
              }}>
                <ShieldCheck size={16} /> HoD Approved
              </span>
            )}
            <button
              onClick={handleSaveRecord}
              disabled={saving || isAnyDateBlocked}
              title={isAnyDateBlocked ? `Class suspended on ${blockedDatesList.join(", ")}` : "Saves classwork record and notifies HOD & Class In-Charge"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 22px",
                fontSize: 13,
                fontWeight: 600,
                background: isAnyDateBlocked ? "#94a3b8" : "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
                border: "none",
                borderRadius: 8,
                color: "#ffffff",
                cursor: (saving || isAnyDateBlocked) ? "not-allowed" : "pointer",
                boxShadow: isAnyDateBlocked ? "none" : "0 2px 6px rgba(79, 70, 229, 0.35)",
                transition: "all 0.15s ease",
                opacity: isAnyDateBlocked ? 0.8 : 1
              }}
              onMouseEnter={e => (!saving && !isAnyDateBlocked) && (e.currentTarget.style.filter = "brightness(1.08)")}
              onMouseLeave={e => (!saving && !isAnyDateBlocked) && (e.currentTarget.style.filter = "none")}
            >
              <Send size={15} /> {saving ? "Saving & Notifying..." : isAnyDateBlocked ? `Class Suspended (${blockedDatesList[0]})` : "Save & Submit to HOD"}
            </button>
          </div>
        </div>

        {/* Academic Calendar Suspended Alert Banner */}
        {isAnyDateBlocked && (
          <div style={{
            padding: "14px 18px",
            borderRadius: 10,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "#991b1b",
            boxShadow: "0 1px 3px rgba(220, 38, 38, 0.08)"
          }}>
            <AlertTriangle size={24} color="#dc2626" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 13, lineHeight: "1.5" }}>
              <strong>⛔ Class Logging Suspended ({calendarBlockedMap[blockedDatesList[0]]?.title || "Academic Calendar Event"}):</strong> Date <strong>{blockedDatesList.join(", ")}</strong> is marked in the Academic Calendar. Regular classes were suspended on this date.
              <div style={{ fontSize: 12, marginTop: 4, color: "#b91c1c" }}>
                You cannot log classwork on suspended dates. Please change the Actual Date to a valid teaching working day.
              </div>
            </div>
          </div>
        )}

        {/* HOD Revision Requested Alert Banner */}
        {hodStatus === "Needs Revision" && (
          <div style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 10,
            padding: "12px 18px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "#92400e"
          }}>
            <AlertCircle size={22} color="#d97706" style={{ flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 700, fontSize: 13 }}>⚠️ HoD Requested Revision: </span>
              <span style={{ fontSize: 13 }}>
                {hodRemarks ? `"${hodRemarks}"` : "Please review the topics, dates, or deviations, update the details and re-submit to HOD."}
              </span>
            </div>
          </div>
        )}

        {/* Clean Modern Filter Bar */}
        <div style={{
          background: "#ffffff",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 20,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", flex: 1 }}>
            {/* Subject Selector */}
            <div style={{ minWidth: 280, flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Subject / Course
              </label>
              {subjectList.length > 0 ? (
                <select
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#0f172a",
                    outline: "none",
                    cursor: "pointer"
                  }}
                  value={selectedSubject}
                  onChange={e => {
                    const code = e.target.value;
                    setSelectedSubject(code);
                    const matched = subjectList.find(s => s.code === code);
                    if (matched) {
                      setSelectedDept(matched.dept);
                      setSelectedYear(matched.year);
                      setSelectedSemester(matched.semester || "");
                      setSelectedSection(matched.section || "None");
                      setCurrentAllocationId(matched.allocationId || null);
                    }
                  }}
                >
                  {subjectList.map(s => (
                    <option key={s.code} value={s.code}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#0f172a"
                  }}
                  placeholder="e.g. AI3021"
                  value={selectedSubject}
                  onChange={e => setSelectedSubject(e.target.value)}
                />
              )}
            </div>

            {/* Auto-detected Dept & Year Info Pill (No manual dropdown needed!) */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Class Details (Auto)
              </label>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 8,
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                fontSize: 12.5,
                fontWeight: 600,
                color: "#334155"
              }}>
                <GraduationCap size={15} color="#4f46e5" />
                <span>Dept: <strong>{selectedDept}</strong></span>
                <span style={{ color: "#94a3b8" }}>•</span>
                <span>Year: <strong>{selectedYear}</strong> {selectedSemester ? `(Sem ${selectedSemester})` : ""}</span>
              </div>
            </div>

            {/* Section */}
            <div style={{ minWidth: 140 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Section
              </label>
              <select
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#0f172a",
                  outline: "none"
                }}
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
              >
                <option value="None">No Section (Single)</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
              </select>
            </div>

            {/* Unit Number */}
            <div style={{ minWidth: 150 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Unit Number
              </label>
              <select
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#4338ca",
                  outline: "none"
                }}
                value={selectedUnit}
                onChange={e => setSelectedUnit(e.target.value)}
              >
                {DEFAULT_UNITS.map(u => (
                  <option key={u.unit} value={u.unit}>{u.unit}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Sync with Course Contents & Plan helper notification */}
        {plannedTopics.length > 0 && (
          <div style={{
            background: "linear-gradient(90deg, #eff6ff 0%, #f0fdf4 100%)",
            border: "1px solid #bfdbfe",
            borderRadius: 10,
            padding: "10px 18px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Sparkles size={18} color="#2563eb" />
              <span style={{ fontSize: 13, color: "#1e3a8a", fontWeight: 500 }}>
                Found <strong>{plannedTopics.length} topics</strong> planned in <em>Course Contents & Plan</em> for <strong>{selectedUnit}</strong>.
              </span>
            </div>
            <button
              onClick={handleSyncFromCoursePlan}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(37, 99, 235, 0.3)"
              }}
            >
              <RefreshCw size={13} /> Sync from Course Plan
            </button>
          </div>
        )}

        {/* Main Logbook Card */}
        <div style={{
          background: "#ffffff",
          borderRadius: 14,
          padding: 24,
          border: "1px solid #e2e8f0",
          boxShadow: "0 2px 10px rgba(0,0,0,0.03)"
        }}>
          {/* Header Banner */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: 16,
            marginBottom: 20,
            borderBottom: "1px solid #e2e8f0",
            flexWrap: "wrap",
            gap: 16
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                background: "#1e293b",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: 14,
                padding: "6px 14px",
                borderRadius: 8,
                letterSpacing: "0.5px"
              }}>
                {selectedUnit}
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#0f172a", letterSpacing: "0.5px" }}>
                RECORD OF CLASSWORK
              </h2>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, maxWidth: 520 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>UNIT TITLE:</span>
              <input
                type="text"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  color: "#0f172a",
                  outline: "none"
                }}
                placeholder="e.g. Introduction & Basic Concepts"
                value={unitTitle}
                onChange={e => setUnitTitle(e.target.value)}
              />
            </div>
          </div>

          {/* Topics Table */}
          <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e2e8f0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "center", color: "#334155" }}>
                  <th style={{ padding: "11px 8px", width: 44, fontWeight: 700 }}>S.NO</th>
                  <th style={{ padding: "11px 8px", width: 120, fontWeight: 700 }}>PLANNED DATE</th>
                  <th style={{ padding: "11px 8px", width: 120, fontWeight: 700 }}>ACTUAL DATE</th>
                  <th style={{ padding: "11px 8px", width: 90, minWidth: 85, fontWeight: 700 }}>PERIOD</th>
                  <th style={{ padding: "11px 12px", textAlign: "left", minWidth: 260, fontWeight: 700 }}>TOPICS COVERED</th>
                  <th style={{ padding: "11px 8px", width: 160, fontWeight: 700 }}>MODE OF DELIVERY</th>
                  <th style={{ padding: "11px 8px", width: 160, fontWeight: 700 }}>TEACHING AIDS</th>
                  <th style={{ padding: "11px 8px", width: 150, fontWeight: 700 }}>ITLM METHOD</th>
                  <th style={{ padding: "11px 8px", width: 45, fontWeight: 700 }}>DEL</th>
                </tr>
              </thead>
              <tbody>
                {topicRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "24px", color: "#94a3b8" }}>
                      No topics added yet for this unit. Click <strong>+ Add Classwork Topic Row</strong> or <strong>Sync from Course Plan</strong> above.
                    </td>
                  </tr>
                ) : (
                  topicRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#fafbfd" }}>
                      <td style={{ textAlign: "center", fontWeight: 700, padding: "8px 6px", color: "#64748b" }}>
                        {idx + 1}
                      </td>

                      {/* Planned Date */}
                      <td style={{ padding: "6px 8px" }}>
                        <input
                          type="date"
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 6,
                            padding: "6px 8px",
                            fontSize: 12,
                            background: "#ffffff",
                            color: "#334155"
                          }}
                          value={row.plannedDate}
                          onChange={e => handleTopicChange(idx, "plannedDate", e.target.value)}
                        />
                      </td>

                      {/* Actual Date */}
                      <td style={{ padding: "6px 8px" }}>
                        <input
                          type="date"
                          style={{
                            width: "100%",
                            border: calendarBlockedMap[row.actualDate] ? "2px solid #ef4444" : "1px solid #86efac",
                            borderRadius: 6,
                            padding: "6px 8px",
                            fontSize: 12,
                            fontWeight: 600,
                            background: calendarBlockedMap[row.actualDate] ? "#fef2f2" : "#f0fdf4",
                            color: calendarBlockedMap[row.actualDate] ? "#991b1b" : "#166534"
                          }}
                          value={row.actualDate}
                          onChange={e => handleTopicChange(idx, "actualDate", e.target.value)}
                        />
                        {calendarBlockedMap[row.actualDate] && (
                          <div style={{ fontSize: 10, color: "#dc2626", fontWeight: 700, marginTop: 3, lineHeight: "1.2" }}>
                            ⛔ Suspended ({calendarBlockedMap[row.actualDate].title})
                          </div>
                        )}
                      </td>

                      {/* Period */}
                      <td style={{ padding: "6px 6px", minWidth: 80 }}>
                        <select
                          style={{
                            width: "100%",
                            minWidth: 70,
                            border: "1px solid #cbd5e1",
                            borderRadius: 6,
                            padding: "6px 4px 6px 10px",
                            fontSize: 12.5,
                            fontWeight: 700,
                            background: "#ffffff",
                            color: "#0f172a",
                            cursor: "pointer"
                          }}
                          value={row.period}
                          onChange={e => handleTopicChange(idx, "period", e.target.value)}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                            <option key={p} value={p}>P{p}</option>
                          ))}
                        </select>
                      </td>

                      {/* Topics Covered (Dropdown from Course Plan) */}
                      <td style={{ padding: "6px 10px" }}>
                        {plannedTopics.length > 0 && !row.isCustom ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <select
                              style={{
                                width: "100%",
                                border: "1px solid #cbd5e1",
                                borderRadius: 6,
                                padding: "7px 10px",
                                fontSize: 12.5,
                                fontWeight: 600,
                                color: row.topic ? "#0f172a" : "#64748b",
                                background: "#ffffff",
                                cursor: "pointer",
                                outline: "none"
                              }}
                              value={row.topic || ""}
                              onChange={e => {
                                if (e.target.value === "__custom__") {
                                  handleTopicChange(idx, "isCustom", true);
                                  handleTopicChange(idx, "topic", "");
                                } else {
                                  handleTopicChange(idx, "topic", e.target.value);
                                }
                              }}
                            >
                              <option value="">-- Select Planned Topic --</option>
                              {plannedTopics.map((pt, i) => {
                                const val = pt.subtopic ? `${pt.topic} - ${pt.subtopic}` : pt.topic;
                                return (
                                  <option key={i} value={val}>
                                    {val}
                                  </option>
                                );
                              })}
                              <option value="__custom__" style={{ color: "#2563eb", fontWeight: 700 }}>
                                ✍️ + Type Custom Topic...
                              </option>
                            </select>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                              type="text"
                              style={{
                                flex: 1,
                                border: "1px solid #cbd5e1",
                                borderRadius: 6,
                                padding: "7px 10px",
                                fontSize: 12.5,
                                fontWeight: 600,
                                color: "#0f172a",
                                background: "#ffffff",
                                outline: "none"
                              }}
                              placeholder="Enter topic covered..."
                              value={row.topic}
                              onChange={e => handleTopicChange(idx, "topic", e.target.value)}
                            />
                            {plannedTopics.length > 0 && (
                              <button
                                type="button"
                                title="Switch to dropdown list"
                                onClick={() => handleTopicChange(idx, "isCustom", false)}
                                style={{
                                  background: "#eff6ff",
                                  border: "1px solid #bfdbfe",
                                  color: "#2563eb",
                                  borderRadius: 6,
                                  padding: "5px 8px",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap"
                                }}
                              >
                                Dropdown
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Mode of Delivery */}
                      <td style={{ padding: "6px 8px" }}>
                        <select
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 6,
                            padding: "6px 6px",
                            fontSize: 11.5,
                            background: "#ffffff"
                          }}
                          value={row.mode}
                          onChange={e => handleTopicChange(idx, "mode", e.target.value)}
                        >
                          {CONTENT_DELIVERY_MODES.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </td>

                      {/* Teaching Aids */}
                      <td style={{ padding: "6px 8px" }}>
                        <select
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 6,
                            padding: "6px 6px",
                            fontSize: 11.5,
                            background: "#ffffff"
                          }}
                          value={row.aid}
                          onChange={e => handleTopicChange(idx, "aid", e.target.value)}
                        >
                          {TEACHING_AIDS.map(a => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                      </td>

                      {/* ITLM */}
                      <td style={{ padding: "6px 8px" }}>
                        <select
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 6,
                            padding: "6px 6px",
                            fontSize: 11.5,
                            background: "#ffffff"
                          }}
                          value={row.itlm}
                          onChange={e => handleTopicChange(idx, "itlm", e.target.value)}
                        >
                          {ITLM_METHODS.map(itlm => (
                            <option key={itlm} value={itlm}>{itlm}</option>
                          ))}
                        </select>
                      </td>

                      {/* Delete */}
                      <td style={{ textAlign: "center", padding: "6px 4px" }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveTopicRow(idx)}
                          style={{
                            background: "#fee2e2",
                            border: "none",
                            borderRadius: 4,
                            color: "#dc2626",
                            cursor: "pointer",
                            padding: 6,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                          title="Delete row"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Add Row Button */}
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={handleAddTopicRow}
              style={{
                background: "#f8fafc",
                border: "1px dashed #94a3b8",
                borderRadius: 8,
                padding: "8px 18px",
                fontSize: 12.5,
                fontWeight: 600,
                color: "#475569",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s ease"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "#eff6ff";
                e.currentTarget.style.borderColor = "#3b82f6";
                e.currentTarget.style.color = "#2563eb";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "#f8fafc";
                e.currentTarget.style.borderColor = "#94a3b8";
                e.currentTarget.style.color = "#475569";
              }}
            >
              <Plus size={15} /> Add Classwork Topic Row
            </button>
          </div>

          {/* SECTION: CONTENT BEYOND SYLLABUS */}
          <div style={{ marginTop: 32, borderTop: "1px solid #e2e8f0", paddingTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: "#0f172a", letterSpacing: "0.5px" }}>
                    CONTENT BEYOND SYLLABUS
                  </h3>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: "#fef3c7",
                    color: "#b45309",
                    padding: "2px 7px",
                    borderRadius: 4
                  }}>
                    Industry Readiness & NBA
                  </span>
                </div>
                <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: 12 }}>
                  Special topics taught beyond standard syllabus to bridge industry gaps
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddBeyondRow}
                style={{
                  background: "#f8fafc",
                  border: "1px dashed #94a3b8",
                  borderRadius: 6,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5
                }}
              >
                <Plus size={13} /> Add Beyond Syllabus Topic
              </button>
            </div>

            {beyondRows.length > 0 && (
              <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "center", color: "#334155" }}>
                      <th style={{ padding: "10px 8px", width: 44, fontWeight: 700 }}>S.NO</th>
                      <th style={{ padding: "10px 8px", width: 120, fontWeight: 700 }}>PLANNED DATE</th>
                      <th style={{ padding: "10px 8px", width: 120, fontWeight: 700 }}>ACTUAL DATE</th>
                      <th style={{ padding: "10px 8px", width: 90, minWidth: 85, fontWeight: 700 }}>PERIOD</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", minWidth: 260, fontWeight: 700 }}>ADVANCED / INDUSTRY TOPIC</th>
                      <th style={{ padding: "10px 8px", width: 160, fontWeight: 700 }}>MODE OF DELIVERY</th>
                      <th style={{ padding: "10px 8px", width: 160, fontWeight: 700 }}>TEACHING AIDS</th>
                      <th style={{ padding: "10px 8px", width: 150, fontWeight: 700 }}>ITLM METHOD</th>
                      <th style={{ padding: "10px 8px", width: 45, fontWeight: 700 }}>DEL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {beyondRows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#fafbfd" }}>
                        <td style={{ textAlign: "center", fontWeight: 700, padding: "8px 6px", color: "#64748b" }}>
                          {topicRows.length + idx + 1}
                        </td>

                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="date"
                            style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 8px", fontSize: 12 }}
                            value={row.plannedDate}
                            onChange={e => handleBeyondChange(idx, "plannedDate", e.target.value)}
                          />
                        </td>

                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="date"
                            style={{
                              width: "100%",
                              border: calendarBlockedMap[row.actualDate] ? "2px solid #ef4444" : "1px solid #86efac",
                              borderRadius: 6,
                              padding: "6px 8px",
                              fontSize: 12,
                              fontWeight: 600,
                              background: calendarBlockedMap[row.actualDate] ? "#fef2f2" : "#f0fdf4",
                              color: calendarBlockedMap[row.actualDate] ? "#991b1b" : "#166534"
                            }}
                            value={row.actualDate}
                            onChange={e => handleBeyondChange(idx, "actualDate", e.target.value)}
                          />
                          {calendarBlockedMap[row.actualDate] && (
                            <div style={{ fontSize: 10, color: "#dc2626", fontWeight: 700, marginTop: 3, lineHeight: "1.2" }}>
                              ⛔ Suspended ({calendarBlockedMap[row.actualDate].title})
                            </div>
                          )}
                        </td>

                        <td style={{ padding: "6px 6px", minWidth: 80 }}>
                          <select
                            style={{
                              width: "100%",
                              minWidth: 70,
                              border: "1px solid #cbd5e1",
                              borderRadius: 6,
                              padding: "6px 4px 6px 10px",
                              fontSize: 12.5,
                              fontWeight: 700,
                              background: "#ffffff",
                              color: "#0f172a",
                              cursor: "pointer"
                            }}
                            value={row.period}
                            onChange={e => handleBeyondChange(idx, "period", e.target.value)}
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                              <option key={p} value={p}>P{p}</option>
                            ))}
                          </select>
                        </td>

                        <td style={{ padding: "6px 10px" }}>
                          <input
                            type="text"
                            style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "7px 10px", fontSize: 12.5, fontWeight: 700, color: "#6366f1" }}
                            placeholder="e.g. Advanced AI Applications in Precision Farming"
                            value={row.topic}
                            onChange={e => handleBeyondChange(idx, "topic", e.target.value)}
                          />
                        </td>

                        <td style={{ padding: "6px 8px" }}>
                          <select
                            style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 6px", fontSize: 11.5 }}
                            value={row.mode}
                            onChange={e => handleBeyondChange(idx, "mode", e.target.value)}
                          >
                            {CONTENT_DELIVERY_MODES.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </td>

                        <td style={{ padding: "6px 8px" }}>
                          <select
                            style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 6px", fontSize: 11.5 }}
                            value={row.aid}
                            onChange={e => handleBeyondChange(idx, "aid", e.target.value)}
                          >
                            {TEACHING_AIDS.map(a => (
                              <option key={a} value={a}>{a}</option>
                            ))}
                          </select>
                        </td>

                        <td style={{ padding: "6px 8px" }}>
                          <select
                            style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 6px", fontSize: 11.5 }}
                            value={row.itlm}
                            onChange={e => handleBeyondChange(idx, "itlm", e.target.value)}
                          >
                            {ITLM_METHODS.map(itlm => (
                              <option key={itlm} value={itlm}>{itlm}</option>
                            ))}
                          </select>
                        </td>

                        <td style={{ textAlign: "center", padding: "6px 4px" }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveBeyondRow(idx)}
                            style={{ background: "#fee2e2", border: "none", borderRadius: 4, color: "#dc2626", cursor: "pointer", padding: 6 }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SUMMARY & METRICS CARDS */}
          <div style={{ marginTop: 24, borderTop: "1px solid #e2e8f0", paddingTop: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 18 }}>
              {/* Planned Hours */}
              <div style={{
                background: "#f8fafc",
                borderRadius: 10,
                padding: "14px 18px",
                border: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Periods Planned</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>From syllabus / lesson plan</div>
                </div>
                <input
                  type="number"
                  style={{
                    width: 65,
                    textAlign: "center",
                    fontWeight: 800,
                    fontSize: 16,
                    color: "#1e293b",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    padding: "4px 8px",
                    background: "#ffffff"
                  }}
                  value={periodsPlanned}
                  onChange={e => setPeriodsPlanned(e.target.value)}
                />
              </div>

              {/* Handled Hours */}
              <div style={{
                background: "#f0fdf4",
                borderRadius: 10,
                padding: "14px 18px",
                border: "1px solid #bbf7d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>Periods Handled</div>
                  <div style={{ fontSize: 12, color: "#15803d" }}>Regular + Beyond Syllabus</div>
                </div>
                <div style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#166534",
                  background: "#ffffff",
                  padding: "4px 14px",
                  borderRadius: 6,
                  border: "1px solid #86efac"
                }}>
                  {periodsHandledCount}
                </div>
              </div>
            </div>

            {/* Reason for deviation */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                Reason For Deviation (if any):
              </label>
              <textarea
                rows={2}
                style={{
                  width: "100%",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 13,
                  outline: "none",
                  fontFamily: "inherit"
                }}
                placeholder="Mention any deviations, extra periods needed, or scheduling adjustments..."
                value={reasonForDeviation}
                onChange={e => setReasonForDeviation(e.target.value)}
              />
            </div>

            {/* Verification & Signatures Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              {/* Card 1: Course Instructor */}
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                <div style={{ fontWeight: 700, fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Course Instructor</div>
                <div style={{ fontSize: 13, color: "#15803d", fontWeight: 700, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <CheckCircle2 size={16} /> Signed by {recordFacultyName || userProfile?.name || "Staff"}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {submittedAt ? `Submitted: ${new Date(submittedAt).toLocaleDateString("en-IN")}` : "Digital Signature on Save"}
                </div>
              </div>

              {/* Card 2: Class In-Charge */}
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                <div style={{ fontWeight: 700, fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Class In-Charge</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginTop: 4 }}>
                  {classInchargeInfo?.facultyName ? `Prof. ${classInchargeInfo.facultyName}` : "Class In-Charge"}
                </div>
                <div style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  marginTop: 6,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 10px",
                  borderRadius: 12,
                  background: inchargeStatus === "Verified" ? "#dcfce7" : "#fef3c7",
                  color: inchargeStatus === "Verified" ? "#166534" : "#b45309"
                }}>
                  {inchargeStatus === "Verified" ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                  {inchargeStatus === "Verified" ? `Verified (${inchargeVerifiedBy || "In-Charge"})` : "Pending In-Charge Review"}
                </div>
                {(isClassIncharge || isHod) && inchargeStatus !== "Verified" && (
                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={handleInchargeVerification}
                      style={{
                        padding: "5px 12px",
                        background: "#2563eb",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        boxShadow: "0 1px 2px rgba(37,99,235,0.2)"
                      }}
                    >
                      <UserCheck size={13} /> Verify as In-Charge
                    </button>
                  </div>
                )}
              </div>

              {/* Card 3: HoD / Academic Co-ordinator */}
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                <div style={{ fontWeight: 700, fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>HoD / Academic Co-ordinator</div>
                <div style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  marginTop: 6,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 10px",
                  borderRadius: 12,
                  background: hodStatus === "Approved" ? "#dcfce7" : (hodStatus === "Needs Revision" ? "#fee2e2" : "#fef3c7"),
                  color: hodStatus === "Approved" ? "#166534" : (hodStatus === "Needs Revision" ? "#991b1b" : "#b45309")
                }}>
                  {hodStatus === "Approved" ? <ShieldCheck size={13} /> : (hodStatus === "Needs Revision" ? <AlertCircle size={13} /> : <Clock size={13} />)}
                  {hodStatus === "Approved" ? `Approved (${hodApprovedBy || "HOD"})` : (hodStatus === "Needs Revision" ? "Revision Requested" : "Pending HoD Review")}
                </div>
                {hodRemarks && (
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, fontStyle: "italic" }}>
                    "{hodRemarks}"
                  </div>
                )}
                {isHod && (
                  <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => handleHodApproval("Approved")}
                      style={{
                        padding: "5px 12px",
                        background: "#16a34a",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <CheckCircle2 size={13} /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleHodApproval("Needs Revision")}
                      style={{
                        padding: "5px 10px",
                        background: "#ffffff",
                        color: "#dc2626",
                        border: "1px solid #fca5a5",
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <XCircle size={13} /> Revise
                    </button>
                  </div>
                )}
              </div>

              {/* Card 4: Principal / Dean */}
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                <div style={{ fontWeight: 700, fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Principal / Dean</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginTop: 8 }}>
                  Institutional Compliance
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Archived to Academic Log</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
