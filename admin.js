const ADMIN_CREDENTIALS = {
    email: '30cent0@proton.me',
    password: 'HEISENBERG67l+'
};

const ADMIN_SESSION_KEY = 'adminSession';
const ADMIN_TOKEN = 'adminToken_v1';
const USER_ACTIVITY_KEY = 'userActivity';
const VOTES_KEY = 'voteData';
const USERS_KEY = 'userData';
const PARTICIPANTS = ['Eliman', 'Isreal', 'Marwan', 'Suraj'];

function isAdminLoggedIn() {
    return localStorage.getItem(ADMIN_SESSION_KEY) === ADMIN_TOKEN;
}

function loginAdmin(email, password) {
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
        localStorage.setItem(ADMIN_SESSION_KEY, ADMIN_TOKEN);
        return true;
    }
    return false;
}

function logoutAdmin() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    window.location.href = 'admin-login.html';
}

// Console command to open admin panel (password protected & hidden)
window.openAdmin = function(password) {
    if (password === ADMIN_CREDENTIALS.password) {
        localStorage.setItem(ADMIN_SESSION_KEY, ADMIN_TOKEN);
        window.location.href = 'admin-dashboard.html';
        console.log('✅ Admin access enabled! Redirecting...');
    } else {
        console.error('❌ Invalid password! Access denied.');
    }
};

function trackUserActivity(username, action, candidate = null) {
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

if (document.getElementById('login-form')) {
    document.getElementById('login-form').addEventListener('submit', function(e) {
        e.preventDefault();

        const email = document.getElementById('admin-email').value.trim().toLowerCase();
        const password = document.getElementById('admin-password').value.trim();
        const errorMessage = document.getElementById('error-message');

        if (loginAdmin(email, password)) {
            errorMessage.classList.remove('show');
            window.location.href = 'admin-dashboard.html';
        } else {
            errorMessage.textContent = '❌ Invalid email or password';
            errorMessage.classList.add('show');
            document.getElementById('admin-password').value = '';
            setTimeout(() => errorMessage.classList.remove('show'), 5000);
        }
    });
}

if (document.getElementById('clear-votes-btn')) {
    if (!isAdminLoggedIn()) {
        window.location.href = 'admin-login.html';
    }

    document.getElementById('logout-btn').addEventListener('click', logoutAdmin);

    const modal = document.getElementById('clear-modal');
    const clearVotesBtn = document.getElementById('clear-votes-btn');
    const modalCancel = document.getElementById('modal-cancel');
    const modalConfirm = document.getElementById('modal-confirm');

    clearVotesBtn.addEventListener('click', () => modal.classList.add('active'));
    modalCancel.addEventListener('click', () => modal.classList.remove('active'));

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    modalConfirm.addEventListener('click', () => {
        clearAllVotes();
        modal.classList.remove('active');
        const notification = document.getElementById('success-notification');
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 3000);
    });

    loadDashboardData();
    setInterval(() => {
        loadDashboardData();
    }, 2000);
}

async function loadAllUsers() {
    try {
        const response = await fetch('/api/users');
        if (response.ok) {
            const users = await response.json();
            return Object.keys(users);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
    return [];
}

async function getUserVoteInfo(username) {
    try {
        const response = await fetch('/api/users');
        if (response.ok) {
            const users = await response.json();
            return users[username]?.vote || null;
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
    return null;
}

async function getAllVotes() {
    try {
        const response = await fetch('/api/votes');
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Error loading votes:', error);
    }
    return {};
}

function getTotalVotes(votes) {
    return Object.values(votes).reduce((sum, count) => sum + count, 0);
}

async function clearAllVotes() {
    try {
        const response = await fetch('/api/reset', { method: 'POST' });
        if (response.ok) {
            trackUserActivity('ADMIN', 'CLEARED_ALL_VOTES');
            loadDashboardData();
        }
    } catch (error) {
        console.error('Error resetting votes:', error);
    }
}

async function loadDashboardData() {
    const votes = await getAllVotes();
    const totalVotes = getTotalVotes(votes);
    const users = await loadAllUsers();

    document.getElementById('total-votes-stat').textContent = totalVotes;
    document.getElementById('active-users-stat').textContent = users.length;

    const votedUsers = [];
    for (const user of users) {
        const vote = await getUserVoteInfo(user);
        if (vote) votedUsers.push(user);
    }
    document.getElementById('voted-users-stat').textContent = votedUsers.length;

    const voteTallyDiv = document.getElementById('vote-tally');
    if (totalVotes === 0) {
        voteTallyDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <p>No votes yet</p>
            </div>
        `;
    } else {
        let voteTallyHTML = '';
        PARTICIPANTS.forEach(name => {
            const count = votes[name] || 0;
            const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            voteTallyHTML += `
                <div class="vote-bar">
                    <div class="vote-label">${name}</div>
                    <div class="vote-progress">
                        <div class="vote-fill" style="width: ${percentage}%">${count > 0 ? percentage + '%' : ''}</div>
                    </div>
                    <div class="vote-count">${count}</div>
                </div>
            `;
        });
        voteTallyDiv.innerHTML = voteTallyHTML;
    }

    const userActivityDiv = document.getElementById('user-activity');
    if (users.length === 0) {
        userActivityDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <p>No registered users yet</p>
            </div>
        `;
    } else {
        let userActivityHTML = '';
        for (const username of users) {
            const vote = await getUserVoteInfo(username);
            const voteStatus = vote ? ` voted for <strong>${vote}</strong>` : ' (no vote yet)';
            userActivityHTML += `
                <div class="user-item">
                    <div class="user-info">
                        <div class="user-name">👤 ${username}</div>
                        <div class="user-meta">Registered${voteStatus}</div>
                    </div>
                    ${vote ? `<div class="user-vote">${vote}</div>` : ''}
                </div>
            `;
        }
        userActivityDiv.innerHTML = userActivityHTML;
    }
}

function recordUserActivity(username, action, candidate = null) {
    trackUserActivity(username, action, candidate);
}

document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.altKey && e.key === 'l') {
        e.preventDefault();
        const currentPage = window.location.pathname;
        if (currentPage.includes('admin-login') || currentPage.includes('admin-dashboard')) return;
        if (isAdminLoggedIn()) {
            window.location.href = 'admin-dashboard.html';
        } else {
            window.location.href = 'admin-login.html';
        }
    }
});