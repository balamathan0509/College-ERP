import { addDoc, collection, db } from "./src/supabase/supabaseAdapter.js";

const events = [
  { date: "2026-07-01", type: "event", title: "Reopening Date / Student Induction Program" },
  { date: "2026-07-10", type: "event", title: "Toppers Meeting" },
  { date: "2026-07-15", type: "event", title: "Class Committee Meeting - I" },
  { date: "2026-07-20", endDate: "2026-07-22", type: "exam", title: "Internal Test - I" },
  { date: "2026-07-25", type: "event", title: "Parents Meeting" },
  { date: "2026-08-10", endDate: "2026-08-12", type: "exam", title: "Internal Test - II" },
  { date: "2026-08-15", type: "holiday", title: "Independence Day" },
  { date: "2026-08-17", type: "event", title: "CSI Student Chapter/Dept. Association Inauguration" },
  { date: "2026-08-24", type: "event", title: "Alumini Talkies" },
  { date: "2026-08-26", type: "holiday", title: "Milad-un-Nabi" },
  { date: "2026-08-31", type: "event", title: "Guest Lecture" },
  { date: "2026-09-04", type: "holiday", title: "Krishna Jayanthi" },
  { date: "2026-09-05", type: "event", title: "Teachers Day" },
  { date: "2026-09-07", endDate: "2026-09-09", type: "exam", title: "Internal Test - III" },
  { date: "2026-09-14", type: "holiday", title: "Vinayagar Chathurthi" },
  { date: "2026-09-15", type: "event", title: "Engineers Day" },
  { date: "2026-09-18", type: "event", title: "Workshop" },
  { date: "2026-09-21", endDate: "2026-09-26", type: "instruction", title: "VAC (Value Added Course)" },
  { date: "2026-09-23", type: "event", title: "Class Committee Meeting - II" },
  { date: "2026-09-29", endDate: "2026-10-01", type: "exam", title: "Internal Test - IV" },
  { date: "2026-10-02", type: "holiday", title: "Gandhi Jayanthi" },
  { date: "2026-10-15", endDate: "2026-10-17", type: "exam", title: "Internal Test - V" },
  { date: "2026-10-19", type: "holiday", title: "Ayudha Pooja" },
  { date: "2026-10-20", type: "holiday", title: "Vijayadashami" },
  { date: "2026-10-21", endDate: "2026-10-27", type: "exam", title: "Model Exam - Theory" },
  { date: "2026-10-28", type: "event", title: "Last Working Day" },
  { date: "2026-10-29", endDate: "2026-11-02", type: "exam", title: "Model Exam - Lab" }
];

async function seed() {
  console.log("Seeding academic calendar...");
  for (const ev of events) {
    const docData = {
      dept: "CSE",
      session: "2026-27 ODD",
      ...ev
    };
    await addDoc(collection(db, "academic_calendar"), docData);
  }
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(console.error);
