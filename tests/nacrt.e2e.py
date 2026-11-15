# E2E test taktične table (nacrtEPV.html) v Chromiumu z nadomestkom za Leaflet.
# Preizkusi logiko (postavljanje, lastnosti, skice, shranjevanje, elaborat, izpis); NE preizkuša dejanskega izrisa zemljevida.
# Zagon: python3 tests/nacrt.e2e.py
import functools, http.server, json, os, re, sys, threading, time
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
    p.click('.pal[data-kljuc="s:resevalci"]'); p.evaluate("EPVNacrt.postavi(46.403, 15.603)")
    pri('reševalno vozilo: služba, brez kratice društva, št. 3', el()[2]['sluzba'] == 'resevalci' and el()[2]['kratica'] == '' and el()[2]['st'] == 3 and el()[2]['tip'] == 'NMP', el()[2])
    ikone = p.evaluate("window.__L.markers.map(m => (m.options.icon && m.options.icon.html) || '')")
    pri('ikona: napis s številko, kratico in tipom', any('1 · IMP · GVC-1' in i for i in ikone), ikone[-3:])
    pri('ikona: rumeno reševalno vozilo', any('#facc15' in i and '3 · NMP' in i for i in ikone))

    # posebno vozilo od drugod: ročni vpis
    p.fill('#drustvo-rocno', 'ce')
    p.click('.pal[data-kljuc="v:rocno"]'); p.evaluate("EPVNacrt.postavi(46.404, 15.604)")
    p.fill('#lastnosti [data-k="tip"]', 'TRV-2')
    p.fill('#lastnosti [data-k="opis"]', 'tehnično reševanje')
    pri('ročno vozilo: kratica in tip', el()[3]['kratica'] == 'CE' and el()[3]['tip'] == 'TRV-2' and el()[3]['opis'] == 'tehnično reševanje' and el()[3]['st'] == 4, el()[3])
    p.fill('#drustvo-rocno', '')

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

    # črta: premalo točk, nato končano
    p.click('.pal[data-kljuc="c:cevovod"]')
    p.evaluate("EPVNacrt.postavi(46.40, 15.60)")
    p.click('#btn-koncaj')
    pri('črta z eno točko se ne shrani', len(el()) == 6 and 'vsaj 2' in p.inner_text('#orodje-besedilo'), p.inner_text('#orodje-besedilo'))
    p.evaluate("EPVNacrt.postavi(46.41, 15.61)"); p.evaluate("EPVNacrt.postavi(46.42, 15.62)")
    p.click('#btn-koncaj')
    pri('cevovod s tremi točkami', el()[6]['vrsta'] == 'crta' and el()[6]['slog'] == 'cevovod' and len(el()[6]['tocke']) == 3, el()[6])
    # sektor
    p.click('.pal[data-kljuc="o:sektor"]')
    for a, c in ((46.40, 15.60), (46.41, 15.60), (46.41, 15.61)): p.evaluate(f"EPVNacrt.postavi({a}, {c})")
    p.click('#btn-koncaj')
    pri('sektor z imenom in barvo', el()[7]['vrsta'] == 'obmocje' and el()[7]['opis'] == 'Sektor 1' and el()[7]['barva'].startswith('#'), el()[7])
    # prekinitev risanja
    p.click('.pal[data-kljuc="c:napad"]'); p.evaluate("EPVNacrt.postavi(46.40, 15.60)"); p.keyboard.press('Escape')
    pri('Esc prekliče risanje', st()['orodje'] is None and len(el()) == 8)

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
    pri('elaborat: legenda skice', 'Poveljniško mesto' in t and 'Nevarno območje (120 m)' in t and 'Cevovod' in t)
    p.evaluate("window.dispatchEvent(new Event('afterprint'))")
    p.click('#btn-tisk-skice'); time.sleep(1.5)
    t2 = p.inner_text('#tisk')
    pri('izpis samo skic: brez elaborata', p.evaluate("window.__natisnjeno") == 2 and '1. Uvod' not in t2 and 'Skica 1: Lokacija' in t2)

    # elaborat se shrani z načrtom
    pri('elaborat je del načrta', st()['nacrt']['elaborat']['krajDatum'] == 'Slovenska Bistrica, 26. 9. 2026')
    b.close()

pri('brez JS napak', len(napake) == 0, napake[:5])
srv.shutdown()
print(f"Načrt E2E: {rez['ok']} uspešnih, {rez['fail']} napak.")
sys.exit(1 if rez['fail'] else 0)
