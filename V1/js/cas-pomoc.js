// ==========================================
// EPV - POMOŽNA FUNKCIJA ZA PRIKAZ ČASA (GMT+2)
// ==========================================
// Google Sheets samodejno pretvori čas, ki ga Apps Script zapiše kot GMT+2 niz,
// v pravi datumski tip. Ko ga kasneje preberemo, se serializira nazaj v UTC
// (npr. "2026-08-02T11:16:34.000Z"), zato ga je treba za prikaz spet premakniti
// za 2 uri naprej - enako, kot ga Apps Script izvorno zapiše (Utilities.formatDate(..., "GMT+2", ...)).

export function formatirajCas(cas, kratkoOblika = false) {
    if (!cas) return kratkoOblika ? '' : '-';
    const niz = cas.toString();

    if (niz.includes('T') || /Z$/i.test(niz)) {
        const datum = new Date(niz);
        if (!isNaN(datum.getTime())) {
            const premaknjen = new Date(datum.getTime() + 2 * 60 * 60 * 1000);
            const p = (n) => n.toString().padStart(2, '0');
            const leto = premaknjen.getUTCFullYear();
            const mesec = p(premaknjen.getUTCMonth() + 1);
            const dan = p(premaknjen.getUTCDate());
            const ura = p(premaknjen.getUTCHours());
            const minuta = p(premaknjen.getUTCMinutes());
            const sekunda = p(premaknjen.getUTCSeconds());
            return kratkoOblika ? `${ura}:${minuta}` : `${leto}-${mesec}-${dan} ${ura}:${minuta}:${sekunda}`;
        }
    }

    // Že zapisan kot navaden niz (Sheets ga ni pretvoril v datumski tip) - domnevamo, da je že v GMT+2
    return kratkoOblika && niz.length > 16 ? niz.substring(11, 16) : niz;
}
