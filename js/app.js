// ==========================================
// EPV - GLAVNI MODUL APLIKACIJE (ENTRY POINT)
// ==========================================

import { iniciirajZemljevid, map } from './map.js';
import { iniciirajSlojeEnot, osveziLokacijeEnot } from './units.js';
import { shraniDogodek, naloziSeznamDogodkov } from './events.js';
import { iniciirajQRGenerator } from './qr.js';
import { naloziSporocila } from './sporocila.js';
import { pripraviInNatisni } from './tisk.js';
import { OSVEZEVANJE_INTERVAL_MS, OBS_STREAM_URL, STORAGE_KEY_GESLO } from './config.js';

const PRAVO_GESLO = "EPV2026";

async function naloziVsebinoAplikacije() {
    iniciirajZemljevid();
    iniciirajSlojeEnot();
    iniciirajVideoStream();
    iniciirajStrnitevVidea();
    iniciirajResizer();
    iniciirajFullscreen();
    iniciirajPrilagajanjeVelikosti();

    // Naložimo seznam dogodkov iz Google Sheeta
    await naloziSeznamDogodkov();

    // Iniciacija modalnega okna za QR kodo
    iniciirajQRGenerator();

    setInterval(osveziLokacijeEnot, OSVEZEVANJE_INTERVAL_MS);
    setInterval(naloziSporocila, OSVEZEVANJE_INTERVAL_MS);
    naloziSporocila();

    // Poslušalci dogodkov za gumba in padajoči meni
    document.getElementById('btn-shrani')?.addEventListener('click', () => shraniDogodek());
    document.getElementById('btn-tisk')?.addEventListener('click', () => pripraviInNatisni());
    document.getElementById('btn-osvezi-dogodke')?.addEventListener('click', () => naloziSeznamDogodkov());
    // Opomba: poslušalec za preklop dogodkov v spustnem meniju se registrira
    // znotraj naloziSeznamDogodkov() (v events.js), zato ga tu ne podvajamo.
}

function preveriGeslo() {
    const modal = document.getElementById('vstopno-geslo-modal');
    const input = document.getElementById('input-geslo');
    const btn = document.getElementById('btn-potrdi-geslo');
    const napaka = document.getElementById('geslo-napaka');

    if (!modal) return;

    if (sessionStorage.getItem(STORAGE_KEY_GESLO) === "true") {
        modal.style.display = 'none';
        naloziVsebinoAplikacije();
        return;
    }

    modal.style.display = 'flex';

    function potrdiPrijavo() {
        const vnos = input ? input.value.trim() : "";

        if (vnos === PRAVO_GESLO) {
            sessionStorage.setItem(STORAGE_KEY_GESLO, "true");
            modal.style.display = 'none';
            if (napaka) napaka.textContent = "";
            naloziVsebinoAplikacije();
        } else {
            if (napaka) napaka.textContent = "Napačno geslo! Poskusite znova.";
            if (input) {
                input.value = "";
                input.focus();
            }
        }
    }

    if (btn) btn.onclick = potrdiPrijavo;

    if (input) {
        input.onkeydown = function(e) {
            if (e.key === 'Enter') {
                potrdiPrijavo();
            }
        };
    }
}

function iniciirajVideoStream() {
    const iframe = document.getElementById('iframe-obs-stream');
    if (iframe && OBS_STREAM_URL) {
        iframe.src = OBS_STREAM_URL;
    }
}

function iniciirajStrnitevVidea() {
    const btn = document.getElementById('btn-toggle-video');
    const panel = document.getElementById('video-stream-container');
    if (!btn || !panel) return;

    btn.addEventListener('click', () => {
        const strnjen = panel.classList.toggle('strnjen');
        btn.textContent = strnjen ? '▶' : '▼';
    });
}

function iniciirajResizer() {
    const resizer = document.getElementById('resizer');
    const sidebar = document.getElementById('sidebar');
    if (!resizer || !sidebar) return;

    let isResizing = false;

    resizer.addEventListener('mousedown', () => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth > 250 && newWidth < window.innerWidth - 300) {
            sidebar.style.width = `${newWidth}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.cursor = 'default';
    });
}

/**
 * Leaflet ob spremembi velikosti vsebnika (npr. preklop mobilne/namizne postavitve,
 * vrtenje telefona, strnitev video okna) ne prilagodi izrisa samodejno - to je treba sprožiti ročno.
 */
function iniciirajPrilagajanjeVelikosti() {
    let casovnik = null;
    const osveziZemljevid = () => {
        clearTimeout(casovnik);
        casovnik = setTimeout(() => map?.invalidateSize(), 150);
    };
    window.addEventListener('resize', osveziZemljevid);
    window.addEventListener('orientationchange', osveziZemljevid);
}

function iniciirajFullscreen() {
    document.querySelectorAll('.btn-fullscreen').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                if (!document.fullscreenElement) {
                    targetEl.requestFullscreen?.() || targetEl.webkitRequestFullscreen?.();
                } else {
                    document.exitFullscreen?.();
                }
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', preveriGeslo);
