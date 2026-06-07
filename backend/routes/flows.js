const express = require('express');
const { db } = require('../firebase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const C_FLOWS = 'wbp_flows';

router.get('/', async (req, res) => {
    try {
        const snap = await db.collection(C_FLOWS)
            .where('userId', '==', req.user.uid)
            .get();
        const flows = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        res.json(flows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const doc = await db.collection(C_FLOWS).doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Flow not found' });
        const flow = doc.data();
        if (flow.userId !== req.user.uid && req.user.role !== 'admin')
            return res.status(403).json({ error: 'Access denied' });
        res.json({ id: doc.id, ...flow });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, nodes, edges } = req.body;
        if (!name) return res.status(400).json({ error: 'Flow name required' });
        const ref = await db.collection(C_FLOWS).add({
            userId: req.user.uid,
            name,
            nodes: nodes || [],
            edges: edges || [],
            active: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        res.json({ id: ref.id, name, nodes: nodes || [], edges: edges || [], active: false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const doc = await db.collection(C_FLOWS).doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Flow not found' });
        if (doc.data().userId !== req.user.uid && req.user.role !== 'admin')
            return res.status(403).json({ error: 'Access denied' });
        const { name, nodes, edges, sheetUrl } = req.body;
        const updates = { updatedAt: new Date().toISOString() };
        if (name !== undefined) updates.name = name;
        if (nodes !== undefined) updates.nodes = nodes;
        if (edges !== undefined) updates.edges = edges;
        if (sheetUrl !== undefined) updates.sheetUrl = sheetUrl;
        await db.collection(C_FLOWS).doc(req.params.id).update(updates);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/:id/activate', async (req, res) => {
    try {
        const doc = await db.collection(C_FLOWS).doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Flow not found' });
        if (doc.data().userId !== req.user.uid)
            return res.status(403).json({ error: 'Access denied' });
        // Get all user flows, deactivate all, then activate target — no compound query needed
        const allFlows = await db.collection(C_FLOWS)
            .where('userId', '==', req.user.uid).get();
        const batch = db.batch();
        allFlows.docs.forEach(d => batch.update(d.ref, { active: false }));
        batch.update(db.collection(C_FLOWS).doc(req.params.id), { active: true });
        await batch.commit();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/flows/:id/deactivate
router.patch('/:id/deactivate', async (req, res) => {
    try {
        const doc = await db.collection(C_FLOWS).doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Flow not found' });
        if (doc.data().userId !== req.user.uid)
            return res.status(403).json({ error: 'Access denied' });
        await db.collection(C_FLOWS).doc(req.params.id).update({ active: false });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const doc = await db.collection(C_FLOWS).doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Flow not found' });
        if (doc.data().userId !== req.user.uid && req.user.role !== 'admin')
            return res.status(403).json({ error: 'Access denied' });
        await db.collection(C_FLOWS).doc(req.params.id).delete();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
