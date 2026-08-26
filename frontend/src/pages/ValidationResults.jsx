import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Download, RefreshCw, ArrowLeft, CheckCircle, XCircle,
  AlertTriangle, HelpCircle, ChevronDown, Search, Filter,
  Clock, BarChart2, AlertCircle, Wifi, WifiOff
} from 'lucide-react';

const API_BASE_URL = '/api';

// Poll interval while job is running (ms)
const LIVE_POLL_INTERVAL = 2500;

// ── Status badge config ────────────────────────────────────────────────────
const STATUS_CFG = {
  DELIVERABLE:       { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', label: '✅ DELIVERABLE',       icon: CheckCircle },
  'NOT DELIVERABLE': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  label: '❌ NOT DELIVERABLE',   icon: XCircle },
  NOT_DELIVERABLE:   { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  label: '❌ NOT DELIVERABLE',   icon: XCircle },
  CATCH_ALL:         { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', label: '⚠️ CATCH-ALL',          icon: AlertTriangle },
  RISKY:             { color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.35)', label: '🟠 RISKY',              icon: AlertTriangle },
  UNKNOWN:           { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)', label: '❓ UNKNOWN',            icon: HelpCircle },
};

const getStatusCfg = (status) =>
  STATUS_CFG[status] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)', label: status, icon: HelpCircle };

// ── StatusBadge ───────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = getStatusCfg(status);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
};

// ── Animated progress bar ──────────────────────────────────────────────────
const ProgressBar = ({ pct, color = '#6366f1' }) => (
  <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, height: 8, overflow: 'hidden' }}>
    <div style={{
      height: '100%', borderRadius: 8,
      background: `linear-gradient(90deg, ${color}, ${color}aa)`,
      width: `${Math.min(pct, 100)}%`,
      transition: 'width 0.6s ease',
      boxShadow: `0 0 8px ${color}66`,
    }} />
  </div>
);

// ── Stat card ─────────────────────────────────────────────────────────────
const StatCard = ({ title, value, color, sub }) => (
  <div style={{
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, padding: '1.1rem 1.3rem',
    display: 'flex', flexDirection: 'column', gap: 4,
  }}>
    <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.4)' }}>{title}</div>
    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: color || 'white', lineHeight: 1.1 }}>{value ?? '—'}</div>
    {sub && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>{sub}</div>}
  </div>
);

// ── Jobs list page ─────────────────────────────────────────────────────────
const JobsList = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API_BASE_URL}/validation/jobs`)
      .then(r => { setJobs(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,0.4)' }}>
      <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
      <p>Loading jobs…</p>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Validation Jobs</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.4rem 0 0' }}>History of all bulk email validation jobs</p>
        </div>
        <Link to="/upload" className="btn btn-primary">+ New Job</Link>
      </div>

      {jobs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          No validation jobs yet. <Link to="/upload">Upload a CSV</Link> to start.
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Status</th>
                <th>Progress</th>
                <th>✅ Valid</th>
                <th>❌ Invalid</th>
                <th>⚠️ Catch-All</th>
                <th>❓ Unknown</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => {
                const pct = j.total_records > 0 ? Math.round((j.processed_records / j.total_records) * 100) : 0;
                const isRunning = j.status === 'PROCESSING' || j.status === 'PENDING';
                return (
                  <tr key={j.id}>
                    <td style={{ fontWeight: 600 }}>{j.filename}</td>
                    <td>
                      <span className={`badge badge-${j.status === 'COMPLETED' ? 'success' : j.status === 'FAILED' ? 'danger' : 'warning'}`}>
                        {isRunning && <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite', marginRight: 4 }} />}
                        {j.status}
                      </span>
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <div style={{ fontSize: '0.8rem', marginBottom: 4, color: 'var(--text-secondary)' }}>
                        {j.processed_records} / {j.total_records} ({pct}%)
                      </div>
                      <ProgressBar pct={pct} color={j.status === 'COMPLETED' ? '#10b981' : '#6366f1'} />
                    </td>
                    <td style={{ color: '#10b981', fontWeight: 700 }}>{j.valid_count}</td>
                    <td style={{ color: '#ef4444', fontWeight: 700 }}>{j.invalid_count}</td>
                    <td style={{ color: '#f59e0b', fontWeight: 700 }}>{j.disposable_count}</td>
                    <td style={{ color: '#94a3b8', fontWeight: 700 }}>{j.unknown_count}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {new Date(j.created_at).toLocaleString()}
                    </td>
                    <td>
                      <Link to={`/results/${j.id}`} className="btn btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};


// ── Job detail / live results page ─────────────────────────────────────────
const JobDetail = ({ jobId }) => {
  const [job, setJob] = useState(null);
  const [results, setResults] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLive, setIsLive] = useState(false);
  const intervalRef = useRef(null);
  const lastResultIdRef = useRef(0);

  // Fetch job status + new results since last poll
  const fetchJobData = useCallback(async () => {
    try {
      const [jobRes, resultsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/validation/jobs/${jobId}`),
        axios.get(`${API_BASE_URL}/validation/jobs/${jobId}/results?skip=0&limit=2000`),
      ]);
      setJob(jobRes.data);
      setResults(resultsRes.data);
      setLoading(false);

      const isRunning = jobRes.data.status === 'PROCESSING' || jobRes.data.status === 'PENDING';
      setIsLive(isRunning);

      // Stop polling when done
      if (!isRunning && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch {
      setLoading(false);
    }
  }, [jobId]);

  // Start / manage polling interval
  useEffect(() => {
    fetchJobData();
    axios.get(`${API_BASE_URL}/templates/`)
      .then(r => setTemplates(r.data))
      .catch(() => {});

    // Start polling — it auto-stops when job completes
    intervalRef.current = setInterval(fetchJobData, LIVE_POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchJobData]);

  useEffect(() => {
    if (selectedTemplateId) {
      setSelectedTemplate(templates.find(t => t.id === parseInt(selectedTemplateId)) || null);
    } else {
      setSelectedTemplate(null);
    }
  }, [selectedTemplateId, templates]);

  const handleDownload = () => {
    let url = `${API_BASE_URL}/validation/jobs/${jobId}/download`;
    if (selectedTemplateId) url += `?template_id=${selectedTemplateId}`;
    window.location.href = url;
  };

  const renderPersonalized = (text, rowData) => {
    if (!text) return '';
    let out = text;
    Object.keys(rowData).forEach(k => { out = out.replace(new RegExp(`{{${k}}}`, 'g'), rowData[k] || ''); });
    return out;
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,0.4)' }}>
      <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
      <p>Loading job…</p>
    </div>
  );

  if (!job) return (
    <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
      Job not found. <Link to="/results">← Back to jobs</Link>
    </div>
  );

  const pct = job.total_records > 0 ? Math.round((job.processed_records / job.total_records) * 100) : 0;
  const isRunning = job.status === 'PROCESSING' || job.status === 'PENDING';

  const filteredResults = results.filter(r => {
    const matchSearch = !searchTerm ||
      r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(r.original_data).toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const csvHeaders = results.length > 0 ? Object.keys(results[0].original_data) : [];

  // Count by status for summary
  const countByStatus = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="animate-fade-in">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes rowIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .live-row { animation: rowIn 0.3s ease both; }
        .live-indicator {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.35);
          color: #818cf8; border-radius: 20px; padding: 4px 12px;
          font-size: 0.78rem; font-weight: 600;
        }
        .live-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #818cf8;
          animation: pulse 1.2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <Link to="/results" style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={20} />
        </Link>
        <h1 style={{ margin: 0 }}>{job.filename}</h1>
        {isRunning && (
          <span className="live-indicator">
            <span className="live-dot" />
            LIVE — processing…
          </span>
        )}
        {!isRunning && job.status === 'COMPLETED' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', borderRadius: 20, padding: '4px 12px', fontSize: '0.78rem', fontWeight: 700 }}>
            ✅ COMPLETED
          </span>
        )}
        {job.status === 'FAILED' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 20, padding: '4px 12px', fontSize: '0.78rem', fontWeight: 700 }}>
            ❌ FAILED
          </span>
        )}
      </div>

      {/* Progress bar (shows during processing) */}
      {isRunning && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
              Processing… {job.processed_records} of {job.total_records} emails
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#818cf8' }}>{pct}%</span>
          </div>
          <ProgressBar pct={pct} color="#6366f1" />
          <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', display: 'flex', gap: 16 }}>
            <span>✅ {job.valid_count} deliverable</span>
            <span>❌ {job.invalid_count} invalid</span>
            <span>⚠️ {job.disposable_count} catch-all</span>
            <span>❓ {job.unknown_count} risky/unknown</span>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard title="Status" value={job.status} color={job.status === 'COMPLETED' ? '#10b981' : job.status === 'FAILED' ? '#ef4444' : '#f59e0b'} />
        <StatCard title="Progress" value={`${job.processed_records}/${job.total_records}`} color="white" sub={`${pct}% done`} />
        <StatCard title="Deliverable" value={job.valid_count} color="#10b981" />
        <StatCard title="Invalid" value={job.invalid_count} color="#ef4444" />
        <StatCard title="Catch-All" value={job.disposable_count} color="#f59e0b" sub="Domain accepts all" />
        <StatCard title="Risky/Unknown" value={job.unknown_count} color="#94a3b8" />
      </div>

      {/* Results table */}
      <div className="card">
        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search email or data…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.2rem', width: 230 }}
              />
            </div>

            {/* Status filter */}
            <div style={{ position: 'relative' }}>
              <Filter size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
              <select
                className="form-control"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ paddingLeft: '2.2rem', width: 190, appearance: 'none' }}
              >
                <option value="ALL">All Statuses ({results.length})</option>
                <option value="DELIVERABLE">✅ Deliverable ({countByStatus['DELIVERABLE'] || 0})</option>
                <option value="CATCH_ALL">⚠️ Catch-All ({countByStatus['CATCH_ALL'] || 0})</option>
                <option value="RISKY">🟠 Risky ({countByStatus['RISKY'] || 0})</option>
                <option value="NOT DELIVERABLE">❌ Not Deliverable ({(countByStatus['NOT DELIVERABLE'] || 0) + (countByStatus['NOT_DELIVERABLE'] || 0)})</option>
                <option value="UNKNOWN">❓ Unknown ({countByStatus['UNKNOWN'] || 0})</option>
              </select>
            </div>

            {/* Template picker */}
            {templates.length > 0 && (
              <select
                className="form-control"
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
                style={{ width: 200 }}
              >
                <option value="">Apply Template…</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}

            {/* Live indicator in toolbar */}
            {isRunning && (
              <span className="live-indicator">
                <span className="live-dot" />
                {results.length} loaded
              </span>
            )}
          </div>

          <button
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={results.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={16} />
            {isRunning ? `Download (${results.length} so far)` : 'Download CSV'}
          </button>
        </div>

        {/* Table */}
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ minWidth: 40 }}>#</th>
                {csvHeaders.map(h => <th key={h}>{h}</th>)}
                <th style={{ minWidth: 160 }}>Email Status</th>
                <th style={{ minWidth: 280 }}>Validation Reason</th>
                {selectedTemplate && <th style={{ minWidth: 220 }}>Personalized Content</th>}
              </tr>
            </thead>
            <tbody>
              {filteredResults.length === 0 && !isRunning && (
                <tr>
                  <td colSpan={csvHeaders.length + 3 + (selectedTemplate ? 1 : 0)} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    {results.length === 0 ? 'No results yet — validation is starting…' : 'No results match your filters.'}
                  </td>
                </tr>
              )}
              {filteredResults.map((r, idx) => (
                <tr key={r.id} className="live-row" style={{ animationDelay: `${Math.min(idx, 20) * 30}ms` }}>
                  <td style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem' }}>{idx + 1}</td>
                  {csvHeaders.map(h => (
                    <td key={h} style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.original_data[h]}>
                      {r.original_data[h]}
                    </td>
                  ))}
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{r.reason}</td>
                  {selectedTemplate && (
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={renderPersonalized(selectedTemplate.body_text, r.original_data)}>
                      {renderPersonalized(selectedTemplate.body_text, r.original_data)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom summary */}
        {filteredResults.length > 0 && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 0', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <span>Showing {filteredResults.length} of {results.length} results</span>
            {isRunning && <span style={{ color: '#818cf8' }}>⚡ Updating live every {LIVE_POLL_INTERVAL / 1000}s</span>}
          </div>
        )}
      </div>
    </div>
  );
};


// ── Root component ─────────────────────────────────────────────────────────
const ValidationResults = () => {
  const { jobId } = useParams();
  return jobId ? <JobDetail jobId={jobId} /> : <JobsList />;
};

export default ValidationResults;
