import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import { db } from '../../firebase/config';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, where, serverTimestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Plus, Search, Edit2, Trash2, Download, Upload, X, BookOpen } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';

const PROGRAMMES = ["B.E CSE", "B.E ECE", "B.E EEE", "B.E MECH", "B.E CIVIL", "B.Tech IT", "B.Tech AIDS", "B.Tech AIML", "MBA", "MCA"];
const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIDS", "AIML", "MBA", "MCA"];
const SEMESTERS = ["1","2","3","4","5","6","7","8"];
const REGULATIONS = ["R2021","R2020","R2019","R2017"];

export default function CourseAllocation() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [allocations, setAllocations] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Filters
  const [filterSession, setFilterSession] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterProgramme, setFilterProgramme] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterRegulation, setFilterRegulation] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Session Modal
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionForm, setSessionForm] = useState({ name: '', startDate: '', endDate: '', term: 'ODD', isActive: true });

  // Course Modal
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseForm, setCourseForm] = useState({ courseCode: '', courseName: '', programme: '', department: '', semester: '', regulationId: 'R2021', credits: '', totalHours: '', chapters: '' });

  // Allocation Form
  const [form, setForm] = useState({
    sessionId: '', semester: '', programme: '', programmeCode: '', department: '', regulationId: 'R2021',
    courseId: '', courseCode: '', courseName: '',
    facultyId: '', facultyName: '', facultyCode: '',
    chapters: '', hoursAllocated: ''
  });

  useEffect(() => {
    fetchMasterData();
  }, []);

  async function fetchMasterData() {
    try {
      // Sessions
      const sessSnap = await getDocs(query(collection(db, "academic_sessions"), orderBy("createdAt", "desc")));
      setSessions(sessSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      // Courses
      const courseSnap = await getDocs(collection(db, "courses"));
      setCourses(courseSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      // Faculty
      const facQ = query(collection(db, "users"), where("role", "in", ["staff", "hod"]));
      const facSnap = await getDocs(facQ);
      setFaculty(facSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
  }

  async function fetchAllocations() {
    if (!filterSession) { toast.error("Please select Academic Session."); return; }
    setLoading(true);
    try {
      let q = query(collection(db, "course_allocations"), where("sessionId", "==", filterSession));
      if (userProfile?.role === 'hod') {
        q = query(collection(db, "course_allocations"), where("sessionId", "==", filterSession), where("department", "==", userProfile.dept));
      }
      const snap = await getDocs(q);
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (filterSemester) list = list.filter(a => a.semester === filterSemester);
      if (filterProgramme) list = list.filter(a => a.programme === filterProgramme);
      if (userProfile?.role !== 'hod' && filterDept) list = list.filter(a => a.department === filterDept);
      if (filterRegulation) list = list.filter(a => a.regulationId === filterRegulation);
      setAllocations(list);
    } catch (err) { console.error(err); toast.error("Failed to load allocations."); }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    if (!searchTerm) return allocations;
    const s = searchTerm.toLowerCase();
    return allocations.filter(a =>
      a.courseCode?.toLowerCase().includes(s) || a.courseName?.toLowerCase().includes(s) ||
      a.facultyName?.toLowerCase().includes(s) || a.facultyCode?.toLowerCase().includes(s)
    );
  }, [allocations, searchTerm]);

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page]);

  const totalPages = Math.ceil(filtered.length / perPage);

  // Filter courses by selected programme/semester
  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      if (form.programme && c.programme !== form.programme) return false;
      if (form.semester && c.semester !== form.semester) return false;
      if (form.department && c.department !== form.department) return false;
      return true;
    });
  }, [courses, form.programme, form.semester, form.department]);

  function openAdd() {
    setModalMode('add');
    setEditId(null);
    setForm({
      sessionId: filterSession, semester: filterSemester || '', programme: filterProgramme || '',
      programmeCode: '', department: filterDept || '', regulationId: filterRegulation || 'R2021',
      courseId: '', courseCode: '', courseName: '',
      facultyId: '', facultyName: '', facultyCode: '',
      chapters: '', hoursAllocated: ''
    });
    setShowModal(true);
  }

  function openEdit(alloc) {
    setModalMode('edit');
    setEditId(alloc.id);
    setForm({
      sessionId: alloc.sessionId, semester: alloc.semester, programme: alloc.programme,
      programmeCode: alloc.programmeCode || '', department: alloc.department, regulationId: alloc.regulationId || 'R2021',
      courseId: alloc.courseId, courseCode: alloc.courseCode, courseName: alloc.courseName,
      facultyId: alloc.facultyId, facultyName: alloc.facultyName, facultyCode: alloc.facultyCode || '',
      chapters: alloc.chapters || '', hoursAllocated: alloc.hoursAllocated || ''
    });
    setShowModal(true);
  }

  function handleCourseSelect(courseId) {
    const c = courses.find(x => x.id === courseId);
    if (c) {
      setForm(prev => ({ ...prev, courseId: c.id, courseCode: c.courseCode, courseName: c.courseName, chapters: c.chapters || prev.chapters }));
    }
  }

  function handleFacultySelect(facId) {
    const f = faculty.find(x => x.id === facId);
    if (f) {
      setForm(prev => ({ ...prev, facultyId: f.id, facultyName: f.name, facultyCode: f.registerNo || f.uid?.substring(0, 8) || '' }));
    }
  }

  async function handleSave() {
    if (!form.sessionId || !form.courseId || !form.facultyId) {
      toast.error("Session, Course and Faculty are required."); return;
    }
    if (!form.hoursAllocated || isNaN(form.hoursAllocated)) {
      toast.error("Please enter valid Hours Allocated."); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        hoursAllocated: Number(form.hoursAllocated),
        chapters: Number(form.chapters) || 0,
        updatedAt: serverTimestamp(),
        updatedBy: userProfile?.uid
      };
      if (modalMode === 'add') {
        // Check duplicate
        const dupQ = query(collection(db, "course_allocations"),
          where("sessionId", "==", form.sessionId),
          where("courseId", "==", form.courseId),
          where("facultyId", "==", form.facultyId)
        );
        const dupSnap = await getDocs(dupQ);
        if (!dupSnap.empty) { toast.error("This course is already allocated to this faculty."); setSaving(false); return; }

        payload.createdAt = serverTimestamp();
        payload.createdBy = userProfile?.uid;
        await addDoc(collection(db, "course_allocations"), payload);
        toast.success("Course allocated successfully!");
      } else {
        await updateDoc(doc(db, "course_allocations", editId), payload);
        toast.success("Allocation updated!");
      }
      setShowModal(false);
      fetchAllocations();
    } catch (err) { console.error(err); toast.error("Failed to save."); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this allocation?")) return;
    try {
      await deleteDoc(doc(db, "course_allocations", id));
      toast.success("Deleted.");
      fetchAllocations();
    } catch (err) { toast.error("Delete failed."); }
  }

  // Session CRUD
  async function handleSaveSession() {
    if (!sessionForm.name) { toast.error("Session name is required."); return; }
    try {
      // Check duplicate
      const dupQ = query(collection(db, "academic_sessions"), where("name", "==", sessionForm.name));
      const dupSnap = await getDocs(dupQ);
      if (!dupSnap.empty) { toast.error("This session already exists."); return; }
      await addDoc(collection(db, "academic_sessions"), { ...sessionForm, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: userProfile?.uid });
      toast.success("Session created!");
      setShowSessionModal(false);
      setSessionForm({ name: '', startDate: '', endDate: '', term: 'ODD', isActive: true });
      fetchMasterData();
    } catch (err) { toast.error("Failed."); }
  }

  // Course CRUD
  async function handleSaveCourse() {
    if (!courseForm.courseCode || !courseForm.courseName) { toast.error("Course code & name required."); return; }
    try {
      const dupQ = query(collection(db, "courses"), where("courseCode", "==", courseForm.courseCode));
      const dupSnap = await getDocs(dupQ);
      if (!dupSnap.empty) { toast.error("Course code already exists."); return; }
      await addDoc(collection(db, "courses"), { ...courseForm, credits: Number(courseForm.credits) || 0, totalHours: Number(courseForm.totalHours) || 0, chapters: Number(courseForm.chapters) || 0, status: 'active', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: userProfile?.uid });
      toast.success("Course created!");
      setShowCourseModal(false);
      setCourseForm({ courseCode: '', courseName: '', programme: '', department: '', semester: '', regulationId: 'R2021', credits: '', totalHours: '', chapters: '' });
      fetchMasterData();
    } catch (err) { toast.error("Failed."); }
  }

  function handleExport() {
    const data = filtered.map((a, i) => ({
      'S.No': i + 1, 'Course Code': a.courseCode, 'Course Name': a.courseName,
      'Faculty Code': a.facultyCode, 'Faculty Name': a.facultyName,
      'Chapters': a.chapters, 'Hours Allocated': a.hoursAllocated
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Allocations");
    XLSX.writeFile(wb, "Course_Allocations.xlsx");
  }

  function handleDownloadTemplate() {
    const data = [{ 'Course Code': '', 'Course Name': '', 'Faculty Code': '', 'Faculty Name': '', 'No of Chapters': '', 'Hours Allocated': '' }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Course_Allocation_Template.xlsx");
  }

  const sessionName = sessions.find(s => s.id === filterSession)?.name || '';

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text)', fontSize: 13 };
  const labelStyle = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header">
          <h1><BookOpen size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />Course Allocation</h1>
          <p className="subtitle">Allocate courses to faculty members</p>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Academic Session *</label>
              <div style={{ display: 'flex', gap: 4 }}>
                <select value={filterSession} onChange={e => setFilterSession(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                  <option value="">-- Select --</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {userProfile?.role === "admin" && (
                  <button onClick={() => setShowSessionModal(true)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 16 }} title="Add Session">+</button>
                )}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Semester *</label>
              <select value={filterSemester} onChange={e => setFilterSemester(e.target.value)} style={inputStyle}>
                <option value="">-- All --</option>
                {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
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
              <label style={labelStyle}>Regulation ID</label>
              <select value={filterRegulation} onChange={e => setFilterRegulation(e.target.value)} style={inputStyle}>
                <option value="">-- All --</option>
                {REGULATIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={fetchAllocations} className="btn-primary" style={{ padding: '8px 20px' }}>Search</button>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={openAdd} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}>
                <Plus size={16} /> Create
              </button>
              <button onClick={() => setShowCourseModal(true)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }}>
                + Add Course
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }} placeholder="Search..." style={{ ...inputStyle, paddingLeft: 32, width: 200 }} />
              </div>
              <button onClick={handleDownloadTemplate} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>Template</button>
              <button onClick={handleExport} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>
                <Download size={14} /> Export
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              {allocations.length === 0 ? 'Search to load allocations or create a new one.' : 'No matching records found.'}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>S.No</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>Course Code</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>Course Name</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>Faculty Code</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>Faculty Name</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Chapters</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Hours</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((a, idx) => (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 8px' }}>{(page - 1) * perPage + idx + 1}</td>
                        <td style={{ padding: '10px 8px' }}>{a.courseCode}</td>
                        <td style={{ padding: '10px 8px' }}>{a.courseName}</td>
                        <td style={{ padding: '10px 8px' }}>{a.facultyCode || '-'}</td>
                        <td style={{ padding: '10px 8px' }}>{a.facultyName}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>{a.chapters || '-'}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>{a.hoursAllocated}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button onClick={() => openEdit(a)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}><Edit2 size={15} /></button>
                            <button onClick={() => handleDelete(a.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button key={i} onClick={() => setPage(i + 1)} style={{ padding: '4px 10px', borderRadius: 6, border: page === i + 1 ? '1px solid var(--accent)' : '1px solid var(--border)', background: page === i + 1 ? 'var(--accent)' : 'transparent', color: page === i + 1 ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 12 }}>{i + 1}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Allocation Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#ffffff', borderRadius: 12, padding: 24, width: '90%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>{modalMode === 'add' ? 'Create' : 'Edit'} Course Allocation</h3>
                <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Academic Session *</label>
                  <select value={form.sessionId} onChange={e => setForm({ ...form, sessionId: e.target.value })} style={inputStyle}>
                    <option value="">-- Select --</option>
                    {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Semester *</label>
                  <select value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })} style={inputStyle}>
                    <option value="">-- Select --</option>
                    {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Programme *</label>
                  <select value={form.programme} onChange={e => setForm({ ...form, programme: e.target.value })} style={inputStyle}>
                    <option value="">-- Select --</option>
                    {PROGRAMMES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Department</label>
                  <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} style={inputStyle}>
                    <option value="">-- Select --</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Regulation ID</label>
                  <select value={form.regulationId} onChange={e => setForm({ ...form, regulationId: e.target.value })} style={inputStyle}>
                    {REGULATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Course *</label>
                  <select value={form.courseId} onChange={e => handleCourseSelect(e.target.value)} style={inputStyle}>
                    <option value="">-- Select Course --</option>
                    {filteredCourses.map(c => <option key={c.id} value={c.id}>{c.courseCode} - {c.courseName}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Faculty *</label>
                  <select value={form.facultyId} onChange={e => handleFacultySelect(e.target.value)} style={inputStyle}>
                    <option value="">-- Select Faculty --</option>
                    {faculty.filter(f => !form.department || f.dept === form.department).map(f => <option key={f.id} value={f.id}>{f.name} ({f.dept})</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>No. of Chapters</label>
                  <input type="number" value={form.chapters} onChange={e => setForm({ ...form, chapters: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Hours Allocated *</label>
                  <input type="number" value={form.hoursAllocated} onChange={e => setForm({ ...form, hoursAllocated: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ padding: '8px 20px' }}>
                  {saving ? 'Saving...' : modalMode === 'add' ? 'Create' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Session Modal */}
        {showSessionModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#ffffff', borderRadius: 12, padding: 24, width: '90%', maxWidth: 450, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>Add Academic Session</h3>
                <button onClick={() => setShowSessionModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Session Name *</label>
                  <input value={sessionForm.name} onChange={e => setSessionForm({ ...sessionForm, name: e.target.value })} placeholder="e.g. 2026 - 2027 (ODD)" style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>Start Date</label><input type="date" value={sessionForm.startDate} onChange={e => setSessionForm({ ...sessionForm, startDate: e.target.value })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>End Date</label><input type="date" value={sessionForm.endDate} onChange={e => setSessionForm({ ...sessionForm, endDate: e.target.value })} style={inputStyle} /></div>
                </div>
                <div>
                  <label style={labelStyle}>Term</label>
                  <select value={sessionForm.term} onChange={e => setSessionForm({ ...sessionForm, term: e.target.value })} style={inputStyle}>
                    <option value="ODD">ODD</option>
                    <option value="EVEN">EVEN</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowSessionModal(false)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSaveSession} className="btn-primary" style={{ padding: '8px 20px' }}>Save Session</button>
              </div>
            </div>
          </div>
        )}

        {/* Course Modal */}
        {showCourseModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#ffffff', borderRadius: 12, padding: 24, width: '90%', maxWidth: 500, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>Add Course</h3>
                <button onClick={() => setShowCourseModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={labelStyle}>Course Code *</label><input value={courseForm.courseCode} onChange={e => setCourseForm({ ...courseForm, courseCode: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Course Name *</label><input value={courseForm.courseName} onChange={e => setCourseForm({ ...courseForm, courseName: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Programme</label><select value={courseForm.programme} onChange={e => setCourseForm({ ...courseForm, programme: e.target.value })} style={inputStyle}><option value="">--</option>{PROGRAMMES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                <div><label style={labelStyle}>Department</label><select value={courseForm.department} onChange={e => setCourseForm({ ...courseForm, department: e.target.value })} style={inputStyle}><option value="">--</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                <div><label style={labelStyle}>Semester</label><select value={courseForm.semester} onChange={e => setCourseForm({ ...courseForm, semester: e.target.value })} style={inputStyle}><option value="">--</option>{SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><label style={labelStyle}>Regulation</label><select value={courseForm.regulationId} onChange={e => setCourseForm({ ...courseForm, regulationId: e.target.value })} style={inputStyle}>{REGULATIONS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                <div><label style={labelStyle}>Credits</label><input type="number" value={courseForm.credits} onChange={e => setCourseForm({ ...courseForm, credits: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Total Hours</label><input type="number" value={courseForm.totalHours} onChange={e => setCourseForm({ ...courseForm, totalHours: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>No. of Chapters</label><input type="number" value={courseForm.chapters} onChange={e => setCourseForm({ ...courseForm, chapters: e.target.value })} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowCourseModal(false)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSaveCourse} className="btn-primary" style={{ padding: '8px 20px' }}>Save Course</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
