const fs = require('fs');
const path = require('path');

const srcDir = path.join('c:', 'Users', 'nagar', 'OneDrive', 'Desktop', 'ERP', 'College-ERP', 'src');

const targetCollections = [
  'hostel_allotments', 'hostel_attendance', 'hostel_blocks', 'hostel_complaints',
  'hostel_fees', 'hostel_gatepasses', 'hostel_notices', 'hostel_visitors',
  'hostel_mess', 'hostel_mess_feedback', 'mess_menu', 'gate_pass'
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
            
            let op = 'UNKNOWN';
            if (line.includes('collection(')) op = 'collection_ref';
            if (line.includes('addDoc(') || content.includes(`addDoc(collection(db, '${coll}'`)) op = 'create';
            if (line.includes('updateDoc(') || content.includes(`doc(db, '${coll}'`)) op = 'update/delete/ref';
            if (line.includes('query(') && line.includes('where(')) op = 'query_where';
            if (line.includes('setDoc(')) op = 'create/update';
            if (line.includes('deleteDoc(')) op = 'delete';
            
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

fs.writeFileSync('audit_hostel_mess.json', JSON.stringify(report, null, 2));
console.log('Hostel/Mess audit complete.');
