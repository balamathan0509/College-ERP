const fs = require('fs');
const admin = require('firebase-admin');

const configPath = './serviceAccountKey.json';

async function verify() {
  let fileExists = false;
  let isValidJson = false;
  let hasRequiredFields = false;
  let projectIdMatch = false;
  let privateKeyValid = false;
  let adminAuthSuccess = false;
  let firestoreSuccess = false;

  try {
    if (fs.existsSync(configPath)) {
      fileExists = true;
      const content = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(content);
      isValidJson = true;

      const required = ['project_id', 'private_key', 'client_email'];
      hasRequiredFields = required.every(key => parsed[key]);
      
      projectIdMatch = parsed.project_id === 'college-portal-c5f16';
      
      if (parsed.private_key && parsed.private_key.includes('BEGIN PRIVATE KEY')) {
         privateKeyValid = true;
      }
      
      if (isValidJson && hasRequiredFields && projectIdMatch && privateKeyValid) {
        try {
          admin.initializeApp({
            credential: admin.credential.cert(parsed),
            projectId: parsed.project_id
          });
          adminAuthSuccess = true;
          
          const db = admin.firestore();
          // To test connectivity, try to get a single document (or just limit 1 query)
          const snap = await db.collection('courses').limit(1).get();
          // If we reach here, it means authentication and access succeeded.
          firestoreSuccess = true;
        } catch (authErr) {
          console.error("Auth/Firestore Error:", authErr.message);
        }
      }
    }
  } catch (err) {
    console.error("General Error:", err.message);
  }

  const credentialFileStatus = (fileExists && isValidJson && hasRequiredFields && privateKeyValid) ? "VALID" : "INVALID";
  const projectIdStatus = projectIdMatch ? "MATCH" : "MISMATCH";
  const adminAuthStatus = adminAuthSuccess ? "SUCCESS" : "FAILED";
  const firestoreStatus = firestoreSuccess ? "SUCCESS" : "FAILED";

  console.log(`Credential file: ${credentialFileStatus}`);
  console.log(`Project ID: ${projectIdStatus}`);
  console.log(`Firebase Admin Auth: ${adminAuthStatus}`);
  console.log(`Firestore Access: ${firestoreStatus}`);
  console.log(`Gitignore: NOT OK`);
  console.log(`Migration: NOT RUN`);
  console.log(`Database Writes: 0`);
}

verify().catch(err => {
    console.error("Execution failed", err);
});
