import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import { db } from '../../firebase/config';
import { collection, query, getDocs, addDoc, deleteDoc, doc, where, serverTimestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Search, Users, UserPlus, X, CheckCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const PROGRAMMES = ["B.E CSE", "B.E ECE", "B.E EEE", "B.E MECH", "B.E CIVIL", "B.Tech IT", "B.Tech AIDS", "B.Tech AIML", "MBA", "MCA"];
const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIDS", "AIML", "MBA", "MCA"];
const SEMESTERS = ["1","2","3","4","5","6","7","8"];
const SECTIONS = ["A", "B", "C", "D"];
const YEAR_MAP = { "1": "1st Year", "2": "1st Year", "3": "2nd Year", "4": "2nd Year", "5": "3rd Year", "6": "3rd Year", "7": "4th Year", "8": "4th Year" };

export default function CourseEnrollment() {
  const { userProfile } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [filterSession, setFilterSession] = useState('');
  const [filterProgramme, setFilterProgramme] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterSection, setFilterSection] = useState('');

  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [enrolling, setEnrolling] = useState(false);
  const [viewMode, setViewMode] = useState('enroll'); // 'enroll' | 'view'

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    const snap = await getDocs(query(collection(db, "academic_sessions"), orderBy("createdAt", "desc")));
    setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function handleSearch() {
    if (!filterSession || !filterSemester) { toast.error("Session and Semester are required."); return; }
    setLoading(true);
    try {
      // Load courses for this semester/programme
      let cQ = query(collection(db, "courses"));
      const cSnap = await getDocs(cQ);
      let courseList = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (filterSemester) courseList = courseList.filter(c => c.semester === filterSemester);
      if (filterProgramme) courseList = courseList.filter(c => c.programme === filterProgramme);
      if (filterDept) courseList = courseList.filter(c => c.department === filterDept);
      setCourses(courseList);

      // Load students
      const yearVal = YEAR_MAP[filterSemester] || '';
      let sQ = query(collection(db, "users"), where("role", "==", "student"));
      const sSnap = await getDocs(sQ);
      let studentList = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (filterDept) studentList = studentList.filter(s => s.dept === filterDept);
      if (yearVal) studentList = studentList.filter(s => s.year === yearVal);
      if (filterSection) studentList = studentList.filter(s => (s.section || 'A') === filterSection);
      studentList.sort((a, b) => (a.registerNo || a.name || '').localeCompare(b.registerNo || b.name || ''));
      setStudents(studentList);

      // Load existing enrollments
      const eQ = query(collection(db, "course_enrollments"), where("sessionId", "==", filterSession));
      const eSnap = await getDocs(eQ);
      setEnrollments(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); toast.error("Search failed."); }
    setLoading(false);
  }

  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    const s = searchTerm.toLowerCase();
    return students.filter(st => st.name?.toLowerCase().includes(s) || st.registerNo?.toLowerCase().includes(s));
  }, [students, searchTerm]);

  function isEnrolled(studentId, courseId) {
    return enrollments.some(e => e.studentId === studentId && e.courseId === courseId);
  }

  function toggleStudent(studentId) {
    setSelectedStudents(prev => prev.includes(studentId) ? prev.filter(x => x !== studentId) : [...prev, studentId]);
  }

  function selectAll() {
    const ids = filteredStudents.filter(s => !isEnrolled(s.id, selectedCourse)).map(s => s.id);
    setSelectedStudents(ids);
  }

  async function handleEnroll() {
    if (!selectedCourse) { toast.error("Select a course first."); return; }
    if (selectedStudents.length === 0) { toast.error("Select at least one student."); return; }
    setEnrolling(true);
    const course = courses.find(c => c.id === selectedCourse);
    try {
      let enrolled = 0;
      for (const sid of selectedStudents) {
        if (isEnrolled(sid, selectedCourse)) continue;
        const student = students.find(s => s.id === sid);
        await addDoc(collection(db, "course_enrollments"), {
          sessionId: filterSession,
          studentId: sid,
          studentName: student?.name || '',
          registerNo: student?.registerNo || '',
          courseId: selectedCourse,
          courseCode: course?.courseCode || '',
          courseName: course?.courseName || '',
          programme: filterProgramme,
          semester: filterSemester,
          classSection: filterSection || 'A',
          department: filterDept || student?.dept || '',
          createdAt: serverTimestamp(),
          createdBy: userProfile?.uid
        });
        enrolled++;
      }
      toast.success(`${enrolled} students enrolled successfully!`);
      setSelectedStudents([]);
      handleSearch();
    } catch (err) { console.error(err); toast.error("Enrollment failed."); }
    setEnrolling(false);
  }

  async function handleRemoveEnrollment(enrollmentId) {
    if (!window.confirm("Remove this enrollment?")) return;
    try {
      await deleteDoc(doc(db, "course_enrollments", enrollmentId));
      toast.success("Enrollment removed.");
      handleSearch();
    } catch (err) { toast.error("Failed."); }
  }

  const courseEnrollments = useMemo(() => {
    if (!selectedCourse) return [];
    return enrollments.filter(e => e.courseId === selectedCourse);
  }, [enrollments, selectedCourse]);

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text)', fontSize: 13 };
  const labelStyle = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header">
          <h1><Users size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />Course Enrollment</h1>
          <p className="subtitle">Enroll students into courses</p>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Academic Session *</label>
              <select value={filterSession} onChange={e => setFilterSession(e.target.value)} style={inputStyle}>
                <option value="">-- Select --</option>
                {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Programme</label>
              <select value={filterProgramme} onChange={e => setFilterProgramme(e.target.value)} style={inputStyle}>
                <option value="">-- All --</option>
                {PROGRAMMES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Department</label>
              <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={inputStyle}>
                <option value="">-- All --</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Semester *</label>
              <select value={filterSemester} onChange={e => setFilterSemester(e.target.value)} style={inputStyle}>
                <option value="">-- Select --</option>
                {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Section</label>
              <select value={filterSection} onChange={e => setFilterSection(e.target.value)} style={inputStyle}>
                <option value="">-- All --</option>
                {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleSearch} className="btn-primary" style={{ padding: '8px 20px' }}>Search</button>
        </div>

        {students.length > 0 && (
          <>
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <label style={labelStyle}>Select Course *</label>
                  <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} style={{ ...inputStyle, minWidth: 250 }}>
                    <option value="">-- Select Course --</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.courseCode} - {c.courseName}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
                  <button onClick={() => setViewMode('enroll')} style={{ padding: '8px 16px', borderRadius: 8, border: viewMode === 'enroll' ? '1px solid var(--accent)' : '1px solid var(--border)', background: viewMode === 'enroll' ? 'var(--accent)' : 'transparent', color: viewMode === 'enroll' ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 13 }}>Enroll</button>
                  <button onClick={() => setViewMode('view')} style={{ padding: '8px 16px', borderRadius: 8, border: viewMode === 'view' ? '1px solid var(--accent)' : '1px solid var(--border)', background: viewMode === 'view' ? 'var(--accent)' : 'transparent', color: viewMode === 'view' ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 13 }}>View Enrolled</button>
                </div>
              </div>
            </div>

            {viewMode === 'enroll' ? (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={selectAll} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}>Select All</button>
                    <button onClick={handleEnroll} disabled={enrolling} className="btn-primary" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <UserPlus size={14} /> {enrolling ? 'Enrolling...' : `Enroll (${selectedStudents.length})`}
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search students..." style={{ ...inputStyle, paddingLeft: 32, width: 220 }} />
                  </div>
                </div>
                {loading ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '10px 8px', width: 40 }}></th>
                          <th style={{ padding: '10px 8px', textAlign: 'left' }}>S.No</th>
                          <th style={{ padding: '10px 8px', textAlign: 'left' }}>Register No</th>
                          <th style={{ padding: '10px 8px', textAlign: 'left' }}>Student Name</th>
                          <th style={{ padding: '10px 8px', textAlign: 'left' }}>Department</th>
                          <th style={{ padding: '10px 8px', textAlign: 'left' }}>Year</th>
                          <th style={{ padding: '10px 8px', textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((s, idx) => {
                          const enrolled = selectedCourse && isEnrolled(s.id, selectedCourse);
                          return (
                            <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', opacity: enrolled ? 0.5 : 1 }}>
                              <td style={{ padding: '8px', textAlign: 'center' }}>
                                <input type="checkbox" checked={selectedStudents.includes(s.id)} onChange={() => toggleStudent(s.id)} disabled={enrolled} />
                              </td>
                              <td style={{ padding: '8px' }}>{idx + 1}</td>
                              <td style={{ padding: '8px' }}>{s.registerNo || '-'}</td>
                              <td style={{ padding: '8px' }}>{s.name}</td>
                              <td style={{ padding: '8px' }}>{s.dept}</td>
                              <td style={{ padding: '8px' }}>{s.year}</td>
                              <td style={{ padding: '8px', textAlign: 'center' }}>
                                {enrolled ? <span style={{ color: 'var(--success)', fontSize: 11, fontWeight: 'bold' }}>ENROLLED</span> : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredStudents.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>No students found.</div>}
                  </div>
                )}
              </div>
            ) : (
              <div className="card">
                <h3 style={{ marginBottom: 16 }}>Enrolled Students {selectedCourse && `(${courseEnrollments.length})`}</h3>
                {!selectedCourse ? <p style={{ color: 'var(--text-muted)' }}>Select a course to view enrolled students.</p> : courseEnrollments.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No students enrolled in this course yet.</p> : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '10px 8px', textAlign: 'left' }}>S.No</th>
                          <th style={{ padding: '10px 8px', textAlign: 'left' }}>Register No</th>
                          <th style={{ padding: '10px 8px', textAlign: 'left' }}>Student Name</th>
                          <th style={{ padding: '10px 8px', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courseEnrollments.map((e, idx) => (
                          <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px' }}>{idx + 1}</td>
                            <td style={{ padding: '8px' }}>{e.registerNo || '-'}</td>
                            <td style={{ padding: '8px' }}>{e.studentName}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <button onClick={() => handleRemoveEnrollment(e.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }}>Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
