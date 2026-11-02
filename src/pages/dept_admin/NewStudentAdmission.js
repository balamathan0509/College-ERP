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
  ShieldCheck,
  BookOpen,
  RefreshCw,
  ChevronRight,
  Info,
  UserPlus,
  Building2,
  LayoutGrid,
  FileText,
  Search,
  Filter,
  RotateCcw,
  Check,
  Layers,
  Copy,
  MapPin,
  User,
  Phone,
  Calendar
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
      return `${emailPrefix}@9525`;
    }
  }
  if (regNo) {
    return `${regNo}@9525`;
  }
  return `student@9525`;
}

function generateCollegeEmail(regNo, dept) {
  return `${regNo}@rvce.ac.in`;
}

// Helper to format dates cleanly from Excel serials, ISO dates, or Date objects
function formatDisplayDate(val) {
  if (!val) return '—';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '—';
    const d = String(val.getDate()).padStart(2, '0');
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const y = val.getFullYear();
    return `${d}/${m}/${y}`;
  }
  const s = String(val).trim();
  if (!s || s === '—' || s === '-' || s === 'null' || s === 'undefined') return '—';
  // Check if it's an Excel serial date number (e.g. 46120 or 38245)
  if (/^\d{4,5}$/.test(s)) {
    const num = Number(s);
    if (num > 1000 && num < 70000) {
      // 25569 is Jan 1, 1970 in Excel epoch
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        const d = String(date.getUTCDate()).padStart(2, '0');
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const y = date.getUTCFullYear();
        return `${d}/${m}/${y}`;
      }
    }
  }
  // If date is in ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const parts = s.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return s;
}

// Extract initials for avatar
function getInitials(name) {
  if (!name) return 'ST';
  const clean = String(name).replace(/[^a-zA-Z\s]/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return 'ST';
}

// Smart field extractor that checks direct names + normalized match (ignoring spaces, casing, punctuation)
function getField(row, aliases = []) {
  if (!row) return '';
  const rowKeys = Object.keys(row);
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null) {
      if (row[alias] instanceof Date) return formatDisplayDate(row[alias]);
      if (String(row[alias]).trim() !== '') return String(row[alias]).trim();
    }
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const k of rowKeys) {
      const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanK === cleanAlias && row[k] !== undefined && row[k] !== null) {
        if (row[k] instanceof Date) return formatDisplayDate(row[k]);
        if (String(row[k]).trim() !== '') return String(row[k]).trim();
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

// Smart year and semester detection from various column names & values
function detectYearAndSemester(row, regNo, currentYear = 2026) {
  // 1. Direct Semester
  const csvSem = getField(row, ['Semester', 'sem', 'Sem', 'currentSemester', 'Current Semester', 'Current semester']);
  if (csvSem) {
    const semNum = parseInt(String(csvSem).replace(/\D/g, ''), 10);
    if (semNum >= 1 && semNum <= 8) {
      return { year: getYearFromSemester(semNum), semester: String(semNum) };
    }
  }

  // 2. Year / Academic Year / Class
  const csvYear = getField(row, ['Year', 'year', 'Academic Year', 'studentYear', 'Current Year', 'Class', 'Yr', 'Batch Year', 'Degree & Year']);
  if (csvYear) {
    const y = String(csvYear).trim().toUpperCase();
    if (y.includes('4') || y.includes('FOURTH') || y.includes('FINAL') || y === 'IV' || y.startsWith('IV ') || y.endsWith(' IV') || y.includes('IV-') || y.includes('IV -')) {
      return { year: '4th Year', semester: '7' };
    }
    if (y.includes('3') || y.includes('THIRD') || y === 'III' || y.startsWith('III ') || y.endsWith(' III') || y.includes('III-') || y.includes('III -')) {
      return { year: '3rd Year', semester: '5' };
    }
    if (y.includes('2') || y.includes('SECOND') || y === 'II' || y.startsWith('II ') || y.endsWith(' II') || y.includes('II-') || y.includes('II -')) {
      return { year: '2nd Year', semester: '3' };
    }
    if (y.includes('1') || y.includes('FIRST') || y === 'I' || y.startsWith('I ') || y.endsWith(' I') || y.includes('I-') || y.includes('I -')) {
      return { year: '1st Year', semester: '1' };
    }
  }

  // 3. Fallback: Detect from Register Number admission year digits (e.g. 952523104001 -> 23)
  if (regNo && regNo.length >= 6) {
    const m = regNo.match(/9525(\d{2})/);
    if (m) {
      const joinYr = parseInt(m[1], 10);
      const cur2Digit = currentYear % 100;
      const diff = cur2Digit - joinYr;
      if (diff <= 0) return { year: '1st Year', semester: '1' };
      if (diff === 1) return { year: '2nd Year', semester: '3' };
      if (diff === 2) return { year: '3rd Year', semester: '5' };
      if (diff >= 3) return { year: '4th Year', semester: '7' };
    }
  }

  return { year: '1st Year', semester: '1' };
}

// Normalize Department to standard college department codes
function normalizeDepartment(rawDept, regNo, fallbackDept = 'CSE') {
  let d = String(rawDept || '').toUpperCase().trim();

  // If department column empty, detect from Anna Univ Reg Number branch code (e.g. 952523 104 001)
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

  if (d === 'CSE' || d.includes('COMPUTER SCIENCE') || d.includes('COMP. SCI') || d.includes('CS ') || d.endsWith(' CS')) {
    if (d.includes('BUSINESS') || d.includes('CSBS')) return 'CSBS';
    return 'CSE';
  }
  if (d === 'AIDS' || d === 'AI&DS' || d === 'AI & DS' || d.includes('ARTIFICIAL') || d.includes('DATA SCIENCE')) {
    return 'AIDS';
  }
  if (d === 'ECE' || d.includes('ELECTRONICS') || d.includes('COMMUNICATION')) {
    if (d.includes('ELECTRICAL')) return 'EEE';
    return 'ECE';
  }
  if (d === 'EEE' || d.includes('ELECTRICAL') || d.includes('TRIPLE E')) {
    return 'EEE';
  }
  if (d === 'IT' || d.includes('INFORMATION TECH') || d.includes('INFO TECH')) {
    return 'IT';
  }
  if (d === 'MECH' || d.includes('MECHANICAL')) {
    return 'MECH';
  }
  if (d === 'CSBS' || d.includes('BUSINESS SYSTEMS')) {
    return 'CSBS';
  }
  if (d === 'CIVIL') {
    return 'CIVIL';
  }
  return d;
}

// Normalize Section
function normalizeSection(rawSec) {
  if (!rawSec) return '';
  const s = String(rawSec).trim().toUpperCase();
  if (['NO', 'NONE', 'NIL', 'NULL', 'NA', 'N/A', 'SINGLE', 'SINGLE CLASS', '.', '-', '--', '0', 'NO SECTION'].includes(s)) {
    return ''; // Single class / unassigned section
  }
  if (s === 'A' || s === 'SEC A' || s === 'SECTION A' || s === 'SECTION-A' || s === 'A SEC') return 'A';
  if (s === 'B' || s === 'SEC B' || s === 'SECTION B' || s === 'SECTION-B' || s === 'B SEC') return 'B';
  if (s === 'C' || s === 'SEC C' || s === 'SECTION C' || s === 'SECTION-C' || s === 'C SEC') return 'C';
  if (s === 'D' || s === 'SEC D' || s === 'SECTION D' || s === 'SECTION-D' || s === 'D SEC') return 'D';
  if (s === 'E' || s === 'SEC E' || s === 'SECTION E' || s === 'SECTION-E' || s === 'E SEC') return 'E';
  return s;
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
  { id: 2, label: 'Completed', icon: CheckCircle2 }
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
  const [modalShowPassword, setModalShowPassword] = useState(false);
  const [profileActiveTab, setProfileActiveTab] = useState('all');

  // Filter states for Student Preview & Interactive Class Breakdown
  const [filterYear, setFilterYear] = useState('ALL');
  const [filterSection, setFilterSection] = useState('ALL');
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterSearch, setFilterSearch] = useState('');
  const [displayLimit, setDisplayLimit] = useState(25);

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
          where('role', '==', 'student')
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
    setFilterYear('ALL');
    setFilterSection('ALL');
    setFilterDept('ALL');
    setFilterSearch('');
    setDisplayLimit(25);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
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

          // Password (custom from CSV or student's personal email username + '@9525')
          const customPwd = getField(row, ['Password', 'password']);
          const password = customPwd || generatePassword(personalEmail, regNo);

          // Entire Student Details from Google Form / ERP data collection (leave empty if not filled)
          const details = {
            dob: formatDisplayDate(getField(row, ['Date of birth', 'DOB', 'Birth Date', 'BirthDate', 'DateOfBirth'])),
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
            dateOfAdmission: formatDisplayDate(getField(row, ['Date of admission', 'Date Of Admission', 'Admission Date'])),
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

          // 1. Auto-detect Year & Semester dynamically from row
          const { year: finalYear, semester: finalSem } = detectYearAndSemester(row, regNo, currentYear);

          // 2. Auto-detect Batch dynamically from CSV or calculated from detected year
          const csvBatch = getField(row, ['Batch', 'batch', 'Academic session', 'Session', 'batchYear', 'Regulation']);
          const finalBatch = csvBatch || calculateBatchForYear(finalYear, currentYear);

          // 3. Auto-detect & Normalize Department from CSV or Register Number
          const rawDept = getField(row, [
            'Department', 'dept', 'Branch', 'branch', 'department',
            'Programme', 'programme', 'Degree & Branch', 'Course', 'Stream', 'Major', 'dept_name'
          ]);
          const finalDept = normalizeDepartment(rawDept, regNo, dept);

          // 4. Auto-detect & Normalize Section from CSV
          const rawSection = getField(row, [
            'Section', 'section', 'Class', 'Sec', 'Division', 'sec', 'div', 'Class Section'
          ]);
          const finalSection = normalizeSection(rawSection);

          // Preserve all original CSV column names so every topic exists in DB
          const rawRowData = {};
          Object.keys(row).forEach(k => {
            const val = row[k];
            rawRowData[k.trim()] = val !== undefined && val !== null ? String(val).trim() : '';
          });

          return {
            regNo, name, personalEmail, mobile,
            dept: finalDept, year: finalYear, section: finalSection || '',
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

  // Dynamic categorization breakdown across parsed students with Year-wise Section detail
  const parsedBreakdown = useMemo(() => {
    if (studentsWithDuplicateFlag.length === 0) return null;

    const depts = {};
    const years = {};
    const sections = {};
    const yearWiseMap = {};

    studentsWithDuplicateFlag.forEach(r => {
      // Dept count
      depts[r.dept] = (depts[r.dept] || 0) + 1;
      // Year count
      years[r.year] = (years[r.year] || 0) + 1;
      // Overall section label count
      const secLabel = r.section ? `Sec ${r.section.toUpperCase()}` : 'Single Class';
      sections[secLabel] = (sections[secLabel] || 0) + 1;

      // Group per Year
      const yr = r.year || 'Unknown Year';
      if (!yearWiseMap[yr]) {
        yearWiseMap[yr] = {
          year: yr,
          semesters: new Set(),
          total: 0,
          sections: {}, // { 'A': count, 'B': count, 'SINGLE': count }
          depts: {},
          duplicates: 0,
          hostellers: 0,
          dayscholars: 0
        };
      }

      const yItem = yearWiseMap[yr];
      yItem.total += 1;
      if (r.semester) yItem.semesters.add(String(r.semester));

      const secKey = r.section ? r.section.toUpperCase() : 'SINGLE';
      yItem.sections[secKey] = (yItem.sections[secKey] || 0) + 1;

      yItem.depts[r.dept] = (yItem.depts[r.dept] || 0) + 1;
      if (r.isDuplicate) yItem.duplicates += 1;
      if (r.studentType === 'hosteller') yItem.hostellers += 1;
      else yItem.dayscholars += 1;
    });

    const yearOrder = { '1st Year': 1, '2nd Year': 2, '3rd Year': 3, '4th Year': 4 };
    const sortedYears = Object.keys(yearWiseMap).sort((a, b) => {
      const ordA = yearOrder[a] || 99;
      const ordB = yearOrder[b] || 99;
      return ordA - ordB;
    }).map(yrKey => {
      const data = yearWiseMap[yrKey];
      return {
        ...data,
        semestersList: Array.from(data.semesters).sort()
      };
    });

    return {
      depts,
      years,
      sections,
      sortedYears,
      totalStudents: studentsWithDuplicateFlag.length
    };
  }, [studentsWithDuplicateFlag]);

  // Filtered students for interactive drill-down preview table
  const filteredStudents = useMemo(() => {
    return studentsWithDuplicateFlag.filter(s => {
      // 1. Year filter
      if (filterYear !== 'ALL' && s.year !== filterYear) {
        return false;
      }
      // 2. Section filter
      if (filterSection !== 'ALL') {
        if (filterSection === 'SINGLE') {
          if (s.section && s.section.trim() !== '') return false;
        } else {
          if ((s.section || '').toUpperCase() !== filterSection.toUpperCase()) return false;
        }
      }
      // 3. Dept filter
      if (filterDept !== 'ALL' && s.dept !== filterDept) {
        return false;
      }
      // 4. Search text
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase().trim();
        const matchReg = (s.regNo || '').toLowerCase().includes(q);
        const matchName = (s.name || '').toLowerCase().includes(q);
        const matchEmail = (s.personalEmail || '').toLowerCase().includes(q);
        const matchMobile = (s.mobile || '').includes(q);
        if (!matchReg && !matchName && !matchEmail && !matchMobile) {
          return false;
        }
      }
      return true;
    });
  }, [studentsWithDuplicateFlag, filterYear, filterSection, filterDept, filterSearch]);

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
      toast.success(`${success.length} students added successfully!`);
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
    setFilterYear('ALL');
    setFilterSection('ALL');
    setFilterDept('ALL');
    setFilterSearch('');
    setDisplayLimit(25);
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh' }}>

          {/* Page Header */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '6px' }}>
              <div style={{
                background: '#0f172a',
                color: '#ffffff',
                padding: '10px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <UserPlus size={22} />
              </div>
              <div>
                <h1 style={{
                  margin: 0,
                  fontSize: '22px',
                  fontWeight: '700',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  color: '#0f172a'
                }}>
                  New Student Add
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px', marginTop: '2px' }}>
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
                    border: `1.5px dashed ${uploadFile ? '#0f172a' : '#cbd5e1'}`,
                    borderRadius: '12px', padding: '40px 24px', cursor: 'pointer',
                    background: uploadFile ? '#f8fafc' : '#ffffff',
                    transition: 'all 0.15s ease', marginBottom: '20px'
                  }}
                >
                  <div style={{
                    background: uploadFile ? '#0f172a' : '#f1f5f9',
                    padding: '14px', borderRadius: '50%', marginBottom: '12px',
                    color: uploadFile ? '#ffffff' : '#64748b'
                  }}>
                    <FileSpreadsheet size={28} />
                  </div>
                  {uploadFile ? (
                    <>
                      <p style={{ margin: 0, fontWeight: '700', color: '#0f172a', fontSize: '15px' }}>
                        {uploadFile.name}
                      </p>
                      <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
                        {rawRows.length} students detected from file
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: 0, fontWeight: '600', color: '#0f172a', fontSize: '14px' }}>
                        Drop CSV / Excel here or click to browse
                      </p>
                      <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '12.5px' }}>
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
                    {/* File Distribution Summary (Professional ERP Layout with Interactive Drilldown - Crisp Box Outlines) */}
                    {parsedBreakdown && (
                      <div style={{
                        background: '#ffffff',
                        border: '1.5px solid #94a3b8',
                        borderRadius: '12px',
                        padding: '18px 20px',
                        marginBottom: '18px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                      }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              background: '#f1f5f9',
                              color: '#0f172a',
                              padding: '8px',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1.5px solid #94a3b8'
                            }}>
                              <Layers size={17} />
                            </div>
                            <div>
                              <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '15px' }}>
                                Class & Section Enrollment Breakdown
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>
                                Click any Year or Class/Section to filter students below
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', background: '#f8fafc', border: '1.5px solid #cbd5e1', padding: '4px 10px', borderRadius: '6px', color: '#334155', fontWeight: '600' }}>
                              Total Records: <strong style={{ color: '#0f172a' }}>{rawRows.length}</strong>
                            </span>
                            {(filterYear !== 'ALL' || filterSection !== 'ALL' || filterDept !== 'ALL' || filterSearch) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setFilterYear('ALL');
                                  setFilterSection('ALL');
                                  setFilterDept('ALL');
                                  setFilterSearch('');
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  color: '#0f172a',
                                  background: '#ffffff',
                                  border: '1.5px solid #94a3b8',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <RotateCcw size={12} /> Clear Filter
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Quick Filter Bar (All + Depts) */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap',
                          padding: '10px 12px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1.5px solid #cbd5e1',
                          marginBottom: '16px'
                        }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '4px' }}>
                            Filter:
                          </span>

                          {/* "All Students" Pill */}
                          <button
                            type="button"
                            onClick={() => {
                              setFilterYear('ALL');
                              setFilterSection('ALL');
                              setFilterDept('ALL');
                            }}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              border: (filterYear === 'ALL' && filterSection === 'ALL' && filterDept === 'ALL') ? '1.5px solid #0f172a' : '1.5px solid #94a3b8',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              transition: 'all 0.15s ease',
                              background: (filterYear === 'ALL' && filterSection === 'ALL' && filterDept === 'ALL') ? '#0f172a' : '#ffffff',
                              color: (filterYear === 'ALL' && filterSection === 'ALL' && filterDept === 'ALL') ? '#ffffff' : '#0f172a'
                            }}
                          >
                            {(filterYear === 'ALL' && filterSection === 'ALL' && filterDept === 'ALL') && <Check size={12} />}
                            All Students ({rawRows.length})
                          </button>

                          {/* Department filter chips */}
                          {Object.entries(parsedBreakdown.depts).map(([d, cnt]) => {
                            const isDeptActive = filterDept === d;
                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setFilterDept(prev => prev === d ? 'ALL' : d)}
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  border: isDeptActive ? '1.5px solid #0f172a' : '1.5px solid #94a3b8',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.15s ease',
                                  background: isDeptActive ? '#0f172a' : '#ffffff',
                                  color: isDeptActive ? '#ffffff' : '#0f172a'
                                }}
                              >
                                {isDeptActive && <Check size={12} />}
                                Dept: {d} ({cnt})
                              </button>
                            );
                          })}
                        </div>

                        {/* Hierarchical Year & Section Cards */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                          gap: '14px'
                        }}>
                          {parsedBreakdown.sortedYears.map((yData) => {
                            const isYearSelected = filterYear === yData.year;
                            const isAllSectionsInYear = isYearSelected && filterSection === 'ALL';

                            // Sort sections alphabetically: A, B, C, D, E, then SINGLE
                            const sortedSectionEntries = Object.entries(yData.sections).sort(([keyA], [keyB]) => {
                              const order = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'SINGLE': 99 };
                              return (order[keyA] || 50) - (order[keyB] || 50);
                            });

                            return (
                              <div
                                key={yData.year}
                                style={{
                                  background: isYearSelected ? '#f8fafc' : '#ffffff',
                                  border: isYearSelected ? '2px solid #0f172a' : '1.5px solid #94a3b8',
                                  borderRadius: '10px',
                                  padding: '14px 16px',
                                  boxShadow: isYearSelected ? '0 0 0 1px #0f172a, 0 4px 10px rgba(0,0,0,0.06)' : '0 1px 3px rgba(0,0,0,0.03)',
                                  transition: 'all 0.15s ease',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between'
                                }}
                              >
                                {/* Year Header (Clickable to select whole year) */}
                                <div>
                                  <div
                                    onClick={() => {
                                      if (isYearSelected && filterSection === 'ALL') {
                                        setFilterYear('ALL');
                                        setFilterSection('ALL');
                                      } else {
                                        setFilterYear(yData.year);
                                        setFilterSection('ALL');
                                      }
                                    }}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      cursor: 'pointer',
                                      paddingBottom: '10px',
                                      borderBottom: '1.5px solid #cbd5e1'
                                    }}
                                    title="Click to filter students for this entire year"
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{
                                        width: '30px',
                                        height: '30px',
                                        borderRadius: '6px',
                                        background: '#f1f5f9',
                                        color: '#0f172a',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '1px solid #cbd5e1'
                                      }}>
                                        <GraduationCap size={16} />
                                      </div>
                                      <div>
                                        <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>
                                          {yData.year}
                                        </span>
                                        {yData.semestersList.length > 0 && (
                                          <span style={{ marginLeft: '6px', fontSize: '11px', color: '#334155', background: '#f1f5f9', border: '1px solid #94a3b8', padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>
                                            Sem {yData.semestersList.join(', ')}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{
                                        fontSize: '11.5px',
                                        fontWeight: '600',
                                        color: isAllSectionsInYear ? '#ffffff' : '#0f172a',
                                        background: isAllSectionsInYear ? '#0f172a' : '#f1f5f9',
                                        border: isAllSectionsInYear ? '1.5px solid #0f172a' : '1.5px solid #94a3b8',
                                        padding: '3px 9px',
                                        borderRadius: '6px'
                                      }}>
                                        {isAllSectionsInYear && <Check size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />}{yData.total} Students
                                      </span>
                                    </div>
                                  </div>

                                  {/* Sections Breakdown inside this Year */}
                                  <div style={{ marginTop: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                      <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        Sections & Classes
                                      </span>
                                      <span style={{ color: '#64748b', fontSize: '10px' }}>
                                        Click to filter
                                      </span>
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                      {sortedSectionEntries.map(([secKey, count]) => {
                                        const isSecSelected = isYearSelected && filterSection === secKey;
                                        const label = secKey === 'SINGLE' ? 'Single Class' : `Sec ${secKey}`;

                                        return (
                                          <button
                                            key={secKey}
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (isYearSelected && filterSection === secKey) {
                                                setFilterSection('ALL');
                                              } else {
                                                setFilterYear(yData.year);
                                                setFilterSection(secKey);
                                              }
                                            }}
                                            style={{
                                              padding: '5px 10px',
                                              borderRadius: '6px',
                                              fontSize: '12px',
                                              fontWeight: '600',
                                              cursor: 'pointer',
                                              border: isSecSelected ? '1.5px solid #0f172a' : '1.5px solid #94a3b8',
                                              background: isSecSelected ? '#0f172a' : '#ffffff',
                                              color: isSecSelected ? '#ffffff' : '#0f172a',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '6px',
                                              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                              transition: 'all 0.15s ease'
                                            }}
                                            title={`Click to filter students for ${yData.year} ${label}`}
                                          >
                                            {isSecSelected && <Check size={11} />}
                                            <span>{label}</span>
                                            <span style={{
                                              background: isSecSelected ? '#334155' : '#f1f5f9',
                                              color: isSecSelected ? '#ffffff' : '#0f172a',
                                              border: isSecSelected ? 'none' : '1px solid #cbd5e1',
                                              padding: '1px 6px',
                                              borderRadius: '4px',
                                              fontSize: '11px',
                                              fontWeight: '700'
                                            }}>
                                              {count}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>

                                {/* Bottom card meta details */}
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginTop: '12px',
                                  paddingTop: '10px',
                                  borderTop: '1.5px solid #cbd5e1',
                                  fontSize: '11.5px',
                                  color: '#475569'
                                }}>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <span>Hosteller: <strong style={{ color: '#0f172a' }}>{yData.hostellers}</strong></span>
                                    <span>•</span>
                                    <span>Dayscholar: <strong style={{ color: '#0f172a' }}>{yData.dayscholars}</strong></span>
                                  </div>
                                  {yData.duplicates > 0 && (
                                    <span style={{ color: '#0f172a', background: '#f1f5f9', border: '1px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>
                                      <AlertCircle size={11} color="#64748b" /> {yData.duplicates} dup
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Preview Table Header & Search Filter */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px',
                      flexWrap: 'wrap',
                      gap: '10px',
                      fontFamily: "'Plus Jakarta Sans', sans-serif"
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Users size={15} color="#475569" /> Student List Preview
                        </div>

                        {/* Active Filter Badge */}
                        {(filterYear !== 'ALL' || filterSection !== 'ALL' || filterDept !== 'ALL') ? (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            color: '#0f172a',
                            fontWeight: '600'
                          }}>
                            <Filter size={11} />
                            Viewing: {filterYear !== 'ALL' ? filterYear : 'All Years'}
                            {filterSection !== 'ALL' && (filterSection === 'SINGLE' ? ' • Single Class' : ` • Sec ${filterSection}`)}
                            {filterDept !== 'ALL' && ` • Dept: ${filterDept}`}
                            <span style={{ color: '#64748b' }}>({filteredStudents.length} students)</span>
                            <X
                              size={12}
                              onClick={() => {
                                setFilterYear('ALL');
                                setFilterSection('ALL');
                                setFilterDept('ALL');
                              }}
                              style={{ cursor: 'pointer', marginLeft: '2px' }}
                              title="Reset filter"
                            />
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            Showing all classes ({filteredStudents.length} students)
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {/* Search Input */}
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <Search size={14} style={{ position: 'absolute', left: '10px', color: '#64748b' }} />
                          <input
                            type="text"
                            placeholder="Search Name, Reg No, Email..."
                            value={filterSearch}
                            onChange={(e) => setFilterSearch(e.target.value)}
                            style={{
                              padding: '6px 26px 6px 30px',
                              fontSize: '12px',
                              borderRadius: '6px',
                              border: '1.5px solid #94a3b8',
                              outline: 'none',
                              width: '220px',
                              background: '#ffffff',
                              color: '#0f172a',
                              fontFamily: 'inherit'
                            }}
                          />
                          {filterSearch && (
                            <X
                              size={12}
                              onClick={() => setFilterSearch('')}
                              style={{ position: 'absolute', right: '8px', cursor: 'pointer', color: '#64748b' }}
                            />
                          )}
                        </div>

                        {/* Display Limit Dropdown */}
                        <select
                          value={displayLimit}
                          onChange={(e) => setDisplayLimit(Number(e.target.value))}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1.5px solid #94a3b8',
                            fontSize: '12px',
                            background: '#ffffff',
                            color: '#0f172a',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontFamily: 'inherit'
                          }}
                        >
                          <option value={25}>Show 25</option>
                          <option value={50}>Show 50</option>
                          <option value={100}>Show 100</option>
                          <option value={-1}>Show All ({filteredStudents.length})</option>
                        </select>
                      </div>
                    </div>

                    {/* Table Container with Crisp Visible Border */}
                    <div style={{
                      overflowX: 'auto',
                      maxHeight: '380px',
                      overflowY: 'auto',
                      borderRadius: '8px',
                      border: '1.5px solid #94a3b8',
                      background: '#ffffff',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr>
                            {['#', 'Reg No', 'Name', 'Dept', 'Year & Sem', 'Section', 'Personal Email (Login)', 'Mobile', 'Type', 'Details'].map(h => (
                              <th key={h} style={{
                                padding: '10px 12px',
                                textAlign: 'left',
                                fontWeight: '700',
                                color: '#0f172a',
                                borderBottom: '2px solid #94a3b8',
                                borderRight: '1px solid #e2e8f0',
                                whiteSpace: 'nowrap',
                                fontSize: '11px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em'
                              }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudents.length === 0 ? (
                            <tr>
                              <td colSpan="10" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                                <AlertCircle size={24} color="#94a3b8" style={{ margin: '0 auto 6px' }} />
                                <p style={{ fontWeight: '600', fontSize: '13px', margin: '0 0 4px', color: '#0f172a' }}>
                                  No students match the selected filter or search
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFilterYear('ALL');
                                    setFilterSection('ALL');
                                    setFilterDept('ALL');
                                    setFilterSearch('');
                                  }}
                                  style={{
                                    padding: '5px 12px',
                                    background: '#0f172a',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '11.5px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    marginTop: '6px'
                                  }}
                                >
                                  Reset All Filters
                                </button>
                              </td>
                            </tr>
                          ) : (
                            (displayLimit === -1 ? filteredStudents : filteredStudents.slice(0, displayLimit)).map((r, i) => (
                              <tr
                                key={i}
                                style={{
                                  borderBottom: '1px solid #cbd5e1',
                                  background: r.isDuplicate ? '#fffbeb' : '#ffffff'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                onMouseLeave={e => e.currentTarget.style.background = r.isDuplicate ? '#fffbeb' : '#ffffff'}
                              >
                                <td style={{ padding: '9px 12px', color: '#64748b', fontSize: '12px', textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>{i + 1}</td>
                                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', borderRight: '1px solid #f1f5f9' }}>
                                  <span style={{ fontWeight: '700', color: '#0f172a', fontFamily: 'monospace', fontSize: '12px' }}>
                                    {r.regNo}
                                  </span>
                                  {r.isDuplicate && (
                                    <span style={{ marginLeft: '6px', fontSize: '10px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '1px 5px', borderRadius: '4px', fontWeight: '600' }}>
                                      Duplicate
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '9px 12px', color: '#0f172a', fontWeight: '600', whiteSpace: 'nowrap', borderRight: '1px solid #f1f5f9' }}>{r.name}</td>
                                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', borderRight: '1px solid #f1f5f9' }}>
                                  <span style={{ fontWeight: '600', color: '#0f172a', background: '#f8fafc', border: '1.5px solid #cbd5e1', padding: '2px 7px', borderRadius: '4px', fontSize: '11px' }}>
                                    {r.dept}
                                  </span>
                                </td>
                                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', borderRight: '1px solid #f1f5f9' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                                    <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12px' }}>
                                      {r.year}
                                    </span>
                                    <span style={{ background: '#f8fafc', color: '#334155', border: '1.5px solid #cbd5e1', padding: '1px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '600' }}>
                                      Sem {r.semester}
                                    </span>
                                  </div>
                                </td>
                                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', borderRight: '1px solid #f1f5f9' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '2px 8px',
                                    borderRadius: '5px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    whiteSpace: 'nowrap',
                                    background: '#f8fafc',
                                    color: '#0f172a',
                                    border: '1.5px solid #cbd5e1'
                                  }}>
                                    {r.section ? 'Sec ' + r.section : 'Single Class'}
                                  </span>
                                </td>
                                <td style={{ padding: '9px 12px', color: '#0f172a', fontSize: '12px', whiteSpace: 'nowrap', borderRight: '1px solid #f1f5f9' }}>
                                  {r.personalEmail}
                                </td>
                                <td style={{ padding: '9px 12px', color: '#475569', fontSize: '12px', whiteSpace: 'nowrap', borderRight: '1px solid #f1f5f9' }}>
                                  {r.mobile || '—'}
                                </td>
                                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', borderRight: '1px solid #f1f5f9' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    whiteSpace: 'nowrap',
                                    textTransform: 'capitalize',
                                    background: '#f8fafc',
                                    color: '#0f172a',
                                    border: '1.5px solid #cbd5e1'
                                  }}>
                                    {r.studentType}
                                  </span>
                                </td>
                                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => setViewingStudent(r)}
                                    style={{
                                      padding: '3px 8px',
                                      background: '#ffffff',
                                      border: '1.5px solid #94a3b8',
                                      borderRadius: '5px',
                                      color: '#0f172a',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <Eye size={12} /> View
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                          {displayLimit !== -1 && filteredStudents.length > displayLimit && (
                            <tr>
                              <td colSpan="10" style={{ padding: '10px', textAlign: 'center', color: '#64748b', fontSize: '12px', background: '#f8fafc' }}>
                                Showing {displayLimit} of {filteredStudents.length} students.{' '}
                                <button
                                  type="button"
                                  onClick={() => setDisplayLimit(-1)}
                                  style={{ color: '#0f172a', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                  View all {filteredStudents.length} students
                                </button>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginTop: '14px' }}>
                      <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #94a3b8' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Total in File</div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{rawRows.length}</div>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #94a3b8' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Ready to Add</div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{newStudents.length}</div>
                      </div>
                      {duplicateStudents.length > 0 && (
                        <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #94a3b8' }}>
                          <div style={{ fontSize: '11px', color: '#b45309', fontWeight: '600' }}>Duplicates (Skip)</div>
                          <div style={{ fontSize: '20px', fontWeight: '700', color: '#b45309' }}>{duplicateStudents.length}</div>
                        </div>
                      )}
                      {(filterYear !== 'ALL' || filterSection !== 'ALL' || filterDept !== 'ALL' || filterSearch) && (
                        <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #94a3b8' }}>
                          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Filtered In View</div>
                          <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{filteredStudents.length}</div>
                        </div>
                      )}
                    </div>

                    {/* Duplicate warning banner */}
                    {duplicateStudents.length > 0 && (
                      <div style={{ marginTop: '12px', background: '#fafafa', border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px' }}>
                        <div style={{ color: '#0f172a', fontWeight: '600', fontSize: '12.5px', marginBottom: '2px' }}>
                          Duplicate Notice: {duplicateStudents.length} student{duplicateStudents.length > 1 ? 's' : ''} already registered (will be skipped):
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                          {duplicateStudents.slice(0, 3).map(s => `${s.regNo} (${s.name})`).join(', ')}
                          {duplicateStudents.length > 3 ? ` ...and ${duplicateStudents.length - 3} more` : ''}
                        </div>
                      </div>
                    )}

                    {/* Upload progress */}
                    {uploading && (
                      <div style={{ marginTop: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '14px' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a', marginBottom: '8px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <RefreshCw size={14} color="#0f172a" style={{ animation: 'spin 1s linear infinite' }} />
                          Adding students... {progress.current}/{progress.total}
                        </div>
                        <div style={{ background: '#e2e8f0', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                            background: '#0f172a',
                            borderRadius: '6px', transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                      </div>
                    )}

                    {/* Direct Action Button */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Password auto-set to <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#0f172a', border: '1px solid #e2e8f0' }}>&lt;email_username&gt;@9525</code> • Login ID: <strong>Personal Email</strong>
                      </div>
                      <button
                        onClick={handleConfirmUpload}
                        disabled={uploading || newStudents.length === 0}
                        style={{
                          padding: '10px 22px',
                          background: newStudents.length > 0 && !uploading ? '#0f172a' : '#cbd5e1',
                          border: 'none', borderRadius: '8px',
                          color: newStudents.length > 0 && !uploading ? '#ffffff' : '#94a3b8',
                          cursor: newStudents.length > 0 && !uploading ? 'pointer' : 'not-allowed',
                          fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <UserPlus size={16} />
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
              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1',
                padding: '36px 32px',
                maxWidth: '580px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
              }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  margin: '0 auto 16px',
                  background: '#f1f5f9',
                  border: '1.5px solid #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0f172a'
                }}>
                  <CheckCircle2 size={26} />
                </div>
                <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#0f172a', fontWeight: '700', fontSize: '20px', margin: '0 0 6px' }}>
                  Admission Complete
                </h2>
                <p style={{ color: '#64748b', fontSize: '13.5px', margin: '0 0 24px' }}>
                  {results.success.length} students have been successfully admitted to <strong>{dept}</strong> — {currentYear} batch
                </p>

                {/* Result stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '22px' }}>
                  {[
                    { label: 'Admitted', val: results.success.length },
                    { label: 'Skipped', val: results.skipped.length },
                    { label: 'Failed', val: results.failed.length }
                  ].map(({ label, val }) => (
                    <div key={label} style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{val}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Email notification status */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px', marginBottom: '22px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <Mail size={16} color="#475569" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '13px', marginBottom: '3px' }}>
                        Email Notifications Sent
                      </div>
                      <div style={{ color: '#64748b', fontSize: '12px', lineHeight: 1.5 }}>
                        Login credentials (Personal Email + Password) have been sent to each student's personal email and college email. Students can now login using their <strong>personal email as the login ID</strong>.
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleDownloadPDF}
                    style={{
                      padding: '10px 18px',
                      background: '#0f172a',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Download size={15} /> Download PDF (ID & Passwords)
                  </button>
                  <button
                    onClick={handleExportCredentials}
                    style={{
                      padding: '10px 18px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      color: '#0f172a',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <FileSpreadsheet size={15} /> Export Excel
                  </button>
                  <button
                    onClick={resetAll}
                    style={{
                      padding: '10px 18px',
                      background: '#2563eb',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <UserPlus size={15} /> Add More Students
                  </button>
                </div>
              </div>
            </div>
          )}
        {/* Modal: View Complete Student Details */}
        {viewingStudent && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '16px'
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '780px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              border: '1px solid #e2e8f0',
              fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#ffffff',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {/* Avatar */}
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: '#0f172a',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '17px',
                    fontWeight: '700',
                    letterSpacing: '0.02em',
                    flexShrink: 0
                  }}>
                    {getInitials(viewingStudent.name)}
                  </div>

                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a', lineHeight: 1.2 }}>
                      {viewingStudent.name}
                    </h3>
                    {/* Badges row */}
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        fontWeight: '600',
                        color: '#0f172a',
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        padding: '1px 7px',
                        borderRadius: '4px'
                      }}>
                        {viewingStudent.regNo}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#475569',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        padding: '1px 7px',
                        borderRadius: '4px'
                      }}>
                        Dept: {viewingStudent.dept || dept}
                      </span>
                      {viewingStudent.year && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: '#475569',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          padding: '1px 7px',
                          borderRadius: '4px'
                        }}>
                          {viewingStudent.year}{viewingStudent.semester ? ` • Sem ${viewingStudent.semester}` : ''}
                        </span>
                      )}
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#475569',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        padding: '1px 7px',
                        borderRadius: '4px'
                      }}>
                        {viewingStudent.section ? `Sec ${viewingStudent.section}` : 'Single Class'}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#475569',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        padding: '1px 7px',
                        borderRadius: '4px',
                        textTransform: 'capitalize'
                      }}>
                        {viewingStudent.studentType}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingStudent(null)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748b',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#64748b'; }}
                  title="Close (Esc)"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Clean Credentials Banner */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px 16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Key size={14} color="#0f172a" /> Portal Login Credentials
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Student logs in using Personal Email & Default Password
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
                    {/* Personal Email */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '9px 12px' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                        Personal Email (Login ID)
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '3px', gap: '6px' }}>
                        <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', wordBreak: 'break-all' }}>
                          {viewingStudent.personalEmail}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(viewingStudent.personalEmail);
                            toast.success('Personal Email copied!');
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '3px', display: 'flex', alignItems: 'center' }}
                          title="Copy Email"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>

                    {/* College Email */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '9px 12px' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                        Official College Email
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '3px', gap: '6px' }}>
                        <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', wordBreak: 'break-all' }}>
                          {viewingStudent.collegeEmail}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(viewingStudent.collegeEmail);
                            toast.success('College Email copied!');
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '3px', display: 'flex', alignItems: 'center' }}
                          title="Copy College Email"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Default Password */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '9px 12px' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                        Default Password
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '3px', gap: '6px' }}>
                        <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '12.5px', fontFamily: 'monospace' }}>
                          {modalShowPassword ? viewingStudent.password : '••••••••••••'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => setModalShowPassword(prev => !prev)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '3px', display: 'flex', alignItems: 'center' }}
                            title={modalShowPassword ? 'Hide password' : 'Show password'}
                          >
                            {modalShowPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(viewingStudent.password);
                              toast.success('Password copied!');
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '3px', display: 'flex', alignItems: 'center' }}
                            title="Copy Password"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section Filter Pills */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'all', label: 'All Info' },
                    { id: 'personal', label: 'Personal Details' },
                    { id: 'contact', label: 'Contact & Address' },
                    { id: 'academic', label: 'Academic & Admission' },
                    { id: 'family', label: 'Parents & Family' }
                  ].map(tab => {
                    const isActive = profileActiveTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setProfileActiveTab(tab.id)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          border: isActive ? '1px solid #0f172a' : '1px solid #e2e8f0',
                          background: isActive ? '#0f172a' : '#ffffff',
                          color: isActive ? '#ffffff' : '#475569'
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Profile Grid Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
                  {/* Card 1: Personal Profile */}
                  {(profileActiveTab === 'all' || profileActiveTab === 'personal') && (
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        paddingBottom: '8px',
                        borderBottom: '1px solid #f1f5f9'
                      }}>
                        <User size={13} /> Personal Details
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>Date of Birth</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                            {formatDisplayDate(viewingStudent.details?.dob)}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>Gender</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                            {viewingStudent.details?.gender || '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>Blood Group</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                            {viewingStudent.details?.bloodGroup || '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>Community / Caste</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                            {viewingStudent.details?.community || '—'} {viewingStudent.details?.caste ? `(${viewingStudent.details?.caste})` : ''}
                          </span>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>Aadhaar Number</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px', fontFamily: 'monospace' }}>
                            {viewingStudent.details?.aadhaarNumber || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card 2: Contact & Address */}
                  {(profileActiveTab === 'all' || profileActiveTab === 'contact') && (
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        paddingBottom: '8px',
                        borderBottom: '1px solid #f1f5f9'
                      }}>
                        <MapPin size={13} /> Contact & Address
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>Mobile Number</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                            {viewingStudent.mobile || '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>Pincode</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                            {viewingStudent.details?.pincode || '—'}
                          </span>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>District / State</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                            {viewingStudent.details?.district || '—'}, {viewingStudent.details?.state || '—'}
                          </span>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>Permanent Address</span>
                          <span style={{ fontWeight: '500', color: '#334155', fontSize: '12px', display: 'block', marginTop: '3px', lineHeight: 1.4, background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                            {viewingStudent.details?.address || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card 3: Academic & Admission */}
                  {(profileActiveTab === 'all' || profileActiveTab === 'academic') && (
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        paddingBottom: '8px',
                        borderBottom: '1px solid #f1f5f9'
                      }}>
                        <GraduationCap size={13} /> Admission & Academic
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>Admission No</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                            {viewingStudent.details?.admissionNumber || viewingStudent.csvData?.['Admission number'] || '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>Student Type</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px', textTransform: 'capitalize' }}>
                            {viewingStudent.studentType}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>Admission Type / Year</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                            {viewingStudent.details?.admissionType || viewingStudent.details?.admissionYear || '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>Regulation / Batch</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                            {viewingStudent.details?.regulation || '—'} ({viewingStudent.batch || '—'})
                          </span>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>EMIS / UMIS / APAAR</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                            {viewingStudent.details?.emisNumber || viewingStudent.details?.umisNumber || viewingStudent.details?.apaarId || '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>Scholarship</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                            {viewingStudent.details?.scholarship || '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>College Bus</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                            {viewingStudent.details?.usesCollegeBus || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card 4: Parents & Family */}
                  {(profileActiveTab === 'all' || profileActiveTab === 'family') && (
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        paddingBottom: '8px',
                        borderBottom: '1px solid #f1f5f9'
                      }}>
                        <Users size={13} /> Parents & Family
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>Father's Name</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                            {viewingStudent.details?.fatherName || '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>Father's Mobile</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                            {viewingStudent.details?.fatherMobile || '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>Mother's Name</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                            {viewingStudent.details?.motherName || '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>Mother's Mobile</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                            {viewingStudent.details?.motherMobile || '—'}
                          </span>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block' }}>Annual Income</span>
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                            {viewingStudent.details?.fatherIncome || viewingStudent.details?.motherIncome || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '14px 24px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                background: '#f8fafc',
                borderBottomLeftRadius: '16px',
                borderBottomRightRadius: '16px'
              }}>
                <button
                  type="button"
                  onClick={() => setViewingStudent(null)}
                  style={{
                    padding: '8px 18px',
                    background: '#0f172a',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '13px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#334155'}
                  onMouseLeave={e => e.currentTarget.style.background = '#0f172a'}
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
