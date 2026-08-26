import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UploadCloud, ChevronDown, CheckCircle, AlertCircle, Loader2, Info } from 'lucide-react';

const API_BASE_URL = '/api';

const ValidationUpload = () => {
  const [file, setFile] = useState(null);
  const [emailColumn, setEmailColumn] = useState('');
  const [csvColumns, setCsvColumns] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [rowCount, setRowCount] = useState(0);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const parseCsvHeaders = (csvText) => {
    const firstLine = csvText.split(/\r?\n/)[0];
    const headers = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const ch = firstLine[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        headers.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) headers.push(current.trim());
    return headers;
  };

  const countCsvRows = (csvText) => {
    // Count non-empty lines after header
    const lines = csvText.split(/\r?\n/).slice(1);
    return lines.filter(l => l.trim().length > 0).length;
  };

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setError('');
    setCsvColumns([]);
    setEmailColumn('');
    setRowCount(0);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const headers = parseCsvHeaders(text);
        if (headers.length > 0) {
          setCsvColumns(headers);
          const emailLike = headers.find(h => /email|mail|e-mail/i.test(h));
          setEmailColumn(emailLike || headers[0]);
        }
        setRowCount(countCsvRows(text));
      } catch {
        // Silent fallback
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length > 0) handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) { setError('Please select a CSV file first.'); return; }
    if (!emailColumn) { setError('Please select the column containing email addresses.'); return; }

    setIsUploading(true);
    setError('');

    try {
      const fileContent = await file.text();
      const payload = { filename: file.name, content: fileContent, email_column: emailColumn };
      const response = await axios.post(`${API_BASE_URL}/validation/upload`, payload);
      navigate(`/results/${response.data.id}`);
    } catch (err) {
      console.error(err);
      let errMsg = 'Upload failed. Please try again.';
      if (err.response?.data?.detail) {
        errMsg = typeof err.response.data.detail === 'string'
          ? err.response.data.detail
          : err.response.data.detail[0]?.msg || errMsg;
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
      setIsUploading(false);
    }
  };

  // Estimate processing time (sequential, ~2s per email average)
  const estimateMins = rowCount > 0 ? Math.ceil((rowCount * 2) / 60) : null;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '640px', margin: '0 auto' }}>
      <h1>Upload CSV for Validation</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Bulk-validate email addresses from a CSV file. Results update live as each email is checked.
      </p>

      <div className="card">
        {/* Error banner */}
        {error && (
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            background: 'rgba(239,68,68,0.1)', color: '#fca5a5',
            padding: '0.9rem 1rem', borderRadius: 10, marginBottom: '1.5rem',
            border: '1px solid rgba(239,68,68,0.25)',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: '0.875rem' }}>{error}</span>
          </div>
        )}

        {/* File Drop Zone */}
        <div className="form-group">
          <label className="form-label">CSV File</label>
          <div
            className="file-upload"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
            style={{
              borderColor: file ? 'rgba(99,102,241,0.5)' : undefined,
              background: file ? 'rgba(99,102,241,0.05)' : undefined,
            }}
          >
            {file ? (
              <>
                <CheckCircle size={40} color="#10b981" style={{ marginBottom: '0.75rem' }} />
                <h3 style={{ color: '#10b981' }}>{file.name}</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  {(file.size / 1024).toFixed(1)} KB
                  {rowCount > 0 && ` · ${rowCount.toLocaleString()} rows detected`}
                </p>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Click to change file</p>
              </>
            ) : (
              <>
                <UploadCloud size={48} color="var(--primary-color)" style={{ marginBottom: '1rem' }} />
                <h3>Click or drag CSV here</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Only .csv files supported</p>
              </>
            )}
            <input
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={e => handleFileSelect(e.target.files[0])}
            />
          </div>
        </div>

        {/* Email Column Selector */}
        <div className="form-group">
          <label className="form-label">Email Column</label>
          {csvColumns.length > 0 ? (
            <div style={{ position: 'relative' }}>
              <select
                className="form-control"
                value={emailColumn}
                onChange={e => setEmailColumn(e.target.value)}
                style={{ appearance: 'none', paddingRight: '2.5rem' }}
              >
                {csvColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
              <ChevronDown size={16} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
              <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                {csvColumns.length} column(s) detected — select the one with email addresses.
              </small>
            </div>
          ) : (
            <>
              <input
                type="text"
                className="form-control"
                value={emailColumn}
                onChange={e => setEmailColumn(e.target.value)}
                placeholder="e.g., Email, Work Email, Contact"
              />
              <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                Upload a CSV file above to auto-detect columns, or enter the column name manually.
              </small>
            </>
          )}
        </div>

        {/* Info box: processing speed */}
        {rowCount > 0 && (
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '1rem',
          }}>
            <Info size={15} color="#818cf8" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
              <strong style={{ color: '#818cf8' }}>{rowCount.toLocaleString()} emails</strong> detected.{' '}
              Sequential SMTP verification with rate-limiting (safe for Contabo).{' '}
              Estimated time: <strong style={{ color: '#c084fc' }}>~{estimateMins} min{estimateMins !== 1 ? 's' : ''}</strong>.{' '}
              Results appear live as each email is verified.
            </div>
          </div>
        )}

        {/* Submit button */}
        <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!file || !emailColumn || isUploading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            {isUploading ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                Starting…
              </>
            ) : (
              <>
                <UploadCloud size={16} />
                Start Validation
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ValidationUpload;
