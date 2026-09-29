const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

async function updateHOD() {
  const usersRef = db.collection('users');
  const q1 = await usersRef.where('staffId', '==', '9525308').get();
  const q2 = await usersRef.where('employeeCode', '==', '9525308').get();
  const q3 = await usersRef.where('registerNo', '==', '9525308').get();
  
  let docs = [];
  if (!q1.empty) docs = docs.concat(q1.docs);
  if (!q2.empty) docs = docs.concat(q2.docs);
  if (!q3.empty) docs = docs.concat(q3.docs);
  
  if (docs.length === 0) {
    console.log('No user found with 9525308');
    process.exit(1);
  }
  
  const docRef = docs[0];
  console.log('Found user:', docRef.data().name);
  console.log('Current role:', docRef.data().role);
  await docRef.ref.update({ role: 'hod' });
  console.log('Role updated to hod');
  process.exit(0);
}

updateHOD().catch(console.error);
