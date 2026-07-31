// ==========================================
// EPV - GLAVNI MODUL APLIKACIJE (ENTRY POINT)
// ==========================================

import { iniciirajZemljevid } from './map.js';
import { iniciirajSlojeEnot, osveziLokacijeEnot } from './units.js';
import { naloziAktivniDogodek, shraniDogodek, pripraviInNatisni, naloziSeznamDogodkov } from './events.js';
import { OSVEZEVANJE_INTERVAL_MS, VSTOPNO_GESLO, OBS_STREAM_URL, TEREN_EPV_URL, STORAGE_KEY_GESLO } from './config.js';

/**
 * Preveri vstopno geslo ob zagonu
 */
function preveriGeslo() {
    const modal = document.getElementById('vstopno-geslo-modal');
    const input = document.getElementById('input-geslo');
    const btn = document.getElementById('btn-potrdi-geslo');
    const napaka = document.getElementById('geslo-napaka');

    if (!modal) return;

    if (sessionStorage.getItem(STORAGE_KEY_GESLO) === "true") {
        modal.style.display = 'none';
        return;
    }

    modal.style.display = 'flex';

    const potrdi = () => {
        if (input.value === VSTOPNO_GESLO) {
            sessionStorage.setItem(STORAGE_KEY_GESLO, "true");
            modal.style.display = 'none';
        } else {
            napaka.textContent = "Napačno geslo!";
        }
    };

    btn.addEventListener('click', potrdi);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') potrdi();
    });
}

function iniciirajVideoStream() {
    const iframe = document.getElementById('iframe-obs-stream');
    const btnToggle = document.getElementById('btn-toggle-video');
    const wrapper = document.getElementById('video-wrapper');

    if (iframe && OBS_STREAM_URL) {
        iframe.src = OBS_STREAM_URL;
    }

    if (btnToggle && wrapper) {
        btnToggle.addEventListener('click', () => {
            if (wrapper.style.display === 'none') {
                wrapper.style.display = 'block';
                btnToggle.textContent = '▼';
            } else {
                wrapper.style.display = 'none';
                btnToggle.textContent = '▲';
            }
        });
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

async function zagonAplikacije() {
    preveriGeslo();
    iniciirajZemljevid();
    iniciirajSlojeEnot();
    iniciirajVideoStream();
    iniciirajResizer();

    await naloziSeznamDogodkov();
    await naloziAktivniDogodek();

    setInterval(osveziLokacijeEnot, OSVEZEVANJE_INTERVAL_MS);

    document.getElementById('btn-shrani')?.addEventListener('click', () => shraniDogodek());
    document.getElementById('btn-tisk')?.addEventListener('click', () => pripraviInNatisni());
}

document.addEventListener('DOMContentLoaded', zagonAplikacije);
