const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCDpkc5yjqZCX-F-7GSuJboe8bqILXfadA",
  authDomain: "college-portal-c5f16.firebaseapp.com",
  projectId: "college-portal-c5f16",
  storageBucket: "college-portal-c5f16.firebasestorage.app",
  messagingSenderId: "931698998453",
  appId: "1:931698998453:web:b9f60a89b4b82df16892fc",
  measurementId: "G-QHJZ54XPHG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
      // Create user
      const userCredential = await createUserWithEmailAndPassword(auth, staff.email, '123456');
      const user = userCredential.user;
      console.log(`Successfully created user: ${staff.email}`);

      // Add to Firestore
      const userDoc = {
        uid: user.uid,
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

      await setDoc(doc(db, 'users', user.uid), userDoc, { merge: true });
      console.log(`Added Firestore record for: ${staff.email}`);

    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        console.log(`User already exists: ${staff.email}`);
        // Optionally update firestore document even if user exists
      } else {
        console.error(`Error processing ${staff.email}:`, error.message);
      }
    }
  }
  console.log('Finished processing all staff.');
  process.exit(0);
}

addStaff();
