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
        { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
        { to: '/leads', label: 'Leads', icon: '📋' },
        { to: '/bulk', label: 'Bulk Message', icon: '📨' },
        { to: '/ai-bots', label: 'AI Bots', icon: '🤖' },
        ...(user?.role === 'admin' ? [{ to: '/admin', label: 'Admin', icon: '⚙️' }] : [])
    ];

    const initials = user?.displayName
        ? user.displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    return (
        <div className={styles.layout}>
            <aside className={styles.sidebar}>
                {/* Brand */}
                <div className={styles.brand}>
                    <div className={styles.brandIcon}>💬</div>
                    <div>
                        <div className={styles.brandText}>WA Automation</div>
                        <div className={styles.brandSub}>Pro Dashboard</div>
                    </div>
                </div>

                {/* Nav */}
                <nav className={styles.nav}>
                    {links.map(l => (
                        <Link
                            key={l.to}
                            to={l.to}
                            className={`${styles.navLink} ${location.pathname === l.to ? styles.active : ''}`}
                        >
                            <span>{l.icon}</span>
                            <span>{l.label}</span>
                        </Link>
                    ))}
                </nav>

                {/* User */}
                <div className={styles.userSection}>
                    <div className={styles.userInfo}>
                        <div className={styles.userAvatar}>{initials}</div>
                        <div>
                            <div className={styles.userName}>{user?.displayName || 'User'}</div>
                            <div className={styles.userRole}>{user?.role || 'member'}</div>
                        </div>
                    </div>
                    <button className={styles.logoutBtn} onClick={handleLogout}>
                        Sign Out
                    </button>
                </div>
            </aside>

            <main className={styles.main}>{children}</main>
        </div>
    );
}
