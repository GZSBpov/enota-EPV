# E2E test taktične table (nacrtEPV.html) v Chromiumu z nadomestkom za Leaflet.
# Preizkusi logiko (postavljanje, lastnosti, skice, shranjevanje, elaborat, izpis); NE preizkuša dejanskega izrisa zemljevida.
# Zagon: python3 tests/nacrt.e2e.py
import functools, http.server, json, os, re, sys, tempfile, threading, time, zipfile
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = 8811
BASE = f'http://127.0.0.1:{PORT}'
rez = {'ok': 0, 'fail': 0}
def pri(ime, pogoj, p=''):
    if pogoj: rez['ok'] += 1
    else:
        rez['fail'] += 1; print('NAPAKA:', ime, str(p)[:400])

class Tih(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Tih, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
stub = open(os.path.join(ROOT, 'tests', 'leaflet-stub.js'), encoding='utf-8').read()
napake = []

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(accept_downloads=True)
    ctx.add_init_script("window.EPV_TISK_CAKAJ_MS = 300; window.EPV_TISK_OHRANI = true;")
    def zunanje(route):
        u = route.request.url
        if 'leaflet@1.9.4/dist/leaflet.js' in u: route.fulfill(status=200, content_type='application/javascript', body=stub)
        elif u.endswith('.css'): route.fulfill(status=200, content_type='text/css', body='')
        else: route.abort()
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)'), zunanje)
    p = ctx.new_page()
    p.on('pageerror', lambda e: napake.append(str(e)))
    p.on('console', lambda m: napake.append('console: ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    odgovori = {'prompt': None}
    def dialog(d):
        if d.type == 'prompt': d.accept(odgovori['prompt'] if odgovori['prompt'] is not None else d.default_value)
        else: d.accept()
    p.on('dialog', dialog)

    p.goto(f'{BASE}/nacrtEPV.html?lat=46.4&lon=15.6&z=17&naziv=Vaja%20Impol')
    st = lambda: p.evaluate("EPVNacrt.stanje()")
    el = lambda: st()['nacrt']['skice'][st()['idxSkice']]['elementi']
    pri('naziv iz povezave EPV', p.input_value('#naziv-nacrta') == 'Vaja Impol')
    pri('pogled iz povezave EPV', st()['nacrt']['skice'][0]['pogled'] == {'lat': 46.4, 'lon': 15.6, 'z': 17}, st()['nacrt']['skice'][0]['pogled'])
    pri('povezava nazaj na štab EPV', p.get_attribute('#btn-epv', 'href') == 'mapeEPV.html' and p.is_visible('#btn-epv'))
    pri('tri privzete skice', [s['naziv'] for s in st()['nacrt']['skice']] == ['Lokacija', 'Evakuacija', 'Posredovanje'])
    pri('paleta: vsa gasilska vozila + ročno', p.locator('#pal-vozila .pal').count() == 18, p.locator('#pal-vozila .pal').count())
    pri('paleta: druge službe', p.locator('#pal-sluzbe .pal').count() == 5)
    pri('paleta: društva', p.locator('#drustvo option').count() == 14)

    # postavljanje vozil: številke prihoda in kratice
    p.click('.skica-vrstica[data-i="2"]')
    p.select_option('#drustvo', 'IMP')
    p.click('.pal[data-kljuc="v:GVC-1"]')
    pri('orodje aktivno, pasica vidna', p.is_visible('#orodje-pasica') and 'aktiven' in p.get_attribute('.pal[data-kljuc="v:GVC-1"]', 'class'))
    p.evaluate("window.__L.map.handlers.click.slice(-1)[0]({ latlng: { lat: 46.401, lng: 15.601 } })")
    pri('vozilo postavljeno s klikom na zemljevid', len(el()) == 1 and el()[0]['tip'] == 'GVC-1' and el()[0]['kratica'] == 'IMP' and el()[0]['st'] == 1 and el()[0]['lat'] == 46.401, el())
    pri('po postavitvi se orodje izklopi in element izbere', st()['orodje'] is None and st()['izbranId'] == el()[0]['id'] and not p.is_visible('#orodje-pasica'))
    p.select_option('#drustvo', 'SLB')
    p.click('.pal[data-kljuc="v:ALK32"]'); p.evaluate("EPVNacrt.postavi(46.402, 15.602)")
    pri('drugo vozilo dobi št. 2 in drugo kratico', el()[1]['st'] == 2 and el()[1]['kratica'] == 'SLB' and el()[1]['oblika'] == 'lestev', el()[1])
    # lestvenik se suka neodvisno od vozila; zasuk vozila ga nese s seboj
    zadnja = lambda: p.evaluate("window.__L.markers.filter(m => m.options.icon && String(m.options.icon.html).includes('nv-napis')).slice(-1)[0].options.icon.html")
    pri('ALK: gumbi za smer lestvenika', p.locator('#lastnosti [data-roka]').count() == 4 and 'lestvenika' in p.inner_text('#lastnosti'))
    p.click('#lastnosti [data-roka="45"]'); p.click('#lastnosti [data-roka="45"]')
    pri('lestvenik zasukan za 90° glede na vozilo', el()[1]['roka'] == 90 and el()[1]['kot'] == 0 and 'rotate(90 28 40)' in zadnja(), (el()[1], zadnja()[:200]))
    p.click('#lastnosti [data-kot="45"]')
    pri('zasuk vozila nese lestvenik s seboj', el()[1]['kot'] == 45 and el()[1]['roka'] == 135 and 'rotate(45 28 28)' in zadnja() and 'rotate(90 28 40)' in zadnja(), el()[1])
    p.click('#lastnosti [data-kot="-45"]')
    p.click('.pal[data-kljuc="s:resevalci"]'); p.evaluate("EPVNacrt.postavi(46.403, 15.603)")
    pri('reševalno vozilo: služba, brez kratice društva, št. 3', el()[2]['sluzba'] == 'resevalci' and el()[2]['kratica'] == '' and el()[2]['st'] == 3 and el()[2]['tip'] == 'NMP', el()[2])
    ikone = p.evaluate("window.__L.markers.map(m => (m.options.icon && m.options.icon.html) || '')")
    pri('ikona: napis s številko, kratico in tipom', any('1 · IMP · GVC-1' in i for i in ikone), ikone[-3:])
    pri('ikona: rumeno reševalno vozilo', any('#facc15' in i and '3 · NMP' in i for i in ikone))
    x_crt = lambda h: h.count('stroke="#fff" stroke-width="2.6"')
    pri('ikona: cisterna ima X, ostala vozila ne', any('1 · IMP · GVC-1' in i and x_crt(i) == 2 for i in ikone) and all(x_crt(i) == 0 for i in ikone if 'ALK32' in i or 'NMP' in i))
    kolesa = lambda h: h.count('rx="1.5" fill="#111827"')
    pri('paleta: GVC-3 in GTVD imata 6 koles, ostala vozila 4', kolesa(p.inner_html('.pal[data-kljuc="v:GVC-3"]')) == 6 and kolesa(p.inner_html('.pal[data-kljuc="v:GTVD"]')) == 6 and all(kolesa(p.inner_html(f'.pal[data-kljuc="{k}"]')) == 4 for k in ['v:GVC-1', 'v:GVC-2', 'v:PV-1', 'v:ALK32', 'v:ZD28', 'v:GVM', 's:policija', 's:resevalci']) and kolesa(p.inner_html('.pal[data-kljuc="v:UAV"]')) == 0)
    pri('ikona na zemljevidu: 4 kolesa pri GVC-1', any('1 · IMP · GVC-1' in i and kolesa(i) == 4 for i in ikone))
    pri('ikona: temno vetrobransko steklo', all('#1f2937' in i for i in ikone if 'nv-napis' in i))
    pri('paleta: GVC z X, GV-1 brez', 'stroke-width="2.6"' in p.inner_html('.pal[data-kljuc="v:GVC-2"]') and 'stroke-width="2.6"' not in p.inner_html('.pal[data-kljuc="v:GV-1"]'))
    pri('paleta: nove oznake in črte', p.locator('.pal[data-kljuc="z:nevsnov"], .pal[data-kljuc="z:repetitor"], .pal[data-kljuc="z:prazen"], .pal[data-kljuc="c:preiskovanje"]').count() == 4)

    # posebno vozilo od drugod: ročni vpis
    p.fill('#drustvo-rocno', 'ce')
    p.click('.pal[data-kljuc="v:rocno"]'); p.evaluate("EPVNacrt.postavi(46.404, 15.604)")
    p.fill('#lastnosti [data-k="tip"]', 'TRV-2')
    p.fill('#lastnosti [data-k="opis"]', 'tehnično reševanje')
    pri('ročno vozilo: kratica in tip', el()[3]['kratica'] == 'CE' and el()[3]['tip'] == 'TRV-2' and el()[3]['opis'] == 'tehnično reševanje' and el()[3]['st'] == 4, el()[3])
    p.fill('#drustvo-rocno', '')

    # posadka 1 + N
    p.fill('#lastnosti [data-k="posadka"]', '3')
    pri('posadka: vnos 1 + 3', el()[3]['posadka'] == 3 and '(1+3)' in p.inner_text('#seznam-vozil') and 'članov: 4' in p.inner_text('#povzetek-zaslon') and 'brez posadke: 3' in p.inner_text('#povzetek-zaslon'), (el()[3].get('posadka'), p.inner_text('#povzetek-zaslon')))
    p.fill('#lastnosti [data-k="posadka"]', '-4')
    pri('posadka: negativna vrednost se ne sprejme', el()[3]['posadka'] == '' and 'članov: 0' in p.inner_text('#povzetek-zaslon'), el()[3].get('posadka'))
    p.fill('#lastnosti [data-k="posadka"]', '3')
    for i, n in ((0, 5), (1, 2), (2, 1)):
        p.evaluate(f"(() => {{ const s = EPVNacrt.stanje(); s.nacrt.skice[s.idxSkice].elementi[{i}].posadka = {n}; }})()")
    # lastnosti: številka, zasuk
    p.fill('#lastnosti [data-k="st"]', '7')
    p.click('#lastnosti [data-kot="45"]'); p.click('#lastnosti [data-kot="45"]'); p.click('#lastnosti [data-kot="-15"]')
    pri('urejanje številke in zasuk', str(el()[3]['st']) == '7' and el()[3]['kot'] == 75, el()[3])
    pri('seznam vozil na skici', '7 · CE · TRV-2' in p.inner_text('#seznam-vozil') and '1 · IMP · GVC-1' in p.inner_text('#seznam-vozil'), p.inner_text('#seznam-vozil'))

    # oznaka, krog, besedilo
    p.click('.pal[data-kljuc="z:pm"]'); p.evaluate("EPVNacrt.postavi(46.405, 15.605)")
    p.click('.pal[data-kljuc="k:krog"]'); p.evaluate("EPVNacrt.postavi(46.406, 15.606)")
    p.fill('#lastnosti [data-k="r"]', '120')
    pri('oznaka in nevarno območje', el()[4]['znak'] == 'pm' and el()[5]['vrsta'] == 'krog' and el()[5]['r'] == 120, el()[4:])
    # nevarno območje: središče se premakne z ročico
    p.evaluate("(() => { const r = window.__L.markers.filter(m => m.rocica === 'sredisce').slice(-1)[0]; r.handlers.dragstart[0](); r.setLatLng([46.45, 15.65]); r.handlers.dragend[0](); })()")
    pri('nevarno območje: premik središča', el()[5]['lat'] == 46.45 and el()[5]['lon'] == 15.65 and el()[5]['r'] == 120, el()[5])
    p.click('#btn-razveljavi')
    pri('premik središča se da razveljaviti', el()[5]['lat'] == 46.406)

    # črta: premalo točk, nato končano
    p.click('.pal[data-kljuc="c:cevovod"]')
    p.evaluate("EPVNacrt.postavi(46.40, 15.60)")
    p.click('#btn-koncaj')
    pri('črta z eno točko se ne shrani', len(el()) == 6 and 'vsaj 2' in p.inner_text('#orodje-besedilo'), p.inner_text('#orodje-besedilo'))
    p.evaluate("EPVNacrt.postavi(46.41, 15.61)"); p.evaluate("EPVNacrt.postavi(46.42, 15.62)")
    p.click('#btn-koncaj')
    pri('cevovod s tremi točkami', el()[6]['vrsta'] == 'crta' and el()[6]['slog'] == 'cevovod' and len(el()[6]['tocke']) == 3, el()[6])
    # črta: črna obroba in izbira barve
    crte = lambda: p.evaluate("window.__L.polylines.slice(-3).map(l => [l.options.color, l.options.weight, l.options.interactive, l.options.opacity])")
    pri('črta ima temno obrobo pod barvo', crte()[0][0] == '#0f172a' and crte()[0][2] is False and crte()[0][1] > crte()[1][1] and crte()[1][0] == '#38bdf8', crte())
    pri('črta: nevidna široka črta za lažji klik', crte()[2][3] == 0 and crte()[2][1] >= 24, crte())
    pri('črta: izbira barve v lastnostih', p.locator('#lastnosti [data-barva]').count() == 9)
    p.click('#lastnosti [data-barva="#fde047"]')
    pri('črta: barva spremenjena', el()[6]['barva'] == '#fde047' and crte()[1][0] == '#fde047' and crte()[0][0] == '#0f172a', (el()[6].get('barva'), crte()))
    p.click('#btn-razveljavi')
    pri('črta: sprememba barve se da razveljaviti', 'barva' not in el()[6])
    # sektor
    p.click('.pal[data-kljuc="o:sektor"]')
    for a, c in ((46.40, 15.60), (46.41, 15.60), (46.41, 15.61)): p.evaluate(f"EPVNacrt.postavi({a}, {c})")
    p.click('#btn-koncaj')
    pri('sektor z imenom in barvo', el()[7]['vrsta'] == 'obmocje' and el()[7]['opis'] == 'Sektor 1' and el()[7]['barva'].startswith('#'), el()[7])
    # urejanje točk sektorja: premik, dodajanje, odstranjevanje
    rocice = lambda vrsta: p.evaluate("(v) => { const vse = window.__L.markers.filter(m => m.rocica === v); const zadnji = []; for (let i = vse.length - 1; i >= 0; i--) { if (zadnji.some(z => z === vse[i].indeks)) break; zadnji.push(vse[i].indeks); } return zadnji.length; }", vrsta)
    pri('sektor: ročice za 3 točke in 3 vmesne', rocice('tocka') == 3 and rocice('nova') == 3, (rocice('tocka'), rocice('nova')))
    pri('sektor: gumb za odstranitev je onemogočen brez izbrane točke', p.is_disabled('#btn-tocka-odstrani'))
    p.evaluate("(() => { const r = window.__L.markers.filter(m => m.rocica === 'tocka' && m.indeks === 1).slice(-1)[0]; r.handlers.dragstart[0](); r.setLatLng([46.415, 15.595]); r.handlers.dragend[0](); })()")
    pri('sektor: premik točke', el()[7]['tocke'][1] == [46.415, 15.595], el()[7]['tocke'])
    p.evaluate("window.__L.markers.filter(m => m.rocica === 'nova' && m.indeks === 2).slice(-1)[0].handlers.click[0]()")
    pri('sektor: nova točka na sredini zadnjega odseka', len(el()[7]['tocke']) == 4 and abs(el()[7]['tocke'][3][0] - 46.405) < 1e-9 and abs(el()[7]['tocke'][3][1] - 15.605) < 1e-9, el()[7]['tocke'])
    pri('sektor: nova točka je izbrana, odstranitev omogočena', not p.is_disabled('#btn-tocka-odstrani'))
    p.click('#btn-tocka-odstrani')
    pri('sektor: odstranitev točke', len(el()[7]['tocke']) == 3 and el()[7]['tocke'][1] == [46.415, 15.595], el()[7]['tocke'])
    p.evaluate("window.__L.markers.filter(m => m.rocica === 'tocka' && m.indeks === 0).slice(-1)[0].handlers.click[0]()")
    pri('sektor: pod 3 točke ne gre', p.is_disabled('#btn-tocka-odstrani'))
    # legenda na zaslonu
    leg = p.inner_text('#legenda')
    pri('legenda na zaslonu: uporabljeni znaki', p.is_visible('#legenda') and all(x in leg for x in ['Legenda', 'Gasilsko vozilo', 'Cisterna (X)', 'Vozilo: Reševalci (NMP)', 'Poveljniško mesto', 'Cevovod', 'Sektor 1', 'Nevarno območje', 'Vrstni red prihoda']) and 'Napad' not in leg and 'Policija' not in leg, leg)
    # prekinitev risanja
    p.click('.pal[data-kljuc="c:napad"]'); p.evaluate("EPVNacrt.postavi(46.40, 15.60)"); p.keyboard.press('Escape')
    pri('Esc prekliče risanje', st()['orodje'] is None and len(el()) == 8)
    pri('napad je moder', '#1d4ed8' in p.inner_html('.pal[data-kljuc="c:napad"]') and '#dc2626' in p.inner_html('.pal[data-kljuc="c:preiskovanje"]'))

    # izbira s klikom na element in brisanje, razveljavi
    p.evaluate("window.__L.markers.filter(m => m.options.icon && String(m.options.icon.html).includes('1 · IMP')).slice(-1)[0].handlers.click[0]({})")
    pri('klik na vozilo ga izbere', st()['izbranId'] == el()[0]['id'] and p.input_value('#lastnosti [data-k="kratica"]') == 'IMP')
    p.click('#btn-el-izbrisi')
    pri('izbris elementa', len(el()) == 7 and el()[0]['tip'] == 'ALK32')
    p.click('#btn-razveljavi')
    pri('razveljavi vrne izbrisano', len(el()) == 8 and el()[0]['tip'] == 'GVC-1')
    # premik z vlečenjem
    p.evaluate("(() => { const m = window.__L.markers.filter(m => m.options.icon && String(m.options.icon.html).includes('1 · IMP')).slice(-1)[0]; m.handlers.dragstart[0](); m.setLatLng([46.5, 15.7]); m.handlers.dragend[0](); })()")
    pri('vlečenje premakne vozilo', el()[0]['lat'] == 46.5 and el()[0]['lon'] == 15.7, el()[0])

    # skice: naslednji korak (kopija), nova, preimenuj, izbriši
    odgovori['prompt'] = '16:08 prihod ALK'
    p.click('#btn-skica-podvoji')
    pri('naslednji korak je kopija s svojimi elementi', len(st()['nacrt']['skice']) == 4 and st()['idxSkice'] == 3 and len(el()) == 8 and st()['nacrt']['skice'][3]['naziv'] == '16:08 prihod ALK')
    p.click('.pal[data-kljuc="v:GVC-2"]'); p.evaluate("EPVNacrt.postavi(46.407, 15.607)")
    pri('številčenje se nadaljuje v kopiji', el()[8]['st'] == 8, el()[8])
    pri('prejšnji korak ostane nespremenjen', len(st()['nacrt']['skice'][2]['elementi']) == 8)
    odgovori['prompt'] = 'Začasna'
    p.click('#btn-skica-nova')
    pri('nova prazna skica', len(st()['nacrt']['skice']) == 5 and len(el()) == 0)
    p.click('#btn-skica-izbrisi')
    pri('izbris skice', len(st()['nacrt']['skice']) == 4)
    odgovori['prompt'] = None

    # shrani v datoteko -> nov načrt -> odpri datoteko
    p.fill('#naziv-nacrta', 'Vaja Impol 2026')
    with p.expect_download() as dl:
        p.click('#btn-shrani')
    pot = dl.value.path()
    pri('ime shranjene datoteke', dl.value.suggested_filename == 'Vaja_Impol_2026.epvnacrt.json', dl.value.suggested_filename)
    shranjeno = json.load(open(pot, encoding='utf-8'))
    pri('datoteka vsebuje načrt', shranjeno['vrsta'] == 'epv-nacrt' and len(shranjeno['skice']) == 4 and len(shranjeno['skice'][3]['elementi']) == 9)
    p.click('#btn-novo')
    pri('nov načrt je prazen', st()['nacrt']['naziv'] == 'Nov načrt' and all(len(s['elementi']) == 0 for s in st()['nacrt']['skice']))
    p.set_input_files('#datoteka', pot)
    pri('odprt načrt iz datoteke', (lambda: (time.sleep(0.5), st()['nacrt']['naziv'] == 'Vaja Impol 2026' and len(st()['nacrt']['skice']) == 4 and len(st()['nacrt']['skice'][2]['elementi']) == 8)[1])())
    slaba = os.path.join(os.path.dirname(pot), 'slaba.json'); open(slaba, 'w').write('{"ni":"nacrt"}')
    p.set_input_files('#datoteka', slaba); time.sleep(0.4)
    pri('napačna datoteka ne pokvari načrta', st()['nacrt']['naziv'] == 'Vaja Impol 2026')

    # samodejno shranjevanje preživi osvežitev strani
    p.reload()
    pri('po osvežitvi je načrt še tu', st()['nacrt']['naziv'] == 'Vaja Impol 2026' and len(st()['nacrt']['skice'][2]['elementi']) == 8)

    # elaborat: predloga, vnos, izpis s skicami
    p.add_script_tag(content='window.print = function () { window.__natisnjeno = (window.__natisnjeno || 0) + 1; };')
    p.click('#btn-elaborat')
    pri('elaborat: predloga s polji', p.is_visible('#elaborat-okno') and p.locator('#elaborat-polja [data-e]').count() == 14 and 'Gasilska zveza' in p.input_value('[data-e="organizator"]'))
    p.fill('[data-e="scenarij"]', 'Potres, požar v obratu <b>FinAl</b>.')
    p.fill('[data-e="casovnica"]', '16:06 prihod GE Impol\n16:08 prihod GE Slov. Bistrica z ALK\nzaključek vaje')
    p.fill('[data-e="krajDatum"]', 'Slovenska Bistrica, 26. 9. 2026')
    p.click('#btn-elaborat-tisk')
    pri('elaborat: izpis sprožen', (lambda: (time.sleep(1.5), p.evaluate("window.__natisnjeno") == 1)[1])())
    t = p.inner_text('#tisk'); h = p.inner_html('#tisk')
    pri('elaborat: naslov, datum in poglavja', 'Vaja Impol 2026' in t and 'Slovenska Bistrica, 26. 9. 2026' in t and '1. Uvod' in t and '3. Scenarij' in t and '4. Taktični nastop enot' in t, t[:300])
    pri('elaborat: besedilo je varno izpisano (brez HTML)', '&lt;b&gt;FinAl&lt;/b&gt;' in h and '<b>FinAl</b>' not in h)
    pri('elaborat: časovnica razdeljena na čas in aktivnost', '<td>16:06</td><td>prihod GE Impol</td>' in h and '<td></td><td>zaključek vaje</td>' in h, h[h.find('16:06')-40:h.find('16:06')+80])
    pri('elaborat: tabela vozil iz skic', 'PGD Slovenska Bistrica' in t and 'ALK32' in t and 'Reševalci (NMP)' in t and 'tehnično reševanje' in t)
    pri('elaborat: skice na koncu', p.locator('#tisk .tisk-zemljevid').count() == 4 and 'Skica 3: Posredovanje' in t and 'Skica 4: 16:08 prihod ALK' in t)
    pri('izpis: legenda v treh stolpcih', p.evaluate("getComputedStyle(document.querySelector('#tisk .nl-vrsta')).gridTemplateColumns.split(' ').length") == 3)
    pri('izpis: legenda je pod skico in nad tabelo vozil, ne na zemljevidu', p.locator('#tisk .tisk-zemljevid-okvir .nacrt-legenda').count() == 0 and p.locator('#tisk .tisk-skica > .nacrt-legenda.nl-vrsta').count() == 2 and p.evaluate("Array.from(document.querySelectorAll('#tisk .tisk-skica')).filter(s => s.querySelector('.nl-vrsta')).every(s => { const d = Array.from(s.children); const l = d.findIndex(x => x.classList.contains('nl-vrsta')); return d[l - 1].classList.contains('tisk-zemljevid-okvir') && d[l + 1].tagName === 'TABLE'; })"))
    pri('izpis: legenda vsebuje uporabljene znake', 'Poveljniško mesto' in p.inner_text('#tisk .nl-vrsta >> nth=0') and 'Cisterna (X)' in t)
    tisk_ikone = p.evaluate("window.__L.markers.slice(-40).map(m => (m.options.icon && m.options.icon.html) || '').filter(h => h.includes('nv-napis'))")
    pri('izpis: pod vozili samo številke', len(tisk_ikone) > 0 and all(re.search(r'nv-napis">\d+</span>', h) for h in tisk_ikone[-9:]), tisk_ikone[-2:])
    pri('izpis: tabela vozil pod skico s posadko', '<td>SLB</td><td>ALK32</td><td>1+2</td>' in h and '<th>Posadka</th>' in h, h[h.find('ALK32')-60:h.find('ALK32')+60])
    pri('izpis: poročilo o sodelujočih pod skico', 'Poročilo o sodelujočih' in t and 'Skupno število sodelujočih: 15' in t and 'enot: 4, vozil: 4' in t and '<td>PGD Slovenska Bistrica</td><td>1</td><td>ALK32</td><td>3</td>' in h and 'Skupaj enot: 4' in t, t[t.find('Poročilo o'):t.find('Poročilo o')+400])
    pri('elaborat: skupni povzetek sodelujočih', 'Sodelujoči skupaj' in t)
    p.evaluate("window.dispatchEvent(new Event('afterprint'))")
    p.click('#btn-tisk-skice'); time.sleep(1.5)
    t2 = p.inner_text('#tisk')
    pri('izpis samo skic: brez elaborata', p.evaluate("window.__natisnjeno") == 2 and '1. Uvod' not in t2 and 'Skica 1: Lokacija' in t2)

    # ---- vrstni red: v ozadje / v ospredje ----
    p.click('.skica-vrstica[data-i="2"]')
    p.evaluate("window.__L.markers.filter(m => m.options.icon && String(m.options.icon.html).includes('1 · IMP')).slice(-1)[0].handlers.click[0]({})")
    id_gvc = st()['izbranId']
    plast = lambda: p.evaluate("(() => { const m = window.__L.markers.filter(m => m.options.icon && String(m.options.icon.html).includes('1 · IMP')).slice(-1)[0]; return [m.options.pane, m.options.zIndexOffset]; })()")
    pri('vrstni red: privzeto v ospredju', plast()[0] == 'markerPane' and 'plast' not in el()[0])
    p.click('#btn-el-ozadje')
    pri('ikona v ozadju: pod črtami (svoja plast), prva v seznamu', el()[0]['id'] == id_gvc and el()[0]['plast'] == 'ozadje' and plast()[0] == 'epvOzadje' and st()['izbranId'] == id_gvc and 'v ozadju' in p.inner_text('#lastnosti'), (el()[0].get('plast'), plast()))
    p.click('#btn-el-ospredje')
    pri('ikona v ospredju: zadnja v seznamu, nad ostalimi ikonami', el()[-1]['id'] == id_gvc and 'plast' not in el()[-1] and plast()[0] == 'markerPane' and plast()[1] == len(el()) * 3000, (plast(), len(el())))
    p.click('#btn-razveljavi'); p.click('#btn-razveljavi')
    pri('vrstni red se da razveljaviti', el()[0]['id'] == id_gvc and 'plast' not in el()[0])
    sektor_id = [x for x in el() if x['vrsta'] == 'obmocje'][0]['id']
    p.evaluate("EPVNacrt.izberi && 0")

    # ---- napisi: skupno stikalo in izklop pri posameznem elementu ----
    p.click('.skica-vrstica[data-i="2"]')
    napisi = lambda: p.evaluate("(() => { const n = EPVNacrt.stanje().nacrt.skice[2].elementi.length; return window.__L.markers.slice(-60).map(m => (m.options.icon && m.options.icon.html) || '').filter(h => h.includes('class=\"nv') || h.includes('class=\"nz')).slice(-6); })()")
    pri('napisi so privzeto vidni', p.is_checked('#napisi-vidni') and any('nv-napis' in h for h in napisi()), napisi()[:1])
    p.uncheck('#napisi-vidni')
    pri('napisi skriti pri vozilih in oznakah', st()['nacrt']['napisi'] is False and all('nv-napis' not in h for h in napisi()), napisi()[:2])
    pri('napisi skriti pri črtah, sektorjih in krogu', p.evaluate("(() => { const k = window.__L.circles.slice(-1)[0]; return k.tooltip === null; })()"))
    p.check('#napisi-vidni')
    pri('napisi spet vidni', st()['nacrt']['napisi'] is True and any('1 · IMP · GVC-1' in h for h in napisi()))
    p.evaluate("window.__L.markers.filter(m => m.options.icon && String(m.options.icon.html).includes('1 · IMP')).slice(-1)[0].handlers.click[0]({})")
    p.uncheck('#chk-el-napis')
    pri('napis skrit samo pri enem vozilu', el()[0].get('skrijNapis') is True and not any('1 · IMP' in h for h in napisi()) and any('nv-napis' in h for h in napisi()), napisi())
    p.check('#chk-el-napis')
    pri('napis pri vozilu spet viden', 'skrijNapis' not in el()[0] and any('1 · IMP · GVC-1' in h for h in napisi()))

    # ---- območje zveze in gasilski domovi: KML, KMZ, ročno, prikaz, shranjevanje ----
    kml = '''<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Gasilska Zveza</name>
      <Folder><Placemark><name>PGD Slovenska Bistrica</name><Point><coordinates>15.5746,46.3934,0</coordinates></Point></Placemark>
      <Placemark><name>PGD Kebelj &amp; okolica</name><Point><coordinates> 15.44,46.43,0 </coordinates></Point></Placemark></Folder>
      <Placemark><name>Območje GZ</name><Polygon><outerBoundaryIs><LinearRing><coordinates>15.4,46.3,0 15.7,46.3,0 15.7,46.5,0 15.4,46.5,0 15.4,46.3,0</coordinates></LinearRing></outerBoundaryIs>
        <innerBoundaryIs><LinearRing><coordinates>15.5,46.35,0 15.6,46.35,0 15.6,46.4,0</coordinates></LinearRing></innerBoundaryIs></Polygon></Placemark>
      <Placemark><name>Meja sektorja</name><LineString><coordinates>15.5,46.3,0 15.5,46.5,0</coordinates></LineString></Placemark></Document></kml>'''
    tmp = tempfile.mkdtemp()
    pot_kml = os.path.join(tmp, 'gz.kml'); open(pot_kml, 'w', encoding='utf-8').write(kml)
    os_ = lambda: st()['osnova']
    p.click('#btn-osnova')
    pri('osnova: okno z navodilom za Google Earth', p.is_visible('#osnova-okno') and 'Google Earth' in p.inner_text('#osnova-okno'))
    p.set_input_files('#osnova-datoteka', pot_kml)
    pri('KML: uvoženi domovi in obrisi', (lambda: (time.sleep(0.6), len(os_()['tocke']) == 2 and len(os_()['obrisi']) == 2)[1])(), os_())
    pri('KML: ime in lega doma (lon,lat pravilno obrnjena)', os_()['tocke'][0] == {'naziv': 'PGD Slovenska Bistrica', 'lat': 46.3934, 'lon': 15.5746} and os_()['tocke'][1]['naziv'] == 'PGD Kebelj & okolica', os_()['tocke'])
    pri('KML: poligon vzame zunanji rob, črta ostane odprta', os_()['obrisi'][0]['zaprto'] is True and len(os_()['obrisi'][0]['tocke']) == 5 and os_()['obrisi'][1]['zaprto'] is False, os_()['obrisi'])
    pri('osnova: sporočilo o uvozu', 'Uvoženo: domov 2, obrisov 2' in p.inner_text('#osnova-uvoz-stanje'), p.inner_text('#osnova-uvoz-stanje'))
    p.set_input_files('#osnova-datoteka', pot_kml); time.sleep(0.5)
    pri('osnova: ponovni uvoz ne podvaja', len(os_()['tocke']) == 2 and len(os_()['obrisi']) == 2)
    # KMZ (stisnjen arhiv)
    kml2 = kml.replace('PGD Slovenska Bistrica', 'PGD Oplotnica').replace('15.5746,46.3934', '15.4467,46.3878')
    pot_kmz = os.path.join(tmp, 'gz.kmz')
    with zipfile.ZipFile(pot_kmz, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('files/ikona.txt', 'x' * 50); z.writestr('doc.kml', kml2)
    p.set_input_files('#osnova-datoteka', pot_kmz)
    pri('KMZ: razširjen in uvožen', (lambda: (time.sleep(0.8), any(t['naziv'] == 'PGD Oplotnica' and abs(t['lat'] - 46.3878) < 1e-9 for t in os_()['tocke']) and len(os_()['tocke']) == 3)[1])(), (os_()['tocke'], p.inner_text('#osnova-uvoz-stanje')))
    slaba_kml = os.path.join(tmp, 'slaba.kml'); open(slaba_kml, 'w').write('to ni kml <<<')
    p.set_input_files('#osnova-datoteka', slaba_kml); time.sleep(0.5)
    pri('osnova: napačna datoteka javi napako in ne pokvari', '⚠️' in p.inner_text('#osnova-uvoz-stanje') and len(os_()['tocke']) == 3, p.inner_text('#osnova-uvoz-stanje'))
    # ročno dodajanje s klikom
    odgovori['prompt'] = 'PGD Tinje'
    p.click('#btn-osnova-dodaj')
    pri('osnova: dodajanje s klikom - okno se zapre, pasica', not p.is_visible('#osnova-okno') and 'gasilski dom' in p.inner_text('#orodje-besedilo'))
    p.evaluate("EPVNacrt.postavi(46.41, 15.48)")
    odgovori['prompt'] = None
    pri('osnova: dom dodan ročno', os_()['tocke'][-1] == {'naziv': 'PGD Tinje', 'lat': 46.41, 'lon': 15.48} and st()['orodje'] is None, os_()['tocke'][-1])
    pri('osnova: ročni dom ni element skice', all(x.get('opis') != 'PGD Tinje' for x in el()))
    domovi = lambda: p.evaluate("(() => { const vse = window.__L.markers.filter(m => m.osnovaDom !== undefined); return vse.slice(-4).map(m => m.osnovaDom); })()")
    pri('osnova: domovi so narisani', 'PGD Tinje' in domovi() and 'PGD Oplotnica' in domovi(), domovi())
    pri('osnova: stanje v stranskem stolpcu', 'Domov: 4 · obrisov: 2' in p.inner_text('#osnova-stanje'), p.inner_text('#osnova-stanje'))
    p.click('.skica-vrstica[data-i="2"]')
    pri('legenda: gasilski dom in območje zveze', 'Gasilski dom' in p.inner_text('#legenda') and 'Območje zveze' in p.inner_text('#legenda'), p.inner_text('#legenda'))
    # dovoz od doma: klik na dom med risanjem postavi točko natanko na dom
    p.click('.pal[data-kljuc="c:dovoz"]')
    p.evaluate("window.__L.markers.filter(m => m.osnovaDom === 'PGD Oplotnica').slice(-1)[0].handlers.click[0]()")
    p.evaluate("EPVNacrt.postavi(46.40, 15.60)"); p.click('#btn-koncaj')
    pri('dovoz se začne natanko na gasilskem domu', el()[-1]['slog'] == 'dovoz' and el()[-1]['tocke'][0] == [46.3878, 15.4467], el()[-1])
    # prikaz izklopljen
    stevilo_pred = p.evaluate("window.__L.markers.filter(m => m.osnovaDom !== undefined).length")
    p.uncheck('#osnova-vidna')
    pri('osnova: izklop prikaza', st()['osnovaVidna'] is False and p.evaluate("window.__L.markers.filter(m => m.osnovaDom !== undefined).length") == stevilo_pred and 'Gasilski dom' not in p.inner_text('#legenda'))
    p.check('#osnova-vidna')
    # v datoteki in po osvežitvi
    with p.expect_download() as dl2:
        p.click('#btn-shrani')
    shr2 = json.load(open(dl2.value.path(), encoding='utf-8'))
    pri('osnova je shranjena v datoteki načrta', len(shr2['osnova']['tocke']) == 4 and len(shr2['osnova']['obrisi']) == 2)
    p.reload()
    p.add_script_tag(content='window.print = function () { window.__natisnjeno = (window.__natisnjeno || 0) + 1; };')
    pri('osnova ostane po osvežitvi strani', len(os_()['tocke']) == 4 and st()['osnovaVidna'] is True)
    p.evaluate("window.__natisnjeno = 2")
    # brisanje posameznega vnosa
    p.click('#btn-osnova'); p.click('[data-os-tocka="0"]')
    pri('osnova: brisanje enega doma', len(os_()['tocke']) == 3 and os_()['tocke'][0]['naziv'] != 'PGD Slovenska Bistrica')
    p.click('#btn-osnova-zapri')
    # druga naprava brez osnove jo prevzame iz datoteke
    p.evaluate("localStorage.removeItem('epv_nacrt_osnova')"); p.reload()
    p.add_script_tag(content='window.print = function () { window.__natisnjeno = (window.__natisnjeno || 0) + 1; };')
    p.evaluate("window.__natisnjeno = 2")
    pri('prazna naprava: brez osnove', len(os_()['tocke']) == 0)
    p.set_input_files('#datoteka', dl2.value.path()); time.sleep(0.6)
    pri('prazna naprava prevzame osnovo iz datoteke načrta', len(os_()['tocke']) == 4 and 'osnova' not in st()['nacrt'], os_())

    # obrazec za prijavo vaje (ReCO)
    p.evaluate("window.dispatchEvent(new Event('afterprint'))")
    p.click('#btn-obrazec')
    pri('obrazec: prazen s stalnimi besedili', p.is_visible('#obrazec-okno') and p.input_value('[data-o="gz"]') == 'Slovenska Bistrica' and p.input_value('[data-o="dne"]') == '' and p.input_value('[data-o="vodja"]') == '' and p.input_value('[data-o="kanal"]') == '')
    p.fill('[data-o="dne"]', '3. 7. 2026'); p.fill('[data-o="ob"]', '19.45'); p.fill('[data-o="lokacija"]', 'Kovača vas <108>')
    p.fill('[data-o="scenarij"]', 'Odkritje in prijava | Opazovalec | 19:45\nEvakuacija, gašenje | GE | ')
    p.click('#btn-obrazec-tisk'); time.sleep(0.6)
    ob = p.inner_text('#tisk'); obh = p.inner_html('#tisk')
    pri('obrazec: izpis sprožen', p.evaluate("window.__natisnjeno") == 3)
    pri('obrazec: razdelki', all(x in ob for x in ['GASILSKA ZVEZA: Slovenska Bistrica', 'VODSTVO VAJE', 'SCENARIJ VAJE', 'Imitacija', 'Načrt zavarovanja', 'NAČRT ZVEZ', 'Zaključek vaje', 'Poveljstvo', 'Uradni list RS']), ob[:300])
    pri('obrazec: vnosi in scenarij po stolpcih', '3. 7. 2026' in ob and '<td>Odkritje in prijava</td><td>Opazovalec</td><td>19:45</td>' in obh and 'Kovača vas &lt;108&gt;' in obh)
    pri('obrazec: sodelujoča PGD iz skic', 'PIGD Impol' in ob and 'PGD Slovenska Bistrica' in ob)
    pri('obrazec: je del načrta', st()['nacrt']['obrazec']['dne'] == '3. 7. 2026')

    # elaborat se shrani z načrtom
    pri('elaborat je del načrta', st()['nacrt']['elaborat']['krajDatum'] == 'Slovenska Bistrica, 26. 9. 2026')
    # novi znaki, velikost znaka, napis v okvirčku, velikost ikon na skici
    p.evaluate("document.querySelectorAll('.okno-ozadje').forEach(o => o.style.display = 'none')")
    zadnja_ikona = lambda: p.evaluate("String(window.__L.markers.filter(m => m.options.icon && m.options.draggable).slice(-1)[0].options.icon.html)")
    pri('novi znaki v paleti', all(p.query_selector(f'.pal[data-kljuc="z:{k}"] svg') is not None for k in ['lestev', 'crpalka', 'elektrika', 'skupina', 'pozar', 'veter']))
    p.click('.pal[data-kljuc="z:pozar"]'); p.evaluate("EPVNacrt.postavi(46.4051, 15.6051)")
    p.evaluate("window.__L.markers.filter(m => m.options.icon && m.options.draggable).slice(-1)[0].handlers.click[0]({})")
    pri('požar: izbran, ponujena velikost znaka', el()[-1]['znak'] == 'pozar' and st()['izbranId'] == el()[-1]['id'] and p.query_selector('[data-vel="0.2"]') is not None)
    p.click('[data-vel="0.2"]'); p.click('[data-vel="0.2"]')
    izbran = lambda: [x for x in el() if x['id'] == st()['izbranId']][0]
    pri('požar: večji znak', izbran()['vel'] == 1.4 and '140 %' in p.inner_text('#lastnosti') and 'scale(1.4)' in p.evaluate("String(window.__L.markers.filter(m => m.options.icon && String(m.options.icon.html).includes('prosto')).slice(-1)[0].options.icon.html)"))
    p.click('[data-vel="0"]')
    pri('požar: običajna velikost pobriše nastavitev', 'vel' not in izbran())
    p.click('.pal[data-kljuc="b:besedilo"]'); p.evaluate("EPVNacrt.postavi(46.4052, 15.6052)")
    if p.query_selector('textarea[data-k="opis"]') is None:
        p.evaluate("window.__L.markers.filter(m => m.options.icon && String(m.options.icon.html).includes('class=\"nb')).slice(-1)[0].handlers.click[0]({})")
    p.fill('textarea[data-k="opis"]', 'Napad po lestvi v drugo nadstropje')
    p.click('[data-bes="vel+"]'); p.click('[data-bes="sir+"]')
    html_b = p.evaluate("String(window.__L.markers.filter(m => m.options.icon && String(m.options.icon.html).includes('class=\"nb')).slice(-1)[0].options.icon.html)")
    pri('napis: večja pisava in širina okvirja z zalomom', izbran()['velikost'] == 15 and izbran()['sirina'] == 200 and 'font-size:15px' in html_b and 'width:200px' in html_b and 'zalomljen' in html_b and 'Napad po lestvi' in html_b, html_b)
    p.click('[data-bes="sir0"]'); p.click('[data-bes="vel0"]')
    pri('napis: nazaj na običajno', 'sirina' not in izbran() and 'velikost' not in izbran())
    p.fill('#merilo-skice', '70'); p.dispatch_event('#merilo-skice', 'input'); p.dispatch_event('#merilo-skice', 'change')
    pri('velikost ikon na skici: 70 %', st()['nacrt']['skice'][st()['idxSkice']]['merilo'] == 0.7 and p.evaluate("document.getElementById('zemljevid').style.getPropertyValue('--nm')") == '0.7' and p.inner_text('#merilo-vrednost') == '70 %')
    drugi = 0 if st()['idxSkice'] != 0 else 1
    p.click(f'.skica-vrstica[data-i="{drugi}"]')
    pri('velikost ikon velja samo za svojo skico', p.input_value('#merilo-skice') == '100' and p.evaluate("document.getElementById('zemljevid').style.getPropertyValue('--nm')") == '1')
    pri('gumb za sliko skice', p.is_visible('#btn-slika'))
    b.close()

pri('brez JS napak', len(napake) == 0, napake[:5])
srv.shutdown()
print(f"Načrt E2E: {rez['ok']} uspešnih, {rez['fail']} napak.")
sys.exit(1 if rez['fail'] else 0)
