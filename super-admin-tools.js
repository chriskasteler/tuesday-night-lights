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
        populateBulkLineupWeeks();
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
        console.log('🔄 Loading platform data...');
        const basePath = `clubs/${superAdminData.currentContext.clubId}/leagues/${superAdminData.currentContext.leagueId}/seasons/${superAdminData.currentContext.seasonId}`;
        console.log('📍 Using path:', basePath);
        
        // Load participants
        console.log('📥 Loading participants...');
        const participantsSnapshot = await db.collection(`${basePath}/participants`).get();
        superAdminData.allParticipants = [];
        participantsSnapshot.forEach(doc => {
            superAdminData.allParticipants.push({ id: doc.id, ...doc.data() });
        });
        console.log(`✅ Loaded ${superAdminData.allParticipants.length} participants`);
        
        // Load teams
        console.log('📥 Loading teams...');
        const teamsSnapshot = await db.collection(`${basePath}/teams`).orderBy('teamId', 'asc').get();
        superAdminData.allTeams = [];
        teamsSnapshot.forEach(doc => {
            superAdminData.allTeams.push({ id: doc.id, ...doc.data() });
        });
        console.log(`✅ Loaded ${superAdminData.allTeams.length} teams:`, superAdminData.allTeams.map(t => t.teamName || `Team ${t.teamId}`));
        
        console.log('📊 Platform data loading complete');
        
    } catch (error) {
        console.error('❌ Error loading platform data:', error);
        throw error;
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
    console.log('🎯 Rendering quick team access...');
    const quickTeamButtons = document.getElementById('quick-team-buttons');
    if (!quickTeamButtons) {
        console.error('❌ quick-team-buttons element not found');
        return;
    }
    
    console.log('📋 Teams available for quick access:', superAdminData.allTeams.length);
    
    if (superAdminData.allTeams.length === 0) {
        quickTeamButtons.innerHTML = '<p style="color: #999; font-style: italic;">No teams loaded</p>';
        return;
    }
    
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
    console.log('✅ Quick team access rendered with', superAdminData.allTeams.length, 'teams');
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

// ===== BULK LINEUP MANAGEMENT =====

// Populate week selector for bulk lineup management
function populateBulkLineupWeeks() {
    console.log('📅 Populating bulk lineup weeks...');
    const weekSelect = document.getElementById('bulk-lineup-week');
    if (!weekSelect) {
        console.error('❌ bulk-lineup-week element not found');
        return;
    }
    
    // Generate weeks (adjust as needed for your season)
    const weeks = [
        { value: '2025-08-19', text: 'Week 1 (Aug 19)' },
        { value: '2025-08-26', text: 'Week 2 (Aug 26)' },
        { value: '2025-09-02', text: 'Week 3 (Sep 2)' },
        { value: '2025-09-09', text: 'Week 4 (Sep 9)' },
        { value: '2025-09-16', text: 'Week 5 (Sep 16)' },
        { value: '2025-09-23', text: 'Week 6 (Sep 23)' },
        { value: '2025-09-30', text: 'Week 7 (Sep 30)' },
        { value: '2025-10-07', text: 'Week 8 (Oct 7)' }
    ];
    
    weekSelect.innerHTML = '<option value="">Choose a week...</option>';
    weeks.forEach(week => {
        const option = document.createElement('option');
        option.value = week.value;
        option.textContent = week.text;
        weekSelect.appendChild(option);
    });
    
    console.log('✅ Bulk lineup weeks populated with', weeks.length, 'weeks');
}

// Load and display bulk lineups for selected week
async function loadBulkLineups() {
    const selectedWeek = document.getElementById('bulk-lineup-week').value;
    const grid = document.getElementById('bulk-lineups-grid');
    const bulkActions = document.getElementById('bulk-actions');
    
    if (!selectedWeek) {
        grid.innerHTML = '<p style="color: #999; text-align: center; grid-column: 1 / -1;">Select a week to view lineups</p>';
        bulkActions.style.display = 'none';
        return;
    }
    
    try {
        grid.innerHTML = '<p style="color: #666; text-align: center; grid-column: 1 / -1;">Loading lineups...</p>';
        
        const lineupCards = await Promise.all(superAdminData.allTeams.map(async (team) => {
            const teamName = team.teamName || `Team ${team.teamId}`;
            const lineup = await getTeamLineupForWeek(team.teamId, selectedWeek);
            const hasLineup = lineup && Object.keys(lineup).length > 0;
            
            return `
                <div style="border: 1px solid #ddd; border-radius: 6px; padding: 15px; background: ${hasLineup ? '#f8f9fa' : '#fff8e1'};">
                    <h4 style="color: #2c5aa0; margin: 0 0 10px 0; display: flex; align-items: center; justify-content: space-between;">
                        ${teamName}
                        <span style="font-size: 0.8rem; padding: 2px 8px; border-radius: 12px; background: ${hasLineup ? '#28a745' : '#ffc107'}; color: ${hasLineup ? 'white' : '#856404'};">
                            ${hasLineup ? 'Set' : 'Missing'}
                        </span>
                    </h4>
                    ${hasLineup ? renderLineupSummary(lineup) : renderBulkLineupEditor(team.teamId, selectedWeek)}
                    <div style="margin-top: 10px;">
                        <button onclick="toggleBulkLineupEditor(${team.teamId}, '${selectedWeek}')" style="background: #007bff; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 0.8rem; margin-right: 5px;">
                            ${hasLineup ? 'Edit Here' : 'Set Lineup'}
                        </button>
                        <button onclick="quickAccessTeam(${team.teamId})" style="background: #6c757d; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 0.8rem; margin-right: 5px;">
                            Captain View
                        </button>
                        ${hasLineup ? `<button onclick="clearTeamLineup(${team.teamId}, '${selectedWeek}')" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 0.8rem;">Clear</button>` : ''}
                    </div>
                </div>
            `;
        }));
        
        grid.innerHTML = lineupCards.join('');
        bulkActions.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading bulk lineups:', error);
        grid.innerHTML = '<p style="color: #dc3545; text-align: center; grid-column: 1 / -1;">Error loading lineups. Please try again.</p>';
    }
}

// Get team lineup for specific week
async function getTeamLineupForWeek(teamId, week) {
    try {
        const lineupDoc = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/lineups')
            .doc(`${teamId}-${week}`)
            .get();
        
        return lineupDoc.exists ? lineupDoc.data() : null;
    } catch (error) {
        console.error(`Error loading lineup for team ${teamId}, week ${week}:`, error);
        return null;
    }
}

// Render lineup summary
function renderLineupSummary(lineup) {
    const positions = ['1', '2', '3', '4', '5', '6'];
    const positionNames = positions.map(pos => {
        const player = lineup[`position${pos}`];
        return player ? player.name || 'Empty';
    }).join(', ');
    
    return `<p style="font-size: 0.85rem; color: #666; margin: 5px 0;">${positionNames}</p>`;
}

// Render bulk lineup editor for teams without lineups
function renderBulkLineupEditor(teamId, week) {
    return `
        <div id="bulk-editor-${teamId}" style="display: none; margin: 5px 0;">
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; font-size: 0.8rem;">
                <select id="pos1-${teamId}" style="padding: 2px; font-size: 0.75rem;">
                    <option value="">Position 1</option>
                </select>
                <select id="pos2-${teamId}" style="padding: 2px; font-size: 0.75rem;">
                    <option value="">Position 2</option>
                </select>
                <select id="pos3-${teamId}" style="padding: 2px; font-size: 0.75rem;">
                    <option value="">Position 3</option>
                </select>
                <select id="pos4-${teamId}" style="padding: 2px; font-size: 0.75rem;">
                    <option value="">Position 4</option>
                </select>
                <select id="pos5-${teamId}" style="padding: 2px; font-size: 0.75rem;">
                    <option value="">Position 5</option>
                </select>
                <select id="pos6-${teamId}" style="padding: 2px; font-size: 0.75rem;">
                    <option value="">Position 6</option>
                </select>
            </div>
            <div style="margin-top: 5px;">
                <button onclick="saveBulkLineup(${teamId}, '${week}')" style="background: #28a745; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 0.75rem; margin-right: 5px;">
                    Save Lineup
                </button>
                <button onclick="cancelBulkLineupEditor(${teamId})" style="background: #6c757d; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 0.75rem;">
                    Cancel
                </button>
            </div>
        </div>
    `;
}

// Toggle bulk lineup editor visibility and populate player dropdowns
async function toggleBulkLineupEditor(teamId, week) {
    const editor = document.getElementById(`bulk-editor-${teamId}`);
    if (!editor) return;
    
    if (editor.style.display === 'none') {
        // Show editor and populate with team players
        editor.style.display = 'block';
        await populateBulkLineupDropdowns(teamId, week);
    } else {
        // Hide editor
        editor.style.display = 'none';
    }
}

// Populate dropdown selectors with team players
async function populateBulkLineupDropdowns(teamId, week) {
    try {
        // Get team roster
        const roster = await getTeamRoster(teamId);
        
        // Get current lineup if it exists
        const currentLineup = await getTeamLineupForWeek(teamId, week);
        
        // Populate each position dropdown
        for (let pos = 1; pos <= 6; pos++) {
            const select = document.getElementById(`pos${pos}-${teamId}`);
            if (!select) continue;
            
            // Clear existing options except placeholder
            select.innerHTML = `<option value="">Position ${pos}</option>`;
            
            // Add team players
            roster.forEach(player => {
                const option = document.createElement('option');
                option.value = JSON.stringify({
                    name: player.name,
                    email: player.email,
                    userId: player.userId || null
                });
                option.textContent = player.name;
                
                // Select current player if lineup exists
                if (currentLineup && currentLineup[`position${pos}`] && 
                    currentLineup[`position${pos}`].name === player.name) {
                    option.selected = true;
                }
                
                select.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Error populating bulk lineup dropdowns:', error);
    }
}

// Get team roster from database
async function getTeamRoster(teamId) {
    try {
        const participantsSnapshot = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/participants')
            .where('teamId', '==', String(teamId))
            .get();
        
        const roster = [];
        participantsSnapshot.forEach(doc => {
            const data = doc.data();
            roster.push({
                name: data.name,
                email: data.email,
                userId: data.userId || null
            });
        });
        
        return roster;
    } catch (error) {
        console.error('Error loading team roster:', error);
        return [];
    }
}

// Save bulk lineup to database
async function saveBulkLineup(teamId, week) {
    try {
        const lineup = {};
        let hasPlayers = false;
        
        // Collect selections from dropdowns
        for (let pos = 1; pos <= 6; pos++) {
            const select = document.getElementById(`pos${pos}-${teamId}`);
            if (select && select.value) {
                lineup[`position${pos}`] = JSON.parse(select.value);
                hasPlayers = true;
            }
        }
        
        if (!hasPlayers) {
            alert('Please select at least one player');
            return;
        }
        
        // Save to database
        await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/lineups')
            .doc(`${teamId}-${week}`)
            .set(lineup);
        
        alert('Lineup saved successfully!');
        
        // Refresh the bulk lineups display
        loadBulkLineups();
        
    } catch (error) {
        console.error('Error saving bulk lineup:', error);
        alert('Error saving lineup. Please try again.');
    }
}

// Cancel bulk lineup editor
function cancelBulkLineupEditor(teamId) {
    const editor = document.getElementById(`bulk-editor-${teamId}`);
    if (editor) {
        editor.style.display = 'none';
    }
}

// Show bulk lineup template modal
function showBulkLineupTemplate() {
    const modal = document.getElementById('bulk-template-modal');
    if (!modal) return;
    
    // Populate team checkboxes
    const checkboxContainer = document.getElementById('bulk-team-checkboxes');
    const sourceTeamSelect = document.getElementById('source-team-select');
    
    if (checkboxContainer) {
        const checkboxes = superAdminData.allTeams.map(team => {
            const teamName = team.teamName || `Team ${team.teamId}`;
            return `
                <label style="display: flex; align-items: center; padding: 5px;">
                    <input type="checkbox" value="${team.teamId}" style="margin-right: 8px;">
                    ${teamName}
                </label>
            `;
        }).join('');
        checkboxContainer.innerHTML = checkboxes;
    }
    
    // Populate source team selector
    if (sourceTeamSelect) {
        sourceTeamSelect.innerHTML = '<option value="">Choose team...</option>';
        superAdminData.allTeams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.teamId;
            option.textContent = team.teamName || `Team ${team.teamId}`;
            sourceTeamSelect.appendChild(option);
        });
    }
    
    // Show modal
    modal.style.display = 'block';
    
    // Setup action selector change handler
    const actionSelect = document.getElementById('bulk-template-action');
    const copyTeamSelector = document.getElementById('copy-team-selector');
    
    actionSelect.onchange = function() {
        if (this.value === 'copy-team') {
            copyTeamSelector.style.display = 'block';
        } else {
            copyTeamSelector.style.display = 'none';
        }
    };
}

// Close bulk template modal
function closeBulkTemplateModal() {
    const modal = document.getElementById('bulk-template-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Execute bulk template action
async function executeBulkTemplate() {
    const selectedWeek = document.getElementById('bulk-lineup-week').value;
    if (!selectedWeek) {
        alert('Please select a week first');
        return;
    }
    
    // Get selected teams
    const checkboxes = document.querySelectorAll('#bulk-team-checkboxes input[type="checkbox"]:checked');
    const selectedTeamIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedTeamIds.length === 0) {
        alert('Please select at least one team');
        return;
    }
    
    const action = document.getElementById('bulk-template-action').value;
    if (!action) {
        alert('Please select an action');
        return;
    }
    
    try {
        let successCount = 0;
        const batch = db.batch();
        
        for (const teamId of selectedTeamIds) {
            if (action === 'clear') {
                // Clear lineup
                const lineupRef = db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/lineups')
                    .doc(`${teamId}-${selectedWeek}`);
                batch.delete(lineupRef);
                successCount++;
                
            } else if (action === 'copy-team') {
                // Copy from another team
                const sourceTeamId = document.getElementById('source-team-select').value;
                if (!sourceTeamId) {
                    alert('Please select a source team to copy from');
                    return;
                }
                
                const sourceLineup = await getTeamLineupForWeek(sourceTeamId, selectedWeek);
                if (sourceLineup) {
                    const lineupRef = db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/lineups')
                        .doc(`${teamId}-${selectedWeek}`);
                    batch.set(lineupRef, sourceLineup);
                    successCount++;
                }
                
            } else if (action === 'auto-assign') {
                // Auto-assign players in roster order
                const roster = await getTeamRoster(teamId);
                if (roster.length > 0) {
                    const lineup = {};
                    for (let i = 0; i < Math.min(6, roster.length); i++) {
                        lineup[`position${i + 1}`] = {
                            name: roster[i].name,
                            email: roster[i].email,
                            userId: roster[i].userId || null
                        };
                    }
                    
                    const lineupRef = db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/lineups')
                        .doc(`${teamId}-${selectedWeek}`);
                    batch.set(lineupRef, lineup);
                    successCount++;
                }
            }
        }
        
        if (successCount > 0) {
            await batch.commit();
            alert(`Successfully applied action to ${successCount} teams`);
            closeBulkTemplateModal();
            loadBulkLineups(); // Refresh display
        } else {
            alert('No changes were made');
        }
        
    } catch (error) {
        console.error('Error executing bulk template:', error);
        alert('Error applying bulk action. Please try again.');
    }
}

// Refresh bulk lineups (reload current selection)
function refreshBulkLineups() {
    loadBulkLineups();
}

// Copy lineups from previous week
async function copyLineupsFromPreviousWeek() {
    const selectedWeek = document.getElementById('bulk-lineup-week').value;
    if (!selectedWeek) {
        alert('Please select a week first');
        return;
    }
    
    if (!confirm('Copy lineups from the previous week for all teams? This will overwrite any existing lineups.')) {
        return;
    }
    
    try {
        // Calculate previous week (simplified - assumes weekly intervals)
        const currentDate = new Date(selectedWeek);
        const previousDate = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        const previousWeek = previousDate.toISOString().split('T')[0];
        
        let copiedCount = 0;
        const batch = db.batch();
        
        for (const team of superAdminData.allTeams) {
            const previousLineup = await getTeamLineupForWeek(team.teamId, previousWeek);
            if (previousLineup) {
                const newLineupRef = db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/lineups')
                    .doc(`${team.teamId}-${selectedWeek}`);
                batch.set(newLineupRef, previousLineup);
                copiedCount++;
            }
        }
        
        if (copiedCount > 0) {
            await batch.commit();
            alert(`Copied lineups for ${copiedCount} teams from previous week`);
            loadBulkLineups(); // Refresh display
        } else {
            alert('No lineups found in previous week to copy');
        }
        
    } catch (error) {
        console.error('Error copying lineups:', error);
        alert('Error copying lineups. Please try again.');
    }
}

// Clear all lineups for selected week
async function clearAllLineups() {
    const selectedWeek = document.getElementById('bulk-lineup-week').value;
    if (!selectedWeek) {
        alert('Please select a week first');
        return;
    }
    
    if (!confirm('Clear ALL lineups for this week? This cannot be undone.')) {
        return;
    }
    
    try {
        const batch = db.batch();
        
        for (const team of superAdminData.allTeams) {
            const lineupRef = db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/lineups')
                .doc(`${team.teamId}-${selectedWeek}`);
            batch.delete(lineupRef);
        }
        
        await batch.commit();
        alert('All lineups cleared for this week');
        loadBulkLineups(); // Refresh display
        
    } catch (error) {
        console.error('Error clearing lineups:', error);
        alert('Error clearing lineups. Please try again.');
    }
}

// Clear specific team lineup
async function clearTeamLineup(teamId, week) {
    if (!confirm('Clear this team\'s lineup? This cannot be undone.')) {
        return;
    }
    
    try {
        await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/lineups')
            .doc(`${teamId}-${week}`)
            .delete();
        
        alert('Lineup cleared');
        loadBulkLineups(); // Refresh display
        
    } catch (error) {
        console.error('Error clearing team lineup:', error);
        alert('Error clearing lineup. Please try again.');
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
