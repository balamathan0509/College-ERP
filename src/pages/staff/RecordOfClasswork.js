import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, where, getDocs, doc, setDoc } from "../../supabase/supabaseAdapter";
import toast, { Toaster } from "react-hot-toast";
import { BookOpen, Plus, Trash2, Save, Printer } from "lucide-react";
import { useLocation } from "react-router-dom";

// Standard options from Photo 3
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

const DEFAULT_UNITS = [
  { unit: "UNIT - 1", title: "" },
  { unit: "UNIT - 2", title: "" },
  { unit: "UNIT - 3", title: "Syntax Directed Translation & Intermediate Code Generation" },
  { unit: "UNIT - 4", title: "" },
  { unit: "UNIT - 5", title: "" }
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

  // Selection states
  const [selectedSubject, setSelectedSubject] = useState(paramSubject || "");
  const [selectedDept, setSelectedDept] = useState(paramDept || userProfile?.dept || "CSE");
  const [selectedYear, setSelectedYear] = useState(paramYear || "III");
  const [selectedSection, setSelectedSection] = useState(paramSection || "A");
  const [selectedUnit, setSelectedUnit] = useState("UNIT - 3");
  const [unitTitle, setUnitTitle] = useState("Syntax Directed Translation & Intermediate Code Generation");

  // Faculty's subjects list
  const [subjectList, setSubjectList] = useState([]);

  // Table rows for regular topics
  const [topicRows, setTopicRows] = useState([
    {
      plannedDate: "2026-08-07",
      actualDate: "2026-08-07",
      period: "6",
      topic: "Syntax Directed Definition",
      mode: "Lecture (L)",
      aid: "Chalk Board (CB) / White Board (WB)",
      itlm: "None / Standard"
    },
    {
      plannedDate: "2026-08-08",
      actualDate: "2026-08-08",
      period: "6",
      topic: "Construction of Syntax Tree",
      mode: "Lecture (L)",
      aid: "Chalk Board (CB) / White Board (WB)",
      itlm: "None / Standard"
    },
    {
      plannedDate: "2026-08-10",
      actualDate: "2026-08-10",
      period: "5",
      topic: "Bottom-up Evaluation of S-Attribute Definitions",
      mode: "Lecture (L)",
      aid: "Chalk Board (CB) / White Board (WB)",
      itlm: "Think - Pair - Share"
    },
    {
      plannedDate: "2026-08-17",
      actualDate: "2026-08-17",
      period: "5",
      topic: "Design of Predictive Translator",
      mode: "Lecture (L)",
      aid: "Chalk Board (CB) / White Board (WB)",
      itlm: "Interactive Lecture"
    },
    {
      plannedDate: "2026-08-18",
      actualDate: "2026-08-18",
      period: "3",
      topic: "Specification of Simple Type Checker",
      mode: "Lecture (L)",
      aid: "Chalk Board (CB) / White Board (WB)",
      itlm: "None / Standard"
    },
    {
      plannedDate: "2026-08-19",
      actualDate: "2026-08-19",
      period: "2",
      topic: "Equivalence of Type Expressions & Type Conversions",
      mode: "Lecture (L)",
      aid: "Chalk Board (CB) / White Board (WB)",
      itlm: "None / Standard"
    },
    {
      plannedDate: "2026-08-20",
      actualDate: "2026-08-20",
      period: "4",
      topic: "Intermediate Languages",
      mode: "Lecture (L)",
      aid: "Chalk Board (CB) / White Board (WB)",
      itlm: "Mind Mapping"
    },
    {
      plannedDate: "2026-08-21",
      actualDate: "2026-08-21",
      period: "3",
      topic: "Translation of Expressions",
      mode: "Lecture (L)",
      aid: "Chalk Board (CB) / White Board (WB)",
      itlm: "None / Standard"
    },
    {
      plannedDate: "2026-08-24",
      actualDate: "2026-08-24",
      period: "6",
      topic: "Back Patching",
      mode: "Lecture (L)",
      aid: "Chalk Board (CB) / White Board (WB)",
      itlm: "Group Discussion"
    }
  ]);

  // Content Beyond Syllabus Rows (Photo 1 line 31)
  const [beyondRows, setBeyondRows] = useState([
    {
      plannedDate: "2026-08-25",
      actualDate: "2026-08-25",
      period: "3",
      topic: "Advanced Code Generation Techniques",
      mode: "Lecture (L)",
      aid: "Chalk Board (CB) / White Board (WB)",
      itlm: "Interactive Lecture"
    }
  ]);

  // Summary fields
  const [periodsPlanned, setPeriodsPlanned] = useState("10");
  const [reasonForDeviation, setReasonForDeviation] = useState("");
  const [saving, setSaving] = useState(false);

  // Verification info
  const [hodStatus, setHodStatus] = useState("Pending Review");

  useEffect(() => {
    fetchStaffSubjects();
  }, [userProfile]);

  useEffect(() => {
    if (selectedSubject && selectedUnit) {
      loadClassworkRecord();
    }
  }, [selectedSubject, selectedUnit, selectedDept, selectedYear, selectedSection]);

  // Pre-fill if came with period & date from attendance
  useEffect(() => {
    if (paramPeriod && paramDate) {
      // Check if row exists for this date, if not add
      const exists = topicRows.some(r => r.actualDate === paramDate && String(r.period) === String(paramPeriod));
      if (!exists && paramPeriod) {
        setTopicRows(prev => [
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
        ]);
      }
    }
  }, [paramPeriod, paramDate]);

  async function fetchStaffSubjects() {
    try {
      // Fetch from timetable_slots
      const snap = await getDocs(collection(db, "timetable_slots"));
      const userUid = userProfile?.uid;
      const userName = (userProfile?.name || "").trim().toLowerCase();
      const userEmail = (userProfile?.email || "").trim().toLowerCase();

      const map = new Map();
      snap.docs.forEach(d => {
        const data = d.data();
        if (!data) return;

        const staffUid = data.staff_uid;
        const staffName = (data.staff_name || "").trim().toLowerCase();
        const staffEmail = (data.staff_email || "").trim().toLowerCase();

        const matches = (staffUid && String(staffUid) === String(userUid)) ||
          (staffEmail && staffEmail === userEmail) ||
          (staffName && userName && (staffName === userName || staffName.includes(userName) || userName.includes(staffName)));

        if (matches && data.subject_code) {
          map.set(data.subject_code, {
            code: data.subject_code,
            name: data.subject_name || data.subject_code,
            dept: data.dept,
            year: data.year || data.semester,
            section: data.section || "A"
          });
        }
      });

      const list = Array.from(map.values());
      setSubjectList(list);
      if (list.length > 0 && !selectedSubject) {
        setSelectedSubject(list[0].code);
        setSelectedDept(list[0].dept);
        setSelectedYear(list[0].year);
        setSelectedSection(list[0].section);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadClassworkRecord() {
    if (!selectedSubject) return;
    try {
      const docId = `classwork_${selectedSubject}_${selectedDept}_${selectedYear}_${selectedSection}_${selectedUnit}`.replace(/\s+/g, "_");
      const q = query(collection(db, "classwork_records"), where("recordId", "==", docId));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const data = snap.docs[0].data();
        if (data.topicRows && data.topicRows.length > 0) setTopicRows(data.topicRows);
        if (data.beyondRows) setBeyondRows(data.beyondRows);
        if (data.unitTitle) setUnitTitle(data.unitTitle);
        if (data.periodsPlanned) setPeriodsPlanned(data.periodsPlanned);
        if (data.reasonForDeviation) setReasonForDeviation(data.reasonForDeviation);
        if (data.hodStatus) setHodStatus(data.hodStatus);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function handleAddTopicRow() {
    setTopicRows(prev => [
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
    setSaving(true);
    try {
      const docId = `classwork_${selectedSubject}_${selectedDept}_${selectedYear}_${selectedSection}_${selectedUnit}`.replace(/\s+/g, "_");
      const totalHandled = topicRows.length + beyondRows.length;

      const payload = {
        recordId: docId,
        subjectCode: selectedSubject,
        dept: selectedDept,
        year: selectedYear,
        section: selectedSection,
        unit: selectedUnit,
        unitTitle: unitTitle.trim(),
        facultyId: userProfile?.uid,
        facultyName: userProfile?.name,
        topicRows: topicRows,
        beyondRows: beyondRows,
        periodsPlanned: periodsPlanned,
        periodsHandled: totalHandled,
        reasonForDeviation: reasonForDeviation.trim(),
        hodStatus: hodStatus || "Pending Review",
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, "classwork_records", docId), payload, { merge: true });
      toast.success("Record of Classwork saved successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save classwork record.");
    }
    setSaving(false);
  }

  const periodsHandledCount = topicRows.length + beyondRows.length;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />

        {/* Page Top Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(79, 70, 229, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#4f46e5" }}>
                <BookOpen size={24} />
              </div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text)" }}>Record of Classwork (Logbook)</h1>
                <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 14 }}>
                  Unit-wise lecture topic tracking, delivery modes, teaching aids, and syllabus coverage
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              className="btn-secondary"
              onClick={() => window.print()}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600 }}
            >
              <Printer size={16} /> Print Logbook
            </button>
            <button
              className="btn-primary"
              onClick={handleSaveRecord}
              disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 24px", fontSize: 13, fontWeight: 700 }}
            >
              <Save size={16} /> {saving ? "Saving..." : "Save Record"}
            </button>
          </div>
        </div>

        {/* Filters Card */}
        <div className="card" style={{ padding: "18px 24px", marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            {/* Subject */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Subject / Course</label>
              {subjectList.length > 0 ? (
                <select
                  className="input-field"
                  style={{ width: "100%", padding: "9px 12px", fontSize: 13, fontWeight: 600 }}
                  value={selectedSubject}
                  onChange={e => {
                    setSelectedSubject(e.target.value);
                    const matched = subjectList.find(s => s.code === e.target.value);
                    if (matched) {
                      setSelectedDept(matched.dept);
                      setSelectedYear(matched.year);
                      setSelectedSection(matched.section);
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
                  className="input-field"
                  style={{ width: "100%", padding: "9px 12px", fontSize: 13, fontWeight: 600 }}
                  placeholder="e.g. CS8501"
                  value={selectedSubject}
                  onChange={e => setSelectedSubject(e.target.value)}
                />
              )}
            </div>

            {/* Department */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Department</label>
              <select className="input-field" style={{ width: "100%", padding: "9px 12px", fontSize: 13, fontWeight: 600 }} value={selectedDept} onChange={e => setSelectedDept(e.target.value)}>
                {["CSE", "ECE", "MECH", "IT", "CIVIL", "AIDS", "EEE"].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Year */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Year</label>
              <select className="input-field" style={{ width: "100%", padding: "9px 12px", fontSize: 13, fontWeight: 600 }} value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                {["I", "II", "III", "IV"].map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>

            {/* Section */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Section</label>
              <select className="input-field" style={{ width: "100%", padding: "9px 12px", fontSize: 13, fontWeight: 600 }} value={selectedSection} onChange={e => setSelectedSection(e.target.value)}>
                <option value="None">No Section (Single Class)</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
              </select>
            </div>

            {/* Unit */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Unit Number</label>
              <select className="input-field" style={{ width: "100%", padding: "9px 12px", fontSize: 13, fontWeight: 600 }} value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)}>
                {DEFAULT_UNITS.map(u => <option key={u.unit} value={u.unit}>{u.unit}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* LOGBOOK FORM (Exact Replication of Photo 1) */}
        <div className="card" style={{ padding: 28, background: "#ffffff", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", borderRadius: 12, border: "1px solid #e2e8f0" }}>
          {/* Header Banner */}
          <div style={{ textAlign: "center", borderBottom: "2px solid #0f172a", paddingBottom: 16, marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "1.5px", margin: 0, color: "#0f172a", textTransform: "uppercase" }}>
              RECORD OF CLASSWORK
            </h2>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#334155" }}>
                {selectedUnit}
              </div>
              <div style={{ flex: 1, maxWidth: 540, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>TITLE:</span>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: "100%", padding: "6px 12px", fontSize: 13, fontWeight: 600 }}
                  value={unitTitle}
                  onChange={e => setUnitTitle(e.target.value)}
                  placeholder="e.g. Syntax Directed Translation & Intermediate Code Generation"
                />
              </div>
            </div>
          </div>

          {/* Main Log Table (Photo 1) */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderTop: "2px solid #0f172a", borderBottom: "2px solid #0f172a", textAlign: "center", color: "#0f172a" }}>
                  <th style={{ padding: "10px 6px", borderRight: "1px solid #cbd5e1", width: 44 }}>S.NO</th>
                  <th style={{ padding: "10px 6px", borderRight: "1px solid #cbd5e1", width: 110 }}>PLANNED DATE</th>
                  <th style={{ padding: "10px 6px", borderRight: "1px solid #cbd5e1", width: 110 }}>ACTUAL DATE</th>
                  <th style={{ padding: "10px 6px", borderRight: "1px solid #cbd5e1", width: 65 }}>PERIOD</th>
                  <th style={{ padding: "10px 8px", borderRight: "1px solid #cbd5e1", textAlign: "left", minWidth: 220 }}>TOPICS COVERED</th>
                  <th style={{ padding: "10px 6px", borderRight: "1px solid #cbd5e1", width: 150 }}>MODE OF DELIVERY</th>
                  <th style={{ padding: "10px 6px", borderRight: "1px solid #cbd5e1", width: 150 }}>TEACHING AIDS</th>
                  <th style={{ padding: "10px 6px", borderRight: "1px solid #cbd5e1", width: 140 }}>ITLM METHOD</th>
                  <th style={{ padding: "10px 6px", width: 50 }}>DEL</th>
                </tr>
              </thead>
              <tbody>
                {topicRows.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ textAlign: "center", fontWeight: 700, padding: "8px 4px", borderRight: "1px solid #cbd5e1", color: "#475569" }}>
                      {idx + 1}
                    </td>

                    {/* Planned Date */}
                    <td style={{ padding: "6px 4px", borderRight: "1px solid #cbd5e1" }}>
                      <input
                        type="date"
                        style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 4, padding: "4px 6px", fontSize: 12 }}
                        value={row.plannedDate}
                        onChange={e => handleTopicChange(idx, "plannedDate", e.target.value)}
                      />
                    </td>

                    {/* Actual Date */}
                    <td style={{ padding: "6px 4px", borderRight: "1px solid #cbd5e1" }}>
                      <input
                        type="date"
                        style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 4, padding: "4px 6px", fontSize: 12, fontWeight: 600, color: "#166534" }}
                        value={row.actualDate}
                        onChange={e => handleTopicChange(idx, "actualDate", e.target.value)}
                      />
                    </td>

                    {/* Period */}
                    <td style={{ padding: "6px 4px", borderRight: "1px solid #cbd5e1" }}>
                      <select
                        style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 4, padding: "4px 6px", fontSize: 12, textAlign: "center", fontWeight: 700 }}
                        value={row.period}
                        onChange={e => handleTopicChange(idx, "period", e.target.value)}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </td>

                    {/* Topic */}
                    <td style={{ padding: "6px 8px", borderRight: "1px solid #cbd5e1" }}>
                      <input
                        type="text"
                        style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 4, padding: "5px 8px", fontSize: 12.5, fontWeight: 600, color: "#0f172a" }}
                        placeholder="Enter topic covered..."
                        value={row.topic}
                        onChange={e => handleTopicChange(idx, "topic", e.target.value)}
                      />
                    </td>

                    {/* Mode of Delivery (Photo 3) */}
                    <td style={{ padding: "6px 4px", borderRight: "1px solid #cbd5e1" }}>
                      <select
                        style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 4, padding: "4px 6px", fontSize: 11.5 }}
                        value={row.mode}
                        onChange={e => handleTopicChange(idx, "mode", e.target.value)}
                      >
                        {CONTENT_DELIVERY_MODES.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </td>

                    {/* Teaching Aids (Photo 3) */}
                    <td style={{ padding: "6px 4px", borderRight: "1px solid #cbd5e1" }}>
                      <select
                        style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 4, padding: "4px 6px", fontSize: 11.5 }}
                        value={row.aid}
                        onChange={e => handleTopicChange(idx, "aid", e.target.value)}
                      >
                        {TEACHING_AIDS.map(a => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </td>

                    {/* ITLM (Photo 3) */}
                    <td style={{ padding: "6px 4px", borderRight: "1px solid #cbd5e1" }}>
                      <select
                        style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 4, padding: "4px 6px", fontSize: 11.5 }}
                        value={row.itlm}
                        onChange={e => handleTopicChange(idx, "itlm", e.target.value)}
                      >
                        {ITLM_METHODS.map(itlm => (
                          <option key={itlm} value={itlm}>{itlm}</option>
                        ))}
                      </select>
                    </td>

                    {/* Delete action */}
                    <td style={{ textAlign: "center", padding: "4px" }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveTopicRow(idx)}
                        style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer", padding: 4 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Row Button */}
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={handleAddTopicRow}
              style={{
                background: "#f1f5f9",
                border: "1px dashed #94a3b8",
                borderRadius: 6,
                padding: "8px 16px",
                fontSize: 12.5,
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Plus size={14} /> Add Classwork Topic Row
            </button>
          </div>

          {/* SECTION: CONTENT BEYOND SYLLABUS (Photo 1 line 31) */}
          <div style={{ marginTop: 28, borderTop: "2px solid #0f172a", paddingTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, letterSpacing: "1px", color: "#0f172a" }}>
                CONTENT BEYOND SYLLABUS
              </h3>
              <button
                type="button"
                onClick={handleAddBeyondRow}
                style={{
                  background: "#f1f5f9",
                  border: "1px dashed #94a3b8",
                  borderRadius: 6,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#334155",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                <Plus size={12} /> Add Beyond Syllabus Topic
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderTop: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1", textAlign: "center", color: "#0f172a" }}>
                    <th style={{ padding: "8px 6px", borderRight: "1px solid #cbd5e1", width: 44 }}>S.NO</th>
                    <th style={{ padding: "8px 6px", borderRight: "1px solid #cbd5e1", width: 110 }}>PLANNED DATE</th>
                    <th style={{ padding: "8px 6px", borderRight: "1px solid #cbd5e1", width: 110 }}>ACTUAL DATE</th>
                    <th style={{ padding: "8px 6px", borderRight: "1px solid #cbd5e1", width: 65 }}>PERIOD</th>
                    <th style={{ padding: "8px 8px", borderRight: "1px solid #cbd5e1", textAlign: "left", minWidth: 220 }}>ADVANCED / INDUSTRY TOPIC</th>
                    <th style={{ padding: "8px 6px", borderRight: "1px solid #cbd5e1", width: 150 }}>MODE OF DELIVERY</th>
                    <th style={{ padding: "8px 6px", borderRight: "1px solid #cbd5e1", width: 150 }}>TEACHING AIDS</th>
                    <th style={{ padding: "8px 6px", borderRight: "1px solid #cbd5e1", width: 140 }}>ITLM METHOD</th>
                    <th style={{ padding: "8px 6px", width: 50 }}>DEL</th>
                  </tr>
                </thead>
                <tbody>
                  {beyondRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ textAlign: "center", fontWeight: 700, padding: "8px 4px", borderRight: "1px solid #cbd5e1", color: "#475569" }}>
                        {topicRows.length + idx + 1}
                      </td>

                      <td style={{ padding: "6px 4px", borderRight: "1px solid #cbd5e1" }}>
                        <input
                          type="date"
                          style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 4, padding: "4px 6px", fontSize: 12 }}
                          value={row.plannedDate}
                          onChange={e => handleBeyondChange(idx, "plannedDate", e.target.value)}
                        />
                      </td>

                      <td style={{ padding: "6px 4px", borderRight: "1px solid #cbd5e1" }}>
                        <input
                          type="date"
                          style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 4, padding: "4px 6px", fontSize: 12, fontWeight: 600, color: "#166534" }}
                          value={row.actualDate}
                          onChange={e => handleBeyondChange(idx, "actualDate", e.target.value)}
                        />
                      </td>

                      <td style={{ padding: "6px 4px", borderRight: "1px solid #cbd5e1" }}>
                        <select
                          style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 4, padding: "4px 6px", fontSize: 12, textAlign: "center", fontWeight: 700 }}
                          value={row.period}
                          onChange={e => handleBeyondChange(idx, "period", e.target.value)}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </td>

                      <td style={{ padding: "6px 8px", borderRight: "1px solid #cbd5e1" }}>
                        <input
                          type="text"
                          style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 4, padding: "5px 8px", fontSize: 12.5, fontWeight: 700, color: "#4f46e5" }}
                          placeholder="e.g. Advanced Code Generation Techniques"
                          value={row.topic}
                          onChange={e => handleBeyondChange(idx, "topic", e.target.value)}
                        />
                      </td>

                      <td style={{ padding: "6px 4px", borderRight: "1px solid #cbd5e1" }}>
                        <select
                          style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 4, padding: "4px 6px", fontSize: 11.5 }}
                          value={row.mode}
                          onChange={e => handleBeyondChange(idx, "mode", e.target.value)}
                        >
                          {CONTENT_DELIVERY_MODES.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </td>

                      <td style={{ padding: "6px 4px", borderRight: "1px solid #cbd5e1" }}>
                        <select
                          style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 4, padding: "4px 6px", fontSize: 11.5 }}
                          value={row.aid}
                          onChange={e => handleBeyondChange(idx, "aid", e.target.value)}
                        >
                          {TEACHING_AIDS.map(a => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                      </td>

                      <td style={{ padding: "6px 4px", borderRight: "1px solid #cbd5e1" }}>
                        <select
                          style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 4, padding: "4px 6px", fontSize: 11.5 }}
                          value={row.itlm}
                          onChange={e => handleBeyondChange(idx, "itlm", e.target.value)}
                        >
                          {ITLM_METHODS.map(itlm => (
                            <option key={itlm} value={itlm}>{itlm}</option>
                          ))}
                        </select>
                      </td>

                      <td style={{ textAlign: "center", padding: "4px" }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveBeyondRow(idx)}
                          style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer", padding: 4 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SUMMARY & REASON FOR DEVIATION (Photo 1) */}
          <div style={{ marginTop: 24, borderTop: "2px solid #0f172a", paddingTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>No. of Periods Planned :</span>
                <input
                  type="text"
                  style={{ width: 60, textAlign: "center", fontWeight: 700, border: "2px solid #0f172a", borderRadius: 4, padding: "4px 8px", fontSize: 14 }}
                  value={periodsPlanned}
                  onChange={e => setPeriodsPlanned(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>No. of Periods Handled :</span>
                <span style={{ minWidth: 60, textAlign: "center", fontWeight: 800, background: "#f1f5f9", border: "2px solid #0f172a", borderRadius: 4, padding: "4px 12px", fontSize: 14, color: "#0f172a" }}>
                  {periodsHandledCount}
                </span>
              </div>
            </div>

            {/* Reason for deviation */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
                Reason For Deviation (if any):
              </label>
              <textarea
                rows={2}
                style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "8px 12px", fontSize: 13 }}
                placeholder="Mention any deviations, extra periods needed, or scheduling adjustments..."
                value={reasonForDeviation}
                onChange={e => setReasonForDeviation(e.target.value)}
              />
            </div>

            {/* Signatures / Approval Flow (Photo 1) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", border: "1px solid #cbd5e1", borderRadius: 6, textAlign: "center" }}>
              <div style={{ padding: "16px 12px", borderRight: "1px solid #cbd5e1" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>Course Instructor</div>
                <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, marginTop: 8 }}>
                  ✓ Signed by {userProfile?.name || "Staff"}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>*to be signed with date</div>
              </div>

              <div style={{ padding: "16px 12px", borderRight: "1px solid #cbd5e1" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>HoD / Academic Co-ordinator</div>
                <div style={{ fontSize: 12, color: hodStatus === "Approved" ? "#16a34a" : "#d97706", fontWeight: 600, marginTop: 8 }}>
                  Status: {hodStatus}
                </div>
              </div>

              <div style={{ padding: "16px 12px" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>Principal</div>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginTop: 8 }}>
                  Acknowledged
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
