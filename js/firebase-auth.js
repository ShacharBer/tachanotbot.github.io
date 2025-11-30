// Firebase Authentication and Database Management
// Using Firebase Modular SDK v9+

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendEmailVerification,
    sendPasswordResetEmail,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    set, 
    get,
    update,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyANfH2Y1hx1zFSFp4fTEJGk6lQnZY1SdFI",
    authDomain: "tachanotdb.firebaseapp.com",
    databaseURL: "https://tachanotdb-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "tachanotdb",
    storageBucket: "tachanotdb.firebasestorage.app",
    messagingSenderId: "121171399463",
    appId: "1:121171399463:web:e3e24ebe626897889c0f02"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

console.log('Firebase initialized successfully');
console.log('Auth instance:', auth);
console.log('Realtime Database instance:', db);

// Register new user
async function registerUser(formData) {
    try {
        console.log('Starting registration with data:', formData);
        
        // Show loading state
        const submitButton = document.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating account...';

        // Create user with email and password
        console.log('Creating user account...');
        const userCredential = await createUserWithEmailAndPassword(
            auth,
            formData.email,
            formData.password
        );

        const user = userCredential.user;
        console.log('User created successfully:', user.uid);

        // Update user profile
        console.log('Updating user profile...');
        await updateProfile(user, {
            displayName: `${formData.firstName} ${formData.lastName}`
        });

        // Save additional user data to Realtime Database
        try {
            console.log('Saving user data to Realtime Database...');
            const userRef = ref(db, 'users/' + user.uid);
            await set(userRef, {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp()
            });
            console.log('User data saved successfully!');
        } catch (dbError) {
            console.warn('Database save failed (user still created in Auth):', dbError);
            // Continue anyway - user account is created, just not saved to database
        }
        
        if (typeof window.showSuccessMessage === 'function') {
            window.showSuccessMessage('Account created successfully! Redirecting to control panel...');
        }

        // Redirect to control page after 1.5 seconds
        setTimeout(() => {
            window.location.href = 'control.html';
        }, 1500);

    } catch (error) {
        console.error('Registration error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        // Handle specific error cases
        let errorMessage = 'Registration failed. Please try again.';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = '❌ This email is already registered! Please use a different email or go to the login page.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address format.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak. Please use at least 6 characters.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your internet connection.';
                break;
            default:
                errorMessage = `Registration failed: ${error.message}`;
        }
        
        if (typeof window.showErrorMessage === 'function') {
            window.showErrorMessage(errorMessage);
        } else {
            alert(errorMessage);
        }
        
        // Reset button state
        const submitButton = document.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="bi bi-person-plus me-2"></i>Create Account';
        }
    }
}

// Login existing user
async function loginUser(email, password, rememberMe) {
    try {
        // Show loading state
        const submitButton = document.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Signing in...';

        // Set persistence based on "remember me" checkbox
        const persistence = rememberMe 
            ? browserLocalPersistence 
            : browserSessionPersistence;
        
        await setPersistence(auth, persistence);

        // Sign in user
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update last login timestamp in Realtime Database
        try {
            const userRef = ref(db, 'users/' + user.uid);
            await update(userRef, {
                lastLogin: serverTimestamp()
            });
        } catch (dbError) {
            console.warn('Failed to update last login in database:', dbError);
            // Continue anyway - login is successful
        }

        if (typeof window.showSuccessMessage === 'function') {
            window.showSuccessMessage('Login successful! Redirecting to control panel...');
        }

        // Redirect to control page after 1.5 seconds
        setTimeout(() => {
            window.location.href = 'control.html';
        }, 1500);

    } catch (error) {
        console.error('Login error:', error);
        
        let errorMessage = 'Login failed. Please try again.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email. Please register first.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password. Please try again.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address format.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed login attempts. Please try again later.';
                break;
        }
        
        showErrorMessage(errorMessage);
        
        // Reset button state
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
    }
}

// Sign out user
async function signOutUser() {
    try {
        await signOut(auth);
        showSuccessMessage('Signed out successfully!');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Sign out error:', error);
        showErrorMessage('Failed to sign out. Please try again.');
    }
}

// Check authentication state
function checkAuthState() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in
            console.log('User is signed in:', user.email);
            
            // Update navigation to show "Logged In" instead of Login/Register
            updateNavigationForLoggedInUser(user);
            
            // Hide "Get Started" button on homepage if present
            const getStartedBtn = document.getElementById('getStartedBtn');
            if (getStartedBtn) {
                getStartedBtn.style.display = 'none';
            }
            
            // Get user data from Realtime Database
            try {
                const userRef = ref(db, 'users/' + user.uid);
                const snapshot = await get(userRef);
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    console.log('User data:', userData);
                    // You can update UI elements here based on user data
                }
            } catch (error) {
                // Silently handle database errors - auth still works
                console.log('Note: Could not fetch user profile data (Database may not be enabled)');
            }
        } else {
            // User is signed out
            console.log('No user signed in');
            updateNavigationForLoggedOutUser();
            
            // Show "Get Started" button on homepage if present
            const getStartedBtn = document.getElementById('getStartedBtn');
            if (getStartedBtn) {
                getStartedBtn.style.display = 'inline-block';
            }
        }
    });
}

// Update navigation when user is logged in
function updateNavigationForLoggedInUser(user) {
    const navbarNav = document.getElementById('navbarNav');
    if (!navbarNav) return;

    // Find login and register nav items
    const navItems = navbarNav.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        const link = item.querySelector('.nav-link');
        if (link) {
            const href = link.getAttribute('href');
            // Hide login and register links
            if (href === 'login.html' || href === 'register.html') {
                item.style.display = 'none';
            }
        }
    });

    // Check if "Logged In" button already exists
    if (!document.getElementById('loggedInBtn')) {
        // Create "Logged In" nav item
        const loggedInItem = document.createElement('li');
        loggedInItem.className = 'nav-item';
        loggedInItem.innerHTML = `
            <a class="nav-link" href="#" id="loggedInBtn" style="cursor: pointer;">
                <i class="bi bi-person-circle me-1"></i>Logged In
            </a>
        `;
        
        // Add to navbar
        const navList = navbarNav.querySelector('.navbar-nav');
        if (navList) {
            navList.appendChild(loggedInItem);
        }

        // Add click event to show logout popup
        document.getElementById('loggedInBtn').addEventListener('click', function(e) {
            e.preventDefault();
            showLogoutPopup(user);
        });
    }
}

// Update navigation when user is logged out
function updateNavigationForLoggedOutUser() {
    const navbarNav = document.getElementById('navbarNav');
    if (!navbarNav) return;

    // Show login and register links
    const navItems = navbarNav.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        const link = item.querySelector('.nav-link');
        if (link) {
            const href = link.getAttribute('href');
            if (href === 'login.html' || href === 'register.html') {
                item.style.display = 'block';
            }
        }
    });

    // Remove "Logged In" button if it exists
    const loggedInBtn = document.getElementById('loggedInBtn');
    if (loggedInBtn) {
        loggedInBtn.parentElement.remove();
    }
}

// Show logout popup
function showLogoutPopup(user) {
    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop fade show';
    backdrop.style.zIndex = '1040';
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.style.zIndex = '1050';
    modal.setAttribute('tabindex', '-1');
    
    const displayName = user.displayName || user.email;
    
    modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="bi bi-person-circle me-2"></i>Account
                    </h5>
                    <button type="button" class="btn-close" onclick="this.closest('.modal').remove(); document.querySelector('.modal-backdrop').remove();"></button>
                </div>
                <div class="modal-body text-center">
                    <p class="mb-3">Logged in as: <strong>${displayName}</strong></p>
                    <p class="text-muted">Do you want to logout?</p>
                </div>
                <div class="modal-footer justify-content-center">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove(); document.querySelector('.modal-backdrop').remove();">Cancel</button>
                    <button type="button" class="btn btn-danger" id="confirmLogout">
                        <i class="bi bi-box-arrow-right me-2"></i>Logout
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
    
    // Add logout functionality
    document.getElementById('confirmLogout').addEventListener('click', function() {
        modal.remove();
        backdrop.remove();
        signOutUser();
    });
}

// Password reset
async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        showSuccessMessage('Password reset email sent! Please check your inbox.');
    } catch (error) {
        console.error('Password reset error:', error);
        
        let errorMessage = 'Failed to send password reset email.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email address.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address format.';
                break;
        }
        
        showErrorMessage(errorMessage);
    }
}

// Make functions available globally
window.registerUser = registerUser;
window.loginUser = loginUser;
window.signOutUser = signOutUser;
window.resetPassword = resetPassword;

// Initialize Firebase auth state check when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    checkAuthState();
});
