import React, { useState, useEffect } from 'react';
import Sidebar from '../../../components/Sidebar';
import { db } from '../../../firebase/config';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { FileText, Plus, Edit2, Trash2, X, Users } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function Assignments() {
  const { userProfile } = useAuth();
  const [allocations, setAllocations] = useState([]);
  const [selectedAlloc, setSelectedAlloc] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [editId, setEditId] = useState(null);
  
  const [form, setForm] = useState({
    topic: '', description: '', assignmentDate: '', lastSubmissionDate: '',
    maxMarks: '10', instruction: '', fileUrl: ''
  });
  const [selectedStudents, setSelectedStudents] = useState([]);

  useEffect(() => {
    if (userProfile?.uid) {
      getDocs(query(collection(db, "course_allocations"), where("facultyId", "==", userProfile.uid)))
        .then(snap => setAllocations(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
  }, [userProfile]);

  useEffect(() => {
    if (selectedAlloc) {
      fetchAssignments();
      fetchEnrolledStudents();
    }
  }, [selectedAlloc]);

  async function fetchAssignments() {
    setLoading(true);
    try {
      const q = query(collection(db, "academic_assignments"), where("allocationId", "==", selectedAlloc));
      const snap = await getDocs(q);
      setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { toast.error("Failed to load assignments."); }
    setLoading(false);
  }

  async function fetchEnrolledStudents() {
    try {
      const alloc = allocations.find(a => a.id === selectedAlloc);
      if (!alloc) return;
      // Fetch enrollments for this course
      const q = query(collection(db, "course_enrollments"), where("courseId", "==", alloc.courseId), where("sessionId", "==", alloc.sessionId));
      const snap = await getDocs(q);
      setEnrolledStudents(snap.docs.map(d => ({ id: d.studentId, name: d.studentName, registerNo: d.registerNo })));
    } catch (err) { console.error(err); }
  }

  function openAdd() {
    setModalMode('add');
    setEditId(null);
    setForm({ topic: '', description: '', assignmentDate: '', lastSubmissionDate: '', maxMarks: '10', instruction: '', fileUrl: '' });
    setSelectedStudents(enrolledStudents.map(s => s.id)); // select all by default
    setShowModal(true);
  }

  function openEdit(asn) {
    setModalMode('edit');
    setEditId(asn.id);
    setForm({ topic: asn.topic || '', description: asn.description || '', assignmentDate: asn.assignmentDate || '', lastSubmissionDate: asn.lastSubmissionDate || '', maxMarks: asn.maxMarks || '10', instruction: asn.instruction || '', fileUrl: asn.fileUrl || '' });
    setSelectedStudents(asn.selectedStudents || []);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.topic || !form.assignmentDate || !form.lastSubmissionDate) { toast.error("Topic and dates required."); return; }
    setSaving(true);
    try {
      const alloc = allocations.find(a => a.id === selectedAlloc);
      const payload = {
        ...form,
        allocationId: selectedAlloc,
        courseId: alloc.courseId,
        courseCode: alloc.courseCode,
        facultyId: userProfile.uid,
        selectedStudents,
        updatedAt: serverTimestamp()
      };
      
      if (modalMode === 'add') {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "academic_assignments"), payload);
        toast.success("Assignment created.");
      } else {
        await updateDoc(doc(db, "academic_assignments", editId), payload);
        toast.success("Assignment updated.");
      }
      setShowModal(false);
      fetchAssignments();
    } catch (err) { toast.error("Save failed."); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this assignment?")) return;
    try {
      await deleteDoc(doc(db, "academic_assignments", id));
      toast.success("Deleted.");
      fetchAssignments();
    } catch (err) { toast.error("Delete failed."); }
  }

  function toggleStudent(id) {
    setSelectedStudents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text)', fontSize: 13 };
  const labelStyle = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header">
          <h1><FileText size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />Assignments</h1>
          <p className="subtitle">Manage course assignments for students</p>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Select Course *</label>
          <select value={selectedAlloc} onChange={e => setSelectedAlloc(e.target.value)} style={{ ...inputStyle, maxWidth: 400 }}>
            <option value="">-- Select --</option>
            {allocations.map(a => <option key={a.id} value={a.id}>{a.courseCode} - {a.courseName}</option>)}
          </select>
        </div>

        {selectedAlloc && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Assignment List</h3>
              <button onClick={openAdd} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}><Plus size={16} /> Create Assignment</button>
            </div>
            
            {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : assignments.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No assignments found.</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>Topic</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Date</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Last Date</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Marks</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Students</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map(a => (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ fontWeight: 500 }}>{a.topic}</div>
                          {a.fileUrl && <a href={a.fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>View Attachment</a>}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>{a.assignmentDate}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>{a.lastSubmissionDate}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>{a.maxMarks}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <span style={{ padding: '4px 8px', borderRadius: 12, background: 'rgba(37,99,235,0.1)', color: 'var(--accent)', fontSize: 11, fontWeight: 'bold' }}>{a.selectedStudents?.length || 0}</span>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                            <button onClick={() => openEdit(a)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}><Edit2 size={15} /></button>
                            <button onClick={() => handleDelete(a.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#ffffff', borderRadius: 12, padding: 24, width: '90%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>{modalMode === 'add' ? 'Create' : 'Edit'} Assignment</h3>
                <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Topic *</label><input value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} style={inputStyle} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                <div><label style={labelStyle}>Assignment Date *</label><input type="date" value={form.assignmentDate} onChange={e => setForm({ ...form, assignmentDate: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Last Date for Submission *</label><input type="date" value={form.lastSubmissionDate} onChange={e => setForm({ ...form, lastSubmissionDate: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Maximum Marks</label><input type="number" value={form.maxMarks} onChange={e => setForm({ ...form, maxMarks: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Attachment URL</label><input value={form.fileUrl} onChange={e => setForm({ ...form, fileUrl: e.target.value })} placeholder="https://..." style={inputStyle} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Add Instruction</label><textarea value={form.instruction} onChange={e => setForm({ ...form, instruction: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
              </div>

              <div style={{ marginTop: 20 }}>
                <label style={labelStyle}>Selected Students ({selectedStudents.length}/{enrolledStudents.length})</label>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: 'var(--background)' }}>
                  {enrolledStudents.length === 0 ? <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No students enrolled.</div> : enrolledStudents.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
                      <input type="checkbox" checked={selectedStudents.includes(s.id)} onChange={() => toggleStudent(s.id)} />
                      <span>{s.registerNo} - {s.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ padding: '8px 20px' }}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
