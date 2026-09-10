import { narisaniSektorjiSloj, nastaviPopupZaSektor, posodobiIzgledSektorja, posodobiOznakoSektorja, pridobiGeoJsonSektorjev, map } from './map.js';
import { GOOGLE_APPS_SCRIPT_URL, ZACETNE_KOORDINATE } from './config.js';
import { osveziLokacijeEnot } from './units.js';
import { naloziSporocila } from './sporocila.js';
import { pridobiSejnoGeslo, vprasajZaGesloDogodka, generirajGesloDogodka, sha256Hex, shraniGesloDogodkaNaStreznik, shraniSejnoGeslo } from './geslo-dogodka.js';

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
        } else if (tip === "tocka" && elem.geometry.type === "Point") {
            const coords = [elem.geometry.coordinates[1], elem.geometry.coordinates[0]];
            layer = L.marker(coords); // ikona (barva) se nastavi spodaj preko posodobiIzgledSektorja
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
            // "dodeljenaEnota" je shranjena kot en niz z imeni, ločenimi z vejico (lahko je več enot na sektor)
            layer.options.dodeljeneEnote = (elem.properties?.dodeljenaEnota || '')
                .split(',')
                .map(ime => ime.trim())
                .filter(Boolean);
            layer.options.nazivSektorja = elem.properties?.nazivSektorja || '';
            try {
                layer.options.casDodelitve = JSON.parse(elem.properties?.casDodelitve || '{}');
            } catch (e) {
                layer.options.casDodelitve = {};
            }
            narisaniSektorjiSloj.addLayer(layer);
            if (jeOkvarjenPodatek) {
                layer.bindPopup('<div style="color:#000; font-family:sans-serif; font-size:0.85rem; max-width:220px;"><b>⚠️ Star/okvarjen podatek</b><br>Ta krog je bil narisan s staro različico aplikacije, ki ni shranila polmera. Prosimo, na novo ga nariši in znova shrani dogodek.</div>');
            } else {
                posodobiIzgledSektorja(layer, barva);
                nastaviPopupZaSektor(layer, barva);
                posodobiOznakoSektorja(layer);
            }
        }
    });
}

/**
 * Naloži sektorje za izbran dogodek (najprej strežnik, nato lokalna kopija kot rezerva).
 * Če je dogodek zaščiten z geslom (nastavljeno ob zaključku intervencije), strežnik vrne
 * status "locked" - v tem primeru vprašamo uporabnika za geslo in poskusimo znova.
 * Vrne true, če je dostop uspel (ali dogodek sploh ni zaščiten), false, če je bil dostop zavrnjen.
 */
async function naloziSektorjeDogodka(imeDogodka) {
    const predpomnilnik = nalozitLokalniPredpomnilnik();
    let sektorji = predpomnilnik[imeDogodka];
    let dostopUspel = true;

    try {
        let gesloHash = pridobiSejnoGeslo(imeDogodka);
        let res = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiDogodke&dogodek=${encodeURIComponent(imeDogodka)}&gesloHashDogodka=${encodeURIComponent(gesloHash)}&geslo=EPV2026`, { cache: 'no-store' });
        let odgovor = res.ok ? await res.json() : null;

        if (odgovor && odgovor.status === 'locked') {
            gesloHash = await vprasajZaGesloDogodka(imeDogodka);
            if (!gesloHash) {
                dostopUspel = false;
                alert(`Dostop do dogodka "${imeDogodka}" je zavrnjen - geslo ni bilo vneseno.`);
            } else {
                res = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiDogodke&dogodek=${encodeURIComponent(imeDogodka)}&gesloHashDogodka=${encodeURIComponent(gesloHash)}&geslo=EPV2026`, { cache: 'no-store' });
                odgovor = res.ok ? await res.json() : null;
                if (odgovor && odgovor.status === 'locked') {
                    dostopUspel = false;
                    alert('Napačno geslo - dostop do tega dogodka zavrnjen.');
                }
            }
        }

        if (dostopUspel && odgovor && odgovor.status === 'success' && Array.isArray(odgovor.data) && odgovor.data.length > 0) {
            sektorji = odgovor.data.map(vrstica => vrstica.podatki).filter(Boolean);
        }
    } catch (err) {
        console.warn(`Sektorjev za dogodek "${imeDogodka}" ni bilo mogoče naložiti s strežnika, uporabljam lokalno kopijo (če obstaja).`, err);
    }

    if (!dostopUspel) {
        narisiSektorje([]);
        return false;
    }

    narisiSektorje(sektorji);

    if (sektorji) {
        predpomnilnik[imeDogodka] = sektorji;
        shraniLokalniPredpomnilnik(predpomnilnik);
    }
    return true;
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
                osveziGumbZakljucka();
                return;
            }

            if (inputIme) inputIme.value = imeDogodka;
            const dostopUspel = await naloziSektorjeDogodka(imeDogodka);
            if (!dostopUspel) {
                // Dostop zavrnjen (napačno/manjkajoče geslo dogodka) - vrni izbiro na "Nov dogodek"
                selectEl.value = 'novy';
                if (inputIme) inputIme.value = '';
                narisaniSektorjiSloj.clearLayers();
                osveziLokacijeEnot();
                naloziSporocila();
                osveziGumbZakljucka();
                return;
            }
            osveziLokacijeEnot();
            naloziSporocila();
            osveziGumbZakljucka();
        });
    }
}

export async function shraniDogodek(tiho = false) {
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

    // Če je bil ta dogodek zaščiten z geslom (zaključena intervencija), moramo geslo poslati
    // tudi tu (POST z mode:'no-cors' ne vrne odgovora, ki bi ga lahko prebrali, zato se ob
    // napačnem/manjkajočem geslu sicer NE bo javila napaka - a strežnik shranjevanja ne bo izvedel).
    let uspesnoShranjeno = await posljiShranjevanjeSektorjev(imeDogodka, sektorjiZaPosiljanje, pridobiSejnoGeslo(imeDogodka));
    if (!uspesnoShranjeno) {
        const gesloHash = await vprasajZaGesloDogodka(imeDogodka);
        if (gesloHash) {
            uspesnoShranjeno = await posljiShranjevanjeSektorjev(imeDogodka, sektorjiZaPosiljanje, gesloHash);
        }
        if (!uspesnoShranjeno) {
            alert(`Shranjevanje na strežnik ni uspelo - dogodek "${imeDogodka}" je zaščiten in vneseno geslo ni pravilno. Sektorji so shranjeni samo lokalno na tej napravi.`);
        }
    }

    if (!tiho && uspesnoShranjeno) alert(`Dogodek "${imeDogodka}" uspešno shranjen!`);
    await naloziSeznamDogodkov();
    if (selectEl) selectEl.value = imeDogodka;
}

/**
 * Pošlje sektorje na strežnik (akcija shraniSektorje). Ker POST uporablja mode:'no-cors'
 * (Apps Script POST sicer sproži CORS predhodno zahtevo), odgovora ne moremo prebrati -
 * zato uporabimo ločeno GET-preverjanje gesla PRED pošiljanjem, da vemo, ali je verjetno uspelo.
 */
async function posljiShranjevanjeSektorjev(imeDogodka, sektorjiZaPosiljanje, gesloHash) {
    try {
        const preveriUrl = `${GOOGLE_APPS_SCRIPT_URL}?akcija=preveriGesloDogodka&dogodek=${encodeURIComponent(imeDogodka)}&gesloHash=${encodeURIComponent(gesloHash || '')}&geslo=EPV2026`;
        const res = await fetch(preveriUrl, { cache: 'no-store' });
        const odgovor = res.ok ? await res.json() : null;
        if (odgovor && odgovor.status === 'success' && odgovor.zascitena === true && odgovor.ok !== true) {
            return false; // dogodek je zaščiten in geslo ni pravilno - ne pošiljaj (bi bilo zavrnjeno)
        }
    } catch (err) {
        // Preverjanje ni uspelo (npr. stara različica strežnika brez te akcije) - poskusimo vseeno poslati
    }

    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            // text/plain namesto application/json, da Apps Script POST ne sproži CORS predhodne (preflight) zahteve
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ akcija: "shraniSektorje", geslo: "EPV2026", dogodek: imeDogodka, sektorji: sektorjiZaPosiljanje, gesloHashDogodka: gesloHash || '' })
        });
        if (gesloHash) shraniSejnoGeslo(imeDogodka, gesloHash);
        return true;
    } catch (err) {
        console.warn("Shranjevanje na strežnik ni uspelo, dogodek je shranjen samo lokalno.", err);
        return false;
    }
}

/**
 * Pošlje sistemski zaznamek (npr. "Konec intervencije"/"Popravek intervencije") z lokacijo
 * in trenutnim časom, preko istega mehanizma kot terenska sporočila. Enota "SISTEM:..." se
 * v units.js izrecno izloči iz seznama enot, zato se v stranski vrstici/poročilu ne pojavi
 * kot navidezna enota - ostane pa v dnevniku sporočil kot zaznamek.
 */
async function posljiZaznamekDogodka(dogodekId, besedilo) {
    const center = map ? map.getCenter() : { lat: ZACETNE_KOORDINATE[0], lng: ZACETNE_KOORDINATE[1] };
    try {
        const url = `${GOOGLE_APPS_SCRIPT_URL}?enota=${encodeURIComponent('SISTEM:' + besedilo + ':0')}&lat=${center.lat}&lon=${center.lng}&acc=0&dogodek=${encodeURIComponent(dogodekId)}&sporocilo=${encodeURIComponent(besedilo.toUpperCase())}`;
        await fetch(url, { method: 'GET', mode: 'no-cors' });
    } catch (err) {
        console.warn(`Napaka pri beleženju zaznamka "${besedilo}":`, err);
    }
}

/**
 * Preveri, ali je dogodek trenutno v "zaključenem" stanju: zadnji zaznamek "konec intervencije"
 * je novejši od zadnjega "popravek intervencije" (če popravka sploh ni bilo, zadostuje zaključek).
 */
async function jeDogodekZakljucen(dogodekId) {
    try {
        const gesloHash = pridobiSejnoGeslo(dogodekId);
        const res = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiSporocila&dogodek=${encodeURIComponent(dogodekId)}&gesloHashDogodka=${encodeURIComponent(gesloHash)}&geslo=EPV2026`, { cache: 'no-store' });
        if (!res.ok) return false;
        const odgovor = await res.json();
        // Če je dogodek zaščiten in geslo (še) ni bilo potrjeno za to sejo, sektorji zgoraj
        // (naloziSektorjeDogodka) že niso bili naloženi - tu samo tiho obravnavamo kot "ni znano".
        if (odgovor.status !== 'success' || !Array.isArray(odgovor.data)) return false;

        const sporocila = odgovor.data.filter(s => s && s.sporocilo);
        const zadnjiCasZa = (iskanaBeseda) => sporocila
            .filter(s => (s.sporocilo || '').toLowerCase().includes(iskanaBeseda))
            .map(s => s.cas || '')
            .sort()
            .pop();

        const zadnjiZakljucek = zadnjiCasZa('konec intervencije');
        if (!zadnjiZakljucek) return false;

        const zadnjiPopravek = zadnjiCasZa('popravek intervencije');
        return !(zadnjiPopravek && zadnjiPopravek > zadnjiZakljucek);
    } catch (err) {
        return false;
    }
}

/**
 * Neposredno nastavi videz/napis gumba (brez spraševanja strežnika) - uporabimo takoj po tem,
 * ko SAMI ravnokar zaključimo/popravimo dogodek, saj takojšnje ponovno branje s strežnika lahko
 * še ne odraža pravkar zapisanega sporočila (kratka zakasnitev pri Apps Scriptu).
 */
function nastaviStanjeGumba(stanje) {
    const btn = document.getElementById('btn-zakljuci-dogodek');
    if (!btn) return;

    if (stanje === 'zakljucena') {
        btn.textContent = '✏️ Popravek zaključene intervencije';
        btn.style.backgroundColor = '#d97706';
        btn.dataset.stanje = 'zakljucena';
    } else {
        btn.textContent = '🏁 Zaključi intervencijo';
        btn.style.backgroundColor = '#dc2626';
        btn.dataset.stanje = 'aktivna';
    }
}

/**
 * Osveži videz/napis gumba glede na to, ali je izbrani dogodek trenutno zaključen ali aktiven -
 * kliče se ob preklopu dogodka, ko dejansko stanje ni (še) znano in ga je treba vprašati strežnik.
 */
export async function osveziGumbZakljucka() {
    const selectEl = document.getElementById('select-dogodek');
    const dogodekId = selectEl?.value || '';

    if (!dogodekId || dogodekId === 'novy') {
        nastaviStanjeGumba('aktivna');
        return;
    }

    const zakljucen = await jeDogodekZakljucen(dogodekId);
    nastaviStanjeGumba(zakljucen ? 'zakljucena' : 'aktivna');
}

/**
 * Zaključi trenutno izbrano intervencijo/dogodek: zabeleži čas zaključka (kot posebno
 * sporočilo "KONEC INTERVENCIJE", da se to prikaže v poročilu za tisk) in shrani trenutno
 * stanje sektorjev.
 */
async function zakljuciIntervencijo() {
    const selectEl = document.getElementById('select-dogodek');
    const dogodekId = selectEl?.value || '';

    if (!dogodekId || dogodekId === 'novy') {
        alert('Najprej izberi ali ustvari dogodek.');
        return;
    }

    const potrdi = window.confirm(`Ali res želite zaključiti intervencijo "${dogodekId}"?`);
    if (!potrdi) return;

    await posljiZaznamekDogodka(dogodekId, 'Konec intervencije');

    // Ob vsakem zaključku (tudi po popravku in ponovnem zaključku) se generira novo geslo za
    // dostop do podatkov tega dogodka - od zdaj naprej so ogled/popravki/tisk zanj zaščiteni.
    // Geslo na strežniku POSODOBIMO PRED shranjevanjem sektorjev, da se preverjanje gesla
    // znotraj shraniDogodek() (ki uporabi novo geslo, saj ga takoj spodaj shranimo za to sejo)
    // ujema s tem, kar strežnik v tistem trenutku dejansko pričakuje.
    const novoGeslo = generirajGesloDogodka();
    const novGesloHash = await sha256Hex(novoGeslo);
    const gesloShranjenoNaStreznik = await shraniGesloDogodkaNaStreznik(dogodekId, novGesloHash);
    shraniSejnoGeslo(dogodekId, novGesloHash); // takoj na voljo za to sejo, brez ponovnega vnosa

    await shraniDogodek(true);

    if (gesloShranjenoNaStreznik) {
        alert(`Intervencija "${dogodekId}" je bila zaključena ob ${new Date().toLocaleString('sl-SI')}.\n\n🔑 GESLO ZA DOSTOP DO TE INTERVENCIJE (popravki/analiza): ${novoGeslo}\n\nShranite/zapišite si to geslo - brez njega kasnejši dostop do teh podatkov ne bo mogoč!`);
    } else {
        alert(`Intervencija "${dogodekId}" je bila zaključena ob ${new Date().toLocaleString('sl-SI')}.\n\n⚠️ Gesla za zaščito dogodka ni bilo mogoče shraniti na strežnik (povezava ni uspela) - dogodek trenutno NI zaščiten z geslom. Poskusite znova zaključiti intervencijo, ko bo povezava spet na voljo.`);
    }
    naloziSporocila();
    nastaviStanjeGumba('zakljucena');
}

/**
 * Znova odpre že zaključeno intervencijo za popravke - zabeleži zaznamek "popravek intervencije"
 * (s tem gumb spet preklopi nazaj na "Zaključi"). Sektorje/podatke je treba po popravku shraniti
 * ročno (💾 Shrani) ali z novim klikom na "Zaključi intervencijo".
 */
async function popraviIntervencijo() {
    const selectEl = document.getElementById('select-dogodek');
    const dogodekId = selectEl?.value || '';
    if (!dogodekId || dogodekId === 'novy') return;

    const potrdi = window.confirm(`Intervencija "${dogodekId}" je bila zaključena.\nAli želite popraviti podatke? Dogodek bo znova odprt za urejanje, dokler ga znova ne zaključite.`);
    if (!potrdi) return;

    await posljiZaznamekDogodka(dogodekId, 'Popravek intervencije');

    alert('Dogodek je znova odprt za urejanje. Ko končate s popravki, ga shranite (💾 Shrani) ali znova zaključite.');
    naloziSporocila();
    nastaviStanjeGumba('aktivna');
}

/**
 * Poslušalec gumba "🏁 Zaključi intervencijo" / "✏️ Popravek" - glede na trenutno stanje
 * gumba (nastavi ga osveziGumbZakljucka) izvede ustrezno akcijo.
 */
export async function obravnavajGumbZakljucka() {
    const btn = document.getElementById('btn-zakljuci-dogodek');
    if (btn?.dataset.stanje === 'zakljucena') {
        await popraviIntervencijo();
    } else {
        await zakljuciIntervencijo();
    }
}
