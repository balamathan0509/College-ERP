// src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase/config";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function signup(email, password, profileData) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", result.user.uid), {
      uid: result.user.uid,
      email,
      ...profileData,
      createdAt: new Date().toISOString()
    });
    return result;
  }

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    setUserProfile(null);
    return signOut(auth);
  }

  async function fetchUserProfile(uid) {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
      }
    } catch (err) {
      console.error("Failed to fetch user profile (Firestore rules issue?):", err);
      // Fallback: build a minimal profile from auth so the app doesn't crash
      const user = auth.currentUser;
      if (user) {
        const SUPER_ADMIN_EMAIL = "balamathan0509@gmail.com";
        setUserProfile({
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.email,
          role: user.email === SUPER_ADMIN_EMAIL ? "admin" : "student",
          isSuperAdmin: user.email === SUPER_ADMIN_EMAIL
        });
      }
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserProfile(user.uid);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function refreshProfile() {
    if (!currentUser) return;
    await fetchUserProfile(currentUser.uid);
  }

  const SUPER_ADMIN_EMAIL = "balamathan0509@gmail.com";
  const isSuperAdmin = userProfile?.isSuperAdmin === true || currentUser?.email === SUPER_ADMIN_EMAIL;

  const value = { currentUser, userProfile, signup, login, logout, refreshProfile, isSuperAdmin };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
