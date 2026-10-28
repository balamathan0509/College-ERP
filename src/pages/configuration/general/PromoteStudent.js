import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useAuth } from '../../../context/AuthContext';
import { db } from "../../../supabase/supabaseAdapter";
import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  addDoc, 
  serverTimestamp, 
  query, 
  where 
} from "../../../supabase/supabaseAdapter";
import toast, { Toaster } from 'react-hot-toast';
import { 
  ArrowRight, 
  CheckSquare, 
  Square, 
  Users, 
  GraduationCap, 
  History, 
  RotateCcw, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Filter,
  Sparkles,
  ChevronRight,
  Info
} from 'lucide-react';

const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "IT", "AIDS", "CIVIL", "CSBS"];

const SEMESTERS_MAP = {
  "1": { nextSem: "2", year: "1st Year", nextYear: "1st Year", label: "Semester 1", roman: "I" },
  "2": { nextSem: "3", year: "1st Year", nextYear: "2nd Year", label: "Semester 2", roman: "II" },
  "3": { nextSem: "4", year: "2nd Year", nextYear: "2nd Year", label: "Semester 3", roman: "III" },
  "4": { nextSem: "5", year: "2nd Year", nextYear: "3rd Year", label: "Semester 4", roman: "IV" },
  "5": { nextSem: "6", year: "3rd Year", nextYear: "3rd Year", label: "Semester 5", roman: "V" },
  "6": { nextSem: "7", year: "3rd Year", nextYear: "4th Year", label: "Semester 6", roman: "VI" },
  "7": { nextSem: "8", year: "4th Year", nextYear: "4th Year", label: "Semester 7", roman: "VII" },
  "8": { nextSem: "Passed Out", year: "4th Year", nextYear: "Passed Out", label: "Semester 8", roman: "VIII" }
};

const ROMAN_TO_NUM = {
  "I": "1", "II": "2", "III": "3", "IV": "4",
  "V": "5", "VI": "6", "VII": "7", "VIII": "8"
};

const normalizeDept = (val) => {
  if (!val) return '';
  const s = String(val).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.includes('CSE') || s.includes('COMPUTERSCIENCE')) return 'CSE';
  if (s.includes('AIDS') || s.includes('ARTIFICIALINTELLIGENCE') || (s.includes('AI') && s.includes('DS'))) return 'AIDS';
  if (s.includes('CSBS') || (s.includes('BUSINESS') && s.includes('SYSTEMS'))) return 'CSBS';
  if (s.includes('ECE') || (s.includes('ELECTRONICS') && s.includes('COMMUNICATION'))) return 'ECE';
  if (s.includes('EEE') || (s.includes('ELECTRICAL') && s.includes('ELECTRONICS'))) return 'EEE';
  if (s.includes('MECH') || s.includes('MECHANICAL')) return 'MECH';
  if (s.includes('CIVIL')) return 'CIVIL';
  if (s.includes('IT') || s.includes('INFORMATIONTECH')) return 'IT';
  return String(val).toUpperCase().trim();
};

const normalizeSemValue = (val) => {
  if (val === undefined || val === null) return "";
  const s = String(val).toUpperCase().trim();
  const digits = s.replace(/[^0-9]/g, "");
  if (digits) return digits;
  const romanOnly = s.replace(/SEMESTER|SEM|\s+|\./g, "");
  if (ROMAN_TO_NUM[romanOnly]) return ROMAN_TO_NUM[romanOnly];
  return s;
};

const normalizeSectionValue = (sec) => {
  if (!sec) return "";
  const s = String(sec).toUpperCase().trim();
  if (['.', 'NO', 'NONE', 'N/A', '-', 'SINGLE CLASS'].includes(s)) return "";
  return s;
};

export default function PromoteStudent() {
  const { userProfile, isSuperAdmin } = useAuth();
  
  // Navigation tab: 'promote' or 'history'
  const [activeTab, setActiveTab] = useState('promote');

  // Filter state (Current class)
  const [filterDept, setFilterDept] = useState('CSE');
  const [filterSem, setFilterSem] = useState('6'); // Default to 6th Sem as user requested
  const [filterSection, setFilterSection] = useState('ALL'); // 'ALL', 'SINGLE', 'A', 'B', 'C', 'D'

  // Target Promotion state
  const [targetSem, setTargetSem] = useState('7');
  const [targetYear, setTargetYear] = useState('4th Year');
  const [targetSectionOption, setTargetSectionOption] = useState('SAME'); // 'SAME', 'SINGLE', 'A', 'B', 'C', 'D'

  // Data states
  const [allStudents, setAllStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isPromoting, setIsPromoting] = useState(false);

  // History state
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  // Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Set initial department if HOD / coordinator
  useEffect(() => {
    if (userProfile?.dept && userProfile?.dept !== 'ALL') {
      setFilterDept(userProfile.dept);
    }
  }, [userProfile]);

  // When filterSem changes, automatically calculate target sem and year
  useEffect(() => {
    const config = SEMESTERS_MAP[filterSem];
    if (config) {
      setTargetSem(config.nextSem);
      setTargetYear(config.nextYear);
    }
  }, [filterSem]);

  // Fetch all students from users table once or on demand
  const loadAllStudents = async () => {
    try {
      setLoadingStudents(true);
      const q = query(collection(db, 'users'), where('role', '==', 'student'));
      const snap = await getDocs(q);
      const list = snap.docs.map(docObj => {
        const d = docObj.data();
        return {
          id: docObj.id,
          ...d,
          normalizedSem: normalizeSemValue(d.semester),
          normalizedSec: normalizeSectionValue(d.section),
          regNo: d.registerNo || d.registerNumber || '',
          name: d.studentName || d.name || 'Unnamed Student',
          dept: d.dept || d.programmeCode || 'General',
          batch: d.batch || ''
        };
      });
      setAllStudents(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load students data');
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    loadAllStudents();
  }, []);

  // Fetch promotion history
  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const q = query(collection(db, 'promotionHistory'));
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setHistoryList(items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  // Available sections dynamically derived strictly from students belonging to selected Department & Semester
  const availableSections = useMemo(() => {
    const classStudents = allStudents.filter(st => {
      if (st.status === 'Passed Out' || st.status === 'Discontinued') return false;
      if (filterDept !== 'ALL' && normalizeDept(st.dept) !== normalizeDept(filterDept)) return false;
      if (st.normalizedSem !== filterSem) return false;
      return true;
    });

    if (classStudents.length === 0) {
      return [{ value: 'ALL', label: 'All Sections' }];
    }

    const set = new Set();
    let hasSingle = false;

    classStudents.forEach(st => {
      const sec = st.normalizedSec;
      if (!sec) {
        hasSingle = true;
      } else {
        set.add(sec);
      }
    });

    const realSections = Array.from(set).sort();

    // If only single class exists (no sections like A, B, etc.)
    if (realSections.length === 0) {
      return [{ value: 'ALL', label: 'Single Class (No Section)' }];
    }

    const options = [
      { value: 'ALL', label: realSections.length > 1 ? `All Sections (${realSections.join(', ')})` : 'All Sections' }
    ];

    if (hasSingle) {
      options.push({ value: 'SINGLE', label: 'Single Class (No Section)' });
    }

    realSections.forEach(sec => {
      options.push({ value: sec, label: `Section ${sec}` });
    });

    return options;
  }, [allStudents, filterDept, filterSem]);

  // Reset filterSection if previous selection is not in the newly available sections
  useEffect(() => {
    const validValues = availableSections.map(opt => opt.value);
    if (!validValues.includes(filterSection)) {
      setFilterSection('ALL');
    }
  }, [availableSections, filterSection]);

  // Filter students based on current selection (Dept, Sem, Section)
  const eligibleStudents = useMemo(() => {
    return allStudents.filter(st => {
      // Must be Active
      if (st.status === 'Passed Out' || st.status === 'Discontinued') return false;

      // Match Department (fuzzy normalized comparison e.g. "B.E CSE" === "CSE")
      if (filterDept !== 'ALL') {
        if (normalizeDept(st.dept) !== normalizeDept(filterDept)) return false;
      }

      // Match Semester
      if (st.normalizedSem !== filterSem) return false;

      // Match Section
      if (filterSection === 'SINGLE') {
        if (st.normalizedSec !== '') return false;
      } else if (filterSection !== 'ALL') {
        if (st.normalizedSec !== filterSection) return false;
      }

      return true;
    });
  }, [allStudents, filterDept, filterSem, filterSection]);

  // Displayed students in table (filtered by search query)
  const displayedStudents = useMemo(() => {
    if (!searchQuery.trim()) return eligibleStudents;
    const q = searchQuery.toLowerCase().trim();
    return eligibleStudents.filter(st => {
      const matchReg = (st.regNo || '').toLowerCase().includes(q);
      const matchName = (st.name || '').toLowerCase().includes(q);
      return matchReg || matchName;
    });
  }, [eligibleStudents, searchQuery]);

  // When eligibleStudents changes, auto-select all
  useEffect(() => {
    const ids = new Set(eligibleStudents.map(s => s.id));
    setSelectedIds(ids);
  }, [eligibleStudents]);

  // Toggle single selection
  const toggleSelectOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Toggle Select All (operates on currently displayed / searched students)
  const toggleSelectAll = () => {
    const displayedIds = displayedStudents.map(s => s.id);
    const allDisplayedSelected = displayedIds.length > 0 && displayedIds.every(id => selectedIds.has(id));

    const next = new Set(selectedIds);
    if (allDisplayedSelected) {
      displayedIds.forEach(id => next.delete(id));
    } else {
      displayedIds.forEach(id => next.add(id));
    }
    setSelectedIds(next);
  };

  // Resolve target section for a given student
  const getResolvedTargetSection = (student) => {
    if (targetSectionOption === 'SAME') {
      return student.normalizedSec || '';
    }
    if (targetSectionOption === 'SINGLE') {
      return '';
    }
    return targetSectionOption;
  };

  // Execute Promotion (Chunked in parallel for high performance and reliability)
  const handleExecutePromote = async () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one student to promote.');
      return;
    }

    const isGraduating = filterSem === '8' || targetSem === 'Passed Out' || targetYear === 'Passed Out';
    const studentsToPromote = eligibleStudents.filter(s => selectedIds.has(s.id));

    try {
      setIsPromoting(true);
      setShowConfirmModal(false);

      let successCount = 0;
      const historyStudentRecords = [];

      // Process in parallel chunks of 10 for fast execution & network stability
      const CHUNK_SIZE = 10;
      for (let i = 0; i < studentsToPromote.length; i += CHUNK_SIZE) {
        const chunk = studentsToPromote.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (st) => {
          const resolvedSec = getResolvedTargetSection(st);
          const updateData = {
            updatedAt: serverTimestamp()
          };

          if (isGraduating) {
            updateData.status = 'Passed Out';
            updateData.passedOutAt = serverTimestamp();
          } else {
            updateData.semester = targetSem;
            updateData.year = targetYear;
            updateData.section = resolvedSec;
            updateData.status = 'Active';
          }

          // Update in users table
          await updateDoc(doc(db, 'users', st.id), updateData);

          // Also update students collection if exists
          try {
            await updateDoc(doc(db, 'students', st.id), updateData);
          } catch (e) {
            // Ignore if doc doesn't exist in students collection
          }

          historyStudentRecords.push({
            id: st.id,
            name: st.name,
            regNo: st.regNo,
            prevSemester: st.semester || st.normalizedSem,
            prevYear: st.year || SEMESTERS_MAP[filterSem]?.year || '',
            prevSection: st.normalizedSec || '',
            prevStatus: st.status || 'Active'
          });

          successCount++;
        }));
      }

      // Record to promotionHistory collection
      await addDoc(collection(db, 'promotionHistory'), {
        fromDept: filterDept,
        fromSemester: filterSem,
        fromYear: SEMESTERS_MAP[filterSem]?.year || '',
        fromSection: filterSection,
        toSemester: targetSem,
        toYear: targetYear,
        toSection: targetSectionOption,
        isGraduating,
        studentCount: successCount,
        studentRecords: historyStudentRecords,
        promotedBy: userProfile?.name || 'Admin',
        promotedByEmail: userProfile?.email || '',
        status: 'completed',
        createdAt: new Date().toISOString()
      });

      toast.success(
        isGraduating
          ? `🎉 Successfully graduated ${successCount} students as Passed Out!`
          : `🎉 Successfully promoted ${successCount} students to ${targetYear} (${targetSem === '7' ? 'Sem 7' : `Sem ${targetSem}`})!`
      );

      // Refresh student list
      await loadAllStudents();

    } catch (err) {
      console.error(err);
      toast.error('Error occurred while promoting students.');
    } finally {
      setIsPromoting(false);
    }
  };

  // Undo previous promotion
  const handleUndoPromotion = async (historyItem) => {
    const studentRecords = historyItem.studentRecords || [];
    if (studentRecords.length === 0) {
      toast.error('No student records found in this history log.');
      return;
    }

    const confirm = window.confirm(
      `Revert promotion for ${studentRecords.length} students back to ${historyItem.fromYear} (Sem ${historyItem.fromSemester})?`
    );
    if (!confirm) return;

    try {
      setIsReverting(true);
      let reverted = 0;

      const CHUNK_SIZE = 10;
      for (let i = 0; i < studentRecords.length; i += CHUNK_SIZE) {
        const chunk = studentRecords.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (rec) => {
          const revertData = {
            semester: rec.prevSemester || historyItem.fromSemester,
            year: rec.prevYear || historyItem.fromYear,
            section: rec.prevSection || '',
            status: rec.prevStatus || 'Active',
            passedOutAt: null, // Clear graduation date on revert
            updatedAt: serverTimestamp()
          };

          await updateDoc(doc(db, 'users', rec.id), revertData);
          try {
            await updateDoc(doc(db, 'students', rec.id), revertData);
          } catch (e) {}
          reverted++;
        }));
      }

      // Mark history record as reverted
      await updateDoc(doc(db, 'promotionHistory', historyItem.id), {
        status: 'reverted',
        revertedAt: new Date().toISOString(),
        revertedBy: userProfile?.name || 'Admin'
      });

      toast.success(`Successfully reverted ${reverted} students back to Sem ${historyItem.fromSemester}!`);
      await loadAllStudents();
      await loadHistory();
    } catch (err) {
      console.error(err);
      toast.error('Failed to revert promotion.');
    } finally {
      setIsReverting(false);
    }
  };

  const isFinalYearGraduation = filterSem === '8' || targetSem === 'Passed Out' || targetYear === 'Passed Out';

  return (
    <div className="dashboard-wrapper">
      <Toaster position="top-right" />
      <Sidebar />
      <main className="main-content">
        <div className="page-container" style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '15px' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                Promote Students
              </h2>
            </div>

            {/* Tab switch */}
            <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '8px', padding: '4px' }}>
              <button
                onClick={() => setActiveTab('promote')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  background: activeTab === 'promote' ? '#1e3a8a' : 'transparent',
                  color: activeTab === 'promote' ? '#ffffff' : '#475569',
                  transition: 'all 0.2s'
                }}
              >
                <Sparkles size={16} /> Promote Class
              </button>
              <button
                onClick={() => setActiveTab('history')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  background: activeTab === 'history' ? '#1e3a8a' : 'transparent',
                  color: activeTab === 'history' ? '#ffffff' : '#475569',
                  transition: 'all 0.2s'
                }}
              >
                <History size={16} /> Promotion History & Undo
              </button>
            </div>
          </div>

          {activeTab === 'promote' && (
            <>
              {/* Configuration Box: From Class ➔ Target Class */}
              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '24px', alignItems: 'center' }}>
                  
                  {/* Left: FROM CLASS */}
                  <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                        Step 1
                      </span>
                      <h4 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>
                        From Academic Session (Current)
                      </h4>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {/* Department */}
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '5px' }}>
                          Department *
                        </label>
                        <select
                          value={filterDept}
                          onChange={e => setFilterDept(e.target.value)}
                          disabled={userProfile?.role === 'hod' && userProfile?.dept && userProfile?.dept !== 'ALL'}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                        >
                          <option value="ALL">All Departments</option>
                          {DEPARTMENTS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>

                      {/* Current Semester */}
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '5px' }}>
                          Current Semester *
                        </label>
                        <select
                          value={filterSem}
                          onChange={e => setFilterSem(e.target.value)}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff', fontWeight: '600', color: '#1e3a8a' }}
                        >
                          <option value="1">1st Year - Semester 1 (I)</option>
                          <option value="2">1st Year - Semester 2 (II)</option>
                          <option value="3">2nd Year - Semester 3 (III)</option>
                          <option value="4">2nd Year - Semester 4 (IV)</option>
                          <option value="5">3rd Year - Semester 5 (V)</option>
                          <option value="6">3rd Year - Semester 6 (VI)</option>
                          <option value="7">4th Year - Semester 7 (VII)</option>
                          <option value="8">4th Year - Semester 8 (VIII - Final)</option>
                        </select>
                      </div>

                      {/* Section */}
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '5px' }}>
                          Section / Class *
                        </label>
                        <select
                          value={filterSection}
                          onChange={e => setFilterSection(e.target.value)}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                        >
                          {availableSections.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Middle: PROMOTION DIRECTION ARROW */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 10px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: '#1e3a8a',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 10px rgba(30, 58, 138, 0.25)'
                    }}>
                      <ArrowRight size={22} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#1e3a8a', marginTop: '8px', letterSpacing: '0.5px' }}>
                      PROMOTE
                    </span>
                  </div>

                  {/* Right: TARGET (AUTO-CALCULATED) */}
                  <div style={{
                    background: isFinalYearGraduation ? '#fffbeb' : '#f0fdf4',
                    padding: '20px',
                    borderRadius: '10px',
                    border: `1px solid ${isFinalYearGraduation ? '#fde68a' : '#bbf7d0'}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          background: isFinalYearGraduation ? '#fef3c7' : '#dcfce7',
                          color: isFinalYearGraduation ? '#b45309' : '#15803d',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          textTransform: 'uppercase'
                        }}>
                          Step 2
                        </span>
                        <h4 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>
                          {isFinalYearGraduation ? '🎓 Graduation / Alumni' : 'To Academic Session (Target)'}
                        </h4>
                      </div>
                      <span style={{ fontSize: '11px', background: '#fff', padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', color: '#475569', fontWeight: '600' }}>
                        Auto-calculated
                      </span>
                    </div>

                    {isFinalYearGraduation ? (
                      <div style={{ padding: '15px', background: '#ffffff', borderRadius: '8px', border: '1px solid #fef08a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#92400e', fontWeight: '700', fontSize: '14px' }}>
                          <GraduationCap size={20} /> Mark as Passed Out Students
                        </div>
                        <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#78350f' }}>
                          These 8th semester students have completed their degree. Promoting them will update their status to <strong>"Passed Out"</strong> and move them to Alumni records.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        {/* Target Year */}
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#166534', marginBottom: '5px' }}>
                            Target Year
                          </label>
                          <input
                            type="text"
                            value={targetYear}
                            onChange={e => setTargetYear(e.target.value)}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #86efac', fontSize: '13px', background: '#fff', fontWeight: '700', color: '#15803d' }}
                          />
                        </div>

                        {/* Target Semester */}
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#166534', marginBottom: '5px' }}>
                            Target Semester
                          </label>
                          <select
                            value={targetSem}
                            onChange={e => setTargetSem(e.target.value)}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #86efac', fontSize: '13px', background: '#fff', fontWeight: '700', color: '#15803d' }}
                          >
                            <option value="2">Semester 2 (II)</option>
                            <option value="3">Semester 3 (III)</option>
                            <option value="4">Semester 4 (IV)</option>
                            <option value="5">Semester 5 (V)</option>
                            <option value="6">Semester 6 (VI)</option>
                            <option value="7">Semester 7 (VII)</option>
                            <option value="8">Semester 8 (VIII)</option>
                            <option value="Passed Out">Passed Out (Graduate)</option>
                          </select>
                        </div>

                        {/* Target Section */}
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#166534', marginBottom: '5px' }}>
                            Target Section Option
                          </label>
                          <select
                            value={targetSectionOption}
                            onChange={e => setTargetSectionOption(e.target.value)}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #86efac', fontSize: '13px', background: '#fff' }}
                          >
                            <option value="SAME">Keep Same Section as Current (Recommended)</option>
                            <option value="SINGLE">Convert to Single Class (No Section)</option>
                            {availableSections
                              .filter(opt => opt.value !== 'ALL' && opt.value !== 'SINGLE')
                              .map(opt => (
                                <option key={opt.value} value={opt.value}>
                                  Move All to {opt.label}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Banner summary bar */}
                <div style={{
                  marginTop: '18px',
                  padding: '12px 18px',
                  background: '#f1f5f9',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                    <Info size={16} color="#0284c7" />
                    <span>
                      Promoting <strong>{filterDept}</strong>: {SEMESTERS_MAP[filterSem]?.year} (Sem {filterSem}) ➔{' '}
                      <strong style={{ color: isFinalYearGraduation ? '#b45309' : '#15803d' }}>
                        {isFinalYearGraduation ? 'Passed Out Batch' : `${targetYear} (Sem ${targetSem})`}
                      </strong>
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                      Eligible Students: <span style={{ color: '#2563eb' }}>{eligibleStudents.length}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Students Selection Table */}
              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
              }}>
                {/* Table Header Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={toggleSelectAll}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        background: '#f1f5f9',
                        color: '#1e293b',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}
                    >
                      {displayedStudents.length > 0 && displayedStudents.every(s => selectedIds.has(s.id)) ? (
                        <>
                          <CheckSquare size={16} color="#2563eb" /> Deselect All
                        </>
                      ) : (
                        <>
                          <Square size={16} color="#64748b" /> Select All ({displayedStudents.length})
                        </>
                      )}
                    </button>

                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                      Selected: <strong style={{ color: '#0f172a' }}>{selectedIds.size}</strong> of {eligibleStudents.length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Search box */}
                    <div style={{ position: 'relative' }}>
                      <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                      <input
                        type="text"
                        placeholder="Search student or reg no..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                          padding: '8px 12px 8px 32px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          width: '230px'
                        }}
                      />
                    </div>

                    {/* PROMOTE BUTTON */}
                    <button
                      onClick={() => setShowConfirmModal(true)}
                      disabled={selectedIds.size === 0 || isPromoting}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 22px',
                        background: selectedIds.size === 0 ? '#cbd5e1' : (isFinalYearGraduation ? '#d97706' : '#16a34a'),
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '700',
                        boxShadow: selectedIds.size === 0 ? 'none' : '0 4px 12px rgba(22, 163, 74, 0.3)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isFinalYearGraduation ? (
                        <>
                          <GraduationCap size={18} /> Mark {selectedIds.size} as Passed Out
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={18} /> Promote {selectedIds.size} Students to {targetYear} ({targetSem === '7' ? 'Sem 7' : `Sem ${targetSem}`})
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Table list */}
                {loadingStudents ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                    <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }}></div>
                    <p style={{ margin: 0, fontWeight: '500' }}>Loading students from database...</p>
                  </div>
                ) : displayedStudents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                    <AlertCircle size={36} color="#94a3b8" style={{ marginBottom: '10px' }} />
                    <h4 style={{ margin: '0 0 6px 0', color: '#1e293b' }}>
                      {searchQuery.trim() ? 'No Matching Students Found' : 'No Eligible Students Found'}
                    </h4>
                    <p style={{ margin: 0, fontSize: '13px' }}>
                      {searchQuery.trim()
                        ? `No students matching "${searchQuery}" in ${filterDept}, Semester ${filterSem}.`
                        : `There are no active students matching ${filterDept}, Semester ${filterSem}${filterSection !== 'ALL' ? `, Section ${filterSection}` : ''}.`}
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                          <th style={{ padding: '12px', width: '40px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={displayedStudents.length > 0 && displayedStudents.every(s => selectedIds.has(s.id))}
                              onChange={toggleSelectAll}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                          </th>
                          <th style={{ padding: '12px' }}>Sl.No</th>
                          <th style={{ padding: '12px' }}>Register Number</th>
                          <th style={{ padding: '12px' }}>Student Name</th>
                          <th style={{ padding: '12px' }}>Batch</th>
                          <th style={{ padding: '12px' }}>Dept</th>
                          <th style={{ padding: '12px' }}>Current Sem & Year</th>
                          <th style={{ padding: '12px' }}>Section</th>
                          <th style={{ padding: '12px' }}>Target Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedStudents.map((st, idx) => {
                          const isSelected = selectedIds.has(st.id);
                          const targetSec = getResolvedTargetSection(st);
                          return (
                            <tr
                              key={st.id}
                              onClick={() => toggleSelectOne(st.id)}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                cursor: 'pointer',
                                background: isSelected ? '#f0fdf4' : 'transparent',
                                transition: 'background 0.15s'
                              }}
                            >
                              <td style={{ padding: '12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectOne(st.id)}
                                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                              </td>
                              <td style={{ padding: '12px', color: '#64748b' }}>{idx + 1}</td>
                              <td style={{ padding: '12px', fontWeight: '700', color: '#1e293b' }}>{st.regNo || '—'}</td>
                              <td style={{ padding: '12px', fontWeight: '600', color: '#0f172a' }}>{st.name}</td>
                              <td style={{ padding: '12px', color: '#64748b' }}>{st.batch || '—'}</td>
                              <td style={{ padding: '12px' }}>
                                <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                                  {st.dept}
                                </span>
                              </td>
                              <td style={{ padding: '12px', color: '#334155' }}>
                                {st.year || SEMESTERS_MAP[filterSem]?.year} (Sem {st.normalizedSem || filterSem})
                              </td>
                              <td style={{ padding: '12px' }}>
                                <span style={{ background: '#f1f5f9', color: '#334155', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                                  {st.normalizedSec ? `Sec ${st.normalizedSec}` : 'Single Class'}
                                </span>
                              </td>
                              <td style={{ padding: '12px' }}>
                                {isFinalYearGraduation ? (
                                  <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                                    🎓 Passed Out
                                  </span>
                                ) : (
                                  <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                                    {targetYear} (Sem {targetSem}) {targetSec ? `• Sec ${targetSec}` : '• Single'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '24px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#0f172a' }}>Past Promotions Log</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    View past batch promotions and revert/undo any promotion if done by mistake.
                  </p>
                </div>
                <button
                  onClick={loadHistory}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#334155',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Refresh History
                </button>
              </div>

              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  Loading history...
                </div>
              ) : historyList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
                  No promotion history records found yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ padding: '12px' }}>Date & Time</th>
                        <th style={{ padding: '12px' }}>Department</th>
                        <th style={{ padding: '12px' }}>From</th>
                        <th style={{ padding: '12px' }}>To</th>
                        <th style={{ padding: '12px' }}>Students Count</th>
                        <th style={{ padding: '12px' }}>Promoted By</th>
                        <th style={{ padding: '12px' }}>Status</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyList.map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px', color: '#334155' }}>
                            {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                          </td>
                          <td style={{ padding: '12px', fontWeight: '700', color: '#1e3a8a' }}>
                            {item.fromDept}
                          </td>
                          <td style={{ padding: '12px' }}>
                            Sem {item.fromSemester} ({item.fromYear})
                          </td>
                          <td style={{ padding: '12px', fontWeight: '600', color: '#15803d' }}>
                            {item.isGraduating ? '🎓 Passed Out' : `Sem ${item.toSemester} (${item.toYear})`}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>
                              {item.studentCount} Students
                            </span>
                          </td>
                          <td style={{ padding: '12px', color: '#64748b' }}>
                            {item.promotedBy || 'Admin'}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {item.status === 'reverted' ? (
                              <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                                Reverted
                              </span>
                            ) : (
                              <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                                Active
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            {item.status !== 'reverted' && (
                              <button
                                onClick={() => handleUndoPromotion(item)}
                                disabled={isReverting}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '6px 12px',
                                  background: '#fee2e2',
                                  color: '#dc2626',
                                  border: '1px solid #fecaca',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer'
                                }}
                              >
                                <RotateCcw size={14} /> Undo Promotion
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Confirmation Modal */}
          {showConfirmModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px'
            }}>
              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '480px',
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: isFinalYearGraduation ? '#fef3c7' : '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isFinalYearGraduation ? '#b45309' : '#16a34a'
                  }}>
                    {isFinalYearGraduation ? <GraduationCap size={22} /> : <Sparkles size={22} />}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a' }}>
                      {isFinalYearGraduation ? 'Confirm Student Graduation' : 'Confirm Student Promotion'}
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                      Please review the details before proceeding.
                    </p>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#64748b' }}>Department:</span>
                    <strong style={{ color: '#0f172a' }}>{filterDept}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#64748b' }}>From Class:</span>
                    <strong>{SEMESTERS_MAP[filterSem]?.year} (Sem {filterSem})</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#64748b' }}>Promoting To:</span>
                    <strong style={{ color: isFinalYearGraduation ? '#b45309' : '#16a34a' }}>
                      {isFinalYearGraduation ? 'Passed Out (Alumni)' : `${targetYear} (Sem ${targetSem})`}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Total Selected Students:</span>
                    <strong style={{ color: '#2563eb', fontSize: '14px' }}>{selectedIds.size} Students</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    disabled={isPromoting}
                    style={{
                      padding: '9px 16px',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      color: '#475569',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecutePromote}
                    disabled={isPromoting}
                    style={{
                      padding: '9px 20px',
                      background: isFinalYearGraduation ? '#d97706' : '#16a34a',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '700'
                    }}
                  >
                    {isPromoting ? 'Promoting...' : `Yes, Promote ${selectedIds.size} Students`}
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