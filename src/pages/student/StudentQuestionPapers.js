import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { db } from '../../firebase/config';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Eye, Printer, Search, ArrowLeft, Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import toast, { Toaster } from 'react-hot-toast';

export default function StudentQuestionPapers() {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [viewingPaper, setViewingPaper] = useState(null);
  const [questionsPool, setQuestionsPool] = useState([]);
  const [poolLoading, setPoolLoading] = useState(false);
  
  const { userProfile } = useAuth();

  useEffect(() => {
    if (userProfile?.uid) {
      fetchPapers();
    }
  }, [userProfile]);

  const fetchPapers = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "cia_question_papers"),
        where("status", "==", "APPROVED")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      list.sort((a, b) => {
        const tA = a.createdAt?.toMillis() || 0;
        const tB = b.createdAt?.toMillis() || 0;
        return tB - tA;
      });
      setPapers(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load question papers.");
    }
    setLoading(false);
  };

  const handleView = async (p) => {
    setViewingPaper(p);
    setPoolLoading(true);
    try {
      // Fetch the question pool for this course to resolve the question IDs
      const q = query(collection(db, "cia_question_bank"), where("courseCode", "==", p.courseCode));
      const snap = await getDocs(q);
      const qList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setQuestionsPool(qList);
    } catch (err) {
      console.error(err);
    }
    setPoolLoading(false);
  };

  const handlePrint = () => {
    const printContent = document.getElementById("printable-paper");
    if (!printContent) return;
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    iframe.contentDocument.write(`
      <html><head><title>Question Paper</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body { font-family: "Times New Roman", Times, serif; font-size: 12pt; color: #000; margin: 0; padding: 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 6px; text-align: left; vertical-align: top; color: #000 !important; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .outer-border { border: 3px solid #000; padding: 10px; margin-bottom: 5px; }
      </style></head>
      <body><div class="outer-border">${printContent.innerHTML}</div></body></html>
    `);
    iframe.contentDocument.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => { document.body.removeChild(iframe); }, 1000);
  };

  const handleDownloadPdf = async () => {
    const printContent = document.getElementById("printable-paper");
    if (!printContent) return;

    // Convert logos to base64 to ensure they render instantly in the detached string
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

    let html = printContent.outerHTML;
    html = html.replace(/\/logo-left\.png/g, leftLogo);
    html = html.replace(/\/logo-right\.png/g, rightLogo);

    // Wrap in exactly 720px container to match A4 printable width and prevent clipping
    const htmlString = `
      <div style="width: 720px; box-sizing: border-box; background: #fff; color: #000; margin: 0; padding: 0;">
        ${html}
      </div>
    `;

    const filename = viewingPaper?.headerConfig?.courseCodeName ? `Question_Paper_${viewingPaper.headerConfig.courseCodeName}.pdf` : `Question_Paper.pdf`;

    const opt = {
      margin:       10,
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, windowWidth: 720 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(htmlString).save();
  };

  const filteredPapers = papers.filter(p => 
    (p.courseCode || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.headerConfig?.courseCodeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.headerConfig?.examName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />
        
        {!viewingPaper ? (
          <>
            <div className='page-header' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 15 }}>
              <div>
                <h1>Question Papers</h1>
                <p className="subtitle">View and download your examination question papers</p>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              <div className="search-bar" style={{ maxWidth: 400 }}>
                <Search size={18} color="#9ca3af" />
                <input 
                  type="text" 
                  placeholder="Search by course code or exam name..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}
                />
              </div>
            </div>

            <div className="card">
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
              ) : filteredPapers.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No approved question papers available at the moment.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '12px 10px' }}>Exam</th>
                        <th style={{ padding: '12px 10px' }}>Course</th>
                        <th style={{ padding: '12px 10px' }}>Class / Sem</th>
                        <th style={{ padding: '12px 10px' }}>Date of Exam</th>
                        <th style={{ padding: '12px 10px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPapers.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 10px', fontWeight: 500 }}>{p.headerConfig?.examName}</td>
                          <td style={{ padding: '12px 10px' }}>{p.headerConfig?.courseCodeName}</td>
                          <td style={{ padding: '12px 10px' }}>{p.headerConfig?.classSemester}</td>
                          <td style={{ padding: '12px 10px' }}>{p.headerConfig?.examDate || '-'}</td>
                          <td style={{ padding: '12px 10px' }}>
                            <button 
                              onClick={() => handleView(p)}
                              style={{ 
                                padding: '6px 12px', 
                                borderRadius: 6, 
                                border: '1px solid #3b82f6', 
                                background: 'rgba(59,130,246,0.1)', 
                                color: '#3b82f6', 
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontWeight: 600
                              }}>
                              <Eye size={16} /> View Paper
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <button onClick={() => setViewingPaper(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeft size={16} /> Back to List
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleDownloadPdf} disabled={poolLoading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}>
                  <Download size={16} /> Download PDF
                </button>
                <button onClick={handlePrint} disabled={poolLoading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #6366f1', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                  <Printer size={16} /> Print Paper
                </button>
              </div>
            </div>
            
            {poolLoading ? (
               <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading paper contents...</div>
            ) : (
              <div style={{ background: '#fff', color: '#000', padding: '20px 40px', borderRadius: 8, overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
                <div id="printable-paper" style={{ fontFamily: '"Times New Roman", Times, serif', width: '100%', maxWidth: '800px', margin: '0 auto', fontSize: '13px', border: '3px solid #000', padding: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 15, color: '#000', gap: 15 }}>
                    <div style={{ fontWeight: 'bold' }}>Register Number</div>
                    <div style={{ display: 'flex' }}>{[1,2,3,4,5,6,7,8,9,10,11,12].map(i => <div key={i} style={{ width: 20, height: 20, border: '1px solid #000', borderRight: i === 12 ? '1px solid #000' : 'none' }}></div>)}</div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, color: '#000' }}>
                    <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/logo-left.png" alt="Left Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={(e) => e.target.style.display = 'none'} /></div>
                    <div style={{ textAlign: 'center', flex: 1, padding: '0 15px' }}>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#b91c1c' }}>{viewingPaper.headerConfig?.collegeName || 'RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING'}</div>
                      <div style={{ fontSize: '14px', marginBottom: 10 }}>{viewingPaper.headerConfig?.collegeAddress || 'Salvarpatti, Sivakasi - 626 128'}</div>
                      <div style={{ display: 'inline-block', border: '1px solid #1e3a8a', borderRadius: '15px', padding: '5px 20px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: 5 }}>{viewingPaper.headerConfig?.examName}</div>
                    </div>
                    <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/logo-right.png" alt="Right Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={(e) => e.target.style.display = 'none'} /></div>
                  </div>

                  <table style={{ width: '100%', border: 'none', marginBottom: 15, color: '#000' }}>
                    <tbody>
                      <tr><td style={{ border: 'none', padding: '4px 0', width: '60%', color: '#000' }}>Name of the Course Instructor: <span style={{ fontWeight: 'bold', color: '#000' }}>{viewingPaper.headerConfig?.instructorName}</span></td><td style={{ border: 'none', padding: '4px 0', width: '40%', color: '#000' }}>Class / Semester: <span style={{ fontWeight: 'bold', color: '#000' }}>{viewingPaper.headerConfig?.classSemester}</span></td></tr>
                      <tr><td style={{ border: 'none', padding: '4px 0', color: '#000' }}>Course Code & Name: <span style={{ fontWeight: 'bold', color: '#000' }}>{viewingPaper.headerConfig?.courseCodeName}</span></td><td style={{ border: 'none', padding: '4px 0', color: '#000' }}>Academic Year: <span style={{ fontWeight: 'bold', color: '#000' }}>{viewingPaper.headerConfig?.academicYear}</span></td></tr>
                      <tr><td colSpan="2" style={{ border: 'none', padding: '4px 0', color: '#000' }}>Date of Exam: <span style={{ fontWeight: 'bold', color: '#000' }}>{viewingPaper.headerConfig?.examDate}</span></td></tr>
                    </tbody>
                  </table>
                  
                  <div style={{ textAlign: 'center', marginBottom: 15, color: '#000' }}><div>Answer <span style={{ fontWeight: 'bold' }}>ALL</span> the questions</div><div style={{ fontWeight: 'bold' }}>{viewingPaper.headings?.partA || 'PART – A (5 × 2 = 10 Marks)'}</div></div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, color: '#000' }}>
                    <tbody>
                      {viewingPaper.partAQuestions?.map((id, idx) => { 
                        const q = questionsPool.find(x => x.id === id); 
                        if(!q) return null;
                        return (
                          <tr key={idx}>
                            <td style={{ border: '1px solid #000', padding: '6px', width: '30px', verticalAlign: 'top', color: '#000' }}>{idx + 1}</td>
                            <td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{q.questionText}</td>
                            <td style={{ border: '1px solid #000', padding: '6px', width: '80px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{q.btlLevel || 'UN'},{q.co || 'CO3'}</td>
                          </tr>
                        ); 
                      })}
                    </tbody>
                  </table>

                  <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 10, color: '#000' }}>{viewingPaper.headings?.partB || 'PART – B (2 × 13 = 26 Marks)'}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, color: '#000' }}>
                    <tbody>
                      {viewingPaper.partBQuestions?.map((pair, idx) => { 
                        const qNum = (viewingPaper.partAQuestions?.length || 5) + 1 + idx; 
                        const qA = questionsPool.find(x => x.id === pair.a); 
                        const qB = questionsPool.find(x => x.id === pair.b); 
                        if(!qA && !qB) return null;
                        return (
                          <React.Fragment key={idx}>
                            {qA && (
                              <tr>
                                <td style={{ border: '1px solid #000', padding: '6px', width: '30px', verticalAlign: 'top', color: '#000' }}>{qNum} a)</td>
                                <td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{qA.questionText}</td>
                                <td style={{ border: '1px solid #000', padding: '6px', width: '80px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{qA.btlLevel || 'UN'},{qA.co || 'CO3'}</td>
                              </tr>
                            )}
                            {qA && qB && (
                              <tr><td colSpan="3" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold', color: '#000' }}>(OR)</td></tr>
                            )}
                            {qB && (
                              <tr>
                                <td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', color: '#000' }}>{qNum} b)</td>
                                <td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{qB.questionText}</td>
                                <td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{qB.btlLevel || 'UN'},{qB.co || 'CO3'}</td>
                              </tr>
                            )}
                          </React.Fragment>
                        ); 
                      })}
                    </tbody>
                  </table>

                  <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 10, color: '#000' }}>{viewingPaper.headings?.partC || 'PART – C (1 × 14 = 14 Marks)'}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 30, color: '#000' }}>
                    <tbody>
                      {viewingPaper.partCQuestions?.map((pair, idx) => { 
                        const qNum = (viewingPaper.partAQuestions?.length || 5) + (viewingPaper.partBQuestions?.length || 2) + 1 + idx; 
                        const qA = questionsPool.find(x => x.id === pair.a); 
                        const qB = questionsPool.find(x => x.id === pair.b); 
                        if(!qA && !qB) return null;
                        return (
                          <React.Fragment key={idx}>
                            {qA && (
                              <tr>
                                <td style={{ border: '1px solid #000', padding: '6px', width: '30px', verticalAlign: 'top', color: '#000' }}>{qNum} a)</td>
                                <td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{qA.questionText}</td>
                                <td style={{ border: '1px solid #000', padding: '6px', width: '80px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{qA.btlLevel || 'UN'},{qA.co || 'CO3'}</td>
                              </tr>
                            )}
                            {qA && qB && (
                              <tr><td colSpan="3" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold', color: '#000' }}>(OR)</td></tr>
                            )}
                            {qB && (
                              <tr>
                                <td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', color: '#000' }}>{qNum} b)</td>
                                <td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{qB.questionText}</td>
                                <td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{qB.btlLevel || 'UN'},{qB.co || 'CO3'}</td>
                              </tr>
                            )}
                          </React.Fragment>
                        ); 
                      })}
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
