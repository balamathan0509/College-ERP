import { db, getDocs, collection, query, where } from "./src/supabase/supabaseAdapter.js";

async function testFetch() {
  const q = query(collection(db, "timetable_slots"), 
    where("dept", "==", "CSE"),
    where("semester", "==", 7),
    where("section", "==", "A")
  );
  
  const snap = await getDocs(q);
  console.log("Fetched slots:", snap.docs.length);
  snap.docs.forEach(d => console.log(d.data()));
  process.exit(0);
}

testFetch();
