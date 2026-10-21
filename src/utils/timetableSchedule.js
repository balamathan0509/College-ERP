// src/utils/timetableSchedule.js
import { db, doc, getDoc, setDoc } from "../supabase/supabaseAdapter";

export const DEFAULT_TIMETABLE_SCHEDULE = {
  periods: {
    1: "09:00 - 09:50",
    2: "09:50 - 10:40",
    3: "11:00 - 11:50",
    4: "11:50 - 12:40",
    5: "01:30 - 02:20",
    6: "02:20 - 03:10",
    7: "03:25 - 04:10",
    8: "04:10 - 04:55",
  },
  teaBreak: "10:40 - 11:00",
  teaBreakAfter: 2, // Break placed after Period 2
  lunchBreak: "12:40 - 01:30",
  lunchBreakAfter: 4, // Lunch placed after Period 4
  afternoonBreak: "03:10 - 03:25",
  afternoonBreakAfter: 6, // Afternoon break placed after Period 6 (can be 5, 6, 7, etc., or 0 for none)
};

/**
 * Returns an ordered array of table columns based on the schedule's period and break placements.
 */
export function getTimetableColumns(schedule) {
  const teaAfter = schedule?.teaBreakAfter !== undefined && schedule.teaBreakAfter !== "" && schedule.teaBreakAfter !== "none"
    ? Number(schedule.teaBreakAfter) 
    : 2;
  const lunchAfter = schedule?.lunchBreakAfter !== undefined && schedule.lunchBreakAfter !== "" && schedule.lunchBreakAfter !== "none"
    ? Number(schedule.lunchBreakAfter) 
    : 4;
  const afternoonAfter = schedule?.afternoonBreakAfter !== undefined && schedule.afternoonBreakAfter !== "" && schedule.afternoonBreakAfter !== "none"
    ? Number(schedule.afternoonBreakAfter) 
    : 6;

  const cols = [];
  for (let p = 1; p <= 8; p++) {
    cols.push({
      type: "period",
      period: p,
      timing: schedule?.periods?.[p] || ""
    });

    if (teaAfter === p && schedule?.teaBreak) {
      cols.push({
        type: "break",
        name: "Break",
        timing: schedule.teaBreak,
        id: "tea"
      });
    }
    if (lunchAfter === p && schedule?.lunchBreak) {
      cols.push({
        type: "lunch",
        name: "Lunch",
        timing: schedule.lunchBreak,
        id: "lunch"
      });
    }
    if (afternoonAfter === p && schedule?.afternoonBreak) {
      cols.push({
        type: "break",
        name: "Break",
        timing: schedule.afternoonBreak,
        id: "afternoon"
      });
    }
  }
  return cols;
}

/**
 * Loads schedule from localStorage cache or fallback default
 */
export function getCachedSchedule(dept) {
  try {
    const key = dept ? `erp_timetable_schedule_${dept}` : "erp_timetable_schedule";
    const saved = localStorage.getItem(key) || localStorage.getItem("erp_timetable_schedule");
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_TIMETABLE_SCHEDULE,
        ...parsed,
        teaBreakAfter: parsed.teaBreakAfter !== undefined ? Number(parsed.teaBreakAfter) : DEFAULT_TIMETABLE_SCHEDULE.teaBreakAfter,
        lunchBreakAfter: parsed.lunchBreakAfter !== undefined ? Number(parsed.lunchBreakAfter) : DEFAULT_TIMETABLE_SCHEDULE.lunchBreakAfter,
        afternoonBreakAfter: parsed.afternoonBreakAfter !== undefined ? Number(parsed.afternoonBreakAfter) : DEFAULT_TIMETABLE_SCHEDULE.afternoonBreakAfter,
        periods: {
          ...DEFAULT_TIMETABLE_SCHEDULE.periods,
          ...(parsed.periods || {})
        }
      };
    }
  } catch (e) {
    console.warn("Failed to parse cached schedule", e);
  }
  return DEFAULT_TIMETABLE_SCHEDULE;
}

/**
 * Fetches timetable schedule from Supabase/DB, falling back to cached or default
 */
export async function fetchScheduleFromDB(dept) {
  const cached = getCachedSchedule(dept);
  try {
    const docId = `schedule_${dept || "default"}`;
    const snap = await getDoc(doc(db, "timetable_slots", docId));
    if (snap && snap.exists()) {
      const data = snap.data();
      const merged = {
        ...DEFAULT_TIMETABLE_SCHEDULE,
        ...data,
        teaBreakAfter: data.teaBreakAfter !== undefined ? Number(data.teaBreakAfter) : DEFAULT_TIMETABLE_SCHEDULE.teaBreakAfter,
        lunchBreakAfter: data.lunchBreakAfter !== undefined ? Number(data.lunchBreakAfter) : DEFAULT_TIMETABLE_SCHEDULE.lunchBreakAfter,
        afternoonBreakAfter: data.afternoonBreakAfter !== undefined ? Number(data.afternoonBreakAfter) : DEFAULT_TIMETABLE_SCHEDULE.afternoonBreakAfter,
        periods: {
          ...DEFAULT_TIMETABLE_SCHEDULE.periods,
          ...(data.periods || {})
        }
      };
      // Cache it locally
      try {
        const key = dept ? `erp_timetable_schedule_${dept}` : "erp_timetable_schedule";
        localStorage.setItem(key, JSON.stringify(merged));
        localStorage.setItem("erp_timetable_schedule", JSON.stringify(merged));
      } catch {}
      return merged;
    }
  } catch (err) {
    console.warn("[timetableSchedule] fetchScheduleFromDB error, using cache/defaults:", err);
  }
  return cached;
}

/**
 * Saves schedule to DB and localStorage, notifies listeners
 */
export async function saveScheduleToDB(dept, schedule) {
  const merged = {
    ...DEFAULT_TIMETABLE_SCHEDULE,
    ...schedule,
    teaBreakAfter: schedule.teaBreakAfter !== undefined ? Number(schedule.teaBreakAfter) : DEFAULT_TIMETABLE_SCHEDULE.teaBreakAfter,
    lunchBreakAfter: schedule.lunchBreakAfter !== undefined ? Number(schedule.lunchBreakAfter) : DEFAULT_TIMETABLE_SCHEDULE.lunchBreakAfter,
    afternoonBreakAfter: schedule.afternoonBreakAfter !== undefined ? Number(schedule.afternoonBreakAfter) : DEFAULT_TIMETABLE_SCHEDULE.afternoonBreakAfter,
    periods: {
      ...DEFAULT_TIMETABLE_SCHEDULE.periods,
      ...(schedule.periods || {})
    }
  };

  // 1. Save to local storage immediately
  try {
    const key = dept ? `erp_timetable_schedule_${dept}` : "erp_timetable_schedule";
    localStorage.setItem(key, JSON.stringify(merged));
    localStorage.setItem("erp_timetable_schedule", JSON.stringify(merged));
  } catch (e) {
    console.warn("Failed to save schedule to localStorage", e);
  }

  // 2. Dispatch custom event for immediate UI sync across components in the same tab
  try {
    window.dispatchEvent(new CustomEvent("timetable_schedule_changed", { detail: merged }));
  } catch {}

  // 3. Persist to DB
  try {
    const docId = `schedule_${dept || "default"}`;
    await setDoc(doc(db, "timetable_slots", docId), {
      id: docId,
      dept: dept || "CSE",
      is_schedule: true,
      periods: merged.periods,
      teaBreak: merged.teaBreak,
      teaBreakAfter: merged.teaBreakAfter,
      lunchBreak: merged.lunchBreak,
      lunchBreakAfter: merged.lunchBreakAfter,
      afternoonBreak: merged.afternoonBreak,
      afternoonBreakAfter: merged.afternoonBreakAfter,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error("[timetableSchedule] saveScheduleToDB error:", err);
    throw err;
  }

  return merged;
}
