// ==========================================
// EPV - KONFIGURACIJA IN POVEZAVE (EXACT API)
// ==========================================

// Vstopno geslo za poveljniški vmesnik
export const VSTOPNO_GESLO = "EPV2024";

// Povezava do vašega Google Apps Script (za shranjevanje in nalaganje dogodkov ter GPS enot)
export const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby7BvUZKpXxeUZlncA01hVLngHIhI3nsWADQFec1ETrD04JnN2TO8Ug5nWzsTXNbeTelg/exec"; // Sem prilepite vaš polni Apps Script URL

// Povezava do OBS Studio Live Stream-a (ali HLS/RTMP predvajalnika)
export const OBS_STREAM_URL = "https://your-obs-stream-server.com/live/stream.m3u8";

// Povezava do terenske aplikacije (terenEPV.html), ki se uporabi v QR kodi
export const TEREN_EPV_URL = window.location.origin + window.location.pathname.replace("mapeEPV.html", "terenEPV.html");

// Začetne nastavitve zemljevida
export const ZACETNE_KOORDINATE = [46.0569, 14.5058]; 
export const ZACETNI_ZOOM = 13;

export const SLOVAR_BARV = {
    "red": "Rdeča",
    "blue": "Modra",
    "green": "Zelena",
    "gold": "Rumena/Zlata",
    "orange": "Oranžna",
    "purple": "Vijolična"
};

export const OSVEZEVANJE_INTERVAL_MS = 5000;
export const STORAGE_KEY_GESLO = "epv_prijavljen";
export const STORAGE_KEY_DOGODEK = "epv_aktivni_dogodek";
