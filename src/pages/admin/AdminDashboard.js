import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import { useAuth } from "../../context/AuthContext";
import { db, auth } from "../../supabase/supabaseAdapter";
import {
  collection, getDocs, doc, updateDoc, deleteDoc, setDoc, query, orderBy, where
} from "../../supabase/supabaseAdapter";
import { createUserWithEmailAndPassword } from "../../supabase/supabaseAdapter";
import { 
  Users, GraduationCap, UserCheck, Award, Building2, CreditCard, ShieldCheck, 
  Building, Landmark, ShieldAlert, Search, UserPlus, Key, Trash2, Edit2, ChevronRight, Plus, Check, X
} from "lucide-react";

const ROLES = ["student", "staff", "hod", "warden", "officestaff", "security", "management", "principal", "admin"];
const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "IT", "AIDS"];
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const DEPT_NAMES = {
  CSE: "Computer Science & Engineering",
  ECE: "Electronics & Communication Engineering",
  EEE: "Electrical & Electronics Engineering",
  MECH: "Mechanical Engineering",
  IT: "Information Technology",
  AIDS: "Artificial Intelligence & Data Science"
};

const ROLE_COLORS = {
  student: "#2563eb",
  staff: "#059669",
  hod: "#7c3aed",
  warden: "#0891b2",
  officestaff: "#db2777",
  security: "#d97706",
  management: "#0d9488",
  principal: "#4f46e5",
  admin: "#dc2626"
};

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Department Selection & Filters
  const [selectedDept, setSelectedDept] = useState("CSE");
  const [selectedYear, setSelectedYear] = useState("all");
  const [search, setSearch] = useState("");

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
      showToast("Failed to fetch user accounts", "error");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Department switcher
  function handleSelectDept(dept) {
    setSelectedDept(dept);
    setSelectedYear("all");
    setAddForm(f => ({ ...f, dept: dept }));
  }

  // Open Add Modal
  function openAddModalFor(role = "staff", dept = selectedDept) {
    setAddForm({
      name: "", email: "", password: "", role, dept: dept || "CSE", registerNo: "", year: "1st Year", phone: ""
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
          showToast("Register Number already exists.", "error");
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

      showToast(`User account "${addForm.name}" created successfully as ${addForm.role.toUpperCase()}`);
      setShowAddModal(false);
      fetchUsers();
    } catch (err) {
      const msg = err.code === "auth/email-already-in-use"
        ? "Email address is already in use."
        : err.code === "auth/weak-password"
        ? "Password must be at least 6 characters."
        : `Failed to create account: ${err.message}`;
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
          showToast("Register Number already exists.", "error");
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
      showToast(`User record "${editForm.name || selectedUser.name}" updated successfully.`);
      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      showToast(`Failed to update user record: ${err.message}`, "error");
    }
    setEditLoading(false);
  }

  // Direct Password Change
  async function handleDirectPasswordChange() {
    if (!selectedUser) return;
    if (!editForm.newPassword) return showToast("Please enter a new password.", "error");
    if (editForm.newPassword.length < 6) return showToast("Password must be at least 6 characters long.", "error");
    if (editForm.newPassword !== editForm.confirmNewPassword) return showToast("Passwords do not match.", "error");
    setDirectPwLoading(true);
    try {
      await updateDoc(doc(db, "users", selectedUser.id), { password: editForm.newPassword });
      showToast(`Password updated successfully for ${selectedUser.name}.`);
      setEditForm(f => ({ ...f, newPassword: "", confirmNewPassword: "" }));
    } catch (err) {
      showToast("Failed to update password: " + err.message, "error");
    }
    setDirectPwLoading(false);
  }

  // Delete User
  async function handleDeleteUser() {
    if (!selectedUser) return;
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, "users", selectedUser.id));
      showToast(`User account "${selectedUser.name}" removed from database.`);
      setShowDeleteModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      showToast("Failed to delete user account.", "error");
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

  // Filtered department users
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

  // Global System Stats
  const stats = {
    total: users.length,
    students: users.filter(u => u.role === "student").length,
    staff: users.filter(u => u.role === "staff").length,
    hods: users.filter(u => u.role === "hod").length,
    admins: users.filter(u => u.isSuperAdmin || u.role === "admin").length
  };

  // Professional Enterprise Modal Overlay & Box
  const modalOverlay = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(15, 23, 42, 0.75)", display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 2000, backdropFilter: "blur(6px)", padding: 20
  };
  const modalBox = {
    background: "#1e293b", borderRadius: 16, padding: 32, maxWidth: 540, width: "100%",
    border: "1px solid #334155", boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
    maxHeight: "90vh", overflowY: "auto", color: "#f8fafc"
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content" style={{ padding: "28px 36px" }}>
        
        {/* Toast Notification */}
        {toast && (
          <div style={{
            position: "fixed", top: 24, right: 24, zIndex: 3000,
            padding: "12px 20px", borderRadius: 10,
            background: toast.type === "error" ? "#dc2626" : "#059669",
            color: "white", fontWeight: 600, fontSize: 14,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            animation: "slideIn 0.2s ease",
            maxWidth: 400
          }}>
            {toast.message}
          </div>
        )}

        <DateTimeHeader />
        
        {/* Page Title & Main Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "#f8fafc", margin: 0, letterSpacing: "-0.3px" }}>
              Super Admin Management Console
            </h1>
            <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 4, margin: "4px 0 0 0" }}>
              Enterprise Department & User Role Hierarchy
            </p>
          </div>
          <button 
            onClick={() => openAddModalFor("staff", selectedDept)} 
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px",
              borderRadius: 10, border: "none",
              background: "#2563eb",
              color: "white", fontWeight: 600, fontSize: 14, cursor: "pointer",
              transition: "background 0.2s"
            }}
          >
            <UserPlus size={16} /> Add New User
          </button>
        </div>

        {/* Global Summary Metrics (Enterprise Stat Cards) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
          {[
            { icon: <Users size={20} color="#3b82f6" />, value: stats.total, label: "Total System Accounts", border: "#3b82f6" },
            { icon: <Award size={20} color="#8b5cf6" />, value: stats.hods, label: "Department HODs", border: "#8b5cf6" },
            { icon: <UserCheck size={20} color="#10b981" />, value: stats.staff, label: "Faculty Members", border: "#10b981" },
            { icon: <GraduationCap size={20} color="#38bdf8" />, value: stats.students, label: "Enrolled Students", border: "#38bdf8" },
            { icon: <ShieldAlert size={20} color="#ef4444" />, value: stats.admins, label: "Super Administrators", border: "#ef4444" }
          ].map((s, i) => (
            <div key={i} style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderTop: `3px solid ${s.border}`,
              borderRadius: 12, padding: "18px 20px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</span>
                {s.icon}
              </div>
              <div style={{ color: "#f8fafc", fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* DEPARTMENT SELECTION CARDS HEADER */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>
            Departments Directory:
          </div>

          {/* Department Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
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
                    padding: "16px 18px", borderRadius: 12, cursor: "pointer",
                    background: isSelected ? "#1e293b" : "#0f172a",
                    border: isSelected ? "2px solid #2563eb" : "1px solid #334155",
                    transition: "all 0.15s ease"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 18, color: isSelected ? "#38bdf8" : "#f8fafc" }}>{d}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8" }}>{staffCount + studCount} Total</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {DEPT_NAMES[d]}
                  </div>
                  <div style={{ fontSize: 11, display: "flex", gap: 8, color: "#cbd5e1" }}>
                    <span>Faculty: <strong>{staffCount}</strong></span>
                    <span>•</span>
                    <span>Students: <strong>{studCount}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SELECTED DEPARTMENT HIERARCHY CONTENT CONTAINER */}
        <div style={{
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 16, padding: 28, marginBottom: 32
        }}>
          {/* Department Header Banner */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 24, paddingBottom: 18, borderBottom: "1px solid #334155" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: "#2563eb",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 18, color: "white"
              }}>
                {selectedDept}
              </div>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                  Department of {DEPT_NAMES[selectedDept]} ({selectedDept})
                </h2>
                <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 13, color: "#94a3b8" }}>
                  <span>Faculty Staff: <strong>{currentDeptStaff.length}</strong></span>
                  <span>•</span>
                  <span>Enrolled Students: <strong>{currentDeptStudents.length}</strong></span>
                </div>
              </div>
            </div>

            {/* Department Action Buttons */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => openAddModalFor("hod", selectedDept)} style={{
                padding: "8px 16px", borderRadius: 8, border: "1px solid #7c3aed",
                background: "rgba(124, 58, 237, 0.1)", color: "#a78bfa", fontSize: 13, fontWeight: 600, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6
              }}>
                <Plus size={14} /> Add HOD
              </button>
              <button onClick={() => openAddModalFor("staff", selectedDept)} style={{
                padding: "8px 16px", borderRadius: 8, border: "1px solid #059669",
                background: "rgba(5, 150, 105, 0.1)", color: "#34d399", fontSize: 13, fontWeight: 600, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6
              }}>
                <Plus size={14} /> Add Staff
              </button>
              <button onClick={() => openAddModalFor("student", selectedDept)} style={{
                padding: "8px 16px", borderRadius: 8, border: "1px solid #2563eb",
                background: "rgba(37, 99, 235, 0.1)", color: "#60a5fa", fontSize: 13, fontWeight: 600, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6
              }}>
                <Plus size={14} /> Add Student
              </button>
            </div>
          </div>

          {/* 1. HOD & FACULTY STAFF SECTION */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Award size={16} color="#a855f7" /> Head of Department (HOD) & Faculty Members
            </div>

            {/* HOD Card */}
            {currentDeptHods.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14, marginBottom: 18 }}>
                {currentDeptHods.map(hod => (
                  <div key={hod.id} style={{
                    background: "#0f172a",
                    border: "1px solid #334155", borderLeft: "4px solid #7c3aed",
                    borderRadius: 12, padding: 18,
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, background: "rgba(124, 58, 237, 0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center", color: "#c4b5fd"
                      }}>
                        <Award size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#f8fafc" }}>{hod.name || "HOD"}</div>
                        <div style={{ fontSize: 12, color: "#a78bfa", fontWeight: 600 }}>Head of Department ({selectedDept})</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{hod.email}</div>
                        {hod.phone && <div style={{ fontSize: 11, color: "#64748b" }}>Phone: {hod.phone}</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEditModal(hod)} style={{ padding: "6px 10px", borderRadius: 6, background: "#334155", border: "none", color: "white", cursor: "pointer" }}><Edit2 size={14} /></button>
                      <button onClick={() => openDeleteModal(hod)} style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(220, 38, 38, 0.2)", border: "none", color: "#fca5a5", cursor: "pointer" }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                background: "#0f172a", border: "1px dashed #334155",
                borderRadius: 12, padding: 16, textAlign: "center", marginBottom: 18, color: "#94a3b8", fontSize: 13
              }}>
                No HOD is currently assigned to {selectedDept}. <span style={{ color: "#a78bfa", cursor: "pointer", fontWeight: 600 }} onClick={() => openAddModalFor("hod", selectedDept)}>Assign HOD</span>
              </div>
            )}

            {/* Faculty Members List Grid */}
            <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 10 }}>
              Faculty Members ({currentDeptStaff.length}):
            </div>
            {currentDeptStaff.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 13, padding: "8px 0" }}>No faculty staff added for {selectedDept}.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {currentDeptStaff.map(st => (
                  <div key={st.id} style={{
                    background: "#0f172a", border: "1px solid #334155",
                    borderRadius: 12, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "#f8fafc" }}>{st.name}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>{st.email}</div>
                      {st.phone && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Phone: {st.phone}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEditModal(st)} style={{ padding: "6px 10px", borderRadius: 6, background: "#334155", border: "none", color: "#e2e8f0", cursor: "pointer" }}><Edit2 size={14} /></button>
                      <button onClick={() => openDeleteModal(st)} style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(220, 38, 38, 0.15)", border: "none", color: "#fca5a5", cursor: "pointer" }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. STUDENTS BREAKDOWN BY ACADEMIC YEAR */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <GraduationCap size={16} color="#38bdf8" /> Academic Year Breakdown ({selectedDept})
            </div>

            {/* 4 Year Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
              {YEARS.map(yr => {
                const count = getYearCount(yr);
                const isYearActive = selectedYear === yr;

                return (
                  <div
                    key={yr}
                    onClick={() => setSelectedYear(isYearActive ? "all" : yr)}
                    style={{
                      background: isYearActive ? "#0f172a" : "#0f172a",
                      border: isYearActive ? "2px solid #2563eb" : "1px solid #334155",
                      borderRadius: 12, padding: 16, cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: isYearActive ? "#38bdf8" : "#f8fafc" }}>{yr}</span>
                      <span style={{
                        padding: "3px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                        background: isYearActive ? "#2563eb" : "rgba(37, 99, 235, 0.15)",
                        color: isYearActive ? "white" : "#60a5fa"
                      }}>{count} Students</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                      {isYearActive ? "Filtered view active" : "Click to view list"} <ChevronRight size={12} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* SEARCH & YEAR FILTER BAR FOR STUDENTS */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 16, flexWrap: "wrap", gap: 12,
              background: "#0f172a", padding: "12px 16px", borderRadius: 12,
              border: "1px solid #334155"
            }}>
              {/* Year Filter Buttons */}
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>Year:</span>
                <button
                  onClick={() => setSelectedYear("all")}
                  style={{
                    padding: "6px 12px", borderRadius: 6, border: "none",
                    background: selectedYear === "all" ? "#2563eb" : "#1e293b",
                    color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer"
                  }}
                >
                  All ({currentDeptStudents.length})
                </button>
                {YEARS.map(yr => (
                  <button
                    key={yr}
                    onClick={() => setSelectedYear(yr)}
                    style={{
                      padding: "6px 12px", borderRadius: 6, border: "none",
                      background: selectedYear === yr ? "#2563eb" : "#1e293b",
                      color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer"
                    }}
                  >
                    {yr} ({getYearCount(yr)})
                  </button>
                ))}
              </div>

              {/* Department Student Search */}
              <div style={{ position: "relative", minWidth: 240 }}>
                <Search size={14} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: "100%", padding: "7px 12px 7px 34px",
                    background: "#1e293b", border: "1px solid #334155",
                    borderRadius: 8, color: "white", fontSize: 13, outline: "none"
                  }}
                />
              </div>
            </div>

            {/* STUDENTS DATA TABLE */}
            <div style={{ background: "#0f172a", borderRadius: 12, border: "1px solid #334155", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #334155", background: "#1e293b" }}>
                      {["Student Name", "Register No", "Email", "Year", "Dept", "Phone", "Actions"].map(h => (
                        <th key={h} style={{
                          padding: "14px 16px", textAlign: "left", fontSize: 11,
                          color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedStudents.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: 36, color: "#64748b", fontSize: 13 }}>
                          No student records found for {selectedDept} {selectedYear !== "all" ? `(${selectedYear})` : ""}.
                        </td>
                      </tr>
                    ) : displayedStudents.map(stud => (
                      <tr key={stud.id} style={{ borderBottom: "1px solid #1e293b" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: "#f8fafc", fontSize: 14 }}>
                          {stud.name || stud.studentName || "—"}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "#38bdf8", fontWeight: 600, fontFamily: "monospace" }}>
                          {stud.registerNo || stud.registerNumber || "—"}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "#cbd5e1" }}>{stud.email}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(37, 99, 235, 0.15)", color: "#60a5fa", fontSize: 12, fontWeight: 600 }}>
                            {stud.year || "—"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "#cbd5e1" }}>{stud.dept || selectedDept}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "#94a3b8" }}>{stud.phone || "—"}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => openEditModal(stud)} style={{ padding: "5px 10px", borderRadius: 6, background: "#334155", border: "none", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                            <button onClick={() => openDeleteModal(stud)} style={{ padding: "5px 10px", borderRadius: 6, background: "rgba(220, 38, 38, 0.15)", border: "none", color: "#fca5a5", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Delete</button>
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

        {/* ADD USER MODAL */}
        {showAddModal && (
          <div style={modalOverlay} onClick={() => setShowAddModal(false)}>
            <div style={modalBox} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 12, borderBottom: "1px solid #334155" }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 18, color: "white", margin: 0 }}>Add New User Account</h3>
                  <p style={{ color: "#94a3b8", fontSize: 13, margin: "2px 0 0 0" }}>Create user credentials with role & department</p>
                </div>
                <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}><X size={20} /></button>
              </div>

              <form onSubmit={handleAddUser}>
                <div className="form-group">
                  <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>Full Name *</label>
                  <input type="text" placeholder="Enter full name" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} required style={{ background: "#0f172a", border: "1px solid #334155", color: "white", borderRadius: 8, padding: 10 }} />
                </div>
                <div className="form-group">
                  <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>Email Address *</label>
                  <input type="email" placeholder="user@college.edu" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} required style={{ background: "#0f172a", border: "1px solid #334155", color: "white", borderRadius: 8, padding: 10 }} />
                </div>
                <div className="form-group">
                  <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>Password *</label>
                  <input type="password" placeholder="Minimum 6 characters" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} required style={{ background: "#0f172a", border: "1px solid #334155", color: "white", borderRadius: 8, padding: 10 }} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>Role *</label>
                    <select value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })} required style={{ background: "#0f172a", border: "1px solid #334155", color: "white", borderRadius: 8, padding: 10 }}>
                      {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>Department</label>
                    <select value={addForm.dept} onChange={e => setAddForm({ ...addForm, dept: e.target.value })} style={{ background: "#0f172a", border: "1px solid #334155", color: "white", borderRadius: 8, padding: 10 }}>
                      <option value="">Select Department</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                {addForm.role === "student" && (
                  <div className="form-row">
                    <div className="form-group">
                      <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>Register Number</label>
                      <input type="text" placeholder="e.g. 952523104001" value={addForm.registerNo} onChange={e => setAddForm({ ...addForm, registerNo: e.target.value })} style={{ background: "#0f172a", border: "1px solid #334155", color: "white", borderRadius: 8, padding: 10 }} />
                    </div>
                    <div className="form-group">
                      <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>Academic Year</label>
                      <select value={addForm.year} onChange={e => setAddForm({ ...addForm, year: e.target.value })} style={{ background: "#0f172a", border: "1px solid #334155", color: "white", borderRadius: 8, padding: 10 }}>
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>Phone Number</label>
                  <input type="text" placeholder="Contact number" value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} style={{ background: "#0f172a", border: "1px solid #334155", color: "white", borderRadius: 8, padding: 10 }} />
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                  <button type="button" onClick={() => setShowAddModal(false)} style={{
                    flex: 1, padding: "10px 16px", borderRadius: 8, border: "1px solid #475569",
                    background: "transparent", color: "white", fontWeight: 600, cursor: "pointer"
                  }}>Cancel</button>
                  <button type="submit" disabled={addLoading} style={{
                    flex: 1, padding: "10px 16px", borderRadius: 8, border: "none",
                    background: "#2563eb", color: "white",
                    fontWeight: 600, cursor: "pointer", opacity: addLoading ? 0.6 : 1
                  }}>{addLoading ? "Creating..." : "Create Account"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* EDIT USER MODAL */}
        {showEditModal && selectedUser && (
          <div style={modalOverlay} onClick={() => setShowEditModal(false)}>
            <div style={{ ...modalBox, maxWidth: 540 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #334155" }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 18, color: "white", margin: 0 }}>Edit User Details</h3>
                  <p style={{ color: "#94a3b8", fontSize: 13, margin: "2px 0 0 0" }}>{selectedUser.name} ({selectedUser.email})</p>
                </div>
                <button onClick={() => setShowEditModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}><X size={20} /></button>
              </div>

              <form onSubmit={handleEditUser}>
                <div className="form-group">
                  <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>Full Name</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ background: "#0f172a", border: "1px solid #334155", color: "white", borderRadius: 8, padding: 10 }} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>Email Address</label>
                    <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} style={{ background: "#0f172a", border: "1px solid #334155", color: "white", borderRadius: 8, padding: 10 }} />
                  </div>
                  <div className="form-group">
                    <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>Phone</label>
                    <input type="text" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} style={{ background: "#0f172a", border: "1px solid #334155", color: "white", borderRadius: 8, padding: 10 }} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>Role</label>
                    <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} style={{ background: "#0f172a", border: "1px solid #334155", color: "white", borderRadius: 8, padding: 10 }}>
                      {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>Department</label>
                    <select value={editForm.dept} onChange={e => setEditForm({ ...editForm, dept: e.target.value })} style={{ background: "#0f172a", border: "1px solid #334155", color: "white", borderRadius: 8, padding: 10 }}>
                      <option value="">None</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                {editForm.role === "student" && (
                  <div className="form-row">
                    <div className="form-group">
                      <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>Register No</label>
                      <input type="text" value={editForm.registerNo} onChange={e => setEditForm({ ...editForm, registerNo: e.target.value })} style={{ background: "#0f172a", border: "1px solid #334155", color: "white", borderRadius: 8, padding: 10 }} />
                    </div>
                    <div className="form-group">
                      <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>Year</label>
                      <select value={editForm.year} onChange={e => setEditForm({ ...editForm, year: e.target.value })} style={{ background: "#0f172a", border: "1px solid #334155", color: "white", borderRadius: 8, padding: 10 }}>
                        <option value="">Select Year</option>
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Instant Password Change */}
                <div style={{
                  background: "#0f172a", border: "1px solid #334155",
                  borderRadius: 12, padding: 16, marginBottom: 20
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#38bdf8", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <Key size={14} /> Update Account Password
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 11, color: "#94a3b8" }}>New Password</label>
                      <input type="password" placeholder="Min 6 chars" value={editForm.newPassword} onChange={e => setEditForm({ ...editForm, newPassword: e.target.value })} style={{ background: "#1e293b", border: "1px solid #334155", color: "white", borderRadius: 6, padding: 8 }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 11, color: "#94a3b8" }}>Confirm Password</label>
                      <input type="password" placeholder="Re-enter password" value={editForm.confirmNewPassword} onChange={e => setEditForm({ ...editForm, confirmNewPassword: e.target.value })} style={{ background: "#1e293b", border: "1px solid #334155", color: "white", borderRadius: 6, padding: 8 }} />
                    </div>
                  </div>
                  <button type="button" onClick={handleDirectPasswordChange} disabled={directPwLoading || !editForm.newPassword} style={{
                    marginTop: 12, padding: "8px 14px", borderRadius: 6, border: "none",
                    background: editForm.newPassword ? "#059669" : "#334155",
                    color: "white", fontWeight: 600, cursor: editForm.newPassword ? "pointer" : "default",
                    fontSize: 12, width: "100%"
                  }}>{directPwLoading ? "Updating..." : "Update Password Now"}</button>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button type="button" onClick={() => setShowEditModal(false)} style={{
                    flex: 1, padding: "10px 16px", borderRadius: 8, border: "1px solid #475569",
                    background: "transparent", color: "white", fontWeight: 600, cursor: "pointer"
                  }}>Cancel</button>
                  <button type="submit" disabled={editLoading} style={{
                    flex: 1, padding: "10px 16px", borderRadius: 8, border: "none",
                    background: "#2563eb", color: "white",
                    fontWeight: 600, cursor: "pointer", opacity: editLoading ? 0.6 : 1
                  }}>{editLoading ? "Saving..." : "Save Changes"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DELETE MODAL */}
        {showDeleteModal && selectedUser && (
          <div style={modalOverlay} onClick={() => setShowDeleteModal(false)}>
            <div style={{ ...modalBox, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontWeight: 700, fontSize: 18, color: "white", margin: 0 }}>Delete User Account</h3>
                <button onClick={() => setShowDeleteModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}><X size={18} /></button>
              </div>

              <div style={{ background: "rgba(220, 38, 38, 0.1)", border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13, color: "#fca5a5" }}>
                Are you sure you want to delete <strong>{selectedUser.name}</strong> ({selectedUser.email})? This action cannot be undone.
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setShowDeleteModal(false)} style={{
                  flex: 1, padding: "10px 16px", borderRadius: 8, border: "1px solid #475569",
                  background: "transparent", color: "white", fontWeight: 600, cursor: "pointer"
                }}>Cancel</button>
                <button onClick={handleDeleteUser} disabled={deleteLoading} style={{
                  flex: 1, padding: "10px 16px", borderRadius: 8, border: "none",
                  background: "#dc2626", color: "white",
                  fontWeight: 600, cursor: "pointer", opacity: deleteLoading ? 0.6 : 1
                }}>{deleteLoading ? "Deleting..." : "Delete Account"}</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
