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

// 1. Update loadClasses() to use the Loader and Skeletons
async function loadClasses() {
    const grid = document.getElementById('class-grid');
    // Show skeleton loaders before the data arrives
    grid.innerHTML = '<div class="skeleton-box"></div><div class="skeleton-box"></div>';
    
    startLoader(); // Start the top progress bar

    const token = localStorage.getItem('token');
    const response = await fetch('/api/my-classes', {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const classes = await response.json();
        renderClasses(classes);
    } else {
        showToast('Failed to load classes.', 'error');
        grid.innerHTML = '';
    }
    
    stopLoader(); // Finish the progress bar
}

// 2. Update renderClasses() to use the Modern Empty State
function renderClasses(classes) {
    const grid = document.getElementById('class-grid');
    grid.innerHTML = ''; 

    if (classes.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <span>📭</span>
                <h3>No classes yet</h3>
                <p>Create a class to generate a join code for your students.</p>
            </div>`;
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