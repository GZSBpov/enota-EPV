// ==========================================
// EPV - MODUL ZA ZEMLJEVID IN SEKTORJE
// ==========================================

import { ZACETNE_KOORDINATE, ZACETNI_ZOOM, SLOVAR_BARV } from './config.js';

// Globalni spremenljivki za modul
export let map = null;
export const narisaniSektorjiSloj = new L.FeatureGroup();

/**
 * Inicializira Leaflet zemljevid, sloje (navadni + satelit) in orodja za risanje
 */
export function iniciirajZemljevid() {
    // 1. Definicija osnovnih podlog (Kartografija in Satelit)
    const navadniZemljevid = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    const satelitskiZemljevid = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    // 2. Ustvari zemljevid s privzetim navadnim slojem
    map = L.map('map', {
        center: ZACETNE_KOORDINATE,
        zoom: ZACETNI_ZOOM,
        layers: [navadniZemljevid] // Privzeti sloj ob zagonu
    });

    // 3. Dodaj sloj za narisane sektorje
    map.addLayer(narisaniSektorjiSloj);

    // 4. Dodaj kontrolnik za preklapljanje med podlogami (desno zgoraj)
    const osnovnePodloge = {
        "🗺️ Navadni zemljevid": navadniZemljevid,
        "🛰️ Satelitski posnetek": satelitskiZemljevid
    };

    const dodatniSloji = {
        "📐 Narisani sektorji": narisaniSektorjiSloj
    };

    L.control.layers(osnovnePodloge, dodatniSloji, { position: 'topright' }).addTo(map);

    // 5. Nastavi Leaflet Draw orodja za risanje
    const drawControl = new L.Control.Draw({
        position: 'topleft',
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

    // 6. Poslušalci dogodkov za risanje sektorjev
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
        <div style="font-size: 12px; min-width: 150px; color: #000;">
            <div style="font-weight: bold; margin-bottom: 5px;">Sektor (${imeBarve})</div>
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
 * Vrne vse narisane sektorje v GeoJSON formatu za shranjevanje v Google Sheet
 */
export function pridobiGeoJsonSektorjev() {
    return narisaniSektorjiSloj.toGeoJSON();
}
