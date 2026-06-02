import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Layout from '../components/Layout';
import QRModal from '../components/QRModal';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import styles from './Dashboard.module.css';

const SOCKET_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '')
    : 'http://localhost:4000';

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
        ready: '#4ade80', qr: '#facc15', initializing: '#facc15',
        disconnected: '#6b7280', auth_failed: '#f87171'
    };
    const statusLabel = {
        ready: 'Connected', qr: 'Scan QR', initializing: 'Connecting...',
        disconnected: 'Not Connected', auth_failed: 'Auth Failed'
    };

    return (
        <Layout>
            <div className={styles.page}>
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Dashboard</h1>
                        <p className={styles.sub}>Welcome back, {user?.displayName}</p>
                    </div>
                    <div className={styles.waCard}>
                        <div className={styles.waStatus}>
                            <span className={styles.dot} style={{ background: statusColor[waStatus] || '#6b7280' }} />
                            <span>{statusLabel[waStatus] || waStatus}</span>
                        </div>
                        {waStatus === 'ready' ? (
                            <button className={styles.btnDanger} onClick={disconnectWA}>Disconnect</button>
                        ) : (
                            <button className={styles.btnPrimary} onClick={() => setShowQR(true)}>
                                Connect WhatsApp
                            </button>
                        )}
                    </div>
                </div>

                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>My Flows</h2>
                        <div className={styles.createRow}>
                            <input
                                className={styles.input}
                                placeholder="Flow name..."
                                value={newFlowName}
                                onChange={e => setNewFlowName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && createFlow()}
                            />
                            <button className={styles.btnPrimary} onClick={createFlow} disabled={creating}>
                                {creating ? '...' : '+ New Flow'}
                            </button>
                        </div>
                    </div>

                    {loadError && <div className={styles.errorBox}>⚠️ {loadError} — <button onClick={loadFlows} style={{color:'#6366f1',background:'none',border:'none',cursor:'pointer'}}>Retry</button></div>}

                    {flows.length === 0 && !loadError ? (
                        <div className={styles.empty}>No flows yet. Create one to get started.</div>
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
                                                        title={flow.active ? 'Active — click to see options' : 'Activate this flow'}
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
