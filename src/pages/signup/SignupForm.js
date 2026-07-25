import React from "react";
import { GraduationCap, ArrowRight } from "lucide-react";

export default function SignupForm({
  title,
  subtitle,
  fields,
  form,
  handleChange,
  onSubmit,
  error,
  sendingOtp,
  onBack,
}) {
  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">
            <GraduationCap size={32} color="#ffffff" />
          </div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={onSubmit}>
          {fields.map((field) => (
            <div className="form-group" key={field.name}>
              <label>{field.label}</label>
              {field.options ? (
                <select
                  name={field.name}
                  value={form[field.name] || ""}
                  onChange={handleChange}
                  required={field.required !== false}
                >
                  <option value="" disabled>
                    {field.placeholder || `Select ${field.label}`}
                  </option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type || "text"}
                  name={field.name}
                  value={form[field.name] || ""}
                  onChange={handleChange}
                  placeholder={field.placeholder || field.label}
                  required={field.required !== false}
                />
              )}
            </div>
          ))}

          <button className="btn-primary" type="submit" disabled={sendingOtp}>
            {sendingOtp ? "Sending OTP..." : <>Continue <ArrowRight size={16} /></>}
          </button>
        </form>

        {onBack && (
          <div className="auth-switch">
            <span onClick={onBack}>Back to login</span>
          </div>
        )}
      </div>
    </div>
  );
}
