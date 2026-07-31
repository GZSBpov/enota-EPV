import { map, narisaniSektorjiSloj, nastaviPopupZaSektor, posodobiIzgledSektorja, pridobiGeoJsonSektorjev } from './map.js';
import { GOOGLE_APPS_SCRIPT_URL, STORAGE_KEY_DOGODEK } from './config.js';
import { osveziLokacijeEnot } from './units.js';

const STORAGE_SEZNAM_DOGODKOV = 'epv_vsi_dogodki';

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

    // 1. Zberemo lokalno shranjene dogodke
    let lokalniDogodki = [];
    try {
        lokalniDogodki = JSON.parse(localStorage.getItem(STORAGE_SEZNAM_DOGODKOV)) || [];
    } catch (e) {}

    // 2. Poizkusimo pridobiti še dogodke s strežnika
    let strezniskiDogodki = [];
    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiDogodke&geslo=EPV2026`);
        if (response.ok) {
            const odgovor = await response.json();
            strezniskiDogodki = Array.isArray(odgovor) ? odgovor : (odgovor.data || []);
        }
    } catch (err) {
        console.warn("Strežniški dogodki niso dosegljivi.");
    }

    // Združimo oba seznama (brez podvajanja po id)
    const vsiDogodkiMap = new Map();
    lokalniDogodki.forEach(d => vsiDogodkiMap.set(d.id, d));
    strezniskiDogodki.forEach(d => vsiDogodkiMap.set(d.id || d.naziv, d));

    selectEl.innerHTML = '<option value="novy">-- Nov dogodek --</option>';

    vsiDogodkiMap.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = `${d.naziv} ${d.datum ? '(' + d.datum + ')' : ''}`;
        selectEl.appendChild(opt);
    });

    // Ob spremembi v padajočem meniju
    selectEl.addEventListener('change', async (e) => {
        const dogodekId = e.target.value;
        if (dogodekId === 'novy' || !dogodekId) {
            narisaniSektorjiSloj.clearLayers();
            const inputIme = document.getElementById('input-ime-dogodka');
            if (inputIme) inputIme.value = '';
            osveziLokacijeEnot();
            return;
        }

        // Preverimo najprej lokalno
        const izbranLokalno = vsiDogodkiMap.get(dogodekId);
        if (izbranLokalno && izbranLokalno.sektorji) {
            naloziAktivniDogodek(izbranLokalno.sektorji);
            const inputIme = document.getElementById('input-ime-dogodka');
            if (inputIme) inputIme.value = izbranLokalno.naziv;
        } else {
            // Če ni lokalno, naložimo iz strežnika
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
            } catch (err) {}
        }

        osveziLokacijeEnot();
    });
}

export async function shraniDogodek() {
    const imeInput = document.getElementById('input-ime-dogodka');
    const imeDogodka = imeInput?.value.trim() || "Intervencija " + new Date().toLocaleDateString();
    
    const selectEl = document.getElementById('select-dogodek');
    const dogodekId = (selectEl?.value && selectEl.value !== 'novy') ? selectEl.value : 'dogodek_' + Date.now();
    const geojsonSektorji = pridobiGeoJsonSektorjev();
    
    const podatkiDogodka = {
        id: dogodekId,
        naziv: imeDogodka,
        datum: new Date().toLocaleDateString('sl-SI'),
        casShranjevanja: new Date().toISOString(),
        sektorji: geojsonSektorji
    };

    // 1. Shranimo trenutno aktivni dogodek
    localStorage.setItem(STORAGE_KEY_DOGODEK, JSON.stringify(podatkiDogodka));

    // 2. Dodamo v lokalni seznam vseh dogodkov
    let lokalniDogodki = [];
    try {
        lokalniDogodki = JSON.parse(localStorage.getItem(STORAGE_SEZNAM_DOGODKOV)) || [];
    } catch (e) {}

    const obstojeciIdx = lokalniDogodki.findIndex(d => d.id === dogodekId);
    if (obstojeciIdx >= 0) {
        lokalniDogodki[obstojeciIdx] = podatkiDogodka;
    } else {
        lokalniDogodki.push(podatkiDogodka);
    }
    localStorage.setItem(STORAGE_SEZNAM_DOGODKOV, JSON.stringify(lokalniDogodki));

    // 3. Pošljemo še na Apps Script strežnik
    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ akcija: "shraniDogodek", geslo: "EPV2026", ...podatkiDogodka })
        });
    } catch (err) {}

    alert(`Dogodek "${imeDogodka}" uspešno shranjen!`);
    await naloziSeznamDogodkov();
    if (selectEl) selectEl.value = dogodekId;
}

export function pripraviInNatisni() {
    window.print();
}
