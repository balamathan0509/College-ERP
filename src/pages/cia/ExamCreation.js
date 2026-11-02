import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, where, orderBy } from "../../supabase/supabaseAdapter";
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
    maxMarks: 50,
    passMarks: 35,
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
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      // When examType changes, provide intelligent defaults (Model: 100/75, CIA/Internal: 50/35), but allow custom alteration
      if (name === 'examType') {
        if (value === 'Model') {
          updated.maxMarks = 100;
          updated.passMarks = 75;
        } else if (value === 'CIA') {
          updated.maxMarks = 50;
          updated.passMarks = 35;
        } else if (value === 'Practical') {
          updated.maxMarks = 100;
          updated.passMarks = 75;
        }
      } else if (name === 'maxMarks') {
        const num = Number(value);
        if (num === 100 && prev.passMarks === 35) {
          updated.passMarks = 75;
        } else if (num === 50 && prev.passMarks === 75) {
          updated.passMarks = 35;
        }
      }
      return updated;
    });
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
        maxMarks: Number(formData.maxMarks) || 50,
        passMarks: Number(formData.passMarks) || 35,
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
    const isModel = (exam.examType === 'Model' || (exam.examName || '').toLowerCase().includes('model'));
    setFormData({
      academicSession: exam.academicSession || '',
      examName: exam.examName || '',
      monthYear: exam.monthYear || '',
      programmeName: exam.programmeName || '',
      programmeCode: exam.programmeCode || '',
      semester: exam.semester || '',
      examType: exam.examType || (isModel ? 'Model' : 'CIA'),
      maxMarks: exam.maxMarks !== undefined ? Number(exam.maxMarks) : (isModel ? 100 : 50),
      passMarks: exam.passMarks !== undefined ? Number(exam.passMarks) : (isModel ? 75 : 35),
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
      maxMarks: 50,
      passMarks: 35,
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
              Exam Creation
            </h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
              Manage internal examinations and assessments.
            </p>
          </div>
          <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true); }} style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px', fontWeight: '500', width: 'auto' }}>
            <Plus size={18} /> Create New Exam
          </button>
        </div>

        <div className="card" style={{ marginBottom: 24, boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
            <div className="search-bar" style={{ flex: 1, maxWidth: 400, position: 'relative' }}>
              <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Search by exam name, programme, or session..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: 'var(--text-dark)', fontSize: '14px', outline: 'none', transition: 'all 0.2s' }}
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading examinations...</div>
          ) : filteredExams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No examinations found. Create one to get started.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', background: '#f8fafc' }}>
                    <th style={{ padding: '16px 20px', color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>EXAM NAME</th>
                    <th style={{ padding: '16px 20px', color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SESSION / MONTH</th>
                    <th style={{ padding: '16px 20px', color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>DEPT / SEM</th>
                    <th style={{ padding: '16px 20px', color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TYPE</th>
                    <th style={{ padding: '16px 20px', color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MARKS (MAX / PASS)</th>
                    <th style={{ padding: '16px 20px', color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>STATUS</th>
                    <th style={{ padding: '16px 20px', color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExams.map((exam) => (
                    <tr key={exam.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s', ':hover': { background: '#f8fafc' } }}>
                      <td style={{ padding: '16px 20px', fontWeight: '600', color: 'var(--text-dark)', fontSize: '14px' }}>{exam.examName}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ color: 'var(--text-dark)', fontSize: '14px', fontWeight: '500' }}>{exam.academicSession}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: '4px' }}>{exam.monthYear}</div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ color: 'var(--text-dark)', fontSize: '14px', fontWeight: '500' }}>{exam.programmeName}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: '4px' }}>Sem {exam.semester}</div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: 12, fontWeight: '600' }}>
                          {exam.examType}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ color: 'var(--text-dark)', fontSize: '14px', fontWeight: '600' }}>
                          Max: {exam.maxMarks !== undefined ? exam.maxMarks : (exam.examType === 'Model' ? 100 : 50)}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: '4px' }}>
                          Pass: {exam.passMarks !== undefined ? exam.passMarks : (exam.examType === 'Model' ? 75 : 35)}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        {exam.status === 'Active' ? 
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: 13, fontWeight: '500', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '20px' }}><CheckCircle size={14}/> Active</span> : 
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontSize: 13, fontWeight: '500', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 12px', borderRadius: '20px' }}><XCircle size={14}/> Inactive</span>
                        }
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <button onClick={() => handleEdit(exam)} style={{ background: 'rgba(99, 102, 241, 0.1)', border: 'none', color: '#6366f1', cursor: 'pointer', marginRight: 12, padding: '8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Edit"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(exam.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Delete"><Trash2 size={16} /></button>
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
          <div className="card" style={{ width: '90%', maxWidth: 650, maxHeight: '90vh', overflowY: 'auto', padding: '32px', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
                {editId ? 'Edit Examination' : 'Create New Examination'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Academic Session *</label>
                  <select name="academicSession" value={formData.academicSession} onChange={handleInputChange} required style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }}>
                    <option value="">Select Session</option>
                    {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Name of Examination *</label>
                  <input type="text" name="examName" value={formData.examName} onChange={handleInputChange} placeholder="e.g. CIA I / Model Exam" required style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Month & Year *</label>
                  <input type="month" name="monthYear" value={formData.monthYear} onChange={handleInputChange} required style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Department *</label>
                  <select name="programmeName" value={formData.programmeName} onChange={handleInputChange} required style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }}>
                    <option value="">Select Department</option>
                    {PROGRAMMES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Semester *</label>
                  <select name="semester" value={formData.semester} onChange={handleInputChange} required style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }}>
                    <option value="">Select Semester</option>
                    {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Exam Type *</label>
                  <select name="examType" value={formData.examType} onChange={handleInputChange} required style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }}>
                    {EXAM_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Maximum Marks (Max Mark) *</label>
                  <input 
                    type="number" 
                    name="maxMarks" 
                    value={formData.maxMarks} 
                    onChange={handleInputChange} 
                    placeholder="e.g. 100 or 50" 
                    min="1" 
                    required 
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Minimum Pass Mark *</label>
                  <input 
                    type="number" 
                    name="passMarks" 
                    value={formData.passMarks} 
                    onChange={handleInputChange} 
                    placeholder="e.g. 50 or 35" 
                    min="1" 
                    required 
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }} 
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Status *</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} required style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '10px 24px', borderRadius: '8px', fontWeight: '600', width: 'auto' }}>
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
