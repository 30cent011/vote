const MARKET_SUMMARY_REFRESH_INTERVAL = 5000;

async function fetchMarketVotes(marketId) {
    try {
        const response = await fetch(`/api/market/${encodeURIComponent(marketId)}/votes`);
        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch (error) {
        console.warn('Unable to fetch market votes for', marketId, error);
        return null;
    }
}

function getCandidateName(candidateEl) {
    if (candidateEl.dataset.candidate) {
        return candidateEl.dataset.candidate;
    }
    const firstTextNode = Array.from(candidateEl.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
    if (firstTextNode) {
        return firstTextNode.textContent.trim();
    }
    return candidateEl.textContent.replace(/\s*\d+%$/, '').trim();
}

function updateMarketCard(card, votes = {}) {
    const totalVotes = Object.values(votes).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const candidateElements = card.querySelectorAll('.market-breakdown div');

    candidateElements.forEach((candidateEl) => {
        const candidateName = getCandidateName(candidateEl);
        const voteCount = Number(votes[candidateName] || 0);
        const share = totalVotes === 0 ? 0 : Math.round((voteCount / totalVotes) * 100);
        const strongEl = candidateEl.querySelector('strong');
        if (strongEl) {
            strongEl.textContent = `${share}%`;
        }
    });
}

function setupMarketCard(card) {
    const marketId = card.dataset.market;
    if (!marketId) {
        return;
    }

    const navigateToMarket = () => {
        window.location.href = `market.html?market=${encodeURIComponent(marketId)}`;
    };

    card.style.cursor = 'pointer';
    card.addEventListener('click', (event) => {
        if (event.target.closest('a') || event.target.closest('button')) {
            return;
        }
        navigateToMarket();
    });
}

async function refreshMarketSummaries() {
    const cards = Array.from(document.querySelectorAll('.market-card[data-market]'));
    await Promise.all(cards.map(async (card) => {
        const marketId = card.dataset.market;
        const votes = await fetchMarketVotes(marketId);
        updateMarketCard(card, votes || {});
    }));
}

document.addEventListener('DOMContentLoaded', () => {
    const cards = Array.from(document.querySelectorAll('.market-card[data-market]'));
    cards.forEach(setupMarketCard);
    refreshMarketSummaries();
    setInterval(refreshMarketSummaries, MARKET_SUMMARY_REFRESH_INTERVAL);
});
