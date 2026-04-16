const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// In-memory storage (for testing)
let votesData = {
    'Eliman': 0,
    'Isreal': 0,
    'Marwan': 0,
    'Suraj': 0
};
let usersData = {};
let loggedInUsers = new Set();

// Admin and SSE clients storage
const adminSessions = new Map(); // token -> { email, timestamp }
const sseClients = new Set(); // connected SSE clients
const ADMIN_PASSWORD = 'admin123'; // Default admin password
const ADMIN_EMAIL = 'admin@vote.com'; // Default admin email

// Generate simple token
function generateToken() {
    return Math.random().toString(36).substr(2) + Date.now().toString(36);
}

// Broadcast vote updates to all connected SSE clients
function broadcastVoteUpdate() {
    const message = `data: ${JSON.stringify({ votes: votesData, users: usersData })}\n\n`;
    sseClients.forEach(client => {
        try {
            client.write(`event: votes-updated\n${message}`);
        } catch (e) {
            sseClients.delete(client);
        }
    });
}

// API endpoints
app.get('/api/votes', (req, res) => {
    res.json(votesData);
});

app.post('/api/votes', (req, res) => {
    const { candidate, username, weight = 1 } = req.body;
    if (!username || !candidate || votesData[candidate] === undefined) {
        return res.status(400).json({ error: 'Invalid candidate or username' });
    }

    if (!usersData[username]) {
        usersData[username] = {};
    }

    if (usersData[username].vote) {
        return res.status(409).json({ error: 'User has already voted' });
    }

    const voteWeight = Number(weight) || 1;
    votesData[candidate] += voteWeight;
    usersData[username].vote = candidate;
    usersData[username].weight = voteWeight;
    usersData[username].timestamp = new Date().toISOString();

    // Broadcast update to all SSE clients
    broadcastVoteUpdate();

    res.json({ success: true, votes: votesData, users: usersData });
});

app.get('/api/users', (req, res) => {
    res.json(usersData);
});

app.post('/api/login', (req, res) => {
    const { username } = req.body;
    if (username) {
        loggedInUsers.add(username);
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Username required' });
    }
});

app.get('/api/stats', (req, res) => {
    const totalUsers = Object.keys(usersData).length;
    const votedUsers = Object.values(usersData).filter(u => u.vote).length;
    const loggedInCount = loggedInUsers.size;
    const votePercentage = totalUsers > 0 ? Math.round((votedUsers / totalUsers) * 100) : 0;
    const loginPercentage = loggedInCount > 0 ? Math.round((votedUsers / loggedInCount) * 100) : 0;
    res.json({
        totalUsers,
        votedUsers,
        loggedInCount,
        votePercentage,
        loginPercentage,
        votes: votesData
    });
});

app.post('/api/reset', (req, res) => {
    // Check admin token
    const token = req.headers['x-admin-token'];
    if (!token || !adminSessions.has(token)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    votesData = {
        'Eliman': 0,
        'Isreal': 0,
        'Marwan': 0,
        'Suraj': 0
    };
    usersData = {};
    loggedInUsers.clear();

    // Broadcast update to all SSE clients
    broadcastVoteUpdate();

    res.json({ success: true });
});

// Admin endpoints
app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        const token = generateToken();
        adminSessions.set(token, { email, timestamp: Date.now() });
        res.json({ success: true, token });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.get('/api/admin/verify', (req, res) => {
    const token = req.headers['x-admin-token'];
    if (token && adminSessions.has(token)) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
});

app.post('/api/admin/logout', (req, res) => {
    const token = req.headers['x-admin-token'];
    if (token) {
        adminSessions.delete(token);
    }
    res.json({ success: true });
});

// Server-Sent Events (SSE) endpoint for real-time vote updates
app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial data
    res.write(`event: init\ndata: ${JSON.stringify({ votes: votesData, users: usersData })}\n\n`);

    // Add client to set
    sseClients.add(res);

    // Handle client disconnect
    req.on('close', () => {
        sseClients.delete(res);
        res.end();
    });
});

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/results', (req, res) => {
    res.sendFile(path.join(__dirname, 'results.html'));
});

app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-login.html'));
});

app.get('/admin-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});