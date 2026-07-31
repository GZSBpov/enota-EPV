// ==========================================
// EPV - GLAVNI MODUL APLIKACIJE (ENTRY POINT)
// ==========================================

import { iniciirajZemljevid, map } from './map.js';
import { iniciirajSlojeEnot, osveziLokacijeEnot } from './units.js';
import { naloziAktivniDogodek, shraniDogodek, pripraviInNatisni, naloziSeznamDogodkov } from './events.js';
import { OSVEZEVANJE_INTERVAL_MS, VSTOPNO_GESLO, OBS_STREAM_URL, TEREN_EPV_URL } from './config.js';

/**
 * Omogoča spreminjanje širine med zemljevidom in desno vrstico z miško (Resizable)
 */
function iniciirajResizer() {
    const resizer = document.getElementById('resizer');
    const sidebar = document.getElementById('sidebar');
    const mapContainer = document.getElementById('map-container');

    if (!resizer || !sidebar || !mapContainer) return;

    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        // Izračun nove širine desne vrstice od desnega roba zaslona
        const newWidth = window.innerWidth - e.clientX;
        
        if (newWidth > 220 && newWidth < window.innerWidth - 300) {
            sidebar.style.width = `${newWidth}px`;
            if (map) {
                map.invalidateSize(); // Posodobi osveževanje Leaflet zemljevida ob spremembi dimenzije
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
            if (map) map.invalidateSize();
        }
    });
}

/**
 * Omogoča celozaslonski prikaz za poljubno okno/kartico
 */
function iniciirajFullscreen() {
    const fsButtons = document.querySelectorAll('.btn-fullscreen');

    fsButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);

            if (targetEl) {
                if (!document.fullscreenElement) {
                    if (targetEl.requestFullscreen) {
                        targetEl.requestFullscreen();
                    } else if (targetEl.webkitRequestFullscreen) {
                        targetEl.webkitRequestFullscreen();
                    }
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    }
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
