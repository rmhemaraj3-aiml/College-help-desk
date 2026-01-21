// This script combines the UI animations and the backend login/registration logic.
document.addEventListener('DOMContentLoaded', () => {
    
    // --- UI ANIMATION LOGIC for the 3D Flip Card ---
    const flipContainer = document.querySelector('.flip-container');
    const toRegisterLink = document.getElementById('flip-to-register');
    const toLoginLink = document.getElementById('flip-to-login');

    if (toRegisterLink) {
        toRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            flipContainer.classList.add('flipped');
        });
    }

    if (toLoginLink) {
        toLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            flipContainer.classList.remove('flipped');
        });
    }

    // --- API COMMUNICATION LOGIC ---
    const API_URL = 'http://localhost:3000';
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    // Handle Login Form Submission
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('name').value;
            const password = document.getElementById('pass').value;
            const user_type = document.querySelector('input[name="login_type"]:checked').value;

            fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, user_type })
            })
            .then(response => response.json())
            .then(data => {
                alert(data.message);
                if (data.message && data.message.includes('successful')) {
                    // Save user data to session storage
                    sessionStorage.setItem('collegeUser', JSON.stringify(data.user));
                    
                    // Redirect based on user type
                    if (data.user.user_type === 'student') {
                        window.location.href = 'student.html';
                    } else if (data.user.user_type === 'staff') {
                        window.location.href = 'staff.html';
                    }
                }
            })
            .catch(err => {
                console.error('Error:', err);
                alert('An error occurred during login.');
            });
        });
    }

    // Handle Registration Form Submission
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('regname').value;
            const password = document.getElementById('regpass').value;
            const repeatPassword = document.getElementById('reregpass').value;
            const user_type = document.querySelector('input[name="register_type"]:checked').value;

            if (password !== repeatPassword) {
                alert("Passwords do not match!");
                return;
            }

            fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, user_type })
            })
            .then(response => response.json())
            .then(data => {
                alert(data.message);
                if (data.message && data.message.includes('successfully')) {
                    // Flip back to the login form on successful registration
                    if (toLoginLink) toLoginLink.click();
                }
            })
            .catch(err => {
                console.error('Error:', err);
                alert('An error occurred during registration.');
            });
        });
    }
});