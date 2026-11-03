// src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
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

const SUPER_ADMIN_EMAIL = "balamathan0509@gmail.com";

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return auth.currentUser || null;
    } catch (_) {
      return null;
    }
  });

  const [userProfile, setUserProfile] = useState(() => {
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith("erp_user_profile_")) {
          const val = JSON.parse(sessionStorage.getItem(k));
          if (val && val.role) return val;
        }
      }
    } catch (_) {}
    return null;
  });

  const [loading, setLoading] = useState(() => {
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith("erp_user_profile_")) {
          const val = JSON.parse(sessionStorage.getItem(k));
          if (val && val.role) return false;
        }
      }
    } catch (_) {}
    return true;
  });

  // Ref to hold latest currentUser without causing fetchUserProfile to be recreated
  const currentUserRef = useRef(null);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

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
    const uid = currentUserRef.current?.uid;
    if (uid) {
      sessionStorage.removeItem("erp_user_profile_" + uid);
    }
    setUserProfile(null);
    return signOut(auth);
  }

  // useCallback with empty deps — uses currentUserRef.current to avoid stale closure
  const fetchUserProfile = useCallback(async (uid) => {
    const cacheKey = "erp_user_profile_" + uid;
    const cachedStr = sessionStorage.getItem(cacheKey);
    let cachedData = null;
    if (cachedStr) {
      try {
        cachedData = JSON.parse(cachedStr);
        if (cachedData && cachedData.role) {
          setUserProfile(cachedData);
          setLoading(false);
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
        const user = currentUserRef.current || auth.currentUser;
        const email = (user?.email || "").trim().toLowerCase();
        if (email) {
          try {
            const q = query(collection(db, "users"), where("email", "==", email));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const existingDoc = snap.docs[0];
              data = { ...existingDoc.data(), uid: uid, id: uid };
              await setDoc(docRef, data);
            }
          } catch (emailLookupErr) {
            console.warn("Failed email lookup fallback for user profile:", emailLookupErr);
          }
        }
      }

      if (data) {
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

        const user = currentUserRef.current || auth.currentUser;
        if (user?.email === SUPER_ADMIN_EMAIL) {
          data.isSuperAdmin = true;
          data.role = "admin";
        }

        sessionStorage.setItem(cacheKey, JSON.stringify(data));
        setUserProfile(data);
      } else if (cachedData && cachedData.role) {
        setUserProfile(cachedData);
      } else {
        const user = currentUserRef.current || auth.currentUser;
        const email = (user?.email || "").trim().toLowerCase();
        const isSuper = email === SUPER_ADMIN_EMAIL;

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
        const user = currentUserRef.current || auth.currentUser;
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
  }, []); // empty deps — safe because we use currentUserRef.current

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 600);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(timeout);
      setCurrentUser(user);
      currentUserRef.current = user;
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
  }, [fetchUserProfile]);

  const refreshProfile = useCallback(async () => {
    const user = currentUserRef.current;
    if (!user) return;
    await fetchUserProfile(user.uid);
  }, [fetchUserProfile]);

  const isSuperAdmin = useMemo(
    () => userProfile?.isSuperAdmin === true || currentUser?.email === SUPER_ADMIN_EMAIL,
    [userProfile, currentUser]
  );

  // useMemo: value object only recreates when actual data changes — prevents unnecessary re-renders
  const value = useMemo(
    () => ({ currentUser, userProfile, loading, signup, login, logout, refreshProfile, isSuperAdmin }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, userProfile, loading, isSuperAdmin, refreshProfile]
  );

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
