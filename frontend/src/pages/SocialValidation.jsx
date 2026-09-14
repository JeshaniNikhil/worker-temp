import React, { useState } from 'react';
import axios from 'axios';
import {
  Search, CheckCircle, XCircle, AlertTriangle, Shield, Check, Phone, Globe
} from 'lucide-react';

const API_BASE_URL = '/api';

const SocialValidation = () => {
  const [platform, setPlatform] = useState('whatsapp');
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!target.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await axios.post(`${API_BASE_URL}/validation/social/${platform}`, { target });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred during verification.');
    } finally {
      setLoading(false);
    }
  };

  const getPlatformIcon = (plt) => {
    switch (plt) {
      case 'whatsapp': return <Phone size={20} />;
      case 'phone': return <Phone size={20} />;
      case 'instagram': return <Globe size={20} />;
      case 'facebook': return <Globe size={20} />;
      case 'linkedin': return <Globe size={20} />;
      case 'website': return <Globe size={20} />;
      default: return <Search size={20} />;
    }
  };

  const getStatusColor = (status) => {
    if (!status) return '#94a3b8';
    const s = status.toUpperCase();
    if (s.includes('VALID') || s.includes('ACTIVE') || s.includes('WHATSAPP')) return '#10b981';
    if (s.includes('INVALID') || s.includes('INACTIVE') || s.includes('NOT_')) return '#ef4444';
    return '#f59e0b';
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: '700', margin: '0 0 0.5rem 0' }}>Social & Phone Verification</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
          Deep verification for WhatsApp, Phone Numbers, Instagram, LinkedIn, and more.
        </p>
      </header>

      <div className="card" style={{ maxWidth: '800px', padding: '2rem' }}>
        <form onSubmit={handleVerify}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '0 0 150px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Platform</label>
              <select 
                className="form-control" 
                value={platform} 
                onChange={(e) => setPlatform(e.target.value)}
                style={{ appearance: 'none', width: '100%' }}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Phone Number</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="linkedin">LinkedIn</option>
                <option value="website">Website</option>
              </select>
            </div>
            
            <div style={{ flex: '1', minWidth: '250px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Target (Number / URL / Username)</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                  {getPlatformIcon(platform)}
                </div>
                <input
                  type="text"
                  className="form-control"
                  placeholder={platform === 'whatsapp' || platform === 'phone' ? '+1234567890' : 'Username or Profile URL...'}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  style={{ paddingLeft: '3rem', width: '100%' }}
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading || !target.trim()}
              style={{ width: '160px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              {loading ? (
                <>
                  <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  Verifying...
                </>
              ) : (
                <>
                  <Shield size={16} />
                  Verify Now
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', borderRadius: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
              <XCircle size={18} />
              <span style={{ fontWeight: 600 }}>Error</span>
            </div>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{error}</p>
          </div>
        )}
      </div>

      {result && (
        <div className="card animate-fade-in" style={{ marginTop: '2rem', maxWidth: '800px', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Verification Result
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{target}</p>
            </div>
            
            <div style={{ 
              padding: '0.5rem 1rem', 
              borderRadius: '2rem', 
              background: `${getStatusColor(result.status)}20`,
              color: getStatusColor(result.status),
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <CheckCircle size={16} />
              {result.status?.toUpperCase() || 'COMPLETED'}
            </div>
          </div>

          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {Object.entries(result).map(([key, value]) => {
                if (key === 'status' || typeof value === 'object') return null;
                
                return (
                  <div key={key} style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 600 }}>
                      {key.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontWeight: 500, wordBreak: 'break-all' }}>
                      {value === true ? (
                        <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14}/> Yes</span>
                      ) : value === false ? (
                        <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}><XCircle size={14}/> No</span>
                      ) : (
                        String(value) || '-'
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {result.details && typeof result.details === 'object' && (
               <div style={{ marginTop: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                 <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 600 }}>
                    Additional Details
                 </div>
                 <pre style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                   {JSON.stringify(result.details, null, 2)}
                 </pre>
               </div>
            )}
            
            {result.raw_response && typeof result.raw_response === 'object' && (
               <div style={{ marginTop: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                 <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 600 }}>
                    Raw Response Data
                 </div>
                 <pre style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                   {JSON.stringify(result.raw_response, null, 2)}
                 </pre>
               </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default SocialValidation;
