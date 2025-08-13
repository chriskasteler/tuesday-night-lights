// Quick Fix Script - Copy team names from new structure to old structure
// This makes team names visible on the main site after the draft
// Run this in browser console after making team name changes in admin tools

async function fixTeamNames() {
    console.log('🔧 Fixing team names - copying from new structure to old structure...');
    
    try {
        // Load teams from NEW structure (where your changes are saved)
        const newTeamsSnapshot = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/teams').get();
        
        // Load teams from OLD structure (where main site reads from)
        const oldTeamsSnapshot = await db.collection('teams').get();
        
        const batch = db.batch();
        let updatedCount = 0;
        
        console.log(`Found ${newTeamsSnapshot.size} teams in new structure`);
        console.log(`Found ${oldTeamsSnapshot.size} teams in old structure`);
        
        // Create mapping of teamId to team names from new structure
        const newTeamNames = {};
        newTeamsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.teamId && data.teamName) {
                newTeamNames[data.teamId] = data.teamName;
                console.log(`📝 New structure: Team ${data.teamId} = "${data.teamName}"`);
            }
        });
        
        // Update old structure with new team names
        oldTeamsSnapshot.forEach(doc => {
            const data = doc.data();
            const teamId = data.teamId;
            
            if (teamId && newTeamNames[teamId]) {
                const newName = newTeamNames[teamId];
                const currentName = data.teamName;
                
                if (currentName !== newName) {
                    console.log(`🔄 Updating Team ${teamId}: "${currentName}" → "${newName}"`);
                    batch.update(doc.ref, { teamName: newName });
                    updatedCount++;
                }
            }
        });
        
        if (updatedCount > 0) {
            await batch.commit();
            console.log(`✅ Successfully updated ${updatedCount} team names in old structure`);
            console.log('🎉 Team names should now be visible on the main site!');
        } else {
            console.log('ℹ️ No updates needed - team names are already in sync');
        }
        
    } catch (error) {
        console.error('❌ Error fixing team names:', error);
    }
}

// Run the fix
fixTeamNames();
