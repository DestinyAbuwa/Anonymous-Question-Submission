document.addEventListener('DOMContentLoaded', () => {
    // 1. Check who is logged in
    const userRole = localStorage.getItem('userRole');
    const userId = localStorage.getItem('userId');

    // If they aren't logged in, kick them back to the login page!
    if (!userRole || !userId) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Personalize the welcome message
    document.getElementById('welcome-message').textContent = `Welcome back, ${userRole}!`;

    // 3. For now, we will hardcode a single test class (CS 101) 
    // Later, we will fetch this list from the database based on their Enrollments!
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

    // 4. THE SMART ROUTER: Where do they go when they click the card?
    card.addEventListener('click', () => {
        if (userRole === 'Instructor') {
            window.location.href = 'instructor.html'; // Send teachers to the moderation view
        } else {
            window.location.href = 'student.html'; // Send students to the Q&A view
        }
    });

    classGrid.appendChild(card);
});

// (You should also copy your Dark Mode and Logout logic from script.js into this file later so the navbar works here too!)