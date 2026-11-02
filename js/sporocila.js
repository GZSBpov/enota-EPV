// ==========================================
// EPV V2 - MODUL ZA SPOROČILA S TERENA (SOS, najdena oseba/žival, ...) + ZVOČNA OPOZORILA ŠTABA
//
// Zvok v štabu:
//  - SOS: glasna sirena, ki se ponavlja, dokler je štab ne potrdi (klik na sporočilo, na pasico
//    ali na gumb "Utišaj alarm"). Utišanje splošnega zvoka SOS-a ne utiša.
//  - ostala nova sporočila: ding-dong (konec oddajanja / konec reševanja: krajši ton)
//  - ob prvem nalaganju dogodka se zvok NE sproži za stara sporočila; izjema je še nepotrjen SOS
//    iz zadnjih 15 minut (npr. štab osveži stran sredi intervencije)
// ==========================================

import { map, narisaniSektorjiSloj, BARVE_HEX } from './map.js';
import { formatirajCas, casVMs } from './cas-pomoc.js';
import { pridobiSejnoGeslo } from './geslo-dogodka.js';
import { apiGet } from './api.js';
import { zabeleziKonecOddajanja } from './enote-register.js';
import { jeIzkljuceno, nastaviIzkljuceno } from './tisk-izbor.js';

const Zvok = window.EPVZvok;
const STORAGE_PREBRANA = 'epv2_prebrana_sporocila';
const SOS_IGNORIRAJ_STAREJSE_OD_MS = 15 * 60 * 1000;

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
    localStorage.setItem(STORAGE_PREBRANA, JSON.stringify(Array.from(prebrana).slice(-500)));
}

function sporociloId(s) {
    return s.id || `${s.cas}|${s.enota}|${s.sporocilo}`;
}

/** "enota" v sporočilu je celoten niz TIP:IME:CLANOV:VOZILA - za ujemanje potrebujemo samo IME (2. del). */
function imeIzPolnegaImenaSporocila(polnoIme) {
    const deli = (polnoIme || '').split(':');
    return deli[1] || polnoIme || '';
}

function jeSOS(s) {
    return (s.sporocilo || '').toString().toUpperCase().includes('SOS');
}

function jeSistemsko(s) {
    return (s.enota || '').toString().toUpperCase().startsWith('SISTEM');
}

function pridobiBarvoSektorjaZaEnoto(imeEnote) {
    if (!narisaniSektorjiSloj || !imeEnote) return null;
    const imeMalo = imeEnote.trim().toLowerCase();
    let barva = null;
    narisaniSektorjiSloj.eachLayer(layer => {
        if (barva) return;
        const enote = layer.options?.dodeljeneEnote || [];
        if (enote.some(e => e.trim().toLowerCase() === imeMalo)) {
            barva = layer.options?.barvaSektorja || null;
        }
    });
    return barva;
}

let sporociloOznacevalec = null;

function oznaciSporociloNaZemljevidu(s, lat, lon) {
    if (!map) return;
    if (sporociloOznacevalec) map.removeLayer(sporociloOznacevalec);

    const vsebina = `
        <div style="color:#000; font-family:sans-serif; font-size:12px;">
            <b>${escapeHtml(s.enota)}</b><br>
            Čas: ${escapeHtml(formatirajCas(s.cas))}<br>
            Koordinate: ${lat.toFixed(5)}, ${lon.toFixed(5)}<br>
            ${escapeHtml(s.sporocilo)}
        </div>`;

    sporociloOznacevalec = L.marker([lat, lon], {
        icon: L.divIcon({ className: 'sporocilo-oznacevalec-ikona', html: '📍', iconSize: [30, 30], iconAnchor: [15, 28] })
    }).addTo(map);
    sporociloOznacevalec.bindPopup(vsebina).openPopup();
}

// ---------- SOS alarm ----------

let nepotrjeniSOS = []; // sporočila, za katera sirena še zveni

function osveziPasicoSOS() {
    const pasica = document.getElementById('sos-pasica');
    const gumb = document.getElementById('btn-utisaj-sos');
    const aktiven = nepotrjeniSOS.length > 0;
    if (pasica) {
        pasica.style.display = aktiven ? 'flex' : 'none';
        if (aktiven) {
            const zadnji = nepotrjeniSOS[nepotrjeniSOS.length - 1];
            const stevilo = nepotrjeniSOS.length > 1 ? ` (+${nepotrjeniSOS.length - 1})` : '';
            pasica.querySelector('.sos-besedilo').textContent = `🆘 SOS: ${imeIzPolnegaImenaSporocila(zadnji.enota)} ob ${formatirajCas(zadnji.cas, true)}${stevilo} - klikni za lokacijo`;
        }
    }
    if (gumb) gumb.style.display = aktiven ? 'inline-block' : 'none';
}

function sprozeSOS(s) {
    nepotrjeniSOS.push(s);
    Zvok?.alarmSOS();
    osveziPasicoSOS();
}

/** Štab potrdi SOS: sirena se ustavi (lokacija ostane na voljo v seznamu). */
export function potrdiSOS() {
    nepotrjeniSOS = [];
    Zvok?.ustavi();
    osveziPasicoSOS();
}

function pojdiNaSporocilo(s) {
    const lat = parseFloat(s.lat);
    const lon = parseFloat(s.lon);
    if (map && !isNaN(lat) && !isNaN(lon)) {
        map.flyTo([lat, lon], 17);
        oznaciSporociloNaZemljevidu(s, lat, lon);
    }
    oznaciPrebrano(sporociloId(s));
}

// ---------- izris ----------

let zadnjaSporocila = [];

function izrisiSporocila(sporocila) {
    zadnjaSporocila = sporocila || [];
    const kontejner = document.getElementById('seznamSporocil');
    const panel = document.getElementById('sporocila-panel');
    if (!kontejner) return;

    const veljavna = (sporocila || []).filter(s => s && !Array.isArray(s) && s.sporocilo);
    if (veljavna.length === 0) {
        kontejner.innerHTML = '<div style="font-size:0.8rem; color:#64748b; padding:8px;">Ni sporočil.</div>';
        if (panel) panel.classList.remove('ima-sos');
        return;
    }

    const prebrana = pridobiPrebrana();
    const prikazana = veljavna.slice(0, 300);
    const dogodekIzbran = document.getElementById('select-dogodek')?.value || '';
    let imaSOS = false;

    kontejner.innerHTML = prikazana.map((s, idx) => {
        const sos = jeSOS(s);
        if (sos) imaSOS = true;
        const jeNovo = !prebrana.has(sporociloId(s));
        const kratekCas = formatirajCas(s.cas, true);

        let razredi = 'sporocilo-vrstica';
        if (sos) razredi += ' sos';
        if (jeNovo) razredi += ' novo';
        const vkljuceno = !jeIzkljuceno(dogodekIzbran, 'sporocilo', sporociloId(s));
        if (!vkljuceno) razredi += ' izkljuceno';

        let okvirSlog;
        if (sos) {
            okvirSlog = 'border-left: 6px solid #ef4444;';
        } else {
            const barvaSektorja = pridobiBarvoSektorjaZaEnoto(imeIzPolnegaImenaSporocila(s.enota));
            const barvaHex = barvaSektorja ? (BARVE_HEX[barvaSektorja] || '#64748b') : null;
            okvirSlog = `border-left: 4px solid ${barvaHex || 'transparent'};`;
        }

        return `
            <div class="${razredi}" style="${okvirSlog}" data-idx="${idx}" title="Klikni za lokacijo na zemljevidu">
                <div class="sporocilo-glava">
                    <span><input type="checkbox" class="chk-tisk" title="Vključeno v poročilo (tisk)" data-id="${escapeHtml(sporociloId(s))}" ${vkljuceno ? 'checked' : ''}> ${sos ? '🆘 ' : ''}${escapeHtml(s.enota)}</span>
                    <span class="sporocilo-cas">${escapeHtml(kratekCas)}</span>
                </div>
                <div class="sporocilo-besedilo">${escapeHtml(s.sporocilo)}</div>
            </div>`;
    }).join('');

    if (panel) panel.classList.toggle('ima-sos', imaSOS);

    kontejner.querySelectorAll('.chk-tisk').forEach(chk => {
        chk.addEventListener('click', (e) => e.stopPropagation());
        chk.addEventListener('change', () => {
            nastaviIzkljuceno(dogodekIzbran, 'sporocilo', chk.dataset.id, !chk.checked);
            chk.closest('.sporocilo-vrstica').classList.toggle('izkljuceno', !chk.checked);
        });
    });

    kontejner.querySelectorAll('.sporocilo-vrstica').forEach(el => {
        const s = prikazana[parseInt(el.dataset.idx, 10)];
        el.addEventListener('click', () => {
            pojdiNaSporocilo(s);
            if (jeSOS(s)) potrdiSOS();
            el.classList.remove('novo');
        });
    });
}

// ---------- zaznava novih sporočil in zvok ----------

const znanaSporocilaPoDogodku = new Map(); // dogodek -> Set(id)

function zabeleziKonceOddajanja(sporocila) {
    sporocila.forEach(s => {
        if ((s.sporocilo || '').toLowerCase().includes('konec oddajanja')) {
            zabeleziKonecOddajanja(imeIzPolnegaImenaSporocila(s.enota), casVMs(s.cas));
        }
    });
}

function obdelajNovaSporocila(dogodek, sporocila) {
    zabeleziKonceOddajanja(sporocila);

    const prebrana = pridobiPrebrana();
    let znana = znanaSporocilaPoDogodku.get(dogodek);

    if (!znana) {
        // Prvo nalaganje tega dogodka: brez zvoka za stara sporočila, razen za še nepotrjen SOS iz zadnjih 15 min.
        znana = new Set(sporocila.map(sporociloId));
        znanaSporocilaPoDogodku.set(dogodek, znana);
        const zdaj = Date.now();
        sporocila
            .filter(s => jeSOS(s) && !jeSistemsko(s) && !prebrana.has(sporociloId(s)) && zdaj - casVMs(s.cas) < SOS_IGNORIRAJ_STAREJSE_OD_MS)
            .sort((a, b) => casVMs(a.cas) - casVMs(b.cas))
            .forEach(sprozeSOS);
        return;
    }

    const nova = sporocila.filter(s => !znana.has(sporociloId(s)));
    nova.forEach(s => znana.add(sporociloId(s)));
    if (nova.length === 0) return;

    const zaObvestilo = nova.filter(s => !jeSistemsko(s));
    const sos = zaObvestilo.filter(jeSOS);
    sos.forEach(sprozeSOS);

    const ostala = zaObvestilo.filter(s => !jeSOS(s));
    if (ostala.length > 0) {
        const samoKonec = ostala.every(s => /konec (oddajanja|reševanja)/i.test(s.sporocilo || ''));
        if (samoKonec) Zvok?.obvestilo(); else Zvok?.sporocilo();
    }
}

export async function naloziSporocila() {
    const kontejner = document.getElementById('seznamSporocil');
    if (!kontejner) return;

    const dogodek = document.getElementById('select-dogodek')?.value || '';
    if (!dogodek || dogodek === 'novy') {
        izrisiSporocila([]);
        return;
    }

    // Geslo dogodka (če je zaščiten) je bilo že potrjeno ob izbiri dogodka (events.js) - tu ga samo tiho pošljemo naprej.
    const odgovor = await apiGet({ akcija: 'pridobiSporocila', dogodek, gesloHashDogodka: pridobiSejnoGeslo(dogodek) });
    if (odgovor.status !== 'success' || !Array.isArray(odgovor.data)) return; // vključno z "locked"
    if ((document.getElementById('select-dogodek')?.value || '') !== dogodek) return; // dogodek zamenjan med čakanjem

    obdelajNovaSporocila(dogodek, odgovor.data);
    izrisiSporocila(odgovor.data);
}

export function iniciirajAlarmSOS() {
    document.getElementById('btn-utisaj-sos')?.addEventListener('click', potrdiSOS);
    document.getElementById('sos-pasica')?.addEventListener('click', () => {
        const zadnji = nepotrjeniSOS[nepotrjeniSOS.length - 1];
        if (zadnji) pojdiNaSporocilo(zadnji);
        potrdiSOS();
    });
}

/** Ob zamenjavi dogodka: ustavi sireno in pozabi stanje (nov dogodek se prvič naloži brez zvoka). */
export function ponastaviSporocila() {
    znanaSporocilaPoDogodku.clear();
    nepotrjeniSOS = [];
    Zvok?.ustavi();
    osveziPasicoSOS();
}
