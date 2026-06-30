import { useState, useEffect } from 'react';
import api from '../api';
import styles from './ExcludedNumbers.module.css';

export default function ExcludedNumbers() {
    const [numbers, setNumbers] = useState([]);
    const [input, setInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        api.get('/whatsapp/excluded')
            .then(r => setNumbers(r.data.excluded || []))
            .catch(() => {});
    }, []);

    function addNumber() {
        const clean = input.replace(/[\s\+\-]/g, '');
        if (!clean) return;
        if (numbers.includes(clean)) { setInput(''); return; }
        setNumbers(n => [...n, clean]);
        setInput('');
    }

    function removeNumber(n) {
        setNumbers(nums => nums.filter(x => x !== n));
    }

    async function save() {
        setSaving(true);
        try {
            await api.post('/whatsapp/excluded', { numbers });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            alert('Failed to save');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <div>
                    <div className={styles.title}>🚫 Excluded Numbers</div>
                    <div className={styles.sub}>Bot will completely ignore these numbers</div>
                </div>
                <button className={styles.saveBtn} onClick={save} disabled={saving}>
                    {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
                </button>
            </div>

            <div className={styles.inputRow}>
                <input
                    className={styles.input}
                    placeholder="Enter number (e.g. 919876543210)"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addNumber()}
                />
                <button className={styles.addBtn} onClick={addNumber}>+ Add</button>
            </div>

            {numbers.length === 0 ? (
                <div className={styles.empty}>No numbers excluded. Bot responds to everyone.</div>
            ) : (
                <div className={styles.list}>
                    {numbers.map(n => (
                        <div key={n} className={styles.tag}>
                            <span>+{n}</span>
                            <button className={styles.removeBtn} onClick={() => removeNumber(n)}>✕</button>
                        </div>
                    ))}
                </div>
            )}

            <div className={styles.hint}>
                Enter numbers without + or spaces. Example: <code>919876543210</code> for +91 98765 43210
            </div>
        </div>
    );
}
