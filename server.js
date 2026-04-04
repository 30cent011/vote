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
    votesData = {
        'Eliman': 0,
        'Isreal': 0,
        'Marwan': 0,
        'Suraj': 0
    };
    usersData = {};
    loggedInUsers.clear();
    res.json({ success: true });
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