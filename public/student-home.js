document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('role');
    const token = localStorage.getItem('token');

    // 1. Basic Auth Guard
    if (!token || !role) {
        window.location.href = 'auth.html';
        return;
    }

    // 2. Role Enforcement (If they are an instructor, send them to the correct hub)
    if (role === 'instructor') {
        window.location.href = 'instructor-home.html';
        return;
    }

    // Now you can safely write Student-only code here
    document.getElementById('welcome-message').textContent = `Welcome, Student!`;
});

// Inside student-home.js
async function joinClass(joinCode) {
    const userId = localStorage.getItem('userId'); 

    const response = await fetch('/api/join-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            user_id: userId, 
            join_code: joinCode 
        })
    });
    // The backend will handle inserting into the Enrollments table
}


