// 1. UI Toggle Logic
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');

tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.classList.remove('hidden-form');
    formRegister.classList.add('hidden-form');
});

tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formRegister.classList.remove('hidden-form');
    formLogin.classList.add('hidden-form');
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
async function handleAuth(url, bodyData) {
    startLoader(); // Start the green network bar!

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', data.role.toLowerCase()); 
            localStorage.setItem('userId', data.user_id); 


            setTimeout(() => {
                const role = String(data.role).toLowerCase();
                if (role === 'instructor') {
                    window.location.href = 'instructor-home.html';
                } else {
                    window.location.href = 'student-home.html';
                }
            }, 500);
        } else {
            showToast(data.error || "Authentication failed", "error");
        }
    } catch (error) {
        showToast("Server connection error.", "error");
    }
    
    stopLoader(); // Hide the network bar
}

// 4. Form Submit Listeners
formLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    handleAuth('/api/login', { email, password });
});

formRegister.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    handleAuth('/api/register', { email, password, role: selectedRole });
});