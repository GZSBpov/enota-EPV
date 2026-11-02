// Nastavite pravilno zgoščeno vrednost gesla (ustreza geslu "EPV2026")
const PRAVILNO_GESLO_HASH = "8603900fdfbc2a9cfccf9e8d0ff0501d5b59d559577a65be787860b73b9c9756";
const NAVADNO_GESLO = "EPV2026";

// Pomožna funkcija za vračanje JSON odgovora z ustreznimi CORS glavi
function vrniCorsJson(objekt) {
  return ContentService.createTextOutput(JSON.stringify(objekt))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * NOVO: GESLO ZAKLJUČENE INTERVENCIJE - preveri, ali je dogodek zaščiten z geslom
 * (nastavljeno ob zaključku intervencije, list "DogodekGesla") in če je, ali se podana
 * zgoščena vrednost ujema. Uporablja se pri branju sektorjev/sporočil in shranjevanju
 * (popravkih) zaščitenega dogodka - splošno geslo aplikacije (EPV2026) za to NI dovolj.
 * Vrne { zascitena: bool, ok: bool } - "ok" je smiseln samo, če je zascitena=true.
 */
function preveriZascitoDogodka(imeDogodka, podanGesloHash) {
  if (!imeDogodka) return { zascitena: false, ok: true };

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DogodekGesla");
  if (!sheet) return { zascitena: false, ok: true };

  var podatki = sheet.getDataRange().getValues();
  for (var i = 1; i < podatki.length; i++) {
    if ((podatki[i][0] || "").toString() === imeDogodka) {
      var shranjenHash = (podatki[i][1] || "").toString();
      if (!shranjenHash) return { zascitena: false, ok: true };
      return { zascitena: true, ok: (shranjenHash === (podanGesloHash || "")) };
    }
  }
  return { zascitena: false, ok: true }; // dogodek (še) nima shranjenega gesla - ni zaščiten
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // POPRAVEK: zapis lokacije prepoznamo po enota+lat+lon SKUPAJ, ne samo po "enota" -
  // prej je katerakoli zahteva s parametrom "enota" (npr. filter pri pridobiDodeljeneSektorje)
  // pomotoma sprožila zapis lokacije namesto prave akcije.
  var jeVpisLokacije = !!(e && e.parameter.enota && e.parameter.lat && e.parameter.lon);

  // 1. VARNOSTNO PREVERJANJE GESLA (za vse zahteve, ki niso enostaven vpis lokacije s terena)
  if (e && !jeVpisLokacije) {
    var prejetoGesloHash = e.parameter.geslo;

    if (prejetoGesloHash) {
      var ok = (prejetoGesloHash.toLowerCase() === PRAVILNO_GESLO_HASH.toLowerCase() || prejetoGesloHash === NAVADNO_GESLO);
      if (!ok) {
        return vrniCorsJson({
          "status": "error",
          "message": "Napačno geslo! Prejeto v skripto: " + prejetoGesloHash
        });
      }
    } else {
      return vrniCorsJson({
        "status": "error",
        "message": "Ni prejetega gesla!"
      });
    }
  }

  // 2. VPISOVANJE LOKACIJE S TERENA (preko GET metode) -> Zavihek "Lokacije"
  if (jeVpisLokacije) {
    try {
      var sheetLokacije = ss.getSheetByName("Lokacije");
      if (!sheetLokacije) {
        sheetLokacije = ss.insertSheet("Lokacije");
        // POPRAVEK: dodan stolpec "Dogodek", da je mogoče enote filtrirati po aktivni intervenciji
        sheetLokacije.appendRow(["Čas", "Enota", "Latitude", "Longitude", "Natančnost", "Dogodek"]);
      }

      var cas = Utilities.formatDate(new Date(), "GMT+2", "yyyy-MM-dd HH:mm:ss");
      var enota = e.parameter.enota;
      var lat = e.parameter.lat;
      var lon = e.parameter.lon;
      var acc = e.parameter.acc || "";
      // POPRAVEK: prej se dogodek ni bral/shranjeval, zato filtriranje enot po intervenciji
      // v mapeEPV.html ni nikoli delovalo (vedno so se prikazale vse enote iz vseh dogodkov).
      var dogodek = e.parameter.dogodek || "";

      sheetLokacije.appendRow([cas, enota, lat, lon, acc, dogodek]);

      // NOVO: če je ob lokaciji priloženo posebno sporočilo (SOS, najdena oseba/žival, ...),
      // ga zabeležimo tudi v ločen list "Sporocila", da ga vodja vidi na svoji karti.
      var sporocilo = e.parameter.sporocilo || "";
      if (sporocilo) {
        var sheetSporocila = ss.getSheetByName("Sporocila");
        if (!sheetSporocila) {
          sheetSporocila = ss.insertSheet("Sporocila");
          sheetSporocila.appendRow(["Čas", "Enota", "Dogodek", "Sporočilo", "Latitude", "Longitude"]);
        }
        sheetSporocila.appendRow([cas, enota, dogodek, sporocilo, lat, lon]);
      }

      return vrniCorsJson({status: "success"});
    } catch(napaka) {
      return vrniCorsJson({status: "error", message: napaka.toString()});
    }
  }

  var akcija = e ? e.parameter.akcija : null;

  // 3. PRIDOBIVANJE SEZNAMA UNIKATNIH DOGODKOV (za padajoči meni)
  // POPRAVEK: imena dogodkov zberemo iz VSEH treh listov (Dogodki, Lokacije, Sporocila),
  // ne samo iz "Dogodki" - sicer se dogodek, za katerega vodja še ni shranil nobenega
  // sektorja, sploh ne pojavi v spustnem meniju, čeprav enote zanj že poročajo lokacije/sporočila.
  if (akcija === "pridobiSeznamDogodkov") {
    var imenaDogodkov = {};

    var sheetDogodki = ss.getSheetByName("Dogodki");
    if (sheetDogodki) {
      var podatkiDogodkov = sheetDogodki.getDataRange().getValues();
      for (var i = 1; i < podatkiDogodkov.length; i++) {
        var ime1 = podatkiDogodkov[i][0];
        if (ime1) imenaDogodkov[ime1] = true;
      }
    }

    var sheetLokacije2 = ss.getSheetByName("Lokacije");
    if (sheetLokacije2) {
      var podatkiLokacij2 = sheetLokacije2.getDataRange().getValues();
      for (var j = 1; j < podatkiLokacij2.length; j++) {
        var ime2 = podatkiLokacij2[j][5];
        if (ime2) imenaDogodkov[ime2] = true;
      }
    }

    var sheetSporocila2 = ss.getSheetByName("Sporocila");
    if (sheetSporocila2) {
      var podatkiSporocil2 = sheetSporocila2.getDataRange().getValues();
      for (var k = 1; k < podatkiSporocil2.length; k++) {
        var ime3 = podatkiSporocil2[k][2];
        if (ime3) imenaDogodkov[ime3] = true;
      }
    }

    return vrniCorsJson({status: "success", data: Object.keys(imenaDogodkov)});
  }

  // 4. PRIDOBIVANJE MARKERJEV/SEKTORJEV ZA TOČNO DOLOČEN DOGODEK
  if (akcija === "pridobiDogodke") {
    var izbranDogodek = e.parameter.dogodek;

    // NOVO: če je dogodek zaščiten z geslom (nastavljeno ob zaključku intervencije), brez
    // pravilnega gesla ne vrnemo podatkov - namesto tega "locked", da frontend vpraša za geslo.
    if (izbranDogodek) {
      var zascitaDogodke = preveriZascitoDogodka(izbranDogodek, e.parameter.gesloHashDogodka || "");
      if (zascitaDogodke.zascitena && !zascitaDogodke.ok) {
        return vrniCorsJson({status: "locked", message: "Dogodek je zaščiten z geslom."});
      }
    }

    var sheetDogodki = ss.getSheetByName("Dogodki");
    if (!sheetDogodki) {
      return vrniCorsJson({status: "success", data: []});
    }

    var podatkiDogodkov = sheetDogodki.getDataRange().getValues();
    var dogodkiList = [];

    for (var i = 1; i < podatkiDogodkov.length; i++) {
      if (!izbranDogodek || podatkiDogodkov[i][0] === izbranDogodek) {
        try {
          dogodkiList.push({
            dogodek: podatkiDogodkov[i][0],
            tip: podatkiDogodkov[i][1],
            podatki: JSON.parse(podatkiDogodkov[i][2]),
            // POPRAVEK: dodana dodeljena enota (4. stolpec), da vodja lahko sektor dodeli enoti
            dodeljenaEnota: podatkiDogodkov[i][3] || ""
          });
        } catch(err) {
          Logger.log("Napaka pri branju JSON vrstice: " + i);
        }
      }
    }
    return vrniCorsJson({status: "success", data: dogodkiList});
  }

  // 4b. NOVO: PRIDOBIVANJE SAMO TISTIH SEKTORJEV, KI SO DODELJENI DOLOČENI ENOTI
  // (uporablja terenEPV.html, da enoti na terenu prikaže sektor, ki ji ga je dodelil vodja)
  if (akcija === "pridobiDodeljeneSektorje") {
    var sheetDogodki = ss.getSheetByName("Dogodki");
    if (!sheetDogodki) {
      return vrniCorsJson({status: "success", data: []});
    }

    var izbranDogodek2 = (e.parameter.dogodek || "").toString().trim().toLowerCase();
    // POMEMBNO: namerno NI "enota" - ta parameter zgoraj (2.) sproži zapis lokacije za
    // katerikoli akcija, zato mora biti ime za filtriranje dodeljenih sektorjev drugačno.
    var izbranaEnota = (e.parameter.enotaIme || "").toString().trim().toLowerCase();
    var podatkiDogodkov2 = sheetDogodki.getDataRange().getValues();
    var dodeljeniList = [];

    for (var j = 1; j < podatkiDogodkov2.length; j++) {
      var vrsticaDogodek = (podatkiDogodkov2[j][0] || "").toString().trim().toLowerCase();
      // POPRAVEK: stolpec "dodeljenaEnota" lahko vsebuje več imen, ločenih z vejico
      // (en sektor je lahko dodeljen več enotam), zato preverimo pripadnost seznamu, ne enakost niza.
      var vrsticaEnotaRaw = (podatkiDogodkov2[j][3] || "").toString();
      var seznamEnotVrstice = vrsticaEnotaRaw.split(',').map(function(s) { return s.trim().toLowerCase(); }).filter(function(s) { return s.length > 0; });

      if (seznamEnotVrstice.indexOf(izbranaEnota) !== -1 && (!izbranDogodek2 || vrsticaDogodek === izbranDogodek2)) {
        try {
          dodeljeniList.push({
            dogodek: podatkiDogodkov2[j][0],
            tip: podatkiDogodkov2[j][1],
            podatki: JSON.parse(podatkiDogodkov2[j][2])
          });
        } catch(err) {
          Logger.log("Napaka pri branju JSON vrstice (dodeljeni sektorji): " + j);
        }
      }
    }
    return vrniCorsJson({status: "success", data: dodeljeniList});
  }

  // 4c. NOVO: PRIDOBIVANJE SPOROČIL S TERENA (SOS, najdena oseba/žival, ...) ZA AKTIVNI DOGODEK
  if (akcija === "pridobiSporocila") {
    var izbranDogodek3 = e.parameter.dogodek;
    // POPRAVEK: brez izbranega dogodka NE vrnemo sporočil iz vseh dogodkov skupaj
    if (!izbranDogodek3 || izbranDogodek3 === 'novy') {
      return vrniCorsJson({status: "success", data: []});
    }

    // NOVO: enaka zaščita z geslom dogodka kot pri pridobiDogodke zgoraj
    var zascitaSporocila = preveriZascitoDogodka(izbranDogodek3, e.parameter.gesloHashDogodka || "");
    if (zascitaSporocila.zascitena && !zascitaSporocila.ok) {
      return vrniCorsJson({status: "locked", message: "Dogodek je zaščiten z geslom."});
    }

    var sheetSporocila = ss.getSheetByName("Sporocila");
    if (!sheetSporocila) {
      return vrniCorsJson({status: "success", data: []});
    }

    var vrsticeSporocil = sheetSporocila.getDataRange().getValues();
    var sporocilaList = [];

    for (var k = 1; k < vrsticeSporocil.length; k++) {
      var vrstica = vrsticeSporocil[k];
      if (vrstica[2] === izbranDogodek3) {
        sporocilaList.push({
          cas: vrstica[0],
          enota: vrstica[1],
          dogodek: vrstica[2],
          sporocilo: vrstica[3],
          lat: vrstica[4],
          lon: vrstica[5]
        });
      }
    }
    sporocilaList.reverse(); // najnovejše sporočilo na vrhu
    return vrniCorsJson({status: "success", data: sporocilaList});
  }

  // 4d. NOVO: SPOROČILA IZ ŠTABA ENOTAM (poveljstvo -> teren, obratna smer od 4c.)
  if (akcija === "posljiSporociloStab") {
    return posljiSporociloStab(e);
  }
  if (akcija === "pridobiSporocilaStab") {
    return pridobiSporocilaStab(e);
  }

  // 4e. NOVO: GESLO ZAKLJUČENE INTERVENCIJE (nastavi/preveri geslo, ki ščiti podatke dogodka)
  if (akcija === "shraniGesloDogodka") {
    return shraniGesloDogodka(e);
  }
  if (akcija === "preveriGesloDogodka") {
    var preverjenoGeslo = preveriZascitoDogodka(e.parameter.dogodek || "", e.parameter.gesloHash || "");
    return vrniCorsJson({status: "success", zascitena: preverjenoGeslo.zascitena, ok: preverjenoGeslo.ok});
  }

  // 5. PRIVZETO: Prikaz lokacij enot za osveževanje na zemljevidu
  var sheetLokacije = ss.getSheetByName("Lokacije");
  if (!sheetLokacije) {
    return vrniCorsJson({status: "success", data: []});
  }

  var podatkiLokacij = sheetLokacije.getDataRange().getValues();
  return vrniCorsJson({
    status: "success",
    data: podatkiLokacij
  });
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return vrniCorsJson({status: "error", message: "Prazen POST zahtevek"});
    }

    var vnos = JSON.parse(e.postData.contents);

    // Zaščita POST zahtev z geslom
    if (vnos.geslo) {
      var ok = (vnos.geslo.toLowerCase() === PRAVILNO_GESLO_HASH.toLowerCase()) ||
               (vnos.geslo === NAVADNO_GESLO);

      if (!ok) {
        return vrniCorsJson({
          status: "error",
          message: "Napačno geslo (POST)! Prejeto: " + vnos.geslo
        });
      }
    } else {
      return vrniCorsJson({status: "error", message: "Manjka geslo!"});
    }

    // SHRANJEVANJE SEKTORJEV IN MARKERJEV ZA DOGODEK
    if (vnos.akcija === "shraniSektorje") {
      // NOVO: enaka zaščita z geslom dogodka kot pri branju - če je dogodek zaščiten,
      // shranjevanje (popravek) brez pravilnega gesla ni dovoljeno.
      var zascitaShrani = preveriZascitoDogodka(vnos.dogodek || "", vnos.gesloHashDogodka || "");
      if (zascitaShrani.zascitena && !zascitaShrani.ok) {
        return vrniCorsJson({status: "locked", message: "Dogodek je zaščiten z geslom."});
      }

      var sheetDogodki = ss.getSheetByName("Dogodki");
      if (!sheetDogodki) {
        sheetDogodki = ss.insertSheet("Dogodki");
        // POPRAVEK: dodan stolpec "dodeljenaEnota", da lahko vodja sektor dodeli enoti
        sheetDogodki.appendRow(["dogodek", "tip", "podatki", "dodeljenaEnota"]);
      }

      var imeDogodka = vnos.dogodek;
      var noviSektorji = vnos.sektorji || [];

      // Odstrani stare zapise za ta dogodek (da se ne podvajajo)
      var zadnjaVrstica = sheetDogodki.getLastRow();
      if (zadnjaVrstica > 1) {
        var podatki = sheetDogodki.getRange(2, 1, zadnjaVrstica - 1, 4).getValues();
        for (var i = podatki.length - 1; i >= 0; i--) {
          if (podatki[i][0] === imeDogodka) {
            sheetDogodki.deleteRow(i + 2);
          }
        }
      }

      // Dodaj nove sektorje/markerje
      noviSektorji.forEach(function(sektor) {
        sheetDogodki.appendRow([imeDogodka, sektor.tip, JSON.stringify(sektor.geojson), sektor.dodeljenaEnota || ""]);
      });

      return vrniCorsJson({status: "success"});
    }

    // REZERVI VNOS LOKACIJE PREKO POST METODE
    var sheetLokacije = ss.getSheetByName("Lokacije");
    if (!sheetLokacije) {
      sheetLokacije = ss.insertSheet("Lokacije");
      sheetLokacije.appendRow(["Čas", "Enota", "Latitude", "Longitude", "Natančnost", "Dogodek"]);
    }

    var cas = Utilities.formatDate(new Date(), "GMT+2", "yyyy-MM-dd HH:mm:ss");
    sheetLokacije.appendRow([cas, vnos.enota, vnos.lat, vnos.lon, vnos.natancnost || "", vnos.dogodek || ""]);

    return vrniCorsJson({status: "success"});

  } catch(napaka) {
    return vrniCorsJson({status: "error", message: napaka.toString()});
  }
}

// ==========================================================================
// NOVO: SPOROČILA IZ ŠTABA ENOTAM (poveljstvo -> teren, obratno od "Sporocila" s terena)
// Klicano iz doGet() zgoraj (4d.) za akcija=posljiSporociloStab / pridobiSporocilaStab.
// Geslo je za obe akciji že preverjeno v koraku 1. doGet(), zato ga tu ne preverjamo znova.
// ==========================================================================

/**
 * Vrne list "SporocilaStab" (ga ustvari z glavo, če še ne obstaja).
 */
function pridobiSporocilaStabSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("SporocilaStab");
  if (!sheet) {
    sheet = ss.insertSheet("SporocilaStab");
    sheet.appendRow(["Cas", "Dogodek", "Cilj", "Sporocilo"]);
  }
  return sheet;
}

/**
 * akcija=posljiSporociloStab - zapiše novo sporočilo iz štaba enoti (ali vsem).
 * Parametri (GET): dogodek, cilj (ime enote ALI "VSI"), sporocilo, geslo
 */
function posljiSporociloStab(e) {
  var dogodek = (e.parameter.dogodek || "").toString().trim();
  var cilj = (e.parameter.cilj || "").toString().trim();
  var sporocilo = (e.parameter.sporocilo || "").toString().trim();

  if (!dogodek || !cilj || !sporocilo) {
    return vrniCorsJson({status: "error", message: "Manjkajo parametri (dogodek/cilj/sporocilo)."});
  }

  var sheet = pridobiSporocilaStabSheet();
  var cas = Utilities.formatDate(new Date(), "GMT+2", "yyyy-MM-dd'T'HH:mm:ss");
  sheet.appendRow([cas, dogodek, cilj, sporocilo]);

  return vrniCorsJson({status: "success"});
}

/**
 * akcija=pridobiSporocilaStab - prebere sporočila iz štaba za dogodek.
 * Parametri (GET): dogodek (obvezen), cilj (neobvezen - ime enote; poleg
 * natančnega ujemanja se vedno vrnejo tudi sporočila s cilj="VSI").
 * Če "cilj" NI podan, se vrnejo VSA sporočila tega dogodka (uporabno za tisk/poročilo).
 */
function pridobiSporocilaStab(e) {
  var dogodek = (e.parameter.dogodek || "").toString().trim();
  var ciljFilter = (e.parameter.cilj || "").toString().trim().toLowerCase();

  var sheet = pridobiSporocilaStabSheet();
  var podatki = sheet.getDataRange().getValues();
  var vrstice = podatki.slice(1); // brez glave

  var rezultat = vrstice
    .filter(function(v) { return (v[1] || "").toString() === dogodek; })
    .filter(function(v) {
      if (!ciljFilter) return true; // brez filtra - vse vrstice tega dogodka (tisk/poročilo)
      var vrsticaCilj = (v[2] || "").toString().trim().toLowerCase();
      return vrsticaCilj === ciljFilter || vrsticaCilj === "vsi";
    })
    .map(function(v) { return { cas: v[0], dogodek: v[1], cilj: v[2], sporocilo: v[3] }; });

  return vrniCorsJson({status: "success", data: rezultat});
}

// ==========================================================================
// NOVO: GESLO ZAKLJUČENE INTERVENCIJE
// Klicano iz doGet() zgoraj (4e.) za akcija=shraniGesloDogodka. Geslo aplikacije (EPV2026)
// je za to akcijo že preverjeno v koraku 1. doGet(), zato ga tu ne preverjamo znova -
// samo lastnik splošnega gesla (vodja/štab) lahko zaklene/odklene dostop do dogodka.
// ==========================================================================

/**
 * Vrne list "DogodekGesla" (ga ustvari z glavo, če še ne obstaja).
 */
function pridobiDogodekGeslaSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("DogodekGesla");
  if (!sheet) {
    sheet = ss.insertSheet("DogodekGesla");
    sheet.appendRow(["Dogodek", "GesloHash", "Cas"]);
  }
  return sheet;
}

/**
 * akcija=shraniGesloDogodka - nastavi (ali prepiše) geslo, ki od zdaj naprej ščiti dostop
 * do podatkov tega dogodka. Kliče se ob zaključku intervencije (vsak zaključek generira
 * novo geslo, tudi po popravku in ponovnem zaključku).
 * Parametri (GET): dogodek, gesloHash (zgoščena vrednost, ne golo geslo), geslo (app geslo)
 */
function shraniGesloDogodka(e) {
  var dogodek = (e.parameter.dogodek || "").toString().trim();
  var gesloHash = (e.parameter.gesloHash || "").toString().trim();

  if (!dogodek || !gesloHash) {
    return vrniCorsJson({status: "error", message: "Manjkajo parametri (dogodek/gesloHash)."});
  }

  var sheet = pridobiDogodekGeslaSheet();
  var podatki = sheet.getDataRange().getValues();
  var cas = Utilities.formatDate(new Date(), "GMT+2", "yyyy-MM-dd'T'HH:mm:ss");

  for (var i = 1; i < podatki.length; i++) {
    if ((podatki[i][0] || "").toString() === dogodek) {
      // Dogodek že ima geslo - prepišemo (nova vrstica se ne doda, da vrstic ne kopičimo)
      sheet.getRange(i + 1, 2, 1, 2).setValues([[gesloHash, cas]]);
      return vrniCorsJson({status: "success"});
    }
  }

  sheet.appendRow([dogodek, gesloHash, cas]);
  return vrniCorsJson({status: "success"});
}
