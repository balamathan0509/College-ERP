// src/pages/student/Timetable.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Calendar,
  FileSpreadsheet,
  FileText,
  Clock,
  Coffee,
  Utensils,
  Inbox
} from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
        where("year", "==", userProfile.year),
        where("type", "==", "Exam"),
        where("examType", "==", examType)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setExamRows(data.examRows || []);
        setUpdatedBy(data.updatedBy || "");
        setUpdatedAt(data.updatedAt || "");
      } else {
        setExamRows([]);
      }
    } catch (err) {}
    setFetching(false);
  }

  useEffect(() => {
    if (!userProfile) return;
    if (tab === "regular") fetchRegular();
    else fetchExam();
  }, [tab, examType, userProfile]);

  function exportRegularExcel() {
    const rows = DAYS.map(day => {
      const rowObj = { Day: day };
      PERIODS.forEach(p => {
        rowObj[p.label] = p.isBreak ? p.breakLabel : (timetable[day]?.[p.label] || "—");
      });
      return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Regular Timetable");
    XLSX.writeFile(workbook, `${userProfile.dept}_${userProfile.year}_Timetable.xlsx`);
  }

  function exportRegularPDF() {
    const doc = new jsPDF("l", "pt", "a4");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`${userProfile.dept} - ${userProfile.year} Class Timetable`, 40, 40);

    const headers = [["Day", ...PERIODS.map(p => p.isBreak ? p.breakLabel : p.label)]];
    const body = DAYS.map(day => [
      day,
      ...PERIODS.map(p => p.isBreak ? p.breakLabel : (timetable[day]?.[p.label] || "—"))
    ]);

    autoTable(doc, {
      startY: 60,
      head: headers,
      body,
      styles: { fontSize: 8, cellPadding: 6, alignment: "center" },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 }
    });

    doc.save(`${userProfile.dept}_${userProfile.year}_Timetable.pdf`);
  }

  function exportExamExcel() {
    if (examRows.length === 0) return;
    const rows = examRows.map((r, i) => ({
      "S.No": i + 1,
      "Date": r.date || "",
      "Session": r.session || "",
      "Subject Code": r.code || "",
      "Subject Name": r.subject || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Exam Schedule");
    XLSX.writeFile(workbook, `${userProfile.dept}_${userProfile.year}_Exam_Schedule.xlsx`);
  }

  function exportExamPDF() {
    if (examRows.length === 0) return;
    const doc = new jsPDF("p", "pt", "a4");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`${userProfile.dept} - ${userProfile.year} ${examType} Schedule`, 40, 40);

    const headers = [["S.No", "Date", "Session", "Subject Code", "Subject Name"]];
    const body = examRows.map((r, i) => [i + 1, r.date, r.session, r.code, r.subject]);

    autoTable(doc, {
      startY: 60,
      head: headers,
      body,
      styles: { fontSize: 10, cellPadding: 8 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 }
    });

    doc.save(`${userProfile.dept}_${userProfile.year}_Exam_Schedule.pdf`);
  }

  const todayIndex = new Date().getDay();
  const dayMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const today = dayMap[todayIndex];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Class Schedule & Exams</h1>
          <p>{userProfile?.dept} Department • Year {userProfile?.year}</p>
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
            Class Timetable
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
            Exam Schedule
          </button>
        </div>

        {/* REGULAR TIMETABLE TAB */}
        {tab === "regular" && (
          fetching ? (
            <div style={{ textAlign: "center", padding: 60 }}>
              <div className="spinner" style={{ margin: "0 auto" }}></div>
            </div>
          ) : Object.keys(timetable).length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 50 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <Inbox size={48} color="var(--text-muted)" />
              </div>
              <p style={{ color: "var(--text-muted)" }}>No timetable published yet for {userProfile?.dept} • {userProfile?.year}.</p>
            </div>
          ) : (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
                <div>
                  <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>
                    Weekly Class Schedule
                  </h3>
                  {updatedAt && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      Last updated: {new Date(updatedAt).toLocaleDateString("en-IN")} • By {updatedBy}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    className="btn-secondary"
                    onClick={exportRegularExcel}
                    style={{ margin: 0, padding: "8px 14px", fontSize: 13, width: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <FileSpreadsheet size={14} /> Excel
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={exportRegularPDF}
                    style={{ margin: 0, padding: "8px 14px", fontSize: 13, width: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <FileText size={14} /> PDF
                  </button>
                </div>
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
                      <tr key={day} style={{ background: day === today ? "rgba(37, 99, 235, 0.08)" : "transparent" }}>
                        <td style={{ fontWeight: 700 }}>
                          <span style={{ color: day === today ? "var(--highlight)" : "var(--text)" }}>{day}</span>
                          {day === today && <div style={{ fontSize: 10, color: "var(--highlight)", fontWeight: 600 }}>TODAY</div>}
                        </td>
                        {PERIODS.map((period, i) => {
                          const subject = !period.isBreak ? (timetable[day]?.[period.label] || "") : null;
                          return (
                            <td key={i} style={{ textAlign: "center", background: period.isBreak ? "rgba(245,158,11,0.04)" : "transparent" }}>
                              {period.isBreak ? (
                                <div style={{ color: "var(--warning)", fontSize: 11, display: "flex", justifyContent: "center", alignItems: "center", gap: 4 }}>
                                  {period.breakLabel.includes("Lunch") ? <Utensils size={12} /> : <Coffee size={12} />}
                                  {period.breakLabel}
                                </div>
                              ) : subject ? (
                                <div style={{
                                  padding: "6px 8px", borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 600,
                                  background: "rgba(37, 99, 235, 0.12)", border: "1px solid rgba(37, 99, 235, 0.25)", color: "var(--text)"
                                }}>{subject}</div>
                              ) : (
                                <div style={{ color: "var(--border)", fontSize: 14 }}>—</div>
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
        )}

        {/* EXAM TIMETABLE TAB */}
        {tab === "exam" && (
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", margin: 0 }}>Exam Type:</label>
                  <select value={examType} onChange={e => setExamType(e.target.value)} style={{ width: "auto" }}>
                    <option value="Internal Exam">Internal Exam</option>
                    <option value="Model Exam">Model Exam</option>
                    <option value="Semester Exam">Semester Exam</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn-secondary" onClick={exportExamExcel} style={{ margin: 0, padding: "8px 14px", fontSize: 13, width: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <FileSpreadsheet size={14} /> Excel
                  </button>
                  <button className="btn-secondary" onClick={exportExamPDF} style={{ margin: 0, padding: "8px 14px", fontSize: 13, width: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <FileText size={14} /> PDF
                  </button>
                </div>
              </div>
            </div>

            {fetching ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : examRows.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 50 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                  <Inbox size={48} color="var(--text-muted)" />
                </div>
                <p style={{ color: "var(--text-muted)" }}>No {examType} schedule published yet.</p>
              </div>
            ) : (
              <div className="card">
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Date</th>
                        <th>Session</th>
                        <th>Subject Code</th>
                        <th>Subject Title</th>
                      </tr>
                    </thead>
                    <tbody>
                      {examRows.map((r, i) => (
                        <tr key={i}>
                          <td style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                          <td style={{ fontWeight: 600 }}>{r.date}</td>
                          <td>
                            <span className="badge" style={{ background: "rgba(37, 99, 235, 0.12)", color: "var(--highlight)", border: "1px solid rgba(37, 99, 235, 0.3)" }}>
                              {r.session}
                            </span>
                          </td>
                          <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{r.code}</td>
                          <td style={{ fontWeight: 600 }}>{r.subject}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}