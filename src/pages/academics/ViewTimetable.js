import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { db } from '../../firebase/config';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { Eye } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const PROGRAMMES = ["B.E CSE","B.E ECE","B.E EEE","B.E MECH","B.E CIVIL","B.Tech IT","B.Tech AIDS","B.Tech AIML","MBA","MCA"];
const DEPARTMENTS = ["CSE","ECE","EEE","MECH","CIVIL","IT","AIDS","AIML","MBA","MCA"];
const SEMESTERS = ["1","2","3","4","5","6","7","8"];
const SECTIONS = ["A","B","C","D"];
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SLOTS = [
  { id: 'h1', label: '9:10-9:55' }, { id: 'h2', label: '9:55-10:40' },
  { id: 'brk1', label: '10:40-11:00', isBreak: true, breakLabel: 'Break' },
  { id: 'h3', label: '11:00-11:45' }, { id: 'h4', label: '11:45-12:30' },
  { id: 'lunch', label: '12:30-1:30', isBreak: true, breakLabel: 'Lunch' },
  { id: 'h5', label: '1:30-2:15' }, { id: 'h6', label: '2:15-3:00' },
  { id: 'brk2', label: '3:00-3:10', isBreak: true, breakLabel: 'Break' },
  { id: 'h7', label: '3:10-3:55' }, { id: 'h8', label: '3:55-4:30' }
];

export default function ViewTimetable() {
  const [sessions, setSessions] = useState([]);
  const [filterSession, setFilterSession] = useState('');
  const [filterProgramme, setFilterProgramme] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterSection, setFilterSection] = useState('A');
  const [schedule, setSchedule] = useState(null);
  const [allocations, setAllocations] = useState([]);

  useEffect(() => {
    getDocs(query(collection(db, "academic_sessions"), orderBy("createdAt", "desc")))
      .then(snap => setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  async function handleShow() {
    if (!filterSession || !filterSemester) { toast.error("Session and Semester required."); return; }
    try {
      const q = query(collection(db, "academic_timetable"),
        where("sessionId", "==", filterSession),
        where("semester", "==", filterSemester),
        where("classSection", "==", filterSection)
      );
      const snap = await getDocs(q);
      if (snap.empty) { toast.error("No timetable found."); setSchedule(null); return; }
      const data = snap.docs[0].data();
      setSchedule(data.schedule || {});
      // Load allocations to resolve names
      const aQ = query(collection(db, "course_allocations"), where("sessionId", "==", filterSession));
      const aSnap = await getDocs(aQ);
      setAllocations(aSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); toast.error("Failed."); }
  }

  function getAllocName(allocId) {
    const a = allocations.find(x => x.id === allocId);
    return a ? `${a.courseCode}\n${a.facultyName?.split(' ')[0] || ''}` : '';
  }

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text)', fontSize: 13 };
  const labelStyle = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header">
          <h1><Eye size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />View Timetable</h1>
          <p className="subtitle">View class timetable</p>
        </div>
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div><label style={labelStyle}>Academic Session *</label><select value={filterSession} onChange={e => setFilterSession(e.target.value)} style={inputStyle}><option value="">--</option>{sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label style={labelStyle}>Programme</label><select value={filterProgramme} onChange={e => setFilterProgramme(e.target.value)} style={inputStyle}><option value="">--</option>{PROGRAMMES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
            <div><label style={labelStyle}>Department</label><select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={inputStyle}><option value="">--</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
            <div><label style={labelStyle}>Semester *</label><select value={filterSemester} onChange={e => setFilterSemester(e.target.value)} style={inputStyle}><option value="">--</option>{SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label style={labelStyle}>Section *</label><select value={filterSection} onChange={e => setFilterSection(e.target.value)} style={inputStyle}>{SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <button onClick={handleShow} className="btn-primary" style={{ padding: '8px 20px' }}>SHOW TIMETABLE</button>
        </div>
        {schedule && (
          <div className="card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
                <thead>
                  <tr style={{ background: 'rgba(37,99,235,0.1)' }}>
                    <th style={{ padding: 8, border: '1px solid var(--border)' }}>Day</th>
                    {SLOTS.map(s => <th key={s.id} style={{ padding: 8, border: '1px solid var(--border)', background: s.isBreak ? 'rgba(245,158,11,0.1)' : undefined, fontSize: 11 }}>{s.isBreak ? s.breakLabel : s.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map(day => (
                    <tr key={day}>
                      <td style={{ padding: 8, border: '1px solid var(--border)', fontWeight: 'bold' }}>{day}</td>
                      {SLOTS.map(slot => (
                        <td key={slot.id} style={{ padding: 6, border: '1px solid var(--border)', textAlign: 'center', background: slot.isBreak ? 'rgba(245,158,11,0.05)' : undefined, whiteSpace: 'pre-line', fontSize: 11, minWidth: 90 }}>
                          {slot.isBreak ? slot.breakLabel : getAllocName(schedule[day]?.[slot.id]?.allocationId) || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
