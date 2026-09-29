import React, { useState, useEffect } from 'react';
import Sidebar from '../../../components/Sidebar';
import { db } from '../../../firebase/config';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { Calendar } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

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

export default function FacultyTimetable() {
  const { userProfile } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [filterSession, setFilterSession] = useState('');
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getDocs(query(collection(db, "academic_sessions"), orderBy("createdAt", "desc")))
      .then(snap => setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  async function handleShow() {
    if (!filterSession) { toast.error("Select a session."); return; }
    setLoading(true);
    try {
      // 1. Get faculty's allocations for this session
      const aQ = query(collection(db, "course_allocations"), where("sessionId", "==", filterSession), where("facultyId", "==", userProfile?.uid));
      const aSnap = await getDocs(aQ);
      const myAllocIds = aSnap.docs.map(d => d.id);
      const myAllocData = {};
      aSnap.docs.forEach(d => { myAllocData[d.id] = { ...d.data(), id: d.id }; });

      if (myAllocIds.length === 0) {
        toast.error("No courses allocated for this session.");
        setSchedule({}); setLoading(false); return;
      }

      // 2. Scan academic_timetable for these allocations
      const tQ = query(collection(db, "academic_timetable"), where("sessionId", "==", filterSession));
      const tSnap = await getDocs(tQ);
      
      const newSchedule = {};
      DAYS.forEach(d => { newSchedule[d] = {}; });

      tSnap.docs.forEach(docSnap => {
        const tData = docSnap.data();
        if (!tData.schedule) return;
        DAYS.forEach(day => {
          SLOTS.filter(s => !s.isBreak).forEach(slot => {
            const allocId = tData.schedule[day]?.[slot.id]?.allocationId;
            if (allocId && myAllocIds.includes(allocId)) {
              newSchedule[day][slot.id] = {
                courseCode: myAllocData[allocId].courseCode,
                courseName: myAllocData[allocId].courseName,
                classSection: `${tData.programme} ${tData.semester}-${tData.classSection}`
              };
            }
          });
        });
      });

      setSchedule(newSchedule);
    } catch (err) { console.error(err); toast.error("Failed."); }
    setLoading(false);
  }

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text)', fontSize: 13 };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header">
          <h1><Calendar size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />Faculty Timetable</h1>
          <p className="subtitle">View your teaching schedule</p>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Academic Session *</label>
              <select value={filterSession} onChange={e => setFilterSession(e.target.value)} style={inputStyle}>
                <option value="">-- Select --</option>
                {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button onClick={handleShow} className="btn-primary" style={{ padding: '8px 20px', height: 36 }}>SHOW MY TIMETABLE</button>
          </div>
        </div>

        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : Object.keys(schedule).length > 0 && (
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
                      {SLOTS.map(slot => {
                        const sData = schedule[day]?.[slot.id];
                        return (
                          <td key={slot.id} style={{ padding: 6, border: '1px solid var(--border)', textAlign: 'center', background: slot.isBreak ? 'rgba(245,158,11,0.05)' : sData ? 'rgba(37,99,235,0.05)' : undefined, minWidth: 100 }}>
                            {slot.isBreak ? <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{slot.breakLabel}</span> : sData ? (
                              <>
                                <div style={{ fontWeight: 'bold', color: 'var(--accent)', fontSize: 12 }}>{sData.courseCode}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sData.classSection}</div>
                              </>
                            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                        )
                      })}
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
