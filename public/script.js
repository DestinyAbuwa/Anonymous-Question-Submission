// Wait for the student to click the "Submit Question" button
document.getElementById('question-form').addEventListener('submit', async function(event) {
    
    // 1. Prevent the default HTML behavior (which is to refresh the entire page)
    event.preventDefault();

    // 2. Grab the exact text and tag the student selected from the HTML elements
    const content = document.getElementById('question-text').value;
    const tag = document.getElementById('question-tag').value;
    const statusMessage = document.getElementById('status-message');

    // Show a quick loading state
    statusMessage.textContent = "Sending...";
    statusMessage.style.color = "#7f8c8d";

    try {
        // 3. Fire the data to our backend server using the Fetch API!
        // (We will build this exact '/api/questions' route in the next step)
        const response = await fetch('/api/questions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                // Hardcoding our dummy student and active lecture session for testing
                user_id: 2,       
                session_id: 1,    
                content: content,
                tag_name: tag
            })
        });

        // 4. Handle the server's response
        if (response.ok) {
            // Success! Clear the text box and show a green message
            document.getElementById('question-text').value = '';
            document.getElementById('question-tag').value = 'None';
            
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