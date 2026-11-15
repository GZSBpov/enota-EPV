// ==========================================
// EPV NAČRT (taktična tabla) - MODEL: tipi vozil, službe, znaki, načrt, skice, elaborat
// Navadna skripta (window.EPVNacrtModel), deluje tudi v Node za teste. Brez strežnika:
// načrt je en sam JSON objekt, ki se shrani v datoteko in odpre na katerem koli računalniku.
// ==========================================
(function (global) {
    'use strict';

    const VERZIJA = 1;

    // Tipi vozil v GZ. oblika: avto | tovorno | lestev | roka | dron | coln | priklopnik
    // lestev in roka imata vrtljiv lestvenik/roko (smer se nastavi posebej, neodvisno od smeri vozila)
    const TIPI_VOZIL = [
        { tip: 'PV-1', oblika: 'avto', opis: 'Poveljniško vozilo' },
        { tip: 'GVC-1', oblika: 'tovorno', opis: 'Gasilsko vozilo s cisterno' },
        { tip: 'GVC-2', oblika: 'tovorno', opis: 'Gasilsko vozilo s cisterno' },
        { tip: 'GVC-3', oblika: 'tovorno', opis: 'Gasilsko vozilo s cisterno' },
        { tip: 'GV-1', oblika: 'tovorno', opis: 'Manjše gasilsko vozilo' },
        { tip: 'GVV-1', oblika: 'tovorno', opis: 'Manjše gasilsko vozilo z vodo' },
        { tip: 'GVM', oblika: 'avto', opis: 'Vozilo za prevoz moštva' },
        { tip: 'ALK32', oblika: 'lestev', opis: 'Avtolestev s košaro' },
        { tip: 'ZD28', oblika: 'roka', opis: 'Zglobno dvigalo' },
        { tip: 'OVVO', oblika: 'tovorno', opis: 'Orodno vozilo' },
        { tip: 'HTRV-1', oblika: 'tovorno', opis: 'Hitro tehnično reševalno vozilo' },
        { tip: 'GVGP-1', oblika: 'tovorno', opis: 'Vozilo za gozdne požare' },
        { tip: 'VGV', oblika: 'avto', opis: 'Večnamensko gasilsko vozilo' },
        { tip: 'GTVD', oblika: 'roka', opis: 'Gasilsko tovorno vozilo z dvigalom' },
        { tip: 'UAV', oblika: 'dron', opis: 'Dron' },
        { tip: 'GČ', oblika: 'coln', opis: 'Gasilski čoln' },
        { tip: 'GP', oblika: 'priklopnik', opis: 'Gasilski priklopnik' }
    ];

    // Službe: barva telesa, barva proge (druga barva), barva napisa
    const SLUZBE = {
        gasilci: { naziv: 'Gasilci', barva: '#dc2626', proga: '#fde047', napis: '#ffffff' },
        cz: { naziv: 'Civilna zaščita', barva: '#1d4ed8', proga: '#facc15', napis: '#ffffff' },
        policija: { naziv: 'Policija', barva: '#ffffff', proga: '#1d4ed8', napis: '#1e3a8a' },
        resevalci: { naziv: 'Reševalci (NMP)', barva: '#facc15', proga: '#dc2626', napis: '#1f2937' },
        vojska: { naziv: 'Vojska', barva: '#14532d', proga: '#365314', napis: '#ffffff' },
        drugo: { naziv: 'Drugo', barva: '#ec4899', proga: '#9d174d', napis: '#ffffff' }
    };
    // Privzeta oznaka in oblika vozila drugih služb
    const VOZILA_SLUZB = {
        cz: { tip: 'CZ', oblika: 'tovorno' },
        policija: { tip: 'POL', oblika: 'avto' },
        resevalci: { tip: 'NMP', oblika: 'tovorno' },
        vojska: { tip: 'SV', oblika: 'tovorno' },
        drugo: { tip: 'DRUGO', oblika: 'tovorno' }
    };

    // Kratice društev GZ Slovenska Bistrica (uredi po potrebi; na tabli je mogoč tudi ročni vpis)
    const DRUSTVA = [
        ['SLB', 'PGD Slovenska Bistrica'], ['ZGB', 'PGD Zgornja Bistrica'], ['IMP', 'PIGD Impol'], ['VID', 'PGD Videž'],
        ['TIN', 'PGD Tinje'], ['ZGP', 'PGD Zgornja Polskava'], ['LAP', 'PGD Laporje'], ['SPP', 'PGD Spodnja Polskava'],
        ['PRA', 'PGD Pragersko'], ['POL', 'PGD Poljčane'], ['OPL', 'PGD Oplotnica'], ['ŠMA', 'PGD Šmartno na Pohorju'],
        ['KEB', 'PGD Kebelj'], ['MAK', 'PGD Makole']
    ];

    // Taktični znaki (razumljivi, ne uradni): ključ -> { naziv, znak (emoji/besedilo), barva, vrti (ali se suka) }
    const ZNAKI = {
        pm: { naziv: 'Poveljniško mesto', znak: 'PM', barva: '#eab308' },
        triaza: { naziv: 'Triaža / prva pomoč', znak: '✚', barva: '#16a34a' },
        zbirno: { naziv: 'Zbirno mesto enot', znak: 'ZM', barva: '#2563eb' },
        evak: { naziv: 'Zbirno mesto evakuiranih', znak: '🏃', barva: '#16a34a' },
        pozar: { naziv: 'Požar', znak: '🔥', barva: '#b91c1c' },
        nevarnost: { naziv: 'Nevarnost', znak: '⚠', barva: '#f59e0b' },
        nevsnov: { naziv: 'Nevarna snov', znak: '☣', barva: '#ea580c' },
        oseba: { naziv: 'Ponesrečenec / ujeta oseba', znak: '🧍', barva: '#7c3aed' },
        voda: { naziv: 'Vodni vir / hidrant', znak: 'H', barva: '#0284c7' },
        vhod: { naziv: 'Vhod / dostop', znak: '➤', barva: '#475569', vrti: true },
        veter: { naziv: 'Smer vetra', znak: '➤', barva: '#0e7490', vrti: true, napis: 'veter' },
        zapora: { naziv: 'Zapora ceste', znak: '⛔', barva: '#991b1b' },
        helo: { naziv: 'Pristajalno mesto (helikopter)', znak: 'H', barva: '#15803d', krog: true },
        repetitor: { naziv: 'Mobilni repetitor', znak: '📡', barva: '#4338ca' },
        prazen: { naziv: 'Prazen znak (z opisom)', znak: '', barva: '#64748b', prazen: true }
    };

    // Črte: slog -> { naziv, barva, debelina, crtkano, puscica }
    const CRTE = {
        cevovod: { naziv: 'Cevovod', barva: '#38bdf8', debelina: 5, crtkano: null, puscica: false },
        napad: { naziv: 'Napad', barva: '#1d4ed8', debelina: 4, crtkano: null, puscica: true },
        preiskovanje: { naziv: 'Preiskovanje / reševanje', barva: '#dc2626', debelina: 4, crtkano: null, puscica: true },
        evakuacija: { naziv: 'Evakuacijska pot', barva: '#16a34a', debelina: 5, crtkano: '10,8', puscica: true },
        dovoz: { naziv: 'Dovoz / smer vožnje', barva: '#f8fafc', debelina: 4, crtkano: '4,8', puscica: true }
    };

    // Barve, ki jih lahko dobi posamezna črta (namesto privzete barve svoje vrste)
    const BARVE_CRT = ['#f8fafc', '#fde047', '#f97316', '#dc2626', '#ec4899', '#1d4ed8', '#38bdf8', '#16a34a', '#111827'];

    const BARVE_SEKTORJEV = ['#ef4444', '#3b82f6', '#10b981', '#eab308', '#f97316', '#a855f7'];

    const ELABORAT_POLJA = [
        { k: 'organizator', naziv: 'Organizator', vrstic: 1 },
        { k: 'krajDatum', naziv: 'Kraj, datum in ura izvedbe', vrstic: 1 },
        { k: 'vodja', naziv: 'Vodja vaje / intervencije in kontakt', vrstic: 1 },
        { k: 'uvod', naziv: '1.1 Predstavitev in namen', vrstic: 4 },
        { k: 'cilji', naziv: '1.2 Cilji', vrstic: 4 },
        { k: 'varnost', naziv: '1.3 Organizacija in varnostni ukrepi', vrstic: 5 },
        { k: 'zavarovanje', naziv: '1.4 Zavarovanje območja', vrstic: 4 },
        { k: 'lokacija', naziv: '2. Makrolokacija in mikrolokacija (dovozi, vodni viri, oddaljenost enot)', vrstic: 7 },
        { k: 'scenarij', naziv: '3.1 Opis dogodka (scenarij)', vrstic: 7 },
        { k: 'aktivnosti', naziv: '3.2 Predvidene aktivnosti po sektorjih', vrstic: 7 },
        { k: 'alarmiranje', naziv: '3.3 Alarmiranje, aktiviranje in zveze', vrstic: 4 },
        { k: 'drugeSluzbe', naziv: '3.4 Druge sodelujoče službe in opombe k enotam', vrstic: 3 },
        { k: 'casovnica', naziv: '4. Taktični nastop enot (ena vrstica = en korak, npr. »16:06 prihod GE Impol«)', vrstic: 8 },
        { k: 'zakljucek', naziv: '5. Zaključek, analiza in pomembna opozorila', vrstic: 4 }
    ];

    // Obrazec za prijavo vaje (pošlje se na ReCO). vrstic > 1 = večvrstično polje.
    const OBRAZEC_POLJA = [
        { k: 'gz', naziv: 'Gasilska zveza', vrstic: 1, privzeto: 'Slovenska Bistrica' },
        { k: 'naslov', naziv: 'Naslov (npr. "VAJA" požar objekta)', vrstic: 1, privzeto: '"VAJA" ' },
        { k: 'drustvo', naziv: 'Gasilsko društvo (organizator)', vrstic: 1, privzeto: '' },
        { k: 'obseg', naziv: 'Organizira in izvede', vrstic: 1, privzeto: 'VAJO MANJŠEGA OBSEGA' },
        { k: 'vaja', naziv: 'Gasilsko vajo (opis)', vrstic: 1, privzeto: '' },
        { k: 'dne', naziv: 'Dne', vrstic: 1, privzeto: '' },
        { k: 'ob', naziv: 'Ob (ura)', vrstic: 1, privzeto: '' },
        { k: 'lokacija', naziv: 'Na lokaciji', vrstic: 1, privzeto: '' },
        { k: 'vodja', naziv: 'Vodja vaje', vrstic: 1, privzeto: '' },
        { k: 'pomocnik1', naziv: 'Pomočnik', vrstic: 1, privzeto: '' },
        { k: 'pomocnik2', naziv: 'Pomočnik', vrstic: 1, privzeto: '' },
        { k: 'scenarij', naziv: 'Scenarij vaje - ena vrstica = Aktivnost | Nosilec | Čas izvedbe', vrstic: 6, privzeto: 'Odkritje in prijava dogodka |  | \nAktiviranje GE preko delovnega kanala |  | \nEvakuacija, gašenje, preiskovanje |  | \nZaključek intervencije | Po končani dejavnosti se poda poročilo v ReCO | ' },
        { k: 'imVrsta', naziv: 'Imitacija - vrsta', vrstic: 1, privzeto: '' },
        { k: 'imObseg', naziv: 'Imitacija - obseg', vrstic: 1, privzeto: '' },
        { k: 'imCas', naziv: 'Imitacija - čas izvedbe', vrstic: 1, privzeto: '' },
        { k: 'imIzvajalec', naziv: 'Imitacija - izvajalec', vrstic: 1, privzeto: '' },
        { k: 'zavNacin', naziv: 'Načrt zavarovanja - način', vrstic: 1, privzeto: '' },
        { k: 'zavObseg', naziv: 'Načrt zavarovanja - obseg', vrstic: 1, privzeto: '' },
        { k: 'zavIzvajalec', naziv: 'Načrt zavarovanja - izvajalec', vrstic: 1, privzeto: '' },
        { k: 'zvezeOpis', naziv: 'Načrt zvez - opis', vrstic: 1, privzeto: 'Delovni kanal ZARE …, obveščen ReCO Maribor' },
        { k: 'zvezeVodstvo', naziv: 'Načrt zvez - vodstvo vaje', vrstic: 1, privzeto: '' },
        { k: 'kanal', naziv: 'Delovni kanal', vrstic: 1, privzeto: '' },
        { k: 'rezervniKanal', naziv: 'Rezervni kanal', vrstic: 1, privzeto: '' },
        { k: 'aktiviranje', naziv: 'Aktiviranje sodelujočih (kdo in kako)', vrstic: 1, privzeto: '… aktivira sodelujoče preko GSM ali EA sistema' },
        { k: 'pgd', naziv: 'Sodelujoča PGD - eno v vrstici (prazno = društva s skic)', vrstic: 4, privzeto: '' },
        { k: 'poziv', naziv: 'Vsebina poziva se glasi', vrstic: 1, privzeto: '„VAJA …“' },
        { k: 'udelezenci', naziv: 'Organizator obvešča ostale udeležence (policijo, zdravstvo, elektro …) - eden v vrstici', vrstic: 3, privzeto: '' },
        { k: 'zakljucek', naziv: 'Zaključek vaje je predviden ob (ura)', vrstic: 1, privzeto: '' }
    ];
    function privzetiObrazec() {
        const o = {};
        OBRAZEC_POLJA.forEach(function (p) { o[p.k] = p.privzeto; });
        return o;
    }

    /** Cisterna: gasilsko vozilo, katerega tip vsebuje C (GVC-1, GVC-2, GVC-3 ...) - na ikoni dobi X za rumeno črto. */
    function jeCisterna(e) {
        return (e.sluzba || 'gasilci') === 'gasilci' && /C/.test(String(e.tip || '').toUpperCase());
    }
    function imaRoko(oblika) { return oblika === 'lestev' || oblika === 'roka'; }

    /** Različna društva (kratice) gasilskih vozil v načrtu, po vrstnem redu prihoda. */
    function drustvaVNacrtu(nacrt) {
        const videna = {}, izhod = [];
        seznamVozil(nacrt).forEach(function (v) {
            const k = String(v.kratica || '').toUpperCase();
            if (v.sluzba === 'gasilci' && k && !videna[k]) { videna[k] = true; izhod.push(nazivDrustva(k) || k); }
        });
        return izhod;
    }

    function privzetiElaborat() {
        return {
            organizator: 'Gasilska zveza Slovenska Bistrica',
            krajDatum: '',
            vodja: '',
            uvod: 'Vaja se izvede na podlagi Zakona o varstvu pred naravnimi in drugimi nesrečami ter Pravilnika o vajah na področju varstva pred naravnimi in drugimi nesrečami. …',
            cilji: 'Preverjanje in prikaz usposobljenosti in opremljenosti gasilskih enot ter drugih služb v sistemu zaščite in reševanja. Poudarek je na sodelovanju med enotami.',
            varnost: 'Sodelujoči so dolžni upoštevati predpise s področja varstva pred nesrečami in varnega dela. O vsaki nepravilnosti, ki ogroža življenje, zdravje ali premoženje, takoj obvestijo nadrejenega vodjo. Na kraju se upoštevajo navodila vodje vaje in rediteljev. Vsi uporabljajo predpisano zaščitno opremo.',
            zavarovanje: 'Enote poskrbijo za zavarovanje kraja na svojem območju delovanja. Vsak vodja enote je odgovoren za varnost svoje enote. Za ureditev prometa so zadolženi …',
            lokacija: '',
            scenarij: '',
            aktivnosti: 'Skupno:\nSektor 1:\nSektor 2:\nSektor 3:',
            alarmiranje: 'Klic na 112 (ReCO). Alarmiranje po … stopnji. Delovni kanal ZARE: … Za nujen primer: »KLIC V SILI, KLIC V SILI«.',
            drugeSluzbe: '',
            casovnica: '',
            zakljucek: 'Scenarij je okviren; na kraju lahko pride do odstopanj, ki jih usklajuje vodstvo. Po zaključku: zbor sodelujočih, predaja poročil in analiza.'
        };
    }

    function novId(p) { return (p || 'e') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

    function novaSkica(naziv, pogled) {
        return { id: novId('s'), naziv: naziv || 'Skica', pogled: pogled || null, elementi: [] };
    }

    function novNacrt(naziv, pogled) {
        return {
            vrsta: 'epv-nacrt', v: VERZIJA, naziv: naziv || 'Nov načrt',
            ustvarjeno: new Date().toISOString(), spremenjeno: new Date().toISOString(),
            elaborat: privzetiElaborat(), obrazec: privzetiObrazec(), napisi: true,
            skice: [novaSkica('Lokacija', pogled), novaSkica('Evakuacija', pogled), novaSkica('Posredovanje', pogled)]
        };
    }

    /** Kopija skice z vsemi elementi (novi ID-ji) - za naslednji časovni korak. */
    function podvojiSkico(skica, naziv) {
        const kopija = JSON.parse(JSON.stringify(skica));
        kopija.id = novId('s');
        kopija.naziv = naziv || (skica.naziv + ' (kopija)');
        kopija.elementi.forEach(function (e) { e.id = novId('e'); });
        return kopija;
    }

    /** Naslednja zaporedna številka prihoda v skici (največja + 1). */
    function naslednjaStevilka(skica) {
        let max = 0;
        (skica.elementi || []).forEach(function (e) {
            const n = parseInt(e.st, 10);
            if (e.vrsta === 'vozilo' && !isNaN(n) && n > max) max = n;
        });
        return max + 1;
    }

    /** Napis pod vozilom: "3 · SLB · GVC-1" (deli, ki manjkajo, se izpustijo). */
    function oznakaVozila(e) {
        return [e.st, e.kratica, e.tip].filter(function (x) { return x !== undefined && x !== null && String(x).trim() !== ''; }).join(' · ');
    }

    /** Vsa različna vozila v načrtu (prek vseh skic), urejena po številki prihoda. */
    function seznamVozil(nacrt) {
        const poKljucu = {};
        (nacrt.skice || []).forEach(function (s) {
            (s.elementi || []).forEach(function (e) {
                if (e.vrsta !== 'vozilo') return;
                const k = [e.sluzba, (e.kratica || '').toUpperCase(), e.tip, e.st].join('|');
                if (!poKljucu[k]) poKljucu[k] = { st: e.st, kratica: e.kratica || '', tip: e.tip || '', sluzba: e.sluzba || 'gasilci', opis: e.opis || '' };
                else if (!poKljucu[k].opis && e.opis) poKljucu[k].opis = e.opis;
            });
        });
        return Object.keys(poKljucu).map(function (k) { return poKljucu[k]; }).sort(function (a, b) {
            const na = parseInt(a.st, 10), nb = parseInt(b.st, 10);
            if (isNaN(na) !== isNaN(nb)) return isNaN(na) ? 1 : -1;
            if (!isNaN(na) && na !== nb) return na - nb;
            return (a.kratica + a.tip).localeCompare(b.kratica + b.tip);
        });
    }

    function nazivDrustva(kratica) {
        const k = String(kratica || '').toUpperCase();
        const d = DRUSTVA.filter(function (x) { return x[0] === k; })[0];
        return d ? d[1] : '';
    }

    function jeSt(x) { return typeof x === 'number' && isFinite(x); }

    /**
     * Preveri in očisti načrt iz datoteke. Vrne { ok:true, nacrt } ali { ok:false, napaka }.
     * Neznani ali pokvarjeni elementi se izpustijo (stevilo v "izpusceno"), da ena napaka ne pokvari celega načrta.
     */
    function uvozi(besedilo) {
        let o;
        try { o = typeof besedilo === 'string' ? JSON.parse(besedilo) : besedilo; } catch (e) { return { ok: false, napaka: 'Datoteka ni veljaven zapis načrta (JSON).' }; }
        if (!o || o.vrsta !== 'epv-nacrt' || !Array.isArray(o.skice)) return { ok: false, napaka: 'To ni datoteka EPV načrta.' };
        if (o.v > VERZIJA) return { ok: false, napaka: 'Načrt je iz novejše različice aplikacije. Posodobi aplikacijo.' };
        let izpusceno = 0;
        const tocke = function (t) { return Array.isArray(t) && t.length >= 2 && t.every(function (p) { return Array.isArray(p) && jeSt(p[0]) && jeSt(p[1]); }); };
        const skice = o.skice.filter(function (s) { return s && typeof s === 'object'; }).map(function (s) {
            const el = (Array.isArray(s.elementi) ? s.elementi : []).filter(function (e) {
                let ok = false;
                if (e && typeof e === 'object') {
                    if (e.vrsta === 'vozilo' || e.vrsta === 'znak' || e.vrsta === 'besedilo') ok = jeSt(e.lat) && jeSt(e.lon) && (e.vrsta !== 'znak' || !!ZNAKI[e.znak]);
                    else if (e.vrsta === 'crta') ok = tocke(e.tocke) && !!CRTE[e.slog];
                    else if (e.vrsta === 'obmocje') ok = tocke(e.tocke) && e.tocke.length >= 3;
                    else if (e.vrsta === 'krog') ok = jeSt(e.lat) && jeSt(e.lon) && jeSt(e.r) && e.r > 0;
                }
                if (!ok) izpusceno++;
                return ok;
            }).map(function (e) { if (!e.id) e.id = novId('e'); return e; });
            const p = s.pogled && jeSt(s.pogled.lat) && jeSt(s.pogled.lon) && jeSt(s.pogled.z) ? s.pogled : null;
            return { id: s.id || novId('s'), naziv: String(s.naziv || 'Skica'), pogled: p, elementi: el };
        });
        if (skice.length === 0) skice.push(novaSkica('Skica 1', null));
        const elaborat = privzetiElaborat();
        if (o.elaborat && typeof o.elaborat === 'object') Object.keys(elaborat).forEach(function (k) { if (typeof o.elaborat[k] === 'string') elaborat[k] = o.elaborat[k]; });
        const osnova = o.osnova ? ocistiOsnovo(o.osnova) : null;
        const obrazec = privzetiObrazec();
        if (o.obrazec && typeof o.obrazec === 'object') Object.keys(obrazec).forEach(function (k) { if (typeof o.obrazec[k] === 'string') obrazec[k] = o.obrazec[k]; });
        return {
            ok: true, izpusceno: izpusceno,
            nacrt: { vrsta: 'epv-nacrt', v: VERZIJA, naziv: String(o.naziv || 'Načrt'), ustvarjeno: o.ustvarjeno || new Date().toISOString(), spremenjeno: o.spremenjeno || new Date().toISOString(), elaborat: elaborat, obrazec: obrazec, osnova: osnova, napisi: o.napisi !== false, skice: skice }
        };
    }

    /**
     * Stalna osnova (območje zveze in gasilski domovi): { tocke: [{ naziv, lat, lon }], obrisi: [{ naziv, tocke, zaprto }] }.
     * Preveri in očisti; neveljavni vnosi se izpustijo.
     */
    function ocistiOsnovo(o) {
        const izhod = { tocke: [], obrisi: [] };
        if (!o || typeof o !== 'object') return izhod;
        (Array.isArray(o.tocke) ? o.tocke : []).forEach(function (t) {
            if (t && jeSt(t.lat) && jeSt(t.lon) && Math.abs(t.lat) <= 90 && Math.abs(t.lon) <= 180) izhod.tocke.push({ naziv: String(t.naziv || '').slice(0, 80), lat: t.lat, lon: t.lon });
        });
        (Array.isArray(o.obrisi) ? o.obrisi : []).forEach(function (b) {
            if (!b || !Array.isArray(b.tocke)) return;
            const tocke = b.tocke.filter(function (p) { return Array.isArray(p) && jeSt(p[0]) && jeSt(p[1]); }).map(function (p) { return [p[0], p[1]]; });
            if (tocke.length >= 2) izhod.obrisi.push({ naziv: String(b.naziv || '').slice(0, 80), tocke: tocke, zaprto: !!b.zaprto });
        });
        return izhod;
    }

    /** Niz koordinat iz KML ("lon,lat,visina lon,lat,visina ...") -> [[lat, lon], ...] */
    function kmlKoordinate(besedilo) {
        return String(besedilo || '').trim().split(/\s+/).map(function (del) {
            const d = del.split(',');
            const lon = parseFloat(d[0]), lat = parseFloat(d[1]);
            return jeSt(lat) && jeSt(lon) ? [lat, lon] : null;
        }).filter(Boolean);
    }

    function imeDatoteke(nacrt) {
        const osnova = String(nacrt.naziv || 'nacrt').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50) || 'nacrt';
        return osnova + '.epvnacrt.json';
    }

    const API = {
        VERZIJA: VERZIJA, TIPI_VOZIL: TIPI_VOZIL, SLUZBE: SLUZBE, VOZILA_SLUZB: VOZILA_SLUZB, DRUSTVA: DRUSTVA, ZNAKI: ZNAKI, CRTE: CRTE,
        BARVE_SEKTORJEV: BARVE_SEKTORJEV, BARVE_CRT: BARVE_CRT, ocistiOsnovo: ocistiOsnovo, kmlKoordinate: kmlKoordinate, ELABORAT_POLJA: ELABORAT_POLJA, OBRAZEC_POLJA: OBRAZEC_POLJA,
        privzetiObrazec: privzetiObrazec, jeCisterna: jeCisterna, imaRoko: imaRoko, drustvaVNacrtu: drustvaVNacrtu,
        privzetiElaborat: privzetiElaborat, novId: novId, novaSkica: novaSkica, novNacrt: novNacrt, podvojiSkico: podvojiSkico,
        naslednjaStevilka: naslednjaStevilka, oznakaVozila: oznakaVozila, seznamVozil: seznamVozil, nazivDrustva: nazivDrustva,
        uvozi: uvozi, imeDatoteke: imeDatoteke
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    global.EPVNacrtModel = API;
})(typeof window !== 'undefined' ? window : globalThis);
