const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSSzkCeYF5iB99OChWh54PD6a5q5KU8aEscJBvhN8yNRDuxogREkw2kzxi2QlLUOAmDYk1Kgttc0RMN/pub?output=csv';

const map = L.map('map', {
    center: [57.0000, 24.5000],
    zoom: 7,
    zoomControl: false,
    minZoom: 6,
    maxZoom: 14,
    touchZoom: 'center',
    doubleClickZoom: true
});

L.control.zoom({ position: 'bottomright' }).addTo(map);

// Atgriezta gaiši pelēkā karte pēc pieprasījuma
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO'
}).addTo(map);

// Valstu robežas
fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
    .then(res => res.json())
    .then(geoData => {
        const baltics = geoData.features.filter(f => ['LVA', 'LTU', 'EST'].includes(f.properties.ISO_A3));
        L.geoJSON(baltics, {
            style: { 
                color: '#B38F2D', 
                weight: 2, 
                fillColor: '#000000', 
                fillOpacity: 0.02, 
                dashArray: '3, 4' 
            }
        }).addTo(map);
    });

const markersClusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 40,
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

// Universāls parsētājs, kas saprot gan komatus, gan reģionālos semikolus (;) no Google Sheets
function parseCSV(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length === 0) return [];
    
    const separator = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
    
    return lines.slice(1).map(line => {
        const row = [];
        let insideQuote = false;
        let currentField = '';
        
        for (let i = 0; i < line.length; i++) {
            let char = line[i];
            if (char === '"') {
                insideQuote = !insideQuote;
            } else if (char === separator && !insideQuote) {
                row.push(currentField.trim().replace(/^"|"$/g, ''));
                currentField = '';
            } else {
                currentField += char;
            }
        }
        row.push(currentField.trim().replace(/^"|"$/g, ''));
        
        return headers.reduce((obj, header, index) => {
            obj[header] = row[index] || '';
            return obj;
        }, {});
    });
}

async function startApp() {
    try {
        const response = await fetch(CSV_URL);
        if (!response.ok) throw new Error();
        const csvText = await response.text();
        const parsed = parseCSV(csvText);
        
        hotelData = parsed.map(h => {
            const rawScore = h['Audit Score'] || '0';
            return {
                name: h['Title'] || 'Unnamed Property',
                description: h['Description'] || '',
                score: parseInt(rawScore, 10) || 0,
                guestRating: h['Guest Rating'] || 'N/A',
                country: h['Country'] || 'Latvia',
                city: h['City'] || '',
                category: (h['Category'] || 'HOTEL').trim().toUpperCase(),
                website: h['Website'] || '#',
                id_code: h['Accreditation'] || 'AS-PENDING',
                lat: parseFloat(h['Latitude']),
                lng: parseFloat(h['Longitude']),
                image: h['Image'] || "https://images.unsplash.com/photo-1566073771259-6a8506099945"
            };
        }).filter(h => !isNaN(h.lat) && !isNaN(h.lng));

        buildCategoriesUI();
        renderMapPoints();
        setupEventListeners();

    } catch (err) {
        console.error('Data sync failed:', err);
    }
}

function buildCategoriesUI() {
    const container = document.getElementById('categoryContainer');
    const categories = [...new Set(hotelData.map(h => h.category))].sort();
    
    categories.forEach(cat => {
        if(!cat) return;
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
        // Perfekti apaļi, minimālistiski zelta punkti uz kartes
        const markerIcon = L.divIcon({
            html: `<div class="premium-dot-marker"></div>`,
            className: 'custom-dot-wrapper',
            iconSize: [16, 16]
        });

        const marker = L.marker([loc.lat, loc.lng], { icon: markerIcon });

        // Kartītes uzbūve un secība pēc pieprasījuma
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
                            <span class="detail-val">📍 ${loc.city}, ${loc.country.toUpperCase()}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-lbl">Category:</span>
                            <span class="detail-val uppercase tracking-wider text-[10px] text-[#D4AF37] font-semibold">${loc.category}</span>
                        </div>
                    </div>
                    
                    <a href="${loc.website}" target="_blank" class="popup-action-btn">Official Website</a>
                    
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
        map.setView([57.0000, 24.5000], 7);
    });
}

startApp();
