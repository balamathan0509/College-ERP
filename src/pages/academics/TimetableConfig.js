import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { db } from '../../firebase/config';
import { collection, query, getDocs, doc, setDoc, where, serverTimestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Calendar, Save, AlertTriangle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const PROGRAMMES = ["B.E CSE","B.E ECE","B.E EEE","B.E MECH","B.E CIVIL","B.Tech IT","B.Tech AIDS","B.Tech AIML","MBA","MCA"];
const DEPARTMENTS = ["CSE","ECE","EEE","MECH","CIVIL","IT","AIDS","AIML","MBA","MCA"];
const SEMESTERS = ["1","2","3","4","5","6","7","8"];
const SECTIONS = ["A","B","C","D"];
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SLOTS = [
  { id: 'h1', label: '9:10 - 9:55' },
  { id: 'h2', label: '9:55 - 10:40' },
  { id: 'brk1', label: '10:40 - 11:00', isBreak: true, breakLabel: 'Short Break' },
  { id: 'h3', label: '11:00 - 11:45' },
  { id: 'h4', label: '11:45 - 12:30' },
  { id: 'lunch', label: '12:30 - 1:30', isBreak: true, breakLabel: 'Lunch Break' },
  { id: 'h5', label: '1:30 - 2:15' },
  { id: 'h6', label: '2:15 - 3:00' },
  { id: 'brk2', label: '3:00 - 3:10', isBreak: true, breakLabel: 'Short Break' },
  { id: 'h7', label: '3:10 - 3:55' },
  { id: 'h8', label: '3:55 - 4:30' }
];

export default function TimetableConfig() {
  const { userProfile } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [filterSession, setFilterSession] = useState('');
  const [filterProgramme, setFilterProgramme] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterSection, setFilterSection] = useState('A');
  const [schedule, setSchedule] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState([]);

  useEffect(() => {
    getDocs(query(collection(db, "academic_sessions"), orderBy("createdAt", "desc")))
      .then(snap => setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  async function handleCreate() {
    if (!filterSession || !filterSemester || !filterSection) {
      toast.error("Session, Semester and Section are required."); return;
    }
    // Load allocations for filter
    const aQ = query(collection(db, "course_allocations"), where("sessionId", "==", filterSession));
    const aSnap = await getDocs(aQ);
    let allocs = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (filterSemester) allocs = allocs.filter(a => a.semester === filterSemester);
    if (filterDept) allocs = allocs.filter(a => a.department === filterDept);
    setAllocations(allocs);

    // Load existing timetable
    const docId = `${filterSession}_${filterDept || 'ALL'}_${filterSemester}_${filterSection}`;
    const existingSnap = await getDocs(query(collection(db, "academic_timetable"),
      where("sessionId", "==", filterSession),
      where("semester", "==", filterSemester),
      where("classSection", "==", filterSection)
    ));

    if (!existingSnap.empty) {
      const existingData = existingSnap.docs[0].data();
      setSchedule(existingData.schedule || {});
    } else {
      const initial = {};
      DAYS.forEach(day => { initial[day] = {}; SLOTS.filter(s => !s.isBreak).forEach(s => { initial[day][s.id] = { allocationId: '' }; }); });
      setSchedule(initial);
    }
    setLoaded(true);
  }

  function handleSlotChange(day, slotId, allocId) {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [slotId]: { allocationId: allocId } }
    }));
  }

  function detectConflicts() {
    const issues = [];
    // Check faculty conflicts across all slots
    SLOTS.filter(s => !s.isBreak).forEach(slot => {
      const facultyInSlot = {};
      DAYS.forEach(day => {
        const allocId = schedule[day]?.[slot.id]?.allocationId;
        if (!allocId) return;
        const alloc = allocations.find(a => a.id === allocId);
        if (!alloc) return;
        if (facultyInSlot[alloc.facultyId]) {
          issues.push(`Faculty ${alloc.facultyName} has conflict on ${day} at ${slot.label}`);
        }
        facultyInSlot[alloc.facultyId] = true;
      });
    });
    return issues;
  }

  async function handleSave() {
    const issues = detectConflicts();
    if (issues.length > 0) {
      setConflicts(issues);
      toast.error(`${issues.length} conflict(s) detected! Fix before saving.`);
      return;
    }
    setConflicts([]);
    setSaving(true);
    try {
      const docId = `${filterSession}_${filterDept || 'ALL'}_${filterSemester}_${filterSection}`;
      await setDoc(doc(db, "academic_timetable", docId), {
        sessionId: filterSession,
        programme: filterProgramme,
        department: filterDept,
        semester: filterSemester,
        classSection: filterSection,
        schedule,
        updatedAt: serverTimestamp(),
        updatedBy: userProfile?.uid,
        createdAt: serverTimestamp()
      }, { merge: true });
      toast.success("Timetable saved successfully!");
    } catch (err) { console.error(err); toast.error("Save failed."); }
    setSaving(false);
  }

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text)', fontSize: 13 };
  const labelStyle = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header">
          <h1><Calendar size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />Timetable Configuration</h1>
          <p className="subtitle">Create and manage class timetables</p>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div><label style={labelStyle}>Academic Session *</label><select value={filterSession} onChange={e => setFilterSession(e.target.value)} style={inputStyle}><option value="">-- Select --</option>{sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label style={labelStyle}>Programme</label><select value={filterProgramme} onChange={e => setFilterProgramme(e.target.value)} style={inputStyle}><option value="">--</option>{PROGRAMMES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
            <div><label style={labelStyle}>Department</label><select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={inputStyle}><option value="">--</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
            <div><label style={labelStyle}>Semester *</label><select value={filterSemester} onChange={e => setFilterSemester(e.target.value)} style={inputStyle}><option value="">--</option>{SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label style={labelStyle}>Section *</label><select value={filterSection} onChange={e => setFilterSection(e.target.value)} style={inputStyle}>{SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <button onClick={handleCreate} className="btn-primary" style={{ padding: '8px 20px' }}>CREATE / LOAD TIMETABLE</button>
        </div>

        {conflicts.length > 0 && (
          <div className="card" style={{ marginBottom: 20, borderLeft: '3px solid var(--danger)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--danger)' }}>
              <AlertTriangle size={18} /> <strong>Conflicts Detected</strong>
            </div>
            {conflicts.map((c, i) => <div key={i} style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>• {c}</div>)}
          </div>
        )}

        {loaded && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Timetable Grid</h3>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save Timetable'}
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
                <thead>
                  <tr style={{ background: 'rgba(37,99,235,0.1)' }}>
                    <th style={{ padding: 8, border: '1px solid var(--border)', minWidth: 80 }}>Day / Time</th>
                    {SLOTS.map(s => (
                      <th key={s.id} style={{ padding: 8, border: '1px solid var(--border)', minWidth: 100, background: s.isBreak ? 'rgba(245,158,11,0.1)' : undefined, fontSize: 11 }}>
                        {s.isBreak ? s.breakLabel : s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map(day => (
                    <tr key={day}>
                      <td style={{ padding: 8, border: '1px solid var(--border)', fontWeight: 'bold', fontSize: 12 }}>{day}</td>
                      {SLOTS.map(slot => (
                        <td key={slot.id} style={{ padding: 4, border: '1px solid var(--border)', background: slot.isBreak ? 'rgba(245,158,11,0.05)' : undefined }}>
                          {slot.isBreak ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 10 }}>{slot.breakLabel}</div>
                          ) : (
                            <select
                              value={schedule[day]?.[slot.id]?.allocationId || ''}
                              onChange={e => handleSlotChange(day, slot.id, e.target.value)}
                              style={{ width: '100%', padding: 4, borderRadius: 4, border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text)', fontSize: 11 }}
                            >
                              <option value="">—</option>
                              {allocations.map(a => (
                                <option key={a.id} value={a.id}>{a.courseCode} ({a.facultyName?.split(' ')[0]})</option>
                              ))}
                            </select>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {allocations.length > 0 && (
              <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                <strong>Available Courses:</strong> {allocations.map(a => `${a.courseCode} (${a.facultyName})`).join(', ')}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
