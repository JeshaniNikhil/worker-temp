import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  CheckCircle, XCircle, AlertTriangle, Briefcase, RefreshCw, TrendingUp,
  Camera, Phone, Mail, ShieldCheck, UserCheck
} from 'lucide-react';

const FacebookIcon = ({ size = 20, color = '#1877f2', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const API_BASE_URL = '/api';

const StatCard = ({ title, value, color, icon: Icon, sub }) => (
  <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
    <div>
      <div className="stat-title">{title}</div>
      <div className="stat-value" style={{ color }}>{(value ?? 0).toLocaleString()}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>{sub}</div>}
    </div>
    <div style={{ background: `${color}15`, borderRadius: 10, padding: 10 }}>
      {typeof Icon === 'function' ? <Icon color={color} size={22} /> : <Icon color={color} size={22} />}
    </div>
  </div>
);

const SocialStatCard = ({ title, activeCount, totalCount, color, icon: Icon, platformLabel }) => {
  const pct = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0;
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: `${color}15`, borderRadius: 8, padding: 6, display: 'flex' }}>
            <Icon size={18} color={color} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{title}</span>
        </div>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color, background: `${color}15`, padding: '2px 8px', borderRadius: 20 }}>
          {pct}% Active
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
        <div>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{activeCount.toLocaleString()}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: 4 }}>active</span>
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{totalCount.toLocaleString()} verified</span>
      </div>

      <div style={{ background: 'var(--border-color)', height: 6, borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ background: color, height: '100%', width: `${pct}%`, transition: 'width 0.5s ease', borderRadius: 6 }} />
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jobsFilter, setJobsFilter] = useState('ALL');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, jobsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/validation/jobs/stats`),
        axios.get(`${API_BASE_URL}/validation/jobs?limit=10`),
      ]);
      setStats(statsRes.data);
      setRecentJobs(jobsRes.data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredJobs = jobsFilter === 'ALL'
    ? recentJobs
    : recentJobs.filter(j => j.status === jobsFilter);

  const statusBadge = (status) => {
    const map = {
      COMPLETED: { cls: 'badge-success', label: 'Completed' },
      FAILED: { cls: 'badge-danger', label: 'Failed' },
      PROCESSING: { cls: 'badge-warning', label: 'Processing' },
      PENDING: { cls: 'badge-warning', label: 'Pending' },
      PAUSED: { cls: 'badge-info', label: 'Paused' },
      TERMINATED: { cls: 'badge-unknown', label: 'Terminated' },
    };
    const cfg = map[status] || { cls: 'badge-unknown', label: status };
    return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
  };

  return (
    <div className="animate-fade-in">
      
      {/* Header with Wolf Group Logo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src="/wolf_logo.svg" alt="Wolf Group Logo" style={{ width: 44, height: 44 }} />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Wolf Group Verifier Dashboard</h1>
            <p style={{ color: 'var(--text-secondary)', margin: '2px 0 0', fontSize: '0.88rem' }}>
              Real-time analytics across Email, Facebook, Instagram, WhatsApp, and LinkedIn verifiers
            </p>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} />
          Refresh Stats
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
          <p>Loading analytics…</p>
        </div>
      ) : (
        <>
          {/* Email Stats grid */}
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.9rem', color: 'var(--text-primary)' }}>Email Verification Overview</h2>
          <div className="grid grid-cols-4" style={{ marginBottom: '1.75rem' }}>
            <StatCard
              title="Total Jobs"
              value={stats?.total_jobs}
              color="var(--primary-color)"
              icon={Briefcase}
              sub={`${(stats?.total_records || 0).toLocaleString()} total records processed`}
            />
            <StatCard
              title="Deliverable Emails"
              value={stats?.total_valid}
              color="#10b981"
              icon={CheckCircle}
              sub="Confirmed SMTP Mailbox"
            />
            <StatCard
              title="Invalid Emails"
              value={stats?.total_invalid}
              color="#ef4444"
              icon={XCircle}
              sub="Rejected Mailboxes"
            />
            <StatCard
              title="Catch-All / Risky"
              value={(stats?.total_catchall || 0) + (stats?.total_unknown || 0)}
              color="#f59e0b"
              icon={AlertTriangle}
              sub="Unverifiable or Risky"
            />
          </div>

          {/* Social Media Verifier Overview Section */}
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.9rem', color: 'var(--text-primary)' }}>Social Media Account Existence Stats</h2>
          <div className="grid grid-cols-4" style={{ marginBottom: '2rem' }}>
            <SocialStatCard
              title="Facebook Verifier"
              activeCount={stats?.facebook_active || 0}
              totalCount={stats?.facebook_total || 0}
              color="#1877f2"
              icon={FacebookIcon}
              platformLabel="Facebook"
            />
            <SocialStatCard
              title="Instagram Verifier"
              activeCount={stats?.instagram_active || 0}
              totalCount={stats?.instagram_total || 0}
              color="#e1306c"
              icon={Camera}
              platformLabel="Instagram"
            />
            <SocialStatCard
              title="WhatsApp Verifier"
              activeCount={stats?.whatsapp_active || 0}
              totalCount={stats?.whatsapp_total || 0}
              color="#25d366"
              icon={Phone}
              platformLabel="WhatsApp"
            />
            <SocialStatCard
              title="LinkedIn Verifier"
              activeCount={stats?.linkedin_active || 0}
              totalCount={stats?.linkedin_total || 0}
              color="#0077b5"
              icon={Briefcase}
              platformLabel="LinkedIn"
            />
          </div>

          {/* Recent jobs section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Recent Bulk Validation Jobs</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                className="form-control"
                value={jobsFilter}
                onChange={e => setJobsFilter(e.target.value)}
                style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
              >
                <option value="ALL">All Status</option>
                <option value="COMPLETED">Completed</option>
                <option value="PROCESSING">Processing</option>
                <option value="PAUSED">Paused</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
                <option value="TERMINATED">Terminated</option>
              </select>
              <Link to="/results" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
                View All Jobs
              </Link>
              <Link to="/validate" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
                + New Bulk Job
              </Link>
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Valid Email</th>
                  <th>Invalid Email</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      No jobs found. <Link to="/validate">Upload a file</Link> to start validation.
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map(job => (
                    <tr key={job.id}>
                      <td style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {job.filename}
                      </td>
                      <td>{statusBadge(job.status)}</td>
                      <td style={{ minWidth: 100 }}>
                        {job.total_records > 0
                          ? `${job.processed_records} / ${job.total_records}`
                          : '—'}
                      </td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>{job.valid_count}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{job.invalid_count}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Date(job.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <Link to={`/results/${job.id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem' }}>
                          View Results
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Dashboard;
