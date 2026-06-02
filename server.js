const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');
const axios = require('axios');

// ── Firebase Setup ────────────────────────────────────────
const serviceAccount = require('./fake-1582b-firebase-adminsdk-fbsvc-daa323e3c1.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://fake-1582b-default-rtdb.firebaseio.com'
});

const db = admin.database();

// ── Google Sheet Config ───────────────────────────────────
// Sheet ID from your shared link
const SHEET_ID = '1PRSwurGgeagmxQFcBLzlXT7yCmRoKkaZXlKln9_ttY0';
const SHEET_NAME = 'FB Leads';
// Public CSV export URL
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

// Column indexes (0-based)
const COL_NAME = 6;    // Column G
const COL_PHONE = 7;   // Column H
const COL_STATUS = 22; // Column W

// ── WhatsApp Client ───────────────────────────────────────
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'server' }),
    puppeteer: {
        headless: true,
        protocolTimeout: 120000,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run'
        ]
    }
});

client.on('qr', qr => {
    console.log('📱 Scan QR to login (server.js):');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ BTF Sender Bot ready!');
    // Start polling after WhatsApp is ready
    startPolling();
});

client.on('auth_failure', () => console.error('❌ Auth failed'));
client.on('disconnected', () => console.log('⚠️ WhatsApp disconnected'));

// ── Message Templates ─────────────────────────────────────
function getWelcomeMsg(name) {
    return `🥊 *Welcome to BTF - Box To Fit!*

Hi ${name || 'there'}! Thank you for connecting with us 🙏

We're thrilled to have you here! BTF is where science meets strength — founded by Amit, a New Zealand-based athlete and professional boxer.

🔥 *What we offer:*
• Boxing (Fitness & Competitive)
• Weight Loss & Fat Burning
• Strength Training & CrossFit
• Personal Training & Nutrition

📍 *Our Locations:*
• BTF Chandigarh — Sector 22B
• BTF New Chandigarh — Omaxe, PR-4

🌐 *Website:* https://boxtofit.in
📸 *BTF Chandigarh:* https://www.instagram.com/btf.chd/
📸 *BTF New Chandigarh:* https://www.instagram.com/btf.newchd/

Follow us for daily training tips, transformations & more! 💪

Reply *HI* to know more or book a FREE trial class 🎯`;
}

function getWarmLeadMsg(name) {
    return `🔥 *Hey ${name || 'there'}! BTF here.*

We noticed you're interested in joining us — and honestly, you're so close to making a great decision! 💪

*Here's what's waiting for you at BTF:*
✅ Expert coaching by Amit (NZ-based professional boxer)
✅ Science-based training programs
✅ Real results — fat loss, strength, stamina
✅ Friendly community that pushes you forward

🎯 *Special for you — FREE Trial Class!*
Come experience BTF firsthand before committing anything.

📞 Book now: +91 77195-60422
🌐 https://boxtofit.in
📸 https://www.instagram.com/btf.chd/
📸 https://www.instagram.com/btf.newchd/

Don't wait — your stronger self is just one session away! 🥊`;
}

function getHotLeadMsg(name) {
    return `🚀 *${name || 'Hey'}! You're almost in — BTF is ready for you!*

You've shown serious interest and we LOVE that energy! 🔥

*Let's lock in your spot RIGHT NOW:*

🎯 FREE Trial Class — no cost, no commitment
� Avaislable slots: Mon-Sat, 6 AM - 5 PM
📍 Choose your branch:
   • BTF Chandigarh — Sector 22B
   • BTF New Chandigarh — Omaxe, PR-4

📞 *Call/WhatsApp to book instantly:*
+91 77195-60422

🌐 https://boxtofit.in
📸 https://www.instagram.com/btf.chd/
📸 https://www.instagram.com/btf.newchd/

*"The only bad workout is the one that didn't happen."*
Let's make yours happen TODAY! 💪🥊`;
}

function getColdLeadMsg(name) {
    return `👋 *Hey ${name || 'there'}, BTF checking in!*

We know life gets busy — no worries at all! 😊

Just a gentle reminder that BTF is always here whenever you're ready to start your fitness journey.

💡 *Why people love BTF:*
• Boxing burns 800+ calories per session
• All levels welcome — beginner to advanced
• Flexible timings: 6 AM - 9 PM
• Expert coaches, premium equipment

🎁 Your *FREE trial class* offer is still open!

� +91 77/195-60422
🌐 https://boxtofit.in
📸 https://www.instagram.com/btf.chd/
📸 https://www.instagram.com/btf.newchd/

No pressure — just know we're here when you're ready 🙏💪`;
}

// ── Parse CSV ─────────────────────────────────────────────
function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    const rows = [];
    for (let i = 1; i < lines.length; i++) { // skip header row
        const cols = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || [];
        const cleaned = cols.map(c => c.replace(/^"|"$/g, '').trim());
        rows.push(cleaned);
    }
    return rows;
}

function getRowKey(row) {
    let phone = (row[COL_PHONE] || '').replace(/[^\d]/g, '');
    if (phone.startsWith('0')) phone = '91' + phone.slice(1);
    if (phone.length === 10) phone = '91' + phone;
    return phone || null;
}

function formatPhone(raw) {
    if (!raw) return null;
    // Remove any non-digit characters including 'p:' prefix from sheets
    let phone = raw.replace(/[^\d]/g, '');
    if (phone.startsWith('0')) phone = '91' + phone.slice(1);
    if (phone.length === 10) phone = '91' + phone;
    if (phone.length < 10) return null;
    return phone + '@c.us';
}

// ── Send WhatsApp Message ─────────────────────────────────
async function sendMsg(phone, msg, label) {
    const waId = formatPhone(phone);
    if (!waId) {
        console.log(`⚠️ Invalid phone: ${phone}`);
        return;
    }
    try {
        await client.sendMessage(waId, msg);
        console.log(`✅ [${label}] Sent to ${phone}`);
    } catch (err) {
        console.error(`❌ Failed to send to ${phone}:`, err.message);
    }
}

// ── Main Polling Logic ────────────────────────────────────
async function pollSheet() {
    console.log(`🔄 Polling sheet... ${new Date().toLocaleTimeString('en-IN')}`);
    try {
        const res = await axios.get(SHEET_URL);
        const rows = parseCSV(res.data);

        const savedRef = db.ref('fb_leads');
        const snapshot = await savedRef.once('value');
        const savedData = snapshot.val() || {};



        const newSavedData = {};
        const updates = {};

        for (const row of rows) {
            const key = getRowKey(row);
            if (!key || key === '_') continue;

            const phone = (row[COL_PHONE] || '').replace(/[^\d]/g, ''); // strip p: prefix
            const name = row[COL_NAME] || row[0] || '';
            const status = (row[COL_STATUS] || '').toLowerCase().trim();

            newSavedData[key] = { phone, name, status, row: row.join(',') };

            const existing = savedData[key];

            // NEW ROW — send welcome message
            if (!existing) {
                console.log(`🆕 New lead: ${name} | ${phone}`);
                await sendMsg(phone, getWelcomeMsg(name), 'WELCOME');
                updates[key] = { phone, name, status, welcomeSent: true, statusMsgSent: status || null };
                continue;
            }

            // EXISTING ROW — check if status changed
            const prevStatus = (existing.status || '').toLowerCase().trim();
            const statusChanged = status && status !== prevStatus;
            const alreadySentForStatus = existing.statusMsgSent === status;

            if (statusChanged && !alreadySentForStatus) {
                console.log(`📊 Status update: ${name} | ${phone} | ${prevStatus} → ${status}`);

                let msg = null;
                if (status.includes('warm')) msg = getWarmLeadMsg(name);
                else if (status.includes('hot')) msg = getHotLeadMsg(name);
                else if (status.includes('cold')) msg = getColdLeadMsg(name);

                if (msg) {
                    await sendMsg(phone, msg, status.toUpperCase());
                    updates[key] = { ...existing, status, statusMsgSent: status };
                }
            }
        }

        // Save new snapshot to Firebase (keep only current + previous)
        const prevRef = db.ref('fb_leads_prev');
        await prevRef.set(savedData);         // move current → previous
        await savedRef.set({
            ...savedData, ...updates, ...Object.fromEntries( // merge updates
                Object.entries(newSavedData).filter(([k]) => !savedData[k] && !updates[k])
            )
        });

        console.log(`✅ Firebase updated. Total rows: ${rows.length}`);

    } catch (err) {
        console.error('❌ Poll error:', err.message);
    }
}

function startPolling() {
    pollSheet(); // run immediately on start
    setInterval(pollSheet, 10 * 60 * 1000); // every 10 minutes
}

// ── Start ─────────────────────────────────────────────────
client.initialize();
