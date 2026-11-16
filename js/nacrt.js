// ==========================================
// EPV NAČRT (taktična tabla) - uporabniški vmesnik
// Navadna skripta (brez modulov), zato stran deluje tudi odprta neposredno z diska.
// Načrt se sproti shranjuje v brskalnik (da se delo ne izgubi) in na zahtevo v datoteko.
// ==========================================
(function () {
    'use strict';
    const M = window.EPVNacrtModel;
    const KLJUC_SAMODEJNO = 'epv_nacrt_trenutni';
    const ZACETEK = { lat: 46.3934, lon: 15.5746, z: 15 };
    const $ = function (id) { return document.getElementById(id); };

    let nacrt = null;
    let idxSkice = 0;
    let izbranId = null;
    let orodje = null;        // { vrsta, ... } ali null
    let risanje = null;       // { tocke: [[lat,lon]...], predogled: L.polyline }
    let zgodovina = [];
    let map, sloj, slojOsnove, podlage, trenutnaPodlaga = 'ortofoto';
    const KLJUC_OSNOVA = 'epv_nacrt_osnova';
    const KLJUC_OSNOVA_VIDNA = 'epv_nacrt_osnova_vidna';
    let osnova = { tocke: [], obrisi: [] };   // stalno: območje zveze in gasilski domovi (enako za vse načrte na tej napravi)
    let osnovaVidna = true;

    function esc(niz) {
        return String(niz === undefined || niz === null ? '' : niz).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function skica() { return nacrt.skice[idxSkice]; }
    function najdi(id) { return skica().elementi.filter(function (e) { return e.id === id; })[0] || null; }

    // ---------- shranjevanje, zgodovina ----------
    function zapomni() {
        zgodovina.push(JSON.stringify({ n: nacrt, i: idxSkice }));
        if (zgodovina.length > 40) zgodovina.shift();
    }
    function samodejnoShrani() {
        nacrt.spremenjeno = new Date().toISOString();
        try { localStorage.setItem(KLJUC_SAMODEJNO, JSON.stringify(nacrt)); } catch (e) { /* poln ali nedostopen pomnilnik */ }
    }
    function razveljavi() {
        const z = zgodovina.pop();
        if (!z) return;
        const o = JSON.parse(z);
        nacrt = o.n; idxSkice = Math.min(o.i, nacrt.skice.length - 1); izbranId = null;
        samodejnoShrani();
        osveziVse(true);
    }

    // ---------- ikone ----------
    /**
     * Tloris vozila (obrnjen navzgor): pravokotnik s temnim vetrobranskim steklom spredaj in barvno črto.
     * o.cisterna: X na zadnjem delu (za črto). o.roka: zasuk lestvenika/roke v stopinjah glede na vozilo.
     */
    function svgVozila(oblika, sluzba, o) {
        o = o || {};
        const s = M.SLUZBE[sluzba] || M.SLUZBE.gasilci;
        const r = 'stroke="#0f172a" stroke-width="1.5"';
        const steklo = '#1f2937';
        // Telo: spredaj zoženo v trapez, ob straneh rahlo vidna kolesa (4, pri triosnih vozilih 6).
        const telo = function (x, y, w, h) {
            const crtaY = y + Math.round(h * 0.52);
            const zozitev = 3.5, nos = Math.min(9, Math.round(h * 0.2));
            const osi = o.kolesa === 6 && h >= 40 ? [y + nos + 3, y + h - 20, y + h - 10] : [y + nos + 3, y + h - 10];
            let t = osi.map(function (oy) {
                return '<rect x="' + (x - 2.2) + '" y="' + oy + '" width="4" height="7.5" rx="1.5" fill="#111827"/><rect x="' + (x + w - 1.8) + '" y="' + oy + '" width="4" height="7.5" rx="1.5" fill="#111827"/>';
            }).join('');
            t += '<polygon points="' + (x + zozitev) + ',' + y + ' ' + (x + w - zozitev) + ',' + y + ' ' + (x + w) + ',' + (y + nos) + ' ' + (x + w) + ',' + (y + h) + ' ' + x + ',' + (y + h) + ' ' + x + ',' + (y + nos) + '" fill="' + s.barva + '" ' + r + ' stroke-linejoin="round"/>' +
                '<polygon points="' + (x + zozitev + 1.2) + ',' + (y + 3.5) + ' ' + (x + w - zozitev - 1.2) + ',' + (y + 3.5) + ' ' + (x + w - 2.2) + ',' + (y + nos + 1.5) + ' ' + (x + 2.2) + ',' + (y + nos + 1.5) + '" fill="' + steklo + '"/>' +
                '<rect x="' + (x + 0.8) + '" y="' + crtaY + '" width="' + (w - 1.6) + '" height="3.5" fill="' + s.proga + '"/>';
            if (o.cisterna) {
                const y1 = crtaY + 6, y2 = y + h - 3;
                t += '<line x1="' + (x + 3) + '" y1="' + y1 + '" x2="' + (x + w - 3) + '" y2="' + y2 + '" stroke="#fff" stroke-width="2.6"/><line x1="' + (x + w - 3) + '" y1="' + y1 + '" x2="' + (x + 3) + '" y2="' + y2 + '" stroke="#fff" stroke-width="2.6"/>';
            }
            return t;
        };
        if (oblika === 'avto') return telo(19, 13, 18, 30);
        if (oblika === 'dron') {
            return '<line x1="14" y1="14" x2="42" y2="42" stroke="#0f172a" stroke-width="4"/><line x1="42" y1="14" x2="14" y2="42" stroke="#0f172a" stroke-width="4"/>' +
                [[14, 14], [42, 14], [14, 42], [42, 42]].map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="7" fill="#e2e8f0" ' + r + '/>'; }).join('') +
                '<rect x="21" y="21" width="14" height="14" rx="3" fill="' + s.barva + '" ' + r + '/>';
        }
        if (oblika === 'coln') return '<path d="M28 5 Q41 22 38 50 L18 50 Q15 22 28 5 Z" fill="' + s.barva + '" ' + r + '/><rect x="21" y="30" width="14" height="4" fill="' + s.proga + '"/>';
        if (oblika === 'priklopnik') return '<line x1="28" y1="6" x2="28" y2="18" stroke="#0f172a" stroke-width="3"/><rect x="19" y="18" width="18" height="26" rx="2" fill="' + s.barva + '" ' + r + '/><rect x="19" y="30" width="18" height="3.5" fill="' + s.proga + '"/>';
        let t = telo(18, 5, 20, 46);
        if (M.imaRoko(oblika)) {
            // vrtišče na zadnjem delu vozila; lestvenik/roka sega od vrtišča 42 enot v nastavljeno smer
            const vx = 28, vy = 40, kot = o.roka || 0;
            let roka;
            if (oblika === 'lestev') {
                roka = '<rect x="' + (vx - 3.5) + '" y="' + (vy - 42) + '" width="7" height="42" fill="#e5e7eb" ' + r + '/>' +
                    [6, 12, 18, 24, 30, 36].map(function (d) { return '<line x1="' + (vx - 3.5) + '" y1="' + (vy - d) + '" x2="' + (vx + 3.5) + '" y2="' + (vy - d) + '" stroke="#0f172a" stroke-width="1.2"/>'; }).join('') +
                    '<rect x="' + (vx - 5) + '" y="' + (vy - 48) + '" width="10" height="7" fill="#fde047" ' + r + '/>';
            } else {
                roka = '<line x1="' + vx + '" y1="' + vy + '" x2="' + vx + '" y2="' + (vy - 42) + '" stroke="#0f172a" stroke-width="6.5" stroke-linecap="round"/><line x1="' + vx + '" y1="' + vy + '" x2="' + vx + '" y2="' + (vy - 42) + '" stroke="#facc15" stroke-width="3.5" stroke-linecap="round"/>' +
                    '<rect x="' + (vx - 5) + '" y="' + (vy - 49) + '" width="10" height="8" fill="#fde047" ' + r + '/>';
            }
            t += '<g transform="rotate(' + kot + ' ' + vx + ' ' + vy + ')">' + roka + '</g><circle cx="' + vx + '" cy="' + vy + '" r="4.5" fill="#475569" ' + r + '/>';
        }
        return t;
    }
    function oblikaZaTip(tip, sluzba) {
        const najden = M.TIPI_VOZIL.filter(function (v) { return v.tip === tip; })[0];
        if (najden) return najden.oblika;
        return (M.VOZILA_SLUZB[sluzba] || { oblika: 'tovorno' }).oblika;
    }
    /** samoStevilka: v izpisu je pod vozilom samo zaporedna številka (podrobnosti so v tabeli pod skico). */
    function ikonaVozila(e, izbran, samoStevilka, brezNapisa) {
        const oblika = e.oblika || oblikaZaTip(e.tip, e.sluzba);
        const zasukRoke = (((e.roka === undefined ? (e.kot || 0) : e.roka) - (e.kot || 0)) % 360 + 360) % 360;
        const napis = brezNapisa ? '' : samoStevilka ? String(e.st === undefined || e.st === null ? '' : e.st) : (M.oznakaVozila(e) || '?');
        const html = '<div class="nv' + (izbran ? ' izbran' : '') + '"><svg viewBox="0 0 56 56"><g transform="rotate(' + (e.kot || 0) + ' 28 28)">' + svgVozila(oblika, e.sluzba, { cisterna: M.jeCisterna(e), roka: zasukRoke, kolesa: M.steviloKoles(e.tip) }) + '</g></svg>' +
            (napis ? '<span class="nv-napis">' + esc(napis) + '</span>' : '') + '</div>';
        return L.divIcon({ className: 'nacrt-ikona', html: html, iconSize: [60, 76], iconAnchor: [30, 28] });
    }
    function ikonaZnaka(e, izbran, brezNapisa) {
        const z = M.ZNAKI[e.znak];
        const napis = brezNapisa ? '' : (e.opis || z.napis || '');
        const html = '<div class="nz' + (izbran ? ' izbran' : '') + '"><div class="nz-telo' + (z.krog ? ' krog' : '') + (z.prazen ? ' prazen' : '') + '" style="background:' + z.barva + ';' + (z.vrti ? 'transform:rotate(' + ((e.kot || 0) - 90) + 'deg);' : '') + '">' + esc(z.znak) + '</div>' +
            (napis ? '<span class="nv-napis">' + esc(napis) + '</span>' : '') + '</div>';
        return L.divIcon({ className: 'nacrt-ikona', html: html, iconSize: [40, 56], iconAnchor: [20, 19] });
    }
    function ikonaBesedila(e, izbran) {
        return L.divIcon({ className: 'nacrt-ikona', html: '<span class="nb' + (izbran ? ' izbran' : '') + '">' + esc(e.opis || 'Besedilo') + '</span>', iconSize: [0, 0], iconAnchor: [0, 0] });
    }
    function sredina(tocke) {
        let a = 0, b = 0;
        tocke.forEach(function (p) { a += p[0]; b += p[1]; });
        return [a / tocke.length, b / tocke.length];
    }

    // ---------- risanje skice na zemljevid (uporablja ga tudi izpis) ----------
    function narisi(sk, cilj, naMapo, interaktivno) {
        cilj.clearLayers();
        sk.elementi.forEach(function (e, indeks) {
            const izbran = interaktivno && e.id === izbranId;
            // napisi: skupno stikalo za ves načrt in izklop pri posameznem elementu
            const kazi = nacrt.napisi !== false && !e.skrijNapis;
            const klik = function (plast) {
                if (!interaktivno) return plast;
                plast.on('click', function (ev) {
                    // med postavljanjem klik na obstoječ element pomeni novo točko na tem mestu, ne izbire
                    if (orodje) { if (ev && ev.latlng) postavi(ev.latlng.lat, ev.latlng.lng); return; }
                    izberi(e.id);
                });
                return plast;
            };
            const premik = function (marker) {
                if (!interaktivno) return;
                marker.on('dragstart', function () { zapomni(); });
                marker.on('dragend', function () {
                    const ll = marker.getLatLng();
                    e.lat = ll.lat; e.lon = ll.lng;
                    samodejnoShrani();
                });
            };
            if (e.vrsta === 'vozilo' || e.vrsta === 'znak' || e.vrsta === 'besedilo') {
                const ikona = e.vrsta === 'vozilo' ? ikonaVozila(e, izbran, !interaktivno, !kazi) : e.vrsta === 'znak' ? ikonaZnaka(e, izbran, !kazi) : ikonaBesedila(e, izbran);
                // vrstni red: poznejši element v seznamu je nad prejšnjim; plast 'ozadje' je pod narisanimi črtami in območji
                const m = L.marker([e.lat, e.lon], { icon: ikona, draggable: !!interaktivno, zIndexOffset: (indeks + 1) * 3000, pane: e.plast === 'ozadje' ? 'epvOzadje' : 'markerPane' });
                if (e.vrsta === 'vozilo' && e.opis) m.bindTooltip(e.opis, { direction: 'top', offset: [0, -24] });
                premik(m); cilj.addLayer(klik(m));
            } else if (e.vrsta === 'crta') {
                const c = M.CRTE[e.slog];
                const barva = e.barva || c.barva;
                // temna obroba pod črto, da se svetle barve vidijo na vsaki podlagi
                cilj.addLayer(L.polyline(e.tocke, { color: '#0f172a', weight: c.debelina + 4 + (izbran ? 4 : 0), opacity: 0.9, interactive: false }));
                const pl = L.polyline(e.tocke, { color: barva, weight: c.debelina + (izbran ? 4 : 0), dashArray: c.crtkano, opacity: 1, bubblingMouseEvents: false });
                if (e.opis && kazi) pl.bindTooltip(e.opis, { permanent: true, direction: 'center', className: 'nacrt-oznaka' });
                cilj.addLayer(klik(pl));
                // nevidna široka črta: črto je lažje zadeti s prstom ali miško
                if (interaktivno) cilj.addLayer(klik(L.polyline(e.tocke, { color: '#000', weight: 26, opacity: 0, bubblingMouseEvents: false })));
                if (c.puscica && e.tocke.length >= 2) {
                    const a = e.tocke[e.tocke.length - 2], b = e.tocke[e.tocke.length - 1];
                    let kot = 0;
                    try {
                        const pa = naMapo.latLngToLayerPoint(a), pb = naMapo.latLngToLayerPoint(b);
                        kot = Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180 / Math.PI;
                    } catch (err) { kot = 0; }
                    if (!isFinite(kot)) kot = 0;
                    const p = L.marker(b, { interactive: false, icon: L.divIcon({ className: 'nacrt-ikona', html: '<div class="np" style="color:' + barva + ';transform:rotate(' + kot + 'deg);">➤</div>', iconSize: [22, 22], iconAnchor: [11, 11] }) });
                    cilj.addLayer(p);
                }
            } else if (e.vrsta === 'obmocje') {
                const po = L.polygon(e.tocke, { color: e.barva || '#ef4444', weight: izbran ? 6 : 3, fillColor: e.barva || '#ef4444', fillOpacity: 0.22, bubblingMouseEvents: false });
                if (e.opis && kazi) po.bindTooltip(e.opis, { permanent: true, direction: 'center', className: 'nacrt-oznaka' });
                cilj.addLayer(klik(po));
            } else if (e.vrsta === 'krog') {
                const k = L.circle([e.lat, e.lon], { radius: e.r, color: '#dc2626', weight: izbran ? 6 : 3, dashArray: '8,8', fillColor: '#dc2626', fillOpacity: 0.15, bubblingMouseEvents: false });
                if (kazi) k.bindTooltip((e.opis || 'Nevarno območje') + ' (' + Math.round(e.r) + ' m)', { permanent: true, direction: 'bottom', className: 'nacrt-oznaka' });
                cilj.addLayer(klik(k));
            }
        });
    }

    // Ročice za urejanje izbranega elementa: oglišča sektorja/črte (premik, dodajanje, odstranjevanje) in središče kroga.
    let izbranaTocka = -1;
    function rocica(latlon, razred, znak, velikost) {
        return L.marker(latlon, { draggable: true, zIndexOffset: 90000000, icon: L.divIcon({ className: 'nacrt-ikona', html: '<div class="' + razred + '">' + (znak || '') + '</div>', iconSize: [velikost, velikost], iconAnchor: [velikost / 2, velikost / 2] }) });
    }
    function narisiRocice() {
        const e = izbranId ? najdi(izbranId) : null;
        if (!e || orodje) return;
        if (e.vrsta === 'krog') {
            const r = rocica([e.lat, e.lon], 'nt nt-sredisce', '✥', 30);
            r.rocica = 'sredisce';
            r.on('dragstart', function () { zapomni(); });
            r.on('dragend', function () { const ll = r.getLatLng(); e.lat = ll.lat; e.lon = ll.lng; samodejnoShrani(); osveziZemljevid(); });
            sloj.addLayer(r);
            return;
        }
        if (e.vrsta !== 'obmocje' && e.vrsta !== 'crta') return;
        const zaprto = e.vrsta === 'obmocje';
        e.tocke.forEach(function (p, i) {
            const r = rocica(p, 'nt' + (i === izbranaTocka ? ' nt-izbrana' : ''), '', 22);
            r.rocica = 'tocka'; r.indeks = i;
            r.on('dragstart', function () { zapomni(); });
            r.on('dragend', function () { const ll = r.getLatLng(); e.tocke[i] = [ll.lat, ll.lng]; izbranaTocka = i; samodejnoShrani(); osveziZemljevid(); osveziLastnosti(); });
            r.on('click', function () { izbranaTocka = i; osveziZemljevid(); osveziLastnosti(); });
            sloj.addLayer(r);
        });
        const stOdsekov = zaprto ? e.tocke.length : e.tocke.length - 1;
        for (let i = 0; i < stOdsekov; i++) {
            (function (i) {
                const a = e.tocke[i], b = e.tocke[(i + 1) % e.tocke.length];
                const sred = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
                const r = L.marker(sred, { zIndexOffset: 80000000, icon: L.divIcon({ className: 'nacrt-ikona', html: '<div class="nt nt-nova">+</div>', iconSize: [20, 20], iconAnchor: [10, 10] }) });
                r.rocica = 'nova'; r.indeks = i;
                r.on('click', function () { zapomni(); e.tocke.splice(i + 1, 0, sred); izbranaTocka = i + 1; samodejnoShrani(); osveziZemljevid(); osveziLastnosti(); });
                sloj.addLayer(r);
            })(i);
        }
    }

    function osveziZemljevid() { narisi(skica(), sloj, map, true); narisiRocice(); osveziLegendo(); }

    // ---------- načrti na spletu (list Nacrti v tabeli EPV) ----------
    function spletStanje(besedilo, napaka) {
        const el = $('splet-stanje');
        el.textContent = besedilo || '';
        el.classList.toggle('napaka', !!napaka);
    }
    function spletNapaka(o) {
        if (o.omrezje) return 'Ni povezave s strežnikom EPV.';
        if (/Neznana akcija/i.test(o.message || '')) return 'Strežniška skripta še ne podpira načrtov na spletu (posodobi skripto, glej README).';
        return o.message || 'Napaka na strežniku.';
    }
    function spletOdgovor(o) {
        // geslo ni (več) veljavno: nazaj na prijavo
        if (o.status !== 'success' && !o.omrezje && /gesl/i.test(o.message || '')) { if (window.EPVPrijava) window.EPVPrijava.pobrisi(); spletPokaziPrijavo(true); }
        return o;
    }
    function spletPosljiNacrt(naziv, vsebina) {
        // text/plain: Apps Script POST brez predhodne (preflight) zahteve
        const zacetek = Date.now();
        return fetch(window.GOOGLE_APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ akcija: 'shraniNacrt', geslo: window.EPVPrijava.geslo(), naziv: naziv, vsebina: vsebina }) })
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; })
            .then(function (o) {
                if (o) return spletOdgovor(o);
                // Odgovora ni bilo mogoče prebrati (brskalnik ali preusmeritev): preverimo na seznamu, ali je načrt res zapisan.
                return ziveKlic({ akcija: 'seznamNacrtov' }).then(spletOdgovor).then(function (s) {
                    if (s.status !== 'success') return s;
                    const zapis = (s.data || []).find(function (d) { return d.naziv === naziv; });
                    return zapis && Date.parse(zapis.spremenjeno) >= zacetek - 120000 ? { status: 'success' } : { status: 'error', message: 'Shranjevanje ni potrjeno – poskusi znova.' };
                });
            });
    }
    function spletPokaziPrijavo(da) {
        $('splet-prijava').style.display = da ? 'flex' : 'none';
        $('splet-vsebina').style.display = da ? 'none' : '';
    }
    let spletNazivi = [];
    function spletOsvezi() {
        spletPokaziPrijavo(false);
        spletStanje('Berem seznam …');
        return ziveKlic({ akcija: 'seznamNacrtov' }).then(spletOdgovor).then(function (o) {
            if (o.status !== 'success') { spletStanje(spletNapaka(o), true); return; }
            const seznam = o.data || [];
            spletNazivi = seznam.map(function (d) { return d.naziv; });
            $('splet-seznam').innerHTML = seznam.map(function (d, i) {
                const cas = d.spremenjeno ? new Date(d.spremenjeno).toLocaleString('sl-SI', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Ljubljana' }) : '';
                return '<div class="splet-vrstica"><div class="splet-ime">' + esc(d.naziv) + '<small>' + esc(cas) + ' · ' + Math.max(1, Math.round((d.znakov || 0) / 1024)) + ' kB</small></div>' +
                    '<button type="button" class="splet-odpri" data-i="' + i + '">📂 Odpri</button><button type="button" class="splet-brisi nevaren" data-i="' + i + '" title="Izbriši s spleta">🗑</button></div>';
            }).join('');
            spletStanje(seznam.length ? '' : 'Na spletu še ni shranjenih načrtov.');
        });
    }
    function spletShrani() {
        const naziv = String(nacrt.naziv || '').trim();
        if (!naziv || naziv === 'Načrt' || naziv === 'Nov načrt') { spletStanje('Najprej vpiši naziv vaje ali intervencije (zgoraj levo) – pod tem imenom se načrt shrani.', true); return; }
        if (spletNazivi.indexOf(naziv) >= 0 && !window.confirm('Načrt »' + naziv + '« je na spletu že shranjen. Ga zamenjam s trenutnim?')) return;
        spletStanje('Shranjujem …');
        spletPosljiNacrt(naziv, JSON.stringify(nacrtZaShranjevanje())).then(function (o) {
            if (o.status !== 'success') { spletStanje(spletNapaka(o), true); return; }
            spletOsvezi().then(function () { spletStanje('Shranjeno na splet: ' + naziv + ' (' + new Date().toLocaleTimeString('sl-SI') + ').'); });
        });
    }
    function spletPripravi() {
        $('btn-splet').addEventListener('click', function () {
            $('splet-okno').style.display = 'flex';
            spletStanje('');
            if (!window.GOOGLE_APPS_SCRIPT_URL || !window.EPVPrijava) { spletPokaziPrijavo(false); spletStanje('Povezava z EPV tukaj ni na voljo.', true); return; }
            if (window.EPVPrijava.geslo()) spletOsvezi();
            else { spletPokaziPrijavo(true); spletStanje('Vpiši geslo EPV (enako kot v štabu).'); }
        });
        $('btn-splet-zapri').addEventListener('click', function () { $('splet-okno').style.display = 'none'; });
        const prijava = function () {
            const g = $('splet-geslo').value.trim();
            if (!g) return;
            spletStanje('Preverjam geslo …');
            window.EPVPrijava.preveri(g).then(function (r) {
                if (r.ok) { window.EPVPrijava.nastavi(g); $('splet-geslo').value = ''; spletOsvezi(); }
                else spletStanje(r.omrezje ? 'Ni povezave s strežnikom EPV.' : 'Napačno geslo.', true);
            });
        };
        $('btn-splet-prijava').addEventListener('click', prijava);
        $('splet-geslo').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') prijava(); });
        $('btn-splet-osvezi').addEventListener('click', spletOsvezi);
        $('btn-splet-shrani').addEventListener('click', spletShrani);
        $('splet-seznam').addEventListener('click', function (ev) {
            const gumb = ev.target.closest('button');
            if (!gumb) return;
            const naziv = spletNazivi[parseInt(gumb.dataset.i, 10)];
            if (naziv === undefined) return;
            if (gumb.classList.contains('splet-odpri')) {
                if (!window.confirm('Odprem načrt »' + naziv + '«? Trenutni načrt na zaslonu bo zamenjan (vrneš ga z ↩️ Razveljavi).')) return;
                spletStanje('Odpiram …');
                ziveKlic({ akcija: 'pridobiNacrt', naziv: naziv }).then(spletOdgovor).then(function (o) {
                    if (o.status !== 'success') { spletStanje(spletNapaka(o), true); return; }
                    if (nalozi(o.vsebina)) $('splet-okno').style.display = 'none';
                });
            } else if (gumb.classList.contains('splet-brisi')) {
                if (!window.confirm('Izbrišem načrt »' + naziv + '« s spleta? Tega ni mogoče razveljaviti.')) return;
                ziveKlic({ akcija: 'izbrisiNacrt', naziv: naziv }).then(spletOdgovor).then(function (o) {
                    if (o.status !== 'success') { spletStanje(spletNapaka(o), true); return; }
                    spletOsvezi();
                });
            }
        });
    }

    // ---------- smeri neba ----------
    // Zemljevid je vedno obrnjen proti severu, zato je vetrovnica stalna slika v kotu skice (zaslon in izpis).
    function htmlSevera() {
        return '<svg class="nacrt-sever" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Smeri neba: sever je zgoraj">' +
            '<circle cx="32" cy="34" r="22" fill="rgba(255,255,255,.92)" stroke="#111" stroke-width="1.5"/>' +
            '<path d="M32 13 L38 34 L32 31 L26 34 Z" fill="#dc2626" stroke="#111" stroke-width="1"/>' +
            '<path d="M32 55 L38 34 L32 37 L26 34 Z" fill="#fff" stroke="#111" stroke-width="1"/>' +
            '<g font-family="Arial, sans-serif" font-weight="bold" fill="#111" text-anchor="middle">' +
            '<text x="32" y="10" font-size="12">S</text>' +
            '<text x="50" y="37" font-size="8">V</text><text x="14" y="37" font-size="8">Z</text><text x="32" y="63.5" font-size="8">J</text></g></svg>';
    }
    function osveziSever() {
        const el = $('sever');
        const viden = !!(nacrt && nacrt.sever);
        el.style.display = viden ? '' : 'none';
        el.innerHTML = viden ? htmlSevera() : '';
        $('sever-viden').checked = viden;
    }

    // ---------- naslov in koordinate kliknjene točke ----------
    const pin = { oznaka: null, lat: null, lon: null, besedilo: '', naslov: '', zahteva: 0 };

    function pinKoordinate(lat, lon) {
        const K = window.EPVKoordinate;
        let vrstice = 'WGS84: ' + lat.toFixed(6) + ', ' + lon.toFixed(6);
        if (K) {
            const d = K.d96Naprej(lat, lon);
            if (d && isFinite(d.E) && isFinite(d.N)) vrstice += '\nD96/TM: E ' + Math.round(d.E) + ' N ' + Math.round(d.N);
        }
        return vrstice;
    }
    /** Iz odgovora storitve sestavi kratek naslov: "Ulica 12, 2310 Slovenska Bistrica" (+ ime objekta). */
    function pinNaslovIzOdgovora(o) {
        const a = (o && o.address) || {};
        const cesta = a.road || a.pedestrian || a.footway || a.path || '';
        const kraj = a.city || a.town || a.village || a.hamlet || a.suburb || a.municipality || '';
        const prvi = cesta ? (cesta + (a.house_number ? ' ' + a.house_number : '')) : (a.house_number ? ((a.hamlet || a.village || kraj) + ' ' + a.house_number) : '');
        const drugi = [a.postcode, kraj].filter(Boolean).join(' ');
        const naslov = [prvi, drugi].filter(Boolean).join(', ');
        const ime = o && o.name && o.name !== cesta ? String(o.name) : '';
        return { naslov: naslov, ime: ime, hisna: !!a.house_number };
    }
    function pinPokazi(lat, lon) {
        const K = window.EPVKoordinate;
        pin.lat = lat; pin.lon = lon; pin.naslov = '';
        const zahteva = ++pin.zahteva;
        if (pin.oznaka) map.removeLayer(pin.oznaka);
        pin.oznaka = L.marker([lat, lon], { interactive: false, zIndexOffset: 95000000, icon: L.divIcon({ className: 'nacrt-ikona', html: '<div class="pin-tocka"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(map);
        const koord = pinKoordinate(lat, lon);
        $('pin-koordinate').textContent = koord;
        $('pin-naslov').textContent = 'Iščem naslov …';
        pin.besedilo = koord;
        $('pin-okno').style.display = '';
        const naslovUrl = (window.EPV_NASLOV_URL || 'https://nominatim.openstreetmap.org/reverse') + '?format=jsonv2&zoom=18&addressdetails=1&accept-language=sl&lat=' + lat.toFixed(6) + '&lon=' + lon.toFixed(6);
        fetch(naslovUrl, { headers: { Accept: 'application/json' } })
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; })
            .then(function (o) {
                if (zahteva !== pin.zahteva) return; // medtem je bila kliknjena druga točka
                const el = $('pin-naslov');
                if (!o || o.error || !o.address) { el.textContent = 'Naslova ni bilo mogoče dobiti (ni interneta ali tu ni podatka).'; return; }
                const n = pinNaslovIzOdgovora(o);
                if (!n.naslov && !n.ime) { el.textContent = 'Za to mesto ni naslova.'; return; }
                const oLat = parseFloat(o.lat), oLon = parseFloat(o.lon);
                const razdalja = K && isFinite(oLat) && isFinite(oLon) ? K.razdaljaM(lat, lon, oLat, oLon) : null;
                pin.naslov = [n.ime, n.naslov].filter(Boolean).join(', ');
                el.innerHTML = esc(pin.naslov) + '<small>' + (n.hisna ? 'najbližji naslov' : 'brez hišne številke – najbližja cesta ali kraj') + (razdalja !== null ? ', ' + esc(K.oblikujRazdaljo(razdalja)) + ' od točke' : '') + ' · vir: OpenStreetMap</small>';
                pin.besedilo = pin.naslov + '\n' + koord;
            });
    }
    function pinZapri() {
        pin.zahteva++;
        if (pin.oznaka) { map.removeLayer(pin.oznaka); pin.oznaka = null; }
        $('pin-okno').style.display = 'none';
    }
    function pinPripravi() {
        $('btn-pin').addEventListener('click', function () { nastaviOrodje(orodje && orodje.vrsta === 'pin' ? null : { kljuc: 'pin', vrsta: 'pin' }); });
        $('btn-pin-zapri').addEventListener('click', pinZapri);
        $('btn-pin-kopiraj').addEventListener('click', function () {
            const b = $('btn-pin-kopiraj');
            const uspeh = function () { b.textContent = '✔ Kopirano'; setTimeout(function () { b.textContent = '📋 Kopiraj'; }, 1500); };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(pin.besedilo).then(uspeh, function () { window.prompt('Kopiraj besedilo:', pin.besedilo); });
            else window.prompt('Kopiraj besedilo:', pin.besedilo);
        });
        $('btn-pin-napis').addEventListener('click', function () {
            if (pin.lat === null) return;
            zapomni();
            const e = { id: M.novId('e'), vrsta: 'besedilo', lat: pin.lat, lon: pin.lon, opis: pin.naslov || ('' + pin.lat.toFixed(6) + ', ' + pin.lon.toFixed(6)) };
            skica().elementi.push(e);
            pinZapri();
            izbranId = e.id;
            samodejnoShrani(); osveziVse(false);
        });
    }

    // ---------- žive enote s terena (EPV) ----------
    // Tabla po potrebi prebere pozicije enot izbranega dogodka iz iste skripte kot štab in jih pokaže čez načrt.
    // Niso del načrta: ne shranijo se v datoteko in jih ni v izpisu.
    const ZIVE_INTERVAL_MS = 15000, ZIVE_STARO_MS = 3 * 60000;
    const zive = { vklop: false, dogodek: '', kazalec: 0, enote: {}, casovnik: null, sloj: null, poteka: false };

    function ziveStanje(besedilo, napaka) {
        const el = $('zive-stanje');
        if (!el) return;
        el.textContent = besedilo;
        el.classList.toggle('napaka', !!napaka);
    }
    function ziveKlic(parametri) {
        const P = window.EPVPrijava;
        const vsi = Object.assign({ geslo: P ? P.geslo() : '' }, parametri);
        const niz = Object.keys(vsi).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(String(vsi[k])); }).join('&');
        return fetch(window.GOOGLE_APPS_SCRIPT_URL + '?' + niz, { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : { status: 'error', omrezje: true }; })
            .catch(function () { return { status: 'error', omrezje: true }; });
    }
    function ziveNarisi() {
        if (!zive.sloj) return;
        zive.sloj.clearLayers();
        const zdaj = Date.now();
        Object.keys(zive.enote).forEach(function (k) {
            const e = zive.enote[k];
            const stara = zdaj - e.ms > ZIVE_STARO_MS;
            const ura = new Date(e.ms).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Ljubljana' });
            const m = L.marker([e.lat, e.lon], { interactive: false, zIndexOffset: 50000000, icon: L.divIcon({ className: 'nacrt-ikona', html: '<div class="nze' + (stara ? ' stara' : '') + '"><span class="nze-pika"></span><span class="nze-napis">' + esc(e.ime) + ' · ' + ura + '</span></div>', iconSize: [26, 26], iconAnchor: [13, 13] }) });
            m.zivaEnota = e.ime;
            zive.sloj.addLayer(m);
        });
    }
    function ziveOsvezi() {
        if (!zive.vklop || !zive.dogodek || zive.poteka) return Promise.resolve();
        zive.poteka = true;
        const dogodek = zive.dogodek;
        return ziveKlic({ akcija: 'pridobiLokacije', dogodek: dogodek, kazalec: zive.kazalec }).then(function (o) {
            zive.poteka = false;
            if (dogodek !== zive.dogodek || !zive.vklop) return;
            if (o.omrezje) { ziveStanje('Ni povezave z EPV - poskusim znova.', true); return; }
            if (o.status !== 'success') {
                if (/gesl/i.test(o.message || '')) { if (window.EPVPrijava) window.EPVPrijava.pobrisi(); zivePrikaziPrijavo(true); ziveStanje('Geslo EPV ni več veljavno - prijavi se znova.', true); zivePocakaj(false); }
                else ziveStanje('EPV: ' + (o.message || 'napaka'), true);
                return;
            }
            (o.data || []).forEach(function (r) {
                const deli = String(r.enota || '').split(':');
                if ((deli[0] || '').toUpperCase() === 'SISTEM') return;
                const ime = (deli[1] || r.enota || '').trim();
                const lat = parseFloat(r.lat), lon = parseFloat(r.lon), ms = Date.parse(r.cas);
                if (!ime || !isFinite(lat) || !isFinite(lon)) return;
                const k = ime.toLowerCase();
                if (!zive.enote[k] || !(ms < zive.enote[k].ms)) zive.enote[k] = { ime: ime, lat: lat, lon: lon, ms: isFinite(ms) ? ms : Date.now() };
            });
            if (typeof o.kazalec === 'number') zive.kazalec = o.kazalec;
            ziveNarisi();
            const n = Object.keys(zive.enote).length;
            const aktivnih = Object.keys(zive.enote).filter(function (k) { return Date.now() - zive.enote[k].ms <= ZIVE_STARO_MS; }).length;
            ziveStanje(n ? 'Enot: ' + n + ' (oddaja: ' + aktivnih + ') · osveženo ' + new Date().toLocaleTimeString('sl-SI') : 'Za ta dogodek še ni pozicij.', false);
        });
    }
    function zivePocakaj(tece) {
        if (zive.casovnik) { clearInterval(zive.casovnik); zive.casovnik = null; }
        if (tece) zive.casovnik = setInterval(ziveOsvezi, ZIVE_INTERVAL_MS);
    }
    function zivePrikaziPrijavo(da) {
        $('zive-prijava').style.display = da ? 'flex' : 'none';
        $('zive-dogodek').style.display = da ? 'none' : '';
    }
    function ziveIzberiDogodek(ime) {
        zive.dogodek = ime || '';
        zive.kazalec = 0; zive.enote = {};
        ziveNarisi();
        if (!zive.dogodek) { ziveStanje('Izberi dogodek.', false); zivePocakaj(false); return; }
        ziveStanje('Berem pozicije …', false);
        zivePocakaj(true);
        ziveOsvezi();
    }
    function ziveNaloziDogodke() {
        zivePrikaziPrijavo(false);
        ziveStanje('Berem seznam dogodkov …', false);
        return ziveKlic({ akcija: 'pridobiSeznamDogodkov', oblika: 'objekt' }).then(function (o) {
            if (!zive.vklop) return;
            if (o.omrezje) { ziveStanje('Ni povezave z EPV.', true); return; }
            if (o.status !== 'success') { if (window.EPVPrijava) window.EPVPrijava.pobrisi(); zivePrikaziPrijavo(true); ziveStanje(/gesl/i.test(o.message || '') ? 'Napačno geslo.' : 'EPV: ' + (o.message || 'napaka'), true); return; }
            const seznam = (o.data || []).map(function (d) { return typeof d === 'string' ? { ime: d, zadnji: null } : d; })
                .sort(function (a, b) { return (Date.parse(b.zadnji) || 0) - (Date.parse(a.zadnji) || 0); });
            const izbira = $('zive-dogodek');
            const zeljen = zive.dogodek || new URLSearchParams(window.location.search).get('naziv') || '';
            izbira.innerHTML = '<option value="">- izberi dogodek -</option>' + seznam.map(function (d) { return '<option value="' + esc(d.ime) + '">' + esc(d.ime) + '</option>'; }).join('');
            const ujemanje = seznam.find(function (d) { return d.ime === zeljen; });
            izbira.value = ujemanje ? ujemanje.ime : '';
            ziveIzberiDogodek(izbira.value);
        });
    }
    function ziveVklopi(da) {
        zive.vklop = da;
        $('zive-nastavitve').style.display = da ? '' : 'none';
        if (!da) { zivePocakaj(false); zive.enote = {}; zive.kazalec = 0; ziveNarisi(); ziveStanje('Pozicije se berejo iz EPV po potrebi; niso del načrta in se ne shranijo ali natisnejo.', false); return; }
        if (!window.GOOGLE_APPS_SCRIPT_URL || !window.EPVPrijava) { ziveStanje('Povezava z EPV tukaj ni na voljo.', true); return; }
        if (window.EPVPrijava.geslo()) ziveNaloziDogodke();
        else { zivePrikaziPrijavo(true); ziveStanje('Vpiši geslo EPV (enako kot v štabu).', false); }
    }
    function zivePripravi() {
        zive.sloj = L.layerGroup().addTo(map);
        $('zive-vklop').addEventListener('change', function () { ziveVklopi($('zive-vklop').checked); });
        const prijava = function () {
            const g = $('zive-geslo').value.trim();
            if (!g) return;
            ziveStanje('Preverjam geslo …', false);
            window.EPVPrijava.preveri(g).then(function (r) {
                if (r.ok) { window.EPVPrijava.nastavi(g); $('zive-geslo').value = ''; ziveNaloziDogodke(); }
                else ziveStanje(r.omrezje ? 'Ni povezave z EPV.' : 'Napačno geslo.', true);
            });
        };
        $('btn-zive-prijava').addEventListener('click', prijava);
        $('zive-geslo').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') prijava(); });
        $('zive-dogodek').addEventListener('change', function () { ziveIzberiDogodek($('zive-dogodek').value); });
        $('btn-zive-osvezi').addEventListener('click', function () { ziveOsvezi(); });
        $('btn-zive-pokazi').addEventListener('click', function () {
            const t = Object.keys(zive.enote).map(function (k) { return [zive.enote[k].lat, zive.enote[k].lon]; });
            if (t.length === 1) map.setView(t[0], Math.max(map.getZoom(), 16));
            else if (t.length > 1) map.fitBounds(t, { padding: [60, 60], maxZoom: 18 });
        });
    }

    // ---------- stalna osnova: območje zveze in gasilski domovi ----------
    function shraniOsnovo() {
        try { localStorage.setItem(KLJUC_OSNOVA, JSON.stringify(osnova)); localStorage.setItem(KLJUC_OSNOVA_VIDNA, osnovaVidna ? '1' : '0'); } catch (e) { /* nedostopen pomnilnik */ }
    }
    function narisiOsnovo(cilj, interaktivno) {
        cilj.clearLayers();
        if (!osnovaVidna) return;
        osnova.obrisi.forEach(function (b) {
            cilj.addLayer(L.polyline(b.zaprto ? b.tocke.concat([b.tocke[0]]) : b.tocke, { color: '#0f172a', weight: 6, opacity: 0.8, interactive: false }));
            cilj.addLayer(L.polyline(b.zaprto ? b.tocke.concat([b.tocke[0]]) : b.tocke, { color: '#f59e0b', weight: 3, dashArray: '10,7', opacity: 1, interactive: false }));
        });
        osnova.tocke.forEach(function (t) {
            const m = L.marker([t.lat, t.lon], { zIndexOffset: 100, icon: L.divIcon({ className: 'nacrt-ikona', html: '<div class="nd"><span class="nd-znak">🏠</span>' + (t.naziv ? '<span class="nd-napis">' + esc(t.naziv) + '</span>' : '') + '</div>', iconSize: [30, 30], iconAnchor: [15, 15] }) });
            m.osnovaDom = t.naziv;
            // klik na dom med risanjem (npr. dovoz od PGD) postavi točko natanko na dom
            if (interaktivno) m.on('click', function () { if (orodje) postavi(t.lat, t.lon); });
            cilj.addLayer(m);
        });
    }
    function osveziOsnovo() {
        if (slojOsnove) narisiOsnovo(slojOsnove, true);
        const chk = $('osnova-vidna');
        if (chk) chk.checked = osnovaVidna;
        const st = $('osnova-stanje');
        if (st) st.textContent = 'Domov: ' + osnova.tocke.length + ' · obrisov: ' + osnova.obrisi.length;
        const seznam = $('osnova-seznam');
        if (seznam) {
            seznam.innerHTML = (osnova.tocke.map(function (t, i) { return '<div class="os-vrstica"><span>🏠 ' + esc(t.naziv || '(brez imena)') + '</span><button type="button" data-os-tocka="' + i + '">🗑</button></div>'; }).join('') +
                osnova.obrisi.map(function (b, i) { return '<div class="os-vrstica"><span>▱ ' + esc(b.naziv || 'Obris') + ' (' + b.tocke.length + ' točk)</span><button type="button" data-os-obris="' + i + '">🗑</button></div>'; }).join('')) || '<div class="namig">Še ni vnosov. Uvozi KML/KMZ iz Google Earth ali dodaj domove s klikom na zemljevid.</div>';
            Array.prototype.forEach.call(seznam.querySelectorAll('[data-os-tocka]'), function (b) { b.addEventListener('click', function () { osnova.tocke.splice(parseInt(b.dataset.osTocka, 10), 1); shraniOsnovo(); osveziOsnovo(); osveziLegendo(); }); });
            Array.prototype.forEach.call(seznam.querySelectorAll('[data-os-obris]'), function (b) { b.addEventListener('click', function () { osnova.obrisi.splice(parseInt(b.dataset.osObris, 10), 1); shraniOsnovo(); osveziOsnovo(); osveziLegendo(); }); });
        }
    }

    /** KML (besedilo) -> { tocke, obrisi }. Točke postanejo gasilski domovi, poligoni in črte obrisi. */
    function osnovaIzKml(besedilo) {
        const dok = new DOMParser().parseFromString(besedilo, 'text/xml');
        if (dok.getElementsByTagName('parsererror').length) throw new Error('Datoteka ni veljaven KML.');
        const prvi = function (el, ime) { const n = el.getElementsByTagName(ime); return n.length ? n[0] : null; };
        const izhod = { tocke: [], obrisi: [] };
        Array.prototype.forEach.call(dok.getElementsByTagName('Placemark'), function (pm) {
            const imeEl = prvi(pm, 'name');
            const naziv = imeEl ? imeEl.textContent.trim() : '';
            Array.prototype.forEach.call(pm.getElementsByTagName('Point'), function (pt) {
                const k = M.kmlKoordinate((prvi(pt, 'coordinates') || {}).textContent);
                if (k.length) izhod.tocke.push({ naziv: naziv, lat: k[0][0], lon: k[0][1] });
            });
            Array.prototype.forEach.call(pm.getElementsByTagName('Polygon'), function (pg) {
                const zunanji = prvi(pg, 'outerBoundaryIs') || pg;
                const k = M.kmlKoordinate((prvi(zunanji, 'coordinates') || {}).textContent);
                if (k.length >= 3) izhod.obrisi.push({ naziv: naziv, tocke: k, zaprto: true });
            });
            Array.prototype.forEach.call(pm.getElementsByTagName('LineString'), function (ls) {
                const k = M.kmlKoordinate((prvi(ls, 'coordinates') || {}).textContent);
                if (k.length >= 2) izhod.obrisi.push({ naziv: naziv, tocke: k, zaprto: false });
            });
        });
        return M.ocistiOsnovo(izhod);
    }

    /** KMZ je arhiv ZIP: poišče prvo datoteko .kml in jo razširi (brez dodatnih knjižnic). */
    function kmlIzKmz(buf) {
        const dv = new DataView(buf);
        let eocd = -1;
        for (let i = buf.byteLength - 22; i >= 0 && i > buf.byteLength - 70000; i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
        if (eocd < 0) return Promise.reject(new Error('Datoteka ni veljaven KMZ.'));
        const stevilo = dv.getUint16(eocd + 10, true);
        let poz = dv.getUint32(eocd + 16, true);
        const dekoder = new TextDecoder('utf-8');
        for (let n = 0; n < stevilo && poz + 46 <= buf.byteLength; n++) {
            if (dv.getUint32(poz, true) !== 0x02014b50) break;
            const metoda = dv.getUint16(poz + 10, true), stisnjeno = dv.getUint32(poz + 20, true);
            const dIme = dv.getUint16(poz + 28, true), dDod = dv.getUint16(poz + 30, true), dKom = dv.getUint16(poz + 32, true), lokalno = dv.getUint32(poz + 42, true);
            const ime = dekoder.decode(new Uint8Array(buf, poz + 46, dIme));
            if (/\.kml$/i.test(ime)) {
                const zacetek = lokalno + 30 + dv.getUint16(lokalno + 26, true) + dv.getUint16(lokalno + 28, true);
                const bajti = new Uint8Array(buf, zacetek, stisnjeno);
                if (metoda === 0) return Promise.resolve(dekoder.decode(bajti));
                if (metoda !== 8 || typeof DecompressionStream === 'undefined') return Promise.reject(new Error('Tega KMZ brskalnik ne zna odpreti. V Google Earth izvozi kot KML.'));
                return new Response(new Blob([bajti]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
            }
            poz += 46 + dIme + dDod + dKom;
        }
        return Promise.reject(new Error('V datoteki KMZ ni datoteke KML.'));
    }

    function uvoziOsnovoIzDatoteke(f) {
        const stanje = $('osnova-uvoz-stanje');
        const koncaj = function (besedilo) {
            const nova = osnovaIzKml(besedilo);
            if (!nova.tocke.length && !nova.obrisi.length) throw new Error('V datoteki ni točk ali območij.');
            // združi z obstoječim: enaka točka (ime in lega) se ne podvoji
            nova.tocke.forEach(function (t) { if (!osnova.tocke.some(function (x) { return x.naziv === t.naziv && Math.abs(x.lat - t.lat) < 1e-6 && Math.abs(x.lon - t.lon) < 1e-6; })) osnova.tocke.push(t); });
            nova.obrisi.forEach(function (b) { if (!osnova.obrisi.some(function (x) { return x.naziv === b.naziv && x.tocke.length === b.tocke.length; })) osnova.obrisi.push(b); });
            osnovaVidna = true;
            shraniOsnovo(); osveziOsnovo(); osveziLegendo();
            if (stanje) stanje.textContent = '✔ Uvoženo: domov ' + nova.tocke.length + ', obrisov ' + nova.obrisi.length + '.';
        };
        const napaka = function (err) { if (stanje) stanje.textContent = '⚠️ ' + (err && err.message ? err.message : 'Uvoz ni uspel.'); };
        const br = new FileReader();
        br.onerror = function () { napaka(new Error('Datoteke ni mogoče prebrati.')); };
        br.onload = function () {
            const buf = br.result, dv = new DataView(buf);
            const jeZip = buf.byteLength > 4 && dv.getUint32(0, true) === 0x04034b50;
            Promise.resolve(jeZip ? kmlIzKmz(buf) : new TextDecoder('utf-8').decode(new Uint8Array(buf))).then(koncaj).catch(napaka);
        };
        br.readAsArrayBuffer(f);
    }

    // ---------- paleta ----------
    function gumbPalete(html, podatki, naslov) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'pal'; b.innerHTML = html; b.title = naslov || '';
        b.draggable = true;
        b.addEventListener('click', function () { nastaviOrodje(orodje && orodje.kljuc === podatki.kljuc ? null : podatki, b); });
        b.addEventListener('dragstart', function (ev) {
            if (podatki.vrsta === 'crta' || podatki.vrsta === 'obmocje') { ev.preventDefault(); return; }
            nastaviOrodje(podatki, b);
            try { ev.dataTransfer.setData('text/plain', podatki.kljuc); } catch (e) { /* ni podprto */ }
        });
        b.dataset.kljuc = podatki.kljuc;
        return b;
    }
    function zgradiPaleto() {
        const sel = $('drustvo');
        sel.innerHTML = M.DRUSTVA.map(function (d) { return '<option value="' + esc(d[0]) + '">' + esc(d[0] + ' - ' + d[1]) + '</option>'; }).join('');
        M.TIPI_VOZIL.forEach(function (v) {
            $('pal-vozila').appendChild(gumbPalete('<svg viewBox="0 0 56 56">' + svgVozila(v.oblika, 'gasilci', { cisterna: M.jeCisterna({ tip: v.tip, sluzba: 'gasilci' }), kolesa: M.steviloKoles(v.tip) }) + '</svg>' + esc(v.tip), { kljuc: 'v:' + v.tip, vrsta: 'vozilo', tip: v.tip, oblika: v.oblika, sluzba: 'gasilci' }, v.opis));
        });
        $('pal-vozila').appendChild(gumbPalete('<svg viewBox="0 0 56 56">' + svgVozila('tovorno', 'gasilci') + '</svg>Drugo…', { kljuc: 'v:rocno', vrsta: 'vozilo', tip: '', oblika: 'tovorno', sluzba: 'gasilci', rocno: true }, 'Posebno vozilo od drugod - tip in kratico vpišeš ročno'));
        Object.keys(M.VOZILA_SLUZB).forEach(function (k) {
            const v = M.VOZILA_SLUZB[k];
            $('pal-sluzbe').appendChild(gumbPalete('<svg viewBox="0 0 56 56">' + svgVozila(v.oblika, k) + '</svg>' + esc(v.tip) + '<small>' + esc(M.SLUZBE[k].naziv) + '</small>', { kljuc: 's:' + k, vrsta: 'vozilo', tip: v.tip, oblika: v.oblika, sluzba: k }, M.SLUZBE[k].naziv));
        });
        Object.keys(M.ZNAKI).forEach(function (k) {
            const z = M.ZNAKI[k];
            $('pal-znaki').appendChild(gumbPalete('<span class="pal-znak" style="background:' + z.barva + ';' + (z.krog ? 'border-radius:50%;' : '') + (z.prazen ? 'border:2px dashed #fff;' : '') + '">' + esc(z.znak) + '</span><small>' + esc(z.naziv) + '</small>', { kljuc: 'z:' + k, vrsta: 'znak', znak: k }, z.naziv));
        });
        Object.keys(M.CRTE).forEach(function (k) {
            const c = M.CRTE[k];
            $('pal-crte').appendChild(gumbPalete('<span class="pal-crta" style="border-top-color:' + c.barva + ';' + (c.crtkano ? 'border-top-style:dashed;' : '') + '"></span>' + esc(c.naziv), { kljuc: 'c:' + k, vrsta: 'crta', slog: k }, c.naziv));
        });
        $('pal-crte').appendChild(gumbPalete('<span class="pal-znak" style="background:rgba(239,68,68,.35);border:2px solid #ef4444;">▱</span>Sektor', { kljuc: 'o:sektor', vrsta: 'obmocje' }, 'Sektor: tapkaj oglišča, nato Končaj'));
        $('pal-crte').appendChild(gumbPalete('<span class="pal-znak" style="background:rgba(220,38,38,.3);border:2px dashed #dc2626;border-radius:50%;">!</span>Nevarno območje', { kljuc: 'k:krog', vrsta: 'krog' }, 'Krog z nastavljivim polmerom'));
        $('pal-crte').appendChild(gumbPalete('<span class="pal-znak" style="background:#fef9c3;color:#1f2937;">Aa</span>Besedilo', { kljuc: 'b:besedilo', vrsta: 'besedilo' }, 'Napis na zemljevidu'));
    }

    function nastaviOrodje(novo) {
        if (risanje) { if (risanje.predogled) sloj.removeLayer(risanje.predogled); risanje = null; }
        orodje = novo;
        Array.prototype.forEach.call(document.querySelectorAll('.pal'), function (b) { b.classList.toggle('aktiven', !!novo && b.dataset.kljuc === novo.kljuc); });
        const pasica = $('orodje-pasica');
        if (!novo) { pasica.style.display = 'none'; return; }
        const vecTock = novo.vrsta === 'crta' || novo.vrsta === 'obmocje';
        $('orodje-besedilo').textContent = novo.vrsta === 'pin' ? 'Tapni objekt ali mesto na zemljevidu za naslov in koordinate' : vecTock ? 'Tapkaj točke na zemljevidu, nato »Končaj«' : 'Tapni na zemljevid, kamor naj se postavi';
        $('btn-koncaj').style.display = vecTock ? '' : 'none';
        pasica.style.display = 'flex';
        if (vecTock) risanje = { tocke: [], predogled: null };
    }

    function kraticaZaNovo() {
        const rocno = $('drustvo-rocno').value.trim().toUpperCase();
        return rocno || $('drustvo').value;
    }

    function postavi(lat, lon) {
        if (!orodje) return;
        const o = orodje;
        if (o.vrsta === 'pin') { nastaviOrodje(null); pinPokazi(lat, lon); return; }
        if (o.vrsta === 'osnovaDom') {
            const zeIma = osnova.tocke.map(function (t) { return t.naziv; });
            const predlog = (M.DRUSTVA.filter(function (d) { return zeIma.indexOf(d[1]) < 0; })[0] || ['', ''])[1];
            const naziv = window.prompt('Ime gasilskega doma / društva:', predlog);
            nastaviOrodje(null);
            if (naziv === null) return;
            osnova.tocke.push({ naziv: naziv.trim(), lat: lat, lon: lon });
            osnovaVidna = true;
            shraniOsnovo(); osveziOsnovo(); osveziLegendo();
            return;
        }
        if (o.vrsta === 'crta' || o.vrsta === 'obmocje') {
            risanje.tocke.push([lat, lon]);
            if (risanje.predogled) sloj.removeLayer(risanje.predogled);
            risanje.predogled = L.polyline(risanje.tocke.length > 1 ? risanje.tocke : [risanje.tocke[0], risanje.tocke[0]], { color: '#fde047', weight: 4, dashArray: '4,6' });
            sloj.addLayer(risanje.predogled);
            $('orodje-besedilo').textContent = 'Točk: ' + risanje.tocke.length + ' - tapkaj naprej ali »Končaj«';
            return;
        }
        zapomni();
        const e = { id: M.novId('e'), vrsta: o.vrsta, lat: lat, lon: lon };
        if (o.vrsta === 'vozilo') {
            e.tip = o.tip; e.oblika = o.oblika; e.sluzba = o.sluzba; e.kot = 0; e.opis = '';
            e.kratica = (o.sluzba === 'gasilci' && !o.rocno) ? kraticaZaNovo() : (o.rocno ? $('drustvo-rocno').value.trim().toUpperCase() : '');
            e.st = M.naslednjaStevilka(skica());
        } else if (o.vrsta === 'znak') { e.znak = o.znak; e.kot = 0; e.opis = M.ZNAKI[o.znak].prazen ? 'Opis' : ''; }
        else if (o.vrsta === 'krog') { e.r = 50; e.opis = ''; }
        else if (o.vrsta === 'besedilo') { e.opis = 'Besedilo'; }
        skica().elementi.push(e);
        nastaviOrodje(null);
        izbranId = e.id;
        samodejnoShrani();
        osveziVse(false);
    }

    function koncajRisanje() {
        if (!orodje || !risanje) return;
        const min = orodje.vrsta === 'obmocje' ? 3 : 2;
        if (risanje.tocke.length < min) { $('orodje-besedilo').textContent = 'Potrebne so vsaj ' + min + ' točke.'; return; }
        zapomni();
        const e = { id: M.novId('e'), vrsta: orodje.vrsta, tocke: risanje.tocke.slice(), opis: '' };
        if (orodje.vrsta === 'crta') e.slog = orodje.slog;
        else {
            const st = skica().elementi.filter(function (x) { return x.vrsta === 'obmocje'; }).length;
            e.barva = M.BARVE_SEKTORJEV[st % M.BARVE_SEKTORJEV.length];
            e.opis = 'Sektor ' + (st + 1);
        }
        skica().elementi.push(e);
        nastaviOrodje(null);
        izbranId = e.id;
        samodejnoShrani();
        osveziVse(false);
    }

    // ---------- lastnosti izbranega elementa ----------
    function izberi(id) {
        if (id !== izbranId) izbranaTocka = -1;
        izbranId = id;
        osveziZemljevid();
        osveziLastnosti();
    }

    function polje(oznaka, kljuc, vrednost, dodatno) {
        return '<label>' + esc(oznaka) + '</label><input type="' + ((dodatno && dodatno.tip) || 'text') + '" data-k="' + kljuc + '" value="' + esc(vrednost) + '" autocomplete="off"' + ((dodatno && dodatno.atributi) || '') + '>';
    }

    function urejanjeTock(e, min) {
        const lahko = izbranaTocka >= 0 && izbranaTocka < e.tocke.length && e.tocke.length > min;
        return '<label>Točke (' + e.tocke.length + ')</label><div class="namig" style="margin-top:0;">Povleci belo točko za premik, tapni <b>+</b> za novo točko. Za odstranitev tapni točko (obarva se rumeno) in pritisni gumb.</div>' +
            '<button type="button" id="btn-tocka-odstrani" style="width:100%;margin-top:6px;"' + (lahko ? '' : ' disabled') + '>➖ Odstrani izbrano točko</button>';
    }

    function osveziLastnosti() {
        const el = $('lastnosti');
        const e = izbranId ? najdi(izbranId) : null;
        if (!e) {
            izbranId = null;
            el.innerHTML = '<div class="namig">Tapni element na zemljevidu, da ga urediš ali izbrišeš. Vozila in oznake premikaš z vlečenjem.</div>';
            return;
        }
        let h = '';
        const kot = '<label>Zasuk</label><div class="gumbi-kot"><button type="button" data-kot="-45">⟲ 45°</button><button type="button" data-kot="-15">⟲ 15°</button><button type="button" data-kot="15">15° ⟳</button><button type="button" data-kot="45">45° ⟳</button></div>';
        if (e.vrsta === 'vozilo') {
            h += polje('Zaporedna št. prihoda', 'st', e.st, { atributi: ' inputmode="numeric"' });
            h += polje('Kratica društva / enote', 'kratica', e.kratica, { atributi: ' list="dl-kratice" maxlength="10"' });
            h += '<datalist id="dl-kratice">' + M.DRUSTVA.map(function (d) { return '<option value="' + esc(d[0]) + '">' + esc(d[1]) + '</option>'; }).join('') + '</datalist>';
            h += polje('Tip vozila', 'tip', e.tip, { atributi: ' list="dl-tipi" maxlength="12"' });
            h += '<datalist id="dl-tipi">' + M.TIPI_VOZIL.map(function (v) { return '<option value="' + esc(v.tip) + '">'; }).join('') + '</datalist>';
            h += '<label>Služba (barva)</label><select data-k="sluzba">' + Object.keys(M.SLUZBE).map(function (k) { return '<option value="' + k + '"' + (k === e.sluzba ? ' selected' : '') + '>' + esc(M.SLUZBE[k].naziv) + '</option>'; }).join('') + '</select>';
            h += '<label>Posadka (voznik + število gasilcev)</label><div class="vrstica"><b style="white-space:nowrap;font-size:17px;">1 +</b><input type="number" data-k="posadka" min="0" max="60" step="1" inputmode="numeric" placeholder="npr. 5" value="' + esc(e.posadka === undefined || e.posadka === null ? '' : e.posadka) + '"></div>';
            h += polje('Naloga / opomba', 'opis', e.opis);
            h += kot;
            if (M.imaRoko(e.oblika || oblikaZaTip(e.tip, e.sluzba))) h += '<label>' + ((e.oblika || oblikaZaTip(e.tip, e.sluzba)) === 'lestev' ? 'Smer lestvenika' : 'Smer roke / dvigala') + '</label><div class="gumbi-kot"><button type="button" data-roka="-45">⟲ 45°</button><button type="button" data-roka="-15">⟲ 15°</button><button type="button" data-roka="15">15° ⟳</button><button type="button" data-roka="45">45° ⟳</button></div>';
        } else if (e.vrsta === 'znak') {
            h += '<div><b>' + esc(M.ZNAKI[e.znak].naziv) + '</b></div>' + polje('Napis', 'opis', e.opis);
            if (M.ZNAKI[e.znak].vrti) h += kot;
        } else if (e.vrsta === 'crta') {
            const trenutnaBarva = e.barva || M.CRTE[e.slog].barva;
            h += '<div><b>' + esc(M.CRTE[e.slog].naziv) + '</b></div>' + polje('Napis', 'opis', e.opis) +
                '<label>Barva črte</label><div class="barve">' + M.BARVE_CRT.map(function (b) { return '<button type="button" data-barva="' + b + '" class="' + (b === trenutnaBarva ? 'izbrana' : '') + '" style="background:' + b + '"></button>'; }).join('') + '</div>' + urejanjeTock(e, 2);
        } else if (e.vrsta === 'obmocje') {
            h += polje('Naziv sektorja', 'opis', e.opis) + '<label>Barva</label><div class="barve">' + M.BARVE_SEKTORJEV.map(function (b) { return '<button type="button" data-barva="' + b + '" class="' + (b === e.barva ? 'izbrana' : '') + '" style="background:' + b + '"></button>'; }).join('') + '</div>' + urejanjeTock(e, 3);
        } else if (e.vrsta === 'krog') {
            h += polje('Napis', 'opis', e.opis) + polje('Polmer (m)', 'r', e.r, { tip: 'number', atributi: ' min="5" step="5"' }) + '<div class="namig">Središče premakneš z vlečenjem ročice ✥ na zemljevidu.</div>';
        } else if (e.vrsta === 'besedilo') {
            h += polje('Besedilo', 'opis', e.opis);
        }
        h += '<label>Vrstni red</label><div class="vrstica"><button type="button" id="btn-el-ospredje" style="flex:1;">⬆ V ospredje</button><button type="button" id="btn-el-ozadje" style="flex:1;">⬇ V ozadje</button></div>' +
            '<div class="namig" style="margin-top:4px;">' + (e.plast === 'ozadje' ? 'Ikona je v ozadju: pod črtami in območji.' : (e.vrsta === 'vozilo' || e.vrsta === 'znak' || e.vrsta === 'besedilo') ? 'V ozadju je ikona pod narisanimi črtami in območji.' : 'Določa, katera črta ali območje je narisano čez drugo.') + '</div>';
        if (e.vrsta !== 'besedilo') h += '<label class="os-preklop" style="margin-top:10px;color:#f1f5f9;"><input type="checkbox" id="chk-el-napis"' + (e.skrijNapis ? '' : ' checked') + '> prikaži napis pri tem elementu</label>';
        h += '<div class="vrstica" style="margin-top:12px;"><button type="button" id="btn-el-izbrisi" class="nevaren" style="flex:1;">🗑 Izbriši</button></div>';
        el.innerHTML = h;

        let zapomnjeno = false;
        Array.prototype.forEach.call(el.querySelectorAll('[data-k]'), function (vnos) {
            const obdelaj = function () {
                if (!zapomnjeno) { zapomni(); zapomnjeno = true; }
                const k = vnos.dataset.k;
                let v = vnos.value;
                if (k === 'r') { v = Math.max(5, parseFloat(String(v).replace(',', '.')) || 5); }
                if (k === 'kratica') v = v.toUpperCase();
                if (k === 'posadka') { const n = parseInt(v, 10); v = isNaN(n) || n < 0 ? '' : Math.min(60, n); }
                e[k] = v;
                if (k === 'tip' || k === 'sluzba') e.oblika = oblikaZaTip(e.tip, e.sluzba);
                samodejnoShrani();
                osveziZemljevid();
                osveziSeznamVozil();
            };
            vnos.addEventListener('input', obdelaj);
            vnos.addEventListener('change', obdelaj);
        });
        Array.prototype.forEach.call(el.querySelectorAll('[data-kot]'), function (b) {
            b.addEventListener('click', function () {
                zapomni();
                const d = parseInt(b.dataset.kot, 10);
                if (e.roka !== undefined) e.roka = ((e.roka + d) % 360 + 360) % 360; // roka se zasuka skupaj z vozilom
                e.kot = (((e.kot || 0) + d) % 360 + 360) % 360;
                samodejnoShrani(); osveziZemljevid();
            });
        });
        Array.prototype.forEach.call(el.querySelectorAll('[data-roka]'), function (b) {
            b.addEventListener('click', function () {
                zapomni();
                const zdaj = e.roka === undefined ? (e.kot || 0) : e.roka;
                e.roka = ((zdaj + parseInt(b.dataset.roka, 10)) % 360 + 360) % 360;
                samodejnoShrani(); osveziZemljevid();
            });
        });
        const prestavi = function (naprej) {
            zapomni();
            const seznam = skica().elementi;
            const i = seznam.indexOf(e);
            if (i >= 0) seznam.splice(i, 1);
            if (naprej) { seznam.push(e); delete e.plast; }
            else { seznam.unshift(e); if (e.vrsta === 'vozilo' || e.vrsta === 'znak' || e.vrsta === 'besedilo') e.plast = 'ozadje'; }
            samodejnoShrani(); osveziZemljevid(); osveziLastnosti();
        };
        $('btn-el-ospredje').addEventListener('click', function () { prestavi(true); });
        $('btn-el-ozadje').addEventListener('click', function () { prestavi(false); });
        const chkNapis = $('chk-el-napis');
        if (chkNapis) chkNapis.addEventListener('change', function () {
            zapomni();
            if (chkNapis.checked) delete e.skrijNapis; else e.skrijNapis = true;
            samodejnoShrani(); osveziZemljevid();
        });
        const btnTocka = $('btn-tocka-odstrani');
        if (btnTocka) btnTocka.addEventListener('click', function () {
            const min = e.vrsta === 'obmocje' ? 3 : 2;
            if (izbranaTocka < 0 || izbranaTocka >= e.tocke.length || e.tocke.length <= min) return;
            zapomni();
            e.tocke.splice(izbranaTocka, 1);
            izbranaTocka = -1;
            samodejnoShrani(); osveziZemljevid(); osveziLastnosti();
        });
        Array.prototype.forEach.call(el.querySelectorAll('[data-barva]'), function (b) {
            b.addEventListener('click', function () { zapomni(); e.barva = b.dataset.barva; samodejnoShrani(); osveziZemljevid(); osveziLastnosti(); });
        });
        $('btn-el-izbrisi').addEventListener('click', function () {
            zapomni();
            skica().elementi = skica().elementi.filter(function (x) { return x.id !== e.id; });
            izbranId = null;
            samodejnoShrani(); osveziVse(false);
        });
    }

    // ---------- skice ----------
    function osveziSkice() {
        const el = $('seznam-skic');
        el.innerHTML = nacrt.skice.map(function (s, i) {
            return '<div class="skica-vrstica' + (i === idxSkice ? ' aktivna' : '') + '" data-i="' + i + '"><span>' + (i + 1) + '. ' + esc(s.naziv) + '</span><span class="st">' + s.elementi.length + '</span></div>';
        }).join('');
        Array.prototype.forEach.call(el.querySelectorAll('.skica-vrstica'), function (v) {
            v.addEventListener('click', function () { preklopiSkico(parseInt(v.dataset.i, 10)); });
        });
    }
    function trenutniPogled() {
        const c = map.getCenter(), z = map.getZoom();
        const pogled = { lat: c.lat, lon: c.lng, z: typeof z === 'number' ? z : ZACETEK.z };
        // vidni izrez: izpis pokaže vsaj vse, kar je vidno na zaslonu (list ima drugačno razmerje stranic)
        try {
            const b = map.getBounds();
            const meje = [[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]];
            if (meje.every(function (t) { return isFinite(t[0]) && isFinite(t[1]); })) pogled.meje = meje;
        } catch (e) { /* izrez ni na voljo */ }
        return pogled;
    }
    function preklopiSkico(i) {
        if (i < 0 || i >= nacrt.skice.length) return;
        nastaviOrodje(null);
        idxSkice = i; izbranId = null;
        const p = skica().pogled;
        if (p) map.setView([p.lat, p.lon], p.z);
        osveziVse(false);
    }
    /** Tabela povzetka: enote, vozila, člani in skupno število sodelujočih. */
    function htmlPovzetka(vozila, naslov) {
        const p = M.povzetekSodelujocih(vozila);
        if (!p.skupajVozil) return '';
        let h = '<table class="povzetek"><thead><tr><th>' + esc(naslov || 'Enota') + '</th><th>Vozil</th><th>Vozila</th><th>Članov</th></tr></thead><tbody>' + p.enote.map(function (en) {
            return '<tr><td>' + esc(en.enota) + '</td><td>' + en.vozil + '</td><td>' + esc(en.tipi.join(', ')) + '</td><td>' + en.clanov + (en.brezPosadke ? ' *' : '') + '</td></tr>';
        }).join('') + '</tbody><tfoot><tr><th>Skupaj enot: ' + p.skupajEnot + '</th><th>' + p.skupajVozil + '</th><th></th><th>' + p.skupajClanov + '</th></tr></tfoot></table>';
        h += '<p class="povzetek-skupaj"><b>Skupno število sodelujočih: ' + p.skupajClanov + '</b> (enot: ' + p.skupajEnot + ', vozil: ' + p.skupajVozil + ')' + (p.brezPosadke ? '<br>* vozil brez vpisane posadke: ' + p.brezPosadke + ' (niso všteta med člane)' : '') + '</p>';
        return h;
    }

    function osveziSeznamVozil() {
        const el = $('seznam-vozil');
        const vozila = skica().elementi.filter(function (e) { return e.vrsta === 'vozilo'; }).sort(function (a, b) { return (parseInt(a.st, 10) || 999) - (parseInt(b.st, 10) || 999); });
        const pov = M.povzetekSodelujocih(vozila);
        $('povzetek-zaslon').innerHTML = vozila.length ? 'Enot: <b>' + pov.skupajEnot + '</b> · vozil: <b>' + pov.skupajVozil + '</b> · članov: <b>' + pov.skupajClanov + '</b>' + (pov.brezPosadke ? ' <span title="Vozila brez vpisane posadke niso všteta med člane">(brez posadke: ' + pov.brezPosadke + ')</span>' : '') : '';
        el.innerHTML = vozila.length ? vozila.map(function (e) { return '<div data-id="' + esc(e.id) + '">' + esc(M.oznakaVozila(e)) + (M.zapisPosadke(e) ? ' <b>(' + esc(M.zapisPosadke(e)) + ')</b>' : '') + (e.opis ? ' - <span style="color:#94a3b8;">' + esc(e.opis) + '</span>' : '') + '</div>'; }).join('') : '<div class="namig">Na tej skici še ni vozil.</div>';
        Array.prototype.forEach.call(el.querySelectorAll('[data-id]'), function (v) {
            v.addEventListener('click', function () {
                const e = najdi(v.dataset.id);
                if (e) { map.setView([e.lat, e.lon], map.getZoom()); izberi(e.id); }
            });
        });
    }

    function osveziVse(tudiPogled) {
        $('naziv-nacrta').value = nacrt.naziv;
        $('napisi-vidni').checked = nacrt.napisi !== false;
        osveziSever();
        document.title = 'EPV Načrt - ' + nacrt.naziv;
        if (tudiPogled) {
            const p = skica().pogled;
            if (p) map.setView([p.lat, p.lon], p.z);
        }
        osveziSkice(); osveziZemljevid(); osveziLastnosti(); osveziSeznamVozil();
    }

    // ---------- datoteke ----------
    /** Načrt, kot se zapiše v datoteko ali na splet (z območjem zveze in domovi). */
    function nacrtZaShranjevanje() {
        skica().pogled = trenutniPogled();
        samodejnoShrani();
        return Object.assign({}, nacrt, { osnova: (osnova.tocke.length || osnova.obrisi.length) ? osnova : undefined });
    }
    function shraniVDatoteko() {
        const zaDatoteko = nacrtZaShranjevanje();
        const blob = new Blob([JSON.stringify(zaDatoteko, null, 1)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = M.imeDatoteke(nacrt);
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
    function nalozi(besedilo) {
        const r = M.uvozi(besedilo);
        if (!r.ok) { alert(r.napaka); return false; }
        zapomni();
        nacrt = r.nacrt; idxSkice = 0; izbranId = null;
        // območje zveze in domovi iz datoteke: prevzamemo jih samo, če jih ta naprava še nima
        if (r.nacrt.osnova && !osnova.tocke.length && !osnova.obrisi.length) { osnova = r.nacrt.osnova; osnovaVidna = true; shraniOsnovo(); osveziOsnovo(); }
        delete nacrt.osnova;
        samodejnoShrani();
        osveziVse(true);
        if (r.izpusceno) alert('Načrt je odprt. Izpuščenih poškodovanih elementov: ' + r.izpusceno + '.');
        return true;
    }

    // ---------- elaborat ----------
    function odpriElaborat() {
        $('elaborat-polja').innerHTML = M.ELABORAT_POLJA.map(function (p) {
            const v = nacrt.elaborat[p.k] || '';
            return '<label>' + esc(p.naziv) + '</label>' + (p.vrstic > 1 ? '<textarea data-e="' + p.k + '" rows="' + p.vrstic + '">' + esc(v) + '</textarea>' : '<input type="text" data-e="' + p.k + '" value="' + esc(v) + '">');
        }).join('');
        Array.prototype.forEach.call($('elaborat-polja').querySelectorAll('[data-e]'), function (vnos) {
            vnos.addEventListener('input', function () { nacrt.elaborat[vnos.dataset.e] = vnos.value; samodejnoShrani(); });
        });
        $('elaborat-okno').style.display = 'flex';
    }

    function htmlElaborata() {
        const e = nacrt.elaborat;
        const odstavek = function (naslov, besedilo) { return besedilo && besedilo.trim() ? '<h3>' + esc(naslov) + '</h3><p>' + esc(besedilo.trim()) + '</p>' : ''; };
        let h = '<div class="naslovnica"><p>' + esc(e.organizator) + '</p><h1>' + esc(nacrt.naziv) + '</h1><p><b>ELABORAT</b></p><p>' + esc(e.krajDatum) + '</p><p>' + esc(e.vodja) + '</p></div>';
        h += '<h2>1. Uvod</h2>' + odstavek('1.1 Predstavitev in namen', e.uvod) + odstavek('1.2 Cilji', e.cilji) + odstavek('1.3 Organizacija in varnostni ukrepi', e.varnost) + odstavek('1.4 Zavarovanje območja', e.zavarovanje);
        h += '<h2>2. Makrolokacija in mikrolokacija</h2><p>' + esc((e.lokacija || '').trim()) + '</p>';
        h += '<h2>3. Scenarij</h2>' + odstavek('3.1 Opis dogodka', e.scenarij) + odstavek('3.2 Predvidene aktivnosti po sektorjih', e.aktivnosti) + odstavek('3.3 Alarmiranje, aktiviranje in zveze', e.alarmiranje);
        const vozila = M.seznamVozil(nacrt);
        h += '<h3>3.4 Sodelujoče enote in vozila</h3>';
        if (vozila.length) {
            h += '<table><thead><tr><th>Št.</th><th>Enota</th><th>Vozilo</th><th>Posadka</th><th>Služba</th><th>Naloga / opomba</th></tr></thead><tbody>' + vozila.map(function (v) {
                return '<tr><td>' + esc(v.st) + '</td><td>' + esc(v.kratica) + (M.nazivDrustva(v.kratica) ? ' - ' + esc(M.nazivDrustva(v.kratica)) : '') + '</td><td>' + esc(v.tip) + '</td><td>' + esc(M.zapisPosadke(v)) + '</td><td>' + esc((M.SLUZBE[v.sluzba] || {}).naziv || '') + '</td><td>' + esc(v.opis) + '</td></tr>';
            }).join('') + '</tbody></table>' + '<h3>Sodelujoči skupaj</h3>' + htmlPovzetka(vozila);
        } else h += '<p>Na skicah še ni vozil.</p>';
        if (e.drugeSluzbe && e.drugeSluzbe.trim()) h += '<p>' + esc(e.drugeSluzbe.trim()) + '</p>';
        const koraki = (e.casovnica || '').split('\n').map(function (v) { return v.trim(); }).filter(Boolean);
        h += '<h2>4. Taktični nastop enot</h2>';
        if (koraki.length) {
            h += '<table><thead><tr><th style="width:22mm;">Čas</th><th>Aktivnost</th></tr></thead><tbody>' + koraki.map(function (v) {
                const m = v.match(/^(\d{1,2}[:.]\d{2})\s*[-–:]?\s*(.*)$/);
                return m ? '<tr><td>' + esc(m[1]) + '</td><td>' + esc(m[2]) + '</td></tr>' : '<tr><td></td><td>' + esc(v) + '</td></tr>';
            }).join('') + '</tbody></table>';
        } else h += '<p>-</p>';
        h += '<h2>5. Zaključek</h2><p>' + esc((e.zakljucek || '').trim()) + '</p>';
        h += '<h2>Priloge: skice</h2><p>' + nacrt.skice.map(function (s, i) { return 'Skica ' + (i + 1) + ': ' + esc(s.naziv); }).join('<br>') + '</p>';
        return h;
    }

    // ---------- legenda uporabljenih znakov (spodnji desni kot skice) ----------
    /** vVrsti: legenda za izpis - znaki drug ob drugem v pasu pod skico (namesto okvirčka v kotu zemljevida). */
    function htmlLegende(sk, vVrsti) {
        const vrstice = [];
        const dodaj = function (ikona, besedilo) {
            vrstice.push(vVrsti
                ? '<span class="nl-znak"><span class="nl-ikona">' + ikona + '</span>' + esc(besedilo) + '</span>'
                : '<tr><td style="padding:1px 5px 1px 0;text-align:center;vertical-align:middle;">' + ikona + '</td><td style="padding:1px 0;vertical-align:middle;">' + esc(besedilo) + '</td></tr>');
        };
        const mini = function (svg) { return '<svg viewBox="0 0 56 56" style="width:22px;height:22px;display:block;margin:0 auto;overflow:visible;">' + svg + '</svg>'; };
        const vozila = sk.elementi.filter(function (e) { return e.vrsta === 'vozilo'; });
        const sluzbe = {};
        vozila.forEach(function (e) { sluzbe[e.sluzba || 'gasilci'] = true; });
        Object.keys(M.SLUZBE).forEach(function (k) {
            if (!sluzbe[k]) return;
            dodaj(mini(svgVozila(k === 'policija' ? 'avto' : 'tovorno', k)), k === 'gasilci' ? 'Gasilsko vozilo' : 'Vozilo: ' + M.SLUZBE[k].naziv);
        });
        if (vozila.some(M.jeCisterna)) dodaj(mini(svgVozila('tovorno', 'gasilci', { cisterna: true })), 'Cisterna (X)');
        if (vozila.length) dodaj('<b style="font-size:11px;">1, 2 …</b>', 'Vrstni red prihoda');
        const znaki = {};
        sk.elementi.forEach(function (e) {
            if (e.vrsta !== 'znak') return;
            const z = M.ZNAKI[e.znak];
            const kljuc = z.prazen ? 'prazen:' + (e.opis || '') : e.znak;
            if (znaki[kljuc]) return;
            znaki[kljuc] = true;
            dodaj('<span style="display:inline-block;width:17px;height:17px;line-height:17px;border-radius:' + (z.krog ? '50%' : '3px') + ';background:' + z.barva + ';color:#fff;font-size:10px;font-weight:bold;text-align:center;">' + esc(z.znak) + '</span>', z.prazen ? (e.opis || 'Znak') : z.naziv);
        });
        const crte = {};
        sk.elementi.forEach(function (e) {
            if (e.vrsta !== 'crta') return;
            const c = M.CRTE[e.slog];
            const barva = e.barva || c.barva;
            if (crte[e.slog + barva]) return;
            crte[e.slog + barva] = true;
            const obroba = 'box-shadow:0 0 0 1px #0f172a;';
            dodaj('<span style="display:inline-block;width:22px;height:3px;background:' + barva + ';' + obroba + 'vertical-align:middle;"></span>' + (c.puscica ? '<span style="color:#0f172a;font-size:9px;">▶</span>' : ''), c.naziv);
        });
        sk.elementi.forEach(function (e) {
            if (e.vrsta === 'obmocje') dodaj('<span style="display:inline-block;width:17px;height:12px;background:' + (e.barva || '#ef4444') + '55;border:2px solid ' + (e.barva || '#ef4444') + ';"></span>', e.opis || 'Sektor');
        });
        if (sk.elementi.some(function (e) { return e.vrsta === 'krog'; })) dodaj('<span style="display:inline-block;width:14px;height:14px;border-radius:50%;border:2px dashed #dc2626;background:#dc262633;"></span>', 'Nevarno območje');
        if (osnovaVidna && osnova.tocke.length) dodaj('<span style="font-size:13px;">🏠</span>', 'Gasilski dom');
        if (osnovaVidna && osnova.obrisi.length) dodaj('<span style="display:inline-block;width:22px;border-top:3px dashed #f59e0b;vertical-align:middle;"></span>', 'Območje zveze');
        if (!sk.elementi.length) return '';
        if (vVrsti) return '<div class="nacrt-legenda nl-vrsta"><span class="nl-naslov">Legenda:</span>' + vrstice.join('') + '</div>';
        return '<div class="nacrt-legenda"><div class="nl-naslov">Legenda</div><table>' + vrstice.join('') + '</table></div>';
    }
    function osveziLegendo() {
        const el = $('legenda');
        if (!el) return;
        const h = htmlLegende(skica());
        el.innerHTML = h;
        el.style.display = h ? '' : 'none';
    }

    // ---------- obrazec za prijavo vaje (ReCO) ----------
    function odpriObrazec() {
        if (!nacrt.obrazec) nacrt.obrazec = M.privzetiObrazec();
        $('obrazec-polja').innerHTML = M.OBRAZEC_POLJA.map(function (p) {
            const v = nacrt.obrazec[p.k] || '';
            return '<label>' + esc(p.naziv) + '</label>' + (p.vrstic > 1 ? '<textarea data-o="' + p.k + '" rows="' + p.vrstic + '">' + esc(v) + '</textarea>' : '<input type="text" data-o="' + p.k + '" value="' + esc(v) + '">');
        }).join('');
        Array.prototype.forEach.call($('obrazec-polja').querySelectorAll('[data-o]'), function (vnos) {
            vnos.addEventListener('input', function () { nacrt.obrazec[vnos.dataset.o] = vnos.value; samodejnoShrani(); });
        });
        $('obrazec-okno').style.display = 'flex';
    }
    function htmlObrazca() {
        const o = nacrt.obrazec || M.privzetiObrazec();
        const v = function (k) { return esc((o[k] || '').trim()); };
        const vrstice = function (k) { return (o[k] || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
        const scenarij = vrstice('scenarij').map(function (x) { const d = x.split('|').map(function (y) { return y.trim(); }); return '<tr><td>' + esc(d[0] || '') + '</td><td>' + esc(d[1] || '') + '</td><td>' + esc(d[2] || '') + '</td></tr>'; }).join('');
        let pgd = vrstice('pgd');
        if (!pgd.length) pgd = M.drustvaVNacrtu(nacrt);
        while (pgd.length % 4 !== 0 || pgd.length === 0) pgd.push('');
        let pgdVrstice = '';
        for (let i = 0; i < pgd.length; i += 4) pgdVrstice += '<tr>' + [0, 1, 2, 3].map(function (j) { return '<td class="ob-celica">' + (i + j + 1) + '. <b>' + esc(pgd[i + j] || '') + '</b></td>'; }).join('') + '</tr>';
        const ud = vrstice('udelezenci');
        while (ud.length < 5) ud.push('');
        return '<div class="obrazec">' +
            '<table><tr><td style="width:68%"><b>GASILSKA ZVEZA: ' + v('gz') + '</b></td><td>' + v('naslov') + '</td></tr></table>' +
            '<p class="ob-drobno">Na podlagi Pravilnika o vajah na področju varstva pred naravnimi in drugimi nesrečami (Uradni list RS, številka 104/08 z dne 3.11.2008)</p>' +
            '<table><tr><td style="width:68%"><b>Gasilsko društvo: ' + v('drustvo') + '</b></td><td class="ob-sredina">ORGANIZIRA IN IZVEDE<br>' + v('obseg') + '</td></tr>' +
            '<tr><td colspan="2"><b>Gasilsko vajo:</b> ' + v('vaja') + '</td></tr></table>' +
            '<table><tr><td style="width:20%"><b>dne:</b> ' + v('dne') + '</td><td style="width:30%"><b>ob:</b> ' + v('ob') + ' <b>uri</b></td><td><b>na lokaciji:</b> ' + v('lokacija') + '</td></tr></table>' +
            '<table class="ob-odmik"><tr><th colspan="3">VODSTVO VAJE</th></tr><tr><td class="ob-sredina" style="width:50%">Vodja vaje</td><td class="ob-sredina">Pomočnik</td><td class="ob-sredina">Pomočnik</td></tr>' +
            '<tr><td class="ob-sredina ob-visina">' + v('vodja') + '</td><td class="ob-sredina">' + v('pomocnik1') + '</td><td class="ob-sredina">' + v('pomocnik2') + '</td></tr></table>' +
            '<table class="ob-odmik"><tr><th>SCENARIJ VAJE</th></tr></table>' +
            '<table class="ob-odmik ob-sredinska"><tr><td style="width:55%">Aktivnosti</td><td>Nosilec</td><td style="width:16%">Čas izvedbe</td></tr>' + scenarij + '</table>' +
            '<table class="ob-odmik"><tr><th style="width:50%">Imitacija</th><th>Načrt zavarovanja</th></tr>' +
            '<tr><td>Vrsta: ' + v('imVrsta') + '</td><td>Način: ' + v('zavNacin') + '</td></tr><tr><td>Obseg: ' + v('imObseg') + '</td><td>Obseg: ' + v('zavObseg') + '</td></tr>' +
            '<tr><td>Čas izvedbe: ' + v('imCas') + '</td><td>Izvajalec: ' + v('zavIzvajalec') + '</td></tr><tr><td>Izvajalec: ' + v('imIzvajalec') + '</td><td></td></tr></table>' +
            '<table class="ob-odmik"><tr><th colspan="3">NAČRT ZVEZ<br><span style="font-weight:normal;">(' + v('zvezeOpis') + ')</span></th></tr>' +
            '<tr><td>Vodstvo vaje: ' + v('zvezeVodstvo') + '</td><td>delovni kanal: ' + v('kanal') + '</td><td>Rezervni kanal: ' + v('rezervniKanal') + '</td></tr>' +
            '<tr><th colspan="3">' + v('aktiviranje') + '<br>Dne: ' + v('dne') + ' ob ' + v('ob') + ' uri naslednje PGD:</th></tr></table>' +
            '<table class="ob-brez-zgornje">' + pgdVrstice + '<tr><td colspan="4">Vsebina poziva se glasi: ' + v('poziv') + '</td></tr>' +
            '<tr><th colspan="4">Organizator obvešča ostale udeležence vaje <span style="font-weight:normal;">(policijo, zdravstvo, elektro, … itd.)</span></th></tr></table>' +
            '<table class="ob-brez-zgornje"><tr>' + ud.map(function (x, i) { return '<td class="ob-celica">' + (i + 1) + ' ' + esc(x) + '</td>'; }).join('') + '</tr></table>' +
            '<p style="margin-top:4mm;"><b>Zaključek vaje</b> je predviden ob: ' + v('zakljucek') + ' uri.</p>' +
            '<p style="text-align:right;margin:8mm 12mm 0 0;"><b>Poveljstvo</b></p></div>';
    }
    function natisniObrazec() {
        $('tisk').innerHTML = htmlObrazca();
        const pocisti = function () { window.removeEventListener('afterprint', pocisti); if (!window.EPV_TISK_OHRANI) $('tisk').innerHTML = ''; };
        window.addEventListener('afterprint', pocisti);
        setTimeout(function () { window.print(); }, 100);
    }

    // ---------- izpis ----------
    function mejeSkice(sk) {
        const t = [];
        sk.elementi.forEach(function (e) {
            if (e.tocke) e.tocke.forEach(function (p) { t.push(p); });
            else t.push([e.lat, e.lon]);
        });
        if (!t.length) return null;
        let a = 90, b = 180, c = -90, d = -180;
        t.forEach(function (p) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); });
        return [[a, b], [c, d]];
    }
    function legendaSkice(sk) {
        const vozila = sk.elementi.filter(function (e) { return e.vrsta === 'vozilo'; }).sort(function (a, b) { return (parseInt(a.st, 10) || 999) - (parseInt(b.st, 10) || 999); });
        let h = '';
        if (vozila.length) {
            h += '<table><thead><tr><th>Št.</th><th>Enota</th><th>Vozilo</th><th>Posadka</th><th>Naloga / opomba</th></tr></thead><tbody>' + vozila.map(function (v) {
                return '<tr><td>' + esc(v.st) + '</td><td>' + esc(v.kratica) + '</td><td>' + esc(v.tip) + '</td><td>' + esc(M.zapisPosadke(v)) + '</td><td>' + esc(v.opis) + '</td></tr>';
            }).join('') + '</tbody></table>';
            h += '<h3>Poročilo o sodelujočih</h3>' + htmlPovzetka(vozila);
        }
        return h;
    }

    function natisni(zElaboratom) {
        skica().pogled = trenutniPogled();
        samodejnoShrani();
        const cilj = $('tisk');
        let h = zElaboratom ? htmlElaborata() : '<h1>' + esc(nacrt.naziv) + '</h1>';
        nacrt.skice.forEach(function (s, i) {
            h += '<div class="tisk-skica' + (!zElaboratom && i === 0 ? ' prva' : '') + '"><h2>Skica ' + (i + 1) + ': ' + esc(s.naziv) + '</h2><div class="tisk-zemljevid-okvir"><div class="tisk-zemljevid" id="tisk-z-' + i + '"></div>' + (nacrt.sever ? htmlSevera() : '') + '</div>' + htmlLegende(s, true) + legendaSkice(s) + '</div>';
        });
        h += '<p class="tisk-noga">EPV Načrt · izpis ' + esc(new Date().toLocaleString('sl-SI')) + '</p>';
        cilj.innerHTML = h;
        $('tisk-priprava').style.display = 'flex';

        // velikost izrisa = širina zemljevida na zaslonu (razmerje stranic lista), nato pomanjšano na 180 mm (680,3 px)
        const sirinaZaslona = Math.max(700, Math.min(1600, $('zemljevid').clientWidth || 1000));
        const visinaIzrisa = Math.round(sirinaZaslona * 125 / 180);
        const merilo = 680.3 / sirinaZaslona;
        const zemljevidi = [];
        const cakanja = nacrt.skice.map(function (s, i) {
            const okvir = $('tisk-z-' + i);
            okvir.style.width = sirinaZaslona + 'px'; okvir.style.height = visinaIzrisa + 'px'; okvir.style.transform = 'scale(' + merilo + ')';
            const m = L.map('tisk-z-' + i, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, zoomSnap: 0.25, fadeAnimation: false, zoomAnimation: false });
            zemljevidi.push(m);
            m.createPane('epvOzadje').style.zIndex = 350;
            const plast = ustvariPodlago(trenutnaPodlaga).addTo(m);
            const meje = mejeSkice(s);
            if (s.pogled && s.pogled.meje) m.fitBounds(s.pogled.meje, { padding: [0, 0] });
            else if (s.pogled) m.setView([s.pogled.lat, s.pogled.lon], s.pogled.z);
            else if (meje) m.fitBounds(meje, { padding: [30, 30], maxZoom: 18 });
            else { const p = trenutniPogled(); m.setView([p.lat, p.lon], p.z); }
            narisiOsnovo(L.layerGroup().addTo(m), false);
            const g = L.layerGroup().addTo(m);
            narisi(s, g, m, false);
            return new Promise(function (resolve) { plast.once('load', resolve); });
        });
        const najvec = new Promise(function (resolve) { setTimeout(resolve, window.EPV_TISK_CAKAJ_MS || 6000); });
        Promise.race([Promise.all(cakanja), najvec]).then(function () {
            setTimeout(function () {
                $('tisk-priprava').style.display = 'none';
                const pocisti = function () {
                    window.removeEventListener('afterprint', pocisti);
                    zemljevidi.forEach(function (m) { try { m.remove(); } catch (e) { /* že odstranjen */ } });
                    if (!window.EPV_TISK_OHRANI) cilj.innerHTML = '';
                };
                window.addEventListener('afterprint', pocisti);
                window.print();
            }, 400);
        });
    }

    // ---------- zemljevid ----------
    function ustvariPodlago(katera) {
        if (katera === 'cesta') return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, maxNativeZoom: 19, attribution: '© OpenStreetMap' });
        return L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 21, maxNativeZoom: 19, attribution: 'Tiles © Esri' });
    }

    function zacni() {
        const url = new URLSearchParams(window.location.search);
        const lat = parseFloat(url.get('lat')), lon = parseFloat(url.get('lon')), z = parseFloat(url.get('z'));
        const pogledUrl = isFinite(lat) && isFinite(lon) ? { lat: lat, lon: lon, z: isFinite(z) ? z : 16 } : null;

        let shranjen = null;
        try { const r = M.uvozi(localStorage.getItem(KLJUC_SAMODEJNO)); if (r.ok) shranjen = r.nacrt; } catch (e) { shranjen = null; }
        nacrt = shranjen || M.novNacrt(url.get('naziv') || 'Nov načrt', pogledUrl || ZACETEK);

        const p0 = skica().pogled || pogledUrl || ZACETEK;
        map = L.map('zemljevid', { zoomSnap: 0.5, maxZoom: 21 }).setView([p0.lat, p0.lon], p0.z);
        podlage = { 'Ortofoto': ustvariPodlago('ortofoto'), 'Cestna karta': ustvariPodlago('cesta') };
        podlage['Ortofoto'].addTo(map);
        L.control.layers(podlage, null, { position: 'topright' }).addTo(map);
        if (L.control.scale) L.control.scale({ imperial: false }).addTo(map);
        map.on('baselayerchange', function (ev) { trenutnaPodlaga = ev && ev.name === 'Cestna karta' ? 'cesta' : 'ortofoto'; });
        try {
            osnova = M.ocistiOsnovo(JSON.parse(localStorage.getItem(KLJUC_OSNOVA)));
            osnovaVidna = localStorage.getItem(KLJUC_OSNOVA_VIDNA) !== '0';
        } catch (e) { osnova = { tocke: [], obrisi: [] }; }
        map.createPane('epvOzadje').style.zIndex = 350; // pod črtami in območji (400), nad podlago
        slojOsnove = L.layerGroup().addTo(map);
        sloj = L.layerGroup().addTo(map);

        map.on('click', function (ev) {
            if (orodje) postavi(ev.latlng.lat, ev.latlng.lng);
            else if (izbranId) izberi(null);
        });
        map.on('moveend', function () { if (nacrt) { skica().pogled = trenutniPogled(); samodejnoShrani(); } });

        // vlečenje iz palete na zemljevid (miška)
        const okvir = $('zemljevid');
        okvir.addEventListener('dragover', function (ev) { if (orodje) ev.preventDefault(); });
        okvir.addEventListener('drop', function (ev) {
            if (!orodje) return;
            ev.preventDefault();
            const ll = map.mouseEventToLatLng(ev);
            if (ll && isFinite(ll.lat)) postavi(ll.lat, ll.lng);
        });

        zgradiPaleto();

        $('naziv-nacrta').addEventListener('input', function () { nacrt.naziv = $('naziv-nacrta').value || 'Načrt'; document.title = 'EPV Načrt - ' + nacrt.naziv; samodejnoShrani(); });
        $('btn-koncaj').addEventListener('click', koncajRisanje);
        $('btn-preklici').addEventListener('click', function () { nastaviOrodje(null); });
        $('btn-razveljavi').addEventListener('click', razveljavi);
        $('btn-shrani').addEventListener('click', shraniVDatoteko);
        $('btn-odpri').addEventListener('click', function () { $('datoteka').click(); });
        $('datoteka').addEventListener('change', function () {
            const f = $('datoteka').files[0];
            if (!f) return;
            const br = new FileReader();
            br.onload = function () { nalozi(String(br.result)); $('datoteka').value = ''; };
            br.readAsText(f);
        });
        $('btn-novo').addEventListener('click', function () {
            if (!window.confirm('Začeti nov prazen načrt? Trenutni načrt prej shrani v datoteko, sicer bo izgubljen.')) return;
            zapomni();
            nacrt = M.novNacrt('Nov načrt', trenutniPogled()); idxSkice = 0; izbranId = null;
            samodejnoShrani(); osveziVse(false);
        });
        $('btn-skica-nova').addEventListener('click', function () {
            const naziv = window.prompt('Naziv nove skice:', 'Skica ' + (nacrt.skice.length + 1));
            if (naziv === null) return;
            zapomni();
            nacrt.skice.push(M.novaSkica(naziv.trim() || 'Skica', trenutniPogled()));
            idxSkice = nacrt.skice.length - 1; izbranId = null;
            samodejnoShrani(); osveziVse(false);
        });
        $('btn-skica-podvoji').addEventListener('click', function () {
            const naziv = window.prompt('Naziv naslednjega koraka (kopija trenutne skice):', skica().naziv + ' - naslednji korak');
            if (naziv === null) return;
            zapomni();
            skica().pogled = trenutniPogled();
            nacrt.skice.splice(idxSkice + 1, 0, M.podvojiSkico(skica(), naziv.trim() || undefined));
            idxSkice += 1; izbranId = null;
            samodejnoShrani(); osveziVse(false);
        });
        $('btn-skica-preimenuj').addEventListener('click', function () {
            const naziv = window.prompt('Novo ime skice:', skica().naziv);
            if (naziv === null || !naziv.trim()) return;
            zapomni(); skica().naziv = naziv.trim(); samodejnoShrani(); osveziSkice();
        });
        $('btn-skica-izbrisi').addEventListener('click', function () {
            if (nacrt.skice.length <= 1) { alert('Načrt mora imeti vsaj eno skico.'); return; }
            if (!window.confirm('Izbrisati skico »' + skica().naziv + '« z vsemi elementi?')) return;
            zapomni();
            nacrt.skice.splice(idxSkice, 1);
            idxSkice = Math.max(0, idxSkice - 1); izbranId = null;
            samodejnoShrani(); osveziVse(true);
        });
        $('btn-elaborat').addEventListener('click', odpriElaborat);
        $('btn-elaborat-zapri').addEventListener('click', function () { $('elaborat-okno').style.display = 'none'; });
        $('btn-elaborat-tisk').addEventListener('click', function () { $('elaborat-okno').style.display = 'none'; natisni(true); });
        $('btn-tisk-skice').addEventListener('click', function () { natisni(false); });
        $('napisi-vidni').addEventListener('change', function () { zapomni(); nacrt.napisi = $('napisi-vidni').checked; samodejnoShrani(); osveziZemljevid(); });
        zivePripravi();
        pinPripravi();
        spletPripravi();
        $('sever-viden').addEventListener('change', function () { zapomni(); nacrt.sever = $('sever-viden').checked; samodejnoShrani(); osveziSever(); });
        $('osnova-vidna').addEventListener('change', function () { osnovaVidna = $('osnova-vidna').checked; shraniOsnovo(); osveziOsnovo(); osveziLegendo(); });
        $('btn-osnova').addEventListener('click', function () { $('osnova-uvoz-stanje').textContent = ''; osveziOsnovo(); $('osnova-okno').style.display = 'flex'; });
        $('btn-osnova-zapri').addEventListener('click', function () { $('osnova-okno').style.display = 'none'; });
        $('btn-osnova-uvozi').addEventListener('click', function () { $('osnova-datoteka').click(); });
        $('osnova-datoteka').addEventListener('change', function () { const f = $('osnova-datoteka').files[0]; if (f) uvoziOsnovoIzDatoteke(f); $('osnova-datoteka').value = ''; });
        $('btn-osnova-dodaj').addEventListener('click', function () {
            $('osnova-okno').style.display = 'none';
            nastaviOrodje({ kljuc: 'osnova:dom', vrsta: 'osnovaDom' });
            $('orodje-besedilo').textContent = 'Tapni na zemljevid, kjer je gasilski dom';
        });
        $('btn-osnova-pocisti').addEventListener('click', function () {
            if (!window.confirm('Odstraniti vse domove in obrise območja s te naprave?')) return;
            osnova = { tocke: [], obrisi: [] }; shraniOsnovo(); osveziOsnovo(); osveziLegendo();
        });
        osveziOsnovo();
        $('btn-obrazec').addEventListener('click', odpriObrazec);
        $('btn-obrazec-zapri').addEventListener('click', function () { $('obrazec-okno').style.display = 'none'; });
        $('btn-obrazec-tisk').addEventListener('click', function () { $('obrazec-okno').style.display = 'none'; natisniObrazec(); });
        document.addEventListener('keydown', function (ev) {
            if (ev.key === 'Escape') nastaviOrodje(null);
            if ((ev.key === 'Delete') && izbranId && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) $('btn-el-izbrisi') && $('btn-el-izbrisi').click();
            if ((ev.ctrlKey || ev.metaKey) && ev.key === 'z' && !/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) { ev.preventDefault(); razveljavi(); }
        });
        window.addEventListener('beforeunload', samodejnoShrani);

        // za teste in diagnostiko
        window.EPVNacrt = { zive: function () { return zive; }, stanje: function () { return { nacrt: nacrt, idxSkice: idxSkice, izbranId: izbranId, orodje: orodje, osnova: osnova, osnovaVidna: osnovaVidna }; }, postavi: postavi, nalozi: nalozi };
        osveziVse(false);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', zacni); else zacni();
})();
