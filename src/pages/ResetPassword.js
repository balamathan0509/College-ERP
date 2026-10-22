import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase/config";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, KeyRound } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if recovery session or token is available
    const checkSession = async () => {
      // 1. Listen for Supabase password recovery event
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "PASSWORD_RECOVERY" || session) {
          setSessionReady(true);
        }
      });

      // 2. Check current session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionReady(true);
      } else {
        // If hash contains type=recovery or access_token, allow a moment for supabase to parse it
        if (window.location.hash.includes("type=recovery") || window.location.hash.includes("access_token")) {
          setSessionReady(true);
        }
      }

      return () => {
        subscription?.unsubscribe();
      };
    };

    checkSession();
  }, []);

  async function handleResetPassword(e) {
    e.preventDefault();
    setError("");

    if (!password) {
      setError("Please enter a new password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        throw updateError;
      }

      // Password successfully updated!
      setSuccess(true);

      // Sign out to enforce clean login with new password
      await supabase.auth.signOut().catch(() => {});
      sessionStorage.clear();
    } catch (err) {
      console.error("Password reset error:", err);
      setError(err?.message || "Failed to update password. Please try requesting a new link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ maxWidth: "440px", width: "100%" }}>
        <div className="auth-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '8px', width: '100%' }}>
            <img 
              src="/seal-logo.png" 
              alt="College Seal" 
              style={{ 
                height: '75px', 
                width: 'auto',
                objectFit: 'contain'
              }} 
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <h1 style={{ margin: 0, fontSize: '38px', fontWeight: '800', color: '#1e3a8a', letterSpacing: '1px', lineHeight: '1' }}>RVCE</h1>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#1e3a8a', textAlign: 'center', marginTop: '4px', letterSpacing: '0.5px' }}>
                RENGANAYAGI VARATHARAJ<br/>COLLEGE OF ENGINEERING
              </div>
            </div>
            <img 
              src="/college-logo.png" 
              alt="College Logo" 
              style={{ 
                height: '75px', 
                width: 'auto',
                objectFit: 'contain'
              }} 
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', color: '#1e3a8a' }}>
            <KeyRound size={20} />
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Create New Password</h2>
          </div>
          <p style={{ margin: '6px 0 0 0', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
            Enter your new password below to regain access to your ERP account.
          </p>
        </div>

        {error && (
          <div className="error-msg" style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#dc2626",
            padding: "12px 16px",
            borderRadius: "10px",
            marginBottom: "16px",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto"
            }}>
              <CheckCircle2 size={36} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", margin: "0 0 8px 0" }}>
              Password Reset Successful!
            </h3>
            <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 24px 0", lineHeight: "1.5" }}>
              Your password has been updated successfully. You can now log in using your new credentials.
            </p>
            <button
              className="btn-primary"
              onClick={() => navigate("/")}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
            >
              Back to Sign In <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleResetPassword}>
            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                New Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter at least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    paddingRight: "40px",
                    width: "100%",
                    boxSizing: "border-box"
                  }}
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

            <div className="form-group" style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                Confirm New Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{
                    paddingRight: "40px",
                    width: "100%",
                    boxSizing: "border-box"
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              className="btn-primary"
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "12px",
                fontSize: "15px",
                fontWeight: "600"
              }}
            >
              {loading ? "Updating Password..." : <>Update Password <ArrowRight size={16} /></>}
            </button>

            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <span
                onClick={() => navigate("/")}
                style={{
                  color: "var(--highlight)",
                  fontSize: "13px",
                  cursor: "pointer",
                  fontWeight: 500
                }}
              >
                Back to Sign In
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
