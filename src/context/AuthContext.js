// src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../supabase/supabaseAdapter";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "../supabase/supabaseAdapter";
import { doc, setDoc, getDoc, updateDoc } from "../supabase/supabaseAdapter";

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
        let data = docSnap.data();
        
        // HOD Role Normalization: 
        // If designation is HOD or the role itself ends with HOD (e.g. CSEHOD), normalize role to "hod"
        const isHodDesignation = data.designation && data.designation.toLowerCase().includes("hod");
        const isHodRoleVariant = data.role && data.role.toLowerCase().endsWith("hod");
        
        if (data.role !== "hod" && (isHodDesignation || isHodRoleVariant)) {
          data.role = "hod";
          try {
            await updateDoc(docRef, { role: "hod" });
          } catch (updateErr) {
            console.error("Failed to permanently normalize HOD role in DB:", updateErr);
          }
        }
        
        setUserProfile(data);
      } else {
        // Doc doesn't exist in users table yet — auto-create profile
        const user = currentUser || auth.currentUser;
        const email = user?.email || "";
        const isSuper = email === SUPER_ADMIN_EMAIL;
        const newProfile = {
          uid: uid,
          id: uid,
          email: email,
          name: email.split("@")[0] || "User",
          role: isSuper ? "admin" : "student",
          isSuperAdmin: isSuper,
          createdAt: new Date().toISOString()
        };
        try {
          await setDoc(docRef, newProfile);
        } catch (e) {
          console.error("Failed to auto-create missing user profile:", e);
        }
        setUserProfile(newProfile);
      }
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
      const user = currentUser || auth.currentUser;
      if (user) {
        setUserProfile({
          uid: user.uid,
          email: user.email,
          name: user.email?.split("@")[0] || user.email,
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
