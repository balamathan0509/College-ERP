import React, { useState } from 'react';
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
