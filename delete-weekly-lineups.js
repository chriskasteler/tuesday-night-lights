// Script to delete all documents in the weeklyLineups collection
// Run this in your browser console while logged into your site

async function deleteWeeklyLineups() {
    try {
        console.log('🗑️ Starting to delete weeklyLineups collection...');
        
        const collectionPath = 'clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/weeklyLineups';
        
        // Get all documents in the collection
        const snapshot = await db.collection(collectionPath).get();
        
        console.log(`Found ${snapshot.size} documents to delete`);
        
        if (snapshot.size === 0) {
            console.log('✅ No documents found - collection is already empty');
            return;
        }
        
        // Create a batch to delete all documents
        const batch = db.batch();
        
        snapshot.docs.forEach(doc => {
            console.log(`Adding ${doc.id} to deletion batch`);
            batch.delete(doc.ref);
        });
        
        // Execute the batch delete
        await batch.commit();
        
        console.log('✅ Successfully deleted all weeklyLineups documents');
        console.log('🎉 You can now start fresh with new lineups!');
        
    } catch (error) {
        console.error('❌ Error deleting weeklyLineups:', error);
    }
}

// Run the deletion
deleteWeeklyLineups();
