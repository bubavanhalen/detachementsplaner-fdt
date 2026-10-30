# H-DATEN – Paketzweig `wap/h-daten` (Härtung Daten/Modell/IO, Befunde CR-H-D-01 bis CR-H-D-08; AE-006)

- Etappe: 1 (Härtungsrunde vor Gate B).
- Anforderungen:
- Bezug: Befunde CR-H-D-01 bis -08 aus dem unabhängigen Code-Review Daten/Modell/IO (Härtung Runde 1, 14.10.2026) und Import-Befunde (a)–(c) aus visual-qa Härtung 1 (Nachauftrag Orchestrator); (d) Wochenziele wartet auf den Entscheid des Auftraggebers. Die Tests tragen nur IDs bereits eingefrorener Pakete (R-8.2-…, R-4.2-07/-08, R-4.6-15, R-5.2-06, R-4.7-01, R-5.7-04); keine Neuzuordnung im Etappenplan.
- Grundlage: AE-006 §3; Beschrieb 8.2 Regeln 1, 6, 8, 10, 12; Beschrieb 5.2 und 5.7. Zweig ab `wap-codex` 59ffa1d.

Je Befund zuerst ein Test mit fiktiven Daten (rot), dann der Fix (grün). Tests unter `tests/wap/unit/h-daten/`.

| Befund | Test (rot vor dem Fix) | Fix |
| --- | --- | --- |
| CR-H-D-01 Folgezeilen | `import-termine.test.ts` «CR-H-D-01» (3 von 5 rot) | Folgezeile wird mit dem vorherigen Termin als ein Text neu zerlegt, als uncertainParse gemeldet; Schlusspunkt schliesst den Termin |
| CR-H-D-02 Zellen im Terminbereich | `import-termine.test.ts` «CR-H-D-02», fiktive Zellen per `support.ts` (5 von 6 rot) | Zellen unter dem Raster je Tag von oben nach unten gelesen (Rich Text, Zeilenumbruch, Folgezeilen); Kopfzellen und verdeckte Zellen entfallen |
| CR-H-D-04 Kategorie gelöschter Woche | `geloeschte-wochen.test.ts` «CR-H-D-04» (2 von 2 rot) | categoryUsage zählt, deleteCategory ersetzt auch in Einträgen gelöschter Wochen |
| CR-H-D-05 Spaltensatz gelöschter Woche | `geloeschte-wochen.test.ts` «CR-H-D-05» (3 von 3 rot) | columnSetUsage zählt gelöschte Wochen; deleteColumnSet lehnt ab und nennt die gelöschte Woche |
| CR-H-D-03 Nummern ohne Stand-Datum | `import-nummern.test.ts` «CR-H-D-03» (2 von 3 rot) | importierte Beso mit numberFixed true (Regel 10) |
| CR-H-D-06 Marker in der Nebenspalte | `import-marker.test.ts` «CR-H-D-06» (2 von 2 rot) | Marker aus Blöcken werden bei der Umrechnung der Nebenspalte wie der Block umgerechnet |
| CR-H-D-07 verworfener Entwurf | `import-bericht.test.ts` «CR-H-D-07» (1 von 1 rot) | je Form des verworfenen Entwurfs ein Berichtseintrag «nicht zugeordnet» |
| CR-H-D-08 Personen-ZIP | `personen-zip.test.ts` «CR-H-D-08» (2 von 3 rot) | Schreibfehler des Deflate-Stroms aufgefangen; entpackte Grösse aller gelesenen Teile höchstens 50 MB, sonst invalidFile |
| VQA-H1 (a) Bemerkungen Wo2/Wo3 | `import-bemerkungen.test.ts` (2 von 3 rot) | Kp-Bemerkungen als Plan-Bemerkungen (gleicher Text = ein Eintrag), je Woche nicht genannte ausgeblendet; Woche ohne Box übernimmt die der Vorwoche |
| VQA-H1 (c) Marker Linie/flacher Block | `import-marker.test.ts` «Linie oder flacher Block» (3 von 4 rot) | Beschriftung ohne Linienform ab 25 Min Höhe → flacher Block mit `Marker.flatBlockMinutes` (neues optionales Feld, Schema); kleinere → Linie; eine Linie über mehrere Tage trägt je Tag einen Marker. Darstellung der Dauer: H-LAYOUT |

**Anhang-A-Vergleich** (Vergleichsskript wie I4, lokal `.qa/haertung/h-daten/`): Quote je Woche unverändert – KVK 113/122 (92,6 %), Wo1 105/113 (92,9 %), Wo2 106/111 (95,5 %), Wo3 55/66 (83,3 %), gesamt 379/412 (92,0 %); ohne die 16 verdeckten Formen 379/396 (95,7 %). Neu 22 überzählige Ist-Einheiten: die durchgehenden Bemerkungen in Wo2/Wo3 (11 je Woche), die der Anhang A (Excel-Stand, Q-011 N-05) nicht führt. Marker als flacher Block: 10 statt 19.

**Offen, bekannte Mängel.** Zellen im Terminbereich tragen nur Rich Text der Zelle (keine Formfarbe); Kopfzellen werden über eine feste Wortliste erkannt. Darstellung von `flatBlockMinutes` folgt in H-LAYOUT. (b) und (d) siehe FINDINGS.md.

- [x] 6 Neue Tests eingefroren per lock-update mit Grund «H-DATEN» (8 Dateien, 0ef89f8); Testpfade additiv registriert (2971634); privacy-scan über alle geänderten Dateien ohne Befund.
- [x] 7 Umsetzung je Befund mit Rot-Nachweis vor dem Fix (Commits 2971634 … 3aaa90d).
