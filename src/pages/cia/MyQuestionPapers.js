import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { db } from '../../firebase/config';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FileText, Edit, Eye, Clock, CheckCircle, XCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function MyQuestionPapers() {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();
  const navigate = useNavigate();

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
        where("createdBy", "==", userProfile.uid)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by createdAt descending manually since orderBy requires an index
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT': return <span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: '#f3f4f6', color: '#4b5563' }}>Draft</span>;
      case 'SUBMITTED_TO_HOD': return <span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: '#dbeafe', color: '#1e40af' }}>Pending HOD</span>;
      case 'RETURNED_TO_STAFF': return <span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: '#fee2e2', color: '#991b1b' }}>Returned</span>;
      case 'SUBMITTED_TO_PRINCIPAL': return <span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: '#fef3c7', color: '#92400e' }}>Pending Principal</span>;
      case 'RETURNED_TO_HOD': return <span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: '#fee2e2', color: '#991b1b' }}>Returned to HOD</span>;
      case 'APPROVED': return <span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: '#d1fae5', color: '#065f46' }}>Approved</span>;
      default: return <span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: '#f3f4f6', color: '#4b5563' }}>{status}</span>;
    }
  };

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />
        <div className='page-header'>
          <h1>My Question Papers</h1>
          <p className="subtitle">View and manage your CIA question papers</p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <button onClick={() => navigate('/cia/question-paper')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px' }}>
              + Create New Paper
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 20, textAlign: 'center' }}>Loading...</div>
          ) : papers.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No question papers found. Create your first one!
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 10px' }}>Exam</th>
                    <th style={{ padding: '12px 10px' }}>Course</th>
                    <th style={{ padding: '12px 10px' }}>Class</th>
                    <th style={{ padding: '12px 10px' }}>Date</th>
                    <th style={{ padding: '12px 10px' }}>Status</th>
                    <th style={{ padding: '12px 10px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {papers.map(p => {
                    const isEditable = p.status === 'DRAFT' || p.status === 'RETURNED_TO_STAFF';
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 10px' }}>{p.headerConfig?.examName}</td>
                        <td style={{ padding: '12px 10px' }}>{p.courseCode || p.headerConfig?.courseCodeName}</td>
                        <td style={{ padding: '12px 10px' }}>
                          {p.department ? `${p.department} Y${p.year} S${p.semester} ${p.section ? 'Sec ' + p.section : ''}` : p.headerConfig?.classSemester}
                        </td>
                        <td style={{ padding: '12px 10px' }}>{p.createdAt?.toDate().toLocaleDateString() || '-'}</td>
                        <td style={{ padding: '12px 10px' }}>{getStatusBadge(p.status || 'DRAFT')}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <button 
                            onClick={() => navigate(`/cia/question-paper?id=${p.id}`)}
                            style={{ 
                              padding: '6px 12px', 
                              borderRadius: 4, 
                              border: '1px solid var(--border-color)', 
                              background: 'var(--bg-color)', 
                              color: 'var(--text)', 
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}>
                            {isEditable ? <><Edit size={14} /> Edit</> : <><Eye size={14} /> View</>}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
