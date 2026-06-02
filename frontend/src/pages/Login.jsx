import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Login.module.css';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const user = await login(form.username, form.password);
            navigate(user.role === 'admin' ? '/admin' : '/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.logo}>🤖</div>
                <h1 className={styles.title}>WA Bot Platform</h1>
                <p className={styles.sub}>Sign in to your account</p>
                <form onSubmit={handleSubmit} className={styles.form}>
                    <input
                        className={styles.input}
                        placeholder="Username"
                        value={form.username}
                        onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                        autoFocus
                    />
                    <input
                        className={styles.input}
                        type="password"
                        placeholder="Password"
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    />
                    {error && <p className={styles.error}>{error}</p>}
                    <button className={styles.btn} disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
