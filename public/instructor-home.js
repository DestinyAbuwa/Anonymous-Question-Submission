document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('role');
    const token = localStorage.getItem('token');

    // 1. Basic Auth Guard
    if (!token || !role) {
        window.location.href = 'auth.html';
        return;
    }

    // 2. Role Enforcement (If they are a student, send them to the correct hub)
    if (role === 'student') {
        window.location.href = 'student-home.html';
        return;
    }

    // Now you can safely write Instructor-only code here
    document.getElementById('welcome-message').textContent = `Welcome, Instructor!`;
    loadClasses(); // Load the cards immediately!
});

// Fetch and render classes
async function loadClasses() {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/my-classes', {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const classes = await response.json();
        renderClasses(classes);
    }
}

// Build the UI
function renderClasses(classes) {
    const grid = document.getElementById('class-grid');
    grid.innerHTML = ''; // Clear out the hardcoded stuff

    if (classes.length === 0) {
        grid.innerHTML = '<p style="color: #7f8c8d;">You haven\'t created any classes yet.</p>';
        return;
    }

    classes.forEach(c => {
        const card = document.createElement('div');
        card.className = 'class-card';
        card.onclick = () => window.location.href = `instructor.html?classId=${c.class_id}`;
        card.innerHTML = `
            <div class="class-card-header">
                <h3>${c.class_name}</h3>
            </div>
            <div class="class-card-body">
                <p>Status: <span style="color:#27ae60; font-weight:bold;">Active</span></p>
                <div class="join-code-badge">Code: ${c.join_code}</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Modal Logic
function showCreateModal() { document.getElementById('create-class-modal').style.display = 'flex'; }
function hideCreateModal() { document.getElementById('create-class-modal').style.display = 'none'; }


// Create logic (Auto-refreshes the grid without reloading the page!)
async function handleCreateClass() {
    const nameInput = document.getElementById('class-name-input');
    const token = localStorage.getItem('token');

    if (!nameInput.value) return alert('Please enter a class name.');

    const response = await fetch('/api/create-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ class_name: nameInput.value })
    });

    if (response.ok) {
        hideCreateModal();
        nameInput.value = ''; // Clear the input
        loadClasses(); // Re-fetch the database and paint the new card instantly!
    } else {
        alert('Error creating class.');
    }
}