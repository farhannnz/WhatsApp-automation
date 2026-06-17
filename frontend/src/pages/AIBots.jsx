import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api';
import styles from './AIBots.module.css';

export default function AIBots() {
    const navigate = useNavigate();
    const [bots, setBots] = useState([]);
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(null); // botId being toggled

    useEffect(() => { loadBots(); }, []);

    async function loadBots() {
        setLoading(true);
        try {
            const r = await api.get('/ai-bots');
            setBots(r.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
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
        setToggling(bot.id);
        try {
            const newActive = !bot.active;
            await api.put(`/ai-bots/${bot.id}`, { active: newActive });
            // Reload from server to get accurate state
            await loadBots();
        } catch (err) {
            console.error('Toggle failed:', err);
        } finally {
            setToggling(null);
        }
    }

    const activeCount = bots.filter(b => b.active).length;

    return (
        <Layout>
            <div className={styles.page}>

                {/* Header */}
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>🤖 AI Bots</h1>
                        <p className={styles.sub}>
                            {bots.length} bots · {activeCount} active — Gemini-powered WhatsApp assistants
                        </p>
                    </div>
                    <div className={styles.createRow}>
                        <input
                            className={styles.input}
                            placeholder="New bot name..."
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && createBot()}
                        />
                        <button className={styles.btnPrimary} onClick={createBot} disabled={creating}>
                            {creating ? '...' : '+ New AI Bot'}
                        </button>
                    </div>
                </div>

                {/* Bots */}
                {loading ? (
                    <div className={styles.empty}>Loading bots...</div>
                ) : bots.length === 0 ? (
                    <div className={styles.empty}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
                        <div>No AI bots yet. Create one to get started.</div>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {bots.map(bot => (
                            <div
                                key={bot.id}
                                className={`${styles.card} ${bot.active ? styles.cardActive : ''}`}
                            >
                                <div className={styles.cardTop}>
                                    <div className={styles.cardIcon}>🤖</div>
                                    {bot.active
                                        ? <span className={styles.activeBadge}>● Live</span>
                                        : <span className={styles.inactiveBadge}>Inactive</span>
                                    }
                                </div>

                                <div className={styles.cardName}>{bot.name}</div>

                                <div className={styles.cardMeta}>
                                    <span>{(bot.images || []).length} images</span>
                                    <span>·</span>
                                    <span>{bot.leadFields?.length || 2} lead fields</span>
                                    {bot.updatedAt && (
                                        <>
                                            <span>·</span>
                                            <span>{new Date(bot.updatedAt).toLocaleDateString()}</span>
                                        </>
                                    )}
                                </div>

                                {/* Gemini key status */}
                                <div className={styles.keyStatus}>
                                    {bot.geminiApiKey
                                        ? <span className={styles.keyOk}>✅ API key set</span>
                                        : <span className={styles.keyMissing}>⚠️ No API key</span>
                                    }
                                </div>

                                <div className={styles.cardActions}>
                                    <button
                                        className={bot.active ? styles.btnOrange : styles.btnGreen}
                                        onClick={e => toggleActive(bot, e)}
                                        disabled={toggling === bot.id}
                                    >
                                        {toggling === bot.id
                                            ? '...'
                                            : bot.active ? 'Deactivate' : 'Activate'
                                        }
                                    </button>
                                    <button
                                        className={styles.btnEdit}
                                        onClick={() => navigate(`/ai-bots/${bot.id}`)}
                                    >
                                        ✏️ Edit
                                    </button>
                                    <button
                                        className={styles.btnDel}
                                        onClick={e => deleteBot(bot.id, e)}
                                    >
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
