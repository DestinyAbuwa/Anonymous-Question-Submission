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

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });

        const data = await response.json();

        if (response.ok) {
            // CRITICAL FIX: Ensure 'role' is stored exactly as 'role'
            localStorage.setItem('token', data.token);
            // Inside auth.js, inside the response.ok block
            localStorage.setItem('role', data.role.toLowerCase()); // Force lowercase here!
            localStorage.setItem('userId', data.user_id); // Save it here

            statusDiv.textContent = "✅ Success! Redirecting...";

            setTimeout(() => {
                // Ensure we are comparing the string correctly
                const role = String(data.role).toLowerCase();
                if (role === 'instructor') {
                    window.location.href = 'instructor-home.html';
                } else {
                    window.location.href = 'student-home.html';
                }
            }, 800);
        } else {
            statusDiv.textContent = "❌ " + (data.error || "Login failed");
        }
    } catch (error) {
        statusDiv.textContent = "❌ Server error.";
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