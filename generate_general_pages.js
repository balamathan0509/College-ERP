const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const generalDir = path.join(srcDir, 'pages', 'configuration', 'general');

// 1. RegulationMapping.js
const regulationMappingCode = `import React, { useState, useEffect } from 'react';
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
  );
}
`;

// 2. StudentDetails.js
const studentDetailsCode = `import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/config';
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';
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
  
  const [formData, setFormData] = useState({
    registerNumber: '',
    studentName: '',
    email: '',
    mobile: '',
    programmeCode: '',
    batch: '',
    semester: '',
    status: 'Active'
  });

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'students'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
    if (!formData.registerNumber.trim() || !formData.studentName.trim()) {
      toast.error('Register Number and Name required'); return;
    }
    
    // Check duplicates
    if (!editItem && students.some(s => s.registerNumber.toLowerCase() === formData.registerNumber.trim().toLowerCase())) {
      toast.error('Register Number already exists'); return;
    }

    try {
      if (editItem) {
        await updateDoc(doc(db, 'students', editItem.id), { ...formData, updatedAt: serverTimestamp() });
        toast.success('Student updated');
      } else {
        await addDoc(collection(db, 'students'), { ...formData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
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
      await addDoc(collection(db, 'students'), {
        registerNumber: String(row['Register Number']).trim(),
        studentName: String(row['Student Name']).trim(),
        email: String(row['Email'] || '').trim(),
        mobile: String(row['Mobile'] || '').trim(),
        programmeCode: String(row['Programme Code'] || '').trim(),
        batch: String(row['Batch'] || '').trim(),
        semester: String(row['Semester'] || '').trim(),
        status: String(row['Status'] || 'Active').trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      success++;
    }
    toast.success(\`Uploaded \${success} students. \${duplicates > 0 ? \`(\${duplicates} duplicates skipped)\` : ''}\`);
    fetchStudents();
  };

  const columns = [
    { key: 'registerNumber', label: 'Register Number' },
    { key: 'studentName', label: 'Student Name' },
    { key: 'programmeCode', label: 'Programme' },
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
    <div className="page-container" style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh' }}>
      <div className="page-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 5px 0' }}>Student Details</h2>
          <div style={{ color: '#64748b', fontSize: '13px' }}>Configuration / General Configuration / Student Details</div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setIsUploadOpen(true)} style={{ padding: '8px 16px', background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Upload size={16} /> Bulk Upload</button>
          <button onClick={() => { setEditItem(null); setFormData({ registerNumber: '', studentName: '', email: '', mobile: '', programmeCode: '', batch: '', semester: '', status: 'Active' }); setIsModalOpen(true); }} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={16} /> Add Student</button>
        </div>
      </div>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <DataTable columns={columns} data={students} loading={loading} />
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '600px', borderRadius: '8px', padding: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>{editItem ? 'Edit Student' : 'Add Student'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div><label>Register Number *</label><input required type="text" value={formData.registerNumber} onChange={e => setFormData({...formData, registerNumber: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} disabled={!!editItem} /></div>
                <div><label>Student Name *</label><input required type="text" value={formData.studentName} onChange={e => setFormData({...formData, studentName: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
                <div><label>Email</label><input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
                <div><label>Mobile</label><input type="text" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
                <div><label>Programme Code</label><input type="text" value={formData.programmeCode} onChange={e => setFormData({...formData, programmeCode: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
                <div><label>Batch</label><input type="text" value={formData.batch} onChange={e => setFormData({...formData, batch: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} placeholder="e.g. 2021-2025" /></div>
                <div><label>Semester</label><input type="text" value={formData.semester} onChange={e => setFormData({...formData, semester: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
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
        expectedColumns={['Register Number', 'Student Name', 'Email', 'Mobile', 'Programme Code', 'Batch', 'Semester', 'Status']}
        onUpload={handleBulkUpload}
      />
    </div>
  );
}
`;

// 3. FacultyDetails.js
const facultyDetailsCode = `import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/config';
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';
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
      const q = query(collection(db, 'faculty'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setFaculties(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
    if (!formData.employeeCode.trim() || !formData.facultyName.trim()) {
      toast.error('Employee Code and Name required'); return;
    }
    
    if (!editItem && faculties.some(f => f.employeeCode.toLowerCase() === formData.employeeCode.trim().toLowerCase())) {
      toast.error('Employee Code already exists'); return;
    }

    try {
      if (editItem) {
        await updateDoc(doc(db, 'faculty', editItem.id), { ...formData, updatedAt: serverTimestamp() });
        toast.success('Faculty updated');
      } else {
        await addDoc(collection(db, 'faculty'), { ...formData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
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
      await addDoc(collection(db, 'faculty'), {
        employeeCode: String(row['Employee Code']).trim(),
        facultyName: String(row['Faculty Name']).trim(),
        email: String(row['Email'] || '').trim(),
        mobile: String(row['Mobile'] || '').trim(),
        department: String(row['Department'] || '').trim(),
        designation: String(row['Designation'] || '').trim(),
        status: String(row['Status'] || 'Active').trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      success++;
    }
    toast.success(\`Uploaded \${success} faculties. \${duplicates > 0 ? \`(\${duplicates} duplicates skipped)\` : ''}\`);
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
                <div><label>Employee Code *</label><input required type="text" value={formData.employeeCode} onChange={e => setFormData({...formData, employeeCode: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} disabled={!!editItem} /></div>
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
  );
}
`;

// 4. PromoteStudent.js
const promoteStudentCode = `import React, { useState, useEffect } from 'react';
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
    if (window.confirm(\`Promote \${selectedIds.size} students to Semester \${target.targetSemester}?\`)) {
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
      toast.success(\`Successfully promoted \${success} students\`);
      fetchEligibleStudents();
    }
  };

  return (
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
              <div key={s.id} onClick={() => toggleSelect(s.id)} style={{ padding: '12px', border: \`2px solid \${selectedIds.has(s.id) ? '#3b82f6' : '#e2e8f0'}\`, borderRadius: '6px', cursor: 'pointer', background: selectedIds.has(s.id) ? '#eff6ff' : '#fff' }}>
                <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{s.registerNumber}</div>
                <div style={{ color: '#475569', fontSize: '14px' }}>{s.studentName}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
`;

// 5. PassOutStudents.js
const passOutStudentsCode = `import React, { useState, useEffect } from 'react';
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
    if (window.confirm(\`Mark \${selectedIds.size} students as Passed Out?\`)) {
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
      toast.success(\`Passed out \${success} students\`);
      fetchEligibleStudents();
    }
  };

  return (
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
  );
}
`;

fs.writeFileSync(path.join(generalDir, 'RegulationMapping.js'), regulationMappingCode);
fs.writeFileSync(path.join(generalDir, 'StudentDetails.js'), studentDetailsCode);
fs.writeFileSync(path.join(generalDir, 'FacultyDetails.js'), facultyDetailsCode);
fs.writeFileSync(path.join(generalDir, 'PromoteStudent.js'), promoteStudentCode);
fs.writeFileSync(path.join(generalDir, 'PassOutStudents.js'), passOutStudentsCode);

console.log("General Configuration Pages implemented");
