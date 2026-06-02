const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../firebase');
const { adminMiddleware } = require('../middleware/auth');
const waManager = require('../whatsapp/manager');

const router = express.Router();
router.use(adminMiddleware);

// Collections — prefixed with wbp_ to avoid conflicts with other bots
const C_USERS = 'wbp_users';
const C_FLOWS = 'wbp_flows';
const C_LEADS = 'wbp_leads';

// GET /api/admin/users
router.get('/users', async (req, res) => {
    try {
        const snap = await db.collection(C_USERS).orderBy('createdAt', 'desc').get();
        const users = snap.docs.map(d => ({
            uid: d.id, ...d.data(),
            passwordHash: undefined,
            waStatus: waManager.getStatus(d.id)
        }));
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/users
router.post('/users', async (req, res) => {
    try {
        const { username, password, displayName } = req.body;
        if (!username || !password)
            return res.status(400).json({ error: 'Username and password required' });

        const existing = await db.collection(C_USERS)
            .where('username', '==', username.toLowerCase()).limit(1).get();
        if (!existing.empty)
            return res.status(409).json({ error: 'Username already exists' });

        const passwordHash = await bcrypt.hash(password, 10);
        const ref = await db.collection(C_USERS).add({
            username: username.toLowerCase(),
            displayName: displayName || username,
            passwordHash,
            role: 'user',
            active: true,
            createdAt: new Date().toISOString()
        });

        res.json({ uid: ref.id, username: username.toLowerCase(), displayName, active: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/admin/users/:uid
router.patch('/users/:uid', async (req, res) => {
    try {
        const { uid } = req.params;
        const updates = {};
        if (typeof req.body.active === 'boolean') updates.active = req.body.active;
        if (req.body.displayName) updates.displayName = req.body.displayName;
        if (req.body.password) updates.passwordHash = await bcrypt.hash(req.body.password, 10);

        await db.collection(C_USERS).doc(uid).update(updates);
        if (updates.active === false) await waManager.disconnect(uid);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/admin/users/:uid
router.delete('/users/:uid', async (req, res) => {
    try {
        const { uid } = req.params;
        await waManager.disconnect(uid);
        await db.collection(C_USERS).doc(uid).delete();
        const flows = await db.collection(C_FLOWS).where('userId', '==', uid).get();
        const batch = db.batch();
        flows.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/leads
router.get('/leads', async (req, res) => {
    try {
        const snap = await db.collection(C_LEADS).get();
        const leads = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        res.json(leads);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
    try {
        const [u, l, f] = await Promise.all([
            db.collection(C_USERS).get(),
            db.collection(C_LEADS).get(),
            db.collection(C_FLOWS).get()
        ]);
        res.json({
            totalUsers: u.size,
            totalLeads: l.size,
            totalFlows: f.size,
            activeConnections: waManager.getActiveCount()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
