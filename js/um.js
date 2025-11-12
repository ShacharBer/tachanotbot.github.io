// Form validation and UI functionality for registration page

// Toggle password visibility
function initPasswordToggle() {
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        togglePassword.addEventListener('click', function () {
            const password = document.getElementById('password');
            const icon = this.querySelector('i');

            if (password.type === 'password') {
                password.type = 'text';
                icon.classList.remove('bi-eye');
                icon.classList.add('bi-eye-slash');
            } else {
                password.type = 'password';
                icon.classList.remove('bi-eye-slash');
                icon.classList.add('bi-eye');
            }
        });
    }
}

// Password confirmation validation
function initPasswordConfirmation() {
    const confirmPassword = document.getElementById('confirmPassword');
    const password = document.getElementById('password');

    if (confirmPassword && password) {
        confirmPassword.addEventListener('input', function () {
            const passwordValue = password.value;
            const confirmPasswordValue = this.value;

            if (passwordValue !== confirmPasswordValue) {
                this.setCustomValidity('Passwords do not match');
            } else {
                this.setCustomValidity('');
            }
        });
    }
}

// Form validation
function initFormValidation() {
    const form = document.querySelector('.needs-validation');
    
    if (form) {
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            event.stopPropagation();

            if (form.checkValidity()) {
                // Check if this is registration or login page
                const isRegisterPage = document.getElementById('firstName') !== null;
                const isLoginPage = document.getElementById('rememberMe') !== null;
                
                if (isRegisterPage) {
                    // Collect registration form data
                    const formData = {
                        firstName: document.getElementById('firstName').value,
                        lastName: document.getElementById('lastName').value,
                        email: document.getElementById('email').value,
                        password: document.getElementById('password').value
                    };

                    // Call Firebase registration function
                    if (typeof window.registerUser === 'function') {
                        window.registerUser(formData);
                    } else {
                        console.error('registerUser function not found');
                        showErrorMessage('Registration system not loaded. Please refresh the page.');
                    }
                } else if (isLoginPage) {
                    // Collect login form data
                    const email = document.getElementById('email').value;
                    const password = document.getElementById('password').value;
                    const rememberMe = document.getElementById('rememberMe').checked;

                    // Call Firebase login function
                    if (typeof window.loginUser === 'function') {
                        window.loginUser(email, password, rememberMe);
                    } else {
                        console.error('loginUser function not found');
                        showErrorMessage('Login system not loaded. Please refresh the page.');
                    }
                }
            }

            form.classList.add('was-validated');
        }, false);
    }
}

// Show success message
function showSuccessMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        <i class="bi bi-check-circle-fill me-2"></i>${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Show error message
function showErrorMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        <i class="bi bi-exclamation-triangle-fill me-2"></i>${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Make message functions globally available
window.showSuccessMessage = showSuccessMessage;
window.showErrorMessage = showErrorMessage;

// Initialize all functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    initPasswordToggle();
    initPasswordConfirmation();
    initFormValidation();
});
