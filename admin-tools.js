// Team Management JavaScript Functions

let allPlayers = [];
let currentTeams = [];

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
        // Load participants
        const participantsSnapshot = await db.collection('participants').orderBy('name', 'asc').get();
        allPlayers = [];
        participantsSnapshot.forEach((doc) => {
            allPlayers.push({ id: doc.id, ...doc.data() });
        });

        // Clean up any duplicate teams first
        const duplicatesRemoved = await cleanupDuplicateTeams();
        
        // Load teams (or create default structure)
        const teamsSnapshot = await db.collection('teams').orderBy('teamId', 'asc').get();
        
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
        
        console.log('Loaded teams:', currentTeams.map(t => `${t.teamName} (ID: ${t.id}, teamId: ${t.teamId})`));

        // Render the teams management interface
        renderTeamsManagement();
        
        // Update counters for players tab
        updateMembershipCounters();
        
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
            captain: null,
            wins: 0,
            losses: 0,
            lastUpdated: new Date().toISOString()
        };
        
        try {
            // Use set() with specific document ID to prevent duplicates
            const docId = `team-${i}`;
            await db.collection('teams').doc(docId).set(teamData);
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
    
    console.log(`🎯 Fix complete: ${fixedCount} fixed, ${errorCount} errors`);
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
async function updateTeamRoster(selectElement) {
    const card = selectElement.closest('.team-management-card');
    const teamId = parseInt(card.getAttribute('data-team-id'));
    
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
            
            await db.collection('teams').doc(docId).set({
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
                    await db.collection('participants').doc(playerId).update({
                        teamId: String(teamId)
                    });
                    console.log(`✅ Updated participant ${playerId} with teamId: ${teamId}`);
                    participantUpdates.push(`✅ ${playerId}`);
                } catch (error) {
                    console.error(`❌ Error updating participant ${playerId}:`, error);
                    participantUpdates.push(`❌ ${playerId}: ${error.message}`);
                }
            }
            
            console.log(`📝 Participant updates complete:`, participantUpdates);
            
            // Verify the save by reading it back
            const savedDoc = await db.collection('teams').doc(docId).get();
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
        const participantsSnapshot = await db.collection('participants')
            .where('email', '==', userEmail)
            .get();
        
        if (!participantsSnapshot.empty) {
            // Remove teamId from participant record
            const participantDoc = participantsSnapshot.docs[0];
            await participantDoc.ref.update({
                teamId: firebase.firestore.FieldValue.delete(),
                lastUpdated: new Date().toISOString()
            });
            console.log(`Removed teamId from participant record: ${userEmail}`);
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
                }
                currentTeams[teamIndex].captain = null;
            }
        }
    }
    
    // Save the updated team to database
    try {
        const team = currentTeams[teamIndex];
        await db.collection('teams').doc(team.id).set({
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
                await db.collection('participants').doc(playerId).update({
                    teamId: null
                });
                console.log(`✅ Cleared teamId for removed participant: ${playerId}`);
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

// Load teams data when page loads (for other sections that need team names)
document.addEventListener('DOMContentLoaded', function() {
    // Load signup visibility setting on every page load
    loadSignupVisibility();
    
    // Only initialize admin tools if we're on that section
    if (document.getElementById('teams-grid')) {
        initializeManageTeams();
        loadPendingRequests(); // Also load pending requests
    }
});

// ===== ADMIN SCORING FUNCTIONS =====

// Global variable to store all teams data for admin scoring
let adminAllTeamsData = {};

// Load all teams for admin scoring name mapping
async function loadAdminTeamsData() {
    try {
        console.log('Loading all teams for admin scoring...');
        const teamsSnapshot = await db.collection('teams').get();
        
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
    
    // Check if a scorecard has been assigned to this week
    try {
        const weekScorecardDoc = await db.collection('weekScorecards').doc(`week-${selectedWeek}`).get();
        if (weekScorecardDoc.exists) {
            window.currentWeekScorecard = weekScorecardDoc.data();
            console.log(`✅ Loaded scorecard for Week ${selectedWeek}:`, window.currentWeekScorecard.scorecardName);
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
        cells += `<td class="score-cell editable-score" 
                     data-player="${player}" 
                     data-hole="${hole}" 
                     data-match="${matchNum}" 
                     data-group="${groupIndex}" 
                     data-week="${weekNumber}"
                     style="padding: 8px; border: 1px solid #ddd; text-align: center; cursor: pointer; user-select: none; min-height: 36px; position: relative;"
                     onclick="openScorePad(this)">-</td>`;
    }
    return cells;
}

// Render individual scorecard for admin scoring
function renderAdminScorecard(matchup, weekNumber, groupIndex, matchNum) {
    const team1Player1 = `${getAdminTeamName(matchup.team1)}-${matchNum === 1 ? 'A' : 'C'}`;
    const team1Player2 = `${getAdminTeamName(matchup.team1)}-${matchNum === 1 ? 'B' : 'D'}`;
    const team2Player1 = `${getAdminTeamName(matchup.team2)}-${matchNum === 1 ? 'A' : 'C'}`;
    const team2Player2 = `${getAdminTeamName(matchup.team2)}-${matchNum === 1 ? 'B' : 'D'}`;

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
                       </tr>
                   </thead>
                   <tbody>
                       ${generateParRow(weekNumber)}
                       <tr class="player-row">
                           <td class="player-name" style="padding: 8px; border: 1px solid #ddd; font-weight: 500;">${getAdminTeamName(matchup.team1)} Player ${matchNum === 1 ? 'A' : 'C'}</td>
                           ${generateScoreCells(team1Player1, matchNum, groupIndex, weekNumber)}
                           <td class="total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                       </tr>
                       <tr class="player-row">
                           <td class="player-name" style="padding: 8px; border: 1px solid #ddd; font-weight: 500;">${getAdminTeamName(matchup.team1)} Player ${matchNum === 1 ? 'B' : 'D'}</td>
                           ${generateScoreCells(team1Player2, matchNum, groupIndex, weekNumber)}
                           <td class="total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
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
                           <td class="team-total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                       </tr>
                       <tr style="height: 10px;"><td colspan="11" style="border: none;"></td></tr>
                       <tr class="player-row">
                           <td class="player-name" style="padding: 8px; border: 1px solid #ddd; font-weight: 500;">${getAdminTeamName(matchup.team2)} Player ${matchNum === 1 ? 'A' : 'C'}</td>
                           ${generateScoreCells(team2Player1, matchNum, groupIndex, weekNumber)}
                           <td class="total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                       </tr>
                       <tr class="player-row">
                           <td class="player-name" style="padding: 8px; border: 1px solid #ddd; font-weight: 500;">${getAdminTeamName(matchup.team2)} Player ${matchNum === 1 ? 'B' : 'D'}</td>
                           ${generateScoreCells(team2Player2, matchNum, groupIndex, weekNumber)}
                           <td class="total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
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
                           <td class="team-total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
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

// Check if device is mobile
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
}

// Open score pad for mobile score entry
function openScorePad(cell) {
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
    currentScoreCell.style.backgroundColor = '#e8f5e8';
    
    // Store the score
    const player = currentScoreCell.dataset.player;
    const hole = currentScoreCell.dataset.hole;
    if (!currentPlayerScores[player]) currentPlayerScores[player] = {};
    currentPlayerScores[player][hole] = score;
    
    // Auto-advance to next hole
    setTimeout(() => {
        closeScorePad();
        advanceToNextHole();
    }, 200);
}

// Clear the current score
function clearScore() {
    if (!currentScoreCell) return;
    
    currentScoreCell.textContent = '-';
    currentScoreCell.style.backgroundColor = '';
    
    const player = currentScoreCell.dataset.player;
    const hole = currentScoreCell.dataset.hole;
    if (currentPlayerScores[player]) {
        delete currentPlayerScores[player][hole];
    }
    
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

// Desktop editing functionality
function makeDesktopEditable(cell) {
    const currentValue = cell.textContent.trim();
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.max = '12';
    input.value = currentValue === '-' ? '' : currentValue;
    input.style.width = '100%';
    input.style.textAlign = 'center';
    input.style.border = 'none';
    input.style.background = '#e8f5e8';
    input.style.fontSize = 'inherit';
    
    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    input.select();
    
    function saveValue() {
        const value = input.value.trim();
        const score = value === '' ? '-' : value;
        cell.textContent = score;
        cell.style.backgroundColor = score !== '-' ? '#e8f5e8' : '';
        
        // Store the score
        const player = cell.dataset.player;
        const hole = cell.dataset.hole;
        if (!currentPlayerScores[player]) currentPlayerScores[player] = {};
        if (score !== '-') {
            currentPlayerScores[player][hole] = parseInt(score);
        } else if (currentPlayerScores[player]) {
            delete currentPlayerScores[player][hole];
        }
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
        if (!scorecardsContainer) return;
        
        // Show loading state
        scorecardsContainer.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <p style="color: #666; font-size: 1.1rem;">Loading scorecards...</p>
            </div>
        `;
        
        // Fetch scorecards from Firebase
        const scorecardsSnapshot = await db.collection('scorecards').orderBy('createdAt', 'desc').get();
        
        if (scorecardsSnapshot.empty) {
            // Show "no scorecards" state
            showNoScorecardsState();
        } else {
            // Show scorecards list
            showScorecardsList(scorecardsSnapshot.docs);
        }
        
    } catch (error) {
        console.error('❌ Error loading scorecards:', error);
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
        '1': 4, '2': 3, '3': 5, '4': 4, '5': 4, '6': 3, '7': 4, '8': 5, '9': 3
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
                                 <td id="par-total" style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #fff3cd;">${existingData ? existingData.total : 35}</td>
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
            
            await db.collection('scorecards').doc(editingIdInput.value).update(scorecardConfig);
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
            
            const docRef = await db.collection('scorecards').add(scorecardConfig);
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
        const scorecardDoc = await db.collection('scorecards').doc(scorecardId).get();
        
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
    if (confirm(`Are you sure you want to delete "${scorecardName}"?`)) {
        db.collection('scorecards').doc(scorecardId).delete()
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
                    <button onclick="showScorecardSelector(${weekNumber})" style="background: #4a5d4a; color: white; border: none; padding: 8px 20px; border-radius: 4px; font-size: 0.9rem; cursor: pointer;">
                        Please Select Scorecard for Week ${weekNumber}
                    </button>
                </td>
            </tr>
        `;
    }
}

// Show scorecard selector for a specific week
async function showScorecardSelector(weekNumber) {
    try {
        // Fetch available scorecards
        const scorecardsSnapshot = await db.collection('scorecards').orderBy('name').get();
        
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
                                <div class="scorecard-option" style="border: 1px solid #ddd; border-radius: 6px; padding: 15px; margin-bottom: 10px; cursor: pointer; background: #f8f9fa;" onclick="selectScorecardForWeek('${doc.id}', '${data.name}', ${weekNumber})">
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
        // Get the scorecard data
        const scorecardDoc = await db.collection('scorecards').doc(scorecardId).get();
        if (!scorecardDoc.exists) {
            alert('Scorecard not found.');
            return;
        }
        
        const scorecardData = scorecardDoc.data();
        
        // Save the week-scorecard association
        await db.collection('weekScorecards').doc(`week-${weekNumber}`).set({
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