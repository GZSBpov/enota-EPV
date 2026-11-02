// ==========================================
// EPV V2 - TOČKE IZ KOORDINAT (štab -> teren)
//
// Primer z intervencije: štab dobi koordinate, kjer naj bi bila oseba. Vpiše jih v poljubnem zapisu
// (WGS84 decimalno / stopinje-minute-sekunde / UTM / D96/TM / povezava Google Maps), aplikacija
// točko označi na zemljevidu (z neobveznim krogom negotovosti) in jo po želji pošlje eni, več ali vsem
// enotam. Enota točko dobi na svoj zemljevid z razdaljo in smerjo od sebe, zvočnim opozorilom
// in gumbom za navigacijo, štab pa vidi, katere enote so prejem potrdile.
// ==========================================

import { map } from './map.js';
import { apiGet, novId } from './api.js';
import { formatirajCas } from './cas-pomoc.js';
import { pridobiVseEnote } from './units.js';
import { pridobiPotrditve } from './enote-register.js';
import { zgradiCiljeOptionsHtml, razresiCilj } from './stab-sporocila.js';

const K = window.EPVKoordinate;
const tocke = new Map(); // id -> { podatki, marker, krog }
let sloj = null;
let osvezujem = false;

function escapeHtml(niz) {
    const el = document.createElement('div');
    el.textContent = niz ?? '';
    return el.innerHTML;
}
function escapeAtribut(niz) { return escapeHtml(niz).replace(/"/g, '&quot;'); }

function trenutniDogodek() {
    return document.getElementById('select-dogodek')?.value || '';
}

function ikonaTocke() {
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="34" height="34" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,.7));">
            <circle cx="16" cy="16" r="12" fill="rgba(220,38,38,.18)" stroke="#dc2626" stroke-width="3"/>
            <circle cx="16" cy="16" r="6" fill="none" stroke="#dc2626" stroke-width="3"/>
            <circle cx="16" cy="16" r="2.4" fill="#dc2626"/>
            <path d="M16 1v7M16 24v7M1 16h7M24 16h7" stroke="#dc2626" stroke-width="2.4"/>
        </svg>`;
    return L.divIcon({ className: 'tocka-iz-koordinat', html: svg, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16] });
}

/** Zapis ciljev točke: 'VSI' | 'Ime1|Ime2' | '' (samo štab). */
function ciljVBesedilo(cilj) {
    if (!cilj) return 'samo štab';
    if (String(cilj).toLowerCase() === 'vsi') return 'vse enote';
    return String(cilj).split('|').join(', ');
}

function potrditveTocke(t) {
    const ref = `${t.id}|${t.ver}`;
    return pridobiPotrditve().filter(p => p.tip === 'tocka' && p.ref === ref).map(p => p.enota);
}

function najblizjeEnote(t, stevilo = 5) {
    return pridobiVseEnote()
        .map(e => ({ e, d: K.razdaljaM(e.lat, e.lng, t.lat, t.lon), az: K.azimut(e.lat, e.lng, t.lat, t.lon) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, stevilo);
}

function popupHtml(t) {
    const f = K.oblikuj(t.lat, t.lon);
    const najblizje = najblizjeEnote(t);
    const prejeli = t.ver ? potrditveTocke(t) : [];
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lon}`;
    const polmer = t.polmer ? `<div>Območje negotovosti: ±${Math.round(t.polmer)} m</div>` : '';
    const vrstaEnot = najblizje.length
        ? najblizje.map(x => `<div>• ${escapeHtml(x.e.ime)}: <b>${escapeHtml(K.oblikujRazdaljo(x.d))}</b> do točke, smer ${escapeHtml(K.smerIme(x.az))} (${Math.round(x.az)}°)</div>`).join('')
        : '<div style="color:#64748b;">Ni enot na zemljevidu.</div>';

    return `
        <div class="tocka-popup" data-id="${escapeAtribut(t.id)}" style="color:#000; font-size:12px; min-width:230px; max-width:290px;">
            <b style="font-size:14px;">🎯 ${escapeHtml(t.naziv || 'Točka')}</b>
            ${t.opomba ? `<div style="margin:3px 0;">${escapeHtml(t.opomba)}</div>` : ''}
            ${polmer}
            <div style="margin-top:6px; font-family:monospace; font-size:11px; line-height:1.5;">
                <div>${escapeHtml(f.decimalno)}</div>
                <div>${escapeHtml(f.dms)}</div>
                <div>D96/TM: ${escapeHtml(f.d96)}</div>
                <div>UTM: ${escapeHtml(f.utm)}</div>
            </div>
            <div style="margin-top:6px;"><b>Najbližje enote:</b>${vrstaEnot}</div>
            <div style="margin-top:6px;"><b>Poslano:</b> ${escapeHtml(ciljVBesedilo(t.cilj))}${t.ver ? ' (' + escapeHtml(formatirajCas(t.ver, true)) + ')' : ''}</div>
            ${t.ver ? `<div><b>Potrdili:</b> ${prejeli.length ? '✔ ' + escapeHtml(prejeli.join(', ')) : '⏳ še nihče'}</div>` : ''}
            <div style="display:flex; gap:6px; margin-top:8px;">
                <select class="tp-cilj" style="flex:1; padding:3px; min-width:0;">${zgradiCiljeOptionsHtml('📢 Vsem enotam')}</select>
                <button type="button" class="tp-poslji" style="padding:3px 8px; background:#2563eb; color:#fff; border:none; border-radius:4px; cursor:pointer;">📤 Pošlji</button>
            </div>
            <div style="display:flex; gap:6px; margin-top:6px;">
                <a href="${mapsUrl}" target="_blank" rel="noopener" style="flex:1; text-align:center; background:#059669; color:#fff; padding:4px; border-radius:4px; text-decoration:none; font-weight:bold;">🧭 Navigacija</a>
                <button type="button" class="tp-izbrisi" style="padding:4px 8px; background:#dc2626; color:#fff; border:none; border-radius:4px; cursor:pointer;">🗑 Umakni</button>
            </div>
            <div class="tp-status" style="margin-top:4px; color:#475569;"></div>
        </div>`;
}

// ---------- risanje ----------

function narisi(t) {
    let e = tocke.get(t.id);
    if (!e) {
        const marker = L.marker([t.lat, t.lon], { icon: ikonaTocke(), zIndexOffset: 1000, title: t.naziv });
        marker.bindTooltip(t.naziv || 'Točka', { permanent: true, direction: 'right', offset: [14, 0], className: 'tocka-oznaka' });
        marker.bindPopup(popupHtml(t), { maxWidth: 300 });
        marker.on('popupopen', (ev) => {
            const trenutna = tocke.get(t.id);
            if (trenutna) marker.setPopupContent(popupHtml(trenutna.podatki)); // sveže razdalje in potrditve
            pripniPopup(ev.popup.getElement(), t.id);
        });
        const krog = L.circle([t.lat, t.lon], { radius: 1, color: '#dc2626', weight: 2, dashArray: '6,6', fillColor: '#dc2626', fillOpacity: 0.08, interactive: false });
        sloj.addLayer(marker);
        e = { podatki: t, marker, krog };
        tocke.set(t.id, e);
    } else {
        e.podatki = t;
        e.marker.setLatLng([t.lat, t.lon]);
        e.marker.setTooltipContent(t.naziv || 'Točka');
        if (!e.marker.isPopupOpen()) e.marker.setPopupContent(popupHtml(t));
        e.krog.setLatLng([t.lat, t.lon]);
    }
    if (t.polmer > 0) {
        e.krog.setRadius(t.polmer);
        if (!sloj.hasLayer(e.krog)) sloj.addLayer(e.krog);
    } else if (sloj.hasLayer(e.krog)) {
        sloj.removeLayer(e.krog);
    }
}

function odstraniLokalno(id) {
    const e = tocke.get(id);
    if (!e) return;
    sloj.removeLayer(e.marker);
    sloj.removeLayer(e.krog);
    tocke.delete(id);
}

function pocistiVse() {
    Array.from(tocke.keys()).forEach(odstraniLokalno);
}

function pripniPopup(vozlisce, id) {
    if (!vozlisce) return;
    const statusEl = vozlisce.querySelector('.tp-status');
    const poslji = vozlisce.querySelector('.tp-poslji');
    const izbrisi = vozlisce.querySelector('.tp-izbrisi');
    const cilj = vozlisce.querySelector('.tp-cilj');

    poslji?.addEventListener('click', async () => {
        const e = tocke.get(id);
        if (!e || poslji.disabled) return;
        poslji.disabled = true;
        if (statusEl) statusEl.textContent = 'Pošiljam ...';
        const r = await posljiTockoNaStrezniku(e.podatki, cilj.value, false);
        if (statusEl) statusEl.textContent = r ? '✔ Poslano' : '⚠️ Ni prejemnikov ali pošiljanje ni uspelo.';
        setTimeout(() => { poslji.disabled = false; }, 1500);
    });

    izbrisi?.addEventListener('click', async () => {
        if (!window.confirm('Umakniti točko z zemljevida štaba in s terena?')) return;
        const odgovor = await apiGet({ akcija: 'umakniTocko', dogodek: trenutniDogodek(), id });
        if (odgovor.status === 'success') odstraniLokalno(id);
        else if (statusEl) statusEl.textContent = '⚠️ Umik ni uspel: ' + (odgovor.message || '');
        osveziSeznam();
    });
}

/** Pošlje (ali ponovno pošlje) točko: vrne true, če je strežnik vpis potrdil. */
async function posljiTockoNaStrezniku(t, vrednostCilja, zamenjaj) {
    const dogodek = trenutniDogodek();
    let cilj = '';
    if (vrednostCilja !== null && vrednostCilja !== undefined && vrednostCilja !== '') {
        const r = razresiCilj(vrednostCilja);
        cilj = r.vsi ? 'VSI' : r.imena.join('|');
        if (!cilj) return false; // npr. sektor brez enot
    }
    const odgovor = await apiGet({
        akcija: 'posljiTocko', dogodek, id: t.id, lat: t.lat, lon: t.lon,
        naziv: t.naziv, polmer: t.polmer || '', opomba: t.opomba || '', cilj, zamenjaj: zamenjaj ? '1' : ''
    });
    if (odgovor.status !== 'success') return false;
    narisi(Object.assign({}, t, { cilj: odgovor.cilj !== undefined ? odgovor.cilj : t.cilj, ver: odgovor.ver || t.ver }));
    osveziSeznam();
    return true;
}

// ---------- seznam v stranski vrstici ----------

function osveziSeznam() {
    const el = document.getElementById('tocke-seznam');
    if (!el) return;
    const vse = Array.from(tocke.values()).map(e => e.podatki);
    if (vse.length === 0) {
        el.innerHTML = '<div class="tocke-prazno">Ni točk. Dodaj jih z gumbom »Točka iz koordinat«.</div>';
        return;
    }
    el.innerHTML = vse.map(t => {
        const prejeli = t.ver ? potrditveTocke(t) : [];
        return `<div class="tocka-vrstica" data-id="${escapeAtribut(t.id)}">
            <div class="tocka-vrstica-glava"><span>🎯 ${escapeHtml(t.naziv || 'Točka')}</span><span class="tocka-vrstica-cilj">${escapeHtml(ciljVBesedilo(t.cilj))}</span></div>
            <div class="tocka-vrstica-koordinate">${t.lat.toFixed(5)}, ${t.lon.toFixed(5)}${t.ver ? (prejeli.length ? ' · ✔ ' + prejeli.length + ' potrdilo' : ' · ⏳') : ''}</div>
        </div>`;
    }).join('');
    el.querySelectorAll('.tocka-vrstica').forEach(v => {
        v.addEventListener('click', () => {
            const e = tocke.get(v.dataset.id);
            if (!e) return;
            map.flyTo([e.podatki.lat, e.podatki.lon], 17);
            e.marker.openPopup();
        });
    });
}

// ---------- usklajevanje s strežnikom ----------

export async function osveziTocke() {
    if (osvezujem || !sloj) return;
    const dogodek = trenutniDogodek();
    if (!dogodek || dogodek === 'novy') {
        if (tocke.size) { pocistiVse(); osveziSeznam(); }
        return;
    }
    osvezujem = true;
    try {
        const odgovor = await apiGet({ akcija: 'pridobiTocke', dogodek });
        if (odgovor.status !== 'success' || !Array.isArray(odgovor.data)) return;
        if (trenutniDogodek() !== dogodek) return;

        const aktivne = new Set();
        odgovor.data.forEach(r => {
            const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
            if (r.status === 'umaknjena' || isNaN(lat) || isNaN(lon)) return;
            aktivne.add(r.id);
            narisi({
                id: r.id, naziv: r.naziv, lat, lon, polmer: parseFloat(r.polmer) || 0,
                opomba: r.opomba || '', cilj: r.cilj || '', ver: r.ver || ''
            });
        });
        Array.from(tocke.keys()).forEach(id => { if (!aktivne.has(id)) odstraniLokalno(id); });
        osveziSeznam();
    } finally {
        osvezujem = false;
    }
}

/** Ob zamenjavi dogodka: pozabi točke prejšnjega dogodka. */
export function ponastaviTocke() {
    if (sloj) pocistiVse();
    osveziSeznam();
}

// ---------- obrazec za vnos koordinat ----------

function napolniCilje() {
    const sel = document.getElementById('tocka-cilj');
    if (!sel) return;
    const prej = sel.value;
    sel.innerHTML = '<option value="">📍 Samo označi (ne pošlji)</option>' + zgradiCiljeOptionsHtml('📢 Pošlji vsem enotam');
    if (Array.from(sel.options).some(o => o.value === prej)) sel.value = prej;
}

function prikaziPredogled() {
    const vnos = document.getElementById('tocka-vnos');
    const pred = document.getElementById('tocka-predogled');
    const gumbi = [document.getElementById('btn-tocka-prikazi'), document.getElementById('btn-tocka-poslji')];
    if (!vnos || !pred) return null;

    if (!vnos.value.trim()) {
        pred.className = 'tocka-predogled';
        pred.innerHTML = 'Prilepi koordinate v katerem koli zapisu, npr. <code>46.3934, 15.5746</code>, <code>46°23\'36"N 15°34\'28"E</code>, <code>33T 544175 5137918</code>, <code>E 544188 N 139461</code> ali povezavo Google Maps.';
        gumbi.forEach(g => g && (g.disabled = true));
        return null;
    }
    const r = K.razcleni(vnos.value);
    if (!r.ok) {
        pred.className = 'tocka-predogled napaka';
        pred.innerHTML = '⚠️ ' + escapeHtml(r.napaka);
        gumbi.forEach(g => g && (g.disabled = true));
        return null;
    }
    const f = K.oblikuj(r.lat, r.lon);
    pred.className = 'tocka-predogled ok';
    pred.innerHTML = `
        <div><b>✔ Prepoznano:</b> ${escapeHtml(r.format)}</div>
        ${r.opozorila.map(o => `<div class="opozorilo">⚠️ ${escapeHtml(o)}</div>`).join('')}
        <div class="formati">
            <div>${escapeHtml(f.decimalno)}</div>
            <div>${escapeHtml(f.dms)}</div>
            <div>D96/TM: ${escapeHtml(f.d96)}</div>
            <div>UTM: ${escapeHtml(f.utm)}</div>
        </div>`;
    gumbi.forEach(g => g && (g.disabled = false));
    return r;
}

function odpriModal() {
    const modal = document.getElementById('tocka-modal');
    if (!modal) return;
    napolniCilje();
    modal.style.display = 'flex';
    const dogodek = trenutniDogodek();
    const opoz = document.getElementById('tocka-dogodek-opozorilo');
    if (opoz) opoz.style.display = (!dogodek || dogodek === 'novy') ? 'block' : 'none';
    prikaziPredogled();
    setTimeout(() => document.getElementById('tocka-vnos')?.focus(), 50);
}

function zapriModal() {
    const modal = document.getElementById('tocka-modal');
    if (modal) modal.style.display = 'none';
}

async function ustvariTocko(poslji) {
    const status = document.getElementById('tocka-status');
    const dogodek = trenutniDogodek();
    if (!dogodek || dogodek === 'novy') {
        if (status) status.textContent = '⚠️ Najprej izberi ali ustvari dogodek (točke se shranjujejo pod dogodek).';
        return;
    }
    const r = prikaziPredogled();
    if (!r) return;

    const nazivVnos = document.getElementById('tocka-naziv').value.trim();
    const t = {
        id: novId('t'),
        naziv: nazivVnos || `Točka ${tocke.size + 1}`,
        lat: r.lat, lon: r.lon,
        polmer: Math.max(0, parseFloat(String(document.getElementById('tocka-polmer').value).replace(',', '.')) || 0),
        opomba: document.getElementById('tocka-opomba').value.trim(),
        cilj: '', ver: ''
    };
    const vrednostCilja = poslji ? document.getElementById('tocka-cilj').value : '';

    const gumb1 = document.getElementById('btn-tocka-prikazi'), gumb2 = document.getElementById('btn-tocka-poslji');
    [gumb1, gumb2].forEach(g => g && (g.disabled = true));
    if (status) status.textContent = 'Shranjujem ...';

    let uspeh = await posljiTockoNaStrezniku(t, vrednostCilja, true);
    [gumb1, gumb2].forEach(g => g && (g.disabled = false));
    if (!uspeh) {
        if (status) status.textContent = poslji && !vrednostCilja
            ? '⚠️ Izberi prejemnika.'
            : '⚠️ Točke ni bilo mogoče shraniti/poslati (preveri povezavo ali prejemnike). Poskusi znova.';
        return;
    }
    if (status) status.textContent = '';
    if (!tocke.has(t.id)) narisi(t);
    zapriModal();
    ponastaviObrazec();
    const e = tocke.get(t.id);
    if (e && map) {
        map.flyTo([t.lat, t.lon], 16);
        e.marker.openPopup();
    }
}

function ponastaviObrazec() {
    ['tocka-vnos', 'tocka-naziv', 'tocka-opomba', 'tocka-polmer'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const sel = document.getElementById('tocka-cilj');
    if (sel) sel.value = '';
    const status = document.getElementById('tocka-status');
    if (status) status.textContent = '';
}

export function iniciirajTocke() {
    if (!map) return;
    sloj = L.layerGroup().addTo(map);
    document.getElementById('btn-tocka-odpri')?.addEventListener('click', odpriModal);
    document.getElementById('btn-tocka-zapri')?.addEventListener('click', zapriModal);
    document.getElementById('tocka-vnos')?.addEventListener('input', prikaziPredogled);
    document.getElementById('btn-tocka-prikazi')?.addEventListener('click', () => ustvariTocko(false));
    document.getElementById('btn-tocka-poslji')?.addEventListener('click', () => ustvariTocko(true));
    document.getElementById('tocka-vnos')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ustvariTocko(true); }
    });
    osveziSeznam();
}
