// ==========================================
// EPV V2 - KONFIGURACIJA IN POVEZAVE
// ==========================================

export const NAVADNO_GESLO = "EPV2026";

// Povezava do Google Apps Script V2 (definirana v js-v2/shared-config.js, ker jo potrebuje tudi terenEPV_V2.html)
export const GOOGLE_APPS_SCRIPT_URL = window.GOOGLE_APPS_SCRIPT_URL;

// Video prenos v živo (VDO.Ninja - dron)
export const OBS_STREAM_URL = "https://vdo.ninja/?view=enota_epv_dron&autoplay=1&mute=1&hd=1&codec=h264";
export const TEREN_EPV_URL = window.location.origin + window.location.pathname.replace("mapeEPV_V2.html", "terenEPV_V2.html");

// FOKUS ZEMLJEVIDA: SLOVENSKA BISTRICA
export const ZACETNE_KOORDINATE = [46.3934, 15.5746];
export const ZACETNI_ZOOM = 14;

export const SLOVAR_BARV = {
    "red": "Rdeča",
    "blue": "Modra",
    "green": "Zelena",
    "gold": "Rumena",
    "orange": "Oranžna",
    "purple": "Vijolična"
};

export const OSVEZEVANJE_INTERVAL_MS = 5000;
export const OSVEZEVANJE_STATUSOV_MS = 15000;   // preračun "pred X min" brez klica strežnika
export const OSVEZEVANJE_STAB_LOGA_MS = 10000;  // poslana sporočila in potrditve prejema

// Stanje enote glede na čas zadnjega signala
export const CAS_AKTIVNA_MS = 90 * 1000;        // do 90 s: aktivna
export const CAS_ZASTARELA_MS = 5 * 60 * 1000;  // do 5 min: zastarelo, nato: ni signala

// Natančnost GPS: nad SLABA se krog natančnosti nariše črtkano; nad ZAVRZI se pozicija ne uporabi za
// premik oznake in sled (dokler je na voljo starejša zanesljivejša pozicija).
export const NATANCNOST_SLABA_M = 100;
export const NATANCNOST_ZAVRZI_M = 300;

export const STORAGE_KEY_GESLO = "epv2_prijavljen";
export const STORAGE_KEY_DOGODEK = "epv2_aktivni_dogodek";
export const STORAGE_STARI_DOGODKI = "epv2_pokazi_stare_dogodke";
export const DOGODKI_PRIKAZ_DNI = 30;
