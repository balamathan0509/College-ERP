import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import DateTimeHeader from '../../components/DateTimeHeader';
import { FileText, Calendar, CheckSquare, Settings, Activity, BookOpen, Clock, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db, collection, query, getDocs } from '../../supabase/supabaseAdapter';

export default function ExamCellDashboard() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [stats, setStats] = useState({ schedules: 0, attendance: 0 });

  useEffect(() => {
    async function fetchStats() {
      try {
        const schQ = query(collection(db, "cia_exam_schedules"));
        const schSnap = await getDocs(schQ);
        setStats(prev => ({ ...prev, schedules: schSnap.size || 0 }));
      } catch (err) {
        console.error(err);
      }
    }
    fetchStats();
  }, []);

  const quickActions = [
    { label: 'Exam Creation', icon: <Settings size={28} color='#6366f1'/>, path: '/cia/exam-creation', desc: 'Create and manage new exams' },
    { label: 'Schedule Exam', icon: <Calendar size={28} color='#10b981'/>, path: '/cia/schedule', desc: 'Schedule exams for subjects' },
    { label: 'Mark Attendance', icon: <CheckSquare size={28} color='#f59e0b'/>, path: '/cia/attendance', desc: 'Mark attendance for scheduled exams' },
    { label: 'CIA Reports', icon: <FileText size={28} color='#ef4444'/>, path: '/cia/reports', desc: 'View overall CIA reports' }
  ];

  return (
    <div className='dashboard-wrapper'>
      <Sidebar />
      <main className='main-content'>
        <DateTimeHeader />
        
        {/* Professional Header */}
        <div style={{
          marginTop: '24px',
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '16px'
        }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '600', color: 'var(--text-dark)' }}>
              Exam Cell Operations
            </h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
              Overview and management of continuous internal assessments.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <span style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%', display: 'inline-block' }}></span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#10b981' }}>SYSTEM ACTIVE</span>
          </div>
        </div>

        {/* Professional Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div className="card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
            <div>
              <p style={{ margin: '0 0 8px 0', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Active Schedules</p>
              <h3 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--text-dark)' }}>{stats.schedules}</h3>
            </div>
            <div style={{ background: 'rgba(37, 99, 235, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
              <Calendar size={24} color="#2563eb" />
            </div>
          </div>
          
          <div className="card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
            <div>
              <p style={{ margin: '0 0 8px 0', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Attendance Entries</p>
              <h3 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--text-dark)' }}>--</h3>
            </div>
            <div style={{ background: 'rgba(37, 99, 235, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
              <CheckSquare size={24} color="#2563eb" />
            </div>
          </div>

          <div className="card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
            <div>
              <p style={{ margin: '0 0 8px 0', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Question Papers</p>
              <h3 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--text-dark)' }}>--</h3>
            </div>
            <div style={{ background: 'rgba(37, 99, 235, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
              <BookOpen size={24} color="#2563eb" />
            </div>
          </div>
        </div>

        {/* Professional Quick Actions */}
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: 'var(--text-dark)' }}>
          Modules
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {quickActions.map(action => (
            <div 
              key={action.label} 
              onClick={() => navigate(action.path)} 
              className="card hover-elevate"
              style={{ 
                padding: '20px', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '16px', 
                border: '1px solid var(--border-color)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center',
                alignItems: 'center',
                width: '48px',
                height: '48px',
                background: 'rgba(37, 99, 235, 0.1)', 
                border: '1px solid rgba(37, 99, 235, 0.2)',
                borderRadius: '8px'
              }}>
                {React.cloneElement(action.icon, { color: '#2563eb', size: 22 })}
              </div>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>{action.label}</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{action.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}