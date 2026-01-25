// Simple Control Page - Display fromAltera data
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

console.log('Control.js loaded');

// Check if user is logged in
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('✅ User logged in:', user.email);
        document.querySelector('.login-prompt').classList.remove('show');
        document.querySelector('.auth-required').classList.add('show');
        loadFromAlteraData();
    } else {
        console.log('❌ No user logged in');
        document.querySelector('.auth-required').classList.remove('show');
        document.querySelector('.login-prompt').classList.add('show');
    }
});

// Load fromAltera data from Firebase
function loadFromAlteraData() {
    console.log('Loading fromAltera data...');
    
    const alteraRef = ref(db, 'fromAltera');
    
    onValue(alteraRef, (snapshot) => {
        console.log('Data received from Firebase');
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            console.log('fromAltera data:', data);
            
            // Update display
            document.getElementById('alteraValueA').textContent = data.a ?? '--';
            document.getElementById('alteraValueB').textContent = data.b ?? '--';
            document.getElementById('alteraValueC').textContent = data.c ?? '--';
            
            console.log('✅ Display updated');
        } else {
            console.log('⚠️ No data in fromAltera');
            document.getElementById('alteraValueA').textContent = '--';
            document.getElementById('alteraValueB').textContent = '--';
            document.getElementById('alteraValueC').textContent = '--';
        }
    }, (error) => {
        console.error('❌ Firebase error:', error);
        document.getElementById('alteraValueA').textContent = 'Error';
        document.getElementById('alteraValueB').textContent = 'Error';
        document.getElementById('alteraValueC').textContent = 'Error';
    });
}
