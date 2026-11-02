// ==========================================
// EPV - REGISTER ZNANIH IMEN ENOT
// Majhen skupen modul, da lahko map.js predlaga imena enot pri dodeljevanju
// sektorjev, ne da bi moral neposredno uvoziti units.js (kar bi ustvarilo
// krožno odvisnost, ker units.js že uvaža map.js).
// ==========================================

const znaneEnote = new Set();

export function registrirajEnoto(ime) {
    if (ime && typeof ime === 'string') znaneEnote.add(ime.trim());
}

export function pridobiZnanaImenaEnot() {
    return Array.from(znaneEnote).sort((a, b) => a.localeCompare(b));
}
