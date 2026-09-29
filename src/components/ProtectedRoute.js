// src/components/ProtectedRoute.js
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRole }) {
  const { currentUser, userProfile, isSuperAdmin } = useAuth();

  if (!currentUser) return <Navigate to="/" />;
  // Super admins can access ALL routes
  if (isSuperAdmin) return children;
  if (allowedRole && userProfile?.role !== "management") {
    if (Array.isArray(allowedRole)) {
      if (!allowedRole.includes(userProfile?.role)) return <Navigate to="/" />;
    } else {
      if (userProfile?.role !== allowedRole) return <Navigate to="/" />;
    }
  }

  return children;
}
