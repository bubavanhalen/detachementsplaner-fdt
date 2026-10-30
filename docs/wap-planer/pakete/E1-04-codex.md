# Codex-Auftrag E1-04, Runde 1

Du bist implementer für das Paket E1-04 (Speicherung, Undo, Wiederherstellung, Plan-Datei) des WAP-Planers.

**Zuerst vollständig lesen.** Diese Regeln gelten zwingend:
- `AGENTS.md`
- `docs/wap-planer/agent-regeln.md`
- `docs/wap-planer/auftragsaenderungen/AE-002.md`
- die Rolle in `.claude/agents/implementer.md`
- die Paket-Checkliste `docs/wap-planer/pakete/E1-04.md`
- ADR-006 und ADR-007
- den Vertrag `docs/wap-planer/plan/vertraege/E1-04.md`

Im Vertrag ist die Notiz **«Ausarbeitung Schritt 2 (07.10.2026)»** mit den Abschnitten A–S massgebend. Ebenso gelten alle Änderungsnotizen danach: Vertragsprüfung Runde 1 und 2, «Nachtrag Test-Engineer F1 und F3» sowie die Orchestrator-Zeilen zu TR-E104-14 am Ende.

## Arbeitsort

- Nur `C:\Users\phili\source\repos\wap-wt\e1-04`, Zweig `wap/e1-04`.
- Freeze-Commit: `4f37e3a`.

## Ziel

- Alle 109 eingefrorenen Tests des Pakets sind grün.
- Alle übrigen Tests sind grün.
- Es gibt keine Typ-, Lint- oder Konsolenfehler.
- Die schnelle Schleuse ist grün.

## Umfang

- **Anforderungs-IDs:** R-5.6-04, R-5.6-08, R-5.6-14, R-5.6-15, R-5.6-17, R-H-33, R-L-08.
- **Umzusetzen:** alle Stubs aus Vertrag Abschnitt N «Stub-Namen» in diesen Dateien:
  - `src/model/wap/history/history.ts`, rein, ohne IndexedDB;
  - `src/io/wap-plan/planFile.ts`;
  - `src/io/wap-plan/store.ts`.
- Jeder Stub-Fehler muss verschwinden; `grep -rn "nicht implementiert" src/model/wap/history src/io/wap-plan` muss leer sein.
- **Erlaubte Dateien** (Besitz nach Vertrag Abschnitt A und O): nur `src/model/wap/history/**` und `src/io/wap-plan/**`, ohne `standStore.ts`. Dazu kommt die Belegzeile in `docs/wap-planer/pakete/E1-04.md`.
- **Nicht ändern:**
  - `src/io/wap-plan/standStore.ts` (E1-05);
  - Typen und Modellfunktionen ausserhalb dieser Ordner;
  - alle Tests, Hilfen und Fixtures;
  - jede gesperrte Datei (siehe `docs/wap-planer/test-lock.json`).
  Eine Änderung an einer gesperrten Datei ist ein Verstoss und wird verworfen.

## Inhaltliche Leitplanken

Nur Zusammenfassung; massgebend ist der Vertrag.
- Kanonische Schlüsselreihenfolge und Strenge beim Lesen nach D und E: unbekannte Schlüssel → `corrupt` mit Pfad nach E5.
- Formatversion und Migration nach F, mit Prüfnaht `PlanStoreOptions.format`; Abweisung `blocked` nach dem Nachtrag F3.
- Fehler und Meldungen wörtlich nach G (Texte in den Stubs).
- IndexedDB-Struktur nach H.
- Atomare Schreibvorgänge: Revision + 1, `nextId`/`seq` nach J.
- Verwerfen, Kürzen und Sichtbarkeit nach J.
- Plan-Datei, Löschpunkt und Sicherung vor dem Update enthalten nur sichtbare Stände, nach Version absteigend.
- Wiederherstellungspunkte, Tagespunkt und gelöschte Pläne nach K: 30 Punkte je Plan, Frist 30 Tage, `'planDelete'` wird beim Wiederherstellen verbraucht.
- `QuotaExceededError` → `quotaExceeded`, ohne Teilschreibung.
- Keine Ein-Schreiber-Sperre, kein `planLocked` (E1-11).
- `commitAtomic` mit Stand und Importbericht in einer Transaktion.
- Undo/Redo bleiben persistent.
- **Keine Netzzugriffe, keine Konsolenausgaben, keine Telemetrie** (AGENTS.md). Fehlermeldungen bleiben generisch, ohne Inhalte aus dem Plan.

## Eingefrorene Tests

- Fundort: `scripts/wap-gate/testpfade.json`, Eintrag «E1-04».
  - Tests: `tests/wap/unit/storage/**`, `tests/wap/integration/storage/**`, `tests/wap/property/storage/**`.
  - Hilfen: `tests/wap/support/storage/**`.
  - Fixture: `tests/wap/fixtures/migration/**`.
- `node scripts/wap/lock-check.mjs` muss «in Ordnung» melden.
- **Hältst du einen Test für falsch:**
  - Test-Einwand mit Vertragszitat in den Bericht schreiben;
  - am Rest weiterarbeiten;
  - diesen Test nicht umgehen.

## Laufzeit

Der WAP-Anteil der Suite darf höchstens 60 s dauern (ADR-010 §4.5); heute sind es etwa 46–51 s. Die Umsetzung soll in den Paket-Tests ohne künstliche Wartezeiten auskommen; nimm Uhren nur über das übergebene `clock`.

## Umgebung und Befehle

Node 24.15.0, Windows.

- **Vor jedem Testlauf prüfen:**
  - Es gibt keine Datei `C:\Users\phili\source\repos\detachementsplaner-fdt\.git\wap-gate\sperre.json`. Gibt es sie, läuft gerade ein Beleglauf: warten.
  - Es läuft höchstens ein fremder Testlauf.
- **Fiktiver Referenzordner:** Für eigene Vitest-Läufe `WAP_REFERENCE_DIR` auf einen fiktiven Ordner setzen. Er enthält eine Datei `datenschutz-sperrliste.txt` mit genau einem erfundenen Namen.
- **Befehle:**
  - Paket-Tests: `$env:VITEST_MAX_WORKERS='4'; npx vitest run -c vitest.wap.config.ts tests/wap/unit/storage tests/wap/integration/storage tests/wap/property/storage`
  - Mit Zeitzonen, zusätzlich je einmal: `$env:TZ='UTC'` und `$env:TZ='America/New_York'`
  - Alle WAP-Tests: `$env:VITEST_MAX_WORKERS='4'; npx vitest run -c vitest.wap.config.ts`
  - Suite: `$env:VITEST_MAX_WORKERS='4'; npx vitest run`
  - Typen/Lint: `node scripts/wap-gate/typecheck.mjs`, `npx biome check src/model/wap/history src/io/wap-plan`
- **Schnelle Schleuse:** läuft automatisch als Pre-Commit-Hook (`node scripts/wap-gate/gate.mjs fast`). Für den Commit keinen fiktiven `WAP_REFERENCE_DIR` setzen.

## Verboten

- Commits auf `wap-planer`, merge, rebase, push.
- `git reset --hard`, `git clean`, `git stash`.
- `--no-verify` oder andere Wege, Hooks zu umgehen.
- `scripts/wap/lock-update`.
- Änderungen an `.claude/`.
- Netzzugriffe ausser `npm ci`.
- Neue Abhängigkeiten.

## Daten

- Das Paket braucht weder `reference/` noch `.qa/`, ausser für deinen Bericht; lies sie nicht.
- Nur fiktive Inhalte.
- Keine Daten in Dateien, Testnamen, Logs oder Ausgaben.

## Commit

Genau **ein** Commit, sobald alles grün ist. F8 verlangt, dass alle Paket-Tests grün sind.
- Inhalt: die Umsetzung, Kästchen 7 in `docs/wap-planer/pakete/E1-04.md` abgehakt und unter «Belege» die Zeile «| 7 Codex | Umsetzung history.ts, planFile.ts, store.ts | Paket 109/109 (lokal, UTC, New York), WAP …/…, Suite …, Dauer WAP-Suite … s |».
- Nachricht: «E1-04: Speicherung, Undo, Wiederherstellung, Plan-Datei [R-5.6-04, R-5.6-08, R-5.6-14, R-5.6-15, R-5.6-17, R-H-33, R-L-08]», ohne Co-Authored-By-Zeile für Claude.
- Geht der Hook rot: Ursache beheben und neu committen. Nie `--no-verify`.
- Prüfe danach `git diff --name-only 4f37e3a..HEAD`: nur erlaubte Dateien.

## Am Ende

Bericht nach `C:\Users\phili\source\repos\detachementsplaner-fdt\.qa\e1-04\codex-bericht-1.md` mit:
- Commit-Hash;
- Liste der geänderten Dateien;
- umgesetzten IDs und Stubs;
- Testläufen, je mit Befehl und Auszug: Paket in drei Zeitzonen, alle WAP-Tests mit Dauer, Suite, typecheck, biome, `lock-check`, Hook-Ausgabe, `git diff --name-only`;
- Test-Einwänden;
- eigenen Auslegungen;
- offenen Punkten.

Keine echten Personennamen.
