import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";
import { FileText, Download, Calendar } from "lucide-react";

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export default function DailyAttendanceReport() {
  const { userProfile, isSuperAdmin } = useAuth();
  
  const [department, setDepartment] = useState(userProfile?.dept || "");
  const [departments, setDepartments] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [year, setYear] = useState("");
  const [section, setSection] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);

  useEffect(() => {
    if (isSuperAdmin) {
      setDepartments(["CSE", "ECE", "EEE", "MECH", "IT", "AIDS"]);
    } else if (userProfile?.dept) {
      setDepartment(userProfile.dept);
    }
  }, [userProfile, isSuperAdmin]);

  const generateReport = async () => {
    if (!department) { toast.error("Select Department"); return; }
    
    setLoading(true);
    try {
      // 1. Fetch Students
      let studQ = query(collection(db, "users"), where("role", "==", "student"), where("dept", "==", department));
      if (year) studQ = query(studQ, where("year", "==", year));
      if (section) studQ = query(studQ, where("section", "==", section));
      
      const studSnap = await getDocs(studQ);
      const students = studSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => {
        if (a.year !== b.year) return (a.year || "").localeCompare(b.year || "");
        if (a.section !== b.section) return (a.section || "").localeCompare(b.section || "");
        return (a.name || "").localeCompare(b.name || "");
      });

      // 2. Fetch Attendance for Date
      let attQ = query(collection(db, "daily_attendance"), where("dept", "==", department), where("date", "==", date));
      if (year) attQ = query(attQ, where("year", "==", year));
      if (section) attQ = query(attQ, where("section", "==", section));
      const attSnap = await getDocs(attQ);
      
      const morningRecords = {};
      const afternoonRecords = {};
      
      attSnap.docs.forEach(d => {
        const data = d.data();
        const keyPrefix = `${data.year}_${data.section}`;
        const records = data.records || {};
        
        if (data.session === "Morning") {
          Object.entries(records).forEach(([uid, st]) => morningRecords[uid] = st);
        } else if (data.session === "Afternoon") {
          Object.entries(records).forEach(([uid, st]) => afternoonRecords[uid] = st);
        }
      });

      // 3. Compute Data
      const computed = students.map(s => {
        const mStatus = morningRecords[s.id] || "N/A";
        const aStatus = afternoonRecords[s.id] || "N/A";
        
        let dayStatus = "N/A";
        
        // --- ISOLATED DAY STATUS LOGIC ---
        // If either session is OD, Day Status = OD.
        // P + P = Present
        // P + A / A + P = Half Day
        // A + A = Absent
        if (mStatus !== "N/A" && aStatus !== "N/A") {
          if (mStatus === "OD" || aStatus === "OD") {
            dayStatus = "OD";
          } else if (mStatus === "P" && aStatus === "P") {
            dayStatus = "Present";
          } else if (mStatus === "A" && aStatus === "A") {
            dayStatus = "Absent";
          } else if ((mStatus === "P" && aStatus === "A") || (mStatus === "A" && aStatus === "P")) {
            dayStatus = "Half Day";
          }
        }
        // ----------------------------------

        return {
          id: s.id,
          regNo: s.registerNo || s.registerNumber || "N/A",
          name: s.name,
          year: s.year || "N/A",
          section: s.section || "N/A",
          morning: mStatus,
          afternoon: aStatus,
          dayStatus
        };
      });
      
      setReportData(computed);
      toast.success("Report generated");
    } catch (err) {
      toast.error("Failed to generate report.");
    }
    setLoading(false);
  };

  const exportCSV = () => {
    if (reportData.length === 0) return;
    const headers = ["Reg No", "Name", "Year", "Section", "Morning", "Afternoon", "Day Status"];
    const rows = reportData.map(r => [
      r.regNo,
      `"${r.name}"`,
      r.year,
      r.section,
      r.morning,
      r.afternoon,
      r.dayStatus
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_Report_${department}_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const getStatusColor = (status) => {
    if (status === "P" || status === "Present") return "var(--success)";
    if (status === "A" || status === "Absent") return "var(--danger)";
    if (status === "OD") return "var(--warning)";
    if (status === "Half Day") return "#f59e0b";
    return "var(--text-muted)";
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header" style={{ marginBottom: 20 }}>
          <h1><FileText size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />Daily Attendance Report</h1>
          <p className="subtitle">Detailed Session-wise Tracking</p>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 15, alignItems: 'flex-end' }}>
            {isSuperAdmin && (
              <div style={{ flex: 1, minWidth: 150 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Department</label>
                <select className="input-field" style={{ width: '100%', marginTop: 5 }} value={department} onChange={e => setDepartment(e.target.value)}>
                  <option value="">All Depts</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Date</label>
              <input type="date" className="input-field" style={{ width: '100%', marginTop: 5 }} value={date} onChange={e => setDate(e.target.value)} max={new Date().toISOString().split("T")[0]} />
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Year (Optional)</label>
              <select className="input-field" style={{ width: '100%', marginTop: 5 }} value={year} onChange={e => setYear(e.target.value)}>
                <option value="">All Years</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 100 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Section (Optional)</label>
              <input type="text" className="input-field" style={{ width: '100%', marginTop: 5 }} value={section} onChange={e => setSection(e.target.value.toUpperCase())} placeholder="e.g. A" />
            </div>
            <div>
              <button onClick={generateReport} className="btn-primary" style={{ padding: '10px 20px', height: 42 }}>
                {loading ? "Generating..." : "Generate Report"}
              </button>
            </div>
          </div>
        </div>

        {reportData.length > 0 && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3>Report Results ({reportData.length} Students)</h3>
              <button onClick={exportCSV} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download size={16} /> Export CSV
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: 12 }}>Reg No</th>
                    <th style={{ padding: 12 }}>Student Name</th>
                    <th style={{ padding: 12 }}>Class</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>Morning</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>Afternoon</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>Day Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((row, idx) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 12, fontFamily: 'monospace', fontWeight: 600 }}>{row.regNo}</td>
                      <td style={{ padding: 12, fontWeight: 600 }}>{row.name}</td>
                      <td style={{ padding: 12, color: 'var(--text-muted)' }}>{row.year} • {row.section}</td>
                      <td style={{ padding: 12, textAlign: 'center', fontWeight: 'bold', color: getStatusColor(row.morning) }}>{row.morning}</td>
                      <td style={{ padding: 12, textAlign: 'center', fontWeight: 'bold', color: getStatusColor(row.afternoon) }}>{row.afternoon}</td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: 20, 
                          fontSize: 12, 
                          fontWeight: 700, 
                          background: `${getStatusColor(row.dayStatus)}20`, 
                          color: getStatusColor(row.dayStatus) 
                        }}>
                          {row.dayStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
