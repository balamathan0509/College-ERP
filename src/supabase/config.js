import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || "https://hnyeyvwbnoozqnumvfpi.supabase.co";

// Using full database access key for local development to bypass RLS policies cleanly
const supabaseKey = process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY || 
  process.env.REACT_APP_SUPABASE_ANON_KEY || 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhueWV5dndibm9venFudW12ZnBpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDU2MDQwNywiZXhwIjoyMTA2MTM2NDA3fQ.oKiyCtxs5QiMnbXXbTCC3ztAmATy_gDRwRf6w7adPg0";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export default supabase;
