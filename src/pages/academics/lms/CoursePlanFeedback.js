import React, { useState, useEffect } from 'react';
import Sidebar from '../../../components/Sidebar';
import { db } from '../../../firebase/config';
import { collection, query, getDocs, updateDoc, doc, where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { MessageSquare, Save } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function CoursePlanFeedback() {
  const { userProfile, isSuperAdmin } = useAuth();
  const [allocations, setAllocations] = useState([]);
  const [selectedAlloc, setSelectedAlloc] = useState('');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedbackData, setFeedbackData] = useState({});

  useEffect(() => {
    // Load allocations. If HOD, load department's allocations. If staff, load own (maybe they can see their own feedback)
    // For feedback giving, usually it's HOD or higher. Let's load based on role.
    async function fetchAllocs() {
      try {
        let q;
        if (isSuperAdmin || userProfile?.role === 'admin' || userProfile?.role === 'principal') {
          q = query(collection(db, "course_allocations"));
        } else if (userProfile?.role === 'hod') {
          q = query(collection(db, "course_allocations"), where("department", "==", userProfile.dept));
        } else {
          // staff just viewing their own feedback
          q = query(collection(db, "course_allocations"), where("facultyId", "==", userProfile?.uid));
        }
        const snap = await getDocs(q);
        setAllocations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) { console.error(err); }
    }
    if (userProfile?.uid) fetchAllocs();
  }, [userProfile, isSuperAdmin]);

  useEffect(() => {
    if (selectedAlloc) fetchPlans(selectedAlloc);
  }, [selectedAlloc]);

  async function fetchPlans(allocId) {
    setLoading(true);
    try {
      const q = query(collection(db, "course_plans"), where("allocationId", "==", allocId));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => Number(a.unit) - Number(b.unit) || a.topic.localeCompare(b.topic));
      setPlans(list);
      
      const initialFeedback = {};
      list.forEach(p => {
        initialFeedback[p.id] = p.feedback || '';
      });
      setFeedbackData(initialFeedback);
    } catch (err) { console.error(err); toast.error("Failed to load plans."); }
    setLoading(false);
  }

  async function handleSaveFeedback(planId) {
    setSaving(true);
    try {
      await updateDoc(doc(db, "course_plans", planId), {
        feedback: feedbackData[planId],
        reviewer: userProfile?.name || 'Reviewer',
        feedbackDate: new Date().toISOString().split('T')[0],
        updatedAt: serverTimestamp()
      });
      toast.success("Feedback saved.");
      fetchPlans(selectedAlloc);
    } catch (err) { toast.error("Save failed."); }
    setSaving(false);
  }

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text)', fontSize: 13 };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header">
          <h1><MessageSquare size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />Course Plan Feedback</h1>
          <p className="subtitle">Review and provide feedback on course plan completion</p>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Select Course Allocation *</label>
          <select value={selectedAlloc} onChange={e => setSelectedAlloc(e.target.value)} style={{ ...inputStyle, maxWidth: 600 }}>
            <option value="">-- Select --</option>
            {allocations.map(a => <option key={a.id} value={a.id}>{a.courseCode} - {a.courseName} ({a.facultyName}) - Sem {a.semester}</option>)}
          </select>
        </div>

        {selectedAlloc && (
          <div className="card">
            {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : plans.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No plans found for this course.</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 8px', textAlign: 'left', width: 50 }}>Unit</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>Topic</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left', width: '30%' }}>Feedback</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', width: 90 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 'bold' }}>{p.unit}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ fontWeight: 500 }}>{p.topic}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Actual: {p.actualDate || '-'} | Remarks: {p.remarks || '-'}</div>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 'bold', color: p.status === 'Completed' ? 'var(--success)' : 'var(--warning)' }}>{p.status || 'Planned'}</span>
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <textarea 
                            value={feedbackData[p.id]} 
                            onChange={e => setFeedbackData(prev => ({ ...prev, [p.id]: e.target.value }))}
                            rows={2} 
                            style={{ ...inputStyle, resize: 'vertical' }}
                            placeholder="Enter feedback..."
                          />
                          {p.reviewer && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Last reviewed by {p.reviewer} on {p.feedbackDate}</div>}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <button onClick={() => handleSaveFeedback(p.id)} disabled={saving} className="btn-primary" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, margin: '0 auto' }}>
                            <Save size={14} /> Save
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
