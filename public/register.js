
let selectedRole = 'Student'; // Default to student

// Attach a listener to both role buttons
document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove the blue 'active' style from all buttons
        document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
        
        // Add the blue 'active' style ONLY to the one we just clicked
        btn.classList.add('active');
        
        // Save the choice in our variable
        selectedRole = btn.getAttribute('data-role');
    });
});

document.getElementById('register-form').addEventListener('submit', async (event) => {
    // 1. Stop the page from refreshing
    event.preventDefault();
    
    // 2. Grab the exact text the user typed

    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const role = selectedRole;
    
    const statusDiv = document.getElementById('reg-status');
    statusDiv.textContent = "Creating account...";
    statusDiv.style.color = "#7f8c8d";
    
    try {
        // 3. Hand the data to our Waiter
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role })
        });
        
        const data = await response.json();
        
        // 4. Handle the Kitchen's response
        if (response.ok) {
            statusDiv.textContent = "✅ " + data.message;
            statusDiv.style.color = "#27ae60";
            
            // Clear the form
            document.getElementById('register-form').reset();
            
            setTimeout(() => window.location.href = 'home.html', 500);
            
        } else {
            // This catches our "Email already exists" duplicate error!
            statusDiv.textContent = "❌ " + data.error;
            statusDiv.style.color = "#e74c3c";
        }
    } catch (error) {
        statusDiv.textContent = "❌ Failed to connect to server.";
        statusDiv.style.color = "#e74c3c";
    }
});