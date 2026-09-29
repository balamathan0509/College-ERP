import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { collection, query, getDocs, addDoc, deleteDoc, doc, updateDoc, orderBy, where } from 'firebase/firestore';
import { Plus, Trash2, Search, FileText, Edit2, Printer, ArrowLeft, Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import toast, { Toaster } from 'react-hot-toast';

export default function QuestionBank() {
  const { userProfile } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' (bulk) or 'edit' (single)
  const [editId, setEditId] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [selectedAllocation, setSelectedAllocation] = useState('');
  
  // Single Edit Form Data
  const [formData, setFormData] = useState({
    courseCode: '',
    courseName: '',
    programme: '',
    semester: '',
    section: 'A',
    unit: '1',
    topic: '',
    questionText: '',
    marks: '2',
    difficulty: 'Medium'
  });

  // Bulk Add Form Data
  const [bulkData, setBulkData] = useState({
    courseCode: '',
    courseName: '',
    programme: '',
    semester: '',
    unit: '1',
    difficulty: 'Medium',
    partA: [''],
    partB: [''],
    partC: ['']
  });

  const PROGRAMMES = ["B.E CSE", "B.E ECE", "B.E EEE", "B.E MECH", "B.Tech IT"];
  const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];

useEffect(() => {
    if (userProfile?.role === 'staff') {
      fetchAllocations();
    } else {
      fetchQuestions();
    }
  }, [userProfile]);

  useEffect(() => {
    if (userProfile?.role === 'staff' && selectedAllocation) {
      fetchQuestions();
    }
  }, [selectedAllocation]);

  async function fetchAllocations() {
    try {
      const q = query(collection(db, "subject_allocations"), where("facultyId", "==", userProfile.uid), where("status", "==", "Active"));
      const snap = await getDocs(q);
      let allocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), isSubstitute: false }));
      
      const subQ = query(collection(db, "subject_substitutes"), where("substituteFacultyId", "==", userProfile.uid), where("status", "==", "Active"));
      const subSnap = await getDocs(subQ);
      const subs = subSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), isSubstitute: true, subjectId: doc.data().subjectId })); // substitute carries allocation info differently but has allocationId
      
      const merged = [...allocs, ...subs];
      setAllocations(merged);
      if (merged.length > 0) setSelectedAllocation(merged[0].id);
    } catch (err) {
      console.error("Error fetching allocations", err);
    }
  }

  async function fetchQuestions() {
    setLoading(true);
    try {
      let q = query(collection(db, "cia_question_bank"), orderBy("createdAt", "desc"));
      
      if (userProfile?.role === 'staff') {
         if (!selectedAllocation) {
           setQuestions([]);
           setLoading(false);
           return;
         }
         const alloc = allocations.find(a => a.id === selectedAllocation);
         if (alloc) {
           if (alloc.isSubstitute) {
             q = query(collection(db, "cia_question_bank"), where("substituteId", "==", alloc.id));
           } else {
             q = query(collection(db, "cia_question_bank"), where("subjectAllocationId", "==", alloc.id));
           }
         }
      } else if (userProfile?.role === 'hod') {
         q = query(collection(db, "cia_question_bank"), where("department", "==", userProfile.dept));
      }
      
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuestions(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load question bank");
    }
    setLoading(false);
  }

  // --- Handlers for Single Edit ---
  const handleSectionChange = (e) => {
    const val = e.target.value;
    let newMarks = '2';
    if (val === 'B') newMarks = '13';
    if (val === 'C') newMarks = '14';
    setFormData(prev => ({ ...prev, section: val, marks: newMarks }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!formData.courseCode || !formData.questionText) {
      toast.error("Please fill all mandatory fields");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        updatedAt: new Date().toISOString()
      };
      if (userProfile?.role === 'staff') {
        const alloc = allocations.find(a => a.id === selectedAllocation);
        if (alloc) {
           if (alloc.isSubstitute) {
             payload.substituteId = alloc.id;
             payload.subjectAllocationId = alloc.allocationId;
           } else {
             payload.subjectAllocationId = alloc.id;
           }
           payload.department = alloc.department || '';
           payload.year = alloc.year || '';
           payload.semester = alloc.semester || '';
           payload.section = alloc.section || '';
        }
      }
      await updateDoc(doc(db, "cia_question_bank", editId), payload);
      toast.success("Question updated successfully");
      setShowModal(false);
      fetchQuestions();
    } catch (err) {
      console.error(err);
      toast.error("Error saving question");
    }
    setSaving(false);
  };

  const handleEdit = (q) => {
    setModalMode('edit');
    setFormData({
      courseCode: q.courseCode || '',
      courseName: q.courseName || '',
      programme: q.programme || '',
      semester: q.semester || '',
      section: q.section || 'A',
      unit: q.unit || '1',
      topic: q.topic || '',
      questionText: q.questionText || '',
      marks: q.marks || '2',
      difficulty: q.difficulty || 'Medium'
    });
    setEditId(q.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this question?")) {
      try {
        await deleteDoc(doc(db, "cia_question_bank", id));
        toast.success("Question deleted");
        fetchQuestions();
      } catch (err) {
        toast.error("Failed to delete question");
      }
    }
  };

  // --- Handlers for Bulk Add ---
  const handleBulkChange = (e) => {
    const { name, value } = e.target;
    setBulkData(prev => ({ ...prev, [name]: value }));
  };

  const handleBulkArrayChange = (section, index, value) => {
    setBulkData(prev => {
      const newArray = [...prev[section]];
      newArray[index] = value;
      return { ...prev, [section]: newArray };
    });
  };

  const addBulkField = (section) => {
    setBulkData(prev => ({
      ...prev,
      [section]: [...prev[section], '']
    }));
  };

  const removeBulkField = (section, index) => {
    setBulkData(prev => {
      const newArray = [...prev[section]];
      newArray.splice(index, 1);
      return { ...prev, [section]: newArray };
    });
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!bulkData.courseCode) {
      toast.error("Please enter the Course Code");
      return;
    }

    // Filter out empty questions
    const validPartA = bulkData.partA.filter(q => q.trim() !== '');
    const validPartB = bulkData.partB.filter(q => q.trim() !== '');
    const validPartC = bulkData.partC.filter(q => q.trim() !== '');

    if (validPartA.length === 0 && validPartB.length === 0 && validPartC.length === 0) {
      toast.error("Please add at least one question text.");
      return;
    }

    setSaving(true);
try {
      let allocData = {};
      if (userProfile?.role === 'staff') {
        const alloc = allocations.find(a => a.id === selectedAllocation);
        if (!alloc) {
           toast.error("No active subject assignment selected.");
           setSaving(false);
           return;
        }
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
      } else if (userProfile?.role === 'hod') {
        allocData.department = userProfile.dept;
      }

      const basePayload = {
        courseCode: bulkData.courseCode,
        courseName: bulkData.courseName,
        programme: bulkData.programme,
        semester: bulkData.semester,
        unit: bulkData.unit,
        difficulty: bulkData.difficulty,
        topic: '',
        createdAt: new Date().toISOString(),
        createdBy: userProfile?.uid || "unknown", // STRICT: Need uid for createdBy for rule matching
        createdByName: userProfile?.name || "System",
        authorId: userProfile?.uid || "unknown",
        ...allocData
      };

      const promises = [];

      // Save Part A
      for (const text of validPartA) {
        promises.push(addDoc(collection(db, "cia_question_bank"), {
          ...basePayload, section: 'A', marks: '2', questionText: text
        }));
      }

      // Save Part B
      for (const text of validPartB) {
        promises.push(addDoc(collection(db, "cia_question_bank"), {
          ...basePayload, section: 'B', marks: '13', questionText: text
        }));
      }

      // Save Part C
      for (const text of validPartC) {
        promises.push(addDoc(collection(db, "cia_question_bank"), {
          ...basePayload, section: 'C', marks: '14', questionText: text
        }));
      }

      await Promise.all(promises);
      toast.success(`Successfully added ${promises.length} questions to the bank`);
      
      setShowModal(false);
      setBulkData({
        courseCode: '', courseName: '', programme: '', semester: '', unit: '1', difficulty: 'Medium', partA: [''], partB: [''], partC: ['']
      });
      fetchQuestions();
    } catch (err) {
      console.error(err);
      toast.error("Error saving bulk questions");
    }
    setSaving(false);
  };

  const filteredQuestions = questions.filter(q => 
    (q.courseCode || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (q.questionText || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const poolStats = useMemo(() => {
    const stats = { partA: 0, partB: 0, partC: 0 };
    filteredQuestions.forEach(q => {
      if (q.section === 'A') stats.partA++;
      else if (q.section === 'B') stats.partB++;
      else if (q.section === 'C') stats.partC++;
    });
    return stats;
  }, [filteredQuestions]);

  const uniqueCourses = Array.from(new Set(questions.map(q => q.courseCode).filter(Boolean)));

  const handlePrint = () => {
    if (filteredQuestions.length === 0) {
      toast.error("No questions available to print.");
      return;
    }
    const printContent = document.getElementById("printable-bank");
    if (!printContent) return;
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    iframe.contentDocument.write(`
      <html><head><title>Question Bank</title>
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
    if (filteredQuestions.length === 0) {
      toast.error("No questions available to download.");
      return;
    }
    const printContent = document.getElementById("printable-bank");
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

    const firstQ = filteredQuestions[0] || {};
    const filename = firstQ.courseCode ? `Question_Bank_${firstQ.courseCode}.pdf` : `Question_Bank.pdf`;

    const opt = {
      margin:       10,
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, windowWidth: 720 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(htmlString).save();
  };

  // Data for printing
  const partA = filteredQuestions.filter(q => q.section === 'A');
  const partB = filteredQuestions.filter(q => q.section === 'B');
  const partC = filteredQuestions.filter(q => q.section === 'C');
  const firstQ = filteredQuestions[0] || {};
  const courseCodeStr = firstQ.courseCode || 'Unknown Course';
  const courseNameStr = firstQ.courseName || '';
  const courseText = courseNameStr ? `${courseCodeStr} - ${courseNameStr}` : courseCodeStr;

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />
        <div className='page-header' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 15 }}>
          <div>
            <h1>Question Bank</h1>
            <p className="subtitle">Manage question pools for generating papers</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" onClick={handleDownloadPdf} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', cursor: 'pointer' }}>
              <Download size={18} /> Download PDF
            </button>
            <button className="btn-secondary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', cursor: 'pointer' }}>
              <Printer size={18} /> Print Bank
            </button>
            <button className="btn-primary" onClick={() => { setModalMode('add'); setShowModal(true); }}>
              <Plus size={18} /> Add Questions
            </button>
          </div>
        </div>

{userProfile?.role === 'staff' && allocations.length > 0 && (
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
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 15, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div className="search-bar" style={{ flex: 1, minWidth: 250, maxWidth: 400 }}>
              <Search size={18} color="#9ca3af" />
              <input 
                type="text" 
                placeholder="Search by course code or question text..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Filter Course:</span>
              <select value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ padding: '8px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                <option value="">All Courses</option>
                {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 15, marginTop: 15, flexWrap: 'wrap' }}>
            <div style={{ padding: '10px 15px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>Part A (2 Marks)</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: poolStats.partA >= 10 ? '#10b981' : '#ef4444' }}>{poolStats.partA} / 10</div>
            </div>
            <div style={{ padding: '10px 15px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>Part B (13 Marks)</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: poolStats.partB >= 10 ? '#10b981' : '#ef4444' }}>{poolStats.partB} / 10</div>
            </div>
            <div style={{ padding: '10px 15px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>Part C (14 Marks)</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: poolStats.partC >= 3 ? '#10b981' : '#ef4444' }}>{poolStats.partC} / 3</div>
            </div>
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading questions...</div>
          ) : filteredQuestions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No questions found. Add some questions to build the pool.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {filteredQuestions.map((q) => (
                <div key={q.id} style={{ padding: 15, borderRadius: 8, border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontSize: 12, fontWeight: 600 }}>{q.courseCode}</span>
                      <span style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 12, fontWeight: 600 }}>Part {q.section}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Unit {q.unit}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>• {q.marks} Marks</span>
                      <span style={{ padding: '2px 6px', borderRadius: 4, background: q.difficulty === 'Easy' ? 'rgba(16,185,129,0.1)' : q.difficulty === 'Hard' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: q.difficulty === 'Easy' ? '#10b981' : q.difficulty === 'Hard' ? '#ef4444' : '#f59e0b', fontSize: 11 }}>{q.difficulty}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => handleEdit(q)} style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer' }}><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(q.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.5, display: 'flex', gap: 10 }}>
                    <FileText size={18} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ whiteSpace: 'pre-wrap' }}>{q.questionText}</div>
                  </div>
                  {q.topic && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>Topic: {q.topic}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hidden printable block */}
        <div style={{ display: 'none' }}>
          <div id="printable-bank" style={{ fontFamily: '"Times New Roman", Times, serif', width: '100%', maxWidth: '800px', margin: '0 auto', fontSize: '13px', border: '3px solid #000', padding: '15px', color: '#000' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, color: '#000' }}>
              <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/logo-left.png" alt="Left Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /></div>
              <div style={{ textAlign: 'center', flex: 1, padding: '0 15px' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#b91c1c' }}>RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING</div>
                <div style={{ fontSize: '14px', marginBottom: 10 }}>Salvarpatti, Sivakasi - 626 128</div>
                <div style={{ display: 'inline-block', border: '1px solid #1e3a8a', borderRadius: '15px', padding: '5px 20px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: 5 }}>QUESTION BANK</div>
              </div>
              <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/logo-right.png" alt="Right Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /></div>
            </div>
            <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 20 }}>Course: {courseText}</div>

            {partA.length > 0 && (
              <>
                <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 10, color: '#000' }}>PART – A (2 Marks)</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, color: '#000' }}>
                  <tbody>
                    {partA.map((q, idx) => (
                      <tr key={idx}>
                        <td style={{ border: '1px solid #000', padding: '6px', width: '30px', verticalAlign: 'top', color: '#000' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{q.questionText}</td>
                        <td style={{ border: '1px solid #000', padding: '6px', width: '80px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{q.difficulty || 'Medium'}<br/>Unit {q.unit || '1'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {partB.length > 0 && (
              <>
                <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 10, color: '#000' }}>PART – B (13 Marks)</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, color: '#000' }}>
                  <tbody>
                    {partB.map((q, idx) => (
                      <tr key={idx}>
                        <td style={{ border: '1px solid #000', padding: '6px', width: '30px', verticalAlign: 'top', color: '#000' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{q.questionText}</td>
                        <td style={{ border: '1px solid #000', padding: '6px', width: '80px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{q.difficulty || 'Medium'}<br/>Unit {q.unit || '1'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {partC.length > 0 && (
              <>
                <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 10, color: '#000' }}>PART – C (14 Marks)</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, color: '#000' }}>
                  <tbody>
                    {partC.map((q, idx) => (
                      <tr key={idx}>
                        <td style={{ border: '1px solid #000', padding: '6px', width: '30px', verticalAlign: 'top', color: '#000' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{q.questionText}</td>
                        <td style={{ border: '1px solid #000', padding: '6px', width: '80px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{q.difficulty || 'Medium'}<br/>Unit {q.unit || '1'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

      </main>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '90%', maxWidth: 800, maxHeight: '90vh', overflowY: 'auto' }}>
            
            {modalMode === 'edit' ? (
              // --- SINGLE EDIT MODE ---
              <>
                <h2 style={{ marginTop: 0, marginBottom: 20 }}>Edit Question</h2>
                <form onSubmit={handleEditSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 20 }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Course Code *</label>
                      <input type="text" name="courseCode" value={formData.courseCode} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Course Name</label>
                      <input type="text" name="courseName" value={formData.courseName} onChange={handleInputChange} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Programme</label>
                      <select name="programme" value={formData.programme} onChange={handleInputChange} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                        <option value="">Select</option>
                        {PROGRAMMES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Semester</label>
                      <select name="semester" value={formData.semester} onChange={handleInputChange} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                        <option value="">Select</option>
                        {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Section *</label>
                      <select name="section" value={formData.section} onChange={handleSectionChange} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                        <option value="A">Part A (2 Marks)</option>
                        <option value="B">Part B (13 Marks)</option>
                        <option value="C">Part C (14 Marks)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Marks</label>
                      <input type="text" value={formData.marks} readOnly style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)', color: 'var(--text)' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Unit</label>
                      <select name="unit" value={formData.unit} onChange={handleInputChange} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                        {[1, 2, 3, 4, 5].map(u => <option key={u} value={u}>Unit {u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Difficulty</label>
                      <select name="difficulty" value={formData.difficulty} onChange={handleInputChange} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)' }}>
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Question Text *</label>
                      <textarea name="questionText" value={formData.questionText} onChange={handleInputChange} required rows={3} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', resize: 'vertical' }} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" className="btn-primary" disabled={saving}>
                      {saving ? 'Updating...' : 'Update Question'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              // --- BULK ADD MODE ---
              <>
                <h2 style={{ marginTop: 0, marginBottom: 5 }}>Add Questions to Bank</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>Quickly add multiple questions at once for a specific course.</p>
                
                <form onSubmit={handleBulkSubmit}>
                  {/* Global Settings */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 15, marginBottom: 30, padding: 15, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>Course Code *</label>
                      <input type="text" name="courseCode" value={bulkData.courseCode} onChange={handleBulkChange} placeholder="CS101" required style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>Course Name</label>
                      <input type="text" name="courseName" value={bulkData.courseName} onChange={handleBulkChange} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>Programme</label>
                      <select name="programme" value={bulkData.programme} onChange={handleBulkChange} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontSize: 13 }}>
                        <option value="">Select</option>
                        {PROGRAMMES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>Semester</label>
                      <select name="semester" value={bulkData.semester} onChange={handleBulkChange} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontSize: 13 }}>
                        <option value="">Select</option>
                        {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>Unit</label>
                      <select name="unit" value={bulkData.unit} onChange={handleBulkChange} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontSize: 13 }}>
                        {[1, 2, 3, 4, 5].map(u => <option key={u} value={u}>Unit {u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>Difficulty</label>
                      <select name="difficulty" value={bulkData.difficulty} onChange={handleBulkChange} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontSize: 13 }}>
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                  </div>

                  {/* PART A section */}
                  <div style={{ marginBottom: 30 }}>
                    <h3 style={{ margin: '0 0 10px', fontSize: 15, color: '#6366f1' }}>PART A — 2 MARK QUESTIONS</h3>
                    {bulkData.partA.map((val, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                        <span style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)', width: 24 }}>Q{idx + 1}</span>
                        <textarea value={val} onChange={(e) => handleBulkArrayChange('partA', idx, e.target.value)} rows={2} placeholder="Enter question..." style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', resize: 'vertical' }} />
                        {bulkData.partA.length > 1 && (
                          <button type="button" onClick={() => removeBulkField('partA', idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 8 }}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => addBulkField('partA')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>
                      <Plus size={14} /> Add Part A Question
                    </button>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px dashed var(--border-color)', margin: '20px 0' }} />

                  {/* PART B section */}
                  <div style={{ marginBottom: 30 }}>
                    <h3 style={{ margin: '0 0 10px', fontSize: 15, color: '#6366f1' }}>PART B — 13 MARK QUESTIONS</h3>
                    {bulkData.partB.map((val, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                        <span style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)', width: 24 }}>Q{idx + 1}</span>
                        <textarea value={val} onChange={(e) => handleBulkArrayChange('partB', idx, e.target.value)} rows={2} placeholder="Enter question..." style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', resize: 'vertical' }} />
                        {bulkData.partB.length > 1 && (
                          <button type="button" onClick={() => removeBulkField('partB', idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 8 }}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => addBulkField('partB')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>
                      <Plus size={14} /> Add Part B Question
                    </button>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px dashed var(--border-color)', margin: '20px 0' }} />

                  {/* PART C section */}
                  <div style={{ marginBottom: 30 }}>
                    <h3 style={{ margin: '0 0 10px', fontSize: 15, color: '#6366f1' }}>PART C — 14 MARK QUESTIONS</h3>
                    {bulkData.partC.map((val, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                        <span style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)', width: 24 }}>Q{idx + 1}</span>
                        <textarea value={val} onChange={(e) => handleBulkArrayChange('partC', idx, e.target.value)} rows={2} placeholder="Enter question..." style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', resize: 'vertical' }} />
                        {bulkData.partC.length > 1 && (
                          <button type="button" onClick={() => removeBulkField('partC', idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 8 }}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => addBulkField('partC')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>
                      <Plus size={14} /> Add Part C Question
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 30, borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
                    <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" className="btn-primary" disabled={saving}>
                      {saving ? 'Saving...' : 'SAVE ALL QUESTIONS'}
                    </button>
                  </div>
                </form>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
