import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, where, getDocs, doc, setDoc } from "../../supabase/supabaseAdapter";
import toast, { Toaster } from "react-hot-toast";
import { CheckSquare, Users, CheckCircle2, Briefcase, XCircle, Calendar, AlertTriangle, ArrowRight } from "lucide-react";
import { getDepartmentCalendar, getCalendarEventForDate } from "../../utils/academicCalendarUtils";
import { useNavigate } from "react-router-dom";

export default function StaffAttendance() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [selectedClassIdx, setSelectedClassIdx] = useState(0);
  
  const session = "Daily";
  const [currentDate] = useState(new Date().toISOString().split("T")[0]);
  
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [fetchingStudents, setFetchingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Academic Calendar event restriction state
  const [calendarBlockedEvent, setCalendarBlockedEvent] = useState(null);

  useEffect(() => {
    fetchAssignments();
  }, [userProfile]);

  async function fetchAssignments() {
    setLoadingAssignments(true);
    try {
      const uid = userProfile.uid;
      const today = currentDate;

      // 1. Fetch Permanent Assignments
      const permQ = query(collection(db, "class_incharges"), where("facultyId", "==", uid));
      const permSnap = await getDocs(permQ);
      let permClasses = permSnap.docs.map(d => ({ ...d.data(), type: "Permanent" }));

      // 2. Filter out permanent classes that have an active substitute today
      const subExclusionQ = query(collection(db, "substitute_incharges"), where("permanentFacultyId", "==", uid));
      const subExclusionSnap = await getDocs(subExclusionQ);
      const activeExclusions = subExclusionSnap.docs
        .map(d => d.data())
        .filter(s => s.fromDate <= today && s.toDate >= today);
      
      permClasses = permClasses.filter(pc => 
        !activeExclusions.some(ex => ex.dept === pc.dept && ex.year === pc.year && ex.section === pc.section)
      );

      // 3. Fetch Substitute Assignments for this user
      const subActiveQ = query(collection(db, "substitute_incharges"), where("substituteFacultyId", "==", uid));
      const subActiveSnap = await getDocs(subActiveQ);
      const activeSubs = subActiveSnap.docs
        .map(d => d.data())
        .filter(s => s.fromDate <= today && s.toDate >= today)
        .map(s => ({ ...s, type: "Substitute" }));

      // Combine
      const allAssigned = [...permClasses, ...activeSubs].sort((a,b) => a.year.localeCompare(b.year));
      setAssignedClasses(allAssigned);
      if (allAssigned.length > 0) setSelectedClassIdx(0);
    } catch (err) {
      toast.error("Failed to fetch assigned classes.");
    }
    setLoadingAssignments(false);
  }

  const selectedClass = assignedClasses[selectedClassIdx];

  useEffect(() => {
    if (selectedClass) {
      fetchStudents(selectedClass);
    }
  }, [selectedClassIdx, assignedClasses]);

  async function fetchStudents(cls) {
    setFetchingStudents(true);
    setSaved(false);
    setCalendarBlockedEvent(null);
    try {
      // Check Department Academic Calendar for Event / Holiday / Exam
      const calData = await getDepartmentCalendar(cls.dept);
      if (calData) {
        const activeEvent = await getCalendarEventForDate(calData, currentDate, cls.year);
        if (activeEvent && activeEvent.suspendClasses !== false) {
          setCalendarBlockedEvent(activeEvent);
        }
      }

      // Fetch students for this Dept, Year, Section
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", cls.dept),
        where("year", "==", cls.year),
        where("section", "==", cls.section)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(list);

      // Fetch Attendance record for today
      const docId = `${cls.dept}_${cls.year}_${cls.section}_${currentDate}`.replace(/\s+/g, '_');
      const attQ = query(collection(db, "daily_attendance"), where("date", "==", currentDate), where("dept", "==", cls.dept), where("year", "==", cls.year), where("section", "==", cls.section));
      const attSnap = await getDocs(attQ);
      
      if (!attSnap.empty) {
        const records = attSnap.docs[0].data().records || {};
        setAttendance(records);
        setSaved(true);
      } else {
        const defaultMap = {};
        list.forEach(s => { defaultMap[s.id] = "P"; }); // Default all to P
        setAttendance(defaultMap);
      }
    } catch (err) {
      toast.error("Failed to fetch students.");
    }
    setFetchingStudents(false);
  }

  function handleStatusChange(studentId, status) {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
    setSaved(false);
  }

  function handleMarkAll(status) {
    const updated = {};
    students.forEach(s => { updated[s.id] = status; });
    setAttendance(updated);
    setSaved(false);
  }

  async function handleSave() {
    if (!selectedClass) return;
    setSaving(true);
    try {
      const docId = `${selectedClass.dept}_${selectedClass.year}_${selectedClass.section}_${currentDate}`.replace(/\s+/g, '_');
      
      const rawRecords = {};
      Object.entries(attendance).forEach(([uid, st]) => { rawRecords[uid] = st; });

      await setDoc(doc(db, "daily_attendance", docId), {
        dept: selectedClass.dept,
        year: selectedClass.year,
        section: selectedClass.section,
        date: currentDate,
        session: "Daily",
        records: rawRecords,
        totalCount: students.length,
        markedBy: userProfile.uid,
        markedByName: userProfile.name,
        assignmentType: selectedClass.type,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      toast.success("Today's attendance saved successfully!");
      setSaved(true);
    } catch (err) {
      toast.error("Save failed.");
    }
    setSaving(false);
  }

  const presentCount = students.filter(s => attendance[s.id] === "P").length;
  const absentCount = students.filter(s => attendance[s.id] === "A").length;
  const odCount = students.filter(s => attendance[s.id] === "OD").length;
  const attendancePercentage = students.length ? Math.round(((presentCount + odCount) / students.length) * 100) : 0;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header" style={{ marginBottom: 20 }}>
          <h1>Daily Class Attendance</h1>
          <p>{currentDate} • Class Incharge Portal</p>
        </div>

        {loadingAssignments ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Checking assignments...</div>
        ) : assignedClasses.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <Calendar size={48} color="var(--border)" style={{ marginBottom: 16 }} />
            <h3 style={{ color: "var(--text-muted)" }}>No Active Assignments</h3>
            <p style={{ color: "var(--text-muted)", marginTop: 8 }}>You are not currently assigned as a Class Incharge or Substitute for today.</p>
          </div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 250 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>My Assigned Classes</label>
                  <select className="input-field" style={{ width: '100%', padding: '10px 14px', fontSize: 15, fontWeight: 600 }} value={selectedClassIdx} onChange={e => setSelectedClassIdx(Number(e.target.value))}>
                    {assignedClasses.map((cls, idx) => (
                      <option key={idx} value={idx}>{cls.dept} • {cls.year} • Section {cls.section} ({cls.type})</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(37, 99, 235, 0.1)', padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(37, 99, 235, 0.2)', color: 'var(--highlight)', fontWeight: 700, fontSize: 14 }}>
                  <Calendar size={18} /> Today's Attendance
                </div>
              </div>
            </div>

            {/* Academic Calendar Notice Banner for Class Incharge */}
            {calendarBlockedEvent && (
              <div style={{
                padding: "18px 22px",
                borderRadius: 12,
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                marginBottom: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 16
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <AlertTriangle size={26} color="#d97706" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#b45309" }}>
                      Academic Calendar Notice: {calendarBlockedEvent.title} ({calendarBlockedEvent.type?.toUpperCase()})
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                      Today ({currentDate}) is scheduled as <strong>{calendarBlockedEvent.title}</strong> in the {selectedClass?.dept} Department Academic Calendar. Daily attendance marking is available for Class Incharge.
                    </div>
                  </div>
                </div>

                <button
                  className="btn-secondary"
                  onClick={() => navigate("/academics/academic-calendar")}
                  style={{ width: "auto", fontSize: 13, padding: "8px 16px" }}
                >
                  View Academic Calendar <ArrowRight size={14} />
                </button>
              </div>
            )}

            {students.length > 0 && !fetchingStudents && (
              <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <Users size={24} color="var(--highlight)" />
                  </div>
                  <div className="stat-value">{students.length}</div>
                  <div className="stat-label">Total Students</div>
                </div>
                <div className="stat-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <CheckCircle2 size={24} color="var(--success)" />
                  </div>
                  <div className="stat-value" style={{ color: "var(--success)" }}>{presentCount}</div>
                  <div className="stat-label">Present</div>
                </div>
                <div className="stat-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <Briefcase size={24} color="var(--warning)" />
                  </div>
                  <div className="stat-value" style={{ color: "var(--warning)" }}>{odCount}</div>
                  <div className="stat-label">On Duty (OD)</div>
                </div>
                <div className="stat-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <XCircle size={24} color="var(--danger)" />
                  </div>
                  <div className="stat-value" style={{ color: "var(--danger)" }}>{absentCount}</div>
                  <div className="stat-label">Absent</div>
                </div>
                <div className="stat-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <CheckSquare size={24} color="var(--highlight)" />
                  </div>
                  <div className="stat-value" style={{ color: "var(--highlight)" }}>{attendancePercentage}%</div>
                  <div className="stat-label">Attendance Rate</div>
                </div>
              </div>
            )}

            <div className="card">
              {fetchingStudents ? (
                <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading students...</div>
              ) : students.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No students found in this class.</div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button className="btn-secondary" onClick={() => handleMarkAll("P")} style={{ margin: 0, padding: "8px 14px", fontSize: 13, width: "auto" }}>
                        Mark All Present
                      </button>
                      <button className="btn-secondary" onClick={() => handleMarkAll("A")} style={{ margin: 0, padding: "8px 14px", fontSize: 13, width: "auto" }}>
                        Mark All Absent
                      </button>
                    </div>

                    <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ width: "auto", padding: "8px 24px", opacity: saved ? 0.7 : 1 }}>
                      {saving ? "Saving..." : saved ? "Update Today's Attendance" : "Save Today's Attendance"}
                    </button>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: 12 }}>S.No</th>
                          <th style={{ padding: 12 }}>Reg No</th>
                          <th style={{ padding: 12 }}>Student Name</th>
                          <th style={{ padding: 12, textAlign: "center" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student, idx) => {
                          const status = attendance[student.id] || "P";
                          return (
                            <tr key={student.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: 12, color: "var(--text-muted)" }}>{idx + 1}</td>
                              <td style={{ padding: 12, fontFamily: "monospace", fontWeight: 600 }}>{student.registerNo || student.registerNumber || "N/A"}</td>
                              <td style={{ padding: 12, fontWeight: 600 }}>{student.name}</td>
                              <td style={{ padding: 12, textAlign: "center" }}>
                                <div style={{ display: "inline-flex", gap: 4, background: "var(--bg-secondary)", padding: 4, borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                                  <button onClick={() => handleStatusChange(student.id, "P")} style={{ padding: "6px 16px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s", background: status === "P" ? "var(--success)" : "transparent", color: status === "P" ? "white" : "var(--text-muted)" }}>P</button>
                                  <button onClick={() => handleStatusChange(student.id, "OD")} style={{ padding: "6px 16px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s", background: status === "OD" ? "var(--warning)" : "transparent", color: status === "OD" ? "white" : "var(--text-muted)" }}>OD</button>
                                  <button onClick={() => handleStatusChange(student.id, "A")} style={{ padding: "6px 16px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s", background: status === "A" ? "var(--danger)" : "transparent", color: status === "A" ? "white" : "var(--text-muted)" }}>A</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}