let currentUser = null;
let allMoviesData = {}; 
const API_BASE = "https://movie-ticket-api-v2.onrender.com"; // Locked

// PERSISTENCE CHECK & SECURITY
document.addEventListener("DOMContentLoaded", () => {
    clearAuthForms(); // Force inputs to empty on load
    const savedSession = localStorage.getItem('movieAppUser');
    if (savedSession) {
        currentUser = JSON.parse(savedSession);
        routeToDashboard();
    }
});

// ================= UI UTILS & MODALS =================
function showLoader() { document.getElementById('global-loader').classList.remove('hidden'); }
function hideLoader() { document.getElementById('global-loader').classList.add('hidden'); }

function showToast(msg, isErr = false) {
    const container = document.getElementById('toast-container');
    container.innerHTML = ''; 
    const t = document.createElement('div');
    t.className = `toast ${isErr ? 'error' : ''}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => {
        t.classList.add('fade-out');
        setTimeout(() => t.remove(), 300);
    }, 3000);
}

// Custom Glassy Confirmation Modal
let confirmCallback = null;

function showConfirmModal(message, callback) {
    document.getElementById('confirm-message').innerText = message;
    confirmCallback = callback;
    document.getElementById('confirm-modal').classList.remove('hidden');
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.add('hidden');
    confirmCallback = null;
}

document.getElementById('confirm-yes-btn').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
});


function clearAuthForms() {
    document.getElementById('log-email').value = '';
    document.getElementById('log-pass').value = '';
    document.getElementById('reg-email').value = '';
    document.getElementById('reg-pass').value = '';
    document.querySelectorAll('.rule-item').forEach(el => el.classList.remove('valid', 'invalid'));
    hasAttemptedSubmit = false;
}

function switchView(id) { 
    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
}
function switchAuthTab(t) {
    clearAuthForms(); 
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); 
    document.getElementById(`tab-${t}`).classList.add('active');
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active')); 
    document.getElementById(`${t}-form`).classList.add('active');
}

// ROUTING
async function routeToDashboard() {
    if (currentUser.role === 'admin') {
        await refreshAdminData();
        switchView('admin-view');
    } else {
        await loadAppMovies();
        loadUserBookings();
        switchView('user-view');
    }
}

// LOGIN & LOGOUT
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoader();
    const payload = { email: document.getElementById('log-email').value, password: document.getElementById('log-pass').value };
    try {
        const res = await fetch(`${API_BASE}/api/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(await res.text());
        currentUser = await res.json();
        localStorage.setItem('movieAppUser', JSON.stringify(currentUser)); 
        clearAuthForms();
        showToast(`Welcome to TicketBox, ${currentUser.role}!`);
        routeToDashboard();
    } catch (err) { showToast(err.message, true); }
    hideLoader();
});

function logout() {
    currentUser = null; localStorage.removeItem('movieAppUser');
    clearAuthForms();
    showToast("Logged out successfully."); 
    switchView('auth-view');
}

// Anti-Hack Tripwire
function handleApiError(res) {
    if (res.status === 403) {
        logout();
        showToast("SECURITY ALERT: Unauthorized Admin Access Attempt Blocked.", true);
        throw new Error("Unauthorized");
    }
}

// ================= REGISTRATION & PASSWORD UI =================
let hasAttemptedSubmit = false;
const regEmail = document.getElementById('reg-email'); 
const regPass = document.getElementById('reg-pass'); 
const rules = { len: v => v.length >= 8, up: v => /[A-Z]/.test(v), low: v => /[a-z]/.test(v), num: v => /\d/.test(v), spec: v => /[@$!%*?&\-#^]/.test(v) };

regEmail.addEventListener('blur', () => {
    document.getElementById('email-error').classList.toggle('hidden', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.value) || regEmail.value.length === 0); 
});

regPass.addEventListener('input', () => {
    const val = regPass.value;
    for (let k in rules) {
        const el = document.getElementById(`rule-${k}`);
        if (rules[k](val)) { 
            el.classList.add('valid'); 
            el.classList.remove('invalid');
        } else { 
            el.classList.remove('valid'); 
            if(hasAttemptedSubmit) el.classList.add('invalid');
        }
    }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    hasAttemptedSubmit = true;
    
    const val = regPass.value;
    let allValid = true;
    for (let k in rules) {
        const el = document.getElementById(`rule-${k}`);
        if (!rules[k](val)) { 
            el.classList.add('invalid'); 
            allValid = false; 
        } else {
            el.classList.add('valid'); 
        }
    }
    
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.value);
    if(!emailValid) {
        document.getElementById('email-error').classList.remove('hidden');
        allValid = false;
    }

    if(!allValid) {
        showToast("Please fulfill all password requirements.", true);
        return;
    }

    showLoader();
    try {
        const res = await fetch(`${API_BASE}/api/register`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ email: regEmail.value, password: regPass.value }) });
        if (!res.ok) throw new Error(await res.text());
        showToast("Account Created! Please Sign in."); 
        switchAuthTab('login');
    } catch (err) { showToast(err.message, true); }
    hideLoader();
});

// ================= ADMIN LOGIC & SMART DROPDOWN =================
let editingMovieId = null;
const qLocs = ["Labim Mall", "Bhatbhateni, Radhe Radhe", "Civil Mall", "City Center"]; 
const oLocs = ["Eyeplex Mall, Baneshwor", "Kalimati Trade Center, Kalimati"];

async function refreshAdminData() {
    showLoader();
    try {
        const res = await fetch(`${API_BASE}/api/movies`); 
        allMoviesData = await res.json() || {}; 
        
        renderAdminMoviesDropdown();
        renderAdminDeployments();
        updateAdminLocs(); 
    } catch(e) {}
    hideLoader();
}

function updateAdminLocs() { 
    const isQFX = document.getElementById('admin-hall').value === 'QFX';
    document.getElementById('admin-loc').innerHTML = (isQFX ? qLocs : oLocs).map(l => `<option>${l}</option>`).join(''); 
    updateAdminTimings();
}

function getOccupiedTimes(hall, loc) {
    const occupied = [];
    for (const [id, m] of Object.entries(allMoviesData)) {
        if (id !== editingMovieId && m.hall === hall && m.location === loc) {
            occupied.push(m.time);
        }
    }
    return occupied;
}

function updateAdminTimings() {
    const hall = document.getElementById('admin-hall').value;
    const loc = document.getElementById('admin-loc').value;
    let baseTimes = [];
    
    if (loc === "Eyeplex Mall, Baneshwor") {
        baseTimes = ["09:00 AM", "11:45 AM", "01:45 PM", "02:45 PM", "04:30 PM", "05:30 PM", "08:15 PM"];
    } else if (loc === "Kalimati Trade Center, Kalimati") {
        baseTimes = ["10:00 AM", "12:30 PM", "03:00 PM", "05:45 PM", "08:30 PM"];
    } else {
        baseTimes = ["08:30 AM", "11:15 AM", "01:30 PM", "04:15 PM", "06:45 PM", "09:00 PM"];
    }

    const occupiedTimes = getOccupiedTimes(hall, loc);
    const availableTimes = baseTimes.filter(t => !occupiedTimes.includes(t));

    const timeSelect = document.getElementById('admin-time');
    const submitBtn = document.getElementById('admin-submit-btn');

    if (availableTimes.length === 0) {
        timeSelect.innerHTML = '<option value="" disabled selected>No slots available</option>';
        submitBtn.disabled = true;
        submitBtn.classList.add('disabled-btn');
    } else {
        timeSelect.innerHTML = availableTimes.map(t => `<option value="${t}">${t}</option>`).join('');
        submitBtn.disabled = false;
        submitBtn.classList.remove('disabled-btn');
        
        if (editingMovieId && allMoviesData[editingMovieId]) {
            const origTime = allMoviesData[editingMovieId].time;
            if (availableTimes.includes(origTime)) {
                timeSelect.value = origTime;
            }
        }
    }
}

function renderAdminMoviesDropdown() {
    const moviesArr = Object.values(allMoviesData);
    const uniqueTitles = [...new Set(moviesArr.map(m => m.title))];
    
    let html = '<option value="" disabled selected>-- Select a Movie --</option>';
    html += uniqueTitles.map(t => `<option value="${t}">${t}</option>`).join('');
    html += '<option value="__NEW__" style="color:var(--primary); font-weight:bold;">➕ Add New Movie...</option>';
    
    document.getElementById('admin-title-select').innerHTML = html;
    toggleNewMovieInput(); 
}

function toggleNewMovieInput() {
    const select = document.getElementById('admin-title-select');
    const inputGroup = document.getElementById('admin-title-input-group');
    const input = document.getElementById('admin-title-input');

    if (select.value === '__NEW__') {
        inputGroup.classList.remove('hidden');
        input.required = true;
        inputGroup.style.animation = "fadeUp 0.3s forwards";
    } else {
        inputGroup.classList.add('hidden');
        input.required = false;
        input.value = '';
    }
}

// --- ADMIN EDIT / DELETE ---
function renderAdminDeployments() {
    const list = document.getElementById('admin-movies-list');
    
    list.innerHTML = Object.keys(allMoviesData).length ? Object.entries(allMoviesData).reverse().map(([id, m]) => `
        <div class="receipt-item">
            <div class="receipt-details">
                <h4>${m.title}</h4>
                <p>🕒 ${m.time} | 📍 ${m.hall} - ${m.location}</p>
                <p>💺 Seats: ${m.seats} | 💰 Rs. ${m.cost}</p>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
                <div class="custom-btn action-btn slim" onclick="editMovie('${id}')">Edit</div>
                <div class="custom-btn danger-btn slim" onclick="deleteMovie('${id}')">Delete</div>
            </div>
        </div>`).join('') : "<p style='color:#888; text-align:center;'>No active deployments.</p>";
}

function editMovie(id) {
    const m = allMoviesData[id];
    if(!m) return;
    editingMovieId = id;
    
    document.getElementById('admin-form-title').innerHTML = "✏️ Edit Deployment";
    document.getElementById('admin-title-select').value = '__NEW__';
    toggleNewMovieInput();
    document.getElementById('admin-title-input').value = m.title;
    document.getElementById('admin-hall').value = m.hall;
    
    updateAdminLocs();
    document.getElementById('admin-loc').value = m.location;
    updateAdminTimings();
    document.getElementById('admin-time').value = m.time;
    
    document.getElementById('admin-seats').value = m.seats;
    document.getElementById('admin-cost').value = m.cost;
    
    const submitBtn = document.getElementById('admin-submit-btn');
    submitBtn.textContent = "Update Movie";
    submitBtn.classList.remove('primary-btn');
    submitBtn.classList.add('action-btn');
    
    document.getElementById('admin-cancel-btn').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetAdminForm() {
    editingMovieId = null;
    document.getElementById('admin-form-title').innerHTML = "🎬 Publish Show";
    document.getElementById('admin-form').reset();
    toggleNewMovieInput();
    updateAdminLocs();
    
    const submitBtn = document.getElementById('admin-submit-btn');
    submitBtn.textContent = "Deploy Movie";
    submitBtn.classList.add('primary-btn');
    submitBtn.classList.remove('action-btn');
    
    document.getElementById('admin-cancel-btn').classList.add('hidden');
}

function deleteMovie(id) {
    showConfirmModal("Erase this deployment permanently? All seats and timings will be wiped.", async () => {
        showLoader();
        try {
            const res = await fetch(`${API_BASE}/api/movies?id=${id}`, { 
                method: 'DELETE', 
                headers: { 'Admin-Token': currentUser?.token || '' } 
            });
            handleApiError(res);
            if(!res.ok) throw new Error(await res.text());
            showToast("Deployment deleted.");
            resetAdminForm();
            await refreshAdminData();
        } catch(e) { if(e.message !== "Unauthorized") showToast("Failed to delete", true); }
        hideLoader();
    });
}

document.getElementById('admin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoader();
    
    const selectVal = document.getElementById('admin-title-select').value;
    const finalTitle = selectVal === '__NEW__' ? document.getElementById('admin-title-input').value : selectVal;
    
    const m = { 
        title: finalTitle, 
        time: document.getElementById('admin-time').value, 
        hall: document.getElementById('admin-hall').value, 
        location: document.getElementById('admin-loc').value, 
        seats: parseInt(document.getElementById('admin-seats').value), 
        cost: parseInt(document.getElementById('admin-cost').value) 
    };
    
    const adminHeaders = { 'Content-Type': 'application/json', 'Admin-Token': currentUser?.token || '' };
    
    try {
        if(editingMovieId) {
            const res = await fetch(`${API_BASE}/api/movies?id=${editingMovieId}`, { method: 'PUT', headers: adminHeaders, body: JSON.stringify(m) });
            handleApiError(res);
            showToast("Movie Updated Successfully!"); 
        } else {
            const res = await fetch(`${API_BASE}/api/movies`, { method: 'POST', headers: adminHeaders, body: JSON.stringify(m) });
            handleApiError(res);
            showToast("Movie Deployed to Box Office!"); 
        }
        resetAdminForm();
        await refreshAdminData();
    } catch(err) { if(err.message !== "Unauthorized") showToast("Deployment failed.", true); }
    hideLoader();
});

document.getElementById('admin-validate-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoader();
    const code = document.getElementById('admin-ticket-code').value.toUpperCase();
    try {
        const res = await fetch(`${API_BASE}/api/validate-ticket`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Admin-Token': currentUser?.token || '' }, 
            body: JSON.stringify({ code }) 
        });
        handleApiError(res);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        showToast(`${data.message} | ${data.movie} | Tickets: ${data.tickets}`);
        document.getElementById('admin-ticket-code').value = '';
    } catch (err) { if(err.message !== "Unauthorized") showToast(err.message, true); }
    hideLoader();
});

// ================= USER LOGIC =================
async function loadAppMovies() {
    showLoader();
    try {
        const res = await fetch(`${API_BASE}/api/movies`); 
        allMoviesData = await res.json() || {}; 
        const moviesArr = Object.values(allMoviesData);
        const uniqueTitles = [...new Set(moviesArr.map(m => m.title))];
        
        let html = '<option value="" disabled selected>-- Select a Movie --</option>';
        if(uniqueTitles.length) {
            html += uniqueTitles.map(t => `<option value="${t}">${t}</option>`).join('');
        } else {
            html = '<option value="" disabled selected>No movies available</option>';
        }
        document.getElementById('user-movie').innerHTML = html;
        document.getElementById('user-loc').innerHTML = '<option value="" disabled selected>--</option>';
        document.getElementById('user-time').innerHTML = '<option value="" disabled selected>--</option>';
        
        updatePriceDisplay();
    } catch(e) { showToast("Failed to load movies", true); }
    hideLoader();
}

function updateUserLocs() {
    const title = document.getElementById('user-movie').value;
    const moviesArr = Object.values(allMoviesData);
    const uniqueLocs = [...new Set(moviesArr.filter(m => m.title === title).map(m => `${m.hall} - ${m.location}`))];
    
    let html = '<option value="" disabled selected>-- Select Location --</option>';
    html += uniqueLocs.map(l => `<option value="${l}">${l}</option>`).join('');
    
    document.getElementById('user-loc').innerHTML = html; 
    document.getElementById('user-time').innerHTML = '<option value="" disabled selected>--</option>';
    updatePriceDisplay();
}

function updateUserTimes() {
    const title = document.getElementById('user-movie').value; 
    const loc = document.getElementById('user-loc').value;
    const moviesArr = Object.values(allMoviesData);
    
    let html = '<option value="" disabled selected>-- Select Time --</option>';
    html += moviesArr.filter(m => m.title === title && `${m.hall} - ${m.location}` === loc).map(m => `<option value="${m.time}">${m.time}</option>`).join('');
    document.getElementById('user-time').innerHTML = html;
    updatePriceDisplay();
}

function getSelectedMovie() { 
    const moviesArr = Object.values(allMoviesData);
    return moviesArr.find(m => m.title === document.getElementById('user-movie').value && `${m.hall} - ${m.location}` === document.getElementById('user-loc').value && m.time === document.getElementById('user-time').value); 
}

function updatePriceDisplay() {
    const m = getSelectedMovie(); 
    const tix = parseInt(document.getElementById('user-tickets').value) || 0;
    
    if (!m) {
        document.getElementById('display-price').textContent = `Price: Rs. 0`; 
        document.getElementById('display-seats').textContent = `Available: 0`;
        document.getElementById('display-total').textContent = `Total: Rs. 0`;
    } else {
        document.getElementById('display-price').textContent = `Price: Rs. ${m.cost}`; 
        document.getElementById('display-seats').textContent = `Available: ${m.seats}`;
        document.getElementById('display-total').textContent = `Total: Rs. ${m.cost * tix}`;
    }
    checkBookingForm();
}

function checkBookingForm() {
    const movie = document.getElementById('user-movie').value;
    const loc = document.getElementById('user-loc').value;
    const time = document.getElementById('user-time').value;
    const tix = parseInt(document.getElementById('user-tickets').value) || 0;
    const btn = document.getElementById('book-ticket-btn');
    const m = getSelectedMovie();

    if (!movie || !loc || !time || tix < 1) {
        btn.disabled = true; btn.classList.add('disabled-btn');
        return;
    }
    if (m && tix > m.seats) {
        btn.disabled = true; btn.classList.add('disabled-btn');
        document.getElementById('display-seats').style.color = 'var(--danger)';
    } else {
        btn.disabled = false; btn.classList.remove('disabled-btn');
        document.getElementById('display-seats').style.color = '#fff';
    }
}

document.getElementById('user-book-form').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    showLoader();
    const m = getSelectedMovie(); const tix = parseInt(document.getElementById('user-tickets').value);
    const booking = { movie: m.title, location: `${m.hall} - ${m.location}`, time: m.time, tickets: tix, total_cost: m.cost * tix, payment: "Counter" };
    
    try {
        const res = await fetch(`${API_BASE}/api/bookings?email=${currentUser.email}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(booking) });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        
        showToast("Ticket Confirmed & Processed!"); 
        loadAppMovies(); 
        loadUserBookings(); 
        generateAndShowQR(data.ticketCode);
    } catch(err) { showToast(err.message || "Booking failed.", true); }
    hideLoader();
});

async function loadUserBookings() {
    try {
        const res = await fetch(`${API_BASE}/api/bookings?email=${currentUser.email}`); const data = await res.json();
        document.getElementById('bookings-list').innerHTML = data ? Object.values(data).reverse().map(b => `
            <div class="receipt-item">
                <div class="receipt-details">
                    <h4>${b.movie}</h4>
                    <p>🕒 ${b.time} <span class="status-badge ${b.status === 'Used' ? 'status-used' : 'status-valid'}">${b.status || 'Valid'}</span></p>
                    <p>📍 ${b.location}</p>
                    <p>🎫 ${b.tickets} Tickets | <strong>Rs. ${b.total_cost}</strong></p>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${b.status !== 'Used' ? `<div class="custom-btn action-btn slim" onclick="generateAndShowQR('${b.ticketCode}')">View QR</div>` : ''}
                    <div class="custom-btn danger-btn slim" style="padding: 4px 10px; font-size: 0.7rem;" onclick="deleteTicket('${b.ticketCode}')">Delete</div>
                </div>
            </div>`).join('') : "<p style='color:#888; text-align:center;'>Vault is empty.</p>";
    } catch(e) {}
}

function deleteTicket(code) {
    showConfirmModal("Erase ticket permanently? This cannot be undone.", async () => {
        showLoader();
        try {
            const res = await fetch(`${API_BASE}/api/bookings?email=${currentUser.email}&code=${code}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await res.text());
            showToast("Ticket permanently deleted.");
            loadAppMovies(); 
            loadUserBookings(); 
        } catch (err) {
            showToast("Failed to delete ticket.", true);
        }
        hideLoader();
    });
}

// ================= QR CODE & CANVAS LOGIC =================
function generateAndShowQR(code) {
    const modal = document.getElementById('qr-modal');
    const qrLoader = document.getElementById('qr-loader');
    const qrImage = document.getElementById('qr-image');
    
    document.getElementById('qr-code-text').innerText = code;
    modal.classList.remove('hidden');
    qrLoader.classList.remove('hidden');
    qrImage.classList.add('hidden');

    const apiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(code)}&color=000000&bgcolor=ffffff`;

    const imgLoader = new Image();
    imgLoader.crossOrigin = "Anonymous";
    imgLoader.src = apiQrUrl;

    imgLoader.onload = () => {
        qrImage.src = apiQrUrl;
        qrLoader.classList.add('hidden');
        qrImage.classList.remove('hidden');
    };
}

function closeQRModal() { document.getElementById('qr-modal').classList.add('hidden'); }

async function downloadQR() {
    const qrImage = document.getElementById('qr-image');
    const codeText = document.getElementById('qr-code-text').innerText;
    if (!qrImage.src || qrImage.classList.contains('hidden')) return;

    showToast("Processing Image...");

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 300;
    canvas.height = 360;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
        ctx.drawImage(img, 0, 0, 300, 300);

        ctx.fillStyle = "#000000";
        ctx.font = "bold 32px sans-serif";
        ctx.textAlign = "center";
        ctx.letterSpacing = "3px";
        ctx.fillText(codeText, 150, 340);

        const link = document.createElement('a');
        link.download = `TicketBox_QR_${codeText}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        
        showToast("Ticket Saved to Device!");
    };
    img.src = qrImage.src;
}
