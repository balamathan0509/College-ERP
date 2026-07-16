// src/pages/officestaff/FeesCollection.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import * as XLSX from "xlsx";

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

  // New amount control
  const [feeAmount, setFeeAmount] = useState("");

  // Student Fee Profile Edit Modal States
  const [editingStudent, setEditingStudent] = useState(null);
  const [editStudentType, setEditStudentType] = useState("dayscholar");
  const [editBusUser, setEditBusUser] = useState(false);
  const [editApplicableFees, setEditApplicableFees] = useState({});
  const [editFeeAmounts, setEditFeeAmounts] = useState({});
  const [editMonthlyMessFees, setEditMonthlyMessFees] = useState(true);
  const [savingStudentSettings, setSavingStudentSettings] = useState(false);

  async function fetchStudents() {
    if (!selectedDept || !selectedYear || !selectedFeesType) return;
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
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(list);

      const feesDocId = `${selectedDept}_${selectedYear}_${selectedFeesType}_${selectedMonth}`.replace(/\s+/g, "_");
      const feesDoc = await getDoc(doc(db, "fees", feesDocId));
      if (feesDoc.exists()) {
        setFeesData(feesDoc.data().payments || {});
        setFeeAmount(feesDoc.data().amount || "");
      } else {
        setFeesData({});
        setFeeAmount(DEFAULT_FEE_AMOUNTS[selectedFeesType] || "");
      }
    } catch (err) {}
    setFetching(false);
  }

  async function saveFees() {
    setSaving(true);
    try {
      const docId = `${selectedDept}_${selectedYear}_${selectedFeesType}_${selectedMonth}`.replace(/\s+/g, "_");
      await setDoc(doc(db, "fees", docId), {
        dept: selectedDept,
        year: selectedYear,
        feesType: selectedFeesType,
        month: selectedMonth,
        amount: Number(feeAmount) || 0,
        payments: feesData,
        updatedAt: new Date().toISOString(),
        updatedBy: userProfile.name
      });
      setSaved(true);
    } catch (err) {}
    setSaving(false);
  }

  function exportExcel() {
    const collected = students.filter(s => feesData[s.id]);
    const pending = students.filter(s => !feesData[s.id]);

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(collected.map((s, i) => ({
      "S.No": i + 1, "Name": s.name, "Register No": s.registerNo,
      "Dept": s.dept, "Year": s.year, "Fees Type": selectedFeesType, "Status": "Collected"
    })));
    const ws2 = XLSX.utils.json_to_sheet(pending.map((s, i) => ({
      "S.No": i + 1, "Name": s.name, "Register No": s.registerNo,
      "Dept": s.dept, "Year": s.year, "Fees Type": selectedFeesType, "Status": "Pending"
    })));
    XLSX.utils.book_append_sheet(wb, ws1, "Collected");
    XLSX.utils.book_append_sheet(wb, ws2, "Pending");
    XLSX.writeFile(wb, `${selectedDept}_${selectedYear}_${selectedFeesType}_Fees.xlsx`);
  }

  async function handleSaveStudentSettings(e) {
    e.preventDefault();
    if (!editingStudent) return;
    setSavingStudentSettings(true);
    try {
      const studentRef = doc(db, "users", editingStudent.id);
      await updateDoc(studentRef, {
        studentType: editStudentType,
        busUser: editBusUser,
        applicableFees: editApplicableFees,
        feeAmounts: editFeeAmounts,
        monthlyMessFees: editMonthlyMessFees
      });

      // Update students state array locals
      setStudents(prev => prev.map(s => s.id === editingStudent.id ? { 
        ...s, 
        studentType: editStudentType, 
        busUser: editBusUser, 
        applicableFees: editApplicableFees,
        feeAmounts: editFeeAmounts,
        monthlyMessFees: editMonthlyMessFees
      } : s));

      setEditingStudent(null);
    } catch (err) {
      console.error("Failed to save student settings:", err);
      alert("Failed to save student settings. Please try again.");
    }
    setSavingStudentSettings(false);
  }

  useEffect(() => { fetchStudents(); }, [selectedDept, selectedYear, selectedFeesType, selectedMonth]);

  const collectedCount = students.filter(s => feesData[s.id]).length;
  const pendingCount = students.length - collectedCount;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>💰 Fees Collection</h1>
          <p>All Departments — Office Staff</p>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Department</label>
              <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)}>
                <option value="">Select Dept</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Year</label>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                <option value="">Select Year</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Fees Type</label>
              <select value={selectedFeesType} onChange={e => setSelectedFeesType(e.target.value)}>
                <option value="">Select Type</option>
                {FEES_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Month tracking</label>
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                {MONTHS.map(m => <option key={m} value={m}>{m === CURRENT_MONTH ? `${m} (Live)` : m}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Amount (INR)</label>
              <input
                type="number"
                placeholder="Fee Amount"
                value={feeAmount}
                onChange={e => setFeeAmount(e.target.value)}
                disabled={!selectedFeesType}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, background: "#0f0f1b",
                  border: "1px solid rgba(255,255,255,0.1)", color: "white"
                }}
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        {students.length > 0 && (
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-value">{students.length}</div>
              <div className="stat-label">Total Students</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-value" style={{ color: "#48bb78" }}>{collectedCount}</div>
              <div className="stat-label">Collected</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">⏳</div>
              <div className="stat-value" style={{ color: "#fc8181" }}>{pendingCount}</div>
              <div className="stat-label">Pending</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-value" style={{ color: "#f5a623" }}>
                {students.length ? Math.round((collectedCount / students.length) * 100) : 0}%
              </div>
              <div className="stat-label">Collection Rate</div>
            </div>
          </div>
        )}

        {fetching ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div className="spinner" style={{ margin: "0 auto" }}></div>
          </div>
        ) : students.length > 0 ? (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18 }}>
                {selectedDept} — {selectedYear} — {selectedFeesType} — {selectedMonth}
              </h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={() => { const all = {}; students.forEach(s => { all[s.id] = true; }); setFeesData(all); }} style={{
                  padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(72,187,120,0.3)",
                  background: "rgba(72,187,120,0.1)", color: "#48bb78", cursor: "pointer", fontSize: 13, fontWeight: 600
                }}>✅ Select All</button>
                <button onClick={() => setFeesData({})} style={{
                  padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(252,129,129,0.3)",
                  background: "rgba(252,129,129,0.1)", color: "#fc8181", cursor: "pointer", fontSize: 13, fontWeight: 600
                }}>❌ Clear All</button>
                <button onClick={exportExcel} style={{
                  padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(66,153,225,0.3)",
                  background: "rgba(66,153,225,0.1)", color: "#4299e1", cursor: "pointer", fontSize: 13, fontWeight: 600
                }}>📊 Export Excel</button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    {["S.No", "Name", "Register No", "Student Type", "Manage Fees", "Fees Collected"].map((h, i) => (
                      <th key={i} style={{ padding: "12px 16px", textAlign: i === 5 ? "center" : "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => (
                    <tr key={student.id} onClick={() => setFeesData(prev => ({ ...prev, [student.id]: !prev[student.id] }))}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        background: feesData[student.id] ? "rgba(72,187,120,0.05)" : "transparent",
                        cursor: "pointer", transition: "all 0.15s"
                      }}>
                      <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 14 }}>{idx + 1}</td>
                      <td style={{ padding: "14px 16px", fontWeight: 600, fontSize: 15 }}>{student.name}</td>
                      <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 14 }}>{student.registerNo}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{
                            padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, width: "fit-content",
                            background: student.studentType === "hosteller" ? "rgba(66,153,225,0.15)" : "rgba(159,122,234,0.15)",
                            color: student.studentType === "hosteller" ? "#4299e1" : "#9f7aea"
                          }}>
                            {student.studentType === "hosteller" ? "🏠 Hosteller" : "🏡 Day Scholar"}
                          </span>
                          {student.busUser && (
                            <span style={{
                              padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, width: "fit-content",
                              background: "rgba(72,187,120,0.15)", color: "#48bb78"
                            }}>
                              🚌 Bus User
                            </span>
                          )}
                          {(student.monthlyMessFees !== false && student.studentType === "hosteller") && (
                            <span style={{
                              padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, width: "fit-content",
                              background: "rgba(245,166,35,0.15)", color: "#f5a623"
                            }}>
                              📅 Monthly Mess
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingStudent(student);
                            setEditStudentType(student.studentType || "dayscholar");
                            setEditBusUser(student.busUser || false);
                            setEditApplicableFees(student.applicableFees || {
                              "College Fees": true,
                              "Bus Fees": student.busUser || false,
                              "Mess Fees": student.studentType === "hosteller",
                              "Exam Fees": true,
                              "Library Fees": true,
                              "Other": true
                            });
                            setEditFeeAmounts(student.feeAmounts || {
                              "College Fees": student.feeAmounts?.["College Fees"] || DEFAULT_FEE_AMOUNTS["College Fees"],
                              "Bus Fees": student.feeAmounts?.["Bus Fees"] || DEFAULT_FEE_AMOUNTS["Bus Fees"],
                              "Mess Fees": student.feeAmounts?.["Mess Fees"] || DEFAULT_FEE_AMOUNTS["Mess Fees"],
                              "Exam Fees": student.feeAmounts?.["Exam Fees"] || DEFAULT_FEE_AMOUNTS["Exam Fees"],
                              "Library Fees": student.feeAmounts?.["Library Fees"] || DEFAULT_FEE_AMOUNTS["Library Fees"],
                              "Other": student.feeAmounts?.["Other"] || DEFAULT_FEE_AMOUNTS["Other"]
                            });
                            setEditMonthlyMessFees(student.monthlyMessFees !== undefined ? student.monthlyMessFees : (student.studentType === "hosteller"));
                          }}
                          style={{
                            padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)",
                            background: "rgba(255,255,255,0.05)", color: "white", fontSize: 12, cursor: "pointer",
                            fontWeight: 600, display: "flex", alignItems: "center", gap: 6
                          }}
                        >
                          ⚙️ Settings
                        </button>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, margin: "0 auto",
                          border: feesData[student.id] ? "2px solid #48bb78" : "2px solid rgba(255,255,255,0.2)",
                          background: feesData[student.id] ? "#48bb78" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 16, transition: "all 0.2s", color: "white", fontWeight: 700
                        }}>
                          {feesData[student.id] ? "✓" : ""}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center" }}>
              <button className="btn-primary" onClick={saveFees} disabled={saving} style={{ width: "auto", padding: "12px 32px" }}>
                {saving ? "Saving..." : "💾 Save Fees Data"}
              </button>
              {saved && <span style={{ color: "#48bb78", fontWeight: 600, fontSize: 14 }}>✅ Saved successfully!</span>}
            </div>
          </div>
        ) : selectedDept && selectedYear && selectedFeesType ? (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
            <p style={{ color: "#a0aec0" }}>No students found.</p>
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💰</div>
            <p style={{ color: "#a0aec0" }}>Select Department, Year and Fees Type to start</p>
          </div>
        )}

      {/* Student Fees Profile Settings Modal */}
      {editingStudent && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div className="card" style={{
            width: "100%", maxWidth: 480, background: "#161625", padding: 24, borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            overflowY: "auto", maxHeight: "90vh"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, color: "white", margin: 0 }}>
                ⚙️ Manage Fees: {editingStudent.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                style={{ background: "transparent", border: "none", color: "#a0aec0", fontSize: 20, cursor: "pointer" }}
              >✕</button>
            </div>

            <form onSubmit={handleSaveStudentSettings}>
              {/* Student Type Dropdown */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: "#a0aec0" }}>Student Type</label>
                <select
                  value={editStudentType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditStudentType(val);
                    // Proactively toggle hostel/mess fees based on type
                    setEditApplicableFees(prev => ({
                      ...prev,
                      "Mess Fees": val === "hosteller",
                      "Hostel Fees": val === "hosteller"
                    }));
                  }}
                  style={{ width: "100%", padding: 10, borderRadius: 8, background: "#0f0f1b", border: "1px solid rgba(255,255,255,0.1)", color: "white", marginTop: 6 }}
                >
                  <option value="dayscholar">🏡 Day Scholar</option>
                  <option value="hosteller">🏠 Hosteller</option>
                </select>
              </div>

              {/* Uses College Bus */}
              <div className="form-group" style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 13, color: "#a0aec0" }}>Uses College Bus</label>
                <select
                  value={editBusUser ? "yes" : "no"}
                  onChange={(e) => {
                    const isBus = e.target.value === "yes";
                    setEditBusUser(isBus);
                    // Proactively toggle bus fees
                    setEditApplicableFees(prev => ({
                      ...prev,
                      "Bus Fees": isBus
                    }));
                  }}
                  style={{ width: "100%", padding: 10, borderRadius: 8, background: "#0f0f1b", border: "1px solid rgba(255,255,255,0.1)", color: "white", marginTop: 6 }}
                >
                  <option value="no">🏡 Day Scholar - No Bus</option>
                  <option value="yes">🚌 Bus User - Yes</option>
                </select>
              </div>

              {/* Monthly Mess Fees Auto-Deduction Toggle */}
              <div className="form-group" style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 13, color: "#a0aec0" }}>Monthly Mess Fees (Auto-deducted every month)</label>
                <select
                  value={editMonthlyMessFees ? "yes" : "no"}
                  onChange={(e) => setEditMonthlyMessFees(e.target.value === "yes")}
                  style={{ width: "100%", padding: 10, borderRadius: 8, background: "#0f0f1b", border: "1px solid rgba(255,255,255,0.1)", color: "white", marginTop: 6 }}
                >
                  <option value="yes">✅ Yes - Auto Mess Fees Every Month</option>
                  <option value="no">❌ No - No Monthly Mess Fees</option>
                </select>
                <div style={{ fontSize: 11, color: "#718096", marginTop: 6 }}>
                  When enabled, mess fees will be automatically created at the start of each month for this student.
                </div>
              </div>

              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 16 }}></div>

              {/* Fee Applicability & Amount Configuration */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, color: "#a0aec0", fontWeight: 600, display: "block", marginBottom: 12 }}>
                  Applicable Fees & Custom Amounts:
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {FEES_TYPES.map((type) => {
                    const isChecked = editApplicableFees[type] !== false;
                    const amountValue = editFeeAmounts[type] !== undefined ? editFeeAmounts[type] : (DEFAULT_FEE_AMOUNTS[type] || "");
                    
                    return (
                      <div key={type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", color: "white", margin: 0, userSelect: "none" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setEditApplicableFees(prev => ({
                                ...prev,
                                [type]: checked
                              }));
                              // Sync selectors
                              if (type === "Bus Fees") setEditBusUser(checked);
                              if (type === "Mess Fees" && checked) setEditStudentType("hosteller");
                            }}
                          />
                          {type}
                        </label>
                        {isChecked && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 12, color: "#a0aec0" }}>₹</span>
                            <input
                              type="number"
                              required
                              placeholder="Amount"
                              value={amountValue}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditFeeAmounts(prev => ({
                                  ...prev,
                                  [type]: val === "" ? "" : Number(val)
                                }));
                              }}
                              style={{
                                width: 90, padding: "4px 8px", borderRadius: 6, background: "#0f0f1b",
                                border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 12, textAlign: "right"
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="btn-primary"
                  style={{ background: "#4a5568", border: "none", padding: "8px 16px", width: "auto" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStudentSettings}
                  className="btn-primary"
                  style={{ background: "#48bb78", border: "none", padding: "8px 24px", width: "auto" }}
                >
                  {savingStudentSettings ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}