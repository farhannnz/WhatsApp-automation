import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api';
import styles from './AILeads.module.css';

const CLASS_META = {
    hot:          { label: '🔥 Hot',    color: '#ef4444', bg: '#ef444420', border: '#ef444440' },
    warm:         { label: '🌤 Warm',   color: '#f59e0b', bg: '#f59e0b20', border: '#f59e0b40' },
    cold:         { label: '❄️ Cold',   color: '#60a5fa', bg: '#60a5fa20', border: '#60a5fa40' },
    new:          { label: '🆕 New',    color: '#a78bfa', bg: '#a78bfa20', border: '#a78bfa40' },
    unclassified: { label: '⬜ Unknown', color: '#8696a0', bg: '#2a3942',   border: '#3d4f58'   },
};

export default function AILeads() {
    const [leads, setLeads] = useState([]);
    const [bots, setBots] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterClass, setFilterClass] = useState('all');
    const [filterBot, setFilterBot] = useState('all');
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        loadAll();
    }, []);

    async function loadAll() {
        setLoading(true);
        try {
            const [leadsRes, botsRes, statsRes] = await Promise.all([
                api.get('/ai-leads'),
                api.get('/ai-bots'),
                api.get('/ai-leads/stats'),
            ]);
            setLeads(leadsRes.data || []);
            setBots(botsRes.data || []);
            setStats(statsRes.data || null);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function deleteLead(id) {
        if (!confirm('Delete this lead?')) return;
        await api.delete(`/ai-leads/${id}`);
        setLeads(l => l.filter(x => x.id !== id));
        if (selected?.id === id) setSelected(null);
    }

    function exportCSV() {
        const keys = ['phone', 'name', 'botName', 'classification', 'messageCount', 'updatedAt', 'contactId'];
        const header = keys.join(',');
        const rows = filtered.map(l => keys.map(k => `"${(l[k] ?? '').toString().replace(/"/g, '""')}"`).join(','));
        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ai-leads.csv';
        a.click();
    }

    const filtered = leads.filter(l => {
        if (filterClass !== 'all' && l.classification !== filterClass) return false;
        if (filterBot !== 'all' && l.botId !== filterBot) return false;
        if (search) {
            const q = search.toLowerCase();
            return JSON.stringify(l).toLowerCase().includes(q);
        }
        return true;
    });

    const classGroups = ['hot', 'warm', 'cold', 'new', 'unclassified'];

    return (
        <Layout>
            <div className={styles.page}>

                {/* Header */}
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>🤖 AI Leads</h1>
                        <p className={styles.sub}>{leads.length} total · {filtered.length} shown</p>
                    </div>
                    <div className={styles.headerActions}>
                        <input
                            className={styles.search}
                            placeholder="Search leads..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        <button className={styles.exportBtn} onClick={exportCSV}>Export CSV</button>
                    </div>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className={styles.statsRow}>
                        <div className={styles.statCard}>
                            <div className={styles.statNum}>{stats.total}</div>
                            <div className={styles.statLbl}>Total Leads</div>
                        </div>
                        {classGroups.map(cls => (
                            <div
                                key={cls}
                                className={styles.statCard}
                                style={{ borderColor: CLASS_META[cls]?.border, cursor: 'pointer' }}
                                onClick={() => setFilterClass(filterClass === cls ? 'all' : cls)}
                            >
                                <div className={styles.statNum} style={{ color: CLASS_META[cls]?.color }}>
                                    {stats.byClassification?.[cls] || 0}
                                </div>
                                <div className={styles.statLbl}>{CLASS_META[cls]?.label}</div>
                            </div>
                        ))}
                        <div className={styles.statCard} style={{ borderColor: '#00a88440' }}>
                            <div className={styles.statNum} style={{ color: '#25d366' }}>{stats.completionRate}%</div>
                            <div className={styles.statLbl}>Hot+Warm Rate</div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className={styles.filters}>
                    <div className={styles.filterGroup}>
                        <span className={styles.filterLabel}>Classification:</span>
                        {['all', ...classGroups].map(c => (
                            <button
                                key={c}
                                className={`${styles.filterBtn} ${filterClass === c ? styles.filterActive : ''}`}
                                style={filterClass === c && c !== 'all' ? {
                                    background: CLASS_META[c]?.bg,
                                    color: CLASS_META[c]?.color,
                                    borderColor: CLASS_META[c]?.border,
                                } : {}}
                                onClick={() => setFilterClass(c)}
                            >
                                {c === 'all' ? 'All' : CLASS_META[c]?.label}
                            </button>
                        ))}
                    </div>
                    <div className={styles.filterGroup}>
                        <span className={styles.filterLabel}>Bot:</span>
                        <button
                            className={`${styles.filterBtn} ${filterBot === 'all' ? styles.filterActive : ''}`}
                            onClick={() => setFilterBot('all')}
                        >All</button>
                        {bots.map(b => (
                            <button
                                key={b.id}
                                className={`${styles.filterBtn} ${filterBot === b.id ? styles.filterActive : ''}`}
                                onClick={() => setFilterBot(b.id)}
                            >{b.name}</button>
                        ))}
                    </div>
                </div>

                {/* Table + Detail Panel */}
                <div className={styles.content}>
                    <div className={styles.tableWrap}>
                        {loading ? (
                            <div className={styles.empty}>Loading...</div>
                        ) : filtered.length === 0 ? (
                            <div className={styles.empty}>
                                <div style={{ fontSize: 36, marginBottom: 10 }}>🤖</div>
                                No AI leads yet. Start an AI bot and chat with someone.
                            </div>
                        ) : (
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Contact</th>
                                        <th>Name</th>
                                        <th>Bot</th>
                                        <th>Classification</th>
                                        <th>Messages</th>
                                        <th>Last Active</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(lead => {
                                        const cls = CLASS_META[lead.classification] || CLASS_META.unclassified;
                                        return (
                                            <tr
                                                key={lead.id}
                                                className={`${styles.row} ${selected?.id === lead.id ? styles.rowSelected : ''}`}
                                                onClick={() => setSelected(lead)}
                                            >
                                                <td>
                                                    <div className={styles.phone}>{lead.phone || lead.contactId}</div>
                                                </td>
                                                <td>{lead.name || <span className={styles.na}>—</span>}</td>
                                                <td>
                                                    <span className={styles.botBadge}>{lead.botName || '—'}</span>
                                                </td>
                                                <td>
                                                    <span className={styles.clsBadge} style={{
                                                        background: cls.bg,
                                                        color: cls.color,
                                                        border: `1px solid ${cls.border}`
                                                    }}>
                                                        {cls.label}
                                                    </span>
                                                </td>
                                                <td className={styles.metaCell}>{lead.messageCount || 1}</td>
                                                <td className={styles.metaCell}>
                                                    {lead.updatedAt ? new Date(lead.updatedAt).toLocaleDateString('en-IN') : '—'}
                                                </td>
                                                <td>
                                                    <button
                                                        className={styles.delBtn}
                                                        onClick={e => { e.stopPropagation(); deleteLead(lead.id); }}
                                                    >🗑</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Detail panel */}
                    {selected && (
                        <div className={styles.detail}>
                            <div className={styles.detailHeader}>
                                <div className={styles.detailTitle}>Lead Detail</div>
                                <button className={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
                            </div>
                            <div className={styles.detailBody}>
                                {(() => {
                                    const cls = CLASS_META[selected.classification] || CLASS_META.unclassified;
                                    const skip = new Set(['userId', 'id']);
                                    return (
                                        <>
                                            <div className={styles.detailClsBadge} style={{
                                                background: cls.bg, color: cls.color, border: `1px solid ${cls.border}`
                                            }}>
                                                {cls.label}
                                            </div>
                                            {Object.entries(selected)
                                                .filter(([k]) => !skip.has(k))
                                                .map(([k, v]) => (
                                                    <div key={k} className={styles.detailRow}>
                                                        <div className={styles.detailKey}>{k}</div>
                                                        <div className={styles.detailVal}>
                                                            {typeof v === 'object' ? JSON.stringify(v) : String(v || '—')}
                                                        </div>
                                                    </div>
                                                ))
                                            }
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </Layout>
    );
}
