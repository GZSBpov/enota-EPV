import { map, narisaniSektorjiSloj, nastaviPopupZaSektor, posodobiIzgledSektorja, pridobiGeoJsonSektorjev } from './map.js';
import { GOOGLE_APPS_SCRIPT_URL, STORAGE_KEY_DOGODEK } from './config.js';
import { osveziLokacijeEnot } from './units.js';

/**
 * Naloži aktivni dogodek iz lokalne shrambe ali baze
 */
export async function naloziAktivniDogodek() {
    let podatki = null;
    const lokalniPodatki = localStorage.getItem(STORAGE_KEY_DOGODEK);
    
    if (lokalniPodatki) {
        try { podatki = JSON.parse(lokalniPodatki); } catch (e) {}
    }

    if (!podatki || !podatki.sektorji) return;

    narisaniSektorjiSloj.clearLayers();

    podatki.sektorji.forEach(elem => {
        let layer;
        const barva = elem.properties?.barvaSektorja || "red";
        const tip = elem.properties?.tipObmočja;

        if (tip === "circle" && elem.geometry.type === "Point") {
            const coords = [elem.geometry.coordinates[1], elem.geometry.coordinates[0]];
            layer = L.circle(coords, { radius: elem.properties.polmer || 100 });
        } else {
            layer = L.geoJSON(elem).getLayers()[0];
        }

        if (layer) {
            narisaniSektorjiSloj.addLayer(layer);
            posodobiIzgledSektorja(layer, barva);
            nastaviPopupZaSektor(layer, barva);
        }
    });

    osveziLokacijeEnot();
}

// Alias za naloziAktivniDogodek (da odpravi napako v app.js)
export const naloziPodatkeDogodka = naloziAktivniDogodek;

/**
 * Shrani trenutno stanje sektorjev in dogodka
 */
export async function shraniDogodek() {
    const imeDogodka = document.getElementById('input-ime-dogodka')?.value || "Intervencija";
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
        alert("Dogodek uspešno shranjen!");
    } catch (err) {
        alert("Shranjeno lokalno na tej napravi.");
    }
}

/**
 * Naloži seznam vseh dogodkov v padajoči meni
 */
export async function naloziSeznamDogodkov() {
    const selectEl = document.getElementById('select-dogodek');
    if (!selectEl) return;

    selectEl.addEventListener('change', () => {
        osveziLokacijeEnot();
    });

    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiDogodke`);
        if (response.ok) {
            const dogodki = await response.json();
            selectEl.innerHTML = '<option value="novy">-- Nov dogodek --</option>';
            dogodki.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.textContent = `${d.naziv}`;
                selectEl.appendChild(opt);
            });
        }
    } catch (err) {}
}

/**
 * Odpre pogovorno okno za tiskanje
 */
export function pripraviInNatisni() {
    window.print();
}
