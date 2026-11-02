// ==========================================
// EPV - DELJENJE PREK WhatsApp / Viber / SMS in besedilo za radijsko zvezo (ZARE)
// Brez računov in ključev: gumb odpre aplikacijo na tej napravi (na računalniku WhatsApp Web ali Viber namizni)
// z že pripravljenim besedilom; izberete osebo ali skupino in pošljete. Pošiljate vi, zato je to
// nadomestek za enote, ki ne uporabljajo EPV aplikacije, ali za vodje na telefonih.
// ==========================================

const K = window.EPVKoordinate;

function escapeHtml(niz) {
    const el = document.createElement('div');
    el.textContent = niz ?? '';
    return el.innerHTML;
}
function escapeAtribut(niz) { return escapeHtml(niz).replace(/"/g, '&quot;'); }

/** Besedilo točke za pošiljanje prek sporočilnika. */
export function besediloTocke(t) {
    const f = K.oblikuj(t.lat, t.lon);
    return [`🎯 ${t.naziv || 'Točka'}`, t.opomba || '', t.polmer ? `Območje negotovosti: ±${Math.round(t.polmer)} m` : '', `WGS84: ${f.decimalno}`, `D96/TM: ${f.d96}`, f.zemljevid]
        .filter(Boolean).join('\n');
}

/** Kratko besedilo za branje po radijski zvezi (ZARE): najprej D96/TM, nato WGS84. */
export function besediloRadio(t) {
    const f = K.oblikuj(t.lat, t.lon);
    const dec = (n) => n.toFixed(5).replace('.', ',');
    return `Točka ${t.naziv || ''}. D96/TM: vzhod ${f.d96.split(' ')[1]}, sever ${f.d96.split(' ')[3]}. WGS84: sever ${dec(t.lat)}, vzhod ${dec(t.lon)}.`.replace(/\s+\./g, '.');
}

/** Besedilo sporočila s terena (npr. SOS) z lokacijo. */
export function besediloSporocila(s, lat, lon, casKratko) {
    const imaLok = isFinite(lat) && isFinite(lon);
    return [`${(s.sporocilo || '').toUpperCase().includes('SOS') ? '🆘 ' : '📣 '}${s.enota ? String(s.enota).split(':')[1] || s.enota : ''}: ${s.sporocilo || ''}`,
        casKratko ? `Ob ${casKratko}` : '', imaLok ? `Lokacija: ${K.oblikuj(lat, lon).decimalno}` : 'Lokacija ni znana', imaLok ? K.oblikuj(lat, lon).zemljevid : '']
        .filter(Boolean).join('\n');
}

export function povezave(besedilo) {
    const e = encodeURIComponent(besedilo);
    return { wa: `https://wa.me/?text=${e}`, viber: `viber://forward?text=${e}`, sms: `sms:?body=${e}` };
}

/** HTML vrstica z gumbi (v pojavnem oknu zemljevida). radio = besedilo za kopiranje, če je podano. */
export function gumbiHtml(besedilo, radio) {
    const p = povezave(besedilo);
    const slog = 'flex:1; text-align:center; color:#fff; padding:4px 2px; border-radius:4px; text-decoration:none; font-weight:bold; font-size:11px; border:none; cursor:pointer;';
    return `
        <div class="deli-vrstica" style="display:flex; gap:4px; margin-top:6px; flex-wrap:wrap;">
            <a class="deli-wa" href="${escapeAtribut(p.wa)}" target="_blank" rel="noopener" style="${slog} background:#25D366;">WhatsApp</a>
            <a class="deli-viber" href="${escapeAtribut(p.viber)}" style="${slog} background:#7360f2;">Viber</a>
            <a class="deli-sms" href="${escapeAtribut(p.sms)}" style="${slog} background:#64748b;">SMS</a>
            ${radio ? `<button type="button" class="deli-radio" data-kopiraj="${escapeAtribut(radio)}" style="${slog} background:#0e7490;" title="Kopira kratko besedilo za branje po radijski zvezi">📋 Za radio</button>` : ''}
        </div>`;
}

/** Pripne kopiranje v odložišče na gumbe z atributom data-kopiraj znotraj danega vozlišča. */
export function pripniKopiranje(vozlisce) {
    if (!vozlisce) return;
    vozlisce.querySelectorAll('[data-kopiraj]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const izvirno = btn.dataset.izvirno || btn.textContent;
            btn.dataset.izvirno = izvirno;
            try {
                await navigator.clipboard.writeText(btn.dataset.kopiraj);
                btn.textContent = '✔ Kopirano';
            } catch (e) {
                window.prompt('Kopiraj besedilo (Ctrl+C):', btn.dataset.kopiraj);
            }
            setTimeout(() => { btn.textContent = izvirno; }, 2000);
        });
    });
}
