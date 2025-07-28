// My Team JavaScript - Captain functionality
// Handles team roster display and lineup management

// ===== TEAM DATA =====
let currentTeamData = null;
let currentTeamRoster = [];
let currentLineup = {};
let availableWeeks = [];

// ===== INITIALIZATION =====

// Initialize My Team page when captain accesses it
async function initializeMyTeam(userId, teamId) {
    try {
        console.log(`Initializing My Team for user: ${userId}, team: ${teamId}`);
        
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
        showTeamError('Failed to load team data. Please try again.');
    }
}

// ===== DATA LOADING =====

// Load team information from Firestore
async function loadTeamData(teamId) {
    try {
        const teamDoc = await db.collection('teams').doc(teamId).get();
        
        if (teamDoc.exists) {
            currentTeamData = { id: teamDoc.id, ...teamDoc.data() };
            console.log('Team data loaded:', currentTeamData);
        } else {
            throw new Error(`Team ${teamId} not found`);
        }
    } catch (error) {
        console.error('Error loading team data:', error);
        throw error;
    }
}

// Load team roster (players assigned to this team)
async function loadTeamRoster(teamId) {
    try {
        // Get all participants assigned to this team
        const participantsSnapshot = await db.collection('participants')
            .where('teamId', '==', teamId)
            .orderBy('name', 'asc')
            .get();
        
        currentTeamRoster = [];
        participantsSnapshot.forEach((doc) => {
            currentTeamRoster.push({ id: doc.id, ...doc.data() });
        });
        
        console.log('Team roster loaded:', currentTeamRoster);
        
    } catch (error) {
        console.error('Error loading team roster:', error);
        // Fallback - roster might be stored in team document
        currentTeamRoster = currentTeamData?.players || [];
    }
}

// Load existing lineups for this team
async function loadTeamLineups(teamId) {
    try {
        const lineupsSnapshot = await db.collection('lineups')
            .where('teamId', '==', teamId)
            .get();
        
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
    
    if (!currentTeamData || currentTeamRoster.length === 0) {
        container.innerHTML = `
            <p style="text-align: center; color: #666; margin: 40px 0;">
                Team roster will be displayed here once teams are assigned.
            </p>
        `;
        return;
    }
    
    const teamName = currentTeamData.name || `Team ${currentTeamData.teamId}`;
    
    container.innerHTML = `
        <div class="team-header">
            <h4>${teamName}</h4>
            <p>Season Record: ${currentTeamData.wins || 0} - ${currentTeamData.losses || 0}</p>
        </div>
        
        <div class="roster-grid">
            ${currentTeamRoster.map(player => `
                <div class="player-card">
                    <div class="player-info">
                        <span class="player-name">${player.name}</span>
                        ${player.teamCaptain ? '<span class="captain-badge">CAPTAIN</span>' : ''}
                    </div>
                    <div class="player-stats">
                        <span>Games: ${player.gamesPlayed || 0}</span>
                        <span>Avg: ${player.average || 'N/A'}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// ===== LINEUP MANAGEMENT =====

// Render lineup management section
function renderLineupManagement() {
    const container = document.getElementById('lineup-container');
    if (!container) return;
    
    if (!currentTeamData || currentTeamRoster.length === 0) {
        container.innerHTML = `
            <p style="text-align: center; color: #666; margin: 40px 0;">
                Lineup management will be available here during the season.
            </p>
        `;
        return;
    }
    
    // Get upcoming weeks (this will be more sophisticated later)
    const upcomingWeeks = getUpcomingWeeks();
    
    container.innerHTML = `
        <div class="lineup-controls">
            <div class="week-selector">
                <label for="week-select">Select Week:</label>
                <select id="week-select" onchange="loadWeekLineup()">
                    <option value="">Choose a week...</option>
                    ${upcomingWeeks.map(week => `
                        <option value="${week.number}">Week ${week.number} - ${week.date}</option>
                    `).join('')}
                </select>
            </div>
        </div>
        
        <div id="lineup-editor" style="display: none;">
            <!-- Lineup editor will be populated when week is selected -->
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
    
    if (!selectedWeek) {
        document.getElementById('lineup-editor').style.display = 'none';
        return;
    }
    
    renderLineupEditor(selectedWeek);
    document.getElementById('lineup-editor').style.display = 'block';
}

// Render lineup editor for specific week
function renderLineupEditor(weekNumber) {
    const container = document.getElementById('lineup-editor');
    if (!container) return;
    
    const existingLineup = currentLineup[weekNumber] || {};
    const selectedPlayers = existingLineup.players || [];
    
    container.innerHTML = `
        <div class="lineup-week-header">
            <h4>Week ${weekNumber} Lineup</h4>
            <p>Select 4 players to play this week (2 will sit out)</p>
        </div>
        
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
    `;
    
    updateLineupSelection(); // Update initial state
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
    
    // Disable unchecked checkboxes if 4 are selected
    checkboxes.forEach(checkbox => {
        if (!checkbox.checked && selectedCount >= 4) {
            checkbox.disabled = true;
        } else {
            checkbox.disabled = false;
        }
    });
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
            teamId: currentTeamData.id,
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
        
        showTeamSuccess(`Week ${weekNumber} lineup saved successfully!`);
        
    } catch (error) {
        console.error('Error saving lineup:', error);
        showTeamError('Failed to save lineup. Please try again.');
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