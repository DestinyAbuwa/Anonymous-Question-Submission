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
    loadClassDetails();
    checkActiveSession();
});

// Robust Character Counter & Enforcer
document.getElementById('question-text')?.addEventListener('input', function () {
    const maxLength = 250;
    // If the value is too long, cut it off at 250 characters
    if (this.value.length > maxLength) {
        this.value = this.value.substring(0, maxLength);
    }
    const count = this.value.length;
    document.getElementById('char-count').textContent = `${count} / 250`;
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

                // NEW: Premium Live Badge
                if (sessionInfo) {
                    sessionInfo.innerHTML = `
                        <span style=" margin-bottom: 10px; background: rgba(46, 204, 113, 0.1); color: #27ae60; border: 1px solid rgba(46, 204, 113, 0.2); padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;">
                            <span style="display: inline-block; width: 8px; height: 8px; background: #27ae60; border-radius: 50%; animation: pulse 1.5s infinite;"></span>
                            Live: ${data.session.session_name}
                        </span>`;
                    sessionInfo.style.color = ''; // Clears the old inline red/green color
                }
                loadStudentFeed(); // Load feed once session is active
            } else {
                currentSessionId = null;
                if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.5'; }

                // 1. Change the red text to a professional "Paused" badge
                if (sessionInfo) {
                    sessionInfo.innerHTML = `
                        <span style=" margin-bottom: 10px; background: var(--bg-color); color: var(--muted-text); border: 1px solid var(--border-color); padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/></svg> 
                            Session Paused
                        </span>`;
                }

                // 2. Inject a custom empty state into the feed container
                const feedContainer = document.getElementById('student-feed-container');
                if (feedContainer) {
                    feedContainer.innerHTML = `
                        <div class="empty-state" style="padding: 40px 20px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 15px auto; display: block; opacity: 0.3; color: var(--muted-text);"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                            <h3 style="color: var(--heading-color); margin-bottom: 5px;">Waiting for Instructor</h3>
                            <p style="color: var(--muted-text); font-size: 0.95em;">The live Q&A session hasn't started yet. Hang tight!</p>
                        </div>`;
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

    // NEW: Inject pulsing skeletons while we wait for the database!
    if (container.innerHTML === '' || container.innerHTML.includes('Waiting') || container.innerHTML.includes('Loading')) {
        container.innerHTML = `
            <div class="skeleton-box" style="height: 120px; margin-bottom: 15px;"></div>
            <div class="skeleton-box" style="height: 120px; margin-bottom: 15px; opacity: 0.7;"></div>
            <div class="skeleton-box" style="height: 120px; margin-bottom: 15px; opacity: 0.4;"></div>
        `;
    }

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
                    <!-- NEW: Structured Header for Avatar, Timestamp, and Tags -->
                    <div class="question-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            ${getAvatar(q.question_id)}
                            ${pinIcon}
                            <span style="font-size: 0.85em; color: var(--muted-text); font-weight: 500;">${timeAgo(q.timestamp)}</span>
                        </div>
                        <div>${tagsHTML}</div>
                    </div>
                    
                    <div class="question-content">${liveBadge} ${q.content}</div>
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
        document.getElementById('char-count').textContent = '0 / 250';

        // Clear the array
        selectedTags = [];

        // THE FIX: Remove the visual 'selected' class from all tag buttons
        document.querySelectorAll('.tag-toggle').forEach(btn => btn.classList.remove('selected'));

        showToast("Question submitted!", "success");
        loadStudentFeed(); // Instantly reload the feed so they see their question!
    }
});

document.getElementById('feed-sort-toggle')?.addEventListener('change', loadStudentFeed);