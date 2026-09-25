import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";
import { Calendar, CheckCircle2, XCircle, LayoutDashboard } from "lucide-react";

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export default function AttendanceOverview() {
  const { userProfile, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState(userProfile?.dept || "");
  const [departments, setDepartments] = useState([]);
  
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [overviewData, setOverviewData] = useState([]); // [{ year, section, morning: { status, by, percent }, afternoon: { status, by, percent } }]

  useEffect(() => {
    if (isSuperAdmin) {
      setDepartments(["CSE", "ECE", "EEE", "MECH", "IT", "AIDS"]);
    } else if (userProfile?.dept) {
      setDepartment(userProfile.dept);
    }
  }, [userProfile, isSuperAdmin]);

  useEffect(() => {
    if (department && date) {
      fetchOverview();
    }
  }, [department, date]);

  async function fetchOverview() {
    setLoading(true);
    try {
      // 1. Determine all classes in this dept. 
      // We'll combine class_incharges, substitute_incharges, and student data to find all distinct classes.
      const classesMap = {};

      const incQ = query(collection(db, "class_incharges"), where("dept", "==", department));
      const incSnap = await getDocs(incQ);
      incSnap.docs.forEach(d => {
        const data = d.data();
        classesMap[`${data.year}_${data.section}`] = { year: data.year, section: data.section };
      });

      const studQ = query(collection(db, "users"), where("role", "==", "student"), where("dept", "==", department));
      const studSnap = await getDocs(studQ);
      studSnap.docs.forEach(d => {
        const data = d.data();
        if (data.year && data.section) {
          classesMap[`${data.year}_${data.section}`] = { year: data.year, section: data.section };
        }
      });

      const allClasses = Object.values(classesMap);

      // 2. Fetch today's attendance for this department
      const attQ = query(collection(db, "daily_attendance"), where("dept", "==", department), where("date", "==", date));
      const attSnap = await getDocs(attQ);
      
      const attendanceByClassSession = {};
      attSnap.docs.forEach(d => {
        const data = d.data();
        const key = `${data.year}_${data.section}_${data.session}`;
        
        let presentCount = 0;
        let odCount = 0;
        let totalCount = data.totalCount || 0;

        if (data.records) {
          Object.values(data.records).forEach(status => {
            if (status === "P") presentCount++;
            if (status === "OD") odCount++;
          });
        }
        
        const percent = totalCount > 0 ? Math.round(((presentCount + odCount) / totalCount) * 100) : 0;
        
        attendanceByClassSession[key] = {
          markedBy: data.markedByName || data.markedBy,
          percent
        };
      });

      // 3. Map status to each class
      const mapped = allClasses.map(cls => {
        const mornKey = `${cls.year}_${cls.section}_Morning`;
        const aftKey = `${cls.year}_${cls.section}_Afternoon`;
        return {
          year: cls.year,
          section: cls.section,
          morning: attendanceByClassSession[mornKey] || null,
          afternoon: attendanceByClassSession[aftKey] || null
        };
      }).sort((a,b) => a.year.localeCompare(b.year) || a.section.localeCompare(b.section));

      setOverviewData(mapped);
    } catch (err) {
      toast.error("Failed to load overview data.");
    }
    setLoading(false);
  }

  const SessionStatusBadge = ({ data, sessionName }) => {
    if (!data) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)' }}>
          <XCircle size={16} /> Pending
        </div>
      );
    }
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontWeight: 600 }}>
          <CheckCircle2 size={16} /> Completed ({data.percent}%)
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          by {data.markedBy}
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1><LayoutDashboard size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />Attendance Overview</h1>
            <p className="subtitle">Real-time Daily Status</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {isSuperAdmin && (
              <select className="input-field" value={department} onChange={e => setDepartment(e.target.value)}>
                <option value="">Select Dept</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
            <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} max={new Date().toISOString().split("T")[0]} />
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading status...</div>
          ) : overviewData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <Calendar size={48} color="var(--border)" style={{ marginBottom: 16 }} />
              <h3>No Classes Found</h3>
              <p>Ensure students or incharges are assigned to classes for {department}.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: 12 }}>Class (Year & Section)</th>
                    <th style={{ padding: 12 }}>Morning Session</th>
                    <th style={{ padding: 12 }}>Afternoon Session</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewData.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 600 }}>{row.year}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Section {row.section}</div>
                      </td>
                      <td style={{ padding: 12 }}>
                        <SessionStatusBadge data={row.morning} sessionName="Morning" />
                      </td>
                      <td style={{ padding: 12 }}>
                        <SessionStatusBadge data={row.afternoon} sessionName="Afternoon" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
