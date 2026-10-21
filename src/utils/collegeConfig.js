// College Configuration for Renganayagi Varatharaj College of Engineering (RVCE)
// College Code: 9525 (Anna University)

import { db } from "../supabase/supabaseAdapter";
import { doc, getDoc, setDoc } from "../supabase/supabaseAdapter";

export const COLLEGE_NAME = "RENGANAYAGI VARATHARAJ COLLEGE OF ENGINEERING";
export const COLLEGE_CODE = "9525";
export const COLLEGE_ADDRESS = "Salvarpatti, Sivakasi – 626 128";

export const LOCAL_STRUCTURE_KEY = "rvce_college_structure_config_v1";

// Exactly 7 Default Active Departments in RVCE
export const DEFAULT_COLLEGE_DEPARTMENTS = [
  "CSE",
  "AIDS",
  "ECE",
  "EEE",
  "IT",
  "MECH",
  "CSBS"
];

export const DEFAULT_DEPT_DETAILS = {
  CSE: { name: "Computer Science & Engineering", code: "104" },
  AIDS: { name: "Artificial Intelligence & Data Science", code: "243" },
  ECE: { name: "Electronics & Communication Engineering", code: "106" },
  EEE: { name: "Electrical & Electronics Engineering", code: "105" },
  IT: { name: "Information Technology", code: "205" },
  MECH: { name: "Mechanical Engineering", code: "114" },
  CSBS: { name: "Computer Science & Business Systems", code: "244" }
};

export const DEFAULT_SECTIONS_CONFIG = {
  CSE: {
    "1": ["A", "B", "C"],
    "2": ["A", "B"],
    "3": ["A", "B"],
    "4": ["Single"]
  },
  AIDS: { "1": ["Single"], "2": ["Single"], "3": ["Single"], "4": ["Single"] },
  ECE: { "1": ["Single"], "2": ["Single"], "3": ["Single"], "4": ["Single"] },
  EEE: { "1": ["Single"], "2": ["Single"], "3": ["Single"], "4": ["Single"] },
  IT: { "1": ["Single"], "2": ["Single"], "3": ["Single"], "4": ["Single"] },
  MECH: { "1": ["Single"], "2": ["Single"], "3": ["Single"], "4": ["Single"] },
  CSBS: { "1": ["Single"], "2": ["Single"], "3": ["Single"], "4": ["Single"] }
};

// Static export for direct references
export const COLLEGE_DEPARTMENTS = DEFAULT_COLLEGE_DEPARTMENTS;
export const DEPT_FULL_NAMES = Object.fromEntries(
  Object.entries(DEFAULT_DEPT_DETAILS).map(([k, v]) => [k, v.name])
);
export const ANNA_UNIV_DEPT_CODES = Object.fromEntries(
  Object.entries(DEFAULT_DEPT_DETAILS).map(([k, v]) => [k, v.code])
);

export const ACADEMIC_YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

/**
 * Retrieve current active structure (from localStorage or default)
 */
export function getStoredCollegeStructure() {
  try {
    const raw = localStorage.getItem(LOCAL_STRUCTURE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.departments) && parsed.sections) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Error reading local college structure:", e);
  }

  return {
    departments: [...DEFAULT_COLLEGE_DEPARTMENTS],
    deptDetails: { ...DEFAULT_DEPT_DETAILS },
    sections: JSON.parse(JSON.stringify(DEFAULT_SECTIONS_CONFIG))
  };
}

/**
 * Save new college structure (updates LocalStorage & Supabase)
 */
export async function saveStoredCollegeStructure(newStructure) {
  try {
    localStorage.setItem(LOCAL_STRUCTURE_KEY, JSON.stringify(newStructure));
    window.dispatchEvent(new Event("collegeStructureUpdated"));

    // Sync to Supabase
    try {
      const configRef = doc(db, "college_configuration", "structure_config");
      await setDoc(configRef, {
        ...newStructure,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (dbErr) {
      console.warn("Supabase sync warning:", dbErr);
    }

    return true;
  } catch (err) {
    console.error("Failed to save college structure:", err);
    return false;
  }
}

/**
 * Fetch and sync latest college structure from Supabase
 */
export async function syncCollegeStructureFromDb() {
  try {
    const configRef = doc(db, "college_configuration", "structure_config");
    const snap = await getDoc(configRef);
    if (snap.exists && snap.data) {
      const data = snap.data();
      if (data && Array.isArray(data.departments) && data.sections) {
        localStorage.setItem(LOCAL_STRUCTURE_KEY, JSON.stringify(data));
        window.dispatchEvent(new Event("collegeStructureUpdated"));
        return data;
      }
    }
  } catch (e) {
    console.warn("DB fetch failed, using local/default:", e);
  }
  return getStoredCollegeStructure();
}

/**
 * Get dynamic list of departments
 */
export function getLiveDepartments() {
  const current = getStoredCollegeStructure();
  return current.departments || DEFAULT_COLLEGE_DEPARTMENTS;
}

/**
 * Get valid sections for a given department and year (dynamically pulls from current structure)
 */
export function getSectionsForDeptAndYear(dept, year) {
  const normDept = String(dept || "").trim().toUpperCase();
  const normYear = String(year || "").trim();

  // Normalize year inputs: "1", "1st", "1st Year", "I", etc.
  let yrNum = "1";
  if (normYear.includes("2") || normYear === "II") yrNum = "2";
  else if (normYear.includes("3") || normYear === "III") yrNum = "3";
  else if (normYear.includes("4") || normYear === "IV") yrNum = "4";

  const structure = getStoredCollegeStructure();
  const deptSecs = structure.sections?.[normDept];

  if (deptSecs && Array.isArray(deptSecs[yrNum]) && deptSecs[yrNum].length > 0) {
    return deptSecs[yrNum];
  }

  // Fallback defaults for CSE
  if (normDept === "CSE") {
    if (yrNum === "1") return ["A", "B", "C"];
    if (yrNum === "2" || yrNum === "3") return ["A", "B"];
    return ["Single"];
  }

  // Default fallback for any single-class department
  return ["Single"];
}

/**
 * Returns the complete list of active classes in the college:
 * Dynamically generated from current departments and sections.
 */
export function getAllCollegeClasses() {
  const years = [
    { num: 1, roman: "I" },
    { num: 2, roman: "II" },
    { num: 3, roman: "III" },
    { num: 4, roman: "IV" }
  ];

  const structure = getStoredCollegeStructure();
  const depts = structure.departments || DEFAULT_COLLEGE_DEPARTMENTS;
  const classList = [];

  years.forEach(({ num, roman }) => {
    depts.forEach(dept => {
      const sections = getSectionsForDeptAndYear(dept, num);
      if (sections.length === 1 && sections[0] === "Single") {
        classList.push({
          label: `${roman} - ${dept}`,
          dept,
          year: num,
          yearLabel: `${num}${num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th'} Year`,
          romanYear: roman,
          section: ""
        });
      } else {
        sections.forEach(sec => {
          classList.push({
            label: `${roman} - ${dept} ${sec}`,
            dept,
            year: num,
            yearLabel: `${num}${num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th'} Year`,
            romanYear: roman,
            section: sec
          });
        });
      }
    });
  });

  return classList;
}
