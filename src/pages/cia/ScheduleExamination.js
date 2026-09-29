import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, where, orderBy } from 'firebase/firestore';
import { Plus, Edit2, Trash2, Search, CheckCircle, XCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function ScheduleExamination() {
  const { userProfile } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [exams, setExams] = useState([]);
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
  }, []);

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
        <div className='page-header' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Schedule Examination</h1>
            <p className="subtitle">Manage examination timetables</p>
          </div>
          <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
            <Plus size={18} /> Schedule Exam
          </button>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 15, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={filterSession} onChange={(e) => setFilterSession(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
              <option value="">All Sessions</option>
              {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterProgramme} onChange={(e) => setFilterProgramme(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
              <option value="">All Programmes</option>
              {PROGRAMMES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
              <option value="">All Semesters</option>
              {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading schedules...</div>
          ) : filteredSchedules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No schedules found. Create one to get started.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>EXAM / SESSION</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>COURSE</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>CLASS</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>DATE & TIME</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>STATUS</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchedules.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{item.examName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.academicSession} | Sem {item.semester}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div>{item.courseCode}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.courseName}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.class}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div>{item.date} ({item.session})</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.startTime} - {item.endTime}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: 4, background: item.status === 'Completed' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)', color: item.status === 'Completed' ? '#10b981' : '#3b82f6', fontSize: 12 }}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button onClick={() => handleEdit(item)} style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', marginRight: 12 }}><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(item.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
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
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '90%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0, marginBottom: 20 }}>{editId ? 'Edit Schedule' : 'Schedule Examination'}</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 20 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Select Examination *</label>
                  <select name="examId" value={formData.examId} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                    <option value="">Select Exam</option>
                    {exams.map(e => <option key={e.id} value={e.id}>{e.examName} ({e.academicSession} - {e.programmeName} Sem {e.semester})</option>)}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Course Code *</label>
                  <input type="text" name="courseCode" value={formData.courseCode} onChange={handleInputChange} placeholder="e.g. CS101" required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Course Name *</label>
                  <input type="text" name="courseName" value={formData.courseName} onChange={handleInputChange} placeholder="e.g. Data Structures" required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Class *</label>
                  <input type="text" name="class" value={formData.class} onChange={handleInputChange} placeholder="e.g. CSE-A" required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Date *</label>
                  <input type="date" name="date" value={formData.date} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Session *</label>
                  <select name="session" value={formData.session} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                    <option value="FN">FN (Forenoon)</option>
                    <option value="AN">AN (Afternoon)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Status *</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Start Time *</label>
                  <input type="time" name="startTime" value={formData.startTime} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>End Time *</label>
                  <input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
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
