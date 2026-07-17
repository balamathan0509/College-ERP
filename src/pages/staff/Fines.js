// src/pages/staff/Fines.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy
} from "firebase/firestore";

const CATEGORIES = ["Disciplinary", "Academic", "Hostel", "Library", "Other"];
const CATEGORY_STYLES = {
  "Disciplinary": { bg: "rgba(252,129,129,0.12)", color: "#fc8181", icon: "⚠️" },
  "Academic": { bg: "rgba(66,153,225,0.12)", color: "#4299e1", icon: "📚" },
  "Hostel": { bg: "rgba(159,122,234,0.12)", color: "#9f7aea", icon: "🏠" },
  "Library": { bg: "rgba(246,173,85,0.12)", color: "#f6ad55", icon: "📖" },
  "Other": { bg: "rgba(160,174,192,0.12)", color: "#a0aec0", icon: "📋" }
};

export default function StaffFines() {
  const { currentUser, userProfile } = useAuth();
  const [fines, setFines] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [searchRegisterNo, setSearchRegisterNo] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [foundStudent, setFoundStudent] = useState(null);

  // Form state for imposing a fine
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Filter for history log
  const [filterStatus, setFilterStatus] = useState("all");

  // Edit State
  const [editingFineId, setEditingFineId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [updating, setUpdating] = useState(false);

  function handleStartEdit(fine) {
    setEditingFineId(fine.id);
    setEditTitle(fine.title || "");
    setEditCategory(fine.category || "");
    setEditAmount(fine.amount || "");
    setEditReason(fine.description || "");
    setEditDueDate(fine.dueDate ? new Date(fine.dueDate).toISOString().split("T")[0] : "");
  }

  async function handleSaveEdit(fineId) {
    if (!editTitle.trim() || !editCategory || !editAmount || !editDueDate) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, "fines", fineId), {
        title: editTitle.trim(),
        category: editCategory,
        amount: Number(editAmount),
        description: editReason.trim(),
        dueDate: new Date(editDueDate).toISOString()
      });
      setFines(prev => prev.map(f => f.id === fineId ? {
        ...f,
        title: editTitle.trim(),
        category: editCategory,
        amount: Number(editAmount),
        description: editReason.trim(),
        dueDate: new Date(editDueDate).toISOString()
      } : f));
      setEditingFineId(null);
    } catch (err) {
      console.error("Error updating fine details:", err);
    }
    setUpdating(false);
  }

  async function fetchImposedFines() {
    if (!currentUser) return;
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "fines"),
        where("createdByUid", "==", currentUser.uid)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setFines(list);
    } catch (err) {
      console.error("Error fetching imposed fines:", err);
    }
    setLoadingHistory(false);
  }

  useEffect(() => {
    fetchImposedFines();
  }, [currentUser]);

  async function handleSearchStudent(e) {
    e.preventDefault();
    if (!searchRegisterNo.trim()) return;

    setSearching(true);
    setSearchError("");
    setFoundStudent(null);
    setSuccessMsg("");

    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("registerNo", "==", searchRegisterNo.trim())
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setSearchError(`No student found with register number: "${searchRegisterNo}"`);
        setSearching(false);
        return;
      }

      const studentData = { id: snap.docs[0].id, ...snap.docs[0].data() };

      // Enforce department matching restriction: CSE staff can only fine CSE students, etc.
      // If staff has a dept listed (and it's not 'all'), compare it to the student's dept
      const staffDept = userProfile?.dept;
      if (staffDept && staffDept !== "all" && studentData.dept !== staffDept) {
        setSearchError(
          `Unauthorized: You belong to the ${staffDept} department and can only impose fines on ${staffDept} students. Selected student belongs to ${studentData.dept || "N/A"}.`
        );
        setSearching(false);
        return;
      }

      setFoundStudent(studentData);
    } catch (err) {
      console.error("Error searching student:", err);
      setSearchError("An error occurred during search. Please try again.");
    }
    setSearching(false);
  }

  async function handleImposeFine(e) {
    e.preventDefault();
    if (!foundStudent || !title.trim() || !category || !amount || !dueDate) return;

    setSaving(true);
    setSuccessMsg("");

    try {
      const fineData = {
        title: title.trim(),
        description: reason.trim(),
        amount: Number(amount),
        category,
        studentUid: foundStudent.uid || foundStudent.id,
        studentName: foundStudent.name,
        studentRegisterNo: foundStudent.registerNo,
        studentDept: foundStudent.dept || "",
        studentYear: foundStudent.year || "",
        status: "active",
        createdAt: new Date().toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        createdBy: userProfile?.name || "Staff",
        createdByUid: currentUser?.uid || "",
        createdByEmail: currentUser?.email || "",
        createdByDept: userProfile?.dept || "",
        type: "individual"
      };

      await addDoc(collection(db, "fines"), fineData);

      setSuccessMsg(`Successfully imposed a fine of ₹${amount} on ${foundStudent.name}!`);
      
      // Clear form & search state
      setTitle("");
      setCategory("");
      setAmount("");
      setReason("");
      setDueDate("");
      setFoundStudent(null);
      setSearchRegisterNo("");

      // Refresh list
      await fetchImposedFines();
    } catch (err) {
      console.error("Error imposing fine:", err);
      setSearchError("Failed to save fine. Please try again.");
    }
    setSaving(false);
  }

  async function toggleFineStatus(fineId, currentStatus) {
    try {
      const newStatus = currentStatus === "active" ? "revoked" : "active";
      await updateDoc(doc(db, "fines", fineId), { status: newStatus });
      setFines(prev => prev.map(f => f.id === fineId ? { ...f, status: newStatus } : f));
    } catch (err) {
      console.error("Error updating fine status:", err);
    }
  }

  const activeFines = fines.filter(f => f.status === "active");
  const revokedFines = fines.filter(f => f.status === "revoked");
  const totalImposedAmount = activeFines.reduce((sum, f) => sum + (f.amount || 0), 0);

  const filteredFines = filterStatus === "all" ? fines :
    filterStatus === "active" ? activeFines : revokedFines;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>⚠️ Impose Student Fines</h1>
          <p>{userProfile?.dept} Department Staff Portal</p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-value">{loadingHistory ? "..." : fines.length}</div>
            <div className="stat-label">Total Fines Imposed</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔴</div>
            <div className="stat-value" style={{ color: "#fc8181" }}>
              {loadingHistory ? "..." : activeFines.length}
            </div>
            <div className="stat-label">Active Fines</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value" style={{ color: "#48bb78" }}>
              {loadingHistory ? "..." : revokedFines.length}
            </div>
            <div className="stat-label">Revoked Fines</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-value" style={{ color: "#f5a623" }}>
              {loadingHistory ? "..." : `₹${totalImposedAmount.toLocaleString("en-IN")}`}
            </div>
            <div className="stat-label">Active Fine Value</div>
          </div>
        </div>

        {/* Main Work Area */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24, marginBottom: 24 }}>
          
          {/* Find Student Card */}
          <div className="card">
            <h3 style={{ marginBottom: 16, fontFamily: "Syne", fontSize: 18 }}>🔍 Search Student</h3>
            <form onSubmit={handleSearchStudent} style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <div className="form-group" style={{ margin: 0, flex: 1 }}>
                <label>Student Register Number</label>
                <input
                  type="text"
                  placeholder="e.g., 21CS001"
                  value={searchRegisterNo}
                  onChange={e => setSearchRegisterNo(e.target.value)}
                  style={{ textTransform: "uppercase" }}
                  required
                />
              </div>
              <button className="btn-primary" type="submit" disabled={searching} style={{ width: "auto", height: 46, padding: "0 24px" }}>
                {searching ? "Searching..." : "Search"}
              </button>
            </form>

            {searchError && (
              <div style={{
                marginTop: 16, padding: "12px 16px", borderRadius: 10,
                background: "rgba(252,129,129,0.1)", border: "1px solid rgba(252,129,129,0.3)",
                color: "#fc8181", fontSize: 14, fontWeight: 500
              }}>
                ⚠️ {searchError}
              </div>
            )}

            {successMsg && (
              <div style={{
                marginTop: 16, padding: "12px 16px", borderRadius: 10,
                background: "rgba(72,187,120,0.1)", border: "1px solid rgba(72,187,120,0.3)",
                color: "#48bb78", fontSize: 14, fontWeight: 600
              }}>
                ✅ {successMsg}
              </div>
            )}
          </div>

          {/* Student Info & Form Card */}
          {foundStudent && (
            <div className="card" style={{ borderLeft: "4px solid #fc8181" }}>
              <h3 style={{ marginBottom: 16, fontFamily: "Syne", fontSize: 18 }}>👤 Target Student Details</h3>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16, padding: 16, borderRadius: 12,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                marginBottom: 24
              }}>
                <div>
                  <div style={{ fontSize: 12, color: "#a0aec0" }}>Student Name</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>{foundStudent.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#a0aec0" }}>Register Number</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#e94560" }}>{foundStudent.registerNo}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#a0aec0" }}>Department / Year</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>{foundStudent.dept} • {foundStudent.year}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#a0aec0" }}>Email</div>
                  <div style={{ fontSize: 14, color: "#a0aec0" }}>{foundStudent.email}</div>
                </div>
              </div>

              <h3 style={{ marginBottom: 16, fontFamily: "Syne", fontSize: 18 }}>📝 Impose Fine Form</h3>
              <form onSubmit={handleImposeFine}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Fine Title *</label>
                    <input
                      type="text"
                      placeholder="e.g., Lab Instrument Damage, Late Entry"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Category *</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} required>
                      <option value="">Select Category</option>
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Amount (₹) *</label>
                    <input
                      type="number"
                      placeholder="e.g., 250"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      min="1"
                      required
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Due Date *</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: 16 }}>
                  <label>Reason / Description *</label>
                  <textarea
                    rows="3"
                    placeholder="Enter a detailed reason for imposing the fine..."
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    style={{
                      width: "100%", padding: 12, borderRadius: 10,
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      color: "white", fontFamily: "inherit", resize: "none"
                    }}
                    required
                  />
                </div>

                <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
                  <button className="btn-primary" type="submit" disabled={saving} style={{ width: "auto", padding: "12px 28px" }}>
                    {saving ? "Imposing..." : "⚠️ Impose Fine"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFoundStudent(null);
                      setSearchRegisterNo("");
                    }}
                    style={{
                      padding: "12px 24px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)",
                      background: "transparent", color: "white", cursor: "pointer", fontSize: 14, fontWeight: 500
                    }}
                  >Cancel</button>
                </div>
              </form>
            </div>
          )}

        </div>

        {/* History / Imposed Fines Log */}
        <div className="card">
          <h3 style={{ marginBottom: 20, fontFamily: "Syne", fontSize: 18 }}>📜 Imposed Fines History</h3>

          {/* Filter Status Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[
              { key: "all", label: "All", count: fines.length },
              { key: "active", label: "Active", count: activeFines.length },
              { key: "revoked", label: "Revoked", count: revokedFines.length }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterStatus(tab.key)}
                style={{
                  padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 600, transition: "all 0.2s",
                  background: filterStatus === tab.key ? "rgba(245,166,35,0.2)" : "rgba(255,255,255,0.06)",
                  color: filterStatus === tab.key ? "#f5a623" : "#a0aec0"
                }}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div className="spinner" style={{ margin: "0 auto" }}></div>
            </div>
          ) : filteredFines.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {filteredFines.map(fine => {
                const catStyle = CATEGORY_STYLES[fine.category] || CATEGORY_STYLES["Other"];
                const isActive = fine.status === "active";
                const isEditing = editingFineId === fine.id;

                if (isEditing) {
                  return (
                    <div key={fine.id} className="card" style={{
                      borderLeft: `4px solid #f5a623`,
                      background: "rgba(255,255,255,0.03)"
                    }}>
                      <h4 style={{ fontFamily: "Syne", fontSize: 16, marginBottom: 12, color: "#f5a623" }}>✏️ Edit Imposed Fine</h4>
                      
                      <div className="form-group" style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 11 }}>Fine Title *</label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          required
                          style={{ padding: 8, fontSize: 13 }}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: 11 }}>Category *</label>
                          <select
                            value={editCategory}
                            onChange={e => setEditCategory(e.target.value)}
                            required
                            style={{ padding: 8, fontSize: 13, height: 38 }}
                          >
                            {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: 11 }}>Amount (₹) *</label>
                          <input
                            type="number"
                            value={editAmount}
                            onChange={e => setEditAmount(e.target.value)}
                            min="1"
                            required
                            style={{ padding: 8, fontSize: 13 }}
                          />
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 11 }}>Due Date *</label>
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={e => setEditDueDate(e.target.value)}
                          required
                          style={{ padding: 8, fontSize: 13 }}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 11 }}>Reason / Description *</label>
                        <textarea
                          rows="2"
                          value={editReason}
                          onChange={e => setEditReason(e.target.value)}
                          style={{
                            width: "100%", padding: 8, borderRadius: 8,
                            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                            color: "white", fontFamily: "inherit", fontSize: 13, resize: "none"
                          }}
                          required
                        />
                      </div>

                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => handleSaveEdit(fine.id)}
                          className="btn-primary"
                          disabled={updating}
                          style={{ width: "auto", padding: "6px 14px", fontSize: 12, height: "auto" }}
                        >
                          {updating ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingFineId(null)}
                          style={{
                            padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)",
                            background: "transparent", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 500
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={fine.id} className="card" style={{
                    borderLeft: `4px solid ${isActive ? "#fc8181" : "#48bb78"}`,
                    opacity: isActive ? 1 : 0.7,
                    position: "relative",
                    background: "rgba(255,255,255,0.02)"
                  }}>
                    {/* Status Badge */}
                    <div style={{
                      position: "absolute", top: 16, right: 16,
                      padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: isActive ? "rgba(252,129,129,0.15)" : "rgba(72,187,120,0.15)",
                      color: isActive ? "#fc8181" : "#48bb78"
                    }}>
                      {isActive ? "🔴 Active" : "✅ Revoked"}
                    </div>

                    {/* Category */}
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: catStyle.bg, color: catStyle.color, marginBottom: 12
                    }}>
                      {catStyle.icon} {fine.category}
                    </div>

                    {/* Title */}
                    <h3 style={{ fontFamily: "Syne", fontSize: 17, fontWeight: 700, marginBottom: 6, paddingRight: 80 }}>
                      {fine.title}
                    </h3>

                    {/* Target Student Info */}
                    <div style={{
                      fontSize: 13, color: "white", fontWeight: 600, marginBottom: 10,
                      background: "rgba(255,255,255,0.04)", padding: "8px 12px", borderRadius: 8
                    }}>
                      🧑‍🎓 {fine.studentName} ({fine.studentRegisterNo})<br />
                      <span style={{ fontSize: 11, color: "#a0aec0", fontWeight: 400 }}>
                        {fine.studentDept} • {fine.studentYear}
                      </span>
                    </div>

                    {/* Description / Reason */}
                    {fine.description && (
                      <p style={{ fontSize: 13, color: "#a0aec0", marginBottom: 14, lineHeight: 1.5 }}>
                        <strong>Reason:</strong> {fine.description}
                      </p>
                    )}

                    {/* Amount */}
                    <div style={{
                      padding: "12px 16px", borderRadius: 10,
                      background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.15)",
                      marginBottom: 14, display: "flex", alignItems: "center", gap: 10
                    }}>
                      <span style={{ fontSize: 24 }}>💰</span>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "Syne", color: "#f5a623" }}>
                          ₹{fine.amount?.toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>

                    {/* Dates & Actions */}
                    <div style={{
                      display: "flex", flexDirection: "column", gap: 8,
                      paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)"
                    }}>
                      <div style={{ fontSize: 12, color: "#a0aec0" }}>
                        📅 Imposed: {fine.createdAt ? new Date(fine.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                      </div>
                      {fine.dueDate && (
                        <div style={{ fontSize: 12, color: "#fc8181", fontWeight: 600 }}>
                          ⚠️ Due Date: {new Date(fine.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                        <button
                          onClick={() => handleStartEdit(fine)}
                          style={{
                            padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                            border: `1px solid rgba(245,166,35,0.3)`,
                            background: `rgba(245,166,35,0.1)`,
                            color: "#f5a623",
                            cursor: "pointer", transition: "all 0.2s"
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => toggleFineStatus(fine.id, fine.status)}
                          style={{
                            padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                            border: `1px solid ${isActive ? "rgba(72,187,120,0.3)" : "rgba(252,129,129,0.3)"}`,
                            background: isActive ? "rgba(72,187,120,0.1)" : "rgba(252,129,129,0.1)",
                            color: isActive ? "#48bb78" : "#fc8181",
                            cursor: "pointer", transition: "all 0.2s"
                          }}
                        >
                          {isActive ? "✅ Revoke" : "🔄 Reactivate"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 40, color: "#a0aec0" }}>
              No fines imposed yet. Use the search and form above to impose a fine.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
