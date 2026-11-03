// src/App.js
import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import "./styles/global.css";

const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard"));
const StaffDashboard = lazy(() => import("./pages/staff/StaffDashboard"));
const HodDashboard = lazy(() => import("./pages/hod/HodDashboard"));
const StudentGatePass = lazy(() => import("./pages/student/GatePass"));
const StaffGatePass = lazy(() => import("./pages/staff/GatePass"));
const HodGatePass = lazy(() => import("./pages/hod/GatePass"));
const StudentLeave = lazy(() => import("./pages/student/Leave"));
const StaffLeave = lazy(() => import("./pages/staff/Leave"));
const HodLeave = lazy(() => import("./pages/hod/Leave"));
const HodResults = lazy(() => import("./pages/hod/Results"));
const StaffResults = lazy(() => import("./pages/staff/Results"));
const StudentFees = lazy(() => import("./pages/student/Fees"));
const HodFees = lazy(() => import("./pages/hod/Fees"));
const AlertsPage = lazy(() => import("./pages/alerts/AlertsPage"));
const ComplaintsPage = lazy(() => import("./pages/complaints/ComplaintsPage"));
const PlacementsPage = lazy(() => import("./pages/placements/PlacementsPage"));
const VerifyGatePass = lazy(() => import("./pages/security/VerifyGatePass"));
const MessPage = lazy(() => import("./pages/mess/MessPage"));
const HostelPage = lazy(() => import("./pages/hostel/HostelPage"));
const Profile = lazy(() => import("./pages/Profile"));
const ExamCellDashboard = lazy(() => import("./pages/exam_cell/ExamCellDashboard"));
const HelpCenter = lazy(() => import("./pages/shared/HelpCenter"));
const StaffAttendance = lazy(() => import("./pages/staff/Attendance"));
const StudentAttendance = lazy(() => import("./pages/student/Attendance"));
const HodAttendance = lazy(() => import("./pages/hod/Attendance"));
const ClassIncharge = lazy(() => import("./pages/hod/ClassIncharge"));
const AttendanceOverview = lazy(() => import("./pages/hod/AttendanceOverview"));
const DailyAttendanceReport = lazy(() => import("./pages/shared/DailyAttendanceReport"));

const WardenDashboard = lazy(() => import("./pages/warden/WardenDashboard"));
const ManagementDashboard = lazy(() => import("./pages/management/Dashboard"));
const WardenGatePass = lazy(() => import("./pages/warden/GatePass"));
const WardenStudents = lazy(() => import("./pages/warden/Students"));
const WardenAttendance = lazy(() => import("./pages/warden/Attendance"));
const WardenAlerts = lazy(() => import("./pages/warden/Alerts"));
const RoomAllocation = lazy(() => import("./pages/warden/RoomAllocation"));
const OfficeStaffDashboard = lazy(() => import("./pages/officestaff/Dashboard"));
const FeesCollection = lazy(() => import("./pages/officestaff/FeesCollection"));
const FeesOverview = lazy(() => import("./pages/officestaff/FeesOverview"));
const FeesAlerts = lazy(() => import("./pages/officestaff/FeesAlerts"));
const CampusMap = lazy(() => import("./pages/shared/CampusMap"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const PrincipalDashboard = lazy(() => import("./pages/principal/Dashboard"));
const PrincipalLeave = lazy(() => import("./pages/principal/Leave"));
const PrincipalGatePass = lazy(() => import("./pages/principal/GatePass"));
const VerifyFees = lazy(() => import("./pages/officestaff/VerifyFees"));
const StudentFines = lazy(() => import("./pages/student/Fines"));
const StaffFines = lazy(() => import("./pages/staff/Fines"));
const OfficeStaffFines = lazy(() => import("./pages/officestaff/Fines"));
const StaffStudentDetails = lazy(() => import("./pages/staff/StudentDetails"));

// CIA Pages
const ExamCreation = lazy(() => import("./pages/cia/ExamCreation"));
const ScheduleExamination = lazy(() => import("./pages/cia/ScheduleExamination"));
const ExamSeatingArrangement = lazy(() => import("./pages/cia/ExamSeatingArrangement"));
const QuestionBank = lazy(() => import("./pages/cia/QuestionBank"));
const QuestionPaper = lazy(() => import("./pages/cia/QuestionPaper"));
const MarkAttendance = lazy(() => import("./pages/cia/MarkAttendance"));
const MarkEntryCIA = lazy(() => import("./pages/cia/MarkEntryCIA"));
const MarkEntryOther = lazy(() => import("./pages/cia/MarkEntryOther"));
const MarkEntryESE = lazy(() => import("./pages/cia/MarkEntryESE"));
const ResultAnalysis = lazy(() => import("./pages/cia/ResultAnalysis"));
const AttendanceReport = lazy(() => import("./pages/cia/AttendanceReport"));
const Reports = lazy(() => import("./pages/cia/Reports"));
const MyQuestionPapers = lazy(() => import("./pages/cia/MyQuestionPapers"));
const HodQuestionPaperReview = lazy(() => import("./pages/cia/HodQuestionPaperReview"));
const PrincipalQuestionPaperReview = lazy(() => import("./pages/cia/PrincipalQuestionPaperReview"));
const StudentQuestionPapers = lazy(() => import("./pages/student/StudentQuestionPapers"));
const StudentQuestionBank = lazy(() => import("./pages/student/StudentQuestionBank"));
const ClassQuestionBanks = lazy(() => import("./pages/cia/ClassQuestionBanks"));

// Academics Pages
const AcademicCalendar = lazy(() => import("./pages/academics/AcademicCalendar"));
const CourseAllocation = lazy(() => import("./pages/academics/CourseAllocation"));
const CourseEnrollment = lazy(() => import("./pages/academics/CourseEnrollment"));

const FacultyProfile = lazy(() => import("./pages/academics/FacultyProfile"));
const AcademicReports = lazy(() => import("./pages/academics/AcademicReports"));

// LMS Pages
const CourseContents = lazy(() => import("./pages/academics/lms/CourseContents"));

const CoursePlanCompletion = lazy(() => import("./pages/academics/lms/CoursePlanCompletion"));
const CoursePlanFeedback = lazy(() => import("./pages/academics/lms/CoursePlanFeedback"));
const Assignments = lazy(() => import("./pages/academics/lms/Assignments"));
const LmsMarkAttendance = lazy(() => import("./pages/academics/lms/MarkAttendance"));
const AcademicActivities = lazy(() => import("./pages/academics/lms/AcademicActivities"));
const ResearchRepository = lazy(() => import("./pages/academics/lms/ResearchRepository"));
const SelfAppraisal = lazy(() => import("./pages/academics/lms/SelfAppraisal"));
const FacultyParticipation = lazy(() => import("./pages/academics/lms/FacultyParticipation"));

// Configuration Pages - General
const Programme = lazy(() => import("./pages/configuration/general/Programme"));
const UploadCourses = lazy(() => import("./pages/configuration/general/UploadCourses"));
const RegulationMapping = lazy(() => import("./pages/configuration/general/RegulationMapping"));
const StudentDetails = lazy(() => import("./pages/configuration/general/StudentDetails"));
const FacultyDetails = lazy(() => import("./pages/configuration/general/FacultyDetails"));
const PromoteStudent = lazy(() => import("./pages/configuration/general/PromoteStudent"));
const PassOutStudents = lazy(() => import("./pages/configuration/general/PassOutStudents"));

// Configuration Pages - CIA
const QuestionFormat = lazy(() => import("./pages/configuration/cia/QuestionFormat"));
const TypesAndEvaluation = lazy(() => import("./pages/configuration/cia/TypesAndEvaluation"));
const EvaluationPattern = lazy(() => import("./pages/configuration/cia/EvaluationPattern"));
const ShowEvaluationPattern = lazy(() => import("./pages/configuration/cia/ShowEvaluationPattern"));
const PatternMapping = lazy(() => import("./pages/configuration/cia/PatternMapping"));

const SubjectAllocation = lazy(() => import("./pages/hod/SubjectAllocation"));
const MySubjects = lazy(() => import("./pages/staff/MySubjects"));

// Timetable
const TimetableEditor = lazy(() => import("./pages/dept_admin/TimetableEditor"));
const StudentTimetable = lazy(() => import("./pages/student/Timetable"));
const StaffTimetable = lazy(() => import("./pages/staff/Timetable"));

// Hour Alteration, Period Attendance & Record of Classwork (Logbook)
const HourAlteration = lazy(() => import("./pages/staff/HourAlteration"));
const PeriodAttendance = lazy(() => import("./pages/staff/PeriodAttendance"));
const RecordOfClasswork = lazy(() => import("./pages/staff/RecordOfClasswork"));

// New Student Admission & Coordinator Management
const NewStudentAdmission = lazy(() => import("./pages/dept_admin/NewStudentAdmission"));
const CoordinatorManagement = lazy(() => import("./pages/hod/CoordinatorManagement"));

const ComingSoon = ({ title }) => (
  <div style={{
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--primary)",
    color: "var(--text)",
    flexDirection: "column",
    gap: 16
  }}>
    <h2 style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>{title}</h2>
    <p style={{ color: "var(--text-muted)" }}>Module under active development...</p>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh", width: "100%", background: "#f8fafc" }}>
            <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTop: "3px solid #2563eb", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        }>
          <Routes>
          {/* Auth */}
          <Route path="/" element={<Auth />} />
          <Route path="/login" element={<Auth />} />

          {/* Student Routes */}
          <Route path="/student" element={<ProtectedRoute allowedRole="student"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/gatepass" element={<ProtectedRoute allowedRole="student"><StudentGatePass /></ProtectedRoute>} />
          <Route path="/student/leave" element={<ProtectedRoute allowedRole="student"><StudentLeave /></ProtectedRoute>} />
          <Route path="/student/attendance" element={<ProtectedRoute allowedRole="student"><StudentAttendance /></ProtectedRoute>} />
          <Route path="/student/fees" element={<ProtectedRoute allowedRole="student"><StudentFees /></ProtectedRoute>} />
          <Route path="/student/timetable" element={<ProtectedRoute allowedRole="student"><StudentTimetable /></ProtectedRoute>} />
          <Route path="/student/mess" element={<ProtectedRoute allowedRole="student"><MessPage /></ProtectedRoute>} />
          <Route path="/student/hostel" element={<ProtectedRoute allowedRole="student"><HostelPage /></ProtectedRoute>} />
          <Route path="/student/profile" element={<ProtectedRoute allowedRole="student"><Profile /></ProtectedRoute>} />

          <Route path="/student/placements" element={<ProtectedRoute allowedRole="student"><PlacementsPage /></ProtectedRoute>} />
          <Route path="/student/alerts" element={<ProtectedRoute allowedRole="student"><AlertsPage /></ProtectedRoute>} />
          <Route path="/student/complaints" element={<ProtectedRoute allowedRole="student"><ComplaintsPage /></ProtectedRoute>} />
          <Route path="/student/fines" element={<ProtectedRoute allowedRole="student"><StudentFines /></ProtectedRoute>} />
          <Route path="/student/question-papers" element={<ProtectedRoute allowedRole="student"><StudentQuestionPapers /></ProtectedRoute>} />
          <Route path="/student/question-bank" element={<ProtectedRoute allowedRole="student"><StudentQuestionBank /></ProtectedRoute>} />
          <Route path="/student/seating-arrangement" element={<ProtectedRoute allowedRole="student"><ExamSeatingArrangement /></ProtectedRoute>} />
          <Route path="/student/help" element={<ProtectedRoute allowedRole="student"><HelpCenter /></ProtectedRoute>} />

          {/* Staff Routes */}
          <Route path="/staff" element={<ProtectedRoute allowedRole="staff"><StaffDashboard /></ProtectedRoute>} />
          <Route path="/staff/gatepass" element={<ProtectedRoute allowedRole="staff"><StaffGatePass /></ProtectedRoute>} />
          <Route path="/staff/leave" element={<ProtectedRoute allowedRole="staff"><StaffLeave /></ProtectedRoute>} />
          <Route path="/staff/students" element={<ProtectedRoute allowedRole="staff"><StaffStudentDetails /></ProtectedRoute>} />
          <Route path="/staff/class-question-bank" element={<ProtectedRoute allowedRole={["staff", "hod"]}><StudentQuestionBank /></ProtectedRoute>} />
          <Route path="/staff/attendance" element={<ProtectedRoute allowedRole="staff"><StaffAttendance /></ProtectedRoute>} />
          <Route path="/staff/period-attendance" element={<ProtectedRoute allowedRole={["staff", "hod"]}><PeriodAttendance /></ProtectedRoute>} />
          <Route path="/staff/hour-alteration" element={<ProtectedRoute allowedRole={["staff", "hod"]}><HourAlteration /></ProtectedRoute>} />
          <Route path="/staff/classwork-record" element={<ProtectedRoute allowedRole={["staff", "hod", "principal"]}><RecordOfClasswork /></ProtectedRoute>} />
          <Route path="/staff/my-subjects" element={<ProtectedRoute allowedRole={["staff", "hod"]}><MySubjects /></ProtectedRoute>} />
          <Route path="/staff/results" element={<ProtectedRoute allowedRole="staff"><StaffResults /></ProtectedRoute>} />
          <Route path="/staff/timetable" element={<ProtectedRoute allowedRole={["staff", "hod", "dept_admin"]}><StaffTimetable /></ProtectedRoute>} />
          <Route path="/staff/mess" element={<ProtectedRoute allowedRole="staff"><MessPage /></ProtectedRoute>} />
          <Route path="/staff/hostel" element={<ProtectedRoute allowedRole="staff"><HostelPage /></ProtectedRoute>} />
          <Route path="/staff/profile" element={<ProtectedRoute allowedRole="staff"><Profile /></ProtectedRoute>} />

          <Route path="/staff/placements" element={<ProtectedRoute allowedRole="staff"><PlacementsPage /></ProtectedRoute>} />
          <Route path="/staff/alerts" element={<ProtectedRoute allowedRole="staff"><AlertsPage /></ProtectedRoute>} />
          <Route path="/staff/complaints" element={<ProtectedRoute allowedRole="staff"><ComplaintsPage /></ProtectedRoute>} />
          <Route path="/staff/fines" element={<ProtectedRoute allowedRole="staff"><StaffFines /></ProtectedRoute>} />
          <Route path="/staff/help" element={<ProtectedRoute allowedRole="staff"><HelpCenter /></ProtectedRoute>} />
          
          {/* Exam Cell CIA Routes */}
          <Route path="/cia/exam-creation" element={<ProtectedRoute allowedRole="exam_cell"><ExamCreation /></ProtectedRoute>} />
          <Route path="/cia/schedule" element={<ProtectedRoute allowedRole="exam_cell"><ScheduleExamination /></ProtectedRoute>} />
          <Route path="/cia/seating-arrangement" element={<ProtectedRoute allowedRole={["exam_cell", "admin", "staff", "hod"]}><ExamSeatingArrangement /></ProtectedRoute>} />
          <Route path="/cia/attendance" element={<ProtectedRoute allowedRole="exam_cell"><MarkAttendance /></ProtectedRoute>} />

          {/* Staff & HOD CIA Routes */}
          <Route path="/cia/question-bank" element={<ProtectedRoute allowedRole={["staff", "dept_admin", "hod", "admin"]}><QuestionBank /></ProtectedRoute>} />
          <Route path="/cia/class-question-banks" element={<ProtectedRoute allowedRole={["staff", "dept_admin", "hod", "admin"]}><ClassQuestionBanks /></ProtectedRoute>} />
          <Route path="/staff/class-question-bank" element={<ProtectedRoute allowedRole={["staff", "dept_admin", "hod", "admin"]}><ClassQuestionBanks /></ProtectedRoute>} />
          <Route path="/cia/my-papers" element={<ProtectedRoute allowedRole={["exam_cell", "admin", "principal", "hod", "staff"]}><MyQuestionPapers /></ProtectedRoute>} />
          <Route path="/cia/question-paper" element={<ProtectedRoute allowedRole={["exam_cell", "admin", "principal", "hod", "staff"]}><QuestionPaper /></ProtectedRoute>} />
          <Route path="/cia/mark-entry" element={<ProtectedRoute allowedRole={["staff", "hod"]}><MarkEntryCIA /></ProtectedRoute>} />
          <Route path="/cia/other-mark-entry" element={<ProtectedRoute allowedRole={["staff", "hod"]}><MarkEntryOther /></ProtectedRoute>} />
          <Route path="/cia/ese-mark-entry" element={<ProtectedRoute allowedRole={["staff", "hod"]}><MarkEntryESE /></ProtectedRoute>} />
          <Route path="/cia/result-analysis" element={<ProtectedRoute allowedRole={["staff", "hod", "admin"]}><ResultAnalysis /></ProtectedRoute>} />
          <Route path="/cia/attendance-report" element={<ProtectedRoute allowedRole={["staff", "hod", "admin"]}><AttendanceReport /></ProtectedRoute>} />
          <Route path="/cia/reports" element={<ProtectedRoute allowedRole={["staff", "hod", "admin"]}><Reports /></ProtectedRoute>} />

          {/* Academics & LMS Routes */}
          <Route path="/academics/academic-calendar" element={<ProtectedRoute allowedRole={['staff', 'hod', 'admin', 'management', 'principal']}><AcademicCalendar /></ProtectedRoute>} />
          <Route path="/academics/course-allocation" element={<ProtectedRoute allowedRole={['staff', 'hod']}><CourseAllocation /></ProtectedRoute>} />
          <Route path="/academics/course-enrollment" element={<ProtectedRoute allowedRole={['staff', 'hod']}><CourseEnrollment /></ProtectedRoute>} />

          <Route path="/academics/faculty-profile" element={<ProtectedRoute allowedRole={['staff', 'hod']}><FacultyProfile /></ProtectedRoute>} />
          <Route path="/academics/reports" element={<ProtectedRoute allowedRole={['staff', 'hod']}><AcademicReports /></ProtectedRoute>} />
          
          <Route path="/academics/lms/course-contents" element={<ProtectedRoute allowedRole={['staff', 'hod']}><CourseContents /></ProtectedRoute>} />

          <Route path="/academics/lms/plan-completion" element={<ProtectedRoute allowedRole={['staff', 'hod']}><CoursePlanCompletion /></ProtectedRoute>} />
          <Route path="/academics/lms/plan-feedback" element={<ProtectedRoute allowedRole={['staff', 'hod']}><CoursePlanFeedback /></ProtectedRoute>} />
          <Route path="/academics/lms/assignments" element={<ProtectedRoute allowedRole={['staff', 'hod']}><Assignments /></ProtectedRoute>} />
          <Route path="/academics/lms/mark-attendance" element={<ProtectedRoute allowedRole={['staff', 'hod']}><LmsMarkAttendance /></ProtectedRoute>} />
          <Route path="/academics/lms/academic-activities" element={<ProtectedRoute allowedRole={['staff', 'hod']}><AcademicActivities /></ProtectedRoute>} />
          <Route path="/academics/lms/research-repository" element={<ProtectedRoute allowedRole={['staff', 'hod']}><ResearchRepository /></ProtectedRoute>} />
          <Route path="/academics/lms/self-appraisal" element={<ProtectedRoute allowedRole={['staff', 'hod']}><SelfAppraisal /></ProtectedRoute>} />
          <Route path="/academics/lms/faculty-participation" element={<ProtectedRoute allowedRole={['staff', 'hod']}><FacultyParticipation /></ProtectedRoute>} />

          <Route path="/dept-admin/timetable" element={<ProtectedRoute allowedRole={["dept_admin", "hod", "admin"]}><TimetableEditor /></ProtectedRoute>} />
          <Route path="/hod/timetable" element={<ProtectedRoute allowedRole={["hod", "dept_admin", "admin"]}><TimetableEditor /></ProtectedRoute>} />
          <Route path="/staff/manage-timetable" element={<ProtectedRoute allowedRole={["dept_admin", "hod", "admin"]}><TimetableEditor /></ProtectedRoute>} />
          <Route path="/dept_admin/profile" element={<ProtectedRoute allowedRole="dept_admin"><Profile /></ProtectedRoute>} />
          <Route path="/dept_admin/help" element={<ProtectedRoute allowedRole="dept_admin"><HelpCenter /></ProtectedRoute>} />

          {/* New Student Admission — Coordinator Only */}
          <Route path="/dept_admin/new-admission" element={<ProtectedRoute allowedRole={["dept_admin", "hod", "admin"]}><NewStudentAdmission /></ProtectedRoute>} />

          {/* HOD Coordinator Management */}
          <Route path="/hod/coordinators" element={<ProtectedRoute allowedRole={["hod", "admin"]}><CoordinatorManagement /></ProtectedRoute>} />

          {/* Exam Cell Routes */}
          <Route path="/exam_cell" element={<ProtectedRoute allowedRole="exam_cell"><ExamCellDashboard /></ProtectedRoute>} />
          <Route path="/exam_cell/profile" element={<ProtectedRoute allowedRole="exam_cell"><Profile /></ProtectedRoute>} />
          <Route path="/exam_cell/help" element={<ProtectedRoute allowedRole="exam_cell"><HelpCenter /></ProtectedRoute>} />

          {/* HOD Routes */}
          <Route path="/hod" element={<ProtectedRoute allowedRole="hod"><HodDashboard /></ProtectedRoute>} />
          <Route path="/hod/gatepass" element={<ProtectedRoute allowedRole="hod"><HodGatePass /></ProtectedRoute>} />
          <Route path="/hod/leave" element={<ProtectedRoute allowedRole="hod"><HodLeave /></ProtectedRoute>} />
          <Route path="/hod/results" element={<ProtectedRoute allowedRole="hod"><HodResults /></ProtectedRoute>} />
          <Route path="/hod/attendance" element={<ProtectedRoute allowedRole="hod"><HodAttendance /></ProtectedRoute>} />
          <Route path="/hod/class-incharge" element={<ProtectedRoute allowedRole={["hod", "admin"]}><ClassIncharge /></ProtectedRoute>} />
          <Route path="/hod/subject-allocation" element={<Navigate to="/academics/course-allocation" replace />} />
          <Route path="/hod/attendance-overview" element={<ProtectedRoute allowedRole={["hod", "admin"]}><AttendanceOverview /></ProtectedRoute>} />
          <Route path="/reports/daily-attendance" element={<ProtectedRoute allowedRole={["hod", "admin", "management", "principal"]}><DailyAttendanceReport /></ProtectedRoute>} />
          <Route path="/hod/fees" element={<ProtectedRoute allowedRole="hod"><HodFees /></ProtectedRoute>} />
          <Route path="/hod/mess" element={<ProtectedRoute allowedRole="hod"><MessPage /></ProtectedRoute>} />
          <Route path="/hod/hostel" element={<ProtectedRoute allowedRole="hod"><HostelPage /></ProtectedRoute>} />
          <Route path="/hod/profile" element={<ProtectedRoute allowedRole="hod"><Profile /></ProtectedRoute>} />

          <Route path="/hod/placements" element={<ProtectedRoute allowedRole="hod"><PlacementsPage /></ProtectedRoute>} />
          <Route path="/hod/alerts" element={<ProtectedRoute allowedRole="hod"><AlertsPage /></ProtectedRoute>} />
          <Route path="/hod/complaints" element={<ProtectedRoute allowedRole="hod"><ComplaintsPage /></ProtectedRoute>} />
          <Route path="/hod/fines" element={<ProtectedRoute allowedRole="hod"><OfficeStaffFines /></ProtectedRoute>} />
          <Route path="/hod/help" element={<ProtectedRoute allowedRole="hod"><HelpCenter /></ProtectedRoute>} />
          
          <Route path="/hod/cia/question-papers" element={<ProtectedRoute allowedRole="hod"><HodQuestionPaperReview /></ProtectedRoute>} />

          {/* Management Routes */}
          <Route path="/management" element={<ProtectedRoute allowedRole="management"><ManagementDashboard /></ProtectedRoute>} />
          <Route path="/management/mess" element={<ProtectedRoute allowedRole="management"><MessPage /></ProtectedRoute>} />
          <Route path="/management/hostel" element={<ProtectedRoute allowedRole="management"><HostelPage /></ProtectedRoute>} />
          <Route path="/management/profile" element={<ProtectedRoute allowedRole="management"><Profile /></ProtectedRoute>} />
          <Route path="/management/help" element={<ProtectedRoute allowedRole="management"><HelpCenter /></ProtectedRoute>} />

          {/* Security Routes */}
          <Route path="/security" element={<ProtectedRoute allowedRole="security"><Navigate to="/security/verify" /></ProtectedRoute>} />
          <Route path="/security/verify" element={<ProtectedRoute allowedRole="security"><VerifyGatePass /></ProtectedRoute>} />
          <Route path="/security/profile" element={<ProtectedRoute allowedRole="security"><Profile /></ProtectedRoute>} />
          <Route path="/security/help" element={<ProtectedRoute allowedRole="security"><HelpCenter /></ProtectedRoute>} />

         {/* Warden Routes */}
         <Route path="/warden" element={<ProtectedRoute allowedRole="warden"><WardenDashboard /></ProtectedRoute>} />
         <Route path="/warden/gatepass" element={<ProtectedRoute allowedRole="warden"><WardenGatePass /></ProtectedRoute>} />
         <Route path="/warden/students" element={<ProtectedRoute allowedRole="warden"><WardenStudents /></ProtectedRoute>} />
         <Route path="/warden/attendance" element={<ProtectedRoute allowedRole="warden"><WardenAttendance /></ProtectedRoute>} />
         <Route path="/warden/alerts" element={<ProtectedRoute allowedRole="warden"><WardenAlerts /></ProtectedRoute>} />
         <Route path="/warden/profile" element={<ProtectedRoute allowedRole="warden"><Profile /></ProtectedRoute>} />
         <Route path="/warden/help" element={<ProtectedRoute allowedRole="warden"><HelpCenter /></ProtectedRoute>} />
         <Route path="/warden/rooms" element={<ProtectedRoute allowedRole="warden"><RoomAllocation /></ProtectedRoute>} />
        

        
        {/* Office Staff Routes */}
          <Route path="/officestaff" element={<ProtectedRoute allowedRole="officestaff"><OfficeStaffDashboard /></ProtectedRoute>} />
          <Route path="/officestaff/fees" element={<ProtectedRoute allowedRole="officestaff"><FeesCollection /></ProtectedRoute>} />
          <Route path="/officestaff/overview" element={<ProtectedRoute allowedRole="officestaff"><FeesOverview /></ProtectedRoute>} />
          <Route path="/officestaff/alerts" element={<ProtectedRoute allowedRole="officestaff"><FeesAlerts /></ProtectedRoute>} />
          <Route path="/officestaff/verify-fees" element={<ProtectedRoute allowedRole="officestaff"><VerifyFees /></ProtectedRoute>} />
          <Route path="/officestaff/fines" element={<ProtectedRoute allowedRole="officestaff"><OfficeStaffFines /></ProtectedRoute>} />
          <Route path="/officestaff/profile" element={<ProtectedRoute allowedRole="officestaff"><Profile /></ProtectedRoute>} />
          <Route path="/officestaff/help" element={<ProtectedRoute allowedRole="officestaff"><HelpCenter /></ProtectedRoute>} />


          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute allowedRole="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/profile" element={<ProtectedRoute allowedRole="admin"><Profile /></ProtectedRoute>} />
          <Route path="/admin/help" element={<ProtectedRoute allowedRole="admin"><HelpCenter /></ProtectedRoute>} />

          {/* Principal Routes */}
          <Route path="/principal" element={<ProtectedRoute allowedRole="principal"><PrincipalDashboard /></ProtectedRoute>} />
          <Route path="/principal/gatepass" element={<ProtectedRoute allowedRole="principal"><PrincipalGatePass /></ProtectedRoute>} />
          <Route path="/principal/leave" element={<ProtectedRoute allowedRole="principal"><PrincipalLeave /></ProtectedRoute>} />
          <Route path="/principal/alerts" element={<ProtectedRoute allowedRole="principal"><AlertsPage /></ProtectedRoute>} />
          <Route path="/principal/profile" element={<ProtectedRoute allowedRole="principal"><Profile /></ProtectedRoute>} />
          <Route path="/principal/help" element={<ProtectedRoute allowedRole="principal"><HelpCenter /></ProtectedRoute>} />
          
          <Route path="/principal/cia/question-papers" element={<ProtectedRoute allowedRole="principal"><PrincipalQuestionPaperReview /></ProtectedRoute>} />

          {/* Configuration Routes */}
          <Route path="/config/general/programme" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><Programme /></ProtectedRoute>} />
          <Route path="/config/general/upload-courses" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><UploadCourses /></ProtectedRoute>} />
          <Route path="/config/general/regulation-mapping" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><RegulationMapping /></ProtectedRoute>} />
          <Route path="/config/general/student" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod", "dept_admin"]}><StudentDetails /></ProtectedRoute>} />
          <Route path="/config/general/faculty" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><FacultyDetails /></ProtectedRoute>} />
          <Route path="/config/general/promote-student" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod", "dept_admin"]}><PromoteStudent /></ProtectedRoute>} />
          <Route path="/config/general/pass-out-students" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><PassOutStudents /></ProtectedRoute>} />
          
          <Route path="/config/cia/question-format" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><QuestionFormat /></ProtectedRoute>} />
          <Route path="/config/cia/types-evaluation" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><TypesAndEvaluation /></ProtectedRoute>} />
          <Route path="/config/cia/evaluation-pattern" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><EvaluationPattern /></ProtectedRoute>} />
          <Route path="/config/cia/show-evaluation-pattern" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><ShowEvaluationPattern /></ProtectedRoute>} />
          <Route path="/config/cia/pattern-mapping" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><PatternMapping /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}
