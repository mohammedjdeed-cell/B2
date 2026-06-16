// 1. Initialize Firebase (Replace with your actual web-app config from Firebase Console)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null; // Will track the logged-in user state

// 2. Monitor Auth State
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-controls').classList.add('hidden');
        document.getElementById('user-info').classList.remove('hidden');
        
        // Show user's friendly name based on their email address
        const name = user.email.includes('mohammed') ? "Mohammed Jdeed" : "Mai Hasan";
        document.getElementById('current-user-name').textContent = `Workspace: ${name}`;
        
        // Reload topics with user modifications from Firestore
        await loadTopics();
    } else {
        currentUser = null;
        document.getElementById('auth-controls').classList.remove('hidden');
        document.getElementById('user-info').classList.add('hidden');
        document.getElementById('current-user-name').textContent = "Not signed in";
        
        // Fall back to default topics if not signed in
        await loadTopics();
    }
});

// 3. Auth Event Handlers
document.getElementById('btn-login').onclick = async () => {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (err) {
        alert("Authentication failed: " + err.message);
    }
};

document.getElementById('btn-logout').onclick = () => {
    auth.signOut();
};

// 4. Cloud-Aware Load Function
async function loadTopics() {
    try {
        // Step A: Load the static JSON topics database first
        const response = await fetch('topics.json');
        if (!response.ok) throw new Error('Could not load topics.json');
        let baseTopics = await response.json();

        // Step B: Overlay user edits from Firestore if they are logged in
        if (currentUser) {
            const snapshot = await db.collection('users')
                                       .doc(currentUser.uid)
                                       .collection('edited_topics')
                                       .get();
            
            snapshot.forEach(doc => {
                const updatedTopic = doc.data();
                const index = baseTopics.findIndex(t => t.id === parseInt(doc.id));
                if (index !== -1) {
                    // Merge modified fields into the baseline object
                    baseTopics[index] = { ...baseTopics[index], ...updatedTopic };
                }
            });
            showResetButton();
        }

        TOPICS_DATA = baseTopics;
        renderSidebar();
        renderActiveTopic();
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

// 5. Cloud-Aware Save Function
async function saveEdits() {
    if (!currentUser) {
        // Fallback to local storage if user is offline/not logged in
        localStorage.setItem('edited_topics_data_1_52', JSON.stringify(TOPICS_DATA));
        renderSidebar();
        return;
    }

    const activeTopic = TOPICS_DATA[activeIdx];
    try {
        // Save the currently modified topic directly under the current user's document path
        await db.collection('users')
                .doc(currentUser.uid)
                .collection('edited_topics')
                .doc(activeTopic.id.toString())
                .set(activeTopic);
        
        showResetButton();
        renderSidebar();
    } catch (err) {
        console.error("Error saving to cloud database:", err);
    }
}

// 6. Cloud-Aware Reset Function
document.getElementById('reset-edits-btn').onclick = async () => {
    if (confirm("Would you like to discard all modifications for this topic and restore the baseline data?")) {
        if (currentUser) {
            const activeTopic = TOPICS_DATA[activeIdx];
            try {
                // Delete the specific customized document from Firestore
                await db.collection('users')
                        .doc(currentUser.uid)
                        .collection('edited_topics')
                        .doc(activeTopic.id.toString())
                        .delete();
            } catch (err) {
                console.error("Error resetting topic edits:", err);
            }
        } else {
            localStorage.removeItem('edited_topics_data_1_52');
        }
        await loadTopics();
    }
};