// ==========================================
// EPV V2 - MODUL ZA SPOROČILA IZ ŠTABA ENOTAM (poveljstvo -> teren)
// Obratna smer od js/sporocila.js (ki prikazuje sporočila S terena).
//
// Novosti: vsako sporočilo ima ID; strežnik dvojnika ne zapiše dvakrat; pošiljanje se potrdi
// (prej "fire-and-forget"); dnevnik poslanih sporočil kaže, katere enote so prejem potrdile;
// gumb za pošiljanje je 1,5 s zaklenjen proti dvojnemu kliku.
// ==========================================

import { narisaniSektorjiSloj } from './map.js';
import { pridobiZnanaImenaEnot, pridobiPotrditve, postaviPotrditve } from './enote-register.js';
import { formatirajCas, casVMs } from './cas-pomoc.js';
import { apiGet, novId } from './api.js';

function escapeHtml(niz) {
    const el = document.createElement('div');
    el.textContent = niz ?? '';
    return el.innerHTML;
}

function escapeAtribut(niz) {
    return escapeHtml(niz).replace(/"/g, '&quot;');
}

function trenutniDogodek() {
    return document.getElementById('select-dogodek')?.value || '';
}

/** Pošlje eno sporočilo enemu cilju (ime enote ali "VSI"). Vrne true samo, če je strežnik vpis potrdil. */
export async function posljiSporociloStab(cilj, besedilo, dogodekId = null) {
    const dogodek = dogodekId || trenutniDogodek();
    cilj = (cilj || '').trim();
    besedilo = (besedilo || '').trim();
    if (!dogodek || dogodek === 'novy' || !cilj || !besedilo) return false;

    const id = novId('s');
    // do 3 poskuse z istim ID-jem - strežnik dvojnika prepozna in ga ne zapiše še enkrat
    for (let poskus = 0; poskus < 3; poskus++) {
        const odgovor = await apiGet({ akcija: 'posljiSporociloStab', dogodek, cilj, sporocilo: besedilo, id });
        if (odgovor.status === 'success') return true;
        if (!odgovor.omrezje && odgovor.status === 'error' && !/zaseden/i.test(odgovor.message || '')) return false;
    }
    return false;
}

/** Pošlje isto sporočilo vsem podanim enotam posamično. */
async function posljiSporociloVecEnotam(imenaEnot, besedilo, dogodekId = null) {
    const unikatna = Array.from(new Set((imenaEnot || []).map(i => i.trim()).filter(Boolean)));
    const rezultati = await Promise.all(unikatna.map(ime => posljiSporociloStab(ime, besedilo, dogodekId)));
    return rezultati.filter(Boolean).length;
}

/** Imena enot, ki so trenutno dodeljene sektorju/sektorjem s podanim nazivom. */
function pridobiEnoteSektorjaPoNazivu(naziv) {
    const rezultat = new Set();
    if (!narisaniSektorjiSloj) return [];
    narisaniSektorjiSloj.eachLayer(layer => {
        const nazivSloja = (layer.options?.nazivSektorja || '').trim() || `Sektor (${layer.options?.barvaSektorja || '?'})`;
        if (nazivSloja !== naziv) return;
        (layer.options?.dodeljeneEnote || []).forEach(ime => rezultat.add(ime));
    });
    return Array.from(rezultat);
}

/** HTML <option> elementi s cilji pošiljanja (vsem / posamezna enota / vse v sektorju). Uporabljata ga sporočila in točke. */
export function zgradiCiljeOptionsHtml(vsemOznaka = '📢 Vsem enotam') {
    let html = `<option value="VSI">${vsemOznaka}</option>`;

    const znaneEnote = pridobiZnanaImenaEnot();
    if (znaneEnote.length) {
        html += '<optgroup label="Posamezna enota">';
        znaneEnote.forEach(ime => {
            html += `<option value="ENOTA:${escapeAtribut(ime)}">👤 ${escapeHtml(ime)}</option>`;
        });
        html += '</optgroup>';
    }

    if (narisaniSektorjiSloj) {
        const sektorji = [];
        narisaniSektorjiSloj.eachLayer(layer => {
            const enote = layer.options?.dodeljeneEnote || [];
            if (!enote.length) return;
            const naziv = (layer.options?.nazivSektorja || '').trim() || `Sektor (${layer.options?.barvaSektorja || '?'})`;
            sektorji.push({ naziv, stevilo: enote.length });
        });
        if (sektorji.length) {
            html += '<optgroup label="Vse enote v sektorju">';
            sektorji.forEach(s => {
                html += `<option value="SEKTOR:${escapeAtribut(s.naziv)}">🗺️ ${escapeHtml(s.naziv)} (${s.stevilo})</option>`;
            });
            html += '</optgroup>';
        }
    }
    return html;
}

/** Vrednost iz spustnega menija -> { vsi: bool, imena: [...] } */
export function razresiCilj(vrednost) {
    if (vrednost === 'VSI') return { vsi: true, imena: [] };
    if (vrednost.startsWith('ENOTA:')) return { vsi: false, imena: [vrednost.slice(6)] };
    if (vrednost.startsWith('SEKTOR:')) return { vsi: false, imena: pridobiEnoteSektorjaPoNazivu(vrednost.slice(7)) };
    return { vsi: false, imena: [] };
}

export function osveziStabCiljSeznam() {
    const selectEl = document.getElementById('stabCiljSelect');
    if (!selectEl) return;
    const trenutna = selectEl.value;
    selectEl.innerHTML = zgradiCiljeOptionsHtml();
    if (Array.from(selectEl.options).some(o => o.value === trenutna)) selectEl.value = trenutna;
}

async function posljiIzObrazca() {
    const ciljSelect = document.getElementById('stabCiljSelect');
    const textEl = document.getElementById('stabSporociloText');
    const statusEl = document.getElementById('stabSporociloStatus');
    const gumb = document.getElementById('btnPosljiStabSporocilo');
    const vrednost = ciljSelect?.value || '';
    const besedilo = textEl?.value.trim() || '';

    if (!besedilo) {
        if (statusEl) statusEl.textContent = 'Vpiši sporočilo.';
        return;
    }
    const dogodek = trenutniDogodek();
    if (!dogodek || dogodek === 'novy') {
        if (statusEl) statusEl.textContent = 'Najprej izberi ali ustvari dogodek.';
        return;
    }
    if (gumb?.disabled) return; // zaščita pred dvojnim klikom
    if (gumb) gumb.disabled = true;
    if (statusEl) statusEl.textContent = 'Pošiljam ...';

    let steviloPoslanih = 0;
    const cilj = razresiCilj(vrednost);
    if (cilj.vsi) {
        steviloPoslanih = (await posljiSporociloStab('VSI', besedilo, dogodek)) ? 1 : 0;
    } else {
        steviloPoslanih = await posljiSporociloVecEnotam(cilj.imena, besedilo, dogodek);
    }

    if (statusEl) {
        statusEl.textContent = steviloPoslanih > 0
            ? `✔ Poslano (${steviloPoslanih}) ob ${new Date().toLocaleTimeString('sl-SI')}`
            : '⚠️ Ni prejemnikov ali pošiljanje ni uspelo - poskusi znova.';
    }
    if (steviloPoslanih > 0 && textEl) textEl.value = '';
    setTimeout(() => { if (gumb) gumb.disabled = false; }, 1500);
    osveziStabLog();
}

export function predizberiCiljEnote(ime) {
    osveziStabCiljSeznam();
    const selectEl = document.getElementById('stabCiljSelect');
    if (selectEl) selectEl.value = `ENOTA:${ime}`;
    document.getElementById('stab-sporocilo-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('stabSporociloText')?.focus();
}

// ---------- dnevnik poslanih sporočil s potrditvami prejema ----------

let osvezujemLog = false;

export async function osveziStabLog() {
    const kontejner = document.getElementById('stabLog');
    if (!kontejner || osvezujemLog) return;
    const dogodek = trenutniDogodek();
    if (!dogodek || dogodek === 'novy') {
        kontejner.innerHTML = '';
        postaviPotrditve([]);
        return;
    }
    osvezujemLog = true;
    try {
        const [sporocila, potrditve] = await Promise.all([
            apiGet({ akcija: 'pridobiSporocilaStab', dogodek }),
            apiGet({ akcija: 'pridobiPotrditve', dogodek })
        ]);
        if (trenutniDogodek() !== dogodek) return;
        if (potrditve.status === 'success') postaviPotrditve(potrditve.data);
        if (sporocila.status !== 'success') return;

        const potrjene = pridobiPotrditve().filter(p => p.tip === 'sporocilo');
        const vrstice = (sporocila.data || [])
            .filter(s => s && s.sporocilo)
            .sort((a, b) => casVMs(b.cas) - casVMs(a.cas))
            .slice(0, 8);

        if (vrstice.length === 0) {
            kontejner.innerHTML = '<div class="stab-log-prazno">Še ni poslanih sporočil.</div>';
            return;
        }
        kontejner.innerHTML = vrstice.map(s => {
            const prejeli = potrjene.filter(p => p.ref === s.id).map(p => p.enota);
            const jeVsi = String(s.cilj).toLowerCase() === 'vsi';
            const oznaka = prejeli.length
                ? `<span class="stab-log-ok" title="${escapeAtribut(prejeli.join(', '))}">✔ ${jeVsi ? prejeli.length + ' enot' : 'prejeto'}</span>`
                : '<span class="stab-log-caka">⏳ čaka na potrditev</span>';
            return `<div class="stab-log-vrstica">
                <div class="stab-log-glava"><span>${escapeHtml(formatirajCas(s.cas, true))} → ${escapeHtml(s.cilj)}</span>${oznaka}</div>
                <div class="stab-log-besedilo">${escapeHtml(s.sporocilo)}</div>
            </div>`;
        }).join('');
    } finally {
        osvezujemLog = false;
    }
}

export function iniciirajStabSporocila() {
    osveziStabCiljSeznam();
    document.getElementById('stabCiljSelect')?.addEventListener('focus', osveziStabCiljSeznam);
    document.getElementById('btnPosljiStabSporocilo')?.addEventListener('click', posljiIzObrazca);
    document.getElementById('stabSporociloText')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            posljiIzObrazca();
        }
    });
}
