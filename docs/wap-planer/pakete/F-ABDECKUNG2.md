# Paket F-ABDECKUNG2 – Zweigabdeckung Liste, Seitenfeld, Plan-Einstellungen, Personenliste (Schlussrunde vor Gate B)

- Etappe: 1 (Schlussrunde vor Gate B)
- Anforderungen: (keine eigenen; die Tests tragen IDs eingefrorener Pakete aus Beschrieb 4.1–4.9, 5.1, 5.3, 5.7, 6, 11, z.B. R-6-13 bis R-6-16, R-5.1-12, R-5.1-25, R-4.1-09 bis R-4.1-11, R-4.4-09, R-4.7-01, R-5.7-03)
- Worktree: `C:\Users\phili\source\repos\wap-wt\f-abdeckung2` · Zweig `wap/f-abdeckung2` ab `wap-codex` 291a396
- Grundlage: Auftrag F-ABDECKUNG2 des Koordinators (23.10.2026): V2-abdeckung im letzten vollen Gate rot für `src/components/wap/list`, `panel`, `settings` und `src/io/wap-persons` (Schwelle 75 % Zweigabdeckung, Vitest und E2E zusammengeführt, unverändert); Prompt §7 «Abdeckung»; ADR-010 §6.2; Paket F-TOOLS (Abdeckungswerkzeug, FT-A-02); gesperrte Schwellen `scripts/wap-gate/coverage-schwellen.json` unverändert. Testpfad dauerhaft additiv nach Freigabe des Auftraggebers 13.10.2026 «ja dauerhaft». `src/pages` und `tools/wap` bearbeitet ein anderes Paket.

Nur Tests, kein Produktcode. Listenansicht, Seitenfeld und Plan-Einstellungen werden mit Testing-Library in jsdom über Rollen und sichtbare Namen bedient (Klick, Tasten, Eingabe, Verlassen); jede Änderung läuft wie in der Route als Befehl auf den aktuellen Plan, geprüft wird die Wirkung auf das Modell und die sichtbare Rückmeldung (Meldungen mit Ursache und nächstem Schritt, Leerzustände, Fokus). Der Personen-Import ist mit fiktiven CSV- und XLSX-Dateien als Unit getestet (auch beschädigte Archive). Gefundene Produktfehler sind als Befunde FA2-01 bis FA2-04 in `FINDINGS.md` (Abschnitt «F-ABDECKUNG2») erfasst; je Befund hält ein Test das heutige Verhalten mit `[FA2-nn]` und dem Soll im Kommentar fest (`it.fails` ist nach F4 verboten).

## Messwerte (Zweigabdeckung V2, Vitest und E2E zusammengeführt)

E2E-Anteil: `node scripts/wap-gate/coverage-e2e.mjs` auf 291a396 (Projekt edge, `--workers=2`, 277 Tests, 2 rot unter Rechnerlast: H-TESTS R-5.6-01 und R-5.1-14/R-5.1-16, nicht Teil dieses Pakets); der Produktcode ist unverändert, der Datensatz gilt daher auch nachher.

| Modulordner | vorher (291a396, Vitest + E2E) | nachher (Vitest + E2E) | nachher nur Vitest |
| --- | --- | --- | --- |
| src/components/wap/list | 65,9 % (254 / 385) | 95,3 % (367 / 385) | 95,0 % (366 / 385) |
| src/components/wap/panel | 61,6 % (407 / 660) | 91,6 % (605 / 660) | 90,7 % (599 / 660) |
| src/components/wap/settings | 59,0 % (121 / 205) | 90,7 % (186 / 205) | 90,7 % (186 / 205) |
| src/io/wap-persons | 71,1 % (158 / 222) | 90,5 % (201 / 222) | 90,5 % (201 / 222) |

Messlauf nachher: `npm run wap:test:coverage` (Vitest, 4 Worker): 2902 Tests, 0 rot; zusammengeführt mit dem E2E-Datensatz über `node scripts/wap-gate/coverage-check.mjs --istanbul <vitest> --istanbul <e2e>`. Pfadmengen: fachlogik 92,7 % (6086 / 6561), übrig 81,4 % (7353 / 9033), beide ok. V2 bleibt rot nur wegen `src/pages` (0 %) und `tools/wap` (14,7 %), die ein anderes Paket bearbeitet. Schwellen unverändert.

- [x] 1 Paket-Worktree angelegt und installiert (`git worktree add … -b wap/f-abdeckung2 wap-codex`, `npm ci`)
- [x] 3 Tests: 123 Tests in 6 Dateien unter `tests/wap/unit/f-abdeckung2/` (plus Hilfen `ui.ts`, `panel.ts`, `zip.ts`), jeder mit Anforderungs-ID
- [x] 6 eingefroren: Testdateien per lock-update gesperrt (Grund «F-ABDECKUNG2»), Testpfad in `scripts/wap-gate/testpfade.json` additiv registriert und nachgeführt
- [x] 7 Umsetzung: entfällt (nur Tests); alle neuen Tests grün gegen den bestehenden Code, bekannte Fehler als `[FA2-nn]` festgehalten
- [ ] 9 Volle Schleuse (Orchestrator)
- [ ] 10 Prüfung: frischer `test-reviewer`

## Tests

| Datei | Umgebung | Inhalt |
| --- | --- | --- |
| `liste-ansicht.test.ts` | jsdom | Listenansicht: Zellinhalte je Typ und Zeitform, Umfang, Filter und Leerzustände, Sortieren, Zellzeiger, Bearbeiten wie Excel (Enter, Tippen, F2, Doppelklick, Tab, Verlassen, Esc), Kategorie/Status als Auswahl, Leeren, Löschen, Schreibschutz, Fehlermeldungen, Tottaste, Spaltenmenü, Export, Dateiname |
| `liste-zelle.test.ts` | node | `isEditable` und `commitCell` je Typ und Spalte: Wirkung auf das Modell mit Undo, Meldungen bei ungültigen Werten, FA2-03 |
| `seitenfeld-woche.test.ts` | jsdom | Seitenfeld Woche (Bezeichnung, Kurzname, Startdatum, Wochenziele, Bereitschaft, Sonnenzeiten, Bemerkungen, ausgeblendete Tage, Kürzel), Tag(e), Mehrfachauswahl, Fokusauftrag, Alt-Feldsprünge, Auswahlfeld und Segment per Tastatur, FA2-04 |
| `seitenfeld-eintrag.test.ts` | jsdom | Seitenfeld je Eintragstyp (Block mit Fett, Zeit, Spalten, Vorschlag, Teilaufgaben; Beso mit Nummer, Zeitfenstern, Terminzeile; Rapport, Marker, Querbalken, Bemerkungen), Vorschlagsliste, Auswahlwechsel mit offener Eingabe (UX-H-01), FA2-03 |
| `plan-einstellungen.test.ts` | jsdom | Plan-Einstellungen: Registerkarten, Plan, Wappen und Unterschrift (lokale Bilder), Kommandant, Legende (auch Löschen mit Ersatz), Funktionsliste, Personenliste aus Datei und von Hand, Spaltensätze und Spalten (auch Löschen mit Rückfrage), Kürzel, Marker, Sperre, Fehlermeldungen |
| `personen-datei.test.ts` | node | CSV und XLSX: Trennzeichen, BOM, Anführungszeichen, Leerzeilen, doppelte und fehlende Kopfspalten, Kodierung, Zellarten, Blattverweise, gespeicherte Teile, 13 beschädigte Arbeitsmappen, FA2-01, FA2-02 |

## Belege

| Schritt | Befehl / Commit | Auszug |
| --- | --- | --- |
| Basis vorher | `npm run wap:test:coverage` (Vitest, 4 Worker) und `node scripts/wap-gate/coverage-e2e.mjs`, dann `node scripts/wap-gate/coverage-check.mjs --istanbul <vitest> --istanbul <e2e>` | Werte Spalte «vorher»; nur Vitest: list 3,6 %, panel 0 %, settings 0 %, wap-persons 71,1 % |
| Paket-Tests | `npx vitest run -c vitest.wap.config.ts tests/wap/unit/f-abdeckung2 --maxWorkers=2` | 122 Tests grün (vor dem Merge), dreimal hintereinander, ohne Konsolenausgaben |
| Lint, Typen | `npx biome check tests/wap/unit/f-abdeckung2`, `npx tsc --noEmit -p tsconfig.wap.json` | ohne Befund in den neuen Dateien |
| Freeze und Tests | 3f881af (Hook: Schleuse fast grün, 14 Schritte) | Testpfad registriert, 9 Dateien gesperrt (lock-update «F-ABDECKUNG2»); R-6-26 vor dem Commit zu R-6-14 korrigiert (F9-trace) |
| Merge wap-codex b2fd29c | 9a48869 (Hook grün, 14 Schritte); Protokollzeilen F-ABDECKUNG2 zuerst | F-UX4 macht die Spalten-Zelle für Block und Rapport bearbeitbar (UX-AB-F-07): `liste-zelle.test.ts` angepasst und um die Spalten-Befehle ergänzt (Nachführung) |
| Messung nach dem Merge | `npx vitest run … tests/wap/unit/f-abdeckung2 tests/wap/unit/f-ux4 --coverage.enabled=true`, dann `coverage-check.mjs --istanbul …` | nur diese 133 Tests: list 93,8 % (412 / 439), panel 90,7 %, settings 90,7 %, wap-persons 88,7 %; alle ≥ 75 % ohne E2E-Anteil |
