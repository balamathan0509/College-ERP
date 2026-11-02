import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useAuth } from '../../../context/AuthContext';
import { db } from "../../../supabase/supabaseAdapter";
import { dbClient } from "../../../supabase/config";
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  query, 
  where 
} from "../../../supabase/supabaseAdapter";
import toast, { Toaster } from 'react-hot-toast';
import { 
  Download, 
  Upload, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Users, 
  GraduationCap, 
  Key, 
  Mail, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Eye, 
  EyeOff, 
  Filter,
  ShieldCheck,
  Building2,
  RefreshCw,
  User,
  MapPin,
  FileCheck,
  Phone,
  Calendar,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';

const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "IT", "AIDS", "CIVIL"];
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const SECTIONS = ["", "A", "B", "C", "D"];

const EMPTY_STUDENT_FORM = {
  // Academic & Login
  registerNumber: '',
  studentName: '',
  personalEmail: '',
  collegeEmail: '',
  mobile: '',
  programmeCode: 'CSE',
  batch: '2024-2028',
  semester: '1',
  year: '1st Year',
  section: '',
  studentType: 'dayscholar',
  password: '',
  status: 'Active',
  // Personal & Identity
  dob: '',
  gender: '',
  bloodGroup: '',
  religion: '',
  community: '',
  caste: '',
  aadhaarNumber: '',
  // Parent & Family
  fatherName: '',
  motherName: '',
  fatherMobile: '',
  motherMobile: '',
  fatherIncome: '',
  motherIncome: '',
  singleParent: 'No',
  // Address & Residence
  address: '',
  streetArea: '',
  cityVillage: '',
  district: '',
  state: '',
  pincode: '',
  // Admission & Govt IDs
  admissionNumber: '',
  admissionYear: '',
  dateOfAdmission: '',
  admissionType: '',
  degree: 'B.E.',
  academicSession: '',
  regulation: '',
  emisNumber: '',
  umisNumber: '',
  apaarId: '',
  scholarship: '',
  usesCollegeBus: 'No',
  lateralEntry: 'No',
  csvData: {}
};

// Check if a section denotes a single class / no section
const isSingleClassSection = (rawSec) => {
  if (!rawSec) return true;
  const s = String(rawSec).trim().toUpperCase();
  return (
    !s ||
    s === 'NONE' ||
    s === 'SINGLE' ||
    s === 'SINGLE CLASS' ||
    s === 'NO' ||
    s === 'NO SECTION' ||
    s === 'NA' ||
    s === 'N/A' ||
    s === 'NIL' ||
    s === 'NULL' ||
    s === '.' ||
    s === '-' ||
    s === '--' ||
    s === '0' ||
    s.startsWith('NO ') ||
    s.startsWith('NOT ')
  );
};

// Smart year and semester detection
const detectYearAndSemester = (row, regNo, currentYear = 2026) => {
  const csvSem = row['Semester'] || row['semester'] || row['sem'] || row['Sem'] || row['currentSemester'];
  if (csvSem) {
    const semNum = parseInt(String(csvSem).replace(/\D/g, ''), 10);
    if (semNum >= 1 && semNum <= 8) {
      const yr = semNum <= 2 ? '1st Year' : semNum <= 4 ? '2nd Year' : semNum <= 6 ? '3rd Year' : '4th Year';
      return { year: yr, semester: String(semNum) };
    }
  }

  const csvYear = row['Year'] || row['year'] || row['Academic Year'] || row['studentYear'] || row['Class'];
  if (csvYear) {
    const y = String(csvYear).trim().toUpperCase();
    if (y.includes('4') || y.includes('FOURTH') || y.includes('FINAL') || y === 'IV') return { year: '4th Year', semester: '7' };
    if (y.includes('3') || y.includes('THIRD') || y === 'III') return { year: '3rd Year', semester: '5' };
    if (y.includes('2') || y.includes('SECOND') || y === 'II') return { year: '2nd Year', semester: '3' };
    if (y.includes('1') || y.includes('FIRST') || y === 'I') return { year: '1st Year', semester: '1' };
  }

  if (regNo && regNo.length >= 6) {
    const m = regNo.match(/9525(\d{2})/);
    if (m) {
      const joinYr = parseInt(m[1], 10);
      const diff = 26 - joinYr;
      if (diff <= 0) return { year: '1st Year', semester: '1' };
      if (diff === 1) return { year: '2nd Year', semester: '3' };
      if (diff === 2) return { year: '3rd Year', semester: '5' };
      if (diff >= 3) return { year: '4th Year', semester: '7' };
    }
  }

  return { year: '1st Year', semester: '1' };
};

// Normalize Department
const normalizeDepartment = (rawDept, regNo, fallbackDept = 'CSE') => {
  let d = String(rawDept || '').toUpperCase().trim();
  if (!d && regNo && regNo.length >= 9) {
    const codeMatch = regNo.match(/9525\d{2}(\d{3})/);
    if (codeMatch) {
      const code = codeMatch[1];
      if (code === '104') return 'CSE';
      if (code === '243' || code === '244') return 'AIDS';
      if (code === '106') return 'ECE';
      if (code === '105') return 'EEE';
      if (code === '205') return 'IT';
      if (code === '114') return 'MECH';
    }
  }
  if (!d) return fallbackDept;
  if (d === 'CSE' || d.includes('COMPUTER SCIENCE') || d.includes('COMP. SCI')) return 'CSE';
  if (d === 'AIDS' || d === 'AI&DS' || d === 'AI & DS' || d.includes('ARTIFICIAL') || d.includes('DATA SCIENCE')) return 'AIDS';
  if (d === 'ECE' || d.includes('ELECTRONICS') || d.includes('COMMUNICATION')) return 'ECE';
  if (d === 'EEE' || d.includes('ELECTRICAL')) return 'EEE';
  if (d === 'IT' || d.includes('INFORMATION TECH')) return 'IT';
  if (d === 'MECH' || d.includes('MECHANICAL')) return 'MECH';
  if (d === 'CSBS' || d.includes('BUSINESS SYSTEMS')) return 'CSBS';
  return d;
};

export default function StudentDetails() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('1st Year');
  const [selectedSection, setSelectedSection] = useState('All');
  const [selectedDept, setSelectedDept] = useState('All');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('academic');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);

  // Single Student Form Data
  const [formData, setFormData] = useState(EMPTY_STUDENT_FORM);

  // Bulk Upload State
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [defaultBatch, setDefaultBatch] = useState('2024-2028');
  const [defaultDept, setDefaultDept] = useState('CSE');
  const [defaultYear, setDefaultYear] = useState('1st Year');
  const [defaultSection, setDefaultSection] = useState('A');
  const [sectionMode, setSectionMode] = useState('csv'); // 'csv' or 'force'
  const [createAuthAccounts, setCreateAuthAccounts] = useState(true);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [createdCredentials, setCreatedCredentials] = useState([]);

  // Visibility of passwords in table
  const [revealedPasswords, setRevealedPasswords] = useState({});

  const { userProfile } = useAuth();

  // Set initial department based on user role
  useEffect(() => {
    if (userProfile?.dept && userProfile?.dept !== 'ALL') {
      setSelectedDept(userProfile.dept);
      setDefaultDept(userProfile.dept);
      setFormData(prev => ({ ...prev, programmeCode: userProfile.dept }));
    }
  }, [userProfile]);

  // Fetch all students from users table
  const fetchStudents = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'users'), where('role', '==', 'student'));
      const snap = await getDocs(q);
      let fetched = snap.docs.map(docObj => {
        const data = docObj.data();
        const rawSec = (data.section || '').toUpperCase().trim();
        const cleanSec = (['NO', '.', '-', 'N/A', 'NONE'].includes(rawSec) ? '' : rawSec);

        return {
          id: docObj.id,
          registerNumber: data.registerNo || data.registerNumber || '',
          studentName: data.name || data.studentName || '',
          personalEmail: data.personalEmail || data.email || '',
          collegeEmail: data.collegeEmail || '',
          mobile: data.phone || data.mobile || '',
          programmeCode: data.programmeCode || data.dept || '',
          batch: data.batch || '',
          semester: data.semester || '1',
          year: data.year === '1' ? '1st Year' : (data.year === '2' ? '2nd Year' : (data.year === '3' ? '3rd Year' : (data.year === '4' ? '4th Year' : (data.year || '1st Year')))),
          section: cleanSec,
          studentType: data.studentType || 'dayscholar',
          status: data.status || 'Active',
          initialPassword: data.initialPassword || data.password || `Rvce@${data.registerNo || data.registerNumber || '123'}`,
          // Personal & Identity
          dob: data.dob || '',
          gender: data.gender || '',
          bloodGroup: data.bloodGroup || '',
          religion: data.religion || '',
          community: data.community || '',
          caste: data.caste || '',
          aadhaarNumber: data.aadhaarNumber || '',
          // Parent & Family
          fatherName: data.fatherName || '',
          motherName: data.motherName || '',
          fatherMobile: data.fatherMobile || '',
          motherMobile: data.motherMobile || '',
          fatherIncome: data.fatherIncome || '',
          motherIncome: data.motherIncome || '',
          singleParent: data.singleParent || 'No',
          // Address & Residence
          address: data.address || '',
          streetArea: data.streetArea || '',
          cityVillage: data.cityVillage || '',
          district: data.district || '',
          state: data.state || '',
          pincode: data.pincode || '',
          // Admission & Govt IDs
          admissionNumber: data.admissionNumber || '',
          admissionYear: data.admissionYear || '',
          dateOfAdmission: data.dateOfAdmission || '',
          admissionType: data.admissionType || '',
          degree: data.degree || 'B.E.',
          academicSession: data.academicSession || '',
          regulation: data.regulation || '',
          emisNumber: data.emisNumber || '',
          umisNumber: data.umisNumber || '',
          apaarId: data.apaarId || '',
          scholarship: data.scholarship || '',
          usesCollegeBus: data.usesCollegeBus || 'No',
          lateralEntry: data.lateralEntry || 'No',
          csvData: data.csvData || data.rawRowData || {},
          ...data
        };
      });

      // Filter by dept if coordinator/HOD
      if (userProfile?.role === 'hod' || userProfile?.role === 'dept_admin') {
        const myDept = userProfile.dept;
        if (myDept && myDept !== 'ALL') {
          fetched = fetched.filter(s => s.programmeCode === myDept || s.dept === myDept);
        }
      }

      // Deduplicate students so double entries never appear in the UI
      const seen = new Set();
      fetched = fetched.filter(s => {
        const regKey = (s.registerNumber || '').toLowerCase().trim();
        const emailKey = (s.personalEmail || '').toLowerCase().trim();
        const key = regKey || emailKey || s.id;
        if (!key) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setStudents(fetched);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Students matching Dept and Year (independent of section and search)
  const baseYearStudents = useMemo(() => {
    return students.filter(s => {
      // Dept filter
      if (selectedDept !== 'All' && s.programmeCode !== selectedDept && s.dept !== selectedDept) {
        return false;
      }
      // Year filter
      if (selectedYear !== 'All') {
        const normYear = (s.year || '').toLowerCase();
        if (selectedYear === '1st Year' && normYear !== '1st year' && normYear !== '1') return false;
        if (selectedYear === '2nd Year' && normYear !== '2nd year' && normYear !== '2') return false;
        if (selectedYear === '3rd Year' && normYear !== '3rd year' && normYear !== '3') return false;
        if (selectedYear === '4th Year' && normYear !== '4th year' && normYear !== '4') return false;
      }
      return true;
    });
  }, [students, selectedDept, selectedYear]);

  // Compute available sections dynamically based strictly on the selected Year and Dept
  const availableSections = useMemo(() => {
    if (baseYearStudents.length === 0) {
      return []; // Not assigned yet for this year!
    }

    const set = new Set();
    let hasSingle = false;

    baseYearStudents.forEach(s => {
      if (isSingleClassSection(s.section)) {
        hasSingle = true;
      } else {
        const sec = (s.section || '').trim().toUpperCase();
        if (sec) set.add(sec);
      }
    });

    const realSections = Array.from(set).sort();

    // If only single class exists in this year (no sections A, B, etc.)
    if (realSections.length === 0) {
      return hasSingle ? ['Single Class'] : [];
    }

    const result = ['All'];
    if (hasSingle) result.push('Single Class');
    result.push(...realSections);
    return result;
  }, [baseYearStudents]);

  // Filter students based on UI selections
  const filteredStudents = useMemo(() => {
    return baseYearStudents.filter(s => {
      // Section filter
      if (selectedSection !== 'All') {
        const isSingle = isSingleClassSection(s.section);
        if (selectedSection === 'Single Class') {
          if (!isSingle) return false;
        } else {
          const sec = (s.section || '').trim().toUpperCase();
          if (isSingle || sec !== selectedSection.toUpperCase()) return false;
        }
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (s.studentName || '').toLowerCase().includes(q);
        const matchReg = (s.registerNumber || '').toLowerCase().includes(q);
        const matchPersonal = (s.personalEmail || '').toLowerCase().includes(q);
        const matchCollege = (s.collegeEmail || '').toLowerCase().includes(q);
        const matchMobile = (s.mobile || '').includes(q);
        if (!matchName && !matchReg && !matchPersonal && !matchCollege && !matchMobile) return false;
      }
      return true;
    });
  }, [baseYearStudents, selectedSection, searchQuery]);

  // Dynamic Section Statistics
  const stats = useMemo(() => {
    const total = filteredStudents.length;
    const secMap = {};
    let singleClassCount = 0;

    filteredStudents.forEach(s => {
      if (isSingleClassSection(s.section)) {
        singleClassCount++;
      } else {
        const sec = (s.section || '').trim().toUpperCase();
        secMap[sec] = (secMap[sec] || 0) + 1;
      }
    });

    return { total, secMap, singleClassCount };
  }, [filteredStudents]);

  // Keep selectedSection in sync with available options
  useEffect(() => {
    if (availableSections.length === 0) {
      setSelectedSection('All');
    } else if (!availableSections.includes(selectedSection)) {
      setSelectedSection(availableSections[0]);
    }
  }, [availableSections, selectedSection]);

  // Download Sample Template (Excel & CSV compatible)
  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        "Register Number": "952524104001",
        "Student Name": "Aravind Kumar M",
        "Personal Email": "aravind.personal@gmail.com",
        "College Email": "952524104001@rvce.ac.in",
        "Mobile": "9876543210",
        "Department": defaultDept || "CSE",
        "Year": defaultYear || "1st Year",
        "Section": "A",
        "Batch": defaultBatch || "2024-2028",
        "Semester": "1",
        "Student Type": "dayscholar",
        "Password (Optional)": "Rvce@952524104001"
      },
      {
        "Register Number": "952524104002",
        "Student Name": "Bavya Shree S",
        "Personal Email": "bavya.personal@gmail.com",
        "College Email": "952524104002@rvce.ac.in",
        "Mobile": "9876543211",
        "Department": defaultDept || "CSE",
        "Year": defaultYear || "1st Year",
        "Section": "B",
        "Batch": defaultBatch || "2024-2028",
        "Semester": "1",
        "Student Type": "hosteller",
        "Password (Optional)": "Rvce@952524104002"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "RVCE_New_Students_Template.xlsx");
    toast.success("Sample template downloaded!");
  };

  // Process Excel/CSV File
  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setUploadFile(selected);
    setUploadErrors([]);
    setUploadPreview([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        if (rows.length === 0) {
          setUploadErrors(["The uploaded file contains no data rows."]);
          return;
        }

        // Validate rows and format
        const errors = [];
        const preview = rows.map((row, idx) => {
          const rowNum = idx + 2;
          const regNo = String(row['Register Number'] || row['registerNumber'] || row['Register No'] || row['Roll No'] || '').trim();
          const name = String(row['Student Name'] || row['studentName'] || row['Name'] || '').trim();
          const personalEmail = String(row['Personal Email'] || row['personalEmail'] || row['Email'] || row['email'] || '').trim();
          const collegeEmail = String(row['College Email'] || row['collegeEmail'] || '').trim();
          const mobile = String(row['Mobile'] || row['phone'] || row['mobile'] || '').trim();
          const rawDept = String(row['Department'] || row['programmeCode'] || row['dept'] || row['Branch'] || '').trim();
          const dept = normalizeDepartment(rawDept, regNo, defaultDept);
          const { year, semester } = detectYearAndSemester(row, regNo);
          const section = sectionMode === 'force' 
            ? defaultSection 
            : String(row['Section'] || row['section'] || defaultSection).trim().toUpperCase();
          const batch = String(row['Batch'] || row['batch'] || defaultBatch).trim();
          const studentType = String(row['Student Type'] || row['studentType'] || 'dayscholar').toLowerCase().trim();
          const customPwd = String(row['Password (Optional)'] || row['Password'] || row['password'] || '').trim();
          const finalPwd = customPwd || `Rvce@${regNo || '123'}`;

          if (!regNo) errors.push(`Row ${rowNum}: Missing Register Number`);
          if (!name) errors.push(`Row ${rowNum}: Missing Student Name`);
          if (!personalEmail) errors.push(`Row ${rowNum}: Missing Personal Email (Required for Login ID)`);

          return {
            regNo,
            name,
            personalEmail,
            collegeEmail,
            mobile,
            dept,
            year,
            section,
            batch,
            semester,
            studentType,
            password: finalPwd
          };
        });

        if (errors.length > 0) {
          setUploadErrors(errors);
        }
        setUploadPreview(preview);
      } catch (err) {
        console.error(err);
        setUploadErrors(["Failed to parse file. Please upload a valid .xlsx or .csv file."]);
      }
    };
    reader.readAsArrayBuffer(selected);
  };

  // Perform Bulk Upload & Supabase Auth User Creation
  const handleConfirmUpload = async () => {
    if (uploadPreview.length === 0) return;
    setUploadLoading(true);
    setUploadProgress({ current: 0, total: uploadPreview.length });

    let successCount = 0;
    let skippedDuplicates = 0;
    const credsList = [];

    for (let i = 0; i < uploadPreview.length; i++) {
      const row = uploadPreview[i];
      setUploadProgress({ current: i + 1, total: uploadPreview.length });

      if (!row.regNo || !row.personalEmail || !row.name) continue;

      // Check duplicates in existing students list
      const isDuplicate = students.some(
        s => (s.registerNumber && s.registerNumber.toLowerCase() === row.regNo.toLowerCase()) ||
             (s.personalEmail && s.personalEmail.toLowerCase() === row.personalEmail.toLowerCase())
      );

      if (isDuplicate) {
        skippedDuplicates++;
        continue;
      }

      let authUserId = null;

      // 1. Create Supabase Auth User with Personal Email as Login ID
      if (createAuthAccounts && dbClient?.auth?.admin) {
        try {
          const { data: authData, error: authError } = await dbClient.auth.admin.createUser({
            email: row.personalEmail.toLowerCase().trim(),
            password: row.password,
            email_confirm: true,
            user_metadata: {
              role: 'student',
              name: row.name,
              dept: row.dept,
              year: row.year,
              section: row.section,
              registerNo: row.regNo
            }
          });

          if (!authError && authData?.user) {
            authUserId = authData.user.id;
          } else {
            console.warn(`Auth creation notice for ${row.personalEmail}:`, authError?.message);
          }
        } catch (authErr) {
          console.warn("Auth error:", authErr);
        }
      }

      // 2. Save full student details to 'users' collection
      try {
        const studentDocData = {
          role: 'student',
          registerNo: row.regNo,
          registerNumber: row.regNo,
          name: row.name,
          studentName: row.name,
          email: row.personalEmail.toLowerCase().trim(), // Primary login email!
          personalEmail: row.personalEmail.toLowerCase().trim(),
          collegeEmail: row.collegeEmail ? row.collegeEmail.toLowerCase().trim() : '',
          phone: row.mobile,
          mobile: row.mobile,
          dept: row.dept,
          programmeCode: row.dept,
          year: row.year,
          section: row.section,
          batch: row.batch,
          semester: row.semester,
          studentType: row.studentType || 'dayscholar',
          status: 'Active',
          initialPassword: row.password,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        if (authUserId) {
          studentDocData.uid = authUserId;
          studentDocData.id = authUserId;
        }

        await addDoc(collection(db, 'users'), studentDocData);
        successCount++;
        credsList.push({
          "Register Number": row.regNo,
          "Student Name": row.name,
          "Section": row.section,
          "Department": row.dept,
          "Personal Email (Login ID)": row.personalEmail,
          "College Email": row.collegeEmail,
          "Password": row.password
        });
      } catch (dbErr) {
        console.error("DB insert error for row:", row, dbErr);
      }
    }

    setUploadLoading(false);
    setCreatedCredentials(credsList);
    
    toast.success(`Successfully onboarded ${successCount} students! ${skippedDuplicates > 0 ? `(${skippedDuplicates} duplicates skipped)` : ''}`);
    fetchStudents();

    if (credsList.length > 0) {
      setIsExportOpen(true);
    }
    setIsUploadOpen(false);
  };

  // Export Credentials to Excel
  const handleExportCredentials = (listToExport) => {
    const data = (listToExport && listToExport.length > 0) 
      ? listToExport 
      : filteredStudents.map(s => ({
          "Register Number": s.registerNumber,
          "Student Name": s.studentName,
          "Section": s.section || 'A',
          "Department": s.programmeCode || s.dept,
          "Year": s.year,
          "Personal Email (Login ID)": s.personalEmail,
          "College Email": s.collegeEmail || 'Not Provided',
          "Password": s.initialPassword || `Rvce@${s.registerNumber}`
        }));

    if (data.length === 0) {
      toast.error("No students to export");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Student Credentials");
    XLSX.writeFile(wb, `RVCE_${selectedDept}_${selectedYear}_Section_${selectedSection}_Credentials.xlsx`);
    toast.success("Student credentials exported!");
  };

  // Single Student Submit
  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.registerNumber.trim() || !formData.studentName.trim() || !formData.personalEmail.trim()) {
      toast.error('Register Number, Name and Personal Email are required');
      return;
    }

    const cleanEmail = formData.personalEmail.toLowerCase().trim();
    const finalPassword = formData.password.trim() || `Rvce@${formData.registerNumber.trim()}`;

    // Duplicate check
    if (!editItem) {
      const isDup = students.some(
        s => s.registerNumber.toLowerCase() === formData.registerNumber.trim().toLowerCase() ||
             (s.personalEmail && s.personalEmail.toLowerCase() === cleanEmail)
      );
      if (isDup) {
        toast.error('Student with this Register Number or Personal Email already exists');
        return;
      }
    }

    setLoading(true);

    try {
      let authUserId = editItem ? (editItem.uid || editItem.id) : null;

      // Create Supabase Auth User for login if new
      if (!editItem && dbClient?.auth?.admin) {
        try {
          const { data: authData, error: authError } = await dbClient.auth.admin.createUser({
            email: cleanEmail,
            password: finalPassword,
            email_confirm: true,
            user_metadata: {
              role: 'student',
              name: formData.studentName,
              dept: formData.programmeCode,
              year: formData.year,
              section: formData.section.toUpperCase(),
              registerNo: formData.registerNumber
            }
          });
          if (!authError && authData?.user) {
            authUserId = authData.user.id;
          }
        } catch (e) {
          console.warn("Auth creation error:", e);
        }
      }

      const dbData = {
        role: 'student',
        registerNumber: formData.registerNumber.trim(),
        registerNo: formData.registerNumber.trim(),
        studentName: formData.studentName.trim(),
        name: formData.studentName.trim(),
        email: cleanEmail, // Primary login ID
        personalEmail: cleanEmail,
        collegeEmail: formData.collegeEmail.toLowerCase().trim(),
        phone: formData.mobile.trim(),
        mobile: formData.mobile.trim(),
        programmeCode: formData.programmeCode,
        dept: formData.programmeCode,
        batch: formData.batch,
        semester: formData.semester,
        year: formData.year,
        section: formData.section.toUpperCase().trim(),
        studentType: formData.studentType,
        status: formData.status,
        initialPassword: finalPassword,

        // Personal & Identity
        dob: formData.dob || '',
        gender: formData.gender || '',
        bloodGroup: formData.bloodGroup || '',
        religion: formData.religion || '',
        community: formData.community || '',
        caste: formData.caste || '',
        aadhaarNumber: formData.aadhaarNumber || '',

        // Parent & Family
        fatherName: formData.fatherName || '',
        motherName: formData.motherName || '',
        fatherMobile: formData.fatherMobile || '',
        motherMobile: formData.motherMobile || '',
        fatherIncome: formData.fatherIncome || '',
        motherIncome: formData.motherIncome || '',
        singleParent: formData.singleParent || 'No',

        // Address & Residence
        address: formData.address || '',
        streetArea: formData.streetArea || '',
        cityVillage: formData.cityVillage || '',
        district: formData.district || '',
        state: formData.state || '',
        pincode: formData.pincode || '',

        // Admission & Govt IDs
        admissionNumber: formData.admissionNumber || '',
        admissionYear: formData.admissionYear || '',
        dateOfAdmission: formData.dateOfAdmission || '',
        admissionType: formData.admissionType || '',
        degree: formData.degree || 'B.E.',
        academicSession: formData.academicSession || '',
        regulation: formData.regulation || '',
        emisNumber: formData.emisNumber || '',
        umisNumber: formData.umisNumber || '',
        apaarId: formData.apaarId || '',
        scholarship: formData.scholarship || '',
        usesCollegeBus: formData.usesCollegeBus || 'No',
        lateralEntry: formData.lateralEntry || 'No',
        csvData: formData.csvData || {},

        updatedAt: serverTimestamp()
      };

      if (authUserId) {
        dbData.uid = authUserId;
        dbData.id = authUserId;
      }

      if (editItem) {
        await updateDoc(doc(db, 'users', editItem.id), dbData);
        toast.success('Student details updated');
      } else {
        dbData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'users'), dbData);
        toast.success(`Student added! Login ID: ${cleanEmail}`);
      }

      setIsModalOpen(false);
      fetchStudents();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save student details');
    } finally {
      setLoading(false);
    }
  };

  // Delete Student
  const handleDeleteStudent = async (student) => {
    if (!window.confirm(`Are you sure you want to delete ${student.studentName} (${student.registerNumber})?`)) return;
    try {
      await deleteDoc(doc(db, 'users', student.id));
      if (student.uid && dbClient?.auth?.admin) {
        await dbClient.auth.admin.deleteUser(student.uid).catch(() => {});
      }
      toast.success('Student deleted');
      fetchStudents();
    } catch (e) {
      toast.error('Failed to delete student');
    }
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        
        <div className="page-container" style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#dbeafe', color: '#1e40af', padding: '8px', borderRadius: '10px' }}>
                  <GraduationCap size={24} />
                </div>
                <div>
                  <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', margin: 0, color: '#1e293b', fontSize: '22px', fontWeight: '700' }}>
                    Student Admission & Details
                  </h2>
                  <div style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>
                    Department Coordinator / Academic Enrollment & Section-wise Management
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={handleDownloadTemplate}
                style={{
                  padding: '9px 14px',
                  background: '#fff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#475569',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Download size={15} /> Sample Template
              </button>

              <button
                onClick={() => handleExportCredentials()}
                style={{
                  padding: '9px 14px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  color: '#166534',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FileSpreadsheet size={15} /> Export Credentials
              </button>

              <button
                onClick={() => {
                  setUploadFile(null);
                  setUploadPreview([]);
                  setUploadErrors([]);
                  setIsUploadOpen(true);
                }}
                style={{
                  padding: '9px 16px',
                  background: '#4f46e5',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)'
                }}
              >
                <Upload size={15} /> Bulk Upload (CSV/Excel)
              </button>

              <button
                onClick={() => {
                  setEditItem(null);
                  setFormData({
                    ...EMPTY_STUDENT_FORM,
                    programmeCode: selectedDept !== 'All' ? selectedDept : 'CSE',
                    year: selectedYear !== 'All' ? selectedYear : '1st Year',
                    section: selectedSection !== 'All' ? selectedSection : ''
                  });
                  setModalTab('academic');
                  setIsModalOpen(true);
                }}
                style={{
                  padding: '9px 16px',
                  background: '#2563eb',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                }}
              >
                <Plus size={16} /> Add Single Student
              </button>
            </div>
          </div>

          {/* Quick Statistics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ background: '#eff6ff', color: '#2563eb', padding: '12px', borderRadius: '10px' }}>
                <Users size={22} />
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                  {stats.total === 0 ? 'Total Students' : (Object.keys(stats.secMap).length === 0 ? 'Total Students (Single Class)' : 'Total Students Filtered')}
                </div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b' }}>{stats.total}</div>
              </div>
            </div>

            {/* Single Class Students Card (Show only if multiple sections exist AND single class students exist) */}
            {Object.keys(stats.secMap).length > 0 && stats.singleClassCount > 0 && (
              <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ background: '#e0e7ff', color: '#4338ca', padding: '12px', borderRadius: '10px', fontWeight: '700', fontSize: '15px' }}>
                  Single
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Single Class Students</div>
                  <div style={{ fontSize: '22px', fontWeight: '700', color: '#4338ca' }}>{stats.singleClassCount}</div>
                </div>
              </div>
            )}

            {/* Dynamic Section Cards (ONLY show if students actually exist in that section) */}
            {Object.keys(stats.secMap).sort().map(sec => {
              const count = stats.secMap[sec];
              if (!count || count <= 0) return null;
              const theme = {
                A: { bg: '#ecfdf5', color: '#059669' },
                B: { bg: '#f5f3ff', color: '#7c3aed' },
                C: { bg: '#fffbeb', color: '#d97706' },
                D: { bg: '#eff6ff', color: '#2563eb' }
              }[sec] || { bg: '#f1f5f9', color: '#334155' };

              return (
                <div key={sec} style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ background: theme.bg, color: theme.color, padding: '12px', borderRadius: '10px', fontWeight: '700', fontSize: '18px' }}>
                    {sec}
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Section {sec} Students</div>
                    <div style={{ fontSize: '22px', fontWeight: '700', color: theme.color }}>{count}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filter Bar */}
          <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Top row: Dept & Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              
              {/* Department Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={16} color="#64748b" />
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Department:</span>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  disabled={userProfile?.role === 'hod' || userProfile?.role === 'dept_admin'}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#1e293b',
                    background: '#fff'
                  }}
                >
                  <option value="All">All Departments</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Search Box */}
              <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search by Name, Reg No, Email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Bottom row: Year Tabs & Section Pills */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              
              {/* Year Filter Tabs */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', alignSelf: 'center', marginRight: '6px' }}>Year:</span>
                {['All', '1st Year', '2nd Year', '3rd Year', '4th Year'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSelectedYear(tab)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      fontWeight: selectedYear === tab ? '700' : '500',
                      background: selectedYear === tab ? '#2563eb' : '#f1f5f9',
                      color: selectedYear === tab ? '#fff' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Section Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginRight: '6px' }}>Class / Section:</span>
                {availableSections.length === 0 ? (
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '5px 8px' }}>
                    Not assigned yet
                  </span>
                ) : availableSections.length === 1 && availableSections[0] === 'Single Class' ? (
                  <span
                    style={{
                      padding: '5px 14px',
                      borderRadius: '20px',
                      border: '1px solid #c7d2fe',
                      fontSize: '12px',
                      fontWeight: '700',
                      background: '#e0e7ff',
                      color: '#4338ca'
                    }}
                  >
                    Single Class (All Students)
                  </span>
                ) : (
                  availableSections.map(sec => (
                    <button
                      key={sec}
                      onClick={() => setSelectedSection(sec)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '20px',
                        border: selectedSection === sec ? '1px solid #4f46e5' : '1px solid #cbd5e1',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: selectedSection === sec ? '700' : '500',
                        background: selectedSection === sec ? '#e0e7ff' : '#fff',
                        color: selectedSection === sec ? '#4338ca' : '#475569',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {sec === 'All' ? 'All Sections' : sec === 'Single Class' ? 'Single Class' : `Section ${sec}`}
                    </button>
                  ))
                )}
              </div>

            </div>
          </div>

          {/* Student Table */}
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
                    <th style={{ padding: '14px 16px' }}>Reg Number</th>
                    <th style={{ padding: '14px 16px' }}>Student Name</th>
                    <th style={{ padding: '14px 16px' }}>Section</th>
                    <th style={{ padding: '14px 16px' }}>Personal Email (Login ID)</th>
                    <th style={{ padding: '14px 16px' }}>College Email</th>
                    <th style={{ padding: '14px 16px' }}>Dept / Year</th>
                    <th style={{ padding: '14px 16px' }}>Mobile</th>
                    <th style={{ padding: '14px 16px' }}>Login Password</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        Loading students...
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        No students found matching current filters. Click "Bulk Upload" to enroll new 1st-year students.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => {
                      const isPwdRevealed = revealedPasswords[student.id];
                      return (
                        <tr key={student.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                          <td style={{ padding: '14px 16px', fontWeight: '700', color: '#1e3a8a' }}>
                            {student.registerNumber}
                          </td>
                          <td style={{ padding: '14px 16px', fontWeight: '600', color: '#1e293b' }}>
                            {student.studentName}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {student.section && !isSingleClassSection(student.section) ? (
                              <span style={{
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontWeight: '700',
                                fontSize: '11.5px',
                                background: student.section === 'A' ? '#dbeafe' : (student.section === 'B' ? '#f3e8ff' : '#fef3c7'),
                                color: student.section === 'A' ? '#1d4ed8' : (student.section === 'B' ? '#7e22ce' : '#b45309')
                              }}>
                                Sec {student.section}
                              </span>
                            ) : (
                              <span style={{
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontWeight: '600',
                                fontSize: '11.5px',
                                background: '#f1f5f9',
                                color: '#475569'
                              }}>
                                Single Class
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a' }}>
                              <Mail size={13} color="#2563eb" />
                              <span style={{ fontWeight: '600' }}>{student.personalEmail}</span>
                            </div>
                            <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: '600' }}>● Login Verified</span>
                          </td>
                          <td style={{ padding: '14px 16px', color: '#64748b' }}>
                            {student.collegeEmail || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Pending issue</span>}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ fontWeight: '600', color: '#334155' }}>{student.programmeCode || student.dept}</span>
                            <span style={{ color: '#94a3b8', margin: '0 4px' }}>•</span>
                            <span style={{ color: '#64748b' }}>{student.year}</span>
                          </td>
                          <td style={{ padding: '14px 16px', color: '#475569' }}>
                            {student.mobile || student.phone || '-'}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: '12px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                {isPwdRevealed ? (student.initialPassword || `Rvce@${student.registerNumber}`) : '••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setRevealedPasswords(prev => ({ ...prev, [student.id]: !prev[student.id] }))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                              >
                                {isPwdRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                              <button
                                onClick={() => {
                                  setEditItem(student);
                                  setFormData({
                                    ...EMPTY_STUDENT_FORM,
                                    ...student,
                                    registerNumber: student.registerNumber || '',
                                    studentName: student.studentName || '',
                                    personalEmail: student.personalEmail || '',
                                    collegeEmail: student.collegeEmail || '',
                                    mobile: student.mobile || '',
                                    programmeCode: student.programmeCode || student.dept || 'CSE',
                                    batch: student.batch || '2024-2028',
                                    semester: student.semester || '1',
                                    year: student.year || '1st Year',
                                    section: (student.section && !['NO', '.', '-', 'N/A', 'NONE'].includes(student.section)) ? student.section : '',
                                    studentType: student.studentType || 'dayscholar',
                                    password: student.initialPassword || '',
                                    status: student.status || 'Active',

                                    dob: student.dob || '',
                                    gender: student.gender || '',
                                    bloodGroup: student.bloodGroup || '',
                                    religion: student.religion || '',
                                    community: student.community || '',
                                    caste: student.caste || '',
                                    aadhaarNumber: student.aadhaarNumber || '',

                                    fatherName: student.fatherName || '',
                                    motherName: student.motherName || '',
                                    fatherMobile: student.fatherMobile || '',
                                    motherMobile: student.motherMobile || '',
                                    fatherIncome: student.fatherIncome || '',
                                    motherIncome: student.motherIncome || '',
                                    singleParent: student.singleParent || 'No',

                                    address: student.address || '',
                                    streetArea: student.streetArea || '',
                                    cityVillage: student.cityVillage || '',
                                    district: student.district || '',
                                    state: student.state || '',
                                    pincode: student.pincode || '',

                                    admissionNumber: student.admissionNumber || '',
                                    admissionYear: student.admissionYear || '',
                                    dateOfAdmission: student.dateOfAdmission || '',
                                    admissionType: student.admissionType || '',
                                    degree: student.degree || 'B.E.',
                                    academicSession: student.academicSession || '',
                                    regulation: student.regulation || '',
                                    emisNumber: student.emisNumber || '',
                                    umisNumber: student.umisNumber || '',
                                    apaarId: student.apaarId || '',
                                    scholarship: student.scholarship || '',
                                    usesCollegeBus: student.usesCollegeBus || 'No',
                                    lateralEntry: student.lateralEntry || 'No',
                                    csvData: student.csvData || student.rawRowData || {}
                                  });
                                  setModalTab('academic');
                                  setIsModalOpen(true);
                                }}
                                title="Edit Student Details"
                                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: '4px' }}
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(student)}
                                title="Delete Student"
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Single Student Add/Edit Modal with All Categorized Details */}
          {isModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
              <div style={{ background: '#fff', width: '100%', maxWidth: '880px', borderRadius: '14px', padding: '24px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                
                {/* Modal Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <GraduationCap size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                        {editItem ? (formData.studentName || 'Edit Student Details') : 'Add New Student'}
                      </h3>
                      <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{formData.registerNumber ? `Reg: ${formData.registerNumber}` : 'New Student Record'}</span>
                        {formData.programmeCode && <span>• {formData.programmeCode}</span>}
                        {formData.year && <span>• {formData.year}</span>}
                        {formData.section && <span>• Sec {formData.section}</span>}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '6px' }}>
                    <X size={20} />
                  </button>
                </div>

                {/* Tabs Navigation */}
                <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {[
                    { id: 'academic', label: 'Academic & Login', icon: Key },
                    { id: 'personal', label: 'Personal & Identity', icon: User },
                    { id: 'family', label: 'Parent & Family', icon: Users },
                    { id: 'address', label: 'Address & Contact', icon: MapPin },
                    { id: 'admission', label: 'Admission & Govt IDs', icon: FileCheck },
                    { id: 'csv_data', label: 'Raw CSV / All Details', icon: FileSpreadsheet }
                  ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = modalTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setModalTab(tab.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '12.5px',
                          fontWeight: isActive ? '700' : '500',
                          background: isActive ? '#eff6ff' : 'transparent',
                          color: isActive ? '#2563eb' : '#64748b',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Icon size={14} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <form onSubmit={handleSingleSubmit}>
                  
                  {/* TAB 1: Academic & Login */}
                  {modalTab === 'academic' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Register Number *
                        </label>
                        <input
                          required
                          type="text"
                          placeholder="e.g. 952524104001"
                          value={formData.registerNumber}
                          onChange={e => setFormData({ ...formData, registerNumber: e.target.value })}
                          disabled={!!editItem}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', background: editItem ? '#f8fafc' : '#fff' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Student Full Name *
                        </label>
                        <input
                          required
                          type="text"
                          placeholder="Full name with initials"
                          value={formData.studentName}
                          onChange={e => setFormData({ ...formData, studentName: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#1e40af' }}>
                          Personal Email (Primary Login ID) *
                        </label>
                        <input
                          required
                          type="email"
                          placeholder="personal@gmail.com"
                          value={formData.personalEmail}
                          onChange={e => setFormData({ ...formData, personalEmail: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #93c5fd', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          College Official Email
                        </label>
                        <input
                          type="email"
                          placeholder="952524104001@rvce.ac.in"
                          value={formData.collegeEmail}
                          onChange={e => setFormData({ ...formData, collegeEmail: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Mobile Number
                        </label>
                        <input
                          type="tel"
                          placeholder="10-digit mobile"
                          value={formData.mobile}
                          onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Department / Programme *
                        </label>
                        <select
                          value={formData.programmeCode}
                          onChange={e => setFormData({ ...formData, programmeCode: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        >
                          {DEPARTMENTS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Academic Year *
                        </label>
                        <select
                          value={formData.year}
                          onChange={e => setFormData({ ...formData, year: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        >
                          {YEARS.map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Current Semester
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 1"
                          value={formData.semester}
                          onChange={e => setFormData({ ...formData, semester: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#4338ca' }}>
                          Section (Class)
                        </label>
                        <select
                          value={formData.section}
                          onChange={e => setFormData({ ...formData, section: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #a5b4fc', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', fontWeight: '600' }}
                        >
                          <option value="">No Section (Single Class)</option>
                          <option value="A">Section A</option>
                          <option value="B">Section B</option>
                          <option value="C">Section C</option>
                          <option value="D">Section D</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Batch
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 2024-2028"
                          value={formData.batch}
                          onChange={e => setFormData({ ...formData, batch: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Student Type
                        </label>
                        <select
                          value={formData.studentType}
                          onChange={e => setFormData({ ...formData, studentType: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        >
                          <option value="dayscholar">Day Scholar</option>
                          <option value="hosteller">Hosteller</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Account Status
                        </label>
                        <select
                          value={formData.status}
                          onChange={e => setFormData({ ...formData, status: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                          <option value="Suspended">Suspended</option>
                        </select>
                      </div>

                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Login Password (Default: Rvce@&lt;RegisterNumber&gt; or username@9525)
                        </label>
                        <input
                          type="text"
                          placeholder="Leave blank for default password"
                          value={formData.password}
                          onChange={e => setFormData({ ...formData, password: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 2: Personal & Identity */}
                  {modalTab === 'personal' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Date of Birth (DOB)
                        </label>
                        <input
                          type="text"
                          placeholder="DD/MM/YYYY or YYYY-MM-DD"
                          value={formData.dob}
                          onChange={e => setFormData({ ...formData, dob: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Gender
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Male / Female"
                          value={formData.gender}
                          onChange={e => setFormData({ ...formData, gender: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Blood Group
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. O+, B+, A+"
                          value={formData.bloodGroup}
                          onChange={e => setFormData({ ...formData, bloodGroup: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Religion
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Hindu / Muslim / Christian"
                          value={formData.religion}
                          onChange={e => setFormData({ ...formData, religion: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Community Category
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. BC / MBC / OC / SC / ST"
                          value={formData.community}
                          onChange={e => setFormData({ ...formData, community: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Caste
                        </label>
                        <input
                          type="text"
                          placeholder="Caste name"
                          value={formData.caste}
                          onChange={e => setFormData({ ...formData, caste: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Aadhaar Number
                        </label>
                        <input
                          type="text"
                          placeholder="12-digit Aadhaar number"
                          value={formData.aadhaarNumber}
                          onChange={e => setFormData({ ...formData, aadhaarNumber: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 3: Parent & Family */}
                  {modalTab === 'family' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Father's Name
                        </label>
                        <input
                          type="text"
                          placeholder="Father's full name"
                          value={formData.fatherName}
                          onChange={e => setFormData({ ...formData, fatherName: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Father's Mobile Number
                        </label>
                        <input
                          type="tel"
                          placeholder="Father's phone"
                          value={formData.fatherMobile}
                          onChange={e => setFormData({ ...formData, fatherMobile: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Father's Annual Income
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 150000"
                          value={formData.fatherIncome}
                          onChange={e => setFormData({ ...formData, fatherIncome: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Mother's Name
                        </label>
                        <input
                          type="text"
                          placeholder="Mother's full name"
                          value={formData.motherName}
                          onChange={e => setFormData({ ...formData, motherName: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Mother's Mobile Number
                        </label>
                        <input
                          type="tel"
                          placeholder="Mother's phone"
                          value={formData.motherMobile}
                          onChange={e => setFormData({ ...formData, motherMobile: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Mother's Annual Income
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 100000"
                          value={formData.motherIncome}
                          onChange={e => setFormData({ ...formData, motherIncome: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Single Parent
                        </label>
                        <input
                          type="text"
                          placeholder="Yes / No"
                          value={formData.singleParent}
                          onChange={e => setFormData({ ...formData, singleParent: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 4: Address & Contact */}
                  {modalTab === 'address' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Permanent Address
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Door no, Street, Village, Post..."
                          value={formData.address}
                          onChange={e => setFormData({ ...formData, address: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Street / Area
                        </label>
                        <input
                          type="text"
                          placeholder="Street name or Area"
                          value={formData.streetArea}
                          onChange={e => setFormData({ ...formData, streetArea: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          City / Village
                        </label>
                        <input
                          type="text"
                          placeholder="Town, city or village"
                          value={formData.cityVillage}
                          onChange={e => setFormData({ ...formData, cityVillage: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          District
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Madurai, Chennai"
                          value={formData.district}
                          onChange={e => setFormData({ ...formData, district: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          State
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Tamil Nadu"
                          value={formData.state}
                          onChange={e => setFormData({ ...formData, state: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Pincode
                        </label>
                        <input
                          type="text"
                          placeholder="6-digit pincode"
                          value={formData.pincode}
                          onChange={e => setFormData({ ...formData, pincode: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 5: Admission & Govt IDs */}
                  {modalTab === 'admission' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Admission Number
                        </label>
                        <input
                          type="text"
                          placeholder="Admission / Quota file No"
                          value={formData.admissionNumber}
                          onChange={e => setFormData({ ...formData, admissionNumber: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Admission Year
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 2024"
                          value={formData.admissionYear}
                          onChange={e => setFormData({ ...formData, admissionYear: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Date of Admission
                        </label>
                        <input
                          type="text"
                          placeholder="DD/MM/YYYY"
                          value={formData.dateOfAdmission}
                          onChange={e => setFormData({ ...formData, dateOfAdmission: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Admission Type
                        </label>
                        <input
                          type="text"
                          placeholder="Counseling / Management / Govt"
                          value={formData.admissionType}
                          onChange={e => setFormData({ ...formData, admissionType: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Degree
                        </label>
                        <input
                          type="text"
                          placeholder="B.E. / B.Tech / M.E."
                          value={formData.degree}
                          onChange={e => setFormData({ ...formData, degree: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Academic Session
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 2024-2025"
                          value={formData.academicSession}
                          onChange={e => setFormData({ ...formData, academicSession: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Regulation
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. R-2021"
                          value={formData.regulation}
                          onChange={e => setFormData({ ...formData, regulation: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          EMIS Number
                        </label>
                        <input
                          type="text"
                          placeholder="EMIS identifier"
                          value={formData.emisNumber}
                          onChange={e => setFormData({ ...formData, emisNumber: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          UMIS Number
                        </label>
                        <input
                          type="text"
                          placeholder="UMIS identifier"
                          value={formData.umisNumber}
                          onChange={e => setFormData({ ...formData, umisNumber: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          APAAR ID (ABC ID)
                        </label>
                        <input
                          type="text"
                          placeholder="APAAR ID"
                          value={formData.apaarId}
                          onChange={e => setFormData({ ...formData, apaarId: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Scholarship
                        </label>
                        <input
                          type="text"
                          placeholder="Eligible / Post-Matric / First Graduate"
                          value={formData.scholarship}
                          onChange={e => setFormData({ ...formData, scholarship: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Uses College Bus
                        </label>
                        <input
                          type="text"
                          placeholder="Yes / No"
                          value={formData.usesCollegeBus}
                          onChange={e => setFormData({ ...formData, usesCollegeBus: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: '#334155' }}>
                          Lateral Entry
                        </label>
                        <input
                          type="text"
                          placeholder="Yes / No"
                          value={formData.lateralEntry}
                          onChange={e => setFormData({ ...formData, lateralEntry: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 6: Raw CSV / Additional Info */}
                  {modalTab === 'csv_data' && (
                    <div>
                      {formData.csvData && Object.keys(formData.csvData).length > 0 ? (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', maxHeight: '350px', overflowY: 'auto' }}>
                          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                            All original columns & responses preserved from student enrollment data:
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                            {Object.entries(formData.csvData).map(([k, v]) => (
                              <div key={k} style={{ background: '#fff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'capitalize' }}>
                                  {k.replace(/([A-Z])/g, ' $1')}
                                </div>
                                <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: '500', marginTop: '2px', wordBreak: 'break-word' }}>
                                  {String(v) || <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>— (Empty)</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                          No additional unmapped CSV columns found for this student. All standard profile fields are accessible in the tabs above.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Modal Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {editItem ? 'Changes will immediately update the student record in database.' : 'New student credentials and profile will be created.'}
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        style={{ padding: '9px 18px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', color: '#475569', fontSize: '13px' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        style={{ padding: '9px 22px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}
                      >
                        {editItem ? 'Save All Changes' : 'Create Student & Login Account'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Bulk Upload Modal (CSV & Excel) */}
          {isUploadOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '20px' }}>
              <div style={{ background: '#fff', width: '100%', maxWidth: '850px', borderRadius: '12px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                
                {/* Header */}
                <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                      Bulk Upload Students (CSV / Excel)
                    </h3>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                      Automated Profile & Supabase Auth Login Account Creation
                    </div>
                  </div>
                  <button onClick={() => setIsUploadOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Default Configuration Settings */}
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Filter size={15} color="#2563eb" /> Default Settings for Uploaded Students:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Department</label>
                        <select 
                          value={defaultDept} 
                          onChange={e => setDefaultDept(e.target.value)}
                          disabled={userProfile?.role === 'hod' || userProfile?.role === 'dept_admin'}
                          style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                        >
                          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Academic Year</label>
                        <select 
                          value={defaultYear} 
                          onChange={e => setDefaultYear(e.target.value)}
                          style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                        >
                          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Section Assignment</label>
                        <select 
                          value={sectionMode} 
                          onChange={e => setSectionMode(e.target.value)}
                          style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                        >
                          <option value="csv">Read Section from CSV column (A, B, C...)</option>
                          <option value="force">Assign ALL to selected Section below</option>
                        </select>
                      </div>

                      {sectionMode === 'force' && (
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4338ca', marginBottom: '4px' }}>Target Section</label>
                          <select 
                            value={defaultSection} 
                            onChange={e => setDefaultSection(e.target.value)}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #a5b4fc', fontSize: '12.5px', fontWeight: '600' }}
                          >
                            {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                          </select>
                        </div>
                      )}

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Batch</label>
                        <input 
                          type="text" 
                          value={defaultBatch} 
                          onChange={e => setDefaultBatch(e.target.value)} 
                          style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Auth Creation Checkbox Notice */}
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShieldCheck size={20} color="#059669" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: '12.5px', color: '#065f46' }}>
                      <strong>Automatic Login Creation Active:</strong> Each student's <strong>Personal Email</strong> will be set as their Login ID with password <code>Rvce@&lt;RegisterNumber&gt;</code> (or custom in CSV). They can directly log in on the College Portal login page.
                    </div>
                  </div>

                  {/* Dropzone */}
                  <div style={{ border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '36px 20px', textAlign: 'center', background: '#f8fafc', position: 'relative' }}>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileChange}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                    <Upload size={38} color="#94a3b8" style={{ marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontWeight: '600', color: '#334155', fontSize: '14px' }}>
                      Click or drag your CSV / Excel student roster file here
                    </p>
                    <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '12.5px' }}>
                      Supports .csv, .xlsx, .xls
                    </p>
                    {uploadFile && (
                      <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: '#e0e7ff', color: '#3730a3', borderRadius: '6px', fontWeight: '600', fontSize: '13px' }}>
                        <FileSpreadsheet size={16} /> {uploadFile.name} ({uploadPreview.length} students)
                      </div>
                    )}
                  </div>

                  {/* Errors */}
                  {uploadErrors.length > 0 && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '14px', color: '#b91c1c' }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <AlertCircle size={16} /> File Validation Warnings:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px' }}>
                        {uploadErrors.slice(0, 5).map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                        {uploadErrors.length > 5 && <li>...and {uploadErrors.length - 5} more</li>}
                      </ul>
                    </div>
                  )}

                  {/* Preview Table */}
                  {uploadPreview.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                          Previewing ({uploadPreview.length} students):
                        </div>
                        <button
                          type="button"
                          onClick={handleDownloadTemplate}
                          style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}
                        >
                          Download Sample Template
                        </button>
                      </div>

                      <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                          <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                            <tr style={{ color: '#475569' }}>
                              <th style={{ padding: '8px 12px' }}>Reg No</th>
                              <th style={{ padding: '8px 12px' }}>Name</th>
                              <th style={{ padding: '8px 12px' }}>Section</th>
                              <th style={{ padding: '8px 12px' }}>Personal Email (Login ID)</th>
                              <th style={{ padding: '8px 12px' }}>College Email</th>
                              <th style={{ padding: '8px 12px' }}>Default Password</th>
                            </tr>
                          </thead>
                          <tbody>
                            {uploadPreview.map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '8px 12px', fontWeight: '600', color: '#1e3a8a' }}>{row.regNo}</td>
                                <td style={{ padding: '8px 12px' }}>{row.name}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  <span style={{ padding: '2px 6px', background: '#e0e7ff', color: '#4338ca', borderRadius: '4px', fontWeight: '700' }}>
                                    Sec {row.section}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 12px', color: '#0f172a', fontWeight: '500' }}>{row.personalEmail}</td>
                                <td style={{ padding: '8px 12px', color: '#64748b' }}>{row.collegeEmail || '-'}</td>
                                <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{row.password}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Progress Indicator */}
                  {uploadLoading && (
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e40af', marginBottom: '8px' }}>
                        Creating Student Records & Login Accounts... ({uploadProgress.current} / {uploadProgress.total})
                      </div>
                      <div style={{ width: '100%', height: '8px', background: '#dbeafe', borderRadius: '4px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${(uploadProgress.current / (uploadProgress.total || 1)) * 100}%`, 
                            height: '100%', 
                            background: '#2563eb', 
                            transition: 'width 0.2s ease' 
                          }} 
                        />
                      </div>
                    </div>
                  )}

                </div>

                {/* Footer */}
                <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    onClick={() => setIsUploadOpen(false)}
                    disabled={uploadLoading}
                    style={{ padding: '9px 16px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmUpload}
                    disabled={uploadPreview.length === 0 || uploadLoading}
                    style={{
                      padding: '9px 20px',
                      background: (uploadPreview.length === 0 || uploadLoading) ? '#94a3b8' : '#4f46e5',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: (uploadPreview.length === 0 || uploadLoading) ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {uploadLoading ? 'Onboarding Students...' : `Confirm & Enroll ${uploadPreview.length} Students`}
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* Export Credentials Notification Modal */}
          {isExportOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
              <div style={{ background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '12px', padding: '24px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                  <CheckCircle2 size={32} />
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                  Student Onboarding Complete!
                </h3>
                <p style={{ fontSize: '13.5px', color: '#64748b', margin: '0 0 20px 0', lineHeight: '1.5' }}>
                  Successfully enrolled {createdCredentials.length} students. Their Supabase Login credentials have been generated using their <strong>Personal Email</strong>.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    onClick={() => {
                      handleExportCredentials(createdCredentials);
                      setIsExportOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '11px',
                      background: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Download size={16} /> Download Credentials Sheet (.xlsx)
                  </button>
                  <button
                    onClick={() => setIsExportOpen(false)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      color: '#475569',
                      fontWeight: '500',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Done
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