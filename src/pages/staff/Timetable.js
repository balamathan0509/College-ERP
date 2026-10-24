import React, { useState, useEffect } from "react";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, getDocs, where } from "../../supabase/supabaseAdapter";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { useNavigate } from "react-router-dom";
import { Calendar, User, BookOpen, Clock, Loader2, MapPin, CheckSquare, ArrowLeftRight, FileText } from "lucide-react";
import toast, { Toaster } from 'react-hot-toast';
import { DEFAULT_TIMETABLE_SCHEDULE, getCachedSchedule, fetchScheduleFromDB } from "../../utils/timetableSchedule";

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
  return { code: "#1e293b" };
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

export default function StaffTimetable() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [timetable, setTimetable] = useState({});
  const [loading, setLoading] = useState(false);
  const [schedule, setSchedule] = useState(() => getCachedSchedule(userProfile?.dept));

  useEffect(() => {
    if (userProfile?.uid) {
      fetchTimetable();
    }
  }, [userProfile]);

  async function fetchTimetable() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "timetable_slots"));
      
      const newTimetable = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (!data) return;

        // Match staff by UID, Email, or normalized Name
        const userUid = userProfile?.uid || userProfile?.id;
        const userName = (userProfile?.name || '').trim().toLowerCase();
        const userEmail = (userProfile?.email || '').trim().toLowerCase();

        const staffUid = data.staff_uid;
        const staffName = (data.staff_name || '').trim().toLowerCase();
        const staffEmail = (data.staff_email || '').trim().toLowerCase();

        const cleanUserName = userName.replace(/[^a-z0-9]/g, '');
        const cleanStaffName = staffName.replace(/[^a-z0-9]/g, '');

        const matchesStaff = (staffUid && userUid && String(staffUid) === String(userUid)) ||
          (staffEmail && userEmail && staffEmail === userEmail) ||
          (cleanStaffName && cleanUserName && (cleanStaffName === cleanUserName || cleanStaffName.includes(cleanUserName) || cleanUserName.includes(cleanStaffName)));

        if (matchesStaff) {
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

  const renderPeriodCell = (day, period) => {
    const slot = timetable[`${day}-${period}`];
    const theme = slot ? getSubjectColorTheme(slot.subject_code) : null;
    return (
      <td key={`${day}-${period}`} 
          style={{ 
            padding: "8px 4px", 
            borderBottom: "1px solid #e2e8f0", 
            borderRight: period < 8 ? "1px solid #e2e8f0" : "none",
            verticalAlign: "middle",
            textAlign: "center",
            background: "transparent",
            height: "56px"
          }}
      >
        {slot ? (
          <div 
            onClick={() => navigate(`/staff/period-attendance?period=${slot.period}&dept=${slot.dept}&year=${slot.year || slot.semester}&section=${slot.section || 'A'}&code=${slot.subject_code}`)}
            title={`Click to mark attendance for Period ${slot.period}\n${slot.subject_code} - ${slot.subject_name || ''}\nClass: ${slot.dept} - Sem ${slot.semester}`}
            style={{ 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center", 
              justifyContent: "center", 
              gap: "3px",
              cursor: "pointer",
              padding: "4px 2px",
              borderRadius: "6px",
              transition: "all 0.15s ease"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#f1f5f9"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
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
              {slot.dept} S{slot.semester}{slot.section && slot.section !== 'None' && slot.section !== '.' ? ` (${slot.section})` : ''}
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
      
      <div style={{ background: "white", padding: "22px 24px", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "12px", fontFamily: "Plus Jakarta Sans, sans-serif", color: "var(--text)" }}>
            <Calendar size={28} color="#1e3a8a" /> My Schedule
          </h2>
          <p style={{ margin: "6px 0 0 0", color: "var(--text-muted)", fontSize: "13.5px" }}>
            Your assigned classes across all departments. Click on any lecture slot to take period attendance.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={() => navigate("/staff/period-attendance")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 16px",
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer"
            }}
          >
            <CheckSquare size={16} /> Period Attendance
          </button>
          <button
            onClick={() => navigate("/staff/hour-alteration")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 16px",
              background: "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer"
            }}
          >
            <ArrowLeftRight size={16} /> Hour Alteration / Proxy
          </button>
          <button
            onClick={() => navigate("/staff/classwork-record")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 16px",
              background: "#0284c7",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer"
            }}
          >
            <FileText size={16} /> Classwork Logbook
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          <Loader2 className="spin" size={40} style={{ margin: "0 auto 16px" }} />
          <p>Loading Timetable...</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto", background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
            <thead>
              <tr>
                <th style={{ padding: "12px 10px", background: "#f8fafc", borderBottom: "2px solid #e2e8f0", borderRight: "1px solid #e2e8f0", width: "100px", color: "#334155", fontWeight: "600", fontSize: "13px" }}>
                  Day / Period
                </th>
                {PERIODS.map((p, idx) => (
                  <th key={`staff-head-p-${p}`} style={{ padding: "10px 4px", background: "#f8fafc", borderBottom: "2px solid #e2e8f0", borderRight: idx < PERIODS.length - 1 ? "1px solid #e2e8f0" : "none", minWidth: "95px", color: "#334155" }}>
                    <div style={{ fontWeight: "600", fontSize: "13px" }}>Period {p}</div>
                    <div style={{ fontWeight: "400", fontSize: "11px", color: "#64748b", marginTop: "3px" }}>{schedule?.periods?.[p] || ""}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day}>
                  <td style={{ padding: "12px 10px", fontWeight: "600", fontSize: "13px", color: "#1e293b", borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0", background: "#f8fafc", textAlign: "center" }}>
                    {day}
                  </td>
                  {PERIODS.map(p => renderPeriodCell(day, p))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Subject Reference Legend */}
      {!loading && (
        <div style={{ marginTop: "20px", background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "16px 20px" }}>
          <h4 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Subject Reference
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
            {[
              { short: "Agri IT", code: "AI3021", name: "IT in Agricultural System", color: "#2563eb" },
              { short: "IPD", code: "CBM348", name: "Foundation Skills in Integrated Product Dev", color: "#16a34a" },
              { short: "TQM", code: "GE3752", name: "Total Quality Management", color: "#d97706" },
              { short: "Ethics", code: "GE3791", name: "Human Values and Ethics", color: "#9333ea" }
            ].map((item) => (
              <div key={item.code} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontWeight: 700, fontSize: "12px", color: item.color, background: "white", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: "6px", minWidth: "54px", textAlign: "center" }}>
                  {item.short}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={item.name}>
                    {item.code} - {item.name}
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
