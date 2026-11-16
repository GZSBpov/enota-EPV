# EPV – zaščita aplikacije

## Kaj je narejeno (1. in 2. korak)

| Prej | Zdaj |
|---|---|
| Geslo `EPV2026` zapisano v javni kodi strani in skripte | Gesla ni v kodi. Vpiše ga uporabnik, preveri ga strežnik; v nastavitvah skripte je samo zgoščena vrednost (SHA-256). |
| Vpis pozicij in sporočil (tudi SOS) brez vsakega preverjanja | Vpis sprejme strežnik samo z žetonom dogodka, ki je v QR kodi oziroma povezavi štaba. |
| Terenski telefon je uporabljal geslo aplikacije | Teren gesla ne pozna; z žetonom lahko bere samo sporočila, točke in sektorje svojega dogodka. |
| QR kode ni bilo mogoče preklicati | »Nova QR koda (prekliči staro)« izda nov žeton; stare povezave prenehajo veljati. |

## Uvedba (vrstni red je pomemben)

1. **Skripta najprej.** V Apps Scriptu zamenjaj kodo z `apps-script/Code.gs`, zaženi `pripraviListe()` (doda list `Zetoni`), nato Uvedi → Upravljanje uvedb → Uredi → Nova različica. Naslov ostane enak.
2. **Nato Merge** pull requesta in Ctrl+F5 v štabu.
3. **Zamenjaj geslo:** prijavi se s starim geslom, klikni oranžni gumb »Staro geslo – zamenjaj« (ali 🔑 Geslo). Novo geslo ima vsaj 8 znakov. Sporoči ga samo ljudem v štabu.
4. Za vsak dogodek odpri »QR Teren« – povezava zdaj vsebuje žeton. Stare povezave brez žetona za ta dogodek ne delujejo več.
5. Ko so vsi telefoni na novi strani: v tabeli meni **EPV → Stroga zaščita vpisov: vklopi**. Potem strežnik zavrne tudi vpise za dogodke, ki QR kode še nimajo.

Pozabljeno geslo: v tabeli meni **EPV → Nastavi geslo aplikacije** (dostopno samo urednikom tabele). Meni se pokaže po ponovnem odprtju tabele.

Stara različica v mapi `V1/` uporablja staro geslo in po zamenjavi gesla ne deluje več.

## Arhiviranje pozicij starih dogodkov

List `Lokacije` raste z vsako oddano pozicijo, strežnik pa ga bere ob vsakem osveževanju. V tabeli meni **EPV → Arhiviraj pozicije starih dogodkov** prestavi pozicije dogodkov brez dejavnosti zadnjih N dni (privzeto 30) v list `LokacijeArhiv`. Arhiviran dogodek ostane na seznamu v štabu in se odpre kot prej (pot, poročilo). Sporočila, točke in sektorji ostanejo na svojih listih.

Pred prvim arhiviranjem naredi kopijo tabele (Datoteka → Ustvari kopijo). Arhiviraj, ko ni intervencije ali vaje. Stara stran `V1/` arhiviranih dogodkov ne vidi.

## Kaj še ostane (naslednji koraki)

3. **Zaščita branja zaključenih dogodkov.** Geslo dogodka danes varuje sporočila in sektorje, ne pa pozicij in točk. Poenotiti.
4. **Omejitve na strežniku.** Največje dolžine besedil, omejitev števila vpisov na enoto in minuto, zavrnitev nesmiselnih koordinat.
5. **Geslo v zahtevi.** Geslo se pošilja v naslovu zahteve (GET). Povezava je šifrirana (HTTPS), vendar je bolje preiti na POST ali na kratkotrajno sejo, ki jo izda strežnik.
6. **Tabela.** Deljenje samo s skrbniki, redna kopija, arhiviranje starih dogodkov, dogovorjen rok hrambe (pozicije oseb so osebni podatki).
7. **Zgodovina repozitorija.** Staro geslo ostane vidno v zgodovini javnega repozitorija – zato ga je treba zamenjati, ne samo odstraniti iz kode.

## Česa ta zaščita ne reši

- Kdor dobi QR kodo ali povezavo, lahko vpisuje za ta dogodek, dokler štab ne izda nove. Povezavo deli samo enotam.
- Ime enote si telefon izbere sam; strežnik ne ve, kdo je res za njim.
- Naslov skripte je javen. Varnost stoji na geslu in žetonih, ne na skrivanju naslova.
