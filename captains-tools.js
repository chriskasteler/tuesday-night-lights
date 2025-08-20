// Captain's Tools JavaScript - Captain functionality
// Handles team roster display and team management

// ===== TEAM DATA =====
let currentTeamData = null;
let currentTeamRoster = [];
let currentUserId = null;
let allTeamsData = {}; // Store all teams for name mapping

// ===== INITIALIZATION =====

// Initialize Captain's Tools page when captain accesses it
async function initializeMyTeam(userId, teamId) {
    try {
        console.log(`🚀 INITIALIZE MY TEAM - User: ${userId}, Team: ${teamId} (Type: ${typeof teamId})`);
        
        // Set current user ID
        currentUserId = userId;
        
        // Load all teams for name mapping
        await loadAllTeams();
        
        // Load team data
        console.log(`🎯 About to load team data for: ${teamId}`);
        await loadTeamData(teamId);
        
        // Load team roster
        console.log(`🎯 About to load team roster for: ${teamId}`);
        await loadTeamRoster(teamId);
        
        // Render the page
        renderTeamRoster();
        
        // Hide loading overlay - data is loaded
        hideMyTeamLoading();
        
        console.log(`✅ INITIALIZATION COMPLETE for team: ${teamId}`);
        
    } catch (error) {
        console.error('💥 Error initializing Captain\'s Tools:', error);
        // Even if there's an error, try to render the roster table with placeholders
        console.log('Error occurred during initialization, attempting to render placeholder table...');
        if (currentTeamData) {
            renderTeamRoster();
        }
        showTeamError('Failed to load team data. Please try again.');
        
        // Hide loading overlay even on error
        hideMyTeamLoading();
    }
}

// ===== DATA LOADING =====

// Load all teams from Firestore for name mapping
async function loadAllTeams() {
    try {
        console.log('Loading all teams for name mapping...');
        const teamsSnapshot = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/teams').get();
        
        allTeamsData = {};
        teamsSnapshot.forEach(doc => {
            const teamData = doc.data();
            const teamId = teamData.teamId || doc.id;
            
            // Create mapping from both "Team X" format and actual team name
            const teamIdStr = String(teamId);
            const defaultName = `Team ${teamId}`;
            const actualName = teamData.teamName || teamData.name || defaultName;
            
            // Map both formats to the actual name
            allTeamsData[defaultName] = actualName;
            allTeamsData[actualName] = actualName;
            
            console.log(`Team mapping: "${defaultName}" -> "${actualName}"`);
        });
        
        console.log('All teams loaded:', allTeamsData);
        
    } catch (error) {
        console.error('Error loading all teams:', error);
        // Set up default mapping as fallback
        allTeamsData = {
            'Team 1': 'Team 1',
            'Team 2': 'Team 2',
            'Team 3': 'Team 3',
            'Team 4': 'Team 4',
            'Team 5': 'Team 5',
            'Team 6': 'Team 6'
        };
    }
}

// Get actual team name from schedule team name
function getActualTeamName(scheduleTeamName) {
    return allTeamsData[scheduleTeamName] || scheduleTeamName;
}

// Load team information from Firestore
async function loadTeamData(teamId) {
    try {
        // Ensure teamId is a string for document lookup
        const teamIdStr = String(teamId);
        const teamIdNum = parseInt(teamId);
        console.log(`🔍 Loading team data for teamId: "${teamIdStr}" (also checking ${teamIdNum})`);
        
        let teamDoc = null;
        
        // Method 1: Try to get team by document ID first
        console.log('🔍 Method 1: Searching by document ID...');
        teamDoc = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/teams').doc(teamIdStr).get();
        
        if (teamDoc.exists) {
            console.log('✅ Found team by document ID:', teamDoc.data());
        } else {
            console.log('❌ Team not found by document ID, trying teamId field...');
            
            // Method 2: Search by teamId field with string value
            console.log('🔍 Method 2: Searching by teamId field (string)...');
            let teamsSnapshot = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/teams').where('teamId', '==', teamIdStr).get();
            
            if (!teamsSnapshot.empty) {
                teamDoc = teamsSnapshot.docs[0];
                console.log('✅ Found team by teamId field (string):', teamDoc.data());
            } else {
                console.log('❌ Team not found with string teamId, trying number...');
                
                // Method 3: Search by teamId field with number value
                console.log('🔍 Method 3: Searching by teamId field (number)...');
                teamsSnapshot = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/teams').where('teamId', '==', teamIdNum).get();
            
            if (!teamsSnapshot.empty) {
                teamDoc = teamsSnapshot.docs[0];
                    console.log('✅ Found team by teamId field (number):', teamDoc.data());
                } else {
                    console.log('❌ Team not found with any method');
                }
            }
        }
        
        if (teamDoc && teamDoc.exists) {
            currentTeamData = { id: teamDoc.id, ...teamDoc.data() };
            console.log('✅ Final team data loaded:', currentTeamData);
        } else {
            console.error(`❌ Team ${teamIdStr} not found with any method`);
            throw new Error(`Team ${teamIdStr} not found`);
        }
    } catch (error) {
        console.error('💥 Error loading team data:', error);
        throw error;
    }
}

// Load team roster (players assigned to this team)
async function loadTeamRoster(teamId) {
    try {
        currentTeamRoster = [];
        
        // Ensure teamId is a string and also try as number for compatibility
        const teamIdStr = String(teamId);
        const teamIdNum = parseInt(teamId);
        
        console.log(`Loading roster for team: "${teamIdStr}" (also checking ${teamIdNum})`);
        
        // Method 1: Try to find participants with teamId field (try both string and number)
        // Remove orderBy to avoid index requirement
        let participantsSnapshot = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/participants')
            .where('teamId', '==', teamIdStr)
            .get();
        
        // If no results with string, try with number
        if (participantsSnapshot.empty) {
            participantsSnapshot = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/participants')
                .where('teamId', '==', teamIdNum)
                .get();
        }
        
        participantsSnapshot.forEach((doc) => {
            currentTeamRoster.push({ id: doc.id, ...doc.data() });
        });
        
        // Method 2: If no participants found with teamId, get players from team.players array
        if (currentTeamRoster.length === 0 && currentTeamData?.players) {
            console.log('No participants found with teamId, checking team.players array');
            
            const playerIds = [...currentTeamData.players];
            if (currentTeamData.captain && !playerIds.includes(currentTeamData.captain)) {
                playerIds.push(currentTeamData.captain);
            }
            
            // Get participant details for each player ID
            for (const playerId of playerIds) {
                if (playerId) {
                    try {
                        const playerDoc = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/participants').doc(playerId).get();
                        if (playerDoc.exists) {
                            currentTeamRoster.push({ id: playerDoc.id, ...playerDoc.data() });
                        }
                    } catch (err) {
                        console.log(`Could not find participant ${playerId}:`, err);
                    }
                }
            }
        }
        
        console.log('Team roster loaded:', currentTeamRoster);
        console.log('Roster loading complete. Will render table with placeholders if empty.');
        
    } catch (error) {
        console.error('Error loading team roster:', error);
        currentTeamRoster = [];
        console.log('Error occurred, setting empty roster. Table will show placeholders.');
    }
}

// ===== ROSTER RENDERING =====

// Render team roster section
function renderTeamRoster() {
    const container = document.getElementById('team-roster-container');
    if (!container) return;
    
    if (!currentTeamData) {
        container.innerHTML = `
            <p style="text-align: center; color: #666; margin: 40px 0;">
                Team roster will be displayed here once teams are assigned.
            </p>
        `;
        return;
    }
    
    // Always show the table structure, even with empty roster (for styling purposes)
    console.log('Rendering team roster. Current roster length:', currentTeamRoster.length);
    
    const teamName = currentTeamData.teamName || `Team ${currentTeamData.teamId}`;
    
    // Find captain - check both team captain field and current user (since they're viewing this page as captain)
    const currentUserEmail = firebase.auth().currentUser?.email;
    let captain = currentTeamRoster.find(player => player.id === currentTeamData.captain);
    
    // If no captain found by ID, check if current user is in roster (they must be the captain)
    if (!captain && currentUserEmail) {
        captain = currentTeamRoster.find(player => player.email === currentUserEmail);
        console.log('Captain identified by current user email:', captain?.name);
    }
    
    // Filter out the captain from regular players
    const captainId = captain?.id;
    const regularPlayers = currentTeamRoster.filter(player => player.id !== captainId);
    
    console.log('Team name:', teamName);
    console.log('Captain data:', captain);
    console.log('Regular players count:', regularPlayers.length);
    console.log('Current team captain ID from data:', currentTeamData.captain);
    console.log('Actual captain found:', captain?.name);
    
    container.innerHTML = `
        <div class="team-header">
            <h4>${teamName}</h4>
            <p>Season Record: ${currentTeamData.wins || 0} - ${currentTeamData.losses || 0}</p>
        </div>
        
        <div class="roster-table-container">
            <table class="roster-table">
                <thead>
                    <tr>
                        <th>Position</th>
                        <th>Player Name</th>
                        <th>Status</th>
                        <th>Matches Played</th>
                        <th title="Matches remaining to meet 3-match minimum requirement">Remaining</th>
                        <th>Record</th>
                        <th>Points</th>
                    </tr>
                </thead>
                <tbody>
                    ${captain ? `
                        <tr class="captain-row">
                            <td class="position-cell">C</td>
                            <td class="player-name-cell">
                                <span class="player-name">${captain.name}</span>
                                <span class="captain-badge">CAPTAIN</span>
                            </td>
                            <td class="status-cell">
                                <span class="status-active">Active</span>
                            </td>
                            <td class="stats-cell">${captain.matchesPlayed || captain.gamesPlayed || 0}</td>
                            <td class="stats-cell remaining-cell remaining-${Math.max(0, 3 - (captain.matchesPlayed || captain.gamesPlayed || 0))}">${Math.max(0, 3 - (captain.matchesPlayed || captain.gamesPlayed || 0))}</td>
                            <td class="stats-cell">${captain.record || captain.average || 'N/A'}</td>
                            <td class="stats-cell">${captain.points || captain.totalPoints || 0}</td>
                        </tr>
                    ` : `
                        <tr class="captain-row">
                            <td class="position-cell">C</td>
                            <td class="player-name-cell">
                                <span class="placeholder-text">Captain TBD</span>
                            </td>
                            <td class="status-cell">
                                <span class="status-pending">Pending</span>
                            </td>
                            <td class="stats-cell">-</td>
                            <td class="stats-cell remaining-cell">-</td>
                            <td class="stats-cell">-</td>
                            <td class="stats-cell">-</td>
                        </tr>
                    `}
                    
                    ${Array.from({length: 5}, (_, i) => {
                        const player = regularPlayers[i];
                        const position = i + 2; // Positions 2-6
                        
                        console.log(`Position ${position}: player =`, player);
                        
                        return `
                            <tr class="player-row">
                                <td class="position-cell">${position}</td>
                                <td class="player-name-cell">
                                    ${player ? `
                                        <span class="player-name">${player.name}</span>
                                    ` : `
                                        <span class="placeholder-text">Player ${position} TBD</span>
                                    `}
                                </td>
                                <td class="status-cell">
                                    ${player ? `
                                        <span class="status-active">Active</span>
                                    ` : `
                                        <span class="status-open">Open</span>
                                    `}
                                </td>
                                <td class="stats-cell">${player ? (player.matchesPlayed || player.gamesPlayed || 0) : '-'}</td>
                                <td class="stats-cell remaining-cell ${player ? `remaining-${Math.max(0, 3 - (player.matchesPlayed || player.gamesPlayed || 0))}` : ''}">${player ? Math.max(0, 3 - (player.matchesPlayed || player.gamesPlayed || 0)) : '-'}</td>
                                <td class="stats-cell">${player ? (player.record || player.average || 'N/A') : '-'}</td>
                                <td class="stats-cell">${player ? (player.points || player.totalPoints || 0) : '-'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ===== DEBUG FUNCTIONS =====

// Debug function to force render the roster table for styling purposes
window.forceRenderRoster = function() {
    console.log('Force rendering roster table for styling...');
    
    // Set up minimal team data if none exists
    if (!currentTeamData) {
        currentTeamData = {
            id: 'test-team',
            teamId: 1,
            teamName: 'Test Team',
            captain: null,
            players: []
        };
    }
    
    // Clear roster to show placeholders
    currentTeamRoster = [];
    
    // Force render
    renderTeamRoster();
    
    console.log('Roster table rendered with placeholders for styling purposes');
};

// ===== UTILITY FUNCTIONS =====

// Show success message
function showTeamSuccess(message) {
    // Create temporary success message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'team-message team-success';
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #d4edda;
        color: #155724;
        padding: 15px 20px;
        border-radius: 4px;
        border: 1px solid #c3e6cb;
        z-index: 1000;
        max-width: 300px;
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// Show error message
function showTeamError(message) {
    // Create temporary error message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'team-message team-error';
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f8d7da;
        color: #721c24;
        padding: 15px 20px;
        border-radius: 4px;
        border: 1px solid #f5c6cb;
        z-index: 1000;
        max-width: 300px;
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 4000);
} 
