// Keep track of which tags the student clicks
let selectedTags = [];

// Attach an "ear" to every tag button
document.querySelectorAll('.tag-toggle').forEach(button => {
    button.addEventListener('click', () => {
        // Visually turn the color on/off
        button.classList.toggle('selected');

        const tag = button.getAttribute('data-value');

        // If it's already in our list, remove it. If it isn't, add it!
        if (selectedTags.includes(tag)) {
            selectedTags = selectedTags.filter(t => t !== tag);
        } else {
            selectedTags.push(tag);
        }
    });
});

// Wait for the student to click the "Submit Question" button
document.getElementById('question-form').addEventListener('submit', async function (event) {

    // 1. Prevent the default HTML behavior (which is to refresh the entire page)
    event.preventDefault();

    // 2. Grab the exact text and tag the student selected from the HTML elements
    const content = document.getElementById('question-text').value;

    const statusMessage = document.getElementById('status-message');

    // Show a quick loading state
    statusMessage.textContent = "Sending...";
    statusMessage.style.color = "#7f8c8d";

    try {
        // 3. Fire the data to our backend server using the Fetch API!
        const token = localStorage.getItem('token'); // Grab the badge

        const response = await fetch('/api/questions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Show the badge to the Waiter!
            },
            body: JSON.stringify({
                session_id: 1,
                content: content,
                tags: selectedTags
            })
        });

        // 4. Handle the server's response
        if (response.ok) {
            // Success! Clear the text box and show a green message
            document.getElementById('question-text').value = '';

            // Visually turn off all tag buttons and empty the array after submission
            selectedTags = [];
            document.querySelectorAll('.tag-toggle').forEach(btn => btn.classList.remove('selected'));

            statusMessage.textContent = "✅ Question submitted successfully!";
            statusMessage.style.color = "#27ae60"; // Professional green

            // Automatically hide the success message after 3 seconds
            setTimeout(() => {
                statusMessage.textContent = "";
            }, 3000);
        } else {
            // NEW: Parse the exact error message sent by our profanity filter
            const errorData = await response.json();

            // Display the specific warning from the server
            statusMessage.textContent = "❌ " + (errorData.error || "Failed to submit question.");
            statusMessage.style.color = "#e74c3c"; // Red
        }
    } catch (error) {
        // The server is completely offline or unreachable
        console.error("Error submitting question:", error);
        statusMessage.textContent = "❌ Cannot connect to the server.";
        statusMessage.style.color = "#e74c3c";
    }
});

// ==========================================
// UPVOTE FEATURE LOGIC
// ==========================================

// 1. The Waiter: Fetch the questions and draw them on the screen
async function loadStudentFeed() {
    const container = document.getElementById('student-feed-container');
    try {
        // Send a GET request to the Waiter for Session 1's questions
        const response = await fetch('/api/questions/1');
        const questions = await response.json();

        container.innerHTML = ''; // Clear loading text

        if (questions.length === 0) {
            container.innerHTML = '<p>No questions yet. Be the first to ask!</p>';
            return;
        }

        // Loop through and build the HTML for each question, including the upvote button!
        questions.forEach(q => {
            const card = document.createElement('div');
            card.className = 'feed-card';

            // Build the HTML for potentially multiple tags!
            let tagsHTML = '';
            if (q.tags) {
                // The backend will send them grouped together like "Urgent,Exam-Related"
                const tagsArray = q.tags.split(',');
                tagsArray.forEach(tag => {
                    tagsHTML += `<span class="tag-badge" data-tag="${tag}">${tag}</span> `;
                });
            }

            // Notice how we attach an 'onclick' event directly to the button, 
            // passing the specific question_id to our handleUpvote function!
            card.innerHTML = `
                <div class="upvote-column">
                    <button class="upvote-btn" onclick="handleUpvote(${q.question_id})">▲</button>
                    <span class="upvote-count">${q.upvotes || 0}</span>
                </div>
                <div class="question-body">
                    <div class="question-header">
                        ${tagsHTML} </div>
                    <div class="question-content">${q.content}</div>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        container.innerHTML = '<p style="color:red;">Failed to load feed.</p>';
    }
}

// 2. The Kitchen Ticket: Send the upvote toggle to the database
async function handleUpvote(questionId) {
    try {
        // Grab the digital ID badge from the browser
        const token = localStorage.getItem('token');

        const response = await fetch(`/api/questions/${questionId}/upvote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Show the badge to the Waiter!
            }
            // Notice we COMPLETELY deleted the "body: JSON.stringify(...)" line! 
            // The backend security guard figures out who we are from the token.
        });

        if (response.ok) {
            // Because the backend now handles toggling on/off, 
            // we just reload the feed to show the updated number!
            loadStudentFeed();
        } else {
            // If they aren't logged in or the badge is expired, log the error
            const data = await response.json();
            console.error("Upvote failed:", data.error);
            alert("Your session expired. Please log in again.");
        }
    } catch (error) {
        console.error("Error upvoting:", error);
    }
}

// 3. Start the process and SET THE AUTO-REFRESH TIMER
document.addEventListener('DOMContentLoaded', () => {
    loadStudentFeed(); // Load immediately on opening

    // Refresh the feed automatically every 5 seconds (5000ms)
    setInterval(loadStudentFeed, 5000);
});

// 3. Start the process immediately when the page loads
loadStudentFeed();
