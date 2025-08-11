// Delete Old Root Collections Script
// Run this in browser console to clean up the old flat structure

async function deleteOldCollections() {
    console.log('🗑️ Starting cleanup of old root collections...');
    
    const collectionsToDelete = [
        'participants',  // Now in nested structure
        'teams',        // Now in nested structure  
        'scorecards',   // Now in nested structure
        'weekScorecards', // Now in nested structure
        'lineups',      // Now in nested structure
        'settings',     // Now in nested structure
        'requests'      // Now in nested structure
    ];
    
    // Keep: users (global), clubs (new structure)
    
    for (const collectionName of collectionsToDelete) {
        try {
            console.log(`🗑️ Deleting old ${collectionName} collection...`);
            
            // Get all documents in the collection
            const snapshot = await db.collection(collectionName).get();
            
            if (snapshot.empty) {
                console.log(`✅ ${collectionName} collection already empty`);
                continue;
            }
            
            // Delete in batches of 500 (Firestore limit)
            const batch = db.batch();
            let count = 0;
            
            snapshot.docs.forEach(doc => {
                if (count < 500) {
                    batch.delete(doc.ref);
                    count++;
                }
            });
            
            if (count > 0) {
                await batch.commit();
                console.log(`✅ Deleted ${count} documents from ${collectionName}`);
                
                // If there were 500 documents, there might be more
                if (count === 500) {
                    console.log(`⚠️ ${collectionName} might have more documents. Run script again if needed.`);
                }
            }
            
        } catch (error) {
            console.error(`❌ Error deleting ${collectionName}:`, error);
        }
    }
    
    console.log('🎉 Cleanup completed!');
    console.log('✅ Remaining collections: users (global), clubs (new structure)');
}

// Export for use
window.deleteOldCollections = deleteOldCollections;

console.log('🗑️ Cleanup script loaded. Run deleteOldCollections() to clean up old collections.');
console.log('⚠️ WARNING: This will permanently delete the old root-level collections!');
console.log('✅ Make sure the new nested structure is working properly first.');
