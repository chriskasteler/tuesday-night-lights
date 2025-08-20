// Database Configuration - New Nested Structure
// After migration to clubs/leagues/seasons structure

const DB_CONFIG = {
    // Club/League/Season identifiers
    CLUB_ID: 'braemar-country-club',
    LEAGUE_ID: 'braemar-highland-league', 
    SEASON_ID: '2025',
    
    // Database paths for current season
    get PATHS() {
        const base = `clubs/${this.CLUB_ID}/leagues/${this.LEAGUE_ID}/seasons/${this.SEASON_ID}`;
        return {
            // Global collections (top-level)
            users: 'users', // Global users across all clubs
            clubs: 'clubs',
            
            // Season-specific collections (nested)
            participants: `${base}/participants`,
            teams: `${base}/teams`,
            scorecards: `${base}/scorecards`,
            weekScorecards: `${base}/weekScorecards`,
            lineups: `${base}/lineups`,
            weeklyLineups: `${base}/weeklyLineups`,
            settings: `${base}/settings`,
            requests: `${base}/requests`,
            
            // Club/League/Season documents
            club: `clubs/${this.CLUB_ID}`,
            league: `clubs/${this.CLUB_ID}/leagues/${this.LEAGUE_ID}`,
            season: `${base}`
        };
    }
};

// Helper functions for database access
const dbHelper = {
    // Get a collection reference
    collection(path) {
        return db.collection(DB_CONFIG.PATHS[path] || path);
    },
    
    // Get a document reference  
    doc(path, docId = null) {
        const fullPath = DB_CONFIG.PATHS[path] || path;
        return docId ? db.doc(`${fullPath}/${docId}`) : db.doc(fullPath);
    },
    
    // Batch operations
    batch() {
        return db.batch();
    }
};

// Export for use in other files
window.DB_CONFIG = DB_CONFIG;
window.dbHelper = dbHelper;

console.log('✅ Database configuration loaded with new nested structure');
console.log('📍 Current paths:', DB_CONFIG.PATHS);
