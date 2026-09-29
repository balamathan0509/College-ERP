import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, where, getDocs } from "../../supabase/supabaseAdapter";
import { Users, User, X, Mail, Phone, BookOpen, MapPin, Calendar, Activity, Home, GraduationCap, Info } from "lucide-react";

export default function StudentDetails() {
  const { userProfile } = useAuth();
  const [students, setStudents] = useState([]);
  const [inchargeInfo, setInchargeInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeTab, setActiveTab] = useState('Basic Info');

  useEffect(() => {
    async function fetchData() {
      if (!userProfile) return;
      try {
        const incQ = query(
          collection(db, "class_incharges"),
          where("facultyId", "==", userProfile.uid)
        );
        const incSnap = await getDocs(incQ);
        if (!incSnap.empty) {
          const inchargeData = incSnap.docs[0].data();
          setInchargeInfo(inchargeData);

          const studQ = query(
            collection(db, "users"),
            where("role", "==", "student"),
            where("dept", "==", inchargeData.dept)
          );
          const studSnap = await getDocs(studQ);
          let tempStudents = studSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          tempStudents = tempStudents.filter(s => s.year === inchargeData.year);
          if (inchargeData.section && inchargeData.section !== ".") {
            tempStudents = tempStudents.filter(s => s.section === inchargeData.section);
          }
          // Sort alphabetically by name
          tempStudents.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
          setStudents(tempStudents);
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    fetchData();
  }, [userProfile]);

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content" style={{ background: selectedStudent ? "#f1f5f9" : "var(--bg-color)" }}>
        {selectedStudent ? (
          <div style={{ background: "#f8f9fa", minHeight: "100%", display: "flex", flexDirection: "column" }}>
            {/* Header Section with Dark Blue Background */}
            <div style={{
              background: "linear-gradient(135deg, #3b4b72 0%, #8ba3c7 100%)",
              padding: "30px 40px 0 40px",
              color: "white",
              display: "flex",
              flexDirection: "column",
              position: "relative"
            }}>
              {/* Back Button */}
              <button 
                onClick={() => { setSelectedStudent(null); setActiveTab('Basic Info'); }}
                style={{
                  position: "absolute", top: 16, right: 24,
                  background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
                  color: "white", padding: "6px 14px", borderRadius: 4, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6, fontSize: 13, transition: "all 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
              >
                <X size={14} /> Back to List
              </button>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
                <div style={{ 
                  width: 120, height: 120, borderRadius: "50%", 
                  background: "white", color: "#ccc",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 48
                }}>
                  {selectedStudent.name ? selectedStudent.name.charAt(0).toUpperCase() : <User size={64} />}
                </div>
                <div style={{ paddingTop: 10 }}>
                  <h2 style={{ margin: "0 0 8px 0", fontSize: 24, fontWeight: 500, letterSpacing: "0.5px", textTransform: "uppercase", color: "#ffffff" }}>
                    {selectedStudent.name}
                  </h2>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginBottom: 12, letterSpacing: "0.3px" }}>
                    {selectedStudent.registerNo || selectedStudent.registerNumber || "N/A"} | {selectedStudent.programme || selectedStudent.programmeCode || "N/A"} | {selectedStudent.academicSession || selectedStudent.batch || "N/A"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Mail size={14} /> {selectedStudent.email || "N/A"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Phone size={14} /> {selectedStudent.mobileNumber || selectedStudent.mobile || selectedStudent.phone || "N/A"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 32, marginTop: 30 }}>
                {['Basic Info', 'Personal Info', 'Parent Info', 'Contact Info'].map(tab => (
                  <div 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{ 
                      padding: "12px 20px",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 500,
                      color: activeTab === tab ? "#ffffff" : "rgba(255,255,255,0.7)",
                      background: activeTab === tab ? "rgba(255,255,255,0.12)" : "transparent",
                      borderTopLeftRadius: "6px",
                      borderTopRightRadius: "6px",
                      borderBottom: activeTab === tab ? "3px solid white" : "3px solid transparent",
                      transition: "all 0.2s",
                      marginBottom: activeTab === tab ? "-3px" : "0"
                    }}
                  >
                    {tab}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Body Section with Forms */}
            <div style={{ padding: "30px 40px", flex: 1, background: "white", margin: "20px", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <h3 style={{ margin: "0 0 24px 0", fontSize: 16, fontWeight: 600, color: "#333", borderBottom: "1px solid #eaeaea", paddingBottom: 12 }}>
                {activeTab}
              </h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px 40px" }}>
                {activeTab === 'Basic Info' && (
                  <>
                    <InputRow label="Academic Session:" value={selectedStudent.academicSession || selectedStudent.batch} required />
                    <InputRow label="Department:" value={selectedStudent.department || selectedStudent.dept} />
                    <InputRow label="Programme:" value={selectedStudent.programme || selectedStudent.programmeCode} required />
                    <InputRow label="Current Semester:" value={selectedStudent.semester ? `Sem ${selectedStudent.semester}` : ""} />
                    <InputRow label="Class & Section:" value={`${selectedStudent.year || ""} ${selectedStudent.section && selectedStudent.section !== "." ? `- ${selectedStudent.section}` : ""}`} />
                    <InputRow label="Register No:" value={selectedStudent.registerNo || selectedStudent.registerNumber} required />
                    <InputRow label="First Name:" value={selectedStudent.name} required />
                    <InputRow label="Status:" value={selectedStudent.status || "Active"} />
                  </>
                )}

                {activeTab === 'Personal Info' && (
                  <>
                    <InputRow label="Date of Birth:" value={selectedStudent.dateOfBirth || selectedStudent.dob} />
                    <InputRow label="Gender:" value={selectedStudent.gender} />
                    <InputRow label="Blood Group:" value={selectedStudent.bloodGroup} />
                    <InputRow label="Stay Type:" value={selectedStudent.hostellerOrDayScholar || (selectedStudent.isHosteller ? "Hosteller" : "Day Scholar")} />
                  </>
                )}

                {activeTab === 'Parent Info' && (
                  <>
                    <InputRow label="Father's Name:" value={selectedStudent.fatherName} />
                    <InputRow label="Father's Mobile:" value={selectedStudent.fatherMobileNumber || selectedStudent.fatherMobile} />
                    <InputRow label="Mother's Name:" value={selectedStudent.motherName} />
                    <InputRow label="Mother's Mobile:" value={selectedStudent.motherMobileNumber || selectedStudent.motherMobile} />
                    <InputRow label="Parent Email ID:" value={selectedStudent.parentEmail || selectedStudent.parentEmailId} />
                  </>
                )}

                {activeTab === 'Contact Info' && (
                  <>
                    <InputRow label="Email ID:" value={selectedStudent.email} />
                    <InputRow label="Mobile Number:" value={selectedStudent.mobileNumber || selectedStudent.mobile || selectedStudent.phone} />
                    <InputRow label="Communication Address:" value={selectedStudent.communicationAddress || selectedStudent.address} fullWidth />
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="page-header" style={{ marginBottom: 24 }}>
              <div>
                <h1>Student Details</h1>
                <p style={{ color: "var(--text-muted)", marginTop: 6 }}>View students in your assigned class</p>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>Loading students...</div>
            ) : !inchargeInfo ? (
              <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                <Users size={48} style={{ margin: "0 auto 16px", opacity: 0.2 }} />
                <div style={{ fontSize: 16, fontWeight: 600 }}>Not a Class In-Charge</div>
                <div style={{ fontSize: 14, marginTop: 8 }}>You are not assigned as a class in-charge. Only class in-charges can view student details here.</div>
              </div>
            ) : (
              <div className="card">
                <h3 style={{ marginBottom: 20, fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>
                  Class List ({inchargeInfo.year} {inchargeInfo.dept} {inchargeInfo.section !== "." ? `Sec ${inchargeInfo.section}` : ""})
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {students.map(student => (
                    <div key={student.id} 
                      onClick={() => setSelectedStudent(student)}
                      style={{
                        padding: "16px 20px",
                        borderRadius: "var(--radius-md)",
                        background: "var(--bg-color)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        cursor: "pointer",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--primary)";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ 
                          width: 40, height: 40, borderRadius: "50%", 
                          background: "rgba(59, 130, 246, 0.1)", color: "var(--primary)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 600, fontSize: 16
                        }}>
                          {student.name ? student.name.charAt(0).toUpperCase() : <User size={20} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 15 }}>{student.name}</div>
                          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{student.email}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap", background: "var(--bg-hover)", padding: "4px 10px", borderRadius: 20 }}>
                          {student.registerNo || "N/A"}
                        </div>
                        <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6 }}>
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {students.length === 0 && (
                  <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>
                    No students found in your class.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// Helper component for input-style display
function InputRow({ label, value, required, fullWidth }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "center", gap: 16, gridColumn: fullWidth ? "1 / -1" : "auto" }}>
      <div style={{ fontSize: 13, color: "#333", fontWeight: 500 }}>
        {label} {required && <span style={{ color: "red" }}>*</span>}
      </div>
      <div style={{ 
        padding: "8px 12px", 
        background: "#f9fafb", 
        border: "1px solid #e5e7eb", 
        borderRadius: "6px",
        fontSize: 13,
        color: "#4b5563",
        minHeight: "36px",
        display: "flex",
        alignItems: "center"
      }}>
        {value || ""}
      </div>
    </div>
  );
}
