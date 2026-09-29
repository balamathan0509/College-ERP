import React, { useState, useEffect } from 'react';
import Sidebar from '../../../components/Sidebar';
import { db } from '../../../firebase/config';
import { collection, query, getDocs, updateDoc, doc, where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { CheckSquare, Edit2, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function CoursePlanCompletion() {
  const { userProfile } = useAuth();
  const [allocations, setAllocations] = useState([]);
  const [selectedAlloc, setSelectedAlloc] = useState('');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [form, setForm] = useState({ actualDate: '', status: 'Planned', remarks: '' });

  useEffect(() => {
    if (userProfile?.uid) fetchAllocations();
  }, [userProfile]);

  async function fetchAllocations() {
    try {
      const q = query(collection(db, "course_allocations"), where("facultyId", "==", userProfile.uid));
      const snap = await getDocs(q);
      setAllocations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); toast.error("Failed to load courses."); }
  }

  useEffect(() => {
    if (selectedAlloc) fetchPlans(selectedAlloc);
  }, [selectedAlloc]);

  async function fetchPlans(allocId) {
    setLoading(true);
    try {
      const q = query(collection(db, "course_plans"), where("allocationId", "==", allocId));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => Number(a.unit) - Number(b.unit) || a.topic.localeCompare(b.topic));
      setPlans(list);
    } catch (err) { console.error(err); toast.error("Failed to load plans."); }
    setLoading(false);
  }

  function openEdit(plan) {
    setEditPlan(plan);
    setForm({ actualDate: plan.actualDate || '', status: plan.status || 'Planned', remarks: plan.remarks || '' });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.status) { toast.error("Status is required."); return; }
    setSaving(true);
    try {
      let deviation = 0;
      // In a real scenario with plannedDate vs actualDate, deviation = (actualDate - plannedDate) in days.
      // Since plannedDate wasn't explicitly captured in contents yet (using just plannedHours), 
      // deviation here can be manually logged or derived if plannedDate was added. For now, 0 or manual.
      
      await updateDoc(doc(db, "course_plans", editPlan.id), {
        actualDate: form.actualDate,
        status: form.status,
        remarks: form.remarks,
        updatedAt: serverTimestamp()
      });
      toast.success("Completion updated.");
      setShowModal(false);
      fetchPlans(selectedAlloc);
    } catch (err) { toast.error("Save failed."); }
    setSaving(false);
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return 'var(--success)';
      case 'In Progress': return 'var(--warning)';
      case 'Delayed': return 'var(--danger)';
      default: return 'var(--text-muted)';
    }
  };

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text)', fontSize: 13 };
  const labelStyle = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header">
          <h1><CheckSquare size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />Course Plan Completion</h1>
          <p className="subtitle">Update completion status of your course topics</p>
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
            {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : plans.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No topics found. Add topics in Course Contents first.</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 8px', textAlign: 'left', width: 50 }}>Unit</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>Topic</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', width: 90 }}>Hrs</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Actual Date</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>Remarks</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', width: 80 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 'bold' }}>{p.unit}</td>
                        <td style={{ padding: '10px 8px' }}>{p.topic}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>{p.plannedHours}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>{p.actualDate || '-'}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: `${getStatusColor(p.status)}22`, color: getStatusColor(p.status) }}>
                            {p.status || 'Planned'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>{p.remarks || '-'}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <button onClick={() => openEdit(p)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}><Edit2 size={15} /></button>
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
            <div style={{ background: '#ffffff', borderRadius: 12, padding: 24, width: '90%', maxWidth: 400, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>Update Status</h3>
                <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ marginBottom: 16 }}>
                <strong>Topic:</strong> {editPlan.topic}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div><label style={labelStyle}>Status *</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                    <option value="Planned">Planned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Delayed">Delayed</option>
                  </select>
                </div>
                <div><label style={labelStyle}>Actual Completion Date</label><input type="date" value={form.actualDate} onChange={e => setForm({ ...form, actualDate: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Remarks</label><textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
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
