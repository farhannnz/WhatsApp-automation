import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api';
import styles from './Flows.module.css';

export default function Flows() {
    const navigate = useNavigate();
    const [flows, setFlows] = useState([]);
    const [newFlowName, setNewFlowName] = useState('');
    const [creating, setCreating] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => { loadFlows(); }, []);

    async function loadFlows() {
        setLoading(true);
        try {
            setError('');
            const r = await api.get('/flows');
            setFlows(r.data || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load flows');
        } finally {
            setLoading(false);
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

    const activeCount = flows.filter(f => f.active).length;

    return (
        <Layout>
            <div className={styles.page}>
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>🔄 Flows</h1>
                        <p className={styles.sub}>{flows.length} flows · {activeCount} active</p>
                    </div>
                    <div className={styles.createRow}>
                        <input
                            className={styles.input}
                            placeholder="New flow name..."
                            value={newFlowName}
                            onChange={e => setNewFlowName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && createFlow()}
                        />
                        <button className={styles.btnPrimary} onClick={createFlow} disabled={creating}>
                            {creating ? '...' : '+ New Flow'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className={styles.errorBox}>
                        ⚠️ {error} —{' '}
                        <button onClick={loadFlows} className={styles.retryBtn}>Retry</button>
                    </div>
                )}

                {loading ? (
                    <div className={styles.empty}>Loading flows...</div>
                ) : flows.length === 0 && !error ? (
                    <div className={styles.empty}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>🔄</div>
                        <div>No flows yet. Create your first automation flow.</div>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {flows.map(flow => (
                            <div
                                key={flow.id}
                                className={`${styles.card} ${flow.active ? styles.cardActive : ''}`}
                                onClick={() => navigate(`/flows/${flow.id}`)}
                            >
                                <div className={styles.cardTop}>
                                    <div className={styles.cardIcon}>🔄</div>
                                    {flow.active
                                        ? <span className={styles.activeBadge}>● Live</span>
                                        : <span className={styles.inactiveBadge}>Inactive</span>
                                    }
                                </div>
                                <div className={styles.cardName}>{flow.name}</div>
                                <div className={styles.cardMeta}>
                                    {flow.nodes?.length || 0} nodes ·{' '}
                                    {flow.updatedAt ? new Date(flow.updatedAt).toLocaleDateString() : 'No date'}
                                </div>
                                <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
                                    <button
                                        className={flow.active ? styles.btnOrange : styles.btnGreen}
                                        onClick={e => toggleActive(flow, e)}
                                    >
                                        {flow.active ? 'Deactivate' : 'Activate'}
                                    </button>
                                    <button className={styles.btnEdit} onClick={() => navigate(`/flows/${flow.id}`)}>
                                        ✏️ Edit
                                    </button>
                                    <button className={styles.btnDel} onClick={e => deleteFlow(flow.id, e)}>
                                        🗑
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
}
