const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSSzkCeYF5iB99OChWh54PD6a5q5KU8aEscJBvhN8yNRDuxogREkw2kzxi2QlLUOAmDYk1Kgttc0RMN/pub?output=csv';

const map = L.map('map', { center: [56.5, 18.00], zoom: 5.5, zoomControl: false, minZoom: 2, maxZoom: 21 });
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap' }).addTo(map);

const markersClusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 35,
    showCoverageOnHover: false,
    iconCreateFunction: (cluster) => L.divIcon({ 
        html: `<span>${cluster.getChildCount()}</span>`, 
        className: 'custom-cluster', 
        iconSize: [36, 36] 
    })
});
map.addLayer(markersClusterGroup);

let hotelData = [];
let activeCategory = 'all';
let minScoreFilter = 0;

function parseTabularCSV(text) {
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    return parsed.data.map(row => ({
        name: row.Title || row.Property || row.Name || 'Unnamed',
        lat: parseFloat((row.Latitude || row.latitude || '0').toString().replace(',', '.')),
        lng: parseFloat((row.Longitude || row.longitude || '0').toString().replace(',', '.')),
        score: parseInt((row.AuditScore || '0').split('/')[0]) || 0,
        category: (row.Category || 'HOTEL').toUpperCase(),
        country: row.Country || 'LATVIA',
        city: row.City || '',
        image: row.Image || 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
        website: row.Website || '#'
    })).filter(h => !isNaN(h.lat) && !isNaN(h.lng));
}

function buildCategoriesUI() {
    const container = document.getElementById('categoryContainer');
    if (!container) return;
    const categories = [...new Set(hotelData.map(h => h.category))].sort();
    container.innerHTML = `<button data-category="all" class="category-btn active">ALL PROPERTIES</button>`;
    categories.forEach(cat => {
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
    countries.forEach(c => {
        const o = document.createElement('option');
        o.value = c; o.textContent = c;
        select.appendChild(o);
    });
}

function renderMapPoints() {
    markersClusterGroup.clearLayers();
    const searchVal = document.getElementById('mapSearch')?.value.toLowerCase() || '';
    const countryVal = document.getElementById('countryFilter')?.value || 'all';

    const filtered = hotelData.filter(h => 
        (activeCategory === 'all' || h.category === activeCategory) &&
        (h.score >= minScoreFilter) &&
        (countryVal === 'all' || h.country.toLowerCase() === countryVal.toLowerCase()) &&
        (h.name.toLowerCase().includes(searchVal) || h.city.toLowerCase().includes(searchVal))
    );

    const countEl = document.getElementById('totalPropertiesText');
    if (countEl) countEl.textContent = `${filtered.length} Exceptional Properties`;

    filtered.forEach(loc => {
        const marker = L.marker([loc.lat, loc.lng], { icon: L.divIcon({ html: `<div class="premium-dot-marker"></div>`, className: 'custom-dot-wrapper', iconSize: [16, 16] }) });
        marker.bindPopup(`<div class="luxury-popup-card"><h2>${loc.name}</h2><a href="${loc.website}" target="_blank">Website</a></div>`);
        markersClusterGroup.addLayer(marker);
    });
}

function setupEventListeners() {
    document.getElementById('categoryContainer')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.category-btn');
        if (!btn) return;
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.dataset.category;
        renderMapPoints();
    });

    document.getElementById('scoreFilterGroup')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.score-btn');
        if (!btn) return;
        document.querySelectorAll('.score-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        minScoreFilter = parseInt(btn.dataset.minScore || 0);
        renderMapPoints();
    });

    document.getElementById('resetFilters')?.addEventListener('click', () => {
        activeCategory = 'all'; 
        minScoreFilter = 0;
        if(document.getElementById('mapSearch')) document.getElementById('mapSearch').value = '';
        if(document.getElementById('countryFilter')) document.getElementById('countryFilter').value = 'all';
        document.querySelectorAll('.category-btn, .score-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-category="all"]')?.classList.add('active');
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
    } catch (err) { console.error('Kļūda ielādē:', err); }
}

startApp();
