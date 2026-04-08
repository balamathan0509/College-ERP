// src/pages/Signup.js
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { sendEmail } from "../utils/notifications";
import RoleSelect from "./signup/RoleSelect";
import StudentSignup from "./signup/StudentSignup";
import StaffSignup from "./signup/StaffSignup";
import HodSignup from "./signup/HodSignup";
import WardenSignup from "./signup/WardenSignup";
import OfficeSignup from "./signup/OfficeSignup";
import ManagementSignup from "./signup/ManagementSignup";
import OtpVerification from "./signup/OtpVerification";
import CreatingAccount from "./signup/CreatingAccount";

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function Signup({ onSwitch }) {
  const [step, setStep] = useState("role");
  const [role, setRole] = useState("");
  const [studentType, setStudentType] = useState("");
  const [form, setForm] = useState({
    name: "", email: "", password: "", confirmPassword: "",
    dept: "", year: "", registerNo: "", phone: ""
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

  function handleRoleSelect(selectedRole) {
    setRole(selectedRole);
    setStep("form");
  }

  function handleStudentTypeSelect(selectedType) {
    setStudentType(selectedType);
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    setSendingOtp(true);
    try {
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
        name: form.name, role, dept: form.dept || "ALL",
        phone: form.phone, emailVerified: true,
        ...(role === "student" && { year: form.year, registerNo: form.registerNo, studentType })
      };
      await signup(form.email, form.password, profileData);
      const redirectMap = {
        student: "/student", staff: "/staff", hod: "/hod",
        security: "/security/profile", warden: "/warden",
        officestaff: "/officestaff", management: "/management"
      };
      navigate(redirectMap[role] || "/");
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

  // Role Selection Step
  if (step === "role") {
    return <RoleSelect onRoleSelect={handleRoleSelect} onStudentTypeSelect={handleStudentTypeSelect} />;
  }

  // Form Step - Render appropriate form based on role
  if (step === "form") {
    const commonProps = { form, handleChange, onSubmit: handleFormSubmit, error, sendingOtp, onBack: onSwitch };

    switch (role) {
      case "student":
        return <StudentSignup {...commonProps} />;
      case "staff":
      case "security":
        return <StaffSignup {...commonProps} />;
      case "hod":
        return <HodSignup {...commonProps} />;
      case "warden":
        return <WardenSignup {...commonProps} />;
      case "officestaff":
        return <OfficeSignup {...commonProps} />;
      case "management":
        return <ManagementSignup {...commonProps} />;
      default:
        return <RoleSelect onRoleSelect={handleRoleSelect} onStudentTypeSelect={handleStudentTypeSelect} />;
    }
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
