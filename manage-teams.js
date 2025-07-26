// Team Management JavaScript Functions

let allPlayers = [];
let currentTeams = [];

// Initialize the manage teams functionality
function initializeManageTeams() {
    console.log('Initializing manage teams...');
    loadPlayersAndTeams();
}

// Load all players and teams from Firebase
async function loadPlayersAndTeams() {
    try {
        // Load participants
        const participantsSnapshot = await db.collection('participants').orderBy('name', 'asc').get();
        allPlayers = [];
        participantsSnapshot.forEach((doc) => {
            allPlayers.push({ id: doc.id, ...doc.data() });
        });

        // Load teams (or create default structure)
        const teamsSnapshot = await db.collection('teams').orderBy('teamId', 'asc').get();
        
        if (teamsSnapshot.empty) {
            // Create default teams structure
            await createDefaultTeams();
        } else {
            currentTeams = [];
            teamsSnapshot.forEach((doc) => {
                currentTeams.push({ id: doc.id, ...doc.data() });
            });
        }

        // Render the teams management interface
        renderTeamsManagement();
        
    } catch (error) {
        console.error('Error loading players and teams:', error);
        showStatusMessage('Error loading data. Please refresh the page.', 'error');
    }
}

// Create default teams structure in Firebase
async function createDefaultTeams() {
    console.log('Creating default teams...');
    currentTeams = [];
    
    for (let i = 1; i <= 6; i++) {
        const teamData = {
            teamId: i,
            teamName: `Team ${i}`,
            players: [],
            captain: null
        };
        
        try {
            const docRef = await db.collection('teams').add(teamData);
            currentTeams.push({ id: docRef.id, ...teamData });
        } catch (error) {
            console.error(`Error creating Team ${i}:`, error);
        }
    }
}

// Render the teams management interface
function renderTeamsManagement() {
    const teamsGrid = document.getElementById('teams-grid');
    const unassignedList = document.getElementById('unassigned-players-list');
    
    if (!teamsGrid || !unassignedList) {
        console.log('Manage teams elements not found - probably not on manage teams page');
        return;
    }

    // Clear existing content
    teamsGrid.innerHTML = '';
    
    // Get list of assigned players
    const assignedPlayerIds = new Set();
    currentTeams.forEach(team => {
        team.players.forEach(playerId => assignedPlayerIds.add(playerId));
    });
    
    // Show unassigned players
    const unassignedPlayers = allPlayers.filter(player => !assignedPlayerIds.has(player.id));
    renderUnassignedPlayers(unassignedPlayers);
    
    // Create team management cards
    currentTeams.forEach(team => {
        const teamCard = createTeamManagementCard(team);
        teamsGrid.appendChild(teamCard);
    });
}

// Render unassigned players list
function renderUnassignedPlayers(unassignedPlayers) {
    const unassignedList = document.getElementById('unassigned-players-list');
    
    if (unassignedPlayers.length === 0) {
        unassignedList.innerHTML = '<p style="color: #666; font-style: italic;">All players have been assigned to teams</p>';
    } else {
        unassignedList.innerHTML = unassignedPlayers.map(player => 
            `<div class="unassigned-player" style="background: #fff3cd; color: #856404; padding: 8px 12px; border-radius: 4px; font-size: 0.9rem; border: 1px solid #ffc107;">
                ${player.name}
            </div>`
        ).join('');
    }
}

// Create team management card
function createTeamManagementCard(team) {
    const card = document.createElement('div');
    card.className = 'team-management-card';
    card.setAttribute('data-team-id', team.teamId);
    
    card.innerHTML = `
        <div class="team-name-edit" style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
            <input type="text" class="team-name-input" value="${team.teamName}" placeholder="Team Name" maxlength="20" 
                   style="flex: 1; padding: 8px 12px; border: 2px solid #ddd; border-radius: 4px; font-size: 1.1rem; font-weight: 600;">
            <button class="save-team-name-btn" onclick="saveTeamName(this)" 
                    style="background: #4a5d4a; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                Save
            </button>
        </div>
        
        <div class="team-roster">
            ${createRosterSlots(team)}
        </div>
    `;
    
    return card;
}

// Create roster slots for a team
function createRosterSlots(team) {
    let html = '';
    
    // Get list of ALL assigned players across ALL teams
    const assignedPlayerIds = new Set();
    currentTeams.forEach(anyTeam => {
        anyTeam.players.forEach(playerId => assignedPlayerIds.add(playerId));
        if (anyTeam.captain) assignedPlayerIds.add(anyTeam.captain);
    });
    
    // Only show unassigned players in dropdowns
    const availablePlayers = allPlayers.filter(player => 
        !assignedPlayerIds.has(player.id)
    );
    
    // Captain slot
    html += `
        <div class="roster-slot captain-slot" style="display: flex; align-items: center; gap: 10px; padding: 10px; margin-bottom: 8px; background: #e8f5e8; border: 1px solid #4a5d4a; border-radius: 4px;">
            <span class="slot-number" style="font-weight: 600; min-width: 20px; color: #666;">C:</span>
            <select class="player-select captain-select" onchange="updateTeamRoster(this)" 
                    style="flex: 1; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px;">
                <option value="">Select Captain</option>
                ${availablePlayers.map(player => 
                    `<option value="${player.id}">${player.name}</option>`
                ).join('')}
                ${team.captain ? `<option value="${team.captain}" selected>${allPlayers.find(p => p.id === team.captain)?.name || 'Unknown'}</option>` : ''}
            </select>
            ${team.captain ? 
                `<button onclick="removePlayerFromTeam(${team.teamId}, 'captain')" 
                         style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 0.75rem; cursor: pointer;">
                    Remove
                </button>` : 
                '<span style="width: 60px;"></span>' // Spacer to maintain layout
            }
            <span class="captain-label" style="font-size: 0.85rem; color: #4a5d4a; font-weight: 600;">Captain</span>
        </div>
    `;
    
    // Regular player slots (2-6)
    for (let i = 2; i <= 6; i++) {
        const playerId = team.players[i - 1] || ''; // players array is 0-indexed
        
        html += `
            <div class="roster-slot" style="display: flex; align-items: center; gap: 10px; padding: 10px; margin-bottom: 8px; background: #f8f9f8; border: 1px solid #ddd; border-radius: 4px;">
                <span class="slot-number" style="font-weight: 600; min-width: 20px; color: #666;">${i}:</span>
                <select class="player-select" onchange="updateTeamRoster(this)"
                        style="flex: 1; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="">Select Player</option>
                    ${availablePlayers.map(player => 
                        `<option value="${player.id}">${player.name}</option>`
                    ).join('')}
                    ${playerId ? `<option value="${playerId}" selected>${allPlayers.find(p => p.id === playerId)?.name || 'Unknown'}</option>` : ''}
                </select>
                ${playerId ? 
                    `<button onclick="removePlayerFromTeam(${team.teamId}, ${i - 1})" 
                             style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 0.75rem; cursor: pointer;">
                        Remove
                    </button>` : 
                    '<span style="width: 60px;"></span>' // Spacer to maintain layout
                }
            </div>
        `;
    }
    
    return html;
}

// Save individual team name
async function saveTeamName(button) {
    const card = button.closest('.team-management-card');
    const teamId = parseInt(card.getAttribute('data-team-id'));
    const newName = card.querySelector('.team-name-input').value.trim();
    
    if (!newName) {
        alert('Please enter a team name');
        return;
    }
    
    try {
        // Find the team in currentTeams array
        const teamIndex = currentTeams.findIndex(t => t.teamId === teamId);
        if (teamIndex === -1) {
            throw new Error('Team not found');
        }
        
        // Update in Firebase
        await db.collection('teams').doc(currentTeams[teamIndex].id).update({
            teamName: newName
        });
        
        // Update local data
        currentTeams[teamIndex].teamName = newName;
        
        showStatusMessage(`Team name saved: ${newName}`, 'success');
        
        // Update team names throughout the site
        updateTeamNamesOnSite();
        
    } catch (error) {
        console.error('Error saving team name:', error);
        showStatusMessage('Error saving team name. Please try again.', 'error');
    }
}

// Update team roster when player selection changes
function updateTeamRoster(selectElement) {
    const card = selectElement.closest('.team-management-card');
    const teamId = parseInt(card.getAttribute('data-team-id'));
    
    // Get all player selections for this team
    const playerSelects = card.querySelectorAll('.player-select:not(.captain-select)');
    const captainSelect = card.querySelector('.captain-select');
    
    const players = Array.from(playerSelects).map(select => select.value).filter(value => value);
    const captain = captainSelect.value || null;
    
    // Add captain to players array if not already there
    if (captain && !players.includes(captain)) {
        players.unshift(captain);
    }
    
    // Update currentTeams array
    const teamIndex = currentTeams.findIndex(t => t.teamId === teamId);
    if (teamIndex !== -1) {
        currentTeams[teamIndex].players = players;
        currentTeams[teamIndex].captain = captain;
    }
    
    // Re-render to update available players in other teams
    renderTeamsManagement();
}

// Remove player from team
function removePlayerFromTeam(teamId, slotIdentifier) {
    const teamIndex = currentTeams.findIndex(t => t.teamId === teamId);
    if (teamIndex === -1) return;
    
    if (slotIdentifier === 'captain') {
        // Remove captain
        const captainId = currentTeams[teamIndex].captain;
        currentTeams[teamIndex].captain = null;
        
        // Also remove from players array if they're in there
        if (captainId) {
            currentTeams[teamIndex].players = currentTeams[teamIndex].players.filter(id => id !== captainId);
        }
    } else {
        // Remove regular player (slotIdentifier is the array index)
        const playerId = currentTeams[teamIndex].players[slotIdentifier];
        if (playerId) {
            // Remove from players array
            currentTeams[teamIndex].players.splice(slotIdentifier, 1);
            
            // If this player was also the captain, remove captain status
            if (currentTeams[teamIndex].captain === playerId) {
                currentTeams[teamIndex].captain = null;
            }
        }
    }
    
    // Re-render to update interface and show player as available again
    renderTeamsManagement();
    
    showStatusMessage('Player removed from team', 'success');
}

// Save all teams to Firebase
async function saveAllTeams() {
    try {
        showStatusMessage('Saving all teams...', 'success');
        
        for (const team of currentTeams) {
            await db.collection('teams').doc(team.id).update({
                teamName: team.teamName,
                players: team.players,
                captain: team.captain
            });
        }
        
        showStatusMessage('All teams saved successfully!', 'success');
        updateTeamNamesOnSite();
        
    } catch (error) {
        console.error('Error saving teams:', error);
        showStatusMessage('Error saving teams. Please try again.', 'error');
    }
}

// Reset teams to default
async function resetTeams() {
    if (!confirm('Are you sure you want to reset all teams to default? This will clear all team names and player assignments.')) {
        return;
    }
    
    try {
        // Delete existing teams
        for (const team of currentTeams) {
            await db.collection('teams').doc(team.id).delete();
        }
        
        // Create new default teams
        await createDefaultTeams();
        
        // Re-render interface
        renderTeamsManagement();
        
        showStatusMessage('Teams reset to default successfully!', 'success');
        updateTeamNamesOnSite();
        
    } catch (error) {
        console.error('Error resetting teams:', error);
        showStatusMessage('Error resetting teams. Please try again.', 'error');
    }
}

// Auto-assign remaining players
function autoAssignPlayers() {
    // Get unassigned players
    const assignedPlayerIds = new Set();
    currentTeams.forEach(team => {
        team.players.forEach(playerId => assignedPlayerIds.add(playerId));
    });
    
    const unassignedPlayers = allPlayers.filter(player => !assignedPlayerIds.has(player.id));
    
    if (unassignedPlayers.length === 0) {
        showStatusMessage('All players are already assigned to teams.', 'success');
        return;
    }
    
    // Find teams with open spots
    let currentPlayerIndex = 0;
    
    for (const team of currentTeams) {
        while (team.players.length < 6 && currentPlayerIndex < unassignedPlayers.length) {
            team.players.push(unassignedPlayers[currentPlayerIndex].id);
            
            // If no captain assigned, make first player captain
            if (!team.captain && team.players.length === 1) {
                team.captain = unassignedPlayers[currentPlayerIndex].id;
            }
            
            currentPlayerIndex++;
        }
    }
    
    // Re-render interface
    renderTeamsManagement();
    
    showStatusMessage(`Auto-assigned ${currentPlayerIndex} players to teams.`, 'success');
}

// Update team names throughout the site
function updateTeamNamesOnSite() {
    // This function would update team names in:
    // - Team rosters section
    // - Schedule section 
    // - Standings section
    // - Any other places that show team names
    
    console.log('Updating team names throughout site...');
    
    // Update teams section if it exists
    updateTeamsSection();
    
    // Update schedule section if it exists
    updateScheduleSection();
    
    // Update standings section if it exists
    updateStandingsSection();
}

// Update the teams section with current team names and rosters
function updateTeamsSection() {
    const teamsGrid = document.querySelector('#teams-section .teams-grid');
    if (!teamsGrid) return;
    
    // Re-render team cards with current data
    teamsGrid.innerHTML = currentTeams.map(team => {
        const teamPlayers = team.players.map(playerId => {
            const player = allPlayers.find(p => p.id === playerId);
            return player ? player.name : 'Open Slot';
        });
        
        // Ensure we have 6 slots
        while (teamPlayers.length < 6) {
            teamPlayers.push('Open Slot');
        }
        
        return `
            <div class="team-card">
                <h3 class="team-name">${team.teamName}</h3>
                <div class="team-players">
                    ${teamPlayers.map((playerName, index) => {
                        const isCaptain = index === 0 && team.captain;
                        return `<div class="player-slot ${isCaptain ? 'captain-slot' : ''}">${playerName}${isCaptain ? ' (Captain)' : ''}</div>`;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// Update schedule section with current team names
function updateScheduleSection() {
    // Find all team name elements in schedule and update them
    const teamNameElements = document.querySelectorAll('#schedule-section .team-name');
    
    teamNameElements.forEach(element => {
        const currentText = element.textContent.trim();
        
        // Check if it matches a pattern like "Team 1", "Team 2", etc.
        const match = currentText.match(/^Team (\d)$/);
        if (match) {
            const teamNumber = parseInt(match[1]);
            const team = currentTeams.find(t => t.teamId === teamNumber);
            if (team) {
                element.textContent = team.teamName;
            }
        }
    });
}

// Update standings section with current team names
function updateStandingsSection() {
    const standingsTable = document.querySelector('#standings-section .standings-table tbody');
    if (!standingsTable) return;
    
    const rows = standingsTable.querySelectorAll('tr');
    rows.forEach((row, index) => {
        if (index < currentTeams.length) {
            const teamCell = row.querySelector('td:nth-child(2)'); // Team name is in 2nd column
            if (teamCell) {
                teamCell.textContent = currentTeams[index].teamName;
            }
        }
    });
}

// Show status message
function showStatusMessage(message, type = 'success') {
    const statusElement = document.getElementById('manage-status-message');
    if (!statusElement) return;
    
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    statusElement.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        statusElement.style.display = 'none';
    }, 3000);
}

// Signup visibility control
let signupVisible = true;
let signupSectionHTML = null; // Store the HTML when removed

// Load signup visibility setting
async function loadSignupVisibility() {
    try {
        const doc = await db.collection('settings').doc('signupVisibility').get();
        if (doc.exists) {
            signupVisible = doc.data().visible;
        } else {
            // Create default setting
            await db.collection('settings').doc('signupVisibility').set({ visible: true });
            signupVisible = true;
        }
        
        updateSignupDisplay();
        updateSignupToggleButton();
        
    } catch (error) {
        console.error('Error loading signup visibility:', error);
        signupVisible = true; // Default to visible if error
        updateSignupDisplay();
    }
}

// Toggle signup visibility
async function toggleSignupVisibility() {
    try {
        signupVisible = !signupVisible;
        
        // Save to Firebase
        await db.collection('settings').doc('signupVisibility').set({ visible: signupVisible });
        
        // Update display
        updateSignupDisplay();
        updateSignupToggleButton();
        
        showStatusMessage(`Signup section ${signupVisible ? 'shown' : 'hidden'} successfully!`, 'success');
        
    } catch (error) {
        console.error('Error toggling signup visibility:', error);
        showStatusMessage('Error updating signup visibility. Please try again.', 'error');
        
        // Revert on error
        signupVisible = !signupVisible;
        updateSignupDisplay();
        updateSignupToggleButton();
    }
}

// Update signup section display
function updateSignupDisplay() {
    const signupSection = document.querySelector('.signup-section');
    const container = document.querySelector('.main-content');
    
    if (signupVisible) {
        // Show signup section
        if (!signupSection && signupSectionHTML && container) {
            // Re-add the signup section to the end of main-content
            container.insertAdjacentHTML('beforeend', signupSectionHTML);
            // Restore two-column grid layout
            container.style.gridTemplateColumns = '2fr 1fr';
        }
    } else {
        // Hide signup section
        if (signupSection) {
            // Store the HTML before removing
            signupSectionHTML = signupSection.outerHTML;
            // Remove from DOM completely
            signupSection.remove();
        }
        // Change to single-column layout when signup is hidden
        if (container) {
            container.style.gridTemplateColumns = '1fr';
        }
    }
}

// Update toggle button text
function updateSignupToggleButton() {
    const toggleBtn = document.getElementById('toggle-signup-btn');
    if (toggleBtn) {
        toggleBtn.textContent = signupVisible ? 'Hide Signup Section' : 'Show Signup Section';
        toggleBtn.style.background = signupVisible ? '#dc3545' : '#28a745';
    }
}

// Manage membership requests
let pendingRequests = [];

// Load pending requests from Firebase with real-time updates
function loadPendingRequests() {
    try {
        // Use onSnapshot for real-time updates
        db.collection('requests').orderBy('timestamp', 'asc').onSnapshot((snapshot) => {
            pendingRequests = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                // Include pending and approved requests (but not denied)
                if (!data.status || data.status === 'pending' || data.status === 'approved') {
                    pendingRequests.push({ id: doc.id, ...data });
                }
            });
            
            console.log('Loaded pending requests (real-time):', pendingRequests.length);
            renderPendingRequests();
        });
        
    } catch (error) {
        console.error('Error setting up real-time requests listener:', error);
        
        // Fallback to manual loading
        loadPendingRequestsFallback();
    }
}

// Fallback function for manual loading if real-time fails
async function loadPendingRequestsFallback() {
    try {
        const requestsSnapshot = await db.collection('requests').orderBy('timestamp', 'asc').get();
        pendingRequests = [];
        requestsSnapshot.forEach((doc) => {
            const data = doc.data();
            if (!data.status || data.status === 'pending' || data.status === 'approved') {
                pendingRequests.push({ id: doc.id, ...data });
            }
        });
        
        console.log('Loaded pending requests (fallback):', pendingRequests.length);
        renderPendingRequests();
        
    } catch (fallbackError) {
        console.error('Fallback loading also failed:', fallbackError);
    }
}

// Render pending requests in admin interface
function renderPendingRequests() {
    const requestsList = document.getElementById('pending-requests-list');
    if (!requestsList) return;
    
    if (pendingRequests.length === 0) {
        requestsList.innerHTML = '<p style="color: #666; font-style: italic; text-align: center;">No pending requests</p>';
        return;
    }
    
    // Sort requests alphabetically by name
    const sortedRequests = [...pendingRequests].sort((a, b) => 
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    
    requestsList.innerHTML = sortedRequests.map(request => `
        <div style="background: white; border: 1px solid #ddd; border-radius: 6px; padding: 15px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 5px 0; color: #333;">
                        ${request.name}
                        ${request.teamCaptain ? '<span style="background: #2d4a2d; color: white; padding: 2px 6px; font-size: 0.7rem; margin-left: 8px;">WANTS CAPTAIN</span>' : ''}
                    </h4>
                    <p style="margin: 0 0 3px 0; font-size: 0.9rem; color: #666;">${request.email}</p>
                    <p style="margin: 0 0 3px 0; font-size: 0.9rem; color: #666;">${request.phone}</p>
                    <p style="margin: 0; font-size: 0.8rem; color: #999;">Requested: ${new Date(request.timestamp).toLocaleDateString()}</p>
                </div>
                <div style="display: flex; gap: 8px; margin-left: 15px;">
                    ${request.status === 'approved' ? `
                        <button onclick="markFeeReceived('${request.id}')" 
                                style="background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">
                            Fee Received
                        </button>
                        <button onclick="removeApprovedRequest('${request.id}', '${request.name.replace(/'/g, "\\'")}') " 
                                style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">
                            Remove
                        </button>
                    ` : `
                        <button onclick="approveRequest('${request.id}')" 
                                style="background: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">
                            Approve
                        </button>
                        <button onclick="denyRequest('${request.id}', '${request.name.replace(/'/g, "\\'")}') " 
                                style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">
                            Deny
                        </button>
                    `}
                </div>
            </div>
        </div>
    `).join('');
}

// Approve a membership request
async function approveRequest(requestId) {
    try {
        // Get the request data
        const requestDoc = await db.collection('requests').doc(requestId).get();
        if (!requestDoc.exists) {
            throw new Error('Request not found');
        }
        
        const requestData = requestDoc.data();
        
        // Update status to approved (don't move to participants yet)
        await db.collection('requests').doc(requestId).update({
            status: 'approved'
        });
        
        // Add "approved" tag to user in Mailchimp (triggers approval email automation)
        await addMailchimpTag(requestData.email, 'approved');
        
        // Real-time updates will automatically refresh the requests list
        showStatusMessage(`${requestData.name} approved! Waiting for fee payment.`, 'success');
        
    } catch (error) {
        console.error('Error approving request:', error);
        showStatusMessage('Error approving request. Please try again.', 'error');
    }
}

// Mark fee as received and move to participants
async function markFeeReceived(requestId) {
    try {
        // Get the request data
        const requestDoc = await db.collection('requests').doc(requestId).get();
        if (!requestDoc.exists) {
            throw new Error('Request not found');
        }
        
        const requestData = requestDoc.data();
        
        // Move to participants collection
        const participantData = {
            name: requestData.name,
            email: requestData.email,
            phone: requestData.phone,
            teamCaptain: requestData.teamCaptain,
            timestamp: requestData.timestamp
        };
        
        await db.collection('participants').add(participantData);
        
        // Remove from requests collection
        await db.collection('requests').doc(requestId).delete();
        
        // Send payment confirmation email (placeholder)
        await sendPaymentConfirmationEmail(participantData);
        
        // Add "paid" tag to user in Mailchimp (triggers automation)
        await addMailchimpTag(participantData.email, 'paid');
        
        // Real-time updates will automatically refresh the requests list
        showStatusMessage(`${requestData.name} fee received and added to participants!`, 'success');
        
    } catch (error) {
        console.error('Error marking fee received:', error);
        showStatusMessage('Error processing fee payment. Please try again.', 'error');
    }
}

// Deny a membership request
async function denyRequest(requestId, requestName) {
    if (!confirm(`Are you sure you want to deny ${requestName}'s request to join the league?`)) {
        return;
    }
    
    try {
        // Get the request data for email notification
        const requestDoc = await db.collection('requests').doc(requestId).get();
        if (requestDoc.exists) {
            const requestData = requestDoc.data();
            
            // Add "denied" tag to user in Mailchimp (triggers denial email automation)
            await addMailchimpTag(requestData.email, 'denied');
        }
        
        // Remove from requests collection
        await db.collection('requests').doc(requestId).delete();
        
        // Real-time updates will automatically refresh the requests list
        showStatusMessage(`${requestName}'s request has been denied.`, 'success');
        
    } catch (error) {
        console.error('Error denying request:', error);
        showStatusMessage('Error denying request. Please try again.', 'error');
    }
}

// Remove an approved request (for users who back out after approval)
async function removeApprovedRequest(requestId, requestName) {
    if (!confirm(`Are you sure you want to remove ${requestName} from the approved list?\n\nThis should only be used if they decided not to continue or failed to pay their fee.`)) {
        return;
    }
    
    try {
        // Get the request data for potential email notification
        const requestDoc = await db.collection('requests').doc(requestId).get();
        if (requestDoc.exists) {
            const requestData = requestDoc.data();
            
            // Optionally add "removed" tag to user in Mailchimp (no automation set up yet)
            // await addMailchimpTag(requestData.email, 'removed');
        }
        
        // Remove from requests collection
        await db.collection('requests').doc(requestId).delete();
        
        // Real-time updates will automatically refresh the requests list
        showStatusMessage(`${requestName} has been removed from the approved list.`, 'success');
        
    } catch (error) {
        console.error('Error removing approved request:', error);
        showStatusMessage('Error removing request. Please try again.', 'error');
    }
}

// Approval and denial emails are now handled by Mailchimp automations
// triggered by tags added via addMailchimpTag() function

// Send payment confirmation email (placeholder - will be replaced with Mailchimp)
async function sendPaymentConfirmationEmail(participantData) {
    try {
        // TODO: Replace with Mailchimp template when integration is complete
        console.log('Payment confirmation email would be sent to:', participantData.email);
        
        // Placeholder using existing EmailJS setup - will be replaced
        const templateParams = {
            user_name: participantData.name,
            user_email: participantData.email,
            message_type: 'Payment received - Welcome to the league!',
            approval_status: 'payment_received'
        };

        // For now, just log - we'll implement this with Mailchimp
        console.log('Payment confirmation email prepared for:', templateParams);
    } catch (error) {
        console.error('Failed to send payment confirmation email:', error);
    }
}

// Add tag to user in Mailchimp (triggers email automation)
async function addMailchimpTag(email, tag) {
    try {
        const response = await fetch('/.netlify/functions/add-tag', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                tag: tag
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`Tag '${tag}' added to ${email}:`, result.message);
        } else {
            console.log(`Failed to add tag '${tag}' to ${email}`);
        }
    } catch (error) {
        console.error('Error adding Mailchimp tag:', error);
    }
}

// Load teams data when page loads (for other sections that need team names)
document.addEventListener('DOMContentLoaded', function() {
    // Load signup visibility setting on every page load
    loadSignupVisibility();
    
    // Only initialize manage teams if we're on that section
    if (document.getElementById('teams-grid')) {
        initializeManageTeams();
        loadPendingRequests(); // Also load pending requests
    }
}); 