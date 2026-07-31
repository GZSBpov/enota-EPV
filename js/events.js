// ==========================================
// EPV - MODUL ZA DOGODKE, SHRANJEVANJE IN TISK
// ==========================================

import { map, narisaniSektorjiSloj, nastaviPopupZaSektor, pridobiGeoJsonSektorjev } from './map.js';
import { GOOGLE_APPS_SCRIPT_URL, STORAGE_KEY_DOGODEK } from './config.js';

/**
 * Naloži zadnji shranjeni dogodek iz localStorage (ob zagonu)
 */
export async function naloziAktivniDogodek() {
    let podatki = null;
    const lokalniPodatki = localStorage.getItem(STORAGE_KEY_DOGODEK);
    
    if (lokalniPodatki) {
        try {
            podatki = JSON.parse(lokalniPodatki);
        } catch (e) {
            console.error("Napaka pri branju localStorage:", e);
        }
    }

    if (!podatki || !podatki.sektorji) return;

    narisaniSektorjiSloj.clearLayers();

    L.geoJSON(podatki.sektorji, {
        onEachFeature: (feature, layer) => {
            const barva = feature.properties?.barvaSektorja || "red";
            narisaniSektorjiSloj.addLayer(layer);
            nastaviPopupZaSektor(layer, barva);
        }
    });
}

/**
 * Shrani trenutno stanje dogodka
 */
export async function shraniDogodek() {
    const imeDogodka = document.getElementById('input-ime-dogodka')?.value || "Neimenovana intervencija";
    const geojsonSektorji = pridobiGeoJsonSektorjev();
    
    const podatkiDogodka = {
        akcija: "shraniDogodek",
        naziv: imeDogodka,
        casShranjevanja: new Date().toISOString(),
        sektorji: geojsonSektorji
    };

    localStorage.setItem(STORAGE_KEY_DOGODEK, JSON.stringify(podatkiDogodka));

    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(podatkiDogodka)
        });
        alert("Dogodek je bil uspešno shranjen!");
    } catch (err) {
        console.warn("Strežnik ni dosegljiv, shranjeno le lokalno.", err);
    }
}

/**
 * Naloži seznam vseh dogodkov iz Google Apps Script (Varno pred napakami)
 */
export async function naloziSeznamDogodkov() {
    const selectEl = document.getElementById('select-dogodek');
    if (!selectEl) return;

    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiDogodke`);
        if (response.ok) {
            const dogodki = await response.json();
            selectEl.innerHTML = '<option value="novy">-- Nov dogodek --</option>';
            
            // PREVERBA: Šele če so podatki dejansko seznam/tabela, izvedi forEach
            if (Array.isArray(dogodki)) {
                dogodki.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.id;
                    opt.textContent = `${d.naziv} (${new Date(d.datum).toLocaleDateString()})`;
                    selectEl.appendChild(opt);
                });
            } else {
                console.warn("Prejet odgovor iz Driva ni tabela:", dogodki);
            }
        }
    } catch (err) {
        console.warn("Ni mogoče naložiti seznama z Google Apps Script:", err);
    }
}

/**
 * Pripravi poročilo za tisk
 */
export function pripraviInNatisni() {
    window.print();
}
