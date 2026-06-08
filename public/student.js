let currentSessionId = null;
const urlParams = new URLSearchParams(window.location.search);
const classId = urlParams.get('classId');

// Initialize the Socket connection
const socket = io();

// Whenever the server yells 'updateFeed', instantly reload our feed!
socket.on('updateFeed', () => {
    if (currentSessionId) {
        loadStudentFeed();
    }
});


document.addEventListener('DOMContentLoaded', () => {
    loadClassDetails();
    checkActiveSession();
    loadStudentFeed();
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
                if (questionText) questionText.placeholder = "What's on your mind?...";
                if (sessionInfo) {
                    sessionInfo.innerHTML = `🟢 Live Session: <strong>${data.session.session_name}</strong>`;
                    sessionInfo.style.color = '#27ae60';
                }
            } else {
                currentSessionId = null;
                if (questionText) questionText.disabled = true;
                if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.5'; }
                if (questionText) questionText.placeholder = "Questions are paused. Waiting for instructor...";
                if (sessionInfo) {
                    sessionInfo.textContent = "No active session. Questions are currently disabled.";
                    sessionInfo.style.color = '#e74c3c';
                }
            }
        }
    } catch (error) { console.error("Failed to check session status"); }
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

document.getElementById('question-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    const content = document.getElementById('question-text').value;
    const token = localStorage.getItem('token');

    startLoader();
    try {
        const response = await fetch('/api/questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ session_id: currentSessionId, content: content, tags: selectedTags })
        });

        if (response.ok) {
            document.getElementById('question-text').value = '';
            selectedTags = [];
            document.querySelectorAll('.tag-toggle').forEach(btn => btn.classList.remove('selected'));
            showToast("Question submitted successfully!", "success");
            loadStudentFeed();
        } else {
            const errorData = await response.json();
            showToast(errorData.error || "Failed to submit question.", "error");
        }
    } catch (error) {
        showToast("Cannot connect to the server.", "error");
    }
    stopLoader();
});

async function loadStudentFeed() {
    const container = document.getElementById('student-feed-container');
    if (!currentSessionId) return;

    try {
        // Inside loadStudentFeed()
        const sortMode = document.getElementById('feed-sort-toggle') ? document.getElementById('feed-sort-toggle').value : 'upvotes';
        const response = await fetch(`/api/questions/${currentSessionId}?sort=${sortMode}`);
        const questions = await response.json();

        if (questions.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 20px;">
                    <span>📭</span>
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
            const pinIcon = q.is_pinned ? `<span style="color:#f39c12; font-size:1.2em; margin-right:5px;">📌</span>` : '';

            card.innerHTML = `
                <div class="upvote-column">
                    <button class="upvote-btn" onclick="handleUpvote(${q.question_id})">▲</button>
                    <span class="upvote-count">${q.upvotes || 0}</span>
                </div>
                <div class="question-body">
                    <div class="question-header">
                        <div>${pinIcon} ${tagsHTML}</div>
                    </div>
                    <div class="question-content" style="margin-top: 5px;">
                        ${liveBadge} ${q.content}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        if (container.innerHTML === '' || container.innerHTML.includes('Loading')) {
            showToast("Failed to sync feed.", "error");
        }
    }
}

async function handleUpvote(questionId) {
    const token = localStorage.getItem('token');
    startLoader();
    try {
        const response = await fetch(`/api/questions/${questionId}/upvote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            loadStudentFeed();
        } else {
            showToast("Your session expired. Please log in again.", "error");
        }
    } catch (error) {
        showToast("Error processing upvote.", "error");
    }
    stopLoader();
}

document.getElementById('feed-sort-toggle')?.addEventListener('change', loadStudentFeed);


