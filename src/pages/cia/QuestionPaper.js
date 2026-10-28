import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, getDocs, where, addDoc, serverTimestamp, doc, getDoc, updateDoc, orderBy } from "../../supabase/supabaseAdapter";
import { Search, Printer, CheckCircle, Save, Plus, Trash2, Send, Download, FileSpreadsheet, FileText, Calendar, BookOpen, Award, RefreshCw, Sparkles, RotateCcw } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';

// Helper: Convert semester number to Roman Year / Roman Sem (e.g., 7 -> IV / VII)
const toRomanSem = (semVal) => {
  const s = parseInt(semVal, 10);
  if (!s || isNaN(s)) return semVal ? String(semVal) : '';
  const romanMap = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII' };
  const yearNum = Math.ceil(s / 2);
  const romanYear = romanMap[yearNum] || yearNum;
  const romanSem = romanMap[s] || s;
  return `${romanYear} / ${romanSem}`;
};

// Helper: Format instructor name & department / designation
const getInstructorString = (profile, alloc) => {
  const name = profile?.name || '';
  const dept = alloc?.department || profile?.dept || '';
  const desig = profile?.designation || (profile?.role === 'staff' ? 'AP' : '');
  if (desig && dept) {
    return `${name}, ${desig}/${dept}`.trim();
  } else if (dept) {
    return `${name}, ${dept}`.trim();
  }
  return name;
};

// Helper: Format exam date & session (e.g., 2026-09-09 + FN -> 09.09.2026 (FN))
const formatExamDate = (dateStr, sessionStr) => {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  let formatted = dateStr;
  if (parts.length === 3) {
    formatted = `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  if (sessionStr) {
    formatted += ` (${sessionStr.toUpperCase()})`;
  }
  return formatted;
};

// Helper: Academic year with ODD/EVEN semester detection
const getAcademicYearString = (academicSession, semVal) => {
  if (!academicSession) return '';
  const s = parseInt(semVal, 10);
  const oddEven = (s && s % 2 === 0) ? 'EVEN' : 'ODD';
  return `${academicSession} (${oddEven})`;
};

// Helper: Format exam display name cleanly and officially
const formatExamDisplayName = (name) => {
  if (!name) return 'EXAMINATION';
  const n = String(name).trim();
  if (n.toLowerCase() === 'model' || n.toLowerCase() === 'model exam') return 'MODEL EXAMINATION';
  if (n.toLowerCase() === 'cia 1' || n.toLowerCase() === 'internal 1' || n.toLowerCase() === 'internal test 1') return 'INTERNAL TEST I';
  if (n.toLowerCase() === 'cia 2' || n.toLowerCase() === 'internal 2' || n.toLowerCase() === 'internal test 2') return 'INTERNAL TEST II';
  if (n.toLowerCase() === 'cia 3' || n.toLowerCase() === 'internal 3' || n.toLowerCase() === 'internal test 3') return 'INTERNAL TEST III';
  return n.toUpperCase();
};

export default function QuestionPaper() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState([]);
  const [filterCourse, setFilterCourse] = useState('');
  
  const [questionsPool, setQuestionsPool] = useState([]);
  const [poolLoaded, setPoolLoaded] = useState(false);
  const [allocations, setAllocations] = useState([]);
  const [selectedAllocation, setSelectedAllocation] = useState('');

  // Exam Cell Integration State
  const [examsList, setExamsList] = useState([]);
  const [schedulesList, setSchedulesList] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  
  const [headerConfig, setHeaderConfig] = useState({
    collegeName: 'RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING',
    collegeAddress: 'Salvarpatti, Sivakasi - 626 128',
    examName: '',
    instructorName: '',
    classSemester: '',
    courseCodeName: '',
    academicYear: '',
    examDate: ''
  });

  const [courseOutcomes, setCourseOutcomes] = useState([
    { co: 'CO3', description: 'Ability to understand Six Sigma and apply Traditional tools, New tools, Benchmarking and FMEA.', btlLevel: 'AP' }
  ]);

  const [cam, setCam] = useState([
    { co: 'CO3', po1: '', po2: '', po3: '', po4: '', po5: '3', po6: '', po7: '', po8: '', po9: '3', po10: '', po11: '', po12: '2', pso1: '1', pso2: '2', pso3: '3' }
  ]);

  const [partAHeading, setPartAHeading] = useState('PART – A (5 × 2 = 10 Marks)');
  const [partBHeading, setPartBHeading] = useState('PART – B (2 × 13 = 26 Marks)');
  const [partCHeading, setPartCHeading] = useState('PART – C (1 × 14 = 14 Marks)');

  const [partAQuestions, setPartAQuestions] = useState([null, null, null, null, null]);
  const [partBQuestions, setPartBQuestions] = useState([{a: null, b: null}, {a: null, b: null}]);
  const [partCQuestions, setPartCQuestions] = useState([{a: null, b: null}]);
  
  const [previewMode, setPreviewMode] = useState(false);
  
  // Workflow fields
  const [paperStatus, setPaperStatus] = useState('DRAFT');
  const [revisionNumber, setRevisionNumber] = useState(1);
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [hodRemarks, setHodRemarks] = useState('');
  
  const isReadOnly = editId && paperStatus !== 'DRAFT' && paperStatus !== 'RETURNED_TO_STAFF';

  // Fetch Exam Cell examinations and schedules
  async function fetchExamCellData() {
    try {
      const [eSnap, sSnap] = await Promise.all([
        getDocs(query(collection(db, "cia_examinations"), orderBy("createdAt", "desc"))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, "cia_exam_schedules"), orderBy("createdAt", "desc"))).catch(() => ({ docs: [] }))
      ]);
      const eList = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const sList = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExamsList(eList);
      setSchedulesList(sList);
    } catch (err) {
      console.error("Error fetching Exam Cell data:", err);
    }
  }

  // Handle Exam Cell selection: Map exam metadata and configure 50M vs 100M question patterns
  const handleSelectExam = (examId, scheduleId = null, currentAlloc = null) => {
    const exam = examsList.find(e => e.id === examId);
    if (!exam) return;

    setSelectedExamId(examId);
    setSelectedScheduleId(scheduleId || '');

    const alloc = currentAlloc || allocations.find(a => a.id === selectedAllocation);
    const targetCourse = alloc ? alloc.courseCode : filterCourse;

    const schedule = scheduleId 
      ? schedulesList.find(s => s.id === scheduleId)
      : schedulesList.find(s => s.examId === examId && String(s.courseCode || '').trim().toUpperCase() === String(targetCourse || '').trim().toUpperCase());

    const examDateFormatted = schedule ? formatExamDate(schedule.date, schedule.session) : '';
    const acadYear = getAcademicYearString(exam.academicSession || '', alloc?.semester || exam.semester);
    const formattedExamName = formatExamDisplayName(exam.examName);

    setHeaderConfig(prev => ({
      ...prev,
      examName: formattedExamName || prev.examName || '',
      examDate: examDateFormatted || prev.examDate || '',
      academicYear: acadYear || prev.academicYear || ''
    }));

    // Dynamic slot configuration based on 50 Marks (CIA/Internal) vs 100 Marks (Model/EndSem)
    const isModel = Number(exam.maxMarks) === 100 || exam.examType === 'Model';
    if (isModel) {
      setPartAHeading('PART – A (10 × 2 = 20 Marks)');
      setPartBHeading('PART – B (5 × 13 = 65 Marks)');
      setPartCHeading('PART – C (1 × 15 = 15 Marks)');

      setPartAQuestions(prev => prev.length < 10 ? [...prev, ...Array(10 - prev.length).fill(null)] : prev);
      setPartBQuestions(prev => prev.length < 5 ? [...prev, ...Array(5 - prev.length).fill(null).map(() => ({ a: null, b: null }))] : prev);
      setPartCQuestions(prev => prev.length < 1 ? [{ a: null, b: null }] : prev);
    } else {
      setPartAHeading('PART – A (5 × 2 = 10 Marks)');
      setPartBHeading('PART – B (2 × 13 = 26 Marks)');
      setPartCHeading('PART – C (1 × 14 = 14 Marks)');

      setPartAQuestions(prev => prev.length < 5 ? [...prev, ...Array(5 - prev.length).fill(null)] : (prev.length > 5 ? prev.slice(0, 5) : prev));
      setPartBQuestions(prev => prev.length < 2 ? [...prev, ...Array(2 - prev.length).fill(null).map(() => ({ a: null, b: null }))] : (prev.length > 2 ? prev.slice(0, 2) : prev));
      setPartCQuestions(prev => prev.length < 1 ? [{ a: null, b: null }] : (prev.length > 1 ? prev.slice(0, 1) : prev));
    }
  };

  useEffect(() => {
    fetchExamCellData();
    if (userProfile?.role === 'staff') {
      fetchAllocations();
    } else {
      fetchCourses();
    }
    if (editId) {
      loadExistingPaper(editId);
    }
  }, [editId, userProfile]);

  // Synchronize Subject Context with Header Config, Question Bank, and Exam Schedules
  useEffect(() => {
    if (userProfile?.role === 'staff' && selectedAllocation && allocations.length > 0) {
      const alloc = allocations.find(a => a.id === selectedAllocation);
      if (alloc) {
        setFilterCourse(alloc.courseCode);
        loadPoolByCourse(alloc.courseCode);

        const classSem = toRomanSem(alloc.semester);
        const instructorStr = getInstructorString(userProfile, alloc);

        setHeaderConfig(prev => ({
          ...prev,
          courseCodeName: `${alloc.courseCode} - ${alloc.courseName || ''}`.trim(),
          classSemester: classSem || prev.classSemester,
          instructorName: instructorStr || prev.instructorName
        }));

        // Auto-match Exam Cell schedule for this subject
        if (schedulesList.length > 0 && examsList.length > 0) {
          const matchedSchedule = schedulesList.find(s => 
            String(s.courseCode || '').trim().toUpperCase() === String(alloc.courseCode || '').trim().toUpperCase()
          );
          if (matchedSchedule) {
            handleSelectExam(matchedSchedule.examId, matchedSchedule.id, alloc);
          } else if (examsList.length > 0 && !selectedExamId) {
            handleSelectExam(examsList[0].id, null, alloc);
          }
        }
      }
    }
  }, [selectedAllocation, allocations, schedulesList, examsList]);

  async function fetchAllocations() {
    try {
      const staffUid = userProfile?.uid || userProfile?.id;
      const staffName = userProfile?.name;

      // 1. Fetch from subject_allocations
      let rawSubjectAllocs = [];
      try {
        const qSub = query(collection(db, "subject_allocations"), where("facultyId", "==", staffUid), where("status", "==", "Active"));
        const snap = await getDocs(qSub);
        rawSubjectAllocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (e) {}

      if (rawSubjectAllocs.length === 0 && staffName) {
        try {
          const qName = query(collection(db, "subject_allocations"), where("facultyName", "==", staffName), where("status", "==", "Active"));
          const snap = await getDocs(qName);
          rawSubjectAllocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {}
      }

      // 2. Fetch from course_allocations
      let rawCourseAllocs = [];
      try {
        const qCourse = query(collection(db, "course_allocations"), where("facultyId", "==", staffUid));
        const snap = await getDocs(qCourse);
        rawCourseAllocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (e) {}

      if (rawCourseAllocs.length === 0 && staffName) {
        try {
          const qCourseName = query(collection(db, "course_allocations"), where("facultyName", "==", staffName));
          const snap = await getDocs(qCourseName);
          rawCourseAllocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {}
      }

      // 3. Fetch from subject_substitutes
      let rawSubs = [];
      try {
        const subQ = query(collection(db, "subject_substitutes"), where("substituteFacultyId", "==", staffUid), where("status", "==", "Active"));
        const subSnap = await getDocs(subQ);
        rawSubs = subSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), isSubstitute: true }));
      } catch (e) {}

      // Normalize all
      const normalizedMap = new Map();

      const addNormalized = (item, isSub = false) => {
        const code = (item.courseCode || item.subjectCode || item.subject_code || '').trim().toUpperCase();
        if (!code) return;
        const name = (item.courseName || item.subjectName || item.subject_name || '').trim();
        const key = `${code}_${item.semester || ''}_${item.section || ''}`;

        if (!normalizedMap.has(key)) {
          normalizedMap.set(key, {
            id: item.id || `alloc_${code}`,
            courseCode: code,
            courseName: name,
            department: item.department || item.dept || userProfile?.dept || '',
            semester: item.semester || '',
            year: item.year || '',
            section: item.section || '',
            programme: item.programme || item.batch || '',
            isSubstitute: isSub || !!item.isSubstitute,
            allocationId: item.allocationId || item.id
          });
        }
      };

      rawSubjectAllocs.forEach(a => addNormalized(a, false));
      rawCourseAllocs.forEach(a => addNormalized(a, false));
      rawSubs.forEach(a => addNormalized(a, true));

      const merged = Array.from(normalizedMap.values());
      setAllocations(merged);

      // Add staff's courses to courses state
      const myCourseCodes = merged.map(m => m.courseCode).filter(Boolean);
      setCourses(prev => Array.from(new Set([...prev, ...myCourseCodes])));

      if (merged.length > 0 && !editId) {
        setSelectedAllocation(merged[0].id);
        setFilterCourse(merged[0].courseCode);
      }
    } catch (err) {
      console.error("Error fetching allocations", err);
    }
  }

  async function fetchCourses() {
    try {
      const qBank = query(collection(db, "cia_question_bank"));
      const snapBank = await getDocs(qBank);
      const uniqueCourses = new Set();
      snapBank.docs.forEach(d => {
        const c = d.data().courseCode;
        if (c) uniqueCourses.add(c);
      });
      setCourses(prev => Array.from(new Set([...prev, ...Array.from(uniqueCourses)])));
    } catch (err) {
      console.error(err);
    }
  }

  async function loadExistingPaper(id) {
    setLoading(true);
    try {
      const docRef = doc(db, "cia_question_papers", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFilterCourse(data.courseCode);
        setHeaderConfig(data.headerConfig || headerConfig);
        setCourseOutcomes(data.courseOutcomes || courseOutcomes);
        setCam(data.cam || cam);
        setPartAHeading(data.headings?.partA || partAHeading);
        setPartBHeading(data.headings?.partB || partBHeading);
        setPartCHeading(data.headings?.partC || partCHeading);
        setPartAQuestions(data.partAQuestions || []);
        setPartBQuestions(data.partBQuestions || []);
        setPartCQuestions(data.partCQuestions || []);
        
        setPaperStatus(data.status || 'DRAFT');
        setRevisionNumber(data.revisionNumber || 1);
        setApprovalHistory(data.approvalHistory || []);
        setHodRemarks(data.hodRemarks || '');
        
        // Load the questions pool for this course
        await loadPoolByCourse(data.courseCode);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load question paper.");
    }
    setLoading(false);
  }

async function loadPoolByCourse(course) {
    if (!course) return;
    try {
      let q = query(collection(db, "cia_question_bank"), where("courseCode", "==", course));
      
      if (userProfile?.role === 'staff' && selectedAllocation) {
        const alloc = allocations.find(a => a.id === selectedAllocation);
        if (alloc) {
          if (alloc.isSubstitute) {
             q = query(collection(db, "cia_question_bank"), where("substituteId", "==", alloc.id));
          } else {
             q = query(collection(db, "cia_question_bank"), where("subjectAllocationId", "==", alloc.id));
          }
        }
      }

      const snap = await getDocs(q);
      let qList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Strict Semester Isolation
      const alloc = allocations.find(a => a.id === selectedAllocation) || allocations.find(a => a.courseCode === course);
      if (alloc && alloc.semester) {
        qList = qList.filter(d => !d.semester || String(d.semester).trim() === String(alloc.semester).trim());
      }

      setQuestionsPool(qList);
      setPoolLoaded(true);
    } catch (err) {
      console.error(err);
    }
  }

  const handleLoadPool = async () => {
    if (!filterCourse) {
      toast.error("Please select a Course Code.");
      return;
    }
    if (isReadOnly) return;
    
    setLoading(true);
    await loadPoolByCourse(filterCourse);
    // Reset selections only if we are loading manually (not via edit)
    if (!editId) {
      setPartAQuestions([null, null, null, null, null]);
      setPartBQuestions([{a: null, b: null}, {a: null, b: null}]);
      setPartCQuestions([{a: null, b: null}]);
      setPreviewMode(false);
    }
    setLoading(false);
    if (!editId && questionsPool.length === 0) {
      //toast.error("No questions found for this course in the Question Bank.");
    }
  };

  const partA_pool = questionsPool.filter(q => String(q.marks) === '2' || q.section === 'A' || q.part === 'A');
  const partB_pool = questionsPool.filter(q => String(q.marks) === '13' || String(q.marks) === '16' || q.section === 'B' || q.part === 'B');
  const partC_pool = questionsPool.filter(q => String(q.marks) === '14' || String(q.marks) === '15' || q.section === 'C' || q.part === 'C');

  // Intelligent Auto-Generate / Auto-Fill from Question Bank
  const handleAutoGenerate = () => {
    if (!questionsPool || questionsPool.length === 0) {
      toast.error("No questions found in the Question Bank for this course. Please add questions first.");
      return;
    }

    const usedIds = new Set();
    const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

    const poolA = shuffle(partA_pool);
    const poolB = shuffle(partB_pool);
    const poolC = shuffle(partC_pool);

    // 1. Auto-fill Part A (e.g. 10 questions for Model Exam, 5 for Internal)
    let filledA = 0;
    const newPartA = partAQuestions.map((_, idx) => {
      // Prioritize unit distribution (e.g. Q1-2: Unit 1, Q3-4: Unit 2, etc.)
      const preferredUnit = String(Math.floor(idx / 2) + 1);
      const q = poolA.find(item => !usedIds.has(item.id) && String(item.unit || '') === preferredUnit)
             || poolA.find(item => !usedIds.has(item.id));
      if (q) {
        usedIds.add(q.id);
        filledA++;
        return q.id;
      }
      return null;
    });

    // 2. Auto-fill Part B (pairs with either/or)
    let filledB = 0;
    const newPartB = partBQuestions.map((_, idx) => {
      // Prioritize same unit for each pair (Pair 0 -> Unit 1, Pair 1 -> Unit 2, etc.)
      const preferredUnit = String(idx + 1);
      
      let qA = poolB.find(item => !usedIds.has(item.id) && String(item.unit || '') === preferredUnit);
      if (!qA) qA = poolB.find(item => !usedIds.has(item.id));
      if (qA) { usedIds.add(qA.id); filledB++; }

      let qB = poolB.find(item => !usedIds.has(item.id) && String(item.unit || '') === preferredUnit);
      if (!qB) qB = poolB.find(item => !usedIds.has(item.id));
      if (qB) { usedIds.add(qB.id); filledB++; }

      return {
        a: qA ? qA.id : null,
        b: qB ? qB.id : null
      };
    });

    // 3. Auto-fill Part C (pairs with either/or)
    let filledC = 0;
    const newPartC = partCQuestions.map(() => {
      const qA = poolC.find(item => !usedIds.has(item.id));
      if (qA) { usedIds.add(qA.id); filledC++; }

      const qB = poolC.find(item => !usedIds.has(item.id));
      if (qB) { usedIds.add(qB.id); filledC++; }

      return {
        a: qA ? qA.id : null,
        b: qB ? qB.id : null
      };
    });

    setPartAQuestions(newPartA);
    setPartBQuestions(newPartB);
    setPartCQuestions(newPartC);

    const totalFilled = filledA + filledB + filledC;
    const totalSlots = partAQuestions.length + (partBQuestions.length * 2) + (partCQuestions.length * 2);

    if (totalFilled === totalSlots) {
      toast.success(`✨ Auto-generated all ${totalFilled} questions successfully!`);
    } else {
      toast.success(`⚡ Auto-filled ${totalFilled} of ${totalSlots} questions from Question Bank.`);
    }
  };

  // Clear all question selections
  const handleClearAllSlots = () => {
    setPartAQuestions(partAQuestions.map(() => null));
    setPartBQuestions(partBQuestions.map(() => ({ a: null, b: null })));
    setPartCQuestions(partCQuestions.map(() => ({ a: null, b: null })));
    toast.success("Question selections cleared.");
  };

  const isDisabled = (id, currentVal) => {
    if (!id) return false;
    if (id === currentVal) return false; 
    if (partAQuestions.includes(id)) return true;
    for (let pair of partBQuestions) {
      if (pair.a === id || pair.b === id) return true;
    }
    for (let pair of partCQuestions) {
      if (pair.a === id || pair.b === id) return true;
    }
    return false;
  };

  const isFormComplete = () => {
    if (partAQuestions.length === 0 || !partAQuestions.every(x => !!x)) return false;
    if (partBQuestions.length === 0 || !partBQuestions.every(p => !!p.a && !!p.b)) return false;
    if (partCQuestions.length === 0 || !partCQuestions.every(p => !!p.a && !!p.b)) return false;
    return true;
  };

  const calculateDistribution = () => {
    const dist = {};
    courseOutcomes.forEach(co => {
      dist[co.co] = { RE: 0, UN: 0, AP: 0, AN: 0, CR: 0, Total: 0 };
    });
    const addMarks = (qId, attemptedMarks) => {
      const q = questionsPool.find(x => x.id === qId);
      if (q && q.co && dist[q.co]) {
        const btl = q.btlLevel || 'UN'; 
        if (dist[q.co][btl] !== undefined) {
          dist[q.co][btl] += attemptedMarks;
          dist[q.co].Total += attemptedMarks;
        }
      }
    };
    partAQuestions.filter(Boolean).forEach(id => addMarks(id, 2));
    partBQuestions.forEach(p => { if (p.a) addMarks(p.a, 13); });
    partCQuestions.forEach(p => { 
      if (p.a) {
        const qA = questionsPool.find(x => x.id === p.a);
        const marks = qA?.marks ? Number(qA.marks) : (partCHeading.includes('15') ? 15 : 14);
        addMarks(p.a, marks);
      }
    });
    return dist;
  };

  const handleGeneratePreview = () => {
    if (!isFormComplete()) {
      toast.error("Please complete all question selections.");
      return;
    }
    const allSelections = [
      ...partAQuestions, 
      ...partBQuestions.map(p=>p.a), ...partBQuestions.map(p=>p.b),
      ...partCQuestions.map(p=>p.a), ...partCQuestions.map(p=>p.b)
    ].filter(Boolean);
    const uniqueSelections = new Set(allSelections);
    if (uniqueSelections.size !== allSelections.length) {
      toast.error("Duplicate questions detected.");
      return;
    }
    setPreviewMode(true);
  };

  const savePaperData = async (targetStatus) => {
    setSaving(true);
    try {
      const historyEntry = {
        action: targetStatus === 'DRAFT' ? (editId ? 'Edited Draft' : 'Created Draft') : 'Submitted to HOD',
        performedBy: userProfile.uid || 'unknown',
        performedByName: userProfile.name || 'Unknown',
        role: userProfile.role || 'staff',
        timestamp: new Date().toISOString()
      };

let allocData = {};
      if (userProfile?.role === 'staff' && !editId) {
        const alloc = allocations.find(a => a.id === selectedAllocation);
        if (alloc) {
           if (alloc.isSubstitute) {
             allocData.substituteId = alloc.id;
             allocData.subjectAllocationId = alloc.allocationId;
           } else {
             allocData.subjectAllocationId = alloc.id;
           }
           allocData.department = alloc.department || '';
           allocData.year = alloc.year || '';
           allocData.semester = alloc.semester || '';
           allocData.section = alloc.section || '';
        }
      }

      const payload = {
        courseCode: filterCourse,
        headerConfig,
        courseOutcomes,
        cam,
        headings: { partA: partAHeading, partB: partBHeading, partC: partCHeading },
        partAQuestions,
        partBQuestions,
        partCQuestions,
        status: targetStatus,
        revisionNumber: (paperStatus === 'RETURNED_TO_STAFF' && targetStatus === 'SUBMITTED_TO_HOD') ? revisionNumber + 1 : revisionNumber,
        ...allocData
      };

      if (!editId) {
        payload.department = userProfile.dept || '';
        payload.createdAt = serverTimestamp();
        payload.createdBy = userProfile.uid || 'unknown';
        payload.createdByName = userProfile.name || 'Unknown';
        payload.approvalHistory = [historyEntry];
        if (targetStatus === 'SUBMITTED_TO_HOD') {
          payload.submittedToHodAt = serverTimestamp();
          payload.submittedToHodBy = userProfile.uid || 'unknown';
        }
        await addDoc(collection(db, "cia_question_papers"), payload);
        toast.success(targetStatus === 'DRAFT' ? "Draft saved successfully!" : "Submitted to HOD!");
        navigate('/cia/my-papers');
      } else {
        const docRef = doc(db, "cia_question_papers", editId);
        payload.approvalHistory = [...approvalHistory, historyEntry];
        if (targetStatus === 'SUBMITTED_TO_HOD') {
          payload.submittedToHodAt = serverTimestamp();
          payload.submittedToHodBy = userProfile.uid || 'unknown';
        }
        await updateDoc(docRef, payload);
        toast.success(targetStatus === 'DRAFT' ? "Draft updated successfully!" : "Submitted to HOD!");
        setPaperStatus(targetStatus);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save Question Paper.");
    }
    setSaving(false);
  };

  const handlePrint = () => {
    const printContent = document.getElementById("printable-paper");
    if (!printContent) return;

    const clone = printContent.cloneNode(true);
    clone.style.border = 'none';
    clone.style.maxWidth = '100%';
    clone.style.width = '100%';
    clone.style.margin = '0';
    clone.style.padding = '0';

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    iframe.contentDocument.write(`
      <html><head><title>Question Paper</title>
      <style>
        @page { size: A4 portrait; margin: 8mm 10mm; }
        * { box-sizing: border-box; }
        body { font-family: "Times New Roman", Times, serif; font-size: 10.5pt; color: #000; margin: 0; padding: 0; }
        .page-border {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          border: 2px solid #000;
          pointer-events: none;
          box-sizing: border-box;
        }
        .content-wrap {
          padding: 4px 6px;
        }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid !important; break-inside: avoid !important; }
        tbody.question-pair { page-break-inside: avoid !important; break-inside: avoid !important; }
        .page-break-before { page-break-before: always !important; break-before: page !important; }
        th, td { border: 1px solid #000; padding: 3px 5px; text-align: left; vertical-align: top; color: #000 !important; font-size: 10pt; }
        .no-border-table td, .no-border-table th { border: none !important; color: #000 !important; }
        .header-info { width: 100%; border: none; margin-bottom: 8px; }
        .header-info td { border: none; padding: 3px 4px; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .part-title { text-align: center; font-weight: bold; margin: 8px 0 4px 0; color: #000; page-break-after: avoid !important; break-after: avoid !important; }
        .signature-block { page-break-inside: avoid !important; break-inside: avoid !important; }
        .distribution-table { page-break-inside: avoid !important; break-inside: avoid !important; }
      </style></head>
      <body>
        <div class="page-border"></div>
        <div class="content-wrap">${clone.innerHTML}</div>
      </body></html>
    `);
    iframe.contentDocument.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => { document.body.removeChild(iframe); }, 1000);
  };

  const handleDownloadPdf = async () => {
    const printContent = document.getElementById("printable-paper");
    if (!printContent) return;

    // Convert logos to base64 to ensure they render instantly in the detached string
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

    const leftLogo = await getBase64('/logo-left.png');
    const rightLogo = await getBase64('/logo-right.png');

    // Clone printContent so the outer border does not get sliced across pages
    const clone = printContent.cloneNode(true);
    clone.style.border = 'none';
    clone.style.maxWidth = '100%';
    clone.style.width = '100%';
    clone.style.margin = '0';
    clone.style.padding = '0';

    let html = clone.outerHTML;
    html = html.replace(/\/logo-left\.png/g, leftLogo);
    html = html.replace(/\/logo-right\.png/g, rightLogo);

    // Wrap in container with proper page-break and typography styling
    const htmlString = `
      <style>
        * { box-sizing: border-box; }
        body { font-family: "Times New Roman", Times, serif; font-size: 10.5pt; color: #000; margin: 0; padding: 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid !important; break-inside: avoid !important; }
        tbody.question-pair { page-break-inside: avoid !important; break-inside: avoid !important; }
        .page-break-before { page-break-before: always !important; break-before: page !important; }
        th, td { border: 1px solid #000; padding: 3px 5px; text-align: left; vertical-align: top; color: #000 !important; font-size: 10pt; }
        .part-title { text-align: center; font-weight: bold; margin: 8px 0 4px 0; color: #000; page-break-after: avoid !important; break-after: avoid !important; }
        .signature-block { page-break-inside: avoid !important; break-inside: avoid !important; }
        .distribution-table { page-break-inside: avoid !important; break-inside: avoid !important; }
      </style>
      <div style="width: 710px; box-sizing: border-box; background: #fff; color: #000; margin: 0 auto; padding: 2px 4px;">
        ${html}
      </div>
    `;

    const filename = filterCourse ? `Question_Paper_${filterCourse}.pdf` : `Question_Paper.pdf`;

    const opt = {
      margin:       [8, 8, 8, 8],
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['css', 'legacy'], before: '.page-break-before', avoid: ['tbody.question-pair', 'tr', '.signature-block', '.distribution-table'] }
    };

    html2pdf()
      .set(opt)
      .from(htmlString)
      .toPdf()
      .get('pdf')
      .then((pdf) => {
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          // Draw neat outer border on EVERY page!
          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.6);
          pdf.rect(6, 6, 210 - 12, 297 - 12);

          if (totalPages > 1) {
            pdf.setFont('times', 'normal');
            pdf.setFontSize(9);
            pdf.setTextColor(0, 0, 0);
            pdf.text(`Page ${i} of ${totalPages}`, 105, 293, { align: 'center' });
          }
        }
      })
      .save();
  };

  const handleDownloadExcel = () => {
    try {
      toast.loading("Generating Excel spreadsheet...", { id: "excel-toast" });
      const wb = XLSX.utils.book_new();

      const qpRows = [
        [headerConfig.collegeName || 'RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING'],
        [headerConfig.collegeAddress || 'Salvarpatti, Sivakasi - 626 128'],
        [headerConfig.examName || 'QUESTION PAPER'],
        [],
        ["Course Instructor:", headerConfig.instructorName || '', "Class / Semester:", headerConfig.classSemester || ''],
        ["Course Code & Name:", headerConfig.courseCodeName || '', "Academic Year:", headerConfig.academicYear || ''],
        ["Date of Exam:", headerConfig.examDate || ''],
        [],
        ["COURSE OUTCOMES:"],
        ["CO", "Course Outcomes Description", "BTL Level"]
      ];

      (courseOutcomes || []).forEach(co => {
        qpRows.push([co.co, co.description, co.btlLevel]);
      });

      qpRows.push([]);
      qpRows.push(["PART A - Answer ALL questions (" + partAHeading + ")"]);
      qpRows.push(["Q.No", "Question", "BTL, CO"]);
      partAQuestions.forEach((id, idx) => {
        const q = questionsPool.find(x => x.id === id);
        qpRows.push([idx + 1, q?.questionText || "", `${q?.btlLevel || 'UN'}, ${q?.co || 'CO'}`]);
      });

      qpRows.push([]);
      qpRows.push(["PART B - Answer ALL questions (" + partBHeading + ")"]);
      qpRows.push(["Q.No", "Question", "BTL, CO"]);
      partBQuestions.forEach((pair, idx) => {
        const qNum = partB_start + idx;
        const qA = questionsPool.find(x => x.id === pair.a);
        const qB = questionsPool.find(x => x.id === pair.b);
        qpRows.push([`${qNum} a)`, qA?.questionText || "", `${qA?.btlLevel || 'UN'}, ${qA?.co || 'CO'}`]);
        qpRows.push(["", "(OR)", ""]);
        qpRows.push([`${qNum} b)`, qB?.questionText || "", `${qB?.btlLevel || 'UN'}, ${qB?.co || 'CO'}`]);
      });

      qpRows.push([]);
      qpRows.push(["PART C (" + partCHeading + ")"]);
      qpRows.push(["Q.No", "Question", "BTL, CO"]);
      partCQuestions.forEach((pair, idx) => {
        const qNum = partC_start + idx;
        const qA = questionsPool.find(x => x.id === pair.a);
        const qB = questionsPool.find(x => x.id === pair.b);
        qpRows.push([`${qNum} a)`, qA?.questionText || "", `${qA?.btlLevel || 'UN'}, ${qA?.co || 'CO'}`]);
        qpRows.push(["", "(OR)", ""]);
        qpRows.push([`${qNum} b)`, qB?.questionText || "", `${qB?.btlLevel || 'UN'}, ${qB?.co || 'CO'}`]);
      });

      const wsPaper = XLSX.utils.aoa_to_sheet(qpRows);
      wsPaper['!cols'] = [{ wch: 15 }, { wch: 80 }, { wch: 25 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsPaper, "Question Paper");

      const flatList = [];
      let sNo = 1;
      partAQuestions.forEach((id, idx) => {
        const q = questionsPool.find(x => x.id === id);
        if (q) {
          flatList.push({
            "S.No": sNo++,
            "Part": "Part A",
            "Q.No": idx + 1,
            "Question Text": q.questionText || "",
            "BTL Level": q.btlLevel || "",
            "CO": q.co || "",
            "Marks": 2
          });
        }
      });
      partBQuestions.forEach((pair, idx) => {
        const qNum = partB_start + idx;
        const qA = questionsPool.find(x => x.id === pair.a);
        const qB = questionsPool.find(x => x.id === pair.b);
        if (qA) {
          flatList.push({
            "S.No": sNo++,
            "Part": "Part B",
            "Q.No": `${qNum} a`,
            "Question Text": qA.questionText || "",
            "BTL Level": qA.btlLevel || "",
            "CO": qA.co || "",
            "Marks": 13
          });
        }
        if (qB) {
          flatList.push({
            "S.No": sNo++,
            "Part": "Part B (OR)",
            "Q.No": `${qNum} b`,
            "Question Text": qB.questionText || "",
            "BTL Level": qB.btlLevel || "",
            "CO": qB.co || "",
            "Marks": 13
          });
        }
      });
      partCQuestions.forEach((pair, idx) => {
        const qNum = partC_start + idx;
        const qA = questionsPool.find(x => x.id === pair.a);
        const qB = questionsPool.find(x => x.id === pair.b);
        const cMarks = (qA && qA.marks) ? Number(qA.marks) : (partCHeading.includes('15') ? 15 : 14);
        if (qA) {
          flatList.push({
            "S.No": sNo++,
            "Part": "Part C",
            "Q.No": `${qNum} a`,
            "Question Text": qA.questionText || "",
            "BTL Level": qA.btlLevel || "",
            "CO": qA.co || "",
            "Marks": cMarks
          });
        }
        if (qB) {
          flatList.push({
            "S.No": sNo++,
            "Part": "Part C (OR)",
            "Q.No": `${qNum} b`,
            "Question Text": qB.questionText || "",
            "BTL Level": qB.btlLevel || "",
            "CO": qB.co || "",
            "Marks": cMarks
          });
        }
      });

      if (flatList.length > 0) {
        const wsFlat = XLSX.utils.json_to_sheet(flatList);
        wsFlat['!cols'] = [
          { wch: 8 },
          { wch: 15 },
          { wch: 10 },
          { wch: 70 },
          { wch: 12 },
          { wch: 10 },
          { wch: 8 }
        ];
        XLSX.utils.book_append_sheet(wb, wsFlat, "Questions List");
      }

      const safeCourse = (filterCourse || headerConfig.courseCodeName || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Question_Paper_${safeCourse}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success("Excel (.xlsx) downloaded successfully!", { id: "excel-toast" });
    } catch (err) {
      console.error("Excel generation error:", err);
      toast.error("Failed to generate Excel file.", { id: "excel-toast" });
    }
  };

  const handleDownloadWord = async () => {
    const printContent = document.getElementById("printable-paper");
    if (!printContent) return;

    toast.loading("Preparing Word document...", { id: "word-toast" });

    try {
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

      const leftLogo = await getBase64('/logo-left.png');
      const rightLogo = await getBase64('/logo-right.png');

      let contentHtml = printContent.innerHTML;
      contentHtml = contentHtml.replace(/\/logo-left\.png/g, leftLogo);
      contentHtml = contentHtml.replace(/\/logo-right\.png/g, rightLogo);

      const wordDocHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>${headerConfig.examName || 'Exam'} - ${headerConfig.courseCodeName || ''}</title>
          <!--[if gte mso 9]>
          <xml>
            <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
              <w:DoNotOptimizeForBrowser/>
            </w:WordDocument>
          </xml>
          <![endif]-->
          <style>
            @page Section1 {
              size: 8.5in 11in;
              margin: 0.5in 0.5in 0.5in 0.5in;
              mso-header-margin: 0.2in;
              mso-footer-margin: 0.2in;
            }
            div.Section1 {
              page: Section1;
              font-family: "Times New Roman", Times, serif;
              font-size: 11pt;
              color: #000000;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            th, td {
              border: 1pt solid black;
              padding: 4pt 6pt;
              font-family: "Times New Roman", Times, serif;
            }
          </style>
        </head>
        <body>
          <div class="Section1">
            ${contentHtml}
          </div>
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff', wordDocHtml], {
        type: 'application/msword;charset=utf-8'
      });

      const safeCourse = (filterCourse || headerConfig.courseCodeName || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Question_Paper_${safeCourse}.doc`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast.success("Word document (.doc) downloaded successfully!", { id: "word-toast" });
    } catch (err) {
      console.error("Word generation error:", err);
      toast.error("Failed to generate Word document.", { id: "word-toast" });
    }
  };

  const partA_start = 1;
  const partB_start = partA_start + partAQuestions.length;
  const partC_start = partB_start + partBQuestions.length;
  const is100Marks = partAQuestions.length >= 8 || partBQuestions.length >= 4 || headerConfig?.examName?.toLowerCase()?.includes('model') || headerConfig?.examName?.toLowerCase()?.includes('semester') || partBHeading?.includes('5 × 13');

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />
        
        {paperStatus === 'RETURNED_TO_STAFF' && (
          <div style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b', padding: 15, borderRadius: 8, marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 5px 0' }}>Returned by HOD</h4>
            <p style={{ margin: 0 }}><strong>Remarks:</strong> {hodRemarks}</p>
          </div>
        )}

        {isReadOnly && (
          <div style={{ background: '#dbeafe', border: '1px solid #3b82f6', color: '#1e40af', padding: 15, borderRadius: 8, marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 5px 0' }}>Locked ({paperStatus})</h4>
            <p style={{ margin: 0 }}>This question paper is currently locked and under review.</p>
          </div>
        )}

        {!previewMode ? (
          <>
            <div className='page-header'>
              <h1>Question Paper Builder</h1>
              <p className="subtitle">Select existing questions from the bank and generate formal paper</p>
            </div>

            <div className="card" style={{ marginBottom: 20, opacity: isReadOnly ? 0.7 : 1, pointerEvents: isReadOnly ? 'none' : 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'flex-end' }}>
                
                {/* 1. Subject / Course Selector */}
                {userProfile?.role === 'staff' && allocations.length > 0 ? (
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      Allocated Subject (Staff) *
                    </label>
                    <select 
                      value={selectedAllocation} 
                      onChange={(e) => setSelectedAllocation(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontSize: 13 }}
                    >
                      {allocations.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.isSubstitute ? '[Substitute] ' : ''}{a.courseCode} - {a.courseName} ({a.department}{a.semester ? `, Sem: ${a.semester}` : ''}{a.section && a.section !== 'None' ? `, Sec: ${a.section}` : ''})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      Course Code *
                    </label>
                    <select 
                      value={filterCourse} 
                      onChange={(e) => {
                        const code = e.target.value;
                        setFilterCourse(code);
                        loadPoolByCourse(code);
                        setHeaderConfig(prev => ({ ...prev, courseCodeName: code }));
                        const matched = schedulesList.find(s => String(s.courseCode || '').trim().toUpperCase() === code.trim().toUpperCase());
                        if (matched) handleSelectExam(matched.examId, matched.id);
                      }} 
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontSize: 13 }}
                    >
                      <option value="">Select Course</option>
                      {courses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                {/* 2. Exam Selector */}
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    Examination *
                  </label>
                  <select
                    value={selectedExamId}
                    onChange={(e) => handleSelectExam(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontSize: 13 }}
                  >
                    <option value="">Select Examination</option>
                    {examsList.map(e => {
                      const targetCourse = filterCourse || allocations.find(a => a.id === selectedAllocation)?.courseCode;
                      const sch = schedulesList.find(s => s.examId === e.id && String(s.courseCode || '').trim().toUpperCase() === String(targetCourse || '').trim().toUpperCase());
                      const marks = e.maxMarks || (e.examType === 'Model' ? 100 : 50);
                      const name = formatExamDisplayName(e.examName);
                      const schDateParts = sch?.date ? sch.date.split('-').reverse().join('.') : '';
                      const dateStr = schDateParts ? `${schDateParts}${sch?.session ? ' ' + sch.session.toUpperCase() : ''}, ` : '';
                      return (
                        <option key={e.id} value={e.id}>
                          {name} ({dateStr}{marks} Marks)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* 3. Actions / Reload */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button 
                    onClick={() => {
                      if (filterCourse) {
                        setLoading(true);
                        loadPoolByCourse(filterCourse).then(() => {
                          setLoading(false);
                          toast.success("Question bank refreshed!");
                        });
                      } else {
                        toast.error("Please select a subject first.");
                      }
                    }} 
                    className="btn-primary" 
                    disabled={loading} 
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', height: '42px', fontSize: 13, borderRadius: 6 }}
                  >
                    <RefreshCw size={15} /> {loading ? 'Loading...' : 'Refresh Bank'}
                  </button>
                  {poolLoaded && (
                    <span style={{ fontSize: 12, color: questionsPool.length > 0 ? '#10b981' : '#f59e0b', fontWeight: 500 }}>
                      {questionsPool.length > 0 ? `${questionsPool.length} Questions Loaded` : 'No questions yet'}
                    </span>
                  )}
                </div>

              </div>
            </div>

            {poolLoaded && (
              <div className="card" style={{ marginBottom: 20, opacity: isReadOnly ? 0.7 : 1, pointerEvents: isReadOnly ? 'none' : 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, color: '#4f46e5', fontSize: 17 }}>Configuration & Selection</h2>
                    <button
                      type="button"
                      onClick={handleAutoGenerate}
                      disabled={questionsPool.length === 0}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '6px 14px',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: questionsPool.length === 0 ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)'
                      }}
                      title="Auto-fill all question slots from Question Bank"
                    >
                      <Sparkles size={14} /> Auto-Generate
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllSlots}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '6px 10px',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                      title="Clear all question selections"
                    >
                      <RotateCcw size={12} /> Clear Slots
                    </button>
                  </div>
                  <div style={{ color: isFormComplete() ? '#10b981' : '#f59e0b', fontWeight: 600, fontSize: 13 }}>
                    {isFormComplete() ? 'All Sections Complete ✓' : 'Incomplete Sections'}
                  </div>
                </div>

                {/* Pattern & Exam Details Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 25, padding: '10px 16px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: 6, border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13, letterSpacing: '0.3px' }}>
                      {headerConfig.examName || 'EXAMINATION'}
                    </span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#4f46e5', color: '#fff', fontWeight: 600 }}>
                      {partCHeading.includes('15') || partBHeading.includes('65') ? '100 Marks (Model Exam)' : '50 Marks (CIA Internal)'}
                    </span>
                    {headerConfig.examDate && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Exam Date: <strong style={{ color: 'var(--text)' }}>{headerConfig.examDate}</strong>
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Pattern: Part A ({partAQuestions.length} Qs) · Part B ({partBQuestions.length} Pairs) · Part C ({partCQuestions.length} Pair)
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 30 }}>
                  <div style={{ padding: 18, border: '1px solid var(--border-color)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                      <h3 style={{ margin: 0, fontSize: 15 }}>Header Configuration</h3>
                      <span style={{ fontSize: 11, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>Auto-mapped ✓</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { key: 'collegeName', label: 'College Name' },
                        { key: 'collegeAddress', label: 'College Address' },
                        { key: 'examName', label: 'Examination (from Exam Cell)' },
                        { key: 'courseCodeName', label: 'Course Code & Subject Name' },
                        { key: 'classSemester', label: 'Class / Semester' },
                        { key: 'instructorName', label: 'Course Instructor' },
                        { key: 'academicYear', label: 'Academic Year' },
                        { key: 'examDate', label: 'Date of Exam & Session' }
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 3 }}>
                            {label}
                          </label>
                          <input 
                            type="text" 
                            value={headerConfig[key] || ''} 
                            onChange={e => setHeaderConfig({...headerConfig, [key]: e.target.value})} 
                            style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontSize: 13 }} 
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ padding: 15, border: '1px solid var(--border-color)', borderRadius: 8, marginBottom: 20 }}>
                      <input value={partAHeading} onChange={e=>setPartAHeading(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: 15, fontWeight: 'bold', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
                      {partAQuestions.map((val, idx) => (
                        <div key={idx} style={{ marginBottom: 10, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Question {idx + 1}</label>
                            <select value={val || ''} onChange={e => {
                                const arr = [...partAQuestions]; arr[idx] = e.target.value; setPartAQuestions(arr);
                              }} style={{ width: '100%', padding: '6px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                              <option value="">-- Select Question --</option>
                              {partA_pool.map(q => <option key={q.id} value={q.id} disabled={isDisabled(q.id, val)}>{q.questionText.substring(0, 50)}...</option>)}
                            </select>
                          </div>
                          <button onClick={() => setPartAQuestions(partAQuestions.filter((_, i) => i !== idx))} style={{ padding: '6px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={18} /></button>
                        </div>
                      ))}
                      <button onClick={() => setPartAQuestions([...partAQuestions, null])} style={{ padding: '6px 12px', fontSize: 12, background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Plus size={14}/> Add Part A Question
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 30 }}>
                  <div style={{ padding: 15, border: '1px solid var(--border-color)', borderRadius: 8 }}>
                    <input value={partBHeading} onChange={e=>setPartBHeading(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: 15, fontWeight: 'bold', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
                    {partBQuestions.map((pair, idx) => {
                      const qNum = partB_start + idx;
                      return (
                        <div key={idx} style={{ marginBottom: 20, padding: 10, background: 'rgba(0,0,0,0.02)', borderRadius: 6, position: 'relative' }}>
                          <button onClick={() => setPartBQuestions(partBQuestions.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: 5, right: 5, padding: '4px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{qNum} a)</label>
                          <select value={pair.a || ''} onChange={e => {
                            const arr = [...partBQuestions]; arr[idx].a = e.target.value; setPartBQuestions(arr);
                          }} style={{ width: '100%', padding: '6px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                            <option value="">-- Select Question --</option>
                            {partB_pool.map(q => <option key={q.id} value={q.id} disabled={isDisabled(q.id, pair.a)}>{q.questionText.substring(0, 50)}...</option>)}
                          </select>
                          <div style={{ textAlign: 'center', fontSize: 12, margin: '4px 0' }}>OR</div>
                          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{qNum} b)</label>
                          <select value={pair.b || ''} onChange={e => {
                            const arr = [...partBQuestions]; arr[idx].b = e.target.value; setPartBQuestions(arr);
                          }} style={{ width: '100%', padding: '6px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                            <option value="">-- Select Question --</option>
                            {partB_pool.map(q => <option key={q.id} value={q.id} disabled={isDisabled(q.id, pair.b)}>{q.questionText.substring(0, 50)}...</option>)}
                          </select>
                        </div>
                      )
                    })}
                    <button onClick={() => setPartBQuestions([...partBQuestions, {a:null, b:null}])} style={{ padding: '6px 12px', fontSize: 12, background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Plus size={14}/> Add Part B Pair
                    </button>
                  </div>

                  <div style={{ padding: 15, border: '1px solid var(--border-color)', borderRadius: 8 }}>
                    <input value={partCHeading} onChange={e=>setPartCHeading(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: 15, fontWeight: 'bold', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
                    {partCQuestions.map((pair, idx) => {
                      const qNum = partC_start + idx;
                      return (
                        <div key={idx} style={{ marginBottom: 20, padding: 10, background: 'rgba(0,0,0,0.02)', borderRadius: 6, position: 'relative' }}>
                          <button onClick={() => setPartCQuestions(partCQuestions.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: 5, right: 5, padding: '4px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{qNum} a)</label>
                          <select value={pair.a || ''} onChange={e => {
                            const arr = [...partCQuestions]; arr[idx].a = e.target.value; setPartCQuestions(arr);
                          }} style={{ width: '100%', padding: '6px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                            <option value="">-- Select Question --</option>
                            {partC_pool.map(q => <option key={q.id} value={q.id} disabled={isDisabled(q.id, pair.a)}>{q.questionText.substring(0, 50)}...</option>)}
                          </select>
                          <div style={{ textAlign: 'center', fontSize: 12, margin: '4px 0' }}>OR</div>
                          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{qNum} b)</label>
                          <select value={pair.b || ''} onChange={e => {
                            const arr = [...partCQuestions]; arr[idx].b = e.target.value; setPartCQuestions(arr);
                          }} style={{ width: '100%', padding: '6px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                            <option value="">-- Select Question --</option>
                            {partC_pool.map(q => <option key={q.id} value={q.id} disabled={isDisabled(q.id, pair.b)}>{q.questionText.substring(0, 50)}...</option>)}
                          </select>
                        </div>
                      )
                    })}
                    <button onClick={() => setPartCQuestions([...partCQuestions, {a:null, b:null}])} style={{ padding: '6px 12px', fontSize: 12, background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Plus size={14}/> Add Part C Pair
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {poolLoaded && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
                <button onClick={() => { if(isReadOnly) { setPreviewMode(true); } else { handleGeneratePreview(); } }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px' }}>
                  <CheckCircle size={16} /> {isReadOnly ? "View Paper" : "Validate & Preview Paper"}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <button onClick={() => setPreviewMode(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>
                Back
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                {!isReadOnly && (
                  <>
                    <button onClick={() => savePaperData('DRAFT')} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Save size={16} /> Save Draft
                    </button>
                    <button onClick={() => savePaperData('SUBMITTED_TO_HOD')} className="btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Send size={16} /> Submit to HOD
                    </button>
                  </>
                )}
                <button onClick={handleDownloadPdf} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 500, fontSize: '13px' }} title="Download Question Paper as PDF">
                  <Download size={16} /> Download PDF
                </button>
                <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: 'none', background: '#405189', color: '#fff', cursor: 'pointer', fontWeight: 500, fontSize: '13px' }} title="Print Question Paper">
                  <Printer size={16} /> Print Paper
                </button>
              </div>
            </div>
            
            <div style={{ background: '#fff', color: '#000', padding: '20px 40px', borderRadius: 8, overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
              <div id="printable-paper" style={{ fontFamily: '"Times New Roman", Times, serif', width: '100%', maxWidth: '800px', margin: '0 auto', fontSize: '11.5px', border: '2px solid #000', padding: '12px 14px', boxSizing: 'border-box' }}>
                
                {/* 1. Register Number */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 10, color: '#000', gap: 12 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '11px' }}>Register Number:</div>
                  <div style={{ display: 'flex' }}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
                      <div key={i} style={{ width: 19, height: 19, border: '1px solid #000', borderRight: i === 12 ? '1px solid #000' : 'none' }}></div>
                    ))}
                  </div>
                </div>

                {/* 2. Official Header with College Logos */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, color: '#000' }}>
                  <div style={{ width: '75px', height: '75px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src="/logo-left.png" alt="Left Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={(e) => e.target.style.display = 'none'} />
                  </div>
                  <div style={{ textAlign: 'center', flex: 1, padding: '0 10px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {headerConfig.collegeName || 'RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#333', marginBottom: 6 }}>
                      {headerConfig.collegeAddress || 'Salvarpatti, Sivakasi - 626 128'}
                    </div>
                    <div style={{ display: 'inline-block', border: '1.5px solid #1e3a8a', borderRadius: '15px', padding: '3px 18px', fontWeight: 'bold', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {headerConfig.examName || 'EXAMINATION'}
                    </div>
                  </div>
                  <div style={{ width: '75px', height: '75px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src="/logo-right.png" alt="Right Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={(e) => e.target.style.display = 'none'} />
                  </div>
                </div>

                {/* 3. Examination Metadata Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, color: '#000', fontSize: '11px' }}>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '3px 6px', width: '55%' }}>
                        Name of Course Instructor: <span style={{ fontWeight: 'bold' }}>{headerConfig.instructorName || '-'}</span>
                      </td>
                      <td style={{ border: '1px solid #000', padding: '3px 6px', width: '45%' }}>
                        Class / Semester: <span style={{ fontWeight: 'bold' }}>{headerConfig.classSemester || '-'}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                        Course Code & Name: <span style={{ fontWeight: 'bold' }}>{headerConfig.courseCodeName || '-'}</span>
                      </td>
                      <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                        Academic Year: <span style={{ fontWeight: 'bold' }}>{headerConfig.academicYear || '-'}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                        Date & Session: <span style={{ fontWeight: 'bold' }}>{headerConfig.examDate || '-'}</span>
                      </td>
                      <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                        Max. Marks: <span style={{ fontWeight: 'bold' }}>{is100Marks ? '100' : '50'}</span> &nbsp;|&nbsp; Duration: <span style={{ fontWeight: 'bold' }}>{is100Marks ? '3 Hours' : '90 Mins'}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* 4. Course Outcomes */}
                <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: 2, color: '#000' }}>COURSE OUTCOMES:</div>
                <div style={{ fontSize: '10.5px', marginBottom: 3, color: '#000', fontStyle: 'italic' }}>At the end of the course the students will be able to:</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, color: '#000', fontSize: '10.5px' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6', fontWeight: 'bold' }}>
                      <th style={{ border: '1px solid #000', padding: '3px 5px', width: '45px', textAlign: 'center' }}>CO</th>
                      <th style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'left' }}>Course Outcomes Description</th>
                      <th style={{ border: '1px solid #000', padding: '3px 5px', width: '70px', textAlign: 'center' }}>BTL Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseOutcomes.map((co, i) => (
                      <tr key={i} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                        <td style={{ border: '1px solid #000', padding: '2px 5px', textAlign: 'center', fontWeight: 'bold' }}>{co.co}</td>
                        <td style={{ border: '1px solid #000', padding: '2px 6px' }}>{co.description}</td>
                        <td style={{ border: '1px solid #000', padding: '2px 5px', textAlign: 'center' }}>{co.btlLevel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* 5. Course Assessment Matrix */}
                <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: 2, color: '#000' }}>COURSE ASSESSMENT MATRIX:</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, textAlign: 'center', color: '#000', fontSize: '9.5px' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6', fontWeight: 'bold' }}>
                      <th style={{ border: '1px solid #000', padding: '2px', width: '40px' }}>CO</th>
                      {['PO1','PO2','PO3','PO4','PO5','PO6','PO7','PO8','PO9','PO10','PO11','PO12','PSO1','PSO2','PSO3'].map(p => (
                        <th key={p} style={{ border: '1px solid #000', padding: '2px 1px' }}>{p.replace(/\d+/, '')}<br/>{p.match(/\d+/)[0]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cam.map((c, i) => (
                      <tr key={i} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                        <td style={{ border: '1px solid #000', padding: '2px', fontWeight: 'bold' }}>{c.co}</td>
                        {['po1','po2','po3','po4','po5','po6','po7','po8','po9','po10','po11','po12','pso1','pso2','pso3'].map(p => (
                          <td key={p} style={{ border: '1px solid #000', padding: '2px 1px' }}>{c[p]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* 6. PART – A (Questions 1 to 10 - Fits fully on Page 1) */}
                <div style={{ textAlign: 'center', marginTop: '6px', marginBottom: '4px', color: '#000' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{partAHeading}</div>
                  <div style={{ fontSize: '10.5px', fontStyle: 'italic' }}>Answer ALL Questions</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, color: '#000', fontSize: '10.5px' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6', fontWeight: 'bold' }}>
                      <th style={{ width: '38px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>Q.No</th>
                      <th style={{ textAlign: 'center', border: '1px solid #000', padding: '3px 6px' }}>Questions</th>
                      <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>Marks</th>
                      <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>CO</th>
                      <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>BTL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partAQuestions.map((id, idx) => {
                      const q = questionsPool.find(x => x.id === id);
                      return (
                        <tr key={idx} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                          <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'justify', verticalAlign: 'top', lineHeight: '1.25' }}>{q?.questionText || '-'}</td>
                          <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>2</td>
                          <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{q?.co || 'CO1'}</td>
                          <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{q?.btlLevel || 'UN'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* 7. PART – B & PART – C (Clean Page 2 Break for 100 Marks, or Continuation for 50 Marks) */}
                <div className={is100Marks ? "page-break-before" : ""} style={{ pageBreakBefore: is100Marks ? 'always' : 'auto', breakBefore: is100Marks ? 'page' : 'auto', marginTop: is100Marks ? '10px' : '10px' }}>
                  
                  {/* Part B Header */}
                  <div style={{ textAlign: 'center', marginBottom: '4px', color: '#000' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{partBHeading}</div>
                    <div style={{ fontSize: '10.5px', fontStyle: 'italic' }}>Answer ALL Questions (Either / Or Choice)</div>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', color: '#000', fontSize: '10.5px' }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6', fontWeight: 'bold' }}>
                        <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>Q.No</th>
                        <th style={{ textAlign: 'center', border: '1px solid #000', padding: '3px 6px' }}>Questions</th>
                        <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>Marks</th>
                        <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>CO</th>
                        <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>BTL</th>
                      </tr>
                    </thead>
                    {partBQuestions.map((pair, idx) => {
                      const qNum = partB_start + idx;
                      const qA = questionsPool.find(x => x.id === pair.a);
                      const qB = questionsPool.find(x => x.id === pair.b);
                      const marksVal = qA?.marks || (partBHeading.includes('16') ? 16 : 13);
                      return (
                        <tbody key={idx} className="question-pair" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                          <tr>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top' }}>{qNum} (a)</td>
                            <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'justify', verticalAlign: 'top', lineHeight: '1.25' }}>{qA?.questionText || '-'}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{marksVal}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{qA?.co || 'CO2'}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{qA?.btlLevel || 'UN'}</td>
                          </tr>
                          <tr>
                            <td colSpan="5" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontWeight: 'bold', fontSize: '10px', background: '#fafafa', letterSpacing: '2px' }}>(OR)</td>
                          </tr>
                          <tr>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top' }}>{qNum} (b)</td>
                            <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'justify', verticalAlign: 'top', lineHeight: '1.25' }}>{qB?.questionText || '-'}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{marksVal}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{qB?.co || 'CO2'}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{qB?.btlLevel || 'UN'}</td>
                          </tr>
                        </tbody>
                      );
                    })}
                  </table>

                  {/* Part C Header */}
                  <div style={{ textAlign: 'center', marginTop: '6px', marginBottom: '4px', color: '#000' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{partCHeading}</div>
                    <div style={{ fontSize: '10.5px', fontStyle: 'italic' }}>Answer ALL Questions (Either / Or Choice)</div>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', color: '#000', fontSize: '10.5px' }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6', fontWeight: 'bold' }}>
                        <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>Q.No</th>
                        <th style={{ textAlign: 'center', border: '1px solid #000', padding: '3px 6px' }}>Questions</th>
                        <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>Marks</th>
                        <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>CO</th>
                        <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>BTL</th>
                      </tr>
                    </thead>
                    {partCQuestions.map((pair, idx) => {
                      const qNum = partC_start + idx;
                      const qA = questionsPool.find(x => x.id === pair.a);
                      const qB = questionsPool.find(x => x.id === pair.b);
                      const marksVal = qA?.marks || (partCHeading.includes('15') ? 15 : 14);
                      return (
                        <tbody key={idx} className="question-pair" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                          <tr>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top' }}>{qNum} (a)</td>
                            <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'justify', verticalAlign: 'top', lineHeight: '1.25' }}>{qA?.questionText || '-'}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{marksVal}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{qA?.co || 'CO5'}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{qA?.btlLevel || 'CR'}</td>
                          </tr>
                          <tr>
                            <td colSpan="5" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontWeight: 'bold', fontSize: '10px', background: '#fafafa', letterSpacing: '2px' }}>(OR)</td>
                          </tr>
                          <tr>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top' }}>{qNum} (b)</td>
                            <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'justify', verticalAlign: 'top', lineHeight: '1.25' }}>{qB?.questionText || '-'}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{marksVal}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{qB?.co || 'CO5'}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{qB?.btlLevel || 'CR'}</td>
                          </tr>
                        </tbody>
                      );
                    })}
                  </table>

                  {/* 8. Course Outcome & Bloom's Taxonomy Distribution */}
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '10.5px', margin: '8px 0 3px 0', color: '#000' }}>
                    COURSE OUTCOME & BLOOM'S TAXONOMY DISTRIBUTION
                  </div>
                  <table className="distribution-table" style={{ width: '80%', margin: '0 auto 8px auto', borderCollapse: 'collapse', textAlign: 'center', color: '#000', pageBreakInside: 'avoid', breakInside: 'avoid', fontSize: '10px' }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6', fontWeight: 'bold' }}>
                        <th style={{ border: '1px solid #000', padding: '3px' }}>CO</th>
                        <th style={{ border: '1px solid #000', padding: '3px' }}>RE</th>
                        <th style={{ border: '1px solid #000', padding: '3px' }}>UN</th>
                        <th style={{ border: '1px solid #000', padding: '3px' }}>AP</th>
                        <th style={{ border: '1px solid #000', padding: '3px' }}>AN</th>
                        <th style={{ border: '1px solid #000', padding: '3px' }}>CR</th>
                        <th style={{ border: '1px solid #000', padding: '3px' }}>Total Marks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(calculateDistribution()).map(([coName, dist]) => (
                        <tr key={coName} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                          <td style={{ border: '1px solid #000', padding: '2px 4px', fontWeight: 'bold' }}>{coName}</td>
                          <td style={{ border: '1px solid #000', padding: '2px 4px' }}>{dist.RE || '-'}</td>
                          <td style={{ border: '1px solid #000', padding: '2px 4px' }}>{dist.UN || '-'}</td>
                          <td style={{ border: '1px solid #000', padding: '2px 4px' }}>{dist.AP || '-'}</td>
                          <td style={{ border: '1px solid #000', padding: '2px 4px' }}>{dist.AN || '-'}</td>
                          <td style={{ border: '1px solid #000', padding: '2px 4px' }}>{dist.CR || '-'}</td>
                          <td style={{ border: '1px solid #000', padding: '2px 4px', fontWeight: 'bold' }}>{dist.Total || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* 9. Signatures Block */}
                  <div className="signature-block" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 25px 0 25px', fontWeight: 'bold', marginTop: '16px', color: '#000', textAlign: 'center', pageBreakInside: 'avoid', breakInside: 'avoid', fontSize: '11px' }}>
                    <div style={{ flex: 1 }}>
                      <div>COURSE INSTRUCTOR</div>
                      <div style={{ marginTop: 28, fontSize: '10px', color: '#666', fontWeight: 'normal' }}>(Signature with Date)</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div>HOD</div>
                      {['SUBMITTED_TO_PRINCIPAL', 'APPROVED'].includes(paperStatus) ? (
                        <div style={{ color: '#10b981', fontSize: '12px', marginTop: '6px' }}>✓ APPROVED</div>
                      ) : (
                        <div style={{ marginTop: 28, fontSize: '10px', color: '#666', fontWeight: 'normal' }}>(Signature with Date)</div>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div>PRINCIPAL</div>
                      {['APPROVED'].includes(paperStatus) ? (
                        <div style={{ color: '#10b981', fontSize: '12px', marginTop: '6px' }}>✓ APPROVED</div>
                      ) : (
                        <div style={{ marginTop: 28, fontSize: '10px', color: '#666', fontWeight: 'normal' }}>(Signature with Date)</div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
            
            {editId && (
              <div style={{ marginTop: 30, padding: 20, background: 'var(--bg-color)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <h3>Approval History</h3>
                {approvalHistory.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No history available.</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {approvalHistory.map((h, i) => (
                      <div key={i} style={{ padding: 10, borderLeft: '3px solid #6366f1', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(h.timestamp).toLocaleString()}</div>
                        <div style={{ fontWeight: 'bold' }}>{h.action}</div>
                        <div style={{ fontSize: 13 }}>By: {h.performedByName} ({h.role})</div>
                        {h.remarks && <div style={{ fontSize: 13, marginTop: 4 }}><strong>Remarks:</strong> {h.remarks}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
