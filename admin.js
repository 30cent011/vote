// No credentials here — auth is server-side only via /api/admin/login
const ADMIN_TOKEN_KEY = 'adminToken';
const PARTICIPANTS    = ['Eliman', 'Isreal', 'Marwan', 'Suraj'];
let sseSource = null;

// ── Session helpers ───────────────────────────────────────────────────────────
function getAdminToken()    { return sessionStorage.getItem(ADMIN_TOKEN_KEY) || ''; }
function saveAdminToken(t)  { sessionStorage.setItem(ADMIN_TOKEN_KEY, t); }
function clearAdminToken()  { sessionStorage.removeItem(ADMIN_TOKEN_KEY); }

function adminHeaders() {
    return { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() };
}

async function isAdminLoggedIn() {
    const token = getAdminToken();
    if (!token) return false;
    try {
        const res = await fetch('/api/admin/verify', { headers: { 'x-admin-token': token } });
        return res.ok;
    } catch { return false; }
}

async function logoutAdmin() {
    await fetch('/api/admin/logout', { method: 'POST', headers: adminHeaders() }).catch(() => {});
    clearAdminToken();
    if (sseSource) sseSource.close();
    window.location.href = 'admin-login.html';
}

// ── Activity log (local) ──────────────────────────────────────────────────────
function trackUserActivity(username, action, candidate = null) {
    const key = 'userActivity';
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.push({ username, action, candidate, timestamp: new Date().toISOString(), time: new Date().toLocaleTimeString() });
    localStorage.setItem(key, JSON.stringify(list));
}

function recordUserActivity(username, action, candidate = null) {
    trackUserActivity(username, action, candidate);
}

// ── Login page ────────────────────────────────────────────────────────────────
if (document.getElementById('login-form')) {
    document.getElementById('login-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        const email    = document.getElementById('admin-email').value.trim().toLowerCase();
        const password = document.getElementById('admin-password').value;
        const errorEl  = document.getElementById('error-message');
        const btn      = this.querySelector('button[type="submit"]');

        btn.disabled    = true;
        btn.textContent = 'Signing in…';

        try {
            const res  = await fetch('/api/admin/login', {
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
            btn.disabled    = false;
            btn.textContent = 'Sign in';
        }
    });
}

// ── Dashboard page ────────────────────────────────────────────────────────────
if (document.getElementById('clear-votes-btn')) {
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

    const modal      = document.getElementById('clear-modal');
    const clearBtn   = document.getElementById('clear-votes-btn');
    const cancelBtn  = document.getElementById('modal-cancel');
    const confirmBtn = document.getElementById('modal-confirm');

    clearBtn.addEventListener('click',  () => modal.classList.add('active'));
    cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });

    confirmBtn.addEventListener('click', async () => {
        await clearAllVotes();
        modal.classList.remove('active');
        const notif = document.getElementById('success-notification');
        notif.classList.add('show');
        setTimeout(() => notif.classList.remove('show'), 3000);
    });

    // SSE: dashboard updates in real-time whenever any session votes or resets
    initSSE();
    loadDashboardData(); // initial paint before SSE fires
}

function initSSE() {
    if (sseSource) sseSource.close();
    sseSource = new EventSource('/api/stream');

    sseSource.addEventListener('init', (e) => {
        const { votes, users } = JSON.parse(e.data);
        renderDashboard(votes, users);
    });

    sseSource.addEventListener('votes-updated', (e) => {
        const { votes, users } = JSON.parse(e.data);
        renderDashboard(votes, users);
    });

    sseSource.onerror = () => {
        sseSource.close();
        setTimeout(initSSE, 3000);
    };
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function getAllVotes() {
    try { const r = await fetch('/api/votes'); if (r.ok) return r.json(); } catch {}
    return {};
}

async function getAllUsers() {
    try { const r = await fetch('/api/users'); if (r.ok) return r.json(); } catch {}
    return {};
}

function getTotalVotes(votes) {
    return Object.values(votes).reduce((s, n) => s + n, 0);
}

async function clearAllVotes() {
    try {
        const res = await fetch('/api/reset', { method: 'POST', headers: adminHeaders() });
        if (res.ok) {
            trackUserActivity('ADMIN', 'CLEARED_ALL_VOTES');
            // SSE push from server will update dashboard automatically
        } else if (res.status === 403) {
            alert('Session expired. Please log in again.');
            clearAdminToken();
            window.location.href = 'admin-login.html';
        }
    } catch (e) { console.error('Error resetting votes:', e); }
}

async function loadDashboardData() {
    const [votes, usersObj] = await Promise.all([getAllVotes(), getAllUsers()]);
    renderDashboard(votes, usersObj);
}

function renderDashboard(votes, usersObj) {
    const totalVotes  = getTotalVotes(votes);
    const userEntries = Object.entries(usersObj);
    const votedCount  = userEntries.filter(([, u]) => u.vote).length;

    document.getElementById('total-votes-stat').textContent  = totalVotes;
    document.getElementById('active-users-stat').textContent = userEntries.length;
    document.getElementById('voted-users-stat').textContent  = votedCount;

    // Vote tally bars
    const tallyDiv = document.getElementById('vote-tally');
    if (totalVotes === 0) {
        tallyDiv.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><p>No votes yet</p></div>`;
    } else {
        tallyDiv.innerHTML = PARTICIPANTS.map(name => {
            const count      = votes[name] || 0;
            const percentage = Math.round((count / totalVotes) * 100);
            return `
                <div class="vote-bar">
                    <div class="vote-label">${name}</div>
                    <div class="vote-progress">
                        <div class="vote-fill" style="width:${percentage}%">${count > 0 ? percentage + '%' : ''}</div>
                    </div>
                    <div class="vote-count">${count}</div>
                </div>`;
        }).join('');
    }

    // User list
    const activityDiv = document.getElementById('user-activity');
    if (userEntries.length === 0) {
        activityDiv.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><p>No registered users yet</p></div>`;
    } else {
        activityDiv.innerHTML = userEntries.map(([username, info]) => {
            const vote       = info.vote || '';
            const voteStatus = vote ? ` voted for <strong>${vote}</strong>` : ' (no vote yet)';
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

// ── Keyboard shortcut Ctrl+Alt+L ──────────────────────────────────────────────
document.addEventListener('keydown', async function (e) {
    if (e.ctrlKey && e.altKey && e.key === 'l') {
        e.preventDefault();
        const page = window.location.pathname;
        if (page.includes('admin-login') || page.includes('admin-dashboard')) return;
        window.location.href = await isAdminLoggedIn() ? 'admin-dashboard.html' : 'admin-login.html';
    }
});