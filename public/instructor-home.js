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
    loadClasses(); // Load the cards with active session indicators
});

// 1. Load classes and fetch active sessions to enrich them
async function loadClasses() {
    const grid = document.getElementById('class-grid');
    // Show skeleton loaders before the data arrives
    grid.innerHTML = '<div class="skeleton-box"></div><div class="skeleton-box"></div>';

    startLoader(); // Start the top progress bar

    const token = localStorage.getItem('token');

    try {
        // Fetch classes
        const classResponse = await fetch('/api/my-classes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!classResponse.ok) {
            showToast('Failed to load classes.', 'error');
            grid.innerHTML = '';
            stopLoader();
            return;
        }

        const classes = await classResponse.json();

        // Fetch active sessions
        let activeSessions = [];
        try {
            const sessionsResponse = await fetch('/api/instructor/active-sessions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (sessionsResponse.ok) {
                activeSessions = await sessionsResponse.json();
            }
        } catch (error) {
            console.error('Error fetching active sessions:', error);
        }

        // Build a map of class_id -> active session for quick lookup
        const activeSessionMap = {};
        activeSessions.forEach(session => {
            activeSessionMap[session.class_id] = session;
        });

        renderClasses(classes, activeSessionMap);
    } catch (error) {
        console.error('Error in loadClasses:', error);
        showToast('Failed to load classes.', 'error');
        grid.innerHTML = '';
    }

    stopLoader(); // Finish the progress bar
}

// 2. Render class cards with optional active session button
function renderClasses(classes, activeSessionMap = {}) {
    const grid = document.getElementById('class-grid');
    grid.innerHTML = '';

    if (classes.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <h3>No classes yet</h3>
                <p>Create a class to generate a join code for your students.</p>
            </div>`;
        return;
    }

    classes.forEach(c => {
        const card = document.createElement('div');
        card.className = 'class-card';

        const activeSession = activeSessionMap[c.class_id];

        // Build the card content
        let cardContent = `
            <div class="class-card-header">
                <h3>${c.class_name}</h3>
            </div>
            <div class="class-card-body">
                <div class="join-code-badge">Code: ${c.join_code}</div>
        `;

        // Add continue button if there's an active session
        if (activeSession) {
            cardContent += `
                <div class="active-session-card-banner">
                    <div class="active-session-text">
                        <span class="pulse-dot"></span>
                        LIVE: ${activeSession.session_name}
                    </div>
                    <button 
                        onclick="event.stopPropagation(); window.location.href = 'instructor.html?classId=${c.class_id}'"
                        class="submit-btn" style="padding: 10px; font-size: 0.95em;">
                        Continue Session &rarr;
                    </button>
                </div>
            `;
        } else {
            // Default click behavior for cards without active sessions
            card.onclick = () => window.location.href = `instructor.html?classId=${c.class_id}`;
        }

        cardContent += '</div>';
        card.innerHTML = cardContent;
        grid.appendChild(card);
    });
}

// Modal Logic
function showCreateModal() { document.getElementById('create-class-modal').style.display = 'flex'; }
function hideCreateModal() { document.getElementById('create-class-modal').style.display = 'none'; }

// Create logic (Auto-refreshes the grid without reloading the page!)
// 3. Update handleCreateClass() to use Toast Notifications instead of alerts
async function handleCreateClass() {
    const nameInput = document.getElementById('class-name-input');
    const token = localStorage.getItem('token');

    if (!nameInput.value) {
        return showToast('Please enter a class name.', 'error'); // No more alerts!
    }

    startLoader();

    const response = await fetch('/api/create-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ class_name: nameInput.value })
    });

    if (response.ok) {
        hideCreateModal();
        nameInput.value = '';
        loadClasses();
        showToast('Class created successfully!', 'success'); // Look at that UX!
    } else {
        showToast('Error creating class.', 'error');
    }

    stopLoader();
}