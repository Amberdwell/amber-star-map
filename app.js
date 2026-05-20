const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSSzkCeYF5iB99OChWh54PD6a5q5KU8aEscJBvhN8yNRDuxogREkw2kzxi2QlLUOAmDYk1Kgttc0RMN/pub?output=csv';

// Inicializējam karti ar viena pirksta optimizāciju mobilajām ierīcēm
const map = L.map('map', {
    center: [57.0000, 24.5000],
    zoom: 7,
    zoomControl: false,
    minZoom: 6,
    maxZoom: 14,
    touchZoom: 'center',
    doubleClickZoom: true,
    tap: true 
});

L.control.zoom({ position: 'bottomright' }).addTo(map);

// Pamatslānis
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO'
}).addTo(map);

document.querySelector('.leaflet-tile-container').style.filter = 'contrast(1.05) brightness(0.9) saturate(0.3)';

// Zelta valstu robežas Baltijai
fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
    .then(res => res.json())
    .then(geoData => {
        const baltics = geoData.features.filter(f => ['LVA', 'LTU', 'EST'].includes(f.properties.ISO_A3));
        L.geoJSON(baltics, {
            style: { color: '#D4AF37', weight: 1.5, fillColor: '#242426', fillOpacity: 0.15, dashArray: '3' }
        }).addTo(map);
    });

// Klasterēšanas grupa
const markersClusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 45, 
    showCoverageOnHover: false,
    iconCreateFunction: function (cluster) {
        return L.divIcon({
            html: `<span>${cluster.getChildCount()}</span>`,
            className: 'custom-cluster',
            iconSize: L.point(38, 38)
        });
    }
});
map.addLayer(markersClusterGroup);

// Stāvokļa mainīgie
let hotelData = [];
let activeCategory = 'all';
let minScoreFilter = 0;
let searchQuery = '';

// CSV parsētājs, kas saprot kolonnu nosaukumus ar atstarpēm
function parseCSV(text) {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).filter(line => line.trim()).map(line => {
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        const row = matches.map(val => val.replace(/^"|"$/g, '').trim());
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
        
        // Kartējam datus atbilstoši JŪSU kolonnu nosaukumiem
        hotelData = parseCSV(csvText).map(h => ({
            name: h['Title'] || 'No Name',
            description: h['Description'] || '',
            score: parseInt(h['Audit Score'] || 0, 10),
            guestRating: h['Guest Rating'] || '',
            country: h['Country'] || 'Baltics',
            city: h['City'] || '',
            category: h['Category'] || 'General',
            website: h['Website'] || '#',
            id_code: h['Accreditation'] || 'AS-PENDING',
            lat: parseFloat(h['Latitude']),
            lng: parseFloat(h['Longitude']),
            image: "https://images.unsplash.com/photo-1566073771259-6a8506099945" 
        })).filter(h => !isNaN(h.lat) && !isNaN(h.lng));

        buildCategoriesUI();
        renderMapPoints();
        setupEventListeners();

    } catch (err) {
        console.error('Kļūda ielādējot Google Sheets.');
    }
}

function buildCategoriesUI() {
    const container = document.getElementById('categoryContainer');
    document.getElementById('totalCountBadge').textContent = hotelData.length;
    const categories = [...new Set(hotelData.map(h => h.category))].sort();
    
    categories.forEach(cat => {
        const count = hotelData.filter(h => h.category === cat).length;
        const btn = document.createElement('button');
        btn.setAttribute('data-category', cat);
        btn.className = "category-btn flex items-center justify-between w-full text-left px-3 py-2.5 text-xs tracking-wide transition-all";
        btn.innerHTML = `<span>📍 ${cat}</span><span class="bg-[#161920] text-[#A39F99] px-2 py-0.5 text-[10px] font-mono border border-[#2A303C]">${count}</span>`;
        container.appendChild(btn);
    });
}

function renderMapPoints() {
    markersClusterGroup.clearLayers();

    const filtered = hotelData.filter(h => {
        const matchesCategory = (activeCategory === 'all' || h.category === activeCategory);
        const matchesScore = (h.score >= minScoreFilter);
        const matchesSearch = h.name.toLowerCase().includes(searchQuery) || h.city.toLowerCase().includes(searchQuery);
        return matchesCategory && matchesScore && matchesSearch;
    });

    filtered.sort((a, b) => b.score - a.score);

    filtered.forEach(loc => {
        const markerIcon = L.divIcon({
            html: `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l2.4 7.4h7.8l-6.3 4.6 2.4 7.4-6.3-4.6-6.3 4.6 2.4-7.4-6.3-4.6h7.8z"/>
                </svg>
            `,
            className: 'custom-marker',
            iconSize: [28, 28]
        });

        const marker = L.marker([loc.lat, loc.lng], { icon: markerIcon });

        const popupContent = `
            <div class="w-full flex flex-col font-['Inter']">
                <div class="h-48 w-full bg-[#161920] relative overflow-hidden">
                    <img src="${loc.image}" alt="${loc.name}" class="object-cover w-full h-full transform hover:scale-105 transition-transform duration-700">
                    <div class="absolute top-0 right-0 bg-[#D4AF37] text-[#0F1115] text-[9px] tracking-[0.2em] uppercase font-bold px-3 py-4 flex flex-col items-center justify-center">
                        <span>Amber</span>
                        <span>Star</span>
                    </div>
                </div>
                <div class="p-5 bg-[#0F1115]">
                    <span class="block text-[9px] font-mono text-[#D4AF37] tracking-widest uppercase mb-1">${loc.id_code}</span>
                    <h3 class="text-xl font-['Cormorant_Garamond'] font-semibold text-white leading-tight mb-1">${loc.name}</h3>
                    <div class="text-[11px] text-[#A39F99] mb-3">📍 ${loc.city}, ${loc.country}</div>
                    
                    <div class="flex items-center gap-4 mb-4">
                        <div>
                            <span class="text-[#D4AF37] text-xs">⭐⭐⭐⭐⭐</span>
                            <span class="text-xs text-white font-bold ml-1">${loc.score} / 150</span>
                        </div>
                        ${loc.guestRating ? `
                        <div class="border-l border-[#2A303C] pl-3 text-xs text-[#A39F99]">
                            Guest: <span class="text-white font-medium">${loc.guestRating}</span>
                        </div>` : ''}
                    </div>
                    <p class="text-xs text-[#A39F99] leading-relaxed line-clamp-3 mb-5 font-light">${loc.description}</p>
                    <div class="grid grid-cols-1">
                        <a href="${loc.website}" target="_blank" class="text-center bg-[#D4AF37] text-[#0F1115] text-[10px] uppercase tracking-widest py-3 font-medium hover:bg-white transition-colors">View Property Website ↗</a>
                    </div>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 340, minWidth: 340 });
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

    document.getElementById('scoreFilterGroup').addEventListener('click', (e) => {
        const btn = e.target.closest('.score-btn');
        if (!btn) return;
        minScoreFilter = parseInt(btn.getAttribute('data-min-score'), 10);
        renderMapPoints();
    });

    document.getElementById('mapSearch').addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderMapPoints();
    });

    document.getElementById('resetFilters').addEventListener('click', () => {
        activeCategory = 'all'; minScoreFilter = 0; searchQuery = '';
        document.getElementById('mapSearch').value = '';
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-category="all"]').classList.add('active');
        renderMapPoints();
        map.setView([57.0000, 24.5000], 7);
    });
}

startApp();
