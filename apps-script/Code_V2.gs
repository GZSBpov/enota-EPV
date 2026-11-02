// ==========================================================================
// EPV V2 - STREŽNIŠKA SKRIPTA (Google Apps Script, vezana na Google Sheet)
//
// Spremembe proti V1:
//  - ČAS: zapisuje se pravi trenutek (Date), ne več niz "GMT+2". Sheet dobi časovni pas
//    Europe/Ljubljana (funkcija pripraviListe). Brskalnik čas prikaže v istem pasu - zimski/poletni
//    čas se zato pravilno prilagodi sam.
//  - ID: vsak vpis ima ID, ki ga ustvari naprava. Če terenska aplikacija vpis ponovi (ker ni dobila
//    odgovora), strežnik dvojnika prepozna in ga ne zapiše še enkrat.
//  - ČAS DOGODKA: naprava lahko pošlje čas meritve (t), da pozicije iz čakalne vrste (ni signala)
//    ostanejo na pravem mestu v času.
//  - LockService: istočasni vpisi in shranjevanje sektorjev se ne mešajo.
//  - TOČKE: nova lista "Tocke" - točka s koordinatami, ki jo štab pošlje eni, več ali vsem enotam.
//  - POTRDITVE: nova lista "Potrditve" - enota potrdi prejem sporočila ali točke.
//  - FILTRIRANJE PO DOGODKU: pridobiLokacije vrne samo vrstice izbranega dogodka (in samo novejše od "od").
//  - Besedila, ki se začnejo z = + - @, se zapišejo kot besedilo (ne kot formula v Sheetu).
//
// NAMESTITEV: glej README_V2.md (kopija Sheeta -> Razširitve -> Apps Script -> prilepi to kodo ->
// zaženi pripraviListe() -> Uvedi kot spletno aplikacijo: izvaja kot jaz, dostop: vsi).
// ==========================================================================

var PRAVILNO_GESLO_HASH = "8603900fdfbc2a9cfccf9e8d0ff0501d5b59d559577a65be787860b73b9c9756";
var NAVADNO_GESLO = "EPV2026";
var CASOVNI_PAS = "Europe/Ljubljana";

var GLAVE = {
  Lokacije: ["Čas", "Enota", "Latitude", "Longitude", "Natančnost", "Dogodek", "ID"],
  Sporocila: ["Čas", "Enota", "Dogodek", "Sporočilo", "Latitude", "Longitude", "ID"],
  SporocilaStab: ["Cas", "Dogodek", "Cilj", "Sporocilo", "ID"],
  Tocke: ["Cas", "Dogodek", "ID", "Cilj", "Naziv", "Lat", "Lon", "Polmer", "Opomba", "Status", "Ver"],
  Potrditve: ["Cas", "Dogodek", "Enota", "Tip", "Ref"],
  Dogodki: ["dogodek", "tip", "podatki", "dodeljenaEnota"],
  DogodekGesla: ["Dogodek", "GesloHash", "Cas"]
};

// ---------- pomožne funkcije ----------

function vrniJson(objekt) {
  return ContentService.createTextOutput(JSON.stringify(objekt)).setMimeType(ContentService.MimeType.JSON);
}

function napaka(sporocilo) {
  return vrniJson({ status: "error", message: sporocilo });
}

/** Besedilo, ki bi ga Sheet razumel kot formulo, naredi navadno besedilo. */
function varno(v) {
  if (typeof v !== "string") return v;
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

function pridobiSheet(ime) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ime);
  if (!sheet) {
    sheet = ss.insertSheet(ime);
    sheet.appendRow(GLAVE[ime]);
  }
  return sheet;
}

/** Vrne vrstice brez glave (prazen seznam, če lista ni ali je prazna). */
function vrstice(imeLista) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(imeLista);
  if (!sheet) return [];
  var podatki = sheet.getDataRange().getValues();
  return podatki.length > 1 ? podatki.slice(1) : [];
}

function vMs(v) {
  if (v instanceof Date) return v.getTime();
  var t = Date.parse(v);
  return isNaN(t) ? 0 : t;
}

function stevilo(v) {
  var n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}

function preveriGeslo(g) {
  if (!g) return "Ni prejetega gesla!";
  var ok = (String(g).toLowerCase() === PRAVILNO_GESLO_HASH.toLowerCase()) || g === NAVADNO_GESLO;
  return ok ? null : "Napačno geslo!";
}

/** Izvede funkcijo pod zaklepom; če zaklepa ni mogoče dobiti, vrne napako (naprava ponovi poskus). */
function podZaklepom(f) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return napaka("Strežnik je zaseden, poskusi znova.");
  try {
    return f();
  } finally {
    lock.releaseLock();
  }
}

/**
 * Ali je vpis z danim ID že zapisan? Najprej predpomnilnik, nato zadnjih 400 vrstic lista
 * (stolpec idStolpec, 1-based). ID se v predpomnilnik zabeleži šele po uspešnem zapisu (zabeleziId),
 * da neuspel zapis ne povzroči, da bi ponovni poskus veljal za dvojnika.
 */
function jeDvojnik(sheet, idStolpec, id) {
  if (!id) return false;
  var cache = CacheService.getScriptCache();
  if (cache.get("id:" + sheet.getName() + ":" + id)) return true;
  var zadnja = sheet.getLastRow();
  if (zadnja > 1) {
    var od = Math.max(2, zadnja - 399);
    var ids = sheet.getRange(od, idStolpec, zadnja - od + 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(id)) return true;
    }
  }
  return false;
}

function zabeleziId(sheet, id) {
  if (id) CacheService.getScriptCache().put("id:" + sheet.getName() + ":" + id, "1", 21600);
}

/** Čas dogodka, ki ga je poslala naprava (ms), če je smiseln; sicer trenutni čas strežnika. */
function casDogodka(t) {
  var zdaj = new Date();
  var ms = stevilo(t);
  if (ms !== null && ms > zdaj.getTime() - 3 * 86400000 && ms < zdaj.getTime() + 5 * 60000) return new Date(ms);
  return zdaj;
}

// ---------- zaščita dogodka z geslom (kot V1) ----------

function preveriZascitoDogodka(imeDogodka, podanGesloHash) {
  if (!imeDogodka) return { zascitena: false, ok: true };
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DogodekGesla");
  if (!sheet) return { zascitena: false, ok: true };
  var podatki = sheet.getDataRange().getValues();
  for (var i = 1; i < podatki.length; i++) {
    if (String(podatki[i][0] || "") === imeDogodka) {
      var shranjen = String(podatki[i][1] || "");
      if (!shranjen) return { zascitena: false, ok: true };
      return { zascitena: true, ok: shranjen === (podanGesloHash || "") };
    }
  }
  return { zascitena: false, ok: true };
}

// ---------- vstopne točke ----------

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};

  // 1) Vpis lokacije (in neobvezno sporočila) s terena - brez gesla (kot V1)
  if (p.enota && p.lat && p.lon) return vpisLokacije(p);
  // 1b) Sporočilo BREZ lokacije (npr. SOS, ko telefon nima GPS signala) - sporočilo mora priti do štaba vseeno
  if (p.enota && p.sporocilo) return vpisSporocilaBrezLokacije(p);

  // 2) Vse ostalo zahteva geslo aplikacije
  var gesloNapaka = preveriGeslo(p.geslo);
  if (gesloNapaka) return napaka(gesloNapaka);

  switch (p.akcija) {
    case "pridobiSeznamDogodkov": return pridobiSeznamDogodkov();
    case "pridobiLokacije": return pridobiLokacije(p);
    case "pridobiImenaEnot": return pridobiImenaEnot(p);
    case "pridobiDogodke": return pridobiDogodke(p);
    case "pridobiDodeljeneSektorje": return pridobiDodeljeneSektorje(p);
    case "pridobiSporocila": return pridobiSporocila(p);
    case "posljiSporociloStab": return posljiSporociloStab(p);
    case "pridobiSporocilaStab": return pridobiSporocilaStab(p);
    case "posljiTocko": return posljiTocko(p);
    case "umakniTocko": return umakniTocko(p);
    case "pridobiTocke": return pridobiTocke(p);
    case "potrdiPrejem": return potrdiPrejem(p);
    case "pridobiPotrditve": return pridobiPotrditve(p);
    case "shraniGesloDogodka": return shraniGesloDogodka(p);
    case "preveriGesloDogodka": {
      var r = preveriZascitoDogodka(p.dogodek || "", p.gesloHash || "");
      return vrniJson({ status: "success", zascitena: r.zascitena, ok: r.ok });
    }
    default: return napaka("Neznana akcija.");
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return napaka("Prazen POST zahtevek");
    var vnos = JSON.parse(e.postData.contents);
    var gesloNapaka = preveriGeslo(vnos.geslo);
    if (gesloNapaka) return napaka(gesloNapaka);
    if (vnos.akcija === "shraniSektorje") return shraniSektorje(vnos);
    return napaka("Neznana akcija (POST).");
  } catch (err) {
    return napaka(err.toString());
  }
}

// ---------- lokacije in sporočila s terena ----------

function vpisLokacije(p) {
  var lat = stevilo(p.lat), lon = stevilo(p.lon);
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return napaka("Neveljavne koordinate.");
  return podZaklepom(function () {
    try {
      var sheet = pridobiSheet("Lokacije");
      if (jeDvojnik(sheet, 7, p.id)) return vrniJson({ status: "success", dvojnik: true });
      var cas = casDogodka(p.t);
      var enota = varno(String(p.enota));
      var dogodek = varno(String(p.dogodek || ""));
      sheet.appendRow([cas, enota, lat, lon, stevilo(p.acc) || "", dogodek, p.id || ""]);
      var sporocilo = String(p.sporocilo || "");
      if (sporocilo) {
        pridobiSheet("Sporocila").appendRow([cas, enota, dogodek, varno(sporocilo), lat, lon, p.id || ""]);
      }
      zabeleziId(sheet, p.id);
      return vrniJson({ status: "success" });
    } catch (err) {
      return napaka(err.toString());
    }
  });
}

function vpisSporocilaBrezLokacije(p) {
  return podZaklepom(function () {
    try {
      var sheet = pridobiSheet("Sporocila");
      if (jeDvojnik(sheet, 7, p.id)) return vrniJson({ status: "success", dvojnik: true });
      sheet.appendRow([casDogodka(p.t), varno(String(p.enota)), varno(String(p.dogodek || "")), varno(String(p.sporocilo)), "", "", p.id || ""]);
      zabeleziId(sheet, p.id);
      return vrniJson({ status: "success", brezLokacije: true });
    } catch (err) {
      return napaka(err.toString());
    }
  });
}

function pridobiSeznamDogodkov() {
  var zadnji = {};
  function zabelezi(ime, ms) {
    if (!ime) return;
    ime = String(ime);
    if (zadnji[ime] === undefined || ms > zadnji[ime]) zadnji[ime] = ms;
  }
  vrstice("Dogodki").forEach(function (v) { zabelezi(v[0], 0); });
  vrstice("Lokacije").forEach(function (v) { zabelezi(v[5], vMs(v[0])); });
  vrstice("Sporocila").forEach(function (v) { zabelezi(v[2], vMs(v[0])); });
  var seznam = Object.keys(zadnji).map(function (ime) {
    return { ime: ime, zadnji: zadnji[ime] ? new Date(zadnji[ime]) : null };
  });
  seznam.sort(function (a, b) { return (b.zadnji ? b.zadnji.getTime() : 0) - (a.zadnji ? a.zadnji.getTime() : 0); });
  return vrniJson({ status: "success", data: seznam });
}

/**
 * Lokacije izbranega dogodka. "kazalec" = število vrstic lista, ki jih odjemalec že pozna; vrnjene so samo
 * novejše vrstice (po zapisu, ne po času meritve - pozicije iz čakalne vrste imajo namreč stare čase,
 * a pridejo kasneje). Odgovor vsebuje nov kazalec za naslednji klic.
 */
function pridobiLokacije(p) {
  var dogodek = String(p.dogodek || "");
  if (!dogodek || dogodek === "novy") return vrniJson({ status: "success", data: [], kazalec: 0 });
  var v = vrstice("Lokacije");
  var kazalec = parseInt(p.kazalec, 10) || 0;
  if (kazalec > v.length || kazalec < 0) kazalec = 0; // list je bil medtem skrajšan - začni znova
  var rezultat = [];
  for (var i = kazalec; i < v.length; i++) {
    if (String(v[i][5]) !== dogodek) continue;
    rezultat.push({ cas: v[i][0], enota: v[i][1], lat: v[i][2], lon: v[i][3], acc: v[i][4], id: v[i][6] || ("r" + i) });
  }
  return vrniJson({ status: "success", data: rezultat, kazalec: v.length });
}

function pridobiImenaEnot(p) {
  var dogodek = String(p.dogodek || "");
  var videna = {};
  var seznam = [];
  var v = vrstice("Lokacije");
  for (var i = v.length - 1; i >= 0; i--) { // od najnovejše
    if (dogodek && String(v[i][5]) !== dogodek) continue;
    var deli = String(v[i][1] || "").split(":");
    if (deli[0].toUpperCase() === "SISTEM" || !deli[1]) continue;
    var kljuc = deli[1].trim().toLowerCase();
    if (!videna[kljuc]) { videna[kljuc] = true; seznam.push(deli[1].trim()); }
  }
  return vrniJson({ status: "success", data: seznam });
}

function pridobiSporocila(p) {
  var dogodek = String(p.dogodek || "");
  if (!dogodek || dogodek === "novy") return vrniJson({ status: "success", data: [] });
  var z = preveriZascitoDogodka(dogodek, p.gesloHashDogodka || "");
  if (z.zascitena && !z.ok) return vrniJson({ status: "locked", message: "Dogodek je zaščiten z geslom." });
  var rezultat = [];
  var v = vrstice("Sporocila");
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][2]) !== dogodek) continue;
    rezultat.push({ cas: v[i][0], enota: v[i][1], dogodek: v[i][2], sporocilo: v[i][3], lat: v[i][4], lon: v[i][5], id: v[i][6] || ("r" + i) });
  }
  rezultat.reverse(); // najnovejše zgoraj
  return vrniJson({ status: "success", data: rezultat });
}

// ---------- sektorji (Dogodki) ----------

function pridobiDogodke(p) {
  var izbran = p.dogodek;
  if (izbran) {
    var z = preveriZascitoDogodka(izbran, p.gesloHashDogodka || "");
    if (z.zascitena && !z.ok) return vrniJson({ status: "locked", message: "Dogodek je zaščiten z geslom." });
  }
  var rezultat = [];
  var v = vrstice("Dogodki");
  for (var i = 0; i < v.length; i++) {
    if (izbran && String(v[i][0]) !== izbran) continue;
    try {
      rezultat.push({ dogodek: v[i][0], tip: v[i][1], podatki: JSON.parse(v[i][2]), dodeljenaEnota: v[i][3] || "" });
    } catch (err) {
      Logger.log("Napaka pri branju JSON vrstice: " + i);
    }
  }
  return vrniJson({ status: "success", data: rezultat });
}

function pridobiDodeljeneSektorje(p) {
  var dogodek = String(p.dogodek || "").trim().toLowerCase();
  var enota = String(p.enotaIme || "").trim().toLowerCase();
  var rezultat = [];
  var v = vrstice("Dogodki");
  for (var i = 0; i < v.length; i++) {
    var seznam = String(v[i][3] || "").split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    if (seznam.indexOf(enota) === -1) continue;
    if (dogodek && String(v[i][0]).trim().toLowerCase() !== dogodek) continue;
    try {
      rezultat.push({ dogodek: v[i][0], tip: v[i][1], podatki: JSON.parse(v[i][2]) });
    } catch (err) {
      Logger.log("Napaka pri branju JSON vrstice (dodeljeni sektorji): " + i);
    }
  }
  return vrniJson({ status: "success", data: rezultat });
}

function shraniSektorje(vnos) {
  var z = preveriZascitoDogodka(vnos.dogodek || "", vnos.gesloHashDogodka || "");
  if (z.zascitena && !z.ok) return vrniJson({ status: "locked", message: "Dogodek je zaščiten z geslom." });
  return podZaklepom(function () {
    try {
      var sheet = pridobiSheet("Dogodki");
      var ime = vnos.dogodek;
      var novi = vnos.sektorji || [];
      var zadnja = sheet.getLastRow();
      if (zadnja > 1) {
        var podatki = sheet.getRange(2, 1, zadnja - 1, 4).getValues();
        for (var i = podatki.length - 1; i >= 0; i--) {
          if (podatki[i][0] === ime) sheet.deleteRow(i + 2);
        }
      }
      novi.forEach(function (s) {
        sheet.appendRow([varno(String(ime)), s.tip, JSON.stringify(s.geojson), varno(String(s.dodeljenaEnota || ""))]);
      });
      return vrniJson({ status: "success" });
    } catch (err) {
      return napaka(err.toString());
    }
  });
}

// ---------- sporočila iz štaba enotam ----------

function posljiSporociloStab(p) {
  var dogodek = String(p.dogodek || "").trim();
  var cilj = String(p.cilj || "").trim();
  var sporocilo = String(p.sporocilo || "").trim();
  if (!dogodek || !cilj || !sporocilo) return napaka("Manjkajo parametri (dogodek/cilj/sporocilo).");
  return podZaklepom(function () {
    var sheet = pridobiSheet("SporocilaStab");
    var id = p.id || ("s" + new Date().getTime());
    if (jeDvojnik(sheet, 5, id)) return vrniJson({ status: "success", dvojnik: true, id: id });
    sheet.appendRow([new Date(), varno(dogodek), varno(cilj), varno(sporocilo), id]);
    zabeleziId(sheet, id);
    return vrniJson({ status: "success", id: id });
  });
}

function pridobiSporocilaStab(p) {
  var dogodek = String(p.dogodek || "").trim();
  var filter = String(p.cilj || "").trim().toLowerCase();
  var rezultat = [];
  var v = vrstice("SporocilaStab");
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][1] || "") !== dogodek) continue;
    var cilj = String(v[i][2] || "").trim().toLowerCase();
    if (filter && cilj !== filter && cilj !== "vsi") continue;
    rezultat.push({ id: v[i][4] || ("r" + i), cas: v[i][0], dogodek: v[i][1], cilj: v[i][2], sporocilo: v[i][3] });
  }
  return vrniJson({ status: "success", data: rezultat });
}

// ---------- TOČKE (štab -> teren) ----------

/**
 * Ustvari ali posodobi točko. Parametri: dogodek, id, lat, lon, naziv, polmer, opomba,
 * cilj ("VSI" ali imena enot, ločena z |; prazno = samo na zemljevidu štaba), zamenjaj=1 (cilje zamenja namesto združi).
 * Če so cilji podani, se "Ver" nastavi na zdaj - teren po tem prepozna posodobitev kot novo obvestilo.
 */
function posljiTocko(p) {
  var dogodek = String(p.dogodek || "").trim();
  var id = String(p.id || "").trim();
  var lat = stevilo(p.lat), lon = stevilo(p.lon);
  if (!dogodek || !id) return napaka("Manjkajo parametri (dogodek/id).");
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return napaka("Neveljavne koordinate.");
  return podZaklepom(function () {
    var sheet = pridobiSheet("Tocke");
    var zadnja = sheet.getLastRow();
    var cilj = String(p.cilj || "").trim();
    var vrsta = -1, obstojeca = null;
    if (zadnja > 1) {
      var podatki = sheet.getRange(2, 1, zadnja - 1, GLAVE.Tocke.length).getValues();
      for (var i = 0; i < podatki.length; i++) {
        if (String(podatki[i][2]) === id && String(podatki[i][1]) === dogodek) { vrsta = i + 2; obstojeca = podatki[i]; break; }
      }
    }
    var zdaj = new Date();
    var polmer = stevilo(p.polmer);
    if (obstojeca) {
      var ciljNov = cilj;
      if (cilj && p.zamenjaj !== "1") {
        var stari = String(obstojeca[3] || "");
        var deli = (stari ? stari.split("|") : []).concat(cilj.split("|"));
        var videno = {}, zdruzeno = [];
        deli.forEach(function (d) {
          d = d.trim(); if (!d) return;
          var k = d.toLowerCase();
          if (!videno[k]) { videno[k] = true; zdruzeno.push(d); }
        });
        ciljNov = zdruzeno.some(function (d) { return d.toLowerCase() === "vsi"; }) ? "VSI" : zdruzeno.join("|");
      } else if (!cilj) {
        ciljNov = String(obstojeca[3] || "");
      }
      var nova = obstojeca.slice();
      nova[3] = varno(ciljNov);
      if (p.naziv !== undefined) nova[4] = varno(String(p.naziv));
      nova[5] = lat; nova[6] = lon;
      if (p.polmer !== undefined) nova[7] = polmer === null ? "" : polmer;
      if (p.opomba !== undefined) nova[8] = varno(String(p.opomba));
      nova[9] = "aktivna";
      nova[10] = cilj ? zdaj : obstojeca[10];
      sheet.getRange(vrsta, 1, 1, nova.length).setValues([nova]);
      return vrniJson({ status: "success", ver: nova[10], cilj: ciljNov });
    }
    var ver = cilj ? zdaj : "";
    sheet.appendRow([zdaj, varno(dogodek), id, varno(cilj), varno(String(p.naziv || "Točka")), lat, lon, polmer === null ? "" : polmer, varno(String(p.opomba || "")), "aktivna", ver]);
    return vrniJson({ status: "success", ver: ver, cilj: cilj });
  });
}

function umakniTocko(p) {
  var dogodek = String(p.dogodek || "").trim();
  var id = String(p.id || "").trim();
  if (!dogodek || !id) return napaka("Manjkajo parametri (dogodek/id).");
  return podZaklepom(function () {
    var sheet = pridobiSheet("Tocke");
    var zadnja = sheet.getLastRow();
    if (zadnja > 1) {
      var podatki = sheet.getRange(2, 1, zadnja - 1, GLAVE.Tocke.length).getValues();
      for (var i = 0; i < podatki.length; i++) {
        if (String(podatki[i][2]) === id && String(podatki[i][1]) === dogodek) {
          sheet.getRange(i + 2, 10, 1, 2).setValues([["umaknjena", new Date()]]);
          return vrniJson({ status: "success" });
        }
      }
    }
    return napaka("Točka ni najdena.");
  });
}

/** Točke dogodka. Z enotaIme: samo tiste, namenjene tej enoti ali vsem (VSI). Vrnjene so tudi umaknjene (status), da jih teren odstrani. */
function pridobiTocke(p) {
  var dogodek = String(p.dogodek || "").trim();
  var enota = String(p.enotaIme || "").trim().toLowerCase();
  var rezultat = [];
  var v = vrstice("Tocke");
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][1]) !== dogodek) continue;
    var cilji = String(v[i][3] || "").split("|").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    if (enota) {
      if (cilji.indexOf("vsi") === -1 && cilji.indexOf(enota) === -1) continue;
    }
    rezultat.push({
      cas: v[i][0], dogodek: v[i][1], id: v[i][2], cilj: v[i][3], naziv: v[i][4],
      lat: v[i][5], lon: v[i][6], polmer: v[i][7], opomba: v[i][8], status: v[i][9], ver: v[i][10]
    });
  }
  return vrniJson({ status: "success", data: rezultat });
}

// ---------- potrditve prejema (teren -> štab) ----------

function potrdiPrejem(p) {
  var dogodek = String(p.dogodek || "").trim();
  var enota = String(p.enotaIme || "").trim();
  var tip = String(p.tip || "").trim();
  var ref = String(p.ref || "").trim();
  if (!dogodek || !enota || !tip || !ref) return napaka("Manjkajo parametri (dogodek/enotaIme/tip/ref).");
  return podZaklepom(function () {
    var sheet = pridobiSheet("Potrditve");
    var v = vrstice("Potrditve");
    for (var i = 0; i < v.length; i++) {
      if (String(v[i][1]) === dogodek && String(v[i][2]).toLowerCase() === enota.toLowerCase() && String(v[i][3]) === tip && String(v[i][4]) === ref) {
        return vrniJson({ status: "success", dvojnik: true });
      }
    }
    sheet.appendRow([casDogodka(p.t), varno(dogodek), varno(enota), varno(tip), varno(ref)]);
    return vrniJson({ status: "success" });
  });
}

function pridobiPotrditve(p) {
  var dogodek = String(p.dogodek || "").trim();
  var rezultat = [];
  var v = vrstice("Potrditve");
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][1]) !== dogodek) continue;
    rezultat.push({ cas: v[i][0], enota: v[i][2], tip: v[i][3], ref: v[i][4] });
  }
  return vrniJson({ status: "success", data: rezultat });
}

// ---------- geslo zaključene intervencije (kot V1) ----------

function shraniGesloDogodka(p) {
  var dogodek = String(p.dogodek || "").trim();
  var hash = String(p.gesloHash || "").trim();
  if (!dogodek || !hash) return napaka("Manjkajo parametri (dogodek/gesloHash).");
  return podZaklepom(function () {
    var sheet = pridobiSheet("DogodekGesla");
    var podatki = sheet.getDataRange().getValues();
    var zdaj = new Date();
    for (var i = 1; i < podatki.length; i++) {
      if (String(podatki[i][0] || "") === dogodek) {
        sheet.getRange(i + 1, 2, 1, 2).setValues([[hash, zdaj]]);
        return vrniJson({ status: "success" });
      }
    }
    sheet.appendRow([varno(dogodek), hash, zdaj]);
    return vrniJson({ status: "success" });
  });
}

// ---------- enkratna priprava (zaženi ročno v urejevalniku Apps Script) ----------

/** Ustvari vse liste z glavami in nastavi časovni pas Sheeta ter obliko stolpcev s časom. */
function pripraviListe() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(CASOVNI_PAS);
  Object.keys(GLAVE).forEach(function (ime) {
    var sheet = pridobiSheet(ime);
    var casStolpci = { Lokacije: [1], Sporocila: [1], SporocilaStab: [1], Tocke: [1, 11], Potrditve: [1], DogodekGesla: [3] }[ime] || [];
    casStolpci.forEach(function (c) {
      sheet.getRange(2, c, Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");
    });
  });
  Logger.log("Liste pripravljene, časovni pas: " + ss.getSpreadsheetTimeZone());
}
