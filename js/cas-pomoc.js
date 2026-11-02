// ==========================================
// EPV V2 - ČAS
// Strežnik (Code.gs) zapisuje PRAVI trenutek (UTC, ISO). Tu ga samo prikažemo v časovnem
// pasu Europe/Ljubljana - poletni/zimski čas se tako prilagodi sam, brez fiksnega odmika +2 h.
// ==========================================

const PAS = 'Europe/Ljubljana';
let oblikovalnik = null;
try {
    oblikovalnik = new Intl.DateTimeFormat('en-GB', {
        timeZone: PAS, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    });
} catch (e) { oblikovalnik = null; }

function deli(ms) {
    if (!oblikovalnik) {
        const d = new Date(ms), p = (n) => String(n).padStart(2, '0');
        return { year: d.getFullYear(), month: p(d.getMonth() + 1), day: p(d.getDate()), hour: p(d.getHours()), minute: p(d.getMinutes()), second: p(d.getSeconds()) };
    }
    const o = {};
    oblikovalnik.formatToParts(new Date(ms)).forEach(p => { o[p.type] = p.value; });
    if (o.hour === '24') o.hour = '00';
    return o;
}

/** Čas (ISO niz, Date ali ms) -> milisekunde; NaN, če ni veljaven. */
export function casVMs(cas) {
    if (cas instanceof Date) return cas.getTime();
    if (typeof cas === 'number') return cas;
    const t = Date.parse(cas);
    return isNaN(t) ? NaN : t;
}

export function formatirajCas(cas, kratkoOblika = false) {
    if (!cas) return kratkoOblika ? '' : '-';
    const ms = casVMs(cas);
    if (isNaN(ms)) return String(cas);
    const d = deli(ms);
    return kratkoOblika ? `${d.hour}:${d.minute}` : `${d.year}-${d.month}-${d.day} ${d.hour}:${d.minute}:${d.second}`;
}

/** "pred 12 s", "pred 3 min", "pred 1 h 05 min" */
export function starostBesedilo(ms, zdaj = Date.now()) {
    if (!ms || isNaN(ms)) return '';
    const s = Math.max(0, Math.round((zdaj - ms) / 1000));
    if (s < 60) return `pred ${s} s`;
    const min = Math.floor(s / 60);
    if (min < 60) return `pred ${min} min`;
    return `pred ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}
