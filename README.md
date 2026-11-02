# EPV - Enota za podporo vodenju

Pomoč gasilskim enotam: teren oddaja lokacijo in sporočila, štab vidi enote na zemljevidu, pošilja sporočila in točke.

| | Naslov | Mapa |
|---|---|---|
| **Štab** | `mapeEPV.html` | `js/`, `style.css` |
| **Teren** | `terenEPV.html` | `js/` |
| Strežnik | Google Apps Script `apps-script/Code.gs` | isti Sheet **Baza Lokacij EPV** |
| Stara različica (V1) | `V1/mapeEPV.html`, `V1/terenEPV.html` | `V1/js/`, `V1/style.css` |
| Testi | | `tests/` |

Stara različica je prestavljena v `V1/` in še deluje z novo skripto (ista tabela, zgodovina se vidi naprej).

## Prehod na novo različico (isti Sheet)

**Vrstni red je pomemben: najprej skripta, potem objava spletnih strani.** Nova skripta je združljiva s staro stranjo, zato med prehodom nič ne preneha delovati.

1. **Varnostna kopija**: v Google tabeli *Datoteka → Naredi kopijo* (kopira tudi skripto). To je vaša pot nazaj.
2. **Preveri časovni pas**: *Datoteka → Nastavitve → Časovni pas* mora biti **Ljubljana**. Stare vrstice so bile zapisane v poletnem času in so v tem pasu pravilne. Če pas ni Ljubljana, ga ne spreminjaj brez premisleka: sprememba pasu premakne čase obstoječih vrstic.
3. **Skripta**: *Razširitve → Apps Script*. Staro kodo zamenjaj z vsebino `apps-script/Code.gs`, shrani.
4. V urejevalniku izberi funkcijo **`pripraviListe`** in jo **zaženi** (potrdi dovoljenja). Ne briše podatkov: doda manjkajoče liste (`Tocke`, `Potrditve`) in stolpec `ID`. Če je tabela prazna, nastavi tudi časovni pas.
5. **Nova različica uvedbe** (URL ostane enak): *Uvedi → Upravljanje uvedb → svinčnik → Različica: Nova različica → Uvedi*.
6. Preveri, da stara stran še dela (`V1/mapeEPV.html`), nato združi pull request. GitHub Pages bo objavil novo različico na običajnih naslovih.

**Nazaj, če kaj ne gre**: v *Upravljanje uvedb* izberi prejšnjo različico, ali odpri varnostno kopijo.

QR kode in povezave na `terenEPV.html` ostanejo enake, zdaj vodijo na novo različico. Telefoni s starim stanjem obrazca ne trpijo: novo shranjevanje uporablja drugačne ključe.

## Kaj je novega

**Točka iz koordinat** (gumb 🎯 v štabu): prilepiš koordinate v poljubnem zapisu, aplikacija prepozna format, točko označi na zemljevidu
(z neobveznim krogom negotovosti) in jo pošlje eni enoti, vsem v sektorju ali vsem. Enota jo dobi z razdaljo in smerjo od sebe,
zvočnim opozorilom in gumbom za navigacijo ter jo potrdi; štab vidi, kdo je prejel.
Podprti zapisi: `46.3934, 15.5746` · `46,3934; 15,5746` · `N46.3934 E15.5746` · `46°23'36"N 15°34'28"E` · `46 23.604 15 34.476` ·
`33T 544175 5137918` (UTM) · `E 544188 N 139461` (D96/TM) · povezave Google/Apple Maps. Zapis `S` se razume kot *sever* (slovenski zapis).
**D48/GK (staro Gauss-Krüger) ni podprto** in ga aplikacija zavrne, ker bi bila pretvorba netočna.

**Točka s klikom na zemljevid**: v obrazcu za točko gumb »Ali izberi točko s klikom na zemljevidu« zapre obrazec, klik na zemljevid vpiše koordinate (Esc prekliče), nato nadaljujete kot pri vpisu koordinat.

**Poročilo (tisk)**: pred vsako točko in pred vsakim sporočilom (s terena in iz štaba) je potrditveno polje, enako kot pri enotah. Kljukica = v poročilu,
odkljukano = izpuščeno iz izpisa (ostane v seznamu in v bazi; izbor se pomni na napravi po dogodkih). Poročilo na koncu navede, koliko je bilo izpuščenega.
Umaknjene točke ostanejo v seznamu in poročilu, z napisom »Umaknjena ob« in uro umika (Code.gs hrani čas umika v stolpcu `Umaknjeno`, čas pošiljanja ostane).

**Zvok**: štab - glasna sirena ob SOS (zveni do potrditve), ding-dong ob novem sporočilu; teren - zvok in vibracija ob sporočilu ali točki iz štaba,
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

Avtomatski testi pokrijejo logiko, strežnik in prenos podatkov. Izrisa zemljevida in dejanskega zvoka v testih ni mogoče preveriti,
zato preglej na pravih napravah:

- [ ] Štab: prijava, izbira dogodka, enota se pojavi na zemljevidu, krog natančnosti in sled se izrišejo
- [ ] Štab: 🎯 Točka iz koordinat → točka je na pravem mestu (primerjaj z Google Maps) → pošlji vsem
- [ ] Teren (Android in iPhone): zvok ob točki/sporočilu se sliši; po tapu na »Zvok« je gumb zelen
- [ ] Teren: letalski način 30 s, SOS → »V čakalni vrsti« → po vrnitvi povezave prispe v štab, z uro pritiska
- [ ] Štab: SOS sproži sireno in rdečo pasico; klik na pasico jo utiša
- [ ] Tisk: ura ustreza dejanski uri
- [ ] Stari dogodki (npr. Iskalna Rogla) se odprejo in njihova zgodovina je vidna

## Avtomatski testi (`tests/`)

```
node tests/koordinate.test.js   # razčlenjevanje in pretvorbe (D96/TM, UTM preverjeni z neodvisno formulo)
node tests/backend.test.js      # PRAVA koda Code.gs nad simuliranim Sheetom
python3 tests/e2e.py            # Chromium: teren + štab + stara stran V1/ prek simulatorja (potrebuje Playwright)
```

## Varnost (namenoma odloženo na konec)

Zaenkrat enako kot prej: geslo `EPV2026` je v kodi, vpis lokacij in sporočil s terena ne zahteva gesla, repozitorij je javen.
Ob vpisu se vsa besedila, ki bi jih Sheet razumel kot formulo, zapišejo kot besedilo (to je že vgrajeno). Predlog za zaključek: žeton dogodka v QR kodi,
ki ga strežnik preveri pri vpisu, in zaseben repozitorij.
