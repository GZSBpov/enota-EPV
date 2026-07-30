// ==========================================
// EPV - GLAVNI MODUL APLIKACIJE (ENTRY POINT)
// ==========================================

import { iniciirajZemljevid } from './map.js';
import { iniciirajSlojeEnot, osveziLokacijeEnot } from './units.js';
import { naloziAktivniDogodek, shraniDogodek, pripraviInNatisni } from './events.js';
import { OSVEZEVANJE_INTERVAL_MS } from './config.js';

/**
 * Glavna funkcija za inicializacijo aplikacije ob zagonu
 */
async function zagonAplikacije() {
    console.log("Zagon EPV aplikacije...");

    // 1. Inicializacija zemljevida in slojev
    iniciirajZemljevid();
    iniciirajSlojeEnot();

    // 2. Nalaganje shranjenega dogodka (iz localStorage ali strežnika)
    await naloziAktivniDogodek();

    // 3. Prvo osveževanje lokacij enot
    await osveziLokacijeEnot();

    // 4. Nastavitev periodičnega osveževanja enot na terenu
    setInterval(() => {
        osveziLokacijeEnot();
    }, OSVEZEVANJE_INTERVAL_MS);

    // 5. Nastavitev poslušalcev dogodkov za gumba (če obstajata v HTML-ju)
    poveziGumbe();

    console.log("EPV aplikacija je uspešno pripravljena.");
}

/**
 * Poveže interaktivne gumba (npr. Shrani, Tiskaj) z ustreznimi funkcijami
 */
function poveziGumbe() {
    // Gumb za shranjevanje dogodka
    const gumbShrani = document.getElementById('btn-shrani');
    if (gumbShrani) {
        gumbShrani.addEventListener('click', () => {
            shraniDogodek();
        });
    }

    // Gumb za tiskanje poročila
    const gumbTisk = document.getElementById('btn-tisk');
    if (gumbTisk) {
        gumbTisk.addEventListener('click', () => {
            pripraviInNatisni();
        });
    }
}

// Zagon aplikacije ko se celoten DOM naloži
document.addEventListener('DOMContentLoaded', zagonAplikacije);
