// ==========================================
// EPV - MODUL ZA SPOROČILA S TERENA (SOS, najdena oseba/žival, ...)
// ==========================================

import { GOOGLE_APPS_SCRIPT_URL } from './config.js';

function escapeHtml(niz) {
    const el = document.createElement('div');
    el.textContent = niz ?? '';
    return el.innerHTML;
}

function izrisiSporocila(sporocila) {
    const kontejner = document.getElementById('seznamSporocil');
    const panel = document.getElementById('sporocila-panel');
    if (!kontejner) return;

    if (!sporocila || sporocila.length === 0) {
        kontejner.innerHTML = '<div style="font-size:0.8rem; color:#64748b; padding:8px;">Ni sporočil.</div>';
        if (panel) panel.classList.remove('ima-sos');
        return;
    }

    // Varovalka: če strežnik (še) ne pozna akcije pridobiSporocila, vrne privzeto obliko
    // (surov seznam lokacij - polja, ne objekti). Take neujemajoče vnose tiho izpustimo,
    // namesto da izrišemo prazne vrstice.
    const veljavna = sporocila.filter(s => s && !Array.isArray(s) && s.sporocilo);

    if (veljavna.length === 0) {
        kontejner.innerHTML = '<div style="font-size:0.8rem; color:#64748b; padding:8px;">Ni sporočil.</div>';
        if (panel) panel.classList.remove('ima-sos');
        return;
    }

    let imaSOS = false;

    kontejner.innerHTML = veljavna.slice(0, 20).map(s => {
        const jeSOS = (s.sporocilo || '').toString().toUpperCase().includes('SOS');
        if (jeSOS) imaSOS = true;
        const cas = (s.cas || '').toString();
        const kratekCas = cas.length > 16 ? cas.substring(11, 16) : cas;

        return `
            <div class="sporocilo-vrstica${jeSOS ? ' sos' : ''}">
                <div class="sporocilo-glava">
                    <span>${jeSOS ? '🆘 ' : ''}${escapeHtml(s.enota)}</span>
                    <span class="sporocilo-cas">${escapeHtml(kratekCas)}</span>
                </div>
                <div class="sporocilo-besedilo">${escapeHtml(s.sporocilo)}</div>
            </div>
        `;
    }).join('');

    if (panel) panel.classList.toggle('ima-sos', imaSOS);
}

export async function naloziSporocila() {
    const kontejner = document.getElementById('seznamSporocil');
    if (!kontejner) return;

    const aktivniDogodekId = document.getElementById('select-dogodek')?.value || '';

    try {
        const res = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?akcija=pridobiSporocila&dogodek=${encodeURIComponent(aktivniDogodekId)}&geslo=EPV2026`, { cache: 'no-store' });
        if (!res.ok) return;
        const odgovor = await res.json();
        if (odgovor.status !== 'success' || !Array.isArray(odgovor.data)) return;
        izrisiSporocila(odgovor.data);
    } catch (err) {
        console.error('Napaka pri nalaganju sporočil s terena:', err);
    }
}
