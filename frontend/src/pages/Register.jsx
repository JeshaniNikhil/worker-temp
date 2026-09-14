import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Lock, UserPlus, AlertCircle, Eye, EyeOff, CheckCircle } from 'lucide-react';

const Register = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Username is required.'); return; }
    if (username.trim().length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      // Register
      await axios.post('/api/auth/register', { username: username.trim().toLowerCase(), password });
      // Auto-login after registration
      const res = await axios.post('/api/auth/login/json', { username: username.trim().toLowerCase(), password });
      localStorage.setItem('token', res.data.access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.access_token}`;
      const meRes = await axios.get('/api/auth/me');
      onLogin(meRes.data, res.data.access_token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pwStrength = password.length === 0 ? null : password.length < 6 ? 'weak' : password.length < 10 ? 'medium' : 'strong';
  const strengthColor = { weak: '#ef4444', medium: '#f59e0b', strong: '#10b981' }[pwStrength] || 'transparent';
  const strengthPct = { weak: 33, medium: 66, strong: 100 }[pwStrength] || 0;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-color)',
    }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/wolf_logo.svg" alt="Wolf Group Logo" style={{ width: 64, height: 64, margin: '0 auto 1rem', display: 'block' }} />
          <h1 style={{
            fontSize: '1.8rem', fontWeight: 800,
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            margin: 0,
          }}>
            Wolf Group Data Verifier
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Create your account</p>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          {error && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#dc2626', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.5rem',
              fontSize: '0.875rem',
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Username</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                <input
                  className="form-control"
                  type="text"
                  placeholder="Choose a username (min 3 chars)"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                <input
                  className="form-control"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Choose a password (min 6 chars)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0 }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Strength bar */}
              {password && (
                <div style={{ marginTop: '0.4rem' }}>
                  <div style={{ height: 4, borderRadius: 4, background: 'var(--border-color)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${strengthPct}%`, background: strengthColor, borderRadius: 4, transition: 'width 0.3s, background 0.3s' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: strengthColor, marginTop: 2, display: 'block' }}>
                    {pwStrength === 'weak' ? 'Weak password' : pwStrength === 'medium' ? 'Medium strength' : 'Strong password'}
                  </span>
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                <input
                  className="form-control"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', borderColor: confirm && confirm !== password ? '#ef4444' : confirm && confirm === password ? '#10b981' : '' }}
                  autoComplete="new-password"
                />
                {confirm && confirm === password && (
                  <CheckCircle size={16} style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#10b981' }} />
                )}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 600, marginTop: '0.25rem' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Creating account...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <UserPlus size={16} /> Create Account
                </span>
              )}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Register;
