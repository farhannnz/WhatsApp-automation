/**
 * WhatsApp Manager — Baileys based
 * No Chrome/Puppeteer — pure WebSocket, much more stable
 */

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    isJidBroadcast,
    isJidGroup,
    isJidNewsletter,
    proto,
    generateWAMessageFromContent,
    prepareWAMessageMedia,
    areJidsSameUser
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { db } = require('../firebase');

const SESSIONS_DIR = './ba_sessions'; // new folder — separate from old wa_sessions
const BTF_USERNAME = 'boxtofit';

const sessions = new Map(); // userId -> { sock, status, qr, retryCount }
const processedMsgIds = new Set(); // duplicate message prevention
let _io = null;
let btfUserId = null;
let btfBot = null;

function setIO(io) { _io = io; }

function getStatus(userId) {
    return sessions.get(userId)?.status || 'disconnected';
}

function getActiveCount() {
    let count = 0;
    sessions.forEach(s => { if (s.status === 'ready') count++; });
    return count;
}

function setStatus(userId, status) {
    const s = sessions.get(userId);
    if (s) s.status = status;
    if (_io) _io.to(userId).emit('wa:status', { status });
}

function makeLogger() {
    return pino({ level: 'silent' }); // quiet logs
}

async function createSession(userId) {
    const existing = sessions.get(userId);
    if (existing && (existing.status === 'ready' || existing.status === 'qr')) return;

    // Close existing if any
    if (existing?.sock) {
        try { existing.sock.end(); } catch { }
        sessions.delete(userId);
    }

    const sessionDir = path.join(SESSIONS_DIR, `session-${userId}`);
    fs.mkdirSync(sessionDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: makeLogger(),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, makeLogger())
        },
        printQRInTerminal: false,
        browser: ['WA Automation', 'Chrome', '121.0.0'],
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        getMessage: async () => undefined,
    });

    sessions.set(userId, { sock, status: 'initializing', retryCount: 0 });
    setStatus(userId, 'initializing');

    // ── Creds update ──
    sock.ev.on('creds.update', saveCreds);

    // ── Connection update ──
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            setStatus(userId, 'qr');
            try {
                const qrImage = await qrcode.toDataURL(qr);
                if (_io) _io.to(userId).emit('wa:qr', { qr: qrImage });
                console.log(`� QR ready for user: ${userId}`);
            } catch (e) {
                console.error('QR generate error:', e.message);
            }
        }

        if (connection === 'open') {
            setStatus(userId, 'ready');
            const s = sessions.get(userId);
            if (s) s.retryCount = 0;
            console.log(`✅ WA ready for user: ${userId}`);

            // BTF hook
            try {
                const snap = await db.collection('wbp_users')
                    .where('username', '==', BTF_USERNAME).limit(1).get();
                if (!snap.empty && snap.docs[0].id === userId) {
                    btfUserId = userId;
                    btfBot = require(path.join(__dirname, '../../index.js'));
                    // Pass a compatible client wrapper
                    btfBot.initBTFBot(makeBotClient(userId));
                    console.log(`✅ BTF bot hooked for userId: ${userId}`);
                }
            } catch (e) {
                console.log(`ℹ️ BTF hook failed: ${e.message}`);
            }
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const reason = DisconnectReason;
            const shouldReconnect = statusCode !== reason.loggedOut;

            console.log(`⚠️ WA disconnected for ${userId}, code: ${statusCode}`);
            setStatus(userId, 'disconnected');

            if (statusCode === reason.loggedOut) {
                // User logged out — clear session
                console.log(`🚪 ${userId} logged out — clearing session`);
                sessions.delete(userId);
                try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch { }
                return;
            }

            // Auto reconnect with backoff
            const s = sessions.get(userId);
            const retryCount = (s?.retryCount || 0) + 1;
            if (s) s.retryCount = retryCount;

            const delay = Math.min(retryCount * 5000, 60000); // max 60s
            console.log(`🔄 Reconnecting ${userId} in ${delay / 1000}s (attempt ${retryCount})...`);
            sessions.delete(userId);
            setTimeout(() => createSession(userId), delay);
        }
    });

    // ── Messages ──
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            try {
                if (!msg.message) continue;
                if (msg.key.fromMe) continue;
                if (isJidBroadcast(msg.key.remoteJid)) continue;
                if (isJidGroup(msg.key.remoteJid)) continue;
                if (isJidNewsletter?.(msg.key.remoteJid)) continue;

                // ✅ Duplicate message guard
                const msgId = msg.key.id;
                if (processedMsgIds.has(msgId)) {
                    console.log(`⚠️ Duplicate msg ignored: ${msgId}`);
                    continue;
                }
                processedMsgIds.add(msgId);
                // Clean old IDs to prevent memory leak (keep last 1000)
                if (processedMsgIds.size > 1000) {
                    const first = processedMsgIds.values().next().value;
                    processedMsgIds.delete(first);
                }

                const from = msg.key.remoteJid;
                const body = msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    msg.message?.buttonsResponseMessage?.selectedDisplayText ||
                    msg.message?.listResponseMessage?.title ||
                    msg.message?.templateButtonReplyMessage?.selectedDisplayText ||
                    '';

                console.log(`📨 Message received for ${userId} from ${from}: ${body}`);

                // Build compatible message wrapper
                const message = makeMessageWrapper(sock, msg, from, body, userId);

                // BTF route
                if (btfUserId && userId === btfUserId && btfBot) {
                    try {
                        await btfBot.handleMessage(from, body.trim(), message);
                    } catch (err) {
                        console.error(`BTF exec error:`, err.message);
                    }
                    continue;
                }

                // AI bot check
                const aiBotSnap = await db.collection('wbp_ai_bots')
                    .where('userId', '==', userId).where('active', '==', true).limit(1).get();
                if (!aiBotSnap.empty) {
                    const botConfig = { id: aiBotSnap.docs[0].id, ...aiBotSnap.docs[0].data() };
                    const { handleAIMessage } = require('./aiHandler');
                    await handleAIMessage(userId, botConfig, message, makeBotClient(userId));
                    continue;
                }

                // Flow executor
                const flowSnap = await db.collection('wbp_flows')
                    .where('userId', '==', userId).get();
                const activeDoc = flowSnap.docs.find(d => d.data().active === true);
                if (!activeDoc) continue;
                const flow = { id: activeDoc.id, ...activeDoc.data() };
                const flowExecutor = require('./executor');
                await flowExecutor.handleMessage(userId, flow, message, makeBotClient(userId));

            } catch (err) {
                console.error(`Message handler error for ${userId}:`, err.message);
            }
        }
    });
}

// ── Message wrapper — makes Baileys msg look like whatsapp-web.js message ──
function makeMessageWrapper(sock, msg, from, body, userId) {
    return {
        from,
        body,
        fromMe: msg.key.fromMe,
        _data: { notifyName: msg.pushName || '' },
        selectedRowId: msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId || null,

        reply: async (text) => {
            try {
                await sock.sendMessage(from, { text: String(text) }, { quoted: msg });
            } catch (e) {
                console.error('Reply error:', e.message);
            }
        },

        // sendMessage on the contact (not quoted)
        sendMessage: async (text) => {
            try {
                await sock.sendMessage(from, { text: String(text) });
            } catch (e) {
                console.error('sendMessage error:', e.message);
            }
        },
    };
}

// ── Bot client wrapper — used by executor, aiHandler, bulk etc ──
function makeBotClient(userId) {
    return {
        sendMessage: async (to, content, options = {}) => {
            const sock = sessions.get(userId)?.sock;
            if (!sock) throw new Error('No active session');

            // String path — read file and send as media
            if (typeof content === 'string' && (content.startsWith('/') || content.includes('\\') || content.includes('uploads'))) {
                try {
                    const buffer = fs.readFileSync(content);
                    const ext = path.extname(content).toLowerCase();
                    const mimeMap = {
                        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                        '.gif': 'image/gif', '.webp': 'image/webp',
                        '.mp4': 'video/mp4', '.pdf': 'application/pdf',
                    };
                    const mimetype = mimeMap[ext] || 'application/octet-stream';
                    const caption = options.caption || '';

                    if (mimetype.startsWith('image/')) {
                        await sock.sendMessage(to, { image: buffer, caption, mimetype });
                    } else if (mimetype.startsWith('video/')) {
                        await sock.sendMessage(to, { video: buffer, caption, mimetype });
                    } else {
                        await sock.sendMessage(to, { document: buffer, caption, mimetype, fileName: path.basename(content) });
                    }
                } catch (e) {
                    console.error('File send error:', e.message);
                    if (options.caption) await sock.sendMessage(to, { text: options.caption });
                }
                return;
            }

            // Plain text
            if (typeof content === 'string') {
                await sock.sendMessage(to, { text: content });
                return;
            }

            // Buffer/object with data (legacy MessageMedia format)
            if (content && content.data) {
                const buffer = Buffer.from(content.data, 'base64');
                const mimetype = content.mimetype || 'application/octet-stream';
                const caption = options.caption || '';
                if (mimetype.startsWith('image/')) {
                    await sock.sendMessage(to, { image: buffer, caption, mimetype });
                } else if (mimetype.startsWith('video/')) {
                    await sock.sendMessage(to, { video: buffer, caption, mimetype });
                } else {
                    await sock.sendMessage(to, { document: buffer, caption, mimetype, fileName: content.filename || 'file' });
                }
                return;
            }

            await sock.sendMessage(to, { text: String(content) });
        },

        pupPage: {
            evaluate: async () => 'wpp_not_ready'
        }
    };
}

async function disconnect(userId) {
    const session = sessions.get(userId);
    if (session?.sock) {
        try { session.sock.end(); } catch { }
    }
    sessions.delete(userId);
    setStatus(userId, 'disconnected');
}

async function sendMessage(userId, waId, text) {
    const session = sessions.get(userId);
    if (!session || session.status !== 'ready') {
        throw new Error('WhatsApp not connected. Please reconnect from Dashboard.');
    }
    await session.sock.sendMessage(waId, { text: String(text) });
}

async function sendMedia(userId, waId, filePath, caption) {
    const session = sessions.get(userId);
    if (!session || session.status !== 'ready') throw new Error('WA not connected');

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.gif': 'image/gif', '.mp4': 'video/mp4', '.pdf': 'application/pdf',
    };
    const mimetype = mimeMap[ext] || 'application/octet-stream';

    if (mimetype.startsWith('image/')) {
        await session.sock.sendMessage(waId, { image: buffer, caption: caption || '', mimetype });
    } else if (mimetype.startsWith('video/')) {
        await session.sock.sendMessage(waId, { video: buffer, caption: caption || '', mimetype });
    } else {
        await session.sock.sendMessage(waId, { document: buffer, caption: caption || '', mimetype, fileName: path.basename(filePath) });
    }
}

async function restoreSessions() {
    try {
        if (!fs.existsSync(SESSIONS_DIR)) return;
        const folders = fs.readdirSync(SESSIONS_DIR).filter(f =>
            f.startsWith('session-') && fs.statSync(path.join(SESSIONS_DIR, f)).isDirectory()
        );
        for (let i = 0; i < folders.length; i++) {
            const userId = folders[i].replace('session-', '');
            console.log(`🔄 Restoring WA session for: ${userId}`);
            if (i > 0) await new Promise(r => setTimeout(r, 5000)); // small delay between sessions
            await createSession(userId);
        }
    } catch (err) {
        console.error('Session restore error:', err.message);
    }
}

module.exports = {
    createSession,
    disconnect,
    sendMessage,
    sendMedia,
    getStatus,
    getActiveCount,
    setIO,
    restoreSessions,
    makeBotClient
};
