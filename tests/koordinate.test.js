// Samodejni testi za js/koordinate.js  (zagon: node tests/koordinate.test.js)
const K = require('../js/koordinate.js');
let ok = 0, fail = 0;
function pri(ime, pogoj, podrobnost) {
    if (pogoj) { ok++; } else { fail++; console.log('NAPAKA:', ime, podrobnost !== undefined ? JSON.stringify(podrobnost) : ''); }
}
const blizu = (a, b, tol) => Math.abs(a - b) <= tol;

// --- 1) Neodvisna kontrola transverzalnega Mercatorja (Snyder), toleranca 5 mm ---
function snyder(latD, lonD, lon0D, k0, E0, N0) {
    const a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
    const p = latD * Math.PI / 180, l = (lonD - lon0D) * Math.PI / 180;
    const N = a / Math.sqrt(1 - e2 * Math.sin(p) ** 2), T = Math.tan(p) ** 2, C = ep2 * Math.cos(p) ** 2, A = l * Math.cos(p);
    const e4 = e2 * e2, e6 = e4 * e2;
    const M = a * ((1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * p - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * p) + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * p) - (35 * e6 / 3072) * Math.sin(6 * p));
    const x = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120);
    const y = k0 * (M + N * Math.tan(p) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
    return { E: E0 + x, N: N0 + y };
}
for (const [lat, lon] of [[46.3934, 15.5746], [46.0569, 14.5058], [45.5, 13.7], [46.85, 16.1], [46.6, 15.0], [45.9, 14.9], [46.2, 16.5]]) {
    const mi = K.d96Naprej(lat, lon), ref = snyder(lat, lon, 15, 0.9999, 500000, -5000000);
    pri('D96 naprej ' + lat + ',' + lon, blizu(mi.E, ref.E, 0.005) && blizu(mi.N, ref.N, 0.005), { mi, ref });
    const nazaj = K.d96Nazaj(mi.E, mi.N);
    pri('D96 krog ' + lat + ',' + lon, blizu(nazaj.lat, lat, 1e-9) && blizu(nazaj.lon, lon, 1e-9), nazaj);
    const u = K.utmNaprej(lat, lon, 33), ru = snyder(lat, lon, 15, 0.9996, 500000, 0);
    pri('UTM naprej ' + lat + ',' + lon, blizu(u.E, ru.E, 0.005) && blizu(u.N, ru.N, 0.005), { u, ru });
    const un = K.utmNazaj(u.E, u.N, 33);
    pri('UTM krog', blizu(un.lat, lat, 1e-9) && blizu(un.lon, lon, 1e-9), un);
}
// Znana točka: srednji meridian 15° E: E mora biti natančno 500000
pri('srednji meridian', blizu(K.d96Naprej(46, 15).E, 500000, 1e-6));
// Ljubljana (Trg republike ~46.0511 N, 14.5031 E) približno E 462 xxx, N 101 xxx
{ const lj = K.d96Naprej(46.0511, 14.5031); pri('Ljubljana ~ D96', lj.E > 461000 && lj.E < 463500 && lj.N > 100000 && lj.N < 102500, lj); }

// --- 2) Razčlenjevanje ---
const P = (vnos) => K.razcleni(vnos);
function jeTocka(ime, vnos, lat, lon, tol) {
    const r = P(vnos);
    pri(ime, r.ok && blizu(r.lat, lat, tol || 1e-4) && blizu(r.lon, lon, tol || 1e-4), r);
    return r;
}
const L = 46.3934, O = 15.5746;
jeTocka('decimalno z vejico in presledkom', '46.3934, 15.5746', L, O);
jeTocka('decimalno presledek', '46.3934 15.5746', L, O);
jeTocka('decimalno brez presledka', '46.3934,15.5746', L, O);
jeTocka('decimalna vejica', '46,3934 15,5746', L, O);
jeTocka('decimalna vejica podpičje', '46,3934; 15,5746', L, O);
jeTocka('decimalna vejica + vejica', '46,3934, 15,5746', L, O);
jeTocka('N/E predpona', 'N46.3934 E15.5746', L, O);
jeTocka('N/E pripona', '46.3934N 15.5746E', L, O);
jeTocka('N/E s stopinjami', '46.3934° N, 15.5746° E', L, O);
jeTocka('lat/lon besede', 'lat: 46.3934 lon: 15.5746', L, O);
jeTocka('zamenjan vrstni red', '15.5746, 46.3934', L, O);
jeTocka('DMS znaki', '46°23\'36.2"N 15°34\'28.6"E', 46 + 23 / 60 + 36.2 / 3600, 15 + 34 / 60 + 28.6 / 3600);
jeTocka('DMS tipografski znaki', '46°23′36.2″N 15°34′28.6″E', 46 + 23 / 60 + 36.2 / 3600, 15 + 34 / 60 + 28.6 / 3600);
jeTocka('DMS presledki', '46 23 36.2 N 15 34 28.6 E', 46 + 23 / 60 + 36.2 / 3600, 15 + 34 / 60 + 28.6 / 3600);
jeTocka('DMS brez črk', '46 23 36.2 15 34 28.6', 46 + 23 / 60 + 36.2 / 3600, 15 + 34 / 60 + 28.6 / 3600);
jeTocka('DMS sekunde z vejico', '46°23\'36,2"N 15°34\'28,6"E', 46 + 23 / 60 + 36.2 / 3600, 15 + 34 / 60 + 28.6 / 3600);
jeTocka('DMS dva apostrofa', "46°23'36.2''N 15°34'28.6''E", 46 + 23 / 60 + 36.2 / 3600, 15 + 34 / 60 + 28.6 / 3600);
jeTocka('DM', "46°23.604'N 15°34.476'E", 46 + 23.604 / 60, 15 + 34.476 / 60);
jeTocka('DM brez črk', '46 23.604 15 34.476', 46 + 23.604 / 60, 15 + 34.476 / 60);
jeTocka('slovenski S=sever, V=vzhod', "46°23'36\" S 15°34'28\" V", 46 + 23 / 60 + 36 / 3600, 15 + 34 / 60 + 28 / 3600);
{ const r = P("46°23'36\" S 15°34'28\" V"); pri('opozorilo za S', r.ok && r.opozorila.some(o => /SEVER/.test(o)), r); }
jeTocka('Google Maps @', 'https://www.google.com/maps/@46.3934,15.5746,17z', L, O);
jeTocka('Google Maps q=', 'https://maps.google.com/?q=46.3934,15.5746', L, O);
jeTocka('Google Maps q= kodirano', 'https://maps.google.com/?q=46.3934%2C15.5746', L, O);
jeTocka('Google Maps !3d!4d', 'https://www.google.com/maps/place/x/data=!3d46.3934!4d15.5746', L, O);
jeTocka('geo URI', 'geo:46.3934,15.5746', L, O);
jeTocka('Apple Maps ll=', 'https://maps.apple.com/?ll=46.3934,15.5746&q=Tocka', L, O);
// projicirani
{ const d = K.d96Naprej(L, O);
  jeTocka('D96 E N', 'E ' + d.E.toFixed(0) + ' N ' + d.N.toFixed(0), L, O, 2e-5);
  jeTocka('D96 samo števili', d.E.toFixed(0) + ' ' + d.N.toFixed(0), L, O, 2e-5);
  jeTocka('D96 obratni vrstni red', d.N.toFixed(0) + ', ' + d.E.toFixed(0), L, O, 2e-5);
  jeTocka('D96 z decimalkami', d.E.toFixed(2) + ' ' + d.N.toFixed(2), L, O, 1e-6);
  jeTocka('D96 cona 5 predpona', (d.E + 5000000).toFixed(0) + ' ' + (d.N + 5000000).toFixed(0), L, O, 2e-5);
  const u = K.utmNaprej(L, O, 33);
  jeTocka('UTM', '33T ' + u.E.toFixed(0) + ' ' + u.N.toFixed(0), L, O, 2e-5);
  jeTocka('UTM z E/N', '33T ' + u.E.toFixed(0) + 'E ' + u.N.toFixed(0) + 'N', L, O, 2e-5);
  jeTocka('UTM z besedo', 'UTM 33 T ' + u.E.toFixed(0) + ' ' + u.N.toFixed(0), L, O, 2e-5);
}
// napake
pri('prazen vnos', P('').ok === false);
pri('GK zavrnjen', P('D48 Y 548123 X 143456').ok === false);
pri('tekst brez števil', P('nekje na Rogli').ok === false);
pri('minute >= 60', P("46°75'00\"N 15°34'28\"E").ok === false);
pri('izven Slovenije opozorilo', (() => { const r = P('48.8584, 2.2945'); return r.ok && r.opozorila.some(o => /izven/.test(o)); })());
pri('neveljavni obseg', P('146.5, 215.5').ok === false);
pri('ena sama črka', P('46.3934N 15.5746').ok === false);

// --- 3) Oblikovanje in smer ---
{ const o = K.oblikuj(46.3934, 15.5746);
  pri('oblika dec', o.decimalno === '46.39340, 15.57460', o);
  pri('oblika dms', o.dms === '46°23\'36.2"N 15°34\'28.6"E', o);
  pri('oblika dm', o.dm === "46°23.604'N 15°34.476'E", o);
  pri('oblika utm', /^33T \d+ \d+$/.test(o.utm), o);
  const nazaj = P(o.dms); pri('oblikuj->razcleni dms', nazaj.ok && blizu(nazaj.lat, 46.3934, 3e-5) && blizu(nazaj.lon, 15.5746, 3e-5), nazaj);
  const nazaj2 = P(o.d96); pri('oblikuj->razcleni d96', nazaj2.ok && blizu(nazaj2.lat, 46.3934, 2e-5), nazaj2);
  const nazaj3 = P(o.utm); pri('oblikuj->razcleni utm', nazaj3.ok && blizu(nazaj3.lat, 46.3934, 2e-5), nazaj3);
}
pri('azimut sever', blizu(K.azimut(46, 15, 46.01, 15), 0, 1e-6));
pri('azimut vzhod', blizu(K.azimut(46, 15, 46, 15.01), 90, 0.2));
pri('smer SV', K.smerIme(45) === 'SV');
pri('smer Z', K.smerIme(270) === 'Z');
pri('smer ovitek', K.smerIme(359) === 'S');
pri('razdalja ~1 stopinja širine', blizu(K.razdaljaM(46, 15, 47, 15), 111195, 200), K.razdaljaM(46, 15, 47, 15));
pri('format m', K.oblikujRazdaljo(340) === '340 m');
pri('format km', K.oblikujRazdaljo(2350) === '2,4 km' || K.oblikujRazdaljo(2350) === '2,3 km', K.oblikujRazdaljo(2350));
pri('opis', /^\d+ m [A-Z]+ \(\d+°\)$/.test(K.opisiSmerInRazdaljo(46, 15, 46.003, 15.003)), K.opisiSmerInRazdaljo(46, 15, 46.003, 15.003));

console.log('Koordinate: ' + ok + ' uspešnih, ' + fail + ' napak.');
process.exit(fail ? 1 : 0);
