// src/pages/warden/Attendance.js
import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../supabase/supabaseAdapter";
import {
  collection, query, where, getDocs, doc, setDoc, getDoc
} from "../../supabase/supabaseAdapter";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import html2pdf from "html2pdf.js";
import * as XLSX from "xlsx";

// Generate room numbers
const ROOMS = Array.from({ length: 20 }, (_, i) => `${101 + i}`);
const STATUS_OPTIONS = ["Present", "Absent", "Leave"];

const statusColors = {
  Present: { bg: "rgba(72,187,120,0.15)", border: "rgba(72,187,120,0.4)", color: "#48bb78" },
  Absent: { bg: "rgba(252,129,129,0.15)", border: "rgba(252,129,129,0.4)", color: "#fc8181" },
  Leave: { bg: "rgba(245,166,35,0.15)", border: "rgba(245,166,35,0.4)", color: "#f5a623" }
};

export default function WardenAttendance() {
  const { userProfile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [tab, setTab] = useState("mark"); // mark | summary | report
  const [roomStudents, setRoomStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); // { roomNo: { studentId: status } }
  const [studentNames, setStudentNames] = useState({}); // { studentId: name }
  const [roomSummary, setRoomSummary] = useState({}); // saved rooms summary
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedRooms, setSavedRooms] = useState(new Set());
  const [allStudents, setAllStudents] = useState([]);
  const reportRef = useRef();

  // Fetch all hosteller students
  async function fetchAllStudents() {
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("studentType", "==", "hosteller")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllStudents(list);

      // Build name map
      const nameMap = {};
      list.forEach(s => { nameMap[s.id] = s.name; });
      setStudentNames(nameMap);
    } catch (err) {}
  }

  // Fetch students for selected room
  async function fetchRoomStudents(roomNo) {
    setFetching(true);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("studentType", "==", "hosteller"),
        where("roomNo", "==", roomNo)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setRoomStudents(list);

      // Fetch existing attendance for this room + date
      const docId = `hostel_${selectedDate}_room_${roomNo}`;
      const attDoc = await getDoc(doc(db, "hostel_attendance", docId));
      if (attDoc.exists()) {
        const records = attDoc.data().records || {};
        setAttendance(prev => ({ ...prev, [roomNo]: records }));
        setSavedRooms(prev => new Set([...prev, roomNo]));
      } else {
        // Default all present
        const defaultAtt = {};
        list.forEach(s => { defaultAtt[s.id] = "Present"; });
        setAttendance(prev => ({ ...prev, [roomNo]: defaultAtt }));
      }
    } catch (err) {}
    setFetching(false);
  }

  // Fetch all saved rooms summary for selected date
  async function fetchDaySummary() {
    setFetching(true);
    try {
      const q = query(
        collection(db, "hostel_attendance"),
        where("date", "==", selectedDate),
        where("type", "==", "room")
      );
      const snap = await getDocs(q);
      const summary = {};
      const saved = new Set();
      snap.docs.forEach(d => {
        const data = d.data();
        summary[data.roomNo] = data.records;
        saved.add(data.roomNo);
      });
      setRoomSummary(summary);
      setSavedRooms(saved);
    } catch (err) {}
    setFetching(false);
  }

  function setStudentStatus(roomNo, studentId, status) {
    setAttendance(prev => ({
      ...prev,
      [roomNo]: { ...(prev[roomNo] || {}), [studentId]: status }
    }));
  }

  function markAllInRoom(roomNo, status) {
    const updated = {};
    roomStudents.forEach(s => { updated[s.id] = status; });
    setAttendance(prev => ({ ...prev, [roomNo]: updated }));
  }

  async function saveRoomAttendance(roomNo) {
    setSaving(true);
    try {
      const records = attendance[roomNo] || {};
      const docId = `hostel_${selectedDate}_room_${roomNo}`;

      const presentCount = Object.values(records).filter(s => s === "Present").length;
      const absentCount = Object.values(records).filter(s => s === "Absent").length;
      const leaveCount = Object.values(records).filter(s => s === "Leave").length;

      await setDoc(doc(db, "hostel_attendance", docId), {
        date: selectedDate,
        roomNo,
        records,
        presentCount,
        absentCount,
        leaveCount,
        totalCount: Object.keys(records).length,
        wardenName: userProfile.name,
        markedAt: new Date().toISOString(),
        type: "room"
      });

      setSavedRooms(prev => new Set([...prev, roomNo]));
      setRoomSummary(prev => ({ ...prev, [roomNo]: records }));
    } catch (err) {}
    setSaving(false);
  }

  function getAttendanceRows() {
    const rows = [];
    Object.entries(roomSummary).forEach(([roomNo, records]) => {
      Object.entries(records).forEach(([studentId, status]) => {
        rows.push({
          name: studentNames[studentId] || studentId,
          room: `Room ${roomNo}`,
          status
        });
      });
    });
    return rows;
  }

  function downloadPDF() {
    const rows = getAttendanceRows();
    if (rows.length === 0) return;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #000; background: #fff;">
        <h1 style="color: #1a1a2e; margin-bottom: 5px;">🏠 Hostel Attendance Report</h1>
        <p style="margin: 4px 0;"><strong>Date:</strong> ${selectedDate} &nbsp;|&nbsp; <strong>Warden:</strong> ${userProfile?.name || 'Warden'}</p>
        <p style="margin: 4px 0;"><strong>Total Students Recorded:</strong> ${rows.length}</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <thead>
            <tr style="background: #1a1a2e; color: white;">
              <th style="padding: 10px; border: 1px solid #000; text-align: left;">S.No</th>
              <th style="padding: 10px; border: 1px solid #000; text-align: left;">Name</th>
              <th style="padding: 10px; border: 1px solid #000; text-align: left;">Room</th>
              <th style="padding: 10px; border: 1px solid #000; text-align: left;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr>
                <td style="padding: 8px 10px; border: 1px solid #ddd;">${i + 1}</td>
                <td style="padding: 8px 10px; border: 1px solid #ddd; font-weight: bold;">${r.name}</td>
                <td style="padding: 8px 10px; border: 1px solid #ddd;">${r.room}</td>
                <td style="padding: 8px 10px; border: 1px solid #ddd; font-weight: bold; color: ${r.status === 'Present' ? 'green' : r.status === 'Absent' ? 'red' : 'orange'};">${r.status}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    const opt = {
      margin: 10,
      filename: `Hostel_Attendance_${selectedDate}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(htmlContent).save();
  }

  function downloadExcel() {
    const rows = getAttendanceRows();
    if (rows.length === 0) return;

    try {
      const wb = XLSX.utils.book_new();
      const excelRows = [
        ["RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING"],
        ["HOSTEL ATTENDANCE REPORT"],
        [`Date: ${selectedDate}`, `Warden: ${userProfile?.name || 'Warden'}`],
        [],
        ["S.No", "Student Name", "Room Number", "Attendance Status", "Date"]
      ];

      rows.forEach((r, idx) => {
        excelRows.push([
          idx + 1,
          r.name,
          r.room,
          r.status,
          selectedDate
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(excelRows);
      ws['!cols'] = [
        { wch: 8 },
        { wch: 28 },
        { wch: 15 },
        { wch: 18 },
        { wch: 15 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
      XLSX.writeFile(wb, `Hostel_Attendance_${selectedDate}.xlsx`);
    } catch (err) {
      console.error(err);
    }
  }

  function downloadWord() {
    const rows = getAttendanceRows();
    if (rows.length === 0) return;

    try {
      const wordDocHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>Hostel Attendance - ${selectedDate}</title>
          <style>
            @page Section1 { size: 8.5in 11in; margin: 0.5in; }
            div.Section1 { page: Section1; font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
            th { background: #f2f2f2; }
          </style>
        </head>
        <body>
          <div class="Section1">
            <h2 style="text-align: center; margin-bottom: 4px;">RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING</h2>
            <h3 style="text-align: center; margin-top: 0; color: #e94560;">HOSTEL ATTENDANCE REPORT</h3>
            <p><strong>Date:</strong> ${selectedDate} &nbsp;|&nbsp; <strong>Warden:</strong> ${userProfile?.name || 'Warden'}</p>
            <p><strong>Total Students Recorded:</strong> ${rows.length}</p>
            <table>
              <thead>
                <tr>
                  <th style="width: 40px;">S.No</th>
                  <th>Student Name</th>
                  <th>Room</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((r, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td><strong>${r.name}</strong></td>
                    <td>${r.room}</td>
                    <td style="font-weight: bold; color: ${r.status === 'Present' ? 'green' : r.status === 'Absent' ? 'red' : 'orange'};">${r.status}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff', wordDocHtml], { type: 'application/msword;charset=utf-8' });
      const filename = `Hostel_Attendance_${selectedDate}.doc`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    fetchAllStudents();
  }, []);

  useEffect(() => {
    if (selectedRoom) fetchRoomStudents(selectedRoom);
  }, [selectedRoom, selectedDate]);

  useEffect(() => {
    fetchDaySummary();
  }, [selectedDate]);

  const currentRoomAtt = attendance[selectedRoom] || {};
  const presentCount = Object.values(currentRoomAtt).filter(s => s === "Present").length;
  const absentCount = Object.values(currentRoomAtt).filter(s => s === "Absent").length;
  const leaveCount = Object.values(currentRoomAtt).filter(s => s === "Leave").length;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>🏠 Hostel Attendance</h1>
          <p>Room-wise attendance — Warden only</p>
        </div>

        {/* Notice */}
        <div style={{ padding: "12px 20px", borderRadius: 12, marginBottom: 24, background: "rgba(66,153,225,0.1)", border: "1px solid rgba(66,153,225,0.3)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>ℹ️</span>
          <div style={{ color: "#4299e1", fontSize: 14 }}>
            <strong>Hostel Attendance only</strong> — College attendance la forward aagaathu. Warden mattum pakkuvan.
          </div>
        </div>

        {/* Date Selector */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="form-group" style={{ margin: 0, maxWidth: 280 }}>
            <label>📅 Select Date</label>
            <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setSelectedRoom(null); }} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {["mark", "summary", "report"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "10px 24px", borderRadius: 10, border: "none",
              cursor: "pointer", fontFamily: "Syne", fontWeight: 600, fontSize: 14,
              background: tab === t ? "#4299e1" : "rgba(255,255,255,0.07)",
              color: "white", transition: "all 0.2s"
            }}>
              {t === "mark" ? "✅ Mark Attendance" : t === "summary" ? `📊 Room Summary (${savedRooms.size})` : "📄 Final Report"}
            </button>
          ))}
        </div>

        {/* MARK ATTENDANCE TAB */}
        {tab === "mark" && (
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>

            {/* Room List */}
            <div className="card" style={{ height: "fit-content" }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 16, marginBottom: 16 }}>🏢 Select Room</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {ROOMS.map(room => (
                  <div
                    key={room}
                    onClick={() => setSelectedRoom(room)}
                    style={{
                      padding: "10px 6px", borderRadius: 10, textAlign: "center",
                      cursor: "pointer", transition: "all 0.2s", fontSize: 13, fontWeight: 600,
                      background: selectedRoom === room ? "#4299e1" :
                        savedRooms.has(room) ? "rgba(72,187,120,0.15)" : "rgba(255,255,255,0.05)",
                      border: selectedRoom === room ? "2px solid #4299e1" :
                        savedRooms.has(room) ? "1px solid rgba(72,187,120,0.4)" : "1px solid rgba(255,255,255,0.1)",
                      color: savedRooms.has(room) && selectedRoom !== room ? "#48bb78" : "white"
                    }}
                  >
                    {room}
                    {savedRooms.has(room) && <div style={{ fontSize: 10, marginTop: 2 }}>✓ Saved</div>}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, fontSize: 12, color: "#a0aec0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(72,187,120,0.3)", border: "1px solid rgba(72,187,120,0.4)" }}></div>
                  Attendance saved
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: "#4299e1" }}></div>
                  Selected room
                </div>
              </div>
            </div>

            {/* Student List */}
            <div>
              {!selectedRoom ? (
                <div className="card" style={{ textAlign: "center", padding: 60 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
                  <p style={{ color: "#a0aec0" }}>Select a room from the left to mark attendance</p>
                </div>
              ) : fetching ? (
                <div className="card" style={{ textAlign: "center", padding: 60 }}>
                  <div className="spinner" style={{ margin: "0 auto" }}></div>
                </div>
              ) : (
                <div className="card">
                  {/* Room Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <h3 style={{ fontFamily: "Syne", fontSize: 20, marginBottom: 4 }}>Room {selectedRoom}</h3>
                      <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                        <span style={{ color: "#48bb78" }}>✅ Present: {presentCount}</span>
                        <span style={{ color: "#fc8181" }}>❌ Absent: {absentCount}</span>
                        <span style={{ color: "#f5a623" }}>🏖️ Leave: {leaveCount}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => markAllInRoom(selectedRoom, "Present")} style={{
                        padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(72,187,120,0.3)",
                        background: "rgba(72,187,120,0.1)", color: "#48bb78", cursor: "pointer", fontSize: 12, fontWeight: 600
                      }}>✅ All Present</button>
                      <button onClick={() => markAllInRoom(selectedRoom, "Absent")} style={{
                        padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(252,129,129,0.3)",
                        background: "rgba(252,129,129,0.1)", color: "#fc8181", cursor: "pointer", fontSize: 12, fontWeight: 600
                      }}>❌ All Absent</button>
                    </div>
                  </div>

                  {/* No students */}
                  {roomStudents.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 40 }}>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                      <p style={{ color: "#a0aec0", fontSize: 14 }}>No hosteller students assigned to Room {selectedRoom}</p>
                      <p style={{ color: "#718096", fontSize: 12, marginTop: 8 }}>Students need to have roomNo: "{selectedRoom}" in their profile</p>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {roomStudents.map((student, idx) => {
                          const status = currentRoomAtt[student.id] || "Present";
                          return (
                            <div key={student.id} style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "14px 16px", borderRadius: 12, flexWrap: "wrap", gap: 12,
                              background: statusColors[status]?.bg,
                              border: `1px solid ${statusColors[status]?.border}`,
                              transition: "all 0.2s"
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{
                                  width: 36, height: 36, borderRadius: 10,
                                  background: statusColors[status]?.bg,
                                  border: `1px solid ${statusColors[status]?.border}`,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontFamily: "Syne", fontWeight: 800, fontSize: 14,
                                  color: statusColors[status]?.color
                                }}>
                                  {student.name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 15 }}>{student.name}</div>
                                  <div style={{ color: "#a0aec0", fontSize: 12 }}>{student.registerNo} • {student.dept} • {student.year}</div>
                                </div>
                              </div>

                              {/* Status Toggle */}
                              <div style={{ display: "flex", gap: 8 }}>
                                {STATUS_OPTIONS.map(s => (
                                  <button
                                    key={s}
                                    onClick={() => setStudentStatus(selectedRoom, student.id, s)}
                                    style={{
                                      padding: "8px 14px", borderRadius: 8, border: "none",
                                      cursor: "pointer", fontSize: 13, fontWeight: 600,
                                      background: status === s ? statusColors[s]?.color : "rgba(255,255,255,0.08)",
                                      color: status === s ? "white" : "#a0aec0",
                                      transition: "all 0.2s"
                                    }}
                                  >
                                    {s === "Present" ? "✅" : s === "Absent" ? "❌" : "🏖️"} {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Save Button */}
                      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center" }}>
                        <button
                          className="btn-primary"
                          onClick={() => saveRoomAttendance(selectedRoom)}
                          disabled={saving}
                          style={{ width: "auto", padding: "12px 32px" }}
                        >
                          {saving ? "Saving..." : `💾 Save Room ${selectedRoom} Attendance`}
                        </button>
                        {savedRooms.has(selectedRoom) && (
                          <span style={{ color: "#48bb78", fontWeight: 600, fontSize: 14 }}>✅ Saved!</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUMMARY TAB */}
        {tab === "summary" && (
          <div>
            {Object.keys(roomSummary).length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 60 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                <p style={{ color: "#a0aec0" }}>No rooms marked yet for {selectedDate}</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {Object.entries(roomSummary).sort().map(([roomNo, records]) => {
                  const students = Object.entries(records);
                  const present = students.filter(([, s]) => s === "Present").length;
                  const absent = students.filter(([, s]) => s === "Absent").length;
                  const leave = students.filter(([, s]) => s === "Leave").length;

                  return (
                    <div key={roomNo} className="card" style={{ borderLeft: "4px solid #4299e1" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                        <h3 style={{ fontFamily: "Syne", fontSize: 18 }}>🏢 Room {roomNo}</h3>
                        <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                          <span style={{ color: "#48bb78", fontWeight: 600 }}>✅ {present} Present</span>
                          <span style={{ color: "#fc8181", fontWeight: 600 }}>❌ {absent} Absent</span>
                          <span style={{ color: "#f5a623", fontWeight: 600 }}>🏖️ {leave} Leave</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {students.map(([studentId, status]) => (
                          <div key={studentId} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "10px 14px", borderRadius: 10,
                            background: statusColors[status]?.bg,
                            border: `1px solid ${statusColors[status]?.border}`
                          }}>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>
                              {studentNames[studentId] || studentId}
                            </span>
                            <span style={{ color: statusColors[status]?.color, fontWeight: 700, fontSize: 13 }}>
                              {status === "Present" ? "✅" : status === "Absent" ? "❌" : "🏖️"} {status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* FINAL REPORT TAB */}
        {tab === "report" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 20 }}>📄 Final Attendance Report — {selectedDate}</h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  onClick={downloadPDF}
                  disabled={Object.keys(roomSummary).length === 0}
                  style={{
                    padding: "10px 18px", borderRadius: 8, border: "none",
                    background: "#c53030",
                    color: "white", fontWeight: 600, fontSize: 13,
                    display: "flex", alignItems: "center", gap: 6,
                    cursor: Object.keys(roomSummary).length === 0 ? "not-allowed" : "pointer",
                    opacity: Object.keys(roomSummary).length === 0 ? 0.5 : 1
                  }}
                  title="Download Attendance Report as PDF"
                >
                  <Download size={15} /> Download PDF
                </button>
                <button
                  onClick={downloadExcel}
                  disabled={Object.keys(roomSummary).length === 0}
                  style={{
                    padding: "10px 18px", borderRadius: 8, border: "none",
                    background: "#107c41",
                    color: "white", fontWeight: 600, fontSize: 13,
                    display: "flex", alignItems: "center", gap: 6,
                    cursor: Object.keys(roomSummary).length === 0 ? "not-allowed" : "pointer",
                    opacity: Object.keys(roomSummary).length === 0 ? 0.5 : 1
                  }}
                  title="Download Attendance Report as Excel (.xlsx)"
                >
                  <FileSpreadsheet size={15} /> Download Excel
                </button>
                <button
                  onClick={downloadWord}
                  disabled={Object.keys(roomSummary).length === 0}
                  style={{
                    padding: "10px 18px", borderRadius: 8, border: "none",
                    background: "#2b579a",
                    color: "white", fontWeight: 600, fontSize: 13,
                    display: "flex", alignItems: "center", gap: 6,
                    cursor: Object.keys(roomSummary).length === 0 ? "not-allowed" : "pointer",
                    opacity: Object.keys(roomSummary).length === 0 ? 0.5 : 1
                  }}
                  title="Download Attendance Report as Word (.doc)"
                >
                  <FileText size={15} /> Download Word
                </button>
              </div>
            </div>

            {/* Stats */}
            {Object.keys(roomSummary).length > 0 && (() => {
              const allRecords = Object.values(roomSummary).flatMap(r => Object.values(r));
              const totalPresent = allRecords.filter(s => s === "Present").length;
              const totalAbsent = allRecords.filter(s => s === "Absent").length;
              const totalLeave = allRecords.filter(s => s === "Leave").length;
              return (
                <div className="stats-grid" style={{ marginBottom: 24 }}>
                  <div className="stat-card">
                    <div className="stat-icon">🏢</div>
                    <div className="stat-value">{Object.keys(roomSummary).length}</div>
                    <div className="stat-label">Rooms Marked</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">✅</div>
                    <div className="stat-value" style={{ color: "#48bb78" }}>{totalPresent}</div>
                    <div className="stat-label">Present</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">❌</div>
                    <div className="stat-value" style={{ color: "#fc8181" }}>{totalAbsent}</div>
                    <div className="stat-label">Absent</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">🏖️</div>
                    <div className="stat-value" style={{ color: "#f5a623" }}>{totalLeave}</div>
                    <div className="stat-label">On Leave</div>
                  </div>
                </div>
              );
            })()}

            {/* Report Table */}
            {Object.keys(roomSummary).length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 60 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                <p style={{ color: "#a0aec0" }}>No attendance data for {selectedDate}</p>
              </div>
            ) : (
              <div className="card">
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                        {["S.No", "Name", "Room", "Status"].map((h, i) => (
                          <th key={i} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const rows = [];
                        let idx = 1;
                        Object.entries(roomSummary).sort().forEach(([roomNo, records]) => {
                          Object.entries(records).forEach(([studentId, status]) => {
                            rows.push(
                              <tr key={`${roomNo}-${studentId}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <td style={{ padding: "12px 16px", color: "#a0aec0", fontSize: 14 }}>{idx++}</td>
                                <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 15 }}>{studentNames[studentId] || studentId}</td>
                                <td style={{ padding: "12px 16px" }}>
                                  <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "rgba(66,153,225,0.15)", color: "#4299e1" }}>
                                    Room {roomNo}
                                  </span>
                                </td>
                                <td style={{ padding: "12px 16px" }}>
                                  <span style={{
                                    padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                                    background: statusColors[status]?.bg,
                                    color: statusColors[status]?.color,
                                    border: `1px solid ${statusColors[status]?.border}`
                                  }}>
                                    {status === "Present" ? "✅" : status === "Absent" ? "❌" : "🏖️"} {status}
                                  </span>
                                </td>
                              </tr>
                            );
                          });
                        });
                        return rows;
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}