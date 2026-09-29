import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp } from "firebase/firestore";
import {
  BookOpen,
  HelpCircle,
  MessageSquareWarning,
  List,
  Phone,
  ChevronDown,
  ChevronUp,
  Mail,
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react";

export default function HelpCenter() {
  const { currentUser, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("guide");

  // User Guide & FAQ State
  const [expandedSection, setExpandedSection] = useState(null);
  const [expandedFAQ, setExpandedFAQ] = useState(null);

  // Form State
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Low");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // My Issues State
  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(true);

  const categories = [
    "Login & Authentication",
    "Attendance",
    "Academic",
    "Examination",
    "Timetable",
    "Course / Subject",
    "Student Management",
    "Faculty Management",
    "Technical Issue",
    "Other"
  ];

  const priorities = ["Low", "Medium", "High", "Critical"];

  useEffect(() => {
    if (!currentUser?.uid) return;

    const q = query(
      collection(db, "issues"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedIssues = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      }));
      setIssues(fetchedIssues);
      setIssuesLoading(false);
    }, (error) => {
      console.error("Error fetching issues:", error);
      setIssuesLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category || !subject || !description) {
      setSubmitError("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    setSubmitSuccess(false);

    try {
      await addDoc(collection(db, "issues"), {
        userId: currentUser.uid,
        userName: userProfile?.name || "Unknown User",
        userEmail: currentUser.email || "",
        role: userProfile?.role || "unknown",
        category,
        subject,
        description,
        priority,
        status: "Open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setSubmitSuccess(true);
      setCategory("");
      setSubject("");
      setDescription("");
      setPriority("Low");
      
      setTimeout(() => setSubmitSuccess(false), 5000);
    } catch (err) {
      console.error("Error submitting issue:", err);
      setSubmitError("Failed to submit issue. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const toggleFAQ = (index) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  const getStatusBadge = (status) => {
    const colors = {
      "Open": { bg: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" },
      "In Progress": { bg: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" },
      "Resolved": { bg: "rgba(16, 185, 129, 0.1)", color: "#10b981" },
      "Closed": { bg: "rgba(107, 114, 128, 0.1)", color: "#6b7280" }
    };
    
    const style = colors[status] || colors["Open"];
    
    return (
      <span style={{ 
        background: style.bg, 
        color: style.color, 
        padding: "4px 8px", 
        borderRadius: "12px", 
        fontSize: "11px",
        fontWeight: "bold"
      }}>
        {status}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      "Low": { bg: "rgba(16, 185, 129, 0.1)", color: "#10b981" },
      "Medium": { bg: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" },
      "High": { bg: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" },
      "Critical": { bg: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }
    };
    
    const style = colors[priority] || colors["Low"];
    
    return (
      <span style={{ 
        background: style.bg, 
        color: style.color, 
        padding: "2px 6px", 
        borderRadius: "4px", 
        fontSize: "11px",
        border: `1px solid ${style.color}40`
      }}>
        {priority}
      </span>
    );
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Help Center</h1>
          <p>Get assistance, report issues, and find answers to common questions</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "24px", overflowX: "auto", paddingBottom: "10px" }}>
          {[
            { id: "guide", icon: <BookOpen size={16} />, label: "User Guide" },
            { id: "faq", icon: <HelpCircle size={16} />, label: "FAQs" },
            { id: "report", icon: <MessageSquareWarning size={16} />, label: "Report an Issue" },
            { id: "issues", icon: <List size={16} />, label: "My Issues" },
            { id: "contact", icon: <Phone size={16} />, label: "Contact Support" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                borderRadius: "8px",
                border: "none",
                background: activeTab === tab.id ? "var(--primary)" : "white",
                color: activeTab === tab.id ? "white" : "var(--text-muted)",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                boxShadow: activeTab === tab.id ? "var(--shadow-sm)" : "none",
                whiteSpace: "nowrap",
                transition: "all 0.2s ease"
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="card" style={{ minHeight: "400px" }}>
          
          {/* User Guide Tab */}
          {activeTab === "guide" && (
            <div>
              <h2 style={{ fontSize: "18px", marginBottom: "20px", color: "var(--text)" }}>ERP User Guide</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  {
                    title: "Dashboard Overview",
                    content: "The dashboard is your main hub. It provides an overview of your schedule, recent alerts, pending tasks, and quick access to major modules based on your role."
                  },
                  {
                    title: "Gate Pass Management",
                    content: "Students and Staff can apply for gate passes indicating their exit and expected entry times. Wardens/HODs/Principals can approve or reject these requests. Security uses the Verify module to scan and validate passes at the gate."
                  },
                  {
                    title: "Attendance System",
                    content: "Staff members can mark attendance for students in their assigned courses. Students can view their attendance percentage and detailed daily logs."
                  },
                  {
                    title: "Learning Management System (LMS)",
                    content: "Faculty can upload course plans, materials, and track plan completion. Students can view uploaded materials, participate in assignments, and provide feedback on course plans."
                  },
                  {
                    title: "CIA & Examination",
                    content: "Staff can create exams, manage question banks, and upload question papers for HOD/Principal review. Once approved, marks can be entered and result analysis generated."
                  },
                  {
                    title: "Leave Management",
                    content: "Apply for casual, medical, or other leaves. Track the status of your applications as they pass through the approval hierarchy (HOD -> Principal)."
                  }
                ].map((section, idx) => (
                  <div key={idx} style={{ border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
                    <button
                      onClick={() => toggleSection(idx)}
                      style={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "16px",
                        background: expandedSection === idx ? "rgba(37, 99, 235, 0.05)" : "white",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "15px",
                        color: "var(--text)",
                        textAlign: "left"
                      }}
                    >
                      {section.title}
                      {expandedSection === idx ? <ChevronUp size={18} color="var(--primary)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                    </button>
                    {expandedSection === idx && (
                      <div style={{ padding: "16px", borderTop: "1px solid var(--border)", color: "var(--text-muted)", fontSize: "14px", lineHeight: "1.6" }}>
                        {section.content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FAQs Tab */}
          {activeTab === "faq" && (
            <div>
              <h2 style={{ fontSize: "18px", marginBottom: "20px", color: "var(--text)" }}>Frequently Asked Questions</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  {
                    q: "How do I change my password?",
                    a: "You can change your password by navigating to the Profile page from the top-right dropdown, then selecting the 'Change Password' tab."
                  },
                  {
                    q: "Why is my Gate Pass still pending?",
                    a: "Gate passes require approval from your respective authority (Warden for hostelers, HOD for day scholars). Please contact them if it has been pending for too long."
                  },
                  {
                    q: "I cannot see my courses in the LMS.",
                    a: "Courses must be allocated to you by the academic admin. If you believe this is an error, please report an issue under the 'Academic' category."
                  },
                  {
                    q: "How do I submit a Question Paper for review?",
                    a: "Navigate to CIA > Question Paper. Select the course and upload your PDF. It will automatically be sent to your HOD for the first stage of review."
                  },
                  {
                    q: "What should I do if my attendance is marked incorrectly?",
                    a: "Students should immediately contact the faculty member who handled the session to correct any discrepancies in the attendance log."
                  }
                ].map((faq, idx) => (
                  <div key={idx} style={{ border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
                    <button
                      onClick={() => toggleFAQ(idx)}
                      style={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "16px",
                        background: expandedFAQ === idx ? "rgba(37, 99, 235, 0.05)" : "white",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "14px",
                        color: "var(--text)",
                        textAlign: "left"
                      }}
                    >
                      {faq.q}
                      {expandedFAQ === idx ? <ChevronUp size={18} color="var(--primary)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                    </button>
                    {expandedFAQ === idx && (
                      <div style={{ padding: "16px", borderTop: "1px solid var(--border)", color: "var(--text-muted)", fontSize: "14px", lineHeight: "1.6", background: "#fafafa" }}>
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Report Issue Tab */}
          {activeTab === "report" && (
            <div style={{ maxWidth: "600px" }}>
              <h2 style={{ fontSize: "18px", marginBottom: "20px", color: "var(--text)" }}>Report an Issue</h2>
              
              {submitSuccess && (
                <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "8px", padding: "12px 16px", color: "var(--success)", fontSize: "14px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <CheckCircle size={18} /> Issue reported successfully. Support team will look into it soon.
                </div>
              )}
              
              {submitError && (
                <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", padding: "12px 16px", color: "var(--danger)", fontSize: "14px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <AlertCircle size={18} /> {submitError}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                
                <div className="form-group">
                  <label>Category *</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} required className="form-input" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <option value="" disabled>Select a category</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Subject *</label>
                  <input 
                    type="text" 
                    value={subject} 
                    onChange={(e) => setSubject(e.target.value)} 
                    placeholder="Brief summary of the issue" 
                    required 
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)" }}
                  />
                </div>

                <div className="form-group">
                  <label>Issue Description *</label>
                  <textarea 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder="Please provide details about the problem you're experiencing..." 
                    rows={6}
                    required 
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", resize: "vertical", fontFamily: "inherit" }}
                  />
                </div>

                <div className="form-group">
                  <label>Priority *</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} required className="form-input" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div style={{ padding: "12px", background: "rgba(59, 130, 246, 0.05)", borderRadius: "8px", fontSize: "13px", color: "var(--text-muted)", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <AlertCircle size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <p style={{ margin: 0 }}>This issue will be submitted with status <strong>Open</strong>. Support staff will update the status as they work on it.</p>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ 
                    background: "var(--primary)", 
                    color: "white", 
                    border: "none", 
                    padding: "12px", 
                    borderRadius: "8px", 
                    fontWeight: "600", 
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    opacity: isSubmitting ? 0.7 : 1,
                    marginTop: "8px"
                  }}
                >
                  {isSubmitting ? "Submitting..." : "Submit Issue"}
                </button>
              </form>
            </div>
          )}

          {/* My Issues Tab */}
          {activeTab === "issues" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "18px", color: "var(--text)", margin: 0 }}>My Reported Issues</h2>
                <button 
                  onClick={() => setActiveTab("report")}
                  style={{ background: "transparent", border: "1px solid var(--primary)", color: "var(--primary)", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
                >
                  + New Issue
                </button>
              </div>

              {issuesLoading ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)" }}>Loading your issues...</div>
              ) : issues.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", border: "1px dashed var(--border)", borderRadius: "8px", background: "#fcfcfc" }}>
                  <MessageSquareWarning size={32} color="var(--border)" style={{ marginBottom: "10px" }} />
                  <p style={{ color: "var(--text-muted)", margin: 0 }}>You haven't reported any issues yet.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {issues.map(issue => (
                    <div key={issue.id} style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px", background: "white", boxShadow: "var(--shadow-sm)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                        <div>
                          <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--text)", margin: "0 0 4px 0" }}>{issue.subject}</h3>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><List size={14} /> {issue.category}</span>
                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Clock size={14} /> {issue.createdAt?.toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                          {getStatusBadge(issue.status)}
                          {getPriorityBadge(issue.priority)}
                        </div>
                      </div>
                      <div style={{ padding: "12px", background: "#f9fafb", borderRadius: "6px", fontSize: "14px", color: "var(--text)", whiteSpace: "pre-wrap" }}>
                        {issue.description}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "right" }}>
                        Last updated: {issue.updatedAt?.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Contact Tab */}
          {activeTab === "contact" && (
            <div style={{ maxWidth: "500px" }}>
              <h2 style={{ fontSize: "18px", marginBottom: "20px", color: "var(--text)" }}>Contact Support</h2>
              
              <div style={{ border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ padding: "20px", background: "var(--primary)", color: "white", textAlign: "center" }}>
                  <HelpCircle size={48} style={{ marginBottom: "12px", opacity: 0.9 }} />
                  <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>IT Helpdesk</h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: "14px", opacity: 0.8 }}>We're here to help you</p>
                </div>
                
                <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px", background: "white" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(59, 130, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                      <Mail size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Email Support</div>
                      <a href="mailto:support@college.edu" style={{ fontSize: "15px", color: "var(--text)", textDecoration: "none", fontWeight: "500" }}>support@college.edu</a>
                    </div>
                  </div>
                  
                  <div style={{ height: "1px", background: "var(--border)" }}></div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(59, 130, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                      <Phone size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Phone Support</div>
                      <div style={{ fontSize: "15px", color: "var(--text)", fontWeight: "500" }}>+91 9876543210</div>
                    </div>
                  </div>

                  <div style={{ height: "1px", background: "var(--border)" }}></div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(59, 130, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                      <Clock size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Working Hours</div>
                      <div style={{ fontSize: "15px", color: "var(--text)", fontWeight: "500" }}>Mon-Fri, 9:00 AM - 5:00 PM</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
        </div>
      </main>
    </div>
  );
}
