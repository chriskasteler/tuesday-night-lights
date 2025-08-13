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
        console.log('Initializing Super Admin Dashboard...');
        
        // Load all platform data
        await loadPlatformData();
        
        // Populate context selectors
        populateContextSelectors();
        
        // Render dashboard data
        renderPlatformOverview();
        renderQuickTeamAccess();
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
            console.log('Adding team option:', {value: team.teamId, text: team.teamName, type: typeof team.teamId});
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
        
        console.log('Switching context:', superAdminData.currentContext);
        console.log('Selected teamId:', teamId, 'Type:', typeof teamId);
        
        // Show admin mode indicator
        showAdminModeIndicator();
        
        // Show appropriate sections based on role
        if (role === 'captain' && teamId) {
            // Show Captain's Tools for the selected team
            console.log('🔥 SUPER ADMIN SWITCH: About to call initializeMyTeam with teamId:', teamId, 'Type:', typeof teamId);
            await initializeMyTeam('super-admin-impersonation', teamId);
            showSection('my-team');
            
            // Update page title to show impersonation
            updateAdminModeIndicator(`Viewing as Captain of ${getTeamName(teamId)}`);
            
        } else if (role === 'admin') {
            // Show Admin Tools
            showSection('manage-teams');
            updateAdminModeIndicator('Viewing as League Admin');
            
        } else if (role === 'player') {
            // Show player view (home page)
            showSection('info');
            updateAdminModeIndicator('Viewing as Player');
            
        } else {
            alert('Please select a team when viewing as Captain');
            return;
        }
        
        // Add success feedback
        showContextSwitchSuccess(role, teamId);
        
    } catch (error) {
        console.error('Error switching context:', error);
        alert('Error switching context. Please try again.');
    }
}

// ===== DASHBOARD RENDERING =====

// Render quick team access buttons
function renderQuickTeamAccess() {
    const quickTeamButtons = document.getElementById('quick-team-buttons');
    if (!quickTeamButtons) return;
    
    const teamButtons = superAdminData.allTeams.map(team => {
        const teamName = team.teamName || `Team ${team.teamId}`;
        return `
            <button onclick="quickAccessTeam(${team.teamId})" 
                    style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-size: 0.9rem; font-weight: 500; transition: all 0.2s;"
                    onmouseover="this.style.background='#0056b3'"
                    onmouseout="this.style.background='#007bff'">
                ${teamName}
            </button>
        `;
    }).join('');
    
    quickTeamButtons.innerHTML = teamButtons;
}

// Quick access to team Captain Tools
async function quickAccessTeam(teamId) {
    try {
        console.log('🚀 QUICK ACCESS TEAM called with teamId:', teamId, 'Type:', typeof teamId);
        
        // Set context selectors
        document.getElementById('context-role').value = 'captain';
        document.getElementById('context-team').value = teamId;
        
        console.log('🎯 Set context selectors - Role:', document.getElementById('context-role').value, 'Team:', document.getElementById('context-team').value);
        
        // Switch context automatically
        await switchContext();
        
    } catch (error) {
        console.error('Error in quick team access:', error);
        alert('Error accessing team. Please try again.');
    }
}

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
        console.log(`Accessing Captain's Tools for Team ${teamId}`);
        
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
    alert('All Lineups view coming soon!\n\nThis will show a master view of all team lineups across all weeks.');
}

// Generate platform report (placeholder)
function generateReport() {
    const report = `
SUPER ADMIN PLATFORM REPORT

Overview:
• Total Players: ${superAdminData.allParticipants.length}
• Total Teams: ${superAdminData.allTeams.length}
• Captains Assigned: ${superAdminData.allParticipants.filter(p => p.teamCaptain).length}

Team Status:
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
        alert(`Bulk messaging coming soon!\n\nMessage would be sent to all captains:\n"${message}"`);
    }
}

// ===== ADMIN MODE INDICATOR =====

// Show the admin mode indicator
function showAdminModeIndicator() {
    // Remove existing indicator if present
    removeAdminModeIndicator();
    
    // Create admin mode indicator
    const indicator = document.createElement('div');
    indicator.id = 'admin-mode-indicator';
    indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #dc3545;
        color: white;
        padding: 8px 15px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        cursor: pointer;
    `;
    indicator.textContent = 'SUPER ADMIN MODE';
    indicator.onclick = () => showSection('super-admin');
    
    document.body.appendChild(indicator);
}

// Update admin mode indicator text
function updateAdminModeIndicator(text) {
    const indicator = document.getElementById('admin-mode-indicator');
    if (indicator) {
        indicator.textContent = `ADMIN: ${text}`;
    }
}

// Remove admin mode indicator
function removeAdminModeIndicator() {
    const existing = document.getElementById('admin-mode-indicator');
    if (existing) {
        existing.remove();
    }
}

// Show context switch success message
function showContextSwitchSuccess(role, teamId) {
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 60px;
        right: 10px;
        background: #28a745;
        color: white;
        padding: 10px 15px;
        border-radius: 4px;
        font-size: 0.9rem;
        z-index: 9998;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    
    if (role === 'captain' && teamId) {
        message.textContent = `Switched to Captain view for ${getTeamName(teamId)}`;
    } else if (role === 'admin') {
        message.textContent = 'Switched to League Admin view';
    } else if (role === 'player') {
        message.textContent = 'Switched to Player view';
    }
    
    document.body.appendChild(message);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (message.parentNode) {
            message.remove();
        }
    }, 3000);
}

// Get team name by ID
function getTeamName(teamId) {
    console.log('Looking for team with ID:', teamId, 'Type:', typeof teamId);
    console.log('Available teams:', superAdminData.allTeams.map(t => ({id: t.teamId, name: t.teamName, type: typeof t.teamId})));
    
    // Try both string and number matching
    const team = superAdminData.allTeams.find(t => t.teamId == teamId || String(t.teamId) == String(teamId) || Number(t.teamId) == Number(teamId));
    
    console.log('Found team:', team);
    return team ? (team.teamName || `Team ${teamId}`) : `Team ${teamId}`;
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
