import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase/config";
import { sendPasswordResetEmail } from "firebase/auth";
import { GraduationCap, ArrowRight, CheckCircle2 } from "lucide-react";

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
      }

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
      setSuccessMsg("Password reset email sent! Check your inbox (and spam folder).");
    } catch (err) {
      setError("Could not send reset email. Make sure the email is correct.");
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '8px', width: '100%' }}>
            <img 
              src="/seal-logo.png" 
              alt="College Seal" 
              style={{ 
                height: '80px', 
                width: 'auto',
                objectFit: 'contain'
              }} 
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <h1 style={{ margin: 0, fontSize: '42px', fontWeight: '800', color: '#1e3a8a', letterSpacing: '1px', lineHeight: '1' }}>RVCE</h1>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#1e3a8a', textAlign: 'center', marginTop: '4px', letterSpacing: '0.5px' }}>
                RENGANAYAGI VARATHARAJ<br/>COLLEGE OF ENGINEERING
              </div>
            </div>
            <img 
              src="/college-logo.png" 
              alt="College Logo" 
              style={{ 
                height: '80px', 
                width: 'auto',
                objectFit: 'contain'
              }} 
            />
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>Sign in to your account</p>
        </div>

        {error && <div className="error-msg">{error}</div>}
        {successMsg && <div className="success-msg" style={{
          background: "rgba(16, 185, 129, 0.15)",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          color: "var(--success)",
          padding: "12px 16px",
          borderRadius: "10px",
          marginBottom: "16px",
          fontSize: "14px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          justifyContent: "center"
        }}><CheckCircle2 size={16} /> {successMsg}</div>}

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
            marginBottom: "16px",
            marginTop: "-4px"
          }}>
            <span
              onClick={handleForgotPassword}
              style={{
                color: "var(--highlight)",
                fontSize: "13px",
                cursor: "pointer",
                fontWeight: 500
              }}
            >
              Forgot Password?
            </span>
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Signing in..." : <>Sign In <ArrowRight size={16} /></>}
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
