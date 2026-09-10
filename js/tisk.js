// ==========================================
// EPV - MODUL ZA TISKANJE POROČILA INTERVENCIJE
// ==========================================

import { GOOGLE_APPS_SCRIPT_URL, SLOVAR_BARV } from './config.js';
import { narisaniSektorjiSloj } from './map.js';
import { pridobiTrenutnoVidneEnote } from './units.js';
import { formatirajCas as formatCas } from './cas-pomoc.js';
import { pridobiSejnoGeslo, vprasajZaGesloDogodka, ponastaviGesloDogodka } from './geslo-dogodka.js';

const STORAGE_STEVILKA_TISKA = 'epv_stevilka_tiska';

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
 * Enaka identiteta enote kot v units.js: TIP:IME, namerno BREZ števila članov - če se to
 * med intervencijo spremeni, gre še vedno za isto enoto, ne novo. Uporabimo jo za ujemanje
 * s trenutno odkljukanimi enotami (ki jih units.js prav tako identificira na ta način).
 */
function kljucEnoteIzPolnegaImena(polnoIme) {
    const deli = (polnoIme || '').split(':');
    return `${deli[0] || ''}:${deli[1] || polnoIme || ''}`;
}

/**
 * Vrne (in poveča) zaporedno številko izpisa za ta dogodek - vsak klik na "Tisk" za isti
 * dogodek dobi svojo zaporedno številko (koristno, če se med intervencijo tiska večkrat).
 */
function pridobiSteviloTiska(imeDogodka) {
    let podatki = {};
    try {
        podatki = JSON.parse(localStorage.getItem(STORAGE_STEVILKA_TISKA)) || {};
    } catch (e) {}
    podatki[imeDogodka] = (podatki[imeDogodka] || 0) + 1;
    localStorage.setItem(STORAGE_STEVILKA_TISKA, JSON.stringify(podatki));
    return podatki[imeDogodka];
}

/**
 * Vrne Map: ime enote (malimi črkami) -> seznam { naziv, cas } sektorjev, ki so ji trenutno
 * dodeljeni na zemljevidu (naziv, čas dodelitve). Če sektor nima vpisanega naziva, se namesto
 * njega uporabi barva ("Sektor (Rdeča)"), da vrstica v poročilu ni prazna.
 */
function pridobiDodeljitve() {
    const dodelitve = new Map();
    if (!narisaniSektorjiSloj) return dodelitve;

    narisaniSektorjiSloj.eachLayer(layer => {
        const enote = layer.options?.dodeljeneEnote || [];
        const casi = layer.options?.casDodelitve || {};
        const naziv = (layer.options?.nazivSektorja || '').trim()
            || `Sektor (${SLOVAR_BARV[layer.options?.barvaSektorja] || layer.options?.barvaSektorja || '?'})`;

        enote.forEach(enota => {
            const kljuc = enota.trim().toLowerCase();
            if (!kljuc) return;
            const seznam = dodelitve.get(kljuc) || [];
            seznam.push({ naziv, cas: casi[enota] || null });
            dodelitve.set(kljuc, seznam);
        });
    });
    return dodelitve;
}

async function pripraviPodatkeZaTisk(dogodekId, stevilkaTiska) {
    const tabelaEl = document.getElementById('print-tabela');
    if (tabelaEl) tabelaEl.innerHTML = '<p>Nalagam podatke za tiskanje ...</p>';

    // Enote, ki so TRENUTNO odkljukane (vidne) v stranski vrstici - poročilo vključi samo te,
    // ne vseh, ki so kdajkoli poročale za ta dogodek.
    const vidneEnote = pridobiTrenutnoVidneEnote();
    const vidniIdji = new Set(vidneEnote.map(e => e.id));
    const clanovPoEnoti = new Map(vidneEnote.map(e => [e.id, e.clanovStevilo || 0]));
    const vozilPoEnoti = new Map(vidneEnote.map(e => [e.id, e.vozilaStevilo || 0]));

    let lokacijeRes = { data: [] };
    let sporocilaRes = { data: [] };
    let sporocilaStabRes = { data: [] };

    // Sporočila najprej posebej (lahko zahteva geslo dogodka, če je zaključena intervencija
    // zaščitena) - šele ko dostop uspe, nadaljujemo z ostalimi podatki za poročilo.
    try {
        let gesloHash = pridobiSejnoGeslo(dogodekId);
        let res = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiSporocila&dogodek=${encodeURIComponent(dogodekId)}&gesloHashDogodka=${encodeURIComponent(gesloHash)}&geslo=EPV2026`, { cache: 'no-store' });
        let odgovor = res.ok ? await res.json() : null;

        if (odgovor && odgovor.status === 'locked') {
            gesloHash = await vprasajZaGesloDogodka(dogodekId);
            if (!gesloHash) {
                if (tabelaEl) tabelaEl.innerHTML = '<p>Dostop zavrnjen - dogodek je zaščiten z geslom, ki ni bilo vneseno.</p>';
                return;
            }
            res = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiSporocila&dogodek=${encodeURIComponent(dogodekId)}&gesloHashDogodka=${encodeURIComponent(gesloHash)}&geslo=EPV2026`, { cache: 'no-store' });
            odgovor = res.ok ? await res.json() : null;

            if (odgovor && odgovor.status === 'locked') {
                const zeliPonastaviti = window.confirm(`Napačno geslo za dogodek "${dogodekId}".\n\nAli želite geslo PONASTAVITI? Staro geslo bo prenehalo veljati, prikazano bo novo.`);
                if (zeliPonastaviti) {
                    gesloHash = await ponastaviGesloDogodka(dogodekId);
                    if (gesloHash) {
                        res = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiSporocila&dogodek=${encodeURIComponent(dogodekId)}&gesloHashDogodka=${encodeURIComponent(gesloHash)}&geslo=EPV2026`, { cache: 'no-store' });
                        odgovor = res.ok ? await res.json() : null;
                    }
                }
            }

            if (!odgovor || odgovor.status === 'locked') {
                if (tabelaEl) tabelaEl.innerHTML = '<p>Napačno geslo - dostop do podatkov tega dogodka je zavrnjen.</p>';
                return;
            }
        }

        sporocilaRes = odgovor || { data: [] };
    } catch (err) {
        console.error('Napaka pri pripravi podatkov za tiskanje:', err);
        if (tabelaEl) tabelaEl.innerHTML = '<p>Napaka pri pripravi podatkov za tiskanje.</p>';
        return;
    }

    try {
        [lokacijeRes, sporocilaStabRes] = await Promise.all([
            fetch(`${GOOGLE_APPS_SCRIPT_URL}?geslo=EPV2026`, { cache: 'no-store' }).then(r => r.json()),
            fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiSporocilaStab&dogodek=${encodeURIComponent(dogodekId)}&geslo=EPV2026`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ data: [] }))
        ]);
    } catch (err) {
        console.error('Napaka pri pripravi podatkov za tiskanje:', err);
        if (tabelaEl) tabelaEl.innerHTML = '<p>Napaka pri pripravi podatkov za tiskanje.</p>';
        return;
    }

    // 1. Prva/zadnja prijava vsake TRENUTNO ODKLJUKANE enote na tem dogodku
    const vrstice = (lokacijeRes.data || []).slice(1); // brez glave
    const enote = new Map(); // polnoIme -> { prva, zadnja }

    vrstice.forEach(v => {
        const [cas, enotaPolno, lat, lon, acc, dId] = v;
        if (!enotaPolno || dId !== dogodekId) return;

        const kljucEnote = kljucEnoteIzPolnegaImena(enotaPolno);
        if (!vidniIdji.has(kljucEnote)) return; // samo trenutno odkljukane enote

        const obstojeca = enote.get(kljucEnote);
        if (!obstojeca) {
            enote.set(kljucEnote, { prva: cas, zadnja: cas });
        } else {
            if (cas < obstojeca.prva) obstojeca.prva = cas;
            if (cas > obstojeca.zadnja) obstojeca.zadnja = cas;
        }
    });

    // 2. Sporočila (SOS, najdena oseba/žival, konec oddajanja, konec intervencije, ...) za ta dogodek
    const sporocila = (sporocilaRes.data || []).filter(s => s && s.sporocilo);

    // "Konec oddajanja" štejemo kot uraden čas zaključka enote - enota lahko oddajanje večkrat
    // ustavi in znova začne, zato štejemo samo NAJKASNEJŠI (zadnji) zabeležen čas konca.
    const koncOddaje = new Map(); // ključ enote (TIP:IME) -> zadnji zabeležen čas konca
    sporocila.forEach(s => {
        if ((s.sporocilo || '').toLowerCase().includes('konec oddajanja')) {
            const kljucEnote = kljucEnoteIzPolnegaImena(s.enota);
            const obstojeci = koncOddaje.get(kljucEnote);
            if (!obstojeci || s.cas > obstojeci) koncOddaje.set(kljucEnote, s.cas);
        }
    });

    // "Konec intervencije" - zaključek celotnega dogodka (gumb "🏁 Zaključi intervencijo")
    const zakljucki = sporocila
        .filter(s => (s.sporocilo || '').toLowerCase().includes('konec intervencije'))
        .sort((a, b) => (a.cas || '').localeCompare(b.cas || ''));
    const zakljucek = zakljucki.length ? zakljucki[zakljucki.length - 1] : null;

    const dodelitve = pridobiDodeljitve();

    // Skupni seštevek enot, članov in vozil (samo trenutno odkljukanih, ki so dejansko poročale za ta dogodek)
    let steviloClanov = 0;
    let steviloVozil = 0;
    enote.forEach((info, kljucEnote) => {
        steviloClanov += clanovPoEnoti.get(kljucEnote) || 0;
        steviloVozil += vozilPoEnoti.get(kljucEnote) || 0;
    });

    let html = `<p style="font-size:1rem;"><b>Skupno enot: ${enote.size}</b> &nbsp;|&nbsp; <b>Skupno članov: ${steviloClanov}</b> &nbsp;|&nbsp; <b>Skupno vozil: ${steviloVozil}</b></p>`;

    // --- Tabela enot (razvrščene KRONOLOŠKO po prvi prijavi - prva zgoraj) ---
    html += `<h2>Enote na dogodku (${enote.size})</h2>`;

    if (enote.size === 0) {
        html += '<p>Ni odkljukanih enot za ta dogodek.</p>';
    } else {
        html += `<table class="tisk-tabela"><thead><tr>
            <th>Enota</th><th>Članov</th><th>Vozil</th><th>Prva prijava</th><th>Zadnja znana lokacija</th><th>Konec oddajanja</th><th>Dodeljen sektor</th>
        </tr></thead><tbody>`;

        Array.from(enote.entries())
            .sort((a, b) => (a[1].prva || '').localeCompare(b[1].prva || ''))
            .forEach(([kljucEnote, info]) => {
                const ime = imeIzPolnegaImena(kljucEnote);
                const koncCas = koncOddaje.get(kljucEnote);
                const dodeljeno = dodelitve.get(ime.trim().toLowerCase());
                const dodeljenoBesedilo = dodeljeno
                    ? dodeljeno.map(d => `${escapeHtml(d.naziv)}${d.cas ? ' (' + escapeHtml(formatCas(d.cas)) + ')' : ''}`).join('<br>')
                    : '-';

                html += `<tr>
                    <td>${escapeHtml(ime)}</td>
                    <td>${clanovPoEnoti.get(kljucEnote) || 0}</td>
                    <td>${vozilPoEnoti.get(kljucEnote) || 0}</td>
                    <td>${escapeHtml(formatCas(info.prva))}</td>
                    <td>${escapeHtml(formatCas(info.zadnja))}</td>
                    <td>${koncCas ? escapeHtml(formatCas(koncCas)) : '-'}</td>
                    <td>${dodeljenoBesedilo}</td>
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
            const imaKoordinate = s.lat !== undefined && s.lon !== undefined && s.lat !== '' && s.lon !== '';
            const lokacijaBesedilo = imaKoordinate
                ? `<a href="https://www.google.com/maps?q=${encodeURIComponent(s.lat)},${encodeURIComponent(s.lon)}" target="_blank" rel="noopener">${escapeHtml(s.lat)}, ${escapeHtml(s.lon)}</a>`
                : '-';
            html += `<tr>
                <td>${escapeHtml(formatCas(s.cas))}</td>
                <td>${escapeHtml(ime)}</td>
                <td>${escapeHtml(s.sporocilo)}</td>
                <td>${lokacijaBesedilo}</td>
            </tr>`;
        });

        html += '</tbody></table>';
    }

    // --- Sporočila iz štaba enotam (poveljstvo -> teren) ---
    const sporocilaStab = (sporocilaStabRes.data || []).filter(s => s && s.sporocilo);
    html += `<h2>Sporočila iz štaba enotam (${sporocilaStab.length})</h2>`;

    if (sporocilaStab.length === 0) {
        html += '<p>Ni sporočil iz štaba za ta dogodek.</p>';
    } else {
        html += `<table class="tisk-tabela"><thead><tr>
            <th>Čas</th><th>Cilj</th><th>Sporočilo</th>
        </tr></thead><tbody>`;

        sporocilaStab.slice().reverse().forEach(s => {
            html += `<tr>
                <td>${escapeHtml(formatCas(s.cas))}</td>
                <td>${escapeHtml(s.cilj)}</td>
                <td>${escapeHtml(s.sporocilo)}</td>
            </tr>`;
        });

        html += '</tbody></table>';
    }

    // --- Zaključek intervencije (če je bila zaključena) - na koncu poročila ---
    if (zakljucek) {
        html += `<h2>🏁 Zaključek intervencije</h2><p style="font-size:1rem;"><b>${escapeHtml(formatCas(zakljucek.cas))}</b></p>`;
    }

    html += `<p style="font-size:0.75rem; color:#64748b; margin-top:20px;">Izpis št. ${stevilkaTiska} - natisnjeno ${escapeHtml(formatCas(new Date().toISOString()))}</p>`;

    if (tabelaEl) tabelaEl.innerHTML = html;
}

export async function pripraviInNatisni() {
    const selectEl = document.getElementById('select-dogodek');
    const dogodekId = selectEl?.value || '';
    const naslovEl = document.getElementById('print-naslov');
    const tabelaEl = document.getElementById('print-tabela');
    const izvirniNaslovStrani = document.title;

    if (!dogodekId || dogodekId === 'novy') {
        if (naslovEl) naslovEl.textContent = 'EPV - Poročilo intervencije';
        if (tabelaEl) tabelaEl.innerHTML = '<p>Dogodek ni izbran ali ustvarjen - ni podatkov za poročilo.</p>';
        window.print();
        return;
    }

    const stevilkaTiska = pridobiSteviloTiska(dogodekId);

    if (naslovEl) {
        naslovEl.textContent = `EPV - Poročilo intervencije: ${dogodekId} (izpis št. ${stevilkaTiska})`;
    }
    // Naslov strani (uporabijo ga brskalniki kot privzeto ime datoteke pri "Natisni v PDF")
    document.title = `EPV - ${dogodekId} - izpis ${stevilkaTiska}`;

    await pripraviPodatkeZaTisk(dogodekId, stevilkaTiska);
    window.print();

    // Po tiskanju (ali preklicu) povrnemo prvotni naslov zavihka
    const povrniNaslov = () => {
        document.title = izvirniNaslovStrani;
        window.removeEventListener('afterprint', povrniNaslov);
    };
    window.addEventListener('afterprint', povrniNaslov);
}
