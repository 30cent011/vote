const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_MARKET = 'unit6';

const markets = {
    unit6: {
        id: 'unit6',
        title: 'Who will fumble Unit 6?',
        description: 'Vote on the first fumble from Unit 6 in this live prediction market.',
        participants: ['Unit 6', 'Unit 7', 'Big Daniel', 'Spectator']
    },
    unit7: {
        id: 'unit7',
        title: 'Who will fumble Unit 7?',
        description: 'Choose which Unit 7 player will drop the ball first.',
        participants: ['Unit 7', 'Unit 6', 'Big Daniel', 'Spectator']
    },
    'unit6-vs-7': {
        id: 'unit6-vs-7',
        title: 'Which will fumble first: Unit 6 or Unit 7?',
        description: 'A direct market on whether Unit 6 or Unit 7 slips up first.',
        participants: ['Unit 6', 'Unit 7']
    },
    dumbest: {
        id: 'dumbest',
        title: 'Who is the dumbest?',
        description: 'Market-style ranking for the person with the weakest play.',
        participants: ['Eliman', 'Isreal', 'Marwan', 'Suraj']
    },
    'big-daniel': {
        id: 'big-daniel',
        title: 'Who will get touched by Big Daniel first?',
        description: 'Place a prediction on the first person to feel Big Daniel’s reach.',
        participants: ['Big Daniel', 'Unit 6', 'Unit 7', 'Marwan']
    }
};

const marketVotes = {};
const usersData = {};
const loggedInUsers = new Set();
const streamClients = {};

for (const marketId of Object.keys(markets)) {
    marketVotes[marketId] = {};
    streamClients[marketId] = new Set();
    markets[marketId].participants.forEach(candidate => {
        marketVotes[marketId][candidate] = 0;
    });
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

function getMarketIdParam(req) {
    return req.params.marketId || DEFAULT_MARKET;
}

function getMarket(marketId) {
    return markets[marketId] || markets[DEFAULT_MARKET];
}

function sendMarketUpdate(marketId) {
    const clients = streamClients[marketId];
    if (!clients || clients.size === 0) return;
    const payload = JSON.stringify({ marketId, votes: marketVotes[marketId] });
    for (const res of clients) {
        res.write(`event: votes-updated\n`);
        res.write(`data: ${payload}\n\n`);
    }
}

app.get('/api/markets', (req, res) => {
    res.json({ markets: Object.values(markets) });
});

app.get('/api/market/:marketId/votes', (req, res) => {
    const marketId = getMarketIdParam(req);
    const market = getMarket(marketId);
    res.json(marketVotes[market.id]);
});

app.get('/api/votes', (req, res) => {
    res.json(marketVotes[DEFAULT_MARKET]);
});

function handleMarketVote(req, res) {
    const marketId = getMarketIdParam(req);
    const market = getMarket(marketId);
    const { candidate, username, weight = 1 } = req.body;
    const validCandidate = market.participants.includes(candidate);

    if (!username || !candidate || !validCandidate) {
        return res.status(400).json({ error: 'Invalid candidate, username, or market.' });
    }

    if (!usersData[username]) {
        usersData[username] = {};
    }

    if (usersData[username][market.id]) {
        return res.status(409).json({ error: 'User has already voted in this market.' });
    }

    const voteWeight = Number(weight) || 1;
    marketVotes[market.id][candidate] += voteWeight;
    usersData[username][market.id] = {
        vote: candidate,
        weight: voteWeight,
        timestamp: new Date().toISOString()
    };

    sendMarketUpdate(market.id);
    res.json({ success: true, votes: marketVotes[market.id], users: usersData });
}

app.post('/api/market/:marketId/votes', handleMarketVote);
app.post('/api/votes', (req, res) => {
    req.params.marketId = DEFAULT_MARKET;
    handleMarketVote(req, res);
});

function handleMarketStream(req, res) {
    const marketId = getMarketIdParam(req);
    const market = getMarket(marketId);

    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
    });
    res.flushHeaders();

    const client = res;
    streamClients[market.id].add(client);

    client.write(`event: init\n`);
    client.write(`data: ${JSON.stringify({ marketId: market.id, votes: marketVotes[market.id] })}\n\n`);

    req.on('close', () => {
        streamClients[market.id].delete(client);
    });
}

app.get('/api/market/:marketId/stream', handleMarketStream);
app.get('/api/stream', (req, res) => {
    req.params.marketId = DEFAULT_MARKET;
    handleMarketStream(req, res);
});

function handleMarketStats(req, res) {
    const marketId = getMarketIdParam(req);
    const market = getMarket(marketId);
    const totalUsers = Object.keys(usersData).length;
    const votedUsers = Object.values(usersData).filter(user => user[market.id]).length;
    const loggedInCount = loggedInUsers.size;
    const votePercentage = totalUsers > 0 ? Math.round((votedUsers / totalUsers) * 100) : 0;
    const loginPercentage = loggedInCount > 0 ? Math.round((votedUsers / loggedInCount) * 100) : 0;

    res.json({
        totalUsers,
        votedUsers,
        loggedInCount,
        votePercentage,
        loginPercentage,
        votes: marketVotes[market.id]
    });
}

app.get('/api/market/:marketId/stats', handleMarketStats);
app.get('/api/stats', (req, res) => {
    req.params.marketId = DEFAULT_MARKET;
    handleMarketStats(req, res);
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
    for (const marketId of Object.keys(markets)) {
        markets[marketId].participants.forEach(candidate => {
            marketVotes[marketId][candidate] = 0;
        });
    }
    for (const username of Object.keys(usersData)) {
        usersData[username] = {};
    }
    loggedInUsers.clear();
    Object.values(streamClients).forEach(clientSet => clientSet.forEach(res => {
        res.write(`event: votes-updated\n`);
        res.write(`data: ${JSON.stringify({ marketId: DEFAULT_MARKET, votes: marketVotes[DEFAULT_MARKET] })}\n\n`);
    }));
    res.json({ success: true });
});

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
