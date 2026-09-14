import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Download, RefreshCw, ArrowLeft, AlertTriangle, HelpCircle, Search, Filter,
  Pause, Play, Square, Camera, Briefcase, Phone,
  ChevronDown, ChevronUp, Mail, Trash2, Globe, Smartphone,
  ShieldCheck, ShieldAlert, ShieldX, Shield, Eye, Cpu,
  TrendingUp, BarChart2, Settings, X, Check, Layers, PieChart
} from 'lucide-react';

const FacebookIcon = ({ size = 12, color = '#1877f2', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const API_BASE_URL = '/api';
const LIVE_POLL_INTERVAL = 3000;

const EMAIL_STATUS_CFG = {
  VALID:             { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)',  label: 'Valid' },
  INVALID:           { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   label: 'Invalid' },
  RISKY:             { color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)',  label: 'Risky' },
  UNKNOWN:           { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)', label: 'Unknown' },
  DISPOSABLE:        { color: '#dc2626', bg: 'rgba(220,38,38,0.1)',   border: 'rgba(220,38,38,0.3)',   label: 'Disposable' },
  CATCH_ALL:         { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  label: 'Catch-All' },
  ROLE_ACCOUNT:      { color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.3)',  label: 'Role Account' },
  BLOCKED:           { color: '#9f1239', bg: 'rgba(159,18,57,0.1)',   border: 'rgba(159,18,57,0.3)',   label: 'Blocked' },
  TEMPORARY_FAILURE: { color: '#78716c', bg: 'rgba(120,113,108,0.1)', border: 'rgba(120,113,108,0.3)', label: 'Temp Failure' },
  SKIPPED:           { color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)', label: 'Skipped' },
};

const WHATSAPP_STATUS_CFG = {
  API_ERROR:          { color: '#dc2626', bg: 'rgba(220,38,38,0.1)',   border: 'rgba(220,38,38,0.3)',   label: 'API Error' },
  TIMEOUT:            { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  label: 'Timeout' },
  RATE_LIMITED:       { color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)',  label: 'Rate Limited' },
  NOT_CHECKED:        { color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)', label: 'Not Checked' },
  WHATSAPP_EXISTS:    { color: '#25d366', bg: 'rgba(37,211,102,0.1)',  border: 'rgba(37,211,102,0.3)',  label: 'WA Exists' },
  WHATSAPP_NOT_FOUND: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   label: 'WA Not Found' },
};

const FACEBOOK_STATUS_CFG = {
  FACEBOOK_FOUND:          { color: '#1877f2', bg: 'rgba(24,119,242,0.1)',  border: 'rgba(24,119,242,0.3)',  label: 'FB Found' },
  FACEBOOK_NOT_FOUND:      { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   label: 'FB Not Found' },
  FACEBOOK_LOGIN_REQUIRED: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  label: 'FB Login Req' },
  FACEBOOK_BLOCKED:        { color: '#9f1239', bg: 'rgba(159,18,57,0.1)',   border: 'rgba(159,18,57,0.3)',   label: 'FB Blocked' },
  FACEBOOK_RATE_LIMITED:   { color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)',  label: 'FB Rate Limited' },
  FACEBOOK_UNKNOWN:        { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)', label: 'FB Unknown' },
};

const INSTAGRAM_STATUS_CFG = {
  ACTIVE_PROFILE: { color: '#e1306c', bg: 'rgba(225,48,108,0.1)',  border: 'rgba(225,48,108,0.3)',  label: 'IG Active' },
  LOGIN_REQUIRED: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  label: 'IG Login Req' },
  NOT_FOUND:      { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   label: 'IG Not Found' },
  RATE_LIMITED:   { color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)',  label: 'IG Rate Limited' },
  BLOCKED:        { color: '#9f1239', bg: 'rgba(159,18,57,0.1)',   border: 'rgba(159,18,57,0.3)',   label: 'IG Blocked' },
  UNKNOWN:        { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)', label: 'IG Unknown' },
};

const LINKEDIN_STATUS_CFG = {
  PROFILE_FOUND:     { color: '#0077b5', bg: 'rgba(0,119,181,0.1)',   border: 'rgba(0,119,181,0.3)',   label: 'LI Found' },
  PROFILE_NOT_FOUND: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   label: 'LI Not Found' },
  LOGIN_REQUIRED:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  label: 'LI Login Req' },
  BLOCKED:           { color: '#9f1239', bg: 'rgba(159,18,57,0.1)',   border: 'rgba(159,18,57,0.3)',   label: 'LI Blocked' },
  RATE_LIMITED:      { color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)',  label: 'LI Rate Limited' },
  UNKNOWN:           { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)', label: 'LI Unknown' },
};

const WEBSITE_STATUS_CFG = {
  WEB_ACTIVE:   { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.3)', label: 'Web Active' },
  WEB_INACTIVE: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  label: 'Web Inactive' },
  WEB_UNKNOWN:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', label: 'Web Unknown' },
};

const PHONE_STATUS_CFG = {
  PHONE_VALID:   { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', label: 'Phone Valid' },
  PHONE_INVALID: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  label: 'Phone Invalid' },
  PHONE_UNKNOWN: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', label: 'Phone Unknown' },
};

const CONFIDENCE_CFG = {
  HIGH:   { color: '#10b981', label: 'HIGH' },
  MEDIUM: { color: '#f59e0b', label: 'MED' },
  LOW:    { color: '#ef4444', label: 'LOW' },
};

// Exact requested status list per platform
const SPEC_STATUS_LIST = {
  whatsapp:  ['API_ERROR', 'TIMEOUT', 'RATE_LIMITED', 'NOT_CHECKED', 'WHATSAPP_EXISTS', 'WHATSAPP_NOT_FOUND'],
  email:     ['VALID', 'INVALID', 'RISKY', 'UNKNOWN', 'DISPOSABLE', 'CATCH_ALL', 'ROLE_ACCOUNT', 'BLOCKED', 'TEMPORARY_FAILURE'],
  facebook:  ['FACEBOOK_FOUND', 'FACEBOOK_NOT_FOUND', 'FACEBOOK_LOGIN_REQUIRED', 'FACEBOOK_BLOCKED', 'FACEBOOK_RATE_LIMITED', 'FACEBOOK_UNKNOWN'],
  instagram: ['ACTIVE_PROFILE', 'LOGIN_REQUIRED', 'NOT_FOUND', 'RATE_LIMITED', 'BLOCKED', 'UNKNOWN'],
  linkedin:  ['PROFILE_FOUND', 'PROFILE_NOT_FOUND', 'LOGIN_REQUIRED', 'BLOCKED', 'RATE_LIMITED', 'UNKNOWN'],
  website:   ['WEB_ACTIVE', 'WEB_INACTIVE', 'WEB_UNKNOWN'],
  phone:     ['PHONE_VALID', 'PHONE_INVALID', 'PHONE_UNKNOWN'],
};

const PLATFORM_META = {
  email:     { label: 'Email',     color: '#f97316', emoji: '📧' },
  whatsapp:  { label: 'WhatsApp',  color: '#25d366', emoji: '💬' },
  facebook:  { label: 'Facebook',  color: '#1877f2', emoji: '🔵' },
  instagram: { label: 'Instagram', color: '#e1306c', emoji: '📸' },
  linkedin:  { label: 'LinkedIn',  color: '#0077b5', emoji: '💼' },
  website:   { label: 'Website',   color: '#8b5cf6', emoji: '🌐' },
  phone:     { label: 'Phone',     color: '#10b981', emoji: '📱' },
};

const EXPORT_COLUMNS_BY_PLATFORM = {
  email:     ['email_status','email_method','email_confidence','email_checked_at','email_evidence','email_reason','email_per_address_breakdown'],
  whatsapp:  ['whatsapp_status','whatsapp_method','whatsapp_confidence','whatsapp_checked_at','whatsapp_evidence','whatsapp_reason','whatsapp_number'],
  facebook:  ['facebook_status','facebook_method','facebook_confidence','facebook_checked_at','facebook_evidence','facebook_reason','facebook_url'],
  instagram: ['instagram_status','instagram_method','instagram_confidence','instagram_checked_at','instagram_evidence','instagram_reason','instagram_url'],
  linkedin:  ['linkedin_status','linkedin_method','linkedin_confidence','linkedin_checked_at','linkedin_evidence','linkedin_reason','linkedin_url'],
  website:   ['website_status','website_method','website_confidence','website_checked_at','website_evidence','website_reason','website_url','website_title','website_http_status'],
  phone:     ['phone_status','phone_method','phone_confidence','phone_checked_at','phone_evidence','phone_reason','phone_number','phone_type'],
};

const normalizeEmailStatus = status => {
  if (status === 'DELIVERABLE') return 'VALID';
  if (['NOT DELIVERABLE', 'NOT_DELIVERABLE'].includes(status)) return 'INVALID';
  return status;
};

const getStatusCfg = (status, platform = 'email') => {
  if (!status) return { color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)', label: '—' };
  const norm = platform === 'email' ? normalizeEmailStatus(status) : status;
  const map = { email: EMAIL_STATUS_CFG, whatsapp: WHATSAPP_STATUS_CFG, facebook: FACEBOOK_STATUS_CFG, instagram: INSTAGRAM_STATUS_CFG, linkedin: LINKEDIN_STATUS_CFG, website: WEBSITE_STATUS_CFG, phone: PHONE_STATUS_CFG };
  return (map[platform] || {})[norm] || { color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)', label: norm };
};

const StatusBadge = ({ status, platform = 'email' }) => {
  const cfg = getStatusCfg(status, platform);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
};

const ConfidenceBadge = ({ confidence }) => {
  const cfg = CONFIDENCE_CFG[confidence] || { color: '#9ca3af', label: confidence || '—' };
  return <span style={{ fontSize: '0.66rem', fontWeight: 700, color: cfg.color, background: `${cfg.color}18`, padding: '1px 6px', borderRadius: 10, border: `1px solid ${cfg.color}44` }}>{cfg.label}</span>;
};

const ProgressBar = ({ pct, color = '#f97316' }) => (
  <div style={{ background: 'var(--border-color)', borderRadius: 8, height: 7, overflow: 'hidden' }}>
    <div style={{ height: '100%', borderRadius: 8, background: color, width: `${Math.min(pct, 100)}%`, transition: 'width 0.6s ease' }} />
  </div>
);

const StatCard = ({ title, value, color, sub, icon: Icon }) => {
  const valStr = String(value ?? '—');
  return (
    <div style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderLeft: `4px solid ${color || 'var(--border-color)'}`, borderRadius: 12, padding: '0.9rem 1rem', overflow: 'hidden', minWidth: 0, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {Icon && <Icon size={13} color={color || 'var(--text-secondary)'} />}
        <span style={{ fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{title}</span>
      </div>
      <div style={{ fontSize: valStr.length > 6 ? '1.15rem' : '1.6rem', fontWeight: 800, color: color || 'var(--text-primary)', lineHeight: 1.1 }}>{valStr}</div>
      {sub && <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
};

const EvidencePanel = ({ data, platform, label, color }) => {
  if (!data) return null;
  const rows = [
    ['Status', <StatusBadge key="s" status={data.status} platform={platform} />],
    data.reason     && ['Reason',     data.reason],
    data.method     && ['Method',     <span key="m" style={{ fontFamily: 'monospace', fontSize: '0.72rem', background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 4 }}>{data.method}</span>],
    data.confidence && ['Confidence', <ConfidenceBadge key="c" confidence={data.confidence} />],
    data.evidence   && ['Evidence',   <span key="e" style={{ fontFamily: 'monospace', fontSize: '0.7rem', wordBreak: 'break-all', opacity: 0.85 }}>{data.evidence}</span>],
    data.checked_at && ['Checked at', new Date(data.checked_at).toLocaleString()],
    data.url        && ['URL',        <a key="u" href={data.url} target="_blank" rel="noreferrer" style={{ color, fontSize: '0.72rem', wordBreak: 'break-all' }}>{data.url}</a>],
    data.number     && ['Number',     <span key="n" style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{data.number}</span>],
    data.title      && ['Page Title', data.title],
    data.server     && ['Server',     data.server],
    data.http_status && ['HTTP',      String(data.http_status)],
    data.type       && ['Type',       data.type],
  ].filter(Boolean);

  return (
    <div style={{ background: `${color}08`, border: `1px solid ${color}30`, borderRadius: 10, padding: '0.8rem', marginTop: 4 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
        {label} Evidence
      </div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: 10, fontSize: '0.73rem', lineHeight: 1.6 }}>
          <span style={{ color: 'var(--text-secondary)', minWidth: 90, fontWeight: 600, flexShrink: 0 }}>{k}</span>
          <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word', flex: 1 }}>{v}</span>
        </div>
      ))}
    </div>
  );
};

const AnalyticsSection = ({ results, activePlatforms }) => {
  const totalRecords = results.length;
  if (!totalRecords) return null;

  const platformStats = activePlatforms.map(p => {
    const meta = PLATFORM_META[p];
    let success = 0, fail = 0, warning = 0, total = 0;

    if (p === 'email') {
      results.forEach(r => {
        const norm = normalizeEmailStatus(r.status);
        if (norm === 'VALID') success++;
        else if (['INVALID','DISPOSABLE','BLOCKED'].includes(norm)) fail++;
        else warning++;
      });
      total = results.length;
    } else if (p === 'whatsapp') {
      results.forEach(r => {
        const s = r.whatsapp_data?.status;
        if (s === 'WHATSAPP_EXISTS') success++;
        else if (s === 'WHATSAPP_NOT_FOUND') fail++;
        else if (s) warning++;
      });
      total = results.filter(r => r.whatsapp_data?.status).length || results.length;
    } else if (p === 'facebook') {
      results.forEach(r => {
        const s = r.facebook_data?.status;
        if (s === 'FACEBOOK_FOUND') success++;
        else if (s === 'FACEBOOK_NOT_FOUND') fail++;
        else if (s) warning++;
      });
      total = results.filter(r => r.facebook_data?.status).length || results.length;
    } else if (p === 'instagram') {
      results.forEach(r => {
        const s = r.instagram_data?.status;
        if (s === 'ACTIVE_PROFILE') success++;
        else if (s === 'NOT_FOUND') fail++;
        else if (s) warning++;
      });
      total = results.filter(r => r.instagram_data?.status).length || results.length;
    } else if (p === 'linkedin') {
      results.forEach(r => {
        const s = r.linkedin_data?.status;
        if (s === 'PROFILE_FOUND') success++;
        else if (s === 'PROFILE_NOT_FOUND') fail++;
        else if (s) warning++;
      });
      total = results.filter(r => r.linkedin_data?.status).length || results.length;
    } else if (p === 'website') {
      results.forEach(r => {
        const s = r.website_data?.status;
        if (s === 'WEB_ACTIVE') success++;
        else if (s === 'WEB_INACTIVE') fail++;
        else if (s) warning++;
      });
      total = results.filter(r => r.website_data?.status).length || results.length;
    } else if (p === 'phone') {
      results.forEach(r => {
        const s = r.phone_data?.status;
        if (s === 'PHONE_VALID') success++;
        else if (s === 'PHONE_INVALID') fail++;
        else if (s) warning++;
      });
      total = results.filter(r => r.phone_data?.status).length || results.length;
    }

    const successPct = total > 0 ? Math.round((success / total) * 100) : 0;
    const failPct = total > 0 ? Math.round((fail / total) * 100) : 0;
    const warningPct = Math.max(0, 100 - successPct - failPct);

    return { key: p, meta, success, fail, warning, total, successPct, failPct, warningPct };
  });

  return (
    <div style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 14, padding: '1.2rem 1.4rem', marginBottom: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(249,115,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart2 size={18} color="#f97316" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Platform Verification Analytics & Accuracy Graphs</h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Success vs failure breakdown with exact record counts per verifier platform</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: '0.75rem', fontWeight: 600, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#10b981' }} /> Success / Valid</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444' }} /> Not Found / Invalid</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b' }} /> Risky / Other</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.9rem' }}>
        {platformStats.map(ps => (
          <div key={ps.key} style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '0.85rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: ps.meta.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{ps.meta.emoji}</span> {ps.meta.label}
              </span>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#10b981' }}>
                {ps.successPct}% Success
              </span>
            </div>

            <div style={{ height: 10, background: 'var(--border-color)', borderRadius: 6, overflow: 'hidden', display: 'flex', marginBottom: 8 }}>
              <div style={{ width: `${ps.successPct}%`, background: '#10b981', transition: 'width 0.5s ease' }} title={`Success: ${ps.success}`} />
              <div style={{ width: `${ps.failPct}%`, background: '#ef4444', transition: 'width 0.5s ease' }} title={`Failed: ${ps.fail}`} />
              <div style={{ width: `${ps.warningPct}%`, background: '#f59e0b', transition: 'width 0.5s ease' }} title={`Warning/Unknown: ${ps.warning}`} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              <span style={{ color: '#10b981' }}>✅ {ps.success} Success</span>
              <span style={{ color: '#ef4444' }}>❌ {ps.fail} Failed</span>
              <span style={{ color: '#f59e0b' }}>⚠️ {ps.warning} Other</span>
              <span>Total: {ps.total}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const DeleteModal = ({ title, filename, onConfirm, onCancel, loading }) => {
  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999999, padding: '1rem', boxSizing: 'border-box'
    }} onClick={onCancel}>
      <div style={{
        background: 'var(--surface-color)', border: '1px solid var(--border-color)',
        borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 440,
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)', animation: 'modalSlideIn 0.2s ease-out'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ef4444', marginBottom: 12 }}>
          <Trash2 size={22} />
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
          Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{filename}</strong>? All associated records will be permanently removed.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.5rem 1.1rem', fontSize: '0.85rem', fontWeight: 600, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
            {loading ? 'Deleting…' : 'Delete Job'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const ExportModal = ({ onConfirm, onCancel, loading, activePlatforms, resultStatuses }) => {
  const [format, setFormat] = useState('xlsx');
  const [limit, setLimit] = useState('');
  const [platforms, setPlatforms] = useState(activePlatforms);
  const [colGroups, setColGroups] = useState({ status: true, method: true, confidence: true, checked_at: false, evidence: true, reason: true, url: true, extra: false });
  const [statusFilters, setStatusFilters] = useState([]);
  const [activeTab, setActiveTab] = useState('format');

  const togglePlatform = p => setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  const toggleStatus = s => setStatusFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const buildColumns = () => {
    const cols = [];
    platforms.forEach(p => {
      (EXPORT_COLUMNS_BY_PLATFORM[p] || []).forEach(c => {
        const key = c.replace(`${p}_`, '');
        if (key === 'status' && colGroups.status) cols.push(c);
        else if (key === 'method' && colGroups.method) cols.push(c);
        else if (key === 'confidence' && colGroups.confidence) cols.push(c);
        else if (key === 'checked_at' && colGroups.checked_at) cols.push(c);
        else if (key === 'evidence' && colGroups.evidence) cols.push(c);
        else if (key === 'reason' && colGroups.reason) cols.push(c);
        else if (['url', 'number'].includes(key) && colGroups.url) cols.push(c);
        else if (['per_address_breakdown','title','http_status','type'].includes(key) && colGroups.extra) cols.push(c);
      });
    });
    return cols;
  };

  const tabs = [
    { id: 'format', label: 'Format & Limit', icon: Settings },
    { id: 'platforms', label: 'Platforms', icon: Filter },
    { id: 'columns', label: 'Columns', icon: BarChart2 },
    { id: 'statuses', label: 'Status Filter', icon: ShieldCheck },
  ];

  const activeColCount = Object.values(colGroups).filter(Boolean).length;

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999999, padding: '1rem', boxSizing: 'border-box'
    }} onClick={onCancel}>
      <div style={{
        background: 'var(--surface-color)', border: '1px solid var(--border-color)',
        borderRadius: 18, width: '100%', maxWidth: 620, maxHeight: '90vh',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', animation: 'modalSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }} onClick={e => e.stopPropagation()}>

        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(249,115,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Download size={20} color="#f97316" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Export Verification Results</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Configure file format, platforms, diagnostic columns & status filters</p>
            </div>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4, borderRadius: 6 }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 1.5rem', background: 'var(--bg-color)' }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.75rem 0.9rem', fontSize: '0.8rem', fontWeight: 600, color: activeTab === id ? '#f97316' : 'var(--text-secondary)', borderBottom: activeTab === id ? '2.5px solid #f97316' : '2.5px solid transparent', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'format' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Export Format</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {['csv', 'xlsx'].map(f => (
                    <button key={f} onClick={() => setFormat(f)} style={{ flex: 1, padding: '0.85rem', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', background: format === f ? 'rgba(249,115,22,0.1)' : 'var(--bg-color)', border: `2px solid ${format === f ? '#f97316' : 'var(--border-color)'}`, color: format === f ? '#f97316' : 'var(--text-primary)', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      {f === 'csv' ? '📄 CSV Document' : '📊 Excel Workbook (.xlsx)'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Record Limit</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {['', '100', '500', '1000', '5000'].map(v => (
                    <button key={v} onClick={() => setLimit(v)} style={{ padding: '0.4rem 0.9rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, background: limit === v ? 'rgba(249,115,22,0.1)' : 'var(--bg-color)', border: `1px solid ${limit === v ? '#f97316' : 'var(--border-color)'}`, color: limit === v ? '#f97316' : 'var(--text-secondary)' }}>
                      {v === '' ? 'All Records' : `${v} Records`}
                    </button>
                  ))}
                </div>
                <input type="number" className="form-control" placeholder="Or enter custom record limit…" value={limit} onChange={e => setLimit(e.target.value)} style={{ fontSize: '0.85rem' }} />
              </div>
            </div>
          )}

          {activeTab === 'platforms' && (
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 14px' }}>Select which verifiers to include in export file:</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {Object.entries(PLATFORM_META).filter(([p]) => activePlatforms.includes(p)).map(([p, meta]) => (
                  <label key={p} onClick={() => togglePlatform(p)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1rem', borderRadius: 10, cursor: 'pointer', background: platforms.includes(p) ? `${meta.color}12` : 'var(--bg-color)', border: `2px solid ${platforms.includes(p) ? meta.color : 'var(--border-color)'}`, transition: 'all 0.15s' }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${platforms.includes(p) ? meta.color : 'var(--border-color)'}`, background: platforms.includes(p) ? meta.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {platforms.includes(p) && <Check size={12} color="#fff" strokeWidth={3} />}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: platforms.includes(p) ? meta.color : 'var(--text-secondary)' }}>{meta.emoji} {meta.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'columns' && (
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 14px' }}>Choose diagnostic columns to include in the file:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'status',     label: 'Verification Status', desc: 'e.g. VALID, PROFILE_FOUND, WHATSAPP_EXISTS' },
                  { key: 'method',     label: 'Verification Method', desc: 'e.g. SMTP + MX, PUBLIC_METADATA' },
                  { key: 'confidence', label: 'Confidence Score',   desc: 'HIGH / MEDIUM / LOW' },
                  { key: 'reason',     label: 'Diagnostic Reason',   desc: 'Human-readable result explanation' },
                  { key: 'evidence',   label: 'Evidence Log',        desc: 'Technical verification evidence' },
                  { key: 'url',        label: 'URL / Phone Number',  desc: 'Found profile link or phone number' },
                  { key: 'checked_at', label: 'Checked Timestamp',  desc: 'Exact date & time checked' },
                  { key: 'extra',      label: 'Extra Details',       desc: 'Page title, HTTP status, phone line type' },
                ].map(({ key, label, desc }) => (
                  <label key={key} onClick={() => setColGroups(prev => ({ ...prev, [key]: !prev[key] }))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.65rem 0.9rem', borderRadius: 10, cursor: 'pointer', background: colGroups[key] ? 'rgba(249,115,22,0.08)' : 'var(--bg-color)', border: `1px solid ${colGroups[key] ? 'rgba(249,115,22,0.35)' : 'var(--border-color)'}`, transition: 'all 0.15s' }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `2px solid ${colGroups[key] ? '#f97316' : 'var(--border-color)'}`, background: colGroups[key] ? '#f97316' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {colGroups[key] && <Check size={12} color="#fff" strokeWidth={3} />}
                    </span>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'statuses' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>Platform-Wise Status Filters</h4>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>Select statuses to export per platform (leave empty to export all records):</p>
                </div>
                {statusFilters.length > 0 && (
                  <button onClick={() => setStatusFilters([])} style={{ fontSize: '0.73rem', color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                    Clear Selection ({statusFilters.length})
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Object.entries(PLATFORM_META)
                  .filter(([pKey]) => activePlatforms.includes(pKey))
                  .map(([pKey, meta]) => {
                    const statuses = SPEC_STATUS_LIST[pKey] || [];
                    const pfxMap = { email: 'EM_', whatsapp: 'WA_', facebook: 'FB_', instagram: 'IG_', linkedin: 'LI_', website: 'WEB_', phone: 'PH_' };
                    const pfx = pfxMap[pKey] || '';

                    return (
                      <div key={pKey} style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: meta.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{meta.emoji}</span> {meta.label} Statuses
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {statuses.filter(s => statusFilters.includes(s) || statusFilters.includes(`${pfx}${s}`)).length} selected
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {statuses.map(s => {
                            const cfg = getStatusCfg(s, pKey);
                            const valWithPfx = `${pfx}${s}`;
                            const isSelected = statusFilters.includes(s) || statusFilters.includes(valWithPfx);
                            return (
                              <button
                                key={s}
                                onClick={() => toggleStatus(valWithPfx)}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 20,
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: isSelected ? cfg.color : 'var(--surface-color)',
                                  color: isSelected ? '#fff' : cfg.color,
                                  border: `1px solid ${isSelected ? cfg.color : cfg.border}`,
                                  transition: 'all 0.15s',
                                  boxShadow: isSelected ? `0 2px 6px ${cfg.color}35` : 'none'
                                }}
                              >
                                {isSelected ? '✓ ' : ''}{cfg.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-color)' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {platforms.length} platform{platforms.length !== 1 ? 's' : ''} · {activeColCount} col group{activeColCount !== 1 ? 's' : ''} · {limit || 'All'} records
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
            <button onClick={() => onConfirm({ format, limit: limit ? parseInt(limit, 10) : null, platforms, status_filters: statusFilters, columns: buildColumns() })} disabled={loading}
              style={{ background: '#f97316', color: '#fff', border: 'none', padding: '0.5rem 1.3rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
              {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
              {loading ? 'Exporting…' : `Export ${format.toUpperCase()}`}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};

const JobsList = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [deletingJob, setDeletingJob] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  const fetchJobs = useCallback(() => {
    axios.get(`${API_BASE_URL}/validation/jobs?limit=200`).then(r => { setJobs(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const confirmDelete = async () => {
    if (!deletingJob) return;
    setIsDeleting(true);
    try { await axios.delete(`${API_BASE_URL}/validation/jobs/${deletingJob.id}`); setDeletingJob(null); fetchJobs(); }
    catch (err) { alert('Failed: ' + (err.response?.data?.detail || err.message)); }
    finally { setIsDeleting(false); }
  };

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const filtered = jobs.filter(j => (statusFilter === 'ALL' || j.status === statusFilter) && (!search || j.filename.toLowerCase().includes(search.toLowerCase())));

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}><RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 10 }} /><p>Loading jobs…</p></div>;

  return (
    <div className="animate-fade-in">
      {deletingJob && <DeleteModal title={`Delete Job #${deletingJob.id}`} filename={deletingJob.filename} onConfirm={confirmDelete} onCancel={() => setDeletingJob(null)} loading={isDeleting} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 10 }}>
        <div><h1 style={{ margin: 0 }}>Validation Jobs</h1><p style={{ color: 'var(--text-secondary)', margin: '0.3rem 0 0', fontSize: '0.875rem' }}>History of all bulk validation jobs</p></div>
        <Link to="/validate" className="btn btn-primary">+ New Job</Link>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
          <input type="text" className="form-control" placeholder="Search filename…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.2rem', width: 220 }} />
        </div>
        <div style={{ position: 'relative' }}>
          <Filter size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
          <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ paddingLeft: '2.2rem', appearance: 'none', width: 180 }}>
            <option value="ALL">All Status ({jobs.length})</option>
            {['COMPLETED','PROCESSING','PAUSED','PENDING','FAILED','TERMINATED'].map(s => <option key={s} value={s}>{s} ({jobs.filter(j => j.status === s).length})</option>)}
          </select>
        </div>
        <button className="btn btn-secondary" onClick={fetchJobs} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><RefreshCw size={14} /> Refresh</button>
      </div>
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>No jobs found. <Link to="/validate">Upload a file</Link> to start.</div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead><tr><th>File Name</th><th>Status</th><th>Progress</th><th style={{ color: '#10b981' }}>Valid</th><th style={{ color: '#ef4444' }}>Invalid</th><th style={{ color: '#f59e0b' }}>Catch-All</th><th style={{ color: '#6b7280' }}>Unknown</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(j => {
                const pct = j.total_records > 0 ? Math.round((j.processed_records / j.total_records) * 100) : 0;
                const isRunning = ['PROCESSING','PENDING'].includes(j.status);
                const statusColors = { COMPLETED: 'badge-success', FAILED: 'badge-danger', PAUSED: 'badge-info', TERMINATED: 'badge-unknown' };
                return (
                  <tr key={j.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/results/${j.id}`)}>
                    <td style={{ fontWeight: 600 }}>{j.filename}</td>
                    <td><span className={`badge ${statusColors[j.status] || 'badge-warning'}`}>{isRunning && <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite', marginRight: 4 }} />}{j.status}</span></td>
                    <td style={{ minWidth: 130 }}><div style={{ fontSize: '0.78rem', marginBottom: 4, color: 'var(--text-secondary)' }}>{j.processed_records}/{j.total_records} ({pct}%)</div><ProgressBar pct={pct} color={j.status === 'COMPLETED' ? '#10b981' : '#f97316'} /></td>
                    <td style={{ color: '#10b981', fontWeight: 700 }}>{j.valid_count}</td>
                    <td style={{ color: '#ef4444', fontWeight: 700 }}>{j.invalid_count}</td>
                    <td style={{ color: '#f59e0b', fontWeight: 700 }}>{j.disposable_count}</td>
                    <td style={{ color: '#6b7280', fontWeight: 700 }}>{j.unknown_count}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{new Date(j.created_at).toLocaleString()}</td>
                    <td onClick={e => e.stopPropagation()}><div style={{ display: 'flex', gap: 6 }}><Link to={`/results/${j.id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>View</Link><button onClick={() => setDeletingJob(j)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, display: 'flex' }}><Trash2 size={15} /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes modalSlideIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
};

const JobDetail = ({ jobId }) => {
  const [job, setJob] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [platformTab, setPlatformTab] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [controlLoading, setControlLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingThisJob, setIsDeletingThisJob] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const intervalRef = useRef(null);
  const navigate = useNavigate();

  const fetchJobData = useCallback(async () => {
    try {
      const [jobRes, resultsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/validation/jobs/${jobId}`),
        axios.get(`${API_BASE_URL}/validation/jobs/${jobId}/results?skip=0&limit=5000`),
      ]);
      setJob(jobRes.data); setResults(resultsRes.data); setFetchError(''); setLoading(false);
      const running = ['PROCESSING', 'PENDING', 'PAUSED'].includes(jobRes.data.status);
      if (!running && intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    } catch (err) { setLoading(false); setFetchError(err.response?.data?.detail || err.message || 'Could not load'); }
  }, [jobId]);

  useEffect(() => { fetchJobData(); intervalRef.current = setInterval(fetchJobData, LIVE_POLL_INTERVAL); return () => { if (intervalRef.current) clearInterval(intervalRef.current); }; }, [fetchJobData]);

  const sendControl = async action => {
    setControlLoading(true);
    try { await axios.post(`${API_BASE_URL}/validation/jobs/${jobId}/control`, { action }); await fetchJobData(); }
    catch (err) { alert(err.response?.data?.detail || `Failed to ${action}`); }
    finally { setControlLoading(false); }
  };

  const confirmDeleteThisJob = async () => {
    setIsDeletingThisJob(true);
    try { await axios.delete(`${API_BASE_URL}/validation/jobs/${jobId}`); navigate('/results'); }
    catch (err) { alert('Failed: ' + (err.response?.data?.detail || err.message)); setIsDeletingThisJob(false); }
  };

  const handleExport = async options => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem('auth_token');
      const resp = await fetch(`${API_BASE_URL}/validation/jobs/${jobId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ format: options.format, limit: options.limit, platforms: options.platforms, status_filters: options.status_filters, columns: options.columns }),
      });
      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `validated_${job.filename}.${options.format}`;
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url);
    } catch (err) { alert('Export failed: ' + err.message); }
    finally { setIsExporting(false); setShowExportModal(false); }
  };

  const toggleRow = id => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}><RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 10 }} /><p>Loading job…</p></div>;
  if (fetchError || !job) return <div className="card" style={{ textAlign: 'center', padding: '3rem' }}><h3 style={{ color: '#ef4444' }}>{fetchError || 'Job not found'}</h3><Link to="/results" className="btn btn-secondary">← Back</Link></div>;

  const pct = job.total_records > 0 ? Math.round((job.processed_records / job.total_records) * 100) : 0;
  const isRunning = ['PROCESSING','PENDING'].includes(job.status);
  const isPaused = job.status === 'PAUSED';
  const isActive = isRunning || isPaused;
  const colMap = job.column_mapping || {};
  const hasFB = !!colMap.facebook, hasIG = !!colMap.instagram, hasLI = !!colMap.linkedin;
  const hasWA = !!colMap.whatsapp, hasWEB = !!colMap.website, hasPH = !!colMap.phone, hasEM = !!colMap.email;

  const activePlatforms = ['email','whatsapp','facebook','instagram','linkedin','website','phone'].filter(p => ({ email: hasEM, whatsapp: hasWA, facebook: hasFB, instagram: hasIG, linkedin: hasLI, website: hasWEB, phone: hasPH }[p]));

  const counts = results.reduce((acc, r) => {
    const normE = normalizeEmailStatus(r.status);
    if (normE) acc[`EM_${normE}`] = (acc[`EM_${normE}`] || 0) + 1;
    const fbS = r.facebook_data?.status;  if (fbS)  acc[`FB_${fbS}`]  = (acc[`FB_${fbS}`]  || 0) + 1;
    const igS = r.instagram_data?.status; if (igS)  acc[`IG_${igS}`]  = (acc[`IG_${igS}`]  || 0) + 1;
    const liS = r.linkedin_data?.status;  if (liS)  acc[`LI_${liS}`]  = (acc[`LI_${liS}`]  || 0) + 1;
    const waS = r.whatsapp_data?.status;  if (waS)  acc[`WA_${waS}`]  = (acc[`WA_${waS}`]  || 0) + 1;
    const webS = r.website_data?.status;  if (webS) acc[`WEB_${webS}`] = (acc[`WEB_${webS}`] || 0) + 1;
    const phS = r.phone_data?.status;     if (phS)  acc[`PH_${phS}`]  = (acc[`PH_${phS}`]  || 0) + 1;
    return acc;
  }, {});

  const platformCounts = {
    ALL: results.length,
    email: results.filter(r => r.email).length,
    whatsapp: results.filter(r => r.whatsapp_data?.status && r.whatsapp_data.status !== 'NOT_CHECKED').length || results.filter(r => r.whatsapp_data).length,
    facebook: results.filter(r => r.facebook_data?.status).length,
    instagram: results.filter(r => r.instagram_data?.status).length,
    linkedin: results.filter(r => r.linkedin_data?.status).length,
    website: results.filter(r => r.website_data?.status).length,
    phone: results.filter(r => r.phone_data?.status).length,
  };

  const resultStatuses = [...new Set(results.map(r => normalizeEmailStatus(r.status)))];

  const buildFilterGroups = () => {
    const g = [];
    const pMap = [
      { key: 'email',     prefix: 'EM_', name: 'Email',     cfg: EMAIL_STATUS_CFG,     active: hasEM },
      { key: 'whatsapp',  prefix: 'WA_', name: 'WhatsApp',  cfg: WHATSAPP_STATUS_CFG,  active: hasWA },
      { key: 'facebook',  prefix: 'FB_', name: 'Facebook',  cfg: FACEBOOK_STATUS_CFG,  active: hasFB },
      { key: 'instagram', prefix: 'IG_', name: 'Instagram', cfg: INSTAGRAM_STATUS_CFG, active: hasIG },
      { key: 'linkedin',  prefix: 'LI_', name: 'LinkedIn',  cfg: LINKEDIN_STATUS_CFG,  active: hasLI },
      { key: 'website',   prefix: 'WEB_', name: 'Website',  cfg: WEBSITE_STATUS_CFG,  active: hasWEB },
      { key: 'phone',     prefix: 'PH_', name: 'Phone',     cfg: PHONE_STATUS_CFG,     active: hasPH },
    ];

    pMap.forEach(p => {
      if (!p.active) return;
      if (platformTab !== 'ALL' && platformTab !== p.key) return;

      const opts = (SPEC_STATUS_LIST[p.key] || [])
        .map(s => {
          const cnt = counts[`${p.prefix}${s}`] || 0;
          const cfg = (p.cfg[s] || {});
          return {
            value: `${p.prefix}${s}`,
            label: `${p.name}: ${cfg.label || s} (${cnt})`,
            shortLabel: `${p.name}: ${cfg.label || s} (${cnt})`,
            count: cnt,
            statusKey: s,
            platformKey: p.key
          };
        }); // Show all specified statuses for complete UI filtering

      if (opts.length > 0) {
        g.push({ label: p.name, key: p.key, options: opts });
      }
    });
    return g;
  };

  const filterGroups = buildFilterGroups();

  const matchFilter = r => {
    // Platform Tab Filter
    if (platformTab !== 'ALL') {
      if (platformTab === 'email'     && !r.email) return false;
      if (platformTab === 'facebook'  && !r.facebook_data?.status) return false;
      if (platformTab === 'instagram' && !r.instagram_data?.status) return false;
      if (platformTab === 'linkedin'  && !r.linkedin_data?.status) return false;
      if (platformTab === 'whatsapp'  && !r.whatsapp_data?.status) return false;
      if (platformTab === 'website'   && !r.website_data?.status) return false;
      if (platformTab === 'phone'     && !r.phone_data?.status) return false;
    }

    // Status Filter Chip
    if (statusFilter === 'ALL') return true;
    if (statusFilter.startsWith('EM_'))  return normalizeEmailStatus(r.status) === statusFilter.replace('EM_', '');
    if (statusFilter.startsWith('FB_'))  return r.facebook_data?.status  === statusFilter.replace('FB_', '');
    if (statusFilter.startsWith('IG_'))  return r.instagram_data?.status === statusFilter.replace('IG_', '');
    if (statusFilter.startsWith('LI_'))  return r.linkedin_data?.status  === statusFilter.replace('LI_', '');
    if (statusFilter.startsWith('WA_'))  return r.whatsapp_data?.status  === statusFilter.replace('WA_', '');
    if (statusFilter.startsWith('WEB_')) return r.website_data?.status   === statusFilter.replace('WEB_', '');
    if (statusFilter.startsWith('PH_'))  return r.phone_data?.status     === statusFilter.replace('PH_', '');
    return normalizeEmailStatus(r.status) === statusFilter;
  };

  const filteredResults = results.filter(r => {
    const ms = !searchTerm || [
      r.email,
      JSON.stringify(r.original_data || {}),
      JSON.stringify(r.facebook_data || {}), JSON.stringify(r.instagram_data || {}),
      JSON.stringify(r.linkedin_data || {}), JSON.stringify(r.whatsapp_data || {}),
      JSON.stringify(r.website_data || {}), JSON.stringify(r.phone_data || {}),
    ].some(s => (s || '').toLowerCase().includes(searchTerm.toLowerCase()));
    return ms && matchFilter(r);
  });

  const jColor = { COMPLETED: '#10b981', FAILED: '#ef4444', PAUSED: '#3b82f6', TERMINATED: '#6b7280', PROCESSING: '#f97316', PENDING: '#f59e0b' }[job.status] || '#6b7280';

  return (
    <div className="animate-fade-in">
      {showDeleteModal && <DeleteModal title={`Delete Job #${jobId}`} filename={job.filename} onConfirm={confirmDeleteThisJob} onCancel={() => setShowDeleteModal(false)} loading={isDeletingThisJob} />}
      {showExportModal && <ExportModal onConfirm={handleExport} onCancel={() => setShowExportModal(false)} loading={isExporting} activePlatforms={activePlatforms} resultStatuses={resultStatuses} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes modalSlideIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .live-pulse { animation: lp 1.4s ease-in-out infinite; }
        @keyframes lp { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <Link to="/results" style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', textDecoration: 'none' }}><ArrowLeft size={18} /> Back</Link>
        <h1 style={{ margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '1.3rem' }}>{job.filename}</h1>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', background: `${jColor}15`, color: jColor, border: `1px solid ${jColor}44`, borderRadius: 20, fontSize: '0.78rem', fontWeight: 700 }}>
          {isRunning && <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />}{job.status}
        </span>
        {isActive && (
          <div style={{ display: 'flex', gap: 8 }}>
            {isRunning && <button className="btn btn-secondary" onClick={() => sendControl('pause')} disabled={controlLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem' }}><Pause size={13} /> Pause</button>}
            {isPaused && <button className="btn btn-primary" onClick={() => sendControl('resume')} disabled={controlLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem' }}><Play size={13} /> Resume</button>}
            <button onClick={() => { if (window.confirm('Terminate this job?')) sendControl('terminate'); }} disabled={controlLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.4rem 0.85rem', fontSize: '0.82rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}><Square size={13} /> Terminate</button>
          </div>
        )}
        <button onClick={() => setShowAnalytics(prev => !prev)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
          <BarChart2 size={15} color="#f97316" /> {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
        </button>
        <button className="btn btn-primary" onClick={() => setShowExportModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}><Download size={15} /> Export Results</button>
        <button onClick={() => setShowDeleteModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.45rem 0.85rem', fontSize: '0.82rem', background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}><Trash2 size={14} /> Delete</button>
      </div>

      {isActive && (
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem 1.3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{isPaused ? '⏸ Paused' : '⚡ Processing…'} — {job.processed_records} of {job.total_records} rows</span>
            <span style={{ fontWeight: 700, color: '#f97316' }}>{pct}%</span>
          </div>
          <ProgressBar pct={pct} color={isPaused ? '#3b82f6' : '#f97316'} />
        </div>
      )}

      {/* Analytics Section with Multi-Platform Graphs */}
      {showAnalytics && <AnalyticsSection results={results} activePlatforms={activePlatforms} />}

      {/* Overview Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: '0.8rem', marginBottom: '1.25rem' }}>
        <StatCard title="Job Status" value={job.status} color={jColor} icon={Shield} sub={`${pct}% done`} />
        <StatCard title="Total" value={job.total_records} color="#6b7280" icon={BarChart2} />
        {hasEM && <StatCard title="Valid Email" value={job.valid_count} color="#10b981" icon={ShieldCheck} />}
        {hasEM && <StatCard title="Invalid Email" value={job.invalid_count} color="#ef4444" icon={ShieldX} />}
        {hasEM && <StatCard title="Catch-All" value={counts['EM_CATCH_ALL'] || job.disposable_count || 0} color="#f59e0b" icon={ShieldAlert} />}
        {hasEM && <StatCard title="Risky" value={counts['EM_RISKY'] || 0} color="#f97316" icon={AlertTriangle} />}
        {hasFB && <StatCard title="FB Found" value={counts['FB_FACEBOOK_FOUND'] || 0} color="#1877f2" icon={TrendingUp} sub={`${counts['FB_FACEBOOK_NOT_FOUND'] || 0} not found`} />}
        {hasIG && <StatCard title="IG Active" value={counts['IG_ACTIVE_PROFILE'] || 0} color="#e1306c" icon={Camera} sub={`${counts['IG_NOT_FOUND'] || 0} not found`} />}
        {hasLI && <StatCard title="LI Found" value={counts['LI_PROFILE_FOUND'] || 0} color="#0077b5" icon={Briefcase} sub={`${counts['LI_PROFILE_NOT_FOUND'] || 0} not found`} />}
        {hasWA && <StatCard title="WA Exists" value={counts['WA_WHATSAPP_EXISTS'] || 0} color="#25d366" icon={Phone} sub={`${counts['WA_WHATSAPP_NOT_FOUND'] || 0} not found`} />}
        {hasWEB && <StatCard title="Web Active" value={counts['WEB_WEB_ACTIVE'] || 0} color="#8b5cf6" icon={Globe} sub={`${counts['WEB_WEB_INACTIVE'] || 0} inactive`} />}
        {hasPH && <StatCard title="Phone Valid" value={counts['PH_PHONE_VALID'] || 0} color="#10b981" icon={Smartphone} sub={`${counts['PH_PHONE_INVALID'] || 0} invalid`} />}
      </div>

      <div className="card">
        {/* Platform Selector Bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', overflowX: 'auto', paddingBottom: 6, borderBottom: '1px solid var(--border-color)' }}>
          <button onClick={() => { setPlatformTab('ALL'); setStatusFilter('ALL'); }}
            style={{ padding: '0.5rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, background: platformTab === 'ALL' ? '#f97316' : 'var(--bg-color)', color: platformTab === 'ALL' ? '#fff' : 'var(--text-secondary)', border: `1.5px solid ${platformTab === 'ALL' ? '#f97316' : 'var(--border-color)'}`, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
            All Platforms ({platformCounts.ALL})
          </button>
          {activePlatforms.map(p => {
            const meta = PLATFORM_META[p];
            const active = platformTab === p;
            const cnt = platformCounts[p] || 0;
            return (
              <button key={p} onClick={() => { setPlatformTab(p); setStatusFilter('ALL'); }}
                style={{ padding: '0.5rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, background: active ? `${meta.color}18` : 'var(--bg-color)', color: active ? meta.color : 'var(--text-secondary)', border: `1.5px solid ${active ? meta.color : 'var(--border-color)'}`, transition: 'all 0.15s', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, boxShadow: active ? `0 2px 8px ${meta.color}25` : 'none' }}>
                <span>{meta.emoji}</span> {meta.label} ({cnt})
              </button>
            );
          })}
        </div>

        {/* Filter & Search Bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
              <input type="text" className="form-control" placeholder="Search records…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: '2.1rem', width: 220, fontSize: '0.85rem' }} />
            </div>

            {(statusFilter !== 'ALL' || platformTab !== 'ALL') && (
              <button onClick={() => { setStatusFilter('ALL'); setPlatformTab('ALL'); }} style={{ fontSize: '0.78rem', color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '0.4rem 0.8rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                <X size={13} /> Reset Filters
              </button>
            )}

            {isRunning && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', color: '#f97316', borderRadius: 20, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316' }} className="live-pulse" /> LIVE · {results.length} loaded
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={fetchJobData} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem' }}><RefreshCw size={13} /> Refresh</button>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Showing {filteredResults.length} of {results.length}</span>
          </div>
        </div>

        {/* Quick Filter Status Chips */}
        {filterGroups.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: '1rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-color)' }}>
            {filterGroups.flatMap(g => g.options).map(opt => {
              const isSelected = statusFilter === opt.value;
              const cfg = getStatusCfg(opt.statusKey, opt.platformKey);
              return (
                <button key={opt.value} onClick={() => setStatusFilter(isSelected ? 'ALL' : opt.value)}
                  style={{ padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, background: isSelected ? cfg.color : cfg.bg, color: isSelected ? '#fff' : cfg.color, border: `1px solid ${cfg.border}`, transition: 'all 0.15s', opacity: opt.count === 0 ? 0.6 : 1, boxShadow: isSelected ? `0 2px 8px ${cfg.color}44` : 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span>{PLATFORM_META[opt.platformKey]?.emoji}</span> {opt.shortLabel}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ fontSize: '0.81rem' }}>
            <thead>
              <tr>
                {hasEM  && (platformTab === 'ALL' || platformTab === 'email')     && <th><Mail size={12} style={{ marginRight: 4, verticalAlign: 'middle', color: '#f97316' }} />Email</th>}
                {hasFB  && (platformTab === 'ALL' || platformTab === 'facebook')  && <th><FacebookIcon size={12} style={{ marginRight: 4 }} />Facebook</th>}
                {hasIG  && (platformTab === 'ALL' || platformTab === 'instagram') && <th><Camera size={12} style={{ marginRight: 4, color: '#e1306c', verticalAlign: 'middle' }} />Instagram</th>}
                {hasLI  && (platformTab === 'ALL' || platformTab === 'linkedin')  && <th><Briefcase size={12} style={{ marginRight: 4, color: '#0077b5', verticalAlign: 'middle' }} />LinkedIn</th>}
                {hasWA  && (platformTab === 'ALL' || platformTab === 'whatsapp')  && <th><Phone size={12} style={{ marginRight: 4, color: '#25d366', verticalAlign: 'middle' }} />WhatsApp</th>}
                {hasWEB && (platformTab === 'ALL' || platformTab === 'website')   && <th><Globe size={12} style={{ marginRight: 4, color: '#8b5cf6', verticalAlign: 'middle' }} />Website</th>}
                {hasPH  && (platformTab === 'ALL' || platformTab === 'phone')     && <th><Smartphone size={12} style={{ marginRight: 4, color: '#10b981', verticalAlign: 'middle' }} />Phone</th>}
                <th><Eye size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Evidence</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>{isRunning ? 'Results will appear as verification processes…' : 'No results match your filters.'}</td></tr>
              ) : filteredResults.map(r => {
                const hasMultiEmail = r.email_statuses && r.email_statuses.length > 1;
                const isExpanded = expandedRows[r.id];
                const emailNormStatus = normalizeEmailStatus(r.status);
                return (
                  <React.Fragment key={r.id}>
                    <tr style={{ verticalAlign: 'top' }}>
                      {hasEM && (platformTab === 'ALL' || platformTab === 'email') && (
                        <td style={{ maxWidth: 240 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <StatusBadge status={emailNormStatus} platform="email" />
                            {r.email && <span style={{ fontFamily: 'monospace', fontSize: '0.77rem', wordBreak: 'break-all' }}>{r.email}</span>}
                            {r.email_data?.method && (
                              <span style={{ fontSize: '0.67rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Cpu size={9} /> {r.email_data.method}
                                {r.email_data.confidence && <ConfidenceBadge confidence={r.email_data.confidence} />}
                              </span>
                            )}
                            {hasMultiEmail && (
                              <button onClick={() => toggleRow(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#f97316', fontSize: '0.7rem', padding: 0, fontWeight: 600 }}>
                                {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />} {r.email_statuses.length} emails
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                      {hasFB && (platformTab === 'ALL' || platformTab === 'facebook') && (
                        <td>
                          <StatusBadge status={r.facebook_data?.status} platform="facebook" />
                          {r.facebook_data?.url && <a href={r.facebook_data.url} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: '0.68rem', color: '#1877f2', marginTop: 3, wordBreak: 'break-all' }}>{r.facebook_data.url.replace('https://www.facebook.com/', '@').slice(0, 28)}</a>}
                          {r.facebook_data?.confidence && <div style={{ marginTop: 3 }}><ConfidenceBadge confidence={r.facebook_data.confidence} /></div>}
                        </td>
                      )}
                      {hasIG && (platformTab === 'ALL' || platformTab === 'instagram') && (
                        <td>
                          <StatusBadge status={r.instagram_data?.status} platform="instagram" />
                          {r.instagram_data?.url && <a href={r.instagram_data.url} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: '0.68rem', color: '#e1306c', marginTop: 3, wordBreak: 'break-all' }}>{r.instagram_data.url.replace('https://www.instagram.com/', '@').slice(0, 28)}</a>}
                          {r.instagram_data?.confidence && <div style={{ marginTop: 3 }}><ConfidenceBadge confidence={r.instagram_data.confidence} /></div>}
                        </td>
                      )}
                      {hasLI && (platformTab === 'ALL' || platformTab === 'linkedin') && (
                        <td>
                          <StatusBadge status={r.linkedin_data?.status} platform="linkedin" />
                          {r.linkedin_data?.url && <a href={r.linkedin_data.url} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: '0.68rem', color: '#0077b5', marginTop: 3, wordBreak: 'break-all' }}>{r.linkedin_data.url.replace('https://www.linkedin.com/in/', '').slice(0, 28)}</a>}
                          {r.linkedin_data?.confidence && <div style={{ marginTop: 3 }}><ConfidenceBadge confidence={r.linkedin_data.confidence} /></div>}
                        </td>
                      )}
                      {hasWA && (platformTab === 'ALL' || platformTab === 'whatsapp') && (
                        <td>
                          <StatusBadge status={r.whatsapp_data?.status} platform="whatsapp" />
                          {r.whatsapp_data?.number && <span style={{ display: 'block', fontSize: '0.68rem', fontFamily: 'monospace', color: '#25d366', marginTop: 3 }}>{r.whatsapp_data.number}</span>}
                          {r.whatsapp_data?.confidence && <div style={{ marginTop: 3 }}><ConfidenceBadge confidence={r.whatsapp_data.confidence} /></div>}
                        </td>
                      )}
                      {hasWEB && (platformTab === 'ALL' || platformTab === 'website') && (
                        <td>
                          <StatusBadge status={r.website_data?.status} platform="website" />
                          {r.website_data?.url && <a href={r.website_data.url} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: '0.68rem', color: '#8b5cf6', marginTop: 3, wordBreak: 'break-all' }}>{r.website_data.url.replace(/^https?:\/\//, '').slice(0, 28)}</a>}
                          {r.website_data?.title && <span style={{ display: 'block', fontSize: '0.66rem', color: 'var(--text-secondary)', marginTop: 2 }}>{r.website_data.title.slice(0, 30)}</span>}
                          {r.website_data?.confidence && <div style={{ marginTop: 3 }}><ConfidenceBadge confidence={r.website_data.confidence} /></div>}
                        </td>
                      )}
                      {hasPH && (platformTab === 'ALL' || platformTab === 'phone') && (
                        <td>
                          <StatusBadge status={r.phone_data?.status} platform="phone" />
                          {r.phone_data?.number && <span style={{ display: 'block', fontSize: '0.68rem', fontFamily: 'monospace', color: '#10b981', marginTop: 3 }}>{r.phone_data.number}</span>}
                          {r.phone_data?.type && <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)' }}>{r.phone_data.type}</span>}
                          {r.phone_data?.confidence && <div style={{ marginTop: 3 }}><ConfidenceBadge confidence={r.phone_data.confidence} /></div>}
                        </td>
                      )}
                      <td>
                        <button onClick={() => toggleRow(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: isExpanded ? 'rgba(249,115,22,0.1)' : 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: 8, cursor: 'pointer', color: isExpanded ? '#f97316' : 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, padding: '4px 8px', transition: 'all 0.15s' }}>
                          <Eye size={11} />{isExpanded ? 'Hide' : 'Details'}{isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr style={{ background: 'rgba(249,115,22,0.02)' }}>
                        <td colSpan={10} style={{ padding: '0.75rem 1rem 1rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
                            {hasEM && r.email_data && (platformTab === 'ALL' || platformTab === 'email') && (
                              <div>
                                <EvidencePanel data={{ ...r.email_data, status: emailNormStatus }} platform="email" label="📧 Email" color="#f97316" />
                                {hasMultiEmail && r.email_statuses && (
                                  <div style={{ marginTop: 8, border: '1px solid rgba(249,115,22,0.2)', borderRadius: 8, overflow: 'hidden' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f97316', padding: '6px 10px', background: 'rgba(249,115,22,0.06)' }}>Per-Address Breakdown</div>
                                    {r.email_statuses.map((es, idx) => (
                                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderTop: idx > 0 ? '1px solid var(--border-color)' : 'none' }}>
                                        <StatusBadge status={normalizeEmailStatus(es.status)} platform="email" />
                                        <span style={{ fontFamily: 'monospace', fontSize: '0.73rem', flex: 1 }}>{es.email}</span>
                                        <span style={{ fontSize: '0.69rem', color: 'var(--text-secondary)' }}>{es.reason?.slice(0, 40)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {hasFB  && r.facebook_data  && (platformTab === 'ALL' || platformTab === 'facebook')  && <EvidencePanel data={r.facebook_data}  platform="facebook"  label="🔵 Facebook"  color="#1877f2" />}
                            {hasIG  && r.instagram_data && (platformTab === 'ALL' || platformTab === 'instagram') && <EvidencePanel data={r.instagram_data} platform="instagram" label="📸 Instagram" color="#e1306c" />}
                            {hasLI  && r.linkedin_data  && (platformTab === 'ALL' || platformTab === 'linkedin')  && <EvidencePanel data={r.linkedin_data}  platform="linkedin"  label="💼 LinkedIn"  color="#0077b5" />}
                            {hasWA  && r.whatsapp_data  && (platformTab === 'ALL' || platformTab === 'whatsapp')  && <EvidencePanel data={r.whatsapp_data}  platform="whatsapp"  label="💬 WhatsApp"  color="#25d366" />}
                            {hasWEB && r.website_data   && (platformTab === 'ALL' || platformTab === 'website')   && <EvidencePanel data={r.website_data}   platform="website"   label="🌐 Website"   color="#8b5cf6" />}
                            {hasPH  && r.phone_data     && (platformTab === 'ALL' || platformTab === 'phone')     && <EvidencePanel data={r.phone_data}     platform="phone"     label="📱 Phone"     color="#10b981" />}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ValidationResults = () => {
  const { jobId } = useParams();
  return jobId ? <JobDetail jobId={jobId} /> : <JobsList />;
};

export default ValidationResults;
