// ==========================================
// EPV - MODUL ZA GENERIRANJE TERENSKE QR KODE
// ==========================================

import { TEREN_EPV_URL } from './config.js';

/**
 * Ustvari QR kodo z aktivnim dogodkom in jo prikaže v modalnem oknu
 */
export function prikaziQRModal() {
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
    const terenskiUrl = `${bazniUrl}?dogodek=${encodeURIComponent(dogodekIme)}`;

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
        // Če knjižnica ni naložena, uporabi rezervni API
        qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(terenskiUrl)}" alt="QR Koda" style="border: 1px solid #ccc; padding: 5px; background: white; border-radius: 4px;" />`;
    }

    // Prikažemo modalno okno
    modal.style.display = 'flex';
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

    btnQrTeren?.addEventListener('click', prikaziQRModal);
    btnZapriQr?.addEventListener('click', zapriQRModal);
}
