// src/pages/student/Timetable.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

export default function StudentTimetable() {
  const { userProfile } = useAuth();
  const [tab, setTab] = useState("regular");
  const [timetable, setTimetable] = useState({});
  const [examType, setExamType] = useState("Internal Exam");
  const [examRows, setExamRows] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [updatedBy, setUpdatedBy] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  async function fetchRegular() {
    setFetching(true);
    try {
      const q = query(
        collection(db, "timetable"),
        where("dept", "==", userProfile.dept),
        where("year", "==", userProfile.year),
        where("type", "==", "Regular")
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setTimetable(data.schedule || {});
        setUpdatedBy(data.updatedBy || "");
        setUpdatedAt(data.updatedAt || "");
      } else {
        setTimetable({});
      }
    } catch (err) {}
    setFetching(false);
  }

  async function fetchExam() {
    setFetching(true);
    try {
      const q = query(
        collection(db, "timetable"),
        where("dept", "==", userProfile.dept),
        where("type", "==", examType),
        where("year", "==", userProfile.year)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        const rows = (data.examRows || []).filter(r => !r.year || r.year === userProfile.year);
        setExamRows(rows);
        setUpdatedBy(data.updatedBy || "");
        setUpdatedAt(data.updatedAt || "");
      } else {
        setExamRows([]);
      }
    } catch (err) {}
    setFetching(false);
  }

  function downloadExamExcel() {
    const data = examRows.map((r, i) => ({
      "S.No": i + 1,
      "Date": r.date,
      "Session": r.section,
      "Sub Code": r.subCode,
      "Subject Name": r.subjectName,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, examType);
    XLSX.writeFile(wb, `${userProfile.dept}_${userProfile.year}_${examType}.xlsx`);
  }

  function handleDownloadRegularPDF() {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`${userProfile.dept} ${userProfile.year} Regular Timetable`, 14, 15);

    const headers = ["Day", ...PERIODS.map(p => p.isBreak ? p.breakLabel : p.label)];
    const rows = DAYS.map(day => [
      day,
      ...PERIODS.map(p => p.isBreak ? "" : (timetable[day]?.[p.label] || "—"))
    ]);

    autoTable(doc, {
      startY: 22,
      head: [headers],
      body: rows,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [229, 69, 96], textColor: 255 },
      columnStyles: { 0: { cellWidth: 30, halign: "left" } }
    });

    doc.save(`${userProfile.dept}_${userProfile.year}_Regular_Timetable.pdf`);
  }

  function handleDownloadExamPDF() {
    const doc = new jsPDF({ orientation: "portrait" });
    doc.setFontSize(14);
    doc.text(`${userProfile.dept} ${userProfile.year} ${examType}`, 14, 15);

    const headers = ["S.No", "Date", "Session", "Sub Code", "Subject Name"];
    const rows = examRows.map((r, idx) => [
      idx + 1,
      r.date ? new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—",
      r.section || "—",
      r.subCode || "—",
      r.subjectName || "—"
    ]);

    autoTable(doc, {
      startY: 22,
      head: [headers],
      body: rows,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [72, 187, 120], textColor: 255 }
    });

    doc.save(`${userProfile.dept}_${userProfile.year}_${examType.replace(/\s+/g, "_")}.pdf`);
  }

  useEffect(() => {
    if (tab === "regular") fetchRegular();
    else fetchExam();
  }, [tab, examType]);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">

        <div className="page-header">
          <h1>📅 My Timetable</h1>
          <p>{userProfile?.dept} • {userProfile?.year}</p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {["regular", "exam"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "10px 24px", borderRadius: 10, border: "none",
              cursor: "pointer", fontFamily: "Syne", fontWeight: 600, fontSize: 14,
              background: tab === t ? "#e94560" : "rgba(255,255,255,0.07)",
              color: "white", transition: "all 0.2s",
            }}>
              {t === "regular" ? "📚 Regular" : "📝 Exam Timetable"}
            </button>
          ))}
        </div>

        {updatedAt && (
          <div style={{ color: "#a0aec0", fontSize: 13, marginBottom: 16 }}>
            Last updated by <strong style={{ color: "#e2e8f0" }}>{updatedBy}</strong> on {new Date(updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </div>
        )}

        {fetching ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div className="spinner" style={{ margin: "0 auto" }}></div>
          </div>

        ) : tab === "regular" ? (
          // ════════ REGULAR TAB ════════
          Object.keys(timetable).length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
              <p style={{ color: "#a0aec0" }}>No regular timetable posted yet.</p>
            </div>
          ) : (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                <h3 style={{ fontFamily: "Syne", fontSize: 18 }}>Regular Timetable — {userProfile?.year}</h3>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={handleDownloadRegularPDF} style={{
                    padding: "8px 18px", borderRadius: 8,
                    border: "1px solid rgba(72,187,120,0.3)",
                    background: "rgba(72,187,120,0.1)", color: "#48bb78",
                    cursor: "pointer", fontWeight: 600, fontSize: 13,
                  }}>📄 Download PDF</button>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase", minWidth: 110 }}>Day</th>
                      {PERIODS.map((p, i) => (
                        <th key={i} style={{
                          padding: "10px 6px", textAlign: "center", fontSize: 11, fontWeight: 600,
                          minWidth: p.isBreak ? 70 : 100,
                          color: p.isBreak ? "#f5a623" : "#a0aec0",
                          background: p.isBreak ? "rgba(245,166,35,0.07)" : "transparent",
                        }}>
                          {p.isBreak ? p.breakLabel : p.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map(day => (
                      <tr key={day} style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        background: day === today ? "rgba(233,69,96,0.04)" : "transparent",
                      }}>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 700, fontFamily: "Syne", fontSize: 14, color: day === today ? "#e94560" : "#e2e8f0" }}>
                            {day === today ? "👉 " : ""}{day}
                            {day === today && (
                              <span style={{ fontSize: 11, color: "#a0aec0", fontFamily: "DM Sans", fontWeight: 400, display: "block" }}>Today</span>
                            )}
                          </div>
                        </td>
                        {PERIODS.map((period, i) => {
                          const subject = !period.isBreak ? (timetable[day]?.[period.label] || "") : null;
                          return (
                            <td key={i} style={{ padding: "8px 4px", textAlign: "center", background: period.isBreak ? "rgba(245,166,35,0.05)" : "transparent" }}>
                              {period.isBreak ? (
                                <div style={{ color: "rgba(245,166,35,0.3)", fontSize: 16 }}>—</div>
                              ) : subject ? (
                                <div style={{
                                  padding: "8px 6px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                                  background: "rgba(233,69,96,0.12)", border: "1px solid rgba(233,69,96,0.25)", color: "white",
                                }}>{subject}</div>
                              ) : (
                                <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 18 }}>—</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )

        ) : (
          // ════════ EXAM TAB ════════
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              {["Internal Exam", "Semester Exam"].map(t => (
                <button key={t} onClick={() => setExamType(t)} style={{
                  padding: "10px 20px", borderRadius: 10, border: "none",
                  cursor: "pointer", fontFamily: "Syne", fontWeight: 600, fontSize: 14,
                  background: examType === t ? (t === "Internal Exam" ? "#f5a623" : "#e94560") : "rgba(255,255,255,0.07)",
                  color: "white", transition: "all 0.2s",
                }}>
                  {t === "Internal Exam" ? "📝 Internal Exam" : "📋 Semester Exam"}
                </button>
              ))}
            </div>

            {examRows.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 60 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                <p style={{ color: "#a0aec0" }}>No {examType} timetable posted yet.</p>
              </div>
            ) : (
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                  <h3 style={{ fontFamily: "Syne", fontSize: 18 }}>{examType} — {userProfile?.year}</h3>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={downloadExamExcel} style={{
                      padding: "8px 18px", borderRadius: 8,
                      border: "1px solid rgba(66,153,225,0.3)",
                      background: "rgba(66,153,225,0.1)", color: "#4299e1",
                      cursor: "pointer", fontWeight: 600, fontSize: 13,
                    }}>📊 Download Excel</button>
                    <button onClick={handleDownloadExamPDF} style={{
                      padding: "8px 18px", borderRadius: 8,
                      border: "1px solid rgba(72,187,120,0.3)",
                      background: "rgba(72,187,120,0.1)", color: "#48bb78",
                      cursor: "pointer", fontWeight: 600, fontSize: 13,
                    }}>📄 Download PDF</button>
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                        {["S.No", "Date", "Session", "Sub Code", "Subject Name"].map((h, i) => (
                          <th key={i} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {examRows.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 14 }}>{idx + 1}</td>
                          <td style={{ padding: "14px 16px", fontWeight: 600, fontSize: 15 }}>
                            {row.date ? new Date(row.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <span style={{
                              padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                              background: row.section?.includes("FN") ? "rgba(66,153,225,0.15)" : "rgba(245,166,35,0.15)",
                              color: row.section?.includes("FN") ? "#4299e1" : "#f5a623",
                            }}>
                              {row.section?.includes("FN") ? "🌅 FN 10:00AM–11:30AM" : "🌆 AN 2:30PM–4:00PM"}
                            </span>
                          </td>
                          <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 14, fontWeight: 600 }}>{row.subCode}</td>
                          <td style={{ padding: "14px 16px", fontWeight: 600, fontSize: 15 }}>{row.subjectName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

      </main>
    </div>
  );
}