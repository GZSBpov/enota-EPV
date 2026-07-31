// ==========================================
// EPV - GLAVNI MODUL APLIKACIJE (ENTRY POINT)
// ==========================================

import { iniciirajZemljevid } from './map.js';
import { iniciirajSlojeEnot, osveziLokacijeEnot } from './units.js';
import { naloziAktivniDogodek, shraniDogodek, pripraviInNatisni, naloziSeznamDogodkov } from './events.js';
import { OSVEZEVANJE_INTERVAL_MS, OBS_STREAM_URL, STORAGE_KEY_GESLO } from './config.js';

// DIREKTNO VSTOPNO GESLO
const PRAVO_GESLO = "EPV2026";

async function naloziVsebinoAplikacije() {
    iniciirajZemljevid();
    iniciirajSlojeEnot();
    iniciirajVideoStream();
    iniciirajResizer();
    iniciirajFullscreen();

    await naloziSeznamDogodkov();
    await naloziAktivniDogodek();

    setInterval(osveziLokacijeEnot, OSVEZEVANJE_INTERVAL_MS);

    document.getElementById('btn-shrani')?.addEventListener('click', () => shraniDogodek());
    document.getElementById('btn-tisk')?.addEventListener('click', () => pripraviInNatisni());
}

function preveriGeslo() {
    const modal = document.getElementById('vstopno-geslo-modal');
    const input = document.getElementById('input-geslo');
    const btn = document.getElementById('btn-potrdi-geslo');
    const napaka = document.getElementById('geslo-napaka');

    if (!modal) {
        console.error("Modalno okno #vstopno-geslo-modal ne obstaja v HTML!");
        return;
    }

    // Preverimo, če je v tej seji že potrjen vstop
    if (sessionStorage.getItem(STORAGE_KEY_GESLO) === "true") {
        modal.style.display = 'none';
        naloziVsebinoAplikacije();
        return;
    }

    modal.style.display = 'flex';

    function potrdiPrijavo() {
        const vnos = input ? input.value.trim() : "";
        console.log("Vneseno geslo:", vnos); // Izpis v F12 konzolo za preverjanje

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

    // Odstranimo stare event listenere in dodamo nove
    if (btn) {
        btn.onclick = potrdiPrijavo;
    }

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
