import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Layout.module.css';

export default function Layout({ children }) {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    function handleLogout() {
        logout();
        navigate('/login');
    }

    const links = [
        { to: '/dashboard', label: '🏠 Dashboard' },
        { to: '/leads', label: '📋 Leads' },
        { to: '/bulk', label: '📨 Bulk Message' },
        ...(user?.role === 'admin' ? [{ to: '/admin', label: '⚙️ Admin' }] : [])
    ];

    return (
        <div className={styles.layout}>
            <aside className={styles.sidebar}>
                <div className={styles.brand}>🤖 WA Bot</div>
                <nav className={styles.nav}>
                    {links.map(l => (
                        <Link
                            key={l.to}
                            to={l.to}
                            className={`${styles.navLink} ${location.pathname === l.to ? styles.active : ''}`}
                        >
                            {l.label}
                        </Link>
                    ))}
                </nav>
                <div className={styles.userSection}>
                    <div className={styles.userName}>{user?.displayName}</div>
                    <div className={styles.userRole}>{user?.role}</div>
                    <button className={styles.logoutBtn} onClick={handleLogout}>Sign Out</button>
                </div>
            </aside>
            <main className={styles.main}>{children}</main>
        </div>
    );
}
