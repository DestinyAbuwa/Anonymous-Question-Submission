document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('role'); // This is now guaranteed lowercase
    const token = localStorage.getItem('token');

    // If no token, redirect to login
    if (!token || !role) {
        window.location.href = 'auth.html';
        return;
    }

    // Role-specific landing page protection
    const path = window.location.pathname;
    
    // If an instructor is on the student page, bounce them to the instructor page
    if (path.includes('student-home.html') && role === 'instructor') {
        window.location.href = 'instructor-home.html';
        return;
    }
    
    // If a student is on the instructor page, bounce them to the student page
    if (path.includes('instructor-home.html') && role === 'student') {
        window.location.href = 'student-home.html';
        return;
    }

    // Welcome message
    const welcomeMsg = document.getElementById('welcome-message');
    if (welcomeMsg) {
        welcomeMsg.textContent = `Welcome back, ${role.charAt(0).toUpperCase() + role.slice(1)}!`;
    }
});