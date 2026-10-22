import React, { useState, useEffect } from "react";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, getDocs, where } from "../../supabase/supabaseAdapter";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { Calendar, User, BookOpen, Clock, Loader2 } from "lucide-react";
import toast, { Toaster } from 'react-hot-toast';
import { DEFAULT_TIMETABLE_SCHEDULE, getCachedSchedule, fetchScheduleFromDB, getTimetableColumns } from "../../utils/timetableSchedule";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

const COURSE_PALETTES = [
  { bg: "#eef2ff", border: "#c7d2fe", accent: "#4f46e5", code: "#3730a3", name: "#4338ca", staff: "#475569" }, // Indigo
  { bg: "#f0fdf4", border: "#bbf7d0", accent: "#16a34a", code: "#166534", name: "#15803d", staff: "#475569" }, // Emerald
  { bg: "#faf5ff", border: "#e9d5ff", accent: "#9333ea", code: "#6b21a8", name: "#7e22ce", staff: "#475569" }, // Purple
  { bg: "#fffbeb", border: "#fde68a", accent: "#d97706", code: "#92400e", name: "#b45309", staff: "#475569" }, // Amber
  { bg: "#f0fdfa", border: "#99f6e4", accent: "#0d9488", code: "#115e59", name: "#0f766e", staff: "#475569" }, // Teal
  { bg: "#fff1f2", border: "#fecdd3", accent: "#e11d48", code: "#9f1239", name: "#be123c", staff: "#475569" }, // Rose
  { bg: "#f0f9ff", border: "#bae6fd", accent: "#0284c7", code: "#075985", name: "#0369a1", staff: "#475569" }, // Sky
  { bg: "#fefce8", border: "#fef08a", accent: "#ca8a04", code: "#854d0e", name: "#a16207", staff: "#475569" }  // Warm Yellow
];

function getCourseTheme(code = "") {
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

function formatCourseTitle(name = "") {
  if (!name) return "";
  return name.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function parseSemester(sem) {
  if (!sem) return 7;
  if (typeof sem === 'number') return sem;
  const s = String(sem).trim().toUpperCase();
  if (s === 'I' || s === '1') return 1;
  if (s === 'II' || s === '2') return 2;
  if (s === 'III' || s === '3') return 3;
  if (s === 'IV' || s === '4') return 4;
  if (s === 'V' || s === '5') return 5;
  if (s === 'VI' || s === '6') return 6;
  if (s === 'VII' || s === '7') return 7;
  if (s === 'VIII' || s === '8') return 8;
  const num = parseInt(s, 10);
  return isNaN(num) ? 7 : num;
}

export default function StudentTimetable() {
  const { userProfile } = useAuth();
  const [timetable, setTimetable] = useState({});
  const [loading, setLoading] = useState(false);
  const [schedule, setSchedule] = useState(() => getCachedSchedule(userProfile?.dept || userProfile?.department));

  useEffect(() => {
    if (userProfile) {
      fetchTimetable();
      const dept = userProfile?.dept || userProfile?.department || "CSE";
      fetchScheduleFromDB(dept).then(s => {
        if (s) setSchedule(s);
      });
    }
    const handleScheduleUpdate = (e) => {
      if (e.detail) setSchedule(e.detail);
    };
    window.addEventListener("timetable_schedule_changed", handleScheduleUpdate);
    return () => window.removeEventListener("timetable_schedule_changed", handleScheduleUpdate);
  }, [userProfile]);

  async function fetchTimetable() {
    setLoading(true);
    try {
      const studentDept = userProfile?.dept || userProfile?.department || "CSE";
      const studentSem = parseSemester(userProfile?.semester);
      const studentSec = userProfile?.section && userProfile.section !== "." ? userProfile.section : "";

      const snap = await getDocs(collection(db, "timetable_slots"));
      
      const newTimetable = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (!data) return;

        // Match Dept
        const deptMatch = !data.dept || data.dept.toUpperCase() === studentDept.toUpperCase();
        // Match Semester
        const semMatch = parseSemester(data.semester) === studentSem;
        // Match Section
        const secMatch = !data.section || data.section === "None" || !studentSec || data.section === studentSec;

        if (deptMatch && semMatch && secMatch) {
          newTimetable[`${data.day}-${data.period}`] = data;
        }
      });
      setTimetable(newTimetable);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load timetable.");
    }
    setLoading(false);
  }

  const currentSem = parseSemester(userProfile?.semester);

  const renderPeriodCell = (day, period) => {
    const slot = timetable[`${day}-${period}`];
    const theme = slot ? getSubjectColorTheme(slot.subject_code) : null;
    return (
      <td key={`${day}-${period}`} 
          style={{ 
            padding: "10px 4px", 
            borderBottom: "1px solid #e2e8f0", 
            borderRight: "1px solid #e2e8f0",
            verticalAlign: "middle",
            textAlign: "center",
            background: "transparent",
            height: "56px"
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
      
      <div style={{ background: "white", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "12px", fontFamily: "Plus Jakarta Sans, sans-serif", color: "var(--text)" }}>
            <Calendar size={28} color="#1e3a8a" /> My Class Timetable
          </h2>
          <p style={{ margin: "8px 0 0 0", color: "var(--text-muted)" }}>
            {userProfile?.degree || "B.E"} - {userProfile?.dept || "CSE"} | Semester {currentSem} {userProfile?.section && userProfile.section !== '.' ? `- Sec ${userProfile.section}` : ''}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          <Loader2 className="spin" size={40} style={{ margin: "0 auto 16px" }} />
          <p>Loading Timetable...</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto", background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1000px" }}>
            <thead>
              <tr>
                <th style={{ padding: "12px 10px", background: "#f8fafc", borderBottom: "2px solid #e2e8f0", borderRight: "1px solid #e2e8f0", width: "100px", color: "#334155", fontWeight: "600", fontSize: "13px" }}>
                  Day / Period
                </th>
                {getTimetableColumns(schedule).map((col, idx, arr) => {
                  const isLast = idx === arr.length - 1;
                  if (col.type === "period") {
                    return (
                      <th key={`std-head-p-${col.period}`} style={{ padding: "10px 4px", background: "#f8fafc", borderBottom: "2px solid #e2e8f0", borderRight: isLast ? "none" : "1px solid #e2e8f0", minWidth: "95px", color: "#334155" }}>
                        <div style={{ fontWeight: "600", fontSize: "13px" }}>Period {col.period}</div>
                        <div style={{ fontWeight: "400", fontSize: "11px", color: "#64748b", marginTop: "3px" }}>{col.timing}</div>
                      </th>
                    );
                  }
                  return (
                    <th key={`std-head-brk-${col.id}-${idx}`} style={{ padding: "10px 4px", background: "#f1f5f9", borderBottom: "2px solid #e2e8f0", borderRight: isLast ? "none" : "1px solid #e2e8f0", width: col.type === "lunch" ? "80px" : "75px", color: "#475569" }}>
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
                        <td key={`std-cell-${day}-${col.id}-${idx}`} style={{ 
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
        </div>
      </div>
    </div>
  );
}
