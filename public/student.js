let currentSessionId = null;
const urlParams = new URLSearchParams(window.location.search);
const classId = urlParams.get('classId');
const socket = io();

// Whenever the server yells 'updateFeed', instantly reload our feed!
socket.on('updateFeed', () => {
    if (currentSessionId) loadStudentFeed();
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
    loadClassDetails();
    checkActiveSession();
});

async function loadClassDetails() {
    if (!classId) return;
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/classes/${classId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
        const classData = await response.json();
        document.getElementById('class-title').textContent = classData.class_name;
    }
}

async function checkActiveSession() {
    if (!classId) return;
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`/api/classes/${classId}/active-session`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const questionText = document.getElementById('question-text');
        const submitBtn = document.getElementById('submit-question-btn');
        const sessionInfo = document.getElementById('session-info');

        if (response.ok) {
            const data = await response.json();
            if (data.active) {
                currentSessionId = data.session.session_id;
                socket.emit('joinSession', currentSessionId);
                if (questionText) questionText.disabled = false;
                if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; }
                if (sessionInfo) {
                    sessionInfo.innerHTML = `🟢 Live Session: <strong>${data.session.session_name}</strong>`;
                    sessionInfo.style.color = '#27ae60';
                }
                loadStudentFeed(); // Load feed once session is active
            } else {
                currentSessionId = null;
                if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.5'; }
                if (sessionInfo) {
                    sessionInfo.textContent = "No active session.";
                    sessionInfo.style.color = '#e74c3c';
                }
            }
        }
    } catch (error) { console.error("Session check failed"); }
}

let selectedTags = [];
document.querySelectorAll('.tag-toggle').forEach(button => {
    button.addEventListener('click', () => {
        button.classList.toggle('selected');
        const tag = button.getAttribute('data-value');
        if (selectedTags.includes(tag)) {
            selectedTags = selectedTags.filter(t => t !== tag);
        } else {
            selectedTags.push(tag);
        }
    });
});


async function loadStudentFeed() {
    const container = document.getElementById('student-feed-container');
    if (!currentSessionId) return;

    try {
        const sortMode = document.getElementById('feed-sort-toggle')?.value || 'upvotes';
        const response = await fetch(`/api/questions/${currentSessionId}?sort=${sortMode}`);
        const questions = await response.json();

        if (questions.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 20px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 15px auto; display: block; opacity: 0.5;"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    <p>No questions yet. Be the first to ask!</p>
                </div>`;
            return;
        }

        container.innerHTML = '';
        questions.forEach(q => {
            const card = document.createElement('div');
            card.className = `feed-card ${q.is_pinned ? 'pinned' : ''}`;

            let tagsHTML = '';
            if (q.tags) {
                q.tags.split(',').forEach(tag => {
                    tagsHTML += `<span class="tag-badge" data-tag="${tag}">${tag}</span> `;
                });
            }

            const isLive = q.status === 'Displayed';
            const liveBadge = isLive ? `<div class="live-badge">Answering Live</div>` : '';
            const pinIcon = q.is_pinned ? `<span style="color:#f39c12; margin-right:5px; display:inline-flex; align-items:center;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.6V6a3 3 0 0 0-6 0v4.6a2 2 0 0 1-1.11 1.95l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg></span>` : '';

            card.innerHTML = `
                <div class="upvote-column">
                    <button class="upvote-btn" onclick="handleUpvote(${q.question_id})" style="display:flex; justify-content:center; align-items:center;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                    </button>
                    <span class="upvote-count">${q.upvotes || 0}</span>
                </div>
                <div class="question-body">
                    <div>${pinIcon} ${tagsHTML}</div>
                    <div class="question-content">${liveBadge} ${q.content}</div>
                    <div style="font-size: 0.8em; color: var(--muted-text); margin-top:5px;">${timeAgo(q.timestamp)}</div>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (error) { showToast("Failed to sync feed.", "error"); }
}

async function handleUpvote(questionId) {
    const token = localStorage.getItem('token');
    try {
        await fetch(`/api/questions/${questionId}/upvote`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadStudentFeed();
    } catch (error) { showToast("Error processing upvote.", "error"); }
}

document.getElementById('question-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = document.getElementById('question-text').value;
    const token = localStorage.getItem('token');
    const response = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ session_id: currentSessionId, content, tags: selectedTags })
    });
    if (response.ok) {
        document.getElementById('question-text').value = '';
        selectedTags = [];
        showToast("Question submitted!", "success");
    }
});

document.getElementById('feed-sort-toggle')?.addEventListener('change', loadStudentFeed);