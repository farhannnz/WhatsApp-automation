const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../firebase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const C = 'wbp_ai_bots';

// Multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'ai');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname.replace(/\s/g, '_')}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET all bots for user
router.get('/', async (req, res) => {
    try {
        const snap = await db.collection(C).where('userId', '==', req.user.uid).get();
        res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single bot
router.get('/:id', async (req, res) => {
    try {
        const doc = await db.collection(C).doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Not found' });
        if (doc.data().userId !== req.user.uid) return res.status(403).json({ error: 'Access denied' });
        res.json({ id: doc.id, ...doc.data() });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create bot
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name required' });
        const ref = await db.collection(C).add({
            userId: req.user.uid,
            name,
            active: false,
            geminiApiKey: '',
            systemPrompt: '',
            contextText: '',
            leadFields: ['name', 'phone'],
            sheetUrl: '',
            images: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        const doc = await ref.get();
        res.json({ id: ref.id, ...doc.data() });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update bot
router.put('/:id', async (req, res) => {
    try {
        const doc = await db.collection(C).doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Not found' });
        if (doc.data().userId !== req.user.uid) return res.status(403).json({ error: 'Access denied' });
        const { name, geminiApiKey, systemPrompt, contextText, leadFields, sheetUrl, active } = req.body;
        const updates = { updatedAt: new Date().toISOString() };
        if (name !== undefined) updates.name = name;
        if (geminiApiKey !== undefined) updates.geminiApiKey = geminiApiKey;
        if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt;
        if (contextText !== undefined) updates.contextText = contextText;
        if (leadFields !== undefined) updates.leadFields = leadFields;
        if (sheetUrl !== undefined) updates.sheetUrl = sheetUrl;
        if (active !== undefined) updates.active = active;
        await db.collection(C).doc(req.params.id).update(updates);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST upload image
router.post('/:id/images', upload.single('image'), async (req, res) => {
    try {
        const doc = await db.collection(C).doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Not found' });
        if (doc.data().userId !== req.user.uid) return res.status(403).json({ error: 'Access denied' });

        const { name, tags } = req.body;
        const filename = req.file.filename;
        const url = `/uploads/ai/${filename}`;
        const imgId = `img_${Date.now()}`;

        const images = doc.data().images || [];
        images.push({ id: imgId, name: name || filename, tags: tags || '', url, filename });

        await db.collection(C).doc(req.params.id).update({ images, updatedAt: new Date().toISOString() });
        res.json({ id: imgId, url, name, tags });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE image
router.delete('/:id/images/:imgId', async (req, res) => {
    try {
        const doc = await db.collection(C).doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Not found' });
        if (doc.data().userId !== req.user.uid) return res.status(403).json({ error: 'Access denied' });

        const images = (doc.data().images || []).filter(img => {
            if (img.id === req.params.imgId) {
                // Delete file
                try {
                    const filePath = path.join(__dirname, '..', 'uploads', 'ai', img.filename);
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } catch { }
                return false;
            }
            return true;
        });

        await db.collection(C).doc(req.params.id).update({ images });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE bot
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
