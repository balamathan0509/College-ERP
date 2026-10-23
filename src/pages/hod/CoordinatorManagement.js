// src/pages/hod/CoordinatorManagement.js
import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../supabase/supabaseAdapter';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, where, serverTimestamp
} from '../../supabase/supabaseAdapter';
import toast, { Toaster } from 'react-hot-toast';
import {
  Users, UserPlus, ShieldCheck, Building2, Trash2, Mail,
  CheckCircle2, AlertCircle, Search, RefreshCw, Edit2,
  GraduationCap, Key, Eye, EyeOff, Sparkles, Crown, X
} from 'lucide-react';

const DEPARTMENTS = ['CSE', 'ECE', 'EEE', 'MECH', 'IT', 'AIDS', 'CIVIL'];

export default function CoordinatorManagement() {
  const { userProfile } = useAuth();
  const hodDept = userProfile?.dept || '';

  const [coordinators, setCoordinators] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffSearch, setStaffSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [showRevoke, setShowRevoke] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch staff in this department
      const staffQ = query(
        collection(db, 'users'),
        where('role', 'in', ['staff', 'dept_admin']),
        where('dept', '==', hodDept)
      );
      const staffSnap = await getDocs(staffQ);
      const allStaff = staffSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        name: d.data().name || d.data().staffName || d.data().email || 'Unknown',
        email: d.data().email || '',
        role: d.data().role || 'staff'
      }));

      setStaffList(allStaff);
      setCoordinators(allStaff.filter(s => s.role === 'dept_admin' || s.isCoordinator === true));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load staff data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [hodDept]);

  // Assign coordinator role to a staff member
  const handleAssignCoordinator = async () => {
    if (!selectedStaff) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', selectedStaff.id), {
        role: 'dept_admin',
        isCoordinator: true,
        coordinatorAssignedBy: userProfile?.uid || userProfile?.id,
        coordinatorAssignedAt: serverTimestamp(),
        coordinatorDept: hodDept,
        updatedAt: serverTimestamp()
      });
      toast.success(`${selectedStaff.name} has been assigned as Department Coordinator!`);
      setIsModalOpen(false);
      setSelectedStaff(null);
      setStaffSearch('');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to assign coordinator role');
    } finally {
      setSaving(false);
    }
  };

  // Revoke coordinator role
  const handleRevokeCoordinator = async (coordinator) => {
    try {
      await updateDoc(doc(db, 'users', coordinator.id), {
        role: 'staff',
        isCoordinator: false,
        coordinatorRevokedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success(`Coordinator role revoked from ${coordinator.name}`);
      setShowRevoke(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to revoke coordinator role');
    }
  };

  const nonCoordinatorStaff = staffList.filter(s => s.role !== 'dept_admin' && !s.isCoordinator);
  const filteredNonCoord = nonCoordinatorStaff.filter(s =>
    s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(staffSearch.toLowerCase())
  );
  const filteredCoordinators = coordinators.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div style={{ padding: '28px', background: '#f8fafc', minHeight: '100vh' }}>

          {/* Header */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  padding: '12px', borderRadius: '14px',
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)'
                }}>
                  <Crown size={24} color="#fff" />
                </div>
                <div>
                  <h1 style={{
                    margin: 0, fontSize: '22px', fontWeight: '800',
                    fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#1e293b'
                  }}>
                    Coordinator Management
                  </h1>
                  <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: '13px' }}>
                    <Building2 size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    Assign coordinators who can use the "New Student Add" feature for <strong>{hodDept}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                style={{
                  padding: '11px 20px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none', borderRadius: '10px', color: '#fff',
                  cursor: 'pointer', fontWeight: '700', fontSize: '14px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 4px 12px rgba(99,102,241,0.4)'
                }}
              >
                <UserPlus size={16} /> Assign New Coordinator
              </button>
            </div>
          </div>

          {/* Info Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #f0f4ff, #e0e7ff)',
            border: '1px solid #c7d2fe', borderRadius: '14px', padding: '18px 22px',
            marginBottom: '24px', display: 'flex', gap: '14px', alignItems: 'flex-start'
          }}>
            <div style={{ background: '#6366f1', padding: '10px', borderRadius: '10px', flexShrink: 0 }}>
              <ShieldCheck size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: '700', color: '#3730a3', fontSize: '14px', marginBottom: '4px' }}>
                What can Coordinators do?
              </div>
              <div style={{ color: '#4338ca', fontSize: '13px', lineHeight: 1.6 }}>
                Department Coordinators can <strong>upload CSV files</strong> to admit new 1st-year students,
                <strong> assign sections</strong> (A, B, C...), and <strong>auto-create login accounts</strong>.
                Students will receive their credentials via email and can login with their personal email ID.
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {[
              { label: 'Total Staff', val: staffList.length, color: '#2563eb', bg: '#eff6ff', icon: Users },
              { label: 'Active Coordinators', val: coordinators.length, color: '#059669', bg: '#ecfdf5', icon: ShieldCheck },
              { label: 'Regular Staff', val: nonCoordinatorStaff.length, color: '#7c3aed', bg: '#f5f3ff', icon: GraduationCap }
            ].map(({ label, val, color, bg, icon: Icon }) => (
              <div key={label} style={{ background: '#fff', borderRadius: '14px', padding: '18px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ background: bg, padding: '11px', borderRadius: '12px' }}>
                  <Icon size={20} color={color} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>{label}</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color }}>{loading ? '...' : val}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Coordinators List */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '22px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ margin: 0, fontWeight: '700', color: '#1e293b', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#6366f1" /> Active Coordinators ({filteredCoordinators.length})
              </h3>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text" placeholder="Search coordinator..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  style={{ padding: '8px 12px 8px 32px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', width: '220px' }}
                />
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
                <p>Loading...</p>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : filteredCoordinators.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8' }}>
                <Crown size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
                <p style={{ fontSize: '15px', fontWeight: '600' }}>No coordinators assigned yet</p>
                <p style={{ fontSize: '13px' }}>Click "Assign New Coordinator" to grant admission access to a staff member</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {filteredCoordinators.map(coord => (
                  <div key={coord.id} style={{
                    background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
                    border: '1px solid #c4b5fd', borderRadius: '12px', padding: '16px 20px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '44px', height: '44px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: '800', color: '#fff', fontSize: '18px', flexShrink: 0
                      }}>
                        {coord.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '15px' }}>{coord.name}</span>
                          <span style={{ background: '#6366f1', color: '#fff', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>
                            COORDINATOR
                          </span>
                        </div>
                        <div style={{ color: '#6366f1', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                          <Mail size={11} /> {coord.email}
                        </div>
                        {coord.coordinatorAssignedAt && (
                          <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>
                            Assigned: {coord.coordinatorAssignedAt?.toDate?.()?.toLocaleDateString?.() || 'Recently'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', color: '#15803d', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <CheckCircle2 size={12} /> Can admit students
                      </div>
                      {showRevoke === coord.id ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: '600' }}>Revoke?</span>
                          <button
                            onClick={() => handleRevokeCoordinator(coord)}
                            style={{ padding: '6px 12px', background: '#ef4444', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: '700', fontSize: '12px' }}
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setShowRevoke(null)}
                            style={{ padding: '6px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#475569', cursor: 'pointer', fontWeight: '700', fontSize: '12px' }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowRevoke(coord.id)}
                          style={{
                            padding: '7px 14px', background: '#fef2f2', border: '1px solid #fecaca',
                            borderRadius: '8px', color: '#ef4444', cursor: 'pointer',
                            fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px'
                          }}
                        >
                          <Trash2 size={12} /> Revoke
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assign Coordinator Modal */}
          {isModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '520px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
                  <h3 style={{ margin: 0, fontWeight: '800', color: '#1e293b', fontFamily: 'Plus Jakarta Sans, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Crown size={20} color="#6366f1" /> Assign Coordinator
                  </h3>
                  <button
                    onClick={() => { setIsModalOpen(false); setSelectedStaff(null); setStaffSearch(''); }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    <X size={22} />
                  </button>
                </div>

                <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '18px' }}>
                  Select a staff member from <strong>{hodDept}</strong> to grant coordinator access.
                  They will be able to upload CSV and admit new students.
                </p>

                {/* Staff Search */}
                <div style={{ position: 'relative', marginBottom: '16px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text" placeholder="Search staff by name or email..."
                    value={staffSearch} onChange={e => setStaffSearch(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px 10px 34px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Staff List */}
                <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '20px' }}>
                  {filteredNonCoord.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      {nonCoordinatorStaff.length === 0 ? 'All staff are already coordinators' : 'No matching staff found'}
                    </div>
                  ) : (
                    filteredNonCoord.map(staff => (
                      <div
                        key={staff.id}
                        onClick={() => setSelectedStaff(staff)}
                        style={{
                          padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                          background: selectedStaff?.id === staff.id ? '#f5f3ff' : 'transparent',
                          display: 'flex', alignItems: 'center', gap: '12px',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => { if (selectedStaff?.id !== staff.id) e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={e => { if (selectedStaff?.id !== staff.id) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: selectedStaff?.id === staff.id ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#f1f5f9',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '700', color: selectedStaff?.id === staff.id ? '#fff' : '#94a3b8', fontSize: '15px', flexShrink: 0
                        }}>
                          {staff.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '13px' }}>{staff.name}</div>
                          <div style={{ color: '#94a3b8', fontSize: '12px' }}>{staff.email}</div>
                        </div>
                        {selectedStaff?.id === staff.id && (
                          <CheckCircle2 size={18} color="#6366f1" />
                        )}
                      </div>
                    ))
                  )}
                </div>

                {selectedStaff && (
                  <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: '10px', padding: '14px', marginBottom: '20px', fontSize: '13px', color: '#5b21b6' }}>
                    <strong>{selectedStaff.name}</strong> will be assigned as Department Coordinator for <strong>{hodDept}</strong>.
                    They will get access to the "New Student Add" feature.
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setIsModalOpen(false); setSelectedStaff(null); setStaffSearch(''); }}
                    style={{ padding: '10px 18px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#475569', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssignCoordinator}
                    disabled={!selectedStaff || saving}
                    style={{
                      padding: '10px 20px',
                      background: selectedStaff && !saving ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#e2e8f0',
                      border: 'none', borderRadius: '10px',
                      color: selectedStaff && !saving ? '#fff' : '#94a3b8',
                      cursor: selectedStaff && !saving ? 'pointer' : 'not-allowed',
                      fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
                      boxShadow: selectedStaff ? '0 4px 12px rgba(99,102,241,0.4)' : 'none'
                    }}
                  >
                    <ShieldCheck size={15} />
                    {saving ? 'Assigning...' : 'Assign Coordinator'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
