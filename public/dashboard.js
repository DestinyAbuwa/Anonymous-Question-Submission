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

            card.innerHTML = `
                <div class="question-header">
                    <span class="timestamp">${timeString}</span>
                    ${tagHTML}
                </div>
                <div class="question-content">
                    ${q.content}
                </div>
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

// 1. Run it immediately when the page loads
document.addEventListener('DOMContentLoaded', () => {
    fetchQuestions();

    // 2. Set the timer to run the exact same function every 5000 milliseconds (5 seconds)
    setInterval(fetchQuestions, 5000);
});