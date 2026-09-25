import Sidebar from '../../../components/Sidebar';
import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/config';
import { collection, getDocs, updateDoc, doc, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { GraduationCap, CheckSquare } from 'lucide-react';

export default function PassOutStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filter, setFilter] = useState({ programmeCode: '', batch: '' });

  const fetchEligibleStudents = async () => {
    if (!filter.programmeCode || !filter.batch) { toast.error('Fill both filters'); return; }
    try {
      setLoading(true);
      const q = query(collection(db, 'students'), where('programmeCode', '==', filter.programmeCode), where('batch', '==', filter.batch), where('status', '==', 'Active'));
      const snap = await getDocs(q);
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setSelectedIds(new Set());
    } catch (err) { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  };

  const handlePassOut = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Mark ${selectedIds.size} students as Passed Out?`)) {
      setLoading(true);
      let success = 0;
      for (const id of selectedIds) {
        try {
          const student = students.find(s => s.id === id);
          await updateDoc(doc(db, 'students', id), { status: 'Passed Out', updatedAt: serverTimestamp() });
          await addDoc(collection(db, 'passOutStudents'), {
            studentId: id,
            registerNumber: student.registerNumber,
            studentName: student.studentName,
            programmeCode: student.programmeCode,
            batch: student.batch,
            passedOutAt: serverTimestamp()
          });
          success++;
        } catch(e) {}
      }
      toast.success(`Passed out ${success} students`);
      fetchEligibleStudents();
    }
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-container" style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh' }}>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 5px 0' }}>Pass Out Students</h2>
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div><label style={{display:'block',marginBottom:5}}>Programme Code</label><input type="text" value={filter.programmeCode} onChange={e=>setFilter({...filter,programmeCode:e.target.value})} style={{padding:'8px',border:'1px solid #ccc',borderRadius:'4px'}} /></div>
        <div><label style={{display:'block',marginBottom:5}}>Batch</label><input type="text" value={filter.batch} onChange={e=>setFilter({...filter,batch:e.target.value})} style={{padding:'8px',border:'1px solid #ccc',borderRadius:'4px'}} /></div>
        <div style={{display:'flex',alignItems:'flex-end'}}><button onClick={fetchEligibleStudents} style={{padding:'8px 16px',background:'#2563eb',color:'#fff',border:'none',borderRadius:'4px',cursor:'pointer'}}>Find Students</button></div>
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>Final Year Students</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setSelectedIds(new Set(selectedIds.size === students.length ? [] : students.map(s => s.id)))} style={{ background: 'none', border: '1px solid #ccc', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Select All</button>
            <button onClick={handlePassOut} disabled={selectedIds.size === 0} style={{ padding: '6px 16px', background: selectedIds.size === 0 ? '#94a3b8' : '#059669', color: '#fff', border: 'none', borderRadius: '4px', cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><GraduationCap size={16} /> Mark Pass Out</button>
          </div>
        </div>
        {loading ? <p>Loading...</p> : students.length === 0 ? <p>No active students found.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{background:'#f1f5f9',textAlign:'left'}}>
              <th style={{padding:10}}>Select</th>
              <th style={{padding:10}}>Register No</th>
              <th style={{padding:10}}>Name</th>
            </tr></thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id} style={{borderBottom:'1px solid #eee'}}>
                  <td style={{padding:10}}><input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => { const n = new Set(selectedIds); if(n.has(s.id)) n.delete(s.id); else n.add(s.id); setSelectedIds(n); }} /></td>
                  <td style={{padding:10}}>{s.registerNumber}</td>
                  <td style={{padding:10}}>{s.studentName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
      </main>
    </div>
  );
}