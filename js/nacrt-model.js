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
        gasilci: { naziv: 'Gasilci', barva: '#dc2626', proga: '#fde047', napis: '#ffffff', lucke: true },
        cz: { naziv: 'Civilna zaščita', barva: '#1d4ed8', proga: '#facc15', napis: '#ffffff' },
        policija: { naziv: 'Policija', barva: '#ffffff', proga: '#1d4ed8', napis: '#1e3a8a', lucke: true },
        resevalci: { naziv: 'Reševalci (NMP)', barva: '#facc15', proga: '#dc2626', napis: '#1f2937', lucke: true },
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
        // "prosto": risba brez barvnega polja; velikost znaka (e.vel) pove obseg požara oziroma moč vetra
        pozar: { naziv: 'Požar z dimom', znak: '', barva: 'transparent', prosto: true,
            svg: '<g stroke="#111" stroke-width="0.7" stroke-linejoin="round"><path d="M14.5 10.5c-1.6 0-2.9-1.2-2.9-2.7 0-1.2.8-2.2 1.9-2.5.3-1.7 1.8-3 3.6-3 1.6 0 2.9 1 3.4 2.4 1.5.2 2.6 1.4 2.6 2.9 0 1.6-1.4 2.9-3.1 2.9z" fill="#9ca3af"/><path d="M12 23c-4 0-6.8-2.6-6.8-6.2 0-2.6 1.6-4.3 2.9-6 .5 1.3 1 2 1.9 2.6-.2-2.7.9-5.2 3.4-6.9-.3 2.2.6 3.4 2.2 5.1 1.7 1.8 3.2 3.2 3.2 5.6C18.800 20.500 16 23 12 23z" fill="#dc2626"/><path d="M12 22c-1.900 0-3.200-1.200-3.200-2.900 0-1.500 1-2.400 1.900-3.600.400 1 .9 1.400 1.600 1.800.1-1.400.6-2.300 1.500-3.200.1 1.300.7 2 1.300 2.900.600.800 1.100 1.500 1.100 2.400C16.200 20.900 14.300 22 12 22z" fill="#fbbf24" stroke="none"/></g>' },
        nevarnost: { naziv: 'Nevarnost', znak: '⚠', barva: '#f59e0b' },
        nevsnov: { naziv: 'Nevarna snov', znak: '☣', barva: '#ea580c' },
        oseba: { naziv: 'Ponesrečenec / ujeta oseba', znak: '🧍', barva: '#7c3aed' },
        voda: { naziv: 'Vodni vir / hidrant', znak: 'H', barva: '#0284c7' },
        vhod: { naziv: 'Vhod / dostop', znak: '➤', barva: '#475569', vrti: true },
        veter: { naziv: 'Smer vetra', znak: '', barva: 'transparent', vrti: true, prosto: true, napis: 'veter',
            svg: '<circle cx="12" cy="12" r="10.800" fill="rgba(255,255,255,.93)" stroke="#111" stroke-width="1"/><path d="M3.500 12H15" stroke="#0e7490" stroke-width="3" stroke-linecap="round"/><path d="M13 6.500L21 12l-8 5.500z" fill="#0e7490" stroke="#111" stroke-width="0.6" stroke-linejoin="round"/><path d="M4 7.500h5M4 16.500h5" stroke="#0e7490" stroke-width="1.400" stroke-linecap="round"/>' },
        zapora: { naziv: 'Zapora ceste', znak: '⛔', barva: '#991b1b' },
        helo: { naziv: 'Pristajalno mesto (helikopter)', znak: 'H', barva: '#15803d', krog: true },
        repetitor: { naziv: 'Mobilni repetitor', znak: '📡', barva: '#4338ca' },
        // znaki z lastno risbo (svg, risano v polju 24 x 24); pri "vrti" risba kaže v desno
        lestev: { naziv: 'Napad po lestvi', znak: '', barva: '#1d4ed8', vrti: true, napis: 'lestev',
            svg: '<g stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"><path d="M2 8H22M2 16H22"/><path d="M6 8V16M10.5 8V16M15 8V16M19.5 8V16"/></g>' },
        crpalka: { naziv: 'Črpalka', znak: '', barva: '#dc2626', kvadrat: true,
            svg: '<path d="M5 5L19 19M19 5L5 19" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' },
        elektrika: { naziv: 'Elektrika (odklop / nevarnost)', znak: '', barva: '#facc15',
            svg: '<path d="M13.5 2L5 13.5h5.5L9.5 22 19 9.5h-5.5z" fill="#111" stroke="#111" stroke-width="1" stroke-linejoin="round"/>' },
        skupina: { naziv: 'Skupina gasilcev / reševalcev', znak: '', barva: '#b91c1c',
            svg: '<g fill="#fff"><circle cx="5.5" cy="8.5" r="2.3"/><path d="M1.8 20v-4.6a3.7 3.7 0 0 1 7.4 0V20z"/><circle cx="18.5" cy="8.5" r="2.3"/><path d="M14.8 20v-4.6a3.7 3.7 0 0 1 7.4 0V20z"/></g><g fill="#fff" stroke="#b91c1c" stroke-width="1"><circle cx="12" cy="6.3" r="2.8"/><path d="M7.6 21v-5.6a4.4 4.4 0 0 1 8.8 0V21z"/></g>' },
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
    /** Število koles na ikoni: triosna vozila (GVC-3, GTVD) imajo 6 koles, vsa ostala 4. */
    function steviloKoles(tip) {
        return /^(GVC-3|GTVD)$/i.test(String(tip || '').trim()) ? 6 : 4;
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
            elaborat: privzetiElaborat(), obrazec: privzetiObrazec(), napisi: true, sever: false,
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

    /** Posadka vozila je zapisana kot 1 + N (voznik + N). Vrne N (celo število >= 0) ali null, če ni vpisana. */
    /** Velikost ikon in napisov na skici: 0,5 do 1,5 (1 = običajna). */
    function omejiMerilo(m) {
        const n = parseFloat(m);
        return isNaN(n) ? 1 : Math.round(Math.max(0.5, Math.min(1.5, n)) * 10) / 10;
    }

    /** Velikost posameznega znaka: 0,6 do 2,6 (1 = običajna). */
    function omejiVelikostZnaka(v) {
        const n = parseFloat(v);
        return isNaN(n) ? 1 : Math.round(Math.max(0.6, Math.min(2.6, n)) * 10) / 10;
    }

    function steviloPosadke(e) {
        if (!e || e.posadka === undefined || e.posadka === null || String(e.posadka).trim() === '') return null;
        const n = parseInt(e.posadka, 10);
        return isNaN(n) || n < 0 ? null : n;
    }
    function zapisPosadke(e) {
        const n = steviloPosadke(e);
        return n === null ? '' : '1+' + n;
    }

    /**
     * Povzetek sodelujočih iz seznama vozil: enote (društvo ali služba), število vozil in članov po enotah ter skupaj.
     * Člani vozila = 1 + N. Vozila brez vpisane posadke se štejejo med vozila, med člane pa ne (brezPosadke pove, koliko jih je).
     */
    function povzetekSodelujocih(vozila) {
        const poEnoti = {}, vrstniRed = [];
        let skupajVozil = 0, skupajClanov = 0, brezPosadke = 0;
        (vozila || []).forEach(function (v) {
            const sluzba = v.sluzba || 'gasilci';
            const kratica = String(v.kratica || '').trim().toUpperCase();
            const kljuc = kratica ? 'k:' + kratica : 's:' + sluzba;
            if (!poEnoti[kljuc]) {
                poEnoti[kljuc] = { enota: kratica ? (nazivDrustva(kratica) || kratica) : (sluzba === 'gasilci' ? 'Gasilci (brez oznake enote)' : SLUZBE[sluzba].naziv), kratica: kratica, vozil: 0, clanov: 0, tipi: [], brezPosadke: 0 };
                vrstniRed.push(kljuc);
            }
            const en = poEnoti[kljuc];
            en.vozil++; skupajVozil++;
            if (v.tip) en.tipi.push(v.tip);
            const n = steviloPosadke(v);
            if (n === null) { en.brezPosadke++; brezPosadke++; }
            else { en.clanov += 1 + n; skupajClanov += 1 + n; }
        });
        return { enote: vrstniRed.map(function (k) { return poEnoti[k]; }), skupajEnot: vrstniRed.length, skupajVozil: skupajVozil, skupajClanov: skupajClanov, brezPosadke: brezPosadke };
    }

    /** Vsa različna vozila v načrtu (prek vseh skic), urejena po številki prihoda. */
    function seznamVozil(nacrt) {
        const poKljucu = {};
        (nacrt.skice || []).forEach(function (s) {
            (s.elementi || []).forEach(function (e) {
                if (e.vrsta !== 'vozilo') return;
                const k = [e.sluzba, (e.kratica || '').toUpperCase(), e.tip, e.st].join('|');
                if (!poKljucu[k]) poKljucu[k] = { st: e.st, kratica: e.kratica || '', tip: e.tip || '', sluzba: e.sluzba || 'gasilci', opis: e.opis || '', posadka: e.posadka };
                else if (steviloPosadke(poKljucu[k]) === null && steviloPosadke(e) !== null) poKljucu[k].posadka = e.posadka;
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
            let p = null;
            if (s.pogled && jeSt(s.pogled.lat) && jeSt(s.pogled.lon) && jeSt(s.pogled.z)) {
                p = { lat: s.pogled.lat, lon: s.pogled.lon, z: s.pogled.z };
                const mj = s.pogled.meje;
                if (Array.isArray(mj) && mj.length === 2 && mj.every(function (t) { return Array.isArray(t) && jeSt(t[0]) && jeSt(t[1]); })) p.meje = [[mj[0][0], mj[0][1]], [mj[1][0], mj[1][1]]];
            }
            const skica = { id: s.id || novId('s'), naziv: String(s.naziv || 'Skica'), pogled: p, elementi: el };
            if (jeSt(s.merilo) && s.merilo !== 1) skica.merilo = omejiMerilo(s.merilo); // velikost ikon in napisov na tej skici
            return skica;
        });
        if (skice.length === 0) skice.push(novaSkica('Skica 1', null));
        const elaborat = privzetiElaborat();
        if (o.elaborat && typeof o.elaborat === 'object') Object.keys(elaborat).forEach(function (k) { if (typeof o.elaborat[k] === 'string') elaborat[k] = o.elaborat[k]; });
        const osnova = o.osnova ? ocistiOsnovo(o.osnova) : null;
        const obrazec = privzetiObrazec();
        if (o.obrazec && typeof o.obrazec === 'object') Object.keys(obrazec).forEach(function (k) { if (typeof o.obrazec[k] === 'string') obrazec[k] = o.obrazec[k]; });
        return {
            ok: true, izpusceno: izpusceno,
            nacrt: { vrsta: 'epv-nacrt', v: VERZIJA, naziv: String(o.naziv || 'Načrt'), ustvarjeno: o.ustvarjeno || new Date().toISOString(), spremenjeno: o.spremenjeno || new Date().toISOString(), elaborat: elaborat, obrazec: obrazec, osnova: osnova, napisi: o.napisi !== false, sever: o.sever === true, skice: skice }
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
        privzetiObrazec: privzetiObrazec, omejiMerilo: omejiMerilo, omejiVelikostZnaka: omejiVelikostZnaka, steviloPosadke: steviloPosadke, zapisPosadke: zapisPosadke, povzetekSodelujocih: povzetekSodelujocih,
        jeCisterna: jeCisterna, imaRoko: imaRoko, steviloKoles: steviloKoles, drustvaVNacrtu: drustvaVNacrtu,
        privzetiElaborat: privzetiElaborat, novId: novId, novaSkica: novaSkica, novNacrt: novNacrt, podvojiSkico: podvojiSkico,
        naslednjaStevilka: naslednjaStevilka, oznakaVozila: oznakaVozila, seznamVozil: seznamVozil, nazivDrustva: nazivDrustva,
        uvozi: uvozi, imeDatoteke: imeDatoteke
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    global.EPVNacrtModel = API;
})(typeof window !== 'undefined' ? window : globalThis);
