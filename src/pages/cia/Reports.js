import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { db } from '../../firebase/config';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { Search, Download, FileSpreadsheet, Calendar, Users, AlertTriangle, BookOpen } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function Reports() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(1);
  
  // Filters for Report 1 & 3 & 4
  const [filterSession, setFilterSession] = useState('');
  const [filterProgramme, setFilterProgramme] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterClass, setFilterClass] = useState('');
  
  // Data States
  const [report1Data, setReport1Data] = useState(null);
  const [report2Data, setReport2Data] = useState(null);
  const [report3Data, setReport3Data] = useState(null);
  const [report4Data, setReport4Data] = useState(null);

  const SESSIONS = ["2025-2026", "2026-2027"];
  const PROGRAMMES = ["B.E CSE", "B.E ECE", "B.E EEE", "B.E MECH", "B.Tech IT"];
  const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];

  // Helper to fetch students for a class
  const getStudentsForClass = async (programme, semester) => {
    const dept = programme.includes("CSE") ? "CSE" :
                 programme.includes("ECE") ? "ECE" :
                 programme.includes("IT") ? "IT" :
                 programme.includes("EEE") ? "EEE" :
                 programme.includes("MECH") ? "MECH" : "";
                 
    const yearStr = semester === "1" || semester === "2" ? "1st Year" :
                    semester === "3" || semester === "4" ? "2nd Year" :
                    semester === "5" || semester === "6" ? "3rd Year" : "4th Year";

    if (dept) {
      const studentQ = query(collection(db, "users"), where("role", "==", "student"), where("dept", "==", dept), where("year", "==", yearStr));
      const sSnap = await getDocs(studentQ);
      return sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      const studentQ = query(collection(db, "users"), where("role", "==", "student"));
      const sSnap = await getDocs(studentQ);
      return sSnap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, 15);
    }
  };

  // --- REPORT 1: Course Wise Consolidated Internal Marks ---
  const handleGenerateR1 = async () => {
    if (!filterSession || !filterProgramme || !filterSemester || !filterCourse) {
      toast.error("Please select Session, Programme, Semester, and Course");
      return;
    }
    setLoading(true);
    try {
      const studentsList = await getStudentsForClass(filterProgramme, filterSemester);
      
      const marksQ = query(collection(db, "cia_marks"), where("courseId", "==", filterCourse));
      const marksSnap = await getDocs(marksQ);
      
      const marksByStudent = {};
      marksSnap.docs.forEach(d => {
        const data = d.data();
        if (!marksByStudent[data.studentId]) {
          marksByStudent[data.studentId] = { CIA: '-', OTHER: '-', ESE: '-', GRADE: '-' };
        }
        if (data.entryType === 'CIA') marksByStudent[data.studentId].CIA = data.isAbsent ? 'AB' : data.marks;
        else if (data.entryType === 'OTHER') marksByStudent[data.studentId].OTHER = data.marks;
        else if (data.entryType === 'ESE') {
          marksByStudent[data.studentId].ESE = data.isAbsent ? 'AB' : data.marks;
          marksByStudent[data.studentId].GRADE = data.grade || '-';
        }
      });
      
      const records = studentsList.map(s => {
        const sm = marksByStudent[s.id] || { CIA: '-', OTHER: '-', ESE: '-', GRADE: '-' };
        // simple total if numbers
        const ciaVal = Number(sm.CIA) || 0;
        const othVal = Number(sm.OTHER) || 0;
        const totalInt = (sm.CIA !== '-' || sm.OTHER !== '-') ? (ciaVal + othVal) : '-';

        return {
          id: s.id,
          registerNo: s.registerNo || s.id,
          name: s.name || 'Unknown',
          ciaMarks: sm.CIA,
          otherMarks: sm.OTHER,
          totalInternal: totalInt,
          eseMarks: sm.ESE,
          grade: sm.GRADE
        };
      }).sort((a, b) => a.name.localeCompare(b.name));

      setReport1Data(records);
      if (records.length === 0) toast.error("No data found.");
    } catch (err) {
      console.error(err);
      toast.error("Error generating report");
    }
    setLoading(false);
  };

  // --- REPORT 2: CIA Examination Timetable Report ---
  const handleGenerateR2 = async () => {
    setLoading(true);
    try {
      let q = collection(db, "cia_exam_schedules");
      // Add simple filters if selected, otherwise fetch all
      const snap = await getDocs(query(q, orderBy("date", "desc")));
      
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filter locally for simplicity with all combinations
      const filtered = records.filter(r => {
        if (filterSession && r.academicSession !== filterSession) return false;
        if (filterProgramme && r.programmeName !== filterProgramme) return false;
        if (filterSemester && r.semester !== filterSemester) return false;
        return true;
      });

      setReport2Data(filtered);
      if (filtered.length === 0) toast.error("No timetable records found.");
    } catch (err) {
      console.error(err);
      toast.error("Error generating report");
    }
    setLoading(false);
  };

  // --- REPORT 3: Consolidated Class Wise Summary Report ---
  const handleGenerateR3 = async () => {
    if (!filterSession || !filterProgramme || !filterSemester || !filterClass) {
      toast.error("Please select Session, Programme, Semester, and Class");
      return;
    }
    setLoading(true);
    try {
      const studentsList = await getStudentsForClass(filterProgramme, filterSemester);
      const marksQ = query(collection(db, "cia_marks"), where("classId", "==", filterClass), where("academicSession", "==", filterSession));
      const marksSnap = await getDocs(marksQ);
      
      const courseSummaries = {};
      
      marksSnap.docs.forEach(d => {
        const data = d.data();
        if (data.entryType !== 'ESE' && data.entryType !== 'CIA') return; // Analyze main ones
        
        const cId = data.courseId;
        if (!courseSummaries[cId]) {
          courseSummaries[cId] = { courseId: cId, totalStudents: studentsList.length, present: 0, absent: 0, passed: 0, failed: 0 };
        }
        
        if (data.isAbsent) {
          courseSummaries[cId].absent++;
        } else {
          courseSummaries[cId].present++;
          const mark = Number(data.marks) || 0;
          const passing = data.entryType === 'ESE' ? 50 : 25; // Dummy threshold
          if (mark >= passing) courseSummaries[cId].passed++;
          else courseSummaries[cId].failed++;
        }
      });
      
      const records = Object.values(courseSummaries).map(r => ({
        ...r,
        passPercentage: r.present > 0 ? ((r.passed / r.present) * 100).toFixed(2) : 0
      }));

      setReport3Data(records);
      if (records.length === 0) toast.error("No summary data found for this class.");
    } catch (err) {
      console.error(err);
      toast.error("Error generating report");
    }
    setLoading(false);
  };

  // --- REPORT 4: Defaulters Mark Entry Report ---
  const handleGenerateR4 = async () => {
    if (!filterSession) {
      toast.error("Please select at least Academic Session");
      return;
    }
    setLoading(true);
    try {
      // Find schedules
      const schedQ = query(collection(db, "cia_exam_schedules"), where("academicSession", "==", filterSession));
      const schedSnap = await getDocs(schedQ);
      const schedules = schedSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Find marks
      const marksQ = query(collection(db, "cia_marks"), where("academicSession", "==", filterSession));
      const marksSnap = await getDocs(marksQ);
      
      const enteredMarksSet = new Set();
      marksSnap.docs.forEach(d => {
        const data = d.data();
        enteredMarksSet.add(`${data.scheduleId}_${data.studentId}`);
      });

      const defaulters = [];
      
      // For each schedule, get students, check if mark entered
      for (const sch of schedules) {
        if (filterProgramme && sch.programmeName !== filterProgramme) continue;
        if (filterSemester && sch.semester !== filterSemester) continue;

        const studentsList = await getStudentsForClass(sch.programmeName, sch.semester);
        for (const st of studentsList) {
          if (!enteredMarksSet.has(`${sch.id}_${st.id}`)) {
            defaulters.push({
              id: `${sch.id}_${st.id}`,
              studentName: st.name,
              registerNo: st.registerNo || st.id,
              programme: sch.programmeName,
              semester: sch.semester,
              course: sch.courseCode,
              examName: sch.examName,
              status: 'Marks Not Entered'
            });
          }
        }
      }

      setReport4Data(defaulters);
      if (defaulters.length === 0) toast.success("No defaulters found!");
    } catch (err) {
      console.error(err);
      toast.error("Error generating report");
    }
    setLoading(false);
  };

  const handleDownloadCSV = (data, filename, headers, rowMapper) => {
    if (!data || data.length === 0) return;
    
    const rows = data.map(rowMapper);
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportR1 = () => handleDownloadCSV(
    report1Data, 
    `Course_Wise_Internal_Marks_${filterCourse}`, 
    ["S.No", "Register No", "Student Name", "CIA Marks", "Other Marks", "Total Internal", "ESE Marks", "Grade"],
    (r, i) => [i + 1, r.registerNo, `"${r.name}"`, r.ciaMarks, r.otherMarks, r.totalInternal, r.eseMarks, r.grade]
  );

  const exportR2 = () => handleDownloadCSV(
    report2Data, 
    `Timetable_Report`, 
    ["Exam Name", "Programme", "Semester", "Course", "Class", "Date", "Session", "Status"],
    r => [`"${r.examName}"`, r.programmeName, r.semester, r.courseCode, r.class, r.date, r.session, r.status]
  );

  const exportR3 = () => handleDownloadCSV(
    report3Data, 
    `Class_Summary_${filterClass}`, 
    ["Course", "Total Students", "Present", "Absent", "Passed", "Failed", "Pass %"],
    r => [r.courseId, r.totalStudents, r.present, r.absent, r.passed, r.failed, `${r.passPercentage}%`]
  );

  const exportR4 = () => handleDownloadCSV(
    report4Data, 
    `Defaulters_Report`, 
    ["Register No", "Student Name", "Programme", "Semester", "Course", "Exam", "Status"],
    r => [r.registerNo, `"${r.studentName}"`, r.programme, r.semester, r.course, `"${r.examName}"`, r.status]
  );

  const renderFilters = (showClass = false, showCourse = false) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 15, marginBottom: 20 }}>
      <div>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Academic Session *</label>
        <select value={filterSession} onChange={(e) => setFilterSession(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
          <option value="">Select Session</option>
          {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Programme</label>
        <select value={filterProgramme} onChange={(e) => setFilterProgramme(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
          <option value="">Select Programme</option>
          {PROGRAMMES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Semester</label>
        <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
          <option value="">Select Semester</option>
          {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {showCourse && (
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Course Code</label>
          <input type="text" placeholder="e.g. CS101" value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
        </div>
      )}
      {showClass && (
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Class</label>
          <input type="text" placeholder="e.g. CSE-A" value={filterClass} onChange={(e) => setFilterClass(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
        </div>
      )}
    </div>
  );

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />
        <div className='page-header'>
          <h1>CIA Reports</h1>
          <p className="subtitle">View and export various examination and marks reports</p>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, overflowX: 'auto', paddingBottom: 5 }}>
          <button onClick={() => setActiveTab(1)} className={activeTab === 1 ? 'btn-primary' : ''} style={activeTab !== 1 ? { padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' } : { whiteSpace: 'nowrap' }}>
            <BookOpen size={16} style={{ display: 'inline', marginRight: 6 }}/> Course Wise Internal Marks
          </button>
          <button onClick={() => setActiveTab(2)} className={activeTab === 2 ? 'btn-primary' : ''} style={activeTab !== 2 ? { padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' } : { whiteSpace: 'nowrap' }}>
            <Calendar size={16} style={{ display: 'inline', marginRight: 6 }}/> Timetable Report
          </button>
          <button onClick={() => setActiveTab(3)} className={activeTab === 3 ? 'btn-primary' : ''} style={activeTab !== 3 ? { padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' } : { whiteSpace: 'nowrap' }}>
            <Users size={16} style={{ display: 'inline', marginRight: 6 }}/> Class Wise Summary
          </button>
          <button onClick={() => setActiveTab(4)} className={activeTab === 4 ? 'btn-primary' : ''} style={activeTab !== 4 ? { padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' } : { whiteSpace: 'nowrap' }}>
            <AlertTriangle size={16} style={{ display: 'inline', marginRight: 6 }}/> Defaulters Report
          </button>
        </div>

        {/* --- TAB 1: Course Wise Internal Marks --- */}
        {activeTab === 1 && (
          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: 15 }}>1. Course Wise Consolidated Internal Marks</h3>
            {renderFilters(false, true)}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
              <button onClick={handleGenerateR1} className="btn-primary" disabled={loading}>
                <FileSpreadsheet size={16} style={{ marginRight: 6 }} /> {loading ? 'Loading...' : 'Generate Report'}
              </button>
            </div>

            {report1Data && (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                  <button onClick={exportR1} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid #10b981', background: 'rgba(16,185,129,0.1)', color: '#10b981', cursor: 'pointer' }}>
                    <Download size={14} /> Export CSV
                  </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>S.NO</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>REGISTER NO</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>STUDENT NAME</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>CIA MARKS</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>OTHER MARKS</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>TOTAL INTERNAL</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>ESE MARKS</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>GRADE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report1Data.map((row, idx) => (
                        <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ padding: '12px 16px' }}>{row.registerNo}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.name}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.ciaMarks}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.otherMarks}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#6366f1' }}>{row.totalInternal}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.eseMarks}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: row.grade === 'RA' || row.grade === 'AB' ? '#ef4444' : '#10b981' }}>{row.grade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* --- TAB 2: Timetable Report --- */}
        {activeTab === 2 && (
          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: 15 }}>2. CIA Examination Timetable Report</h3>
            {renderFilters(false, false)}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
              <button onClick={handleGenerateR2} className="btn-primary" disabled={loading}>
                <FileSpreadsheet size={16} style={{ marginRight: 6 }} /> {loading ? 'Loading...' : 'Generate Report'}
              </button>
            </div>

            {report2Data && (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                  <button onClick={exportR2} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid #10b981', background: 'rgba(16,185,129,0.1)', color: '#10b981', cursor: 'pointer' }}>
                    <Download size={14} /> Export CSV
                  </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>EXAM NAME</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>PROGRAMME & SEM</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>COURSE</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>CLASS</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>DATE & TIME</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report2Data.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.examName}</td>
                          <td style={{ padding: '12px 16px' }}>{row.programmeName} (Sem {row.semester})</td>
                          <td style={{ padding: '12px 16px' }}>{row.courseCode}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.class}</td>
                          <td style={{ padding: '12px 16px' }}>{row.date} {row.session} <br/> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.startTime} - {row.endTime}</span></td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ padding: '2px 6px', borderRadius: 4, background: row.status === 'Completed' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)', color: row.status === 'Completed' ? '#10b981' : '#3b82f6', fontSize: 12 }}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* --- TAB 3: Class Wise Summary --- */}
        {activeTab === 3 && (
          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: 15 }}>3. Consolidated Class Wise Summary Report</h3>
            {renderFilters(true, false)}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
              <button onClick={handleGenerateR3} className="btn-primary" disabled={loading}>
                <FileSpreadsheet size={16} style={{ marginRight: 6 }} /> {loading ? 'Loading...' : 'Generate Report'}
              </button>
            </div>

            {report3Data && (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                  <button onClick={exportR3} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid #10b981', background: 'rgba(16,185,129,0.1)', color: '#10b981', cursor: 'pointer' }}>
                    <Download size={14} /> Export CSV
                  </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>COURSE CODE</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>TOTAL STUDENTS</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>PRESENT</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>ABSENT</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>PASSED</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>FAILED</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>PASS %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report3Data.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#6366f1' }}>{row.courseId}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.totalStudents}</td>
                          <td style={{ padding: '12px 16px', color: '#10b981', fontWeight: 600 }}>{row.present}</td>
                          <td style={{ padding: '12px 16px', color: '#ef4444', fontWeight: 600 }}>{row.absent}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.passed}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.failed}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: row.passPercentage >= 50 ? '#10b981' : '#ef4444' }}>{row.passPercentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* --- TAB 4: Defaulters Mark Entry Report --- */}
        {activeTab === 4 && (
          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: 15 }}>4. Defaulters Mark Entry Report</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Identifies students missing CIA/ESE marks for scheduled examinations.</p>
            {renderFilters(false, false)}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
              <button onClick={handleGenerateR4} className="btn-primary" disabled={loading}>
                <FileSpreadsheet size={16} style={{ marginRight: 6 }} /> {loading ? 'Loading...' : 'Generate Report'}
              </button>
            </div>

            {report4Data && (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                  <button onClick={exportR4} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid #10b981', background: 'rgba(16,185,129,0.1)', color: '#10b981', cursor: 'pointer' }}>
                    <Download size={14} /> Export CSV
                  </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>REGISTER NO</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>STUDENT NAME</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>PROGRAMME (SEM)</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>COURSE</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>EXAM NAME</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report4Data.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(239,68,68,0.02)' }}>
                          <td style={{ padding: '12px 16px' }}>{row.registerNo}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.studentName}</td>
                          <td style={{ padding: '12px 16px' }}>{row.programme} ({row.semester})</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.course}</td>
                          <td style={{ padding: '12px 16px' }}>{row.examName}</td>
                          <td style={{ padding: '12px 16px', color: '#ef4444', fontWeight: 600, fontSize: 12 }}>{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
