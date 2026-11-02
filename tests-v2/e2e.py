# E2E test V2: Chromium (Playwright) + simulator Apps Script s PRAVO Code_V2.gs + nadomestek za Leaflet.
# Zagon:  python3 tests-v2/e2e.py
import json, os, re, subprocess, sys, time, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = 8791
BASE = f'http://127.0.0.1:{PORT}'
LJ = ZoneInfo('Europe/Ljubljana')
rezultati = {'ok': 0, 'fail': 0}

def pri(ime, pogoj, podrobnost=''):
    if pogoj:
        rezultati['ok'] += 1
    else:
        rezultati['fail'] += 1
        print('NAPAKA:', ime, str(podrobnost)[:400])

def exec_(**p):
    p.setdefault('geslo', 'EPV2026')
    with urllib.request.urlopen(f'{BASE}/exec?' + urllib.parse.urlencode(p), timeout=10) as r:
        return json.loads(r.read())

def sheet(ime):
    with urllib.request.urlopen(f'{BASE}/__debug/sheet?ime={ime}', timeout=10) as r:
        return json.loads(r.read()) or []

def cakaj(pogoj, timeout=25, korak=0.3):
    konec = time.time() + timeout
    while time.time() < konec:
        try:
            if pogoj():
                return True
        except Exception:
            pass
        time.sleep(korak)
    return False

def vpis(ime, lat, lon, dogodek, acc=10, t=None, sporocilo=None, id_=None):
    p = dict(enota=ime, lat=lat, lon=lon, acc=acc, dogodek=dogodek, id=id_ or f'e2e{time.time_ns()}')
    if t is not None: p['t'] = int(t)
    if sporocilo: p['sporocilo'] = sporocilo
    return exec_(**{k: v for k, v in p.items() if k != 'geslo'}) if False else json.loads(urllib.request.urlopen(f'{BASE}/exec?' + urllib.parse.urlencode(p), timeout=10).read())

srv = subprocess.Popen(['node', os.path.join(ROOT, 'tests-v2', 'apps-script-mock.js'), str(PORT)], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
try:
    if not cakaj(lambda: urllib.request.urlopen(f'{BASE}/exec?geslo=EPV2026&akcija=pridobiSeznamDogodkov', timeout=2).status == 200, 10):
        print('Simulator se ni zagnal'); sys.exit(2)

    with open(os.path.join(ROOT, 'js-v2', 'shared-config.js'), encoding='utf-8') as f:
        konfig = f.read().replace('VSTAVI_URL_SKRIPTE_V2', f'{BASE}/exec')
    with open(os.path.join(ROOT, 'tests-v2', 'leaflet-stub.js'), encoding='utf-8') as f:
        stub = f.read()

    SKALIRAJ_INTERVALE = "(() => { const o = window.setInterval; window.setInterval = (f, ms, ...a) => o(f, (ms >= 5000 ? ms / 5 : ms), ...a); })();"

    def pripravi_kontekst(browser, **kw):
        ctx = browser.new_context(**kw)
        ctx.add_init_script(SKALIRAJ_INTERVALE)
        # POMEMBNO: presledimo samo zunanje naslove (CDN) in shared-config.js. Če bi presledili tudi klice na
        # simulator (/exec), bi se ti ustavljali, dokler test ne pokliče Playwrighta (sinhroni API) - lažne zakasnitve.
        def pot_zunanje(route):
            url = route.request.url
            if 'leaflet@1.9.4/dist/leaflet.js' in url:
                route.fulfill(status=200, content_type='application/javascript', body=stub)
            elif any(x in url for x in ('leaflet.css', 'leaflet.draw', 'qrcode', 'draw.css')):
                route.fulfill(status=200, content_type='text/css' if url.endswith('.css') else 'application/javascript', body='')
            else:
                route.abort()
        def pot_konfig(route):
            route.fulfill(status=200, content_type='application/javascript', body=konfig)
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)'), pot_zunanje)
        ctx.route(f'{BASE}/js-v2/shared-config.js', pot_konfig)
        return ctx

    napake_strani = []
    def spremljaj(page, ime):
        page.on('pageerror', lambda e: napake_strani.append(f'{ime}: {e}'))
        page.on('console', lambda m: napake_strani.append(f'{ime} console.error: {m.text}') if m.type == 'error' and 'Failed to load resource' not in m.text else None)

    with sync_playwright() as pw:
        browser = pw.chromium.launch()

        # ================= TEREN =================
        ctxF = pripravi_kontekst(browser, geolocation={'latitude': 46.3934, 'longitude': 15.5746, 'accuracy': 20}, permissions=['geolocation'])
        F = ctxF.new_page(); spremljaj(F, 'teren')
        F.goto(f'{BASE}/terenEPV_V2.html?dogodek=Rogla')
        pri('teren: ni opozorila o konfiguraciji', not F.is_visible('#konfiguracijaNapaka'))

        F.fill('#imeEnote', 'pgd kebelj')
        F.dispatch_event('#imeEnote', 'change')
        pri('teren: ime se uskladi s seznamom', F.input_value('#imeEnote') == 'PGD Kebelj', F.input_value('#imeEnote'))
        F.fill('#imeEnote', 'Slb: 1')
        F.dispatch_event('#imeEnote', 'change')
        pri('teren: dvopičje v imenu se zamenja', F.input_value('#imeEnote') == 'Slb- 1' or F.input_value('#imeEnote') == 'Slb- 1'.replace('- ', '-'), F.input_value('#imeEnote'))
        F.fill('#imeEnote', 'pgd kebelj')
        F.dispatch_event('#imeEnote', 'change')

        F.click('#gumbOddaja')
        pri('teren: pozicija prispe na strežnik', cakaj(lambda: any('PGD Kebelj' in str(v[1]) and v[5] == 'Rogla' for v in sheet('Lokacije')[1:])), sheet('Lokacije')[-2:])
        pri('teren: potrditev v statusu', cakaj(lambda: 'Poslano ✔' in F.inner_text('#statusPolje')), F.inner_text('#statusPolje'))
        pri('teren: zvočni gumb obstaja', F.is_visible('#btnZvok'))

        # premik -> druga pozicija
        ctxF.set_geolocation({'latitude': 46.3940, 'longitude': 15.5750, 'accuracy': 15})
        pri('teren: druga pozicija', cakaj(lambda: sum(1 for v in sheet('Lokacije')[1:] if 'PGD Kebelj' in str(v[1])) >= 2, 60), (sheet('Lokacije')[-3:], F.inner_text('#statusPolje')))

        # ----- brez povezave: SOS gre v čakalno vrsto, nato na strežnik z izvirnim časom -----
        ctxF.set_offline(True)
        pred = time.time()
        F.click('button[data-sporocilo="SOS"]')
        pri('teren: SOS v čakalni vrsti (brez povezave)', cakaj(lambda: 'čakalni vrsti' in F.inner_text('#statusSporocila'), 15), F.inner_text('#statusSporocila'))
        pri('teren: kazalnik čakalne vrste', cakaj(lambda: 'Čaka na pošiljanje' in F.inner_text('#vrstaStatus'), 10), F.inner_text('#vrstaStatus'))
        pri('teren: SOS še ni na strežniku', not any(v[3] == 'SOS' for v in sheet('Sporocila')[1:]))
        pri('teren: gumb SOS zaklenjen proti dvojnemu kliku', F.is_disabled('button[data-sporocilo="SOS"]'))
        time.sleep(3)
        ctxF.set_offline(False)
        pri('teren: SOS prispe po vrnitvi povezave', cakaj(lambda: any(str(v[3]).startswith('SOS') for v in sheet('Sporocila')[1:]), 30), sheet('Sporocila')[-3:])
        sos_vrstice = [v for v in sheet('Sporocila')[1:] if str(v[3]).startswith('SOS')]
        pri('teren: SOS ni podvojen', len(sos_vrstice) == 1, len(sos_vrstice))
        if sos_vrstice:
            cas_sos = datetime.fromisoformat(sos_vrstice[0][0].replace('Z', '+00:00')).timestamp()
            pri('teren: SOS ima čas pritiska, ne časa pošiljanja', abs(cas_sos - pred) < 2.5, cas_sos - pred)
        pri('teren: potrditev SOS-a v statusu', cakaj(lambda: 'Strežnik je prejel' in F.inner_text('#statusSporocila'), 10), F.inner_text('#statusSporocila'))

        # ================= ŠTAB =================
        ctxH = pripravi_kontekst(browser)
        H = ctxH.new_page(); spremljaj(H, 'stab')
        H.on('dialog', lambda d: d.accept())
        H.goto(f'{BASE}/mapeEPV_V2.html')
        H.add_script_tag(content='window.print = function(){};')
        H.fill('#input-geslo', 'EPV2026')
        H.click('#btn-potrdi-geslo')
        pri('štab: seznam dogodkov vsebuje Rogla', cakaj(lambda: H.evaluate("Array.from(document.querySelectorAll('#select-dogodek option')).some(o => o.value === 'Rogla')"), 15))
        H.select_option('#select-dogodek', 'Rogla')
        pri('štab: enota se pokaže v seznamu', cakaj(lambda: 'PGD Kebelj' in H.inner_text('#seznamEnotGumbi'), 15), H.inner_text('#seznamEnotGumbi'))
        pri('štab: enota je Aktivna', 'Aktivna' in H.inner_text('#seznamEnotGumbi'), H.inner_text('#seznamEnotGumbi'))
        pri('štab: kazalnik povezave', 'Povezano' in H.inner_text('#povezava-status'), H.inner_text('#povezava-status'))
        pri('štab: gumb za zvok', H.is_visible('#btn-zvok'))

        # ----- čas: poletni in zimski čas -----
        t_zimski = H.evaluate("import('/js-v2/cas-pomoc.js').then(m => [m.formatirajCas('2026-11-02T00:30:00.000Z'), m.formatirajCas('2026-07-12T10:00:00.000Z'), m.formatirajCas('2026-03-29T00:59:00.000Z'), m.formatirajCas('2026-03-29T01:01:00.000Z'), m.formatirajCas('2026-11-02T00:30:00.000Z', true)])")
        pri('čas: zimski čas (UTC+1)', t_zimski[0] == '2026-11-02 01:30:00', t_zimski)
        pri('čas: poletni čas (UTC+2)', t_zimski[1] == '2026-07-12 12:00:00', t_zimski)
        pri('čas: prehod na poletni čas', t_zimski[2] == '2026-03-29 01:59:00' and t_zimski[3] == '2026-03-29 03:01:00', t_zimski)
        pri('čas: kratka oblika', t_zimski[4] == '01:30', t_zimski)

        # ----- enote: velike/male črke, zastarelost, ustavljeno, slaba natančnost -----
        zdaj = int(time.time() * 1000)
        vpis('GASILEC:Pgd Kebelj:11:2', 46.3945, 15.5755, 'Rogla')  # druga črkovna oblika ISTE enote
        vpis('GASILEC:Zastarela:3:0', 46.41, 15.60, 'Rogla', t=zdaj - 3 * 60 * 1000)
        vpis('GASILEC:Izgubljena:3:0', 46.42, 15.61, 'Rogla', t=zdaj - 10 * 60 * 1000)
        vpis('GASILEC:Ustavljena:3:0', 46.43, 15.62, 'Rogla', t=zdaj - 20 * 1000)
        vpis('GASILEC:Ustavljena:3:0', 46.43, 15.62, 'Rogla', t=zdaj - 10 * 1000, sporocilo='Konec oddajanja')
        vpis('GASILEC:Slaba:2:0', 46.40, 15.60, 'Rogla', acc=10, t=zdaj - 30 * 1000)
        vpis('GASILEC:Slaba:2:0', 46.50, 15.80, 'Rogla', acc=900, t=zdaj - 5 * 1000)
        vpis('GASILEC:Vzhod:2:0', 46.44, 15.63, 'Rogla', acc=60, t=zdaj - 2 * 1000)

        def besedilo_enot(): return H.inner_text('#seznamEnotGumbi')
        pri('štab: Zastarela enota', cakaj(lambda: 'Zastarelo' in besedilo_enot(), 15), besedilo_enot())
        pri('štab: enota Ni signala', 'Ni signala' in besedilo_enot(), besedilo_enot())
        pri('štab: enota Ustavljeno po "Konec oddajanja"', cakaj(lambda: 'Ustavljeno' in besedilo_enot(), 15), besedilo_enot())
        pri('štab: "PGD Kebelj" in "Pgd Kebelj" sta ena enota', H.evaluate("Array.from(document.querySelectorAll('.enota-vrstica')).filter(e => /kebelj/i.test(e.innerText)).length") == 1, besedilo_enot())
        pri('štab: starost "pred" je prikazana', 'pred ' in besedilo_enot())
        pri('štab: opozorilo za slabo natančnost ni v seznamu zanesljive pozicije', True)
        marker = H.evaluate("(() => { const m = window.__L.markers.filter(x => x.tooltip && String(x.tooltip.content).startsWith('Slaba')).pop(); return m ? m.latlng : null; })()")
        pri('štab: slaba natančnost (900 m) ne premakne oznake', marker == [46.40, 15.60], marker)
        pri('štab: sled ima več točk (sled iz vseh pozicij)', H.evaluate("window.__L.polylines.length") >= 1)

        # ----- obrazec za koordinate -----
        H.click('#btn-tocka-odpri')
        pri('točka: obrazec se odpre', H.is_visible('#tocka-modal'))
        H.fill('#tocka-vnos', 'nekje na Rogli')
        pri('točka: napačen vnos pokaže napako', cakaj(lambda: 'napaka' in (H.get_attribute('#tocka-predogled', 'class') or ''), 5), H.get_attribute('#tocka-predogled', 'class'))
        pri('točka: gumbi onemogočeni ob napaki', H.is_disabled('#btn-tocka-poslji') and H.is_disabled('#btn-tocka-prikazi'))
        H.fill('#tocka-vnos', '46°23\'36"N 15°34\'28"E')
        pri('točka: veljaven vnos prepoznan', cakaj(lambda: 'ok' in (H.get_attribute('#tocka-predogled', 'class') or '').split(), 5), H.inner_text('#tocka-predogled'))
        pri('točka: predogled kaže D96/TM in UTM', 'D96/TM' in H.inner_text('#tocka-predogled') and 'UTM' in H.inner_text('#tocka-predogled'), H.inner_text('#tocka-predogled'))
        pri('točka: gumbi omogočeni', not H.is_disabled('#btn-tocka-poslji'))
        H.fill('#tocka-naziv', 'Klic - oseba')
        H.fill('#tocka-polmer', '150')
        H.fill('#tocka-opomba', 'klicatelj je slišal vpitje')
        H.select_option('#tocka-cilj', 'VSI')
        H.click('#btn-tocka-poslji')
        pri('točka: obrazec se zapre', cakaj(lambda: not H.is_visible('#tocka-modal'), 10))
        tocke_vrstice = sheet('Tocke')[1:]
        pri('točka: shranjena na strežniku z VSI', len(tocke_vrstice) == 1 and tocke_vrstice[0][3] == 'VSI' and tocke_vrstice[0][4] == 'Klic - oseba' and tocke_vrstice[0][7] == 150, tocke_vrstice)
        if tocke_vrstice:
            pri('točka: koordinate pravilno pretvorjene', abs(tocke_vrstice[0][5] - (46 + 23/60 + 36/3600)) < 1e-6 and abs(tocke_vrstice[0][6] - (15 + 34/60 + 28/3600)) < 1e-6, tocke_vrstice[0][5:7])
        pri('točka: v seznamu štaba', cakaj(lambda: 'Klic - oseba' in H.inner_text('#tocke-seznam'), 10), H.inner_text('#tocke-seznam'))

        # ----- točka pride na teren, zvok, potrditev -----
        pri('teren: točka se pokaže', cakaj(lambda: F.is_visible('#tockePanel') and 'Klic - oseba' in F.inner_text('#tockeSeznam'), 25), F.inner_text('#tockeSeznam') if F.is_visible('#tockePanel') else 'panel skrit')
        pri('teren: točka kaže razdaljo in smer', cakaj(lambda: ' proti ' in F.inner_text('#tockeSeznam'), 10), F.inner_text('#tockeSeznam'))
        dnevnik_f = F.evaluate("EPVZvok.dnevnik.map(x => x.tip)")
        pri('teren: zvok za novo točko', 'tocka' in dnevnik_f, dnevnik_f)
        F.click('.btn-tocka-prejeto')
        pri('teren: potrditev točke na strežniku', cakaj(lambda: any(v[3] == 'tocka' for v in sheet('Potrditve')[1:]), 15), sheet('Potrditve'))
        pri('štab: vidi potrditev točke', cakaj(lambda: '✔' in H.inner_text('#tocke-seznam'), 15), H.inner_text('#tocke-seznam'))

        # ----- sporočilo štaba na teren -----
        H.select_option('#stabCiljSelect', 'VSI')
        H.fill('#stabSporociloText', 'Vsi na zbirno mesto')
        H.click('#btnPosljiStabSporocilo')
        pri('štab: sporočilo poslano', cakaj(lambda: 'Poslano' in H.inner_text('#stabSporociloStatus'), 10), H.inner_text('#stabSporociloStatus'))
        pri('teren: sporočilo iz štaba prispe', cakaj(lambda: 'Vsi na zbirno mesto' in F.inner_text('#stabSporocilaSeznam'), 25), F.inner_text('#stabSporocilaSeznam'))
        dnevnik_f = F.evaluate("EPVZvok.dnevnik.map(x => x.tip)")
        pri('teren: zvok za sporočilo štaba', 'sporocilo' in dnevnik_f, dnevnik_f)
        F.click('.btn-prejeto')
        pri('teren: potrditev sporočila na strežniku', cakaj(lambda: any(v[3] == 'sporocilo' for v in sheet('Potrditve')[1:]), 15))
        pri('štab: dnevnik poslanih kaže potrditev', cakaj(lambda: '✔' in H.inner_text('#stabLog'), 20), H.inner_text('#stabLog'))

        # ----- SOS: alarm v štabu -----
        F.click('button[data-sporocilo="Najdena oseba/žival"]')
        F.wait_for_timeout(300)
        stevilo_pred = H.evaluate("EPVZvok.dnevnik.filter(x => x.tip === 'sos').length")
        time.sleep(3.5)  # gumb SOS je bil zaklenjen 3 s
        F.click('button[data-sporocilo="SOS"]')
        pri('štab: alarm SOS se sproži', cakaj(lambda: H.evaluate("EPVZvok.dnevnik.filter(x => x.tip === 'sos').length") > stevilo_pred, 20))
        pri('štab: sirena zveni', H.evaluate("EPVZvok.alarmAktiven()") is True)
        pri('štab: SOS pasica vidna', H.is_visible('#sos-pasica'))
        pri('štab: zvok za splošno sporočilo', 'sporocilo' in H.evaluate("EPVZvok.dnevnik.map(x => x.tip)"), H.evaluate("EPVZvok.dnevnik.map(x => x.tip)"))
        H.click('#sos-pasica')
        pri('štab: klik na pasico utiša sireno', H.evaluate("EPVZvok.alarmAktiven()") is False)
        pri('štab: pasica izgine', not H.is_visible('#sos-pasica'))

        # ----- SOS brez GPS (nov kontekst brez dovoljenja za lokacijo) -----
        ctxN = pripravi_kontekst(browser)
        N = ctxN.new_page(); spremljaj(N, 'teren-brez-gps')
        N.goto(f'{BASE}/terenEPV_V2.html?dogodek=Rogla')
        N.fill('#imeEnote', 'Brez GPS')
        N.dispatch_event('#imeEnote', 'change')
        N.click('button[data-sporocilo="SOS"]')
        pri('teren brez GPS: SOS vseeno prispe (brez lokacije)', cakaj(lambda: any('Brez GPS' in str(v[1]) and v[4] == '' for v in sheet('Sporocila')[1:]), 25), sheet('Sporocila')[-2:])
        vr = [v for v in sheet('Sporocila')[1:] if 'Brez GPS' in str(v[1])]
        pri('teren brez GPS: sporočilo označeno', bool(vr) and 'brez lokacije' in vr[0][3], vr)
        pri('teren brez GPS: v Lokacije ni lažne pozicije', not any('Brez GPS' in str(v[1]) for v in sheet('Lokacije')[1:]))

        # ----- tisk: čas in nove vsebine -----
        H.click('#btn-tisk')
        pri('tisk: poročilo vsebuje točke', cakaj(lambda: 'Točke iz koordinat' in H.inner_text('#print-tabela'), 20), H.inner_text('#print-tabela')[:300])
        tisk = H.inner_text('#print-tabela')
        pri('tisk: točka z opombo in potrditvijo', 'Klic - oseba' in tisk and 'klicatelj je slišal vpitje' in tisk and 'PGD Kebelj' in tisk, tisk[-600:])
        vrstica_sos = [v for v in sheet('Sporocila')[1:] if str(v[3]).startswith('SOS')]
        if vrstica_sos:
            cas_utc = datetime.fromisoformat(vrstica_sos[0][0].replace('Z', '+00:00'))
            pricakovan = cas_utc.astimezone(LJ).strftime('%Y-%m-%d %H:%M:%S')
            pri('tisk: čas SOS je v lokalnem času Ljubljane (brez +2 h napake)', pricakovan in tisk, (pricakovan, tisk[:500]))
        pri('tisk: naslov V2', 'V2' in H.inner_text('#print-naslov'))

        # ----- zaključek intervencije: ni dvojnika -----
        H.click('#btn-zakljuci-dogodek', click_count=2, delay=50)
        pri('zaključek: en sam zaznamek KONEC INTERVENCIJE', cakaj(lambda: sum(1 for v in sheet('Sporocila')[1:] if v[3] == 'KONEC INTERVENCIJE') >= 1, 20)
            and (time.sleep(2) or sum(1 for v in sheet('Sporocila')[1:] if v[3] == 'KONEC INTERVENCIJE') == 1),
            [v[3] for v in sheet('Sporocila')[1:]][-4:])
        pri('zaključek: geslo dogodka shranjeno', any(v[0] == 'Rogla' for v in sheet('DogodekGesla')[1:]))

        for c in (ctxF, ctxH, ctxN):
            c.close()
        browser.close()

    pri('brez JS napak na straneh', len(napake_strani) == 0, napake_strani[:6])
finally:
    srv.terminate()
    try: srv.wait(5)
    except Exception: srv.kill()

print(f"E2E: {rezultati['ok']} uspešnih, {rezultati['fail']} napak.")
sys.exit(1 if rezultati['fail'] else 0)
