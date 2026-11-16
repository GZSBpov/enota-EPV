// ==========================================
// EPV - MODUL ZA GENERIRANJE TERENSKE QR KODE
// ==========================================

import { TEREN_EPV_URL } from './config.js';
import { apiGet } from './api.js';

/**
 * Ustvari QR kodo z aktivnim dogodkom in jo prikaže v modalnem oknu
 */
export async function prikaziQRModal(novZeton = false) {
    const modal = document.getElementById('qr-modal');
    const qrContainer = document.getElementById('qr-code-container');
    const selectDogodek = document.getElementById('select-dogodek');
    const inputImeDogodka = document.getElementById('input-ime-dogodka');

    if (!modal || !qrContainer) return;

    // Pridobimo ime trenutno izbranega ali vnesenega dogodka
    let dogodekIme = "Splošno";
    
    if (inputImeDogodka && inputImeDogodka.value.trim() !== "") {
        dogodekIme = inputImeDogodka.value.trim();
    } else if (selectDogodek && selectDogodek.selectedIndex >= 0 && selectDogodek.value !== "novy") {
        dogodekIme = selectDogodek.options[selectDogodek.selectedIndex].text;
    }

    // Sestavimo celoten URL do terenEPV.html
    const bazniUrl = TEREN_EPV_URL || "https://gzsbpov.github.io/enota-EPV/terenEPV.html";
    // Žeton dogodka: z njim strežnik sprejme pozicije in sporočila samo od telefonov, ki so odprli to povezavo.
    // novZeton = true izda novega (stara QR koda in povezave prenehajo veljati).
    const stanjeZetona = document.getElementById('qr-zeton-stanje');
    const odgovor = await apiGet({ akcija: 'zetonDogodka', dogodek: dogodekIme, nov: novZeton ? '1' : '' });
    const zeton = odgovor.status === 'success' ? odgovor.zeton : '';
    if (stanjeZetona) {
        stanjeZetona.textContent = zeton
            ? (novZeton ? '🔒 Izdana je nova zaščitena povezava. Stare QR kode za ta dogodek ne veljajo več.' : '🔒 Zaščitena povezava: vpisuje lahko samo, kdor jo odpre.')
            : (odgovor.omrezje ? '⚠️ Ni povezave s strežnikom - povezava je brez zaščite.' : '⚠️ Povezava je brez zaščite (strežniška skripta še ni posodobljena).');
    }
    const terenskiUrl = `${bazniUrl}?dogodek=${encodeURIComponent(dogodekIme)}${zeton ? '&zeton=' + encodeURIComponent(zeton) : ''}`;

    posodobiPovezaveZaDeljenje(terenskiUrl, dogodekIme);

    // Počistimo prejšnjo QR kodo
    qrContainer.innerHTML = "";

    // Ustvarimo novo QR kodo z uporabo qrcode.min.js
    if (typeof QRCode !== 'undefined') {
        new QRCode(qrContainer, {
            text: terenskiUrl,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    } else {
        // Knjižnica za QR ni naložena: povezave NE pošiljamo zunanji storitvi (vsebuje žeton) - uporabi povezavo ali gumbe spodaj.
        qrContainer.textContent = 'QR kode ni mogoče izrisati (ni interneta za knjižnico). Uporabi povezavo spodaj.';
    }

    // Prikažemo modalno okno
    modal.style.display = 'flex';
}

/**
 * Poleg same QR kode pripravi tudi neposredno klikljivo povezavo do terenEPV.html in
 * gumbe za deljenje preko SMS/WhatsApp/Viber/Messenger ali kopiranje v odložišče - za primer,
 * ko skeniranje QR kode ni mogoče (npr. enota nima druge naprave ob sebi za skeniranje).
 */
function posodobiPovezaveZaDeljenje(terenskiUrl, dogodekIme) {
    const besediloDeljenje = `Povezava za EPV teren V2 (${dogodekIme}): ${terenskiUrl}`;

    const direktnaEl = document.getElementById('qr-direktna-povezava');
    if (direktnaEl) {
        direktnaEl.href = terenskiUrl;
        direktnaEl.textContent = terenskiUrl;
    }

    const smsEl = document.getElementById('qr-sms');
    if (smsEl) smsEl.href = `sms:?body=${encodeURIComponent(besediloDeljenje)}`;

    const waEl = document.getElementById('qr-whatsapp');
    if (waEl) waEl.href = `https://wa.me/?text=${encodeURIComponent(besediloDeljenje)}`;

    const viberEl = document.getElementById('qr-viber');
    if (viberEl) viberEl.href = `viber://forward?text=${encodeURIComponent(besediloDeljenje)}`;

    const messengerEl = document.getElementById('qr-messenger');
    if (messengerEl) messengerEl.href = `fb-messenger://share?link=${encodeURIComponent(terenskiUrl)}`;

    const kopirajBtn = document.getElementById('qr-kopiraj');
    if (kopirajBtn) {
        kopirajBtn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(terenskiUrl);
                kopirajBtn.textContent = '✅ Kopirano!';
                setTimeout(() => { kopirajBtn.textContent = '📋 Kopiraj'; }, 2000);
            } catch (err) {
                alert('Kopiranje ni uspelo. Povezava:\n' + terenskiUrl);
            }
        };
    }
}

/**
 * Zapre modalno okno za QR kodo
 */
export function zapriQRModal() {
    const modal = document.getElementById('qr-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Iniciira poslušalce dogodkov za gumb "📱 QR Teren" in gumb za zapiranje
 */
export function iniciirajQRGenerator() {
    const btnQrTeren = document.getElementById('btn-qr-teren');
    const btnZapriQr = document.getElementById('btn-zapri-qr');

    btnQrTeren?.addEventListener('click', () => prikaziQRModal(false));
    document.getElementById('btn-qr-nov-zeton')?.addEventListener('click', () => {
        if (window.confirm('Izdam novo QR kodo? Stare QR kode in povezave za ta dogodek prenehajo veljati - enote na terenu morajo skenirati novo.')) prikaziQRModal(true);
    });
    btnZapriQr?.addEventListener('click', zapriQRModal);
}
