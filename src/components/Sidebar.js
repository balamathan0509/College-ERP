// src/components/Sidebar.js
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
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
  Lock,
  Grid,
  ArrowLeftRight
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
  { icon: <FileText size={18} />, label: "Question Papers", path: "/student/question-papers" },
  { icon: <BookOpen size={18} />, label: "Question Bank", path: "/student/question-bank" },
  { icon: <Grid size={18} />, label: "Exam Seating Plan", path: "/student/seating-arrangement" }
];

const staffNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/staff" },
  { icon: <Calendar size={18} />, label: "My Timetable", path: "/staff/timetable" },
  { 
    icon: <BookOpen size={18} />, 
    label: "Logbook", 
    isSubmenu: true,
    children: [
      { label: "Period Attendance", path: "/staff/period-attendance" },
      { label: "Hour Alteration", path: "/staff/hour-alteration" },
      { label: "Classwork Logbook", path: "/staff/classwork-record" },
      { label: "Course Contents & Plan", path: "/academics/lms/course-contents" },
      { label: "Plan Completion", path: "/academics/lms/plan-completion" },
      { label: "Plan Feedback", path: "/academics/lms/plan-feedback" },
      { label: "Assignments", path: "/academics/lms/assignments" },
      { label: "Mark Attendance", path: "/academics/lms/mark-attendance" },
      { label: "Academic Activities", path: "/academics/lms/academic-activities" },
      { label: "Research Repository", path: "/academics/lms/research-repository" },
      { label: "Self Appraisal", path: "/academics/lms/self-appraisal" },
      { label: "Faculty Participation", path: "/academics/lms/faculty-participation" }
    ]
  },
  { icon: <DoorOpen size={18} />, label: "Gate Pass", path: "/staff/gatepass" },
  { icon: <ClipboardList size={18} />, label: "Leave", path: "/staff/leave" },
  { icon: <CheckSquare size={18} />, label: "Class Incharge Att.", path: "/staff/attendance" },
  { icon: <BookOpen size={18} />, label: "Class Question Banks", path: "/cia/class-question-banks" },
  { icon: <Award size={18} />, label: "Results", path: "/staff/results" },
  { icon: <Briefcase size={18} />, label: "Placements", path: "/staff/placements" },
  { icon: <Bell size={18} />, label: "Alerts", path: "/staff/alerts" },
  { icon: <MessageSquareWarning size={18} />, label: "Complaints", path: "/staff/complaints" },
  { icon: <AlertOctagon size={18} />, label: "Fines", path: "/staff/fines" },
  { 
    icon: <FileText size={18} />, 
    label: "CIA", 
    isSubmenu: true,
    children: [
      { label: "Question Bank", path: "/cia/question-bank" },
      { label: "Class Question Banks", path: "/cia/class-question-banks" },
      { label: "My Question Papers", path: "/cia/my-papers" },
      { label: "Question Paper", path: "/cia/question-paper" },
      { label: "Exam Seating Plan", path: "/cia/seating-arrangement" },
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
      { label: "Academic Calendar", path: "/academics/academic-calendar" },
      { label: "Course Allocation", path: "/academics/course-allocation" },
      { label: "My Subjects", path: "/staff/my-subjects" },
      { label: "Course Enrollment", path: "/academics/course-enrollment" },
      { label: "Faculty Profile", path: "/academics/faculty-profile" },
      { label: "Academic Reports", path: "/academics/reports" }
    ]
  }
];

const examCellNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/exam_cell" },
  { 
    icon: <FileText size={18} />, 
    label: "CIA", 
    isSubmenu: true,
    children: [
      { label: "Exam Creation", path: "/cia/exam-creation" },
      { label: "Schedule Examination", path: "/cia/schedule" },
      { label: "Seating Arrangement", path: "/cia/seating-arrangement" },
      { label: "CIA Mark Attendance", path: "/cia/attendance" }
    ]
  }
];

const deptAdminNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/dept-admin" },
  { icon: <Users size={18} />, label: "New Student Add", path: "/dept_admin/new-admission" },
  { icon: <Calendar size={18} />, label: "My Timetable", path: "/staff/timetable" },
  { icon: <Calendar size={18} />, label: "Timetable Management", path: "/dept-admin/timetable" }
];

const hodNav = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/hod" },
  { icon: <Calendar size={18} />, label: "Class Timetables", path: "/hod/timetable" },
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
      { label: "Academic Calendar", path: "/academics/academic-calendar" },
      { label: "Timetable Management", path: "/hod/timetable" },
      { label: "New Student Add", path: "/dept_admin/new-admission" },
      { label: "Promote Student", path: "/config/general/promote-student" },
      { label: "Coordinator Management", path: "/hod/coordinators" },
      { label: "Student Details", path: "/config/general/student" },
      { label: "Staff Details", path: "/config/general/faculty" },
      { label: "Course Allocation", path: "/academics/course-allocation" },
      { label: "Class Incharge", path: "/hod/class-incharge" },
      { label: "Attendance Monitor", path: "/hod/attendance" },
      { label: "Period Attendance", path: "/staff/period-attendance" },
      { label: "Classwork Logbook", path: "/staff/classwork-record" },
      { label: "Hour Alterations", path: "/staff/hour-alteration" },
      { label: "Reports", path: "/academics/reports" }
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

const EXPANDED_MENUS_STORAGE_KEY = "erp_sidebar_expanded_menus";

const getSavedExpandedMenus = () => {
  try {
    const raw = sessionStorage.getItem(EXPANDED_MENUS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

const saveExpandedMenus = (state) => {
  try {
    sessionStorage.setItem(EXPANDED_MENUS_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
};

const detectActiveMenus = (pathname, navList = []) => {
  const active = {};
  if (!pathname) return active;

  const checkItem = (item) => {
    if (!item?.isSubmenu || !Array.isArray(item.children)) return;
    for (const child of item.children) {
      if (child.isNestedSubmenu && Array.isArray(child.children)) {
        for (const subchild of child.children) {
          if (subchild.path && (pathname === subchild.path || (subchild.path !== '/' && pathname.startsWith(subchild.path)))) {
            active[item.label] = true;
            active[child.label] = true;
          }
        }
      } else if (child.path && (pathname === child.path || (child.path !== '/' && pathname.startsWith(child.path)))) {
        active[item.label] = true;
      }
    }
  };

  if (Array.isArray(navList)) {
    navList.forEach(checkItem);
  }

  [studentNav, staffNav, examCellNav, deptAdminNav, hodNav, wardenNav, officestaffNav, managementNav, securityNav, principalNav, adminNav].forEach(list => {
    if (Array.isArray(list)) list.forEach(checkItem);
  });

  // Direct route-based fallbacks
  if (pathname.startsWith('/cia/')) active.CIA = true;
  if (pathname.startsWith('/academics/') && !pathname.startsWith('/academics/lms/')) active.Academics = true;
  if (pathname === '/staff/my-subjects' || pathname === '/staff/timetable') active.Academics = true;
  if (pathname.startsWith('/hod/attendance') || pathname.startsWith('/reports/daily-attendance') || pathname.startsWith('/hod/class-incharge')) active.Attendance = true;
  if (pathname.startsWith('/config/')) {
    active.Configuration = true;
    if (pathname.startsWith('/config/general/')) active['General Configuration'] = true;
    if (pathname.startsWith('/config/cia/')) active['CIA Configuration'] = true;
  }
  if (
    pathname.startsWith('/staff/period-attendance') ||
    pathname.startsWith('/staff/hour-alteration') ||
    pathname.startsWith('/staff/classwork-record') ||
    pathname.startsWith('/academics/lms/') ||
    pathname.startsWith('/Academics/lms/')
  ) {
    active.Logbook = true;
  }

  return active;
};

export default function Sidebar() {
  const { userProfile, logout, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const desktopSidebarRef = React.useRef(null);

  const [expandedMenus, setExpandedMenus] = useState(() => {
    const saved = getSavedExpandedMenus();
    const autoActive = detectActiveMenus(window.location.pathname);
    return { ...saved, ...autoActive };
  });
  const [reviewCount, setReviewCount] = useState(0);
  const [isClassIncharge, setIsClassIncharge] = useState(false);

  const toggleMenu = (label) => {
    setExpandedMenus(prev => {
      const next = { ...prev, [label]: !prev[label] };
      saveExpandedMenus(next);
      return next;
    });
  };

  const role = userProfile?.role;

  useEffect(() => {
    if (!role) return;
    import('../supabase/supabaseAdapter').then(({ collection, query, onSnapshot, getDocs, where, db }) => {
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
      if (role === 'staff' && userProfile?.uid) {
        const q = query(collection(db, "class_incharges"), where("facultyId", "==", userProfile.uid));
        getDocs(q).then(snap => {
          setIsClassIncharge(!snap.empty);
        });
      }
    });
  }, [role, userProfile]);

  const isDeptAdmin = role === "dept_admin" || role === "hod" || isSuperAdmin || userProfile?.isDeptAdmin === true;

  // Filter Academics submenu:
  // Regular staff get only what they need: Academic Calendar, My Subjects, Faculty Profile
  // Department Admin (dept_admin / HOD / SuperAdmin) gets everything: Course Allocation, Course Enrollment, Academic Reports, etc.
  const academicsChildren = [
    { label: "Academic Calendar", path: "/academics/academic-calendar" },
    ...(isDeptAdmin ? [{ label: "Course Allocation", path: "/academics/course-allocation" }] : []),
    { label: "My Subjects", path: "/staff/my-subjects" },
    { label: "My Timetable", path: "/staff/timetable" },
    ...(isDeptAdmin ? [{ label: "Course Enrollment", path: "/academics/course-enrollment" }] : []),
    { label: "Faculty Profile", path: "/academics/faculty-profile" },
    ...(isDeptAdmin ? [{ label: "Academic Reports", path: "/academics/reports" }] : [])
  ];

  const tailoredStaffNav = staffNav.map(item => {
    if (item.label === "Academics") {
      return { ...item, children: academicsChildren };
    }
    return item;
  });

  let navItems =
    isSuperAdmin ? adminNav :
    role === "student" ? studentNav :
    role === "exam_cell" ? examCellNav :
    role === "staff" ? [...tailoredStaffNav] :
    role === "hod" ? hodNav :
    role === "dept_admin" ? [
      ...tailoredStaffNav.slice(0, 1),
      { icon: <Users size={18} />, label: "New Student Add", path: "/dept_admin/new-admission" },
      { icon: <GraduationCap size={18} />, label: "Promote Student", path: "/config/general/promote-student" },
      ...tailoredStaffNav.slice(1),
      { icon: <Calendar size={18} />, label: "Manage Timetables", path: "/staff/manage-timetable" }
    ] :
    role === "warden" ? wardenNav :
    role === "officestaff" ? officestaffNav :
    role === "security" ? securityNav :
    role === "management" ? managementNav :
    role === "principal" ? principalNav : [];

  if ((role === "staff" || role === "dept_admin") && isClassIncharge) {
    // Insert "Student Details" right after Dashboard (index 1)
    if (!navItems.some(i => i.path === "/staff/students")) {
      navItems.splice(1, 0, { icon: <Users size={18} />, label: "Student Details", path: "/staff/students" });
    }
  }

  // Ensure that if the current route belongs to any submenu, that submenu is expanded and saved
  useEffect(() => {
    const autoActive = detectActiveMenus(location.pathname, navItems);
    if (Object.keys(autoActive).length > 0) {
      setExpandedMenus(prev => {
        const next = { ...prev, ...autoActive };
        saveExpandedMenus(next);
        return next;
      });
    }
  }, [location.pathname, navItems]);

  // Restore sidebar scroll position across navigations
  useEffect(() => {
    if (desktopSidebarRef.current) {
      const savedScroll = sessionStorage.getItem("erp_sidebar_scroll_pos");
      if (savedScroll !== null) {
        desktopSidebarRef.current.scrollTop = Number(savedScroll);
      }
    }
  }, [location.pathname]);

  const handleSidebarScroll = (e) => {
    try {
      sessionStorage.setItem("erp_sidebar_scroll_pos", e.currentTarget.scrollTop);
    } catch (err) {}
  };

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
        <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>RENGANAYAGI VARATHARAJ<br/><span style={{fontSize: 10, opacity: 0.8}}>COLLEGE OF ENGINEERING</span></h2>
      </div>

      <div className="sidebar-nav-header">CONFIGURATION</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isItemActive = (!item.isSubmenu && location.pathname === item.path) ||
            (item.isSubmenu && (
              location.pathname.startsWith(`/${item.label.toLowerCase()}/`) ||
              item.children?.some(c => c.path === location.pathname || (c.isNestedSubmenu && c.children?.some(sc => sc.path === location.pathname)))
            ));

          return (
            <React.Fragment key={item.label}>
              <div
                className={`nav-item ${isItemActive ? "active" : ""}`}
                onClick={() => {
                  if (item.isSubmenu) {
                    toggleMenu(item.label);
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
                          onClick={(e) => { e.stopPropagation(); toggleMenu(child.label); }}
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
          );
        })}
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
            className="hamburger-btn-header"
            aria-label="Open menu"
          >
            <Menu size={20} color="#0f172a" />
          </button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative' }}>
          
          <div 
            className="header-user-profile" 
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <div className="header-user-avatar" style={{ background: "#1e3a8a", color: "white", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
              {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : <User size={16} />}
            </div>
            <div className="header-user-info" style={{ display: "flex", flexDirection: "column" }}>
              <span className="name" style={{ fontWeight: "bold", fontSize: "14px" }}>{userProfile?.name || 'RVCE User'}</span>
              <span className="role" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {role === 'dept_admin' ? `${userProfile?.dept || ''} ADMIN`.trim() : role?.toUpperCase()}
              </span>
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
      <div
        className="sidebar sidebar-desktop"
        ref={desktopSidebarRef}
        onScroll={handleSidebarScroll}
      >
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
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMobileOpen(false)}
            style={{
              position: "absolute",
              top: 18,
              right: 14,
              zIndex: 10,
              background: "rgba(0,0,0,0.15)",
              border: "none",
              borderRadius: "50%",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#0f172a"
            }}
            title="Close menu"
          >
            <X size={16} />
          </button>
          {sidebarContent}
        </div>
      </div>
    </>
  );
}
