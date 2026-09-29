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
  Building, Landmark, ShieldAlert, Search, UserPlus, Key, Trash2, Edit2, ChevronRight, User
} from "lucide-react";

const ROLES = ["student", "staff", "hod", "warden", "officestaff", "security", "management", "principal", "admin"];
const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "IT", "AIDS"];
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const DEPT_NAMES = {
  CSE: "Computer Science & Engineering",
  ECE: "Electronics & Communication Engg",
  EEE: "Electrical & Electronics Engg",
  MECH: "Mechanical Engineering",
  IT: "Information Technology",
  AIDS: "Artificial Intelligence & Data Science"
};

const ROLE_COLORS = {
  student: "#38bdf8",
  staff: "#10b981",
  hod: "#a855f7",
  warden: "#06b6d4",
  officestaff: "#ec4899",
  security: "#f59e0b",
  management: "#14b8a6",
  principal: "#6366f1",
  admin: "#f43f5e"
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
          showToast("❌ Register Number already exists!", "error");
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

      showToast(`✅ Created user "${addForm.name}" as ${addForm.role.toUpperCase()}!`);
      setShowAddModal(false);
      fetchUsers();
    } catch (err) {
      const msg = err.code === "auth/email-already-in-use"
        ? "Email already exists."
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
          showToast("❌ Register Number already exists!", "error");
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
      showToast(`✅ Updated user "${editForm.name || selectedUser.name}"!`);
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
    if (!editForm.newPassword) return showToast("Enter new password.", "error");
    if (editForm.newPassword.length < 6) return showToast("Password must be at least 6 chars.", "error");
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

  // Delete User
  async function handleDeleteUser() {
    if (!selectedUser) return;
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, "users", selectedUser.id));
      showToast(`🗑️ User "${selectedUser.name}" deleted.`);
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

  // Premium Modal Styles
  const modalOverlay = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(10, 15, 30, 0.85)", display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 2000, backdropFilter: "blur(10px)", padding: 20
  };
  const modalBox = {
    background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", borderRadius: 24, padding: 32, maxWidth: 540, width: "100%",
    border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 25px 80px rgba(0,0,0,0.7)",
    maxHeight: "90vh", overflowY: "auto", color: "#f8fafc"
  };

  return (
    <div className="dashboard-wrapper" style={{ background: "#0b0f19", color: "#f8fafc", minHeight: "100vh" }}>
      <Sidebar />
      <main className="main-content" style={{ padding: "24px 32px" }}>
        
        {/* Toast Notification */}
        {toast && (
          <div style={{
            position: "fixed", top: 24, right: 24, zIndex: 3000,
            padding: "14px 24px", borderRadius: 14,
            background: toast.type === "error" ? "linear-gradient(135deg, #ef4444, #dc2626)" : "linear-gradient(135deg, #10b981, #059669)",
            color: "white", fontWeight: 700, fontSize: 14,
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            animation: "slideIn 0.3s ease",
            maxWidth: 400
          }}>
            {toast.message}
          </div>
        )}

        <DateTimeHeader />
        
        {/* Dashboard Title Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.5px", margin: 0 }}>
              Super Admin Panel
            </h1>
            <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 4, fontWeight: 500 }}>
              Department & Role Hierarchy Management System
            </p>
          </div>
          <button 
            onClick={() => openAddModalFor("staff", selectedDept)} 
            style={{
              display: "inline-flex", alignItems: "center", gap: 10, padding: "13px 24px",
              borderRadius: 14, border: "none",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer",
              boxShadow: "0 8px 24px rgba(16, 185, 129, 0.35)", transition: "all 0.2s"
            }}
          >
            <UserPlus size={18} /> Add New User
          </button>
        </div>

        {/* Global Summary Metric Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
          {[
            { icon: <Users size={24} color="#38bdf8" />, value: stats.total, label: "Total Accounts", bg: "rgba(56, 189, 248, 0.1)", border: "rgba(56, 189, 248, 0.2)", color: "#38bdf8" },
            { icon: <Award size={24} color="#a855f7" />, value: stats.hods, label: "Department HODs", bg: "rgba(168, 85, 247, 0.1)", border: "rgba(168, 85, 247, 0.2)", color: "#a855f7" },
            { icon: <UserCheck size={24} color="#10b981" />, value: stats.staff, label: "Faculty Staff", bg: "rgba(16, 185, 129, 0.1)", border: "rgba(16, 185, 129, 0.2)", color: "#10b981" },
            { icon: <GraduationCap size={24} color="#f43f5e" />, value: stats.students, label: "Enrolled Students", bg: "rgba(244, 63, 94, 0.1)", border: "rgba(244, 63, 94, 0.2)", color: "#f43f5e" },
            { icon: <ShieldAlert size={24} color="#fbbf24" />, value: stats.admins, label: "Super Admins", bg: "rgba(251, 191, 36, 0.1)", border: "rgba(251, 191, 36, 0.2)", color: "#fbbf24" }
          ].map((s, i) => (
            <div key={i} style={{
              background: "linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)",
              border: `1px solid ${s.border}`, borderRadius: 20, padding: "20px 22px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {s.icon}
                </div>
              </div>
              <div style={{ color: s.color, fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 8 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* DEPARTMENT SELECTION CARDS HEADER */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "1px" }}>
              SELECT DEPARTMENT TO MANAGE:
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              Active Department: <strong style={{ color: "#f8fafc" }}>{selectedDept}</strong> ({DEPT_NAMES[selectedDept]})
            </div>
          </div>

          {/* Department Tabs Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 14 }}>
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
                    padding: "18px 16px", borderRadius: 20, cursor: "pointer",
                    background: isSelected 
                      ? "linear-gradient(135deg, rgba(59, 130, 246, 0.35) 0%, rgba(139, 92, 246, 0.35) 100%)"
                      : "rgba(30, 41, 59, 0.5)",
                    border: isSelected ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: isSelected ? "0 10px 28px rgba(59, 130, 246, 0.3)" : "none",
                    transition: "all 0.2s ease"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: 900, fontSize: 22, color: isSelected ? "#ffffff" : "#cbd5e1" }}>{d}</span>
                    {isSelected && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 10px #38bdf8" }} />}
                  </div>
                  <div style={{ fontSize: 11, color: isSelected ? "#93c5fd" : "#64748b", fontWeight: 600, marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {DEPT_NAMES[d]}
                  </div>
                  <div style={{ fontSize: 11, display: "flex", gap: 8, color: "#94a3b8", fontWeight: 700 }}>
                    <span style={{ background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 8 }}>👨‍🏫 {staffCount}</span>
                    <span style={{ background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 8 }}>🎓 {studCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SELECTED DEPARTMENT HIERARCHY CONTENT CONTAINER */}
        <div style={{
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)",
          border: "1px solid rgba(255,255,255,0.12)", borderRadius: 24, padding: 28,
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)", marginBottom: 32
        }}>
          {/* Department Header Banner */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 24, color: "white", boxShadow: "0 8px 20px rgba(59, 130, 246, 0.3)"
              }}>
                {selectedDept}
              </div>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 900, color: "#ffffff", margin: 0 }}>
                  Department of {DEPT_NAMES[selectedDept]} ({selectedDept})
                </h2>
                <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 13, color: "#94a3b8" }}>
                  <span>👨‍🏫 <strong>{currentDeptStaff.length}</strong> Faculty Members</span>
                  <span>•</span>
                  <span>🎓 <strong>{currentDeptStudents.length}</strong> Students</span>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons for Selected Dept */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => openAddModalFor("hod", selectedDept)} style={{
                padding: "10px 18px", borderRadius: 12, border: "1px solid rgba(168, 85, 247, 0.4)",
                background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", fontSize: 13, fontWeight: 800, cursor: "pointer"
              }}>
                + Add HOD
              </button>
              <button onClick={() => openAddModalFor("staff", selectedDept)} style={{
                padding: "10px 18px", borderRadius: 12, border: "1px solid rgba(16, 185, 129, 0.4)",
                background: "rgba(16, 185, 129, 0.15)", color: "#34d399", fontSize: 13, fontWeight: 800, cursor: "pointer"
              }}>
                + Add Staff
              </button>
              <button onClick={() => openAddModalFor("student", selectedDept)} style={{
                padding: "10px 18px", borderRadius: 12, border: "1px solid rgba(56, 189, 248, 0.4)",
                background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", fontSize: 13, fontWeight: 800, cursor: "pointer"
              }}>
                + Add Student
              </button>
            </div>
          </div>

          {/* 1. HOD & FACULTY STAFF SECTION */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#a855f7", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 16 }}>
              👑 Head of Department (HOD) & Faculty Members
            </div>

            {/* HOD Card Display */}
            {currentDeptHods.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16, marginBottom: 20 }}>
                {currentDeptHods.map(hod => (
                  <div key={hod.id} style={{
                    background: "linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)",
                    border: "1px solid rgba(168, 85, 247, 0.35)", borderRadius: 20, padding: 20,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    boxShadow: "0 10px 25px rgba(168, 85, 247, 0.15)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 14, background: "rgba(168, 85, 247, 0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center", color: "#e9d5ff"
                      }}>
                        <Award size={24} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: "#ffffff" }}>{hod.name || "HOD"}</div>
                        <div style={{ fontSize: 12, color: "#c084fc", fontWeight: 700 }}>Head of Department ({selectedDept})</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>📧 {hod.email}</div>
                        {hod.phone && <div style={{ fontSize: 11, color: "#64748b" }}>📞 {hod.phone}</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => openEditModal(hod)} style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.1)", border: "none", color: "white", cursor: "pointer" }}><Edit2 size={15} /></button>
                      <button onClick={() => openDeleteModal(hod)} style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(239,68,68,0.2)", border: "none", color: "#fca5a5", cursor: "pointer" }}><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.15)",
                borderRadius: 16, padding: 20, textAlign: "center", marginBottom: 20, color: "#94a3b8", fontSize: 14
              }}>
                No HOD is currently assigned to {selectedDept}. <span style={{ color: "#a855f7", cursor: "pointer", fontWeight: 800 }} onClick={() => openAddModalFor("hod", selectedDept)}>+ Assign HOD Now</span>
              </div>
            )}

            {/* Faculty Staff List Grid */}
            <div style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1", marginBottom: 12 }}>
              Faculty Members ({currentDeptStaff.length}):
            </div>
            {currentDeptStaff.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 13, padding: "12px 0" }}>No staff members added for {selectedDept} yet.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {currentDeptStaff.map(st => (
                  <div key={st.id} style={{
                    background: "rgba(30, 41, 59, 0.6)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#f8fafc" }}>{st.name}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>{st.email}</div>
                      {st.phone && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>📞 {st.phone}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEditModal(st)} style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "none", color: "#e2e8f0", cursor: "pointer" }}><Edit2 size={14} /></button>
                      <button onClick={() => openDeleteModal(st)} style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(239,68,68,0.15)", border: "none", color: "#fca5a5", cursor: "pointer" }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. STUDENTS BREAKDOWN BY ACADEMIC YEAR */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 16 }}>
              🎓 Students Breakdown by Academic Year ({selectedDept})
            </div>

            {/* 4 Year Selector Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
              {YEARS.map(yr => {
                const count = getYearCount(yr);
                const isYearActive = selectedYear === yr;

                return (
                  <div
                    key={yr}
                    onClick={() => setSelectedYear(isYearActive ? "all" : yr)}
                    style={{
                      background: isYearActive 
                        ? "linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(37, 99, 235, 0.25) 100%)" 
                        : "rgba(30, 41, 59, 0.5)",
                      border: isYearActive ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 18, padding: 18, cursor: "pointer",
                      boxShadow: isYearActive ? "0 8px 20px rgba(56, 189, 248, 0.2)" : "none",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: isYearActive ? "#ffffff" : "#cbd5e1" }}>{yr}</span>
                      <span style={{
                        padding: "4px 12px", borderRadius: 12, fontSize: 13, fontWeight: 900,
                        background: isYearActive ? "#38bdf8" : "rgba(56, 189, 248, 0.15)",
                        color: isYearActive ? "#0f172a" : "#38bdf8"
                      }}>{count} Students</span>
                    </div>
                    <div style={{ fontSize: 11, color: isYearActive ? "#93c5fd" : "#64748b", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                      {isYearActive ? "Viewing filtered list below" : "Click to view student list"} <ChevronRight size={13} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* SEARCH & YEAR FILTER PILLS FOR STUDENTS */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 16, flexWrap: "wrap", gap: 14,
              background: "rgba(15, 23, 42, 0.5)", padding: 16, borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.06)"
            }}>
              {/* Year Filter Pills */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700 }}>Filter Year:</span>
                <button
                  onClick={() => setSelectedYear("all")}
                  style={{
                    padding: "7px 16px", borderRadius: 20, border: "none",
                    background: selectedYear === "all" ? "#38bdf8" : "rgba(255,255,255,0.07)",
                    color: selectedYear === "all" ? "#0f172a" : "white", fontSize: 12, fontWeight: 800, cursor: "pointer"
                  }}
                >
                  All Years ({currentDeptStudents.length})
                </button>
                {YEARS.map(yr => (
                  <button
                    key={yr}
                    onClick={() => setSelectedYear(yr)}
                    style={{
                      padding: "7px 16px", borderRadius: 20, border: "none",
                      background: selectedYear === yr ? "#38bdf8" : "rgba(255,255,255,0.07)",
                      color: selectedYear === yr ? "#0f172a" : "white", fontSize: 12, fontWeight: 800, cursor: "pointer"
                    }}
                  >
                    {yr} ({getYearCount(yr)})
                  </button>
                ))}
              </div>

              {/* Department Student Search */}
              <div style={{ position: "relative", minWidth: 260 }}>
                <Search size={15} color="#94a3b8" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search students in department..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: "100%", padding: "9px 14px 9px 38px",
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12, color: "white", fontSize: 13, outline: "none"
                  }}
                />
              </div>
            </div>

            {/* STUDENTS TABLE */}
            <div style={{ background: "rgba(15, 23, 42, 0.7)", borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.3)" }}>
                      {["Student Name", "Register No", "Email", "Year", "Dept", "Phone", "Actions"].map(h => (
                        <th key={h} style={{
                          padding: "16px 20px", textAlign: "left", fontSize: 11,
                          color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 800
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedStudents.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: 48, color: "#64748b" }}>
                          No student records found for {selectedDept} {selectedYear !== "all" ? `(${selectedYear})` : ""}.
                        </td>
                      </tr>
                    ) : displayedStudents.map(stud => (
                      <tr key={stud.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "14px 20px", fontWeight: 700, color: "#ffffff", fontSize: 14 }}>
                          👨‍🎓 {stud.name || stud.studentName || "—"}
                        </td>
                        <td style={{ padding: "14px 20px", fontSize: 13, color: "#38bdf8", fontWeight: 800 }}>
                          {stud.registerNo || stud.registerNumber || "—"}
                        </td>
                        <td style={{ padding: "14px 20px", fontSize: 13, color: "#cbd5e1" }}>{stud.email}</td>
                        <td style={{ padding: "14px 20px" }}>
                          <span style={{ padding: "4px 12px", borderRadius: 10, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", fontSize: 12, fontWeight: 800 }}>
                            {stud.year || "—"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 20px", fontSize: 13, color: "#cbd5e1" }}>{stud.dept || selectedDept}</td>
                        <td style={{ padding: "14px 20px", fontSize: 13, color: "#94a3b8" }}>{stud.phone || "—"}</td>
                        <td style={{ padding: "14px 20px" }}>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => openEditModal(stud)} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Edit</button>
                            <button onClick={() => openDeleteModal(stud)} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(239, 68, 68, 0.15)", border: "none", color: "#fca5a5", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Delete</button>
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
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>➕</div>
                <div>
                  <h3 style={{ fontWeight: 900, fontSize: 20, color: "white", margin: 0 }}>Add New User Account</h3>
                  <p style={{ color: "#94a3b8", fontSize: 13, margin: "2px 0 0 0" }}>Create user credentials with defined role & department</p>
                </div>
              </div>

              <form onSubmit={handleAddUser}>
                <div className="form-group">
                  <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>Full Name *</label>
                  <input type="text" placeholder="Enter full name" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} required style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }} />
                </div>
                <div className="form-group">
                  <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>Email Address *</label>
                  <input type="email" placeholder="user@college.edu" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} required style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }} />
                </div>
                <div className="form-group">
                  <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>Password *</label>
                  <input type="password" placeholder="Minimum 6 characters" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} required style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>Role *</label>
                    <select value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })} required style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}>
                      {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>Department</label>
                    <select value={addForm.dept} onChange={e => setAddForm({ ...addForm, dept: e.target.value })} style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}>
                      <option value="">Select Department</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                {addForm.role === "student" && (
                  <div className="form-row">
                    <div className="form-group">
                      <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>Register Number</label>
                      <input type="text" placeholder="e.g. 952523104001" value={addForm.registerNo} onChange={e => setAddForm({ ...addForm, registerNo: e.target.value })} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }} />
                    </div>
                    <div className="form-group">
                      <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>Academic Year</label>
                      <select value={addForm.year} onChange={e => setAddForm({ ...addForm, year: e.target.value })} style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}>
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>Phone Number</label>
                  <input type="text" placeholder="Contact number" value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }} />
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                  <button type="button" onClick={() => setShowAddModal(false)} style={{
                    flex: 1, padding: "12px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.05)", color: "white", fontWeight: 800, cursor: "pointer"
                  }}>Cancel</button>
                  <button type="submit" disabled={addLoading} style={{
                    flex: 1, padding: "12px 18px", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg, #10b981, #059669)", color: "white",
                    fontWeight: 800, cursor: "pointer", opacity: addLoading ? 0.6 : 1
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
                <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(56, 189, 248, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>✏️</div>
                <div>
                  <h3 style={{ fontWeight: 900, fontSize: 20, color: "white", margin: 0 }}>Edit User Details</h3>
                  <p style={{ color: "#94a3b8", fontSize: 13, margin: "2px 0 0 0" }}>{selectedUser.name} ({selectedUser.email})</p>
                </div>
              </div>

              <form onSubmit={handleEditUser}>
                <div className="form-group">
                  <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>Full Name</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>Email Address</label>
                    <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }} />
                  </div>
                  <div className="form-group">
                    <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>Phone</label>
                    <input type="text" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>Role</label>
                    <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}>
                      {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>Department</label>
                    <select value={editForm.dept} onChange={e => setEditForm({ ...editForm, dept: e.target.value })} style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}>
                      <option value="">None</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                {editForm.role === "student" && (
                  <div className="form-row">
                    <div className="form-group">
                      <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>Register No</label>
                      <input type="text" value={editForm.registerNo} onChange={e => setEditForm({ ...editForm, registerNo: e.target.value })} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }} />
                    </div>
                    <div className="form-group">
                      <label style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>Year</label>
                      <select value={editForm.year} onChange={e => setEditForm({ ...editForm, year: e.target.value })} style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}>
                        <option value="">Select Year</option>
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Instant Password Change */}
                <div style={{
                  background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)",
                  borderRadius: 16, padding: 18, marginBottom: 20
                }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "#34d399", marginBottom: 10 }}>🔑 Set New Password Directly</div>
                  <div className="form-row">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 11, color: "#cbd5e1" }}>New Password</label>
                      <input type="password" placeholder="Min 6 chars" value={editForm.newPassword} onChange={e => setEditForm({ ...editForm, newPassword: e.target.value })} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 11, color: "#cbd5e1" }}>Confirm Password</label>
                      <input type="password" placeholder="Re-enter password" value={editForm.confirmNewPassword} onChange={e => setEditForm({ ...editForm, confirmNewPassword: e.target.value })} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }} />
                    </div>
                  </div>
                  <button type="button" onClick={handleDirectPasswordChange} disabled={directPwLoading || !editForm.newPassword} style={{
                    marginTop: 12, padding: "10px 16px", borderRadius: 12, border: "none",
                    background: editForm.newPassword ? "linear-gradient(135deg, #10b981, #059669)" : "rgba(255,255,255,0.1)",
                    color: "white", fontWeight: 800, cursor: editForm.newPassword ? "pointer" : "default",
                    fontSize: 13, width: "100%"
                  }}>{directPwLoading ? "Updating..." : "🔑 Update Password Now"}</button>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button type="button" onClick={() => setShowEditModal(false)} style={{
                    flex: 1, padding: "12px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.05)", color: "white", fontWeight: 800, cursor: "pointer"
                  }}>Cancel</button>
                  <button type="submit" disabled={editLoading} style={{
                    flex: 1, padding: "12px 18px", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "white",
                    fontWeight: 800, cursor: "pointer", opacity: editLoading ? 0.6 : 1
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
                  <h3 style={{ fontWeight: 900, fontSize: 20, color: "white", margin: 0 }}>Delete User Account?</h3>
                  <p style={{ color: "#94a3b8", fontSize: 13, margin: "2px 0 0 0" }}>This action is permanent</p>
                </div>
              </div>

              <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 14, padding: 16, marginBottom: 24, fontSize: 13, color: "#fca5a5" }}>
                Deleting <strong>{selectedUser.name}</strong> ({selectedUser.email}) will remove their access and record from the database.
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setShowDeleteModal(false)} style={{
                  flex: 1, padding: "12px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.05)", color: "white", fontWeight: 800, cursor: "pointer"
                }}>Cancel</button>
                <button onClick={handleDeleteUser} disabled={deleteLoading} style={{
                  flex: 1, padding: "12px 18px", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "white",
                  fontWeight: 800, cursor: "pointer", opacity: deleteLoading ? 0.6 : 1
                }}>{deleteLoading ? "Deleting..." : "🗑️ Delete User"}</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
