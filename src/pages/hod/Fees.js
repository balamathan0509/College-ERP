// src/pages/hod/Fees.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import * as XLSX from "xlsx";

const FEES_TYPES = ["College Fees", "Bus Fees", "Mess Fees", "Exam Fees", "Library Fees", "Other"];
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export default function HodFees() {
  const { userProfile } = useAuth();
  const [selectedYear, setSelectedYear] = useState("1st Year");
  const [selectedFeesType, setSelectedFeesType] = useState("College Fees");
  const [students, setStudents] = useState([]);
  const [feesData, setFeesData] = useState({});
  const [fetching, setFetching] = useState(false);

  async function fetchData() {
    setFetching(true);
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

      const feesQ = query(
        collection(db, "fees"),
        where("dept", "==", userProfile.dept),
        where("year", "==", selectedYear),
        where("feesType", "==", selectedFeesType)
      );
      const feesSnap = await getDocs(feesQ);
      if (!feesSnap.empty) {
        setFeesData(feesSnap.docs[0].data().payments || {});
      } else {
        setFeesData({});
      }
    } catch (err) {}
    setFetching(false);
  }

  function exportExcel() {
    const rows = students.map((s, i) => ({
      "S.No": i + 1,
      "Name": s.name,
      "Register No": s.registerNo,
      "Year": s.year,
      "Dept": s.dept,
      "Fees Type": selectedFeesType,
      "Status": feesData[s.id] ? "Collected" : "Pending"
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Fees Report");
    XLSX.writeFile(wb, `HOD_${userProfile.dept}_${selectedYear}_${selectedFeesType}.xlsx`);
  }

  useEffect(() => { fetchData(); }, [selectedYear, selectedFeesType]);

  const collected = students.filter(s => feesData[s.id]);
  const pending = students.filter(s => !feesData[s.id]);

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>💰 Fees Overview</h1>
          <p>{userProfile?.dept} Department — HOD View</p>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="form-row">
            <div className="form-group" style={{ margin: 0 }}>
              <label>Year</label>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Fees Type</label>
              <select value={selectedFeesType} onChange={e => setSelectedFeesType(e.target.value)}>
                {FEES_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{students.length}</div>
            <div className="stat-label">Total Students</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value" style={{ color: "#48bb78" }}>{collected.length}</div>
            <div className="stat-label">Collected</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">❌</div>
            <div className="stat-value" style={{ color: "#fc8181" }}>{pending.length}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-value" style={{ color: "#f5a623" }}>
              {students.length ? Math.round((collected.length / students.length) * 100) : 0}%
            </div>
            <div className="stat-label">Collection Rate</div>
          </div>
        </div>

        {fetching ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div className="spinner" style={{ margin: "0 auto" }}></div>
          </div>
        ) : (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18 }}>
                {selectedFeesType} — {selectedYear}
              </h3>
              <button onClick={exportExcel} style={{
                padding: "8px 20px", borderRadius: 8, border: "1px solid rgba(66,153,225,0.3)",
                background: "rgba(66,153,225,0.1)", color: "#4299e1", cursor: "pointer", fontSize: 13, fontWeight: 600
              }}>📊 Export Excel</button>
            </div>

            {/* Pending List */}
            {pending.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, color: "#fc8181", fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                  ❌ Pending ({pending.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pending.map((s, i) => (
                    <div key={s.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px 16px", borderRadius: 10,
                      background: "rgba(252,129,129,0.05)", border: "1px solid rgba(252,129,129,0.15)"
                    }}>
                      <div>
                        <span style={{ fontWeight: 600, marginRight: 12 }}>{i + 1}. {s.name}</span>
                        <span style={{ color: "#a0aec0", fontSize: 13 }}>{s.registerNo}</span>
                      </div>
                      <span style={{ color: "#fc8181", fontSize: 13, fontWeight: 600 }}>Pending</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Collected List */}
            {collected.length > 0 && (
              <div>
                <div style={{ fontSize: 13, color: "#48bb78", fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                  ✅ Collected ({collected.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {collected.map((s, i) => (
                    <div key={s.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px 16px", borderRadius: 10,
                      background: "rgba(72,187,120,0.05)", border: "1px solid rgba(72,187,120,0.15)"
                    }}>
                      <div>
                        <span style={{ fontWeight: 600, marginRight: 12 }}>{i + 1}. {s.name}</span>
                        <span style={{ color: "#a0aec0", fontSize: 13 }}>{s.registerNo}</span>
                      </div>
                      <span style={{ color: "#48bb78", fontSize: 13, fontWeight: 600 }}>Collected</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {students.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "#a0aec0" }}>
                No students found for this selection.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}