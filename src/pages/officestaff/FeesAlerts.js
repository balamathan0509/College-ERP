// src/pages/officestaff/FeesAlerts.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, where, getDocs, addDoc } from "../../supabase/supabaseAdapter";
import { notifyStudentFeesPending } from "../../utils/notifications";
import { COLLEGE_DEPARTMENTS } from "../../utils/collegeConfig";
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import toast, { Toaster } from 'react-hot-toast';

const DEPARTMENTS = COLLEGE_DEPARTMENTS;
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

  const handleDownloadPdf = () => {
    if (pendingStudents.length === 0) return;
    const printContent = document.getElementById("printable-pending-students");
    if (!printContent) return;

    const filename = `Pending_Fees_${selectedDept}_${selectedYear}_${selectedFeesType}.pdf`.replace(/\s+/g, '_');
    const opt = {
      margin: 10,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(printContent).save();
    toast.success("PDF downloaded successfully!");
  };

  const handleDownloadExcel = () => {
    if (pendingStudents.length === 0) return;
    try {
      const wb = XLSX.utils.book_new();
      const rows = [
        ["RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING"],
        ["OFFICE STAFF - PENDING FEES REPORT"],
        [`Department: ${selectedDept}`, `Year: ${selectedYear}`, `Fees Type: ${selectedFeesType}`],
        [`Generated On: ${new Date().toLocaleDateString()}`],
        [],
        ["S.No", "Student Name", "Register Number", "Phone", "Student Type", "Department", "Year", "Fees Type", "Status"]
      ];

      pendingStudents.forEach((s, idx) => {
        rows.push([
          idx + 1,
          s.name || '',
          s.registerNo || '',
          s.phone || '',
          s.studentType === 'hosteller' ? 'Hosteller' : 'Day Scholar',
          selectedDept,
          selectedYear,
          selectedFeesType,
          "Pending"
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [
        { wch: 8 },
        { wch: 25 },
        { wch: 18 },
        { wch: 16 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
        { wch: 18 },
        { wch: 12 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Pending Students");

      const filename = `Pending_Fees_${selectedDept}_${selectedYear}_${selectedFeesType}.xlsx`.replace(/\s+/g, '_');
      XLSX.writeFile(wb, filename);
      toast.success("Excel (.xlsx) downloaded successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Excel file.");
    }
  };

  const handleDownloadWord = () => {
    if (pendingStudents.length === 0) return;
    try {
      const wordDocHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>Pending Fees - ${selectedFeesType}</title>
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
            <h3 style="text-align: center; margin-top: 0; color: #b91c1c;">PENDING FEES REPORT</h3>
            <p><strong>Department:</strong> ${selectedDept} &nbsp;|&nbsp; <strong>Year:</strong> ${selectedYear} &nbsp;|&nbsp; <strong>Fees Type:</strong> ${selectedFeesType}</p>
            <p><strong>Total Pending Students:</strong> ${pendingStudents.length} &nbsp;|&nbsp; <strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <table>
              <thead>
                <tr>
                  <th style="width: 40px;">S.No</th>
                  <th>Student Name</th>
                  <th>Register No</th>
                  <th>Phone</th>
                  <th>Student Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${pendingStudents.map((s, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.registerNo}</td>
                    <td>${s.phone || '-'}</td>
                    <td>${s.studentType === 'hosteller' ? 'Hosteller' : 'Day Scholar'}</td>
                    <td style="color: red; font-weight: bold;">Pending</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff', wordDocHtml], { type: 'application/msword;charset=utf-8' });
      const filename = `Pending_Fees_${selectedDept}_${selectedYear}_${selectedFeesType}.doc`.replace(/\s+/g, '_');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast.success("Word document (.doc) downloaded successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Word document.");
    }
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <h3 style={{ fontFamily: "Syne", fontSize: 18, margin: 0 }}>
                  ⏳ Pending Students ({pendingStudents.length})
                </h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    onClick={handleDownloadPdf}
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      color: "#fff",
                      padding: "8px 14px",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                    title="Download Pending Students as PDF"
                  >
                    <Download size={15} /> Download PDF
                  </button>
                  <button
                    onClick={handleDownloadExcel}
                    style={{
                      background: "#107c41",
                      border: "none",
                      color: "#fff",
                      padding: "8px 14px",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 2px 4px rgba(16,124,65,0.2)"
                    }}
                    title="Download Pending Students as Excel (.xlsx)"
                  >
                    <FileSpreadsheet size={15} /> Download Excel
                  </button>
                  <button
                    onClick={handleDownloadWord}
                    style={{
                      background: "#2b579a",
                      border: "none",
                      color: "#fff",
                      padding: "8px 14px",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 2px 4px rgba(43,87,154,0.2)"
                    }}
                    title="Download Pending Students as Word (.doc)"
                  >
                    <FileText size={15} /> Download Word
                  </button>
                </div>
              </div>
              <div id="printable-pending-students" style={{ overflowX: "auto" }}>
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