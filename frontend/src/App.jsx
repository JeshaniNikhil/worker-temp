import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, CheckCircle, Mail, Settings, Server } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import ValidationUpload from './pages/ValidationUpload';
import SingleValidation from './pages/SingleValidation';
import ValidationResults from './pages/ValidationResults';
import TemplateList from './pages/TemplateList';
import TemplateEditor from './pages/TemplateEditor';

function App() {
  return (
    <Router>
      <div className="app-container">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>MailPlatform</h2>
          </div>
          <nav className="sidebar-nav">
            <NavLink to="/" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} end>
              <LayoutDashboard className="nav-icon" />
              <span>Dashboard</span>
            </NavLink>
            <div className="nav-item" style={{ pointerEvents: 'none', opacity: 0.5, marginTop: '1rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>
              Email Validator
            </div>
            <NavLink to="/verify-single" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <CheckCircle className="nav-icon" />
              <span>Verify Single Email</span>
            </NavLink>
            <NavLink to="/validate" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Server className="nav-icon" />
              <span>Upload CSV</span>
            </NavLink>
            <NavLink to="/results" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Server className="nav-icon" />
              <span>Validation Jobs</span>
            </NavLink>
            
            <div className="nav-item" style={{ pointerEvents: 'none', opacity: 0.5, marginTop: '1rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>
              Templates
            </div>
            <NavLink to="/templates" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} end>
              <Mail className="nav-icon" />
              <span>Saved Templates</span>
            </NavLink>
            <NavLink to="/templates/new" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Mail className="nav-icon" />
              <span>Create Template</span>
            </NavLink>
          </nav>
        </aside>
        
        <main className="main-content">
          <header className="topbar">
            {/* Topbar content like user profile can go here */}
          </header>
          <div className="page-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/verify-single" element={<SingleValidation />} />
              <Route path="/validate" element={<ValidationUpload />} />
              <Route path="/results" element={<ValidationResults />} />
              <Route path="/results/:jobId" element={<ValidationResults />} />
              <Route path="/templates" element={<TemplateList />} />
              <Route path="/templates/new" element={<TemplateEditor />} />
              <Route path="/templates/:id" element={<TemplateEditor />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
