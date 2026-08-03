// ==========================================
// EPV - MODUL ZA TISKANJE POROČILA INTERVENCIJE
// ==========================================

import { GOOGLE_APPS_SCRIPT_URL } from './config.js';
import { narisaniSektorjiSloj } from './map.js';
import { formatirajCas as formatCas } from './cas-pomoc.js';

function escapeHtml(niz) {
    const el = document.createElement('div');
    el.textContent = niz ?? '';
    return el.innerHTML;
}

function imeIzPolnegaImena(polnoIme) {
    const deli = (polnoIme || '').split(':');
    return deli[1] || polnoIme || '';
}

/**
 * Vrne Map: ime enote (malimi črkami) -> seznam barv sektorjev, ki so ji trenutno dodeljeni na zemljevidu
 */
function pridobiDodeljitve() {
    const dodelitve = new Map();
    if (!narisaniSektorjiSloj) return dodelitve;

    narisaniSektorjiSloj.eachLayer(layer => {
        const enota = (layer.options?.dodeljenaEnota || '').trim();
        if (!enota) return;
        const kljuc = enota.toLowerCase();
        const seznam = dodelitve.get(kljuc) || [];
        seznam.push(layer.options?.barvaSektorja || 'red');
        dodelitve.set(kljuc, seznam);
    });
    return dodelitve;
}

async function pripraviPodatkeZaTisk(dogodekId) {
    const tabelaEl = document.getElementById('print-tabela');
    if (tabelaEl) tabelaEl.innerHTML = '<p>Nalagam podatke za tiskanje ...</p>';

    let lokacijeRes = { data: [] };
    let sporocilaRes = { data: [] };

    try {
        [lokacijeRes, sporocilaRes] = await Promise.all([
            fetch(`${GOOGLE_APPS_SCRIPT_URL}?geslo=EPV2026`, { cache: 'no-store' }).then(r => r.json()),
            fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiSporocila&dogodek=${encodeURIComponent(dogodekId)}&geslo=EPV2026`, { cache: 'no-store' }).then(r => r.json())
        ]);
    } catch (err) {
        console.error('Napaka pri pripravi podatkov za tiskanje:', err);
        if (tabelaEl) tabelaEl.innerHTML = '<p>Napaka pri pripravi podatkov za tiskanje.</p>';
        return;
    }

    // 1. Prva/zadnja prijava vsake enote na tem dogodku
    const vrstice = (lokacijeRes.data || []).slice(1); // brez glave
    const enote = new Map(); // polnoIme -> { prva, zadnja }

    vrstice.forEach(v => {
        const [cas, enotaPolno, lat, lon, acc, dId] = v;
        if (!enotaPolno || dId !== dogodekId) return;
        const obstojeca = enote.get(enotaPolno);
        if (!obstojeca) {
            enote.set(enotaPolno, { prva: cas, zadnja: cas });
        } else {
            if (cas < obstojeca.prva) obstojeca.prva = cas;
            if (cas > obstojeca.zadnja) obstojeca.zadnja = cas;
        }
    });

    // 2. Sporočila (SOS, najdena oseba/žival, konec oddajanja, ...) za ta dogodek
    const sporocila = (sporocilaRes.data || []).filter(s => s && s.sporocilo);

    // "Konec oddajanja" štejemo kot uraden čas zaključka enote (če ga je poslala)
    const koncOddaje = new Map(); // polnoIme -> zadnji zabeležen čas konca
    sporocila.forEach(s => {
        if ((s.sporocilo || '').toLowerCase().includes('konec oddajanja')) {
            const obstojeci = koncOddaje.get(s.enota);
            if (!obstojeci || s.cas > obstojeci) koncOddaje.set(s.enota, s.cas);
        }
    });

    const dodelitve = pridobiDodeljitve();

    // --- Tabela enot ---
    let html = `<h2>Enote na dogodku (${enote.size})</h2>`;

    if (enote.size === 0) {
        html += '<p>Ni zabeleženih enot za ta dogodek.</p>';
    } else {
        html += `<table class="tisk-tabela"><thead><tr>
            <th>Enota</th><th>Prva prijava</th><th>Zadnja znana lokacija</th><th>Konec oddajanja</th><th>Dodeljen sektor</th>
        </tr></thead><tbody>`;

        Array.from(enote.entries())
            .sort((a, b) => imeIzPolnegaImena(a[0]).localeCompare(imeIzPolnegaImena(b[0])))
            .forEach(([polnoIme, info]) => {
                const ime = imeIzPolnegaImena(polnoIme);
                const koncCas = koncOddaje.get(polnoIme);
                const dodeljeno = dodelitve.get(ime.trim().toLowerCase());

                html += `<tr>
                    <td>${escapeHtml(ime)}</td>
                    <td>${escapeHtml(formatCas(info.prva))}</td>
                    <td>${escapeHtml(formatCas(info.zadnja))}</td>
                    <td>${koncCas ? escapeHtml(formatCas(koncCas)) : '-'}</td>
                    <td>${dodeljeno ? `Da (${dodeljeno.length})` : '-'}</td>
                </tr>`;
            });

        html += '</tbody></table>';
    }

    // --- Tabela sporočil ---
    html += `<h2>Sporočila (${sporocila.length})</h2>`;

    if (sporocila.length === 0) {
        html += '<p>Ni sporočil za ta dogodek.</p>';
    } else {
        html += `<table class="tisk-tabela"><thead><tr>
            <th>Čas</th><th>Enota</th><th>Sporočilo</th><th>Lokacija</th>
        </tr></thead><tbody>`;

        sporocila.slice().reverse().forEach(s => {
            const ime = imeIzPolnegaImena(s.enota);
            html += `<tr>
                <td>${escapeHtml(formatCas(s.cas))}</td>
                <td>${escapeHtml(ime)}</td>
                <td>${escapeHtml(s.sporocilo)}</td>
                <td>${escapeHtml(s.lat)}, ${escapeHtml(s.lon)}</td>
            </tr>`;
        });

        html += '</tbody></table>';
    }

    if (tabelaEl) tabelaEl.innerHTML = html;
}

export async function pripraviInNatisni() {
    const selectEl = document.getElementById('select-dogodek');
    const dogodekId = selectEl?.value || '';
    const naslovEl = document.getElementById('print-naslov');
    const tabelaEl = document.getElementById('print-tabela');

    if (naslovEl) {
        naslovEl.textContent = (dogodekId && dogodekId !== 'novy')
            ? `EPV - Poročilo intervencije: ${dogodekId}`
            : 'EPV - Poročilo intervencije';
    }

    if (!dogodekId || dogodekId === 'novy') {
        if (tabelaEl) tabelaEl.innerHTML = '<p>Dogodek ni izbran ali ustvarjen - ni podatkov za poročilo.</p>';
        window.print();
        return;
    }

    await pripraviPodatkeZaTisk(dogodekId);
    window.print();
}
