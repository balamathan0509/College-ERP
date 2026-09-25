import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { collection, query, getDocs, setDoc, doc, where, orderBy } from 'firebase/firestore';
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
        <div className='page-header'>
          <h1>CIA Mark Attendance</h1>
          <p className="subtitle">Mark attendance for scheduled examinations</p>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 15 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Select Scheduled Examination *</label>
              <select 
                value={selectedScheduleId} 
                onChange={(e) => setSelectedScheduleId(e.target.value)} 
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}
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
          <div className="card">
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading students...</div>
            ) : students.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                No students found for this class configuration.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 15 }}>
                  <div style={{ display: 'flex', gap: 15 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users size={16} color="var(--text-muted)"/>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Total: {students.length}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle size={16} color="#10b981"/>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#10b981' }}>
                        Present: {Object.values(attendance).filter(v => v === 'Present').length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <XCircle size={16} color="#ef4444"/>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#ef4444' }}>
                        Absent: {Object.values(attendance).filter(v => v === 'Absent').length}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => handleMarkAll('Present')} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #10b981', background: 'rgba(16,185,129,0.1)', color: '#10b981', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      Mark All Present
                    </button>
                    <button onClick={() => handleMarkAll('Absent')} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #ef4444', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      Mark All Absent
                    </button>
                    <button onClick={handleSaveAttendance} className="btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13 }}>
                      <Save size={16} /> {saving ? 'Saving...' : 'Save Attendance'}
                    </button>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>S.NO</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>STUDENT NAME</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>REGISTER NO</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>ATTENDANCE STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, idx) => (
                        <tr key={student.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: attendance[student.id] === 'Absent' ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                          <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{student.name || 'Unknown'}</td>
                          <td style={{ padding: '12px 16px' }}>{student.registerNo || student.id}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: 10 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <input 
                                  type="radio" 
                                  name={`att_${student.id}`} 
                                  checked={attendance[student.id] === 'Present'} 
                                  onChange={() => handleStatusChange(student.id, 'Present')}
                                />
                                <span style={{ color: attendance[student.id] === 'Present' ? '#10b981' : 'var(--text-muted)', fontWeight: attendance[student.id] === 'Present' ? 600 : 400 }}>Present</span>
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <input 
                                  type="radio" 
                                  name={`att_${student.id}`} 
                                  checked={attendance[student.id] === 'Absent'} 
                                  onChange={() => handleStatusChange(student.id, 'Absent')}
                                />
                                <span style={{ color: attendance[student.id] === 'Absent' ? '#ef4444' : 'var(--text-muted)', fontWeight: attendance[student.id] === 'Absent' ? 600 : 400 }}>Absent</span>
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
