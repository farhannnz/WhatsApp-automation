const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../firebase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const C_USERS = 'wbp_users';

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ error: 'Username and password required' });

        const snap = await db.collection(C_USERS)
            .where('username', '==', username.toLowerCase())
            .limit(1).get();

        if (snap.empty)
            return res.status(401).json({ error: 'Invalid credentials' });

        const userDoc = snap.docs[0];
        const user = userDoc.data();

        if (!user.active)
            return res.status(403).json({ error: 'Account disabled. Contact admin.' });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid)
            return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
            { uid: userDoc.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: { uid: userDoc.id, username: user.username, role: user.role, displayName: user.displayName }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const doc = await db.collection(C_USERS).doc(req.user.uid).get();
        if (!doc.exists) return res.status(404).json({ error: 'User not found' });
        const u = doc.data();
        res.json({ uid: doc.id, username: u.username, role: u.role, displayName: u.displayName, active: u.active });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
