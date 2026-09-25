const fs = require('fs');
const path = require('path');

const srcDir = path.join('c:', 'Users', 'nagar', 'OneDrive', 'Desktop', 'ERP', 'College-ERP', 'src');

const targetCollections = [
  'academic_timetable', 'timetable', 'timetable_entries',
  'academic_assignments', 'course_plans', 'academic_activities', 'research_repository', 'self_appraisal',
  'cia_marks', 'cia_exam_attendance',
  'cia_question_papers', 'cia_question_bank', 'cia_exam_schedules', 'cia_examinations', 'exam_results',
  'course_allocations', 'subject_allocations', 'subject_substitutes'
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
            
            // extract up to 10 lines of context around it
            let context = '';
            const start = Math.max(0, i - 5);
            const end = Math.min(lines.length - 1, i + 10);
            for (let j = start; j <= end; j++) {
              context += lines[j].trim() + '\n';
            }

            report[coll].push({
              file: path.relative(srcDir, fullPath),
              context: context
            });
          }
        });
      }
    }
  }
}

scanDir(srcDir);

fs.writeFileSync('audit_phase3.json', JSON.stringify(report, null, 2));
console.log('Phase 3 audit complete.');
