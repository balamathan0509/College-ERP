const fs = require('fs');
const path = require('path');

const configDir = path.join(__dirname, 'src', 'pages', 'configuration');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            processDir(fullPath);
        } else if (file.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            
            // 1. Add Sidebar Import
            if (!content.includes('import Sidebar')) {
                content = "import Sidebar from '../../../components/Sidebar';\n" + content;
            }
            
            // 2. Wrap return statement
            if (!content.includes('className="dashboard-wrapper"')) {
                content = content.replace(
                    /return\s*\(\s*<div\s+className="page-container"/,
                    'return (\n    <div className="dashboard-wrapper">\n      <Sidebar />\n      <main className="main-content">\n        <div className="page-container"'
                );
                
                // Add closing tags before final return close
                content = content.replace(/<\/div>\s*\);\s*}\s*$/, '</div>\n      </main>\n    </div>\n  );\n}');
            }
            
            fs.writeFileSync(fullPath, content);
            console.log(`Updated layout for: ${file}`);
        }
    }
}

processDir(configDir);
console.log('All configuration pages wrapped in Dashboard Layout successfully.');
