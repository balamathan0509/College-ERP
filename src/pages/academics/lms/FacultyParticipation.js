import React, { useState, useEffect } from 'react';
import Sidebar from '../../../components/Sidebar';
import { db } from '../../../firebase/config';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { Award, Plus, Edit2, Trash2, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const TABS = [
  { id: 'fdp', label: 'FDP/STTP' },
  { id: 'seminar', label: 'Seminar/Conference/Workshop' },
  { id: 'professional', label: 'Professional Programmes' },
  { id: 'resource', label: 'Resource Person' },
  { id: 'moocs', label: 'MOOCs Certification' },
  { id: 'membership', label: 'Membership' },
  { id: 'activities', label: 'Activities' }
];

export default function FacultyParticipation() {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('fdp');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [editId, setEditId] = useState(null);
  
  const [form, setForm] = useState({ title: '', year: new Date().getFullYear().toString(), fromDate: '', toDate: '', organizedBy: '', support: '' });

  useEffect(() => {
    if (userProfile?.uid) fetchRecords();
  }, [userProfile, activeTab]);

  async function fetchRecords() {
    setLoading(true);
    try {
      const q = query(collection(db, "faculty_participation"), where("facultyId", "==", userProfile.uid), where("tab", "==", activeTab));
      const snap = await getDocs(q);
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { toast.error("Failed to load records."); }
    setLoading(false);
  }

  function openAdd() {
    setModalMode('add'); setEditId(null);
    setForm({ title: '', year: new Date().getFullYear().toString(), fromDate: '', toDate: '', organizedBy: '', support: '' });
    setShowModal(true);
  }

  function openEdit(rec) {
    setModalMode('edit'); setEditId(rec.id);
    setForm({ title: rec.title || '', year: rec.year || '', fromDate: rec.fromDate || '', toDate: rec.toDate || '', organizedBy: rec.organizedBy || '', support: rec.support || '' });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title) { toast.error("Title is required."); return; }
    setSaving(true);
    try {
      const payload = { ...form, tab: activeTab, facultyId: userProfile.uid, updatedAt: serverTimestamp() };
      if (modalMode === 'add') {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "faculty_participation"), payload);
        toast.success("Record added.");
      } else {
        await updateDoc(doc(db, "faculty_participation", editId), payload);
        toast.success("Record updated.");
      }
      setShowModal(false);
      fetchRecords();
    } catch (err) { toast.error("Save failed."); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this record?")) return;
    try {
      await deleteDoc(doc(db, "faculty_participation", id));
      toast.success("Deleted.");
      fetchRecords();
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
          <h1><Award size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />Faculty Participation</h1>
          <p className="subtitle">Manage your external participation, conferences, and certifications</p>
        </div>

        <div className="card" style={{ padding: '0 20px', marginBottom: 20, display: 'flex', overflowX: 'auto', gap: 24, borderBottom: '1px solid var(--border)', borderRadius: '12px 12px 0 0' }}>
          {TABS.map(tab => (
            <div 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)}
              style={{ padding: '16px 0', cursor: 'pointer', fontWeight: 500, fontSize: 14, color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)', borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent', whiteSpace: 'nowrap' }}
            >
              {tab.label}
            </div>
          ))}
        </div>

        <div className="card" style={{ borderRadius: '0 0 12px 12px', borderTop: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>{TABS.find(t => t.id === activeTab)?.label} Records</h3>
            <button onClick={openAdd} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}><Plus size={16} /> Add Record</button>
          </div>

          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : records.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No records found in this category.</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'left', width: 60 }}>S.No</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left' }}>Title / Name</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>Dates</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left' }}>Details</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', width: 100 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, idx) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 8px' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 500 }}>{r.title}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        {r.fromDate ? `${r.fromDate} ${r.toDate ? 'to ' + r.toDate : ''}` : '-'}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        {r.organizedBy && <div style={{ fontSize: 12 }}><strong>Org:</strong> {r.organizedBy}</div>}
                        {r.support && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}><strong>Support:</strong> {r.support}</div>}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <button onClick={() => openEdit(r)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}><Edit2 size={15} /></button>
                          <button onClick={() => handleDelete(r.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#ffffff', borderRadius: 12, padding: 24, width: '90%', maxWidth: 500, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>{modalMode === 'add' ? 'Add' : 'Edit'} Record</h3>
                <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Title / Name *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Year</label><input value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>From Date</label><input type="date" value={form.fromDate} onChange={e => setForm({ ...form, fromDate: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>To Date</label><input type="date" value={form.toDate} onChange={e => setForm({ ...form, toDate: e.target.value })} style={inputStyle} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Organized By (Institution / Body)</label><input value={form.organizedBy} onChange={e => setForm({ ...form, organizedBy: e.target.value })} style={inputStyle} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Financial Support from Management</label><input value={form.support} onChange={e => setForm({ ...form, support: e.target.value })} style={inputStyle} /></div>
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
