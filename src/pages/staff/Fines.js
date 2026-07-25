// src/pages/staff/StaffFines.js
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
  where
} from "firebase/firestore";
import {
  AlertOctagon,
  BookOpen,
  Home,
  Book,
  ClipboardList,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Edit2,
  PlusCircle
} from "lucide-react";

const CATEGORIES = ["Disciplinary", "Academic", "Hostel", "Library", "Other"];
const CATEGORY_STYLES = {
  "Disciplinary": { bg: "rgba(239, 68, 68, 0.14)", color: "var(--danger)", icon: <AlertOctagon size={16} /> },
  "Academic": { bg: "rgba(37, 99, 235, 0.14)", color: "var(--highlight)", icon: <BookOpen size={16} /> },
  "Hostel": { bg: "rgba(139, 92, 246, 0.14)", color: "#8b5cf6", icon: <Home size={16} /> },
  "Library": { bg: "rgba(245, 158, 11, 0.14)", color: "var(--warning)", icon: <Book size={16} /> },
  "Other": { bg: "rgba(148, 163, 184, 0.14)", color: "var(--text-muted)", icon: <ClipboardList size={16} /> }
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
    setEditReason(fine.reason || fine.description || "");
    setEditDueDate(fine.dueDate || "");
  }

  async function handleSaveEdit(fineId) {
    if (!editTitle.trim() || !editCategory || !editAmount || Number(editAmount) <= 0) {
      alert("Please fill in valid Title, Category, and positive Amount.");
      return;
    }
    setUpdating(true);
    try {
      await updateDoc(doc(db, "fines", fineId), {
        title: editTitle.trim(),
        category: editCategory,
        amount: Number(editAmount),
        reason: editReason.trim(),
        description: editReason.trim(),
        dueDate: editDueDate || null,
        updatedAt: new Date().toISOString(),
        updatedBy: userProfile?.name || "Staff"
      });
      setEditingFineId(null);
      await fetchFineHistory();
    } catch (err) {
      console.error("Failed to update fine:", err);
      alert("Error updating fine record.");
    }
    setUpdating(false);
  }

  async function fetchFineHistory() {
    setLoadingHistory(true);
    try {
      const snap = await getDocs(collection(db, "fines"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const myFines = list.filter(f => f.createdByUid === currentUser?.uid);
      myFines.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setFines(myFines);
    } catch (err) {
      console.error("Failed to fetch fine history:", err);
    }
    setLoadingHistory(false);
  }

  useEffect(() => {
    if (currentUser) {
      fetchFineHistory();
    }
  }, [currentUser]);

  async function handleSearchStudent(e) {
    e.preventDefault();
    setSearchError("");
    setFoundStudent(null);
    const regNo = searchRegisterNo.trim();
    if (!regNo) {
      setSearchError("Please enter a Register Number.");
      return;
    }

    setSearching(true);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("registerNo", "==", regNo)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setSearchError(`No student found with Register Number "${regNo}".`);
      } else {
        const studentDoc = snap.docs[0];
        setFoundStudent({ id: studentDoc.id, ...studentDoc.data() });
      }
    } catch (err) {
      console.error("Error searching student:", err);
      setSearchError("Failed to search. Try again.");
    }
    setSearching(false);
  }

  async function handleImposeFine(e) {
    e.preventDefault();
    setSuccessMsg("");

    if (!foundStudent) {
      alert("Please search and select a valid student first.");
      return;
    }
    if (!category) {
      alert("Please select a category.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }

    setSaving(true);
    try {
      const timestamp = new Date().toISOString();
      const fineData = {
        studentUid: foundStudent.uid || foundStudent.id,
        studentName: foundStudent.name,
        studentRegisterNo: foundStudent.registerNo,
        studentDept: foundStudent.dept || "",
        studentYear: foundStudent.year || "",
        title: title.trim(),
        category,
        amount: Number(amount),
        reason: reason.trim(),
        description: reason.trim(),
        dueDate: dueDate || null,
        status: "active",
        createdAt: timestamp,
        createdBy: userProfile?.name || "Staff",
        createdByUid: currentUser.uid,
        createdByRole: userProfile?.role || "staff"
      };

      await addDoc(collection(db, "fines"), fineData);

      setSuccessMsg(`Fine of ₹${amount} imposed successfully on ${foundStudent.name} (${foundStudent.registerNo})!`);
      setTitle("");
      setCategory("");
      setAmount("");
      setReason("");
      setDueDate("");
      setFoundStudent(null);
      setSearchRegisterNo("");
      await fetchFineHistory();
    } catch (err) {
      console.error("Failed to impose fine:", err);
      alert("Error imposing fine. Please try again.");
    }
    setSaving(false);
  }

  const filteredHistory = fines.filter(f => {
    if (filterStatus === "all") return true;
    return f.status === filterStatus;
  });

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Fine Management (Faculty)</h1>
          <p>Impose individual student fines & track issued fines</p>
        </div>

        {/* Top Split Section */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginBottom: 32 }}>
          
          {/* Box 1: Search Student */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Search size={20} color="var(--highlight)" />
              <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 16, fontWeight: 700 }}>
                1. Search Student
              </h3>
            </div>

            <form onSubmit={handleSearchStudent}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Student Register Number *</label>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="text"
                    placeholder="e.g. 713521104001"
                    value={searchRegisterNo}
                    onChange={(e) => setSearchRegisterNo(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn-primary" disabled={searching} style={{ width: "auto", padding: "0 20px" }}>
                    {searching ? "..." : "Search"}
                  </button>
                </div>
              </div>
            </form>

            {searchError && <div className="error-msg" style={{ marginTop: 12 }}>{searchError}</div>}

            {/* Found Student Details Card */}
            {foundStudent && (
              <div style={{
                marginTop: 16, padding: 16, borderRadius: "var(--radius-md)",
                background: "rgba(37, 99, 235, 0.12)", border: "1px solid rgba(37, 99, 235, 0.3)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                      {foundStudent.name}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                      Reg No: <strong style={{ color: "var(--highlight)" }}>{foundStudent.registerNo}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                      Dept: {foundStudent.dept || "N/A"} • Year {foundStudent.year || "N/A"}
                    </div>
                  </div>
                  <span className="badge badge-success">Selected</span>
                </div>
              </div>
            )}
          </div>

          {/* Box 2: Impose Fine Form */}
          <div className="card" style={{ opacity: foundStudent ? 1 : 0.6, pointerEvents: foundStudent ? "auto" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <PlusCircle size={20} color="var(--danger)" />
              <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 16, fontWeight: 700 }}>
                2. Fine Details
              </h3>
            </div>

            {successMsg && (
              <div style={{
                padding: "12px 16px", borderRadius: "var(--radius-sm)", marginBottom: 16,
                background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)",
                color: "var(--success)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8
              }}>
                <CheckCircle2 size={16} /> {successMsg}
              </div>
            )}

            <form onSubmit={handleImposeFine}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Fine Title / Reason *</label>
                <input
                  type="text"
                  placeholder="e.g. Late Library Return or Lab Rule Violation"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-row" style={{ marginBottom: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Category *</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} required>
                    <option value="" disabled>Select Category</option>
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 250"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Due Date (Optional)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 18 }}>
                <label>Description / Additional Notes</label>
                <input
                  type="text"
                  placeholder="Additional context or references"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={saving || !foundStudent}
                style={{ background: "var(--danger)" }}
              >
                {saving ? "Imposing Fine..." : "Impose Fine Now"}
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Section: History Log */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
            <div>
              <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>
                Issued Fines Log ({fines.length})
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
                Fines created by you
              </p>
            </div>

            {/* Filter Pills */}
            <div style={{ display: "flex", gap: 8 }}>
              {["all", "active", "pending_verification", "paid"].map(st => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  style={{
                    padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 600, transition: "all 0.2s ease",
                    background: filterStatus === st ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
                    color: filterStatus === st ? "var(--highlight)" : "var(--text-muted)"
                  }}
                >
                  {st === "all" ? "All" : st === "pending_verification" ? "Pending Approval" : st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading history...</div>
          ) : filteredHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
              No fine records match your selection.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Student Details</th>
                    <th>Fine Title & Category</th>
                    <th>Amount</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(fine => {
                    const catStyle = CATEGORY_STYLES[fine.category] || CATEGORY_STYLES["Other"];
                    const isEditing = editingFineId === fine.id;

                    return (
                      <tr key={fine.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{fine.studentName}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            Reg: {fine.studentRegisterNo} • {fine.studentDept} (Yr {fine.studentYear})
                          </div>
                        </td>

                        <td>
                          {isEditing ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 220 }}>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                style={{ padding: "4px 8px", fontSize: 12 }}
                              />
                              <select
                                value={editCategory}
                                onChange={e => setEditCategory(e.target.value)}
                                style={{ padding: "4px 8px", fontSize: 12 }}
                              >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <input
                                type="text"
                                placeholder="Reason"
                                value={editReason}
                                onChange={e => setEditReason(e.target.value)}
                                style={{ padding: "4px 8px", fontSize: 12 }}
                              />
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontWeight: 600 }}>{fine.title}</div>
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                                background: catStyle.bg, color: catStyle.color, marginTop: 4
                              }}>
                                {catStyle.icon} {fine.category}
                              </span>
                            </div>
                          )}
                        </td>

                        <td style={{ fontWeight: 700, color: "var(--danger)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                          {isEditing ? (
                            <input
                              type="number"
                              value={editAmount}
                              onChange={e => setEditAmount(e.target.value)}
                              style={{ width: 80, padding: "4px 8px", fontSize: 12 }}
                            />
                          ) : (
                            `₹${fine.amount}`
                          )}
                        </td>

                        <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {isEditing ? (
                            <input
                              type="date"
                              value={editDueDate}
                              onChange={e => setEditDueDate(e.target.value)}
                              style={{ padding: "4px 8px", fontSize: 12 }}
                            />
                          ) : fine.dueDate ? (
                            new Date(fine.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                          ) : (
                            "—"
                          )}
                        </td>

                        <td>
                          {fine.status === "active" && <span className="badge badge-warning">Unpaid</span>}
                          {fine.status === "pending_verification" && <span className="badge badge-warning">Verification Pending</span>}
                          {fine.status === "paid" && <span className="badge badge-success">Verified Paid</span>}
                          {fine.status === "rejected" && <span className="badge badge-danger">Payment Rejected</span>}
                        </td>

                        <td style={{ textAlign: "right" }}>
                          {isEditing ? (
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                              <button
                                onClick={() => handleSaveEdit(fine.id)}
                                disabled={updating}
                                style={{ padding: "4px 10px", borderRadius: 6, background: "var(--success)", border: "none", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingFineId(null)}
                                style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,0.1)", border: "none", color: "var(--text)", cursor: "pointer", fontSize: 12 }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            fine.status === "active" && (
                              <button
                                onClick={() => handleStartEdit(fine)}
                                style={{
                                  padding: "6px 12px", borderRadius: "var(--radius-sm)",
                                  background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)",
                                  color: "var(--text)", cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4
                                }}
                              >
                                <Edit2 size={12} /> Edit
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
