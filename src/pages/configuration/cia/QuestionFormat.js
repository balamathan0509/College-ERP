import Sidebar from '../../../components/Sidebar';
import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/config';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import DataTable from '../../../components/common/DataTable';
import { useAuth } from '../../../context/AuthContext';

export default function QuestionFormat() {
  const [formats, setFormats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  
  const { userProfile, isSuperAdmin } = useAuth();
  const [filterDept, setFilterDept] = useState('');
  
  // Available departments for Admin dropdown
  const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "IT", "AIDS"];
  
  const [formData, setFormData] = useState({
    formatName: '',
    patternType: 'OBE',
    totalMarks: '',
    sections: 'Part A, Part B, Part C',
    status: 'Active',
    department: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      let q = query(collection(db, 'questionFormatConfigs'));
      
      if (userProfile?.role === 'hod') {
        q = query(collection(db, 'questionFormatConfigs'), where('department', '==', userProfile.dept));
      }
      
      const snap = await getDocs(q);
      let fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Admin front-end filter
      if (userProfile?.role !== 'hod' && filterDept) {
        if (filterDept === 'Unassigned') {
          fetched = fetched.filter(f => !f.department);
        } else {
          fetched = fetched.filter(f => f.department === filterDept);
        }
      }
      
      // Sort client-side to avoid Firestore composite index requirement
      fetched.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      
      setFormats(fetched);
    } catch (err) {
      toast.error('Failed to load formats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile) {
      fetchData();
    }
  }, [userProfile, filterDept]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.formatName.trim()) { toast.error('Format name is required'); return; }
    try {
      let savePayload = { ...formData, updatedAt: serverTimestamp() };
      
      if (userProfile?.role === 'hod') {
        savePayload.department = userProfile.dept;
      } else {
        if (!savePayload.department) {
          toast.error('Admin must assign a department');
          return;
        }
      }

      if (editItem) {
        await updateDoc(doc(db, 'questionFormatConfigs', editItem.id), savePayload);
        toast.success('Updated successfully');
      } else {
        savePayload.createdAt = serverTimestamp();
        await addDoc(collection(db, 'questionFormatConfigs'), savePayload);
        toast.success('Created successfully');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) { toast.error('Save failed'); }
  };

  const handleDelete = async (id) => {
    if(window.confirm('Delete this format?')) {
      try {
        await deleteDoc(doc(db, 'questionFormatConfigs', id));
        toast.success('Deleted'); fetchData();
      } catch(e) { toast.error('Delete failed'); }
    }
  };

  const columns = [
    { key: 'formatName', label: 'Format Name' },
    { key: 'department', label: 'Dept', render: (item) => item.department || <span style={{color:'red'}}>Unassigned</span> },
    { key: 'patternType', label: 'Pattern Type' },
    { key: 'totalMarks', label: 'Total Marks' },
    { 
      key: 'sections', 
      label: 'Sections',
      render: (item) => {
        if (!item.sections) return '-';
        if (typeof item.sections === 'string') return item.sections;
        if (Array.isArray(item.sections)) {
          return item.sections.map(s => s.heading || s.denotedAs || s.description || 'Section').join(', ');
        }
        return JSON.stringify(item.sections);
      }
    },
    { key: 'status', label: 'Status' },
    { 
      key: 'actions', label: 'Actions', 
      render: (item) => (
        <div style={{display:'flex',gap:10}}>
          <button onClick={() => { setEditItem(item); setFormData(item); setIsModalOpen(true); }} style={{background:'none',border:'none',color:'#2563eb',cursor:'pointer'}}><Edit2 size={16}/></button>
          <button onClick={() => handleDelete(item.id)} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer'}}><Trash2 size={16}/></button>
        </div>
      )
    }
  ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-container" style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh' }}>
      <div className="page-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 5px 0' }}>Question Format</h2>
          <div style={{ color: '#64748b', fontSize: '13px' }}>Department / CIA Configuration / Question Format</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {userProfile?.role !== 'hod' && (
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
              <option value="">All Departments</option>
              <option value="Unassigned">Unassigned (Legacy)</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <button onClick={() => { setEditItem(null); setFormData({ formatName: '', patternType: 'OBE', totalMarks: '', sections: 'Part A, Part B, Part C', status: 'Active', department: userProfile?.role === 'hod' ? userProfile.dept : '' }); setIsModalOpen(true); }} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={16} /> Add Format</button>
        </div>
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <DataTable columns={columns} data={formats} loading={loading} />
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '8px', padding: '20px' }}>
            <h3>{editItem ? 'Edit Format' : 'Create Format'}</h3>
            <form onSubmit={handleSubmit}>
              {userProfile?.role !== 'hod' && (
                <div style={{marginBottom:15}}>
                  <label>Department (Admin Only) *</label>
                  <select required value={formData.department || ''} onChange={e => setFormData({...formData, department: e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}>
                    <option value="">Select Department</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}
              <div style={{marginBottom:15}}><label>Format Name</label><input required type="text" value={formData.formatName} onChange={e=>setFormData({...formData,formatName:e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}/></div>
              <div style={{marginBottom:15}}><label>Pattern Type</label><select value={formData.patternType} onChange={e=>setFormData({...formData,patternType:e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}><option>OBE</option><option>Non-OBE</option></select></div>
              <div style={{marginBottom:15}}><label>Total Marks</label><input type="number" required value={formData.totalMarks} onChange={e=>setFormData({...formData,totalMarks:e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}/></div>
              <div style={{marginBottom:15}}><label>Sections</label><input type="text" required value={formData.sections} onChange={e=>setFormData({...formData,sections:e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}/></div>
              <div style={{marginBottom:15}}><label>Status</label><select value={formData.status} onChange={e=>setFormData({...formData,status:e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}><option>Active</option><option>Inactive</option></select></div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
                <button type="button" onClick={()=>setIsModalOpen(false)} style={{padding:'8px 16px',background:'#f1f5f9',border:'1px solid #ccc',borderRadius:4}}>Cancel</button>
                <button type="submit" style={{padding:'8px 16px',background:'#2563eb',color:'#fff',border:'none',borderRadius:4}}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
      </main>
    </div>
  );
}