import Sidebar from '../../../components/Sidebar';
import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/config';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import DataTable from '../../../components/common/DataTable';
import FilterCard from '../../../components/common/FilterCard';

export default function RegulationMapping() {
  const [mappings, setMappings] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [regulations, setRegulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  
  const [formData, setFormData] = useState({
    academicYear: '',
    programmeCode: '',
    regulationId: '',
    semesters: '',
    pattern: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const progSnap = await getDocs(collection(db, 'programmes'));
      setProgrammes(progSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      const regSnap = await getDocs(collection(db, 'regulations'));
      setRegulations(regSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const q = query(collection(db, 'regulationMappings'), orderBy('createdAt', 'desc'));
      const mapSnap = await getDocs(q);
      setMappings(mapSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editItem) {
        await updateDoc(doc(db, 'regulationMappings', editItem.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast.success('Mapping updated');
      } else {
        await addDoc(collection(db, 'regulationMappings'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success('Mapping created');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to save mapping');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this mapping?')) {
      try {
        await deleteDoc(doc(db, 'regulationMappings', id));
        toast.success('Mapping deleted');
        fetchData();
      } catch (err) {
        toast.error('Failed to delete mapping');
      }
    }
  };

  const columns = [
    { key: 'academicYear', label: 'Academic Year' },
    { key: 'programmeCode', label: 'Programme Code' },
    { key: 'regulationId', label: 'Regulation ID' },
    { key: 'semesters', label: 'Semesters' },
    { key: 'pattern', label: 'Pattern' },
    { 
      key: 'actions', 
      label: 'Actions', 
      render: (item) => (
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => { setEditItem(item); setFormData(item); setIsModalOpen(true); }} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer' }}>
            <Edit2 size={16} />
          </button>
          <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
            <Trash2 size={16} />
          </button>
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
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 5px 0' }}>Regulation Mapping</h2>
          <div style={{ color: '#64748b', fontSize: '13px' }}>Configuration / General Configuration / Regulation Mapping</div>
        </div>
        <button onClick={() => { setEditItem(null); setFormData({ academicYear: '', programmeCode: '', regulationId: '', semesters: '', pattern: '' }); setIsModalOpen(true); }} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> Create Mapping
        </button>
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <DataTable columns={columns} data={mappings} loading={loading} />
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '8px', padding: '20px' }}>
            <h3>{editItem ? 'Edit Mapping' : 'Create Mapping'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Academic Year *</label>
                <input required type="text" value={formData.academicYear} onChange={e => setFormData({...formData, academicYear: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} placeholder="e.g. 2023-2024" />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Programme Code *</label>
                <select required value={formData.programmeCode} onChange={e => setFormData({...formData, programmeCode: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
                  <option value="">Select Programme</option>
                  {programmes.map(p => <option key={p.id} value={p.programmeCode}>{p.programmeCode} - {p.programmeName}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Regulation ID *</label>
                <select required value={formData.regulationId} onChange={e => setFormData({...formData, regulationId: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
                  <option value="">Select Regulation</option>
                  {regulations.map(r => <option key={r.id} value={r.regulationId}>{r.regulationId}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Semesters (comma separated)</label>
                <input type="text" value={formData.semesters} onChange={e => setFormData({...formData, semesters: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} placeholder="1,2,3,4,5,6,7,8" />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Pattern</label>
                <input type="text" value={formData.pattern} onChange={e => setFormData({...formData, pattern: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} placeholder="e.g. OBE" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
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