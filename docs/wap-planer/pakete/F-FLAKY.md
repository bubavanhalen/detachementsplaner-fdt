# Paket F-FLAKY – flatternde Tests unter Rechnerlast (Schlussrunde vor Gate B)

- Etappe: 1 (Schlussrunde vor Gate B)
- Anforderungen: (keine eigenen; die Tests tragen IDs eingefrorener Pakete, siehe Tabelle)
- Worktree: `C:\Users\phili\source\repos\wap-wt\f-flaky` · Zweig `wap/f-flaky` ab `wap-codex` 79bf4d5
- Grundlage: Auftrag F-FLAKY des Koordinators (20.10.2026); Prompt §7 «Flatternde Tests … blockierend»; Befunde FUX1-LAST-01 und F-LAYOUT2-A6; ADR-010 Regelung E1-07-03 (Workerzahl 4 bleibt).
- Belege (Lastläufe, Auswertungen) nur lokal im Scratch-Ordner der Sitzung; nur fiktive Daten.

Nur Tests und Testumgebung, kein Produktcode. Keine Zeitanforderung des Katalogs wird berührt: Die geänderten Zeitlimits sind die Vorgaben von Vitest (5 s) und Playwright (30 s), keine Leistungsgrenzen; die Budgets R-11-11 bis R-11-17 prüft weiterhin die Leistungssuite.

## Ursachen und Änderungen

| Test | Ursache | Änderung | Befund |
| --- | --- | --- | --- |
| [R-5.6-17] unbekannter Schlüssel in jedem Objekt der Migrations-Fixture (`tests/wap/integration/storage/plan-datei-lesen.test.ts`) | Testschleife über alle Objekte (ruhig 2 s) an der Vitest-Vorgabe 5 s; Produkt 1,3 ms je Datei | Zeitlimit 120 s | FL-01 |
| [R-4.6-54] Farbkennung, dazu [R-4.6-59], [R-4.7-04], [R-7-06] und [R-4.6-51][R-7-07] Orakel KVK (`tests/wap/property/page/farbkennung.test.ts`) | 20 Läufe PDF erzeugen und auslesen (ruhig je Test rund 1 s); Produkt rund 45 ms je Wochen-PDF | Zeitlimit 120 s | FL-01 |
| [R-10-03][R-H-19] Gesamt-PDF V5-ebene2 (`tests/wap/pdf/plan/s6-produkt.test.ts`) | zwei Gesamt-PDF und zwei Prüfläufe V5 (ruhig 0,6 s); Produkt 70–80 ms | Zeitlimit 120 s | FL-01 |
| [R-L-03] gen-font-metrics «Biome-konform», «CLI im Repo» (`tests/wap/unit/text/gen-font-metrics.test.ts`) | Node-Kindprozess (ruhig 0,2 s); im Commit-Hook dieses Pakets unter Fremdlast 12,5 s, rot | Zeitlimit 120 s | FL-01 |
| [R-14.3-01], [R-14.3-02] (`tests/wap/pdf/page/farbkennung.test.ts`), [R-10-03] synthetischer Plan (`tests/wap/pdf/plan/gesamt-pdf.test.ts`) | wie oben; in der eigenen Suite ohne Fremdlast rot bzw. bis 4,7 s | Zeitlimit 120 s | FL-01 |
| [R-5.6-01][R-5.5-07] I2b sichern während des Speicherns (`tests/wap/unit/i2b/sichern.test.ts`) | Oberfläche in jsdom mit fake-indexeddb; in der eigenen Suite ohne Fremdlast 5,5 s, rot; dazu testing-library-Vorgabe 1 s | Zeitlimit 120 s, findByRole/waitFor 30 s | FL-01 |
| [R-5.7-04] Blatt grösser als 50 MB (`tests/wap/unit/h-daten/personen-zip.test.ts`) | Fixture-Bau mit 60-MiB-Zeichenkette und Deflate in JavaScript (1,1 s, 120 MB); Produkt bricht nach 4 ms ab | Bau über node:zlib in 1-MiB-Stücken, Gegenprobe 1 MiB, Zeitlimit 120 s | FL-02, FL-01 |
| E2E H-UI2 SA-H-07, SA-H-21, I5 D5, I5 D4 offline, I2b-B B6 | lange Abläufe (axe, Browserneustart, Download) an der Playwright-Vorgabe 30 s | `test.setTimeout(120_000)` | FL-03 |
| E2E im Projekt edge (Entwicklungsserver) | Kaltstart von Vite (Umwandlung, Vorbündelung) im ersten Test unter Last | globalSetup `tests/wap-e2e/support/aufwaermen.ts` | FL-04 |

Offen: FL-07 (E2E in Edge unter Last, Ursache Umgebung), ausserhalb des Auftrags FL-05 (I2b A3, Leistungsgrenze R-11-11 unter Fremdlast), FL-06 (globale Vitest-Vorgabe, Entscheid architect).

## Belege

Lastläufe Vitest: `VITEST_MAX_WORKERS=4 npx vitest run -c vitest.wap.config.ts` über die vier Dateien, je Lauf JSON-Bericht; Brenner mit N Rechenthreads (Node, selbstbeendend).

| Block | Zeitfenster (20.10.2026) | Last | Stand | Ergebnis |
| --- | --- | --- | --- | --- |
| L1 | 1224–1227 | 19 Threads, 5 Läufe | vorher | rot: R-5.6-17 3/5 (bis 8,2 s), R-4.6-54 4/5, R-10-03 2/5, dazu R-4.6-59, R-4.7-04, R-7-06 |
| L2 | 1230–1233 | 60 Threads, 6 Läufe zip | vorher | rot: R-5.7-04 2/6 (bis 10,9 s) |
| L3 | 1302–1311 | 60 Threads, 10 Läufe | Zwischenstand (60 s, zip nur Fixture) | R-5.7-04 rot 6/10 (5 s), Orakel KVK rot 1/10; übrige grün (bis 53 s) |
| L4 | 1316–1326 | 60 Threads, 3 Läufe unter Last | Endstand ausser Orakel | alle Zieltests grün (bis 65 s); Orakel KVK rot 3/3 → Zeitlimit ergänzt |
| L5 | 1331–1341 | 19 Threads, 4 Läufe unter Last (+1 teilweise) | Endstand | alle grün; R-5.7-04 bis 23 s, R-5.6-17 bis 33 s |

| L6 | 1428–1437 | 10 Threads, 25 Läufe (dazu gen-font-metrics) | Endstand | alle grün; R-5.6-17 bis 6,3 s, Gesamt-PDF bis 13,0 s, Biome-konform bis 12,7 s (mit 5 s wären mehrere rot) |

Ganze WAP-Vitest-Suite wie F8 (4 Worker), ohne Brenner, vor jedem Lauf CPU < 30 % und keine fremden Testprozesse (Auftrag Koordinator):

| Block | Zeitfenster | Stand | Ergebnis |
| --- | --- | --- | --- |
| S2 | 1516–1554, 10 Läufe | vorher (de69e33) | 2/10 rot: [R-5.6-01][R-5.5-07] sichern 5,5 s, [R-14.3-01] 5,1 s; weitere bis 4,9 s ([R-4.6-54] 4,9, [R-10-03] synthetisch 4,7, [R-14.3-02] 4,0) |
| S3 | 1556–1638, 16 Läufe | Endstand | 16/16 grün (abgebrochen auf Wunsch des Koordinators; 4 Läufe stehen aus) |

Ursache [R-5.6-17] im Suite-Kontext: Die Datei läuft fast immer in den ersten Sekunden in einem kalten Worker neben farbkennung, gesamt-pdf und undo-speicher; Dauer 1,7–4,8 s, am längsten beim Start ab 0 s. Fixture (eingefroren) und Produkt unverändert. Der Rechner hat 8 P- und 4 E-Kerne; Streuung auch durch die Kernzuteilung. Vorzug als eigener Commit 1a37870 auf `wap-f-flaky-vorzug` (Basis wap-codex 2c326ed).

E2E (`npx playwright test -c playwright.wap.config.ts --workers=2`, Projekte edge und edge-dist, Auswahl per `--grep` auf die fünf Tests):

| Block | Zeitfenster | Last | Stand | Ergebnis |
| --- | --- | --- | --- | --- |
| E0 | 1237–1244 | Fremdlast der Prüfer (CPU 30–60 %) | vorher | SA-H-07 rot in edge und edge-dist (30 s, edge im letzten Schritt) |
| E1 | 1246–1256 | 19 Threads, 1 Lauf | vorher | 4 rot im edge-Projekt (SA-H-07, SA-H-21, B6, D5), alle beim ersten `page.reload` (Kaltstart Vite, FL-04) |
| M0/M1 | 1510 ruhig, 1654–1701 10 Threads | Messung | Endstand | Vorbereitung ruhig wenige s, unter Last rund 7 min; danach Seitenaufbau 0,2–0,5 s auch unter Last |
| E2 | 1656–1706 | 10 Threads, 1 Lauf | Endstand | edge SA-H-07 rot (über 120 s, in axe), SA-H-21 58 s, D5 73 s; dist-Tests liefen nach Ende der Last |
| E3 | 1720–1730 | 10 Threads ab erstem Test | Endstand | 4 rot (edge SA-H-07, D5; dist SA-H-07, SA-H-21), je über 120 s in axe |
| E4 | 1746–1756 | 5 Threads (Grenzlast) | Endstand | edge SA-H-07 rot (über 120 s), SA-H-21 79 s, D5 67 s; dist-Tests liefen erst nach Ablauf der Last |
| E5 | 1811–1821 | 5 Threads, nur edge-dist | Endstand | SA-H-07 und D4 offline rot (über 120 s), D5 85 s; SA-H-21 8,6 s, B6 2,4 s |

Ergebnis E2E: Die Zeitlimits (FL-03) und die Vorbereitung (FL-04) beseitigen die Ausfälle bei mässiger Last (Vorgabe 30 s ruhig zu 50 % ausgeschöpft, Kaltstart im ersten Test); unter künstlicher Last ab 5 Threads bleiben die axe- und Browser-Neustart-Abläufe rot (FL-07, offen). Der geforderte Beleg «5 Läufe unter Last grün» ist für E2E nicht erbracht.

## Kästchen

- [x] 1 Paket-Worktree angelegt und installiert (`git worktree add … -b wap/f-flaky wap-codex`, `npm ci`)
- [x] 3 Tests: nur bestehende Tests gehärtet (Zeitlimit als Hängerschutz, Fixture ohne 60-MiB-Puffer), neue Datei `tests/wap-e2e/support/aufwaermen.ts` (globale Vorbereitung, kein Test)
- [x] 6 eingefroren: geänderte gesperrte Dateien per lock-update nachgeführt (Grund «F-FLAKY: … (Koordinator 20.10.2026)», Befunde FL-01 bis FL-04), `aufwaermen.ts` aufgenommen, Testpfad in `scripts/wap-gate/testpfade.json` additiv registriert
- [x] 7 Umsetzung: entfällt (nur Tests)
- [ ] 9 Volle Schleuse (Orchestrator)
- [ ] 10 Prüfung: frischer `test-reviewer`
