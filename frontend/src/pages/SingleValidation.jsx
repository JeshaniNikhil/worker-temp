import React, { useState } from 'react';
import axios from 'axios';
import {
  Search, CheckCircle, XCircle, AlertTriangle, Info,
  ShieldCheck, ShieldAlert, ShieldX, Loader2,
  AtSign, Globe, Server, Mail, Eye, Zap, Clock,
  Hash, SkipForward, Shield,
} from 'lucide-react';

const API_BASE_URL = '/api';

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  PASS:    { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', icon: CheckCircle,   label: 'Pass'    },
  FAIL:    { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  icon: XCircle,       label: 'Fail'    },
  WARNING: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', icon: AlertTriangle, label: 'Warning' },
  INFO:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.35)', icon: Info,          label: 'Info'    },
  SKIP:    { color: '#6b7280', bg: 'rgba(107,114,128,0.10)', border: 'rgba(107,114,128,0.3)', icon: SkipForward,  label: 'Skipped' },
};

const OVERALL_CONFIG = {
  VALID:   { color: '#10b981', label: 'Valid', icon: ShieldCheck },
  RISKY:   { color: '#f59e0b', label: 'Risky', icon: ShieldAlert },
  INVALID: { color: '#ef4444', label: 'Invalid', icon: ShieldX   },
};

// ─── Check icons map ──────────────────────────────────────────────────────────
const CHECK_ICONS = {
  'Syntax':               AtSign,
  'Domain Existence':     Globe,
  'MX Record':            Server,
  'A Record':             Hash,
  'Disposable Domain':    XCircle,
  'Free Email Provider':  Mail,
  'Role Account':         Eye,
  'Typo Detection':       Search,
  'Domain Age/Reputation': Shield,
  'DNS Health':           Zap,
  'Email Normalization':  CheckCircle,
  'Risk Scoring':         ShieldCheck,
};

// ─── Risk Gauge ──────────────────────────────────────────────────────────────
const RiskGauge = ({ score, label }) => {
  const radius = 68;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score, 100) / 100;
  const offset = circumference - pct * circumference;

  const getColor = () => {
    if (score <= 20) return '#10b981';
    if (score <= 45) return '#f59e0b';
    if (score <= 70) return '#f97316';
    return '#ef4444';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={160} height={160} viewBox="0 0 160 160">
        {/* Track */}
        <circle
          cx={80} cy={80} r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={80} cy={80} r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 80 80)"
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease', filter: `drop-shadow(0 0 8px ${getColor()})` }}
        />
        {/* Score text */}
        <text x={80} y={74} textAnchor="middle" fill="white" fontSize={30} fontWeight="700" fontFamily="Inter,sans-serif">
          {score}
        </text>
        <text x={80} y={95} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={11} fontFamily="Inter,sans-serif">
          Risk Score
        </text>
      </svg>
      <span style={{ fontSize: 13, fontWeight: 600, color: getColor() }}>{label}</span>
    </div>
  );
};

// ─── Check Card ───────────────────────────────────────────────────────────────
const CheckCard = ({ check, index }) => {
  const cfg = STATUS_CONFIG[check.status] || STATUS_CONFIG.INFO;
  const StatusIcon = cfg.icon;
  const CheckIcon = CHECK_ICONS[check.name] || Info;

  return (
    <div
      className="check-card"
      style={{
        '--card-color': cfg.color,
        '--card-bg': cfg.bg,
        '--card-border': cfg.border,
        animationDelay: `${index * 60}ms`,
      }}
    >
      <div className="check-card-left">
        <div className="check-icon-wrap" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
          <CheckIcon size={16} color={cfg.color} />
        </div>
        <div className="check-info">
          <span className="check-number">#{index + 1}</span>
          <span className="check-name">{check.name}</span>
          <span className="check-detail">{check.detail}</span>
          {check.score !== undefined && (
            <span className="check-score-badge" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
              Score: {check.score}/100
            </span>
          )}
        </div>
      </div>
      <div className="check-status-badge" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
        <StatusIcon size={13} />
        <span>{cfg.label}</span>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const SingleValidation = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleValidate = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address format (e.g. name@domain.com)');
      return;
    }
    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/validation/deep`, { email });
      setResult(response.data);
    } catch (err) {
      let errMsg = 'An error occurred during validation.';
      if (err.response?.data?.detail) {
        errMsg = typeof err.response.data.detail === 'string'
          ? err.response.data.detail
          : err.response.data.detail[0]?.msg || errMsg;
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const overall = result ? OVERALL_CONFIG[result.overall_status] || OVERALL_CONFIG.RISKY : null;
  // Separate risk scoring from display checks
  const displayChecks = result ? result.checks.filter(c => c.name !== 'Risk Scoring') : [];
  const riskCheck   = result ? result.checks.find(c => c.name === 'Risk Scoring') : null;

  const passCount    = displayChecks.filter(c => c.status === 'PASS').length;
  const failCount    = displayChecks.filter(c => c.status === 'FAIL').length;
  const warnCount    = displayChecks.filter(c => c.status === 'WARNING').length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        .sv-page {
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          background: #0a0f1e;
          padding: 2rem 1.5rem 4rem;
          color: #e2e8f0;
        }

        .sv-header {
          text-align: center;
          margin-bottom: 2.5rem;
        }
        .sv-header h1 {
          font-size: 2.2rem;
          font-weight: 800;
          background: linear-gradient(135deg, #818cf8, #c084fc, #38bdf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0 0 0.5rem;
        }
        .sv-header p {
          color: rgba(255,255,255,0.45);
          font-size: 0.95rem;
          margin: 0;
        }

        .sv-search-card {
          max-width: 680px;
          margin: 0 auto 2rem;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 16px;
          padding: 1.75rem;
          backdrop-filter: blur(16px);
        }

        .sv-form {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }
        @media (max-width: 560px) { .sv-form { flex-direction: column; } }

        .sv-input-wrap {
          flex: 1;
          position: relative;
        }
        .sv-input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.3);
          pointer-events: none;
        }
        .sv-input {
          width: 100%;
          padding: 0.85rem 1rem 0.85rem 2.75rem;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          color: #f0f4ff;
          font-size: 0.95rem;
          font-family: 'Inter', sans-serif;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .sv-input:focus {
          border-color: rgba(129,140,248,0.6);
          box-shadow: 0 0 0 3px rgba(129,140,248,0.12);
        }
        .sv-input::placeholder { color: rgba(255,255,255,0.28); }

        .sv-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 0.85rem 1.6rem;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none; border-radius: 10px;
          color: white; font-size: 0.9rem; font-weight: 600;
          cursor: pointer; white-space: nowrap;
          font-family: 'Inter', sans-serif;
          transition: opacity 0.2s, transform 0.15s;
          box-shadow: 0 4px 18px rgba(99,102,241,0.35);
        }
        .sv-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sv-btn:not(:disabled):hover { transform: translateY(-1px); opacity: 0.92; }

        .sv-error {
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 8px;
          color: #fca5a5;
          font-size: 0.875rem;
        }

        .sv-loading {
          display: flex; flex-direction: column;
          align-items: center; gap: 1rem;
          padding: 3rem 0;
          color: rgba(255,255,255,0.5);
        }
        .sv-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Results Layout ── */
        .sv-results {
          max-width: 940px;
          margin: 0 auto;
          animation: fadeUp 0.4s ease;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .sv-summary-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 1.25rem;
          margin-bottom: 1.5rem;
          align-items: stretch;
        }
        @media (max-width: 720px) { .sv-summary-row { grid-template-columns: 1fr; } }

        .sv-overall-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 16px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.5rem;
        }
        .sv-overall-label {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255,255,255,0.4);
        }
        .sv-overall-status {
          display: flex; align-items: center; gap: 10px;
          font-size: 1.8rem; font-weight: 800;
        }
        .sv-overall-email {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.5);
          font-family: 'Courier New', monospace;
          word-break: break-all;
        }

        .sv-stats {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          justify-content: center;
        }
        .sv-stat-row {
          display: flex; align-items: center; gap: 8px;
          font-size: 0.875rem;
        }
        .sv-stat-dot {
          width: 10px; height: 10px; border-radius: 50%;
          flex-shrink: 0;
        }
        .sv-stat-num { font-weight: 700; font-size: 1rem; }

        .sv-gauge-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 16px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .sv-timing {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.78rem;
          color: rgba(255,255,255,0.35);
          margin-top: 0.25rem;
        }

        /* ── Checks grid ── */
        .checks-section-title {
          font-size: 0.78rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255,255,255,0.35);
          margin: 0 0 0.75rem;
        }

        .checks-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }
        @media (max-width: 600px) { .checks-grid { grid-template-columns: 1fr; } }

        .check-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 1rem 1.1rem;
          animation: cardIn 0.35s ease both;
          transition: border-color 0.2s, background 0.2s;
        }
        .check-card:hover {
          background: rgba(255,255,255,0.06);
          border-color: var(--card-border);
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .check-card-left {
          display: flex; align-items: flex-start; gap: 10px; flex: 1; min-width: 0;
        }
        .check-icon-wrap {
          width: 34px; height: 34px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; margin-top: 1px;
        }
        .check-info {
          display: flex; flex-direction: column; gap: 2px; min-width: 0;
        }
        .check-number {
          font-size: 0.68rem;
          color: rgba(255,255,255,0.3);
          font-weight: 500;
        }
        .check-name {
          font-size: 0.9rem;
          font-weight: 600;
          color: rgba(255,255,255,0.92);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .check-detail {
          font-size: 0.78rem;
          color: rgba(255,255,255,0.45);
          line-height: 1.4;
          word-break: break-word;
        }
        .check-score-badge {
          display: inline-flex;
          align-items: center;
          margin-top: 4px;
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 0.72rem;
          font-weight: 600;
          width: fit-content;
        }
        .check-status-badge {
          display: flex; align-items: center; gap: 5px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.73rem;
          font-weight: 600;
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* ── Normalized email banner ── */
        .sv-norm-banner {
          background: rgba(96,165,250,0.08);
          border: 1px solid rgba(96,165,250,0.25);
          border-radius: 10px;
          padding: 0.85rem 1.1rem;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.85rem;
          color: rgba(255,255,255,0.7);
          margin-bottom: 1.5rem;
        }
        .sv-norm-banner strong { color: #93c5fd; font-family: 'Courier New', monospace; }
      `}</style>

      <div className="sv-page">
        {/* Header */}
        <div className="sv-header">
          <h1>Email Deep Validator</h1>
          <p>12-point analysis — Syntax · DNS · Reputation · Risk Score — No Port 25 required</p>
        </div>

        {/* Search Card */}
        <div className="sv-search-card">
          <form onSubmit={handleValidate} className="sv-form">
            <div className="sv-input-wrap">
              <AtSign className="sv-input-icon" size={18} />
              <input
                id="email-input"
                type="text"
                className="sv-input"
                placeholder="Enter email address to validate…"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>
            <button type="submit" className="sv-btn" disabled={isLoading || !email} id="validate-btn">
              {isLoading
                ? <><Loader2 size={16} className="sv-spinner" />Analysing…</>
                : <><Search size={16} />Run All 12 Checks</>}
            </button>
          </form>
          {error && <div className="sv-error">{error}</div>}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="sv-loading">
            <Loader2 size={36} className="sv-spinner" color="#818cf8" />
            <span>Running 12 checks — DNS · RDAP · Reputation · Risk…</span>
          </div>
        )}

        {/* Results */}
        {result && !isLoading && (
          <div className="sv-results">

            {/* Normalized email banner */}
            {result.normalized_email !== result.email && (
              <div className="sv-norm-banner">
                <Info size={16} color="#60a5fa" />
                Normalized email: <strong>{result.normalized_email}</strong>
              </div>
            )}

            {/* Summary row */}
            <div className="sv-summary-row">
              {/* Overall status */}
              <div className="sv-overall-card">
                <span className="sv-overall-label">Overall Result</span>
                <div className="sv-overall-status" style={{ color: overall.color }}>
                  {React.createElement(overall.icon, { size: 28, color: overall.color })}
                  {overall.label}
                </div>
                <div className="sv-overall-email">{result.email}</div>
                {result.execution_time_ms && (
                  <div className="sv-timing">
                    <Clock size={12} />
                    {result.execution_time_ms} ms
                  </div>
                )}
              </div>

              {/* Gauge */}
              <div className="sv-gauge-card">
                <RiskGauge score={result.risk_score} label={result.risk_label} />
              </div>

              {/* Stats */}
              <div className="sv-overall-card">
                <span className="sv-overall-label">Check Summary</span>
                <div className="sv-stats">
                  <div className="sv-stat-row">
                    <div className="sv-stat-dot" style={{ background: '#10b981' }} />
                    <span className="sv-stat-num" style={{ color: '#10b981' }}>{passCount}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>checks passed</span>
                  </div>
                  <div className="sv-stat-row">
                    <div className="sv-stat-dot" style={{ background: '#f59e0b' }} />
                    <span className="sv-stat-num" style={{ color: '#f59e0b' }}>{warnCount}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>warnings</span>
                  </div>
                  <div className="sv-stat-row">
                    <div className="sv-stat-dot" style={{ background: '#ef4444' }} />
                    <span className="sv-stat-num" style={{ color: '#ef4444' }}>{failCount}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>failed</span>
                  </div>
                  <div className="sv-stat-row">
                    <div className="sv-stat-dot" style={{ background: '#6b7280' }} />
                    <span className="sv-stat-num" style={{ color: '#6b7280' }}>
                      {displayChecks.filter(c => c.status === 'SKIP').length}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>skipped</span>
                  </div>
                </div>
              </div>
            </div>

            {/* All 11 check cards */}
            <p className="checks-section-title">Individual Check Results</p>
            <div className="checks-grid">
              {displayChecks.map((check, i) => (
                <CheckCard key={check.name} check={check} index={i} />
              ))}
            </div>

            {/* Risk scoring card full-width */}
            {riskCheck && (
              <>
                <p className="checks-section-title">Combined Risk Score</p>
                <div className="checks-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <CheckCard check={riskCheck} index={displayChecks.length} />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default SingleValidation;
