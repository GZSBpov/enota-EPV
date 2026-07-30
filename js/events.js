// ==========================================
// EPV - MODUL ZA DOGODKE, SHRANJEVANJE IN TISK
// ==========================================

import { map, narisaniSektorjiSloj, nastaviPopupZaSektor, pridobiGeoJsonSektorjev } from './map.js';
import { enoteSloj } from './units.js';
import { STORAGE_KEY_DOGODEK } from './config.js';

/**
 * Shrani trenutno stanje dogodka v localStorage in na strežnik
 */
export async function shraniDogodek(dogodekId = "aktivni_dogodek") {
    const geojsonSektorji = pridobiGeoJsonSektorjev();
    
    const podatkiDogodka = {
        id: dogodekId,
        casShranjevanja: new Date().toISOString(),
        sektorji: geojsonSektorji
    };

    // 1. Shranjevanje v lokalno shrambo (fallback ob izpadu povezave)
    try {
        localStorage.setItem(STORAGE_KEY_DOGODEK, JSON.stringify(podatkiDogodka));
        console.log("Dogodek uspešno shranjen v localStorage.");
    } catch (e) {
        console.error("Napaka pri shranjevanju v localStorage:", e);
    }

    // 2. Poskus shranjevanja na backend strežnik
    try {
        const response = await fetch(`/api/dogodki/${dogodekId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(podatkiDogodka)
        });
        if (response.ok) {
            console.log("Dogodek uspešno sinhroniziran s strežnikom.");
        }
    } catch (err) {
        console.warn("Strežnik ni dosegljiv, podatki so shranjeni lokalno.", err);
    }
}

/**
 * Naloži shranjeni dogodek in izriše sektorje na zemljevid
 */
export async function naloziAktivniDogodek() {
    let podatki = null;

    // Najprej poskusimo prebrati iz localStorage
    const lokalniPodatki = localStorage.getItem(STORAGE_KEY_DOGODEK);
    if (lokalniPodatki) {
        try {
            podatki = JSON.parse(lokalniPodatki);
        } catch (e) {
            console.error("Napaka pri branju localStorage:", e);
        }
    }

    if (!podatki || !podatki.sektorji) return;

    // Počistimo obstoječe sektorje na zemljevidu
    narisaniSektorjiSloj.clearLayers();

    // Nalaganje GeoJSON sektorjev nazaj na sloj
    L.geoJSON(podatki.sektorji, {
        onEachFeature: (feature, layer) => {
            const barva = feature.properties?.barvaSektorja || "red";
            narisaniSektorjiSloj.addLayer(layer);
            nastaviPopupZaSektor(layer, barva);
        }
    });
}

/**
 * Pripravi poseben prikaz zemljevida in tabele ter sproži tiskanje (A4 poročilo)
 */
export function pripraviInNatisni() {
    const printMapEl = document.getElementById('print-map');
    const printTabelaEl = document.getElementById('print-tabela');

    if (!printMapEl) {
        console.error("Element #print-map ne obstaja!");
        window.print();
        return;
    }

    // Ocistimo prejšnji tiskalni zemljevid, če obstaja
    printMapEl.innerHTML = '';

    // Ustvarimo začasni Leaflet zemljevid za tisk
    const printMap = L.map('print-map', {
        attributionControl: false,
        zoomControl: false
    }).setView(map.getCenter(), map.getZoom());

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(printMap);

    // Kloniranje sektorjev na tiskalni zemljevid
    narisaniSektorjiSloj.eachLayer((layer) => {
        if (layer instanceof L.Path) {
            const barva = layer.options.barvaSektorja || 'red';
            if (layer instanceof L.Polygon) {
                L.polygon(layer.getLatLngs(), { color: barva, fillColor: barva, fillOpacity: 0.3 }).addTo(printMap);
            } else if (layer instanceof L.Polyline) {
                L.polyline(layer.getLatLngs(), { color: barva }).addTo(printMap);
            } else if (layer instanceof L.Circle) {
                L.circle(layer.getLatLng(), { radius: layer.getRadius(), color: barva }).addTo(printMap);
            }
        }
    });

    // Kloniranje markerjev enot skupaj z napisi (Tooltip)
    enoteSloj.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
            const novMarker = L.marker(layer.getLatLng(), { icon: layer.options.icon }).addTo(printMap);
            if (layer.getTooltip()) {
                novMarker.bindTooltip(layer.getTooltip().getContent(), {
                    permanent: true,
                    direction: 'top'
                });
            }
        }
    });

    // Generiranje tabele enot za tisk
    if (printTabelaEl) {
        let htmlTabela = `
            <table class="tisk-tabela">
                <thead>
                    <tr>
                        <th>Enota</th>
                        <th>Status</th>
                        <th>Zadnja kooperativa / Lokacija</th>
                    </tr>
                </thead>
                <tbody>
        `;

        enoteSloj.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                const ll = layer.getLatLng();
                const ime = layer.options.title || "Enota";
                htmlTabela += `
                    <tr>
                        <td><b>${ime}</b></td>
                        <td>Aktivno</td>
                        <td>${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}</td>
                    </tr>
                `;
            }
        });

        htmlTabela += `</tbody></table>`;
        printTabelaEl.innerHTML = htmlTabela;
    }

    // Počakamo kratek trenutek, da se ploščice (tiles) zemljevida naložijo, nato sprožimo tisk
    setTimeout(() => {
        window.print();
    }, 500);
}
