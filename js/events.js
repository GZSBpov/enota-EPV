import { map, narisaniSektorjiSloj, nastaviPopupZaSektor, posodobiIzgledSektorja, pridobiGeoJsonSektorjev } from './map.js';
import { GOOGLE_APPS_SCRIPT_URL, STORAGE_KEY_DOGODEK } from './config.js';
import { osveziLokacijeEnot } from './units.js';

export async function naloziAktivniDogodek(podatkiSektorjev = null) {
    let sektorji = podatkiSektorjev;

    if (!sektorji) {
        const lokalniPodatki = localStorage.getItem(STORAGE_KEY_DOGODEK);
        if (lokalniPodatki) {
            try {
                const parsed = JSON.parse(lokalniPodatki);
                sektorji = parsed.sektorji;
            } catch (e) {}
        }
    }

    narisaniSektorjiSloj.clearLayers();

    if (!sektorji || !Array.isArray(sektorji)) return;

    sektorji.forEach(elem => {
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

export const naloziPodatkeDogodka = naloziAktivniDogodek;

export async function naloziSeznamDogodkov() {
    const selectEl = document.getElementById('select-dogodek');
    if (!selectEl) return;

    // Ob spremembi izbire naložimo območja ter osvežimo enote
    selectEl.addEventListener('change', async (e) => {
        const dogodekId = e.target.value;
        if (dogodekId === 'novy' || !dogodekId) {
            narisaniSektorjiSloj.clearLayers();
            osveziLokacijeEnot();
            return;
        }

        try {
            const res = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiSektorjeDogodka&id=${encodeURIComponent(dogodekId)}&geslo=EPV2026`);
            if (res.ok) {
                const data = await res.json();
                const sektorji = data.sektorji || (data.data ? data.data.sektorji : null);
                const naziv = data.naziv || (data.data ? data.data.naziv : '');

                if (sektorji) {
                    naloziAktivniDogodek(sektorji);
                }
                const inputIme = document.getElementById('input-ime-dogodka');
                if (inputIme && naziv) inputIme.value = naziv;
            }
        } catch (err) {
            console.warn("Ni mogoče pridobiti podatkov dogodka:", err);
        }

        osveziLokacijeEnot();
    });

    // Pridobivanje seznama vseh starih dogodkov
    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiDogodke&geslo=EPV2026`);
        if (response.ok) {
            const odgovor = await response.json();
            const dogodki = Array.isArray(odgovor) ? odgovor : (odgovor.data || []);

            selectEl.innerHTML = '<option value="novy">-- Nov dogodek --</option>';
            dogodki.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.id || d.naziv;
                opt.textContent = `${d.naziv} ${d.datum ? '(' + d.datum + ')' : ''}`;
                selectEl.appendChild(opt);
            });
        }
    } catch (err) {
        console.warn("Seznam dogodkov ni dostopen:", err);
    }
}

export async function shraniDogodek() {
    const imeDogodka = document.getElementById('input-ime-dogodka')?.value || "Intervencija";
    const selectEl = document.getElementById('select-dogodek');
    const dogodekId = selectEl?.value !== 'novy' ? selectEl?.value : Date.now().toString();
    const geojsonSektorji = pridobiGeoJsonSektorjev();
    
    const podatkiDogodka = {
        akcija: "shraniDogodek",
        id: dogodekId,
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
        naloziSeznamDogodkov();
    } catch (err) {
        alert("Shranjeno lokalno na tej napravi.");
    }
}

export function pripraviInNatisni() {
    window.print();
}
