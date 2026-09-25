import Sidebar from '../../../components/Sidebar';
import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/config';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import DataTable from '../../../components/common/DataTable';
import { useAuth } from '../../../context/AuthContext';

export default function ShowEvaluationPattern() {
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();
  const [filterDept, setFilterDept] = useState('');
  const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "IT", "AIDS"];

  const fetchData = async () => {
    try {
      setLoading(true);
      let q = query(collection(db, 'evaluationPatterns'));
      
      if (userProfile?.role === 'hod') {
        q = query(collection(db, 'evaluationPatterns'), where('department', '==', userProfile.dept));
      }
      
      const snap = await getDocs(q);
      let fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (userProfile?.role !== 'hod' && filterDept) {
        if (filterDept === 'Unassigned') {
          fetched = fetched.filter(f => !f.department);
        } else {
          fetched = fetched.filter(f => f.department === filterDept);
        }
      }
      
      fetched.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      
      setPatterns(fetched);
    } catch (err) { toast.error('Failed to load patterns'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (userProfile) fetchData(); }, [userProfile, filterDept]);

  const columns = [
    { key: 'patternName', label: 'Pattern Name' },
    { key: 'department', label: 'Dept', render: (item) => item.department || <span style={{color:'red'}}>Unassigned</span> },
    { key: 'maxMarks', label: 'Max Marks' },
    { key: 'minMarks', label: 'Min Marks' },
    { key: 'weightage', label: 'Weightage %' },
    { 
      key: 'components', 
      label: 'Components',
      render: (item) => {
        if (!item.components) return '-';
        if (typeof item.components === 'string') return item.components;
        if (Array.isArray(item.components)) {
          return item.components.map(c => c.name || c.heading || 'Component').join(', ');
        }
        return JSON.stringify(item.components);
      }
    },
    { key: 'status', label: 'Status' }
  ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-container" style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh' }}>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 5px 0' }}>Show Evaluation Pattern</h2>
        <div style={{ color: '#64748b', fontSize: '13px' }}>Department / CIA Configuration / Show Evaluation Pattern</div>
        
        {userProfile?.role !== 'hod' && (
          <div style={{ marginTop: '15px' }}>
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
              <option value="">All Departments</option>
              <option value="Unassigned">Unassigned (Legacy)</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
      </div>
      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <p style={{marginBottom:'20px',color:'#64748b'}}>This is a read-only view of all existing Evaluation Patterns.</p>
        <DataTable columns={columns} data={patterns} loading={loading} />
      </div>
    </div>
      </main>
    </div>
  );
}