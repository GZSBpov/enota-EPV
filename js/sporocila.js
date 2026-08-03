// ==========================================
// EPV - MODUL ZA SPOROČILA S TERENA (SOS, najdena oseba/žival, ...)
// ==========================================

import { GOOGLE_APPS_SCRIPT_URL } from './config.js';
import { map } from './map.js';
import { formatirajCas } from './cas-pomoc.js';

const STORAGE_PREBRANA = 'epv_prebrana_sporocila';

function escapeHtml(niz) {
    const el = document.createElement('div');
    el.textContent = niz ?? '';
    return el.innerHTML;
}

function pridobiPrebrana() {
    try {
        return new Set(JSON.parse(localStorage.getItem(STORAGE_PREBRANA)) || []);
    } catch (e) {
        return new Set();
    }
}

function oznaciPrebrano(id) {
    const prebrana = pridobiPrebrana();
    prebrana.add(id);
    // Omejimo velikost (obdržimo zadnjih 500), da localStorage ne raste v nedogled
    const seznam = Array.from(prebrana).slice(-500);
    localStorage.setItem(STORAGE_PREBRANA, JSON.stringify(seznam));
}

function sporociloId(s) {
    return `${s.cas}|${s.enota}|${s.sporocilo}`;
}

let sporociloOznacevalec = null;

/**
 * Doda (oz. premakne) oznako na zemljevidu z izpisom časa, koordinat in vsebine sporočila.
 */
function oznaciSporociloNaZemljevidu(s, lat, lon) {
    if (!map) return;

    if (sporociloOznacevalec) {
        map.removeLayer(sporociloOznacevalec);
    }

    const vsebina = `
        <div style="color:#000; font-family:sans-serif; font-size:12px;">
            <b>${escapeHtml(s.enota)}</b><br>
            Čas: ${escapeHtml(formatirajCas(s.cas))}<br>
            Koordinate: ${lat.toFixed(5)}, ${lon.toFixed(5)}<br>
            ${escapeHtml(s.sporocilo)}
        </div>
    `;

    sporociloOznacevalec = L.marker([lat, lon], {
        icon: L.divIcon({
            className: 'sporocilo-oznacevalec-ikona',
            html: '📍',
            iconSize: [30, 30],
            iconAnchor: [15, 28]
        })
    }).addTo(map);

    sporociloOznacevalec.bindPopup(vsebina).openPopup();
}

function izrisiSporocila(sporocila) {
    const kontejner = document.getElementById('seznamSporocil');
    const panel = document.getElementById('sporocila-panel');
    if (!kontejner) return;

    if (!sporocila || sporocila.length === 0) {
        kontejner.innerHTML = '<div style="font-size:0.8rem; color:#64748b; padding:8px;">Ni sporočil.</div>';
        if (panel) panel.classList.remove('ima-sos');
        return;
    }

    // Varovalka: če strežnik (še) ne pozna akcije pridobiSporocila, vrne privzeto obliko
    // (surov seznam lokacij - polja, ne objekti). Take neujemajoče vnose tiho izpustimo,
    // namesto da izrišemo prazne vrstice.
    const veljavna = sporocila.filter(s => s && !Array.isArray(s) && s.sporocilo);

    if (veljavna.length === 0) {
        kontejner.innerHTML = '<div style="font-size:0.8rem; color:#64748b; padding:8px;">Ni sporočil.</div>';
        if (panel) panel.classList.remove('ima-sos');
        return;
    }

    const prebrana = pridobiPrebrana();
    const prikazana = veljavna.slice(0, 20);
    let imaSOS = false;

    kontejner.innerHTML = prikazana.map((s, idx) => {
        const jeSOS = (s.sporocilo || '').toString().toUpperCase().includes('SOS');
        if (jeSOS) imaSOS = true;
        const jeNovo = !prebrana.has(sporociloId(s));
        const kratekCas = formatirajCas(s.cas, true);

        let razredi = 'sporocilo-vrstica';
        if (jeSOS) razredi += ' sos';
        if (jeNovo) razredi += ' novo';

        return `
            <div class="${razredi}" data-idx="${idx}" title="Klikni za lokacijo na zemljevidu">
                <div class="sporocilo-glava">
                    <span>${jeSOS ? '🆘 ' : ''}${escapeHtml(s.enota)}</span>
                    <span class="sporocilo-cas">${escapeHtml(kratekCas)}</span>
                </div>
                <div class="sporocilo-besedilo">${escapeHtml(s.sporocilo)}</div>
            </div>
        `;
    }).join('');

    if (panel) panel.classList.toggle('ima-sos', imaSOS);

    kontejner.querySelectorAll('.sporocilo-vrstica').forEach(el => {
        const idx = parseInt(el.dataset.idx, 10);
        const s = prikazana[idx];
        el.addEventListener('click', () => {
            const lat = parseFloat(s.lat);
            const lon = parseFloat(s.lon);
            if (map && !isNaN(lat) && !isNaN(lon)) {
                map.flyTo([lat, lon], 17);
                oznaciSporociloNaZemljevidu(s, lat, lon);
            }
            oznaciPrebrano(sporociloId(s));
            el.classList.remove('novo');
        });
    });
}

export async function naloziSporocila() {
    const kontejner = document.getElementById('seznamSporocil');
    if (!kontejner) return;

    const aktivniDogodekId = document.getElementById('select-dogodek')?.value || '';

    // Dokler dogodek ni izbran/ustvarjen ("novy"/prazno), ne prikažemo sporočil iz vseh dogodkov skupaj.
    if (!aktivniDogodekId || aktivniDogodekId === 'novy') {
        izrisiSporocila([]);
        return;
    }

    try {
        const res = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiSporocila&dogodek=${encodeURIComponent(aktivniDogodekId)}&geslo=EPV2026`, { cache: 'no-store' });
        if (!res.ok) return;
        const odgovor = await res.json();
        if (odgovor.status !== 'success' || !Array.isArray(odgovor.data)) return;
        izrisiSporocila(odgovor.data);
    } catch (err) {
        console.error('Napaka pri nalaganju sporočil s terena:', err);
    }
}
