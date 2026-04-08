<<<<<<< HEAD
# College-ERP
=======
# 🎓 College Portal

Full-featured college management system built with React + Firebase.

## Features
- Role-based auth: Student / Staff / HOD
- Smart Gate Pass System
- Attendance Management
- Fees Management + Excel Export
- Timetable (Regular + Exam)
- Placement & Job Alerts
- General Alerts & Circulars
- Complaint System
- AI Analysis with Gemini (HOD only)

## Setup Instructions

### Step 1: Install dependencies
```bash
npm install
```

### Step 2: Firebase Config
Open `src/firebase/config.js` and replace the placeholder values with your Firebase project config:
```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",         // <- replace
  authDomain: "YOUR_AUTH_DOMAIN", // <- replace
  projectId: "YOUR_PROJECT_ID",   // <- replace
  ...
};
```

### Step 3: Firebase Console Setup
1. Go to https://console.firebase.google.com
2. Create a new project
3. Enable **Authentication** → Email/Password
4. Enable **Firestore Database** → Start in test mode
5. Copy your config and paste in Step 2

### Step 4: Run the app
```bash
npm start
```

## Firestore Collections
- `users` - All user profiles with role info
- `gate_pass` - Gate pass requests and status
- `attendance` - Daily attendance records
- `fees` - Fee payment records
- `timetable` - Class and exam timetables
- `placements` - Job/placement alerts
- `alerts` - General circulars and alerts
- `complaints` - Student complaints

## Deployment
This project uses React for the frontend and a Node/Express backend for FCM notifications.

1. Deploy the backend separately using a Node host (Railway, Render, Heroku, Vercel Serverless, etc.).
2. Set `REACT_APP_API_BASE_URL` in the frontend environment to your backend URL.
3. Build the React app with `npm run build` and host it on Vercel, Netlify, Firebase Hosting, or any static host.

Example frontend env file:

```env
REACT_APP_API_BASE_URL=https://your-backend.example.com
```

## Tech Stack
- React 18
- Firebase (Auth + Firestore)
- React Router v6
- XLSX (Excel export)
- Lucide React (Icons)
- Google Fonts (Syne + DM Sans)
>>>>>>> 1c04f38 (base files)
