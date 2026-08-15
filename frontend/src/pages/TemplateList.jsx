import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Mail, Edit, Trash2, Plus, Copy } from 'lucide-react';

const API_BASE_URL = '/api';

const TemplateList = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/templates/`);
      setTemplates(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        await axios.delete(`${API_BASE_URL}/templates/${id}`);
        fetchTemplates();
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Email Templates</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Manage your dynamic marketing templates.
          </p>
        </div>
        <Link to="/templates/new" className="btn btn-primary">
          <Plus size={18} />
          Create Template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Mail size={48} color="var(--text-secondary)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3>No Templates Yet</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Create your first dynamic email template to get started.
          </p>
          <Link to="/templates/new" className="btn btn-primary">
            Create Template
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2">
          {templates.map(template => (
            <div key={template.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>{template.name}</h3>
                <span className="badge badge-info">{template.variables?.length || 0} Variables</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem', height: '40px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <strong>Subject:</strong> {template.subject}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <Link to={`/templates/${template.id}`} className="btn btn-primary" style={{ flex: 1 }}>
                  <Edit size={16} /> Edit
                </Link>
                <button className="btn btn-secondary" onClick={() => handleDelete(template.id)} style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplateList;
