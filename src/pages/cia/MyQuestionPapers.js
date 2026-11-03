import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import { db } from "../../supabase/supabaseAdapter";
import { collection, query, getDocs, where } from "../../supabase/supabaseAdapter";
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FileText, Edit, Eye, Search, Filter, Plus, RefreshCw } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// Helper: Safe date parsing
const getTime = (val) => {
  if (!val) return 0;
  if (typeof val?.toMillis === 'function') return val.toMillis();
  if (typeof val?.toDate === 'function') return val.toDate().getTime();
  const d = new Date(val);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

const formatDate = (val) => {
  if (!val) return '-';
  if (typeof val?.toDate === 'function') return val.toDate().toLocaleDateString();
  const d = new Date(val);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
};

export default function MyQuestionPapers() {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const isExamCellOrAdmin = ['exam_cell', 'admin', 'principal'].includes(userProfile?.role);

  useEffect(() => {
    if (userProfile?.uid) {
      fetchPapers();
    }
  }, [userProfile]);

  const fetchPapers = async () => {
    setLoading(true);
    try {
      let q;
      if (isExamCellOrAdmin) {
        // Exam cell / Admin / Principal can view all papers across all departments
        q = query(collection(db, "cia_question_papers"));
      } else if (userProfile?.role === 'hod') {
        q = query(
          collection(db, "cia_question_papers"),
          where("department", "==", userProfile.dept || '')
        );
      } else {
        q = query(
          collection(db, "cia_question_papers"),
          where("createdBy", "==", userProfile.uid)
        );
      }
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by createdAt descending safely
      list.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
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

  // Filter papers by department and search text
  const filteredPapers = useMemo(() => {
    return papers.filter(p => {
      const pDept = String(p.department || p.headerConfig?.department || '').trim().toUpperCase();
      const matchDept = selectedDept === 'ALL' || !selectedDept || pDept === selectedDept.trim().toUpperCase();
      
      const q = searchQuery.toLowerCase().trim();
      const courseStr = String(p.courseCode || p.headerConfig?.courseCodeName || '').toLowerCase();
      const examStr = String(p.headerConfig?.examName || '').toLowerCase();
      const facultyStr = String(p.createdByName || p.headerConfig?.instructorName || '').toLowerCase();
      const matchSearch = !q || courseStr.includes(q) || examStr.includes(q) || facultyStr.includes(q);

      return matchDept && matchSearch;
    });
  }, [papers, selectedDept, searchQuery]);

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <Toaster position="top-right" />
        <div className='page-header' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1>{isExamCellOrAdmin ? 'CIA Question Papers' : 'My Question Papers'}</h1>
            <p className="subtitle">
              {isExamCellOrAdmin 
                ? 'Manage and review Question Papers across all college departments' 
                : 'View and manage your CIA question papers'}
            </p>
          </div>
          <button 
            onClick={() => navigate('/cia/question-paper')} 
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 6, fontWeight: 600 }}
          >
            <Plus size={16} /> Create Question Paper
          </button>
        </div>

        {/* Filter Bar */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, alignItems: 'center' }}>
            {isExamCellOrAdmin && (
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  Filter by Department
                </label>
                <select 
                  value={selectedDept} 
                  onChange={(e) => setSelectedDept(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontSize: 13 }}
                >
                  <option value="ALL">All Departments</option>
                  {['CSE', 'ECE', 'EEE', 'MECH', 'IT', 'AIDS', 'CIVIL', 'CSBS'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                Search Papers
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Search course code, name, exam..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingTop: isExamCellOrAdmin ? 24 : 0 }}>
              <button 
                onClick={fetchPapers} 
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}
              >
                <RefreshCw size={14} /> Refresh ({filteredPapers.length})
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center' }}>Loading question papers...</div>
          ) : filteredPapers.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No question papers found matching your criteria.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 700 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: 13 }}>
                    <th style={{ padding: '12px 10px' }}>Exam</th>
                    <th style={{ padding: '12px 10px' }}>Dept</th>
                    <th style={{ padding: '12px 10px' }}>Course</th>
                    <th style={{ padding: '12px 10px' }}>Class / Sem</th>
                    <th style={{ padding: '12px 10px' }}>Created By</th>
                    <th style={{ padding: '12px 10px' }}>Date</th>
                    <th style={{ padding: '12px 10px' }}>Status</th>
                    <th style={{ padding: '12px 10px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPapers.map(p => {
                    const isEditable = isExamCellOrAdmin || p.status === 'DRAFT' || p.status === 'RETURNED_TO_STAFF';
                    const deptVal = p.department || p.headerConfig?.department || '-';
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: 13 }}>
                        <td style={{ padding: '12px 10px', fontWeight: 600 }}>{p.headerConfig?.examName || 'Examination'}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: 4, background: '#eff6ff', color: '#2563eb', fontWeight: 600, fontSize: 11 }}>
                            {deptVal}
                          </span>
                        </td>
                        <td style={{ padding: '12px 10px' }}>{p.courseCode || p.headerConfig?.courseCodeName}</td>
                        <td style={{ padding: '12px 10px' }}>
                          {p.department && p.semester ? `${p.department} Sem ${p.semester}` : p.headerConfig?.classSemester || '-'}
                        </td>
                        <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>{p.createdByName || 'Exam Cell'}</td>
                        <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>{formatDate(p.createdAt)}</td>
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
                              gap: 6,
                              fontSize: 12
                            }}>
                            {isEditable ? <><Edit size={14} /> Open / Edit</> : <><Eye size={14} /> View</>}
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
