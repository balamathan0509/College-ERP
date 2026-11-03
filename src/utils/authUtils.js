// src/utils/authUtils.js

export function getUserDashboard(userProfile, currentUser) {
  if (!userProfile && !currentUser) return "/";
  if (userProfile?.isSuperAdmin || currentUser?.email === "balamathan0509@gmail.com") return "/admin";

  let role = (userProfile?.role || "").toLowerCase().trim();
  const designation = (userProfile?.designation || "").toLowerCase().trim();

  // 1. HOD check (role ends/contains hod or designation contains hod)
  if (role.endsWith("hod") || role.includes("hod") || designation.includes("hod")) {
    return "/hod";
  }

  // 2. Office Staff check (checked BEFORE staff because 'officestaff' contains 'staff')
  if (role === "officestaff" || role.includes("office")) {
    return "/officestaff";
  }

  // 3. Principal
  if (role === "principal" || role.includes("principal")) {
    return "/principal";
  }

  // 4. Exam Cell
  if (role === "exam_cell" || role.includes("exam")) {
    return "/exam_cell";
  }

  // 5. Warden
  if (role === "warden" || role.includes("warden")) {
    return "/warden";
  }

  // 6. Security
  if (role === "security" || role.includes("security")) {
    return "/security/verify";
  }

  // 7. Management
  if (role === "management" || role.includes("management")) {
    return "/management";
  }

  // 8. Staff / Faculty / Teacher / Dept Admin
  if (
    role === "staff" ||
    role === "faculty" ||
    role === "teacher" ||
    role === "dept_admin" ||
    role.includes("faculty") ||
    role.includes("staff")
  ) {
    return "/staff";
  }

  // 9. Student
  if (role === "student" || role.includes("student")) {
    return "/student";
  }

  return "/student";
}

