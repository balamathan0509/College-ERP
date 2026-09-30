// src/utils/academicCalendarUtils.js
import { db, doc, getDoc } from "../supabase/supabaseAdapter";

/**
 * Fetch the Academic Calendar for a given department
 */
export async function getDepartmentCalendar(dept) {
  if (!dept) return null;
  try {
    const cleanDept = dept.trim().toUpperCase();
    const docRef = doc(db, "academic_calendars", cleanDept);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.error("Error fetching academic calendar:", err);
  }
  return null;
}

/**
 * Check if a target YYYY-MM-DD date falls within [startDate, endDate]
 */
export function isDateInEvent(targetDateStr, startDateStr, endDateStr) {
  if (!targetDateStr || !startDateStr) return false;
  const end = endDateStr || startDateStr;
  return targetDateStr >= startDateStr && targetDateStr <= end;
}

/**
 * Get active academic calendar event for a specific date & department year
 * Accepts either calendarData object OR department string (e.g. "CSE")
 */
export async function getCalendarEventForDate(deptOrCalendarData, dateStr, yearStr) {
  let calData = deptOrCalendarData;

  if (typeof deptOrCalendarData === "string") {
    calData = await getDepartmentCalendar(deptOrCalendarData);
  }

  if (!calData || !calData.events || !Array.isArray(calData.events)) {
    return null;
  }
  const dateToCompare = dateStr || new Date().toISOString().split("T")[0];

  return calData.events.find(evt => {
    const dateMatch = isDateInEvent(dateToCompare, evt.startDate, evt.endDate);
    if (!dateMatch) return false;

    if (evt.targetYear && evt.targetYear !== "All Years" && yearStr) {
      if (evt.targetYear.toLowerCase() !== yearStr.toLowerCase()) return false;
    }
    return true;
  }) || null;
}

/**
 * Check if there is an upcoming exam in the next 1-3 days for a given department
 */
export async function getUpcomingExamReminder(dept, maxDaysAhead = 3) {
  if (!dept) return null;
  const calData = await getDepartmentCalendar(dept);
  if (!calData || !calData.events || !Array.isArray(calData.events)) return null;

  const todayStr = new Date().toISOString().split("T")[0];
  const today = new Date(todayStr);

  const upcomingEvent = calData.events.find(evt => {
    const isExamType = evt.type === "exam" || (evt.title && /exam|cia|internal|test|unit/i.test(evt.title));
    if (!isExamType || !evt.startDate) return false;

    const eventStartDate = new Date(evt.startDate);
    const diffTime = eventStartDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays >= 1 && diffDays <= maxDaysAhead;
  });

  if (!upcomingEvent) return null;

  const eventStartDate = new Date(upcomingEvent.startDate);
  const diffTime = eventStartDate - today;
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    ...upcomingEvent,
    daysRemaining
  };
}
