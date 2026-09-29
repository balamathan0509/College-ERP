import React, { useState, useEffect } from 'react';
import Sidebar from '../../../components/Sidebar';
import { db } from '../../../firebase/config';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { Book, Plus, Edit2, Trash2, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function CourseContents() {
  const { userProfile } = useAuth();
  const [allocations, setAllocations] = useState([]);
  const [selectedAlloc, setSelectedAlloc] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ unit: '1', topic: '', subtopic: '', description: '', plannedHours: '', materialUrl: '' });

  useEffect(() => {
    if (userProfile?.uid) fetchAllocations();
  }, [userProfile]);

  async function fetchAllocations() {
    setLoading(true);
    try {
      const q = query(collection(db, "course_allocations"), where("facultyId", "==", userProfile.uid));
      const snap = await getDocs(q);
      setAllocations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); toast.error("Failed to load courses."); }
    setLoading(false);
  }

  async function fetchPlans(allocId) {
    try {
      const q = query(collection(db, "course_plans"), where("allocationId", "==", allocId));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => Number(a.unit) - Number(b.unit) || a.topic.localeCompare(b.topic));
      setPlans(list);
    } catch (err) { console.error(err); toast.error("Failed to load course plan."); }
  }

  function handleSelectCourse(alloc) {
    setSelectedAlloc(alloc);
    fetchPlans(alloc.id);
  }

  function openAdd() {
    setModalMode('add');
    setEditId(null);
    setForm({ unit: '1', topic: '', subtopic: '', description: '', plannedHours: '', materialUrl: '' });
    setShowModal(true);
  }

  function openEdit(plan) {
    setModalMode('edit');
    setEditId(plan.id);
    setForm({ unit: plan.unit || '1', topic: plan.topic || '', subtopic: plan.subtopic || '', description: plan.description || '', plannedHours: plan.plannedHours || '', materialUrl: plan.materialUrl || '' });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.topic || !form.plannedHours) { toast.error("Topic and Planned Hours are required."); return; }
    setSaving(true);
    try {
      const payload = {
        allocationId: selectedAlloc.id,
        courseCode: selectedAlloc.courseCode,
        facultyId: userProfile.uid,
        unit: form.unit, topic: form.topic, subtopic: form.subtopic, description: form.description,
        plannedHours: Number(form.plannedHours), materialUrl: form.materialUrl,
        status: 'Planned', actualDate: '', deviation: 0, remarks: '',
        updatedAt: serverTimestamp()
      };
      if (modalMode === 'add') {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "course_plans"), payload);
        toast.success("Content added.");
      } else {
        await updateDoc(doc(db, "course_plans", editId), payload);
        toast.success("Content updated.");
      }
      setShowModal(false);
      fetchPlans(selectedAlloc.id);
    } catch (err) { toast.error("Save failed."); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this content?")) return;
    try {
      await deleteDoc(doc(db, "course_plans", id));
      toast.success("Deleted.");
      fetchPlans(selectedAlloc.id);
    } catch (err) { toast.error("Delete failed."); }
  }

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text)', fontSize: 13 };
  const labelStyle = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header">
          <h1><Book size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />Course Contents and Plan</h1>
          <p className="subtitle">Manage syllabus and lecture materials for your courses</p>
        </div>

        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading your courses...</div> : allocations.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>You have not been allocated any courses yet.</div>
        ) : !selectedAlloc ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {allocations.map(a => (
              <div key={a.id} className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => handleSelectCourse(a)}>
                <h3 style={{ margin: '0 0 10px 0', color: 'var(--text)' }}>{a.courseName}</h3>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}><strong>Code:</strong> {a.courseCode}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}><strong>Programme:</strong> {a.programme}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}><strong>Semester:</strong> {a.semester}</div>
                <div style={{ marginTop: 16, textAlign: 'right' }}><button className="btn-primary" style={{ padding: '6px 16px', fontSize: 12 }}>Manage Contents</button></div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0' }}>{selectedAlloc.courseName} ({selectedAlloc.courseCode})</h2>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selectedAlloc.programme} • Semester {selectedAlloc.semester}</div>
              </div>
              <button onClick={() => setSelectedAlloc(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}>Back to Courses</button>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Course Plan</h3>
                <button onClick={openAdd} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}><Plus size={16} /> Add Content</button>
              </div>

              {plans.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No contents added yet.</div> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '10px 8px', textAlign: 'center', width: 60 }}>Unit</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left' }}>Topic / Subtopic</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', width: 100 }}>Planned Hrs</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>Material</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', width: 100 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((p, idx) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold' }}>{p.unit}</td>
                          <td style={{ padding: '10px 8px' }}>
                            <div style={{ fontWeight: 500 }}>{p.topic}</div>
                            {p.subtopic && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.subtopic}</div>}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>{p.plannedHours}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            {p.materialUrl ? <a href={p.materialUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 12 }}>View Link</a> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>-</span>}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button onClick={() => openEdit(p)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}><Edit2 size={15} /></button>
                              <button onClick={() => handleDelete(p.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#ffffff', borderRadius: 12, padding: 24, width: '90%', maxWidth: 500, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>{modalMode === 'add' ? 'Add' : 'Edit'} Content</h3>
                <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                  <div><label style={labelStyle}>Unit *</label><input type="number" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Planned Hours *</label><input type="number" value={form.plannedHours} onChange={e => setForm({ ...form, plannedHours: e.target.value })} style={inputStyle} /></div>
                </div>
                <div><label style={labelStyle}>Topic *</label><input value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Subtopic</label><input value={form.subtopic} onChange={e => setForm({ ...form, subtopic: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                <div><label style={labelStyle}>Material Link (URL)</label><input value={form.materialUrl} onChange={e => setForm({ ...form, materialUrl: e.target.value })} placeholder="https://..." style={inputStyle} /></div>
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
