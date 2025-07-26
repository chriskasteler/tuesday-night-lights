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

// Initialize EmailJS
emailjs.init('vLntllpJOaRGyqN-E');

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
    
    // Add active class to clicked nav link
    event.target.classList.add('active');
}

let signedUpPlayers = [];
let spotsRemaining = 36;

// Load participants from Firebase
function loadParticipants() {
    db.collection('participants').orderBy('timestamp', 'asc').onSnapshot((snapshot) => {
        signedUpPlayers = [];
        snapshot.forEach((doc) => {
            signedUpPlayers.push({ id: doc.id, ...doc.data() });
        });
        
        // Update spots remaining
        spotsRemaining = 36 - signedUpPlayers.length;
        document.getElementById('spotsRemaining').textContent = spotsRemaining;
        
        // Update participants list
        updateParticipantsList();
        
        // Update signup section if full
        if (spotsRemaining <= 0) {
            document.querySelector('.spots-remaining').innerHTML = `
                <span class="spots-number" style="color: #dc3545;">FULL</span>
                <span>League is Full!</span>
                <p style="margin-top: 10px; font-size: 0.9rem; color: #dc3545;">
                    <strong>Contact organizer for waitlist</strong>
                </p>
            `;
            document.getElementById('signupForm').innerHTML = `
                <div style="text-align: center; padding: 20px; background: #f8d7da; color: #721c24;">
                    <h3>Registration Closed</h3>
                    <p>The league has reached capacity with 36 players.</p>
                </div>
            `;
        }
    });
}

document.getElementById('signupForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (spotsRemaining <= 0) {
        alert('Sorry, the league is full! Please contact the organizer to be added to the waitlist.');
        return;
    }

    const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        teamCaptain: document.getElementById('teamCaptain').checked,
        timestamp: new Date().toISOString()
    };

    try {
    // Check if email already exists
        const existingUser = await db.collection('participants').where('email', '==', formData.email).get();
        if (!existingUser.empty) {
        alert('This email address is already registered!');
        return;
    }

        // Add player to Firestore
        await db.collection('participants').add(formData);
    
        // Send email notification
        await sendEmailNotification(formData);
    
    // Show success message
    document.getElementById('successMessage').style.display = 'block';
    
    // Reset form
    document.getElementById('signupForm').reset();
    
    // Scroll to success message
    document.getElementById('successMessage').scrollIntoView({ behavior: 'smooth' });
    
    // Hide success message after 5 seconds
    setTimeout(() => {
        document.getElementById('successMessage').style.display = 'none';
    }, 5000);

        console.log('Player registered:', formData);
        
    } catch (error) {
        console.error('Error adding participant:', error);
        alert('There was an error submitting your registration. Please try again.');
    }
});

// Send email notification for new registration
async function sendEmailNotification(playerData) {
    try {
        const templateParams = {
            user_name: playerData.name,
            user_email: playerData.email,
            user_phone: playerData.phone,
            team_captain: playerData.teamCaptain ? 'Yes' : 'No',
            registration_time: new Date(playerData.timestamp).toLocaleString(),
            total_registrations: signedUpPlayers.length + 1
        };

        await emailjs.send('service_t1yivr7', 'template_f5aievt', templateParams);
        console.log('Email notification sent successfully');
    } catch (error) {
        console.error('Failed to send email notification:', error);
        // Don't show error to user - registration still succeeded
    }
}

// Update participants list - sorted alphabetically
function updateParticipantsList() {
    const participantsList = document.getElementById('participants-list');
    if (signedUpPlayers.length === 0) {
        participantsList.innerHTML = `
            <p style="text-align: center; color: #666; margin: 40px 0;">
                No participants registered yet. Be the first to sign up!
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
                        <h4 style="margin: 0 0 5px 0; color: #1e3a1e; font-weight: 600; display: flex; align-items: center;">
                            ${player.name}
                            ${player.teamCaptain ? '<span style="background: #2d4a2d; color: white; padding: 2px 6px; font-size: 0.75rem; font-weight: 500; margin-left: 10px;">CAPTAIN</span>' : ''}
                        </h4>
                        <p style="margin: 0; font-size: 0.9rem; color: #666; line-height: 1.4;">
                            Registered: ${new Date(player.timestamp).toLocaleDateString()}
                        </p>
                    </div>
                `).join('')}
            </div>
            <div style="text-align: center; padding: 20px; background: #f8f9f8; border: 2px solid #4a5d4a;">
                <span style="font-size: 1.5rem; font-weight: 700; color: #2d4a2d; display: block; margin-bottom: 5px;">
                    ${signedUpPlayers.length}
                </span>
                <span style="color: #1e3a1e; font-weight: 500;">
                    of 36 players registered
                </span>
                <span style="display: block; margin-top: 5px; color: #4a5d4a; font-size: 0.9rem;">
                    ${36 - signedUpPlayers.length} spots remaining
                </span>
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
    // Set target date: Monday, August 12th, 2025 at 6:00 PM
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
    // Start the countdown timer
    updateCountdown();
    setInterval(updateCountdown, 1000);
    
    // Load participants from Firebase
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