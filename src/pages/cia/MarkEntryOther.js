import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { collection, query, getDocs, setDoc, doc, where } from 'firebase/firestore';
import { Search, ArrowLeft } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function MarkEntryOther() {
  const { userProfile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterSession, setFilterSession] = useState('');
  const [filterProgramme, setFilterProgramme] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterComponent, setFilterComponent] = useState('');
  
  const [searched, setSearched] = useState(false);

  const [students, setStudents] = useState([]);
  const [marksMap, setMarksMap] = useState({});

  const SESSIONS = ["2025-2026", "2026-2027"];
  const PROGRAMMES = ["B.E CSE", "B.E ECE", "B.E EEE", "B.E MECH", "B.Tech IT"];
  const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];
  const COMPONENTS = ["Assignment", "Quiz", "Seminar", "Tutorial", "Practical", "Internal Test"];

  const handleSearch = async () => {
    if (!filterSession || !filterProgramme || !filterSemester || !filterCourse || !filterClass || !filterComponent) {
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
      
      // Fetch Existing Marks
      const marksQ = query(
        collection(db, "cia_marks"), 
        where("academicSession", "==", filterSession),
        where("courseId", "==", filterCourse),
        where("classId", "==", filterClass),
        where("componentType", "==", filterComponent),
        where("entryType", "==", "OTHER")
      );
      const marksSnap = await getDocs(marksQ);
      const mData = {};
      
      marksSnap.docs.forEach(d => {
        const data = d.data();
        mData[data.studentId] = data.marks;
      });

      setStudents(studentsList);
      setMarksMap(mData);

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

  const handleSaveMarks = async (status = "Draft") => {
    if (students.length === 0) return;
    
    setSaving(true);
    try {
      const batchPromises = students.map(student => {
        const recordId = `${filterSession}_${filterCourse}_${filterClass}_${filterComponent}_${student.id}`.replace(/\s+/g, '_');
        
        return setDoc(doc(db, "cia_marks", recordId), {
          academicSession: filterSession,
          programmeName: filterProgramme,
          semester: filterSemester,
          courseId: filterCourse,
          classId: filterClass,
          componentType: filterComponent,
          studentId: student.id,
          studentName: student.name || 'Unknown',
          registerNo: student.registerNo || student.id,
          marks: Number(marksMap[student.id]) || 0,
          entryType: "OTHER",
          status: status,
          enteredBy: userProfile?.name || "System",
          updatedAt: new Date().toISOString()
        }, { merge: true });
      });

      await Promise.all(batchPromises);
      toast.success(`${filterComponent} marks saved as ${status}`);
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
          <h1>Other Mark Entry Process</h1>
          <p className="subtitle">Enter marks for Assignments, Quizzes, Seminars, etc.</p>
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
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Class *</label>
                <input type="text" placeholder="e.g. CSE-A" value={filterClass} onChange={(e) => setFilterClass(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Component *</label>
                <select value={filterComponent} onChange={(e) => setFilterComponent(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                  <option value="">Select Component</option>
                  {COMPONENTS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
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
                <h3 style={{ margin: 0 }}>{filterComponent} Mark Entry</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Course: {filterCourse} | Class: {filterClass}</p>
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
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13, width: 150 }}>MARKS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, idx) => (
                        <tr key={student.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ padding: '12px 16px' }}>{student.registerNo || student.id}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{student.name || 'Unknown'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <input 
                              type="number" 
                              value={marksMap[student.id] || ''}
                              onChange={(e) => handleMarkChange(student.id, e.target.value)}
                              min="0" max="100"
                              placeholder="0"
                              style={{ 
                                width: '100px', padding: '8px', borderRadius: 6, 
                                border: '1px solid var(--border-color)', 
                                background: 'var(--bg-color)', 
                                color: 'var(--text)'
                              }}
                            />
                          </td>
                        </tr>
                      ))}
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
