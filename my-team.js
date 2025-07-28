// My Team JavaScript - Captain functionality
// Handles team roster display and lineup management

// ===== TEAM DATA =====
let currentTeamData = null;
let currentTeamRoster = [];
let currentLineup = {};
let availableWeeks = [];
let currentUserId = null;

// ===== INITIALIZATION =====

// Initialize My Team page when captain accesses it
async function initializeMyTeam(userId, teamId) {
    try {
        console.log(`Initializing My Team for user: ${userId}, team: ${teamId}`);
        
        // Set current user ID
        currentUserId = userId;
        
        // Load team data
        await loadTeamData(teamId);
        
        // Load team roster
        await loadTeamRoster(teamId);
        
        // Load current lineups
        await loadTeamLineups(teamId);
        
        // Render the page
        renderTeamRoster();
        renderLineupManagement();
        
    } catch (error) {
        console.error('Error initializing My Team:', error);
        // Even if there's an error, try to render the roster table with placeholders
        console.log('Error occurred during initialization, attempting to render placeholder table...');
        if (currentTeamData) {
            renderTeamRoster();
        }
        showTeamError('Failed to load team data. Please try again.');
    }
}

// ===== DATA LOADING =====

// Load team information from Firestore
async function loadTeamData(teamId) {
    try {
        // Ensure teamId is a string for document lookup
        const teamIdStr = String(teamId);
        const teamIdNum = parseInt(teamId);
        console.log(`Loading team data for teamId: "${teamIdStr}" (also checking ${teamIdNum})`);
        
        // Try to get team by document ID first
        let teamDoc = await db.collection('teams').doc(teamIdStr).get();
        
        // If not found by document ID, try searching by teamId field
        if (!teamDoc.exists) {
            console.log('Team not found by document ID, searching by teamId field...');
            
            // Try with string teamId
            let teamsSnapshot = await db.collection('teams').where('teamId', '==', teamIdStr).get();
            
            // Try with number teamId if string didn't work
            if (teamsSnapshot.empty) {
                teamsSnapshot = await db.collection('teams').where('teamId', '==', teamIdNum).get();
            }
            
            if (!teamsSnapshot.empty) {
                teamDoc = teamsSnapshot.docs[0];
            }
        }
        
        if (teamDoc.exists) {
            currentTeamData = { id: teamDoc.id, ...teamDoc.data() };
            console.log('Team data loaded:', currentTeamData);
        } else {
            throw new Error(`Team ${teamIdStr} not found`);
        }
    } catch (error) {
        console.error('Error loading team data:', error);
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
        let participantsSnapshot = await db.collection('participants')
            .where('teamId', '==', teamIdStr)
            .orderBy('name', 'asc')
            .get();
        
        // If no results with string, try with number
        if (participantsSnapshot.empty) {
            participantsSnapshot = await db.collection('participants')
                .where('teamId', '==', teamIdNum)
                .orderBy('name', 'asc')
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
                        const playerDoc = await db.collection('participants').doc(playerId).get();
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

// Load existing lineups for this team
async function loadTeamLineups(teamId) {
    try {
        // Ensure teamId is a string and also try as number for compatibility
        const teamIdStr = String(teamId);
        const teamIdNum = parseInt(teamId);
        
        console.log(`Loading lineups for team: "${teamIdStr}" (also checking ${teamIdNum})`);
        
        // Try with string first
        let lineupsSnapshot = await db.collection('lineups')
            .where('teamId', '==', teamIdStr)
            .get();
        
        // If no results with string, try with number
        if (lineupsSnapshot.empty) {
            lineupsSnapshot = await db.collection('lineups')
                .where('teamId', '==', teamIdNum)
                .get();
        }
        
        currentLineup = {};
        lineupsSnapshot.forEach((doc) => {
            const lineupData = doc.data();
            currentLineup[lineupData.week] = lineupData;
        });
        
        console.log('Team lineups loaded:', currentLineup);
        
    } catch (error) {
        console.error('Error loading team lineups:', error);
        currentLineup = {};
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
    const captain = currentTeamRoster.find(player => player.id === currentTeamData.captain);
    const regularPlayers = currentTeamRoster.filter(player => player.id !== currentTeamData.captain);
    
    console.log('Team name:', teamName);
    console.log('Captain data:', captain);
    console.log('Regular players:', regularPlayers);
    console.log('Current team captain ID:', currentTeamData.captain);
    
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

// ===== LINEUP MANAGEMENT =====

// Render lineup management section
function renderLineupManagement() {
    const container = document.getElementById('lineup-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="lineup-controls">
            <div class="week-selector">
                <label for="week-select">Select Week:</label>
                <select id="week-select" onchange="loadWeekLineup()">
                    <option value="">Choose a week...</option>
                    <option value="1">Week 1</option>
                    <option value="2">Week 2</option>
                    <option value="3">Week 3</option>
                    <option value="4">Week 4</option>
                    <option value="5">Week 5</option>
                </select>
            </div>
        </div>
        
        <div id="lineup-editor" style="margin-top: 20px;">
            <p style="color: #666; text-align: center; padding: 20px;">Select a week to see the scorecard</p>
        </div>
    `;
}

// Get upcoming weeks (placeholder for now)
function getUpcomingWeeks() {
    // This will be enhanced to get actual schedule data
    return [
        { number: 1, date: 'Aug 19' },
        { number: 2, date: 'Aug 26' },
        { number: 3, date: 'Sep 2' },
        { number: 4, date: 'Sep 9' },
        { number: 5, date: 'Sep 23' }
    ];
}

// Load lineup for selected week
function loadWeekLineup() {
    const weekSelect = document.getElementById('week-select');
    const selectedWeek = weekSelect.value;
    const container = document.getElementById('lineup-editor');
    
    if (!selectedWeek) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Select a week to see the scorecard</p>';
        return;
    }
    
    // Full league schedule - each week has 2 matches between same teams with different players
    // Match 1: 2 players from each team, Match 2: 2 different players from each team
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

    // Find all matches where current team is playing this week
    const weekMatches = leagueSchedule[selectedWeek];
    if (!weekMatches) {
        console.log('No matches found for week', selectedWeek);
        return;
    }

    // Debug: Log current team data to see what we're working with
    console.log('Current team data:', currentTeamData);
    console.log('Looking for team name:', currentTeamData?.name);
    console.log('Week matches:', weekMatches);

    // Find all matches where current team is playing
    const teamMatches = [];
    
    // Try to match by team name or team number
    const teamName = currentTeamData?.name;
    const teamNumber = currentTeamData?.id || currentTeamData?.teamNumber;
    const expectedTeamName = `Team ${teamNumber}`;
    
    console.log('Team name:', teamName, 'Team number:', teamNumber, 'Expected:', expectedTeamName);
    
    for (const match of weekMatches) {
        const isMatch = match.team1 === teamName || match.team2 === teamName ||
                       match.team1 === expectedTeamName || match.team2 === expectedTeamName ||
                       match.team1 === `Team ${teamNumber}` || match.team2 === `Team ${teamNumber}`;
        
        if (isMatch) {
            teamMatches.push(match);
        }
    }

    if (teamMatches.length === 0) {
        console.log('No matchups found for team:', teamName, 'or', expectedTeamName, 'in week', selectedWeek);
        
        // Fallback: show Team 1's matches for now (for testing)
        console.log('Falling back to Team 1 matches for testing...');
        for (const match of weekMatches) {
            if (match.team1 === 'Team 1' || match.team2 === 'Team 1') {
                teamMatches.push(match);
            }
        }
        
        if (teamMatches.length === 0) {
            return;
        }
    }
    
    // Render all scorecards for this team's matches this week
    container.innerHTML = teamMatches.map((matchup, index) => `
        <div class="captain-scorecard" style="margin-bottom: 30px;">
            <div class="scorecard-header">
                <div class="match-info">
                    <span class="match-title">${matchup.team1} vs ${matchup.team2} - ${matchup.format} (Match ${matchup.match})</span>
                </div>
            </div>
            
            <div class="golf-scorecard-mini">
                <table class="scorecard-table">
                    <thead>
                        <tr class="holes-row">
                            <th class="player-col">Player</th>
                            <th>1</th>
                            <th>2</th>
                            <th>3</th>
                            <th>4</th>
                            <th>5</th>
                            <th>6</th>
                            <th>7</th>
                            <th>8</th>
                            <th>9</th>
                            <th class="total-col">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="player-row">
                            <td class="player-selection-cell">
                                <div class="player-dropdown-container" data-week="${selectedWeek}" data-match="${matchup.match}" data-position="${matchup.match === 1 ? 'A' : 'C'}">
                                    <select class="player-dropdown" id="player-${selectedWeek}-${matchup.match}-${matchup.match === 1 ? 'A' : 'C'}" onchange="handlePlayerSelection(this, '${selectedWeek}', '${matchup.match}', '${matchup.match === 1 ? 'A' : 'C'}')">
                                        <option value="">Select Player ${matchup.match === 1 ? 'A' : 'C'}</option>
                                    </select>
                                    <button class="remove-player-btn" onclick="removePlayer('${selectedWeek}', '${matchup.match}', '${matchup.match === 1 ? 'A' : 'C'}')" style="display: none;">Remove</button>
                                </div>
                            </td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="total-cell">-</td>
                        </tr>
                        <tr class="player-row">
                            <td class="player-selection-cell">
                                <div class="player-dropdown-container" data-week="${selectedWeek}" data-match="${matchup.match}" data-position="${matchup.match === 1 ? 'B' : 'D'}">
                                    <select class="player-dropdown" id="player-${selectedWeek}-${matchup.match}-${matchup.match === 1 ? 'B' : 'D'}" onchange="handlePlayerSelection(this, '${selectedWeek}', '${matchup.match}', '${matchup.match === 1 ? 'B' : 'D'}')">
                                        <option value="">Select Player ${matchup.match === 1 ? 'B' : 'D'}</option>
                                    </select>
                                    <button class="remove-player-btn" onclick="removePlayer('${selectedWeek}', '${matchup.match}', '${matchup.match === 1 ? 'B' : 'D'}')" style="display: none;">Remove</button>
                                </div>
                            </td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="total-cell">-</td>
                        </tr>
                        <tr class="team-score-row">
                            <td class="team-score-label">${matchup.team1} Team Score</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-total-cell">-</td>
                        </tr>
                        <tr class="match-status-row">
                            <td class="match-status-label">${matchup.team1} Status</td>
                            <td class="match-status-cell">AS</td>
                            <td class="match-status-cell">AS</td>
                            <td class="match-status-cell">AS</td>
                            <td class="match-status-cell">AS</td>
                            <td class="match-status-cell">AS</td>
                            <td class="match-status-cell">AS</td>
                            <td class="match-status-cell">AS</td>
                            <td class="match-status-cell">AS</td>
                            <td class="match-status-cell">AS</td>
                            <td class="match-status-total">AS</td>
                        </tr>
                        <tr style="height: 10px;"><td colspan="11"></td></tr>
                        <tr class="player-row">
                            <td class="player-name">${matchup.team2} Player ${matchup.match === 1 ? 'A' : 'C'}</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="total-cell">-</td>
                        </tr>
                        <tr class="player-row">
                            <td class="player-name">${matchup.team2} Player ${matchup.match === 1 ? 'B' : 'D'}</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="score-cell">-</td>
                            <td class="total-cell">-</td>
                        </tr>
                        <tr class="team-score-row">
                            <td class="team-score-label">${matchup.team2} Team Score</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-total-cell">-</td>
                        </tr>
                        <tr class="match-status-row">
                            <td class="match-status-label">${matchup.team2} Status</td>
                            <td class="match-status-cell">AS</td>
                            <td class="match-status-cell">AS</td>
                            <td class="match-status-cell">AS</td>
                            <td class="match-status-cell">AS</td>
                            <td class="match-status-cell">AS</td>
                            <td class="match-status-cell">AS</td>
                            <td class="match-status-cell">AS</td>
                            <td class="match-status-cell">AS</td>
                            <td class="match-status-cell">AS</td>
                            <td class="match-status-total">AS</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `).join('') + `
        <div class="lineup-submission-section">
            <div class="lineup-status" id="lineup-status-${selectedWeek}">
                <span class="status-text">Lineup not submitted</span>
            </div>
            <button class="submit-lineup-btn" id="submit-lineup-${selectedWeek}" onclick="submitLineup('${selectedWeek}')">
                Submit Lineup for Week ${selectedWeek}
            </button>
        </div>
    `;
    
    // Initialize player dropdowns after rendering
    setTimeout(() => {
        initializePlayerDropdowns(selectedWeek);
    }, 100);
}

// Render lineup editor for specific week
function renderLineupEditor(weekNumber) {
    const container = document.getElementById('lineup-editor');
    if (!container) return;
    
    const existingLineup = currentLineup[weekNumber] || {};
    const selectedPlayers = existingLineup.players || [];
    const weekData = getUpcomingWeeks().find(w => w.number == weekNumber);
    
    container.innerHTML = `
        <div class="lineup-week-header">
            <h4>Week ${weekNumber} - ${weekData ? weekData.date : 'TBD'}</h4>
            <p>Select 4 players to play this week (2 will sit out)</p>
        </div>
        
        <div class="week-content-container">
            <!-- Lineup Selection Section -->
            <div class="lineup-selection-section">
                <h5>Set Lineup</h5>
                <div class="player-selection">
                    ${currentTeamRoster.map(player => `
                        <div class="player-selector">
                            <label>
                                <input type="checkbox" 
                                       value="${player.id}" 
                                       ${selectedPlayers.includes(player.id) ? 'checked' : ''}
                                       onchange="updateLineupSelection()"
                                       class="player-checkbox">
                                <span class="player-name">${player.name}</span>
                                ${player.teamCaptain ? '<span class="captain-badge">CAPTAIN</span>' : ''}
                            </label>
                        </div>
                    `).join('')}
                </div>
                
                <div class="lineup-summary">
                    <p id="selection-count">Selected: <span id="selected-count">0</span>/4 players</p>
                </div>
                
                <div class="lineup-actions">
                    <button onclick="saveLineup(${weekNumber})" 
                            id="save-lineup-btn" 
                            class="save-btn" 
                            disabled>
                        Save Lineup
                    </button>
                </div>
            </div>
            
            <!-- Scorecard Section -->
            <div class="scorecard-section">
                <h5>Match Scorecard</h5>
                ${renderWeekScorecard(weekNumber)}
            </div>
        </div>
    `;
    
    updateLineupSelection(); // Update initial state
}

// Render scorecard for specific week
function renderWeekScorecard(weekNumber) {
    const teamName = currentTeamData.teamName || `Team ${currentTeamData.teamId}`;
    
    // Get current selection from checkboxes (for real-time preview)
    const checkboxes = document.querySelectorAll('.player-checkbox:checked');
    const currentSelection = Array.from(checkboxes).map(cb => cb.value);
    
    // Use current selection if available, otherwise use saved lineup
    const existingLineup = currentLineup[weekNumber] || {};
    const selectedPlayers = currentSelection.length > 0 ? currentSelection : (existingLineup.players || []);
    
    // Get selected players data
    const lineupPlayers = selectedPlayers.map(playerId => 
        currentTeamRoster.find(player => player.id === playerId)
    ).filter(player => player); // Remove any null/undefined
    
    // If no lineup set yet, show placeholder
    if (lineupPlayers.length === 0) {
        return `
            <div class="scorecard-placeholder">
                <p style="text-align: center; color: #666; font-style: italic; padding: 40px;">
                    Select your lineup above to view the match scorecard
                </p>
            </div>
        `;
    }
    
    // Ensure we have exactly 4 players (fill with placeholders if needed)
    const displayPlayers = [...lineupPlayers];
    while (displayPlayers.length < 4) {
        displayPlayers.push({ name: 'Player TBD', id: null });
    }
    
    return `
        <div class="captain-scorecard">
            <div class="scorecard-header">
                <div class="match-info">
                    <span class="match-teams">${teamName} vs TBD</span>
                    <span class="match-format">Format TBD</span>
                </div>
            </div>
            
            <div class="scorecard-notice">
                <p style="text-align: center; color: #666; font-style: italic; margin: 10px 0;">
                    Scorecard will be populated after match completion
                </p>
            </div>
            
            <div class="golf-scorecard-mini">
                <table class="scorecard-table">
                    <thead>
                        <tr class="holes-row">
                            <th class="player-col">Player</th>
                            <th>1</th>
                            <th>2</th>
                            <th>3</th>
                            <th>4</th>
                            <th>5</th>
                            <th>6</th>
                            <th>7</th>
                            <th>8</th>
                            <th>9</th>
                            <th class="total-col">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${displayPlayers.map((player, index) => `
                            <tr class="player-row ${player.id ? 'lineup-player' : 'placeholder-player'}">
                                <td class="player-name">${player.name}</td>
                                <td class="score-cell">-</td>
                                <td class="score-cell">-</td>
                                <td class="score-cell">-</td>
                                <td class="score-cell">-</td>
                                <td class="score-cell">-</td>
                                <td class="score-cell">-</td>
                                <td class="score-cell">-</td>
                                <td class="score-cell">-</td>
                                <td class="score-cell">-</td>
                                <td class="total-cell">-</td>
                            </tr>
                        `).join('')}
                        <tr class="team-score-row">
                            <td class="team-score-label">${teamName} Score</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-score-cell">-</td>
                            <td class="team-total-cell">-</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Update lineup selection state
function updateLineupSelection() {
    const checkboxes = document.querySelectorAll('.player-checkbox');
    const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    
    // Update count display
    document.getElementById('selected-count').textContent = selectedCount;
    
    // Enable/disable save button
    const saveBtn = document.getElementById('save-lineup-btn');
    if (saveBtn) {
        saveBtn.disabled = selectedCount !== 4;
        
        if (selectedCount > 4) {
            saveBtn.textContent = `Too many selected (${selectedCount}/4)`;
            saveBtn.style.background = '#dc3545';
        } else if (selectedCount < 4) {
            saveBtn.textContent = `Need ${4 - selectedCount} more players`;
            saveBtn.style.background = '#6c757d';
        } else {
            saveBtn.textContent = 'Save Lineup';
            saveBtn.style.background = '#2d4a2d';
        }
    }
    
    // Update scorecard preview when lineup changes
    updateScorecardPreview();
    
    // Disable unchecked checkboxes if 4 are selected
    checkboxes.forEach(checkbox => {
        if (!checkbox.checked && selectedCount >= 4) {
            checkbox.disabled = true;
        } else {
            checkbox.disabled = false;
        }
    });
}

// Update scorecard preview when lineup changes
function updateScorecardPreview() {
    const weekSelect = document.getElementById('week-select');
    if (weekSelect && weekSelect.value) {
        const scorecardSection = document.querySelector('.scorecard-section');
        if (scorecardSection) {
            const newScorecard = renderWeekScorecard(weekSelect.value);
            scorecardSection.innerHTML = `
                <h5>Match Scorecard</h5>
                ${newScorecard}
            `;
        }
    }
}

// Save lineup to Firestore
async function saveLineup(weekNumber) {
    try {
        const checkboxes = document.querySelectorAll('.player-checkbox:checked');
        const selectedPlayerIds = Array.from(checkboxes).map(cb => cb.value);
        
        if (selectedPlayerIds.length !== 4) {
            showTeamError('Please select exactly 4 players.');
            return;
        }
        
        const lineupData = {
            teamId: String(currentTeamData.id), // Ensure teamId is a string
            week: weekNumber,
            players: selectedPlayerIds,
            submittedAt: new Date().toISOString(),
            submittedBy: firebase.auth().currentUser.uid
        };
        
        // Save to lineups collection
        const lineupRef = db.collection('lineups').doc(`${currentTeamData.id}_week${weekNumber}`);
        await lineupRef.set(lineupData);
        
        // Update local data
        currentLineup[weekNumber] = lineupData;
        
        // Refresh scorecard to show saved lineup
        updateScorecardPreview();
        
        showTeamSuccess(`Week ${weekNumber} lineup saved successfully!`);
        
    } catch (error) {
        console.error('Error saving lineup:', error);
        showTeamError('Failed to save lineup. Please try again.');
    }
}

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

// Debug function to force render the lineup section for styling purposes
window.forceRenderLineup = function() {
    console.log('Force rendering lineup section...');
    
    // Force render lineup section
    renderLineupManagement();
    
    console.log('Lineup section with dropdown and scorecard rendered on My Team page');
};



// ===== PLAYER DROPDOWN MANAGEMENT =====

// Track selected players for each week
let weeklyLineups = {};

// Initialize player dropdowns after loading week lineup
function initializePlayerDropdowns(weekNumber) {
    // Initialize weekly lineup tracking if not exists
    if (!weeklyLineups[weekNumber]) {
        weeklyLineups[weekNumber] = {
            submitted: false,
            players: {}
        };
    }
    
    // Populate all dropdowns with available players
    populatePlayerDropdowns(weekNumber);
    
    // Check if lineup is already submitted (from database)
    checkLineupSubmissionStatus(weekNumber);
}

// Populate dropdowns with available players
function populatePlayerDropdowns(weekNumber) {
    if (!currentTeamRoster || currentTeamRoster.length === 0) {
        console.log('No team roster available for dropdowns');
        return;
    }
    
    // Get all dropdowns for this week
    const dropdowns = document.querySelectorAll(`select[id*="player-${weekNumber}-"]`);
    
    dropdowns.forEach(dropdown => {
        const currentValue = dropdown.value;
        
        // Clear existing options except the default
        dropdown.innerHTML = '<option value="">Select Player</option>';
        
        // Add available players
        currentTeamRoster.forEach(player => {
            if (player && player.name) {
                const isSelected = Object.values(weeklyLineups[weekNumber].players).includes(player.name);
                const isCurrentSelection = currentValue === player.name;
                
                // Only add if not selected elsewhere or is current selection
                if (!isSelected || isCurrentSelection) {
                    const option = document.createElement('option');
                    option.value = player.name;
                    option.textContent = player.name;
                    if (isCurrentSelection) {
                        option.selected = true;
                    }
                    dropdown.appendChild(option);
                }
            }
        });
    });
}

// Handle player selection
function handlePlayerSelection(selectElement, weekNumber, match, position) {
    const playerId = `${match}-${position}`;
    const selectedPlayer = selectElement.value;
    
    if (selectedPlayer) {
        // Add to weekly lineup
        weeklyLineups[weekNumber].players[playerId] = selectedPlayer;
        
        // Show remove button
        const container = selectElement.parentElement;
        const removeBtn = container.querySelector('.remove-player-btn');
        if (removeBtn) {
            removeBtn.style.display = 'inline-block';
        }
        
        // Update all dropdowns to remove this player from others
        populatePlayerDropdowns(weekNumber);
        
        console.log(`Selected ${selectedPlayer} for Week ${weekNumber}, Match ${match}, Position ${position}`);
    }
    
    // Check if all 4 positions are filled
    updateSubmitButtonState(weekNumber);
}

// Remove player from lineup
function removePlayer(weekNumber, match, position) {
    const playerId = `${match}-${position}`;
    const dropdown = document.getElementById(`player-${weekNumber}-${match}-${position}`);
    
    if (dropdown) {
        // Remove from weekly lineup
        delete weeklyLineups[weekNumber].players[playerId];
        
        // Reset dropdown
        dropdown.value = '';
        
        // Hide remove button
        const container = dropdown.parentElement;
        const removeBtn = container.querySelector('.remove-player-btn');
        if (removeBtn) {
            removeBtn.style.display = 'none';
        }
        
        // Update all dropdowns
        populatePlayerDropdowns(weekNumber);
        
        console.log(`Removed player from Week ${weekNumber}, Match ${match}, Position ${position}`);
    }
    
    // Update submit button state
    updateSubmitButtonState(weekNumber);
}

// Update submit button state based on selections
function updateSubmitButtonState(weekNumber) {
    const submitBtn = document.getElementById(`submit-lineup-${weekNumber}`);
    const statusElement = document.getElementById(`lineup-status-${weekNumber}`);
    
    if (!submitBtn || !statusElement) return;
    
    const lineup = weeklyLineups[weekNumber];
    const selectedCount = Object.keys(lineup.players).length;
    
    if (lineup.submitted) {
        submitBtn.style.display = 'none';
        statusElement.innerHTML = '<span class="status-submitted">✓ Lineup Submitted</span>';
        setDropdownsReadOnly(weekNumber, true);
    } else if (selectedCount === 4) {
        submitBtn.disabled = false;
        submitBtn.textContent = `Submit Lineup for Week ${weekNumber}`;
        statusElement.innerHTML = '<span class="status-ready">Ready to submit (4/4 players selected)</span>';
    } else {
        submitBtn.disabled = true;
        submitBtn.textContent = `Submit Lineup (${selectedCount}/4 players selected)`;
        statusElement.innerHTML = `<span class="status-pending">Select ${4 - selectedCount} more players</span>`;
    }
}

// Submit lineup to database
async function submitLineup(weekNumber) {
    const lineup = weeklyLineups[weekNumber];
    
    if (!lineup || Object.keys(lineup.players).length !== 4) {
        showTeamError('Please select all 4 players before submitting');
        return;
    }
    
    try {
        // Mark as submitted locally
        lineup.submitted = true;
        
        // Save to Firestore
        await db.collection('lineups').doc(`${currentUserId}-week-${weekNumber}`).set({
            userId: currentUserId,
            teamId: currentTeamData.id,
            week: weekNumber,
            players: lineup.players,
            submittedAt: new Date().toISOString(),
            submittedBy: firebase.auth().currentUser?.email
        });
        
        showTeamSuccess(`Week ${weekNumber} lineup submitted successfully!`);
        updateSubmitButtonState(weekNumber);
        
        console.log(`Lineup submitted for Week ${weekNumber}:`, lineup.players);
        
    } catch (error) {
        console.error('Error submitting lineup:', error);
        showTeamError('Failed to submit lineup. Please try again.');
        lineup.submitted = false; // Revert on error
    }
}

// Set dropdowns to read-only state
function setDropdownsReadOnly(weekNumber, readOnly) {
    const dropdowns = document.querySelectorAll(`select[id*="player-${weekNumber}-"]`);
    const removeButtons = document.querySelectorAll(`button[onclick*="removePlayer('${weekNumber}'"]`);
    
    dropdowns.forEach(dropdown => {
        dropdown.disabled = readOnly;
        if (readOnly) {
            dropdown.style.background = '#f5f5f5';
            dropdown.style.cursor = 'not-allowed';
        }
    });
    
    removeButtons.forEach(btn => {
        if (readOnly) {
            btn.style.display = 'none';
        }
    });
}

// Check if lineup is already submitted (from database)
async function checkLineupSubmissionStatus(weekNumber) {
    try {
        const lineupDoc = await db.collection('lineups').doc(`${currentUserId}-week-${weekNumber}`).get();
        
        if (lineupDoc.exists) {
            const lineupData = lineupDoc.data();
            weeklyLineups[weekNumber] = {
                submitted: true,
                players: lineupData.players || {}
            };
            
            // Set dropdown values from saved lineup
            Object.entries(lineupData.players).forEach(([position, playerName]) => {
                const [match, pos] = position.split('-');
                const dropdown = document.getElementById(`player-${weekNumber}-${match}-${pos}`);
                if (dropdown) {
                    dropdown.value = playerName;
                    
                    // Show player name and hide remove button since it's submitted
                    const container = dropdown.parentElement;
                    const removeBtn = container.querySelector('.remove-player-btn');
                    if (removeBtn) {
                        removeBtn.style.display = 'none';
                    }
                }
            });
            
            updateSubmitButtonState(weekNumber);
        }
        
    } catch (error) {
        console.error('Error checking lineup status:', error);
    }
}

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