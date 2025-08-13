// Super Admin Tools JavaScript
// Handles platform-wide management and impersonation capabilities

// ===== SUPER ADMIN DATA =====
let superAdminData = {
    currentContext: {
        clubId: 'braemar-country-club',
        leagueId: 'braemar-highland-league',
        seasonId: '2025',
        role: 'admin',
        teamId: null
    },
    allClubs: [],
    allLeagues: [],
    allTeams: [],
    allParticipants: []
};

// ===== INITIALIZATION =====

// Initialize Super Admin Dashboard
async function initializeSuperAdmin() {
    try {
        console.log('🚀 Initializing Super Admin Dashboard...');
        
        // Load all platform data
        await loadPlatformData();
        
        // Populate context selectors
        populateContextSelectors();
        
        // Render dashboard data
        renderPlatformOverview();
        renderTeamsGrid();
        loadRecentActivity();
        
        console.log('✅ Super Admin Dashboard initialized');
        
    } catch (error) {
        console.error('❌ Error initializing Super Admin Dashboard:', error);
    }
}

// ===== DATA LOADING =====

// Load all platform data for overview
async function loadPlatformData() {
    try {
        const basePath = `clubs/${superAdminData.currentContext.clubId}/leagues/${superAdminData.currentContext.leagueId}/seasons/${superAdminData.currentContext.seasonId}`;
        
        // Load participants
        const participantsSnapshot = await db.collection(`${basePath}/participants`).get();
        superAdminData.allParticipants = [];
        participantsSnapshot.forEach(doc => {
            superAdminData.allParticipants.push({ id: doc.id, ...doc.data() });
        });
        
        // Load teams
        const teamsSnapshot = await db.collection(`${basePath}/teams`).orderBy('teamId', 'asc').get();
        superAdminData.allTeams = [];
        teamsSnapshot.forEach(doc => {
            superAdminData.allTeams.push({ id: doc.id, ...doc.data() });
        });
        
        console.log(`📊 Loaded ${superAdminData.allParticipants.length} participants and ${superAdminData.allTeams.length} teams`);
        
    } catch (error) {
        console.error('Error loading platform data:', error);
    }
}

// ===== CONTEXT SWITCHING =====

// Populate the context selector dropdowns
function populateContextSelectors() {
    // Populate teams dropdown for captain context
    const teamSelect = document.getElementById('context-team');
    if (teamSelect) {
        teamSelect.innerHTML = '<option value="">Select Team...</option>';
        
        superAdminData.allTeams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.teamId;
            option.textContent = team.teamName || `Team ${team.teamId}`;
            teamSelect.appendChild(option);
        });
    }
}

// Switch context (impersonation)
async function switchContext() {
    try {
        const clubId = document.getElementById('context-club').value;
        const leagueId = document.getElementById('context-league').value;
        const role = document.getElementById('context-role').value;
        const teamId = document.getElementById('context-team').value;
        
        // Update current context
        superAdminData.currentContext = {
            clubId,
            leagueId,
            seasonId: '2025',
            role,
            teamId: teamId || null
        };
        
        console.log('🎯 Switching context:', superAdminData.currentContext);
        
        // Show appropriate sections based on role
        if (role === 'captain' && teamId) {
            // Show Captain's Tools for the selected team
            await initializeMyTeam('super-admin-impersonation', teamId);
            showSection('my-team');
        } else if (role === 'admin') {
            // Show Admin Tools
            showSection('manage-teams');
        } else {
            alert('Please select a team when viewing as Captain');
        }
        
    } catch (error) {
        console.error('Error switching context:', error);
        alert('Error switching context. Please try again.');
    }
}

// ===== DASHBOARD RENDERING =====

// Render platform overview statistics
function renderPlatformOverview() {
    // Update participant count
    const totalParticipantsEl = document.getElementById('total-participants');
    if (totalParticipantsEl) {
        totalParticipantsEl.textContent = superAdminData.allParticipants.length;
    }
    
    // Update team count
    const totalTeamsEl = document.getElementById('total-teams');
    if (totalTeamsEl) {
        totalTeamsEl.textContent = superAdminData.allTeams.length;
    }
}

// Render teams grid with captain access
function renderTeamsGrid() {
    const teamsGrid = document.getElementById('super-admin-teams-grid');
    if (!teamsGrid) return;
    
    const teamCards = superAdminData.allTeams.map(team => {
        const captain = superAdminData.allParticipants.find(p => 
            p.teamId === team.teamId && p.teamCaptain
        );
        
        const playerCount = superAdminData.allParticipants.filter(p => 
            p.teamId === team.teamId
        ).length;
        
        return `
            <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #2c5aa0;">${team.teamName || `Team ${team.teamId}`}</h4>
                <p style="margin: 0 0 5px 0; color: #666; font-size: 0.9rem;">
                    Captain: ${captain ? captain.name : 'Not assigned'}
                </p>
                <p style="margin: 0 0 15px 0; color: #666; font-size: 0.9rem;">
                    Players: ${playerCount}/6
                </p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="accessCaptainTools(${team.teamId})" 
                            style="background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                        Captain Tools
                    </button>
                    <button onclick="viewTeamDetails(${team.teamId})" 
                            style="background: #17a2b8; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                        View Details
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    teamsGrid.innerHTML = teamCards;
}

// Load recent activity across the platform
async function loadRecentActivity() {
    const activityContainer = document.getElementById('recent-activity');
    if (!activityContainer) return;
    
    // For now, show placeholder activity
    // In the future, this could track actual user actions
    const activities = [
        { action: 'Team lineup updated', team: 'Eagles', time: '2 minutes ago' },
        { action: 'Scores submitted', team: 'Hawks vs Falcons', time: '1 hour ago' },
        { action: 'New player registered', team: 'General', time: '3 hours ago' },
        { action: 'Team name changed', team: 'Phoenixes', time: '1 day ago' }
    ];
    
    const activityHtml = activities.map(activity => `
        <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
            <p style="margin: 0; font-size: 0.9rem;">
                <strong>${activity.action}</strong>
                ${activity.team !== 'General' ? `• ${activity.team}` : ''}
            </p>
            <p style="margin: 0; color: #999; font-size: 0.8rem;">${activity.time}</p>
        </div>
    `).join('');
    
    activityContainer.innerHTML = activityHtml;
}

// ===== QUICK ACTIONS =====

// Access Captain's Tools for a specific team
async function accessCaptainTools(teamId) {
    try {
        console.log(`🎯 Accessing Captain's Tools for Team ${teamId}`);
        
        // Set context
        document.getElementById('context-role').value = 'captain';
        document.getElementById('context-team').value = teamId;
        
        // Switch to captain context
        await switchContext();
        
    } catch (error) {
        console.error('Error accessing captain tools:', error);
        alert('Error accessing Captain\'s Tools. Please try again.');
    }
}

// View team details
function viewTeamDetails(teamId) {
    const team = superAdminData.allTeams.find(t => t.teamId === teamId);
    const teamPlayers = superAdminData.allParticipants.filter(p => p.teamId === teamId);
    
    const details = `
Team: ${team.teamName || `Team ${teamId}`}
Players: ${teamPlayers.length}/6

Players:
${teamPlayers.map(p => `• ${p.name}${p.teamCaptain ? ' (Captain)' : ''}`).join('\n')}
    `;
    
    alert(details);
}

// Open Captain Tools modal/selector
function openCaptainToolsFor() {
    const teamSelect = document.getElementById('context-team');
    if (teamSelect.options.length <= 1) {
        alert('No teams available. Please ensure teams are loaded.');
        return;
    }
    
    const selectedTeam = prompt(`Enter team number (1-${superAdminData.allTeams.length}) to access their Captain's Tools:`);
    if (selectedTeam) {
        const teamId = parseInt(selectedTeam);
        if (teamId >= 1 && teamId <= superAdminData.allTeams.length) {
            accessCaptainTools(teamId);
        } else {
            alert('Invalid team number');
        }
    }
}

// View all lineups (placeholder)
function viewAllLineups() {
    alert('🚧 All Lineups view coming soon!\n\nThis will show a master view of all team lineups across all weeks.');
}

// Generate platform report (placeholder)
function generateReport() {
    const report = `
🚀 SUPER ADMIN PLATFORM REPORT

📊 Overview:
• Total Players: ${superAdminData.allParticipants.length}
• Total Teams: ${superAdminData.allTeams.length}
• Captains Assigned: ${superAdminData.allParticipants.filter(p => p.teamCaptain).length}

👥 Team Status:
${superAdminData.allTeams.map(team => {
    const players = superAdminData.allParticipants.filter(p => p.teamId === team.teamId);
    return `• ${team.teamName || `Team ${team.teamId}`}: ${players.length}/6 players`;
}).join('\n')}
    `;
    
    alert(report);
}

// Send bulk message (placeholder)
function sendBulkMessage() {
    const message = prompt('Enter message to send to all captains:');
    if (message) {
        alert(`🚧 Bulk messaging coming soon!\n\nMessage would be sent to all captains:\n"${message}"`);
    }
}

// ===== UTILITY FUNCTIONS =====

// Check if current user is super admin
function isSuperAdmin(userEmail) {
    return userEmail === 'chris.kasteler@me.com'; // Your email
}

// Initialize when page loads (if super admin section is visible)
document.addEventListener('DOMContentLoaded', function() {
    // Check if super admin section exists and user has access
    if (document.getElementById('super-admin-section')) {
        const user = firebase.auth().currentUser;
        if (user && isSuperAdmin(user.email)) {
            // Will be initialized when section is shown
            console.log('Super Admin tools ready for initialization');
        }
    }
});
