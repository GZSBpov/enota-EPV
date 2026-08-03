import { narisaniSektorjiSloj, nastaviPopupZaSektor, posodobiIzgledSektorja, pridobiGeoJsonSektorjev } from './map.js';
import { GOOGLE_APPS_SCRIPT_URL } from './config.js';
import { osveziLokacijeEnot } from './units.js';
import { naloziSporocila } from './sporocila.js';

// Lokalna varnostna kopija dogodkov, ker Google Apps Script ni vedno dosegljiv.
// Dogodek je identificiran po IMENU (tako ga hrani tudi Apps Script - glej list "Dogodki").
const STORAGE_LOKALNI_DOGODKI = 'epv_lokalni_dogodki_v2';

function nalozitLokalniPredpomnilnik() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_LOKALNI_DOGODKI)) || {};
    } catch (e) {
        return {};
    }
}

function shraniLokalniPredpomnilnik(predpomnilnik) {
    localStorage.setItem(STORAGE_LOKALNI_DOGODKI, JSON.stringify(predpomnilnik));
}

function narisiSektorje(sektorji) {
    narisaniSektorjiSloj.clearLayers();

    if (!sektorji || !Array.isArray(sektorji)) return;

    sektorji.forEach(elem => {
        let layer;
        const barva = elem.properties?.barvaSektorja || "red";
        const tip = elem.properties?.tipObmočja;
        // Star podatek (npr. krog narisan s staro V1 aplikacijo), ki ni shranil tipa/polmera -
        // ne moremo ga pravilno prikazati kot krog, zato ga vidno označimo namesto tihe napačne oznake.
        const jeOkvarjenPodatek = !tip && elem.geometry?.type === "Point";

        if (tip === "circle" && elem.geometry.type === "Point") {
            const coords = [elem.geometry.coordinates[1], elem.geometry.coordinates[0]];
            layer = L.circle(coords, { radius: elem.properties.polmer || 100 });
        } else if (jeOkvarjenPodatek) {
            const coords = [elem.geometry.coordinates[1], elem.geometry.coordinates[0]];
            layer = L.marker(coords, {
                icon: L.divIcon({
                    className: 'sektor-napaka-ikona',
                    html: '⚠️',
                    iconSize: [28, 28],
                    iconAnchor: [14, 26]
                })
            });
        } else {
            layer = L.geoJSON(elem).getLayers()[0];
        }

        if (layer) {
            layer.options.dodeljenaEnota = elem.properties?.dodeljenaEnota || "";
            narisaniSektorjiSloj.addLayer(layer);
            if (jeOkvarjenPodatek) {
                layer.bindPopup('<div style="color:#000; font-family:sans-serif; font-size:0.85rem; max-width:220px;"><b>⚠️ Star/okvarjen podatek</b><br>Ta krog je bil narisan s staro različico aplikacije, ki ni shranila polmera. Prosimo, na novo ga nariši in znova shrani dogodek.</div>');
            } else {
                posodobiIzgledSektorja(layer, barva);
                nastaviPopupZaSektor(layer, barva);
            }
        }
    });
}

/**
 * Naloži sektorje za izbran dogodek (najprej strežnik, nato lokalna kopija kot rezerva)
 */
async function naloziSektorjeDogodka(imeDogodka) {
    const predpomnilnik = nalozitLokalniPredpomnilnik();
    let sektorji = predpomnilnik[imeDogodka];

    try {
        const res = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiDogodke&dogodek=${encodeURIComponent(imeDogodka)}&geslo=EPV2026`, { cache: 'no-store' });
        if (res.ok) {
            const odgovor = await res.json();
            if (odgovor.status === 'success' && Array.isArray(odgovor.data) && odgovor.data.length > 0) {
                sektorji = odgovor.data.map(vrstica => vrstica.podatki).filter(Boolean);
            }
        }
    } catch (err) {
        console.warn(`Sektorjev za dogodek "${imeDogodka}" ni bilo mogoče naložiti s strežnika, uporabljam lokalno kopijo (če obstaja).`, err);
    }

    narisiSektorje(sektorji);

    if (sektorji) {
        predpomnilnik[imeDogodka] = sektorji;
        shraniLokalniPredpomnilnik(predpomnilnik);
    }
}

export async function naloziSeznamDogodkov() {
    const selectEl = document.getElementById('select-dogodek');
    if (!selectEl) return;

    let imenaDogodkov = [];
    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiSeznamDogodkov&geslo=EPV2026`, { cache: 'no-store' });
        if (response.ok) {
            const odgovor = await response.json();
            if (odgovor.status === 'success' && Array.isArray(odgovor.data)) {
                imenaDogodkov = odgovor.data;
            }
        }
    } catch (err) {
        console.warn("Seznam dogodkov s strežnika ni dosegljiv, prikazujem samo lokalno znane dogodke.", err);
    }

    // Dodamo še dogodke, ki so bili shranjeni samo lokalno (npr. strežnik takrat ni bil dosegljiv)
    const predpomnilnik = nalozitLokalniPredpomnilnik();
    Object.keys(predpomnilnik).forEach(ime => {
        if (!imenaDogodkov.includes(ime)) imenaDogodkov.push(ime);
    });

    const trenutnaVrednost = selectEl.value;
    selectEl.innerHTML = '<option value="novy">-- Nov dogodek --</option>';
    imenaDogodkov.forEach(ime => {
        const opt = document.createElement('option');
        opt.value = ime;
        opt.textContent = ime;
        selectEl.appendChild(opt);
    });

    if (imenaDogodkov.includes(trenutnaVrednost)) {
        selectEl.value = trenutnaVrednost;
    }

    // Poslušalec registriramo samo EN krat (funkcija se sicer kliče ob zagonu, ob gumbu "Osveži"
    // in po vsakem shranjevanju - brez tega bi se ob vsakem klicu dodal še en podvojen listener)
    if (!selectEl.dataset.changeVezan) {
        selectEl.dataset.changeVezan = "1";
        selectEl.addEventListener('change', async (e) => {
            const imeDogodka = e.target.value;
            const inputIme = document.getElementById('input-ime-dogodka');

            if (imeDogodka === 'novy' || !imeDogodka) {
                narisaniSektorjiSloj.clearLayers();
                if (inputIme) inputIme.value = '';
                osveziLokacijeEnot();
                naloziSporocila();
                return;
            }

            if (inputIme) inputIme.value = imeDogodka;
            await naloziSektorjeDogodka(imeDogodka);
            osveziLokacijeEnot();
            naloziSporocila();
        });
    }
}

export async function shraniDogodek() {
    const imeInput = document.getElementById('input-ime-dogodka');
    const selectEl = document.getElementById('select-dogodek');

    let imeDogodka = imeInput?.value.trim();
    if (!imeDogodka) {
        imeDogodka = (selectEl?.value && selectEl.value !== 'novy')
            ? selectEl.value
            : ('Intervencija ' + new Date().toLocaleDateString('sl-SI'));
    }

    const geojsonSektorji = pridobiGeoJsonSektorjev();

    // Lokalna varnostna kopija (deluje tudi, če Apps Script ni dosegljiv)
    const predpomnilnik = nalozitLokalniPredpomnilnik();
    predpomnilnik[imeDogodka] = geojsonSektorji;
    shraniLokalniPredpomnilnik(predpomnilnik);

    // Pošljemo na Apps Script v obliki, ki jo strežnik dejansko pričakuje: {dogodek, sektorji:[{tip, geojson, dodeljenaEnota}]}
    const sektorjiZaPosiljanje = geojsonSektorji.map(g => ({
        tip: g.properties?.tipObmočja || 'polygon',
        dodeljenaEnota: g.properties?.dodeljenaEnota || '',
        geojson: g
    }));

    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            // text/plain namesto application/json, da Apps Script POST ne sproži CORS predhodne (preflight) zahteve
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ akcija: "shraniSektorje", geslo: "EPV2026", dogodek: imeDogodka, sektorji: sektorjiZaPosiljanje })
        });
    } catch (err) {
        console.warn("Shranjevanje na strežnik ni uspelo, dogodek je shranjen samo lokalno.", err);
    }

    alert(`Dogodek "${imeDogodka}" uspešno shranjen!`);
    await naloziSeznamDogodkov();
    if (selectEl) selectEl.value = imeDogodka;
}
