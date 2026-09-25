import React, { useState, useEffect } from 'react';
import Sidebar from '../../../components/Sidebar';
import { db } from '../../../firebase/config';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { Calendar, Plus, Edit2, Trash2, X, Download } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function AcademicActivities() {
  const { userProfile } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [editId, setEditId] = useState(null);

  const [form, setForm] = useState({
    title: '', year: new Date().getFullYear().toString(), department: userProfile?.dept || '', type: 'Workshop',
    fromDate: '', toDate: '', resourcePerson: '', participants: ''
  });

  useEffect(() => {
    if (userProfile?.uid) fetchActivities();
  }, [userProfile]);

  async function fetchActivities() {
    setLoading(true);
    try {
      const q = query(collection(db, "academic_activities"), where("facultyId", "==", userProfile.uid));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.fromDate || 0) - new Date(a.fromDate || 0));
      setActivities(list);
    } catch (err) { toast.error("Failed to load activities."); }
    setLoading(false);
  }

  function openAdd() {
    setModalMode('add'); setEditId(null);
    setForm({ title: '', year: new Date().getFullYear().toString(), department: userProfile?.dept || '', type: 'Workshop', fromDate: '', toDate: '', resourcePerson: '', participants: '' });
    setShowModal(true);
  }

  function openEdit(act) {
    setModalMode('edit'); setEditId(act.id);
    setForm({ title: act.title || '', year: act.year || '', department: act.department || '', type: act.type || 'Workshop', fromDate: act.fromDate || '', toDate: act.toDate || '', resourcePerson: act.resourcePerson || '', participants: act.participants || '' });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title || !form.fromDate || !form.toDate) { toast.error("Title, From Date and To Date are required."); return; }
    setSaving(true);
    try {
      const payload = { ...form, facultyId: userProfile.uid, updatedAt: serverTimestamp() };
      if (modalMode === 'add') {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "academic_activities"), payload);
        toast.success("Activity added.");
      } else {
        await updateDoc(doc(db, "academic_activities", editId), payload);
        toast.success("Activity updated.");
      }
      setShowModal(false);
      fetchActivities();
    } catch (err) { toast.error("Save failed."); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this activity?")) return;
    try {
      await deleteDoc(doc(db, "academic_activities", id));
      toast.success("Deleted.");
      fetchActivities();
    } catch (err) { toast.error("Delete failed."); }
  }

  function handleExport() {
    const data = activities.map((a, i) => ({
      'S.No': i + 1, 'Programme Title': a.title, 'Year': a.year, 'Department': a.department, 'Type': a.type,
      'From Date': a.fromDate, 'To Date': a.toDate, 'Resource Person': a.resourcePerson, 'Participants': a.participants
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Activities");
    XLSX.writeFile(wb, "Academic_Activities.xlsx");
  }

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text)', fontSize: 13 };
  const labelStyle = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header">
          <h1><Calendar size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />Academic Activities</h1>
          <p className="subtitle">Manage workshops, seminars, and events</p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ margin: 0 }}>My Activities</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleExport} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <Download size={14} /> Export
              </button>
              <button onClick={openAdd} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}><Plus size={16} /> Add Activity</button>
            </div>
          </div>

          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : activities.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No activities found.</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'left' }}>S.No</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left' }}>Programme Title</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left' }}>Type & Dept</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>Dates</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left' }}>Resource Person</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((a, idx) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 8px' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 500 }}>{a.title}</td>
                      <td style={{ padding: '10px 8px' }}>{a.type}<br/><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.department}</span></td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>{a.fromDate} to {a.toDate}</td>
                      <td style={{ padding: '10px 8px' }}>{a.resourcePerson}</td>
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

        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#ffffff', borderRadius: 12, padding: 24, width: '90%', maxWidth: 500, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>{modalMode === 'add' ? 'Add' : 'Edit'} Activity</h3>
                <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Programme Title *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Year</label><input value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Department</label><input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} style={inputStyle} /></div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Programme Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                    <option value="Workshop">Workshop</option>
                    <option value="Seminar">Seminar</option>
                    <option value="Guest Lecture">Guest Lecture</option>
                    <option value="Training">Training</option>
                  </select>
                </div>
                <div><label style={labelStyle}>From Date *</label><input type="date" value={form.fromDate} onChange={e => setForm({ ...form, fromDate: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>To Date *</label><input type="date" value={form.toDate} onChange={e => setForm({ ...form, toDate: e.target.value })} style={inputStyle} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Resource Person</label><input value={form.resourcePerson} onChange={e => setForm({ ...form, resourcePerson: e.target.value })} style={inputStyle} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>No. of Participants</label><input type="number" value={form.participants} onChange={e => setForm({ ...form, participants: e.target.value })} style={inputStyle} /></div>
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
