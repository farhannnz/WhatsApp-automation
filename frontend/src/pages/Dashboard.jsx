import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
    AreaChart, Area, BarChart, Bar,
    PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend
} from 'recharts';
import Layout from '../components/Layout';
import QRModal from '../components/QRModal';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import styles from './Dashboard.module.css';

const SOCKET_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '')
    : 'http://localhost:4000';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: '#1f2c34', border: '1px solid #2a3942',
                borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#e9edef'
            }}>
                <p style={{ marginBottom: 6, color: '#8696a0', fontWeight: 600 }}>{label}</p>
                {payload.map(p => (
                    <p key={p.name} style={{ color: p.color, marginBottom: 2 }}>
                        {p.name}: <strong>{p.value}</strong>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const CLASS_COLORS = {
    hot: '#ef4444', warm: '#f59e0b', cold: '#60a5fa', new: '#a78bfa', unclassified: '#8696a0'
};

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [waStatus, setWaStatus] = useState('disconnected');
    const [showQR, setShowQR] = useState(false);

    // Analytics data
    const [flows, setFlows] = useState([]);
    const [aiBots, setAiBots] = useState([]);
    const [aiLeads, setAiLeads] = useState([]);
    const [aiStats, setAiStats] = useState(null);
    const [flowLeads, setFlowLeads] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAll();
        const socket = io(SOCKET_URL, { transports: ['websocket'] });
        socket.on('connect', () => socket.emit('join', user.uid));
        socket.on('wa:status', ({ status }) => setWaStatus(status));
        api.get('/whatsapp/status').then(r => setWaStatus(r.data.status)).catch(() => {});
        return () => socket.disconnect();
    }, []);

    async function loadAll() {
        setLoading(true);
        try {
            const [flowsRes, botsRes, aiLeadsRes, aiStatsRes, flowLeadsRes] = await Promise.all([
                api.get('/flows').catch(() => ({ data: [] })),
                api.get('/ai-bots').catch(() => ({ data: [] })),
                api.get('/ai-leads').catch(() => ({ data: [] })),
                api.get('/ai-leads/stats').catch(() => ({ data: null })),
                api.get('/bulk/leads').catch(() => ({ data: [] })),
            ]);
            setFlows(flowsRes.data || []);
            setAiBots(botsRes.data || []);
            setAiLeads(aiLeadsRes.data || []);
            setAiStats(aiStatsRes.data || null);
            setFlowLeads(flowLeadsRes.data || []);
        } finally {
            setLoading(false);
        }
    }

    async function disconnectWA() {
        await api.post('/whatsapp/disconnect');
        setWaStatus('disconnected');
    }

    // Derived analytics
    const activeFlows = flows.filter(f => f.active).length;
    const activeBots  = aiBots.filter(b => b.active).length;
    const totalLeads  = aiLeads.length + flowLeads.length;

    // AI leads by classification for pie
    const clsPie = ['hot', 'warm', 'cold', 'new', 'unclassified'].map(cls => ({
        name: cls.charAt(0).toUpperCase() + cls.slice(1),
        value: aiStats?.byClassification?.[cls] || 0,
        color: CLASS_COLORS[cls],
    })).filter(d => d.value > 0);

    // AI leads by bot for bar chart
    const botBar = aiStats?.byBot
        ? Object.entries(aiStats.byBot).map(([name, count]) => ({ name, count }))
        : [];

    // AI leads activity over last 7 days
    const last7 = buildLast7Days(aiLeads);

    // Flow leads by day
    const flowLast7 = buildLast7Days(flowLeads);

    // Combined activity chart
    const combinedActivity = last7.map((d, i) => ({
        day: d.day,
        'AI Leads': d.count,
        'Flow Leads': flowLast7[i]?.count || 0,
    }));

    // Flow status pie
    const flowPie = [
        { name: 'Active', value: activeFlows, color: '#25d366' },
        { name: 'Inactive', value: Math.max(flows.length - activeFlows, 0), color: '#2a3942' },
    ].filter(d => d.value > 0);

    // Recent AI leads (top 5)
    const recentAI = [...aiLeads].slice(0, 5);

    const statusColor = {
        ready: '#25d366', qr: '#f59e0b', initializing: '#f59e0b',
        disconnected: '#8696a0', auth_failed: '#ef4444'
    };
    const statusLabel = {
        ready: 'Connected', qr: 'Scan QR', initializing: 'Connecting...',
        disconnected: 'Not Connected', auth_failed: 'Auth Failed'
    };

    return (
        <Layout>
            <div className={styles.page}>

                {/* Header */}
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Dashboard</h1>
                        <p className={styles.sub}>Welcome back, {user?.displayName} 👋</p>
                    </div>
                    <div className={styles.waCard}>
                        <div className={styles.waStatus}>
                            <span className={styles.dot} style={{ background: statusColor[waStatus] || '#8696a0' }} />
                            <span>{statusLabel[waStatus] || waStatus}</span>
                        </div>
                        {waStatus === 'ready' ? (
                            <button className={styles.btnDanger} onClick={disconnectWA}>Disconnect</button>
                        ) : (
                            <button className={styles.btnPrimary} onClick={() => setShowQR(true)}>
                                📱 Connect WhatsApp
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className={styles.statsGrid}>
                    <div className={styles.statCard} onClick={() => navigate('/flows')} style={{ cursor: 'pointer' }}>
                        <div className={styles.statIcon}>🔄</div>
                        <div className={styles.statValue}>{flows.length}</div>
                        <div className={styles.statLabel}>Total Flows</div>
                        <div className={styles.statTrend}>{activeFlows} active</div>
                    </div>
                    <div className={styles.statCard} onClick={() => navigate('/ai-bots')} style={{ cursor: 'pointer' }}>
                        <div className={styles.statIcon}>🤖</div>
                        <div className={styles.statValue}>{aiBots.length}</div>
                        <div className={styles.statLabel}>AI Bots</div>
                        <div className={styles.statTrend}>{activeBots} live</div>
                    </div>
                    <div className={styles.statCard} onClick={() => navigate('/ai-leads')} style={{ cursor: 'pointer' }}>
                        <div className={styles.statIcon}>🔥</div>
                        <div className={styles.statValue}>{aiStats?.byClassification?.hot || 0}</div>
                        <div className={styles.statLabel}>Hot AI Leads</div>
                        <div className={styles.statTrend}>{aiStats?.completionRate || 0}% hot+warm rate</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon}>📋</div>
                        <div className={styles.statValue}>{totalLeads}</div>
                        <div className={styles.statLabel}>Total Leads</div>
                        <div className={styles.statTrend}>AI + Flow combined</div>
                    </div>
                </div>

                {/* Charts Row 1 */}
                <div className={styles.chartsRow}>

                    {/* Combined lead activity */}
                    <div className={styles.chartCard} style={{ flex: 2 }}>
                        <div className={styles.chartTitle}>
                            📈 Lead Activity <span>last 7 days</span>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={combinedActivity} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#25d366" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#25d366" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2c34" vertical={false} />
                                <XAxis dataKey="day" tick={{ fill: '#8696a0', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#8696a0', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 12, color: '#8696a0', paddingTop: 8 }} iconType="circle" />
                                <Area type="monotone" dataKey="AI Leads" stroke="#a78bfa" strokeWidth={2} fill="url(#aiGrad)" dot={false} activeDot={{ r: 4 }} />
                                <Area type="monotone" dataKey="Flow Leads" stroke="#25d366" strokeWidth={2} fill="url(#flowGrad)" dot={false} activeDot={{ r: 4 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* AI Lead Classification Pie */}
                    <div className={styles.chartCard}>
                        <div className={styles.chartTitle}>
                            🥧 AI Lead Classification
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={clsPie.length ? clsPie : [{ name: 'No Leads', value: 1, color: '#2a3942' }]}
                                    cx="50%" cy="50%"
                                    innerRadius={50} outerRadius={75}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {(clsPie.length ? clsPie : [{ name: 'No Leads', value: 1, color: '#2a3942' }]).map((e, i) => (
                                        <Cell key={i} fill={e.color} stroke="transparent" />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#1f2c34', border: '1px solid #2a3942', borderRadius: 10, fontSize: 12, color: '#e9edef' }} />
                                <Legend wrapperStyle={{ fontSize: 11, color: '#8696a0' }} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Flow Status Pie */}
                    <div className={styles.chartCard}>
                        <div className={styles.chartTitle}>
                            🔄 Flow Status
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={flowPie.length ? flowPie : [{ name: 'No Flows', value: 1, color: '#2a3942' }]}
                                    cx="50%" cy="50%"
                                    innerRadius={50} outerRadius={75}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {(flowPie.length ? flowPie : [{ name: 'No Flows', value: 1, color: '#2a3942' }]).map((e, i) => (
                                        <Cell key={i} fill={e.color} stroke="transparent" />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#1f2c34', border: '1px solid #2a3942', borderRadius: 10, fontSize: 12, color: '#e9edef' }} />
                                <Legend wrapperStyle={{ fontSize: 11, color: '#8696a0' }} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Charts Row 2 */}
                {botBar.length > 0 && (
                    <div className={styles.chartsRow}>
                        <div className={styles.chartCard} style={{ flex: 2 }}>
                            <div className={styles.chartTitle}>
                                🤖 Leads per AI Bot
                            </div>
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={botBar} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2c34" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fill: '#8696a0', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#8696a0', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="count" name="Leads" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* AI Lead Classification breakdown bar */}
                        <div className={styles.chartCard}>
                            <div className={styles.chartTitle}>
                                📊 Classification Breakdown
                            </div>
                            <div className={styles.clsBreakdown}>
                                {['hot', 'warm', 'cold', 'new', 'unclassified'].map(cls => {
                                    const count = aiStats?.byClassification?.[cls] || 0;
                                    const pct = aiStats?.total ? Math.round((count / aiStats.total) * 100) : 0;
                                    return (
                                        <div key={cls} className={styles.clsRow}>
                                            <div className={styles.clsLabel} style={{ color: CLASS_COLORS[cls] }}>
                                                {cls.charAt(0).toUpperCase() + cls.slice(1)}
                                            </div>
                                            <div className={styles.clsBar}>
                                                <div
                                                    className={styles.clsFill}
                                                    style={{ width: `${pct}%`, background: CLASS_COLORS[cls] }}
                                                />
                                            </div>
                                            <div className={styles.clsCount}>{count}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Bottom row: Recent AI Leads + Quick Links */}
                <div className={styles.bottomRow}>
                    {/* Recent AI Leads */}
                    <div className={styles.recentCard}>
                        <div className={styles.recentHeader}>
                            <span>🤖 Recent AI Leads</span>
                            <button className={styles.viewAll} onClick={() => navigate('/ai-leads')}>View all →</button>
                        </div>
                        {recentAI.length === 0 ? (
                            <div className={styles.recentEmpty}>No AI leads yet</div>
                        ) : (
                            <table className={styles.recentTable}>
                                <thead>
                                    <tr>
                                        <th>Contact</th>
                                        <th>Bot</th>
                                        <th>Classification</th>
                                        <th>Last Active</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentAI.map(l => {
                                        const clsColor = CLASS_COLORS[l.classification] || '#8696a0';
                                        return (
                                            <tr key={l.id} onClick={() => navigate('/ai-leads')} style={{ cursor: 'pointer' }}>
                                                <td>{l.phone || l.contactId}</td>
                                                <td>{l.botName || '—'}</td>
                                                <td>
                                                    <span style={{
                                                        color: clsColor, background: clsColor + '20',
                                                        border: `1px solid ${clsColor}40`,
                                                        borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600
                                                    }}>
                                                        {l.classification || 'new'}
                                                    </span>
                                                </td>
                                                <td style={{ color: '#8696a0', fontSize: 12 }}>
                                                    {l.updatedAt ? new Date(l.updatedAt).toLocaleDateString('en-IN') : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Quick Links */}
                    <div className={styles.quickCard}>
                        <div className={styles.quickTitle}>⚡ Quick Actions</div>
                        <div className={styles.quickGrid}>
                            <div className={styles.quickItem} onClick={() => navigate('/flows')}>
                                <div className={styles.quickIcon}>🔄</div>
                                <div className={styles.quickLabel}>Manage Flows</div>
                            </div>
                            <div className={styles.quickItem} onClick={() => navigate('/ai-bots')}>
                                <div className={styles.quickIcon}>🤖</div>
                                <div className={styles.quickLabel}>AI Bots</div>
                            </div>
                            <div className={styles.quickItem} onClick={() => navigate('/ai-leads')}>
                                <div className={styles.quickIcon}>📊</div>
                                <div className={styles.quickLabel}>AI Leads</div>
                            </div>
                            <div className={styles.quickItem} onClick={() => navigate('/bulk')}>
                                <div className={styles.quickIcon}>📨</div>
                                <div className={styles.quickLabel}>Bulk Message</div>
                            </div>
                            <div className={styles.quickItem} onClick={() => navigate('/leads')}>
                                <div className={styles.quickIcon}>📋</div>
                                <div className={styles.quickLabel}>Flow Leads</div>
                            </div>
                            {waStatus !== 'ready' && (
                                <div className={styles.quickItem} onClick={() => setShowQR(true)}>
                                    <div className={styles.quickIcon}>📱</div>
                                    <div className={styles.quickLabel}>Connect WA</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {showQR && (
                <QRModal
                    userId={user.uid}
                    onConnected={() => { setShowQR(false); setWaStatus('ready'); }}
                    onClose={() => setShowQR(false)}
                />
            )}
        </Layout>
    );
}

// Build last-7-days activity array from leads list
function buildLast7Days(leads) {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
        const dateStr = d.toDateString();
        const count = leads.filter(l => {
            const t = l.updatedAt || l.createdAt || l.savedAt;
            return t && new Date(t).toDateString() === dateStr;
        }).length;
        days.push({ day: label, count });
    }
    return days;
}
