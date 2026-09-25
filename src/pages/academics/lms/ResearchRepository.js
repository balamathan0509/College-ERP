import React, { useState, useEffect } from 'react';
import Sidebar from '../../../components/Sidebar';
import { db } from '../../../firebase/config';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { BookOpen, Plus, Edit2, Trash2, X, Download } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const TABS = [
  { id: 'basic', label: 'Basic Information' },
  { id: 'seed', label: 'Seed Money' },
  { id: 'award', label: 'Research Award' },
  { id: 'grant', label: 'Research Grant' },
  { id: 'publications', label: 'Research Publications' },
  { id: 'books', label: 'Book Publications' },
  { id: 'conference', label: 'Conference-Proceedings' },
  { id: 'consultancy', label: 'Consultancy Projects' },
  { id: 'patent', label: 'Patent Details' },
  { id: 'chapter', label: 'Book Chapter' }
];

export default function ResearchRepository() {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('publications');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ title: '', year: '', details: '', link: '' });

  useEffect(() => {
    if (userProfile?.uid) fetchRecords();
  }, [userProfile, activeTab]);

  async function fetchRecords() {
    setLoading(true);
    try {
      const q = query(collection(db, "research_repository"), where("facultyId", "==", userProfile.uid), where("tab", "==", activeTab));
      const snap = await getDocs(q);
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { toast.error("Failed to load records."); }
    setLoading(false);
  }

  function openAdd() {
    setModalMode('add'); setEditId(null);
    setForm({ title: '', year: new Date().getFullYear().toString(), details: '', link: '' });
    setShowModal(true);
  }

  function openEdit(rec) {
    setModalMode('edit'); setEditId(rec.id);
    setForm({ title: rec.title || '', year: rec.year || '', details: rec.details || '', link: rec.link || '' });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title) { toast.error("Title is required."); return; }
    setSaving(true);
    try {
      const payload = { ...form, tab: activeTab, facultyId: userProfile.uid, updatedAt: serverTimestamp() };
      if (modalMode === 'add') {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "research_repository"), payload);
        toast.success("Record added.");
      } else {
        await updateDoc(doc(db, "research_repository", editId), payload);
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
      await deleteDoc(doc(db, "research_repository", id));
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
          <h1><BookOpen size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />Research Repository</h1>
          <p className="subtitle">Manage your research, publications, and grants</p>
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
                    <th style={{ padding: '10px 8px', textAlign: 'left' }}>Title</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', width: 80 }}>Year</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left' }}>Details</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', width: 100 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, idx) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 8px' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 500 }}>
                        {r.title}
                        {r.link && <div style={{ marginTop: 4 }}><a href={r.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>View Link</a></div>}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>{r.year}</td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>{r.details || '-'}</td>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>Title / Name *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Year</label><input value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} style={inputStyle} /></div>
                </div>
                <div><label style={labelStyle}>Additional Details (Journal, Amount, Authors, etc.)</label><textarea value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                <div><label style={labelStyle}>External Link (DOI, URL)</label><input value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="https://..." style={inputStyle} /></div>
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
