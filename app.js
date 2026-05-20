const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSSzkCeYF5iB99OChWh54PD6a5q5KU8aEscJBvhN8yNRDuxogREkw2kzxi2QlLUOAmDYk1Kgttc0RMN/pub?output=csv';

// Inicializējam karti Baltijas reģionam
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

// Premium tumšais kartes slānis
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO'
}).addTo(map);

// Izteiktas ZELTA robežas valstīm (Salabots)
fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
    .then(res => res.json())
    .then(geoData => {
        const baltics = geoData.features.filter(f => ['LVA', 'LTU', 'EST'].includes(f.properties.ISO_A3));
        L.geoJSON(baltics, {
            style: { 
                color: '#D4AF37', 
                weight: 2, 
                fillColor: '#161920', 
                fillOpacity: 0.08, 
                dashArray: '4, 4' 
            }
        }).addTo(map);
    });

// Klasterēšana
const markersClusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 40,
    showCoverageOnHover: false,
    iconCreateFunction: function (cluster) {
        return L.divIcon({
            html: `<span>${cluster.getChildCount()}</span>`,
            className: 'custom-cluster',
            iconSize: L.point(40, 40)
        });
    }
});
map.addLayer(markersClusterGroup);

// Globālie filtru mainīgie
let hotelData = [];
let activeCategory = 'all';
let activeCountry = 'all';
let minScoreFilter = 0;
let searchQuery = '';

// GUDRAIS CSV PARSĒTĀJS - precīzi sadala kolonnas, ignorējot pēdiņas tekstā
function parseCSV(text) {
    const lines = text.split('\n');
    if (lines.length === 0) return [];
    
    // Notīrām kolonnu galvenes no neredzamiem simboliem
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    return lines.slice(1).filter(line => line.trim()).map(line => {
        const row = [];
        let insideQuote = false;
        let currentField = '';
        
        for (let i = 0; i < line.length; i++) {
            let char = line[i];
            if (char === '"') {
                insideQuote = !insideQuote;
            } else if (char === ',' && !insideQuote) {
                row.push(currentField.trim().replace(/^"|"$/g, ''));
                currentField = '';
            } else {
                currentField += char;
            }
        }
        row.push(currentField.trim().replace(/^"|"$/g, ''));
        
        // Izveidojam objektu katrai rindai
        return headers.reduce((obj, header, index) => {
            obj[header] = row[index] || '';
            return obj;
        }, {});
    });
}

async function startApp() {
    try {
        const response = await fetch(CSV_URL);
        if (!response.ok) throw new Error("Neizdevās lejupielādēt CSV");
        const csvText = await response.text();
        
        const parsed = parseCSV(csvText);
        
        // Kartējam datus tieši pēc taviem nosaukumiem tabulā
        hotelData = parsed.map(h => {
            const rawScore = h['Audit Score'] || h['Score'] || '0';
            return {
                name: h['Title'] || h['Hotel Name'] || h['Name'] || 'No Name',
                description: h['Description'] || '',
                score: parseInt(rawScore, 10) || 0,
                guestRating: h['Guest Rating'] || h['Rating'] || 'N/A',
                country: h['Country'] || 'Latvia',
                city: h['City'] || '',
                category: h['Category'] || 'General',
                website: h['Website'] || '#',
                id_code: h['Accreditation'] || h['ID'] || 'AS-PENDING',
                lat: parseFloat(h['Latitude']),
                lng: parseFloat(h['Longitude']),
                image: h['Image'] || "https://images.unsplash.com/photo-1566073771259-6a8506099945"
            };
        }).filter(h => !isNaN(h.lat) && !isNaN(h.lng));

        buildCategoriesUI();
        renderMapPoints();
        setupEventListeners();

    } catch (err) {
        console.error('Kļūda datu ielādē:', err);
    }
}

function buildCategoriesUI() {
    const container = document.getElementById('categoryContainer');
    const categories = [...new Set(hotelData.map(h => h.category))].sort();
    
    categories.forEach(cat => {
        if(!cat) return;
        const btn = document.createElement('button');
        btn.setAttribute('data-category', cat);
        btn.className = "category-btn flex items-center justify-between w-full text-left px-3 py-2 text-xs tracking-wide transition-all";
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

    // Atjaunojam kopējo skaitu apakšā ar tavu tekstu
    document.getElementById('totalPropertiesText').textContent = `${filtered.length} Exceptional Properties`;

    filtered.forEach(loc => {
        // LIELĀKA ZELTA IKONA UZ KARTES (Tavs ieteikums)
        const markerIcon = L.divIcon({
            html: `
                <div class="map-gold-star">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#D4AF37">
                        <path d="M12 2l2.4 7.4h7.8l-6.3 4.6 2.4 7.4-6.3-4.6-6.3 4.6 2.4-7.4-6.3-4.6h7.8z"/>
                    </svg>
                </div>
            `,
            className: 'custom-marker-wrapper',
            iconSize: [26, 26]
        });

        const marker = L.marker([loc.lat, loc.lng], { icon: markerIcon });

        // LUKSUSA KARTĪTE: Bez fona, plāna zelta maliņa, īsts zelta Ribbon stūrī
        const popupContent = `
            <div class="premium-card">
                <div class="card-image-box">
                    <img src="${loc.image}" alt="${loc.name}">
                    <div class="luxury-ribbon">
                        <span class="ribbon-brand">Amber</span>
                        <span class="ribbon-star">Star</span>
                    </div>
                </div>
                <div class="card-body">
                    <div class="card-accreditation">${loc.id_code}</div>
                    <h3 class="card-title">${loc.name}</h3>
                    <div class="card-location">📍 ${loc.city}, ${loc.country.toUpperCase()}</div>
                    
                    <div class="card-metrics">
                        <div class="metric-score">
                            <span class="stars-gold">⭐⭐⭐⭐⭐</span>
                            <span class="score-value">${loc.score} / 150</span>
                        </div>
                        <div class="metric-guest">
                            Guest Rating: <span class="guest-value">${loc.guestRating}</span>
                        </div>
                    </div>
                    
                    <p class="card-desc">${loc.description}</p>
                    <a href="${loc.website}" target="_blank" class="card-btn">View Property Website ↗</a>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 340, minWidth: 340 });
        markersClusterGroup.addLayer(marker);
    });
}

function setupEventListeners() {
    // Sānu joslas kategorijas
    document.getElementById('categoryContainer').addEventListener('click', (e) => {
        const btn = e.target.closest('.category-btn');
        if (!btn) return;
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.getAttribute('data-category');
        renderMapPoints();
    });

    // Valstu filtrs (All Countries)
    document.getElementById('countryFilter').addEventListener('change', (e) => {
        activeCountry = e.target.value;
        renderMapPoints();
    });

    // Vērtējuma līmeņu filtri (130+, 140+)
    document.getElementById('scoreFilterGroup').addEventListener('click', (e) => {
        const btn = e.target.closest('.score-btn');
        if (!btn) return;
        document.querySelectorAll('.score-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        minScoreFilter = parseInt(btn.getAttribute('data-min-score'), 10);
        renderMapPoints();
    });

    // Meklētājs
    document.getElementById('mapSearch').addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderMapPoints();
    });

    // Filtru atiestatīšana
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
