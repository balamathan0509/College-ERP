const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const messaging = admin.messaging();
const db = admin.firestore();

// Endpoint to send FCM notification
app.post('/send-notification', async (req, res) => {
  const { tokens, title, body, data = {} } = req.body;

  if (!tokens || tokens.length === 0) {
    return res.status(400).json({ error: 'No tokens provided' });
  }

  const message = {
    notification: { title, body },
    data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
    tokens: Array.isArray(tokens) ? tokens : [tokens]
  };

  try {
    const response = await messaging.sendMulticast(message);
    console.log('Successfully sent message:', response);
    res.json({ success: true, response });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to create HOD users
app.post('/create-hod-users', async (req, res) => {
  const { users } = req.body;
  
  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ error: 'Invalid users array' });
  }

  const results = [];
  
  for (const user of users) {
    try {
      // Create Firebase Auth user
      const userRecord = await admin.auth().createUser({
        email: user.email,
        password: user.password,
        displayName: user.name || user.email
      });

      // Get the department name from email (e.g., csehod -> CSE)
      const deptCode = user.email.split('hod@')[0].toUpperCase();
      const deptMap = {
        'CSE': 'CSE',
        'ECE': 'ECE', 
        'EEE': 'EEE',
        'MECH': 'MECH',
        'CIVIL': 'CIVIL',
        'IT': 'IT',
        'AIDS': 'AIDS',
        'AIML': 'AIML'
      };
      
      const dept = deptMap[deptCode] || deptCode;

      // Store user profile in Firestore
      await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        name: user.name || user.email.split('@')[0],
        email: user.email,
        role: 'hod',
        dept: dept,
        phone: user.phone || '',
        emailVerified: true,
        createdAt: new Date().toISOString()
      });

      results.push({
        email: user.email,
        status: 'success',
        uid: userRecord.uid,
        dept: dept
      });
    } catch (error) {
      results.push({
        email: user.email,
        status: 'error',
        error: error.message
      });
    }
  }

  res.json({
    message: 'HOD users creation completed',
    results: results
  });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});