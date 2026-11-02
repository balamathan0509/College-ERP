import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, getDocs, addDoc, deleteDoc, doc, updateDoc, orderBy, where, setDoc } from "../../supabase/supabaseAdapter";
import { Plus, Trash2, Search, FileText, Edit2, Printer, ArrowLeft, Download, FileSpreadsheet, CheckCircle2, AlertCircle, Filter, BookOpen, Send, Users } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import toast, { Toaster } from 'react-hot-toast';

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

export default function QuestionBank() {
  const { userProfile } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL', 'A', 'B', 'C'
  
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' (bulk) or 'edit' (single)
  const [editId, setEditId] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [selectedAllocation, setSelectedAllocation] = useState('');

  // Exam Cell Integration State
  const [examsList, setExamsList] = useState([]);
  const [schedulesList, setSchedulesList] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');

  // Publish to Students State
  const [isPublished, setIsPublished] = useState(false);
  const [publishingLoading, setPublishingLoading] = useState(false);
  
  // Single Edit Form Data
  const [formData, setFormData] = useState({
    courseCode: '',
    courseName: '',
    programme: '',
    semester: '',
    section: 'A',
    unit: '1',
    topic: '',
    questionText: '',
    marks: '2',
    difficulty: 'Medium'
  });

  // Bulk Add Form Data
  const [bulkData, setBulkData] = useState({
    courseCode: '',
    courseName: '',
    programme: '',
    semester: '',
    unit: '1',
    difficulty: 'Medium',
    partA: [''],
    partB: [''],
    partC: ['']
  });

  const PROGRAMMES = ["B.E CSE", "B.E ECE", "B.E EEE", "B.E MECH", "B.Tech IT"];
  const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];

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
      console.error("Error fetching Exam Cell data in QuestionBank:", err);
    }
  }

  // Selected Exam Metadata & Pattern (Internal Test 50M -> 14M vs Model Exam 100M -> 15M)
  const currentExam = useMemo(() => {
    return examsList.find(e => e.id === selectedExamId) || null;
  }, [examsList, selectedExamId]);

  const currentSchedule = useMemo(() => {
    if (selectedScheduleId) {
      return schedulesList.find(s => s.id === selectedScheduleId) || null;
    }
    const currentAlloc = allocations.find(a => a.id === selectedAllocation);
    const targetCourse = currentAlloc ? currentAlloc.courseCode : courseFilter;
    if (targetCourse && selectedExamId) {
      return schedulesList.find(s => s.examId === selectedExamId && String(s.courseCode || '').trim().toUpperCase() === String(targetCourse || '').trim().toUpperCase()) || null;
    }
    return null;
  }, [schedulesList, selectedScheduleId, selectedExamId, allocations, selectedAllocation, courseFilter]);

  const isModelExam = useMemo(() => {
    if (!currentExam) return false;
    return Number(currentExam.maxMarks) === 100 || currentExam.examType === 'Model';
  }, [currentExam]);

  const partCMarks = isModelExam ? '15' : '14';

  useEffect(() => {
    fetchExamCellData();
    if (userProfile?.role === 'staff') {
      fetchAllocations();
    } else if (userProfile?.role === 'hod') {
      fetchDeptCourses();
      fetchQuestions();
    } else {
      fetchQuestions();
    }
  }, [userProfile]);

  useEffect(() => {
    if (selectedAllocation && allocations.length > 0) {
      fetchQuestions();

      const alloc = allocations.find(a => a.id === selectedAllocation);
      if (alloc) {
        if (schedulesList.length > 0 && examsList.length > 0) {
          const matchedSchedule = schedulesList.find(s => 
            String(s.courseCode || '').trim().toUpperCase() === String(alloc.courseCode || '').trim().toUpperCase()
          );
          if (matchedSchedule) {
            setSelectedExamId(matchedSchedule.examId);
            setSelectedScheduleId(matchedSchedule.id);
          } else if (examsList.length > 0 && !selectedExamId) {
            setSelectedExamId(examsList[0].id);
            setSelectedScheduleId('');
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
      } catch (e) {
        console.warn("fetchAllocations subject_allocations error", e);
      }

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
      } catch (e) {
        console.warn("fetchAllocations course_allocations error", e);
      }
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

      // Normalize all allocations so courseCode and courseName are always present
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
      if (merged.length > 0) {
        setSelectedAllocation(prev => prev && merged.some(m => m.id === prev) ? prev : merged[0].id);
      }
    } catch (err) {
      console.error("Error fetching allocations", err);
    }
  }

  async function fetchDeptCourses() {
    try {
      const q = query(collection(db, "course_allocations"), where("department", "==", userProfile.dept));
      const snap = await getDocs(q);
      const deptCourses = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          courseCode: (data.courseCode || data.subjectCode || '').trim().toUpperCase(),
          courseName: (data.courseName || data.subjectName || '').trim(),
          department: data.department || userProfile.dept,
          semester: data.semester || '',
          programme: data.programme || ''
        };
      }).filter(c => c.courseCode);
      setAllocations(deptCourses);
    } catch (e) {
      console.warn("fetchDeptCourses error", e);
    }
  }

  async function fetchQuestions() {
    setLoading(true);
    try {
      let q = query(collection(db, "cia_question_bank"), orderBy("createdAt", "desc"));
      
      if (userProfile?.role === 'staff') {
         const alloc = allocations.find(a => a.id === selectedAllocation) || allocations[0];
         if (alloc && alloc.courseCode) {
           q = query(collection(db, "cia_question_bank"), where("courseCode", "==", alloc.courseCode));
         } else if (alloc) {
           q = query(collection(db, "cia_question_bank"), where("subjectAllocationId", "==", alloc.id));
         } else {
           setQuestions([]);
           setLoading(false);
           return;
         }
      } else if (userProfile?.role === 'hod') {
         q = query(collection(db, "cia_question_bank"), where("department", "==", userProfile.dept));
      }
      
      const snap = await getDocs(q);
      let list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Strict Semester Isolation:
      // Questions belonging to a specific semester NEVER show in another semester!
      if (userProfile?.role === 'staff') {
        const alloc = allocations.find(a => a.id === selectedAllocation) || allocations[0];
        if (alloc && alloc.semester) {
          list = list.filter(item => !item.semester || String(item.semester).trim() === String(alloc.semester).trim());
        }
      }

      setQuestions(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load question bank");
    }
    setLoading(false);
  }

  // --- Handlers for Single Edit ---
  const handleSectionChange = (e) => {
    const val = e.target.value;
    let newMarks = '2';
    if (val === 'B') newMarks = '13';
    if (val === 'C') newMarks = partCMarks;
    setFormData(prev => ({ ...prev, section: val, marks: newMarks }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!formData.courseCode || !formData.questionText) {
      toast.error("Please fill all mandatory fields");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        updatedAt: new Date().toISOString()
      };
      if (userProfile?.role === 'staff') {
        const alloc = allocations.find(a => a.id === selectedAllocation);
        if (alloc) {
           if (alloc.isSubstitute) {
             payload.substituteId = alloc.id;
             payload.subjectAllocationId = alloc.allocationId;
           } else {
             payload.subjectAllocationId = alloc.id;
           }
           payload.department = alloc.department || '';
           payload.year = alloc.year || '';
           payload.semester = alloc.semester || '';
           payload.section = alloc.section || '';
        }
      }
      await updateDoc(doc(db, "cia_question_bank", editId), payload);
      toast.success("Question updated successfully");
      setShowModal(false);
      fetchQuestions();
    } catch (err) {
      console.error(err);
      toast.error("Error saving question");
    }
    setSaving(false);
  };

  const handleEdit = (q) => {
    setModalMode('edit');
    setFormData({
      courseCode: q.courseCode || '',
      courseName: q.courseName || '',
      programme: q.programme || '',
      semester: q.semester || '',
      section: q.section || 'A',
      unit: q.unit || '1',
      topic: q.topic || '',
      questionText: q.questionText || '',
      marks: q.marks || '2',
      difficulty: q.difficulty || 'Medium'
    });
    setEditId(q.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this question?")) {
      try {
        await deleteDoc(doc(db, "cia_question_bank", id));
        toast.success("Question deleted");
        fetchQuestions();
      } catch (err) {
        toast.error("Failed to delete question");
      }
    }
  };

  const handleOpenAddModal = (targetSection = 'ALL') => {
    const activeAlloc = allocations.find(a => a.id === selectedAllocation) || allocations.find(a => a.courseCode === courseFilter) || allocations[0];
    const initialCode = courseFilter || (activeAlloc ? activeAlloc.courseCode : '');
    const matchedAlloc = allocations.find(a => a.courseCode === initialCode) || activeAlloc;
    
    let initialPartA = [''];
    let initialPartB = [''];
    let initialPartC = [''];

    if (targetSection === 'A') {
      initialPartA = ['', '', ''];
      initialPartB = [];
      initialPartC = [];
    } else if (targetSection === 'B') {
      initialPartA = [];
      initialPartB = ['', ''];
      initialPartC = [];
    } else if (targetSection === 'C') {
      initialPartA = [];
      initialPartB = [];
      initialPartC = [''];
    }

    setBulkData({
      courseCode: initialCode,
      courseName: matchedAlloc ? matchedAlloc.courseName : '',
      programme: matchedAlloc ? matchedAlloc.programme : '',
      semester: matchedAlloc ? matchedAlloc.semester : '',
      unit: '1',
      difficulty: 'Medium',
      partA: initialPartA,
      partB: initialPartB,
      partC: initialPartC
    });
    setModalMode('add');
    setShowModal(true);
  };

  const addMultipleBulkFields = (section, count = 3) => {
    setBulkData(prev => ({
      ...prev,
      [section]: [...(prev[section] || []), ...Array(count).fill('')]
    }));
  };

  // --- Handlers for Bulk Add ---
  const handleBulkChange = (e) => {
    const { name, value } = e.target;
    setBulkData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'courseCode') {
        const alloc = allocations.find(a => a.courseCode === value);
        if (alloc) {
          newData.courseName = alloc.courseName || '';
          newData.programme = alloc.programme || '';
          newData.semester = alloc.semester || '';
        } else {
          newData.courseName = '';
        }
      }
      return newData;
    });
  };

  const handleBulkArrayChange = (section, index, value) => {
    setBulkData(prev => {
      const newArray = [...prev[section]];
      newArray[index] = value;
      return { ...prev, [section]: newArray };
    });
  };

  const addBulkField = (section) => {
    setBulkData(prev => ({
      ...prev,
      [section]: [...prev[section], '']
    }));
  };

  const removeBulkField = (section, index) => {
    setBulkData(prev => {
      const newArray = [...prev[section]];
      newArray.splice(index, 1);
      return { ...prev, [section]: newArray };
    });
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!bulkData.courseCode) {
      toast.error("Please enter the Course Code");
      return;
    }

    // Filter out empty questions
    const validPartA = bulkData.partA.filter(q => q.trim() !== '');
    const validPartB = bulkData.partB.filter(q => q.trim() !== '');
    const validPartC = bulkData.partC.filter(q => q.trim() !== '');

    if (validPartA.length === 0 && validPartB.length === 0 && validPartC.length === 0) {
      toast.error("Please add at least one question text.");
      return;
    }

    setSaving(true);
    try {
      let allocData = {};
      if (userProfile?.role === 'staff') {
        const alloc = allocations.find(a => a.courseCode === bulkData.courseCode) || allocations.find(a => a.id === selectedAllocation);
        if (!alloc) {
           toast.error("No active subject assignment selected.");
           setSaving(false);
           return;
        }
        if (alloc.isSubstitute) {
           allocData.substituteId = alloc.id;
           allocData.subjectAllocationId = alloc.allocationId || alloc.id;
        } else {
           allocData.subjectAllocationId = alloc.id;
        }
        allocData.department = alloc.department || '';
        allocData.year = alloc.year || '';
        allocData.semester = alloc.semester || '';
        allocData.section = alloc.section || '';
      } else if (userProfile?.role === 'hod') {
        allocData.department = userProfile.dept;
      }

      const basePayload = {
        courseCode: bulkData.courseCode,
        courseName: bulkData.courseName,
        difficulty: bulkData.difficulty,
        unit: bulkData.unit || '1',
        topic: '',
        createdAt: new Date().toISOString(),
        createdBy: userProfile?.uid || "unknown", // STRICT: Need uid for createdBy for rule matching
        createdByName: userProfile?.name || "System",
        authorId: userProfile?.uid || "unknown",
        ...allocData
      };

      const promises = [];

      // Save Part A
      for (const text of validPartA) {
        promises.push(addDoc(collection(db, "cia_question_bank"), {
          ...basePayload, section: 'A', marks: '2', questionText: text
        }));
      }

      // Save Part B
      for (const text of validPartB) {
        promises.push(addDoc(collection(db, "cia_question_bank"), {
          ...basePayload, section: 'B', marks: '13', questionText: text
        }));
      }

      // Save Part C
      for (const text of validPartC) {
        promises.push(addDoc(collection(db, "cia_question_bank"), {
          ...basePayload, section: 'C', marks: partCMarks, questionText: text
        }));
      }

      await Promise.all(promises);
      toast.success(`Successfully added ${promises.length} questions to the bank`);
      
      const savedCourseCode = bulkData.courseCode;
      setShowModal(false);
      setBulkData({
        courseCode: '', courseName: '', programme: '', semester: '', unit: '1', difficulty: 'Medium', partA: [''], partB: [''], partC: ['']
      });

      const matchingAlloc = allocations.find(a => a.courseCode === savedCourseCode);
      if (matchingAlloc && matchingAlloc.id !== selectedAllocation) {
        setSelectedAllocation(matchingAlloc.id);
      } else {
        fetchQuestions();
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving bulk questions");
    }
    setSaving(false);
  };

  const uniqueCourses = useMemo(() => {
    const fromAlloc = allocations.map(a => a.courseCode).filter(Boolean);
    const fromQuestions = questions.map(q => q.courseCode).filter(Boolean);
    return Array.from(new Set([...fromAlloc, ...fromQuestions]));
  }, [allocations, questions]);

  const activeCourse = courseFilter || (allocations.find(a => a.id === selectedAllocation)?.courseCode) || uniqueCourses[0] || '';

  const poolStats = useMemo(() => {
    const targetQs = questions.filter(q => !activeCourse || (q.courseCode || '').toLowerCase() === activeCourse.toLowerCase());
    return {
      courseCode: activeCourse,
      total: targetQs.length,
      partA: targetQs.filter(q => q.section === 'A').length,
      partB: targetQs.filter(q => q.section === 'B').length,
      partC: targetQs.filter(q => q.section === 'C').length
    };
  }, [questions, activeCourse]);

  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      const matchesCourse = !courseFilter || (q.courseCode || '').toLowerCase() === courseFilter.toLowerCase();
      const matchesText = !searchTerm || 
        (q.courseCode || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (q.questionText || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.topic || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTab = activeTab === 'ALL' || q.section === activeTab;
      return matchesCourse && matchesText && matchesTab;
    });
  }, [questions, courseFilter, searchTerm, activeTab]);

  // Check publish status
  useEffect(() => {
    async function checkPublishStatus() {
      if (!activeCourse) return;
      try {
        const qSnap = await getDocs(query(
          collection(db, "cia_published_question_banks"),
          where("courseCode", "==", activeCourse)
        ));
        const matched = qSnap.docs.find(d => {
          const data = d.data();
          return data.isPublished === true;
        });
        setIsPublished(!!matched);
      } catch (e) {
        console.warn("checkPublishStatus error", e);
      }
    }
    checkPublishStatus();
  }, [activeCourse, selectedExamId]);

  const handleTogglePublish = async () => {
    if (!activeCourse) {
      toast.error("Please select a course first.");
      return;
    }
    setPublishingLoading(true);
    try {
      const docId = `pub_${activeCourse}_${selectedExamId || 'general'}`.replace(/[\s/\\#?]+/g, '_');
      const alloc = allocations.find(a => a.id === selectedAllocation) || {};
      const exam = examsList.find(e => e.id === selectedExamId);

      if (isPublished) {
        await setDoc(doc(db, "cia_published_question_banks", docId), {
          courseCode: activeCourse,
          isPublished: false,
          status: 'UNPUBLISHED',
          updatedAt: new Date().toISOString()
        }, { merge: true });
        setIsPublished(false);
        toast.success("Question Bank unpublished from Students & Class In-charge.");
      } else {
        await setDoc(doc(db, "cia_published_question_banks", docId), {
          courseCode: activeCourse,
          courseName: alloc.courseName || '',
          department: alloc.department || userProfile?.dept || '',
          semester: alloc.semester ? String(alloc.semester) : '',
          year: alloc.year || '',
          section: alloc.section || '',
          examId: selectedExamId || '',
          examName: formatExamDisplayName(exam?.examName) || 'MODEL EXAMINATION',
          isPublished: true,
          status: 'PUBLISHED',
          totalQuestions: filteredQuestions.length || 0,
          partACount: poolStats.partA || 0,
          partBCount: poolStats.partB || 0,
          partCCount: poolStats.partC || 0,
          publishedAt: new Date().toISOString(),
          publishedBy: userProfile?.uid || userProfile?.id || '',
          publishedByName: userProfile?.name || 'Faculty',
          updatedAt: new Date().toISOString()
        });
        setIsPublished(true);
        toast.success(`🎉 Question Bank published! ${activeCourse} Students & Class In-charge can now view it.`);
      }
    } catch (err) {
      console.error("Error publishing question bank:", err);
      toast.error(err?.message || "Failed to update publish status.");
    }
    setPublishingLoading(false);
  };

  const handlePrint = () => {
    if (filteredQuestions.length === 0) {
      toast.error("No questions available to print.");
      return;
    }
    const printContent = document.getElementById("printable-bank");
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
      <html><head><title>Question Bank</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { box-sizing: border-box; }
        body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #000; margin: 0; padding: 0; }
        .page-border {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          border: 2px solid #000;
          pointer-events: none;
          box-sizing: border-box;
        }
        .content-wrap {
          padding: 6px 8px;
        }
        table { width: 100%; border-collapse: collapse; page-break-inside: auto; margin-bottom: 12px; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid !important; break-inside: avoid !important; }
        th, td { border: 1px solid #000; padding: 5px 6px; text-align: left; vertical-align: top; color: #000 !important; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .part-title { text-align: center; font-weight: bold; margin: 12px 0 6px 0; color: #000; page-break-after: avoid !important; break-after: avoid !important; }
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
    if (filteredQuestions.length === 0) {
      toast.error("No questions available to download.");
      return;
    }
    const printContent = document.getElementById("printable-bank");
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
        body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #000; margin: 0; padding: 0; }
        table { width: 100%; border-collapse: collapse; page-break-inside: auto; margin-bottom: 12px; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid !important; break-inside: avoid !important; }
        th, td { border: 1px solid #000; padding: 5px 6px; text-align: left; vertical-align: top; color: #000 !important; }
        .part-title { text-align: center; font-weight: bold; margin: 12px 0 6px 0; color: #000; page-break-after: avoid !important; break-after: avoid !important; }
      </style>
      <div style="width: 685px; box-sizing: border-box; background: #fff; color: #000; margin: 0 auto; padding: 4px 6px;">
        ${html}
      </div>
    `;

    const firstQ = filteredQuestions[0] || {};
    const filename = firstQ.courseCode ? `Question_Bank_${firstQ.courseCode}.pdf` : `Question_Bank.pdf`;

    const opt = {
      margin:       [10, 10, 10, 10],
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'], avoid: ['tr', '.part-title', 'table'] }
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
          // Draw a neat outer border on EVERY page!
          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.7);
          pdf.rect(6, 6, 210 - 12, 297 - 12);

          if (totalPages > 1) {
            pdf.setFont('times', 'normal');
            pdf.setFontSize(9);
            pdf.setTextColor(0, 0, 0);
            pdf.text(`Page ${i} of ${totalPages}`, 105, 294, { align: 'center' });
          }
        }
      })
      .save();
  };

  const handleDownloadExcel = () => {
    if (filteredQuestions.length === 0) {
      toast.error("No questions available to download.");
      return;
    }
    try {
      toast.loading("Generating Question Bank spreadsheet...", { id: "excel-toast" });
      const wb = XLSX.utils.book_new();

      const rows = [
        ["RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING"],
        ["Salvarpatti, Sivakasi - 626 128"],
        ["QUESTION BANK - " + courseText],
        [],
        ["S.No", "Course Code", "Course Name", "Part / Section", "Unit", "Question Text", "Marks", "Difficulty / BTL", "CO", "Created By"]
      ];

      filteredQuestions.forEach((q, idx) => {
        const marks = q.section === 'A' ? 2 : q.section === 'B' ? 13 : 15;
        rows.push([
          idx + 1,
          q.courseCode || '',
          q.courseName || '',
          `Part ${q.section || ''}`,
          q.unit ? `Unit ${q.unit}` : '',
          q.questionText || '',
          marks,
          q.difficulty || q.btlLevel || '',
          q.co || '',
          q.createdByName || ''
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [
        { wch: 8 },
        { wch: 15 },
        { wch: 25 },
        { wch: 15 },
        { wch: 10 },
        { wch: 65 },
        { wch: 8 },
        { wch: 15 },
        { wch: 10 },
        { wch: 20 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Question Bank");

      const firstQ = filteredQuestions[0] || {};
      const filename = firstQ.courseCode ? `Question_Bank_${firstQ.courseCode}.xlsx` : `Question_Bank.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success("Excel (.xlsx) downloaded successfully!", { id: "excel-toast" });
    } catch (err) {
      console.error("Excel generation error:", err);
      toast.error("Failed to generate Excel file.", { id: "excel-toast" });
    }
  };

  const handleDownloadWord = async () => {
    if (filteredQuestions.length === 0) {
      toast.error("No questions available to download.");
      return;
    }
    const printContent = document.getElementById("printable-bank");
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
          <title>Question Bank - ${courseText}</title>
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

      const firstQ = filteredQuestions[0] || {};
      const filename = firstQ.courseCode ? `Question_Bank_${firstQ.courseCode}.doc` : `Question_Bank.doc`;

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

  // Data for printing & official college header
  const currentAlloc = allocations.find(a => a.id === selectedAllocation);
  const instructorName = getInstructorString(userProfile, currentAlloc);
  const classSemester = toRomanSem(currentAlloc?.semester);
  const firstQ = filteredQuestions[0] || {};
  const courseCodeStr = currentAlloc?.courseCode || firstQ.courseCode || 'Unknown Course';
  const courseNameStr = currentAlloc?.courseName || firstQ.courseName || '';
  const courseFullName = courseNameStr ? `${courseCodeStr} - ${courseNameStr}` : courseCodeStr;
  const courseText = courseFullName;
  const academicYear = getAcademicYearString(currentExam?.academicSession || '', currentAlloc?.semester || currentExam?.semester);
  const examDateFormatted = currentSchedule ? formatExamDate(currentSchedule.date, currentSchedule.session) : '';

  const partA = filteredQuestions.filter(q => q.section === 'A');
  const partB = filteredQuestions.filter(q => q.section === 'B');
  const partC = filteredQuestions.filter(q => q.section === 'C');

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />
        <div className='page-header' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 15 }}>
          <div>
            <h1>Question Bank</h1>
            <p className="subtitle">Manage question pools for generating papers</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button 
              onClick={handleTogglePublish} 
              disabled={publishingLoading || filteredQuestions.length === 0}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6, 
                padding: '8px 14px', 
                borderRadius: 6, 
                border: 'none', 
                background: isPublished ? '#10b981' : '#4f46e5', 
                color: '#fff', 
                cursor: (publishingLoading || filteredQuestions.length === 0) ? 'not-allowed' : 'pointer', 
                fontWeight: 600, 
                fontSize: '13px',
                boxShadow: isPublished ? '0 2px 6px rgba(16,185,129,0.3)' : '0 2px 6px rgba(79,70,229,0.3)',
                opacity: (publishingLoading || filteredQuestions.length === 0) ? 0.6 : 1
              }} 
              title={isPublished ? "Question Bank is published. Click to unpublish." : "Publish this Question Bank for students and Class In-charge"}
            >
              <Send size={15} /> {isPublished ? 'Published to Class ✓' : 'Publish to Students & In-Charge'}
            </button>
            <button onClick={handleDownloadPdf} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 500, fontSize: '13px' }} title="Download Question Bank as PDF">
              <Download size={16} /> Download PDF
            </button>
            <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: 'none', background: '#405189', color: '#fff', cursor: 'pointer', fontWeight: 500, fontSize: '13px' }} title="Print Question Bank">
              <Printer size={16} /> Print Bank
            </button>
            <button className="btn-primary" onClick={handleOpenAddModal} style={{ width: 'auto', padding: '8px 14px', fontSize: '13px' }}>
              <Plus size={16} /> Add Questions
            </button>
          </div>
        </div>

        {/* Subject & Exam Cell Mapping Card */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'flex-end' }}>
            
            {/* 1. Subject Selector */}
            {userProfile?.role === 'staff' && allocations.length > 0 ? (
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  Allocated Subject (Staff) *
                </label>
                <select 
                  value={selectedAllocation} 
                  onChange={(e) => {
                    const newAllocId = e.target.value;
                    setSelectedAllocation(newAllocId);
                    const matched = allocations.find(a => a.id === newAllocId);
                    if (matched && matched.courseCode) {
                      setCourseFilter(matched.courseCode);
                    }
                  }}
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
                  value={courseFilter} 
                  onChange={(e) => setCourseFilter(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontSize: 13 }}
                >
                  <option value="">All Courses</option>
                  {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {/* 2. Examination Selector (Exam Cell) */}
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                Examination *
              </label>
              <select
                value={selectedExamId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedExamId(val);
                  const sch = schedulesList.find(s => s.examId === val && String(s.courseCode || '').trim().toUpperCase() === String(activeCourse || '').trim().toUpperCase());
                  setSelectedScheduleId(sch?.id || '');
                }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontSize: 13 }}
              >
                <option value="">Select Examination</option>
                {examsList.map(e => {
                  const sch = schedulesList.find(s => s.examId === e.id && String(s.courseCode || '').trim().toUpperCase() === String(activeCourse || '').trim().toUpperCase());
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

            {/* 3. Exam Pattern Badge & Publish Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Status & Target Pattern:</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, background: isModelExam ? '#4f46e5' : '#059669', color: '#fff', fontWeight: 600 }}>
                  {isModelExam ? 'Model Exam (100 Marks · Part C: 15M)' : 'Internal Test (50 Marks · Part C: 14M)'}
                </span>
                <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, background: isPublished ? '#dcfce7' : '#fef3c7', color: isPublished ? '#15803d' : '#b45309', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {isPublished ? 'Published to Students & In-Charge ✓' : 'Draft (Unpublished)'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Total: <strong style={{ color: 'var(--text)' }}>{filteredQuestions.length} Qs</strong>
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Filter and Tab Section */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 15, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div className="search-bar" style={{ flex: 1, minWidth: 260, maxWidth: 420 }}>
              <Search size={18} color="#9ca3af" />
              <input 
                type="text" 
                placeholder="Search questions by text or topic..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Course:</span>
              <select 
                value={courseFilter} 
                onChange={(e) => setCourseFilter(e.target.value)} 
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontWeight: 500 }}
              >
                <option value="">All Courses</option>
                {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              {(searchTerm || courseFilter) && (
                <button 
                  onClick={() => { setSearchTerm(''); setCourseFilter(''); }} 
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
          
          {/* Interactive Section Tabs */}
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                border: activeTab === 'ALL' ? '1px solid #2563eb' : '1px solid var(--border-color)',
                background: activeTab === 'ALL' ? '#2563eb' : 'transparent',
                color: activeTab === 'ALL' ? '#ffffff' : 'var(--text)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13
              }}
            >
              All Questions ({filteredQuestions.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('A')}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                border: activeTab === 'A' ? '1px solid #16a34a' : '1px solid var(--border-color)',
                background: activeTab === 'A' ? '#16a34a' : 'transparent',
                color: activeTab === 'A' ? '#ffffff' : 'var(--text)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13
              }}
            >
              Part A (2 Marks)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('B')}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                border: activeTab === 'B' ? '1px solid #2563eb' : '1px solid var(--border-color)',
                background: activeTab === 'B' ? '#2563eb' : 'transparent',
                color: activeTab === 'B' ? '#ffffff' : 'var(--text)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13
              }}
            >
              Part B (13 Marks)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('C')}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                border: activeTab === 'C' ? '1px solid #9333ea' : '1px solid var(--border-color)',
                background: activeTab === 'C' ? '#9333ea' : 'transparent',
                color: activeTab === 'C' ? '#ffffff' : 'var(--text)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13
              }}
            >
              Part C ({partCMarks} Marks)
            </button>
          </div>
        </div>

        {/* Official College Document Format View */}
        <div id="printable-bank" style={{ maxWidth: 950, margin: '0 auto', background: '#ffffff', color: '#000', padding: '24px 28px', border: '2px solid #000', borderRadius: 4, boxShadow: '0 4px 18px rgba(0,0,0,0.08)', fontFamily: '"Times New Roman", Times, serif', boxSizing: 'border-box' }}>
          
          {/* Official College Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/logo-left.png" alt="Left Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ textAlign: 'center', flex: 1, padding: '0 15px' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#b91c1c' }}>RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING</div>
              <div style={{ fontSize: '13px', marginBottom: 6, color: '#000' }}>Salvarpatti, Sivakasi - 626 128</div>
              <div style={{ display: 'inline-block', border: '1.5px solid #1e3a8a', borderRadius: '15px', padding: '3px 18px', fontWeight: 'bold', color: '#1e3a8a', fontSize: '13px' }}>
                {currentExam ? `${formatExamDisplayName(currentExam.examName)} — QUESTION BANK` : 'QUESTION BANK'}
              </div>
            </div>
            <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/logo-right.png" alt="Right Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
          </div>

          {/* Official Subject & Exam Details Table */}
          <table style={{ width: '100%', border: 'none', marginBottom: 14, color: '#000', fontSize: '12px', borderBottom: '1.5px solid #000', paddingBottom: 8 }}>
            <tbody>
              <tr>
                <td style={{ border: 'none', padding: '3px 0', width: '60%', color: '#000' }}>
                  Name of the Course Instructor: <span style={{ fontWeight: 'bold', color: '#000' }}>{instructorName || '-'}</span>
                </td>
                <td style={{ border: 'none', padding: '3px 0', width: '40%', color: '#000' }}>
                  Class / Semester: <span style={{ fontWeight: 'bold', color: '#000' }}>{classSemester || '-'}</span>
                </td>
              </tr>
              <tr>
                <td style={{ border: 'none', padding: '3px 0', color: '#000' }}>
                  Course Code & Name: <span style={{ fontWeight: 'bold', color: '#000' }}>{courseFullName || '-'}</span>
                </td>
                <td style={{ border: 'none', padding: '3px 0', color: '#000' }}>
                  Academic Year: <span style={{ fontWeight: 'bold', color: '#000' }}>{academicYear || '-'}</span>
                </td>
              </tr>
              {examDateFormatted && (
                <tr>
                  <td colSpan="2" style={{ border: 'none', padding: '3px 0', color: '#000' }}>
                    Date of Exam: <span style={{ fontWeight: 'bold', color: '#000' }}>{examDateFormatted}</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading questions...</div>
          ) : filteredQuestions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#000' }}>
              <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>No questions found in this bank</div>
              <p style={{ color: '#4b5563', fontSize: 13, maxWidth: 450, margin: '0 auto 20px' }}>
                {searchTerm ? 'Try adjusting your search terms or course filter.' : 'Start adding questions to build your question bank for paper generation.'}
              </p>
              <button className="btn-primary" onClick={() => handleOpenAddModal(activeTab === 'ALL' ? 'ALL' : activeTab)} style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}>
                <Plus size={16} /> Add Questions Now
              </button>
            </div>
          ) : (
            <div>
              {(() => {
                const partAQuestions = filteredQuestions.filter(q => q.section === 'A');
                const partBQuestions = filteredQuestions.filter(q => q.section === 'B');
                const partCQuestions = filteredQuestions.filter(q => q.section === 'C');

                const renderTable = (partList, sectionKey, title) => {
                  return (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', margin: '14px 0 6px 0' }}>
                        <div style={{ textAlign: 'center', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>
                          {title}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenAddModal(sectionKey)}
                          style={{ position: 'absolute', right: 0, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 4, border: '1px solid #16a34a', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', fontFamily: 'sans-serif' }}
                          title={`Add extra questions to ${title}`}
                        >
                          <Plus size={12} /> Add Question
                        </button>
                      </div>

                      {partList.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '12px', color: '#64748b', fontSize: '12px', border: '1px dashed #cbd5e1', borderRadius: 4, background: '#f8fafc', fontStyle: 'italic', marginBottom: 10 }}>
                          No questions added yet. Click "+ Add Question" on the right to add.
                        </div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#000', fontSize: '13px', marginBottom: '10px' }}>
                          <tbody>
                            {partList.map((q, idx) => (
                              <tr key={q.id || idx}>
                                <td style={{ border: '1px solid #000', padding: '5px 6px', width: '30px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>
                                  {idx + 1}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '5px 6px', verticalAlign: 'top', textAlign: 'justify', color: '#000', lineHeight: 1.45 }}>
                                  <div style={{ whiteSpace: 'pre-wrap' }}>{q.questionText}</div>
                                  {q.topic && <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '3px', fontStyle: 'italic' }}>Topic: {q.topic}</div>}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '5px 6px', width: '80px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>
                                  <div>{q.difficulty || 'Medium'}</div>
                                  <div>Unit {q.unit || '1'}</div>
                                </td>
                                <td style={{ border: '1px solid #000', padding: '5px 6px', width: '95px', verticalAlign: 'middle', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleEdit(q)}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '3px 7px', borderRadius: 3, border: '1px solid #94a3b8', background: '#f8fafc', color: '#0f172a', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', fontFamily: 'sans-serif' }}
                                      title="Edit question"
                                    >
                                      <Edit2 size={11} /> Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(q.id)}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '3px 7px', borderRadius: 3, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', fontFamily: 'sans-serif' }}
                                      title="Delete question"
                                    >
                                      <Trash2 size={11} /> Del
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                };

                return (
                  <>
                    {(activeTab === 'ALL' || activeTab === 'A') && renderTable(partAQuestions, 'A', 'PART – A (2 Marks)')}
                    {(activeTab === 'ALL' || activeTab === 'B') && renderTable(partBQuestions, 'B', 'PART – B (13 Marks)')}
                    {(activeTab === 'ALL' || activeTab === 'C') && renderTable(partCQuestions, 'C', `PART – C (${partCMarks} Marks)`)}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Hidden printable block */}
        <div style={{ display: 'none' }}>
          <div id="printable-bank" style={{ fontFamily: '"Times New Roman", Times, serif', width: '100%', maxWidth: '800px', margin: '0 auto', fontSize: '13px', border: '2px solid #000', padding: '15px', color: '#000', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, color: '#000' }}>
              <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/logo-left.png" alt="Left Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /></div>
              <div style={{ textAlign: 'center', flex: 1, padding: '0 15px' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#b91c1c' }}>RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING</div>
                <div style={{ fontSize: '14px', marginBottom: 8 }}>Salvarpatti, Sivakasi - 626 128</div>
                <div style={{ display: 'inline-block', border: '1px solid #1e3a8a', borderRadius: '15px', padding: '4px 18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: 4 }}>QUESTION BANK</div>
              </div>
              <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/logo-right.png" alt="Right Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /></div>
            </div>
            <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 15 }}>Course: {courseText}</div>

            {partA.length > 0 && (
              <div style={{ pageBreakInside: 'auto' }}>
                <div className="part-title" style={{ textAlign: 'center', fontWeight: 'bold', margin: '12px 0 6px 0', color: '#000', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>PART – A (2 Marks)</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', color: '#000', pageBreakInside: 'auto' }}>
                  <tbody>
                    {partA.map((q, idx) => (
                      <tr key={idx} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', width: '30px', verticalAlign: 'top', color: '#000' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{q.questionText}</td>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', width: '80px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{q.difficulty || 'Medium'}<br/>Unit {q.unit || '1'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {partB.length > 0 && (
              <div style={{ pageBreakInside: 'auto' }}>
                <div className="part-title" style={{ textAlign: 'center', fontWeight: 'bold', margin: '12px 0 6px 0', color: '#000', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>PART – B (13 Marks)</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', color: '#000', pageBreakInside: 'auto' }}>
                  <tbody>
                    {partB.map((q, idx) => (
                      <tr key={idx} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', width: '30px', verticalAlign: 'top', color: '#000' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{q.questionText}</td>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', width: '80px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{q.difficulty || 'Medium'}<br/>Unit {q.unit || '1'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {partC.length > 0 && (
              <div style={{ pageBreakInside: 'auto' }}>
                <div className="part-title" style={{ textAlign: 'center', fontWeight: 'bold', margin: '12px 0 6px 0', color: '#000', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>PART – C ({partCMarks} Marks)</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', color: '#000', pageBreakInside: 'auto' }}>
                  <tbody>
                    {partC.map((q, idx) => (
                      <tr key={idx} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', width: '30px', verticalAlign: 'top', color: '#000' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{q.questionText}</td>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', width: '80px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{q.difficulty || 'Medium'}<br/>Unit {q.unit || '1'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '90%', maxWidth: 800, maxHeight: '90vh', overflowY: 'auto' }}>
            
            {modalMode === 'edit' ? (
              // --- SINGLE EDIT MODE ---
              <>
                <h2 style={{ marginTop: 0, marginBottom: 20 }}>Edit Question</h2>
                <form onSubmit={handleEditSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 20 }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Course Code *</label>
                      <input type="text" name="courseCode" value={formData.courseCode} readOnly style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: '#f1f5f9', color: 'var(--text-muted)' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Course Name</label>
                      <input type="text" name="courseName" value={formData.courseName} readOnly style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: '#f1f5f9', color: 'var(--text-muted)' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Section *</label>
                      <select name="section" value={formData.section} onChange={handleSectionChange} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                        <option value="A">Part A (2 Marks)</option>
                        <option value="B">Part B (13 Marks)</option>
                        <option value="C">Part C ({partCMarks} Marks)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Unit</label>
                      <select name="unit" value={formData.unit || '1'} onChange={handleInputChange} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                        <option value="1">Unit 1</option>
                        <option value="2">Unit 2</option>
                        <option value="3">Unit 3</option>
                        <option value="4">Unit 4</option>
                        <option value="5">Unit 5</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Marks</label>
                      <input type="text" value={formData.marks} readOnly style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)', color: 'var(--text)' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Difficulty</label>
                      <select name="difficulty" value={formData.difficulty} onChange={handleInputChange} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Question Text *</label>
                      <textarea name="questionText" value={formData.questionText} onChange={handleInputChange} required rows={3} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', resize: 'vertical' }} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" className="btn-primary" disabled={saving}>
                      {saving ? 'Updating...' : 'Update Question'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              // --- BULK ADD MODE ---
              <>
                <h2 style={{ marginTop: 0, marginBottom: 5 }}>Add Questions to Bank</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 15 }}>Quickly add multiple questions at once to complete or expand your question bank.</p>
                
                {/* Course Pool Status Banner */}
                <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)', marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#1d4ed8', marginBottom: 4 }}>
                    Current Question Pool for {bulkData.courseCode || 'Selected Course'}:
                  </div>
                  <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap', fontSize: 12, color: 'var(--text)' }}>
                    <span>Part A: <strong>{poolStats.partA} Questions</strong></span>
                    <span>•</span>
                    <span>Part B: <strong>{poolStats.partB} Questions</strong></span>
                    <span>•</span>
                    <span>Part C: <strong>{poolStats.partC} Questions</strong></span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    💡 Any questions added below will be appended to the course pool. Empty question boxes are safely ignored.
                  </div>
                </div>

                <form onSubmit={handleBulkSubmit}>
                  {/* Global Settings */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 15, marginBottom: 25, padding: 15, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>Course Code *</label>
                      <select name="courseCode" value={bulkData.courseCode} onChange={handleBulkChange} required style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontSize: 13 }}>
                        <option value="">Select Course</option>
                        {allocations.map(a => (
                          <option key={a.id || a.courseCode} value={a.courseCode}>
                            {a.courseCode} - {a.courseName} (Sem {a.semester}{a.section && a.section !== 'None' ? `, Sec ${a.section}` : ''})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>Course Name</label>
                      <input type="text" name="courseName" value={bulkData.courseName} onChange={handleBulkChange} readOnly style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: '#f1f5f9', color: 'var(--text-muted)', fontSize: 13, cursor: 'not-allowed' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>Unit</label>
                      <select name="unit" value={bulkData.unit || '1'} onChange={handleBulkChange} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontSize: 13 }}>
                        <option value="1">Unit 1</option>
                        <option value="2">Unit 2</option>
                        <option value="3">Unit 3</option>
                        <option value="4">Unit 4</option>
                        <option value="5">Unit 5</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>Difficulty</label>
                      <select name="difficulty" value={bulkData.difficulty} onChange={handleBulkChange} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontSize: 13 }}>
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                  </div>

                  {/* PART A section */}
                  <div style={{ marginBottom: 30 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#16a34a' }}>PART A — 2 MARK QUESTIONS</h3>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Current in pool: {poolStats.partA} Questions</span>
                    </div>
                    {bulkData.partA.map((val, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                        <span style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', width: 24, textAlign: 'right' }}>Q{idx + 1}</span>
                        <textarea value={val} onChange={(e) => handleBulkArrayChange('partA', idx, e.target.value)} rows={2} placeholder="Enter 2-mark question..." style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', resize: 'vertical' }} />
                        {bulkData.partA.length > 1 && (
                          <button type="button" onClick={() => removeBulkField('partA', idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 8 }}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                      <button type="button" onClick={() => addBulkField('partA')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)', color: '#16a34a', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6 }}>
                        <Plus size={13} /> Add 1 Question
                      </button>
                      <button type="button" onClick={() => addMultipleBulkFields('partA', 3)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)', color: '#16a34a', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6 }}>
                        <Plus size={13} /> Add 3 Questions
                      </button>
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px dashed var(--border-color)', margin: '20px 0' }} />

                  {/* PART B section */}
                  <div style={{ marginBottom: 30 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#2563eb' }}>PART B — 13 MARK QUESTIONS</h3>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Current in pool: {poolStats.partB} Questions</span>
                    </div>
                    {bulkData.partB.map((val, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                        <span style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', width: 24, textAlign: 'right' }}>Q{idx + 1}</span>
                        <textarea value={val} onChange={(e) => handleBulkArrayChange('partB', idx, e.target.value)} rows={2} placeholder="Enter 13-mark question..." style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', resize: 'vertical' }} />
                        {bulkData.partB.length > 1 && (
                          <button type="button" onClick={() => removeBulkField('partB', idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 8 }}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                      <button type="button" onClick={() => addBulkField('partB')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.25)', color: '#2563eb', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6 }}>
                        <Plus size={13} /> Add 1 Question
                      </button>
                      <button type="button" onClick={() => addMultipleBulkFields('partB', 3)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.25)', color: '#2563eb', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6 }}>
                        <Plus size={13} /> Add 3 Questions
                      </button>
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px dashed var(--border-color)', margin: '20px 0' }} />

                  {/* PART C section */}
                  <div style={{ marginBottom: 30 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#9333ea' }}>PART C — {partCMarks} MARK QUESTIONS</h3>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Current in pool: {poolStats.partC} Questions</span>
                    </div>
                    {bulkData.partC.map((val, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                        <span style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', width: 24, textAlign: 'right' }}>Q{idx + 1}</span>
                        <textarea value={val} onChange={(e) => handleBulkArrayChange('partC', idx, e.target.value)} rows={2} placeholder={`Enter ${partCMarks}-mark question...`} style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', resize: 'vertical' }} />
                        {bulkData.partC.length > 1 && (
                          <button type="button" onClick={() => removeBulkField('partC', idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 8 }}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                      <button type="button" onClick={() => addBulkField('partC')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(147,51,234,0.1)', border: '1px solid rgba(147,51,234,0.25)', color: '#9333ea', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6 }}>
                        <Plus size={13} /> Add 1 Question
                      </button>
                      <button type="button" onClick={() => addMultipleBulkFields('partC', 2)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(147,51,234,0.1)', border: '1px solid rgba(147,51,234,0.25)', color: '#9333ea', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6 }}>
                        <Plus size={13} /> Add 2 Questions
                      </button>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 30, borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
                    <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" className="btn-primary" disabled={saving}>
                      {saving ? 'Saving...' : 'SAVE QUESTIONS TO BANK'}
                    </button>
                  </div>
                </form>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
