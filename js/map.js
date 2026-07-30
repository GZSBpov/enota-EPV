// ==========================================
// EPV - MODUL ZA ZEMLJEVID IN SEKTORJE
// ==========================================

import { ZACETNE_KOORDINATE, ZACETNI_ZOOM, SLOVAR_BARV } from './config.js';

// Globalni spremenljivki za modul
export let map = null;
export const narisaniSektorjiSloj = new L.FeatureGroup();

/**
 * Inicializira Leaflet zemljevid in orodja za risanje
 */
export function iniciirajZemljevid() {
    // 1. Ustvari zemljevid
    map = L.map('map').setView(ZACETNE_KOORDINATE, ZACETNI_ZOOM);

    // 2. Dodaj kartografsko podlogo (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // 3. Dodaj sloj za narisane sektorje na zemljevid
    map.addLayer(narisaniSektorjiSloj);

    // 4. Nastavi Leaflet Draw orodja
    const drawControl = new L.Control.Draw({
        draw: {
            polyline: true,
            polygon: true,
            circle: true,
            rectangle: true,
            marker: true,
            circlemarker: false
        },
        edit: {
            featureGroup: narisaniSektorjiSloj,
            remove: true
        }
    });
    map.addControl(drawControl);

    // 5. Poslušalci dogodkov za risanje
    map.on(L.Draw.Event.CREATED, (e) => {
        const layer = e.layer;
        narisaniSektorjiSloj.addLayer(layer);
        nastaviPopupZaSektor(layer, "red"); // Privzeta barva ob nastanku
    });

    return map;
}

/**
 * Nastavi ali posodobi Popup vsebino in barvo za narisani sektor
 * @param {L.Layer} layer - Leaflet sloj (poligon, marker, krog...)
 * @param {string} barva - Kljuc barve iz SLOVAR_BARV (npr. 'red', 'blue')
 */
export function nastaviPopupZaSektor(layer, barva = "red") {
    const imeBarve = SLOVAR_BARV[barva] || barva;
    
    // Ustvarjanje vsebine Popup-a
    const htmlVsebina = `
        <div style="font-size: 12px; min-width: 150px;">
            <div class="sektor-popup-naslov">Sektor (${imeBarve})</div>
            <label style="font-size: 11px; display: block; margin-bottom: 4px;">Barva sektorja:</label>
            <select class="izbira-barve-sektorja" style="width: 100%; padding: 3px; font-size: 11px;">
                ${Object.keys(SLOVAR_BARV).map(bKljuc => `
                    <option value="${bKljuc}" ${bKljuc === barva ? 'selected' : ''}>
                        ${SLOVAR_BARV[bKljuc]}
                    </option>
                `).join('')}
            </select>
        </div>
    `;

    layer.bindPopup(htmlVsebina);

    // Sprememba barve objekta na zemljevidu (če gre za poligon/krog/črto)
    if (layer.setStyle) {
        layer.setStyle({
            color: barva,
            fillColor: barva,
            fillOpacity: 0.3
        });
    }

    // Shrani izbrano barvo v opcije sloja za kasnejši izvoz v GeoJSON
    layer.options.barvaSektorja = barva;
}

/**
 * Vrne vse narisane sektorje v GeoJSON formatu
 */
export function pridobiGeoJsonSektorjev() {
    return narisaniSektorjiSloj.toGeoJSON();
}
