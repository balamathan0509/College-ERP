import React, { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Login from "./Login";
import { getUserDashboard } from "../utils/authUtils";

export default function Auth() {
  const { currentUser, userProfile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && currentUser && userProfile) {
      const destination = getUserDashboard(userProfile, currentUser);
      navigate(destination, { replace: true });
    }
  }, [loading, currentUser, userProfile, navigate]);

  // Loading state or awaiting profile hydration
  if (loading || (currentUser && !userProfile)) {
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
        <p style={{ marginTop: 14, color: "#64748b", fontWeight: 600, fontSize: 13, fontFamily: "system-ui, -apple-system, sans-serif" }}>Loading portal...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // If already authenticated and profile ready, show spinner while useEffect performs navigate
  if (currentUser && userProfile) {
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

  return <Login />;
}
