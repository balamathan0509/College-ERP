// src/supabase/supabaseAdapter.js
import { createClient } from "@supabase/supabase-js";
import supabase from "./config";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || "https://hnyeyvwbnoozqnumvfpi.supabase.co";
const serviceRoleKey = process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhueWV5dndibm9venFudW12ZnBpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDU2MDQwNywiZXhwIjoyMTA2MTM2NDA3fQ.oKiyCtxs5QiMnbXXbTCC3ztAmATy_gDRwRf6w7adPg0";

// Admin database client using service_role key to bypass PostgreSQL RLS permanently
export const dbClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function cleanData(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(cleanData);
  
  const cleaned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (val !== undefined && typeof val !== "function") {
        cleaned[key] = cleanData(val);
      }
    }
  }
  return cleaned;
}

function generateId() {
  return "doc_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// Global dummy db object for API compatibility
export const db = { _type: "supabase_db" };

export function collection(dbRef, tableName) {
  if (typeof dbRef === "string" && !tableName) {
    tableName = dbRef;
  }
  return { _type: "collection", tableName };
}

export function doc(dbOrColl, tableNameOrId, optionalId) {
  let tableName, id;
  if (dbOrColl && dbOrColl._type === "collection") {
    tableName = dbOrColl.tableName;
    id = tableNameOrId;
  } else {
    tableName = tableNameOrId;
    id = optionalId;
  }
  if (!id) id = generateId();
  return { _type: "doc", tableName, id };
}

export function query(collectionRef, ...constraints) {
  return {
    _type: "query",
    tableName: collectionRef.tableName,
    constraints: constraints.filter(Boolean)
  };
}

export function where(field, op, value) {
  return { _type: "constraint", kind: "where", field, op, value };
}

export function orderBy(field, direction = "asc") {
  return { _type: "constraint", kind: "orderBy", field, direction };
}

export function limit(count) {
  return { _type: "constraint", kind: "limit", count };
}

export function serverTimestamp() {
  return new Date().toISOString();
}

export function arrayUnion(...elements) {
  return { _type: "fieldValue", kind: "arrayUnion", elements };
}

export function arrayRemove(...elements) {
  return { _type: "fieldValue", kind: "arrayRemove", elements };
}

export function increment(delta) {
  return { _type: "fieldValue", kind: "increment", delta };
}

export async function getDoc(docRef) {
  try {
    const { data: row, error } = await dbClient
      .from(docRef.tableName)
      .select("*")
      .eq("id", docRef.id)
      .maybeSingle();

    if (error || !row) {
      return {
        id: docRef.id,
        exists: () => false,
        data: () => null,
        ref: docRef
      };
    }

    const docData = { id: row.id, ...(row.data || {}) };
    return {
      id: row.id,
      exists: () => true,
      data: () => docData,
      ref: docRef
    };
  } catch (err) {
    console.warn(`[Supabase Adapter] getDoc error on ${docRef.tableName}:`, err);
    return {
      id: docRef.id,
      exists: () => false,
      data: () => null,
      ref: docRef
    };
  }
}

export async function getDocs(queryOrColl) {
  const tableName = queryOrColl.tableName;
  const constraints = queryOrColl.constraints || [];

  try {
    let q = dbClient.from(tableName).select("*");

    for (const c of constraints) {
      if (!c || c._type !== "constraint") continue;

      if (c.kind === "where") {
        const { field, op, value } = c;
        if (field === "id" || field === "uid") {
          if (op === "==" || op === "===") q = q.eq("id", value);
          else if (op === "!=") q = q.neq("id", value);
          else if (op === "in" && Array.isArray(value)) q = q.in("id", value);
        } else {
          const jsonPath = `data->>${field}`;
          if (op === "==" || op === "===") {
            q = q.eq(jsonPath, String(value));
          } else if (op === "!=") {
            q = q.neq(jsonPath, String(value));
          } else if (op === ">") {
            q = q.gt(jsonPath, value);
          } else if (op === ">=") {
            q = q.gte(jsonPath, value);
          } else if (op === "<") {
            q = q.lt(jsonPath, value);
          } else if (op === "<=") {
            q = q.lte(jsonPath, value);
          } else if (op === "in" && Array.isArray(value)) {
            q = q.in(jsonPath, value.map(String));
          } else if (op === "array-contains") {
            q = q.filter("data", "cs", JSON.stringify({ [field]: [value] }));
          }
        }
      } else if (c.kind === "orderBy") {
        const col = c.field === "id" ? "id" : `data->>${c.field}`;
        q = q.order(col, { ascending: c.direction === "asc" });
      } else if (c.kind === "limit") {
        q = q.limit(c.count);
      }
    }

    const { data: rows, error } = await q;

    if (error) {
      console.warn(`[Supabase Adapter] getDocs error on ${tableName}:`, error.message);
      return { docs: [], empty: true, size: 0, forEach: () => {} };
    }

    const docs = (rows || []).map((row) => {
      const docData = { id: row.id, ...(row.data || {}) };
      return {
        id: row.id,
        exists: () => true,
        data: () => docData,
        ref: doc(db, tableName, row.id)
      };
    });

    return {
      docs,
      empty: docs.length === 0,
      size: docs.length,
      forEach: (cb) => docs.forEach(cb)
    };
  } catch (err) {
    console.warn(`[Supabase Adapter] Exception in getDocs (${tableName}):`, err);
    return { docs: [], empty: true, size: 0, forEach: () => {} };
  }
}

export async function addDoc(collectionRef, data) {
  const tableName = collectionRef.tableName;
  const newId = generateId();
  const cleaned = cleanData(data);

  const { error } = await dbClient.from(tableName).insert([
    {
      id: newId,
      data: cleaned,
      updated_at: new Date().toISOString()
    }
  ]);

  if (error) {
    console.error(`[Supabase Adapter] addDoc error on ${tableName}:`, error);
    throw error;
  }

  return { id: newId };
}

export async function setDoc(docRef, data, options = {}) {
  const { tableName, id } = docRef;
  let finalData = cleanData(data);

  if (options.merge) {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      finalData = { ...existingSnap.data(), ...finalData };
    }
  }

  const { error } = await dbClient.from(tableName).upsert([
    {
      id: id,
      data: finalData,
      updated_at: new Date().toISOString()
    }
  ]);

  if (error) {
    console.error(`[Supabase Adapter] setDoc error on ${tableName}:`, error);
    throw error;
  }
}

export async function updateDoc(docRef, data) {
  const existingSnap = await getDoc(docRef);
  const existingData = existingSnap.exists() ? existingSnap.data() : {};
  const cleanedUpdates = cleanData(data);

  const updatedData = { ...existingData };
  for (const key in cleanedUpdates) {
    const val = cleanedUpdates[key];
    if (val && typeof val === "object" && val._type === "fieldValue") {
      if (val.kind === "arrayUnion") {
        const arr = Array.isArray(updatedData[key]) ? [...updatedData[key]] : [];
        for (const el of val.elements) {
          if (!arr.includes(el)) arr.push(el);
        }
        updatedData[key] = arr;
      } else if (val.kind === "arrayRemove") {
        const arr = Array.isArray(updatedData[key]) ? [...updatedData[key]] : [];
        updatedData[key] = arr.filter((el) => !val.elements.includes(el));
      } else if (val.kind === "increment") {
        updatedData[key] = (Number(updatedData[key]) || 0) + val.delta;
      }
    } else {
      updatedData[key] = val;
    }
  }

  const { error } = await dbClient.from(docRef.tableName).upsert([
    {
      id: docRef.id,
      data: updatedData,
      updated_at: new Date().toISOString()
    }
  ]);

  if (error) {
    console.error(`[Supabase Adapter] updateDoc error on ${docRef.tableName}:`, error);
    throw error;
  }
}

export async function deleteDoc(docRef) {
  const { error } = await dbClient.from(docRef.tableName).delete().eq("id", docRef.id);
  if (error) {
    console.error(`[Supabase Adapter] deleteDoc error on ${docRef.tableName}:`, error);
    throw error;
  }
}

export function onSnapshot(queryOrDocRef, callback, errorCallback) {
  let isDoc = queryOrDocRef._type === "doc";
  const tableName = queryOrDocRef.tableName;

  const fetchCurrent = async () => {
    try {
      if (isDoc) {
        const snap = await getDoc(queryOrDocRef);
        callback(snap);
      } else {
        const snap = await getDocs(queryOrDocRef);
        callback(snap);
      }
    } catch (err) {
      if (errorCallback) errorCallback(err);
    }
  };

  fetchCurrent();

  const channel = dbClient
    .channel(`rt_${tableName}_${Math.random()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: tableName },
      () => {
        fetchCurrent();
      }
    )
    .subscribe();

  return () => {
    dbClient.removeChannel(channel);
  };
}

export function writeBatch(dbRef) {
  const operations = [];
  return {
    set(docRef, data, options) {
      operations.push(() => setDoc(docRef, data, options));
    },
    update(docRef, data) {
      operations.push(() => updateDoc(docRef, data));
    },
    delete(docRef) {
      operations.push(() => deleteDoc(docRef));
    },
    async commit() {
      for (const op of operations) {
        await op();
      }
    }
  };
}

export async function runTransaction(dbRef, updateFunction) {
  const transaction = {
    get: async (docRef) => getDoc(docRef),
    set: (docRef, data, options) => setDoc(docRef, data, options),
    update: (docRef, data) => updateDoc(docRef, data),
    delete: (docRef) => deleteDoc(docRef)
  };
  return await updateFunction(transaction);
}

// Supabase Auth & Storage Compatibility Wrappers
let _cachedUser = null;

supabase.auth.getSession().then(({ data }) => {
  if (data?.session?.user) {
    _cachedUser = data.session.user;
    _cachedUser.uid = _cachedUser.id;
  }
});

supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    _cachedUser = session.user;
    _cachedUser.uid = _cachedUser.id;
  } else {
    _cachedUser = null;
  }
});

export const auth = {
  get currentUser() {
    return _cachedUser;
  }
};

export async function createUserWithEmailAndPassword(authObj, email, password) {
  try {
    const { data, error } = await dbClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    });
    if (error) {
      // If admin API returns a explicit user already exists error, throw it
      if (error.status === 422 || error.message?.toLowerCase().includes("already")) {
        throw error;
      }
      console.warn("dbClient admin createUser returned error, falling back to signUp:", error.message);
    } else if (data?.user) {
      const user = data.user;
      user.uid = user.id;
      return { user };
    }
  } catch (adminErr) {
    if (adminErr.message?.toLowerCase().includes("already")) {
      throw adminErr;
    }
    console.warn("dbClient admin createUser failed, falling back to signUp:", adminErr);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });
  if (error) throw error;
  const user = data.user;
  if (user) {
    user.uid = user.id;
  }
  return { user };
}

export async function signInWithEmailAndPassword(authObj, email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  const user = data.user;
  if (user) {
    user.uid = user.id;
  }
  _cachedUser = user;
  return { user };
}

export async function signOut(authObj) {
  _cachedUser = null;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function sendPasswordResetEmail(authObj, email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/login"
  });
  if (error) throw error;
  return data;
}

export const EmailAuthProvider = {
  credential: (email, password) => ({ email, password })
};

export async function reauthenticateWithCredential(user, credential) {
  if (credential && credential.email && credential.password) {
    const { error } = await supabase.auth.signInWithPassword({
      email: credential.email,
      password: credential.password
    });
    if (error) throw error;
  }
}

export async function updatePassword(user, newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export function onAuthStateChanged(authObj, callback) {
  const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
    const user = session?.user || null;
    if (user) {
      user.uid = user.id;
      _cachedUser = user;
    } else {
      _cachedUser = null;
    }
    callback(user);
  });
  return () => {
    authListener?.subscription?.unsubscribe();
  };
}

export const storage = dbClient.storage;

export async function uploadFileToSupabase(bucketName, filePath, file) {
  try {
    const { data: buckets } = await dbClient.storage.listBuckets();
    const exists = buckets?.some(b => b.name === bucketName);
    if (!exists) {
      await dbClient.storage.createBucket(bucketName, { public: true });
    }
  } catch (bucketErr) {
    console.warn(`[Supabase Storage] Bucket verification failed for ${bucketName}:`, bucketErr);
  }

  const { data, error } = await dbClient.storage.from(bucketName).upload(filePath, file, {
    upsert: true
  });
  if (error) throw error;
  const { data: publicUrlData } = dbClient.storage.from(bucketName).getPublicUrl(filePath);
  return publicUrlData.publicUrl;
}
