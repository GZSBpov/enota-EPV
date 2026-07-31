import { ZACETNE_KOORDINATE, ZACETNI_ZOOM, SLOVAR_BARV } from './config.js';

export let map;
export let narisaniSektorjiSloj;
export let enoteMarkerjiSloj;

export function iniciirajZemljevid() {
    map = L.map('map').setView(ZACETNE_KOORDINATE, ZACETNI_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    narisaniSektorjiSloj = new L.FeatureGroup().addTo(map);
    enoteMarkerjiSloj = new L.LayerGroup().addTo(map);

    const drawControl = new L.Control.Draw({
        edit: { featureGroup: narisaniSektorjiSloj },
        draw: {
            polygon: { allowIntersection: false, showArea: true },
            polyline: true,
            rectangle: true,
            circle: true,
            marker: false,
            circlemarker: false
        }
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (e) => {
        const layer = e.layer;
        const type = e.layerType;

        // Nastavimo privzeto barvo (rdeča)
        layer.options.barvaSektorja = "red";
        layer.options.geometrijaTip = type;

        narisaniSektorjiSloj.addLayer(layer);
        posodobiIzgledSektorja(layer, "red");
        nastaviPopupZaSektor(layer, "red");
    });
}

/**
 * Изračuna površino ali dolžino sloja
 */
export function izracunajVelikost(layer) {
    if (layer instanceof L.Circle) {
        const r = layer.getRadius();
        const area = Math.PI * r * r;
        return area > 10000 
            ? `Površina: ${(area / 1000000).toFixed(2)} km²` 
            : `Površina: ${Math.round(area)} m²`;
    } 
    else if (layer instanceof L.Polygon) {
        const latlngs = layer.getLatLngs()[0];
        // Uporaba Leafletove Geodesic obdelave ali poenostavljen izračun
        let area = 0;
        if (latlngs.length > 2) {
            area = L.GeometryUtil ? L.GeometryUtil.geodesicArea(latlngs) : 0;
        }
        if (area === 0) return "Območje";
        return area > 10000 
            ? `Površina: ${(area / 1000000).toFixed(2)} km²` 
            : `Površina: ${Math.round(area)} m²`;
    } 
    else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        const latlngs = layer.getLatLngs();
        let length = 0;
        for (let i = 0; i < latlngs.length - 1; i++) {
            length += latlngs[i].distanceTo(latlngs[i + 1]);
        }
        return length > 1000 
            ? `Dolžina: ${(length / 1000).toFixed(2)} km` 
            : `Dolžina: ${Math.round(length)} m`;
    }
    return "";
}

/**
 * Posodobi stil barve sloja
 */
export function posodobiIzgledSektorja(layer, barva) {
    const barveHex = {
        "red": "#ef4444",
        "blue": "#3b82f6",
        "green": "#10b981",
        "gold": "#eab308",
        "orange": "#f97316",
        "purple": "#a855f7"
    };
    const hex = barveHex[barva] || "#ef4444";
    
    if (layer.setStyle) {
        layer.setStyle({
            color: hex,
            fillColor: hex,
            fillOpacity: 0.35,
            weight: 3
        });
    }
    layer.options.barvaSektorja = barva;
}

/**
 * Ustvari okno (Popup) ob kliku na območje s padajočim menijem barv in izračunano mero
 */
export function nastaviPopupZaSektor(layer, izbranaBarva = "red") {
    const meroTekst = izracunajVelikost(layer);
    
    let opcijeBarv = "";
    for (const [kly, naziv] of Object.entries(SLOVAR_BARV)) {
        const sel = (kly === izbranaBarva) ? "selected" : "";
        opcijeBarv += `<option value="${kly}" ${sel}>${naziv}</option>`;
    }

    const htmlVsebina = `
        <div style="color: #000; font-family: sans-serif;">
            <strong style="font-size: 1rem;">Sektor / Območje</strong><br>
            <span style="font-size: 0.85rem; color: #475569;">${meroTekst}</span><br><br>
            <label style="font-size:0.8rem; font-weight:bold;">Barva sektorja:</label><br>
            <select class="popup-barva-select" style="width: 100%; padding: 4px; margin-top: 4px;">
                ${opcijeBarv}
            </select>
        </div>
    `;

    layer.bindPopup(htmlVsebina);

    layer.on('popupopen', (e) => {
        const popNode = e.popup.getElement();
        const selectEl = popNode.querySelector('.popup-barva-select');
        if (selectEl) {
            selectEl.addEventListener('change', (evt) => {
                const novaBarva = evt.target.value;
                posodobiIzgledSektorja(layer, novaBarva);
            });
        }
    });
}

/**
 * Pretvori vse objekte v ustrezno GeoJSON strukturo (z ohranitvijo poligonov/krogov/črt)
 */
export function pridobiGeoJsonSektorjev() {
    const elementi = [];
    narisaniSektorjiSloj.eachLayer((layer) => {
        let geojson = layer.toGeoJSON();
        geojson.properties = geojson.properties || {};
        geojson.properties.barvaSektorja = layer.options.barvaSektorja || "red";
        
        if (layer instanceof L.Circle) {
            geojson.properties.tipObmočja = "circle";
            geojson.properties.polmer = layer.getRadius();
        } else if (layer instanceof L.Rectangle) {
            geojson.properties.tipObmočja = "rectangle";
        } else if (layer instanceof L.Polygon) {
            geojson.properties.tipObmočja = "polygon";
        } else if (layer instanceof L.Polyline) {
            geojson.properties.tipObmočja = "polyline";
        }

        elementi.push(geojson);
    });
    return elementi;
}
