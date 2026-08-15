import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Save, AlertTriangle, Check, Type, ArrowLeft } from 'lucide-react';

const API_BASE_URL = '/api';

const TemplateEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState({
    name: '',
    subject: '',
    body_text: '',
    body_html: '',
    variables: []
  });
  
  const [spamFindings, setSpamFindings] = useState([]);
  const [spamRisk, setSpamRisk] = useState('LOW');
  const [spamScore, setSpamScore] = useState(100);
  const [spamRecommendations, setSpamRecommendations] = useState([]);
  const [csvColumns, setCsvColumns] = useState(['First Name', 'Company Name', 'Product', 'Country', 'Website', 'Email']);
  const [showVariableSelector, setShowVariableSelector] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const editorRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      // Load template if editing
      if (id && id !== 'new') {
        try {
          const res = await axios.get(`${API_BASE_URL}/templates/${id}`);
          setTemplate(res.data);
          checkSpam(res.data.body_text, res.data.subject);
        } catch (err) {
          console.error('Could not load template', err);
        }
      }

      // Fetch CSV column names from the latest completed job
      try {
        const jobsRes = await axios.get(`${API_BASE_URL}/validation/jobs?limit=10`);
        const jobs = jobsRes.data;
        // Find the most recent completed job
        const completedJob = jobs.find(j => j.status === 'COMPLETED');
        if (completedJob) {
          const colRes = await axios.get(`${API_BASE_URL}/validation/jobs/${completedJob.id}/columns`);
          if (colRes.data && colRes.data.columns && colRes.data.columns.length > 0) {
            setCsvColumns(colRes.data.columns);
          }
        }
      } catch (err) {
        console.error('Could not fetch CSV columns', err);
        // Keep default columns
      }
    };

    init();
  }, [id]);

  // Debounced spam check (re-runs when body or subject changes)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkSpam(template.body_text, template.subject);
    }, 1000);
    return () => clearTimeout(timer);
  }, [template.body_text, template.subject]);

  const checkSpam = async (text, subject) => {
    if (!text) {
      setSpamFindings([]);
      setSpamRisk('low_risk');
      setSpamScore(100);
      setSpamRecommendations([]);
      return;
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/spam/check`, {
        content: text,
        subject: subject || template.subject || undefined,
      });
      setSpamFindings(res.data.findings || []);
      setSpamRisk(res.data.risk_level || 'low_risk');
      setSpamScore(res.data.score !== undefined ? res.data.score : 100);
      setSpamRecommendations(res.data.recommendations || []);
    } catch (err) {
      console.error('Spam check failed', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTemplate(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const insertVariable = (variable) => {
    const tag = `{{${variable}}}`;
    const textarea = editorRef.current;
    
    // Insert at cursor position if supported, else append
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = template.body_text.substring(0, start) + tag + template.body_text.substring(end);
      
      setTemplate(prev => ({
        ...prev,
        body_text: newText,
        // Update variables list if not exists
        variables: prev.variables.includes(variable) ? prev.variables : [...prev.variables, variable]
      }));
      
      // Reset cursor position shortly after render
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + tag.length;
        textarea.focus();
      }, 0);
    } else {
      setTemplate(prev => ({
        ...prev,
        body_text: prev.body_text + tag,
        variables: prev.variables.includes(variable) ? prev.variables : [...prev.variables, variable]
      }));
    }
    
    setShowVariableSelector(false);
  };

  const applySpamSuggestion = (finding, alternative) => {
    const newText = template.body_text.substring(0, finding.start) + alternative + template.body_text.substring(finding.end);
    setTemplate(prev => ({ ...prev, body_text: newText }));
  };

  const ignoreSpamSuggestion = (findingIndex) => {
    const newFindings = [...spamFindings];
    newFindings.splice(findingIndex, 1);
    setSpamFindings(newFindings);
    
    if (newFindings.length === 0) setSpamRisk('LOW');
    else if (newFindings.length <= 2) setSpamRisk('MEDIUM');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (id && id !== 'new') {
        await axios.put(`${API_BASE_URL}/templates/${id}`, template);
      } else {
        const res = await axios.post(`${API_BASE_URL}/templates/`, template);
        navigate(`/templates/${res.data.id}`);
      }
      alert('Template saved successfully!');
    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.detail || err.message || 'Unknown error';
      alert(`Error saving template: ${typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Process text for preview to highlight variables
  const getPreviewHtml = () => {
    let html = template.body_text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // Replace variables
    html = html.replace(/{{([^}]+)}}/g, '<span class="variable-tag">$1</span>');
    // Replace newlines with <br>
    return html.replace(/\n/g, '<br/>');
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ArrowLeft size={20} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => navigate('/templates')} />
          <h1 style={{ margin: 0 }}>{id ? 'Edit Template' : 'Create Template'}</h1>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || !template.name}>
          <Save size={18} />
          {isSaving ? 'Saving...' : 'Save Template'}
        </button>
      </div>

      <div className="editor-layout">
        <div className="editor-main">
          <div className="card" style={{ padding: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Template Name</label>
              <input type="text" className="form-control" name="name" value={template.name} onChange={handleChange} placeholder="e.g., Q3 Onboarding Campaign" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Email Subject</label>
              <input type="text" className="form-control" name="subject" value={template.subject} onChange={handleChange} placeholder="e.g., Introducing our {{Product}}" />
            </div>
          </div>

          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <button className="btn btn-secondary" onClick={() => setShowVariableSelector(!showVariableSelector)}>
                  <Type size={16} /> Add Variable
                </button>
                
                {showVariableSelector && (
                  <div style={{ 
                    position: 'absolute', top: '100%', left: 0, marginTop: '0.5rem', 
                    backgroundColor: 'var(--surface-color-light)', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)', padding: '0.5rem', zIndex: 10, width: '250px',
                    boxShadow: 'var(--shadow-lg)'
                  }}>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Type custom variable..." 
                        onKeyDown={e => {
                          if (e.key === 'Enter' && e.target.value) {
                            insertVariable(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                      />
                      <small style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>Press Enter to add</small>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', padding: '0 0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>SUGGESTED COLUMNS</div>
                    {csvColumns.map(col => (
                      <div 
                        key={col} 
                        style={{ padding: '0.5rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}
                        onMouseEnter={e => e.target.style.backgroundColor = 'var(--primary-color)'}
                        onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
                        onClick={() => insertVariable(col)}
                      >
                        {col}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Spam Score</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '1.25rem', color: spamScore >= 90 ? 'var(--success)' : spamScore >= 70 ? 'var(--warning)' : 'var(--danger)' }}>
                      {spamScore}/100
                    </strong>
                    <span className={`badge badge-${spamScore >= 90 ? 'success' : spamScore >= 70 ? 'warning' : 'danger'}`}>
                      {spamScore >= 90 ? 'HEALTHY' : spamScore >= 70 ? 'MEDIUM RISK' : 'HIGH RISK'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <textarea
              ref={editorRef}
              name="body_text"
              className="form-control"
              style={{ flex: 1, border: 'none', borderRadius: 0, resize: 'none', padding: '1.5rem', fontSize: '1rem', backgroundColor: 'transparent' }}
              value={template.body_text}
              onChange={handleChange}
              placeholder="Write your email here..."
            />
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Integrated Spam Checker Panel */}
          {spamFindings.length > 0 && (
            <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <AlertTriangle color="var(--warning)" />
                <h3 style={{ margin: 0 }}>Spam Risk Indicator</h3>
              </div>
              
              <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                {spamFindings.length} potential {spamFindings.length === 1 ? 'issue' : 'issues'} detected.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
                {spamFindings.map((finding, idx) => {
                  let severityColor = 'var(--info)';
                  let severityLabel = 'LOW RISK (Optional)';
                  if (finding.level === 'high') {
                    severityColor = 'var(--danger)';
                    severityLabel = 'MANDATORY FIX';
                  } else if (finding.level === 'medium') {
                    severityColor = 'var(--warning)';
                    severityLabel = 'MEDIUM RISK';
                  }
                  
                  return (
                    <div key={idx} className="spam-warning-box" style={{ borderLeftColor: severityColor }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <div style={{ fontWeight: 'bold' }}>"{finding.word}"</div>
                        <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', backgroundColor: severityColor, color: '#fff', borderRadius: '4px', fontWeight: 'bold' }}>
                          {severityLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>{finding.reason}</div>
                      
                      <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Suggested alternatives:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                        {finding.alternatives && finding.alternatives.map((alt, i) => (
                          <button key={i} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => applySpamSuggestion(finding, alt)}>
                            {alt}
                          </button>
                        ))}
                      </div>
                      
                      <div style={{ textAlign: 'right' }}>
                        <button className="btn" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0' }} onClick={() => ignoreSpamSuggestion(idx)}>
                          Ignore
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Recommendations Box */}
              {spamRecommendations && spamRecommendations.length > 0 && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--surface-color-light)', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Recommendations</h4>
                  <ul style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, paddingLeft: '1.25rem' }}>
                    {spamRecommendations.map((rec, idx) => (
                      <li key={idx} style={{ marginBottom: '0.25rem' }}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Live Preview */}
          <div className="editor-preview card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-secondary)' }}>Live Preview</h3>
            
            <div style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <strong>Subject: </strong> 
              <span dangerouslySetInnerHTML={{ __html: template.subject.replace(/{{([^}]+)}}/g, '<span class="variable-tag">$1</span>') }} />
            </div>
            
            <div 
              style={{ flex: 1, overflowY: 'auto' }}
              dangerouslySetInnerHTML={{ __html: getPreviewHtml() || '<span style="color:var(--text-secondary);font-style:italic">Email body preview...</span>' }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;
