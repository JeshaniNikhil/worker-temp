import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CheckCircle, Server, LogOut, User, ChevronDown,
  Camera, Briefcase, Phone, Upload
} from 'lucide-react';
import axios from 'axios';

const FacebookIcon = ({ size = 14, color = '#1877f2', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

import Dashboard from './pages/Dashboard';
import ValidationUpload from './pages/ValidationUpload';
import SingleValidation from './pages/SingleValidation';
import ValidationResults from './pages/ValidationResults';
import Login from './pages/Login';
import Register from './pages/Register';

// ── Auth helpers ──────────────────────────────────────────────────────────
const getStoredToken = () => localStorage.getItem('token');

const setAxiosAuth = (token) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
};


// ── Protected route wrapper ───────────────────────────────────────────────
const ProtectedRoute = ({ children, user }) => {
  if (!user) return <Navigate to="/login" replace />;
  return children;
};


// ── Sidebar nav ───────────────────────────────────────────────────────────
const Sidebar = ({ user, onLogout }) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { divider: 'Verification' },
    { to: '/verify-single', icon: CheckCircle, label: 'Single Verifier' },
    { to: '/validate', icon: Upload, label: 'Bulk Upload' },
    { to: '/results', icon: Server, label: 'Validation Jobs' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.25rem 1.25rem' }}>
        <img src="/wolf_logo.svg" alt="Wolf Group Logo" style={{ width: 38, height: 38, objectFit: 'contain', borderRadius: 8, background: '#f8fafc', padding: 4, border: '1px solid #e2e8f0' }} />
        <div>
          <h2 style={{ fontSize: '1rem', lineHeight: 1.2, margin: 0, fontWeight: 800, color: 'var(--text-primary)' }}>Wolf Group</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 600 }}>Data Verifier</span>
        </div>
      </div>

      <nav className="sidebar-nav" style={{ flex: 1 }}>
        {navItems.map((item, i) => {
          if (item.divider) return (
            <div key={i} style={{
              padding: '1.25rem 1.5rem 0.5rem',
              fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--text-secondary)',
            }}>
              {item.divider}
            </div>
          );
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon className="nav-icon" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        {/* Social verification indicator */}
        <div style={{
          margin: '1.5rem 1.5rem 0.5rem',
          padding: '0.75rem',
          background: 'rgba(249,115,22,0.06)',
          border: '1px solid rgba(249,115,22,0.15)',
          borderRadius: 8,
          fontSize: '0.72rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 600, color: 'var(--primary-color)', marginBottom: 4 }}>Also verifies:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span><FacebookIcon size={11} style={{ marginRight: 4, color: '#1877f2' }} />Facebook profiles</span>
            <span><Camera size={11} style={{ marginRight: 4, color: '#e1306c', verticalAlign: 'middle' }} />Instagram profiles</span>
            <span><Briefcase size={11} style={{ marginRight: 4, color: '#0077b5', verticalAlign: 'middle' }} />LinkedIn profiles</span>
            <span><Phone size={11} style={{ marginRight: 4, color: '#25d366', verticalAlign: 'middle' }} />WhatsApp numbers</span>
          </div>
        </div>
      </nav>

      {/* User section at bottom */}
      <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
        <div
          onClick={() => setUserMenuOpen(s => !s)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            padding: '0.6rem 0.75rem', borderRadius: 8,
            background: userMenuOpen ? 'rgba(249,115,22,0.08)' : 'transparent',
            transition: 'background 0.15s',
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
          }}>
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.username || 'User'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Logged in</div>
          </div>
          <ChevronDown size={14} color="var(--text-secondary)" style={{ transform: userMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>

        {userMenuOpen && (
          <div style={{ marginTop: 4, background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              onClick={onLogout}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '0.65rem 0.75rem', background: 'none', border: 'none',
                cursor: 'pointer', color: '#ef4444', fontSize: '0.82rem', fontWeight: 500,
              }}
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};


// ── Main App ──────────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Restore session from stored token
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      setAxiosAuth(token);
      axios.get('/api/auth/me')
        .then(res => {
          setUser(res.data);
          setAuthLoading(false);
        })
        .catch(() => {
          localStorage.removeItem('token');
          setAxiosAuth(null);
          setAuthLoading(false);
        });
    } else {
      setAuthLoading(false);
    }
  }, []);

  const handleLogin = (userData, token) => {
    setUser(userData);
    setAxiosAuth(token);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setAxiosAuth(null);
    setUser(null);
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '0.875rem' }}>Loading…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register onLogin={handleLogin} />} />

        {/* Protected app routes */}
        <Route path="/*" element={
          <ProtectedRoute user={user}>
            <div className="app-container">
              <Sidebar user={user} onLogout={handleLogout} />
              <main className="main-content">
                <div className="page-content">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/verify-single" element={<SingleValidation />} />
                    <Route path="/validate" element={<ValidationUpload />} />
                    <Route path="/results" element={<ValidationResults />} />
                    <Route path="/results/:jobId" element={<ValidationResults />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </div>
              </main>
            </div>
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
