import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Mail, Upload, Settings, Users, Send, FileText, CheckCircle, XCircle, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

function App() {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  const [activeTab, setActiveTab] = useState('config');

  // App State
  const [config, setConfig] = useState({ smtpUser: '', smtpPass: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [template, setTemplate] = useState({ subject: 'Your Certificate', body: 'Hello {{name}},\n\nPlease find your certificate attached.\n\nBest regards,\nThe Team' });
  const [attachments, setAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState(null);

  const fileInputRef = useRef(null);
  const csvInputRef = useRef(null);

  // Handlers
  const handleConfigChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const handleTemplateChange = (e) => {
    setTemplate({ ...template, [e.target.name]: e.target.value });
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
          setRecipients(results.data);
        }
      });
    }
  };

  const handleCertificatesUpload = (e) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  const sendBatch = async () => {
    if (!config.smtpUser || !config.smtpPass) {
      alert("Please provide SMTP credentials.");
      setActiveTab('config');
      return;
    }
    if (recipients.length === 0) {
      alert("Please provide recipients.");
      setActiveTab('recipients');
      return;
    }

    setIsSending(true);
    setProgress({ current: 0, total: recipients.length, results: [] });

    const formData = new FormData();
    formData.append('smtpUser', config.smtpUser);
    formData.append('smtpPass', config.smtpPass);
    formData.append('subjectTemplate', template.subject);
    formData.append('bodyTemplate', template.body);
    formData.append('recipients', JSON.stringify(recipients));

    attachments.forEach(file => {
      formData.append('attachments', file);
    });

    try {
      const response = await fetch(`${API_BASE}/send`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (response.ok && data.jobId) {
        setJobId(data.jobId);
        pollStatus(data.jobId);
      } else {
        alert("Failed to start job: " + (data.error || 'Unknown Error'));
        setIsSending(false);
      }
    } catch (err) {
      alert("Error reaching server: " + err.message);
      setIsSending(false);
    }
  };

  const pollStatus = async (id) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/status/${id}`);
        const data = await response.json();

        setProgress({
          current: data.progress,
          total: data.total,
          results: data.results,
          status: data.status
        });

        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
          setIsSending(false);
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 1000);
  };

  return (
    <div className="container">
      <header className="header animate-fade-in">
        <div className="header-logo">
          <Mail size={32} color="#a855f7" />
          <span>SendFlow</span>
        </div>
        <div className="header-actions">
          {(!isSending && progress?.status === 'completed') && (
            <span className="badge badge-success mr-4">Completed ({progress.results.filter(r => r.status === 'success').length}/{progress.total})</span>
          )}
          <button
            className="btn btn-primary"
            onClick={sendBatch}
            disabled={isSending || recipients.length === 0}
          >
            {isSending ? <><Loader2 className="spin" size={18} /> Sending...</> : <><Send size={18} /> Launch Campaign</>}
          </button>
        </div>
      </header>

      <div className="grid-3 animate-fade-in delay-100 opacity-0">
        {/* Sidebar Tabs */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className={`btn ${activeTab === 'config' ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setActiveTab('config')}><Settings size={18} /> SMTP Config</button>
          <button className={`btn ${activeTab === 'recipients' ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setActiveTab('recipients')}><Users size={18} /> Recipients ({recipients.length})</button>
          <button className={`btn ${activeTab === 'template' ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setActiveTab('template')}><FileText size={18} /> Template</button>
          <button className={`btn ${activeTab === 'attachments' ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setActiveTab('attachments')}><Upload size={18} /> Attachments ({attachments.length})</button>
        </div>

        {/* Content Area */}
        <div className="glass-panel" style={{ gridColumn: 'span 2' }}>
          {activeTab === 'config' && (
            <div className="animate-fade-in">
              <h2 className="mb-4">SMTP Configuration</h2>
              <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>Enter your Gmail credentials. Please use an <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>App Password</a>, not your main password. <br /><span style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>Note: You can paste the App Password with spaces (e.g., <code>saal toem irwr hssj</code>) — we will automatically format it for you.</span></p>
              <div className="form-group">
                <label className="form-label">Gmail Address</label>
                <input type="email" name="smtpUser" className="form-input" placeholder="you@gmail.com" value={config.smtpUser} onChange={handleConfigChange} />
              </div>
              <div className="form-group">
                <label className="form-label">App Password</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type={showPassword ? "text" : "password"} name="smtpPass" className="form-input" placeholder="16-character app password" value={config.smtpPass} onChange={handleConfigChange} />
                  <button type="button" className="btn btn-secondary" onClick={() => setShowPassword(!showPassword)} title="Toggle Password Visibility">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'recipients' && (
            <div className="animate-fade-in">
              <h2 className="mb-4">Recipient List</h2>

              <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--accent)', marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '8px', color: 'var(--accent)' }}>How to format your CSV file:</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Your Excel/CSV file must have exactly two column headers at the top: <strong>name</strong> and <strong>email</strong> (lowercase matters).<br />
                  <em>Example:</em><br />
                  name,email<br />
                  Alice Smith,alice@test.com
                </p>
              </div>

              <div className="dropzone mb-4" onClick={() => csvInputRef.current.click()}>
                <Upload size={32} color="var(--text-secondary)" style={{ marginBottom: 10 }} />
                <p>Click to upload CSV</p>
                <input type="file" ref={csvInputRef} accept=".csv" style={{ display: 'none' }} onChange={handleCsvUpload} />
              </div>

              {recipients.length > 0 && (
                <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px' }}>
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Name</th>
                        <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipients.slice(0, 10).map((r, i) => (
                        <tr key={i}>
                          <td style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.name || 'N/A'}</td>
                          <td style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {recipients.length > 10 && <p className="text-center mt-4 text-secondary">...and {recipients.length - 10} more rows.</p>}
                </div>
              )}
            </div>
          )}

          {activeTab === 'template' && (
            <div className="animate-fade-in">
              <h2 className="mb-4">Email Template</h2>
              <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>Use placeholders like {'{{name}}'} to personalize the email.</p>

              <div className="form-group">
                <label className="form-label">Subject</label>
                <input type="text" name="subject" className="form-input" value={template.subject} onChange={handleTemplateChange} />
              </div>

              <div className="form-group">
                <label className="form-label">Body</label>
                <textarea name="body" className="form-textarea" value={template.body} onChange={handleTemplateChange} />
              </div>
            </div>
          )}

          {activeTab === 'attachments' && (
            <div className="animate-fade-in">
              <h2 className="mb-4">Certificates</h2>

              <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--accent)', marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '8px', color: 'var(--accent)' }}>How to name your certificate files:</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  To send the correct certificate to the right person, the filename must match the person's name or email exactly as written in the CSV.<br /><br />
                  <strong>Correct File Naming Examples:</strong><br />
                  - <code>Alice Smith.pdf</code> (Matches the Name field)<br />
                  - <code>alice@test.com.pdf</code> (Matches the Email field)
                </p>
              </div>

              <div className="dropzone mb-4" onClick={() => fileInputRef.current.click()}>
                <Upload size={32} color="var(--text-secondary)" style={{ marginBottom: 10 }} />
                <p>Click to upload Certificates (multiple)</p>
                <input type="file" ref={fileInputRef} multiple accept=".pdf,.jpeg,.png,.jpg" style={{ display: 'none' }} onChange={handleCertificatesUpload} />
              </div>

              {attachments.length > 0 && (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {attachments.map((file, i) => (
                      <li key={i} style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', marginBottom: '5px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{file.name}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{(file.size / 1024).toFixed(1)} KB</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isSending && progress && (
        <div className="glass-panel mt-8 animate-fade-in delay-200 opacity-0">
          <div className="flex justify-between items-center mb-4">
            <h3>Sending Emails...</h3>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${(progress.current / progress.total) * 100}%`, height: '100%', background: 'var(--gradient-1)', transition: 'width 0.3s ease' }}></div>
          </div>

          <div className="mt-4" style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {progress.results.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', fontSize: '0.9rem' }}>
                {r.status === 'success' ? <CheckCircle size={16} color="var(--success)" /> : <XCircle size={16} color="var(--danger)" />}
                <span>{r.email}</span>
                {r.status === 'error' && <span style={{ color: 'var(--danger)', marginLeft: 'auto' }}>{r.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global CSS for spinner */}
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default App;
