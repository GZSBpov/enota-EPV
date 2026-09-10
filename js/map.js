import { ZACETNE_KOORDINATE, ZACETNI_ZOOM, SLOVAR_BARV } from './config.js';
import { pridobiZnanaImenaEnot } from './enote-register.js';

function pobegniAtribut(niz) {
    const el = document.createElement('div');
    el.textContent = niz ?? '';
    return el.innerHTML.replace(/"/g, '&quot;');
}

const BARVE_HEX = {
    "red": "#ef4444",
    "blue": "#3b82f6",
    "green": "#10b981",
    "gold": "#eab308",
    "orange": "#f97316",
    "purple": "#a855f7"
};

/**
 * Ikona za posamezno označeno točko (npr. lokacijo, ki jo je opazil dron) - tarča namesto
 * navadnega pina, da se vizualno loči od enot in sektorjev.
 */
function ustvariTockaIkono(barva) {
    const hex = BARVE_HEX[barva] || "#ef4444";
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26px" height="26px" style="filter: drop-shadow(0px 1px 3px rgba(0,0,0,0.6));">
            <circle cx="12" cy="12" r="9" fill="none" stroke="${hex}" stroke-width="3"/>
            <circle cx="12" cy="12" r="3" fill="${hex}"/>
        </svg>
    `;
    return L.divIcon({
        className: 'tocka-oznaka-ikona',
        html: svg,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -12]
    });
}

export let map;
export let narisaniSektorjiSloj;
export let enoteMarkerjiSloj;

let drawControl = null;
let trenutnaBarvaRisanja = "red";

function pridobiSlogZaBarvo(barva) {
    const hex = BARVE_HEX[barva] || "#ef4444";
    return { color: hex, fillColor: hex, fillOpacity: 0.35, weight: 3 };
}

/**
 * Zgradi (oz. zamenja) orodja za risanje, tako da nova oblika takoj med risanjem
 * uporabi trenutno izbrano barvo - ne rišemo več vedno v privzeti (modri) barvi Leafleta.
 */
function ustvariDrawControl() {
    if (drawControl) map.removeControl(drawControl);

    const slog = pridobiSlogZaBarvo(trenutnaBarvaRisanja);
    drawControl = new L.Control.Draw({
        edit: { featureGroup: narisaniSektorjiSloj },
        draw: {
            polygon: { allowIntersection: false, showArea: true, shapeOptions: slog },
            polyline: { shapeOptions: { color: slog.color, weight: 4 } },
            rectangle: { shapeOptions: slog },
            circle: { shapeOptions: slog },
            marker: true,
            circlemarker: false
        }
    });
    map.addControl(drawControl);
}

/**
 * Dodaten kontrolnik na zemljevidu za izbiro barve, s katero se bo narisal NASLEDNJI sektor.
 * Ločeno od barv enot - te barve so namenjene sektorjem/območjem in točkam.
 */
function dodajKontrolnikBarveRisanja() {
    const BarvniControl = L.Control.extend({
        // "topleft" - poleg orodij za risanje (poligon/črta/krog ...), ne pri stikalu Satelit/Ceste
        options: { position: 'topleft' },
        onAdd: function () {
            const div = L.DomUtil.create('div', 'leaflet-bar barva-risanja-kontrolnik');
            div.style.borderRadius = '4px';

            let opcije = '';
            for (const [kljuc, naziv] of Object.entries(SLOVAR_BARV)) {
                opcije += `<option value="${kljuc}" style="color:#000;" ${kljuc === trenutnaBarvaRisanja ? 'selected' : ''}>${naziv}</option>`;
            }
            // Samo majhen kvadratek v izbrani barvi (brez napisa) - klik odpre izbiro med imeni barv.
            div.innerHTML = `
                <select class="barva-risanja-select" title="Barva risanja - klikni za spremembo" style="width:30px; height:30px; padding:0; border:2px solid #fff; border-radius:4px; cursor:pointer; color:transparent; background-color:${BARVE_HEX[trenutnaBarvaRisanja]};">${opcije}</select>
            `;

            L.DomEvent.disableClickPropagation(div);
            const selectEl = div.querySelector('select');
            selectEl.addEventListener('change', (e) => {
                trenutnaBarvaRisanja = e.target.value;
                selectEl.style.backgroundColor = BARVE_HEX[trenutnaBarvaRisanja];
                ustvariDrawControl();
            });

            return div;
        }
    });
    map.addControl(new BarvniControl());
}

/**
 * Gumb "✅ Zaključi risanje", ki se prikaže med risanjem črte/poligona - namesto da se je
 * treba zanašati na dvoklik ali klik nazaj na zadnjo točko (na dotik/touch napravah nezanesljivo
 * in pogosto pomotoma prekine risanje že po dveh točkah).
 */
function dodajKontrolnikZakljucekRisanja() {
    const ZakljuciControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function () {
            const btn = L.DomUtil.create('a', 'leaflet-bar gumb-zakljuci-risanje');
            btn.href = '#';
            btn.title = 'Zaključi risanje';
            btn.innerHTML = '✅';
            btn.style.display = 'none';
            btn.style.background = '#16a34a';
            btn.style.color = '#fff';
            btn.style.fontWeight = 'bold';
            btn.style.textAlign = 'center';
            btn.style.lineHeight = '30px';
            btn.style.width = '30px';
            btn.style.height = '30px';
            btn.style.textDecoration = 'none';

            L.DomEvent.disableClickPropagation(btn);
            L.DomEvent.on(btn, 'click', L.DomEvent.stop);
            L.DomEvent.on(btn, 'click', () => {
                const aktivniNacin = drawControl?._toolbars?.draw?._activeMode;
                if (aktivniNacin?.handler?.completeShape) {
                    aktivniNacin.handler.completeShape();
                }
            });

            this._btn = btn;
            return btn;
        },
        pokazi: function () { if (this._btn) this._btn.style.display = 'block'; },
        skrij: function () { if (this._btn) this._btn.style.display = 'none'; }
    });

    return new ZakljuciControl();
}

/**
 * Prevede vmesnik Leaflet.Draw (orodna vrstica, namigi, gumbi urejanja) v slovenščino -
 * privzeto je knjižnica v angleščini. Klicati je treba PRED ustvarjanjem L.Control.Draw.
 */
function nastaviSlovenscinoRisanja() {
    if (!L.drawLocal) return;

    L.drawLocal.draw.toolbar.actions = { title: 'Prekliči risanje', text: 'Prekliči' };
    L.drawLocal.draw.toolbar.finish = { title: 'Zaključi risanje', text: 'Zaključi' };
    L.drawLocal.draw.toolbar.undo = { title: 'Izbriši zadnjo narisano točko', text: 'Izbriši zadnjo točko' };
    L.drawLocal.draw.toolbar.buttons = {
        polyline: 'Nariši črto',
        polygon: 'Nariši poligon',
        rectangle: 'Nariši pravokotnik',
        circle: 'Nariši krog',
        marker: 'Označi točko',
        circlemarker: 'Nariši krožno oznako'
    };

    L.drawLocal.draw.handlers.circle.tooltip.start = 'Kliknite in povlecite za risanje kroga.';
    L.drawLocal.draw.handlers.circle.radius = 'Polmer';
    L.drawLocal.draw.handlers.circlemarker.tooltip.start = 'Kliknite na zemljevid za postavitev krožne oznake.';
    L.drawLocal.draw.handlers.marker.tooltip.start = 'Kliknite na zemljevid za postavitev oznake.';
    L.drawLocal.draw.handlers.polygon.tooltip.start = 'Kliknite za začetek risanja oblike.';
    L.drawLocal.draw.handlers.polygon.tooltip.cont = 'Kliknite za nadaljevanje risanja oblike.';
    L.drawLocal.draw.handlers.polygon.tooltip.end = 'Kliknite na prvo točko za zaključek oblike.';
    L.drawLocal.draw.handlers.polyline.error = '<strong>Napaka:</strong> robovi oblike se ne smejo sekati!';
    L.drawLocal.draw.handlers.polyline.tooltip.start = 'Kliknite za začetek risanja črte.';
    L.drawLocal.draw.handlers.polyline.tooltip.cont = 'Kliknite za nadaljevanje risanja črte.';
    L.drawLocal.draw.handlers.polyline.tooltip.end = 'Kliknite zadnjo točko za zaključek črte.';
    L.drawLocal.draw.handlers.rectangle.tooltip.start = 'Kliknite in povlecite za risanje pravokotnika.';
    L.drawLocal.draw.handlers.simpleshape.tooltip.end = 'Spustite miškin gumb za zaključek risanja.';

    L.drawLocal.edit.toolbar.actions = {
        save: { title: 'Shrani spremembe', text: 'Shrani' },
        cancel: { title: 'Prekliči urejanje, zavrzi vse spremembe', text: 'Prekliči' },
        clearAll: { title: 'Izbriši vse sloje', text: 'Izbriši vse' }
    };
    L.drawLocal.edit.toolbar.buttons = {
        edit: 'Uredi sloje',
        editDisabled: 'Ni slojev za urejanje',
        remove: 'Izbriši sloje',
        removeDisabled: 'Ni slojev za brisanje'
    };
    L.drawLocal.edit.handlers.edit.tooltip = {
        text: 'Povlecite oglišča ali oznake za urejanje elementa.',
        subtext: 'Kliknite Prekliči za razveljavitev sprememb.'
    };
    L.drawLocal.edit.handlers.remove.tooltip = { text: 'Kliknite na element za brisanje.' };
}

export function iniciirajZemljevid() {
    nastaviSlovenscinoRisanja();

    // Dva podlagna sloja (kot v V1): satelitski posnetki (Esri) in navadna cestna karta (OSM)
    const satelitskaMapa = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles © Esri'
    });
    const cestnaMapa = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    });

    map = L.map('map', {
        center: ZACETNE_KOORDINATE,
        zoom: ZACETNI_ZOOM,
        layers: [satelitskaMapa]
    });

    L.control.layers({ "Satelit": satelitskaMapa, "Ceste": cestnaMapa }, null, { position: 'bottomright' }).addTo(map);

    narisaniSektorjiSloj = new L.FeatureGroup().addTo(map);
    enoteMarkerjiSloj = new L.LayerGroup().addTo(map);

    dodajKontrolnikBarveRisanja();
    const gumbZakljuciRisanje = dodajKontrolnikZakljucekRisanja();
    map.addControl(gumbZakljuciRisanje);
    ustvariDrawControl();

    // Med risanjem črte/poligona pokažemo gumb "✅ Zaključi risanje" - dvoklik/dvotap za
    // zaključek ostane na voljo, a ni več edini način (na dotik pogosto nezanesljiv).
    map.on(L.Draw.Event.DRAWSTART, (e) => {
        if (e.layerType === 'polyline' || e.layerType === 'polygon') {
            gumbZakljuciRisanje.pokazi();
        }
    });
    map.on(L.Draw.Event.DRAWSTOP, () => {
        gumbZakljuciRisanje.skrij();
    });

    map.on(L.Draw.Event.CREATED, (e) => {
        const layer = e.layer;
        const type = e.layerType;

        layer.options.barvaSektorja = trenutnaBarvaRisanja;
        layer.options.geometrijaTip = type;

        narisaniSektorjiSloj.addLayer(layer);
        posodobiIzgledSektorja(layer, trenutnaBarvaRisanja);
        nastaviPopupZaSektor(layer, trenutnaBarvaRisanja);
    });
}

/**
 * Изračuna površino ali dolžino sloja
 */
export function izracunajVelikost(layer) {
    if (layer instanceof L.Marker) {
        const ll = layer.getLatLng();
        return `Koordinate: ${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`;
    }
    if (layer instanceof L.Circle) {
        const r = layer.getRadius();
        const area = Math.PI * r * r;
        return area > 10000 
            ? `Površina: ${(area / 1000000).toFixed(2)} km²` 
            : `Površina: ${Math.round(area)} m²`;
    } 
    else if (layer instanceof L.Polygon) {
        const latlngs = layer.getLatLngs()[0];
        // Uporaba Leafletove Geodesic obdelave ali poenostavljen izračun
        let area = 0;
        if (latlngs.length > 2) {
            area = L.GeometryUtil ? L.GeometryUtil.geodesicArea(latlngs) : 0;
        }
        if (area === 0) return "Območje";
        return area > 10000 
            ? `Površina: ${(area / 1000000).toFixed(2)} km²` 
            : `Površina: ${Math.round(area)} m²`;
    } 
    else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        const latlngs = layer.getLatLngs();
        let length = 0;
        for (let i = 0; i < latlngs.length - 1; i++) {
            length += latlngs[i].distanceTo(latlngs[i + 1]);
        }
        return length > 1000 
            ? `Dolžina: ${(length / 1000).toFixed(2)} km` 
            : `Dolžina: ${Math.round(length)} m`;
    }
    return "";
}

/**
 * Posodobi stil barve sloja
 */
export function posodobiIzgledSektorja(layer, barva) {
    if (layer instanceof L.Marker) {
        layer.setIcon(ustvariTockaIkono(barva));
    } else if (layer.setStyle) {
        layer.setStyle(pridobiSlogZaBarvo(barva));
    }
    layer.options.barvaSektorja = barva;
}

/**
 * Ustvari okno (Popup) ob kliku na območje s padajočim menijem barv in izračunano mero
 */
export function nastaviPopupZaSektor(layer, izbranaBarva = "red") {
    const meroTekst = izracunajVelikost(layer);
    const jeTocka = layer instanceof L.Marker;

    let opcijeBarv = "";
    for (const [kly, naziv] of Object.entries(SLOVAR_BARV)) {
        const sel = (kly === izbranaBarva) ? "selected" : "";
        opcijeBarv += `<option value="${kly}" ${sel}>${naziv}</option>`;
    }

    let navigacijaSmsGumbi = "";
    if (jeTocka) {
        const ll = layer.getLatLng();
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${ll.lat},${ll.lng}`;
        const smsBesedilo = encodeURIComponent(`Preveri to lokacijo: https://www.google.com/maps?q=${ll.lat},${ll.lng}`);
        const smsUrl = `sms:?body=${smsBesedilo}`;
        navigacijaSmsGumbi = `
            <div style="display:flex; gap:6px; margin-top:8px;">
                <a href="${mapsUrl}" target="_blank" rel="noopener" style="flex:1; text-align:center; background:#2563eb; color:#fff; padding:5px 6px; border-radius:4px; text-decoration:none; font-weight:bold; font-size:11px;">🧭 Navigacija</a>
                <a href="${smsUrl}" style="flex:1; text-align:center; background:#059669; color:#fff; padding:5px 6px; border-radius:4px; text-decoration:none; font-weight:bold; font-size:11px;">📩 Pošlji SMS</a>
            </div>
        `;
    }

    const htmlVsebina = `
        <div style="color: #000; font-family: sans-serif; min-width: 190px;">
            <strong style="font-size: 1rem;">${jeTocka ? 'Označena točka' : 'Sektor / Območje'}</strong><br>
            <span style="font-size: 0.85rem; color: #475569;">${meroTekst}</span>
            ${navigacijaSmsGumbi}
            <br>
            <label style="font-size:0.8rem; font-weight:bold;">${jeTocka ? 'Barva oznake:' : 'Barva sektorja:'}</label><br>
            <select class="popup-barva-select" style="width: 100%; padding: 4px; margin-top: 4px;">
                ${opcijeBarv}
            </select>
            <label style="font-size:0.8rem; font-weight:bold; display:block; margin-top:8px;">Dodeljene enote:</label>
            <div class="popup-dodelitve-seznam" style="display:flex; flex-wrap:wrap; gap:4px; margin:4px 0;"></div>
            <select class="popup-dodelitev-select" style="width:100%; padding:4px; box-sizing:border-box;">
                <option value="">-- Izberi registrirano enoto --</option>
            </select>
            <input type="text" class="popup-dodelitev-input" list="seznam-znanih-enot-popup" placeholder="Ali vpiši novo ime in pritisni Enter..." style="width:100%; padding:4px; margin-top:4px; box-sizing:border-box;">
            <datalist id="seznam-znanih-enot-popup"></datalist>
        </div>
    `;

    layer.bindPopup(htmlVsebina);

    layer.on('popupopen', (e) => {
        const popNode = e.popup.getElement();

        // Seznam registriranih enot osvežimo OB VSAKEM odprtju (ne samo enkrat ob risanju sektorja),
        // sicer novo prijavljene enote ne bi bile na voljo v spustnem meniju/predlogih.
        const znaneEnote = pridobiZnanaImenaEnot();
        const dodelitevSelectZaOsvezitev = popNode.querySelector('.popup-dodelitev-select');
        if (dodelitevSelectZaOsvezitev) {
            dodelitevSelectZaOsvezitev.innerHTML = '<option value="">-- Izberi registrirano enoto --</option>' +
                znaneEnote.map(ime => `<option value="${pobegniAtribut(ime)}">${pobegniAtribut(ime)}</option>`).join('');
        }
        const datalistZaOsvezitev = popNode.querySelector('#seznam-znanih-enot-popup');
        if (datalistZaOsvezitev) {
            datalistZaOsvezitev.innerHTML = znaneEnote.map(ime => `<option value="${pobegniAtribut(ime)}"></option>`).join('');
        }

        const selectEl = popNode.querySelector('.popup-barva-select');
        if (selectEl) {
            selectEl.addEventListener('change', (evt) => {
                const novaBarva = evt.target.value;
                posodobiIzgledSektorja(layer, novaBarva);
            });
        }

        const seznamEl = popNode.querySelector('.popup-dodelitve-seznam');
        const inputEl = popNode.querySelector('.popup-dodelitev-input');
        const dodelitevSelectEl = popNode.querySelector('.popup-dodelitev-select');

        function izrisiChipe() {
            const enote = layer.options.dodeljeneEnote || [];
            seznamEl.innerHTML = enote.length ? enote.map(ime => `
                <span class="popup-dodelitev-chip" data-ime="${pobegniAtribut(ime)}" style="background:#e2e8f0; border-radius:4px; padding:2px 6px; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;">
                    ${pobegniAtribut(ime)}
                    <span class="popup-dodelitev-odstrani" style="cursor:pointer; font-weight:bold;">×</span>
                </span>
            `).join('') : '<span style="font-size:0.75rem; color:#94a3b8;">Ni dodeljenih enot.</span>';

            seznamEl.querySelectorAll('.popup-dodelitev-chip').forEach(chip => {
                chip.querySelector('.popup-dodelitev-odstrani').addEventListener('click', () => {
                    const ime = chip.dataset.ime;
                    layer.options.dodeljeneEnote = (layer.options.dodeljeneEnote || []).filter(e2 => e2 !== ime);
                    izrisiChipe();
                });
            });
        }

        izrisiChipe();

        if (inputEl) {
            inputEl.addEventListener('keydown', (evt) => {
                if (evt.key !== 'Enter') return;
                evt.preventDefault();
                const ime = inputEl.value.trim();
                if (!ime) return;
                dodajEnotoSektorju(layer, ime, izrisiChipe);
                inputEl.value = '';
            });
        }

        if (dodelitevSelectEl) {
            dodelitevSelectEl.addEventListener('change', (evt) => {
                const ime = evt.target.value;
                if (!ime) return;
                dodajEnotoSektorju(layer, ime, izrisiChipe);
                dodelitevSelectEl.value = '';
            });
        }
    });
}

/**
 * Doda enoto na seznam dodeljenih enot izbranega sektorja. Če je enota že dodeljena
 * drugemu sektorju, uporabnika vpraša, ali naj jo prestavi (odstrani iz starega, doda v novega)
 * ali prekliče (enota ostane v prvotnem sektorju).
 */
function dodajEnotoSektorju(ciljniLayer, ime, osveziChipe) {
    const imeMalo = ime.toLowerCase();

    if ((ciljniLayer.options.dodeljeneEnote || []).some(e => e.toLowerCase() === imeMalo)) {
        return; // enota je že dodeljena temu sektorju
    }

    let staraLayer = null;
    narisaniSektorjiSloj.eachLayer(l => {
        if (l === ciljniLayer || staraLayer) return;
        if ((l.options.dodeljeneEnote || []).some(e => e.toLowerCase() === imeMalo)) {
            staraLayer = l;
        }
    });

    if (staraLayer) {
        const potrdi = window.confirm(`Enota "${ime}" je že dodeljena drugemu sektorju.\nAli želite enoti dodeliti nov sektor?`);
        if (!potrdi) return; // Prekliči - enota ostane v prvotnem sektorju
        staraLayer.options.dodeljeneEnote = (staraLayer.options.dodeljeneEnote || []).filter(e => e.toLowerCase() !== imeMalo);
    }

    ciljniLayer.options.dodeljeneEnote = [...(ciljniLayer.options.dodeljeneEnote || []), ime];
    osveziChipe();
}

/**
 * Pretvori vse objekte v ustrezno GeoJSON strukturo (z ohranitvijo poligonov/krogov/črt)
 */
export function pridobiGeoJsonSektorjev() {
    const elementi = [];
    narisaniSektorjiSloj.eachLayer((layer) => {
        let geojson = layer.toGeoJSON();
        geojson.properties = geojson.properties || {};
        geojson.properties.barvaSektorja = layer.options.barvaSektorja || "red";
        geojson.properties.dodeljenaEnota = (layer.options.dodeljeneEnote || []).join(', ');

        if (layer instanceof L.Marker) {
            geojson.properties.tipObmočja = "tocka";
        } else if (layer instanceof L.Circle) {
            geojson.properties.tipObmočja = "circle";
            geojson.properties.polmer = layer.getRadius();
        } else if (layer instanceof L.Rectangle) {
            geojson.properties.tipObmočja = "rectangle";
        } else if (layer instanceof L.Polygon) {
            geojson.properties.tipObmočja = "polygon";
        } else if (layer instanceof L.Polyline) {
            geojson.properties.tipObmočja = "polyline";
        }

        elementi.push(geojson);
    });
    return elementi;
}
