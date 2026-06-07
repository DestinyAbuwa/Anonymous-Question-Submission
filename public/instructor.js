const urlParams = new URLSearchParams(window.location.search);
const classId = urlParams.get('classId');
let activeSessionId = null;

document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('role');
    const token = localStorage.getItem('token');

    if (!token || !role || role !== 'instructor') return window.location.href = 'auth.html';
    
    if (!classId) {
        showToast("No class selected!", "error");
        setTimeout(() => window.location.href = 'instructor-home.html', 1500);
        return;
    }

    loadClassDetails();
    fetchQuestions();
    setInterval(fetchQuestions, 5000);
});

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

async function fetchQuestions() {
    const container = document.getElementById('questions-container');
    if (!activeSessionId) return; // Don't fetch if no session is running

    try {
        const response = await fetch(`/api/questions/${activeSessionId}`);
        const questions = await response.json();

        if (questions.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 20px;">
                    <span>📭</span>
                    <h3>Waiting for questions...</h3>
                </div>`;
            return;
        }

        container.innerHTML = '';
        questions.forEach(q => {
            const card = document.createElement('div');
            card.className = 'question-card';
            const timeString = new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            let tagsHTML = '';
            if (q.tags) {
                q.tags.split(',').forEach(tag => {
                    tagsHTML += `<span class="tag-badge" data-tag="${tag}">${tag}</span> `;
                });
            }

            card.innerHTML = `
                <div class="question-header">
                    <div>
                        <span class="timestamp">${timeString}</span>
                        <span style="color: #3498db; font-weight: bold; margin-left: 15px;">▲ ${q.upvotes || 0}</span>
                    </div>
                    <div>${tagsHTML}</div>
                </div>
                <div class="question-content" style="margin-bottom: 15px;">${q.content}</div>
                <button class="mark-answered-btn" onclick="markAsAnswered(${q.question_id})">✅ Mark as Answered</button>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        if (container.innerHTML === '' || container.innerHTML.includes('Waiting')) {
            showToast("Failed to sync questions.", "error");
        }
    }
}

async function markAsAnswered(questionId) {
    startLoader();
    try {
        const response = await fetch(`/api/questions/${questionId}/answer`, { method: 'PATCH' });
        if (response.ok) {
            showToast("Question marked answered!", "success");
            fetchQuestions();
        }
    } catch (error) {
        showToast("Error updating question.", "error");
    }
    stopLoader();
}

async function startSession() {
    const sessionName = document.getElementById('session-name-input').value;
    const token = localStorage.getItem('token');

    if (!sessionName) return showToast('Please enter a session name.', "error");

    startLoader();
    const response = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ class_id: classId, session_name: sessionName })
    });

    if (response.ok) {
        const data = await response.json();
        activeSessionId = data.session_id;
        
        document.getElementById('start-session-panel').style.display = 'none';
        document.getElementById('active-session-panel').style.display = 'block';
        document.getElementById('current-session-name').textContent = sessionName;
        document.getElementById('questions-container').innerHTML = '<p class="subtitle">Waiting for questions...</p>';
        showToast("Live session started!", "success");
        fetchQuestions(); // Pull any immediate questions
    } else {
        showToast('Failed to start session.', "error");
    }
    stopLoader();
}

async function endSession() {
    if (!activeSessionId) return;
    const token = localStorage.getItem('token');

    startLoader();
    const response = await fetch(`/api/sessions/${activeSessionId}/end`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        activeSessionId = null;
        document.getElementById('start-session-panel').style.display = 'flex';
        document.getElementById('active-session-panel').style.display = 'none';
        document.getElementById('session-name-input').value = '';
        document.getElementById('questions-container').innerHTML = '<p class="subtitle">Session closed. Start a new session to receive questions.</p>';
        showToast('Session closed. Submissions paused.', "info");
    }
    stopLoader();
}

async function scheduleSession() {
    const sessionName = document.getElementById('session-name-input').value;
    const startTime = document.getElementById('session-time-input').value;
    const token = localStorage.getItem('token');

    if (!sessionName || !startTime) return showToast('Please enter a name and time.', "error");

    startLoader();
    const response = await fetch('/api/sessions/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ class_id: classId, session_name: sessionName, start_time: startTime })
    });

    if (response.ok) {
        showToast(`Session "${sessionName}" scheduled!`, "success");
        document.getElementById('session-name-input').value = '';
        document.getElementById('session-time-input').value = '';
    } else {
        showToast('Failed to schedule session.', "error");
    }
    stopLoader();
}