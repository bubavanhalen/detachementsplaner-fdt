# Paket E1-AB – Abnahmevorbereitung und Nacharbeit 14.1

- Etappe: 1
- Anforderungen: R-1-02, R-1-06, R-14-04, R-14.1-02, R-14.2-05, R-14.15-01
- Worktree: `C:\Users\phili\source\repos\wap-wt\e1-ab` · Zweig `wap/e1-ab` ab `wap-codex` a941ef7
- Prüfberichte: `C:\Users\phili\source\repos\detachementsplaner-fdt\.qa\e1-ab\`
- Grundlage: Vertrag `plan/vertraege/E1-AB.md`; Plan `plan/etappe-1.md` Abschnitt 4.23; Beschrieb 13, 14.1; Prompt §5.3 Punkte 4 bis 6; `anhaenge/normalisierung.md` Abschnitte 2 und 10; Hilfe `tests/wap/support/anhang-compare/` (E1-08).

E1-AB enthält keinen Produktcode (Vertrag Abschnitt 5). Test nach Vertrag Abschnitt 1: `tests/wap/reference/abnahme/nacharbeit.ref.ts` `[R-14.1-02]` (Suite `test:reference`). Erste Erwartung: `$WAP_REFERENCE_DIR/nacharbeit/etappe-1/liste-kvk-wo1.csv` vorhanden; danach Kopfzeile nach normalisierung.md Abschnitt 2, Vergleich mit `anhaenge/anhang-a-kp.csv` nur auf den Zeilen der Wochen KVK und Wo1 (`compareWithAnhang`), prüft zuvor die Signatur des Exports (keine Zeile vom Typ «Bericht», Bemerkung nur `offenes Ende`, `über Mitternacht`, `Zusatz: …`; TR-AB-02) und verlangt 0 Abweichungen, Quote 1, alle 13 Pflichtfelder gleich und keine überzählige Ist-Einheit (normalisierung.md Abschnitt 10 «100 % Übereinstimmung»). Meldungen nur als Schlüssel `Woche|Tag|Typ|Nr` und Feldnamen. Die Nacharbeitsdatei steht nicht in `tests/wap/reference/required-files.json` (Vertrag Abschnitt 1). Die übrigen IDs (R-1-02, R-1-06, R-14-04, R-14.2-05, R-14.15-01) werden ohne Test im Abnahmebericht belegt (Vertrag Abschnitt 3).

Ein Kästchen gilt erst mit Beleg als erledigt (Befehl, Ausgabeauszug, Commit-Hash, Befund-IDs). Der nächste Schritt ist immer das erste offene Kästchen (Prompt §5.2).

- [x] 1 Paket-Worktree angelegt und installiert (`git worktree add … -b wap/e1-ab wap-codex`, Basis a941ef7; `npm ci` grün)
- [x] 2 Schnittstellenvertrag `plan/vertraege/E1-AB.md` (Entwurf Runde 2, 01.10.2026); keine Stubs (kein Produktcode)
- [x] 3 Tests (`test-engineer`): `tests/wap/reference/abnahme/nacharbeit.ref.ts`, ein Test `[R-14.1-02]`
- [x] 4 Test-Review (frischer `test-reviewer`): Bericht `.qa/e1-ab/test-review.md` (Haupt-Checkout), Freigabe nach den Korrekturen TR-AB-01 (hoch, Kopfzeilenprüfung meldet nur noch einen Wahrheitswert) und TR-AB-02 (mittel, Signatur des Exports: keine Zeile «Bericht», Bemerkung nur aus Teilen des Exports); TR-AB-03 (niedrig, nur falsches Rot bei «Spalten») vom Koordinator angenommen (20.10.2026); TR-AB-04 Hinweis für den Abnahmebericht
- [x] 5 Rot-Nachweis: der neue Test scheitert an der ersten Erwartung mit `AssertionError` (Datei fehlt), die übrigen Referenztests grün (Belege unten)
- [x] 6 Test-Freeze: `nacharbeit.ref.ts` per lock-update mit Grund «E1-AB» eingefroren; Testpfad `tests/wap/reference/abnahme/**` additiv in `scripts/wap-gate/testpfade.json` (Freigabe Auftraggeber 13.10.2026 «ja dauerhaft», Nachführung per lock-update); Freeze 9f19fed; Nachführung nach Test-Review per lock-update --refresh mit Grund «E1-AB: TR-AB-01/02 (Test-Review, Koordinator 20.10.2026)»; Meldungen nennen alle Schlüssel vollständig (Nachführung per lock-update, Grund «E1-AB: Schlüssel vollständig melden»)
- [ ] 7 Umsetzung (Nacharbeit durch `ux-critic` über die Oberfläche ohne Kenntnis von Anhang A, Aktionen gezählt; Export «Export …», Umfang «Ganzer Plan», nach `reference/nacharbeit/etappe-1/liste-kvk-wo1.csv`) bis der Test grün ist; `git diff --name-only <freeze>..HEAD` gegen gesperrte Pfade geprüft
- [ ] 8 Golden-Bilder – entfällt (kein Layout/PDF)
- [ ] 9 Volle Schleuse im Paket-Worktree (Orchestrator)
- [ ] 10 Prüfung: `code-reviewer` (+ `ux-critic` Nacharbeit)
- [ ] 11 Nachprüfung durch frische Instanz, alle Befunde verifiziert oder entschieden
- [ ] 12 Eskalation (nur falls nötig)
- [ ] 13 Integration: Merge nach `wap-codex`, Schleuse, `PROGRESS.md`, Worktree entfernt

## Belege

| Schritt | Befehl / Commit | Auszug |
| --- | --- | --- |
| 5 Rot | `WAP_REFERENCE_DIR=<Haupt-Checkout>/reference VITEST_MAX_WORKERS=4 npm run test:reference` (Ausgabe lokal `.qa/e1-ab/rot.txt`) | `nacharbeit.ref.ts` 1 failed: `AssertionError: Export der Listenansicht nach der Nacharbeit vorhanden (nacharbeit/etappe-1/liste-kvk-wo1.csv): expected false to be true`; `import/kp.ref.ts` 18 passed, `f-import2/importdauer.ref.ts` 1 passed; Tests 1 failed, 19 passed (20) |
| Formatprobe | Lokales Hilfsskript `.qa/e1-ab/probe/` (nicht im Repo): fiktiver synthetischer Plan (`tests/wap/support/synthetic-plan.ts`) → `listCsv(plan, 'plan')` → `TextEncoder` wie «Export …» der Listenansicht; fiktive Soll-Dateien; je Fall `npx vitest run -c vitest.wap-reference.config.ts tests/wap/reference/abnahme/nacharbeit.ref.ts` | Export 1125 Zeilen (KVK 283, Wo1 286), ohne BOM, LF, Kopfzeile gemäss Abschnitt 2. Gleich (andere Reihenfolge, Quoting, Bemerkung, zusätzliche Zeile «Bericht») grün; Titel KVK geändert rot (`KVK\|So\|Block\|`); Titel Wo2 geändert grün; nur Ltg Wo1 geändert rot (`Wo1\|So\|Block\|:Ltg`); überzählige Ist-Einheit rot (1); Export fehlt rot an der ersten Erwartung |
| 4 Nachprüfung TR-AB-01/02 | Fälle aus `.qa/e1-ab/tr/` und `.qa/e1-ab/probe/`, je `npx vitest run -c vitest.wap-reference.config.ts --maxWorkers=1 tests/wap/reference/abnahme/nacharbeit.ref.ts` (Auszug `.qa/e1-ab/nachpruefung.txt`) | e Kopie von Anhang A rot («Bericht»-Zeilen 1); e2 dieselbe Kopie ohne Zeile «Bericht» rot (fremde Bemerkungen, nur Anzahl); f ohne Kopfzeile rot mit `expected false to be true`, keine Datenzeile in der Ausgabe; 0, d, Probe 1 und 3 grün; g, k, Probe 2, 4, 5, 6 rot wie zuvor |
| 5 Rot nach Nachführung | `WAP_REFERENCE_DIR=<Haupt-Checkout>/reference … nacharbeit.ref.ts` (`.qa/e1-ab/rot-2.txt`) | 1 failed: `AssertionError: Export der Listenansicht nach der Nacharbeit vorhanden (…): expected false to be true` |
