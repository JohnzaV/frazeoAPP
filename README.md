# PRG / Phraseology Lab

Statická hra na anglickou frazeologii ACC + APP v prostředí inspirovaném radarovým systémem TopSky. První verze obsahuje přílety na RWY 24 v Praze, generovaný ATIS a čtyři skutečné STAR. Nejde o výcvik vytváření rozstupů nebo simulaci provozu v reálném čase.

## Spuštění

Otevři `index.html` v moderním prohlížeči. Není třeba instalace, sestavení, server, účet ani API klíč. Všechny soubory hry jsou místní. Nastavení vrstev a statistiky se ukládají v daném prohlížeči; zákaz místního ukládání nebrání hraní.

## GitHub Pages

1. Rozbal ZIP a nahraj jeho **obsah** do kořene repozitáře. `index.html` musí ležet přímo v kořeni, ne v další podsložce. Nenahrávej pouze samotný ZIP.
2. V repozitáři otevři **Settings → Pages**.
3. V **Build and deployment → Source** zvol **Deploy from a branch**.
4. Vyber větev **main** a složku **/(root)**, potom **Save**.
5. Po dokončení nasazení otevři adresu z panelu Pages.

Nezbytné soubory jsou `index.html`, `style.css`, `app.js`, `engine.js`, `data.js` a `favicon.svg`. Všechny cesty jsou relativní, takže hra funguje i na Pages pod cestou repozitáře. Přiložený soubor `.nojekyll` vypíná zpracování Jekyllem. Obsah `tests/`, tento návod a `package.json` nejsou pro samotné hraní nutné.

## Jak hrát

- Letadlo se přihlásí v přepisu vpravo. Jeho callsign do zprávy vložíš kliknutím na strip nebo zelený label.
- Napiš anglickou zprávu a odešli Enterem. Posádka odpoví podle přijatých pokynů. Radar se mění pouze po vysílání.
- Odvoď si další postup z polohy, příletové tratě, hladiny a letištních informací. Hra nezobrazuje česká zadání.
- Direct přesune letadlo na daný bod. Vektor posune letadlo několik mil ve zvoleném směru. Pokyny k hladině se dokončí mezi snímky.
- Po povolení ILS, klesání na QNH a přibližném vektoru v oblasti příletu přejde situace na letadlo usazené na ILS. Přesný zásah FAF se nepožaduje. Z IAF je možné povolit i procedurální přiblížení bez povinného vektoru.
- Po hlášení usazení předej letadlo na **RUZYNE TOWER 134.560**.
- **Další přílet** nabídne nový callsign a další STAR při stejném ATISu. **Nová relace** vygeneruje nové letištní podmínky.
- F1 otevře přehled podporovaných vzorů a ovládání. Šipky nahoru/dolů procházejí historii zpráv, Escape maže řádku. **Zpět** vrátí poslední přijaté vysílání včetně jeho účinku.
- Mapu posouváš tažením a přibližuješ kolečkem nebo tlačítky +/−. Tlačítko ⌖ ji přizpůsobí situaci. Přepínače ovládají TMA, navigační body, místní body PR, STAR a sekundární provoz. Bod lze kliknutím vložit do zprávy.

## Vyhodnocování

Zpráva se rozebírá na celé podporované konstrukce. Pořadí nezávislých pokynů je volné. Například:

```text
LUFTHANSA 618, TURN LEFT HEADING 210, DESCEND ALTITUDE 4000, QNH 1015
LUFTHANSA 618, QNH 1015, DESCEND TO 4000 FEET, TURN LEFT HEADING 210
```

Obě varianty mají stejný účinek. Pokyny můžeš vydat také samostatně. Pokud je kterákoli část zprávy odmítnuta, neprovede se ani platný zbytek zprávy.

Číselné hodnoty se zadávají číslicemi. FL piš bez úvodní nuly (`FLIGHT LEVEL 70`), heading třemi číslicemi (`HEADING 070`). Velikost písmen, čárky a nadbytečné mezery se nehodnotí. Výslovnost čísel tato textová verze netestuje.

Na výslovné zadání jsou přijímány také tvary bez `TO` a zápis `ALTITUDE 4000`, vedle `TO 4000 FEET`. Tyto textové varianty nejsou tvrzením, že každá z nich je v dodaném dokumentu uvedena jako samostatný doslovný vzor. S ATIS se používá standardní výraz `CONFIRM` a informace scénáře; příklad `CONFIRM INFORMATION BRAVO` je jejich složením, nikoli citací samostatného ATIS vzoru z předpisu.

Procento úspěšnosti sleduje chyby rozpoznání formulací. Kontextové odmítnutí (např. nesprávné QNH), neznámý bod nebo nepodporovaná konstrukce procento nezhoršují. Přehled všech podporovaných vzorů je přímo ve hře. Hodnotitel není obecný analyzátor libovolné anglické frazeologie.

Registrační volací znak lze po identifikaci zkrátit na první a nejméně poslední dva znaky. Volací znak tvořený provozovatelem a označením letu se nezkracuje. Identifikace v tomto scénáři zároveň zastupuje navázání spolehlivého spojení; zaměnitelné registrace se současně nevyskytují. Callsign se v textu zadává názvem provozovatele a číslem nebo registračním znakem, nikoli radarovým třípísmenným kódem provozovatele.

## Data a podklady

Frazeologický základ: uživatelem dodaný dokument **L Frazeologie**, zejména části I/A, I/D–E, II/2, II/3 a II/7–9. Originální dokument se s hrou nedistribuuje. Přehled ve hře a přepisy uvádějí příslušná ustanovení. Hra není produktem ani schválenou pomůckou ŘLP, ICAO nebo výrobce systému TopSky.

Veřejná faktická geografická data byla vytažena z následujících podkladů **AIP ČR / ŘLP ČR dne 30. 10. 2026**:

| Podklad | Použité údaje |
| --- | --- |
| [LKPR AD 2](https://aim.rlp.cz/eaip/html/eAIP/LK-AD-2.LKPR-en-GB.html) | Všech 85 bodů PR v AD 2.22.7, souřadnice prahů, příletové tratě, frekvence v AD 2.18, TA 5000 ft |
| [ENR 2.1](https://aim.rlp.cz/eaip/html/eAIP/LK-ENR-2.1-en-GB.html) | TMA Praha I–IX; u TMA III převzaté hranice MTMA II Kbely |
| [ENR 4.4](https://aim.rlp.cz/eaip/html/eAIP/LK-ENR-4.4-en-GB.html) | Pojmenované body v oblasti Prahy a širšího okolí |
| [ENR 4.1](https://aim.rlp.cz/eaip/html/eAIP/LK-ENR-4.1-en-GB.html) | Vybraná radionavigační zařízení |
| [ENR 1.7](https://aim.rlp.cz/eaip/html/eAIP/LK-ENR-1.7-en-GB.html) | Pravidla nastavování výškoměru a tabulka převodních hladin |
| [RNAV STAR RWY 24](https://aim.rlp.cz/eaip/graphics/a2-pr-star24n.pdf), 19 MAR 2026 | GOLOP4S, LOMKI8S, APRAQ2S, VLM5S |
| [ILS RWY 24](https://aim.rlp.cz/eaip/graphics/a2-pr-ils24.pdf), 06 AUG 2026 | Osa 240° MAG, vztah IAF a finálního přiblížení |

Mapa obsahuje 176 navigačních bodů a devět částí TMA Praha, které byly převedeny ze zveřejněných souřadnic. Obloukové hranice jsou vzorkovány po nejvýše 2°. Všechny značky jsou dostupné v mapové vrstvě; kolidující názvy se při oddálení skrývají. Spojnice STAR neobsahují fly-by oblouky. Magnetická variace použitá pro ilustraci vektorů je publikovaných 5°E (2022).

Tabulka převodních hladin (ENR 1.7.4.5):

| QNH (hPa) | TL |
| --- | --- |
| ≤ 977 | FL80 |
| 978–1013 | FL70 |
| 1014–1050 | FL60 |
| ≥ 1051 | FL50 |

Podklady se při hraní nestahují a pozdější změny AIRAC se automaticky nepřenášejí.

## Zjednodušení první verze

ACC a APP obsluhuješ jako jeden sektor. Přívod od vstupních bodů ke STAR je scénářový, nikoli deklarovaná úplná publikovaná ATS trať. Přechod mezi stanovišti a přesné provozní postupy se nezkouší. TMA VIII je zobrazena přerušovaně kvůli podmíněné aktivaci. Dostupnost Ruzyně Radar 119.010 se pro účely hry předpokládá; denní provozní hodiny se nesimulují. Reálný kanál TWR je 134.560.

Všechny lety, meteorologické podmínky a ATIS jsou vymyšlené. Údaj GS i délka speed vectoru slouží jako orientační grafika; letové výkonnosti a převod IAS/TAS/GS se nesimulují. Sekundární provoz není na hráčově spojení. V této verzi se negenerují úmyslně chybné readbacky.

Holding, nouzové situace, odlety, jiné dráhy, složité podmíněné instrukce a více současně řízených letadel zatím nejsou implementované. Pro horizontální i vertikální osu lze v jedné zprávě vydat jeden pokyn; podporu budoucích podmínek by bylo nutné doplnit samostatně. Při navedení na ILS se kontroluje pouze široká oblast a přibližný směr, ne geometrie správného zachycení.

## Pro úpravy a kontrolu

- `engine.js`: parser, normalizace, validace a přechody snímků.
- `data.js`: statická data mapy a odkazy na zdroje.
- `app.js`: uživatelské rozhraní, SVG radar, přepisy a ukládání statistik.
- `style.css`: vizuální styl a responzivní rozložení.

Testy nevyžadují balíčky třetích stran. S nainstalovaným Node.js spusť:

```sh
node --test tests/engine.test.cjs
```

Ověřují varianty formulací, atomické odmítnutí zpráv, zkracování callsignů, hraniční QNH, všechny čtyři přílety a předání věži.
