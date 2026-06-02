import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import api from '../api';
import styles from './QRModal.module.css';

const SOCKET_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '')
    : 'http://localhost:4000';

export default function QRModal({ userId, onConnected, onClose }) {
    const [qr, setQr] = useState(null);
    const [status, setStatus] = useState('initializing');

    useEffect(() => {
        const socket = io(SOCKET_URL, { transports: ['websocket'] });

        socket.on('connect', () => {
            socket.emit('join', userId);
        });

        socket.on('wa:qr', ({ qr }) => {
            setQr(qr);
            setStatus('qr');
        });

        socket.on('wa:status', ({ status }) => {
            setStatus(status);
            if (status === 'ready') {
                setTimeout(() => onConnected(), 1000);
            }
        });

        // Trigger connect
        api.post('/whatsapp/connect').catch(() => {});

        return () => socket.disconnect();
    }, [userId]);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <button className={styles.close} onClick={onClose}>✕</button>
                <h2 className={styles.title}>Connect WhatsApp</h2>

                {status === 'ready' ? (
                    <div className={styles.success}>
                        <div className={styles.checkIcon}>✅</div>
                        <p>WhatsApp Connected!</p>
                    </div>
                ) : status === 'qr' && qr ? (
                    <>
                        <p className={styles.hint}>Open WhatsApp → Linked Devices → Link a Device</p>
                        <img src={qr} alt="QR Code" className={styles.qr} />
                        <p className={styles.sub}>Scan this QR code with your phone</p>
                    </>
                ) : (
                    <div className={styles.loading}>
                        <div className={styles.spinner} />
                        <p>{status === 'auth_failed' ? '❌ Auth failed. Try again.' : 'Starting session...'}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
