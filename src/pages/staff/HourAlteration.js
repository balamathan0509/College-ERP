import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from "../../supabase/supabaseAdapter";
import toast, { Toaster } from "react-hot-toast";
import { ArrowLeftRight, Clock, CheckCircle2, XCircle, Send, UserCheck, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function HourAlteration() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("request"); // "request", "received", "sent"
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dayName, setDayName] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState("");
  const [facultyList, setFacultyList] = useState([]);
  const [selectedSubstituteId, setSelectedSubstituteId] = useState("");
  const [reason, setReason] = useState("");

  // Lists
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);

  // Calculate day from selected date
  useEffect(() => {
    if (selectedDate) {
      const d = new Date(selectedDate);
      const computedDay = DAYS[d.getDay()];
      setDayName(computedDay);
      fetchMySlotsForDay(computedDay);
    }
  }, [selectedDate, userProfile]);

  // Load faculty in department for substitution
  useEffect(() => {
    fetchDepartmentFaculty();
    fetchAlterationRequests();
  }, [userProfile]);

  async function fetchDepartmentFaculty() {
    try {
      const q = query(collection(db, "users"), where("role", "in", ["staff", "hod"]));
      const snap = await getDocs(q);
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(f => f.id !== userProfile?.uid); // Exclude self
      setFacultyList(list);
    } catch (err) {
      console.error("Error loading faculty list:", err);
    }
  }

  async function fetchMySlotsForDay(day) {
    if (!userProfile?.uid || !day || day === "Sunday") {
      setAvailableSlots([]);
      return;
    }
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "timetable_slots"));
      const userUid = userProfile.uid;
      const userName = (userProfile.name || "").trim().toLowerCase();
      const userEmail = (userProfile.email || "").trim().toLowerCase();

      const slots = [];
      snap.docs.forEach(d => {
        const data = d.data();
        if (!data || data.day !== day) return;

        const staffUid = data.staff_uid;
        const staffName = (data.staff_name || "").trim().toLowerCase();
        const staffEmail = (data.staff_email || "").trim().toLowerCase();

        const matches = (staffUid && String(staffUid) === String(userUid)) ||
          (staffEmail && staffEmail === userEmail) ||
          (staffName && userName && (staffName === userName || staffName.includes(userName) || userName.includes(staffName)));

        if (matches) {
          slots.push({ id: d.id, ...data });
        }
      });

      // Sort by period
      slots.sort((a, b) => Number(a.period) - Number(b.period));
      setAvailableSlots(slots);
      if (slots.length > 0) setSelectedSlotIndex("0");
      else setSelectedSlotIndex("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch slots for this day.");
    }
    setLoading(false);
  }

  async function fetchAlterationRequests() {
    if (!userProfile?.uid) return;
    try {
      // Received requests (where user is substitute)
      const recQ = query(collection(db, "hour_alterations"), where("substituteFacultyId", "==", userProfile.uid));
      const recSnap = await getDocs(recQ);
      const recList = recSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      recList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setReceivedRequests(recList);

      // Sent requests (where user is original faculty)
      const sentQ = query(collection(db, "hour_alterations"), where("originalFacultyId", "==", userProfile.uid));
      const sentSnap = await getDocs(sentQ);
      const sList = sentSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      sList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setSentRequests(sList);
    } catch (err) {
      console.error("Error fetching alteration requests:", err);
    }
  }

  async function handleSubmitAlteration(e) {
    e.preventDefault();
    if (!selectedSlotIndex || selectedSlotIndex === "" || !availableSlots[Number(selectedSlotIndex)]) {
      toast.error("Please select a period slot to alter.");
      return;
    }
    if (!selectedSubstituteId) {
      toast.error("Please select a substitute faculty.");
      return;
    }

    const slot = availableSlots[Number(selectedSlotIndex)];
    const targetFaculty = facultyList.find(f => f.id === selectedSubstituteId);

    setSubmitting(true);
    try {
      const payload = {
        originalFacultyId: userProfile.uid,
        originalFacultyName: userProfile.name || "Faculty",
        originalFacultyEmail: userProfile.email || "",
        substituteFacultyId: targetFaculty.id,
        substituteFacultyName: targetFaculty.name || "Faculty",
        substituteFacultyEmail: targetFaculty.email || "",
        date: selectedDate,
        day: dayName,
        period: Number(slot.period),
        dept: slot.dept || userProfile.dept || "",
        year: slot.year || "",
        semester: slot.semester || "",
        section: slot.section || "A",
        subjectCode: slot.subject_code || "",
        subjectName: slot.subject_name || "",
        reason: reason.trim() || "Hourly leave / Duty adjustment",
        status: "Pending", // "Pending", "Approved", "Rejected"
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "hour_alterations"), payload);
      toast.success(`Alteration request sent to ${targetFaculty.name}!`);
      setReason("");
      setSelectedSubstituteId("");
      fetchAlterationRequests();
      setActiveTab("sent");
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit alteration request.");
    }
    setSubmitting(false);
  }

  async function handleUpdateStatus(requestId, newStatus) {
    try {
      await updateDoc(doc(db, "hour_alterations", requestId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Alteration marked as ${newStatus}!`);
      fetchAlterationRequests();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status.");
    }
  }

  async function handleCancelRequest(requestId) {
    if (!window.confirm("Cancel this alteration request?")) return;
    try {
      await deleteDoc(doc(db, "hour_alterations", requestId));
      toast.success("Alteration request cancelled.");
      fetchAlterationRequests();
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel request.");
    }
  }

  const pendingReceivedCount = receivedRequests.filter(r => r.status === "Pending").length;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />

        {/* Page Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(79, 70, 229, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#4f46e5" }}>
                <ArrowLeftRight size={24} />
              </div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text)" }}>Hour Alteration & Proxy Management</h1>
                <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 14 }}>
                  Swap or assign single lecture periods to colleague faculty during leave or official duty
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              className="btn-secondary"
              onClick={() => navigate("/staff/period-attendance")}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600 }}
            >
              <UserCheck size={16} /> Period Attendance <ArrowRight size={14} />
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate("/staff/classwork-record")}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600 }}
            >
              Classwork Logbook <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
          <button
            onClick={() => setActiveTab("request")}
            style={{
              padding: "12px 20px",
              border: "none",
              borderBottom: activeTab === "request" ? "3px solid #4f46e5" : "3px solid transparent",
              background: "transparent",
              color: activeTab === "request" ? "#4f46e5" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <Send size={16} /> Request Alteration
          </button>

          <button
            onClick={() => setActiveTab("received")}
            style={{
              padding: "12px 20px",
              border: "none",
              borderBottom: activeTab === "received" ? "3px solid #4f46e5" : "3px solid transparent",
              background: "transparent",
              color: activeTab === "received" ? "#4f46e5" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <Clock size={16} /> Received Requests
            {pendingReceivedCount > 0 && (
              <span style={{ background: "#ef4444", color: "#fff", fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>
                {pendingReceivedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("sent")}
            style={{
              padding: "12px 20px",
              border: "none",
              borderBottom: activeTab === "sent" ? "3px solid #4f46e5" : "3px solid transparent",
              background: "transparent",
              color: activeTab === "sent" ? "#4f46e5" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <CheckCircle2 size={16} /> My Sent Requests ({sentRequests.length})
          </button>
        </div>

        {/* TAB 1: Request Alteration Form */}
        {activeTab === "request" && (
          <div style={{ maxWidth: 760 }}>
            <div className="card" style={{ padding: 28 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: "var(--text)" }}>Assign Period to Substitute Faculty</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>
                Select the target date and period from your timetable, and choose the colleague to take your lecture and mark attendance.
              </p>

              <form onSubmit={handleSubmitAlteration} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Date Picker */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
                      Date of Alteration
                    </label>
                    <input
                      type="date"
                      className="input-field"
                      style={{ width: "100%", padding: "10px 14px", fontSize: 14 }}
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
                      Day of Week
                    </label>
                    <div style={{ padding: "11px 14px", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontWeight: 600, color: "#4f46e5" }}>
                      {dayName || "Select Date"}
                    </div>
                  </div>
                </div>

                {/* Period Slot Selection */}
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
                    Select Your Period Slot ({dayName})
                  </label>
                  {loading ? (
                    <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Loading your slots...</div>
                  ) : availableSlots.length === 0 ? (
                    <div style={{ padding: 20, background: "rgba(239, 68, 68, 0.05)", border: "1px dashed rgba(239, 68, 68, 0.3)", borderRadius: "var(--radius-md)", color: "#b91c1c", fontSize: 13 }}>
                      No scheduled timetable slots found for you on <strong>{dayName}</strong>. Check your timetable or choose another date.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                      {availableSlots.map((slot, idx) => {
                        const isSelected = selectedSlotIndex === String(idx);
                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedSlotIndex(String(idx))}
                            style={{
                              padding: "14px 16px",
                              borderRadius: "var(--radius-md)",
                              border: isSelected ? "2px solid #4f46e5" : "1px solid var(--border)",
                              background: isSelected ? "rgba(79, 70, 229, 0.08)" : "var(--bg-secondary)",
                              cursor: "pointer",
                              transition: "all 0.15s ease"
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontWeight: 700, fontSize: 14, color: isSelected ? "#4f46e5" : "var(--text)" }}>
                                Period {slot.period}
                              </span>
                              <span style={{ fontSize: 11, background: "rgba(0,0,0,0.06)", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                                {slot.dept} - Sem {slot.semester || slot.year} {slot.section ? `(${slot.section})` : ""}
                              </span>
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>
                              {slot.subject_code}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                              {slot.subject_name || "Course Lecture"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Substitute Faculty */}
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
                    Substitute Faculty (Who will take this lecture?)
                  </label>
                  <select
                    className="input-field"
                    style={{ width: "100%", padding: "10px 14px", fontSize: 14 }}
                    value={selectedSubstituteId}
                    onChange={e => setSelectedSubstituteId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Colleague Faculty --</option>
                    {facultyList.map(fac => (
                      <option key={fac.id} value={fac.id}>
                        {fac.name} ({fac.dept || "Faculty"} - {fac.designation || "Staff"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reason */}
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
                    Reason for Alteration (Optional)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: "100%", padding: "10px 14px", fontSize: 14 }}
                    placeholder="e.g., Casual Leave, Official Meeting, Exam Duty"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                  />
                </div>

                {/* Action button */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submitting || availableSlots.length === 0}
                    style={{ padding: "12px 32px", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <Send size={16} /> {submitting ? "Sending..." : "Submit Alteration Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: Received Requests */}
        {activeTab === "received" && (
          <div>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                Alteration requests assigned to you by other faculty members. When you accept, this hour will appear on your schedule and attendance sheet.
              </div>
            </div>

            {receivedRequests.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
                <Clock size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                <h3>No Alteration Requests Received</h3>
                <p style={{ fontSize: 13, marginTop: 4 }}>You have no pending or past hour alterations assigned to you.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {receivedRequests.map(req => {
                  const isPending = req.status === "Pending";
                  const isApproved = req.status === "Approved";
                  return (
                    <div
                      key={req.id}
                      className="card"
                      style={{
                        padding: "18px 22px",
                        borderLeft: isApproved ? "4px solid #16a34a" : isPending ? "4px solid #d97706" : "4px solid #dc2626",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 16
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>
                            Period {req.period} • {req.date} ({req.day})
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "3px 8px",
                              borderRadius: 6,
                              fontWeight: 700,
                              background: isApproved ? "rgba(22, 163, 74, 0.12)" : isPending ? "rgba(217, 119, 6, 0.12)" : "rgba(220, 38, 38, 0.12)",
                              color: isApproved ? "#16a34a" : isPending ? "#d97706" : "#dc2626"
                            }}
                          >
                            {req.status?.toUpperCase()}
                          </span>
                        </div>

                        <div style={{ fontSize: 13, color: "var(--text)" }}>
                          Requested by: <strong>{req.originalFacultyName}</strong> ({req.originalFacultyEmail || ""})
                        </div>

                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                          Subject: <strong style={{ color: "#4f46e5" }}>{req.subjectCode} - {req.subjectName}</strong> • Class: {req.dept} - Sem {req.semester || req.year} {req.section ? `(${req.section})` : ""}
                        </div>

                        {req.reason && (
                          <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                            Reason: "{req.reason}"
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {isPending ? (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(req.id, "Approved")}
                              style={{
                                background: "#16a34a",
                                color: "#fff",
                                border: "none",
                                padding: "8px 18px",
                                borderRadius: "var(--radius-md)",
                                fontWeight: 600,
                                fontSize: 13,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6
                              }}
                            >
                              <CheckCircle2 size={16} /> Accept Alteration
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(req.id, "Rejected")}
                              style={{
                                background: "transparent",
                                color: "#dc2626",
                                border: "1px solid rgba(220, 38, 38, 0.3)",
                                padding: "8px 18px",
                                borderRadius: "var(--radius-md)",
                                fontWeight: 600,
                                fontSize: 13,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6
                              }}
                            >
                              <XCircle size={16} /> Decline
                            </button>
                          </>
                        ) : isApproved ? (
                          <button
                            className="btn-secondary"
                            onClick={() => navigate(`/staff/period-attendance?date=${req.date}&period=${req.period}&dept=${req.dept}&year=${req.year || req.semester}&section=${req.section}&code=${req.subjectCode}`)}
                            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "8px 14px", fontWeight: 600 }}
                          >
                            <UserCheck size={14} /> Go to Period Attendance
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Sent Requests */}
        {activeTab === "sent" && (
          <div>
            <div style={{ marginBottom: 16, fontSize: 14, color: "var(--text-muted)" }}>
              Hour alterations requested by you to other colleagues.
            </div>

            {sentRequests.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
                <Send size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                <h3>No Alterations Requested</h3>
                <p style={{ fontSize: 13, marginTop: 4 }}>You have not sent any hour alteration requests.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {sentRequests.map(req => {
                  const isPending = req.status === "Pending";
                  const isApproved = req.status === "Approved";
                  return (
                    <div
                      key={req.id}
                      className="card"
                      style={{
                        padding: "18px 22px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 16
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>
                            Period {req.period} • {req.date} ({req.day})
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "3px 8px",
                              borderRadius: 6,
                              fontWeight: 700,
                              background: isApproved ? "rgba(22, 163, 74, 0.12)" : isPending ? "rgba(217, 119, 6, 0.12)" : "rgba(220, 38, 38, 0.12)",
                              color: isApproved ? "#16a34a" : isPending ? "#d97706" : "#dc2626"
                            }}
                          >
                            {req.status?.toUpperCase()}
                          </span>
                        </div>

                        <div style={{ fontSize: 13, color: "var(--text)" }}>
                          Assigned to Substitute: <strong>{req.substituteFacultyName}</strong>
                        </div>

                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                          Subject: <strong>{req.subjectCode} - {req.subjectName}</strong> • Class: {req.dept} - Sem {req.semester || req.year} {req.section ? `(${req.section})` : ""}
                        </div>

                        {req.reason && (
                          <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                            Reason: "{req.reason}"
                          </div>
                        )}
                      </div>

                      <div>
                        {isPending && (
                          <button
                            onClick={() => handleCancelRequest(req.id)}
                            style={{
                              background: "transparent",
                              color: "#dc2626",
                              border: "1px solid rgba(220, 38, 38, 0.3)",
                              padding: "6px 14px",
                              borderRadius: "var(--radius-md)",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer"
                            }}
                          >
                            Cancel Request
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
