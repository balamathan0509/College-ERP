import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, getDocs, where, orderBy } from "../../supabase/supabaseAdapter";
import { useAuth } from '../../context/AuthContext';
import { Eye, Printer, Search, ArrowLeft, Download, BookOpen, CheckCircle, FileText, Calendar, User } from 'lucide-react';
import html2pdf from 'html2pdf.js';
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

export default function StudentQuestionBank() {
  const [publishedBanks, setPublishedBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [viewingBank, setViewingBank] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');
  
  const { userProfile } = useAuth();

  useEffect(() => {
    fetchPublishedBanks();
  }, [userProfile]);

  const fetchPublishedBanks = async () => {
    setLoading(true);
    try {
      // 1. Fetch published banks from cia_published_question_banks
      let list = [];
      try {
        const qPub = query(collection(db, "cia_published_question_banks"), where("isPublished", "==", true));
        const snap = await getDocs(qPub);
        list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (e) {
        console.warn("Error fetching cia_published_question_banks:", e);
      }

      // Filter by department if available
      const userDept = (userProfile?.dept || userProfile?.department || '').trim().toUpperCase();
      if (userDept && list.length > 0) {
        const filtered = list.filter(b => !b.department || String(b.department).trim().toUpperCase() === userDept || String(b.department).trim().toUpperCase() === 'ALL');
        if (filtered.length > 0) {
          list = filtered;
        }
      }

      // Sort by publishedAt desc
      list.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
      setPublishedBanks(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load question banks.");
    }
    setLoading(false);
  };

  const handleView = async (bank) => {
    setViewingBank(bank);
    setQuestionsLoading(true);
    setActiveTab('ALL');
    try {
      const q = query(collection(db, "cia_question_bank"), where("courseCode", "==", bank.courseCode));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setQuestions(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load questions.");
    }
    setQuestionsLoading(false);
  };

  const handlePrint = () => {
    const printContent = document.getElementById("printable-question-bank");
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
      <html><head><title>Question Bank - ${viewingBank?.courseCode || ''}</title>
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        * { box-sizing: border-box; }
        body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #000; margin: 0; padding: 0; }
        .page-border { position: fixed; top: 0; left: 0; right: 0; bottom: 0; border: 2px solid #000; pointer-events: none; box-sizing: border-box; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top; font-size: 11pt; color: #000 !important; }
        th { font-weight: bold; }
        .text-center { text-align: center; }
        .header-table td { border: none !important; padding: 3px 6px; }
      </style></head>
      <body>
        <div class="page-border"></div>
        ${clone.outerHTML}
      </body></html>
    `);
    iframe.contentDocument.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      document.body.removeChild(iframe);
    }, 400);
  };

  const handleDownloadPdf = () => {
    const printElement = document.getElementById("printable-question-bank");
    if (!printElement) {
      toast.error("Preview not ready.");
      return;
    }
    toast.loading("Generating PDF...", { id: "qb-download" });

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `Question_Bank_${viewingBank?.courseCode || 'Course'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(printElement).save()
      .then(() => toast.success("Downloaded Question Bank PDF!", { id: "qb-download" }))
      .catch((err) => {
        console.error(err);
        toast.error("Failed to generate PDF.", { id: "qb-download" });
      });
  };

  const partA = questions.filter(q => String(q.marks) === '2' || q.section === 'A' || q.part === 'A');
  const partB = questions.filter(q => String(q.marks) === '13' || String(q.marks) === '16' || q.section === 'B' || q.part === 'B');
  const partC = questions.filter(q => String(q.marks) === '14' || String(q.marks) === '15' || q.section === 'C' || q.part === 'C');

  const filteredQuestions = activeTab === 'A' ? partA
                          : activeTab === 'B' ? partB
                          : activeTab === 'C' ? partC
                          : questions;

  const filteredBanks = publishedBanks.filter(b => {
    const term = searchTerm.toLowerCase();
    return (b.courseCode || '').toLowerCase().includes(term) ||
           (b.courseName || '').toLowerCase().includes(term) ||
           (b.examName || '').toLowerCase().includes(term) ||
           (b.publishedByName || '').toLowerCase().includes(term);
  });

  return (
    <div className='app-container'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />

        {viewingBank ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
              <button 
                onClick={() => setViewingBank(null)} 
                className="btn-secondary" 
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}
              >
                <ArrowLeft size={16} /> Back to Question Banks
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button 
                  onClick={handleDownloadPdf} 
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 500, fontSize: '13px' }}
                >
                  <Download size={16} /> Download PDF
                </button>
                <button 
                  onClick={handlePrint} 
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: 'none', background: '#405189', color: '#fff', cursor: 'pointer', fontWeight: 500, fontSize: '13px' }}
                >
                  <Printer size={16} /> Print Bank
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('ALL')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: activeTab === 'ALL' ? '1px solid #2563eb' : '1px solid var(--border-color)',
                    background: activeTab === 'ALL' ? '#2563eb' : 'transparent',
                    color: activeTab === 'ALL' ? '#ffffff' : 'var(--text)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13
                  }}
                >
                  All Questions ({questions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('A')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: activeTab === 'A' ? '1px solid #16a34a' : '1px solid var(--border-color)',
                    background: activeTab === 'A' ? '#16a34a' : 'transparent',
                    color: activeTab === 'A' ? '#ffffff' : 'var(--text)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13
                  }}
                >
                  Part A (2 Marks)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('B')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: activeTab === 'B' ? '1px solid #2563eb' : '1px solid var(--border-color)',
                    background: activeTab === 'B' ? '#2563eb' : 'transparent',
                    color: activeTab === 'B' ? '#ffffff' : 'var(--text)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13
                  }}
                >
                  Part B (13 Marks)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('C')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: activeTab === 'C' ? '1px solid #9333ea' : '1px solid var(--border-color)',
                    background: activeTab === 'C' ? '#9333ea' : 'transparent',
                    color: activeTab === 'C' ? '#ffffff' : 'var(--text)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13
                  }}
                >
                  Part C ({viewingBank.examName?.toLowerCase().includes('model') ? '15' : '14'} Marks)
                </button>
              </div>
            </div>

            {/* Official College Document Preview */}
            <div className="card" style={{ padding: 25, background: '#fff', color: '#000', borderRadius: 8, boxShadow: '0 4px 15px rgba(0,0,0,0.06)' }}>
              {questionsLoading ? (
                <div style={{ textAlign: 'center', padding: 50, color: '#666' }}>Loading Question Bank...</div>
              ) : (
                <div id="printable-question-bank" style={{ background: '#fff', color: '#000', fontFamily: '"Times New Roman", Times, serif', padding: '15px' }}>
                  
                  {/* RVCE Header */}
                  <div style={{ textAlign: 'center', marginBottom: 15, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <div style={{ width: 80, textAlign: 'left' }}>
                        <img 
                          src="/assets/images/rvce-logo.png" 
                          alt="RVCE" 
                          style={{ maxHeight: 70, maxWidth: 80, objectFit: 'contain' }}
                          onError={(e) => { e.target.style.display = 'none'; }} 
                        />
                      </div>
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '15pt', fontWeight: 'bold', color: '#b91c1c', letterSpacing: '0.5px' }}>
                          RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING
                        </div>
                        <div style={{ fontSize: '10pt', color: '#333', marginTop: 2 }}>
                          Salvarpatti, Sivakasi - 626 128
                        </div>
                        <div style={{ display: 'inline-block', border: '1.5px solid #000', borderRadius: 20, padding: '4px 18px', marginTop: 8, fontSize: '10.5pt', fontWeight: 'bold', letterSpacing: '0.8px' }}>
                          {viewingBank.examName || 'MODEL EXAMINATION'} — QUESTION BANK
                        </div>
                      </div>
                      <div style={{ width: 80, textAlign: 'right' }}>
                        <img 
                          src="/assets/images/rvce-sublogo.png" 
                          alt="Logo" 
                          style={{ maxHeight: 65, maxWidth: 75, objectFit: 'contain' }}
                          onError={(e) => { e.target.style.display = 'none'; }} 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Metadata Table */}
                  <table className="header-table" style={{ width: '100%', marginBottom: 15, borderCollapse: 'collapse', fontSize: '10pt' }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '60%', padding: '3px 0' }}>
                          <strong>Name of the Course Instructor:</strong> {viewingBank.publishedByName || 'Course Faculty'}
                        </td>
                        <td style={{ width: '40%', padding: '3px 0' }}>
                          <strong>Class / Semester:</strong> {toRomanSem(viewingBank.semester) || 'IV / VII'}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '3px 0' }}>
                          <strong>Course Code & Name:</strong> {viewingBank.courseCode} - {viewingBank.courseName || ''}
                        </td>
                        <td style={{ padding: '3px 0' }}>
                          <strong>Academic Year:</strong> {viewingBank.year || '2026-2027'}
                        </td>
                      </tr>
                      {viewingBank.publishedAt && (
                        <tr>
                          <td style={{ padding: '3px 0' }}>
                            <strong>Published Date:</strong> {new Date(viewingBank.publishedAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '3px 0' }}>
                            <strong>Total Questions:</strong> {questions.length} Questions
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Render Question Tables */}
                  {(activeTab === 'ALL' || activeTab === 'A') && partA.length > 0 && (
                    <div style={{ marginBottom: 25 }}>
                      <div style={{ fontWeight: 'bold', textAlign: 'center', background: '#f8fafc', padding: '6px', border: '1px solid #000', borderBottom: 'none', fontSize: '11pt' }}>
                        PART – A (2 Marks)
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5pt' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9' }}>
                            <th style={{ width: 45, textAlign: 'center', border: '1px solid #000', padding: 6 }}>Q.No</th>
                            <th style={{ textAlign: 'left', border: '1px solid #000', padding: 6 }}>Question Text</th>
                            <th style={{ width: 100, textAlign: 'center', border: '1px solid #000', padding: 6 }}>Unit / Level</th>
                          </tr>
                        </thead>
                        <tbody>
                          {partA.map((q, idx) => (
                            <tr key={q.id || idx}>
                              <td style={{ textAlign: 'center', border: '1px solid #000', padding: 6 }}>{idx + 1}</td>
                              <td style={{ border: '1px solid #000', padding: 6, lineHeight: 1.4 }}>{q.questionText}</td>
                              <td style={{ textAlign: 'center', border: '1px solid #000', padding: 6, fontSize: '9pt', color: '#555' }}>
                                Unit {q.unit || '1'}<br />
                                <span style={{ fontSize: '8pt', color: '#777' }}>{q.difficulty || 'Medium'}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {(activeTab === 'ALL' || activeTab === 'B') && partB.length > 0 && (
                    <div style={{ marginBottom: 25 }}>
                      <div style={{ fontWeight: 'bold', textAlign: 'center', background: '#f8fafc', padding: '6px', border: '1px solid #000', borderBottom: 'none', fontSize: '11pt' }}>
                        PART – B (13 Marks)
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5pt' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9' }}>
                            <th style={{ width: 45, textAlign: 'center', border: '1px solid #000', padding: 6 }}>Q.No</th>
                            <th style={{ textAlign: 'left', border: '1px solid #000', padding: 6 }}>Question Text</th>
                            <th style={{ width: 100, textAlign: 'center', border: '1px solid #000', padding: 6 }}>Unit / Level</th>
                          </tr>
                        </thead>
                        <tbody>
                          {partB.map((q, idx) => (
                            <tr key={q.id || idx}>
                              <td style={{ textAlign: 'center', border: '1px solid #000', padding: 6 }}>{idx + 1}</td>
                              <td style={{ border: '1px solid #000', padding: 6, lineHeight: 1.4 }}>{q.questionText}</td>
                              <td style={{ textAlign: 'center', border: '1px solid #000', padding: 6, fontSize: '9pt', color: '#555' }}>
                                Unit {q.unit || '1'}<br />
                                <span style={{ fontSize: '8pt', color: '#777' }}>{q.difficulty || 'Medium'}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {(activeTab === 'ALL' || activeTab === 'C') && partC.length > 0 && (
                    <div style={{ marginBottom: 25 }}>
                      <div style={{ fontWeight: 'bold', textAlign: 'center', background: '#f8fafc', padding: '6px', border: '1px solid #000', borderBottom: 'none', fontSize: '11pt' }}>
                        PART – C ({viewingBank.examName?.toLowerCase().includes('model') ? '15' : '14'} Marks)
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5pt' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9' }}>
                            <th style={{ width: 45, textAlign: 'center', border: '1px solid #000', padding: 6 }}>Q.No</th>
                            <th style={{ textAlign: 'left', border: '1px solid #000', padding: 6 }}>Question Text</th>
                            <th style={{ width: 100, textAlign: 'center', border: '1px solid #000', padding: 6 }}>Unit / Level</th>
                          </tr>
                        </thead>
                        <tbody>
                          {partC.map((q, idx) => (
                            <tr key={q.id || idx}>
                              <td style={{ textAlign: 'center', border: '1px solid #000', padding: 6 }}>{idx + 1}</td>
                              <td style={{ border: '1px solid #000', padding: 6, lineHeight: 1.4 }}>{q.questionText}</td>
                              <td style={{ textAlign: 'center', border: '1px solid #000', padding: 6, fontSize: '9pt', color: '#555' }}>
                                Unit {q.unit || '1'}<br />
                                <span style={{ fontSize: '8pt', color: '#777' }}>{q.difficulty || 'Medium'}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {questions.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 30, color: '#777' }}>
                      No questions available in this bank.
                    </div>
                  )}

                </div>
              )}
            </div>

          </div>
        ) : (
          <div>
            <div className='page-header'>
              <h1>Course Question Banks</h1>
              <p className="subtitle">Official CIA Question Banks published by course instructors for study and exam preparation</p>
            </div>

            {/* Filter Card */}
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
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Showing <strong style={{ color: 'var(--text)' }}>{filteredBanks.length}</strong> Published Banks
                </div>
              </div>
            </div>

            {/* Banks Grid / List */}
            {loading ? (
              <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                Loading available Question Banks...
              </div>
            ) : filteredBanks.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}>
                <BookOpen size={42} style={{ opacity: 0.4, marginBottom: 12, display: 'inline-block' }} />
                <h3 style={{ margin: '0 0 6px 0', color: 'var(--text)' }}>No Question Banks Published Yet</h3>
                <p style={{ margin: 0, fontSize: 13 }}>
                  When your course instructors publish their Question Bank, it will appear here for you to view and download.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {filteredBanks.map(bank => (
                  <div 
                    key={bank.id} 
                    className="card" 
                    style={{ 
                      padding: 18, 
                      borderRadius: 10, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontWeight: 700 }}>
                          {bank.courseCode}
                        </span>
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#dcfce7', color: '#15803d', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle size={12} /> Published
                        </span>
                      </div>

                      <h3 style={{ margin: '0 0 6px 0', fontSize: 16, color: 'var(--text)', fontWeight: 600 }}>
                        {bank.courseName || bank.courseCode}
                      </h3>

                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FileText size={13} /> {bank.examName || 'MODEL EXAMINATION'}
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <User size={13} /> Faculty: <strong style={{ color: 'var(--text)' }}>{bank.publishedByName || 'Staff'}</strong>
                      </div>

                      {bank.department && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                          Class: <strong>{bank.department} {bank.semester ? `Sem ${bank.semester}` : ''} {bank.section && bank.section !== 'None' ? `Sec ${bank.section}` : ''}</strong>
                        </div>
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {bank.totalQuestions ? `${bank.totalQuestions} Questions` : 'Questions Ready'}
                      </span>
                      <button
                        onClick={() => handleView(bank)}
                        className="btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, borderRadius: 6 }}
                      >
                        <Eye size={14} /> View Bank
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
