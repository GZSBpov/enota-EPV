// ==========================================
// EPV - KONFIGURACIJA IN POVEZAVE
// ==========================================

// SHA-256 zgoščena vrednost (hash) za geslo "EPV2026"
// Nihče v F12 konzoli ali v kodi ne more videti pravega gesla!
export const VSTOPNO_GESLO_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";

// Povezava do vašega Google Apps Script & OBS Studio
export const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby7BvUZKpXxeUZlncA01hVLngHIhI3nsWADQFec1ETrD04JnN2TO8Ug5nWzsTXNbeTelg/exec"; 
export const OBS_STREAM_URL = "https://your-obs-stream-server.com/live/stream.m3u8";
export const TEREN_EPV_URL = window.location.origin + window.location.pathname.replace("mapeEPV.html", "terenEPV.html");

// FOKUS ZEMLJEVIDA: SLOVENSKA BISTRICA
export const ZACETNE_KOORDINATE = [46.3934, 15.5746]; 
export const ZACETNI_ZOOM = 14;

export const SLOVAR_BARV = {
    "red": "Rdeča (Gasilci)",
    "blue": "Modra (Policija)",
    "green": "Zelena (Reševalci)",
    "gold": "Rumena/Zlata",
    "orange": "Oranžna",
    "purple": "Vijolična"
};

export const OSVEZEVANJE_INTERVAL_MS = 5000;
export const STORAGE_KEY_GESLO = "epv_prijavljen";
export const STORAGE_KEY_DOGODEK = "epv_aktivni_dogodek";
