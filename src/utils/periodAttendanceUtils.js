// src/utils/periodAttendanceUtils.js
import { db } from "../supabase/supabaseAdapter";
import { collection, query, where, getDocs } from "../supabase/supabaseAdapter";

export const PERIOD_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];

export function normalizeYear(val) {
  if (!val && val !== 0) return "";
  const s = String(val).trim().toUpperCase();
  const num = parseInt(s, 10);
  if (num === 7 || num === 8 || s.includes("4TH") || s.includes("IV") || s === "4" || s.includes("FINAL")) return "4th Year";
  if (num === 5 || num === 6 || s.includes("3RD") || s.includes("III") || s === "3") return "3rd Year";
  if (num === 3 || num === 4 || s.includes("2ND") || s.includes("II") || s === "2") return "2nd Year";
  if (num === 1 || num === 2 || s.includes("1ST") || s.includes("I") || s === "1") return "1st Year";
  return s;
}

export function isYearMatch(yearA, yearB) {
  if (!yearA || !yearB) return false;
  if (String(yearA).trim().toUpperCase() === String(yearB).trim().toUpperCase()) return true;
  return normalizeYear(yearA) === normalizeYear(yearB);
}

/**
 * Fetch all 8 period attendance records for a specific class on a date
 */
export async function fetchDayPeriodAttendance(dept, year, section, date) {
  const periodsMap = {};
  PERIOD_NUMBERS.forEach(p => {
    periodsMap[p] = null; // null means not yet marked
  });

  try {
    const q = query(
      collection(db, "period_attendance"),
      where("dept", "==", dept),
      where("date", "==", date)
    );
    const snap = await getDocs(q);
    const normalizedTargetYear = normalizeYear(year);

    snap.docs.forEach(d => {
      const data = d.data();
      if (!data) return;

      const matchesYear = isYearMatch(data.year, year) || normalizeYear(data.year) === normalizedTargetYear;
      
      const secA = (data.section || "").trim().toLowerCase();
      const secB = (section || "").trim().toLowerCase();
      const matchesSection = !section || secB === "all" || secB === "." || secB === "none" ||
        secA === secB || secA === "." || secA === "none";

      if (matchesYear && matchesSection) {
        const periodNum = Number(data.period);
        if (periodNum >= 1 && periodNum <= 8) {
          periodsMap[periodNum] = {
            id: d.id,
            ...data
          };
        }
      }
    });
  } catch (err) {
    console.warn("fetchDayPeriodAttendance error:", err);
  }

  return periodsMap;
}

/**
 * Computes matrix row for each student across all 8 periods
 */
export function buildStudentMatrix(students, periodsMap) {
  const markedPeriods = PERIOD_NUMBERS.filter(p => periodsMap[p] !== null);

  return students.map((student, idx) => {
    const periodStatuses = {};
    let presentCount = 0;
    let absentCount = 0;
    let odCount = 0;
    const absentPeriods = [];

    PERIOD_NUMBERS.forEach(p => {
      const periodData = periodsMap[p];
      if (!periodData || !periodData.records) {
        periodStatuses[p] = "-"; // not marked
      } else {
        const status = periodData.records[student.id];
        if (status === "P") {
          periodStatuses[p] = "P";
          presentCount++;
        } else if (status === "OD") {
          periodStatuses[p] = "OD";
          odCount++;
        } else if (status === "A") {
          periodStatuses[p] = "A";
          absentCount++;
          absentPeriods.push(p);
        } else {
          // Default to Present if period was marked but individual not recorded
          periodStatuses[p] = "P";
          presentCount++;
        }
      }
    });

    const totalAttended = presentCount + odCount;
    const totalMarked = markedPeriods.length;
    const percentage = totalMarked > 0 ? Math.round((totalAttended / totalMarked) * 100) : 100;

    let dayStatus = "Pending";
    if (totalMarked > 0) {
      if (absentCount === 0) dayStatus = "Full Present";
      else if (totalAttended >= Math.ceil(totalMarked / 2)) dayStatus = "Partial Present";
      else dayStatus = "Absent";
    }

    return {
      index: idx + 1,
      student,
      periodStatuses,
      presentCount,
      absentCount,
      odCount,
      totalAttended,
      totalMarked,
      percentage,
      absentPeriods,
      dayStatus
    };
  });
}
