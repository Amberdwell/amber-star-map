// Izmanto savu CSV publicēto saiti
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSSzkCeYF5iB99OChWh54PD6a5q5KU8aEscJBvhN8yNRDuxogREkw2kzxi2QlLUOAmDYk1Kgttc0RMN/pub?output=csv';

const map = L.map('map', {
    center: [50.0, 15.0], // Eiropas centrs
    zoom: 4,              // Sākumā rādīs visu Eiropu
    zoomControl: false,
    minZoom: 3,           // Ļauj atzūmēt līdz kontinentam
    maxZoom: 18
});

L.control.zoom({ position: 'bottomright' }).addTo(map);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO'
}).addTo(map);

const markersClusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 35,
    showCoverageOnHover: false,
    iconCreateFunction: function (cluster) {
        return L.divIcon({
            html: `<span>${cluster.getChildCount()}</span>`,
            className: 'custom-cluster',
            iconSize: L.point(36, 36)
        });
    }
});
map.addLayer(markersClusterGroup);

let hotelData = [];
let activeCategory = 'all';
let activeCountry = 'all';
let minScoreFilter = 0;
let searchQuery = '';

// Amber Star zvaigžņu aprēķina loģika
function getStars(score) {
    let fullStars = 0;
    if (score >= 146) fullStars = 5;
    else if (score >= 142) fullStars = 4;
    else if (score >= 138) fullStars = 3;
    else if (score >= 134) fullStars = 2;
    else if (score >= 130) fullStars = 1;
    else fullStars = 0;
    return "★".repeat(fullStars) + "☆".repeat(5 - fullStars);
}

function parseTabularCSV(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) return [];

    let sep = ',';
    if (lines[0].split('\t').length > lines[0].split(',').length) sep = '\t';
    else if (lines[0].split(';').length > lines[0].split(',').length) sep = ';';

    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    const idxId = headers.findIndex(h => h.includes('accreditation'));
    const idxName = headers.findIndex(h => h.includes('title') || h.includes('property') || h.includes('name'));
    const idxLocation = headers.findIndex(h => h.includes('city') || h.includes('location'));
    const idxScore = headers.findIndex(h => h.includes('audit'));
    const idxRating = headers.findIndex(h => h.includes('guest'));
    const idxPlatform = headers.findIndex(h => h.includes('website') || h.includes('platform'));
    const idxCategory = headers.findIndex(h => h.includes('category'));
    const idxLat = headers.findIndex(h => h.includes('lat'));
    const idxLng = headers.findIndex(h => h.includes('long') || h === 'lng');
    const idxDesc = headers.findIndex(h => h.includes('desc'));

    return lines.slice(1).map(line => {
        const row = line.split(sep).map(item => item.trim().replace(/^"|"$/g, ''));
        if (row.length < 3) return null;

        let latStr = (idxLat !== -1 ? row[idxLat] : '').replace(',', '.');
        let lngStr = (idxLng !== -1 ? row[idxLng] : '').replace(',', '.');
        let scoreRaw = idxScore !== -1 ? (row[idxScore] || '0').split('/')[0].trim() : '0';

        return {
            name: idxName !== -1 ? row[idxName] : 'Property',
            description: idxDesc !== -1 ? row[idxDesc] : 'Amber Star Selection approved.',
            score: parseInt(scoreRaw, 10) || 0,
            guestRating: idxRating !== -1 ? row[idxRating] : 'N/A',
            city: idxLocation !== -1 ? row[idxLocation] : '',
            category: idxCategory !== -1 ? row[idxCategory].toUpperCase() : 'HOTEL',
            website: idxPlatform !== -1 ? row[idxPlatform] : '#',
            id_code: idxId !== -1 ? row[idxId] : 'AS-PENDING',
            lat: parseFloat(latStr),
            lng: parseFloat(lngStr),
            image: "https://images.unsplash.com/photo-1566073771259-6a8506099945"
        };
    }).filter(h => h !== null && !isNaN(h.lat) && !isNaN(h.lng));
}

async function startApp() {
    try {
        const response = await fetch(CSV_URL);
        const csvText = await response.text();
        hotelData = parseTabularCSV(csvText);
        buildCategoriesUI();
        renderMapPoints();
        setupEventListeners();
    } catch (err) { console.error('Kļūda:', err); }
}

function renderMapPoints() {
    markersClusterGroup.clearLayers();
    const filtered = hotelData.filter(h => h.category.includes(activeCategory === 'all' ? '' : activeCategory));
    
    document.getElementById('totalPropertiesText').textContent = `${filtered.length} Exceptional Properties`;

    filtered.forEach(loc => {
        const marker = L.marker([loc.lat, loc.lng], { 
            icon: L.divIcon({ html: `<div class="premium-dot-marker"></div>`, className: 'custom-dot-wrapper', iconSize: [16, 16] }) 
        });

        const popupContent = `
            <div class="luxury-popup-card">
                <div class="popup-img-container"><img src="${loc.image}" alt="${loc.name}"></div>
                <div class="popup-content-body">
                    <h2 class="popup-main-title">${loc.name}</h2>
                    <p class="popup-description">${loc.description}</p>
                    <div class="popup-details-grid">
                        <div class="detail-row">
                            <span class="detail-lbl">Amber Star Rating:</span>
                            <span class="stars-row" style="color: #D4AF37;">${getStars(loc.score)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-lbl">Audit Score:</span>
                            <span class="detail-val font-semibold">${loc.score} / 150</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-lbl">Guest Rating:</span>
                            <span class="detail-val font-semibold">${loc.guestRating}</span>
                        </div>
                    </div>
                    <a href="${loc.website.startsWith('http') ? loc.website : 'https://'+loc.website}" target="_blank" class="popup-action-btn">Official Website</a>
                </div>
            </div>
        `;
        marker.bindPopup(popupContent, { maxWidth: 320 });
        markersClusterGroup.addLayer(marker);
    });
}

function buildCategoriesUI() {
    const container = document.getElementById('categoryContainer');
    const cats = [...new Set(hotelData.map(h => h.category))];
    container.innerHTML = `<button data-category="all" class="category-btn active">ALL</button>` + 
                          cats.map(c => `<button data-category="${c}" class="category-btn">${c}</button>`).join('');
}

function setupEventListeners() {
    document.getElementById('categoryContainer').addEventListener('click', (e) => {
        const btn = e.target.closest('.category-btn');
        if(!btn) return;
        activeCategory = btn.getAttribute('data-category');
        renderMapPoints();
    });
}

startApp();
