const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { db, rtdb } = require('../firebase');
const waManager = require('../whatsapp/manager');

const router = express.Router();
router.use(authMiddleware);

// Helper: normalize phone number — handles Excel scientific notation, spaces, dashes etc.
function normalizePhone(raw) {
    if (!raw) return null;
    let str = String(raw).trim();

    // Handle Excel scientific notation e.g. 9.19876E+11
    if (str.includes('E+') || str.includes('e+')) {
        try {
            str = String(Math.round(Number(str)));
        } catch { }
    }

    // Remove WhatsApp suffixes and non-digit chars
    str = str.replace(/@c\.us|@lid|@s\.whatsapp\.net/g, '');
    let digits = str.replace(/\D/g, '');
    if (!digits) return null;

    // Remove leading zeros
    digits = digits.replace(/^0+/, '');

    if (digits.length === 10) digits = '91' + digits; // Indian default
    if (digits.length < 10) return null;

    return digits + '@c.us';
}

// Helper: replace {{variables}} in message
function renderMessage(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
}

// POST /api/bulk/send
// Body: { contacts: [{phone, ...fields}], message: string, jobId: string }
router.post('/send', async (req, res) => {
    try {
        const { contacts, message, jobId, delaySeconds, mediaFilename } = req.body;
        const userId = req.user.uid;

        if (!contacts?.length) return res.status(400).json({ error: 'No contacts provided' });
        if (!message) return res.status(400).json({ error: 'Message required' });

        const status = waManager.getStatus(userId);
        if (status !== 'ready') {
            // Check RTDB as fallback — in-memory may be stale
            const { rtdb } = require('../firebase');
            const snap = await rtdb.ref(`wbp_waStatus/${userId}`).once('value');
            const rtdbStatus = snap.val()?.status;
            if (rtdbStatus !== 'ready') {
                return res.status(400).json({
                    error: `WhatsApp not connected (status: ${rtdbStatus || status}). Please connect from Dashboard.`
                });
            }
        }

        const id = jobId || `bulk_${Date.now()}`;

        // Save job to RTDB for progress tracking
        await rtdb.ref(`wbp_bulk/${userId}/${id}`).set({
            total: contacts.length,
            sent: 0,
            failed: 0,
            status: 'running',
            delaySeconds: delaySeconds || 15,
            createdAt: Date.now()
        });

        res.json({ success: true, jobId: id, total: contacts.length });

        // Process in background with delay
        processBulk(userId, id, contacts, message, delaySeconds || 15, mediaFilename);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

async function processBulk(userId, jobId, contacts, message, delaySeconds = 15, mediaFilename = null) {
    let sent = 0, failed = 0;
    const ref = rtdb.ref(`wbp_bulk/${userId}/${jobId}`);
    // Enforce minimum 10 seconds
    const delayMs = Math.min(300, Math.max(10, delaySeconds)) * 1000;

    for (const contact of contacts) {
        const rawPhone = contact.phone || contact.Phone || contact.PHONE ||
            contact.number || contact.Number || contact.NUMBER ||
            contact.mobile || contact.Mobile || contact.MOBILE ||
            Object.values(contact)[0];
        const waId = normalizePhone(rawPhone);
        console.log(`📞 Processing: raw="${rawPhone}" → waId="${waId}"`);
        if (!waId) {
            console.log(`⚠️ Invalid phone skipped: ${rawPhone}`);
            failed++;
            continue;
        }

        try {
            const text = renderMessage(message, contact);
            if (mediaFilename) {
                const filePath = require('path').join(__dirname, '..', 'uploads', mediaFilename);
                await waManager.sendMedia(userId, waId, filePath, text);
            } else {
                await waManager.sendMessage(userId, waId, text);
            }
            sent++;
            console.log(`✅ Bulk sent to ${waId}`);
        } catch (err) {
            console.error(`❌ Bulk failed for ${waId}:`, err.message);
            failed++;
        }

        await ref.update({ sent, failed });
        // Wait the configured delay between messages
        await new Promise(r => setTimeout(r, delayMs));
    }

    await ref.update({ status: 'done', sent, failed });
}

// GET /api/bulk/jobs — list bulk jobs for user
router.get('/jobs', async (req, res) => {
    try {
        const snap = await rtdb.ref(`wbp_bulk/${req.user.uid}`).once('value');
        const data = snap.val() || {};
        const jobs = Object.entries(data)
            .map(([id, v]) => ({ id, ...v }))
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 20);
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/bulk/leads — get leads filtered by flowId and date range
router.get('/leads', async (req, res) => {
    try {
        const { flowId, from, to, before, after } = req.query;
        const userId = req.user.uid;

        let snap;
        if (flowId) {
            snap = await db.collection('wbp_leads').where('userId', '==', userId).where('flowId', '==', flowId).get();
        } else {
            snap = await db.collection('wbp_leads').where('userId', '==', userId).get();
        }

        let leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Date filtering
        if (from) leads = leads.filter(l => (l.updatedAt || '') >= from);
        if (to) leads = leads.filter(l => (l.updatedAt || '') <= to + 'T23:59:59');
        if (before) leads = leads.filter(l => (l.updatedAt || '') < before);
        if (after) leads = leads.filter(l => (l.updatedAt || '') > after);

        res.json(leads);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
