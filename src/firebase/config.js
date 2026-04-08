import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
