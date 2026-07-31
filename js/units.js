// ==========================================
// EPV - MODUL ZA ENOTE IN SLEDENJE (GPS)
// ==========================================

import { map } from './map.js';
import { GOOGLE_APPS_SCRIPT_URL } from './config.js';

export const enoteSloj = new L.FeatureGroup();
export const slediSloj = new L.FeatureGroup();

const enoteBaza = {};
const vidnostEnot = {};

export function iniciirajSlojeEnot() {
    if (map) {
        map.addLayer(slediSloj);
        map.addLayer(enoteSloj);
    }
}

/**
 * Vrne barvo glede na tip enote:
 * - GASILEC: rdeča (#ef4444)
 * - VOZILO: modra (#3b82f6)
 * - VODJA: rumena (#eab308)
 * - REŠEVALCI in ostali: zelena (#10b981)
 */
function pridobiBarvoZaTip(tip) {
    const t = (tip || '').toUpperCase();
    if (t.includes('GASILEC')) return '#ef4444'; // Rdeča
    if (t.includes('VOZILO')) return '#3b82f6';  // Modra
    if (t.includes('VODJA')) return '#eab308';   // Rumena
    if (t.includes('RESEVALEC') || t.includes('REŠEVALEC')) return '#10b981'; // Zelena
    return '#10b981'; // Privzeto zelena za ostale
}

/**
 * Ustvari barvno ikono za marker na podlagi barve tipa
 */
function ustvariIkono(barva) {
    const svgIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${barva}" width="32px" height="32px" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
    `;
    return L.divIcon({
        className: 'custom-map-pin',
        html: svgIcon,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -30]
    });
}

export function posodobiEnoto(enota) {
    if (!enota || !enota.id || !enota.lat || !enota.lng) return;

    const latLng = [enota.lat, enota.lng];
    const barva = pridobiBarvoZaTip(enota.tip);

    if (vidnostEnot[enota.id] === undefined) {
        vidnostEnot[enota.id] = true;
    }

    if (!enoteBaza[enota.id]) {
        const marker = L.marker(latLng, {
            icon: ustvariIkono(barva),
            title: enota.naziv
        });

        marker.bindTooltip(enota.naziv, {
            permanent: true,
            direction: 'top',
            offset: [0, -28]
        });

        marker.bindPopup(`
            <div style="font-size: 12px; color: #000;">
                <b style="color: ${barva};">${enota.naziv}</b><br>
                Tip: ${enota.tip || 'Splošno'}<br>
                Status: ${enota.status || 'Aktivna'}<br>
                Zadnji čas: ${enota.cas || '-'}<br>
                Koordinate: ${enota.lat.toFixed(5)}, ${enota.lng.toFixed(5)}
            </div>
        `);

        const pathLayer = L.polyline([latLng], {
            color: barva,
            weight: 3,
            opacity: 0.8,
            dashArray: '5, 5'
        });

        enoteBaza[enota.id] = {
            marker: marker,
            pathLayer: pathLayer,
            coords: [latLng],
            podatki: enota
        };
    } else {
        const e = enoteBaza[enota.id];
        e.podatki = enota;
        e.marker.setLatLng(latLng);
        e.marker.setIcon(ustvariIkono(barva));

        const zadnjaCoord = e.coords[e.coords.length - 1];
        if (!zadnjaCoord || zadnjaCoord[0] !== latLng[0] || zadnjaCoord[1] !== latLng[1]) {
            e.coords.push(latLng);
            e.pathLayer.setLatLngs(e.coords);
        }
    }

    osveziPrikazEnotNaMapi();
    osveziStranskoVrstico();
}

function osveziPrikazEnotNaMapi() {
    Object.keys(enoteBaza).forEach(id => {
        const item = enoteBaza[id];
        const jeVidna = vidnostEnot[id];

        if (jeVidna) {
            if (!enoteSloj.hasLayer(item.marker)) enoteSloj.addLayer(item.marker);
            if (!slediSloj.hasLayer(item.pathLayer)) slediSloj.addLayer(item.pathLayer);
        } else {
            if (enoteSloj.hasLayer(item.marker)) enoteSloj.removeLayer(item.marker);
            if (slediSloj.hasLayer(item.pathLayer)) slediSloj.removeLayer(item.pathLayer);
        }
    });
}

export function osveziStranskoVrstico() {
    const kontejner = document.getElementById('seznamEnotGumbi');
    if (!kontejner) return;

    kontejner.innerHTML = '';

    const enoteSeznam = Object.values(enoteBaza);
    if (enoteSeznam.length === 0) {
        kontejner.innerHTML = '<div style="font-size: 0.85rem; color: #64748b; padding: 12px; text-align: center;">Ni aktivnih enot za ta dogodek.</div>';
        return;
    }

    enoteSeznam.forEach(({ podatki, marker }) => {
        const id = podatki.id;
        const jeChecked = vidnostEnot[id] !== false;
        const barva = pridobiBarvoZaTip(podatki.tip);

        const kartica = document.createElement('div');
        kartica.className = 'enota-vrstica';
        kartica.style.cssText = 'padding: 10px 12px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; background: #1e293b;';

        kartica.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" class="chk-enota" id="chk-${id}" ${jeChecked ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                <div>
                    <div style="font-weight: bold; font-size: 0.88rem; color: #f8fafc;">
                        <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${barva}; margin-right:4px;"></span>
                        ${podatki.naziv}
                    </div>
                    <div style="font-size: 0.75rem; color: #94a3b8;">Tip: ${podatki.tip || 'Enota'}</div>
                </div>
            </div>
            <span style="font-size: 0.72rem; background: #059669; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;">
                ${podatki.status || 'Aktivna'}
            </span>
        `;

        const chk = kartica.querySelector(`#chk-${id}`);
        chk.addEventListener('change', (e) => {
            e.stopPropagation();
            vidnostEnot[id] = e.target.checked;
            osveziPrikazEnotNaMapi();
        });

        kartica.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                if (map && marker && vidnostEnot[id]) {
                    map.flyTo(marker.getLatLng(), 16);
                    marker.openPopup();
                }
            }
        });

        kontejner.appendChild(kartica);
    });
}

export async function osveziLokacijeEnot() {
    const aktivniDogodekId = document.getElementById('select-dogodek')?.value || '';

    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiLokacije&dogodekId=${aktivniDogodekId}&geslo=EPV2026`);
        if (!response.ok) return;

        const odgovor = await response.json();
        
        if (odgovor.status === "success" && Array.isArray(odgovor.data)) {
            const vrstice = odgovor.data;
            const zadnjeLokacijeEnot = {};

            for (let i = 1; i < vrstice.length; i++) {
                const [cas, enotaPolno, lat, lon, acc, dId] = vrstice[i];
                if (!enotaPolno || !lat || !lon) continue;

                if (aktivniDogodekId && dId && dId !== aktivniDogodekId && aktivniDogodekId !== 'novy') continue;

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

            Object.keys(enoteBaza).forEach(id => {
                if (!zadnjeLokacijeEnot[id]) {
                    enoteSloj.removeLayer(enoteBaza[id].marker);
                    slediSloj.removeLayer(enoteBaza[id].pathLayer);
                    delete enoteBaza[id];
                }
            });

            Object.values(zadnjeLokacijeEnot).forEach(enota => {
                posodobiEnoto(enota);
            });
        }
    } catch (err) {
        console.error("Napaka pri osveževanju lokacij enot:", err);
    }
}
