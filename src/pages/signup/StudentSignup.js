import React from "react";
import SignupForm from "./SignupForm";

export default function StudentSignup(props) {
  const deptOptions = [
    { value: "CSE", label: "CSE" },
    { value: "AIDS", label: "AIDS" },
    { value: "ECE", label: "ECE" },
    { value: "EEE", label: "EEE" },
    { value: "MECH", label: "MECH" },
  ];

  const yearOptions = [
    { value: "1", label: "1 Year" },
    { value: "2", label: "2 Year" },
    { value: "3", label: "3 Year" },
    { value: "4", label: "4 Year" },
  ];

  return (
    <SignupForm
      {...props}
      title="Student Signup"
      subtitle="Create your student account"
      fields={[
        { name: "name", label: "Full Name", placeholder: "Your full name" },
        { name: "email", label: "Email Address", type: "email", placeholder: "you@college.edu" },
        { name: "phone", label: "Phone Number", type: "tel", placeholder: "+91 9876543210" },
        { name: "dept", label: "Department", placeholder: "Select department", options: deptOptions },
        { name: "year", label: "Year", placeholder: "Select year", options: yearOptions },
        { name: "studentType", label: "Student Type", placeholder: "Select scholar type", options: [{ value: "dayscholar", label: "Day Scholar" }, { value: "hosteller", label: "Hosteller" }] },
        { name: "registerNo", label: "Register Number", placeholder: "Register number" },
        { name: "password", label: "Password", type: "password", placeholder: "Min 6 characters" },
        { name: "confirmPassword", label: "Confirm Password", type: "password", placeholder: "Re-enter password" },
      ]}
    />
  );
}
