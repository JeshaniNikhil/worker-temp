import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Users, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

const API_BASE_URL = '/api';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalJobs: 0,
    valid: 0,
    invalid: 0,
    disposable: 0,
    unknown: 0
  });
  const [recentJobs, setRecentJobs] = useState([]);

  useEffect(() => {
    // Fetch recent jobs to calculate stats
    axios.get(`${API_BASE_URL}/validation/jobs?limit=5`)
      .then(res => {
        setRecentJobs(res.data);
        // Calculate totals from recent for demo purposes
        const totals = res.data.reduce((acc, job) => {
          acc.valid += job.valid_count;
          acc.invalid += job.invalid_count;
          acc.disposable += job.disposable_count;
          acc.unknown += job.unknown_count;
          return acc;
        }, { valid: 0, invalid: 0, disposable: 0, unknown: 0 });
        
        setStats({
          totalJobs: res.data.length,
          ...totals
        });
      })
      .catch(err => console.error("Error fetching jobs:", err));
  }, []);

  return (
    <div className="animate-fade-in">
      <h1>Dashboard Overview</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Welcome to your MailPlatform dashboard.
      </p>

      <div className="grid grid-cols-4" style={{ marginBottom: '2rem' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-title">Valid Emails</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.valid}</div>
            </div>
            <CheckCircle color="var(--success)" size={24} />
          </div>
        </div>
        
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-title">Not Valid</div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.invalid}</div>
            </div>
            <AlertTriangle color="var(--danger)" size={24} />
          </div>
        </div>
        
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-title">Disposable</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.disposable}</div>
            </div>
            <Users color="var(--warning)" size={24} />
          </div>
        </div>
        
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-title">Unknown</div>
              <div className="stat-value" style={{ color: 'var(--info)' }}>{stats.unknown}</div>
            </div>
            <HelpCircle color="var(--info)" size={24} />
          </div>
        </div>
      </div>

      <h2>Recent Validation Jobs</h2>
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>File Name</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Valid</th>
              <th>Invalid</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recentJobs.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No recent jobs</td>
              </tr>
            ) : (
              recentJobs.map(job => (
                <tr key={job.id}>
                  <td>{job.filename}</td>
                  <td>
                    <span className={`badge badge-${job.status === 'COMPLETED' ? 'success' : job.status === 'FAILED' ? 'danger' : 'warning'}`}>
                      {job.status}
                    </span>
                  </td>
                  <td>{job.processed_records} / {job.total_records}</td>
                  <td style={{ color: 'var(--success)' }}>{job.valid_count}</td>
                  <td style={{ color: 'var(--danger)' }}>{job.invalid_count}</td>
                  <td>{new Date(job.created_at).toLocaleDateString()}</td>
                  <td>
                    <Link to={`/results/${job.id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
