// PLACEHOLDER: Create basic game-types collection structure
// Run this once to set up foundation for future development

const gameTypes = [
    {
        id: 'best-ball',
        name: 'Best Ball',
        description: 'Each player plays their own ball, team takes best score per hole',
        status: 'placeholder'
    },
    {
        id: 'alternate-shot',
        name: 'Alternate Shot', 
        description: 'Team alternates shots with same ball',
        status: 'placeholder'
    },
    {
        id: 'scramble',
        name: 'Scramble',
        description: 'All players hit, team picks best shot and all play from there',
        status: 'placeholder'
    },
    {
        id: 'match-play',
        name: 'Match Play',
        description: 'Head-to-head competition by holes won',
        status: 'placeholder'
    }
];

// Add to Firestore
async function createGameTypesPlaceholder() {
    console.log('Creating game-types collection placeholder...');
    
    const batch = db.batch();
    
    gameTypes.forEach(gameType => {
        const ref = db.collection('game-types').doc(gameType.id);
        batch.set(ref, {
            ...gameType,
            createdAt: new Date(),
            note: 'Placeholder for future development - see bigger release roadmap'
        });
    });
    
    await batch.commit();
    console.log('✅ Game types placeholder created');
}

// Run it
createGameTypesPlaceholder();
