import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import { db } from '../../firebase/config';
import { collection, query, getDocs, addDoc, updateDoc, doc, where, serverTimestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Plus, Search, Edit2, History, X, Users, BookOpen, Clock, AlertTriangle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIDS", "AIML", "MBA", "MCA"];
const YEARS = ["1", "2", "3", "4"];
const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];
const SECTIONS = ["A", "B", "C", "D", "E", "F"];

export default function SubjectAllocation() {
  const { userProfile, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [substitutes, setSubstitutes] = useState([]);
  
  // Selection state
  const [selectedDept, setSelectedDept] = useState(isSuperAdmin ? '' : (userProfile?.dept || ''));
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(''); // Optional, e.g. "2023-2027"

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showSubstituteModal, setShowSubstituteModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // Active subject being operated on
  const [activeSubject, setActiveSubject] = useState(null);
  
  // Forms
  const [assignForm, setAssignForm] = useState({ facultyId: '' });
  const [substituteForm, setSubstituteForm] = useState({ substituteFacultyId: '', fromDate: '', toDate: '', reason: '' });
  
  // Save states
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    if (selectedDept && selectedYear && selectedSemester) {
      fetchAllocations();
    }
  }, [selectedDept, selectedYear, selectedSemester, selectedSection, selectedBatch]);

  async function fetchMasterData() {
    try {
      // Courses
      const courseSnap = await getDocs(collection(db, "courses"));
      setCourses(courseSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      let facQ = query(collection(db, "users"), where("role", "in", ["staff", "hod"]));
      if (userProfile?.role === "hod") {
        facQ = query(collection(db, "users"), where("role", "in", ["staff", "hod"]), where("dept", "==", userProfile.dept));
      }
      const facSnap = await getDocs(facQ);
      setFaculty(facSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load master data.");
    }
  }

  async function fetchAllocations() {
    setLoading(true);
    try {
      let q = query(collection(db, "subject_allocations"), 
        where("department", "==", selectedDept),
        where("year", "==", selectedYear),
        where("semester", "==", selectedSemester),
        where("section", "==", selectedSection || "")
      );
      // Batch filtering handled in memory to avoid index issues if not queried
      
      const snap = await getDocs(q);
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (selectedBatch) {
        list = list.filter(a => a.batch === selectedBatch);
      }
      
      // Get all history vs active
      // Active permanent assignments
      const activeAllocations = list.filter(a => a.status === 'Active');
      setAllocations(activeAllocations);
      
      // Also fetch substitutes for these allocations
      if (activeAllocations.length > 0) {
        const allocationIds = activeAllocations.map(a => a.id);
        
        // Firestore 'in' query supports max 10, chunk if necessary. Usually a section has ~6 subjects.
        if (allocationIds.length <= 10) {
          const subQ = query(collection(db, "subject_substitutes"), 
            where("allocationId", "in", allocationIds),
            where("status", "==", "Active")
          );
          const subSnap = await getDocs(subQ);
          setSubstitutes(subSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
          // If > 10, fetch all active substitutes for department and filter in memory
          const subQ = query(collection(db, "subject_substitutes"), where("department", "==", selectedDept), where("status", "==", "Active"));
          const subSnap = await getDocs(subQ);
          const allSubs = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setSubstitutes(allSubs.filter(sub => allocationIds.includes(sub.allocationId)));
        }
      } else {
        setSubstitutes([]);
      }
      
    } catch (err) { 
      console.error(err); 
      toast.error("Failed to load allocations."); 
    }
    setLoading(false);
  }

  // Filter courses based on selected semester and dept
  const availableSubjects = useMemo(() => {
    if (!selectedSemester) return [];
    return courses.filter(c => {
      // Courses might be mapped differently, try to match by semester and programme/dept
      // This logic depends heavily on how Courses are stored. 
      // We assume c.semester matches selectedSemester.
      if (c.semester !== selectedSemester) return false;
      // Depending on how programme/dept is named in courses
      // (Often 'programmeCode' contains 'CSE' or department)
      if (selectedDept && c.programmeCode && !c.programmeCode.includes(selectedDept) && c.department !== selectedDept) return false;
      return true;
    });
  }, [courses, selectedSemester, selectedDept]);

  const activeFaculties = useMemo(() => {
    return faculty.filter(f => f.status !== 'Inactive' && f.status !== 'Resigned');
  }, [faculty]);

  // Merge courses with their current allocation
  const subjectList = useMemo(() => {
    return availableSubjects.map(subject => {
      const allocation = allocations.find(a => a.subjectId === subject.id);
      let sub = null;
      if (allocation) {
        sub = substitutes.find(s => s.allocationId === allocation.id && new Date(s.fromDate) <= new Date() && new Date(s.toDate) >= new Date());
      }
      return {
        ...subject,
        allocation,
        activeSubstitute: sub
      };
    });
  }, [availableSubjects, allocations, substitutes]);

  const handleAssignClick = (subject) => {
    setActiveSubject(subject);
    setAssignForm({ facultyId: subject.allocation ? subject.allocation.facultyId : '' });
    setShowAssignModal(true);
  };

  const handleSubstituteClick = (subject) => {
    setActiveSubject(subject);
    setSubstituteForm({ substituteFacultyId: '', fromDate: '', toDate: '', reason: '' });
    setShowSubstituteModal(true);
  };

  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    if (!assignForm.facultyId) return toast.error("Please select a faculty member.");
    
    setSaving(true);
    try {
      const selectedFac = faculty.find(f => f.id === assignForm.facultyId);
      
      if (activeSubject.allocation) {
        // Reassignment
        if (activeSubject.allocation.facultyId === selectedFac.id) {
          toast.success("No changes made.");
          setShowAssignModal(false);
          setSaving(false);
          return;
        }
        
        // Deactivate old assignment
        await updateDoc(doc(db, "subject_allocations", activeSubject.allocation.id), {
          status: 'Inactive',
          endDate: new Date().toISOString(),
          updatedAt: serverTimestamp()
        });
      }
      
      // Create new assignment
      await addDoc(collection(db, "subject_allocations"), {
        department: selectedDept,
        year: selectedYear,
        semester: selectedSemester,
        section: selectedSection || "",
        batch: selectedBatch,
        subjectId: activeSubject.id,
        subjectCode: activeSubject.courseCode || '',
        subjectName: activeSubject.courseName || '',
        subjectType: activeSubject.courseType || 'Theory',
        facultyId: selectedFac.id,
        facultyName: selectedFac.name,
        facultyCode: selectedFac.employeeCode || selectedFac.staffId || selectedFac.registerNo || '',
        assignmentType: 'Permanent',
        status: 'Active',
        startDate: new Date().toISOString(),
        assignedBy: userProfile.uid,
        assignedByRole: userProfile.role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      toast.success("Subject assigned successfully.");
      setShowAssignModal(false);
      fetchAllocations();
    } catch (err) {
      console.error(err);
      toast.error("Failed to assign subject.");
    }
    setSaving(false);
  };

  const handleSaveSubstitute = async (e) => {
    e.preventDefault();
    if (!substituteForm.substituteFacultyId || !substituteForm.fromDate || !substituteForm.toDate) {
      return toast.error("Please fill all required fields.");
    }
    if (new Date(substituteForm.fromDate) > new Date(substituteForm.toDate)) {
      return toast.error("To Date must be after From Date.");
    }
    
    setSaving(true);
    try {
      const selectedFac = faculty.find(f => f.id === substituteForm.substituteFacultyId);
      
      await addDoc(collection(db, "subject_substitutes"), {
        allocationId: activeSubject.allocation.id,
        department: selectedDept,
        year: selectedYear,
        semester: selectedSemester,
        section: selectedSection || "",
        subjectId: activeSubject.id,
        permanentFacultyId: activeSubject.allocation.facultyId,
        substituteFacultyId: selectedFac.id,
        substituteFacultyName: selectedFac.name,
        fromDate: substituteForm.fromDate,
        toDate: substituteForm.toDate,
        reason: substituteForm.reason,
        status: 'Active',
        createdBy: userProfile.uid,
        createdAt: serverTimestamp()
      });
      
      toast.success("Temporary substitute assigned.");
      setShowSubstituteModal(false);
      fetchAllocations();
    } catch (err) {
      console.error(err);
      toast.error("Failed to assign substitute.");
    }
    setSaving(false);
  };

  const getFacultyWorkload = (facultyId) => {
    // A real implementation would fetch all allocations across all years/sections for this faculty
    // This requires a separate query or aggregation. 
    return "Calculated later"; 
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        
        <div className="page-header" style={{ marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, color: "var(--text)", fontSize: 24 }}>
              Subject & Faculty Allocation
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>
              Manage subject assignments and temporary faculty substitutions for your department.
            </p>
          </div>
        </div>
        
        {/* Filters */}
        <div className="card" style={{ padding: 20, marginBottom: 24, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          {isSuperAdmin && (
            <div style={{ flex: "1 1 150px" }}>
              <label style={{ display: "block", fontSize: 13, marginBottom: 6, color: "var(--text-muted)" }}>Department</label>
              <select className="form-control" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
                <option value="">Select Dept</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          
          <div style={{ flex: "1 1 120px" }}>
            <label style={{ display: "block", fontSize: 13, marginBottom: 6, color: "var(--text-muted)" }}>Year *</label>
            <select className="form-control" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
              <option value="">Select Year</option>
              {YEARS.map(y => <option key={y} value={y}>{y} Year</option>)}
            </select>
          </div>
          
          <div style={{ flex: "1 1 120px" }}>
            <label style={{ display: "block", fontSize: 13, marginBottom: 6, color: "var(--text-muted)" }}>Semester *</label>
            <select className="form-control" value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)}>
              <option value="">Select Sem</option>
              {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          
          <div style={{ flex: "1 1 120px" }}>
            <label style={{ display: "block", fontSize: 13, marginBottom: 6, color: "var(--text-muted)" }}>Section (Optional)</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. A" 
              value={selectedSection} 
              onChange={(e) => setSelectedSection(e.target.value.toUpperCase())} 
            />
          </div>
          
          <div style={{ flex: "1 1 120px" }}>
            <label style={{ display: "block", fontSize: 13, marginBottom: 6, color: "var(--text-muted)" }}>Batch (Optional)</label>
            <input type="text" className="form-control" placeholder="e.g. 2023-2027" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)} />
          </div>
        </div>

        {/* Summary Cards */}
        {selectedDept && selectedYear && selectedSemester && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginBottom: 24 }}>
            <div className="card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(37, 99, 235, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
                <BookOpen size={24} />
              </div>
              <div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Total Subjects</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{subjectList.length}</div>
              </div>
            </div>
            
            <div className="card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
                <Users size={24} />
              </div>
              <div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Assigned</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{subjectList.filter(s => s.allocation).length}</div>
              </div>
            </div>
            
            <div className="card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Pending</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{subjectList.filter(s => !s.allocation).length}</div>
              </div>
            </div>
          </div>
        )}

        {/* Main List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>Loading subjects...</div>
        ) : (!selectedDept || !selectedYear || !selectedSemester) ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: "var(--text-muted)" }}>
            Please select Department, Year, and Semester to view subjects.
          </div>
        ) : subjectList.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: "var(--text-muted)" }}>
            No subjects found for Semester {selectedSemester} in {selectedDept}. Please check Course Master.
          </div>
        ) : (
          <div className="card" style={{ padding: 20 }}>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Subject Code</th>
                    <th>Subject Name</th>
                    <th>Type</th>
                    <th>Credits</th>
                    <th>Assigned Faculty</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectList.map(subject => (
                    <tr key={subject.id}>
                      <td>{subject.courseCode}</td>
                      <td>{subject.courseName}</td>
                      <td>{subject.courseType || 'Theory'}</td>
                      <td>{subject.credits}</td>
                      <td>
                        {subject.activeSubstitute ? (
                          <div style={{ color: "#ef4444", fontWeight: 600 }}>
                            {subject.activeSubstitute.substituteFacultyName} <span style={{ fontSize: 11, fontWeight: 400 }}>(Temp)</span>
                          </div>
                        ) : subject.allocation ? (
                          <div style={{ fontWeight: 600 }}>{subject.allocation.facultyName}</div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Not Assigned</span>
                        )}
                      </td>
                      <td>
                        {subject.allocation ? (
                          <span className="badge" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}>Assigned</span>
                        ) : (
                          <span className="badge" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}>Pending</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button 
                            onClick={() => handleAssignClick(subject)}
                            className="btn btn-sm btn-primary"
                          >
                            {subject.allocation ? 'Reassign' : 'Assign'}
                          </button>
                          
                          {subject.allocation && (
                            <button 
                              onClick={() => handleSubstituteClick(subject)}
                              className="btn btn-sm btn-outline"
                              style={{ color: "#f59e0b", borderColor: "#f59e0b" }}
                            >
                              Temp Replace
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modals */}
        {showAssignModal && activeSubject && (
          <div className="modal-backdrop">
            <div className="modal-content" style={{ maxWidth: 500 }}>
              <div className="modal-header">
                <h3>{activeSubject.allocation ? 'Reassign Subject' : 'Assign Subject'}</h3>
                <button className="icon-btn" onClick={() => setShowAssignModal(false)}><X size={20}/></button>
              </div>
              <form onSubmit={handleSaveAssignment} className="modal-body">
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 14, color: "var(--text-muted)" }}>Subject</label>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{activeSubject.courseCode} - {activeSubject.courseName}</div>
                </div>
                
                {activeSubject.allocation && (
                  <div style={{ marginBottom: 16, padding: 12, background: "rgba(239, 68, 68, 0.05)", borderRadius: 8, border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                    <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 4 }}>Current Assignment</div>
                    <div style={{ fontWeight: 600 }}>{activeSubject.allocation.facultyName}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                      Reassigning will deactivate this assignment and log it in history.
                    </div>
                  </div>
                )}
                
                <div className="form-group">
                  <label>Select Faculty *</label>
                  <select 
                    className="form-control" 
                    value={assignForm.facultyId} 
                    onChange={e => setAssignForm({ ...assignForm, facultyId: e.target.value })}
                    required
                  >
                    <option value="">-- Select Faculty --</option>
                    {activeFaculties.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.dept}) - {f.designation}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={() => setShowAssignModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Confirm Assignment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showSubstituteModal && activeSubject && (
          <div className="modal-backdrop">
            <div className="modal-content" style={{ maxWidth: 500 }}>
              <div className="modal-header">
                <h3>Temporary Substitute</h3>
                <button className="icon-btn" onClick={() => setShowSubstituteModal(false)}><X size={20}/></button>
              </div>
              <form onSubmit={handleSaveSubstitute} className="modal-body">
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 14, color: "var(--text-muted)" }}>Subject</label>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{activeSubject.courseCode} - {activeSubject.courseName}</div>
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 14, color: "var(--text-muted)" }}>Permanent Faculty</label>
                  <div style={{ fontWeight: 600 }}>{activeSubject.allocation?.facultyName}</div>
                </div>
                
                <div className="form-group">
                  <label>Substitute Faculty *</label>
                  <select 
                    className="form-control" 
                    value={substituteForm.substituteFacultyId} 
                    onChange={e => setSubstituteForm({ ...substituteForm, substituteFacultyId: e.target.value })}
                    required
                  >
                    <option value="">-- Select Substitute --</option>
                    {activeFaculties.filter(f => f.id !== activeSubject.allocation?.facultyId).map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.dept}) - {f.designation}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>From Date *</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={substituteForm.fromDate} 
                      onChange={e => setSubstituteForm({ ...substituteForm, fromDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>To Date *</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={substituteForm.toDate} 
                      onChange={e => setSubstituteForm({ ...substituteForm, toDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Reason for Replacement</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. Faculty on leave" 
                    value={substituteForm.reason} 
                    onChange={e => setSubstituteForm({ ...substituteForm, reason: e.target.value })}
                  />
                </div>
                
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={() => setShowSubstituteModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Substitute'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
