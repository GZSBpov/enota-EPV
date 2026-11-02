// ==========================================
// EPV - GESLO ZAKLJUČENE INTERVENCIJE
// Ko se intervencija zaključi (🏁 Zaključi intervencijo), se zanjo generira naključno
// geslo. Od takrat dostop do njenih podatkov (sektorji, sporočila, popravki, tiskanje)
// na strežniku zahteva to geslo - ne samo splošno geslo aplikacije (EPV2026).
// ==========================================

import { GOOGLE_APPS_SCRIPT_URL } from './config.js';

const STORAGE_SEJA_GESLA = 'epv_seja_gesla_dogodkov';

/**
 * SHA-256 zgoščena vrednost (hex) - geslo dogodka se na strežnik nikoli ne pošlje v
 * berljivi obliki, samo kot zgoščena vrednost (enako se primerja na strežniški strani).
 */
export async function sha256Hex(besedilo) {
    const podatki = new TextEncoder().encode(besedilo);
    const digest = await crypto.subtle.digest('SHA-256', podatki);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function pridobiSejnaGesla() {
    try {
        return JSON.parse(sessionStorage.getItem(STORAGE_SEJA_GESLA)) || {};
    } catch (e) {
        return {};
    }
}

/**
 * Vrne že preverjeno (pravilno) geslo dogodka za TO sejo brskalnika, če ga imamo -
 * namerno sessionStorage (ne localStorage), da geslo ne ostane trajno shranjeno na napravi.
 */
export function pridobiSejnoGeslo(imeDogodka) {
    return pridobiSejnaGesla()[imeDogodka] || '';
}

export function shraniSejnoGeslo(imeDogodka, gesloHash) {
    const gesla = pridobiSejnaGesla();
    gesla[imeDogodka] = gesloHash;
    sessionStorage.setItem(STORAGE_SEJA_GESLA, JSON.stringify(gesla));
}

export function pozabiSejnoGeslo(imeDogodka) {
    const gesla = pridobiSejnaGesla();
    delete gesla[imeDogodka];
    sessionStorage.setItem(STORAGE_SEJA_GESLA, JSON.stringify(gesla));
}

/**
 * Ustvari naključno 6-mestno številsko geslo (PIN) - dovolj enostavno, da si ga vodja
 * lahko zapiše ali prebere po radijski zvezi.
 */
export function generirajGesloDogodka() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Vpraša uporabnika za geslo dogodka (npr. ob poskusu ogleda/popravka zaščitenega
 * zaključenega dogodka), izračuna njegovo zgoščeno vrednost in jo shrani za to sejo.
 * Vrne zgoščeno vrednost ali null, če je uporabnik vnos preklical/pustil prazno.
 */
export async function vprasajZaGesloDogodka(imeDogodka) {
    const vnos = window.prompt(`Dogodek "${imeDogodka}" je zaščiten z geslom (nastavljeno ob zaključku intervencije).\nVnesite geslo za dostop (popravki / analiza):`);
    if (vnos === null || vnos.trim() === '') return null;
    const hash = await sha256Hex(vnos.trim());
    shraniSejnoGeslo(imeDogodka, hash);
    return hash;
}

/**
 * Pošlje strežniku novo geslo za dogodek (kliče se ob zaključku intervencije).
 * Geslo je poslano samo kot zgoščena vrednost.
 */
export async function shraniGesloDogodkaNaStreznik(imeDogodka, gesloHash) {
    try {
        const url = `${GOOGLE_APPS_SCRIPT_URL}?akcija=shraniGesloDogodka&dogodek=${encodeURIComponent(imeDogodka)}&gesloHash=${encodeURIComponent(gesloHash)}&geslo=EPV2026`;
        const res = await fetch(url, { cache: 'no-store' });
        const odgovor = await res.json();
        return odgovor.status === 'success';
    } catch (err) {
        console.warn('Napaka pri shranjevanju gesla dogodka:', err);
        return false;
    }
}

/**
 * PONASTAVITEV POZABLJENEGA GESLA: kdorkoli ima splošno geslo aplikacije (EPV2026 - ki ga
 * mora poznati vsak, ki sploh uporablja mapeEPV.html), lahko za dogodek nastavi povsem NOVO
 * geslo, ne da bi poznal staro - staro takoj preneha veljati. Namenoma ni ločene "admin" prijave:
 * v tej aplikaciji je splošno geslo aplikacije edina obstoječa raven administratorskih pravic.
 * Vrne zgoščeno vrednost novega gesla, ali null, če shranjevanje na strežnik ni uspelo.
 */
export async function ponastaviGesloDogodka(imeDogodka) {
    const novoGeslo = generirajGesloDogodka();
    const novGesloHash = await sha256Hex(novoGeslo);
    const uspesno = await shraniGesloDogodkaNaStreznik(imeDogodka, novGesloHash);

    if (!uspesno) {
        alert('Ponastavitev gesla ni uspela (povezava s strežnikom ni uspela). Poskusite znova.');
        return null;
    }

    shraniSejnoGeslo(imeDogodka, novGesloHash);
    alert(`Geslo za dogodek "${imeDogodka}" je bilo ponastavljeno.\n\n🔑 NOVO GESLO: ${novoGeslo}\n\nShranite/zapišite si ga - staro geslo od zdaj ne velja več.`);
    return novGesloHash;
}
