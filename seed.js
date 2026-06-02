// Run this ONCE before starting server.js
// Fetches existing sheet data and stores in Firebase — no messages sent
const admin = require('firebase-admin');
const axios = require('axios');

const serviceAccount = require('./fake-1582b-firebase-adminsdk-fbsvc-daa323e3c1.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://fake-1582b-default-rtdb.firebaseio.com'
});

const db = admin.database();

const SHEET_ID = '1PRSwurGgeagmxQFcBLzlXT7yCmRoKkaZXlKln9_ttY0';
const SHEET_NAME = 'FB Leads';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

const COL_NAME = 6;
const COL_PHONE = 7;
const COL_STATUS = 22;

function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || [];
        const cleaned = cols.map(c => c.replace(/^"|"$/g, '').trim());
        rows.push(cleaned);
    }
    return rows;
}

async function seed() {
    console.log('🌱 Seeding Firebase with existing sheet data...');
    const res = await axios.get(SHEET_URL);
    const rows = parseCSV(res.data);

    const data = {};
    for (const row of rows) {
        let phone = (row[COL_PHONE] || '').replace(/[^\d]/g, ''); // strip p: and non-digits
        if (phone.startsWith('0')) phone = '91' + phone.slice(1);
        if (phone.length === 10) phone = '91' + phone;
        const name = row[COL_NAME] || row[0] || '';
        const status = (row[COL_STATUS] || '').toLowerCase().trim();
        const key = phone || null;
        if (!key) continue;
        data[key] = { phone, name, status, welcomeSent: true, statusMsgSent: status || null };
    }

    await db.ref('fb_leads').set(data);
    console.log(`✅ Done! ${Object.keys(data).length} rows stored in Firebase. No messages sent.`);
    process.exit(0);
}

seed().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
