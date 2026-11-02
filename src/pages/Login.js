import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs } from "../supabase/supabaseAdapter";
import { db, auth } from "../supabase/supabaseAdapter";

import { ArrowRight, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const cleanEmail = email.trim();
    try {
      const result = await login(cleanEmail, password);
      const SUPER_ADMIN_EMAIL = "balamathan0509@gmail.com";
      const userUid = result?.user?.uid;
      const userEmail = result?.user?.email || cleanEmail;
      
      let userData = null;
      try {
        if (userUid) {
          const userDoc = await getDoc(doc(db, "users", userUid));
          if (userDoc.exists()) {
            userData = userDoc.data();
          }
        }
        if (!userData && userEmail) {
          const q = query(collection(db, "users"), where("email", "==", userEmail));
          const snap = await getDocs(q);
          if (!snap.empty) {
            userData = snap.docs[0].data();
          }
        }
      } catch (firestoreErr) {
        console.error("Firestore read failed:", firestoreErr);
      }

      let rawRole = (userData?.role || "").toLowerCase().trim();
      const designation = (userData?.designation || "").toLowerCase().trim();

      // Normalize role
      if (rawRole.endsWith("hod") || rawRole.includes("hod") || designation.includes("hod")) {
        rawRole = "hod";
      } else if (rawRole === "faculty" || rawRole === "teacher") {
        rawRole = "staff";
      }

      if (userData?.isSuperAdmin === true || userEmail === SUPER_ADMIN_EMAIL) {
        navigate("/admin");
      } else if (rawRole === "hod" || rawRole.includes("hod")) {
        navigate("/hod");
      } else if (rawRole === "staff" || rawRole.includes("staff") || rawRole.includes("faculty") || rawRole === "dept_admin") {
        navigate("/staff");
      } else if (rawRole === "student" || rawRole.includes("student")) {
        navigate("/student");
      } else if (rawRole === "warden" || rawRole.includes("warden")) {
        navigate("/warden");
      } else if (rawRole === "security" || rawRole.includes("security")) {
        navigate("/security/verify");
      } else if (rawRole === "officestaff" || rawRole.includes("office")) {
        navigate("/officestaff");
      } else if (rawRole === "management" || rawRole.includes("management")) {
        navigate("/management");
      } else if (rawRole === "principal" || rawRole.includes("principal")) {
        navigate("/principal");
      } else if (rawRole === "exam_cell" || rawRole.includes("exam")) {
        navigate("/exam_cell");
      } else if (userData) {
        // Default to student if profile exists but role wasn't explicitly matched
        navigate("/student");
      } else {
        setError("Login successful, but user profile was not found. Please contact Administrator.");
      }
    } catch (err) {
      console.error("Login error detail:", err);
      let errMsg = "Invalid email or password. Please try again.";
      if (err?.code === "auth/user-not-found" || err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential") {
        errMsg = "Invalid email or password. Please check your credentials.";
      } else if (err?.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    }
    setLoading(false);
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
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: "40px", width: "100%", boxSizing: "border-box" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#6b7280",
                  display: "flex",
                  alignItems: "center",
                  padding: 0
                }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: "16px" }}>
            {loading ? "Signing in..." : <>Sign In <ArrowRight size={16} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
