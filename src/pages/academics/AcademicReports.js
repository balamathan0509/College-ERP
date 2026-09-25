import React, { useState } from 'react';
import Sidebar from '../../components/Sidebar';
import { FileText, ChevronDown, ChevronUp, Download } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function AcademicReports() {
  const [expanded, setExpanded] = useState({
    reportI: true,
    reportII: false,
    reportIII: false
  });

  const toggleSection = (section) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleDownload = (reportName) => {
    toast.success(`Downloading ${reportName}...`);
    // Placeholder for actual report generation logic
  };

  const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'var(--card-hover)', cursor: 'pointer', borderBottom: '1px solid var(--border)' };
  const titleStyle = { fontWeight: 'bold', margin: 0, color: 'var(--text)' };
  const contentStyle = { padding: '20px' };
  const listStyle = { listStyleType: 'none', padding: 0, margin: 0 };
  const listItemStyle = { padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <Toaster position="top-right" />
        <div className="page-header">
          <h1><FileText size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />Academic Reports</h1>
          <p className="subtitle">View and generate academic reports</p>
        </div>

        {/* Report I - Basic Report */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={headerStyle} onClick={() => toggleSection('reportI')}>
            <h3 style={titleStyle}>Report I - Basic Report</h3>
            {expanded.reportI ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          {expanded.reportI && (
            <div style={contentStyle}>
              <ul style={listStyle}>
                <li style={listItemStyle}>
                  <span>Student Nominal Roll</span>
                  <button onClick={() => handleDownload('Student Nominal Roll')} className="btn-primary" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Download size={14} /> Download</button>
                </li>
                <li style={listItemStyle}>
                  <span>Faculty List</span>
                  <button onClick={() => handleDownload('Faculty List')} className="btn-primary" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Download size={14} /> Download</button>
                </li>
                <li style={listItemStyle}>
                  <span>Course Allocation Report</span>
                  <button onClick={() => handleDownload('Course Allocation Report')} className="btn-primary" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Download size={14} /> Download</button>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Report II - Academic Reports */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={headerStyle} onClick={() => toggleSection('reportII')}>
            <h3 style={titleStyle}>Report II - Academic Reports</h3>
            {expanded.reportII ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          {expanded.reportII && (
            <div style={contentStyle}>
              <ul style={listStyle}>
                <li style={listItemStyle}>
                  <span>Timetable Master Report</span>
                  <button onClick={() => handleDownload('Timetable Master Report')} className="btn-primary" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Download size={14} /> Download</button>
                </li>
                <li style={listItemStyle}>
                  <span>Attendance Defaulters List</span>
                  <button onClick={() => handleDownload('Attendance Defaulters List')} className="btn-primary" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Download size={14} /> Download</button>
                </li>
                <li style={listItemStyle}>
                  <span>Assignment Submission Report</span>
                  <button onClick={() => handleDownload('Assignment Submission Report')} className="btn-primary" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Download size={14} /> Download</button>
                </li>
                <li style={listItemStyle}>
                  <span>Course Plan Completion Status</span>
                  <button onClick={() => handleDownload('Course Plan Completion Status')} className="btn-primary" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Download size={14} /> Download</button>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Report III - Accreditation Reports */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={headerStyle} onClick={() => toggleSection('reportIII')}>
            <h3 style={titleStyle}>Report III - Accreditation Reports</h3>
            {expanded.reportIII ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          {expanded.reportIII && (
            <div style={contentStyle}>
              <ul style={listStyle}>
                <li style={listItemStyle}>
                  <span>Faculty Publications & Research Summary</span>
                  <button onClick={() => handleDownload('Faculty Publications')} className="btn-primary" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Download size={14} /> Download</button>
                </li>
                <li style={listItemStyle}>
                  <span>Academic Activities / Events Organized</span>
                  <button onClick={() => handleDownload('Academic Activities')} className="btn-primary" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Download size={14} /> Download</button>
                </li>
                <li style={listItemStyle}>
                  <span>Faculty Participation (FDP/Conferences)</span>
                  <button onClick={() => handleDownload('Faculty Participation')} className="btn-primary" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Download size={14} /> Download</button>
                </li>
              </ul>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
