import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Download, RefreshCw, ArrowLeft } from 'lucide-react';

const API_BASE_URL = '/api';

const ValidationResults = () => {
  const { jobId } = useParams();
  const [jobs, setJobs] = useState([]);
  const [job, setJob] = useState(null);
  const [results, setResults] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Fetch all jobs if no jobId, else fetch specific job
  useEffect(() => {
    let interval;
    
    const fetchJobs = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/validation/jobs`);
        setJobs(res.data);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    const fetchJobData = async () => {
      try {
        const jobRes = await axios.get(`${API_BASE_URL}/validation/jobs/${jobId}`);
        setJob(jobRes.data);
        
        const resultsRes = await axios.get(`${API_BASE_URL}/validation/jobs/${jobId}/results`);
        setResults(resultsRes.data);
        setLoading(false);
        
        // If processing, poll every 2 seconds
        if (jobRes.data.status === 'PROCESSING' || jobRes.data.status === 'PENDING') {
          interval = setInterval(fetchJobData, 2000);
        } else if (interval) {
          clearInterval(interval);
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    const fetchTemplates = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/templates/`);
        setTemplates(res.data);
      } catch (err) {
        console.error("Error fetching templates:", err);
      }
    };

    if (jobId) {
      fetchJobData();
      fetchTemplates();
    } else {
      fetchJobs();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jobId]);

  // Handle template selection change
  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === parseInt(selectedTemplateId));
      setSelectedTemplate(template || null);
    } else {
      setSelectedTemplate(null);
    }
  }, [selectedTemplateId, templates]);

  const handleDownload = () => {
    let downloadUrl = `${API_BASE_URL}/validation/jobs/${jobId}/download`;
    if (selectedTemplateId) {
      downloadUrl += `?template_id=${selectedTemplateId}`;
    }
    window.location.href = downloadUrl;
  };

  if (loading) return <div>Loading...</div>;

  // Render jobs list if no specific job selected
  if (!jobId) {
    return (
      <div className="animate-fade-in">
        <h1>Validation Jobs</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          History of all email validation jobs.
        </p>
        
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
              {jobs.map(j => (
                <tr key={j.id}>
                  <td>{j.filename}</td>
                  <td>
                    <span className={`badge badge-${j.status === 'COMPLETED' ? 'success' : j.status === 'FAILED' ? 'danger' : 'warning'}`}>
                      {j.status}
                    </span>
                  </td>
                  <td>{j.processed_records} / {j.total_records}</td>
                  <td style={{ color: 'var(--success)' }}>{j.valid_count} ✅</td>
                  <td style={{ color: 'var(--danger)' }}>{j.invalid_count} ❌</td>
                  <td>{new Date(j.created_at).toLocaleDateString()}</td>
                  <td>
                    <Link to={`/results/${j.id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Filter results
  const filteredResults = results.filter(r => {
    const matchesSearch = r.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          JSON.stringify(r.original_data).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Extract CSV columns dynamically from first result
  const csvHeaders = results.length > 0 ? Object.keys(results[0].original_data) : [];

  // Helper to render personalized template content for a row
  const renderPersonalized = (templateText, rowData) => {
    if (!templateText) return '';
    let rendered = templateText;
    Object.keys(rowData).forEach(key => {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), rowData[key] || '');
    });
    return rendered;
  };

  // Render specific job details
  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link to="/results" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </Link>
        <h1 style={{ margin: 0 }}>Job Details: {job?.filename}</h1>
      </div>
      
      <div className="grid grid-cols-4" style={{ marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <div className="stat-title">Status</div>
          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className={`badge badge-${job?.status === 'COMPLETED' ? 'success' : 'warning'}`}>
              {job?.status}
            </span>
            {(job?.status === 'PROCESSING' || job?.status === 'PENDING') && <RefreshCw size={16} className="animate-spin" />}
          </div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div className="stat-title">Progress</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>
            {job?.processed_records} / {job?.total_records}
          </div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div className="stat-title">Deliverable</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--success)' }}>
            ✅ {job?.valid_count}
          </div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div className="stat-title">Not Deliverable</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--danger)' }}>
            ❌ {job?.invalid_count}
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search emails or data..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '250px' }}
            />
            <select 
              className="form-control" 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ width: '150px' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="DELIVERABLE">✅ Deliverable</option>
              <option value="RISKY">⚠️ Risky</option>
              <option value="NOT DELIVERABLE">❌ Not Deliverable</option>
              <option value="UNKNOWN">❓ Unknown</option>
            </select>
            <select 
              className="form-control" 
              value={selectedTemplateId}
              onChange={e => setSelectedTemplateId(e.target.value)}
              style={{ width: '200px' }}
            >
              <option value="">Apply Template</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={handleDownload}
            disabled={job?.status !== 'COMPLETED'}
          >
            <Download size={18} />
            Download CSV
          </button>
        </div>

        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                {csvHeaders.map(header => (
                  <th key={header}>{header}</th>
                ))}
                <th>Email Status</th>
                <th>Reason</th>
                {selectedTemplate && <th>Personalized Content</th>}
              </tr>
            </thead>
            <tbody>
              {filteredResults.map(r => (
                <tr key={r.id}>
                  {csvHeaders.map(header => (
                    <td key={header}>{r.original_data[header]}</td>
                  ))}
                  <td>
                    <span className={`badge badge-${
                      r.status === 'DELIVERABLE' ? 'success' :
                      r.status === 'NOT DELIVERABLE' ? 'danger' :
                      r.status === 'RISKY' ? 'warning' :
                      'info'
                    }`} style={{ fontWeight: 700 }}>
                      {r.status === 'DELIVERABLE' ? '✅ DELIVERABLE' :
                       r.status === 'NOT DELIVERABLE' ? '❌ NOT DELIVERABLE' :
                       r.status === 'RISKY' ? '⚠️ RISKY' :
                       r.status === 'UNKNOWN' ? '❓ UNKNOWN' : r.status}
                    </span>
                  </td>
                  <td>{r.reason}</td>
                  {selectedTemplate && (
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={renderPersonalized(selectedTemplate.body_text, r.original_data)}>
                      {renderPersonalized(selectedTemplate.body_text, r.original_data)}
                    </td>
                  )}
                </tr>
              ))}
              {filteredResults.length === 0 && (
                <tr>
                  <td colSpan={csvHeaders.length + (selectedTemplate ? 3 : 2)} style={{ textAlign: 'center', padding: '2rem' }}>
                    No results match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ValidationResults;
