import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { db } from '../../firebase/config';
import { collection, query, getDocs, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { FileText, Eye, CheckCircle, XCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function HodQuestionPaperReview() {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  const [selectedPaper, setSelectedPaper] = useState(null);
  const [questionsPool, setQuestionsPool] = useState([]);
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPendingPapers();
  }, []);

  const fetchPendingPapers = async () => {
    setLoading(true);
    try {
      let q = query(
        collection(db, "cia_question_papers"),
        where("status", "in", ["SUBMITTED_TO_HOD", "RETURNED_TO_HOD"])
      );
      if (userProfile?.role === "hod") {
        q = query(
          collection(db, "cia_question_papers"),
          where("status", "in", ["SUBMITTED_TO_HOD", "RETURNED_TO_HOD"]),
          where("department", "==", userProfile.dept)
        );
      }
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (b.submittedToHodAt?.toMillis() || 0) - (a.submittedToHodAt?.toMillis() || 0));
      setPapers(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load pending question papers.");
    }
    setLoading(false);
  };

  const handleView = async (paper) => {
    setSelectedPaper(paper);
    setRemarks('');
    // Load question pool for rendering
    try {
      const q = query(collection(db, "cia_question_bank"), where("courseCode", "==", paper.courseCode));
      const snap = await getDocs(q);
      const qList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setQuestionsPool(qList);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAction = async (decision) => {
    if (decision === 'RETURNED' && !remarks.trim()) {
      toast.error("Remarks are required when returning a paper.");
      return;
    }

    setActionLoading(true);
    try {
      const newStatus = decision === 'APPROVED' ? 'SUBMITTED_TO_PRINCIPAL' : 'RETURNED_TO_STAFF';
      const historyEntry = {
        action: decision === 'APPROVED' ? 'HOD Approved' : 'HOD Returned',
        performedBy: userProfile.uid,
        performedByName: userProfile.name,
        role: userProfile.role,
        remarks: remarks.trim(),
        timestamp: new Date().toISOString()
      };

      const docRef = doc(db, "cia_question_papers", selectedPaper.id);
      
      const updateData = {
        status: newStatus,
        hodReviewedAt: new Date().toISOString(),
        hodReviewedBy: userProfile.uid,
        hodDecision: decision,
        hodRemarks: remarks.trim(),
        approvalHistory: [...(selectedPaper.approvalHistory || []), historyEntry]
      };

      if (decision === 'APPROVED') {
        updateData.submittedToPrincipalAt = new Date().toISOString();
        updateData.submittedToPrincipalBy = userProfile.uid;
      }

      await updateDoc(docRef, updateData);
      
      toast.success(`Paper successfully ${decision === 'APPROVED' ? 'approved' : 'returned'}.`);
      setSelectedPaper(null);
      fetchPendingPapers();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status.");
    }
    setActionLoading(false);
  };

  const calculateDistribution = (paper) => {
    const dist = {};
    paper.courseOutcomes.forEach(co => { dist[co.co] = { RE: 0, UN: 0, AP: 0, AN: 0, CR: 0, Total: 0 }; });
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
    (paper.partAQuestions || []).filter(Boolean).forEach(id => addMarks(id, 2));
    (paper.partBQuestions || []).forEach(p => { if (p.a) addMarks(p.a, 13); });
    (paper.partCQuestions || []).forEach(p => { if (p.a) addMarks(p.a, 14); });
    return dist;
  };

  const renderPaper = () => {
    if (!selectedPaper) return null;
    const { headerConfig, courseOutcomes, cam, headings, partAQuestions, partBQuestions, partCQuestions } = selectedPaper;
    const partA_start = 1;
    const partB_start = partA_start + (partAQuestions?.length || 0);
    const partC_start = partB_start + (partBQuestions?.length || 0);

    return (
      <div style={{ background: '#fff', color: '#000', padding: '20px 40px', borderRadius: 8, overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
        <div id="printable-paper" style={{ fontFamily: '"Times New Roman", Times, serif', width: '100%', maxWidth: '800px', margin: '0 auto', fontSize: '13px', border: '3px solid #000', padding: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 15, color: '#000', gap: 15 }}>
            <div style={{ fontWeight: 'bold' }}>Register Number</div>
            <div style={{ display: 'flex' }}>{[1,2,3,4,5,6,7,8,9,10,11,12].map(i => <div key={i} style={{ width: 20, height: 20, border: '1px solid #000', borderRight: i === 12 ? '1px solid #000' : 'none' }}></div>)}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, color: '#000' }}>
            <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/logo-left.png" alt="Left" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={(e) => e.target.style.display = 'none'} /></div>
            <div style={{ textAlign: 'center', flex: 1, padding: '0 15px' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#b91c1c' }}>{headerConfig?.collegeName}</div>
              <div style={{ fontSize: '14px', marginBottom: 10 }}>{headerConfig?.collegeAddress}</div>
              <div style={{ display: 'inline-block', border: '1px solid #1e3a8a', borderRadius: '15px', padding: '5px 20px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: 5 }}>{headerConfig?.examName}</div>
            </div>
            <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/logo-right.png" alt="Right" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={(e) => e.target.style.display = 'none'} /></div>
          </div>
          <table style={{ width: '100%', border: 'none', marginBottom: 15, color: '#000' }}>
            <tbody>
              <tr><td style={{ border: 'none', padding: '4px 0', width: '60%', color: '#000' }}>Name of the Course Instructor: <span style={{ fontWeight: 'bold', color: '#000' }}>{headerConfig?.instructorName}</span></td><td style={{ border: 'none', padding: '4px 0', width: '40%', color: '#000' }}>Class / Semester: <span style={{ fontWeight: 'bold', color: '#000' }}>{headerConfig?.classSemester}</span></td></tr>
              <tr><td style={{ border: 'none', padding: '4px 0', color: '#000' }}>Course Code & Name: <span style={{ fontWeight: 'bold', color: '#000' }}>{headerConfig?.courseCodeName}</span></td><td style={{ border: 'none', padding: '4px 0', color: '#000' }}>Academic Year: <span style={{ fontWeight: 'bold', color: '#000' }}>{headerConfig?.academicYear}</span></td></tr>
              <tr><td colSpan="2" style={{ border: 'none', padding: '4px 0', color: '#000' }}>Date of Exam: <span style={{ fontWeight: 'bold', color: '#000' }}>{headerConfig?.examDate}</span></td></tr>
            </tbody>
          </table>
          <div style={{ fontWeight: 'bold', marginBottom: 5, color: '#000' }}>COURSE OUTCOMES:</div><div style={{ marginBottom: 5, color: '#000' }}>At the end of the course the students will be able to</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 15, color: '#000' }}>
            <thead><tr><th style={{ border: '1px solid #000', padding: 5, background: '#e5e7eb', width: '10%', color: '#000' }}>CO</th><th style={{ border: '1px solid #000', padding: 5, background: '#e5e7eb', color: '#000' }}>Course outcomes</th><th style={{ border: '1px solid #000', padding: 5, background: '#e5e7eb', width: '15%', color: '#000' }}>BTL Level</th></tr></thead>
            <tbody>{(courseOutcomes || []).map((co, i) => (<tr key={i}><td style={{ border: '1px solid #000', padding: 5, textAlign: 'center', color: '#000' }}>{co.co}</td><td style={{ border: '1px solid #000', padding: 5, color: '#000' }}>{co.description}</td><td style={{ border: '1px solid #000', padding: 5, textAlign: 'center', color: '#000' }}>{co.btlLevel}</td></tr>))}</tbody>
          </table>
          <div style={{ fontWeight: 'bold', marginBottom: 5, color: '#000' }}>COURSE ASSESSMENT MATRIX</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 15, textAlign: 'center', color: '#000' }}>
            <thead><tr style={{ background: '#e5e7eb' }}><th style={{ border: '1px solid #000', padding: 4, color: '#000' }}>CO</th>{['PO1','PO2','PO3','PO4','PO5','PO6','PO7','PO8','PO9','PO10','PO11','PO12','PSO1','PSO2','PSO3'].map(p => (<th key={p} style={{ border: '1px solid #000', padding: 4, color: '#000' }}>{p.replace(/\d+/, '')}<br/>{p.match(/\d+/)[0]}</th>))}</tr></thead>
            <tbody>{(cam || []).map((c, i) => (<tr key={i}><td style={{ border: '1px solid #000', padding: 4, fontWeight: 'bold', color: '#000' }}>{c.co}</td>{['po1','po2','po3','po4','po5','po6','po7','po8','po9','po10','po11','po12','pso1','pso2','pso3'].map(p => (<td key={p} style={{ border: '1px solid #000', padding: 4, color: '#000' }}>{c[p]}</td>))}</tr>))}</tbody>
          </table>
          <div style={{ textAlign: 'center', marginBottom: 15, color: '#000' }}><div>Answer <span style={{ fontWeight: 'bold' }}>ALL</span> the questions</div><div style={{ fontWeight: 'bold' }}>{headings?.partA}</div></div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, color: '#000' }}>
            <tbody>{(partAQuestions || []).map((id, idx) => { const q = questionsPool.find(x => x.id === id); return (<tr key={idx}><td style={{ border: '1px solid #000', padding: '6px', width: '30px', verticalAlign: 'top', color: '#000' }}>{idx + 1}</td><td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{q?.questionText}</td><td style={{ border: '1px solid #000', padding: '6px', width: '80px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{q?.btlLevel || 'UN'},{q?.co || 'CO3'}</td></tr>); })}</tbody>
          </table>
          <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 10, color: '#000' }}>{headings?.partB}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, color: '#000' }}>
            <tbody>{(partBQuestions || []).map((pair, idx) => { const qNum = partB_start + idx; const qA = questionsPool.find(x => x.id === pair.a); const qB = questionsPool.find(x => x.id === pair.b); return (<React.Fragment key={idx}><tr><td style={{ border: '1px solid #000', padding: '6px', width: '30px', verticalAlign: 'top', color: '#000' }}>{qNum} a)</td><td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{qA?.questionText}</td><td style={{ border: '1px solid #000', padding: '6px', width: '80px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{qA?.btlLevel || 'UN'},{qA?.co || 'CO3'}</td></tr><tr><td colSpan="3" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold', color: '#000' }}>(OR)</td></tr><tr><td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', color: '#000' }}>{qNum} b)</td><td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{qB?.questionText}</td><td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{qB?.btlLevel || 'UN'},{qB?.co || 'CO3'}</td></tr></React.Fragment>) })}</tbody>
          </table>
          <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 10, color: '#000' }}>{headings?.partC}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 30, color: '#000' }}>
            <tbody>{(partCQuestions || []).map((pair, idx) => { const qNum = partC_start + idx; const qA = questionsPool.find(x => x.id === pair.a); const qB = questionsPool.find(x => x.id === pair.b); return (<React.Fragment key={idx}><tr><td style={{ border: '1px solid #000', padding: '6px', width: '30px', verticalAlign: 'top', color: '#000' }}>{qNum} a)</td><td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{qA?.questionText}</td><td style={{ border: '1px solid #000', padding: '6px', width: '80px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{qA?.btlLevel || 'UN'},{qA?.co || 'CO3'}</td></tr><tr><td colSpan="3" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold', color: '#000' }}>(OR)</td></tr><tr><td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', color: '#000' }}>{qNum} b)</td><td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'justify', color: '#000' }}>{qB?.questionText}</td><td style={{ border: '1px solid #000', padding: '6px', verticalAlign: 'top', textAlign: 'center', color: '#000' }}>{qB?.btlLevel || 'UN'},{qB?.co || 'CO3'}</td></tr></React.Fragment>) })}</tbody>
          </table>
          <table style={{ width: '70%', margin: '0 auto', borderCollapse: 'collapse', marginBottom: 40, textAlign: 'center', color: '#000' }}>
            <thead><tr style={{ background: '#e5e7eb' }}><th style={{ border: '1px solid #000', padding: 4, color: '#000' }}>CO</th><th style={{ border: '1px solid #000', padding: 4, color: '#000' }}>RE</th><th style={{ border: '1px solid #000', padding: 4, color: '#000' }}>UN</th><th style={{ border: '1px solid #000', padding: 4, color: '#000' }}>AP</th><th style={{ border: '1px solid #000', padding: 4, color: '#000' }}>AN</th><th style={{ border: '1px solid #000', padding: 4, color: '#000' }}>CR</th><th style={{ border: '1px solid #000', padding: 4, color: '#000' }}>Total</th></tr></thead>
            <tbody>{Object.entries(calculateDistribution(selectedPaper)).map(([coName, dist]) => (<tr key={coName}><td style={{ border: '1px solid #000', padding: 4, fontWeight: 'bold', color: '#000' }}>{coName}</td><td style={{ border: '1px solid #000', padding: 4, color: '#000' }}>{dist.RE || '-'}</td><td style={{ border: '1px solid #000', padding: 4, color: '#000' }}>{dist.UN || '-'}</td><td style={{ border: '1px solid #000', padding: 4, color: '#000' }}>{dist.AP || '-'}</td><td style={{ border: '1px solid #000', padding: 4, color: '#000' }}>{dist.AN || '-'}</td><td style={{ border: '1px solid #000', padding: 4, color: '#000' }}>{dist.CR || '-'}</td><td style={{ border: '1px solid #000', padding: 4, color: '#000' }}>{dist.Total || '-'}</td></tr>))}</tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 40px', fontWeight: 'bold', marginTop: 50, color: '#000', textAlign: 'center' }}>
            <div style={{ flex: 1 }}>COURSE INSTRUCTOR</div>
            <div style={{ flex: 1 }}>
              HOD
              {['SUBMITTED_TO_PRINCIPAL', 'APPROVED'].includes(selectedPaper.status) && (
                <div style={{ color: '#10b981', fontSize: '14px', marginTop: '10px' }}>APPROVED</div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              PRINCIPAL
              {['APPROVED'].includes(selectedPaper.status) && (
                <div style={{ color: '#10b981', fontSize: '14px', marginTop: '10px' }}>APPROVED</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />
        <div className='page-header'>
          <h1>HOD Question Paper Review</h1>
          <p className="subtitle">Review and approve CIA question papers submitted by staff</p>
        </div>

        {!selectedPaper ? (
          <div className="card">
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center' }}>Loading...</div>
            ) : papers.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                No question papers pending review.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 10px' }}>Exam</th>
                      <th style={{ padding: '12px 10px' }}>Course</th>
                      <th style={{ padding: '12px 10px' }}>Staff</th>
                      <th style={{ padding: '12px 10px' }}>Class</th>
                      <th style={{ padding: '12px 10px' }}>Status</th>
                      <th style={{ padding: '12px 10px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {papers.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 10px' }}>{p.headerConfig?.examName}</td>
                        <td style={{ padding: '12px 10px' }}>{p.headerConfig?.courseCodeName}</td>
                        <td style={{ padding: '12px 10px' }}>{p.createdByName || '-'}</td>
                        <td style={{ padding: '12px 10px' }}>{p.headerConfig?.classSemester}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: '#dbeafe', color: '#1e40af' }}>
                            {p.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <button onClick={() => handleView(p)} className="btn-primary" style={{ padding: '6px 12px', fontSize: 13 }}>Review</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <button onClick={() => setSelectedPaper(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>
                Back to List
              </button>
              <div style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>
                Status: {selectedPaper.status} (Rev {selectedPaper.revisionNumber || 1})
              </div>
            </div>

            {renderPaper()}

            <div style={{ marginTop: 30, padding: 20, border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-color)' }}>
              <h3 style={{ marginTop: 0 }}>HOD Approval</h3>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>Remarks (required if returning)</label>
                <textarea 
                  value={remarks} 
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Enter remarks here..."
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', minHeight: '80px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => handleAction('APPROVED')} disabled={actionLoading} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={18} /> Approve & Send to Principal
                </button>
                <button onClick={() => handleAction('RETURNED')} disabled={actionLoading} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <XCircle size={18} /> Return to Staff
                </button>
              </div>
            </div>

            <div style={{ marginTop: 20, padding: 20, background: 'var(--bg-color)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <h3 style={{ marginTop: 0 }}>Approval History</h3>
              {(selectedPaper.approvalHistory || []).length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No history available.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedPaper.approvalHistory.map((h, i) => (
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
          </div>
        )}
      </main>
    </div>
  );
}
