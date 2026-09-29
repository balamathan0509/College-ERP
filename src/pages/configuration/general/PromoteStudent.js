import Sidebar from '../../../components/Sidebar';
import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/config';
import { collection, getDocs, updateDoc, doc, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { ArrowRight, CheckSquare } from 'lucide-react';
import FilterCard from '../../../components/common/FilterCard';

export default function PromoteStudent() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  const [filter, setFilter] = useState({ programmeCode: '', currentSemester: '', currentBatch: '' });
  const [target, setTarget] = useState({ targetSemester: '', targetBatch: '' });

  const fetchEligibleStudents = async () => {
    if (!filter.programmeCode || !filter.currentSemester || !filter.currentBatch) {
      toast.error('Please fill all current information filters'); return;
    }
    try {
      setLoading(true);
      const q = query(collection(db, 'students'), where('programmeCode', '==', filter.programmeCode), where('semester', '==', filter.currentSemester), where('batch', '==', filter.currentBatch), where('status', '==', 'Active'));
      const snap = await getDocs(q);
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setSelectedIds(new Set());
    } catch (err) {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handlePromote = async () => {
    if (selectedIds.size === 0) { toast.error('No students selected'); return; }
    if (!target.targetSemester || !target.targetBatch) { toast.error('Please fill target semester and batch'); return; }
    if (window.confirm(`Promote ${selectedIds.size} students to Semester ${target.targetSemester}?`)) {
      setLoading(true);
      let success = 0;
      for (const id of selectedIds) {
        try {
          await updateDoc(doc(db, 'students', id), {
            semester: target.targetSemester,
            batch: target.targetBatch,
            updatedAt: serverTimestamp()
          });
          await addDoc(collection(db, 'promotionHistory'), {
            studentId: id,
            fromSemester: filter.currentSemester,
            toSemester: target.targetSemester,
            fromBatch: filter.currentBatch,
            toBatch: target.targetBatch,
            promotedAt: serverTimestamp()
          });
          success++;
        } catch (err) { console.error('Failed for student', id); }
      }
      toast.success(`Successfully promoted ${success} students`);
      fetchEligibleStudents();
    }
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-container" style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh' }}>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 5px 0' }}>Promote Students</h2>
        <div style={{ color: '#64748b', fontSize: '13px' }}>Configuration / General Configuration / Promote Student</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', borderTop: '4px solid #3b82f6', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 15px 0' }}>Current Academic Info</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div><label>Programme Code</label><input type="text" value={filter.programmeCode} onChange={e => setFilter({...filter, programmeCode: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} placeholder="e.g. 104 BE CSE" /></div>
            <div><label>Current Semester</label><input type="text" value={filter.currentSemester} onChange={e => setFilter({...filter, currentSemester: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
            <div><label>Current Batch</label><input type="text" value={filter.currentBatch} onChange={e => setFilter({...filter, currentBatch: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
            <button onClick={fetchEligibleStudents} style={{ padding: '10px', background: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }}>Load Eligible Students</button>
          </div>
        </div>
        
        <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', borderTop: '4px solid #10b981', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 15px 0' }}>Target Promotion Info</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div><label>Target Semester</label><input type="text" value={target.targetSemester} onChange={e => setTarget({...target, targetSemester: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
            <div><label>Target Batch</label><input type="text" value={target.targetBatch} onChange={e => setTarget({...target, targetBatch: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
            <button onClick={handlePromote} disabled={loading || selectedIds.size === 0} style={{ padding: '10px', background: selectedIds.size === 0 ? '#94a3b8' : '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              Promote Selected ({selectedIds.size}) <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>Eligible Students</h3>
          <button onClick={() => setSelectedIds(new Set(selectedIds.size === students.length ? [] : students.map(s => s.id)))} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: '500' }}>
            <CheckSquare size={16} /> {selectedIds.size === students.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        
        {loading ? <p>Loading...</p> : students.length === 0 ? <p style={{ color: '#64748b' }}>No students found for the selected criteria.</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
            {students.map(s => (
              <div key={s.id} onClick={() => toggleSelect(s.id)} style={{ padding: '12px', border: `2px solid ${selectedIds.has(s.id) ? '#3b82f6' : '#e2e8f0'}`, borderRadius: '6px', cursor: 'pointer', background: selectedIds.has(s.id) ? '#eff6ff' : '#fff' }}>
                <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{s.registerNumber}</div>
                <div style={{ color: '#475569', fontSize: '14px' }}>{s.studentName}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
      </main>
    </div>
  );
}