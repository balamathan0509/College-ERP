const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

const staffList = [
  { name: 'Ramya G', email: 'ramyakrishnan201@gmail.com', phone: '9344415906', dept: 'CSE', designation: 'Associate Professor', role: 'staff' },
  { name: 'V.VASANTH', email: 'vasanthvairam124@gmail.com', phone: '9360369689', dept: 'CSE', designation: 'Assistant Professor', role: 'staff' },
  { name: 'Sivasakthivel S', email: 'smartsakthi5599@gmail.com', phone: '9150620839', dept: 'CSE', designation: 'Assistant Professor', role: 'staff' },
  { name: 'Muthu Sanmathi C', email: 'sanmathic@rvce.ac.in', phone: '9894562887', dept: 'CSE', designation: 'Assistant Professor', role: 'staff' },
  { name: 'Karpaga Valli M', email: 'karpagavallicse@rvce.ac.in', phone: '8220681399', dept: 'CSE', designation: 'Assistant Professor', role: 'staff', staffId: '9525345' },
  { name: 'L.Kanimozhi', email: 'kanimozhik910@gmail.com', phone: '6374923370', dept: 'CSE', designation: 'Assistant Professor', role: 'staff' },
  { name: 'Deepika Eswari V', email: 'deepikav@rvce.ac.in', phone: '6369959639', dept: 'CSE', designation: 'Assistant Professor', role: 'staff', staffId: '9525369' },
  { name: 'Maragatham R', email: 'maragathamr@rvce.ac.in', phone: '9344364596', dept: 'CSE', designation: 'Assistant Professor', role: 'staff' }
];

async function addStaff() {
  for (const staff of staffList) {
    try {
      // Check if user already exists
      let userRecord;
      try {
        userRecord = await admin.auth().getUserByEmail(staff.email);
        console.log(`User already exists in Auth: ${staff.email}`);
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          userRecord = await admin.auth().createUser({
            email: staff.email,
            password: '123456',
            displayName: staff.name
          });
          console.log(`Created user in Auth: ${staff.email}`);
        } else {
          throw err;
        }
      }

      // Add/Update to Firestore
      const userDoc = {
        uid: userRecord.uid,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        dept: staff.dept,
        role: staff.role,
        designation: staff.designation,
        emailVerified: true,
        createdAt: new Date().toISOString()
      };
      
      if (staff.staffId) {
        userDoc.staffId = staff.staffId;
      }

      await db.collection('users').doc(userRecord.uid).set(userDoc, { merge: true });
      console.log(`Added/Updated Firestore for: ${staff.email}`);
      
    } catch (error) {
      console.error(`Error processing ${staff.email}:`, error.message);
    }
  }
  console.log('Finished processing all staff.');
  process.exit(0);
}

addStaff();
