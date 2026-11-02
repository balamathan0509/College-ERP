import React from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import Login from "./Login";

export default function Auth() {
  const { currentUser, userProfile, loading } = useAuth();

  if (!loading && currentUser && userProfile) {
    let role = (userProfile.role || "").toLowerCase().trim();
    const designation = (userProfile.designation || "").toLowerCase().trim();

    if (role.endsWith("hod") || role.includes("hod") || designation.includes("hod")) {
      role = "hod";
    } else if (role === "faculty" || role === "teacher") {
      role = "staff";
    }

    if (userProfile.isSuperAdmin || currentUser.email === "balamathan0509@gmail.com") return <Navigate to="/admin" replace />;
    if (role === "hod" || role.includes("hod")) return <Navigate to="/hod" replace />;
    if (role === "dept_admin" || role === "staff" || role.includes("staff") || role.includes("faculty")) return <Navigate to="/staff" replace />;
    if (role === "student" || role.includes("student")) return <Navigate to="/student" replace />;
    if (role === "warden" || role.includes("warden")) return <Navigate to="/warden" replace />;
    if (role === "security" || role.includes("security")) return <Navigate to="/security/verify" replace />;
    if (role === "officestaff" || role.includes("office")) return <Navigate to="/officestaff" replace />;
    if (role === "management" || role.includes("management")) return <Navigate to="/management" replace />;
    if (role === "principal" || role.includes("principal")) return <Navigate to="/principal" replace />;
    if (role === "exam_cell" || role.includes("exam")) return <Navigate to="/exam_cell" replace />;
    return <Navigate to="/student" replace />;
  }

  return <Login />;
}
