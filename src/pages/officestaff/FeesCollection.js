// src/pages/officestaff/FeesCollection.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import {
  CreditCard,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  PlusCircle,
  Edit2,
  Users,
  Building2,
  Calendar,
  X
} from "lucide-react";

const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIDS", "AIML"];
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const FEES_TYPES = ["College Fees", "Bus Fees", "Mess Fees", "Exam Fees", "Library Fees", "Other"];

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS = [];
const d = new Date();
for (let i = -6; i <= 6; i++) {
  const temp = new Date(d.getFullYear(), d.getMonth() + i, 1);
  MONTHS.push(monthNames[temp.getMonth()] + " " + temp.getFullYear());
}
const CURRENT_MONTH = monthNames[d.getMonth()] + " " + d.getFullYear();

const DEFAULT_FEE_AMOUNTS = {
  "College Fees": 25000,
  "Bus Fees": 8000,
  "Mess Fees": 6000,
  "Exam Fees": 1500,
  "Library Fees": 500,
  "Other": 1000
};

export default function FeesCollection() {
  const { userProfile } = useAuth();
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedFeesType, setSelectedFeesType] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [students, setStudents] = useState([]);
  const [feesData, setFeesData] = useState({});
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [feeAmount, setFeeAmount] = useState("");

  // Student Fee Profile Edit Modal States
  const [editingStudent, setEditingStudent] = useState(null);
  const [editStudentType, setEditStudentType] = useState("dayscholar");
  const [editBusUser, setEditBusUser] = useState(false);
  const [editApplicableFees, setEditApplicableFees] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);

  // Auto Mess Fee Generation Modal State
  const [showAutoMessModal, setShowAutoMessModal] = useState(false);
  const [messMonth, setMessMonth] = useState(CURRENT_MONTH);
  const [messAmount, setMessAmount] = useState(6000);
  const [messDept, setMessDept] = useState("all");
  const [messYear, setMessYear] = useState("all");
  const [generatingMess, setGeneratingMess] = useState(false);

  const isMonthly = selectedFeesType === "Mess Fees";

  function getFeeDocId() {
    let id = `${selectedDept}_${selectedYear}_${selectedFeesType}`.replace(/\s+/g, "_");
    if (isMonthly) {
      id += `_${selectedMonth.replace(/\s+/g, "_")}`;
    }
    return id;
  }

  async function handleLoadStudents() {
    if (!selectedDept || !selectedYear || !selectedFeesType) return;
    if (isMonthly && !selectedMonth) return;

    setFetching(true);
    setSaved(false);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", selectedDept),
        where("year", "==", selectedYear)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.registerNo || "").localeCompare(b.registerNo || ""));
      setStudents(list);

      const feeDocRef = doc(db, "fees", getFeeDocId());
      const feeSnap = await getDoc(feeDocRef);

      if (feeSnap.exists()) {
        const data = feeSnap.data();
        setFeesData(data.payments || {});
        setFeeAmount(data.amount || DEFAULT_FEE_AMOUNTS[selectedFeesType] || "");
      } else {
        const defaultMap = {};
        list.forEach((s) => {
          defaultMap[s.id] = false;
        });
        setFeesData(defaultMap);
        setFeeAmount(DEFAULT_FEE_AMOUNTS[selectedFeesType] || "");
      }
    } catch (err) {
      console.error(err);
    }
    setFetching(false);
  }

  useEffect(() => {
    if (selectedDept && selectedYear && selectedFeesType) {
      handleLoadStudents();
    }
  }, [selectedDept, selectedYear, selectedFeesType, selectedMonth]);

  function handleToggle(studentId) {
    const current = feesData[studentId];

    if (current && typeof current === "object") {
      alert(`Student submitted payment (UTR: ${current.transactionId || "N/A"}). Please use "Verify Fees" menu to approve or reject.`);
      return;
    }

    setFeesData((prev) => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  }

  function handleMarkAll(val) {
    const updated = { ...feesData };
    students.forEach((s) => {
      const cur = updated[s.id];
      if (cur && typeof cur === "object") return;
      updated[s.id] = val;
    });
    setFeesData(updated);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const docId = getFeeDocId();
      const feeDocRef = doc(db, "fees", docId);
      const extraFields = isMonthly ? { month: selectedMonth } : {};

      await setDoc(feeDocRef, {
        dept: selectedDept,
        year: selectedYear,
        feesType: selectedFeesType,
        amount: Number(feeAmount) || DEFAULT_FEE_AMOUNTS[selectedFeesType] || 0,
        updatedAt: new Date().toISOString(),
        updatedBy: userProfile?.name || "Office Staff",
        ...extraFields,
        payments: feesData
      }, { merge: true });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Error saving fee records.");
    }
    setSaving(false);
  }

  function handleExportExcel() {
    if (students.length === 0) return;
    const rows = students.map((s, idx) => {
      const p = feesData[s.id];
      let statusStr = "Unpaid";
      let utrStr = "N/A";
      let amountPaidStr = "N/A";

      if (p === true) {
        statusStr = "Paid (Manual)";
      } else if (p && typeof p === "object") {
        if (p.status === "verified") statusStr = "Paid & Verified";
        else if (p.status === "pending") statusStr = "Pending Verification";
        else if (p.status === "rejected") statusStr = "Rejected";
        utrStr = p.transactionId || "N/A";
        amountPaidStr = p.amountPaid ? `₹${p.amountPaid}` : "N/A";
      }

      return {
        "S.No": idx + 1,
        "Register No": s.registerNo || "",
        "Student Name": s.name || "",
        "Department": s.dept || "",
        "Year": s.year || "",
        "Student Type": s.studentType === "hosteller" ? "Hosteller" : "Day Scholar",
        "Fee Type": selectedFeesType,
        "Month": isMonthly ? selectedMonth : "N/A",
        "Fee Amount": `₹${feeAmount || DEFAULT_FEE_AMOUNTS[selectedFeesType] || 0}`,
        "Status": statusStr,
        "Transaction UTR": utrStr,
        "Amount Paid": amountPaidStr
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fees Report");
    const fileName = `Fees_${selectedDept}_${selectedYear}_${selectedFeesType.replace(/\s+/g, "_")}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }

  function handleOpenProfileModal(student) {
    setEditingStudent(student);
    setEditStudentType(student.studentType || "dayscholar");
    setEditBusUser(student.isBusUser || false);

    const initialFeeAmounts = {};
    FEES_TYPES.forEach(ft => {
      initialFeeAmounts[ft] = student.feeAmounts?.[ft] !== undefined
        ? student.feeAmounts[ft]
        : DEFAULT_FEE_AMOUNTS[ft];
    });
    setEditApplicableFees(initialFeeAmounts);
  }

  async function handleSaveStudentProfile() {
    if (!editingStudent) return;
    setSavingProfile(true);
    try {
      const userRef = doc(db, "users", editingStudent.id);
      await updateDoc(userRef, {
        studentType: editStudentType,
        isBusUser: editBusUser,
        feeAmounts: editApplicableFees,
        updatedAt: new Date().toISOString(),
        updatedBy: userProfile?.name || "Office Staff"
      });

      alert(`Student Fee Profile updated successfully for ${editingStudent.name}!`);
      setEditingStudent(null);
      await handleLoadStudents();
    } catch (err) {
      console.error(err);
      alert("Failed to update student profile.");
    }
    setSavingProfile(false);
  }

  async function handleGenerateMonthlyMessFees() {
    if (!messMonth) {
      alert("Please select a target month.");
      return;
    }
    setGeneratingMess(true);
    try {
      let studQ;
      if (messDept === "all" && messYear === "all") {
        studQ = query(collection(db, "users"), where("role", "==", "student"), where("studentType", "==", "hosteller"));
      } else if (messDept !== "all" && messYear === "all") {
        studQ = query(collection(db, "users"), where("role", "==", "student"), where("studentType", "==", "hosteller"), where("dept", "==", messDept));
      } else if (messDept === "all" && messYear !== "all") {
        studQ = query(collection(db, "users"), where("role", "==", "student"), where("studentType", "==", "hosteller"), where("year", "==", messYear));
      } else {
        studQ = query(collection(db, "users"), where("role", "==", "student"), where("studentType", "==", "hosteller"), where("dept", "==", messDept), where("year", "==", messYear));
      }

      const snap = await getDocs(studQ);
      const hostellers = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (hostellers.length === 0) {
        alert("No hosteller students found matching the selected filters.");
        setGeneratingMess(false);
        return;
      }

      const grouped = {};
      hostellers.forEach(s => {
        const key = `${s.dept}_${s.year}`;
        if (!grouped[key]) grouped[key] = { dept: s.dept, year: s.year, students: [] };
        grouped[key].students.push(s);
      });

      let count = 0;
      for (const key of Object.keys(grouped)) {
        const group = grouped[key];
        const docId = `${group.dept}_${group.year}_Mess_Fees_${messMonth.replace(/\s+/g, "_")}`;
        const docRef = doc(db, "fees", docId);
        const docSnap = await getDoc(docRef);

        let currentPayments = {};
        if (docSnap.exists()) {
          currentPayments = docSnap.data().payments || {};
        }

        group.students.forEach(s => {
          if (currentPayments[s.id] === undefined) {
            currentPayments[s.id] = false;
          }
        });

        await setDoc(docRef, {
          dept: group.dept,
          year: group.year,
          feesType: "Mess Fees",
          month: messMonth,
          amount: Number(messAmount) || 6000,
          updatedAt: new Date().toISOString(),
          updatedBy: userProfile?.name || "Office Staff (Auto Mess Bill)",
          payments: currentPayments
        }, { merge: true });
        count += group.students.length;
      }

      alert(`Successfully generated Mess Fees for ${count} hosteller student(s) for ${messMonth}!`);
      setShowAutoMessModal(false);

      if (selectedFeesType === "Mess Fees") {
        handleLoadStudents();
      }
    } catch (err) {
      console.error("Auto Mess Fee Generation Error:", err);
      alert("Failed to generate monthly mess fees.");
    }
    setGeneratingMess(false);
  }

  const paidCount = students.filter((s) => {
    const p = feesData[s.id];
    return p === true || p?.status === "verified";
  }).length;
  const pendingCount = students.filter((s) => {
    const p = feesData[s.id];
    return p === false || p?.status === "pending" || p?.status === "rejected";
  }).length;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1>Fees Collection Management</h1>
            <p>Select Department, Year, and Fee Type to manage payment records</p>
          </div>

          <button
            className="btn-primary"
            onClick={() => setShowAutoMessModal(true)}
            style={{ width: "auto" }}
          >
            <PlusCircle size={16} /> Auto-Generate Monthly Mess Fees
          </button>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Department *</label>
              <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
                <option value="" disabled>Select Dept</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Year *</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                <option value="" disabled>Select Year</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Fee Type *</label>
              <select value={selectedFeesType} onChange={(e) => setSelectedFeesType(e.target.value)}>
                <option value="" disabled>Select Fee Type</option>
                {FEES_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {isMonthly && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Billing Month *</label>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                  {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Default Fee Amount (₹)</label>
              <input
                type="number"
                placeholder="Fee amount"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Table & Actions */}
        {selectedDept && selectedYear && selectedFeesType && (
          <div className="card">
            {fetching ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : students.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                No students found for {selectedDept} • {selectedYear}.
              </div>
            ) : (
              <>
                {/* Control Bar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                      Total: <strong style={{ color: "var(--text)" }}>{students.length}</strong> |
                      Paid: <strong style={{ color: "var(--success)" }}>{paidCount}</strong> |
                      Pending: <strong style={{ color: "var(--danger)" }}>{pendingCount}</strong>
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      className="btn-secondary"
                      onClick={() => handleMarkAll(true)}
                      style={{ margin: 0, padding: "8px 14px", fontSize: 13, width: "auto" }}
                    >
                      Mark All Paid
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleMarkAll(false)}
                      style={{ margin: 0, padding: "8px 14px", fontSize: 13, width: "auto" }}
                    >
                      Mark All Unpaid
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={handleExportExcel}
                      style={{ margin: 0, padding: "8px 14px", fontSize: 13, width: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Download size={14} /> Export Excel
                    </button>
                    <button
                      className="btn-primary"
                      onClick={handleSave}
                      disabled={saving}
                      style={{ width: "auto", padding: "8px 20px" }}
                    >
                      {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Reg No</th>
                        <th>Student Name</th>
                        <th>Student Type</th>
                        <th>Fee Amount</th>
                        <th>Payment Status</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s, idx) => {
                        const p = feesData[s.id];
                        const isPaidObj = p && typeof p === "object";
                        const isPaidTrue = p === true;
                        const isVerified = isPaidObj && p.status === "verified";
                        const isPendingVerification = isPaidObj && p.status === "pending";
                        const isRejectedVerification = isPaidObj && p.status === "rejected";

                        return (
                          <tr key={s.id}>
                            <td style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                            <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{s.registerNo || "N/A"}</td>
                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                            <td>
                              <span className="badge" style={{ background: "rgba(37, 99, 235, 0.12)", color: "var(--highlight)", border: "1px solid rgba(37, 99, 235, 0.3)" }}>
                                {s.studentType === "hosteller" ? "Hosteller" : "Day Scholar"}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                              ₹{feeAmount || DEFAULT_FEE_AMOUNTS[selectedFeesType] || 0}
                            </td>

                            <td>
                              {isVerified && (
                                <span className="badge badge-success" style={{ cursor: "pointer" }} onClick={() => handleToggle(s.id)}>
                                  <CheckCircle2 size={12} /> Paid & Verified
                                </span>
                              )}
                              {isPaidTrue && (
                                <span className="badge badge-success" style={{ cursor: "pointer" }} onClick={() => handleToggle(s.id)}>
                                  <CheckCircle2 size={12} /> Paid (Manual)
                                </span>
                              )}
                              {isPendingVerification && (
                                <span className="badge badge-warning" style={{ cursor: "pointer" }} onClick={() => handleToggle(s.id)}>
                                  <Clock size={12} /> Verification Pending
                                </span>
                              )}
                              {isRejectedVerification && (
                                <span className="badge badge-danger" style={{ cursor: "pointer" }} onClick={() => handleToggle(s.id)}>
                                  <XCircle size={12} /> Rejected
                                </span>
                              )}
                              {!p && (
                                <span className="badge badge-danger" style={{ cursor: "pointer" }} onClick={() => handleToggle(s.id)}>
                                  <XCircle size={12} /> Unpaid
                                </span>
                              )}
                            </td>

                            <td style={{ textAlign: "right" }}>
                              <button
                                className="btn-secondary"
                                onClick={() => handleOpenProfileModal(s)}
                                style={{ margin: 0, padding: "4px 10px", fontSize: 12, width: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}
                              >
                                <Edit2 size={12} /> Edit Profile
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Student Profile Modal */}
      {editingStudent && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          backdropFilter: "blur(8px)"
        }}>
          <div className="card" style={{ maxWidth: 500, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17 }}>
                Edit Fee Profile: {editingStudent.name}
              </h3>
              <button onClick={() => setEditingStudent(null)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Scholar Type *</label>
              <select value={editStudentType} onChange={e => setEditStudentType(e.target.value)}>
                <option value="dayscholar">Day Scholar</option>
                <option value="hosteller">Hosteller</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textTransform: "none" }}>
                <input
                  type="checkbox"
                  checked={editBusUser}
                  onChange={e => setEditBusUser(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                Uses College Bus Transportation
              </label>
            </div>

            <h4 style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Custom Applicable Fee Amounts (₹)</h4>
            {FEES_TYPES.map(ft => (
              <div key={ft} className="form-group" style={{ marginBottom: 12 }}>
                <label>{ft}</label>
                <input
                  type="number"
                  value={editApplicableFees[ft] !== undefined ? editApplicableFees[ft] : ""}
                  onChange={e => setEditApplicableFees({ ...editApplicableFees, [ft]: e.target.value })}
                />
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
              <button className="btn-secondary" onClick={() => setEditingStudent(null)} style={{ width: "auto", margin: 0 }}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveStudentProfile} disabled={savingProfile} style={{ width: "auto" }}>
                {savingProfile ? "Saving Profile..." : "Save Student Profile"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Mess Fee Generation Modal */}
      {showAutoMessModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          backdropFilter: "blur(8px)"
        }}>
          <div className="card" style={{ maxWidth: 460, width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17 }}>
                Auto-Generate Monthly Mess Fees
              </h3>
              <button onClick={() => setShowAutoMessModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Target Month *</label>
              <select value={messMonth} onChange={e => setMessMonth(e.target.value)}>
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Monthly Mess Bill Amount (₹) *</label>
              <input
                type="number"
                value={messAmount}
                onChange={e => setMessAmount(e.target.value)}
                required
              />
            </div>

            <div className="form-row" style={{ marginBottom: 20 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Target Dept</label>
                <select value={messDept} onChange={e => setMessDept(e.target.value)}>
                  <option value="all">All Departments</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Target Year</label>
                <select value={messYear} onChange={e => setMessYear(e.target.value)}>
                  <option value="all">All Years</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => setShowAutoMessModal(false)} style={{ width: "auto", margin: 0 }}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleGenerateMonthlyMessFees} disabled={generatingMess} style={{ width: "auto" }}>
                {generatingMess ? "Generating..." : "Generate Bills Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}