const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const configGeneralDir = path.join(srcDir, 'pages', 'configuration', 'general');
const configCiaDir = path.join(srcDir, 'pages', 'configuration', 'cia');
const commonDir = path.join(srcDir, 'components', 'common');

const dirs = [configGeneralDir, configCiaDir, commonDir];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const generalPages = [
    'Programme.js', 'UploadCourses.js', 'RegulationMapping.js',
    'StudentDetails.js', 'FacultyDetails.js', 'PromoteStudent.js', 'PassOutStudents.js'
];

const ciaPages = [
    'QuestionFormat.js', 'TypesAndEvaluation.js', 'EvaluationPattern.js',
    'ShowEvaluationPattern.js', 'PatternMapping.js'
];

const commonComponents = [
    'DataTable.js', 'FilterCard.js', 'BulkUploadModal.js'
];

const scaffoldContent = (name) => `import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/config';
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function ${name.replace('.js', '')}() {
  return (
    <div className="page-container" style={{ padding: '20px' }}>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>${name.replace('.js', '').replace(/([A-Z])/g, ' $1').trim()}</h2>
      </div>
      <div className="card" style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <div className="card-body">
          <p>Module under active development. Real implementation coming next.</p>
        </div>
      </div>
    </div>
  );
}
`;

generalPages.forEach(page => {
    fs.writeFileSync(path.join(configGeneralDir, page), scaffoldContent(page));
});

ciaPages.forEach(page => {
    fs.writeFileSync(path.join(configCiaDir, page), scaffoldContent(page));
});

console.log("Scaffolding complete");
