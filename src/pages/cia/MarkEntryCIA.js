import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { collection, query, getDocs, setDoc, doc, where, orderBy } from 'firebase/firestore';
import { Save, Search, Users, FileEdit, ArrowLeft } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function MarkEntryCIA() {
  const { userProfile } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [marksMap, setMarksMap] = useState({});
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters for Schedule List
  const [filterSession, setFilterSession] = useState('');
  const [filterProgramme, setFilterProgramme] = useState('');
  const [filterSemester, setFilterSemester] = useState('');

  const SESSIONS = ["2025-2026", "2026-2027"];
  const PROGRAMMES = ["B.E CSE", "B.E ECE", "B.E EEE", "B.E MECH", "B.Tech IT"];
  const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];

  useEffect(() => {
    fetchSchedules();
  }, []);

  async function fetchSchedules() {
    setLoading(true);
    try {
      const q = query(
        collection(db, "cia_exam_schedules"),
        orderBy("date", "desc")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchedules(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load schedules");
    }
    setLoading(false);
  }

  const handleActionClick = async (schedule) => {
    setSelectedSchedule(schedule);
    setLoading(true);
    try {
      // Fetch Attendance
      const attQ = query(collection(db, "cia_exam_attendance"), where("scheduleId", "==", schedule.id));
      const attSnap = await getDocs(attQ);
      
      const attData = {};
      const studentData = [];
      
      attSnap.docs.forEach(d => {
        const data = d.data();
        attData[data.studentId] = data.status;
        studentData.push({
          id: data.studentId,
          name: data.studentName,
          registerNo: data.registerNo,
          rollNo: data.rollNo
        });
      });
      
      // Fetch Existing Marks
      const marksQ = query(collection(db, "cia_marks"), where("scheduleId", "==", schedule.id), where("entryType", "==", "CIA"));
      const marksSnap = await getDocs(marksQ);
      const mData = {};
      
      marksSnap.docs.forEach(d => {
        const data = d.data();
        mData[data.studentId] = data.marks;
      });

      studentData.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      
      setStudents(studentData);
      setAttendanceMap(attData);
      
      // Default absent students to 0
      studentData.forEach(s => {
        if (attData[s.id] === 'Absent' && !mData[s.id]) {
          mData[s.id] = 0;
        }
      });
      
      setMarksMap(mData);

      if (studentData.length === 0) {
        toast.error("No students found. Please mark attendance first.");
      }

    } catch (err) {
      console.error(err);
      toast.error("Error loading students");
    }
    setLoading(false);
  };

  const handleMarkChange = (studentId, value) => {
    // Basic validation
    const num = Number(value);
    if (value !== '' && (isNaN(num) || num < 0 || num > 50)) {
       return; // assuming max marks = 50 for CIA
    }
    setMarksMap(prev => ({ ...prev, [studentId]: value }));
  };

  const handleSaveMarks = async (status = "Draft") => {
    if (students.length === 0) return;
    
    setSaving(true);
    try {
      const batchPromises = students.map(student => {
        const recordId = `${selectedSchedule.id}_${student.id}_CIA`;
        
        let finalMark = marksMap[student.id];
        let isAbsent = attendanceMap[student.id] === 'Absent';
        
        if (isAbsent) finalMark = 0;

        return setDoc(doc(db, "cia_marks", recordId), {
          examId: selectedSchedule.examId,
          scheduleId: selectedSchedule.id,
          courseId: selectedSchedule.courseCode,
          classId: selectedSchedule.class,
          studentId: student.id,
          studentName: student.name || 'Unknown',
          registerNo: student.registerNo || student.id,
          marks: Number(finalMark) || 0,
          maxMarks: 50,
          isAbsent: isAbsent,
          entryType: "CIA",
          status: status,
          enteredBy: userProfile?.name || "System",
          updatedAt: new Date().toISOString()
        }, { merge: true });
      });

      await Promise.all(batchPromises);
      toast.success(`Marks saved as ${status} successfully`);
      
      if (status === "Finalized") {
        // Optionally update schedule status
      }
      
    } catch (err) {
      console.error(err);
      toast.error("Error saving marks");
    }
    setSaving(false);
  };

  const filteredSchedules = schedules.filter(s => {
    if (filterSession && s.academicSession !== filterSession) return false;
    if (filterProgramme && s.programmeName !== filterProgramme) return false;
    if (filterSemester && s.semester !== filterSemester) return false;
    return true;
  });

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />
        <div className='page-header'>
          <h1>CIA Mark Entry Process</h1>
          <p className="subtitle">Enter marks for Continuous Internal Assessment examinations</p>
        </div>

        {!selectedSchedule ? (
          <>
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 15, alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={filterSession} onChange={(e) => setFilterSession(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                  <option value="">All Sessions</option>
                  {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filterProgramme} onChange={(e) => setFilterProgramme(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                  <option value="">All Programmes</option>
                  {PROGRAMMES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                  <option value="">All Semesters</option>
                  {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0, marginBottom: 20, fontSize: 16 }}>Examination Schedule List</h3>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading schedules...</div>
              ) : filteredSchedules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No scheduled exams found.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>SESSION</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>EXAM / COURSE</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>CLASS</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>DATE & SESSION</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'right' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSchedules.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{item.academicSession}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sem {item.semester}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600, color: '#6366f1' }}>{item.examName}</div>
                            <div style={{ fontSize: 13 }}>{item.courseCode} - {item.courseName}</div>
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.class}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div>{item.date}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.session} | {item.startTime} - {item.endTime}</div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <button onClick={() => handleActionClick(item)} className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}>
                              Enter Marks
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 20 }}>
              <button onClick={() => setSelectedSchedule(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <ArrowLeft size={18} /> Back
              </button>
              <div>
                <h3 style={{ margin: 0 }}>Mark Entry: {selectedSchedule.examName} ({selectedSchedule.courseCode})</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Class: {selectedSchedule.class} | Date: {selectedSchedule.date}</p>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading students...</div>
            ) : students.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                No students found. Did you mark attendance first?
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13, width: 60 }}>S.NO</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>REGISTER NO</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>STUDENT NAME</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13, width: 120 }}>STATUS</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13, width: 150 }}>CIA MARKS (Max 50)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, idx) => {
                        const isAbsent = attendanceMap[student.id] === 'Absent';
                        return (
                          <tr key={student.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: isAbsent ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                            <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td style={{ padding: '12px 16px' }}>{student.registerNo || student.id}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 600 }}>{student.name || 'Unknown'}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ color: isAbsent ? '#ef4444' : '#10b981', fontWeight: 600, fontSize: 13 }}>
                                {isAbsent ? 'Absent' : 'Present'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <input 
                                type="number" 
                                value={isAbsent ? '0' : (marksMap[student.id] || '')}
                                onChange={(e) => handleMarkChange(student.id, e.target.value)}
                                disabled={isAbsent}
                                min="0" max="50"
                                placeholder="0"
                                style={{ 
                                  width: '100px', padding: '8px', borderRadius: 6, 
                                  border: '1px solid var(--border-color)', 
                                  background: isAbsent ? 'rgba(0,0,0,0.1)' : 'var(--bg-color)', 
                                  color: 'var(--text)',
                                  opacity: isAbsent ? 0.6 : 1
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => handleSaveMarks("Draft")} disabled={saving} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #6366f1', background: 'rgba(99,102,241,0.1)', color: '#6366f1', cursor: 'pointer', fontWeight: 600 }}>
                    {saving ? 'Saving...' : 'Save as Draft'}
                  </button>
                  <button onClick={() => handleSaveMarks("Finalized")} disabled={saving} className="btn-primary">
                    {saving ? 'Saving...' : 'Finalize Marks'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
