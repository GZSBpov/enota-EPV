// ==========================================
// EPV - GLAVNI MODUL APLIKACIJE (ENTRY POINT)
// ==========================================

import { iniciirajZemljevid } from './map.js';
import { iniciirajSlojeEnot, osveziLokacijeEnot } from './units.js';
import { naloziAktivniDogodek, shraniDogodek, pripraviInNatisni, naloziSeznamDogodkov } from './events.js';
import { OSVEZEVANJE_INTERVAL_MS, VSTOPNO_GESLO, OBS_STREAM_URL, TEREN_EPV_URL, STORAGE_KEY_GESLO } from './config.js';

function generirajQrKodo() {
    const qrContainer = document.getElementById('qr-code-container');
    const qrModal = document.getElementById('qr-modal');
    
    if (!qrContainer) return;
    qrContainer.innerHTML = '';

    // Uporaba qrcode.js knjižnice
    new QRCode(qrContainer, {
        text: TEREN_EPV_URL,
        width: 180,
        height: 180
    });

    qrModal.style.display = 'flex';
}

function poveziQrInVideoEvents() {
    // QR gumb in okno
    document.getElementById('btn-qr-teren')?.addEventListener('click', generirajQrKodo);
    document.getElementById('btn-zapri-qr')?.addEventListener('click', () => {
        document.getElementById('qr-modal').style.display = 'none';
    });

    // OBS Stream
    const iframe = document.getElementById('iframe-obs-stream');
    if (iframe && OBS_STREAM_URL) {
        iframe.src = OBS_STREAM_URL;
    }
}

async function zagonAplikacije() {
    iniciirajZemljevid();
    iniciirajSlojeEnot();
    poveziQrInVideoEvents();

    await naloziSeznamDogodkov();
    await naloziAktivniDogodek();

    setInterval(osveziLokacijeEnot, OSVEZEVANJE_INTERVAL_MS);

    document.getElementById('btn-shrani')?.addEventListener('click', () => shraniDogodek());
    document.getElementById('btn-tisk')?.addEventListener('click', () => pripraviInNatisni());
}

document.addEventListener('DOMContentLoaded', zagonAplikacije);
