// src/pages/hod/Timetable.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SECTIONS = ["FN (10:00AM - 11:30AM)", "AN (2:30PM - 4:00PM)"];

const PERIODS = [
  { label: "9:10 - 9:55", isBreak: false },
  { label: "9:55 - 10:40", isBreak: false },
  { label: "10:45 - 11:00", isBreak: true, breakLabel: "☕ Short Break" },
  { label: "11:00 - 11:45", isBreak: false },
  { label: "11:45 - 12:30", isBreak: false },
  { label: "12:50 - 1:30", isBreak: true, breakLabel: "🍽️ Lunch Break" },
  { label: "1:30 - 2:15", isBreak: false },
  { label: "2:15 - 3:00", isBreak: false },
  { label: "2:50 - 3:00", isBreak: true, breakLabel: "☕ Short Break" },
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

export default function HodTimetable() {
  const { userProfile } = useAuth();
  const [tab, setTab] = useState("regular");

  // Shared across BOTH tabs
  const [selectedYear, setSelectedYear] = useState("1st Year");

  // Regular tab
  const [timetable, setTimetable] = useState({});
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Exam tab
  const [examType, setExamType] = useState("Internal Exam");
  const [examRows, setExamRows] = useState([emptyExamRow("1st Year")]);
  const [examSaving, setExamSaving] = useState(false);
  const [examSaved, setExamSaved] = useState(false);

  async function fetchRegular() {
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
      if (!snap.empty) setTimetable(snap.docs[0].data().schedule || {});
      else setTimetable({});
    } catch (err) {}
    setFetching(false);
  }

  async function fetchExam() {
    setExamSaved(false);
    try {
      const q = query(
        collection(db, "timetable"),
        where("dept", "==", userProfile.dept),
        where("type", "==", examType),
        where("year", "==", selectedYear)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setExamRows(snap.docs[0].data().examRows || [emptyExamRow(selectedYear)]);
      } else {
        setExamRows([emptyExamRow(selectedYear)]);
      }
    } catch (err) {}
  }

  // When selectedYear changes, update all existing exam rows' year field automatically
  useEffect(() => {
    setExamRows(prev => prev.map(row => ({ ...row, year: selectedYear })));
  }, [selectedYear]);

  function handleCellChange(day, periodLabel, value) {
    setTimetable(prev => ({
      ...prev,
      [day]: { ...(prev[day] || {}), [periodLabel]: value },
    }));
  }

  function handleExamRowChange(idx, field, value) {
    setExamRows(prev =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  }

  async function saveRegular() {
    setSaving(true);
    try {
      const docId = `${userProfile.dept}_${selectedYear}_Regular`.replace(/\s+/g, "_");
      await setDoc(doc(db, "timetable", docId), {
        dept: userProfile.dept,
        year: selectedYear,
        type: "Regular",
        schedule: timetable,
        updatedBy: userProfile.name,
        updatedAt: new Date().toISOString(),
      });
      setSaved(true);
    } catch (err) {}
    setSaving(false);
  }

  async function saveExam() {
    setExamSaving(true);
    try {
      const docId = `${userProfile.dept}_${examType}_${selectedYear}`.replace(/\s+/g, "_");
      await setDoc(doc(db, "timetable", docId), {
        dept: userProfile.dept,
        type: examType,
        year: selectedYear,
        examRows,
        updatedBy: userProfile.name,
        updatedAt: new Date().toISOString(),
      });
      setExamSaved(true);
    } catch (err) {}
    setExamSaving(false);
  }

  function downloadExamExcel() {
    const data = examRows.map((r, i) => ({
      "S.No": i + 1,
      "Date": r.date,
      "Session": r.section,
      "Sub Code": r.subCode,
      "Subject Name": r.subjectName,
      "Year": r.year,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, examType);
    XLSX.writeFile(wb, `${userProfile.dept}_${examType}_${selectedYear}.xlsx`);
  }

  function handlePrintRegular() {
    const printWindow = window.open("", "_blank");
    const headers = PERIODS.map(p => {
      if (p.isBreak)
        return `<th style="padding:8px 4px;font-size:10px;color:#f5a623;background:#fff8e1;min-width:65px;border:1px solid #e2e8f0;">${p.breakLabel}</th>`;
      return `<th style="padding:8px 6px;font-size:10px;color:#4a5568;background:#f7fafc;min-width:90px;border:1px solid #e2e8f0;">${p.label}</th>`;
    }).join("");
    const rows = DAYS.map(day => {
      const cells = PERIODS.map(p => {
        if (p.isBreak)
          return `<td style="background:#fff8e1;text-align:center;color:#f5a623;font-size:11px;padding:6px 2px;border:1px solid #e2e8f0;">${p.breakLabel}</td>`;
        const val = timetable[day]?.[p.label] || "";
        return `<td style="padding:8px 6px;text-align:center;font-size:12px;border:1px solid #e2e8f0;${val ? "background:#fff5f7;color:#c53030;font-weight:600;" : "color:#a0aec0;"}">${val || "—"}</td>`;
      }).join("");
      return `<tr><td style="padding:8px 14px;font-weight:700;color:#c53030;font-size:13px;border:1px solid #e2e8f0;background:#fff5f7;">${day}</td>${cells}</tr>`;
    }).join("");
    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>${userProfile.dept} — ${selectedYear} Regular Timetable</title>
      <style>
        body{font-family:Arial,sans-serif;margin:20px;color:#2d3748;}
        h2{color:#c53030;margin-bottom:4px;font-size:18px;}
        .meta{color:#718096;font-size:12px;margin-bottom:16px;}
        table{border-collapse:collapse;width:100%;}
        @page{size:A4 landscape;margin:12mm;}
      </style>
    </head><body>
      <h2>📅 ${userProfile.dept} Department — ${selectedYear} Regular Timetable</h2>
      <p class="meta">Printed on: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>
      <table><thead><tr>
        <th style="padding:10px 14px;background:#f7fafc;font-size:12px;color:#4a5568;border:1px solid #e2e8f0;text-align:left;">Day</th>
        ${headers}
      </tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
    printWindow.document.close();
    printWindow.print();
  }

  function handlePrintExam() {
    const printWindow = window.open("", "_blank");
    const rows = examRows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.date ? new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
        <td>${r.section}</td>
        <td><strong>${r.subCode || "—"}</strong></td>
        <td>${r.subjectName || "—"}</td>
        <td>${r.year || selectedYear}</td>
      </tr>`).join("");
    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>${userProfile.dept} — ${examType} — ${selectedYear}</title>
      <style>
        body{font-family:Arial,sans-serif;margin:30px;color:#2d3748;}
        h2{color:#c53030;margin-bottom:4px;font-size:18px;}
        .meta{color:#718096;font-size:12px;margin-bottom:20px;}
        table{border-collapse:collapse;width:100%;}
        th{background:#fff5f7;color:#c53030;padding:10px 14px;text-align:left;border:1px solid #fed7d7;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;}
        td{padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;}
        tr:nth-child(even) td{background:#f7fafc;}
        @page{size:A4 portrait;margin:15mm;}
      </style>
    </head><body>
      <h2>📝 ${userProfile.dept} — ${examType} — ${selectedYear}</h2>
      <p class="meta">Printed on: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>
      <table><thead><tr>
        <th>S.No</th><th>Date</th><th>Session</th><th>Sub Code</th><th>Subject Name</th><th>Year</th>
      </tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
    printWindow.document.close();
    printWindow.print();
  }

  useEffect(() => { fetchRegular(); }, [selectedYear]);
  useEffect(() => { fetchExam(); }, [examType, selectedYear]);

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">

        <div className="page-header">
          <h1>📅 Timetable Management</h1>
          <p>{userProfile?.dept} Department — HOD View</p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          {["regular", "exam"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "10px 28px", borderRadius: 10, border: "none",
              cursor: "pointer", fontFamily: "Syne", fontWeight: 600, fontSize: 14,
              background: tab === t ? "#e94560" : "rgba(255,255,255,0.07)",
              color: "white", transition: "all 0.2s",
            }}>
              {t === "regular" ? "📚 Regular Timetable" : "📝 Exam Timetable"}
            </button>
          ))}
        </div>

        {/* ── Shared Year Selector — visible on BOTH tabs ── */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="form-group" style={{ margin: 0, maxWidth: 300 }}>
            <label>Select Year</label>
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* ════════ REGULAR TAB ════════ */}
        {tab === "regular" && (
          <>
            {fetching ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : (
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                  <h3 style={{ fontFamily: "Syne", fontSize: 18 }}>Regular — {selectedYear}</h3>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button onClick={saveRegular} disabled={saving} className="btn-primary" style={{ width: "auto", padding: "10px 24px" }}>
                      {saving ? "Saving..." : "💾 Save"}
                    </button>
                    {saved && <span style={{ color: "#48bb78", fontWeight: 600, fontSize: 14 }}>✅ Saved!</span>}
                    <button onClick={handlePrintRegular} style={{
                      padding: "10px 24px", borderRadius: 10,
                      border: "1px solid rgba(168,85,247,0.3)",
                      background: "rgba(168,85,247,0.1)", color: "#a855f7",
                      cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "Syne",
                    }}>🖨️ Print</button>
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                        <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase", minWidth: 110 }}>Day</th>
                        {PERIODS.map((p, i) => (
                          <th key={i} style={{ padding: "10px 6px", textAlign: "center", fontSize: 11, fontWeight: 600, minWidth: p.isBreak ? 70 : 100, color: p.isBreak ? "#f5a623" : "#a0aec0", background: p.isBreak ? "rgba(245,166,35,0.07)" : "transparent" }}>
                            {p.isBreak ? p.breakLabel : p.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map(day => (
                        <tr key={day} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <td style={{ padding: "10px 16px", fontWeight: 700, fontFamily: "Syne", fontSize: 14, color: "#e94560" }}>{day}</td>
                          {PERIODS.map((period, i) => (
                            <td key={i} style={{ padding: "6px 4px", background: period.isBreak ? "rgba(245,166,35,0.05)" : "transparent" }}>
                              {period.isBreak ? (
                                <div style={{ textAlign: "center", color: "rgba(245,166,35,0.3)", fontSize: 16 }}>—</div>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="Subject"
                                  value={timetable[day]?.[period.label] || ""}
                                  onChange={e => handleCellChange(day, period.label, e.target.value)}
                                  style={{
                                    width: "100%", padding: "8px 6px",
                                    background: timetable[day]?.[period.label] ? "rgba(233,69,96,0.1)" : "rgba(255,255,255,0.04)",
                                    border: timetable[day]?.[period.label] ? "1px solid rgba(233,69,96,0.3)" : "1px solid rgba(255,255,255,0.08)",
                                    borderRadius: 8, color: "white", fontSize: 12, fontFamily: "DM Sans", outline: "none",
                                  }}
                                />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════ EXAM TAB ════════ */}
        {tab === "exam" && (
          <>
            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 12 }}>
                {["Internal Exam", "Semester Exam"].map(t => (
                  <button key={t} onClick={() => setExamType(t)} style={{
                    padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer",
                    fontFamily: "Syne", fontWeight: 600, fontSize: 14,
                    background: examType === t ? (t === "Internal Exam" ? "#f5a623" : "#e94560") : "rgba(255,255,255,0.07)",
                    color: "white", transition: "all 0.2s",
                  }}>
                    {t === "Internal Exam" ? "📝 Internal Exam" : "📋 Semester Exam"}
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <h3 style={{ fontFamily: "Syne", fontSize: 18 }}>
                  {examType} — {userProfile?.dept} —{" "}
                  <span style={{ color: "#e94560" }}>{selectedYear}</span>
                </h3>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={downloadExamExcel} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(66,153,225,0.3)", background: "rgba(66,153,225,0.1)", color: "#4299e1", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>📊 Download Excel</button>
                  <button onClick={handlePrintExam} style={{
                    padding: "10px 20px", borderRadius: 10,
                    border: "1px solid rgba(168,85,247,0.3)",
                    background: "rgba(168,85,247,0.1)", color: "#a855f7",
                    cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "Syne",
                  }}>🖨️ Print</button>
                  <button onClick={saveExam} disabled={examSaving} className="btn-primary" style={{ width: "auto", padding: "10px 24px" }}>
                    {examSaving ? "Saving..." : "💾 Save"}
                  </button>
                  {examSaved && <span style={{ color: "#48bb78", fontWeight: 600, fontSize: 14 }}>✅ Saved!</span>}
                </div>
              </div>

              {/* Year badge */}
              <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#a0aec0" }}>Exam rows for:</span>
                <span style={{
                  padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                  background: "rgba(233,69,96,0.15)", color: "#e94560",
                  border: "1px solid rgba(233,69,96,0.3)",
                }}>{selectedYear}</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>(Change year from the selector above)</span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      {["S.No", "Date", "Session", "Sub Code", "Subject Name", ""].map((h, i) => (
                        <th key={i} style={{ padding: "12px 12px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {examRows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "8px 12px", color: "#a0aec0", fontSize: 14 }}>{idx + 1}</td>
                        <td style={{ padding: "6px 8px" }}>
                          <input type="date" value={row.date} onChange={e => handleExamRowChange(idx, "date", e.target.value)}
                            style={{ padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white", fontSize: 13, outline: "none", fontFamily: "DM Sans" }} />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <select value={row.section} onChange={e => handleExamRowChange(idx, "section", e.target.value)}
                            style={{ padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white", fontSize: 13, outline: "none", fontFamily: "DM Sans" }}>
                            {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input type="text" placeholder="CS3452" value={row.subCode} onChange={e => handleExamRowChange(idx, "subCode", e.target.value)}
                            style={{ width: 100, padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white", fontSize: 13, outline: "none", fontFamily: "DM Sans" }} />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input type="text" placeholder="Subject Name" value={row.subjectName} onChange={e => handleExamRowChange(idx, "subjectName", e.target.value)}
                            style={{ width: 220, padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white", fontSize: 13, outline: "none", fontFamily: "DM Sans" }} />
                        </td>
                        {/* Year column removed — auto-set from selectedYear */}
                        <td style={{ padding: "6px 8px" }}>
                          <button onClick={() => setExamRows(prev => prev.filter((_, i) => i !== idx))}
                            style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(252,129,129,0.3)", background: "rgba(252,129,129,0.1)", color: "#fc8181", cursor: "pointer", fontSize: 16 }}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button onClick={() => setExamRows(prev => [...prev, emptyExamRow(selectedYear)])} style={{
                marginTop: 16, padding: "10px 20px", borderRadius: 10,
                border: "1px solid rgba(72,187,120,0.3)", background: "rgba(72,187,120,0.1)",
                color: "#48bb78", cursor: "pointer", fontWeight: 600, fontSize: 14,
              }}>+ Add Row</button>
            </div>
          </>
        )}

      </main>
    </div>
  );
}