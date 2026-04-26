const USERNAME_KEY = 'voteUsername';
const MARKET_QUERY_KEY = 'market';
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
        description: 'Place a prediction on the first person to feel Big Daniel�s reach.',
        participants: ['Big Daniel', 'Unit 6', 'Unit 7', 'Marwan']
    }
};

const participantAvatars = {
    Eliman: 'image/eliman.jpg',
    Isreal: 'image/isreal.jpg',
    Marwan: 'image/marwan.webp',
    Suraj: 'image/suraj.jpg',
    'Unit 6': 'image/unit6.svg',
    'Unit 7': 'image/unit7.svg',
    'Big Daniel': 'image/big-daniel.svg',
    Spectator: 'image/spectator.svg'
};

let selectedCandidate = null;
let chartInstance = null;
let serverVotes = null;
let isSyncOnline = false;
let eventSource = null;

function getMarketId() {
    const query = new URLSearchParams(window.location.search);
    return query.get(MARKET_QUERY_KEY) || DEFAULT_MARKET;
}

function getMarketConfig() {
    const marketId = getMarketId();
    return markets[marketId] || markets[DEFAULT_MARKET];
}

const marketConfig = getMarketConfig();
const participants = marketConfig.participants;

function loadUsername() {
    return localStorage.getItem(USERNAME_KEY) || '';
}

function saveUsername(username) {
    localStorage.setItem(USERNAME_KEY, username);
}

function clearUsername() {
    localStorage.removeItem(USERNAME_KEY);
}

function loadVotes() {
    const votes = {};
    participants.forEach(name => {
        votes[name] = parseInt(localStorage.getItem(`${marketConfig.id}_${name}`) || '0', 10);
    });
    return votes;
}

function saveVotes(votes) {
    for (const [name, count] of Object.entries(votes)) {
        localStorage.setItem(`${marketConfig.id}_${name}`, count);
    }
}

function getCurrentVotes() {
    return serverVotes || loadVotes();
}

function getUserVote(username) {
    return localStorage.getItem(`voteCast_${marketConfig.id}_${username}`) || '';
}

function setUserVote(username, candidate) {
    localStorage.setItem(`voteCast_${marketConfig.id}_${username}`, candidate);
}

function clearUserVote(username) {
    localStorage.removeItem(`voteCast_${marketConfig.id}_${username}`);
}

function hasUserVoted(username) {
    return Boolean(getUserVote(username));
}

function getTotalVotes(votes) {
    return Object.values(votes).reduce((sum, count) => sum + count, 0);
}

function getTopChoice(votes) {
    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    return sorted[0] || ['None', 0];
}

function getDeadline() {
    const key = `${marketConfig.id}_deadline`;
    let stored = localStorage.getItem(key);
    if (!stored) {
        const deadline = Date.now() + 30 * 24 * 60 * 60 * 1000;
        localStorage.setItem(key, `${deadline}`);
        return deadline;
    }
    return Number(stored);
}

function formatRemaining(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function updateCountdown() {
    const timer = document.getElementById('countdown-timer');
    const submitButton = document.getElementById('submit-vote');
    const remaining = getDeadline() - Date.now();
    const username = loadUsername();
    const disabledForUser = !username || hasUserVoted(username);

    if (remaining <= 0) {
        timer.textContent = 'Voting closed';
        submitButton.disabled = true;
        submitButton.classList.add('disabled');
        return;
    }

    timer.textContent = formatRemaining(remaining);
    if (disabledForUser) {
        submitButton.disabled = true;
        submitButton.classList.add('disabled');
    } else {
        submitButton.disabled = false;
        submitButton.classList.remove('disabled');
    }
}

function updateSyncStatus() {
    const status = document.getElementById('sync-status');
    if (!status) return;
    if (isSyncOnline) {
        status.textContent = 'Live vote sync is active.';
        status.classList.remove('offline');
    } else {
        status.textContent = 'Offline mode: votes are shown locally until server reconnects.';
        status.classList.add('offline');
    }
}

function updateUserUI() {
    const username = loadUsername();
    const userStatus = document.getElementById('user-status');
    const form = document.getElementById('registration-form');
    const logoutButton = document.getElementById('logout-button');
    const voteStatus = document.getElementById('vote-status');
    const submitButton = document.getElementById('submit-vote');

    if (username) {
        const votedFor = getUserVote(username);
        userStatus.textContent = `Voting as ${username}`;
        form.classList.add('hidden');
        logoutButton.classList.remove('hidden');

        if (votedFor) {
            voteStatus.textContent = `You already voted for ${votedFor}.`;
            submitButton.disabled = true;
            submitButton.classList.add('disabled');
        } else {
            voteStatus.textContent = selectedCandidate ? `Ready to vote as ${username}.` : `Select a candidate to vote as ${username}.`;
            submitButton.disabled = false;
            submitButton.classList.remove('disabled');
        }
    } else {
        userStatus.textContent = 'Not registered yet';
        form.classList.remove('hidden');
        logoutButton.classList.add('hidden');
        voteStatus.textContent = 'Register to start voting.';
        submitButton.disabled = true;
        submitButton.classList.add('disabled');
    }
}

async function postLoginToServer(username) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

async function fetchServerVotes() {
    try {
        const response = await fetch(`/api/market/${marketConfig.id}/votes`);
        if (!response.ok) throw new Error('Unable to fetch votes');
        return await response.json();
    } catch (error) {
        console.warn('Vote sync failed:', error);
        return null;
    }
}

async function postVoteToServer(candidate, username, weight) {
    try {
        const response = await fetch(`/api/market/${marketConfig.id}/votes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidate, username, weight })
        });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || 'Server rejected vote');
        }
        return await response.json();
    } catch (error) {
        console.warn('Vote submission failed:', error);
        return null;
    }
}

async function syncVotes() {
    const votes = await fetchServerVotes();
    if (votes) {
        serverVotes = votes;
        saveVotes(votes);
        isSyncOnline = true;
        updateSyncStatus();
        renderParticipants();
    } else {
        serverVotes = null;
        isSyncOnline = false;
        updateSyncStatus();
    }
}

function initSSE() {
    if (eventSource) {
        eventSource.close();
    }

    eventSource = new EventSource(`/api/market/${marketConfig.id}/stream`);

    eventSource.addEventListener('init', (event) => {
        const data = JSON.parse(event.data);
        serverVotes = data.votes;
        saveVotes(data.votes);
        renderParticipants();
    });

    eventSource.addEventListener('votes-updated', (event) => {
        const data = JSON.parse(event.data);
        serverVotes = data.votes;
        saveVotes(data.votes);
        renderParticipants();
    });

    eventSource.onerror = () => {
        isSyncOnline = false;
        updateSyncStatus();
        if (eventSource) {
            eventSource.close();
        }
        setTimeout(initSSE, 5000);
    };
}

function renderImageGallery() {
    const gallery = document.getElementById('image-gallery');
    gallery.innerHTML = '';

    participants.forEach(name => {
        const card = document.createElement('div');
        card.className = 'avatar-card';
        card.innerHTML = `
            <img src="${participantAvatars[name] || 'image/logo.jpg'}" alt="${name}">
            <div class="avatar-name">${name}</div>
        `;
        gallery.appendChild(card);
    });
}

function renderProbabilityGraph(votes) {
    const total = getTotalVotes(votes);
    const chartCanvas = document.getElementById('probability-graph');
    if (!chartCanvas) return;

    const data = participants.map(name => {
        const count = votes[name] || 0;
        return total === 0 ? 0 : Math.round((count / total) * 100);
    });

    const chartData = {
        labels: participants,
        datasets: [{
            label: 'Vote Share (%)',
            data,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.16)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#7dd3fc',
            pointBorderColor: '#38bdf8',
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBorderWidth: 2
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true, labels: { color: '#cbd5e1', font: { size: 12, weight: '600' } } },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.94)',
                titleColor: '#f8fafc',
                bodyColor: '#cbd5e1',
                borderColor: 'rgba(148, 163, 184, 0.18)',
                borderWidth: 1,
                padding: 10,
                displayColors: false,
                callbacks: { label: (context) => `${context.parsed.y}%` }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                ticks: { color: '#94a3b8', callback: value => `${value}%` },
                grid: { color: 'rgba(148, 163, 184, 0.12)' }
            },
            x: {
                ticks: { color: '#94a3b8' },
                grid: { color: 'rgba(148, 163, 184, 0.08)' }
            }
        }
    };

    if (chartInstance) {
        chartInstance.data = chartData;
        chartInstance.options = chartOptions;
        chartInstance.update('active');
    } else {
        const ctx = chartCanvas.getContext('2d');
        chartInstance = new Chart(ctx, { type: 'line', data: chartData, options: chartOptions });
    }
}

// SSE listener for real-time vote updates
let sseSource = null;
function initSSE() {
    if (sseSource) sseSource.close();
    sseSource = new EventSource('/api/stream');

    sseSource.addEventListener('init', (e) => {
        const data = JSON.parse(e.data);
        serverVotes = data.votes;
        saveVotes(data.votes);
        isSyncOnline = true;
        updateSyncStatus();
        renderParticipants();
    });

    sseSource.addEventListener('votes-updated', (e) => {
        const data = JSON.parse(e.data);
        serverVotes = data.votes;
        saveVotes(data.votes);
        isSyncOnline = true;
        updateSyncStatus();
        renderParticipants();
    });

    sseSource.onerror = () => {
        isSyncOnline = false;
        updateSyncStatus();
        sseSource.close();
        // Reconnect after 3 seconds
        setTimeout(initSSE, 3000);
    };
}

function renderParticipants() {
    const votes = getCurrentVotes();
    renderProbabilityGraph(votes);

    const total = getTotalVotes(votes);
    const area = document.getElementById('candidates-voting-area');
    if (!area) return;
    area.innerHTML = '';

    participants.forEach(name => {
        const count = votes[name] || 0;
        const share = total === 0 ? 0 : Math.round((count / total) * 100);
        const card = document.createElement('div');
        card.className = `candidate-voting-card${selectedCandidate === name ? ' selected' : ''}`;
        card.dataset.name = name;
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <div class="card-image">
                <img src="${participantAvatars[name]}" alt="${name}">
            </div>
            <div class="card-content">
                <h3>${name}</h3>
                <div class="vote-stats">
                    <div class="vote-count">${count} vote${count === 1 ? '' : 's'}</div>
                    <div class="vote-percentage">${share}%</div>
                </div>
                <div class="share-bar">
                    <div class="share-fill" style="width: ${share}%;"></div>
                </div>
                <button class="vote-button">Vote for ${name}</button>
            </div>
        `;

        card.querySelector('.vote-button').addEventListener('click', (e) => {
            e.preventDefault();
            voteForCandidate(name);
        });

        card.addEventListener('click', (e) => {
            if (e.target.closest('.vote-button')) return;
            selectedCandidate = name;
            updateSelection();
        });

        area.appendChild(card);
    });

    updateSummary(votes);
}

function updateSummary(votes) {
    const total = getTotalVotes(votes);
    const [topName, topCount] = getTopChoice(votes);
    const topShare = total === 0 ? 0 : Math.round((topCount / total) * 100);

    document.getElementById('total-votes').textContent = total;
    document.getElementById('top-choice').textContent = topName;
    document.getElementById('top-share').textContent = `${topShare}%`;
}

function updateSelection() {
    document.getElementById('selected-name').textContent = selectedCandidate || 'None';
    renderParticipants();
    updateUserUI();
}

async function voteForCandidate(candidateName) {
    if (!candidateName) {
        alert('Please select a candidate before voting.');
        return;
    }

    const username = loadUsername();
    if (!username) {
        alert('Register with a username before voting.');
        return;
    }

    if (hasUserVoted(username)) {
        alert('You have already voted once in this market.');
        updateUserUI();
        return;
    }

    const weight = Number(document.getElementById('vote-weight').value);
    const localVotes = loadVotes();
    localVotes[candidateName] += weight;
    saveVotes(localVotes);
    setUserVote(username, candidateName);
    selectedCandidate = candidateName;

    if (isSyncOnline) {
        const result = await postVoteToServer(candidateName, username, weight);
        if (result && result.success) {
            serverVotes = result.votes;
            saveVotes(result.votes);
        } else {
            isSyncOnline = false;
            updateSyncStatus();
            alert('Vote was recorded locally, but sync is offline. Refresh later to update live totals.');
        }
    }

    renderParticipants();
    document.getElementById('vote-status').textContent = `You voted for ${candidateName}!`;
    document.getElementById('selected-name').textContent = candidateName;
    updateUserUI();
    if (typeof recordUserActivity === 'function') {
        recordUserActivity(username, 'VOTED', candidateName);
    }
    alert(`Voted for ${candidateName} as ${username}!`);
}

function viewResults() {
    window.location.href = `results.html?market=${marketConfig.id}`;
}

function syncWeightDisplay() {
    document.getElementById('weight-display').textContent = document.getElementById('vote-weight').value;
}

async function handleRegister(event) {
    event.preventDefault();
    const input = document.getElementById('username-input');
    const name = input.value.trim();
    if (!name) {
        alert('Choose a username to continue.');
        return;
    }
    const loggedIn = await postLoginToServer(name);
    saveUsername(name);
    input.value = '';
    updateUserUI();
    if (loggedIn) {
        syncVotes();
    }
    if (typeof recordUserActivity === 'function') {
        recordUserActivity(name, 'REGISTERED');
    }
    alert(`Registered as ${name}.`);
}

function handleLogout() {
    clearUsername();
    selectedCandidate = null;
    updateSelection();
    updateUserUI();
}

function buildMarketHeader() {
    const title = document.getElementById('market-title');
    const description = document.getElementById('market-description');
    const headerTag = document.getElementById('market-tag');
    if (title) title.textContent = marketConfig.title;
    if (description) description.textContent = marketConfig.description;
    if (headerTag) headerTag.textContent = 'Prediction Market';
}

function buildCandidateCards() {
    const grid = document.getElementById('candidate-grid');
    if (!grid) return;
    grid.innerHTML = '';

    participants.forEach(name => {
        const card = document.createElement('div');
        card.className = 'avatar-card candidate-selectable';
        card.dataset.candidate = name;
        card.innerHTML = `
            <img src="${participantAvatars[name] || 'image/logo.jpg'}" alt="${name}">
            <div class="avatar-name">${name}</div>
        `;
        card.addEventListener('click', () => {
            selectedCandidate = name;
            updateSelection();
        });
        grid.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    buildMarketHeader();
    buildCandidateCards();
    document.getElementById('submit-vote').addEventListener('click', () => voteForCandidate(selectedCandidate));
    document.getElementById('view-results').addEventListener('click', viewResults);
    document.getElementById('registration-form').addEventListener('submit', handleRegister);
    document.getElementById('logout-button').addEventListener('click', handleLogout);
    document.getElementById('vote-weight').addEventListener('input', syncWeightDisplay);

    syncWeightDisplay();
    updateUserUI();
    renderParticipants();
    updateCountdown();
    await syncVotes();
    initSSE(); // Initialize real-time SSE updates
    setInterval(updateCountdown, 1000);
});
