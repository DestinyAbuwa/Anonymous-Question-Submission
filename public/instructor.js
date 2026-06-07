// Wrap our fetching logic into a reusable function
async function fetchQuestions() {
    const container = document.getElementById('questions-container');

    try {
        // Fetch questions for Session 1 (our test session)
        const response = await fetch('/api/questions/1');
        const questions = await response.json();

        // If no questions exist, show a friendly message and exit the function
        if (questions.length === 0) {
            container.innerHTML = '<p class="subtitle">No questions have been asked yet.</p>';
            return;
        }

        // Clear out the old HTML before we draw the new updated list
        container.innerHTML = '';

        // Loop through the data and build the cards
        questions.forEach(q => {
            const card = document.createElement('div');
            card.className = 'question-card';

            // 1. Convert the timestamp
            const timeString = new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // 2. Build the HTML for potentially multiple tags
            let tagsHTML = '';
            if (q.tags) {
                const tagsArray = q.tags.split(',');
                tagsArray.forEach(tag => {
                    // Reusing the same data-tag attribute so your new CSS colors apply!
                    tagsHTML += `<span class="tag-badge" data-tag="${tag}">${tag}</span> `;
                });
            }

            // 3. Inject the upvotes, tags, and the new 'Mark Answered' button
            card.innerHTML = `
                <div class="question-header">
                    <div>
                        <span class="timestamp">${timeString}</span>
                        <span style="color: #3498db; font-weight: bold; margin-left: 15px;">▲ ${q.upvotes || 0}</span>
                    </div>
                    <div>
                        ${tagsHTML}
                    </div>
                </div>
                <div class="question-content" style="margin-bottom: 15px;">
                    ${q.content}
                </div>
                
                <button class="mark-answered-btn" onclick="markAsAnswered(${q.question_id})">
                    ✅ Mark as Answered
                </button>
            `;

            container.appendChild(card);
        });

    } catch (error) {
        console.error("Failed to load questions:", error);
        // Only show the error if the container is currently empty (so we don't erase existing questions on a brief network blip)
        if (container.innerHTML === '' || container.innerHTML.includes('Loading')) {
            container.innerHTML = '<p style="color: #e74c3c;">❌ Failed to load questions from the server.</p>';
        }
    }
}

// The Kitchen Ticket: Tell the backend to update the status to 'Answered'
async function markAsAnswered(questionId) {
    try {
        const response = await fetch(`/api/questions/${questionId}/answer`, {
            method: 'PATCH'
        });

        if (response.ok) {
            // Immediately reload the dashboard so the answered question disappears!
            fetchQuestions();
        }
    } catch (error) {
        console.error("Error marking as answered:", error);
    }
}

// 1. Fetch Dynamic Class Details (Removes the hardcoded CS 101)
async function loadClassDetails() {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/classes/${classId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const classData = await response.json();
        document.getElementById('class-title').textContent = classData.class_name;
        document.getElementById('class-join-code').textContent = `Join Code: ${classData.join_code}`;
    }
}

// 2. Start a Live Session
async function startSession() {
    const sessionName = document.getElementById('session-name-input').value;
    const token = localStorage.getItem('token');

    if (!sessionName) return alert('Please enter a session name.');

    const response = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ class_id: classId, session_name: sessionName })
    });

    if (response.ok) {
        const data = await response.json();
        activeSessionId = data.session_id;
        
        // Update UI
        document.getElementById('start-session-panel').style.display = 'none';
        document.getElementById('active-session-panel').style.display = 'block';
        document.getElementById('current-session-name').textContent = sessionName;
        document.getElementById('questions-container').innerHTML = '<p class="subtitle">Waiting for questions...</p>';
    } else {
        alert('Failed to start session.');
    }
}

// 3. End a Live Session
async function endSession() {
    if (!activeSessionId) return;
    const token = localStorage.getItem('token');

    const response = await fetch(`/api/sessions/${activeSessionId}/end`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        activeSessionId = null;
        
        // Reset UI
        document.getElementById('start-session-panel').style.display = 'flex';
        document.getElementById('active-session-panel').style.display = 'none';
        document.getElementById('session-name-input').value = '';
        document.getElementById('questions-container').innerHTML = '<p class="subtitle">Session closed. Start a new session to receive questions.</p>';
        alert('Session closed. Students can no longer submit questions.');
    }
}

// 4. Schedule a Future Session
async function scheduleSession() {
    const sessionName = document.getElementById('session-name-input').value;
    const startTime = document.getElementById('session-time-input').value;
    const token = localStorage.getItem('token');

    if (!sessionName || !startTime) return alert('Please enter a name and select a time to schedule.');

    const response = await fetch('/api/sessions/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ class_id: classId, session_name: sessionName, start_time: startTime })
    });

    if (response.ok) {
        alert(`Session "${sessionName}" successfully scheduled!`);
        document.getElementById('session-name-input').value = '';
        document.getElementById('session-time-input').value = '';
    } else {
        alert('Failed to schedule session.');
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'auth.html';
}

// Extract the classId from the URL (e.g., instructor.html?classId=5)
const urlParams = new URLSearchParams(window.location.search);
const classId = urlParams.get('classId');
let activeSessionId = null;

// 1. Run it immediately when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('role');
    const token = localStorage.getItem('token');

    if (!token || !role || role !== 'instructor') {
        window.location.href = 'auth.html';
        return;
    }

    if (!classId) {
        alert("No class selected!");
        window.location.href = 'instructor-home.html';
        return;
    }

    loadClassDetails();
    
    fetchQuestions();

    // 2. Set the timer to run the exact same function every 5000 milliseconds (5 seconds)
    setInterval(fetchQuestions, 5000);
});