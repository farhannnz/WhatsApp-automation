const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const waManager = require('../whatsapp/manager');
const { db } = require('../firebase');

const router = express.Router();
router.use(authMiddleware);

// POST /api/whatsapp/connect — start WA session, emits QR via socket
router.post('/connect', async (req, res) => {
    try {
        const { uid } = req.user;
        await waManager.createSession(uid);
        res.json({ success: true, message: 'Session starting, watch for QR event' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/whatsapp/disconnect
router.post('/disconnect', async (req, res) => {
    try {
        await waManager.disconnect(req.user.uid);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/whatsapp/status
router.get('/status', async (req, res) => {
    const { uid } = req.user;
    let status = waManager.getStatus(uid);
    // If in-memory says disconnected, check RTDB (session may have restored under different timing)
    if (status === 'disconnected' || status === 'initializing') {
        try {
            const { rtdb } = require('../firebase');
            const snap = await rtdb.ref(`wbp_waStatus/${uid}`).once('value');
            const rtdbStatus = snap.val()?.status;
            if (rtdbStatus === 'ready') status = 'ready';
        } catch {}
    }
    res.json({ status });
});

// GET /api/whatsapp/leads
router.get('/leads', async (req, res) => {
    try {
        const snap = await db.collection('wbp_leads')
            .where('userId', '==', req.user.uid)
            .get();
        const leads = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        res.json(leads);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
