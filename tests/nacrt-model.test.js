// Testi modela načrta (zagon: node tests/nacrt-model.test.js)
const M = require('../js/nacrt-model.js');
let ok = 0, fail = 0;
function pri(ime, pogoj, p) { if (pogoj) ok++; else { fail++; console.log('NAPAKA:', ime, p !== undefined ? JSON.stringify(p) : ''); } }

const n = M.novNacrt('Vaja Impol', { lat: 46.39, lon: 15.57, z: 16 });
pri('nov načrt ima tri skice', n.skice.map(s => s.naziv).join() === 'Lokacija,Evakuacija,Posredovanje');
pri('privzeti elaborat ima vsa polja', M.ELABORAT_POLJA.every(p => typeof n.elaborat[p.k] === 'string'));
pri('vsi zahtevani tipi vozil', ['PV-1', 'GVC-1', 'GVC-2', 'GVC-3', 'GV-1', 'GVV-1', 'GVM', 'ALK32', 'ZD28', 'OVVO', 'HTRV-1', 'GVGP-1', 'VGV', 'GTVD', 'UAV', 'GČ', 'GP'].every(t => M.TIPI_VOZIL.some(v => v.tip === t)));
pri('službe', ['gasilci', 'cz', 'policija', 'resevalci', 'vojska', 'drugo'].every(k => M.SLUZBE[k]));
pri('barve služb', M.SLUZBE.resevalci.barva === '#facc15' && M.SLUZBE.policija.barva === '#ffffff' && M.SLUZBE.drugo.barva === '#ec4899');

const s = n.skice[2];
pri('prva številka je 1', M.naslednjaStevilka(s) === 1);
s.elementi.push({ id: 'a', vrsta: 'vozilo', tip: 'GVC-1', sluzba: 'gasilci', kratica: 'IMP', st: 1, lat: 46.39, lon: 15.57, kot: 0, opis: 'notranji napad' });
s.elementi.push({ id: 'b', vrsta: 'vozilo', tip: 'ALK32', sluzba: 'gasilci', kratica: 'SLB', st: '5', lat: 46.391, lon: 15.571, kot: 90 });
s.elementi.push({ id: 'c', vrsta: 'znak', znak: 'pm', lat: 46.39, lon: 15.57 });
pri('naslednja številka po 5 je 6', M.naslednjaStevilka(s) === 6);
pri('oznaka vozila', M.oznakaVozila(s.elementi[0]) === '1 · IMP · GVC-1');
pri('oznaka brez kratice', M.oznakaVozila({ st: 2, kratica: '', tip: 'NMP' }) === '2 · NMP');

const k = M.podvojiSkico(s, 'Korak 2');
pri('kopija ima iste elemente z novimi ID', k.elementi.length === 3 && k.elementi.every((e, i) => e.id !== s.elementi[i].id) && k.id !== s.id && k.naziv === 'Korak 2');
k.elementi[0].lat = 47;
pri('kopija je neodvisna', s.elementi[0].lat === 46.39);
n.skice.push(k);
k.elementi.push({ id: 'd', vrsta: 'vozilo', tip: 'NMP', sluzba: 'resevalci', kratica: '', st: 6, lat: 46.4, lon: 15.6 });
const vozila = M.seznamVozil(n);
pri('seznam vozil brez dvojnikov prek skic', vozila.length === 3 && vozila.map(v => v.st).join() === '1,5,6', vozila);
pri('seznam ohrani opis', vozila[0].opis === 'notranji napad');
pri('naziv društva', M.nazivDrustva('slb') === 'PGD Slovenska Bistrica' && M.nazivDrustva('XYZ') === '');

// shrani -> odpri
const r = M.uvozi(JSON.stringify(n));
pri('uvoz lastnega izvoza', r.ok && r.izpusceno === 0 && r.nacrt.skice.length === 4 && r.nacrt.skice[2].elementi.length === 3 && r.nacrt.naziv === 'Vaja Impol', r);
pri('uvoz ohrani pogled', r.nacrt.skice[0].pogled.z === 16);
pri('ni JSON', M.uvozi('to ni json').ok === false);
pri('prazno', M.uvozi(null).ok === false);
pri('tuja datoteka', M.uvozi('{"a":1}').ok === false);
pri('novejša različica', M.uvozi(JSON.stringify({ vrsta: 'epv-nacrt', v: 99, skice: [] })).ok === false);
const pokvarjen = JSON.parse(JSON.stringify(n));
pokvarjen.skice[2].elementi.push({ vrsta: 'vozilo', lat: 'x', lon: 1 }, { vrsta: 'znak', znak: 'neobstojec', lat: 1, lon: 1 }, { vrsta: 'crta', slog: 'cevovod', tocke: [[1, 2]] }, { vrsta: 'nekaj' }, null);
pokvarjen.elaborat = { scenarij: 'Potres', neznano: 'x', cilji: 5 };
const rp = M.uvozi(JSON.stringify(pokvarjen));
pri('pokvarjeni elementi se izpustijo', rp.ok && rp.izpusceno === 5 && rp.nacrt.skice[2].elementi.length === 3, rp.izpusceno);
pri('elaborat: znana polja se prevzamejo, ostalo privzeto', rp.nacrt.elaborat.scenarij === 'Potres' && rp.nacrt.elaborat.neznano === undefined && typeof rp.nacrt.elaborat.cilji === 'string');
pri('brez skic dobi eno prazno', M.uvozi(JSON.stringify({ vrsta: 'epv-nacrt', v: 1, skice: [] })).nacrt.skice.length === 1);
pri('veljavne črte in območja', M.uvozi(JSON.stringify({ vrsta: 'epv-nacrt', v: 1, skice: [{ naziv: 'A', elementi: [{ vrsta: 'crta', slog: 'napad', tocke: [[1, 2], [3, 4]] }, { vrsta: 'obmocje', tocke: [[1, 2], [3, 4], [5, 6]] }, { vrsta: 'krog', lat: 1, lon: 2, r: 50 }, { vrsta: 'obmocje', tocke: [[1, 2], [3, 4]] }, { vrsta: 'krog', lat: 1, lon: 2, r: 0 }] }] })).nacrt.skice[0].elementi.length === 3);
pri('ime datoteke', M.imeDatoteke({ naziv: 'Vaja „Potres Slov. Bistrica 2025“ čšž' }) === 'Vaja_Potres_Slov_Bistrica_2025_csz.epvnacrt.json', M.imeDatoteke({ naziv: 'Vaja „Potres Slov. Bistrica 2025“ čšž' }));
pri('ime datoteke prazno', M.imeDatoteke({ naziv: '' }) === 'nacrt.epvnacrt.json');

console.log('Model načrta: ' + ok + ' uspešnih, ' + fail + ' napak.');
process.exit(fail ? 1 : 0);
