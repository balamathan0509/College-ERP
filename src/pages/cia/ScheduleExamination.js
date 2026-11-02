import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, where, orderBy } from "../../supabase/supabaseAdapter";
import { Plus, Edit2, Trash2, Search, CheckCircle, XCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { getStoredCollegeStructure, matchesAcademicSession } from '../../utils/collegeConfig';

export default function ScheduleExamination() {
  const { userProfile } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [exams, setExams] = useState([]);
  const [courses, setCourses] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [sessionMap, setSessionMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Filters
  const [filterSession, setFilterSession] = useState('');
  const [filterProgramme, setFilterProgramme] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  
  // Form State
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    examId: '',
    courseCode: '',
    courseName: '',
    class: '',
    date: '',
    session: 'FN',
    startTime: '',
    endTime: '',
    status: 'Scheduled'
  });

  const SESSIONS = ["2025-2026", "2026-2027"];
  const PROGRAMMES = ["B.E CSE", "B.E ECE", "B.E EEE", "B.E MECH", "B.Tech IT"];
  const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];

  useEffect(() => {
    fetchExams();
    fetchSchedules();
    fetchCoursesAndAllocations();
  }, []);

  async function fetchCoursesAndAllocations() {
    try {
      const [cSnap, sessSnap, allocSnap] = await Promise.all([
        getDocs(collection(db, "courses")),
        getDocs(collection(db, "academic_sessions")).catch(() => ({ docs: [] })),
        getDocs(collection(db, "course_allocations")).catch(() => ({ docs: [] }))
      ]);

      const sMap = {};
      sessSnap.docs.forEach(d => {
        const data = d.data();
        if (data && data.name) sMap[d.id] = data.name;
      });
      setSessionMap(sMap);

      setCourses(cSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setAllocations(allocSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchExams() {
    try {
      const q = query(collection(db, "cia_examinations"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExams(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load exams");
    }
  }

  async function fetchSchedules() {
    setLoading(true);
    try {
      const q = query(collection(db, "cia_exam_schedules"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchedules(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load schedules");
    }
    setLoading(false);
  }

  // Selected exam metadata
  const selectedExam = useMemo(() => {
    return exams.find(e => e.id === formData.examId) || null;
  }, [exams, formData.examId]);

  // Dynamic available classes/sections based on selected exam or college structure
  const availableClasses = useMemo(() => {
    try {
      const structure = getStoredCollegeStructure();
      const prog = selectedExam?.programmeName || filterProgramme || 'B.E CSE';
      const sem = selectedExam?.semester || filterSemester || '7';
      const deptKey = (prog || '').replace('B.E ', '').replace('B.Tech ', '').trim() || 'CSE';
      const semNum = Number(sem) || 7;
      const yearNum = Math.ceil(semNum / 2) || 4;

      const sections = structure?.sections?.[deptKey]?.[String(yearNum)] || ['Single'];
      if (sections.includes('Single')) {
        return [{ value: 'Single Class', label: 'Single Class' }];
      }
      return sections.map(s => {
        const val = s.startsWith('Section') ? s : `Section ${s}`;
        return { value: val, label: val };
      });
    } catch (e) {
      return [{ value: 'Single Class', label: 'Single Class' }];
    }
  }, [selectedExam, filterProgramme, filterSemester]);

  // Filter courses strictly for selected exam session, programme, and semester
  const selectableCourses = useMemo(() => {
    if (!selectedExam) return [];
    const targetSem = String(selectedExam.semester || '').trim();
    const examSession = selectedExam.academicSession || '';
    const deptKey = (selectedExam.programmeName || '').replace('B.E ', '').replace('B.Tech ', '').trim();

    // Collect course codes allocated to this exam's academic session and semester
    const sessionCodes = new Set();
    allocations.forEach(a => {
      const aSession = a.academicSession || sessionMap[a.sessionId] || '';
      if (matchesAcademicSession(aSession, examSession, sessionMap)) {
        if (String(a.semester || '').trim() === targetSem) {
          if (!deptKey || (a.department || a.programme || '').includes(deptKey)) {
            if (a.courseCode) sessionCodes.add(a.courseCode.trim().toUpperCase());
          }
        }
      }
    });

    return courses.filter(c => {
      const code = (c.courseCode || '').trim().toUpperCase();
      const sem = String(c.semester || '').trim();
      const dept = (c.department || c.programme || '').trim();
      if (sem !== targetSem) return false;
      if (deptKey && dept && !dept.includes(deptKey)) return false;
      return sessionCodes.has(code);
    });
  }, [courses, selectedExam, allocations, sessionMap]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'examId') {
        const ex = exams.find(x => x.id === value);
        if (ex) {
          try {
            const structure = getStoredCollegeStructure();
            const deptKey = (ex.programmeName || '').replace('B.E ', '').replace('B.Tech ', '').trim() || 'CSE';
            const semNum = Number(ex.semester) || 7;
            const yearNum = Math.ceil(semNum / 2) || 4;
            const sections = structure?.sections?.[deptKey]?.[String(yearNum)] || ['Single'];
            if (sections.includes('Single')) {
              newData.class = 'Single Class';
            } else if (sections.length > 0) {
              newData.class = sections[0].startsWith('Section') ? sections[0] : `Section ${sections[0]}`;
            }
          } catch (err) {
            newData.class = 'Single Class';
          }
        }
      }
      if (name === 'courseCode') {
        const selectedCourse = courses.find(c => c.courseCode === value);
        if (selectedCourse) {
          newData.courseName = selectedCourse.courseName;
        } else {
          newData.courseName = '';
        }
      }
      return newData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.examId || !formData.courseCode || !formData.courseName || !formData.class || !formData.date || !formData.startTime || !formData.endTime) {
      toast.error("Please fill all mandatory fields");
      return;
    }
    if (formData.startTime >= formData.endTime) {
      toast.error("Start time must be before end time");
      return;
    }

    setSaving(true);
    try {
      // Find selected exam to attach its metadata
      const selectedExam = exams.find(ex => ex.id === formData.examId);
      if (!selectedExam) throw new Error("Invalid Exam Selected");

      // Check for overlap / duplicates
      const dupQuery = query(
        collection(db, "cia_exam_schedules"), 
        where("examId", "==", formData.examId),
        where("class", "==", formData.class),
        where("date", "==", formData.date)
      );
      const dupSnap = await getDocs(dupQuery);
      
      const isOverlap = dupSnap.docs.some(d => {
        if (editId && d.id === editId) return false;
        const dData = d.data();
        // Check if times overlap
        return (formData.startTime < dData.endTime && formData.endTime > dData.startTime);
      });

      if (isOverlap) {
        toast.error("There is a scheduling conflict for this class on the selected date/time.");
        setSaving(false);
        return;
      }

      const payload = {
        ...formData,
        academicSession: selectedExam.academicSession,
        programmeName: selectedExam.programmeName,
        semester: selectedExam.semester,
        examName: selectedExam.examName,
        examType: selectedExam.examType || 'CIA',
        maxMarks: Number(selectedExam.maxMarks) || (selectedExam.examType === 'Model' ? 100 : 50),
        passMarks: Number(selectedExam.passMarks) || (selectedExam.examType === 'Model' ? 75 : 35),
        monthYear: selectedExam.monthYear,
        updatedAt: new Date().toISOString(),
        updatedBy: userProfile?.name || "System"
      };

      if (editId) {
        await updateDoc(doc(db, "cia_exam_schedules", editId), payload);
        toast.success("Schedule updated successfully");
      } else {
        payload.createdAt = new Date().toISOString();
        payload.createdBy = userProfile?.name || "System";
        await addDoc(collection(db, "cia_exam_schedules"), payload);
        toast.success("Exam scheduled successfully");
      }

      // Notify the staff assigned to this course
      try {
        const allocQ = query(collection(db, "subject_allocations"), where("courseCode", "==", formData.courseCode));
        const allocSnap = await getDocs(allocQ);
        allocSnap.docs.forEach(async (d) => {
          const allocData = d.data();
          await addDoc(collection(db, "alerts"), {
            title: "CIA Exam Scheduled",
            message: `An exam for your course ${formData.courseCode} (${formData.courseName}) has been scheduled on ${formData.date} at ${formData.startTime}.`,
            date: new Date().toISOString(),
            targetRole: "staff",
            targetUid: allocData.facultyId,
            isRead: false
          });
        });
      } catch (notifErr) {
        console.error("Notification Error:", notifErr);
      }
      
      setShowModal(false);
      resetForm();
      fetchSchedules();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error saving schedule");
    }
    setSaving(false);
  };

  const handleEdit = (schedule) => {
    setFormData({
      examId: schedule.examId || '',
      courseCode: schedule.courseCode || '',
      courseName: schedule.courseName || '',
      class: schedule.class || '',
      date: schedule.date || '',
      session: schedule.session || 'FN',
      startTime: schedule.startTime || '',
      endTime: schedule.endTime || '',
      status: schedule.status || 'Scheduled'
    });
    setEditId(schedule.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this schedule?")) {
      try {
        await deleteDoc(doc(db, "cia_exam_schedules", id));
        toast.success("Schedule deleted");
        fetchSchedules();
      } catch (err) {
        toast.error("Failed to delete schedule");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      examId: '',
      courseCode: '',
      courseName: '',
      class: '',
      date: '',
      session: 'FN',
      startTime: '',
      endTime: '',
      status: 'Scheduled'
    });
    setEditId(null);
  };

  const filteredSchedules = schedules.filter(s => {
    if (filterSession && s.academicSession !== filterSession) return false;
    if (filterProgramme && s.programmeName !== filterProgramme) return false;
    if (filterSemester && s.semester !== filterSemester) return false;
    return true;
  });

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />
        {/* Professional Header */}
        <div style={{
          marginTop: '24px',
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '16px'
        }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '600', color: 'var(--text-dark)', textTransform: 'none' }}>
              Schedule Examination
            </h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
              Manage examination timetables
            </p>
          </div>
          <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true); }} style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px', fontWeight: '500', width: 'auto' }}>
            <Plus size={18} /> Schedule Exam
          </button>
        </div>

        <div className="card" style={{ marginBottom: 24, boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={filterSession} onChange={(e) => setFilterSession(e.target.value)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: 'var(--text-dark)', fontSize: '14px', outline: 'none', transition: 'all 0.2s', minWidth: '150px' }}>
              <option value="">All Session</option>
              {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterProgramme} onChange={(e) => setFilterProgramme(e.target.value)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: 'var(--text-dark)', fontSize: '14px', outline: 'none', transition: 'all 0.2s', minWidth: '180px' }}>
              <option value="">All Dept</option>
              {PROGRAMMES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: 'var(--text-dark)', fontSize: '14px', outline: 'none', transition: 'all 0.2s', minWidth: '150px' }}>
              <option value="">All Semester</option>
              {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="card" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading schedules...</div>
          ) : filteredSchedules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No schedules found. Create one to get started.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', background: '#f8fafc' }}>
                    <th style={{ padding: '16px 20px', color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>EXAM / SESSION</th>
                    <th style={{ padding: '16px 20px', color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>COURSE</th>
                    <th style={{ padding: '16px 20px', color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CLASS</th>
                    <th style={{ padding: '16px 20px', color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>DATE & TIME</th>
                    <th style={{ padding: '16px 20px', color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>STATUS</th>
                    <th style={{ padding: '16px 20px', color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchedules.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s', ':hover': { background: '#f8fafc' } }}>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ color: 'var(--text-dark)', fontSize: '14px', fontWeight: '600' }}>{item.examName}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: '4px' }}>{item.academicSession} | Sem {item.semester}</div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ color: 'var(--text-dark)', fontSize: '14px', fontWeight: '500' }}>{item.courseCode}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: '4px' }}>{item.courseName}</div>
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: '600', color: 'var(--text-dark)', fontSize: '14px' }}>{item.class}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ color: 'var(--text-dark)', fontSize: '14px', fontWeight: '500' }}>{item.date} ({item.session})</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: '4px' }}>{item.startTime} - {item.endTime}</div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ padding: '6px 12px', borderRadius: '20px', background: item.status === 'Completed' ? 'rgba(16, 185, 129, 0.1)' : (item.status === 'Cancelled' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59,130,246,0.1)'), color: item.status === 'Completed' ? '#10b981' : (item.status === 'Cancelled' ? '#ef4444' : '#3b82f6'), fontSize: 12, fontWeight: '600' }}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <button onClick={() => handleEdit(item)} style={{ background: 'rgba(99, 102, 241, 0.1)', border: 'none', color: '#6366f1', cursor: 'pointer', marginRight: 12, padding: '8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Edit"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(item.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Delete"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '90%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', padding: '32px', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
                {editId ? 'Edit Schedule' : 'Schedule Examination'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Select Examination *</label>
                  <select name="examId" value={formData.examId} onChange={handleInputChange} required style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }}>
                    <option value="">Select Exam</option>
                    {exams.map(e => <option key={e.id} value={e.id}>{e.examName} ({e.academicSession} - {e.programmeName} Sem {e.semester})</option>)}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Course Code *</label>
                  <select 
                    name="courseCode" 
                    value={formData.courseCode} 
                    onChange={handleInputChange} 
                    required 
                    disabled={!formData.examId}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }}
                  >
                    {!formData.examId ? (
                      <option value="">Select Examination first</option>
                    ) : selectableCourses.length === 0 ? (
                      <option value="">No courses allocated for this exam session / semester</option>
                    ) : (
                      <>
                        <option value="">Select Course</option>
                        {selectableCourses.map(c => <option key={c.id} value={c.courseCode}>{c.courseCode} - {c.courseName}</option>)}
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Course Name *</label>
                  <input type="text" name="courseName" value={formData.courseName} onChange={handleInputChange} placeholder="Course Name" required readOnly style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#e2e8f0', color: '#64748b', fontSize: '14px', outline: 'none', cursor: 'not-allowed' }} />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Class / Section *</label>
                  <select 
                    name="class" 
                    value={formData.class} 
                    onChange={handleInputChange} 
                    required 
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }}
                  >
                    <option value="">Select Class</option>
                    {availableClasses.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                    {formData.class && !availableClasses.some(c => c.value === formData.class) && (
                      <option value={formData.class}>{formData.class}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Date *</label>
                  <input type="date" name="date" value={formData.date} onChange={handleInputChange} required style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }} />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Session *</label>
                  <select name="session" value={formData.session} onChange={handleInputChange} required style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }}>
                    <option value="FN">FN (Forenoon)</option>
                    <option value="AN">AN (Afternoon)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Status *</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} required style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }}>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Start Time *</label>
                  <input type="time" name="startTime" value={formData.startTime} onChange={handleInputChange} required style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>End Time *</label>
                  <input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange} required style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }} />
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '10px 24px', borderRadius: '8px', fontWeight: '600', width: 'auto' }}>
                  {saving ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
