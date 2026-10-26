import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, getDocs, setDoc, doc, where } from "../../supabase/supabaseAdapter";
import { getStoredCollegeStructure, matchesAcademicSession } from '../../utils/collegeConfig';
import { Search, ArrowLeft } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function MarkEntryOther() {
  const { userProfile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Allocations for the logged-in staff
  const [allocations, setAllocations] = useState([]);
  const [sessionMap, setSessionMap] = useState({});

  // Filters
  const [filterSession, setFilterSession] = useState('2026-2027');
  const [filterProgramme, setFilterProgramme] = useState('B.E CSE');
  const [filterSemester, setFilterSemester] = useState('7');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterClass, setFilterClass] = useState('Single Class');
  const [filterComponent, setFilterComponent] = useState('Assignment');
  
  const [searched, setSearched] = useState(false);

  const [students, setStudents] = useState([]);
  const [marksMap, setMarksMap] = useState({});

  const SESSIONS = ["2025-2026", "2026-2027"];
  const PROGRAMMES = ["B.E CSE", "B.E ECE", "B.E EEE", "B.E MECH", "B.Tech IT"];
  const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];
  const COMPONENTS = ["Assignment", "Quiz", "Seminar", "Tutorial", "Practical", "Internal Test"];

  useEffect(() => {
    fetchStaffAllocations();
  }, [userProfile]);

  async function fetchStaffAllocations() {
    if (!userProfile) return;
    try {
      const uid = userProfile.uid || userProfile.id;
      const userName = (userProfile.name || "").trim().toLowerCase();
      const userEmail = (userProfile.email || "").trim().toLowerCase();

      // 0. Fetch academic sessions for name resolution
      try {
        const sessSnap = await getDocs(collection(db, "academic_sessions"));
        const sMap = {};
        sessSnap.docs.forEach(d => {
          const data = d.data();
          if (data && data.name) sMap[d.id] = data.name;
        });
        setSessionMap(sMap);
      } catch (e) {}

      // 1. Fetch from subject_allocations
      let rawSubs = [];
      try {
        const snap = await getDocs(collection(db, "subject_allocations"));
        snap.docs.forEach(d => {
          const data = d.data();
          if (!data) return;
          const fUid = data.facultyId;
          const fName = (data.facultyName || "").trim().toLowerCase();
          if (
            (fUid && String(fUid) === String(uid)) ||
            (fName && userName && (fName === userName || fName.includes(userName) || userName.includes(fName)))
          ) {
            rawSubs.push({ id: d.id, ...data });
          }
        });
      } catch (e) {}

      // 2. Fetch from course_allocations
      let rawCourses = [];
      try {
        const snap = await getDocs(collection(db, "course_allocations"));
        snap.docs.forEach(d => {
          const data = d.data();
          if (!data) return;
          const fUid = data.facultyId;
          const fName = (data.facultyName || "").trim().toLowerCase();
          const fEmail = (data.facultyEmail || "").trim().toLowerCase();
          if (
            (fUid && String(fUid) === String(uid)) ||
            (fEmail && fEmail === userEmail) ||
            (fName && userName && (fName === userName || fName.includes(userName) || userName.includes(fName)))
          ) {
            rawCourses.push({ id: d.id, ...data });
          }
        });
      } catch (e) {}

      // Normalize
      const map = new Map();
      const addAlloc = (item) => {
        const code = (item.courseCode || item.subjectCode || item.subject_code || '').trim().toUpperCase();
        if (!code) return;
        const name = (item.courseName || item.subjectName || item.subject_name || '').trim();
        const sem = String(item.semester || '7').trim();
        const sec = (item.section || '').trim();
        const prog = item.programme || item.batch || 'B.E CSE';
        const key = `${code}_${sem}_${sec}`;

        if (!map.has(key)) {
          map.set(key, {
            id: item.id || key,
            courseCode: code,
            courseName: name,
            semester: sem,
            section: sec,
            programme: prog,
            department: item.department || item.dept || 'CSE',
            sessionId: item.sessionId || item.academicSession || ''
          });
        }
      };

      rawSubs.forEach(addAlloc);
      rawCourses.forEach(addAlloc);

      const allocList = Array.from(map.values());
      setAllocations(allocList);

      // Pre-select first allocated course for staff
      if (allocList.length > 0 && !filterCourse) {
        const first = allocList[0];
        setFilterCourse(first.courseCode);
        if (first.semester) setFilterSemester(first.semester);
        if (first.programme) setFilterProgramme(first.programme);
        if (first.section && first.section !== 'None' && first.section !== '.') {
          setFilterClass(first.section);
        } else {
          setFilterClass('Single Class');
        }
      }
    } catch (err) {
      console.warn("fetchStaffAllocations error:", err);
    }
  }

  // Dynamic allocations mapped to selected Academic Session & Semester
  const sessionAllocations = useMemo(() => {
    if (!filterSession) return [];
    return allocations.filter(a => {
      const sessionMatches = matchesAcademicSession(a.sessionId, filterSession, sessionMap);
      if (!sessionMatches) return false;
      if (filterSemester && String(a.semester || '').trim() !== String(filterSemester).trim()) {
        return false;
      }
      return true;
    });
  }, [allocations, filterSession, filterSemester, sessionMap]);

  // Keep filterCourse synced with sessionAllocations
  useEffect(() => {
    if (sessionAllocations.length > 0) {
      const match = sessionAllocations.find(a => a.courseCode === filterCourse);
      if (!match) {
        handleCourseChange(sessionAllocations[0].courseCode);
      }
    } else {
      setFilterCourse('');
    }
  }, [sessionAllocations]);

  // Dynamic available classes/sections based on Programme & Semester from college structure
  const availableClasses = useMemo(() => {
    try {
      const structure = getStoredCollegeStructure();
      const deptKey = (filterProgramme || '').replace('B.E ', '').replace('B.Tech ', '').trim() || 'CSE';
      const semNum = Number(filterSemester) || 7;
      const yearNum = Math.ceil(semNum / 2) || 4; // 1, 2, 3, or 4
      
      const sections = structure?.sections?.[deptKey]?.[String(yearNum)] || ['Single'];
      if (sections.includes('Single')) {
        return [{ value: 'Single Class', label: 'Single Class' }];
      }
      return sections.map(s => ({
        value: s,
        label: `Section ${s}`
      }));
    } catch (e) {
      return [{ value: 'Single Class', label: 'Single Class' }];
    }
  }, [filterProgramme, filterSemester]);

  // Handle course change
  const handleCourseChange = (selectedCode) => {
    setFilterCourse(selectedCode);
    const alloc = allocations.find(a => a.courseCode === selectedCode);
    if (alloc) {
      if (alloc.semester) setFilterSemester(alloc.semester);
      if (alloc.programme) setFilterProgramme(alloc.programme);
      if (alloc.section && alloc.section !== 'None' && alloc.section !== '.') {
        setFilterClass(alloc.section);
      } else {
        const semNum = Number(alloc.semester) || 7;
        const yearNum = Math.ceil(semNum / 2) || 4;
        const deptKey = (alloc.programme || '').replace('B.E ', '').replace('B.Tech ', '').trim() || 'CSE';
        const structure = getStoredCollegeStructure();
        const secs = structure?.sections?.[deptKey]?.[String(yearNum)] || ['Single'];
        if (secs.includes('Single')) setFilterClass('Single Class');
        else setFilterClass(secs[0]);
      }
    }
  };

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
                   filterProgramme.includes("MECH") ? "MECH" : "CSE";
                   
      const semNum = Number(filterSemester) || 7;
      const yearNum = Math.ceil(semNum / 2); // 1, 2, 3, or 4
      const yearStr = `${yearNum}${yearNum === 1 ? 'st' : yearNum === 2 ? 'nd' : yearNum === 3 ? 'rd' : 'th'} Year`;

      // Query students in this department
      const studentQ = query(collection(db, "users"), where("role", "==", "student"), where("dept", "==", dept));
      const sSnap = await getDocs(studentQ);
      const allDeptStudents = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Strictly filter students by Academic Session, Year/Semester and Class/Section
      const filteredStudents = allDeptStudents.filter(s => {
        // 0. Academic Session match
        if (filterSession) {
          const sSession = (s.academicSession || '').trim();
          const sBatch = (s.batch || '').replace(/\s+/g, '');
          
          let sessionMatches = false;
          if (sSession) {
            sessionMatches = (sSession === filterSession);
          } else if (sBatch.includes('-')) {
            // For batch e.g. 2023-2027:
            // Year 1 (Sem 1-2): 2023-2024
            // Year 2 (Sem 3-4): 2024-2025
            // Year 3 (Sem 5-6): 2025-2026
            // Year 4 (Sem 7-8): 2026-2027
            const [startYear] = sBatch.split('-').map(Number);
            if (startYear && !isNaN(startYear)) {
              const expectedSession = `${startYear + (yearNum - 1)}-${startYear + yearNum}`;
              sessionMatches = (expectedSession === filterSession);
            }
          }
          if (!sessionMatches) return false;
        }

        // 1. Year / Semester match
        const sYear = (s.year || '').trim();
        const sSem = String(s.semester || s.sem || '').trim();
        const yearMatches = sYear.toLowerCase() === yearStr.toLowerCase() ||
                            sYear.startsWith(String(yearNum)) ||
                            sSem === String(filterSemester) ||
                            (filterSemester === '7' && (sSem === 'VII' || sSem === '7')) ||
                            (filterSemester === '3' && (sSem === 'III' || sSem === '3')) ||
                            (filterSemester === '1' && (sSem === 'I' || sSem === '1')) ||
                            (filterSemester === '5' && (sSem === 'V' || sSem === '5'));
        if (!yearMatches) return false;

        // 2. Class / Section match
        const sSec = (s.section || s.sec || '').trim().toUpperCase();
        const target = filterClass.trim().toUpperCase();

        if (target === 'SINGLE CLASS' || target === 'SINGLE' || target === 'NONE' || target === 'NO' || target === '.') {
          return !sSec || sSec === '.' || sSec === 'NO' || sSec === 'NONE' || sSec === 'SINGLE';
        } else {
          const cleanTarget = target.replace('SECTION', '').replace('CLASS', '').trim();
          return sSec === cleanTarget || sSec === `CLASS ${cleanTarget}` || sSec === `SEC ${cleanTarget}`;
        }
      });

      filteredStudents.sort((a, b) => (a.registerNo || a.name || "").localeCompare(b.registerNo || b.name || ""));
      
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

      setStudents(filteredStudents);
      setMarksMap(mData);

      if (filteredStudents.length === 0) {
        toast.error(`No students found for ${filterProgramme} Sem ${filterSemester} (${filterClass})`);
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
                {sessionAllocations.length > 0 ? (
                  <select 
                    value={filterCourse} 
                    onChange={(e) => handleCourseChange(e.target.value)} 
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}
                  >
                    <option value="">Select Course</option>
                    {sessionAllocations.map(a => (
                      <option key={a.id} value={a.courseCode}>
                        {a.courseCode} - {a.courseName} (Sem {a.semester})
                      </option>
                    ))}
                  </select>
                ) : (
                  <select 
                    disabled
                    value=""
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-muted)' }}
                  >
                    <option value="">No subjects allocated for {filterSession} (Sem {filterSemester})</option>
                  </select>
                )}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Class / Section *</label>
                <select 
                  value={filterClass} 
                  onChange={(e) => setFilterClass(e.target.value)} 
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}
                >
                  <option value="">Select Class</option>
                  {availableClasses.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
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
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                No students found for Academic Session {filterSession}, {filterProgramme} Sem {filterSemester} ({filterClass}).
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
