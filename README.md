# EPV - Enota za podporo vodenju

Pomoč gasilskim enotam: teren oddaja lokacijo in sporočila, štab vidi enote na zemljevidu, pošilja sporočila in točke.

| | Naslov | Mapa |
|---|---|---|
| **Štab** | `mapeEPV.html` | `js/`, `style.css` |
| **Teren** | `terenEPV.html` | `js/` |
| Strežnik | Google Apps Script `apps-script/Code.gs` | isti Sheet **Baza Lokacij EPV** |
| **Načrt (taktična tabla)** | `nacrtEPV.html` | `js/nacrt.js`, `js/nacrt-model.js`, `nacrt.css` |
| Stara različica (V1) | `V1/mapeEPV.html`, `V1/terenEPV.html` | `V1/js/`, `V1/style.css` |
| Testi | | `tests/` |

Stara različica je prestavljena v `V1/` in še deluje z novo skripto (ista tabela, zgodovina se vidi naprej).

## Modul Načrt (taktična tabla)

`nacrtEPV.html` je interaktivna tabla za načrtovanje vaj in intervencij ter za skice pri analizi. Odpre se z gumbom **🚒 Načrt** v štabu
(na trenutnem izrezu zemljevida) ali neposredno. Ne potrebuje strežnika, gesla ali Sheeta.

- **Vozila**: izbereš društvo (kratica), tapneš tip vozila in nato mesto na zemljevidu (ali ga povlečeš). Zaporedna številka prihoda se dodeli sama;
  napis je npr. `3 · SLB · GVC-1`. Vse se da popraviti v desnem stolpcu (številka, kratica, tip, naloga, zasuk). »Drugo…« je za posebno vozilo od drugod.
  Vozila so tlorisi s temnim vetrobranskim steklom; **cisterne (tip s črko C) imajo X** za rumeno črto. Pri **ALK, ZD in GTVD** se lestvenik oziroma roka suka posebej (»Smer lestvenika / roke«).
- **Druge službe**: CZ (modro-rumeno), policija (belo-modro), reševalci (rumeno), vojska (temno zeleno), drugo (roza).
- **Oznake in črte**: poveljniško mesto, triaža, zbirna mesta, požar, nevarnost, nevarna snov, mobilni repetitor, vodni vir, veter, prazen znak z opisom …; cevovod, napad (modro), preiskovanje/reševanje (rdeče), evakuacijska pot, sektor, nevarno območje, besedilo.
- **Urejanje**: sektorju in črti premakneš točko z vlečenjem, **+** doda točko, izbrano točko odstraniš z gumbom. Nevarnemu območju premakneš središče z ročico ✥.
- **Območje zveze in gasilski domovi**: stalni sloj za vse načrte. Uvoz iz Google Earth (projekt → Izvozi kot datoteko KML; deluje tudi KMZ): točke postanejo gasilski domovi, območja in črte obris zveze. Domove lahko dodaš tudi s klikom na zemljevid. Sloj ostane na napravi in se shrani v datoteko načrta; prikaz se vklopi/izklopi. Med risanjem dovoza klik na dom postavi točko natanko nanj.
- **Črte**: vsaka črta ima temno obrobo (bela se vidi na vsaki podlagi) in ji lahko izbereš barvo.
- **Napisi**: stikalo »prikaži napise« skrije ali pokaže vse napise pri ikonah in objektih (zaslon in izpis); posamezen napis skriješ pri izbranem elementu.
- **Legenda**: samo znaki, ki so na skici uporabljeni. Na zaslonu v spodnjem desnem kotu zemljevida, v izpisu v pasu pod skico in nad tabelo vozil.
- **Skice (koraki)**: privzeto Lokacija, Evakuacija, Posredovanje. »Naslednji korak« naredi kopijo trenutne skice za prikaz poteka po času. Vsaka skica si zapomni svoj izrez zemljevida.
- **Shrani / Odpri**: načrt je ena datoteka (`.epvnacrt.json`), ki jo preneseš na drug računalnik in tam odpreš. Delo se sproti hrani tudi v brskalniku.
- **Vrstni red**: izbrani element pošlješ »V ospredje« ali »V ozadje«. Ikona v ozadju je pod narisanimi črtami in območji; pri črtah in območjih gumba določata, katero je narisano čez drugo.
- **Točke črt**: napad, cevovod, pot, dovoz in reševanje se urejajo po točkah enako kot sektor (izberi črto - zadeneš jo tudi s klikom tik ob njej).
- **Izpis**: skica v izpisu pokaže isti izrez kot na zaslonu, v enakem razmerju ikon do zemljevida; legenda je v treh stolpcih.
- **Žive enote s terena**: v desnem stolpcu »Žive enote s terena (EPV)« vklopiš prikaz pozicij enot izbranega dogodka (geslo EPV, osveževanje na 15 s). Niso del načrta: ne shranijo se in jih ni v izpisu.
- **Smeri neba**: kljukica »prikaži smeri neba na skici« doda vetrovnico v kot skice (zaslon in izpis); shrani se z načrtom.
- **Naslov in koordinate**: gumb »📍 Pokaži naslov in koordinate točke«, nato klik na objekt. Pokaže najbližji naslov (javna storitev OpenStreetMap Nominatim, potreben je internet) ter koordinate WGS84 in D96/TM; rezultat se lahko kopira ali doda kot napis na skico.
- **Načrti na spletu**: gumb »☁️ Splet« shrani načrt v tabelo EPV (list `Nacrti`) in ga odpre na drugem računalniku (geslo EPV). Zahteva posodobljeno skripto `apps-script/Code.gs`.
- **Novi znaki**: napad po lestvi, črpalka, elektrika, skupina gasilcev / reševalcev, požar z dimom, smer vetra. Vsakemu znaku se nastavi velikost (npr. večji požar, močnejši veter).
- **Napis v okvirčku**: velikost pisave in širina okvirja; pri nastavljeni širini se besedilo zalomi.
- **Velikost ikon na skici**: drsnik pri »Napisi« pomanjša ali poveča vse ikone in napise ene skice (zaslon, izpis, slika).
- **Slika skice**: gumb »🖼️ Slika« shrani trenutno skico z legendo kot JPG za vstavljanje v elaborat.
- **Posadka iz EPV**: ko so vklopljene žive enote, se vozilo poveže z enoto s terena; število članov, ki ga enota vpiše na telefonu, se vpiše kot posadka.
- **Posadka in poročilo**: pri vozilu vpišeš posadko kot 1 + število gasilcev. Pod vsako skico v izpisu je poročilo o sodelujočih: enote, vozila in člani po enotah ter skupno število sodelujočih (enako v elaboratu za ves načrt). Vozila brez vpisane posadke so označena in niso všteta med člane.
- **Izpis skic**: pod vozili so samo številke prihoda; enota, tip in naloga so v tabeli pod skico.
- **Elaborat**: predloga z besedili (uvod, cilji, varnost, lokacija, scenarij, alarmiranje, časovnica …). Tabela sodelujočih vozil se sestavi iz skic, skice se dodajo na koncu. Izpis: Natisni ali »Shrani kot PDF«.
- **Obrazec ReCO**: prazen obrazec za prijavo vaje (vodstvo, scenarij, imitacija, zavarovanje, zveze, sodelujoča PGD). Sodelujoča društva se predlagajo iz skic. Shrani se z načrtom.
- Seznam društev, tipov vozil in oznak je na vrhu `js/nacrt-model.js`.

Omejitve: podlaga zemljevida potrebuje internet; več naprav ne ureja istega načrta hkrati; živih enot iz EPV tabla še ne prikazuje.

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

**Opomniki, če oddajanje preneha** (teren, kljukica »Opozori me …« je privzeto vklopljena):
- *ni GPS signala* več kot 60 s → rdeč napis + zvok (ponovi se na vsako minuto),
- *ni povezave s štabom* (podatki čakajo v vrsti več kot 60 s) → rdeč napis + zvok,
- *oddajanje ne teče* (nikoli vklopljeno ali prekinjeno, ne namerno ustavljeno) → napis + zvok vsakih **10 minut**,
- po vrnitvi iz ozadja ali ugasnjenega zaslona → opozorilo (kot prej) + zvok.
»Razumem« utiša težavo za 10 min. **Pomembna omejitev**: telefon z ugasnjenim zaslonom ali stranjo v ozadju sam ne more zvoniti (sistem ustavi stran),
zato opomniki delujejo, dokler je zaslon prižgan. Za primer, ko telefon zaspi, opozori **štab**: ko enota, ki je oddajala, 5 minut ne odda
(in ni namerno ustavljena), se v stranski vrstici pojavi opozorilo ⚠️ z zvokom; klik prikaže enoto na zemljevidu. Štab jo nato pokliče.

**Deljenje prek WhatsApp / Viber / SMS in za radio (ZARE)**: v oknu točke in v oknu sporočila s terena (npr. SOS) so gumbi WhatsApp, Viber in SMS, ki odprejo
aplikacijo s pripravljenim besedilom (naziv, koordinate WGS84 in D96/TM, povezava na zemljevid); izberete osebo ali skupino in pošljete.
Pod obrazcem za sporočilo štaba so isti gumbi za besedilo, ki ga pišete. Gumb »📋 Za radio« kopira kratko besedilo za branje po radijski zvezi
(D96/TM vzhod in sever, nato WGS84). Pošiljate vi - brez računov in ključev, zato deluje tudi z navadnimi WhatsApp/Viber skupinami.

**Štabni računalnik**: zaslon ne zaspi, dokler je aplikacija odprta; ob vrnitvi na zavihek se vse takoj osveži. Brskalnik zavihke v ozadju upočasni
(do ene minute zamude), zato naj bo štabni zavihek viden (po možnosti v svojem oknu ali na svojem zaslonu), ne le odprt v ozadju.

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
node tests/nacrt-model.test.js  # model taktične table
python3 tests/nacrt.e2e.py      # taktična tabla v Chromiumu
python3 tests/e2e.py            # Chromium: teren + štab + stara stran V1/ prek simulatorja (potrebuje Playwright)
```

## Varnost

Prva dva koraka zaščite sta narejena: geslo ni več v kodi (preverja ga strežnik, zamenja se v štabu z gumbom 🔑 Geslo), teren pa vpisuje z žetonom dogodka iz QR kode. Uvedba, pozabljeno geslo in preostali koraki: [docs/VARNOST.md](docs/VARNOST.md).

**Vrstni red uvedbe:** najprej nova skripta (`apps-script/Code.gs`, `pripraviListe()`, nova različica uvedbe), šele nato Merge. Po uvedbi takoj zamenjaj staro geslo.
