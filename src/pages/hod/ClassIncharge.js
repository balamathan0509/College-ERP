import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, doc, setDoc, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";
import { Users, Plus, Edit2, Calendar } from "lucide-react";

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export default function ClassIncharge() {
  const { userProfile, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState(userProfile?.dept || "");
  const [departments, setDepartments] = useState([]);
  
  const [classes, setClasses] = useState([]); // { id: "1st Year_A", year, section }
  const [staffList, setStaffList] = useState([]);
  
  const [incharges, setIncharges] = useState([]);
  const [substitutes, setSubstitutes] = useState([]);

  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  
  const [selectedClass, setSelectedClass] = useState(null);
  const [permFormData, setPermFormData] = useState({ facultyId: "" });
  const [subFormData, setSubFormData] = useState({ facultyId: "", fromDate: "", toDate: "", reason: "" });

  const [newClassModal, setNewClassModal] = useState(false);
  const [newClassData, setNewClassData] = useState({ year: "1st Year", section: "" });

  useEffect(() => {
    if (isSuperAdmin) {
      // In a real scenario, fetch departments. Hardcoding standard ones for Admin view.
      setDepartments(["CSE", "ECE", "EEE", "MECH", "IT", "AIDS"]);
    } else if (userProfile?.dept) {
      setDepartment(userProfile.dept);
    }
  }, [userProfile, isSuperAdmin]);

  useEffect(() => {
    if (department) fetchData();
  }, [department]);

  async function fetchData() {
    setLoading(true);
    try {
      // 1. Fetch Staff
      const staffQ = query(collection(db, "users"), where("role", "in", ["staff", "hod"]), where("dept", "==", department));
      const staffSnap = await getDocs(staffQ);
      setStaffList(staffSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)));

      // 2. Fetch Students to find distinct classes
      const studQ = query(collection(db, "users"), where("role", "==", "student"), where("dept", "==", department));
      const studSnap = await getDocs(studQ);
      const classMap = {};
      studSnap.docs.forEach(d => {
        const data = d.data();
        if (data.year && data.section) {
          const key = `${data.year}_${data.section}`;
          classMap[key] = { year: data.year, section: data.section };
        }
      });
      
      // 3. Fetch Permanent Incharges
      const incQ = query(collection(db, "class_incharges"), where("dept", "==", department));
      const incSnap = await getDocs(incQ);
      const incData = incSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setIncharges(incData);

      // Add any classes from incharges that might not have students yet
      incData.forEach(inc => {
        const key = `${inc.year}_${inc.section}`;
        if (!classMap[key]) classMap[key] = { year: inc.year, section: inc.section };
      });

      const clsArr = Object.values(classMap).sort((a, b) => {
        if (a.year !== b.year) return a.year.localeCompare(b.year);
        return a.section.localeCompare(b.section);
      });
      setClasses(clsArr);

      // 4. Fetch Active Substitutes
      const today = new Date().toISOString().split("T")[0];
      const subQ = query(collection(db, "substitute_incharges"), where("dept", "==", department));
      const subSnap = await getDocs(subQ);
      setSubstitutes(subSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.toDate >= today));

    } catch (err) {
      toast.error("Failed to load data.");
    }
    setLoading(false);
  }

  const handleSetPermanent = async (e) => {
    e.preventDefault();
    if (!permFormData.facultyId) { toast.error("Select a staff member."); return; }
    try {
      const staff = staffList.find(s => s.id === permFormData.facultyId);
      const docId = `${department}_${selectedClass.year}_${selectedClass.section}`.replace(/\s+/g, '_');
      await setDoc(doc(db, "class_incharges", docId), {
        dept: department,
        year: selectedClass.year,
        section: selectedClass.section,
        facultyId: staff.id,
        facultyName: staff.name,
        updatedAt: serverTimestamp(),
        updatedBy: userProfile.uid
      });
      toast.success("Permanent incharge assigned.");
      setIsPermModalOpen(false);
      fetchData();
    } catch (err) { toast.error("Save failed."); }
  };

  const handleSetSubstitute = async (e) => {
    e.preventDefault();
    if (!subFormData.facultyId || !subFormData.fromDate || !subFormData.toDate) {
      toast.error("Fill required fields."); return;
    }
    if (subFormData.fromDate > subFormData.toDate) {
      toast.error("From Date cannot be after To Date."); return;
    }
    try {
      const staff = staffList.find(s => s.id === subFormData.facultyId);
      const currentInc = incharges.find(i => i.year === selectedClass.year && i.section === selectedClass.section);
      
      await addDoc(collection(db, "substitute_incharges"), {
        dept: department,
        year: selectedClass.year,
        section: selectedClass.section,
        permanentFacultyId: currentInc?.facultyId || "",
        substituteFacultyId: staff.id,
        substituteFacultyName: staff.name,
        fromDate: subFormData.fromDate,
        toDate: subFormData.toDate,
        reason: subFormData.reason,
        createdBy: userProfile.uid,
        createdAt: serverTimestamp()
      });
      toast.success("Substitute incharge assigned.");
      setIsSubModalOpen(false);
      fetchData();
    } catch (err) { toast.error("Save failed."); }
  };

  const handleAddNewClass = () => {
    if (!newClassData.section.trim()) { toast.error("Section required."); return; }
    const key = `${newClassData.year}_${newClassData.section.trim().toUpperCase()}`;
    if (classes.some(c => `${c.year}_${c.section}` === key)) {
      toast.error("Class already exists."); return;
    }
    setClasses(prev => [...prev, { year: newClassData.year, section: newClassData.section.trim().toUpperCase() }].sort((a,b) => a.year.localeCompare(b.year) || a.section.localeCompare(b.section)));
    setNewClassModal(false);
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1><Users size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />Class Incharge Management</h1>
            <p className="subtitle">{department} Department</p>
          </div>
          {isSuperAdmin && (
            <select className="input-field" style={{ width: 200 }} value={department} onChange={e => setDepartment(e.target.value)}>
              <option value="">Select Dept</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3>Manage Classes</h3>
            <button onClick={() => { setNewClassData({ year: "1st Year", section: "" }); setNewClassModal(true); }} className="btn-primary" style={{ padding: '8px 16px', display: 'flex', gap: 6, alignItems: 'center' }}>
              <Plus size={16} /> Add Empty Class
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
          ) : classes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No classes found. Ensure students have Year and Section assigned, or add an empty class.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: 12 }}>Year</th>
                    <th style={{ padding: 12 }}>Section</th>
                    <th style={{ padding: 12 }}>Permanent Incharge</th>
                    <th style={{ padding: 12 }}>Active Substitute</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((cls, idx) => {
                    const inc = incharges.find(i => i.year === cls.year && i.section === cls.section);
                    const today = new Date().toISOString().split("T")[0];
                    const activeSub = substitutes.find(s => s.year === cls.year && s.section === cls.section && s.fromDate <= today && s.toDate >= today);

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: 12, fontWeight: 600 }}>{cls.year}</td>
                        <td style={{ padding: 12 }}>{cls.section}</td>
                        <td style={{ padding: 12 }}>
                          {inc ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <UserAvatar name={inc.facultyName} />
                              <span style={{ fontWeight: 500, color: activeSub ? 'var(--text-muted)' : 'var(--text)', textDecoration: activeSub ? 'line-through' : 'none' }}>{inc.facultyName}</span>
                            </div>
                          ) : <span style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 'bold' }}>Unassigned</span>}
                        </td>
                        <td style={{ padding: 12 }}>
                          {activeSub ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <UserAvatar name={activeSub.substituteFacultyName} color="var(--warning)" />
                              <div>
                                <div style={{ fontWeight: 500, color: 'var(--warning)' }}>{activeSub.substituteFacultyName}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{activeSub.fromDate} to {activeSub.toDate}</div>
                              </div>
                            </div>
                          ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>None</span>}
                        </td>
                        <td style={{ padding: 12, textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                            <button onClick={() => { setSelectedClass(cls); setPermFormData({ facultyId: inc?.facultyId || "" }); setIsPermModalOpen(true); }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                              Change Permanent
                            </button>
                            <button onClick={() => { setSelectedClass(cls); setSubFormData({ facultyId: "", fromDate: "", toDate: "", reason: "" }); setIsSubModalOpen(true); }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--warning)', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                              Assign Substitute
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Permanent Incharge */}
        {isPermModalOpen && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 400 }}>
              <h3>Assign Permanent Incharge</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>{selectedClass?.year} - Section {selectedClass?.section}</p>
              <form onSubmit={handleSetPermanent}>
                <div style={{ marginBottom: 15 }}>
                  <label>Select Staff *</label>
                  <select className="input-field" style={{ width: '100%', marginTop: 5 }} value={permFormData.facultyId} onChange={e => setPermFormData({...permFormData, facultyId: e.target.value})} required>
                    <option value="">-- Choose Staff --</option>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.registerNo || 'No ID'})</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                  <button type="button" onClick={() => setIsPermModalOpen(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary">Save Assignment</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Substitute Incharge */}
        {isSubModalOpen && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 450 }}>
              <h3>Assign Temporary Substitute</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>{selectedClass?.year} - Section {selectedClass?.section}</p>
              <form onSubmit={handleSetSubstitute}>
                <div style={{ marginBottom: 15 }}>
                  <label>Substitute Staff *</label>
                  <select className="input-field" style={{ width: '100%', marginTop: 5 }} value={subFormData.facultyId} onChange={e => setSubFormData({...subFormData, facultyId: e.target.value})} required>
                    <option value="">-- Choose Staff --</option>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 15, marginBottom: 15 }}>
                  <div style={{ flex: 1 }}>
                    <label>From Date *</label>
                    <input type="date" className="input-field" style={{ width: '100%', marginTop: 5 }} value={subFormData.fromDate} onChange={e => setSubFormData({...subFormData, fromDate: e.target.value})} required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>To Date *</label>
                    <input type="date" className="input-field" style={{ width: '100%', marginTop: 5 }} value={subFormData.toDate} onChange={e => setSubFormData({...subFormData, toDate: e.target.value})} required />
                  </div>
                </div>
                <div style={{ marginBottom: 15 }}>
                  <label>Reason</label>
                  <input type="text" className="input-field" style={{ width: '100%', marginTop: 5 }} value={subFormData.reason} onChange={e => setSubFormData({...subFormData, reason: e.target.value})} placeholder="e.g. Permanent staff on leave" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                  <button type="button" onClick={() => setIsSubModalOpen(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary" style={{ background: 'var(--warning)', color: '#fff' }}>Save Substitute</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: New Empty Class */}
        {newClassModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 400 }}>
              <h3>Add Empty Class</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>Add a class manually if it has no students yet.</p>
              <div style={{ marginBottom: 15 }}>
                <label>Year *</label>
                <select className="input-field" style={{ width: '100%', marginTop: 5 }} value={newClassData.year} onChange={e => setNewClassData({...newClassData, year: e.target.value})}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 15 }}>
                <label>Section *</label>
                <input type="text" className="input-field" style={{ width: '100%', marginTop: 5 }} value={newClassData.section} onChange={e => setNewClassData({...newClassData, section: e.target.value})} placeholder="e.g. A, B, C" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" onClick={() => setNewClassModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleAddNewClass} className="btn-primary">Add Class</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

function UserAvatar({ name, color = "var(--primary)" }) {
  return (
    <div style={{ width: 28, height: 28, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold' }}>
      {name ? name.charAt(0).toUpperCase() : 'U'}
    </div>
  );
}
