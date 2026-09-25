import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { db } from '../../firebase/config';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MySubjects() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    if (userProfile?.uid) {
      fetchMySubjects();
    }
  }, [userProfile]);

  async function fetchMySubjects() {
    setLoading(true);
    try {
      const today = new Date();
      // Reset time for date comparison
      today.setHours(0, 0, 0, 0);

      // 1. Fetch permanent assignments for this user
      const permQ = query(
        collection(db, "subject_allocations"), 
        where("facultyId", "==", userProfile.uid),
        where("status", "==", "Active")
      );
      const permSnap = await getDocs(permQ);
      let permanentSubjects = permSnap.docs.map(d => ({ id: d.id, ...d.data(), isSubstitute: false }));

      // 2. Fetch substitutes WHERE this user is the substitute
      const subQ = query(
        collection(db, "subject_substitutes"),
        where("substituteFacultyId", "==", userProfile.uid),
        where("status", "==", "Active")
      );
      const subSnap = await getDocs(subQ);
      const substituteAssignments = subSnap.docs.map(d => ({ id: d.id, ...d.data(), isSubstitute: true }));

      // 3. Filter substitutes to only those active today
      const activeSubstituteAssignments = substituteAssignments.filter(sub => {
        const from = new Date(sub.fromDate);
        from.setHours(0, 0, 0, 0);
        const to = new Date(sub.toDate);
        to.setHours(23, 59, 59, 999);
        return today >= from && today <= to;
      });

      // 4. For permanent subjects, check if someone else is substituting today
      // First, fetch substitutes for the permanent subjects
      const activePermanentIds = permanentSubjects.map(s => s.id);
      let otherSubs = [];
      if (activePermanentIds.length > 0) {
        // Chunk if > 10, assuming <= 10 for now
        if (activePermanentIds.length <= 10) {
          const otherSubQ = query(
            collection(db, "subject_substitutes"),
            where("allocationId", "in", activePermanentIds),
            where("status", "==", "Active")
          );
          const otherSubSnap = await getDocs(otherSubQ);
          otherSubs = otherSubSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      }

      const effectiveSubjects = [];

      // Add permanent subjects if they don't have an active substitute today
      for (const perm of permanentSubjects) {
        const hasActiveSub = otherSubs.find(sub => {
          if (sub.allocationId !== perm.id) return false;
          const from = new Date(sub.fromDate);
          from.setHours(0, 0, 0, 0);
          const to = new Date(sub.toDate);
          to.setHours(23, 59, 59, 999);
          return today >= from && today <= to;
        });

        if (!hasActiveSub) {
          effectiveSubjects.push(perm);
        }
      }

      // 5. Build full subject details for substitute assignments
      // We have the allocationId in the sub doc, we need the subject details (year, section, subjectName)
      for (const sub of activeSubstituteAssignments) {
        // Fetch the allocation doc to get subject details
        // Note: In real app, we might store subjectName, year, section directly in substitute doc to avoid this fetch
        // (which we actually did in the SubjectAllocation.js: department, year, semester, section, subjectId)
        // Wait, I did save year, semester, section in subject_substitutes!
        
        // Let's fetch the actual subject details from courses if needed, but we have enough to display
        effectiveSubjects.push({
          id: sub.allocationId, // Use allocationId as the primary key for the card
          department: sub.department,
          year: sub.year,
          semester: sub.semester,
          section: sub.section,
          subjectId: sub.subjectId,
          subjectCode: "Substitute", 
          subjectName: "Temporary Assignment", // Fallback if we didn't store it
          isSubstitute: true,
          fromDate: sub.fromDate,
          toDate: sub.toDate
        });
      }

      // Re-fetch course names if they are missing
      const subjectIdsToFetch = effectiveSubjects.filter(s => !s.subjectName || s.isSubstitute).map(s => s.subjectId);
      if (subjectIdsToFetch.length > 0) {
        const courseSnap = await getDocs(collection(db, "courses"));
        const allCourses = courseSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        effectiveSubjects.forEach(s => {
          if (s.isSubstitute || !s.subjectName) {
            const c = allCourses.find(course => course.id === s.subjectId);
            if (c) {
              s.subjectCode = c.courseCode;
              s.subjectName = c.courseName;
            }
          }
        });
      }

      setSubjects(effectiveSubjects);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load your subjects.");
    }
    setLoading(false);
  }

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header" style={{ marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, color: "var(--text)", fontSize: 24 }}>
              My Subjects
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>
              Subjects currently assigned to you for teaching.
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>Loading your subjects...</div>
        ) : subjects.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: "var(--text-muted)" }}>
            <BookOpen size={48} style={{ opacity: 0.2, margin: "0 auto 16px" }} />
            No subjects are currently assigned to you.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {subjects.map(subject => (
              <div key={subject.id} className="card" style={{ padding: 20, position: 'relative', overflow: 'hidden' }}>
                {subject.isSubstitute && (
                  <div style={{ position: 'absolute', top: 0, right: 0, background: '#f59e0b', color: 'white', padding: '4px 12px', fontSize: 11, fontWeight: 700, borderBottomLeftRadius: 8 }}>
                    TEMP SUBSTITUTE
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--highlight)", marginBottom: 4 }}>
                      {subject.department} • {subject.year} Year • Sem {subject.semester} • Sec {subject.section}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{subject.subjectName}</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{subject.subjectCode}</div>
                  </div>
                </div>
                
                {subject.isSubstitute && (
                  <div style={{ padding: 12, background: "rgba(245, 158, 11, 0.1)", borderRadius: 8, fontSize: 12, color: "#d97706", marginTop: 16 }}>
                    Valid from: {new Date(subject.fromDate).toLocaleDateString()} to {new Date(subject.toDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
