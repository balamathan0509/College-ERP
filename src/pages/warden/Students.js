// src/pages/warden/Students.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";

const YEARS = ["All Years", "1st Year", "2nd Year", "3rd Year", "4th Year"];

export default function WardenStudents() {
  const { userProfile } = useAuth();
  const [students, setStudents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [selectedYear, setSelectedYear] = useState("All Years");
  const [search, setSearch] = useState("");

  async function fetchStudents() {
    setFetching(true);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", userProfile.dept)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(list);
    } catch (err) {}
    setFetching(false);
  }

  useEffect(() => { fetchStudents(); }, []);

  const filtered = students
    .filter(s => selectedYear === "All Years" || s.year === selectedYear)
    .filter(s =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.registerNo?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>👥 Student Details</h1>
          <p>{userProfile?.dept} Department — View Only</p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          {["1st Year", "2nd Year", "3rd Year", "4th Year"].map(y => (
            <div key={y} className="stat-card">
              <div className="stat-icon">🎓</div>
              <div className="stat-value">{students.filter(s => s.year === y).length}</div>
              <div className="stat-label">{y}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="form-row">
            <div className="form-group" style={{ margin: 0 }}>
              <label>Search</label>
              <input
                type="text"
                placeholder="Search by name or register no..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Filter by Year</label>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18 }}>
                Students — {selectedYear} ({filtered.length})
              </h3>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    {["S.No", "Name", "Register No", "Year", "Phone"].map((h, i) => (
                      <th key={i} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#a0aec0" }}>No students found.</td>
                    </tr>
                  ) : filtered.map((s, idx) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 14 }}>{idx + 1}</td>
                      <td style={{ padding: "14px 16px", fontWeight: 600, fontSize: 15 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {s.photoURL ? (
                            <img src={s.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(233,69,96,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#e94560" }}>
                              {s.name?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {s.name}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 14 }}>{s.registerNo}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "rgba(66,153,225,0.15)", color: "#4299e1" }}>{s.year}</span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 14 }}>{s.phone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}