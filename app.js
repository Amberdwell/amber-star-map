const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSSzkCeYF5iB99OChWh54PD6a5q5KU8aEscJBvhN8yNRDuxogREkw2kzxi2QlLUOAmDYk1Kgttc0RMN/pub?output=csv';

const map = L.map('map', {
    center: [55.50, 17.00],
    zoom: 5.5,
    zoomControl: false,
    minZoom: 2,
    maxZoom: 21
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
let minScoreFilter = 0;

function parseTabularCSV(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) return [];

    let sep = ',';
    if (lines[0].split('\t').length > lines[0].split(',').length) sep = '\t';
    else if (lines[0].split(';').length > lines[0].split(',').length) sep = ';';

    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    const idxName = headers.findIndex(h => h.includes('title') || h.includes('property') || h.includes('name'));
    const idxLocation = headers.findIndex(h => h.includes('city') || h.includes('location'));
    const idxScore = headers.findIndex(h => h.includes('audit'));
    const idxRating = headers.findIndex(h => h.includes('guest'));
    const idxPlatform = headers.findIndex(h => h.includes('website') || h.includes('platform'));
    const idxCategory = headers.findIndex(h => h.includes('category'));
    const idxLat = headers.findIndex(h => h.includes('lat'));
    const idxLng = headers.findIndex(h => h.includes('long') || h === 'lng');
    const idxDesc = headers.findIndex(h => h.includes('desc'));
    const idxImage = headers.findIndex(h => h.includes('image'));

    return lines.slice(1).map(line => {
        const row = line.split(sep).map(item => item.trim().replace(/^"|"$/g, ''));
        if (row.length < 3) return null;

        return {
            name: idxName !== -1 ? row[idxName] : 'Unnamed Property',
            description: idxDesc !== -1 ? row[idxDesc] : 'Amber Star approved luxury property.',
            score: parseInt((idxScore !== -1 ? (row[idxScore] || '0').split('/')[0].trim() : '0'), 10) || 0,
            guestRating: idxRating !== -1 ? row[idxRating] : 'N/A',
            city: idxLocation !== -1 ? row[idxLocation] : '',
            category: idxCategory !== -1 ? (row[idxCategory] || 'HOTEL').toUpperCase() : 'HOTEL',
            website: idxPlatform !== -1 ? row[idxPlatform] : '#',
            lat: parseFloat((idxLat !== -1 ? row[idxLat] : '0').replace(',', '.')),
            lng: parseFloat((idxLng !== -1 ? row[idxLng] : '0').replace(',', '.')),
            image: (idxImage !== -1 && row[idxImage]) ? row[idxImage] : "https://images.unsplash.com/photo-1566073771259-6a8506099945"
        };
    }).filter(h => h !== null && !isNaN(h.lat) && !isNaN(h.lng));
}

function renderMapPoints() {
    markersClusterGroup.clearLayers();
    const filtered = hotelData.filter(h => 
        (activeCategory === 'all' || h.category === activeCategory) && 
        (h.score >= minScoreFilter)
    );

    document.getElementById('totalPropertiesText').textContent = `${filtered.length} Exceptional Properties`;

    filtered.forEach(loc => {
        const marker = L.marker([loc.lat, loc.lng], { icon: L.divIcon({ html: `<div class="premium-dot-marker"></div>`, className: 'custom-dot-wrapper', iconSize: [16, 16] }) });
        const popupContent = `<div class="luxury-popup-card" style="width: 320px;">
            <img src="${loc.image}" style="width: 100%; height: 150px; object-fit: cover;">
            <div style="padding: 12px;">
                <h2 style="font-size: 16px;">${loc.name}</h2>
                <p style="font-size: 13px;">${loc.description}</p>
                <p><b>Audit Score:</b> ${loc.score}/150</p>
                <a href="${loc.website.startsWith('http') ? loc.website : 'https://'+loc.website}" target="_blank" style="display: block; background: #333; color: white; padding: 8px; text-align: center; text-decoration: none;">Website</a>
            </div>
        </div>`;
        marker.bindPopup(popupContent, { maxWidth: 320 });
        markersClusterGroup.addLayer(marker);
    });
}

function setupEventListeners() {
    const catContainer = document.getElementById('categoryContainer');
    if (catContainer) {
        catContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.category-btn');
            if (!btn) return;
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeCategory = btn.getAttribute('data-category');
            renderMapPoints();
        });
    }

    const scoreContainer = document.getElementById('scoreFilterGroup');
    if (scoreContainer) {
        scoreContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.score-btn');
            if (!btn) return;
            document.querySelectorAll('.score-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            minScoreFilter = parseInt(btn.getAttribute('data-min-score'), 10) || 0;
            renderMapPoints();
        });
    }

    const resetBtn = document.getElementById('resetFilters');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            activeCategory = 'all';
            minScoreFilter = 0;
            document.querySelectorAll('.category-btn, .score-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('[data-category="all"]')?.classList.add('active');
            renderMapPoints();
        });
    }
}

async function startApp() {
    try {
        const response = await fetch(CSV_URL);
        const csvText = await response.text();
        hotelData = parseTabularCSV(csvText);
        renderMapPoints();
        setupEventListeners();
    } catch (err) { console.error('Kļūda:', err); }
}

startApp();
