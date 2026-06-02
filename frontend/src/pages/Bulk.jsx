import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import api from '../api';
import * as XLSX from 'xlsx';
import ImageUpload from '../components/flow/ImageUpload';
import styles from './Bulk.module.css';

export default function Bulk() {
    const [tab, setTab] = useState('excel');
    const [flows, setFlows] = useState([]);
    const [waReady, setWaReady] = useState(false);
    const [selectedFlow, setSelectedFlow] = useState('');
    const [csvData, setCsvData] = useState(null); // { headers, rows }
    const [leads, setLeads] = useState([]);
    const [filteredLeads, setFilteredLeads] = useState([]);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [message, setMessage] = useState('');
    const [mediaFile, setMediaFile] = useState(null); // { filename, previewUrl }
    const [delay, setDelay] = useState(15); // seconds between messages
    const [sending, setSending] = useState(false);
    const [job, setJob] = useState(null);
    const [jobs, setJobs] = useState([]);
    const fileRef = useRef();
    const pollRef = useRef();

    useEffect(() => {
        api.get('/flows').then(r => setFlows(r.data || [])).catch(() => { });
        api.get('/bulk/jobs').then(r => setJobs(r.data || [])).catch(() => { });
        api.get('/whatsapp/status').then(r => setWaReady(r.data.status === 'ready')).catch(() => { });
    }, []);

    // Load leads when flow or date changes
    useEffect(() => {
        if (tab !== 'leads') return;
        loadLeads();
    }, [tab, selectedFlow, dateFrom, dateTo]);

    async function loadLeads() {
        try {
            const params = new URLSearchParams();
            if (selectedFlow) params.set('flowId', selectedFlow);
            if (dateFrom) params.set('from', dateFrom);
            if (dateTo) params.set('to', dateTo);
            const r = await api.get(`/bulk/leads?${params}`);
            setLeads(r.data || []);
            setFilteredLeads(r.data || []);
        } catch { }
    }

    function handleFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = new Uint8Array(ev.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                if (!rows.length) { alert('File is empty or unreadable'); return; }
                const headers = Object.keys(rows[0]);
                // Normalize phone field — convert numbers to string
                const normalized = rows.map(row => {
                    const obj = { ...row };
                    // Find phone-like field (first column or named phone/number/mobile)
                    const phoneKey = headers.find(h =>
                        /phone|number|mobile|contact|num/i.test(h)
                    ) || headers[0];
                    if (obj[phoneKey] !== undefined) {
                        obj[phoneKey] = String(obj[phoneKey]).replace(/\.0$/, '').trim();
                    }
                    return obj;
                });
                setCsvData({ headers, rows: normalized });
            } catch (err) {
                alert('Failed to read file: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function insertVar(varName) {
        setMessage(m => m + `{{${varName}}}`);
    }

    function getContacts() {
        if (tab === 'excel') return csvData?.rows || [];
        return filteredLeads;
    }

    function getVariables() {
        if (tab === 'excel') return csvData?.headers || [];
        if (leads.length > 0) return Object.keys(leads[0]).filter(k => !['id', 'userId', 'contactId', 'flowId', 'flowName'].includes(k));
        return [];
    }

    async function send() {
        const contacts = getContacts();
        if (!contacts.length) return alert('No contacts to send to');
        if (!message.trim()) return alert('Message is empty');
        if (!waReady) {
            // Re-check status before blocking
            try {
                const r = await api.get('/whatsapp/status');
                if (r.data.status !== 'ready') {
                    return alert('WhatsApp is not connected. Please connect from Dashboard first.');
                }
                setWaReady(true);
            } catch {
                return alert('Could not check WhatsApp status.');
            }
        }
        if (!confirm(`Send to ${contacts.length} contacts?`)) return;

        setSending(true);
        try {
            const r = await api.post('/bulk/send', { contacts, message, delaySeconds: delay, mediaFilename: mediaFile?.filename });
            setJob({ id: r.data.jobId, total: r.data.total, sent: 0, failed: 0, status: 'running' });
            // Poll progress
            pollRef.current = setInterval(async () => {
                const jobs = await api.get('/bulk/jobs');
                const current = jobs.data.find(j => j.id === r.data.jobId);
                if (current) {
                    setJob(current);
                    if (current.status === 'done') {
                        clearInterval(pollRef.current);
                        setSending(false);
                        api.get('/bulk/jobs').then(r => setJobs(r.data || []));
                    }
                }
            }, 2000);
        } catch (err) {
            alert(err.response?.data?.error || 'Send failed');
            setSending(false);
        }
    }

    const contacts = getContacts();
    const variables = getVariables();

    return (
        <Layout>
            <div className={styles.page}>
                <h1 className={styles.title}>Bulk Message</h1>
                {!waReady && (
                    <div className={styles.waWarning}>
                        ⚠️ WhatsApp not connected — <a href="/dashboard" style={{color:'#6366f1'}}>Connect from Dashboard</a>
                    </div>
                )}

                {/* Source tabs */}
                <div className={styles.tabs}>
                    <button className={`${styles.tab} ${tab === 'excel' ? styles.activeTab : ''}`} onClick={() => setTab('excel')}>
                        📊 Upload Excel/CSV
                    </button>
                    <button className={`${styles.tab} ${tab === 'leads' ? styles.activeTab : ''}`} onClick={() => setTab('leads')}>
                        👥 From Leads
                    </button>
                </div>

                <div className={styles.grid}>
                    {/* Left — contacts source */}
                    <div className={styles.card}>
                        {tab === 'excel' ? (
                            <>
                                <div className={styles.cardTitle}>Upload File</div>
                                <p className={styles.hint}>First column must be phone number. 10-digit = Indian (+91). Include country code for others.</p>
                                <input type="file" accept=".csv,.xlsx,.xls" ref={fileRef} onChange={handleFile} className={styles.fileInput} />
                                <button className={styles.btnSecondary} onClick={() => fileRef.current.click()}>
                                    📁 Choose Excel or CSV file
                                </button>
                                {csvData && (
                                    <div className={styles.preview}>
                                        <div className={styles.previewMeta}>
                                            ✅ {csvData.rows.length} contacts · {csvData.headers.length} fields
                                        </div>
                                        <div className={styles.headers}>
                                            {csvData.headers.map(h => <span key={h} className={styles.headerTag}>{h}</span>)}
                                        </div>
                                        <div className={styles.sampleRow}>
                                            Sample: {JSON.stringify(csvData.rows[0])}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className={styles.cardTitle}>Filter Leads</div>
                                <div className={styles.filterRow}>
                                    <label className={styles.label}>Flow</label>
                                    <select className={styles.select} value={selectedFlow} onChange={e => setSelectedFlow(e.target.value)}>
                                        <option value="">All Flows</option>
                                        {flows.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                    </select>
                                </div>
                                <div className={styles.filterRow}>
                                    <label className={styles.label}>From Date</label>
                                    <input type="date" className={styles.input} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                                </div>
                                <div className={styles.filterRow}>
                                    <label className={styles.label}>To Date</label>
                                    <input type="date" className={styles.input} value={dateTo} onChange={e => setDateTo(e.target.value)} />
                                </div>
                                <div className={styles.previewMeta}>{leads.length} leads found</div>
                            </>
                        )}
                    </div>

                    {/* Right — message composer */}
                    <div className={styles.card}>
                        <div className={styles.cardTitle}>Compose Message</div>
                        {variables.length > 0 && (
                            <div className={styles.varSection}>
                                <div className={styles.label}>Insert Variable:</div>
                                <div className={styles.varTags}>
                                    {variables.map(v => (
                                        <button key={v} className={styles.varTag} onClick={() => insertVar(v)}>
                                            {`{{${v}}}`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <textarea
                            className={styles.textarea}
                            rows={8}
                            placeholder="Type your message here...&#10;Use {{variable}} to insert contact data&#10;Example: Hi {{name}}, your booking is confirmed!"
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                        />
                        <div style={{ marginBottom: 12 }}>
                            <div className={styles.label} style={{ marginBottom: 6 }}>Attach Image (optional)</div>
                            <ImageUpload
                                value={mediaFile?.filename}
                                previewUrl={mediaFile?.previewUrl}
                                onChange={({ filename, previewUrl }) => setMediaFile(filename ? { filename, previewUrl } : null)}
                            />
                            {mediaFile && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Message text will be used as caption</p>}
                        </div>
                        {message && contacts.length > 0 && (
                            <div className={styles.preview}>
                                <div className={styles.label}>Preview (first contact):</div>
                                <div className={styles.previewMsg}>
                                    {message.replace(/\{\{(\w+)\}\}/g, (_, k) => contacts[0]?.[k] || `{{${k}}}`)}
                                </div>
                            </div>
                        )}
                        <div className={styles.delaySection}>
                            <div className={styles.delayHeader}>
                                <span className={styles.label}>Delay between messages</span>
                                <span className={styles.delayValue}>
                                    {delay >= 60 ? `${Math.floor(delay / 60)}m ${delay % 60 > 0 ? delay % 60 + 's' : ''}`.trim() : `${delay}s`}
                                </span>
                            </div>
                            <input
                                type="range"
                                min={10}
                                max={300}
                                step={5}
                                value={delay}
                                onChange={e => setDelay(Number(e.target.value))}
                                className={styles.slider}
                            />
                            <div className={styles.sliderLabels}>
                                <span>10s</span>
                                <span>1m</span>
                                <span>2m</span>
                                <span>3m</span>
                                <span>4m</span>
                                <span>5m</span>
                            </div>
                            <div className={styles.manualDelay}>
                                <span className={styles.manualLabel}>Or type manually (seconds):</span>
                                <input
                                    type="number"
                                    min={10}
                                    max={300}
                                    value={delay}
                                    onChange={e => {
                                        const v = Math.min(300, Math.max(10, Number(e.target.value) || 10));
                                        setDelay(v);
                                    }}
                                    className={styles.delayInput}
                                />
                            </div>
                        </div>
                        <div className={styles.sendRow}>
                            <span className={styles.contactCount}>{contacts.length} contacts</span>
                            <button className={styles.btnSend} onClick={send} disabled={sending || !contacts.length || !message.trim()}>
                                {sending ? 'Sending...' : `🚀 Send to ${contacts.length}`}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Progress */}
                {job && (
                    <div className={styles.progressCard}>
                        <div className={styles.cardTitle}>
                            {job.status === 'done' ? '✅ Done' : '⏳ Sending...'}
                        </div>
                        <div className={styles.progressBar}>
                            <div
                                className={styles.progressFill}
                                style={{ width: `${Math.round(((job.sent + job.failed) / job.total) * 100)}%` }}
                            />
                        </div>
                        <div className={styles.progressStats}>
                            <span className={styles.statGreen}>✓ Sent: {job.sent}</span>
                            <span className={styles.statRed}>✗ Failed: {job.failed}</span>
                            <span className={styles.statGray}>Total: {job.total}</span>
                        </div>
                    </div>
                )}

                {/* Past jobs */}
                {jobs.length > 0 && (
                    <div className={styles.section}>
                        <div className={styles.cardTitle}>Recent Jobs</div>
                        <div className={styles.tableWrap}>
                            <table className={styles.table}>
                                <thead>
                                    <tr><th>Date</th><th>Total</th><th>Sent</th><th>Failed</th><th>Status</th></tr>
                                </thead>
                                <tbody>
                                    {jobs.map(j => (
                                        <tr key={j.id}>
                                            <td>{new Date(j.createdAt).toLocaleString()}</td>
                                            <td>{j.total}</td>
                                            <td style={{ color: '#4ade80' }}>{j.sent}</td>
                                            <td style={{ color: '#f87171' }}>{j.failed}</td>
                                            <td><span className={j.status === 'done' ? styles.activeBadge : styles.pendingBadge}>{j.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
