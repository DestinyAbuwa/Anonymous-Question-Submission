document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const statusDiv = document.getElementById('login-status');
    
    statusDiv.textContent = "Verifying credentials...";
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
            
            // NEW: Save the user's ID and Role in the browser's memory!
            localStorage.setItem('userId', data.user.user_id);
            localStorage.setItem('userRole', data.user.role);
            
            // Redirect EVERYONE to the Canvas-style Class Hub after 0.5 seconds
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 500);
            
        } else {
            statusDiv.textContent = "❌ " + data.error;
            statusDiv.style.color = "#e74c3c";
        }
    } catch (error) {
        statusDiv.textContent = "❌ Failed to connect to server.";
        statusDiv.style.color = "#e74c3c";
    }
});