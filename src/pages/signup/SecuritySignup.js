import React from "react";
import SignupForm from "./SignupForm";

export default function SecuritySignup(props) {
  return (
    <SignupForm
      {...props}
      title="Security Signup"
      subtitle="Create your security account"
      fields={[
        { name: "name", label: "Full Name", placeholder: "Your full name" },
        { name: "email", label: "Email Address", type: "email", placeholder: "you@college.edu" },
        { name: "phone", label: "Phone Number", type: "tel", placeholder: "+91 9876543210" },
        { name: "password", label: "Password", type: "password", placeholder: "Min 6 characters" },
        { name: "confirmPassword", label: "Confirm Password", type: "password", placeholder: "Re-enter password" },
      ]}
    />
  );
}
