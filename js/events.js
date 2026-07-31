// ==========================================
// EPV - MODUL ZA UPRAVLJANJE DOGODKOV
// ==========================================

import { GOOGLE_APPS_SCRIPT_URL } from './config.js';

// Geslo, ki ga pošiljamo v Google Apps Script
const EPV_GESLO = "EPV2026";

/**
 * Naloži seznam vseh dogodkov iz Google Apps Script
 */
export async function naloziSeznamDogodkov() {
    const selectEl = document.getElementById('select-dogodek');
    if (!selectEl) return;

    try {
        // Dodan parameter &geslo=EPV2026
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiDogodke&geslo=${encodeURIComponent(EPV_GESLO)}`);
        if (response.ok) {
            const dogodki = await response.json();
            
            if (Array.isArray(dogodki)) {
                selectEl.innerHTML = '<option value="novy">-- Nov dogodek --</option>';
                dogodki.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.id;
                    opt.textContent = `${d.naziv} (${new Date(d.datum).toLocaleDateString()})`;
                    selectEl.appendChild(opt);
                });
            } else if (dogodki.status === 'error') {
                console.warn("Google Apps Script napaka:", dogodki.message);
            } else {
                console.warn("Prejet odgovor iz Driva ni tabela:", dogodki);
            }
        }
    } catch (err) {
        console.warn("Ni mogoče naložiti seznama z Google Apps Script:", err);
    }
}

/**
 * Naloži podrobnosti aktivnega dogodka
 */
export async function naloziAktivniDogodek() {
    try {
        // Dodan parameter &geslo=EPV2026
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiAktivniDogodek&geslo=${encodeURIComponent(EPV_GESLO)}`);
        if (response.ok) {
            const podatki = await response.json();
            if (podatki && !podatki.error && !podatki.status) {
                const inputNaziv = document.getElementById('input-naziv-dogodka');
                if (inputNaziv && podatki.naziv) {
                    inputNaziv.value = podatki.naziv;
                }
            }
        }
    } catch (err) {
        console.warn("Ni mogoče naložiti aktivnega dogodka:", err);
    }
}

/**
 * Shrani trenutni dogodek na Google Apps Script
 */
export async function shraniDogodek() {
    const nazivInput = document.getElementById('input-naziv-dogodka');
    const naziv = nazivInput ? nazivInput.value.trim() : "";

    if (!naziv) {
        alert("Prosimo, vnesite naziv dogodka!");
        return;
    }

    try {
        const payload = {
            akcija: "shraniDogodek",
            geslo: EPV_GESLO, // Dodano geslo v telo zahtevka
            naziv: naziv,
            timestamp: new Date().toISOString()
        };

        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        alert("Dogodek je bil uspešno poslan v shranjevanje!");
    } catch (err) {
        console.error("Napaka pri shranjevanju dogodka:", err);
        alert("Napaka pri shranjevanju dogodka.");
    }
}

/**
 * Pripravi pogled in odpre okno za tiskanje
 */
export function pripraviInNatisni() {
    window.print();
}
