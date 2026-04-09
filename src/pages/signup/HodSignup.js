import React from "react";
import SignupForm from "./SignupForm";

export default function HodSignup(props) {
  const deptOptions = [
    { value: "CSE", label: "CSE" },
    { value: "AIDS", label: "AIDS" },
    { value: "ECE", label: "ECE" },
    { value: "EEE", label: "EEE" },
    { value: "MECH", label: "MECH" },
  ];

  return (
    <SignupForm
      {...props}
      title="HOD Signup"
      subtitle="Create your HOD account"
      fields={[
        { name: "name", label: "Full Name", placeholder: "Your full name" },
        { name: "email", label: "Email Address", type: "email", placeholder: "you@college.edu" },
        { name: "phone", label: "Phone Number", type: "tel", placeholder: "+91 9876543210" },
        { name: "dept", label: "Department", placeholder: "Select department", options: deptOptions },
        { name: "password", label: "Password", type: "password", placeholder: "Min 6 characters" },
        { name: "confirmPassword", label: "Confirm Password", type: "password", placeholder: "Re-enter password" },
      ]}
    />
  );
}
