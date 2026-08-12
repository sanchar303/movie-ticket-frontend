let currentUser = null;
let allMoviesData = [];
const API_BASE = "https://movie-ticket-api-v2.onrender.com"; // UPDATE THIS

// PERSISTENCE CHECK & SECURITY
document.addEventListener("DOMContentLoaded", () => {
    const savedSession = localStorage.getItem('movieAppUser');
    if (savedSession) {
        currentUser = JSON.parse(savedSession);
        routeToDashboard();
    }
});

// UI UTILS
function showLoader() { document.getElementById('global-loader').classList.remove('hidden'); }
function hideLoader() { document.getElementById('global-loader').classList.add('hidden'); }

function showToast(msg, isErr = false) {
    const container = document.getElementById('toast-container');
    container.innerHTML = ''; // Enforce strict single toast
    const t = document.createElement('div');
    t.className = `toast glass-panel ${isErr ? 'error' : ''}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => {
        t.classList.add('fade-out');
        setTimeout(() => t.remove(), 300);
    }, 3000);
}

function switchView(id) { 
    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
}
function switchAuthTab(t) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); 
    document.getElementById(`tab-${t}`).classList.add('active');
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active')); 
    document.getElementById(`${t}-form`).classList.add('active');
}

// ROUTING
function routeToDashboard() {
    if (currentUser.role === 'admin') {
        updateAdminLocs();
        loadExistingMoviesToDatalist();
        switchView('admin-view');
    } else {
        loadAppMovies();
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
        document.getElementById('log-email').value = ''; document.getElementById('log-pass').value = '';
        showToast(`Welcome to TicketBox, ${currentUser.role}!`);
        routeToDashboard();
    } catch (err) { showToast(err.message, true); }
    hideLoader();
});

function logout() {
    currentUser = null; localStorage.removeItem('movieAppUser');
    showToast("Logged out successfully."); switchView('auth-view');
}

// REGISTRATION
const regEmail = document.getElementById('reg-email'); const regPass = document.getElementById('reg-pass'); const regBtn = document.getElementById('reg-btn');
const rules = { len: v => v.length > 8, up: v => /[A-Z]/.test(v), low: v => /[a-z]/.test(v), num: v => /\d/.test(v), spec: v => /[@$!%*?&\-#^]/.test(v) };

regEmail.addEventListener('blur', () => {
    document.getElementById('email-error').classList.toggle('hidden', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.value) || regEmail.value.length === 0); checkRegForm();
});

regPass.addEventListener('input', () => {
    const val = regPass.value;
    for (let k in rules) {
        const el = document.getElementById(`rule-${k}`);
        if (rules[k](val)) { el.textContent = "✅" + el.textContent.substring(1); el.classList.add('valid'); } 
        else { el.textContent = "❌" + el.textContent.substring(1); el.classList.remove('valid'); }
    }
    checkRegForm();
});

function checkRegForm() { regBtn.disabled = !(Object.values(rules).every(r => r(regPass.value)) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.value)); }

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoader();
    try {
        const res = await fetch(`${API_BASE}/api/register`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ email: regEmail.value, password: regPass.value }) });
        if (!res.ok) throw new Error(await res.text());
        showToast("Account Created! Please Sign in."); regEmail.value = ''; regPass.value = ''; switchAuthTab('login');
    } catch (err) { showToast(err.message, true); }
    hideLoader();
});

// ADMIN LOGIC
const qLocs = ["Labim Mall", "Bhatbhateni, Radhe Radhe", "Civil Mall", "City Center"]; 
const oLocs = ["Eyeplex Mall, Baneshwor", "Kalimati Trade Center, Kalimati"];

function updateAdminLocs() { 
    const isQFX = document.getElementById('admin-hall').value === 'QFX';
    document.getElementById('admin-loc').innerHTML = (isQFX ? qLocs : oLocs).map(l => `<option>${l}</option>`).join(''); 
    updateAdminTimings();
}

function updateAdminTimings() {
    const loc = document.getElementById('admin-loc').value;
    let times = [];
    
    if (loc === "Eyeplex Mall, Baneshwor") {
        times = ["09:00 AM", "11:45 AM", "01:45 PM", "02:45 PM", "04:30 PM", "05:30 PM", "08:15 PM"];
    } else if (loc === "Kalimati Trade Center, Kalimati") {
        times = ["10:00 AM", "12:30 PM", "03:00 PM", "05:45 PM", "08:30 PM"];
    } else {
        // QFX offset timings
        times = ["08:30 AM", "11:15 AM", "01:30 PM", "04:15 PM", "06:45 PM", "09:00 PM"];
    }
    document.getElementById('admin-time').innerHTML = times.map(t => `<option>${t}</option>`).join('');
}

async function loadExistingMoviesToDatalist() {
    try {
        const res = await fetch(`${API_BASE}/api/movies`); 
        const data = await res.json(); 
        const allData = Object.values(data || {});
        const uniqueTitles = [...new Set(allData.map(m => m.title))];
        document.getElementById('existing-movies').innerHTML = uniqueTitles.map(t => `<option value="${t}">`).join('');
    } catch(e) {}
}

document.getElementById('admin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoader();
    const m = { title: document.getElementById('admin-title').value, time: document.getElementById('admin-time').value, hall: document.getElementById('admin-hall').value, location: document.getElementById('admin-loc').value, seats: parseInt(document.getElementById('admin-seats').value), cost: parseInt(document.getElementById('admin-cost').value) };
    try {
        await fetch(`${API_BASE}/api/movies`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(m) });
        showToast("Movie Deployed to Box Office!"); 
        document.getElementById('admin-title').value = '';
        loadExistingMoviesToDatalist(); // refresh list
    } catch(err) { showToast("Deployment failed.", true); }
    hideLoader();
});

document.getElementById('admin-validate-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoader();
    const code = document.getElementById('admin-ticket-code').value.toUpperCase();
    try {
        const res = await fetch(`${API_BASE}/api/validate-ticket`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ code }) });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        showToast(`${data.message} | ${data.movie} | Tickets: ${data.tickets}`);
        document.getElementById('admin-ticket-code').value = '';
    } catch (err) { showToast(err.message, true); }
    hideLoader();
});

// USER LOGIC
async function loadAppMovies() {
    showLoader();
    try {
        const res = await fetch(`${API_BASE}/api/movies`); const data = await res.json(); allMoviesData = Object.values(data || {});
        const uniqueTitles = [...new Set(allMoviesData.map(m => m.title))];
        document.getElementById('user-movie').innerHTML = uniqueTitles.length ? uniqueTitles.map(t => `<option>${t}</option>`).join('') : '<option disabled>No movies available</option>';
        updateUserLocs();
    } catch(e) { showToast("Failed to load movies", true); }
    hideLoader();
}

function updateUserLocs() {
    const title = document.getElementById('user-movie').value;
    const uniqueLocs = [...new Set(allMoviesData.filter(m => m.title === title).map(m => `${m.hall} - ${m.location}`))];
    document.getElementById('user-loc').innerHTML = uniqueLocs.map(l => `<option>${l}</option>`).join(''); updateUserTimes();
}

function updateUserTimes() {
    const title = document.getElementById('user-movie').value; const loc = document.getElementById('user-loc').value;
    document.getElementById('user-time').innerHTML = allMoviesData.filter(m => m.title === title && `${m.hall} - ${m.location}` === loc).map(m => `<option>${m.time}</option>`).join('');
    updatePriceDisplay();
}

function getSelectedMovie() { return allMoviesData.find(m => m.title === document.getElementById('user-movie').value && `${m.hall} - ${m.location}` === document.getElementById('user-loc').value && m.time === document.getElementById('user-time').value); }

function updatePriceDisplay() {
    const m = getSelectedMovie(); if (!m) return;
    document.getElementById('display-price').textContent = `Price: Rs. ${m.cost}`; document.getElementById('display-seats').textContent = `Seats: ${m.seats}`;
    document.getElementById('display-total').textContent = `Total: Rs. ${m.cost * (parseInt(document.getElementById('user-tickets').value) || 1)}`;
}

document.getElementById('user-book-form').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    showLoader();
    const m = getSelectedMovie(); const tix = parseInt(document.getElementById('user-tickets').value);
    const booking = { movie: m.title, location: `${m.hall} - ${m.location}`, time: m.time, tickets: tix, total_cost: m.cost * tix, payment: "Counter" };
    
    try {
        const res = await fetch(`${API_BASE}/api/bookings?email=${currentUser.email}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(booking) });
        const data = await res.json();
        
        showToast("Ticket Confirmed & Processed!"); 
        loadUserBookings();
        generateAndShowQR(data.ticketCode);
    } catch(err) { showToast("Booking failed.", true); }
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
                ${b.status !== 'Used' ? `<div class="custom-btn action-btn slim" onclick="generateAndShowQR('${b.ticketCode}')">View QR</div>` : ''}
            </div>`).join('') : "<p style='color:#888; text-align:center;'>Vault is empty.</p>";
    } catch(e) {}
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

    // Create a canvas to draw the QR code AND the text beneath it
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Canvas dimensions (300x300 image + 60px for text)
    canvas.width = 300;
    canvas.height = 360;

    // Fill white background so it looks exactly like the website preview
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the QR Code image
    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
        ctx.drawImage(img, 0, 0, 300, 300);

        // Draw the text exactly as it looks in the app
        ctx.fillStyle = "#000000";
        ctx.font = "bold 32px sans-serif";
        ctx.textAlign = "center";
        ctx.letterSpacing = "3px";
        ctx.fillText(codeText, 150, 340);

        // Trigger Download
        const link = document.createElement('a');
        link.download = `TicketBox_QR_${codeText}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        
        showToast("Ticket Saved to Device!");
    };
    img.src = qrImage.src;
}
