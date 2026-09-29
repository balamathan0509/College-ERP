// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import StudentDashboard from "./pages/student/StudentDashboard";
import StaffDashboard from "./pages/staff/StaffDashboard";
import HodDashboard from "./pages/hod/HodDashboard";
import StudentGatePass from "./pages/student/GatePass";
import StaffGatePass from "./pages/staff/GatePass";
import HodGatePass from "./pages/hod/GatePass";
import StudentLeave from "./pages/student/Leave";
import StaffLeave from "./pages/staff/Leave";
import HodLeave from "./pages/hod/Leave";
import HodResults from "./pages/hod/Results";
import StaffResults from "./pages/staff/Results";
import "./styles/global.css";
import StudentFees from "./pages/student/Fees";
import HodFees from "./pages/hod/Fees";
import AlertsPage from "./pages/alerts/AlertsPage";
import ComplaintsPage from "./pages/complaints/ComplaintsPage";
import PlacementsPage from "./pages/placements/PlacementsPage";
import VerifyGatePass from "./pages/security/VerifyGatePass";
import MessPage from "./pages/mess/MessPage";
import HostelPage from "./pages/hostel/HostelPage";
import Profile from "./pages/Profile";
import HelpCenter from "./pages/shared/HelpCenter";
import StaffAttendance from "./pages/staff/Attendance";
import StudentAttendance from "./pages/student/Attendance";
import HodAttendance from "./pages/hod/Attendance";
import ClassIncharge from "./pages/hod/ClassIncharge";
import AttendanceOverview from "./pages/hod/AttendanceOverview";
import DailyAttendanceReport from "./pages/shared/DailyAttendanceReport";
import StaffTimetable from "./pages/staff/Timetable";
import StudentTimetable from "./pages/student/Timetable";
import HodTimetable from "./pages/hod/Timetable";
import WardenDashboard from "./pages/warden/WardenDashboard";
import ManagementDashboard from "./pages/management/Dashboard";
import WardenGatePass from "./pages/warden/GatePass";
import WardenStudents from "./pages/warden/Students";
import WardenAttendance from "./pages/warden/Attendance";
import WardenAlerts from "./pages/warden/Alerts";
import RoomAllocation from "./pages/warden/RoomAllocation";
import OfficeStaffDashboard from "./pages/officestaff/Dashboard";
import FeesCollection from "./pages/officestaff/FeesCollection";
import FeesOverview from "./pages/officestaff/FeesOverview";
import FeesAlerts from "./pages/officestaff/FeesAlerts";
import CampusMap from "./pages/shared/CampusMap";
import Signup from "./pages/Signup";
import AdminDashboard from "./pages/admin/AdminDashboard";
import PrincipalDashboard from "./pages/principal/Dashboard";
import PrincipalLeave from "./pages/principal/Leave";
import PrincipalGatePass from "./pages/principal/GatePass";
import VerifyFees from "./pages/officestaff/VerifyFees";
import StudentFines from "./pages/student/Fines";
import StaffFines from "./pages/staff/Fines";
import OfficeStaffFines from "./pages/officestaff/Fines";

// CIA Pages
import ExamCreation from "./pages/cia/ExamCreation";
import ScheduleExamination from "./pages/cia/ScheduleExamination";
import QuestionBank from "./pages/cia/QuestionBank";
import QuestionPaper from "./pages/cia/QuestionPaper";
import MarkAttendance from "./pages/cia/MarkAttendance";
import MarkEntryCIA from "./pages/cia/MarkEntryCIA";
import MarkEntryOther from "./pages/cia/MarkEntryOther";
import MarkEntryESE from "./pages/cia/MarkEntryESE";
import ResultAnalysis from "./pages/cia/ResultAnalysis";
import AttendanceReport from "./pages/cia/AttendanceReport";
import Reports from "./pages/cia/Reports";
import MyQuestionPapers from "./pages/cia/MyQuestionPapers";
import HodQuestionPaperReview from "./pages/cia/HodQuestionPaperReview";
import PrincipalQuestionPaperReview from "./pages/cia/PrincipalQuestionPaperReview";
import StudentQuestionPapers from "./pages/student/StudentQuestionPapers";

// Academics Pages
import CourseAllocation from "./pages/academics/CourseAllocation";
import CourseEnrollment from "./pages/academics/CourseEnrollment";
import TimetableConfig from "./pages/academics/TimetableConfig";
import ViewTimetable from "./pages/academics/ViewTimetable";
import FacultyProfile from "./pages/academics/FacultyProfile";
import AcademicReports from "./pages/academics/AcademicReports";

// LMS Pages
import CourseContents from "./pages/academics/lms/CourseContents";
import FacultyTimetable from "./pages/academics/lms/FacultyTimetable";
import CoursePlanCompletion from "./pages/academics/lms/CoursePlanCompletion";
import CoursePlanFeedback from "./pages/academics/lms/CoursePlanFeedback";
import Assignments from "./pages/academics/lms/Assignments";
import LmsMarkAttendance from "./pages/academics/lms/MarkAttendance";
import AcademicActivities from "./pages/academics/lms/AcademicActivities";
import ResearchRepository from "./pages/academics/lms/ResearchRepository";
import SelfAppraisal from "./pages/academics/lms/SelfAppraisal";
import FacultyParticipation from "./pages/academics/lms/FacultyParticipation";

// Configuration Pages - General
import Programme from "./pages/configuration/general/Programme";
import UploadCourses from "./pages/configuration/general/UploadCourses";
import RegulationMapping from "./pages/configuration/general/RegulationMapping";
import StudentDetails from "./pages/configuration/general/StudentDetails";
import FacultyDetails from "./pages/configuration/general/FacultyDetails";
import PromoteStudent from "./pages/configuration/general/PromoteStudent";
import PassOutStudents from "./pages/configuration/general/PassOutStudents";

// Configuration Pages - CIA
import QuestionFormat from "./pages/configuration/cia/QuestionFormat";
import TypesAndEvaluation from "./pages/configuration/cia/TypesAndEvaluation";
import EvaluationPattern from "./pages/configuration/cia/EvaluationPattern";
import ShowEvaluationPattern from "./pages/configuration/cia/ShowEvaluationPattern";
import PatternMapping from "./pages/configuration/cia/PatternMapping";

// Subject Allocation
import SubjectAllocation from "./pages/hod/SubjectAllocation";
import MySubjects from "./pages/staff/MySubjects";

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
          <Routes>
          {/* Auth */}
          <Route path="/" element={<Auth />} />

          {/* Student Routes */}
          <Route path="/student" element={<ProtectedRoute allowedRole="student"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/gatepass" element={<ProtectedRoute allowedRole="student"><StudentGatePass /></ProtectedRoute>} />
          <Route path="/student/leave" element={<ProtectedRoute allowedRole="student"><StudentLeave /></ProtectedRoute>} />
          <Route path="/student/attendance" element={<ProtectedRoute allowedRole="student"><StudentAttendance /></ProtectedRoute>} />
          <Route path="/student/fees" element={<ProtectedRoute allowedRole="student"><StudentFees /></ProtectedRoute>} />
          <Route path="/student/mess" element={<ProtectedRoute allowedRole="student"><MessPage /></ProtectedRoute>} />
          <Route path="/student/hostel" element={<ProtectedRoute allowedRole="student"><HostelPage /></ProtectedRoute>} />
          <Route path="/student/profile" element={<ProtectedRoute allowedRole="student"><Profile /></ProtectedRoute>} />
          <Route path="/student/timetable" element={<ProtectedRoute allowedRole="student"><StudentTimetable /></ProtectedRoute>} />
          <Route path="/student/placements" element={<ProtectedRoute allowedRole="student"><PlacementsPage /></ProtectedRoute>} />
          <Route path="/student/alerts" element={<ProtectedRoute allowedRole="student"><AlertsPage /></ProtectedRoute>} />
          <Route path="/student/complaints" element={<ProtectedRoute allowedRole="student"><ComplaintsPage /></ProtectedRoute>} />
          <Route path="/student/fines" element={<ProtectedRoute allowedRole="student"><StudentFines /></ProtectedRoute>} />
          <Route path="/student/question-papers" element={<ProtectedRoute allowedRole="student"><StudentQuestionPapers /></ProtectedRoute>} />
          <Route path="/student/help" element={<ProtectedRoute allowedRole="student"><HelpCenter /></ProtectedRoute>} />

          {/* Staff Routes */}
          <Route path="/staff" element={<ProtectedRoute allowedRole="staff"><StaffDashboard /></ProtectedRoute>} />
          <Route path="/staff/gatepass" element={<ProtectedRoute allowedRole="staff"><StaffGatePass /></ProtectedRoute>} />
          <Route path="/staff/leave" element={<ProtectedRoute allowedRole="staff"><StaffLeave /></ProtectedRoute>} />
          <Route path="/staff/attendance" element={<ProtectedRoute allowedRole="staff"><StaffAttendance /></ProtectedRoute>} />
          <Route path="/staff/my-subjects" element={<ProtectedRoute allowedRole={["staff", "hod"]}><MySubjects /></ProtectedRoute>} />
          <Route path="/staff/results" element={<ProtectedRoute allowedRole="staff"><StaffResults /></ProtectedRoute>} />
          <Route path="/staff/mess" element={<ProtectedRoute allowedRole="staff"><MessPage /></ProtectedRoute>} />
          <Route path="/staff/hostel" element={<ProtectedRoute allowedRole="staff"><HostelPage /></ProtectedRoute>} />
          <Route path="/staff/profile" element={<ProtectedRoute allowedRole="staff"><Profile /></ProtectedRoute>} />
          <Route path="/staff/timetable" element={<ProtectedRoute allowedRole="staff"><StaffTimetable /></ProtectedRoute>} />
          <Route path="/staff/placements" element={<ProtectedRoute allowedRole="staff"><PlacementsPage /></ProtectedRoute>} />
          <Route path="/staff/alerts" element={<ProtectedRoute allowedRole="staff"><AlertsPage /></ProtectedRoute>} />
          <Route path="/staff/complaints" element={<ProtectedRoute allowedRole="staff"><ComplaintsPage /></ProtectedRoute>} />
          <Route path="/staff/fines" element={<ProtectedRoute allowedRole="staff"><StaffFines /></ProtectedRoute>} />
          <Route path="/staff/help" element={<ProtectedRoute allowedRole="staff"><HelpCenter /></ProtectedRoute>} />
          
          {/* Staff CIA Routes */}
          <Route path="/cia/exam-creation" element={<ProtectedRoute allowedRole="staff"><ExamCreation /></ProtectedRoute>} />
          <Route path="/cia/schedule" element={<ProtectedRoute allowedRole="staff"><ScheduleExamination /></ProtectedRoute>} />
          <Route path="/cia/question-bank" element={<ProtectedRoute allowedRole="staff"><QuestionBank /></ProtectedRoute>} />
          <Route path="/cia/my-papers" element={<ProtectedRoute allowedRole="staff"><MyQuestionPapers /></ProtectedRoute>} />
          <Route path="/cia/question-paper" element={<ProtectedRoute allowedRole="staff"><QuestionPaper /></ProtectedRoute>} />
          <Route path="/cia/attendance" element={<ProtectedRoute allowedRole="staff"><MarkAttendance /></ProtectedRoute>} />
          <Route path="/cia/mark-entry" element={<ProtectedRoute allowedRole="staff"><MarkEntryCIA /></ProtectedRoute>} />
          <Route path="/cia/other-mark-entry" element={<ProtectedRoute allowedRole="staff"><MarkEntryOther /></ProtectedRoute>} />
          <Route path="/cia/ese-mark-entry" element={<ProtectedRoute allowedRole="staff"><MarkEntryESE /></ProtectedRoute>} />
          <Route path="/cia/result-analysis" element={<ProtectedRoute allowedRole="staff"><ResultAnalysis /></ProtectedRoute>} />
          <Route path="/cia/attendance-report" element={<ProtectedRoute allowedRole="staff"><AttendanceReport /></ProtectedRoute>} />
          <Route path="/cia/reports" element={<ProtectedRoute allowedRole="staff"><Reports /></ProtectedRoute>} />

          {/* Academics & LMS Routes */}
          <Route path="/academics/course-allocation" element={<ProtectedRoute allowedRole={['staff', 'hod']}><CourseAllocation /></ProtectedRoute>} />
          <Route path="/academics/course-enrollment" element={<ProtectedRoute allowedRole={['staff', 'hod']}><CourseEnrollment /></ProtectedRoute>} />
          <Route path="/academics/timetable-config" element={<ProtectedRoute allowedRole={['staff', 'hod']}><TimetableConfig /></ProtectedRoute>} />
          <Route path="/academics/view-timetable" element={<ProtectedRoute allowedRole={['staff', 'hod']}><ViewTimetable /></ProtectedRoute>} />
          <Route path="/academics/faculty-profile" element={<ProtectedRoute allowedRole={['staff', 'hod']}><FacultyProfile /></ProtectedRoute>} />
          <Route path="/academics/reports" element={<ProtectedRoute allowedRole={['staff', 'hod']}><AcademicReports /></ProtectedRoute>} />
          
          <Route path="/academics/lms/course-contents" element={<ProtectedRoute allowedRole={['staff', 'hod']}><CourseContents /></ProtectedRoute>} />
          <Route path="/academics/lms/faculty-timetable" element={<ProtectedRoute allowedRole={['staff', 'hod']}><FacultyTimetable /></ProtectedRoute>} />
          <Route path="/academics/lms/plan-completion" element={<ProtectedRoute allowedRole={['staff', 'hod']}><CoursePlanCompletion /></ProtectedRoute>} />
          <Route path="/academics/lms/plan-feedback" element={<ProtectedRoute allowedRole={['staff', 'hod']}><CoursePlanFeedback /></ProtectedRoute>} />
          <Route path="/academics/lms/assignments" element={<ProtectedRoute allowedRole={['staff', 'hod']}><Assignments /></ProtectedRoute>} />
          <Route path="/academics/lms/mark-attendance" element={<ProtectedRoute allowedRole={['staff', 'hod']}><LmsMarkAttendance /></ProtectedRoute>} />
          <Route path="/academics/lms/academic-activities" element={<ProtectedRoute allowedRole={['staff', 'hod']}><AcademicActivities /></ProtectedRoute>} />
          <Route path="/academics/lms/research-repository" element={<ProtectedRoute allowedRole={['staff', 'hod']}><ResearchRepository /></ProtectedRoute>} />
          <Route path="/academics/lms/self-appraisal" element={<ProtectedRoute allowedRole={['staff', 'hod']}><SelfAppraisal /></ProtectedRoute>} />
          <Route path="/academics/lms/faculty-participation" element={<ProtectedRoute allowedRole={['staff', 'hod']}><FacultyParticipation /></ProtectedRoute>} />

          {/* HOD Routes */}
          <Route path="/hod" element={<ProtectedRoute allowedRole="hod"><HodDashboard /></ProtectedRoute>} />
          <Route path="/hod/gatepass" element={<ProtectedRoute allowedRole="hod"><HodGatePass /></ProtectedRoute>} />
          <Route path="/hod/leave" element={<ProtectedRoute allowedRole="hod"><HodLeave /></ProtectedRoute>} />
          <Route path="/hod/results" element={<ProtectedRoute allowedRole="hod"><HodResults /></ProtectedRoute>} />
          <Route path="/hod/attendance" element={<ProtectedRoute allowedRole="hod"><HodAttendance /></ProtectedRoute>} />
          <Route path="/hod/class-incharge" element={<ProtectedRoute allowedRole={["hod", "admin"]}><ClassIncharge /></ProtectedRoute>} />
          <Route path="/hod/subject-allocation" element={<ProtectedRoute allowedRole={["hod", "admin", "management"]}><SubjectAllocation /></ProtectedRoute>} />
          <Route path="/hod/attendance-overview" element={<ProtectedRoute allowedRole={["hod", "admin"]}><AttendanceOverview /></ProtectedRoute>} />
          <Route path="/reports/daily-attendance" element={<ProtectedRoute allowedRole={["hod", "admin", "management", "principal"]}><DailyAttendanceReport /></ProtectedRoute>} />
          <Route path="/hod/fees" element={<ProtectedRoute allowedRole="hod"><HodFees /></ProtectedRoute>} />
          <Route path="/hod/mess" element={<ProtectedRoute allowedRole="hod"><MessPage /></ProtectedRoute>} />
          <Route path="/hod/hostel" element={<ProtectedRoute allowedRole="hod"><HostelPage /></ProtectedRoute>} />
          <Route path="/hod/profile" element={<ProtectedRoute allowedRole="hod"><Profile /></ProtectedRoute>} />
          <Route path="/hod/timetable" element={<ProtectedRoute allowedRole="hod"><HodTimetable /></ProtectedRoute>} />
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
          <Route path="/config/general/student" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><StudentDetails /></ProtectedRoute>} />
          <Route path="/config/general/faculty" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><FacultyDetails /></ProtectedRoute>} />
          <Route path="/config/general/promote-student" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><PromoteStudent /></ProtectedRoute>} />
          <Route path="/config/general/pass-out-students" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><PassOutStudents /></ProtectedRoute>} />
          
          <Route path="/config/cia/question-format" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><QuestionFormat /></ProtectedRoute>} />
          <Route path="/config/cia/types-evaluation" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><TypesAndEvaluation /></ProtectedRoute>} />
          <Route path="/config/cia/evaluation-pattern" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><EvaluationPattern /></ProtectedRoute>} />
          <Route path="/config/cia/show-evaluation-pattern" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><ShowEvaluationPattern /></ProtectedRoute>} />
          <Route path="/config/cia/pattern-mapping" element={<ProtectedRoute allowedRole={["management", "officestaff", "staff", "admin", "hod"]}><PatternMapping /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
