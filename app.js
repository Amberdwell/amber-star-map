// ŠEIT IEKOPĒ SAVU JAUNO .CSV SAITI NO AMBER STAR HOTELS TABULAS
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSSzkCeYF5iB99OChWh54PD6a5q5KU8aEscJBvhN8yNRDuxogREkw2kzxi2QlLUOAmDYk1Kgttc0RMN/pub?output=csv';

const map = L.map('map', {
    center: [56.50, 18.00], // Centrs ap Rīgu/Latviju
    zoom: 5,
    zoomControl: false,
    minZoom: 2,
    maxZoom: 20
});

L.control.zoom({ position: 'bottomright' }).addTo(map);

// Premium gaišā karte
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

// Universāls parsētājs, kas sadala rindas neatkarīgi no tā, vai tur ir komats vai Tab atstarpe
function parseTabularCSV(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) return [];

    // Nosakām, kurš atdalītājs tiek izmantots visvairāk pirmajā rindā
    let sep = ',';
    if (lines[0].split('\t').length > lines[0].split(',').length) sep = '\t';
    else if (lines[0].split(';').length > lines[0].split(',').length) sep = ';';

    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    // Dinamiski atrodam kolonnu vietas pēc nosaukumiem
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

        let latStr = idxLat !== -1 ? (row[idxLat] || '') : '';
        let lngStr = idxLng !== -1 ? (row[idxLng] || '') : '';
        
        // Pārvēršam komatus punktos, ja tādi gadījušies koordinātās
        latStr = latStr.replace(',', '.');
        lngStr = lngStr.replace(',', '.');

        let scoreRaw = idxScore !== -1 ? (row[idxScore] || '0').split('/')[0].trim() : '0';
        let scoreNum = parseInt(scoreRaw, 10) || 0;

        return {
            name: idxName !== -1 ? row[idxName] : 'Unnamed Property',
            description: idxDesc !== -1 ? (row[idxDesc] || 'Amber Star approved luxury property.') : 'Amber Star approved luxury property.',
            score: scoreNum,
            guestRating: idxRating !== -1 ? (row[idxRating] || 'N/A') : 'N/A',
            country: 'Latvia',
            city: idxLocation !== -1 ? row[idxLocation] : '',
            category: idxCategory !== -1 ? (row[idxCategory] || 'HOTEL').toUpperCase() : 'HOTEL',
            website: idxPlatform !== -1 ? (row[idxPlatform] || '#') : '#',
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
        if (!response.ok) throw new Error("Nevar ielādēt datus");
        
        const csvText = await response.text();
        hotelData = parseTabularCSV(csvText);

        buildCategoriesUI();
        renderMapPoints();
        setupEventListeners();

    } catch (err) {
        console.error('Kļūda aplikācijas darbībā:', err);
    }
}

function buildCategoriesUI() {
    const container = document.getElementById('categoryContainer');
    container.innerHTML = `
        <button data-category="all" class="category-btn active flex items-center justify-between w-full text-left px-3 py-2 text-xs tracking-wide transition-all">
            <span>ALL PROPERTIES</span>
        </button>
    `;
    const categories = [...new Set(hotelData.map(h => h.category))].sort();
    categories.forEach(cat => {
        if(!cat || cat === 'all') return;
        const btn = document.createElement('button');
        btn.setAttribute('data-category', cat);
        btn.className = "category-btn flex items-center justify-between w-full text-left px-3 py-2.5 text-xs tracking-wider transition-all";
        btn.innerHTML = `<span>${cat}</span>`;
        container.appendChild(btn);
    });
}

function renderMapPoints() {
    markersClusterGroup.clearLayers();

    const filtered = hotelData.filter(h => {
        const matchesCategory = (activeCategory === 'all' || h.category === activeCategory);
        const matchesCountry = (activeCountry === 'all' || h.country.toLowerCase() === activeCountry.toLowerCase());
        const matchesScore = (h.score >= minScoreFilter);
        const matchesSearch = h.name.toLowerCase().includes(searchQuery) || h.city.toLowerCase().includes(searchQuery);
        return matchesCategory && matchesCountry && matchesScore && matchesSearch;
    });

    document.getElementById('totalPropertiesText').textContent = `${filtered.length} Exceptional Properties`;

    filtered.forEach(loc => {
        const markerIcon = L.divIcon({
            html: `<div class="premium-dot-marker"></div>`,
            className: 'custom-dot-wrapper',
            iconSize: [16, 16]
        });

        const marker = L.marker([loc.lat, loc.lng], { icon: markerIcon });

        let webUrl = loc.website;
        if (webUrl !== '#' && !webUrl.startsWith('http://') && !webUrl.startsWith('https://')) {
            webUrl = 'https://' + webUrl;
        }

        const popupContent = `
            <div class="luxury-popup-card">
                <div class="popup-img-container">
                    <img src="${loc.image}" alt="${loc.name}">
                </div>
                <div class="popup-content-body">
                    <h2 class="popup-main-title">${loc.name}</h2>
                    <p class="popup-description">${loc.description}</p>
                    <div class="popup-details-grid">
                        <div class="detail-row">
                            <span class="stars-row">⭐⭐⭐⭐⭐</span>
                            <span class="detail-val font-semibold">${loc.score} / 150</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-lbl">Guest Rating:</span>
                            <span class="detail-val font-semibold">${loc.guestRating}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-lbl">Location:</span>
                            <span class="detail-val">📍 ${loc.city}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-lbl">Category:</span>
                            <span class="detail-val uppercase tracking-wider text-[10px] text-[#D4AF37] font-semibold">${loc.category}</span>
                        </div>
                    </div>
                    <a href="${webUrl}" target="_blank" class="popup-action-btn">Official Website</a>
                    <div class="popup-footer-id">
                        <span>Accreditation No:</span> <strong>${loc.id_code}</strong>
                    </div>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 320, minWidth: 320 });
        markersClusterGroup.addLayer(marker);
    });
}

function setupEventListeners() {
    document.getElementById('categoryContainer').addEventListener('click', (e) => {
        const btn = e.target.closest('.category-btn');
        if (!btn) return;
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.getAttribute('data-category');
        renderMapPoints();
    });

    document.getElementById('countryFilter').addEventListener('change', (e) => {
        activeCountry = e.target.value;
        renderMapPoints();
    });

    document.getElementById('scoreFilterGroup').addEventListener('click', (e) => {
        const btn = e.target.closest('.score-btn');
        if (!btn) return;
        document.querySelectorAll('.score-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        minScoreFilter = parseInt(btn.getAttribute('data-min-score'), 10);
        renderMapPoints();
    });

    document.getElementById('mapSearch').addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderMapPoints();
    });

    document.getElementById('resetFilters').addEventListener('click', () => {
        activeCategory = 'all'; activeCountry = 'all'; minScoreFilter = 0; searchQuery = '';
        document.getElementById('mapSearch').value = '';
        document.getElementById('countryFilter').value = 'all';
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-category="all"]').classList.add('active');
        document.querySelectorAll('.score-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-min-score="0"]').classList.add('active');
        renderMapPoints();
        map.setView([56.9462, 24.1059], 7);
    });
}

startApp();
