// src/pages/shared/CampusMap.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";

const BUILDINGS = [
  {
    id: "B1",
    name: "Block 1",
    label: "Main Academic Block",
    color: "#e94560",
    floors: [
      {
        floor: 0,
        rooms: [
          { id: "B1-GF1", name: "Office", type: "office", year: null },
          { id: "B1-GF2", name: "Computer Lab 1", type: "lab", year: null },
          { id: "B1-GF3", name: "CSE HOD Room", type: "hod", year: null },
          { id: "B1-GF4", name: "Dining Hall", type: "canteen", year: null },
          { id: "B1-GF5", name: "Chemistry Lab", type: "lab", year: null },
          { id: "B1-GF6", name: "Boys Restroom", type: "restroom", year: null },
          { id: "B1-GF7", name: "Girls Restroom", type: "restroom", year: null },
          { id: "B1-GF8", name: "Staff Room (PT)", type: "staff", year: null },
        ],
      },
      {
        floor: 1,
        rooms: [
          { id: "B1-101", name: "AIDS HOD Room", type: "hod", year: null },
          { id: "B1-102", name: "Computer Lab 2", type: "lab", year: null },
          { id: "B1-103", name: "AIDS Lab 1", type: "lab", year: null },
          { id: "B1-104", name: "AIDS Lab 2", type: "lab", year: null },
          { id: "B1-105", name: "AIDS 3rd Year", type: "classroom", year: "3rd Year" },
          { id: "B1-106", name: "AIDS 2nd Year", type: "classroom", year: "2nd Year" },
          { id: "B1-107", name: "CSE 4th Year", type: "classroom", year: "4th Year" },
          { id: "B1-108", name: "Auditorium", type: "auditorium", year: null },
          { id: "B1-109", name: "Canteen", type: "canteen", year: null },
          { id: "B1-110", name: "MECH 2nd Year", type: "classroom", year: "2nd Year" },
          { id: "B1-111", name: "MECH Staff Room", type: "staff", year: null },
          { id: "B1-112", name: "AIDS Staff Room", type: "staff", year: null },
          { id: "B1-113", name: "Boys Restroom", type: "restroom", year: null },
          { id: "B1-114", name: "Girls Restroom", type: "restroom", year: null },
        ],
      },
      {
        floor: 2,
        rooms: [
          { id: "B1-201", name: "CSE 3rd Year A", type: "classroom", year: "3rd Year" },
          { id: "B1-202", name: "CSE 2nd Year A", type: "classroom", year: "2nd Year" },
          { id: "B1-203", name: "CSE 2nd Year B", type: "classroom", year: "2nd Year" },
          { id: "B1-204", name: "ECE 2nd Year", type: "classroom", year: "2nd Year" },
          { id: "B1-205", name: "CSE 3rd Year B", type: "classroom", year: "3rd Year" },
          { id: "B1-206", name: "MECH 3rd Year", type: "classroom", year: "3rd Year" },
          { id: "B1-207", name: "EEE 3rd Year", type: "classroom", year: "3rd Year" },
          { id: "B1-208", name: "CSE Staff Room", type: "staff", year: null },
          { id: "B1-209", name: "ECE Staff Room", type: "staff", year: null },
          { id: "B1-210", name: "ECE HOD Room", type: "hod", year: null },
          { id: "B1-211", name: "Boys Restroom", type: "restroom", year: null },
          { id: "B1-212", name: "Girls Restroom", type: "restroom", year: null },
        ],
      },
    ],
  },
  {
    id: "B2",
    name: "Block 2",
    label: "Engineering Block",
    color: "#4299e1",
    floors: [
      {
        floor: 0,
        rooms: [
          { id: "B2-GF1", name: "MECH Lab", type: "lab", year: null },
          { id: "B2-GF2", name: "EEE Lab", type: "lab", year: null },
          { id: "B2-GF3", name: "EEE 4th Year", type: "classroom", year: "4th Year" },
          { id: "B2-GF4", name: "EEE HOD Room", type: "hod", year: null },
          { id: "B2-GF5", name: "EEE 1st Year", type: "classroom", year: "1st Year" },
        ],
      },
      {
        floor: 1,
        rooms: [
          { id: "B2-101", name: "ECE Lab 1", type: "lab", year: null },
          { id: "B2-102", name: "CSE 1st Year A", type: "classroom", year: "1st Year" },
          { id: "B2-103", name: "CSE 1st Year B", type: "classroom", year: "1st Year" },
          { id: "B2-104", name: "ECE 1st Year", type: "classroom", year: "1st Year" },
          { id: "B2-105", name: "ECE Lab 2", type: "lab", year: null },
          { id: "B2-106", name: "MECH 1st Year", type: "classroom", year: "1st Year" },
          { id: "B2-107", name: "ECE 1st Year B", type: "classroom", year: "1st Year" },
        ],
      },
    ],
  },
];

const ROOM_TYPE_CONFIG = {
  classroom: { icon: "🎓", label: "Classroom" },
  lab:       { icon: "💻", label: "Lab" },
  staff:     { icon: "👨‍🏫", label: "Staff Room" },
  hod:       { icon: "🏛️", label: "HOD Room" },
  seminar:   { icon: "🎤", label: "Seminar Hall" },
  library:   { icon: "📚", label: "Library" },
  admin:     { icon: "🏢", label: "Admin" },
  workshop:  { icon: "🔧", label: "Workshop" },
  canteen:   { icon: "🍽️", label: "Canteen" },
  office:    { icon: "🏢", label: "Office" },
  restroom:  { icon: "🚻", label: "Restroom" },
  auditorium:{ icon: "🎭", label: "Auditorium" },
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getCurrentPeriod() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const total = h * 60 + m;
  const ranges = [
    [9*60+10, 9*60+55, "9:10 - 9:55"],
    [9*60+55, 10*60+40, "9:55 - 10:40"],
    [11*60+0, 11*60+45, "11:00 - 11:45"],
    [11*60+45, 12*60+30, "11:45 - 12:30"],
    [13*60+30, 14*60+15, "1:30 - 2:15"],
    [14*60+15, 15*60+0, "2:15 - 3:00"],
    [15*60+0, 15*60+45, "3:00 - 3:45"],
    [15*60+45, 16*60+20, "3:45 - 4:20"],
  ];
  for (const [start, end, label] of ranges) {
    if (total >= start && total <= end) return label;
  }
  return null;
}

function getCurrentDay() {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

export default function CampusMap() {
  const { userProfile } = useAuth();
  const [selectedBuilding, setSelectedBuilding] = useState("B1");
  const [selectedFloor, setSelectedFloor] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [timetableData, setTimetableData] = useState({});
  const [currentPeriod, setCurrentPeriod] = useState(getCurrentPeriod());
  const [currentDay, setCurrentDay] = useState(getCurrentDay());
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [liveTime, setLiveTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(new Date());
      setCurrentPeriod(getCurrentPeriod());
      setCurrentDay(getCurrentDay());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchAll() {
      try {
        const snap = await getDocs(
          query(collection(db, "timetable"), where("type", "==", "Regular"))
        );
        const data = {};
        snap.docs.forEach(d => {
          const { dept, year, schedule } = d.data();
          data[`${dept}_${year}`] = schedule || {};
        });
        setTimetableData(data);
      } catch (e) {
        console.error("CampusMap timetable fetch failed", e);
      }
    }
    fetchAll();
  }, []);

  function getRoomStatus(room) {
    if (["staff", "hod", "admin", "library", "canteen", "office", "restroom", "auditorium"].includes(room.type)) return "permanent";
    if (!currentPeriod || !DAYS.includes(currentDay)) return "free";
    if (!room.year) return "free";

    const key = `${userProfile?.dept}_${room.year}`;
    const schedule = timetableData[key] || {};
    const subject = schedule[currentDay]?.[currentPeriod];
    return subject ? "occupied" : "free";
  }

  function getRoomSubject(room) {
    if (!room.year || !currentPeriod) return null;
    const key = `${userProfile?.dept}_${room.year}`;
    const schedule = timetableData[key] || {};
    return schedule[currentDay]?.[currentPeriod] || null;
  }

  const building = BUILDINGS.find(b => b.id === selectedBuilding);
  const floorData = building?.floors.find(f => f.floor === selectedFloor);
  const allRooms = BUILDINGS.flatMap(b =>
    b.floors.flatMap(f =>
      f.rooms.map(r => ({ ...r, building: b.id, buildingName: b.name, floor: f.floor }))
    )
  );

  const searchResults = searchQuery.length > 1
    ? allRooms.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const totalRooms = allRooms.filter(r => ["classroom", "lab"].includes(r.type)).length;
  const freeRooms = allRooms.filter(r => ["classroom", "lab"].includes(r.type) && getRoomStatus(r) === "free").length;
  const occupiedRooms = totalRooms - freeRooms;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header" style={{ marginBottom: 8 }}>
          <h1>🗺️ Campus Map</h1>
          <p style={{ color: "#a0aec0" }}>
            {userProfile?.dept || "Campus"} — Live Room Status •{' '}
            <span style={{ color: "#48bb78", fontWeight: 700 }}>
              {liveTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
            {currentPeriod && (
              <span style={{ color: "#f5a623", marginLeft: 8 }}>
                📌 Current Period: {currentPeriod}
              </span>
            )}
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "Total Rooms", value: totalRooms, color: "#4299e1", icon: "🏫" },
            { label: "Free Now", value: freeRooms, color: "#48bb78", icon: "✅" },
            { label: "Occupied", value: occupiedRooms, color: "#e94560", icon: "🔴" },
          ].map(s => (
            <div key={s.label} className="card" style={{ flex: 1, minWidth: 120, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "Syne" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#a0aec0" }}>{s.label}</div>
              </div>
            </div>
          ))}

          <div className="card" style={{ flex: 2, minWidth: 200, padding: "10px 16px", position: "relative" }}>
            <input
              type="text"
              placeholder="🔍  Search room... (CSE, ECE, Lab, HOD)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: "100%", background: "transparent", border: "none",
                color: "white", fontSize: 14, fontFamily: "DM Sans", outline: "none",
              }}
            />
            {searchResults.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
                background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, marginTop: 4, overflow: "hidden",
              }}>
                {searchResults.map(r => {
                  const status = getRoomStatus(r);
                  return (
                    <div key={r.id}
                      onClick={() => {
                        setSelectedBuilding(r.building);
                        setSelectedFloor(r.floor);
                        setSelectedRoom(r);
                        setSearchQuery("");
                      }}
                      style={{
                        padding: "10px 16px", cursor: "pointer", display: "flex",
                        justifyContent: "space-between", alignItems: "center",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div>
                        <span style={{ fontWeight: 700, color: "white" }}>{r.name}</span>
                        <span style={{ color: "#a0aec0", fontSize: 12, marginLeft: 8 }}>
                          {r.buildingName} • {r.floor === 0 ? "Ground" : `Floor ${r.floor}`}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                        background: status === "free" ? "rgba(72,187,120,0.2)" : status === "occupied" ? "rgba(233,69,96,0.2)" : "rgba(255,255,255,0.1)",
                        color: status === "free" ? "#48bb78" : status === "occupied" ? "#e94560" : "#a0aec0",
                      }}>
                        {status === "permanent" ? "Always Open" : status === "free" ? "Free" : "Occupied"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 320 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {BUILDINGS.map(b => (
                <button key={b.id} onClick={() => { setSelectedBuilding(b.id); setSelectedFloor(b.floors[0]?.floor ?? 0); setSelectedRoom(null); }}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: 10, border: "none",
                    cursor: "pointer", fontFamily: "Syne", fontWeight: 700, fontSize: 13,
                    background: selectedBuilding === b.id ? b.color : "rgba(255,255,255,0.07)",
                    color: "white", transition: "all 0.2s",
                    boxShadow: selectedBuilding === b.id ? `0 4px 20px ${b.color}44` : "none",
                  }}>
                  {b.name}
                  <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>{b.label}</div>
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {building?.floors.map(f => (
                <button key={f.floor} onClick={() => { setSelectedFloor(f.floor); setSelectedRoom(null); }}
                  style={{
                    padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontFamily: "Syne", fontWeight: 600, fontSize: 13,
                    background: selectedFloor === f.floor ? building.color : "rgba(255,255,255,0.07)",
                    color: "white", transition: "all 0.2s",
                  }}>
                  {f.floor === 0 ? "Ground" : `Floor ${f.floor}`}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#a0aec0", marginBottom: 16 }}>
              <span>🟢 Free</span>
              <span>🔴 Occupied</span>
              <span>🔵 Permanent</span>
            </div>

            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 15 }}>
                  {building?.name} — {selectedFloor === 0 ? "Ground" : `Floor ${selectedFloor}`}
                </span>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#a0aec0" }}>
                  <span>🟢 Free</span>
                  <span>🔴 Occupied</span>
                  <span>🔵 Permanent</span>
                </div>
              </div>

              <svg viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", display: "block" }}>
                <rect width="500" height="320" fill="#0d0d1a" />
                <rect x="0" y="145" width="500" height="30" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                <text x="250" y="164" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="9" fontFamily="DM Sans">— CORRIDOR —</text>
                <rect x="460" y="60" width="32" height="200" rx="4" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <text x="476" y="155" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="DM Sans" transform="rotate(-90, 476, 155)">STAIRS</text>

                {floorData?.rooms.map((room, idx) => {
                  const status = getRoomStatus(room);
                  const subject = getRoomSubject(room);
                  const typeConf = ROOM_TYPE_CONFIG[room.type] || ROOM_TYPE_CONFIG.classroom;
                  const isSelected = selectedRoom?.id === room.id;
                  const perRow = Math.ceil(floorData.rooms.length / 2);
                  const row = idx < perRow ? 0 : 1;
                  const col = idx < perRow ? idx : idx - perRow;
                  const roomW = 100;
                  const roomH = 80;
                  const gap = 8;
                  const x = 10 + col * (roomW + gap);
                  const y = row === 0 ? 20 : 195;
                  const fillColor = status === "free" ? "rgba(72,187,120,0.12)" : status === "occupied" ? "rgba(233,69,96,0.12)" : "rgba(66,153,225,0.1)";
                  const strokeColor = isSelected ? building.color : status === "free" ? "#48bb78" : status === "occupied" ? "#e94560" : "#4299e1";
                  const dotColor = status === "free" ? "#48bb78" : status === "occupied" ? "#e94560" : "#4299e1";
                  return (
                    <g key={room.id} onClick={() => setSelectedRoom(isSelected ? null : { ...room, subject })} style={{ cursor: "pointer" }}>
                      <rect x={x} y={y} width={roomW} height={roomH} rx="6" fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 2 : 1} opacity={0.95} />
                      {isSelected && (
                        <rect x={x-2} y={y-2} width={roomW+4} height={roomH+4} rx="8" fill="none" stroke={building.color} strokeWidth="1" opacity="0.4" />
                      )}
                      <circle cx={x + roomW - 10} cy={y + 10} r="5" fill={dotColor} />
                      <text x={x + 12} y={y + 26} fontSize="16" fontFamily="DM Sans">{typeConf.icon}</text>
                      <text x={x + roomW / 2} y={y + 46} textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="Syne">{room.name}</text>
                      <text x={x + roomW / 2} y={y + 60} textAnchor="middle" fill={subject ? "#f5a623" : "rgba(255,255,255,0.35)"} fontSize="9" fontFamily="DM Sans">
                        {subject ? (subject.length > 12 ? subject.slice(0, 11) + "…" : subject) : typeConf.label}
                      </text>
                      {room.year && (
                        <text x={x + roomW / 2} y={y + 73} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="8" fontFamily="DM Sans">
                          {room.year}
                        </text>
                      )}
                    </g>
                  );
                })}

                <text x="480" y="315" textAnchor="end" fill="rgba(255,255,255,0.07)" fontSize="10" fontFamily="Syne">
                  {building?.name} • {selectedFloor === 0 ? "Ground" : `Floor ${selectedFloor}`}
                </text>
              </svg>
            </div>
          </div>

          <div style={{ width: 280, minWidth: 240, display: "flex", flexDirection: "column", gap: 16 }}>
            {selectedRoom ? (
              <div className="card" style={{ borderColor: building?.color, border: `1px solid ${building?.color}44` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 28 }}>{ROOM_TYPE_CONFIG[selectedRoom.type]?.icon}</div>
                    <h3 style={{ fontFamily: "Syne", fontSize: 20, margin: "6px 0 2px", color: "white" }}>{selectedRoom.name}</h3>
                    <p style={{ color: "#a0aec0", fontSize: 12, margin: 0 }}>
                      {building?.name} • {selectedFloor === 0 ? "Ground" : `Floor ${selectedFloor}`} • {ROOM_TYPE_CONFIG[selectedRoom.type]?.label}
                    </p>
                  </div>
                  <button onClick={() => setSelectedRoom(null)} style={{ background: "rgba(255,255,255,0.07)", border: "none", color: "#a0aec0", borderRadius: 8, width: 28, height: 28, cursor: "pointer", fontSize: 16 }}>×</button>
                </div>

                {(() => {
                  const status = getRoomStatus(selectedRoom);
                  const subject = getRoomSubject(selectedRoom);
                  return (
                    <div style={{
                      padding: "12px 16px", borderRadius: 10, marginBottom: 14,
                      background: status === "free" ? "rgba(72,187,120,0.1)" : status === "occupied" ? "rgba(233,69,96,0.1)" : "rgba(66,153,225,0.1)",
                      border: `1px solid ${status === "free" ? "rgba(72,187,120,0.3)" : status === "occupied" ? "rgba(233,69,96,0.3)" : "rgba(66,153,225,0.3)"}`,
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: status === "free" ? "#48bb78" : status === "occupied" ? "#e94560" : "#4299e1" }}>
                        {status === "free" ? "✅ Available Now" : status === "occupied" ? "🔴 In Use" : "🔵 Always Open"}
                      </div>
                      {subject && (
                        <div style={{ color: "#f5a623", fontSize: 13, marginTop: 4, fontWeight: 600 }}>📖 {subject}</div>
                      )}
                      {currentPeriod && status !== "permanent" && (
                        <div style={{ color: "#a0aec0", fontSize: 11, marginTop: 4 }}>⏰ {currentPeriod}</div>
                      )}
                    </div>
                  );
                })()}

                {[
                  { label: "Room ID", value: selectedRoom.id },
                  { label: "Type", value: ROOM_TYPE_CONFIG[selectedRoom.type]?.label },
                  { label: "Year", value: selectedRoom.year || "All" },
                  { label: "Today", value: currentDay },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
                    <span style={{ color: "#a0aec0" }}>{label}</span>
                    <span style={{ color: "white", fontWeight: 600 }}>{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card" style={{ textAlign: "center", padding: 32 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>👆</div>
                <p style={{ color: "#a0aec0", fontSize: 13 }}>Click any room on the map to see details</p>
              </div>
            )}

            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 14 }}>All Rooms</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {["all", "free", "occupied"].map(f => (
                    <button key={f} onClick={() => setFilterStatus(f)} style={{
                      padding: "3px 10px", borderRadius: 20, border: "none", cursor: "pointer",
                      fontSize: 11, fontWeight: 600,
                      background: filterStatus === f ? (f === "free" ? "#48bb78" : f === "occupied" ? "#e94560" : "#e94560") : "rgba(255,255,255,0.07)",
                      color: "white",
                    }}>{f}</button>
                  ))}
                </div>
              </div>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {allRooms
                  .filter(r => {
                    if (filterStatus === "free") return getRoomStatus(r) === "free";
                    if (filterStatus === "occupied") return getRoomStatus(r) === "occupied";
                    return true;
                  })
                  .map(r => {
                    const status = getRoomStatus(r);
                    const b = BUILDINGS.find(x => x.id === r.building);
                    return (
                      <div key={r.id}
                        onClick={() => { setSelectedBuilding(r.building); setSelectedFloor(r.floor); setSelectedRoom({ ...r, subject: getRoomSubject(r) }); }}
                        style={{
                          padding: "10px 16px", cursor: "pointer",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          background: selectedRoom?.id === r.id ? "rgba(255,255,255,0.05)" : "transparent",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                        onMouseLeave={e => e.currentTarget.style.background = selectedRoom?.id === r.id ? "rgba(255,255,255,0.05)" : "transparent"}
                      >
                        <div>
                          <span style={{ fontSize: 12 }}>{ROOM_TYPE_CONFIG[r.type]?.icon} </span>
                          <span style={{ color: "white", fontWeight: 600, fontSize: 13 }}>{r.name}</span>
                          <div style={{ color: "#a0aec0", fontSize: 10 }}>{b?.name} • {r.floor === 0 ? "Ground" : `F${r.floor}`}</div>
                        </div>
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: status === "free" ? "#48bb78" : status === "occupied" ? "#e94560" : "#4299e1",
                        }} />
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
