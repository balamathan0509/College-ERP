import React, { useState, useEffect } from "react";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, getDocs, where } from "../../supabase/supabaseAdapter";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { Calendar, User, BookOpen, Clock, Loader2 } from "lucide-react";
import toast, { Toaster } from 'react-hot-toast';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function StudentTimetable() {
  const { userProfile } = useAuth();
  const [timetable, setTimetable] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Assuming student profile has these fields, or we use defaults if missing
    // Need to handle cases where student doesn't have these defined properly yet
    const dept = userProfile?.dept || userProfile?.department || "CSE";
    const degree = userProfile?.degree || "B.E";
    const semester = userProfile?.semester || 1;
    const section = userProfile?.section || "A";
    
    if (dept && degree && semester && section) {
      fetchTimetable(dept, degree, semester, section);
    }
  }, [userProfile]);

  async function fetchTimetable(dept, degree, semester, section) {
    setLoading(true);
    try {
      const q = query(collection(db, "timetable_slots"), 
        where("dept", "==", dept),
        where("degree", "==", degree),
        where("semester", "==", semester),
        where("section", "==", section),
        where("status", "==", "published") // Students only see published
      );
      
      const snap = await getDocs(q);
      
      const newTimetable = {};
      snap.docs.forEach(d => {
        const data = d.data();
        newTimetable[`${data.day}-${data.period}`] = data;
      });
      setTimetable(newTimetable);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load timetable.");
    }
    setLoading(false);
  }

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
            {userProfile?.degree || "B.E"} - {userProfile?.dept || "CSE"} | Sem {userProfile?.semester || 1} - Sec {userProfile?.section || "A"}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          <Loader2 className="spin" size={40} style={{ margin: "0 auto 16px" }} />
          <p>Loading Timetable...</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto", background: "white", borderRadius: "12px", border: "1px solid var(--border)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1000px" }}>
            <thead>
              <tr>
                <th style={{ padding: "16px", background: "#f8fafc", borderBottom: "2px solid var(--border)", borderRight: "1px solid var(--border)", width: "120px", color: "var(--text)", fontWeight: "bold" }}>Day / Period</th>
                {PERIODS.map(p => (
                  <th key={p} style={{ padding: "16px", background: "#f8fafc", borderBottom: "2px solid var(--border)", borderRight: p < 8 ? "1px solid var(--border)" : "none", width: "11%", color: "var(--text)", fontWeight: "bold" }}>
                    Period {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day}>
                  <td style={{ padding: "16px", fontWeight: "bold", borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)", background: "#f8fafc" }}>
                    {day}
                  </td>
                  {PERIODS.map(period => {
                    const slot = timetable[`${day}-${period}`];
                    return (
                      <td key={`${day}-${period}`} 
                          style={{ 
                            padding: "12px", 
                            borderBottom: "1px solid var(--border)", 
                            borderRight: period < 8 ? "1px solid var(--border)" : "none",
                            verticalAlign: "top",
                            background: slot ? '#eff6ff' : 'transparent',
                          }}
                      >
                        {slot ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px" }}>
                            <div style={{ fontWeight: 600, color: "var(--primary)", display: "flex", alignItems: "center", gap: "4px" }}>
                              <BookOpen size={14} /> {slot.subject_code}
                            </div>
                            <div style={{ color: "var(--text)", display: "flex", alignItems: "center", gap: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              <User size={14} style={{ flexShrink: 0 }} /> {slot.staff_name}
                            </div>
                            <div style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                              <Clock size={14} /> Room: {slot.room}
                            </div>
                          </div>
                        ) : (
                          <div style={{ height: "60px", display: "flex", alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontSize: "13px" }}>
                            -
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
