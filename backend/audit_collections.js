const fs = require('fs');
const path = require('path');

const srcDir = path.join('c:', 'Users', 'nagar', 'OneDrive', 'Desktop', 'ERP', 'College-ERP', 'src');

const targetCollections = [
  'academic_sessions', 'course_allocations', 'subject_allocations', 'subject_substitutes',
  'class_incharges', 'substitute_incharges', 'timetable', 'timetable_entries', 'academic_timetable',
  'attendance', 'daily_attendance', 'academic_activities', 'academic_assignments', 'course_plans',
  'research_repository', 'self_appraisal', 'cia_exam_attendance', 'cia_exam_schedules', 'cia_examinations',
  'cia_marks', 'cia_question_bank', 'cia_question_papers', 'exam_results'
];

const report = {};

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDir(fullPath);
    } else if (fullPath.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      const compName = path.basename(fullPath, '.js');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        targetCollections.forEach(coll => {
          if (line.includes(`'${coll}'`) || line.includes(`"${coll}"`)) {
            if (!report[coll]) report[coll] = [];
            
            // Check what operation this is
            let op = 'UNKNOWN';
            if (line.includes('collection(')) op = 'collection_ref';
            if (line.includes('addDoc(') || content.includes(`addDoc(collection(db, '${coll}'`)) op = 'create';
            if (line.includes('updateDoc(') || content.includes(`doc(db, '${coll}'`)) op = 'update/delete/ref';
            if (line.includes('query(') && line.includes('where(')) op = 'query_where';
            
            // grab the surrounding context
            let context = '';
            const start = Math.max(0, i - 2);
            const end = Math.min(lines.length - 1, i + 2);
            for (let j = start; j <= end; j++) {
              context += lines[j].trim() + ' ';
            }

            report[coll].push({
              file: path.relative(srcDir, fullPath),
              operation: op,
              context: context
            });
          }
        });
      }
    }
  }
}

scanDir(srcDir);

fs.writeFileSync('audit_output.json', JSON.stringify(report, null, 2));
console.log('Audit complete.');
