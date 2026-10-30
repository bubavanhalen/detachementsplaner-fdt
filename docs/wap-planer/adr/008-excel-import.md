# ADR-008: Excel-Import und gemeinsames Modul mit dem Tagesbefehl-Vorhaben

- **Status:** Entwurf Runde 5 (01.10.2026, nach AR0-44, AR0-46). **Entschieden an Gate 0 (02.10.2026):** Option B mit G-10 ja, E12 c, Regel 4 nach Gate-0-Entscheid 7 b (Abschnitt «Regel 4 – Meldung im Bericht»); Antwort wörtlich in `PROGRESS.md` Freigabeprotokoll.
- **Leitplanken:** 7 (abgegrenztes Modul mit eigenem Bericht; prüfen, ob mit dem Tagesbefehl-Vorhaben geteilt), 1; Beschrieb 8.2, 14.1, 14.5, 14.8; Prompt §9
- **Gate-0-Entscheide des Auftraggebers:** G-10 gemeinsames Modul (verschiebt bzw. erweitert Dateien des Tagesbefehl-Werkzeugs, Prompt §5.6); **E12 Strenge Prüfung der verschobenen Altmodule** (ADR-010 §12, Abschnitt «Altmodule» unten); Q-006 Import-Regel 4 (Gate-0-Entscheid 7). Alle entschieden am 02.10.2026: G-10 ja, E12 c, Q-006 b.

## Kontext

- Das Tagesbefehl-Werkzeug liest den Kp-WAP heute mit `src/io/wap/` (fflate + DOMParser, kein SheetJS). Aufbau: `zip.ts`, `xml.ts`, `sheet.ts`, `colors.ts`, `drawing.ts` (Gruppen-Transformation, Rotation, Füllungen), `calibrate.ts` (Zeit aus Stundenmarken, Tage/Spalten aus dem Kopf), darüber tagesbefehl-spezifisch `legend.ts`, `footnotes.ts`, `content.ts`, `sections.ts`, `assemble.ts`, `index.ts`. Tests: `tests/wap-parser.test.ts`, `tests/wap-real.test.ts`.
- Der WAP-Import braucht mehr als der Tagesbefehl (Beschrieb 8.2): Querbalken, Marker, Beso-Kästchen mit Geometrie, Rap-/Beso-Spalten-Regeln, fette Titel (Regel 12), rot/durchgestrichen als Status (Regel 2), Verläufe als gemeinsame Leitung und halbtransparente Farben (Regel 5), vollständiger Bericht (Regel 8, 11).

## Messung (Spike 4)

Aufbau: Die **unteren Module** `zip`, `xml`, `sheet`, `colors`, `drawing`, `calibrate` werden unverändert **importiert** (nicht kopiert); darüber eine Spike-Zuordnung (Region, Tag, Spalten, Zeit) und Prüfzahlen. Ausführung in Node (jsdom-DOMParser) und in Edge 155 (nativer DOMParser).

**Kp KVK** (`01_02_WAP_FDT_2026.xlsx`):

- Formen gesamt 169 (162 Formen, 6 Verbinder, 1 Bild); Gruppentiefe 0/1/2: 122/41/6; **34 gedreht** (alle im Raster), 39 mit senkrechtem Text.
- Regionen: Raster 111, Zeitachse 38, Seitenleiste 11, Termine 7, Kopf 2.
- Raster-Inhalt 111 (106 mit Text): **111/111** mit Tag, ≥ 1 Spalte und Zeit im Bereich 0340–2420.
- Unabhängige Kontrolle: **21/21** Beso-Kästchen, deren Nummer eine Terminzeile mit Zeit hat, liegen innerhalb 15 Min dieser Zeit.
- Rotationskorrektur nötig: **33 von 34** gedrehten Formen hätten ohne Korrektur eine andere Zeit (> 15 Min) oder andere Spalten.
- Kalibrierung: 19 Stundenmarken; Abstände schwanken um 8 % (Zeilenhöhen) → stückweise lineare Abbildung nötig; kein systematischer Versatz (Median der Kantenabweichung zur 15-Min-Linie +1,2 / +0,2 Min).
- Tage und Spalten aus dem Kopf: Mo 8, Di 8, Mi 5, Do 5, Fr 5, Sa 2, So 2; Startdatum erkannt.
- Laufzeit: Node/jsdom 183 ms (KVK), alle vier Blätter 1,0 s; **Edge: KVK 46 ms, alle vier Blätter Median ≈ 280 ms; CPU ×4: KVK 268 ms, alle Blätter ≈ 1,1 s** (Budget Beschrieb 11: 15 s).

**Übrige Blätter:** Kp Wo 1/2/3: 165/180/131 Formen, Raster 106/119/75, alle mit Tag, Spalte und Zeit im Bereich; Beso-Kontrolle 8/8, 9/9, 7/7. **Bat V3** (`00-03_…_V3.xlsx`): alle vier Blätter kalibrierbar (19 Stundenmarken, Mo–Fr je 8 Spalten, Sa/So je 1), 96–127 Formen.

**Was die unteren Module heute verlieren** (Zählung im XML der Referenzdateien):

| Merkmal | Kp | Bat V3 | Beschrieb |
| --- | --- | --- | --- |
| Fette Textläufe in Formen (`a:rPr b="1"`) | 606 | 496 | 8.2 Regel 12 (fett = Titel) |
| Rote Textläufe in Formen | 0 | 63 | Regel 2 |
| Rich Text in Zellen (Termindetails Bat): Läufe / rot / durchgestrichen / fett | 0 | 261 / 63 / 7 / 112 | Regel 1, 2 |
| Halbtransparente Füllungen (`a:alpha`) | 0 | 98 | Regel 5 |
| Verläufe (`a:gradFill`, heute nur erster Stopp) | 0 | 4 | Regel 5 (gemeinsame Leitung) |
| Linienart (`a:prstDash`) | 331 | 243 | Marker, Linien |

`drawing.ts` liefert nur Klartext-Zeilen (`lines`), `sheet.ts` flacht Rich Text ab, `colors.ts` ignoriert `alpha`. Kopplungen an das Tagesbefehl-Modell: `calibrate.ts` und `footnotes.ts` importieren `TbWeekday`/`TB_WEEKDAYS`, `legend.ts` kennt nur die fünf Kp-Kategorien (`TbLeitung`).

**Kantenlage und Regel 4:** Von 222 Blockkanten in KVK liegen 65 ≤ 1 Min, 71 1–2 Min, 69 2–4 Min, 17 > 4 Min neben der nächsten 15-Min-Linie (Wo 1: 75/65/51/21 von 212). Regel 4 («mehr als 2 Min … in den Bericht») meldet damit rund **35–39 % aller Kanten**.

## Geprüfte Optionen

| | Option | Bewertung |
| --- | --- | --- |
| A | Untere Module **unverändert importieren**, fehlende Merkmale in einem zweiten Durchlauf des WAP-Imports aus dem XML lesen | Keine Änderung an Tagesbefehl-Dateien; aber doppelte XML-Durchläufe, Zuordnung Form ↔ Läufe über Dokumentreihenfolge (fehleranfällig), zwei Wahrheiten |
| B | **Untere Module in ein neutrales gemeinsames Modul** verschieben (z.B. `src/io/xlsx-drawing/`), dort **additiv** erweitern (Läufe mit fett/Farbe/durchgestrichen, Zell-Rich-Text, Alpha, alle Verlaufsstopps, Linienart/-breite), Wochentag-Typ neutral; `src/io/wap/` des Tagesbefehls importiert von dort (bestehende Exporte bleiben) | Ein Leser für beide Werkzeuge; bestehende Tagesbefehl-Tests sichern die Regression; WAP-Import baut eigene Assemblierung darüber |
| C | Kopieren und getrennt weiterentwickeln | Doppelte Pflege, widerspricht Leitplanke 7. Verworfen |
| D | Tagesbefehl-Assemblierung (`assemble.ts`) mitnutzen | Auf Tagesbefehl zugeschnitten (verwirft Verbinder und Symbole, Inhaltsregeln), fehlen Querbalken, Marker, Beso-Geometrie (`repo-analyse.md`). Verworfen |

## Entscheid (Empfehlung)

**Option B.**

1. Gemeinsames Modul `src/io/xlsx-drawing/` mit den **neutralen** Dateien `zip`, `xml`, `sheet`, `colors`, `drawing` (unverändert verschoben, Import-Analyse im Abschnitt «Altmodule»); `calibrate.ts` hängt vom Tagesbefehl-Modell ab und **bleibt** in `src/io/wap/`. Die Erweiterungen (Textläufe mit fett/Farbe/durchgestrichen, Verlaufsstopps, Alpha, Linienart und -breite, Rich Text in Zellen, neutraler Wochentag, neutrale Kalibrierung) liegen nach Entscheid E12 c in **neuen Dateien mit eigenen Typen** (Vertrag E1-07); `WapShape` und die Zelltypen bleiben unverändert.
2. `src/io/wap/` (Tagesbefehl) importiert die fünf verschobenen Module über Weiterleitungen von dort; `calibrate.ts` bleibt unverändert; `legend.ts`, `footnotes.ts`, `content.ts`, `sections.ts`, `assemble.ts` bleiben beim Tagesbefehl. `tests/wap-parser.test.ts` und `tests/wap-real.test.ts` müssen unverändert grün bleiben.
3. Der WAP-Import (`src/io/wap-import/`, ADR-001) baut eine eigene Assemblierung: Legende dynamisch je Blatt (Kp und Bat), Querbalken, Marker, Rapporte, Beso mit Zeitfenstern, Rap-/Beso-Regeln (Regel 6, 7), Formtext-Zerlegung (Regel 12) und den Bericht (Regel 8, 11). Ergebnis ist ein Befehl auf dem Datenmodell (ADR-002) plus Bericht.
3a. Der Import ist **ein** Befehl; der erste Stand mit dem Stand-Datum der Datei (Regel 10) entsteht im selben atomaren Ablauf wie «Neuen Stand setzen», mit den garantierten PDF-Varianten (ADR-002 Punkt 6, ADR-006 Punkt 2a, AR0-01). Der Importbericht wird mit dem Import-Schritt in IndexedDB gespeichert, nach Neuladen wieder angezeigt und beim Undo des Imports ausgeblendet (AR0-12).
4. Das Inventar-Skript des `spec-analyst` (Anhänge A/C) nutzt dieses Modul nie (Prompt §5.1 Schritt 6).
5. Langfristig (Etappe 4, Beschrieb 9.2) bezieht das Tagesbefehl-Werkzeug seine Daten aus dem WAP-Planer; der Excel-Pfad des Tagesbefehls bleibt bis dahin bestehen.

### Altmodule (Entscheid E12, AR0-03, AR0-29)

Eine Probe des `code-reviewer` mit den strengen WAP-Compiler-Optionen (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` …) auf den sechs heutigen Dateien ergab **48 Fehler** (`calibrate.ts` 24, `colors.ts` 10, `sheet.ts` 12, `xml.ts` 2). Die Erweiterungen aus Punkt 1 (Läufe, Verläufe, Alpha, Linienart, Rich Text in Zellen, neutraler Wochentag) berühren `drawing.ts`, `sheet.ts`, `colors.ts` und `calibrate.ts`.

**Import-Analyse (AR0-38, 01.10.2026, `grep "from '" src/io/wap/<datei>.ts`):** `zip.ts` → `fflate`, `./xml`; `xml.ts` → keine; `sheet.ts` → `./colors`, `./xml`; `colors.ts` → `./xml`; `drawing.ts` → `./colors`, `./sheet` (Typ), `./xml`; `calibrate.ts` → **`../../model/tagesbefehl/types`** (`TB_WEEKDAYS`, `TbWeekday`), `./drawing`, `./sheet`, `./xml`. Neutral sind also genau fünf Dateien; `calibrate.ts` unverändert nach `src/io/xlsx-drawing/` zu verschieben würde die Modulgrenze verletzen (ADR-010 §4.4), eine Änderung machte sie streng (24 Fehler).

Regel für alle Optionen: Eine Altdatei ist nur ausgenommen, solange sie **unverändert verschoben** ist, d.h. ihr SHA-256 (Inhalt mit LF-Zeilenenden) dem eingefrorenen Wert in der gesperrten Liste `scripts/wap-gate/legacy-modules.json` entspricht (Werte in Vertrag E1-07 §1a); jede inhaltlich geänderte Datei ist streng und fällt unter die 90-%-Schwelle. Die Bedingung vergleicht nicht mit `main` und gilt daher auch nach dem Merge und in der Suite-CI (AR0-46).

**Mechanismus der Ausnahme (AR0-44):** `exclude` in `tsconfig.wap.json` wirkt nur auf die Startdateien; importiert eine strenge Datei eine Altdatei (auch nur mit `import type`), prüft `tsc` diese streng mit (Probe des `code-reviewer`: 24 Fehler in `colors.ts` 10, `sheet.ts` 12, `xml.ts` 2). Deshalb verwirft die Typprüfung F6 (ADR-010 §3, §4.2) Meldungen zu Dateien der Liste, solange der SHA-256 stimmt; dieselbe Liste und Bedingung gelten für die 90-%-Ausnahme. Ein Test in E1-01 belegt die Filterung.

| | Option | Folge für E1-07 | Aufwand, Risiko |
| --- | --- | --- | --- |
| a | Erweiterungen **in den bestehenden Dateien** | `calibrate.ts`, `sheet.ts`, `drawing.ts` (und für Alpha `colors.ts`) werden geändert und damit streng: 36 bis 46 der 48 Fehler sind zu beheben, dazu 90 % Zweigabdeckung für diese Dateien – faktisch ein **Umbau** von Tagesbefehl-Code | gross; Regressionsrisiko für den Tagesbefehl (Nachweis unten) |
| b | Alle sechs Module in E1-07 auf streng und 90 % bringen | wie a, zusätzlich `xml.ts`, `zip.ts` | am grössten |
| c | **Nur die fünf neutralen Dateien unverändert verschieben; `calibrate.ts` bleibt in `src/io/wap/`**. Alle Erweiterungen in **neue Dateien mit eigenen Typen**: `xlsx-drawing/weekday.ts` (neutraler Wochentag), `calibration.ts` (neutrale Zeit- und Kopf-Kalibrierung für den WAP-Import), `runs.ts`, `fills.ts`, `richText.ts`, `workbook.ts`; sie werten die XML-Knoten erneut aus und ordnen über `WapShape.index` zu | nur neue Dateien sind streng und unter 90 %; kein Umbau des Altcodes; keine Grenzverletzung | mittel: die Kalibrierung (heute ≈ 290 Zeilen in `calibrate.ts`) entsteht neu in `calibration.ts` und existiert bis Etappe 4 zweimal (bewusste, befristete Doppelung, Leitplanke 7 vermerkt); Abweichungen zwischen beiden fallen nur über die gemeinsamen synthetischen Arbeitsmappen auf (Risiko R-09); die Ausnahme der fünf Altdateien braucht die F6-Filterung (siehe Mechanismus); zweiter Durchlauf über dieselben XML-Knoten (Laufzeit im Budget, Spike 4: ≈ 1,1 s bei CPU ×4 für alle Blätter) |

Weitere geprüfte Varianten zu `calibrate.ts`: benannte Grenz-Ausnahme «`src/io/wap-import` darf `src/io/wap/calibrate.ts` importieren» (keine Doppelung, aber der WAP-Import hängt am Tagesbefehl-Modell) oder `calibrate.ts` bewusst streng umbauen (24 Fehler). Beide verworfen zugunsten von c.

Empfehlung: **c**. Vorgabe ohne Entscheid: c. **Entschieden an Gate 0 (02.10.2026): c** (Sammelentscheid Nr 10). Wählt der Auftraggeber a oder b, wird E1-07 um den Umbau vergrössert (Plan 4.12, Risiko R-09). Die Ausnahmeliste ist `scripts/wap-gate/legacy-modules.json` (Pfad und SHA-256), gelesen von F6 und `coverage-check.mjs`, zusätzlich `exclude` in `tsconfig.wap.json`; gesperrt, Änderungen nur über `lock-update`.

### Regressionsnachweis Tagesbefehl (AR0-04)

`tests/wap-real.test.ts` nutzt `describe.skipIf(!available)` mit dem relativen Pfad `fixtures-private/…`; im Paket-Worktree fehlt der Ordner, der Test würde übersprungen. Nachweis für E1-07 deshalb verbindlich:

1. Lauf von `tests/wap-parser.test.ts` und `tests/wap-real.test.ts` **aus dem Code des Paket-Worktrees** mit dem **Haupt-Checkout als Arbeitsverzeichnis** (der Test löst `fixtures-private/` relativ zum Arbeitsverzeichnis auf; der Zweig `wap/e1-07` ist im Paket-Worktree ausgecheckt und kann nicht zusätzlich im Haupt-Checkout ausgecheckt werden, AR0-30):
   ```sh
   cd C:/Users/phili/source/repos/detachementsplaner-fdt
   node <Paket-Worktree>/node_modules/vitest/vitest.mjs run --root <Paket-Worktree> tests/wap-parser.test.ts tests/wap-real.test.ts --reporter=json --outputFile=.qa/e1-07/regression.json
   ```
   Auswertung nur der Zahlen aus dem JSON: `numTotalTests` > 0, `numPendingTests` = 0, `numFailedTests` = 0. Findet der Test `fixtures-private/` nicht (weil Vitest das Arbeitsverzeichnis auf `--root` setzt), ist der Lauf ungültig; dann Ersatzweg: losgelöster Worktree auf dem Commit von `wap/e1-07` (`git worktree add --detach <tmp> <commit>`) mit einer Verzeichnis-Verknüpfung `fixtures-private` → Ordner des Haupt-Checkouts (`mklink /J`, ohne Adminrechte; der Ordner ist git-ignoriert) und Lauf dort; danach Worktree entfernen. Der erste Lauf in E1-07 belegt, welcher Weg gilt. Ein übersprungener Test ist ein blockierender Befund.
2. Hash-Vergleich der `parseWap`-Ausgabe (JSON, sortierte Schlüssel) auf den Referenzdateien vor und nach der Verschiebung; im Paketbericht stehen nur die SHA-256-Werte, nie Inhalte.
3. Beide Tests bleiben unverändert (keine Änderung an Tagesbefehl-Tests).

### Regel 4 – Meldung im Bericht (Gate-0-Entscheid 7 b, Q-006)

**Entschieden an Gate 0 (02.10.2026): b** – gruppiert melden, einzeln erst ab > 4 Min. **Das ist eine vom Auftraggeber freigegebene Abweichung vom Wortlaut von Beschrieb 8.2 Regel 4** («liegt eine Kante mehr als 2 Min neben einer 15-Min-Linie, kommt sie in den Bericht»). Grund: Im Spike 4 lägen sonst 35–39 % aller Blockkanten einzeln im Bericht (Abschnitt «Messung»). Die Rundung auf 5 Min (R-8.2-10) bleibt unverändert.

Präzisierung (verbindlich für Vertrag E1-08 §1a):

1. **Geltungsbereich:** obere und untere Kante jedes importierten Eintrags vom Typ Block (Beschrieb 8.2 Regel 4 «Blockkanten»); nicht Querbalken, Marker, Rapporte, Beso.
2. **Abstand** `a` = Betrag der Differenz zwischen der **ungerundeten**, kalibrierten Kantenzeit und der nächsten 15-Min-Linie, in Minuten (0 ≤ `a` ≤ 7,5). Verglichen wird `a` auf 0,01 Min gerundet (Gleitkomma der Kalibrierung), damit die Grenzen deterministisch sind.
3. `a` ≤ 2: keine Meldung.
4. 2 < `a` ≤ 4: **keine Einzelmeldung**. Je Blatt und Tag (Datum) mit mindestens einer solchen Kante genau **ein Sammeleintrag** der Art `edgeOffGridGrouped`: Anzahl der Kanten (`count` ≥ 1; ein Block mit zwei betroffenen Kanten zählt zweimal) und die Eintrags-IDs der betroffenen Blöcke (`members`, ohne Doppel, aufsteigend), damit die Oberfläche die Gruppe aufklappen und jede Stelle anspringen kann (UI-Richtlinie 9, R-8.2-21). Text: «‹n› Blockkanten 2–4 Min neben der 15-Min-Linie, auf 5 Min gerundet».
5. `a` > 4: **Einzeleintrag** der Art `edgeOffGrid` mit Sprungziel (Eintrag, Form, ursprüngliche Lage). Text: «Blockkante ‹hhmm ungerundet› liegt ‹a› Min neben der 15-Min-Linie, gerundet auf ‹hhmm›» (`a` auf ganze Minuten gerundet angezeigt).
6. Grenzfälle (Abnahmekriterium für den Test): ungerundet 0802 → keine Meldung; 0803 und 0804 → Sammeleintrag; 0805 und 0806 → Einzeleintrag (nächste 15-Min-Linie 0800); zwei Kanten 2–4 Min an zwei Tagen desselben Blatts → zwei Sammeleinträge; dieselbe Lage auf zwei Blättern → zwei Sammeleinträge.
7. Erwartete Grösse (Spike 4, KVK): statt 86 Einzelmeldungen (69 Kanten 2–4 Min, 17 > 4 Min) 17 Einzelmeldungen und höchstens ein Sammeleintrag je Tag; Wo 1: 21 Einzelmeldungen statt 72.

Folge: Die Anforderung R-8.2-11 (Wortlaut des Beschriebs) wird im Katalog auf diese Regel angepasst (Vorschlag an den `spec-analyst`); die Normalisierungsregel «`Kante <hhmm>` (> 2 Min …)» in `anhaenge/normalisierung.md` ebenso. Sie betrifft nur R-8.2-11 und den Importbericht, nicht die Importquote (Anhang A vergleicht Typ, Tag, Zeit nach Rundung, Spalten, Kategorie, Titel, Nummer).

## Folgen

- Änderungen an Dateien des Tagesbefehl-Werkzeugs (Verschieben, Importpfade) → Gate 0; eigenes Arbeitspaket mit Regressionstests des Tagesbefehls, vor dem WAP-Import.
- **Regel 4 erzeugt viele Berichtseinträge** (≈ 35–39 % der Kanten). Vorschlag an den Auftraggeber: Rundung auf 5 Min wie vorgegeben, Bericht aber gruppiert («n Kanten 2–4 Min neben der 15-Min-Linie, gerundet») und einzeln nur > 4 Min – als **Frage an Gate 0** (Abweichung von Beschrieb 8.2 Regel 4 nur mit Zustimmung). **Entschieden an Gate 0 (02.10.2026): angenommen** (Entscheid 7 b); Präzisierung im Abschnitt «Regel 4 – Meldung im Bericht».
- **Leistung (AR0-36):** Das Import-Budget von 15 s (R-11-17) umfasst den ganzen Ablauf `runImport` einschliesslich des Renderns aller Stand-Varianten (jede Woche und Gesamt-PDF) und des Schreibens; der Spike hat nur das Lesen gemessen (≈ 1,1 s bei CPU ×4). Die Leistungsmessung in E1-08 misst deshalb den ganzen Ablauf.
- Die Laufzeit des Lesens liegt weit unter dem Budget; ein Web Worker ist nicht nötig (die CSP verbietet ihn ohnehin).

## Beleg

Arbeitsverzeichnis `spikes/excel-import/` (nicht versioniert); Formlisten mit Echttexten nur in `.qa/etappe0-spikes/`.

- `npm install fflate@0.8.3 jsdom@26 esbuild playwright-core`
- `npx esbuild run-node.ts --bundle --platform=node --format=esm --outfile=dist/run-node.mjs --alias:fflate=./node_modules/fflate --external:jsdom && node dist/run-node.mjs` → z.B. `{"datei":"kp","sheet":"KVK","formenTotal":169,"nachRegion":{"kopf":2,"zeitachse":38,"seitenleiste":11,"termine":7,"raster":111},"gruppentiefe":{"0":122,"1":41,"2":6},"rotiert":34,"vertikalerText":39,"rasterInhalt":111,"rasterInhaltMitText":106,"plausibel":111,"kantenAuf15MinPlusMinus2":54,"ohneRotationskorrekturFalsch":33,"stundenmarken":19,"tage":"Mo:8 Di:8 Mi:5 Do:5 Fr:5 Sa:2 So:2","startDatum":"2026-09-28","totalMs":183}`; `{"datei":"kp","alleBlaetterMs":1002}`; Bat V3 alle vier Blätter ohne Fehler, `{"datei":"bat","alleBlaetterMs":882}`.
- `node analyse.mjs` → KVK `{"besoKaestchen":23,"besoMitTerminzeit":21,"besoZeitPasst15":21,"kantenAbweichungMin":{"0-1":65,"1-2":71,"2-4":69,"4-7.5":17}}`.
- `node signed.mjs` → KVK Median Start +1,20 / Ende +0,19 Min; Stundenabstand 401 611–433 740 EMU.
- `node run-browser.mjs` (Edge 155.0.4283.24) → `{"runs":[301,286,294,265,285,256],"kvkMs":46,…}`, `cpu x4 {"runs":[1235,1199,1111,1174,1084,1141],"kvkMs":268}`.
- `node features.mjs` → Kp `{"drawing_rPr_bold":606,…,"drawing_prstDash":331,"ss_rich_runs":0}`, Bat `{"drawing_rPr_bold":496,"drawing_run_red":63,"drawing_gradFill":4,"drawing_alpha":98,"drawing_prstDash":243,"ss_rich_runs":261,"ss_strike":7,"ss_red":63,"ss_bold":112}`.
