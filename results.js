const USERNAME_KEY = 'voteUsername';
const participants = ['Eliman', 'Isreal', 'Marwan', 'Suraj'];
let votesData = {};

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

function loadUsername() {
    return localStorage.getItem(USERNAME_KEY) || '';
}

function getTotalVotes(votes) {
    return Object.values(votes).reduce((sum, count) => sum + count, 0);
}

async function displayResults() {
    await loadVotesFromServer();
    const total = getTotalVotes(votesData);
    const sorted = Object.entries(votesData).sort((a, b) => b[1] - a[1]);
    const resultsList = document.getElementById('results-list');
    resultsList.innerHTML = '';

    sorted.forEach(([name, count], index) => {
        const share = total === 0 ? 0 : Math.round((count / total) * 100);
        const card = document.createElement('article');
        card.className = 'participant-card';
        card.innerHTML = `
            <div class="card-top">
                <div>
                    <h3>${index + 1}. ${name}</h3>
                    <div class="vote-count">${count} vote${count === 1 ? '' : 's'}</div>
                </div>
                <div class="vote-count">${share}%</div>
            </div>
            <div class="share-bar"><div class="share-fill" style="width: ${share}%;"></div></div>
        `;
        resultsList.appendChild(card);
    });

    const [leaderName, leaderCount] = sorted[0] || ['None', 0];
    const leaderShare = total === 0 ? 0 : Math.round((leaderCount / total) * 100);

    document.getElementById('results-total').textContent = total;
    document.getElementById('results-leader').textContent = leaderName;
    document.getElementById('results-share').textContent = `${leaderShare}%`;
    const username = loadUsername();
    document.getElementById('results-user-message').textContent = username ? `Logged in as ${username}` : 'Not registered';

    // Fetch and display stats
    try {
        const statsResponse = await fetch('/api/stats');
        if (statsResponse.ok) {
            const stats = await statsResponse.json();
            document.getElementById('logged-in-count').textContent = stats.loggedInCount;
            document.getElementById('voted-percentage').textContent = `${stats.loginPercentage}%`;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function resetVotes() {
    if (confirm('Reset the market and clear all vote data? This will clear all votes!')) {
        // Note: Reset would need admin API, but for now, just reload
        alert('Reset not implemented in server mode.');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('reset-votes').addEventListener('click', resetVotes);
    await displayResults();
    setInterval(displayResults, 5000); // Poll every 5 seconds
});