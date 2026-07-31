// ==========================================
// EPV - MODUL ZA DOGODKE, SHRANJEVANJE IN TISK
// ==========================================

import { map, narisaniSektorjiSloj, nastaviPopupZaSektor, pridobiGeoJsonSektorjev } from './map.js';
import { GOOGLE_APPS_SCRIPT_URL, STORAGE_KEY_DOGODEK } from './config.js';

export async function shraniDogodek() {
    const imeDogodka = document.getElementById('input-ime-dogodka')?.value || "Neimenovana intervencija";
    const geojsonSektorji = pridobiGeoJsonSektorjev();
    
    const podatkiDogodka = {
        akcija: "shraniDogodek",
        naziv: imeDogodka,
        casShranjevanja: new Date().toISOString(),
        sektorji: geojsonSektorji
    };

    // 1. Shrani lokalno
    localStorage.setItem(STORAGE_KEY_DOGODEK, JSON.stringify(podatkiDogodka));

    // 2. Shrani na Google Apps Script (Drive)
    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // standard za Google Apps Script POST zahteve
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(podatkiDogodka)
        });
        alert("Dogodek je bil uspešno poslan na strežnik/Drive!");
    } catch (err) {
        console.warn("Strežnik ni dosegljiv, shranjeno le lokalno.", err);
    }
}

export async function naloziSeznamDogodkov() {
    const selectEl = document.getElementById('select-dogodek');
    if (!selectEl) return;

    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiDogodke`);
        if (response.ok) {
            const dogodki = await response.json();
            selectEl.innerHTML = '<option value="novy">-- Nov dogodek --</option>';
            dogodki.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.textContent = `${d.naziv} (${new Date(d.datum).toLocaleDateString()})`;
                selectEl.appendChild(opt);
            });
        }
    } catch (err) {
        console.warn("Ni mogoče naložiti seznama z Google Apps Script:", err);
    }
}
