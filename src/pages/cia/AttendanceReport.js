import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { db } from '../../firebase/config';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { Search, Download, Calendar } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function AttendanceReport() {
  const [schedules, setSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSchedules();
  }, []);

  async function fetchSchedules() {
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
  }

  const handleGenerateReport = async () => {
    if (!selectedScheduleId) {
      toast.error("Please select a schedule");
      return;
    }

    setLoading(true);
    try {
      const schedule = schedules.find(s => s.id === selectedScheduleId);
      
      const attQ = query(
        collection(db, "cia_exam_attendance"),
        where("scheduleId", "==", selectedScheduleId)
      );
      const attSnap = await getDocs(attQ);
      
      if (attSnap.empty) {
        toast.error("No attendance records found for this schedule.");
        setReportData(null);
        setLoading(false);
        return;
      }
      
      const records = [];
      let presentCount = 0;
      let absentCount = 0;
      
      attSnap.docs.forEach(d => {
        const data = d.data();
        if (data.status === 'Present') presentCount++;
        else if (data.status === 'Absent') absentCount++;
        
        records.push({
          id: data.studentId,
          name: data.studentName,
          registerNo: data.registerNo,
          status: data.status,
          markedBy: data.markedBy
        });
      });
      
      records.sort((a, b) => a.name.localeCompare(b.name));
      
      setReportData({
        schedule,
        records,
        presentCount,
        absentCount,
        totalCount: records.length,
        attendancePercentage: ((presentCount / records.length) * 100).toFixed(2)
      });
      
    } catch (err) {
      console.error(err);
      toast.error("Error generating report");
    }
    setLoading(false);
  };

  const handleDownloadCSV = () => {
    if (!reportData) return;
    
    const headers = ["S.No", "Register No", "Student Name", "Attendance Status"];
    const rows = reportData.records.map((r, i) => [
      i + 1,
      r.registerNo,
      `"${r.name}"`, // escape commas in names
      r.status
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_Report_${reportData.schedule.courseCode}_${reportData.schedule.date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />
        <div className='page-header'>
          <h1>CIA Attendance Report</h1>
          <p className="subtitle">View and download exam attendance reports</p>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 15, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Select Examination Schedule *</label>
              <select 
                value={selectedScheduleId} 
                onChange={(e) => setSelectedScheduleId(e.target.value)} 
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}
              >
                <option value="">-- Select Schedule --</option>
                {schedules.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.examName} | {s.courseCode} ({s.class}) - {s.date}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleGenerateReport} className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px' }}>
              <Search size={16} /> {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {reportData && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 20 }}>
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 15, padding: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={24} color="#6366f1" />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Total Registered</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{reportData.totalCount}</div>
                </div>
              </div>
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 15, padding: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>P</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Total Present</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{reportData.presentCount}</div>
                </div>
              </div>
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 15, padding: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>A</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Total Absent</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{reportData.absentCount}</div>
                </div>
              </div>
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 15, padding: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>%</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Attendance %</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{reportData.attendancePercentage}%</div>
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>Attendance Sheet - {reportData.schedule.courseCode} ({reportData.schedule.class})</h3>
                <button onClick={handleDownloadCSV} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #6366f1', background: 'transparent', color: '#6366f1', cursor: 'pointer', fontWeight: 600 }}>
                  <Download size={16} /> Download CSV
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13, width: 60 }}>S.NO</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>REGISTER NO</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>STUDENT NAME</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.records.map((record, idx) => (
                      <tr key={record.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: record.status === 'Absent' ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '12px 16px' }}>{record.registerNo}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{record.name}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ 
                            padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                            background: record.status === 'Present' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', 
                            color: record.status === 'Present' ? '#10b981' : '#ef4444' 
                          }}>
                            {record.status}
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
