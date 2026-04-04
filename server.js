const express = require('express');
const cors    = require('cors');
const path    = require('path');
const crypto  = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;

// Admin credentials — server-side only, never sent to client
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || '30cent0@proton.me';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'HEISENBERG67l+';

// Active admin session tokens
const adminSessions = new Set();

// SSE: all connected clients
const sseClients = new Set();

function pushToAll(eventName, data) {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) {
        try { res.write(payload); } catch (_) {}
    }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// In-memory storage
let votesData = { Eliman: 0, Isreal: 0, Marwan: 0, Suraj: 0 };
let usersData = {};
let loggedInUsers = new Set();

// ── SSE endpoint ──────────────────────────────────────────────────────────────
app.get('/api/stream', (req, res) => {
    res.set({
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
        'X-Accel-Buffering': 'no'   // disable nginx buffering if proxied
    });
    res.flushHeaders();

    // Send current state immediately on connect
    res.write(`event: init\ndata: ${JSON.stringify({ votes: votesData, users: usersData })}\n\n`);

    sseClients.add(res);

    // Heartbeat every 25 s to keep connection alive through proxies
    const hb = setInterval(() => {
        try { res.write(': heartbeat\n\n'); } catch (_) {}
    }, 25000);

    req.on('close', () => {
        clearInterval(hb);
        sseClients.delete(res);
    });
});

// ── Voting API ────────────────────────────────────────────────────────────────
app.get('/api/votes', (req, res) => res.json(votesData));

app.post('/api/votes', (req, res) => {
    const { candidate, username } = req.body;
    if (!username)
        return res.status(400).json({ error: 'Username required' });
    if (votesData[candidate] === undefined)
        return res.status(400).json({ error: 'Invalid candidate' });
    if (usersData[username]?.vote)
        return res.status(400).json({ error: 'User has already voted' });

    votesData[candidate]++;
    usersData[username] = usersData[username] || {};
    usersData[username].vote      = candidate;
    usersData[username].timestamp = new Date().toISOString();

    // Push to every connected session immediately
    pushToAll('votes-updated', { votes: votesData, users: usersData });

    res.json({ success: true, votes: votesData, users: usersData });
});

app.get('/api/users', (req, res) => res.json(usersData));

app.post('/api/login', (req, res) => {
    const { username } = req.body;
    if (!username)
        return res.status(400).json({ error: 'Username required' });
    loggedInUsers.add(username);
    res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
    const totalRegistered = Object.keys(usersData).length;
    const votedCount      = Object.values(usersData).filter(u => u.vote).length;
    const loginPercentage = totalRegistered === 0
        ? 0
        : Math.round((votedCount / totalRegistered) * 100);
    res.json({ loggedInCount: totalRegistered, votedCount, loginPercentage });
});

app.post('/api/reset', requireAdmin, (req, res) => {
    votesData    = { Eliman: 0, Isreal: 0, Marwan: 0, Suraj: 0 };
    usersData    = {};
    loggedInUsers.clear();

    // Push reset to every connected session
    pushToAll('votes-updated', { votes: votesData, users: usersData });

    res.json({ success: true });
});

// ── Admin auth ────────────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
    if (
        email?.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
        password === ADMIN_PASSWORD
    ) {
        const token = crypto.randomBytes(32).toString('hex');
        adminSessions.add(token);
        return res.json({ success: true, token });
    }
    res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/admin/logout', (req, res) => {
    adminSessions.delete(req.headers['x-admin-token']);
    res.json({ success: true });
});

app.get('/api/admin/verify', requireAdmin, (req, res) => res.json({ valid: true }));

function requireAdmin(req, res, next) {
    const token = req.headers['x-admin-token'];
    if (token && adminSessions.has(token)) return next();
    res.status(403).json({ error: 'Forbidden' });
}

// ── HTML pages ────────────────────────────────────────────────────────────────
app.get('/',                (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/results',         (req, res) => res.sendFile(path.join(__dirname, 'results.html')));
app.get('/admin-login',     (req, res) => res.sendFile(path.join(__dirname, 'admin-login.html')));
app.get('/admin-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'admin-dashboard.html')));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));