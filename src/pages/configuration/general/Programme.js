import Sidebar from '../../../components/Sidebar';
import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/config';
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Download, Plus, Search, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import DataTable from '../../../components/common/DataTable';
import BulkUploadModal from '../../../components/common/BulkUploadModal';
import FilterCard from '../../../components/common/FilterCard';

export default function Programme() {
  const [programmes, setProgrammes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  
  const [formData, setFormData] = useState({
    programmeCode: '',
    graduateType: '',
    programmeName: '',
    branch: '',
    departmentName: ''
  });

  const fetchProgrammes = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'programmes'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProgrammes(data);
    } catch (error) {
      toast.error('Failed to load programmes');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgrammes();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.programmeCode.trim() || !formData.programmeName.trim()) {
      toast.error('Programme Code and Name are required');
      return;
    }

    // Check duplicate
    if (!editItem && programmes.some(p => p.programmeCode.toLowerCase() === formData.programmeCode.trim().toLowerCase())) {
      toast.error('Programme Code already exists');
      return;
    }

    try {
      if (editItem) {
        await updateDoc(doc(db, 'programmes', editItem.id), {
          ...formData,
          programmeCode: formData.programmeCode.trim(),
          updatedAt: serverTimestamp()
        });
        toast.success('Programme updated successfully');
      } else {
        await addDoc(collection(db, 'programmes'), {
          ...formData,
          programmeCode: formData.programmeCode.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success('Programme added successfully');
      }
      setIsModalOpen(false);
      fetchProgrammes();
    } catch (error) {
      toast.error('Failed to save programme');
      console.error(error);
    }
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setFormData({
      programmeCode: item.programmeCode || '',
      graduateType: item.graduateType || '',
      programmeName: item.programmeName || '',
      branch: item.branch || '',
      departmentName: item.departmentName || ''
    });
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditItem(null);
    setFormData({ programmeCode: '', graduateType: '', programmeName: '', branch: '', departmentName: '' });
    setIsModalOpen(true);
  };

  const handleDownload = () => {
    if (programmes.length === 0) {
      toast.error('No data to download');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(programmes.map(({ id, createdAt, updatedAt, ...rest }) => rest));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Programmes");
    XLSX.writeFile(wb, "Programmes.xlsx");
  };

  const handleBulkUpload = async (data) => {
    let success = 0;
    let duplicates = 0;
    
    for (const row of data) {
      if (!row['Programme Code'] || !row['Name of the Programme']) continue;
      
      const exists = programmes.some(p => p.programmeCode.toLowerCase() === String(row['Programme Code']).trim().toLowerCase());
      if (exists) {
        duplicates++;
        continue;
      }

      await addDoc(collection(db, 'programmes'), {
        programmeCode: String(row['Programme Code']).trim(),
        graduateType: String(row['Graduate Type'] || '').trim(),
        programmeName: String(row['Name of the Programme']).trim(),
        branch: String(row['Branch'] || '').trim(),
        departmentName: String(row['Department Name'] || '').trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      success++;
    }
    
    toast.success(`Uploaded ${success} programmes. ${duplicates > 0 ? `(${duplicates} duplicates skipped)` : ''}`);
    fetchProgrammes();
  };

  const columns = [
    { key: 'programmeCode', label: 'Programme Code' },
    { key: 'graduateType', label: 'Graduate Type' },
    { key: 'programmeName', label: 'Name of the Programme' },
    { key: 'branch', label: 'Branch' },
    { key: 'departmentName', label: 'Department Name' },
    { 
      key: 'action', 
      label: 'Action', 
      render: (item) => (
        <button onClick={() => handleEdit(item)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: '500' }}>
          Edit
        </button>
      )
    }
  ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-container" style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh' }}>
      <div className="page-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 5px 0' }}>Programme Details</h2>
          <div style={{ color: '#64748b', fontSize: '13px' }}>
            Configuration / General Configuration / Programme
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setIsUploadOpen(true)} style={{ padding: '8px 16px', background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
            <FileText size={16} /> Bulk Upload
          </button>
          <button onClick={handleDownload} style={{ padding: '8px 16px', background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
            <Download size={16} /> Download
          </button>
          <button onClick={openNewModal} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
            <Plus size={16} /> Add New
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <DataTable columns={columns} data={programmes} loading={loading} />
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>{editItem ? 'Edit Programme' : 'Add New Programme'}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#334155' }}>Programme Code *</label>
                <input required type="text" name="programmeCode" value={formData.programmeCode} onChange={handleInputChange} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }} placeholder="e.g. 104 BE CSE" disabled={!!editItem} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#334155' }}>Graduate Type</label>
                <select name="graduateType" value={formData.graduateType} onChange={handleInputChange} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }}>
                  <option value="">Select Type</option>
                  <option value="UG">UG</option>
                  <option value="PG">PG</option>
                  <option value="Ph.D">Ph.D</option>
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#334155' }}>Name of the Programme *</label>
                <input required type="text" name="programmeName" value={formData.programmeName} onChange={handleInputChange} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }} placeholder="e.g. B.E COMPUTER SCIENCE" />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#334155' }}>Branch</label>
                <input type="text" name="branch" value={formData.branch} onChange={handleInputChange} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#334155' }}>Department Name</label>
                <input type="text" name="departmentName" value={formData.departmentName} onChange={handleInputChange} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BulkUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload Programmes"
        templateName="ProgrammeTemplate.xlsx"
        expectedColumns={['Programme Code', 'Graduate Type', 'Name of the Programme', 'Branch', 'Department Name']}
        onUpload={handleBulkUpload}
        templateData={[{ 'Programme Code': '104 BE CSE', 'Graduate Type': 'UG', 'Name of the Programme': 'B.E CSE', 'Branch': 'CSE', 'Department Name': 'Computer Science' }]}
      />
    </div>
      </main>
    </div>
  );
}