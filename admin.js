
const ADMIN_TOKEN_KEY  = 'adminToken';
const PARTICIPANTS     = ['Eliman', 'Isreal', 'Marwan', 'Suraj'];

function getAdminToken() {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

function saveAdminToken(token) {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function clearAdminToken() {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

function adminHeaders() {
    return {
        'Content-Type': 'application/json',
        'x-admin-token': getAdminToken()
    };
}

async function isAdminLoggedIn() {
    const token = getAdminToken();
    if (!token) return false;
    try {
        const res = await fetch('/api/admin/verify', {
            headers: { 'x-admin-token': token }
        });
        return res.ok;
    } catch {
        return false;
    }
}

async function logoutAdmin() {
    await fetch('/api/admin/logout', {
        method: 'POST',
        headers: adminHeaders()
    }).catch(() => {});
    clearAdminToken();
    window.location.href = 'admin-login.html';
}


function trackUserActivity(username, action, candidate = null) {
    const USER_ACTIVITY_KEY = 'userActivity';
    let activities = JSON.parse(localStorage.getItem(USER_ACTIVITY_KEY) || '[]');
    activities.push({
        username,
        action,
        candidate,
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleTimeString()
    });
    localStorage.setItem(USER_ACTIVITY_KEY, JSON.stringify(activities));
}

function recordUserActivity(username, action, candidate = null) {
    trackUserActivity(username, action, candidate);
}

if (document.getElementById('login-form')) {
    document.getElementById('login-form').addEventListener('submit', async function(e) {
        e.preventDefault();

        const email    = document.getElementById('admin-email').value.trim().toLowerCase();
        const password = document.getElementById('admin-password').value;
        const errorEl  = document.getElementById('error-message');
        const btn      = this.querySelector('button[type="submit"]');

        btn.disabled = true;
        btn.textContent = 'Signing in…';

        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (res.ok && data.token) {
                saveAdminToken(data.token);
                errorEl.classList.remove('show');
                window.location.href = 'admin-dashboard.html';
            } else {
                throw new Error(data.error || 'Invalid credentials');
            }
        } catch (err) {
            errorEl.textContent = '❌ ' + err.message;
            errorEl.classList.add('show');
            document.getElementById('admin-password').value = '';
            setTimeout(() => errorEl.classList.remove('show'), 5000);
            btn.disabled = false;
            btn.textContent = 'Sign in';
        }
    });
}


if (document.getElementById('clear-votes-btn')) {
    // Guard: redirect to login if session is invalid
    (async () => {
        if (!(await isAdminLoggedIn())) {
            window.location.href = 'admin-login.html';
            return;
        }
        initDashboard();
    })();
}

function initDashboard() {
    document.getElementById('logout-btn').addEventListener('click', logoutAdmin);

    const modal       = document.getElementById('clear-modal');
    const clearBtn    = document.getElementById('clear-votes-btn');
    const cancelBtn   = document.getElementById('modal-cancel');
    const confirmBtn  = document.getElementById('modal-confirm');

    clearBtn.addEventListener('click', () => modal.classList.add('active'));
    cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });

    confirmBtn.addEventListener('click', async () => {
        await clearAllVotes();
        modal.classList.remove('active');
        const notification = document.getElementById('success-notification');
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 3000);
    });

    loadDashboardData();
    setInterval(loadDashboardData, 2000);
}



async function getAllVotes() {
    try {
        const res = await fetch('/api/votes');
        if (res.ok) return await res.json();
    } catch (e) { console.error('Error loading votes:', e); }
    return {};
}

async function getAllUsers() {
    try {
        const res = await fetch('/api/users');
        if (res.ok) return await res.json();
    } catch (e) { console.error('Error loading users:', e); }
    return {};
}

function getTotalVotes(votes) {
    return Object.values(votes).reduce((sum, n) => sum + n, 0);
}

async function clearAllVotes() {
    try {
        const res = await fetch('/api/reset', {
            method: 'POST',
            headers: adminHeaders()
        });
        if (res.ok) {
            trackUserActivity('ADMIN', 'CLEARED_ALL_VOTES');
            await loadDashboardData();
        } else if (res.status === 403) {
            alert('Session expired. Please log in again.');
            clearAdminToken();
            window.location.href = 'admin-login.html';
        }
    } catch (e) { console.error('Error resetting votes:', e); }
}

async function loadDashboardData() {
    // Fetch votes and users in parallel — one request each, not one-per-user
    const [votes, usersObj] = await Promise.all([getAllVotes(), getAllUsers()]);
    const totalVotes = getTotalVotes(votes);
    const userEntries = Object.entries(usersObj); // [[username, {vote, timestamp}], ...]
    const votedCount  = userEntries.filter(([, u]) => u.vote).length;

    document.getElementById('total-votes-stat').textContent = totalVotes;
    document.getElementById('active-users-stat').textContent = userEntries.length;
    document.getElementById('voted-users-stat').textContent = votedCount;

    // Vote tally bars
    const voteTallyDiv = document.getElementById('vote-tally');
    if (totalVotes === 0) {
        voteTallyDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <p>No votes yet</p>
            </div>`;
    } else {
        voteTallyDiv.innerHTML = PARTICIPANTS.map(name => {
            const count      = votes[name] || 0;
            const percentage = Math.round((count / totalVotes) * 100);
            return `
                <div class="vote-bar">
                    <div class="vote-label">${name}</div>
                    <div class="vote-progress">
                        <div class="vote-fill" style="width: ${percentage}%">${count > 0 ? percentage + '%' : ''}</div>
                    </div>
                    <div class="vote-count">${count}</div>
                </div>`;
        }).join('');
    }

    // User activity list
    const userActivityDiv = document.getElementById('user-activity');
    if (userEntries.length === 0) {
        userActivityDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <p>No registered users yet</p>
            </div>`;
    } else {
        userActivityDiv.innerHTML = userEntries.map(([username, info]) => {
            const vote       = info.vote || '';
            const voteStatus = vote
                ? ` voted for <strong>${vote}</strong>`
                : ' (no vote yet)';
            return `
                <div class="user-item">
                    <div class="user-info">
                        <div class="user-name">👤 ${username}</div>
                        <div class="user-meta">Registered${voteStatus}</div>
                    </div>
                    ${vote ? `<div class="user-vote">${vote}</div>` : ''}
                </div>`;
        }).join('');
    }
}


document.addEventListener('keydown', async function(e) {
    if (e.ctrlKey && e.altKey && e.key === 'l') {
        e.preventDefault();
        const page = window.location.pathname;
        if (page.includes('admin-login') || page.includes('admin-dashboard')) return;
        if (await isAdminLoggedIn()) {
            window.location.href = 'admin-dashboard.html';
        } else {
            window.location.href = 'admin-login.html';
        }
    }
});