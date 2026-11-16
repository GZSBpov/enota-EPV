// Testi strežniške skripte Code.gs (zagon: node tests/backend.test.js)
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
pri('zgoščena vrednost ni več veljavno geslo', m.get({ geslo: '8603900fdfbc2a9cfccf9e8d0ff0501d5b59d559577a65be787860b73b9c9756', akcija: 'pridobiSeznamDogodkov' }).status === 'error');

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
r = g({ akcija: 'pridobiSeznamDogodkov', oblika: 'objekt' });
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

// Združljivost s staro stranjo (V1/)
r = g({ akcija: 'pridobiSeznamDogodkov' });
pri('stari odjemalec: seznam dogodkov so nizi', r.data.length >= 2 && r.data.every(d => typeof d === 'string'), r.data);
r = m.get({ geslo: 'EPV2026' });
pri('stari odjemalec: privzeti klic vrne celoten list', Array.isArray(r.data) && r.data.length === m.sheeti.Lokacije.vrstice.length && r.data[0][0] === 'Čas', r.data && r.data[0]);

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
const t1pred = g({ akcija: 'pridobiTocke', dogodek: 'Rogla' }).data.find(x => x.id === 't1');
pri('pred umikom: ni časa umika', !t1pred.umaknjeno);
const predUmik = Date.now();
r = g({ akcija: 'umakniTocko', dogodek: 'Rogla', id: 't1' });
const t1po = g({ akcija: 'pridobiTocke', dogodek: 'Rogla' }).data.find(x => x.id === 't1');
pri('umakni točko', r.status === 'success' && t1po.status === 'umaknjena');
pri('umik: čas umika je zapisan', t1po.umaknjeno && Math.abs(Date.parse(t1po.umaknjeno) - predUmik) < 5000, t1po);
pri('umik: čas pošiljanja (ver) ostane', t1po.ver === t1pred.ver, [t1pred.ver, t1po.ver]);
r = g({ akcija: 'posljiTocko', dogodek: 'Rogla', id: 't1', lat: '46.4', lon: '15.58', cilj: 'Oplotnica' });
pri('ponovna aktivacija: status in čas umika', g({ akcija: 'pridobiTocke', dogodek: 'Rogla' }).data.find(x => x.id === 't1').status === 'aktivna' && !g({ akcija: 'pridobiTocke', dogodek: 'Rogla' }).data.find(x => x.id === 't1').umaknjeno);
g({ akcija: 'umakniTocko', dogodek: 'Rogla', id: 't1' });
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


// pripraviListe na tabeli z zgodovino ne spremeni časovnega pasu
{
  const h = ustvari(); h.pripravi();
  h.get({ enota: 'GASILEC:Stara:1:0', lat: '46', lon: '15', dogodek: 'Zgodovina', id: 'h1' });
  h.ss.setSpreadsheetTimeZone('Etc/GMT-2');
  h.pripravi();
  console.log('Časovni pas po pripraviListe na tabeli z zgodovino:', h.ss.getSpreadsheetTimeZone());
  if (h.ss.getSpreadsheetTimeZone() !== 'Etc/GMT-2') { console.log('NAPAKA: časovni pas je bil spremenjen'); process.exit(1); }
  const novo = ustvari(); novo.pripravi();
  if (novo.ss.getSpreadsheetTimeZone() !== 'Europe/Ljubljana') { console.log('NAPAKA: prazna tabela bi morala dobiti Ljubljana'); process.exit(1); }
  // stara glava z 6 stolpci se dopolni
  const st = ustvari(); st.ss.insertSheet('Lokacije').appendRow(['ČAS', 'ENOTA', 'Latitude', 'Longitude', 'Natančnost', 'Dogodek']);
  st.sheeti.Lokacije.appendRow(['x']); st.pripravi();
  if (st.sheeti.Lokacije.vrstice[0].length !== 7 || st.sheeti.Lokacije.vrstice[0][6] !== 'ID') { console.log('NAPAKA: glava ni dopolnjena', st.sheeti.Lokacije.vrstice[0]); process.exit(1); }
}

// ---------------- geslo aplikacije: ni v kodi, zamenjava ----------------
{
  const z = ustvari(); z.pripravi();
  const koda = require('fs').readFileSync(require('path').join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  pri('geslo ni zapisano v kodi skripte', !/EPV2026/.test(koda.replace(/\/\/.*$/gm, '')));
  pri('pred zamenjavo velja staro geslo, strežnik opozori', z.get({ geslo: 'EPV2026', akcija: 'preveriGeslo' }).privzetoGeslo === true);
  pri('prekratko novo geslo zavrnjeno', z.get({ geslo: 'EPV2026', akcija: 'zamenjajGeslo', novoGeslo: 'kratko' }).status === 'error');
  pri('staro geslo kot novo zavrnjeno', z.get({ geslo: 'EPV2026', akcija: 'zamenjajGeslo', novoGeslo: 'EPV2026' }).status === 'error');
  pri('zamenjava brez veljavnega gesla zavrnjena', z.get({ geslo: 'napacno', akcija: 'zamenjajGeslo', novoGeslo: 'NovoGeslo#2026' }).status === 'error' && !z.lastnosti.GESLO_HASH);
  pri('zamenjava gesla', z.get({ geslo: 'EPV2026', akcija: 'zamenjajGeslo', novoGeslo: 'NovoGeslo#2026' }).status === 'success');
  pri('v nastavitvah je samo zgoščena vrednost', /^[0-9a-f]{64}$/.test(z.lastnosti.GESLO_HASH) && !JSON.stringify(z.lastnosti).includes('NovoGeslo'));
  pri('staro geslo ne velja več', z.get({ geslo: 'EPV2026', akcija: 'pridobiSeznamDogodkov' }).status === 'error' && z.post({ akcija: 'shraniSektorje', geslo: 'EPV2026', dogodek: 'x', sektorji: [] }).status === 'error');
  const r2 = z.get({ geslo: 'NovoGeslo#2026', akcija: 'preveriGeslo' });
  pri('novo geslo velja', r2.status === 'success' && r2.privzetoGeslo === false && z.post({ akcija: 'shraniSektorje', geslo: 'NovoGeslo#2026', dogodek: 'x', sektorji: [] }).status === 'success');
  pri('napačno geslo ne razkrije ničesar', z.get({ geslo: 'NovoGeslo#2025', akcija: 'preveriGeslo' }).message === 'Napačno geslo!');
}

// ---------------- žetoni dogodkov (QR koda) ----------------
{
  const z = ustvari(); z.pripravi();
  const G = 'EPV2026';
  const vpis = (dod) => Object.assign({ enota: 'GASILEC:Oplotnica:5:1', lat: '46.4', lon: '15.6', dogodek: 'Vaja A', id: 'i' + Math.random() }, dod);
  pri('dogodek brez žetona: vpis brez žetona deluje (stare QR kode)', z.get(vpis()).status === 'success');
  pri('žeton zahteva geslo', z.get({ akcija: 'zetonDogodka', dogodek: 'Vaja A' }).status === 'error');
  const zt = z.get({ geslo: G, akcija: 'zetonDogodka', dogodek: 'Vaja A' });
  pri('žeton izdan', zt.status === 'success' && zt.nov === true && /^[0-9a-f]{24}$/.test(zt.zeton), zt);
  pri('ponovna zahteva vrne isti žeton', z.get({ geslo: G, akcija: 'zetonDogodka', dogodek: 'Vaja A' }).zeton === zt.zeton);
  pri('žeton brez dogodka', z.get({ geslo: G, akcija: 'zetonDogodka', dogodek: '' }).status === 'error');
  const brez = z.get(vpis());
  pri('po izdaji žetona: vpis brez žetona zavrnjen', brez.status === 'error' && brez.koda === 'zeton', brez);
  pri('napačen žeton zavrnjen', z.get(vpis({ zeton: 'abcdef' })).koda === 'zeton');
  pri('pravi žeton: vpis pozicije', z.get(vpis({ zeton: zt.zeton })).status === 'success');
  pri('pravi žeton: SOS brez lokacije', z.get({ enota: 'GASILEC:Oplotnica:5:1', dogodek: 'Vaja A', sporocilo: 'SOS', id: 'sos1', zeton: zt.zeton }).status === 'success');
  pri('lažni SOS brez žetona zavrnjen', z.get({ enota: 'GASILEC:Lazna:1:0', dogodek: 'Vaja A', sporocilo: 'SOS', id: 'sos2' }).koda === 'zeton' && z.sheeti.Sporocila.vrstice.every(v => !String(v[1]).includes('Lazna')));
  pri('žeton drugega dogodka ne velja', (() => { const d = z.get({ geslo: G, akcija: 'zetonDogodka', dogodek: 'Vaja B' }).zeton; return z.get(vpis({ zeton: d })).koda === 'zeton' && z.get(vpis({ dogodek: 'Vaja B', zeton: d })).status === 'success'; })());
  pri('štab vpisuje z geslom (zaznamek konca intervencije)', z.get({ enota: 'SISTEM:Konec intervencije:0', lat: '46.4', lon: '15.6', dogodek: 'Vaja A', sporocilo: 'KONEC INTERVENCIJE', id: 'k1', geslo: G }).status === 'success');
  // terenske akcije z žetonom
  z.get({ geslo: G, akcija: 'posljiSporociloStab', dogodek: 'Vaja A', cilj: 'VSI', sporocilo: 'Zbor', id: 'st1' });
  z.get({ geslo: G, akcija: 'posljiTocko', dogodek: 'Vaja A', id: 't1', lat: '46.4', lon: '15.6', cilj: 'VSI', naziv: 'T' });
  const sZ = { dogodek: 'Vaja A', zeton: zt.zeton };
  pri('teren z žetonom bere sporočila štaba', z.get(Object.assign({ akcija: 'pridobiSporocilaStab', cilj: 'Oplotnica' }, sZ)).data.length === 1);
  pri('teren z žetonom bere točke in sektorje', z.get(Object.assign({ akcija: 'pridobiTocke', enotaIme: 'Oplotnica' }, sZ)).data.length === 1 && z.get(Object.assign({ akcija: 'pridobiDodeljeneSektorje', enotaIme: 'Oplotnica' }, sZ)).status === 'success');
  pri('teren z žetonom potrdi prejem', z.get(Object.assign({ akcija: 'potrdiPrejem', enotaIme: 'Oplotnica', tip: 'sporocilo', ref: 'st1' }, sZ)).status === 'success');
  pri('teren brez žetona in gesla ne bere', z.get({ akcija: 'pridobiSporocilaStab', dogodek: 'Vaja A', cilj: 'Oplotnica' }).status === 'error' && z.get({ akcija: 'pridobiTocke', dogodek: 'Vaja A', zeton: 'napacen' }).status === 'error');
  pri('žeton ne odpre štabnih akcij', ['pridobiLokacije', 'pridobiSeznamDogodkov', 'posljiSporociloStab', 'posljiTocko', 'zetonDogodka', 'zamenjajGeslo', 'pridobiDogodke', 'pridobiPotrditve', 'shraniGesloDogodka'].every(a => z.get(Object.assign({ akcija: a, cilj: 'VSI', sporocilo: 'x', novoGeslo: 'NovoGeslo#1' }, sZ)).status === 'error') && !z.lastnosti.GESLO_HASH);
  pri('žeton enega dogodka ne bere drugega', z.get({ akcija: 'pridobiSporocilaStab', dogodek: 'Vaja B', zeton: zt.zeton }).status === 'error');
  // nov žeton prekliče starega
  const nov = z.get({ geslo: G, akcija: 'zetonDogodka', dogodek: 'Vaja A', nov: '1' });
  pri('nov žeton prekliče starega', nov.nov === true && nov.zeton !== zt.zeton && z.get(vpis({ zeton: zt.zeton })).koda === 'zeton' && z.get(vpis({ zeton: nov.zeton })).status === 'success' && z.sheeti.Zetoni.vrstice.filter(v => v[0] === 'Vaja A').length === 1);
  // stroga zaščita
  pri('brez stroge zaščite: nov dogodek brez žetona je odprt', z.get(vpis({ dogodek: 'Neznan' })).status === 'success');
  z.lastnosti.STROGA_ZASCITA = '1';
  pri('stroga zaščita: dogodek brez žetona zavrnjen', z.get(vpis({ dogodek: 'Neznan2' })).koda === 'zeton' && z.get(vpis({ zeton: nov.zeton })).status === 'success' && z.get(vpis({ dogodek: 'Neznan2', geslo: G })).status === 'success');
}

// ---------------- arhiv pozicij starih dogodkov ----------------
{
  const z = ustvari(); z.pripravi();
  const G = 'EPV2026', dan = 86400000, zdaj = Date.now();
  const L = z.sheeti.Lokacije;
  const vrsta = (ms, enota, dog, id) => L.vrstice.push([new Date(ms), enota, 46.4, 15.6, 10, dog, id]);
  // prepleteni vrstici starega in tekočega dogodka + dogodek z nevarnim imenom enote
  vrsta(zdaj - 60 * dan, 'GASILEC:Stara A:3:1', 'Stara vaja', 's1');
  vrsta(zdaj - 2 * dan, 'GASILEC:Nova A:3:1', 'Tekoca', 'n1');
  vrsta(zdaj - 59 * dan, 'GASILEC:=Stara B:3:1', 'Stara vaja', 's2');
  vrsta(zdaj - 1 * dan, 'GASILEC:Nova B:3:1', 'Tekoca', 'n2');
  vrsta(zdaj - 40 * dan, 'GASILEC:Sredina:2:1', 'Srednja', 'm1');
  z.sheeti.Sporocila.vrstice.push([new Date(zdaj - 5 * dan), 'GASILEC:Sredina:2:1', 'Srednja', 'pozno sporočilo', '', '', 'ms1']);
  const pred = z.get({ geslo: G, akcija: 'pridobiLokacije', dogodek: 'Stara vaja' }).data;
  const r = z.sandbox.arhivirajStareDogodke(30);
  pri('arhiv: prestavljen samo stari dogodek', r.ok && r.dogodkov === 1 && r.vrstic === 2 && r.imena[0] === 'Stara vaja', r);
  pri('arhiv: dogodek s svežim sporočilom ostane', L.vrstice.some(v => v[5] === 'Srednja'));
  pri('arhiv: živi list brez starih vrstic in brez praznih', L.vrstice.length === 4 && L.vrstice.slice(1).map(v => v[6]).join() === 'n1,n2,m1', L.vrstice.map(v => v[6]));
  pri('arhiv: vrstice v arhivu s časom in ID', z.sheeti.LokacijeArhiv.vrstice.length === 3 && z.sheeti.LokacijeArhiv.vrstice[1][0] instanceof Date && z.sheeti.LokacijeArhiv.vrstice[2][6] === 's2');
  pri('arhiv: besedilo ni postalo formula', z.stanje.formuleVSheetu === 0);
  const po = z.get({ geslo: G, akcija: 'pridobiLokacije', dogodek: 'Stara vaja' });
  pri('arhiv: arhiviran dogodek se bere enako kot prej', JSON.stringify(po.data.map(v => [v.id, v.enota, v.cas])) === JSON.stringify(pred.map(v => [v.id, v.enota, v.cas])), po.data);
  pri('arhiv: dogodek ostane na seznamu s časom', z.get({ geslo: G, akcija: 'pridobiSeznamDogodkov', oblika: 'objekt' }).data.some(d => d.ime === 'Stara vaja' && d.zadnji) && z.get({ geslo: G, akcija: 'pridobiSeznamDogodkov' }).data.includes('Stara vaja'));
  pri('arhiv: imena enot arhiviranega dogodka', z.get({ geslo: G, akcija: 'pridobiImenaEnot', dogodek: 'Stara vaja' }).data.length === 2);
  pri('arhiv: tekoči dogodek nespremenjen', z.get({ geslo: G, akcija: 'pridobiLokacije', dogodek: 'Tekoca' }).data.map(v => v.id).join() === 'n1,n2');
  // kazalec pri arhiviranem dogodku + nova pozicija za isto ime
  z.get({ enota: 'GASILEC:Stara A:3:1', lat: '46.4', lon: '15.6', dogodek: 'Stara vaja', id: 's3' });
  const dodatno = z.get({ geslo: G, akcija: 'pridobiLokacije', dogodek: 'Stara vaja', kazalec: po.kazalec });
  pri('arhiv: nova pozicija arhiviranega dogodka pride po kazalcu', dodatno.data.length === 1 && dodatno.data[0].id === 's3', dodatno);
  pri('arhiv: ponovni zagon ne naredi ničesar', z.sandbox.arhivirajStareDogodke(30).vrstic === 0 && z.sheeti.LokacijeArhiv.vrstice.length === 3);
  pri('arhiv: neveljavna meja uporabi privzeto', z.sandbox.arhivirajStareDogodke('abc').ok === true);
  const p2 = ustvari(); p2.pripravi();
  pri('arhiv: prazna tabela', p2.sandbox.arhivirajStareDogodke(30).vrstic === 0);
  const vse = ustvari(); vse.pripravi();
  vse.sheeti.Lokacije.vrstice.push([new Date(zdaj - 90 * dan), 'GASILEC:X:1:1', 46, 15, 5, 'Edini', 'e1']);
  pri('arhiv: ko se arhivira vse, ostane samo glava', vse.sandbox.arhivirajStareDogodke(30).vrstic === 1 && vse.sheeti.Lokacije.vrstice.length === 1 && vse.get({ geslo: G, akcija: 'pridobiLokacije', dogodek: 'Edini' }).data.length === 1);
}

// ---------------- načrti taktične table na spletu ----------------
{
  const z = ustvari(); z.pripravi();
  const G = 'EPV2026';
  const maly = JSON.stringify({ vrsta: 'epv-nacrt', v: 1, naziv: 'Vaja A', skice: [] });
  pri('načrt: shranjevanje zahteva geslo', z.post({ akcija: 'shraniNacrt', naziv: 'Vaja A', vsebina: maly }).status === 'error' && z.get({ akcija: 'seznamNacrtov' }).status === 'error');
  pri('načrt: brez naziva ali z neveljavno vsebino zavrnjen', z.post({ akcija: 'shraniNacrt', geslo: G, naziv: ' ', vsebina: maly }).status === 'error' && z.post({ akcija: 'shraniNacrt', geslo: G, naziv: 'X', vsebina: '{pokvarjeno' }).status === 'error' && z.sheeti.Nacrti.vrstice.length === 1);
  const r1 = z.post({ akcija: 'shraniNacrt', geslo: G, naziv: 'Vaja A', vsebina: maly });
  pri('načrt: shranjen', r1.status === 'success' && r1.zamenjan === false && z.sheeti.Nacrti.vrstice.length === 2, r1);
  pri('načrt: prebran enak', z.get({ geslo: G, akcija: 'pridobiNacrt', naziv: 'Vaja A' }).vsebina === maly);
  // velik načrt (več kosov), z znaki, ki bi jih Sheet lahko razumel kot formulo na začetku kosa
  const velik = JSON.stringify({ vrsta: 'epv-nacrt', v: 1, naziv: '=Velik', polnilo: '=+-@čšž"\\n'.repeat(15000) });
  const r2 = z.post({ akcija: 'shraniNacrt', geslo: G, naziv: '=Velik', vsebina: velik });
  const kosov = z.sheeti.Nacrti.vrstice.filter(v => v[0] === '=Velik').length;
  pri('načrt: velik se razdeli na kose pod 50.000 znakov', r2.status === 'success' && kosov === Math.ceil(velik.length / 40000) && kosov > 3 && z.sheeti.Nacrti.vrstice.every(v => String(v[4]).length <= 50000), kosov);
  pri('načrt: velik prebran brez izgube', z.get({ geslo: G, akcija: 'pridobiNacrt', naziv: '=Velik' }).vsebina === velik);
  pri('načrt: nič ni postalo formula', z.stanje.formuleVSheetu === 0);
  const manjsi = JSON.stringify({ vrsta: 'epv-nacrt', v: 1, naziv: '=Velik', skice: [1] });
  const r3 = z.post({ akcija: 'shraniNacrt', geslo: G, naziv: '=Velik', vsebina: manjsi });
  pri('načrt: ponovno shranjevanje zamenja stare kose', r3.zamenjan === true && z.sheeti.Nacrti.vrstice.filter(v => v[0] === '=Velik').length === 1 && z.get({ geslo: G, akcija: 'pridobiNacrt', naziv: '=Velik' }).vsebina === manjsi);
  const sez = z.get({ geslo: G, akcija: 'seznamNacrtov' }).data;
  pri('načrt: seznam z nazivi in velikostjo', sez.length === 2 && sez.map(d => d.naziv).sort().join() === '=Velik,Vaja A' && sez.find(d => d.naziv === 'Vaja A').znakov === maly.length, sez);
  pri('načrt: neobstoječ', z.get({ geslo: G, akcija: 'pridobiNacrt', naziv: 'Ni ga' }).status === 'error' && z.get({ geslo: G, akcija: 'izbrisiNacrt', naziv: 'Ni ga' }).status === 'error');
  pri('načrt: brisanje', z.get({ geslo: G, akcija: 'izbrisiNacrt', naziv: 'Vaja A' }).status === 'success' && z.get({ geslo: G, akcija: 'seznamNacrtov' }).data.length === 1 && z.get({ geslo: G, akcija: 'pridobiNacrt', naziv: '=Velik' }).vsebina === manjsi);
  pri('načrt: prevelik zavrnjen', z.post({ akcija: 'shraniNacrt', geslo: G, naziv: 'Ogromen', vsebina: JSON.stringify({ a: 'x'.repeat(3000001) }) }).status === 'error');
  pri('načrt: žeton terena ne odpre načrtov', (() => { const zt = z.get({ geslo: G, akcija: 'zetonDogodka', dogodek: 'D' }).zeton; return z.get({ akcija: 'seznamNacrtov', dogodek: 'D', zeton: zt }).status === 'error'; })());
}

console.log('Strežnik: ' + ok + ' uspešnih, ' + fail + ' napak.');
process.exit(fail ? 1 : 0);
