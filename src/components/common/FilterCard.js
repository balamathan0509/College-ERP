import React from 'react';

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
