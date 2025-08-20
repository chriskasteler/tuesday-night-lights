// Team Management JavaScript Functions

let allPlayers = [];
let currentTeams = [];
let playerDirectoryData = [];

// Function to format names properly (Title Case)
function formatName(name) {
    return name.trim()
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Initialize the admin tools functionality
function initializeManageTeams() {
    console.log('Initializing admin tools...');
    loadPlayersAndTeams();
}

// Load all players and teams from Firebase
async function loadPlayersAndTeams() {
    try {
        // Load participants from new nested structure
        const participantsSnapshot = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/participants').orderBy('name', 'asc').get();
        allPlayers = [];
        participantsSnapshot.forEach((doc) => {
            allPlayers.push({ id: doc.id, ...doc.data() });
        });
        
        // Make globally available
        window.allPlayers = allPlayers;

        // Clean up any duplicate teams first
        const duplicatesRemoved = await cleanupDuplicateTeams();
        
        // Load teams from new nested structure (or create default structure)
        const teamsSnapshot = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/teams').orderBy('teamId', 'asc').get();
        
        console.log('Teams found in database:', teamsSnapshot.size);
        
        if (teamsSnapshot.empty) {
            // Create default teams structure
            await createDefaultTeams();
        } else {
            currentTeams = [];
            teamsSnapshot.forEach((doc) => {
                currentTeams.push({ id: doc.id, ...doc.data() });
            });
        }
        
        // Make globally available
        window.currentTeams = currentTeams;
        
        console.log('Loaded teams:', currentTeams.map(t => `${t.teamName} (ID: ${t.id}, teamId: ${t.teamId})`));

        // Render the teams management interface
        renderTeamsManagement();
        
        // Update counters for players tab
        updateMembershipCounters();
        
        // Load player directory data
        await loadPlayerDirectory();
        
    } catch (error) {
        console.error('Error loading players and teams:', error);
        showStatusMessage('Error loading data. Please refresh the page.', 'error');
    }
}

// Create default teams structure in Firebase
async function createDefaultTeams() {
    console.log('Creating default teams...');
    currentTeams = [];
    window.currentTeams = currentTeams;
    
    for (let i = 1; i <= 6; i++) {
        const teamData = {
            teamId: i,
            teamName: `Team ${i}`,
            players: [],
            captain: null,
            wins: 0,
            losses: 0,
            lastUpdated: new Date().toISOString()
        };
        
        try {
            // Use set() with specific document ID to prevent duplicates
            const docId = `team-${i}`;
            await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/teams').doc(docId).set(teamData);
            currentTeams.push({ id: docId, ...teamData });
            console.log(`Created/Updated Team ${i} with ID: ${docId}`);
        } catch (error) {
            console.error(`Error creating Team ${i}:`, error);
        }
    }
}

// Clean up duplicate teams in the database
async function cleanupDuplicateTeams() {
    try {
        console.log('Checking for duplicate teams...');
        const teamsSnapshot = await db.collection('teams').get();
        const teamsByTeamId = {};
        const duplicates = [];
        
        // Group teams by teamId
        teamsSnapshot.forEach(doc => {
            const data = doc.data();
            const teamId = data.teamId;
            
            if (!teamsByTeamId[teamId]) {
                teamsByTeamId[teamId] = [];
            }
            teamsByTeamId[teamId].push({ docId: doc.id, data: data });
        });
        
        // Find duplicates and mark for deletion
        Object.keys(teamsByTeamId).forEach(teamId => {
            const teams = teamsByTeamId[teamId];
            if (teams.length > 1) {
                console.log(`Found ${teams.length} teams with teamId ${teamId}`);
                
                // Keep the one with the expected document ID format, or the first one
                const expectedDocId = `team-${teamId}`;
                const keepTeam = teams.find(t => t.docId === expectedDocId) || teams[0];
                
                // Mark others for deletion
                teams.forEach(team => {
                    if (team.docId !== keepTeam.docId) {
                        duplicates.push(team.docId);
                    }
                });
            }
        });
        
        // Delete duplicates
        if (duplicates.length > 0) {
            console.log(`Deleting ${duplicates.length} duplicate teams:`, duplicates);
            const batch = db.batch();
            duplicates.forEach(docId => {
                batch.delete(db.collection('teams').doc(docId));
            });
            await batch.commit();
            console.log('Duplicate teams deleted successfully');
            return true;
        } else {
            console.log('No duplicate teams found');
            return false;
        }
        
    } catch (error) {
        console.error('Error cleaning up duplicate teams:', error);
        return false;
    }
}

// Debug function - can be called from console to manually clean up duplicates
window.cleanupTeams = async function() {
    console.log('Manual team cleanup initiated...');
    const removed = await cleanupDuplicateTeams();
    if (removed) {
        console.log('Duplicates removed. Reloading teams...');
        await loadPlayersAndTeams();
        console.log('Teams reloaded successfully');
        // Re-render the interface
        renderTeamsManagement();
    } else {
        console.log('No duplicates found, but reloading anyway...');
        await loadPlayersAndTeams();
        renderTeamsManagement();
    }
    return removed;
};

// Debug function to manually save all teams
window.saveAllTeamsManually = async function() {
    console.log('Manually saving all teams to database...');
    
    for (const team of currentTeams) {
        try {
            console.log(`Saving team ${team.teamId} (doc: ${team.id})`);
            console.log(`Players:`, team.players);
            console.log(`Captain:`, team.captain);
            
            await db.collection('teams').doc(team.id).set({
                teamId: team.teamId,
                teamName: team.teamName || `Team ${team.teamId}`,
                players: team.players || [],
                captain: team.captain || null,
                wins: team.wins || 0,
                losses: team.losses || 0,
                lastUpdated: new Date().toISOString()
            });
            
            console.log(`✅ Saved team ${team.teamId}`);
            
        } catch (error) {
            console.error(`❌ Error saving team ${team.teamId}:`, error);
        }
    }
    
    console.log('Manual save complete');
    return true;
};

// Debug function to fix participant teamIds based on current team assignments
window.fixParticipantTeamIds = async function() {
    console.log('🔧 Fixing participant teamIds based on current team assignments...');
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const team of currentTeams) {
        if (team.players && team.players.length > 0) {
            console.log(`Processing Team ${team.teamId} with ${team.players.length} players`);
            
            for (const playerId of team.players) {
                try {
                    await db.collection('participants').doc(playerId).update({
                        teamId: String(team.teamId)
                    });
                    console.log(`✅ Fixed participant ${playerId} -> Team ${team.teamId}`);
                    fixedCount++;
                } catch (error) {
                    console.error(`❌ Error fixing participant ${playerId}:`, error);
                    errorCount++;
                }
            }
        }
    }
    
    console.log(`Team captain fix complete: ${fixedCount} fixed, ${errorCount} errors`);
    return { fixed: fixedCount, errors: errorCount };
};

// Enhanced cleanup that also fixes the captain assignment issue
window.fixTeamCaptainIssue = async function() {
    console.log('Fixing team captain assignment issue...');
    
    try {
        // Get current user
        const user = firebase.auth().currentUser;
        if (!user) {
            console.log('No user logged in');
            return;
        }
        
        // Get user data to find their team assignment
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            console.log('User document not found');
            return;
        }
        
        const userData = userDoc.data();
        const expectedTeamId = userData.teamId;
        
        console.log('User expected team:', expectedTeamId);
        console.log('User email:', user.email);
        
        // Find all teams with this teamId
        const teamsSnapshot = await db.collection('teams')
            .where('teamId', '==', parseInt(expectedTeamId))
            .get();
        
        console.log(`Found ${teamsSnapshot.size} teams with teamId ${expectedTeamId}`);
        
        if (teamsSnapshot.size > 1) {
            // Multiple teams found - consolidate them
            const teams = [];
            teamsSnapshot.forEach(doc => {
                teams.push({ id: doc.id, ...doc.data() });
            });
            
            console.log('Teams found:', teams);
            
            // Find the participant record
            const participantSnapshot = await db.collection('participants')
                .where('email', '==', user.email)
                .get();
            
            let participantId = null;
            if (!participantSnapshot.empty) {
                participantId = participantSnapshot.docs[0].id;
                console.log('Found participant ID:', participantId);
            }
            
            // Keep the team with the expected document ID or the one that has the user as captain
            const expectedDocId = `team-${expectedTeamId}`;
            let keepTeam = teams.find(t => t.id === expectedDocId);
            
            if (!keepTeam) {
                // If no team with expected ID, find one with user as captain
                keepTeam = teams.find(t => t.captain === participantId);
            }
            
            if (!keepTeam) {
                // Just keep the first one
                keepTeam = teams[0];
            }
            
            console.log('Keeping team:', keepTeam);
            
            // Update the kept team to ensure it has correct captain
            if (participantId && keepTeam.captain !== participantId) {
                const updateData = {
                    ...keepTeam,
                    captain: participantId,
                    players: keepTeam.players || [],
                    lastUpdated: new Date().toISOString()
                };
                
                // Add captain to players if not already there
                if (!updateData.players.includes(participantId)) {
                    updateData.players.unshift(participantId);
                }
                
                await db.collection('teams').doc(keepTeam.id).set(updateData);
                console.log('Updated kept team with correct captain');
            }
            
            // Delete the other teams
            const teamsToDelete = teams.filter(t => t.id !== keepTeam.id);
            console.log('Deleting teams:', teamsToDelete.map(t => t.id));
            
            const batch = db.batch();
            teamsToDelete.forEach(team => {
                batch.delete(db.collection('teams').doc(team.id));
            });
            await batch.commit();
            
            console.log('Duplicate teams deleted and captain issue fixed');
            
            // Reload the page
            await loadPlayersAndTeams();
            renderTeamsManagement();
            
            return true;
        } else {
            console.log('No duplicate teams found');
            return false;
        }
        
    } catch (error) {
        console.error('Error fixing team captain issue:', error);
        return false;
    }
};

// Render the teams management interface
function renderTeamsManagement() {
    const teamsGrid = document.getElementById('teams-grid');
    const unassignedList = document.getElementById('unassigned-players-list');
    
    if (!teamsGrid || !unassignedList) {
        console.log('Admin tools elements not found - probably not on admin tools page');
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
        <div class="roster-slot captain-slot" style="display: flex; align-items: center; gap: 8px; padding: 10px; margin-bottom: 8px; background: #e8f5e8; border: 1px solid #4a5d4a; border-radius: 4px;">
            <span class="slot-number" style="font-weight: 600; min-width: 20px; color: #666;">C:</span>
            <select class="player-select captain-select" onchange="updateTeamRoster(this)" 
                    style="flex: 1; max-width: 200px; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px;">
                <option value="">Select Captain</option>
                ${availablePlayers.map(player => 
                    `<option value="${player.id}">${player.name}</option>`
                ).join('')}
                ${team.captain ? `<option value="${team.captain}" selected>${allPlayers.find(p => p.id === team.captain)?.name || 'Unknown'}</option>` : ''}
            </select>
            ${team.captain ? (() => {
                const captain = allPlayers.find(p => p.id === team.captain);
                const inviteSent = captain && captain.inviteSent;
                
                return inviteSent ? 
                    `<button disabled style="background: #28a745; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 0.75rem; cursor: not-allowed; white-space: nowrap;">
                        Invite Sent
                    </button>
                    <button onclick="removePlayerFromTeam(${team.teamId}, 'captain')" 
                             style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 0.75rem; cursor: pointer;">
                        Remove
                    </button>` :
                    `<button onclick="sendCaptainInvite('${team.captain}')" 
                             style="background: #007bff; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 0.75rem; cursor: pointer; white-space: nowrap;">
                        Send Invite
                    </button>
                    <button onclick="removePlayerFromTeam(${team.teamId}, 'captain')" 
                             style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 0.75rem; cursor: pointer;">
                        Remove
                    </button>`;
            })() : 
                '<span style="width: 140px;"></span>' // Spacer to maintain layout for both buttons
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
        await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/teams').doc(currentTeams[teamIndex].id).update({
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
async function updateTeamRoster(selectElement) {
    const card = selectElement.closest('.team-management-card');
    const teamId = parseInt(card.getAttribute('data-team-id'));
    
    // Show loading indicator
    showTeamLoadingState(card, true);
    
    try {
        // Get all player selections for this team
        const playerSelects = card.querySelectorAll('.player-select:not(.captain-select)');
        const captainSelect = card.querySelector('.captain-select');
        
        const players = Array.from(playerSelects).map(select => select.value).filter(value => value);
        const captain = captainSelect.value || null;
    
    // Check if captain changed
    const teamIndex = currentTeams.findIndex(t => t.teamId === teamId);
    const previousCaptain = teamIndex !== -1 ? currentTeams[teamIndex].captain : null;
    const captainChanged = captain !== previousCaptain;
    
    // Add captain to players array if not already there
    if (captain && !players.includes(captain)) {
        players.unshift(captain);
    }
    
    // Update currentTeams array
    if (teamIndex !== -1) {
        currentTeams[teamIndex].players = players;
        currentTeams[teamIndex].captain = captain;
        
        // Save team data to Firestore using the correct document ID
        try {
            const team = currentTeams[teamIndex];
            const docId = team.id; // Use the actual document ID from the loaded team
            
            console.log(`Updating team ${teamId} with document ID: ${docId}`);
            console.log(`Players being saved:`, players);
            console.log(`Captain being saved:`, captain);
            
            await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/teams').doc(docId).set({
                teamId: teamId,
                teamName: team.teamName || `Team ${teamId}`,
                players: players,
                captain: captain,
                wins: team.wins || 0,
                losses: team.losses || 0,
                lastUpdated: new Date().toISOString()
            });
            
            console.log(`✅ Successfully saved team ${teamId} data to Firestore (doc: ${docId})`);
            
            // Update each participant's teamId
            console.log(`📝 Updating participant records with teamId...`);
            const participantUpdates = [];
            
            for (const playerId of players) {
                try {
                    // Determine if this player is the captain
                    const isCaptain = (playerId === captain);
                    
                    console.log(`🚨 NEW CODE RUNNING! Player: ${playerId}, Captain: ${captain}, isCaptain: ${isCaptain}`);
                    
                    await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/participants').doc(playerId).update({
                        teamId: String(teamId),
                        teamCaptain: isCaptain  // Set teamCaptain based on whether they're the captain
                    });
                    console.log(`✅ Updated participant ${playerId} with teamId: ${teamId}, captain: ${isCaptain}`);
                    participantUpdates.push(`✅ ${playerId} (captain: ${isCaptain})`);
                } catch (error) {
                    console.error(`❌ Error updating participant ${playerId}:`, error);
                    participantUpdates.push(`❌ ${playerId}: ${error.message}`);
                }
            }
            
            console.log(`📝 Participant updates complete:`, participantUpdates);
            
            // Verify the save by reading it back
            const savedDoc = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/teams').doc(docId).get();
            if (savedDoc.exists) {
                console.log(`✅ Verification: Team ${teamId} data in database:`, savedDoc.data());
            } else {
                console.error(`❌ Verification failed: Document ${docId} not found after save`);
            }
            
        } catch (error) {
            console.error(`❌ Error saving team ${teamId} data:`, error);
            showStatusMessage(`Error saving team ${teamId}: ${error.message}`, 'error');
        }
    }
    
        // If captain changed, handle role assignment
        if (captainChanged) {
            await handleCaptainRoleAssignment(captain, teamId, previousCaptain);
        }
        
        // Re-render to update available players in other teams
        renderTeamsManagement();
        
    } catch (error) {
        console.error('Error updating team roster:', error);
        showStatusMessage('Error updating team. Please try again.', 'error');
    } finally {
        // Hide loading indicator
        showTeamLoadingState(card, false);
    }
}

// Show/hide loading state for team management card
function showTeamLoadingState(card, isLoading) {
    const loadingOverlay = card.querySelector('.team-loading-overlay');
    
    if (isLoading) {
        // Create loading overlay if it doesn't exist
        if (!loadingOverlay) {
            const overlay = document.createElement('div');
            overlay.className = 'team-loading-overlay';
            overlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10;
                border-radius: 4px;
            `;
            
            const spinner = document.createElement('div');
            spinner.style.cssText = `
                width: 20px;
                height: 20px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #2d4a2d;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            `;
            
            const text = document.createElement('span');
            text.textContent = 'Updating...';
            text.style.cssText = `
                margin-left: 10px;
                color: #2d4a2d;
                font-size: 0.9rem;
                font-weight: 500;
            `;
            
            overlay.appendChild(spinner);
            overlay.appendChild(text);
            card.appendChild(overlay);
            
            // Make sure the card has relative positioning
            card.style.position = 'relative';
            
            // Add CSS animation if not already present
            if (!document.querySelector('#team-loading-animation')) {
                const style = document.createElement('style');
                style.id = 'team-loading-animation';
                style.textContent = `
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
            }
        } else {
            loadingOverlay.style.display = 'flex';
        }
    } else {
        // Hide loading overlay
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
}

// Handle captain role assignment and removal
async function handleCaptainRoleAssignment(newCaptainId, teamId, previousCaptainId) {
    try {
        // Remove captain role from previous captain if there was one
        if (previousCaptainId) {
            const previousPlayer = allPlayers.find(p => p.id === previousCaptainId);
            if (previousPlayer) {
                await removeCaptainRole(previousPlayer.email);
            }
        }
        
        // Assign captain role to new captain if there is one
        if (newCaptainId) {
            const newPlayer = allPlayers.find(p => p.id === newCaptainId);
            if (newPlayer) {
                const success = await assignCaptainRole(newPlayer.email, String(teamId));
                if (success) {
                    showStatusMessage(`${newPlayer.name} assigned as captain for Team ${teamId}`, 'success');
                } else {
                    showStatusMessage(`Warning: Failed to assign captain role to ${newPlayer.name}`, 'warning');
                }
            }
        }
        
    } catch (error) {
        console.error('Error handling captain role assignment:', error);
        showStatusMessage('Error updating captain roles', 'error');
    }
}

// Remove captain role from a user
async function removeCaptainRole(userEmail) {
    try {
        console.log(`Removing captain role from: "${userEmail}"`);
        
        // Find user by email (case-insensitive search)
        const usersSnapshot = await db.collection('users').get();
        let foundUser = null;
        
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.email && userData.email.toLowerCase() === userEmail.toLowerCase()) {
                foundUser = { id: doc.id, ...userData };
                console.log('Found user for role removal:', foundUser);
            }
        });
        
        if (!foundUser) {
            console.log(`User with email ${userEmail} not found for role removal`);
            return false;
        }
        
        const currentRoles = foundUser.roles || [foundUser.role || 'guest'];
        
        // Remove captain role if present
        const updatedRoles = currentRoles.filter(role => role !== 'captain');
        
        // Update user document
        const userRef = db.collection('users').doc(foundUser.id);
        await userRef.update({
            roles: updatedRoles,
            teamId: null, // Remove team assignment
            lastUpdated: new Date().toISOString()
        });
        
        console.log(`Captain role removed from ${userEmail}`);
        
        // ALSO remove teamId from participant record
        console.log(`Looking for participant record to remove teamId: ${userEmail}`);
        const participantsSnapshot = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/participants')
            .where('email', '==', userEmail)
            .get();
        
        if (!participantsSnapshot.empty) {
            // Remove teamId from participant record and set teamCaptain to false
            const participantDoc = participantsSnapshot.docs[0];
            await participantDoc.ref.update({
                teamId: firebase.firestore.FieldValue.delete(),
                teamCaptain: false,
                inviteSent: false,
                inviteSentAt: null,
                lastUpdated: new Date().toISOString()
            });
            console.log(`Removed teamId and captain status from participant record: ${userEmail}`);
        } else {
            console.log(`No participant record found for ${userEmail}`);
        }
        
        // If this is the current user, refresh their roles immediately
        const currentUser = firebase.auth().currentUser;
        if (currentUser && currentUser.email.toLowerCase() === userEmail.toLowerCase()) {
            await refreshCurrentUserRoles();
        }
        
        return true;
        
    } catch (error) {
        console.error('Error removing captain role:', error);
        return false;
    }
}

// Remove player from team
async function removePlayerFromTeam(teamId, slotIdentifier) {
    const teamIndex = currentTeams.findIndex(t => t.teamId === teamId);
    if (teamIndex === -1) return;
    
    // Track which player IDs are being removed so we can clear their teamId
    const removedPlayerIds = [];
    
    if (slotIdentifier === 'captain') {
        // Remove captain
        const captainId = currentTeams[teamIndex].captain;
        
        if (captainId) {
            removedPlayerIds.push(captainId);
            
            // Remove captain role from user
            const captainPlayer = allPlayers.find(p => p.id === captainId);
            if (captainPlayer) {
                await removeCaptainRole(captainPlayer.email);
                
                // Remove "2025 Captain" tag from Mailchimp
                await removeMailchimpTag(captainPlayer.email, '2025 Captain');
            }
        }
        
        currentTeams[teamIndex].captain = null;
        
        // Also remove from players array if they're in there
        if (captainId) {
            currentTeams[teamIndex].players = currentTeams[teamIndex].players.filter(id => id !== captainId);
        }
    } else {
        // Remove regular player (slotIdentifier is the array index)
        const playerId = currentTeams[teamIndex].players[slotIdentifier];
        if (playerId) {
            removedPlayerIds.push(playerId);
            
            // Remove from players array
            currentTeams[teamIndex].players.splice(slotIdentifier, 1);
            
            // If this player was also the captain, remove captain status and role
            if (currentTeams[teamIndex].captain === playerId) {
                const captainPlayer = allPlayers.find(p => p.id === playerId);
                if (captainPlayer) {
                    await removeCaptainRole(captainPlayer.email);
                    
                    // Remove "2025 Captain" tag from Mailchimp
                    await removeMailchimpTag(captainPlayer.email, '2025 Captain');
                }
                currentTeams[teamIndex].captain = null;
            }
        }
    }
    
    // Save the updated team to database
    try {
        const team = currentTeams[teamIndex];
        await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/teams').doc(team.id).set({
            teamId: team.teamId,
            teamName: team.teamName,
            players: team.players,
            captain: team.captain,
            wins: team.wins || 0,
            losses: team.losses || 0,
            lastUpdated: new Date().toISOString()
        });
        console.log(`Updated team ${team.teamId} in database after player removal`);
        
        // Clear teamId from removed players
        for (const playerId of removedPlayerIds) {
            try {
                // Prepare update data
                const updateData = {
                    teamId: null,
                    teamCaptain: false
                };
                
                // If this was a captain removal, also clear invite status
                if (slotIdentifier === 'captain' || currentTeams[teamIndex].captain === playerId) {
                    updateData.inviteSent = false;
                    updateData.inviteSentAt = null;
                }
                
                await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/participants').doc(playerId).update(updateData);
                console.log(`✅ Cleared teamId and invite status for removed participant: ${playerId}`);
            } catch (error) {
                console.error(`❌ Error clearing teamId for participant ${playerId}:`, error);
            }
        }
        
    } catch (error) {
        console.error(`Error saving team ${teamId} after player removal:`, error);
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
            await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/teams').doc(team.id).update({
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
async function updateStandingsSection() {
    try {
        await calculateAndUpdateStandings();
    } catch (error) {
        console.error('Error updating standings:', error);
        // Fallback to just updating team names
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
}

// Calculate and update complete standings based on match results
async function calculateAndUpdateStandings() {
    try {
        console.log('🏆 STANDINGS: Calculating standings from match results...');
        
        // Initialize team stats
        const teamStats = {};
        
        // Initialize all teams
        currentTeams.forEach(team => {
            teamStats[team.teamName] = {
                totalPoints: 0,
                matchesPlayed: 0,
                wins: 0,
                losses: 0,
                ties: 0,
                teamId: team.teamId
            };
        });
        
        // Get all completed week scorecards to calculate points and records
        const weekScorecardsPath = 'clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/weekScorecards';
        const weekScorecardsSnapshot = await db.collection(weekScorecardsPath).get();
        
        // Process each week's results
        console.log(`🏆 STANDINGS: Found ${weekScorecardsSnapshot.docs.length} week documents`);
        
        for (const weekDoc of weekScorecardsSnapshot.docs) {
            const weekData = weekDoc.data();
            const weekNumber = weekData.weekNumber;
            
            console.log(`🏆 STANDINGS: Processing week ${weekNumber} results...`);
            console.log(`🏆 STANDINGS: Week ${weekNumber} data keys:`, Object.keys(weekData));
            
            // Process each matchup in the week
            for (let matchupIndex = 0; matchupIndex < 3; matchupIndex++) { // 3 matchups per week
                const matchupLineupKey = `matchup${matchupIndex}Lineup`;
                const matchupLineup = weekData[matchupLineupKey];
                
                if (matchupLineup && matchupLineup.team1Name && matchupLineup.team2Name) {
                    // Get team names
                    const team1Name = getAdminTeamName(matchupLineup.team1);
                    const team2Name = getAdminTeamName(matchupLineup.team2);
                    
                    // Calculate points earned for this matchup
                    const matchupPoints = await calculateMatchupPoints(weekNumber, matchupIndex, team1Name, team2Name);
                    
                    if (matchupPoints) {
                        // Add points to totals
                        teamStats[team1Name].totalPoints += matchupPoints.team1Points;
                        teamStats[team2Name].totalPoints += matchupPoints.team2Points;
                        
                        // Update match record
                        teamStats[team1Name].matchesPlayed++;
                        teamStats[team2Name].matchesPlayed++;
                        
                        // Determine matchup winner based on total points
                        if (matchupPoints.team1Points > matchupPoints.team2Points) {
                            // Team 1 wins
                            teamStats[team1Name].wins++;
                            teamStats[team2Name].losses++;
                        } else if (matchupPoints.team2Points > matchupPoints.team1Points) {
                            // Team 2 wins
                            teamStats[team2Name].wins++;
                            teamStats[team1Name].losses++;
                        } else {
                            // Tie
                            teamStats[team1Name].ties++;
                            teamStats[team2Name].ties++;
                        }
                        
                        console.log(`🏆 STANDINGS: ${team1Name} vs ${team2Name} - Points: ${matchupPoints.team1Points}-${matchupPoints.team2Points}`);
                    }
                }
            }
        }
        
        // Update the standings table
        updateStandingsTable(teamStats);
        
    } catch (error) {
        console.error('❌ STANDINGS: Error calculating standings:', error);
        throw error;
    }
}

// Calculate points earned for a specific matchup by simulating match status calculation
async function calculateMatchupPoints(weekNumber, matchupIndex, team1Name, team2Name) {
    try {
        // Load scores and strokes for this week
        const scoresDoc = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/scores').doc(`week-${weekNumber}`).get();
        
        if (!scoresDoc.exists) {
            console.log(`🏆 STANDINGS: No scores found for week ${weekNumber}`);
            return null;
        }
        
        const scoresData = scoresDoc.data();
        const playerScores = scoresData.playerScores || {};
        const playerStrokes = scoresData.playerStrokes || {};
        
        // Get lineup data to identify players for this matchup
        const weekScorecardsDoc = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/weekScorecards').doc(`week-${weekNumber}`).get();
        
        if (!weekScorecardsDoc.exists) {
            console.log(`🏆 STANDINGS: No week scorecard found for week ${weekNumber}`);
            return null;
        }
        
        const weekScorecardsData = weekScorecardsDoc.data();
        const matchupLineup = weekScorecardsData[`matchup${matchupIndex}Lineup`];
        
        if (!matchupLineup) {
            console.log(`🏆 STANDINGS: No lineup found for matchup ${matchupIndex} in week ${weekNumber}`);
            return null;
        }
        
        let team1Points = 0;
        let team2Points = 0;
        
        // Calculate points for both matches in this matchup
        for (let matchNum = 1; matchNum <= 2; matchNum++) {
            const matchData = matchupLineup[`match${matchNum}`];
            if (!matchData) continue;
            
            const team1Players = matchData.team1Players || [];
            const team2Players = matchData.team2Players || [];
            
            if (team1Players.length < 2 || team2Players.length < 2) continue;
            
            // Calculate match status for this individual match
            const matchResult = calculateIndividualMatchResult(
                team1Players, team2Players, playerScores, playerStrokes
            );
            
            // Award points based on match result
            if (matchResult === 'team1_wins') {
                team1Points += 2;
            } else if (matchResult === 'team2_wins') {
                team2Points += 2;
            } else if (matchResult === 'tie') {
                team1Points += 1;
                team2Points += 1;
            }
            // If match is incomplete, no points awarded
        }
        
        console.log(`🏆 STANDINGS: Week ${weekNumber}, Matchup ${matchupIndex}: ${team1Name} ${team1Points} - ${team2Points} ${team2Name}`);
        
        // Debug: Check what data we're actually finding
        if (team1Points === 0 && team2Points === 0) {
            console.log(`🏆 DEBUG: No points found - checking data:`, {
                weekNumber,
                matchupIndex,
                hasScoresData: !!scoresData,
                hasWeekScorecardsData: !!weekScorecardsData,
                hasMatchupLineup: !!matchupLineup,
                playerScoresKeys: Object.keys(playerScores),
                playerStrokesKeys: Object.keys(playerStrokes)
            });
        }
        
        return {
            team1Points,
            team2Points
        };
        
    } catch (error) {
        console.error(`❌ STANDINGS: Error calculating matchup points for week ${weekNumber}, matchup ${matchupIndex}:`, error);
        return null;
    }
}

// Calculate result for an individual match between two teams
function calculateIndividualMatchResult(team1Players, team2Players, playerScores, playerStrokes) {
    let matchStatus = 0; // Positive = team1 ahead, negative = team2 ahead
    let matchOver = false;
    const totalHoles = 9;
    
    for (let hole = 1; hole <= totalHoles; hole++) {
        if (matchOver) break;
        
        // Get best ball scores for each team on this hole
        const team1BestNet = getBestNetScore(team1Players, hole, playerScores, playerStrokes);
        const team2BestNet = getBestNetScore(team2Players, hole, playerScores, playerStrokes);
        
        // Only calculate if both teams have valid scores
        if (team1BestNet !== null && team2BestNet !== null) {
            const holesRemaining = totalHoles - hole;
            
            if (team1BestNet < team2BestNet) {
                matchStatus += 1; // Team 1 wins hole
            } else if (team2BestNet < team1BestNet) {
                matchStatus -= 1; // Team 2 wins hole
            }
            // Tied hole doesn't change status
            
            // Check if match is over (can't be caught up)
            if (Math.abs(matchStatus) > holesRemaining) {
                matchOver = true;
            }
        }
    }
    
    // Determine final result
    if (matchOver || hole > totalHoles) {
        if (matchStatus > 0) {
            return 'team1_wins';
        } else if (matchStatus < 0) {
            return 'team2_wins';
        } else {
            return 'tie';
        }
    }
    
    // Match incomplete
    return 'incomplete';
}

// Get best net score for a team on a specific hole
function getBestNetScore(players, hole, playerScores, playerStrokes) {
    let bestNet = null;
    
    players.forEach(player => {
        const playerName = player.name;
        if (!playerName || !playerScores[playerName] || !playerScores[playerName][hole]) {
            return; // No score for this player on this hole
        }
        
        const grossScore = parseInt(playerScores[playerName][hole]);
        if (isNaN(grossScore) || grossScore <= 0) return;
        
        // Calculate stroke value
        let strokeValue = 0;
        if (playerStrokes[playerName] && playerStrokes[playerName][hole]) {
            const strokeType = playerStrokes[playerName][hole];
            if (strokeType === 'full') strokeValue = 1;
            else if (strokeType === 'half') strokeValue = 0.5;
        }
        
        const netScore = grossScore - strokeValue;
        
        if (bestNet === null || netScore < bestNet) {
            bestNet = netScore;
        }
    });
    
    return bestNet;
}

// Update the standings table with calculated stats
function updateStandingsTable(teamStats) {
    const standingsTable = document.querySelector('#standings-section .standings-table tbody');
    if (!standingsTable) return;
    
    // Convert to array and sort by total points (descending), then by wins
    const sortedTeams = Object.entries(teamStats).sort((a, b) => {
        const [, statsA] = a;
        const [, statsB] = b;
        
        // Sort by total points first (descending)
        if (statsB.totalPoints !== statsA.totalPoints) {
            return statsB.totalPoints - statsA.totalPoints;
        }
        
        // If tied on points, sort by wins (descending)
        return statsB.wins - statsA.wins;
    });
    
    // Update table rows
    const rows = standingsTable.querySelectorAll('tr');
    sortedTeams.forEach(([teamName, stats], index) => {
        if (index < rows.length) {
            const row = rows[index];
            const cells = row.querySelectorAll('td');
            
            if (cells.length >= 5) {
                cells[0].textContent = index + 1; // Rank
                cells[1].textContent = teamName; // Team name
                cells[2].textContent = stats.totalPoints; // Total points
                cells[3].textContent = stats.matchesPlayed; // Matches played
                cells[4].textContent = `${stats.wins}-${stats.losses}-${stats.ties}`; // Record
            }
        }
    });
    
    console.log('🏆 STANDINGS: Updated standings table with calculated results');
}

// ===== WEEKLY SCORING SYSTEM =====

// Load weekly scoring interface for selected week
window.loadWeeklyScoring = async function() {
    const weekSelect = document.getElementById('weekly-scoring-week-select');
    const contentDiv = document.getElementById('weekly-scoring-content');
    const instructionsDiv = document.getElementById('weekly-scoring-instructions');
    
    const selectedWeek = weekSelect.value;
    
    if (!selectedWeek) {
        contentDiv.innerHTML = `
            <p style="text-align: center; color: #999; padding: 40px; font-style: italic;">
                Select a week above to manage lineups and enter scores
            </p>
        `;
        instructionsDiv.style.display = 'none';
        return;
    }
    
    try {
        // Show loading
        contentDiv.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div class="loading-spinner" style="display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #2d4a2d; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top: 15px; color: #666;">Loading Week ${selectedWeek} scoring interface...</p>
            </div>
        `;
        
        // Show instructions
        instructionsDiv.style.display = 'block';
        
        // Load schedule data for this week
        const weekData = getWeekScheduleData(selectedWeek);
        const scheduleData = weekData ? weekData.matches : [];
        
        if (!scheduleData || scheduleData.length === 0) {
            contentDiv.innerHTML = `
                <div style="text-align: center; padding: 40px; background: #fff3cd; border-radius: 8px;">
                    <h4 style="color: #856404; margin-bottom: 10px;">No Schedule Found</h4>
                    <p style="color: #856404; margin: 0;">No matchups found for Week ${selectedWeek}. Please check the schedule configuration.</p>
                </div>
            `;
            return;
        }
        
        // Generate unified scoring interface
        const scoringHTML = await generateWeeklyScoringInterface(selectedWeek, scheduleData);
        contentDiv.innerHTML = scoringHTML;
        
        // Load existing data
        await loadExistingWeeklyScoringData(selectedWeek);
        
        console.log(`✅ Weekly Scoring loaded for Week ${selectedWeek}`);
        
    } catch (error) {
        console.error('Error loading weekly scoring:', error);
        contentDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; background: #f8d7da; border-radius: 8px;">
                <h4 style="color: #721c24; margin-bottom: 10px;">Error Loading Week</h4>
                <p style="color: #721c24; margin: 0;">Failed to load Week ${selectedWeek} data. Please try again.</p>
            </div>
        `;
    }
};

// Generate the unified scoring interface for a week
async function generateWeeklyScoringInterface(weekNumber, scheduleData) {
    let html = `
        <div class="weekly-scoring-container">
            <div class="week-header" style="text-align: center; margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                <h3 style="margin: 0; color: #2d4a2d;">Week ${weekNumber} Scoring</h3>
                <p style="margin: 5px 0 0 0; color: #666;">Click player names to set lineups • Click score cells to enter scores</p>
            </div>
    `;
    
    // Generate unified scorecards for each matchup
    for (let matchupIndex = 0; matchupIndex < scheduleData.length; matchupIndex++) {
        const matchup = scheduleData[matchupIndex];
        const scorecardHTML = await generateUnifiedScorecard(weekNumber, matchupIndex, matchup);
        html += scorecardHTML;
    }
    
    html += `</div>`;
    return html;
}

// Generate a unified scorecard that combines lineup setting and score entry
async function generateUnifiedScorecard(weekNumber, matchupIndex, matchup) {
    const team1Name = getAdminTeamName(matchup.team1);
    const team2Name = getAdminTeamName(matchup.team2);
    
    return `
        <div class="unified-scorecard" data-week="${weekNumber}" data-matchup="${matchupIndex}" style="margin-bottom: 40px; border: 2px solid #2d4a2d; border-radius: 8px; overflow: hidden; background: white;">
            <!-- Matchup Header -->
            <div class="matchup-header" style="background: #2d4a2d; color: white; padding: 15px; text-align: center;">
                <h3 style="margin: 0; font-size: 1.2rem;">${team1Name} vs ${team2Name}</h3>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Best Ball Format</p>
            </div>
            
            <!-- Match 1 -->
            <div class="match-section" data-match="1">
                <div class="match-header" style="background: #4a5d4a; color: white; padding: 10px 15px;">
                    <h4 style="margin: 0;">Match 1</h4>
                </div>
                ${await generateUnifiedMatchTable(weekNumber, matchupIndex, 1, team1Name, team2Name)}
            </div>
            
            <!-- Match 2 -->
            <div class="match-section" data-match="2">
                <div class="match-header" style="background: #4a5d4a; color: white; padding: 10px 15px;">
                    <h4 style="margin: 0;">Match 2</h4>
                </div>
                ${await generateUnifiedMatchTable(weekNumber, matchupIndex, 2, team1Name, team2Name)}
            </div>
        </div>
    `;
}

// Generate unified match table with editable player names and score cells
async function generateUnifiedMatchTable(weekNumber, matchupIndex, matchNumber, team1Name, team2Name) {
    return `
        <table class="unified-match-table" style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #f8f9fa;">
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Player</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">1</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">2</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">3</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">4</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">5</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">6</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">7</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">8</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">9</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Total</th>
                    <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Points Earned</th>
                </tr>
            </thead>
            <tbody>
                <!-- Team 1 Players -->
                <tr class="player-row" data-team="1" data-player="1">
                    <td class="player-name-cell" style="padding: 10px; border: 1px solid #ddd; background: #e8f5e8;" 
                        data-team="${team1Name}" data-match="${matchNumber}" data-position="1">
                        <select class="player-dropdown" 
                                data-week="${weekNumber}" 
                                data-matchup="${matchupIndex}" 
                                data-match="${matchNumber}" 
                                data-team="${team1Name}" 
                                data-position="1"
                                onchange="handlePlayerSelection(this)"
                                style="width: 100%; padding: 5px; border: none; background: transparent; font-size: 0.9rem;">
                            <option value="">Select Player 1...</option>
                        </select>
                    </td>
                    ${generateEditableScoreCells(weekNumber, matchupIndex, matchNumber, `${team1Name} Player 1`, 1)}
                    <td class="total-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="points-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; background: #f8f9fa;">-</td>
                </tr>
                <tr class="player-row" data-team="1" data-player="2">
                    <td class="player-name-cell" style="padding: 10px; border: 1px solid #ddd; background: #e8f5e8;"
                        data-team="${team1Name}" data-match="${matchNumber}" data-position="2">
                        <select class="player-dropdown" 
                                data-week="${weekNumber}" 
                                data-matchup="${matchupIndex}" 
                                data-match="${matchNumber}" 
                                data-team="${team1Name}" 
                                data-position="2"
                                onchange="handlePlayerSelection(this)"
                                style="width: 100%; padding: 5px; border: none; background: transparent; font-size: 0.9rem;">
                            <option value="">Select Player 2...</option>
                        </select>
                    </td>
                    ${generateEditableScoreCells(weekNumber, matchupIndex, matchNumber, `${team1Name} Player 2`, 2)}
                    <td class="total-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="points-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; background: #f8f9fa;">-</td>
                </tr>
                
                <!-- Team 1 Score Row -->
                <tr class="team-score-row" data-team="1">
                    <td style="padding: 10px; border: 1px solid #ddd; background: #e8f5e8; font-weight: 600;">${team1Name} Team Score</td>
                    <td class="team-score-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="team-score-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="team-score-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="team-score-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="team-score-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="team-score-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="team-score-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="team-score-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="team-score-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="team-total-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #e8f5e8;">-</td>
                    <td class="team-points-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #fff3cd;">-</td>
                </tr>
                
                <!-- Spacer Row -->
                <tr style="height: 10px;"><td colspan="12" style="border: none; background: #f8f9fa;"></td></tr>
                
                <!-- Team 2 Players -->
                <tr class="player-row" data-team="2" data-player="1">
                    <td class="player-name-cell" style="padding: 10px; border: 1px solid #ddd; background: #fff3cd;"
                        data-team="${team2Name}" data-match="${matchNumber}" data-position="1">
                        <select class="player-dropdown" 
                                data-week="${weekNumber}" 
                                data-matchup="${matchupIndex}" 
                                data-match="${matchNumber}" 
                                data-team="${team2Name}" 
                                data-position="1"
                                onchange="handlePlayerSelection(this)"
                                style="width: 100%; padding: 5px; border: none; background: transparent; font-size: 0.9rem;">
                            <option value="">Select Player 1...</option>
                        </select>
                    </td>
                    ${generateEditableScoreCells(weekNumber, matchupIndex, matchNumber, `${team2Name} Player 1`, 3)}
                    <td class="total-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="points-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; background: #f8f9fa;">-</td>
                </tr>
                <tr class="player-row" data-team="2" data-player="2">
                    <td class="player-name-cell" style="padding: 10px; border: 1px solid #ddd; background: #fff3cd;"
                        data-team="${team2Name}" data-match="${matchNumber}" data-position="2">
                        <select class="player-dropdown" 
                                data-week="${weekNumber}" 
                                data-matchup="${matchupIndex}" 
                                data-match="${matchNumber}" 
                                data-team="${team2Name}" 
                                data-position="2"
                                onchange="handlePlayerSelection(this)"
                                style="width: 100%; padding: 5px; border: none; background: transparent; font-size: 0.9rem;">
                            <option value="">Select Player 2...</option>
                        </select>
                    </td>
                    ${generateEditableScoreCells(weekNumber, matchupIndex, matchNumber, `${team2Name} Player 2`, 4)}
                    <td class="total-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="points-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; background: #f8f9fa;">-</td>
                </tr>
                
                <!-- Team 2 Score Row -->
                <tr class="team-score-row" data-team="2">
                    <td style="padding: 10px; border: 1px solid #ddd; background: #fff3cd; font-weight: 600;">${team2Name} Team Score</td>
                    <td class="team-score-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="team-score-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="team-score-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="team-score-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="team-score-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="team-score-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="team-score-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="team-score-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="team-score-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                    <td class="team-total-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #fff3cd;">-</td>
                    <td class="team-points-cell" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #fff3cd;">-</td>
                </tr>
            </tbody>
        </table>
    `;
}

// Generate editable score cells for a player
function generateEditableScoreCells(weekNumber, matchupIndex, matchNumber, playerName, playerIndex) {
    let cells = '';
    for (let hole = 1; hole <= 9; hole++) {
        cells += `
            <td class="score-cell editable" 
                data-week="${weekNumber}"
                data-matchup="${matchupIndex}"
                data-match="${matchNumber}"
                data-player="${playerName}"
                data-hole="${hole}"
                data-player-index="${playerIndex}"
                style="padding: 10px; border: 1px solid #ddd; text-align: center; cursor: pointer; min-width: 40px;"
                onclick="editScoreCell(this)">
                -
            </td>
        `;
    }
    return cells;
}

// Load existing weekly scoring data
async function loadExistingWeeklyScoringData(weekNumber) {
    try {
        // Populate player dropdowns for each team
        await populateAllPlayerDropdowns();
        
        // Load existing lineup and score data
        console.log(`Loading existing data for Week ${weekNumber}`);
    } catch (error) {
        console.error('Error loading existing weekly scoring data:', error);
    }
}

// Populate all player dropdowns with team rosters
async function populateAllPlayerDropdowns() {
    try {
        console.log('🔄 Starting player dropdown population...');
        
        // Get all player dropdowns
        const dropdowns = document.querySelectorAll('.player-dropdown');
        console.log(`Found ${dropdowns.length} player dropdowns to populate`);
        
        // Force load team data
        console.log('🔄 Force loading team and player data...');
        await loadPlayersAndTeams();
        
        // Check what we actually loaded
        console.log('📊 Data check after loading:');
        console.log('- currentTeams:', window.currentTeams ? window.currentTeams.length : 'not loaded');
        console.log('- allPlayers:', window.allPlayers ? window.allPlayers.length : 'not loaded');
        
        if (window.currentTeams) {
            console.log('- Team names:', window.currentTeams.map(t => t.teamName));
        }
        
        // Build team-to-players mapping
        console.log('🔄 Building team players map...');
        buildTeamPlayersMap();
        
        // Populate each dropdown
        console.log('🔄 Populating dropdowns...');
        dropdowns.forEach(dropdown => {
            const teamName = dropdown.dataset.team;
            console.log(`Populating dropdown for team: ${teamName}`);
            populatePlayerDropdown(dropdown, teamName);
        });
        
        console.log(`✅ Completed player dropdown population`);
    } catch (error) {
        console.error('Error populating player dropdowns:', error);
    }
}

// Build a mapping of team names to their players
function buildTeamPlayersMap() {
    try {
        window.teamPlayersMap = {};
        
        // Check if we have the data loaded
        if (!window.currentTeams || !window.allPlayers) {
            console.warn('Cannot build team players map - missing currentTeams or allPlayers');
            console.log('currentTeams:', window.currentTeams);
            console.log('allPlayers:', window.allPlayers ? window.allPlayers.length : 'not loaded');
            return;
        }
        
        // For each team, find its players using the team.players array (which contains player IDs)
        window.currentTeams.forEach(team => {
            const teamName = team.teamName;
            
            // team.players contains array of player IDs, find the actual player objects
            const teamPlayers = [];
            if (team.players && Array.isArray(team.players)) {
                team.players.forEach(playerId => {
                    const player = window.allPlayers.find(p => p.id === playerId);
                    if (player) {
                        teamPlayers.push(player);
                    }
                });
            }
            
            window.teamPlayersMap[teamName] = teamPlayers;
            console.log(`✅ Mapped ${teamPlayers.length} players to team: ${teamName}`, teamPlayers.map(p => p.name));
        });
        
        console.log('Team players map built:', Object.keys(window.teamPlayersMap));
    } catch (error) {
        console.error('Error building team players map:', error);
    }
}

// Populate a single player dropdown with team roster
function populatePlayerDropdown(dropdown, teamName) {
    try {
        // Clear existing options except the first placeholder
        dropdown.innerHTML = '<option value="">Select Player...</option>';
        
        // Get team players from our mapping
        const teamPlayers = window.teamPlayersMap ? window.teamPlayersMap[teamName] : null;
        
        if (!teamPlayers) {
            console.warn(`No player data found for team: ${teamName}`);
            console.log('Available teams in teamPlayersMap:', window.teamPlayersMap ? Object.keys(window.teamPlayersMap) : 'not built');
            console.log('Available teams in currentTeams:', window.currentTeams ? window.currentTeams.map(t => t.teamName) : 'not loaded');
            return;
        }
        
        if (teamPlayers.length === 0) {
            console.warn(`No players found for team: ${teamName}`);
            return;
        }
        
        // Add player options
        teamPlayers.forEach(player => {
            const option = document.createElement('option');
            // Use the player's name property
            const playerName = player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim();
            option.value = playerName;
            option.textContent = playerName;
            dropdown.appendChild(option);
        });
        
        console.log(`✅ Populated dropdown for ${teamName} with ${teamPlayers.length} players`);
        
    } catch (error) {
        console.error(`Error populating dropdown for team ${teamName}:`, error);
    }
}

// Handle player selection and update other dropdowns
window.handlePlayerSelection = function(dropdown) {
    try {
        const selectedPlayer = dropdown.value;
        const weekNumber = dropdown.dataset.week;
        const matchupIndex = dropdown.dataset.matchup;
        const matchNumber = dropdown.dataset.match;
        const teamName = dropdown.dataset.team;
        const position = dropdown.dataset.position;
        
        console.log(`Player selected: ${selectedPlayer} for ${teamName} Match ${matchNumber} Position ${position}`);
        
        // Update score cells with selected player name
        updateScoreCellsPlayerName(dropdown, selectedPlayer);
        
        // Refresh all dropdowns to remove/add players based on selections
        refreshPlayerDropdowns();
        
        // Save lineup change to database
        // TODO: Implement saveLineupChange(weekNumber, matchupIndex, matchNumber, teamName, position, selectedPlayer);
        
    } catch (error) {
        console.error('Error handling player selection:', error);
    }
};

// Update score cell data attributes with selected player name
function updateScoreCellsPlayerName(dropdown, playerName) {
    const row = dropdown.closest('tr');
    const scoreCells = row.querySelectorAll('.score-cell');
    
    scoreCells.forEach(cell => {
        if (playerName) {
            cell.dataset.player = playerName;
        } else {
            // Reset to generic name if no player selected
            const teamName = dropdown.dataset.team;
            const position = dropdown.dataset.position;
            cell.dataset.player = `${teamName} Player ${position}`;
        }
    });
}

// Refresh all player dropdowns to enforce smart selection
function refreshPlayerDropdowns() {
    try {
        // Get all currently selected players
        const selectedPlayers = new Set();
        const dropdowns = document.querySelectorAll('.player-dropdown');
        
        dropdowns.forEach(dropdown => {
            if (dropdown.value) {
                selectedPlayers.add(dropdown.value);
            }
        });
        
        // Update each dropdown to disable selected players
        dropdowns.forEach(dropdown => {
            const currentValue = dropdown.value;
            const teamName = dropdown.dataset.team;
            
            // Repopulate dropdown
            populatePlayerDropdown(dropdown, teamName);
            
            // Restore current selection
            if (currentValue) {
                dropdown.value = currentValue;
            }
            
            // Disable options that are selected elsewhere
            Array.from(dropdown.options).forEach(option => {
                if (option.value && option.value !== currentValue && selectedPlayers.has(option.value)) {
                    option.disabled = true;
                    option.textContent = `${option.value} (Already Selected)`;
                }
            });
        });
        
    } catch (error) {
        console.error('Error refreshing player dropdowns:', error);
    }
}

// Edit player name functionality
window.editPlayerName = function(cell) {
    const currentName = cell.textContent.trim();
    const team = cell.dataset.team;
    const match = cell.dataset.match;
    const position = cell.dataset.position;
    
    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.style.width = '100%';
    input.style.border = 'none';
    input.style.background = 'transparent';
    input.style.outline = 'none';
    input.style.padding = '5px';
    
    // Replace cell content with input
    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    input.select();
    
    // Save on blur or enter
    const savePlayerName = () => {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            cell.textContent = newName;
            // TODO: Save to database
            console.log(`Player name updated: ${currentName} → ${newName}`);
        } else {
            cell.textContent = currentName;
        }
    };
    
    input.addEventListener('blur', savePlayerName);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        }
    });
};

// Edit score cell functionality  
window.editScoreCell = function(cell) {
    const currentScore = cell.textContent.trim();
    
    // Create input field
    const input = document.createElement('input');
    input.type = 'number';
    input.value = currentScore === '-' ? '' : currentScore;
    input.style.width = '100%';
    input.style.border = 'none';
    input.style.background = 'transparent';
    input.style.outline = 'none';
    input.style.padding = '5px';
    input.style.textAlign = 'center';
    input.min = '1';
    input.max = '12';
    
    // Replace cell content with input
    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    input.select();
    
    // Save on blur or enter
    const saveScore = () => {
        const newScore = input.value.trim();
        if (newScore && newScore !== currentScore) {
            cell.textContent = newScore;
            // TODO: Save to database and trigger calculations
            console.log(`Score updated: ${cell.dataset.player} hole ${cell.dataset.hole}: ${newScore}`);
        } else {
            cell.textContent = currentScore;
        }
    };
    
    input.addEventListener('blur', saveScore);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        }
    });
};

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
        const doc = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/settings').doc('signupVisibility').get();
        if (doc.exists) {
            signupVisible = doc.data().visible;
        } else {
            // Create default setting
            await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/settings').doc('signupVisibility').set({ visible: true });
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
        await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/settings').doc('signupVisibility').set({ visible: signupVisible });
        
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

// Refresh participants data after fee received
async function refreshParticipantsData() {
    try {
        // Reload participants from Firebase
        const participantsSnapshot = await db.collection('participants').orderBy('name', 'asc').get();
        allPlayers = [];
        participantsSnapshot.forEach((doc) => {
            allPlayers.push({ id: doc.id, ...doc.data() });
        });
        
        // Update counters with fresh data
        updateMembershipCounters();
        
        // Refresh the teams management display if needed
        renderTeamsManagement();
        
    } catch (error) {
        console.error('Error refreshing participants data:', error);
    }
}

// Update membership counters
function updateMembershipCounters() {
    // Calculate counts
    const pendingCount = pendingRequests.filter(req => !req.status || req.status === 'pending').length;
    const approvedCount = pendingRequests.filter(req => req.status === 'approved').length;
    const paidCount = allPlayers.length;
    const totalCount = approvedCount + paidCount;
    
    // Update membership counter in manage requests section
    const membershipCounter = document.getElementById('membership-counter');
    if (membershipCounter) {
        membershipCounter.innerHTML = `
            <strong>League Status:</strong> 
            Pending: ${pendingCount} | 
            Approved: ${approvedCount} | 
            Paid: ${paidCount} | 
            <strong>Total: ${totalCount}/36</strong>
            ${totalCount >= 36 ? '<span style="color: #dc3545; font-weight: bold; margin-left: 10px;">⚠️ LEAGUE FULL</span>' : ''}
        `;
    }
    
    // Update registered players heading
    const playersHeading = document.getElementById('registered-players-heading');
    if (playersHeading) {
        playersHeading.textContent = `Registered Players - ${paidCount}`;
    }
}

// Render pending requests in admin interface
function renderPendingRequests() {
    const requestsList = document.getElementById('pending-requests-list');
    if (!requestsList) return;
    
    // Update counters first
    updateMembershipCounters();
    
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
            name: formatName(requestData.name),
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
        
        // Refresh participants data to update counters
        await refreshParticipantsData();
        
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

// Remove tag from user in Mailchimp
async function removeMailchimpTag(email, tag) {
    try {
        const response = await fetch('/.netlify/functions/remove-tag', {
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
            console.log(`Tag '${tag}' removed from ${email}:`, result.message);
        } else {
            console.log(`Failed to remove tag '${tag}' from ${email}`);
        }
    } catch (error) {
        console.error('Error removing Mailchimp tag:', error);
    }
}

// Send captain invite email via Mailchimp
async function sendCaptainInvite(captainId) {
    // Find the button that was clicked to update its state
    const buttonSelector = `button[onclick="sendCaptainInvite('${captainId}')"]`;
    const inviteButton = document.querySelector(buttonSelector);
    
    try {
        // Update button to loading state
        if (inviteButton) {
            inviteButton.textContent = 'Sending...';
            inviteButton.disabled = true;
            inviteButton.style.background = '#6c757d';
        }
        
        // Find the captain's email from allPlayers
        const captain = allPlayers.find(player => player.id === captainId);
        if (!captain) {
            showStatusMessage('Captain not found. Please try again.', 'error');
            // Restore button on error
            if (inviteButton) {
                inviteButton.textContent = 'Send Invite';
                inviteButton.disabled = false;
                inviteButton.style.background = '#007bff';
            }
            return;
        }
        
        // Add "2025 Captain" tag to trigger Mailchimp email automation
        await addMailchimpTag(captain.email, '2025 Captain');
        
        // Update participant record to mark invite as sent
        try {
            await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/participants').doc(captainId).update({
                inviteSent: true,
                inviteSentAt: new Date().toISOString()
            });
            console.log(`Marked invite as sent for captain ${captainId}`);
        } catch (error) {
            console.error('Error updating invite status in database:', error);
            // Continue anyway since Mailchimp invite was sent
        }
        
        // Update button to success state
        if (inviteButton) {
            inviteButton.textContent = 'Invite Sent';
            inviteButton.disabled = true;
            inviteButton.style.background = '#28a745';
        }
        
        showStatusMessage(`Captain invite sent to ${captain.name} (${captain.email})!`, 'success');
        
    } catch (error) {
        console.error('Error sending captain invite:', error);
        showStatusMessage('Error sending captain invite. Please try again.', 'error');
        
        // Restore button on error
        if (inviteButton) {
            inviteButton.textContent = 'Send Invite';
            inviteButton.disabled = false;
            inviteButton.style.background = '#007bff';
        }
    }
}

// Load teams data when page loads (for other sections that need team names)
document.addEventListener('DOMContentLoaded', function() {
    // Load signup visibility setting on every page load
    loadSignupVisibility();
    
    // Admin tools will be initialized after authentication in script.js
    // No longer initializing here to prevent auth errors
});

// ===== ADMIN SCORING FUNCTIONS =====

// Global variable to store all teams data for admin scoring
let adminAllTeamsData = {};

// Load all teams for admin scoring name mapping
async function loadAdminTeamsData() {
    try {
        console.log('Loading all teams for admin scoring...');
        const teamsPath = 'clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/teams';
        const teamsSnapshot = await db.collection(teamsPath).get();
        
        adminAllTeamsData = {};
        teamsSnapshot.forEach(doc => {
            const teamData = doc.data();
            const teamId = teamData.teamId || doc.id;
            
            // Create mapping from both "Team X" format and actual team name
            const teamIdStr = String(teamId);
            const defaultName = `Team ${teamId}`;
            const actualName = teamData.teamName || teamData.name || defaultName;
            
            // Map both formats to the actual name
            adminAllTeamsData[defaultName] = actualName;
            adminAllTeamsData[actualName] = actualName;
            
            console.log(`Admin team mapping: "${defaultName}" -> "${actualName}"`);
        });
        
        console.log('Admin teams loaded:', adminAllTeamsData);
        
    } catch (error) {
        console.error('Error loading admin teams:', error);
        // Set up default mapping as fallback
        adminAllTeamsData = {
            'Team 1': 'Team 1',
            'Team 2': 'Team 2',
            'Team 3': 'Team 3',
            'Team 4': 'Team 4',
            'Team 5': 'Team 5',
            'Team 6': 'Team 6'
        };
    }
}

// Get actual team name from schedule team name (admin version)
function getAdminTeamName(scheduleTeamName) {
    return adminAllTeamsData[scheduleTeamName] || scheduleTeamName;
}

// Get actual player names from lineup data for Enter Scores
function getAdminPlayerNames(weekNumber, groupIndex, matchNum, matchup) {
    try {

        
        // Check if we have week scorecard data with lineup information
        if (window.currentWeekScorecard && window.currentWeekScorecard[`matchup${groupIndex}Lineup`]) {
            const matchupLineup = window.currentWeekScorecard[`matchup${groupIndex}Lineup`];
            const matchData = matchupLineup[`match${matchNum}`];
            
            if (matchData) {
                return {
                    team1Player1: matchData.team1Players && matchData.team1Players[0] ? matchData.team1Players[0].name : null,
                    team1Player2: matchData.team1Players && matchData.team1Players[1] ? matchData.team1Players[1].name : null,
                    team2Player1: matchData.team2Players && matchData.team2Players[0] ? matchData.team2Players[0].name : null,
                    team2Player2: matchData.team2Players && matchData.team2Players[1] ? matchData.team2Players[1].name : null
                };
            }
        }
        
        // Fallback to generic names if no lineup data available
        return {
            team1Player1: null,
            team1Player2: null,
            team2Player1: null,
            team2Player2: null
        };
        
    } catch (error) {
        console.error('Error getting player names:', error);
        return {
            team1Player1: null,
            team1Player2: null,
            team2Player1: null,
            team2Player2: null
        };
    }
}

// Load scorecard data for selected week in admin
async function loadAdminWeekScores() {
    const weekSelect = document.getElementById('admin-week-select');
    const selectedWeek = weekSelect.value;
    const container = document.getElementById('admin-scorecards-container');
    
    if (!selectedWeek) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Select a week to view and enter match scores</p>';
        return;
    }
    
    // Load team data if not already loaded
    if (Object.keys(adminAllTeamsData).length === 0) {
        await loadAdminTeamsData();
    }
    
    // Check if a scorecard has been assigned to this week - use nested structure
    try {
        const weekScorecardPath = 'clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/weekScorecards';
        const weekScorecardDoc = await db.collection(weekScorecardPath).doc(`week-${selectedWeek}`).get();
        if (weekScorecardDoc.exists) {
            const weekScorecardData = weekScorecardDoc.data();
            
            // Verify that the referenced scorecard still exists - use nested structure
            const scorecardsPath = 'clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/scorecards';
            const referencedScorecardDoc = await db.collection(scorecardsPath).doc(weekScorecardData.scorecardId).get();
            
            if (referencedScorecardDoc.exists) {
                window.currentWeekScorecard = weekScorecardData;
                console.log(`✅ Loaded scorecard for Week ${selectedWeek}:`, window.currentWeekScorecard.scorecardName);
            } else {
                // Scorecard was deleted, clean up the week assignment
                console.log(`Scorecard "${weekScorecardData.scorecardName}" no longer exists, cleaning up week assignment`);
                await db.collection(weekScorecardPath).doc(`week-${selectedWeek}`).delete();
                window.currentWeekScorecard = null;
                console.log(`ℹ️ Cleaned up invalid scorecard assignment for Week ${selectedWeek}`);
            }
        } else {
            window.currentWeekScorecard = null;
            console.log(`ℹ️ No scorecard assigned to Week ${selectedWeek}`);
        }
    } catch (error) {
        console.error('❌ Error loading week scorecard:', error);
        window.currentWeekScorecard = null;
    }
    
    // Full league schedule - same as Captain's Tools
    const leagueSchedule = {
        '1': [
            { team1: 'Team 1', team2: 'Team 2', format: 'Best Ball Format', match: 1 },
            { team1: 'Team 1', team2: 'Team 2', format: 'Best Ball Format', match: 2 },
            { team1: 'Team 3', team2: 'Team 4', format: 'Best Ball Format', match: 1 },
            { team1: 'Team 3', team2: 'Team 4', format: 'Best Ball Format', match: 2 },
            { team1: 'Team 5', team2: 'Team 6', format: 'Best Ball Format', match: 1 },
            { team1: 'Team 5', team2: 'Team 6', format: 'Best Ball Format', match: 2 }
        ],
        '2': [
            { team1: 'Team 1', team2: 'Team 3', format: 'Alternate Shot Format', match: 1 },
            { team1: 'Team 1', team2: 'Team 3', format: 'Alternate Shot Format', match: 2 },
            { team1: 'Team 2', team2: 'Team 5', format: 'Alternate Shot Format', match: 1 },
            { team1: 'Team 2', team2: 'Team 5', format: 'Alternate Shot Format', match: 2 },
            { team1: 'Team 4', team2: 'Team 6', format: 'Alternate Shot Format', match: 1 },
            { team1: 'Team 4', team2: 'Team 6', format: 'Alternate Shot Format', match: 2 }
        ],
        '3': [
            { team1: 'Team 1', team2: 'Team 4', format: 'Scramble Format', match: 1 },
            { team1: 'Team 1', team2: 'Team 4', format: 'Scramble Format', match: 2 },
            { team1: 'Team 2', team2: 'Team 6', format: 'Scramble Format', match: 1 },
            { team1: 'Team 2', team2: 'Team 6', format: 'Scramble Format', match: 2 },
            { team1: 'Team 3', team2: 'Team 5', format: 'Scramble Format', match: 1 },
            { team1: 'Team 3', team2: 'Team 5', format: 'Scramble Format', match: 2 }
        ],
        '4': [
            { team1: 'Team 1', team2: 'Team 5', format: 'High-Low Format', match: 1 },
            { team1: 'Team 1', team2: 'Team 5', format: 'High-Low Format', match: 2 },
            { team1: 'Team 2', team2: 'Team 3', format: 'High-Low Format', match: 1 },
            { team1: 'Team 2', team2: 'Team 3', format: 'High-Low Format', match: 2 },
            { team1: 'Team 4', team2: 'Team 6', format: 'High-Low Format', match: 1 },
            { team1: 'Team 4', team2: 'Team 6', format: 'High-Low Format', match: 2 }
        ],
        '5': [
            { team1: 'Team 1', team2: 'Team 6', format: 'Modified Stableford Format', match: 1 },
            { team1: 'Team 1', team2: 'Team 6', format: 'Modified Stableford Format', match: 2 },
            { team1: 'Team 2', team2: 'Team 4', format: 'Modified Stableford Format', match: 1 },
            { team1: 'Team 2', team2: 'Team 4', format: 'Modified Stableford Format', match: 2 },
            { team1: 'Team 3', team2: 'Team 5', format: 'Modified Stableford Format', match: 1 },
            { team1: 'Team 3', team2: 'Team 5', format: 'Modified Stableford Format', match: 2 }
        ]
    };
    
    const weekMatches = leagueSchedule[selectedWeek];
    
    if (!weekMatches || weekMatches.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No matches found for this week</p>';
        return;
    }
    
    // Group matches by team pairing (every 2 matches are the same teams)
    const groupedMatches = [];
    for (let i = 0; i < weekMatches.length; i += 2) {
        const match1 = weekMatches[i];
        const match2 = weekMatches[i + 1];
        groupedMatches.push([match1, match2]);
    }
    
    // Render all match scorecards for this week
    container.innerHTML = `
        <div class="admin-week-header">
            <h4>Week ${selectedWeek} Scorecards</h4>
            <p style="color: #666; margin: 5px 0 20px 0;">Enter scores for all matches below</p>
        </div>
        ${groupedMatches.map((matchPair, index) => 
            renderAdminMatchGroup(matchPair, selectedWeek, index)
        ).join('')}
    `;
    
    // Load saved scores from database
    await loadScoresFromDatabase(selectedWeek);
    
    // Reapply styling to existing scores if scorecard is loaded
    if (window.currentWeekScorecard && window.currentWeekScorecard.weekNumber == selectedWeek) {
        setTimeout(() => {
            reapplyScoringStylesForWeek(selectedWeek);
            // Recalculate all player totals
            recalculateAllTotals();
        }, 100);
    }
}

// Render a group of matches (2 matches between same teams) for admin scoring
function renderAdminMatchGroup(matchPair, weekNumber, groupIndex) {
    const [match1, match2] = matchPair;
    
    return `
                 <div class="admin-match-group" style="margin-bottom: 40px; border: 1px solid #ddd; border-radius: 8px; padding: 15px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div class="match-group-header" style="text-align: center; margin-bottom: 20px;">
                <h5 style="margin: 0; color: #2d4a2d;">${getAdminTeamName(match1.team1)} vs ${getAdminTeamName(match1.team2)}</h5>
                <p style="margin: 5px 0 0 0; color: #666; font-size: 0.9rem;">${match1.format}</p>
            </div>
            
                         <div class="admin-scorecards-row" style="display: flex; flex-direction: column; gap: 20px;">
                 ${renderAdminScorecard(match1, weekNumber, groupIndex, 1)}
                 ${renderAdminScorecard(match2, weekNumber, groupIndex, 2)}
             </div>
        </div>
    `;
}

// Generate score cells for a player row
function generateScoreCells(player, matchNum, groupIndex, weekNumber) {
    let cells = '';
    for (let hole = 1; hole <= 9; hole++) {
        cells += `<td class="score-cell" 
                     data-player="${player}" 
                     data-hole="${hole}" 
                     data-match="${matchNum}" 
                     data-group="${groupIndex}" 
                     data-week="${weekNumber}"
                     style="padding: 8px; border: 1px solid #ddd; text-align: center; cursor: pointer; user-select: none; min-height: 36px; min-width: 36px; position: relative; box-sizing: border-box; background: white;"
                     onclick="openScorePad(this)">-</td>`;
    }
    return cells;
}

// Generate team score cells for alternate shot (direct team scoring)
function generateTeamScoreCells(teamId, matchNum, groupIndex, weekNumber) {
    let cells = '';
    for (let hole = 1; hole <= 9; hole++) {
        cells += `<td class="team-score-cell score-cell" 
                     data-player="${teamId}" 
                     data-hole="${hole}" 
                     data-match="${matchNum}" 
                     data-group="${groupIndex}" 
                     data-week="${weekNumber}"
                     style="padding: 8px; border: 1px solid #ddd; text-align: center; cursor: pointer; user-select: none; min-height: 36px; min-width: 36px; position: relative; box-sizing: border-box; background: white;"
                     onclick="openScorePad(this)">-</td>`;
    }
    return cells;
}

// Generate stroke cells for a player stroke row
function generateStrokeCells(player, matchNum, groupIndex, weekNumber) {
    let cells = '';
    for (let hole = 1; hole <= 9; hole++) {
        cells += `<td class="stroke-cell" 
                     data-player="${player}" 
                     data-hole="${hole}"
                     onclick="openStrokeSelector('${player.replace(/'/g, "\\'")}', ${hole})"
                     style="padding: 4px; border: 1px solid #ddd; text-align: center; cursor: pointer; user-select: none; min-height: 24px; min-width: 36px; font-size: 11px; color: #666; background: #f8f9fa;"
                     title="Click to set stroke">add</td>`;
    }
    return cells;
}

// Generate match status cells for a team status row
function generateMatchStatusCells(team, matchNum, groupIndex, weekNumber) {
    let cells = '';
    for (let hole = 1; hole <= 9; hole++) {
        cells += `<td class="match-status-cell" 
                     data-team="${team}" 
                     data-hole="${hole}"
                     data-match="${matchNum}"
                     data-group="${groupIndex}"
                     data-week="${weekNumber}"
                     onclick="openMatchStatusSelector('${team}', ${hole}, ${matchNum}, ${groupIndex})"
                     style="padding: 6px; border: 1px solid #ddd; text-align: center; cursor: pointer; user-select: none; min-height: 24px; min-width: 36px; font-size: 11px; color: #856404; background: #fff3cd;"
                     title="Click to set match status">AS</td>`;
    }
    return cells;
}

// Render Alternate Shot scorecard (Week 2)
function renderAlternateShotScorecard(matchup, weekNumber, groupIndex, matchNum) {
    const team1Name = getAdminTeamName(matchup.team1);
    const team2Name = getAdminTeamName(matchup.team2);
    const team1Id = `${team1Name}-Team-${matchNum}`;
    const team2Id = `${team2Name}-Team-${matchNum}`;

    return `
        <div class="admin-scorecard" style="width: 100%; max-width: 100%; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div class="scorecard-header" style="background: #2d4a2d; color: white; padding: 10px;">
                <div class="match-info" style="text-align: center;">
                    <span class="match-title" style="font-weight: 600; color: white;">Match ${matchNum}</span>
                </div>
            </div>
           
           <div class="golf-scorecard-mini">
               <table class="scorecard-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                   <thead>
                       <tr class="holes-row">
                           <th class="player-col" style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd;">Hole</th>
                           <th style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">1</th>
                           <th style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">2</th>
                           <th style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">3</th>
                           <th style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">4</th>
                           <th style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">5</th>
                           <th style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">6</th>
                           <th style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">7</th>
                           <th style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">8</th>
                           <th style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">9</th>
                           <th class="total-col" style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">Total</th>
                           <th class="points-col" style="padding: 8px; background: #e8f5e8; border: 1px solid #ddd; text-align: center; font-weight: 600;">Points Earned</th>
                       </tr>
                   </thead>
                   <tbody>
                       ${generateParRow(weekNumber)}
                       <tr class="team-row">
                           <td class="team-name" style="padding: 8px; border: 1px solid #ddd; font-weight: 500;">${team1Name} Player 1 & Player 2</td>
                           ${generateTeamScoreCells(team1Id, matchNum, groupIndex, weekNumber)}
                           <td class="team-total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #e8f5e8;">-</td>
                           <td class="team-points-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #fff3cd; color: #856404;">-</td>
                       </tr>
                       <tr class="stroke-row">
                           <td class="stroke-label" style="padding: 4px; border: 1px solid #ddd; font-size: 11px; color: #666; background: #f8f9fa; text-align: right;">stroke</td>
                           ${generateStrokeCells(team1Id, matchNum, groupIndex, weekNumber)}
                           <td class="stroke-total" style="padding: 4px; border: 1px solid #ddd; background: #f8f9fa;"></td>
                       </tr>
                       <tr class="match-status-row" style="background: #fff3cd;">
                           <td class="match-status-label" style="padding: 6px; border: 1px solid #ddd; font-weight: 600; font-size: 0.9rem;">${team1Name} Status</td>
                           ${generateMatchStatusCells(team1Name, matchNum, groupIndex, weekNumber)}
                           <td class="match-status-final" style="padding: 6px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #fff3cd;">-</td>
                       </tr>
                       <tr style="height: 10px;"><td colspan="11" style="border: none;"></td></tr>
                       <tr class="team-row">
                           <td class="team-name" style="padding: 8px; border: 1px solid #ddd; font-weight: 500;">${team2Name} Player 1 & Player 2</td>
                           ${generateTeamScoreCells(team2Id, matchNum, groupIndex, weekNumber)}
                           <td class="team-total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #e8f5e8;">-</td>
                           <td class="team-points-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #fff3cd; color: #856404;">-</td>
                       </tr>
                       <tr class="stroke-row">
                           <td class="stroke-label" style="padding: 4px; border: 1px solid #ddd; font-size: 11px; color: #666; background: #f8f9fa; text-align: right;">stroke</td>
                           ${generateStrokeCells(team2Id, matchNum, groupIndex, weekNumber)}
                           <td class="stroke-total" style="padding: 4px; border: 1px solid #ddd; background: #f8f9fa;"></td>
                       </tr>
                       <tr class="match-status-row" style="background: #fff3cd;">
                           <td class="match-status-label" style="padding: 6px; border: 1px solid #ddd; font-weight: 600; font-size: 0.9rem;">${team2Name} Status</td>
                           ${generateMatchStatusCells(team2Name, matchNum, groupIndex, weekNumber)}
                           <td class="match-status-final" style="padding: 6px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #fff3cd;">-</td>
                       </tr>
                   </tbody>
               </table>
           </div>
       </div>
   `;
}

// Render individual scorecard for admin scoring
function renderAdminScorecard(matchup, weekNumber, groupIndex, matchNum) {
    // Check if this is Alternate Shot format (Week 2) or Scramble format (Week 3)
    const isTeamFormat = weekNumber == 2 || weekNumber == 3;
    
    if (isTeamFormat) {
        return renderAlternateShotScorecard(matchup, weekNumber, groupIndex, matchNum);
    }
    
    // Get actual player names from lineup data, fallback to generic if not available
    const playerNames = getAdminPlayerNames(weekNumber, groupIndex, matchNum, matchup);
    
    // Use actual player names if available, otherwise use generic format
    const team1Player1 = playerNames.team1Player1 || `${getAdminTeamName(matchup.team1)}-${matchNum === 1 ? 'A' : 'C'}`;
    const team1Player2 = playerNames.team1Player2 || `${getAdminTeamName(matchup.team1)}-${matchNum === 1 ? 'B' : 'D'}`;
    const team2Player1 = playerNames.team2Player1 || `${getAdminTeamName(matchup.team2)}-${matchNum === 1 ? 'A' : 'C'}`;
    const team2Player2 = playerNames.team2Player2 || `${getAdminTeamName(matchup.team2)}-${matchNum === 1 ? 'B' : 'D'}`;

    return `
        <div class="admin-scorecard" style="width: 100%; max-width: 100%; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div class="scorecard-header" style="background: #2d4a2d; color: white; padding: 10px;">
                <div class="match-info" style="text-align: center;">
                    <span class="match-title" style="font-weight: 600; color: white;">Match ${matchNum}</span>
                </div>
            </div>
           
           <div class="golf-scorecard-mini">
               <table class="scorecard-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                   <thead>
                       <tr class="holes-row">
                           <th class="player-col" style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd;">Hole</th>
                           <th style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">1</th>
                           <th style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">2</th>
                           <th style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">3</th>
                           <th style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">4</th>
                           <th style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">5</th>
                           <th style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">6</th>
                           <th style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">7</th>
                           <th style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">8</th>
                           <th style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">9</th>
                           <th class="total-col" style="padding: 8px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">Total</th>
                           <th class="points-col" style="padding: 8px; background: #e8f5e8; border: 1px solid #ddd; text-align: center; font-weight: 600;">Points Earned</th>
                       </tr>
                   </thead>
                   <tbody>
                       ${generateParRow(weekNumber)}
                       <tr class="player-row">
                           <td class="player-name" style="padding: 8px; border: 1px solid #ddd; font-weight: 500;">${team1Player1}</td>
                           ${generateScoreCells(team1Player1, matchNum, groupIndex, weekNumber)}
                           <td class="total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #e8f5e8;">-</td>
                           <td class="player-points-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; background: #f8f9fa; color: #666;">-</td>
                       </tr>
                       <tr class="stroke-row">
                           <td class="stroke-label" style="padding: 4px; border: 1px solid #ddd; font-size: 11px; color: #666; background: #f8f9fa; text-align: right;">stroke</td>
                           ${generateStrokeCells(team1Player1, matchNum, groupIndex, weekNumber)}
                           <td class="stroke-total" style="padding: 4px; border: 1px solid #ddd; background: #f8f9fa;"></td>
                       </tr>
                       <tr class="player-row">
                           <td class="player-name" style="padding: 8px; border: 1px solid #ddd; font-weight: 500;">${team1Player2}</td>
                           ${generateScoreCells(team1Player2, matchNum, groupIndex, weekNumber)}
                           <td class="total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #e8f5e8;">-</td>
                           <td class="player-points-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; background: #f8f9fa; color: #666;">-</td>
                       </tr>
                       <tr class="stroke-row">
                           <td class="stroke-label" style="padding: 4px; border: 1px solid #ddd; font-size: 11px; color: #666; background: #f8f9fa; text-align: right;">stroke</td>
                           ${generateStrokeCells(team1Player2, matchNum, groupIndex, weekNumber)}
                           <td class="stroke-total" style="padding: 4px; border: 1px solid #ddd; background: #f8f9fa;"></td>
                       </tr>
                       <tr class="team-score-row" style="background: #f8f9fa;">
                           <td class="team-score-label" style="padding: 8px; border: 1px solid #ddd; font-weight: 600;">${getAdminTeamName(matchup.team1)} Team Score</td>
                           <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                           <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                           <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                           <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                           <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                           <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                           <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                           <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                           <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                           <td class="team-total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #e8f5e8;">-</td>
                           <td class="team-points-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #fff3cd; color: #856404;">-</td>
                       </tr>
                       <tr class="match-status-row" style="background: #fff3cd;">
                           <td class="match-status-label" style="padding: 6px; border: 1px solid #ddd; font-weight: 600; font-size: 0.9rem;">${getAdminTeamName(matchup.team1)} Status</td>
                           ${generateMatchStatusCells(matchup.team1, matchNum, groupIndex, weekNumber)}
                           <td class="match-status-final" style="padding: 6px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #fff3cd;">-</td>
                       </tr>
                       <tr style="height: 10px;"><td colspan="11" style="border: none;"></td></tr>
                       <tr class="player-row">
                           <td class="player-name" style="padding: 8px; border: 1px solid #ddd; font-weight: 500;">${team2Player1}</td>
                           ${generateScoreCells(team2Player1, matchNum, groupIndex, weekNumber)}
                           <td class="total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #e8f5e8;">-</td>
                           <td class="player-points-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; background: #f8f9fa; color: #666;">-</td>
                       </tr>
                       <tr class="stroke-row">
                           <td class="stroke-label" style="padding: 4px; border: 1px solid #ddd; font-size: 11px; color: #666; background: #f8f9fa; text-align: right;">stroke</td>
                           ${generateStrokeCells(team2Player1, matchNum, groupIndex, weekNumber)}
                           <td class="stroke-total" style="padding: 4px; border: 1px solid #ddd; background: #f8f9fa;"></td>
                       </tr>
                       <tr class="player-row">
                           <td class="player-name" style="padding: 8px; border: 1px solid #ddd; font-weight: 500;">${team2Player2}</td>
                           ${generateScoreCells(team2Player2, matchNum, groupIndex, weekNumber)}
                           <td class="total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #e8f5e8;">-</td>
                           <td class="player-points-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; background: #f8f9fa; color: #666;">-</td>
                       </tr>
                       <tr class="stroke-row">
                           <td class="stroke-label" style="padding: 4px; border: 1px solid #ddd; font-size: 11px; color: #666; background: #f8f9fa; text-align: right;">stroke</td>
                           ${generateStrokeCells(team2Player2, matchNum, groupIndex, weekNumber)}
                           <td class="stroke-total" style="padding: 4px; border: 1px solid #ddd; background: #f8f9fa;"></td>
                       </tr>
                       <tr class="team-score-row" style="background: #f8f9fa;">
                           <td class="team-score-label" style="padding: 8px; border: 1px solid #ddd; font-weight: 600;">${getAdminTeamName(matchup.team2)} Team Score</td>
                           <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                           <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                           <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                           <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                           <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                           <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                           <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                           <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                           <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                           <td class="team-total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #e8f5e8;">-</td>
                           <td class="team-points-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #fff3cd; color: #856404;">-</td>
                       </tr>
                       <tr class="match-status-row" style="background: #fff3cd;">
                           <td class="match-status-label" style="padding: 6px; border: 1px solid #ddd; font-weight: 600; font-size: 0.9rem;">${getAdminTeamName(matchup.team2)} Status</td>
                           ${generateMatchStatusCells(matchup.team2, matchNum, groupIndex, weekNumber)}
                           <td class="match-status-final" style="padding: 6px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #fff3cd;">-</td>
                       </tr>
                   </tbody>
               </table>
           </div>
       </div>
   `;
}

// ===== MOBILE SCORE PAD FUNCTIONALITY =====

// Global variables for score pad
let currentScoreCell = null;
let currentPlayerScores = {};
let currentPlayerStrokes = {};
let currentMatchStatus = {};

// Check if device is mobile
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
}

// Open score pad for mobile score entry
function openScorePad(cell) {
    // Check if a scorecard has been selected for this week
    const weekNumber = cell.dataset.week;
    if (!window.currentWeekScorecard || window.currentWeekScorecard.weekNumber != weekNumber) {
        alert(`Please select a scorecard for Week ${weekNumber} before entering scores.\n\nClick the red "Please Select Scorecard" button above to choose the appropriate scorecard configuration.`);
        return;
    }
    
    if (!isMobileDevice()) {
        // On desktop, allow direct keyboard input
        makeDesktopEditable(cell);
        return;
    }
    
    currentScoreCell = cell;
    const scorePad = getOrCreateScorePad();
    const currentScore = cell.textContent.trim();
    
    // Update score pad title
    const player = cell.dataset.player;
    const hole = cell.dataset.hole;
    const titleElement = scorePad.querySelector('.score-pad-title');
    titleElement.textContent = `${player} - Hole ${hole}`;
    
    // Highlight current score if it exists
    const buttons = scorePad.querySelectorAll('.score-btn');
    buttons.forEach(btn => btn.classList.remove('current'));
    if (currentScore !== '-' && currentScore !== '') {
        const currentBtn = scorePad.querySelector(`[data-score="${currentScore}"]`);
        if (currentBtn) currentBtn.classList.add('current');
    }
    
    // Show the score pad
    scorePad.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

// Create or get existing score pad
function getOrCreateScorePad() {
    let scorePad = document.getElementById('mobile-score-pad');
    if (!scorePad) {
        scorePad = createScorePad();
        document.body.appendChild(scorePad);
    }
    return scorePad;
}

// Create the mobile score pad
function createScorePad() {
    const scorePad = document.createElement('div');
    scorePad.id = 'mobile-score-pad';
    scorePad.className = 'mobile-score-pad';
    
    scorePad.innerHTML = `
        <div class="score-pad-overlay" onclick="closeScorePad()"></div>
        <div class="score-pad-content">
            <div class="score-pad-header">
                <h3 class="score-pad-title">Enter Score</h3>
                <button class="score-pad-close" onclick="closeScorePad()">&times;</button>
            </div>
            <div class="score-pad-body">
                <div class="score-grid">
                    ${generateScoreButtons()}
                </div>
                <div class="score-pad-actions">
                    <button class="score-btn score-btn-clear" onclick="clearScore()">Clear</button>
                    <button class="score-btn score-btn-cancel" onclick="closeScorePad()">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    return scorePad;
}

// Generate score buttons (1-12 plus some extras)
function generateScoreButtons() {
    let buttons = '';
    
    // Main scores 1-12
    for (let i = 1; i <= 12; i++) {
        buttons += `<button class="score-btn" data-score="${i}" onclick="selectScore(${i})">${i}</button>`;
    }
    
    return buttons;
}

// Select a score
function selectScore(score) {
    if (!currentScoreCell) return;
    
    // Update the cell
    currentScoreCell.textContent = score;
    
    // Apply visual styling based on score vs par
    applyScoreTypeStyle(currentScoreCell, score);
    
    // Store the score
    const player = currentScoreCell.dataset.player;
    const hole = currentScoreCell.dataset.hole;
    if (!currentPlayerScores[player]) currentPlayerScores[player] = {};
    currentPlayerScores[player][hole] = score;
    
    // Update stroke indicator on score cell
    updateScoreStrokeIndicator(player, hole);
    
    // Update player total
    updatePlayerTotal(player);
    
    // Update team scores for best ball
    updateTeamScores();
    
    // Update team totals (for all formats)
    updateTeamTotals();
    
    // Update team points based on totals
    updateTeamPoints();
    
    // Auto-advance to next hole
    setTimeout(() => {
        closeScorePad();
        advanceToNextHole();
    }, 200);
}

// Open stroke selector for a player on a specific hole
window.openStrokeSelector = function openStrokeSelector(player, hole) {
    // Create stroke selector modal
    const modal = document.createElement('div');
    modal.id = 'stroke-selector-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    const currentStroke = currentPlayerStrokes[player] && currentPlayerStrokes[player][hole];
    
    // Escape player name for safe use in onclick
    const escapedPlayer = player.replace(/'/g, "\\'");
    
    modal.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h4 style="margin: 0 0 15px 0; color: #2d4a2d;">Set Stroke for ${player}</h4>
            <p style="margin: 0 0 20px 0; color: #666;">Hole ${hole}</p>
            
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button onclick="setStroke('${escapedPlayer}', ${hole}, 'none')"
                        style="padding: 10px 20px; border: 2px solid ${currentStroke === 'none' || !currentStroke ? '#4a5d4a' : '#ddd'}; 
                               background: ${currentStroke === 'none' || !currentStroke ? '#4a5d4a' : 'white'}; 
                               color: ${currentStroke === 'none' || !currentStroke ? 'white' : '#666'}; 
                               border-radius: 4px; cursor: pointer; font-weight: 600;">
                    None
                </button>
                
                <button onclick="setStroke('${escapedPlayer}', ${hole}, 'full')"
                        style="padding: 10px 20px; border: 2px solid ${currentStroke === 'full' ? '#4a5d4a' : '#ddd'}; 
                               background: ${currentStroke === 'full' ? '#4a5d4a' : 'white'}; 
                               color: ${currentStroke === 'full' ? 'white' : '#666'}; 
                               border-radius: 4px; cursor: pointer; font-weight: 600;">
                    Full Stroke
                </button>
                
                <button onclick="setStroke('${escapedPlayer}', ${hole}, 'half')"
                        style="padding: 10px 20px; border: 2px solid ${currentStroke === 'half' ? '#4a5d4a' : '#ddd'}; 
                               background: ${currentStroke === 'half' ? '#4a5d4a' : 'white'}; 
                               color: ${currentStroke === 'half' ? 'white' : '#666'}; 
                               border-radius: 4px; cursor: pointer; font-weight: 600;">
                    Half Stroke
                </button>
            </div>
            
            <button onclick="closeStrokeSelector()" 
                    style="margin-top: 15px; padding: 8px 16px; border: 1px solid #6c757d; 
                           background: #6c757d; color: white; border-radius: 4px; cursor: pointer;">
                Cancel
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

// Set stroke for a player on a specific hole
window.setStroke = function setStroke(player, hole, strokeType) {
    try {
        console.log(`Setting stroke for ${player} on hole ${hole}: ${strokeType}`);
        
        // Close modal first to ensure it closes even if there's an error
        closeStrokeSelector();
        
        // Initialize player strokes if needed
        if (!currentPlayerStrokes[player]) currentPlayerStrokes[player] = {};
        
        // Set stroke type
        if (strokeType === 'none') {
            delete currentPlayerStrokes[player][hole];
        } else {
            currentPlayerStrokes[player][hole] = strokeType;
        }
        
        // Update visual indicators
        updateStrokeCell(player, hole);
        updateScoreStrokeIndicator(player, hole);
        
        // Update score styling for this cell (if there's a score)
        if (currentPlayerScores[player] && currentPlayerScores[player][hole]) {
            const scoreCells = document.querySelectorAll(`td.score-cell[data-player="${player}"][data-hole="${hole}"]`);
            scoreCells.forEach(cell => {
                applyScoreTypeStyle(cell, currentPlayerScores[player][hole]);
            });
        }
        
        // Recalculate player total
        updatePlayerTotal(player);
        
        // Update team scores for best ball
        updateTeamScores();
        
        // Update team totals (for all formats)
        updateTeamTotals();
        
        console.log(`✅ Stroke successfully set for ${player} on hole ${hole}: ${strokeType}`);
    } catch (error) {
        console.error(`❌ Error setting stroke for ${player} on hole ${hole}:`, error);
        // Make sure modal closes even if there's an error
        closeStrokeSelector();
    }
}

// Close stroke selector modal
window.closeStrokeSelector = function closeStrokeSelector() {
    const modal = document.getElementById('stroke-selector-modal');
    if (modal) {
        modal.remove();
    }
    document.body.style.overflow = '';
}

// Update stroke cell visual state
function updateStrokeCell(player, hole) {
    const strokeCells = document.querySelectorAll(`td.stroke-cell[data-player="${player}"][data-hole="${hole}"]`);
    const strokeType = currentPlayerStrokes[player] && currentPlayerStrokes[player][hole];
    
    strokeCells.forEach(cell => {
        if (strokeType === 'full') {
            cell.textContent = 'FULL';
            cell.style.background = '#e8f5e8';
            cell.style.color = '#2d4a2d';
            cell.style.fontWeight = 'bold';
        } else if (strokeType === 'half') {
            cell.textContent = 'HALF';
            cell.style.background = '#fff3cd';
            cell.style.color = '#856404';
            cell.style.fontWeight = 'bold';
        } else {
            cell.textContent = 'add';
            cell.style.background = '#f8f9fa';
            cell.style.color = '#666';
            cell.style.fontWeight = 'normal';
        }
    });
}

// Update score cell stroke indicator (dot or 1/2)
function updateScoreStrokeIndicator(player, hole) {
    const scoreCells = document.querySelectorAll(`td.score-cell[data-player="${player}"][data-hole="${hole}"]`);
    const strokeType = currentPlayerStrokes[player] && currentPlayerStrokes[player][hole];
    
    scoreCells.forEach(cell => {
        // Remove any existing stroke indicators
        const existingIndicator = cell.querySelector('.stroke-indicator-overlay');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // Add new stroke indicator if needed
        if (strokeType === 'full') {
            const indicator = document.createElement('div');
            indicator.className = 'stroke-indicator-overlay';
            indicator.style.cssText = `
                position: absolute;
                top: 2px;
                right: 2px;
                width: 4px;
                height: 4px;
                background: black;
                border-radius: 50%;
                pointer-events: none;
            `;
            cell.appendChild(indicator);
        } else if (strokeType === 'half') {
            const indicator = document.createElement('div');
            indicator.className = 'stroke-indicator-overlay';
            indicator.textContent = '½';
            indicator.style.cssText = `
                position: absolute;
                top: 1px;
                right: 2px;
                font-size: 10px;
                color: black;
                font-weight: bold;
                pointer-events: none;
                line-height: 1;
            `;
            cell.appendChild(indicator);
        }
    });
}

// Open match status selector for a team on a specific hole
function openMatchStatusSelector(team, hole, matchNum, groupIndex) {
    // Create match status selector modal
    const modal = document.createElement('div');
    modal.id = 'match-status-selector-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    const matchKey = `${team}-${matchNum}-${groupIndex}`;
    const currentStatus = currentMatchStatus[matchKey] && currentMatchStatus[matchKey][hole];
    
    modal.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 400px;">
            <h4 style="margin: 0 0 15px 0; color: #2d4a2d;">Set Match Status</h4>
            <p style="margin: 0 0 20px 0; color: #666;">${team} - Hole ${hole}</p>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 15px;">
                <button onclick="setMatchStatus('${matchKey}', ${hole}, 'AS')" 
                        style="padding: 8px 12px; border: 2px solid ${currentStatus === 'AS' ? '#4a5d4a' : '#ddd'}; 
                               background: ${currentStatus === 'AS' ? '#4a5d4a' : 'white'}; 
                               color: ${currentStatus === 'AS' ? 'white' : '#666'}; 
                               border-radius: 4px; cursor: pointer; font-weight: 600;">
                    AS
                </button>
                
                <button onclick="setMatchStatus('${matchKey}', ${hole}, '1 up')" 
                        style="padding: 8px 12px; border: 2px solid ${currentStatus === '1 up' ? '#4a5d4a' : '#ddd'}; 
                               background: ${currentStatus === '1 up' ? '#4a5d4a' : 'white'}; 
                               color: ${currentStatus === '1 up' ? 'white' : '#666'}; 
                               border-radius: 4px; cursor: pointer; font-weight: 600;">
                    1 up
                </button>
                
                <button onclick="setMatchStatus('${matchKey}', ${hole}, '1 dn')" 
                        style="padding: 8px 12px; border: 2px solid ${currentStatus === '1 dn' ? '#4a5d4a' : '#ddd'}; 
                               background: ${currentStatus === '1 dn' ? '#4a5d4a' : 'white'}; 
                               color: ${currentStatus === '1 dn' ? 'white' : '#666'}; 
                               border-radius: 4px; cursor: pointer; font-weight: 600;">
                    1 dn
                </button>
                
                <button onclick="setMatchStatus('${matchKey}', ${hole}, '2 up')" 
                        style="padding: 8px 12px; border: 2px solid ${currentStatus === '2 up' ? '#4a5d4a' : '#ddd'}; 
                               background: ${currentStatus === '2 up' ? '#4a5d4a' : 'white'}; 
                               color: ${currentStatus === '2 up' ? 'white' : '#666'}; 
                               border-radius: 4px; cursor: pointer; font-weight: 600;">
                    2 up
                </button>
                
                <button onclick="setMatchStatus('${matchKey}', ${hole}, '2 dn')" 
                        style="padding: 8px 12px; border: 2px solid ${currentStatus === '2 dn' ? '#4a5d4a' : '#ddd'}; 
                               background: ${currentStatus === '2 dn' ? '#4a5d4a' : 'white'}; 
                               color: ${currentStatus === '2 dn' ? 'white' : '#666'}; 
                               border-radius: 4px; cursor: pointer; font-weight: 600;">
                    2 dn
                </button>
                
                <button onclick="setMatchStatus('${matchKey}', ${hole}, '3 up')" 
                        style="padding: 8px 12px; border: 2px solid ${currentStatus === '3 up' ? '#4a5d4a' : '#ddd'}; 
                               background: ${currentStatus === '3 up' ? '#4a5d4a' : 'white'}; 
                               color: ${currentStatus === '3 up' ? 'white' : '#666'}; 
                               border-radius: 4px; cursor: pointer; font-weight: 600;">
                    3 up
                </button>
                
                <button onclick="setMatchStatus('${matchKey}', ${hole}, '3 dn')" 
                        style="padding: 8px 12px; border: 2px solid ${currentStatus === '3 dn' ? '#4a5d4a' : '#ddd'}; 
                               background: ${currentStatus === '3 dn' ? '#4a5d4a' : 'white'}; 
                               color: ${currentStatus === '3 dn' ? 'white' : '#666'}; 
                               border-radius: 4px; cursor: pointer; font-weight: 600;">
                    3 dn
                </button>
                
                <button onclick="setMatchStatus('${matchKey}', ${hole}, '4 up')" 
                        style="padding: 8px 12px; border: 2px solid ${currentStatus === '4 up' ? '#4a5d4a' : '#ddd'}; 
                               background: ${currentStatus === '4 up' ? '#4a5d4a' : 'white'}; 
                               color: ${currentStatus === '4 up' ? 'white' : '#666'}; 
                               border-radius: 4px; cursor: pointer; font-weight: 600;">
                    4 up
                </button>
                
                <button onclick="setMatchStatus('${matchKey}', ${hole}, '4 dn')" 
                        style="padding: 8px 12px; border: 2px solid ${currentStatus === '4 dn' ? '#4a5d4a' : '#ddd'}; 
                               background: ${currentStatus === '4 dn' ? '#4a5d4a' : 'white'}; 
                               color: ${currentStatus === '4 dn' ? 'white' : '#666'}; 
                               border-radius: 4px; cursor: pointer; font-weight: 600;">
                    4 dn
                </button>
            </div>
            
            <button onclick="closeMatchStatusSelector()" 
                    style="padding: 8px 16px; border: 1px solid #6c757d; 
                           background: #6c757d; color: white; border-radius: 4px; cursor: pointer;">
                Cancel
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

// Set match status for a team on a specific hole
function setMatchStatus(matchKey, hole, status) {
    // Initialize match status if needed
    if (!currentMatchStatus[matchKey]) currentMatchStatus[matchKey] = {};
    
    // Set status
    currentMatchStatus[matchKey][hole] = status;
    
    // Update visual indicator
    updateMatchStatusCell(matchKey, hole);
    
    // Close modal
    closeMatchStatusSelector();
    
    console.log(`Match status set for ${matchKey} on hole ${hole}: ${status}`);
}

// Close match status selector modal
function closeMatchStatusSelector() {
    const modal = document.getElementById('match-status-selector-modal');
    if (modal) {
        modal.remove();
    }
    document.body.style.overflow = '';
}

// Update match status cell visual state
function updateMatchStatusCell(matchKey, hole) {
    const statusCells = document.querySelectorAll(`td.match-status-cell[data-team="${matchKey.split('-')[0]}"][data-match="${matchKey.split('-')[1]}"][data-group="${matchKey.split('-')[2]}"][data-hole="${hole}"]`);
    const status = currentMatchStatus[matchKey] && currentMatchStatus[matchKey][hole];
    
    statusCells.forEach(cell => {
        if (status) {
            cell.textContent = status;
            if (status.includes('up')) {
                cell.style.background = '#d4edda';
                cell.style.color = '#155724';
                cell.style.fontWeight = 'bold';
            } else if (status.includes('dn')) {
                cell.style.background = '#f8d7da';
                cell.style.color = '#721c24';
                cell.style.fontWeight = 'bold';
            } else {
                cell.style.background = '#fff3cd';
                cell.style.color = '#856404';
                cell.style.fontWeight = 'bold';
            }
        } else {
            cell.textContent = 'AS';
            cell.style.background = '#fff3cd';
            cell.style.color = '#856404';
            cell.style.fontWeight = 'normal';
        }
    });
}

// Clear the current score
function clearScore() {
    if (!currentScoreCell) return;
    
    currentScoreCell.textContent = '-';
    
    // Apply styling for cleared score (removes all styling)
    applyScoreTypeStyle(currentScoreCell, '-');
    
    const player = currentScoreCell.dataset.player;
    const hole = currentScoreCell.dataset.hole;
    if (currentPlayerScores[player]) {
        delete currentPlayerScores[player][hole];
    }
    
    // Update score stroke indicator (remove any dots/half indicators)
    updateScoreStrokeIndicator(player, hole);
    
    // Update player total
    updatePlayerTotal(player);
    
    // Update team scores for best ball
    updateTeamScores();
    
    // Update team totals (for all formats)
    updateTeamTotals();
    
    // Update team points based on totals
    updateTeamPoints();
    
    closeScorePad();
}

// Close score pad
function closeScorePad() {
    const scorePad = document.getElementById('mobile-score-pad');
    if (scorePad) {
        scorePad.style.display = 'none';
    }
    document.body.style.overflow = ''; // Restore scrolling
    currentScoreCell = null;
}

// Advance to next hole automatically
function advanceToNextHole() {
    if (!currentScoreCell) return;
    
    const currentHole = parseInt(currentScoreCell.dataset.hole);
    const player = currentScoreCell.dataset.player;
    const match = currentScoreCell.dataset.match;
    const group = currentScoreCell.dataset.group;
    const week = currentScoreCell.dataset.week;
    
    if (currentHole < 9) {
        // Find next hole for same player
        const nextHole = currentHole + 1;
        const nextCell = document.querySelector(`[data-player="${player}"][data-hole="${nextHole}"][data-match="${match}"][data-group="${group}"][data-week="${week}"]`);
        if (nextCell && nextCell.textContent.trim() === '-') {
            setTimeout(() => openScorePad(nextCell), 300);
        }
    } else {
        // Find next player, hole 1
        const currentRow = currentScoreCell.closest('tr');
        const nextRow = currentRow.nextElementSibling;
        if (nextRow && nextRow.classList.contains('player-row')) {
            const nextPlayerFirstHole = nextRow.querySelector('[data-hole="1"]');
            if (nextPlayerFirstHole && nextPlayerFirstHole.textContent.trim() === '-') {
                setTimeout(() => openScorePad(nextPlayerFirstHole), 300);
            }
        }
    }
}

// Recalculate totals for all players
function recalculateAllTotals() {
    // Get all unique players from currentPlayerScores and currentPlayerStrokes
    const scorePlayersSet = new Set(Object.keys(currentPlayerScores));
    const strokePlayersSet = new Set(Object.keys(currentPlayerStrokes));
    const allPlayers = [...new Set([...scorePlayersSet, ...strokePlayersSet])];
    
    allPlayers.forEach(player => {
        updatePlayerTotal(player);
        
        // Update stroke cell indicators
        for (let hole = 1; hole <= 9; hole++) {
            updateStrokeCell(player, hole);
            updateScoreStrokeIndicator(player, hole);
        }
    });
    
    // Update team totals (for all formats)
    updateTeamTotals();
    
    // Update team points based on totals
    updateTeamPoints();
    
    // Update match status cells
    Object.keys(currentMatchStatus).forEach(matchKey => {
        for (let hole = 1; hole <= 9; hole++) {
            updateMatchStatusCell(matchKey, hole);
        }
    });
    
    // Update team scores for best ball
    updateTeamScores();
}

// Calculate best ball team score for a specific hole
function calculateBestBallTeamScore(team, hole, matchNum, groupIndex) {
    const playerA = `${team}-${matchNum === 1 ? 'A' : 'C'}`;
    const playerB = `${team}-${matchNum === 1 ? 'B' : 'D'}`;
    
    // Get gross scores for both players
    const scoreA = currentPlayerScores[playerA] && currentPlayerScores[playerA][hole];
    const scoreB = currentPlayerScores[playerB] && currentPlayerScores[playerB][hole];
    
    if (!scoreA && !scoreB) return null; // No scores entered yet
    
    let netScores = [];
    
    // Calculate net score for Player A
    if (scoreA) {
        const strokeTypeA = currentPlayerStrokes[playerA] && currentPlayerStrokes[playerA][hole];
        let strokeValueA = 0;
        if (strokeTypeA === 'full') strokeValueA = 1;
        else if (strokeTypeA === 'half') strokeValueA = 0.5;
        
        const netScoreA = parseInt(scoreA) - strokeValueA;
        netScores.push(netScoreA);
    }
    
    // Calculate net score for Player B
    if (scoreB) {
        const strokeTypeB = currentPlayerStrokes[playerB] && currentPlayerStrokes[playerB][hole];
        let strokeValueB = 0;
        if (strokeTypeB === 'full') strokeValueB = 1;
        else if (strokeTypeB === 'half') strokeValueB = 0.5;
        
        const netScoreB = parseInt(scoreB) - strokeValueB;
        netScores.push(netScoreB);
    }
    
    // Return the best (lowest) net score
    return Math.min(...netScores);
}

// Get numeric stroke value for a player/team on a hole
function getStrokeValue(player, hole) {
    if (!currentPlayerStrokes[player] || !currentPlayerStrokes[player][hole]) {
        return 0; // No stroke
    }
    
    const strokeType = currentPlayerStrokes[player][hole];
    if (strokeType === 'full') {
        return 1;
    } else if (strokeType === 'half') {
        return 0.5;
    }
    
    return 0; // Default to no stroke
}

// Calculate automatic match status based on team scores
function calculateMatchStatus() {
    try {
        // Find all team score rows (Best Ball and Alternate Shot)
        const teamScoreRows = document.querySelectorAll('tr.team-score-row, tr.team-row');
        
        // Process each match (pair of team rows)
        for (let i = 0; i < teamScoreRows.length; i += 2) {
            const team1Row = teamScoreRows[i];
            const team2Row = teamScoreRows[i + 1];
            
            if (!team1Row || !team2Row) continue;
            
            // Handle different row types (Best Ball vs Alternate Shot)
            const isAlternateShot = team1Row.classList.contains('team-row');
            
            let team1ScoreCells, team2ScoreCells;
            let team1StatusRow, team2StatusRow;
            
            if (isAlternateShot) {
                // Alternate Shot: score cells are directly editable team scores
                team1ScoreCells = team1Row.querySelectorAll('td.team-score-cell.score-cell');
                team2ScoreCells = team2Row.querySelectorAll('td.team-score-cell.score-cell');
                
                // Skip stroke row to find status row
                team1StatusRow = team1Row.nextElementSibling?.nextElementSibling;
                team2StatusRow = team2Row.nextElementSibling?.nextElementSibling;
            } else {
                // Best Ball: team score cells are calculated
                team1ScoreCells = team1Row.querySelectorAll('td.team-score-cell');
                team2ScoreCells = team2Row.querySelectorAll('td.team-score-cell');
                
                team1StatusRow = team1Row.nextElementSibling;
                team2StatusRow = team2Row.nextElementSibling;
            }
            
            if (!team1StatusRow || !team2StatusRow) continue;
            
            const team1StatusCells = team1StatusRow.querySelectorAll('td.match-status-cell');
            const team2StatusCells = team2StatusRow.querySelectorAll('td.match-status-cell');
            
            let matchStatus = 0; // 0 = AS, positive = team1 up, negative = team2 up
            let matchOver = false;
            let matchOverHole = -1;
            const totalHoles = Math.min(team1ScoreCells.length, team2ScoreCells.length);
            
            // Calculate hole by hole
            for (let hole = 0; hole < totalHoles; hole++) {
                const team1GrossScore = parseFloat(team1ScoreCells[hole].textContent.trim());
                const team2GrossScore = parseFloat(team2ScoreCells[hole].textContent.trim());
                
                // Get team identifiers for stroke lookup
                const team1Player = team1ScoreCells[hole].dataset.player;
                const team2Player = team2ScoreCells[hole].dataset.player;
                
                // Calculate net scores (gross - strokes)
                const team1Strokes = getStrokeValue(team1Player, hole + 1);
                const team2Strokes = getStrokeValue(team2Player, hole + 1);
                
                const team1Score = team1GrossScore - team1Strokes;
                const team2Score = team2GrossScore - team2Strokes;
                
                const holesRemaining = totalHoles - (hole + 1);
                
                // Only calculate if both teams have gross scores and match isn't over
                if (!matchOver && !isNaN(team1GrossScore) && !isNaN(team2GrossScore) && team1GrossScore > 0 && team2GrossScore > 0) {
                    if (team1Score < team2Score) {
                        matchStatus += 1; // Team 1 wins hole
                    } else if (team2Score < team1Score) {
                        matchStatus -= 1; // Team 2 wins hole
                    }
                    // Tied hole doesn't change status
                    
                    // Check if match is over (can't be caught up)
                    if (Math.abs(matchStatus) > holesRemaining) {
                        matchOver = true;
                        matchOverHole = hole;
                    }
                }
                
                // Update status display for this hole
                if (team1StatusCells[hole] && team2StatusCells[hole]) {
                    if (matchOver && hole >= matchOverHole) {
                        // Match is over, show final status on the deciding hole
                        if (hole === matchOverHole) {
                            const holesUp = Math.abs(matchStatus);
                            const finalStatus = `${holesUp}&${holesRemaining}`;
                            
                            if (matchStatus > 0) {
                                // Team 1 wins
                                team1StatusCells[hole].textContent = finalStatus;
                                team1StatusCells[hole].style.background = '#d4edda';
                                team1StatusCells[hole].style.color = '#155724';
                                team1StatusCells[hole].style.fontWeight = 'bold';
                                
                                team2StatusCells[hole].textContent = '';
                                team2StatusCells[hole].style.background = '';
                                team2StatusCells[hole].style.color = '';
                                team2StatusCells[hole].style.fontWeight = '';
                            } else {
                                // Team 2 wins
                                team2StatusCells[hole].textContent = finalStatus;
                                team2StatusCells[hole].style.background = '#d4edda';
                                team2StatusCells[hole].style.color = '#155724';
                                team2StatusCells[hole].style.fontWeight = 'bold';
                                
                                team1StatusCells[hole].textContent = '';
                                team1StatusCells[hole].style.background = '';
                                team1StatusCells[hole].style.color = '';
                                team1StatusCells[hole].style.fontWeight = '';
                            }
                        } else {
                            // Holes after match is over - leave blank
                            team1StatusCells[hole].textContent = '';
                            team1StatusCells[hole].style.background = '';
                            team1StatusCells[hole].style.color = '';
                            team1StatusCells[hole].style.fontWeight = '';
                            
                            team2StatusCells[hole].textContent = '';
                            team2StatusCells[hole].style.background = '';
                            team2StatusCells[hole].style.color = '';
                            team2StatusCells[hole].style.fontWeight = '';
                        }
                    } else if (!isNaN(team1Score) && !isNaN(team2Score) && team1Score > 0 && team2Score > 0) {
                        // Match still active, show current status
                        if (matchStatus > 0) {
                            team1StatusCells[hole].textContent = `${matchStatus} up`;
                            team1StatusCells[hole].style.background = '#d4edda';
                            team1StatusCells[hole].style.color = '#155724';
                            team1StatusCells[hole].style.fontWeight = 'bold';
                            
                            team2StatusCells[hole].textContent = `${matchStatus} dn`;
                            team2StatusCells[hole].style.background = '#f8d7da';
                            team2StatusCells[hole].style.color = '#721c24';
                            team2StatusCells[hole].style.fontWeight = 'bold';
                        } else if (matchStatus < 0) {
                            team2StatusCells[hole].textContent = `${Math.abs(matchStatus)} up`;
                            team2StatusCells[hole].style.background = '#d4edda';
                            team2StatusCells[hole].style.color = '#155724';
                            team2StatusCells[hole].style.fontWeight = 'bold';
                            
                            team1StatusCells[hole].textContent = `${Math.abs(matchStatus)} dn`;
                            team1StatusCells[hole].style.background = '#f8d7da';
                            team1StatusCells[hole].style.color = '#721c24';
                            team1StatusCells[hole].style.fontWeight = 'bold';
                        } else {
                            // All square
                            team1StatusCells[hole].textContent = 'AS';
                            team1StatusCells[hole].style.background = '#fff3cd';
                            team1StatusCells[hole].style.color = '#856404';
                            team1StatusCells[hole].style.fontWeight = 'bold';
                            
                            team2StatusCells[hole].textContent = 'AS';
                            team2StatusCells[hole].style.background = '#fff3cd';
                            team2StatusCells[hole].style.color = '#856404';
                            team2StatusCells[hole].style.fontWeight = 'bold';
                        }
                    } else {
                        // No scores yet, reset to AS
                        team1StatusCells[hole].textContent = 'AS';
                        team1StatusCells[hole].style.background = '#fff3cd';
                        team1StatusCells[hole].style.color = '#856404';
                        team1StatusCells[hole].style.fontWeight = 'normal';
                        
                        team2StatusCells[hole].textContent = 'AS';
                        team2StatusCells[hole].style.background = '#fff3cd';
                        team2StatusCells[hole].style.color = '#856404';
                        team2StatusCells[hole].style.fontWeight = 'normal';
                    }
                }
            }
            
            // Update final status cells with current match result
            const team1FinalStatusCell = team1StatusRow?.querySelector('.match-status-final');
            const team2FinalStatusCell = team2StatusRow?.querySelector('.match-status-final');
            
            if (team1FinalStatusCell && team2FinalStatusCell) {
                if (matchOver) {
                    // Match is over, show final result
                    const holesUp = Math.abs(matchStatus);
                    const finalStatus = `${holesUp}&${totalHoles - matchOverHole - 1}`;
                    
                    if (matchStatus > 0) {
                        // Team 1 wins
                        team1FinalStatusCell.textContent = finalStatus;
                        team2FinalStatusCell.textContent = '';
                    } else {
                        // Team 2 wins
                        team2FinalStatusCell.textContent = finalStatus;
                        team1FinalStatusCell.textContent = '';
                    }
                } else {
                    // Match still active, show current status
                    if (matchStatus > 0) {
                        team1FinalStatusCell.textContent = `${matchStatus}up`;
                        team2FinalStatusCell.textContent = `${matchStatus}dn`;
                    } else if (matchStatus < 0) {
                        team2FinalStatusCell.textContent = `${Math.abs(matchStatus)}up`;
                        team1FinalStatusCell.textContent = `${Math.abs(matchStatus)}dn`;
                    } else {
                        // All square
                        team1FinalStatusCell.textContent = 'AS';
                        team2FinalStatusCell.textContent = 'AS';
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ Error calculating match status:', error);
    }
}

// Update team score cells for best ball format
function updateTeamScores() {
    try {
        // Find all team score cells that need calculation (Best Ball format)
        const teamScoreCells = document.querySelectorAll('td.team-score-cell:not(.score-cell)');
        
        teamScoreCells.forEach(cell => {
            const hole = cell.dataset?.hole;
            if (!hole) {
                // Find the hole number by looking at the column position
                const row = cell.closest('tr');
                const cellIndex = Array.from(row.cells).indexOf(cell);
                const holeNumber = cellIndex; // Holes are in columns 2-10 (1-9)
                
                if (holeNumber >= 1 && holeNumber <= 9) {
                    // Find the team from the row
                    const teamRow = cell.closest('tr');
                    const teamLabel = teamRow.querySelector('.team-score-label');
                    if (teamLabel) {
                        const labelText = teamLabel.textContent;
                        
                        // Determine match number from context
                        const scorecard = cell.closest('.admin-scorecard');
                        let matchNum = 1; // Default to match 1
                        
                        if (scorecard) {
                            const matchTitle = scorecard.querySelector('.match-title');
                            if (matchTitle) {
                                matchNum = parseInt(matchTitle.textContent.replace('Match ', '')) || 1;
                            }
                        }
                        
                        // Find actual player names from the scorecard for this team/match
                        const scorecardElement = cell.closest('.admin-scorecard');
                        if (scorecardElement) {
                            const playerCells = scorecardElement.querySelectorAll(`td.score-cell[data-hole="${holeNumber}"]`);
                            let teamPlayerCells = [];
                            
                            // Determine which team this is based on label text and position
                            // Check if this is Team 1's row (first team in the matchup)
                            const teamRows = scorecardElement.querySelectorAll('.team-score-row');
                            const isFirstTeam = teamRows[0] && teamRows[0].contains(cell);
                            
                            if (isFirstTeam) {
                                teamPlayerCells = [playerCells[0], playerCells[1]]; // First 2 players
                            } else {
                                teamPlayerCells = [playerCells[2], playerCells[3]]; // Last 2 players  
                            }
                            
                            // Get actual player names and scores
                            let bestNetScore = null;
                            teamPlayerCells.forEach(playerCell => {
                                if (playerCell) {
                                    const playerName = playerCell.dataset.player;
                                    const score = currentPlayerScores[playerName] && currentPlayerScores[playerName][holeNumber];
                                    
                                    if (score) {
                                        // Get stroke info for net score calculation
                                        const strokeType = currentPlayerStrokes[playerName] && currentPlayerStrokes[playerName][holeNumber];
                                        let strokeValue = 0;
                                        if (strokeType === 'full') strokeValue = 1;
                                        else if (strokeType === 'half') strokeValue = 0.5;
                                        
                                        const netScore = parseInt(score) - strokeValue;
                                        if (bestNetScore === null || netScore < bestNetScore) {
                                            bestNetScore = netScore;
                                        }
                                    }
                                }
                            });
                            
                            if (bestNetScore !== null) {
                                cell.textContent = Math.round(bestNetScore * 2) / 2; // Handle half strokes properly
                                cell.style.fontWeight = '600';
                                cell.style.color = '#2d4a2d';
                            } else {
                                cell.textContent = '-';
                                cell.style.fontWeight = '600';
                                cell.style.color = '#666';
                            }
                        }
                    }
                }
            }
        });
    
        // Update team totals
        updateTeamTotals();
    } catch (error) {
        console.error('❌ Error updating team scores:', error);
    }
}

// Calculate and update team points based on match status
function updateTeamPoints() {
    try {
        // Find all team points cells
        const teamPointsCells = document.querySelectorAll('td.team-points-cell');
        
        teamPointsCells.forEach(cell => {
            const teamRow = cell.closest('tr');
            if (!teamRow) return;
            
            // Find the scorecard this team belongs to
            const scorecard = cell.closest('.admin-scorecard');
            if (!scorecard) return;
            
            // Find the status rows for this match
            const statusRows = scorecard.querySelectorAll('tr.match-status-row');
            
            // Determine which team this is (first or second team in the match)
            const allTeamRows = scorecard.querySelectorAll('tr.team-score-row, tr.team-row');
            const teamIndex = Array.from(allTeamRows).indexOf(teamRow);
            
            if (teamIndex >= 0 && teamIndex < statusRows.length) {
                const statusRow = statusRows[teamIndex];
                const finalStatusCell = statusRow.querySelector('.match-status-final');
                
                if (finalStatusCell) {
                    const status = finalStatusCell.textContent.trim();
                    let points = 0;
                    
                    // Parse match status to determine points earned
                    if (status === 'AS' || status === 'Tie' || status === 'T') {
                        // All Square / Tie
                        points = 1;
                    } else if (status.includes('up') || status.includes('&')) {
                        // This team is ahead (e.g., "1up", "3&1")
                        points = 2;
                    } else if (status.includes('dn')) {
                        // This team is down (e.g., "1dn", "2dn")
                        points = 0;
                    } else if (status === '-' || status === '') {
                        // Match not complete
                        points = '-';
                    }
                    
                    // Update the cell
                    cell.textContent = points;
                    
                    // Color coding
                    if (points === 2) {
                        cell.style.background = '#d4edda'; // Green for win
                        cell.style.color = '#155724';
                    } else if (points === 1) {
                        cell.style.background = '#fff3cd'; // Yellow for tie
                        cell.style.color = '#856404';
                    } else if (points === 0) {
                        cell.style.background = '#f8d7da'; // Red for loss
                        cell.style.color = '#721c24';
                    } else {
                        // Match incomplete
                        cell.textContent = '-';
                        cell.style.background = '#f8f9fa';
                        cell.style.color = '#666';
                    }
                } else {
                    // No status cell found
                    cell.textContent = '-';
                    cell.style.background = '#f8f9fa';
                    cell.style.color = '#666';
                }
            }
        });
        
    } catch (error) {
        console.error('Error updating team points:', error);
    }
}

// Update team total cells
function updateTeamTotals() {
    const teamTotalCells = document.querySelectorAll('td.team-total-cell');
    
    teamTotalCells.forEach(cell => {
        // Find the corresponding team score row
        const teamRow = cell.closest('tr');
        const teamScoreCells = teamRow.querySelectorAll('td.team-score-cell');
        
        let total = 0;
        let hasScores = false;
        
        teamScoreCells.forEach(scoreCell => {
            const scoreText = scoreCell.textContent.trim();
            if (scoreText !== '-' && !isNaN(parseFloat(scoreText))) {
                total += parseFloat(scoreText);
                hasScores = true;
            }
        });
        
        if (hasScores) {
            cell.textContent = Math.round(total * 2) / 2; // Handle half scores properly
            cell.style.fontWeight = '600';
            cell.style.color = '#2d4a2d';
        } else {
            cell.textContent = '-';
            cell.style.fontWeight = '600';
            cell.style.color = '#666';
        }
    });
}

// Update player total in the scorecard
function updatePlayerTotal(player) {
    // Calculate total from player's scores (net scores considering strokes)
    let total = 0;
    let hasScores = false;
    
    if (currentPlayerScores[player]) {
        for (let hole = 1; hole <= 9; hole++) {
            if (currentPlayerScores[player][hole]) {
                let grossScore = parseInt(currentPlayerScores[player][hole]);
                
                // Total should be gross scores only
                total += grossScore;
                hasScores = true;
            }
        }
    }
    
    // Find all total cells for this player/team (there may be multiple scorecards on the page)
    const totalCells = document.querySelectorAll(`td.total-cell, td.team-total-cell`);
    
    totalCells.forEach(cell => {
        // Find the row this total cell belongs to (could be player-row or team-row)
        const row = cell.closest('tr.player-row, tr.team-row');
        if (!row) return;
        
        // Check if this row has score cells for the same player/team
        const scoreCells = row.querySelectorAll('td.score-cell');
        if (scoreCells.length > 0) {
            const firstScoreCell = scoreCells[0];
            if (firstScoreCell && firstScoreCell.dataset.player === player) {
                // This is the total cell for our player/team
                cell.textContent = hasScores ? total : '-';
                
                // Add visual styling to the total
                if (hasScores) {
                    cell.style.fontWeight = '600';
                    cell.style.color = '#2d4a2d';
                } else {
                    cell.style.fontWeight = '600';
                    cell.style.color = '#666';
                }
            }
        }
    });
}

// Desktop editing functionality
async function makeDesktopEditable(cell) {
    // Check if a scorecard has been selected for this week
    const weekNumber = cell.dataset.week;
    if (!window.currentWeekScorecard || window.currentWeekScorecard.weekNumber != weekNumber) {
        alert(`Please select a scorecard for Week ${weekNumber} before entering scores.\n\nClick the red "Please Select Scorecard" button above to choose the appropriate scorecard configuration.`);
        return;
    }
    
    const currentValue = cell.textContent.trim();
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.max = '12';
    input.value = currentValue === '-' ? '' : currentValue;
    input.style.width = '100%';
    input.style.textAlign = 'center';
    input.style.border = 'none';
    input.style.background = 'transparent';
    input.style.fontSize = 'inherit';
    input.style.outline = 'none';
    input.style.boxShadow = 'none';
    
    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    input.select();
    
    function saveValue() {
        const value = input.value.trim();
        const score = value === '' ? '-' : value;
        cell.textContent = score;
        
        // Apply visual styling based on score vs par
        applyScoreTypeStyle(cell, score);
        
        // Store the score
        const player = cell.dataset.player;
        const hole = cell.dataset.hole;
        if (!currentPlayerScores[player]) currentPlayerScores[player] = {};
        if (score !== '-') {
            currentPlayerScores[player][hole] = parseInt(score);
        } else if (currentPlayerScores[player]) {
            delete currentPlayerScores[player][hole];
        }
        
        // Update stroke indicator on score cell
        updateScoreStrokeIndicator(player, hole);
        
        // Update player total
        updatePlayerTotal(player);
        
        // Update team scores for best ball
        updateTeamScores();
        
        // Update team totals (for all formats)
        updateTeamTotals();
        
        // Calculate match play status (1up, 2dn, etc.)
        calculateMatchStatus();
        
        // Update team points based on match status (with slight delay to ensure status is set)
        setTimeout(() => {
            updateTeamPoints();
        }, 100);
        
        // Auto-save scores to database
        saveScoresToDatabase(weekNumber);
        
        // Update standings after scores are saved
        setTimeout(async () => {
            try {
                await updateStandingsSection();
            } catch (error) {
                console.error('Error updating standings after score save:', error);
            }
        }, 500);
    }
    
    input.addEventListener('blur', saveValue);
    
    // Auto-advance when a valid number is entered
    input.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        

        
        if (value && !isNaN(value)) {
            const numValue = parseInt(value);
            
            // For single digits 1-9, advance immediately
            if (numValue >= 1 && numValue <= 9) {
                saveValue();
                setTimeout(() => advanceToNextHoleDesktop(cell), 100);
            }
            // For valid double digits 10-12, advance immediately
            else if (numValue >= 10 && numValue <= 12) {
                saveValue();
                setTimeout(() => advanceToNextHoleDesktop(cell), 100);
            }
        }
    });
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveValue();
            // Auto-advance to next hole
            setTimeout(() => advanceToNextHoleDesktop(cell), 100);
        } else if (e.key === 'Escape') {
            cell.textContent = currentValue;
            cell.style.backgroundColor = currentValue !== '-' ? '#e8f5e8' : '';
        }
    });
}

// Advance to next hole for desktop editing
function advanceToNextHoleDesktop(currentCell) {
    if (!currentCell) return;
    
    const currentHole = parseInt(currentCell.dataset.hole);
    const player = currentCell.dataset.player;
    const match = currentCell.dataset.match;
    const group = currentCell.dataset.group;
    const week = currentCell.dataset.week;
    
    if (currentHole < 9) {
        // Find next hole for same player
        const nextHole = currentHole + 1;
        const nextCell = document.querySelector(`[data-player="${player}"][data-hole="${nextHole}"][data-match="${match}"][data-group="${group}"][data-week="${week}"]`);
        if (nextCell && nextCell.textContent.trim() === '-') {
            makeDesktopEditable(nextCell);
        }
    } else {
        // Find next player, hole 1
        const currentRow = currentCell.closest('tr');
        const nextRow = currentRow.nextElementSibling;
        if (nextRow && nextRow.classList.contains('player-row')) {
            const nextPlayerFirstHole = nextRow.querySelector('[data-hole="1"]');
            if (nextPlayerFirstHole && nextPlayerFirstHole.textContent.trim() === '-') {
                makeDesktopEditable(nextPlayerFirstHole);
            }
        }
    }
}

// Load and display existing scorecards
async function loadScorecards() {

    try {
        const scorecardsContainer = document.querySelector('.scorecard-list-section');

        if (!scorecardsContainer) {
            console.error('❌ SCORECARD SETUP: .scorecard-list-section not found!');
            return;
        }
        
        // Show loading state
        scorecardsContainer.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <p style="color: #666; font-size: 1.1rem;">Loading scorecards...</p>
            </div>
        `;
        
        // Fetch scorecards from Firebase - using nested structure path

        const scorecardPath = 'clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/scorecards';
        const scorecardsSnapshot = await db.collection(scorecardPath).orderBy('createdAt', 'desc').get();
        
        if (scorecardsSnapshot.empty) {
            // Show "no scorecards" state
            showNoScorecardsState();
        } else {
            // Show scorecards list
            showScorecardsList(scorecardsSnapshot.docs);
        }
        
    } catch (error) {
        console.error('❌ SCORECARD SETUP: Error loading scorecards:', error);
        console.error('❌ SCORECARD SETUP: Error stack:', error.stack);
        const scorecardsContainer = document.querySelector('.scorecard-list-section');
        if (scorecardsContainer) {
            scorecardsContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #dc3545;">
                    <p style="font-size: 1.1rem; margin-bottom: 15px;">Error loading scorecards. Please try again.</p>
                    <button onclick="loadScorecards()" style="background: #4a5d4a; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        Retry
                    </button>
                </div>
            `;
        }
    }
}

// Show "no scorecards" empty state
function showNoScorecardsState() {
    const scorecardsContainer = document.querySelector('.scorecard-list-section');
    if (!scorecardsContainer) return;
    
    scorecardsContainer.innerHTML = `
        <div class="no-scorecards-state" style="text-align: center; padding: 40px 20px; background: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6;">
            <h4 style="color: #495057; margin-bottom: 15px; font-size: 1.2rem;">No Scorecards Configured</h4>
            <p style="color: #6c757d; margin-bottom: 25px; font-size: 0.95rem; line-height: 1.5;">
                Create your first scorecard configuration to set par values for each hole.<br/>
                This will enable automatic birdie, par, and bogey calculations during score entry.
            </p>
            
            <button class="add-scorecard-btn" onclick="showScorecardForm()" style="background: #4a5d4a; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-size: 1rem; font-weight: 500; cursor: pointer;">
                Add New Scorecard
            </button>
        </div>
    `;
}

// Show list of existing scorecards
function showScorecardsList(scorecards) {
    const scorecardsContainer = document.querySelector('.scorecard-list-section');
    if (!scorecardsContainer) return;
    
    let scorecardsHTML = `
        <div class="scorecards-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h4 style="color: #4a5d4a; margin: 0;">Saved Scorecards</h4>
            <button onclick="showScorecardForm()" style="background: #4a5d4a; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-size: 0.95rem; font-weight: 500; cursor: pointer;">
                Add New Scorecard
            </button>
        </div>
        <div class="scorecards-list">
    `;
    
    scorecards.forEach(scorecard => {
        const data = scorecard.data();
        const createdDate = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown';
        
        scorecardsHTML += `
            <div class="scorecard-item" style="border: 1px solid #ddd; border-radius: 6px; padding: 15px; margin-bottom: 15px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div class="scorecard-item-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h5 style="margin: 0; color: #2d4a2d; font-size: 1.1rem;">${data.name}</h5>
                    <div class="scorecard-actions">
                        <button onclick="editScorecard('${scorecard.id}')" style="background: #ffc107; color: #212529; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.85rem; cursor: pointer; margin-right: 8px;">
                            Edit
                        </button>
                        <button onclick="deleteScorecard('${scorecard.id}', '${data.name}')" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.85rem; cursor: pointer;">
                            Delete
                        </button>
                    </div>
                </div>
                <div class="scorecard-summary" style="font-size: 0.9rem; color: #666;">
                    <span><strong>Par Total:</strong> ${data.total}</span> • 
                    <span><strong>Created:</strong> ${createdDate}</span>
                    ${data.createdBy ? ` • <span><strong>By:</strong> ${data.createdBy}</span>` : ''}
                </div>
                <div class="par-values-preview" style="margin-top: 10px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                        <tr>
                            <td style="padding: 4px 6px; border: 1px solid #dee2e6; text-align: center; background: #fff; font-weight: 600;">Hole</td>
                            ${Object.keys(data.parValues).sort((a, b) => parseInt(a) - parseInt(b)).map(hole => 
                                `<td style="padding: 4px 6px; border: 1px solid #dee2e6; text-align: center; background: #fff;">${hole}</td>`
                            ).join('')}
                        </tr>
                        <tr>
                            <td style="padding: 4px 6px; border: 1px solid #dee2e6; text-align: center; background: #fff3cd; font-weight: 600;">Par</td>
                            ${Object.keys(data.parValues).sort((a, b) => parseInt(a) - parseInt(b)).map(hole => 
                                `<td style="padding: 4px 6px; border: 1px solid #dee2e6; text-align: center; background: #fff3cd;">${data.parValues[hole]}</td>`
                            ).join('')}
                        </tr>
                    </table>
                </div>
            </div>
        `;
    });
    
    scorecardsHTML += `
        </div>
    `;
    
    scorecardsContainer.innerHTML = scorecardsHTML;
}

// Show scorecard configuration form (for new or edit)
function showScorecardForm(existingData = null, scorecardId = null) {
    const scorecardsContainer = document.querySelector('.scorecard-list-section');
    if (!scorecardsContainer) return;
    
    // Hide existing content
    scorecardsContainer.innerHTML = '';
    
    // Determine if we're editing or creating new
    const isEditing = existingData && scorecardId;
    const headerText = isEditing ? 'Edit Scorecard Configuration' : 'New Scorecard Configuration';
    const saveButtonText = isEditing ? 'Update Scorecard' : 'Save Scorecard';
    
    // Get existing values or defaults
    const scorecardName = existingData ? existingData.name : 'Front Nine';
    const parValues = existingData ? existingData.parValues : {
        '1': 4, '2': 4, '3': 4, '4': 4, '5': 4, '6': 4, '7': 4, '8': 4, '9': 4
    };
    
    // Create scorecard configuration interface
    const scorecardConfigHTML = `
        <div class="scorecard-config-container" style="margin-top: 20px;">
                                      <div class="config-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                 <h4 style="color: #4a5d4a; margin: 0;">${headerText}</h4>
                 <button onclick="cancelScorecardConfig()" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                     Cancel
                 </button>
             </div>
             
             <div class="scorecard-preview" style="border: 1px solid #ddd; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                 <div class="scorecard-header" style="background: #2d4a2d; color: white; padding: 12px; text-align: center;">
                     <span style="font-weight: 600; font-size: 1.1rem;">Scorecard Configuration</span>
                 </div>
                 
                 <div class="scorecard-name-section" style="padding: 15px; background: #f8f9fa; border-bottom: 1px solid #ddd;">
                     <label for="scorecard-name" style="display: block; font-weight: 600; color: #495057; margin-bottom: 8px;">
                         Scorecard Name:
                     </label>
                     <input type="text" id="scorecard-name" placeholder="e.g., Front Nine, Back Nine, Championship Nine..." 
                            style="width: 100%; padding: 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 1rem; box-sizing: border-box;"
                            value="${scorecardName}">
                     ${isEditing ? `<input type="hidden" id="editing-scorecard-id" value="${scorecardId}">` : ''}
                 </div>
                
                <div class="golf-scorecard-mini">
                    <table class="scorecard-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr class="holes-row">
                                <th style="padding: 12px; background: #f8f9fa; border: 1px solid #ddd;">Hole</th>
                                <th style="padding: 12px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">1</th>
                                <th style="padding: 12px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">2</th>
                                <th style="padding: 12px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">3</th>
                                <th style="padding: 12px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">4</th>
                                <th style="padding: 12px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">5</th>
                                <th style="padding: 12px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">6</th>
                                <th style="padding: 12px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">7</th>
                                <th style="padding: 12px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">8</th>
                                <th style="padding: 12px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">9</th>
                                <th style="padding: 12px; background: #f8f9fa; border: 1px solid #ddd; text-align: center;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                                                         <tr class="par-row">
                                 <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; background: #fff3cd;">Par</td>
                                 <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">
                                     <select class="par-select" data-hole="1" onchange="updateParTotal()" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; text-align: center;">
                                         <option value="3" ${parValues['1'] == 3 ? 'selected' : ''}>3</option>
                                         <option value="4" ${parValues['1'] == 4 ? 'selected' : ''}>4</option>
                                         <option value="5" ${parValues['1'] == 5 ? 'selected' : ''}>5</option>
                                     </select>
                                 </td>
                                 <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">
                                     <select class="par-select" data-hole="2" onchange="updateParTotal()" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; text-align: center;">
                                         <option value="3" ${parValues['2'] == 3 ? 'selected' : ''}>3</option>
                                         <option value="4" ${parValues['2'] == 4 ? 'selected' : ''}>4</option>
                                         <option value="5" ${parValues['2'] == 5 ? 'selected' : ''}>5</option>
                                     </select>
                                 </td>
                                 <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">
                                     <select class="par-select" data-hole="3" onchange="updateParTotal()" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; text-align: center;">
                                         <option value="3" ${parValues['3'] == 3 ? 'selected' : ''}>3</option>
                                         <option value="4" ${parValues['3'] == 4 ? 'selected' : ''}>4</option>
                                         <option value="5" ${parValues['3'] == 5 ? 'selected' : ''}>5</option>
                                     </select>
                                 </td>
                                 <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">
                                     <select class="par-select" data-hole="4" onchange="updateParTotal()" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; text-align: center;">
                                         <option value="3" ${parValues['4'] == 3 ? 'selected' : ''}>3</option>
                                         <option value="4" ${parValues['4'] == 4 ? 'selected' : ''}>4</option>
                                         <option value="5" ${parValues['4'] == 5 ? 'selected' : ''}>5</option>
                                     </select>
                                 </td>
                                 <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">
                                     <select class="par-select" data-hole="5" onchange="updateParTotal()" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; text-align: center;">
                                         <option value="3" ${parValues['5'] == 3 ? 'selected' : ''}>3</option>
                                         <option value="4" ${parValues['5'] == 4 ? 'selected' : ''}>4</option>
                                         <option value="5" ${parValues['5'] == 5 ? 'selected' : ''}>5</option>
                                     </select>
                                 </td>
                                 <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">
                                     <select class="par-select" data-hole="6" onchange="updateParTotal()" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; text-align: center;">
                                         <option value="3" ${parValues['6'] == 3 ? 'selected' : ''}>3</option>
                                         <option value="4" ${parValues['6'] == 4 ? 'selected' : ''}>4</option>
                                         <option value="5" ${parValues['6'] == 5 ? 'selected' : ''}>5</option>
                                     </select>
                                 </td>
                                 <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">
                                     <select class="par-select" data-hole="7" onchange="updateParTotal()" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; text-align: center;">
                                         <option value="3" ${parValues['7'] == 3 ? 'selected' : ''}>3</option>
                                         <option value="4" ${parValues['7'] == 4 ? 'selected' : ''}>4</option>
                                         <option value="5" ${parValues['7'] == 5 ? 'selected' : ''}>5</option>
                                     </select>
                                 </td>
                                 <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">
                                     <select class="par-select" data-hole="8" onchange="updateParTotal()" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; text-align: center;">
                                         <option value="3" ${parValues['8'] == 3 ? 'selected' : ''}>3</option>
                                         <option value="4" ${parValues['8'] == 4 ? 'selected' : ''}>4</option>
                                         <option value="5" ${parValues['8'] == 5 ? 'selected' : ''}>5</option>
                                     </select>
                                 </td>
                                 <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">
                                     <select class="par-select" data-hole="9" onchange="updateParTotal()" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; text-align: center;">
                                         <option value="3" ${parValues['9'] == 3 ? 'selected' : ''}>3</option>
                                         <option value="4" ${parValues['9'] == 4 ? 'selected' : ''}>4</option>
                                         <option value="5" ${parValues['9'] == 5 ? 'selected' : ''}>5</option>
                                     </select>
                                 </td>
                                 <td id="par-total" style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #fff3cd;">${existingData ? existingData.total : 36}</td>
                             </tr>
                        </tbody>
                    </table>
                 </div>
                 
                 <div class="save-section" style="padding: 20px; background: #f8f9fa; border-top: 1px solid #ddd; text-align: center;">
                     <button onclick="saveScorecardConfig()" style="background: #4a5d4a; color: white; border: none; padding: 12px 30px; border-radius: 6px; font-size: 1rem; font-weight: 600; cursor: pointer; margin-right: 10px;">
                         ${saveButtonText}
                     </button>
                     <button onclick="cancelScorecardConfig()" style="background: #6c757d; color: white; border: none; padding: 12px 20px; border-radius: 6px; font-size: 1rem; cursor: pointer;">
                         Cancel
                     </button>
                 </div>
             </div>
         </div>
     `;
    
    // Add the configuration interface
    scorecardsContainer.insertAdjacentHTML('beforeend', scorecardConfigHTML);
}

// Update par total when individual par values change
function updateParTotal() {
    const parSelects = document.querySelectorAll('.par-select');
    let total = 0;
    
    parSelects.forEach(select => {
        total += parseInt(select.value);
    });
    
    const totalCell = document.getElementById('par-total');
    if (totalCell) {
        totalCell.textContent = total;
    }
}

// Save scorecard configuration to Firebase
async function saveScorecardConfig() {
    try {
        const nameInput = document.getElementById('scorecard-name');
        const editingIdInput = document.getElementById('editing-scorecard-id');
        const parSelects = document.querySelectorAll('.par-select');
        
        const scorecardName = nameInput.value.trim();
        if (!scorecardName) {
            alert('Please enter a name for the scorecard.');
            nameInput.focus();
            return;
        }
        
        // Collect par values
        const parValues = {};
        let total = 0;
        parSelects.forEach(select => {
            const hole = select.dataset.hole;
            const par = parseInt(select.value);
            parValues[hole] = par;
            total += par;
        });
        
        // Determine if we're editing or creating new
        const isEditing = editingIdInput && editingIdInput.value;
        
        if (isEditing) {
            // Update existing scorecard
            const scorecardConfig = {
                name: scorecardName,
                parValues: parValues,
                total: total,
                updatedAt: new Date(),
                updatedBy: auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email || 'unknown') : 'unknown'
            };
            
            const scorecardPath = 'clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/scorecards';
            await db.collection(scorecardPath).doc(editingIdInput.value).update(scorecardConfig);
            console.log('✅ Scorecard updated with ID:', editingIdInput.value);
            
            // Show success message
            alert(`Scorecard "${scorecardName}" updated successfully!`);
        } else {
            // Create new scorecard
            const scorecardConfig = {
                name: scorecardName,
                parValues: parValues,
                total: total,
                createdAt: new Date(),
                createdBy: auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email || 'unknown') : 'unknown'
            };
            
            const scorecardPath = 'clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/scorecards';
            const docRef = await db.collection(scorecardPath).add(scorecardConfig);
            console.log('✅ Scorecard created with ID:', docRef.id);
            
            // Show success message
            alert(`Scorecard "${scorecardName}" saved successfully!`);
        }
        
        // Return to list and reload scorecards
        cancelScorecardConfig();
        loadScorecards();
        
    } catch (error) {
        console.error('❌ Error saving scorecard:', error);
        alert('Error saving scorecard. Please try again.');
    }
}

// Cancel scorecard configuration
function cancelScorecardConfig() {
    const configContainer = document.querySelector('.scorecard-config-container');
    
    // Remove the config interface
    if (configContainer) {
        configContainer.remove();
    }
    
    // Reload scorecards list
    loadScorecards();
}

// Edit existing scorecard
async function editScorecard(scorecardId) {
    try {
        // Fetch the scorecard data from Firebase
        const scorecardPath = 'clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/scorecards';
        const scorecardDoc = await db.collection(scorecardPath).doc(scorecardId).get();
        
        if (!scorecardDoc.exists) {
            alert('Scorecard not found.');
            return;
        }
        
        const scorecardData = scorecardDoc.data();
        
        // Show the configuration form with existing data
        showScorecardForm(scorecardData, scorecardId);
        
    } catch (error) {
        console.error('❌ Error loading scorecard for editing:', error);
        alert('Error loading scorecard. Please try again.');
    }
}

function deleteScorecard(scorecardId, scorecardName) {
    if (confirm(`Are you sure you want to delete "${scorecardName}"?\n\nThis will also remove it from any weeks where it's currently assigned.`)) {
        // First delete the scorecard
        const scorecardPath = 'clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/scorecards';
        db.collection(scorecardPath).doc(scorecardId).delete()
            .then(() => {
                console.log('✅ Scorecard deleted');
                
                // Clean up any week assignments that reference this scorecard
                const weekScorecardsPath = 'clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/weekScorecards';
                return db.collection(weekScorecardsPath).where('scorecardId', '==', scorecardId).get();
            })
            .then(weekAssignments => {
                const deletePromises = [];
                weekAssignments.forEach(doc => {
                    console.log(`🧹 Cleaning up week assignment: ${doc.id}`);
                    deletePromises.push(doc.ref.delete());
                });
                return Promise.all(deletePromises);
            })
            .then(() => {
                alert('Scorecard deleted successfully!');
                loadScorecards();
            })
            .catch(error => {
                console.error('❌ Error deleting scorecard:', error);
                alert('Error deleting scorecard. Please try again.');
            });
    }
}

// Generate par row based on whether a scorecard is assigned
function generateParRow(weekNumber) {
    if (window.currentWeekScorecard && window.currentWeekScorecard.weekNumber == weekNumber) {
        // Show actual par values
        const parValues = window.currentWeekScorecard.parValues;
        const total = window.currentWeekScorecard.total;
        const scorecardName = window.currentWeekScorecard.scorecardName;
        
        return `
            <tr class="par-row" style="background: #fff3cd;" id="par-row-week-${weekNumber}">
                <td class="par-label" style="padding: 8px; border: 1px solid #ddd; font-weight: 600; text-align: left;">Par</td>
                <td class="par-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">${parValues['1']}</td>
                <td class="par-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">${parValues['2']}</td>
                <td class="par-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">${parValues['3']}</td>
                <td class="par-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">${parValues['4']}</td>
                <td class="par-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">${parValues['5']}</td>
                <td class="par-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">${parValues['6']}</td>
                <td class="par-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">${parValues['7']}</td>
                <td class="par-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">${parValues['8']}</td>
                <td class="par-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">${parValues['9']}</td>
                <td class="par-total" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">${total}</td>
            </tr>
            <tr>
                <td colspan="11" style="text-align: center; padding: 4px; font-size: 0.7rem; color: #666; border: none;">
                    Using: ${scorecardName} • <button onclick="showScorecardSelector(${weekNumber})" style="background: none; border: none; color: #4a5d4a; text-decoration: underline; cursor: pointer; font-size: 0.7rem;">Change</button>
                </td>
            </tr>
        `;
    } else {
        // Show scorecard selection button
        return `
            <tr class="par-row" style="background: #fff3cd;" id="par-row-week-${weekNumber}">
                <td class="par-label" style="padding: 8px; border: 1px solid #ddd; font-weight: 600; text-align: left;">Par</td>
                <td colspan="10" class="scorecard-selection" style="padding: 12px; border: 1px solid #ddd; text-align: center;">
                    <button onclick="showScorecardSelector(${weekNumber})" style="background: #dc3545; color: white; border: none; padding: 8px 20px; border-radius: 4px; font-size: 0.9rem; cursor: pointer;">
                        Please Select Scorecard for Week ${weekNumber}
                    </button>
                </td>
            </tr>
        `;
    }
}

// Get score type relative to par
function getScoreType(score, par) {
    const difference = score - par;
    
    if (difference <= -2) return 'eagle';      // 2+ under par
    if (difference === -1) return 'birdie';    // 1 under par
    if (difference === 0) return 'par';        // Even par
    if (difference === 1) return 'bogey';      // 1 over par
    return 'double';                           // 2+ over par
}

// Apply visual styling to score cell based on score type
function applyScoreTypeStyle(cell, score) {
    // Reset cell to default styling
    cell.style.color = 'black';
    cell.style.border = '1px solid #ddd';
    cell.style.borderRadius = '';
    cell.style.backgroundColor = '';
    
    if (score === '-') {
        cell.textContent = '-';
        return;
    }
    
    const hole = cell.dataset.hole;
    const weekNumber = cell.dataset.week;
    const player = cell.dataset.player;
    
    // Get par value for this hole
    if (!window.currentWeekScorecard || window.currentWeekScorecard.weekNumber != weekNumber) {
        cell.innerHTML = score;
        return; // No scorecard loaded, can't determine score type
    }
    
    const par = window.currentWeekScorecard.parValues[hole];
    
    // Use gross score for styling (no stroke adjustments)
    const scoreType = getScoreType(parseInt(score), parseInt(par));
    
    // Apply styling based on score type by wrapping score in a span
    switch (scoreType) {
        case 'eagle':
            // Red text with double circle around number
            cell.innerHTML = `<span style="
                color: red; 
                border: 2px solid red; 
                border-radius: 50%; 
                box-shadow: 0 0 0 2px white, 0 0 0 4px red;
                width: 24px; 
                height: 24px; 
                display: inline-flex; 
                align-items: center; 
                justify-content: center;
                line-height: 1;
            ">${score}</span>`;
            break;
            
        case 'birdie':
            // Red text with single circle around number
            cell.innerHTML = `<span style="
                color: red; 
                border: 2px solid red; 
                border-radius: 50%; 
                width: 24px; 
                height: 24px; 
                display: inline-flex; 
                align-items: center; 
                justify-content: center;
                line-height: 1;
            ">${score}</span>`;
            break;
            
        case 'par':
            // Just black text
            cell.innerHTML = `<span style="color: black;">${score}</span>`;
            break;
            
        case 'bogey':
            // Black text with square around number
            cell.innerHTML = `<span style="
                color: black; 
                border: 2px solid black; 
                border-radius: 0; 
                width: 24px; 
                height: 24px; 
                display: inline-flex; 
                align-items: center; 
                justify-content: center;
                line-height: 1;
            ">${score}</span>`;
            break;
            
        case 'double':
            // Black text with double square around number
            cell.innerHTML = `<span style="
                color: black; 
                border: 2px solid black; 
                border-radius: 0; 
                box-shadow: 0 0 0 2px white, 0 0 0 4px black;
                width: 24px; 
                height: 24px; 
                display: inline-flex; 
                align-items: center; 
                justify-content: center;
                line-height: 1;
            ">${score}</span>`;
            break;
    }
}

// Reapply styling to all existing scores when scorecard changes
function reapplyScoringStylesForWeek(weekNumber) {
    // Find all score cells for this week
    const scoreCells = document.querySelectorAll(`[data-week="${weekNumber}"].editable-score`);
    
    scoreCells.forEach(cell => {
        const score = cell.textContent.trim();
        if (score && score !== '-') {
            applyScoreTypeStyle(cell, score);
        }
    });
}

// Show scorecard selector for a specific week
async function showScorecardSelector(weekNumber) {
    try {
        // Fetch available scorecards
        const scorecardsPath = 'clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/scorecards';
        const scorecardsSnapshot = await db.collection(scorecardsPath).orderBy('name').get();
        
        if (scorecardsSnapshot.empty) {
            alert('No scorecards available. Please create a scorecard in Scorecard Setup first.');
            return;
        }
        
        // Create selection modal
        const modalHTML = `
            <div id="scorecard-selector-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; border-radius: 8px; padding: 20px; max-width: 500px; width: 90%; max-height: 80%; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                    <h3 style="margin: 0 0 20px 0; color: #2d4a2d;">Select Scorecard for Week ${weekNumber}</h3>
                    <div class="scorecard-options">
                        ${scorecardsSnapshot.docs.map(doc => {
                            const data = doc.data();
                            return `
                                <div class="scorecard-option" style="border: 1px solid #ddd; border-radius: 6px; padding: 15px; margin-bottom: 10px; background: #f8f9fa;">
                                    <h4 style="margin: 0 0 8px 0; color: #4a5d4a;">${data.name}</h4>
                                    <div style="font-size: 0.9rem; color: #666;">
                                        <span><strong>Par Total:</strong> ${data.total}</span>
                                    </div>
                                    <div style="margin-top: 8px; font-size: 0.8rem;">
                                        <table style="width: 100%; border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 2px 4px; border: 1px solid #dee2e6; text-align: center; background: #fff; font-weight: 600; font-size: 0.7rem;">Hole</td>
                                                ${Object.keys(data.parValues).sort((a, b) => parseInt(a) - parseInt(b)).map(hole => 
                                                    `<td style="padding: 2px 4px; border: 1px solid #dee2e6; text-align: center; background: #fff; font-size: 0.7rem;">${hole}</td>`
                                                ).join('')}
                                            </tr>
                                            <tr>
                                                <td style="padding: 2px 4px; border: 1px solid #dee2e6; text-align: center; background: #fff3cd; font-weight: 600; font-size: 0.7rem;">Par</td>
                                                ${Object.keys(data.parValues).sort((a, b) => parseInt(a) - parseInt(b)).map(hole => 
                                                    `<td style="padding: 2px 4px; border: 1px solid #dee2e6; text-align: center; background: #fff3cd; font-size: 0.7rem;">${data.parValues[hole]}</td>`
                                                ).join('')}
                                            </tr>
                                        </table>
                                    </div>
                                    <div style="text-align: center; margin-top: 12px;">
                                        <button onclick="selectScorecardForWeek('${doc.id}', '${data.name}', ${weekNumber})" style="background: #4a5d4a; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                                            Select Scorecard
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div style="text-align: center; margin-top: 20px;">
                        <button onclick="closeScorecardSelector()" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
    } catch (error) {
        console.error('❌ Error loading scorecards:', error);
        alert('Error loading scorecards. Please try again.');
    }
}

// Select a scorecard for a specific week
async function selectScorecardForWeek(scorecardId, scorecardName, weekNumber) {
    try {
        // Get the scorecard data - use nested structure
        const scorecardsPath = 'clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/scorecards';
        const scorecardDoc = await db.collection(scorecardsPath).doc(scorecardId).get();
        if (!scorecardDoc.exists) {
            alert('Scorecard not found.');
            return;
        }
        
        const scorecardData = scorecardDoc.data();
        
        // Save the week-scorecard association - use nested structure
        const weekScorecardPath = 'clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/weekScorecards';
        await db.collection(weekScorecardPath).doc(`week-${weekNumber}`).set({
            weekNumber: weekNumber,
            scorecardId: scorecardId,
            scorecardName: scorecardName,
            parValues: scorecardData.parValues,
            total: scorecardData.total,
            assignedAt: new Date(),
            assignedBy: auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email || 'unknown') : 'unknown'
        });
        
        // Update the global scorecard data
        window.currentWeekScorecard = {
            weekNumber: weekNumber,
            scorecardId: scorecardId,
            scorecardName: scorecardName,
            parValues: scorecardData.parValues,
            total: scorecardData.total
        };
        
        // Close modal
        closeScorecardSelector();
        
        // Reload the week scores to show updated par values
        loadAdminWeekScores();
        
        // Reapply styling to any existing scores
        setTimeout(() => {
            reapplyScoringStylesForWeek(weekNumber);
        }, 100);
        
        console.log(`✅ Scorecard "${scorecardName}" assigned to Week ${weekNumber}`);
        
    } catch (error) {
        console.error('❌ Error selecting scorecard:', error);
        alert('Error selecting scorecard. Please try again.');
    }
}



// Close scorecard selector modal
function closeScorecardSelector() {
    const modal = document.getElementById('scorecard-selector-modal');
    if (modal) {
        modal.remove();
    }
} 

// ===== PLAYER DIRECTORY FUNCTIONS =====

// Load player directory data (paid participants with contact info)
async function loadPlayerDirectory() {
    try {
        console.log("Loading player directory...");
        
        // Load participants from nested structure
        const participantsSnapshot = await db.collection("clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/participants")
            .orderBy("name", "asc")
            .get();
        
        playerDirectoryData = [];
        participantsSnapshot.forEach((doc) => {
            const data = doc.data();
            // Only include participants with "paid" status
            if (data.status === "paid" || data.status === "active") {
                playerDirectoryData.push({ 
                    id: doc.id, 
                    ...data,
                    joinedDate: data.joinedAt ? new Date(data.joinedAt.toDate ? data.joinedAt.toDate() : data.joinedAt) : null
                });
            }
        });
        
        console.log(`Loaded ${playerDirectoryData.length} paid participants for directory`);
        renderPlayerDirectory();
        
    } catch (error) {
        console.error("Error loading player directory:", error);
    }
}

// Render the player directory
function renderPlayerDirectory() {
    const container = document.getElementById("player-directory-content");
    if (!container) return;
    
    if (playerDirectoryData.length === 0) {
        container.innerHTML = `
            <p style="text-align: center; color: #666; margin: 40px 0;">
                No paid participants found.
            </p>
        `;
        return;
    }
    
    // Add filter controls
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2]; // Show current and previous 2 years
    
    container.innerHTML = `
        <div style="margin-bottom: 20px; padding: 15px; background: #f8f9f8; border-radius: 5px;">
            <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                <label style="font-weight: 600; color: #1e3a1e;">Filter by Season:</label>
                <select id="year-filter" onchange="filterPlayerDirectory()" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; background: white;">
                    <option value="all">All Years</option>
                    ${years.map(year => `<option value="${year}" ${year === currentYear ? "selected" : ""}>${year}</option>`).join("")}
                </select>
                <div style="margin-left: auto; color: #666; font-size: 0.9rem;">
                    Total: <span id="player-count">${playerDirectoryData.length}</span> players
                </div>
            </div>
        </div>
        
        <div id="filtered-players">
            ${renderPlayerCards(playerDirectoryData)}
        </div>
    `;
}

// Render player cards
function renderPlayerCards(players) {
    if (players.length === 0) {
        return `
            <p style="text-align: center; color: #666; margin: 40px 0;">
                No players found for the selected criteria.
            </p>
        `;
    }
    
    return `
        <div style="display: flex; flex-direction: column; gap: 8px;">
            ${players.map(player => {
                // Generate years participated tags (for now just show current year)
                const currentYear = new Date().getFullYear();
                const yearsParticipated = [currentYear]; // TODO: Add logic for multiple years when we have historical data
                
                return `
                <div style="background: white; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <!-- Mobile layout -->
                    <div class="mobile-layout" style="display: block;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                            <button onclick="showPlayerDetails('${player.id}')" style="background: none; border: none; text-align: left; cursor: pointer; padding: 0; color: inherit; flex: 1; min-width: 0;">
                                <h4 style="margin: 0; color: #1e3a1e; font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; text-decoration: underline; text-decoration-color: transparent; transition: text-decoration-color 0.2s;">
                                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${player.name}</span>
                                    ${(player.teamCaptain && player.teamId) ? '<span style="background: #2d4a2d; color: white; padding: 2px 6px; font-size: 0.65rem; border-radius: 3px; font-weight: 500; white-space: nowrap;">CAPTAIN</span>' : ""}
                                </h4>
                            </button>
                            <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
                                ${yearsParticipated.map(year => 
                                    `<span style="background: #4a5d4a; color: white; padding: 2px 6px; font-size: 0.7rem; border-radius: 10px; font-weight: 500;">${year}</span>`
                                ).join("")}
                                ${player.teamId ? `<span style="background: #e8f5e8; color: #2d4a2d; padding: 2px 6px; font-size: 0.7rem; border-radius: 3px; font-weight: 500;">T${player.teamId}</span>` : ""}
                            </div>
                        </div>
                        
                        <!-- Contact icons row -->
                        <div style="display: flex; align-items: center; justify-content: center; gap: 15px;">
                            <!-- Phone call icon -->
                            ${player.phone ? `
                                <a href="tel:${player.phone}" style="display: flex; align-items: center; justify-content: center; width: 50px; height: 50px; background: #4CAF50; border-radius: 50%; text-decoration: none; transition: transform 0.2s;" 
                                   title="Call ${player.name}">
                                    <span style="color: white; font-size: 1.4rem;">📞</span>
                                </a>
                            ` : `
                                <div style="display: flex; align-items: center; justify-content: center; width: 50px; height: 50px; background: #ddd; border-radius: 50%; opacity: 0.5;" title="No phone number">
                                    <span style="color: #999; font-size: 1.4rem;">📞</span>
                                </div>
                            `}
                            
                            <!-- Text message icon -->
                            ${player.phone ? `
                                <a href="sms:${player.phone}" style="display: flex; align-items: center; justify-content: center; width: 50px; height: 50px; background: #2196F3; border-radius: 50%; text-decoration: none; transition: transform 0.2s;" 
                                   title="Text ${player.name}">
                                    <span style="color: white; font-size: 1.4rem;">💬</span>
                                </a>
                            ` : `
                                <div style="display: flex; align-items: center; justify-content: center; width: 50px; height: 50px; background: #ddd; border-radius: 50%; opacity: 0.5;" title="No phone number">
                                    <span style="color: #999; font-size: 1.4rem;">💬</span>
                                </div>
                            `}
                            
                            <!-- Email icon -->
                            <a href="mailto:${player.email}" style="display: flex; align-items: center; justify-content: center; width: 50px; height: 50px; background: #FF9800; border-radius: 50%; text-decoration: none; transition: transform 0.2s;" 
                               title="Email ${player.name}">
                                <span style="color: white; font-size: 1.4rem;">📧</span>
                            </a>
                        </div>
                    </div>
                    
                    <!-- Desktop layout (hidden on mobile, shown on larger screens) -->
                    <div class="desktop-layout" style="display: none; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
                            <button onclick="showPlayerDetails('${player.id}')" style="background: none; border: none; text-align: left; cursor: pointer; padding: 0; color: inherit;">
                                <h4 style="margin: 0; color: #1e3a1e; font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 8px; text-decoration: underline; text-decoration-color: transparent; transition: text-decoration-color 0.2s;">
                                    ${player.name}
                                    ${(player.teamCaptain && player.teamId) ? '<span style="background: #2d4a2d; color: white; padding: 2px 6px; font-size: 0.7rem; border-radius: 3px; font-weight: 500;">CAPTAIN</span>' : ""}
                                </h4>
                            </button>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 12px;">
                            ${player.phone ? `
                                <a href="tel:${player.phone}" style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: #4CAF50; border-radius: 50%; text-decoration: none; transition: transform 0.2s;" 
                                   title="Call ${player.name}">
                                    <span style="color: white; font-size: 1.2rem;">📞</span>
                                </a>
                            ` : `
                                <div style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: #ddd; border-radius: 50%; opacity: 0.5;" title="No phone number">
                                    <span style="color: #999; font-size: 1.2rem;">📞</span>
                                </div>
                            `}
                            
                            ${player.phone ? `
                                <a href="sms:${player.phone}" style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: #2196F3; border-radius: 50%; text-decoration: none; transition: transform 0.2s;" 
                                   title="Text ${player.name}">
                                    <span style="color: white; font-size: 1.2rem;">💬</span>
                                </a>
                            ` : `
                                <div style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: #ddd; border-radius: 50%; opacity: 0.5;" title="No phone number">
                                    <span style="color: #999; font-size: 1.2rem;">💬</span>
                                </div>
                            `}
                            
                            <a href="mailto:${player.email}" style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: #FF9800; border-radius: 50%; text-decoration: none; transition: transform 0.2s;" 
                               title="Email ${player.name}">
                                <span style="color: white; font-size: 1.2rem;">📧</span>
                            </a>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 8px; margin-left: 15px;">
                            ${yearsParticipated.map(year => 
                                `<span style="background: #4a5d4a; color: white; padding: 3px 8px; font-size: 0.75rem; border-radius: 12px; font-weight: 500;">${year}</span>`
                            ).join("")}
                            ${player.teamId ? `<span style="background: #e8f5e8; color: #2d4a2d; padding: 4px 8px; font-size: 0.8rem; border-radius: 4px; font-weight: 500;">Team ${player.teamId}</span>` : ""}
                        </div>
                    </div>
                    
                    <style>
                        @media (min-width: 768px) {
                            .mobile-layout {
                                display: none !important;
                            }
                            .desktop-layout {
                                display: flex !important;
                            }
                        }
                        @media (max-width: 767px) {
                            .desktop-layout {
                                display: none !important;
                            }
                            .mobile-layout {
                                display: block !important;
                            }
                        }
                    </style>
                </div>
            `;
            }).join("")}
        </div>
    `;
}

// Filter player directory by year
function filterPlayerDirectory() {
    const yearFilter = document.getElementById("year-filter");
    const selectedYear = yearFilter.value;
    
    let filteredPlayers = [...playerDirectoryData];
    
    if (selectedYear !== "all") {
        filteredPlayers = playerDirectoryData.filter(player => {
            if (!player.joinedDate) return false;
            return player.joinedDate.getFullYear().toString() === selectedYear;
        });
    }
    
    // Update player count
    document.getElementById("player-count").textContent = filteredPlayers.length;
    
    // Re-render filtered players
    document.getElementById("filtered-players").innerHTML = renderPlayerCards(filteredPlayers);
}

// Show player details modal
function showPlayerDetails(playerId) {
    const player = playerDirectoryData.find(p => p.id === playerId);
    if (!player) return;
    
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 30px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        position: relative;
    `;
    
    modalContent.innerHTML = `
        <button onclick="this.closest('.modal-overlay').remove()" style="
            position: absolute;
            top: 15px;
            right: 15px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        ">&times;</button>
        
        <div style="margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; color: #1e3a1e; display: flex; align-items: center; gap: 10px;">
                ${player.name}
                ${(player.teamCaptain && player.teamId) ? '<span style="background: #2d4a2d; color: white; padding: 4px 8px; font-size: 0.8rem; border-radius: 4px; font-weight: 500;">CAPTAIN</span>' : ""}
            </h3>
            ${player.teamId ? `<p style="margin: 0; color: #666; font-size: 0.9rem;">Team ${player.teamId}</p>` : ""}
        </div>
        
        <div style="margin-bottom: 20px;">
            <div style="margin-bottom: 12px;">
                <strong style="color: #1e3a1e;">Email:</strong><br>
                <a href="mailto:${player.email}" style="color: #2563eb; text-decoration: none;">${player.email}</a>
            </div>
            
            ${player.phone ? `
                <div style="margin-bottom: 12px;">
                    <strong style="color: #1e3a1e;">Phone:</strong><br>
                    <a href="tel:${player.phone}" style="color: #2563eb; text-decoration: none;">${player.phone}</a>
                </div>
            ` : `
                <div style="margin-bottom: 12px;">
                    <strong style="color: #1e3a1e;">Phone:</strong><br>
                    <span style="color: #999;">Not provided</span>
                </div>
            `}
            
            <div style="margin-bottom: 12px;">
                <strong style="color: #1e3a1e;">Status:</strong><br>
                <span style="color: ${player.status === 'paid' ? '#059669' : '#666'};">
                    ${player.status === 'paid' ? 'Fee Paid' : 'Active Member'}
                </span>
            </div>
            
            ${player.joinedDate ? `
                <div>
                    <strong style="color: #1e3a1e;">Joined:</strong><br>
                    <span style="color: #666;">${player.joinedDate.toLocaleDateString()}</span>
                </div>
            ` : ''}
        </div>
        
        <div style="display: flex; gap: 10px; justify-content: center;">
            ${player.phone ? `
                <a href="tel:${player.phone}" style="display: flex; align-items: center; justify-content: center; padding: 10px 15px; background: #4CAF50; color: white; text-decoration: none; border-radius: 6px; font-size: 0.9rem; gap: 8px;">
                    📞 Call
                </a>
                <a href="sms:${player.phone}" style="display: flex; align-items: center; justify-content: center; padding: 10px 15px; background: #2196F3; color: white; text-decoration: none; border-radius: 6px; font-size: 0.9rem; gap: 8px;">
                    💬 Text
                </a>
            ` : ''}
            <a href="mailto:${player.email}" style="display: flex; align-items: center; justify-content: center; padding: 10px 15px; background: #FF9800; color: white; text-decoration: none; border-radius: 6px; font-size: 0.9rem; gap: 8px;">
                📧 Email
            </a>
        </div>
    `;
    
    modalOverlay.className = 'modal-overlay';
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    // Close modal when clicking overlay
    modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    });
}

// ===== SET LINEUPS FUNCTIONALITY =====

// Initialize Set Lineups functionality when page loads
window.initializeSetLineups = function() {
    console.log('INIT SET LINEUPS: Initializing...');
    
    // Add event listener to week selector dropdown
    const weekSelect = document.getElementById('lineup-week-select');
    if (weekSelect) {
        weekSelect.addEventListener('change', loadWeekLineups);
        console.log('INIT SET LINEUPS: Event listener added to week selector');
    } else {
        console.warn('INIT SET LINEUPS: Week selector not found');
    }
};

// Load and display week lineups when week is selected
window.loadWeekLineups = async function() {
    console.log('LOAD WEEK LINEUPS: Function called');
    const weekSelect = document.getElementById('lineup-week-select');
    const selectedWeek = weekSelect.value;
    const contentContainer = document.getElementById('lineups-content');
    
    if (!selectedWeek) {
        contentContainer.innerHTML = `
            <p style="text-align: center; color: #999; padding: 40px; font-style: italic;">
                Select a week above to view and manage lineups
            </p>
        `;
        return;
    }
    

    
    try {
        // Show loading state with progress indicator
        contentContainer.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="display: inline-block; margin-bottom: 15px;">
                    <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #2d4a2d; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                </div>
                <p style="color: #666; font-size: 1.1rem; margin: 0;">Loading week ${selectedWeek} teams and matchups...</p>
                <p style="color: #999; font-size: 0.9rem; margin: 5px 0 0 0;">Please wait while we fetch team rosters...</p>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        
        // Load team names and rosters from database first
        await Promise.all([
            loadLineupsTeamNames(),
            loadLineupsTeamRosters()
        ]);
        
        // Get the week's schedule data (now with actual team names)
        const weekData = getWeekScheduleData(selectedWeek);
        
        // Render the week's matchups and lineup interface
        await renderWeekLineupsInterface(selectedWeek, weekData);
        
    } catch (error) {
        console.error('❌ SET LINEUPS: Error loading week lineups:', error);
        contentContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #dc3545;">
                <p style="font-size: 1.1rem; margin-bottom: 15px;">Error loading week ${selectedWeek} lineups.</p>
                <button onclick="loadWeekLineups()" style="background: #4a5d4a; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    Retry
                </button>
            </div>
        `;
    }
}

// Load team data for lineups functionality
let lineupsTeamNames = {};
let lineupsTeamRosters = {};
async function loadLineupsTeamNames() {
    try {

        const teamsSnapshot = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/teams')
            .orderBy('teamId', 'asc')
            .get();
        
        lineupsTeamNames = {};
        teamsSnapshot.forEach(doc => {
            const team = doc.data();
            if (team.teamId && team.teamName) {
                // Map from "Team X" format to actual team name
                lineupsTeamNames[`Team ${team.teamId}`] = team.teamName;

            }
        });
        

        
    } catch (error) {
        console.error('❌ SET LINEUPS: Error loading team names:', error);
        // Fallback to generic names
        lineupsTeamNames = {
            'Team 1': 'Team 1',
            'Team 2': 'Team 2', 
            'Team 3': 'Team 3',
            'Team 4': 'Team 4',
            'Team 5': 'Team 5',
            'Team 6': 'Team 6'
        };
    }
}

async function loadLineupsTeamRosters() {
    try {
        console.log('🎯 SET LINEUPS: Loading team rosters from database...');
        const teamsSnapshot = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/teams')
            .orderBy('teamId', 'asc')
            .get();
        
        lineupsTeamRosters = {};
        
        // Load each team's roster by fetching participant details
        for (const teamDoc of teamsSnapshot.docs) {
            const team = teamDoc.data();
            if (team.teamId && team.players) {
                console.log(`🎯 SET LINEUPS: Loading Team ${team.teamId} players:`, team.players);
                
                const roster = [];
                
                // Get participant details for each player ID
                for (const playerId of team.players) {
                    if (playerId) {
                        try {
                            const playerDoc = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/participants').doc(playerId).get();
                            if (playerDoc.exists) {
                                const playerData = playerDoc.data();
                                roster.push({
                                    playerId: playerId,
                                    name: playerData.name || `Player ${playerId}`,
                                    email: playerData.email || null
                                });
                                console.log(`🎯 SET LINEUPS: Added player:`, playerData.name);
                            }
                        } catch (err) {
                            console.log(`❌ Could not find participant ${playerId}:`, err);
                        }
                    }
                }
                
                // Also add captain if not already in players array
                if (team.captain && !team.players.includes(team.captain)) {
                    try {
                        const captainDoc = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/participants').doc(team.captain).get();
                        if (captainDoc.exists) {
                            const captainData = captainDoc.data();
                            roster.push({
                                playerId: team.captain,
                                name: captainData.name || `Captain ${team.captain}`,
                                email: captainData.email || null
                            });
                            console.log(`🎯 SET LINEUPS: Added captain:`, captainData.name);
                        }
                    } catch (err) {
                        console.log(`❌ Could not find captain ${team.captain}:`, err);
                    }
                }
                
                lineupsTeamRosters[`Team ${team.teamId}`] = roster;
                console.log(`🎯 SET LINEUPS: Team ${team.teamId} roster loaded:`, roster.length, 'players');
            }
        }
        
        console.log('🎯 SET LINEUPS: Team rosters loaded for', Object.keys(lineupsTeamRosters).length, 'teams');
    } catch (error) {
        console.error('❌ SET LINEUPS: Error loading team rosters:', error);
        lineupsTeamRosters = {};
    }
}

// Helper function to generate player options for a team
function getPlayerOptionsForTeam(teamKey, excludePlayerIds = []) {
    const roster = lineupsTeamRosters[teamKey] || [];
    let options = '<option value="">Select Player...</option>';
    
    roster.forEach(player => {
        if (player && player.name && !excludePlayerIds.includes(player.playerId)) {
            options += `<option value="${player.playerId}">${player.name}</option>`;
        }
    });
    
    return options;
}

// Helper function to create player selection UI (dropdown or selected player with remove button)
function createPlayerSelectionUI(teamKey, position, matchIndex, teamIndex) {
    const uniqueId = `player-${matchIndex}-${teamIndex}-${position}`;
    
    return `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <select id="select-${uniqueId}" data-team-key="${teamKey}" onchange="handlePlayerSelection(this, '${uniqueId}')" 
                    style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                ${getPlayerOptionsForTeam(teamKey)}
            </select>
            <span id="remove-container-${uniqueId}" style="width: 60px;">
                <!-- Remove button will be inserted here when player is selected -->
            </span>
        </div>
    `;
}

// Get all selected player IDs from the lineups interface
function getSelectedPlayerIds() {
    const selectedIds = [];
    
    // Check all dropdowns for selected values
    const selects = document.querySelectorAll('#lineups-content select[data-team-key]');
    
    selects.forEach(select => {
        if (select.value && select.value !== '') {
            selectedIds.push(select.value);
        }
    });
    
    return selectedIds;
}

// Handle player selection change in dropdowns
window.handlePlayerSelection = function(selectElement, uniqueId) {
    const removeContainer = document.getElementById(`remove-container-${uniqueId}`);
    
    if (selectElement.value && selectElement.value !== '') {
        // Player selected - show remove button
        removeContainer.innerHTML = `
            <button onclick="removePlayer('${uniqueId}')" 
                    style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 0.75rem; cursor: pointer;">
                Remove
            </button>
        `;
    } else {
        // No player selected - hide remove button
        removeContainer.innerHTML = '';
    }
    
    // Refresh all dropdowns to update available players
    refreshAllPlayerDropdowns();
};

// Remove a selected player and hide remove button
window.removePlayer = function(uniqueId) {
    const selectElement = document.getElementById(`select-${uniqueId}`);
    const removeContainer = document.getElementById(`remove-container-${uniqueId}`);
    
    // Reset the dropdown and hide remove button
    selectElement.value = '';
    removeContainer.innerHTML = '';
    
    // Refresh all dropdowns to update available players
    refreshAllPlayerDropdowns();
};

// Refresh all player dropdowns to exclude selected players
function refreshAllPlayerDropdowns() {
    const selectedPlayerIds = getSelectedPlayerIds();
    const allSelects = document.querySelectorAll('#lineups-content select[data-team-key]');
    
    allSelects.forEach(select => {
        const teamKey = select.dataset.teamKey;
        const currentValue = select.value;
        
        if (teamKey) {
            // Exclude all selected players except the current selection in this dropdown
            const excludeIds = selectedPlayerIds.filter(id => id !== currentValue);
            
            // Update the dropdown options
            select.innerHTML = getPlayerOptionsForTeam(teamKey, excludeIds);
            
            // Restore the current selection (if it's still valid)
            if (currentValue && currentValue !== '') {
                select.value = currentValue;
            }
        }
    });
}

// Get schedule data for a specific week
function getWeekScheduleData(week) {
    const scheduleData = {
        '1': {
            date: 'August 19',
            format: 'Four-Ball (Best Ball)',
            matches: [
                { team1: 'Whack Shack', team2: 'Cream Team' },
                { team1: 'Bump & Run', team2: 'So Sushi Samurai' },
                { team1: 'Avery', team2: 'Be The Ball' }
            ]
        },
        '2': {
            date: 'August 26',
            format: 'Alternate Shot',
            matches: [
                { team1: 'Whack Shack', team2: 'Bump & Run' },
                { team1: 'Cream Team', team2: 'Avery' },
                { team1: 'So Sushi Samurai', team2: 'Be The Ball' }
            ]
        },
        '3': {
            date: 'September 2',
            format: 'Scramble',
            matches: [
                { team1: 'Whack Shack', team2: 'So Sushi Samurai' },
                { team1: 'Cream Team', team2: 'Be The Ball' },
                { team1: 'Bump & Run', team2: 'Avery' }
            ]
        },
        '4': {
            date: 'September 9',
            format: 'High-Low',
            matches: [
                { team1: 'Whack Shack', team2: 'Avery' },
                { team1: 'Cream Team', team2: 'Bump & Run' },
                { team1: 'So Sushi Samurai', team2: 'Be The Ball' }
            ]
        },
        '5': {
            date: 'September 23',
            format: 'Modified Stableford',
            matches: [
                { team1: 'Whack Shack', team2: 'Be The Ball' },
                { team1: 'Cream Team', team2: 'So Sushi Samurai' },
                { team1: 'Bump & Run', team2: 'Avery' }
            ]
        }
    };
    
    return scheduleData[week] || null;
}

// Render the lineups interface for a specific week
async function renderWeekLineupsInterface(week, weekData) {
    const contentContainer = document.getElementById('lineups-content');
    
    if (!weekData) {
        contentContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #dc3545;">
                <p>No schedule data found for Week ${week}</p>
            </div>
        `;
        return;
    }
    
    console.log(`🎯 SET LINEUPS: Rendering interface for Week ${week}`, weekData);
    
    // Build the interface HTML
    let interfaceHTML = `
        <div class="week-lineups-container">
            <div class="week-header" style="text-align: center; margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                <h4 style="color: #2d4a2d; margin: 0 0 10px 0;">Week ${week} - ${weekData.date}</h4>
                <p style="color: #666; margin: 0; font-size: 1.1rem;">${weekData.format}</p>
            </div>
            
            <div class="matchups-grid" style="display: grid; gap: 30px;">
    `;
    
    // Add each matchup
    weekData.matches.forEach((match, index) => {
        // Get actual team names
        const actualTeam1Name = lineupsTeamNames[match.team1] || match.team1;
        const actualTeam2Name = lineupsTeamNames[match.team2] || match.team2;
        
        interfaceHTML += `
            <div class="matchup-card" style="border: 1px solid #ddd; border-radius: 8px; padding: 20px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px;">
                <div class="matchup-header" style="text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #f0f0f0;">
                    <h5 style="color: #2d4a2d; margin: 0; font-size: 1.2rem;">${actualTeam1Name} vs ${actualTeam2Name}</h5>
                </div>
                
                <!-- Match 1 -->
                <div class="match-section" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px;">
                    <h6 style="color: #2d4a2d; margin: 0 0 12px 0; text-align: center; font-size: 1rem;">Match 1</h6>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <!-- Team 1 Match 1 -->
                        <div style="text-align: center;">
                            <p style="margin: 0 0 8px 0; font-weight: 600; color: #2d4a2d;">${actualTeam1Name}</p>
                            ${createPlayerSelectionUI(match.team1, 1, index, 1)}
                            ${createPlayerSelectionUI(match.team1, 2, index, 1)}
                        </div>
                        <!-- Team 2 Match 1 -->
                        <div style="text-align: center;">
                            <p style="margin: 0 0 8px 0; font-weight: 600; color: #2d4a2d;">${actualTeam2Name}</p>
                            ${createPlayerSelectionUI(match.team2, 1, index, 2)}
                            ${createPlayerSelectionUI(match.team2, 2, index, 2)}
                        </div>
                    </div>
                </div>
                
                <!-- Match 2 -->
                <div class="match-section" style="padding: 15px; background: #f8f9fa; border-radius: 6px;">
                    <h6 style="color: #2d4a2d; margin: 0 0 12px 0; text-align: center; font-size: 1rem;">Match 2</h6>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <!-- Team 1 Match 2 -->
                        <div style="text-align: center;">
                            <p style="margin: 0 0 8px 0; font-weight: 600; color: #2d4a2d;">${actualTeam1Name}</p>
                            ${createPlayerSelectionUI(match.team1, 3, index, 1)}
                            ${createPlayerSelectionUI(match.team1, 4, index, 1)}
                        </div>
                        <!-- Team 2 Match 2 -->
                        <div style="text-align: center;">
                            <p style="margin: 0 0 8px 0; font-weight: 600; color: #2d4a2d;">${actualTeam2Name}</p>
                            ${createPlayerSelectionUI(match.team2, 3, index, 2)}
                            ${createPlayerSelectionUI(match.team2, 4, index, 2)}
                        </div>
                    </div>
                </div>
                
                <!-- Save Button for this matchup -->
                <div style="text-align: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                    <button onclick="saveMatchupLineup(${index}, '${match.team1}', '${match.team2}')" 
                            style="background: #2d4a2d; color: white; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-weight: 600;">
                        Save This Matchup
                    </button>
                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">
                        Saves lineup for this matchup and updates scorecards
                    </p>
                </div>
            </div>
        `;
    });
    
    interfaceHTML += `
            </div>
        </div>
    `;
    
    // Set the interface HTML (no week-level save button - individual saves only)
    contentContainer.innerHTML = interfaceHTML;
    
    // Small delay to ensure DOM is fully rendered before restoring state
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Load and display any existing lineups for this week
    await loadExistingLineups(week);
};

// Load and display existing lineups for the week
async function loadExistingLineups(week) {
    try {
        // Load lineup data from weeklyLineups collection
        const lineupDoc = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/weeklyLineups')
            .doc(`week-${week}`).get();
        
        if (!lineupDoc.exists) {
            return;
        }
        
        const lineupData = lineupDoc.data();
        
        // Process each matchup in the data
        for (let matchIndex = 0; matchIndex < 3; matchIndex++) { // 3 matchups per week
            const matchupField = `matchup${matchIndex}`;
            const matchupLineup = lineupData[matchupField];
            
            if (matchupLineup) {
                await restoreMatchupLineup(matchIndex, matchupLineup);
            }
        }
        
        // Refresh dropdowns to exclude selected players
        await refreshDropdownsAfterLoad();
        
    } catch (error) {
        console.error('❌ LOAD EXISTING: Error loading existing lineups:', error);
        // Don't throw error - just log it, so interface still works
    }
}

// Restore a specific matchup's lineup to the UI
async function restoreMatchupLineup(matchIndex, matchupLineup) {
    try {
        console.log(`🎯 RESTORE MATCHUP: Restoring matchup ${matchIndex}:`, matchupLineup);
        
        // Match 1 players
        const team1Match1Players = matchupLineup.match1?.team1Players || [];
        const team2Match1Players = matchupLineup.match1?.team2Players || [];
        
        // Match 2 players
        const team1Match2Players = matchupLineup.match2?.team1Players || [];
        const team2Match2Players = matchupLineup.match2?.team2Players || [];
        
        // Restore Match 1 players
        if (team1Match1Players[0]) await setPlayerInUI(`player-${matchIndex}-1-1`, team1Match1Players[0]);
        if (team1Match1Players[1]) await setPlayerInUI(`player-${matchIndex}-1-2`, team1Match1Players[1]);
        if (team2Match1Players[0]) await setPlayerInUI(`player-${matchIndex}-2-1`, team2Match1Players[0]);
        if (team2Match1Players[1]) await setPlayerInUI(`player-${matchIndex}-2-2`, team2Match1Players[1]);
        
        // Restore Match 2 players
        if (team1Match2Players[0]) await setPlayerInUI(`player-${matchIndex}-1-3`, team1Match2Players[0]);
        if (team1Match2Players[1]) await setPlayerInUI(`player-${matchIndex}-1-4`, team1Match2Players[1]);
        if (team2Match2Players[0]) await setPlayerInUI(`player-${matchIndex}-2-3`, team2Match2Players[0]);
        if (team2Match2Players[1]) await setPlayerInUI(`player-${matchIndex}-2-4`, team2Match2Players[1]);
        
        console.log(`✅ RESTORE MATCHUP: Successfully restored matchup ${matchIndex}`);
        
    } catch (error) {
        console.error(`❌ RESTORE MATCHUP: Error restoring matchup ${matchIndex}:`, error);
    }
}

// Set a player in the UI (set dropdown value and show remove button)
async function setPlayerInUI(uniqueId, playerData) {
    try {
        const selectElement = document.getElementById(`select-${uniqueId}`);
        const removeContainer = document.getElementById(`remove-container-${uniqueId}`);
        
        if (!selectElement || !removeContainer) {
            console.warn(`SET PLAYER UI: UI elements not found for ${uniqueId}`);
            return;
        }
        
        // Set the dropdown value
        selectElement.value = playerData.playerId;
        
        // Show the remove button
        removeContainer.innerHTML = `
            <button onclick="removePlayer('${uniqueId}')" 
                    style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 0.75rem; cursor: pointer;">
                Remove
            </button>
        `;
        
        console.log(`SET PLAYER UI: Set ${uniqueId} to ${playerData.name}`);
        
    } catch (error) {
        console.error(`SET PLAYER UI: Error setting player for ${uniqueId}:`, error);
    }
}

// Refresh dropdowns after loading existing lineups
async function refreshDropdownsAfterLoad() {
    try {

        
        // Small delay to ensure UI is fully rendered
        setTimeout(() => {
            refreshAllPlayerDropdowns();
        }, 100);
        
    } catch (error) {
        console.error('❌ REFRESH AFTER LOAD: Error refreshing dropdowns:', error);
    }
}

// ===== REPLACE PLAYER FUNCTIONALITY =====

// Show the replace player form and populate the dropdown
window.showReplacePlayerForm = function() {
    const form = document.getElementById('replace-player-form');
    const playerDropdown = document.getElementById('player-to-replace');
    
    // Show the form
    form.style.display = 'block';
    
    // Populate dropdown with all current participants
    const assignedPlayerIds = new Set();
    currentTeams.forEach(team => {
        team.players.forEach(playerId => assignedPlayerIds.add(playerId));
        if (team.captain) assignedPlayerIds.add(team.captain);
    });
    
    const assignedPlayers = allPlayers.filter(player => assignedPlayerIds.has(player.id));
    
    playerDropdown.innerHTML = '<option value="">Select player to replace...</option>' +
        assignedPlayers.map(player => {
            const teamName = getPlayerTeamName(player.id);
            return `<option value="${player.id}">${player.name} (${teamName})</option>`;
        }).join('');
};

// Hide the replace player form and clear inputs
window.hideReplacePlayerForm = function() {
    const form = document.getElementById('replace-player-form');
    form.style.display = 'none';
    
    // Clear all inputs
    document.getElementById('player-to-replace').value = '';
    document.getElementById('new-player-name').value = '';
    document.getElementById('new-player-phone').value = '';
    document.getElementById('new-player-email').value = '';
};

// Get the team name for a given player ID
function getPlayerTeamName(playerId) {
    for (const team of currentTeams) {
        if (team.players.includes(playerId) || team.captain === playerId) {
            return team.teamName;
        }
    }
    return 'No Team';
}

// Execute the player replacement
window.executePlayerReplacement = async function() {
    try {
        const oldPlayerId = document.getElementById('player-to-replace').value;
        const newPlayerName = document.getElementById('new-player-name').value.trim();
        const newPlayerPhone = document.getElementById('new-player-phone').value.trim();
        const newPlayerEmail = document.getElementById('new-player-email').value.trim();
        
        // Validation
        if (!oldPlayerId) {
            alert('Please select a player to replace');
            return;
        }
        
        if (!newPlayerName || !newPlayerPhone || !newPlayerEmail) {
            alert('Please fill in all fields for the new player');
            return;
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newPlayerEmail)) {
            alert('Please enter a valid email address');
            return;
        }
        
        // Confirm replacement
        const oldPlayer = allPlayers.find(p => p.id === oldPlayerId);
        const teamName = getPlayerTeamName(oldPlayerId);
        
        if (!confirm(`Are you sure you want to replace ${oldPlayer.name} from ${teamName} with ${newPlayerName}?\n\nThis will:\n- Remove ${oldPlayer.name} from their team\n- Add ${newPlayerName} to unassigned players\n- You can then assign ${newPlayerName} to any team`)) {
            return;
        }
        
        // Show progress
        const replaceButton = document.querySelector('#replace-player-form button[onclick="executePlayerReplacement()"]');
        const originalText = replaceButton.textContent;
        replaceButton.textContent = 'Replacing...';
        replaceButton.disabled = true;
        
        // Execute replacement
        await performPlayerReplacement(oldPlayerId, {
            name: newPlayerName,
            phone: newPlayerPhone,
            email: newPlayerEmail
        });
        
        // Success feedback
        alert(`Successfully replaced ${oldPlayer.name} with ${newPlayerName}!\n\n${newPlayerName} is now in the unassigned players section.`);
        
        // Hide form and refresh teams and player directory
        hideReplacePlayerForm();
        await loadPlayersAndTeams();
        await loadPlayerDirectory(); // Refresh Player Directory to show new player
        renderTeamsManagement();
        
    } catch (error) {
        console.error('Error replacing player:', error);
        alert('Error replacing player. Please try again.');
    } finally {
        // Reset button
        const replaceButton = document.querySelector('#replace-player-form button[onclick="executePlayerReplacement()"]');
        if (replaceButton) {
            replaceButton.textContent = 'Replace Player';
            replaceButton.disabled = false;
        }
    }
};

// Perform the actual player replacement in the database
async function performPlayerReplacement(oldPlayerId, newPlayerData) {
    try {
        // 1. Find the old player and their team
        const oldPlayer = allPlayers.find(p => p.id === oldPlayerId);
        if (!oldPlayer) {
            throw new Error('Old player not found');
        }
        
        // 2. Create new player in participants collection  
        const newPlayerDoc = {
            name: formatName(newPlayerData.name),
            email: newPlayerData.email.toLowerCase(),
            phone: newPlayerData.phone,
            status: 'paid', // Set to paid so they appear in Player Directory
            createdAt: new Date().toISOString(),
            joinedAt: new Date(), // Add joinedAt for Player Directory
            paymentReceived: true, // Mark as paid since they're replacing a paid player
            notes: `Replacement for ${oldPlayer.name}`,
            replacementFor: oldPlayer.id
        };
        
        const newParticipantRef = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/participants').add(newPlayerDoc);
        const newPlayerId = newParticipantRef.id;
        
        console.log(`Created new player: ${newPlayerData.name} with ID: ${newPlayerId}`);
        
        // 3. Remove old player from their team
        let teamToUpdate = null;
        let isOldPlayerCaptain = false;
        
        for (const team of currentTeams) {
            if (team.captain === oldPlayerId) {
                // Old player is captain
                isOldPlayerCaptain = true;
                team.captain = null;
                teamToUpdate = team;
                break;
            } else if (team.players.includes(oldPlayerId)) {
                // Old player is regular player
                team.players = team.players.filter(id => id !== oldPlayerId);
                teamToUpdate = team;
                break;
            }
        }
        
        if (teamToUpdate) {
            // Update team in database
            await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/teams')
                .doc(teamToUpdate.id)
                .update({
                    captain: teamToUpdate.captain,
                    players: teamToUpdate.players,
                    lastUpdated: new Date().toISOString()
                });
            
            console.log(`Removed ${oldPlayer.name} from ${teamToUpdate.teamName}`);
        }
        
        // 4. Remove old player from participants collection
        await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/participants')
            .doc(oldPlayerId)
            .delete();
        
        console.log(`Deleted old player: ${oldPlayer.name}`);
        
        // 5. If old player was captain, remove captain role from users collection
        if (isOldPlayerCaptain && oldPlayer.email) {
            await removeCaptainRole(oldPlayer.email);
            console.log(`Removed captain role from ${oldPlayer.email}`);
        }
        
        console.log('Player replacement completed successfully');
        
    } catch (error) {
        console.error('Error in performPlayerReplacement:', error);
        throw error;
    }
}


// Individual matchup saving is now implemented above

// Save lineup for a specific matchup
window.saveMatchupLineup = async function(matchIndex, team1Key, team2Key) {
    try {
        const selectedWeek = document.getElementById('lineup-week-select').value;
        if (!selectedWeek) {
            alert('Please select a week first');
            return;
        }
        

        
        // Get the lineup data for this specific matchup
        const matchupData = getMatchupLineupData(matchIndex, team1Key, team2Key);
        
        if (!matchupData.hasPlayers) {
            alert('Please select at least one player before saving this matchup.');
            return;
        }
        
        // Show saving state
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = 'Saving...';
        button.disabled = true;
        
        // Save to weeklyLineups collection
        await saveMatchupToDatabase(selectedWeek, matchIndex, matchupData);
        
        // Update scorecards in both schedule and admin sections
        await updateScorecardsForMatchup(selectedWeek, matchIndex, matchupData);
        
        // Show success
        button.textContent = '✓ Saved!';
        button.style.background = '#28a745';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '#2d4a2d';
            button.disabled = false;
        }, 2000);
        

        
    } catch (error) {
        console.error('❌ SAVE MATCHUP: Error saving matchup:', error);
        alert('Error saving matchup. Please try again.');
        
        // Reset button
        const button = event.target;
        button.textContent = 'Save This Matchup';
        button.style.background = '#2d4a2d';
        button.disabled = false;
    }
};

// Get lineup data for a specific matchup
function getMatchupLineupData(matchIndex, team1Key, team2Key) {
    const matchupData = {
        matchIndex: matchIndex,
        team1: team1Key,
        team2: team2Key,
        team1Name: lineupsTeamNames[team1Key] || team1Key,
        team2Name: lineupsTeamNames[team2Key] || team2Key,
        match1: {
            team1Players: [],
            team2Players: []
        },
        match2: {
            team1Players: [],
            team2Players: []
        },
        hasPlayers: false
    };
    
    // Get Match 1 players
    const team1Match1Player1 = getSelectedPlayerFromUI(`player-${matchIndex}-1-1`);
    const team1Match1Player2 = getSelectedPlayerFromUI(`player-${matchIndex}-1-2`);
    const team2Match1Player1 = getSelectedPlayerFromUI(`player-${matchIndex}-2-1`);
    const team2Match1Player2 = getSelectedPlayerFromUI(`player-${matchIndex}-2-2`);
    
    // Get Match 2 players
    const team1Match2Player1 = getSelectedPlayerFromUI(`player-${matchIndex}-1-3`);
    const team1Match2Player2 = getSelectedPlayerFromUI(`player-${matchIndex}-1-4`);
    const team2Match2Player1 = getSelectedPlayerFromUI(`player-${matchIndex}-2-3`);
    const team2Match2Player2 = getSelectedPlayerFromUI(`player-${matchIndex}-2-4`);
    
    // Populate matchup data
    if (team1Match1Player1) matchupData.match1.team1Players.push(team1Match1Player1);
    if (team1Match1Player2) matchupData.match1.team1Players.push(team1Match1Player2);
    if (team2Match1Player1) matchupData.match1.team2Players.push(team2Match1Player1);
    if (team2Match1Player2) matchupData.match1.team2Players.push(team2Match1Player2);
    
    if (team1Match2Player1) matchupData.match2.team1Players.push(team1Match2Player1);
    if (team1Match2Player2) matchupData.match2.team1Players.push(team1Match2Player2);
    if (team2Match2Player1) matchupData.match2.team2Players.push(team2Match2Player1);
    if (team2Match2Player2) matchupData.match2.team2Players.push(team2Match2Player2);
    
    // Check if any players are selected
    matchupData.hasPlayers = matchupData.match1.team1Players.length > 0 || 
                           matchupData.match1.team2Players.length > 0 ||
                           matchupData.match2.team1Players.length > 0 || 
                           matchupData.match2.team2Players.length > 0;
    
    return matchupData;
}

// Get selected player data from UI element
function getSelectedPlayerFromUI(uniqueId) {
    const selectedDisplay = document.getElementById(`selected-${uniqueId}`);
    const selectElement = document.getElementById(`select-${uniqueId}`);
    
    if (selectedDisplay && selectedDisplay.style.display !== 'none' && selectedDisplay.dataset.playerId) {
        const playerId = selectedDisplay.dataset.playerId;
        const playerName = selectedDisplay.querySelector('.player-name')?.textContent;
        return { playerId, name: playerName };
    }
    
    if (selectElement && selectElement.value && selectElement.style.display !== 'none') {
        const playerId = selectElement.value;
        const teamKey = selectElement.dataset.teamKey;
        const roster = lineupsTeamRosters[teamKey] || [];
        const player = roster.find(p => p.playerId === playerId);
        return player ? { playerId, name: player.name } : null;
    }
    
    return null;
}

// Save matchup data to database
async function saveMatchupToDatabase(week, matchIndex, matchupData) {
    const docPath = `clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/weeklyLineups/week-${week}`;
    const fieldName = `matchup${matchIndex}`;
    
    try {
        // Get existing document or create new one
        const docRef = db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/weeklyLineups').doc(`week-${week}`);
        const existingDoc = await docRef.get();
        
        const updateData = {
            [fieldName]: matchupData,
            lastUpdated: new Date().toISOString(),
            week: parseInt(week)
        };
        
        if (existingDoc.exists) {
            await docRef.update(updateData);

        } else {
            await docRef.set(updateData);

        }
        
    } catch (error) {
        console.error('❌ SAVE MATCHUP: Database error:', error);
        throw error;
    }
}

// Update scorecards for the saved matchup
async function updateScorecardsForMatchup(week, matchIndex, matchupData) {
    try {
        console.log(`🎯 UPDATE SCORECARDS: Updating scorecards for week ${week}, matchup ${matchIndex}`);
        console.log(`🎯 UPDATE SCORECARDS: Matchup data:`, matchupData);
        
        // 1. Update weekScorecards with lineup data for Enter Scores admin section
        await updateWeekScorecardWithLineup(week, matchIndex, matchupData);
        
        // 2. Update any scorecard templates if needed for schedule display
        await updateScorecardTemplateForSchedule(week, matchIndex, matchupData);
        
        console.log(`✅ UPDATE SCORECARDS: Successfully updated scorecards for week ${week}, matchup ${matchIndex}`);
        
    } catch (error) {
        console.error('❌ UPDATE SCORECARDS: Error updating scorecards:', error);
        throw error;
    }
}

// Update weekScorecards collection with lineup data for Enter Scores section
async function updateWeekScorecardWithLineup(week, matchIndex, matchupData) {
    try {
        console.log(`🎯 WEEK SCORECARD: Updating week scorecard for week ${week}, matchup ${matchIndex}`);
        
        // Check if a scorecard is already assigned to this week
        const weekScorecardPath = 'clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/weekScorecards';
        const weekDocRef = db.collection(weekScorecardPath).doc(`week-${week}`);
        const weekDoc = await weekDocRef.get();
        
        let updateData = {};
        
        if (weekDoc.exists) {
            // Week scorecard exists, update with lineup data
            const existingData = weekDoc.data();
            updateData = {
                ...existingData,
                [`matchup${matchIndex}Lineup`]: {
                    team1: matchupData.team1,
                    team2: matchupData.team2,
                    team1Name: matchupData.team1Name,
                    team2Name: matchupData.team2Name,
                    match1: {
                        team1Players: matchupData.match1.team1Players,
                        team2Players: matchupData.match1.team2Players
                    },
                    match2: {
                        team1Players: matchupData.match2.team1Players,
                        team2Players: matchupData.match2.team2Players
                    },
                    lastUpdated: new Date().toISOString()
                }
            };
            
            await weekDocRef.update(updateData);
            console.log(`✅ WEEK SCORECARD: Updated existing week ${week} scorecard with lineup data`);
            
        } else {
            // Create new week scorecard with lineup data (will need scorecard assignment later)
            updateData = {
                weekNumber: parseInt(week),
                [`matchup${matchIndex}Lineup`]: {
                    team1: matchupData.team1,
                    team2: matchupData.team2,
                    team1Name: matchupData.team1Name,
                    team2Name: matchupData.team2Name,
                    match1: {
                        team1Players: matchupData.match1.team1Players,
                        team2Players: matchupData.match1.team2Players
                    },
                    match2: {
                        team1Players: matchupData.match2.team1Players,
                        team2Players: matchupData.match2.team2Players
                    },
                    lastUpdated: new Date().toISOString(),
                    createdAt: new Date().toISOString()
                }
            };
            
            await weekDocRef.set(updateData);
            console.log(`✅ WEEK SCORECARD: Created new week ${week} scorecard with lineup data`);
        }
        
    } catch (error) {
        console.error('❌ WEEK SCORECARD: Error updating week scorecard:', error);
        throw error;
    }
}

// Update scorecard template for schedule display (placeholder for future enhancement)
async function updateScorecardTemplateForSchedule(week, matchIndex, matchupData) {
    try {
        console.log(`🎯 SCHEDULE SCORECARD: Updating schedule display for week ${week}, matchup ${matchIndex}`);
        
        // For now, this is a placeholder for future scorecard schedule updates
        // The schedule will be able to show actual player names when scorecards are opened
        // This could include updating a cache or directly modifying schedule display elements
        
        console.log(`🎯 SCHEDULE SCORECARD: Player lineup data available for schedule display:`, {
            team1Name: matchupData.team1Name,
            team2Name: matchupData.team2Name,
            match1Players: matchupData.match1,
            match2Players: matchupData.match2
        });
        
        // TODO: Implement real-time schedule updates when this feature is expanded
        
    } catch (error) {
        console.error('❌ SCHEDULE SCORECARD: Error updating schedule scorecard:', error);
        throw error;
    }
}

// Save all current scores to database
async function saveScoresToDatabase(weekNumber) {
    try {
        if (!weekNumber) return;
        
        // Prepare scores data for database
        const scoresData = {
            weekNumber: parseInt(weekNumber),
            playerScores: currentPlayerScores || {},
            playerStrokes: currentPlayerStrokes || {},
            lastUpdated: new Date().toISOString(),
            updatedBy: auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email || 'unknown') : 'unknown'
        };
        
        // Save to nested database structure
        const scoresPath = 'clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/scores';
        await db.collection(scoresPath).doc(`week-${weekNumber}`).set(scoresData, { merge: true });
        
        console.log(`Scores saved for Week ${weekNumber}`);
        
    } catch (error) {
        console.error('Error saving scores to database:', error);
    }
}

// Load saved scores from database
async function loadScoresFromDatabase(weekNumber) {
    try {
        if (!weekNumber) return;
        
        const scoresPath = 'clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/scores';
        const scoresDoc = await db.collection(scoresPath).doc(`week-${weekNumber}`).get();
        
        if (scoresDoc.exists) {
            const scoresData = scoresDoc.data();
            
            // Restore scores to memory
            currentPlayerScores = scoresData.playerScores || {};
            currentPlayerStrokes = scoresData.playerStrokes || {};
            
            // Update the UI with loaded scores
            restoreScoresInUI();
            
            console.log(`Scores loaded for Week ${weekNumber}`);
        }
        
    } catch (error) {
        console.error('Error loading scores from database:', error);
    }
}

// Restore scores in the UI after loading from database
function restoreScoresInUI() {
    // Update all score cells
    Object.keys(currentPlayerScores).forEach(player => {
        Object.keys(currentPlayerScores[player]).forEach(hole => {
            const score = currentPlayerScores[player][hole];
            const cell = document.querySelector(`td.score-cell[data-player="${player}"][data-hole="${hole}"]`);
            if (cell) {
                cell.textContent = score;
                applyScoreTypeStyle(cell, score);
            }
        });
    });
    
    // Update all stroke cells
    Object.keys(currentPlayerStrokes).forEach(player => {
        Object.keys(currentPlayerStrokes[player]).forEach(hole => {
            const strokeType = currentPlayerStrokes[player][hole];
            const cell = document.querySelector(`td.stroke-cell[data-player="${player}"][data-hole="${hole}"]`);
            if (cell) {
                cell.textContent = strokeType === 'full' ? '1' : strokeType === 'half' ? '½' : '';
                cell.className = `stroke-cell ${strokeType}-stroke`;
            }
        });
    });
    
    // Recalculate all totals and team scores
    recalculateAllTotals();
    updateTeamScores();
    updateTeamTotals();
    calculateMatchStatus();
    
    // Update team points after a brief delay to ensure match status is calculated
    setTimeout(() => {
        updateTeamPoints();
    }, 100);
}
