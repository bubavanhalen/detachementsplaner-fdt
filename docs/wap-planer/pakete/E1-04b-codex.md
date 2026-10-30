# Codex-Auftrag E1-04b (E1-04 Runde 2)

Du bist implementer für das Nachtrag-Paket E1-04b des WAP-Planers. Es ist Runde 2 von E1-04 (Speicherung, Undo, Wiederherstellung, Plan-Datei) nach dem Code-Review.

**Zuerst vollständig lesen.** Diese Regeln gelten zwingend:
- `AGENTS.md`;
- `docs/wap-planer/agent-regeln.md`;
- `docs/wap-planer/auftragsaenderungen/AE-002.md`;
- die Rolle in `.claude/agents/implementer.md`;
- die Checkliste `docs/wap-planer/pakete/E1-04b.md`;
- ADR-006 mit der Änderungsnotiz `standSeqs`;
- im Vertrag `docs/wap-planer/plan/vertraege/E1-04.md` die **«Änderungsnotiz Runde 2 (07.10.2026, architect)»** vollständig: R2-0 bis R2-9 mit allen Vermerken «geändert nach …» und die Orchestrator-Zeilen am Ende. Die übrigen Abschnitte des Vertrags gelten weiter.

## Arbeitsort und Freeze

- Nur `C:\Users\phili\source\repos\wap-wt\e1-04`, Zweig **`wap/e1-04b`**.
- Freeze-Commit: `4f8be66`. Deine Runde-1-Umsetzung ist a818d89; darauf baust du auf.

## Ziel

- Die 11 roten Pflichtfälle von E1-04b sind grün.
- Alles andere bleibt grün: 109 E1-04-Tests, 26 Gegenfälle, alle übrigen WAP-Tests, Suite.
- Keine Typ-, Lint- oder Konsolenfehler.
- Die schnelle Schleuse ist grün.

## Befunde dieser Runde

Genau nach dem Vertrag:

- **CR-E104-01** nach **R2-1**: `isBase64` in `schema.ts` als lineare Zeichenschleife ohne regulären Ausdruck. Dieselbe Prüfung gilt beim Lesen und beim Sichern.
- **CR-E104-02** nach **R2-2**: Merker `standSeqs` im Datensatz `plans`. Zu beachten:
  - die Invariante;
  - die Reihenfolge: neue `seq` bzw. S erst **nach** J; die neue Stand-Aufzeichnung wird nach J geschrieben;
  - die Liste (d);
  - ein fehlender Merker bleibt unbekannt bis zum nächsten Durchgang;
  - Lesen umfasst `get`, `getAll`, `getAllRecords` und Cursor.
  - `FORMAT_VERSION` bleibt 1.
- **CR-E104-05** nach **R2-3**: gemeinsame `withoutUndefined` in `schema.ts`, rekursiv, auch verschachtelt. `migrateDocument` und `planFile.ts` nutzen sie.
- **CR-E104-06** nach **R2-4**:
  - stabile Barriere;
  - kein `await` zwischen Prüfung und Start der Transaktion;
  - `pendingMigration` prüft danach;
  - `InvalidStateError` bzw. eine geschlossene Verbindung → `StorageError 'unavailable'`.
- **CR-E104-07** nach **R2-6**: Kopfkommentar von `schema.ts` wörtlich nach dem Vertrag.
- **CR-E104-03 und -04:** keine Codeänderung (R2-5).

## Erlaubte Dateien (R2-7)

- `src/io/wap-plan/schema.ts`
- `src/io/wap-plan/store.ts`
- `src/io/wap-plan/planFile.ts`, nur die Umstellung auf die gemeinsame `withoutUndefined`
- die Checkliste `docs/wap-planer/pakete/E1-04b.md`, nur Kästchen 7 und die Belegzeile

**Nicht ändern:**
- `src/model/wap/history/history.ts`, `src/io/wap-plan/standStore.ts`;
- `docs/wap-planer/pakete/E1-04.md`;
- Tests, Hilfen, Fixtures, Verträge, ADRs;
- `test-lock.json`, `scripts/wap-gate/**`.

Hältst du einen Test für falsch: Test-Einwand mit Vertragszitat in den Bericht schreiben, am Rest weiterarbeiten, diesen Test nicht umgehen.

## Eingefrorene Tests

`scripts/wap-gate/testpfade.json`, Einträge «E1-04» und «E1-04b». Die neuen Dateien:
- `tests/wap/integration/storage/nachtrag-base64.test.ts`
- `tests/wap/unit/storage/nachtrag-kuerzen.test.ts`
- `tests/wap/integration/storage/nachtrag-undefined.test.ts`
- `tests/wap/integration/storage/nachtrag-umstellung.test.ts`

`node scripts/wap/lock-check.mjs` muss «in Ordnung» melden.

## Laufzeit

Der WAP-Anteil liegt ruhig bei etwa 54,6 s; die Grenze ist 60 s (ADR-010 §4.5), die Meldeschwelle 57 s.
- Keine künstlichen Wartezeiten.
- Die 4 MiB nicht verkleinern.
- Melde die Dauer.

## Umgebung und Befehle

Node 24.15.0, Windows.

**Vor jedem Testlauf prüfen:**
- Es gibt keine Datei `C:\Users\phili\source\repos\detachementsplaner-fdt\.git\wap-gate\sperre.json`.
- Es läuft höchstens ein fremder Testlauf.
- Beim Warten nur Shell- oder PowerShell-Prüfungen verwenden, keinen node-Prozess mit «gate» im Befehl.

**Für eigene Vitest-Läufe:** `WAP_REFERENCE_DIR` auf einen fiktiven Ordner mit einer `datenschutz-sperrliste.txt` mit genau einem erfundenen Namen.

**Befehle:**
- Neue Tests: `$env:VITEST_MAX_WORKERS='4'; npx vitest run -c vitest.wap.config.ts tests/wap/integration/storage/nachtrag-base64.test.ts tests/wap/unit/storage/nachtrag-kuerzen.test.ts tests/wap/integration/storage/nachtrag-undefined.test.ts tests/wap/integration/storage/nachtrag-umstellung.test.ts`
- Paket: wie Runde 1 (`tests/wap/unit/storage tests/wap/integration/storage tests/wap/property/storage`), dazu `$env:TZ='UTC'` und `$env:TZ='America/New_York'`
- Alle WAP-Tests mit Dauer, Suite, `node scripts/wap-gate/typecheck.mjs`, `npx biome check src/io/wap-plan`
- Die schnelle Schleuse läuft als Pre-Commit-Hook. Für den Commit keinen fiktiven `WAP_REFERENCE_DIR` setzen.

## Verboten

- Commits auf `wap-planer`, merge, rebase, push.
- `git reset --hard`, `git clean`, `git stash`.
- `--no-verify` und andere Wege, Hooks zu umgehen.
- `scripts/wap/lock-update`.
- Änderungen an `.claude/`.
- Netzzugriffe ausser `npm ci`.
- Neue Abhängigkeiten.

## Daten

- Weder `reference/` noch `.qa/` lesen, ausser den Code-Review-Bericht `.qa/e1-04/code-reviewer-1.md` und deinen eigenen Bericht.
- Nur fiktive Inhalte.
- Keine Daten in Dateien, Logs oder Ausgaben.

## Commit

Genau **ein** Commit, sobald alles grün ist:
- Inhalt: die Umsetzung, Kästchen 7 in `docs/wap-planer/pakete/E1-04b.md` abgehakt und eine Belegzeile.
- Nachricht: «E1-04b: Runde 2 nach Code-Review (CR-E104-01, -02, -05, -06, -07) [R-L-12, R-L-13, R-L-14, R-L-15]», ohne Co-Authored-By-Zeile für Claude.
- Danach `git diff --name-only 4f8be66..HEAD` prüfen: nur erlaubte Dateien.

## Am Ende

Bericht nach `C:\Users\phili\source\repos\detachementsplaner-fdt\.qa\e1-04\codex-bericht-2.md`. Inhalt:
- Commit-Hash und geänderte Dateien;
- Umsetzung je Befund;
- Testläufe mit Befehl und Auszug: neue Tests, Paket in drei Zeitzonen, WAP mit Dauer, Suite, typecheck, biome, `lock-check`, Hook;
- Test-Einwände, Auslegungen, offene Punkte.

Keine echten Personennamen.
