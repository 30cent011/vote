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
    const { candidate, username } = req.body;
    if (votesData[candidate] !== undefined && username) {
        votesData[candidate]++;
        if (!usersData[username]) {
            usersData[username] = {};
        }
        usersData[username].vote = candidate;
        usersData[username].timestamp = new Date().toISOString();
        res.json({ success: true, votes: votesData, users: usersData });
    } else {
        res.status(400).json({ error: 'Invalid candidate or username' });
    }
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