import React, { useState, useEffect } from 'react';
import Sidebar from '../../../components/Sidebar';
import { db } from '../../../firebase/config';
import { collection, query, getDocs, doc, setDoc, where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { Users, Save } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SLOTS = [
  { id: 'h1', label: '9:10-9:55' }, { id: 'h2', label: '9:55-10:40' },
  { id: 'h3', label: '11:00-11:45' }, { id: 'h4', label: '11:45-12:30' },
  { id: 'h5', label: '1:30-2:15' }, { id: 'h6', label: '2:15-3:00' },
  { id: 'h7', label: '3:10-3:55' }, { id: 'h8', label: '3:55-4:30' }
];

export default function MarkAttendance() {
  const { userProfile } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [filterSession, setFilterSession] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [todaysClasses, setTodaysClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null); // { allocId, courseId, slotId, label }
  
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); // { studentId: 'P' or 'A' }

  useEffect(() => {
    getDocs(query(collection(db, "academic_sessions"))).then(s => setSessions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  async function loadClasses() {
    if (!filterSession || !date) { toast.error("Session and Date required."); return; }
    setLoading(true);
    try {
      const d = new Date(date);
      const dayName = DAYS[d.getDay()];
      
      const aQ = query(collection(db, "course_allocations"), where("sessionId", "==", filterSession), where("facultyId", "==", userProfile?.uid));
      const aSnap = await getDocs(aQ);
      const myAllocIds = aSnap.docs.map(doc => doc.id);
      const myAllocData = {};
      aSnap.docs.forEach(doc => { myAllocData[doc.id] = { ...doc.data(), id: doc.id }; });

      if (myAllocIds.length === 0) {
        setTodaysClasses([]); setLoading(false); return;
      }

      const tQ = query(collection(db, "academic_timetable"), where("sessionId", "==", filterSession));
      const tSnap = await getDocs(tQ);
      
      const classes = [];
      tSnap.docs.forEach(docSnap => {
        const tData = docSnap.data();
        if (!tData.schedule?.[dayName]) return;
        SLOTS.forEach(slot => {
          const allocId = tData.schedule[dayName][slot.id]?.allocationId;
          if (allocId && myAllocIds.includes(allocId)) {
            classes.push({
              allocId,
              courseId: myAllocData[allocId].courseId,
              courseCode: myAllocData[allocId].courseCode,
              classSection: `${tData.programme} ${tData.semester}-${tData.classSection}`,
              slotId: slot.id,
              slotLabel: slot.label,
              department: tData.department,
              semester: tData.semester
            });
          }
        });
      });
      classes.sort((a, b) => a.slotId.localeCompare(b.slotId));
      setTodaysClasses(classes);
      setSelectedClass(null);
    } catch (err) { toast.error("Failed to load classes."); }
    setLoading(false);
  }

  async function selectClassToMark(cls) {
    setSelectedClass(cls);
    setLoading(true);
    try {
      // Load enrolled students
      const eq = query(collection(db, "course_enrollments"), where("courseId", "==", cls.courseId), where("sessionId", "==", filterSession));
      const eSnap = await getDocs(eq);
      const studentList = eSnap.docs.map(d => ({ id: d.data().studentId, name: d.data().studentName, registerNo: d.data().registerNo }));
      studentList.sort((a, b) => (a.registerNo || '').localeCompare(b.registerNo || ''));
      setStudents(studentList);

      // Try to load existing attendance for this date/slot/course
      const docId = `${filterSession}_${date}_${cls.courseId}_${cls.slotId}`;
      const attSnap = await getDocs(query(collection(db, "attendance"), where("__name__", "==", docId)));
      
      if (!attSnap.empty) {
        setAttendance(attSnap.docs[0].data().records || {});
      } else {
        const initial = {};
        studentList.forEach(s => initial[s.id] = 'P'); // Default Present
        setAttendance(initial);
      }
    } catch (err) { console.error(err); toast.error("Failed to load students."); }
    setLoading(false);
  }

  async function handleSaveAttendance() {
    setSaving(true);
    try {
      const docId = `${filterSession}_${date}_${selectedClass.courseId}_${selectedClass.slotId}`;
      await setDoc(doc(db, "attendance", docId), {
        sessionId: filterSession,
        date: date,
        courseId: selectedClass.courseId,
        courseCode: selectedClass.courseCode,
        slotId: selectedClass.slotId,
        facultyId: userProfile?.uid,
        records: attendance,
        updatedAt: serverTimestamp(),
        updatedBy: userProfile?.uid
      });
      toast.success("Attendance saved!");
    } catch (err) { toast.error("Save failed."); }
    setSaving(false);
  }

  const toggleAtt = (sid) => {
    setAttendance(prev => ({ ...prev, [sid]: prev[sid] === 'P' ? 'A' : 'P' }));
  };

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text)', fontSize: 13 };
  const labelStyle = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header">
          <h1><Users size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />Daily Class Attendance</h1>
          <p className="subtitle">Mark attendance for your classes</p>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={labelStyle}>Academic Session *</label>
              <select value={filterSession} onChange={e => setFilterSession(e.target.value)} style={inputStyle}>
                <option value="">-- Select --</option>
                {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={labelStyle}>Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            </div>
            <button onClick={loadClasses} className="btn-primary" style={{ padding: '8px 20px', height: 36 }}>LOAD CLASSES</button>
          </div>
        </div>

        {todaysClasses.length > 0 && !selectedClass && (
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Your Classes on {date}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
              {todaysClasses.map((cls, idx) => (
                <div key={idx} onClick={() => selectClassToMark(cls)} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', background: '#ffffff' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--accent)', marginBottom: 4 }}>{cls.slotLabel}</div>
                  <div style={{ fontSize: 14 }}>{cls.courseCode}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cls.classSection}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {todaysClasses.length === 0 && date && filterSession && !loading && (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            You have no classes scheduled on this day.
          </div>
        )}

        {selectedClass && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0' }}>Marking Attendance: {selectedClass.courseCode}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedClass.classSection} | {date} | {selectedClass.slotLabel}</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setSelectedClass(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Back</button>
                <button onClick={handleSaveAttendance} disabled={saving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}><Save size={16} /> {saving ? 'Saving...' : 'Save Attendance'}</button>
              </div>
            </div>

            {loading ? <div style={{ padding: 40, textAlign: 'center' }}>Loading students...</div> : students.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No students enrolled in this course.</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 8px', textAlign: 'left', width: 60 }}>S.No</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left', width: 120 }}>Register No</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>Student Name</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', width: 100 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, idx) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', background: attendance[s.id] === 'A' ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                        <td style={{ padding: '10px 8px' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 8px' }}>{s.registerNo || '-'}</td>
                        <td style={{ padding: '10px 8px' }}>{s.name}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <button 
                            onClick={() => toggleAtt(s.id)}
                            style={{ 
                              padding: '4px 12px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 11,
                              background: attendance[s.id] === 'P' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                              color: attendance[s.id] === 'P' ? 'var(--success)' : 'var(--danger)'
                            }}
                          >
                            {attendance[s.id] === 'P' ? 'Present' : 'Absent'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
