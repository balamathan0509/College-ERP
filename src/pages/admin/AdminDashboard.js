import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import { useAuth } from "../../context/AuthContext";
import { db, auth } from "../../supabase/supabaseAdapter";
import {
  collection, getDocs, doc, updateDoc, deleteDoc, setDoc, query, orderBy, where
} from "../../supabase/supabaseAdapter";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "../../supabase/supabaseAdapter";
import { 
  Users, GraduationCap, UserCheck, Award, Building2, CreditCard, ShieldCheck, 
  Building, Landmark, ShieldAlert, Search, UserPlus, Filter, ChevronRight, Key, Trash2, Edit
} from "lucide-react";

const ROLES = ["student", "staff", "hod", "warden", "officestaff", "security", "management", "principal", "admin"];
const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIDS", "AIML", "MBA", "MCA"];
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const ROLE_COLORS = {
  student: "#3b82f6",
  staff: "#10b981",
  hod: "#8b5cf6",
  warden: "#06b6d4",
  officestaff: "#ec4899",
  security: "#f59e0b",
  management: "#14b8a6",
  principal: "#6366f1",
  admin: "#ef4444"
};

const ROLE_ICONS = {
  student: <GraduationCap size={16} />,
  staff: <UserCheck size={16} />,
  hod: <Award size={16} />,
  warden: <Building2 size={16} />,
  officestaff: <CreditCard size={16} />,
  security: <ShieldCheck size={16} />,
  management: <Building size={16} />,
  principal: <Landmark size={16} />,
  admin: <ShieldAlert size={16} />
};

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Hierarchy Navigation States
  const [selectedDept, setSelectedDept] = useState("CSE");
  const [selectedYear, setSelectedYear] = useState("all");
  const [viewMode, setViewMode] = useState("department"); // 'department' | 'all'
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Toast state
  const [toast, setToast] = useState(null);

  // Form states
  const [addForm, setAddForm] = useState({
    name: "", email: "", password: "", role: "staff", dept: "CSE", registerNo: "", year: "1st Year", phone: ""
  });
  const [addLoading, setAddLoading] = useState(false);

  const [editForm, setEditForm] = useState({ 
    name: "", email: "", phone: "", registerNo: "", year: "", role: "", dept: "", isSuperAdmin: false, newPassword: "", confirmNewPassword: "" 
  });
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

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle department selection
  function handleSelectDept(dept) {
    setSelectedDept(dept);
    setSelectedYear("all");
    setViewMode("department");
    setAddForm(f => ({ ...f, dept: dept }));
  }

  // Open Add Modal pre-configured for department or role
  function openAddModalFor(role = "staff", dept = selectedDept) {
    setAddForm({
      name: "", email: "", password: "", role, dept: dept === "all" ? "CSE" : dept, registerNo: "", year: "1st Year", phone: ""
    });
    setShowAddModal(true);
  }

  // Add User
  async function handleAddUser(e) {
    e.preventDefault();
    if (!addForm.name || !addForm.email || !addForm.password || !addForm.role) {
      return showToast("Please fill all required fields.", "error");
    }
    setAddLoading(true);
    try {
      if (addForm.role === "student" && addForm.registerNo) {
        const q = query(
          collection(db, "users"),
          where("registerNo", "==", addForm.registerNo.trim())
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          showToast("❌ This Register Number is already registered!", "error");
          setAddLoading(false);
          return;
        }
      }

      const result = await createUserWithEmailAndPassword(auth, addForm.email, addForm.password);
      const newUid = result.user.uid;

      const userData = {
        uid: newUid,
        id: newUid,
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
        userData.year = addForm.year || "1st Year";
      }

      await setDoc(doc(db, "users", newUid), userData);

      showToast(`✅ User "${addForm.name}" created successfully as ${addForm.role.toUpperCase()}!`);
      setShowAddModal(false);
      fetchUsers();
    } catch (err) {
      const msg = err.code === "auth/email-already-in-use"
        ? "Email already exists in Auth."
        : err.code === "auth/weak-password"
        ? "Password should be at least 6 characters."
        : `Failed to create user: ${err.message}`;
      showToast(msg, "error");
    }
    setAddLoading(false);
  }

  // Edit User
  async function handleEditUser(e) {
    e.preventDefault();
    if (!selectedUser) return;
    setEditLoading(true);
    try {
      if (editForm.role === "student" && editForm.registerNo && editForm.registerNo !== selectedUser.registerNo) {
        const q = query(
          collection(db, "users"),
          where("registerNo", "==", editForm.registerNo.trim())
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          showToast("❌ This Register Number is already registered!", "error");
          setEditLoading(false);
          return;
        }
      }

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

      if (editForm.email && editForm.email !== selectedUser.email) {
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

  // Direct Password Change
  async function handleDirectPasswordChange() {
    if (!selectedUser) return;
    if (!editForm.newPassword) return showToast("Enter a new password.", "error");
    if (editForm.newPassword.length < 6) return showToast("Password must be at least 6 characters.", "error");
    if (editForm.newPassword !== editForm.confirmNewPassword) return showToast("Passwords do not match.", "error");
    setDirectPwLoading(true);
    try {
      await updateDoc(doc(db, "users", selectedUser.id), { password: editForm.newPassword });
      showToast(`🔑 Password updated for ${selectedUser.name}!`);
      setEditForm(f => ({ ...f, newPassword: "", confirmNewPassword: "" }));
    } catch (err) {
      showToast("Failed to change password: " + err.message, "error");
    }
    setDirectPwLoading(false);
  }

  // Password Reset Email
  async function handleResetPassword() {
    if (!selectedUser?.email) return;
    setResetPwLoading(true);
    try {
      showToast(`📧 Password reset notification logged for ${selectedUser.email}!`);
    } catch (err) {
      showToast("Failed to send reset email: " + err.message, "error");
    }
    setResetPwLoading(false);
  }

  // Delete User
  async function handleDeleteUser() {
    if (!selectedUser) return;
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, "users", selectedUser.id));
      showToast(`🗑️ User "${selectedUser.name}" deleted successfully.`);
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
    setShowEditModal(true);
  }

  function openDeleteModal(user) {
    setSelectedUser(user);
    setShowDeleteModal(true);
  }

  // Filtered Users calculations for active department
  const currentDeptUsers = users.filter(u => u.dept === selectedDept);
  const currentDeptHods = currentDeptUsers.filter(u => u.role === "hod");
  const currentDeptStaff = currentDeptUsers.filter(u => u.role === "staff");
  const currentDeptStudents = currentDeptUsers.filter(u => u.role === "student");

  // Year counts helper
  const getYearCount = (yr) => {
    return currentDeptStudents.filter(s => {
      const yStr = (s.year || "").toLowerCase();
      if (yr === "1st Year") return yStr.includes("1") || yStr.includes("1st");
      if (yr === "2nd Year") return yStr.includes("2") || yStr.includes("2nd");
      if (yr === "3rd Year") return yStr.includes("3") || yStr.includes("3rd");
      if (yr === "4th Year") return yStr.includes("4") || yStr.includes("4th");
      return false;
    }).length;
  };

  // Filtered students for display
  const displayedStudents = currentDeptStudents.filter(s => {
    if (selectedYear === "all") return true;
    const yStr = (s.year || "").toLowerCase();
    if (selectedYear === "1st Year") return yStr.includes("1") || yStr.includes("1st");
    if (selectedYear === "2nd Year") return yStr.includes("2") || yStr.includes("2nd");
    if (selectedYear === "3rd Year") return yStr.includes("3") || yStr.includes("3rd");
    if (selectedYear === "4th Year") return yStr.includes("4") || yStr.includes("4th");
    return true;
  }).filter(s => {
    if (!search) return true;
    const sTerm = search.toLowerCase();
    return (s.name || "").toLowerCase().includes(sTerm) ||
           (s.email || "").toLowerCase().includes(sTerm) ||
           (s.registerNo || "").toLowerCase().includes(sTerm);
  });

  // Global search & view mode filtering
  const allFilteredUsers = users.filter(u => {
    if (search) {
      const s = search.toLowerCase();
      const matchSearch = (u.name || "").toLowerCase().includes(s) ||
                          (u.email || "").toLowerCase().includes(s) ||
                          (u.registerNo || "").toLowerCase().includes(s);
      if (!matchSearch) return false;
    }
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    return true;
  });

  // Stats Total Summary
  const stats = {
    total: users.length,
    students: users.filter(u => u.role === "student").length,
    staff: users.filter(u => u.role === "staff").length,
    hods: users.filter(u => u.role === "hod").length,
    admins: users.filter(u => u.isSuperAdmin || u.role === "admin").length
  };

  // Styles
  const modalOverlay = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 2000, backdropFilter: "blur(8px)", padding: 20
  };
  const modalBox = {
    background: "#16213e", borderRadius: 24, padding: 36, maxWidth: 540, width: "100%",
    border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 25px 80px rgba(0,0,0,0.6)",
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
            background: toast.type === "error" ? "rgba(239, 68, 68, 0.95)" : "rgba(16, 185, 129, 0.95)",
            color: "white", fontWeight: 600, fontSize: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            animation: "slideIn 0.3s ease",
            maxWidth: 400
          }}>
            {toast.message}
          </div>
        )}

        <DateTimeHeader />
        
        {/* Page Header */}
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "white" }}>Super Admin Control Panel</h1>
            <p style={{ color: "#a0aec0", fontSize: 14, marginTop: 4 }}>Structured Department & Role Management System</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn-primary" onClick={() => openAddModalFor("staff", selectedDept)} style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px"
            }}>
              <UserPlus size={18} /> Add New User
            </button>
          </div>
        </div>

        {/* Global System Summary Cards */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          {[
            { icon: <Users size={22} color="#3b82f6" />, value: stats.total, label: "Total Accounts", color: "#3b82f6" },
            { icon: <Award size={22} color="#8b5cf6" />, value: stats.hods, label: "Department HODs", color: "#8b5cf6" },
            { icon: <UserCheck size={22} color="#10b981" />, value: stats.staff, label: "Faculty Staff", color: "#10b981" },
            { icon: <GraduationCap size={22} color="#ec4899" />, value: stats.students, label: "Enrolled Students", color: "#ec4899" },
            { icon: <ShieldAlert size={22} color="#ef4444" />, value: stats.admins, label: "Super Admins", color: "#ef4444" }
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{ background: "rgba(22, 33, 62, 0.6)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ marginBottom: 12 }}>{s.icon}</div>
              <div className="stat-value" style={{ color: s.color, fontSize: 28, fontWeight: 800 }}>{s.value}</div>
              <div className="stat-label" style={{ fontSize: 12, color: "#a0aec0", textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Navigation Mode Switcher: Department Hierarchy vs Full Directory */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 20, flexWrap: "wrap", gap: 12,
          background: "rgba(22, 33, 62, 0.4)", padding: "12px 18px", borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.06)"
        }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button 
              onClick={() => setViewMode("department")}
              style={{
                padding: "10px 20px", borderRadius: 12, border: "none",
                background: viewMode === "department" ? "linear-gradient(135deg, #3b82f6, #2563eb)" : "rgba(255,255,255,0.05)",
                color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer",
                boxShadow: viewMode === "department" ? "0 4px 14px rgba(37,99,235,0.3)" : "none",
                transition: "all 0.2s"
              }}
            >
              🏢 Department Hierarchy View
            </button>
            <button 
              onClick={() => setViewMode("all")}
              style={{
                padding: "10px 20px", borderRadius: 12, border: "none",
                background: viewMode === "all" ? "linear-gradient(135deg, #8b5cf6, #7c3aed)" : "rgba(255,255,255,0.05)",
                color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer",
                boxShadow: viewMode === "all" ? "0 4px 14px rgba(124,58,237,0.3)" : "none",
                transition: "all 0.2s"
              }}
            >
              🌐 Full System Directory ({users.length})
            </button>
          </div>

          {/* Quick Search */}
          <div style={{ position: "relative", minWidth: 260 }}>
            <Search size={16} color="#a0aec0" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search by name, email, or register no..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "9px 14px 9px 38px",
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12, color: "white", fontSize: 13, outline: "none"
              }}
            />
          </div>
        </div>

        {/* MODE 1: DEPARTMENT HIERARCHY VIEW */}
        {viewMode === "department" && (
          <>
            {/* Department Selector Cards */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#a0aec0", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
                SELECT DEPARTMENT TO MANAGE HOD, STAFF & STUDENTS:
              </div>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12
              }}>
                {DEPARTMENTS.map(d => {
                  const dUsers = users.filter(u => u.dept === d);
                  const isSelected = selectedDept === d;
                  const staffCount = dUsers.filter(u => u.role === "staff" || u.role === "hod").length;
                  const studCount = dUsers.filter(u => u.role === "student").length;

                  return (
                    <div
                      key={d}
                      onClick={() => handleSelectDept(d)}
                      style={{
                        padding: "16px 14px", borderRadius: 16, cursor: "pointer",
                        background: isSelected 
                          ? "linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(139, 92, 246, 0.25))"
                          : "rgba(22, 33, 62, 0.5)",
                        border: isSelected ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)",
                        boxShadow: isSelected ? "0 8px 24px rgba(59, 130, 246, 0.25)" : "none",
                        transition: "all 0.2s ease",
                        textAlign: "center"
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 18, color: isSelected ? "#60a5fa" : "white", marginBottom: 6 }}>
                        {d}
                      </div>
                      <div style={{ fontSize: 11, color: "#a0aec0", display: "flex", justifyContent: "center", gap: 8 }}>
                        <span>👨‍🏫 {staffCount}</span>
                        <span>🎓 {studCount}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SELECTED DEPARTMENT BANNER & HIERARCHY DETAILS */}
            <div className="card" style={{
              background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))",
              border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: 24, marginBottom: 28
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 900, fontSize: 20, color: "white"
                  }}>
                    {selectedDept}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: "white", margin: 0 }}>
                      Department of {selectedDept}
                    </h2>
                    <p style={{ color: "#a0aec0", fontSize: 13, margin: "2px 0 0 0" }}>
                      {currentDeptStaff.length} Faculty Staff • {currentDeptStudents.length} Students Enrolled
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => openAddModalFor("hod", selectedDept)} style={{
                    padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(139, 92, 246, 0.4)",
                    background: "rgba(139, 92, 246, 0.15)", color: "#a78bfa", fontSize: 12, fontWeight: 700, cursor: "pointer"
                  }}>
                    + Add HOD
                  </button>
                  <button onClick={() => openAddModalFor("staff", selectedDept)} style={{
                    padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(16, 185, 129, 0.4)",
                    background: "rgba(16, 185, 129, 0.15)", color: "#34d399", fontSize: 12, fontWeight: 700, cursor: "pointer"
                  }}>
                    + Add Staff
                  </button>
                  <button onClick={() => openAddModalFor("student", selectedDept)} style={{
                    padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(59, 130, 246, 0.4)",
                    background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", fontSize: 12, fontWeight: 700, cursor: "pointer"
                  }}>
                    + Add Student
                  </button>
                </div>
              </div>

              {/* 1. HOD & STAFF SECTION */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>
                  👑 Head of Department (HOD) & Faculty Staff
                </div>

                {/* HOD Card Display */}
                {currentDeptHods.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14, marginBottom: 16 }}>
                    {currentDeptHods.map(hod => (
                      <div key={hod.id} style={{
                        background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(99, 102, 241, 0.15))",
                        border: "1px solid rgba(139, 92, 246, 0.3)", borderRadius: 16, padding: 18,
                        display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 12, background: "rgba(139, 92, 246, 0.3)",
                            display: "flex", alignItems: "center", justifyContent: "center", color: "#c4b5fd"
                          }}>
                            <Award size={22} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: "white" }}>{hod.name || "HOD"}</div>
                            <div style={{ fontSize: 12, color: "#a78bfa" }}>Head of Department ({selectedDept})</div>
                            <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 2 }}>📧 {hod.email}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => openEditModal(hod)} style={{ padding: 6, borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "none", color: "white", cursor: "pointer" }}><Edit size={14} /></button>
                          <button onClick={() => openDeleteModal(hod)} style={{ padding: 6, borderRadius: 8, background: "rgba(239,68,68,0.2)", border: "none", color: "#fca5a5", cursor: "pointer" }}><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.15)",
                    borderRadius: 14, padding: 16, textAlign: "center", marginBottom: 16, color: "#a0aec0", fontSize: 13
                  }}>
                    No HOD currently assigned to {selectedDept}. <span style={{ color: "#8b5cf6", cursor: "pointer", fontWeight: 700 }} onClick={() => openAddModalFor("hod", selectedDept)}>+ Assign HOD Now</span>
                  </div>
                )}

                {/* Staff Members List */}
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a0aec0", marginBottom: 10 }}>
                  Faculty Members ({currentDeptStaff.length}):
                </div>
                {currentDeptStaff.length === 0 ? (
                  <div style={{ color: "#718096", fontSize: 13, padding: "12px 0" }}>No staff members added for {selectedDept} yet.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                    {currentDeptStaff.map(st => (
                      <div key={st.id} style={{
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 14, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: "white" }}>{st.name}</div>
                          <div style={{ fontSize: 12, color: "#a0aec0" }}>{st.email}</div>
                          {st.phone && <div style={{ fontSize: 11, color: "#718096" }}>📞 {st.phone}</div>}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => openEditModal(st)} style={{ padding: 6, borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "none", color: "#e2e8f0", cursor: "pointer" }}><Edit size={14} /></button>
                          <button onClick={() => openDeleteModal(st)} style={{ padding: 6, borderRadius: 8, background: "rgba(239,68,68,0.15)", border: "none", color: "#fca5a5", cursor: "pointer" }}><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. STUDENTS BREAKDOWN BY YEAR SECTION */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>
                  🎓 Students Breakdown by Academic Year ({selectedDept})
                </div>

                {/* 4 Year Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 20 }}>
                  {YEARS.map(yr => {
                    const count = getYearCount(yr);
                    const isYearActive = selectedYear === yr;

                    return (
                      <div
                        key={yr}
                        onClick={() => setSelectedYear(isYearActive ? "all" : yr)}
                        style={{
                          background: isYearActive ? "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(37, 99, 235, 0.3))" : "rgba(255,255,255,0.04)",
                          border: isYearActive ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 16, padding: 16, cursor: "pointer",
                          transition: "all 0.2s ease"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: isYearActive ? "#93c5fd" : "white" }}>{yr}</span>
                          <span style={{
                            padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 800,
                            background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa"
                          }}>{count} Students</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#a0aec0", display: "flex", alignItems: "center", gap: 4 }}>
                          {isYearActive ? "Showing filtered list below" : "Click to filter list below"} <ChevronRight size={14} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* YEAR FILTER PILLS & STUDENTS TABLE */}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginBottom: 14, flexWrap: "wrap", gap: 12
                }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: "#a0aec0", fontWeight: 600 }}>Filter Year:</span>
                    <button
                      onClick={() => setSelectedYear("all")}
                      style={{
                        padding: "6px 14px", borderRadius: 20, border: "none",
                        background: selectedYear === "all" ? "#3b82f6" : "rgba(255,255,255,0.07)",
                        color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer"
                      }}
                    >
                      All Years ({currentDeptStudents.length})
                    </button>
                    {YEARS.map(yr => (
                      <button
                        key={yr}
                        onClick={() => setSelectedYear(yr)}
                        style={{
                          padding: "6px 14px", borderRadius: 20, border: "none",
                          background: selectedYear === yr ? "#3b82f6" : "rgba(255,255,255,0.07)",
                          color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer"
                        }}
                      >
                        {yr} ({getYearCount(yr)})
                      </button>
                    ))}
                  </div>

                  <div style={{ fontSize: 13, color: "#a0aec0" }}>
                    Showing {displayedStudents.length} student records
                  </div>
                </div>

                {/* STUDENTS TABLE */}
                <div style={{ background: "rgba(15, 23, 42, 0.6)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)" }}>
                          {["Student Name", "Register No", "Email", "Year", "Dept", "Phone", "Actions"].map(h => (
                            <th key={h} style={{
                              padding: "14px 18px", textAlign: "left", fontSize: 11,
                              color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {displayedStudents.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
                              No student records found for {selectedDept} {selectedYear !== "all" ? `(${selectedYear})` : ""}.
                            </td>
                          </tr>
                        ) : displayedStudents.map(stud => (
                          <tr key={stud.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <td style={{ padding: "12px 18px", fontWeight: 600, color: "white", fontSize: 14 }}>
                              👨‍🎓 {stud.name || stud.studentName || "—"}
                            </td>
                            <td style={{ padding: "12px 18px", fontSize: 13, color: "#60a5fa", fontWeight: 700 }}>
                              {stud.registerNo || stud.registerNumber || "—"}
                            </td>
                            <td style={{ padding: "12px 18px", fontSize: 13, color: "#94a3b8" }}>{stud.email}</td>
                            <td style={{ padding: "12px 18px" }}>
                              <span style={{ padding: "4px 10px", borderRadius: 10, background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", fontSize: 12, fontWeight: 700 }}>
                                {stud.year || "—"}
                              </span>
                            </td>
                            <td style={{ padding: "12px 18px", fontSize: 13, color: "#cbd5e1" }}>{stud.dept || selectedDept}</td>
                            <td style={{ padding: "12px 18px", fontSize: 13, color: "#94a3b8" }}>{stud.phone || "—"}</td>
                            <td style={{ padding: "12px 18px" }}>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => openEditModal(stud)} style={{ padding: "5px 10px", borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "none", color: "white", fontSize: 12, cursor: "pointer" }}>Edit</button>
                                <button onClick={() => openDeleteModal(stud)} style={{ padding: "5px 10px", borderRadius: 8, background: "rgba(239, 68, 68, 0.15)", border: "none", color: "#fca5a5", fontSize: 12, cursor: "pointer" }}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* MODE 2: FULL SYSTEM DIRECTORY VIEW */}
        {viewMode === "all" && (
          <div className="card" style={{ padding: 0, overflow: "hidden", borderRadius: 20 }}>
            {/* Filters Bar */}
            <div style={{ padding: 20, borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{
                padding: "10px 16px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12, color: "white", fontSize: 13, outline: "none"
              }}>
                <option value="all">All System Roles</option>
                {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
              </select>

              <div style={{ fontSize: 13, color: "#a0aec0", marginLeft: "auto" }}>
                Showing {allFilteredUsers.length} of {users.length} total system users
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)" }}>
                    {["User", "Email", "Role", "Department", "Super Admin", "Actions"].map(h => (
                      <th key={h} style={{
                        padding: "16px 20px", textAlign: "left", fontSize: 11,
                        color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allFilteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
                        No user accounts match your search query.
                      </td>
                    </tr>
                  ) : allFilteredUsers.map(user => (
                    <tr key={user.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: `${ROLE_COLORS[user.role] || "#3b82f6"}20`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: ROLE_COLORS[user.role] || "#3b82f6"
                          }}>
                            {ROLE_ICONS[user.role] || "👤"}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: "white" }}>{user.name || "—"}</div>
                            {user.registerNo && <div style={{ fontSize: 12, color: "#60a5fa" }}>{user.registerNo}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 13, color: "#94a3b8" }}>{user.email}</td>
                      <td style={{ padding: "14px 20px" }}>
                        <span style={{
                          padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 800,
                          background: `${ROLE_COLORS[user.role] || "#3b82f6"}20`,
                          color: ROLE_COLORS[user.role] || "#3b82f6",
                          textTransform: "uppercase"
                        }}>
                          {user.role || "—"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 13, color: "#cbd5e1" }}>{user.dept || "—"}</td>
                      <td style={{ padding: "14px 20px" }}>
                        {user.isSuperAdmin ? (
                          <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 8, background: "rgba(239, 68, 68, 0.2)", color: "#fca5a5" }}>YES</span>
                        ) : (
                          <span style={{ fontSize: 13, color: "#64748b" }}>No</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => openEditModal(user)} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "none", color: "white", fontSize: 12, cursor: "pointer" }}>Edit</button>
                          <button onClick={() => openDeleteModal(user)} disabled={user.uid === currentUser?.uid} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(239,68,68,0.15)", border: "none", color: "#fca5a5", fontSize: 12, cursor: "pointer", opacity: user.uid === currentUser?.uid ? 0.3 : 1 }}>Delete</button>
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
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>➕</div>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: 20, color: "white", margin: 0 }}>Add New User Account</h3>
                  <p style={{ color: "#a0aec0", fontSize: 13, margin: "2px 0 0 0" }}>Create user credentials with defined role & department</p>
                </div>
              </div>

              <form onSubmit={handleAddUser}>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input type="text" placeholder="Enter full name" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Email Address *</label>
                  <input type="email" placeholder="user@college.edu" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Password *</label>
                  <input type="password" placeholder="Minimum 6 characters" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role *</label>
                    <select value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })} required>
                      {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <select value={addForm.dept} onChange={e => setAddForm({ ...addForm, dept: e.target.value })}>
                      <option value="">Select Department</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                {addForm.role === "student" && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Register Number</label>
                      <input type="text" placeholder="e.g. 952523104001" value={addForm.registerNo} onChange={e => setAddForm({ ...addForm, registerNo: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Academic Year</label>
                      <select value={addForm.year} onChange={e => setAddForm({ ...addForm, year: e.target.value })}>
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="text" placeholder="Contact number" value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} />
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                  <button type="button" onClick={() => setShowAddModal(false)} style={{
                    flex: 1, padding: "12px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.05)", color: "white", fontWeight: 700, cursor: "pointer"
                  }}>Cancel</button>
                  <button type="submit" disabled={addLoading} style={{
                    flex: 1, padding: "12px 18px", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg, #10b981, #059669)", color: "white",
                    fontWeight: 700, cursor: "pointer", opacity: addLoading ? 0.6 : 1
                  }}>{addLoading ? "Creating..." : "✅ Create User"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* EDIT USER MODAL */}
        {showEditModal && selectedUser && (
          <div style={modalOverlay} onClick={() => setShowEditModal(false)}>
            <div style={{ ...modalBox, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(59, 130, 246, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>✏️</div>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: 20, color: "white", margin: 0 }}>Edit User Details</h3>
                  <p style={{ color: "#a0aec0", fontSize: 13, margin: "2px 0 0 0" }}>{selectedUser.name} ({selectedUser.email})</p>
                </div>
              </div>

              <form onSubmit={handleEditUser}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email Address</label>
                    <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input type="text" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Role</label>
                    <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                      {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
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

                {editForm.role === "student" && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Register No</label>
                      <input type="text" value={editForm.registerNo} onChange={e => setEditForm({ ...editForm, registerNo: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Year</label>
                      <select value={editForm.year} onChange={e => setEditForm({ ...editForm, year: e.target.value })}>
                        <option value="">Select Year</option>
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Instant Password Change */}
                <div style={{
                  background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)",
                  borderRadius: 14, padding: 16, marginBottom: 20
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#34d399", marginBottom: 10 }}>🔑 Set New Password Directly</div>
                  <div className="form-row">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 11 }}>New Password</label>
                      <input type="password" placeholder="Min 6 chars" value={editForm.newPassword} onChange={e => setEditForm({ ...editForm, newPassword: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 11 }}>Confirm Password</label>
                      <input type="password" placeholder="Re-enter password" value={editForm.confirmNewPassword} onChange={e => setEditForm({ ...editForm, confirmNewPassword: e.target.value })} />
                    </div>
                  </div>
                  <button type="button" onClick={handleDirectPasswordChange} disabled={directPwLoading || !editForm.newPassword} style={{
                    marginTop: 12, padding: "8px 16px", borderRadius: 10, border: "none",
                    background: editForm.newPassword ? "linear-gradient(135deg, #10b981, #059669)" : "rgba(255,255,255,0.1)",
                    color: "white", fontWeight: 700, cursor: editForm.newPassword ? "pointer" : "default",
                    fontSize: 12, width: "100%"
                  }}>{directPwLoading ? "Updating..." : "🔑 Update Password Now"}</button>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button type="button" onClick={() => setShowEditModal(false)} style={{
                    flex: 1, padding: "12px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.05)", color: "white", fontWeight: 700, cursor: "pointer"
                  }}>Cancel</button>
                  <button type="submit" disabled={editLoading} style={{
                    flex: 1, padding: "12px 18px", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "white",
                    fontWeight: 700, cursor: "pointer", opacity: editLoading ? 0.6 : 1
                  }}>{editLoading ? "Saving..." : "💾 Save Changes"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DELETE MODAL */}
        {showDeleteModal && selectedUser && (
          <div style={modalOverlay} onClick={() => setShowDeleteModal(false)}>
            <div style={{ ...modalBox, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(239, 68, 68, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🗑️</div>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: 20, color: "white", margin: 0 }}>Delete User Account?</h3>
                  <p style={{ color: "#a0aec0", fontSize: 13, margin: "2px 0 0 0" }}>This action is permanent</p>
                </div>
              </div>

              <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 14, padding: 16, marginBottom: 24, fontSize: 13, color: "#fca5a5" }}>
                Deleting <strong>{selectedUser.name}</strong> ({selectedUser.email}) will remove their access and record from the database.
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setShowDeleteModal(false)} style={{
                  flex: 1, padding: "12px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.05)", color: "white", fontWeight: 700, cursor: "pointer"
                }}>Cancel</button>
                <button onClick={handleDeleteUser} disabled={deleteLoading} style={{
                  flex: 1, padding: "12px 18px", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "white",
                  fontWeight: 700, cursor: "pointer", opacity: deleteLoading ? 0.6 : 1
                }}>{deleteLoading ? "Deleting..." : "🗑️ Delete User"}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
