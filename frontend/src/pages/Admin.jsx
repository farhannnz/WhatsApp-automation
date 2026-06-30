import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api';
import styles from './Admin.module.css';

export default function Admin() {
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState(null);
    const [form, setForm] = useState({ username: '', password: '', displayName: '' });
    const [error, setError] = useState('');
    const [creating, setCreating] = useState(false);
    const [tab, setTab] = useState('users');
    const [geminiKey, setGeminiKey] = useState('');
    const [keyStatus, setKeyStatus] = useState('');
    const [savingKey, setSavingKey] = useState(false);

    useEffect(() => {
        loadUsers();
        api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {});
        api.get('/admin/settings').then(r => setKeyStatus(r.data.hasKey ? `✅ Key set (${r.data.geminiKeyPreview})` : '❌ No key')).catch(() => {});
    }, []);

    async function loadUsers() {
        const r = await api.get('/admin/users');
        setUsers(r.data);
    }

    async function createUser(e) {
        e.preventDefault();
        setError('');
        if (!form.username || !form.password) { setError('Username and password required'); return; }
        setCreating(true);
        try {
            await api.post('/admin/users', form);
            setForm({ username: '', password: '', displayName: '' });
            await loadUsers();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create user');
        } finally {
            setCreating(false);
        }
    }

    async function saveGeminiKey() {
        if (!geminiKey.trim()) return;
        setSavingKey(true);
        try {
            await api.post('/admin/settings', { geminiApiKey: geminiKey.trim() });
            setKeyStatus('✅ Key saved — all bots will use this key');
            setGeminiKey('');
        } catch (e) {
            setKeyStatus('❌ Failed to save key');
        } finally {
            setSavingKey(false);
        }
    }
        await api.patch(`/admin/users/${uid}`, { active: !active });
        setUsers(u => u.map(x => x.uid === uid ? { ...x, active: !active } : x));
    }

    async function deleteUser(uid) {
        if (!confirm('Delete this user and all their data?')) return;
        await api.delete(`/admin/users/${uid}`);
        setUsers(u => u.filter(x => x.uid !== uid));
    }

    const statusColor = { ready: '#4ade80', disconnected: '#6b7280', qr: '#facc15', initializing: '#facc15', auth_failed: '#f87171' };

    return (
        <Layout>
            <div className={styles.page}>
                <h1 className={styles.title}>Admin Panel</h1>

                {stats && (
                    <div className={styles.statsRow}>
                        {[
                            { label: 'Total Users', value: stats.totalUsers },
                            { label: 'Total Leads', value: stats.totalLeads },
                            { label: 'Total Flows', value: stats.totalFlows },
                            { label: 'Active WA Sessions', value: stats.activeConnections }
                        ].map(s => (
                            <div key={s.label} className={styles.statCard}>
                                <div className={styles.statValue}>{s.value}</div>
                                <div className={styles.statLabel}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>🔑 Global Gemini API Key</h2>
                    <p style={{ color: '#8696a0', fontSize: 13, marginBottom: 12 }}>
                        This key is used by ALL AI bots. Users don't need to set their own keys.
                        {keyStatus && <span style={{ marginLeft: 10, color: keyStatus.startsWith('✅') ? '#25d366' : '#f59e0b' }}>{keyStatus}</span>}
                    </p>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input
                            className={styles.input}
                            type="password"
                            placeholder="AIza... (paste new Gemini API key)"
                            value={geminiKey}
                            onChange={e => setGeminiKey(e.target.value)}
                            style={{ flex: 1, maxWidth: 400 }}
                        />
                        <button className={styles.btnPrimary} onClick={saveGeminiKey} disabled={savingKey || !geminiKey.trim()}>
                            {savingKey ? 'Saving...' : 'Save Key'}
                        </button>
                    </div>
                </div>

                <div className={styles.section}>
                    <form className={styles.createForm} onSubmit={createUser}>
                        <input className={styles.input} placeholder="Username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                        <input className={styles.input} placeholder="Display Name (optional)" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
                        <input className={styles.input} type="password" placeholder="Password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                        {error && <p className={styles.error}>{error}</p>}
                        <button className={styles.btnPrimary} disabled={creating}>{creating ? 'Creating...' : 'Create User'}</button>
                    </form>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Users ({users.length})</h2>
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Role</th>
                                    <th>WA Status</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.uid}>
                                        <td>
                                            <div className={styles.userName}>{u.displayName}</div>
                                            <div className={styles.userSub}>@{u.username}</div>
                                        </td>
                                        <td><span className={styles.roleBadge}>{u.role}</span></td>
                                        <td>
                                            <span className={styles.dot} style={{ background: statusColor[u.waStatus] || '#6b7280' }} />
                                            {u.waStatus || 'disconnected'}
                                        </td>
                                        <td>
                                            <span className={u.active ? styles.activeBadge : styles.inactiveBadge}>
                                                {u.active ? 'Active' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td className={styles.dateCell}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                                        <td>
                                            <div className={styles.rowActions}>
                                                {u.role !== 'admin' && (
                                                    <>
                                                        <button
                                                            className={u.active ? styles.btnSmallRed : styles.btnSmallGreen}
                                                            onClick={() => toggleUser(u.uid, u.active)}
                                                        >
                                                            {u.active ? 'Disable' : 'Enable'}
                                                        </button>
                                                        <button className={styles.btnSmallRed} onClick={() => deleteUser(u.uid)}>Delete</button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
