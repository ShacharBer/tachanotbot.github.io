// Simple Firebase Configuration - Single source of truth
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

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

// Initialize Firebase - only once
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

console.log('✅ Firebase initialized');
