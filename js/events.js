// ==========================================
// EPV - MODUL ZA UPRAVLJANJE DOGODKOV
// ==========================================

import { GOOGLE_APPS_SCRIPT_URL } from './config.js';

const EPV_GESLO = "EPV2026";

/**
 * Naloži seznam vseh dogodkov iz Google Apps Script
 */
export async function naloziSeznamDogodkov() {
    const selectEl = document.getElementById('select-dogodek');
    if (!selectEl) return;

    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiDogodke&geslo=${encodeURIComponent(EPV_GESLO)}`);
        if (response.ok) {
            const odgovor = await response.json();
            
            // Izvlečemo listo dogodkov (če je zapakirana v odgovor.data ali neposredno tabela)
            const seznamDogodkov = Array.isArray(odgovor) ? odgovor : (odgovor.data || []);

            selectEl.innerHTML = '<option value="novy">-- Nov dogodek --</option>';

            if (Array.isArray(seznamDogodkov) && seznamDogodkov.length > 0) {
                seznamDogodkov.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.id || d.ID || d.naziv;
                    const datumPrikaz = d.datum ? ` (${new Date(d.datum).toLocaleDateString()})` : '';
                    opt.textContent = `${d.naziv || d.Naziv || 'Dogodek brez naslova'}${datumPrikaz}`;
                    selectEl.appendChild(opt);
                });
            } else if (odgovor.status === 'error') {
                console.warn("Google Apps Script napaka:", odgovor.message);
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
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiAktivniDogodek&geslo=${encodeURIComponent(EPV_GESLO)}`);
        if (response.ok) {
            const podatki = await response.json();
            const dejanskiPodatki = podatki.data || podatki;
            if (dejanskiPodatki && !dejanskiPodatki.error) {
                const inputNaziv = document.getElementById('input-naziv-dogodka');
                if (inputNaziv && dejanskiPodatki.naziv) {
                    inputNaziv.value = dejanskiPodatki.naziv;
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
            geslo: EPV_GESLO,
            naziv: naziv,
            timestamp: new Date().toISOString()
        };

        await fetch(GOOGLE_APPS_SCRIPT_URL, {
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
