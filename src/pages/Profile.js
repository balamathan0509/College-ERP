// src/pages/Profile.js
import React, { useState, useRef } from "react";
import Sidebar from "../components/Sidebar";
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
  ShieldCheck
} from "lucide-react";

const CLOUD_NAME = "dpz8bbusa";
const UPLOAD_PRESET = "college_portal";

export default function Profile() {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const [tab, setTab] = useState("profile");
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

  React.useEffect(() => {
    if (userProfile) {
      if (userProfile.name) setName(userProfile.name);
      if (userProfile.phone) setPhone(userProfile.phone);
      if (userProfile.photoURL) setPhotoURL(userProfile.photoURL);
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

  const role = userProfile?.role;
  const initials = userProfile?.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "??";

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>My Profile & Security</h1>
          <p>Manage your account preferences and personal details</p>
        </div>

        {/* Profile Card */}
        <div className="card" style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            {photoURL ? (
              <img src={photoURL} alt="Profile" style={{ width: 88, height: 88, borderRadius: "var(--radius-md)", objectFit: "cover", border: "2px solid var(--border)" }} />
            ) : (
              <div style={{ width: 88, height: 88, borderRadius: "var(--radius-md)", background: "rgba(37, 99, 235, 0.12)", border: "2px solid rgba(37, 99, 235, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, color: "var(--highlight)" }}>
                {initials}
              </div>
            )}
            <div onClick={() => fileInputRef.current.click()} style={{ position: "absolute", bottom: -6, right: -6, width: 28, height: 28, borderRadius: 8, background: "var(--highlight)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white", boxShadow: "var(--shadow-sm)" }}>
              {uploading ? <Clock size={14} /> : <Camera size={14} />}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />
          </div>

          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 22, marginBottom: 4, color: "var(--text)" }}>{userProfile?.name}</h2>
            <div style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 10 }}>{currentUser?.email}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="badge" style={{ background: "rgba(37, 99, 235, 0.14)", color: "var(--highlight)", border: "1px solid rgba(37, 99, 235, 0.3)" }}>
                {role?.toUpperCase()}
              </span>
              <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                {userProfile?.dept}
              </span>
              {userProfile?.year && (
                <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  {userProfile?.year}
                </span>
              )}
              {userProfile?.registerNo && (
                <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  #{userProfile?.registerNo}
                </span>
              )}
            </div>
            {uploadError && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{uploadError}</div>}
            {uploading && <div style={{ color: "var(--warning)", fontSize: 13, marginTop: 8 }}>Uploading photo...</div>}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
          <button onClick={() => setTab("profile")} style={{
            padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600, transition: "all 0.2s ease", display: "inline-flex", alignItems: "center", gap: 6,
            background: tab === "profile" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
            color: tab === "profile" ? "var(--highlight)" : "var(--text-muted)"
          }}>
            <Edit2 size={14} /> Edit Profile
          </button>
          <button onClick={() => setTab("password")} style={{
            padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600, transition: "all 0.2s ease", display: "inline-flex", alignItems: "center", gap: 6,
            background: tab === "password" ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
            color: tab === "password" ? "var(--highlight)" : "var(--text-muted)"
          }}>
            <Lock size={14} /> Change Password
          </button>
        </div>

        {tab === "profile" && (
          <div className="card" style={{ maxWidth: 520 }}>
            <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 20 }}>
              Account Information
            </h3>
            {profileError && <div className="error-msg">{profileError}</div>}
            {profileSaved && (
              <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "var(--radius-md)", padding: "12px 16px", color: "var(--success)", fontSize: 14, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={16} /> Profile updated successfully!
              </div>
            )}
            <div className="form-group"><label>Full Name *</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" required /></div>
            <div className="form-group"><label>Email Address</label><input type="email" value={currentUser?.email} disabled style={{ opacity: 0.5, cursor: "not-allowed" }} /></div>
            <div className="form-group"><label>Department</label><input type="text" value={userProfile?.dept || ""} disabled style={{ opacity: 0.5, cursor: "not-allowed" }} /></div>
            {userProfile?.year && <div className="form-group"><label>Year</label><input type="text" value={userProfile?.year || ""} disabled style={{ opacity: 0.5, cursor: "not-allowed" }} /></div>}
            {userProfile?.registerNo && <div className="form-group"><label>Register Number</label><input type="text" value={userProfile?.registerNo || ""} disabled style={{ opacity: 0.5, cursor: "not-allowed" }} /></div>}
            <div className="form-group"><label>Phone Number</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 9876543210" /></div>
            <button className="btn-primary" onClick={saveProfile} disabled={profileSaving} style={{ marginTop: 8 }}>
              {profileSaving ? "Saving..." : <>Save Profile Changes <Save size={14} /></>}
            </button>
          </div>
        )}

        {tab === "password" && (
          <div className="card" style={{ maxWidth: 520 }}>
            <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 20 }}>
              Update Account Password
            </h3>
            {passwordError && <div className="error-msg">{passwordError}</div>}
            {passwordSuccess && (
              <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "var(--radius-md)", padding: "12px 16px", color: "var(--success)", fontSize: 14, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={16} /> {passwordSuccess}
              </div>
            )}
            <div className="form-group"><label>Current Password *</label><input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" required /></div>
            <div className="form-group"><label>New Password *</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 6 characters" required /></div>
            <div className="form-group"><label>Confirm New Password *</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" required /></div>
            <button className="btn-primary" onClick={changePassword} disabled={passwordSaving} style={{ marginTop: 8 }}>
              {passwordSaving ? "Updating Password..." : <>Change Password <ShieldCheck size={14} /></>}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}