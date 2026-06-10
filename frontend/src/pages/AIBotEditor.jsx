import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api';
import styles from './AIBotEditor.module.css';

export default function AIBotEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [bot, setBot] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [tab, setTab] = useState('setup');
    const [uploading, setUploading] = useState(false);
    const [newField, setNewField] = useState('');
    const imgInputRef = useRef();
    const [imgForm, setImgForm] = useState({ name: '', tags: '' });

    useEffect(() => {
        api.get(`/ai-bots/${id}`).then(r => setBot(r.data)).catch(() => navigate('/ai-bots'));
    }, [id]);

    function update(key, val) {
        setBot(b => ({ ...b, [key]: val }));
    }

    async function save() {
        setSaving(true);
        try {
            await api.put(`/ai-bots/${id}`, {
                name: bot.name,
                geminiApiKey: bot.geminiApiKey,
                systemPrompt: bot.systemPrompt,
                contextText: bot.contextText,
                leadFields: bot.leadFields,
                sheetUrl: bot.sheetUrl,
                notifyNumber: bot.notifyNumber,
                active: bot.active
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch { }
        setSaving(false);
    }

    async function uploadImage() {
        const file = imgInputRef.current?.files?.[0];
        if (!file || !imgForm.name) return alert('Select image and enter name');
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('name', imgForm.name);
            formData.append('tags', imgForm.tags);
            const r = await api.post(`/ai-bots/${id}/images`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setBot(b => ({ ...b, images: [...(b.images || []), r.data] }));
            setImgForm({ name: '', tags: '' });
            imgInputRef.current.value = '';
        } catch (e) { alert('Upload failed') }
        setUploading(false);
    }

    async function deleteImage(imgId) {
        await api.delete(`/ai-bots/${id}/images/${imgId}`);
        setBot(b => ({ ...b, images: (b.images || []).filter(i => i.id !== imgId) }));
    }

    function addField() {
        if (!newField.trim()) return;
        update('leadFields', [...(bot.leadFields || []), newField.trim().toLowerCase().replace(/\s/g, '_')]);
        setNewField('');
    }

    function removeField(f) {
        update('leadFields', (bot.leadFields || []).filter(x => x !== f));
    }

    if (!bot) return <Layout><div style={{ color: '#9ca3af', padding: 40 }}>Loading...</div></Layout>;

    const TABS = ['setup', 'prompt', 'images', 'leads', 'sheet'];

    return (
        <Layout>
            <div className={styles.page}>
                <div className={styles.topbar}>
                    <button className={styles.back} onClick={() => navigate('/ai-bots')}>← Back</button>
                    <div className={styles.title}>
                        <input
                            className={styles.nameInput}
                            value={bot.name}
                            onChange={e => update('name', e.target.value)}
                        />
                        {bot.active && <span className={styles.activeBadge}>● Active</span>}
                    </div>
                    <div className={styles.topActions}>
                        <label className={styles.toggle}>
                            <input type="checkbox" checked={bot.active} onChange={e => update('active', e.target.checked)} />
                            <span className={styles.toggleSlider} />
                            <span style={{ color: '#9ca3af', fontSize: 13 }}>{bot.active ? 'Active' : 'Inactive'}</span>
                        </label>
                        <button className={styles.btnSave} onClick={save} disabled={saving}>
                            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
                        </button>
                    </div>
                </div>

                <div className={styles.tabs}>
                    {TABS.map(t => (
                        <button key={t} className={tab === t ? styles.tabActive : styles.tab} onClick={() => setTab(t)}>
                            {t === 'setup' ? '⚙️ Setup' : t === 'prompt' ? '🧠 Prompt' : t === 'images' ? '🖼️ Images' : t === 'leads' ? '👤 Lead Fields' : '📊 Sheet'}
                        </button>
                    ))}
                </div>

                <div className={styles.body}>
                    {tab === 'setup' && (
                        <div className={styles.section}>
                            <Field label="Gemini API Key">
                                <input className={styles.input} type="password" value={bot.geminiApiKey || ''} onChange={e => update('geminiApiKey', e.target.value)} placeholder="AIza..." />
                                <p className={styles.hint}>Get free key at <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>aistudio.google.com</a></p>
                            </Field>
                            <Field label="Notify Number (on handover)">
                                <input className={styles.input} value={bot.notifyNumber || ''} onChange={e => update('notifyNumber', e.target.value)} placeholder="919876543210" />
                                <p className={styles.hint}>WhatsApp number to notify when handover is triggered</p>
                            </Field>
                        </div>
                    )}

                    {tab === 'prompt' && (
                        <div className={styles.section}>
                            <Field label="System Prompt">
                                <textarea className={styles.textarea} rows={8} value={bot.systemPrompt || ''} onChange={e => update('systemPrompt', e.target.value)}
                                    placeholder={`You are a sales assistant for XYZ Store. You help customers find products, answer questions, and collect their contact info for follow-up.\n\nBe friendly, concise, and helpful. Always reply in the customer's language.`} />
                            </Field>
                            <Field label="Business Context / Catalogue">
                                <textarea className={styles.textarea} rows={10} value={bot.contextText || ''} onChange={e => update('contextText', e.target.value)}
                                    placeholder={`Paste your product catalogue, FAQs, pricing, policies here...\n\nExample:\nProduct: Red Kurta - Price: ₹999 - Sizes: S, M, L, XL\nProduct: Blue Jeans - Price: ₹1499 - Sizes: 28-36\n\nReturn Policy: 7 days return...`} />
                                <p className={styles.hint}>This context is given to Gemini with every message — include products, prices, FAQs, policies</p>
                            </Field>
                        </div>
                    )}

                    {tab === 'images' && (
                        <div className={styles.section}>
                            <Field label="Upload Product Image">
                                <div className={styles.uploadBox}>
                                    <input ref={imgInputRef} type="file" accept="image/*" style={{ marginBottom: 10 }} />
                                    <input className={styles.input} value={imgForm.name} onChange={e => setImgForm(f => ({ ...f, name: e.target.value }))} placeholder="Image name (e.g. Red Kurta)" style={{ marginBottom: 8 }} />
                                    <input className={styles.input} value={imgForm.tags} onChange={e => setImgForm(f => ({ ...f, tags: e.target.value }))} placeholder="Tags (e.g. red, kurta, cotton, women)" style={{ marginBottom: 8 }} />
                                    <button className={styles.btnPrimary} onClick={uploadImage} disabled={uploading}>
                                        {uploading ? 'Uploading...' : '📤 Upload'}
                                    </button>
                                </div>
                                <p className={styles.hint}>Gemini will use image name and tags to decide when to send which image</p>
                            </Field>

                            <div className={styles.imageGrid}>
                                {(bot.images || []).map(img => (
                                    <div key={img.id} className={styles.imageCard}>
                                        <img src={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4000'}${img.url}`} alt={img.name} className={styles.imgThumb} />
                                        <div className={styles.imgInfo}>
                                            <div className={styles.imgName}>{img.name}</div>
                                            <div className={styles.imgTags}>{img.tags}</div>
                                            <div className={styles.imgId}>ID: {img.id}</div>
                                        </div>
                                        <button className={styles.imgDelete} onClick={() => deleteImage(img.id)}>✕</button>
                                    </div>
                                ))}
                                {(bot.images || []).length === 0 && (
                                    <div style={{ color: '#6b7280', fontSize: 13 }}>No images uploaded yet</div>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'leads' && (
                        <div className={styles.section}>
                            <Field label="Lead Fields to Collect">
                                <p className={styles.hint} style={{ marginBottom: 12 }}>Gemini will collect these fields naturally in conversation and save them automatically</p>
                                <div className={styles.fieldsList}>
                                    {(bot.leadFields || []).map(f => (
                                        <div key={f} className={styles.fieldTag}>
                                            {f}
                                            <button onClick={() => removeField(f)} style={{ marginLeft: 6, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                    <input className={styles.input} value={newField} onChange={e => setNewField(e.target.value)} placeholder="Add field (e.g. city, budget, interest)" onKeyDown={e => e.key === 'Enter' && addField()} />
                                    <button className={styles.btnPrimary} onClick={addField}>Add</button>
                                </div>
                            </Field>
                        </div>
                    )}

                    {tab === 'sheet' && (
                        <div className={styles.section}>
                            <Field label="Google Sheet URL">
                                <input className={styles.input} value={bot.sheetUrl || ''} onChange={e => update('sheetUrl', e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
                                <p className={styles.hint}>When Gemini collects enough lead info, it will automatically save to this sheet. Make sure to share the sheet with the service account email.</p>
                            </Field>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}

function Field({ label, children }) {
    return (
        <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {label}
            </label>
            {children}
        </div>
    );
}
