// src/pages/officestaff/FeesAlerts.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { notifyStudentFeesPending } from "../../utils/notifications";

const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIDS", "AIML"];
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const FEES_TYPES = ["College Fees", "Bus Fees", "Mess Fees", "Exam Fees", "Library Fees", "Other"];

export default function FeesAlerts() {
  const { userProfile } = useAuth();
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedFeesType, setSelectedFeesType] = useState("");
  const [pendingStudents, setPendingStudents] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [alertMessage, setAlertMessage] = useState("Your fees payment is pending. Please pay at the office immediately.");

  async function fetchPendingStudents() {
    if (!selectedDept || !selectedYear || !selectedFeesType) return;
    setFetching(true);
    setSent(false);
    try {
      const sq = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", selectedDept),
        where("year", "==", selectedYear)
      );
      const sSnap = await getDocs(sq);
      const allStudents = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const fq = query(
        collection(db, "fees"),
        where("dept", "==", selectedDept),
        where("year", "==", selectedYear),
        where("feesType", "==", selectedFeesType)
      );
      const fSnap = await getDocs(fq);
      const payments = fSnap.empty ? {} : fSnap.docs[0].data().payments || {};

      const pending = allStudents.filter(s => !payments[s.id]);
      setPendingStudents(pending);
    } catch (err) {}
    setFetching(false);
  }

  async function sendAlerts() {
    if (pendingStudents.length === 0) return;
    setSending(true);
    try {
      for (const student of pendingStudents) {
        await addDoc(collection(db, "alerts"), {
          title: `⚠️ ${selectedFeesType} Payment Pending`,
          message: alertMessage,
          type: "fees",
          targetRole: "student",
          targetStudentId: student.id,
          dept: selectedDept,
          year: selectedYear,
          feesType: selectedFeesType,
          postedBy: userProfile.name,
          createdAt: new Date().toISOString()
        });
        await notifyStudentFeesPending({
  email: student.email || "",
  phone: student.phone || "",
  name: student.name,
  feesType: selectedFeesType,
  dept: selectedDept
});
      }
      setSent(true);
    } catch (err) {}
    setSending(false);
  }

  useEffect(() => { fetchPendingStudents(); }, [selectedDept, selectedYear, selectedFeesType]);

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>📢 Fees Alerts</h1>
          <p>Notify pending students — Office Staff</p>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Department</label>
              <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)}>
                <option value="">Select Dept</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Year</label>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                <option value="">Select Year</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Fees Type</label>
              <select value={selectedFeesType} onChange={e => setSelectedFeesType(e.target.value)}>
                <option value="">Select Type</option>
                {FEES_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
        </div>

        {fetching ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div className="spinner" style={{ margin: "0 auto" }}></div>
          </div>
        ) : pendingStudents.length > 0 ? (
          <>
            {/* Alert Message */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Alert Message</label>
                <input
                  type="text"
                  value={alertMessage}
                  onChange={e => setAlertMessage(e.target.value)}
                  placeholder="Enter alert message..."
                />
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
                <button
                  className="btn-primary"
                  onClick={sendAlerts}
                  disabled={sending}
                  style={{ width: "auto", padding: "12px 32px" }}
                >
                  {sending ? "Sending..." : `📢 Send Alert to ${pendingStudents.length} Students`}
                </button>
                {sent && <span style={{ color: "#48bb78", fontWeight: 600, fontSize: 14 }}>✅ Alerts sent!</span>}
              </div>
            </div>

            {/* Pending List */}
            <div className="card">
              <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 20 }}>
                ⏳ Pending Students ({pendingStudents.length})
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      {["S.No", "Name", "Register No", "Phone", "Student Type"].map((h, i) => (
                        <th key={i} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingStudents.map((s, idx) => (
                      <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(252,129,129,0.03)" }}>
                        <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 14 }}>{idx + 1}</td>
                        <td style={{ padding: "14px 16px", fontWeight: 600, fontSize: 15 }}>{s.name}</td>
                        <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 14 }}>{s.registerNo}</td>
                        <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 14 }}>{s.phone || "—"}</td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{
                            padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                            background: s.studentType === "hosteller" ? "rgba(66,153,225,0.15)" : "rgba(159,122,234,0.15)",
                            color: s.studentType === "hosteller" ? "#4299e1" : "#9f7aea"
                          }}>
                            {s.studentType === "hosteller" ? "🏠 Hosteller" : "🏡 Day Scholar"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : selectedDept && selectedYear && selectedFeesType ? (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ color: "#48bb78", fontSize: 16, fontWeight: 600 }}>All students have paid {selectedFeesType}!</p>
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📢</div>
            <p style={{ color: "#a0aec0" }}>Select filters to view pending students</p>
          </div>
        )}
      </main>
    </div>
  );
}