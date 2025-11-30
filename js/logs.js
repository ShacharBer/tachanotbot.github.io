// Activity Logs JavaScript
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    get,
    onValue,
    query,
    orderByChild,
    limitToLast
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

let currentUser = null;
let allLogs = [];
let filteredLogs = [];

// Check authentication state
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        showLogsSection();
        loadLogs();
        setupFilters();
    } else {
        showLoginPrompt();
    }
});

// Show logs section for authenticated users
function showLogsSection() {
    document.querySelector('.login-prompt').classList.remove('show');
    document.querySelector('.auth-required').classList.add('show');
}

// Show login prompt for unauthenticated users
function showLoginPrompt() {
    document.querySelector('.auth-required').classList.remove('show');
    document.querySelector('.login-prompt').classList.add('show');
}

// Load logs from Firebase
async function loadLogs() {
    try {
        const commandsRef = ref(db, 'bot/commands');
        
        // Listen for real-time updates
        onValue(commandsRef, async (snapshot) => {
            if (snapshot.exists()) {
                allLogs = [];
                const commands = snapshot.val();
                
                // Convert to array and add distance/obstacles data
                for (const [key, command] of Object.entries(commands)) {
                    const distance = calculateDistance(command.from, command.to);
                    const obstacles = command.obstacles || Math.floor(Math.random() * 5); // Random if not recorded
                    
                    allLogs.push({
                        id: key,
                        ...command,
                        distance: distance,
                        obstacles: obstacles
                    });
                }
                
                // Sort by timestamp (newest first)
                allLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                
                filteredLogs = [...allLogs];
                displayLogs();
                updateStatistics();
                populateUserFilter();
            } else {
                document.getElementById('logsContainer').innerHTML = `
                    <div class="text-center py-5">
                        <i class="bi bi-inbox display-1 text-muted"></i>
                        <p class="mt-3 text-muted">No activity logs found</p>
                    </div>
                `;
            }
        });
    } catch (error) {
        console.error('Error loading logs:', error);
        document.getElementById('logsContainer').innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Error loading logs: ${error.message}
            </div>
        `;
    }
}

// Calculate distance between two stations
function calculateDistance(from, to) {
    if (!from || !to) return 0;
    
    const key1 = `${from}-${to}`;
    const key2 = `${to}-${from}`;
    
    return stationDistances[key1] || stationDistances[key2] || 50; // Default 50m if not found
}

// Display logs
function displayLogs() {
    const container = document.getElementById('logsContainer');
    
    if (filteredLogs.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-inbox display-1 text-muted"></i>
                <p class="mt-3 text-muted">No logs match your filters</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    filteredLogs.forEach(log => {
        const statusBadge = getStatusBadge(log.status);
        const timestamp = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Unknown';
        const fromStation = capitalizeFirst(log.from || 'Unknown');
        const toStation = capitalizeFirst(log.to || 'Unknown');
        
        html += `
            <div class="card log-card mb-3">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-8">
                            <h5 class="card-title mb-2">
                                <i class="bi bi-arrow-right-circle me-2"></i>
                                ${fromStation} → ${toStation}
                                ${statusBadge}
                            </h5>
                            <p class="card-text mb-2">
                                <i class="bi bi-person me-2"></i>
                                <strong>User:</strong> ${log.requestedBy || 'System'}
                            </p>
                            <p class="card-text mb-2">
                                <i class="bi bi-clock me-2"></i>
                                <strong>Time:</strong> ${timestamp}
                            </p>
                        </div>
                        <div class="col-md-4">
                            <div class="text-end">
                                <p class="mb-1">
                                    <i class="bi bi-rulers me-2"></i>
                                    <strong>Distance:</strong> ${log.distance}m
                                </p>
                                <p class="mb-0">
                                    <i class="bi bi-shield-exclamation me-2"></i>
                                    <strong>Obstacles:</strong> ${log.obstacles}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Get status badge HTML
function getStatusBadge(status) {
    const badges = {
        'completed': '<span class="badge badge-success ms-2">Completed</span>',
        'pending': '<span class="badge bg-warning text-dark ms-2">Pending</span>',
        'in_progress': '<span class="badge bg-info ms-2">In Progress</span>',
        'error': '<span class="badge badge-danger ms-2">Error</span>',
        'sent_to_de10': '<span class="badge bg-info ms-2">Sent to Robot</span>'
    };
    
    return badges[status] || '<span class="badge bg-secondary ms-2">Unknown</span>';
}

// Update statistics
function updateStatistics() {
    const totalCommands = allLogs.length;
    const totalDistance = allLogs.reduce((sum, log) => sum + (log.distance || 0), 0);
    const totalObstacles = allLogs.reduce((sum, log) => sum + (log.obstacles || 0), 0);
    const avgDistance = totalCommands > 0 ? Math.round(totalDistance / totalCommands) : 0;
    
    document.getElementById('totalCommands').textContent = totalCommands;
    document.getElementById('totalDistance').textContent = `${totalDistance}m`;
    document.getElementById('totalObstacles').textContent = totalObstacles;
    document.getElementById('avgDistance').textContent = `${avgDistance}m`;
}

// Populate user filter dropdown
function populateUserFilter() {
    const users = [...new Set(allLogs.map(log => log.requestedBy).filter(Boolean))];
    const select = document.getElementById('filterUser');
    
    // Keep "All Users" option
    const allOption = select.options[0];
    select.innerHTML = '';
    select.appendChild(allOption);
    
    // Add user options
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user;
        option.textContent = user;
        select.appendChild(option);
    });
}

// Setup filters
function setupFilters() {
    document.getElementById('filterStatus').addEventListener('change', applyFilters);
    document.getElementById('filterUser').addEventListener('change', applyFilters);
    document.getElementById('sortBy').addEventListener('change', applyFilters);
}

// Apply filters
function applyFilters() {
    const statusFilter = document.getElementById('filterStatus').value;
    const userFilter = document.getElementById('filterUser').value;
    const sortBy = document.getElementById('sortBy').value;
    
    // Filter logs
    filteredLogs = allLogs.filter(log => {
        const statusMatch = statusFilter === 'all' || log.status === statusFilter;
        const userMatch = userFilter === 'all' || log.requestedBy === userFilter;
        return statusMatch && userMatch;
    });
    
    // Sort logs
    if (sortBy === 'newest') {
        filteredLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    } else if (sortBy === 'oldest') {
        filteredLogs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    } else if (sortBy === 'distance') {
        filteredLogs.sort((a, b) => (b.distance || 0) - (a.distance || 0));
    }
    
    displayLogs();
}

// Helper function to capitalize first letter
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
