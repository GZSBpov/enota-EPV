// ==========================================
// EPV - KONFIGURACIJA IN KONSTANTE
// ==========================================

// Začetne nastavitve zemljevida
export const ZACETNE_KOORDINATE = [46.0569, 14.5058]; // Ljubljana (privzeto)
export const ZACETNI_ZOOM = 13;

// Slovar barv za sektorje in označevanje
export const SLOVAR_BARV = {
    "red": "Rdeča",
    "blue": "Modra",
    "green": "Zelena",
    "gold": "Rumena/Zlata",
    "orange": "Oranžna",
    "purple": "Vijolična",
    "grey": "Siva"
};

// Interval za osveževanje lokacij enot (v milisekundah)
export const OSVEZEVANJE_INTERVAL_MS = 5000;

// Nastavitve za shranjevanje v localStorage (fallback)
export const STORAGE_KEY_DOGODEK = "epv_aktivni_dogodek";
