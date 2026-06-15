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

/* ── Mock analytics data (replace with real API later) ── */
const msgActivity = [
    { day: 'Mon', sent: 42, received: 58 },
    { day: 'Tue', sent: 75, received: 91 },
    { day: 'Wed', sent: 53, received: 67 },
    { day: 'Thu', sent: 88, received: 102 },
    { day: 'Fri', sent: 120, received: 134 },
    { day: 'Sat', sent: 61, received: 74 },
    { day: 'Sun', sent: 34, received: 45 },
];

const flowStats = [
    { name: 'Active', value: 0, color: '#25d366' },
    { name: 'Inactive', value: 0, color: '#2a3942' },
];

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

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [flows, setFlows] = useState([]);
    const [waStatus, setWaStatus] = useState('disconnected');
    const [showQR, setShowQR] = useState(false);
    const [newFlowName, setNewFlowName] = useState('');
    const [creating, setCreating] = useState(false);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        loadFlows();
        const socket = io(SOCKET_URL, { transports: ['websocket'] });
        socket.on('connect', () => socket.emit('join', user.uid));
        socket.on('wa:status', ({ status }) => setWaStatus(status));
        api.get('/whatsapp/status').then(r => setWaStatus(r.data.status)).catch(() => {});
        return () => socket.disconnect();
    }, []);

    async function loadFlows() {
        try {
            setLoadError('');
            const r = await api.get('/flows');
            setFlows(r.data || []);
        } catch (err) {
            setLoadError(err.response?.data?.error || 'Failed to load flows');
        }
    }

    async function createFlow() {
        if (!newFlowName.trim()) return;
        setCreating(true);
        try {
            const r = await api.post('/flows', { name: newFlowName.trim() });
            setNewFlowName('');
            navigate(`/flows/${r.data.id}`);
        } catch {
            setCreating(false);
        }
    }

    async function deleteFlow(id, e) {
        e.stopPropagation();
        if (!confirm('Delete this flow?')) return;
        await api.delete(`/flows/${id}`);
        setFlows(f => f.filter(x => x.id !== id));
    }

    async function toggleActive(flow, e) {
        e.stopPropagation();
        if (flow.active) {
            if (!confirm('Deactivate this flow? Bot will stop responding.')) return;
            await api.patch(`/flows/${flow.id}/deactivate`);
            setFlows(f => f.map(x => x.id === flow.id ? { ...x, active: false } : x));
        } else {
            await api.patch(`/flows/${flow.id}/activate`);
            setFlows(f => f.map(x => ({ ...x, active: x.id === flow.id })));
        }
    }

    async function disconnectWA() {
        await api.post('/whatsapp/disconnect');
        setWaStatus('disconnected');
    }

    const statusColor = {
        ready: '#25d366', qr: '#f59e0b', initializing: '#f59e0b',
        disconnected: '#8696a0', auth_failed: '#ef4444'
    };
    const statusLabel = {
        ready: 'Connected', qr: 'Scan QR Code', initializing: 'Connecting...',
        disconnected: 'Not Connected', auth_failed: 'Auth Failed'
    };

    const activeCount  = flows.filter(f => f.active).length;
    const totalNodes   = flows.reduce((s, f) => s + (f.nodes?.length || 0), 0);
    const pieData = [
        { name: 'Active', value: activeCount || 0, color: '#25d366' },
        { name: 'Inactive', value: Math.max((flows.length - activeCount), 0), color: '#2a3942' },
    ];

    return (
        <Layout>
            <div className={styles.page}>

                {/* ─── Header ─── */}
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Dashboard</h1>
                        <p className={styles.sub}>Welcome back, {user?.displayName} 👋</p>
                    </div>
                    <div className={styles.waCard}>
                        <div className={styles.waStatus}>
                            <span
                                className={styles.dot}
                                style={{ background: statusColor[waStatus] || '#8696a0', color: statusColor[waStatus] || '#8696a0' }}
                            />
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

                {/* ─── Stats Cards ─── */}
                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon}>🔄</div>
                        <div className={styles.statValue}>{flows.length}</div>
                        <div className={styles.statLabel}>Total Flows</div>
                        <div className={styles.statTrend}>↑ Automation ready</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon}>✅</div>
                        <div className={styles.statValue}>{activeCount}</div>
                        <div className={styles.statLabel}>Active Flows</div>
                        <div className={styles.statTrend}>
                            {activeCount > 0 ? '● Bot is live' : '○ None running'}
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon}>🧩</div>
                        <div className={styles.statValue}>{totalNodes}</div>
                        <div className={styles.statLabel}>Total Nodes</div>
                        <div className={styles.statTrend}>↑ Across all flows</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon}>📨</div>
                        <div className={styles.statValue}>573</div>
                        <div className={styles.statLabel}>Messages (7d)</div>
                        <div className={styles.statTrend}>↑ 12% this week</div>
                    </div>
                </div>

                {/* ─── Charts ─── */}
                <div className={styles.chartsRow}>

                    {/* Area Chart — Message Activity */}
                    <div className={styles.chartCard}>
                        <div className={styles.chartTitle}>
                            📈 Message Activity <span>last 7 days</span>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={msgActivity} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#00a884" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#00a884" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="recvGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#25d366" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#25d366" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2c34" vertical={false} />
                                <XAxis dataKey="day" tick={{ fill: '#8696a0', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#8696a0', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    wrapperStyle={{ fontSize: 12, color: '#8696a0', paddingTop: 10 }}
                                    iconType="circle"
                                />
                                <Area
                                    type="monotone" dataKey="sent" name="Sent"
                                    stroke="#00a884" strokeWidth={2}
                                    fill="url(#sentGrad)"
                                    dot={false} activeDot={{ r: 4, fill: '#00a884' }}
                                />
                                <Area
                                    type="monotone" dataKey="received" name="Received"
                                    stroke="#25d366" strokeWidth={2}
                                    fill="url(#recvGrad)"
                                    dot={false} activeDot={{ r: 4, fill: '#25d366' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Pie Chart — Flow Status */}
                    <div className={styles.chartCard}>
                        <div className={styles.chartTitle}>
                            🥧 Flow Status <span>distribution</span>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={pieData.every(d => d.value === 0)
                                        ? [{ name: 'No Flows', value: 1, color: '#2a3942' }]
                                        : pieData
                                    }
                                    cx="50%" cy="50%"
                                    innerRadius={55} outerRadius={80}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {(pieData.every(d => d.value === 0)
                                        ? [{ name: 'No Flows', value: 1, color: '#2a3942' }]
                                        : pieData
                                    ).map((entry, i) => (
                                        <Cell key={i} fill={entry.color} stroke="transparent" />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        background: '#1f2c34', border: '1px solid #2a3942',
                                        borderRadius: 10, fontSize: 12, color: '#e9edef'
                                    }}
                                />
                                <Legend
                                    wrapperStyle={{ fontSize: 12, color: '#8696a0' }}
                                    iconType="circle"
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* ─── Flows Section ─── */}
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>🔄 My Flows</h2>
                        <div className={styles.createRow}>
                            <input
                                className={styles.input}
                                placeholder="Enter flow name..."
                                value={newFlowName}
                                onChange={e => setNewFlowName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && createFlow()}
                            />
                            <button className={styles.btnPrimary} onClick={createFlow} disabled={creating}>
                                {creating ? '...' : '+ New Flow'}
                            </button>
                        </div>
                    </div>

                    {loadError && (
                        <div className={styles.errorBox}>
                            ⚠️ {loadError} —{' '}
                            <button
                                onClick={loadFlows}
                                style={{ color: '#00a884', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {flows.length === 0 && !loadError ? (
                        <div className={styles.empty}>
                            <div style={{ fontSize: 32, marginBottom: 12 }}>🔄</div>
                            No flows yet. Create your first automation flow to get started.
                        </div>
                    ) : (
                        <div className={styles.tableWrap}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Flow Name</th>
                                        <th>Nodes</th>
                                        <th>Status</th>
                                        <th>Updated</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {flows.map(flow => (
                                        <tr key={flow.id}>
                                            <td>
                                                <span className={styles.flowName}>{flow.name}</span>
                                            </td>
                                            <td className={styles.metaCell}>{flow.nodes?.length || 0} nodes</td>
                                            <td>
                                                {flow.active
                                                    ? <span className={styles.activeBadge}>● Active</span>
                                                    : <span className={styles.inactiveBadge}>Inactive</span>
                                                }
                                            </td>
                                            <td className={styles.metaCell}>
                                                {flow.updatedAt ? new Date(flow.updatedAt).toLocaleDateString() : '—'}
                                            </td>
                                            <td>
                                                <div className={styles.rowActions}>
                                                    <button
                                                        className={flow.active ? styles.btnSmallOrange : styles.btnSmallGreen}
                                                        onClick={e => toggleActive(flow, e)}
                                                    >
                                                        {flow.active ? 'Deactivate' : 'Activate'}
                                                    </button>
                                                    <button
                                                        className={styles.btnSmall}
                                                        onClick={() => navigate(`/flows/${flow.id}`)}
                                                    >
                                                        ✏️ Edit
                                                    </button>
                                                    <button
                                                        className={styles.btnSmallRed}
                                                        onClick={e => deleteFlow(flow.id, e)}
                                                    >
                                                        🗑 Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
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
