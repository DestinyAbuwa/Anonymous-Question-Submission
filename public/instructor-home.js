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
});

// ... keep your DOMContentLoaded code ...

// Logout helper (needed because your HTML calls this)
function logout() {
    localStorage.clear();
    window.location.href = 'auth.html';
}


// --- Modal Logic ---
function showCreateModal() {
    document.getElementById('create-class-modal').style.display = 'flex';
}

function hideCreateModal() {
    document.getElementById('create-class-modal').style.display = 'none';
}

// --- Create Class Logic ---
async function handleCreateClass() {
    const name = document.getElementById('class-name-input').value;
    const token = localStorage.getItem('token');

    if (!name) return alert('Please enter a class name.');

    const response = await fetch('/api/create-class', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ class_name: name })
    });

    if (response.ok) {
        alert('Class created successfully!');
        hideCreateModal();
        location.reload(); // Refresh the page to show the new class
    } else {
        alert('Error creating class.');
    }
}

