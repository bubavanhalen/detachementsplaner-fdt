# H-TESTS – Testlücken aus dem Test-Review der Härtungsrunde (Schnellspur AE-005/AE-006)

- Etappe: 1 (Härtungsrunde, Runde 2)
- Anforderungen: R-5-02, R-5.1-04, R-5.1-06, R-5.1-07, R-5.1-09, R-6-27, R-8.2-21, R-L-06
- Zweig `wap/h-tests` ab `wap-codex` edefd5c, Worktree `C:\Users\phili\source\repos\wap-wt\h-tests`.
- Grundlage: unabhängiges Test-Review `.qa/haertung/test-reviewer-1.md` (TR-H-04, -05, -07 bis -09, -11 bis -13, -15 bis -18; Belege und Mutationsliste unter `.qa/haertung/tr/`) und SA-H-12 aus `.qa/haertung/spec-auditor-1.md` (Berichte nur lokal). Die oben genannten IDs (bisher E1-11, E1-12, E1-16, nie begonnen bzw. ruhend; Verhalten aus I2 bis I5 vorhanden) sind im Etappenplan auf H-TESTS umgehängt (Änderungsnotiz «AE-006 – Härtung H-TESTS»); R-H-32, R-H-36, R-H-37 (ruhende Werkzeugpakete) dort der Etappe 2 zugeordnet (TR-H-18). Alle übrigen Tests tragen IDs eingefrorener Pakete.

| Lücke | Stand | Tests |
| --- | --- | --- |
| TR-H-05 P8 je Fall | geschlossen | `tests/wap/unit/h-tests/p8-faelle.test.ts`: Seitenleiste, Termine, zu viele Spalten (mit Spaltensatz), Kürzel neben dem Kästchen (am Eintrag und Kürzelliste), Zeile entfällt, «…», Text entfällt, keine gemeinsame Lage im Band, je positiv und negativ |
| TR-H-07 P1 | geschlossen | `tests/wap/unit/h-tests/p1-p17-stufen.test.ts`: Rapport «auch in Spalten» und «nur in Spalten», Querbalken (erster betroffener Tag), je positiv und negativ |
| TR-H-08 Liste | geschlossen | `tests/wap-e2e/h-tests/liste.spec.ts`: Reihenfolge je Spalte auf/ab, Filtertreffer enthalten den Suchtext, genau die passenden Zeilen |
| TR-H-09 IDs | geschlossen | neue, richtig benannte Tests: `erfassen.spec.ts` (R-5.1-04, -06, -07, -09, R-6-27, R-5-02), `suite.spec.ts` (R-L-06), `sichern-laden.spec.ts` (R-5.5-07), `verschieben.spec.ts` (R-5.1-14, R-5.6-01); falsche IDs der gesperrten Tests in FINDINGS (TR-H-09) |
| TR-H-11 | geschlossen | `sichern-laden.spec.ts`: sichern, IndexedDB und localStorage leeren, laden → Liste, Stand-PDF (Bytes) und Arbeitsfassung gleich |
| TR-H-12 | geschlossen | `tests/wap/integration/h-tests/personen-grenzen.test.ts`: 5000/5001 Personen und 10 MB ± 1 Byte je CSV und XLSX, Positivkontrolle der Prüfwerte |
| TR-H-13 | teilweise | Autoscroll mit Abfrage (`verschieben.spec.ts`); R-11-11 rot wegen Messumgebung (HT-08, Patch unter `.qa`), R-11-17 nicht messbar (HT-05) |
| TR-H-04 | geschlossen | `tests/wap-perf/h-tests/leistung.perf.ts`: R-11-12, -14, -15, -16 mit literalen Namen; Lauf mit V7 offen (HT-06) |
| TR-H-15 | geschlossen | `tests/wap/unit/h-tests/import-grenzen.test.ts`: gedrehte Kindform (rot 90°) und gespiegelte Gruppe (flipH) durch den ganzen Import, je mit Gegenfall |
| TR-H-16 | geschlossen | `import-grenzen.test.ts` (R-8.2-09 16/15 Min vor und nach dem Termintext), `p1-p17-stufen.test.ts` (R-7-08 aus dem echten Prüflauf; P17 Beso ohne Nummer an nicht vollem Tag) |
| TR-H-17 | geschlossen | `tests/wap/unit/h-tests/spaltenkopf-ereignisse.test.ts`: Ereignismenge der Spaltenköpfe ausdrücklich, mit columnId und columnSetId |
| TR-H-18 | zurückgestellt | R-H-36 (E1-01i ruht), R-H-32, R-H-37 per Änderungsnotiz der Etappe 2 zugeordnet |
| SA-H-12 | geschlossen | `tests/wap-e2e/h-tests/` (R-5.1-04, -09, R-6-27, R-8.2-21 `importbericht.spec.ts`, R-L-06, R-5-02) |

**Rot-Nachweis.** Tests auf vorhandenem Verhalten; je Test mindestens ein Mutant in einer Kopie unter `.qa/haertung/h-tests/mut` getötet: Vitest 33 von 33 (`mutationen-vitest.txt`), E2E 20 von 22 (`mutationen-e2e.txt`; zwei Überlebende: `compareItems` in keyboard.ts wird für die Tab-Folge nicht verwendet, an der echten Stelle getötet; nur das Journal abzuschalten ändert nichts, weil der Speicher vor dem Schliessen fertig ist, zusammen mit verzögertem Speichern getötet), darunter alle in `.qa/haertung/tr/mutationen.txt` überlebenden Mutanten der P8-Fälle, P1, Personen-Grenzwerte, Import-Grenzwert und Listensortierung.

**Befunde.** HT-01 (P8-Meldung Seitenleiste, behoben), HT-02 bis HT-08 offen in FINDINGS (u.a. R-6-27 Ctrl+Pfeile vom Zellzeiger, R-11-11 Messumgebung, R-11-17 Messort, fehlendes Verhalten R-4.6-61, -67, R-5.6-18, R-6-39, R-L-09, R-L-10, R-8.2-44 an H-UI2).

- [x] 6 Neue Tests eingefroren per lock-update mit Grund «H-TESTS» (12 Dateien, f868d7c); Testpfade additiv registriert (fb86422)
- [x] 7 Umsetzung nach Schnellspur AE-005/AE-006 (Tests auf vorhandenem Verhalten, Rot-Nachweis per Mutation; Commits fb86422, 442edaa)
