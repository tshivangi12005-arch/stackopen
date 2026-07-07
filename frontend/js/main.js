// main.js – Shared functionality across pages

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    if (typeof updateAuthUI === 'function') {
        updateAuthUI();
    } else {
        console.warn('updateAuthUI not available');
    }

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});

function toggleTheme() {
    const body = document.body;
    body.classList.toggle('dark-mode');
    const isDark = body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const body = document.body;
    if (savedTheme === 'dark') {
        body.classList.add('dark-mode');
        updateThemeIcon(true);
    } else {
        body.classList.remove('dark-mode');
        updateThemeIcon(false);
    }
}

function updateThemeIcon(isDark) {
    const btn = document.getElementById('themeToggle');
    if (btn) {
        btn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
}
// Press '/' to focus search bar
document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' 
        && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const search = document.getElementById('searchInput');
        if (search) { search.focus(); }
    }
    // Press Escape to blur search
    if (e.key === 'Escape') {
        const search = document.getElementById('searchInput');
        if (search) search.blur();
    }
});

// Back to top button
window.addEventListener('scroll', () => {
    const btn = document.getElementById('backToTop');
    if (btn) btn.style.display = window.scrollY > 400 ? 'flex' : 'none';
});