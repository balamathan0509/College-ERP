import React from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";

export default function AiAnalysis() {
  const { userProfile } = useAuth();
  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>AI Analysis</h1>
          <p>This is a placeholder for the HOD analysis page.</p>
        </div>
        <div className="card">
          <p>User department: {userProfile?.dept || "N/A"}</p>
          <p>AI functionality is currently disabled until secure API key configuration.</p>
        </div>
      </main>
    </div>
  );
}
