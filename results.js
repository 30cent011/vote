const USERNAME_KEY = 'voteUsername';
const participants = ['Eliman', 'Isreal', 'Marwan', 'Suraj'];
let votesData = {};
let sseSource = null;

// ── SSE: live sync ────────────────────────────────────────────────────────────
function initSSE() {
    if (sseSource) sseSource.close();
    sseSource = new EventSource('/api/stream');

    sseSource.addEventListener('init', (e) => {
        const data = JSON.parse(e.data);
        votesData = data.votes;
        renderResults();
    });

    sseSource.addEventListener('votes-updated', (e) => {
        const data = JSON.parse(e.data);
        votesData = data.votes;
        renderResults();
    });

    sseSource.onerror = () => {
        sseSource.close();
        setTimeout(initSSE, 3000);
    };
}

function loadUsername() {
    return localStorage.getItem(USERNAME_KEY) || '';
}

function getTotalVotes(votes) {
    return Object.values(votes).reduce((sum, count) => sum + count, 0);
}

async function renderResults() {
    const total  = getTotalVotes(votesData);
    const sorted = Object.entries(votesData).sort((a, b) => b[1] - a[1]);
    const list   = document.getElementById('results-list');
    list.innerHTML = '';

    sorted.forEach(([name, count], index) => {
        const share = total === 0 ? 0 : Math.round((count / total) * 100);
        const card  = document.createElement('article');
        card.className = 'participant-card';
        card.innerHTML = `
            <div class="card-top">
                <div>
                    <h3>${index + 1}. ${name}</h3>
                    <div class="vote-count">${count} vote${count === 1 ? '' : 's'}</div>
                </div>
                <div class="vote-count">${share}%</div>
            </div>
            <div class="share-bar"><div class="share-fill" style="width:${share}%;"></div></div>
        `;
        list.appendChild(card);
    });

    const [leaderName, leaderCount] = sorted[0] || ['None', 0];
    const leaderShare = total === 0 ? 0 : Math.round((leaderCount / total) * 100);

    document.getElementById('results-total').textContent  = total;
    document.getElementById('results-leader').textContent = leaderName;
    document.getElementById('results-share').textContent  = `${leaderShare}%`;

    const username = loadUsername();
    document.getElementById('results-user-message').textContent =
        username ? `Logged in as ${username}` : 'Not registered';

    // Stats
    try {
        const res = await fetch('/api/stats');
        if (res.ok) {
            const stats = await res.json();
            document.getElementById('logged-in-count').textContent   = stats.loggedInCount;
            document.getElementById('voted-percentage').textContent  = `${stats.loginPercentage}%`;
        }
    } catch (e) {
        console.error('Error loading stats:', e);
    }
}

function resetVotes() {
    alert('Use the Admin Dashboard to reset votes.');
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('reset-votes').addEventListener('click', resetVotes);
    // SSE handles all live updates — no polling needed
    initSSE();
});