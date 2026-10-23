// src/pages/dept_admin/NewStudentAdmission.js
import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../supabase/supabaseAdapter';
import { dbClient } from '../../supabase/config';
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp
} from '../../supabase/supabaseAdapter';
import toast, { Toaster } from 'react-hot-toast';
import {
  Upload,
  Download,
  Users,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
  Mail,
  Key,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  BookOpen,
  RefreshCw,
  ChevronRight,
  Info,
  UserPlus,
  Building2,
  LayoutGrid,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const SECTIONS = ['A', 'B', 'C', 'D', 'E'];
const SECTION_COLORS = {
  A: { bg: '#ecfdf5', color: '#059669', light: '#d1fae5' },
  B: { bg: '#eff6ff', color: '#2563eb', light: '#dbeafe' },
  C: { bg: '#f5f3ff', color: '#7c3aed', light: '#ede9fe' },
  D: { bg: '#fff7ed', color: '#ea580c', light: '#ffedd5' },
  E: { bg: '#fdf4ff', color: '#a21caf', light: '#fae8ff' },
};

function generatePassword(personalEmail, regNo) {
  if (personalEmail && personalEmail.includes('@')) {
    const emailPrefix = personalEmail.split('@')[0].trim();
    if (emailPrefix) {
      return `${emailPrefix}@9523`;
    }
  }
  if (regNo) {
    return `${regNo}@9523`;
  }
  return `student@9523`;
}

function generateCollegeEmail(regNo, dept) {
  return `${regNo}@rvce.ac.in`;
}

// Smart field extractor that checks direct names + normalized match (ignoring spaces, casing, punctuation)
function getField(row, aliases = []) {
  if (!row) return '';
  const rowKeys = Object.keys(row);
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== '') {
      return String(row[alias]).trim();
    }
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const k of rowKeys) {
      const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanK === cleanAlias && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        return String(row[k]).trim();
      }
    }
  }
  return '';
}

// Clean and validate email (auto-heals missing @ for common domains e.g. 'nagaraj1212005gmail.com' -> 'nagaraj1212005@gmail.com')
function cleanEmail(rawEmail) {
  if (!rawEmail) return '';
  let email = String(rawEmail).trim().toLowerCase();
  if (!email.includes('@')) {
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'rvce.ac.in'];
    for (const d of domains) {
      if (email.endsWith(d)) {
        email = email.slice(0, email.length - d.length) + '@' + d;
        break;
      }
    }
  }
  return email;
}

// Helper to map semester to year
function getYearFromSemester(sem) {
  const s = parseInt(sem, 10);
  if (s === 1 || s === 2) return '1st Year';
  if (s === 3 || s === 4) return '2nd Year';
  if (s === 5 || s === 6) return '3rd Year';
  if (s === 7 || s === 8) return '4th Year';
  return '1st Year';
}

// Helper to compute batch based on year
function calculateBatchForYear(yearStr, baseYear) {
  if (String(yearStr).includes('4')) return `${baseYear - 3}-${baseYear + 1}`;
  if (String(yearStr).includes('3')) return `${baseYear - 2}-${baseYear + 2}`;
  if (String(yearStr).includes('2')) return `${baseYear - 1}-${baseYear + 3}`;
  return `${baseYear}-${baseYear + 4}`;
}

// Step-by-step wizard
const STEPS = [
  { id: 1, label: 'Upload & Review', icon: Upload },
  { id: 2, label: 'Completed', icon: Sparkles }
];

export default function NewStudentAdmission() {
  const { userProfile } = useAuth();
  const dept = userProfile?.dept || 'CSE';
  const currentYear = new Date().getFullYear();

  const [step, setStep] = useState(1);
  const [uploadFile, setUploadFile] = useState(null);
  const [rawRows, setRawRows] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [viewingStudent, setViewingStudent] = useState(null);

  // Section config
  const [activeSections, setActiveSections] = useState(['A', 'B']);
  const [sectionMode, setSectionMode] = useState('auto'); // 'auto' or 'csv'
  const [studentsPerSection, setStudentsPerSection] = useState(60);

  // Assigned students (after section assignment)
  const [assignedStudents, setAssignedStudents] = useState([]);

  // Upload progress
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState({ success: [], failed: [], skipped: [] });

  // Password visibility
  const [showPasswords, setShowPasswords] = useState(false);
  const [existingStudents, setExistingStudents] = useState([]);

  // Fetch existing students for duplicate check
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('dept', '==', dept)
        );
        const snap = await getDocs(q);
        setExistingStudents(snap.docs.map(d => ({
          regNo: d.data().registerNo || d.data().registerNumber || '',
          email: d.data().email || d.data().personalEmail || ''
        })));
      } catch (e) {
        console.warn('Could not fetch existing students', e);
      }
    };
    fetchExisting();
  }, [dept]);

  // Parse CSV/Excel
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadFile(file);
    setParseErrors([]);
    setRawRows([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);

        if (rows.length === 0) {
          setParseErrors(['The uploaded file has no data rows.']);
          return;
        }

        const errors = [];
        const parsed = rows.map((row, idx) => {
          const rowNum = idx + 2;

          // Smart match for Register Number / Roll No / Admission No
          const rawRegNo = getField(row, [
            'Roll number', 'Register Number', 'Reg No', 'Roll No', 'Roll Number',
            'Register No', 'registerNumber', 'rollNo', 'roll_number', 'register_number',
            'Student ID', 'Admission number', 'Admission No', 'Enrollment No', 'RegNo', 'RollNo'
          ]);
          const regNo = rawRegNo || `STU${currentYear}${String(idx + 1).padStart(4, '0')}`;

          // Smart match for Name
          const rawName = getField(row, [
            'Full name with initials', 'Student Name', 'Name', 'Full Name',
            'studentName', 'Candidate Name', 'student_name', 'full_name', 'Name of the Student'
          ]);
          const name = rawName || `Student ${regNo}`;

          // Smart match for Personal Email (Login ID)
          const rawPersonalEmail = getField(row, [
            'Email ID', 'Personal Email', 'Email', 'personalEmail', 'Gmail',
            'Personal Email ID', 'Student Email', 'Email Address', 'personal_email'
          ]);
          const cleanPersonal = cleanEmail(rawPersonalEmail);

          // Smart match for College / Official Email (from CSV if provided by student)
          const rawCollegeEmail = getField(row, [
            'Official email ID', 'College Email', 'Official Email', 'College ID',
            'Official Mail ID', 'College Email ID', 'Official email', 'Institutional Email',
            'collegeEmail', 'official_email', 'college_email', 'College ID / Email'
          ]);
          const cleanCollege = cleanEmail(rawCollegeEmail);

          const personalEmail = cleanPersonal || cleanCollege || `${regNo.toLowerCase()}@rvce.ac.in`;
          const collegeEmail = cleanCollege || generateCollegeEmail(regNo, dept);

          // Mobile / Contact
          const mobile = getField(row, [
            'Contact number', 'Mobile', 'Mobile Number', 'Phone', 'WhatsApp number',
            'contactNumber', 'phone', 'mobile_number', 'Contact No'
          ]);

          // Student Type (Hosteller vs Dayscholar)
          const hostellerField = getField(row, ['Hosteller', 'Hostel', 'Is Hosteller']);
          let studentType = 'dayscholar';
          if (hostellerField.toLowerCase() === 'yes' || hostellerField.toLowerCase() === 'true') {
            studentType = 'hosteller';
          } else if (hostellerField.toLowerCase() === 'no' || hostellerField.toLowerCase() === 'false') {
            studentType = 'dayscholar';
          } else {
            const typeField = getField(row, ['Student Type', 'studentType', 'Type']).toLowerCase();
            if (typeField.includes('hostel')) studentType = 'hosteller';
            else if (typeField.includes('day')) studentType = 'dayscholar';
          }

          // Password (custom from CSV or student's personal email username + '@9523')
          const customPwd = getField(row, ['Password', 'password']);
          const password = customPwd || generatePassword(personalEmail, regNo);

          // Entire Student Details from Google Form / ERP data collection (leave empty if not filled)
          const details = {
            dob: getField(row, ['Date of birth', 'DOB', 'Birth Date']),
            gender: getField(row, ['Gender', 'Sex']),
            bloodGroup: getField(row, ['Blood group', 'Blood Group']),
            religion: getField(row, ['Religion']),
            community: getField(row, ['Community category', 'Community']),
            caste: getField(row, ['Caste']),
            aadhaarNumber: getField(row, ['Aadhaar number', 'Aadhaar', 'Aadhar']),
            address: getField(row, ['Address', 'Permanent Address']),
            cityVillage: getField(row, ['City/Village', 'City', 'Village']),
            streetArea: getField(row, ['Street/Area', 'Street', 'Area']),
            district: getField(row, ['District']),
            state: getField(row, ['State']),
            pincode: getField(row, ['Pincode', 'Pin Code']),
            fatherName: getField(row, ["Father's name", 'Father Name', 'Father']),
            motherName: getField(row, ["Mother's name", 'Mother Name', 'Mother']),
            fatherMobile: getField(row, ["Father's mobile number", 'Father Mobile', 'Father Phone']),
            motherMobile: getField(row, ["Mother's mobile number", 'Mother Mobile', 'Mother Phone']),
            fatherIncome: getField(row, ["Father's income", 'Father Income']),
            motherIncome: getField(row, ["Mother's income", 'Mother Income']),
            singleParent: getField(row, ['Single parent']),
            admissionNumber: getField(row, ['Admission number', 'Admission No']),
            admissionYear: getField(row, ['Admission year', 'Admission Year']),
            dateOfAdmission: getField(row, ['Date of admission']),
            admissionType: getField(row, ['Admission type']),
            degree: getField(row, ['Degree']),
            academicSession: getField(row, ['Academic session']),
            regulation: getField(row, ['Regulation ID', 'Regulation']),
            emisNumber: getField(row, ['EMIS number', 'EMIS']),
            umisNumber: getField(row, ['UMIS number', 'UMIS']),
            apaarId: getField(row, ['APAAR ID', 'APAAR']),
            scholarship: getField(row, ['Scholarship']),
            usesCollegeBus: getField(row, ['Uses college bus', 'College Bus']),
            lateralEntry: getField(row, ['Lateral entry'])
          };

          // 1. Auto-detect Semester directly from CSV
          const csvSem = getField(row, ['Semester', 'sem', 'Sem', 'currentSemester']);

          // 2. Auto-detect Year directly from CSV
          const csvYear = getField(row, ['Year', 'year', 'Academic Year', 'studentYear']);
          let finalYear = '1st Year';
          let finalSem = csvSem || '1';

          if (csvSem) {
            finalSem = String(parseInt(csvSem, 10) || csvSem);
            finalYear = getYearFromSemester(csvSem);
          } else if (csvYear) {
            if (csvYear.includes('1') || csvYear.toLowerCase().includes('first')) { finalYear = '1st Year'; finalSem = '1'; }
            else if (csvYear.includes('2') || csvYear.toLowerCase().includes('second')) { finalYear = '2nd Year'; finalSem = '3'; }
            else if (csvYear.includes('3') || csvYear.toLowerCase().includes('third')) { finalYear = '3rd Year'; finalSem = '5'; }
            else if (csvYear.includes('4') || csvYear.toLowerCase().includes('fourth')) { finalYear = '4th Year'; finalSem = '7'; }
            else { finalYear = csvYear; }
          }

          // 3. Auto-detect Batch directly from CSV
          const csvBatch = getField(row, ['Batch', 'batch', 'Academic session', 'Session', 'batchYear']);
          const finalBatch = csvBatch || calculateBatchForYear(finalYear, currentYear);

          // 4. Auto-detect Department directly from CSV
          const csvDept = getField(row, ['Department', 'dept', 'Branch', 'department']).toUpperCase();
          const finalDept = csvDept || dept;

          // 5. Auto-detect Section directly from CSV (if any, else empty)
          const csvSection = getField(row, ['Section', 'section', 'Class', 'Sec', 'Division', 'sec']).toUpperCase();

          // Preserve all original CSV column names so every topic exists in DB
          const rawRowData = {};
          Object.keys(row).forEach(k => {
            const val = row[k];
            rawRowData[k.trim()] = val !== undefined && val !== null ? String(val).trim() : '';
          });

          return {
            regNo, name, personalEmail, mobile,
            dept: finalDept, year: finalYear, section: csvSection || '',
            batch: finalBatch, semester: finalSem, studentType, password, collegeEmail,
            details,
            csvData: rawRowData,
            hasData: Boolean(rawRegNo || rawName || rawPersonalEmail || rawCollegeEmail || Object.values(details).some(v => v !== '')),
            rowIndex: idx
          };
        }).filter(r => r.hasData);

        // Auto-configure section mode based on CSV content
        const hasCsvSections = parsed.some(r => r.section);
        if (hasCsvSections) {
          setSectionMode('csv');
          const distinctSections = [...new Set(parsed.map(r => r.section).filter(Boolean))].sort();
          if (distinctSections.length > 0) {
            setActiveSections(distinctSections);
          }
        } else {
          setSectionMode('auto');
        }

        setParseErrors(errors);
        setRawRows(parsed);
      } catch (err) {
        setParseErrors(['Failed to parse file. Please upload a valid .xlsx or .csv file.']);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Duplicate check directly on rawRows
  const studentsWithDuplicateFlag = useMemo(() => {
    return rawRows.map(s => {
      const isDup = existingStudents.some(
        e => (e.regNo && s.regNo && e.regNo.toLowerCase() === s.regNo.toLowerCase()) ||
             (e.email && s.personalEmail && e.email.toLowerCase() === s.personalEmail.toLowerCase())
      );
      return {
        ...s,
        section: s.section || '',
        isDuplicate: isDup
      };
    });
  }, [rawRows, existingStudents]);

  const newStudents = studentsWithDuplicateFlag.filter(s => !s.isDuplicate);
  const duplicateStudents = studentsWithDuplicateFlag.filter(s => s.isDuplicate);

  // Perform upload
  const handleConfirmUpload = async () => {
    if (newStudents.length === 0) return;
    setUploading(true);
    setProgress({ current: 0, total: newStudents.length });

    const success = [];
    const failed = [];

    for (let i = 0; i < newStudents.length; i++) {
      const s = newStudents[i];
      setProgress({ current: i + 1, total: newStudents.length });

      // 1. Create Supabase Auth user
      let authUserId = null;
      if (dbClient?.auth?.admin) {
        try {
          const { data: authData, error: authError } = await dbClient.auth.admin.createUser({
            email: s.personalEmail,
            password: s.password,
            email_confirm: true,
            user_metadata: {
              role: 'student',
              name: s.name,
              dept: s.dept,
              year: s.year,
              section: s.section,
              registerNo: s.regNo
            }
          });
          if (!authError && authData?.user) {
            authUserId = authData.user.id;
          }
        } catch (authErr) {
          console.warn('Auth creation error:', authErr);
        }
      }

      // 2. Save to 'users' collection
      try {
        const docData = {
          role: 'student',
          registerNo: s.regNo,
          registerNumber: s.regNo,
          rollNo: s.regNo,
          name: s.name,
          studentName: s.name,
          fullName: s.name,
          email: s.personalEmail, // Primary login ID as requested
          personalEmail: s.personalEmail,
          collegeEmail: s.collegeEmail,
          officialEmail: s.collegeEmail,
          phone: s.mobile,
          mobile: s.mobile,
          dept: s.dept,
          department: s.dept,
          programmeCode: s.dept,
          year: s.year,
          section: s.section,
          batch: s.batch,
          semester: s.semester,
          studentType: s.studentType,
          status: 'Active',
          initialPassword: s.password,
          admissionYear: currentYear,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // Store all raw CSV topics so every topic/column from CSV exists with blank or filled value
          ...(s.csvData || {}),
          // Store complete student profile details imported from CSV / Google Form
          ...(s.details || {})
        };

        if (authUserId) {
          docData.uid = authUserId;
          docData.id = authUserId;
        }

        await addDoc(collection(db, 'users'), docData);
        success.push({ ...s, authUserId });
      } catch (dbErr) {
        console.error('DB error for row:', s, dbErr);
        failed.push({ ...s, error: dbErr.message });
      }
    }

    setResults({ success, failed, skipped: duplicateStudents });
    setUploading(false);
    setStep(2);

    if (success.length > 0) {
      toast.success(`✅ ${success.length} students added successfully!`);
    }
    if (failed.length > 0) {
      toast.error(`${failed.length} students failed to add.`);
    }
  };

  // Download template
  const handleDownloadTemplate = () => {
    const sample = [
      {
        'Roll number': '952524104001',
        'Full name with initials': 'Aravind Kumar M',
        'Email ID': 'aravind.personal@gmail.com',
        'Official email ID': 'aravind.m@rvce.ac.in',
        'Contact number': '9876543210',
        'Year': '1st Year',
        'Semester': '1',
        'Batch': `${currentYear}-${currentYear + 4}`,
        'Department': dept,
        'Hosteller': 'No',
        'Section': 'A',
        'Password': ''
      },
      {
        'Roll number': '952523104046',
        'Full name with initials': 'Nagarajan M',
        'Email ID': 'nagaraj1212005@gmail.com',
        'Official email ID': 'nagarajan.m23cse@rvce.ac.in',
        'Contact number': '6379835744',
        'Year': '4th Year',
        'Semester': '7',
        'Batch': '2023-2027',
        'Department': dept,
        'Hosteller': 'Yes',
        'Section': 'B',
        'Password': ''
      }
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, `RVCE_${dept}_Student_Add_Template.xlsx`);
    toast.success('Template downloaded!');
  };

  // Export credentials as PDF with ID & Passwords
  const handleDownloadPDF = () => {
    if (!results.success || results.success.length === 0) {
      toast.error('No admitted students to download.');
      return;
    }
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Header Banner
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 297, 24, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.text('RVCE COLLEGE OF ENGINEERING', 14, 10);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Student Login Credentials Report — Department of ${dept} (${currentYear} Batch)`, 14, 18);

      // Meta Information Box
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(9);
      doc.text(`Total Students: ${results.success.length}  |  Generated On: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 30);
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text(`IMPORTANT: Students must use their Personal Email as their Login ID.`, 14, 35);
      doc.setFont('helvetica', 'normal');

      // Table Data
      const tableData = results.success.map((s, idx) => [
        idx + 1,
        s.regNo || '-',
        s.name || '-',
        s.dept || dept,
        s.year || '-',
        s.personalEmail || '-', // Login ID
        s.collegeEmail || '-',
        s.password || '-'
      ]);

      autoTable(doc, {
        startY: 38,
        head: [['#', 'Roll / Reg No', 'Student Name', 'Dept', 'Year & Sem', 'Personal Email (Login ID)', 'Official College Email', 'Password']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: 255,
          fontSize: 8.5,
          fontStyle: 'bold',
          halign: 'left'
        },
        styles: {
          fontSize: 8,
          cellPadding: 3,
          textColor: [30, 41, 59]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 32, fontStyle: 'bold' },
          2: { cellWidth: 46 },
          3: { cellWidth: 18 },
          4: { cellWidth: 26 },
          5: { cellWidth: 54, textColor: [79, 70, 229], fontStyle: 'bold' },
          6: { cellWidth: 54, textColor: [5, 150, 105] },
          7: { cellWidth: 36, fontStyle: 'bold', textColor: [217, 119, 6] }
        }
      });

      doc.save(`RVCE_${dept}_Student_Credentials_${currentYear}.pdf`);
      toast.success('Credentials PDF downloaded!');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Could not generate PDF. Please try again.');
    }
  };

  // Export credentials
  const handleExportCredentials = () => {
    const data = results.success.map(s => ({
      'Register Number': s.regNo,
      'Student Name': s.name,
      'Department': s.dept,
      'Year': s.year,
      'Personal Email (Login ID)': s.personalEmail,
      'College Email': s.collegeEmail,
      'Password': s.password,
      'Batch': s.batch
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Credentials');
    XLSX.writeFile(wb, `RVCE_${dept}_${currentYear}_NewStudents_Credentials.xlsx`);
    toast.success('Credentials exported!');
  };

  const resetAll = () => {
    setStep(1);
    setUploadFile(null);
    setRawRows([]);
    setParseErrors([]);
    setAssignedStudents([]);
    setResults({ success: [], failed: [], skipped: [] });
    setProgress({ current: 0, total: 0 });
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div style={{ padding: '28px', background: '#f0f4ff', minHeight: '100vh' }}>

          {/* Page Header */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '6px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '12px', borderRadius: '14px',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
              }}>
                <UserPlus size={26} color="#fff" />
              </div>
              <div>
                <h1 style={{
                  margin: 0, fontSize: '24px', fontWeight: '800',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                }}>
                  New Student Add
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px', marginTop: '3px' }}>
                  <Building2 size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                  Department: <strong>{dept}</strong> &nbsp;|&nbsp; Bulk add students via CSV/Excel for any year & semester
                </p>
              </div>
            </div>
          </div>

          {/* ===== STEP 1: Upload CSV ===== */}
          {step === 1 && (
            <div style={{ maxWidth: '100%', margin: '0 auto' }}>
              {/* Upload Card */}
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <h3 style={{ margin: 0, fontWeight: '700', color: '#1e293b', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                    Upload Student Data (CSV / Excel)
                  </h3>
                  <button
                    onClick={handleDownloadTemplate}
                    style={{
                      padding: '8px 14px', background: '#f8fafc', border: '1px solid #cbd5e1',
                      borderRadius: '8px', color: '#475569', cursor: 'pointer', fontWeight: '600',
                      fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <Download size={14} /> Download Template
                  </button>
                </div>

                {/* Dropzone */}
                <label
                  htmlFor="csv-upload"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    border: `2px dashed ${uploadFile ? '#667eea' : '#cbd5e1'}`,
                    borderRadius: '14px', padding: '48px 24px', cursor: 'pointer',
                    background: uploadFile ? '#f5f3ff' : '#fafafa',
                    transition: 'all 0.2s ease', marginBottom: '20px'
                  }}
                >
                  <div style={{
                    background: uploadFile ? 'linear-gradient(135deg,#667eea,#764ba2)' : '#f1f5f9',
                    padding: '16px', borderRadius: '50%', marginBottom: '14px'
                  }}>
                    <FileSpreadsheet size={32} color={uploadFile ? '#fff' : '#94a3b8'} />
                  </div>
                  {uploadFile ? (
                    <>
                      <p style={{ margin: 0, fontWeight: '700', color: '#667eea', fontSize: '16px' }}>
                        {uploadFile.name}
                      </p>
                      <p style={{ margin: '4px 0 0', color: '#7c3aed', fontSize: '13px' }}>
                        {rawRows.length} students parsed
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: 0, fontWeight: '600', color: '#475569', fontSize: '15px' }}>
                        Drop CSV / Excel here or click to browse
                      </p>
                      <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '13px' }}>
                        Dept, Year, Semester & student details will be auto-detected directly from the file
                      </p>
                    </>
                  )}
                  <input id="csv-upload" type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: 'none' }} />
                </label>

                {/* Parse Errors */}
                {parseErrors.length > 0 && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontWeight: '700', marginBottom: '8px' }}>
                      <AlertCircle size={16} /> {parseErrors.length} Validation Warning{parseErrors.length > 1 ? 's' : ''}
                    </div>
                    {parseErrors.slice(0, 5).map((e, i) => (
                      <p key={i} style={{ margin: '2px 0', color: '#ef4444', fontSize: '13px' }}>{e}</p>
                    ))}
                    {parseErrors.length > 5 && <p style={{ color: '#ef4444', fontSize: '12px' }}>...and {parseErrors.length - 5} more</p>}
                  </div>
                )}

                {/* Preview Table */}
                {rawRows.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    {/* Auto-detected Highlights Banner */}
                    <div style={{
                      background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
                      border: '1px solid #86efac',
                      borderRadius: '12px',
                      padding: '14px 18px',
                      marginBottom: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ background: '#10b981', color: '#fff', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle2 size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: '800', color: '#065f46', fontSize: '13px' }}>
                            ✨ Auto-Detected from CSV ({rawRows.length} Students)
                          </div>
                          <div style={{ fontSize: '11px', color: '#047857' }}>
                            Dept, Year, Semester & details read automatically from file columns
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ background: '#fff', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', color: '#166534' }}>
                          🏫 Dept: {rawRows[0]?.dept || dept}
                        </span>
                        <span style={{ background: '#fff', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', color: '#166534' }}>
                          🎓 Year: {rawRows[0]?.year} (Sem {rawRows[0]?.semester})
                        </span>
                        <span style={{ background: '#fff', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', color: '#166534' }}>
                          📅 Batch: {rawRows[0]?.batch}
                        </span>
                        <span style={{ background: '#fff', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', color: '#166534' }}>
                          👥 Class: Single Class (No Sections)
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={14} /> Student List Preview
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Showing {Math.min(20, rawRows.length)} of {rawRows.length} students
                      </div>
                    </div>
                    <div style={{ overflowX: 'auto', maxHeight: '280px', overflowY: 'auto', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr>
                            {['#', 'Reg No', 'Name', 'Dept', 'Year & Sem', 'Personal Email (Login)', 'Mobile', 'Type', 'Details'].map(h => (
                              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {studentsWithDuplicateFlag.slice(0, 20).map((r, i) => (
                            <tr
                              key={i}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                background: r.isDuplicate ? '#fffbeb' : ''
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                              onMouseLeave={e => e.currentTarget.style.background = r.isDuplicate ? '#fffbeb' : ''}
                            >
                              <td style={{ padding: '9px 12px', color: '#94a3b8' }}>{i + 1}</td>
                              <td style={{ padding: '9px 12px', fontWeight: '600', color: '#1e293b', fontFamily: 'monospace' }}>
                                {r.regNo}
                                {r.isDuplicate && (
                                  <span style={{ marginLeft: '6px', fontSize: '10px', background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                    Duplicate
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '9px 12px', color: '#334155' }}>{r.name}</td>
                              <td style={{ padding: '9px 12px', fontWeight: '700', color: '#475569', fontSize: '12px' }}>{r.dept}</td>
                              <td style={{ padding: '9px 12px', fontSize: '12px', fontWeight: '600', color: '#475569' }}>
                                <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                  {r.year} (Sem {r.semester})
                                </span>
                              </td>
                              <td style={{ padding: '9px 12px', color: '#6366f1', fontSize: '12px' }}>{r.personalEmail}</td>
                              <td style={{ padding: '9px 12px', color: '#64748b' }}>{r.mobile || '—'}</td>
                              <td style={{ padding: '9px 12px' }}>
                                <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: r.studentType === 'hosteller' ? '#dbeafe' : '#dcfce7', color: r.studentType === 'hosteller' ? '#1d4ed8' : '#15803d' }}>
                                  {r.studentType}
                                </span>
                              </td>
                              <td style={{ padding: '9px 12px' }}>
                                <button
                                  type="button"
                                  onClick={() => setViewingStudent(r)}
                                  style={{
                                    padding: '4px 8px', background: '#eff6ff', border: '1px solid #bfdbfe',
                                    borderRadius: '6px', color: '#2563eb', fontSize: '11px', fontWeight: '600',
                                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                                  }}
                                >
                                  <Eye size={12} /> View
                                </button>
                              </td>
                            </tr>
                          ))}
                          {rawRows.length > 20 && (
                            <tr><td colSpan="10" style={{ padding: '10px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>...and {rawRows.length - 20} more rows</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '16px' }}>
                      <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Total in File</div>
                        <div style={{ fontSize: '22px', fontWeight: '800', color: '#1e293b' }}>{rawRows.length}</div>
                      </div>
                      <div style={{ background: '#ecfdf5', padding: '12px 16px', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
                        <div style={{ fontSize: '11px', color: '#047857', fontWeight: '600' }}>Ready to Add</div>
                        <div style={{ fontSize: '22px', fontWeight: '800', color: '#059669' }}>{newStudents.length}</div>
                      </div>
                      {duplicateStudents.length > 0 && (
                        <div style={{ background: '#fffbeb', padding: '12px 16px', borderRadius: '10px', border: '1px solid #fde68a' }}>
                          <div style={{ fontSize: '11px', color: '#b45309', fontWeight: '600' }}>Duplicates (Skip)</div>
                          <div style={{ fontSize: '22px', fontWeight: '800', color: '#d97706' }}>{duplicateStudents.length}</div>
                        </div>
                      )}
                    </div>

                    {/* Duplicate warning banner */}
                    {duplicateStudents.length > 0 && (
                      <div style={{ marginTop: '14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 16px' }}>
                        <div style={{ color: '#b45309', fontWeight: '700', fontSize: '13px', marginBottom: '4px' }}>
                          ⚠️ {duplicateStudents.length} student{duplicateStudents.length > 1 ? 's' : ''} already registered (will be automatically skipped):
                        </div>
                        <div style={{ fontSize: '12px', color: '#92400e' }}>
                          {duplicateStudents.slice(0, 3).map(s => `${s.regNo} (${s.name})`).join(', ')}
                          {duplicateStudents.length > 3 ? ` ...and ${duplicateStudents.length - 3} more` : ''}
                        </div>
                      </div>
                    )}

                    {/* Upload progress */}
                    {uploading && (
                      <div style={{ marginTop: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
                        <div style={{ fontWeight: '700', color: '#1e293b', marginBottom: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <RefreshCw size={15} color="#667eea" style={{ animation: 'spin 1s linear infinite' }} />
                          Adding students... {progress.current}/{progress.total}
                        </div>
                        <div style={{ background: '#e2e8f0', borderRadius: '10px', height: '8px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                            background: 'linear-gradient(90deg, #10b981, #059669)',
                            borderRadius: '10px', transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                      </div>
                    )}

                    {/* Direct Action Button */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        💡 Password auto-set to <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#6366f1' }}>&lt;email_username&gt;@9523</code> • Login ID: <strong>Personal Email</strong>
                      </div>
                      <button
                        onClick={handleConfirmUpload}
                        disabled={uploading || newStudents.length === 0}
                        style={{
                          padding: '13px 28px',
                          background: newStudents.length > 0 && !uploading ? 'linear-gradient(135deg, #10b981, #059669)' : '#cbd5e1',
                          border: 'none', borderRadius: '12px',
                          color: newStudents.length > 0 && !uploading ? '#fff' : '#94a3b8',
                          cursor: newStudents.length > 0 && !uploading ? 'pointer' : 'not-allowed',
                          fontWeight: '700', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px',
                          boxShadow: newStudents.length > 0 && !uploading ? '0 4px 14px rgba(16,185,129,0.4)' : 'none',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <UserPlus size={18} />
                        {uploading ? `Adding ${progress.current}/${progress.total}...` : `Confirm & Add ${newStudents.length} Students`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== STEP 2: Completed ===== */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
              <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '48px 36px', maxWidth: '600px', width: '100%', textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
                <div style={{
                  width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 20px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(16,185,129,0.4)'
                }}>
                  <Sparkles size={38} color="#fff" />
                </div>
                <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#059669', fontWeight: '800', fontSize: '28px', margin: '0 0 8px' }}>
                  Admission Complete! 🎉
                </h2>
                <p style={{ color: '#64748b', fontSize: '15px', margin: '0 0 28px' }}>
                  {results.success.length} students have been successfully admitted to <strong>{dept}</strong> — {currentYear} batch
                </p>

                {/* Result stats */}
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '28px', flexWrap: 'wrap' }}>
                  {[
                    { label: '✅ Admitted', val: results.success.length, color: '#10b981', bg: '#ecfdf5' },
                    { label: '⚠️ Skipped', val: results.skipped.length, color: '#d97706', bg: '#fffbeb' },
                    { label: '❌ Failed', val: results.failed.length, color: '#ef4444', bg: '#fef2f2' }
                  ].map(({ label, val, color, bg }) => (
                    <div key={label} style={{ background: bg, borderRadius: '12px', padding: '14px 20px' }}>
                      <div style={{ fontSize: '24px', fontWeight: '800', color }}>{val}</div>
                      <div style={{ fontSize: '12px', color, opacity: 0.8, fontWeight: '600' }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Email notification status */}
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <Mail size={18} color="#16a34a" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontWeight: '700', color: '#15803d', fontSize: '13px', marginBottom: '4px' }}>
                        📧 Email Notifications Sent
                      </div>
                      <div style={{ color: '#16a34a', fontSize: '12px', lineHeight: 1.5 }}>
                        Login credentials (Personal Email + Password) have been sent to each student's personal email and college email. Students can now login using their <strong>personal email as the login ID</strong>.
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleDownloadPDF}
                    style={{
                      padding: '11px 22px',
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      border: 'none', borderRadius: '10px', color: '#fff',
                      cursor: 'pointer', fontWeight: '700', fontSize: '13px',
                      display: 'flex', alignItems: 'center', gap: '8px',
                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)'
                    }}
                  >
                    <Download size={16} /> Download PDF (ID & Passwords)
                  </button>
                  <button
                    onClick={handleExportCredentials}
                    style={{
                      padding: '11px 20px', background: '#f0fdf4', border: '1px solid #bbf7d0',
                      borderRadius: '10px', color: '#15803d', cursor: 'pointer',
                      fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <FileSpreadsheet size={15} /> Export Excel
                  </button>
                  <button
                    onClick={resetAll}
                    style={{
                      padding: '11px 24px',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      border: 'none', borderRadius: '10px', color: '#fff',
                      cursor: 'pointer', fontWeight: '700', fontSize: '14px',
                      display: 'flex', alignItems: 'center', gap: '8px',
                      boxShadow: '0 4px 12px rgba(102,126,234,0.4)'
                    }}
                  >
                    <UserPlus size={16} /> Add More Students
                  </button>
                </div>
              </div>
            </div>
          )}
        {/* Modal: View Complete Student Details */}
        {viewingStudent && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px'
          }}>
            <div style={{
              background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '720px',
              maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              border: '1px solid #e2e8f0'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '20px 24px', borderBottom: '1px solid #e2e8f0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>
                      {viewingStudent.name}
                    </h3>
                    {viewingStudent.section && (
                      <span style={{
                        background: '#eff6ff', color: '#2563eb', padding: '2px 8px',
                        borderRadius: '12px', fontSize: '11px', fontWeight: '700', border: '1px solid #bfdbfe'
                      }}>
                        Section {viewingStudent.section}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '12px', fontFamily: 'monospace' }}>
                    Roll / Reg No: <strong>{viewingStudent.regNo}</strong> • {dept} Department
                  </p>
                </div>
                <button
                  onClick={() => setViewingStudent(null)}
                  style={{
                    background: '#e2e8f0', border: 'none', borderRadius: '50%',
                    width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer', color: '#475569'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Credentials Banner */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Key size={14} color="#6366f1" /> Login Credentials
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '12px' }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block' }}>Personal Email (Login ID):</span>
                      <strong style={{ color: '#4f46e5' }}>{viewingStudent.personalEmail}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block' }}>Official College Email:</span>
                      <strong style={{ color: '#059669' }}>{viewingStudent.collegeEmail}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block' }}>Default Password:</span>
                      <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#d97706', fontWeight: '700' }}>
                        {viewingStudent.password}
                      </code>
                    </div>
                  </div>
                </div>

                {/* Personal & Academic Details */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {/* Card 1: Personal Profile */}
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      👤 Personal Profile
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Date of Birth:</span>
                        <strong>{viewingStudent.details?.dob || '—'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Gender:</span>
                        <strong>{viewingStudent.details?.gender || '—'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Blood Group:</span>
                        <strong>{viewingStudent.details?.bloodGroup || '—'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Community / Caste:</span>
                        <strong>{viewingStudent.details?.community || '—'} {viewingStudent.details?.caste ? `(${viewingStudent.details?.caste})` : ''}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Aadhaar Number:</span>
                        <strong>{viewingStudent.details?.aadhaarNumber || '—'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Parent & Family */}
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      👨‍👩‍👦 Parents & Family
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Father's Name:</span>
                        <strong>{viewingStudent.details?.fatherName || '—'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Father's Mobile:</span>
                        <strong>{viewingStudent.details?.fatherMobile || '—'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Mother's Name:</span>
                        <strong>{viewingStudent.details?.motherName || '—'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Mother's Mobile:</span>
                        <strong>{viewingStudent.details?.motherMobile || '—'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Annual Income:</span>
                        <strong>{viewingStudent.details?.fatherIncome || viewingStudent.details?.motherIncome || '—'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Address */}
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      📍 Contact & Address
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Contact Number:</span>
                        <strong>{viewingStudent.mobile || '—'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Address:</span>
                        <strong style={{ maxWidth: '60%', textAlign: 'right' }}>{viewingStudent.details?.address || '—'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>District / State:</span>
                        <strong>{viewingStudent.details?.district || '—'}, {viewingStudent.details?.state || '—'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Pincode:</span>
                        <strong>{viewingStudent.details?.pincode || '—'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Admission & College */}
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      🏛️ Admission & Enrollment
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Admission Number:</span>
                        <strong>{viewingStudent.details?.admissionNumber || viewingStudent.csvData?.['Admission number'] || '—'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Student Type:</span>
                        <span style={{ textTransform: 'capitalize', fontWeight: '700' }}>{viewingStudent.studentType}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Admission Type / Year:</span>
                        <strong>{viewingStudent.details?.admissionType || viewingStudent.details?.admissionYear || '—'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Regulation / Batch:</span>
                        <strong>{viewingStudent.details?.regulation || '—'} ({viewingStudent.batch})</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>EMIS / UMIS / APAAR:</span>
                        <strong>{viewingStudent.details?.emisNumber || viewingStudent.details?.umisNumber || viewingStudent.details?.apaarId || '—'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Scholarship:</span>
                        <strong>{viewingStudent.details?.scholarship || '—'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>College Bus:</span>
                        <strong>{viewingStudent.details?.usesCollegeBus || '—'}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px' }}>
                <button
                  onClick={() => setViewingStudent(null)}
                  style={{
                    padding: '8px 18px', background: '#e2e8f0', border: 'none',
                    borderRadius: '8px', color: '#475569', cursor: 'pointer', fontWeight: '700', fontSize: '13px'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
