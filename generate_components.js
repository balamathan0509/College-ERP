const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const commonDir = path.join(srcDir, 'components', 'common');

if (!fs.existsSync(commonDir)) {
    fs.mkdirSync(commonDir, { recursive: true });
}

const dataTableContent = `import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DataTable({ columns, data, loading, onEdit }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [entries, setEntries] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredData = data.filter(item =>
    Object.values(item).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const totalPages = Math.ceil(filteredData.length / entries);
  const paginatedData = filteredData.slice((currentPage - 1) * entries, currentPage * entries);

  return (
    <div className="data-table-container">
      <div className="table-controls" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <div className="entries-select" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Show</span>
          <select value={entries} onChange={(e) => { setEntries(Number(e.target.value)); setCurrentPage(1); }} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>entries</span>
        </div>
        <div className="search-box" style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            style={{ padding: '8px 12px 8px 32px', borderRadius: '6px', border: '1px solid #ddd', outline: 'none' }}
          />
        </div>
      </div>

      <div className="table-responsive" style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} style={{ padding: '12px 16px', color: '#475569', fontWeight: '600', fontSize: '13px' }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                  Loading data...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                  No records found.
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rIdx) => (
                <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} style={{ padding: '12px 16px', color: '#334155', fontSize: '14px' }}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
        <div style={{ fontSize: '13px', color: '#64748b' }}>
          Showing {Math.min((currentPage - 1) * entries + 1, filteredData.length)} to {Math.min(currentPage * entries, filteredData.length)} of {filteredData.length} entries
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px', background: currentPage === 1 ? '#f1f5f9' : '#fff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px', background: currentPage === totalPages || totalPages === 0 ? '#f1f5f9' : '#fff', cursor: currentPage === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
`;

const bulkUploadModalContent = `import React, { useState } from 'react';
import { X, UploadCloud, Download, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

export default function BulkUploadModal({ isOpen, onClose, title, templateName, expectedColumns, onUpload, templateData = [] }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(templateData.length > 0 ? templateData : [expectedColumns.reduce((acc, col) => ({ ...acc, [col]: '' }), {})]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, templateName);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      processFile(selected);
    }
  };

  const processFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        if (jsonData.length === 0) {
          toast.error("File is empty");
          return;
        }

        const headers = Object.keys(jsonData[0]);
        const missingColumns = expectedColumns.filter(col => !headers.includes(col));
        
        if (missingColumns.length > 0) {
          toast.error(\`Missing required columns: \${missingColumns.join(', ')}\`);
          setErrors([\`Missing columns: \${missingColumns.join(', ')}\`]);
          setPreview(null);
          return;
        }

        setPreview(jsonData);
        setErrors([]);
      } catch (err) {
        toast.error("Failed to parse Excel file");
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirm = async () => {
    if (!preview || preview.length === 0) return;
    setLoading(true);
    try {
      await onUpload(preview);
      onClose();
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}>
      <div style={{ background: '#fff', width: '90%', maxWidth: '700px', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>
        
        <div style={{ padding: '20px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <button 
              onClick={handleDownloadTemplate}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
            >
              <Download size={18} /> Download Template
            </button>
          </div>

          <div style={{ border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '40px 20px', textAlign: 'center', background: '#f8fafc', position: 'relative' }}>
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={handleFileChange}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
            />
            <UploadCloud size={40} color="#94a3b8" style={{ marginBottom: '10px' }} />
            <p style={{ margin: 0, color: '#475569', fontWeight: '500' }}>Click or drag file to upload</p>
            <p style={{ margin: '5px 0 0 0', color: '#94a3b8', fontSize: '13px' }}>Supports .xlsx, .csv</p>
            {file && (
              <div style={{ marginTop: '15px', padding: '10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                <FileText size={16} /> {file.name}
              </div>
            )}
          </div>

          {errors.length > 0 && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#b91c1c' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 'bold' }}>
                <AlertCircle size={18} /> Validation Errors
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {preview && errors.length === 0 && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#15803d' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                <CheckCircle size={18} /> File ready to upload
              </div>
              <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>Found {preview.length} valid rows.</p>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid #eee', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            onClick={onClose}
            style={{ padding: '10px 16px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#475569', cursor: 'pointer', fontWeight: '500' }}
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={!preview || errors.length > 0 || loading}
            style={{ padding: '10px 16px', background: !preview || errors.length > 0 || loading ? '#94a3b8' : '#2563eb', border: 'none', borderRadius: '6px', color: '#fff', cursor: !preview || errors.length > 0 || loading ? 'not-allowed' : 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {loading ? 'Processing...' : 'Confirm Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
`;

const filterCardContent = `import React from 'react';

export default function FilterCard({ title, children, onSearch, onReset }) {
  return (
    <div className="filter-card" style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
      {title && <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#1e293b' }}>{title}</h3>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
        {children}
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button 
          onClick={onSearch}
          style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
        >
          Search
        </button>
        <button 
          onClick={onReset}
          style={{ padding: '8px 20px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
`;

fs.writeFileSync(path.join(commonDir, 'DataTable.js'), dataTableContent);
fs.writeFileSync(path.join(commonDir, 'BulkUploadModal.js'), bulkUploadModalContent);
fs.writeFileSync(path.join(commonDir, 'FilterCard.js'), filterCardContent);

console.log("Common components generated.");
