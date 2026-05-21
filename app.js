// ŠEIT IEKOPĒ SAVU SAITI
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSSzkCeYF5iB99OChWh54PD6a5q5KU8aEscJBvhN8yNRDuxogREkw2kzxi2QlLUOAmDYk1Kgttc0RMN/pub?output=csv';

const map = L.map('map', {
    center: [56.5, 18.00],
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
let activeCountry = 'all';
let minScoreFilter = 0;
let searchQuery = '';

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
    const idxImage = headers.findIndex(h => h.includes('image'));
    const idxCountry = headers.findIndex(h => h.includes('country'));

    return lines.slice(1).map(line => {
        const row = line.split(sep).map(item => item.trim().replace(/^"|"$/g, ''));
        if (row.length < 3) return null;

        let latStr = idxLat !== -1 ? (row[idxLat] || '').replace(',', '.') : '0';
        let lngStr = idxLng !== -1 ? (row[idxLng] || '').replace(',', '.') : '0';

        return {
            name: idxName !== -1 ? row[idxName] : 'Unnamed Property',
            description: idxDesc !== -1 ? (row[idxDesc] || 'Amber Star approved luxury property.') : 'Amber Star approved luxury property.',
            score: parseInt((idxScore !== -1 ? (row[idxScore] || '0').split('/')[0].trim() : '0'), 10) || 0,
            guestRating: idxRating !== -1 ? (row[idxRating] || 'N/A') : 'N/A',
            country: idxCountry !== -1 ? (row[idxCountry] || 'LATVIA') : 'LATVIA',
            city: idxLocation !== -1 ? row[idxLocation] : '',
            category: idxCategory !== -1 ? (row[idxCategory] || 'HOTEL').toUpperCase() : 'HOTEL',
            website: idxPlatform !== -1 ? (row[idxPlatform] || '#') : '#',
            id_code: idxId !== -1 ? row[idxId] : 'AS-PENDING',
            lat: parseFloat(latStr),
            lng: parseFloat(lngStr),
            image: (idxImage !== -1 && row[idxImage] && row[idxImage].trim() !== '') ? row[idxImage] : "https://images.unsplash.com/photo-1566073771259-6a8506099945"
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
    } catch (err) { console.error('Kļūda:', err); }
}

function renderMapPoints() {
    markersClusterGroup.clearLayers();
    
    const searchInput = document.getElementById('mapSearch');
    const countryFilter = document.getElementById('countryFilter');
    const searchVal = searchInput ? searchInput.value.toLowerCase() : '';
    const countryVal = countryFilter ? countryFilter.value : 'all';

    const filtered = hotelData.filter(h => {
        const matchesCategory = (activeCategory === 'all' || h.category === activeCategory);
        const matchesScore = (h.score >= minScoreFilter);
        const matchesCountry = (countryVal === 'all' || h.city.toLowerCase().includes(countryVal.toLowerCase()));
        const matchesSearch = (h.name.toLowerCase().includes(searchVal) || h.city.toLowerCase().includes(searchVal));
        
        return matchesCategory && matchesScore && matchesCountry && matchesSearch;
    });

    document.getElementById('totalPropertiesText').textContent = `${filtered.length} Exceptional Properties`;

    filtered.forEach(loc => {
        const marker = L.marker([loc.lat, loc.lng], { icon: L.divIcon({ html: `<div class="premium-dot-marker"></div>`, className: 'custom-dot-wrapper', iconSize: [16, 16] }) });
// Atrodi šo vietu iekšā renderMapPoints funkcijā:

const popupContent = `
    <div class="luxury-popup-card" style="width: 320px;">
        <div class="popup-img-container" style="height: 150px; overflow: hidden;">
            <img src="${loc.image}" alt="${loc.name}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
        <div class="popup-content-body" style="padding: 12px;">
            <h2 class="popup-main-title" style="margin: 0 0 8px 0; font-size: 16px; color: #ffffff;">${loc.name}</h2>
            <p class="popup-description" style="margin: 0 0 10px 0; font-size: 13px; color: #E8E3D9;">${loc.description}</p>
            
            <div class="popup-details-grid" style="display: grid; gap: 5px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; color: #E8E3D9;">
                    <span>Audit Score:</span>
                    <span class="detail-val font-semibold" style="color: #ffffff;">${loc.score} / 150</span>
                </div>
                <div style="display: flex; justify-content: space-between; color: #E8E3D9;">
                    <span>Guest Rating:</span>
                    <span class="detail-val font-semibold" style="color: #ffffff;">${loc.guestRating}</span>
                </div>
                <div style="display: flex; justify-content: space-between; color: #E8E3D9;">
                    <span>Location:</span>
                    <span class="detail-val" style="color: #ffffff;">📍 ${loc.city}</span>
                </div>
            </div>

<a href="${loc.website.startsWith('http') ? loc.website : 'https://'+loc.website}" target="_blank" class="popup-action-btn">Official Website</a>
            
            <div style="margin-top: 10px; text-align: center; color: #D4AF37; font-size: 10px; letter-spacing: 1px;">
                ${loc.id_code}
            </div>
        </div>
    </div>`;
            
        marker.bindPopup(popupContent, { maxWidth: 320, minWidth: 320 });
        markersClusterGroup.addLayer(marker);
    });
}

function buildCategoriesUI() {
    const container = document.getElementById('categoryContainer');
    if (!container) return;

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

function setupEventListeners() {
    // 1. Kategoriju filtrs
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

    // 2. Meklētājs (IZNESTS ĀRĀ)
    const mapSearch = document.getElementById('mapSearch');
    if (mapSearch) {
        mapSearch.addEventListener('input', () => {
            renderMapPoints();
        });
    }

    // 3. Valstu filtrs (IZNESTS ĀRĀ)
    const countryFilter = document.getElementById('countryFilter');
    if (countryFilter) {
        countryFilter.addEventListener('change', () => {
            renderMapPoints();
        });
    }

    // 4. Punktu (Score) filtrs
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

    // 5. Reset poga
    const resetBtn = document.getElementById('resetFilters');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            activeCategory = 'all';
            minScoreFilter = 0;
            document.getElementById('mapSearch').value = '';
            document.getElementById('countryFilter').value = 'all';
            document.querySelectorAll('.category-btn, .score-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('[data-category="all"]')?.classList.add('active');
            renderMapPoints();
        });
    }
}

startApp();
