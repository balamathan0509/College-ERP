// src/pages/Signup.js
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { sendEmail } from "../utils/notifications";
import StudentSignup from "./signup/StudentSignup";
import OtpVerification from "./signup/OtpVerification";
import CreatingAccount from "./signup/CreatingAccount";
import { db } from "../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function Signup({ onSwitch }) {
  const [step, setStep] = useState("form");
  const [form, setForm] = useState({
    name: "", email: "", password: "", confirmPassword: "",
    dept: "", year: "", registerNo: "", phone: "", studentType: "dayscholar"
  });
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState("");
  const { signup } = useAuth();
  const navigate = useNavigate();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    setSendingOtp(true);
    try {
      if (form.registerNo) {
        const q = query(
          collection(db, "users"),
          where("registerNo", "==", form.registerNo.trim())
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setError("❌ This Register Number is already registered!");
          setSendingOtp(false);
          return;
        }
      }

      const newOtp = generateOTP();
      setGeneratedOtp(newOtp);
      await sendEmail({
        toEmail: form.email,
        toName: form.name,
        subject: "🔐 Your College Portal OTP",
        message: `Your OTP for College Portal signup is: ${newOtp}\n\nThis OTP is valid for 10 minutes. Do not share it with anyone.`
      });
      setStep("otp");
    } catch (err) {
      setError("Failed to send OTP. Check your email and try again.");
    }
    setSendingOtp(false);
  }

  async function handleOtpVerify(enteredOtp) {
    if (enteredOtp.length !== 6) return setOtpError("Enter all 6 digits.");
    if (enteredOtp !== generatedOtp) {
      setOtpError("❌ Invalid OTP. Please try again.");
      return;
    }
    setOtpError("");
    setStep("creating");
    try {
      const profileData = {
        name: form.name, 
        role: "student", 
        isSuperAdmin: false,
        dept: form.dept || "ALL",
        phone: form.phone, 
        emailVerified: true,
        year: form.year, 
        registerNo: form.registerNo,
        studentType: form.studentType || "dayscholar"
      };
      await signup(form.email, form.password, profileData);
      navigate("/student");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") setError("Email already registered.");
      else setError("Signup failed. Try again.");
      setStep("form");
    }
  }

  async function handleResendOtp() {
    setSendingOtp(true);
    try {
      const newOtp = generateOTP();
      setGeneratedOtp(newOtp);
      await sendEmail({
        toEmail: form.email,
        toName: form.name,
        subject: "🔐 Your College Portal OTP (Resend)",
        message: `Your new OTP: ${newOtp}\n\nValid for 10 minutes.`
      });
      setOtpError("");
    } catch (err) {
      setOtpError("Failed to resend. Try again.");
    }
    setSendingOtp(false);
  }

  // Form Step
  if (step === "form") {
    return (
      <StudentSignup 
        form={form} 
        handleChange={handleChange} 
        onSubmit={handleFormSubmit} 
        error={error} 
        sendingOtp={sendingOtp} 
        onBack={onSwitch} 
      />
    );
  }

  // OTP Verification Step
  if (step === "otp") {
    return (
      <OtpVerification
        form={form}
        onVerify={handleOtpVerify}
        onResend={handleResendOtp}
        otpError={otpError}
        sendingOtp={sendingOtp}
      />
    );
  }

  // Creating Account Step
  if (step === "creating") {
    return <CreatingAccount />;
  }

  return null;
}
