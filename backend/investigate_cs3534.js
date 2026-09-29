const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

async function run() {
  console.log("=== Investigating CS3534 Mapping ===\n");

  // 1. Check metadata of the two question papers
  const qpIds = ['Ee3gFOGp1VnmJ9SHYzoa', 'JJuAUzu1a2jyj9Z7yCJv'];
  console.log("--- Metadata of Legacy Question Papers ---");
  for (const id of qpIds) {
    const doc = await db.collection('cia_question_papers').doc(id).get();
    if (doc.exists) {
      const data = doc.data();
      const relevant = {
        id: doc.id,
        courseCode: data.courseCode,
        subject: data.subject,
        courseId: data.courseId,
        allocationId: data.allocationId,
        scheduleId: data.scheduleId,
        createdBy: data.createdBy,
        department: data.department,
        examId: data.examId
      };
      console.log(JSON.stringify(relevant, null, 2));
    } else {
      console.log(`Document ${id} not found.`);
    }
  }

  // 2. Search courses collection
  console.log("\n--- Searching courses collection ---");
  const coursesSnap = await db.collection('courses').get();
  let courseMatches = [];
  coursesSnap.forEach(doc => {
    const data = doc.data();
    if (data.courseCode && data.courseCode.toLowerCase() === 'cs3534') {
      courseMatches.push({ id: doc.id, ...data });
    }
  });
  console.log(`Matches in 'courses' collection: ${courseMatches.length}`);
  courseMatches.forEach(c => console.log(c.id, c.courseCode, c.department));

  // 3. Search other collections for courseCode = 'cs3534' or 'CS3534'
  console.log("\n--- Searching other collections ---");
  const collectionsToCheck = ['course_allocations', 'subject_allocations', 'cia_question_bank', 'cia_exam_schedules'];
  for (const col of collectionsToCheck) {
    const snap = await db.collection(col).get();
    let matches = [];
    snap.forEach(doc => {
      const data = doc.data();
      // Check common fields where it might be stored
      if (
        (data.courseCode && data.courseCode.toLowerCase() === 'cs3534') ||
        (data.courseId && data.courseId.toLowerCase() === 'cs3534') ||
        (data.subjectCode && data.subjectCode.toLowerCase() === 'cs3534') ||
        (data.subject && data.subject.toLowerCase() === 'cs3534')
      ) {
        matches.push({ id: doc.id, data });
      }
    });
    if (matches.length > 0) {
      console.log(`Found ${matches.length} matches in '${col}':`);
      matches.forEach(m => {
        const fields = {};
        if (m.data.courseCode) fields.courseCode = m.data.courseCode;
        if (m.data.courseId) fields.courseId = m.data.courseId;
        if (m.data.department) fields.department = m.data.department;
        if (m.data.dept) fields.dept = m.data.dept;
        console.log(` - DocID: ${m.id}, fields:`, fields);
      });
    }
  }
}

run().catch(console.error);
