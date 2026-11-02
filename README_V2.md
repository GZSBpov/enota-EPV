# EPV V2

V1 (`mapeEPV.html`, `terenEPV.html`, `js/`) ostane nespremenjen in deluje naprej. V2 je ločena različica z lastnimi datotekami
in **lastno strežniško skripto in lastnim Sheetom**, da lahko V2 varno preizkusite, ne da bi tvegali delovanje V1.

| | V1 | V2 |
|---|---|---|
| Štab | `mapeEPV.html` | `mapeEPV_V2.html` |
| Teren | `terenEPV.html` | `terenEPV_V2.html` |
| Moduli | `js/` | `js-v2/` |
| Slog | `style.css` | `style-v2.css` |
| Strežnik | obstoječa skripta | `apps-script/Code_V2.gs` (nova skripta + nov Sheet) |

## Uvedba (enkrat, ~10 minut)

1. **Nov Sheet**: ustvari prazno Google tabelo (npr. »Baza Lokacij EPV V2«). Stare podatke pusti v V1 Sheetu.
2. V tabeli: **Razširitve → Apps Script**. Izbriši obstoječo kodo in prilepi vsebino `apps-script/Code_V2.gs`.
3. V urejevalniku izberi funkcijo **`pripraviListe`** in pritisni **Zaženi** (potrdi dovoljenja). Ustvari liste z glavami in nastavi časovni pas tabele na Europe/Ljubljana.
4. **Uvedi → Nova uvedba → Spletna aplikacija**: izvajaj kot *jaz*, dostop *vsi*. Kopiraj URL, ki se konča z `/exec`.
5. V `js-v2/shared-config.js` zamenjaj `VSTAVI_URL_SKRIPTE_V2` s tem URL-jem. (Če URL ni nastavljen, aplikaciji to jasno javita z rdečo pasico.)
6. Naloži nove datoteke v GitHub (`mapeEPV_V2.html`, `terenEPV_V2.html`, `style-v2.css`, mapi `js-v2/` in `apps-script/`). GitHub Pages jih bo objavil na enakem naslovu kot V1.
7. Odpri `…/mapeEPV_V2.html` (geslo je enako kot v V1). Gumb **📱 QR Teren** ustvari povezavo na `terenEPV_V2.html`.

Ob vsaki spremembi `Code_V2.gs` je treba narediti **novo uvedbo (Uvedi → Upravljanje uvedb → Uredi → Nova različica)**; URL ostane enak.

## Kaj je novega

**Točka iz koordinat** (gumb 🎯 v štabu): prilepiš koordinate v poljubnem zapisu, aplikacija prepozna format, točko označi na zemljevidu
(z neobveznim krogom negotovosti) in jo pošlje eni enoti, vsem v sektorju ali vsem. Enota jo dobi z razdaljo in smerjo od sebe,
zvočnim opozorilom in gumbom za navigacijo ter jo potrdi; štab vidi, kdo je prejel.
Podprti zapisi: `46.3934, 15.5746` · `46,3934; 15,5746` · `N46.3934 E15.5746` · `46°23'36"N 15°34'28"E` · `46 23.604 15 34.476` ·
`33T 544175 5137918` (UTM) · `E 544188 N 139461` (D96/TM) · povezave Google/Apple Maps. Zapis `S` se razume kot *sever* (slovenski zapis).
**D48/GK (staro Gauss-Krüger) ni podprto** in ga aplikacija zavrne, ker bi bila pretvorba netočna.

**Zvok**: štab – glasna sirena ob SOS (zveni do potrditve), ding-dong ob novem sporočilu; teren – zvok in vibracija ob sporočilu ali točki iz štaba,
opomnik do 5-krat, dokler ni prebrano. Telefoni in brskalniki zvok dovolijo šele po dotiku: gumb »Tapni za vklop zvoka« se po prvem dotiku spremeni v »Zvok vklopljen«.
(iPhone v brskalniku ne podpira vibracije.)

**Ura**: pravilen čas v Europe/Ljubljana, tudi v tisku (poletni/zimski čas se prilagodi sam).

**Zanesljivost terena**: čakalna vrsta in potrditev prejema (brez signala se nič ne izgubi, ponovljen vpis ne ustvari dvojnika), SOS se pošlje vedno
(tudi brez GPS-a, označen »[brez lokacije]«), utrip za mirujoče enote, nadzor GPS, opozorilo po vrnitvi iz ozadja, zaščita pred dvojnim klikom,
seznam imen enot z normalizacijo (PGD Kebelj = Pgd Kebelj).

**Štab**: stanje enot (aktivna / zastarelo po 90 s / ni signala po 5 min / ustavljeno), polna sled iz vseh pozicij, krog natančnosti GPS,
pozicije s slabo natančnostjo (nad 300 m) ne premaknejo oznake, kazalnik povezave, dnevnik poslanih sporočil s potrditvami,
starejši dogodki (nad 30 dni) so privzeto skriti, tisk vključuje točke in potrditve prejema.

**Hitri gumbi na terenu** so ostali enaki (SOS, Najdena oseba/žival, Začetek, Konec); poleg njih je prosto besedilo.

## Preizkus pred uporabo na terenu (na pravih telefonih)

Avtomatski testi (spodaj) pokrijejo logiko, strežnik in prenos podatkov. Izrisa zemljevida in dejanskega zvoka v testih ni mogoče preveriti,
zato preglej na pravih napravah:

- [ ] Štab: prijava, izbira dogodka, enota se pojavi na zemljevidu, krog natančnosti in sled se izrišejo
- [ ] Štab: 🎯 Točka iz koordinat → točka je na pravem mestu (primerjaj z Google Maps) → pošlji vsem
- [ ] Teren (Android in iPhone): zvok ob točki/sporočilu se sliši; po tapu na »Zvok« je gumb zelen
- [ ] Teren: letalski način 30 s, SOS → »V čakalni vrsti« → po vrnitvi povezave prispe v štab, z uro pritiska
- [ ] Štab: SOS sproži sireno in rdečo pasico; klik na pasico jo utiša
- [ ] Tisk: ura ustreza dejanski uri

## Avtomatski testi (`tests-v2/`)

```
node tests-v2/koordinate.test.js   # razčlenjevanje in pretvorbe (D96/TM, UTM preverjeni z neodvisno formulo)
node tests-v2/backend.test.js      # PRAVA koda Code_V2.gs nad simuliranim Sheetom
python3 tests-v2/e2e.py            # Chromium: teren + štab prek simulatorja (potrebuje Playwright)
```

## Varnost (namenoma odloženo na konec)

V2 varnost zaenkrat obravnava enako kot V1: geslo `EPV2026` je v kodi, vpis lokacij in sporočil s terena ne zahteva gesla, repozitorij je javen.
Ob vpisu se vsa besedila, ki bi jih Sheet razumel kot formulo, zapišejo kot besedilo (to je že vgrajeno). Predlog za zaključek: žeton dogodka v QR kodi,
ki ga strežnik preveri pri vpisu, in zaseben repozitorij.
