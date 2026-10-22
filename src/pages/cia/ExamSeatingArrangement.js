import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../../components/Sidebar';
import DateTimeHeader from '../../components/DateTimeHeader';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../supabase/supabaseAdapter';
import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  orderBy, 
  where 
} from '../../supabase/supabaseAdapter';
import { 
  Printer, 
  Download, 
  Save, 
  Plus, 
  Trash2, 
  Users, 
  Grid, 
  FileText, 
  RotateCcw, 
  CheckCircle, 
  ArrowLeft,
  Sparkles,
  Eye,
  Building,
  Search,
  Check,
  UserCheck,
  BadgeAlert,
  Calendar,
  Layers,
  UserPlus,
  AlertTriangle
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import toast, { Toaster } from 'react-hot-toast';
import { COLLEGE_DEPARTMENTS, getAllCollegeClasses, ANNA_UNIV_DEPT_CODES } from '../../utils/collegeConfig';

const PRESET_HALLS = ["C 204", "A 301", "B 109", "B 110", "A 218", "B F08", "Seminar Hall 1", "Drawing Hall"];
const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
const LOCAL_STORAGE_KEY = "rvce_exam_seating_plans";

const CAPACITY_PRESETS = [
  { label: "50 Seats (Standard - 1 Staff)", rows: 5, pairs: 5, staffReq: 1 },
  { label: "60 Seats (Big Hall - 2 Staff)", rows: 6, pairs: 5, staffReq: 2 },
  { label: "80 Seats (Large Hall - 2 Staff)", rows: 8, pairs: 5, staffReq: 2 },
  { label: "100 Seats (Seminar/Auditorium - 2 Staff)", rows: 10, pairs: 5, staffReq: 2 }
];

export default function ExamSeatingArrangement() {
  const { userProfile } = useAuth();
  const printRef = useRef(null);

  const isStudent = userProfile?.role === 'student';
  const isStaff = userProfile?.role === 'staff' || userProfile?.role === 'hod';
  const isExamCellOrAdmin = userProfile?.role === 'exam_cell' || userProfile?.role === 'admin' || userProfile?.role === 'management';

  // Active Tab: students default to 'view', exam_cell defaults to 'generator'
  const [activeTab, setActiveTab] = useState(isStudent ? 'view' : 'generator'); 
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Available Exams & Staff from DB
  const [exams, setExams] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [savedPlans, setSavedPlans] = useState([]);

  // Selected Plan for viewing / printing (for staff & student view)
  const [selectedPlanId, setSelectedPlanId] = useState('');

  // Custom UI Confirmation Modal State (Replaces native browser window.confirm)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Delete",
    confirmColor: "#ef4444",
    onConfirm: null
  });

  const openConfirmDialog = ({ title, message, confirmText = "Confirm", confirmColor = "#ef4444", onConfirm }) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmText,
      confirmColor,
      onConfirm
    });
  };

  const closeConfirmDialog = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  // Student Search Seat State
  const [searchRegNo, setSearchRegNo] = useState(
    userProfile?.regNo || userProfile?.rollNo || userProfile?.registerNumber || ""
  );
  const [foundSeatInfo, setFoundSeatInfo] = useState(null);

  // Header & Invigilator Configuration (Supports 2 Staff for 50+ students)
  const [headerConfig, setHeaderConfig] = useState({
    collegeName: "RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING",
    collegeAddress: "Salvarpatti, Sivakasi– 626 128",
    examTitle: "INTERNAL 2026-09",
    hallNo: "C 204",
    invigilatorName: "Dr. K. Ramesh, AP/CSE",
    invigilatorDept: "CSE",
    invigilator2Name: "", // Staff 2 for big halls
    invigilator2Dept: "",
    examDate: "15-10-2026",
    examSession: "FN"
  });

  // Grid Configuration (Dynamic rows & pairs)
  const [numBenchPairs, setNumBenchPairs] = useState(5); // Roman I to V (10 cols)
  const [numRows, setNumRows] = useState(5); // 5 rows = 50, 6 rows = 60, 8 rows = 80, 10 rows = 100
  
  // Column Metadata: Array of column headers
  const [columnBatches, setColumnBatches] = useState([
    "III -cse", "III AI & DS",
    "III -cse", "III AI & DS",
    "III -cse", "III AI & DS",
    "III -cse", "III AI & DS",
    "III -cse", "III AI & DS"
  ]);

  // Seating Matrix: 2D array of [row][col] containing register numbers
  const [seatingGrid, setSeatingGrid] = useState(() => {
    const initialGrid = Array.from({ length: 5 }, () => Array(10).fill(''));
    let oddNum = 1;
    let evenNum = 1;
    for (let p = 0; p < 5; p++) {
      const oddCol = p * 2;
      const evenCol = p * 2 + 1;
      for (let r = 0; r < 5; r++) {
        initialGrid[r][oddCol] = `952523104${String(oddNum++).padStart(3, '0')}`;
        initialGrid[r][evenCol] = `952524243${String(evenNum++).padStart(3, '0')}`;
      }
    }
    return initialGrid;
  });

  // Dynamic Batches Generator Colors & Configuration
  const BATCH_COLORS = [
    { bg: '#eff6ff', border: '#bfdbfe', badgeBg: '#2563eb', badgeText: '#fff', text: '#1e3a8a' }, // A (Blue)
    { bg: '#f0fdf4', border: '#bbf7d0', badgeBg: '#16a34a', badgeText: '#fff', text: '#14532d' }, // B (Green)
    { bg: '#faf5ff', border: '#e9d5ff', badgeBg: '#9333ea', badgeText: '#fff', text: '#581c87' }, // C (Purple)
    { bg: '#fff7ed', border: '#fed7aa', badgeBg: '#ea580c', badgeText: '#fff', text: '#7c2d12' }, // D (Orange)
    { bg: '#fdf2f8', border: '#fbcfe8', badgeBg: '#db2777', badgeText: '#fff', text: '#831843' }, // E (Pink)
    { bg: '#f0fdfa', border: '#99f6e4', badgeBg: '#0d9488', badgeText: '#fff', text: '#134e4a' }, // F (Teal)
  ];
  const BATCH_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

  // Dynamic Generator State: Supports 1 class (A only), 2 classes (A & B), or 3+ classes (A, B, C, D...)
  const [batches, setBatches] = useState([
    {
      id: "A",
      deptName: "III -cse",
      mode: "range",
      prefix: "952523104",
      startNo: "001",
      endNo: "025",
      count: 25,
      excludeNos: "",
      pastedText: ""
    },
    {
      id: "B",
      deptName: "III AI & DS",
      mode: "range",
      prefix: "952524243",
      startNo: "001",
      endNo: "025",
      count: 25,
      excludeNos: "",
      pastedText: ""
    }
  ]);

  // Seating arrangement style:
  // 'compact': 2 students per bench (Pairs batches cleanly; extra/solo classes fill left & right consecutively)
  // 'single_per_bench': Extra/solo classes get 1 student per bench (Left seat only, right seat is vacant gap)
  const [singleBatchSeatingType, setSingleBatchSeatingType] = useState('compact');

  // Add a new batch (Batch C, D, E...)
  const handleAddBatch = () => {
    if (batches.length >= 6) {
      toast.error("Maximum 6 classes can be configured.");
      return;
    }
    const nextIdx = batches.length;
    const nextLetter = BATCH_LETTERS[nextIdx];
    const totalHallSeats = numRows * numBenchPairs * 2;
    const splitCount = Math.floor(totalHallSeats / (batches.length + 1));

    const defaultConfigs = [
      { name: "III - ECE", prefix: "952523106" },
      { name: "III - EEE", prefix: "952523105" },
      { name: "III - IT", prefix: "952523205" },
      { name: "III - MECH", prefix: "952523114" },
      { name: "III - CSBS", prefix: "952523244" }
    ];
    const def = defaultConfigs[nextIdx - 2] || { name: `Class ${nextLetter}`, prefix: `95252310${nextIdx}` };
    const newBatch = {
      id: nextLetter,
      deptName: def.name,
      mode: "range",
      prefix: def.prefix,
      startNo: "001",
      endNo: String(splitCount).padStart(3, '0'),
      count: splitCount,
      excludeNos: "",
      pastedText: ""
    };
    setBatches(prev => [...prev, newBatch]);
    toast.success(`Batch ${nextLetter} added! Total classes: ${batches.length + 1}`);
  };

  // Remove a batch (can remove until 1 class remains)
  const handleRemoveBatch = (indexToRemove) => {
    if (batches.length <= 1) {
      toast.error("At least 1 class must be configured.");
      return;
    }
    const filtered = batches.filter((_, idx) => idx !== indexToRemove);
    const updated = filtered.map((b, idx) => ({
      ...b,
      id: BATCH_LETTERS[idx]
    }));
    setBatches(updated);
    toast.success(`Class removed. Remaining classes in hall: ${updated.length}`);
  };

  // Update batch property with bidirectional sync of From No, To No, and Count
  const handleBatchFieldChange = (index, field, value) => {
    setBatches(prev => {
      const copy = [...prev];
      const current = { ...copy[index], [field]: value };

      if (field === 'deptName') {
        const up = String(value || '').toUpperCase();
        for (const [dept, code] of Object.entries(ANNA_UNIV_DEPT_CODES)) {
          if (up.includes(dept)) {
            const yearDigits = (current.prefix && current.prefix.length >= 6) ? current.prefix.slice(4, 6) : "23";
            current.prefix = `9525${yearDigits}${code}`;
            break;
          }
        }
      }

      if (field === 'startNo') {
        const startVal = parseInt(value, 10);
        const endVal = parseInt(current.endNo, 10);
        if (!isNaN(startVal) && !isNaN(endVal) && endVal >= startVal) {
          current.count = endVal - startVal + 1;
        } else if (!isNaN(startVal) && current.count > 0) {
          const pad = value.length || 3;
          current.endNo = String(startVal + current.count - 1).padStart(pad, '0');
        }
      } else if (field === 'endNo') {
        const endVal = parseInt(value, 10);
        const startVal = parseInt(current.startNo, 10) || 1;
        if (!isNaN(endVal)) {
          if (endVal >= startVal) {
            current.count = endVal - startVal + 1;
          } else {
            current.count = 1;
          }
        }
      } else if (field === 'count') {
        const countVal = parseInt(value, 10) || 0;
        current.count = countVal;
        const startVal = parseInt(current.startNo, 10) || 1;
        const pad = (current.startNo || "001").length;
        if (countVal > 0) {
          current.endNo = String(startVal + countVal - 1).padStart(pad, '0');
        }
      }

      copy[index] = current;
      return copy;
    });
  };

  useEffect(() => {
    fetchExams();
    fetchFaculties();
    fetchSavedPlans();
  }, []);

  // When userProfile loads, fill student search roll number
  useEffect(() => {
    if (userProfile?.regNo || userProfile?.rollNo) {
      setSearchRegNo(userProfile?.regNo || userProfile?.rollNo);
    }
  }, [userProfile]);

  async function fetchExams() {
    try {
      const q = query(collection(db, "cia_examinations"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExams(list);
    } catch (err) {
      console.warn("Error fetching exams:", err);
    }
  }

  // Fetch all staff / faculties to assign to halls
  async function fetchFaculties() {
    try {
      const snap = await getDocs(collection(db, "users"));
      const staffRoles = ["staff", "faculty", "teacher", "dept_admin", "hod"];
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => staffRoles.includes((u.role || '').toLowerCase()))
        .map(u => ({
          id: u.id,
          name: u.name || u.facultyName || u.email || "Faculty Member",
          dept: u.dept || u.department || "General",
          designation: u.designation || "Assistant Professor",
          staffId: u.staffId || u.employeeCode || ""
        }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setFaculties(list);
    } catch (err) {
      console.warn("Error fetching faculties:", err);
    }
  }

  // Load saved plans from LocalStorage + Supabase
  async function fetchSavedPlans() {
    let combined = [];

    // 1. Fetch from LocalStorage
    try {
      const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (localData) {
        combined = JSON.parse(localData);
      }
    } catch (e) {
      console.warn("Error reading localStorage plans:", e);
    }

    // 2. Fetch from Supabase exam_seating_plans
    try {
      const q = query(collection(db, "exam_seating_plans"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      snap.docs.forEach(d => {
        const docData = d.data() || {};
        const item = {
          ...docData,
          id: d.id, // Keep the real Supabase row ID so deleteDoc works!
          _docId: d.id,
          planId: docData.id || d.id
        };
        const existingIdx = combined.findIndex(c => c.id === item.id || c._docId === item._docId || (c.hallNo === item.hallNo && c.examTitle === item.examTitle));
        if (existingIdx >= 0) {
          combined[existingIdx] = { ...combined[existingIdx], _docId: item._docId, id: item.id };
        } else {
          combined.push(item);
        }
      });
    } catch (err) {
      console.warn("Supabase exam_seating_plans fetch:", err);
    }

    // 3. Fetch from fallback cia_exam_schedules (where isSeatingPlan == true)
    try {
      const qFallback = query(collection(db, "cia_exam_schedules"), where("isSeatingPlan", "==", true));
      const snapFallback = await getDocs(qFallback);
      snapFallback.docs.forEach(d => {
        const docData = d.data() || {};
        const item = {
          ...docData,
          id: d.id, // Keep the real Supabase row ID so deleteDoc works!
          _docId: d.id,
          planId: docData.id || d.id
        };
        const existingIdx = combined.findIndex(c => c.id === item.id || c._docId === item._docId || (c.hallNo === item.hallNo && c.examTitle === item.examTitle));
        if (existingIdx >= 0) {
          combined[existingIdx] = { ...combined[existingIdx], _docId: item._docId, id: item.id };
        } else {
          combined.push(item);
        }
      });
    } catch (err) {
      console.warn("Fallback cia_exam_schedules fetch:", err);
    }

    // Only provide demo plan if user has NEVER visited/saved before (localStorage is null, not empty array [])
    if (combined.length === 0 && localStorage.getItem(LOCAL_STORAGE_KEY) === null) {
      const demoPlan = createDefaultDemoPlan();
      combined = [demoPlan];
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(combined));
      } catch (e) {}
    }

    setSavedPlans(combined);
    if (combined.length > 0 && !selectedPlanId) {
      setSelectedPlanId(combined[0].id);
    }
  }

  // Create demo plan for instant viewing
  const createDefaultDemoPlan = () => {
    const demoGrid = Array.from({ length: 5 }, () => Array(10).fill(''));
    let oddNum = 1;
    let evenNum = 1;
    for (let p = 0; p < 5; p++) {
      const oddCol = p * 2;
      const evenCol = p * 2 + 1;
      for (let r = 0; r < 5; r++) {
        demoGrid[r][oddCol] = `952523104${String(oddNum++).padStart(3, '0')}`;
        demoGrid[r][evenCol] = `952524243${String(evenNum++).padStart(3, '0')}`;
      }
    }

    return {
      id: "demo_hall_c204",
      hallNo: "C 204",
      examTitle: "INTERNAL 2026-09",
      collegeName: "RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING",
      collegeAddress: "Salvarpatti, Sivakasi– 626 128",
      totalCandidates: 50,
      invigilatorName: "Dr. K. Ramesh, AP/CSE",
      invigilatorDept: "CSE",
      invigilator2Name: "",
      invigilator2Dept: "",
      examDate: "15-10-2026",
      examSession: "FN",
      columnBatches: [
        "III -cse", "III AI & DS",
        "III -cse", "III AI & DS",
        "III -cse", "III AI & DS",
        "III -cse", "III AI & DS",
        "III -cse", "III AI & DS"
      ],
      seatingGrid: demoGrid,
      numBenchPairs: 5,
      numRows: 5,
      createdAt: new Date().toISOString(),
      createdBy: "Exam Cell"
    };
  };

  // Total Hall Capacity calculation
  const totalHallCapacity = numRows * numBenchPairs * 2;

  // Helper to parse excluded numbers: handles "17, 23" or "17 23" or "017" or "952523104017"
  const parseExcludeNumbers = (excludeStr, prefix = "") => {
    if (!excludeStr) return new Set();
    const tokens = excludeStr.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean);
    const excludeSet = new Set();
    tokens.forEach(tok => {
      if (prefix && tok.startsWith(prefix)) {
        const sliced = tok.slice(prefix.length);
        const num = parseInt(sliced, 10);
        if (!isNaN(num)) excludeSet.add(num);
      } else {
        const num = parseInt(tok, 10);
        if (!isNaN(num)) excludeSet.add(num);
      }
    });
    return excludeSet;
  };

  // Helper to generate a list of register numbers from range
  const generateListFromRange = (prefix, startStr, count, endStr, excludeStr) => {
    const list = [];
    let startVal = parseInt(startStr, 10) || 1;
    let endVal = parseInt(endStr, 10);
    const padLen = (startStr || "").length || 3;
    const excludeSet = parseExcludeNumbers(excludeStr, prefix);

    let totalCount = parseInt(count, 10);
    if (!isNaN(endVal) && endVal >= startVal) {
      for (let num = startVal; num <= endVal; num++) {
        if (!excludeSet.has(num)) {
          const currentNum = num.toString().padStart(padLen, '0');
          list.push(`${prefix}${currentNum}`);
        }
      }
    } else {
      if (isNaN(totalCount) || totalCount <= 0) totalCount = 1;
      let currentVal = startVal;
      while (list.length < totalCount) {
        if (!excludeSet.has(currentVal)) {
          const currentNum = currentVal.toString().padStart(padLen, '0');
          list.push(`${prefix}${currentNum}`);
        }
        currentVal++;
      }
    }
    return list;
  };

  // Calculate total students entered across all class batches
  const totalStudentsEntered = batches.reduce((sum, b) => {
    if (b.mode === 'range') {
      const sList = generateListFromRange(b.prefix, b.startNo, b.count, b.endNo, b.excludeNos);
      return sum + sList.length;
    }
    return sum + (parsePastedList(b.pastedText) || []).length;
  }, 0);

  // Directly update layout (Rows & Bench Pairs)
  const handleUpdateLayout = (newRows, newPairs) => {
    const validRows = Math.max(2, Math.min(25, newRows));
    const validPairs = Math.max(1, Math.min(20, newPairs));
    setNumRows(validRows);
    setNumBenchPairs(validPairs);

    const totalCols = validPairs * 2;
    // Resize seating grid safely
    const resized = Array.from({ length: validRows }, (_, r) => {
      return Array.from({ length: totalCols }, (_, c) => {
        return seatingGrid[r]?.[c] || '';
      });
    });
    setSeatingGrid(resized);

    // Resize column headers safely
    const updatedHeaders = Array.from({ length: totalCols }, (_, c) => {
      return columnBatches[c] || '';
    });
    setColumnBatches(updatedHeaders);
  };

  // Change Hall Capacity Preset shortcut
  const handleCapacityPresetChange = (preset) => {
    handleUpdateLayout(preset.rows, preset.pairs);
    toast.success(`Hall layout updated: ${preset.rows * preset.pairs * 2} Seats (${preset.rows} Rows x ${preset.pairs * 2} Columns). ${preset.staffReq === 2 ? 'Assign 2 Staff below.' : ''}`);
  };

  // Helper to distribute batches into Left Stream and Right Stream columns
  const distributeBatchesToStreams = (batchesList, activeRows, seatingStyle) => {
    const leftCols = [];
    const rightCols = [];

    if (!batchesList || batchesList.length === 0) {
      return { leftCols, rightCols };
    }

    batchesList.forEach((b, bIdx) => {
      const studentList = b.mode === 'range'
        ? generateListFromRange(b.prefix, b.startNo, b.count, b.endNo, b.excludeNos)
        : parsePastedList(b.pastedText);

      if (studentList.length === 0) return;

      const deptName = b.deptName || `Class ${b.id}`;
      // Slice studentList into chunks of activeRows
      const batchCols = [];
      for (let i = 0; i < studentList.length; i += activeRows) {
        batchCols.push({
          header: deptName,
          students: studentList.slice(i, i + activeRows)
        });
      }

      if (batchesList.length === 1) {
        if (seatingStyle === 'compact') {
          // Compact: alternate between left and right
          batchCols.forEach(col => {
            if (leftCols.length <= rightCols.length) {
              leftCols.push(col);
            } else {
              rightCols.push(col);
            }
          });
        } else {
          // Single per bench: all left
          leftCols.push(...batchCols);
        }
      } else if (bIdx === 0) {
        leftCols.push(...batchCols);
      } else if (bIdx === 1) {
        rightCols.push(...batchCols);
      } else {
        // 3rd or subsequent batch:
        // Priority 1: Fill any balance gap in the shorter stream!
        let colIdx = 0;
        if (rightCols.length < leftCols.length) {
          const gap = leftCols.length - rightCols.length;
          const fillCount = Math.min(gap, batchCols.length);
          for (let k = 0; k < fillCount; k++) {
            rightCols.push(batchCols[colIdx++]);
          }
        } else if (leftCols.length < rightCols.length) {
          const gap = rightCols.length - leftCols.length;
          const fillCount = Math.min(gap, batchCols.length);
          for (let k = 0; k < fillCount; k++) {
            leftCols.push(batchCols[colIdx++]);
          }
        }

        // Priority 2: If batch still has columns remaining after filling balance gap:
        while (colIdx < batchCols.length) {
          if (seatingStyle === 'compact') {
            if (leftCols.length <= rightCols.length) {
              leftCols.push(batchCols[colIdx++]);
            } else {
              rightCols.push(batchCols[colIdx++]);
            }
          } else {
            // Anti-copy gap mode: put remaining in left stream
            leftCols.push(batchCols[colIdx++]);
          }
        }
      }
    });

    return { leftCols, rightCols };
  };

  // Helper to calculate exact bench pairs required for given batches, rows and seating style
  const calculateNeededBenchPairs = (activeRows, batchesList, seatingStyle) => {
    const { leftCols, rightCols } = distributeBatchesToStreams(batchesList, activeRows, seatingStyle);
    return Math.max(1, leftCols.length, rightCols.length);
  };

  // Auto-fit hall layout to fit ALL entered students without cut-off
  const handleAutoFitLayout = () => {
    if (totalStudentsEntered === 0) {
      toast.error("Please enter student count in class batches first.");
      return;
    }
    const neededPairs = calculateNeededBenchPairs(numRows, batches, singleBatchSeatingType);
    handleUpdateLayout(numRows, neededPairs);
    toast.success(`Hall layout auto-adjusted: ${numRows} Rows × ${neededPairs * 2} Columns (${neededPairs} Benches) = ${numRows * neededPairs * 2} Capacity for ${totalStudentsEntered} students.`);
  };

  // Calculate total non-empty seats
  const totalCandidates = seatingGrid.reduce((acc, row) => {
    return acc + row.filter(cell => cell && cell.trim() !== '').length;
  }, 0);

  // Helper to parse pasted text
  const parsePastedList = (text) => {
    if (!text) return [];
    return text
      .split(/[\n,;\s]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  };

  // Auto-allocate students into the dynamic column x row grid
  const handleAutoAllocate = () => {
    if (batches.length === 0) {
      toast.error("Please configure at least 1 class.");
      return;
    }

    const { leftCols, rightCols } = distributeBatchesToStreams(batches, numRows, singleBatchSeatingType);
    const totalStudents = batches.reduce((sum, b) => {
      if (b.mode === 'range') {
        const sList = generateListFromRange(b.prefix, b.startNo, b.count, b.endNo, b.excludeNos);
        return sum + sList.length;
      }
      return sum + (parsePastedList(b.pastedText) || []).length;
    }, 0);

    if (totalStudents === 0) {
      toast.error("No students to allocate. Please enter count or register numbers.");
      return;
    }

    const hallCapacity = numRows * numBenchPairs * 2;
    const neededPairs = Math.max(1, leftCols.length, rightCols.length);
    let activePairs = numBenchPairs;

    // Only auto-expand if students exceed the current layout and capacity!
    if (neededPairs > numBenchPairs && totalStudents > hallCapacity) {
      activePairs = neededPairs;
      setNumBenchPairs(activePairs);
      toast(`⚡ Hall layout auto-expanded to ${activePairs} Benches (${activePairs * 2} Columns × ${numRows} Rows = ${activePairs * numRows * 2} Capacity) to fit all ${totalStudents} students!`, { icon: '📐' });
    }

    const totalCols = activePairs * 2;
    const newGrid = Array.from({ length: numRows }, () => Array(totalCols).fill(''));
    const newHeaders = Array.from({ length: totalCols }, () => '');
    let totalAllotted = 0;

    for (let p = 0; p < activePairs; p++) {
      const c_left = p * 2;
      const c_right = p * 2 + 1;

      // Fill Left Column
      if (p < leftCols.length) {
        newHeaders[c_left] = leftCols[p].header;
        for (let r = 0; r < numRows; r++) {
          if (r < leftCols[p].students.length) {
            newGrid[r][c_left] = leftCols[p].students[r];
            totalAllotted++;
          }
        }
      } else {
        newHeaders[c_left] = "[Vacant Gap]";
      }

      // Fill Right Column
      if (p < rightCols.length) {
        newHeaders[c_right] = rightCols[p].header;
        for (let r = 0; r < numRows; r++) {
          if (r < rightCols[p].students.length) {
            newGrid[r][c_right] = rightCols[p].students[r];
            totalAllotted++;
          }
        }
      } else {
        newHeaders[c_right] = "[Vacant Gap]";
      }
    }

    setColumnBatches(newHeaders);
    setSeatingGrid(newGrid);
    toast.success(`Seating Matrix generated successfully! Allotted all ${totalAllotted} candidates into ${numRows} Rows in sequential order.`);
  };

  // Handle cell edit directly in table
  const handleCellChange = (r, c, value) => {
    const updated = seatingGrid.map((row, rowIdx) => {
      if (rowIdx === r) {
        const newRow = [...row];
        newRow[c] = value;
        return newRow;
      }
      return row;
    });
    setSeatingGrid(updated);
  };

  // Handle column batch title edit
  const handleColumnBatchChange = (colIdx, value) => {
    const updated = [...columnBatches];
    updated[colIdx] = value;
    setColumnBatches(updated);
  };

  // Clear entire grid (Uses custom UI confirmation dialog)
  const handleClearGrid = () => {
    openConfirmDialog({
      title: "Clear Entire Seating Grid?",
      message: "Are you sure you want to clear all seats? All allotted student register numbers in this hall will be removed.",
      confirmText: "Clear All Seats",
      confirmColor: "#ef4444",
      onConfirm: () => {
        setSeatingGrid(Array.from({ length: numRows }, () => Array(numBenchPairs * 2).fill('')));
        toast.success("Grid cleared successfully.");
      }
    });
  };

  // Convert image to base64 for smooth PDF generation without CORS issues
  const getBase64 = async (url) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return url;
    }
  };

  // Print Door Sheet
  const handlePrint = () => {
    const printContent = document.getElementById("printable-seating-chart");
    if (!printContent) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    iframe.contentDocument.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Seating Arrangement - Hall ${headerConfig.hallNo}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 6mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            padding: 0;
            color: #000;
            background: #fff;
          }
          .seating-print-sheet {
            width: 100%;
            max-width: 100%;
            margin: 0 auto;
            border: 2px solid #000;
            padding: 10px 12px;
            background: #fff;
          }
          table.seating-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5px solid #000;
            table-layout: fixed;
          }
          table.seating-table th, table.seating-table td {
            border: 1px solid #000;
            padding: 4px 1px;
            text-align: center;
            vertical-align: middle;
            color: #000;
            font-size: 9.5pt;
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);

    iframe.contentDocument.close();
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  };

  // Download PDF using html2pdf
  const handleDownloadPdf = async () => {
    const printContent = document.getElementById("printable-seating-chart");
    if (!printContent) return;

    toast.loading("Preparing PDF...", { id: "pdf-toast" });

    try {
      const leftLogoBase64 = await getBase64('/logo-left.png');
      const rightLogoBase64 = await getBase64('/logo-right.png');

      let html = printContent.innerHTML;
      html = html.replace(/\/logo-left\.png/g, leftLogoBase64);
      html = html.replace(/\/logo-right\.png/g, rightLogoBase64);

      const container = document.createElement('div');
      container.innerHTML = `
        <div style="
          width: 1080px; 
          padding: 12px; 
          background: #ffffff; 
          color: #000000; 
          font-family: Arial, sans-serif;
          box-sizing: border-box;
        ">
          ${html}
        </div>
      `;

      const filename = `Seating_Plan_Hall_${headerConfig.hallNo.replace(/\s+/g, '_')}_${headerConfig.examTitle.replace(/\s+/g, '_')}.pdf`;

      const opt = {
        margin: [6, 6, 6, 6],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, windowWidth: 1080 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      await html2pdf().set(opt).from(container).save();
      toast.success("PDF Downloaded successfully!", { id: "pdf-toast" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF.", { id: "pdf-toast" });
    }
  };

  // Save Plan - Multi-tier (LocalStorage + Supabase with failover)
  const handleSavePlan = async () => {
    if (!headerConfig.hallNo || !headerConfig.examTitle) {
      toast.error("Hall Number and Exam Title are required.");
      return;
    }
    if (totalCandidates === 0) {
      toast.error("Cannot save an empty seating arrangement.");
      return;
    }

    setSaving(true);
    const planId = `plan_${Date.now()}`;
    const payload = {
      id: planId,
      examTitle: headerConfig.examTitle,
      hallNo: headerConfig.hallNo,
      collegeName: headerConfig.collegeName,
      collegeAddress: headerConfig.collegeAddress,
      totalCandidates: totalCandidates,
      invigilatorName: headerConfig.invigilatorName,
      invigilatorDept: headerConfig.invigilatorDept,
      invigilator2Name: headerConfig.invigilator2Name, // Staff 2
      invigilator2Dept: headerConfig.invigilator2Dept,
      examDate: headerConfig.examDate,
      examSession: headerConfig.examSession,
      columnBatches: columnBatches,
      seatingGrid: seatingGrid,
      numBenchPairs: numBenchPairs,
      numRows: numRows,
      createdBy: userProfile?.name || userProfile?.email || "Exam Cell",
      createdAt: new Date().toISOString(),
      isSeatingPlan: true
    };

    // 1. Save to LocalStorage immediately
    try {
      const existingStr = localStorage.getItem(LOCAL_STORAGE_KEY);
      let localList = existingStr ? JSON.parse(existingStr) : [];
      localList = localList.filter(p => !(p.hallNo === payload.hallNo && p.examTitle === payload.examTitle));
      localList.unshift(payload);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localList));
      setSavedPlans(localList);
      setSelectedPlanId(payload.id);
    } catch (e) {
      console.warn("LocalStorage save error:", e);
    }

    // 2. Try saving to Supabase
    let remoteSaved = false;
    try {
      await addDoc(collection(db, "exam_seating_plans"), payload);
      remoteSaved = true;
    } catch (err) {
      console.warn("Primary Supabase insert failed, attempting fallback table:", err);
      try {
        await addDoc(collection(db, "cia_exam_schedules"), payload);
        remoteSaved = true;
      } catch (err2) {
        console.warn("Fallback insert failed:", err2);
      }
    }

    setSaving(false);
    toast.success(`Seating plan for Hall ${headerConfig.hallNo} saved successfully! ${headerConfig.invigilator2Name ? '(2 Staff Assigned)' : ''}`);
    fetchSavedPlans();
  };

  // Delete saved plan (Opens custom UI confirmation dialog)
  const handleDeletePlan = (plan, e) => {
    if (e && e.stopPropagation) e.stopPropagation();

    const planObj = (plan && typeof plan === 'object') 
      ? plan 
      : (savedPlans.find(p => p.id === plan || p._docId === plan || p.planId === plan) || { id: plan });

    const targetHall = planObj.hallNo || '';
    const targetTitle = planObj.examTitle || '';

    openConfirmDialog({
      title: "Delete Seating Plan?",
      message: `Are you sure you want to delete the seating plan for ${targetHall ? `Hall ${targetHall}` : 'this hall'}${targetTitle ? ` (${targetTitle})` : ''}? This action cannot be undone.`,
      confirmText: "Yes, Delete Plan",
      confirmColor: "#ef4444",
      onConfirm: () => executeDeletePlan(planObj)
    });
  };

  // Perform actual plan deletion
  const executeDeletePlan = async (planObj) => {
    const targetHall = planObj.hallNo || '';
    const targetTitle = planObj.examTitle || '';
    const docId = planObj._docId || planObj.id;
    const planId = planObj.planId || planObj.id;

    // 1. Immediately remove from local state for instant UI update
    setSavedPlans(prev => prev.filter(p => 
      p.id !== docId && 
      p.id !== planId && 
      p._docId !== docId &&
      !(targetHall && targetTitle && p.hallNo === targetHall && p.examTitle === targetTitle)
    ));

    // 2. Remove from LocalStorage
    try {
      const existingStr = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (existingStr) {
        let localList = JSON.parse(existingStr).filter(p => 
          p.id !== docId && 
          p.id !== planId && 
          p._docId !== docId &&
          !(targetHall && targetTitle && p.hallNo === targetHall && p.examTitle === targetTitle)
        );
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localList));
      }
    } catch (err) {
      console.warn("LocalStorage delete error:", err);
    }

    // 3. Delete from Supabase tables by docId and planId
    try {
      if (docId) {
        await deleteDoc(doc(db, "cia_exam_schedules", docId));
        await deleteDoc(doc(db, "exam_seating_plans", docId));
      }
      if (planId && planId !== docId) {
        await deleteDoc(doc(db, "cia_exam_schedules", planId));
        await deleteDoc(doc(db, "exam_seating_plans", planId));
      }
    } catch (err) {
      console.warn("deleteDoc error:", err);
    }

    // 4. Direct dbClient query to ensure deletion by hallNo and examTitle as well
    try {
      const { dbClient } = await import('../../supabase/config');
      if (dbClient) {
        if (docId) {
          await dbClient.from("cia_exam_schedules").delete().eq("id", docId);
          await dbClient.from("exam_seating_plans").delete().eq("id", docId);
        }
        if (targetHall && targetTitle) {
          await dbClient.from("cia_exam_schedules").delete()
            .eq("data->>hallNo", targetHall)
            .eq("data->>examTitle", targetTitle);
          await dbClient.from("exam_seating_plans").delete()
            .eq("data->>hallNo", targetHall)
            .eq("data->>examTitle", targetTitle);
        }
      }
    } catch (err) {
      console.warn("Direct dbClient delete error:", err);
    }

    toast.success(`Seating plan for ${targetHall ? `Hall ${targetHall}` : 'hall'} deleted successfully!`);
    await fetchSavedPlans();
  };

  // Load a saved plan into generator/editor or viewer
  const handleLoadSavedPlan = (plan, targetTab = null) => {
    setHeaderConfig({
      collegeName: plan.collegeName || "RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING",
      collegeAddress: plan.collegeAddress || "Salvarpatti, Sivakasi– 626 128",
      examTitle: plan.examTitle || "",
      hallNo: plan.hallNo || "",
      invigilatorName: plan.invigilatorName || "",
      invigilatorDept: plan.invigilatorDept || "",
      invigilator2Name: plan.invigilator2Name || "",
      invigilator2Dept: plan.invigilator2Dept || "",
      examDate: plan.examDate || "15-10-2026",
      examSession: plan.examSession || "FN"
    });
    setColumnBatches(plan.columnBatches || []);
    setSeatingGrid(plan.seatingGrid || []);
    setNumBenchPairs(plan.numBenchPairs || 5);
    setNumRows(plan.numRows || 5);
    setSelectedPlanId(plan.id);
    if (targetTab) {
      setActiveTab(targetTab);
    }
  };

  // Search Seat for a student
  const handleStudentSearch = () => {
    if (!searchRegNo.trim()) {
      toast.error("Please enter your Register Number.");
      return;
    }

    const regClean = searchRegNo.trim().toUpperCase();
    let match = null;

    for (const plan of savedPlans) {
      if (!plan.seatingGrid) continue;
      for (let r = 0; r < plan.seatingGrid.length; r++) {
        const row = plan.seatingGrid[r];
        for (let c = 0; c < row.length; c++) {
          const seatVal = (row[c] || "").trim().toUpperCase();
          if (seatVal === regClean || (seatVal.length >= 6 && regClean.endsWith(seatVal)) || (regClean.length >= 6 && seatVal.endsWith(regClean))) {
            const pairIdx = Math.floor(c / 2);
            const isLeft = c % 2 === 0;
            const romanBench = ROMAN_NUMERALS[pairIdx] || `Row ${pairIdx + 1}`;
            const seatNo = c + 1;
            const dept = plan.columnBatches?.[c] || "";
            match = {
              planId: plan.id,
              hallNo: plan.hallNo,
              examTitle: plan.examTitle,
              invigilatorName: plan.invigilatorName || "Faculty Assigned",
              invigilator2Name: plan.invigilator2Name || "",
              bench: romanBench,
              benchRow: r + 1,
              seatNo: seatNo,
              seatSide: isLeft ? "Left Seat" : "Right Seat",
              dept: dept,
              regNo: seatVal,
              rowIndex: r,
              colIndex: c
            };
            break;
          }
        }
        if (match) break;
      }
      if (match) break;
    }

    if (match) {
      setFoundSeatInfo(match);
      const matchedPlan = savedPlans.find(p => p.id === match.planId);
      if (matchedPlan) {
        setHeaderConfig({
          collegeName: matchedPlan.collegeName || "RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING",
          collegeAddress: matchedPlan.collegeAddress || "Salvarpatti, Sivakasi– 626 128",
          examTitle: matchedPlan.examTitle || "",
          hallNo: matchedPlan.hallNo || "",
          invigilatorName: matchedPlan.invigilatorName || "",
          invigilatorDept: matchedPlan.invigilatorDept || "",
          invigilator2Name: matchedPlan.invigilator2Name || "",
          invigilator2Dept: matchedPlan.invigilator2Dept || "",
          examDate: matchedPlan.examDate || "15-10-2026",
          examSession: matchedPlan.examSession || "FN"
        });
        setColumnBatches(matchedPlan.columnBatches || []);
        setSeatingGrid(matchedPlan.seatingGrid || []);
        setSelectedPlanId(matchedPlan.id);
      }
      toast.success(`Seat located in Hall ${match.hallNo}!`);
    } else {
      setFoundSeatInfo(null);
      toast.error(`Register Number ${searchRegNo} not found in any scheduled exam hall. Contact Exam Cell.`);
    }
  };

  // Check if current user is assigned as Staff 1 OR Staff 2 to any hall
  const staffDutyPlan = savedPlans.find(p => 
    userProfile?.name && (
      (p.invigilatorName && p.invigilatorName.toLowerCase().includes(userProfile.name.toLowerCase())) ||
      (p.invigilator2Name && p.invigilator2Name.toLowerCase().includes(userProfile.name.toLowerCase()))
    )
  );

  return (
    <div className="dashboard-wrapper">
      <Toaster position="top-right" />
      <Sidebar />
      <main className="main-content">
        <DateTimeHeader />

        {/* Top Header */}
        <div style={{
          marginTop: '20px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '16px'
        }}>
          <div>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: '700', color: 'var(--text-dark)' }}>
              Exam Seating Arrangement & Hall Allocation
            </h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
              Assign hall invigilator staff (1 or 2 staff for large halls), create dual-batch bench seating matrices & generate official door charts.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('view')}
              className="btn"
              style={{
                background: activeTab === 'view' ? '#2563eb' : '#fff',
                color: activeTab === 'view' ? '#fff' : '#475569',
                border: '1px solid #cbd5e1',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <Eye size={18} /> View Hall Plans ({savedPlans.length})
            </button>

            {!isStudent && (
              <button
                onClick={() => setActiveTab('generator')}
                className="btn"
                style={{
                  background: activeTab === 'generator' ? '#2563eb' : '#fff',
                  color: activeTab === 'generator' ? '#fff' : '#475569',
                  border: '1px solid #cbd5e1',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <Grid size={18} /> Seating Generator
              </button>
            )}

            {!isStudent && (
              <button
                onClick={() => setActiveTab('saved')}
                className="btn"
                style={{
                  background: activeTab === 'saved' ? '#2563eb' : '#fff',
                  color: activeTab === 'saved' ? '#fff' : '#475569',
                  border: '1px solid #cbd5e1',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <FileText size={18} /> Manage Saved Plans
              </button>
            )}
          </div>
        </div>

        {/* STAFF EXAM DUTY ALERT (If logged in staff has exam duty assigned) */}
        {staffDutyPlan && (
          <div className="card" style={{
            padding: '16px 20px',
            marginBottom: '20px',
            background: '#eff6ff',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <BadgeAlert size={28} color="#2563eb" />
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#1e3a8a', fontWeight: '800' }}>
                  Exam Invigilation Duty: Hall {staffDutyPlan.hallNo}
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#3b82f6' }}>
                  Exam: {staffDutyPlan.examTitle} | Total Candidates: {staffDutyPlan.totalCandidates} | Date: {staffDutyPlan.examDate || '15-10-2026'} ({staffDutyPlan.examSession || 'FN'})
                  {staffDutyPlan.invigilator2Name && (
                    <span> | Co-Invigilator: {staffDutyPlan.invigilator2Name}</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleLoadSavedPlan(staffDutyPlan, 'view')}
              className="btn"
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Open My Hall Sheet
            </button>
          </div>
        )}

        {/* STUDENT & STAFF SEAT FINDER BANNER */}
        <div className="card" style={{
          padding: '18px 24px',
          marginBottom: '24px',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
          color: '#fff',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <UserCheck size={20} color="#93c5fd" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#fff' }}>
                Student Hall & Seat Lookup
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#bfdbfe' }}>
              Enter any student Register Number to instantly find their allotted Hall, Bench & Seat.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              value={searchRegNo}
              onChange={(e) => setSearchRegNo(e.target.value)}
              placeholder="e.g. 952523104001"
              style={{
                padding: '9px 14px',
                borderRadius: '6px',
                border: 'none',
                width: '220px',
                fontSize: '13px',
                fontWeight: '600',
                outline: 'none',
                color: '#0f172a'
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleStudentSearch()}
            />
            <button
              onClick={handleStudentSearch}
              className="btn"
              style={{
                background: '#ffe600',
                color: '#000',
                border: 'none',
                padding: '9px 16px',
                borderRadius: '6px',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Search size={16} /> Find My Seat
            </button>
          </div>
        </div>

        {/* If Seat Search Found, Show Highlight Card */}
        {foundSeatInfo && (
          <div className="card" style={{
            padding: '20px',
            marginBottom: '24px',
            background: '#ecfdf5',
            border: '2px solid #10b981',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(16, 185, 129, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <CheckCircle size={22} color="#059669" />
                  <h4 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#065f46' }}>
                    Seat Allotted for Candidate: {foundSeatInfo.regNo}
                  </h4>
                </div>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '14px', color: '#047857' }}>
                  <div><strong>Hall:</strong> <span style={{ fontSize: '16px', fontWeight: '800', color: '#064e3b' }}>{foundSeatInfo.hallNo}</span></div>
                  <div><strong>Bench Row:</strong> {foundSeatInfo.bench} (Row {foundSeatInfo.benchRow})</div>
                  <div><strong>Seat Column:</strong> {foundSeatInfo.seatNo} ({foundSeatInfo.seatSide})</div>
                  <div><strong>Department:</strong> {foundSeatInfo.dept}</div>
                  <div><strong>Invigilator:</strong> {foundSeatInfo.invigilatorName} {foundSeatInfo.invigilator2Name ? `& ${foundSeatInfo.invigilator2Name}` : ''}</div>
                  <div><strong>Exam:</strong> {foundSeatInfo.examTitle}</div>
                </div>
              </div>
              <button
                onClick={() => setFoundSeatInfo(null)}
                style={{ background: 'none', border: 'none', color: '#059669', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: VIEW FULL HALL PLAN (FOR ALL STUDENTS & STAFF) */}
        {activeTab === 'view' && (
          <div>
            {/* Hall Selector Dropdown & Toolbar */}
            <div className="card" style={{ padding: '18px 24px', marginBottom: '20px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>
                  Select Exam Hall:
                </label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => {
                    setSelectedPlanId(e.target.value);
                    const p = savedPlans.find(plan => plan.id === e.target.value);
                    if (p) handleLoadSavedPlan(p, 'view');
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#1e293b',
                    background: '#fff'
                  }}
                >
                  {savedPlans.map(p => (
                    <option key={p.id} value={p.id}>
                      Hall {p.hallNo} - {p.examTitle} ({p.totalCandidates} Candidates) {p.invigilatorName ? `[Staff: ${p.invigilatorName}${p.invigilator2Name ? ' & ' + p.invigilator2Name : ''}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleDownloadPdf}
                  className="btn"
                  style={{
                    background: '#059669',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={16} /> Download PDF
                </button>
                <button
                  onClick={handlePrint}
                  className="btn"
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: '6px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Printer size={16} /> Print Door Sheet
                </button>
              </div>
            </div>

            {/* LIVE OFFICIAL DOOR SHEET VIEW */}
            <div 
              ref={printRef}
              style={{
                background: '#fff',
                padding: '24px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                overflowX: 'auto',
                marginBottom: '40px'
              }}
            >
              {/* PRINTABLE CONTAINER */}
              <div id="printable-seating-chart" className="seating-print-sheet" style={{
                width: '100%',
                minWidth: '950px',
                margin: '0 auto',
                border: '2px solid #000',
                padding: '16px 20px',
                background: '#fff',
                color: '#000',
                fontFamily: 'Arial, Helvetica, sans-serif'
              }}>
                {/* Header Row: Left Seal Logo - Center Info - Right RVCE Logo */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                  borderBottom: '2px solid #000',
                  paddingBottom: '10px'
                }}>
                  <div style={{ width: '80px', textAlign: 'left' }}>
                    <img
                      src="/logo-left.png"
                      alt="College Seal"
                      style={{ width: '70px', height: '70px', objectFit: 'contain' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>

                  <div style={{ textAlign: 'center', flex: 1, padding: '0 10px' }}>
                    <h2 style={{
                      margin: '0 0 2px 0',
                      fontSize: '20px',
                      fontWeight: '800',
                      color: '#000',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase'
                    }}>
                      {headerConfig.collegeName}
                    </h2>
                    <p style={{
                      margin: '0 0 4px 0',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#000'
                    }}>
                      {headerConfig.collegeAddress}
                    </p>
                    <h3 style={{
                      margin: 0,
                      fontSize: '15px',
                      fontWeight: '800',
                      color: '#000',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px'
                    }}>
                      {headerConfig.examTitle}
                    </h3>
                  </div>

                  <div style={{ width: '80px', textAlign: 'right' }}>
                    <img
                      src="/logo-right.png"
                      alt="RVCE Emblem"
                      style={{ width: '70px', height: '70px', objectFit: 'contain' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                </div>

                {/* Sub Bar: Hall No (Left) and No. Of Candidates (Right) */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                  padding: '2px 4px'
                }}>
                  <div style={{ fontSize: '17px', fontWeight: '800', color: '#000' }}>
                    Hall No:&nbsp;&nbsp;<span>{headerConfig.hallNo}</span>
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: '800', color: '#000' }}>
                    No. Of Candidates: {totalCandidates}
                  </div>
                </div>

                {/* MAIN SEATING MATRIX TABLE */}
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  border: '1.5px solid #000',
                  tableLayout: 'fixed'
                }}>
                  <thead>
                    {/* Row 1: Roman Numerals */}
                    <tr>
                      {Array.from({ length: numBenchPairs }).map((_, pairIdx) => (
                        <th
                          key={pairIdx}
                          colSpan={2}
                          style={{
                            border: '1.5px solid #000',
                            padding: '6px',
                            textAlign: 'center',
                            fontSize: '15px',
                            fontWeight: '800',
                            background: '#f9f9f9',
                            color: '#000'
                          }}
                        >
                          {ROMAN_NUMERALS[pairIdx] || `P${pairIdx + 1}`}
                        </th>
                      ))}
                    </tr>

                    {/* Row 2: Seat Column Numbers */}
                    <tr>
                      {Array.from({ length: numBenchPairs * 2 }).map((_, colIdx) => (
                        <th
                          key={colIdx}
                          style={{
                            border: '1.5px solid #000',
                            padding: '5px',
                            textAlign: 'center',
                            fontSize: '14px',
                            fontWeight: '800',
                            background: '#ffffff',
                            color: '#000',
                            width: `${100 / (numBenchPairs * 2)}%`
                          }}
                        >
                          {colIdx + 1}
                        </th>
                      ))}
                    </tr>

                    {/* Row 3: Class / Department Labels */}
                    <tr>
                      {columnBatches.map((bName, colIdx) => (
                        <th
                          key={colIdx}
                          style={{
                            border: '1.5px solid #000',
                            padding: '6px 2px',
                            textAlign: 'center',
                            fontSize: '11px',
                            fontWeight: '800',
                            background: '#fbfbfb',
                            color: '#000',
                            wordBreak: 'break-word',
                            lineHeight: '1.2'
                          }}
                        >
                          {bName || '-'}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {/* Rows of Benches (Dynamic: 5, 6, 8, 10 Rows) */}
                    {seatingGrid.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cellVal, cIdx) => {
                          const isHighlighted = foundSeatInfo && 
                            foundSeatInfo.rowIndex === rIdx && 
                            foundSeatInfo.colIndex === cIdx &&
                            foundSeatInfo.hallNo === headerConfig.hallNo;

                          return (
                            <td
                              key={cIdx}
                              style={{
                                border: '1px solid #000',
                                padding: '2px',
                                textAlign: 'center',
                                verticalAlign: 'middle',
                                height: numRows > 6 ? '40px' : '50px',
                                background: isHighlighted ? '#fef08a' : '#fff',
                                outline: isHighlighted ? '2px solid #eab308' : 'none'
                              }}
                            >
                              <div style={{
                                width: '100%',
                                textAlign: 'center',
                                fontSize: numRows > 6 ? '10.5px' : '11.5px',
                                fontWeight: '700',
                                fontFamily: "'Courier New', Courier, monospace",
                                color: isHighlighted ? '#854d0e' : '#000',
                                wordBreak: 'break-all'
                              }}>
                                {cellVal || '-'}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* BOTTOM FOOTER: 1 OR 2 STAFF SIGNATURES */}
                <div style={{
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1.5px solid #000',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#000'
                }}>
                  {/* Left: Invigilator 1 */}
                  <div style={{ flex: 1.2 }}>
                    <div>Hall Invigilator 1: <span style={{ textDecoration: 'underline' }}>{headerConfig.invigilatorName || 'Assigned Staff'}</span></div>
                    <div style={{ marginTop: '4px', fontSize: '12px', color: '#333' }}>Sign: __________________________</div>
                  </div>

                  {/* Center: Attendance Count */}
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div>Present: ________&nbsp;&nbsp;&nbsp;&nbsp;Absent: ________</div>
                    <div style={{ marginTop: '4px', fontSize: '12px', color: '#333' }}>Total: {totalCandidates} Candidates</div>
                  </div>

                  {/* Right: Invigilator 2 (If big hall with 2 staff) OR Date/Session */}
                  <div style={{ flex: 1.2, textAlign: 'right' }}>
                    {headerConfig.invigilator2Name ? (
                      <>
                        <div>Hall Invigilator 2: <span style={{ textDecoration: 'underline' }}>{headerConfig.invigilator2Name}</span></div>
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#333' }}>Sign: __________________________</div>
                      </>
                    ) : (
                      <>
                        <div>Invigilator Signature: ___________________</div>
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#333' }}>
                          Date: {headerConfig.examDate || '15-10-2026'} ({headerConfig.examSession || 'FN'})
                        </div>
                      </>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GENERATOR (FOR EXAM CELL & ADMIN) */}
        {activeTab === 'generator' && (
          <div>
            {/* Top Configuration Card */}
            <div className="card" style={{ padding: '24px', marginBottom: '24px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building size={20} color="#2563eb" /> 1. Hall, Staff & Exam Information
                </h3>
              </div>

              {/* Dynamic Hall Layout & Capacity Customizer (Exam Cell can type custom Rows & Columns) */}
              <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '10px', border: '1.5px solid #e2e8f0', marginBottom: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '800', color: '#1e293b' }}>
                      Hall Layout & Dynamic Auto-Capacity:
                    </label>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Munadiye 50 seats lock panna theva illa — keezhe Batch cards-la count pottu Auto-Generate click panna, table auto-fit aagi order-ah generate aagum!
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{
                      background: totalHallCapacity > 50 ? '#ecfdf5' : '#eff6ff',
                      color: totalHallCapacity > 50 ? '#047857' : '#1d4ed8',
                      border: `1px solid ${totalHallCapacity > 50 ? '#6ee7b7' : '#bfdbfe'}`,
                      padding: '5px 12px',
                      borderRadius: '20px',
                      fontSize: '12.5px',
                      fontWeight: '700'
                    }}>
                      Capacity: {numRows} Rows × {numBenchPairs * 2} Cols ({numBenchPairs} Benches) = {totalHallCapacity} Seats {totalHallCapacity > 50 ? '(2 Staff Req)' : '(1 Staff Req)'}
                    </span>

                    <button
                      type="button"
                      onClick={handleAutoFitLayout}
                      title="Automatically adjusts rows/columns to fit total students"
                      style={{
                        background: '#6366f1',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontWeight: '700',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 4px rgba(99, 102, 241, 0.25)'
                      }}
                    >
                      <Sparkles size={14} /> Auto-Fit to Student Count ({totalStudentsEntered} Students)
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                  {/* Rows input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Rows (Length):</span>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleUpdateLayout(Math.max(2, numRows - 1), numBenchPairs)}
                        style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px 0 0 6px', background: '#fff', cursor: 'pointer', fontWeight: '700' }}
                      >-</button>
                      <input
                        type="number"
                        min="2"
                        max="25"
                        value={numRows}
                        onChange={(e) => handleUpdateLayout(parseInt(e.target.value, 10) || 5, numBenchPairs)}
                        style={{ width: '55px', textAlign: 'center', padding: '6px', borderTop: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', borderLeft: 'none', borderRight: 'none', fontWeight: '700', fontSize: '13px' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateLayout(numRows + 1, numBenchPairs)}
                        style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '0 6px 6px 0', background: '#fff', cursor: 'pointer', fontWeight: '700' }}
                      >+</button>
                    </div>
                  </div>

                  {/* Bench Columns input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Bench Columns (Roman Pairs):</span>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleUpdateLayout(numRows, Math.max(1, numBenchPairs - 1))}
                        style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px 0 0 6px', background: '#fff', cursor: 'pointer', fontWeight: '700' }}
                      >-</button>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={numBenchPairs}
                        onChange={(e) => handleUpdateLayout(numRows, parseInt(e.target.value, 10) || 5)}
                        style={{ width: '55px', textAlign: 'center', padding: '6px', borderTop: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', borderLeft: 'none', borderRight: 'none', fontWeight: '700', fontSize: '13px' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateLayout(numRows, numBenchPairs + 1)}
                        style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '0 6px 6px 0', background: '#fff', cursor: 'pointer', fontWeight: '700' }}
                      >+</button>
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>({numBenchPairs * 2} Seat Columns)</span>
                  </div>

                  {/* Quick Presets Shortcuts */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Presets:</span>
                    {[
                      { l: "50 Seats (5x5)", r: 5, p: 5 },
                      { l: "60 Seats (6x5)", r: 6, p: 5 },
                      { l: "70 Seats (7x5)", r: 7, p: 5 },
                      { l: "80 Seats (8x5)", r: 8, p: 5 },
                      { l: "100 Seats (10x5)", r: 10, p: 5 },
                    ].map(preset => (
                      <button
                        key={preset.l}
                        type="button"
                        onClick={() => handleUpdateLayout(preset.r, preset.p)}
                        style={{
                          background: (numRows === preset.r && numBenchPairs === preset.p) ? '#1e293b' : '#fff',
                          color: (numRows === preset.r && numBenchPairs === preset.p) ? '#fff' : '#475569',
                          border: '1px solid #cbd5e1',
                          padding: '4px 9px',
                          borderRadius: '4px',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {preset.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                {/* Exam Title */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                    Exam Title:
                  </label>
                  <input
                    type="text"
                    value={headerConfig.examTitle}
                    onChange={(e) => setHeaderConfig({ ...headerConfig, examTitle: e.target.value })}
                    placeholder="e.g. INTERNAL 2026-09"
                    className="form-control"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  {exams.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) setHeaderConfig({ ...headerConfig, examTitle: e.target.value });
                      }}
                      style={{ marginTop: '6px', fontSize: '12px', width: '100%', padding: '6px', border: '1px dashed #94a3b8', borderRadius: '4px' }}
                    >
                      <option value="">-- Or Select Existing Exam --</option>
                      {exams.map(ex => (
                        <option key={ex.id} value={`${ex.examName} ${ex.monthYear || ''}`}>
                          {ex.examName} ({ex.programmeName || ''} Sem {ex.semester || ''})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Hall Number */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                    Hall Number:
                  </label>
                  <input
                    type="text"
                    value={headerConfig.hallNo}
                    onChange={(e) => setHeaderConfig({ ...headerConfig, hallNo: e.target.value })}
                    placeholder="e.g. C 204, Seminar Hall 1"
                    className="form-control"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '700' }}
                  />
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {PRESET_HALLS.map(h => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setHeaderConfig({ ...headerConfig, hallNo: h })}
                        style={{
                          background: headerConfig.hallNo === h ? '#dbeafe' : '#f1f5f9',
                          color: headerConfig.hallNo === h ? '#1d4ed8' : '#475569',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ASSIGNED STAFF 1 (Invigilator 1) */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px', color: '#1e3a8a' }}>
                    Invigilator 1 (Staff 1):
                  </label>
                  <input
                    type="text"
                    value={headerConfig.invigilatorName}
                    onChange={(e) => setHeaderConfig({ ...headerConfig, invigilatorName: e.target.value })}
                    placeholder="e.g. Dr. K. Ramesh, AP/CSE"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #3b82f6', fontWeight: '600' }}
                  />
                  {faculties.length > 0 && (
                    <select
                      onChange={(e) => {
                        const sel = faculties.find(f => f.name === e.target.value);
                        if (sel) {
                          setHeaderConfig({
                            ...headerConfig,
                            invigilatorName: `${sel.name}, ${sel.designation}/${sel.dept}`,
                            invigilatorDept: sel.dept
                          });
                        }
                      }}
                      style={{ marginTop: '6px', fontSize: '12px', width: '100%', padding: '6px', border: '1px dashed #3b82f6', borderRadius: '4px', background: '#eff6ff' }}
                    >
                      <option value="">-- Select Staff 1 --</option>
                      {faculties.map(f => (
                        <option key={f.id} value={f.name}>
                          {f.name} ({f.dept} - {f.designation})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* ASSIGNED STAFF 2 (Invigilator 2 - for 50+ students large hall) */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px', color: '#047857' }}>
                    Invigilator 2 (Staff 2 - for 50+ Hall):
                  </label>
                  <input
                    type="text"
                    value={headerConfig.invigilator2Name}
                    onChange={(e) => setHeaderConfig({ ...headerConfig, invigilator2Name: e.target.value })}
                    placeholder="e.g. Mrs. B. Ramya, AP/EEE"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #10b981', fontWeight: '600' }}
                  />
                  {faculties.length > 0 && (
                    <select
                      onChange={(e) => {
                        const sel = faculties.find(f => f.name === e.target.value);
                        if (sel) {
                          setHeaderConfig({
                            ...headerConfig,
                            invigilator2Name: `${sel.name}, ${sel.designation}/${sel.dept}`,
                            invigilator2Dept: sel.dept
                          });
                        }
                      }}
                      style={{ marginTop: '6px', fontSize: '12px', width: '100%', padding: '6px', border: '1px dashed #10b981', borderRadius: '4px', background: '#ecfdf5' }}
                    >
                      <option value="">-- Select Staff 2 --</option>
                      {faculties.map(f => (
                        <option key={f.id} value={f.name}>
                          {f.name} ({f.dept} - {f.designation})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Date & Session */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                    Date & Session:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={headerConfig.examDate}
                      onChange={(e) => setHeaderConfig({ ...headerConfig, examDate: e.target.value })}
                      placeholder="15-10-2026"
                      style={{ width: '60%', padding: '9px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                    <select
                      value={headerConfig.examSession}
                      onChange={(e) => setHeaderConfig({ ...headerConfig, examSession: e.target.value })}
                      style={{ width: '40%', padding: '9px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '700' }}
                    >
                      <option value="FN">FN</option>
                      <option value="AN">AN</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Batch Pairing Generator (Dynamic Classes: 1, 2, 3 or more) */}
            <div className="card" style={{ padding: '24px', marginBottom: '24px', border: '1px solid var(--border-color)', background: '#fafbfc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={20} color="#6366f1" /> 2. Exam Batch Seating Allocation ({batches.length} {batches.length === 1 ? 'Class' : 'Classes'})
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    {batches.length === 1 
                      ? 'Single Class in Hall Mode (Oru bench-ku 1 student or full hall)' 
                      : batches.length === 2 
                        ? 'Dual-Batch Mode (Odd Seats: Batch A + Even Seats: Batch B - 2 Per Bench Rule)' 
                        : `${batches.length} Classes Mixed Mode (Alternating across columns)`}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', background: batches.length === 1 ? '#e0f2fe' : '#e0e7ff', color: batches.length === 1 ? '#0369a1' : '#3730a3', padding: '5px 12px', borderRadius: '12px', fontWeight: '700' }}>
                    {batches.length === 1
                      ? (singleBatchSeatingType === 'single_per_bench' ? '1 Student Per Bench (Left Seat)' : 'Full Hall (2 Per Bench)')
                      : batches.length === 2
                        ? 'Batch A (Odd Cols) + Batch B (Even Cols)'
                        : `Classes: ${batches.map(b => b.id).join(' + ')}`}
                  </span>

                  <button
                    type="button"
                    onClick={handleAddBatch}
                    disabled={batches.length >= 6}
                    style={{
                      background: '#4f46e5',
                      color: '#fff',
                      border: 'none',
                      padding: '7px 14px',
                      borderRadius: '6px',
                      fontWeight: '700',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: batches.length >= 6 ? 'not-allowed' : 'pointer',
                      opacity: batches.length >= 6 ? 0.6 : 1,
                      boxShadow: '0 2px 4px rgba(79,70,229,0.25)'
                    }}
                  >
                    <Plus size={15} /> Add Class (Batch {BATCH_LETTERS[batches.length] || ''})
                  </button>
                </div>
              </div>

              {/* Seating Allocation Style Banner */}
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <strong style={{ color: '#166534', fontSize: '13px' }}>
                    🎯 Seating Allocation Style:
                  </strong>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                    {batches.length === 1
                      ? 'Intha hall-la ore oru class mattum iruntha seating style:'
                      : 'Classes seated in clean sequential order without column jumping:'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: singleBatchSeatingType === 'compact' ? '#166534' : '#475569',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: singleBatchSeatingType === 'compact' ? '#dcfce7' : 'transparent',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${singleBatchSeatingType === 'compact' ? '#86efac' : 'transparent'}`
                  }}>
                    <input
                      type="radio"
                      name="seating_allocation_mode"
                      checked={singleBatchSeatingType === 'compact'}
                      onChange={() => setSingleBatchSeatingType('compact')}
                    />
                    Compact Mode (2 Students Per Bench - Pairs classes & fits all {totalStudentsEntered} students)
                  </label>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: singleBatchSeatingType === 'single_per_bench' ? '#1e40af' : '#475569',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: singleBatchSeatingType === 'single_per_bench' ? '#dbeafe' : 'transparent',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${singleBatchSeatingType === 'single_per_bench' ? '#93c5fd' : 'transparent'}`
                  }}>
                    <input
                      type="radio"
                      name="seating_allocation_mode"
                      checked={singleBatchSeatingType === 'single_per_bench'}
                      onChange={() => setSingleBatchSeatingType('single_per_bench')}
                    />
                    Anti-Copying Gap Mode (Extra/Solo Classes get 1 Per Bench with Vacant Right Seat)
                  </label>
                </div>
              </div>

              {/* Dynamic Batch Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                {batches.map((b, idx) => {
                  const color = BATCH_COLORS[idx % BATCH_COLORS.length];
                  const canRemove = batches.length > 1;
                  const isLength2 = batches.length === 2;

                  let subtitle = "";
                  if (batches.length === 1) {
                    subtitle = singleBatchSeatingType === 'single_per_bench' 
                      ? "1 Student Per Bench (Odd Cols 1, 3, 5, 7, 9)" 
                      : "Entire Hall (All Columns)";
                  } else if (isLength2) {
                    subtitle = idx === 0 
                      ? "Left Seat (Odd Columns: 1, 3, 5, 7, 9)" 
                      : "Right Seat (Even Columns: 2, 4, 6, 8, 10)";
                  } else {
                    subtitle = `Alternating Columns (${idx + 1} of ${batches.length} Classes)`;
                  }

                  return (
                    <div
                      key={b.id || idx}
                      style={{
                        background: '#fff',
                        border: `1.5px solid ${color.border}`,
                        borderRadius: '8px',
                        padding: '18px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            background: color.badgeBg,
                            color: color.badgeText,
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '700',
                            fontSize: '13px'
                          }}>
                            {b.id}
                          </div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '15px', color: color.text, fontWeight: '700' }}>
                              Batch {b.id} {isLength2 ? (idx === 0 ? '(Left Seat)' : '(Right Seat)') : ''}
                            </h4>
                            <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{subtitle}</p>
                          </div>
                        </div>

                        {canRemove && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBatch(idx)}
                            title={`Remove Class ${b.id}`}
                            style={{
                              background: '#fee2e2',
                              color: '#ef4444',
                              border: '1px solid #fca5a5',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: '600'
                            }}
                          >
                            <Trash2 size={13} /> Remove
                          </button>
                        )}
                      </div>

                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>Department / Class Label:</label>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>Choose class or type custom</span>
                        </div>
                        <input
                          type="text"
                          list="rvce_college_classes_datalist"
                          value={b.deptName}
                          onChange={(e) => handleBatchFieldChange(idx, 'deptName', e.target.value)}
                          placeholder="e.g. III - CSE A, II - AIDS, III - ECE, IV - CSBS"
                          style={{ width: '100%', padding: '8px 10px', marginTop: '4px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '700', color: '#1e3a8a', background: '#fff' }}
                        />
                        <datalist id="rvce_college_classes_datalist">
                          {getAllCollegeClasses().map(c => (
                            <option key={c.label} value={c.label}>
                              {c.yearLabel} {c.dept} {c.section ? `(Section ${c.section})` : '(Single Class)'}
                            </option>
                          ))}
                        </datalist>
                      </div>

                      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name={`batch_mode_${idx}`}
                            checked={b.mode === 'range'}
                            onChange={() => handleBatchFieldChange(idx, 'mode', 'range')}
                          />
                          Generate Range
                        </label>
                        <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name={`batch_mode_${idx}`}
                            checked={b.mode === 'paste'}
                            onChange={() => handleBatchFieldChange(idx, 'mode', 'paste')}
                          />
                          Paste Reg Nos
                        </label>
                      </div>

                      {b.mode === 'range' ? (
                        <div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 0.9fr', gap: '8px', alignItems: 'end' }}>
                            <div>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>Prefix:</span>
                              <input
                                type="text"
                                value={b.prefix}
                                onChange={(e) => handleBatchFieldChange(idx, 'prefix', e.target.value)}
                                placeholder="952523104"
                                style={{ width: '100%', padding: '7px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                              />
                            </div>
                            <div>
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>From No (Start):</span>
                              <input
                                type="text"
                                value={b.startNo}
                                onChange={(e) => handleBatchFieldChange(idx, 'startNo', e.target.value)}
                                placeholder="026"
                                style={{ width: '100%', padding: '7px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: '600' }}
                              />
                            </div>
                            <div>
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>To No (End):</span>
                              <input
                                type="text"
                                value={b.endNo || ''}
                                onChange={(e) => handleBatchFieldChange(idx, 'endNo', e.target.value)}
                                placeholder="050"
                                style={{ width: '100%', padding: '7px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: '600' }}
                              />
                            </div>
                            <div>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>Count:</span>
                              <input
                                type="number"
                                value={b.count}
                                onChange={(e) => handleBatchFieldChange(idx, 'count', parseInt(e.target.value, 10) || 0)}
                                style={{ width: '100%', padding: '7px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: '700', background: '#f8fafc', color: '#1e3a8a' }}
                              />
                            </div>
                          </div>
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '700' }}>
                                Skip / Exclude Roll Nos (Leave / Absent / Detained):
                              </span>
                              {b.excludeNos && (
                                <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: '700', background: '#fee2e2', padding: '1px 6px', borderRadius: '4px' }}>
                                  {parseExcludeNumbers(b.excludeNos, b.prefix).size} Skipped
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={b.excludeNos || ''}
                              onChange={(e) => handleBatchFieldChange(idx, 'excludeNos', e.target.value)}
                              placeholder="e.g. 17, 23 (or full reg nos like 952523104017)"
                              style={{
                                width: '100%',
                                padding: '6px 9px',
                                marginTop: '4px',
                                fontSize: '12px',
                                border: '1px solid #fca5a5',
                                borderRadius: '4px',
                                background: '#fef2f2',
                                color: '#991b1b',
                                fontWeight: '500'
                              }}
                            />
                          </div>

                          {(() => {
                            const activeStudents = generateListFromRange(b.prefix, b.startNo, b.count, b.endNo, b.excludeNos);
                            const skippedCount = parseExcludeNumbers(b.excludeNos, b.prefix).size;
                            return (
                              <div style={{
                                marginTop: '7px',
                                fontSize: '11px',
                                color: '#0369a1',
                                background: '#f0f9ff',
                                padding: '5px 8px',
                                borderRadius: '4px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '4px'
                              }}>
                                <span>
                                  Roll Range: <strong>{b.prefix}{b.startNo}</strong> to <strong>{b.prefix}{b.endNo || b.startNo}</strong>
                                </span>
                                <span style={{ fontWeight: '700', color: '#0f766e' }}>
                                  {activeStudents.length} Students Active {skippedCount > 0 ? `(${skippedCount} skipped)` : ''}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Paste Reg Nos (Comma/Space/Line separated):</span>
                          <textarea
                            rows={3}
                            value={b.pastedText}
                            onChange={(e) => handleBatchFieldChange(idx, 'pastedText', e.target.value)}
                            placeholder="952523104001, 952523104002..."
                            style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons to Auto Allocate */}
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <button
                  type="button"
                  onClick={handleAddBatch}
                  disabled={batches.length >= 6}
                  style={{
                    background: '#f8fafc',
                    color: '#4f46e5',
                    border: '1px dashed #6366f1',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontWeight: '700',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: batches.length >= 6 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Plus size={16} /> Add Another Class ({BATCH_LETTERS[batches.length] || 'Next'})
                </button>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleClearGrid}
                    className="btn"
                    style={{
                      background: '#fff',
                      color: '#ef4444',
                      border: '1px solid #fca5a5',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <RotateCcw size={16} /> Clear Table
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoAllocate}
                    className="btn"
                    style={{
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '6px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(37,99,235,0.3)'
                    }}
                  >
                    <Sparkles size={18} /> Auto-Generate Seating Grid
                  </button>
                </div>
              </div>
            </div>

            {/* Individual Column Header Customizer */}
            <div className="card" style={{ padding: '16px 20px', marginBottom: '24px', border: '1px solid var(--border-color)', background: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                  Column Dept Headers ({numBenchPairs * 2} Columns):
                </span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  e.g., Click any column to customize class name
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numBenchPairs * 2}, 1fr)`, gap: '6px' }}>
                {columnBatches.map((bName, cIdx) => (
                  <div key={cIdx} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '2px' }}>
                      Col {cIdx + 1}
                    </div>
                    <input
                      type="text"
                      value={bName}
                      onChange={(e) => handleColumnBatchChange(cIdx, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '4px 2px',
                        fontSize: '11px',
                        textAlign: 'center',
                        fontWeight: '600',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        background: BATCH_COLORS[cIdx % (batches.length || 1)]?.bg || '#eff6ff'
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Export & Actions Toolbar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{
                  background: '#1e293b',
                  color: '#fff',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '700'
                }}>
                  Hall: {headerConfig.hallNo}
                </span>
                <span style={{
                  background: totalCandidates > 0 ? '#dcfce7' : '#f1f5f9',
                  color: totalCandidates > 0 ? '#15803d' : '#64748b',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '700'
                }}>
                  No. Of Candidates: {totalCandidates}
                </span>
                {headerConfig.invigilatorName && (
                  <span style={{
                    background: '#e0e7ff',
                    color: '#3730a3',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '700'
                  }}>
                    Staff 1: {headerConfig.invigilatorName}
                  </span>
                )}
                {headerConfig.invigilator2Name && (
                  <span style={{
                    background: '#dcfce7',
                    color: '#166534',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '700'
                  }}>
                    Staff 2: {headerConfig.invigilator2Name}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleSavePlan}
                  disabled={saving}
                  className="btn"
                  style={{
                    background: '#fff',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Save size={16} color="#0284c7" /> {saving ? "Saving..." : "Save to Database"}
                </button>
                <button
                  onClick={handleDownloadPdf}
                  className="btn"
                  style={{
                    background: '#059669',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(5,150,105,0.2)'
                  }}
                >
                  <Download size={16} /> Download PDF
                </button>
                <button
                  onClick={handlePrint}
                  className="btn"
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: '6px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
                  }}
                >
                  <Printer size={16} /> Print Door Sheet
                </button>
              </div>
            </div>

            {/* LIVE EDITABLE MATRIX TABLE */}
            <div style={{
              background: '#fff',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              overflowX: 'auto',
              marginBottom: '40px'
            }}>
              <div id="printable-seating-chart" className="seating-print-sheet" style={{
                width: '100%',
                minWidth: '950px',
                margin: '0 auto',
                border: '2px solid #000',
                padding: '16px 20px',
                background: '#fff',
                color: '#000',
                fontFamily: 'Arial, Helvetica, sans-serif'
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                  borderBottom: '2px solid #000',
                  paddingBottom: '10px'
                }}>
                  <div style={{ width: '80px', textAlign: 'left' }}>
                    <img
                      src="/logo-left.png"
                      alt="Seal"
                      style={{ width: '70px', height: '70px', objectFit: 'contain' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                  <div style={{ textAlign: 'center', flex: 1, padding: '0 10px' }}>
                    <h2 style={{
                      margin: '0 0 2px 0',
                      fontSize: '20px',
                      fontWeight: '800',
                      color: '#000',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase'
                    }}>
                      {headerConfig.collegeName}
                    </h2>
                    <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600', color: '#000' }}>
                      {headerConfig.collegeAddress}
                    </p>
                    <h3 style={{
                      margin: 0,
                      fontSize: '15px',
                      fontWeight: '800',
                      color: '#000',
                      textTransform: 'uppercase'
                    }}>
                      {headerConfig.examTitle}
                    </h3>
                  </div>
                  <div style={{ width: '80px', textAlign: 'right' }}>
                    <img
                      src="/logo-right.png"
                      alt="RVCE Logo"
                      style={{ width: '70px', height: '70px', objectFit: 'contain' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                </div>

                {/* Sub Bar */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                  padding: '2px 4px'
                }}>
                  <div style={{ fontSize: '17px', fontWeight: '800', color: '#000' }}>
                    Hall No:&nbsp;&nbsp;<span>{headerConfig.hallNo}</span>
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: '800', color: '#000' }}>
                    No. Of Candidates: {totalCandidates}
                  </div>
                </div>

                {/* Table */}
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  border: '1.5px solid #000',
                  tableLayout: 'fixed'
                }}>
                  <thead>
                    <tr>
                      {Array.from({ length: numBenchPairs }).map((_, pairIdx) => (
                        <th
                          key={pairIdx}
                          colSpan={2}
                          style={{
                            border: '1.5px solid #000',
                            padding: '6px',
                            textAlign: 'center',
                            fontSize: '15px',
                            fontWeight: '800',
                            background: '#f9f9f9',
                            color: '#000'
                          }}
                        >
                          {ROMAN_NUMERALS[pairIdx] || `P${pairIdx + 1}`}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {Array.from({ length: numBenchPairs * 2 }).map((_, colIdx) => (
                        <th
                          key={colIdx}
                          style={{
                            border: '1.5px solid #000',
                            padding: '5px',
                            textAlign: 'center',
                            fontSize: '14px',
                            fontWeight: '800',
                            background: '#ffffff',
                            color: '#000',
                            width: `${100 / (numBenchPairs * 2)}%`
                          }}
                        >
                          {colIdx + 1}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {columnBatches.map((bName, colIdx) => (
                        <th
                          key={colIdx}
                          style={{
                            border: '1.5px solid #000',
                            padding: '6px 2px',
                            textAlign: 'center',
                            fontSize: '11px',
                            fontWeight: '800',
                            background: '#fbfbfb',
                            color: '#000',
                            wordBreak: 'break-word',
                            lineHeight: '1.2'
                          }}
                        >
                          {bName || '-'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {seatingGrid.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cellVal, cIdx) => (
                          <td
                            key={cIdx}
                            style={{
                              border: '1px solid #000',
                              padding: '2px',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              height: numRows > 6 ? '40px' : '52px',
                              background: '#fff'
                            }}
                          >
                            <input
                              type="text"
                              value={cellVal}
                              onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                              placeholder="-"
                              style={{
                                width: '100%',
                                height: '100%',
                                border: 'none',
                                textAlign: 'center',
                                fontSize: numRows > 6 ? '10.5px' : '11.5px',
                                fontWeight: '700',
                                fontFamily: "'Courier New', Courier, monospace",
                                color: '#000',
                                background: 'transparent',
                                padding: '0',
                                outline: 'none'
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* BOTTOM FOOTER */}
                <div style={{
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1.5px solid #000',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#000'
                }}>
                  <div style={{ flex: 1.2 }}>
                    <div>Hall Invigilator 1: <span style={{ textDecoration: 'underline' }}>{headerConfig.invigilatorName || 'Assigned Staff'}</span></div>
                    <div style={{ marginTop: '4px', fontSize: '12px', color: '#333' }}>Sign: __________________________</div>
                  </div>

                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div>Present: ________&nbsp;&nbsp;&nbsp;&nbsp;Absent: ________</div>
                    <div style={{ marginTop: '4px', fontSize: '12px', color: '#333' }}>Total: {totalCandidates} Candidates</div>
                  </div>

                  <div style={{ flex: 1.2, textAlign: 'right' }}>
                    {headerConfig.invigilator2Name ? (
                      <>
                        <div>Hall Invigilator 2: <span style={{ textDecoration: 'underline' }}>{headerConfig.invigilator2Name}</span></div>
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#333' }}>Sign: __________________________</div>
                      </>
                    ) : (
                      <>
                        <div>Invigilator Signature: ___________________</div>
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#333' }}>
                          Date: {headerConfig.examDate || '15-10-2026'} ({headerConfig.examSession || 'FN'})
                        </div>
                      </>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MANAGE SAVED PLANS */}
        {activeTab === 'saved' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                  All Saved Hall Seating Plans
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Halls generated with assigned supervisory staff and ready for exam door printing.
                </p>
              </div>
              <button
                onClick={fetchSavedPlans}
                className="btn"
                style={{
                  background: '#fff',
                  border: '1px solid #cbd5e1',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Refresh
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {savedPlans.map(plan => (
                <div
                  key={plan.id}
                  className="card hover-elevate"
                  style={{
                    padding: '20px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <span style={{
                        background: '#dbeafe',
                        color: '#1d4ed8',
                        fontSize: '13px',
                        fontWeight: '800',
                        padding: '3px 10px',
                        borderRadius: '12px'
                      }}>
                        Hall {plan.hallNo}
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : ''}
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
                      {plan.examTitle || 'CIA Examination'}
                    </h4>

                    {/* Staff Assigned Badges */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                      <div style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        color: '#1e40af'
                      }}>
                        Invigilator 1: {plan.invigilatorName || 'Assigned Staff'}
                      </div>
                      {plan.invigilator2Name && (
                        <div style={{
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          color: '#166534'
                        }}>
                          Invigilator 2: {plan.invigilator2Name}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: '#475569', marginBottom: '12px' }}>
                      <div><strong>Candidates:</strong> {plan.totalCandidates || 0}</div>
                      <div><strong>Session:</strong> {plan.examSession || 'FN'}</div>
                    </div>

                    {plan.columnBatches && plan.columnBatches.length > 0 && (
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px', background: '#f8fafc', padding: '8px', borderRadius: '4px' }}>
                        <strong>Batches:</strong> {Array.from(new Set(plan.columnBatches.filter(Boolean))).join(', ')}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                    <button
                      onClick={() => handleLoadSavedPlan(plan, 'view')}
                      className="btn"
                      style={{
                        flex: 1,
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Eye size={14} /> View
                    </button>
                    {!isStudent && (
                      <button
                        onClick={() => handleLoadSavedPlan(plan, 'generator')}
                        className="btn"
                        style={{
                          flex: 1,
                          background: '#f1f5f9',
                          color: '#1e293b',
                          border: '1px solid #cbd5e1',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <Grid size={14} /> Edit
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDeletePlan(plan, e)}
                      className="btn"
                      style={{
                        background: '#fff',
                        color: '#ef4444',
                        border: '1px solid #fca5a5',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                      title="Delete Plan"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Premium Custom UI Confirmation Modal (Replaces browser window.confirm!) */}
        {confirmModal.isOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px'
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              padding: '28px 24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
              position: 'relative'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}>
                <AlertTriangle size={30} />
              </div>

              <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                {confirmModal.title}
              </h3>

              <p style={{ margin: '0 0 24px 0', fontSize: '13.5px', color: '#64748b', lineHeight: '1.5' }}>
                {confirmModal.message}
              </p>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={closeConfirmDialog}
                  style={{
                    flex: 1,
                    padding: '11px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#475569',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const fn = confirmModal.onConfirm;
                    closeConfirmDialog();
                    if (fn) fn();
                  }}
                  style={{
                    flex: 1,
                    padding: '11px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: confirmModal.confirmColor || '#dc2626',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 8px rgba(220, 38, 38, 0.25)'
                  }}
                >
                  {confirmModal.confirmText || 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
