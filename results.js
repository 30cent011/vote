const USERNAME_KEY = 'voteUsername';
const VOTES_KEY = 'voteData';
const participants = ['Eliman', 'Isreal', 'Marwan', 'Suraj'];

function loadUsername() {
    return localStorage.getItem(USERNAME_KEY) || '';
}

function loadVotesFromStorage() {
    const stored = localStorage.getItem(VOTES_KEY);
    if (stored) {
        return JSON.parse(stored);
    }
    const initial = {};
    participants.forEach(name => initial[name] = 0);
    return initial;
}

function getTotalVotes(votes) {
    return Object.values(votes).reduce((sum, count) => sum + count, 0);
}

function displayResults() {
    const votes = loadVotesFromStorage();
    const total = getTotalVotes(votes);
    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
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
}

function resetVotes() {
    if (confirm('Reset the market and clear all vote data? This will clear all votes!')) {
        localStorage.removeItem(VOTES_KEY);
        localStorage.removeItem(USERS_KEY);
        displayResults();
        alert('Votes have been reset.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('reset-votes').addEventListener('click', resetVotes);
    displayResults();
});