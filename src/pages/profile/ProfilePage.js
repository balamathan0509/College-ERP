// src/pages/profile/ProfilePage.js
import React, { useEffect, useRef, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db, storage } from "../../firebase/config";
import { doc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

const MAX_INPUT_SIZE = 8 * 1024 * 1024; // 8MB
const TARGET_SIZE = 1 * 1024 * 1024; // ~1MB after compression
const COMPRESS_THRESHOLD = 700 * 1024; // compress if larger than 700KB
const MAX_DIMENSION = 900;

const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIDS", "AIML", "SECURITY"];
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

function decodeImage(file) {
  if (typeof window !== "undefined" && "createImageBitmap" in window) {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

async function compressImage(file) {
  try {
    const img = await decodeImage(file);
    const width = img.width || img.naturalWidth || 1;
    const height = img.height || img.naturalHeight || 1;
    const scale = Math.min(1, MAX_DIMENSION / width, MAX_DIMENSION / height);

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (img.close) {
      img.close();
    }

    let quality = 0.8;
    let blob = await canvasToBlob(canvas, quality);
    while (blob && blob.size > TARGET_SIZE && quality > 0.6) {
      quality -= 0.1;
      blob = await canvasToBlob(canvas, quality);
    }

    return (blob && blob.size > 0) ? blob : null;
  } catch (error) {
    console.warn("Image compression fallback due to error:", error);
    return null;
  }
}

function getInitials(name) {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  const initials = parts.slice(0, 2).map(p => p[0]).join("");
  return initials.toUpperCase();
}

export default function ProfilePage() {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("idle"); // idle | compressing | uploading
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [tempPhotoURL, setTempPhotoURL] = useState("");
  const uploadTaskRef = useRef(null);
  const stallTimerRef = useRef(null);
  const progressRef = useRef(0);
  const isMountedRef = useRef(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    dept: "",
    year: "",
    registerNo: "",
    studentType: ""
  });

  useEffect(() => {
    if (!userProfile) return;
    setTempPhotoURL(userProfile.photoURL || "");
    setForm({
      name: userProfile.name || "",
      phone: userProfile.phone || "",
      dept: userProfile.dept || "",
      year: userProfile.year || "",
      registerNo: userProfile.registerNo || "",
      studentType: userProfile.studentType || ""
    });
  }, [userProfile]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
      }
    };
  }, [previewUrl]);

  function safeSet(fn) {
    if (isMountedRef.current) fn();
  }

  if (!currentUser || !userProfile) {
    return (
      <div className="dashboard-wrapper">
        <Sidebar />
        <main className="main-content">
          <div className="loading-screen">
            <div className="spinner"></div>
          </div>
        </main>
      </div>
    );
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setSuccess("");
    setUploadProgress(0);
    progressRef.current = 0;

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    if (!file.type.startsWith("image/")) {
      setUploading(false);
      setUploadStage("idle");
      return setError("Please select a valid image file.");
    }
    if (file.size > MAX_INPUT_SIZE) {
      setUploading(false);
      setUploadStage("idle");
      return setError("Image must be less than 8MB.");
    }

    setUploadStage("compressing");
    setUploading(true);

    try {
      let uploadBlob = file;
      if (file.size > COMPRESS_THRESHOLD) {
        const compressed = await compressImage(file);
        if (compressed && compressed.size > 0) {
          uploadBlob = compressed;
        } else {
          // if compression fails, upload original image in place of blocking user
          console.warn("Using original file because compression failed or returned empty.");
        }
      }

      const path = `profile_photos/${currentUser.uid}_${Date.now()}`;
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, uploadBlob, { contentType: uploadBlob.type || "image/jpeg" });
      uploadTaskRef.current = uploadTask;
      safeSet(() => setUploadStage("uploading"));

      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      stallTimerRef.current = setTimeout(() => {
        if (progressRef.current === 0) {
          safeSet(() => setError("Upload is taking longer. Check your internet or Firebase Storage rules."));
        }
      }, 15000);

      const url = await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snap) => {
            if (snap.totalBytes > 0) {
              const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
              progressRef.current = pct;
              safeSet(() => setUploadProgress(pct));
            }
            if (stallTimerRef.current && snap.bytesTransferred > 0) {
              clearTimeout(stallTimerRef.current);
              stallTimerRef.current = null;
              safeSet(() => setError(""));
            }
          },
          (err) => reject(err),
          async () => resolve(await getDownloadURL(uploadTask.snapshot.ref))
        );
      });
      await updateDoc(doc(db, "users", currentUser.uid), {
        photoURL: url,
        updatedAt: new Date().toISOString()
      });
      safeSet(() => setTempPhotoURL(url));
      safeSet(() => setPreviewUrl(""));
      if (refreshProfile) await refreshProfile();
      safeSet(() => setSuccess("Profile photo updated."));
    } catch (err) {
      let msg = "Failed to upload photo. Try again.";
      if (err?.code === "storage/unauthorized") {
        msg = "Upload failed: permission denied. Check Firebase Storage rules.";
      } else if (err?.code === "storage/canceled") {
        msg = "Upload canceled. Please try again.";
      } else if (err?.code === "storage/retry-limit-exceeded") {
        msg = "Upload failed: unstable network. Please try again.";
      } else if (err?.message) {
        msg = `Upload failed: ${err.message}`;
      }
      safeSet(() => setError(msg));
    }
    safeSet(() => setUploading(false));
    safeSet(() => setUploadStage("idle"));
    safeSet(() => setUploadProgress(0));
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    uploadTaskRef.current = null;
  }

  function handleFormChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSaveProfile() {
    setError("");
    setSuccess("");
    if (!form.name.trim()) {
      return setError("Name is required.");
    }
    if (!form.dept) {
      return setError("Department is required.");
    }
    if (userProfile.role === "student") {
      if (!form.studentType) {
        return setError("Student type (Hosteller/Day Scholar) is required.");
      }
      if (!form.year || !form.registerNo.trim()) {
        return setError("Year and Register No are required.");
      }
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        dept: form.dept
      };
      if (userProfile.role === "student") {
        payload.year = form.year;
        payload.registerNo = form.registerNo.trim();
        payload.studentType = form.studentType;
      }
      await updateDoc(doc(db, "users", currentUser.uid), payload);
      if (refreshProfile) await refreshProfile();
      setSuccess("Profile updated.");
      setEditMode(false);
    } catch (err) {
      setError("Failed to update profile. Try again.");
    }
    setSaving(false);
  }

  const uidValue = userProfile.uid || currentUser.uid;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Profile</h1>
          <p>Your account details and UID</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              fontSize: 36,
              fontWeight: 700,
              fontFamily: "Syne",
              color: "white"
            }}>
              {previewUrl || tempPhotoURL ? (
                <img
                  src={previewUrl || tempPhotoURL}
                  alt="Profile"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                getInitials(userProfile.name)
              )}
            </div>

            {error && <div className="error-msg">{error}</div>}
            {success && (
              <div style={{
                background: "rgba(72,187,120,0.1)",
                border: "1px solid rgba(72,187,120,0.3)",
                borderRadius: 10,
                padding: "10px 12px",
                color: "#48bb78",
                fontSize: 13,
                marginBottom: 12
              }}>
                {success}
              </div>
            )}

            <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 10 }}>
              Max 8MB. Large photos will be auto-compressed for faster upload.
            </div>
            <label style={{
              display: "inline-block",
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid rgba(233,69,96,0.4)",
              background: "rgba(233,69,96,0.2)",
              color: "#e94560",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13
            }}>
              {uploadStage === "compressing"
                ? "Compressing..."
                : uploadStage === "uploading"
                  ? `Uploading... ${uploadProgress}%`
                  : "Upload Photo"}
              <input
                type="file"
                accept="image/*"
                onChange={handleUpload}
                disabled={uploading}
                style={{ display: "none" }}
              />
            </label>
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, margin: 0 }}>Profile Details</h3>
              <div style={{ display: "flex", gap: 8 }}>
                {!editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "rgba(255,255,255,0.05)",
                      color: "white",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600
                    }}
                  >
                    Edit Profile
                  </button>
                )}
                {editMode && (
                  <>
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "1px solid rgba(233,69,96,0.4)",
                        background: "rgba(233,69,96,0.2)",
                        color: "#e94560",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600
                      }}
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => { setEditMode(false); setError(""); setSuccess(""); }}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.2)",
                        background: "rgba(255,255,255,0.05)",
                        color: "white",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600
                      }}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            {editMode && error && <div className="error-msg">{error}</div>}
            {editMode && success && (
              <div style={{
                background: "rgba(72,187,120,0.1)",
                border: "1px solid rgba(72,187,120,0.3)",
                borderRadius: 10,
                padding: "10px 12px",
                color: "#48bb78",
                fontSize: 13,
                marginBottom: 12
              }}>
                {success}
              </div>
            )}

            {editMode ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Name</label>
                  <input name="name" value={form.name} onChange={handleFormChange} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Phone</label>
                  <input name="phone" value={form.phone} onChange={handleFormChange} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Department</label>
                  <select name="dept" value={form.dept} onChange={handleFormChange}>
                    <option value="">Select Department</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                {userProfile.role === "student" && (
                  <>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Student Type</label>
                      <select name="studentType" value={form.studentType} onChange={handleFormChange}>
                        <option value="">Select Type</option>
                        <option value="hosteller">Hosteller</option>
                        <option value="dayscholar">Day Scholar</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Year</label>
                      <select name="year" value={form.year} onChange={handleFormChange}>
                        <option value="">Select Year</option>
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Register No</label>
                      <input name="registerNo" value={form.registerNo} onChange={handleFormChange} />
                    </div>
                  </>
                )}
              </div>
            ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              {[
                ["Name", userProfile.name],
                ["Email", currentUser.email],
                ["UID", uidValue],
                ["Role", userProfile.role],
                ["Department", userProfile.dept || "-"],
                ["Student Type", userProfile.studentType ? (userProfile.studentType === "hosteller" ? "Hosteller" : "Day Scholar") : "-"],
                ["Year", userProfile.year || "-"],
                ["Register No", userProfile.registerNo || "-"],
                ["Phone", userProfile.phone || "-"]
              ].map(([label, value]) => (
                <div key={label} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.05)", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, wordBreak: "break-all" }}>{value}</div>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
