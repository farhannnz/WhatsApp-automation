const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Store uploads in backend/uploads/
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 16 * 1024 * 1024 }, // 16MB max
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|mp4|pdf|doc|docx/;
        const ok = allowed.test(file.mimetype) || allowed.test(path.extname(file.originalname).toLowerCase());
        cb(null, ok);
    }
});

// POST /api/media/upload
router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: `/api/media/file/${req.file.filename}`
    });
});

// GET /api/media/file/:filename — serve the file
router.get('/file/:filename', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.sendFile(filePath);
});

// DELETE /api/media/file/:filename
router.delete('/file/:filename', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    res.json({ success: true });
});

module.exports = router;
