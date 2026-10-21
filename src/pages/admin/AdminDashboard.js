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
  Building, Landmark, ShieldAlert, Search, UserPlus, Key, Trash2, Edit2, ChevronRight, Plus, Check, X, Shield,
  Settings, Layers, PlusCircle, BookOpen, AlertCircle
} from "lucide-react";
import { 
  getStoredCollegeStructure, 
  saveStoredCollegeStructure, 
  syncCollegeStructureFromDb, 
  DEFAULT_COLLEGE_DEPARTMENTS, 
  DEFAULT_DEPT_DETAILS 
} from "../../utils/collegeConfig";

const ROLES = ["student", "staff", "hod", "warden", "officestaff", "security", "management", "principal", "admin"];
const DEPARTMENTS = DEFAULT_COLLEGE_DEPARTMENTS;
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const DEPT_NAMES = {
  CSE: "Computer Science & Engineering",
  AIDS: "Artificial Intelligence & Data Science",
  ECE: "Electronics & Communication Engineering",
  EEE: "Electrical & Electronics Engineering",
  IT: "Information Technology",
  MECH: "Mechanical Engineering",
  CSBS: "Computer Science & Business Systems"
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
  admin: "#ef4444"
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

  // College Structure & Sections Management (Super Admin Exclusive)
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [structureTab, setStructureTab] = useState("sections"); // "sections" | "depts"
  const [collegeStructure, setCollegeStructure] = useState(() => getStoredCollegeStructure());
  const [selectedStructureDept, setSelectedStructureDept] = useState("CSE");
  const [newDeptForm, setNewDeptForm] = useState({ code: "", name: "", auCode: "" });
  const [savingStructure, setSavingStructure] = useState(false);

  useEffect(() => {
    syncCollegeStructureFromDb().then(data => {
      if (data) setCollegeStructure(data);
    });

    const handleUpdate = () => {
      setCollegeStructure(getStoredCollegeStructure());
    };
    window.addEventListener("collegeStructureUpdated", handleUpdate);
    return () => window.removeEventListener("collegeStructureUpdated", handleUpdate);
  }, []);

  const activeDepartments = collegeStructure?.departments || DEPARTMENTS;

  const getDeptFullName = (code) => {
    return collegeStructure?.deptDetails?.[code]?.name || DEPT_NAMES[code] || `${code} Department`;
  };

  // Super Admin: Add new department
  const handleAddNewDepartment = async (e) => {
    e.preventDefault();
    const code = (newDeptForm.code || "").trim().toUpperCase();
    const name = (newDeptForm.name || "").trim();
    const auCode = (newDeptForm.auCode || "").trim();

    if (!code || !name) {
      showToast("Please provide department code and full name.", "error");
      return;
    }

    if (collegeStructure.departments.includes(code)) {
      showToast(`Department ${code} already exists.`, "error");
      return;
    }

    const updated = {
      ...collegeStructure,
      departments: [...collegeStructure.departments, code],
      deptDetails: {
        ...(collegeStructure.deptDetails || {}),
        [code]: { name, code: auCode || "100" }
      },
      sections: {
        ...(collegeStructure.sections || {}),
        [code]: {
          "1": ["Single"],
          "2": ["Single"],
          "3": ["Single"],
          "4": ["Single"]
        }
      }
    };

    setSavingStructure(true);
    const success = await saveStoredCollegeStructure(updated);
    setSavingStructure(false);
    if (success) {
      setCollegeStructure(updated);
      setNewDeptForm({ code: "", name: "", auCode: "" });
      showToast(`Department ${code} (${name}) added successfully!`);
    } else {
      showToast("Failed to save department.", "error");
    }
  };

  // Super Admin: Delete department
  const handleDeleteDepartment = async (deptCode) => {
    if (collegeStructure.departments.length <= 1) {
      showToast("At least 1 department must remain in college.", "error");
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to remove department ${deptCode}?`);
    if (!confirmed) return;

    const updatedDepts = collegeStructure.departments.filter(d => d !== deptCode);
    const updatedDetails = { ...(collegeStructure.deptDetails || {}) };
    delete updatedDetails[deptCode];
    const updatedSections = { ...(collegeStructure.sections || {}) };
    delete updatedSections[deptCode];

    const updated = {
      ...collegeStructure,
      departments: updatedDepts,
      deptDetails: updatedDetails,
      sections: updatedSections
    };

    setSavingStructure(true);
    const success = await saveStoredCollegeStructure(updated);
    setSavingStructure(false);
    if (success) {
      setCollegeStructure(updated);
      if (selectedDept === deptCode) setSelectedDept(updatedDepts[0]);
      if (selectedStructureDept === deptCode) setSelectedStructureDept(updatedDepts[0]);
      showToast(`Department ${deptCode} removed.`);
    } else {
      showToast("Failed to remove department.", "error");
    }
  };

  // Super Admin: Add section to year (e.g. A, B, C, D)
  const handleAddSectionToYear = (yrNum) => {
    const current = collegeStructure.sections?.[selectedStructureDept]?.[yrNum] || ["Single"];
    let nextSecs = [];
    if (current.length === 1 && current[0] === "Single") {
      nextSecs = ["A", "B"];
    } else {
      const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
      const nextLetter = letters[current.length] || `Sec${current.length + 1}`;
      nextSecs = [...current, nextLetter];
    }

    setCollegeStructure(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [selectedStructureDept]: {
          ...(prev.sections?.[selectedStructureDept] || {}),
          [yrNum]: nextSecs
        }
      }
    }));
  };

  // Super Admin: Remove section from year
  const handleRemoveSectionFromYear = (yrNum, secToRemove) => {
    const current = collegeStructure.sections?.[selectedStructureDept]?.[yrNum] || ["Single"];
    const filtered = current.filter(s => s !== secToRemove);
    const nextSecs = filtered.length === 0 ? ["Single"] : filtered;

    setCollegeStructure(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [selectedStructureDept]: {
          ...(prev.sections?.[selectedStructureDept] || {}),
          [yrNum]: nextSecs
        }
      }
    }));
  };

  // Super Admin: Set Single Class
  const handleSetSingleClass = (yrNum) => {
    setCollegeStructure(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [selectedStructureDept]: {
          ...(prev.sections?.[selectedStructureDept] || {}),
          [yrNum]: ["Single"]
        }
      }
    }));
  };

  // Super Admin: Save Structure Changes
  const handleSaveAllStructure = async () => {
    setSavingStructure(true);
    const success = await saveStoredCollegeStructure(collegeStructure);
    setSavingStructure(false);
    if (success) {
      showToast("College departments & year-wise sections updated across ERP!");
      setShowStructureModal(false);
    } else {
      showToast("Failed to save changes.", "error");
    }
  };

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

  // Clean Slate Modal Overlay & Box
  const modalOverlay = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(15, 23, 42, 0.6)", display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 2000, padding: 20
  };
  const modalBox = {
    background: "#ffffff", borderRadius: 12, padding: 28, maxWidth: 540, width: "100%",
    border: "1px solid #e2e8f0", boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
    maxHeight: "90vh", overflowY: "auto", color: "#0f172a"
  };

  return (
    <div className="dashboard-wrapper" style={{ background: "#f8fafc", minHeight: "100vh", color: "#0f172a" }}>
      <Sidebar />
      <main className="main-content" style={{ padding: "28px 36px", background: "#f8fafc" }}>
        
        {/* Toast Notification */}
        {toast && (
          <div style={{
            position: "fixed", top: 24, right: 24, zIndex: 3000,
            padding: "12px 20px", borderRadius: 8,
            background: toast.type === "error" ? "#dc2626" : "#059669",
            color: "white", fontWeight: 600, fontSize: 14,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            animation: "slideIn 0.2s ease",
            maxWidth: 400
          }}>
            {toast.message}
          </div>
        )}

        {/* Page Top Header Bar (Enterprise Style) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.3px" }}>
              Super Admin Management Console
            </h1>
            <p style={{ color: "#64748b", fontSize: 13, margin: "3px 0 0 0" }}>
              Enterprise Department & User Role Hierarchy Directory
            </p>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <DateTimeHeader />
            <button 
              onClick={() => {
                setCollegeStructure(getStoredCollegeStructure());
                setShowStructureModal(true);
              }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px",
                borderRadius: 8, border: "1px solid #bfdbfe",
                background: "#eff6ff",
                color: "#1d4ed8", fontWeight: 700, fontSize: 13, cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
              }}
              title="Super Admin: Add Departments and Configure Year-wise Sections"
            >
              <Settings size={16} /> Manage Depts & Sections
            </button>
            <button 
              onClick={() => openAddModalFor("staff", selectedDept)} 
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px",
                borderRadius: 8, border: "none",
                background: "#2563eb",
                color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer",
                boxShadow: "0 1px 2px rgba(37,99,235,0.2)"
              }}
            >
              <UserPlus size={16} /> Add New User
            </button>
          </div>
        </div>

        {/* Global Summary Metric Cards (Clean Enterprise Design) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
          {[
            { icon: <Users size={18} color="#0284c7" />, value: stats.total, label: "Total Accounts", desc: "System wide" },
            { icon: <Award size={18} color="#7c3aed" />, value: stats.hods, label: "Department HODs", desc: `${activeDepartments.length} Departments` },
            { icon: <UserCheck size={18} color="#059669" />, value: stats.staff, label: "Faculty Members", desc: "Active staff" },
            { icon: <GraduationCap size={18} color="#2563eb" />, value: stats.students, label: "Enrolled Students", desc: "All batches" },
            { icon: <ShieldAlert size={18} color="#dc2626" />, value: stats.admins, label: "Super Admins", desc: "Full access" }
          ].map((s, i) => (
            <div key={i} style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 10, padding: "16px 18px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</span>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #f1f5f9" }}>
                  {s.icon}
                </div>
              </div>
              <div style={{ color: "#0f172a", fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        {/* DEPARTMENT SELECTION TAB BAR */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
            Select Department:
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {activeDepartments.map(d => {
              const dUsers = users.filter(u => u.dept === d);
              const isSelected = selectedDept === d;
              const totalCount = dUsers.length;

              return (
                <button
                  key={d}
                  onClick={() => handleSelectDept(d)}
                  style={{
                    padding: "10px 18px", borderRadius: 8, cursor: "pointer",
                    background: isSelected ? "#1e40af" : "#ffffff",
                    color: isSelected ? "#ffffff" : "#334155",
                    border: isSelected ? "1px solid #1e40af" : "1px solid #cbd5e1",
                    fontWeight: 700, fontSize: 13,
                    display: "inline-flex", alignItems: "center", gap: 8,
                    boxShadow: isSelected ? "0 2px 4px rgba(30,58,138,0.2)" : "0 1px 2px rgba(0,0,0,0.02)",
                    transition: "all 0.15s ease"
                  }}
                >
                  <span>{d}</span>
                  <span style={{
                    padding: "2px 7px", borderRadius: 10, fontSize: 11, fontWeight: 800,
                    background: isSelected ? "rgba(255,255,255,0.2)" : "#f1f5f9",
                    color: isSelected ? "#ffffff" : "#64748b"
                  }}>
                    {totalCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SELECTED DEPARTMENT MAIN CONTAINER */}
        <div style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 12, padding: 24, marginBottom: 32,
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
        }}>
          {/* Department Title & Quick Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: "#1e40af",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 16, color: "white"
              }}>
                {selectedDept}
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  Department of {getDeptFullName(selectedDept)} ({selectedDept})
                </h2>
                <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 13, color: "#64748b" }}>
                  <span>Faculty Staff: <strong style={{ color: "#0f172a" }}>{currentDeptStaff.length}</strong></span>
                  <span>•</span>
                  <span>Enrolled Students: <strong style={{ color: "#0f172a" }}>{currentDeptStudents.length}</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => openAddModalFor("hod", selectedDept)} style={{
                padding: "8px 14px", borderRadius: 6, border: "1px solid #c084fc",
                background: "#f3e8ff", color: "#7e22ce", fontSize: 12, fontWeight: 700, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6
              }}>
                <Plus size={14} /> Add HOD
              </button>
              <button onClick={() => openAddModalFor("staff", selectedDept)} style={{
                padding: "8px 14px", borderRadius: 6, border: "1px solid #6ee7b7",
                background: "#ecfdf5", color: "#047857", fontSize: 12, fontWeight: 700, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6
              }}>
                <Plus size={14} /> Add Staff
              </button>
              <button onClick={() => openAddModalFor("student", selectedDept)} style={{
                padding: "8px 14px", borderRadius: 6, border: "none",
                background: "#2563eb", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6
              }}>
                <Plus size={14} /> Add Student
              </button>
            </div>
          </div>

          {/* 1. HOD & FACULTY MEMBERS DIRECTORY */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#1e40af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Award size={15} color="#7c3aed" /> Head of Department (HOD) & Faculty Members
            </div>

            {/* HOD Card */}
            {currentDeptHods.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12, marginBottom: 16 }}>
                {currentDeptHods.map(hod => (
                  <div key={hod.id} style={{
                    background: "#faf5ff",
                    border: "1px solid #e9d5ff", borderLeft: "4px solid #7c3aed",
                    borderRadius: 8, padding: 14,
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, background: "#f3e8ff",
                        display: "flex", alignItems: "center", justifyContent: "center", color: "#7e22ce"
                      }}>
                        <Award size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{hod.name || "HOD"}</div>
                        <div style={{ fontSize: 12, color: "#7e22ce", fontWeight: 700 }}>Head of Department ({selectedDept})</div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 1 }}>{hod.email}</div>
                        {hod.phone && <div style={{ fontSize: 11, color: "#64748b" }}>Phone: {hod.phone}</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEditModal(hod)} style={{ padding: "5px 8px", borderRadius: 6, background: "#ffffff", border: "1px solid #cbd5e1", color: "#334155", cursor: "pointer" }}><Edit2 size={13} /></button>
                      <button onClick={() => openDeleteModal(hod)} style={{ padding: "5px 8px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626", cursor: "pointer" }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                background: "#f8fafc", border: "1px dashed #cbd5e1",
                borderRadius: 8, padding: 12, textAlign: "center", marginBottom: 16, color: "#64748b", fontSize: 13
              }}>
                No HOD currently assigned to {selectedDept}. <span style={{ color: "#7e22ce", cursor: "pointer", fontWeight: 700 }} onClick={() => openAddModalFor("hod", selectedDept)}>Assign HOD</span>
              </div>
            )}

            {/* Faculty Members List Grid */}
            <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
              Faculty Members ({currentDeptStaff.length}):
            </div>
            {currentDeptStaff.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 13, padding: "6px 0" }}>No faculty staff added for {selectedDept}.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                {currentDeptStaff.map(st => (
                  <div key={st.id} style={{
                    background: "#f8fafc", border: "1px solid #e2e8f0",
                    borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{st.name}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{st.email}</div>
                      {st.phone && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Phone: {st.phone}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEditModal(st)} style={{ padding: "5px 8px", borderRadius: 6, background: "#ffffff", border: "1px solid #cbd5e1", color: "#334155", cursor: "pointer" }}><Edit2 size={13} /></button>
                      <button onClick={() => openDeleteModal(st)} style={{ padding: "5px 8px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626", cursor: "pointer" }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. STUDENTS DIRECTORY & ACADEMIC YEAR BREAKDOWN */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#1e40af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <GraduationCap size={15} color="#2563eb" /> Academic Year Breakdown ({selectedDept})
            </div>

            {/* Year Cards Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 16 }}>
              {YEARS.map(yr => {
                const count = getYearCount(yr);
                const isYearActive = selectedYear === yr;

                return (
                  <div
                    key={yr}
                    onClick={() => setSelectedYear(isYearActive ? "all" : yr)}
                    style={{
                      background: isYearActive ? "#eff6ff" : "#f8fafc",
                      border: isYearActive ? "2px solid #2563eb" : "1px solid #e2e8f0",
                      borderRadius: 8, padding: 12, cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: isYearActive ? "#1d4ed8" : "#0f172a" }}>{yr}</span>
                      <span style={{
                        padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800,
                        background: isYearActive ? "#2563eb" : "#e0f2fe",
                        color: isYearActive ? "#ffffff" : "#0284c7"
                      }}>{count} Students</span>
                    </div>
                    <div style={{ fontSize: 11, color: isYearActive ? "#1d4ed8" : "#64748b", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                      {isYearActive ? "Filtered view active" : "Click to view list"} <ChevronRight size={12} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* SEARCH & FILTER BAR */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 12, flexWrap: "wrap", gap: 12,
              background: "#f8fafc", padding: "10px 14px", borderRadius: 8,
              border: "1px solid #e2e8f0"
            }}>
              {/* Year Filter Pills */}
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Filter:</span>
                <button
                  onClick={() => setSelectedYear("all")}
                  style={{
                    padding: "4px 12px", borderRadius: 6, border: "none",
                    background: selectedYear === "all" ? "#2563eb" : "#e2e8f0",
                    color: selectedYear === "all" ? "white" : "#334155", fontSize: 12, fontWeight: 700, cursor: "pointer"
                  }}
                >
                  All ({currentDeptStudents.length})
                </button>
                {YEARS.map(yr => (
                  <button
                    key={yr}
                    onClick={() => setSelectedYear(yr)}
                    style={{
                      padding: "4px 12px", borderRadius: 6, border: "none",
                      background: selectedYear === yr ? "#2563eb" : "#e2e8f0",
                      color: selectedYear === yr ? "white" : "#334155", fontSize: 12, fontWeight: 700, cursor: "pointer"
                    }}
                  >
                    {yr} ({getYearCount(yr)})
                  </button>
                ))}
              </div>

              {/* Search Field */}
              <div style={{ position: "relative", minWidth: 220 }}>
                <Search size={14} color="#64748b" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: "100%", padding: "6px 10px 6px 30px",
                    background: "#ffffff", border: "1px solid #cbd5e1",
                    borderRadius: 6, color: "#0f172a", fontSize: 13, outline: "none"
                  }}
                />
              </div>
            </div>

            {/* ENTERPRISE DATA TABLE */}
            <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                      {["Student Name", "Register No", "Email", "Year", "Dept", "Phone", "Actions"].map(h => (
                        <th key={h} style={{
                          padding: "12px 14px", textAlign: "left", fontSize: 11,
                          color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 800
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedStudents.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "#64748b", fontSize: 13 }}>
                          No student records found for {selectedDept} {selectedYear !== "all" ? `(${selectedYear})` : ""}.
                        </td>
                      </tr>
                    ) : displayedStudents.map(stud => (
                      <tr key={stud.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a", fontSize: 14 }}>
                          {stud.name || stud.studentName || "—"}
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 13, color: "#1e40af", fontWeight: 700, fontFamily: "monospace" }}>
                          {stud.registerNo || stud.registerNumber || "—"}
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 13, color: "#334155" }}>{stud.email}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ padding: "3px 8px", borderRadius: 4, background: "#eff6ff", color: "#1e40af", fontSize: 11, fontWeight: 700, border: "1px solid #dbeafe" }}>
                            {stud.year || "—"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 13, color: "#334155" }}>{stud.dept || selectedDept}</td>
                        <td style={{ padding: "12px 14px", fontSize: 13, color: "#64748b" }}>{stud.phone || "—"}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => openEditModal(stud)} style={{ padding: "4px 10px", borderRadius: 4, background: "#ffffff", border: "1px solid #cbd5e1", color: "#334155", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                            <button onClick={() => openDeleteModal(stud)} style={{ padding: "4px 10px", borderRadius: 4, background: "#ffffff", border: "1px solid #fca5a5", color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Delete</button>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #f1f5f9" }}>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: 18, color: "#0f172a", margin: 0 }}>Add New User Account</h3>
                  <p style={{ color: "#64748b", fontSize: 13, margin: "2px 0 0 0" }}>Create user credentials with role & department</p>
                </div>
                <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><X size={20} /></button>
              </div>

              <form onSubmit={handleAddUser}>
                <div className="form-group">
                  <label style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>Full Name *</label>
                  <input type="text" placeholder="Enter full name" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} required style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 6, padding: 8 }} />
                </div>
                <div className="form-group">
                  <label style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>Email Address *</label>
                  <input type="email" placeholder="user@college.edu" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} required style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 6, padding: 8 }} />
                </div>
                <div className="form-group">
                  <label style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>Password *</label>
                  <input type="password" placeholder="Minimum 6 characters" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} required style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 6, padding: 8 }} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>Role *</label>
                    <select value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })} required style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 6, padding: 8 }}>
                      {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>Department</label>
                    <select value={addForm.dept} onChange={e => setAddForm({ ...addForm, dept: e.target.value })} style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 6, padding: 8 }}>
                      <option value="">Select Department</option>
                      {activeDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                {addForm.role === "student" && (
                  <div className="form-row">
                    <div className="form-group">
                      <label style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>Register Number</label>
                      <input type="text" placeholder="e.g. 952523104001" value={addForm.registerNo} onChange={e => setAddForm({ ...addForm, registerNo: e.target.value })} style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 6, padding: 8 }} />
                    </div>
                    <div className="form-group">
                      <label style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>Academic Year</label>
                      <select value={addForm.year} onChange={e => setAddForm({ ...addForm, year: e.target.value })} style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 6, padding: 8 }}>
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>Phone Number</label>
                  <input type="text" placeholder="Contact number" value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 6, padding: 8 }} />
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                  <button type="button" onClick={() => setShowAddModal(false)} style={{
                    flex: 1, padding: "9px 16px", borderRadius: 6, border: "1px solid #cbd5e1",
                    background: "#ffffff", color: "#334155", fontWeight: 600, cursor: "pointer"
                  }}>Cancel</button>
                  <button type="submit" disabled={addLoading} style={{
                    flex: 1, padding: "9px 16px", borderRadius: 6, border: "none",
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #f1f5f9" }}>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: 18, color: "#0f172a", margin: 0 }}>Edit User Details</h3>
                  <p style={{ color: "#64748b", fontSize: 13, margin: "2px 0 0 0" }}>{selectedUser.name} ({selectedUser.email})</p>
                </div>
                <button onClick={() => setShowEditModal(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><X size={20} /></button>
              </div>

              <form onSubmit={handleEditUser}>
                <div className="form-group">
                  <label style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>Full Name</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 6, padding: 8 }} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>Email Address</label>
                    <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 6, padding: 8 }} />
                  </div>
                  <div className="form-group">
                    <label style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>Phone</label>
                    <input type="text" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 6, padding: 8 }} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>Role</label>
                    <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 6, padding: 8 }}>
                      {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>Department</label>
                    <select value={editForm.dept} onChange={e => setEditForm({ ...editForm, dept: e.target.value })} style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 6, padding: 8 }}>
                      <option value="">None</option>
                      {activeDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                {editForm.role === "student" && (
                  <div className="form-row">
                    <div className="form-group">
                      <label style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>Register No</label>
                      <input type="text" value={editForm.registerNo} onChange={e => setEditForm({ ...editForm, registerNo: e.target.value })} style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 6, padding: 8 }} />
                    </div>
                    <div className="form-group">
                      <label style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>Year</label>
                      <select value={editForm.year} onChange={e => setEditForm({ ...editForm, year: e.target.value })} style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 6, padding: 8 }}>
                        <option value="">Select Year</option>
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Instant Password Change */}
                <div style={{
                  background: "#f8fafc", border: "1px solid #e2e8f0",
                  borderRadius: 8, padding: 14, marginBottom: 16
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#2563eb", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <Key size={14} /> Update Account Password
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 11, color: "#475569" }}>New Password</label>
                      <input type="password" placeholder="Min 6 chars" value={editForm.newPassword} onChange={e => setEditForm({ ...editForm, newPassword: e.target.value })} style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 6, padding: 6 }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 11, color: "#475569" }}>Confirm Password</label>
                      <input type="password" placeholder="Re-enter password" value={editForm.confirmNewPassword} onChange={e => setEditForm({ ...editForm, confirmNewPassword: e.target.value })} style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 6, padding: 6 }} />
                    </div>
                  </div>
                  <button type="button" onClick={handleDirectPasswordChange} disabled={directPwLoading || !editForm.newPassword} style={{
                    marginTop: 10, padding: "8px 12px", borderRadius: 6, border: "none",
                    background: editForm.newPassword ? "#059669" : "#cbd5e1",
                    color: "white", fontWeight: 700, cursor: editForm.newPassword ? "pointer" : "default",
                    fontSize: 12, width: "100%"
                  }}>{directPwLoading ? "Updating..." : "Update Password Now"}</button>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button type="button" onClick={() => setShowEditModal(false)} style={{
                    flex: 1, padding: "9px 16px", borderRadius: 6, border: "1px solid #cbd5e1",
                    background: "#ffffff", color: "#334155", fontWeight: 600, cursor: "pointer"
                  }}>Cancel</button>
                  <button type="submit" disabled={editLoading} style={{
                    flex: 1, padding: "9px 16px", borderRadius: 6, border: "none",
                    background: "#2563eb", color: "white",
                    fontWeight: 700, cursor: "pointer", opacity: editLoading ? 0.6 : 1
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
                <h3 style={{ fontWeight: 800, fontSize: 18, color: "#0f172a", margin: 0 }}>Delete User Account</h3>
                <button onClick={() => setShowDeleteModal(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><X size={18} /></button>
              </div>

              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 14, marginBottom: 20, fontSize: 13, color: "#dc2626" }}>
                Are you sure you want to delete <strong>{selectedUser.name}</strong> ({selectedUser.email})? This action cannot be undone.
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setShowDeleteModal(false)} style={{
                  flex: 1, padding: "9px 16px", borderRadius: 6, border: "1px solid #cbd5e1",
                  background: "#ffffff", color: "#334155", fontWeight: 600, cursor: "pointer"
                }}>Cancel</button>
                <button onClick={handleDeleteUser} disabled={deleteLoading} style={{
                  flex: 1, padding: "9px 16px", borderRadius: 6, border: "none",
                  background: "#dc2626", color: "white",
                  fontWeight: 700, cursor: deleteLoading ? 0.6 : 1
                }}>{deleteLoading ? "Deleting..." : "Delete Account"}</button>
              </div>
            </div>
          </div>
        )}

        {/* SUPER ADMIN MODAL: MANAGE DEPARTMENTS & SECTIONS */}
        {showStructureModal && (
          <div style={modalOverlay} onClick={() => setShowStructureModal(false)}>
            <div style={{ ...modalBox, maxWidth: 680, maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid #e2e8f0", paddingBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ background: "#eff6ff", padding: "8px", borderRadius: 8, color: "#1d4ed8" }}>
                    <Settings size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 800, fontSize: 17, color: "#0f172a", margin: 0 }}>
                      College Structure & Section Console
                    </h3>
                    <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                      Configure college departments and year-wise sections (Super Admin Only)
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowStructureModal(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}>
                  <X size={20} />
                </button>
              </div>

              {/* Subtabs: Year-wise Sections vs Manage Departments */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => setStructureTab("sections")}
                  style={{
                    padding: "8px 16px", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer",
                    border: "none",
                    background: structureTab === "sections" ? "#1e40af" : "#f1f5f9",
                    color: structureTab === "sections" ? "#ffffff" : "#475569"
                  }}
                >
                  <Layers size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  Year-wise Sections Manager
                </button>
                <button
                  type="button"
                  onClick={() => setStructureTab("depts")}
                  style={{
                    padding: "8px 16px", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer",
                    border: "none",
                    background: structureTab === "depts" ? "#1e40af" : "#f1f5f9",
                    color: structureTab === "depts" ? "#ffffff" : "#475569"
                  }}
                >
                  <Building2 size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  Departments Directory ({activeDepartments.length})
                </button>
              </div>

              {/* TAB 1: YEAR-WISE SECTIONS MANAGER */}
              {structureTab === "sections" && (
                <div>
                  {/* Select Department Dropdown */}
                  <div style={{ marginBottom: 16, background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>
                      Select Department to Configure Sections:
                    </label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {activeDepartments.map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSelectedStructureDept(d)}
                          style={{
                            padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
                            background: selectedStructureDept === d ? "#2563eb" : "#ffffff",
                            color: selectedStructureDept === d ? "#ffffff" : "#334155",
                            border: selectedStructureDept === d ? "1px solid #2563eb" : "1px solid #cbd5e1"
                          }}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4 Years Section Config Cards */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                    {[
                      { num: "1", label: "1st Year (I Year)" },
                      { num: "2", label: "2nd Year (II Year)" },
                      { num: "3", label: "3rd Year (III Year)" },
                      { num: "4", label: "4th Year (IV Year)" }
                    ].map(({ num, label }) => {
                      const curSecs = collegeStructure.sections?.[selectedStructureDept]?.[num] || ["Single"];
                      const isSingle = curSecs.length === 1 && curSecs[0] === "Single";

                      return (
                        <div key={num} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#ffffff" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{label}</span>
                            <div style={{ display: "flex", gap: 6 }}>
                              {!isSingle ? (
                                <button
                                  type="button"
                                  onClick={() => handleSetSingleClass(num)}
                                  style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "#f1f5f9", border: "1px solid #cbd5e1", color: "#475569", cursor: "pointer", fontWeight: 600 }}
                                >
                                  Make Single Class
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleAddSectionToYear(num)}
                                style={{ fontSize: 11, padding: "3px 9px", borderRadius: 4, background: "#dbeafe", border: "1px solid #bfdbfe", color: "#1d4ed8", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}
                              >
                                <Plus size={12} /> Add Section
                              </button>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {isSingle ? (
                              <span style={{ fontSize: 12, padding: "4px 10px", background: "#f8fafc", color: "#475569", borderRadius: 6, border: "1px dashed #cbd5e1", fontWeight: 600 }}>
                                1 Class Only (No sections A, B...)
                              </span>
                            ) : (
                              curSecs.map(sec => (
                                <span
                                  key={sec}
                                  style={{
                                    fontSize: 12, padding: "4px 10px", background: "#eff6ff", color: "#1d4ed8",
                                    borderRadius: 6, border: "1px solid #bfdbfe", fontWeight: 700,
                                    display: "inline-flex", alignItems: "center", gap: 6
                                  }}
                                >
                                  Section {sec}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSectionFromYear(num, sec)}
                                    title={`Remove Section ${sec}`}
                                    style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 0, display: "flex" }}
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: DEPARTMENTS DIRECTORY */}
              {structureTab === "depts" && (
                <div>
                  {/* Current Active Departments */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8 }}>
                      Active Departments ({activeDepartments.length}):
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto", border: "1px solid #e2e8f0", padding: 8, borderRadius: 8 }}>
                      {activeDepartments.map(d => {
                        const info = collegeStructure?.deptDetails?.[d] || {};
                        return (
                          <div key={d} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "#f8fafc", borderRadius: 6, border: "1px solid #f1f5f9" }}>
                            <div>
                              <strong style={{ color: "#1e40af", fontSize: 13 }}>{d}</strong>
                              <span style={{ color: "#64748b", fontSize: 12, marginLeft: 8 }}>{info.name || getDeptFullName(d)}</span>
                              {info.code && <span style={{ color: "#059669", fontSize: 11, marginLeft: 8, background: "#ecfdf5", padding: "1px 5px", borderRadius: 4 }}>AU Code: {info.code}</span>}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteDepartment(d)}
                              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}
                              title="Delete Department"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Add New Department Form */}
                  <form onSubmit={handleAddNewDepartment} style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <PlusCircle size={15} color="#2563eb" /> Add New Department
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 10, marginBottom: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>Code (e.g. CYBER)</label>
                        <input
                          type="text"
                          value={newDeptForm.code}
                          onChange={e => setNewDeptForm({ ...newDeptForm, code: e.target.value.toUpperCase() })}
                          placeholder="CYBER"
                          style={{ width: "100%", padding: "7px 8px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 4, marginTop: 4, fontWeight: 700 }}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>Full Department Name</label>
                        <input
                          type="text"
                          value={newDeptForm.name}
                          onChange={e => setNewDeptForm({ ...newDeptForm, name: e.target.value })}
                          placeholder="e.g. Cyber Security"
                          style={{ width: "100%", padding: "7px 8px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 4, marginTop: 4 }}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>AU Branch Code</label>
                        <input
                          type="text"
                          value={newDeptForm.auCode}
                          onChange={e => setNewDeptForm({ ...newDeptForm, auCode: e.target.value })}
                          placeholder="e.g. 245"
                          style={{ width: "100%", padding: "7px 8px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 4, marginTop: 4 }}
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={savingStructure}
                      style={{
                        padding: "7px 14px", borderRadius: 6, border: "none",
                        background: "#059669", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer"
                      }}
                    >
                      + Register Department
                    </button>
                  </form>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setShowStructureModal(false)}
                  style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontWeight: 600, cursor: "pointer" }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveAllStructure}
                  disabled={savingStructure}
                  style={{
                    padding: "8px 20px", borderRadius: 6, border: "none",
                    background: "#2563eb", color: "white", fontWeight: 700, cursor: savingStructure ? "not-allowed" : "pointer"
                  }}
                >
                  {savingStructure ? "Saving..." : "Save College Structure Changes"}
                </button>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
