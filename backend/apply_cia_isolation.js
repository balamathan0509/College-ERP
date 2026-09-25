const fs = require('fs');
const path = require('path');

const filesToProcess = [
  'TypesAndEvaluation.js',
  'EvaluationPattern.js',
  'PatternMapping.js',
  'ShowEvaluationPattern.js'
];

const basePath = path.join(__dirname, '..', 'src', 'pages', 'configuration', 'cia');

for (const file of filesToProcess) {
  const filePath = path.join(basePath, file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} - not found`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add imports
  if (!content.includes("import { useAuth }")) {
    content = content.replace(
      /import DataTable from '..\/..\/..\/components\/common\/DataTable';/,
      "import DataTable from '../../../components/common/DataTable';\nimport { useAuth } from '../../../context/AuthContext';"
    );
  }
  
  if (!content.includes("where }")) {
    content = content.replace(/, query, orderBy } from 'firebase\/firestore';/, ", query, orderBy, where } from 'firebase/firestore';");
  }

  // 2. Add state
  if (!content.includes("const { userProfile, isSuperAdmin } = useAuth();")) {
    content = content.replace(
      /const \[editItem, setEditItem\] = useState\(null\);/,
      `const [editItem, setEditItem] = useState(null);\n  \n  const { userProfile, isSuperAdmin } = useAuth();\n  const [filterDept, setFilterDept] = useState('');\n  const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "IT", "AIDS"];`
    );
  }

  // 3. Update formData
  if (content.includes("const [formData, setFormData] = useState({")) {
    if (!content.includes("department: ''")) {
      content = content.replace(/(const \[formData, setFormData\] = useState\(\{[\s\S]*?)(\}\);)/, "$1, department: '' $2");
    }
  }

  // 4. Update fetchData
  const collectionNameMatch = content.match(/query\(collection\(db, '([^']+)'\)/);
  if (collectionNameMatch) {
    const collName = collectionNameMatch[1];
    
    const fetchRegex = /const q = query\(collection\(db, '[^']+'\)(?:, orderBy\('[^']+', '[^']+'\))?\);\s*const snap = await getDocs\(q\);\s*set[A-Za-z]+\(snap\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) \}\)\)\);/;
    
    if (fetchRegex.test(content)) {
      const setterNameMatch = content.match(/set[A-Za-z]+\(snap\.docs\.map/);
      if (setterNameMatch) {
        const setterName = setterNameMatch[0].replace('(snap.docs.map', '');
        
        const newFetchLogic = `let q = query(collection(db, '${collName}'), orderBy('createdAt', 'desc'));
      
      if (userProfile?.role === 'hod') {
        q = query(collection(db, '${collName}'), where('department', '==', userProfile.dept), orderBy('createdAt', 'desc'));
      }
      
      const snap = await getDocs(q);
      let fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (userProfile?.role !== 'hod' && filterDept) {
        if (filterDept === 'Unassigned') {
          fetched = fetched.filter(f => !f.department);
        } else {
          fetched = fetched.filter(f => f.department === filterDept);
        }
      }
      
      ${setterName}(fetched);`;
        
        content = content.replace(fetchRegex, newFetchLogic);
      }
    }
  }

  // 5. Update useEffect dependency
  if (content.includes("useEffect(() => { fetchData(); }, []);")) {
    content = content.replace(
      /useEffect\(\(\) => \{ fetchData\(\); \}, \[\]\);/,
      "useEffect(() => { if (userProfile) fetchData(); }, [userProfile, filterDept]);"
    );
  } else if (content.includes("useEffect(() => {\n    fetchData();\n  }, []);")) {
     content = content.replace(
      /useEffect\(\(\) => \{\n    fetchData\(\);\n  \}, \[\]\);/,
      "useEffect(() => {\n    if (userProfile) fetchData();\n  }, [userProfile, filterDept]);"
    );
  }

  // 6. Update handleSubmit
  const handleSubmitRegex = /if \(editItem\) \{\s*await updateDoc\(doc\(db, '[^']+', editItem\.id\), \{ \.\.\.formData, updatedAt: serverTimestamp\(\) \}\);\s*toast\.success\('[^']+'\);\s*\} else \{\s*await addDoc\(collection\(db, '[^']+'\), \{ \.\.\.formData, createdAt: serverTimestamp\(\), updatedAt: serverTimestamp\(\) \}\);\s*toast\.success\('[^']+'\);\s*\}/;
  
  if (handleSubmitRegex.test(content) && collectionNameMatch) {
    const collName = collectionNameMatch[1];
    const newSubmitLogic = `let savePayload = { ...formData, updatedAt: serverTimestamp() };
      
      if (userProfile?.role === 'hod') {
        savePayload.department = userProfile.dept;
      } else {
        if (!savePayload.department) {
          toast.error('Admin must assign a department');
          return;
        }
      }

      if (editItem) {
        await updateDoc(doc(db, '${collName}', editItem.id), savePayload);
        toast.success('Updated successfully');
      } else {
        savePayload.createdAt = serverTimestamp();
        await addDoc(collection(db, '${collName}'), savePayload);
        toast.success('Created successfully');
      }`;
    
    content = content.replace(handleSubmitRegex, newSubmitLogic);
  }

  // 7. Update UI table columns
  if (content.includes("const columns = [\n    {")) {
    if (!content.includes("{ key: 'department'")) {
      content = content.replace(
        /(const columns = \[\n    \{[^\n]+)/,
        "$1\n    { key: 'department', label: 'Dept', render: (item) => item.department || <span style={{color:'red'}}>Unassigned</span> },"
      );
    }
  }

  // 8. Update Header UI and Add Button
  const headerDivRegex = /<div className="page-header".*?>[\s\S]*?<\/div>[\s]*<button onClick=\{[\s\S]*?<\/button>/;
  if (headerDivRegex.test(content)) {
    const match = content.match(headerDivRegex)[0];
    
    let newHeader = match.replace(/Configuration \/ CIA Configuration \//, "Department / CIA Configuration /");
    
    // Extract the Add button from the match
    const addBtnMatch = newHeader.match(/<button onClick=\{.*?<\/button>/);
    if (addBtnMatch) {
      let addBtn = addBtnMatch[0];
      
      // Inject department into initial state in button
      addBtn = addBtn.replace(/status: 'Active'/, "status: 'Active', department: userProfile?.role === 'hod' ? userProfile.dept : ''");
      
      const combinedButtons = `<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {userProfile?.role !== 'hod' && (
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
              <option value="">All Departments</option>
              <option value="Unassigned">Unassigned (Legacy)</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          ${addBtn}
        </div>`;
      
      newHeader = newHeader.replace(/<\/div>[\s]*<button onClick=\{[\s\S]*?<\/button>/, `</div>\n        ${combinedButtons}`);
      
      content = content.replace(match, newHeader);
    }
  } else {
      // Some components might have the button inside the header div
      const altHeaderRegex = /<div className="page-header"[\s\S]*?<\/div>\s*<\/div>/;
      if (altHeaderRegex.test(content)) {
         // handle
         let match = content.match(altHeaderRegex)[0];
         let newHeader = match.replace(/Configuration \/ CIA Configuration \//, "Department / CIA Configuration /");
         
         const addBtnMatch = newHeader.match(/<button onClick=\{.*?<\/button>/);
         if (addBtnMatch) {
            let addBtn = addBtnMatch[0];
            addBtn = addBtn.replace(/status: 'Active'/, "status: 'Active', department: userProfile?.role === 'hod' ? userProfile.dept : ''");
            
            const combinedButtons = `<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {userProfile?.role !== 'hod' && (
                <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
                  <option value="">All Departments</option>
                  <option value="Unassigned">Unassigned (Legacy)</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
              ${addBtn}
            </div>`;
            
            newHeader = newHeader.replace(/<button onClick=\{.*?<\/button>/, combinedButtons);
            content = content.replace(match, newHeader);
         }
      }
  }

  // 9. Update Form (Add Department dropdown)
  const formRegex = /<form onSubmit=\{handleSubmit\}>\s*<div style=\{\{marginBottom:15\}\}>/;
  if (formRegex.test(content)) {
    const adminDropdown = `<form onSubmit={handleSubmit}>
              {userProfile?.role !== 'hod' && (
                <div style={{marginBottom:15}}>
                  <label>Department (Admin Only) *</label>
                  <select required value={formData.department || ''} onChange={e => setFormData({...formData, department: e.target.value})} style={{width:'100%',padding:8,border:'1px solid #ccc',borderRadius:4}}>
                    <option value="">Select Department</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}
              <div style={{marginBottom:15}}>`;
    content = content.replace(formRegex, adminDropdown);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Processed ${file}`);
}
