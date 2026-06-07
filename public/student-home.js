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
    loadEnrolledClasses(); // Load the cards immediately!
});

async function loadEnrolledClasses() {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/enrolled-classes', {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const classes = await response.json();
        renderClasses(classes);
    }
}

function renderClasses(classes) {
    const grid = document.getElementById('class-grid');
    grid.innerHTML = '';

    if (classes.length === 0) {
        grid.innerHTML = '<p style="color: #7f8c8d;">You haven\'t joined any classes yet.</p>';
        return;
    }

    classes.forEach(c => {
        const card = document.createElement('div');
        card.className = 'class-card';
        card.onclick = () => window.location.href = `student.html?classId=${c.class_id}`;
        card.innerHTML = `
            <div class="class-card-header">
                <h3>${c.class_name}</h3>
            </div>
            <div class="class-card-body">
                <p>Instructor ID: ${c.instructor_id}</p>
                <div class="join-code-badge">Joined</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function showJoinModal() { document.getElementById('join-class-modal').style.display = 'flex'; }
function hideJoinModal() { document.getElementById('join-class-modal').style.display = 'none'; }
function logout() { localStorage.clear(); window.location.href = 'auth.html'; }

async function handleJoinClass() {
    const codeInput = document.getElementById('join-code-input');
    const token = localStorage.getItem('token');

    if (!codeInput.value) return alert('Please enter a join code.');

    const response = await fetch('/api/join-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ join_code: codeInput.value.toUpperCase() })
    });

    if (response.ok) {
        hideJoinModal();
        codeInput.value = '';
        loadEnrolledClasses(); // Paints the newly joined class instantly!
    } else {
        const data = await response.json();
        alert(data.error || 'Error joining class.');
    }
}

