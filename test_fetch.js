import { dbClient } from "./src/supabase/config.js";

async function testCoursePlans() {
  const { data, error } = await dbClient.from("course_plans").select("*").limit(1);
  console.log("course_plans error:", error ? error.message : "Exists!");
  const t2 = await dbClient.from("subject_substitutes").select("*").limit(1);
  console.log("subject_substitutes error:", t2.error ? t2.error.message : "Exists!");
  process.exit(0);
}

testCoursePlans();
