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
    if (currentUser?.uid) {
      sessionStorage.removeItem("erp_user_profile_" + currentUser.uid);
    }
    setUserProfile(null);
    return signOut(auth);
  }

  async function fetchUserProfile(uid) {
    // Check local session cache first for instant reliable role persistence
    const cacheKey = "erp_user_profile_" + uid;
    const cachedStr = sessionStorage.getItem(cacheKey);
    let cachedData = null;
    if (cachedStr) {
      try {
        cachedData = JSON.parse(cachedStr);
        if (cachedData && cachedData.role) {
          setUserProfile(cachedData);
        }
      } catch (_) {}
    }

    try {
      const docRef = doc(db, "users", uid);
      let docSnap = await getDoc(docRef);
      let data = null;

      if (docSnap.exists()) {
        data = docSnap.data();
      } else {
        // Fallback: If profile isn't found by UID, search by user's email
        const user = currentUser || auth.currentUser;
        const email = (user?.email || "").trim().toLowerCase();
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

        sessionStorage.setItem(cacheKey, JSON.stringify(data));
        setUserProfile(data);
      } else if (cachedData && cachedData.role) {
        // Retain cached role if fetch didn't return doc
        setUserProfile(cachedData);
      } else {
        // Doc doesn't exist in users table at all — do not silently overwrite as student
        const user = currentUser || auth.currentUser;
        const email = (user?.email || "").trim().toLowerCase();
        const isSuper = email === SUPER_ADMIN_EMAIL;

        // Try to infer role if email contains hints
        let inferredRole = isSuper ? "admin" : (user?.user_metadata?.role || "student");
        if (!isSuper && email) {
          if (email.includes("hod")) inferredRole = "hod";
          else if (email.includes("staff")) inferredRole = "staff";
          else if (email.includes("office") || email.includes("fees")) inferredRole = "officestaff";
          else if (email.includes("principal")) inferredRole = "principal";
          else if (email.includes("warden")) inferredRole = "warden";
          else if (email.includes("examcell") || email.includes("exmacell")) inferredRole = "exam_cell";
        }

        const newProfile = {
          uid: uid,
          id: uid,
          email: email,
          name: user?.user_metadata?.name || email.split("@")[0] || "User",
          role: inferredRole,
          isSuperAdmin: isSuper,
          createdAt: new Date().toISOString()
        };
        sessionStorage.setItem(cacheKey, JSON.stringify(newProfile));
        setUserProfile(newProfile);
      }
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
      if (cachedData && cachedData.role) {
        setUserProfile(cachedData);
      } else {
        const user = currentUser || auth.currentUser;
        if (user) {
          const fallbackRole = user.email === SUPER_ADMIN_EMAIL ? "admin" : (user.user_metadata?.role || "staff");
          setUserProfile({
            uid: user.uid,
            email: user.email,
            name: user.user_metadata?.name || user.email?.split("@")[0] || user.email,
            role: fallbackRole,
            isSuperAdmin: user.email === SUPER_ADMIN_EMAIL
          });
        }
      }
    }
  }

  useEffect(() => {
    // Hard timeout fallback: force loading=false after 1.5s if auth never fires
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 1500);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(timeout);
      setCurrentUser(user);
      if (user) {
        try {
          await fetchUserProfile(user.uid);
        } catch (err) {
          console.error("Auth state user profile fetch error:", err);
          const cacheKey = "erp_user_profile_" + user.uid;
          const cachedStr = sessionStorage.getItem(cacheKey);
          if (cachedStr) {
            try {
              const cachedData = JSON.parse(cachedStr);
              if (cachedData && cachedData.role) {
                setUserProfile(cachedData);
                setLoading(false);
                return;
              }
            } catch (_) {}
          }
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  async function refreshProfile() {
    if (!currentUser) return;
    await fetchUserProfile(currentUser.uid);
  }

  const SUPER_ADMIN_EMAIL = "balamathan0509@gmail.com";
  const isSuperAdmin = userProfile?.isSuperAdmin === true || currentUser?.email === SUPER_ADMIN_EMAIL;

  const value = { currentUser, userProfile, loading, signup, login, logout, refreshProfile, isSuperAdmin };

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
