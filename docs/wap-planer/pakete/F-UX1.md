# F-UX1 – Schlussrunde Bedienung: PDF mit Befunden, Stand nicht rückgängig, Woche löschen, Konsolentext (AE-006)

- Etappe: 1 (Schlussrunde vor Gate B).
- Anforderungen:
- Grundlage: Entscheide des Auftraggebers vom 19.10.2026 (PROGRESS.md, Freigabeprotokoll) «6: ja / 10: a / Stand: ja / B3: b»; Beschrieb 5.2, 5.5, 5.6, 7; ADR-006 (Änderungsnotiz F-UX1); Katalog-Änderungsnotiz F-UX1 (R-5.2-05). Befunde TE-I5-01, TR-H-06, TR-H-10, CS-I5-B3-KONSOLE-01.
- Zweig `wap/f-ux1` ab `wap-codex` cd21877, Worktree `C:\Users\phili\source\repos\wap-wt\f-ux1`. Tests tragen nur bestehende IDs.

| Punkt | Stand | Umsetzung |
| --- | --- | --- |
| 6 TE-I5-01 | umgesetzt | «PDF dieser Woche» (Knopf, Menü «Mehr …», Befehlspalette) und Ctrl+P öffnen den Dialog «PDF dieser Woche» mit den Befunden der Woche (offene als Liste, quittierte eingeklappt). Offene Fehler: Alarm, «Trotzdem exportieren», Anfangsfokus «Abbrechen»; sonst «Exportieren» mit Fokus, Enter exportiert. Gemeinsame Befundliste mit «PDF …», beide über `findingsForExport` (TR-H-06). Einhängung in `i2/I2Application.tsx`: vier Aufrufe von `exportPdf` → `flows.openWeekPdf`, Übergangshinweis `pdfHint` entfernt. |
| TR-H-06 | geschlossen | E2E über die Oberfläche: früherer Stand mit offenem P1 ohne Befundliste und ohne Bestätigung; Arbeitsfassung verlangt sie; quittierter Fehler eingeklappt, Export ohne Bestätigung (beide Dialoge). |
| Stand | umgesetzt | `setNewStand` schreibt mit `undoBoundary`; `commitAtomic` kürzt die Historie bis und mit dem Stand-Schritt, Undo an der Grenze lehnt mit «Ein gesetzter Stand lässt sich nicht rückgängig machen …» ab (`standNotUndoable`, schreibt nichts). Meldung nach dem Stand ohne «Rückgängig»; Folgenliste nennt es. Version: Dialog schlägt die nächste freie Version vor und lehnt kleinere ab; `setNewStand` lehnt eine angegebene, schon vergebene Version ab (`versionInUse`). |
| 10 / TR-H-10 | erledigt | Woche löschen bleibt mit Meldung und «Rückgängig» (kein Dialog); R-5.2-05 per Änderungsnotiz angepasst, Beleg ist der bestehende I3-Test. |
| B3 b | umgesetzt | `tests/wap-e2e/support/fixtures.ts`: Text, Ort und Stack jeder verbliebenen Konsolen- und Seitenfehlermeldung in der Fehlermeldung des Tests und in `test-results/wap/konsole/<test>.json`; Test bleibt bei jeder Meldung rot, `consoleErrors` enthält weiter die Art. |

**Tests.** Vitest `tests/wap/unit/f-ux1/` (Undo-Grenze mit fake-indexeddb und Neuladen, Redo-Zweig, Version; Konsolenaufzeichnung); Playwright `tests/wap-e2e/f-ux1/` im Entwicklungsserver und in der Einzeldatei (Harness `i5`). Rot belegt gegen cd21877: Vitest 10 von 11 rot, E2E (edge) 6 von 6 rot. Angepasste eingefrorene Tests (lock-update, Grund TE-I5-01 bzw. «Stand: ja»): I2 `[R-5.5-07]…`, I2c B4 (Ctrl+P), I3 `pdfOf`, dazu I5 (fünf Exporte «PDF dieser Woche», Offline-Ablauf der Einzeldatei, Ende von `[R-5.5-08]` «Stand rückgängig machbar» → Grenze) und Liste `[R-6-15][R-4-01]`.

**Datenschutz.** privacy-scan `--commits cd21877..HEAD`: 24 Dateien ohne Befund; `--baum HEAD`: 979 Dateien ohne Befund. Nur fiktive Daten; keine neuen Grunddaten-Kopien (Einheit, Kdt, Unterschrift, Wappen, Personen) und keine neuen Speicherorte dafür. `standBoundarySeq` liegt nur im lokalen Plan-Datensatz (IndexedDB), nicht in der Plan-Datei.

**Konsolenmeldungen (B3 b), 5 Läufe `npm run wap:test:e2e` am 20.10.2026** (je 288 Tests, Rechner durch parallele Läufe voll ausgelastet): Lauf 1, 2, 3, 5 ohne Konsolenmeldung; Lauf 4 eine (Entwicklungsserver, H-TESTS `[R-5-02]` Zoom): `error: Failed to load resource: net::ERR_NO_BUFFER_SPACE` für `/@react-refresh`, danach `pageerror: $RefreshSig$ is not defined` im vorgebündelten react-dom. Ursache: Windows-Socketpuffer erschöpft; nur Werkzeug (Vorschlag an den Orchestrator), nicht Produkt. Übrige rote Tests je Lauf (5/3/2/2/1): Last (I2b A3 p95 in allen Läufen, auch auf cd21877 rot; vereinzelt 30-s-Zeitüberschreitungen), siehe FINDINGS FUX1-LAST-01.

**Offen.** TE-FUX1-01: der eingefrorene E1-05-Test `[R-5.5-03]` «Zwei Stände nach Wiederherstellen» verlangt ohne angegebene Version erneut V1; die Oberfläche gibt die Version immer an (nächste freie), `setNewStand` ohne Version bleibt deshalb bei «vorherige + 1». Abgrenzung: An Import- oder Ersetzen-Schritte gekoppelte Stände folgen weiter ihrem Schritt (ADR-006 Änderungsnotiz F-UX1).

- [x] 6 Neue Tests eingefroren per lock-update mit Grund «F-UX1» (6 Dateien); Testpfade additiv registriert (8abcf83).
- [x] 7 Umsetzung je Punkt: zuerst ein roter Test, dann die Umsetzung.

## Runde 2 (20.10.2026, code-reviewer Daten Runde 2)

Merge wap-codex 5da6891 (0613547). CR-D-2-01 (blockierend): Punkt «vor Ersetzen» mit den sichtbaren Ständen samt PDF, «Wiederherstellen» macht fehlende wieder sichtbar (ADR-006 Änderungsnotiz F-UX1 Runde 2). CR-D-2-02: ganz gestrichene Zeile ohne Nummer mit Meldung «nicht übernommen». CR-D-2-04: nicht übernommener Text der Wochenziele im Importbericht (nur Oberfläche). Tests `tests/wap/unit/f-ux1/stand-ersetzen.test.ts` (2 von 3 rot vorher) und `import-bericht.test.ts` (3 von 3 rot vorher), eingefroren mit Grund «F-UX1 Runde 2». Referenzlauf lokal 19/19 grün (Quote ≥ 0,95; Meldung zählt nicht zur Formbilanz).

- [x] 6 Neue Tests Runde 2 eingefroren per lock-update mit Grund «F-UX1 Runde 2» (2 Dateien).
