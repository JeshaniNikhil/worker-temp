import React, { useState } from 'react';
import axios from 'axios';
import {
  Search, CheckCircle, XCircle, AlertTriangle, Info,
  ShieldCheck, ShieldAlert, ShieldX, Loader2,
  AtSign, Globe, Server, Mail, Eye, Zap, Clock,
  Hash, SkipForward, Shield, Camera, Briefcase, Phone,
  ExternalLink, UserCheck, UserX, Smartphone
} from 'lucide-react';

const API_BASE_URL = '/api';

const FacebookIcon = ({ size = 16, color = '#1877f2', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

// ─── Status Config for Email Checks ──────────────────────────────────────────
const STATUS_CONFIG = {
  PASS:    { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', icon: CheckCircle,   label: 'Pass'    },
  FAIL:    { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  icon: XCircle,       label: 'Fail'    },
  WARNING: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', icon: AlertTriangle, label: 'Warning' },
  INFO:    { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', icon: Info,          label: 'Info'    },
  SKIP:    { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)', icon: SkipForward,  label: 'Skipped' },
};

// ─── Overall Email Verdict Config ─────────────────────────────────────────────
const OVERALL_CONFIG = {
  'DELIVERABLE': { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: '#10b981', label: '🟢 DELIVERABLE',   subLabel: 'Safe to send — SMTP confirmed mailbox exists', icon: ShieldCheck },
  'INVALID':     { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: '#ef4444', label: '🔴 INVALID',     subLabel: 'Do not send — mailbox rejected or domain invalid', icon: ShieldX },
  'NOT_DELIVERABLE': { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: '#ef4444', label: '🔴 NOT DELIVERABLE', subLabel: 'Do not send — SMTP explicitly rejected this address', icon: ShieldX },
  'CATCH_ALL':   { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: '#f59e0b', label: '⚠️ CATCH-ALL',    subLabel: 'Domain accepts all emails — cannot verify specific mailbox', icon: ShieldAlert },
  'RISKY':       { color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: '#f97316', label: '🟠 RISKY',       subLabel: 'SMTP verification inconclusive — rate limit or timeout', icon: ShieldAlert },
  'UNKNOWN':     { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: '#6b7280', label: '⚪ UNKNOWN',     subLabel: 'Could not verify — SMTP timed out or port 25 blocked', icon: Shield },
  'VALID':           { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: '#10b981', label: '🟢 VALID',   subLabel: 'Safe to send — mailbox confirmed', icon: ShieldCheck },
  'NOT DELIVERABLE': { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: '#ef4444', label: '🔴 INVALID', subLabel: 'Do not send — mailbox rejected or invalid', icon: ShieldX },
};

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
  'SMTP Handshake & Mailbox Verification': Server,
  'Risk Scoring':         ShieldCheck,
};

// ─── Risk Gauge Component ──────────────────────────────────────────────────────
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
      <svg width={150} height={150} viewBox="0 0 160 160">
        <circle
          cx={80} cy={80} r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={stroke}
        />
        <circle
          cx={80} cy={80} r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 80 80)"
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }}
        />
        <text x={80} y={74} textAnchor="middle" fill="#111827" fontSize={30} fontWeight="800" fontFamily="Inter,sans-serif">
          {score}
        </text>
        <text x={80} y={95} textAnchor="middle" fill="#6b7280" fontSize={11} fontFamily="Inter,sans-serif">
          Risk Score
        </text>
      </svg>
      <span style={{ fontSize: 13, fontWeight: 700, color: getColor() }}>{label}</span>
    </div>
  );
};

// ─── Check Card Component ─────────────────────────────────────────────────────
const CheckCard = ({ check, index }) => {
  const cfg = STATUS_CONFIG[check.status] || STATUS_CONFIG.INFO;
  const StatusIcon = cfg.icon;
  const CheckIcon = CHECK_ICONS[check.name] || Info;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        background: 'var(--surface-color)', border: `1px solid var(--border-color)`,
        borderRadius: 12, padding: '0.9rem 1.1rem', boxShadow: 'var(--shadow-sm)',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1
        }}>
          <CheckIcon size={16} color={cfg.color} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 500 }}>#{index + 1}</span>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {check.name}
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, wordBreak: 'break-word' }}>
            {check.detail}
          </span>
          {check.score !== undefined && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', marginTop: 4, padding: '2px 8px',
              borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, width: 'fit-content',
              background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`
            }}>
              Score: {check.score}/100
            </span>
          )}
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
        borderRadius: 20, fontSize: '0.73rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`
      }}>
        <StatusIcon size={13} />
        <span>{cfg.label}</span>
      </div>
    </div>
  );
};

// ─── Single Verifiers Config ──────────────────────────────────────────────────
const VERIFIER_TABS = [
  { id: 'email', label: 'Email Deep Check', icon: AtSign, color: '#f97316', desc: '12-point SMTP, DNS, RDAP & Risk Score analysis' },
  { id: 'facebook', label: 'Facebook Verifier', icon: FacebookIcon, color: '#1877f2', desc: 'Check whether a Facebook account / profile exists' },
  { id: 'instagram', label: 'Instagram Verifier', icon: Camera, color: '#e1306c', desc: 'Check whether an Instagram profile exists' },
  { id: 'whatsapp', label: 'WhatsApp Verifier', icon: Phone, color: '#25d366', desc: 'Check whether phone number is registered on WhatsApp' },
  { id: 'linkedin', label: 'LinkedIn Verifier', icon: Briefcase, color: '#0077b5', desc: 'Check whether a LinkedIn profile exists' },
  { id: 'website', label: 'Website Verifier', icon: Globe, color: '#8b5cf6', desc: 'Check whether a website is active and reachable' },
  { id: 'phone', label: 'Phone Verifier', icon: Smartphone, color: '#f59e0b', desc: 'Validate phone number format and line type' },
];

const SingleValidation = () => {
  const [activeTab, setActiveTab] = useState('email');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [socialResult, setSocialResult] = useState(null);
  const [error, setError] = useState('');

  const currentTabInfo = VERIFIER_TABS.find(t => t.id === activeTab);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setInputValue('');
    setResult(null);
    setSocialResult(null);
    setError('');
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) {
      setError('Please enter a valid value to verify.');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult(null);
    setSocialResult(null);

    try {
      if (activeTab === 'email') {
        if (!inputValue.includes('@')) {
          setError('Please enter a valid email address format (e.g. name@domain.com)');
          setIsLoading(false);
          return;
        }
        const submit = await axios.post(`${API_BASE_URL}/validation/deep`, { email: inputValue.trim() });
        const taskId = submit.data.task_id;
        
        // Poll every 2 seconds until done (max 3 minutes)
        const maxAttempts = 90;
        let pollSuccess = false;
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const poll = await axios.get(`${API_BASE_URL}/validation/task/${taskId}`);
          if (poll.data.status === 'done') {
            setResult(poll.data.result);
            pollSuccess = true;
            break;
          } else if (poll.data.status === 'error') {
            setError(poll.data.error || 'Validation failed on worker.');
            pollSuccess = true;
            break;
          }
          // still 'pending' — keep polling
        }
        if (!pollSuccess) {
          setError('Validation timed out after 3 minutes. Please try again.');
        }
      } else {
        const endpointMap = {
          facebook: '/social/facebook',
          instagram: '/social/instagram',
          whatsapp: '/social/whatsapp',
          linkedin: '/social/linkedin',
          website: '/social/website',
          phone: '/social/phone',
        };
        const res = await axios.post(`${API_BASE_URL}/validation${endpointMap[activeTab]}`, { input: inputValue.trim() });
        setSocialResult(res.data);
      }
    } catch (err) {
      let errMsg = 'Verification failed.';
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

  // Helper renderers for Social verifier results
  const renderSocialResult = () => {
    if (!socialResult) return null;

    const { status, reason, url, number, execution_time_ms, method, confidence, evidence, user_agent, type } = socialResult;
    const isExist = ['ACTIVE', 'WHATSAPP', 'ACTIVE_PROFILE', 'PROFILE_FOUND', 'FACEBOOK_FOUND', 'WHATSAPP_EXISTS', 'WEB_ACTIVE', 'PHONE_VALID'].includes(status);
    const isNotExist = ['INACTIVE', 'NOT_WHATSAPP', 'INVALID', 'NOT_FOUND', 'FACEBOOK_NOT_FOUND', 'PROFILE_NOT_FOUND', 'WHATSAPP_NOT_FOUND', 'WEB_INACTIVE', 'PHONE_INVALID'].includes(status);

    const targetUrl = url || (number && activeTab === 'whatsapp' ? `https://wa.me/${number.replace('+', '')}` : '');

    return (
      <div className="card animate-fade-in" style={{
        maxWidth: 720, margin: '2rem auto 0',
        borderTop: `4px solid ${isExist ? '#10b981' : isNotExist ? '#ef4444' : '#f59e0b'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 46, height: 46, borderRadius: '50%',
              background: isExist ? 'rgba(16,185,129,0.1)' : isNotExist ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {isExist ? <UserCheck size={24} color="#10b981" /> : isNotExist ? <UserX size={24} color="#ef4444" /> : <AlertTriangle size={24} color="#f59e0b" />}
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                {currentTabInfo.label} Result
              </div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: isExist ? '#10b981' : isNotExist ? '#ef4444' : '#f59e0b' }}>
                {status}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <Clock size={14} />
            <span>{execution_time_ms} ms</span>
          </div>
        </div>

        {/* Input & URL info */}
        <div style={{
          background: 'var(--bg-color)', border: '1px solid var(--border-color)',
          borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1.25rem',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Query Input</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem' }}>{inputValue}</span>
            </div>
            {confidence && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Confidence</span>
                <span style={{ 
                  fontWeight: 700, fontSize: '0.85rem',
                  color: confidence === 'HIGH' ? '#10b981' : confidence === 'MEDIUM' ? '#f59e0b' : '#ef4444'
                }}>{confidence}</span>
              </div>
            )}
            {method && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Verification Method</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{method}</span>
              </div>
            )}
            {user_agent && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Agent Used</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={user_agent}>
                  {user_agent.split(' ')[0]} ...
                </span>
              </div>
            )}
            {type && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Line Type</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{type}</span>
              </div>
            )}
          </div>
          
          {(reason || evidence) && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reason && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Diagnostic Reason:</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{reason}</span>
                </div>
              )}
              {evidence && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Evidence:</span>
                  <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-primary)' }}>{evidence}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Direct Link Button */}
        {targetUrl && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            {activeTab === 'whatsapp' ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Direct 1-click WhatsApp messaging link generated.
              </span>
            ) : <div />}

            <a
              href={targetUrl}
              target="_blank"
              rel="noreferrer"
              className={activeTab === 'whatsapp' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', fontWeight: 600,
                ...(activeTab === 'whatsapp' ? { background: '#25D366', borderColor: '#25D366', color: '#fff' } : {})
              }}
            >
              {activeTab === 'whatsapp' ? (
                <>
                  <Phone size={15} /> Open WhatsApp Chat <ExternalLink size={14} />
                </>
              ) : (
                <>
                  Open Profile / URL <ExternalLink size={14} />
                </>
              )}
            </a>
          </div>
        )}
      </div>
    );
  };

  // Render email result
  const overall = result
    ? (
        OVERALL_CONFIG[result.status] ||
        OVERALL_CONFIG[result.overall_status] ||
        OVERALL_CONFIG['UNKNOWN']
      )
    : null;

  let dynamicSubLabel = overall?.subLabel;
  if (result?.catch_all && result?.status !== 'CATCH_ALL') {
    dynamicSubLabel = 'Catch-all domain detected — the mail server accepts any address on this domain.';
  }

  const displayChecks = result ? result.checks.filter(c => c.name !== 'Risk Scoring') : [];
  const riskCheck   = result ? result.checks.find(c => c.name === 'Risk Scoring') : null;

  const passCount    = displayChecks.filter(c => c.status === 'PASS').length;
  const failCount    = displayChecks.filter(c => c.status === 'FAIL').length;
  const warnCount    = displayChecks.filter(c => c.status === 'WARNING').length;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: '3rem' }}>
      
      {/* Page Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.1rem', marginBottom: '0.4rem', fontWeight: 800 }}>Single Data Verifier</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Select a single verification module to test individual email or social media accounts in real-time.
        </p>
      </div>

      {/* Verifier Selector Tabs */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem',
        marginBottom: '2rem',
      }}>
        {VERIFIER_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <div
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                background: 'var(--surface-color)',
                border: `2px solid ${isActive ? tab.color : 'var(--border-color)'}`,
                borderRadius: 12, padding: '1rem 0.9rem', cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isActive ? `0 4px 12px ${tab.color}22` : 'var(--shadow-sm)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', textCenter: 'center',
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: isActive ? `${tab.color}15` : 'var(--bg-color)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
              }}>
                <Icon size={20} color={tab.color} />
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: isActive ? tab.color : 'var(--text-primary)', marginBottom: 2 }}>
                {tab.label}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.3 }}>
                {tab.id === 'email' ? '12-point checks' : 'Account lookup'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Input Search Card */}
      <div className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ margin: '0 0 0.2rem', display: 'flex', alignItems: 'center', gap: 8, color: currentTabInfo.color }}>
            {React.createElement(currentTabInfo.icon, { size: 20 })}
            {currentTabInfo.label}
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {currentTabInfo.desc}
          </p>
        </div>

        <form onSubmit={handleVerify} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
            <input
              type="text"
              className="form-control"
              placeholder={
                activeTab === 'email' ? 'Enter email address (e.g. alex@example.com)…' :
                activeTab === 'facebook' ? 'Enter Facebook username or profile URL…' :
                activeTab === 'instagram' ? 'Enter Instagram handle or profile URL…' :
                activeTab === 'whatsapp' ? 'Enter phone number with country code (e.g. +14155552671)…' :
                activeTab === 'linkedin' ? 'Enter LinkedIn username or profile URL…' :
                activeTab === 'website' ? 'Enter website URL (e.g. example.com)…' :
                'Enter phone number (e.g. +14155552671)…'
              }
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              disabled={isLoading}
              style={{ paddingLeft: '1rem', paddingRight: '1rem', height: 46 }}
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || !inputValue.trim()}
            style={{
              height: 46, padding: '0 1.5rem', whiteSpace: 'nowrap',
              background: currentTabInfo.color, borderColor: currentTabInfo.color,
            }}
          >
            {isLoading ? (
              <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Verifying…</>
            ) : (
              <><Search size={18} /> Verify Existence</>
            )}
          </button>
        </form>

        {error && (
          <div style={{
            marginTop: '1rem', padding: '0.85rem 1rem', background: 'rgba(239,68,68,0.08)',
            borderLeft: '4px solid #ef4444', color: '#dc2626', borderRadius: '0 8px 8px 0', fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Social verification result output */}
      {socialResult && !isLoading && renderSocialResult()}

      {/* Email verification detailed results */}
      {activeTab === 'email' && result && !isLoading && (
        <div className="animate-fade-in" style={{ marginTop: '2rem' }}>
          
          {/* Summary Row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: '1.25rem', marginBottom: '1.5rem'
          }}>
            {/* Overall status */}
            <div className="card" style={{
              background: 'var(--surface-color)', borderLeft: `5px solid ${overall.color}`,
              display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6,
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
                📬 Campaign Verdict
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.6rem', fontWeight: 800, color: overall.color }}>
                {React.createElement(overall.icon, { size: 28, color: overall.color })}
                {overall.label}
              </div>
              {dynamicSubLabel && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {dynamicSubLabel}
                </div>
              )}
              <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                {result.email}
              </div>
              {result.execution_time_ms && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Clock size={12} /> {result.execution_time_ms} ms
                </div>
              )}
            </div>

            {/* Gauge */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RiskGauge score={result.risk_score} label={result.risk_label} />
            </div>

            {/* Stats */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
                Check Summary
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>Passed Checks</span>
                  <span style={{ fontWeight: 800, color: '#10b981' }}>{passCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>Warnings</span>
                  <span style={{ fontWeight: 800, color: '#f59e0b' }}>{warnCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>Failed Checks</span>
                  <span style={{ fontWeight: 800, color: '#ef4444' }}>{failCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Individual Checks Grid */}
          <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.9rem' }}>
            Detailed 12-Point Analysis
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '0.85rem' }}>
            {displayChecks.map((check, i) => (
              <CheckCard key={check.name} check={check} index={i} />
            ))}
          </div>

          {riskCheck && (
            <div style={{ marginTop: '1rem' }}>
              <CheckCard check={riskCheck} index={displayChecks.length} />
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default SingleValidation;
