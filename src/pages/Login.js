// src/pages/Login.js
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase/config";
import { sendPasswordResetEmail } from "firebase/auth";

export default function Login({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const result = await login(email, password);
      const SUPER_ADMIN_EMAIL = "balamathan0509@gmail.com";
      
      let userData = null;
      let role = null;
      try {
        const userDoc = await getDoc(doc(db, "users", result.user.uid));
        userData = userDoc.data();
        role = userData?.role;
      } catch (firestoreErr) {
        console.error("Firestore read failed (rules issue):", firestoreErr);
        // Fallback: redirect based on email
      }

      // Super admin redirect
      if (userData?.isSuperAdmin === true || result.user.email === SUPER_ADMIN_EMAIL) {
        navigate("/admin");
      } else if (role === "student") navigate("/student");
      else if (role === "staff") navigate("/staff");
      else if (role === "hod") navigate("/hod");
      else if (role === "warden") navigate("/warden");
      else if (role === "security") navigate("/security/verify");
      else if (role === "officestaff") navigate("/officestaff");
      else if (role === "management") navigate("/management");
      else if (role === "principal") navigate("/principal");
      else navigate("/");
    } catch (err) {
      setError("Invalid email or password. Try again.");
    }
    setLoading(false);
  }

  async function handleForgotPassword() {
    setError("");
    setSuccessMsg("");
    if (!email) {
      setError("Please enter your email address first, then click Forgot Password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg("✅ Password reset email sent! Check your inbox (and spam folder).");
    } catch (err) {
      setError("Could not send reset email. Make sure the email is correct.");
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">🎓</div>
          <h1>College Portal</h1>
          <p>Sign in to your account</p>
        </div>

        {error && <div className="error-msg">{error}</div>}
        {successMsg && <div className="success-msg" style={{
          background: "rgba(72, 187, 120, 0.15)",
          border: "1px solid rgba(72, 187, 120, 0.3)",
          color: "#48bb78",
          padding: "12px 16px",
          borderRadius: "10px",
          marginBottom: "16px",
          fontSize: "14px",
          textAlign: "center"
        }}>{successMsg}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="you@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div style={{
            textAlign: "right",
            marginBottom: "12px",
            marginTop: "-4px"
          }}>
            <span
              onClick={handleForgotPassword}
              style={{
                color: "#f56565",
                fontSize: "13px",
                cursor: "pointer",
                transition: "opacity 0.2s"
              }}
              onMouseOver={(e) => e.target.style.opacity = "0.8"}
              onMouseOut={(e) => e.target.style.opacity = "1"}
            >
              Forgot Password?
            </span>
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In →"}
          </button>
        </form>

        <div className="auth-switch">
          Don't have an account?{" "}
          <span onClick={onSwitch}>Sign Up</span>
        </div>
      </div>
    </div>
  );
}
