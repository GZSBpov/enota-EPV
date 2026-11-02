// ==========================================
// EPV V2 - KOORDINATE: razčlenjevanje različnih zapisov + pretvorbe + razdalja/smer
// Navadna (ne-modul) skripta: window.EPVKoordinate (uporabljata jo mapeEPV_V2 in terenEPV_V2).
// Deluje tudi v Node (module.exports) - za samodejne teste.
//
// Podprti zapisi (WGS84):
//   46.3934, 15.5746        46.3934 15.5746        46,3934; 15,5746 (decimalna vejica)
//   N46.3934 E15.5746       46.3934N 15.5746E      46.3934° N, 15.5746° E
//   46°23'36.2"N 15°34'28.6"E        46 23 36.2 N 15 34 28.6 E       (stopinje, minute, sekunde)
//   46°23.604'N 15°34.476'E          (stopinje, decimalne minute)
//   zamenjan vrstni red (lon, lat) se prepozna po legi (Slovenija) in javi
// Projicirani sistemi:
//   UTM:   33T 548123 5143456
//   D96/TM (Slovenija, EPSG:3794):   E 548123 N 143456   ali   548123 143456   (tudi X/Y: Y=vzhod, X=sever)
// Povezave: Google Maps (@lat,lon | ?q=lat,lon | !3d..!4d..), Apple Maps (ll=), geo:lat,lon
// NI podprto: D48/GK (staro Gauss-Krügerjevo) - ga ne pretvarjamo, javimo napako.
// ==========================================
(function (global) {
    'use strict';

    const RAD = Math.PI / 180;
    const DEG = 180 / Math.PI;

    // ---------- Transverzalni Mercator (Krügerjeva vrsta, natančnost < 1 mm) ----------
    const A_ELIPSOID = 6378137;
    const F_ELIPSOID = 1 / 298.257223563; // WGS84 (GRS80 se razlikuje < 0,1 mm - zanemarljivo)
    const K = (function () {
        const n = F_ELIPSOID / (2 - F_ELIPSOID);
        const n2 = n * n, n3 = n2 * n, n4 = n3 * n;
        return {
            n: n,
            A: A_ELIPSOID / (1 + n) * (1 + n2 / 4 + n4 / 64),
            alpha: [
                n / 2 - 2 * n2 / 3 + 5 * n3 / 16 + 41 * n4 / 180,
                13 * n2 / 48 - 3 * n3 / 5 + 557 * n4 / 1440,
                61 * n3 / 240 - 103 * n4 / 140,
                49561 * n4 / 161280
            ],
            beta: [
                n / 2 - 2 * n2 / 3 + 37 * n3 / 96 - n4 / 360,
                n2 / 48 + n3 / 15 - 437 * n4 / 1440,
                17 * n3 / 480 - 37 * n4 / 840,
                4397 * n4 / 161280
            ],
            delta: [
                2 * n - 2 * n2 / 3 - 2 * n3 + 116 * n4 / 45,
                7 * n2 / 3 - 8 * n3 / 5 - 227 * n4 / 45,
                56 * n3 / 15 - 136 * n4 / 35,
                4279 * n4 / 630
            ]
        };
    })();

    /** (lat, lon) v stopinjah -> {E, N} v metrih za dani transverzalni Mercator. */
    function tmNaprej(lat, lon, lon0, k0, E0, N0) {
        const n = K.n;
        const phi = lat * RAD;
        const dl = (lon - lon0) * RAD;
        const c = 2 * Math.sqrt(n) / (1 + n);
        const t = Math.sinh(Math.atanh(Math.sin(phi)) - c * Math.atanh(c * Math.sin(phi)));
        const xiP = Math.atan2(t, Math.cos(dl));
        const etaP = Math.asinh(Math.sin(dl) / Math.sqrt(t * t + Math.cos(dl) * Math.cos(dl)));
        let xi = xiP, eta = etaP;
        for (let j = 1; j <= 4; j++) {
            xi += K.alpha[j - 1] * Math.sin(2 * j * xiP) * Math.cosh(2 * j * etaP);
            eta += K.alpha[j - 1] * Math.cos(2 * j * xiP) * Math.sinh(2 * j * etaP);
        }
        return { E: E0 + k0 * K.A * eta, N: N0 + k0 * K.A * xi };
    }

    /** {E, N} v metrih -> {lat, lon} v stopinjah. */
    function tmNazaj(E, N, lon0, k0, E0, N0) {
        const xi = (N - N0) / (k0 * K.A);
        const eta = (E - E0) / (k0 * K.A);
        let xiP = xi, etaP = eta;
        for (let j = 1; j <= 4; j++) {
            xiP -= K.beta[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
            etaP -= K.beta[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
        }
        const chi = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
        let phi = chi;
        for (let j = 1; j <= 4; j++) phi += K.delta[j - 1] * Math.sin(2 * j * chi);
        const lam = Math.atan2(Math.sinh(etaP), Math.cos(xiP));
        return { lat: phi * DEG, lon: lon0 + lam * DEG };
    }

    // D96/TM (EPSG:3794): srednji meridian 15° E, k0 0,9999, E0 500000, N0 -5000000
    function d96Naprej(lat, lon) { return tmNaprej(lat, lon, 15, 0.9999, 500000, -5000000); }
    function d96Nazaj(E, N) { return tmNazaj(E, N, 15, 0.9999, 500000, -5000000); }

    // UTM (severna polobla): k0 0,9996, E0 500000, N0 0
    function cona(lon) { return Math.floor((lon + 180) / 6) + 1; }
    function utmNaprej(lat, lon, c) {
        c = c || cona(lon);
        return Object.assign({ cona: c }, tmNaprej(lat, lon, c * 6 - 183, 0.9996, 500000, 0));
    }
    function utmNazaj(E, N, c) { return tmNazaj(E, N, c * 6 - 183, 0.9996, 500000, 0); }
    function utmPas(lat) {
        const crke = 'CDEFGHJKLMNPQRSTUVWX';
        if (lat < -80 || lat > 84) return '';
        return crke.charAt(Math.min(19, Math.floor((lat + 80) / 8)));
    }

    // ---------- Geografske pomožne funkcije ----------
    function razdaljaM(lat1, lon1, lat2, lon2) {
        const R = 6371008.8;
        const dLat = (lat2 - lat1) * RAD, dLon = (lon2 - lon1) * RAD;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    /** Začetni azimut (0-360°, 0 = sever, 90 = vzhod) od točke 1 proti točki 2. */
    function azimut(lat1, lon1, lat2, lon2) {
        const y = Math.sin((lon2 - lon1) * RAD) * Math.cos(lat2 * RAD);
        const x = Math.cos(lat1 * RAD) * Math.sin(lat2 * RAD) - Math.sin(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.cos((lon2 - lon1) * RAD);
        return (Math.atan2(y, x) * DEG + 360) % 360;
    }

    const SMERI = ['S', 'SSV', 'SV', 'VSV', 'V', 'VJV', 'JV', 'JJV', 'J', 'JJZ', 'JZ', 'ZJZ', 'Z', 'ZSZ', 'SZ', 'SSZ'];
    function smerIme(stopinje) {
        return SMERI[Math.round((((stopinje % 360) + 360) % 360) / 22.5) % 16];
    }

    function oblikujRazdaljo(m) {
        if (m == null || isNaN(m)) return '';
        return m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 0 : 1).replace('.', ',') + ' km' : Math.round(m) + ' m';
    }

    /** "340 m SV (azimut 52°)" od (lat1,lon1) proti (lat2,lon2). */
    function opisiSmerInRazdaljo(lat1, lon1, lat2, lon2) {
        const d = razdaljaM(lat1, lon1, lat2, lon2);
        const az = azimut(lat1, lon1, lat2, lon2);
        return oblikujRazdaljo(d) + ' ' + smerIme(az) + ' (' + Math.round(az) + '°)';
    }

    // ---------- Oblikovanje ----------
    function dms(vred, crkaPlus, crkaMinus) {
        const abs = Math.abs(vred);
        let skupaj = Math.round(abs * 3600 * 10) / 10; // sekunde na 0,1"
        let d = Math.floor(skupaj / 3600);
        let m = Math.floor((skupaj - d * 3600) / 60);
        let s = Math.round((skupaj - d * 3600 - m * 60) * 10) / 10;
        if (s >= 60) { s = 0; m += 1; }
        if (m >= 60) { m = 0; d += 1; }
        return d + '°' + String(m).padStart(2, '0') + "'" + s.toFixed(1).padStart(4, '0') + '"' + (vred >= 0 ? crkaPlus : crkaMinus);
    }

    function dm(vred, crkaPlus, crkaMinus) {
        const abs = Math.abs(vred);
        let d = Math.floor(abs);
        let m = Math.round((abs - d) * 60 * 1000) / 1000;
        if (m >= 60) { m = 0; d += 1; }
        return d + '°' + m.toFixed(3).padStart(6, '0') + "'" + (vred >= 0 ? crkaPlus : crkaMinus);
    }

    /** Vrne točko v več zapisih - za prikaz, branje po radijski zvezi in kopiranje. */
    function oblikuj(lat, lon) {
        const d96 = d96Naprej(lat, lon);
        const utm = utmNaprej(lat, lon);
        return {
            decimalno: lat.toFixed(5) + ', ' + lon.toFixed(5),
            dms: dms(lat, 'N', 'S') + ' ' + dms(lon, 'E', 'W'),
            dm: dm(lat, 'N', 'S') + ' ' + dm(lon, 'E', 'W'),
            d96: 'E ' + Math.round(d96.E) + ' N ' + Math.round(d96.N),
            utm: utm.cona + utmPas(lat) + ' ' + Math.round(utm.E) + ' ' + Math.round(utm.N),
            zemljevid: 'https://www.google.com/maps?q=' + lat.toFixed(6) + ',' + lon.toFixed(6)
        };
    }

    // ---------- Razčlenjevanje ----------
    const REGIJA = { latMin: 43, latMax: 49, lonMin: 12, lonMax: 18 }; // Slovenija z okolico
    function vRegiji(lat, lon) {
        return lat >= REGIJA.latMin && lat <= REGIJA.latMax && lon >= REGIJA.lonMin && lon <= REGIJA.lonMax;
    }
    function veljavenSvet(lat, lon) {
        return isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    }

    function normaliziraj(s) {
        return String(s == null ? '' : s)
            .replace(/[   ]/g, ' ')
            .replace(/[′’‘`´ʹ]/g, "'")
            .replace(/[″”“ʺ]/g, '"')
            .replace(/[˚º]/g, '°')
            .replace(/''/g, '"')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function st(niz) { return parseFloat(String(niz).replace(',', '.')); }

    function izUrl(d) {
        let dec = d;
        try { dec = decodeURIComponent(d); } catch (e) { /* pusti nedekodirano */ }
        let m;
        if ((m = dec.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/))) return [st(m[1]), st(m[2])];
        if ((m = dec.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/))) return [st(m[1]), st(m[2])];
        if ((m = dec.match(/[?&](?:q|ll|query|center|destination|daddr|sll)=\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/i))) return [st(m[1]), st(m[2])];
        if ((m = dec.match(/geo:\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i))) return [st(m[1]), st(m[2])];
        return null;
    }

    /** Sestavi vrednost stopinj iz skupine števil (1 = stopinje, 2 = st + min, 3 = st + min + sek). */
    function vrednostSkupine(stevila, predznak) {
        if (stevila.length < 1 || stevila.length > 3) return { napaka: 'Napačno število delov koordinate.' };
        for (let i = 0; i < stevila.length - 1; i++) {
            if (stevila[i] % 1 !== 0) return { napaka: 'Decimalni zapis je dovoljen samo pri zadnji enoti (stopinje, minute ali sekunde).' };
        }
        const d = stevila[0], m = stevila[1] || 0, s = stevila[2] || 0;
        if (stevila.length >= 2 && m >= 60) return { napaka: 'Minute morajo biti manj kot 60.' };
        if (stevila.length === 3 && s >= 60) return { napaka: 'Sekunde morajo biti manj kot 60.' };
        return { vred: predznak * (d + m / 60 + s / 3600) };
    }

    function razcleniGeografsko(s0) {
        let s = s0.replace(/\b(?:latitude|longitude|lat|lon|lng|long|koordinate|koordinata|gps|wgs\s*-?\s*84)\b/gi, ' ')
            .replace(/[:=;()\[\]]/g, ' ')
            .replace(/\s+/g, ' ').trim();

        // decimalna vejica brez pik: "46,3934 15,5746" / "46,3934; 15,5746" / "46,3934, 15,5746"
        const imaPiko = s.indexOf('.') >= 0;
        const reSt = imaPiko ? '\\d+(?:\\.\\d+)?' : '\\d+(?:,\\d+)?';
        const re = new RegExp('(-?)(' + reSt + ')|([NSEWVZJnsewvzj])(?![A-Za-zčšžČŠŽ])|([°\'"])', 'g');
        const zet = [];
        let m;
        while ((m = re.exec(s)) !== null) {
            if (m[2] !== undefined) zet.push({ t: 'st', v: st(m[2]), neg: m[1] === '-' });
            else if (m[3] !== undefined) zet.push({ t: 'cr', c: m[3].toUpperCase() });
            // simboli (°, ', ") le ločujejo - vrstni red števil je dovolj
        }
        if (zet.filter(x => x.t === 'st').length === 0) return { napaka: 'V vnosu ni najdenih števil.' };

        const crke = zet.filter(x => x.t === 'cr');
        let g1, g2;
        if (crke.length === 2) {
            if (zet[0].t === 'cr') { // predpona: N 46 23 E 15 34
                const i2 = zet.findIndex((x, i) => i > 0 && x.t === 'cr');
                g1 = zet.slice(0, i2); g2 = zet.slice(i2);
            } else { // pripona: 46 23 N 15 34 E
                const i1 = zet.findIndex(x => x.t === 'cr');
                g1 = zet.slice(0, i1 + 1); g2 = zet.slice(i1 + 1);
            }
        } else if (crke.length === 0) {
            const n = zet.length;
            if (n === 2) { g1 = [zet[0]]; g2 = [zet[1]]; }
            else if (n === 4) { g1 = zet.slice(0, 2); g2 = zet.slice(2); }
            else if (n === 6) { g1 = zet.slice(0, 3); g2 = zet.slice(3); }
            else return { napaka: 'Ne prepoznam zapisa (pričakujem 2, 4 ali 6 števil, ali števila s črkama N/E).' };
        } else {
            return { napaka: 'Pričakujem obe smeri neba (npr. N in E) ali nobene.' };
        }

        const obdelaj = function (g) {
            const stevila = g.filter(x => x.t === 'st');
            const crka = (g.find(x => x.t === 'cr') || {}).c || null;
            const neg = stevila.length > 0 && stevila[0].neg;
            const vred = vrednostSkupine(stevila.map(x => x.v), neg ? -1 : 1);
            if (vred.napaka) return { napaka: vred.napaka };
            return { vred: vred.vred, crka: crka };
        };
        const a = obdelaj(g1), b = obdelaj(g2);
        if (a.napaka) return { napaka: a.napaka };
        if (b.napaka) return { napaka: b.napaka };

        const opozorila = [];
        let lat, lon;
        const jeLatCrka = c => c === 'N' || c === 'S' || c === 'J';
        const jeLonCrka = c => c === 'E' || c === 'W' || c === 'V' || c === 'Z';

        if (a.crka || b.crka) {
            let la, lo;
            if (jeLatCrka(a.crka) && jeLonCrka(b.crka)) { la = a; lo = b; }
            else if (jeLonCrka(a.crka) && jeLatCrka(b.crka)) { la = b; lo = a; }
            else return { napaka: 'Črki morata biti ena za širino (N/S) in ena za dolžino (E/W).' };

            lat = Math.abs(la.vred);
            lon = Math.abs(lo.vred);
            if (la.crka === 'J') lat = -lat;
            if (lo.crka === 'W' || lo.crka === 'Z') lon = -lon;
            if (la.crka === 'S') {
                // "S" je v angleščini jug, v slovenščini pa sever. Aplikacija je za Slovenijo, zato
                // vzamemo sever, razen če bi bila točka tako izven območja, jug pa ne.
                if (vRegiji(lat, lon) || !vRegiji(-lat, lon)) {
                    opozorila.push('Črka S je razumljena kot SEVER (slovenski zapis). Če so koordinate angleške (S = jug), jih preveri.');
                } else {
                    lat = -lat;
                }
            }
            if (la.vred < 0 && la.crka !== 'J') lat = -lat;
            if (lo.vred < 0) lon = -lon;
        } else {
            lat = a.vred; lon = b.vred;
            if (!(vRegiji(lat, lon)) && vRegiji(lon, lat)) {
                const t = lat; lat = lon; lon = t;
                opozorila.push('Vrstni red je bil zamenjan (prepoznano kot dolžina, širina).');
            }
        }

        if (!veljavenSvet(lat, lon)) return { napaka: 'Koordinate so izven veljavnega obsega.' };
        const stevilo = zet.filter(x => x.t === 'st').length;
        const oblika = (stevilo === 2 || (crke.length === 2 && g1.filter(x => x.t === 'st').length === 1 && g2.filter(x => x.t === 'st').length === 1))
            ? 'WGS84 - decimalne stopinje'
            : (stevilo === 4 || (crke.length === 2 && g1.filter(x => x.t === 'st').length === 2))
                ? 'WGS84 - stopinje in decimalne minute'
                : 'WGS84 - stopinje, minute, sekunde';
        return { lat: lat, lon: lon, format: oblika, opozorila: opozorila };
    }

    /**
     * Glavna funkcija: razčleni poljuben vnos.
     * Vrne { ok:true, lat, lon, format, opozorila:[...] } ali { ok:false, napaka:'...' }
     */
    function razcleni(vnos) {
        const s = normaliziraj(vnos);
        if (!s) return { ok: false, napaka: 'Vnesi koordinate.' };

        const sestavi = function (lat, lon, format, opozorila) {
            opozorila = opozorila || [];
            if (!veljavenSvet(lat, lon)) return { ok: false, napaka: 'Koordinate so izven veljavnega obsega.' };
            if (!vRegiji(lat, lon)) opozorila.push('Točka je izven Slovenije in bližnje okolice - preveri zapis.');
            return { ok: true, lat: lat, lon: lon, format: format, opozorila: opozorila };
        };

        // 1) povezave zemljevidov
        if (/https?:|maps|geo:|[?&]ll=/i.test(s)) {
            const r = izUrl(s);
            if (r) return sestavi(r[0], r[1], 'Povezava zemljevida', []);
        }

        // 2) staro Gauss-Krügerjevo (D48) - ne podpiramo
        if (/\b(?:D48|MGI|GK|Gauss|Gau[sß]|Kr[uü]ger|EPSG\s*:?\s*3912)\b/i.test(s)) {
            return { ok: false, napaka: 'Stari sistem D48/GK ni podprt (pretvorba bi bila netočna). Uporabi WGS84 ali D96/TM.' };
        }

        // 3) UTM: "33T 548123 5143456", "33 T 548123E 5143456N"
        const mu = s.match(/^(?:UTM\s*)?(\d{1,2})\s*([C-HJ-NP-X])\s+(\d{5,7})(?:[.,]\d+)?\s*(?:m?\s*E)?\s*[\s,;]\s*(\d{6,8})(?:[.,]\d+)?\s*(?:m?\s*N)?$/i);
        if (mu) {
            const c = parseInt(mu[1], 10), pas = mu[2].toUpperCase();
            if (c < 1 || c > 60) return { ok: false, napaka: 'Neveljavna UTM cona.' };
            if (pas < 'N') return { ok: false, napaka: 'Južna polobla (UTM pas ' + pas + ') ni podprta.' };
            const r = utmNazaj(parseFloat(mu[3]), parseFloat(mu[4]), c);
            const op = [];
            if (c !== 33) op.push('UTM cona ' + c + ' ni cona Slovenije (33) - preveri zapis.');
            return sestavi(r.lat, r.lon, 'UTM cona ' + c + pas, op);
        }

        // 4) D96/TM (Slovenija): dve velika števila, E 350000-650000 in N 0-300000, v poljubnem vrstnem redu
        const velika = (s.match(/\d+(?:[.,]\d+)?/g) || []).map(st);
        const jeVelikSist = velika.length === 2 && velika.every(v => v >= 10000);
        if (jeVelikSist) {
            const norm = v => (v >= 5000000 && v < 6000000) ? v - 5000000 : v; // zapis s ceno številko cone (5 xxx xxx)
            const x1 = norm(velika[0]), x2 = norm(velika[1]);
            const jeE = v => v >= 300000 && v <= 700000;
            const jeN = v => v >= 0 && v <= 300000;
            let E = null, N = null;
            if (jeE(x1) && jeN(x2)) { E = x1; N = x2; }
            else if (jeE(x2) && jeN(x1)) { E = x2; N = x1; }
            if (E !== null) {
                const r = d96Nazaj(E, N);
                return sestavi(r.lat, r.lon, 'D96/TM (Slovenija)', ['Predpostavljen sistem D96/TM (EPSG:3794). Če so koordinate v starem D48/GK, bodo točke premaknjene.']);
            }
            return { ok: false, napaka: 'Dve veliki števili nista v območju D96/TM (E 300000-700000, N 0-300000).' };
        }

        // 5) geografske koordinate
        const g = razcleniGeografsko(s);
        if (g.napaka) return { ok: false, napaka: g.napaka };
        return sestavi(g.lat, g.lon, g.format, g.opozorila);
    }

    const API = {
        razcleni: razcleni,
        oblikuj: oblikuj,
        razdaljaM: razdaljaM,
        azimut: azimut,
        smerIme: smerIme,
        oblikujRazdaljo: oblikujRazdaljo,
        opisiSmerInRazdaljo: opisiSmerInRazdaljo,
        vRegiji: vRegiji,
        d96Naprej: d96Naprej,
        d96Nazaj: d96Nazaj,
        utmNaprej: utmNaprej,
        utmNazaj: utmNazaj,
        tmNaprej: tmNaprej,
        tmNazaj: tmNazaj
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    global.EPVKoordinate = API;
})(typeof window !== 'undefined' ? window : globalThis);
