import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, where, orderBy } from 'firebase/firestore';
import { Plus, Edit2, Trash2, Search, CheckCircle, XCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function ExamCreation() {
  const { userProfile } = useAuth();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    academicSession: '',
    examName: '',
    monthYear: '',
    programmeName: '',
    programmeCode: '',
    semester: '',
    examType: 'CIA',
    status: 'Active'
  });

  const SESSIONS = ["2025-2026", "2026-2027"];
  const PROGRAMMES = ["B.E CSE", "B.E ECE", "B.E EEE", "B.E MECH", "B.Tech IT"];
  const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];
  const EXAM_TYPES = ["CIA", "Model", "Practical", "Other"];

  useEffect(() => {
    fetchExams();
  }, []);

  async function fetchExams() {
    setLoading(true);
    try {
      const q = query(collection(db, "cia_examinations"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExams(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load exams");
    }
    setLoading(false);
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.academicSession || !formData.examName || !formData.monthYear || !formData.programmeName || !formData.semester) {
      toast.error("Please fill all mandatory fields");
      return;
    }

    setSaving(true);
    try {
      // Check for duplicates
      const dupQuery = query(
        collection(db, "cia_examinations"), 
        where("academicSession", "==", formData.academicSession),
        where("examName", "==", formData.examName),
        where("programmeName", "==", formData.programmeName),
        where("semester", "==", formData.semester)
      );
      const dupSnap = await getDocs(dupQuery);
      
      if (!dupSnap.empty && (!editId || dupSnap.docs[0].id !== editId)) {
        toast.error("An exam with this name already exists for the selected session, programme, and semester.");
        setSaving(false);
        return;
      }

      const payload = {
        ...formData,
        updatedAt: new Date().toISOString(),
        updatedBy: userProfile?.name || "System"
      };

      if (editId) {
        await updateDoc(doc(db, "cia_examinations", editId), payload);
        toast.success("Exam updated successfully");
      } else {
        payload.createdAt = new Date().toISOString();
        payload.createdBy = userProfile?.name || "System";
        await addDoc(collection(db, "cia_examinations"), payload);
        toast.success("Exam created successfully");
      }
      
      setShowModal(false);
      resetForm();
      fetchExams();
    } catch (err) {
      console.error(err);
      toast.error("Error saving exam");
    }
    setSaving(false);
  };

  const handleEdit = (exam) => {
    setFormData({
      academicSession: exam.academicSession || '',
      examName: exam.examName || '',
      monthYear: exam.monthYear || '',
      programmeName: exam.programmeName || '',
      programmeCode: exam.programmeCode || '',
      semester: exam.semester || '',
      examType: exam.examType || 'CIA',
      status: exam.status || 'Active'
    });
    setEditId(exam.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this exam? Make sure no schedules depend on it.")) {
      try {
        await deleteDoc(doc(db, "cia_examinations", id));
        toast.success("Exam deleted");
        fetchExams();
      } catch (err) {
        toast.error("Failed to delete exam");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      academicSession: '',
      examName: '',
      monthYear: '',
      programmeName: '',
      programmeCode: '',
      semester: '',
      examType: 'CIA',
      status: 'Active'
    });
    setEditId(null);
  };

  const filteredExams = exams.filter(e => 
    (e.examName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (e.programmeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.academicSession || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />
        <div className='page-header' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Exam Creation</h1>
            <p className="subtitle">Manage internal examinations and assessments</p>
          </div>
          <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
            <Plus size={18} /> Create New Exam
          </button>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
            <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
              <Search size={18} color="#9ca3af" />
              <input 
                type="text" 
                placeholder="Search by exam name, programme, or session..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}
              />
            </div>
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading examinations...</div>
          ) : filteredExams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No examinations found. Create one to get started.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>EXAM NAME</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>SESSION / MONTH</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>PROGRAMME / SEM</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>TYPE</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>STATUS</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExams.map((exam) => (
                    <tr key={exam.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{exam.examName}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div>{exam.academicSession}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{exam.monthYear}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div>{exam.programmeName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sem {exam.semester}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: 12 }}>
                          {exam.examType}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {exam.status === 'Active' ? 
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#10b981', fontSize: 13 }}><CheckCircle size={14}/> Active</span> : 
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#ef4444', fontSize: 13 }}><XCircle size={14}/> Inactive</span>
                        }
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button onClick={() => handleEdit(exam)} style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', marginRight: 12 }}><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(exam.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
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
            <h2 style={{ marginTop: 0, marginBottom: 20 }}>{editId ? 'Edit Examination' : 'Create New Examination'}</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Academic Session *</label>
                  <select name="academicSession" value={formData.academicSession} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                    <option value="">Select Session</option>
                    {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Name of Examination *</label>
                  <input type="text" name="examName" value={formData.examName} onChange={handleInputChange} placeholder="e.g. CIA I" required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Month & Year *</label>
                  <input type="month" name="monthYear" value={formData.monthYear} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Programme Name *</label>
                  <select name="programmeName" value={formData.programmeName} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                    <option value="">Select Programme</option>
                    {PROGRAMMES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Semester *</label>
                  <select name="semester" value={formData.semester} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                    <option value="">Select Semester</option>
                    {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Exam Type *</label>
                  <select name="examType" value={formData.examType} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                    {EXAM_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Status *</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Examination'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
