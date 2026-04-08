// src/pages/staff/Fees.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import {
  collection, query, where, getDocs, doc, setDoc, getDoc
} from "firebase/firestore";
import * as XLSX from "xlsx";

const FEES_TYPES = ["College Fees", "Bus Fees", "Mess Fees", "Exam Fees", "Library Fees", "Other"];
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export default function StaffFees() {
  const { userProfile } = useAuth();
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedFeesType, setSelectedFeesType] = useState("");
  const [students, setStudents] = useState([]);
  const [feesData, setFeesData] = useState({});
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function fetchStudents() {
    if (!selectedYear || !selectedFeesType) return;
    setFetching(true);
    setSaved(false);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", userProfile.dept),
        where("year", "==", selectedYear)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(list);

      // Fetch existing fees data
      const feesDocId = `${userProfile.dept}_${selectedYear}_${selectedFeesType}`.replace(/\s+/g, "_");
      const feesDoc = await getDoc(doc(db, "fees", feesDocId));
      if (feesDoc.exists()) {
        setFeesData(feesDoc.data().payments || {});
      } else {
        setFeesData({});
      }
    } catch (err) {}
    setFetching(false);
  }

  function toggleFees(studentId) {
    setFeesData(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  }

  function selectAll() {
    const all = {};
    students.forEach(s => { all[s.id] = true; });
    setFeesData(all);
  }

  function clearAll() {
    setFeesData({});
  }

  async function saveFees() {
    setSaving(true);
    try {
      const feesDocId = `${userProfile.dept}_${selectedYear}_${selectedFeesType}`.replace(/\s+/g, "_");
      await setDoc(doc(db, "fees", feesDocId), {
        dept: userProfile.dept,
        year: selectedYear,
        feesType: selectedFeesType,
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

    const collectedData = collected.map((s, i) => ({
      "S.No": i + 1,
      "Name": s.name,
      "Register No": s.registerNo,
      "Department": s.dept,
      "Year": s.year,
      "Fees Type": selectedFeesType,
      "Status": "Collected"
    }));

    const pendingData = pending.map((s, i) => ({
      "S.No": i + 1,
      "Name": s.name,
      "Register No": s.registerNo,
      "Department": s.dept,
      "Year": s.year,
      "Fees Type": selectedFeesType,
      "Status": "Pending"
    }));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(collectedData);
    const ws2 = XLSX.utils.json_to_sheet(pendingData);
    XLSX.utils.book_append_sheet(wb, ws1, "Collected");
    XLSX.utils.book_append_sheet(wb, ws2, "Pending");
    XLSX.writeFile(wb, `${userProfile.dept}_${selectedYear}_${selectedFeesType}_Fees.xlsx`);
  }

  useEffect(() => {
    if (selectedYear && selectedFeesType) fetchStudents();
  }, [selectedYear, selectedFeesType]);

  const collectedCount = students.filter(s => feesData[s.id]).length;
  const pendingCount = students.length - collectedCount;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>💰 Fees Management</h1>
          <p>{userProfile?.dept} Department</p>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="form-row">
            <div className="form-group" style={{ margin: 0 }}>
              <label>Select Year</label>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                <option value="">Choose Year</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Fees Type</label>
              <select value={selectedFeesType} onChange={e => setSelectedFeesType(e.target.value)}>
                <option value="">Choose Fees Type</option>
                {FEES_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
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
              <div className="stat-label">Fees Collected</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">⏳</div>
              <div className="stat-value" style={{ color: "#fc8181" }}>{pendingCount}</div>
              <div className="stat-label">Fees Pending</div>
            </div>
          </div>
        )}

        {/* Student List */}
        {fetching ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div className="spinner" style={{ margin: "0 auto" }}></div>
          </div>
        ) : students.length > 0 ? (
          <div className="card">
            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18 }}>
                Student List — {selectedYear} ({selectedFeesType})
              </h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={selectAll} style={{
                  padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(72,187,120,0.3)",
                  background: "rgba(72,187,120,0.1)", color: "#48bb78", cursor: "pointer", fontSize: 13, fontWeight: 600
                }}>✅ Select All</button>
                <button onClick={clearAll} style={{
                  padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(252,129,129,0.3)",
                  background: "rgba(252,129,129,0.1)", color: "#fc8181", cursor: "pointer", fontSize: 13, fontWeight: 600
                }}>❌ Clear All</button>
                <button onClick={exportExcel} style={{
                  padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(66,153,225,0.3)",
                  background: "rgba(66,153,225,0.1)", color: "#4299e1", cursor: "pointer", fontSize: 13, fontWeight: 600
                }}>📊 Export Excel</button>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>S.No</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>Name</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>Register No</th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>Fees Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => (
                    <tr
                      key={student.id}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        background: feesData[student.id] ? "rgba(72,187,120,0.05)" : "transparent",
                        cursor: "pointer",
                        transition: "all 0.15s"
                      }}
                      onClick={() => toggleFees(student.id)}
                    >
                      <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 14 }}>{idx + 1}</td>
                      <td style={{ padding: "14px 16px", fontWeight: 600, fontSize: 15 }}>{student.name}</td>
                      <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 14 }}>{student.registerNo}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          border: feesData[student.id] ? "2px solid #48bb78" : "2px solid rgba(255,255,255,0.2)",
                          background: feesData[student.id] ? "#48bb78" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          margin: "0 auto", fontSize: 16, transition: "all 0.2s"
                        }}>
                          {feesData[student.id] ? "✓" : ""}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Save Button */}
            <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center" }}>
              <button className="btn-primary" onClick={saveFees} disabled={saving} style={{ width: "auto", padding: "12px 32px" }}>
                {saving ? "Saving..." : "💾 Save Fees Data"}
              </button>
              {saved && (
                <span style={{ color: "#48bb78", fontWeight: 600, fontSize: 14 }}>✅ Saved successfully!</span>
              )}
            </div>
          </div>
        ) : selectedYear && selectedFeesType ? (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
            <p style={{ color: "#a0aec0" }}>No students found for {selectedYear} - {userProfile?.dept}</p>
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💰</div>
            <p style={{ color: "#a0aec0" }}>Select Year and Fees Type to view students</p>
          </div>
        )}
      </main>
    </div>
  );
}