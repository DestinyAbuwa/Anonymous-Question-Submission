document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('role');
    const token = localStorage.getItem('token');

    if (!token || !role) return window.location.href = 'auth.html';
    if (role === 'instructor') return window.location.href = 'instructor-home.html';

    document.getElementById('welcome-message').textContent = `Welcome, Student!`;
    loadEnrolledClasses();
});

async function loadEnrolledClasses() {
    const grid = document.getElementById('class-grid');
    // Show skeletons while fetching
    grid.innerHTML = '<div class="skeleton-box"></div><div class="skeleton-box"></div>';
    startLoader();

    const token = localStorage.getItem('token');
    const response = await fetch('/api/enrolled-classes', {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const classes = await response.json();
        renderClasses(classes);
    } else {
        showToast("Failed to load classes.", "error");
        grid.innerHTML = '';
    }
    stopLoader();
}

function renderClasses(classes) {
    const grid = document.getElementById('class-grid');
    grid.innerHTML = '';

    if (classes.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <span>🎓</span>
                <h3>No classes yet</h3>
                <p>Click "+ Join Class" and enter your instructor's code.</p>
            </div>`;
        return;
    }

    classes.forEach(c => {
        const card = document.createElement('div');
        card.className = 'class-card';
        card.onclick = () => window.location.href = `student.html?classId=${c.class_id}`;
        card.innerHTML = `
            <div class="class-card-header"><h3>${c.class_name}</h3></div>
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

async function handleJoinClass() {
    const codeInput = document.getElementById('join-code-input');
    const token = localStorage.getItem('token');

    if (!codeInput.value) return showToast('Please enter a join code.', 'error');

    startLoader();
    const response = await fetch('/api/join-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ join_code: codeInput.value.toUpperCase() })
    });

    if (response.ok) {
        hideJoinModal();
        codeInput.value = '';
        loadEnrolledClasses();
        showToast("Successfully joined class!", "success");
    } else {
        const data = await response.json();
        showToast(data.error || 'Error joining class.', "error");
    }
    stopLoader();
}