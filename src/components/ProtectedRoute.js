// src/components/ProtectedRoute.js
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getUserDashboard } from "../utils/authUtils";

export default function ProtectedRoute({ children, allowedRole }) {
  const { currentUser, userProfile, isSuperAdmin, loading } = useAuth();
  const location = useLocation();

  // If loading or userProfile is being resolved while currentUser exists, show loading indicator
  if (loading || (!userProfile && currentUser)) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100vw",
        background: "#f8fafc"
      }}>
        <div style={{ width: 40, height: 40, border: "4px solid #e2e8f0", borderTop: "4px solid #2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not logged in — redirect to login
  if (!currentUser) return <Navigate to="/" replace />;

  // Super admins can access ALL routes
  if (isSuperAdmin) return children;

  if (allowedRole && userProfile?.role !== "management") {
    const roles = Array.isArray(allowedRole) ? allowedRole : [allowedRole];

    let currentRole = (userProfile?.role || "").toLowerCase().trim();
    const designation = (userProfile?.designation || "").toLowerCase().trim();

    // Normalize HOD and staff
    if (currentRole.endsWith("hod") || currentRole.includes("hod") || designation.includes("hod")) {
      currentRole = "hod";
    } else if (currentRole === "faculty" || currentRole === "teacher") {
      currentRole = "staff";
    }

    // Treat dept_admin as having staff permissions
    if (roles.includes("staff") && (currentRole === "dept_admin" || currentRole === "staff")) {
      return children;
    }

    // Treat HOD as having staff permissions for general staff CIA/academics
    if (roles.includes("staff") && currentRole === "hod") {
      return children;
    }

    // If role matches any allowed role
    if (roles.includes(currentRole)) {
      return children;
    }

    // Unauthorized for this specific route!
    // Send them directly to their own dashboard (NOT to "/") to prevent infinite redirect loops!
    const userHome = getUserDashboard(userProfile, currentUser);
    if (userHome === location.pathname) {
      return children;
    }
    return <Navigate to={userHome} replace />;
  }

  return children;
}
