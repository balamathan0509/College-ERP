const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const ciaDir = path.join(srcDir, 'pages', 'configuration', 'cia');

// 1. QuestionFormat.js
const questionFormatCode = `import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/config';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import DataTable from '../../../components/common/DataTable';

export default function QuestionFormat() {
  const [formats, setFormats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  
  const [formData, setFormData] = useState({
    formatName: '',
    patternType: 'OBE',
    totalMarks: '',
    sections: 'Part A, Part B, Part C',
    status: 'Active'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'questionFormatConfigs'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setFormats(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      toast.error('Failed to load formats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.formatName.trim()) { toast.error('Format name is required'); return; }
    try {
      if (editItem) {
        await updateDoc(doc(db, 'questionFormatConfigs', editItem.id), { ...formData, updatedAt: serverTimestamp() });
        toast.success('Updated successfully');
      } else {
        await addDoc(collection(db, 'questionFormatConfigs'), { ...formData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
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
    { key: 'patternType', label: 'Pattern Type' },
    { key: 'totalMarks', label: 'Total Marks' },
    { key: 'sections', label: 'Sections' },
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
    <div className="page-container" style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh' }}>
      <div className="page-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 5px 0' }}>Question Format</h2>
          <div style={{ color: '#64748b', fontSize: '13px' }}>Configuration / CIA Configuration / Question Format</div>
        </div>
        <button onClick={() => { setEditItem(null); setFormData({ formatName: '', patternType: 'OBE', totalMarks: '', sections: 'Part A, Part B, Part C', status: 'Active' }); setIsModalOpen(true); }} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={16} /> Add Format</button>
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <DataTable columns={columns} data={formats} loading={loading} />
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '8px', padding: '20px' }}>
            <h3>{editItem ? 'Edit Format' : 'Create Format'}</h3>
            <form onSubmit={handleSubmit}>
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
  );
}
`;

// 2. TypesAndEvaluation.js
const typesAndEvalCode = `import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/config';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import DataTable from '../../../components/common/DataTable';

export default function TypesAndEvaluation() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  
  const [formData, setFormData] = useState({ typeName: '', evaluationMethod: 'Standard', isBestOf: false, status: 'Active' });

  const fetchData = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'ciaTypesConfig'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setTypes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) { toast.error('Failed to load types'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.typeName.trim()) return;
    try {
      if (editItem) {
        await updateDoc(doc(db, 'ciaTypesConfig', editItem.id), { ...formData, updatedAt: serverTimestamp() });
        toast.success('Updated');
      } else {
        await addDoc(collection(db, 'ciaTypesConfig'), { ...formData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        toast.success('Created');
      }
      setIsModalOpen(false); fetchData();
    } catch (err) { toast.error('Save failed'); }
  };

  const handleDelete = async (id) => {
    if(window.confirm('Delete this CIA type?')) {
      try { await deleteDoc(doc(db, 'ciaTypesConfig', id)); toast.success('Deleted'); fetchData(); }
      catch(e) { toast.error('Delete failed'); }
    }
  };

  const columns = [
    { key: 'typeName', label: 'CIA Type Name' },
    { key: 'evaluationMethod', label: 'Evaluation Method' },
    { key: 'isBestOf', label: 'Best Of Strategy', render: i => i.isBestOf ? 'Yes' : 'No' },
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
    <div className="page-container" style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh' }}>
      <div className="page-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 5px 0' }}>Types & Evaluation</h2>
          <div style={{ color: '#64748b', fontSize: '13px' }}>Configuration / CIA Configuration / Types & Evaluation</div>
        </div>
        <button onClick={() => { setEditItem(null); setFormData({ typeName: '', evaluationMethod: 'Standard', isBestOf: false, status: 'Active' }); setIsModalOpen(true); }} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={16} /> Add CIA Type</button>
      </div>
      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <DataTable columns={columns} data={types} loading={loading} />
      </div>
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '400px', borderRadius: '8px', padding: '20px' }}>
            <h3>{editItem ? 'Edit Type' : 'Create Type'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{marginBottom:15}}><label>CIA Type Name</label><input required type="text" value={formData.typeName} onChange={e=>setFormData({...formData,typeName:e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}/></div>
              <div style={{marginBottom:15}}><label>Evaluation Method</label><input required type="text" value={formData.evaluationMethod} onChange={e=>setFormData({...formData,evaluationMethod:e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}/></div>
              <div style={{marginBottom:15}}><label style={{display:'flex',alignItems:'center',gap:5}}><input type="checkbox" checked={formData.isBestOf} onChange={e=>setFormData({...formData,isBestOf:e.target.checked})} /> Is this part of a "Best Of" evaluation?</label></div>
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
  );
}
`;

// 3. EvaluationPattern.js
const evalPatternCode = `import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/config';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import DataTable from '../../../components/common/DataTable';

export default function EvaluationPattern() {
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  
  const [formData, setFormData] = useState({
    patternName: '',
    maxMarks: '',
    minMarks: '',
    weightage: '',
    components: '',
    status: 'Active'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'evaluationPatterns'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setPatterns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) { toast.error('Failed to load patterns'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(Number(formData.minMarks) > Number(formData.maxMarks)) { toast.error('Min marks cannot be greater than Max marks'); return; }
    try {
      if (editItem) {
        await updateDoc(doc(db, 'evaluationPatterns', editItem.id), { ...formData, updatedAt: serverTimestamp() });
        toast.success('Updated');
      } else {
        await addDoc(collection(db, 'evaluationPatterns'), { ...formData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        toast.success('Created');
      }
      setIsModalOpen(false); fetchData();
    } catch (err) { toast.error('Save failed'); }
  };

  const handleDelete = async (id) => {
    if(window.confirm('Delete this pattern?')) {
      try { await deleteDoc(doc(db, 'evaluationPatterns', id)); toast.success('Deleted'); fetchData(); }
      catch(e) { toast.error('Delete failed'); }
    }
  };

  const columns = [
    { key: 'patternName', label: 'Pattern Name' },
    { key: 'maxMarks', label: 'Max Marks' },
    { key: 'minMarks', label: 'Min Marks' },
    { key: 'weightage', label: 'Weightage %' },
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
    <div className="page-container" style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh' }}>
      <div className="page-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 5px 0' }}>Evaluation Pattern</h2>
          <div style={{ color: '#64748b', fontSize: '13px' }}>Configuration / CIA Configuration / Evaluation Pattern</div>
        </div>
        <button onClick={() => { setEditItem(null); setFormData({ patternName: '', maxMarks: '', minMarks: '', weightage: '', components: '', status: 'Active' }); setIsModalOpen(true); }} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={16} /> Add Pattern</button>
      </div>
      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <DataTable columns={columns} data={patterns} loading={loading} />
      </div>
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '8px', padding: '20px' }}>
            <h3>{editItem ? 'Edit Pattern' : 'Create Pattern'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{marginBottom:15}}><label>Pattern Name *</label><input required type="text" value={formData.patternName} onChange={e=>setFormData({...formData,patternName:e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}/></div>
              <div style={{display:'flex',gap:15}}>
                <div style={{marginBottom:15,flex:1}}><label>Max Marks *</label><input required type="number" min="1" value={formData.maxMarks} onChange={e=>setFormData({...formData,maxMarks:e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}/></div>
                <div style={{marginBottom:15,flex:1}}><label>Min/Pass Marks *</label><input required type="number" min="0" value={formData.minMarks} onChange={e=>setFormData({...formData,minMarks:e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}/></div>
              </div>
              <div style={{marginBottom:15}}><label>Weightage %</label><input required type="number" min="0" max="100" value={formData.weightage} onChange={e=>setFormData({...formData,weightage:e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}/></div>
              <div style={{marginBottom:15}}><label>Components (comma separated)</label><input type="text" value={formData.components} onChange={e=>setFormData({...formData,components:e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}} placeholder="e.g. MCQ, Descriptive, Assignment" /></div>
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
  );
}
`;

// 4. ShowEvaluationPattern.js
const showEvalPatternCode = `import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';
import DataTable from '../../../components/common/DataTable';

export default function ShowEvaluationPattern() {
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'evaluationPatterns'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setPatterns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) { toast.error('Failed to load patterns'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const columns = [
    { key: 'patternName', label: 'Pattern Name' },
    { key: 'maxMarks', label: 'Max Marks' },
    { key: 'minMarks', label: 'Min Marks' },
    { key: 'weightage', label: 'Weightage %' },
    { key: 'components', label: 'Components' },
    { key: 'status', label: 'Status' }
  ];

  return (
    <div className="page-container" style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh' }}>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 5px 0' }}>Show Evaluation Pattern</h2>
        <div style={{ color: '#64748b', fontSize: '13px' }}>Configuration / CIA Configuration / Show Evaluation Pattern</div>
      </div>
      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <p style={{marginBottom:'20px',color:'#64748b'}}>This is a read-only view of all existing Evaluation Patterns.</p>
        <DataTable columns={columns} data={patterns} loading={loading} />
      </div>
    </div>
  );
}
`;

// 5. PatternMapping.js
const patternMappingCode = `import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/config';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import DataTable from '../../../components/common/DataTable';

export default function PatternMapping() {
  const [mappings, setMappings] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [ciaTypes, setCiaTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  
  const [formData, setFormData] = useState({
    academicSession: '',
    programmeCode: '',
    semester: '',
    courseCode: '',
    ciaTypeId: '',
    evaluationPatternId: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const patSnap = await getDocs(collection(db, 'evaluationPatterns'));
      setPatterns(patSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      const typeSnap = await getDocs(collection(db, 'ciaTypesConfig'));
      setCiaTypes(typeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const q = query(collection(db, 'patternMappings'), orderBy('createdAt', 'desc'));
      const mapSnap = await getDocs(q);
      setMappings(mapSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) { toast.error('Failed to load mappings'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // duplicate check
    if (!editItem) {
        const isDuplicate = mappings.some(m => m.courseCode === formData.courseCode && m.ciaTypeId === formData.ciaTypeId && m.academicSession === formData.academicSession);
        if (isDuplicate) { toast.error('Mapping already exists for this Course, Session and CIA Type'); return; }
    }

    try {
      if (editItem) {
        await updateDoc(doc(db, 'patternMappings', editItem.id), { ...formData, updatedAt: serverTimestamp() });
        toast.success('Updated');
      } else {
        await addDoc(collection(db, 'patternMappings'), { ...formData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        toast.success('Created');
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
    <div className="page-container" style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh' }}>
      <div className="page-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 5px 0' }}>Pattern Mapping</h2>
          <div style={{ color: '#64748b', fontSize: '13px' }}>Configuration / CIA Configuration / Pattern Mapping</div>
        </div>
        <button onClick={() => { setEditItem(null); setFormData({ academicSession: '', programmeCode: '', semester: '', courseCode: '', ciaTypeId: '', evaluationPatternId: '' }); setIsModalOpen(true); }} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={16} /> Create Mapping</button>
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
  );
}
`;

fs.writeFileSync(path.join(ciaDir, 'QuestionFormat.js'), questionFormatCode);
fs.writeFileSync(path.join(ciaDir, 'TypesAndEvaluation.js'), typesAndEvalCode);
fs.writeFileSync(path.join(ciaDir, 'EvaluationPattern.js'), evalPatternCode);
fs.writeFileSync(path.join(ciaDir, 'ShowEvaluationPattern.js'), showEvalPatternCode);
fs.writeFileSync(path.join(ciaDir, 'PatternMapping.js'), patternMappingCode);

console.log("CIA Configuration Pages implemented");
