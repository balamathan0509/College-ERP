const fs = require('fs');
const path = require('path');

const srcDir = path.join('c:', 'Users', 'nagar', 'OneDrive', 'Desktop', 'ERP', 'College-ERP', 'src');
const appJsPath = path.join(srcDir, 'App.js');

// Extract routes and roles from App.js
const appJs = fs.readFileSync(appJsPath, 'utf8');
const routeRegex = /<Route\s+path=["']([^"']+)["']\s+element=\{<ProtectedRoute\s+allowedRole=\{?([^}>]+)\}?>\s*<([A-Za-z0-9_]+)\s*\/>/g;

const componentToRoles = {};

let match;
while ((match = routeRegex.exec(appJs)) !== null) {
  const routePath = match[1];
  let rolesRaw = match[2];
  const componentName = match[3];

  let roles = [];
  if (rolesRaw.startsWith('[')) {
    // Array of roles e.g. ['staff', 'hod']
    roles = rolesRaw.replace(/[[\]'"]/g, '').split(',').map(r => r.trim());
  } else {
    // Single role e.g. "student"
    roles = [rolesRaw.replace(/['"]/g, '').trim()];
  }
  
  componentToRoles[componentName] = roles;
}

// Manually map some common ones
componentToRoles['Sidebar'] = ['*']; 
componentToRoles['AuthContext'] = ['*'];

const collectionsMap = {};

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDir(fullPath);
    } else if (fullPath.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Find collection calls
      const collRegex = /collection\(\s*db\s*,\s*['"]([^'"]+)['"]/g;
      let cMatch;
      while ((cMatch = collRegex.exec(content)) !== null) {
        const collName = cMatch[1];
        if (!collectionsMap[collName]) collectionsMap[collName] = new Set();
        
        // Find component name based on filename
        const compName = path.basename(fullPath, '.js');
        
        // Check if we know the roles for this component
        if (componentToRoles[compName]) {
          componentToRoles[compName].forEach(r => collectionsMap[collName].add(r));
        } else {
          // Check folder name as a hint
          const folder = path.basename(path.dirname(fullPath)).toLowerCase();
          if (['student', 'staff', 'hod', 'admin', 'principal', 'warden', 'security', 'mess', 'officestaff'].includes(folder)) {
             collectionsMap[collName].add(folder);
          } else {
             collectionsMap[collName].add('UNKNOWN_FROM_' + compName);
          }
        }
      }
    }
  }
}

scanDir(srcDir);

const result = {};
for (const [coll, rolesSet] of Object.entries(collectionsMap)) {
  result[coll] = Array.from(rolesSet);
}

console.log(JSON.stringify(result, null, 2));
