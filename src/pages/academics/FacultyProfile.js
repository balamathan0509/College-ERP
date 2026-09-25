import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { Search, User, Download } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function FacultyProfile() {
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 15;
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const { userProfile } = useAuth();

  useEffect(() => { fetchFaculty(); }, []);

  async function fetchFaculty() {
    setLoading(true);
    try {
      const q = query(collection(db, "users"), where("role", "in", ["staff", "hod"]));
      const snap = await getDocs(q);
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
      if (userProfile?.role === 'hod') {
        list = list.filter(f => f.dept === userProfile.dept || f.department === userProfile.dept);
      }
      
      setFaculty(list);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    if (!searchTerm) return faculty;
    const s = searchTerm.toLowerCase();
    return faculty.filter(f => f.name?.toLowerCase().includes(s) || f.dept?.toLowerCase().includes(s) || f.email?.toLowerCase().includes(s));
  }, [faculty, searchTerm]);

  const paginated = useMemo(() => filtered.slice((page - 1) * perPage, page * perPage), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / perPage);

  function handleExport() {
    const data = filtered.map((f, i) => ({ 'S.No': i + 1, 'Faculty ID': f.registerNo || f.uid?.substring(0, 8), 'Name': f.name, 'Designation': f.designation || 'Assistant Professor', 'Department': f.dept, 'Email': f.email, 'Phone': f.phone || '' }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Faculty");
    XLSX.writeFile(wb, "Faculty_List.xlsx");
  }

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text)', fontSize: 13 };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header">
          <h1><User size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />Faculty Profile</h1>
          <p className="subtitle">View and manage faculty profiles</p>
        </div>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }} placeholder="Search faculty..." style={{ ...inputStyle, paddingLeft: 32, width: 250 }} />
            </div>
            <button onClick={handleExport} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Download size={14} /> Export
            </button>
          </div>
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>S.No</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>Faculty ID</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>Name</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>Designation</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>Department</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>Email</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((f, idx) => (
                      <tr key={f.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 8px' }}>{(page - 1) * perPage + idx + 1}</td>
                        <td style={{ padding: '10px 8px' }}>{f.registerNo || f.uid?.substring(0, 8) || '-'}</td>
                        <td style={{ padding: '10px 8px' }}>{f.name}</td>
                        <td style={{ padding: '10px 8px' }}>{f.designation || 'Assistant Professor'}</td>
                        <td style={{ padding: '10px 8px' }}>{f.dept}</td>
                        <td style={{ padding: '10px 8px' }}>{f.email}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <button onClick={() => setSelectedFaculty(f)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12 }}>View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button key={i} onClick={() => setPage(i + 1)} style={{ padding: '4px 10px', borderRadius: 6, border: page === i + 1 ? '1px solid var(--accent)' : '1px solid var(--border)', background: page === i + 1 ? 'var(--accent)' : 'transparent', color: page === i + 1 ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 12 }}>{i + 1}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {selectedFaculty && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#ffffff', borderRadius: 12, padding: 24, width: '90%', maxWidth: 500, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>Faculty Details</h3>
                <button onClick={() => setSelectedFaculty(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                {[['Name', selectedFaculty.name], ['Email', selectedFaculty.email], ['Department', selectedFaculty.dept], ['Designation', selectedFaculty.designation || 'AP'], ['Phone', selectedFaculty.phone || '-'], ['Role', selectedFaculty.role], ['Faculty ID', selectedFaculty.registerNo || '-'], ['Joined', selectedFaculty.createdAt?.substring?.(0, 10) || '-']].map(([label, val]) => (
                  <div key={label}><div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{label}</div><div style={{ fontWeight: 500 }}>{val}</div></div>
                ))}
              </div>
              <div style={{ marginTop: 20, textAlign: 'right' }}>
                <button onClick={() => setSelectedFaculty(null)} className="btn-primary" style={{ padding: '8px 20px' }}>Close</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
