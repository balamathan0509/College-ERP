import React, { useState, useEffect } from "react";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, getDocs, setDoc, doc, where, deleteDoc } from "../../supabase/supabaseAdapter";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Sidebar";
import { Calendar, Save, Trash2, CheckCircle, AlertTriangle, User, BookOpen, Clock, Loader2, Info } from "lucide-react";
import toast, { Toaster } from 'react-hot-toast';

const DEGREES = ["B.E", "B.Tech", "M.E", "MBA", "MCA"];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const SECTIONS = ["A", "B", "C", "D", "E", "None"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function TimetableEditor() {
  const { userProfile } = useAuth();
  
  // Selection State
  const [semester, setSemester] = useState(1);
  const [section, setSection] = useState("A");
  
  // Data State
  const [courses, setCourses] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [timetable, setTimetable] = useState({}); // Key: `${day}-${period}`, Value: Slot object
  
  // Loading State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Modal State
  const [activeCell, setActiveCell] = useState(null); // { day, period }
  const [slotForm, setSlotForm] = useState({ subject_code: "", staff_uid: "", room: "" });
  const [conflicts, setConflicts] = useState([]);

  useEffect(() => {
    if (userProfile?.dept) {
      fetchMasterData();
    }
  }, [userProfile]);

  useEffect(() => {
    if (userProfile?.dept && semester && section) {
      fetchTimetable();
    }
  }, [semester, section, userProfile]);

  async function fetchMasterData() {
    try {
      // Fetch all courses
      const courseSnap = await getDocs(collection(db, "courses"));
      setCourses(courseSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      // Fetch all staff across all departments (to allow cross-department assignment)
      const facQ = query(collection(db, "users"), where("role", "in", ["staff", "hod"]));
      const facSnap = await getDocs(facQ);
      setFaculty(facSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
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

  const openSlotModal = (day, period) => {
    const existing = timetable[`${day}-${period}`];
    setActiveCell({ day, period });
    if (existing) {
      setSlotForm({
        subject_code: existing.subject_code || "",
        staff_uid: existing.staff_uid || "",
        room: existing.room || ""
      });
    } else {
      setSlotForm({ subject_code: "", staff_uid: "", room: "" });
    }
    setConflicts([]);
  };

  const closeSlotModal = () => {
    setActiveCell(null);
    setConflicts([]);
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
    if (!slotForm.subject_code || !slotForm.staff_uid || !slotForm.room) {
      toast.error("Please fill all fields");
      return;
    }

    setSaving(true);
    const selectedCourse = courses.find(c => c.courseCode === slotForm.subject_code || c.id === slotForm.subject_code);
    const selectedStaff = faculty.find(f => f.uid === slotForm.staff_uid);
    
    // Check conflicts
    const conflictList = await checkConflicts(slotForm.staff_uid, slotForm.room, activeCell.day, activeCell.period);
    
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
      staff_uid: selectedStaff?.uid || "",
      staff_name: selectedStaff?.name || "",
      staff_dept: selectedStaff?.dept || "",
      room: slotForm.room,
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

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f3f4f6" }}>
      <Sidebar />
      <div className="main-content" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <Toaster position="top-right" />
      
      <div style={{ background: "white", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "12px", fontFamily: "Plus Jakarta Sans, sans-serif", color: "var(--text)" }}>
            <Calendar size={28} color="#1e3a8a" /> Department Timetable Editor
          </h2>
          <p style={{ margin: "8px 0 0 0", color: "var(--text-muted)" }}>Manage schedules, avoid clashes, and publish timetables for {userProfile?.dept}</p>
        </div>
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

      <div style={{ background: "white", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "24px", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: "150px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px" }}>Department</label>
          <div style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)", background: "#f8fafc", color: "var(--text-muted)", fontWeight: "bold" }}>
            {userProfile?.dept}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: "150px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px" }}>Semester</label>
          <select value={semester} onChange={e => setSemester(Number(e.target.value))} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)" }}>
            {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: "150px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px" }}>Section</label>
          <select value={section} onChange={e => setSection(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)" }}>
            {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
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
                          onClick={() => openSlotModal(day, period)}
                          style={{ 
                            padding: "12px", 
                            borderBottom: "1px solid var(--border)", 
                            borderRight: period < 8 ? "1px solid var(--border)" : "none",
                            cursor: "pointer",
                            verticalAlign: "top",
                            background: slot ? (slot.status === 'published' ? '#f0fdf4' : '#eff6ff') : 'transparent',
                            transition: "background 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            if (!slot) e.currentTarget.style.background = "#f1f5f9";
                          }}
                          onMouseLeave={(e) => {
                            if (!slot) e.currentTarget.style.background = "transparent";
                          }}
                      >
                        {slot ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px" }}>
                            <div style={{ fontWeight: 600, color: "var(--primary)", display: "flex", alignItems: "center", gap: "4px" }}>
                              <BookOpen size={14} /> {slot.subject_code}
                            </div>
                            <div style={{ color: "var(--text)", display: "flex", alignItems: "center", gap: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              <User size={14} style={{ flexShrink: 0 }} /> {slot.staff_name} ({slot.staff_dept})
                            </div>
                            <div style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                              <Clock size={14} /> Room: {slot.room}
                            </div>
                          </div>
                        ) : (
                          <div style={{ height: "60px", display: "flex", alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontSize: "13px" }}>
                            Empty Slot
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
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 500 }}>Subject (Cross-Dept enabled)</label>
                <select 
                  value={slotForm.subject_code} 
                  onChange={e => setSlotForm({...slotForm, subject_code: e.target.value})}
                  style={{ width: "100%", padding: "12px", borderRadius: "6px", border: "1px solid var(--border)" }}
                >
                  <option value="">-- Select Subject --</option>
                  {courses.filter(c => String(c.semester) === String(semester)).map(c => (
                    <option key={c.id} value={c.courseCode || c.id}>{c.courseCode} - {c.courseName} ({c.department})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 500 }}>Staff (Cross-Dept enabled)</label>
                <select 
                  value={slotForm.staff_uid} 
                  onChange={e => setSlotForm({...slotForm, staff_uid: e.target.value})}
                  style={{ width: "100%", padding: "12px", borderRadius: "6px", border: "1px solid var(--border)" }}
                >
                  <option value="">-- Select Staff --</option>
                  {faculty.map(f => (
                    <option key={f.uid} value={f.uid}>{f.name} ({f.dept})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 500 }}>Room No.</label>
                <input 
                  type="text" 
                  value={slotForm.room}
                  onChange={e => setSlotForm({...slotForm, room: e.target.value})}
                  placeholder="e.g. M201"
                  style={{ width: "100%", padding: "12px", borderRadius: "6px", border: "1px solid var(--border)", boxSizing: "border-box" }}
                />
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
        </div>
      </div>
    </div>
  );
}
