const express = require('express');
const { db } = require('../firebase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const C = 'wbp_ai_leads';

// GET all AI leads for the user (with optional botId filter)
router.get('/', async (req, res) => {
    try {
        let query = db.collection(C).where('userId', '==', req.user.uid);
        if (req.query.botId) query = query.where('botId', '==', req.query.botId);
        const snap = await query.orderBy('updatedAt', 'desc').get();
        res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET stats for AI leads
router.get('/stats', async (req, res) => {
    try {
        const snap = await db.collection(C).where('userId', '==', req.user.uid).get();
        const leads = snap.docs.map(d => d.data());

        const byClassification = {};
        const byBot = {};
        const byDay = {};

        leads.forEach(l => {
            // classification counts
            const cls = l.classification || 'unclassified';
            byClassification[cls] = (byClassification[cls] || 0) + 1;

            // by bot
            const bot = l.botName || l.botId || 'Unknown';
            byBot[bot] = (byBot[bot] || 0) + 1;

            // by day (last 7 days)
            if (l.updatedAt) {
                const day = new Date(l.updatedAt).toLocaleDateString('en-IN', { weekday: 'short' });
                byDay[day] = (byDay[day] || 0) + 1;
            }
        });

        res.json({
            total: leads.length,
            byClassification,
            byBot,
            byDay,
            completionRate: leads.length
                ? Math.round((leads.filter(l => l.classification === 'hot' || l.classification === 'warm').length / leads.length) * 100)
                : 0
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE a lead
router.delete('/:id', async (req, res) => {
    try {
        const doc = await db.collection(C).doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Not found' });
        if (doc.data().userId !== req.user.uid) return res.status(403).json({ error: 'Access denied' });
        await db.collection(C).doc(req.params.id).delete();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
