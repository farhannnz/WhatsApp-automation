require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const waManager = require('./whatsapp/manager');

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Pass io to WA manager so it can emit QR/status events
waManager.setIO(io);

app.use(cors());
app.use(express.json());
app.use('/uploads', require('express').static(require('path').join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/flows', require('./routes/flows'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/bulk', require('./routes/bulk'));
app.use('/api/media', require('./routes/media'));
app.use('/api/ai-bots', require('./routes/aibot'));

app.get('/health', (_, res) => res.json({ ok: true }));

// Socket.io — each user joins their own room by userId
io.on('connection', (socket) => {
    socket.on('join', (userId) => {
        socket.join(userId);
        // Send current in-memory status immediately
        const status = waManager.getStatus(userId);
        socket.emit('wa:status', { status });
        console.log(`🔌 Socket joined: ${userId} | status: ${status}`);
    });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, async () => {
    console.log(`🚀 Backend running on port ${PORT}`);
    // Restore WA sessions for users who were previously connected
    await waManager.restoreSessions();
});
