// ==========================================
// EPV - MODUL ZA SPOROČILA IZ ŠTABA ENOTAM (poveljstvo -> teren)
// Obratna smer od js/sporocila.js (ki prikazuje sporočila S terena).
// ==========================================

import { GOOGLE_APPS_SCRIPT_URL } from './config.js';
import { narisaniSektorjiSloj } from './map.js';
import { pridobiZnanaImenaEnot } from './enote-register.js';

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

/**
 * Pošlje eno sporočilo iz štaba enemu cilju (ime enote ali "VSI" za vse enote na dogodku).
 * Fire-and-forget GET - enak vzorec kot obstoječa terenska sporočila (js/sporocila.js).
 */
export async function posljiSporociloStab(cilj, besedilo, dogodekId = null) {
    const dogodek = dogodekId || trenutniDogodek();
    cilj = (cilj || '').trim();
    besedilo = (besedilo || '').trim();
    if (!dogodek || dogodek === 'novy' || !cilj || !besedilo) return false;

    const url = `${GOOGLE_APPS_SCRIPT_URL}?akcija=posljiSporociloStab&dogodek=${encodeURIComponent(dogodek)}&cilj=${encodeURIComponent(cilj)}&sporocilo=${encodeURIComponent(besedilo)}&geslo=EPV2026`;
    try {
        await fetch(url, { method: 'GET', mode: 'no-cors' });
        return true;
    } catch (err) {
        console.warn('Napaka pri pošiljanju sporočila iz štaba:', err);
        return false;
    }
}

/**
 * Pošlje isto sporočilo vsem podanim enotam posamično (npr. vsem trenutno dodeljenim
 * enotam nekega sektorja) - ne zanaša se na to, da bi teren poznal naziv sektorja.
 */
async function posljiSporociloVecEnotam(imenaEnot, besedilo, dogodekId = null) {
    const unikatna = Array.from(new Set((imenaEnot || []).map(i => i.trim()).filter(Boolean)));
    await Promise.all(unikatna.map(ime => posljiSporociloStab(ime, besedilo, dogodekId)));
    return unikatna.length;
}

/**
 * Vrne imena enot, ki so trenutno dodeljene sektorju/sektorjem s podanim nazivom
 * (lahko je več sektorjev z istim nazivom - zberemo enote iz vseh).
 */
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

/**
 * Osveži spustni meni s cilji (Vsem / posamezna registrirana enota / vsi v sektorju) -
 * klicati vsakič, ko se meni odpre, saj se enote/sektorji med intervencijo spreminjajo.
 */
export function osveziStabCiljSeznam() {
    const selectEl = document.getElementById('stabCiljSelect');
    if (!selectEl) return;
    const trenutna = selectEl.value;

    let html = '<option value="VSI">📢 Vsem enotam</option>';

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

    selectEl.innerHTML = html;
    if (Array.from(selectEl.options).some(o => o.value === trenutna)) {
        selectEl.value = trenutna;
    }
}

async function posljiIzObrazca() {
    const ciljSelect = document.getElementById('stabCiljSelect');
    const textEl = document.getElementById('stabSporociloText');
    const statusEl = document.getElementById('stabSporociloStatus');
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

    if (statusEl) statusEl.textContent = 'Pošiljam ...';

    let steviloPoslanih = 0;
    if (vrednost === 'VSI') {
        const uspeh = await posljiSporociloStab('VSI', besedilo, dogodek);
        steviloPoslanih = uspeh ? 1 : 0;
    } else if (vrednost.startsWith('SEKTOR:')) {
        const naziv = vrednost.slice('SEKTOR:'.length);
        const enote = pridobiEnoteSektorjaPoNazivu(naziv);
        steviloPoslanih = await posljiSporociloVecEnotam(enote, besedilo, dogodek);
    } else if (vrednost.startsWith('ENOTA:')) {
        const ime = vrednost.slice('ENOTA:'.length);
        const uspeh = await posljiSporociloStab(ime, besedilo, dogodek);
        steviloPoslanih = uspeh ? 1 : 0;
    }

    if (statusEl) {
        statusEl.textContent = steviloPoslanih > 0
            ? `Poslano (${steviloPoslanih}) ob ${new Date().toLocaleTimeString()}`
            : 'Ni prejemnikov ali napaka pri pošiljanju.';
    }
    if (textEl) textEl.value = '';
}

/**
 * Vnaprej izbere cilj (posamezno enoto) v obrazcu za pošiljanje in postavi fokus na
 * besedilo - kliče se iz gumba "✉️" ob posamezni enoti v stranski vrstici (units.js).
 */
export function predizberiCiljEnote(ime) {
    osveziStabCiljSeznam();
    const selectEl = document.getElementById('stabCiljSelect');
    if (selectEl) selectEl.value = `ENOTA:${ime}`;
    document.getElementById('stab-sporocilo-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('stabSporociloText')?.focus();
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
