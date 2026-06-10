import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api';
import styles from './Dashboard.module.css';

export default function AIBots() {
    const navigate = useNavigate();
    const [bots, setBots] = useState([]);
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => { loadBots(); }, []);

    async function loadBots() {
        const r = await api.get('/ai-bots');
        setBots(r.data || []);
    }

    async function createBot() {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const r = await api.post('/ai-bots', { name: newName.trim() });
            setNewName('');
            navigate(`/ai-bots/${r.data.id}`);
        } catch { setCreating(false); }
    }

    async function deleteBot(id, e) {
        e.stopPropagation();
        if (!confirm('Delete this AI bot?')) return;
        await api.delete(`/ai-bots/${id}`);
        setBots(b => b.filter(x => x.id !== id));
    }

    async function toggleActive(bot, e) {
        e.stopPropagation();
        await api.put(`/ai-bots/${bot.id}`, { active: !bot.active });
        setBots(b => b.map(x => x.id === bot.id ? { ...x, active: !bot.active } : x));
    }

    return (
        <Layout>
            <div className={styles.page}>
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>AI Bots</h1>
                        <p className={styles.sub}>Gemini-powered intelligent WhatsApp bots</p>
                    </div>
                </div>

                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>My AI Bots</h2>
                        <div className={styles.createRow}>
                            <input
                                className={styles.input}
                                placeholder="Bot name..."
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && createBot()}
                            />
                            <button className={styles.btnPrimary} onClick={createBot} disabled={creating}>
                                {creating ? '...' : '+ New AI Bot'}
                            </button>
                        </div>
                    </div>

                    {bots.length === 0 ? (
                        <div className={styles.empty}>No AI bots yet. Create one to get started.</div>
                    ) : (
                        <div className={styles.tableWrap}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Bot Name</th>
                                        <th>Status</th>
                                        <th>Images</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bots.map(bot => (
                                        <tr key={bot.id}>
                                            <td><span className={styles.flowName}>{bot.name}</span></td>
                                            <td>
                                                {bot.active
                                                    ? <span className={styles.activeBadge}>● Active</span>
                                                    : <span className={styles.inactiveBadge}>Inactive</span>}
                                            </td>
                                            <td className={styles.metaCell}>{(bot.images || []).length} images</td>
                                            <td>
                                                <div className={styles.rowActions}>
                                                    <button
                                                        className={bot.active ? styles.btnSmallOrange : styles.btnSmallGreen}
                                                        onClick={e => toggleActive(bot, e)}
                                                    >
                                                        {bot.active ? 'Deactivate' : 'Activate'}
                                                    </button>
                                                    <button className={styles.btnSmall} onClick={() => navigate(`/ai-bots/${bot.id}`)}>
                                                        ✏️ Edit
                                                    </button>
                                                    <button className={styles.btnSmallRed} onClick={e => deleteBot(bot.id, e)}>
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
        </Layout>
    );
}
