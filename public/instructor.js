const urlParams = new URLSearchParams(window.location.search);
const classId = urlParams.get('classId');
let activeSessionId = null;
let currentTagFilter = null;

// Initialize the Socket connection
const socket = io();

// Whenever a student submits or upvotes, instantly reload our feed!
socket.on('updateFeed', () => {
    if (activeSessionId) {
        fetchQuestions();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('role');
    const token = localStorage.getItem('token');

    if (!token || !role || role !== 'instructor') return window.location.href = 'auth.html';

    if (!classId) {
        showToast("No class selected!", "error");
        setTimeout(() => window.location.href = 'instructor-home.html', 1500);
        return;
    }

    document.querySelectorAll('#schedule-days .tag-toggle').forEach(btn => {
        btn.addEventListener('click', () => btn.classList.toggle('selected'));
    });

    loadClassDetails();
    recoverActiveSession();
    fetchQuestions();
});

// Click-to-Filter Logic
function setTagFilter(tag) {
    currentTagFilter = tag;
    document.getElementById('active-filters').style.display = 'block';

    const badge = document.getElementById('current-filter-badge');
    badge.textContent = tag;
    badge.setAttribute('data-tag', tag);

    fetchQuestions();
}

function clearTagFilter() {
    currentTagFilter = null;
    document.getElementById('active-filters').style.display = 'none';
    fetchQuestions();
}

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

async function recoverActiveSession() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`/api/classes/${classId}/active-session`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.active && data.session) {
                activeSessionId = data.session.session_id;
                socket.emit('joinSession', activeSessionId)
                document.getElementById('start-session-panel').style.display = 'none';
                document.getElementById('active-session-panel').style.display = 'block';
                document.getElementById('current-session-name').textContent = data.session.session_name;
                showToast(`Rejoined active session: ${data.session.session_name}`, "success");
                fetchQuestions();
            }
        }
    } catch (error) {
        console.error('Error recovering session:', error);
    }
}

async function fetchQuestions() {
    const container = document.getElementById('questions-container');
    if (!activeSessionId) return;

    try {
        const sortMode = document.getElementById('feed-sort-toggle') ? document.getElementById('feed-sort-toggle').value : 'upvotes';
        const response = await fetch(`/api/questions/${activeSessionId}?sort=${sortMode}`);
        let questions = await response.json();

        if (currentTagFilter) {
            questions = questions.filter(q => q.tags && q.tags.includes(currentTagFilter));
        }

        if (questions.length === 0) {
            container.innerHTML = `<div class="empty-state"><h3>Waiting for questions...</h3></div>`;
            return;
        }

        container.innerHTML = '';
        questions.forEach(q => {
            const card = document.createElement('div');
            card.className = `question-card ${q.is_pinned ? 'pinned' : ''}`;
            const timeString = new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            let tagsHTML = '';
            if (q.tags) {
                q.tags.split(',').forEach(tag => {
                    tagsHTML += `<span class="tag-badge" data-tag="${tag}" style="cursor: pointer;" onclick="setTagFilter('${tag}')">${tag}</span> `;
                });
            }

            const isLive = q.status === 'Displayed';
            const liveBadge = isLive ? `<div class="live-badge">Answering Live</div>` : '';

            card.innerHTML = `
                <div class="question-header">
                    <div>
                        ${q.is_pinned ? '<span style="color:#f39c12; font-weight:bold; margin-right:10px;">📌 Pinned</span>' : ''}
                        <span class="timestamp">${timeString}</span>
                        <span style="color: #3498db; font-weight: bold; margin-left: 15px;">▲ ${q.upvotes || 0}</span>
                    </div>
                    <div>${tagsHTML}</div>
                </div>
                <div class="question-content" style="margin-bottom: 15px;">
                    ${liveBadge} ${q.content}
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="mark-answered-btn" onclick="markAsAnswered(${q.question_id})">✅ Answered</button>
                    <button class="action-btn ${isLive ? 'active-live' : ''}" onclick="toggleLive(${q.question_id}, '${isLive ? 'Pending' : 'Displayed'}')">
                        ${isLive ? 'Stop Live' : '🎙️ Answer Live'}
                    </button>
                    <button class="action-btn" onclick="togglePin(${q.question_id})">
                        ${q.is_pinned ? 'Unpin' : '📌 Pin'}
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        if (container.innerHTML === '') showToast("Failed to sync questions.", "error");
    }
}

async function markAsAnswered(questionId) {
    startLoader();
    const token = localStorage.getItem('token'); // Grab the badge!
    try {
        const response = await fetch(`/api/questions/${questionId}/answer`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` } // Send the badge!
        });
        if (response.ok) {
            showToast("Question marked answered!", "success");
            fetchQuestions();
        } else {
            showToast("Failed to update question.", "error");
        }
    } catch (error) {
        showToast("Error communicating with server.", "error");
    }
    stopLoader();
}

async function toggleLive(questionId, newStatus) {
    const token = localStorage.getItem('token');
    await fetch(`/api/questions/${questionId}/live`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
    });
    fetchQuestions();
}

async function togglePin(questionId) {
    const token = localStorage.getItem('token');
    await fetch(`/api/questions/${questionId}/pin`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchQuestions();
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
        socket.emit('joinSession', activeSessionId)
        document.getElementById('start-session-panel').style.display = 'none';
        document.getElementById('active-session-panel').style.display = 'block';
        document.getElementById('current-session-name').textContent = sessionName;
        document.getElementById('questions-container').innerHTML = '<p class="subtitle">Waiting for questions...</p>';
        showToast("Live session started!", "success");
        fetchQuestions();
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
    const startTime = document.getElementById('session-start-time').value;
    const endTime = document.getElementById('session-end-time').value;

    let selectedDays = [];
    document.querySelectorAll('#schedule-days .tag-toggle.selected').forEach(btn => {
        selectedDays.push(btn.getAttribute('data-value'));
    });

    if (!sessionName || !startTime || !endTime || selectedDays.length === 0) {
        return showToast('Please enter a name, time, and select at least one day.', "error");
    }

    startLoader();
    const token = localStorage.getItem('token');
    const response = await fetch('/api/sessions/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            class_id: classId,
            session_name: sessionName,
            start_time: startTime,
            end_time: endTime,
            recurring_days: selectedDays.join(',')
        })
    });

    if (response.ok) {
        showToast(`Recurring schedule saved for ${selectedDays.join(', ')}!`, "success");
        document.getElementById('session-name-input').value = '';
        document.getElementById('session-start-time').value = '';
        document.getElementById('session-end-time').value = '';
        document.querySelectorAll('#schedule-days .tag-toggle').forEach(btn => btn.classList.remove('selected'));
    } else {
        showToast('Failed to save schedule.', "error");
    }
    stopLoader();
}

document.getElementById('feed-sort-toggle')?.addEventListener('change', fetchQuestions);