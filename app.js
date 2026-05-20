// ŠEIT IEKOPĒ SAVU SAITI
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSSzkCeYF5iB99OChWh54PD6a5q5KU8aEscJBvhN8yNRDuxogREkw2kzxi2QlLUOAmDYk1Kgttc0RMN/pub?output=csv';

const map = L.map('map', { center: [55.50, 17.00], zoom: 5, zoomControl: false, minZoom: 2, maxZoom: 20 });
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap © CARTO' }).addTo(map);

const markersClusterGroup = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 35, showCoverageOnHover: false, iconCreateFunction: function (cluster) {
    return L.divIcon({ html: `<span>${cluster.getChildCount()}</span>`, className: 'custom-cluster', iconSize: L.point(36, 36) });
}});
map.addLayer(markersClusterGroup);

let hotelData = [];
let activeCategory = 'all', activeCountry = 'all', minScoreFilter = 0, searchQuery = '';

function parseTabularCSV(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) return [];
    let sep = ','; if (lines[0].split('\t').length > lines[0].split(',').length) sep = '\t';
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    const idxId = headers.findIndex(h => h.includes('accreditation')),
          idxName = headers.findIndex(h => h.includes('name') || h.includes('title')),
          idxLocation = headers.findIndex(h => h.includes('city')),
          idxScore = headers.findIndex(h => h.includes('audit')),
          idxRating = headers.findIndex(h => h.includes('guest')),
          idxPlatform = headers.findIndex(h => h.includes('web')),
          idxCategory = headers.findIndex(h => h.includes('cat')),
          idxLat = headers.findIndex(h => h.includes('lat')),
          idxLng = headers.findIndex(h => h.includes('long') || h === 'lng'),
          idxDesc = headers.findIndex(h => h.includes('desc')),
          idxImage = headers.findIndex(h => h.includes('image'));

    return lines.slice(1).map(line => {
        const row = line.split(sep).map(item => item.trim().replace(/^"|"$/g, ''));
        if (row.length < 3) return null;
        return {
            name: idxName !== -1 ? row[idxName] : 'Property',
            description: idxDesc !== -1 ? row[idxDesc] : 'Amber Star approved.',
            score: parseInt((idxScore !== -1 ? (row[idxScore] || '0').split('/')[0].trim() : '0'), 10) || 0,
            guestRating: idxRating !== -1 ? row[idxRating] : 'N/A',
            city: idxLocation !== -1 ? row[idxLocation] : '',
            category: idxCategory !== -1 ? (row[idxCategory] || 'HOTEL').toUpperCase() : 'HOTEL',
            website: idxPlatform !== -1 ? row[idxPlatform] : '#',
            id_code: idxId !== -1 ? row[idxId] : 'AS-PENDING',
            lat: parseFloat((idxLat !== -1 ? row[idxLat] : '0').replace(',', '.')),
            lng: parseFloat((idxLng !== -1 ? row[idxLng] : '0').replace(',', '.')),
            image: (idxImage !== -1 && row[idxImage] && row[idxImage].trim() !== '') ? row[idxImage] : "https://images.unsplash.com/photo-1566073771259-6a8506099945"
        };
    }).filter(h => !isNaN(h.lat) && !isNaN(h.lng));
}

function renderMapPoints() {
    markersClusterGroup.clearLayers();
    const filtered = hotelData.filter(h => (activeCategory === 'all' || h.category === activeCategory) && (h.score >= minScoreFilter));
    document.getElementById('totalPropertiesText').textContent = `${filtered.length} Exceptional Properties`;
    
    filtered.forEach(loc => {
        const marker = L.marker([loc.lat, loc.lng], { icon: L.divIcon({ html: `<div class="premium-dot-marker"></div>`, className: 'custom-dot-wrapper', iconSize: [16, 16] }) });
        marker.bindPopup(`
            <div class="luxury-popup-card" style="width: 320px;">
                <div style="height: 150px; overflow: hidden;"><img src="${loc.image}" style="width: 100%; height: 100%; object-fit: cover;"></div>
                <div style="padding: 12px;">
                    <h2 style="margin: 0 0 5px 0; font-size: 16px;">${loc.name}</h2>
                    <p style="font-size: 13px; margin-bottom: 10px;">${loc.description}</p>
                    <div style="font-size: 12px; margin-bottom: 10px;">
                        <div>Audit Score: <b>${loc.score} / 150</b></div>
                        <div>Guest Rating: <b>${loc.guestRating}</b></div>
                        <div>Location: <b>${loc.city}</b></div>
                    </div>
                    <a href="${loc.website.startsWith('http') ? loc.website : 'https://'+loc.website}" target="_blank" style="display: block; background: #333; color: white; text-align: center; padding: 8px; text-decoration: none;">Official Website</a>
                    <div style="margin-top: 10px; text-align: center; color: #D4AF37; font-size: 10px; letter-spacing: 1px;">${loc.id_code}</div>
                </div>
            </div>`, { maxWidth: 320 });
        markersClusterGroup.addLayer(marker);
    });
}

async function startApp() { try { const res = await fetch(CSV_URL); hotelData = parseTabularCSV(await res.text()); renderMapPoints(); setupEventListeners(); buildCategoriesUI(); } catch (err) { console.error(err); } }
function buildCategoriesUI() { /* tavas funkcijas */ }
function setupEventListeners() { /* tavas funkcijas */ }
startApp();
