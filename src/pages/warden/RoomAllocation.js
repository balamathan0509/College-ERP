// src/pages/warden/RoomAllocation.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import {
  collection, query, where, getDocs, doc, updateDoc
} from "firebase/firestore";

const ROOMS = Array.from({ length: 20 }, (_, i) => `${101 + i}`);

export default function RoomAllocation() {
  const { userProfile } = useAuth();
  const [students, setStudents] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState("");
  const [savedMap, setSavedMap] = useState({});
  const [filterRoom, setFilterRoom] = useState("all");
  const [tab, setTab] = useState("allocate"); // allocate | roomview

  async function fetchStudents() {
    setFetching(true);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("studentType", "==", "hosteller")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(list);

      // Build saved room map
      const map = {};
      list.forEach(s => { if (s.roomNo) map[s.id] = s.roomNo; });
      setSavedMap(map);
    } catch (err) {}
    setFetching(false);
  }

  async function assignRoom(studentId, roomNo) {
    setSaving(studentId);
    try {
      await updateDoc(doc(db, "users", studentId), { roomNo });
      setSavedMap(prev => ({ ...prev, [studentId]: roomNo }));
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, roomNo } : s));
    } catch (err) {}
    setSaving("");
  }

  async function removeRoom(studentId) {
    setSaving(studentId);
    try {
      await updateDoc(doc(db, "users", studentId), { roomNo: "" });
      setSavedMap(prev => { const n = { ...prev }; delete n[studentId]; return n; });
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, roomNo: "" } : s));
    } catch (err) {}
    setSaving("");
  }

  useEffect(() => { fetchStudents(); }, []);

  const filtered = students
    .filter(s =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.registerNo?.toLowerCase().includes(search.toLowerCase())
    )
    .filter(s => filterRoom === "all" ? true : filterRoom === "unassigned" ? !s.roomNo : s.roomNo === filterRoom);

  // Room wise grouping
  const roomGroups = {};
  ROOMS.forEach(r => { roomGroups[r] = students.filter(s => s.roomNo === r); });

  const assignedCount = students.filter(s => s.roomNo).length;
  const unassignedCount = students.length - assignedCount;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>🏢 Room Allocation</h1>
          <p>Assign hosteller students to rooms</p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{students.length}</div>
            <div className="stat-label">Total Hostelites</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value" style={{ color: "#48bb78" }}>{assignedCount}</div>
            <div className="stat-label">Room Assigned</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-value" style={{ color: "#fc8181" }}>{unassignedCount}</div>
            <div className="stat-label">Not Assigned</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏢</div>
            <div className="stat-value" style={{ color: "#4299e1" }}>{ROOMS.filter(r => roomGroups[r]?.length > 0).length}</div>
            <div className="stat-label">Rooms Used</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          {["allocate", "roomview"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "10px 24px", borderRadius: 10, border: "none",
              cursor: "pointer", fontFamily: "Syne", fontWeight: 600, fontSize: 14,
              background: tab === t ? "#4299e1" : "rgba(255,255,255,0.07)",
              color: "white", transition: "all 0.2s"
            }}>
              {t === "allocate" ? "🏠 Allocate Rooms" : "🏢 Room View"}
            </button>
          ))}
        </div>

        {/* ALLOCATE TAB */}
        {tab === "allocate" && (
          <>
            {/* Search + Filter */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Search Student</label>
                  <input
                    type="text"
                    placeholder="Name or Register No..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Filter by Room</label>
                  <select value={filterRoom} onChange={e => setFilterRoom(e.target.value)}>
                    <option value="all">All Students</option>
                    <option value="unassigned">⚠️ Not Assigned</option>
                    {ROOMS.map(r => <option key={r} value={r}>Room {r}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {fetching ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 60 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
                <p style={{ color: "#a0aec0" }}>No hosteller students found.</p>
                <p style={{ color: "#718096", fontSize: 13, marginTop: 8 }}>Students must signup as "Hosteller" to appear here.</p>
              </div>
            ) : (
              <div className="card">
                <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 20 }}>
                  Students ({filtered.length})
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filtered.map((student) => (
                    <div key={student.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "14px 16px", borderRadius: 12, flexWrap: "wrap", gap: 12,
                      background: student.roomNo ? "rgba(72,187,120,0.05)" : "rgba(255,255,255,0.03)",
                      border: student.roomNo ? "1px solid rgba(72,187,120,0.2)" : "1px solid rgba(255,255,255,0.08)"
                    }}>
                      {/* Student Info */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                        {student.photoURL ? (
                          <img src={student.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover" }} />
                        ) : (
                          <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: "rgba(66,153,225,0.15)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "Syne", fontWeight: 800, fontSize: 16, color: "#4299e1"
                          }}>
                            {student.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{student.name}</div>
                          <div style={{ color: "#a0aec0", fontSize: 12 }}>
                            {student.registerNo} • {student.dept} • {student.year}
                          </div>
                        </div>
                      </div>

                      {/* Room Assign */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {student.roomNo && (
                          <span style={{
                            padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                            background: "rgba(72,187,120,0.15)", color: "#48bb78",
                            border: "1px solid rgba(72,187,120,0.3)"
                          }}>
                            🏢 Room {student.roomNo}
                          </span>
                        )}
                        <select
                          value={student.roomNo || ""}
                          onChange={e => {
                            if (e.target.value) assignRoom(student.id, e.target.value);
                            else removeRoom(student.id);
                          }}
                          disabled={saving === student.id}
                          style={{
                            padding: "8px 12px", background: "rgba(255,255,255,0.07)",
                            border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
                            color: "white", fontSize: 13, outline: "none", fontFamily: "DM Sans",
                            cursor: "pointer"
                          }}
                        >
                          <option value="">Assign Room</option>
                          {ROOMS.map(r => (
                            <option key={r} value={r}>Room {r}</option>
                          ))}
                        </select>
                        {saving === student.id && (
                          <span style={{ color: "#f5a623", fontSize: 13 }}>Saving...</span>
                        )}
                        {student.roomNo && saving !== student.id && (
                          <button
                            onClick={() => removeRoom(student.id)}
                            style={{
                              padding: "7px 12px", borderRadius: 8,
                              border: "1px solid rgba(252,129,129,0.3)",
                              background: "rgba(252,129,129,0.1)", color: "#fc8181",
                              cursor: "pointer", fontSize: 13
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ROOM VIEW TAB */}
        {tab === "roomview" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {ROOMS.map(room => {
              const roomStudents = roomGroups[room] || [];
              return (
                <div key={room} className="card" style={{
                  borderTop: `3px solid ${roomStudents.length > 0 ? "#4299e1" : "rgba(255,255,255,0.1)"}`,
                  opacity: roomStudents.length === 0 ? 0.5 : 1
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <h3 style={{ fontFamily: "Syne", fontSize: 16 }}>🏢 Room {room}</h3>
                    <span style={{
                      padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: roomStudents.length > 0 ? "rgba(66,153,225,0.15)" : "rgba(255,255,255,0.05)",
                      color: roomStudents.length > 0 ? "#4299e1" : "#a0aec0"
                    }}>
                      {roomStudents.length} student{roomStudents.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {roomStudents.length === 0 ? (
                    <p style={{ color: "#718096", fontSize: 13 }}>Empty room</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {roomStudents.map(s => (
                        <div key={s.id} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 12px", borderRadius: 8,
                          background: "rgba(66,153,225,0.08)", border: "1px solid rgba(66,153,225,0.15)"
                        }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 6,
                            background: "rgba(66,153,225,0.2)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, fontWeight: 800, color: "#4299e1"
                          }}>
                            {s.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                            <div style={{ color: "#a0aec0", fontSize: 11 }}>{s.registerNo} • {s.dept}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}