import React, { useState } from "react";

export default function OtpVerification({ form, onVerify, onResend, otpError, sendingOtp }) {
  const [otp, setOtp] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    onVerify(otp);
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">🔐</div>
          <h1>Verify OTP</h1>
          <p>We sent a 6-digit code to {form.email}</p>
        </div>

        {otpError && <div className="error-msg">{otpError}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>OTP</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter 6-digit OTP"
              required
            />
          </div>
          <button className="btn-primary" type="submit" disabled={sendingOtp}>
            {sendingOtp ? "Verifying..." : "Verify OTP"}
          </button>
        </form>

        <button className="btn-secondary" type="button" onClick={onResend} disabled={sendingOtp}>
          {sendingOtp ? "Sending..." : "Resend OTP"}
        </button>
      </div>
    </div>
  );
}
