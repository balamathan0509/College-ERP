// src/pages/Profile.js
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import DateTimeHeader from "../components/DateTimeHeader";
import { useAuth } from "../context/AuthContext";
import { db, doc, updateDoc, uploadFileToSupabase } from "../supabase/supabaseAdapter";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "../supabase/supabaseAdapter";
import {
  User,
  Camera,
  Lock,
  Edit2,
  CheckCircle2,
  Save,
  Clock,
  ShieldCheck,
  GraduationCap,
  Users,
  MapPin,
  Mail,
  Calendar,
  LayoutDashboard,
  CheckSquare,
  Award
} from "lucide-react";

// Reusable Detail Card matching Student Dashboard theme & layout
function DetailCard({ title, subtitle, icon: Icon, iconBg = "#eff6ff", iconColor = "#2563eb", children }) {
  return (
    <div style={{
      background: "#ffffff",
      borderRadius: 12,
      border: "1px solid #e2e8f0",
      padding: "20px 24px",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)"
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: 14,
        marginBottom: 16,
        borderBottom: "1px solid #f1f5f9"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}>
            <Icon size={18} color={iconColor} />
          </div>
          <div>
            <h3 style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: "#1e293b",
              fontFamily: "Plus Jakarta Sans, sans-serif"
            }}>
              {title}
            </h3>
            {subtitle && (
              <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#94a3b8" }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: "16px 20px"
      }}>
        {children}
      </div>
    </div>
  );
}

// Reusable Detail Item
function DetailItem({ label, value, isCode = false }) {
  const displayVal = value !== undefined && value !== null && String(value).trim() !== "" ? String(value).trim() : "—";
  const isAvailable = displayVal !== "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <span style={{
        fontSize: "11px",
        fontWeight: 500,
        color: "#64748b",
        textTransform: "uppercase",
        letterSpacing: "0.03em"
      }}>
        {label}
      </span>
      <span style={{
        fontSize: "13.5px",
        fontWeight: 600,
        color: isAvailable ? "#0f172a" : "#94a3b8",
        fontFamily: isCode ? "monospace" : "inherit",
        wordBreak: "break-word"
      }}>
        {displayVal}
      </span>
    </div>
  );
}

export default function Profile() {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const role = userProfile?.role;
  const isStudent = role === "student";

  // Tab State: Default for student is full details
  const [tab, setTab] = useState(isStudent ? "details" : "profile");
  const [studentCategory, setStudentCategory] = useState("academic");
  const fileInputRef = useRef();

  const [phone, setPhone] = useState(userProfile?.phone || "");
  const [name, setName] = useState(userProfile?.name || "");
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (userProfile) {
      if (userProfile.name) setName(userProfile.name);
      if (userProfile.phone) setPhone(userProfile.phone);
      if (userProfile.photoURL) setPhotoURL(userProfile.photoURL);
      if (userProfile.role === "student" && tab !== "password" && tab !== "profile") {
        setTab("details");
      }
    }
  }, [userProfile]);

  async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setUploadError("File size must be under 5MB.");
    if (!file.type.startsWith("image/")) return setUploadError("Please select an image file.");
    setUploading(true);
    setUploadError("");
    try {
      const targetUid = currentUser?.uid || currentUser?.id || userProfile?.uid || userProfile?.id;
      if (!targetUid) throw new Error("User ID not found.");
      
      const ext = file.name.split(".").pop();
      const filePath = `profile_${targetUid}_${Date.now()}.${ext}`;
      
      let publicUrl = "";
      try {
        publicUrl = await uploadFileToSupabase("profiles", filePath, file);
      } catch (storageErr) {
        console.warn("Storage upload fallback to base64 data URL:", storageErr);
        const reader = new FileReader();
        publicUrl = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
      }

      setPhotoURL(publicUrl);
      
      const userRef = doc(db, "users", targetUid);
      await updateDoc(userRef, { photoURL: publicUrl });

      if (refreshProfile) await refreshProfile();
    } catch (err) {
      console.error("Photo upload error:", err);
      setUploadError("Photo upload failed: " + (err.message || "Try again"));
    }
    setUploading(false);
  }

  async function saveProfile() {
    setProfileError(""); setProfileSaved(false);
    if (!name.trim()) return setProfileError("Name cannot be empty.");
    setProfileSaving(true);
    try {
      const targetUid = currentUser?.uid || currentUser?.id || userProfile?.uid || userProfile?.id;
      if (!targetUid) throw new Error("User ID not found.");
      
      const userRef = doc(db, "users", targetUid);
      await updateDoc(userRef, { name, phone, photoURL });

      if (refreshProfile) await refreshProfile();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setProfileError(err.message || "Failed to update profile.");
    }
    setProfileSaving(false);
  }

  async function changePassword() {
    setPasswordError(""); setPasswordSuccess("");
    if (!currentPassword) return setPasswordError("Enter current password.");
    if (newPassword.length < 6) return setPasswordError("New password must be at least 6 characters.");
    if (newPassword !== confirmPassword) return setPasswordError("Passwords do not match.");

    setPasswordSaving(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      if (err.code === "auth/wrong-password") setPasswordError("Current password is incorrect.");
      else setPasswordError("Failed to change password. Try again.");
    }
    setPasswordSaving(false);
  }

  const initials = userProfile?.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "ST";

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content" style={{ background: "#f3f4f8" }}>
        {/* Date Time Header matching Dashboard */}
        <DateTimeHeader />

        {/* Hero Student Profile Card — exactly matching Student Dashboard style */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            padding: "18px 24px",
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            {/* Avatar / Photo with upload trigger */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              {photoURL ? (
                <img src={photoURL} alt="Profile" style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover", border: "2px solid #e2e8f0" }} />
              ) : (
                <div style={{
                  width: 72, height: 72, borderRadius: 12,
                  background: "#0f172a", border: "2px solid #cbd5e1",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, color: "#ffffff"
                }}>
                  {initials}
                </div>
              )}
              <div onClick={() => fileInputRef.current.click()} style={{
                position: "absolute", bottom: -4, right: -4, width: 24, height: 24,
                borderRadius: 6, background: "#2563eb", display: "flex", alignItems: "center",
                justifyContent: "center", cursor: "pointer", color: "white", boxShadow: "0 2px 4px rgba(0,0,0,0.15)"
              }} title="Upload Photo">
                {uploading ? <Clock size={12} /> : <Camera size={12} />}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />
            </div>

            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: "700",
                  color: "#0f172a",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                  letterSpacing: "-0.01em"
                }}
              >
                {isStudent ? "STUDENT PROFILE" : "MY PROFILE & SECURITY"}
              </h1>
              <div
                style={{
                  margin: "6px 0 0 0",
                  color: "#64748b",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap"
                }}
              >
                <strong style={{ color: "#0f172a" }}>{userProfile?.name || "Student"}</strong>
                <span style={{ color: "#cbd5e1" }}>•</span>
                <span>{userProfile?.dept || userProfile?.department || userProfile?.programmeCode} Department</span>
                <span style={{ color: "#cbd5e1" }}>•</span>
                <span>{userProfile?.year}</span>
                {userProfile?.semester && (
                  <>
                    <span style={{ color: "#cbd5e1" }}>•</span>
                    <span>Sem {userProfile.semester}</span>
                  </>
                )}
                {userProfile?.section && (
                  <>
                    <span style={{ color: "#cbd5e1" }}>•</span>
                    <span>Sec {userProfile.section}</span>
                  </>
                )}
                {(userProfile?.registerNo || userProfile?.registerNumber || userProfile?.rollNo) && (
                  <>
                    <span style={{ color: "#cbd5e1" }}>•</span>
                    <span>Reg No: <strong style={{ color: "#334155" }}>{userProfile.registerNo || userProfile.registerNumber || userProfile.rollNo}</strong></span>
                  </>
                )}
                {userProfile?.studentType && (
                  <span
                    style={{
                      padding: "2px 8px",
                      background: "#fef3c7",
                      border: "1px solid #fde68a",
                      color: "#92400e",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    {userProfile.studentType === "hosteller" ? "Hosteller" : "Day Scholar"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Button matching Dashboard */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => navigate("/student")}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: "#f8fafc",
                color: "#334155",
                border: "1px solid #cbd5e1",
                fontWeight: 600,
                fontSize: 12.5,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s ease"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.borderColor = "#bfdbfe"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
            >
              <LayoutDashboard size={14} /> Back to Dashboard
            </button>
          </div>
        </div>

        {/* Email & Status Banner matching Dashboard Calendar strip */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            padding: "10px 18px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Mail size={16} color="#2563eb" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
              Official College ID: <strong style={{ color: "#0f172a" }}>{userProfile?.collegeEmail || userProfile?.officialEmail || `${userProfile?.registerNo}@rvce.ac.in`}</strong>
            </span>
            <span style={{ color: "#cbd5e1" }}>•</span>
            <span style={{ fontSize: 13, color: "#64748b" }}>
              Personal Login Email: <strong style={{ color: "#334155" }}>{userProfile?.personalEmail || userProfile?.email}</strong>
            </span>
            {userProfile?.batch && (
              <>
                <span style={{ color: "#cbd5e1" }}>•</span>
                <span style={{ fontSize: 13, color: "#64748b" }}>Batch: <strong>{userProfile.batch}</strong></span>
              </>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
            Status: <span style={{ color: "#16a34a", fontWeight: 700 }}>● Active Enrolled</span>
          </div>
        </div>

        {/* Navigation Tabs matching Dashboard Buttons */}
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          {isStudent && (
            <button
              onClick={() => setTab("details")}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: tab === "details" ? "none" : "1px solid #e2e8f0",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                transition: "all 0.15s ease",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: tab === "details" ? "#2563eb" : "#ffffff",
                color: tab === "details" ? "#ffffff" : "#475569",
                boxShadow: tab === "details" ? "0 2px 4px rgba(37,99,235,0.2)" : "none"
              }}
            >
              <GraduationCap size={15} /> Student Complete Details
            </button>
          )}

          {!isStudent && (
            <button
              onClick={() => setTab("profile")}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: tab === "profile" ? "none" : "1px solid #e2e8f0",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                transition: "all 0.15s ease",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: tab === "profile" ? "#2563eb" : "#ffffff",
                color: tab === "profile" ? "#ffffff" : "#475569",
                boxShadow: tab === "profile" ? "0 2px 4px rgba(37,99,235,0.2)" : "none"
              }}
            >
              <Edit2 size={14} /> Account Information
            </button>
          )}

          <button
            onClick={() => setTab("password")}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: tab === "password" ? "none" : "1px solid #e2e8f0",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              transition: "all 0.15s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: tab === "password" ? "#2563eb" : "#ffffff",
              color: tab === "password" ? "#ffffff" : "#475569",
              boxShadow: tab === "password" ? "0 2px 4px rgba(37,99,235,0.2)" : "none"
            }}
          >
            <Lock size={14} /> Change Password
          </button>
        </div>

        {/* TAB 1: COMPLETE STUDENT DETAILS */}
        {tab === "details" && isStudent && (
          <div>
            {/* Category Filter Pills (Without 'All Details' - Each category shown separately) */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "18px" }}>
              {[
                { id: "academic", label: "Academic & Admission" },
                { id: "personal", label: "Personal & Identity" },
                { id: "family", label: "Parents & Family" },
                { id: "address", label: "Address & Contact" }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setStudentCategory(cat.id)}
                  style={{
                    padding: "7px 16px",
                    borderRadius: "8px",
                    border: studentCategory === cat.id ? "1.5px solid #2563eb" : "1px solid #cbd5e1",
                    background: studentCategory === cat.id ? "#eff6ff" : "#ffffff",
                    color: studentCategory === cat.id ? "#1d4ed8" : "#475569",
                    fontSize: "12.5px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: studentCategory === cat.id ? "0 1px 2px rgba(37,99,235,0.12)" : "none"
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Structured ERP Cards — Shown individually per category */}
            <div>
              {/* Card 1: Academic & Admission */}
              {studentCategory === "academic" && (
                <DetailCard
                  title="Academic & Admission Details"
                  subtitle="Curriculum, batch, enrollment & college identifiers"
                  icon={GraduationCap}
                  iconBg="#eff6ff"
                  iconColor="#2563eb"
                >
                  <DetailItem label="Register Number" value={userProfile?.registerNo || userProfile?.registerNumber || userProfile?.rollNo} isCode />
                  <DetailItem label="Roll Number" value={userProfile?.rollNo || userProfile?.registerNo} isCode />
                  <DetailItem label="Department / Branch" value={userProfile?.dept || userProfile?.department || userProfile?.programmeCode} />
                  <DetailItem label="Degree" value={userProfile?.degree || "B.E."} />
                  <DetailItem label="Current Year & Sem" value={`${userProfile?.year || "—"}${userProfile?.semester ? ` (Semester ${userProfile.semester})` : ""}`} />
                  <DetailItem label="Class / Section" value={userProfile?.section ? `Section ${userProfile.section}` : "Single Class"} />
                  <DetailItem label="Batch" value={userProfile?.batch} />
                  <DetailItem label="Regulation" value={userProfile?.regulation} />
                  <DetailItem label="Admission Number" value={userProfile?.admissionNumber} />
                  <DetailItem label="Admission Type" value={userProfile?.admissionType} />
                  <DetailItem label="Academic Session" value={userProfile?.academicSession || userProfile?.academicYear || userProfile?.admissionYear} />
                  <DetailItem label="Date of Admission" value={userProfile?.dateOfAdmission} />
                  <DetailItem label="Student Type" value={userProfile?.studentType ? (userProfile.studentType === "hosteller" ? "Hosteller" : "Dayscholar") : "—"} />
                  <DetailItem label="Official College Email" value={userProfile?.collegeEmail || userProfile?.officialEmail} />
                  <DetailItem label="Scholarship" value={userProfile?.scholarship} />
                  <DetailItem label="College Bus User" value={userProfile?.usesCollegeBus} />
                  <DetailItem label="Lateral Entry" value={userProfile?.lateralEntry || "No"} />
                  <DetailItem label="EMIS Number" value={userProfile?.emisNumber} />
                  <DetailItem label="UMIS Number" value={userProfile?.umisNumber} />
                  <DetailItem label="APAAR ID" value={userProfile?.apaarId} />
                </DetailCard>
              )}

              {/* Card 2: Personal & Identity */}
              {studentCategory === "personal" && (
                <DetailCard
                  title="Personal & Identity Details"
                  subtitle="Birth date, blood group, government and identity records"
                  icon={User}
                  iconBg="#ecfdf5"
                  iconColor="#059669"
                >
                  <DetailItem label="Full Name" value={userProfile?.name || userProfile?.studentName || userProfile?.fullName} />
                  <DetailItem label="Date of Birth (DOB)" value={userProfile?.dob} />
                  <DetailItem label="Gender" value={userProfile?.gender} />
                  <DetailItem label="Blood Group" value={userProfile?.bloodGroup} />
                  <DetailItem label="Religion" value={userProfile?.religion} />
                  <DetailItem label="Community" value={userProfile?.community} />
                  <DetailItem label="Caste" value={userProfile?.caste} />
                  <DetailItem label="Aadhaar Number" value={userProfile?.aadhaarNumber} isCode />
                  <DetailItem label="Primary Mobile" value={userProfile?.mobile || userProfile?.phone} />
                  <DetailItem label="Personal Email (Login ID)" value={userProfile?.personalEmail || userProfile?.email} />
                </DetailCard>
              )}

              {/* Card 3: Parents & Family Details */}
              {studentCategory === "family" && (
                <DetailCard
                  title="Parents & Family Details"
                  subtitle="Parent contacts, occupation & household particulars"
                  icon={Users}
                  iconBg="#fffbeb"
                  iconColor="#d97706"
                >
                  <DetailItem label="Father's Name" value={userProfile?.fatherName} />
                  <DetailItem label="Father's Contact No" value={userProfile?.fatherMobile} />
                  <DetailItem label="Father's Annual Income" value={userProfile?.fatherIncome ? `₹${userProfile.fatherIncome}` : "—"} />
                  <DetailItem label="Mother's Name" value={userProfile?.motherName} />
                  <DetailItem label="Mother's Contact No" value={userProfile?.motherMobile} />
                  <DetailItem label="Mother's Annual Income" value={userProfile?.motherIncome ? `₹${userProfile.motherIncome}` : "—"} />
                  <DetailItem label="Single Parent" value={userProfile?.singleParent || "No"} />
                </DetailCard>
              )}

              {/* Card 4: Address & Contact */}
              {studentCategory === "address" && (
                <DetailCard
                  title="Address & Contact Details"
                  subtitle="Permanent residential address, district & pin"
                  icon={MapPin}
                  iconBg="#fdf2f8"
                  iconColor="#db2777"
                >
                  <DetailItem label="Permanent Address" value={userProfile?.address} />
                  <DetailItem label="Street / Area" value={userProfile?.streetArea} />
                  <DetailItem label="City / Village / Town" value={userProfile?.cityVillage} />
                  <DetailItem label="District" value={userProfile?.district} />
                  <DetailItem label="State" value={userProfile?.state} />
                  <DetailItem label="Pincode" value={userProfile?.pincode} isCode />
                </DetailCard>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: EDIT CONTACT / ACCOUNT INFORMATION */}
        {tab === "profile" && (
          <div style={{
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            padding: "24px",
            maxWidth: 600,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)"
          }}>
            <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "#1e293b" }}>
              {isStudent ? "Update Contact Information" : "Account Information"}
            </h3>
            {profileError && (
              <div style={{ marginBottom: 16, color: "#dc2626", background: "#fef2f2", border: "1px solid #fee2e2", padding: "10px 14px", borderRadius: "8px", fontSize: "13px" }}>
                {profileError}
              </div>
            )}
            {profileSaved && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px 16px", color: "#15803d", fontSize: 13, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={16} /> Profile updated successfully!
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155", display: "block", marginBottom: 6 }}>Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                required
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155", display: "block", marginBottom: 6 }}>Email Address (Login ID)</label>
              <input
                type="email"
                value={userProfile?.personalEmail || userProfile?.email || currentUser?.email}
                disabled
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: "13px", boxSizing: "border-box", cursor: "not-allowed" }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155", display: "block", marginBottom: 6 }}>Department</label>
              <input
                type="text"
                value={userProfile?.dept || userProfile?.department || userProfile?.programmeCode || ""}
                disabled
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: "13px", boxSizing: "border-box", cursor: "not-allowed" }}
              />
            </div>
            {userProfile?.year && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155", display: "block", marginBottom: 6 }}>Year & Semester</label>
                <input
                  type="text"
                  value={`${userProfile?.year}${userProfile?.semester ? ` (Semester ${userProfile.semester})` : ""}`}
                  disabled
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: "13px", boxSizing: "border-box", cursor: "not-allowed" }}
                />
              </div>
            )}
            {(userProfile?.registerNo || userProfile?.registerNumber) && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155", display: "block", marginBottom: 6 }}>Register Number</label>
                <input
                  type="text"
                  value={userProfile?.registerNo || userProfile?.registerNumber}
                  disabled
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: "13px", boxSizing: "border-box", cursor: "not-allowed", fontFamily: "monospace" }}
                />
              </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155", display: "block", marginBottom: 6 }}>Contact Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
            <button
              onClick={saveProfile}
              disabled={profileSaving}
              style={{
                padding: "9px 20px",
                borderRadius: 8,
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
                transition: "background 0.15s ease"
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#1d4ed8")}
              onMouseLeave={e => (e.currentTarget.style.background = "#2563eb")}
            >
              {profileSaving ? "Saving..." : <>Save Profile Changes <Save size={14} /></>}
            </button>
          </div>
        )}

        {/* TAB 3: CHANGE PASSWORD */}
        {tab === "password" && (
          <div style={{
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            padding: "24px",
            maxWidth: 540,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)"
          }}>
            <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "#1e293b" }}>
              Update Account Password
            </h3>
            {passwordError && (
              <div style={{ marginBottom: 16, color: "#dc2626", background: "#fef2f2", border: "1px solid #fee2e2", padding: "10px 14px", borderRadius: "8px", fontSize: "13px" }}>
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px 16px", color: "#15803d", fontSize: 13, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={16} /> {passwordSuccess}
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155", display: "block", marginBottom: 6 }}>Current Password *</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155", display: "block", marginBottom: 6 }}>New Password *</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155", display: "block", marginBottom: 6 }}>Confirm New Password *</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
            <button
              onClick={changePassword}
              disabled={passwordSaving}
              style={{
                padding: "9px 20px",
                borderRadius: 8,
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
                transition: "background 0.15s ease"
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#1d4ed8")}
              onMouseLeave={e => (e.currentTarget.style.background = "#2563eb")}
            >
              {passwordSaving ? "Updating Password..." : <>Change Password <ShieldCheck size={14} /></>}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
