// src/components/ProtectedRoute.js
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRole }) {
  const { currentUser, userProfile, isSuperAdmin, loading } = useAuth();

  // Auth still loading-a iruku — redirect pannama wait panni
  if (loading) return null;

  // Login pannala — login page ku anuppu
  if (!currentUser) return <Navigate to="/" replace />;

  // userProfile still fetch aaguthu — wait panni
  if (!userProfile) return null;

  // Super admins can access ALL routes
  if (isSuperAdmin) return children;

  if (allowedRole && userProfile?.role !== "management") {
    const roles = Array.isArray(allowedRole) ? allowedRole : [allowedRole];

    // Treat dept_admin as having staff permissions
    if (roles.includes("staff") && userProfile?.role === "dept_admin") {
      return children;
    }

    if (!roles.includes(userProfile?.role)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
