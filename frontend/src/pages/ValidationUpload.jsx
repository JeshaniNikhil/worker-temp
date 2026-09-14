import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  UploadCloud, ChevronDown, CheckCircle, AlertCircle, Loader2,
  Info, Camera, Briefcase, Phone, Mail, FileSpreadsheet, X, ToggleLeft, ToggleRight,
  Clock, Gauge, Zap, Shield, Sparkles, Globe, Smartphone
} from 'lucide-react';

const FacebookIcon = ({ size = 16, color = '#1877f2', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', ...style }}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const API_BASE_URL = '/api';
const ACCEPT_TYPES = '.csv,.xlsx,.xls';

const ValidationUpload = () => {
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState(''); // 'csv' | 'xlsx'
  const [csvColumns, setCsvColumns] = useState([]);
  const [xlsxSheets, setXlsxSheets] = useState([]);
  const [xlsxColumnsBySheet, setXlsxColumnsBySheet] = useState({});
  const [selectedSheet, setSelectedSheet] = useState('');
  const [rowCount, setRowCount] = useState(0);
  const [b64Content, setB64Content] = useState('');       // xlsx base64
  const [csvContent, setCsvContent] = useState('');       // csv text

  // Column selections
  const [emailColumn, setEmailColumn] = useState('');
  const [facebookColumn, setFacebookColumn] = useState('');
  const [instagramColumn, setInstagramColumn] = useState('');
  const [linkedinColumn, setLinkedinColumn] = useState('');
  const [whatsappColumn, setWhatsappColumn] = useState('');
  const [websiteColumn, setWebsiteColumn] = useState('');
  const [phoneColumn, setPhoneColumn] = useState('');

  // Toggle Switches for which checks to execute
  const [verifyEmail, setVerifyEmail] = useState(true);
  const [verifyFacebook, setVerifyFacebook] = useState(true);
  const [verifyInstagram, setVerifyInstagram] = useState(true);
  const [verifyLinkedin, setVerifyLinkedin] = useState(true);
  const [verifyWhatsapp, setVerifyWhatsapp] = useState(true);
  const [verifyWebsite, setVerifyWebsite] = useState(true);
  const [verifyPhone, setVerifyPhone] = useState(true);

  // Dynamic Rate Limit State (emails per minute)
  const [emailsPerMinute, setEmailsPerMinute] = useState(10);

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // ── CSV parser ─────────────────────────────────────────────────────────
  const parseCsvHeaders = (csvText) => {
    const firstLine = csvText.split(/\r?\n/)[0];
    const headers = [];
    let current = '';
    let inQuotes = false;
    for (const ch of firstLine) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { headers.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    if (current.trim()) headers.push(current.trim());
    return headers;
  };

  const countCsvRows = (csvText) =>
    csvText.split(/\r?\n/).slice(1).filter(l => l.trim().length > 0).length;

  // ── Auto-detect column by keyword ─────────────────────────────────────
  const autoDetect = (cols, keywords) =>
    cols.find(h => keywords.some(kw => h.toLowerCase().includes(kw))) || '';

  // ── Apply sheet selection (XLSX) ───────────────────────────────────────
  const applySheet = useCallback((sheetName, columnsBySheet) => {
    setSelectedSheet(sheetName);
    const cols = columnsBySheet[sheetName] || [];
    setCsvColumns(cols);
    setEmailColumn(autoDetect(cols, ['email', 'mail', 'e-mail']));
    setFacebookColumn(autoDetect(cols, ['facebook', 'fb']));
    setInstagramColumn(autoDetect(cols, ['instagram', 'ig', 'insta']));
    setLinkedinColumn(autoDetect(cols, ['linkedin', 'linked in', 'li']));
    setWhatsappColumn(autoDetect(cols, ['whatsapp', 'whats app', 'wa']));
    setWebsiteColumn(autoDetect(cols, ['website', 'site', 'url', 'domain']));
    setPhoneColumn(autoDetect(cols, ['phone', 'mobile', 'number', 'tel']));
  }, []);

  // ── File selection ─────────────────────────────────────────────────────
  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setError('');
    setCsvColumns([]);
    setXlsxSheets([]);
    setXlsxColumnsBySheet({});
    setSelectedSheet('');
    setEmailColumn('');
    setFacebookColumn('');
    setInstagramColumn('');
    setLinkedinColumn('');
    setWhatsappColumn('');
    setWebsiteColumn('');
    setPhoneColumn('');
    setRowCount(0);
    setB64Content('');
    setCsvContent('');

    const name = selectedFile.name.toLowerCase();

    if (name.endsWith('.csv')) {
      setFileType('csv');
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        setCsvContent(text);
        const headers = parseCsvHeaders(text);
        setCsvColumns(headers);
        setEmailColumn(autoDetect(headers, ['email', 'mail', 'e-mail']));
        setFacebookColumn(autoDetect(headers, ['facebook', 'fb']));
        setInstagramColumn(autoDetect(headers, ['instagram', 'ig', 'insta']));
        setLinkedinColumn(autoDetect(headers, ['linkedin', 'linked in', 'li']));
        setWhatsappColumn(autoDetect(headers, ['whatsapp', 'whats app', 'wa']));
        setWebsiteColumn(autoDetect(headers, ['website', 'site', 'url', 'domain']));
        setPhoneColumn(autoDetect(headers, ['phone', 'mobile', 'number', 'tel']));
        setRowCount(countCsvRows(text));
      };
      reader.readAsText(selectedFile);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      setFileType('xlsx');
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        setB64Content(base64);
        try {
          const res = await axios.post(`${API_BASE_URL}/validation/inspect-xlsx`, {
            filename: selectedFile.name,
            content: base64,
          });
          const { sheets, columns_by_sheet } = res.data;
          setXlsxSheets(sheets);
          setXlsxColumnsBySheet(columns_by_sheet);
          if (sheets.length > 0) {
            applySheet(sheets[0], columns_by_sheet);
          }
          setRowCount('?');
        } catch (err) {
          setError('Could not read XLSX file. Make sure it is a valid Excel file.');
        }
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setError('Unsupported file format. Please upload a .csv or .xlsx file.');
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const handleDragLeave = () => setDragActive(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length > 0) handleFileSelect(e.dataTransfer.files[0]);
  };

  // ── Pre-Job Time Count Calculation ────────────────────────────────────────
  const calculateEstimatedDuration = () => {
    const numRows = typeof rowCount === 'number' && rowCount > 0 ? rowCount : 0;
    if (numRows === 0) return null;

    let totalSeconds = 0;
    if (verifyEmail && emailColumn) {
      const secondsPerEmail = 60.0 / Math.max(1, emailsPerMinute);
      totalSeconds = Math.ceil(numRows * secondsPerEmail);
    } else {
      // Parallel social check estimate (~0.7s per row)
      totalSeconds = Math.ceil(numRows * 0.7);
    }

    if (totalSeconds < 60) return `${totalSeconds} seconds`;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins} min${mins !== 1 ? 's' : ''} ${secs > 0 ? `${secs}s` : ''}`;
  };

  const estimatedTimeString = calculateEstimatedDuration();

  // ── Upload ─────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) { setError('Please select a file first.'); return; }
    
    const hasAnyCheckEnabled = (
      (verifyEmail && emailColumn) ||
      (verifyFacebook && facebookColumn) ||
      (verifyInstagram && instagramColumn) ||
      (verifyLinkedin && linkedinColumn) ||
      (verifyWhatsapp && whatsappColumn) ||
      (verifyWebsite && websiteColumn) ||
      (verifyPhone && phoneColumn)
    );

    if (!hasAnyCheckEnabled) {
      setError('Please select and enable at least one column to verify (Email, Facebook, Instagram, LinkedIn, WhatsApp, Website, or Phone).');
      return;
    }

    setIsUploading(true);
    setError('');
    try {
      const payload = {
        filename: file.name,
        content: fileType === 'xlsx' ? b64Content : csvContent,
        email_column: emailColumn,
        facebook_column: facebookColumn,
        instagram_column: instagramColumn,
        linkedin_column: linkedinColumn,
        whatsapp_column: whatsappColumn,
        website_column: websiteColumn,
        phone_column: phoneColumn,
        sheet_name: selectedSheet,
        verify_email: verifyEmail,
        verify_facebook: verifyFacebook,
        verify_instagram: verifyInstagram,
        verify_linkedin: verifyLinkedin,
        verify_whatsapp: verifyWhatsapp,
        verify_website: verifyWebsite,
        verify_phone: verifyPhone,
        emails_per_minute: Number(emailsPerMinute) || 10,
      };
      const response = await axios.post(`${API_BASE_URL}/validation/upload`, payload);
      navigate(`/results/${response.data.id}`);
    } catch (err) {
      let errMsg = 'Upload failed. Please try again.';
      if (err.response?.data?.detail) {
        errMsg = typeof err.response.data.detail === 'string'
          ? err.response.data.detail
          : JSON.stringify(err.response.data.detail);
      }
      setError(errMsg);
      setIsUploading(false);
    }
  };

  const currentColumns = xlsxSheets.length > 0
    ? (xlsxColumnsBySheet[selectedSheet] || [])
    : csvColumns;

  const ColSelect = ({ label, value, onChange, icon: Icon, iconColor, placeholder, enabled, onToggle }) => (
    <div style={{
      background: enabled ? 'var(--surface-color)' : 'var(--surface-color-light)',
      border: `1px solid ${enabled ? 'var(--border-color)' : '#e5e7eb'}`,
      borderRadius: 10, padding: '0.9rem 1rem', opacity: enabled ? 1 : 0.65,
      transition: 'all 0.2s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          <Icon size={16} color={iconColor} />
          {label}
        </label>
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
            cursor: 'pointer', color: enabled ? iconColor : '#9ca3af', fontWeight: 700, fontSize: '0.78rem'
          }}
        >
          {enabled ? <ToggleRight size={22} color={iconColor} /> : <ToggleLeft size={22} color="#9ca3af" />}
          <span>{enabled ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      <div style={{ position: 'relative' }}>
        {currentColumns.length > 0 ? (
          <>
            <select
              className="form-control"
              value={value}
              onChange={e => onChange(e.target.value)}
              disabled={!enabled}
              style={{ appearance: 'none', paddingRight: '2.5rem' }}
            >
              <option value="">— Select Column —</option>
              {currentColumns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
          </>
        ) : (
          <input
            type="text"
            className="form-control"
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={!enabled}
            placeholder={placeholder}
          />
        )}
        {value && enabled && (
          <button
            type="button"
            onClick={() => onChange('')}
            style={{ position: 'absolute', right: currentColumns.length > 0 ? '2rem' : '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2 }}
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in" style={{ maxWidth: '840px', margin: '0 auto' }}>
      
      {/* Header with Wolf Group Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: '1.75rem' }}>
        <img src="/wolf_logo.svg" alt="Wolf Group Logo" style={{ width: 44, height: 44 }} />
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Upload File for Bulk Validation</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '2px 0 0', fontSize: '0.88rem' }}>
            Configure custom rate limits, select column mappings, and verify emails & social links.
          </p>
        </div>
      </div>

      <div className="card">
        {/* Error message */}
        {error && (
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            background: 'rgba(239,68,68,0.08)', color: '#dc2626',
            padding: '0.9rem 1rem', borderRadius: 8, marginBottom: '1.5rem',
            border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.875rem',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            {error}
          </div>
        )}

        {/* Drop zone */}
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600 }}>File (CSV or Excel)</label>
          <div
            className={`file-upload${dragActive ? ' drag-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
            style={file ? { borderColor: 'var(--primary-color)', background: 'rgba(249,115,22,0.04)' } : {}}
          >
            {file ? (
              <>
                {fileType === 'xlsx'
                  ? <FileSpreadsheet size={40} color="var(--primary-color)" style={{ marginBottom: '0.75rem' }} />
                  : <CheckCircle size={40} color="var(--success)" style={{ marginBottom: '0.75rem' }} />
                }
                <h3 style={{ color: fileType === 'xlsx' ? 'var(--primary-color)' : 'var(--success)' }}>{file.name}</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  {(file.size / 1024).toFixed(1)} KB
                  {rowCount && rowCount !== '?' && ` · ${rowCount.toLocaleString()} rows detected`}
                  {rowCount === '?' && ' · Excel file loaded'}
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>Click to change file</p>
              </>
            ) : (
              <>
                <UploadCloud size={48} color="var(--primary-color)" style={{ marginBottom: '1rem' }} />
                <h3>Click or drag file here</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Supports .csv and .xlsx / .xls files</p>
              </>
            )}
            <input
              type="file"
              accept={ACCEPT_TYPES}
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={e => handleFileSelect(e.target.files[0])}
            />
          </div>
        </div>

        {/* XLSX sheet selector */}
        {xlsxSheets.length > 1 && (
          <div className="form-group">
            <label className="form-label">
              <FileSpreadsheet size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Select Sheet
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {xlsxSheets.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => applySheet(s, xlsxColumnsBySheet)}
                  style={{
                    padding: '0.4rem 1rem', borderRadius: 6, border: `1px solid ${s === selectedSheet ? 'var(--primary-color)' : 'var(--border-color)'}`,
                    background: s === selectedSheet ? 'rgba(249,115,22,0.1)' : 'transparent',
                    color: s === selectedSheet ? 'var(--primary-color)' : 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: s === selectedSheet ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Verification Toggles & Column Mappings */}
        {file && (
          <>
            <div style={{ margin: '1.5rem 0 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Verification Settings & Column Mapping</h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Toggle verifiers ON/OFF and map columns from your uploaded file.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <ColSelect
                label="Email Verification"
                value={emailColumn}
                onChange={setEmailColumn}
                icon={Mail}
                iconColor="var(--primary-color)"
                placeholder="e.g. Email Address"
                enabled={verifyEmail}
                onToggle={setVerifyEmail}
              />
              <ColSelect
                label="Facebook Verification"
                value={facebookColumn}
                onChange={setFacebookColumn}
                icon={FacebookIcon}
                iconColor="#1877f2"
                placeholder="e.g. Facebook URL / Username"
                enabled={verifyFacebook}
                onToggle={setVerifyFacebook}
              />
              <ColSelect
                label="Instagram Verification"
                value={instagramColumn}
                onChange={setInstagramColumn}
                icon={Camera}
                iconColor="#e1306c"
                placeholder="e.g. Instagram URL"
                enabled={verifyInstagram}
                onToggle={setVerifyInstagram}
              />
              <ColSelect
                label="LinkedIn Verification"
                value={linkedinColumn}
                onChange={setLinkedinColumn}
                icon={Briefcase}
                iconColor="#0077b5"
                placeholder="e.g. LinkedIn Profile"
                enabled={verifyLinkedin}
                onToggle={setVerifyLinkedin}
              />
              <ColSelect
                label="WhatsApp Verification"
                value={whatsappColumn}
                onChange={setWhatsappColumn}
                icon={Phone}
                iconColor="#25d366"
                placeholder="e.g. WhatsApp Number"
                enabled={verifyWhatsapp}
                onToggle={setVerifyWhatsapp}
              />
              <ColSelect
                label="Website Verification"
                value={websiteColumn}
                onChange={setWebsiteColumn}
                icon={Globe}
                iconColor="#8b5cf6"
                placeholder="e.g. Website URL"
                enabled={verifyWebsite}
                onToggle={setVerifyWebsite}
              />
              <ColSelect
                label="Phone Verification"
                value={phoneColumn}
                onChange={setPhoneColumn}
                icon={Smartphone}
                iconColor="#f59e0b"
                placeholder="e.g. Phone Number"
                enabled={verifyPhone}
                onToggle={setVerifyPhone}
              />
            </div>

            {/* Dynamic Rate Limit Selector (Only visible if Email verification is ON) */}
            {verifyEmail && emailColumn && (
              <div style={{
                background: 'var(--bg-color)', border: '1px solid var(--border-color)',
                borderRadius: 10, padding: '1.1rem 1.25rem', marginBottom: '1.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <label style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Gauge size={16} color="var(--primary-color)" />
                    Dynamic Email Verification Rate Limit
                  </label>
                  <span style={{
                    fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary-color)',
                    background: 'rgba(249,115,22,0.1)', padding: '2px 10px', borderRadius: 20
                  }}>
                    {emailsPerMinute} emails / minute ({(60 / emailsPerMinute).toFixed(1)}s delay per email)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  {[
                    { rate: 5, label: '🛡️ 5/min (Conservative)' },
                    { rate: 10, label: '⚖️ 10/min (Recommended)' },
                    { rate: 15, label: '⚡ 15/min (Moderate)' },
                    { rate: 20, label: '🚀 20/min (Fast)' },
                    { rate: 30, label: '🔥 30/min (Express)' },
                  ].map(item => (
                    <button
                      key={item.rate}
                      type="button"
                      onClick={() => setEmailsPerMinute(item.rate)}
                      style={{
                        padding: '0.4rem 0.85rem', borderRadius: 6,
                        border: `1px solid ${emailsPerMinute === item.rate ? 'var(--primary-color)' : 'var(--border-color)'}`,
                        background: emailsPerMinute === item.rate ? 'var(--primary-color)' : 'var(--surface-color)',
                        color: emailsPerMinute === item.rate ? 'white' : 'var(--text-primary)',
                        cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s'
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Custom:</span>
                  <input
                    type="range"
                    min="1"
                    max="60"
                    value={emailsPerMinute}
                    onChange={e => setEmailsPerMinute(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--primary-color)' }}
                  />
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={emailsPerMinute}
                    onChange={e => setEmailsPerMinute(Math.max(1, Math.min(60, Number(e.target.value))))}
                    style={{ width: 65, textAlign: 'center', padding: '0.2rem 0.4rem' }}
                    className="form-control"
                  />
                </div>
              </div>
            )}

            {/* Pre-Job Estimated Duration Banner */}
            {estimatedTimeString && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(249,115,22,0.08), rgba(99,102,241,0.08))',
                border: '1px solid rgba(249,115,22,0.25)', borderRadius: 10,
                padding: '1rem 1.25rem', marginBottom: '1.5rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', background: 'rgba(249,115,22,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)'
                  }}>
                    <Clock size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                      Pre-Job Duration Estimate
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Estimated Completion Time: <span style={{ color: 'var(--primary-color)' }}>~{estimatedTimeString}</span>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                  <span>{rowCount} rows</span> · {verifyEmail && emailColumn ? `Email (${emailsPerMinute}/min)` : 'Email Skipped (Fast Parallel Social)'}
                </div>
              </div>
            )}
          </>
        )}

        {/* Submit Button */}
        <div style={{ textAlign: 'right' }}>
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!file || isUploading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.8rem 2rem', fontSize: '0.98rem' }}
          >
            {isUploading ? (
              <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Dispatching Job…</>
            ) : (
              <><UploadCloud size={18} /> Start Bulk Validation</>
            )}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ValidationUpload;
