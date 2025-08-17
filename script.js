// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAiV_FnNeRxgzx1ZPMIJeGeZ1TInSIHMc8",
    authDomain: "highland-league.firebaseapp.com",
    projectId: "highland-league",
    storageBucket: "highland-league.firebasestorage.app",
    messagingSenderId: "524421750763",
    appId: "1:524421750763:web:f13044cd6318ca1fe943ae"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Admin email - change this to your email
const ADMIN_EMAIL = 'chris.kasteler@me.com';

// Initialize EmailJS
emailjs.init('vLntllpJOaRGyqN-E');

// ===== USER ROLES SYSTEM =====

// Initialize user in users collection with role
async function initializeUserRole(user) {
    try {
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            // Determine user roles (can have multiple)
            let roles = ['guest']; // default role array
            let teamId = null;
            
            if (user.email === ADMIN_EMAIL) {
                roles = ['admin']; // Admin gets admin role
                // Future: Admin can also be captain of a specific team
                // roles.push('captain');
                // teamId = 'team1'; // Admin's team
            }
            // Future: Add captain email checks here
            // if (captainEmails.includes(user.email)) {
            //     roles.push('captain');
            //     teamId = getCaptainTeamId(user.email);
            // }
            
            // Create user document
            await userRef.set({
                email: user.email,
                roles: roles, // Array of roles instead of single role
                teamId: teamId,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            });
            
            console.log(`User roles initialized: ${user.email} -> ${roles.join(', ')}`);
        } else {
            // Update last login
            await userRef.update({
                lastLogin: new Date().toISOString()
            });
            
            const userData = userDoc.data();
            const userRoles = userData.roles || [userData.role || 'guest']; // Handle both old and new format
            console.log(`User roles detected: ${user.email} -> ${userRoles.join(', ')}`);
        }
        
        return userDoc.exists ? userDoc.data() : null;
    } catch (error) {
        console.error('Error initializing user role:', error);
        return null;
    }
}

// Fix email mismatch for current user
async function fixCurrentUserEmail() {
    const user = firebase.auth().currentUser;
    if (!user) {
        console.log('No user logged in');
        return;
    }
    
    try {
        // Find participant record with gmail.com email
        const participantsSnapshot = await db.collection('participants')
            .where('email', '==', 'chris.kasteler@gmail.com')
            .get();
        
        if (!participantsSnapshot.empty) {
            const participantDoc = participantsSnapshot.docs[0];
            console.log('Found participant with gmail.com email:', participantDoc.data());
            
            // Update to use the correct me.com email
            await participantDoc.ref.update({
                email: user.email, // This will be chris.kasteler@me.com
                lastUpdated: new Date().toISOString()
            });
            
            console.log(`Updated participant email from gmail.com to ${user.email}`);
            return true;
        } else {
            console.log('No participant found with gmail.com email');
            return false;
        }
        
    } catch (error) {
        console.error('Error fixing email:', error);
        return false;
    }
}

// Debug function to check current user info
async function debugCurrentUser() {
    const user = firebase.auth().currentUser;
    if (!user) {
        console.log('No user logged in');
        return;
    }
    
    console.log('=== USER DEBUG INFO ===');
    console.log('Auth email:', user.email);
    console.log('Auth UID:', user.uid);
    
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            console.log('Firestore user data:', userDoc.data());
        } else {
            console.log('No Firestore user document found');
        }
        
        // Also search by email to see if there are duplicates
        const emailSearch = await db.collection('users').where('email', '==', user.email).get();
        console.log('Users found by email search:', emailSearch.size);
        emailSearch.forEach(doc => {
            console.log('Email search result:', doc.id, doc.data());
        });
        
    } catch (error) {
        console.error('Error getting user data:', error);
    }
}

// Assign captain role to a user
async function assignCaptainRole(userEmail, teamId) {
    try {
        console.log(`Looking for user with email: "${userEmail}"`);
        
        // Find user by email (case-insensitive search)
        const usersSnapshot = await db.collection('users').get();
        let foundUser = null;
        
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.email && userData.email.toLowerCase() === userEmail.toLowerCase()) {
                foundUser = { id: doc.id, ...userData };
                console.log('Found matching user:', foundUser);
            }
        });
        
        if (!foundUser) {
            // Try exact match as fallback
            const exactMatch = await db.collection('users').where('email', '==', userEmail).get();
            if (!exactMatch.empty) {
                const doc = exactMatch.docs[0];
                foundUser = { id: doc.id, ...doc.data() };
                console.log('Found user with exact match:', foundUser);
            }
        }
        
        if (!foundUser) {
            console.error('User not found:', userEmail);
            // List all users for debugging
            const allUsersSnapshot = await db.collection('users').get();
            console.log('All users in database:');
            allUsersSnapshot.forEach(doc => {
                const data = doc.data();
                console.log(`- Email: "${data.email}", UID: ${doc.id}`);
            });
            return false;
        }
        
        const currentRoles = foundUser.roles || [foundUser.role || 'guest'];
        
        // Add captain role if not already present
        if (!currentRoles.includes('captain')) {
            currentRoles.push('captain');
        }
        
        // Update user with captain role (no teamId in global users)
        const userRef = db.collection('users').doc(foundUser.id);
        await userRef.update({
            roles: currentRoles,
            lastUpdated: new Date().toISOString()
        });
        
        console.log(`Assigned captain role: ${userEmail} -> Team ${teamId}`);
        
        // ALSO update the participant record to include teamId
        console.log(`Looking for participant record with email: ${userEmail}`);
        const participantsSnapshot = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/participants')
            .where('email', '==', userEmail)
            .get();
        
        if (!participantsSnapshot.empty) {
            // Update participant record with teamId and set teamCaptain to true
            const participantDoc = participantsSnapshot.docs[0];
            await participantDoc.ref.update({
                teamId: teamId,
                teamCaptain: true,
                lastUpdated: new Date().toISOString()
            });
            console.log(`Updated participant record: ${userEmail} -> Team ${teamId} (set as captain)`);
        } else {
            console.log(`No participant record found for ${userEmail} - they may not be in participants collection yet`);
        }
        
        // If this is the current user, refresh their roles immediately
        const currentUser = firebase.auth().currentUser;
        if (currentUser && currentUser.email.toLowerCase() === userEmail.toLowerCase()) {
            await refreshCurrentUserRoles();
        }
        
        return true;
    } catch (error) {
        console.error('Error assigning captain role:', error);
        return false;
    }
}

// Refresh current user's roles without logging out
async function refreshCurrentUserRoles() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    
    try {
        console.log('Refreshing user roles...');
        const userData = await initializeUserRole(user);
        
        // Clear existing role classes
        document.body.classList.remove('admin-logged-in', 'captain-logged-in');
        
        const userRoles = userData?.roles || [userData?.role || 'guest'];
        
        let buttonText = 'Logout';
        let isAdmin = false;
        let isCaptain = false;
        
        if (userRoles.includes('admin')) {
            document.body.classList.add('admin-logged-in');
            isAdmin = true;
            console.log('Admin role detected');
        }
        if (userRoles.includes('captain')) {
            document.body.classList.add('captain-logged-in');
            isCaptain = true;
            console.log('Captain role detected - team:', userData?.teamId || 'not assigned');
        }
        
        // Set button text based on roles
        if (isAdmin && isCaptain) { buttonText = 'Logout'; }
        else if (isAdmin) { buttonText = 'Admin Logout'; }
        else if (isCaptain) { buttonText = 'Captain Logout'; }
        
        document.getElementById('admin-login-btn').textContent = buttonText;
        
        console.log('User roles refreshed successfully');
        console.log('Current user email in auth:', user.email);
        console.log('User data from Firestore:', userData);
        
    } catch (error) {
        console.error('Error refreshing user roles:', error);
    }
}

// Mailchimp configuration
const MAILCHIMP_CONFIG = {
    apiKey: 'YOUR_MAILCHIMP_API_KEY', // Replace with your actual API key
    audienceId: 'YOUR_AUDIENCE_ID',   // Replace with your actual audience ID
    serverPrefix: 'us21'              // Replace with your server prefix (check your Mailchimp URL)
};

// Navigation functionality
function showSection(sectionName) {
    // Hide all content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionName + '-section').classList.add('active');
    
    // Add active class to clicked nav link (if event exists)
    if (event && event.target && event.target.classList) {
        event.target.classList.add('active');
    } else {
        // Find and activate the correct nav link
        const navLink = document.querySelector(`[onclick="showSection('${sectionName}')"]`);
        if (navLink) {
            navLink.classList.add('active');
        }
    }
    
    // Show/hide hero section - countdown permanently hidden
    const heroSection = document.querySelector('.hero');
    const countdownSection = document.querySelector('.countdown-container');
    
    if (sectionName === 'info') {
        if (heroSection) heroSection.style.display = 'block';
        // Countdown permanently hidden - draft is over
        if (countdownSection) countdownSection.style.display = 'none !important';
    } else {
        if (heroSection) heroSection.style.display = 'none';
        // Countdown permanently hidden - draft is over
        if (countdownSection) countdownSection.style.display = 'none !important';
    }
    
    // Initialize specific sections
    if (sectionName === 'my-team') {
        // Check if this is a Super Admin impersonation - if so, skip auto-initialization
        const user = firebase.auth().currentUser;
        const isSuperAdminImpersonation = user && user.email === 'chris.kasteler@me.com' && 
                                          typeof superAdminData !== 'undefined' && 
                                          superAdminData.currentContext && 
                                          superAdminData.currentContext.role === 'captain';
                                          
        if (isSuperAdminImpersonation) {
            console.log('🔄 Skipping auto-initialization - Super Admin impersonation active');
            // Super Admin will handle initialization manually with selected team
        } else {
            initializeMyTeamSection(); // Captain's Tools for regular users
        }
    } else if (sectionName === 'manage-teams') {
        // Restore admin sub-section when admin tools is activated
        restoreAdminSubSection();
    } else if (sectionName === 'super-admin') {
        console.log('📍 SHOW SECTION: super-admin triggered');
        if (typeof initializeSuperAdmin === 'function') {
            console.log('✅ initializeSuperAdmin function found, calling...');
            initializeSuperAdmin(); // Super Admin Dashboard
        } else {
            console.error('❌ initializeSuperAdmin function not found! Type:', typeof initializeSuperAdmin);
        }
    }
    
    // Update mobile page title
    updateMobilePageTitle(sectionName);
    
    // Close mobile menu if it's open
    closeMobileMenu();
    
    // Save current section to localStorage for page refresh persistence
    localStorage.setItem('currentSection', sectionName);
    
    // Scroll to top of page
    window.scrollTo(0, 0);
    
    // Hide loading overlay if it's still visible (edge case)
    hideLoadingOverlay();
}

// Show admin sub-section
function showAdminSubSection(subSectionName) {
    // Hide all admin sub-sections
    document.querySelectorAll('.admin-sub-section').forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });
    
    // Remove active class from all admin sub-nav buttons
    document.querySelectorAll('.admin-sub-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected sub-section
    const targetSection = document.getElementById(`admin-${subSectionName}`);
    if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.classList.add('active');
    }
    
    // Add active class to clicked button
    const activeButton = document.querySelector(`[data-section="${subSectionName}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // Load data for specific sections
    if (subSectionName === 'scorecard-setup') {
        console.log('🎯 ADMIN SUB-SECTION: scorecard-setup selected');
        // Load scorecards when switching to scorecard setup
        if (typeof loadScorecards === 'function') {
            console.log('🎯 ADMIN SUB-SECTION: loadScorecards function found, calling...');
            loadScorecards();
        } else {
            console.error('❌ ADMIN SUB-SECTION: loadScorecards function not found! Type:', typeof loadScorecards);
        }
    }
    
    // Save current admin sub-section to localStorage
    localStorage.setItem('currentAdminSubSection', subSectionName);
    
    console.log(`Switched to admin sub-section: ${subSectionName}`);
}

// Restore admin sub-section on page refresh
function restoreAdminSubSection() {
    const savedSubSection = localStorage.getItem('currentAdminSubSection');
    
    // Only restore if we're on the admin tools page
    const adminSection = document.getElementById('manage-teams-section');
    if (adminSection && adminSection.classList.contains('active')) {
        if (savedSubSection) {
            showAdminSubSection(savedSubSection);
        } else {
            // Default to manage-teams if no saved state
            showAdminSubSection('manage-teams');
        }
    }
}

// Restore the last viewed section on page refresh
function restoreCurrentSection() {
    const savedSection = localStorage.getItem('currentSection');
    
    // If we have a saved section, restore it
    if (savedSection && savedSection !== 'info') {
        // Check if the section element exists
        const sectionElement = document.getElementById(savedSection + '-section');
        if (sectionElement) {
            // Call showSection without event (it will handle missing event)
            showSection(savedSection);
            console.log(`Restored section: ${savedSection}`);
        }
    } else {
        // Default to info section and scroll to top
        window.scrollTo(0, 0);
    }
    
    // Hide the loading overlay after restoration is complete
    hideLoadingOverlay();
    
    // Also restore admin sub-section if we're on admin tools
    restoreAdminSubSection();
}

// Hide the loading overlay with a smooth transition
function hideLoadingOverlay() {
    const overlay = document.getElementById('page-loading-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        // Remove the overlay from DOM after transition completes
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
    }
}

// Fallback to hide loading overlay after maximum time
setTimeout(() => {
    hideLoadingOverlay();
}, 2000); // Hide after 2 seconds regardless

// Show Captain's Tools loading state
function showMyTeamLoading() {
    const loadingOverlay = document.getElementById('my-team-loading');
    const content = document.getElementById('my-team-content');
    
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    if (content) content.style.display = 'none';
}

// Hide Captain's Tools loading state
function hideMyTeamLoading() {
    const loadingOverlay = document.getElementById('my-team-loading');
    const content = document.getElementById('my-team-content');
    
    if (loadingOverlay) loadingOverlay.style.display = 'none';
    if (content) content.style.display = 'block';
}

// Initialize Captain's Tools section for captains
async function initializeMyTeamSection() {
    // Show loading immediately
    showMyTeamLoading();
    
    const user = firebase.auth().currentUser;
    if (!user) {
        console.log('No user logged in for Captain\'s Tools');
        hideMyTeamLoading();
        return;
    }
    
    try {
        // Get user data to find their team
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            const userRoles = userData.roles || [userData.role || 'guest'];
            
            if (userRoles.includes('captain') && userData.teamId) {
                // User is a captain with assigned team
                await initializeMyTeam(user.uid, String(userData.teamId));
            } else {
                console.log('User is not a captain or has no team assigned');
                // Show message that team assignment is pending
                showTeamAssignmentPending();
                hideMyTeamLoading();
            }
        }
    } catch (error) {
        console.error('Error initializing Captain\'s Tools section:', error);
        hideMyTeamLoading();
    }
}

// Show message when team assignment is pending
function showTeamAssignmentPending() {
    const rosterContainer = document.getElementById('team-roster-container');
    const lineupContainer = document.getElementById('lineup-container');
    
    const pendingMessage = `
        <div style="text-align: center; padding: 40px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #856404; margin-bottom: 10px;">Team Assignment Pending</h4>
            <p style="color: #856404; margin: 0;">You will be able to manage your team once teams are finalized and you are assigned as a captain.</p>
        </div>
    `;
    
    if (rosterContainer) {
        rosterContainer.innerHTML = pendingMessage;
    }
    
    if (lineupContainer) {
        lineupContainer.innerHTML = `
            <p style="text-align: center; color: #666; margin: 40px 0;">
                Lineup management will be available once your team is assigned.
            </p>
        `;
    }
}

// Update mobile page title
function updateMobilePageTitle(sectionName) {
    const titleElement = document.getElementById('mobile-page-title');
    if (!titleElement) return;
    
    const titles = {
        'info': 'Home',
        'participants': 'Players', 
        'teams': 'Teams',
        'schedule': 'Schedule',
        'standings': 'Standings',
        'manage-teams': 'Admin Tools',
        'my-team': 'Captain\'s Tools'
    };
    
    titleElement.textContent = titles[sectionName] || 'Home';
}

// Mobile menu functionality
function toggleMobileMenu() {
    const navList = document.getElementById('nav-list');
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    
    navList.classList.toggle('mobile-open');
    menuToggle.classList.toggle('active');
}

function closeMobileMenu() {
    const navList = document.getElementById('nav-list');
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    
    navList.classList.remove('mobile-open');
    menuToggle.classList.remove('active');
}

let signedUpPlayers = [];

// Load participants from Firebase
function loadParticipants() {
    dbHelper.collection('participants').orderBy('joinedAt', 'asc').onSnapshot((snapshot) => {
        signedUpPlayers = [];
        snapshot.forEach((doc) => {
            signedUpPlayers.push({ id: doc.id, ...doc.data() });
        });
        
        // Update participants list
        updateParticipantsList();
    });
}

// Function to format names properly (Title Case)
function formatName(name) {
    return name.trim()
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

document.getElementById('signupForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    // Get the submit button and show loading state
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Submitting...';
    submitButton.disabled = true;

    const formData = {
        name: formatName(document.getElementById('name').value),
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        teamCaptain: document.getElementById('teamCaptain').checked,
        timestamp: new Date().toISOString(),
        status: 'pending'
    };

    try {
        // Check if email already exists in participants or requests
        const existingParticipant = await dbHelper.collection('participants').where('email', '==', formData.email).get();
        const existingRequest = await dbHelper.collection('requests').where('email', '==', formData.email).get();
        
        if (!existingParticipant.empty) {
            alert('This email address is already registered in the league!');
            submitButton.textContent = originalText;
            submitButton.disabled = false;
            return;
        }
        
        if (!existingRequest.empty) {
            alert('You already have a pending request. Please wait for approval.');
            submitButton.textContent = originalText;
            submitButton.disabled = false;
            return;
        }

        // Add request to Firestore
        await dbHelper.collection('requests').add(formData);
    
        // Send email notification to admin
        await sendRequestNotification(formData);
    
        // Show popup alert
        alert('Request Submitted\n\nSpace is extremely limited. You will receive an email if you have secured a spot in this year\'s league.');
        
        // Reset form
        document.getElementById('signupForm').reset();

        console.log('Request submitted:', formData);
        
    } catch (error) {
        console.error('Error submitting request:', error);
        alert('There was an error submitting your request. Please try again.');
    } finally {
        // Restore button state
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
});

// Send admin notification via EmailJS + add user to Mailchimp for future automations
async function sendRequestNotification(requestData) {
    try {
        // 1. Send EmailJS admin notification
        const templateParams = {
            user_name: requestData.name,
            user_email: requestData.email,
            user_phone: requestData.phone,
            team_captain: requestData.teamCaptain ? 'Yes' : 'No',
            request_time: new Date(requestData.timestamp).toLocaleString(),
            message_type: 'New membership request'
        };

        await emailjs.send('service_t1yivr7', 'template_f5aievt', templateParams);
        console.log('Admin notification sent via EmailJS');

        // 2. Add user to Mailchimp for future automations
        const response = await fetch('/.netlify/functions/add-to-mailchimp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: requestData.name,
                email: requestData.email,
                phone: requestData.phone,
                handicap: requestData.handicap,
                teamCaptain: requestData.teamCaptain,
                timestamp: requestData.timestamp
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('User added to Mailchimp successfully:', result.message);
        } else {
            console.log('Mailchimp add failed, but EmailJS notification sent');
        }

    } catch (error) {
        console.error('Error in notification process:', error);
        // Don't show error to user - request still succeeded
    }
}

// Remove participant (admin only)
async function removeParticipant(participantId, participantName) {
    if (!confirm(`Are you sure you want to remove ${participantName} from the league? This action cannot be undone.`)) {
        return;
    }
    
    try {
        // Delete from Firebase
        await db.collection('participants').doc(participantId).delete();
        
        console.log(`Participant removed: ${participantName}`);
        
        // Show success message (reusing the signup success message area)
        const successMessage = document.getElementById('successMessage');
        if (successMessage) {
            successMessage.textContent = `${participantName} has been removed from the league.`;
            successMessage.style.display = 'block';
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                successMessage.style.display = 'none';
            }, 3000);
        }
        
        // The loadParticipants() listener will automatically update the display
        
    } catch (error) {
        console.error('Error removing participant:', error);
        alert('There was an error removing the participant. Please try again.');
    }
}

// Update participants list - sorted alphabetically
function updateParticipantsList() {
    const participantsList = document.getElementById('participants-list');
    if (signedUpPlayers.length === 0) {
        participantsList.innerHTML = `
            <p style="text-align: center; color: #666; margin: 40px 0;">
                No players registered yet. Be the first to sign up!
            </p>
        `;
    } else {
        // Sort players alphabetically by name
        const sortedPlayers = [...signedUpPlayers].sort((a, b) => 
            a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        );
        
        participantsList.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 30px;">
                ${sortedPlayers.map((player, index) => `
                    <div style="background: #f8f9f8; padding: 15px; border-left: 4px solid #4a5d4a; transition: transform 0.2s ease;" 
                         onmouseover="this.style.transform='translateY(-2px)'" 
                         onmouseout="this.style.transform='translateY(0)'">
                        <h4 style="margin: 0 0 5px 0; color: #1e3a1e; font-weight: 600; display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center;">
                                ${player.name}

                            </div>
                            <button class="admin-only remove-player-btn" onclick="removeParticipant('${player.id}', '${player.name.replace(/'/g, "\\'")}') " 
                                    style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 0.75rem; cursor: pointer; display: none;">
                                Remove
                            </button>
                        </h4>
                        <p style="margin: 0; font-size: 0.9rem; color: #666; line-height: 1.4;">
                            Registered: ${new Date(player.timestamp).toLocaleDateString()}
                        </p>
                    </div>
                `).join('')}
            </div>

        `;
    }
}

// Phone number formatting function
function formatPhoneNumber(value) {
    // Remove all non-digit characters
    const phoneNumber = value.replace(/\D/g, '');
    
    // Format based on length
    if (phoneNumber.length < 4) {
        return phoneNumber;
    } else if (phoneNumber.length < 7) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    } else {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
    }
}

// Countdown timer functionality
function updateCountdown() {
    // Set target date: Tuesday, August 12th, 2025 at 6:00 PM
    const targetDate = new Date('2025-08-12T18:00:00').getTime();
    const now = new Date().getTime();
    const timeLeft = targetDate - now;

    if (timeLeft > 0) {
        // Calculate time units
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        // Update display
        document.getElementById('days').textContent = days.toString().padStart(2, '0');
        document.getElementById('hours').textContent = hours.toString().padStart(2, '0');
        document.getElementById('minutes').textContent = minutes.toString().padStart(2, '0');
        document.getElementById('seconds').textContent = seconds.toString().padStart(2, '0');
    } else {
        // Countdown finished
        document.getElementById('days').textContent = '00';
        document.getElementById('hours').textContent = '00';
        document.getElementById('minutes').textContent = '00';
        document.getElementById('seconds').textContent = '00';
        
        // Update the title
        document.querySelector('.countdown-container h2').innerHTML = 'DRAFT DAY IS HERE!';
    }
}

// Add some hover effects and animations
document.addEventListener('DOMContentLoaded', function() {
    // Countdown timer disabled - draft is over
    // updateCountdown();
    // setInterval(updateCountdown, 1000);
    
    // Load participants for public signup page (no auth required)
    loadParticipants();
    
    // Add hover effect to info cards
    const infoCards = document.querySelectorAll('.info-card');
    infoCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px)';
            this.style.boxShadow = '0 8px 20px rgba(74, 93, 74, 0.15)';
            this.style.transition = 'all 0.3s ease';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none';
        });
    });

    // Add phone number formatting
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            const formatted = formatPhoneNumber(e.target.value);
            e.target.value = formatted;
        });
        
        // Prevent non-numeric input except for backspace, delete, tab, etc.
        phoneInput.addEventListener('keydown', function(e) {
            // Allow backspace, delete, tab, escape, enter
            if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
                // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                (e.keyCode === 65 && e.ctrlKey === true) ||
                (e.keyCode === 67 && e.ctrlKey === true) ||
                (e.keyCode === 86 && e.ctrlKey === true) ||
                (e.keyCode === 88 && e.ctrlKey === true)) {
                return;
            }
            // Ensure that it's a number and stop the keypress
            if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                e.preventDefault();
            }
        });
    }
});

// Scorecard functionality
let currentMatch = null;

async function openScorecard(matchId, team1, team2, format) {
    console.log('🎯 SCORECARD: Opening scorecard for', matchId, team1, team2, format);
    console.log('🎯 SCORECARD: Current user state:', firebase.auth().currentUser?.email);
    console.log('🎯 SCORECARD: Global team names:', globalTeamNames);
    
    try {
        // Convert team names from "Team 1" format to actual team names
        const actualTeam1 = globalTeamNames[team1] || team1;
        const actualTeam2 = globalTeamNames[team2] || team2;
    
    currentMatch = {
        id: matchId,
        team1: actualTeam1,
        team2: actualTeam2,
        format: format
    };
    
    // Update modal content with actual team names
    document.getElementById('scorecard-teams').textContent = `${actualTeam1} vs ${actualTeam2}`;
    document.getElementById('scorecard-format').textContent = format;
    document.getElementById('match-title').textContent = 'Match 1';
    document.getElementById('match2-title').textContent = 'Match 2';
    
    // Update format labels based on the game type
    let formatLabel = 'Team Score';
    if (format.includes('Four-Ball') || format.includes('Best Ball')) {
        formatLabel = 'Best Ball';
    } else if (format.includes('Alternate Shot')) {
        formatLabel = 'Alternate Shot';
    } else if (format.includes('Scramble')) {
        formatLabel = 'Scramble';
    } else if (format.includes('High-Low')) {
        formatLabel = 'High-Low';
    } else if (format.includes('Combined')) {
        formatLabel = 'Combined Score';
    }
    
    // Update format labels for both matches
    document.getElementById('team1-format-label').textContent = `${team1} ${formatLabel}`;
    document.getElementById('team2-format-label').textContent = `${team2} ${formatLabel}`;
    document.getElementById('team1-format-label2').textContent = `${team1} ${formatLabel}`;
    document.getElementById('team2-format-label2').textContent = `${team2} ${formatLabel}`;
    
    // Update player names dynamically with actual lineup data
    try {
        await updateScorecardWithLineupData(matchId, team1, team2, actualTeam1, actualTeam2);
    } catch (error) {
        console.log('Error loading lineup data, using generic names:', error);
        
        // Fallback to generic names if lineup data not available
        const playerNames = document.querySelectorAll('.player-name');
        const statusLabels = document.querySelectorAll('.match-status-label');
        
        if (playerNames.length >= 8) {
            playerNames[0].textContent = `${actualTeam1} Player 1`;
            playerNames[1].textContent = `${actualTeam1} Player 2`;
            playerNames[2].textContent = `${actualTeam2} Player 1`;
            playerNames[3].textContent = `${actualTeam2} Player 2`;
            playerNames[4].textContent = `${actualTeam1} Player 3`;
            playerNames[5].textContent = `${actualTeam1} Player 4`;
            playerNames[6].textContent = `${actualTeam2} Player 3`;
            playerNames[7].textContent = `${actualTeam2} Player 4`;
        }
        
        if (statusLabels.length >= 4) {
            statusLabels[0].textContent = `${actualTeam1} Status`;
            statusLabels[1].textContent = `${actualTeam2} Status`;
            statusLabels[2].textContent = `${actualTeam1} Status`;
            statusLabels[3].textContent = `${actualTeam2} Status`;
        }
    }
    
    // Show placeholder scores (read-only)
    document.getElementById('match-winner').textContent = 'Scores not yet entered';
    
        // Show modal
        console.log('🎯 SCORECARD: About to show modal...');
        const modal = document.getElementById('scorecard-modal');
        console.log('🎯 SCORECARD: Modal element found:', modal);
        
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            console.log('🎯 SCORECARD: Modal should now be visible');
        } else {
            console.error('❌ SCORECARD: Modal element not found!');
        }
        
    } catch (error) {
        console.error('💥 SCORECARD: Error opening scorecard:', error);
        console.error('Stack trace:', error.stack);
    }
}

function closeScorecard() {
    document.getElementById('scorecard-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
    currentMatch = null;
}

// Update scorecard with actual lineup data from database
async function updateScorecardWithLineupData(matchId, team1, team2, actualTeam1, actualTeam2) {
    try {
        console.log('🎯 LINEUP DATA: Loading lineup data for scorecard', matchId);
        
        // Extract week and match index from matchId (e.g., "week1-match1" -> week=1, matchIndex=0)
        const weekMatch = matchId.match(/week(\d+)-match(\d+)/);
        if (!weekMatch) {
            throw new Error('Could not parse week and match from matchId');
        }
        
        const week = weekMatch[1];
        const matchIndex = parseInt(weekMatch[2]) - 1; // Convert to 0-based index
        
        console.log(`🎯 LINEUP DATA: Parsed week=${week}, matchIndex=${matchIndex}`);
        
        // Load lineup data from weeklyLineups collection
        const lineupDoc = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/weeklyLineups')
            .doc(`week-${week}`).get();
        
        if (!lineupDoc.exists) {
            throw new Error(`No lineup data found for week ${week}`);
        }
        
        const lineupData = lineupDoc.data();
        const matchupField = `matchup${matchIndex}`;
        const matchupLineup = lineupData[matchupField];
        
        if (!matchupLineup) {
            throw new Error(`No lineup data found for ${matchupField} in week ${week}`);
        }
        
        console.log(`🎯 LINEUP DATA: Found lineup data:`, matchupLineup);
        
        // Update player names in the scorecard
        const playerNames = document.querySelectorAll('.player-name');
        const statusLabels = document.querySelectorAll('.match-status-label');
        
        if (playerNames.length >= 8) {
            // Match 1 players
            const team1Match1Players = matchupLineup.match1.team1Players || [];
            const team2Match1Players = matchupLineup.match1.team2Players || [];
            
            // Match 2 players  
            const team1Match2Players = matchupLineup.match2.team1Players || [];
            const team2Match2Players = matchupLineup.match2.team2Players || [];
            
            // Update scorecard player names - order: Team1P1, Team1P2, Team2P1, Team2P2, Team1P3, Team1P4, Team2P3, Team2P4
            playerNames[0].textContent = team1Match1Players[0]?.name || `${actualTeam1} Player 1`;
            playerNames[1].textContent = team1Match1Players[1]?.name || `${actualTeam1} Player 2`;
            playerNames[2].textContent = team2Match1Players[0]?.name || `${actualTeam2} Player 1`;
            playerNames[3].textContent = team2Match1Players[1]?.name || `${actualTeam2} Player 2`;
            playerNames[4].textContent = team1Match2Players[0]?.name || `${actualTeam1} Player 3`;
            playerNames[5].textContent = team1Match2Players[1]?.name || `${actualTeam1} Player 4`;
            playerNames[6].textContent = team2Match2Players[0]?.name || `${actualTeam2} Player 3`;
            playerNames[7].textContent = team2Match2Players[1]?.name || `${actualTeam2} Player 4`;
            
            console.log('🎯 LINEUP DATA: Updated scorecard with actual player names');
        }
        
        // Update status labels with actual team names
        if (statusLabels.length >= 4) {
            statusLabels[0].textContent = `${actualTeam1} Status`;
            statusLabels[1].textContent = `${actualTeam2} Status`;
            statusLabels[2].textContent = `${actualTeam1} Status`;
            statusLabels[3].textContent = `${actualTeam2} Status`;
        }
        
    } catch (error) {
        console.error('❌ LINEUP DATA: Error loading lineup data:', error);
        throw error; // Re-throw to trigger fallback in openScorecard
    }
}

// Note: Scorecard is now read-only for regular users
// Score entry will be handled through admin interface

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('scorecard-modal');
    if (event.target === modal) {
        closeScorecard();
    }
});

// ===== ADMIN AUTHENTICATION =====

// Firebase Auth state listener
auth.onAuthStateChanged(async user => {
    if (user) {
        // Initialize user role in Firestore and get user data
        const userData = await initializeUserRole(user);
        
        // Clear all role classes first
        document.body.classList.remove('admin-logged-in', 'captain-logged-in');
        
        // Get user roles (handle both new array format and old single role format)
        const userRoles = userData?.roles || [userData?.role || 'guest'];
        
        // Apply CSS classes based on roles
        let buttonText = 'Logout';
        let isAdmin = false;
        let isCaptain = false;
        let isSuperAdmin = false;
        
        // Check for Super Admin (your specific email)
        if (user.email === 'chris.kasteler@me.com') {
            document.body.classList.add('admin-logged-in', 'super-admin-logged-in');
            isAdmin = true;
            isSuperAdmin = true;
            console.log('Super Admin logged in:', user.email);
        } else if (userRoles.includes('admin')) {
            document.body.classList.add('admin-logged-in');
            isAdmin = true;
            console.log('Admin logged in:', user.email);
        }
        
        if (userRoles.includes('captain')) {
            document.body.classList.add('captain-logged-in');
            isCaptain = true;
            console.log('Captain logged in:', user.email, userData?.teamId ? `(Team: ${userData.teamId})` : '');
        }
        
        // Set button text based on roles
        if (isSuperAdmin) {
            buttonText = 'Super Admin Logout';
        } else if (isAdmin && isCaptain) {
            buttonText = 'Logout'; // Both admin and captain
        } else if (isAdmin) {
            buttonText = 'Admin Logout'; // Admin only
        } else if (isCaptain) {
            buttonText = 'Captain Logout'; // Captain only  
        } else {
            buttonText = 'Logout'; // Regular user
            console.log('User logged in:', user.email);
        }
        
        // Update button
        document.getElementById('admin-login-btn').textContent = buttonText;
        document.getElementById('admin-login-btn').onclick = adminLogout;
        
        // Initialize admin tools AFTER authentication is confirmed
        if (isAdmin && document.getElementById('teams-grid')) {
            initializeManageTeams();
            loadPendingRequests();
        }
        
    } else {
        // No user logged in - show login option
        document.body.classList.remove('admin-logged-in', 'captain-logged-in');
        document.getElementById('admin-login-btn').textContent = 'Captain & Admin Login';
        document.getElementById('admin-login-btn').onclick = showAdminLogin;
        console.log('No user logged in');
    }
    
    // Restore the current section after auth state is determined
    restoreCurrentSection();
});

// Show admin login modal
function showAdminLogin() {
    document.getElementById('admin-login-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Clear form
    document.getElementById('admin-email').value = '';
    document.getElementById('admin-password').value = '';
    document.getElementById('login-error').style.display = 'none';
}

// Close admin login modal
function closeAdminLogin() {
    document.getElementById('admin-login-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Admin login form submission
document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    const errorDiv = document.getElementById('login-error');
    
    try {
        // Sign in with Firebase Auth
        await auth.signInWithEmailAndPassword(email, password);
        
        // Close modal on successful login
        closeAdminLogin();
        
    } catch (error) {
        console.error('Login error:', error);
        
        // Show error message
        let errorMessage = 'Login failed. Please try again.';
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email address.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed attempts. Please try again later.';
        }
        
        errorDiv.textContent = errorMessage;
        errorDiv.style.display = 'block';
    }
});

// Admin logout
function adminLogout() {
    auth.signOut().then(() => {
        console.log('Admin logged out');
    }).catch((error) => {
        console.error('Logout error:', error);
    });
}

// ===== TEAM LOADING =====

// Global team name mapping for scorecard and other functions
let globalTeamNames = {};

// Update team names in the schedule section
function updateScheduleTeamNames(teamsSnapshot) {
    try {
        console.log('Updating schedule team names...');
        
        // Show schedule loading overlay
        const scheduleLoadingOverlay = document.getElementById('schedule-loading');
        const scheduleContent = document.getElementById('schedule-content');
        
        if (scheduleLoadingOverlay) {
            scheduleLoadingOverlay.style.display = 'flex';
            console.log('Schedule loading overlay made visible');
        }
        
        // Create mapping of team numbers to actual team names
        const teamNames = {};
        teamsSnapshot.forEach(doc => {
            const team = doc.data();
            if (team.teamId && team.teamName) {
                teamNames[team.teamId] = team.teamName;
                // Also store in global mapping for scorecard use
                globalTeamNames[`Team ${team.teamId}`] = team.teamName;
            }
        });
        
        console.log('Team name mapping:', teamNames);
        console.log('Global team names mapping:', globalTeamNames);
        
        // Find all team-name elements in the schedule section only
        const scheduleSection = document.getElementById('schedule-section');
        if (!scheduleSection) {
            console.log('Schedule section not found');
            return;
        }
        
        const teamNameElements = scheduleSection.querySelectorAll('.team-name');
        let updatesCount = 0;
        
        teamNameElements.forEach(element => {
            const currentText = element.textContent.trim();
            
            // Match patterns like "Team 1", "Team 2", etc.
            const match = currentText.match(/^Team (\d+)$/);
            if (match) {
                const teamNumber = parseInt(match[1]);
                if (teamNames[teamNumber]) {
                    element.textContent = teamNames[teamNumber];
                    updatesCount++;
                    console.log(`Updated: "${currentText}" → "${teamNames[teamNumber]}"`);
                }
            }
        });
        
        console.log(`✅ Updated ${updatesCount} team names in schedule`);
        
        // Hide schedule loading overlay and show content after a short delay
        setTimeout(() => {
            if (scheduleLoadingOverlay) {
                scheduleLoadingOverlay.style.display = 'none';
            }
            if (scheduleContent) {
                scheduleContent.style.display = 'block';
                console.log('Schedule content made visible');
            }
        }, 500); // Show loading for at least 500ms
        
    } catch (error) {
        console.error('Error updating schedule team names:', error);
        
        // Hide loading overlay even on error
        const scheduleLoadingOverlay = document.getElementById('schedule-loading');
        const scheduleContent = document.getElementById('schedule-content');
        
        if (scheduleLoadingOverlay) {
            scheduleLoadingOverlay.style.display = 'none';
        }
        if (scheduleContent) {
            scheduleContent.style.display = 'block';
        }
    }
}

// Update team names in the standings section
function updateStandingsTeamNames(teamsSnapshot) {
    try {
        console.log('Updating standings team names...');
        
        // Show standings loading overlay
        const standingsLoadingOverlay = document.getElementById('standings-loading');
        const standingsContent = document.getElementById('standings-content');
        
        if (standingsLoadingOverlay) {
            standingsLoadingOverlay.style.display = 'flex';
            console.log('Standings loading overlay made visible');
        }
        
        // Create mapping of team numbers to actual team names
        const teamNames = {};
        teamsSnapshot.forEach(doc => {
            const team = doc.data();
            if (team.teamId && team.teamName) {
                teamNames[team.teamId] = team.teamName;
                // Also store in global mapping for consistency
                globalTeamNames[`Team ${team.teamId}`] = team.teamName;
            }
        });
        
        console.log('Team name mapping for standings:', teamNames);
        
        // Find all team name cells in the standings table
        const standingsSection = document.getElementById('standings-section');
        if (!standingsSection) {
            console.log('Standings section not found');
            return;
        }
        
        // Find all table cells that contain team names (2nd column in standings table)
        const tableRows = standingsSection.querySelectorAll('.standings-table tbody tr');
        let updatesCount = 0;
        
        tableRows.forEach((row, index) => {
            const teamCell = row.cells[1]; // Team name is in the 2nd column (index 1)
            if (teamCell) {
                const currentText = teamCell.textContent.trim();
                
                // Match patterns like "Team 1", "Team 2", etc.
                const match = currentText.match(/^Team (\d+)$/);
                if (match) {
                    const teamNumber = parseInt(match[1]);
                    if (teamNames[teamNumber]) {
                        teamCell.textContent = teamNames[teamNumber];
                        updatesCount++;
                        console.log(`Updated standings: "${currentText}" → "${teamNames[teamNumber]}"`);
                    }
                }
            }
        });
        
        console.log(`✅ Updated ${updatesCount} team names in standings`);
        
        // Hide standings loading overlay and show content after a short delay
        setTimeout(() => {
            if (standingsLoadingOverlay) {
                standingsLoadingOverlay.style.display = 'none';
            }
            if (standingsContent) {
                standingsContent.style.display = 'block';
                console.log('Standings content made visible');
            }
        }, 500); // Show loading for at least 500ms
        
    } catch (error) {
        console.error('Error updating standings team names:', error);
        
        // Hide loading overlay even on error
        const standingsLoadingOverlay = document.getElementById('standings-loading');
        const standingsContent = document.getElementById('standings-content');
        
        if (standingsLoadingOverlay) {
            standingsLoadingOverlay.style.display = 'none';
        }
        if (standingsContent) {
            standingsContent.style.display = 'block';
        }
    }
}

// Load and display teams from the new database structure
async function loadAndDisplayTeams() {
    try {
        console.log('Loading teams from new database structure...');
        
        // Debug: Check if loading elements exist
        const loadingOverlay = document.getElementById('teams-loading');
        const teamsContent = document.getElementById('teams-content');
        console.log('Loading overlay found:', !!loadingOverlay);
        console.log('Teams content found:', !!teamsContent);
        
        // Ensure loading overlay is visible
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
            console.log('Loading overlay made visible');
        }
        
        // Load teams from new nested structure
        const teamsSnapshot = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/teams')
            .orderBy('teamId', 'asc')
            .get();
        
        if (teamsSnapshot.empty) {
            console.log('No teams found in new structure');
            return;
        }
        
        // Load participants to get player names
        const participantsSnapshot = await db.collection('clubs/braemar-country-club/leagues/braemar-highland-league/seasons/2025/participants').get();
        const participants = {};
        participantsSnapshot.forEach(doc => {
            participants[doc.id] = doc.data();
        });
        
        const teamsGrid = document.querySelector('#teams-section .teams-grid');
        if (!teamsGrid) {
            console.log('Teams grid not found');
            return;
        }
        
        // Populate global team names mapping
        teamsSnapshot.forEach(doc => {
            const team = doc.data();
            if (team.teamId && team.teamName) {
                globalTeamNames[`Team ${team.teamId}`] = team.teamName;
            }
        });
        console.log('Global team names populated:', globalTeamNames);
        
        // Generate team cards HTML
        const teamCards = [];
        teamsSnapshot.forEach(doc => {
            const team = doc.data();
            const players = team.players || [];
            
            // Get player names
            const teamPlayers = players.map(playerId => {
                const participant = participants[playerId];
                return participant ? participant.name : 'Open Slot';
            });
            
            // Ensure we have 6 slots
            while (teamPlayers.length < 6) {
                teamPlayers.push('Open Slot');
            }
            
            // Create team card HTML
            teamCards.push(`
                <div class="team-card">
                    <h3 class="team-name">${team.teamName || `Team ${team.teamId}`}</h3>
                    <div class="team-players">
                        ${teamPlayers.map((playerName, index) => {
                            const isCaptain = index === 0 && team.captain;
                            return `<div class="player-slot ${isCaptain ? 'captain-slot' : ''}">${playerName}${isCaptain ? ' (Captain)' : ''}</div>`;
                        }).join('')}
                    </div>
                </div>
            `);
        });
        
        // Update the teams grid
        teamsGrid.innerHTML = teamCards.join('');
        
        // Hide loading overlay and show teams content
        // (loadingOverlay and teamsContent already declared above)
        
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        if (teamsContent) {
            teamsContent.style.display = 'block';
        }
        
        console.log(`✅ Successfully loaded ${teamCards.length} teams`);
        
        // Update schedule team names
        updateScheduleTeamNames(teamsSnapshot);
        
        // Update standings team names
        updateStandingsTeamNames(teamsSnapshot);
        
    } catch (error) {
        console.error('Error loading teams:', error);
        
        // Hide loading overlay even on error and show fallback content
        // (reuse loadingOverlay and teamsContent from above)
        
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        if (teamsContent) {
            teamsContent.style.display = 'block';
        }
    }
}

// Initialize team loading when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Load teams after a short delay to ensure Firebase is initialized
    setTimeout(async function() {
        const startTime = Date.now();
        
        await loadAndDisplayTeams();
        
        // Ensure loading shows for at least 800ms so user can see it
        const elapsed = Date.now() - startTime;
        if (elapsed < 800) {
            setTimeout(() => {
                // This ensures smooth transition timing
            }, 800 - elapsed);
        }
    }, 1000);
});

// Close admin modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('admin-login-modal');
    if (event.target === modal) {
        closeAdminLogin();
    }
});