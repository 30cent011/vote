const USERNAME_KEY = 'voteUsername';
const MARKET_QUERY_KEY = 'market';
const DEFAULT_MARKET = 'unit6';

const markets = {
    unit6: { id: 'unit6', title: 'Who will fumble Unit 6?', description: 'Vote on the first fumble from Unit 6 in this live prediction market.', participants: ['Unit 6', 'Unit 7', 'Big Daniel', 'Spectator'] },
    unit7: { id: 'unit7', title: 'Who will fumble Unit 7?', description: 'Choose which Unit 7 player will drop the ball first.', participants: ['Unit 7', 'Unit 6', 'Big Daniel', 'Spectator'] },
    'unit6-vs-7': { id: 'unit6-vs-7', title: 'Which will fumble first: Unit 6 or Unit 7?', description: 'A direct market on whether Unit 6 or Unit 7 slips up first.', participants: ['Unit 6', 'Unit 7'] },
    dumbest: { id: 'dumbest', title: 'Who is the dumbest?', description: 'Market-style ranking for the person with the weakest play.', participants: ['Eliman', 'Isreal', 'Marwan', 'Suraj'] },
    'big-daniel': { id: 'big-daniel', title: 'Who will get touched by Big Daniel first?', description: 'Place a prediction on the first person to feel Big Daniel’s reach.', participants: ['Big Daniel', 'Unit 6', 'Unit 7', 'Marwan'] }
};

function getMarketId() {
    const query = new URLSearchParams(window.location.search);
    return query.get(MARKET_QUERY_KEY) || DEFAULT_MARKET;
}

function getMarketConfig() {
    const marketId = getMarketId();
    return markets[marketId] || markets[DEFAULT_MARKET];
}

const marketConfig = getMarketConfig();
let votesData = {};
let eventSource = null;

function loadUsername() {
    return localStorage.getItem(USERNAME_KEY) || '';
}

function getTotalVotes(votes) {
    return Object.values(votes).reduce((sum, count) => sum + count, 0);
}

function updateHeader() {
    document.getElementById('results-title').textContent = marketConfig.title;
    document.getElementById('results-description').textContent = marketConfig.description;
}

function renderResults() {
    const total = getTotalVotes(votesData);
    const sorted = Object.entries(votesData).sort((a, b) => b[1] - a[1]);
    const list = document.getElementById('results-list');
    list.innerHTML = '';

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
            <div class="share-bar"><div class="share-fill" style="width:${share}%;"></div></div>
        `;
        list.appendChild(card);
    });

    const [leaderName, leaderCount] = sorted[0] || ['None', 0];
    const leaderShare = total === 0 ? 0 : Math.round((leaderCount / total) * 100);

    document.getElementById('results-total').textContent = total;
    document.getElementById('results-leader').textContent = leaderName;
    document.getElementById('results-share').textContent = `${leaderShare}%`;

    const username = loadUsername();
    document.getElementById('results-user-message').textContent = username ? `Logged in as ${username}` : 'Not registered';
}

function initSSE() {
    if (eventSource) {
        eventSource.close();
    }

    eventSource = new EventSource(`/api/market/${marketConfig.id}/stream`);

    eventSource.addEventListener('init', (event) => {
        const data = JSON.parse(event.data);
        votesData = data.votes;
        renderResults();
    });

    eventSource.addEventListener('votes-updated', (event) => {
        const data = JSON.parse(event.data);
        votesData = data.votes;
        renderResults();
    });

    eventSource.onerror = () => {
        if (eventSource) {
            eventSource.close();
        }
        setTimeout(initSSE, 5000);
    };
}

function goBack() {
    window.location.href = `market.html?market=${marketConfig.id}`;
}

function refreshPage() {
    if (eventSource) {
        eventSource.close();
    }
    initSSE();
}

document.addEventListener('DOMContentLoaded', () => {
    updateHeader();
    document.getElementById('back-button').addEventListener('click', goBack);
    document.getElementById('refresh-button').addEventListener('click', refreshPage);
    initSSE();
});
