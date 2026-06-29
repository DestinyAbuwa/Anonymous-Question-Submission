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

// NEW: Listen for the Cron Job to Auto-Start a session
socket.on('sessionAutoStarted', (startedClassId) => {
    // If the session that just started belongs to the class we are currently looking at...
    if (String(startedClassId) === String(classId)) {
        showToast("Scheduled session is starting!", "success");
        setTimeout(() => {
            window.location.reload(); // Magically refresh the page to show the Live UI!
        }, 1500);
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

// Avatar Color & SVG Generator
function getAvatar(id) {
    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#d35400', '#34495e'];
    const color = colors[id % colors.length];

    // Clean Lucide User Silhouette SVG
    const userSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

    return `<div class="avatar" style="background-color: ${color};">${userSvg}</div>`;
}

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
    loadSchedules(); // Add this!
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

    // Skeletons only trigger if the container is empty or showing the default waiting state
    if (container.innerHTML === '' || container.innerHTML.includes('Start a Session') || container.innerHTML.includes('Waiting')) {
        container.innerHTML = `
            <div class="skeleton-box" style="height: 120px; margin-bottom: 15px;"></div>
            <div class="skeleton-box" style="height: 120px; margin-bottom: 15px; opacity: 0.7;"></div>
            <div class="skeleton-box" style="height: 120px; margin-bottom: 15px; opacity: 0.4;"></div>
        `;
    }

    try {
        const sortMode = document.getElementById('feed-sort-toggle') ? document.getElementById('feed-sort-toggle').value : 'upvotes';
        const response = await fetch(`/api/questions/${activeSessionId}?sort=${sortMode}`);
        let questions = await response.json();

        if (currentTagFilter) {
            questions = questions.filter(q => q.tags && q.tags.includes(currentTagFilter));
        }

        if (questions.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 15px auto; display: block; opacity: 0.3; color: var(--muted-text);"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    <h3 style="color: var(--heading-color); margin-bottom: 5px;">Waiting for questions...</h3>
                    <p style="color: var(--muted-text); font-size: 0.95em;">Questions will appear here as soon as students submit them.</p>
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

            // Unified Blue "Live" Badge instead of harsh red/green
            const liveBadge = isLive ? `<span style="background: rgba(52, 152, 219, 0.1); color: var(--primary-brand); border: 1px solid rgba(52, 152, 219, 0.2); padding: 4px 10px; border-radius: 20px; font-size: 0.8em; font-weight: bold; display: inline-flex; align-items: center; gap: 6px; margin-right: 10px;"><span style="display: inline-block; width: 8px; height: 8px; background: var(--primary-brand); border-radius: 50%; animation: pulse 1.5s infinite;"></span> Answering Live</span>` : '';

            card.innerHTML = `
                <div class="question-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; flex-wrap: wrap; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        ${getAvatar(q.question_id)}
                        ${q.is_pinned ? '<span style="color:#f39c12; font-weight:bold; display: flex; align-items: center; gap: 5px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.6V6a3 3 0 0 0-6 0v4.6a2 2 0 0 1-1.11 1.95l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg> Pinned</span>' : ''}
                        <span style="font-size: 0.85em; color: var(--muted-text); font-weight: 500;">${timeString}</span>
                        <span style="color: var(--primary-brand); font-weight: bold; display: flex; align-items: center; gap: 4px; margin-left: 5px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg> 
                            ${q.upvotes || 0}
                        </span>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end;">
                        ${tagsHTML}
                    </div>
                </div>
                <div class="question-content" style="margin-bottom: 15px; line-height: 1.5;">
                    ${liveBadge} ${q.content}
                </div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="mark-answered-btn" onclick="markAsAnswered(${q.question_id})" style="display: flex; align-items: center; gap: 6px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Answered
                    </button>
                    <button class="action-btn" onclick="toggleLive(${q.question_id}, '${isLive ? 'Pending' : 'Displayed'}')" style="display: flex; align-items: center; gap: 6px; ${isLive ? 'background: rgba(52, 152, 219, 0.1); color: var(--primary-brand); border-color: var(--primary-brand);' : ''}">
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
        console.error(error); // Logs the actual error to your F12 console
        showToast("Failed to sync questions.", "error");
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
    let sessionName = document.getElementById('session-name-input').value;
    const token = localStorage.getItem('token');


    // NEW: If they left it blank, give it a default name!
    if (!sessionName) {
        sessionName = 'Live Session';
    }

    startLoader();
    const response = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ class_id: classId, session_name: sessionName })
    });

    if (response.ok) {
        const data = await response.json();
        activeSessionId = data.session_id;
        socket.emit('joinSession', activeSessionId);
        document.getElementById('start-session-panel').style.display = 'none';
        document.getElementById('active-session-panel').style.display = 'block';
        document.getElementById('current-session-name').textContent = sessionName;

        // Clear the container so the Skeletons trigger!
        document.getElementById('questions-container').innerHTML = '';

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

        // Inject the pristine Empty State
        document.getElementById('questions-container').innerHTML = `
            <div class="empty-state" style="padding: 40px 20px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 15px auto; display: block; opacity: 0.3; color: var(--muted-text);"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                <h3 style="color: var(--heading-color); margin-bottom: 5px;">Start a Session</h3>
                <p style="color: var(--muted-text); font-size: 0.95em;">Click 'Start Live' to open the floor to student questions.</p>
            </div>`;

        showToast('Session closed. Submissions paused.', "info");
    }
    stopLoader();
}

async function loadSchedules() {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/instructor/schedules', {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const schedules = await response.json();
        const container = document.getElementById('schedules-container');
        container.innerHTML = ''; // Clear existing

        if (schedules.length === 0) {
            container.innerHTML = '<p style="color: var(--muted-text);">No upcoming scheduled sessions.</p>';
            return;
        }

        schedules.forEach(s => {
            container.innerHTML += `
                <div style="background: var(--bg-color); padding: 10px; border-radius: 8px; margin-bottom: 5px; border-left: 4px solid var(--primary-brand);">
                    <strong>${s.session_name}</strong> - ${s.class_name}<br>
                    <small>Days: ${s.recurring_days} | Starts: ${s.start_time}</small>
                </div>
            `;
        });
    }
}

async function scheduleSession() {
    let sessionName = document.getElementById('session-name-input').value;
    const startTime = document.getElementById('session-start-time').value;
    const endTime = document.getElementById('session-end-time').value;

    // NEW: Default name for scheduling too
    if (!sessionName) {
        sessionName = 'Scheduled Session';
    }


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


