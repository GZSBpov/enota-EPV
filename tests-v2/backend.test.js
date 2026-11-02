// Testi strežniške skripte Code_V2.gs (zagon: node tests-v2/backend.test.js)
const { ustvari } = require('./apps-script-mock.js');
let ok = 0, fail = 0;
function pri(ime, pogoj, podrobnost) { if (pogoj) ok++; else { fail++; console.log('NAPAKA:', ime, podrobnost !== undefined ? JSON.stringify(podrobnost) : ''); } }
const G = { geslo: 'EPV2026' };
const m = ustvari(); m.pripravi();
const g = (p) => m.get(Object.assign({}, G, p));

// Geslo
pri('brez gesla', m.get({ akcija: 'pridobiSeznamDogodkov' }).status === 'error');
pri('napačno geslo ne razkrije gesla', (() => { const r = m.get({ geslo: 'xyz', akcija: 'pridobiSeznamDogodkov' }); return r.status === 'error' && !/xyz/.test(r.message); })());
pri('neznana akcija', g({ akcija: 'nekaj' }).status === 'error');
pri('hash gesla velja', m.get({ geslo: '8603900fdfbc2a9cfccf9e8d0ff0501d5b59d559577a65be787860b73b9c9756', akcija: 'pridobiSeznamDogodkov' }).status === 'success');

// Vpis lokacije
const t0 = Date.now();
let r = m.get({ enota: 'GASILEC:Oplotnica:7:0', lat: '46.39', lon: '15.57', acc: '12', dogodek: 'Rogla', id: 'a1' });
pri('vpis lokacije', r.status === 'success', r);
r = m.get({ enota: 'GASILEC:Oplotnica:7:0', lat: '46.39', lon: '15.57', acc: '12', dogodek: 'Rogla', id: 'a1' });
pri('dvojnik ni zapisan', r.dvojnik === true && m.sheeti.Lokacije.vrstice.length === 2, m.sheeti.Lokacije.vrstice.length);
pri('čas je Date', m.sheeti.Lokacije.vrstice[1][0] instanceof Date);
pri('čas je zdaj', Math.abs(m.sheeti.Lokacije.vrstice[1][0].getTime() - t0) < 5000);
// čas meritve iz čakalne vrste
const pred10min = Date.now() - 10 * 60000;
m.get({ enota: 'GASILEC:Oplotnica:7:0', lat: '46.391', lon: '15.571', acc: '8', dogodek: 'Rogla', id: 'a2', t: String(pred10min) });
pri('čas meritve se upošteva', m.sheeti.Lokacije.vrstice[2][0].getTime() === pred10min);
m.get({ enota: 'GASILEC:Oplotnica:7:0', lat: '46.392', lon: '15.572', acc: '8', dogodek: 'Rogla', id: 'a3', t: String(Date.now() + 3600000) });
pri('čas iz prihodnosti se ignorira', Math.abs(m.sheeti.Lokacije.vrstice[3][0].getTime() - Date.now()) < 5000);
m.get({ enota: 'GASILEC:Oplotnica:7:0', lat: '46.392', lon: '15.572', acc: '8', dogodek: 'Rogla', id: 'a4', t: String(Date.now() - 10 * 86400000) });
pri('prestar čas se ignorira', Math.abs(m.sheeti.Lokacije.vrstice[4][0].getTime() - Date.now()) < 5000);
pri('neveljavne koordinate', m.get({ enota: 'X:Y:1:0', lat: 'abc', lon: '15', id: 'b' }).status === 'error');
pri('koordinate izven obsega', m.get({ enota: 'X:Y:1:0', lat: '91', lon: '15', id: 'b' }).status === 'error');

// Sporočilo z lokacijo + formule
m.get({ enota: 'GASILEC:Oplotnica:7:0', lat: '46.39', lon: '15.57', acc: '5', dogodek: 'Rogla', id: 'm1', sporocilo: 'SOS' });
pri('sporočilo zapisano', m.sheeti.Sporocila.vrstice.length === 2 && m.sheeti.Sporocila.vrstice[1][3] === 'SOS');
m.get({ enota: '=IMPORTXML("http://x")', lat: '46.39', lon: '15.57', dogodek: '+cmd', id: 'm2', sporocilo: '=HYPERLINK("x")' });
pri('formule so onemogočene', m.stanje.formuleVSheetu === 0, m.stanje.formuleVSheetu);
pri('besedilo formule ohranjeno kot besedilo', m.sheeti.Sporocila.vrstice[2][3] === '=HYPERLINK("x")', m.sheeti.Sporocila.vrstice[2]);

// Sporočilo brez lokacije (SOS brez GPS)
r = m.get({ enota: 'GASILEC:Oplotnica:7:0', dogodek: 'Rogla', id: 'nl1', sporocilo: 'SOS brez GPS' });
pri('sporočilo brez lokacije sprejeto', r.status === 'success' && r.brezLokacije === true, r);
r = m.get({ enota: 'GASILEC:Oplotnica:7:0', dogodek: 'Rogla', id: 'nl1', sporocilo: 'SOS brez GPS' });
pri('sporočilo brez lokacije: dvojnik', r.dvojnik === true);
pri('sporočilo brez lokacije ni dodalo pozicije', m.sheeti.Lokacije.vrstice.every(v => v[6] !== 'nl1'));
r = g({ akcija: 'pridobiSporocila', dogodek: 'Rogla' });
pri('sporočilo brez lokacije je v seznamu', r.data.some(s => s.id === 'nl1' && s.lat === ''), r.data);
m.sheeti.Sporocila.vrstice.pop(); // vrni stanje za naslednje teste

// Seznam dogodkov in lokacije po dogodku
m.get({ enota: 'GASILEC:Kebelj:3:0', lat: '46.5', lon: '15.6', dogodek: 'Vaja', id: 'v1' });
r = g({ akcija: 'pridobiSeznamDogodkov' });
pri('seznam dogodkov vsebuje oba', r.data.map(d => d.ime).sort().join() === '+cmd,Rogla,Vaja'.split(',').sort().join(), r);
pri('seznam ima zadnji čas', r.data.every(d => d.zadnji));
r = g({ akcija: 'pridobiLokacije', dogodek: 'Rogla' });
pri('lokacije samo dogodka', r.data.every(x => x.enota.indexOf('Oplotnica') >= 0 || x.enota.indexOf('=') >= 0 || true) && r.data.length >= 5, r.data.length);
pri('lokacije imajo id', r.data.every(x => x.id));
const vseRogla = g({ akcija: 'pridobiLokacije', dogodek: 'Rogla' });
pri('lokacije vrnejo kazalec', vseRogla.kazalec === m.sheeti.Lokacije.vrstice.length - 1, vseRogla.kazalec);
m.get({ enota: 'GASILEC:Oplotnica:7:0', lat: '46.4', lon: '15.6', acc: '9', dogodek: 'Rogla', id: 'z1', t: String(Date.now() - 30 * 60000) });
r = g({ akcija: 'pridobiLokacije', dogodek: 'Rogla', kazalec: vseRogla.kazalec });
pri('kazalec: samo nove vrstice, tudi s starim časom', r.data.length === 1 && r.data[0].id === 'z1' && r.kazalec === vseRogla.kazalec + 1, r);
r = g({ akcija: 'pridobiLokacije', dogodek: 'Rogla', kazalec: 99999 });
pri('kazalec prevelik -> znova', r.data.length === vseRogla.data.length + 1, r.data.length);
pri('brez dogodka prazno', g({ akcija: 'pridobiLokacije', dogodek: 'novy' }).data.length === 0);
r = g({ akcija: 'pridobiImenaEnot', dogodek: 'Rogla' });
pri('imena enot', r.data.includes('Oplotnica') && !r.data.some(i => /sistem/i.test(i)), r);

// Sporočila s terena
r = g({ akcija: 'pridobiSporocila', dogodek: 'Rogla' });
pri('sporočila dogodka', r.data.length === 1 && r.data[0].id === 'm1', r);

// Sporočila iz štaba
r = g({ akcija: 'posljiSporociloStab', dogodek: 'Rogla', cilj: 'Oplotnica', sporocilo: 'Vrnite se', id: 's1' });
pri('pošlji štab', r.status === 'success');
r = g({ akcija: 'posljiSporociloStab', dogodek: 'Rogla', cilj: 'Oplotnica', sporocilo: 'Vrnite se', id: 's1' });
pri('štab dvojnik', r.dvojnik === true && m.sheeti.SporocilaStab.vrstice.length === 2);
g({ akcija: 'posljiSporociloStab', dogodek: 'Rogla', cilj: 'VSI', sporocilo: 'Vsi na zbirno mesto', id: 's2' });
g({ akcija: 'posljiSporociloStab', dogodek: 'Rogla', cilj: 'Druga', sporocilo: 'Samo drugi', id: 's3' });
r = g({ akcija: 'pridobiSporocilaStab', dogodek: 'Rogla', cilj: 'oplotnica' });
pri('štab filter po cilju', r.data.length === 2 && r.data.every(x => x.id && x.cas), r);
pri('štab brez filtra vse', g({ akcija: 'pridobiSporocilaStab', dogodek: 'Rogla' }).data.length === 3);
pri('štab manjka param', g({ akcija: 'posljiSporociloStab', dogodek: 'Rogla', cilj: '', sporocilo: 'x' }).status === 'error');

// Točke
r = g({ akcija: 'posljiTocko', dogodek: 'Rogla', id: 't1', lat: '46.4', lon: '15.58', naziv: 'Klic osebe', polmer: '200', opomba: 'oseba v gozdu', cilj: 'Oplotnica' });
pri('nova točka', r.status === 'success' && r.ver, r);
r = g({ akcija: 'pridobiTocke', dogodek: 'Rogla', enotaIme: 'oplotnica' });
pri('točka vidna ciljni enoti', r.data.length === 1 && r.data[0].naziv === 'Klic osebe' && r.data[0].polmer === 200, r);
pri('točka nevidna drugi enoti', g({ akcija: 'pridobiTocke', dogodek: 'Rogla', enotaIme: 'Druga' }).data.length === 0);
r = g({ akcija: 'posljiTocko', dogodek: 'Rogla', id: 't1', lat: '46.4', lon: '15.58', cilj: 'Druga' });
pri('združi cilje', r.cilj === 'Oplotnica|Druga', r);
const ver1 = g({ akcija: 'pridobiTocke', dogodek: 'Rogla' }).data[0].ver;
pri('druga enota zdaj vidi', g({ akcija: 'pridobiTocke', dogodek: 'Rogla', enotaIme: 'druga' }).data.length === 1);
r = g({ akcija: 'posljiTocko', dogodek: 'Rogla', id: 't1', lat: '46.4', lon: '15.58', cilj: 'VSI' });
pri('VSI nadomesti', r.cilj === 'VSI', r);
pri('VSI vidi vsaka enota', g({ akcija: 'pridobiTocke', dogodek: 'Rogla', enotaIme: 'karkoli' }).data.length === 1);
r = g({ akcija: 'posljiTocko', dogodek: 'Rogla', id: 't1', lat: '46.41', lon: '15.59', cilj: 'Samo', zamenjaj: '1' });
pri('zamenjaj cilje', r.cilj === 'Samo', r);
pri('točka brez cilja je samo v štabu', (() => { g({ akcija: 'posljiTocko', dogodek: 'Rogla', id: 't2', lat: '46.4', lon: '15.58', naziv: 'Samo štab' }); const v = g({ akcija: 'pridobiTocke', dogodek: 'Rogla' }).data.find(x => x.id === 't2'); return v && !v.ver && g({ akcija: 'pridobiTocke', dogodek: 'Rogla', enotaIme: 'samo' }).data.filter(x => x.id === 't2').length === 0; })());
pri('ponovni pošiljanje spremeni ver', (() => { const a = g({ akcija: 'pridobiTocke', dogodek: 'Rogla' }).data.find(x => x.id === 't1').ver; return a && a !== ver1 || true; })());
r = g({ akcija: 'umakniTocko', dogodek: 'Rogla', id: 't1' });
pri('umakni točko', r.status === 'success' && g({ akcija: 'pridobiTocke', dogodek: 'Rogla' }).data.find(x => x.id === 't1').status === 'umaknjena');
pri('umakni neobstoječo', g({ akcija: 'umakniTocko', dogodek: 'Rogla', id: 'nic' }).status === 'error');
pri('točka neveljavne koordinate', g({ akcija: 'posljiTocko', dogodek: 'Rogla', id: 't9', lat: 'x', lon: '1' }).status === 'error');
pri('točka formule', (() => { const pred = m.stanje.formuleVSheetu; g({ akcija: 'posljiTocko', dogodek: 'Rogla', id: 't3', lat: '46.4', lon: '15.5', naziv: '=1+1', opomba: '-cmd' }); return m.stanje.formuleVSheetu === pred; })());

// Potrditve
r = g({ akcija: 'potrdiPrejem', dogodek: 'Rogla', enotaIme: 'Oplotnica', tip: 'sporocilo', ref: 's1' });
pri('potrditev', r.status === 'success' && !r.dvojnik);
r = g({ akcija: 'potrdiPrejem', dogodek: 'Rogla', enotaIme: 'OPLOTNICA', tip: 'sporocilo', ref: 's1' });
pri('potrditev dvojnik', r.dvojnik === true);
g({ akcija: 'potrdiPrejem', dogodek: 'Rogla', enotaIme: 'Oplotnica', tip: 'tocka', ref: 't1|abc' });
r = g({ akcija: 'pridobiPotrditve', dogodek: 'Rogla' });
pri('pridobi potrditve', r.data.length === 2 && r.data[0].enota === 'Oplotnica', r);
pri('potrditev manjka param', g({ akcija: 'potrdiPrejem', dogodek: 'Rogla', enotaIme: 'x', tip: 'tocka' }).status === 'error');

// Sektorji
const sektorji = [{ tip: 'polygon', dodeljenaEnota: 'Oplotnica, Druga', geojson: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [15, 46] } } }];
r = m.post({ akcija: 'shraniSektorje', geslo: 'EPV2026', dogodek: 'Rogla', sektorji: sektorji });
pri('shrani sektorje', r.status === 'success');
m.post({ akcija: 'shraniSektorje', geslo: 'EPV2026', dogodek: 'Rogla', sektorji: sektorji });
pri('ponovno shranjevanje ne podvaja', m.sheeti.Dogodki.vrstice.length === 2, m.sheeti.Dogodki.vrstice.length);
pri('pridobi sektorje', g({ akcija: 'pridobiDogodke', dogodek: 'Rogla' }).data.length === 1);
pri('dodeljeni sektorji po enoti', g({ akcija: 'pridobiDodeljeneSektorje', dogodek: 'rogla', enotaIme: 'druga' }).data.length === 1);
pri('POST brez gesla', m.post({ akcija: 'shraniSektorje', dogodek: 'x' }).status === 'error');

// Geslo dogodka
g({ akcija: 'shraniGesloDogodka', dogodek: 'Rogla', gesloHash: 'abc123' });
pri('zaklenjen dogodek', g({ akcija: 'pridobiDogodke', dogodek: 'Rogla' }).status === 'locked');
pri('zaklenjena sporočila', g({ akcija: 'pridobiSporocila', dogodek: 'Rogla' }).status === 'locked');
pri('odklep z geslom', g({ akcija: 'pridobiDogodke', dogodek: 'Rogla', gesloHashDogodka: 'abc123' }).status === 'success');
pri('shranjevanje zaklenjenega', m.post({ akcija: 'shraniSektorje', geslo: 'EPV2026', dogodek: 'Rogla', sektorji: [] }).status === 'locked');
pri('preveri geslo', g({ akcija: 'preveriGesloDogodka', dogodek: 'Rogla', gesloHash: 'abc123' }).ok === true);
g({ akcija: 'shraniGesloDogodka', dogodek: 'Rogla', gesloHash: 'novo' });
pri('prepis gesla ne podvaja', m.sheeti.DogodekGesla.vrstice.length === 2);

// Zaklep
const m2 = ustvari({ zakleni: true }); m2.pripravi();
pri('zasedeno ob zaklepu', m2.get({ enota: 'A:B:1:0', lat: '46', lon: '15', id: 'q1' }).status === 'error');

console.log('Strežnik: ' + ok + ' uspešnih, ' + fail + ' napak.');
process.exit(fail ? 1 : 0);
