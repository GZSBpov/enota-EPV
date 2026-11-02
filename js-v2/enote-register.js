// ==========================================
// EPV V2 - SKUPNO STANJE (register enot, konec oddajanja, potrditve)
// Majhen skupen modul, da moduli ne potrebujejo neposrednih uvozov drug drugega
// (units.js uvaža map.js in stab-sporocila.js - to bi ustvarilo krožne odvisnosti).
// ==========================================

// ime (male črke) -> prikazano ime (zadnji zapis, ki ga je enota uporabila).
// "PGD Kebelj" in "Pgd Kebelj" sta tako ena enota.
const znaneEnote = new Map();

export function registrirajEnoto(ime) {
    if (ime && typeof ime === 'string' && ime.trim()) znaneEnote.set(ime.trim().toLowerCase(), ime.trim());
}

export function pridobiZnanaImenaEnot() {
    return Array.from(znaneEnote.values()).sort((a, b) => a.localeCompare(b));
}

export function pozabiVseEnote() {
    znaneEnote.clear();
    koncOddajanja.clear();
}

// Ime enote (male črke) -> čas (ms) zadnjega sporočila "Konec oddajanja"
const koncOddajanja = new Map();

export function zabeleziKonecOddajanja(ime, ms) {
    if (!ime || !ms || isNaN(ms)) return;
    const k = ime.trim().toLowerCase();
    if (!koncOddajanja.has(k) || ms > koncOddajanja.get(k)) koncOddajanja.set(k, ms);
}

export function pridobiKonecOddajanja(ime) {
    return koncOddajanja.get((ime || '').trim().toLowerCase()) || 0;
}

// Potrditve prejema (teren -> štab): [{ cas, enota, tip: 'sporocilo' | 'tocka', ref }]
let potrditve = [];

export function postaviPotrditve(seznam) {
    potrditve = Array.isArray(seznam) ? seznam : [];
}

export function pridobiPotrditve() {
    return potrditve;
}
