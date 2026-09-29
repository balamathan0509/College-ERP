import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { collection, query, getDocs, setDoc, doc, where } from 'firebase/firestore';
import { Search, ArrowLeft } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function MarkEntryESE() {
  const { userProfile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterSession, setFilterSession] = useState('');
  const [filterProgramme, setFilterProgramme] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  
  const [searched, setSearched] = useState(false);

  const [students, setStudents] = useState([]);
  const [marksMap, setMarksMap] = useState({});
  const [attendanceMap, setAttendanceMap] = useState({});

  const SESSIONS = ["2025-2026", "2026-2027"];
  const PROGRAMMES = ["B.E CSE", "B.E ECE", "B.E EEE", "B.E MECH", "B.Tech IT"];
  const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];

  const handleSearch = async () => {
    if (!filterSession || !filterProgramme || !filterSemester || !filterCourse) {
      toast.error("Please select all filters");
      return;
    }
    
    setLoading(true);
    setSearched(true);
    try {
      const dept = filterProgramme.includes("CSE") ? "CSE" :
                   filterProgramme.includes("ECE") ? "ECE" :
                   filterProgramme.includes("IT") ? "IT" :
                   filterProgramme.includes("EEE") ? "EEE" :
                   filterProgramme.includes("MECH") ? "MECH" : "";
                   
      const yearStr = filterSemester === "1" || filterSemester === "2" ? "1st Year" :
                      filterSemester === "3" || filterSemester === "4" ? "2nd Year" :
                      filterSemester === "5" || filterSemester === "6" ? "3rd Year" : "4th Year";

      let studentsList = [];
      if (dept) {
        const studentQ = query(collection(db, "users"), where("role", "==", "student"), where("dept", "==", dept), where("year", "==", yearStr));
        const sSnap = await getDocs(studentQ);
        studentsList = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } else {
        const studentQ = query(collection(db, "users"), where("role", "==", "student"));
        const sSnap = await getDocs(studentQ);
        studentsList = sSnap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, 10);
      }
      studentsList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      
      // Fetch Existing ESE Marks
      const marksQ = query(
        collection(db, "cia_marks"), 
        where("academicSession", "==", filterSession),
        where("courseId", "==", filterCourse),
        where("entryType", "==", "ESE")
      );
      const marksSnap = await getDocs(marksQ);
      const mData = {};
      const attData = {};
      
      marksSnap.docs.forEach(d => {
        const data = d.data();
        mData[data.studentId] = data.marks;
        attData[data.studentId] = data.isAbsent ? 'Absent' : 'Present';
      });

      // Default attendance to Present if not already marked
      studentsList.forEach(s => {
        if (!attData[s.id]) attData[s.id] = 'Present';
      });

      setStudents(studentsList);
      setMarksMap(mData);
      setAttendanceMap(attData);

      if (studentsList.length === 0) {
        toast.error("No students found.");
      }

    } catch (err) {
      console.error(err);
      toast.error("Error loading data");
    }
    setLoading(false);
  };

  const handleMarkChange = (studentId, value) => {
    const num = Number(value);
    if (value !== '' && (isNaN(num) || num < 0 || num > 100)) return; 
    setMarksMap(prev => ({ ...prev, [studentId]: value }));
  };

  const handleAttendanceChange = (studentId, value) => {
    setAttendanceMap(prev => ({ ...prev, [studentId]: value }));
    if (value === 'Absent') {
      setMarksMap(prev => ({ ...prev, [studentId]: 0 }));
    }
  };

  const calculateGrade = (marks) => {
    if (marks === undefined || marks === null || marks === '') return { grade: '-', point: 0 };
    const m = Number(marks);
    if (m >= 90) return { grade: 'O', point: 10 };
    if (m >= 80) return { grade: 'A+', point: 9 };
    if (m >= 70) return { grade: 'A', point: 8 };
    if (m >= 60) return { grade: 'B+', point: 7 };
    if (m >= 50) return { grade: 'B', point: 6 };
    return { grade: 'RA', point: 0 };
  };

  const handleSaveMarks = async (status = "Draft") => {
    if (students.length === 0) return;
    
    setSaving(true);
    try {
      const batchPromises = students.map(student => {
        const recordId = `${filterSession}_${filterCourse}_ESE_${student.id}`.replace(/\s+/g, '_');
        
        let finalMark = marksMap[student.id];
        let isAbsent = attendanceMap[student.id] === 'Absent';
        
        if (isAbsent) finalMark = 0;
        const { grade, point } = isAbsent ? { grade: 'AB', point: 0 } : calculateGrade(finalMark);

        return setDoc(doc(db, "cia_marks", recordId), {
          academicSession: filterSession,
          programmeName: filterProgramme,
          semester: filterSemester,
          courseId: filterCourse,
          studentId: student.id,
          studentName: student.name || 'Unknown',
          registerNo: student.registerNo || student.id,
          marks: Number(finalMark) || 0,
          isAbsent: isAbsent,
          grade: grade,
          gradePoint: point,
          entryType: "ESE",
          status: status,
          enteredBy: userProfile?.name || "System",
          updatedAt: new Date().toISOString()
        }, { merge: true });
      });

      await Promise.all(batchPromises);
      toast.success(`ESE marks saved as ${status}`);
    } catch (err) {
      console.error(err);
      toast.error("Error saving marks");
    }
    setSaving(false);
  };

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />
        <div className='page-header'>
          <h1>ESE Mark Entry Process</h1>
          <p className="subtitle">Enter marks and generate grades for End Semester Examinations</p>
        </div>

        {!searched ? (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Academic Session *</label>
                <select value={filterSession} onChange={(e) => setFilterSession(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                  <option value="">Select Session</option>
                  {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Programme *</label>
                <select value={filterProgramme} onChange={(e) => setFilterProgramme(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                  <option value="">Select Programme</option>
                  {PROGRAMMES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Semester *</label>
                <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                  <option value="">Select Semester</option>
                  {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Course Code *</label>
                <input type="text" placeholder="e.g. CS101" value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleSearch} className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px' }}>
                <Search size={16} /> {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        ) : (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 20 }}>
              <button onClick={() => setSearched(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <ArrowLeft size={18} /> Back to Filters
              </button>
              <div>
                <h3 style={{ margin: 0 }}>ESE Mark Entry</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Course: {filterCourse} | Semester: {filterSemester}</p>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading students...</div>
            ) : students.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No students found.</div>
            ) : (
              <>
                <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13, width: 60 }}>S.NO</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>REGISTER NO</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>STUDENT NAME</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>APPEARED STATUS</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>ESE MARKS (Max 100)</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>GRADE</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>GRADE POINT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, idx) => {
                        const isAbsent = attendanceMap[student.id] === 'Absent';
                        const mark = isAbsent ? 0 : marksMap[student.id];
                        const { grade, point } = isAbsent ? { grade: 'AB', point: 0 } : calculateGrade(mark);

                        return (
                          <tr key={student.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: isAbsent ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                            <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td style={{ padding: '12px 16px' }}>{student.registerNo || student.id}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 600 }}>{student.name || 'Unknown'}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <select 
                                value={attendanceMap[student.id] || 'Present'}
                                onChange={(e) => handleAttendanceChange(student.id, e.target.value)}
                                style={{ padding: '6px', borderRadius: 4, background: 'var(--bg-color)', color: 'var(--text)', border: '1px solid var(--border-color)' }}
                              >
                                <option value="Present">Appeared</option>
                                <option value="Absent">Absent</option>
                              </select>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <input 
                                type="number" 
                                value={isAbsent ? '0' : (marksMap[student.id] || '')}
                                onChange={(e) => handleMarkChange(student.id, e.target.value)}
                                disabled={isAbsent}
                                min="0" max="100"
                                placeholder="0"
                                style={{ 
                                  width: '80px', padding: '8px', borderRadius: 6, 
                                  border: '1px solid var(--border-color)', 
                                  background: isAbsent ? 'rgba(0,0,0,0.1)' : 'var(--bg-color)', 
                                  color: 'var(--text)',
                                  opacity: isAbsent ? 0.6 : 1
                                }}
                              />
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: 700, color: grade === 'RA' || grade === 'AB' ? '#ef4444' : '#10b981' }}>{grade}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 700 }}>{point}</td>
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
