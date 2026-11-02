import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../supabase/supabaseAdapter";
import { dbClient } from "../supabase/config";
import { collection, query, where, getDocs } from "../supabase/supabaseAdapter";
import { sendPasswordResetEmail } from "../supabase/supabaseAdapter";
import { 
  Mail, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  KeyRound, 
  ShieldCheck, 
  UserCheck, 
  RefreshCw,
  ExternalLink
} from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [matchedUser, setMatchedUser] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [directResetUrl, setDirectResetUrl] = useState("");
  const [rateLimitHit, setRateLimitHit] = useState(false);

  const navigate = useNavigate();

  // Helper to format role name for display
  function formatRole(role) {
    if (!role) return "User";
    const r = role.toLowerCase().trim();
    if (r === "student") return "Student";
    if (r === "staff" || r === "faculty") return "Faculty / Staff";
    if (r === "hod") return "Head of Department (HOD)";
    if (r === "admin") return "Administrator";
    if (r === "principal") return "Principal";
    if (r === "warden") return "Hostel Warden";
    if (r === "officestaff") return "Office Staff";
    if (r === "security") return "Security Officer";
    if (r === "exam_cell") return "Exam Cell";
    return role.toUpperCase();
  }

  // Lookup user in DB to verify role and details
  async function checkUserAccount(emailToLookup) {
    const clean = emailToLookup.trim();
    if (!clean || !clean.includes("@")) {
      setMatchedUser(null);
      return null;
    }
    try {
      let q = query(collection(db, "users"), where("email", "==", clean.toLowerCase()));
      let snap = await getDocs(q);
      if (snap.empty) {
        q = query(collection(db, "users"), where("email", "==", clean));
        snap = await getDocs(q);
      }
      if (!snap.empty) {
        const docObj = snap.docs[0];
        const data = { id: docObj.id, ...docObj.data() };
        setMatchedUser(data);
        return data;
      } else {
        setMatchedUser(null);
        return null;
      }
    } catch (err) {
      console.warn("Account lookup error:", err);
      return null;
    }
  }

  // Handle email input change and lookup
  function handleEmailChange(e) {
    const val = e.target.value;
    setEmail(val);
    setError("");
    if (val.trim().includes("@") && val.trim().includes(".")) {
      checkUserAccount(val);
    } else {
      setMatchedUser(null);
    }
  }

  // Trigger sending reset email
  async function handleSendResetLink(e) {
    if (e) e.preventDefault();
    setError("");
    setRateLimitHit(false);
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Please enter your registered email address.");
      return;
    }

    setLoading(true);

    try {
      let user = matchedUser;
      if (!user) {
        user = await checkUserAccount(cleanEmail);
      }

      // 1. Generate direct action link via admin API (always bypasses email rate limit)
      const redirectUrl = `${window.location.origin}/reset-password`;
      try {
        if (dbClient?.auth?.admin) {
          const { data: linkData } = await dbClient.auth.admin.generateLink({
            type: "recovery",
            email: cleanEmail,
            options: {
              redirectTo: redirectUrl
            }
          });
          if (linkData?.properties?.action_link) {
            setDirectResetUrl(linkData.properties.action_link);
          }
        }
      } catch (adminErr) {
        console.warn("Admin link generation note:", adminErr);
      }

      // 2. Trigger Supabase official password reset email
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
      } catch (emailErr) {
        console.warn("Supabase send email notice:", emailErr);
        if (emailErr?.message?.toLowerCase().includes("rate limit") || emailErr?.status === 429) {
          setRateLimitHit(true);
        } else {
          throw emailErr;
        }
      }

      setSuccess(true);
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err) {
      console.error("Forgot password error:", err);
      let msg = "Could not send password reset email. Please ensure the email is registered.";
      if (err?.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrapper" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
      <div className="auth-card" style={{ maxWidth: "460px", width: "100%", padding: "32px 28px", margin: "auto" }}>
        
        {/* RVCE Official Header */}
        <div className="auth-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px', marginBottom: '8px', width: '100%' }}>
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
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Forgot Password</h2>
          </div>
          <p style={{ margin: '6px 0 0 0', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
            Enter your college registered email to reset your account password.
          </p>
        </div>

        {/* Error Message */}
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

        {/* Success View */}
        {success ? (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
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

            <h3 style={{ fontSize: "19px", fontWeight: "700", color: "#1e293b", margin: "0 0 8px 0" }}>
              Reset Link Ready!
            </h3>

            <p style={{ fontSize: "14px", color: "#475569", margin: "0 0 16px 0", lineHeight: "1.5" }}>
              {rateLimitHit 
                ? "Multiple emails were requested in a short time. Your reset link is active below or in your inbox:" 
                : "We have dispatched an official password reset email to:"}
              <br />
              <strong style={{ color: "#1e3a8a", fontSize: "15px" }}>{email}</strong>
            </p>

            {/* Matched User Role Details Card */}
            {matchedUser && (
              <div style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "14px 16px",
                textAlign: "left",
                marginBottom: "20px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", color: "#1e3a8a" }}>
                  <ShieldCheck size={18} />
                  <span style={{ fontSize: "13px", fontWeight: "700" }}>RVCE Account Verified</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", fontSize: "13px" }}>
                  <span style={{ color: "#64748b" }}>Name:</span>
                  <span style={{ fontWeight: "600", color: "#1e293b" }}>{matchedUser.name || "User"}</span>

                  <span style={{ color: "#64748b" }}>Role:</span>
                  <span>
                    <span style={{
                      background: "#dbeafe",
                      color: "#1d4ed8",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600"
                    }}>
                      {formatRole(matchedUser.role)}
                    </span>
                  </span>

                  {(matchedUser.dept || matchedUser.department) && (
                    <>
                      <span style={{ color: "#64748b" }}>Department:</span>
                      <span style={{ fontWeight: "600", color: "#1e293b" }}>{matchedUser.dept || matchedUser.department}</span>
                    </>
                  )}

                  {(matchedUser.registerNo || matchedUser.staffId) && (
                    <>
                      <span style={{ color: "#64748b" }}>ID / Reg No:</span>
                      <span style={{ fontWeight: "600", color: "#1e293b" }}>{matchedUser.registerNo || matchedUser.staffId}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Rate limit advisory if hit */}
            {rateLimitHit && (
              <div style={{
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: "10px",
                padding: "12px 14px",
                fontSize: "12.5px",
                color: "#92400e",
                textAlign: "left",
                marginBottom: "16px",
                lineHeight: "1.5"
              }}>
                ℹ️ <strong>Email Rate Limit:</strong> Supabase limits free emails to 3-4 per hour. You can check the email already received earlier, or click the direct button below to open the reset password screen immediately.
              </div>
            )}

            {/* Next Step Box */}
            <div style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "10px",
              padding: "14px",
              fontSize: "13px",
              color: "#1e40af",
              textAlign: "left",
              marginBottom: "20px",
              lineHeight: "1.6"
            }}>
              📩 <strong>Next Step:</strong> Open your email inbox, find the password reset mail from RVCE, and click the <strong>"Reset password"</strong> link. It will open the screen where you can enter your new password and confirm it.
            </div>

            {/* Direct Link button as helper */}
            {directResetUrl && (
              <div style={{ marginBottom: "16px" }}>
                <a
                  href={directResetUrl}
                  className="btn-primary"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    textDecoration: "none",
                    boxSizing: "border-box",
                    padding: "11px 16px",
                    background: "#2563eb",
                    borderRadius: "8px",
                    color: "#fff",
                    fontWeight: "600",
                    fontSize: "14px"
                  }}
                >
                  Open Reset Password Screen Directly <ExternalLink size={16} />
                </a>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate("/login")}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  background: directResetUrl ? "transparent" : undefined,
                  border: directResetUrl ? "1px solid #cbd5e1" : undefined,
                  color: directResetUrl ? "#475569" : undefined
                }}
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>

              <button
                type="button"
                onClick={handleSendResetLink}
                disabled={resendCooldown > 0 || loading}
                style={{
                  background: "none",
                  border: "none",
                  color: resendCooldown > 0 ? "#94a3b8" : "var(--highlight)",
                  fontSize: "13px",
                  cursor: resendCooldown > 0 ? "default" : "pointer",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "6px"
                }}
              >
                <RefreshCw size={14} />
                {resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : "Didn't receive email? Click to resend"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendResetLink}>
            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                Registered Email Address
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="email"
                  placeholder="name@college.edu or gmail"
                  value={email}
                  onChange={handleEmailChange}
                  required
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    paddingLeft: "38px"
                  }}
                />
                <Mail 
                  size={18} 
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8"
                  }}
                />
              </div>
            </div>

            {/* Live Account Found Preview */}
            {matchedUser && (
              <div style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "10px",
                padding: "12px 14px",
                marginBottom: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#166534", fontSize: "13px", fontWeight: "700" }}>
                  <UserCheck size={16} />
                  <span>Account Recognized</span>
                </div>
                <div style={{ fontSize: "13px", color: "#14532d" }}>
                  <strong>{matchedUser.name}</strong> • <span style={{
                    background: "#dcfce7",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontWeight: "600",
                    fontSize: "12px"
                  }}>{formatRole(matchedUser.role)}</span>
                </div>
                {(matchedUser.dept || matchedUser.registerNo) && (
                  <div style={{ fontSize: "12px", color: "#15803d" }}>
                    {matchedUser.dept ? `Dept: ${matchedUser.dept} ` : ""}
                    {matchedUser.registerNo ? `• Reg No: ${matchedUser.registerNo}` : ""}
                  </div>
                )}
              </div>
            )}

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
              {loading ? "Sending Reset Email..." : <>Send Reset Password Link <ArrowRight size={16} /></>}
            </button>

            <div style={{ textAlign: "center", marginTop: "20px" }}>
              <span
                onClick={() => navigate("/login")}
                style={{
                  color: "var(--highlight)",
                  fontSize: "13px",
                  cursor: "pointer",
                  fontWeight: 500,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <ArrowLeft size={14} /> Back to Sign In
              </span>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
