// Simple Migration Script - All in One
// Copy and paste this ENTIRE script into browser console

async function runSimpleMigration() {
    console.log('🚀 Starting simple migration...');
    
    // Configuration
    const CLUB_ID = 'braemar-country-club';
    const LEAGUE_ID = 'braemar-highland-league';
    const SEASON_ID = '2025';
    
    const basePath = `clubs/${CLUB_ID}/leagues/${LEAGUE_ID}/seasons/${SEASON_ID}`;
    
    try {
        // Step 1: Create club structure
        console.log('📁 Creating club structure...');
        
        await db.collection('clubs').doc(CLUB_ID).set({
            name: 'Braemar Country Club',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'active'
        });
        
        await db.doc(`clubs/${CLUB_ID}/leagues/${LEAGUE_ID}`).set({
            name: 'Braemar Highland League',
            clubId: CLUB_ID,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'active'
        });
        
        await db.doc(`${basePath}`).set({
            year: 2025,
            name: '2025 Season',
            clubId: CLUB_ID,
            leagueId: LEAGUE_ID,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'active'
        });
        
        console.log('✅ Club structure created');
        
        // Step 2: Migrate participants
        console.log('👥 Migrating participants...');
        const participantsSnapshot = await db.collection('participants').get();
        const batch1 = db.batch();
        
        participantsSnapshot.forEach(doc => {
            const data = doc.data();
            
            // Add to global users
            const globalUserRef = db.collection('users').doc(doc.id);
            batch1.set(globalUserRef, {
                email: data.email,
                name: data.name,
                phone: data.phone || '',
                clubs: [CLUB_ID],
                createdAt: data.timestamp ? new Date(data.timestamp) : firebase.firestore.FieldValue.serverTimestamp(),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Add to season participants
            const seasonParticipantRef = db.doc(`${basePath}/participants/${doc.id}`);
            batch1.set(seasonParticipantRef, {
                userId: doc.id,
                email: data.email,
                name: data.name,
                phone: data.phone || '',
                teamCaptain: data.teamCaptain || false,
                teamId: data.teamId || null,
                status: data.status || 'active',
                joinedAt: data.timestamp ? new Date(data.timestamp) : firebase.firestore.FieldValue.serverTimestamp(),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        await batch1.commit();
        console.log(`✅ Migrated ${participantsSnapshot.size} participants`);
        
        // Step 3: Migrate teams
        console.log('🏆 Migrating teams...');
        const teamsSnapshot = await db.collection('teams').get();
        const batch2 = db.batch();
        
        teamsSnapshot.forEach(doc => {
            const data = doc.data();
            const newRef = db.doc(`${basePath}/teams/${doc.id}`);
            
            batch2.set(newRef, {
                ...data,
                clubId: CLUB_ID,
                leagueId: LEAGUE_ID,
                seasonId: SEASON_ID,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        await batch2.commit();
        console.log(`✅ Migrated ${teamsSnapshot.size} teams`);
        
        // Step 4: Migrate other collections
        const collections = ['scorecards', 'weekScorecards', 'lineups', 'settings', 'requests'];
        
        for (const collectionName of collections) {
            console.log(`📋 Migrating ${collectionName}...`);
            const snapshot = await db.collection(collectionName).get();
            
            if (!snapshot.empty) {
                const batch = db.batch();
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const newRef = db.doc(`${basePath}/${collectionName}/${doc.id}`);
                    
                    batch.set(newRef, {
                        ...data,
                        clubId: CLUB_ID,
                        leagueId: LEAGUE_ID,
                        seasonId: SEASON_ID,
                        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
                
                await batch.commit();
                console.log(`✅ Migrated ${snapshot.size} ${collectionName}`);
            } else {
                console.log(`✅ No ${collectionName} to migrate`);
            }
        }
        
        console.log('🎉 Migration completed successfully!');
        console.log('📍 New structure: clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    }
}

// Run it immediately
runSimpleMigration();
