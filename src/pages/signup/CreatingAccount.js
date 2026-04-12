import React from "react";

export default function CreatingAccount() {
  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="auth-logo">
          <div className="logo-icon">⏳</div>
          <h1>Creating Account</h1>
          <p>Please wait while we set things up</p>
        </div>
        <div className="spinner" style={{ margin: "0 auto" }} />
      </div>
    </div>
  );
}
