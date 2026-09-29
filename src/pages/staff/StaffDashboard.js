import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import ClassLogModal from "../../components/ClassLogModal";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, where, getDocs } from "../../supabase/supabaseAdapter";
import { useNavigate } from "react-router-dom";
import {
  DoorOpen,
  CheckSquare,
  Award,
  Calendar,
  Briefcase,
  Bell,
  MessageSquareWarning,
  AlertOctagon,
  Users,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Plus,
  Send,
  FileCheck
} from "lucide-react";

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export default function StaffDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    pendingGatePasses: 0,
    todayAttendanceMarked: false,
    openComplaints: 0,
    totalStudents: 0
  });
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  async function fetchStats() {
    try {
      const today = new Date().toISOString().split("T")[0];

      // Pending gate passes for this dept
      const gpQ = query(
        collection(db, "gate_pass"),
        where("dept", "==", userProfile.dept),
        where("status", "==", "pending_staff")
      );
      const gpSnap = await getDocs(gpQ);
      const pendingGatePasses = gpSnap.size;

      // Today attendance marked?
      const attQ = query(
        collection(db, "attendance"),
        where("dept", "==", userProfile.dept),
        where("date", "==", today)
      );
      const attSnap = await getDocs(attQ);
      const todayAttendanceMarked = !attSnap.empty;

      // Total students in dept
      const studQ = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", userProfile.dept)
      );
      const studSnap = await getDocs(studQ);
      const students = studSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const totalStudents = students.length;
      setStudents(students);

      // Open complaints
      const compQ = query(
        collection(db, "complaints"),
        where("dept", "==", userProfile.dept),
        where("status", "==", "open")
      );
      const compSnap = await getDocs(compQ);
      const openComplaints = compSnap.size;

      setStats({ pendingGatePasses, todayAttendanceMarked, openComplaints, totalStudents });

      // Fetch Assigned Subjects (including cross-department subjects)
      if (userProfile?.uid) {
        const allocQ = query(
          collection(db, "subject_allocations"),
          where("facultyId", "==", userProfile.uid),
          where("status", "==", "Active")
        );
        const allocSnap = await getDocs(allocQ);
        setAssignedSubjects(allocSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch Recent Class Logs submitted by this staff
        const logsQ = query(
          collection(db, "class_logs"),
          where("facultyId", "==", userProfile.uid)
        );
        const logsSnap = await getDocs(logsQ);
        const logsList = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        logsList.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        setRecentLogs(logsList.slice(0, 5));
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => { if (userProfile) fetchStats(); }, [userProfile]);

  const quickActions = [
    { icon: <BookOpen size={24} color="#2563eb" />, label: "Log Class & Topic", onClick: () => setIsLogModalOpen(true) },
    { icon: <Award size={24} color="#7c3aed" />, label: "5-Internal Marks", path: "/cia/mark-entry" },
    { icon: <DoorOpen size={24} color="#3b82f6" />, label: "Gate Pass Approvals", path: "/staff/gatepass" },
    { icon: <CheckSquare size={24} color="#10b981" />, label: "Mark Attendance", path: "/staff/attendance" },
    { icon: <Calendar size={24} color="#06b6d4" />, label: "Post Timetable", path: "/staff/timetable" },
    { icon: <Briefcase size={24} color="#8b5cf6" />, label: "Post Job Alert", path: "/staff/placements" },
    { icon: <Bell size={24} color="#f59e0b" />, label: "Send Alert", path: "/staff/alerts" },
    { icon: <MessageSquareWarning size={24} color="#ec4899" />, label: "View Complaints", path: "/staff/complaints" }
  ];

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <DateTimeHeader />
        
        {/* Top Header Bar with Class Logger CTA */}
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0 }}>Faculty Dashboard</h1>
            <p style={{ fontSize: 13, color: "#64748b", margin: "2px 0 0 0" }}>{userProfile?.name} • {userProfile?.dept} Department</p>
          </div>

          <button
            onClick={() => setIsLogModalOpen(true)}
            style={{
              padding: "10px 18px", borderRadius: 8, border: "none",
              background: "#2563eb", color: "#ffffff", fontWeight: 700, fontSize: 13,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
              boxShadow: "0 2px 6px rgba(37,99,235,0.2)"
            }}
          >
            <Plus size={16} /> Log Completed Class & Topic
          </button>
        </div>

        {/* Live Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/staff/gatepass")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <DoorOpen size={24} color="#3b82f6" />
            </div>
            <div className="stat-value" style={{ color: stats.pendingGatePasses > 0 ? "var(--danger)" : "var(--success)" }}>
              {loading ? "..." : stats.pendingGatePasses}
            </div>
            <div className="stat-label">Pending Gate Passes</div>
          </div>

          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/staff/attendance")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <CheckSquare size={24} color="#10b981" />
            </div>
            <div className="stat-value" style={{ color: stats.todayAttendanceMarked ? "var(--success)" : "var(--danger)" }}>
              {loading ? "..." : stats.todayAttendanceMarked ? "Done" : "Pending"}
            </div>
            <div className="stat-label">Today's Attendance</div>
          </div>

          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/staff/complaints")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <MessageSquareWarning size={24} color="#ec4899" />
            </div>
            <div className="stat-value" style={{ color: stats.openComplaints > 0 ? "var(--warning)" : "var(--success)" }}>
              {loading ? "..." : stats.openComplaints}
            </div>
            <div className="stat-label">Open Complaints</div>
          </div>

          <div className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Users size={24} color="#8b5cf6" />
            </div>
            <div className="stat-value">{loading ? "..." : stats.totalStudents}</div>
            <div className="stat-label">Total Students</div>
          </div>
        </div>

        {/* Attendance reminder */}
        {!loading && !stats.todayAttendanceMarked && (
          <div style={{ padding: "14px 20px", borderRadius: "var(--radius-md)", marginBottom: 24, background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <AlertTriangle size={20} color="var(--warning)" />
              <div style={{ color: "var(--warning)", fontWeight: 600 }}>Today's attendance not marked yet!</div>
            </div>
            <button className="btn-primary" onClick={() => navigate("/staff/attendance")} style={{ width: "auto", padding: "6px 16px", fontSize: 13 }}>
              Mark Now <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Student Directory */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 20, fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>Student Directory - {userProfile?.dept} Department</h3>
          {YEARS.map(year => {
            const yearStudents = students.filter(s => s.year === year);
            if (yearStudents.length === 0) return null;
            return (
              <div key={year} style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>{year} ({yearStudents.length} Students)</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {yearStudents.map(student => (
                    <div key={student.id} style={{
                      padding: 14,
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-color)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>{student.name}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{student.email}</div>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{student.year} • {student.registerNo || "N/A"}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {students.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>
              No students found in this department.
            </div>
          )}
        </div>

        {/* MY ALLOCATED SUBJECTS & CLASS SCHEDULE */}
        <div className="card" style={{ marginBottom: 28, padding: 22, background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: 0 }}>My Allocated Subjects & Classes</h3>
              <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>Assigned subjects across all departments</p>
            </div>
            <button onClick={() => setIsLogModalOpen(true)} style={{ padding: "6px 14px", borderRadius: 6, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> Log Topic & Attendance
            </button>
          </div>

          {assignedSubjects.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "#64748b", fontSize: 13 }}>
              No active subject allocations found. Contact your HOD to assign subjects.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {assignedSubjects.map(sub => (
                <div key={sub.id} style={{ padding: 14, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#1e40af" }}>{sub.subjectCode || sub.courseCode}</span>
                    <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#e0f2fe", color: "#0369a1", fontWeight: 700 }}>
                      {sub.department || sub.targetDept || sub.dept}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
                    {sub.subjectName || sub.courseName}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", display: "flex", gap: 10, fontWeight: 600 }}>
                    <span>Year: {sub.year}</span>
                    <span>•</span>
                    <span>Section: {sub.section || 'A'}</span>
                    {sub.semester && <span>• Sem {sub.semester}</span>}
                  </div>
                  <button onClick={() => setIsLogModalOpen(true)} style={{ marginTop: 10, width: "100%", padding: "6px 10px", borderRadius: 6, background: "#ffffff", border: "1px solid #cbd5e1", color: "#2563eb", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <BookOpen size={13} /> Complete Class & Log Topic
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RECENT COMPLETED CLASS LOGS FORWARDED TO HOD */}
        {recentLogs.length > 0 && (
          <div className="card" style={{ marginBottom: 28, padding: 22, background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 14 }}>My Recent Submitted Class Reports (Forwarded to HOD)</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: 10, textAlign: "left", color: "#475569", fontSize: 11, textTransform: "uppercase" }}>Date & Period</th>
                    <th style={{ padding: 10, textAlign: "left", color: "#475569", fontSize: 11, textTransform: "uppercase" }}>Subject</th>
                    <th style={{ padding: 10, textAlign: "left", color: "#475569", fontSize: 11, textTransform: "uppercase" }}>Dept & Class</th>
                    <th style={{ padding: 10, textAlign: "left", color: "#475569", fontSize: 11, textTransform: "uppercase" }}>Topic Covered</th>
                    <th style={{ padding: 10, textAlign: "left", color: "#475569", fontSize: 11, textTransform: "uppercase" }}>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 10, fontWeight: 600, color: "#0f172a" }}>
                        <div>{log.date}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{log.period}</div>
                      </td>
                      <td style={{ padding: 10, fontWeight: 700, color: "#1e40af" }}>
                        {log.subjectCode} - {log.subjectName}
                      </td>
                      <td style={{ padding: 10, color: "#334155" }}>
                        {log.targetDept} {log.year} Sec {log.section}
                      </td>
                      <td style={{ padding: 10, color: "#0f172a", fontWeight: 500, maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {log.topicCovered}
                      </td>
                      <td style={{ padding: 10 }}>
                        <span style={{ padding: "3px 8px", borderRadius: 4, background: "#ecfdf5", color: "#047857", fontWeight: 700, fontSize: 11 }}>
                          {log.presentCount}/{log.totalStudents} ({log.attendancePercentage})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="card" style={{ marginBottom: 24, padding: 22, background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
          <h3 style={{ marginBottom: 20, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Quick Actions</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 14 }}>
            {quickActions.map((action, idx) => (
              <div key={idx} onClick={() => action.onClick ? action.onClick() : navigate(action.path)} style={{
                padding: "18px 14px", 
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                cursor: "pointer", 
                textAlign: "center", 
                transition: "all 0.2s ease"
              }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>{action.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{action.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CLASS LOG MODAL */}
        <ClassLogModal
          isOpen={isLogModalOpen}
          onClose={() => setIsLogModalOpen(false)}
          onSuccess={fetchStats}
        />

      </main>
    </div>
  );
}