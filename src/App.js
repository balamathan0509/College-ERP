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
import StaffAttendance from "./pages/staff/Attendance";
import StudentAttendance from "./pages/student/Attendance";
import HodAttendance from "./pages/hod/Attendance";
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

          {/* Staff Routes */}
          <Route path="/staff" element={<ProtectedRoute allowedRole="staff"><StaffDashboard /></ProtectedRoute>} />
          <Route path="/staff/gatepass" element={<ProtectedRoute allowedRole="staff"><StaffGatePass /></ProtectedRoute>} />
          <Route path="/staff/leave" element={<ProtectedRoute allowedRole="staff"><StaffLeave /></ProtectedRoute>} />
          <Route path="/staff/attendance" element={<ProtectedRoute allowedRole="staff"><StaffAttendance /></ProtectedRoute>} />
          <Route path="/staff/results" element={<ProtectedRoute allowedRole="staff"><StaffResults /></ProtectedRoute>} />
          <Route path="/staff/mess" element={<ProtectedRoute allowedRole="staff"><MessPage /></ProtectedRoute>} />
          <Route path="/staff/hostel" element={<ProtectedRoute allowedRole="staff"><HostelPage /></ProtectedRoute>} />
          <Route path="/staff/profile" element={<ProtectedRoute allowedRole="staff"><Profile /></ProtectedRoute>} />
          <Route path="/staff/timetable" element={<ProtectedRoute allowedRole="staff"><StaffTimetable /></ProtectedRoute>} />
          <Route path="/staff/placements" element={<ProtectedRoute allowedRole="staff"><PlacementsPage /></ProtectedRoute>} />
          <Route path="/staff/alerts" element={<ProtectedRoute allowedRole="staff"><AlertsPage /></ProtectedRoute>} />
          <Route path="/staff/complaints" element={<ProtectedRoute allowedRole="staff"><ComplaintsPage /></ProtectedRoute>} />
          <Route path="/staff/fines" element={<ProtectedRoute allowedRole="staff"><StaffFines /></ProtectedRoute>} />

          {/* HOD Routes */}
          <Route path="/hod" element={<ProtectedRoute allowedRole="hod"><HodDashboard /></ProtectedRoute>} />
          <Route path="/hod/gatepass" element={<ProtectedRoute allowedRole="hod"><HodGatePass /></ProtectedRoute>} />
          <Route path="/hod/leave" element={<ProtectedRoute allowedRole="hod"><HodLeave /></ProtectedRoute>} />
          <Route path="/hod/results" element={<ProtectedRoute allowedRole="hod"><HodResults /></ProtectedRoute>} />
          <Route path="/hod/attendance" element={<ProtectedRoute allowedRole="hod"><HodAttendance /></ProtectedRoute>} />
          <Route path="/hod/fees" element={<ProtectedRoute allowedRole="hod"><HodFees /></ProtectedRoute>} />
          <Route path="/hod/mess" element={<ProtectedRoute allowedRole="hod"><MessPage /></ProtectedRoute>} />
          <Route path="/hod/hostel" element={<ProtectedRoute allowedRole="hod"><HostelPage /></ProtectedRoute>} />
          <Route path="/hod/profile" element={<ProtectedRoute allowedRole="hod"><Profile /></ProtectedRoute>} />
          <Route path="/hod/timetable" element={<ProtectedRoute allowedRole="hod"><HodTimetable /></ProtectedRoute>} />
          <Route path="/hod/placements" element={<ProtectedRoute allowedRole="hod"><PlacementsPage /></ProtectedRoute>} />
          <Route path="/hod/alerts" element={<ProtectedRoute allowedRole="hod"><AlertsPage /></ProtectedRoute>} />
          <Route path="/hod/complaints" element={<ProtectedRoute allowedRole="hod"><ComplaintsPage /></ProtectedRoute>} />
          <Route path="/hod/fines" element={<ProtectedRoute allowedRole="hod"><OfficeStaffFines /></ProtectedRoute>} />

          {/* Management Routes */}
          <Route path="/management" element={<ProtectedRoute allowedRole="management"><ManagementDashboard /></ProtectedRoute>} />
          <Route path="/management/mess" element={<ProtectedRoute allowedRole="management"><MessPage /></ProtectedRoute>} />
          <Route path="/management/hostel" element={<ProtectedRoute allowedRole="management"><HostelPage /></ProtectedRoute>} />
          <Route path="/management/profile" element={<ProtectedRoute allowedRole="management"><Profile /></ProtectedRoute>} />

          {/* Security Routes */}
          <Route path="/security" element={<ProtectedRoute allowedRole="security"><Navigate to="/security/verify" /></ProtectedRoute>} />
          <Route path="/security/verify" element={<ProtectedRoute allowedRole="security"><VerifyGatePass /></ProtectedRoute>} />
          <Route path="/security/profile" element={<ProtectedRoute allowedRole="security"><Profile /></ProtectedRoute>} />

         {/* Warden Routes */}
         <Route path="/warden" element={<ProtectedRoute allowedRole="warden"><WardenDashboard /></ProtectedRoute>} />
         <Route path="/warden/gatepass" element={<ProtectedRoute allowedRole="warden"><WardenGatePass /></ProtectedRoute>} />
         <Route path="/warden/students" element={<ProtectedRoute allowedRole="warden"><WardenStudents /></ProtectedRoute>} />
         <Route path="/warden/attendance" element={<ProtectedRoute allowedRole="warden"><WardenAttendance /></ProtectedRoute>} />
         <Route path="/warden/alerts" element={<ProtectedRoute allowedRole="warden"><WardenAlerts /></ProtectedRoute>} />
         <Route path="/warden/profile" element={<ProtectedRoute allowedRole="warden"><Profile /></ProtectedRoute>} />
         <Route path="/warden/rooms" element={<ProtectedRoute allowedRole="warden"><RoomAllocation /></ProtectedRoute>} />
        

        
        {/* Office Staff Routes */}
          <Route path="/officestaff" element={<ProtectedRoute allowedRole="officestaff"><OfficeStaffDashboard /></ProtectedRoute>} />
          <Route path="/officestaff/fees" element={<ProtectedRoute allowedRole="officestaff"><FeesCollection /></ProtectedRoute>} />
          <Route path="/officestaff/overview" element={<ProtectedRoute allowedRole="officestaff"><FeesOverview /></ProtectedRoute>} />
          <Route path="/officestaff/alerts" element={<ProtectedRoute allowedRole="officestaff"><FeesAlerts /></ProtectedRoute>} />
          <Route path="/officestaff/verify-fees" element={<ProtectedRoute allowedRole="officestaff"><VerifyFees /></ProtectedRoute>} />
          <Route path="/officestaff/fines" element={<ProtectedRoute allowedRole="officestaff"><OfficeStaffFines /></ProtectedRoute>} />
          <Route path="/officestaff/profile" element={<ProtectedRoute allowedRole="officestaff"><Profile /></ProtectedRoute>} />


          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute allowedRole="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/profile" element={<ProtectedRoute allowedRole="admin"><Profile /></ProtectedRoute>} />

          {/* Principal Routes */}
          <Route path="/principal" element={<ProtectedRoute allowedRole="principal"><PrincipalDashboard /></ProtectedRoute>} />
          <Route path="/principal/gatepass" element={<ProtectedRoute allowedRole="principal"><PrincipalGatePass /></ProtectedRoute>} />
          <Route path="/principal/leave" element={<ProtectedRoute allowedRole="principal"><PrincipalLeave /></ProtectedRoute>} />
          <Route path="/principal/alerts" element={<ProtectedRoute allowedRole="principal"><AlertsPage /></ProtectedRoute>} />
          <Route path="/principal/profile" element={<ProtectedRoute allowedRole="principal"><Profile /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
