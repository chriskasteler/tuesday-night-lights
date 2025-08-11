// Database Migration Script: Flat Structure → Nested Structure
// Run this in browser console to migrate Braemar Highland League data

// Configuration
const CLUB_ID = 'braemar-country-club';
const LEAGUE_ID = 'braemar-highland-league';
const SEASON_ID = '2025';

// Database paths
const NEW_PATHS = {
    club: `clubs/${CLUB_ID}`,
    league: `clubs/${CLUB_ID}/leagues/${LEAGUE_ID}`,
    season: `clubs/${CLUB_ID}/leagues/${LEAGUE_ID}/seasons/${SEASON_ID}`,
    participants: `clubs/${CLUB_ID}/leagues/${LEAGUE_ID}/seasons/${SEASON_ID}/participants`,
    teams: `clubs/${CLUB_ID}/leagues/${LEAGUE_ID}/seasons/${SEASON_ID}/teams`,
    scorecards: `clubs/${CLUB_ID}/leagues/${LEAGUE_ID}/seasons/${SEASON_ID}/scorecards`,
    weekScorecards: `clubs/${CLUB_ID}/leagues/${LEAGUE_ID}/seasons/${SEASON_ID}/weekScorecards`,
    lineups: `clubs/${CLUB_ID}/leagues/${LEAGUE_ID}/seasons/${SEASON_ID}/lineups`,
    settings: `clubs/${CLUB_ID}/leagues/${LEAGUE_ID}/seasons/${SEASON_ID}/settings`,
    requests: `clubs/${CLUB_ID}/leagues/${LEAGUE_ID}/seasons/${SEASON_ID}/requests`
};

// Migration functions
async function migrateBraemarLeague() {
    console.log('🚀 Starting Braemar Highland League Database Migration...');
    
    try {
        // Step 1: Create club/league/season structure
        await createClubStructure();
        
        // Step 2: Migrate participants to both users and new participants location
        await migrateParticipants();
        
        // Step 3: Migrate all other collections
        await migrateTeams();
        await migrateScorecards();
        await migrateWeekScorecards();
        await migrateLineups();
        await migrateSettings();
        await migrateRequests();
        
        // Step 4: Verify migration
        await verifyMigration();
        
        console.log('✅ Migration completed successfully!');
        console.log('🔄 Now update your code to use the new database paths.');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

async function createClubStructure() {
    console.log('📁 Creating club/league/season structure...');
    
    // Create club document
    await db.collection('clubs').doc(CLUB_ID).set({
        name: 'Braemar Country Club',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'active'
    });
    
    // Create league document
    await db.doc(`${NEW_PATHS.club}/leagues/${LEAGUE_ID}`).set({
        name: 'Braemar Highland League',
        clubId: CLUB_ID,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'active'
    });
    
    // Create season document
    await db.doc(`${NEW_PATHS.league}/seasons/${SEASON_ID}`).set({
        year: 2025,
        name: '2025 Season',
        clubId: CLUB_ID,
        leagueId: LEAGUE_ID,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'active',
        startDate: '2025-01-01',
        endDate: '2025-12-31'
    });
    
    console.log('✅ Club structure created');
}

async function migrateParticipants() {
    console.log('👥 Migrating participants...');
    
    const participantsSnapshot = await db.collection('participants').get();
    const batch = db.batch();
    let userCount = 0;
    let participantCount = 0;
    
    for (const doc of participantsSnapshot.docs) {
        const data = doc.data();
        const participantId = doc.id;
        
        // 1. Add to global users collection (if not already there)
        const globalUserRef = db.collection('users').doc(participantId);
        const existingUser = await globalUserRef.get();
        
        if (!existingUser.exists) {
            batch.set(globalUserRef, {
                email: data.email,
                name: data.name,
                phone: data.phone || '',
                clubs: [CLUB_ID], // Array of clubs they belong to
                createdAt: data.timestamp ? new Date(data.timestamp) : firebase.firestore.FieldValue.serverTimestamp(),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
            userCount++;
        } else {
            // User exists, add this club to their clubs array
            const userData = existingUser.data();
            const clubs = userData.clubs || [];
            if (!clubs.includes(CLUB_ID)) {
                clubs.push(CLUB_ID);
                batch.update(globalUserRef, { 
                    clubs: clubs,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }
        
        // 2. Add to season-specific participants collection
        const seasonParticipantRef = db.doc(`${NEW_PATHS.participants}/${participantId}`);
        batch.set(seasonParticipantRef, {
            userId: participantId, // Reference to global user
            email: data.email,
            name: data.name,
            phone: data.phone || '',
            teamCaptain: data.teamCaptain || false,
            teamId: data.teamId || null,
            status: data.status || 'active',
            joinedAt: data.timestamp ? new Date(data.timestamp) : firebase.firestore.FieldValue.serverTimestamp(),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        participantCount++;
    }
    
    await batch.commit();
    console.log(`✅ Migrated ${userCount} new users and ${participantCount} participants`);
}

async function migrateTeams() {
    console.log('🏆 Migrating teams...');
    
    const teamsSnapshot = await db.collection('teams').get();
    const batch = db.batch();
    
    teamsSnapshot.forEach(doc => {
        const data = doc.data();
        const newRef = db.doc(`${NEW_PATHS.teams}/${doc.id}`);
        
        batch.set(newRef, {
            ...data,
            clubId: CLUB_ID,
            leagueId: LEAGUE_ID,
            seasonId: SEASON_ID,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    });
    
    await batch.commit();
    console.log(`✅ Migrated ${teamsSnapshot.size} teams`);
}

async function migrateScorecards() {
    console.log('📋 Migrating scorecards...');
    
    const scorecardsSnapshot = await db.collection('scorecards').get();
    const batch = db.batch();
    
    scorecardsSnapshot.forEach(doc => {
        const data = doc.data();
        const newRef = db.doc(`${NEW_PATHS.scorecards}/${doc.id}`);
        
        batch.set(newRef, {
            ...data,
            clubId: CLUB_ID,
            leagueId: LEAGUE_ID,
            seasonId: SEASON_ID,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    });
    
    await batch.commit();
    console.log(`✅ Migrated ${scorecardsSnapshot.size} scorecards`);
}

async function migrateWeekScorecards() {
    console.log('📅 Migrating week scorecards...');
    
    const weekScorecardsSnapshot = await db.collection('weekScorecards').get();
    const batch = db.batch();
    
    weekScorecardsSnapshot.forEach(doc => {
        const data = doc.data();
        const newRef = db.doc(`${NEW_PATHS.weekScorecards}/${doc.id}`);
        
        batch.set(newRef, {
            ...data,
            clubId: CLUB_ID,
            leagueId: LEAGUE_ID,
            seasonId: SEASON_ID,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    });
    
    await batch.commit();
    console.log(`✅ Migrated ${weekScorecardsSnapshot.size} week scorecards`);
}

async function migrateLineups() {
    console.log('📝 Migrating lineups...');
    
    const lineupsSnapshot = await db.collection('lineups').get();
    const batch = db.batch();
    
    lineupsSnapshot.forEach(doc => {
        const data = doc.data();
        const newRef = db.doc(`${NEW_PATHS.lineups}/${doc.id}`);
        
        batch.set(newRef, {
            ...data,
            clubId: CLUB_ID,
            leagueId: LEAGUE_ID,
            seasonId: SEASON_ID,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    });
    
    await batch.commit();
    console.log(`✅ Migrated ${lineupsSnapshot.size} lineups`);
}

async function migrateSettings() {
    console.log('⚙️ Migrating settings...');
    
    const settingsSnapshot = await db.collection('settings').get();
    const batch = db.batch();
    
    settingsSnapshot.forEach(doc => {
        const data = doc.data();
        const newRef = db.doc(`${NEW_PATHS.settings}/${doc.id}`);
        
        batch.set(newRef, {
            ...data,
            clubId: CLUB_ID,
            leagueId: LEAGUE_ID,
            seasonId: SEASON_ID,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    });
    
    await batch.commit();
    console.log(`✅ Migrated ${settingsSnapshot.size} settings`);
}

async function migrateRequests() {
    console.log('📨 Migrating requests...');
    
    const requestsSnapshot = await db.collection('requests').get();
    const batch = db.batch();
    
    requestsSnapshot.forEach(doc => {
        const data = doc.data();
        const newRef = db.doc(`${NEW_PATHS.requests}/${doc.id}`);
        
        batch.set(newRef, {
            ...data,
            clubId: CLUB_ID,
            leagueId: LEAGUE_ID,
            seasonId: SEASON_ID,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    });
    
    await batch.commit();
    console.log(`✅ Migrated ${requestsSnapshot.size} requests`);
}

async function verifyMigration() {
    console.log('🔍 Verifying migration...');
    
    // Check if new structure exists
    const clubDoc = await db.collection('clubs').doc(CLUB_ID).get();
    const leagueDoc = await db.doc(`${NEW_PATHS.league}`).get();
    const seasonDoc = await db.doc(`${NEW_PATHS.season}`).get();
    
    if (!clubDoc.exists || !leagueDoc.exists || !seasonDoc.exists) {
        throw new Error('Club/League/Season structure not created properly');
    }
    
    // Count documents in new locations
    const newParticipants = await db.collection(NEW_PATHS.participants).get();
    const newTeams = await db.collection(NEW_PATHS.teams).get();
    const globalUsers = await db.collection('users').get();
    
    console.log('📊 Migration Results:');
    console.log(`   Global Users: ${globalUsers.size}`);
    console.log(`   Season Participants: ${newParticipants.size}`);
    console.log(`   Teams: ${newTeams.size}`);
    
    if (newParticipants.empty || newTeams.empty) {
        throw new Error('Migration verification failed - missing data');
    }
    
    console.log('✅ Migration verification passed');
}

// Export the migration function
window.migrateBraemarLeague = migrateBraemarLeague;
window.NEW_PATHS = NEW_PATHS;

console.log('🔧 Migration script loaded. Run migrateBraemarLeague() to start migration.');
