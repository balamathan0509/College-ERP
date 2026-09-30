// src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../supabase/supabaseAdapter";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "../supabase/supabaseAdapter";
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs } from "../supabase/supabaseAdapter";

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
      id: result.user.uid,
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
      let docSnap = await getDoc(docRef);
      let data = null;

      if (docSnap.exists()) {
        data = docSnap.data();
      } else {
        // Fallback: If profile isn't found by UID, search by user's email
        const user = currentUser || auth.currentUser;
        const email = user?.email || "";
        if (email) {
          try {
            const q = query(collection(db, "users"), where("email", "==", email));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const existingDoc = snap.docs[0];
              data = { ...existingDoc.data(), uid: uid, id: uid };
              // Link this profile to the current Auth UID in Supabase table
              await setDoc(docRef, data);
            }
          } catch (emailLookupErr) {
            console.warn("Failed email lookup fallback for user profile:", emailLookupErr);
          }
        }
      }

      if (data) {
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

        // Ensure super admin flag is preserved
        const user = currentUser || auth.currentUser;
        if (user?.email === SUPER_ADMIN_EMAIL) {
          data.isSuperAdmin = true;
          data.role = "admin";
        }

        setUserProfile(data);
      } else {
        // Doc doesn't exist in users table at all — auto-create profile
        const user = currentUser || auth.currentUser;
        const email = user?.email || "";
        const isSuper = email === SUPER_ADMIN_EMAIL;

        // Try to infer role if email contains hints
        let inferredRole = isSuper ? "admin" : "student";
        if (!isSuper && email) {
          const lowerEmail = email.toLowerCase();
          if (lowerEmail.includes("hod")) inferredRole = "hod";
          else if (lowerEmail.includes("staff")) inferredRole = "staff";
          else if (lowerEmail.includes("office") || lowerEmail.includes("fees")) inferredRole = "officestaff";
          else if (lowerEmail.includes("principal")) inferredRole = "principal";
          else if (lowerEmail.includes("warden")) inferredRole = "warden";
        }

        const newProfile = {
          uid: uid,
          id: uid,
          email: email,
          name: email.split("@")[0] || "User",
          role: inferredRole,
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
        try {
          await fetchUserProfile(user.uid);
        } catch (err) {
          console.error("Auth state user profile fetch error:", err);
          setUserProfile({
            uid: user.uid,
            email: user.email,
            name: user.email?.split("@")[0] || user.email,
            role: user.email === SUPER_ADMIN_EMAIL ? "admin" : "student",
            isSuperAdmin: user.email === SUPER_ADMIN_EMAIL
          });
        }
      } else {
        setUserProfile(null);
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
      {loading ? (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          width: "100vw",
          background: "#f8fafc"
        }}>
          <div style={{ width: 44, height: 44, border: "4px solid #e2e8f0", borderTop: "4px solid #2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}></div>
          <p style={{ marginTop: 16, color: "#64748b", fontWeight: 600, fontSize: 14, fontFamily: "system-ui, -apple-system, sans-serif" }}>Loading RVCE College ERP Portal...</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}
