// src/pages/Profile.js
import React, { useState, useRef } from "react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import { doc, updateDoc } from "firebase/firestore";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";

const CLOUD_NAME = "dpz8bbusa";
const UPLOAD_PRESET = "college_portal";

const roleColors = {
  student: "#e94560",
  staff: "#f5a623",
  hod: "#48bb78",
  warden: "#4299e1",
  officestaff: "#48bb78",
  management: "#9f7aea"
};

export default function Profile() {
  const { currentUser, userProfile } = useAuth();
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

  async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setUploadError("File size must be under 5MB.");
    if (!file.type.startsWith("image/")) return setUploadError("Please select an image file.");
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);
      formData.append("folder", "college_portal_profiles");
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: "POST", body: formData
      });
      const data = await res.json();
      if (data.secure_url) {
        setPhotoURL(data.secure_url);
        await updateDoc(doc(db, "users", currentUser.uid), { photoURL: data.secure_url });
      } else {
        setUploadError("Upload failed. Check Cloudinary upload preset.");
      }
    } catch (err) {
      setUploadError("Upload failed. Try again.");
    }
    setUploading(false);
  }

  async function saveProfile() {
    setProfileSaving(true); setProfileError(""); setProfileSaved(false);
    try {
      await updateDoc(doc(db, "users", currentUser.uid), { name, phone });
      setProfileSaved(true);
    } catch (err) { setProfileError("Failed to save. Try again."); }
    setProfileSaving(false);
  }

  async function changePassword() {
    setPasswordError(""); setPasswordSuccess("");
    if (newPassword !== confirmPassword) return setPasswordError("Passwords do not match.");
    if (newPassword.length < 6) return setPasswordError("Password must be at least 6 characters.");
    setPasswordSaving(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setPasswordSuccess("Password changed successfully!");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      if (err.code === "auth/wrong-password") setPasswordError("Current password is incorrect.");
      else setPasswordError("Failed to change password. Try again.");
    }
    setPasswordSaving(false);
  }

  const role = userProfile?.role;
  const color = roleColors[role] || "#e94560";
  const initials = userProfile?.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "??";

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>👤 My Profile</h1>
          <p>Manage your account details</p>
        </div>

        {/* Profile Card */}
        <div className="card" style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            {photoURL ? (
              <img src={photoURL} alt="Profile" style={{ width: 90, height: 90, borderRadius: 20, objectFit: "cover", border: `2px solid ${color}40` }} />
            ) : (
              <div style={{ width: 90, height: 90, borderRadius: 20, background: `${color}20`, border: `2px solid ${color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontFamily: "Syne", fontWeight: 800, color }}>
                {initials}
              </div>
            )}
            <div onClick={() => fileInputRef.current.click()} style={{ position: "absolute", bottom: -6, right: -6, width: 28, height: 28, borderRadius: 8, background: color, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
              {uploading ? "⏳" : "📷"}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 22, marginBottom: 4 }}>{userProfile?.name}</div>
            <div style={{ color: "#a0aec0", fontSize: 14, marginBottom: 8 }}>{currentUser?.email}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{ padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, background: `${color}20`, color }}>{role?.toUpperCase()}</span>
              <span style={{ padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, background: "rgba(255,255,255,0.07)", color: "#e2e8f0" }}>{userProfile?.dept}</span>
              {userProfile?.year && <span style={{ padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, background: "rgba(255,255,255,0.07)", color: "#e2e8f0" }}>{userProfile?.year}</span>}
              {userProfile?.registerNo && <span style={{ padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, background: "rgba(255,255,255,0.07)", color: "#e2e8f0" }}>#{userProfile?.registerNo}</span>}
            </div>
            {uploadError && <div style={{ color: "#fc8181", fontSize: 13, marginTop: 8 }}>⚠️ {uploadError}</div>}
            {uploading && <div style={{ color: "#f5a623", fontSize: 13, marginTop: 8 }}>⏳ Uploading photo...</div>}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          {["profile", "password"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "Syne", fontWeight: 600, fontSize: 14, background: tab === t ? color : "rgba(255,255,255,0.07)", color: "white", transition: "all 0.2s" }}>
              {t === "profile" ? "✏️ Edit Profile" : "🔒 Change Password"}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <div className="card" style={{ maxWidth: 500 }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 24 }}>Edit Profile</h3>
            {profileError && <div className="error-msg">{profileError}</div>}
            {profileSaved && <div style={{ background: "rgba(72,187,120,0.1)", border: "1px solid rgba(72,187,120,0.3)", borderRadius: 10, padding: "12px 16px", color: "#48bb78", fontSize: 14, marginBottom: 20 }}>✅ Profile updated successfully!</div>}
            <div className="form-group"><label>Full Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" /></div>
            <div className="form-group"><label>Email Address</label><input type="email" value={currentUser?.email} disabled style={{ opacity: 0.5, cursor: "not-allowed" }} /></div>
            <div className="form-group"><label>Department</label><input type="text" value={userProfile?.dept || ""} disabled style={{ opacity: 0.5, cursor: "not-allowed" }} /></div>
            {userProfile?.year && <div className="form-group"><label>Year</label><input type="text" value={userProfile?.year || ""} disabled style={{ opacity: 0.5, cursor: "not-allowed" }} /></div>}
            {userProfile?.registerNo && <div className="form-group"><label>Register Number</label><input type="text" value={userProfile?.registerNo || ""} disabled style={{ opacity: 0.5, cursor: "not-allowed" }} /></div>}
            <div className="form-group"><label>Phone Number</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 9876543210" /></div>
            <button className="btn-primary" onClick={saveProfile} disabled={profileSaving}>{profileSaving ? "Saving..." : "💾 Save Changes"}</button>
          </div>
        )}

        {tab === "password" && (
          <div className="card" style={{ maxWidth: 500 }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 24 }}>Change Password</h3>
            {passwordError && <div className="error-msg">{passwordError}</div>}
            {passwordSuccess && <div style={{ background: "rgba(72,187,120,0.1)", border: "1px solid rgba(72,187,120,0.3)", borderRadius: 10, padding: "12px 16px", color: "#48bb78", fontSize: 14, marginBottom: 20 }}>✅ {passwordSuccess}</div>}
            <div className="form-group"><label>Current Password</label><input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" /></div>
            <div className="form-group"><label>New Password</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" /></div>
            <div className="form-group"><label>Confirm New Password</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" /></div>
            <button className="btn-primary" onClick={changePassword} disabled={passwordSaving}>{passwordSaving ? "Changing..." : "🔒 Change Password"}</button>
          </div>
        )}
      </main>
    </div>
  );
}