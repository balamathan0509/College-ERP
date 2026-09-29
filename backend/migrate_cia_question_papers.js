const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const isVerify = args.includes('--verify');
const allowUnresolved = args.includes('--allow-unresolved');
const isDryRun = !isApply && !isVerify;

const VALID_DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIDS", "AIML", "MBA", "MCA"];

async function run() {
  console.log("Starting legacy cia_question_papers migration script...");
  if (isVerify) {
    console.log("Mode: --verify");
  } else if (isApply) {
    console.log("Mode: --apply");
    if (allowUnresolved) console.log("Warning: --allow-unresolved flag is active.");
  } else {
    console.log("Mode: --dry-run (default)");
  }

  const papersSnap = await db.collection('cia_question_papers').get();
  
  if (isVerify) {
    let total = 0;
    let withDept = 0;
    let missingDept = 0;
    let invalidDept = 0;
    
    papersSnap.forEach(doc => {
      const data = doc.data();
      total++;
      if (data.department && typeof data.department === 'string' && data.department.trim() !== '') {
        withDept++;
        if (!VALID_DEPARTMENTS.includes(data.department)) {
          invalidDept++;
        }
      } else {
        missingDept++;
      }
    });
    
    console.log(`\n--- VERIFICATION REPORT ---`);
    console.log(`Total cia_question_papers: ${total}`);
    console.log(`Documents with department: ${withDept}`);
    console.log(`Documents missing department: ${missingDept}`);
    console.log(`Invalid/unknown departments: ${invalidDept}`);
    console.log(`Unresolved legacy documents (missing dept): ${missingDept}`);
    return;
  }

  // Pre-fetch courses to match by courseCode
  const coursesSnap = await db.collection('courses').get();
  const courseMap = {}; // courseCode -> array of courses
  
  coursesSnap.forEach(c => {
    const data = c.data();
    if (data.courseCode) {
      if (!courseMap[data.courseCode]) {
        courseMap[data.courseCode] = [];
      }
      courseMap[data.courseCode].push({ id: c.id, ...data });
    }
  });

  let totalPapers = 0;
  let alreadyHasDept = 0;
  let missingCourseCodeCount = 0;
  let missingCourseDeptCount = 0;
  
  let candidates = [];
  let unresolved = [];
  let ambiguous = [];

  papersSnap.forEach(doc => {
    totalPapers++;
    const data = doc.data();
    
    // Valid department exists
    if (data.department && typeof data.department === 'string' && data.department.trim() !== '') {
      alreadyHasDept++;
      return;
    }

    const courseCode = data.courseCode;
    if (!courseCode) {
      missingCourseCodeCount++;
      unresolved.push({ id: doc.id, courseCode: 'MISSING', reason: 'Missing courseCode field in question paper' });
      return;
    }

    const matchedCourses = courseMap[courseCode];
    if (!matchedCourses || matchedCourses.length === 0) {
      unresolved.push({ id: doc.id, courseCode, reason: 'Zero matching courses found' });
      return;
    }

    if (matchedCourses.length > 1) {
      ambiguous.push({ id: doc.id, courseCode, matchingCourseIds: matchedCourses.map(c => c.id) });
      return;
    }

    const matchedCourse = matchedCourses[0];
    if (!matchedCourse.department || matchedCourse.department.trim() === '') {
      missingCourseDeptCount++;
      unresolved.push({ id: doc.id, courseCode, reason: 'Matched course has no department' });
      return;
    }

    candidates.push({
      id: doc.id,
      courseCode,
      oldDepartment: data.department || 'N/A',
      newDepartment: matchedCourse.department,
      matchedCourseId: matchedCourse.id
    });
  });

  console.log(`\n--- MIGRATION SUMMARY ---`);
  console.log(`Total cia_question_papers: ${totalPapers}`);
  console.log(`Already have department: ${alreadyHasDept}`);
  console.log(`Migration candidates: ${candidates.length + unresolved.length + ambiguous.length}`);
  console.log(`Safe matches: ${candidates.length}`);
  console.log(`Unresolved: ${unresolved.length}`);
  console.log(`Ambiguous: ${ambiguous.length}`);
  console.log(`Missing courseCode: ${missingCourseCodeCount}`);
  console.log(`Missing course department: ${missingCourseDeptCount}`);
  
  console.log(`\n--- PROPOSED UPDATES (Safe Matches) ---`);
  candidates.forEach(c => {
    console.log(`PaperID: ${c.id} | Code: ${c.courseCode} | OldDept: ${c.oldDepartment} | NewDept: ${c.newDepartment} | CourseID: ${c.matchedCourseId}`);
  });
  
  console.log(`\n--- UNRESOLVED — SKIPPED ---`);
  unresolved.forEach(u => {
    console.log(`${u.id}`);
    console.log(`Code: ${u.courseCode} | Reason: ${u.reason}`);
  });

  console.log(`\n--- AMBIGUOUS ---`);
  ambiguous.forEach(a => {
    console.log(`PaperID: ${a.id} | Code: ${a.courseCode} | Matched Course IDs: ${a.matchingCourseIds.join(', ')}`);
  });

  if (isApply) {
    if (unresolved.length > 0 || ambiguous.length > 0) {
      console.log(`\n[INFO] Skipping ${unresolved.length} unresolved and ${ambiguous.length} ambiguous documents. Safe matches will be migrated.`);
    }

    if (candidates.length === 0) {
      console.log(`\nNo safe matches to migrate. Exiting.`);
      process.exit(0);
    }

    console.log(`\nApplying updates to ${candidates.length} documents in batches...`);
    
    // Batch writes (max 500 ops per batch)
    const batches = [];
    let currentBatch = db.batch();
    let opCount = 0;
    
    candidates.forEach(c => {
      const docRef = db.collection('cia_question_papers').doc(c.id);
      currentBatch.update(docRef, { department: c.newDepartment });
      opCount++;
      
      if (opCount === 500) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        opCount = 0;
      }
    });
    
    if (opCount > 0) {
      batches.push(currentBatch);
    }
    
    for (let i = 0; i < batches.length; i++) {
      await batches[i].commit();
      console.log(`Batch ${i + 1}/${batches.length} committed.`);
    }
    
    console.log(`Migration completed successfully!`);
  } else {
    console.log(`\n[DRY RUN COMPLETED] No changes were applied. Use --apply to execute the migration.`);
  }
}

run().catch(console.error);
