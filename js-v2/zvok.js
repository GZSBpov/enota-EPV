// ==========================================
// EPV V2 - ZVOČNA OPOZORILA (teren in štab)
// Navadna (ne-modul) skripta: window.EPVZvok. Zvoke ustvarja Web Audio, zato ni zvočnih datotek.
//
// Brskalniki zvok dovolijo šele po dotiku/kliku uporabnika. Skripta zato sama prisluhne prvemu
// dotiku/kliku na strani in takrat "odklene" zvok. Če zvok ni odklenjen, gumb pokaže
// "Tapni za vklop zvoka" - štab in teren naj ga ob začetku intervencije enkrat tapneta.
//
// Zvoki:
//   alarmSOS()     - glasna dvotonska sirena, ponavlja se, dokler je ne ustavi ustavi() (ali po 90 s)
//   sporocilo()    - dvotonski "ding-dong" (novo sporočilo)
//   obvestilo()    - dva kratka naraščajoča tona (splošno obvestilo)
//   tocka()        - trije kratki piski (nova točka iz štaba)
// Vibracija deluje na Androidu (iPhone je v brskalniku ne podpira). SOS-a utišanje ne vpliva.
// ==========================================
(function (global) {
    'use strict';

    const KLJUC_UTISAN = 'epv_zvok_utisan';
    const MAX_TRAJANJE_SOS_MS = 90000;

    let ctx = null;
    let utisan = false;
    try { utisan = localStorage.getItem(KLJUC_UTISAN) === '1'; } catch (e) { /* brez localStorage */ }

    let sirenaCasovnik = null;
    let sirenaKonecCasovnik = null;
    let naslovCasovnik = null;
    let izvirniNaslov = (typeof document !== 'undefined') ? document.title : '';
    const poslusalci = [];
    const dnevnik = []; // za teste in diagnostiko: kateri zvoki so bili sproženi

    function belezi(tip) {
        dnevnik.push({ tip: tip, cas: Date.now(), stanje: stanje() });
        if (dnevnik.length > 100) dnevnik.shift();
    }

    function stanje() {
        if (!ctx) return 'zaklenjeno';
        return ctx.state === 'running' ? 'pripravljen' : 'zaklenjeno';
    }

    function obvesti() {
        poslusalci.forEach(function (f) { try { f(stanje(), utisan); } catch (e) { /* ignoriraj */ } });
    }

    function ustvariCtx() {
        if (ctx) return ctx;
        const AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return null;
        try { ctx = new AC(); } catch (e) { ctx = null; }
        if (ctx) ctx.addEventListener && ctx.addEventListener('statechange', obvesti);
        return ctx;
    }

    /** Pokliči iz dotika/klika uporabnika. Vrne Promise<boolean> (ali je zvok pripravljen). */
    function odkleni() {
        const c = ustvariCtx();
        if (!c) return Promise.resolve(false);
        if (c.state === 'running') { obvesti(); return Promise.resolve(true); }
        return Promise.resolve(c.resume()).then(function () {
            obvesti();
            return c.state === 'running';
        }).catch(function () { return false; });
    }

    // Samodejni odklep ob prvem dotiku/kliku (in vsakem naslednjem, če se je zvok medtem ustavil, npr. iOS)
    ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'click'].forEach(function (ime) {
        if (typeof document === 'undefined') return;
        document.addEventListener(ime, function () {
            if (!ctx || ctx.state !== 'running') odkleni();
        }, { passive: true, capture: true });
    });

    /** En ton: frekvenca (Hz), začetek (s od zdaj), trajanje (s), glasnost 0-1, oblika vala. */
    function ton(frekvenca, zacetek, trajanje, glasnost, oblika) {
        const c = ctx;
        if (!c || c.state !== 'running') return;
        const t0 = c.currentTime + zacetek;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = oblika || 'sine';
        osc.frequency.setValueAtTime(frekvenca, t0);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, glasnost), t0 + 0.02);
        gain.gain.setValueAtTime(Math.max(0.0002, glasnost), t0 + Math.max(0.03, trajanje - 0.05));
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + trajanje);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t0);
        osc.stop(t0 + trajanje + 0.02);
    }

    function vibriraj(vzorec) {
        try {
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(vzorec);
        } catch (e) { /* ni podprto */ }
    }

    function obvestilo() {
        belezi('obvestilo');
        if (utisan) return;
        ton(660, 0, 0.18, 0.28);
        ton(880, 0.2, 0.28, 0.28);
        vibriraj([120, 80, 120]);
    }

    function sporocilo() {
        belezi('sporocilo');
        if (utisan) return;
        ton(880, 0, 0.22, 0.3);
        ton(660, 0.25, 0.4, 0.3);
        vibriraj([200, 100, 200]);
    }

    function tocka() {
        belezi('tocka');
        if (utisan) return;
        ton(1000, 0, 0.12, 0.3, 'square');
        ton(1000, 0.2, 0.12, 0.3, 'square');
        ton(1400, 0.4, 0.3, 0.3, 'square');
        vibriraj([150, 100, 150, 100, 400]);
    }

    function enaSirena() {
        // dvotonska sirena (kot reševalna): 960 Hz / 770 Hz, štirje izmenični toni
        ton(960, 0.0, 0.3, 0.45, 'square');
        ton(770, 0.3, 0.3, 0.45, 'square');
        ton(960, 0.6, 0.3, 0.45, 'square');
        ton(770, 0.9, 0.3, 0.45, 'square');
    }

    function alarmAktiven() { return sirenaCasovnik !== null; }

    /** Glasna ponavljajoča sirena. Ni je mogoče utišati z gumbom za zvok - samo z ustavi(). */
    function alarmSOS() {
        belezi('sos');
        vibriraj([500, 200, 500, 200, 500, 200, 500]);
        utripajNaslov('🆘 SOS');
        if (sirenaCasovnik !== null) return;
        enaSirena();
        sirenaCasovnik = setInterval(function () {
            if (ctx && ctx.state !== 'running') { odkleni(); }
            enaSirena();
            vibriraj([400, 200, 400]);
        }, 1300);
        sirenaKonecCasovnik = setTimeout(ustavi, MAX_TRAJANJE_SOS_MS);
        obvesti();
    }

    function ustavi() {
        if (sirenaCasovnik !== null) { clearInterval(sirenaCasovnik); sirenaCasovnik = null; }
        if (sirenaKonecCasovnik !== null) { clearTimeout(sirenaKonecCasovnik); sirenaKonecCasovnik = null; }
        ustaviUtripanje();
        try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(0); } catch (e) { /* ni podprto */ }
        obvesti();
    }

    function utripajNaslov(besedilo) {
        if (typeof document === 'undefined') return;
        if (naslovCasovnik !== null) return;
        izvirniNaslov = document.title.replace(/^.*?• /, '');
        let vklop = false;
        naslovCasovnik = setInterval(function () {
            vklop = !vklop;
            document.title = vklop ? (besedilo + ' • ' + izvirniNaslov) : izvirniNaslov;
        }, 900);
    }

    function ustaviUtripanje() {
        if (naslovCasovnik !== null) { clearInterval(naslovCasovnik); naslovCasovnik = null; }
        if (typeof document !== 'undefined') document.title = izvirniNaslov;
    }

    function nastaviUtisan(vrednost) {
        utisan = !!vrednost;
        try { localStorage.setItem(KLJUC_UTISAN, utisan ? '1' : '0'); } catch (e) { /* brez localStorage */ }
        obvesti();
    }

    function naStanje(f) { poslusalci.push(f); }

    /**
     * Poveže gumb za zvok: klik odklene zvok in preklopi utišanje (SOS-a to ne utiša).
     * Napis gumba se samodejno spreminja glede na stanje.
     */
    function pripraviGumb(el) {
        if (!el) return;
        function osvezi() {
            if (stanje() !== 'pripravljen') {
                el.textContent = '⚠️ Tapni za vklop zvoka';
                el.classList.add('zvok-zaklenjen');
                el.classList.remove('zvok-utisan');
            } else if (utisan) {
                el.textContent = '🔕 Zvok utišan (SOS ostane)';
                el.classList.add('zvok-utisan');
                el.classList.remove('zvok-zaklenjen');
            } else {
                el.textContent = '🔔 Zvok vklopljen';
                el.classList.remove('zvok-utisan', 'zvok-zaklenjen');
            }
        }
        let odklenjenCas = 0;
        let bilPripravljen = stanje() === 'pripravljen';
        naStanje(function () {
            const zdaj = stanje() === 'pripravljen';
            if (zdaj && !bilPripravljen) odklenjenCas = Date.now();
            bilPripravljen = zdaj;
            osvezi();
        });
        el.addEventListener('click', function () {
            odkleni().then(function (pripravljen) {
                if (!pripravljen) { osvezi(); return; }
                // klik, ki je zvok šele odklenil, samo zaigra preizkusni ton - utišanje preklopi šele naslednji klik
                if (Date.now() - odklenjenCas < 1000) {
                    obvestilo();
                } else {
                    nastaviUtisan(!utisan);
                    if (!utisan) obvestilo();
                }
                osvezi();
            });
        });
        osvezi();
    }

    global.EPVZvok = {
        odkleni: odkleni,
        stanje: stanje,
        jeUtisan: function () { return utisan; },
        nastaviUtisan: nastaviUtisan,
        naStanje: naStanje,
        pripraviGumb: pripraviGumb,
        obvestilo: obvestilo,
        sporocilo: sporocilo,
        tocka: tocka,
        alarmSOS: alarmSOS,
        alarmAktiven: alarmAktiven,
        ustavi: ustavi,
        utripajNaslov: utripajNaslov,
        ustaviUtripanje: ustaviUtripanje,
        vibriraj: vibriraj,
        dnevnik: dnevnik
    };
})(typeof window !== 'undefined' ? window : globalThis);
