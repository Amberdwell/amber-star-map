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
        if (webUrl !== '#' && !webUrl.startsWith('http')) { webUrl = 'https://' + webUrl; }

        // Šeit ir viss saturs, kas tev pazuda
        const popupContent = `
            <div class="luxury-popup-card" style="width: 320px;">
                <div class="popup-img-container" style="height: 150px; overflow: hidden;">
                    <img src="${loc.image}" alt="${loc.name}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div class="popup-content-body" style="padding: 12px;">
                    <h2 class="popup-main-title" style="margin: 0 0 8px 0; font-size: 16px;">${loc.name}</h2>
                    <p class="popup-description" style="margin: 0 0 10px 0; font-size: 13px;">${loc.description}</p>
                    <div class="popup-details-grid" style="display: grid; gap: 5px; margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Guest Rating:</span>
                            <span class="detail-val font-semibold">${loc.guestRating || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Location:</span>
                            <span class="detail-val">📍 ${loc.city || 'Latvia'}</span>
                        </div>
                    </div>
                    <a href="${webUrl}" target="_blank" class="popup-action-btn" style="display: block; margin-top: 12px; text-align: center; background: #333; color: white; padding: 8px; text-decoration: none; font-size: 12px;">Official Website</a>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 320, minWidth: 320 });
        markersClusterGroup.addLayer(marker);
    });
}
