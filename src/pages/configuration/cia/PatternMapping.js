import Sidebar from '../../../components/Sidebar';
import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/config';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import DataTable from '../../../components/common/DataTable';
import { useAuth } from '../../../context/AuthContext';

export default function PatternMapping() {
  const [mappings, setMappings] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [ciaTypes, setCiaTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  
  const { userProfile, isSuperAdmin } = useAuth();
  const [filterDept, setFilterDept] = useState('');
  const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "IT", "AIDS"];
  
  const [formData, setFormData] = useState({
    academicSession: '',
    programmeCode: '',
    semester: '',
    courseCode: '',
    ciaTypeId: '',
    evaluationPatternId: ''
  , department: '' });

  const fetchData = async () => {
    try {
      setLoading(true);
      const patSnap = await getDocs(collection(db, 'evaluationPatterns'));
      setPatterns(patSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      const typeSnap = await getDocs(collection(db, 'ciaTypesConfig'));
      setCiaTypes(typeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      let q = query(collection(db, 'patternMappings'));
      
      if (userProfile?.role === 'hod') {
        q = query(collection(db, 'patternMappings'), where('department', '==', userProfile.dept));
      }
      
      const mapSnap = await getDocs(q);
      let fetchedMappings = mapSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (userProfile?.role !== 'hod' && filterDept) {
        if (filterDept === 'Unassigned') {
          fetchedMappings = fetchedMappings.filter(f => !f.department);
        } else {
          fetchedMappings = fetchedMappings.filter(f => f.department === filterDept);
        }
      }

      fetchedMappings.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      setMappings(fetchedMappings);
    } catch (err) { toast.error('Failed to load mappings'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (userProfile) fetchData(); }, [userProfile, filterDept]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // duplicate check
    if (!editItem) {
        const isDuplicate = mappings.some(m => m.courseCode === formData.courseCode && m.ciaTypeId === formData.ciaTypeId && m.academicSession === formData.academicSession);
        if (isDuplicate) { toast.error('Mapping already exists for this Course, Session and CIA Type'); return; }
    }

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
        await updateDoc(doc(db, 'patternMappings', editItem.id), savePayload);
        toast.success('Updated successfully');
      } else {
        savePayload.createdAt = serverTimestamp();
        await addDoc(collection(db, 'patternMappings'), savePayload);
        toast.success('Created successfully');
      }
      setIsModalOpen(false); fetchData();
    } catch (err) { toast.error('Save failed'); }
  };

  const handleDelete = async (id) => {
    if(window.confirm('Delete this mapping?')) {
      try { await deleteDoc(doc(db, 'patternMappings', id)); toast.success('Deleted'); fetchData(); }
      catch(e) { toast.error('Delete failed'); }
    }
  };

  const columns = [
    { key: 'academicSession', label: 'Academic Session' },
    { key: 'department', label: 'Dept', render: (item) => item.department || <span style={{color:'red'}}>Unassigned</span> },
    { key: 'programmeCode', label: 'Programme' },
    { key: 'semester', label: 'Semester' },
    { key: 'courseCode', label: 'Course Code' },
    { key: 'ciaTypeId', label: 'CIA Type ID' },
    { key: 'evaluationPatternId', label: 'Pattern ID' },
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
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 5px 0' }}>Pattern Mapping</h2>
          <div style={{ color: '#64748b', fontSize: '13px' }}>Department / CIA Configuration / Pattern Mapping</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {userProfile?.role !== 'hod' && (
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
              <option value="">All Departments</option>
              <option value="Unassigned">Unassigned (Legacy)</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <button onClick={() => { setEditItem(null); setFormData({ academicSession: '', programmeCode: '', semester: '', courseCode: '', ciaTypeId: '', evaluationPatternId: '' }); setIsModalOpen(true); }} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={16} /> Create Mapping</button>
        </div>
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <DataTable columns={columns} data={mappings} loading={loading} />
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '600px', borderRadius: '8px', padding: '20px' }}>
            <h3>{editItem ? 'Edit Mapping' : 'Create Mapping'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div><label>Academic Session *</label><input required type="text" value={formData.academicSession} onChange={e=>setFormData({...formData,academicSession:e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}/></div>
                <div><label>Programme Code *</label><input required type="text" value={formData.programmeCode} onChange={e=>setFormData({...formData,programmeCode:e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}/></div>
                <div><label>Semester *</label><input required type="number" value={formData.semester} onChange={e=>setFormData({...formData,semester:e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}/></div>
                <div><label>Course Code *</label><input required type="text" value={formData.courseCode} onChange={e=>setFormData({...formData,courseCode:e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}/></div>
                <div><label>CIA Type *</label><select required value={formData.ciaTypeId} onChange={e=>setFormData({...formData,ciaTypeId:e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}>
                    <option value="">Select CIA Type</option>
                    {ciaTypes.map(c=><option key={c.id} value={c.id}>{c.typeName}</option>)}
                </select></div>
                <div><label>Evaluation Pattern *</label><select required value={formData.evaluationPatternId} onChange={e=>setFormData({...formData,evaluationPatternId:e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}>
                    <option value="">Select Pattern</option>
                    {patterns.map(p=><option key={p.id} value={p.id}>{p.patternName}</option>)}
                </select></div>
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:20}}>
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