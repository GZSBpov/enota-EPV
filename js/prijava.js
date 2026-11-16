// ==========================================
// EPV - PRIJAVA (geslo aplikacije)
// Navadna skripta: window.EPVPrijava. Uporabljata jo štab (mapeEPV.html) in taktična tabla (nacrtEPV.html).
// Gesla NI v kodi: uporabnik ga vpiše, preveri ga strežnik (Apps Script), v brskalniku ostane samo do zaprtja
// zavihka (sessionStorage). Terenska aplikacija gesla ne uporablja - teren dela z žetonom dogodka iz QR kode.
// ==========================================
(function (global) {
    'use strict';
    const KLJUC = 'epv2_geslo';

    function geslo() {
        try { return sessionStorage.getItem(KLJUC) || ''; } catch (e) { return ''; }
    }
    function nastavi(g) {
        try { sessionStorage.setItem(KLJUC, g); } catch (e) { /* brez pomnilnika: geslo velja do osvežitve */ }
    }
    function pobrisi() {
        try { sessionStorage.removeItem(KLJUC); } catch (e) { /* ni pomnilnika */ }
    }

    function klic(parametri) {
        const niz = Object.keys(parametri).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(String(parametri[k])); }).join('&');
        const kontrola = new AbortController();
        const casovnik = setTimeout(function () { kontrola.abort(); }, 15000);
        return fetch(global.GOOGLE_APPS_SCRIPT_URL + '?' + niz, { cache: 'no-store', signal: kontrola.signal })
            .then(function (r) { return r.ok ? r.json() : { status: 'error', omrezje: true }; })
            .catch(function () { return { status: 'error', omrezje: true }; })
            .finally(function () { clearTimeout(casovnik); });
    }

    /**
     * Preveri geslo na strežniku. Vrne { ok, omrezje, privzeto }.
     * privzeto = na strežniku še velja staro, javno znano geslo (treba ga je zamenjati).
     */
    function preveri(g) {
        if (!g) return Promise.resolve({ ok: false });
        return klic({ akcija: 'preveriGeslo', geslo: g }).then(function (o) {
            if (o.omrezje) return { ok: false, omrezje: true };
            if (o.status === 'success') return { ok: true, privzeto: !!o.privzetoGeslo };
            // starejša skripta akcije "preveriGeslo" ne pozna, geslo pa je pravilno
            if (/Neznana akcija/i.test(o.message || '')) return { ok: true, privzeto: true, stariStreznik: true };
            return { ok: false };
        });
    }

    /** Zamenja geslo na strežniku. Vrne { ok, sporocilo }. */
    function zamenjaj(staro, novo) {
        return klic({ akcija: 'zamenjajGeslo', geslo: staro, novoGeslo: novo }).then(function (o) {
            if (o.omrezje) return { ok: false, sporocilo: 'Ni povezave s strežnikom.' };
            if (o.status === 'success') { nastavi(novo); return { ok: true }; }
            return { ok: false, sporocilo: /Neznana akcija/i.test(o.message || '') ? 'Strežniška skripta še ni posodobljena (glej README).' : (o.message || 'Zamenjava ni uspela.') };
        });
    }

    global.EPVPrijava = { geslo: geslo, nastavi: nastavi, pobrisi: pobrisi, preveri: preveri, zamenjaj: zamenjaj };
})(window);
