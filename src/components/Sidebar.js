// src/components/Sidebar.js
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  DoorOpen,
  ClipboardList,
  CheckSquare,
  CreditCard,
  Calendar,
  Briefcase,
  Bell,
  MessageSquareWarning,
  AlertOctagon,
  User,
  ShieldCheck,
  Building2,
  Utensils,
  Users,
  PieChart,
  Clock,
  GraduationCap,
  MapPin,
  LogOut,
  Award,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  BookOpen,
  HelpCircle,
  Lock
} from "lucide-react";

const studentNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/student" },
  { icon: <DoorOpen size={18} />, label: "Gate Pass", path: "/student/gatepass" },
  { icon: <ClipboardList size={18} />, label: "Leave", path: "/student/leave" },
  { icon: <CheckSquare size={18} />, label: "Attendance", path: "/student/attendance" },
  { icon: <CreditCard size={18} />, label: "Fees", path: "/student/fees" },
  { icon: <Calendar size={18} />, label: "Timetable", path: "/student/timetable" },
  { icon: <Briefcase size={18} />, label: "Placements", path: "/student/placements" },
  { icon: <Bell size={18} />, label: "Alerts", path: "/student/alerts" },
  { icon: <MessageSquareWarning size={18} />, label: "Complaints", path: "/student/complaints" },
  { icon: <AlertOctagon size={18} />, label: "Fines", path: "/student/fines" },
  { icon: <FileText size={18} />, label: "Question Papers", path: "/student/question-papers" }
];

const staffNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/staff" },

  { icon: <DoorOpen size={18} />, label: "Gate Pass", path: "/staff/gatepass" },
  { icon: <ClipboardList size={18} />, label: "Leave", path: "/staff/leave" },
  { icon: <CheckSquare size={18} />, label: "Attendance", path: "/staff/attendance" },
  { icon: <Award size={18} />, label: "Results", path: "/staff/results" },
  { icon: <Calendar size={18} />, label: "Timetable", path: "/staff/timetable" },
  { icon: <Briefcase size={18} />, label: "Placements", path: "/staff/placements" },
  { icon: <Bell size={18} />, label: "Alerts", path: "/staff/alerts" },
  { icon: <MessageSquareWarning size={18} />, label: "Complaints", path: "/staff/complaints" },
  { icon: <AlertOctagon size={18} />, label: "Fines", path: "/staff/fines" },
  { 
    icon: <FileText size={18} />, 
    label: "CIA", 
    isSubmenu: true,
    children: [
      { label: "Exam Creation", path: "/cia/exam-creation" },
      { label: "Schedule Examination", path: "/cia/schedule" },
      { label: "Question Bank", path: "/cia/question-bank" },
      { label: "My Question Papers", path: "/cia/my-papers" },
      { label: "Question Paper", path: "/cia/question-paper" },
      { label: "CIA Mark Attendance", path: "/cia/attendance" },
      { label: "Mark Entry Process", path: "/cia/mark-entry" },
      { label: "Other Mark Entry Process", path: "/cia/other-mark-entry" },
      { label: "ESE Mark Entry Process", path: "/cia/ese-mark-entry" },
      { label: "Result Analysis", path: "/cia/result-analysis" },
      { label: "CIA Attendance Report", path: "/cia/attendance-report" },
      { label: "Reports", path: "/cia/reports" }
    ]
  },
  { 
    icon: <BookOpen size={18} />, 
    label: "Academics", 
    isSubmenu: true,
    children: [
      { label: "Course Allocation", path: "/academics/course-allocation" },
      { label: "My Subjects", path: "/staff/my-subjects" },
      { label: "Course Enrollment", path: "/academics/course-enrollment" },
      { label: "Timetable Config", path: "/academics/timetable-config" },
      { label: "View Timetable", path: "/academics/view-timetable" },
      { label: "Faculty Profile", path: "/academics/faculty-profile" },
      { label: "Academic Reports", path: "/academics/reports" },
      { 
        label: "LMS",
        isNestedSubmenu: true,
        children: [
          { label: "Course Contents & Plan", path: "/academics/lms/course-contents" },
          { label: "Faculty Timetable", path: "/academics/lms/faculty-timetable" },
          { label: "Plan Completion", path: "/academics/lms/plan-completion" },
          { label: "Plan Feedback", path: "/academics/lms/plan-feedback" },
          { label: "Assignments", path: "/academics/lms/assignments" },
          { label: "Mark Attendance", path: "/academics/lms/mark-attendance" },
          { label: "Academic Activities", path: "/academics/lms/academic-activities" },
          { label: "Research Repository", path: "/academics/lms/research-repository" },
          { label: "Self Appraisal", path: "/academics/lms/self-appraisal" },
          { label: "Faculty Participation", path: "/academics/lms/faculty-participation" }
        ]
      }
    ]
  }
];

const hodNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/hod" },
  { icon: <ClipboardList size={18} />, label: "Leave", path: "/hod/leave" },
  { icon: <Award size={18} />, label: "Results", path: "/hod/results" },
  { icon: <Briefcase size={18} />, label: "Placements", path: "/hod/placements" },
  { icon: <Bell size={18} />, label: "Alerts", path: "/hod/alerts" },
  { icon: <AlertOctagon size={18} />, label: "Verify Fines", path: "/hod/fines" },
  { icon: <FileText size={18} />, label: "QP Review", path: "/hod/cia/question-papers", isReview: true },
  { 
    icon: <BookOpen size={18} />, 
    label: "Department", 
    isSubmenu: true,
    children: [
      { label: "Student Details", path: "/config/general/student" },
      { label: "Staff Details", path: "/config/general/faculty" },
      { label: "Subject Allocation", path: "/hod/subject-allocation" },
      { label: "Class Incharge", path: "/hod/class-incharge" },
      { label: "Attendance Monitor", path: "/hod/attendance" },
      { label: "Timetable", path: "/hod/timetable" },
      { label: "Reports", path: "/academics/reports" },
      {
        label: "CIA Configuration",
        isNestedSubmenu: true,
        children: [
          { label: "Question Format", path: "/config/cia/question-format" },
          { label: "Types and Evaluation", path: "/config/cia/types-evaluation" },
          { label: "Evaluation Pattern", path: "/config/cia/evaluation-pattern" },
          { label: "Show Evaluation Pattern", path: "/config/cia/show-evaluation-pattern" },
          { label: "Pattern Mapping", path: "/config/cia/pattern-mapping" }
        ]
      }
    ]
  },
  { 
    icon: <BookOpen size={18} />, 
    label: "LMS", 
    isSubmenu: true,
    children: [
      { label: "Plan Feedback", path: "/academics/lms/plan-feedback" }
    ]
  }
];

const wardenNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/warden" },
  { icon: <DoorOpen size={18} />, label: "Gate Pass Records", path: "/warden/gatepass" },
  { icon: <Users size={18} />, label: "Student Details", path: "/warden/students" },
  { icon: <CheckSquare size={18} />, label: "Attendance", path: "/warden/attendance" },
  { icon: <Bell size={18} />, label: "Alerts", path: "/warden/alerts" }
];

const officestaffNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/officestaff" },
  { icon: <CreditCard size={18} />, label: "Fees Collection", path: "/officestaff/fees" },
  { icon: <PieChart size={18} />, label: "Fees Overview", path: "/officestaff/overview" },
  { icon: <Bell size={18} />, label: "Fees Alerts", path: "/officestaff/alerts" },
  { icon: <Clock size={18} />, label: "Verify Fees", path: "/officestaff/verify-fees" },
  {
    icon: <LayoutDashboard size={18} />,
    label: "Configuration",
    isSubmenu: true,
    children: [
      {
        label: "General Configuration",
        isNestedSubmenu: true,
        children: [
          { label: "Programme", path: "/config/general/programme" },
          { label: "Upload Courses", path: "/config/general/upload-courses" },
          { label: "Regulation Mapping", path: "/config/general/regulation-mapping" },
          { label: "Student Details", path: "/config/general/student" },
          { label: "Faculty Details", path: "/config/general/faculty" },
          { label: "Promote Student", path: "/config/general/promote-student" },
          { label: "Pass Out Students", path: "/config/general/pass-out-students" }
        ]
      },
      {
        label: "CIA Configuration",
        isNestedSubmenu: true,
        children: [
          { label: "Question Format", path: "/config/cia/question-format" },
          { label: "Types and Evaluation", path: "/config/cia/types-evaluation" },
          { label: "Evaluation Pattern", path: "/config/cia/evaluation-pattern" },
          { label: "Show Evaluation Pattern", path: "/config/cia/show-evaluation-pattern" },
          { label: "Pattern Mapping", path: "/config/cia/pattern-mapping" }
        ]
      }
    ]
  }
];

const managementNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/management" },
  { icon: <DoorOpen size={18} />, label: "Gate Passes", path: "/management/gatepass" },
  { icon: <CheckSquare size={18} />, label: "Attendance", path: "/management/attendance" },
  { icon: <CreditCard size={18} />, label: "Fees", path: "/management/fees" },
  { icon: <Utensils size={18} />, label: "Mess", path: "/management/mess" },
  { icon: <Building2 size={18} />, label: "Hostel", path: "/management/hostel" },
  { icon: <Bell size={18} />, label: "Alerts", path: "/management/alerts" },
  { icon: <MessageSquareWarning size={18} />, label: "Complaints", path: "/management/complaints" },
  { icon: <MapPin size={18} />, label: "Campus Map", path: "/campus-map" },
  {
    icon: <LayoutDashboard size={18} />,
    label: "Configuration",
    isSubmenu: true,
    children: [
      {
        label: "General Configuration",
        isNestedSubmenu: true,
        children: [
          { label: "Programme", path: "/config/general/programme" },
          { label: "Upload Courses", path: "/config/general/upload-courses" },
          { label: "Regulation Mapping", path: "/config/general/regulation-mapping" },
          { label: "Student Details", path: "/config/general/student" },
          { label: "Faculty Details", path: "/config/general/faculty" },
          { label: "Promote Student", path: "/config/general/promote-student" },
          { label: "Pass Out Students", path: "/config/general/pass-out-students" }
        ]
      },
      {
        label: "CIA Configuration",
        isNestedSubmenu: true,
        children: [
          { label: "Question Format", path: "/config/cia/question-format" },
          { label: "Types and Evaluation", path: "/config/cia/types-evaluation" },
          { label: "Evaluation Pattern", path: "/config/cia/evaluation-pattern" },
          { label: "Show Evaluation Pattern", path: "/config/cia/show-evaluation-pattern" },
          { label: "Pattern Mapping", path: "/config/cia/pattern-mapping" }
        ]
      }
    ]
  }
];

const securityNav = [
  { icon: <ShieldCheck size={18} />, label: "Verify Gate Pass", path: "/security/verify" }
];

const principalNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/principal" },
  { icon: <DoorOpen size={18} />, label: "Gate Pass", path: "/principal/gatepass" },
  { icon: <ClipboardList size={18} />, label: "Leave Requests", path: "/principal/leave" },
  { icon: <Bell size={18} />, label: "Circulars", path: "/principal/alerts" },
  { icon: <FileText size={18} />, label: "CIA Approvals", path: "/principal/cia/question-papers", isReview: true }
];

const adminNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/admin" },
  { icon: <CheckSquare size={18} />, label: "Attendance", path: "/hod/attendance" },
  { icon: <Users size={18} />, label: "Class Incharge", path: "/hod/class-incharge" },
  { icon: <LayoutDashboard size={18} />, label: "Attendance Overview", path: "/hod/attendance-overview" },
  { icon: <FileText size={18} />, label: "Attendance Reports", path: "/reports/daily-attendance" },
  {
    icon: <LayoutDashboard size={18} />,
    label: "Configuration",
    isSubmenu: true,
    children: [
      {
        label: "General Configuration",
        isNestedSubmenu: true,
        children: [
          { label: "Programme", path: "/config/general/programme" },
          { label: "Upload Courses", path: "/config/general/upload-courses" },
          { label: "Regulation Mapping", path: "/config/general/regulation-mapping" },
          { label: "Student Details", path: "/config/general/student" },
          { label: "Faculty Details", path: "/config/general/faculty" },
          { label: "Promote Student", path: "/config/general/promote-student" },
          { label: "Pass Out Students", path: "/config/general/pass-out-students" }
        ]
      },
      {
        label: "CIA Configuration",
        isNestedSubmenu: true,
        children: [
          { label: "Question Format", path: "/config/cia/question-format" },
          { label: "Types and Evaluation", path: "/config/cia/types-evaluation" },
          { label: "Evaluation Pattern", path: "/config/cia/evaluation-pattern" },
          { label: "Show Evaluation Pattern", path: "/config/cia/show-evaluation-pattern" },
          { label: "Pattern Mapping", path: "/config/cia/pattern-mapping" }
        ]
      }
    ]
  }
];

export default function Sidebar() {
  const { userProfile, logout, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState(() => {
    const state = {};
    const path = window.location.pathname;
    if (path.startsWith('/cia/')) state.CIA = true;
    if (path.startsWith('/academics/')) state.Academics = true;
    if (path.startsWith('/academics/lms/')) state.LMS = true;
    if (path.startsWith('/Academics/lms/')) state.LMS = true;
    if (path.startsWith('/hod/attendance') || path.startsWith('/reports/daily-attendance') || path.startsWith('/hod/class-incharge')) state.Attendance = true;
    if (path.startsWith('/config/')) {
      state.Configuration = true;
      if (path.startsWith('/config/general/')) state['General Configuration'] = true;
      if (path.startsWith('/config/cia/')) state['CIA Configuration'] = true;
    }
    return state;
  });
  const [reviewCount, setReviewCount] = useState(0);

  const role = userProfile?.role;

  // Keep submenus expanded when navigating between their child routes
  useEffect(() => {
    const path = location.pathname;
    setExpandedMenus(prev => {
      const next = { ...prev };
      if (path.startsWith('/cia/')) next.CIA = true;
      if (path.startsWith('/academics/')) next.Academics = true;
      if (path.startsWith('/academics/lms/')) next.LMS = true;
      if (path.startsWith('/academics/lms/')) next.LMS = true;
      if (path.startsWith('/hod/attendance') || path.startsWith('/reports/daily-attendance') || path.startsWith('/hod/class-incharge')) next.Attendance = true;
      if (path.startsWith('/config/')) {
        next.Configuration = true;
        if (path.startsWith('/config/general/')) next['General Configuration'] = true;
        if (path.startsWith('/config/cia/')) next['CIA Configuration'] = true;
      }
      return next;
    });
  }, [location.pathname]);

  useEffect(() => {
    if (!role) return;
    import('firebase/firestore').then(({ collection, query, onSnapshot, where }) => {
      import('../firebase/config').then(({ db }) => {
        if (role === 'hod') {
          const q = query(collection(db, "cia_question_papers"), where("status", "in", ["SUBMITTED_TO_HOD", "RETURNED_TO_HOD"]));
          const unsub = onSnapshot(q, snap => setReviewCount(snap.docs.length));
          return () => unsub();
        }
        if (role === 'principal') {
          const q = query(collection(db, "cia_question_papers"), where("status", "==", "SUBMITTED_TO_PRINCIPAL"));
          const unsub = onSnapshot(q, snap => setReviewCount(snap.docs.length));
          return () => unsub();
        }
      });
    });
  }, [role]);

  const navItems =
    isSuperAdmin ? adminNav :
    role === "student" ? studentNav :
    role === "staff" ? staffNav :
    role === "hod" ? hodNav :
    role === "warden" ? wardenNav :
    role === "officestaff" ? officestaffNav :
    role === "security" ? securityNav :
    role === "management" ? managementNav :
    role === "principal" ? principalNav : [];

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  function handleNavClick(path) {
    navigate(path);
    setMobileOpen(false);
  }

  const roleColors = {
    student: "#3b82f6",
    staff: "#10b981",
    hod: "#6366f1",
    warden: "#0284c7",
    officestaff: "#06b6d4",
    security: "#f59e0b",
    management: "#8b5cf6",
    principal: "#ec4899",
    admin: "#ef4444"
  };
  const color = isSuperAdmin ? "#ef4444" : (roleColors[role] || "#3b82f6");

  const sidebarContent = (
    <>
      <div className="sidebar-logo-area">
        <h2 style={{ fontFamily: 'Poppins, sans-serif' }}>RENGANAYAGI VARATHARAJ<br/><span style={{fontSize: 10, opacity: 0.8}}>COLLEGE OF ENGINEERING</span></h2>
      </div>

      <div className="sidebar-nav-header">CONFIGURATION</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <React.Fragment key={item.label}>
            <div
              className={`nav-item ${(!item.isSubmenu && location.pathname === item.path) || (item.isSubmenu && location.pathname.startsWith(`/${item.label.toLowerCase()}/`)) ? "active" : ""}`}
              onClick={() => {
                if (item.isSubmenu) {
                  setExpandedMenus(prev => ({ ...prev, [item.label]: !prev[item.label] }));
                } else {
                  handleNavClick(item.path);
                }
              }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="nav-icon">{item.icon}</span>
                <span>
                  {item.label}
                  {item.isReview && reviewCount > 0 && (
                    <span style={{ marginLeft: 8, background: '#ef4444', color: '#fff', fontSize: 11, padding: '2px 6px', borderRadius: 10, fontWeight: 'bold' }}>
                      {reviewCount}
                    </span>
                  )}
                </span>
              </div>
              {item.isSubmenu && (
                <span style={{ display: "flex", alignItems: "center" }}>
                  {expandedMenus[item.label] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              )}
            </div>
            
            {item.isSubmenu && expandedMenus[item.label] && (
              <div className="submenu" style={{ marginLeft: "15px", paddingLeft: "15px", borderLeft: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: "2px" }}>
                {item.children.map((child, idx) => (
                  <React.Fragment key={child.path || child.label}>
                    {child.isNestedSubmenu ? (
                      <>
                        <div
                          className="nav-item"
                          onClick={(e) => { e.stopPropagation(); setExpandedMenus(prev => ({ ...prev, [child.label]: !prev[child.label] })); }}
                          style={{ padding: "8px 12px", fontSize: "13px", minHeight: "35px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--accent)", fontWeight: "bold" }}
                        >
                          <span>{child.label}</span>
                          {expandedMenus[child.label] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                        {expandedMenus[child.label] && (
                          <div style={{ marginLeft: "10px", paddingLeft: "10px", borderLeft: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: "2px" }}>
                            {child.children.map(subchild => (
                              <div
                                key={subchild.path}
                                className={`nav-item ${location.pathname === subchild.path ? "active" : ""}`}
                                onClick={(e) => { e.stopPropagation(); handleNavClick(subchild.path); }}
                                style={{ padding: "8px 12px", fontSize: "12px", minHeight: "35px" }}
                              >
                                {subchild.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div
                        className={`nav-item ${location.pathname === child.path ? "active" : ""}`}
                        onClick={() => handleNavClick(child.path)}
                        style={{ padding: "8px 12px", fontSize: "13px", minHeight: "35px" }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          {child.label}
                          {child.isReview && reviewCount > 0 && (
                            <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, padding: '2px 5px', borderRadius: 8, fontWeight: 'bold' }}>
                              {reviewCount}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </React.Fragment>
        ))}
      </nav>


    </>
  );

  return (
    <>
      {/* Top Header */}
      <div className="top-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => setMobileOpen(true)}
            style={{
              display: "none",
              background: "transparent",
              border: "none",
              color: "var(--text)",
              cursor: "pointer",
              padding: 4,
              marginRight: 15
            }}
            className="hamburger-btn-header"
          >
            <div style={{ width: 20, height: 2, background: "var(--text-dark)", margin: "4px 0" }}></div>
            <div style={{ width: 20, height: 2, background: "var(--text-dark)", margin: "4px 0" }}></div>
            <div style={{ width: 20, height: 2, background: "var(--text-dark)", margin: "4px 0" }}></div>
          </button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative' }}>
          
          <div 
            className="header-user-profile" 
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <div className="header-user-avatar">
              {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : <User size={16} />}
            </div>
            <div className="header-user-info">
              <span className="name">RVCE</span>
              <span className="role">{userProfile?.name || role?.toUpperCase()}</span>
            </div>
          </div>
          
          {profileDropdownOpen && (
            <>
              <div 
                style={{ position: 'fixed', inset: 0, zIndex: 999 }} 
                onClick={() => setProfileDropdownOpen(false)}
              />
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '10px',
                background: '#fff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                borderRadius: '8px',
                width: '220px',
                padding: '8px 0',
                zIndex: 1000,
                color: '#333',
                border: '1px solid #eaeaea',
                fontFamily: 'sans-serif'
              }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                  Welcome {userProfile?.name?.toUpperCase() || role?.toUpperCase()}!
                </div>
                <div 
                  onClick={() => { setProfileDropdownOpen(false); handleNavClick(isSuperAdmin ? "/admin/profile" : `/${role}/profile`); }}
                  style={{ padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#444' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9f9f9'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <User size={16} color="#6b7280" /> Profile
                </div>
                <div 
                  onClick={() => { setProfileDropdownOpen(false); handleNavClick(isSuperAdmin ? "/admin/help" : `/${role}/help`); }}
                  style={{ padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#444', borderBottom: '1px solid #f0f0f0', paddingBottom: '12px', marginBottom: '4px' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9f9f9'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <HelpCircle size={16} color="#6b7280" /> Help
                </div>
                <div 
                  onClick={() => { setProfileDropdownOpen(false); handleLogout(); }}
                  style={{ padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#444' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9f9f9'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOut size={16} color="#6b7280" /> Logout
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hamburger Button — mobile only */}
      <button
        className="hamburger-btn"
        onClick={() => setMobileOpen(true)}
        style={{
          display: "none",
          position: "fixed",
          top: 16,
          left: 16,
          zIndex: 1001,
          background: color,
          border: "none",
          borderRadius: 10,
          width: 42,
          height: 42,
          cursor: "pointer",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
        }}
      >
        <div style={{ width: 18, height: 2, background: "white", borderRadius: 2 }}></div>
        <div style={{ width: 18, height: 2, background: "white", borderRadius: 2 }}></div>
        <div style={{ width: 18, height: 2, background: "white", borderRadius: 2 }}></div>
      </button>

      {/* Overlay — mobile only */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1002,
            display: "none"
          }}
          className="sidebar-overlay"
        />
      )}

      {/* Desktop Sidebar */}
      <div className="sidebar sidebar-desktop">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar */}
      <div
        className={`sidebar sidebar-mobile ${mobileOpen ? "open" : ""}`}
        style={{
          position: "fixed",
          top: 0, left: 0,
          height: "100vh",
          zIndex: 1003,
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s ease"
        }}
      >
        {sidebarContent}
      </div>
    </>
  );
}
