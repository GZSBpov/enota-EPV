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
    let map, sloj, podlage, trenutnaPodlaga = 'ortofoto';

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
    function svgVozila(oblika, sluzba) {
        const s = M.SLUZBE[sluzba] || M.SLUZBE.gasilci;
        const r = 'stroke="#0f172a" stroke-width="1.5"';
        const okno = '#bfdbfe';
        let t = '';
        if (oblika === 'avto') {
            t = '<rect x="19" y="13" width="18" height="30" rx="5" fill="' + s.barva + '" ' + r + '/><rect x="21.5" y="17" width="13" height="6" rx="1.5" fill="' + okno + '"/><rect x="19" y="30" width="18" height="3.5" fill="' + s.proga + '"/>';
        } else if (oblika === 'dron') {
            t = '<line x1="14" y1="14" x2="42" y2="42" stroke="#0f172a" stroke-width="4"/><line x1="42" y1="14" x2="14" y2="42" stroke="#0f172a" stroke-width="4"/>' +
                [[14, 14], [42, 14], [14, 42], [42, 42]].map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="7" fill="#e2e8f0" ' + r + '/>'; }).join('') +
                '<rect x="21" y="21" width="14" height="14" rx="3" fill="' + s.barva + '" ' + r + '/>';
        } else if (oblika === 'coln') {
            t = '<path d="M28 5 Q41 22 38 50 L18 50 Q15 22 28 5 Z" fill="' + s.barva + '" ' + r + '/><rect x="21" y="30" width="14" height="4" fill="' + s.proga + '"/>';
        } else if (oblika === 'priklopnik') {
            t = '<line x1="28" y1="6" x2="28" y2="18" stroke="#0f172a" stroke-width="3"/><rect x="19" y="18" width="18" height="26" rx="2" fill="' + s.barva + '" ' + r + '/><rect x="19" y="30" width="18" height="3.5" fill="' + s.proga + '"/>';
        } else {
            t = '<rect x="18" y="5" width="20" height="46" rx="3" fill="' + s.barva + '" ' + r + '/><rect x="20.5" y="8" width="15" height="7" rx="1.5" fill="' + okno + '"/><rect x="18" y="29" width="20" height="4" fill="' + s.proga + '"/>';
            if (oblika === 'lestev') {
                t += '<rect x="24.5" y="2" width="7" height="40" fill="#e5e7eb" ' + r + '/>' + [8, 14, 20, 26, 32, 38].map(function (y) { return '<line x1="24.5" y1="' + y + '" x2="31.5" y2="' + y + '" stroke="#0f172a" stroke-width="1.2"/>'; }).join('');
            }
        }
        return t;
    }
    function oblikaZaTip(tip, sluzba) {
        const najden = M.TIPI_VOZIL.filter(function (v) { return v.tip === tip; })[0];
        if (najden) return najden.oblika;
        return (M.VOZILA_SLUZB[sluzba] || { oblika: 'tovorno' }).oblika;
    }
    function ikonaVozila(e, izbran) {
        const html = '<div class="nv' + (izbran ? ' izbran' : '') + '"><svg viewBox="0 0 56 56"><g transform="rotate(' + (e.kot || 0) + ' 28 28)">' + svgVozila(e.oblika || oblikaZaTip(e.tip, e.sluzba), e.sluzba) + '</g></svg>' +
            '<span class="nv-napis">' + esc(M.oznakaVozila(e) || '?') + '</span></div>';
        return L.divIcon({ className: 'nacrt-ikona', html: html, iconSize: [60, 76], iconAnchor: [30, 28] });
    }
    function ikonaZnaka(e, izbran) {
        const z = M.ZNAKI[e.znak];
        const napis = e.opis || z.napis || '';
        const html = '<div class="nz' + (izbran ? ' izbran' : '') + '"><div class="nz-telo' + (z.krog ? ' krog' : '') + '" style="background:' + z.barva + ';' + (z.vrti ? 'transform:rotate(' + ((e.kot || 0) - 90) + 'deg);' : '') + '">' + esc(z.znak) + '</div>' +
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
        sk.elementi.forEach(function (e) {
            const izbran = interaktivno && e.id === izbranId;
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
                const ikona = e.vrsta === 'vozilo' ? ikonaVozila(e, izbran) : e.vrsta === 'znak' ? ikonaZnaka(e, izbran) : ikonaBesedila(e, izbran);
                const m = L.marker([e.lat, e.lon], { icon: ikona, draggable: !!interaktivno, zIndexOffset: e.vrsta === 'vozilo' ? 500 : 300 });
                if (e.vrsta === 'vozilo' && e.opis) m.bindTooltip(e.opis, { direction: 'top', offset: [0, -24] });
                premik(m); cilj.addLayer(klik(m));
            } else if (e.vrsta === 'crta') {
                const c = M.CRTE[e.slog];
                const pl = L.polyline(e.tocke, { color: c.barva, weight: c.debelina + (izbran ? 4 : 0), dashArray: c.crtkano, opacity: 0.95, bubblingMouseEvents: false });
                if (e.opis) pl.bindTooltip(e.opis, { permanent: true, direction: 'center', className: 'nacrt-oznaka' });
                cilj.addLayer(klik(pl));
                if (c.puscica && e.tocke.length >= 2) {
                    const a = e.tocke[e.tocke.length - 2], b = e.tocke[e.tocke.length - 1];
                    let kot = 0;
                    try {
                        const pa = naMapo.latLngToLayerPoint(a), pb = naMapo.latLngToLayerPoint(b);
                        kot = Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180 / Math.PI;
                    } catch (err) { kot = 0; }
                    if (!isFinite(kot)) kot = 0;
                    const p = L.marker(b, { interactive: false, icon: L.divIcon({ className: 'nacrt-ikona', html: '<div class="np" style="color:' + c.barva + ';transform:rotate(' + kot + 'deg);">➤</div>', iconSize: [22, 22], iconAnchor: [11, 11] }) });
                    cilj.addLayer(p);
                }
            } else if (e.vrsta === 'obmocje') {
                const po = L.polygon(e.tocke, { color: e.barva || '#ef4444', weight: izbran ? 6 : 3, fillColor: e.barva || '#ef4444', fillOpacity: 0.22, bubblingMouseEvents: false });
                if (e.opis) po.bindTooltip(e.opis, { permanent: true, direction: 'center', className: 'nacrt-oznaka' });
                cilj.addLayer(klik(po));
            } else if (e.vrsta === 'krog') {
                const k = L.circle([e.lat, e.lon], { radius: e.r, color: '#dc2626', weight: izbran ? 6 : 3, dashArray: '8,8', fillColor: '#dc2626', fillOpacity: 0.15, bubblingMouseEvents: false });
                k.bindTooltip((e.opis || 'Nevarno območje') + ' (' + Math.round(e.r) + ' m)', { permanent: true, direction: 'center', className: 'nacrt-oznaka' });
                cilj.addLayer(klik(k));
            }
        });
    }

    function osveziZemljevid() { narisi(skica(), sloj, map, true); }

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
            $('pal-vozila').appendChild(gumbPalete('<svg viewBox="0 0 56 56">' + svgVozila(v.oblika, 'gasilci') + '</svg>' + esc(v.tip), { kljuc: 'v:' + v.tip, vrsta: 'vozilo', tip: v.tip, oblika: v.oblika, sluzba: 'gasilci' }, v.opis));
        });
        $('pal-vozila').appendChild(gumbPalete('<svg viewBox="0 0 56 56">' + svgVozila('tovorno', 'gasilci') + '</svg>Drugo…', { kljuc: 'v:rocno', vrsta: 'vozilo', tip: '', oblika: 'tovorno', sluzba: 'gasilci', rocno: true }, 'Posebno vozilo od drugod - tip in kratico vpišeš ročno'));
        Object.keys(M.VOZILA_SLUZB).forEach(function (k) {
            const v = M.VOZILA_SLUZB[k];
            $('pal-sluzbe').appendChild(gumbPalete('<svg viewBox="0 0 56 56">' + svgVozila(v.oblika, k) + '</svg>' + esc(v.tip) + '<small>' + esc(M.SLUZBE[k].naziv) + '</small>', { kljuc: 's:' + k, vrsta: 'vozilo', tip: v.tip, oblika: v.oblika, sluzba: k }, M.SLUZBE[k].naziv));
        });
        Object.keys(M.ZNAKI).forEach(function (k) {
            const z = M.ZNAKI[k];
            $('pal-znaki').appendChild(gumbPalete('<span class="pal-znak" style="background:' + z.barva + ';' + (z.krog ? 'border-radius:50%;' : '') + '">' + esc(z.znak) + '</span><small>' + esc(z.naziv) + '</small>', { kljuc: 'z:' + k, vrsta: 'znak', znak: k }, z.naziv));
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
        $('orodje-besedilo').textContent = vecTock ? 'Tapkaj točke na zemljevidu, nato »Končaj«' : 'Tapni na zemljevid, kamor naj se postavi';
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
        } else if (o.vrsta === 'znak') { e.znak = o.znak; e.kot = 0; e.opis = ''; }
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
        izbranId = id;
        osveziZemljevid();
        osveziLastnosti();
    }

    function polje(oznaka, kljuc, vrednost, dodatno) {
        return '<label>' + esc(oznaka) + '</label><input type="' + ((dodatno && dodatno.tip) || 'text') + '" data-k="' + kljuc + '" value="' + esc(vrednost) + '" autocomplete="off"' + ((dodatno && dodatno.atributi) || '') + '>';
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
            h += polje('Naloga / opomba', 'opis', e.opis);
            h += kot;
        } else if (e.vrsta === 'znak') {
            h += '<div><b>' + esc(M.ZNAKI[e.znak].naziv) + '</b></div>' + polje('Napis', 'opis', e.opis);
            if (M.ZNAKI[e.znak].vrti) h += kot;
        } else if (e.vrsta === 'crta') {
            h += '<div><b>' + esc(M.CRTE[e.slog].naziv) + '</b></div>' + polje('Napis', 'opis', e.opis);
        } else if (e.vrsta === 'obmocje') {
            h += polje('Naziv sektorja', 'opis', e.opis) + '<label>Barva</label><div class="barve">' + M.BARVE_SEKTORJEV.map(function (b) { return '<button type="button" data-barva="' + b + '" class="' + (b === e.barva ? 'izbrana' : '') + '" style="background:' + b + '"></button>'; }).join('') + '</div>';
        } else if (e.vrsta === 'krog') {
            h += polje('Napis', 'opis', e.opis) + polje('Polmer (m)', 'r', e.r, { tip: 'number', atributi: ' min="5" step="5"' });
        } else if (e.vrsta === 'besedilo') {
            h += polje('Besedilo', 'opis', e.opis);
        }
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
                e.kot = (((e.kot || 0) + parseInt(b.dataset.kot, 10)) % 360 + 360) % 360;
                samodejnoShrani(); osveziZemljevid();
            });
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
        return { lat: c.lat, lon: c.lng, z: typeof z === 'number' ? z : ZACETEK.z };
    }
    function preklopiSkico(i) {
        if (i < 0 || i >= nacrt.skice.length) return;
        nastaviOrodje(null);
        idxSkice = i; izbranId = null;
        const p = skica().pogled;
        if (p) map.setView([p.lat, p.lon], p.z);
        osveziVse(false);
    }
    function osveziSeznamVozil() {
        const el = $('seznam-vozil');
        const vozila = skica().elementi.filter(function (e) { return e.vrsta === 'vozilo'; }).sort(function (a, b) { return (parseInt(a.st, 10) || 999) - (parseInt(b.st, 10) || 999); });
        el.innerHTML = vozila.length ? vozila.map(function (e) { return '<div data-id="' + esc(e.id) + '">' + esc(M.oznakaVozila(e)) + (e.opis ? ' - <span style="color:#94a3b8;">' + esc(e.opis) + '</span>' : '') + '</div>'; }).join('') : '<div class="namig">Na tej skici še ni vozil.</div>';
        Array.prototype.forEach.call(el.querySelectorAll('[data-id]'), function (v) {
            v.addEventListener('click', function () {
                const e = najdi(v.dataset.id);
                if (e) { map.setView([e.lat, e.lon], map.getZoom()); izberi(e.id); }
            });
        });
    }

    function osveziVse(tudiPogled) {
        $('naziv-nacrta').value = nacrt.naziv;
        document.title = 'EPV Načrt - ' + nacrt.naziv;
        if (tudiPogled) {
            const p = skica().pogled;
            if (p) map.setView([p.lat, p.lon], p.z);
        }
        osveziSkice(); osveziZemljevid(); osveziLastnosti(); osveziSeznamVozil();
    }

    // ---------- datoteke ----------
    function shraniVDatoteko() {
        skica().pogled = trenutniPogled();
        samodejnoShrani();
        const blob = new Blob([JSON.stringify(nacrt, null, 1)], { type: 'application/json' });
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
            h += '<table><thead><tr><th>Št.</th><th>Enota</th><th>Vozilo</th><th>Služba</th><th>Naloga / opomba</th></tr></thead><tbody>' + vozila.map(function (v) {
                return '<tr><td>' + esc(v.st) + '</td><td>' + esc(v.kratica) + (M.nazivDrustva(v.kratica) ? ' - ' + esc(M.nazivDrustva(v.kratica)) : '') + '</td><td>' + esc(v.tip) + '</td><td>' + esc((M.SLUZBE[v.sluzba] || {}).naziv || '') + '</td><td>' + esc(v.opis) + '</td></tr>';
            }).join('') + '</tbody></table>';
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
            h += '<table><thead><tr><th>Št.</th><th>Enota</th><th>Vozilo</th><th>Naloga / opomba</th></tr></thead><tbody>' + vozila.map(function (v) {
                return '<tr><td>' + esc(v.st) + '</td><td>' + esc(v.kratica) + '</td><td>' + esc(v.tip) + '</td><td>' + esc(v.opis) + '</td></tr>';
            }).join('') + '</tbody></table>';
        }
        const ostalo = sk.elementi.filter(function (e) { return e.vrsta !== 'vozilo'; }).map(function (e) {
            const vrsta = e.vrsta === 'znak' ? M.ZNAKI[e.znak].naziv : e.vrsta === 'crta' ? M.CRTE[e.slog].naziv : e.vrsta === 'obmocje' ? 'Sektor' : e.vrsta === 'krog' ? 'Nevarno območje (' + Math.round(e.r) + ' m)' : 'Besedilo';
            return esc(vrsta) + (e.opis ? ': ' + esc(e.opis) : '');
        });
        if (ostalo.length) h += '<p style="font-size:9.5pt;"><b>Oznake:</b> ' + ostalo.join('; ') + '</p>';
        return h;
    }

    function natisni(zElaboratom) {
        skica().pogled = trenutniPogled();
        samodejnoShrani();
        const cilj = $('tisk');
        let h = zElaboratom ? htmlElaborata() : '<h1>' + esc(nacrt.naziv) + '</h1>';
        nacrt.skice.forEach(function (s, i) {
            h += '<div class="tisk-skica' + (!zElaboratom && i === 0 ? ' prva' : '') + '"><h2>Skica ' + (i + 1) + ': ' + esc(s.naziv) + '</h2><div class="tisk-zemljevid" id="tisk-z-' + i + '"></div>' + legendaSkice(s) + '</div>';
        });
        h += '<p class="tisk-noga">EPV Načrt · izpis ' + esc(new Date().toLocaleString('sl-SI')) + '</p>';
        cilj.innerHTML = h;
        $('tisk-priprava').style.display = 'flex';

        const zemljevidi = [];
        const cakanja = nacrt.skice.map(function (s, i) {
            const m = L.map('tisk-z-' + i, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, zoomSnap: 0.25, fadeAnimation: false, zoomAnimation: false });
            zemljevidi.push(m);
            const plast = ustvariPodlago(trenutnaPodlaga).addTo(m);
            const meje = mejeSkice(s);
            if (s.pogled) m.setView([s.pogled.lat, s.pogled.lon], s.pogled.z);
            else if (meje) m.fitBounds(meje, { padding: [30, 30], maxZoom: 18 });
            else { const p = trenutniPogled(); m.setView([p.lat, p.lon], p.z); }
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
        document.addEventListener('keydown', function (ev) {
            if (ev.key === 'Escape') nastaviOrodje(null);
            if ((ev.key === 'Delete') && izbranId && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) $('btn-el-izbrisi') && $('btn-el-izbrisi').click();
            if ((ev.ctrlKey || ev.metaKey) && ev.key === 'z' && !/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) { ev.preventDefault(); razveljavi(); }
        });
        window.addEventListener('beforeunload', samodejnoShrani);

        // za teste in diagnostiko
        window.EPVNacrt = { stanje: function () { return { nacrt: nacrt, idxSkice: idxSkice, izbranId: izbranId, orodje: orodje }; }, postavi: postavi, nalozi: nalozi };
        osveziVse(false);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', zacni); else zacni();
})();
