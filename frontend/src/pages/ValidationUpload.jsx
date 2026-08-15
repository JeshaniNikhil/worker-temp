import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UploadCloud, ChevronDown } from 'lucide-react';

const API_BASE_URL = '/api';

const ValidationUpload = () => {
  const [file, setFile] = useState(null);
  const [emailColumn, setEmailColumn] = useState('');
  const [csvColumns, setCsvColumns] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const parseCsvHeaders = (csvText) => {
    // Grab just the first line and parse as CSV (handles quoted fields)
    const firstLine = csvText.split(/\r?\n/)[0];
    // Simple CSV header parse (handles double-quoted fields)
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

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setError('');
    setCsvColumns([]);
    setEmailColumn('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const headers = parseCsvHeaders(e.target.result);
        if (headers.length > 0) {
          setCsvColumns(headers);
          // Auto-select the first column that looks like an email column
          const emailLike = headers.find(h =>
            /email|mail|e-mail/i.test(h)
          );
          setEmailColumn(emailLike || headers[0]);
        }
      } catch {
        // Silently fall back to manual entry
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a CSV file first.');
      return;
    }
    if (!emailColumn) {
      setError('Please select the column that contains email addresses.');
      return;
    }

    setIsUploading(true);
    setError('');

    const fileContent = await file.text();
    const payload = {
      filename: file.name,
      content: fileContent,
      email_column: emailColumn,
    };

    try {
      const response = await axios.post(`${API_BASE_URL}/validation/upload`, payload);
      navigate(`/results/${response.data.id}`);
    } catch (err) {
      console.error(err);
      let errMsg = 'An error occurred during upload.';
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errMsg = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          errMsg = err.response.data.detail[0]?.msg || errMsg;
        }
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
      setIsUploading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1>Upload CSV for Validation</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Upload your marketing list to check for valid email addresses before sending.
      </p>

      <div className="card">
        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {error}
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
          >
            <UploadCloud size={48} color="var(--primary-color)" style={{ marginBottom: '1rem' }} />
            <h3>{file ? file.name : 'Click or drag CSV here'}</h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              {file ? `${(file.size / 1024).toFixed(2)} KB` : 'Only .csv files are supported'}
            </p>
            <input
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={(e) => handleFileSelect(e.target.files[0])}
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
                onChange={(e) => setEmailColumn(e.target.value)}
                style={{ appearance: 'none', paddingRight: '2.5rem' }}
              >
                {csvColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
              <ChevronDown size={16} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
              <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                Detected {csvColumns.length} columns from your CSV — select the one with email addresses.
              </small>
            </div>
          ) : (
            <>
              <input
                type="text"
                className="form-control"
                value={emailColumn}
                onChange={(e) => setEmailColumn(e.target.value)}
                placeholder="e.g., Email, Work Email, Contact"
              />
              <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                Upload a CSV file above to auto-detect columns, or type the column name manually.
              </small>
            </>
          )}
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'right' }}>
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!file || !emailColumn || isUploading}
          >
            {isUploading ? 'Uploading...' : 'Start Validation'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ValidationUpload;

