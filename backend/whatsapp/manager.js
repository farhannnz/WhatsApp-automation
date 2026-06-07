const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { db, rtdb } = require('../firebase');
const flowExecutor = require('./executor');

// RTDB paths — prefixed to avoid conflicts with other bots on same Firebase
const RTDB_STATUS = (uid) => `wbp_waStatus/${uid}`;
const RTDB_QR     = (uid) => `wbp_waQR/${uid}`;

const sessions = new Map();
let _io = null;

function setIO(io) { _io = io; }

function getStatus(userId) {
    const s = sessions.get(userId);
    return s ? s.status : 'disconnected';
}

function getActiveCount() {
    let count = 0;
    sessions.forEach(s => { if (s.status === 'ready') count++; });
    return count;
}

async function setStatus(userId, status) {
    const s = sessions.get(userId);
    if (s) s.status = status;
    await rtdb.ref(RTDB_STATUS(userId)).set({ status, updatedAt: Date.now() });
    if (_io) _io.to(userId).emit('wa:status', { status });
}

function cleanLockFiles(userId) {
    try {
        const lockFile = path.join('./wa_sessions', `session-${userId}`, 'SingletonLock');
        if (fs.existsSync(lockFile)) {
            fs.unlinkSync(lockFile);
            console.log(`🧹 Cleaned lock for: ${userId}`);
        }
    } catch {}
}

async function createSession(userId) {
    const existing = sessions.get(userId);
    if (existing && (existing.status === 'ready' || existing.status === 'qr')) return;

    if (existing) {
        try { await existing.client.destroy(); } catch {}
        sessions.delete(userId);
    }

    cleanLockFiles(userId);

    const chromePaths = [
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.CHROME_PATH
    ].filter(Boolean);

    const executablePath = chromePaths.find(p => { try { return fs.existsSync(p); } catch { return false; } });

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: userId, dataPath: './wa_sessions' }),
        puppeteer: {
            headless: true,
            executablePath: executablePath || '/usr/bin/chromium-browser',
            protocolTimeout: 300000,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--single-process', '--no-zygote']
        }
    });

    sessions.set(userId, { client, status: 'initializing' });
    await setStatus(userId, 'initializing');

    client.on('qr', async (qr) => {
        await setStatus(userId, 'qr');
        const qrImage = await qrcode.toDataURL(qr);
        if (_io) _io.to(userId).emit('wa:qr', { qr: qrImage });
        await rtdb.ref(RTDB_QR(userId)).set({ qr: qrImage, updatedAt: Date.now() });
    });

    client.on('ready', async () => {
        await setStatus(userId, 'ready');
        await rtdb.ref(RTDB_QR(userId)).remove();
        console.log(`✅ WA ready for user: ${userId}`);

        // Inject WA-JS (wppconnect) for list/button support
        try {
            const wppPath = require('path').join(
                __dirname, '..', 'node_modules', '@wppconnect', 'wa-js', 'dist', 'wppconnect-wa.js'
            );
            const wppScript = require('fs').readFileSync(wppPath, 'utf8');
            await client.pupPage.evaluate(wppScript);
            await client.pupPage.waitForFunction('window.WPP && window.WPP.isReady', { timeout: 15000 });
            console.log(`✅ WPP injected for user: ${userId}`);
        } catch (e) {
            console.log(`ℹ️ WPP injection failed: ${e.message}`);
        }
    });

    client.on('auth_failure', async () => {
        await setStatus(userId, 'auth_failed');
        sessions.delete(userId);
    });

    client.on('disconnected', async (reason) => {
        console.log(`⚠️ WA disconnected for ${userId}: ${reason}`);
        await setStatus(userId, 'disconnected');
        sessions.delete(userId);
        // Auto-reconnect after 5 seconds if session folder still exists
        const sessionPath = path.join('./wa_sessions', `session-${userId}`);
        if (fs.existsSync(sessionPath)) {
            console.log(`🔄 Auto-reconnecting ${userId} in 5s...`);
            setTimeout(() => createSession(userId), 5000);
        }
    });

    client.on('message', async (message) => {
        if (message.from === 'status@broadcast') return;
        if (message.from.endsWith('@g.us')) return;
        console.log(`📨 Message received for ${userId} from ${message.from}: ${message.body}`);
        try {
            // Get user's active flow — fetch all user flows, find active one in JS
            const flowSnap = await db.collection('wbp_flows')
                .where('userId', '==', userId)
                .get();
            const activeDoc = flowSnap.docs.find(d => d.data().active === true);
            if (!activeDoc) return;
            const flow = { id: activeDoc.id, ...activeDoc.data() };
            await flowExecutor.handleMessage(userId, flow, message, client);
        } catch (err) {
            console.error(`Flow exec error for ${userId}:`, err.message);
        }
    });

    client.initialize().catch(async (err) => {
        console.error(`❌ WA init failed for ${userId}:`, err.message);
        sessions.delete(userId);
        await setStatus(userId, 'disconnected');
        try {
            const sessionPath = path.join('./wa_sessions', `session-${userId}`);
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log(`🧹 Removed broken session for: ${userId}`);
            }
        } catch {}
    });
}

async function disconnect(userId) {
    const session = sessions.get(userId);
    if (session) {
        try { await session.client.destroy(); } catch {}
        sessions.delete(userId);
    }
    await setStatus(userId, 'disconnected');
}

async function sendMessage(userId, waId, text) {
    let session = sessions.get(userId);
    if (!session || session.status !== 'ready') {
        for (const [, s] of sessions) {
            if (s.status === 'ready') { session = s; break; }
        }
    }
    if (!session || session.status !== 'ready') {
        throw new Error('No ready WhatsApp session found. Please reconnect from Dashboard.');
    }
    await session.client.sendMessage(waId, text);
}

async function sendMedia(userId, waId, filePath, caption) {
    let session = sessions.get(userId);
    if (!session || session.status !== 'ready') {
        for (const [, s] of sessions) {
            if (s.status === 'ready') { session = s; break; }
        }
    }
    if (!session || session.status !== 'ready') throw new Error('WA not connected');
    const { MessageMedia } = require('whatsapp-web.js');
    const media = MessageMedia.fromFilePath(filePath);
    await session.client.sendMessage(waId, media, { caption: caption || '' });
}

async function restoreSessions() {
    try {
        // Check session folders directly — no Firebase query needed
        const sessionsDir = './wa_sessions';
        if (!fs.existsSync(sessionsDir)) return;

        const folders = fs.readdirSync(sessionsDir).filter(f =>
            f.startsWith('session-') && fs.statSync(path.join(sessionsDir, f)).isDirectory()
        );

        for (const folder of folders) {
            const userId = folder.replace('session-', '');
            console.log(`🔄 Restoring WA session for: ${userId}`);
            cleanLockFiles(userId);
            await createSession(userId);
        }
    } catch (err) {
        console.error('Session restore error:', err.message);
    }
}

module.exports = { createSession, disconnect, sendMessage, sendMedia, getStatus, getActiveCount, setIO, restoreSessions };
