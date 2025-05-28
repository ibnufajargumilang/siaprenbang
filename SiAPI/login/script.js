import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";


// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAJ7T0iyJqbPGz4Ms45-UefvXFWBTHyebM", // GANTI DENGAN API KEY ANDA
    authDomain: "realtimechart-c036c.firebaseapp.com",
    databaseURL: "https://realtimechart-c036c-default-rtdb.firebaseio.com",
    projectId: "realtimechart-c036c",
    storageBucket: "realtimechart-c036c.firebasestorage.app",
    messagingSenderId: "542585916954",
    appId: "1:542585916954:web:e821db7141f904ccfbcba3",
    measurementId: "G-JDT4BZKVFE"
};

console.log("Memulai inisialisasi Firebase...");
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app); // Get Firebase Auth instance
const dbRef = ref(db, 'dataPajak'); // Pointing to 'dataPajak' node as per JSON

let allFirebaseData = null; // Global variable to store Firebase data

// Referensi elemen UI Autentikasi
const authButton = document.getElementById('authButton');
const userStatusSpan = document.getElementById('userStatus');
const loginModal = document.getElementById('loginModal');
const closeButton = document.querySelector('.pajak-auth-close-button');
const loginForm = document.getElementById('loginForm');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');
const loginErrorSpan = document.getElementById('loginError');

// Referensi elemen kontainer edit form
const editFormContainer = document.getElementById('editFormContainer');

// Referensi elemen form edit
const editJenisPajakSelector = document.getElementById('editJenisPajakSelector');
const editYearSelector = document.getElementById('editYearSelector');
const editTargetInput = document.getElementById('editTarget');
const editRealisasiSdTahunInput = document.getElementById('editRealisasiSdTahun');
const editRealisasiTahunSebelumnyaInput = document.getElementById('editRealisasiTahunSebelumnya');
const editStatusMessage = document.getElementById('editStatusMessage');

// Helper functions
function showStatusMessage(message, type) {
    if (editStatusMessage) {
        editStatusMessage.textContent = message;
        editStatusMessage.className = `pajak-edit-status-message ${type === 'error' ? 'pajak-auth-status-error' : (type === 'success' ? 'pajak-auth-status-success' : '')}`;
    }
    console.log(`Status (${type}):`, message);
}

function clearStatusMessage() {
    if (editStatusMessage) {
        editStatusMessage.textContent = '';
        editStatusMessage.className = 'pajak-edit-status-message';
    }
    console.log("Pesan status dihapus.");
}

// Update real-time date and time
function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    document.getElementById("datetime").innerText = now.toLocaleDateString('id-ID', options);
}
updateDateTime();
setInterval(updateDateTime, 1000); // Update every second


// Fungsi untuk mengisi selector Jenis Pajak di form edit
function populateEditJenisPajakSelector(data) {
    if (editJenisPajakSelector) {
        editJenisPajakSelector.innerHTML = '<option value="" disabled selected>Pilih Jenis Pajak</option>'; // Default option
        if (data) {
            for (const key in data) {
                if (Object.hasOwnProperty.call(data, key)) {
                    const option = document.createElement('option');
                    option.value = key; // Use Firebase key as value
                    option.textContent = data[key].Jenis_Pajak; // Display Jenis_Pajak name
                    editJenisPajakSelector.appendChild(option);
                }
            }
        }
    }
}

// Fungsi untuk mengatur tahun default pada selector ke tahun saat ini
function setDefaultYearSelector() {
    const currentYear = new Date().getFullYear().toString();
    if (editYearSelector) {
        // Check if the current year exists in options
        let yearFound = false;
        for (let i = 0; i < editYearSelector.options.length; i++) {
            if (editYearSelector.options[i].value === currentYear) {
                editYearSelector.value = currentYear;
                yearFound = true;
                break;
            }
        }
        // If current year is not found, select the last available year
        if (!yearFound && editYearSelector.options.length > 0) {
            editYearSelector.value = editYearSelector.options[editYearSelector.options.length - 1].value;
        }
    }
}

// Fungsi untuk memuat data ke dalam input form edit
function loadDataForEditForm() {
    // Clear inputs first
    editTargetInput.value = '';
    editRealisasiSdTahunInput.value = '';
    editRealisasiTahunSebelumnyaInput.value = '';

    if (!allFirebaseData || !editJenisPajakSelector || !editYearSelector) {
        return; // Exit if data or selectors are not ready
    }

    const selectedJenisPajakKey = editJenisPajakSelector.value;
    const selectedYear = editYearSelector.value;

    // Only proceed if a valid tax type (not default) and year are selected
    if (selectedJenisPajakKey && selectedYear && allFirebaseData[selectedJenisPajakKey]) {
        const dataForPajak = allFirebaseData[selectedJenisPajakKey];
        // Corrected: Access year data directly under the tax type key
        const yearData = dataForPajak[selectedYear];

        if (yearData) {
            editTargetInput.value = yearData.Target || 0;
            editRealisasiSdTahunInput.value = yearData.Realisasi_sd_Tahun || 0;
            editRealisasiTahunSebelumnyaInput.value = yearData.Realisasi_Tahun_Sebelumnya || 0;
        } else {
            // If data for the selected year/tax_type is missing, set to 0
            editTargetInput.value = 0;
            editRealisasiSdTahunInput.value = 0;
            editRealisasiTahunSebelumnyaInput.value = 0;
        }
    }
    // If no tax type is selected (e.g., still "Pilih Jenis Pajak"), inputs will remain empty
}

// Event listener for edit form submission
const editPajakForm = document.getElementById('editPajakForm');
if (editPajakForm) {
    editPajakForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!auth.currentUser) {
            showStatusMessage('Anda harus login untuk menyimpan data.', 'error');
            return;
        }

        const selectedJenisPajakKey = editJenisPajakSelector.value;
        const selectedYear = editYearSelector.value;
        const newTarget = parseFloat(editTargetInput.value);
        const newRealisasiSdTahun = parseFloat(editRealisasiSdTahunInput.value);
        const newRealisasiTahunSebelumnya = parseFloat(editRealisasiTahunSebelumnyaInput.value);

        // Basic validation, including ensuring default option is not selected
        if (!selectedJenisPajakKey || selectedJenisPajakKey === "" || !selectedYear || isNaN(newTarget) || isNaN(newRealisasiSdTahun) || isNaN(newRealisasiTahunSebelumnya)) {
            showStatusMessage('Pastikan semua bidang (Jenis Pajak, Tahun, Target, Realisasi) diisi dengan angka yang valid.', 'error');
            return;
        }

        // Create path for Firebase update
        // Corrected path based on info.json structure
        const dataPath = `dataPajak/${selectedJenisPajakKey}/${selectedYear}`;
        try {
            await update(ref(db, dataPath), {
                Target: newTarget,
                Realisasi_sd_Tahun: newRealisasiSdTahun,
                Realisasi_Tahun_Sebelumnya: newRealisasiTahunSebelumnya
            });
            showStatusMessage('Data berhasil disimpan!', 'success');
            setTimeout(clearStatusMessage, 3000); // Clear message after 3 seconds
        } catch (error) {
            console.error('Error saving data:', error);
            showStatusMessage('Gagal menyimpan data: ' + error.message, 'error');
        }
    });
}

// --- AUTHENTICATION AND DISPLAY LOGIC ---

// Function to show login modal
function showLoginModal() {
    loginModal.style.display = 'flex';
    setTimeout(() => {
        loginModal.classList.add('show');
    }, 10);
    loginEmailInput.value = '';
    loginPasswordInput.value = '';
    loginErrorSpan.textContent = '';
}

// Function to hide login modal
function hideLoginModal() {
    loginModal.classList.remove('show');
    setTimeout(() => {
        loginModal.style.display = 'none';
    }, 300);
}

// Event listener for authentication button (Login/Logout)
if (authButton) {
    authButton.addEventListener('click', () => {
        if (authButton.textContent === 'Login') {
            showLoginModal();
        } else {
            signOut(auth).then(() => {
                console.log('User signed out');
                showStatusMessage('Anda telah logout.', 'success');
            }).catch((error) => {
                console.error('Error signing out:', error);
                showStatusMessage('Gagal logout.', 'error');
            });
        }
    });
}

// Event listener for modal close button
if (closeButton) {
    closeButton.addEventListener('click', hideLoginModal);
}

// Event listener for clicking outside the modal to close
window.addEventListener('click', (event) => {
    if (event.target === loginModal) {
        hideLoginModal();
    }
});

// Event listener for login form
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginEmailInput.value;
        const password = loginPasswordInput.value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            console.log('User signed in');
            hideLoginModal();
            showStatusMessage('Login berhasil!', 'success');
        } catch (error) {
            console.error('Login error:', error);
            let errorMessage = 'Login gagal. Silakan coba lagi.';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                errorMessage = 'Email atau password salah.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Format email tidak valid.';
            }
            loginErrorSpan.textContent = errorMessage;
        }
    });
}

// Function to reset display on logout
function resetDisplayOnLogout() {
    if (editFormContainer) editFormContainer.style.display = 'none';
    if (editJenisPajakSelector) {
        editJenisPajakSelector.innerHTML = '<option value="" disabled selected>Pilih Jenis Pajak</option>'; // Reset to default option
    }
    editTargetInput.value = '';
    editRealisasiSdTahunInput.value = '';
    editRealisasiTahunSebelumnyaInput.value = '';
    clearStatusMessage();
    allFirebaseData = null; // Clear cached data on logout
}

// Listener for Firebase data (only for edit form)
function listenForFirebaseData() {
    onValue(dbRef, (snapshot) => {
        if (snapshot.exists()) {
            allFirebaseData = snapshot.val();
            console.log("Data received from Firebase for edit form:", allFirebaseData);
            populateEditJenisPajakSelector(allFirebaseData);
            setDefaultYearSelector(); // Set default year after data is received
            loadDataForEditForm(); // Load data for initial selection
        } else {
            console.log("No data available at the specified Firebase path.");
            allFirebaseData = null;
            populateEditJenisPajakSelector(null); // Clear selector
            loadDataForEditForm(); // Clear form inputs
        }
    }, (error) => {
        console.error("Failed to read from Firebase:", error);
        if (error.code === "PERMISSION_DENIED") {
            console.error("Ensure your Firebase security rules allow read access ('.read': 'true').");
        }
        allFirebaseData = null;
        populateEditJenisPajakSelector(null);
        loadDataForEditForm();
    });
}

// Check authentication status on page load
onAuthStateChanged(auth, (user) => {
    if (user) {
        userStatusSpan.textContent = `Login sebagai: ${user.email}`;
        authButton.textContent = 'Logout';
        authButton.classList.remove('login');
        authButton.classList.add('logout');

        // Show edit form container
        if (editFormContainer) editFormContainer.style.display = 'block';

        listenForFirebaseData(); // Start listening for data for the edit form
    } else {
        userStatusSpan.textContent = 'Belum Login';
        authButton.textContent = 'Login';
        authButton.classList.remove('logout');
        authButton.classList.add('login');

        // Hide edit form container
        resetDisplayOnLogout();
    }
});

// Add event listeners for edit form selectors (ensure added only once)
if (editJenisPajakSelector && !editJenisPajakSelector.dataset.listenerAdded) {
    editJenisPajakSelector.addEventListener('change', loadDataForEditForm);
    editJenisPajakSelector.dataset.listenerAdded = 'true';
}
if (editYearSelector && !editYearSelector.dataset.listenerAdded) {
    editYearSelector.addEventListener('change', loadDataForEditForm);
    editYearSelector.dataset.listenerAdded = 'true';
}
