// ==========================================
// EPV - PRVOTNI GENERATOR QR KODE
// ==========================================

import { TEREN_EPV_URL } from './config.js';

/**
 * Ustvari QR kodo z uporabo prvotne QRCode knjižnice
 */
export function ustvariQrKodo() {
    const tipEl = document.getElementById('qrTip');
    const clanovEl = document.getElementById('qrClanov');
    const qrIzhodEl = document.getElementById('qr-izhod');
    const qrUrlTekstEl = document.getElementById('qr-url-tekst');
    const selectDogodek = document.getElementById('select-dogodek');

    if (!tipEl || !clanovEl || !qrIzhodEl) return;

    const t = tipEl.value;
    const c = clanovEl.value;

    // Pridobimo še ime dogodka, če je izbrano
    let dogodekParam = "";
    if (selectDogodek && selectDogodek.value && selectDogodek.selectedIndex >= 0) {
        const dogodekIme = selectDogodek.options[selectDogodek.selectedIndex].text;
        dogodekParam = `&dogodek=${encodeURIComponent(dogodekIme)}`;
    }

    // Sestavimo URL (uporabi TEREN_EPV_URL ali neposredno GitHub povezavo)
    const bazniUrl = TEREN_EPV_URL || "https://gzsbpov.github.io/enota-EPV/terenEPV.html";
    const url = `${bazniUrl}?tip=${t}&clanov=${c}${dogodekParam}`;

    // Počistimo prejšnjo QR kodo
    qrIzhodEl.innerHTML = "";
    
    if (qrUrlTekstEl) {
        qrUrlTekstEl.innerText = url;
    }

    // Ustvarimo novo QR kodo z uporabo prvotne knjižnice QRCode
    if (typeof QRCode !== 'undefined') {
        new QRCode(qrIzhodEl, {
            text: url,
            width: 110,
            height: 110
        });
    } else {
        console.warn("Knjižnica QRCode.js ni naložena v HTML!");
    }
}

/**
 * Iniciira poslušalce sprememb na vnosnih poljih
 */
export function iniciirajQRGenerator() {
    const tipEl = document.getElementById('qrTip');
    const clanovEl = document.getElementById('qrClanov');
    const selectDogodek = document.getElementById('select-dogodek');

    tipEl?.addEventListener('change', ustvariQrKodo);
    clanovEl?.addEventListener('input', ustvariQrKodo);
    clanovEl?.addEventListener('change', ustvariQrKodo);
    selectDogodek?.addEventListener('change', ustvariQrKodo);

    // Začetni izris QR kode
    ustvariQrKodo();
}
