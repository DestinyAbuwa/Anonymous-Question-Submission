document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const statusDiv = document.getElementById('login-status');

    statusDiv.textContent = "Verifying...";
    statusDiv.style.color = "#7f8c8d";

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            statusDiv.textContent = "✅ " + data.message;
            statusDiv.style.color = "#27ae60";

            // THE MOST IMPORTANT PART: Save the ID badge to the browser!
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', data.role);

            // Redirect based on their role
            setTimeout(() => {
                if (data.role === 'Instructor') {
                    window.location.href = 'instructor.html';
                } else {
                    window.location.href = 'home.html'; // Route them to the class hub
                }
            }, 1000);

        } else {
            statusDiv.textContent = "❌ " + data.error;
            statusDiv.style.color = "#e74c3c";
        }
    } catch (error) {
        statusDiv.textContent = "❌ Failed to connect to server.";
        statusDiv.style.color = "#e74c3c";
    }
});