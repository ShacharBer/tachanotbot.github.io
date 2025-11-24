// Bot Control Panel JavaScript
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    get,
    set,
    onValue,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

// Firebase configuration (same as firebase-auth.js)
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

// Station definitions with colors
const stations = [
    { id: 'red', name: 'Red Station', color: '#dc3545' },
    { id: 'blue', name: 'Blue Station', color: '#0d6efd' },
    { id: 'green', name: 'Green Station', color: '#198754' },
    { id: 'yellow', name: 'Yellow Station', color: '#ffc107' },
    { id: 'purple', name: 'Purple Station', color: '#6f42c1' },
    { id: 'orange', name: 'Orange Station', color: '#fd7e14' }
];

let currentUser = null;
let selectedStation = null;
let currentStation = 'red'; // Default starting station
let isConnected = false;
let connectionCheckInterval = null;

// Check authentication state
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        showControlPanel();
        loadBotStatus();
        loadStations();
        setupRealtimeListeners();
        startConnectionMonitoring();
    } else {
        showLoginPrompt();
        stopConnectionMonitoring();
    }
});

// Show control panel for authenticated users
function showControlPanel() {
    document.querySelector('.login-prompt').classList.remove('show');
    document.querySelector('.auth-required').classList.add('show');
}

// Show login prompt for unauthenticated users
function showLoginPrompt() {
    document.querySelector('.auth-required').classList.remove('show');
    document.querySelector('.login-prompt').classList.add('show');
}

// Load bot status from database
async function loadBotStatus() {
    try {
        const botStatusRef = ref(db, 'bot/status');
        const snapshot = await get(botStatusRef);
        
        if (snapshot.exists()) {
            const status = snapshot.val();
            currentStation = status.currentStation || 'red';
            updateCurrentStationDisplay(currentStation);
            updateBotStatus(status.state || 'Ready');
        } else {
            // Initialize bot status if it doesn't exist
            await set(botStatusRef, {
                currentStation: 'red',
                state: 'Ready',
                lastUpdated: serverTimestamp()
            });
            updateCurrentStationDisplay('red');
        }
    } catch (error) {
        console.error('Error loading bot status:', error);
        showNotification('Error loading bot status', 'danger');
    }
}

// Load and display all stations
function loadStations() {
    const stationGrid = document.getElementById('stationGrid');
    stationGrid.innerHTML = '';
    
    stations.forEach(station => {
        // Skip current station from available destinations
        if (station.id === currentStation) {
            return;
        }
        
        const stationCard = document.createElement('div');
        stationCard.className = 'station-card card';
        stationCard.dataset.stationId = station.id;
        stationCard.innerHTML = `
            <div class="card-body text-center p-4">
                <div class="station-indicator" style="background-color: ${station.color};">
                    <i class="bi bi-building"></i>
                </div>
                <h5 class="card-title">${station.name}</h5>
                <p class="text-muted small mb-0">Click to select</p>
            </div>
        `;
        
        stationCard.addEventListener('click', () => selectStation(station));
        stationGrid.appendChild(stationCard);
    });
}

// Update current station display
function updateCurrentStationDisplay(stationId) {
    const station = stations.find(s => s.id === stationId);
    if (!station) return;
    
    document.getElementById('currentStationName').textContent = station.name;
    document.getElementById('currentStationTitle').textContent = station.name;
    
    const colorIndicator = document.getElementById('currentStationColor');
    colorIndicator.style.backgroundColor = station.color;
}

// Update bot status badge
function updateBotStatus(status) {
    const statusBadge = document.getElementById('botStatus');
    statusBadge.textContent = status;
    
    // Update badge color based on status
    statusBadge.className = 'badge';
    if (status === 'Ready') {
        statusBadge.classList.add('bg-success');
    } else if (status === 'Moving' || status === 'In Transit') {
        statusBadge.classList.add('bg-warning');
    } else if (status === 'Error') {
        statusBadge.classList.add('bg-danger');
    } else {
        statusBadge.classList.add('bg-info');
    }
}

// Select a destination station
function selectStation(station) {
    // Remove previous selection
    document.querySelectorAll('.station-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Add selection to clicked card
    const card = document.querySelector(`[data-station-id="${station.id}"]`);
    card.classList.add('selected');
    
    selectedStation = station;
    
    // Enable send button
    document.getElementById('sendCommandBtn').disabled = false;
    document.getElementById('selectionHint').textContent = `Selected: ${station.name}`;
}

// Send command to move bot
async function sendBotCommand() {
    if (!selectedStation) {
        showNotification('Please select a destination station', 'warning');
        return;
    }
    
    // Check if bot is connected
    if (!isConnected) {
        showNotification('❌ Bot is not connected! Please check ESP32 connection.', 'danger');
        return;
    }
    
    const sendBtn = document.getElementById('sendCommandBtn');
    const originalText = sendBtn.innerHTML;
    
    try {
        // Show loading state
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending Command...';
        document.getElementById('loadingSpinner').classList.add('active');
        
        // Check current bot state
        const botStatusRef = ref(db, 'bot/status');
        const statusSnapshot = await get(botStatusRef);
        
        if (statusSnapshot.exists()) {
            const currentStatus = statusSnapshot.val();
            
            // Don't allow new commands if bot is already moving
            if (currentStatus.state === 'Moving') {
                showNotification('⚠️ Bot is already in transit. Please wait for current movement to complete.', 'warning');
                sendBtn.disabled = false;
                sendBtn.innerHTML = originalText;
                document.getElementById('loadingSpinner').classList.remove('active');
                return;
            }
        }
        
        // Create command in database
        const commandRef = ref(db, `bot/commands/${Date.now()}`);
        await set(commandRef, {
            from: currentStation,
            to: selectedStation.id,
            requestedBy: currentUser.email,
            timestamp: serverTimestamp(),
            status: 'pending'
        });
        
        // Update bot status to set target station
        await set(botStatusRef, {
            currentStation: currentStation,
            targetStation: selectedStation.id,
            state: 'Command Sent',
            lastUpdated: serverTimestamp()
        });
        
        showNotification(`✅ Command sent! Waiting for bot to start moving to ${selectedStation.name}...`, 'success');
        
        // Reset button but keep it disabled until bot completes movement
        sendBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Waiting for Bot Response...';
        document.getElementById('loadingSpinner').classList.remove('active');
        
        // Clear selection
        selectedStation = null;
        document.querySelectorAll('.station-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.getElementById('selectionHint').textContent = 'Command sent - waiting for bot...';
        
    } catch (error) {
        console.error('Error sending command:', error);
        
        let errorMessage = '❌ Failed to send command. ';
        if (error.code === 'PERMISSION_DENIED') {
            errorMessage += 'Database permission denied. Check Firebase rules.';
        } else if (error.code === 'NETWORK_ERROR') {
            errorMessage += 'Network error. Check your internet connection.';
        } else {
            errorMessage += error.message;
        }
        
        showNotification(errorMessage, 'danger');
        
        sendBtn.disabled = false;
        sendBtn.innerHTML = originalText;
        document.getElementById('loadingSpinner').classList.remove('active');
    }
}

// Setup realtime listeners for bot status updates
function setupRealtimeListeners() {
    const botStatusRef = ref(db, 'bot/status');
    
    onValue(botStatusRef, (snapshot) => {
        if (snapshot.exists()) {
            const status = snapshot.val();
            const previousStation = currentStation;
            const previousState = botState || 'Ready';
            
            // Update current station if changed
            if (status.currentStation && status.currentStation !== currentStation) {
                currentStation = status.currentStation;
                updateCurrentStationDisplay(currentStation);
                loadStations(); // Reload available stations
                
                // Show notification when bot arrives
                if (previousState === 'Moving' && status.state === 'Ready') {
                    const stationInfo = stations.find(s => s.id === currentStation);
                    showNotification(`✅ Bot arrived at ${stationInfo ? stationInfo.name : currentStation}!`, 'success');
                }
                
                // Reset selection and button
                selectedStation = null;
                const sendBtn = document.getElementById('sendCommandBtn');
                sendBtn.disabled = true;
                sendBtn.innerHTML = '<i class="bi bi-send me-2"></i>Send Bot to Selected Station';
                document.getElementById('selectionHint').textContent = 'Select a destination station above';
            }
            
            // Handle state changes
            if (status.state !== previousState) {
                updateBotStatus(status.state || 'Ready');
                
                // Show appropriate notifications based on state
                if (status.state === 'Moving' && previousState !== 'Moving') {
                    const targetInfo = stations.find(s => s.id === status.targetStation);
                    showNotification(`🚀 Bot started moving to ${targetInfo ? targetInfo.name : status.targetStation}`, 'info');
                } else if (status.state === 'Error') {
                    const errorMsg = status.error || 'Unknown error occurred';
                    showNotification(`❌ Error: ${errorMsg}`, 'danger');
                } else if (status.state === 'Ready' && previousState === 'Moving') {
                    // Bot finished moving - already handled in station change
                } else if (status.state === 'Ready') {
                    // Enable controls when bot is ready
                    const sendBtn = document.getElementById('sendCommandBtn');
                    if (!selectedStation) {
                        sendBtn.disabled = true;
                    }
                }
            }
            
            // Store current state for comparison
            window.botState = status.state || 'Ready';
            
            // Check if target station is set but state is not moving (potential issue)
            if (status.targetStation && status.state === 'Ready' && status.currentStation !== status.targetStation) {
                console.warn('Warning: Target station set but bot is Ready. Possible communication issue.');
            }
        } else {
            console.warn('No bot status data in Firebase');
            showNotification('⚠️ No bot status data found in database', 'warning');
        }
    }, (error) => {
        console.error('Error listening to bot status:', error);
        showNotification(`❌ Database error: ${error.message}`, 'danger');
    });
}

// Monitor ESP32 connection status
function startConnectionMonitoring() {
    const connectionRef = ref(db, 'bot/esp32/connected');
    const lastHeartbeatRef = ref(db, 'bot/esp32/lastHeartbeat');
    
    // Listen for connection status changes
    onValue(connectionRef, (snapshot) => {
        if (snapshot.exists()) {
            isConnected = snapshot.val();
            updateConnectionStatus(isConnected);
        } else {
            isConnected = false;
            updateConnectionStatus(false);
        }
    });
    
    // Check heartbeat every 5 seconds
    connectionCheckInterval = setInterval(async () => {
        try {
            const snapshot = await get(lastHeartbeatRef);
            if (snapshot.exists()) {
                const lastHeartbeat = snapshot.val();
                const now = Date.now();
                const timeDiff = now - lastHeartbeat;
                
                // Consider disconnected if no heartbeat for more than 10 seconds
                if (timeDiff > 10000) {
                    isConnected = false;
                    updateConnectionStatus(false);
                }
            } else {
                isConnected = false;
                updateConnectionStatus(false);
            }
        } catch (error) {
            console.error('Error checking heartbeat:', error);
        }
    }, 5000);
}

// Stop connection monitoring
function stopConnectionMonitoring() {
    if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
        connectionCheckInterval = null;
    }
}

// Update connection status display
function updateConnectionStatus(connected) {
    const statusBadge = document.getElementById('connectionStatus');
    if (!statusBadge) return;
    
    if (connected) {
        statusBadge.className = 'badge bg-success';
        statusBadge.innerHTML = '<i class="bi bi-wifi me-1"></i>Connected';
    } else {
        statusBadge.className = 'badge bg-danger';
        statusBadge.innerHTML = '<i class="bi bi-wifi-off me-1"></i>Disconnected';
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-5`;
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Event listener for send command button
document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('sendCommandBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendBotCommand);
    }
});
