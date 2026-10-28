import React, { useState, useEffect } from 'react';
import Sidebar from '../../../components/Sidebar';
import { db } from "../../../supabase/supabaseAdapter";
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, where, serverTimestamp } from "../../../supabase/supabaseAdapter";
import { useAuth } from '../../../context/AuthContext';
import { Book, Plus, Edit2, Trash2, X, ListPlus, Layers, CheckCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function CourseContents() {
  const { userProfile } = useAuth();
  const [allocations, setAllocations] = useState([]);
  const [selectedAlloc, setSelectedAlloc] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Active Unit Tab ('1', '2', '3', '4', '5' or 'all')
  const [activeUnitTab, setActiveUnitTab] = useState('1');

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('bulk_add'); // 'bulk_add' or 'edit'
  const [editId, setEditId] = useState(null);
  
  // Selected Unit inside modal for adding topics
  const [modalUnit, setModalUnit] = useState('1');

  // Rows for Bulk Add
  const [bulkRows, setBulkRows] = useState([
    { topic: '', subtopic: '', plannedHours: '1', materialUrl: '' },
    { topic: '', subtopic: '', plannedHours: '1', materialUrl: '' },
    { topic: '', subtopic: '', plannedHours: '1', materialUrl: '' }
  ]);

  // Single edit form
  const [editForm, setEditForm] = useState({ unit: '1', topic: '', subtopic: '', description: '', plannedHours: '1', materialUrl: '' });

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
      list.sort((a, b) => Number(a.unit) - Number(b.unit) || (a.topic || "").localeCompare(b.topic || ""));
      setPlans(list);
    } catch (err) { console.error(err); toast.error("Failed to load course plan."); }
  }

  function handleSelectCourse(alloc) {
    setSelectedAlloc(alloc);
    setActiveUnitTab('1');
    fetchPlans(alloc.id);
  }

  function openBulkAdd(unitNumber) {
    const targetUnit = unitNumber || (activeUnitTab !== 'all' ? activeUnitTab : '1');
    setModalMode('bulk_add');
    setEditId(null);
    setModalUnit(targetUnit);
    setBulkRows([
      { topic: '', subtopic: '', plannedHours: '1', materialUrl: '' },
      { topic: '', subtopic: '', plannedHours: '1', materialUrl: '' },
      { topic: '', subtopic: '', plannedHours: '1', materialUrl: '' }
    ]);
    setShowModal(true);
  }

  function openEdit(plan) {
    setModalMode('edit');
    setEditId(plan.id);
    setEditForm({
      unit: plan.unit || '1',
      topic: plan.topic || '',
      subtopic: plan.subtopic || '',
      description: plan.description || '',
      plannedHours: String(plan.plannedHours || '1'),
      materialUrl: plan.materialUrl || ''
    });
    setShowModal(true);
  }

  function handleAddBulkRow() {
    setBulkRows(prev => [...prev, { topic: '', subtopic: '', plannedHours: '1', materialUrl: '' }]);
  }

  function handleRemoveBulkRow(idx) {
    setBulkRows(prev => prev.filter((_, i) => i !== idx));
  }

  function handleBulkRowChange(idx, field, val) {
    setBulkRows(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  }

  async function handleSaveBulk() {
    const validRows = bulkRows.filter(r => r.topic && r.topic.trim().length > 0);
    if (validRows.length === 0) {
      toast.error("Please enter at least one topic name.");
      return;
    }

    setSaving(true);
    try {
      let count = 0;
      for (const row of validRows) {
        const payload = {
          allocationId: selectedAlloc.id,
          courseCode: selectedAlloc.courseCode,
          facultyId: userProfile.uid,
          unit: String(modalUnit),
          topic: row.topic.trim(),
          subtopic: row.subtopic ? row.subtopic.trim() : '',
          description: '',
          plannedHours: Number(row.plannedHours) || 1,
          materialUrl: row.materialUrl ? row.materialUrl.trim() : '',
          status: 'Planned',
          actualDate: '',
          deviation: 0,
          remarks: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        await addDoc(collection(db, "course_plans"), payload);
        count++;
      }

      toast.success(`Successfully added ${count} topics for Unit ${modalUnit}!`);
      setShowModal(false);
      // Switch active tab to the unit where topics were just added
      setActiveUnitTab(String(modalUnit));
      fetchPlans(selectedAlloc.id);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save topics.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!editForm.topic.trim() || !editForm.plannedHours) {
      toast.error("Topic and Planned Hours are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        unit: String(editForm.unit),
        topic: editForm.topic.trim(),
        subtopic: editForm.subtopic ? editForm.subtopic.trim() : '',
        description: editForm.description || '',
        plannedHours: Number(editForm.plannedHours) || 1,
        materialUrl: editForm.materialUrl ? editForm.materialUrl.trim() : '',
        updatedAt: serverTimestamp()
      };
      await updateDoc(doc(db, "course_plans", editId), payload);
      toast.success("Topic updated.");
      setShowModal(false);
      fetchPlans(selectedAlloc.id);
    } catch (err) {
      console.error(err);
      toast.error("Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this topic from course plan?")) return;
    try {
      await deleteDoc(doc(db, "course_plans", id));
      toast.success("Deleted.");
      fetchPlans(selectedAlloc.id);
    } catch (err) {
      console.error(err);
      toast.error("Delete failed.");
    }
  }

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: 13, outline: 'none' };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' };

  // Calculate total hours
  const totalPlannedHrs = plans.reduce((acc, p) => acc + (Number(p.plannedHours) || 0), 0);
  const bulkTotalHrs = bulkRows.reduce((acc, r) => acc + (Number(r.plannedHours) || 0), 0);

  // Filter plans based on the active unit tab
  const displayedPlans = activeUnitTab === 'all' 
    ? plans 
    : plans.filter(p => String(p.unit).trim() === String(activeUnitTab).trim());

  // Hours for the currently active tab
  const currentTabHours = displayedPlans.reduce((acc, p) => acc + (Number(p.plannedHours) || 0), 0);

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content" style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px 32px" }}>
        <Toaster position="top-right" />

        <div className="page-header" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff"
            }}>
              <Book size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0f172a' }}>Course Contents and Plan</h1>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                Unit-wise lecture topic management and planned hours tracking
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#64748b', fontSize: 14 }}>Loading your courses...</div>
        ) : allocations.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: '#64748b', background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            You have not been allocated any courses yet.
          </div>
        ) : !selectedAlloc ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {allocations.map(a => (
              <div 
                key={a.id} 
                className="card" 
                style={{ 
                  cursor: 'pointer', 
                  transition: 'all 0.2s', 
                  background: '#ffffff', 
                  borderRadius: 12, 
                  padding: 22, 
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)' 
                }} 
                onClick={() => handleSelectCourse(a)}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <span style={{ background: '#e0e7ff', color: '#4338ca', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>
                    {a.courseCode}
                  </span>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Sem {a.semester}</span>
                </div>
                <h3 style={{ margin: '0 0 10px 0', color: '#0f172a', fontSize: 16, fontWeight: 700 }}>{a.courseName}</h3>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
                  <strong>Programme:</strong> {a.programme}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button className="btn-primary" style={{ padding: '7px 16px', fontSize: 12, borderRadius: 6 }}>
                    Manage Syllabus Topics →
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Selected Course Header Banner */}
            <div style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: '16px 22px',
              marginBottom: 20,
              border: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                    {selectedAlloc.courseName} ({selectedAlloc.courseCode})
                  </h2>
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  {selectedAlloc.programme} • Semester {selectedAlloc.semester} • <strong>Total: {totalPlannedHrs} Hours</strong> across {plans.length} Topics
                </div>
              </div>
              <button 
                onClick={() => setSelectedAlloc(null)} 
                style={{ 
                  padding: '8px 16px', 
                  borderRadius: 8, 
                  border: '1px solid #cbd5e1', 
                  background: '#ffffff', 
                  color: '#334155', 
                  cursor: 'pointer', 
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                ← Back to Courses
              </button>
            </div>

            {/* Course Plan Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: 14,
              padding: 24,
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
            }}>
              {/* Unit Tabs Navigation */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: 16,
                flexWrap: 'wrap',
                gap: 14
              }}>
                {/* Tabs for Unit 1 to 5 + All */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['1', '2', '3', '4', '5'].map(u => {
                    const uPlans = plans.filter(p => String(p.unit).trim() === u);
                    const isActive = activeUnitTab === u;
                    return (
                      <button
                        key={u}
                        onClick={() => setActiveUnitTab(u)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 8,
                          border: isActive ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                          background: isActive ? '#eff6ff' : '#ffffff',
                          color: isActive ? '#4338ca' : '#475569',
                          fontWeight: isActive ? 700 : 600,
                          fontSize: 13,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>Unit {u}</span>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 10,
                          background: isActive ? '#4f46e5' : '#f1f5f9',
                          color: isActive ? '#ffffff' : '#64748b'
                        }}>
                          {uPlans.length}
                        </span>
                      </button>
                    );
                  })}

                  {/* All Units Tab */}
                  <button
                    onClick={() => setActiveUnitTab('all')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: activeUnitTab === 'all' ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                      background: activeUnitTab === 'all' ? '#eff6ff' : '#ffffff',
                      color: activeUnitTab === 'all' ? '#4338ca' : '#475569',
                      fontWeight: activeUnitTab === 'all' ? 700 : 600,
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >
                    All Units ({plans.length})
                  </button>
                </div>

                {/* Add Topics Button */}
                <button 
                  onClick={() => openBulkAdd(activeUnitTab !== 'all' ? activeUnitTab : '1')} 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 18px',
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)'
                  }}
                >
                  <ListPlus size={16} /> 
                  + Add Topics {activeUnitTab !== 'all' ? `for Unit ${activeUnitTab}` : ''}
                </button>
              </div>

              {/* Sub-header showing active unit summary */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                    {activeUnitTab === 'all' ? 'All Units Syllabus' : `Unit ${activeUnitTab} Topics`}
                  </h3>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    Showing {displayedPlans.length} topic{displayedPlans.length === 1 ? '' : 's'} • Total Planned: <strong>{currentTabHours} Hours</strong>
                  </span>
                </div>
              </div>

              {displayedPlans.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                  <Layers size={36} color="#cbd5e1" style={{ marginBottom: 10 }} />
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>
                    No topics added yet {activeUnitTab !== 'all' ? `for Unit ${activeUnitTab}` : ''}
                  </div>
                  <p style={{ fontSize: 13, margin: '6px 0 16px', color: '#64748b' }}>
                    Click below to add lecture topics and planned hours for {activeUnitTab !== 'all' ? `Unit ${activeUnitTab}` : 'this course'}.
                  </p>
                  <button 
                    onClick={() => openBulkAdd(activeUnitTab !== 'all' ? activeUnitTab : '1')} 
                    className="btn-primary" 
                    style={{ padding: '8px 18px', fontSize: 13 }}
                  >
                    + Add Topics for {activeUnitTab !== 'all' ? `Unit ${activeUnitTab}` : 'Unit 1'}
                  </button>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#334155' }}>
                        <th style={{ padding: '12px 14px', textAlign: 'center', width: 90, fontWeight: 700 }}>Unit</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700 }}>Topic / Subtopic</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', width: 120, fontWeight: 700 }}>Planned Hrs</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', width: 140, fontWeight: 700 }}>Material</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center', width: 90, fontWeight: 700 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedPlans.map((p, idx) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafbfd' }}>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span style={{
                              background: '#eff6ff',
                              color: '#3b82f6',
                              padding: '3px 10px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700
                            }}>
                              Unit {p.unit}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.topic}</div>
                            {p.subtopic && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{p.subtopic}</div>}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, color: '#1e293b' }}>{p.plannedHours} hr{Number(p.plannedHours) > 1 ? 's' : ''}</span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            {p.materialUrl ? (
                              <a href={p.materialUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'underline', fontSize: 12, fontWeight: 600 }}>
                                View Material
                              </a>
                            ) : (
                              <span style={{ color: '#cbd5e1', fontSize: 13 }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <button 
                                onClick={() => openEdit(p)} 
                                style={{ background: '#f1f5f9', border: 'none', borderRadius: 4, padding: 6, color: '#4f46e5', cursor: 'pointer' }}
                                title="Edit Topic"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDelete(p.id)} 
                                style={{ background: '#fee2e2', border: 'none', borderRadius: 4, padding: 6, color: '#dc2626', cursor: 'pointer' }}
                                title="Delete Topic"
                              >
                                <Trash2 size={14} />
                              </button>
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

        {/* MODAL: BULK ADD / EDIT TOPICS MODAL */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#ffffff', borderRadius: 14, width: '100%', maxWidth: 740, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', border: '1px solid #e2e8f0' }}>
              
              {/* Modal Header */}
              <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                    {modalMode === 'edit' ? 'Edit Topic' : `Add Topics for Unit ${modalUnit}`}
                  </h3>
                  <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: 12 }}>
                    {modalMode === 'edit' ? 'Update single topic details' : 'Enter all topics for this unit at once'}
                  </p>
                </div>
                <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}>
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                {modalMode === 'edit' ? (
                  /* Single Edit Mode */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Unit *</label>
                        <select 
                          value={editForm.unit} 
                          onChange={e => setEditForm({ ...editForm, unit: e.target.value })} 
                          style={inputStyle}
                        >
                          {[1, 2, 3, 4, 5].map(u => (
                            <option key={u} value={u}>Unit {u}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Planned Hours *</label>
                        <input type="number" min="1" value={editForm.plannedHours} onChange={e => setEditForm({ ...editForm, plannedHours: e.target.value })} style={inputStyle} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Topic Name *</label>
                      <input value={editForm.topic} onChange={e => setEditForm({ ...editForm, topic: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Subtopic (Optional)</label>
                      <input value={editForm.subtopic} onChange={e => setEditForm({ ...editForm, subtopic: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Material Link (URL)</label>
                      <input value={editForm.materialUrl} onChange={e => setEditForm({ ...editForm, materialUrl: e.target.value })} placeholder="https://..." style={inputStyle} />
                    </div>
                  </div>
                ) : (
                  /* Bulk Add Mode */
                  <div>
                    {/* Unit Selector Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Selected Unit:</span>
                        <select
                          value={modalUnit}
                          onChange={e => setModalUnit(e.target.value)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 6,
                            border: '2px solid #4f46e5',
                            fontWeight: 700,
                            color: '#4f46e5',
                            background: '#eff6ff',
                            fontSize: 13,
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          {[1, 2, 3, 4, 5].map(u => (
                            <option key={u} value={u}>UNIT - {u}</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5' }}>
                        Total Planned: {bulkTotalHrs} Hours
                      </div>
                    </div>

                    {/* Bulk Rows List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {bulkRows.map((row, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#f8fafc', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', width: 22, textAlign: 'center' }}>
                            {idx + 1}
                          </span>

                          {/* Topic Name */}
                          <input
                            type="text"
                            placeholder="Topic Name (e.g. Remote Sensing in Smart Farming)"
                            value={row.topic}
                            onChange={e => handleBulkRowChange(idx, 'topic', e.target.value)}
                            style={{ flex: 2, padding: '7px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid #cbd5e1', background: '#ffffff', outline: 'none' }}
                          />

                          {/* Subtopic */}
                          <input
                            type="text"
                            placeholder="Subtopic (optional)"
                            value={row.subtopic}
                            onChange={e => handleBulkRowChange(idx, 'subtopic', e.target.value)}
                            style={{ flex: 1.2, padding: '7px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid #cbd5e1', background: '#ffffff', outline: 'none' }}
                          />

                          {/* Planned Hours */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="number"
                              min="1"
                              placeholder="Hrs"
                              title="Planned Hours"
                              value={row.plannedHours}
                              onChange={e => handleBulkRowChange(idx, 'plannedHours', e.target.value)}
                              style={{ width: 55, padding: '7px 6px', fontSize: 12.5, textAlign: 'center', fontWeight: 700, borderRadius: 6, border: '1px solid #cbd5e1', background: '#ffffff', outline: 'none' }}
                            />
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>hr</span>
                          </div>

                          {/* Delete Row */}
                          <button
                            type="button"
                            onClick={() => handleRemoveBulkRow(idx)}
                            disabled={bulkRows.length <= 1}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: bulkRows.length <= 1 ? '#cbd5e1' : '#dc2626',
                              cursor: bulkRows.length <= 1 ? 'not-allowed' : 'pointer',
                              padding: 4
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add Row Button */}
                    <div style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={handleAddBulkRow}
                        style={{
                          background: '#ffffff',
                          border: '1px dashed #4f46e5',
                          color: '#4f46e5',
                          borderRadius: 6,
                          padding: '7px 16px',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <Plus size={14} /> + Add Another Topic Row
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  {modalMode !== 'edit' && `${bulkRows.filter(r => r.topic.trim()).length} topic(s) ready for Unit ${modalUnit}`}
                </span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setShowModal(false)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      background: 'transparent',
                      color: '#475569',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={modalMode === 'edit' ? handleSaveEdit : handleSaveBulk}
                    disabled={saving}
                    style={{
                      padding: '8px 24px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                      color: '#ffffff',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)'
                    }}
                  >
                    {saving ? 'Saving Topics...' : modalMode === 'edit' ? 'Update Topic' : `Save All Unit ${modalUnit} Topics`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
