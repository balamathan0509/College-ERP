import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, getDocs, where } from "../../supabase/supabaseAdapter";
import { useAuth } from '../../context/AuthContext';
import { Eye, Printer, Search, ArrowLeft, Download, FileSpreadsheet, FileText } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
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
        const getTime = (val) => {
          if (!val) return 0;
          if (typeof val?.toMillis === 'function') return val.toMillis();
          if (typeof val?.toDate === 'function') return val.toDate().getTime();
          const d = new Date(val);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        return getTime(b.createdAt) - getTime(a.createdAt);
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
      <html><head><title>Question Paper</title>
      <style>
        @page { size: A4 portrait; margin: 8mm 10mm; }
        * { box-sizing: border-box; }
        body { font-family: "Times New Roman", Times, serif; font-size: 10.5pt; color: #000; margin: 0; padding: 0; }
        .page-border {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          border: 2px solid #000;
          pointer-events: none;
          box-sizing: border-box;
        }
        .content-wrap {
          padding: 4px 6px;
        }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid !important; break-inside: avoid !important; }
        tbody.question-pair { page-break-inside: avoid !important; break-inside: avoid !important; }
        .page-break-before { page-break-before: always !important; break-before: page !important; }
        th, td { border: 1px solid #000; padding: 3px 5px; text-align: left; vertical-align: top; color: #000 !important; font-size: 10pt; }
        .no-border-table td, .no-border-table th { border: none !important; color: #000 !important; }
        .header-info { width: 100%; border: none; margin-bottom: 8px; }
        .header-info td { border: none; padding: 3px 4px; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .part-title { text-align: center; font-weight: bold; margin: 8px 0 4px 0; color: #000; page-break-after: avoid !important; break-after: avoid !important; }
        .signature-block { page-break-inside: avoid !important; break-inside: avoid !important; }
        .distribution-table { page-break-inside: avoid !important; break-inside: avoid !important; }
      </style></head>
      <body>
        <div class="page-border"></div>
        <div class="content-wrap">${clone.innerHTML}</div>
      </body></html>
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

    // Clone printContent so the outer border does not get sliced across pages
    const clone = printContent.cloneNode(true);
    clone.style.border = 'none';
    clone.style.maxWidth = '100%';
    clone.style.width = '100%';
    clone.style.margin = '0';
    clone.style.padding = '0';

    let html = clone.outerHTML;
    html = html.replace(/\/logo-left\.png/g, leftLogo);
    html = html.replace(/\/logo-right\.png/g, rightLogo);

    // Wrap in container with proper page-break and typography styling
    const htmlString = `
      <style>
        * { box-sizing: border-box; }
        body { font-family: "Times New Roman", Times, serif; font-size: 10.5pt; color: #000; margin: 0; padding: 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid !important; break-inside: avoid !important; }
        tbody.question-pair { page-break-inside: avoid !important; break-inside: avoid !important; }
        .page-break-before { page-break-before: always !important; break-before: page !important; }
        th, td { border: 1px solid #000; padding: 3px 5px; text-align: left; vertical-align: top; color: #000 !important; font-size: 10pt; }
        .part-title { text-align: center; font-weight: bold; margin: 8px 0 4px 0; color: #000; page-break-after: avoid !important; break-after: avoid !important; }
        .signature-block { page-break-inside: avoid !important; break-inside: avoid !important; }
        .distribution-table { page-break-inside: avoid !important; break-inside: avoid !important; }
      </style>
      <div style="width: 710px; box-sizing: border-box; background: #fff; color: #000; margin: 0 auto; padding: 2px 4px;">
        ${html}
      </div>
    `;

    const filename = viewingPaper?.headerConfig?.courseCodeName ? `Question_Paper_${viewingPaper.headerConfig.courseCodeName}.pdf` : `Question_Paper.pdf`;

    const opt = {
      margin:       [8, 8, 8, 8],
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['css', 'legacy'], before: '.page-break-before', avoid: ['tbody.question-pair', 'tr', '.signature-block', '.distribution-table'] }
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
          // Draw neat outer border on EVERY page!
          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.6);
          pdf.rect(6, 6, 210 - 12, 297 - 12);

          if (totalPages > 1) {
            pdf.setFont('times', 'normal');
            pdf.setFontSize(9);
            pdf.setTextColor(0, 0, 0);
            pdf.text(`Page ${i} of ${totalPages}`, 105, 293, { align: 'center' });
          }
        }
      })
  };

  const handleDownloadExcel = () => {
    if (!viewingPaper) return;
    try {
      toast.loading("Generating Excel spreadsheet...", { id: "excel-toast" });
      const wb = XLSX.utils.book_new();

      const headerConfig = viewingPaper.headerConfig || {};
      const courseOutcomes = viewingPaper.courseOutcomes || [];
      const partAQuestions = viewingPaper.partAQuestions || [];
      const partBQuestions = viewingPaper.partBQuestions || [];
      const partCQuestions = viewingPaper.partCQuestions || [];

      const qpRows = [
        [headerConfig.collegeName || 'RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING'],
        [headerConfig.collegeAddress || 'Salvarpatti, Sivakasi - 626 128'],
        [headerConfig.examName || 'QUESTION PAPER'],
        [],
        ["Course Instructor:", headerConfig.instructorName || '', "Class / Semester:", headerConfig.classSemester || ''],
        ["Course Code & Name:", headerConfig.courseCodeName || '', "Academic Year:", headerConfig.academicYear || ''],
        ["Date of Exam:", headerConfig.examDate || ''],
        [],
        ["COURSE OUTCOMES:"],
        ["CO", "Course Outcomes Description", "BTL Level"]
      ];

      courseOutcomes.forEach(co => {
        qpRows.push([co.co, co.description, co.btlLevel]);
      });

      qpRows.push([]);
      qpRows.push(["PART A - Answer ALL questions"]);
      qpRows.push(["Q.No", "Question", "BTL, CO"]);
      partAQuestions.forEach((id, idx) => {
        const q = questionsPool.find(x => x.id === id);
        qpRows.push([idx + 1, q?.questionText || "", `${q?.btlLevel || 'UN'}, ${q?.co || 'CO'}`]);
      });

      const partB_start = 1 + partAQuestions.length;
      qpRows.push([]);
      qpRows.push(["PART B - Answer ALL questions"]);
      qpRows.push(["Q.No", "Question", "BTL, CO"]);
      partBQuestions.forEach((pair, idx) => {
        const qNum = partB_start + idx;
        const qA = questionsPool.find(x => x.id === pair.a);
        const qB = questionsPool.find(x => x.id === pair.b);
        qpRows.push([`${qNum} a)`, qA?.questionText || "", `${qA?.btlLevel || 'UN'}, ${qA?.co || 'CO'}`]);
        qpRows.push(["", "(OR)", ""]);
        qpRows.push([`${qNum} b)`, qB?.questionText || "", `${qB?.btlLevel || 'UN'}, ${qB?.co || 'CO'}`]);
      });

      const partC_start = partB_start + partBQuestions.length;
      qpRows.push([]);
      qpRows.push(["PART C"]);
      qpRows.push(["Q.No", "Question", "BTL, CO"]);
      partCQuestions.forEach((pair, idx) => {
        const qNum = partC_start + idx;
        const qA = questionsPool.find(x => x.id === pair.a);
        const qB = questionsPool.find(x => x.id === pair.b);
        qpRows.push([`${qNum} a)`, qA?.questionText || "", `${qA?.btlLevel || 'UN'}, ${qA?.co || 'CO'}`]);
        qpRows.push(["", "(OR)", ""]);
        qpRows.push([`${qNum} b)`, qB?.questionText || "", `${qB?.btlLevel || 'UN'}, ${qB?.co || 'CO'}`]);
      });

      const wsPaper = XLSX.utils.aoa_to_sheet(qpRows);
      wsPaper['!cols'] = [{ wch: 15 }, { wch: 80 }, { wch: 25 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsPaper, "Question Paper");

      const safeCourse = (headerConfig.courseCodeName || viewingPaper.courseCode || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Question_Paper_${safeCourse}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success("Excel (.xlsx) downloaded successfully!", { id: "excel-toast" });
    } catch (err) {
      console.error("Excel generation error:", err);
      toast.error("Failed to generate Excel file.", { id: "excel-toast" });
    }
  };

  const handleDownloadWord = async () => {
    const printContent = document.getElementById("printable-paper");
    if (!printContent) return;

    toast.loading("Preparing Word document...", { id: "word-toast" });

    try {
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

      let contentHtml = printContent.innerHTML;
      contentHtml = contentHtml.replace(/\/logo-left\.png/g, leftLogo);
      contentHtml = contentHtml.replace(/\/logo-right\.png/g, rightLogo);

      const headerConfig = viewingPaper?.headerConfig || {};
      const wordDocHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>${headerConfig.examName || 'Exam'} - ${headerConfig.courseCodeName || ''}</title>
          <!--[if gte mso 9]>
          <xml>
            <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
              <w:DoNotOptimizeForBrowser/>
            </w:WordDocument>
          </xml>
          <![endif]-->
          <style>
            @page Section1 {
              size: 8.5in 11in;
              margin: 0.5in 0.5in 0.5in 0.5in;
              mso-header-margin: 0.2in;
              mso-footer-margin: 0.2in;
            }
            div.Section1 {
              page: Section1;
              font-family: "Times New Roman", Times, serif;
              font-size: 11pt;
              color: #000000;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            th, td {
              border: 1pt solid black;
              padding: 4pt 6pt;
              font-family: "Times New Roman", Times, serif;
            }
          </style>
        </head>
        <body>
          <div class="Section1">
            ${contentHtml}
          </div>
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff', wordDocHtml], {
        type: 'application/msword;charset=utf-8'
      });

      const safeCourse = (headerConfig.courseCodeName || viewingPaper?.courseCode || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Question_Paper_${safeCourse}.doc`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast.success("Word document (.doc) downloaded successfully!", { id: "word-toast" });
    } catch (err) {
      console.error("Word generation error:", err);
      toast.error("Failed to generate Word document.", { id: "word-toast" });
    }
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
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={handleDownloadPdf} disabled={poolLoading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 500, fontSize: '13px' }} title="Download Question Paper as PDF">
                  <Download size={16} /> Download PDF
                </button>
                <button onClick={handlePrint} disabled={poolLoading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: 'none', background: '#405189', color: '#fff', cursor: 'pointer', fontWeight: 500, fontSize: '13px' }} title="Print Question Paper">
                  <Printer size={16} /> Print Paper
                </button>
              </div>
            </div>
            
            {poolLoading ? (
               <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading paper contents...</div>
            ) : (
              <div style={{ background: '#fff', color: '#000', padding: '20px 40px', borderRadius: 8, overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
                {(() => {
                  const is100Marks = (viewingPaper?.partAQuestions?.length || 0) >= 8 || (viewingPaper?.partBQuestions?.length || 0) >= 4 || viewingPaper?.headerConfig?.examName?.toLowerCase()?.includes('model') || viewingPaper?.headerConfig?.examName?.toLowerCase()?.includes('semester') || viewingPaper?.headings?.partB?.includes('5 × 13');
                  const partA_start = 1;
                  const partB_start = partA_start + (viewingPaper.partAQuestions?.length || 5);
                  const partC_start = partB_start + (viewingPaper.partBQuestions?.length || 2);

                  return (
                    <div id="printable-paper" style={{ fontFamily: '"Times New Roman", Times, serif', width: '100%', maxWidth: '800px', margin: '0 auto', fontSize: '11.5px', border: '2px solid #000', padding: '12px 14px', boxSizing: 'border-box' }}>
                      {/* 1. Register Number */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 10, color: '#000', gap: 12 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '11px' }}>Register Number:</div>
                        <div style={{ display: 'flex' }}>
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
                            <div key={i} style={{ width: 19, height: 19, border: '1px solid #000', borderRight: i === 12 ? '1px solid #000' : 'none' }}></div>
                          ))}
                        </div>
                      </div>
                      
                      {/* 2. Official Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, color: '#000' }}>
                        <div style={{ width: '75px', height: '75px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src="/logo-left.png" alt="Left Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={(e) => e.target.style.display = 'none'} />
                        </div>
                        <div style={{ textAlign: 'center', flex: 1, padding: '0 10px' }}>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {viewingPaper.headerConfig?.collegeName || 'RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#333', marginBottom: 6 }}>
                            {viewingPaper.headerConfig?.collegeAddress || 'Salvarpatti, Sivakasi - 626 128'}
                          </div>
                          <div style={{ display: 'inline-block', border: '1.5px solid #1e3a8a', borderRadius: '15px', padding: '3px 18px', fontWeight: 'bold', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {viewingPaper.headerConfig?.examName || 'EXAMINATION'}
                          </div>
                        </div>
                        <div style={{ width: '75px', height: '75px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src="/logo-right.png" alt="Right Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={(e) => e.target.style.display = 'none'} />
                        </div>
                      </div>

                      {/* 3. Metadata Table */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, color: '#000', fontSize: '11px' }}>
                        <tbody>
                          <tr>
                            <td style={{ border: '1px solid #000', padding: '3px 6px', width: '55%' }}>
                              Name of Course Instructor: <span style={{ fontWeight: 'bold' }}>{viewingPaper.headerConfig?.instructorName || '-'}</span>
                            </td>
                            <td style={{ border: '1px solid #000', padding: '3px 6px', width: '45%' }}>
                              Class / Semester: <span style={{ fontWeight: 'bold' }}>{viewingPaper.headerConfig?.classSemester || '-'}</span>
                            </td>
                          </tr>
                          <tr>
                            <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                              Course Code & Name: <span style={{ fontWeight: 'bold' }}>{viewingPaper.headerConfig?.courseCodeName || '-'}</span>
                            </td>
                            <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                              Academic Year: <span style={{ fontWeight: 'bold' }}>{viewingPaper.headerConfig?.academicYear || '-'}</span>
                            </td>
                          </tr>
                          <tr>
                            <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                              Date & Session: <span style={{ fontWeight: 'bold' }}>{viewingPaper.headerConfig?.examDate || '-'}</span>
                            </td>
                            <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                              Max. Marks: <span style={{ fontWeight: 'bold' }}>{is100Marks ? '100' : '50'}</span> &nbsp;|&nbsp; Duration: <span style={{ fontWeight: 'bold' }}>{is100Marks ? '3 Hours' : '90 Mins'}</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      {/* 4. Course Outcomes (if available) */}
                      {viewingPaper.courseOutcomes && viewingPaper.courseOutcomes.length > 0 && (
                        <>
                          <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: 2, color: '#000' }}>COURSE OUTCOMES:</div>
                          <div style={{ fontSize: '10.5px', marginBottom: 3, color: '#000', fontStyle: 'italic' }}>At the end of the course the students will be able to:</div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, color: '#000', fontSize: '10.5px' }}>
                            <thead>
                              <tr style={{ background: '#f3f4f6', fontWeight: 'bold' }}>
                                <th style={{ border: '1px solid #000', padding: '3px 5px', width: '45px', textAlign: 'center' }}>CO</th>
                                <th style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'left' }}>Course Outcomes Description</th>
                                <th style={{ border: '1px solid #000', padding: '3px 5px', width: '70px', textAlign: 'center' }}>BTL Level</th>
                              </tr>
                            </thead>
                            <tbody>
                              {viewingPaper.courseOutcomes.map((co, i) => (
                                <tr key={i} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                  <td style={{ border: '1px solid #000', padding: '2px 5px', textAlign: 'center', fontWeight: 'bold' }}>{co.co}</td>
                                  <td style={{ border: '1px solid #000', padding: '2px 6px' }}>{co.description}</td>
                                  <td style={{ border: '1px solid #000', padding: '2px 5px', textAlign: 'center' }}>{co.btlLevel}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </>
                      )}

                      {/* 5. Course Assessment Matrix (if available) */}
                      {viewingPaper.cam && viewingPaper.cam.length > 0 && (
                        <>
                          <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: 2, color: '#000' }}>COURSE ASSESSMENT MATRIX:</div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, textAlign: 'center', color: '#000', fontSize: '9.5px' }}>
                            <thead>
                              <tr style={{ background: '#f3f4f6', fontWeight: 'bold' }}>
                                <th style={{ border: '1px solid #000', padding: '2px', width: '40px' }}>CO</th>
                                {['PO1','PO2','PO3','PO4','PO5','PO6','PO7','PO8','PO9','PO10','PO11','PO12','PSO1','PSO2','PSO3'].map(p => (
                                  <th key={p} style={{ border: '1px solid #000', padding: '2px 1px' }}>{p.replace(/\d+/, '')}<br/>{p.match(/\d+/)[0]}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {viewingPaper.cam.map((c, i) => (
                                <tr key={i} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                  <td style={{ border: '1px solid #000', padding: '2px', fontWeight: 'bold' }}>{c.co}</td>
                                  {['po1','po2','po3','po4','po5','po6','po7','po8','po9','po10','po11','po12','pso1','pso2','pso3'].map(p => (
                                    <td key={p} style={{ border: '1px solid #000', padding: '2px 1px' }}>{c[p]}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </>
                      )}
                      
                      {/* 6. PART – A (Questions 1 to 10 - Fits on Page 1) */}
                      <div style={{ textAlign: 'center', marginTop: '6px', marginBottom: '4px', color: '#000' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{viewingPaper.headings?.partA || 'PART – A (10 × 2 = 20 Marks)'}</div>
                        <div style={{ fontSize: '10.5px', fontStyle: 'italic' }}>Answer ALL Questions</div>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, color: '#000', fontSize: '10.5px' }}>
                        <thead>
                          <tr style={{ background: '#f3f4f6', fontWeight: 'bold' }}>
                            <th style={{ width: '38px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>Q.No</th>
                            <th style={{ textAlign: 'center', border: '1px solid #000', padding: '3px 6px' }}>Questions</th>
                            <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>Marks</th>
                            <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>CO</th>
                            <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>BTL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewingPaper.partAQuestions?.map((id, idx) => { 
                            const q = questionsPool.find(x => x.id === id); 
                            if(!q) return null;
                            return (
                              <tr key={idx} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top' }}>{idx + 1}</td>
                                <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'justify', verticalAlign: 'top', lineHeight: '1.25' }}>{q.questionText}</td>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>2</td>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{q.co || 'CO1'}</td>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{q.btlLevel || 'UN'}</td>
                              </tr>
                            ); 
                          })}
                        </tbody>
                      </table>

                      {/* 7. PART – B & PART – C (Clean Page 2 Break for 100 Marks, or Continuation for 50 Marks) */}
                      <div className={is100Marks ? "page-break-before" : ""} style={{ pageBreakBefore: is100Marks ? 'always' : 'auto', breakBefore: is100Marks ? 'page' : 'auto', marginTop: is100Marks ? '10px' : '10px' }}>
                        
                        {/* Part B Header */}
                        <div style={{ textAlign: 'center', marginBottom: '4px', color: '#000' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{viewingPaper.headings?.partB || 'PART – B (5 × 13 = 65 Marks)'}</div>
                          <div style={{ fontSize: '10.5px', fontStyle: 'italic' }}>Answer ALL Questions (Either / Or Choice)</div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', color: '#000', fontSize: '10.5px' }}>
                          <thead>
                            <tr style={{ background: '#f3f4f6', fontWeight: 'bold' }}>
                              <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>Q.No</th>
                              <th style={{ textAlign: 'center', border: '1px solid #000', padding: '3px 6px' }}>Questions</th>
                              <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>Marks</th>
                              <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>CO</th>
                              <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>BTL</th>
                            </tr>
                          </thead>
                          {viewingPaper.partBQuestions?.map((pair, idx) => { 
                            const qNum = partB_start + idx; 
                            const qA = questionsPool.find(x => x.id === pair.a); 
                            const qB = questionsPool.find(x => x.id === pair.b); 
                            if(!qA && !qB) return null;
                            const marksVal = qA?.marks || (viewingPaper.headings?.partB?.includes('16') ? 16 : 13);
                            return (
                              <tbody key={idx} className="question-pair" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                {qA && (
                                  <tr>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top' }}>{qNum} (a)</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'justify', verticalAlign: 'top', lineHeight: '1.25' }}>{qA.questionText}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{marksVal}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{qA.co || 'CO2'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{qA.btlLevel || 'UN'}</td>
                                  </tr>
                                )}
                                {qA && qB && (
                                  <tr><td colSpan="5" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontWeight: 'bold', fontSize: '10px', background: '#fafafa', letterSpacing: '2px' }}>(OR)</td></tr>
                                )}
                                {qB && (
                                  <tr>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top' }}>{qNum} (b)</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'justify', verticalAlign: 'top', lineHeight: '1.25' }}>{qB.questionText}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{marksVal}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{qB.co || 'CO2'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{qB.btlLevel || 'UN'}</td>
                                  </tr>
                                )}
                              </tbody>
                            ); 
                          })}
                        </table>

                        {/* Part C Header */}
                        <div style={{ textAlign: 'center', marginTop: '6px', marginBottom: '4px', color: '#000' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{viewingPaper.headings?.partC || 'PART – C (1 × 15 = 15 Marks)'}</div>
                          <div style={{ fontSize: '10.5px', fontStyle: 'italic' }}>Answer ALL Questions (Either / Or Choice)</div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', color: '#000', fontSize: '10.5px' }}>
                          <thead>
                            <tr style={{ background: '#f3f4f6', fontWeight: 'bold' }}>
                              <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>Q.No</th>
                              <th style={{ textAlign: 'center', border: '1px solid #000', padding: '3px 6px' }}>Questions</th>
                              <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>Marks</th>
                              <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>CO</th>
                              <th style={{ width: '45px', textAlign: 'center', border: '1px solid #000', padding: '3px 4px' }}>BTL</th>
                            </tr>
                          </thead>
                          {viewingPaper.partCQuestions?.map((pair, idx) => { 
                            const qNum = partC_start + idx; 
                            const qA = questionsPool.find(x => x.id === pair.a); 
                            const qB = questionsPool.find(x => x.id === pair.b); 
                            if(!qA && !qB) return null;
                            const marksVal = qA?.marks || (viewingPaper.headings?.partC?.includes('15') ? 15 : 14);
                            return (
                              <tbody key={idx} className="question-pair" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                {qA && (
                                  <tr>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top' }}>{qNum} (a)</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'justify', verticalAlign: 'top', lineHeight: '1.25' }}>{qA.questionText}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{marksVal}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{qA.co || 'CO5'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{qA.btlLevel || 'CR'}</td>
                                  </tr>
                                )}
                                {qA && qB && (
                                  <tr><td colSpan="5" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontWeight: 'bold', fontSize: '10px', background: '#fafafa', letterSpacing: '2px' }}>(OR)</td></tr>
                                )}
                                {qB && (
                                  <tr>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top' }}>{qNum} (b)</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'justify', verticalAlign: 'top', lineHeight: '1.25' }}>{qB.questionText}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{marksVal}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{qB.co || 'CO5'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{qB.btlLevel || 'CR'}</td>
                                  </tr>
                                )}
                              </tbody>
                            ); 
                          })}
                        </table>
                        
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
