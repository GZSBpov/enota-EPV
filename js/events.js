// ==========================================
// EPV - MODUL ZA ENOTE IN SLEJENJE (GPS)
// ==========================================

import { map } from './map.js';
import { GOOGLE_APPS_SCRIPT_URL } from './config.js';

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
            <div style="font-size: 12px; color: #000;">
                <b>${enota.naziv}</b><br>
                Tip: ${enota.tip || 'Splošno'}<br>
                Status: ${enota.status || 'Aktivno'}<br>
                Zadnji čas: ${enota.cas || '-'}<br>
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

        // Dodajanje nove koordinate v pot sledenja le, če se je lokacija spremenila
        const zadnjaCoord = e.coords[e.coords.length - 1];
        if (!zadnjaCoord || zadnjaCoord[0] !== latLng[0] || zadnjaCoord[1] !== latLng[1]) {
            e.coords.push(latLng);
            e.pathLayer.setLatLngs(e.coords);
        }
    }

    // Posodobi še prikaz v stranski vrstici
    osveziStranskoVrstico();
}

/**
 * Vrne barvo črte sledenja glede na tip enote
 */
function pridobiBarvoZaTip(tip) {
    switch (tip?.toUpperCase()) {
        case 'GASILEC':
        case 'VOZILO': return '#ef4444'; // Rdeča
        case 'VODJA':
        case 'POLICIJA': return '#3b82f6';  // Modra
        case 'RESEVALEC': return '#10b981'; // Zelena
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
        kartica.style.cssText = 'cursor: pointer; padding: 8px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;';

        kartica.innerHTML = `
            <div>
                <div class="enota-naziv" style="font-weight: bold; font-size: 0.9rem;">${podatki.naziv}</div>
                <div style="font-size: 0.75rem; color: #94a3b8;">Tip: ${podatki.tip || 'Enota'}</div>
            </div>
            <span class="enota-status" style="font-size: 0.75rem; background: #059669; padding: 2px 6px; border-radius: 4px;">${podatki.status || 'Aktivna'}</span>
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
 * Pridobi najnovejše lokacije enot iz Google Apps Script (zavihek "Lokacije")
 */
export async function osveziLokacijeEnot() {
    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?geslo=EPV2026`);
        if (response.ok) {
            const odgovor = await response.json();
            
            if (odgovor.status === "success" && Array.isArray(odgovor.data)) {
                const vrstice = odgovor.data;
                const zadnjeLokacijeEnot = {};

                for (let i = 1; i < vrstice.length; i++) {
                    const [cas, enotaPolno, lat, lon, acc] = vrstice[i];
                    if (!enotaPolno || !lat || !lon) continue;

                    const deli = enotaPolno.split(':');
                    const tip = deli[0] || 'Splošno';
                    const ime = deli[1] || enotaPolno;
                    const clanov = deli[2] ? `(${deli[2]} članov)` : '';

                    zadnjeLokacijeEnot[enotaPolno] = {
                        id: enotaPolno,
                        naziv: `${ime} ${clanov}`.trim(),
                        tip: tip,
                        lat: parseFloat(lat),
                        lng: parseFloat(lon),
                        status: 'Aktivna',
                        cas: cas
                    };
                }

                Object.values(zadnjeLokacijeEnot).forEach(enota => {
                    posodobiEnoto(enota);
                });
            }
        }
    } catch (err) {
        console.error("Napaka pri osveževanju lokacij enot iz Driva:", err);
    }
}
