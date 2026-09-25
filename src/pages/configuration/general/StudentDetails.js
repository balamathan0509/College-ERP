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

export default function StudentDetails() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [activeTab, setActiveTab] = useState('All');
  
  const { userProfile } = useAuth();
  
  const [formData, setFormData] = useState({
    registerNumber: '',
    studentName: '',
    email: '',
    mobile: '',
    programmeCode: '',
    batch: '',
    semester: '',
    year: '',
    section: '',
    status: 'Active'
  });

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'users'), where('role', '==', 'student'));
      const snap = await getDocs(q);
      let fetchedStudents = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          registerNumber: data.registerNo || data.registerNumber || '',
          studentName: data.name || data.studentName || '',
          email: data.email || '',
          mobile: data.phone || data.mobile || '',
          programmeCode: data.programmeCode || data.dept || '',
          batch: data.batch || '',
          semester: data.semester || '',
          year: data.year || '',
          section: data.section || '',
          status: data.status || 'Active',
          ...data
        };
      });
      
      if (userProfile?.role === 'hod') {
        fetchedStudents = fetchedStudents.filter(s => s.programmeCode === userProfile.dept || s.dept === userProfile.dept);
      }
      
      setStudents(fetchedStudents);
    } catch (err) {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.registerNumber?.trim() || !formData.studentName?.trim()) {
      toast.error('Register Number and Name required'); return;
    }
    
    // Check duplicates
    if (!editItem && students.some(s => s.registerNumber.toLowerCase() === formData.registerNumber.trim().toLowerCase())) {
      toast.error('Register Number already exists'); return;
    }

    try {
      const dbData = {
        role: 'student',
        registerNumber: formData.registerNumber,
        registerNo: formData.registerNumber,
        studentName: formData.studentName,
        name: formData.studentName,
        email: formData.email,
        mobile: formData.mobile,
        phone: formData.mobile,
        programmeCode: formData.programmeCode,
        dept: formData.programmeCode,
        batch: formData.batch,
        semester: formData.semester,
        year: formData.year,
        section: formData.section,
        status: formData.status
      };

      if (editItem) {
        await updateDoc(doc(db, 'users', editItem.id), { ...dbData, updatedAt: serverTimestamp() });
        toast.success('Student updated');
      } else {
        await addDoc(collection(db, 'users'), { ...dbData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        toast.success('Student added');
      }
      setIsModalOpen(false);
      fetchStudents();
    } catch (err) {
      toast.error('Failed to save student');
    }
  };

  const handleBulkUpload = async (data) => {
    let success = 0; let duplicates = 0;
    for (const row of data) {
      if (!row['Register Number'] || !row['Student Name']) continue;
      if (students.some(s => s.registerNumber.toLowerCase() === String(row['Register Number']).trim().toLowerCase())) {
        duplicates++; continue;
      }
      await addDoc(collection(db, 'users'), {
        role: 'student',
        registerNumber: String(row['Register Number']).trim(),
        registerNo: String(row['Register Number']).trim(),
        studentName: String(row['Student Name']).trim(),
        name: String(row['Student Name']).trim(),
        email: String(row['Email'] || '').trim(),
        mobile: String(row['Mobile'] || '').trim(),
        phone: String(row['Mobile'] || '').trim(),
        programmeCode: String(row['Programme Code'] || '').trim(),
        dept: String(row['Programme Code'] || '').trim(),
        batch: String(row['Batch'] || '').trim(),
        semester: String(row['Semester'] || '').trim(),
        year: String(row['Year'] || '').trim(),
        section: String(row['Section'] || '').trim(),
        status: String(row['Status'] || 'Active').trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      success++;
    }
    toast.success(`Uploaded ${success} students. ${duplicates > 0 ? '(' + duplicates + ' duplicates skipped)' : ''}`);
    fetchStudents();
  };

  const columns = [
    { key: 'registerNumber', label: 'Register Number' },
    { key: 'studentName', label: 'Student Name' },
    { key: 'programmeCode', label: 'Programme' },
    { key: 'year', label: 'Year' },
    { key: 'section', label: 'Section' },
    { key: 'batch', label: 'Batch' },
    { key: 'semester', label: 'Semester' },
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
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 5px 0' }}>Student Details</h2>
          <div style={{ color: '#64748b', fontSize: '13px' }}>Configuration / General Configuration / Student Details</div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setIsUploadOpen(true)} style={{ padding: '8px 16px', background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Upload size={16} /> Bulk Upload</button>
          <button onClick={() => { setEditItem(null); setFormData({ registerNumber: '', studentName: '', email: '', mobile: '', programmeCode: '', batch: '', semester: '', year: '', section: '', status: 'Active' }); setIsModalOpen(true); }} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={16} /> Add Student</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
        {['All', '1st Year', '2nd Year', '3rd Year', '4th Year'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              background: activeTab === tab ? '#2563eb' : 'transparent',
              color: activeTab === tab ? '#fff' : '#64748b',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? '600' : '400'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <DataTable columns={columns} data={activeTab === 'All' ? students : students.filter(s => s.year === activeTab || (activeTab === '1st Year' && s.year === '1') || (activeTab === '2nd Year' && s.year === '2') || (activeTab === '3rd Year' && s.year === '3') || (activeTab === '4th Year' && s.year === '4'))} loading={loading} />
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '600px', borderRadius: '8px', padding: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>{editItem ? 'Edit Student' : 'Add Student'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div><label>Register Number *</label><input required type="text" value={formData.registerNumber} onChange={e => setFormData({...formData, registerNumber: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} disabled={!!editItem && !!editItem.registerNumber} /></div>
                <div><label>Student Name *</label><input required type="text" value={formData.studentName} onChange={e => setFormData({...formData, studentName: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
                <div><label>Email</label><input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
                <div><label>Mobile</label><input type="text" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
                <div><label>Programme Code</label><input type="text" value={formData.programmeCode} onChange={e => setFormData({...formData, programmeCode: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
                <div><label>Batch</label><input type="text" value={formData.batch} onChange={e => setFormData({...formData, batch: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} placeholder="e.g. 2021-2025" /></div>
                <div><label>Semester</label><input type="text" value={formData.semester} onChange={e => setFormData({...formData, semester: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
                <div><label>Year</label><select value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}><option value="">Select Year</option><option value="1st Year">1st Year</option><option value="2nd Year">2nd Year</option><option value="3rd Year">3rd Year</option><option value="4th Year">4th Year</option></select></div>
                <div><label>Section</label><input type="text" value={formData.section} onChange={e => setFormData({...formData, section: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} placeholder="e.g. A" /></div>
                <div><label>Status</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}><option>Active</option><option>Inactive</option><option>Passed Out</option></select></div>
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
        title="Upload Students"
        templateName="StudentsTemplate.xlsx"
        expectedColumns={['Register Number', 'Student Name', 'Email', 'Mobile', 'Programme Code', 'Batch', 'Semester', 'Year', 'Section', 'Status']}
        onUpload={handleBulkUpload}
      />
    </div>
      </main>
    </div>
  );
}