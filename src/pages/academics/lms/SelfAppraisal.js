import React, { useState, useEffect } from 'react';
import Sidebar from '../../../components/Sidebar';
import { db } from '../../../firebase/config';
import { collection, query, getDocs, setDoc, doc, where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { UserCheck, Save } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function SelfAppraisal() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  
  const [profileData, setProfileData] = useState({ qualification: '', joiningDate: '', currExp: '', totalExp: '', indExp: '', schoolExp: '' });
  const [pi1, setPi1] = useState({ voice: 0, fluency: 0, subject: 0, interaction: 0, innovative: 0, remarks: '' });
  // Placeholders for PI-2 to PI-5
  const [pi2, setPi2] = useState({ score: 0 });
  const [pi3, setPi3] = useState({ score: 0 });
  const [pi4, setPi4] = useState({ score: 0 });
  const [pi5, setPi5] = useState({ score: 0 });

  useEffect(() => {
    if (userProfile?.uid) fetchAppraisal();
  }, [userProfile]);

  async function fetchAppraisal() {
    setLoading(true);
    try {
      const q = query(collection(db, "self_appraisal"), where("facultyId", "==", userProfile.uid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        if (data.profileData) setProfileData(data.profileData);
        if (data.pi1) setPi1(data.pi1);
        if (data.pi2) setPi2(data.pi2);
        if (data.pi3) setPi3(data.pi3);
        if (data.pi4) setPi4(data.pi4);
        if (data.pi5) setPi5(data.pi5);
      }
    } catch (err) { console.error(err); toast.error("Failed to load appraisal data."); }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Calculate total PGI
      const pgiScore = calculatePi1Total() + Number(pi2.score) + Number(pi3.score) + Number(pi4.score) + Number(pi5.score);
      const docRef = doc(db, "self_appraisal", userProfile.uid);
      await setDoc(docRef, {
        facultyId: userProfile.uid,
        facultyName: userProfile.name,
        profileData,
        pi1, pi2, pi3, pi4, pi5,
        pgiScore,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success("Self Appraisal saved!");
    } catch (err) { toast.error("Save failed."); }
    setSaving(false);
  }

  function calculatePi1Total() {
    return Number(pi1.voice) + Number(pi1.fluency) + Number(pi1.subject) + Number(pi1.interaction) + Number(pi1.innovative);
  }

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text)', fontSize: 13 };
  const labelStyle = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header">
          <h1><UserCheck size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />Self Appraisal</h1>
          <p className="subtitle">Faculty Performance Score Sheet</p>
        </div>

        {loading ? <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div> : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: '#ffffff' }}>
              {[
                { id: 'profile', label: 'Faculty Profile' },
                { id: 'pi1', label: 'PI-1: Teaching' },
                { id: 'pi2', label: 'PI-2' },
                { id: 'pi3', label: 'PI-3' },
                { id: 'pi4', label: 'PI-4' },
                { id: 'pi5', label: 'PI-5' },
                { id: 'summary', label: 'Summary' }
              ].map(tab => (
                <div key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: '16px 20px', cursor: 'pointer', fontWeight: 500, fontSize: 14, color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)', borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : 'none' }}>
                  {tab.label}
                </div>
              ))}
            </div>

            <div style={{ padding: 24 }}>
              {activeTab === 'profile' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div><label style={labelStyle}>Name of Faculty</label><input value={userProfile?.name || ''} disabled style={{ ...inputStyle, opacity: 0.7 }} /></div>
                  <div><label style={labelStyle}>Designation</label><input value={userProfile?.designation || 'Assistant Professor'} disabled style={{ ...inputStyle, opacity: 0.7 }} /></div>
                  <div><label style={labelStyle}>Department</label><input value={userProfile?.dept || ''} disabled style={{ ...inputStyle, opacity: 0.7 }} /></div>
                  <div><label style={labelStyle}>Highest Qualification</label><input value={profileData.qualification} onChange={e => setProfileData({ ...profileData, qualification: e.target.value })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Date of Joining</label><input type="date" value={profileData.joiningDate} onChange={e => setProfileData({ ...profileData, joiningDate: e.target.value })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Experience at Current Institute (Years)</label><input type="number" value={profileData.currExp} onChange={e => setProfileData({ ...profileData, currExp: e.target.value })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Overall Teaching Experience (Years)</label><input type="number" value={profileData.totalExp} onChange={e => setProfileData({ ...profileData, totalExp: e.target.value })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Industry Experience (Years)</label><input type="number" value={profileData.indExp} onChange={e => setProfileData({ ...profileData, indExp: e.target.value })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>School Experience (Years)</label><input type="number" value={profileData.schoolExp} onChange={e => setProfileData({ ...profileData, schoolExp: e.target.value })} style={inputStyle} /></div>
                </div>
              )}

              {activeTab === 'pi1' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h3 style={{ margin: 0, color: 'var(--accent)' }}>PI-1: Teaching and Learning Process</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid var(--border)' }}>
                    <thead>
                      <tr style={{ background: '#ffffff' }}>
                        <th style={{ padding: 12, textAlign: 'left', border: '1px solid var(--border)' }}>Parameter</th>
                        <th style={{ padding: 12, textAlign: 'center', width: 100, border: '1px solid var(--border)' }}>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td style={{ padding: 12, border: '1px solid var(--border)' }}>Voice Modulation</td><td style={{ padding: 8, border: '1px solid var(--border)' }}><input type="number" max="10" value={pi1.voice} onChange={e => setPi1({ ...pi1, voice: e.target.value })} style={inputStyle} /></td></tr>
                      <tr><td style={{ padding: 12, border: '1px solid var(--border)' }}>Fluency & Command over Language</td><td style={{ padding: 8, border: '1px solid var(--border)' }}><input type="number" max="10" value={pi1.fluency} onChange={e => setPi1({ ...pi1, fluency: e.target.value })} style={inputStyle} /></td></tr>
                      <tr><td style={{ padding: 12, border: '1px solid var(--border)' }}>Subject Knowledge</td><td style={{ padding: 8, border: '1px solid var(--border)' }}><input type="number" max="10" value={pi1.subject} onChange={e => setPi1({ ...pi1, subject: e.target.value })} style={inputStyle} /></td></tr>
                      <tr><td style={{ padding: 12, border: '1px solid var(--border)' }}>Interaction with Students</td><td style={{ padding: 8, border: '1px solid var(--border)' }}><input type="number" max="10" value={pi1.interaction} onChange={e => setPi1({ ...pi1, interaction: e.target.value })} style={inputStyle} /></td></tr>
                      <tr><td style={{ padding: 12, border: '1px solid var(--border)' }}>Innovative Practices/Methods Used</td><td style={{ padding: 8, border: '1px solid var(--border)' }}><input type="number" max="10" value={pi1.innovative} onChange={e => setPi1({ ...pi1, innovative: e.target.value })} style={inputStyle} /></td></tr>
                      <tr style={{ background: 'rgba(37,99,235,0.05)', fontWeight: 'bold' }}>
                        <td style={{ padding: 12, textAlign: 'right', border: '1px solid var(--border)' }}>Total Score</td>
                        <td style={{ padding: 12, textAlign: 'center', border: '1px solid var(--border)' }}>{calculatePi1Total()}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div><label style={labelStyle}>Remarks</label><textarea value={pi1.remarks} onChange={e => setPi1({ ...pi1, remarks: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                </div>
              )}

              {['pi2', 'pi3', 'pi4', 'pi5'].includes(activeTab) && (
                <div>
                  <h3 style={{ color: 'var(--accent)', marginBottom: 20 }}>{activeTab.toUpperCase()} Section</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>Enter total score for this performance index.</p>
                  <div style={{ maxWidth: 300 }}>
                    <label style={labelStyle}>Total Score</label>
                    <input 
                      type="number" 
                      value={activeTab === 'pi2' ? pi2.score : activeTab === 'pi3' ? pi3.score : activeTab === 'pi4' ? pi4.score : pi5.score} 
                      onChange={e => {
                        const val = e.target.value;
                        if (activeTab === 'pi2') setPi2({ score: val });
                        if (activeTab === 'pi3') setPi3({ score: val });
                        if (activeTab === 'pi4') setPi4({ score: val });
                        if (activeTab === 'pi5') setPi5({ score: val });
                      }} 
                      style={inputStyle} 
                    />
                  </div>
                </div>
              )}

              {activeTab === 'summary' && (
                <div style={{ maxWidth: 500, margin: '0 auto', padding: 20, border: '1px solid var(--border)', borderRadius: 12, background: '#ffffff' }}>
                  <h3 style={{ textAlign: 'center', margin: '0 0 20px 0', color: 'var(--accent)' }}>Performance Grade Index (PGI)</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}><span>PI-1 Score</span><strong>{calculatePi1Total()}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}><span>PI-2 Score</span><strong>{pi2.score || 0}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}><span>PI-3 Score</span><strong>{pi3.score || 0}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}><span>PI-4 Score</span><strong>{pi4.score || 0}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}><span>PI-5 Score</span><strong>{pi5.score || 0}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0 0 0', fontSize: 18 }}>
                    <strong>Total PGI Score</strong>
                    <strong style={{ color: 'var(--accent)' }}>{calculatePi1Total() + Number(pi2.score) + Number(pi3.score) + Number(pi4.score) + Number(pi5.score)}</strong>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 24, textAlign: 'right' }}>
                <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 24px' }}><Save size={16} /> {saving ? 'Saving...' : 'Save Appraisal'}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
