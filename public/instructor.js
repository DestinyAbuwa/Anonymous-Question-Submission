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

// Update the live viewer count
socket.on('participantCount', (count) => {
    const badge = document.getElementById('live-count-badge');
    const countText = document.getElementById('participant-count');
    if (badge && countText) {
        badge.style.display = 'inline-flex';
        countText.textContent = count;
    }
});

// Relative time formatting
function timeAgo(dateInput) {
    const date = new Date(dateInput);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return "Just now";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return date.toLocaleDateString();
}

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
            container.innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 15px auto; display: block; opacity: 0.5;"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    <h3>Waiting for questions...</h3>
                </div>`;
            return;
        }

        container.innerHTML = '';
        questions.forEach(q => {
            const card = document.createElement('div');
            card.className = `question-card ${q.is_pinned ? 'pinned' : ''}`;
            const timeString = timeAgo(q.timestamp);

            let tagsHTML = '';
            if (q.tags) {
                q.tags.split(',').forEach(tag => {
                    tagsHTML += `<span class="tag-badge" data-tag="${tag}" style="cursor: pointer;" onclick="setTagFilter('${tag}')">${tag}</span> `;
                });
            }

            const isLive = q.status === 'Displayed';
            const liveBadge = isLive ? `<div class="live-badge">Answering Live</div>` : '';

            // Notice the new SVG icons inside the buttons and header!
            card.innerHTML = `
                <div class="question-header">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        ${q.is_pinned ? '<span style="color:#f39c12; font-weight:bold; display: flex; align-items: center; gap: 5px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.6V6a3 3 0 0 0-6 0v4.6a2 2 0 0 1-1.11 1.95l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg> Pinned</span>' : ''}
                        <span class="timestamp">${timeString}</span>
                        <span style="color: var(--primary-brand); font-weight: bold; display: flex; align-items: center; gap: 4px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg> 
                            ${q.upvotes || 0}
                        </span>
                    </div>
                    <div>${tagsHTML}</div>
                </div>
                <div class="question-content" style="margin-bottom: 15px;">
                    ${liveBadge} ${q.content}
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="mark-answered-btn" onclick="markAsAnswered(${q.question_id})" style="display: flex; align-items: center; gap: 6px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Answered
                    </button>
                    <button class="action-btn ${isLive ? 'active-live' : ''}" onclick="toggleLive(${q.question_id}, '${isLive ? 'Pending' : 'Displayed'}')" style="display: flex; align-items: center; gap: 6px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                        ${isLive ? 'Stop Live' : 'Answer Live'}
                    </button>
                    <button class="action-btn" onclick="togglePin(${q.question_id})" style="display: flex; align-items: center; gap: 6px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.6V6a3 3 0 0 0-6 0v4.6a2 2 0 0 1-1.11 1.95l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                        ${q.is_pinned ? 'Unpin' : 'Pin'}
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