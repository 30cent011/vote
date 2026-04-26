document.addEventListener('DOMContentLoaded', () => {
    const marketGrid = document.querySelector('.market-grid');
    if (!marketGrid) return;

    const noResultsMessage = document.createElement('div');
    noResultsMessage.className = 'no-results-message';
    noResultsMessage.textContent = 'No markets match your search. Try another keyword.';
    noResultsMessage.style.display = 'none';
    noResultsMessage.style.marginTop = '1rem';
    noResultsMessage.style.color = 'var(--text-muted)';
    marketGrid.insertAdjacentElement('afterend', noResultsMessage);

    const inputs = document.querySelectorAll('.search-box input[type="search"]');
    inputs.forEach(input => input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        const cards = marketGrid.querySelectorAll('.market-card');
        let visibleCount = 0;

        cards.forEach(card => {
            const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
            const description = card.querySelector('p')?.textContent.toLowerCase() || '';
            const category = card.querySelector('.pill')?.textContent.toLowerCase() || '';
            const matches = query === '' || title.includes(query) || description.includes(query) || category.includes(query);
            card.style.display = matches ? '' : 'none';
            if (matches) visibleCount += 1;
        });

        noResultsMessage.style.display = visibleCount === 0 ? 'block' : 'none';
    }));
});
