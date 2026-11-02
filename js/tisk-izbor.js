// ==========================================
// EPV - IZBOR VSEBINE POROČILA (potrditvena polja pred točkami in sporočili)
// Kljukica = vključeno v poročilo (privzeto). Odkljukano = izpuščeno iz izpisa (ostane pa v seznamu in v bazi).
// Izbor se pomni na tej napravi po dogodkih, zato preživi osvežitev strani.
// vrsta: 'tocka' | 'sporocilo' (s terena) | 'stab' (iz štaba)
// ==========================================

const KLJUC = 'epv2_tisk_izkljuceno';

function nalozi() {
    try { return JSON.parse(localStorage.getItem(KLJUC)) || {}; } catch (e) { return {}; }
}

export function jeIzkljuceno(dogodek, vrsta, id) {
    const d = nalozi()[dogodek];
    return !!(d && Array.isArray(d[vrsta]) && d[vrsta].includes(String(id)));
}

export function nastaviIzkljuceno(dogodek, vrsta, id, izkljuceno) {
    const vse = nalozi();
    const d = vse[dogodek] = vse[dogodek] || {};
    const mnozica = new Set(d[vrsta] || []);
    if (izkljuceno) mnozica.add(String(id)); else mnozica.delete(String(id));
    d[vrsta] = Array.from(mnozica);
    try { localStorage.setItem(KLJUC, JSON.stringify(vse)); } catch (e) { /* poln pomnilnik - izbor velja samo do osvežitve */ }
}
