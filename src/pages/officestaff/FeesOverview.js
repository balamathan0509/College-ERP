// src/pages/officestaff/FeesOverview.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, getDocs, query, where } from "firebase/firestore";
import * as XLSX from "xlsx";

const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIDS", "AIML"];
const FEES_TYPES = ["College Fees", "Bus Fees", "Mess Fees", "Exam Fees", "Library Fees", "Other"];

export default function FeesOverview() {
  const { userProfile } = useAuth();
  const [feesRecords, setFeesRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedFeesType, setSelectedFeesType] = useState("All");

  async function fetchAll() {
    setFetching(true);
    try {
      const feesSnap = await getDocs(collection(db, "fees"));
      const fees = feesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFeesRecords(fees);

      const studSnap = await getDocs(query(collection(db, "users"), where("role", "==", "student")));
      const studs = studSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudents(studs);
    } catch (err) {}
    setFetching(false);
  }

  useEffect(() => { fetchAll(); }, []);

  const filtered = feesRecords
    .filter(r => selectedDept === "All" || r.dept === selectedDept)
    .filter(r => selectedFeesType === "All" || r.feesType === selectedFeesType);

  function exportExcel() {
    const rows = [];
    filtered.forEach(record => {
      const deptStudents = students.filter(s => s.dept === record.dept && s.year === record.year);
      deptStudents.forEach((s, i) => {
        rows.push({
          "S.No": i + 1,
          "Name": s.name,
          "Register No": s.registerNo,
          "Dept": s.dept,
          "Year": s.year,
          "Fees Type": record.feesType,
          "Status": record.payments?.[s.id] ? "Collected" : "Pending"
        });
      });
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Fees Overview");
    XLSX.writeFile(wb, `Fees_Overview_${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  // Overall stats
  const totalCollected = feesRecords.reduce((acc, r) => acc + Object.values(r.payments || {}).filter(Boolean).length, 0);
  const totalPending = feesRecords.reduce((acc, r) => {
    const deptStudents = students.filter(s => s.dept === r.dept && s.year === r.year);
    return acc + (deptStudents.length - Object.values(r.payments || {}).filter(Boolean).length);
  }, 0);

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>📊 Fees Overview</h1>
          <p>All Departments — Office Staff</p>
        </div>

        {/* Overall Stats */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value" style={{ color: "#48bb78" }}>{totalCollected}</div>
            <div className="stat-label">Total Collected</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-value" style={{ color: "#fc8181" }}>{totalPending}</div>
            <div className="stat-label">Total Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏫</div>
            <div className="stat-value">{feesRecords.length}</div>
            <div className="stat-label">Fee Records</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{students.length}</div>
            <div className="stat-label">Total Students</div>
          </div>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="form-row">
            <div className="form-group" style={{ margin: 0 }}>
              <label>Department</label>
              <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)}>
                <option value="All">All Departments</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Fees Type</label>
              <select value={selectedFeesType} onChange={e => setSelectedFeesType(e.target.value)}>
                <option value="All">All Types</option>
                {FEES_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
        </div>

        {fetching ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div className="spinner" style={{ margin: "0 auto" }}></div>
          </div>
        ) : (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18 }}>Fees Summary</h3>
              <button onClick={exportExcel} style={{
                padding: "8px 20px", borderRadius: 8, border: "1px solid rgba(66,153,225,0.3)",
                background: "rgba(66,153,225,0.1)", color: "#4299e1", cursor: "pointer", fontSize: 13, fontWeight: 600
              }}>📊 Export Excel</button>
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#a0aec0" }}>No fees records found.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      {["Dept", "Year", "Fees Type", "Collected", "Pending", "Rate", "Updated By"].map((h, i) => (
                        <th key={i} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(record => {
                      const deptStudents = students.filter(s => s.dept === record.dept && s.year === record.year);
                      const collected = Object.values(record.payments || {}).filter(Boolean).length;
                      const pending = deptStudents.length - collected;
                      const rate = deptStudents.length ? Math.round((collected / deptStudents.length) * 100) : 0;
                      return (
                        <tr key={record.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <td style={{ padding: "14px 16px" }}>
                            <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "rgba(66,153,225,0.15)", color: "#4299e1" }}>{record.dept}</span>
                          </td>
                          <td style={{ padding: "14px 16px", color: "#e2e8f0", fontSize: 14 }}>{record.year}</td>
                          <td style={{ padding: "14px 16px", fontWeight: 600, fontSize: 14 }}>{record.feesType}</td>
                          <td style={{ padding: "14px 16px", color: "#48bb78", fontWeight: 700 }}>{collected}</td>
                          <td style={{ padding: "14px 16px", color: "#fc8181", fontWeight: 700 }}>{pending}</td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.1)" }}>
                                <div style={{ width: `${rate}%`, height: "100%", borderRadius: 3, background: rate > 75 ? "#48bb78" : rate > 50 ? "#f5a623" : "#fc8181" }}></div>
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 600, color: rate > 75 ? "#48bb78" : rate > 50 ? "#f5a623" : "#fc8181" }}>{rate}%</span>
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 13 }}>{record.updatedBy || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}