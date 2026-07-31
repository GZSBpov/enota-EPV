// ==========================================
// EPV - GLAVNI MODUL APLIKACIJE (ENTRY POINT)
// ==========================================

import { iniciirajZemljevid } from './map.js';
import { iniciirajSlojeEnot, osveziLokacijeEnot } from './units.js';
import { naloziAktivniDogodek, shraniDogodek, pripraviInNatisni, naloziSeznamDogodkov } from './events.js';
import { OSVEZEVANJE_INTERVAL_MS, VSTOPNO_GESLO_HASH, OBS_STREAM_URL, TEREN_EPV_URL, STORAGE_KEY_GESLO } from './config.js';

/**
 * Varna pretvorba besedila v SHA-256 hash niz
 */
async function izracunajSHA256(besedilo) {
    const encoder = new TextEncoder();
    const data = encoder.encode(besedilo);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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

    const potrdi = async () => {
        const vneseniHash = await izracunajSHA256(input.value.trim());
        
        if (vneseniHash === VSTOPNO_GESLO_HASH) {
            sessionStorage.setItem(STORAGE_KEY_GESLO, "true");
            modal.style.display = 'none';
            napaka.textContent = "";
        } else {
            napaka.textContent = "Napačno geslo!";
            input.value = "";
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
