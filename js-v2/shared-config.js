// ==========================================
// EPV V2 - SKUPNA NASTAVITEV (uporabljata jo mapeEPV_V2.html IN terenEPV_V2.html)
// Navadna (ne-module) skripta, da je vidna tudi terenEPV_V2.html brez uvoza modulov.
// ==========================================

// URL spletne aplikacije Apps Script V2 (Uvedi -> Nova uvedba -> Spletna aplikacija -> kopiraj URL, ki se konča z /exec).
// V2 uporablja SVOJO skripto in SVOJ Sheet (kopijo), da V1 med testiranjem ostane nedotaknjen.
window.GOOGLE_APPS_SCRIPT_URL = "VSTAVI_URL_SKRIPTE_V2";

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
