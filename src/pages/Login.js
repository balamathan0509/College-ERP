// src/pages/Login.js
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";

export default function Login({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      const userDoc = await getDoc(doc(db, "users", result.user.uid));
      const userData = userDoc.data();
      const role = userData?.role;
      const SUPER_ADMIN_EMAIL = "balamathan0509@gmail.com";

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

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">🎓</div>
          <h1>College Portal</h1>
          <p>Sign in to your account</p>
        </div>

        {error && <div className="error-msg">{error}</div>}

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
