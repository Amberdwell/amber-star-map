
// ŠEIT IEKOPĒ SAVU SAITI
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSSzkCeYF5iB99OChWh54PD6a5q5KU8aEscJBvhN8yNRDuxogREkw2kzxi2QlLUOAmDYk1Kgttc0RMN/pub?output=csv';

// Ieliec šo pirms jebkura cita koda app.js failā
const mapContainer = window.innerWidth < 768 ? 'map-mobile' : 'map';

// Tavs app.js
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

    const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true
    });

    return parsed.data.map(row => {

        const lat = parseFloat(
            (row.Latitude || row.latitude || '0')
            .toString()
            .replace(',', '.')
        );

        const lng = parseFloat(
            (row.Longitude || row.longitude || row.lng || '0')
            .toString()
            .replace(',', '.')
        );

        return {

            name:
                row.Title ||
                row.Property ||
                row.Name ||
                'Unnamed Property',

            description:
                row.Description ||
                'Amber Star approved luxury property.',

            score:
                parseInt(
                    (row.AuditScore || '0')
                    .toString()
                    .split('/')[0]
                ) || 0,

            guestRating:
                row.GuestRating || 'N/A',

            country:
                row.Country || 'LATVIA',

            city:
                row.City || '',

            category:
                (
                    row.Category ||
                    'HOTEL'
                ).toUpperCase(),

            website:
                row.Website || '#',

            id_code:
                row.Accreditation_No ||
                'AS-PENDING',

            lat,
            lng,

            image:
                row.Image ||
                'https://images.unsplash.com/photo-1566073771259-6a8506099945'
        };

    }).filter(h =>
        !isNaN(h.lat) &&
        !isNaN(h.lng)
    );
}

function buildCountryFilter() {
    const select = document.getElementById('countryFilter');
    if (!select) return;

    const countries = [...new Set(hotelData.map(h => h.country).filter(Boolean))].sort();

    select.innerHTML = '<option value="all">All Countries</option>';

    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        select.appendChild(option);
    });
}

async function startApp() {
    try {
        const response = await fetch(CSV_URL);
        if (!response.ok) throw new Error("Nevar ielādēt datus");
        const csvText = await response.text();
        hotelData = parseTabularCSV(csvText);
        buildCategoriesUI();
        buildCountryFilter();
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
        const matchesCountry =(countryVal === 'all' || h.country.toLowerCase() === countryVal.toLowerCase());
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

window.addEventListener('resize', () => {
    // Pārlādējam lapu, ja mainās orientācija, lai pareizi pārslēgtu kartes konteineru
    location.reload(); 
});

startApp();
