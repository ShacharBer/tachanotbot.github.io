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

// Station definitions with colors and command values
const stations = [
    { id: 'red', name: 'Red Station', color: '#dc3545', command: 228 },
    { id: 'green', name: 'Green Station', color: '#198754', command: 229 },
    { id: 'blue', name: 'Blue Station', color: '#0d6efd', command: 232 }
];

let currentUser = null;
let selectedStation = null;
let currentStation = 'red'; // Default starting station

// Station distances (in meters) - estimated distances between stations
const stationDistances = {
    'red-blue': 50,
    'red-green': 75,
    'red-yellow': 100,
    'red-purple': 120,
    'red-orange': 90,
    'blue-green': 60,
    'blue-yellow': 80,
    'blue-purple': 110,
    'blue-orange': 85,
    'green-yellow': 65,
    'green-purple': 95,
    'green-orange': 70,
    'yellow-purple': 55,
    'yellow-orange': 90,
    'purple-orange': 80
};

// Calculate distance between two stations
function calculateDistance(from, to) {
    if (!from || !to) return 0;
    
    const key1 = `${from}-${to}`;
    const key2 = `${to}-${from}`;
    
    return stationDistances[key1] || stationDistances[key2] || 50; // Default 50m if not found
}

// Check authentication state
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        showControlPanel();
        
        // Give DOM time to render before setting up listeners
        setTimeout(() => {
            loadBotStatus();
            loadStations();
            setupRealtimeListeners();
        }, 100);
    } else {
        showLoginPrompt();
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
        const stationCard = document.createElement('div');
        stationCard.className = 'station-card card';
        stationCard.dataset.stationId = station.id;
        stationCard.innerHTML = `
            <div class="card-body text-center p-4">
                <div class="station-indicator" style="background-color: ${station.color};">
                    <i class="bi bi-building"></i>
                </div>
                <h5 class="card-title">${station.name}</h5>
                <p class="text-muted small mb-0">Click to send ${station.command}</p>
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

// Select a destination station and send command immediately
async function selectStation(station) {
    if (!currentUser) {
        showNotification('❌ Please login first', 'danger');
        return;
    }
    
    // Remove previous selection
    document.querySelectorAll('.station-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Add selection to clicked card
    const card = document.querySelector(`[data-station-id="${station.id}"]`);
    card.classList.add('selected');
    
    selectedStation = station;
    
    try {
        console.log(`🚀 Sending command ${station.command} for ${station.name}`);
        const toAlteraRef = ref(db, 'toAltera');
        await set(toAlteraRef, station.command);
        
        showNotification(`✅ Sent command ${station.command} to ${station.name}`, 'success');
        
        // Update status
        document.getElementById('selectionHint').textContent = `Sent: ${station.name} (${station.command})`;
        
    } catch (error) {
        console.error('❌ Error sending station command:', error);
        showNotification(`❌ Failed to send command: ${error.message}`, 'danger');
    }
}

// Note: Station selection now sends command immediately - no separate send function needed

// Setup realtime listeners for bot status updates
function setupRealtimeListeners() {
    const botStatusRef = ref(db, 'bot/status');
    
    onValue(botStatusRef, (snapshot) => {
        if (snapshot.exists()) {
            const status = snapshot.val();
            const previousStation = currentStation;
            const previousState = window.botState || 'Ready';
            
            // Update last update time and store timestamp
            if (status.lastUpdated) {
                updateLastUpdateTime(status.lastUpdated);
                window.lastUpdateTimestamp = status.lastUpdated;
            }
            
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
                
                // Reset selection
                selectedStation = null;
                document.getElementById('selectionHint').textContent = 'Select a destination station';
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

    // Listen for fromAltera data changes
    const alteraRef = ref(db, 'fromAltera');
    onValue(alteraRef, (snapshot) => {
        console.log('📥 fromAltera snapshot received');
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            console.log('✅ fromAltera data:', data);
            
            // Firebase uses uppercase A, B, C
            const valueA = data.A !== undefined && data.A !== null ? data.A : '--';
            const valueB = data.B !== undefined && data.B !== null ? data.B : '--';
            const valueC = data.C !== undefined && data.C !== null ? data.C : '--';
            
            console.log('  - A:', valueA);
            console.log('  - B:', valueB);
            console.log('  - C:', valueC);
            
            // Update the display values
            const elemA = document.getElementById('alteraValueA');
            const elemB = document.getElementById('alteraValueB');
            const elemC = document.getElementById('alteraValueC');
            
            if (elemA) {
                elemA.textContent = valueA;
                console.log('✅ Set alteraValueA to:', valueA);
            }
            
            if (elemB) {
                elemB.textContent = valueB;
                console.log('✅ Set alteraValueB to:', valueB);
            }
            
            if (elemC) {
                elemC.textContent = valueC;
                console.log('✅ Set alteraValueC to:', valueC);
            }
            
            // Update color sensor display
            const colorValue = data.C !== undefined && data.C !== null ? parseInt(data.C) : 0;
            console.log('🎨 Calling updateColorSensor with:', colorValue);
            updateColorSensor(colorValue);
        } else {
            console.log('⚠️ No data in fromAltera');
            const elemA = document.getElementById('alteraValueA');
            const elemB = document.getElementById('alteraValueB');
            const elemC = document.getElementById('alteraValueC');
            
            if (elemA) elemA.textContent = '--';
            if (elemB) elemB.textContent = '--';
            if (elemC) elemC.textContent = '--';
            updateColorSensor(0);
        }
    }, (error) => {
        console.error('❌ Error listening to fromAltera data:', error);
    });
}

// Connection monitoring removed - commands send directly to Firebase

// Update last update time display
function updateLastUpdateTime(timestamp) {
    const lastUpdateElement = document.getElementById('lastUpdateTime');
    if (!lastUpdateElement) return;
    
    if (!timestamp) {
        lastUpdateElement.textContent = 'Never';
        return;
    }
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) { // Less than 1 minute
        lastUpdateElement.textContent = 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
        const minutes = Math.floor(diff / 60000);
        lastUpdateElement.textContent = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
        const date = new Date(timestamp);
        lastUpdateElement.textContent = date.toLocaleTimeString();
    }
}

// Manual override function - updates database directly without ESP32
async function manualOverride() {
    if (!selectedStation) {
        showNotification('⚠️ Please select a destination station first', 'warning');
        return;
    }
    
    // Create a modal to confirm manual override
    const modal = document.createElement('div');
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    
    const stationInfo = stations.find(s => s.id === selectedStation.id);
    
    modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header bg-warning text-dark">
                    <h5 class="modal-title">
                        <i class="bi bi-exclamation-triangle me-2"></i>Manual Override
                    </h5>
                    <button type="button" class="btn-close" onclick="this.closest('.modal').remove();"></button>
                </div>
                <div class="modal-body">
                    <p><strong>⚠️ Warning:</strong> This will directly update the database without requiring ESP32 connection.</p>
                    <p>This is useful for testing or when the physical bot is offline.</p>
                    <hr>
                    <p><strong>Selected Station:</strong> ${stationInfo.name}</p>
                    <p><strong>Current Station:</strong> ${stations.find(s => s.id === currentStation)?.name || currentStation}</p>
                    <hr>
                    <div class="form-check mb-2">
                        <input class="form-check-input" type="radio" name="overrideAction" id="actionMoving" value="moving" checked>
                        <label class="form-check-label" for="actionMoving">
                            Set bot to "Moving" state
                        </label>
                    </div>
                    <div class="form-check mb-2">
                        <input class="form-check-input" type="radio" name="overrideAction" id="actionArrived" value="arrived">
                        <label class="form-check-label" for="actionArrived">
                            Set bot as "Arrived" at selected station
                        </label>
                    </div>
                    <div class="form-check mb-2">
                        <input class="form-check-input" type="radio" name="overrideAction" id="actionReady" value="ready">
                        <label class="form-check-label" for="actionReady">
                            Set bot to "Ready" at selected station
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove();">Cancel</button>
                    <button type="button" class="btn btn-warning" id="confirmOverride">
                        <i class="bi bi-pencil-square me-2"></i>Apply Override
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle override confirmation
    document.getElementById('confirmOverride').addEventListener('click', async () => {
        const action = document.querySelector('input[name="overrideAction"]:checked').value;
        modal.remove();
        
        try {
            const botStatusRef = ref(db, 'bot/status');
            
            if (action === 'moving') {
                await set(botStatusRef, {
                    currentStation: currentStation,
                    targetStation: selectedStation.id,
                    state: 'Moving',
                    lastUpdated: Date.now(),
                    manualOverride: true
                });
                showNotification(`✅ Manual Override: Bot set to Moving towards ${stationInfo.name}`, 'success');
            } else if (action === 'arrived') {
                await set(botStatusRef, {
                    currentStation: selectedStation.id,
                    targetStation: '',
                    state: 'Ready',
                    lastUpdated: Date.now(),
                    manualOverride: true
                });
                showNotification(`✅ Manual Override: Bot arrived at ${stationInfo.name}`, 'success');
            } else if (action === 'ready') {
                await set(botStatusRef, {
                    currentStation: selectedStation.id,
                    targetStation: '',
                    state: 'Ready',
                    lastUpdated: Date.now(),
                    manualOverride: true
                });
                showNotification(`✅ Manual Override: Bot is Ready at ${stationInfo.name}`, 'success');
            }
            
            // Log the manual override
            const logRef = ref(db, `bot/logs/${Date.now()}`);
            await set(logRef, {
                action: 'manual_override',
                type: action,
                station: selectedStation.id,
                user: currentUser.email,
                timestamp: Date.now(),
                from: currentStation,
                to: selectedStation.id
            });
            
        } catch (error) {
            console.error('Error applying manual override:', error);
            showNotification(`❌ Override failed: ${error.message}`, 'danger');
        }
    });
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

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    
    // Setup manual control buttons
    setupManualControl();
    
    // Update last update time every 10 seconds
    setInterval(() => {
        if (window.lastUpdateTimestamp) {
            updateLastUpdateTime(window.lastUpdateTimestamp);
        }
    }, 10000);
});

// Setup manual control buttons
function setupManualControl() {
    const forwardBtn = document.getElementById('forwardBtn');
    const leftBtn = document.getElementById('leftBtn');
    const rightBtn = document.getElementById('rightBtn');
    const reverseBtn = document.getElementById('reverseBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    if (forwardBtn) forwardBtn.addEventListener('click', () => sendManualCommand('FORWARD'));
    if (leftBtn) leftBtn.addEventListener('click', () => sendManualCommand('LEFT'));
    if (rightBtn) rightBtn.addEventListener('click', () => sendManualCommand('RIGHT'));
    if (reverseBtn) reverseBtn.addEventListener('click', () => sendManualCommand('REVERSE'));
    if (stopBtn) stopBtn.addEventListener('click', () => sendManualCommand('STOP'));
}

// Send manual control command
async function sendManualCommand(direction) {
    const statusDiv = document.getElementById('manualControlStatus');
    
    try {
        // Send manual control command to Firebase
        const manualControlRef = ref(db, 'bot/manualControl');
        await set(manualControlRef, {
            command: direction,
            timestamp: Date.now(),
            user: currentUser.email
        });
        
        // Update status
        statusDiv.className = 'alert alert-success';
        statusDiv.innerHTML = `<i class="bi bi-check-circle me-2"></i>Command sent: ${direction}`;
        
        // Log the command
        const logRef = ref(db, `bot/logs/${Date.now()}`);
        await set(logRef, {
            action: 'manual_control',
            command: direction,
            user: currentUser.email,
            timestamp: Date.now()
        });
        
        // Reset status after 2 seconds
        setTimeout(() => {
            statusDiv.className = 'alert alert-secondary';
            statusDiv.innerHTML = '<i class="bi bi-info-circle me-2"></i>Ready to send manual commands';
        }, 2000);
        
    } catch (error) {
        console.error('Error sending manual command:', error);
        statusDiv.className = 'alert alert-danger';
        statusDiv.innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i>Error: ${error.message}`;
        showNotification(`❌ Failed to send command: ${error.message}`, 'danger');
    }
}

// Send data to toAltera
window.sendToAltera = async function() {
    const input = document.getElementById('toAlteraInput');
    const status = document.getElementById('sendStatus');
    const value = input.value.trim();

    if (!currentUser) {
        status.style.display = 'block';
        status.className = 'alert alert-danger';
        status.textContent = '❌ Please login first';
        return;
    }

    if (!value) {
        status.style.display = 'block';
        status.className = 'alert alert-warning';
        status.textContent = '⚠️ Please enter some data';
        return;
    }

    try {
        console.log('📤 Sending to toAltera:', value);
        const toAlteraRef = ref(db, 'toAltera');
        await set(toAlteraRef, value);
        
        status.style.display = 'block';
        status.className = 'alert alert-success';
        status.innerHTML = `<i class="bi bi-check-circle me-2"></i>Data sent successfully!`;
        console.log('✅ Data sent to toAltera');
        
        input.value = '';
        
        // Hide status after 3 seconds
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
        
    } catch (error) {
        console.error('❌ Error sending data:', error);
        status.style.display = 'block';
        status.className = 'alert alert-danger';
        status.innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i>Error: ${error.message}`;
    }
}

// Send manual command (direction, container, etc) to toAltera
window.sendManualCommand = async function(commandValue) {
    if (!currentUser) {
        showNotification('❌ Please login first', 'danger');
        return;
    }

    try {
        console.log('📤 Sending command to toAltera:', commandValue);
        const toAlteraRef = ref(db, 'toAltera');
        await set(toAlteraRef, commandValue);
        
        const statusDiv = document.getElementById('manualControlStatus');
        statusDiv.className = 'alert alert-success';
        
        let commandName = 'Command';
        if (commandValue === 10) commandName = 'Forward';
        else if (commandValue === 5) commandName = 'Reverse';
        else if (commandValue === 6) commandName = 'Left';
        else if (commandValue === 9) commandName = 'Right';
        else if (commandValue === 0) commandName = 'Stop';
        else if (commandValue === 127) commandName = 'Open Container';
        else if (commandValue === 64) commandName = 'Close Container';
        
        statusDiv.innerHTML = `<i class="bi bi-check-circle me-2"></i>${commandName} (${commandValue}) sent`;
        console.log(`✅ ${commandName} sent to toAltera`);
        
        // Reset status after 2 seconds
        setTimeout(() => {
            statusDiv.className = 'alert alert-secondary';
            statusDiv.innerHTML = '<i class="bi bi-info-circle me-2"></i>Ready to send manual commands';
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error sending command:', error);
        showNotification(`❌ Failed to send command: ${error.message}`, 'danger');
    }
}

// Toggle light on/off button
window.toggleLight = async function() {
    if (!currentUser) {
        showNotification('❌ Please login first', 'danger');
        return;
    }

    const btn = document.getElementById('lightToggleBtn');
    const lightValue = document.getElementById('lightValue');
    const currentState = btn.getAttribute('data-state');
    
    let value;
    let newState;
    
    if (currentState === 'off') {
        // Turn ON - send 135
        value = 135;
        newState = 'on';
        btn.style.backgroundColor = '#ffc107'; // Yellow/warning color
        btn.innerHTML = '<i class="bi bi-lightbulb-fill"></i> Light ON';
        lightValue.textContent = 'ON (135)';
        lightValue.className = 'badge bg-warning';
    } else {
        // Turn OFF - send 128
        value = 128;
        newState = 'off';
        btn.style.backgroundColor = '#6c757d'; // Gray/secondary color
        btn.innerHTML = '<i class="bi bi-lightbulb"></i> Light OFF';
        lightValue.textContent = 'OFF (128)';
        lightValue.className = 'badge bg-secondary';
    }
    
    try {
        console.log('💡 Toggling light, sending to toAltera:', value);
        const toAlteraRef = ref(db, 'toAltera');
        await set(toAlteraRef, value);
        
        // Update button state
        btn.setAttribute('data-state', newState);
        
        const statusDiv = document.getElementById('manualControlStatus');
        statusDiv.className = 'alert alert-success';
        statusDiv.innerHTML = `<i class="bi bi-lightbulb me-2"></i>Light ${newState === 'on' ? 'ON' : 'OFF'} (${value}) sent`;
        console.log(`✅ Light command sent to toAltera`);
        
        // Reset status after 2 seconds
        setTimeout(() => {
            statusDiv.className = 'alert alert-secondary';
            statusDiv.innerHTML = '<i class="bi bi-info-circle me-2"></i>Ready to send manual commands';
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error sending light command:', error);
        showNotification(`❌ Failed to send light command: ${error.message}`, 'danger');
    }
}

// Toggle manual/auto mode button
window.toggleMode = async function() {
    if (!currentUser) {
        showNotification('❌ Please login first', 'danger');
        return;
    }

    const btn = document.getElementById('modeToggleBtn');
    const modeValue = document.getElementById('modeValue');
    const currentState = btn.getAttribute('data-state');
    
    let value;
    let newState;
    
    if (currentState === 'manual') {
        // Switch to AUTO - send 200
        value = 200;
        newState = 'auto';
        btn.style.backgroundColor = '#0d6efd'; // Blue color
        btn.innerHTML = '<i class="bi bi-gear"></i> Auto Mode';
        modeValue.textContent = 'AUTO (200)';
        modeValue.className = 'badge bg-primary';
    } else {
        // Switch to MANUAL - send 201
        value = 201;
        newState = 'manual';
        btn.style.backgroundColor = '#fd7e14'; // Orange color
        btn.innerHTML = '<i class="bi bi-hand-index"></i> Manual Mode';
        modeValue.textContent = 'MANUAL (201)';
        modeValue.className = 'badge bg-warning';
    }
    
    try {
        console.log('🔧 Toggling mode, sending to toAltera:', value);
        const toAlteraRef = ref(db, 'toAltera');
        await set(toAlteraRef, value);
        
        // Update button state
        btn.setAttribute('data-state', newState);
        
        const statusDiv = document.getElementById('manualControlStatus');
        statusDiv.className = 'alert alert-success';
        statusDiv.innerHTML = `<i class="bi bi-gear me-2"></i>Mode switched to ${newState.toUpperCase()} (${value})`;
        console.log(`✅ Mode command sent to toAltera`);
        
        // Reset status after 2 seconds
        setTimeout(() => {
            statusDiv.className = 'alert alert-secondary';
            statusDiv.innerHTML = '<i class="bi bi-info-circle me-2"></i>Ready to send manual commands';
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error sending mode command:', error);
        showNotification(`❌ Failed to send mode command: ${error.message}`, 'danger');
    }
}

// Send clear command
window.sendClearCommand = async function() {
    if (!currentUser) {
        showNotification('❌ Please login first', 'danger');
        return;
    }
    
    try {
        console.log('🗑️ Sending clear command to toAltera: 192');
        const toAlteraRef = ref(db, 'toAltera');
        await set(toAlteraRef, 192);
        
        const statusDiv = document.getElementById('manualControlStatus');
        statusDiv.className = 'alert alert-success';
        statusDiv.innerHTML = '<i class="bi bi-x-circle me-2"></i>Clear command (192) sent';
        console.log('✅ Clear command sent to toAltera');
        
        // Reset status after 2 seconds
        setTimeout(() => {
            statusDiv.className = 'alert alert-secondary';
            statusDiv.innerHTML = '<i class="bi bi-info-circle me-2"></i>Ready to send manual commands';
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error sending clear command:', error);
        showNotification(`❌ Failed to send clear command: ${error.message}`, 'danger');
    }
}

// Update color sensor display based on value
function updateColorSensor(colorValue) {
    const colorSensor = document.getElementById('colorSensor');
    const colorSensorText = document.getElementById('colorSensorText');
    
    if (!colorSensor || !colorSensorText) {
        console.log('⚠️ Color sensor elements not found');
        return;
    }
    
    // Convert to number if string
    const color = typeof colorValue === 'string' ? parseInt(colorValue) : colorValue;
    
    console.log(`🎨 Updating color sensor with value: ${color} (type: ${typeof color})`);
    
    switch(color) {
        case 0:
            colorSensor.style.backgroundColor = '#999';
            colorSensorText.textContent = 'No Color';
            console.log('🎨 Color Sensor: No Color (0)');
            break;
        case 1:
            colorSensor.style.backgroundColor = '#dc3545';
            colorSensorText.textContent = 'Red';
            console.log('🎨 Color Sensor: Red (1)');
            break;
        case 2:
            colorSensor.style.backgroundColor = '#198754';
            colorSensorText.textContent = 'Green';
            console.log('🎨 Color Sensor: Green (2)');
            break;
        case 4:
            colorSensor.style.backgroundColor = '#0d6efd';
            colorSensorText.textContent = 'Blue';
            console.log('🎨 Color Sensor: Blue (4)');
            break;
        default:
            colorSensor.style.backgroundColor = '#999';
            colorSensorText.textContent = `Unknown (${color})`;
            console.log(`🎨 Color Sensor: Unknown value (${color})`);
    }
}
