import React, { useState } from 'react';

const RoleSelect = ({ onRoleSelect, onStudentTypeSelect }) => {
  const [role, setRole] = useState('');
  const [studentType, setStudentType] = useState('');

  const roles = [
    { id: 'student', name: 'Student', icon: '🎓' },
    { id: 'staff', name: 'Staff', icon: '👨‍🏫' },
    { id: 'hod', name: 'HOD', icon: '👔' },
    { id: 'security', name: 'Security', icon: '🛡️' },
    { id: 'warden', name: 'Warden', icon: '🏢' },
    { id: 'officestaff', name: 'Office Staff', icon: '📋' },
    { id: 'management', name: 'Management', icon: '👑' }
  ];

  const studentTypes = [
    { id: 'day', name: 'Day Scholar', icon: '☀️' },
    { id: 'hostel', name: 'Hosteller', icon: '🏠' }
  ];

  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole);
    setStudentType('');
    onRoleSelect(selectedRole);
  };

  const handleStudentTypeSelect = (selectedType) => {
    setStudentType(selectedType);
    onStudentTypeSelect(selectedType);
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">🎓</div>
          <h1>College Portal</h1>
          <p>Create your account</p>
        </div>

        <div className="form-group">
          <label>I am a...</label>
          <div className="role-selector" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {roles.map((r) => (
              <div key={r.id} className={`role-card ${role === r.id ? "active" : ""}`} onClick={() => handleRoleSelect(r.id)}>
                <div className="role-icon">{r.icon}</div>
                <div className="role-name">{r.name}</div>
              </div>
            ))}
          </div>
        </div>

        {role === "student" && (
          <div className="form-group">
            <label>Student Type</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {studentTypes.map((t) => (
                <div key={t.id} onClick={() => handleStudentTypeSelect(t.id)} style={{
                  padding: "14px 12px", borderRadius: 12, textAlign: "center", cursor: "pointer",
                  border: studentType === t.id ? "2px solid #e94560" : "1px solid rgba(255,255,255,0.1)",
                  background: studentType === t.id ? "rgba(233,69,96,0.12)" : "rgba(255,255,255,0.03)"
                }}>
                  <div style={{ fontSize: 26, marginBottom: 6 }}>{t.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "Syne", color: studentType === t.id ? "#e94560" : "white" }}>{t.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button
            className="btn-primary"
            onClick={() => {
              if (role === 'student' && !studentType) {
                alert('Please select student type');
                return;
              }
              // This will be handled by parent component
            }}
            disabled={!role || (role === 'student' && !studentType)}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelect;