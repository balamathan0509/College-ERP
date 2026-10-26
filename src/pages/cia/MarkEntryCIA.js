import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, getDocs, setDoc, doc, where, orderBy } from "../../supabase/supabaseAdapter";
import { Save, Search, Users, FileEdit, ArrowLeft, CheckCircle2, XCircle, Award, Percent, BookOpen, ShieldAlert } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function MarkEntryCIA() {
  const { userProfile, isSuperAdmin } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  // Staff allocated courses
  const [allocatedCourses, setAllocatedCourses] = useState(new Set());
  const [allocatedCourseSemMap, setAllocatedCourseSemMap] = useState(new Map());
  const [loadingAllocations, setLoadingAllocations] = useState(true);

  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [marksMap, setMarksMap] = useState({});

  // Configurable Pass Mark & Max Mark (Default 35 out of 50 as per college regulation)
  const [maxMarks, setMaxMarks] = useState(50);
  const [passMark, setPassMark] = useState(35);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters for Schedule List
  const [filterSession, setFilterSession] = useState('');
  const [filterProgramme, setFilterProgramme] = useState('');
  const [filterSemester, setFilterSemester] = useState('');

  const SESSIONS = ["2025-2026", "2026-2027"];
  const PROGRAMMES = ["B.E CSE", "B.E ECE", "B.E EEE", "B.E MECH", "B.Tech IT"];
  const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];

  const role = userProfile?.role;
  const isStaffOnly = role === 'staff' && !isSuperAdmin;

  useEffect(() => {
    if (userProfile) {
      loadStaffAllocationsAndSchedules();
    }
  }, [userProfile]);

  async function loadStaffAllocationsAndSchedules() {
    setLoadingAllocations(true);
    const codes = new Set();
    const semMap = new Map();
    const uid = userProfile?.uid;
    const userName = (userProfile?.name || "").trim().toLowerCase();
    const userEmail = (userProfile?.email || "").trim().toLowerCase();

    const recordCourseSem = (cCode, sem) => {
      if (!cCode) return;
      const c = cCode.trim().toUpperCase();
      codes.add(c);
      if (sem) {
        if (!semMap.has(c)) semMap.set(c, new Set());
        semMap.get(c).add(String(sem).trim());
      }
    };

    // If regular staff, discover only their assigned courses
    if (isStaffOnly) {
      // 1. Fetch from course_allocations
      try {
        const snap1 = await getDocs(collection(db, "course_allocations"));
        snap1.docs.forEach(d => {
          const data = d.data();
          if (!data) return;
          const fUid = data.facultyId;
          const fName = (data.facultyName || "").trim().toLowerCase();
          const fEmail = (data.facultyEmail || "").trim().toLowerCase();
          if (
            (fUid && String(fUid) === String(uid)) ||
            (fEmail && fEmail === userEmail) ||
            (fName && userName && (fName === userName || fName.includes(userName) || userName.includes(fName)))
          ) {
            recordCourseSem(data.courseCode, data.semester);
          }
        });
      } catch (err) {
        console.warn("course_allocations fetch error:", err);
      }

      // 2. Fetch from subject_allocations
      try {
        const snap2 = await getDocs(collection(db, "subject_allocations"));
        snap2.docs.forEach(d => {
          const data = d.data();
          if (!data) return;
          const fUid = data.facultyId;
          const fName = (data.facultyName || "").trim().toLowerCase();
          if (
            (fUid && String(fUid) === String(uid)) ||
            (fName && userName && (fName === userName || fName.includes(userName) || userName.includes(fName)))
          ) {
            recordCourseSem(data.subjectCode || data.courseCode, data.semester);
          }
        });
      } catch (err) {
        console.warn("subject_allocations fetch error:", err);
      }

      // 3. Fetch from timetable_slots
      try {
        const snap3 = await getDocs(collection(db, "timetable_slots"));
        snap3.docs.forEach(d => {
          const data = d.data();
          if (!data) return;
          const sUid = data.staff_uid;
          const sName = (data.staff_name || "").trim().toLowerCase();
          const sEmail = (data.staff_email || "").trim().toLowerCase();
          if (
            (sUid && String(sUid) === String(uid)) ||
            (sEmail && sEmail === userEmail) ||
            (sName && userName && (sName === userName || sName.includes(userName) || userName.includes(sName)))
          ) {
            recordCourseSem(data.subject_code, data.semester);
          }
        });
      } catch (err) {
        console.warn("timetable_slots fetch error:", err);
      }

      setAllocatedCourses(codes);
      setAllocatedCourseSemMap(semMap);
    }

    setLoadingAllocations(false);
    fetchSchedules();
  }

  async function fetchSchedules() {
    setLoading(true);
    try {
      const q = query(
        collection(db, "cia_exam_schedules"),
        orderBy("date", "desc")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchedules(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load schedules");
    }
    setLoading(false);
  }

  const handleActionClick = async (schedule) => {
    setSelectedSchedule(schedule);
    setLoading(true);
    try {
      // Fetch Attendance
      const attQ = query(collection(db, "cia_exam_attendance"), where("scheduleId", "==", schedule.id));
      const attSnap = await getDocs(attQ);

      const attData = {};
      const studentData = [];

      attSnap.docs.forEach(d => {
        const data = d.data();
        attData[data.studentId] = data.status;
        studentData.push({
          id: data.studentId,
          name: data.studentName,
          registerNo: data.registerNo,
          rollNo: data.rollNo
        });
      });

      // Fetch Existing Marks & Saved passMark
      const marksQ = query(
        collection(db, "cia_marks"),
        where("scheduleId", "==", schedule.id),
        where("entryType", "==", "CIA")
      );
      const marksSnap = await getDocs(marksQ);
      const mData = {};
      let detectedPassMark = null;
      let detectedMaxMark = null;

      marksSnap.docs.forEach(d => {
        const data = d.data();
        mData[data.studentId] = data.marks;
        if (data.passMarks !== undefined && detectedPassMark === null) {
          detectedPassMark = Number(data.passMarks);
        }
        if (data.maxMarks !== undefined && detectedMaxMark === null) {
          detectedMaxMark = Number(data.maxMarks);
        }
      });

      // Check schedule metadata for maxMarks / passMarks, fallback to Model/CIA defaults
      const isModelExam = (schedule.examType === 'Model' || (schedule.examName || '').toLowerCase().includes('model'));
      const defaultMax = schedule.maxMarks !== undefined ? Number(schedule.maxMarks) : (isModelExam ? 100 : 50);
      const defaultPass = schedule.passMarks !== undefined ? Number(schedule.passMarks) : (defaultMax === 100 ? 75 : 35);

      const finalMax = schedule.maxMarks !== undefined ? Number(schedule.maxMarks) : (detectedMaxMark !== null ? detectedMaxMark : defaultMax);
      const finalPass = schedule.passMarks !== undefined ? Number(schedule.passMarks) : (detectedPassMark !== null ? detectedPassMark : defaultPass);

      setPassMark(finalPass);
      setMaxMarks(finalMax);

      studentData.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      setStudents(studentData);
      setAttendanceMap(attData);

      // Default absent students to 0
      studentData.forEach(s => {
        if (attData[s.id] === 'Absent' && (mData[s.id] === undefined || mData[s.id] === '')) {
          mData[s.id] = 0;
        }
      });

      setMarksMap(mData);

      if (studentData.length === 0) {
        toast.error("No students found. Please mark examination attendance first.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading students");
    }
    setLoading(false);
  };

  const handleMarkChange = (studentId, value) => {
    const num = Number(value);
    if (value !== '' && (isNaN(num) || num < 0 || num > maxMarks)) {
      toast.error(`Marks cannot exceed maximum of ${maxMarks}`);
      return;
    }
    setMarksMap(prev => ({ ...prev, [studentId]: value }));
  };

  const handleSaveMarks = async (status = "Draft") => {
    if (students.length === 0) return;

    setSaving(true);
    try {
      const batchPromises = students.map(student => {
        const recordId = `${selectedSchedule.id}_${student.id}_CIA`;

        let finalMark = marksMap[student.id];
        let isAbsent = attendanceMap[student.id] === 'Absent';

        if (isAbsent) finalMark = 0;
        const markVal = Number(finalMark) || 0;
        const isPass = !isAbsent && markVal >= Number(passMark);

        return setDoc(doc(db, "cia_marks", recordId), {
          academicSession: selectedSchedule.academicSession || "",
          programmeName: selectedSchedule.programmeName || "",
          semester: selectedSchedule.semester || "",
          examId: selectedSchedule.examId,
          scheduleId: selectedSchedule.id,
          courseId: selectedSchedule.courseCode,
          classId: selectedSchedule.class,
          studentId: student.id,
          studentName: student.name || 'Unknown',
          registerNo: student.registerNo || student.id,
          marks: markVal,
          maxMarks: Number(maxMarks) || 50,
          passMarks: Number(passMark) || 35,
          result: isAbsent ? "Absent" : isPass ? "Pass" : "Fail",
          isAbsent: isAbsent,
          entryType: "CIA",
          status: status,
          enteredBy: userProfile?.name || "Faculty",
          enteredByUid: userProfile?.uid || "",
          updatedAt: new Date().toISOString()
        }, { merge: true });
      });

      await Promise.all(batchPromises);
      toast.success(`Marks saved as ${status} successfully (Pass Mark: ${passMark}/${maxMarks})`);
    } catch (err) {
      console.error(err);
      toast.error("Error saving marks");
    }
    setSaving(false);
  };

  // Filter schedules according to user role and allocated courses
  const filteredSchedules = schedules.filter(s => {
    if (filterSession && s.academicSession !== filterSession) return false;
    if (filterProgramme && s.programmeName !== filterProgramme) return false;
    if (filterSemester && s.semester !== filterSemester) return false;

    // Staff role restriction: ONLY show allocated subjects for the exact allocated semester!
    if (isStaffOnly) {
      const code = (s.courseCode || "").trim().toUpperCase();
      if (!allocatedCourses.has(code)) return false;
      // Strict Semester Isolation
      if (s.semester && allocatedCourseSemMap.has(code)) {
        const allowedSems = allocatedCourseSemMap.get(code);
        if (allowedSems && allowedSems.size > 0 && !allowedSems.has(String(s.semester).trim())) {
          return false;
        }
      }
    } else if (role === 'hod' && userProfile?.dept) {
      // HOD only sees department subjects
      const prog = (s.programmeName || "").toUpperCase();
      const dept = (userProfile.dept || "").toUpperCase();
      if (!prog.includes(dept) && s.department !== userProfile.dept) return false;
    }

    return true;
  });

  // Calculate live pass / fail statistics
  const totalEnrolled = students.length;
  const absentCount = students.filter(s => attendanceMap[s.id] === 'Absent').length;
  const presentCount = totalEnrolled - absentCount;
  const passedStudents = students.filter(s => attendanceMap[s.id] !== 'Absent' && Number(marksMap[s.id] || 0) >= Number(passMark));
  const failedStudents = students.filter(s => attendanceMap[s.id] === 'Absent' || Number(marksMap[s.id] || 0) < Number(passMark));
  const passPercentage = presentCount > 0 ? Math.round((passedStudents.length / presentCount) * 100) : 0;

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />
        <div className='page-header' style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0 }}>CIA Mark Entry Process</h1>
              <p className="subtitle" style={{ margin: '4px 0 0' }}>
                Enter marks for Continuous Internal Assessment examinations (Pass criteria customizable by faculty)
              </p>
            </div>
            {isStaffOnly && (
              <div style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <BookOpen size={16} /> Filtered to My Allocated Subjects ({allocatedCourses.size})
              </div>
            )}
          </div>
        </div>

        {!selectedSchedule ? (
          <>
            {/* Filters */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 15, alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={filterSession} onChange={(e) => setFilterSession(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                  <option value="">All Sessions</option>
                  {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filterProgramme} onChange={(e) => setFilterProgramme(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                  <option value="">All Programmes</option>
                  {PROGRAMMES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                  <option value="">All Semesters</option>
                  {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Schedule List */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {isStaffOnly ? "My Allocated Course Examinations" : "Examination Schedule List"}
                </h3>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {filteredSchedules.length} schedule(s) found
                </span>
              </div>

              {loading || loadingAllocations ? (
                <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}>Loading examination schedules...</div>
              ) : filteredSchedules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}>
                  <BookOpen size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                  <p style={{ fontWeight: 600, margin: '0 0 6px' }}>No allocated exam schedules found for you.</p>
                  <p style={{ fontSize: 13, margin: 0, opacity: 0.8 }}>
                    {isStaffOnly
                      ? "Only subjects allocated to your profile will be displayed here. If your subject is missing, please contact your HOD or Dept Admin for course allocation."
                      : "No scheduled exams match the selected filter criteria."}
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>SESSION</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>EXAM / COURSE</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>CLASS</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>DATE & SESSION</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'right' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSchedules.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{item.academicSession}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sem {item.semester}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700, color: '#6366f1' }}>{item.examName}</div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{item.courseCode} - {item.courseName}</div>
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.class}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div>{item.date}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.session} | {item.startTime} - {item.endTime}</div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <button onClick={() => handleActionClick(item)} className="btn-primary" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600 }}>
                              Enter Marks
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="card" style={{ padding: 24 }}>
            {/* Header with Back button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={() => setSelectedSchedule(null)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600
                  }}
                >
                  <ArrowLeft size={16} /> Back to List
                </button>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                    Mark Entry: {selectedSchedule.examName} ({selectedSchedule.courseCode})
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                    Course: <strong>{selectedSchedule.courseName}</strong> • Class: <strong>{selectedSchedule.class}</strong> • Date: <strong>{selectedSchedule.date}</strong>
                  </p>
                </div>
              </div>

              {/* Pass Mark Alteration Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'rgba(99, 102, 241, 0.08)',
                padding: '10px 16px',
                borderRadius: 10,
                border: '1.5px solid rgba(99, 102, 241, 0.3)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={18} color="#6366f1" />
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    Pass Mark:
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={maxMarks}
                    value={passMark}
                    onChange={(e) => setPassMark(Math.max(0, Math.min(maxMarks, Number(e.target.value) || 0)))}
                    style={{
                      width: 65,
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: '2px solid #6366f1',
                      fontWeight: 800,
                      fontSize: 15,
                      textAlign: 'center',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text)'
                    }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>
                    / {maxMarks}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, borderLeft: '1px solid rgba(99, 102, 241, 0.3)', paddingLeft: 10 }}>
                  Alter pass mark anytime
                </div>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}>Loading students...</div>
            ) : students.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                No students found. Did you mark examination attendance first?
              </div>
            ) : (
              <>
                {/* Live Stats Cards based on the customized Pass Mark */}
                <div className="stats-grid" style={{ marginBottom: 20 }}>
                  <div className="stat-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Users size={20} color="var(--highlight)" />
                    </div>
                    <div className="stat-value">{totalEnrolled}</div>
                    <div className="stat-label">Total Candidates</div>
                  </div>

                  <div className="stat-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <CheckCircle2 size={20} color="#16a34a" />
                    </div>
                    <div className="stat-value" style={{ color: "#16a34a" }}>{presentCount}</div>
                    <div className="stat-label">Present</div>
                  </div>

                  <div className="stat-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <XCircle size={20} color="#dc2626" />
                    </div>
                    <div className="stat-value" style={{ color: "#dc2626" }}>{absentCount}</div>
                    <div className="stat-label">Absent</div>
                  </div>

                  <div className="stat-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Award size={20} color="#10b981" />
                    </div>
                    <div className="stat-value" style={{ color: "#10b981" }}>{passedStudents.length}</div>
                    <div className="stat-label">Passed (≥ {passMark})</div>
                  </div>

                  <div className="stat-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <XCircle size={20} color="#ef4444" />
                    </div>
                    <div className="stat-value" style={{ color: "#ef4444" }}>{failedStudents.length}</div>
                    <div className="stat-label">Failed (&lt; {passMark})</div>
                  </div>

                  <div className="stat-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Percent size={20} color="#6366f1" />
                    </div>
                    <div className="stat-value" style={{ color: "#6366f1" }}>{passPercentage}%</div>
                    <div className="stat-label">Pass Percentage</div>
                  </div>
                </div>

                {/* Mark Entry Table with Pass/Fail Column */}
                <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 13, width: 50 }}>S.NO</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 13, width: 140 }}>REGISTER NO</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 13 }}>STUDENT NAME</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 13, width: 100 }}>ATTENDANCE</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 13, width: 150 }}>
                          CIA MARKS (Max {maxMarks})
                        </th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 13, width: 140, textAlign: 'center' }}>
                          RESULT (Pass ≥ {passMark})
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, idx) => {
                        const isAbsent = attendanceMap[student.id] === 'Absent';
                        const currentMark = marksMap[student.id];
                        const markNum = Number(currentMark);
                        const hasMark = currentMark !== undefined && currentMark !== '';
                        const isPass = !isAbsent && hasMark && markNum >= Number(passMark);

                        return (
                          <tr
                            key={student.id}
                            style={{
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              background: isAbsent ? 'rgba(239,68,68,0.05)' : (!isPass && hasMark) ? 'rgba(239,68,68,0.02)' : 'transparent'
                            }}
                          >
                            <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 13 }}>{idx + 1}</td>
                            <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 600, fontSize: 13 }}>
                              {student.registerNo || student.id}
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: 13 }}>
                              {student.name || 'Unknown'}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{
                                color: isAbsent ? '#ef4444' : '#10b981',
                                fontWeight: 700,
                                fontSize: 12,
                                background: isAbsent ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                padding: '3px 8px',
                                borderRadius: 8
                              }}>
                                {isAbsent ? 'Absent' : 'Present'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="number"
                                  value={isAbsent ? '0' : (marksMap[student.id] ?? '')}
                                  onChange={(e) => handleMarkChange(student.id, e.target.value)}
                                  disabled={isAbsent}
                                  min="0"
                                  max={maxMarks}
                                  placeholder="0"
                                  style={{
                                    width: '90px',
                                    padding: '8px 10px',
                                    borderRadius: 6,
                                    border: hasMark && markNum < Number(passMark) && !isAbsent
                                      ? '1.5px solid #ef4444'
                                      : '1px solid var(--border-color)',
                                    background: isAbsent ? 'rgba(0,0,0,0.1)' : 'var(--bg-color)',
                                    color: 'var(--text)',
                                    fontWeight: 700,
                                    fontSize: 14,
                                    opacity: isAbsent ? 0.6 : 1
                                  }}
                                />
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/ {maxMarks}</span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              {isAbsent ? (
                                <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '4px 10px', borderRadius: 12, fontWeight: 700, fontSize: 11 }}>
                                  Absent (Fail)
                                </span>
                              ) : !hasMark ? (
                                <span style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                                  Enter mark
                                </span>
                              ) : isPass ? (
                                <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px 12px', borderRadius: 12, fontWeight: 700, fontSize: 12 }}>
                                  ✓ Pass
                                </span>
                              ) : (
                                <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '4px 10px', borderRadius: 12, fontWeight: 700, fontSize: 12 }}>
                                  ✗ Fail ({Number(passMark) - markNum} needed)
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Save and Finalize Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button
                    onClick={() => handleSaveMarks("Draft")}
                    disabled={saving}
                    style={{
                      padding: '10px 22px',
                      borderRadius: 8,
                      border: '1.5px solid #6366f1',
                      background: 'rgba(99,102,241,0.08)',
                      color: '#6366f1',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: 13
                    }}
                  >
                    {saving ? 'Saving...' : 'Save as Draft'}
                  </button>
                  <button
                    onClick={() => handleSaveMarks("Finalized")}
                    disabled={saving}
                    className="btn-primary"
                    style={{ padding: '10px 24px', fontSize: 13, fontWeight: 700 }}
                  >
                    {saving ? 'Saving...' : 'Finalize Marks'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
