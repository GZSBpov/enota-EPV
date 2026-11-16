// ==========================================
// EPV - GLAVNI MODUL APLIKACIJE (ENTRY POINT)
// ==========================================

import { iniciirajZemljevid, map } from './map.js';
import { iniciirajSlojeEnot, osveziLokacijeEnot, osveziStatuse } from './units.js';
import { shraniDogodek, naloziSeznamDogodkov, obravnavajGumbZakljucka } from './events.js';
import { iniciirajQRGenerator } from './qr.js';
import { naloziSporocila, iniciirajAlarmSOS } from './sporocila.js';
import { iniciirajStabSporocila, osveziStabLog } from './stab-sporocila.js';
import { iniciirajTocke, osveziTocke } from './tocke.js';
import { pripraviInNatisni } from './tisk.js';
import { OSVEZEVANJE_INTERVAL_MS, OSVEZEVANJE_STATUSOV_MS, OSVEZEVANJE_STAB_LOGA_MS, OBS_STREAM_URL } from './config.js';


// Štabni računalnik: zaslon naj ne zaspi, dokler je aplikacija odprta, ob vrnitvi na zavihek pa se takoj osveži
// (brskalnik zavihke v ozadju upočasni - opozorila bi sicer lahko zamujala do minute).
let wakeLock = null;
async function zahtevajWakeLock() {
    try {
        if ('wakeLock' in navigator && !wakeLock) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        }
    } catch (err) { /* ni podprto ali zavrnjeno - zaslon ostane odvisen od nastavitev računalnika */ }
}

function iniciirajSkrbZaOzadje() {
    zahtevajWakeLock();
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        zahtevajWakeLock();
        osveziLokacijeEnot();
        naloziSporocila();
        osveziTocke();
        osveziStabLog();
        osveziStatuse();
    });
}

async function naloziVsebinoAplikacije() {
    if (!window.EPV_KONFIGURACIJA_OK) {
        const opozorilo = document.getElementById('konfiguracija-opozorilo');
        if (opozorilo) opozorilo.style.display = 'block';
    }
    window.EPVZvok?.pripraviGumb(document.getElementById('btn-zvok'));
    const zamenjajGeslo = async () => {
        const novo = window.prompt('Novo geslo aplikacije (vsaj 8 znakov). Velja za štab in taktično tablo; teren uporablja QR kodo.');
        if (novo === null) return;
        const ponovi = window.prompt('Ponovi novo geslo:');
        if (ponovi !== novo) { alert('Gesli se ne ujemata.'); return; }
        const r = await window.EPVPrijava.zamenjaj(window.EPVPrijava.geslo(), novo);
        if (r.ok) { alert('Geslo je zamenjano. Staro geslo ne velja več - novo sporoči ostalim v štabu.'); const o = document.getElementById('geslo-opozorilo'); if (o) o.style.display = 'none'; }
        else alert('Gesla ni bilo mogoče zamenjati: ' + r.sporocilo);
    };
    document.getElementById('btn-geslo')?.addEventListener('click', zamenjajGeslo);
    document.getElementById('geslo-opozorilo')?.addEventListener('click', zamenjajGeslo);
    iniciirajSkrbZaOzadje();
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
    iniciirajStabSporocila();
    iniciirajTocke();
    iniciirajAlarmSOS();

    setInterval(osveziLokacijeEnot, OSVEZEVANJE_INTERVAL_MS);
    setInterval(naloziSporocila, OSVEZEVANJE_INTERVAL_MS);
    setInterval(osveziTocke, OSVEZEVANJE_INTERVAL_MS);
    setInterval(osveziStabLog, OSVEZEVANJE_STAB_LOGA_MS);
    // "pred X min" in barve stanja se spreminjajo tudi brez novih podatkov
    setInterval(osveziStatuse, OSVEZEVANJE_STATUSOV_MS);
    naloziSporocila();
    osveziTocke();
    osveziStabLog();

    // Poslušalci dogodkov za gumba in padajoči meni
    document.getElementById('btn-shrani')?.addEventListener('click', () => shraniDogodek());
    document.getElementById('btn-tisk')?.addEventListener('click', () => pripraviInNatisni());
    // Modul načrtovanja: taktična tabla v novem oknu, na trenutnem izrezu zemljevida in z nazivom izbranega dogodka
    document.getElementById('btn-nacrt')?.addEventListener('click', () => {
        const c = map.getCenter();
        const dogodek = document.getElementById('select-dogodek')?.value || '';
        const naziv = dogodek && dogodek !== 'novy' ? `&naziv=${encodeURIComponent(dogodek)}` : '';
        window.open(`nacrtEPV.html?lat=${c.lat.toFixed(6)}&lon=${c.lng.toFixed(6)}&z=${map.getZoom()}${naziv}`, '_blank');
    });
    document.getElementById('btn-osvezi-dogodke')?.addEventListener('click', () => naloziSeznamDogodkov());
    document.getElementById('btn-zakljuci-dogodek')?.addEventListener('click', () => obravnavajGumbZakljucka());
    // Opomba: poslušalec za preklop dogodkov v spustnem meniju se registrira
    // znotraj naloziSeznamDogodkov() (v events.js), zato ga tu ne podvajamo.
}

// ime okna: gumb »EPV štab« na taktični tabli se vrne v to okno, namesto da odpre novega
try { window.name = 'epv-stab'; } catch (e) { /* ni bistveno */ }

function preveriGeslo() {
    const modal = document.getElementById('vstopno-geslo-modal');
    const input = document.getElementById('input-geslo');
    const btn = document.getElementById('btn-potrdi-geslo');
    const napaka = document.getElementById('geslo-napaka');

    if (!modal) return;

    const Prijava = window.EPVPrijava;
    const vstopi = function (privzeto) {
        modal.style.display = 'none';
        if (napaka) napaka.textContent = "";
        const opozorilo = document.getElementById('geslo-opozorilo');
        if (opozorilo) opozorilo.style.display = privzeto ? '' : 'none';
        naloziVsebinoAplikacije();
    };

    // že prijavljen v tem zavihku: geslo še enkrat preveri strežnik (lahko je bilo medtem zamenjano)
    if (Prijava.geslo()) {
        Prijava.preveri(Prijava.geslo()).then(function (r) {
            if (r.ok || r.omrezje) { vstopi(r.privzeto); return; }
            Prijava.pobrisi();
            modal.style.display = 'flex';
        });
        return;
    }

    modal.style.display = 'flex';

    let preverjam = false;
    function potrdiPrijavo() {
        const vnos = input ? input.value.trim() : "";
        if (!vnos || preverjam) return;
        preverjam = true;
        if (napaka) napaka.textContent = "Preverjam ...";
        Prijava.preveri(vnos).then(function (r) {
            preverjam = false;
            if (r.ok) {
                Prijava.nastavi(vnos);
                vstopi(r.privzeto);
            } else {
                if (napaka) napaka.textContent = r.omrezje ? "Ni povezave s strežnikom - gesla ni mogoče preveriti." : "Napačno geslo! Poskusite znova.";
                if (input && !r.omrezje) { input.value = ""; input.focus(); }
            }
        });
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
