// src/pages/academics/AcademicCalendar.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import DateTimeHeader from "../../components/DateTimeHeader";
import { useAuth } from "../../context/AuthContext";
import { db, doc, setDoc, getDoc } from "../../supabase/supabaseAdapter";
import toast, { Toaster } from "react-hot-toast";
import { parsePdfToAcademicEvents } from "../../utils/pdfCalendarParser";
import {
  Calendar as CalendarIcon,
  Upload,
  FileText,
  Download,
  Eye,
  Trash2,
  AlertTriangle,
  Clock,
  Sparkles,
  BookOpen,
  Filter,
  X,
  Lock,
  Zap,
  CheckCircle2
} from "lucide-react";

const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AI&DS"];
const EVENT_TYPES = [
  { label: "Internal Exam / CIA", value: "exam", icon: "📝", color: "#dc2626", bg: "#fef2f2" },
  { label: "Holiday / Vacation", value: "holiday", icon: "🏖️", color: "#d97706", bg: "#fffbeb" },
  { label: "College / Dept Event", value: "event", icon: "🎉", color: "#2563eb", bg: "#eff6ff" },
  { label: "Industrial Visit / Workshop", value: "iv", icon: "🚀", color: "#7c3aed", bg: "#f5f3ff" },
  { label: "Academic Milestone", value: "milestone", icon: "📌", color: "#059669", bg: "#ecfdf5" }
];

export default function AcademicCalendar() {
  const { userProfile, isSuperAdmin } = useAuth();

  const userDept = userProfile?.dept || "CSE";
  const userRole = isSuperAdmin ? "admin" : (userProfile?.role || "staff");
  const isHod = userRole === "hod" || isSuperAdmin;
  const isSuperUser = isSuperAdmin || userRole === "management" || userRole === "principal";

  const [selectedDept, setSelectedDept] = useState(userDept);
  const [loading, setLoading] = useState(true);
  const [calendarData, setCalendarData] = useState({ pdfUrl: null, pdfName: null, events: [] });

  // PDF Preview modal state
  const [showPdfModal, setShowPdfModal] = useState(false);

  // File upload state
  const [uploadingFile, setUploadingFile] = useState(false);
  const [parseStatus, setParseStatus] = useState("");

  useEffect(() => {
    if (userProfile?.dept && !isSuperUser) {
      setSelectedDept(userProfile.dept);
    }
  }, [userProfile, isSuperUser]);

  useEffect(() => {
    if (selectedDept) {
      fetchCalendar(selectedDept);
    }
  }, [selectedDept]);

  async function fetchCalendar(dept) {
    setLoading(true);
    try {
      const docRef = doc(db, "academic_calendars", dept.toUpperCase());
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const d = snap.data();
        setCalendarData({
          pdfUrl: d.pdfUrl || null,
          pdfName: d.pdfName || null,
          uploadedAt: d.uploadedAt || null,
          uploadedByName: d.uploadedByName || null,
          events: Array.isArray(d.events) ? d.events : []
        });
      } else {
        setCalendarData({ pdfUrl: null, pdfName: null, events: [] });
      }
    } catch (err) {
      toast.error("Failed to load academic calendar.");
    }
    setLoading(false);
  }

  // Handle PDF file upload: Automatically reads PDF text & extracts events
  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File size must be under 20MB.");
      return;
    }

    setUploadingFile(true);
    setParseStatus("Reading PDF content & extracting dates...");

    try {
      // 1. Read file as ArrayBuffer for PDF Text Parser
      const arrayBuffer = await file.arrayBuffer();
      let extractedEvents = [];
      
      try {
        extractedEvents = await parsePdfToAcademicEvents(arrayBuffer);
      } catch (pdfErr) {
        console.warn("Auto PDF parsing warning:", pdfErr);
      }

      // 2. Read file as Data URL for storing / viewing
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result;
        const updated = {
          ...calendarData,
          pdfUrl: base64Data,
          pdfName: file.name,
          uploadedAt: new Date().toISOString(),
          uploadedBy: userProfile?.uid,
          uploadedByName: userProfile?.name || "HOD",
          dept: selectedDept.toUpperCase(),
          events: extractedEvents
        };

        const docRef = doc(db, "academic_calendars", selectedDept.toUpperCase());
        await setDoc(docRef, updated, { merge: true });

        setCalendarData(updated);
        setUploadingFile(false);
        setParseStatus("");

        if (extractedEvents.length > 0) {
          toast.success(`PDF Uploaded! Automatically extracted ${extractedEvents.length} events from calendar.`);
        } else {
          toast.success(`Academic Calendar file "${file.name}" uploaded successfully!`);
        }
      };

      reader.onerror = () => {
        toast.error("Failed to read file.");
        setUploadingFile(false);
        setParseStatus("");
      };

      reader.readAsDataURL(file);
    } catch (err) {
      toast.error("Upload failed.");
      setUploadingFile(false);
      setParseStatus("");
    }
  }

  // Delete Event from Extracted Events List
  async function handleDeleteEvent(eventId) {
    if (!window.confirm("Are you sure you want to remove this event from the active calendar rules?")) return;

    try {
      const updatedEvents = (calendarData.events || []).filter(e => e.id !== eventId);
      const docRef = doc(db, "academic_calendars", selectedDept.toUpperCase());
      await setDoc(docRef, { ...calendarData, events: updatedEvents }, { merge: true });

      setCalendarData(prev => ({ ...prev, events: updatedEvents }));
      toast.success("Event removed.");
    } catch (err) {
      toast.error("Failed to remove event.");
    }
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const upcomingEvents = (calendarData.events || []).filter(e => (e.endDate || e.startDate) >= todayStr);
  const pastEvents = (calendarData.events || []).filter(e => (e.endDate || e.startDate) < todayStr);

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <DateTimeHeader />

        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CalendarIcon size={28} color="#2563eb" /> Academic Calendar
            </h1>
            <p>Automatic PDF Calendar Parser & ERP Attendance Controls</p>
          </div>

          {/* Department Display / Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isSuperUser ? (
              <>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                  <Filter size={16} /> Department:
                </span>
                <select
                  value={selectedDept}
                  onChange={e => setSelectedDept(e.target.value)}
                  className="input-field"
                  style={{ width: "auto", minWidth: 140, fontWeight: 700, padding: "8px 14px" }}
                >
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d} Department</option>
                  ))}
                </select>
              </>
            ) : (
              <span style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#1d4ed8",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                padding: "8px 18px",
                borderRadius: 20,
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}>
                <BookOpen size={16} color="#2563eb" /> {selectedDept} Department Academic Calendar
              </span>
            )}
          </div>
        </div>

        {/* Info Banner */}
        <div style={{
          padding: "16px 20px",
          borderRadius: 12,
          background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
          border: "1px solid #bfdbfe",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 16,
          color: "#1e40af"
        }}>
          <Zap size={24} color="#2563eb" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 13, lineHeight: "1.5" }}>
            <strong>Automatic PDF Calendar Extraction:</strong> Simply upload the <strong>{selectedDept} Academic Calendar PDF</strong>. The ERP will automatically read the PDF text, extract all exam and holiday dates, and govern attendance rules automatically without any manual data entry!
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
            <Clock size={32} style={{ marginBottom: 12, opacity: 0.6 }} />
            <div>Loading Academic Calendar for {selectedDept}...</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
            
            {/* LEFT COLUMN: PDF Document Upload & Status */}
            <div>
              <div className="card" style={{ height: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <FileText size={20} color="#2563eb" /> Upload Department PDF Calendar
                  </h3>
                  {isHod && (
                    <span style={{ fontSize: 11, background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 12, fontWeight: 700 }}>
                      HOD Access
                    </span>
                  )}
                </div>

                {calendarData.pdfUrl ? (
                  <div style={{
                    padding: 20,
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    textAlign: "center"
                  }}>
                    <FileText size={48} color="#2563eb" style={{ marginBottom: 12 }} />
                    <h4 style={{ margin: "0 0 6px 0", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                      {calendarData.pdfName || `${selectedDept}_Academic_Calendar.pdf`}
                    </h4>
                    {calendarData.uploadedAt && (
                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
                        Uploaded by {calendarData.uploadedByName || "HOD"} on {new Date(calendarData.uploadedAt).toLocaleDateString()}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
                      <button
                        className="btn-primary"
                        onClick={() => setShowPdfModal(true)}
                        style={{ width: "auto", padding: "8px 18px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <Eye size={16} /> Preview Document
                      </button>
                      <a
                        href={calendarData.pdfUrl}
                        download={calendarData.pdfName || `${selectedDept}_Academic_Calendar.pdf`}
                        className="btn-secondary"
                        style={{ width: "auto", padding: "8px 18px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
                      >
                        <Download size={16} /> Download PDF
                      </a>
                    </div>

                    {isHod && (
                      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
                        <label className="btn-secondary" style={{ width: "auto", padding: "8px 18px", fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Upload size={16} /> Upload New PDF Calendar
                          <input type="file" accept=".pdf,image/*,.doc,.docx" onChange={handleFileUpload} style={{ display: "none" }} disabled={uploadingFile} />
                        </label>
                        {uploadingFile && (
                          <div style={{ fontSize: 12, color: "#2563eb", marginTop: 8, fontWeight: 600 }}>
                            {parseStatus || "Processing PDF..."}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    padding: "40px 20px",
                    borderRadius: 12,
                    border: "2px dashed #cbd5e1",
                    background: "#f8fafc",
                    textAlign: "center"
                  }}>
                    <Upload size={44} color="#2563eb" style={{ marginBottom: 12 }} />
                    <h4 style={{ margin: "0 0 6px 0", color: "#0f172a", fontSize: 16, fontWeight: 700 }}>
                      Upload {selectedDept} Academic Calendar PDF
                    </h4>
                    <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px 0" }}>
                      Upload your official Academic Calendar PDF file. The system will automatically read the PDF text and detect all exam/holiday dates!
                    </p>

                    {isHod ? (
                      <label className="btn-primary" style={{ width: "auto", padding: "12px 28px", fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <Upload size={20} /> {uploadingFile ? "Parsing PDF..." : "Select & Upload PDF File"}
                        <input type="file" accept=".pdf,image/*,.doc,.docx" onChange={handleFileUpload} style={{ display: "none" }} disabled={uploadingFile} />
                      </label>
                    ) : (
                      <div style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <Lock size={14} /> Upload permission restricted to HOD
                      </div>
                    )}

                    {uploadingFile && (
                      <div style={{ fontSize: 13, color: "#2563eb", marginTop: 14, fontWeight: 600 }}>
                        {parseStatus || "Parsing PDF content..."}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Automatically Extracted Events & Rules */}
            <div>
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                      <Zap size={20} color="#2563eb" /> Automatically Extracted Events
                    </h3>
                    <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
                      {calendarData.events.length} event date rule(s) parsed from PDF for {selectedDept}
                    </p>
                  </div>

                  {calendarData.events.length > 0 && (
                    <span style={{ fontSize: 11, background: "#dcfce7", color: "#166534", padding: "3px 10px", borderRadius: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={12} /> Active Sync
                    </span>
                  )}
                </div>

                {/* Event List */}
                {calendarData.events.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", background: "#f8fafc", borderRadius: 8, color: "#64748b" }}>
                    <Sparkles size={36} style={{ marginBottom: 8, opacity: 0.5, color: "#2563eb" }} />
                    <div style={{ fontWeight: 600, color: "#334155" }}>No events extracted yet</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      Upload a PDF file on the left. The ERP will read and display all exam and holiday dates automatically here!
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 450, overflowY: "auto", paddingRight: 4 }}>
                    {upcomingEvents.map(evt => {
                      const typeObj = EVENT_TYPES.find(t => t.value === evt.type) || EVENT_TYPES[0];
                      const isToday = todayStr >= evt.startDate && todayStr <= (evt.endDate || evt.startDate);
                      return (
                        <div
                          key={evt.id}
                          style={{
                            padding: 14,
                            borderRadius: 10,
                            border: `1px solid ${isToday ? "#2563eb" : "#e2e8f0"}`,
                            background: isToday ? "#eff6ff" : "#ffffff",
                            boxShadow: isToday ? "0 2px 8px rgba(37,99,235,0.12)" : "none",
                            transition: "all 0.2s"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                                <span style={{ fontSize: 16 }}>{typeObj.icon}</span>
                                <strong style={{ fontSize: 14, color: "#0f172a" }}>{evt.title}</strong>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: typeObj.bg, color: typeObj.color }}>
                                  {typeObj.label}
                                </span>
                                {isToday && (
                                  <span style={{ fontSize: 11, background: "#2563eb", color: "#ffffff", padding: "2px 8px", borderRadius: 12, fontWeight: 700 }}>
                                    Active Today
                                  </span>
                                )}
                              </div>

                              <div style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                                <Clock size={13} color="#64748b" />
                                <span>
                                  {evt.startDate === evt.endDate || !evt.endDate
                                    ? evt.startDate
                                    : `${evt.startDate} to ${evt.endDate}`}
                                </span>
                              </div>

                              {evt.suspendClasses && (
                                <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 600, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                  <AlertTriangle size={12} /> Regular classes & attendance suspended
                                </div>
                              )}
                            </div>

                            {isHod && (
                              <button
                                onClick={() => handleDeleteEvent(evt.id)}
                                style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", padding: 4 }}
                                title="Remove event rule"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {pastEvents.length > 0 && (
                      <details style={{ marginTop: 12 }}>
                        <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#64748b", padding: "6px 0" }}>
                          Past Calendar Events ({pastEvents.length})
                        </summary>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                          {pastEvents.map(evt => (
                            <div key={evt.id} style={{ padding: 10, borderRadius: 8, background: "#f8fafc", border: "1px solid #f1f5f9", opacity: 0.7 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{evt.title}</div>
                              <div style={{ fontSize: 11, color: "#94a3b8" }}>{evt.startDate}</div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PDF PREVIEW MODAL */}
        {showPdfModal && calendarData.pdfUrl && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.8)",
            backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", flexDirection: "column", padding: 20
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "white", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: "white" }}>
                {calendarData.pdfName || `${selectedDept} Academic Calendar`}
              </h3>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <a
                  href={calendarData.pdfUrl}
                  download={calendarData.pdfName || `${selectedDept}_Academic_Calendar.pdf`}
                  className="btn-primary"
                  style={{ width: "auto", padding: "6px 16px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
                >
                  <Download size={16} /> Download PDF
                </a>
                <button onClick={() => setShowPdfModal(false)} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer" }}>
                  <X size={24} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, background: "white", borderRadius: 12, overflow: "hidden" }}>
              <iframe
                src={calendarData.pdfUrl}
                title="Academic Calendar PDF"
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
