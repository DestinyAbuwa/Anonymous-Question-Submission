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

            const timeString = new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const tagHTML = (q.tag_name && q.tag_name !== 'None') 
                ? `<span class="tag-badge">${q.tag_name}</span>` 
                : '';

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


// 1. Run it immediately when the page loads
document.addEventListener('DOMContentLoaded', () => {
    fetchQuestions();

    // 2. Set the timer to run the exact same function every 5000 milliseconds (5 seconds)
    setInterval(fetchQuestions, 5000);
});