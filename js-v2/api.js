// ==========================================
// EPV V2 - KLICI STREŽNIKA (Apps Script)
// Vsi klici gredo skozi to datoteko: geslo aplikacije, časovna omejitev in ID za vpise so na enem mestu.
// ==========================================

import { GOOGLE_APPS_SCRIPT_URL, NAVADNO_GESLO } from './config.js';

function sestaviUrl(parametri) {
    const vsi = Object.assign({ geslo: NAVADNO_GESLO }, parametri);
    const niz = Object.keys(vsi)
        .filter(k => vsi[k] !== undefined && vsi[k] !== null)
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(String(vsi[k]))}`)
        .join('&');
    return `${GOOGLE_APPS_SCRIPT_URL}?${niz}`;
}

/** GET klic. Vedno vrne objekt: strežnikov odgovor ali { status: 'error', message, omrezje: true }. */
export async function apiGet(parametri, opcije = {}) {
    const kontrola = new AbortController();
    const casovnik = setTimeout(() => kontrola.abort(), opcije.timeoutMs || 15000);
    try {
        const res = await fetch(sestaviUrl(parametri), { cache: 'no-store', signal: kontrola.signal });
        if (!res.ok) return { status: 'error', message: 'HTTP ' + res.status, omrezje: true };
        return await res.json();
    } catch (err) {
        return { status: 'error', message: String(err && err.message || err), omrezje: true };
    } finally {
        clearTimeout(casovnik);
    }
}

/** Nov unikaten ID za vpis (strežnik z njim prepozna ponovljen vpis). */
export function novId(predpona = 'x') {
    return predpona + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
