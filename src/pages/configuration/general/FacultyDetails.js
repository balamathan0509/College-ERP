import Sidebar from '../../../components/Sidebar';
import { useAuth } from '../../../context/AuthContext';
import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/config';
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp, query, where } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { Download, Upload, Plus, Edit2 } from 'lucide-react';
import DataTable from '../../../components/common/DataTable';
import BulkUploadModal from '../../../components/common/BulkUploadModal';
import FilterCard from '../../../components/common/FilterCard';
import * as XLSX from 'xlsx';

export default function FacultyDetails() {
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const { userProfile } = useAuth();
  
  const [formData, setFormData] = useState({
    employeeCode: '',
    facultyName: '',
    email: '',
    mobile: '',
    department: '',
    designation: '',
    status: 'Active'
  });

  const fetchFaculties = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'users'), where("role", "in", ["staff", "hod"]));
      const snap = await getDocs(q);
      let fetchedFaculties = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          employeeCode: data.registerNo || data.staffId || data.employeeCode || '',
          facultyName: data.name || data.facultyName || '',
          email: data.email || '',
          mobile: data.phone || data.mobile || '',
          department: data.dept || data.department || '',
          designation: data.designation || '',
          status: data.status || 'Active',
          ...data
        };
      });
      
      if (userProfile?.role === 'hod') {
        fetchedFaculties = fetchedFaculties.filter(f => f.department === userProfile.dept || f.dept === userProfile.dept);
      }
      
      setFaculties(fetchedFaculties);
    } catch (err) {
      toast.error('Failed to load faculty details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculties();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.employeeCode?.trim() || !formData.facultyName?.trim()) {
      toast.error('Employee Code and Name required'); return;
    }
    
    if (!editItem && faculties.some(f => f.employeeCode.toLowerCase() === formData.employeeCode.trim().toLowerCase())) {
      toast.error('Employee Code already exists'); return;
    }

    try {
      const dbData = {
        role: 'staff',
        employeeCode: formData.employeeCode,
        registerNo: formData.employeeCode,
        name: formData.facultyName,
        facultyName: formData.facultyName,
        email: formData.email,
        phone: formData.mobile,
        mobile: formData.mobile,
        dept: formData.department,
        department: formData.department,
        designation: formData.designation,
        status: formData.status
      };

      if (editItem) {
        await updateDoc(doc(db, 'users', editItem.id), { ...dbData, updatedAt: serverTimestamp() });
        toast.success('Faculty updated');
      } else {
        await addDoc(collection(db, 'users'), { ...dbData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        toast.success('Faculty added');
      }
      setIsModalOpen(false);
      fetchFaculties();
    } catch (err) {
      toast.error('Failed to save faculty');
    }
  };

  const handleBulkUpload = async (data) => {
    let success = 0; let duplicates = 0;
    for (const row of data) {
      if (!row['Employee Code'] || !row['Faculty Name']) continue;
      if (faculties.some(f => f.employeeCode.toLowerCase() === String(row['Employee Code']).trim().toLowerCase())) {
        duplicates++; continue;
      }
      await addDoc(collection(db, 'users'), {
        role: 'staff',
        employeeCode: String(row['Employee Code']).trim(),
        registerNo: String(row['Employee Code']).trim(),
        name: String(row['Faculty Name']).trim(),
        facultyName: String(row['Faculty Name']).trim(),
        email: String(row['Email'] || '').trim(),
        phone: String(row['Mobile'] || '').trim(),
        mobile: String(row['Mobile'] || '').trim(),
        dept: String(row['Department'] || '').trim(),
        department: String(row['Department'] || '').trim(),
        designation: String(row['Designation'] || '').trim(),
        status: String(row['Status'] || 'Active').trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      success++;
    }
    toast.success(`Uploaded ${success} faculties. ${duplicates > 0 ? '(' + duplicates + ' duplicates skipped)' : ''}`);
    fetchFaculties();
  };

  const columns = [
    { key: 'employeeCode', label: 'Employee Code' },
    { key: 'facultyName', label: 'Faculty Name' },
    { key: 'department', label: 'Department' },
    { key: 'designation', label: 'Designation' },
    { key: 'status', label: 'Status', render: (item) => <span style={{ padding: '4px 8px', borderRadius: '12px', background: item.status === 'Active' ? '#dcfce7' : '#fee2e2', color: item.status === 'Active' ? '#166534' : '#991b1b', fontSize: '12px', fontWeight: '500' }}>{item.status}</span> },
    { 
      key: 'actions', 
      label: 'Actions', 
      render: (item) => (
        <button onClick={() => { setEditItem(item); setFormData(item); setIsModalOpen(true); }} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer' }}>
          <Edit2 size={16} />
        </button>
      )
    }
  ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-container" style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh' }}>
      <div className="page-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 5px 0' }}>Faculty Details</h2>
          <div style={{ color: '#64748b', fontSize: '13px' }}>Configuration / General Configuration / Faculty Details</div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setIsUploadOpen(true)} style={{ padding: '8px 16px', background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Upload size={16} /> Bulk Upload</button>
          <button onClick={() => { setEditItem(null); setFormData({ employeeCode: '', facultyName: '', email: '', mobile: '', department: '', designation: '', status: 'Active' }); setIsModalOpen(true); }} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={16} /> Add Faculty</button>
        </div>
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <DataTable columns={columns} data={faculties} loading={loading} />
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '600px', borderRadius: '8px', padding: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>{editItem ? 'Edit Faculty' : 'Add Faculty'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div><label>Employee Code *</label><input required type="text" value={formData.employeeCode} onChange={e => setFormData({...formData, employeeCode: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} disabled={!!editItem && !!editItem.employeeCode} /></div>
                <div><label>Faculty Name *</label><input required type="text" value={formData.facultyName} onChange={e => setFormData({...formData, facultyName: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
                <div><label>Email</label><input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
                <div><label>Mobile</label><input type="text" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
                <div><label>Department</label><input type="text" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
                <div><label>Designation</label><input type="text" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
                <div><label>Status</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}><option>Active</option><option>Inactive</option></select></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BulkUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload Faculty"
        templateName="FacultyTemplate.xlsx"
        expectedColumns={['Employee Code', 'Faculty Name', 'Email', 'Mobile', 'Department', 'Designation', 'Status']}
        onUpload={handleBulkUpload}
      />
    </div>
      </main>
    </div>
  );
}