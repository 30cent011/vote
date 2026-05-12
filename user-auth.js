const AUTH_USERNAME_KEY = 'voteUsername';
const AUTH_TOKEN_KEY = 'voteToken';

function getStoredUsername() {
    return localStorage.getItem(AUTH_USERNAME_KEY) || '';
}

function getStoredToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

function saveUserSession(username, token) {
    localStorage.setItem(AUTH_USERNAME_KEY, username);
    localStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearUserSession() {
    localStorage.removeItem(AUTH_USERNAME_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
}

function authHeaders() {
    const token = getStoredToken();
    return token ? { 'x-user-token': token } : {};
}

async function fetchCurrentUser() {
    const token = getStoredToken();
    if (!token) return null;

    try {
        const response = await fetch('/api/user/me', { headers: authHeaders() });
        if (!response.ok) throw new Error('Not authenticated');
        return await response.json();
    } catch {
        clearUserSession();
        return null;
    }
}

function hookAuthButtons() {
    const loginButton = document.getElementById('login-button');
    const signupButton = document.getElementById('signup-button');
    const logoutButton = document.getElementById('logout-button');

    if (loginButton) {
        loginButton.addEventListener('click', () => window.location.href = 'login.html');
    }
    if (signupButton) {
        signupButton.addEventListener('click', () => window.location.href = 'signup.html');
    }
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await fetch('/api/user/logout', {
                method: 'POST',
                headers: authHeaders()
            }).catch(() => {});
            clearUserSession();
            window.location.reload();
        });
    }
}

function renderAuthNav(profile) {
    const loginButton = document.getElementById('login-button');
    const signupButton = document.getElementById('signup-button');
    const logoutButton = document.getElementById('logout-button');

    if (!loginButton || !signupButton || !logoutButton) return;

    if (profile) {
        loginButton.classList.add('hidden');
        signupButton.classList.add('hidden');
        logoutButton.classList.remove('hidden');
    } else {
        loginButton.classList.remove('hidden');
        signupButton.classList.remove('hidden');
        logoutButton.classList.add('hidden');
    }
}

function renderAuthStatus(profile) {
    const authStatus = document.getElementById('auth-status');
    const balanceStatus = document.getElementById('balance-status');

    if (!authStatus) return;
    if (profile) {
        authStatus.textContent = `Signed in as ${profile.username}`;
        if (balanceStatus) {
            balanceStatus.classList.remove('hidden');
            balanceStatus.textContent = `Balance: ${profile.balance} points`;
        }
    } else {
        authStatus.textContent = 'Not signed in. Login or sign up to place a bet.';
        if (balanceStatus) {
            balanceStatus.classList.add('hidden');
            balanceStatus.textContent = '';
        }
    }
}

async function loginUser(username, password) {
    const response = await fetch('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Login failed');
    }
    saveUserSession(data.username, data.token);
    return data;
}

async function signupUser(username, password) {
    const response = await fetch('/api/user/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
    }
    saveUserSession(data.username, data.token);
    return data;
}

async function initAuthUi() {
    hookAuthButtons();
    const profile = await fetchCurrentUser();
    renderAuthNav(profile);
    renderAuthStatus(profile);
    return profile;
}

if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initAuthUi);
}
