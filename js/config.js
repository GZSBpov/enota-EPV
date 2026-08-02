// ==========================================
// EPV - KONFIGURACIJA IN POVEZAVE
// ==========================================

// Varno shranjen hash za geslo "EPV2026" (deluje na vseh protokolih)
export const VSTOPNO_GESLO_HASH = "epv_1596796333";

// Povezava do vašega Google Apps Script (definirana v js/shared-config.js, ker jo potrebuje tudi terenEPV.html)
export const GOOGLE_APPS_SCRIPT_URL = window.GOOGLE_APPS_SCRIPT_URL;

// Video prenos v živo (VDO.Ninja - dron)
export const OBS_STREAM_URL = "https://vdo.ninja/?view=enota_epv_dron&autoplay=1&mute=1&hd=1&codec=h264";
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

// TODO (arhiv dogodkov za analizo intervencij):
// Trenutno shraniDogodek() v events.js ob shranjevanju zabeleži samo sektorje (geometrijo),
// enote pa se pri odpiranju starega dogodka berejo "živo" iz Google Sheeta (osveziLokacijeEnot),
// zato pretekli dogodek ne prikaže enot take, kot so bile aktivne takrat.
// Za analizo intervencij je treba ob shranjevanju dogodka zajeti tudi trenutni posnetek enot
// (naziv, tip, zadnja lokacija, čas) in ga shraniti skupaj s sektorji v podatkiDogodka.sektorji,
// nato pa naloziAktivniDogodek() prikaže ta posnetek namesto klica osveziLokacijeEnot(),
// ko gre za arhiviran (ne aktiven) dogodek.
