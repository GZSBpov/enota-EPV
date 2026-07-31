// ==========================================
// EPV - GLAVNI MODUL APLIKACIJE (ENTRY POINT)
// ==========================================

import { iniciirajZemljevid } from './map.js';
import { iniciirajSlojeEnot, osveziLokacijeEnot } from './units.js';
import { naloziAktivniDogodek, shraniDogodek, pripraviInNatisni, naloziSeznamDogodkov } from './events.js';
import { OSVEZEVANJE_INTERVAL_MS, VSTOPNO_GESLO, OBS_STREAM_URL, TEREN_EPV_URL } from './config.js';

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
        if (newWidth > 220 && newWidth < window.innerWidth - 300) {
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

async function zagonAplikacije() {
    iniciirajZemljevid();
    iniciirajSlojeEnot();
    iniciirajResizer();
    iniciirajFullscreen();

    await naloziSeznamDogodkov();
    await naloziAktivniDogodek();

    setInterval(osveziLokacijeEnot, OSVEZEVANJE_INTERVAL_MS);

    document.getElementById('btn-shrani')?.addEventListener('click', () => shraniDogodek());
    document.getElementById('btn-tisk')?.addEventListener('click', () => pripraviInNatisni());
}

document.addEventListener('DOMContentLoaded', zagonAplikacije);
