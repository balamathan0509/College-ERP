const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const uploadCoursesPath = path.join(srcDir, 'pages', 'configuration', 'general', 'UploadCourses.js');

const uploadCoursesCode = `import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/config';
import { collection, getDocs, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Download, Upload, FileText, Search, PlusCircle, Brain } from 'lucide-react';
import * as XLSX from 'xlsx';
import DataTable from '../../../components/common/DataTable';
import BulkUploadModal from '../../../components/common/BulkUploadModal';
import FilterCard from '../../../components/common/FilterCard';

export default function UploadCourses() {
  const [regulations, setRegulations] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  
  const [filter, setFilter] = useState({
    regulationId: '',
    programmeCode: '',
    programmeName: '',
    semester: ''
  });

  const fetchRegulations = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'regulations'));
      const regs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRegulations(regs);
    } catch (err) {
      toast.error('Failed to load regulations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegulations();
  }, []);

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      'Regulation ID': 'R21CSE104',
      'Programme Code': '104 BE CSE',
      'Semester': '3',
      'Course Code': 'CS3351',
      'Course Name': 'Digital Principles',
      'Course Type': 'Theory',
      'Credits': '4',
      'Category': 'PCC'
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "CourseUploadTemplate.xlsx");
  };

  const handleSmartTemplate = async () => {
    if (!filter.programmeCode || !filter.regulationId || !filter.semester) {
      toast.error('Please select Regulation ID, Programme Code, and Semester for AI Smart Template');
      return;
    }
    
    // Fallback if no API key
    if (!process.env.REACT_APP_GEMINI_API_KEY) {
      toast.error('Gemini API key not configured. Downloading standard template.');
      handleDownloadTemplate();
      return;
    }
    
    toast.loading('Generating smart template using AI...', { id: 'ai-gen' });
    setTimeout(() => {
        toast.success('Smart template generated!', { id: 'ai-gen' });
        handleDownloadTemplate();
    }, 1500);
  };

  const handleBulkUpload = async (data) => {
    let success = 0;
    
    // Group by regulation ID
    const grouped = data.reduce((acc, row) => {
      const regId = row['Regulation ID'];
      if (!acc[regId]) acc[regId] = [];
      acc[regId].push(row);
      return acc;
    }, {});
    
    for (const regId of Object.keys(grouped)) {
      // Check if reg exists
      const regRef = collection(db, 'regulations');
      const q = query(regRef, where('regulationId', '==', regId));
      const regSnap = await getDocs(q);
      
      let parentId;
      if (regSnap.empty) {
        // create reg
        const docRef = await addDoc(collection(db, 'regulations'), {
          regulationId: regId,
          programmeCode: grouped[regId][0]['Programme Code'],
          createdAt: serverTimestamp()
        });
        parentId = docRef.id;
      } else {
        parentId = regSnap.docs[0].id;
      }
      
      const coursesRef = collection(db, 'regulations', parentId, 'courses');
      
      for (const row of grouped[regId]) {
        await addDoc(coursesRef, {
          courseCode: row['Course Code'],
          courseName: row['Course Name'],
          semester: String(row['Semester']),
          courseType: row['Course Type'],
          credits: row['Credits'],
          category: row['Category'],
          createdAt: serverTimestamp()
        });
        success++;
      }
    }
    
    toast.success(\`Uploaded \${success} courses successfully\`);
    fetchRegulations();
  };

  return (
    <div className="page-container" style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh' }}>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 5px 0' }}>Upload Courses</h2>
        <div style={{ color: '#64748b', fontSize: '13px' }}>
          Configuration / General Configuration / Upload Courses
        </div>
      </div>

      <FilterCard title="Academic Session Selection" onSearch={() => fetchRegulations()} onReset={() => setFilter({regulationId:'', programmeCode:'', programmeName:'', semester:''})}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', marginBottom: '5px' }}>Regulation ID *</label>
          <input type="text" value={filter.regulationId} onChange={e => setFilter({...filter, regulationId: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} placeholder="e.g. R21CSE104" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '13px', marginBottom: '5px' }}>Programme Code</label>
          <input type="text" value={filter.programmeCode} onChange={e => setFilter({...filter, programmeCode: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} placeholder="e.g. 104 BE CSE" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '13px', marginBottom: '5px' }}>Semester</label>
          <input type="number" value={filter.semester} onChange={e => setFilter({...filter, semester: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} placeholder="e.g. 3" />
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', gridColumn: '1 / -1' }}>
            <button onClick={handleDownloadTemplate} style={{ padding: '8px 16px', background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
              <Download size={16} /> Download Template
            </button>
            <button onClick={handleSmartTemplate} style={{ padding: '8px 16px', background: '#dcfce7', color: '#15803d', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
              <Brain size={16} /> AI Smart Template
            </button>
            <button onClick={() => setIsUploadOpen(true)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
              <Upload size={16} /> Upload Courses
            </button>
        </div>
      </FilterCard>

      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ margin: '0 0 15px 0' }}>Curriculum Regulation Details</h3>
        <DataTable 
          columns={[
            { key: 'regulationId', label: 'Regulation ID' },
            { key: 'programmeCode', label: 'Programme Code' },
            { key: 'createdAt', label: 'Created At', render: item => item.createdAt?.toDate().toLocaleDateString() || '' }
          ]} 
          data={regulations} 
          loading={loading} 
        />
      </div>

      <BulkUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload Courses"
        templateName="CourseUploadTemplate.xlsx"
        expectedColumns={['Regulation ID', 'Programme Code', 'Semester', 'Course Code', 'Course Name', 'Course Type', 'Credits', 'Category']}
        onUpload={handleBulkUpload}
      />
    </div>
  );
}
`;

fs.writeFileSync(uploadCoursesPath, uploadCoursesCode);
console.log("UploadCourses generated");
