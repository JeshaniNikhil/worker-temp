import React, { useState } from 'react';
import axios from 'axios';
import { Search, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';

const API_BASE_URL = '/api';

const SingleValidation = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleValidate = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address structure.');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/validation/single`, { email });
      setResult(response.data);
    } catch (err) {
      console.error(err);
      let errMsg = 'An error occurred during validation.';
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') errMsg = err.response.data.detail;
        else if (Array.isArray(err.response.data.detail)) errMsg = err.response.data.detail[0]?.msg || errMsg;
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    if (status?.includes('VALID (Catch-All)')) return <AlertTriangle className="status-icon warning" size={48} />;
    if (status === 'VALID') return <CheckCircle className="status-icon success" size={48} />;
    if (status === 'NOT VALID') return <XCircle className="status-icon danger" size={48} />;
    return <AlertTriangle className="status-icon warning" size={48} />;
  };

  const getStatusColorClass = (status) => {
    if (status?.includes('VALID (Catch-All)')) return 'result-warning';
    if (status === 'VALID') return 'result-success';
    if (status === 'NOT VALID') return 'result-danger';
    return 'result-warning';
  };

  return (
    <div className="animate-fade-in premium-container">
      <div className="premium-header">
        <h1>Single Email Verifier</h1>
        <p>Instantly check an email's validity, mailbox existence, and domain catch-all status with deep SMTP pings.</p>
      </div>

      <div className="glass-card main-verifier-card">
        <form onSubmit={handleValidate} className="verifier-form">
          <div className="input-glow-wrapper">
            <Search className="input-icon" size={20} />
            <input
              type="text"
              placeholder="Enter email address (e.g., test@example.com)"
              className="premium-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <button 
            type="submit" 
            className={`premium-btn ${isLoading ? 'btn-loading' : ''}`}
            disabled={isLoading || !email}
          >
            {isLoading ? 'Verifying...' : 'Verify Now'}
          </button>
        </form>
        {error && <div className="error-banner animate-slide-down">{error}</div>}
      </div>

      {result && (
        <div className={`glass-card result-card animate-slide-up ${getStatusColorClass(result.status)}`}>
          <div className="result-header">
            {getStatusIcon(result.status)}
            <div className="result-title">
              <h2>{result.status}</h2>
              <p className="email-display">{result.email}</p>
            </div>
          </div>
          <div className="result-details">
            <div className="detail-item">
              <span className="detail-label">Detailed Reason</span>
              <span className="detail-value">{result.reason}</span>
            </div>
            <div className="detail-item time-item">
              <span className="detail-label"><Clock size={14} /> Execution Time</span>
              <span className="detail-value">{result.execution_time_ms} ms</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SingleValidation;
