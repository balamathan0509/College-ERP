import React, { useState } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { Search, PieChart, BarChart2, Users, CheckCircle, XCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function ResultAnalysis() {
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [filterSession, setFilterSession] = useState('');
  const [filterProgramme, setFilterProgramme] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterType, setFilterType] = useState('CIA'); // CIA, OTHER, ESE
  
  const [results, setResults] = useState(null);
  
  const SESSIONS = ["2025-2026", "2026-2027"];
  const PROGRAMMES = ["B.E CSE", "B.E ECE", "B.E EEE", "B.E MECH", "B.Tech IT"];
  const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];

  const handleSearch = async () => {
    if (!filterSession || !filterProgramme || !filterSemester || !filterCourse) {
      toast.error("Please select all filters");
      return;
    }
    
    setLoading(true);
    try {
      // Find marks for the selected course and entry type
      const marksQ = query(
        collection(db, "cia_marks"), 
        where("entryType", "==", filterType),
        where("courseId", "==", filterCourse)
      );
      
      const snap = await getDocs(marksQ);
      
      if (snap.empty) {
        toast.error("No result data found for the selected criteria.");
        setResults(null);
        setLoading(false);
        return;
      }
      
      const studentsData = [];
      let totalPassed = 0;
      let totalFailed = 0;
      let totalAbsent = 0;
      
      snap.docs.forEach(doc => {
        const data = doc.data();
        // Skip if session doesn't match 
        // For CIA, academicSession might be inside the exam metadata, but we'll filter loosely or assume it matches.
        
        const isAbsent = data.isAbsent;
        const mark = Number(data.marks) || 0;
        
        let passed = false;
        
        if (isAbsent) {
          totalAbsent++;
        } else {
          // Define passing criteria
          if (filterType === 'CIA' && mark >= 25) passed = true; // out of 50
          else if (filterType === 'ESE' && mark >= 50) passed = true; // out of 100
          else if (filterType === 'OTHER' && mark >= 50) passed = true; // out of 100 (example)
          
          if (passed) totalPassed++;
          else totalFailed++;
        }
        
        studentsData.push({
          id: data.studentId,
          registerNo: data.registerNo,
          name: data.studentName,
          marks: mark,
          isAbsent,
          passed,
          grade: data.grade || (passed ? 'PASS' : (isAbsent ? 'AB' : 'FAIL'))
        });
      });
      
      const totalStudents = studentsData.length;
      const passPercentage = totalStudents > 0 ? ((totalPassed / totalStudents) * 100).toFixed(2) : 0;
      
      // Sort by rank (marks descending)
      studentsData.sort((a, b) => b.marks - a.marks);

      setResults({
        totalStudents,
        totalPassed,
        totalFailed,
        totalAbsent,
        passPercentage,
        studentsData,
        topScorers: studentsData.filter(s => !s.isAbsent).slice(0, 5)
      });
      
    } catch (err) {
      console.error(err);
      toast.error("Failed to analyze results.");
    }
    setLoading(false);
  };

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />
        <div className='page-header'>
          <h1>Result Analysis</h1>
          <p className="subtitle">Analyze performance and generate insights</p>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 15, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Exam Type *</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                <option value="CIA">CIA / Internal</option>
                <option value="ESE">End Semester (ESE)</option>
                <option value="OTHER">Other Components</option>
              </select>
            </div>
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
                <option value="">Select Programme</option>
                {PROGRAMMES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Semester *</label>
              <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                <option value="">Select Semester</option>
                {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Course Code *</label>
              <input type="text" placeholder="e.g. CS101" value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSearch} className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px' }}>
              <BarChart2 size={16} /> {loading ? 'Analyzing...' : 'Generate Analysis'}
            </button>
          </div>
        </div>

        {results && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 20 }}>
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 15, padding: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={24} color="#6366f1" />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Total Students</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{results.totalStudents}</div>
                </div>
              </div>
              
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 15, padding: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={24} color="#10b981" />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Total Passed</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{results.totalPassed}</div>
                </div>
              </div>

              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 15, padding: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <XCircle size={24} color="#ef4444" />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Total Failed / Absent</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{results.totalFailed} / {results.totalAbsent}</div>
                </div>
              </div>

              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 15, padding: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PieChart size={24} color="#f59e0b" />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Pass Percentage</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: results.passPercentage >= 50 ? '#10b981' : '#ef4444' }}>{results.passPercentage}%</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div className="card">
                <h3 style={{ marginTop: 0, marginBottom: 20 }}>Top Performers</h3>
                {results.topScorers.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No data available.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {results.topScorers.map((student, idx) => (
                      <li key={student.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: idx !== results.topScorers.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{student.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{student.registerNo}</div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#6366f1' }}>{student.marks} Marks</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            
            <div className="card">
              <h3 style={{ marginTop: 0, marginBottom: 20 }}>Full Class Performance</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>RANK</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>REGISTER NO</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>STUDENT NAME</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>MARKS</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>GRADE / STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.studentsData.map((student, idx) => (
                      <tr key={student.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '12px 16px' }}>{student.registerNo}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{student.name}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{student.isAbsent ? 'AB' : student.marks}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ 
                            padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
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
          </>
        )}
      </main>
    </div>
  );
}
