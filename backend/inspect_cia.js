const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const collections = [
  'questionFormatConfigs',
  'ciaTypesConfig',
  'evaluationPatterns',
  'patternMappingConfigs'
];

async function inspect() {
  for (const coll of collections) {
    const snap = await db.collection(coll).get();
    let total = snap.size;
    let withoutDept = 0;
    let withDept = 0;
    let depts = new Set();
    
    snap.forEach(doc => {
      const data = doc.data();
      if (!data.department || data.department.trim() === '') {
        withoutDept++;
      } else {
        withDept++;
        depts.add(data.department);
      }
    });
    
    console.log(`\nCollection: ${coll}`);
    console.log(`Total Records: ${total}`);
    console.log(`Without Department: ${withoutDept}`);
    console.log(`With Department: ${withDept} (Depts: ${Array.from(depts).join(', ')})`);
  }
}

inspect().catch(console.error);
