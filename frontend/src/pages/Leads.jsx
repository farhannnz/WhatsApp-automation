import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api';
import styles from './Leads.module.css';

export default function Leads() {
    const [flows, setFlows] = useState([]);
    const [selectedFlow, setSelectedFlow] = useState('all');
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        api.get('/flows').then(r => setFlows(r.data || [])).catch(() => {});
        loadLeads();
    }, []);

    useEffect(() => { loadLeads(); }, [selectedFlow]);

    async function loadLeads() {
        setLoading(true);
        try {
            const params = selectedFlow !== 'all' ? `?flowId=${selectedFlow}` : '';
            const r = await api.get(`/bulk/leads${params}`);
            setLeads(r.data || []);
        } catch {
            // fallback to whatsapp leads
            try {
                const r = await api.get('/whatsapp/leads');
                setLeads(r.data || []);
            } catch {}
        } finally {
            setLoading(false);
        }
    }

    const filtered = leads.filter(l => {
        const q = search.toLowerCase();
        return !q || JSON.stringify(l).toLowerCase().includes(q);
    });

    const metaFields = new Set(['userId', 'contactId', 'id', 'flowId', 'flowName']);
    const allKeys = [...new Set(filtered.flatMap(l => Object.keys(l).filter(k => !metaFields.has(k))))];

    function exportCSV() {
        const headers = allKeys.join(',');
        const rows = filtered.map(l => allKeys.map(k => `"${(l[k] ?? '').toString().replace(/"/g, '""')}"`).join(','));
        const csv = [headers, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click();
    }

    return (
        <Layout>
            <div className={styles.page}>
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Leads</h1>
                        <p className={styles.sub}>{leads.length} total contacts</p>
                    </div>
                    <div className={styles.actions}>
                        <input className={styles.search} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
                        <button className={styles.exportBtn} onClick={exportCSV}>Export CSV</button>
                    </div>
                </div>

                {/* Flow tabs */}
                <div className={styles.flowTabs}>
                    <button
                        className={`${styles.flowTab} ${selectedFlow === 'all' ? styles.activeFlowTab : ''}`}
                        onClick={() => setSelectedFlow('all')}
                    >
                        All Flows
                    </button>
                    {flows.map(f => (
                        <button
                            key={f.id}
                            className={`${styles.flowTab} ${selectedFlow === f.id ? styles.activeFlowTab : ''}`}
                            onClick={() => setSelectedFlow(f.id)}
                        >
                            {f.name} {f.active ? '●' : ''}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className={styles.empty}>Loading...</div>
                ) : filtered.length === 0 ? (
                    <div className={styles.empty}>No leads yet for this flow.</div>
                ) : (
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>{allKeys.map(k => <th key={k}>{k}</th>)}</tr>
                            </thead>
                            <tbody>
                                {filtered.map((lead, i) => (
                                    <tr key={lead.id || i}>
                                        {allKeys.map(k => (
                                            <td key={k}>{typeof lead[k] === 'boolean' ? (lead[k] ? '✓' : '—') : (lead[k] ?? '—')}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Layout>
    );
}
