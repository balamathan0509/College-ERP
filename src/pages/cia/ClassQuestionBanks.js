import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, getDocs, where } from "../../supabase/supabaseAdapter";
import { useAuth } from '../../context/AuthContext';
import { 
  Eye, 
  Printer, 
  Search, 
  ArrowLeft, 
  Download, 
  BookOpen, 
  CheckCircle, 
  FileText, 
  User, 
  Clock, 
  AlertCircle,
  FileSpreadsheet,
  GraduationCap
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import toast, { Toaster } from 'react-hot-toast';

// Helper: Convert semester number to Roman Year / Roman Sem
const toRomanSem = (semVal) => {
  const s = parseInt(semVal, 10);
  if (!s || isNaN(s)) return semVal ? String(semVal) : '';
  const romanMap = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII' };
  const yearNum = Math.ceil(s / 2);
  const romanYear = romanMap[yearNum] || yearNum;
  const romanSem = romanMap[s] || s;
  return `${romanYear} / ${romanSem}`;
};

export default function ClassQuestionBanks() {
  const { userProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [classInchargeInfo, setClassInchargeInfo] = useState(null);
  const [classSubjects, setClassSubjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [examFilter, setExamFilter] = useState('ALL');

  // Viewing State
  const [viewingSubject, setViewingSubject] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');

  useEffect(() => {
    if (userProfile) {
      fetchClassAndBanks();
    }
  }, [userProfile]);

  const fetchClassAndBanks = async () => {
    setLoading(true);
    try {
      const staffUid = userProfile?.uid || userProfile?.id;
      const staffName = userProfile?.name;
      const dept = userProfile?.dept || userProfile?.department || '';

      // 1. Check if user is a Class In-Charge
      let incData = null;
      try {
        const qInc = query(collection(db, "class_incharges"), where("facultyId", "==", staffUid));
        const incSnap = await getDocs(qInc);
        if (!incSnap.empty) {
          incData = { id: incSnap.docs[0].id, ...incSnap.docs[0].data() };
        } else if (staffName) {
          const qName = query(collection(db, "class_incharges"), where("facultyName", "==", staffName));
          const snapName = await getDocs(qName);
          if (!snapName.empty) {
            incData = { id: snapName.docs[0].id, ...snapName.docs[0].data() };
          }
        }
      } catch (e) {
        console.warn("Error fetching class_incharges:", e);
      }

      if (!incData) {
        // Fallback for HOD / Dept Admin or general incharge profile
        incData = {
          dept: dept || 'CSE',
          year: userProfile?.year || '2',
          section: userProfile?.section || 'A',
          isGeneralDept: true
        };
      }
      setClassInchargeInfo(incData);

      // 2. Fetch all Published Banks from cia_published_question_banks
      let pubList = [];
      try {
        const qPub = query(collection(db, "cia_published_question_banks"), where("isPublished", "==", true));
        const pubSnap = await getDocs(qPub);
        pubList = pubSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (e) {
        console.warn("Error fetching cia_published_question_banks:", e);
      }

      // 3. Fetch courses allocated for this class
      const targetDept = incData.dept || dept;
      let rawCourses = [];
      try {
        const qCourses = query(collection(db, "course_allocations"), where("department", "==", targetDept));
        const cSnap = await getDocs(qCourses);
        rawCourses = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.warn("Error fetching course_allocations:", e);
      }

      // Also get distinct courses from question bank to ensure nothing is missed
      let allQBCourses = [];
      try {
        const qbSnap = await getDocs(collection(db, "cia_question_bank"));
        const seenCodes = new Set();
        qbSnap.docs.forEach(d => {
          const data = d.data();
          const code = (data.courseCode || '').trim().toUpperCase();
          if (code && !seenCodes.has(code)) {
            seenCodes.add(code);
            allQBCourses.push({
              courseCode: code,
              courseName: data.courseName || code,
              department: data.department || targetDept,
              semester: data.semester || '',
              facultyName: data.createdByName || 'Subject Faculty'
            });
          }
        });
      } catch (e) {}

      // Combine & Normalize unique subjects
      const subjectMap = new Map();

      // Add from course_allocations
      rawCourses.forEach(c => {
        const code = (c.courseCode || c.subjectCode || '').trim().toUpperCase();
        if (code && !subjectMap.has(code)) {
          // Check if this course has a published record
          const publishedRecord = pubList.find(p => String(p.courseCode || '').trim().toUpperCase() === code);
          subjectMap.set(code, {
            id: c.id,
            courseCode: code,
            courseName: (c.courseName || c.subjectName || code).trim(),
            department: c.department || targetDept,
            semester: c.semester || incData.semester || '',
            year: c.year || incData.year || '',
            section: c.section || incData.section || '',
            facultyName: c.facultyName || c.faculty || 'Course Faculty',
            isPublished: !!publishedRecord,
            publishedInfo: publishedRecord || null
          });
        }
      });

      // Also add published banks if not already in subjectMap
      pubList.forEach(p => {
        const code = (p.courseCode || '').trim().toUpperCase();
        if (code) {
          const existing = subjectMap.get(code);
          if (existing) {
            existing.isPublished = true;
            existing.publishedInfo = p;
            if (p.courseName && (!existing.courseName || existing.courseName === code)) {
              existing.courseName = p.courseName;
            }
            if (p.publishedByName) {
              existing.facultyName = p.publishedByName;
            }
          } else {
            subjectMap.set(code, {
              id: `pub_${code}`,
              courseCode: code,
              courseName: p.courseName || code,
              department: p.department || targetDept,
              semester: p.semester || '',
              facultyName: p.publishedByName || 'Course Faculty',
              isPublished: true,
              publishedInfo: p
            });
          }
        }
      });

      // Also add QB courses if map is still small
      allQBCourses.forEach(q => {
        if (!subjectMap.has(q.courseCode)) {
          const publishedRecord = pubList.find(p => String(p.courseCode || '').trim().toUpperCase() === q.courseCode);
          subjectMap.set(q.courseCode, {
            id: `qb_${q.courseCode}`,
            courseCode: q.courseCode,
            courseName: q.courseName,
            department: q.department,
            semester: q.semester,
            facultyName: q.facultyName,
            isPublished: !!publishedRecord,
            publishedInfo: publishedRecord || null
          });
        }
      });

      setClassSubjects(Array.from(subjectMap.values()));
    } catch (err) {
      console.error("fetchClassAndBanks error:", err);
      toast.error("Failed to load class question banks.");
    }
    setLoading(false);
  };

  const handleOpenBank = async (subject) => {
    setViewingSubject(subject);
    setQuestionsLoading(true);
    setActiveTab('ALL');
    try {
      const q = query(
        collection(db, "cia_question_bank"),
        where("courseCode", "==", subject.courseCode)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setQuestions(list);
    } catch (err) {
      console.error("Error loading questions:", err);
      toast.error("Failed to load questions for this subject.");
    }
    setQuestionsLoading(false);
  };

  // Filter subjects based on search & exam
  const filteredSubjects = classSubjects.filter(sub => {
    const matchesSearch = 
      (sub.courseCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sub.courseName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sub.facultyName || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (examFilter === 'PUBLISHED_ONLY') {
      return sub.isPublished;
    }
    if (examFilter === 'PENDING_ONLY') {
      return !sub.isPublished;
    }
    return true;
  });

  const partA = questions.filter(q => q.section === 'A');
  const partB = questions.filter(q => q.section === 'B');
  const partC = questions.filter(q => q.section === 'C');

  // Print Bank
  const handlePrint = () => {
    const printContent = document.getElementById("printable-incharge-bank");
    if (!printContent) return;

    const clone = printContent.cloneNode(true);
    clone.style.border = 'none';
    clone.style.maxWidth = '100%';
    clone.style.width = '100%';
    clone.style.margin = '0';
    clone.style.padding = '0';

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    iframe.contentDocument.write(`
      <html><head><title>Question Bank - ${viewingSubject?.courseCode || ''}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #000; margin: 0; padding: 20px 24px; }
        .page-border { position: fixed; top: 12px; left: 12px; right: 12px; bottom: 12px; border: 1.5px solid #000; pointer-events: none; z-index: 9999; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; page-break-inside: auto; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid !important; break-inside: avoid !important; }
        th, td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; font-size: 10.5pt; color: #000; }
        th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; font-weight: bold; }
        .part-title { text-align: center; font-weight: bold; margin: 16px 0 8px 0; font-size: 11pt; page-break-after: avoid; break-after: avoid; }
        @page { size: A4 portrait; margin: 15mm; }
      </style></head>
      <body>
        <div class="page-border"></div>
        <div>${clone.innerHTML}</div>
      </body></html>
    `);
    iframe.contentDocument.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => { document.body.removeChild(iframe); }, 1000);
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    if (questions.length === 0) {
      toast.error("No questions available to download.");
      return;
    }
    const printContent = document.getElementById("printable-incharge-bank");
    if (!printContent) return;

    toast.loading("Preparing PDF download...", { id: "pdf-toast" });

    const getBase64 = async (url) => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        return new Promise(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        return url;
      }
    };

    const leftLogo = await getBase64('/logo-left.png');
    const rightLogo = await getBase64('/logo-right.png');

    const clone = printContent.cloneNode(true);
    clone.style.border = 'none';
    clone.style.maxWidth = '100%';
    clone.style.width = '100%';

    let html = clone.outerHTML;
    html = html.replace(/\/logo-left\.png/g, leftLogo);
    html = html.replace(/\/logo-right\.png/g, rightLogo);

    const htmlString = `
      <style>
        * { box-sizing: border-box; }
        body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #000; margin: 0; padding: 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid !important; break-inside: avoid !important; }
        th, td { border: 1px solid #000; padding: 5px 6px; text-align: left; vertical-align: top; color: #000 !important; }
        .part-title { text-align: center; font-weight: bold; margin: 12px 0 6px 0; color: #000; page-break-after: avoid !important; break-after: avoid !important; }
      </style>
      <div style="width: 685px; box-sizing: border-box; background: #fff; color: #000; margin: 0 auto; padding: 4px 6px;">
        ${html}
      </div>
    `;

    const filename = `Question_Bank_${viewingSubject.courseCode}.pdf`;

    const opt = {
      margin:       [10, 10, 10, 10],
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'], avoid: ['tr', '.part-title', 'table'] }
    };

    html2pdf()
      .set(opt)
      .from(htmlString)
      .toPdf()
      .get('pdf')
      .then((pdf) => {
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.7);
          pdf.rect(6, 6, 210 - 12, 297 - 12);
          if (totalPages > 1) {
            pdf.setFont('times', 'normal');
            pdf.setFontSize(9);
            pdf.setTextColor(0, 0, 0);
            pdf.text(`Page ${i} of ${totalPages}`, 105, 294, { align: 'center' });
          }
        }
      })
      .save()
      .then(() => {
        toast.success("PDF downloaded successfully!", { id: "pdf-toast" });
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to generate PDF.", { id: "pdf-toast" });
      });
  };

  // Download Excel
  const handleDownloadExcel = () => {
    if (questions.length === 0) {
      toast.error("No questions available to download.");
      return;
    }
    try {
      const wb = XLSX.utils.book_new();
      const rows = [
        ["RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING"],
        ["Salvarpatti, Sivakasi - 626 128"],
        [`QUESTION BANK - ${viewingSubject.courseCode} ${viewingSubject.courseName}`],
        [],
        ["S.No", "Course Code", "Course Name", "Part / Section", "Unit", "Question Text", "Marks", "Difficulty / BTL", "CO", "Faculty"]
      ];

      questions.forEach((q, idx) => {
        const marks = q.section === 'A' ? 2 : q.section === 'B' ? 13 : 15;
        rows.push([
          idx + 1,
          q.courseCode || viewingSubject.courseCode,
          q.courseName || viewingSubject.courseName,
          `Part ${q.section || ''}`,
          q.unit ? `Unit ${q.unit}` : '',
          q.questionText || '',
          marks,
          q.difficulty || q.btlLevel || '',
          q.co || '',
          q.createdByName || viewingSubject.facultyName || ''
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Class Question Bank");
      XLSX.writeFile(wb, `Question_Bank_${viewingSubject.courseCode}.xlsx`);
      toast.success("Excel downloaded successfully!");
    } catch (e) {
      toast.error("Failed to export Excel.");
    }
  };

  const pubInfo = viewingSubject?.publishedInfo || {};
  const examNameStr = pubInfo.examName || 'MODEL EXAMINATION';
  const instructorStr = pubInfo.publishedByName || viewingSubject?.facultyName || 'Course Faculty';

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />

        {viewingSubject ? (
          <div>
            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <button 
                onClick={() => setViewingSubject(null)}
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6 }}
              >
                <ArrowLeft size={16} /> Back to Class Subjects
              </button>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: 5, 
                  padding: '6px 12px', 
                  borderRadius: 6, 
                  background: viewingSubject.isPublished ? '#dcfce7' : '#fef3c7', 
                  color: viewingSubject.isPublished ? '#15803d' : '#b45309', 
                  fontSize: 12, 
                  fontWeight: 600 
                }}>
                  {viewingSubject.isPublished ? <CheckCircle size={14} /> : <Clock size={14} />}
                  {viewingSubject.isPublished ? 'Published to Students & In-Charge' : 'Pending Publication by Faculty'}
                </span>

                <button 
                  onClick={handleDownloadPdf}
                  className="btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, background: '#dc2626', color: '#fff', border: 'none' }}
                >
                  <Download size={16} /> Download PDF
                </button>

                <button 
                  onClick={handleDownloadExcel}
                  className="btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6 }}
                >
                  <FileSpreadsheet size={16} color="#16a34a" /> Download Excel
                </button>

                <button 
                  onClick={handlePrint}
                  className="btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6 }}
                >
                  <Printer size={16} /> Print Bank
                </button>
              </div>
            </div>

            {/* Questions Filter Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { id: 'ALL', label: `All Questions (${questions.length})` },
                { id: 'A', label: `Part A (2 Marks - ${partA.length})` },
                { id: 'B', label: `Part B (13 Marks - ${partB.length})` },
                { id: 'C', label: `Part C (15 Marks - ${partC.length})` }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    background: activeTab === tab.id ? 'var(--primary-color)' : 'var(--card-bg)',
                    color: activeTab === tab.id ? '#fff' : 'var(--text)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Printable & Visible Paper Container */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {questionsLoading ? (
                <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}>
                  Loading questions for {viewingSubject.courseCode}...
                </div>
              ) : (
                <div 
                  id="printable-incharge-bank" 
                  style={{
                    maxWidth: 820,
                    margin: '20px auto',
                    background: '#ffffff',
                    color: '#000000',
                    padding: '24px 30px',
                    border: '1.5px solid #000000',
                    boxSizing: 'border-box',
                    fontFamily: '"Times New Roman", Times, serif',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.06)'
                  }}
                >
                  {/* Official RVCE Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: 10, marginBottom: 12 }}>
                    <div style={{ width: 80, display: 'flex', justifyContent: 'center' }}>
                      <img 
                        src="/logo-left.png" 
                        alt="College Logo" 
                        style={{ maxHeight: 68, maxWidth: 78, objectFit: 'contain' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                    <div style={{ textAlign: 'center', flex: 1, padding: '0 10px' }}>
                      <h2 style={{ margin: '0 0 4px 0', fontSize: '15pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#000' }}>
                        RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING
                      </h2>
                      <div style={{ fontSize: '10pt', color: '#000', marginBottom: 6 }}>
                        (Approved by AICTE - New Delhi & Affiliated to Anna University, Chennai)
                      </div>
                      <div style={{ fontSize: '10pt', color: '#000', marginBottom: 8 }}>
                        Salvarpatti, Sivakasi - 626 128
                      </div>
                      <div style={{ display: 'inline-block', border: '1.5px solid #000', padding: '3px 18px', fontWeight: 'bold', fontSize: '11pt', letterSpacing: '0.5px' }}>
                        {examNameStr} — QUESTION BANK
                      </div>
                    </div>
                    <div style={{ width: 80, display: 'flex', justifyContent: 'center' }}>
                      <img 
                        src="/logo-right.png" 
                        alt="Sub Logo" 
                        style={{ maxHeight: 68, maxWidth: 78, objectFit: 'contain' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  </div>

                  {/* Metadata Table */}
                  <table style={{ width: '100%', marginBottom: 15, borderCollapse: 'collapse', fontSize: '10pt' }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '60%', padding: '4px 6px', border: '1px solid #000' }}>
                          <strong>Course Instructor:</strong> {instructorStr}
                        </td>
                        <td style={{ width: '40%', padding: '4px 6px', border: '1px solid #000' }}>
                          <strong>Class / Semester:</strong> {toRomanSem(viewingSubject.semester || classInchargeInfo?.year) || 'IV / VII'}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 6px', border: '1px solid #000' }}>
                          <strong>Course Code & Name:</strong> {viewingSubject.courseCode} - {viewingSubject.courseName}
                        </td>
                        <td style={{ padding: '4px 6px', border: '1px solid #000' }}>
                          <strong>Academic Year:</strong> {pubInfo.year || '2026-2027'}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 6px', border: '1px solid #000' }}>
                          <strong>Department:</strong> {viewingSubject.department || classInchargeInfo?.dept || 'CSE'}
                        </td>
                        <td style={{ padding: '4px 6px', border: '1px solid #000' }}>
                          <strong>Total Questions:</strong> {questions.length} Questions
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Part A Table */}
                  {(activeTab === 'ALL' || activeTab === 'A') && partA.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div className="part-title" style={{ background: '#f8fafc', padding: '6px', border: '1px solid #000', borderBottom: 'none' }}>
                        PART – A (2 Marks Each)
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9' }}>
                            <th style={{ width: 45, textAlign: 'center', border: '1px solid #000', padding: '5px' }}>Q.No</th>
                            <th style={{ textAlign: 'left', border: '1px solid #000', padding: '5px' }}>Question Text</th>
                            <th style={{ width: 90, textAlign: 'center', border: '1px solid #000', padding: '5px' }}>Unit / BTL</th>
                            <th style={{ width: 60, textAlign: 'center', border: '1px solid #000', padding: '5px' }}>CO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {partA.map((q, idx) => (
                            <tr key={q.id || idx}>
                              <td style={{ textAlign: 'center', border: '1px solid #000', padding: '5px' }}>{idx + 1}</td>
                              <td style={{ border: '1px solid #000', padding: '5px', lineHeight: 1.35 }}>{q.questionText}</td>
                              <td style={{ textAlign: 'center', border: '1px solid #000', padding: '5px', fontSize: '9pt' }}>
                                Unit {q.unit || '1'}<br />
                                <span style={{ color: '#555', fontSize: '8.5pt' }}>{q.difficulty || q.btlLevel || 'BTL2'}</span>
                              </td>
                              <td style={{ textAlign: 'center', border: '1px solid #000', padding: '5px', fontSize: '9pt' }}>{q.co || `CO${q.unit || 1}`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Part B Table */}
                  {(activeTab === 'ALL' || activeTab === 'B') && partB.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div className="part-title" style={{ background: '#f8fafc', padding: '6px', border: '1px solid #000', borderBottom: 'none' }}>
                        PART – B (13 Marks Each)
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9' }}>
                            <th style={{ width: 45, textAlign: 'center', border: '1px solid #000', padding: '5px' }}>Q.No</th>
                            <th style={{ textAlign: 'left', border: '1px solid #000', padding: '5px' }}>Question Text</th>
                            <th style={{ width: 90, textAlign: 'center', border: '1px solid #000', padding: '5px' }}>Unit / BTL</th>
                            <th style={{ width: 60, textAlign: 'center', border: '1px solid #000', padding: '5px' }}>CO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {partB.map((q, idx) => (
                            <tr key={q.id || idx}>
                              <td style={{ textAlign: 'center', border: '1px solid #000', padding: '5px' }}>{idx + 1}</td>
                              <td style={{ border: '1px solid #000', padding: '5px', lineHeight: 1.35 }}>{q.questionText}</td>
                              <td style={{ textAlign: 'center', border: '1px solid #000', padding: '5px', fontSize: '9pt' }}>
                                Unit {q.unit || '1'}<br />
                                <span style={{ color: '#555', fontSize: '8.5pt' }}>{q.difficulty || q.btlLevel || 'BTL3'}</span>
                              </td>
                              <td style={{ textAlign: 'center', border: '1px solid #000', padding: '5px', fontSize: '9pt' }}>{q.co || `CO${q.unit || 1}`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Part C Table */}
                  {(activeTab === 'ALL' || activeTab === 'C') && partC.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div className="part-title" style={{ background: '#f8fafc', padding: '6px', border: '1px solid #000', borderBottom: 'none' }}>
                        PART – C (15 Marks Each)
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9' }}>
                            <th style={{ width: 45, textAlign: 'center', border: '1px solid #000', padding: '5px' }}>Q.No</th>
                            <th style={{ textAlign: 'left', border: '1px solid #000', padding: '5px' }}>Question Text</th>
                            <th style={{ width: 90, textAlign: 'center', border: '1px solid #000', padding: '5px' }}>Unit / BTL</th>
                            <th style={{ width: 60, textAlign: 'center', border: '1px solid #000', padding: '5px' }}>CO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {partC.map((q, idx) => (
                            <tr key={q.id || idx}>
                              <td style={{ textAlign: 'center', border: '1px solid #000', padding: '5px' }}>{idx + 1}</td>
                              <td style={{ border: '1px solid #000', padding: '5px', lineHeight: 1.35 }}>{q.questionText}</td>
                              <td style={{ textAlign: 'center', border: '1px solid #000', padding: '5px', fontSize: '9pt' }}>
                                Unit {q.unit || '1'}<br />
                                <span style={{ color: '#555', fontSize: '8.5pt' }}>{q.difficulty || q.btlLevel || 'BTL4'}</span>
                              </td>
                              <td style={{ textAlign: 'center', border: '1px solid #000', padding: '5px', fontSize: '9pt' }}>{q.co || `CO${q.unit || 1}`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {questions.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 40, color: '#777' }}>
                      <AlertCircle size={32} style={{ opacity: 0.5, marginBottom: 8, display: 'inline-block' }} />
                      <p>No questions found in this Question Bank pool yet.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            {/* Page Header */}
            <div className='page-header' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 15 }}>
              <div>
                <h1>Class Question Banks</h1>
                <p className="subtitle">
                  Review CIA Question Banks published by subject faculty for your assigned class
                </p>
              </div>

              {/* Class Incharge Badge */}
              <div style={{
                background: 'rgba(37, 99, 235, 0.08)',
                border: '1px solid rgba(37, 99, 235, 0.2)',
                padding: '8px 16px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                <GraduationCap size={22} color="#2563eb" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>
                    {classInchargeInfo?.dept || userProfile?.dept || 'CSE'} - Year {classInchargeInfo?.year || '2'} {classInchargeInfo?.section ? `(Sec ${classInchargeInfo.section})` : ''}
                  </div>
                  <div style={{ fontSize: 11, color: '#4b5563' }}>
                    Class In-Charge: <strong>{userProfile?.name || 'Faculty'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 15, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <div className="search-bar" style={{ flex: 1, minWidth: 260, maxWidth: 420 }}>
                  <Search size={18} color="#9ca3af" />
                  <input 
                    type="text" 
                    placeholder="Search by course code, name, or faculty..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <select 
                    value={examFilter} 
                    onChange={(e) => setExamFilter(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontSize: 13 }}
                  >
                    <option value="ALL">All Subjects ({classSubjects.length})</option>
                    <option value="PUBLISHED_ONLY">Published Only ({classSubjects.filter(s => s.isPublished).length})</option>
                    <option value="PENDING_ONLY">Pending Publication ({classSubjects.filter(s => !s.isPublished).length})</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Subjects Grid */}
            {loading ? (
              <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                Loading Class Question Banks...
              </div>
            ) : filteredSubjects.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}>
                <BookOpen size={42} style={{ opacity: 0.4, marginBottom: 12, display: 'inline-block' }} />
                <h3 style={{ margin: '0 0 6px 0', color: 'var(--text)' }}>No Subjects Found</h3>
                <p style={{ margin: 0, fontSize: 13 }}>
                  No subject allocations found matching the search filter for this class.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {filteredSubjects.map(sub => (
                  <div 
                    key={sub.id || sub.courseCode}
                    className="card"
                    style={{
                      padding: 18,
                      borderRadius: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      border: '1px solid var(--border-color)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                    }}
                  >
                    <div>
                      {/* Top Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ 
                          fontSize: 11, 
                          padding: '3px 8px', 
                          borderRadius: 4, 
                          background: 'rgba(37, 99, 235, 0.1)', 
                          color: '#2563eb', 
                          fontWeight: 700 
                        }}>
                          {sub.courseCode}
                        </span>

                        <span style={{ 
                          fontSize: 11, 
                          padding: '3px 8px', 
                          borderRadius: 4, 
                          background: sub.isPublished ? '#dcfce7' : '#fef3c7', 
                          color: sub.isPublished ? '#15803d' : '#b45309', 
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          {sub.isPublished ? <CheckCircle size={12} /> : <Clock size={12} />}
                          {sub.isPublished ? 'Published to Class' : 'Pending Publish'}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: 'var(--text)', fontWeight: 600 }}>
                        {sub.courseName}
                      </h3>

                      {/* Faculty */}
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <User size={13} /> Handled by: <strong style={{ color: 'var(--text)' }}>{sub.facultyName}</strong>
                      </div>

                      {/* Exam info if published */}
                      {sub.publishedInfo?.examName && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FileText size={13} /> Exam: <strong>{sub.publishedInfo.examName}</strong>
                        </div>
                      )}

                      {/* Dept / Sem */}
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                        Class: <strong>{sub.department} {sub.semester ? `Sem ${sub.semester}` : ''} {sub.section && sub.section !== 'None' ? `Sec ${sub.section}` : ''}</strong>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {sub.isPublished ? 'Ready for Review' : 'Draft / In Progress'}
                      </span>
                      <button
                        onClick={() => handleOpenBank(sub)}
                        className="btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 12, borderRadius: 6 }}
                      >
                        <Eye size={14} /> View Question Bank
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
