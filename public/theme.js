// ==========================================
// SVG ICONS
// ==========================================
const THEME_ICON_MOON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>`;
const THEME_ICON_SUN = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;

// ==========================================
// THEME LOGIC
// ==========================================
function applyTheme(theme) {
    // Apply the data-theme attribute to the root HTML tag so your CSS buckets update
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    const themeToggleButton = document.getElementById('theme-toggle');
    if (themeToggleButton) {
        // Swap the icon to show what the next click will do
        themeToggleButton.innerHTML = theme === 'dark' ? THEME_ICON_SUN : THEME_ICON_MOON;
    }
}

// Check storage immediately to prevent a white flash on load
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

// Wait for the HTML to load, then attach the listener to the button
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(savedTheme); // Sets the correct initial SVG

    const themeToggleButton = document.getElementById('theme-toggle');
    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
        });
    }
});

// ==========================================
// GLOBAL LOGOUT FUNCTION
// ==========================================
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = 'auth.html';
}