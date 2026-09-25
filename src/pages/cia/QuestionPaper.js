import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { db } from '../../firebase/config';
import { collection, query, getDocs, where, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Search, Printer, CheckCircle, Save, Plus, Trash2, Send, Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function QuestionPaper() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState([]);
  const [filterCourse, setFilterCourse] = useState('');
  
  const [questionsPool, setQuestionsPool] = useState([]);
  const [poolLoaded, setPoolLoaded] = useState(false);
  const [allocations, setAllocations] = useState([]);
  const [selectedAllocation, setSelectedAllocation] = useState('');
  
  const [headerConfig, setHeaderConfig] = useState({
    collegeName: 'RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING',
    collegeAddress: 'Salvarpatti, Sivakasi - 626 128',
    examName: 'INTERNAL TEST III',
    instructorName: 'B.RAMYA, AP/EEE',
    classSemester: 'IV / VII',
    courseCodeName: 'GE3752 - TOTAL QUALITY MANAGEMENT',
    academicYear: '2026 - 2027 (ODD)',
    examDate: '09.09.2026 (FN)'
  });

  const [courseOutcomes, setCourseOutcomes] = useState([
    { co: 'CO3', description: 'Ability to understand Six Sigma and apply Traditional tools, New tools, Benchmarking and FMEA.', btlLevel: 'AP' }
  ]);

  const [cam, setCam] = useState([
    { co: 'CO3', po1: '', po2: '', po3: '', po4: '', po5: '3', po6: '', po7: '', po8: '', po9: '3', po10: '', po11: '', po12: '2', pso1: '1', pso2: '2', pso3: '3' }
  ]);

  const [partAHeading, setPartAHeading] = useState('PART – A (5 × 2 = 10 Marks)');
  const [partBHeading, setPartBHeading] = useState('PART – B (2 × 13 = 26 Marks)');
  const [partCHeading, setPartCHeading] = useState('PART – C (1 × 14 = 14 Marks)');

  const [partAQuestions, setPartAQuestions] = useState([null, null, null, null, null]);
  const [partBQuestions, setPartBQuestions] = useState([{a: null, b: null}, {a: null, b: null}]);
  const [partCQuestions, setPartCQuestions] = useState([{a: null, b: null}]);
  
  const [previewMode, setPreviewMode] = useState(false);
  
  // Workflow fields
  const [paperStatus, setPaperStatus] = useState('DRAFT');
  const [revisionNumber, setRevisionNumber] = useState(1);
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [hodRemarks, setHodRemarks] = useState('');
  
  const isReadOnly = editId && paperStatus !== 'DRAFT' && paperStatus !== 'RETURNED_TO_STAFF';

useEffect(() => {
    if (userProfile?.role === 'staff') {
      fetchAllocations();
    } else {
      fetchCourses();
    }
    if (editId) {
      loadExistingPaper(editId);
    }
  }, [editId, userProfile]);

  useEffect(() => {
    if (userProfile?.role === 'staff' && selectedAllocation) {
      const alloc = allocations.find(a => a.id === selectedAllocation);
      if (alloc) {
        setFilterCourse(alloc.courseCode);
      }
    }
  }, [selectedAllocation]);

  async function fetchAllocations() {
    try {
      const q = query(collection(db, "subject_allocations"), where("facultyId", "==", userProfile.uid), where("status", "==", "Active"));
      const snap = await getDocs(q);
      let allocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), isSubstitute: false }));
      
      const subQ = query(collection(db, "subject_substitutes"), where("substituteFacultyId", "==", userProfile.uid), where("status", "==", "Active"));
      const subSnap = await getDocs(subQ);
      const subs = subSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), isSubstitute: true, subjectId: doc.data().subjectId }));
      
      const merged = [...allocs, ...subs];
      setAllocations(merged);
      if (merged.length > 0 && !editId) {
         setSelectedAllocation(merged[0].id);
      }
    } catch (err) {
      console.error("Error fetching allocations", err);
    }
  }

  async function fetchCourses() {
    try {
      const qBank = query(collection(db, "cia_question_bank"));
      const snapBank = await getDocs(qBank);
      const uniqueCourses = new Set();
      snapBank.docs.forEach(d => {
        if (d.data().courseCode) uniqueCourses.add(d.data().courseCode);
      });
      setCourses(Array.from(uniqueCourses));
    } catch (err) {
      console.error(err);
    }
  }

  async function loadExistingPaper(id) {
    setLoading(true);
    try {
      const docRef = doc(db, "cia_question_papers", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFilterCourse(data.courseCode);
        setHeaderConfig(data.headerConfig || headerConfig);
        setCourseOutcomes(data.courseOutcomes || courseOutcomes);
        setCam(data.cam || cam);
        setPartAHeading(data.headings?.partA || partAHeading);
        setPartBHeading(data.headings?.partB || partBHeading);
        setPartCHeading(data.headings?.partC || partCHeading);
        setPartAQuestions(data.partAQuestions || []);
        setPartBQuestions(data.partBQuestions || []);
        setPartCQuestions(data.partCQuestions || []);
        
        setPaperStatus(data.status || 'DRAFT');
        setRevisionNumber(data.revisionNumber || 1);
        setApprovalHistory(data.approvalHistory || []);
        setHodRemarks(data.hodRemarks || '');
        
        // Load the questions pool for this course
        await loadPoolByCourse(data.courseCode);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load question paper.");
    }
    setLoading(false);
  }

async function loadPoolByCourse(course) {
    if (!course) return;
    try {
      let q = query(collection(db, "cia_question_bank"), where("courseCode", "==", course));
      
      if (userProfile?.role === 'staff' && selectedAllocation) {
        const alloc = allocations.find(a => a.id === selectedAllocation);
        if (alloc) {
          if (alloc.isSubstitute) {
             q = query(collection(db, "cia_question_bank"), where("substituteId", "==", alloc.id));
          } else {
             q = query(collection(db, "cia_question_bank"), where("subjectAllocationId", "==", alloc.id));
          }
        }
      }

      const snap = await getDocs(q);
      const qList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setQuestionsPool(qList);
      setPoolLoaded(true);
    } catch (err) {
      console.error(err);
    }
  }

  const handleLoadPool = async () => {
    if (!filterCourse) {
      toast.error("Please select a Course Code.");
      return;
    }
    if (isReadOnly) return;
    
    setLoading(true);
    await loadPoolByCourse(filterCourse);
    // Reset selections only if we are loading manually (not via edit)
    if (!editId) {
      setPartAQuestions([null, null, null, null, null]);
      setPartBQuestions([{a: null, b: null}, {a: null, b: null}]);
      setPartCQuestions([{a: null, b: null}]);
      setPreviewMode(false);
    }
    setLoading(false);
    if (!editId && questionsPool.length === 0) {
      //toast.error("No questions found for this course in the Question Bank.");
    }
  };

  const partA_pool = questionsPool.filter(q => String(q.marks) === '2');
  const partB_pool = questionsPool.filter(q => String(q.marks) === '13');
  const partC_pool = questionsPool.filter(q => String(q.marks) === '14');

  const isDisabled = (id, currentVal) => {
    if (!id) return false;
    if (id === currentVal) return false; 
    if (partAQuestions.includes(id)) return true;
    for (let pair of partBQuestions) {
      if (pair.a === id || pair.b === id) return true;
    }
    for (let pair of partCQuestions) {
      if (pair.a === id || pair.b === id) return true;
    }
    return false;
  };

  const isFormComplete = () => {
    if (partAQuestions.length === 0 || !partAQuestions.every(x => !!x)) return false;
    if (partBQuestions.length === 0 || !partBQuestions.every(p => !!p.a && !!p.b)) return false;
    if (partCQuestions.length === 0 || !partCQuestions.every(p => !!p.a && !!p.b)) return false;
    return true;
  };

  const calculateDistribution = () => {
    const dist = {};
    courseOutcomes.forEach(co => {
      dist[co.co] = { RE: 0, UN: 0, AP: 0, AN: 0, CR: 0, Total: 0 };
    });
    const addMarks = (qId, attemptedMarks) => {
      const q = questionsPool.find(x => x.id === qId);
      if (q && q.co && dist[q.co]) {
        const btl = q.btlLevel || 'UN'; 
        if (dist[q.co][btl] !== undefined) {
          dist[q.co][btl] += attemptedMarks;
          dist[q.co].Total += attemptedMarks;
        }
      }
    };
    partAQuestions.filter(Boolean).forEach(id => addMarks(id, 2));
    partBQuestions.forEach(p => { if (p.a) addMarks(p.a, 13); });
    partCQuestions.forEach(p => { if (p.a) addMarks(p.a, 14); });
    return dist;
  };

  const handleGeneratePreview = () => {
    if (!isFormComplete()) {
      toast.error("Please complete all question selections.");
      return;
    }
    const allSelections = [
      ...partAQuestions, 
      ...partBQuestions.map(p=>p.a), ...partBQuestions.map(p=>p.b),
      ...partCQuestions.map(p=>p.a), ...partCQuestions.map(p=>p.b)
    ].filter(Boolean);
    const uniqueSelections = new Set(allSelections);
    if (uniqueSelections.size !== allSelections.length) {
      toast.error("Duplicate questions detected.");
      return;
    }
    setPreviewMode(true);
  };

  const savePaperData = async (targetStatus) => {
    setSaving(true);
    try {
      const historyEntry = {
        action: targetStatus === 'DRAFT' ? (editId ? 'Edited Draft' : 'Created Draft') : 'Submitted to HOD',
        performedBy: userProfile.uid || 'unknown',
        performedByName: userProfile.name || 'Unknown',
        role: userProfile.role || 'staff',
        timestamp: new Date().toISOString()
      };

let allocData = {};
      if (userProfile?.role === 'staff' && !editId) {
        const alloc = allocations.find(a => a.id === selectedAllocation);
        if (alloc) {
           if (alloc.isSubstitute) {
             allocData.substituteId = alloc.id;
             allocData.subjectAllocationId = alloc.allocationId;
           } else {
             allocData.subjectAllocationId = alloc.id;
           }
           allocData.department = alloc.department || '';
           allocData.year = alloc.year || '';
           allocData.semester = alloc.semester || '';
           allocData.section = alloc.section || '';
        }
      }

      const payload = {
        courseCode: filterCourse,
        headerConfig,
        courseOutcomes,
        cam,
        headings: { partA: partAHeading, partB: partBHeading, partC: partCHeading },
        partAQuestions,
        partBQuestions,
        partCQuestions,
        status: targetStatus,
        revisionNumber: (paperStatus === 'RETURNED_TO_STAFF' && targetStatus === 'SUBMITTED_TO_HOD') ? revisionNumber + 1 : revisionNumber,
        ...allocData
      };

      if (!editId) {
        payload.department = userProfile.dept || '';
        payload.createdAt = serverTimestamp();
        payload.createdBy = userProfile.uid || 'unknown';
        payload.createdByName = userProfile.name || 'Unknown';
        payload.approvalHistory = [historyEntry];
        if (targetStatus === 'SUBMITTED_TO_HOD') {
          payload.submittedToHodAt = serverTimestamp();
          payload.submittedToHodBy = userProfile.uid || 'unknown';
        }
        await addDoc(collection(db, "cia_question_papers"), payload);
        toast.success(targetStatus === 'DRAFT' ? "Draft saved successfully!" : "Submitted to HOD!");
        navigate('/cia/my-papers');
      } else {
        const docRef = doc(db, "cia_question_papers", editId);
        payload.approvalHistory = [...approvalHistory, historyEntry];
        if (targetStatus === 'SUBMITTED_TO_HOD') {
          payload.submittedToHodAt = serverTimestamp();
          payload.submittedToHodBy = userProfile.uid || 'unknown';
        }
        await updateDoc(docRef, payload);
        toast.success(targetStatus === 'DRAFT' ? "Draft updated successfully!" : "Submitted to HOD!");
        setPaperStatus(targetStatus);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save Question Paper.");
    }
    setSaving(false);
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
        .no-border-table td, .no-border-table th { border: none !important; color: #000 !important; }
        .header-info { width: 100%; border: none; margin-bottom: 10px; }
        .header-info td { border: none; padding: 4px; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .outer-border { border: 3px solid #000; padding: 10px; margin-bottom: 5px; }
        .reg-box { width: 25px; height: 25px; border: 1px solid #000; display: inline-block; }
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

    const filename = filterCourse ? `Question_Paper_${filterCourse}.pdf` : `Question_Paper.pdf`;

    const opt = {
      margin:       10,
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, windowWidth: 720 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(htmlString).save();
  };

  const partA_start = 1;
  const partB_start = partA_start + partAQuestions.length;
  const partC_start = partB_start + partBQuestions.length;

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />
        
        {paperStatus === 'RETURNED_TO_STAFF' && (
          <div style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b', padding: 15, borderRadius: 8, marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 5px 0' }}>Returned by HOD</h4>
            <p style={{ margin: 0 }}><strong>Remarks:</strong> {hodRemarks}</p>
          </div>
        )}

        {isReadOnly && (
          <div style={{ background: '#dbeafe', border: '1px solid #3b82f6', color: '#1e40af', padding: 15, borderRadius: 8, marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 5px 0' }}>Locked ({paperStatus})</h4>
            <p style={{ margin: 0 }}>This question paper is currently locked and under review.</p>
          </div>
        )}

        {!previewMode ? (
          <>
            <div className='page-header'>
              <h1>Question Paper Builder</h1>
              <p className="subtitle">Select existing questions from the bank and generate formal paper</p>
            </div>

            <div className="card" style={{ marginBottom: 20, opacity: isReadOnly ? 0.7 : 1, pointerEvents: isReadOnly ? 'none' : 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Course Code *</label>
                  <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                    <option value="">Select Course</option>
                    {courses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button onClick={handleLoadPool} className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', height: '42px' }}>
                    <Search size={16} /> {loading ? 'Loading...' : 'Load Bank'}
                  </button>
                </div>
              </div>


        {userProfile?.role === 'staff' && !editId && allocations.length > 0 && (
          <div className="card" style={{ marginBottom: 20, padding: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>Subject Context:</span>
              <select 
                value={selectedAllocation} 
                onChange={(e) => setSelectedAllocation(e.target.value)}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}
              >
                {allocations.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.isSubstitute ? '[Substitute] ' : ''}{a.courseCode} {a.courseName} - {a.department} (Yr: {a.year}, Sem: {a.semester}, Sec: {a.section || 'All'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

            </div>

            {poolLoaded && (
              <div className="card" style={{ marginBottom: 20, opacity: isReadOnly ? 0.7 : 1, pointerEvents: isReadOnly ? 'none' : 'auto' }}>
                <h2 style={{ marginTop: 0, marginBottom: 20, color: '#6366f1' }}>Configuration & Selection</h2>
                
                <div style={{ display: 'flex', gap: 20, marginBottom: 30, padding: 15, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <div style={{ color: isFormComplete() ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>
                    {isFormComplete() ? 'All Sections Complete ✓' : 'Incomplete Sections'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 30 }}>
                  <div style={{ padding: 15, border: '1px solid var(--border-color)', borderRadius: 8 }}>
                    <h3 style={{ marginTop: 0 }}>Header Config</h3>
                    {Object.keys(headerConfig).map(key => (
                      <div key={key} style={{ marginBottom: 10 }}>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{key}</label>
                        <input type="text" value={headerConfig[key]} onChange={e => setHeaderConfig({...headerConfig, [key]: e.target.value})} style={{ width: '100%', padding: '6px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
                      </div>
                    ))}
                  </div>
                  
                  <div>
                    <div style={{ padding: 15, border: '1px solid var(--border-color)', borderRadius: 8, marginBottom: 20 }}>
                      <input value={partAHeading} onChange={e=>setPartAHeading(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: 15, fontWeight: 'bold', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
                      {partAQuestions.map((val, idx) => (
                        <div key={idx} style={{ marginBottom: 10, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Question {idx + 1}</label>
                            <select value={val || ''} onChange={e => {
                                const arr = [...partAQuestions]; arr[idx] = e.target.value; setPartAQuestions(arr);
                              }} style={{ width: '100%', padding: '6px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                              <option value="">-- Select Question --</option>
                              {partA_pool.map(q => <option key={q.id} value={q.id} disabled={isDisabled(q.id, val)}>{q.questionText.substring(0, 50)}...</option>)}
                            </select>
                          </div>
                          <button onClick={() => setPartAQuestions(partAQuestions.filter((_, i) => i !== idx))} style={{ padding: '6px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={18} /></button>
                        </div>
                      ))}
                      <button onClick={() => setPartAQuestions([...partAQuestions, null])} style={{ padding: '6px 12px', fontSize: 12, background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Plus size={14}/> Add Part A Question
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 30 }}>
                  <div style={{ padding: 15, border: '1px solid var(--border-color)', borderRadius: 8 }}>
                    <input value={partBHeading} onChange={e=>setPartBHeading(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: 15, fontWeight: 'bold', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
                    {partBQuestions.map((pair, idx) => {
                      const qNum = partB_start + idx;
                      return (
                        <div key={idx} style={{ marginBottom: 20, padding: 10, background: 'rgba(0,0,0,0.02)', borderRadius: 6, position: 'relative' }}>
                          <button onClick={() => setPartBQuestions(partBQuestions.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: 5, right: 5, padding: '4px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{qNum} a)</label>
                          <select value={pair.a || ''} onChange={e => {
                            const arr = [...partBQuestions]; arr[idx].a = e.target.value; setPartBQuestions(arr);
                          }} style={{ width: '100%', padding: '6px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                            <option value="">-- Select Question --</option>
                            {partB_pool.map(q => <option key={q.id} value={q.id} disabled={isDisabled(q.id, pair.a)}>{q.questionText.substring(0, 50)}...</option>)}
                          </select>
                          <div style={{ textAlign: 'center', fontSize: 12, margin: '4px 0' }}>OR</div>
                          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{qNum} b)</label>
                          <select value={pair.b || ''} onChange={e => {
                            const arr = [...partBQuestions]; arr[idx].b = e.target.value; setPartBQuestions(arr);
                          }} style={{ width: '100%', padding: '6px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                            <option value="">-- Select Question --</option>
                            {partB_pool.map(q => <option key={q.id} value={q.id} disabled={isDisabled(q.id, pair.b)}>{q.questionText.substring(0, 50)}...</option>)}
                          </select>
                        </div>
                      )
                    })}
                    <button onClick={() => setPartBQuestions([...partBQuestions, {a:null, b:null}])} style={{ padding: '6px 12px', fontSize: 12, background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Plus size={14}/> Add Part B Pair
                    </button>
                  </div>

                  <div style={{ padding: 15, border: '1px solid var(--border-color)', borderRadius: 8 }}>
                    <input value={partCHeading} onChange={e=>setPartCHeading(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: 15, fontWeight: 'bold', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
                    {partCQuestions.map((pair, idx) => {
                      const qNum = partC_start + idx;
                      return (
                        <div key={idx} style={{ marginBottom: 20, padding: 10, background: 'rgba(0,0,0,0.02)', borderRadius: 6, position: 'relative' }}>
                          <button onClick={() => setPartCQuestions(partCQuestions.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: 5, right: 5, padding: '4px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{qNum} a)</label>
                          <select value={pair.a || ''} onChange={e => {
                            const arr = [...partCQuestions]; arr[idx].a = e.target.value; setPartCQuestions(arr);
                          }} style={{ width: '100%', padding: '6px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                            <option value="">-- Select Question --</option>
                            {partC_pool.map(q => <option key={q.id} value={q.id} disabled={isDisabled(q.id, pair.a)}>{q.questionText.substring(0, 50)}...</option>)}
                          </select>
                          <div style={{ textAlign: 'center', fontSize: 12, margin: '4px 0' }}>OR</div>
                          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{qNum} b)</label>
                          <select value={pair.b || ''} onChange={e => {
                            const arr = [...partCQuestions]; arr[idx].b = e.target.value; setPartCQuestions(arr);
                          }} style={{ width: '100%', padding: '6px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                            <option value="">-- Select Question --</option>
                            {partC_pool.map(q => <option key={q.id} value={q.id} disabled={isDisabled(q.id, pair.b)}>{q.questionText.substring(0, 50)}...</option>)}
                          </select>
                        </div>
                      )
                    })}
                    <button onClick={() => setPartCQuestions([...partCQuestions, {a:null, b:null}])} style={{ padding: '6px 12px', fontSize: 12, background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Plus size={14}/> Add Part C Pair
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {poolLoaded && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
                <button onClick={() => { if(isReadOnly) { setPreviewMode(true); } else { handleGeneratePreview(); } }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px' }}>
                  <CheckCircle size={16} /> {isReadOnly ? "View Paper" : "Validate & Preview Paper"}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <button onClick={() => setPreviewMode(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>
                Back
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                {!isReadOnly && (
                  <>
                    <button onClick={() => savePaperData('DRAFT')} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Save size={16} /> Save Draft
                    </button>
                    <button onClick={() => savePaperData('SUBMITTED_TO_HOD')} className="btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Send size={16} /> Submit to HOD
                    </button>
                  </>
                )}
                <button onClick={handleDownloadPdf} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', cursor: 'pointer' }}>
                  <Download size={16} /> Download PDF
                </button>
                <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #6366f1', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                  <Printer size={16} /> Print Paper
                </button>
              </div>
            </div>
            
            <div style={{ background: '#fff', color: '#000', padding: '20px 40px', borderRadius: 8, overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
              <div id="printable-paper" style={{ fontFamily: '"Times New Roman", Times, serif', width: '100%', maxWidth: '800px', margin: '0 auto', fontSize: '13px', border: '3px solid #000', padding: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 15, color: '#000', gap: 15 }}>
                  <div style={{ fontWeight: 'bold' }}>Register Number</div>
                  <div style={{ display: 'flex' }}>{[1,2,3,4,5,6,7,8,9,10,11,12].map(i => <div key={i} style={{ width: 20, height: 20, border: '1px solid #000', borderRight: i === 12 ? '1px solid #000' : 'none' }}></div>)}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, color: '#000' }}>
                  <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/logo-left.png" alt="Left Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={(e) => e.target.style.display = 'none'} /></div>
                  <div style={{ textAlign: 'center', flex: 1, padding: '0 15px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#b91c1c' }}>{headerConfig.collegeName}</div>
                    <div style={{ fontSize: '14px', marginBottom: 10 }}>{headerConfig.collegeAddress}</div>
                    <div style={{ display: 'inline-block', border: '1px solid #1e3a8a', borderRadius: '15px', padding: '5px 20px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: 5 }}>{headerConfig.examName}</div>
                  </div>
                  <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/logo-right.png" alt="Right Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={(e) => e.target.style.display = 'none'} /></div>
                </div>
                <table style={{ width: '100%', border: 'none', marginBottom: 15, color: '#000' }}>
                  <tbody>
                    <tr><td style={{ border: 'none', padding: '4px 0', width: '60%', color: '#000' }}>Name of the Course Instructor: <span style={{ fontWeight: 'bold', color: '#000' }}>{headerConfig.instructorName}</span></td><td style={{ border: 'none', padding: '4px 0', width: '40%', color: '#000' }}>Class / Semester: <span style={{ fontWeight: 'bold', color: '#000' }}>{headerConfig.classSemester}</span></td></tr>
                    <tr><td style={{ border: 'none', padding: '4px 0', color: '#000' }}>Course Code & Name: <span style={{ fontWeight: 'bold', color: '#000' }}>{headerConfig.courseCodeName}</span></td><td style={{ border: 'none', padding: '4px 0', color: '#000' }}>Academic Year: <span style={{ fontWeight: 'bold', color: '#000' }}>{headerConfig.academicYear}</span></td></tr>
                    <tr><td colSpan="2" style={{ border: 'none', padding: '4px 0', color: '#000' }}>Date of Exam: <span style={{ fontWeight: 'bold', color: '#000' }}>{headerConfig.examDate}</span></td></tr>
                  </tbody>
                </table>
                <div style={{ fontWeight: 'bold', marginBottom: 5, color: '#000' }}>COURSE OUTCOMES:</div><div style={{ marginBottom: 5, color: '#000' }}>At the end of the course the students will be able to</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 15, color: '#000' }}>
                  <thead><tr><th style={{ border: '1px solid #000', padding: 5, background: '#e5e7eb', width: '10%', color: '#000' }}>CO</th><th style={{ border: '1px solid #000', padding: 5, background: '#e5e7eb', color: '#000' }}>Course outcomes</th><th style={{ border: '1px solid #000', padding: 5, background: '#e5e7eb', width: '15%', color: '#000' }}>BTL Level</th></tr></thead>
                  <tbody>{courseOutcomes.map((co, i) => (<tr key={i}><td style={{ border: '1px solid #000', padding: 5, textAlign: 'center', color: '#000' }}>{co.co}</td><td style={{ border: '1px solid #000', padding: 5, color: '#000' }}>{co.description}</td><td style={{ border: '1px solid #000', padding: 5, textAlign: 'center', color: '#000' }}>{co.btlLevel}</td></tr>))}</tbody>
                </table>
                <div style={{ fontWeight: 'bold', marginBottom: 5, color: '#000' }}>COURSE ASSESSMENT MATRIX</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 15, textAlign: 'center', color: '#000' }}>
                  <thead><tr style={{ background: '#e5e7eb' }}><th style={{ border: '1px solid #000', padding: 4, color: '#000' }}>CO</th>{['PO1','PO2','PO3','PO4','PO5','PO6','PO7','PO8','PO9','PO10','PO11','PO12','PSO1','PSO2','PSO3'].map(p => (<th key={p} style={{ border: '1px solid #000', padding: 4, color: '#000' }}>{p.replace(/\d+/, '')}<br/>{p.match(/\d+/)[0]}</th>))}</tr></thead>
                  <tbody>{cam.map((c, i) => (<tr key={i}><td style={{ border: '1px solid #000', padding: 4, fontWeight: 'bold', color: '#000' }}>{c.co}</td>{['po1','po2','po3','po4','po5','po6','po7','po8','po9','po10','po11','po12','pso1','pso2','pso3'].map(p => (<td key={p} style={{ border: '1px solid #000', padding: 4, color: '#000' }}>{c[p]}</td>))}</tr>))}</tbody>
                </table>
                <div style={{ textAlign: 'center', marginBottom: 15, color: '#000' }}><div>Answer <span style={{ fontWeight: 'bold' }}>ALL</span> the questions</div><div style={{ fontWeight: 'bold' }}>{partAHeading}</div></div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, color: '#000' }}>
                  <tbody>{partAQuestions.map((id, idx) => { const q = questionsPool.find(x => x.id === id); return (<tr key={idx}><td style={{ border: '1px solid #000', padding: '6px', width: '30px', verticalAlign: 'top', color: '#000' }}>{idx + 1}</td><td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{q?.questionText}</td><td style={{ border: '1px solid #000', padding: '6px', width: '80px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{q?.btlLevel || 'UN'},{q?.co || 'CO3'}</td></tr>); })}</tbody>
                </table>
                <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 10, color: '#000' }}>{partBHeading}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, color: '#000' }}>
                  <tbody>{partBQuestions.map((pair, idx) => { const qNum = partB_start + idx; const qA = questionsPool.find(x => x.id === pair.a); const qB = questionsPool.find(x => x.id === pair.b); return (<React.Fragment key={idx}><tr><td style={{ border: '1px solid #000', padding: '6px', width: '30px', verticalAlign: 'top', color: '#000' }}>{qNum} a)</td><td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{qA?.questionText}</td><td style={{ border: '1px solid #000', padding: '6px', width: '80px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{qA?.btlLevel || 'UN'},{qA?.co || 'CO3'}</td></tr><tr><td colSpan="3" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold', color: '#000' }}>(OR)</td></tr><tr><td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', color: '#000' }}>{qNum} b)</td><td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{qB?.questionText}</td><td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{qB?.btlLevel || 'UN'},{qB?.co || 'CO3'}</td></tr></React.Fragment>) })}</tbody>
                </table>
                <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 10, color: '#000' }}>{partCHeading}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 30, color: '#000' }}>
                  <tbody>{partCQuestions.map((pair, idx) => { const qNum = partC_start + idx; const qA = questionsPool.find(x => x.id === pair.a); const qB = questionsPool.find(x => x.id === pair.b); return (<React.Fragment key={idx}><tr><td style={{ border: '1px solid #000', padding: '6px', width: '30px', verticalAlign: 'top', color: '#000' }}>{qNum} a)</td><td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{qA?.questionText}</td><td style={{ border: '1px solid #000', padding: '6px', width: '80px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{qA?.btlLevel || 'UN'},{qA?.co || 'CO3'}</td></tr><tr><td colSpan="3" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold', color: '#000' }}>(OR)</td></tr><tr><td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', color: '#000' }}>{qNum} b)</td><td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{qB?.questionText}</td><td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{qB?.btlLevel || 'UN'},{qB?.co || 'CO3'}</td></tr></React.Fragment>) })}</tbody>
                </table>
                <table style={{ width: '70%', margin: '0 auto', borderCollapse: 'collapse', marginBottom: 40, textAlign: 'center', color: '#000' }}>
                  <thead><tr style={{ background: '#e5e7eb' }}><th style={{ border: '1px solid #000', padding: 4, color: '#000' }}>CO</th><th style={{ border: '1px solid #000', padding: 4, color: '#000' }}>RE</th><th style={{ border: '1px solid #000', padding: 4, color: '#000' }}>UN</th><th style={{ border: '1px solid #000', padding: 4, color: '#000' }}>AP</th><th style={{ border: '1px solid #000', padding: 4, color: '#000' }}>AN</th><th style={{ border: '1px solid #000', padding: 4, color: '#000' }}>CR</th><th style={{ border: '1px solid #000', padding: 4, color: '#000' }}>Total</th></tr></thead>
                  <tbody>{Object.entries(calculateDistribution()).map(([coName, dist]) => (<tr key={coName}><td style={{ border: '1px solid #000', padding: 4, fontWeight: 'bold', color: '#000' }}>{coName}</td><td style={{ border: '1px solid #000', padding: 4, color: '#000' }}>{dist.RE || '-'}</td><td style={{ border: '1px solid #000', padding: 4, color: '#000' }}>{dist.UN || '-'}</td><td style={{ border: '1px solid #000', padding: 4, color: '#000' }}>{dist.AP || '-'}</td><td style={{ border: '1px solid #000', padding: 4, color: '#000' }}>{dist.AN || '-'}</td><td style={{ border: '1px solid #000', padding: 4, color: '#000' }}>{dist.CR || '-'}</td><td style={{ border: '1px solid #000', padding: 4, color: '#000' }}>{dist.Total || '-'}</td></tr>))}</tbody>
                </table>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 40px', fontWeight: 'bold', marginTop: 50, color: '#000', textAlign: 'center' }}>
                  <div style={{ flex: 1 }}>COURSE INSTRUCTOR</div>
                  <div style={{ flex: 1 }}>
                    HOD
                    {['SUBMITTED_TO_PRINCIPAL', 'APPROVED'].includes(paperStatus) && (
                      <div style={{ color: '#10b981', fontSize: '14px', marginTop: '10px' }}>APPROVED</div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    PRINCIPAL
                    {['APPROVED'].includes(paperStatus) && (
                      <div style={{ color: '#10b981', fontSize: '14px', marginTop: '10px' }}>APPROVED</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {editId && (
              <div style={{ marginTop: 30, padding: 20, background: 'var(--bg-color)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <h3>Approval History</h3>
                {approvalHistory.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No history available.</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {approvalHistory.map((h, i) => (
                      <div key={i} style={{ padding: 10, borderLeft: '3px solid #6366f1', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(h.timestamp).toLocaleString()}</div>
                        <div style={{ fontWeight: 'bold' }}>{h.action}</div>
                        <div style={{ fontSize: 13 }}>By: {h.performedByName} ({h.role})</div>
                        {h.remarks && <div style={{ fontSize: 13, marginTop: 4 }}><strong>Remarks:</strong> {h.remarks}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
