// ==========================================
// EPV V2 - SKUPNA NASTAVITEV (uporabljata jo mapeEPV.html IN terenEPV.html)
// Navadna (ne-module) skripta, da je vidna tudi terenEPV.html brez uvoza modulov.
// ==========================================

// URL spletne aplikacije Apps Script. To je ISTA skripta in ISTI Sheet (Baza Lokacij EPV) kot doslej, zato se zgodovina vidi naprej.
// Pred objavo te različice je treba v Apps Scriptu zamenjati kodo z apps-script/Code.gs in jo uvesti kot NOVO RAZLIČICO
// obstoječe uvedbe (Uvedi -> Upravljanje uvedb -> Uredi -> Nova različica) - URL ostane enak. Glej README.md.
window.GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby7BvUZKpXxeUZlncA01hVLngHIhI3nsWADQFec1ETrD04JnN2TO8Ug5nWzsTXNbeTelg/exec";

// Predlogi imen enot na terenu (spustni seznam ob vpisu imena). Prosto vpisovanje ostane mogoče -
// seznam je samo pomoč, da ista enota ne nastopa pod več različnimi zapisi. Uredi po potrebi.
window.EPV_SEZNAM_ENOT = [
    "PGD Slovenska Bistrica",
    "PGD Kebelj",
    "PGD Oplotnica",
    "PGD Zgornja Polskava",
    "PGD Poljčane",
    "PGD Zgornja Bistrica",
    "PGD Pragersko",
    "PGD Impol",
    "GRS Maribor",
    "Štab",
    "Poveljnik"
];

// Če URL ni nastavljen, to jasno pokažemo (namesto tihih napak pri vsakem klicu)
window.EPV_KONFIGURACIJA_OK = /^https:\/\/script\.google\.com\/.+\/exec$/.test(window.GOOGLE_APPS_SCRIPT_URL) ||
    /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(window.GOOGLE_APPS_SCRIPT_URL);
