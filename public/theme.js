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
    window.location.href = 'index.html';
}

// ==========================================
// GLOBAL UI COMPONENTS (PHASE 5)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Inject the loading bar and toast container into the page automatically
    document.body.insertAdjacentHTML('beforeend', `
        <div id="top-loader"></div>
        <div id="toast-container"></div>
    `);
});

// Toast Notification Engine
window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    let icon = '💡';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    
    container.appendChild(toast);
    
    // Automatically dismiss after 3.5 seconds
    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3500);
};

// Animated Network Loading Bar
window.startLoader = function() {
    const loader = document.getElementById('top-loader');
    if (loader) { 
        loader.style.opacity = '1'; 
        loader.style.width = '60%'; 
    }
};

window.stopLoader = function() {
    const loader = document.getElementById('top-loader');
    if (loader) {
        loader.style.width = '100%';
        setTimeout(() => { 
            loader.style.opacity = '0'; 
            setTimeout(() => { loader.style.width = '0'; }, 400); // Reset after fade
        }, 300);
    }
};