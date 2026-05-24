const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSSzkCeYF5iB99OChWh54PD6a5q5KU8aEscJBvhN8yNRDuxogREkw2kzxi2QlLUOAmDYk1Kgttc0RMN/pub?output=csv';

const map = L.map('map', { center: [56.5, 18.00], zoom: 5.5, zoomControl: false, minZoom: 2, maxZoom: 21 });
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap © CARTO' }).addTo(map);

const markersClusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 35,
    showCoverageOnHover: false, // Tas noņem to zilo iekrāsojumu, kad uzbrauc virsū
    iconCreateFunction: function (cluster) {
        return L.divIcon({
            html: `<span>${cluster.getChildCount()}</span>`,
            className: 'custom-cluster', // Šī klase tev jābūt style.css
            iconSize: L.point(36, 36)
        });
    }
});

let hotelData = [];
let activeCategory = 'all';
let minScoreFilter = 0;

function parseTabularCSV(text) {
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    return parsed.data.map(row => ({
        name: row.Title || row.Property || row.Name || 'Unnamed Property',
        description: row.Description || 'Amber Star approved luxury property.',
        score: parseInt((row.AuditScore || '0').toString().split('/')[0]) || 0,
        guestRating: row.GuestRating || 'N/A',
        country: row.Country || 'LATVIA',
        city: row.City || '',
        category: (row.Category || 'HOTEL').toUpperCase(),
        website: row.Website || '#',
        id_code: row.Accreditation_No || 'AS-PENDING',
        lat: parseFloat((row.Latitude || row.latitude || '0').toString().replace(',', '.')),
        lng: parseFloat((row.Longitude || row.longitude || row.lng || '0').toString().replace(',', '.')),
        image: row.Image || 'https://images.unsplash.com/photo-1566073771259-6a8506099945'
    })).filter(h => !isNaN(h.lat) && !isNaN(h.lng));
}

function renderMapPoints() {
    markersClusterGroup.clearLayers();
    const searchVal = document.getElementById('mapSearch')?.value.toLowerCase() || '';
    const countryVal = document.getElementById('countryFilter')?.value || 'all';

    const filtered = hotelData.filter(h => {
        const matchesCategory = (activeCategory === 'all' || h.category === activeCategory);
        const matchesScore = (h.score >= minScoreFilter);
        const matchesCountry = (countryVal === 'all' || h.country.toLowerCase() === countryVal.toLowerCase());
        const matchesSearch = (h.name.toLowerCase().includes(searchVal) || h.city.toLowerCase().includes(searchVal));
        return matchesCategory && matchesScore && matchesCountry && matchesSearch;
    });

    document.getElementById('totalPropertiesText').textContent = `${filtered.length} Exceptional Properties`;

    filtered.forEach(loc => {
        const marker = L.marker([loc.lat, loc.lng], { icon: L.divIcon({ html: `<div class="premium-dot-marker"></div>`, className: 'custom-dot-wrapper', iconSize: [16, 16] }) });
        marker.on('click', (e) => L.DomEvent.stopPropagation(e));
        marker.bindPopup(`
            <div class="luxury-popup-card">
                <div class="popup-img-container"><img src="${loc.image}" alt="${loc.name}"></div>
                <div class="popup-content-body">
                    <h2 class="popup-main-title">${loc.name}</h2>
                    <p class="popup-description">${loc.description}</p>
                    <a href="${loc.website.startsWith('http') ? loc.website : 'https://'+loc.website}" target="_blank" class="popup-action-btn">Official Website</a>
                </div>
            </div>`, { maxWidth: 320 });
        markersClusterGroup.addLayer(marker);
    });
}

function buildCategoriesUI() {
    const container = document.getElementById('categoryContainer');
    if (!container) return;
    container.innerHTML = `<button data-category="all" class="category-btn active">ALL PROPERTIES</button>`;
    [...new Set(hotelData.map(h => h.category))].sort().forEach(cat => {
        if(!cat || cat === 'all') return;
        const btn = document.createElement('button');
        btn.setAttribute('data-category', cat);
        btn.className = "category-btn";
        btn.innerHTML = `<span>${cat}</span>`;
        container.appendChild(btn);
    });
}

function buildCountryFilter() {
    const select = document.getElementById('countryFilter');
    if (!select) return;
    const countries = [...new Set(hotelData.map(h => h.country).filter(Boolean))].sort();
    select.innerHTML = '<option value="all">All Countries</option>';
    countries.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; select.appendChild(o); });
}

function setupEventListeners() {
    document.getElementById('categoryContainer')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.category-btn');
        if (!btn) return;
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.getAttribute('data-category');
        renderMapPoints();
    });

    document.getElementById('scoreFilterGroup')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.score-btn');
        if (!btn) return;
        document.querySelectorAll('.score-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        minScoreFilter = parseInt(btn.getAttribute('data-min-score'), 10) || 0;
        renderMapPoints();
    });

    document.getElementById('resetFilters')?.addEventListener('click', () => {
        activeCategory = 'all'; minScoreFilter = 0;
        document.getElementById('mapSearch').value = '';
        document.getElementById('countryFilter').value = 'all';
        renderMapPoints();
    });

    document.getElementById('mapSearch')?.addEventListener('input', renderMapPoints);
    document.getElementById('countryFilter')?.addEventListener('change', renderMapPoints);
}

async function startApp() {
    try {
        const response = await fetch(CSV_URL);
        hotelData = parseTabularCSV(await response.text());
        buildCategoriesUI();
        buildCountryFilter();
        renderMapPoints();
        setupEventListeners();
    } catch (err) { console.error('Kļūda:', err); }
}

startApp();
