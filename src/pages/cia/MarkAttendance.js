import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, getDocs, setDoc, doc, where, orderBy, addDoc } from "../../supabase/supabaseAdapter";
import { Save, Search, Users, CheckCircle, XCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function MarkAttendance() {
  const { userProfile } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSchedules();
  }, []);

  async function fetchSchedules() {
    try {
      const q = query(
        collection(db, "cia_exam_schedules"),
        where("status", "==", "Scheduled"),
        orderBy("date", "desc")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchedules(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load schedules");
    }
  }

  // Auto-fetch students when a schedule is selected
  useEffect(() => {
    if (selectedScheduleId) {
      const schedule = schedules.find(s => s.id === selectedScheduleId);
      if (schedule) {
        fetchStudentsAndAttendance(schedule);
      }
    } else {
      setStudents([]);
      setAttendance({});
    }
  }, [selectedScheduleId]);

  async function fetchStudentsAndAttendance(schedule) {
    setLoading(true);
    try {
      // Parse class info: assuming "CSE-A" maps to dept="CSE", section="A"
      // or we just fetch all students in the programme and filter.
      // Since ERP often uses 'dept' and 'year', we'll try to guess dept from programmeName (e.g. B.E CSE -> CSE)
      const dept = schedule.programmeName.includes("CSE") ? "CSE" :
                   schedule.programmeName.includes("ECE") ? "ECE" :
                   schedule.programmeName.includes("IT") ? "IT" :
                   schedule.programmeName.includes("EEE") ? "EEE" :
                   schedule.programmeName.includes("MECH") ? "MECH" : "";
                   
      const yearStr = schedule.semester === "1" || schedule.semester === "2" ? "1st Year" :
                      schedule.semester === "3" || schedule.semester === "4" ? "2nd Year" :
                      schedule.semester === "5" || schedule.semester === "6" ? "3rd Year" : "4th Year";

      let studentsList = [];
      if (dept) {
        const studentQ = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("dept", "==", dept),
          where("year", "==", yearStr)
        );
        const sSnap = await getDocs(studentQ);
        studentsList = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } else {
        // Fallback: just fetch some students if dept matching fails for demo purposes
        const studentQ = query(collection(db, "users"), where("role", "==", "student"));
        const sSnap = await getDocs(studentQ);
        studentsList = sSnap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, 10);
      }

      studentsList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setStudents(studentsList);

      // Fetch existing attendance if any
      const attQ = query(
        collection(db, "cia_exam_attendance"),
        where("scheduleId", "==", schedule.id)
      );
      const attSnap = await getDocs(attQ);
      
      const newAtt = {};
      if (!attSnap.empty) {
        attSnap.docs.forEach(d => {
          const data = d.data();
          newAtt[data.studentId] = data.status;
        });
      } else {
        // Default to Present
        studentsList.forEach(s => {
          newAtt[s.id] = "Present";
        });
      }
      setAttendance(newAtt);

    } catch (err) {
      console.error(err);
      toast.error("Failed to load students");
    }
    setLoading(false);
  }

  const handleStatusChange = (studentId, status) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleMarkAll = (status) => {
    const updated = {};
    students.forEach(s => {
      updated[s.id] = status;
    });
    setAttendance(updated);
  };

  const handleSaveAttendance = async () => {
    if (!selectedScheduleId || students.length === 0) return;
    
    setSaving(true);
    try {
      const schedule = schedules.find(s => s.id === selectedScheduleId);
      
      const batchPromises = students.map(student => {
        const recordId = `${schedule.id}_${student.id}`;
        return setDoc(doc(db, "cia_exam_attendance", recordId), {
          scheduleId: schedule.id,
          examId: schedule.examId,
          courseId: schedule.courseCode,
          classId: schedule.class,
          studentId: student.id,
          studentName: student.name || 'Unknown',
          registerNo: student.registerNo || student.id,
          rollNo: student.rollNo || '',
          status: attendance[student.id] || 'Absent',
          markedBy: userProfile?.name || "System",
          markedAt: new Date().toISOString()
        }, { merge: true });
      });

      await Promise.all(batchPromises);

      // Notify HOD and Class Incharge
      try {
        const deptStr = schedule.programmeName.includes("CSE") ? "CSE" :
                        schedule.programmeName.includes("ECE") ? "ECE" :
                        schedule.programmeName.includes("IT") ? "IT" :
                        schedule.programmeName.includes("EEE") ? "EEE" :
                        schedule.programmeName.includes("MECH") ? "MECH" : "";

        if (deptStr) {
          // Notify HOD
          const hodQ = query(collection(db, "users"), where("role", "==", "hod"), where("dept", "==", deptStr));
          const hodSnap = await getDocs(hodQ);
          hodSnap.docs.forEach(async (d) => {
            await addDoc(collection(db, "alerts"), {
              type: "general",
              title: "CIA Attendance Marked",
              message: `CIA Attendance for ${schedule.courseCode} (${schedule.examName} - ${schedule.class}) has been marked by Exam Cell on ${schedule.date}.`,
              roleTarget: "hod",
              deptTarget: deptStr,
              yearTarget: "all",
              targetUid: d.id,
              createdAt: new Date().toISOString(),
              createdByRole: "exam_cell",
              isRead: false
            });
          });

          // Notify Class Incharge
          const ciQ = query(collection(db, "class_incharges"), where("department", "==", deptStr));
          const ciSnap = await getDocs(ciQ);
          ciSnap.docs.forEach(async (d) => {
            const ciData = d.data();
            await addDoc(collection(db, "alerts"), {
              type: "general",
              title: "CIA Attendance Marked",
              message: `CIA Attendance for ${schedule.courseCode} (${schedule.examName} - ${schedule.class}) has been marked by Exam Cell on ${schedule.date}.`,
              roleTarget: "staff",
              deptTarget: deptStr,
              yearTarget: "all",
              targetUid: ciData.facultyId,
              createdAt: new Date().toISOString(),
              createdByRole: "exam_cell",
              isRead: false
            });
          });
        }

        // Notify Subject Staff
        const allocQ = query(collection(db, "subject_allocations"), where("courseCode", "==", schedule.courseCode));
        const allocSnap = await getDocs(allocQ);
        allocSnap.docs.forEach(async (d) => {
          const allocData = d.data();
          await addDoc(collection(db, "alerts"), {
            type: "general",
            title: "CIA Attendance Marked",
            message: `CIA Attendance for your subject ${schedule.courseCode} - ${schedule.courseName} (${schedule.class}) has been marked by Exam Cell on ${schedule.date}.`,
            roleTarget: "staff",
            deptTarget: deptStr || "all",
            yearTarget: "all",
            targetUid: allocData.facultyId,
            createdAt: new Date().toISOString(),
            createdByRole: "exam_cell",
            isRead: false
          });
        });

        // Notify Absent Students
        for (const student of students) {
          if (attendance[student.id] === 'Absent') {
            await addDoc(collection(db, "alerts"), {
              type: "general",
              title: "CIA Exam Absent Alert",
              message: `You have been marked ABSENT for the CIA Exam: ${schedule.courseCode} - ${schedule.courseName} (${schedule.examName}) scheduled on ${schedule.date}.`,
              roleTarget: "student",
              deptTarget: deptStr || "all",
              yearTarget: "all",
              targetUid: student.id,
              createdAt: new Date().toISOString(),
              createdByRole: "exam_cell",
              isRead: false
            });
          }
        }

      } catch (notifErr) {
        console.error("Failed to send notifications:", notifErr);
      }

      toast.success("Attendance saved successfully");
    } catch (err) {
      console.error(err);
      toast.error("Error saving attendance");
    }
    setSaving(false);
  };

  const activeSchedule = schedules.find(s => s.id === selectedScheduleId);

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />
        {/* Professional Header */}
        <div style={{
          marginTop: '24px',
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '16px'
        }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '600', color: 'var(--text-dark)', textTransform: 'none' }}>
              CIA Mark Attendance
            </h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
              Mark attendance for scheduled examinations
            </p>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24, boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Select Scheduled Examination *</label>
              <select 
                value={selectedScheduleId} 
                onChange={(e) => setSelectedScheduleId(e.target.value)} 
                style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: 'var(--text-dark)', fontSize: '14px', outline: 'none', transition: 'all 0.2s' }}
              >
                <option value="">-- Select Schedule --</option>
                {schedules.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.examName} | {s.courseCode} - {s.courseName} | {s.class} ({s.date} {s.session})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selectedScheduleId && (
          <div className="card" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading students...</div>
            ) : students.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                No students found for this class configuration.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 15, padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', gap: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users size={18} color="#64748b"/>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>Total: {students.length}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle size={18} color="#10b981"/>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#10b981' }}>
                        Present: {Object.values(attendance).filter(v => v === 'Present').length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <XCircle size={18} color="#ef4444"/>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#ef4444' }}>
                        Absent: {Object.values(attendance).filter(v => v === 'Absent').length}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => handleMarkAll('Present')} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(16,185,129,0.1)', color: '#10b981', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}>
                      Mark All Present
                    </button>
                    <button onClick={() => handleMarkAll('Absent')} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}>
                      Mark All Absent
                    </button>
                    <button onClick={handleSaveAttendance} className="btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '500', width: 'auto' }}>
                      <Save size={16} /> {saving ? 'Saving...' : 'Save Attendance'}
                    </button>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', background: '#f8fafc' }}>
                        <th style={{ padding: '16px 20px', color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>S.NO</th>
                        <th style={{ padding: '16px 20px', color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>STUDENT NAME</th>
                        <th style={{ padding: '16px 20px', color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>REGISTER NO</th>
                        <th style={{ padding: '16px 20px', color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ATTENDANCE STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, idx) => (
                        <tr key={student.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s', background: attendance[student.id] === 'Absent' ? 'rgba(239, 68, 68, 0.03)' : 'transparent', ':hover': { background: '#f8fafc' } }}>
                          <td style={{ padding: '16px 20px', color: '#64748b', fontWeight: '500' }}>{idx + 1}</td>
                          <td style={{ padding: '16px 20px', fontWeight: '600', color: 'var(--text-dark)', fontSize: '14px' }}>{student.name || 'Unknown'}</td>
                          <td style={{ padding: '16px 20px', color: 'var(--text-dark)', fontSize: '14px', fontWeight: '500' }}>{student.registerNo || student.id}</td>
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', gap: '20px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input 
                                  type="radio" 
                                  name={`att_${student.id}`} 
                                  checked={attendance[student.id] === 'Present'} 
                                  onChange={() => handleStatusChange(student.id, 'Present')}
                                  style={{ width: '16px', height: '16px', accentColor: '#10b981' }}
                                />
                                <span style={{ color: attendance[student.id] === 'Present' ? '#10b981' : '#64748b', fontWeight: attendance[student.id] === 'Present' ? '600' : '500', fontSize: '14px' }}>Present</span>
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input 
                                  type="radio" 
                                  name={`att_${student.id}`} 
                                  checked={attendance[student.id] === 'Absent'} 
                                  onChange={() => handleStatusChange(student.id, 'Absent')}
                                  style={{ width: '16px', height: '16px', accentColor: '#ef4444' }}
                                />
                                <span style={{ color: attendance[student.id] === 'Absent' ? '#ef4444' : '#64748b', fontWeight: attendance[student.id] === 'Absent' ? '600' : '500', fontSize: '14px' }}>Absent</span>
                              </label>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
