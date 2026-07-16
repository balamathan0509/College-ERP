// src/pages/admin/AdminDashboard.js
import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import {
  collection, getDocs, doc, updateDoc, deleteDoc, setDoc, query, orderBy
} from "firebase/firestore";
import { auth } from "../../firebase/config";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";

const BACKEND_URL = "http://localhost:3002";

const ROLES = ["student", "staff", "hod", "warden", "officestaff", "security", "management", "principal", "admin"];
const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIDS", "AIML", "MBA", "MCA"];

const ROLE_COLORS = {
  student: "#e94560",
  staff: "#f5a623",
  hod: "#48bb78",
  warden: "#4299e1",
  officestaff: "#9f7aea",
  security: "#ed8936",
  management: "#d53f8c",
  principal: "#805ad5",
  admin: "#e53e3e"
};

const ROLE_ICONS = {
  student: "🎒",
  staff: "👨‍🏫",
  hod: "👑",
  warden: "🏠",
  officestaff: "📋",
  security: "🔐",
  management: "🏢",
  principal: "🏛️",
  admin: "⚡"
};

export default function AdminDashboard() {
  const { currentUser, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Toast state
  const [toast, setToast] = useState(null);

  // Form state for adding user
  const [addForm, setAddForm] = useState({
    name: "", email: "", password: "", role: "student", dept: "", registerNo: "", year: "", phone: ""
  });
  const [addLoading, setAddLoading] = useState(false);

  // Form state for editing user
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", registerNo: "", year: "", role: "", dept: "", isSuperAdmin: false, newPassword: "", confirmNewPassword: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [resetPwLoading, setResetPwLoading] = useState(false);
  const [directPwLoading, setDirectPwLoading] = useState(false);

  const [deleteLoading, setDeleteLoading] = useState(false);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setUsers(list);
    } catch (err) {
      showToast("Failed to fetch users", "error");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Filter logic
  useEffect(() => {
    let result = [...users];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(u =>
        (u.name || "").toLowerCase().includes(s) ||
        (u.email || "").toLowerCase().includes(s) ||
        (u.registerNo || "").toLowerCase().includes(s)
      );
    }
    if (roleFilter !== "all") {
      result = result.filter(u => u.role === roleFilter);
    }
    if (deptFilter !== "all") {
      result = result.filter(u => u.dept === deptFilter);
    }
    setFilteredUsers(result);
  }, [users, search, roleFilter, deptFilter]);

  // Stats
  const stats = {
    total: users.length,
    students: users.filter(u => u.role === "student").length,
    staff: users.filter(u => u.role === "staff").length,
    hods: users.filter(u => u.role === "hod").length,
    admins: users.filter(u => u.isSuperAdmin).length
  };

  // Add user handler
  async function handleAddUser(e) {
    e.preventDefault();
    if (!addForm.name || !addForm.email || !addForm.password || !addForm.role) {
      return showToast("Please fill all required fields.", "error");
    }
    setAddLoading(true);
    try {
      // Save the current user's auth state
      const currentAuthUser = auth.currentUser;

      const result = await createUserWithEmailAndPassword(auth, addForm.email, addForm.password);
      const newUid = result.user.uid;

      const userData = {
        uid: newUid,
        email: addForm.email,
        name: addForm.name,
        role: addForm.role,
        dept: addForm.dept || "",
        phone: addForm.phone || "",
        isSuperAdmin: addForm.role === "admin",
        createdAt: new Date().toISOString()
      };
      if (addForm.role === "student") {
        userData.registerNo = addForm.registerNo || "";
        userData.year = addForm.year || "";
      }

      await setDoc(doc(db, "users", newUid), userData);

      showToast(`✅ User "${addForm.name}" created successfully!`);
      setAddForm({ name: "", email: "", password: "", role: "student", dept: "", registerNo: "", year: "", phone: "" });
      setShowAddModal(false);
      fetchUsers();

      // Note: Creating a user with Firebase Auth client SDK signs in as that user.
      // The admin will need to re-login. We show a notice.
      if (currentAuthUser && currentAuthUser.uid !== newUid) {
        showToast("⚠️ You may need to re-login as admin since Firebase Auth switched to the new user.", "warning");
      }
    } catch (err) {
      const msg = err.code === "auth/email-already-in-use"
        ? "Email already exists in Firebase Auth."
        : err.code === "auth/weak-password"
        ? "Password should be at least 6 characters."
        : `Failed to create user: ${err.message}`;
      showToast(msg, "error");
    }
    setAddLoading(false);
  }

  // Edit user handler
  async function handleEditUser(e) {
    e.preventDefault();
    if (!selectedUser) return;
    setEditLoading(true);
    try {
      const updateData = {
        name: editForm.name || selectedUser.name || "",
        phone: editForm.phone || "",
        role: editForm.role,
        dept: editForm.dept || "",
        isSuperAdmin: editForm.isSuperAdmin
      };
      if (editForm.role === "student") {
        updateData.registerNo = editForm.registerNo || "";
        updateData.year = editForm.year || "";
      }

      // If email changed, update via backend (Firebase Admin SDK)
      if (editForm.email && editForm.email !== selectedUser.email) {
        const emailRes = await fetch(`${BACKEND_URL}/admin/update-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: selectedUser.uid || selectedUser.id, newEmail: editForm.email })
        });
        const emailData = await emailRes.json();
        if (!emailRes.ok) throw new Error(emailData.error || "Failed to update email");
        updateData.email = editForm.email;
      }

      await updateDoc(doc(db, "users", selectedUser.id), updateData);
      showToast(`✅ User "${editForm.name || selectedUser.name}" updated successfully!`);
      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      showToast(`Failed to update user: ${err.message}`, "error");
    }
    setEditLoading(false);
  }

  // Send password reset email (secondary option)
  async function handleResetPassword() {
    if (!selectedUser?.email) return;
    setResetPwLoading(true);
    try {
      await sendPasswordResetEmail(auth, selectedUser.email);
      showToast(`📧 Password reset email sent to ${selectedUser.email}!`);
    } catch (err) {
      showToast("Failed to send reset email: " + err.message, "error");
    }
    setResetPwLoading(false);
  }

  // Direct password change via backend (no email sent)
  async function handleDirectPasswordChange() {
    if (!selectedUser) return;
    if (!editForm.newPassword) return showToast("Enter a new password.", "error");
    if (editForm.newPassword.length < 6) return showToast("Password must be at least 6 characters.", "error");
    if (editForm.newPassword !== editForm.confirmNewPassword) return showToast("Passwords do not match.", "error");
    setDirectPwLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/admin/update-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: selectedUser.uid || selectedUser.id, newPassword: editForm.newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password");
      showToast(`🔑 Password changed directly for ${selectedUser.name}!`);
      setEditForm(f => ({ ...f, newPassword: "", confirmNewPassword: "" }));
    } catch (err) {
      showToast("Failed to change password: " + err.message, "error");
    }
    setDirectPwLoading(false);
  }

  // Delete user handler — removes from both Firestore and Firebase Auth
  async function handleDeleteUser() {
    if (!selectedUser) return;
    setDeleteLoading(true);
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, "users", selectedUser.id));
      // Delete from Firebase Auth via backend
      try {
        await fetch(`${BACKEND_URL}/admin/delete-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: selectedUser.uid || selectedUser.id })
        });
      } catch (authErr) {
        console.error("Failed to delete from Auth (may already be removed):", authErr);
      }
      showToast(`🗑️ User "${selectedUser.name}" deleted from Firestore & Auth.`);
      setShowDeleteModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      showToast("Failed to delete user.", "error");
    }
    setDeleteLoading(false);
  }

  function openEditModal(user) {
    setSelectedUser(user);
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      registerNo: user.registerNo || "",
      year: user.year || "",
      role: user.role || "student",
      dept: user.dept || "",
      isSuperAdmin: user.isSuperAdmin || false,
      newPassword: "",
      confirmNewPassword: ""
    });
    setResetPwLoading(false);
    setDirectPwLoading(false);
    setShowEditModal(true);
  }

  function openDeleteModal(user) {
    setSelectedUser(user);
    setShowDeleteModal(true);
  }

  // Styles
  const modalOverlay = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 2000, backdropFilter: "blur(6px)", padding: 20
  };
  const modalBox = {
    background: "#16213e", borderRadius: 24, padding: 36, maxWidth: 520, width: "100%",
    border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 25px 80px rgba(0,0,0,0.5)",
    maxHeight: "90vh", overflowY: "auto"
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        {/* Toast */}
        {toast && (
          <div style={{
            position: "fixed", top: 24, right: 24, zIndex: 3000,
            padding: "14px 24px", borderRadius: 14,
            background: toast.type === "error" ? "rgba(252,129,129,0.95)" : toast.type === "warning" ? "rgba(246,173,85,0.95)" : "rgba(72,187,120,0.95)",
            color: "white", fontWeight: 600, fontSize: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            animation: "slideIn 0.3s ease",
            maxWidth: 400
          }}>
            {toast.message}
          </div>
        )}

        <DateTimeHeader />
        <div className="page-header">
          <h1>⚡ Super Admin Panel</h1>
          <p>Full control over all users and roles</p>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          {[
            { icon: "👥", value: stats.total, label: "Total Users", color: "#4299e1" },
            { icon: "🎒", value: stats.students, label: "Students", color: "#e94560" },
            { icon: "👨‍🏫", value: stats.staff, label: "Staff", color: "#f5a623" },
            { icon: "👑", value: stats.hods, label: "HODs", color: "#48bb78" },
            { icon: "⚡", value: stats.admins, label: "Super Admins", color: "#e53e3e" }
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Controls Bar */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, flex: 1, flexWrap: "wrap", alignItems: "center" }}>
              {/* Search */}
              <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 360 }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.5 }}>🔍</span>
                <input
                  type="text"
                  placeholder="Search by name, email, or register no..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: "100%", padding: "11px 16px 11px 40px",
                    background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 12, color: "white", fontSize: 14, outline: "none",
                    fontFamily: "'DM Sans', sans-serif"
                  }}
                />
              </div>
              {/* Role Filter */}
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{
                padding: "11px 16px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12, color: "white", fontSize: 14, outline: "none", cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif", minWidth: 140
              }}>
                <option value="all">All Roles</option>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
              {/* Dept Filter */}
              <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{
                padding: "11px 16px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12, color: "white", fontSize: 14, outline: "none", cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif", minWidth: 140
              }}>
                <option value="all">All Depts</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <button onClick={() => setShowAddModal(true)} style={{
              padding: "12px 28px", borderRadius: 12, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #e94560, #c0392b)", color: "white",
              fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14,
              boxShadow: "0 4px 16px rgba(233,69,96,0.3)", transition: "all 0.2s",
              whiteSpace: "nowrap"
            }}>
              ➕ Add User
            </button>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: "#a0aec0" }}>
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 80 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["User", "Email", "Role", "Department", "Admin", "Actions"].map(h => (
                      <th key={h} style={{
                        padding: "16px 20px", textAlign: "left", fontSize: 11,
                        color: "#a0aec0", textTransform: "uppercase", letterSpacing: 1,
                        fontWeight: 600, fontFamily: "'DM Sans', sans-serif"
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 60, color: "#a0aec0" }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                        No users found matching your filters.
                      </td>
                    </tr>
                  ) : filteredUsers.map(user => (
                    <tr key={user.id} style={{
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      transition: "background 0.15s"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      {/* Name */}
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: 10,
                            background: `${ROLE_COLORS[user.role] || "#e94560"}20`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 16, flexShrink: 0
                          }}>
                            {ROLE_ICONS[user.role] || "👤"}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: "white" }}>{user.name || "—"}</div>
                            {user.registerNo && <div style={{ fontSize: 12, color: "#a0aec0" }}>{user.registerNo}</div>}
                          </div>
                        </div>
                      </td>
                      {/* Email */}
                      <td style={{ padding: "14px 20px", fontSize: 13, color: "#a0aec0" }}>{user.email}</td>
                      {/* Role Badge */}
                      <td style={{ padding: "14px 20px" }}>
                        <span style={{
                          padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                          background: `${ROLE_COLORS[user.role] || "#e94560"}20`,
                          color: ROLE_COLORS[user.role] || "#e94560",
                          textTransform: "uppercase", letterSpacing: 0.5
                        }}>
                          {user.role || "—"}
                        </span>
                      </td>
                      {/* Department */}
                      <td style={{ padding: "14px 20px", fontSize: 13, color: "#a0aec0" }}>{user.dept || "—"}</td>
                      {/* Super Admin */}
                      <td style={{ padding: "14px 20px" }}>
                        {user.isSuperAdmin ? (
                          <span style={{
                            padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: "rgba(229,62,62,0.15)", color: "#e53e3e"
                          }}>⚡ SUPER ADMIN</span>
                        ) : (
                          <span style={{ fontSize: 13, color: "#4a5568" }}>—</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => openEditModal(user)} style={{
                            padding: "7px 16px", borderRadius: 8,
                            border: "1px solid rgba(66,153,225,0.3)",
                            background: "rgba(66,153,225,0.1)", color: "#4299e1",
                            fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s"
                          }}>
                            ✏️ Edit
                          </button>
                          <button onClick={() => openDeleteModal(user)} disabled={user.uid === currentUser?.uid} style={{
                            padding: "7px 16px", borderRadius: 8,
                            border: "1px solid rgba(252,129,129,0.3)",
                            background: "rgba(252,129,129,0.1)", color: "#fc8181",
                            fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                            opacity: user.uid === currentUser?.uid ? 0.3 : 1
                          }}>
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ADD USER MODAL */}
        {showAddModal && (
          <div style={modalOverlay} onClick={() => setShowAddModal(false)}>
            <div style={modalBox} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(72,187,120,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>➕</div>
                <div>
                  <h3 style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 20, color: "white" }}>Add New User</h3>
                  <p style={{ color: "#a0aec0", fontSize: 13 }}>Create account with role assignment</p>
                </div>
              </div>

              <form onSubmit={handleAddUser}>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input type="text" placeholder="Enter full name" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" placeholder="user@college.edu" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Password *</label>
                  <input type="password" placeholder="Min. 6 characters" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role *</label>
                    <select value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })} required>
                      {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <select value={addForm.dept} onChange={e => setAddForm({ ...addForm, dept: e.target.value })}>
                      <option value="">Select Dept</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                {addForm.role === "student" && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Register No</label>
                      <input type="text" placeholder="e.g. 2021CS001" value={addForm.registerNo} onChange={e => setAddForm({ ...addForm, registerNo: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Year</label>
                      <select value={addForm.year} onChange={e => setAddForm({ ...addForm, year: e.target.value })}>
                        <option value="">Select Year</option>
                        {["1st Year", "2nd Year", "3rd Year", "4th Year"].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label>Phone</label>
                  <input type="text" placeholder="Phone number" value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} />
                </div>

                {addForm.role === "admin" && (
                  <div style={{ background: "rgba(229,62,62,0.1)", border: "1px solid rgba(229,62,62,0.2)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#e53e3e", marginBottom: 4 }}>⚡ Super Admin Rights</div>
                    <div style={{ fontSize: 12, color: "#a0aec0" }}>This user will have full control over the system — access to all routes and user management.</div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <button type="button" onClick={() => setShowAddModal(false)} style={{
                    flex: 1, padding: "13px 20px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.05)", color: "white", fontFamily: "Syne",
                    fontWeight: 700, cursor: "pointer", fontSize: 14
                  }}>Cancel</button>
                  <button type="submit" disabled={addLoading} style={{
                    flex: 1, padding: "13px 20px", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg, #48bb78, #38a169)", color: "white",
                    fontFamily: "Syne", fontWeight: 700, cursor: "pointer", fontSize: 14,
                    opacity: addLoading ? 0.6 : 1
                  }}>{addLoading ? "Creating..." : "✅ Create User"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* EDIT USER MODAL */}
        {showEditModal && selectedUser && (
          <div style={modalOverlay} onClick={() => setShowEditModal(false)}>
            <div style={{ ...modalBox, maxWidth: 580 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(66,153,225,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>✏️</div>
                <div>
                  <h3 style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 20, color: "white" }}>Edit User</h3>
                  <p style={{ color: "#a0aec0", fontSize: 13 }}>{selectedUser.name} ({selectedUser.email})</p>
                </div>
              </div>

              <form onSubmit={handleEditUser}>
                {/* Section: Personal Info */}
                <div style={{ fontSize: 11, color: "#4299e1", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>👤 Personal Information</div>
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" placeholder="Enter full name" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email {editForm.email !== selectedUser.email && <span style={{ fontSize: 11, color: "#f5a623" }}>(will update Auth)</span>}</label>
                    <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} placeholder="user@college.edu" />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input type="text" placeholder="Phone number" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                  </div>
                </div>

                {/* Section: Role & Department */}
                <div style={{ fontSize: 11, color: "#48bb78", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, marginTop: 8 }}>🏷️ Role & Department</div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role</label>
                    <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                      {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <select value={editForm.dept} onChange={e => setEditForm({ ...editForm, dept: e.target.value })}>
                      <option value="">None</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                {/* Student-specific fields */}
                {editForm.role === "student" && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Register No</label>
                      <input type="text" placeholder="e.g. 2021CS001" value={editForm.registerNo} onChange={e => setEditForm({ ...editForm, registerNo: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Year</label>
                      <select value={editForm.year} onChange={e => setEditForm({ ...editForm, year: e.target.value })}>
                        <option value="">Select Year</option>
                        {["1st Year", "2nd Year", "3rd Year", "4th Year"].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Section: Direct Password Change */}
                <div style={{ fontSize: 11, color: "#f5a623", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, marginTop: 8 }}>🔑 Password Management</div>
                
                {/* Direct Password Change */}
                <div style={{
                  background: "rgba(72,187,120,0.08)",
                  border: "1px solid rgba(72,187,120,0.2)",
                  borderRadius: 14, padding: "16px 20px", marginBottom: 16
                }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "white", marginBottom: 4 }}>🔑 Set New Password Directly</div>
                  <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 14 }}>Change password instantly — no email sent to the user</div>
                  <div className="form-row">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>New Password</label>
                      <input type="password" placeholder="Min 6 characters" value={editForm.newPassword} onChange={e => setEditForm({ ...editForm, newPassword: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Confirm Password</label>
                      <input type="password" placeholder="Re-enter password" value={editForm.confirmNewPassword} onChange={e => setEditForm({ ...editForm, confirmNewPassword: e.target.value })} />
                    </div>
                  </div>
                  <button type="button" onClick={handleDirectPasswordChange} disabled={directPwLoading || !editForm.newPassword} style={{
                    marginTop: 12, padding: "10px 22px", borderRadius: 10, border: "none",
                    background: editForm.newPassword ? "linear-gradient(135deg, #48bb78, #38a169)" : "rgba(255,255,255,0.1)",
                    color: "white", fontFamily: "Syne", fontWeight: 700, cursor: editForm.newPassword ? "pointer" : "default",
                    fontSize: 13, opacity: directPwLoading ? 0.6 : 1, width: "100%",
                    boxShadow: editForm.newPassword ? "0 4px 12px rgba(72,187,120,0.3)" : "none",
                    transition: "all 0.2s"
                  }}>{directPwLoading ? "Changing..." : "🔑 Change Password Now"}</button>
                </div>

                {/* Fallback: Send Reset Email */}
                <div style={{
                  background: "rgba(245,166,35,0.08)",
                  border: "1px solid rgba(245,166,35,0.15)",
                  borderRadius: 14, padding: "14px 20px", marginBottom: 24,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  gap: 16, flexWrap: "wrap"
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#a0aec0" }}>📧 Or send password reset email</div>
                    <div style={{ fontSize: 11, color: "#718096", marginTop: 2 }}>Sends a reset link to {editForm.email || selectedUser.email}</div>
                  </div>
                  <button type="button" onClick={handleResetPassword} disabled={resetPwLoading} style={{
                    padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(245,166,35,0.3)",
                    background: "rgba(245,166,35,0.1)", color: "#f5a623",
                    fontFamily: "Syne", fontWeight: 700, cursor: "pointer", fontSize: 12,
                    opacity: resetPwLoading ? 0.6 : 1, whiteSpace: "nowrap"
                  }}>{resetPwLoading ? "Sending..." : "Send Reset Email"}</button>
                </div>

                {/* Super Admin Toggle */}
                <div style={{ fontSize: 11, color: "#e53e3e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>⚡ Admin Access</div>
                <div style={{
                  background: editForm.isSuperAdmin ? "rgba(229,62,62,0.1)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${editForm.isSuperAdmin ? "rgba(229,62,62,0.3)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 14, padding: "16px 20px", marginBottom: 24,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  cursor: "pointer", transition: "all 0.2s"
                }}
                onClick={() => setEditForm({ ...editForm, isSuperAdmin: !editForm.isSuperAdmin })}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: editForm.isSuperAdmin ? "#e53e3e" : "white" }}>⚡ Super Admin Rights</div>
                    <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>Full system control & user management</div>
                  </div>
                  <div style={{
                    width: 48, height: 26, borderRadius: 13, position: "relative",
                    background: editForm.isSuperAdmin ? "#e53e3e" : "rgba(255,255,255,0.15)",
                    transition: "background 0.2s"
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: "50%", background: "white",
                      position: "absolute", top: 3,
                      left: editForm.isSuperAdmin ? 25 : 3,
                      transition: "left 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                    }} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button type="button" onClick={() => setShowEditModal(false)} style={{
                    flex: 1, padding: "13px 20px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.05)", color: "white", fontFamily: "Syne",
                    fontWeight: 700, cursor: "pointer", fontSize: 14
                  }}>Cancel</button>
                  <button type="submit" disabled={editLoading} style={{
                    flex: 1, padding: "13px 20px", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg, #4299e1, #3182ce)", color: "white",
                    fontFamily: "Syne", fontWeight: 700, cursor: "pointer", fontSize: 14,
                    opacity: editLoading ? 0.6 : 1
                  }}>{editLoading ? "Saving..." : "💾 Save Changes"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DELETE CONFIRM MODAL */}
        {showDeleteModal && selectedUser && (
          <div style={modalOverlay} onClick={() => setShowDeleteModal(false)}>
            <div style={{ ...modalBox, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(252,129,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🗑️</div>
                <div>
                  <h3 style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 20, color: "white", marginBottom: 4 }}>Delete User?</h3>
                  <p style={{ color: "#a0aec0", fontSize: 13 }}>This action cannot be undone</p>
                </div>
              </div>

              <div style={{ background: "rgba(252,129,129,0.1)", border: "1px solid rgba(252,129,129,0.2)", borderRadius: 12, padding: 16, marginBottom: 24 }}>
                <p style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.6 }}>
                  You are about to delete <strong>{selectedUser.name}</strong> ({selectedUser.email}) with role <strong>{selectedUser.role}</strong>. This will remove them from the Firestore database permanently.
                </p>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setShowDeleteModal(false)} style={{
                  flex: 1, padding: "13px 20px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.05)", color: "white", fontFamily: "Syne",
                  fontWeight: 700, cursor: "pointer", fontSize: 14
                }}>Cancel</button>
                <button onClick={handleDeleteUser} disabled={deleteLoading} style={{
                  flex: 1, padding: "13px 20px", borderRadius: 12, border: "1px solid rgba(252,129,129,0.3)",
                  background: "rgba(252,129,129,0.2)", color: "#fc8181", fontFamily: "Syne",
                  fontWeight: 700, cursor: "pointer", fontSize: 14,
                  opacity: deleteLoading ? 0.6 : 1
                }}>{deleteLoading ? "Deleting..." : "🗑️ Delete User"}</button>
              </div>
            </div>
          </div>
        )}

        {/* Inline keyframe animation for toast */}
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>
      </main>
    </div>
  );
}
