document.addEventListener('DOMContentLoaded', () => {
    // 1. Check for the EXACT keys we saved during login ('token' and 'role')
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    // If either the badge or the role is missing, kick them back to auth!
    if (!token || !role) {
        window.location.href = 'auth.html';
        return;
    }

    // 2. Personalize the welcome message
    document.getElementById('welcome-message').textContent = `Welcome back, ${role}!`;

    // 3. Hardcoded test class
    const classGrid = document.getElementById('class-grid');

    const card = document.createElement('div');
    card.className = 'class-card';
    card.innerHTML = `
        <div class="class-card-header"></div>
        <div class="class-card-body">
            <h3>CS 101: Intro to Programming</h3>
            <p>Session: Week 1 - Variables and Loops</p>
        </div>
    `;

    // 4. THE SMART ROUTER
    card.addEventListener('click', () => {
        if (role === 'Instructor') {
            window.location.href = 'instructor.html';
        } else {
            window.location.href = 'student.html';
        }
    });

    classGrid.appendChild(card);
});