// 1. UI Toggle Logic
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const statusDiv = document.getElementById('auth-status');

tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.classList.remove('hidden-form');
    formRegister.classList.add('hidden-form');
    statusDiv.textContent = ''; // Clear old errors
});

tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formRegister.classList.remove('hidden-form');
    formLogin.classList.add('hidden-form');
    statusDiv.textContent = '';
});

// 2. Role Selector Logic
let selectedRole = 'Student';
document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedRole = btn.getAttribute('data-role');
    });
});

// 3. Centralized Auth Handler
async function handleAuth(url, bodyData, loadingMsg) {
    statusDiv.textContent = loadingMsg;
    statusDiv.style.color = "#7f8c8d";
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            statusDiv.textContent = "✅ " + data.message;
            statusDiv.style.color = "#27ae60";
            
            // Save the ID Badge
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', data.role);
            
            // Auto-Route
            setTimeout(() => {
                if (data.role === 'Instructor') {
                    window.location.href = 'instructor.html';
                } else {
                    window.location.href = 'home.html';
                }
            }, 500);
        } else {
            statusDiv.textContent = "❌ " + data.error;
            statusDiv.style.color = "#e74c3c";
        }
    } catch (error) {
        statusDiv.textContent = "❌ Failed to connect to server.";
        statusDiv.style.color = "#e74c3c";
    }
}

// 4. Form Submit Listeners
formLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    handleAuth('/api/login', { email, password }, "Verifying credentials...");
});

formRegister.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    handleAuth('/api/register', { email, password, role: selectedRole }, "Creating account...");
});