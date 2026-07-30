// ==========================================
// EPV - MODUL ZA ENOTE IN SLEJENJE (GPS)
// ==========================================

import { map } from './map.js';

// Sloji za markerje enot in njihove poti (polylines)
export const enoteSloj = new L.FeatureGroup();
export const slediSloj = new L.FeatureGroup();

// Lokalna shramba za sledenje enot (struktura: { enotaId: { marker, pathLayer, coords: [] } })
const enoteBaza = {};

/**
 * Inicializira sloje za enote na zemljevidu
 */
export function iniciirajSlojeEnot() {
    if (map) {
        map.addLayer(slediSloj);
        map.addLayer(enoteSloj);
    }
}

/**
 * Posodobi ali doda enoto na zemljevid ter v stransko vrstico
 * @param {Object} enota - Objekt z podatki enote (id, naziv, lat, lng, tip, status...)
 */
export function posodobiEnoto(enota) {
    if (!enota || !enota.id || !enota.lat || !enota.lng) return;

    const latLng = [enota.lat, enota.lng];

    // Če enota še ne obstaja v bazi, jo ustvarimo
    if (!enoteBaza[enota.id]) {
        // Ustvarjanje markerja za enoto
        const marker = L.marker(latLng, {
            title: enota.naziv
        });

        // Stalni napis (Tooltip) nad markerjem
        marker.bindTooltip(enota.naziv, {
            permanent: true,
            direction: 'top',
            offset: [0, -10]
        });

        // Popup z podrobnostmi
        marker.bindPopup(`
            <div style="font-size: 12px;">
                <b>${enota.naziv}</b><br>
                Tip: ${enota.tip || 'Splošno'}<br>
                Status: ${enota.status || 'Aktivno'}<br>
                Koordinate: ${enota.lat.toFixed(5)}, ${enota.lng.toFixed(5)}
            </div>
        `);

        // Sled (Polyline) za pot gibanja
        const pathLayer = L.polyline([latLng], {
            color: pridobiBarvoZaTip(enota.tip),
            weight: 3,
            opacity: 0.7,
            dashArray: '5, 5'
        });

        enoteSloj.addLayer(marker);
        slediSloj.addLayer(pathLayer);

        enoteBaza[enota.id] = {
            marker: marker,
            pathLayer: pathLayer,
            coords: [latLng],
            podatki: enota
        };
    } else {
        // Posodobitev obstoječe enote
        const e = enoteBaza[enota.id];
        e.podatki = enota;
        e.marker.setLatLng(latLng);

        // Dodajanje nove koordinate v pot sledenja
        e.coords.push(latLng);
        e.pathLayer.setLatLngs(e.coords);
    }

    // Posodobi še prikaz v stranski vrstici
    osveziStranskoVrstico();
}

/**
 * Vrne barvo črte sledenja glede na tip enote
 */
function pridobiBarvoZaTip(tip) {
    switch (tip?.toLowerCase()) {
        case 'vozilo': return '#ef4444'; // Rdeča
        case 'vodja': return '#3b82f6';  // Modra
        case 'resevalec': return '#10b981'; // Zelena
        default: return '#8b5cf6';       // Vijolična
    }
}

/**
 * Ponovno izriše seznam enot v stranski vrstici (#seznamEnotGumbi)
 */
export function osveziStranskoVrstico() {
    const kontejner = document.getElementById('seznamEnotGumbi');
    if (!kontejner) return;

    kontejner.innerHTML = '';

    const enoteSeznam = Object.values(enoteBaza);
    if (enoteSeznam.length === 0) {
        kontejner.innerHTML = '<div style="font-size: 0.85rem; color: #64748b; padding: 8px;">Ni aktivnih enot na terenu.</div>';
        return;
    }

    enoteSeznam.forEach(({ podatki, marker }) => {
        const kartica = document.createElement('div');
        kartica.className = 'enota-kartica';
        kartica.style.cursor = 'pointer';

        kartica.innerHTML = `
            <div>
                <div class="enota-naziv">${podatki.naziv}</div>
                <div style="font-size: 0.75rem; color: #64748b;">${podatki.tip || 'Enota'}</div>
            </div>
            <span class="enota-status">${podatki.status || 'Aktivna'}</span>
        `;

        // Klik na kartico usmeri zemljevid na dano enoto
        kartica.addEventListener('click', () => {
            if (map && marker) {
                map.flyTo(marker.getLatLng(), 16);
                marker.openPopup();
            }
        });

        kontejner.appendChild(kartica);
    });
}

/**
 * Funkcija za pridobivanje osveženih lokacij enot iz strežnika (ali simulacija)
 */
export async function osveziLokacijeEnot() {
    try {
        // Tu se po potrebi doda fetch request na vaš backend API
        // const response = await fetch('/api/enote');
        // const podatki = await response.json();
        // podatki.forEach(posodobiEnoto);
    } catch (err) {
        console.error("Napaka pri osveževanju enot:", err);
    }
}
