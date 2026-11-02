// ==========================================
// EPV V2 - MODUL ZA ENOTE IN SLEDENJE (GPS)
//
// Novosti proti V1:
//  - cela sled enote se zgradi iz vseh prejetih pozicij dogodka (po osvežitvi strani ni več prazna)
//  - stanje enote glede na čas zadnjega signala: aktivna / zastarelo / ni signala / ustavljeno
//  - krog natančnosti GPS; pozicije s slabo natančnostjo ne premaknejo oznake in sledi
//  - enaka enota z drugačnimi velikimi/malimi črkami ("PGD Kebelj" / "Pgd Kebelj") je ena enota
//  - kazalnik povezave s strežnikom
// ==========================================

import { map } from './map.js';
import { registrirajEnoto, pridobiKonecOddajanja } from './enote-register.js';
import { formatirajCas, casVMs, starostBesedilo } from './cas-pomoc.js';
import { predizberiCiljEnote } from './stab-sporocila.js';
import { apiGet } from './api.js';
import {
    CAS_AKTIVNA_MS, CAS_ZASTARELA_MS, NATANCNOST_SLABA_M, NATANCNOST_ZAVRZI_M
} from './config.js';

export const enoteSloj = new L.FeatureGroup();
export const slediSloj = new L.FeatureGroup();
export const natancnostSloj = new L.FeatureGroup();

const enoteBaza = {};
const vidnostEnot = {};

// Prejete vrstice izbranega dogodka (id -> vrstica) in kazalec na zadnjo prebrano vrstico lista
const vrsticePoId = new Map();
let vrsticeDogodek = null;
let kazalec = 0;
let zadnjiUspesenOdgovor = 0;

export function iniciirajSlojeEnot() {
    if (map) {
        map.addLayer(natancnostSloj);
        map.addLayer(slediSloj);
        map.addLayer(enoteSloj);
    }
}

function pridobiBarvoZaTip(tip) {
    const t = (tip || '').toUpperCase();
    if (t.includes('GASILEC')) return '#ef4444'; // Rdeča
    if (t.includes('VOZILO')) return '#3b82f6';  // Modra
    if (t.includes('VODJA')) return '#eab308';   // Rumena
    if (t.includes('DRUGO')) return '#f97316';   // Oranžna
    if (t.includes('RESEVALEC') || t.includes('REŠEVALEC')) return '#10b981'; // Zelena
    return '#10b981';
}

function ustvariIkono(barva, tip) {
    const jeVozilo = (tip || '').toUpperCase().includes('VOZILO');
    if (jeVozilo) {
        const svgVozilo = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${barva}" width="30px" height="30px" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));">
                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
            </svg>`;
        return L.divIcon({ className: 'custom-map-pin', html: svgVozilo, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] });
    }
    const svgIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${barva}" width="30px" height="30px" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>`;
    return L.divIcon({ className: 'custom-map-pin', html: svgIcon, iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });
}

function escapeHtml(niz) {
    const el = document.createElement('div');
    el.textContent = niz ?? '';
    return el.innerHTML;
}

// ---------- stanje enote ----------

/**
 * @returns {{koda: string, besedilo: string, barva: string, krajse: number}}
 * koda: 'aktivna' | 'zastarelo' | 'brez-signala' | 'ustavljeno'
 */
export function izracunajStatus(podatki, zdaj = Date.now()) {
    const konec = pridobiKonecOddajanja(podatki.ime);
    if (konec && konec >= podatki.casMs - 3000) {
        return { koda: 'ustavljeno', besedilo: 'Ustavljeno', barva: '#475569', krajse: 0.4 };
    }
    const starost = zdaj - podatki.casMs;
    if (starost <= CAS_AKTIVNA_MS) return { koda: 'aktivna', besedilo: 'Aktivna', barva: '#059669', krajse: 1 };
    if (starost <= CAS_ZASTARELA_MS) return { koda: 'zastarelo', besedilo: 'Zastarelo', barva: '#d97706', krajse: 0.65 };
    return { koda: 'brez-signala', besedilo: 'Ni signala', barva: '#64748b', krajse: 0.4 };
}

function pripraviPopupVsebino(enota, barva) {
    const status = izracunajStatus(enota);
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${enota.lat},${enota.lng}`;
    const smsBesedilo = encodeURIComponent(`Lokacija ${enota.naziv}: https://www.google.com/maps?q=${enota.lat},${enota.lng}`);
    const smsUrl = `sms:?body=${smsBesedilo}`;
    const opozorilo = enota.slabaZadnja
        ? `<div style="color:#b45309; margin:4px 0;">⚠️ Zadnji signal ima slabo natančnost (±${Math.round(enota.slabaZadnja)} m) - prikazana je zadnja zanesljiva pozicija (${escapeHtml(starostBesedilo(enota.pozCasMs))}).</div>`
        : (enota.acc > NATANCNOST_SLABA_M ? `<div style="color:#b45309; margin:4px 0;">⚠️ Slaba natančnost GPS (±${Math.round(enota.acc)} m)</div>` : '');

    return `
        <div style="font-size: 12px; color: #000;">
            <b style="color: ${barva};">${escapeHtml(enota.naziv)}</b><br>
            Tip: ${escapeHtml(enota.tip || 'Splošno')}<br>
            Stanje: <b style="color:${status.barva};">${escapeHtml(status.besedilo)}</b> (${escapeHtml(starostBesedilo(enota.casMs))})<br>
            ${enota.vozilaStevilo ? `Vozil: ${enota.vozilaStevilo}<br>` : ''}
            Zadnji čas: ${escapeHtml(formatirajCas(enota.cas))}<br>
            Koordinate: ${enota.lat.toFixed(5)}, ${enota.lng.toFixed(5)}${enota.acc ? ` (±${Math.round(enota.acc)} m)` : ''}
            ${opozorilo}
            <div style="display:flex; gap:6px; margin-top:8px;">
                <a href="${mapsUrl}" target="_blank" rel="noopener" style="flex:1; text-align:center; background:#2563eb; color:#fff; padding:5px 6px; border-radius:4px; text-decoration:none; font-weight:bold; font-size:11px;">🧭 Navigacija</a>
                <a href="${smsUrl}" style="flex:1; text-align:center; background:#059669; color:#fff; padding:5px 6px; border-radius:4px; text-decoration:none; font-weight:bold; font-size:11px;">📩 Pošlji SMS</a>
            </div>
        </div>`;
}

// ---------- gradnja enot iz prejetih vrstic ----------

function jeNatancnostSprejemljiva(acc) {
    return !(acc > NATANCNOST_ZAVRZI_M);
}

function razclenitevEnote(r) {
    const deli = String(r.enota || '').split(':');
    const tip = deli[0] || 'Splošno';
    if (tip.toUpperCase() === 'SISTEM') return null;
    const ime = (deli[1] || r.enota || '').trim();
    return {
        tip,
        ime,
        clanov: parseInt(deli[2], 10) || 0,
        vozil: parseInt(deli[3], 10) || 0,
        clanovBesedilo: deli[2] ? `(${deli[2]} članov)` : ''
    };
}

function preracunajEnote() {
    const poEnoti = new Map();
    for (const r of vrsticePoId.values()) {
        const razclenjena = razclenitevEnote(r);
        if (!razclenjena) continue;
        const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
        if (isNaN(lat) || isNaN(lon)) continue;
        const kljuc = `${razclenjena.tip.toUpperCase()}:${razclenjena.ime.toLowerCase()}`;
        if (!poEnoti.has(kljuc)) poEnoti.set(kljuc, []);
        poEnoti.get(kljuc).push({ r, razclenjena, lat, lon, ms: r.ms, acc: parseFloat(r.acc) || 0 });
    }

    const videniKljuci = new Set();
    for (const [kljuc, vrstice] of poEnoti) {
        vrstice.sort((a, b) => a.ms - b.ms);
        const zadnja = vrstice[vrstice.length - 1];
        const dobre = vrstice.filter(v => jeNatancnostSprejemljiva(v.acc));
        const uporabljena = dobre.length ? dobre[dobre.length - 1] : zadnja;
        videniKljuci.add(kljuc);
        registrirajEnoto(zadnja.razclenjena.ime);

        const podatki = {
            id: kljuc,
            ime: zadnja.razclenjena.ime,
            naziv: `${zadnja.razclenjena.ime} ${zadnja.razclenjena.clanovBesedilo}`.trim(),
            tip: zadnja.razclenjena.tip,
            lat: uporabljena.lat,
            lng: uporabljena.lon,
            acc: uporabljena.acc,
            pozCasMs: uporabljena.ms,
            slabaZadnja: (zadnja !== uporabljena && !jeNatancnostSprejemljiva(zadnja.acc)) ? zadnja.acc : 0,
            cas: zadnja.r.cas,
            casMs: zadnja.ms,
            clanovStevilo: zadnja.razclenjena.clanov,
            vozilaStevilo: zadnja.razclenjena.vozil
        };

        // sled: samo zanesljive točke, brez zaporednih dvojnikov, največ zadnjih 600
        const sled = [];
        for (const v of dobre) {
            const zadnjaTocka = sled[sled.length - 1];
            if (!zadnjaTocka || zadnjaTocka[0] !== v.lat || zadnjaTocka[1] !== v.lon) sled.push([v.lat, v.lon]);
        }
        posodobiEnoto(podatki, sled.slice(-600));
    }

    Object.keys(enoteBaza).forEach(id => {
        if (!videniKljuci.has(id)) odstraniEnoto(id);
    });

    osveziStatuse();
}

function odstraniEnoto(id) {
    const e = enoteBaza[id];
    if (!e) return;
    enoteSloj.removeLayer(e.marker);
    slediSloj.removeLayer(e.pathLayer);
    natancnostSloj.removeLayer(e.krog);
    delete enoteBaza[id];
}

function pocistiVse() {
    Object.keys(enoteBaza).forEach(odstraniEnoto);
    vrsticePoId.clear();
    kazalec = 0;
}

// Opomba: posodobiEnoto() samo posodobi podatke/marker - izris stranske vrstice je treba klicati
// LOČENO in samo ENKRAT po tem, ko so posodobljene vse enote (glej preracunajEnote / osveziStatuse).
export function posodobiEnoto(enota, sled) {
    if (!enota || !enota.id || !isFinite(enota.lat) || !isFinite(enota.lng)) return;

    const latLng = [enota.lat, enota.lng];
    const barva = pridobiBarvoZaTip(enota.tip);
    if (vidnostEnot[enota.id] === undefined) vidnostEnot[enota.id] = true;

    let e = enoteBaza[enota.id];
    if (!e) {
        const marker = L.marker(latLng, { icon: ustvariIkono(barva, enota.tip), title: enota.naziv });
        marker.bindTooltip(enota.naziv, { permanent: false, direction: 'top', offset: [0, -28] });
        marker.bindPopup(pripraviPopupVsebino(enota, barva));
        // popup se ob odprtju vedno osveži (starost "pred X min" se spreminja brez novih podatkov)
        marker.on('popupopen', () => {
            const t = enoteBaza[enota.id];
            if (t) marker.setPopupContent(pripraviPopupVsebino(t.podatki, pridobiBarvoZaTip(t.podatki.tip)));
        });
        const pathLayer = L.polyline(sled && sled.length ? sled : [latLng], { color: barva, weight: 3, opacity: 0.8, dashArray: '5, 5' });
        const krog = L.circle(latLng, { radius: 1, color: barva, weight: 1, fillColor: barva, fillOpacity: 0.12, interactive: false });
        e = enoteBaza[enota.id] = { marker, pathLayer, krog, podatki: enota };
    } else {
        e.podatki = enota;
        e.marker.setLatLng(latLng);
        e.marker.setIcon(ustvariIkono(barva, enota.tip));
        e.marker.setPopupContent(pripraviPopupVsebino(enota, barva));
        if (sled && sled.length) e.pathLayer.setLatLngs(sled);
        e.krog.setLatLng(latLng);
    }

    // krog natančnosti: pokažemo samo, kadar je zanimiv (>= 30 m); črtkan, če je natančnost slaba
    const polmer = Math.min(Math.max(enota.acc || 0, 0), 1500);
    e.krog.setRadius(Math.max(polmer, 1));
    e.krog.setStyle({ dashArray: enota.acc > NATANCNOST_SLABA_M ? '4,4' : null });
    e.prikaziKrog = polmer >= 30;
}

function osveziPrikazEnotNaMapi() {
    Object.keys(enoteBaza).forEach(id => {
        const item = enoteBaza[id];
        const jeVidna = vidnostEnot[id] !== false;
        const status = izracunajStatus(item.podatki);
        item.marker.setOpacity(status.krajse);
        item.pathLayer.setStyle({ opacity: 0.8 * status.krajse });

        const dodaj = (sloj, plast) => { if (!sloj.hasLayer(plast)) sloj.addLayer(plast); };
        const odstrani = (sloj, plast) => { if (sloj.hasLayer(plast)) sloj.removeLayer(plast); };

        if (jeVidna) {
            dodaj(enoteSloj, item.marker);
            dodaj(slediSloj, item.pathLayer);
            if (item.prikaziKrog) dodaj(natancnostSloj, item.krog); else odstrani(natancnostSloj, item.krog);
        } else {
            odstrani(enoteSloj, item.marker);
            odstrani(slediSloj, item.pathLayer);
            odstrani(natancnostSloj, item.krog);
        }
    });
}

export function osveziStranskoVrstico() {
    const kontejner = document.getElementById('seznamEnotGumbi');
    if (!kontejner) return;
    kontejner.innerHTML = '';

    const enoteSeznam = Object.values(enoteBaza).sort((a, b) => b.podatki.casMs - a.podatki.casMs);

    if (enoteSeznam.length === 0) {
        kontejner.innerHTML = '<div style="font-size: 0.85rem; color: #64748b; padding: 12px; text-align: center;">Ni aktivnih enot na terenu.</div>';
        return;
    }

    enoteSeznam.forEach(({ podatki, marker }) => {
        const id = podatki.id;
        const jeChecked = vidnostEnot[id] !== false;
        const barva = pridobiBarvoZaTip(podatki.tip);
        const status = izracunajStatus(podatki);

        const kartica = document.createElement('div');
        kartica.className = 'enota-vrstica enota-' + status.koda;
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
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${barva}; margin-right:4px;"></span>${escapeHtml(podatki.naziv)}
            </div>
            <div class="enota-starost" style="font-size: 0.72rem; color: #94a3b8;">Čas: ${escapeHtml(formatirajCas(podatki.cas, true))} · ${escapeHtml(starostBesedilo(podatki.casMs))}${podatki.vozilaStevilo ? ' · Vozil: ' + podatki.vozilaStevilo : ''}${podatki.acc > NATANCNOST_SLABA_M ? ' · ⚠️ ±' + Math.round(podatki.acc) + ' m' : ''}</div>`;

        vsebina.appendChild(chk);
        vsebina.appendChild(besedilo);

        const statusBadge = document.createElement('span');
        statusBadge.className = 'enota-status';
        statusBadge.style.cssText = `font-size: 0.7rem; background: ${jeChecked ? status.barva : '#64748b'}; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;`;
        statusBadge.textContent = jeChecked ? status.besedilo : 'Skrito';

        const desnaStran = document.createElement('div');
        desnaStran.style.cssText = 'display: flex; align-items: center; gap: 4px; flex-shrink: 0;';

        const msgBtn = document.createElement('button');
        msgBtn.type = 'button';
        msgBtn.className = 'btn-posljisporocilo-enoti';
        msgBtn.textContent = '✉️';
        msgBtn.title = 'Pošlji sporočilo tej enoti';
        msgBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            predizberiCiljEnote(podatki.ime);
        });

        desnaStran.appendChild(msgBtn);
        desnaStran.appendChild(statusBadge);
        kartica.appendChild(vsebina);
        kartica.appendChild(desnaStran);

        chk.addEventListener('change', (e) => {
            vidnostEnot[id] = e.target.checked;
            osveziPrikazEnotNaMapi();
            osveziStranskoVrstico();
        });
        chk.addEventListener('click', (e) => e.stopPropagation());

        kartica.addEventListener('click', () => {
            if (map && marker && vidnostEnot[id] !== false) {
                map.flyTo(marker.getLatLng(), 16);
                marker.openPopup();
            }
        });

        kontejner.appendChild(kartica);
    });
}

/** Preračuna stanja ("pred X min") in barve brez klica strežnika - klicati občasno. */
export function osveziStatuse() {
    osveziPrikazEnotNaMapi();
    osveziStranskoVrstico();
}

/** Podatki enot, ki so TRENUTNO odkljukane (vidne) - uporablja tisk.js. */
export function pridobiTrenutnoVidneEnote() {
    return Object.values(enoteBaza)
        .filter(e => vidnostEnot[e.podatki.id] !== false)
        .map(e => e.podatki);
}

/** Vse prikazane enote s položajem in stanjem (za razdalje do točk). */
export function pridobiVseEnote() {
    return Object.values(enoteBaza).map(e => Object.assign({ status: izracunajStatus(e.podatki) }, e.podatki));
}

// ---------- kazalnik povezave ----------

function nastaviPovezavo(uspesno) {
    const el = document.getElementById('povezava-status');
    if (!el) return;
    if (uspesno) {
        zadnjiUspesenOdgovor = Date.now();
        el.className = 'povezava-ok';
        el.textContent = '● Povezano';
        el.title = 'Zadnji odgovor strežnika: ' + formatirajCas(new Date(zadnjiUspesenOdgovor).toISOString());
    } else {
        el.className = 'povezava-napaka';
        el.textContent = zadnjiUspesenOdgovor
            ? `● Ni povezave (podatki iz ${formatirajCas(new Date(zadnjiUspesenOdgovor).toISOString(), true)})`
            : '● Ni povezave s strežnikom';
    }
}

// ---------- osveževanje s strežnika ----------

let osvezevanjeVTeku = false;

export async function osveziLokacijeEnot() {
    // Če prejšnja zahteva (npr. zaradi počasne povezave) še ni končana, nove ne sprožimo
    if (osvezevanjeVTeku) return;
    osvezevanjeVTeku = true;

    const dogodek = document.getElementById('select-dogodek')?.value || '';

    try {
        if (!dogodek || dogodek === 'novy') {
            if (vrsticeDogodek !== null || Object.keys(enoteBaza).length) {
                pocistiVse();
                vrsticeDogodek = null;
                osveziStatuse();
            }
            return;
        }

        if (dogodek !== vrsticeDogodek) {
            pocistiVse();
            vrsticeDogodek = dogodek;
            osveziStatuse();
        }

        const odgovor = await apiGet({ akcija: 'pridobiLokacije', dogodek, kazalec });
        if (odgovor.status !== 'success' || !Array.isArray(odgovor.data)) {
            nastaviPovezavo(false);
            return;
        }
        nastaviPovezavo(true);

        // dogodek se je medtem lahko zamenjal - zastarelih vrstic ne uporabimo
        if ((document.getElementById('select-dogodek')?.value || '') !== dogodek) return;

        let novih = 0;
        for (const r of odgovor.data) {
            if (vrsticePoId.has(r.id)) continue;
            r.ms = casVMs(r.cas);
            if (isNaN(r.ms)) continue;
            vrsticePoId.set(r.id, r);
            novih++;
        }
        kazalec = typeof odgovor.kazalec === 'number' ? odgovor.kazalec : kazalec;

        if (novih > 0 || Object.keys(enoteBaza).length === 0) preracunajEnote();
        else osveziStatuse();
    } catch (err) {
        console.error('Napaka pri osveževanju lokacij enot:', err);
        nastaviPovezavo(false);
    } finally {
        osvezevanjeVTeku = false;
    }
}
