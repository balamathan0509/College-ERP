import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, getDocs, setDoc, doc, where } from "../../supabase/supabaseAdapter";
import { Search, ArrowLeft } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { matchesAcademicSession } from '../../utils/collegeConfig';

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
  const [courses, setCourses] = useState([]);
  const [sessionMap, setSessionMap] = useState({});
  const [allocations, setAllocations] = useState([]);
  const [examSchedules, setExamSchedules] = useState([]);
  const [marksMap, setMarksMap] = useState({});
  const [gradesMap, setGradesMap] = useState({});
  const [attendanceMap, setAttendanceMap] = useState({});

  const GRADE_OPTIONS = [
    { grade: 'O', point: 10, label: 'O (Outstanding)', defaultMark: 95 },
    { grade: 'A+', point: 9, label: 'A+ (Excellent)', defaultMark: 85 },
    { grade: 'A', point: 8, label: 'A (Very Good)', defaultMark: 75 },
    { grade: 'B+', point: 7, label: 'B+ (Good)', defaultMark: 65 },
    { grade: 'B', point: 6, label: 'B (Average)', defaultMark: 55 },
    { grade: 'C', point: 5, label: 'C (Satisfactory)', defaultMark: 45 },
    { grade: 'RA', point: 0, label: 'RA (Re-Appearance)', defaultMark: 0 },
    { grade: 'SA', point: 0, label: 'SA (Shortage of Attendance)', defaultMark: 0 },
    { grade: 'W', point: 0, label: 'W (Withdrawal)', defaultMark: 0 },
    { grade: 'AB', point: 0, label: 'AB (Absent)', defaultMark: 0 },
  ];

  const SESSIONS = ["2025-2026", "2026-2027"];
  const PROGRAMMES = ["B.E CSE", "B.E ECE", "B.E EEE", "B.E MECH", "B.Tech IT"];
  const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];

  useEffect(() => {
    async function loadData() {
      try {
        const [cSnap, sessSnap, allocSnap, schedSnap] = await Promise.all([
          getDocs(collection(db, "courses")),
          getDocs(collection(db, "academic_sessions")).catch(() => ({ docs: [] })),
          getDocs(collection(db, "course_allocations")).catch(() => ({ docs: [] })),
          getDocs(collection(db, "cia_exam_schedules")).catch(() => ({ docs: [] }))
        ]);

        const sMap = {};
        sessSnap.docs.forEach(d => {
          const data = d.data();
          if (data && data.name) sMap[d.id] = data.name;
        });
        setSessionMap(sMap);

        setCourses(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAllocations(allocSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setExamSchedules(schedSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.warn("Failed to load data in MarkEntryESE:", e);
      }
    }
    loadData();
  }, []);

  const selectableCourses = useMemo(() => {
    if (!filterSession || !filterSemester) return [];
    const targetSem = String(filterSemester).trim();
    const deptKey = (filterProgramme || '').replace('B.E ', '').replace('B.Tech ', '').trim();

    const sessionCourseCodes = new Set();
    allocations.forEach(a => {
      const aSession = a.academicSession || sessionMap[a.sessionId] || '';
      if (matchesAcademicSession(aSession, filterSession, sessionMap)) {
        if (String(a.semester || '').trim() === targetSem) {
          if (!deptKey || (a.department || a.programme || '').includes(deptKey)) {
            if (a.courseCode) sessionCourseCodes.add(a.courseCode.trim().toUpperCase());
          }
        }
      }
    });

    examSchedules.forEach(s => {
      if (matchesAcademicSession(s.academicSession, filterSession, sessionMap)) {
        if (String(s.semester || '').trim() === targetSem) {
          if (!deptKey || (s.programmeName || '').includes(deptKey)) {
            if (s.courseCode) sessionCourseCodes.add(s.courseCode.trim().toUpperCase());
          }
        }
      }
    });

    return courses.filter(c => sessionCourseCodes.has((c.courseCode || '').trim().toUpperCase()));
  }, [filterSession, filterSemester, filterProgramme, courses, allocations, examSchedules, sessionMap]);

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

      // Filter by academic session
      if (filterSession) {
        studentsList = studentsList.filter(s => {
          const sSession = (s.academicSession || '').trim();
          if (sSession) return sSession === filterSession;
          const sBatch = (s.batch || '').replace(/\s+/g, '');
          if (sBatch.includes('-')) {
            const [startYear] = sBatch.split('-').map(Number);
            const semNum = Number(filterSemester) || 7;
            const yearNum = Math.ceil(semNum / 2);
            if (startYear && !isNaN(startYear)) {
              return `${startYear + (yearNum - 1)}-${startYear + yearNum}` === filterSession;
            }
          }
          return false;
        });
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
      const gData = {};
      const attData = {};
      
      marksSnap.docs.forEach(d => {
        const data = d.data();
        mData[data.studentId] = data.marks !== undefined ? data.marks : '';
        if (data.grade) gData[data.studentId] = data.grade;
        attData[data.studentId] = data.isAbsent ? 'Absent' : 'Present';
      });

      // Default attendance to Present if not already marked
      studentsList.forEach(s => {
        if (!attData[s.id]) attData[s.id] = 'Present';
      });

      setStudents(studentsList);
      setMarksMap(mData);
      setGradesMap(gData);
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

  const calculateGrade = (marks) => {
    if (marks === undefined || marks === null || marks === '') return { grade: '', point: 0 };
    const m = Number(marks);
    if (m >= 90) return { grade: 'O', point: 10 };
    if (m >= 80) return { grade: 'A+', point: 9 };
    if (m >= 70) return { grade: 'A', point: 8 };
    if (m >= 60) return { grade: 'B+', point: 7 };
    if (m >= 50) return { grade: 'B', point: 6 };
    if (m >= 45) return { grade: 'C', point: 5 };
    return { grade: 'RA', point: 0 };
  };

  const getPointForGrade = (g) => {
    const found = GRADE_OPTIONS.find(opt => opt.grade === g);
    return found ? found.point : 0;
  };

  const getGradeColor = (g) => {
    if (['O', 'A+', 'A'].includes(g)) return '#10b981';
    if (['B+', 'B', 'C'].includes(g)) return '#3b82f6';
    if (['RA', 'AB', 'SA', 'W'].includes(g)) return '#ef4444';
    return 'var(--text-muted)';
  };

  const handleGradeChange = (studentId, selectedGrade) => {
    setGradesMap(prev => ({ ...prev, [studentId]: selectedGrade }));
    const opt = GRADE_OPTIONS.find(o => o.grade === selectedGrade);
    
    if (selectedGrade === 'AB') {
      setAttendanceMap(prev => ({ ...prev, [studentId]: 'Absent' }));
      setMarksMap(prev => ({ ...prev, [studentId]: 0 }));
    } else {
      if (attendanceMap[studentId] === 'Absent') {
        setAttendanceMap(prev => ({ ...prev, [studentId]: 'Present' }));
      }
      if (opt) {
        setMarksMap(prev => ({ ...prev, [studentId]: opt.defaultMark }));
      }
    }
  };

  const handleMarkChange = (studentId, value) => {
    const num = Number(value);
    if (value !== '' && (isNaN(num) || num < 0 || num > 100)) return; 
    setMarksMap(prev => ({ ...prev, [studentId]: value }));
    if (value !== '') {
      const { grade } = calculateGrade(value);
      setGradesMap(prev => ({ ...prev, [studentId]: grade }));
    } else {
      setGradesMap(prev => ({ ...prev, [studentId]: '' }));
    }
  };

  const handleAttendanceChange = (studentId, value) => {
    setAttendanceMap(prev => ({ ...prev, [studentId]: value }));
    if (value === 'Absent') {
      setMarksMap(prev => ({ ...prev, [studentId]: 0 }));
      setGradesMap(prev => ({ ...prev, [studentId]: 'AB' }));
    } else {
      if (gradesMap[studentId] === 'AB') {
        setGradesMap(prev => ({ ...prev, [studentId]: '' }));
      }
    }
  };

  const handleSaveMarks = async (status = "Draft") => {
    if (students.length === 0) return;
    
    setSaving(true);
    try {
      const batchPromises = students.map(student => {
        const recordId = `${filterSession}_${filterCourse}_ESE_${student.id}`.replace(/\s+/g, '_');
        
        let finalMark = marksMap[student.id];
        let isAbsent = attendanceMap[student.id] === 'Absent';
        
        let grade = isAbsent ? 'AB' : (gradesMap[student.id] || calculateGrade(finalMark).grade || '-');
        let point = isAbsent ? 0 : getPointForGrade(grade);
        
        if (isAbsent) finalMark = 0;
        else if ((finalMark === undefined || finalMark === '' || finalMark === null) && grade) {
          const opt = GRADE_OPTIONS.find(o => o.grade === grade);
          finalMark = opt ? opt.defaultMark : 0;
        }

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
                <select 
                  value={filterCourse} 
                  onChange={(e) => setFilterCourse(e.target.value)} 
                  disabled={!filterSemester}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}
                >
                  {!filterSemester ? (
                    <option value="">Select Semester first</option>
                  ) : selectableCourses.length === 0 ? (
                    <option value="">No courses mapped to {filterSession} (Sem {filterSemester})</option>
                  ) : (
                    <>
                      <option value="">Select Course</option>
                      {selectableCourses.map(c => (
                        <option key={c.id || c.courseCode} value={c.courseCode}>
                          {c.courseCode} - {c.courseName}
                        </option>
                      ))}
                    </>
                  )}
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
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13, width: 50 }}>S.NO</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>REGISTER NO</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>STUDENT NAME</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>APPEARED STATUS</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>ANNA UNIV. GRADE</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>ESE MARKS (Max 100)</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>GRADE POINT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, idx) => {
                        const isAbsent = attendanceMap[student.id] === 'Absent';
                        const currentMark = marksMap[student.id];
                        
                        let displayGrade = '';
                        if (isAbsent) {
                          displayGrade = 'AB';
                        } else if (gradesMap[student.id]) {
                          displayGrade = gradesMap[student.id];
                        } else if (currentMark !== undefined && currentMark !== '') {
                          displayGrade = calculateGrade(currentMark).grade;
                        }
                        
                        const displayPoint = isAbsent ? 0 : getPointForGrade(displayGrade);
                        const gradeColor = getGradeColor(displayGrade);

                        return (
                          <tr key={student.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: isAbsent ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                            <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td style={{ padding: '12px 16px' }}>{student.registerNo || student.id}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 600 }}>{student.name || 'Unknown'}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <select 
                                value={attendanceMap[student.id] || 'Present'}
                                onChange={(e) => handleAttendanceChange(student.id, e.target.value)}
                                style={{ padding: '6px 10px', borderRadius: 6, background: 'var(--bg-color)', color: 'var(--text)', border: '1px solid var(--border-color)', fontSize: 13 }}
                              >
                                <option value="Present">Appeared</option>
                                <option value="Absent">Absent</option>
                              </select>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <select
                                value={displayGrade}
                                onChange={(e) => handleGradeChange(student.id, e.target.value)}
                                disabled={isAbsent}
                                style={{
                                  padding: '7px 10px',
                                  borderRadius: 6,
                                  background: 'var(--bg-color)',
                                  color: gradeColor,
                                  border: `1.5px solid ${displayGrade ? gradeColor : 'var(--border-color)'}`,
                                  fontWeight: 700,
                                  fontSize: '13px',
                                  minWidth: '130px',
                                  cursor: isAbsent ? 'not-allowed' : 'pointer'
                                }}
                              >
                                <option value="">- Select Grade -</option>
                                {GRADE_OPTIONS.map(opt => (
                                  <option key={opt.grade} value={opt.grade} style={{ color: getGradeColor(opt.grade), background: 'var(--card-bg, #1e293b)' }}>
                                    {opt.label} ({opt.point} pt)
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <input 
                                type="number" 
                                value={isAbsent ? '0' : (currentMark !== undefined ? currentMark : '')}
                                onChange={(e) => handleMarkChange(student.id, e.target.value)}
                                disabled={isAbsent}
                                min="0" max="100"
                                placeholder="0 - 100"
                                style={{ 
                                  width: '90px', padding: '7px 10px', borderRadius: 6, 
                                  border: '1px solid var(--border-color)', 
                                  background: isAbsent ? 'rgba(0,0,0,0.1)' : 'var(--bg-color)', 
                                  color: 'var(--text)',
                                  opacity: isAbsent ? 0.6 : 1,
                                  fontSize: '13px'
                                }}
                              />
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '32px',
                                height: '28px',
                                borderRadius: '6px',
                                fontWeight: 700,
                                fontSize: '13px',
                                background: displayPoint > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: displayPoint > 0 ? '#10b981' : '#ef4444'
                              }}>
                                {displayGrade ? displayPoint : '-'}
                              </span>
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
