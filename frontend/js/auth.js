// auth.js – Login, Signup, and session management

async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');

    if (!username || !password) {
        errorDiv.textContent = 'Username and password are required.';
        return;
    }

    try {
        const result = await API.login(username, password);
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));

        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect') || 'index.html';
        window.location.href = redirect;
    } catch (error) {
        errorDiv.textContent = error.message || 'Login failed.';
    }
}

async function handleSignup(event) {
    event.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirmPassword').value;
    const email = document.getElementById('email').value.trim();
    const errorDiv = document.getElementById('signupError');

    // Basic frontend validation (redundant with real-time, but safe)
    if (!username || !password) {
        errorDiv.textContent = 'Username and password are required.';
        return;
    }
    if (password !== confirm) {
        errorDiv.textContent = 'Passwords do not match.';
        return;
    }
    if (password.length < 6) {
        errorDiv.textContent = 'Password must be at least 6 characters.';
        return;
    }

    // Optional email format check
    const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
        errorDiv.textContent = 'Please enter a valid email address.';
        return;
    }

    try {
        const result = await API.signup(username, password, email);
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        window.location.href = 'index.html';
    } catch (error) {
        errorDiv.textContent = error.message || 'Signup failed.';
    }
}

function updateAuthUI() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const loginLink = document.getElementById('loginLink');
    const signupLink = document.getElementById('signupLink');
    const profileLink = document.getElementById('profileLink');
    const logoutBtn = document.getElementById('logoutBtn');
    const loggedInUserSpan = document.getElementById('loggedInUser');

    if (token && user) {
        if (loginLink) loginLink.style.display = 'none';
        if (signupLink) signupLink.style.display = 'none';
        if (profileLink) profileLink.style.display = 'inline-block';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
        if (loggedInUserSpan) {
            loggedInUserSpan.textContent = user.username;
            loggedInUserSpan.style.display = 'inline';
        }
    } else {
        if (loginLink) loginLink.style.display = 'inline-block';
        if (signupLink) signupLink.style.display = 'inline-block';
        if (profileLink) profileLink.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (loggedInUserSpan) loggedInUserSpan.style.display = 'none';
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}