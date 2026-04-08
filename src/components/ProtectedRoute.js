// src/components/ProtectedRoute.js
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRole }) {
  const { currentUser, userProfile } = useAuth();

  if (!currentUser) return <Navigate to="/" />;
  if (allowedRole && userProfile?.role !== allowedRole && userProfile?.role !== "management") return <Navigate to="/" />;

  return children;
}
