// ==========================================
// EPV - MODUL ZA ENOTE IN SLEDENJE (GPS)
// ==========================================

import { map } from './map.js';
import { GOOGLE_APPS_SCRIPT_URL } from './config.js';
import { registrirajEnoto } from './enote-register.js';
import { formatirajCas } from './cas-pomoc.js';

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
 * - REŠEVALEC/NMP: zelena (#10b981)
 * - DRUGO (CZ): oranžna (#f97316)
 */
function pridobiBarvoZaTip(tip) {
    const t = (tip || '').toUpperCase();
    if (t.includes('GASILEC')) return '#ef4444'; // Rdeča
    if (t.includes('VOZILO')) return '#3b82f6';  // Modra
    if (t.includes('VODJA')) return '#eab308';   // Rumena
    if (t.includes('DRUGO')) return '#f97316';   // Oranžna
    if (t.includes('RESEVALEC') || t.includes('REŠEVALEC')) return '#10b981'; // Zelena
    return '#10b981'; // Privzeto zelena
}

function ustvariIkono(barva, tip) {
    const jeVozilo = (tip || '').toUpperCase().includes('VOZILO');

    if (jeVozilo) {
        const svgVozilo = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${barva}" width="30px" height="30px" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));">
                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
            </svg>
        `;
        return L.divIcon({
            className: 'custom-map-pin',
            html: svgVozilo,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -14]
        });
    }

    const svgIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${barva}" width="30px" height="30px" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
    `;
    return L.divIcon({
        className: 'custom-map-pin',
        html: svgIcon,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -28]
    });
}

function escapeHtml(niz) {
    const el = document.createElement('div');
    el.textContent = niz ?? '';
    return el.innerHTML;
}

/**
 * Pripravi vsebino pojavnega okna enote, vključno z gumboma za navigacijo (Google Maps)
 * in pošiljanje lokacije preko SMS - uporabno, ko vodja na tablici/GSM-u odpre navigacijo do enote.
 */
function pripraviPopupVsebino(enota, barva) {
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${enota.lat},${enota.lng}`;
    const smsBesedilo = encodeURIComponent(`Lokacija ${enota.naziv}: https://www.google.com/maps?q=${enota.lat},${enota.lng}`);
    const smsUrl = `sms:?body=${smsBesedilo}`;

    return `
        <div style="font-size: 12px; color: #000;">
            <b style="color: ${barva};">${escapeHtml(enota.naziv)}</b><br>
            Tip: ${escapeHtml(enota.tip || 'Splošno')}<br>
            Status: ${escapeHtml(enota.status || 'Aktivna')}<br>
            Zadnji čas: ${escapeHtml(formatirajCas(enota.cas))}<br>
            Koordinate: ${enota.lat.toFixed(5)}, ${enota.lng.toFixed(5)}
            <div style="display:flex; gap:6px; margin-top:8px;">
                <a href="${mapsUrl}" target="_blank" rel="noopener" style="flex:1; text-align:center; background:#2563eb; color:#fff; padding:5px 6px; border-radius:4px; text-decoration:none; font-weight:bold; font-size:11px;">🧭 Navigacija</a>
                <a href="${smsUrl}" style="flex:1; text-align:center; background:#059669; color:#fff; padding:5px 6px; border-radius:4px; text-decoration:none; font-weight:bold; font-size:11px;">📩 Pošlji SMS</a>
            </div>
        </div>
    `;
}

// Opomba: posodobiEnoto() samo posodobi podatke/marker - izris zemljevida in stranske vrstice
// je treba klicati LOČENO in samo ENKRAT po tem, ko so posodobljene vse enote (glej osveziLokacijeEnot),
// sicer se pri npr. 20 enotah cela stranska vrstica znova izriše 20-krat v vsakem ciklu osveževanja.
export function posodobiEnoto(enota) {
    if (!enota || !enota.id || !enota.lat || !enota.lng) return;

    const latLng = [enota.lat, enota.lng];
    const barva = pridobiBarvoZaTip(enota.tip);

    if (vidnostEnot[enota.id] === undefined) {
        vidnostEnot[enota.id] = true;
    }

    if (!enoteBaza[enota.id]) {
        const marker = L.marker(latLng, {
            icon: ustvariIkono(barva, enota.tip),
            title: enota.naziv
        });

        marker.bindTooltip(enota.naziv, {
            permanent: true,
            direction: 'top',
            offset: [0, -28]
        });

        marker.bindPopup(pripraviPopupVsebino(enota, barva));

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
        e.marker.setIcon(ustvariIkono(barva, enota.tip));
        // Osvežimo tudi vsebino pojavnega okna - sicer bi ob ponovnem odpiranju kazalo zastarele koordinate/čas
        e.marker.setPopupContent(pripraviPopupVsebino(enota, barva));

        const zadnjaCoord = e.coords[e.coords.length - 1];
        if (!zadnjaCoord || zadnjaCoord[0] !== latLng[0] || zadnjaCoord[1] !== latLng[1]) {
            e.coords.push(latLng);
            e.pathLayer.setLatLngs(e.coords);
        }
    }
}

function osveziPrikazEnotNaMapi() {
    Object.keys(enoteBaza).forEach(id => {
        const item = enoteBaza[id];
        const jeVidna = vidnostEnot[id] !== false;

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

    // Velikost/scroll ureja CSS (flex:1; min-height:0; overflow-y:auto na #seznamEnotGumbi)

    kontejner.innerHTML = '';

    // Razvrsti enote glede na čas (najnovejša prijava gre NA VRH)
    const enoteSeznam = Object.values(enoteBaza).sort((a, b) => {
        const casA = new Date(a.podatki.cas || 0).getTime();
        const casB = new Date(b.podatki.cas || 0).getTime();
        return casB - casA;
    });

    if (enoteSeznam.length === 0) {
        kontejner.innerHTML = '<div style="font-size: 0.85rem; color: #64748b; padding: 12px; text-align: center;">Ni aktivnih enot na terenu.</div>';
        return;
    }

    enoteSeznam.forEach(({ podatki, marker }) => {
        const id = podatki.id;
        const jeChecked = vidnostEnot[id] !== false;
        const barva = pridobiBarvoZaTip(podatki.tip);

        const kartica = document.createElement('div');
        kartica.className = 'enota-vrstica';
        kartica.style.cssText = 'padding: 8px 10px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; background: #1e293b; user-select: none; margin-bottom: 2px; border-radius: 4px;';

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'chk-enota';
        chk.checked = jeChecked;
        chk.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';

        const vsebina = document.createElement('div');
        vsebina.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        
        const besedilo = document.createElement('div');
        besedilo.innerHTML = `
            <div style="font-weight: bold; font-size: 0.85rem; color: #f8fafc;">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${barva}; margin-right:4px;"></span>
                ${podatki.naziv}
            </div>
            <div style="font-size: 0.72rem; color: #94a3b8;">${podatki.cas ? 'Čas: ' + formatirajCas(podatki.cas, true) : 'Tip: ' + (podatki.tip || 'Enota')}</div>
        `;

        vsebina.appendChild(chk);
        vsebina.appendChild(besedilo);

        const statusBadge = document.createElement('span');
        statusBadge.style.cssText = `font-size: 0.7rem; background: ${jeChecked ? '#059669' : '#64748b'}; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;`;
        statusBadge.textContent = jeChecked ? (podatki.status || 'Aktivna') : 'Skrito';

        kartica.appendChild(vsebina);
        kartica.appendChild(statusBadge);

        chk.addEventListener('change', (e) => {
            vidnostEnot[id] = e.target.checked;
            osveziPrikazEnotNaMapi();
            osveziStranskoVrstico();
        });

        chk.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        kartica.addEventListener('click', () => {
            if (map && marker && vidnostEnot[id] !== false) {
                map.flyTo(marker.getLatLng(), 16);
                marker.openPopup();
            }
        });

        kontejner.appendChild(kartica);
    });
}

let osvezevanjeVTeku = false;

export async function osveziLokacijeEnot() {
    // Če prejšnja zahteva (npr. zaradi počasne povezave) še ni končana, nove ne sprožimo,
    // da se zahteve na Apps Script ne kopičijo druga čez drugo.
    if (osvezevanjeVTeku) return;
    osvezevanjeVTeku = true;

    const aktivniDogodekId = document.getElementById('select-dogodek')?.value || '';

    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?geslo=EPV2026`, { cache: 'no-store' });
        if (!response.ok) return;

        const odgovor = await response.json();
        
        if (odgovor.status === "success" && Array.isArray(odgovor.data)) {
            const vrstice = odgovor.data;
            const zadnjeLokacijeEnot = {};

            for (let i = 1; i < vrstice.length; i++) {
                const [cas, enotaPolno, lat, lon, acc, dId] = vrstice[i];
                if (!enotaPolno || !lat || !lon) continue;

                // Enoto prikažemo samo, če pripada trenutno izbranemu/ustvarjenemu dogodku.
                // Dokler dogodek ni izbran ali ustvarjen ("novy"/prazno), ne prikažemo nobene enote.
                if (!aktivniDogodekId || aktivniDogodekId === 'novy' || dId !== aktivniDogodekId) continue;

                const deli = enotaPolno.split(':');
                const tip = deli[0] || 'Splošno';
                const ime = deli[1] || enotaPolno;
                const clanov = deli[2] ? `(${deli[2]} članov)` : '';

                registrirajEnoto(ime);

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

            // Izris naredimo samo ENKRAT za celoten cikel osveževanja (ne za vsako enoto posebej)
            osveziPrikazEnotNaMapi();
            osveziStranskoVrstico();
        }
    } catch (err) {
        console.error("Napaka pri osveževanju lokacij enot:", err);
    } finally {
        osvezevanjeVTeku = false;
    }
}
