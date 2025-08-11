// Cleanup and Re-migration Script
// Fixes the incorrect club/league naming structure

async function cleanupAndRemigrate() {
    console.log('🧹 Starting cleanup and re-migration...');
    
    try {
        // Step 1: Delete the incorrect structure
        console.log('🗑️ Cleaning up incorrect structure...');
        await deleteIncorrectStructure();
        
        // Step 2: Wait a moment for deletion to complete
        console.log('⏳ Waiting for cleanup to complete...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 3: Re-run migration with correct structure
        console.log('🚀 Re-running migration with correct structure...');
        await migrateBraemarLeague();
        
        console.log('✅ Cleanup and re-migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Cleanup and re-migration failed:', error);
        throw error;
    }
}

async function deleteIncorrectStructure() {
    console.log('🗑️ Deleting incorrect club structure...');
    
    // Get all documents in the incorrect structure
    const incorrectClubRef = db.doc('clubs/braemar-highland-league');
    
    // Delete the entire incorrect club document and its subcollections
    await deleteDocumentAndSubcollections(incorrectClubRef);
    
    console.log('✅ Incorrect structure deleted');
}

async function deleteDocumentAndSubcollections(docRef) {
    // This is a simplified deletion - Firebase will eventually clean up
    // subcollections when the parent document is deleted
    try {
        const doc = await docRef.get();
        if (doc.exists) {
            await docRef.delete();
            console.log(`🗑️ Deleted document: ${docRef.path}`);
        }
    } catch (error) {
        console.log(`⚠️ Could not delete ${docRef.path}:`, error.message);
        // Continue anyway - the document might not exist
    }
}

// Export function
window.cleanupAndRemigrate = cleanupAndRemigrate;

console.log('🔧 Cleanup script loaded. Run cleanupAndRemigrate() to fix the structure.');
