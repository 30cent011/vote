const USERNAME_KEY = 'voteUsername';
const DEADLINE_KEY = 'voteDeadline';
const participants = ['Eliman', 'Isreal', 'Marwan', 'Suraj'];
const participantAvatars = {
    Eliman: 'image/eliman.jpg',
    Isreal: 'image/isreal.jpg',
    Marwan: 'image/marwan.webp',
    Suraj: 'image/suraj.jpg'
};
let selectedCandidate = null;
let chartInstance = null;
let votesData = {};
let usersData = {};
let broadcastChannel = null;

// Initialize broadcast channel for same-browser tab sync
function initBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel = new BroadcastChannel('vote-sync');
        broadcastChannel.onmessage = (event) => {
            if (event.data.type === 'votes-updated') {
                votesData = event.data.votes;
                usersData = event.data.users;
                renderParticipants(votesData);
                updateSummary(votesData);
            }
        };
    }
}

// Broadcast updates to other tabs
function broadcastUpdate() {
    if (broadcastChannel) {
        broadcastChannel.postMessage({
            type: 'votes-updated',
            votes: votesData,
            users: usersData
        });
    }
}

async function loadVotesFromServer() {
    try {
        const response = await fetch('/api/votes');
        if (response.ok) {
            votesData = await response.json();
        } else {
            votesData = {};
            participants.forEach(name => votesData[name] = 0);
        }
    } catch (error) {
        console.error('Error loading votes:', error);
        votesData = {};
        participants.forEach(name => votesData[name] = 0);
    }
}

async function loadUsersFromServer() {
    try {
        const response = await fetch('/api/users');
        if (response.ok) {
            usersData = await response.json();
        } else {
            usersData = {};
        }
    } catch (error) {
        console.error('Error loading users:', error);
        usersData = {};
    }
}

async function submitVoteToServer(candidate, username) {
    try {
        const response = await fetch('/api/votes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidate, username })
        });
        if (response.ok) {
            const data = await response.json();
            votesData = data.votes;
            usersData = data.users;
            broadcastUpdate();
        }
    } catch (error) {
        console.error('Error submitting vote:', error);
    }
}

async function loginUser(username) {
    try {
        await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
    } catch (error) {
        console.error('Error logging in:', error);
    }
}

function loadUsername() {
    return localStorage.getItem(USERNAME_KEY) || '';
}

function saveUsername(username) {
    localStorage.setItem(USERNAME_KEY, username);
}

function clearUsername() {
    localStorage.removeItem(USERNAME_KEY);
}

function getUserVote(username) {
    return usersData[username]?.vote || '';
}

function hasUserVoted(username) {
    return Boolean(getUserVote(username));
}

function updateVotes(votes) {
    votesData = { ...votes };
    broadcastUpdate();
}

function getTotalVotes(votes) {
    return Object.values(votes).reduce((sum, count) => sum + count, 0);
}

function getTopChoice(votes) {
    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    return sorted[0] || ['None', 0];
}

function getDeadline() {
    let stored = localStorage.getItem(DEADLINE_KEY);
    if (!stored) {
        const deadline = Date.now() + 30 * 24 * 60 * 60 * 1000;
        localStorage.setItem(DEADLINE_KEY, `${deadline}`);
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

async function handleRegister(event) {
    event.preventDefault();
    const input = document.getElementById('username-input');
    const name = input.value.trim();
    if (!name) {
        alert('Choose a username to continue.');
        return;
    }
    saveUsername(name);
    await loginUser(name);
    input.value = '';
    updateUserUI();
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

function renderParticipants() {
    renderImageGallery();
    renderProbabilityGraph(votesData);

    const total = getTotalVotes(votesData);
    const list = document.getElementById('participants');
    list.innerHTML = '';

    participants.forEach(name => {
        const count = votesData[name];
        const share = total === 0 ? 0 : Math.round((count / total) * 100);
        const card = document.createElement('article');
        card.className = `participant-card${selectedCandidate === name ? ' selected' : ''}`;
        card.dataset.name = name;
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <div class="card-top">
                <div>
                    <h3>${name}</h3>
                    <div class="vote-count">${count} vote${count === 1 ? '' : 's'}</div>
                </div>
                <div class="vote-count">${share}%</div>
            </div>
            <div class="share-bar"><div class="share-fill" style="width: ${share}%;"></div></div>
            <div class="vote-actions">
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

        list.appendChild(card);
    });

    updateSummary(votesData);
}

async function voteForCandidate(candidateName) {
    const username = loadUsername();
    if (!username) {
        alert('Register with a username before voting.');
        return;
    }

    if (hasUserVoted(username)) {
        alert('You have already voted once.');
        updateUserUI();
        return;
    }

    await submitVoteToServer(candidateName, username);
    selectedCandidate = candidateName;
    renderParticipants();
    document.getElementById('vote-status').textContent = `You voted for ${candidateName}!`;
    document.getElementById('selected-name').textContent = candidateName;
    updateUserUI();
    if (typeof recordUserActivity === 'function') {
        recordUserActivity(username, 'VOTED', candidateName);
    }
    alert(`Voted for ${candidateName} as ${username}!`);
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
        const count = votes[name];
        return total === 0 ? 0 : Math.round((count / total) * 100);
    });

    const chartData = {
        labels: participants,
        datasets: [{
            label: 'Vote Share (%)',
            data: data,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
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
            legend: {
                display: true,
                labels: {
                    color: '#cbd5e1',
                    font: { size: 12, weight: '600' }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.92)',
                titleColor: '#f8fafc',
                bodyColor: '#cbd5e1',
                borderColor: 'rgba(148, 163, 184, 0.18)',
                borderWidth: 1,
                padding: 10,
                displayColors: false,
                callbacks: {
                    label: function(context) {
                        return `${context.parsed.y}%`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                    color: '#94a3b8',
                    callback: function(value) {
                        return value + '%';
                    }
                },
                grid: {
                    color: 'rgba(148, 163, 184, 0.12)'
                }
            },
            x: {
                ticks: {
                    color: '#94a3b8'
                },
                grid: {
                    color: 'rgba(148, 163, 184, 0.08)'
                }
            }
        }
    };

    if (chartInstance) {
        chartInstance.data = chartData;
        chartInstance.options = chartOptions;
        chartInstance.update('active');
    } else {
        const ctx = chartCanvas.getContext('2d');
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: chartOptions
        });
    }
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

function submitVote() {
    const username = loadUsername();
    if (!username) {
        alert('Register with a username before voting.');
        return;
    }

    if (!selectedCandidate) {
        alert('Please select a candidate before voting.');
        return;
    }

    voteForCandidate(selectedCandidate);
}

function viewResults() {
    window.location.href = 'results.html';
}

function syncWeightDisplay() {
    document.getElementById('weight-display').textContent = document.getElementById('vote-weight').value;
}

async function pollUpdates() {
    await loadVotesFromServer();
    await loadUsersFromServer();
    renderParticipants();
    updateSummary(votesData);
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize broadcast channel for tab sync
    initBroadcastChannel();

    // Load initial data from server
    await loadVotesFromServer();
    await loadUsersFromServer();

    // Login user if username exists
    const username = loadUsername();
    if (username) {
        await loginUser(username);
    }

    document.getElementById('submit-vote').addEventListener('click', submitVote);
    document.getElementById('view-results').addEventListener('click', viewResults);
    document.getElementById('registration-form').addEventListener('submit', handleRegister);
    document.getElementById('logout-button').addEventListener('click', handleLogout);
    document.getElementById('vote-weight').addEventListener('input', syncWeightDisplay);

    syncWeightDisplay();
    updateUserUI();
    renderParticipants();
    updateCountdown();
    setInterval(updateCountdown, 1000);
    setInterval(pollUpdates, 5000); // Poll every 5 seconds
});
