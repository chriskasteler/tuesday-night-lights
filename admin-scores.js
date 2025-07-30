// Admin Score Entry JavaScript - Score entry functionality
// Handles weekly scorecard display and score entry for admins

// ===== SCORE DATA =====
let allTeamsData = {}; // Store all teams for name mapping
let currentWeekScores = {};
let selectedWeek = null;

// ===== INITIALIZATION =====

// Load all teams from Firestore for name mapping
async function loadAllTeamsForScoring() {
    try {
        console.log('Loading all teams for scoring name mapping...');
        const teamsSnapshot = await db.collection('teams').get();
        
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
            
            console.log(`Score entry team mapping: "${defaultName}" -> "${actualName}"`);
        });
        
        console.log('All teams loaded for scoring:', allTeamsData);
        
    } catch (error) {
        console.error('Error loading all teams for scoring:', error);
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
function getActualTeamNameForScoring(scheduleTeamName) {
    return allTeamsData[scheduleTeamName] || scheduleTeamName;
}

// ===== SCORE ENTRY FUNCTIONS =====

// Test function to verify script loading
console.log('Admin-scores.js loaded successfully');

// Load week scorecards when week is selected (global function for HTML onclick)
async function loadWeekScorecards(weekNumber) {
    if (!weekNumber) {
        document.getElementById('admin-scorecards-container').innerHTML = `
            <p style="text-align: center; color: #666; margin: 40px 0; font-style: italic;">
                Select a week to view and enter match scores
            </p>
        `;
        return;
    }
    
    try {
        selectedWeek = weekNumber;
        console.log(`Loading scorecards for Week ${weekNumber}`);
        
        // Load teams if not already loaded
        if (Object.keys(allTeamsData).length === 0) {
            await loadAllTeamsForScoring();
        }
        
        // Render scorecards for this week
        renderWeekScorecards(weekNumber);
        
    } catch (error) {
        console.error('Error loading week scorecards:', error);
        document.getElementById('admin-scorecards-container').innerHTML = `
            <p style="text-align: center; color: #dc3545; margin: 40px 0;">
                Error loading scorecards. Please try again.
            </p>
        `;
    }
}

// Make function globally available
window.loadWeekScorecards = loadWeekScorecards;

// Render scorecards for the selected week
function renderWeekScorecards(weekNumber) {
    const container = document.getElementById('admin-scorecards-container');
    
    // Same schedule structure as Captain's Tools
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
    
    const weekMatches = leagueSchedule[weekNumber];
    if (!weekMatches) {
        container.innerHTML = `
            <p style="text-align: center; color: #dc3545; margin: 40px 0;">
                No matches found for Week ${weekNumber}
            </p>
        `;
        return;
    }
    
    // Group matches by teams
    const matchGroups = {};
    weekMatches.forEach(match => {
        const key = `${match.team1}_vs_${match.team2}`;
        if (!matchGroups[key]) {
            matchGroups[key] = [];
        }
        matchGroups[key].push(match);
    });
    
    // Render all match groups
    container.innerHTML = Object.values(matchGroups).map(matches => {
        const team1 = matches[0].team1;
        const team2 = matches[0].team2;
        const format = matches[0].format;
        
        return `
            <div class="match-group" style="margin-bottom: 40px;">
                <h4 style="text-align: center; color: #2d4a2d; margin-bottom: 20px;">
                    ${getActualTeamNameForScoring(team1)} vs ${getActualTeamNameForScoring(team2)} - ${format}
                </h4>
                
                ${matches.map(match => `
                    <div class="admin-scorecard" style="margin-bottom: 30px; border: 2px solid #2d4a2d; border-radius: 8px; overflow: hidden;">
                        <div class="scorecard-header" style="background: #2d4a2d; color: white; padding: 12px; text-align: center;">
                            <span class="match-title">Match ${match.match}</span>
                        </div>
                        
                        <div class="golf-scorecard-mini">
                            <table class="scorecard-table" style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr class="holes-row">
                                        <th class="player-col" style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa;">Player</th>
                                        <th style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa;">1</th>
                                        <th style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa;">2</th>
                                        <th style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa;">3</th>
                                        <th style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa;">4</th>
                                        <th style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa;">5</th>
                                        <th style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa;">6</th>
                                        <th style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa;">7</th>
                                        <th style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa;">8</th>
                                        <th style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa;">9</th>
                                        <th class="total-col" style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa;">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr class="player-row">
                                        <td class="player-name" style="padding: 8px; border: 1px solid #ddd; font-weight: 600;">
                                            ${getActualTeamNameForScoring(match.team1)} Player ${match.match === 1 ? 'A' : 'C'}
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #f0f0f0;">0</td>
                                    </tr>
                                    <tr class="player-row">
                                        <td class="player-name" style="padding: 8px; border: 1px solid #ddd; font-weight: 600;">
                                            ${getActualTeamNameForScoring(match.team1)} Player ${match.match === 1 ? 'B' : 'D'}
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #f0f0f0;">0</td>
                                    </tr>
                                    <tr class="team-score-row" style="background: #e8f5e8;">
                                        <td class="team-score-label" style="padding: 8px; border: 1px solid #ddd; font-weight: 600; color: #2d4a2d;">
                                            ${getActualTeamNameForScoring(match.team1)} Team Score
                                        </td>
                                        <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                                        <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                                        <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                                        <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                                        <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                                        <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                                        <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                                        <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                                        <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                                        <td class="team-total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #d4edda;">-</td>
                                    </tr>
                                    <tr style="height: 10px;"><td colspan="11" style="border: none;"></td></tr>
                                    <tr class="player-row">
                                        <td class="player-name" style="padding: 8px; border: 1px solid #ddd; font-weight: 600;">
                                            ${getActualTeamNameForScoring(match.team2)} Player ${match.match === 1 ? 'A' : 'C'}
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #f0f0f0;">0</td>
                                    </tr>
                                    <tr class="player-row">
                                        <td class="player-name" style="padding: 8px; border: 1px solid #ddd; font-weight: 600;">
                                            ${getActualTeamNameForScoring(match.team2)} Player ${match.match === 1 ? 'B' : 'D'}
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="score-input-cell" style="padding: 4px; border: 1px solid #ddd;">
                                            <input type="number" class="score-input" min="1" max="15" style="width: 100%; border: none; text-align: center; padding: 4px;">
                                        </td>
                                        <td class="total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #f0f0f0;">0</td>
                                    </tr>
                                    <tr class="team-score-row" style="background: #e8f5e8;">
                                        <td class="team-score-label" style="padding: 8px; border: 1px solid #ddd; font-weight: 600; color: #2d4a2d;">
                                            ${getActualTeamNameForScoring(match.team2)} Team Score
                                        </td>
                                        <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                                        <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                                        <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                                        <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                                        <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                                        <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                                        <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                                        <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                                        <td class="team-score-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">-</td>
                                        <td class="team-total-cell" style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; background: #d4edda;">-</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }).join('');
}

// Initialize admin scoring when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Auto-load teams when admin tools are accessed
    if (document.getElementById('admin-enter-scores')) {
        loadAllTeamsForScoring();
    }
}); 