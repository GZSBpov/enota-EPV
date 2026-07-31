// ==========================================
// EPV - MODUL ZA UPRAVLJANJE DOGODKOV IN SEKTORJEV
// ==========================================

import { GOOGLE_APPS_SCRIPT_URL } from './config.js';
import { pridobiGeoJsonSektorjev, narisaniSektorjiSloj, nastaviPopupZaSektor } from './map.js';

const NAVADNO_GESLO = "EPV2026";

/**
 * Naloži seznam unikatnih dogodkov iz zavihka "Dogodki" v Google Sheetu
 */
export async function naloziSeznamDogodkov() {
    const selectEl = document.getElementById('select-dogodek');
    if (!selectEl) return;

    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiSeznamDogodkov&geslo=${encodeURIComponent(NAVADNO_GESLO)}`);
        if (response.ok) {
            const odgovor = await response.json();
            
            if (odgovor.status === "success" && Array.isArray(odgovor.data)) {
                selectEl.innerHTML = '<option value="novy">-- Nov dogodek --</option>';

                odgovor.data.forEach(imeDogodka => {
                    const opt = document.createElement('option');
                    opt.value = imeDogodka;
                    opt.textContent = imeDogodka;
                    selectEl.appendChild(opt);
                });
            } else if (odgovor.status === "error") {
                console.warn("Apps Script napaka:", odgovor.message);
            }
        }
    } catch (err) {
        console.warn("Ni mogoče naložiti seznama dogodkov:", err);
    }
}

/**
 * Naloži narisane sektorje/markerje za izbrani dogodek ter jih prikaže na zemljevidu
 */
export async function naloziPodatkeDogodka(imeDogodka) {
    if (!imeDogodka || imeDogodka === "novy") {
        // Če gre za nov dogodek, le počistimo trenutne sektorje z zemljevida
        narisaniSektorjiSloj.clearLayers();
        const inputIme = document.getElementById('input-ime-dogodka');
        if (inputIme) inputIme.value = "";
        return;
    }

    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiDogodke&dogodek=${encodeURIComponent(imeDogodka)}&geslo=${encodeURIComponent(NAVADNO_GESLO)}`);
        if (response.ok) {
            const odgovor = await response.json();

            if (odgovor.status === "success" && Array.isArray(odgovor.data)) {
                // Počistimo prejšnje narisane sektorje
                narisaniSektorjiSloj.clearLayers();

                // Sinhroniziramo polje za vnos z izbranim imenom
                const inputIme = document.getElementById('input-ime-dogodka');
                if (inputIme) inputIme.value = imeDogodka;

                // Izrišemo vse shranjene sektorje na zemljevid
                odgovor.data.forEach(vnos => {
                    if (vnos.podatki) {
                        const geoJsonLayer = L.geoJSON(vnos.podatki, {
                            onEachFeature: (feature, layer) => {
                                const barva = feature.properties?.barvaSektorja || "red";
                                nastaviPopupZaSektor(layer, barva);
                                narisaniSektorjiSloj.addLayer(layer);
                            }
                        });
                    }
                });
            }
        }
    } catch (err) {
        console.error("Napaka pri nalaganju sektorjev dogodka:", err);
    }
}

/**
 * Shrani narisane sektorje/markerje za trenutni dogodek v zavihek "Dogodki"
 */
export async function shraniDogodek() {
    const inputIme = document.getElementById('input-ime-dogodka');
    const selectDogodek = document.getElementById('select-dogodek');

    let dogodekNaziv = inputIme ? inputIme.value.trim() : "";
    
    if (!dogodekNaziv && selectDogodek && selectDogodek.value !== "novy") {
        dogodekNaziv = selectDogodek.value;
    }

    if (!dogodekNaziv) {
        alert("Prosimo, vnesite ali izberite naziv dogodka!");
        return;
    }

    const geojsonSektorji = pridobiGeoJsonSektorjev();
    const sektorjiZaShranjevanje = [];

    if (geojsonSektorji && geojsonSektorji.features) {
        geojsonSektorji.features.forEach(feature => {
            sektorjiZaShranjevanje.push({
                tip: feature.geometry.type,
                geojson: feature
            });
        });
    }

    try {
        const payload = {
            geslo: NAVADNO_GESLO,
            akcija: "shraniSektorje",
            dogodek: dogodekNaziv,
            sektorji: sektorjiZaShranjevanje
        };

        await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        alert(`Sektorji in markerji za dogodek "${dogodekNaziv}" so bili uspešno shranjeni v Google Sheet!`);
        
        await naloziSeznamDogodkov();
    } catch (err) {
        console.error("Napaka pri shranjevanju sektorjev:", err);
        alert("Napaka pri shranjevanju na strežnik.");
    }
}

/**
 * Pripravi okno za tiskanje
 */
export function pripraviInNatisni() {
    window.print();
}
