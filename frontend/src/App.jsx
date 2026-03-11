import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Mail, Upload, Settings, Users, Send, FileText, CheckCircle, XCircle, Loader2, Eye, EyeOff, MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react';

function App() {
  const API_BASE = import.meta.env.VITE_API_URL || '/api';

  // ── Mode ──────────────────────────────────────────────────────
  const [mode, setMode] = useState('certificate'); // 'certificate' | 'feedback'

  // ── Shared SMTP state ─────────────────────────────────────────
  const [config, setConfig] = useState({ smtpUser: '', smtpPass: '' });
  const [showPassword, setShowPassword] = useState(false);

  // ── Certificate mode state ────────────────────────────────────
  const [activeTab, setActiveTab] = useState('config');
  const [recipients, setRecipients] = useState([]);
  const [template, setTemplate] = useState({
    subject: 'Your Certificate',
    body: 'Hello {{name}},\n\nPlease find your certificate attached.\n\nBest regards,\nThe Team',
  });
  const [attachments, setAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(null);

  // ── Feedback mode state ───────────────────────────────────────
  const [fbActiveTab, setFbActiveTab] = useState('fb-smtp');
  const [fbRecipients, setFbRecipients] = useState([]);
  const [fbSubject, setFbSubject] = useState('Rysera STEM AI course final project evaluation');
  const [fbIsSending, setFbIsSending] = useState(false);
  const [fbProgress, setFbProgress] = useState(null);
  const [fbSendingGroup, setFbSendingGroup] = useState(null); // 'declined' | 'approved'

  // ── Refs ──────────────────────────────────────────────────────
  const fileInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const fbCsvInputRef = useRef(null);

  // ── Helpers ───────────────────────────────────────────────────
  const pollStatus = (id, setter, sendingSetter) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/status/${id}`);
        const data = await res.json();
        setter(prev => ({ ...prev, current: data.progress, total: data.total, results: data.results, status: data.status }));
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
          sendingSetter(false);
        }
      } catch (err) {
        console.error('Polling error', err);
      }
    }, 1000);
  };

  // ── Certificate handlers ──────────────────────────────────────
  const handleConfigChange = (e) => setConfig({ ...config, [e.target.name]: e.target.value });
  const handleTemplateChange = (e) => setTemplate({ ...template, [e.target.name]: e.target.value });

  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => setRecipients(results.data),
      });
    }
  };

  const handleCertificatesUpload = (e) => {
    if (e.target.files) setAttachments(Array.from(e.target.files));
  };

  const sendBatch = async () => {
    if (!config.smtpUser || !config.smtpPass) { alert('Please provide SMTP credentials.'); setActiveTab('config'); return; }
    if (recipients.length === 0) { alert('Please provide recipients.'); setActiveTab('recipients'); return; }

    setIsSending(true);
    setProgress({ current: 0, total: recipients.length, results: [] });

    const formData = new FormData();
    formData.append('smtpUser', config.smtpUser);
    formData.append('smtpPass', config.smtpPass);
    formData.append('subjectTemplate', template.subject);
    formData.append('bodyTemplate', template.body);
    formData.append('recipients', JSON.stringify(recipients));
    attachments.forEach(f => formData.append('attachments', f));

    try {
      const res = await fetch(`${API_BASE}/send`, { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.jobId) {
        pollStatus(data.jobId, setProgress, setIsSending);
      } else {
        alert('Failed to start job: ' + (data.error || 'Unknown Error'));
        setIsSending(false);
      }
    } catch (err) {
      alert('Error reaching server: ' + err.message);
      setIsSending(false);
    }
  };

  // ── Feedback handlers ─────────────────────────────────────────
  const handleFbCsvUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setFbRecipients(results.data);
          setFbProgress(null);
          setFbSendingGroup(null);
          setFbActiveTab('fb-send');
        },
      });
    }
  };

  const declinedList = fbRecipients.filter(r => r.status?.toLowerCase() === 'declined');
  const approvedList = fbRecipients.filter(r => r.status?.toLowerCase() === 'approved');

  const sendFeedback = async (group) => {
    if (!config.smtpUser || !config.smtpPass) { alert('Please configure SMTP credentials first.'); setFbActiveTab('fb-smtp'); return; }
    const list = group === 'declined' ? declinedList : approvedList;
    if (list.length === 0) { alert(`No ${group} proposals found in the uploaded CSV.`); return; }

    const label = group === 'declined' ? 'DECLINED' : 'APPROVED';
    const bodyTemplate = `${label}\n\nDear {{name}},\n\nRysera STEM AI course final evaluation is here for your submitted proposal.\n\nScore: {{score}}\n\n{{feedback}}\n\n---\nRegards,\nRysera STEM\nFor further details: 0787720767`;

    setFbSendingGroup(group);
    setFbIsSending(true);
    setFbProgress({ current: 0, total: list.length, results: [], group });

    const formData = new FormData();
    formData.append('smtpUser', config.smtpUser);
    formData.append('smtpPass', config.smtpPass);
    formData.append('subjectTemplate', fbSubject);
    formData.append('bodyTemplate', bodyTemplate);
    formData.append('recipients', JSON.stringify(list));

    try {
      const res = await fetch(`${API_BASE}/send`, { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.jobId) {
        pollStatus(data.jobId, setFbProgress, setFbIsSending);
      } else {
        alert('Failed to start job: ' + (data.error || 'Unknown Error'));
        setFbIsSending(false);
        setFbSendingGroup(null);
      }
    } catch (err) {
      alert('Error reaching server: ' + err.message);
      setFbIsSending(false);
      setFbSendingGroup(null);
    }
  };

  // ── Shared SMTP form (used in both modes) ─────────────────────
  const SmtpForm = () => (
    <div className="animate-fade-in">
      <h2 className="mb-4">SMTP Configuration</h2>
      <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
        Enter your Gmail credentials. Please use an{' '}
        <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>App Password</a>,
        not your main password.<br />
        <span style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>
          Note: You can paste the App Password with spaces — we will automatically format it for you.
        </span>
      </p>
      <div className="form-group">
        <label className="form-label">Gmail Address</label>
        <input type="email" name="smtpUser" className="form-input" placeholder="you@gmail.com" value={config.smtpUser} onChange={handleConfigChange} />
      </div>
      <div className="form-group">
        <label className="form-label">App Password</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type={showPassword ? 'text' : 'password'} name="smtpPass" className="form-input" placeholder="16-character app password" value={config.smtpPass} onChange={handleConfigChange} />
          <button type="button" className="btn btn-secondary" onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="container">
      <header className="header animate-fade-in">
        <div className="header-logo">
          <Mail size={32} color="#a855f7" />
          <span>SendFlow</span>
        </div>
        <div className="header-actions">
          {mode === 'certificate' && (
            <>
              {!isSending && progress?.status === 'completed' && (
                <span className="badge badge-success mr-4">
                  Completed ({progress.results.filter(r => r.status === 'success').length}/{progress.total})
                </span>
              )}
              <button className="btn btn-primary" onClick={sendBatch} disabled={isSending || recipients.length === 0}>
                {isSending ? <><Loader2 className="spin" size={18} /> Sending...</> : <><Send size={18} /> Launch Campaign</>}
              </button>
            </>
          )}
          {mode === 'feedback' && !fbIsSending && fbProgress?.status === 'completed' && (
            <span className="badge badge-success mr-4">
              {fbProgress.group === 'declined' ? 'Declined' : 'Approved'} batch done ({fbProgress.results.filter(r => r.status === 'success').length}/{fbProgress.total})
            </span>
          )}
        </div>
      </header>

      <div className="grid-3 animate-fade-in delay-100 opacity-0">
        {/* ── Sidebar ── */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* Mode switcher */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', background: 'rgba(0,0,0,0.25)', padding: '4px', borderRadius: '8px' }}>
            <button
              className={`btn ${mode === 'certificate' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, fontSize: '0.78rem', padding: '7px 4px', justifyContent: 'center' }}
              onClick={() => setMode('certificate')}
            >
              <FileText size={14} /> Certificate
            </button>
            <button
              className={`btn ${mode === 'feedback' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, fontSize: '0.78rem', padding: '7px 4px', justifyContent: 'center' }}
              onClick={() => setMode('feedback')}
            >
              <MessageSquare size={14} /> Feedback
            </button>
          </div>

          {/* Certificate tabs */}
          {mode === 'certificate' && (
            <>
              <button className={`btn ${activeTab === 'config' ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setActiveTab('config')}><Settings size={18} /> SMTP Config</button>
              <button className={`btn ${activeTab === 'recipients' ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setActiveTab('recipients')}><Users size={18} /> Recipients ({recipients.length})</button>
              <button className={`btn ${activeTab === 'template' ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setActiveTab('template')}><FileText size={18} /> Template</button>
              <button className={`btn ${activeTab === 'attachments' ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setActiveTab('attachments')}><Upload size={18} /> Attachments ({attachments.length})</button>
            </>
          )}

          {/* Feedback tabs */}
          {mode === 'feedback' && (
            <>
              <button className={`btn ${fbActiveTab === 'fb-smtp' ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setFbActiveTab('fb-smtp')}><Settings size={18} /> SMTP Config</button>
              <button className={`btn ${fbActiveTab === 'fb-csv' ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setFbActiveTab('fb-csv')}><Upload size={18} /> Feedback List ({fbRecipients.length})</button>
              <button className={`btn ${fbActiveTab === 'fb-send' ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setFbActiveTab('fb-send')}><Send size={18} /> Send Feedback</button>
            </>
          )}
        </div>

        {/* ── Content area ── */}
        <div className="glass-panel" style={{ gridColumn: 'span 2' }}>

          {/* ══ CERTIFICATE tabs ══ */}
          {mode === 'certificate' && (
            <>
              {activeTab === 'config' && <SmtpForm />}

              {activeTab === 'recipients' && (
                <div className="animate-fade-in">
                  <h2 className="mb-4">Recipient List</h2>
                  <div style={{ background: 'rgba(99,102,241,0.1)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--accent)', marginBottom: '20px' }}>
                    <h4 style={{ marginBottom: '8px', color: 'var(--accent)' }}>How to format your CSV file:</h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Your CSV must have two columns: <strong>name</strong> and <strong>email</strong> (lowercase).<br />
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
                  <div style={{ background: 'rgba(99,102,241,0.1)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--accent)', marginBottom: '20px' }}>
                    <h4 style={{ marginBottom: '8px', color: 'var(--accent)' }}>How to name your certificate files:</h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      The filename must match the person's name or email exactly as written in the CSV.<br /><br />
                      <strong>Examples:</strong><br />
                      - <code>Alice Smith.pdf</code> (matches Name)<br />
                      - <code>alice@test.com.pdf</code> (matches Email)
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
            </>
          )}

          {/* ══ FEEDBACK tabs ══ */}
          {mode === 'feedback' && (
            <>
              {fbActiveTab === 'fb-smtp' && <SmtpForm />}

              {fbActiveTab === 'fb-csv' && (
                <div className="animate-fade-in">
                  <h2 className="mb-4">Feedback List</h2>
                  <div style={{ background: 'rgba(99,102,241,0.1)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--accent)', marginBottom: '20px' }}>
                    <h4 style={{ marginBottom: '8px', color: 'var(--accent)' }}>CSV Format for Proposal Feedback:</h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Your CSV must have exactly these five columns (lowercase):<br />
                      <strong>name, email, status, score, feedback</strong><br /><br />
                      <strong>status</strong> must be either <code>approved</code> or <code>declined</code>.<br />
                      <strong>score</strong> is the numeric mark awarded (e.g. 78).<br /><br />
                      <em>Example:</em><br />
                      name,email,status,score,feedback<br />
                      Alice Smith,alice@test.com,approved,85,Great work! Your proposal is well-structured.<br />
                      Bob Jones,bob@test.com,declined,42,Missing methodology section. Please revise.
                    </p>
                  </div>
                  <div className="dropzone mb-4" onClick={() => fbCsvInputRef.current.click()}>
                    <Upload size={32} color="var(--text-secondary)" style={{ marginBottom: 10 }} />
                    <p>Click to upload Feedback CSV</p>
                    <input type="file" ref={fbCsvInputRef} accept=".csv" style={{ display: 'none' }} onChange={handleFbCsvUpload} />
                  </div>
                  {fbRecipients.length > 0 && (
                    <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px' }}>
                      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                        <thead>
                          <tr>
                            {['Name', 'Email', 'Status', 'Score', 'Feedback'].map(h => (
                              <th key={h} style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {fbRecipients.slice(0, 10).map((r, i) => (
                            <tr key={i}>
                              <td style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.name || 'N/A'}</td>
                              <td style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.email}</td>
                              <td style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{
                                  padding: '2px 8px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600,
                                  background: r.status?.toLowerCase() === 'approved' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                                  color: r.status?.toLowerCase() === 'approved' ? '#4ade80' : '#f87171',
                                }}>
                                  {r.status || 'N/A'}
                                </span>
                              </td>
                              <td style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', fontWeight: 600, color: 'var(--accent)' }}>{r.score ?? 'N/A'}</td>
                              <td style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.feedback || ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {fbRecipients.length > 10 && <p className="text-center mt-4 text-secondary">...and {fbRecipients.length - 10} more rows.</p>}
                    </div>
                  )}
                </div>
              )}

              {fbActiveTab === 'fb-send' && (
                <div className="animate-fade-in">
                  <h2 className="mb-4">Send Feedback</h2>

                  {fbRecipients.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                      <Upload size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                      <p>Upload a feedback CSV first from the Feedback List tab.</p>
                    </div>
                  ) : (
                    <>
                      {/* Subject line */}
                      <div className="form-group" style={{ marginBottom: '24px' }}>
                        <label className="form-label">Email Subject</label>
                        <input
                          type="text"
                          className="form-input"
                          value={fbSubject}
                          onChange={e => setFbSubject(e.target.value)}
                          placeholder="Proposal Review: {{name}}"
                        />
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                          Use <code>{'{{name}}'}</code> to personalise the subject line.
                        </p>
                      </div>

                      {/* Info box about email body */}
                      <div style={{ background: 'rgba(99,102,241,0.1)', padding: '14px', borderRadius: '8px', borderLeft: '4px solid var(--accent)', marginBottom: '24px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                        The email body is auto-generated. It will start with <strong style={{ color: '#f87171' }}>DECLINED</strong> or <strong style={{ color: '#4ade80' }}>APPROVED</strong> followed by the student's name and your feedback from the CSV.
                      </div>

                      {/* Two action cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                        {/* Declined card */}
                        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ThumbsDown size={20} color="#f87171" />
                            <span style={{ fontWeight: 600, color: '#f87171', fontSize: '1rem' }}>Declined</span>
                          </div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                            {declinedList.length} student{declinedList.length !== 1 ? 's' : ''} will receive a declined notification with your feedback.
                          </p>
                          {fbProgress?.group === 'declined' && fbProgress.status === 'completed' && (
                            <p style={{ fontSize: '0.82rem', color: '#4ade80', margin: 0 }}>
                              <CheckCircle size={14} style={{ display: 'inline', marginRight: 4 }} />
                              Sent {fbProgress.results.filter(r => r.status === 'success').length}/{fbProgress.total}
                            </p>
                          )}
                          <button
                            className="btn"
                            style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', marginTop: 'auto' }}
                            onClick={() => sendFeedback('declined')}
                            disabled={fbIsSending || declinedList.length === 0}
                          >
                            {fbIsSending && fbSendingGroup === 'declined'
                              ? <><Loader2 className="spin" size={16} /> Sending...</>
                              : <><Send size={16} /> Send Declined ({declinedList.length})</>
                            }
                          </button>
                        </div>

                        {/* Approved card */}
                        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ThumbsUp size={20} color="#4ade80" />
                            <span style={{ fontWeight: 600, color: '#4ade80', fontSize: '1rem' }}>Approved</span>
                          </div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                            {approvedList.length} student{approvedList.length !== 1 ? 's' : ''} will receive an approved notification with your feedback.
                          </p>
                          {fbProgress?.group === 'approved' && fbProgress.status === 'completed' && (
                            <p style={{ fontSize: '0.82rem', color: '#4ade80', margin: 0 }}>
                              <CheckCircle size={14} style={{ display: 'inline', marginRight: 4 }} />
                              Sent {fbProgress.results.filter(r => r.status === 'success').length}/{fbProgress.total}
                            </p>
                          )}
                          <button
                            className="btn"
                            style={{ background: 'rgba(34,197,94,0.2)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.4)', marginTop: 'auto' }}
                            onClick={() => sendFeedback('approved')}
                            disabled={fbIsSending || approvedList.length === 0}
                          >
                            {fbIsSending && fbSendingGroup === 'approved'
                              ? <><Loader2 className="spin" size={16} /> Sending...</>
                              : <><Send size={16} /> Send Approved ({approvedList.length})</>
                            }
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Progress tracker (certificate) ── */}
      {mode === 'certificate' && isSending && progress && (
        <div className="glass-panel mt-8 animate-fade-in delay-200 opacity-0">
          <div className="flex justify-between items-center mb-4">
            <h3>Sending Emails...</h3>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${(progress.current / progress.total) * 100}%`, height: '100%', background: 'var(--gradient-1)', transition: 'width 0.3s ease' }} />
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

      {/* ── Progress tracker (feedback) ── */}
      {mode === 'feedback' && fbIsSending && fbProgress && (
        <div className="glass-panel mt-8 animate-fade-in delay-200 opacity-0">
          <div className="flex justify-between items-center mb-4">
            <h3 style={{ color: fbProgress.group === 'declined' ? '#f87171' : '#4ade80' }}>
              Sending {fbProgress.group === 'declined' ? 'Declined' : 'Approved'} Feedback...
            </h3>
            <span>{fbProgress.current} / {fbProgress.total}</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              width: `${(fbProgress.current / fbProgress.total) * 100}%`,
              height: '100%',
              background: fbProgress.group === 'declined' ? 'linear-gradient(90deg,#ef4444,#f87171)' : 'linear-gradient(90deg,#16a34a,#4ade80)',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div className="mt-4" style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {fbProgress.results.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', fontSize: '0.9rem' }}>
                {r.status === 'success' ? <CheckCircle size={16} color="var(--success)" /> : <XCircle size={16} color="var(--danger)" />}
                <span>{r.email}</span>
                {r.status === 'error' && <span style={{ color: 'var(--danger)', marginLeft: 'auto' }}>{r.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default App;
