# Paket F-DOKU – Rückverfolgbarkeit und Katalog vor Gate B (Schlussrunde)

- Etappe: 1 (Schlussrunde vor Gate B)
- Anforderungen: R-4.6-67, R-5.6-18, R-6-39, R-L-09, R-L-10, R-11-11
- Worktree: `C:\Users\phili\source\repos\wap-wt\f-doku` · Zweig `wap/f-doku` ab `wap-codex` 5da6891
- Rollen: `spec-analyst` (Katalog, Plan, Fragen, Befunde) und `test-engineer` (Tests); kein Produktcode.
- Grundlage: Auftrag F-DOKU des Koordinators (20.10.2026, lokal `.qa/schlussrunde/F-DOKU-auftrag.md`) mit Zusatz nach test-reviewer-2; Befunde SA-2-01, -05, -06, -08, -10, -11, -12 (`.qa/haertung/spec-auditor-2.md`) und TR-2-02 bis TR-2-09 (`.qa/haertung/test-reviewer-2.md`), beide lokal. Plan: `plan/etappe-1.md` «F-DOKU – Rückverfolgbarkeit und Katalog vor Gate B» und Anhang A – Nachtrag F-DOKU; Katalog: Änderungsnotiz F-DOKU.

Die IDs oben (Verhalten aus H-UI2, I2, I5 vorhanden, bisher nur unter fremden IDs geprüft bzw. ohne Test) sind im Etappenplan auf F-DOKU umgehängt. Die neuen F-UX2-IDs R-5.1-26 bis R-5.1-29, R-5.2-11, R-5.2-12 gehören zum eingefrorenen Paket F-UX2; ihre Belege liegen ebenfalls unter den F-DOKU-Testpfaden. Alle übrigen neuen Tests tragen IDs eingefrorener Pakete (Grenzfälle und Namensprüfungen zu F-ABDECKUNG/F-FIX).

| Befund | Stand | Tests / Ablage |
| --- | --- | --- |
| SA-2-01 (blockierend) | belegt unter eigener ID | R-4.6-67 `tests/wap/unit/f-doku/geaendert.test.ts`; R-5.6-18 und R-L-10 `tests/wap/integration/f-doku/migration.test.ts` (Prüfart-Abweichung, FD-01) und `tests/wap-e2e/f-doku/sperre.spec.ts`; R-6-39 `tests/wap-e2e/f-doku/notizen.spec.ts`; R-L-09 `tests/wap-e2e/f-doku/speicherhinweis.dist.spec.ts` (file://) und `speicherhinweis.spec.ts` (Gegentest) |
| trace: R-4.6-61 | nicht belegt, Befund FD-02 | Test als Rot-Nachweis lokal `.qa/schlussrunde/f-doku/r-4.6-61/` (Titel grün, Verschieben rot) |
| trace: R-8.2-44 | nicht umgesetzt, Befund FD-03 | – |
| trace: R-11-11 | belegt; ruhiger Einzellauf grün (unter Fremdlast rot, FD-07) | `tests/wap-perf/f-doku/ziehen.perf.ts`, Eintrag `tests/wap-perf/harness/entries/f-doku.ts`; Messmethode Ablaufverfolgung (HT-08) |
| trace: R-14.1-02, R-14.3-03 | vermerkt (E1-AB bzw. Liste an Gate B) | – |
| SA-2-05 | erledigt | Katalog R-5.6-14, R-5.5-04, Änderungsnotiz F-DOKU 1; ADR-006 Notiz F-UX1 bereinigt |
| SA-2-06 | erledigt (Fragetext rekonstruiert) | `QUESTIONS.md` Abschnitt «Entscheide vom 19.10.2026» (Q-H19-…) |
| SA-2-08 / TR-2-06 | erledigt | Katalog R-5.1-26 bis -29, R-5.2-11, -12; `pakete/F-UX2.md`; FINDINGS «F-UX2»; Tests `tests/wap/unit/f-doku/raster-bedienung.test.ts`, `tests/wap-e2e/f-doku/raster.spec.ts` |
| SA-2-10, SA-2-11, SA-2-12 | erledigt | Katalog R-4.2-04, R-4.6-15, R-11-17; `ui-richtlinie.md` 4.1 (Entscheid an Gate B) |
| TR-2-02, -03, -05, -08 | erledigt | `tests/wap/unit/f-doku/import-grenzen.test.ts`, `import-hilfen-grenzen.test.ts`, `befunde-liste-formtext.test.ts` |
| Mutations-Überlebende A, C, D, E, F, J | A, C, D, E, J getötet; F äquivalent | `.qa/schlussrunde/f-doku/mut/` |
| TR-2-07 | erledigt bis auf zwei Namen | `import-grenzen.test.ts`, `befunde-liste-formtext.test.ts`; FD-06 |
| TR-2-09 / TE-FUX1-01 | nicht umgesetzt: geänderter Test rot, Produktänderung nötig (FD-05) | Patch lokal `.qa/schlussrunde/f-doku/tr-2-09-setNewStand.patch`, Rot-Lauf `tr-2-09-rot.txt` |

**Rot-Nachweis.** Tests auf vorhandenem Verhalten (wie H-TESTS): je Test mindestens ein Mutant im Wegwerf-Worktree `wap-wt/pruef-f-doku` (5da6891 + neue Tests) getötet, Skript und Ergebnisse unter `.qa/schlussrunde/f-doku/mut/`. Vitest 17 von 18 getötet (A, C, D, E, I, J, W1, G1, G2, H1–H5, M1–M3); F überlebt und ist über die Importschnittstelle äquivalent (Bemerkungstexte aus Zellen und Textfeldern kommen schon mit normalisiertem Leerraum in die Signatur; Probe lokal). E2E 6 von 7 getötet (E1 Ctrl+Shift+↑/↓, E2 Einfg, E3 Esc übernimmt, E4 Tagesnotiz, E5b Sperrdialog nicht gesperrt, E6 Hinweis fehlt); E7 (Auffüllen ohne Spaltenvergleich) überlebt im E2E und wird vom Unit-Test (H4) getötet. Der schwächere Mutant E5 (nur `cancel` nicht abgewiesen) überlebt, weil der Esc-Abfang auf Dokumentebene allein genügt.

- [x] 1 Paket-Worktree angelegt und installiert (`git worktree add … -b wap/f-doku wap-codex`, `npm ci` Exit 0)
- [x] 3 Tests (`test-engineer`), jeder Test mit Anforderungs-ID im Namen (Vitest 58, E2E 14 in `tests/**/f-doku/**`, Leistung 1)
- [x] 5 Rot-Nachweis per Mutation (siehe oben; Tests auf vorhandenem Verhalten)
- [x] 6 Test-Freeze per lock-update mit Grund «F-DOKU» (Testpfade additiv in `scripts/wap-gate/testpfade.json`, Freigabe Auftraggeber «ja dauerhaft»)
- [x] 7 Umsetzung entfällt (kein Produktcode; Tests auf vorhandenem Verhalten), alle neuen Vitest-, E2E- und Leistungstests grün (Belege unten)
- [ ] 9 Volle Schleuse (Orchestrator)
- [ ] 10 Prüfung: frischer `test-reviewer` und `spec-auditor`

## Belege

| Schritt | Befehl | Ergebnis |
| --- | --- | --- |
| trace vorher | `node scripts/wap-gate/trace.mjs --mode fast` (auf 5da6891 im Paket-Worktree) | belegt 440, offen 19 (darunter R-4.6-61, -67, R-5.6-18, R-6-39, R-8.2-44, R-11-11, R-14.1-02, R-14.3-03, R-L-09, R-L-10) |
| Vitest F-DOKU | `npx vitest run -c vitest.wap.config.ts --maxWorkers=2 tests/wap/unit/f-doku tests/wap/integration/f-doku` | 6 Dateien, 58 Tests grün |
| E2E edge | Playwright mit eigenem Port und Vite-Cache, `--project edge --workers=1 tests/wap-e2e/f-doku/` | 12 grün (nach zwei Korrekturen der Testdaten: zu kurzer Block, Rückfrage beim Umbenennen FD-04) |
| E2E edge-dist | Einzeldatei `i5` gebaut (`scripts/wap-gate/einzeldatei.mjs`), `--project edge-dist --workers=1 tests/wap-e2e/f-doku/` | 2 grün |
| R-11-11 Einzellauf unter Last | Leistungs-Harness gebaut, `--project perf --workers=1 tests/wap-perf/f-doku/ziehen.perf.ts` (49984b9-Stand) | rot: p95 Hauptthread-Zeit je Bild 17,58 ms (Budget 16,7), längste Aufgabe 36,1 ms (≤ 50); 108 Bilder in 2 s; CPU 36–48 % durch andere Worktrees (FD-07) |
| Merge wap-codex | `git merge --no-ff wap-codex` (8f129fd), Commit 201e1ad, Hook grün (14 Schritte, F8 und F9 grün) | Konflikte FINDINGS, Plan, test-lock.json aufgelöst (Protokollzeilen F-DOKU zuerst) |
| E2E nach Merge | wie oben, `--project edge --project edge-dist --workers=1 tests/wap-e2e/f-doku/` auf 201e1ad | 14 grün |
| R-11-11 Einzellauf ruhig | wie oben auf 201e1ad, CPU 0–2 % | grün: p95 Hauptthread-Zeit je Bild 12,99 ms, längste Aufgabe 15,85 ms |
| trace nachher | `node scripts/wap-gate/trace.mjs --mode fast` auf 201e1ad | grün («OK F9-trace»); belegt 455, offen 13 (R-4.6-61, R-8.2-44, R-14.1-02, R-14.3-03 und H0 R-H-01..-09 ohne Wertung) |
| trace Etappenabschluss | `… --mode fast --etappen-abschluss 1` auf 201e1ad | rot mit 10 erwarteten Restbefunden: R-1-02, R-1-06, R-14-01, R-14-04, R-14.2-05, R-14.15-01 (Abnahmebericht Teil (b), E1-AB), R-4.6-61 (FD-02), R-8.2-44 (FD-03), R-14.1-02 (E1-AB), R-14.3-03 (Liste an Gate B, SA-2-09) |

## Runde 2 (Koordinator 20.10.2026, Befund CR-3-03 aus code-reviewer-3)

Merge wap-codex 79bf4d5 (c6631e9). Befundregister nachgeführt: (a) 78 IDs aus den Prüfberichten Runde 2 und 3 ohne Registerzeile (die 31 aus CR-3-03, dazu Runde-1-IDs aus den Statustabellen der Runde 2 und die Runde-3-Befunde CR-3-01 bis -06, VQA-3-01 bis -05) im Abschnitt «Nachtrag Befundregister Runde 2 und 3» von FINDINGS.md, je mit Stufe, Kurzbefund, Status und Beleg; TR-2-04, CR-D-2-03 und SA-2-07 durch FD-03 erledigt; Entscheidfragen «offen – Gate B». (b) CR-H-U-02/-03 und F-LAYOUT2-A5 nur noch in den Ursprungsabschnitten (Status nachgeführt), UX-H-03 nur im Abschnitt H-UI2. (c) FD-04 behoben 98b3d88; FD-02 teilweise (seitliches Ziehen → CR-3-01). Abgleich lokal `.qa/schlussrunde/f-doku/findings-abgleich.py` über 8 Berichte (*-2.md, *-3.md): 167 IDs, fehlt 0, mehrfach 0. Ausserhalb der Berichts-IDs stehen CR-E101-P07/-P08 weiter zweimal (Ursprungszeile E1-01 und F-TOOLS Runde 2).

## Runde 3 und letzte Registerrunde (Koordinator 20.10.2026)

Merge wap-codex 79af7c4 (0a4ab44): CR-3-01/-02/-06 und VQA-3-04/-05 behoben 8db0beb (Verifikation code-reviewer bzw. visual-qa ausstehend), CR-3-05 angenommen, TE-FUX2-02 entschieden, FD-02 wieder behoben, CR-E101-P07/-P08 je eine Zeile. Merge wap-codex 2c326ed (enthält 966d848 und F-UX2 Runde 6): ux-critic-3 nachgeführt (UX-2-01 bis -14 Endstatus, UX-H-05, UX-H-12, UX-H-N2; UX-3-01 bis -03 aus F-UX2 Runde 5), F-FIX Runde 3 (VQA-3-01, CR-3-04, VQA-3-02 nur dort), CR-4-01 bis -04 aus F-UX2 Runde 6, CR-4-05 neu offen (Import). Abgleich über 9 Berichte *-2.md/*-3.md: 171 IDs, fehlt 0, mehrfach 0; code-reviewer-4 ebenfalls vollständig. Ausserhalb der Berichts-IDs stehen FT-A-01 und CS-I5-B3-KONSOLE-01 weiter in zwei Abschnitten.
