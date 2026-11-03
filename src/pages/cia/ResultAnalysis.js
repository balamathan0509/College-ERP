import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, getDocs, where } from "../../supabase/supabaseAdapter";
import { Search, PieChart, BarChart2, Users, CheckCircle, XCircle, ShieldCheck, BookOpen, ArrowRight, Award, Layers } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { matchesAcademicSession } from '../../utils/collegeConfig';

export default function ResultAnalysis() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Detect HOD / CSE Department
  const isHod = userProfile?.role === "hod" || 
    (userProfile?.designation || "").toLowerCase().includes("hod") || 
    (userProfile?.name || "").toLowerCase().includes("nathiya");
  const userDept = userProfile?.dept || (isHod ? "CSE" : "");
  
  // Filters
  const [filterSession, setFilterSession] = useState('2025-2026');
  const [filterProgramme, setFilterProgramme] = useState(userDept === "CSE" || isHod ? "B.E CSE" : "B.E CSE");
  const [filterSemester, setFilterSemester] = useState('7');
  const [filterCourse, setFilterCourse] = useState('ALL'); // 'ALL' for whole department, or specific courseCode
  const [filterType, setFilterType] = useState('CIA'); // CIA, OTHER, ESE
  const [filterComponent, setFilterComponent] = useState('All');
  
  const OTHER_COMPONENTS = ["All", "Assignment", "Quiz", "Seminar", "Tutorial", "Practical", "Internal Test"];
  
  const [results, setResults] = useState(null);
  const [courses, setCourses] = useState([]);
  const [sessionMap, setSessionMap] = useState({});
  const [allocations, setAllocations] = useState([]);
  const [examSchedules, setExamSchedules] = useState([]);
  const [viewMode, setViewMode] = useState('overview'); // 'overview' (whole dept) or 'detail' (single course)
  
  const SESSIONS = ["2025-2026", "2026-2027"];
  const PROGRAMMES = ["B.E CSE", "B.E ECE", "B.E EEE", "B.E MECH", "B.Tech IT"];
  const SEMESTERS = [
    { value: "ALL", label: "All Semesters (Entire Dept)" },
    { value: "1", label: "Semester 1" },
    { value: "2", label: "Semester 2" },
    { value: "3", label: "Semester 3" },
    { value: "4", label: "Semester 4" },
    { value: "5", label: "Semester 5" },
    { value: "6", label: "Semester 6" },
    { value: "7", label: "Semester 7" },
    { value: "8", label: "Semester 8" }
  ];

  // Pre-fill department for HOD on mount or profile load
  useEffect(() => {
    if (userDept === "CSE" || isHod) {
      setFilterProgramme("B.E CSE");
    }
  }, [userDept, isHod]);

  useEffect(() => {
    async function loadData() {
      try {
        const [cSnap, sessSnap, allocSnap, schedSnap] = await Promise.all([
          getDocs(collection(db, "courses")),
          getDocs(collection(db, "academic_sessions")).catch(() => ({ docs: [] })),
          getDocs(collection(db, "course_allocations")).catch(() => ({ docs: [] })),
          getDocs(collection(db, "cia_exam_schedules")).catch(() => ({ docs: [] }))
        ]);

        const sMap = {};
        sessSnap.docs.forEach(d => {
          const data = d.data();
          if (data && data.name) sMap[d.id] = data.name;
        });
        setSessionMap(sMap);

        setCourses(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAllocations(allocSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setExamSchedules(schedSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.warn("Failed to load data in ResultAnalysis:", e);
      }
    }
    loadData();
  }, []);

  const courseMap = useMemo(() => {
    const map = {};
    courses.forEach(c => {
      if (c.courseCode) {
        map[c.courseCode.trim().toUpperCase()] = c.courseName || c.title || c.courseCode;
      }
    });
    return map;
  }, [courses]);

  const selectableCourses = useMemo(() => {
    if (!filterSemester) return [];
    const targetSem = String(filterSemester).trim();
    const deptKey = (filterProgramme || '').replace('B.E ', '').replace('B.Tech ', '').trim().toUpperCase();

    const sessionCourseCodes = new Set();
    allocations.forEach(a => {
      const aSession = a.academicSession || sessionMap[a.sessionId] || '';
      if (!filterSession || matchesAcademicSession(aSession, filterSession, sessionMap)) {
        if (targetSem === 'ALL' || String(a.semester || '').trim() === targetSem) {
          if (!deptKey || (a.department || a.programme || '').toUpperCase().includes(deptKey)) {
            if (a.courseCode) sessionCourseCodes.add(a.courseCode.trim().toUpperCase());
          }
        }
      }
    });

    examSchedules.forEach(s => {
      if (!filterSession || matchesAcademicSession(s.academicSession, filterSession, sessionMap)) {
        if (targetSem === 'ALL' || String(s.semester || '').trim() === targetSem) {
          if (!deptKey || (s.programmeName || '').toUpperCase().includes(deptKey)) {
            if (s.courseCode) sessionCourseCodes.add(s.courseCode.trim().toUpperCase());
          }
        }
      }
    });

    // Fallback directly to courses collection if allocations or schedules are empty
    courses.forEach(c => {
      const cDept = (c.department || c.programme || '').toUpperCase();
      const cSem = String(c.semester || '').trim();
      if (!deptKey || cDept.includes(deptKey) || (deptKey === 'CSE' && (cDept.includes('COMPUTER') || cDept.includes('CSE')))) {
        if (targetSem === 'ALL' || cSem === targetSem) {
          if (c.courseCode) sessionCourseCodes.add(c.courseCode.trim().toUpperCase());
        }
      }
    });

    return courses.filter(c => sessionCourseCodes.has((c.courseCode || '').trim().toUpperCase()));
  }, [filterSession, filterSemester, filterProgramme, courses, allocations, examSchedules, sessionMap]);

  const handleSearch = async (forcedCourse = null) => {
    const targetCourse = forcedCourse !== null ? forcedCourse : filterCourse;
    if (!filterSession || !filterProgramme || !filterSemester) {
      toast.error("Please select Academic Session, Programme, and Semester");
      return;
    }
    
    setLoading(true);
    try {
      const deptKey = (filterProgramme || '').replace('B.E ', '').replace('B.Tech ', '').trim().toUpperCase();
      const targetSem = String(filterSemester).trim();
      const isSingleCourse = targetCourse && targetCourse !== 'ALL';

      let marksQ;
      if (isSingleCourse) {
        marksQ = query(
          collection(db, "cia_marks"), 
          where("entryType", "==", filterType),
          where("courseId", "==", targetCourse)
        );
      } else {
        marksQ = query(
          collection(db, "cia_marks"), 
          where("entryType", "==", filterType)
        );
      }
      
      const snap = await getDocs(marksQ);
      
      if (snap.empty) {
        toast.error(`No result data found for ${filterType} in ${filterProgramme}.`);
        setResults(null);
        setLoading(false);
        return;
      }
      
      const studentsData = [];
      const courseGroups = {};
      let totalPassed = 0;
      let totalFailed = 0;
      let totalAbsent = 0;
      const studentAggregates = {};
      
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        
        // Filter by Component if specified for OTHER
        if (filterType === 'OTHER' && filterComponent !== 'All' && data.componentType && data.componentType !== filterComponent) {
          return;
        }

        // Filter by Academic Session if present
        if (filterSession && data.academicSession && data.academicSession !== filterSession) {
          return;
        }

        // Filter by Semester if specified and not 'ALL'
        if (targetSem !== 'ALL' && data.semester && String(data.semester).trim() !== targetSem) {
          return;
        }

        // Filter by Programme / Dept for whole department view
        if (!isSingleCourse && deptKey) {
          const progName = (data.programmeName || '').toUpperCase();
          const cId = (data.courseId || '').toUpperCase();
          const courseObj = courses.find(c => (c.courseCode || '').toUpperCase() === cId);
          const cDept = (courseObj?.department || courseObj?.programme || '').toUpperCase();
          
          const matchProg = progName.includes(deptKey) || 
            (deptKey === 'CSE' && (progName.includes('COMPUTER') || progName.includes('CSE')));
          const matchCourse = cDept.includes(deptKey) || 
            (deptKey === 'CSE' && (cDept.includes('COMPUTER') || cDept.includes('CSE')));

          if (!matchProg && !matchCourse && progName !== '') {
            return;
          }
        }
        
        const isAbsent = Boolean(data.isAbsent || data.result === 'Absent');
        const mark = Number(data.marks) || 0;
        const cCode = (data.courseId || 'UNKNOWN').trim().toUpperCase();
        const cName = courseMap[cCode] || data.courseName || cCode;
        
        let passed = false;
        if (isAbsent) {
          totalAbsent++;
        } else {
          if (filterType === 'OTHER') {
            passed = mark >= 5;
          } else if (data.grade) {
            passed = !['RA', 'AB', 'SA', 'W', 'FAIL'].includes(String(data.grade).toUpperCase());
          } else if (data.result) {
            passed = String(data.result).toLowerCase() === 'pass';
          } else {
            const maxM = Number(data.maxMarks) || 50;
            const passCriteria = data.passMarks !== undefined ? Number(data.passMarks) : (maxM === 100 || filterType === 'Model' ? 75 : 35);
            if (mark >= passCriteria) passed = true;
          }
          
          if (passed) totalPassed++;
          else totalFailed++;
        }

        const studentItem = {
          id: data.studentId || docSnap.id,
          registerNo: data.registerNo || '-',
          name: data.studentName || 'Student',
          courseCode: cCode,
          courseName: cName,
          semester: data.semester || targetSem,
          marks: mark,
          isAbsent,
          passed,
          component: data.componentType || 'CIA',
          grade: data.grade || (isAbsent ? 'AB' : passed ? 'PASS' : 'FAIL')
        };
        
        studentsData.push(studentItem);

        // Group by course for Department Summary
        if (!courseGroups[cCode]) {
          courseGroups[cCode] = {
            courseCode: cCode,
            courseName: cName,
            semester: data.semester || targetSem,
            totalStudents: 0,
            passed: 0,
            failed: 0,
            absent: 0,
            totalMarks: 0,
            highestMark: 0,
            topStudent: '-'
          };
        }
        const cg = courseGroups[cCode];
        cg.totalStudents++;
        if (isAbsent) {
          cg.absent++;
        } else {
          cg.totalMarks += mark;
          if (passed) cg.passed++;
          else cg.failed++;
          if (mark >= cg.highestMark) {
            cg.highestMark = mark;
            cg.topStudent = `${studentItem.name} (${mark})`;
          }
        }

        // Student Aggregate for Overall Department Rank
        const sKey = studentItem.registerNo || studentItem.id;
        if (!studentAggregates[sKey]) {
          studentAggregates[sKey] = {
            id: studentItem.id,
            registerNo: studentItem.registerNo,
            name: studentItem.name,
            totalMarks: 0,
            subjectCount: 0,
            passedAll: true
          };
        }
        if (!isAbsent) {
          studentAggregates[sKey].totalMarks += mark;
          studentAggregates[sKey].subjectCount++;
          if (!passed) studentAggregates[sKey].passedAll = false;
        } else {
          studentAggregates[sKey].passedAll = false;
        }
      });
      
      const totalEvaluations = studentsData.length;
      if (totalEvaluations === 0) {
        toast.error(`No marks records found for ${filterProgramme} matching your criteria.`);
        setResults(null);
        setLoading(false);
        return;
      }

      const passPercentage = totalEvaluations > 0 ? ((totalPassed / totalEvaluations) * 100).toFixed(2) : 0;
      
      // Calculate Course Breakdown List
      const courseBreakdownList = Object.values(courseGroups).map(cg => {
        const appeared = cg.totalStudents - cg.absent;
        const pPct = cg.totalStudents > 0 ? ((cg.passed / cg.totalStudents) * 100).toFixed(1) : 0;
        const avgM = appeared > 0 ? (cg.totalMarks / appeared).toFixed(1) : 0;
        return {
          ...cg,
          passPercentage: Number(pPct),
          avgMarks: Number(avgM)
        };
      });
      courseBreakdownList.sort((a, b) => b.passPercentage - a.passPercentage);

      // Top Department Rankers
      const topStudents = Object.values(studentAggregates)
        .filter(s => s.subjectCount > 0)
        .map(s => ({
          ...s,
          avg: (s.totalMarks / s.subjectCount).toFixed(1)
        }))
        .sort((a, b) => b.totalMarks - a.totalMarks)
        .slice(0, 5);

      // Sort individual student data by marks descending
      studentsData.sort((a, b) => b.marks - a.marks);

      setResults({
        totalEvaluations,
        totalPassed,
        totalFailed,
        totalAbsent,
        passPercentage,
        studentsData,
        courseBreakdownList,
        topStudents,
        isWholeDept: !isSingleCourse,
        selectedCourseCode: isSingleCourse ? targetCourse : null,
        selectedCourseName: isSingleCourse ? (courseMap[targetCourse] || targetCourse) : null
      });

      setViewMode(!isSingleCourse ? 'overview' : 'detail');
      toast.success(isSingleCourse ? `Analysis loaded for ${targetCourse}` : `Full ${filterProgramme} Analysis Generated!`);
      
    } catch (err) {
      console.error("Result Analysis error:", err);
      toast.error("Failed to analyze results.");
    }
    setLoading(false);
  };

  const handleSelectCourseDrilldown = (courseCode) => {
    setFilterCourse(courseCode);
    handleSearch(courseCode);
  };

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />
        
        <div className='page-header' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BarChart2 size={28} color="#6366f1" /> Result Analysis
            </h1>
            <p className="subtitle" style={{ margin: 0 }}>
              Academic & Examination Performance Analytics — Department & Course Level Insights
            </p>
          </div>

          {/* HOD Status Pill */}
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 8, 
            padding: '8px 16px', 
            borderRadius: 30, 
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(79, 70, 229, 0.2))', 
            border: '1px solid rgba(99, 102, 241, 0.3)',
            color: 'var(--primary)'
          }}>
            <ShieldCheck size={18} color="#4f46e5" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a8a' }}>
                {userProfile?.name ? `${userProfile.name} (HOD)` : 'HOD Portal'}
              </div>
              <div style={{ fontSize: 11, color: '#4b5563' }}>
                Department of Computer Science & Engineering (CSE)
              </div>
            </div>
          </div>
        </div>

        {/* Filters Card */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 15, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Exam Type *</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                <option value="CIA">CIA / Internal Examination</option>
                <option value="ESE">End Semester Examination (ESE)</option>
                <option value="OTHER">Other Components (Quiz, Assignment)</option>
              </select>
            </div>

            {filterType === 'OTHER' && (
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Component *</label>
                <select value={filterComponent} onChange={(e) => setFilterComponent(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                  {OTHER_COMPONENTS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Academic Session *</label>
              <select value={filterSession} onChange={(e) => setFilterSession(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                <option value="">Select Session</option>
                {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Programme *</label>
              <select value={filterProgramme} onChange={(e) => setFilterProgramme(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                {PROGRAMMES.map(p => (
                  <option key={p} value={p}>{p} {p === "B.E CSE" ? "(HOD Dept)" : ""}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Semester *</label>
              <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                {SEMESTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Scope / Course</label>
              <select 
                value={filterCourse} 
                onChange={(e) => setFilterCourse(e.target.value)} 
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontWeight: filterCourse === 'ALL' ? 'bold' : 'normal' }}
              >
                <option value="ALL">⭐ All Courses (Whole {filterProgramme || 'CSE'} Overview)</option>
                {selectableCourses.map(c => (
                  <option key={c.id || c.courseCode} value={c.courseCode}>
                    {c.courseCode} - {c.courseName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {filterCourse === 'ALL' ? (
                <span>Showing <strong>Entire Department View</strong> (all subjects in {filterProgramme})</span>
              ) : (
                <span>Showing single course view for <strong>{filterCourse}</strong></span>
              )}
            </div>
            
            <button 
              onClick={() => handleSearch()} 
              className="btn-primary" 
              disabled={loading} 
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', fontSize: 14 }}
            >
              <BarChart2 size={18} /> {loading ? 'Analyzing Performance...' : 'Generate Result Analysis'}
            </button>
          </div>
        </div>

        {/* Results Section */}
        {results && (
          <>
            {/* View Mode Switcher if Whole Dept */}
            {results.isWholeDept && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <button
                  onClick={() => setViewMode('overview')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13,
                    background: viewMode === 'overview' ? '#1e3a8a' : 'var(--card-hover)',
                    color: viewMode === 'overview' ? '#fff' : 'var(--text)'
                  }}
                >
                  <Layers size={14} style={{ display: 'inline', marginRight: 6 }} /> Whole Department Summary
                </button>
                <button
                  onClick={() => setViewMode('detail')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13,
                    background: viewMode === 'detail' ? '#1e3a8a' : 'var(--card-hover)',
                    color: viewMode === 'detail' ? '#fff' : 'var(--text)'
                  }}
                >
                  <Users size={14} style={{ display: 'inline', marginRight: 6 }} /> All Student Mark Sheets ({results.studentsData.length})
                </button>
              </div>
            )}

            {/* Key KPI Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 15, padding: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={24} color="#6366f1" />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {results.isWholeDept ? 'Total Evaluations' : 'Total Students'}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{results.totalEvaluations}</div>
                </div>
              </div>
              
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 15, padding: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={24} color="#10b981" />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Total Passed</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{results.totalPassed}</div>
                </div>
              </div>

              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 15, padding: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <XCircle size={24} color="#ef4444" />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Failed / Absent</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>
                    <span style={{ color: '#ef4444' }}>{results.totalFailed}</span> / <span style={{ color: '#6b7280' }}>{results.totalAbsent}</span>
                  </div>
                </div>
              </div>

              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 15, padding: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PieChart size={24} color="#f59e0b" />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Department Pass %</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: Number(results.passPercentage) >= 50 ? '#10b981' : '#ef4444' }}>
                    {results.passPercentage}%
                  </div>
                </div>
              </div>
            </div>

            {/* Whole Department Subject Performance Table */}
            {results.isWholeDept && viewMode === 'overview' && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, color: 'var(--text)' }}>
                      Department Subject-Wise Performance ({filterProgramme})
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                      Click on any course row to view individual student marks and breakdown
                    </p>
                  </div>
                  <span className="badge badge-primary">
                    {results.courseBreakdownList.length} Subjects Evaluated
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', background: 'var(--card-hover)' }}>
                        <th style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>COURSE CODE</th>
                        <th style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>COURSE NAME</th>
                        <th style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>SEM</th>
                        <th style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>APPEARED</th>
                        <th style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>PASSED</th>
                        <th style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>FAILED</th>
                        <th style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>PASS RATE</th>
                        <th style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>AVG MARK</th>
                        <th style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>TOP SCORER</th>
                        <th style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.courseBreakdownList.map((cg) => (
                        <tr 
                          key={cg.courseCode} 
                          style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                          onClick={() => handleSelectCourseDrilldown(cg.courseCode)}
                        >
                          <td style={{ padding: '12px 14px', fontWeight: 700, color: '#4f46e5' }}>{cg.courseCode}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 600 }}>{cg.courseName}</td>
                          <td style={{ padding: '12px 14px' }}>Sem {cg.semester}</td>
                          <td style={{ padding: '12px 14px' }}>{cg.totalStudents}</td>
                          <td style={{ padding: '12px 14px', color: '#10b981', fontWeight: 600 }}>{cg.passed}</td>
                          <td style={{ padding: '12px 14px', color: '#ef4444', fontWeight: 600 }}>{cg.failed}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ 
                                padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700,
                                background: cg.passPercentage >= 60 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                color: cg.passPercentage >= 60 ? '#10b981' : '#ef4444'
                              }}>
                                {cg.passPercentage}%
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 600 }}>{cg.avgMarks}</td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{cg.topStudent}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <button 
                              className="btn-primary" 
                              style={{ padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectCourseDrilldown(cg.courseCode);
                              }}
                            >
                              Details <ArrowRight size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Department Top Scorers & Single Course Drilldown View */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
              <div className="card">
                <h3 style={{ marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={20} color="#f59e0b" /> 
                  {results.isWholeDept ? 'Department Top Performers' : 'Course Top Performers'}
                </h3>
                {results.topStudents?.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No data available.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {(results.isWholeDept ? results.topStudents : results.studentsData.filter(s => !s.isAbsent).slice(0, 5)).map((student, idx) => (
                      <li 
                        key={student.id || idx} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '12px 0', 
                          borderBottom: '1px solid var(--border-color)' 
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ 
                            width: 28, 
                            height: 28, 
                            borderRadius: '50%', 
                            background: idx === 0 ? '#fef3c7' : '#f3f4f6', 
                            color: idx === 0 ? '#b45309' : '#374151',
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 12
                          }}>
                            {idx + 1}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{student.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{student.registerNo}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: '#4f46e5', fontSize: 15 }}>
                            {results.isWholeDept ? `${student.totalMarks} Marks` : `${student.marks} Marks`}
                          </div>
                          {results.isWholeDept && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Avg: {student.avg} / subject</div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Scope Information Card */}
              <div className="card">
                <h3 style={{ marginTop: 0, marginBottom: 16 }}>Evaluation Details</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Department</span>
                    <strong style={{ color: 'var(--primary)' }}>{filterProgramme}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Session</span>
                    <strong>{filterSession}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Evaluation Scope</span>
                    <strong>{results.isWholeDept ? 'All Department Courses' : results.selectedCourseCode}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Exam Type</span>
                    <strong>{filterType}</strong>
                  </div>
                  {!results.isWholeDept && (
                    <button 
                      onClick={() => {
                        setFilterCourse('ALL');
                        handleSearch('ALL');
                      }}
                      className="btn-primary" 
                      style={{ marginTop: 10, background: '#4b5563' }}
                    >
                      ← Back to Whole Department Overview
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Full Student List Table */}
            {(!results.isWholeDept || viewMode === 'detail') && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>
                      {results.isWholeDept ? `Full Department Mark Sheet (${results.studentsData.length})` : `Course Mark Sheet: ${results.selectedCourseCode}`}
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                      Detailed individual scores, grades, and pass/fail distribution
                    </p>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', background: 'var(--card-hover)' }}>
                        <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12 }}>RANK</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12 }}>REGISTER NO</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12 }}>STUDENT NAME</th>
                        {results.isWholeDept && (
                          <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12 }}>COURSE</th>
                        )}
                        <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12 }}>MARKS</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12 }}>GRADE / STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.studentsData.map((student, idx) => (
                        <tr key={student.id + idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>{student.registerNo}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 600 }}>{student.name}</td>
                          {results.isWholeDept && (
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#4f46e5' }}>{student.courseCode}</span>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{student.courseName}</div>
                            </td>
                          )}
                          <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                            {student.isAbsent ? (
                              <span style={{ color: '#ef4444' }}>AB</span>
                            ) : (
                              student.marks
                            )}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ 
                              padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 700,
                              background: student.passed ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', 
                              color: student.passed ? '#10b981' : '#ef4444' 
                            }}>
                              {student.grade}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
