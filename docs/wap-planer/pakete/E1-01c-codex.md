# Codex-Auftrag E1-01c, Runde 2

Du bist implementer für das Paket E1-01c (Werkzeug: Kernzustände, Leistung, Offline-Hilfe, Barrierefreiheits-Fixtures, Rot-Phase bei Playwright-Meldungen) des WAP-Planers, **Runde 2**. Runde 1 ist committet (`de4943f`, Commit durch den Orchestrator); den Auftrag Runde 1 findest du in der Git-Geschichte dieser Datei.

**Zuerst vollständig lesen.** Diese Regeln gelten zwingend:
- `AGENTS.md`;
- `docs/wap-planer/agent-regeln.md`;
- `docs/wap-planer/auftragsaenderungen/AE-002.md`;
- die Rolle in `.claude/agents/implementer.md`;
- die Paket-Checkliste `docs/wap-planer/pakete/E1-01c.md`;
- ADR-010;
- im Vertrag `docs/wap-planer/plan/vertraege/E1-01c.md` §2.1, §2.4, §4.1 und die Orchestrator-Zeile «Code-Review Runde 1, CR-E101c-01..05» am Ende;
- den Code-Review-Bericht `C:\Users\phili\source\repos\detachementsplaner-fdt\.qa\e1-01c\code-reviewer-1.md`.

## Arbeitsort und Freeze

- Arbeitsort: nur `C:\Users\phili\source\repos\wap-wt\e1-01c`, Zweig `wap/e1-01c`.
- Freeze dieser Runde: der Commit, der diese Datei enthält. Darin sind die neuen Gate-Tests `tests/wap-gate/nachtrag-c-r2.gate.ts`, die Hilfe `tests/wap-gate/support/vertrag-c-r2.ts` und der neu eingefrorene `tests/wap-gate/e2e-c.gate.ts`.

## Sonderablauf nach Vertrag §4.1 Nr 6

**Entsperrte Dateien:** Der Orchestrator hat vor deinem Start genau diese Dateien entsperrt:
- `scripts/wap-gate/gate.mjs`
- `scripts/wap-gate/e2e.mjs`
- `scripts/wap-gate/stability.mjs`
- `scripts/wap-gate/perf-compare.mjs`
- `scripts/wap-gate/perf-harness.mjs`
- `tests/wap-e2e/support/fixtures.ts`
- `tests/wap-perf/support/budgets.mjs`

Die Entsperrung steht in `docs/wap-planer/test-lock.json` und `FINDINGS.md`, absichtlich nicht committet. Diese beiden Dateien nicht anfassen.

Dazu kommen ohne Sperre `tests/wap-perf/support/perf.ts` und `tests/wap-perf/harness/harness.ts`, nur für Kommentare.

**Du committest nicht.** Wenn alles fertig ist, meldest du im Bericht «fertig ohne Commit».

## Ziel

- Die 11 roten Tests in `tests/wap-gate/nachtrag-c-r2.gate.ts` sind grün.
- Alle übrigen eingefrorenen Tests bleiben grün: Gate-Teil, Selbsttest-Teil, Harness, WAP, Suite.
- Keine Typ- oder Lint-Fehler.

## Befunde dieser Runde

Genau nach der Orchestrator-Zeile im Vertrag:

- **CR-E101c-02** (`fixtures.ts`, Pfadprüfung der Offline-Hilfe und der Downloads):
  - UNC-Pfade werden vor **jedem** Dateizugriff mit der Vertragsmeldung abgelehnt. Gemeint ist jeder Pfad, der mit zwei Trennzeichen beginnt, egal ob `\` oder `/` und in jeder Mischung. Ebenso `\\?\…` und `\\.\…`.
  - Die Suche nach dem nächsten vorhandenen Elternordner bricht an der Wurzel (`dirname(e) === e`) mit der Vertragsmeldung ab.
  - Es gibt keine Namensauflösung und keinen Netzzugriff.
- **CR-E101c-03** (`gate.mjs`, V6): Gibt es fehlende Baselines und gleichzeitig Pixelabweichungen, nennt die Meldung beide Ursachen. «Baseline fehlt» allein steht nur, wenn alle roten Tests fehlende Baselines sind.
- **CR-E101c-04** (`e2e.mjs`, Baseline-Befehl):
  - Erfolg heisst Exit 0. Er gilt nur ohne Läuferfehler.
  - Ein roter Läuferschritt mit Bericht, z.B. ein belegter Port, ergibt Exit ≠ 0. Die Ausgabe nennt die Ursache von `runE2e`, wie heute ohne `--baselines`.
  - `--geaendert` schreibt die Protokollzeile nur bei Erfolg.
  - Scheitert der Kernzustand nur mit «A snapshot doesn't exist …, writing actual.», ist das Erfolg (Exit 0).
- **CR-E101c-05** (Lesbarkeit):
  - Kopfkommentare nachführen, ohne «Stub» oder «kommt mit E1-01c»: `e2e.mjs`, `gate.mjs`, `stability.mjs`, `perf-compare.mjs`, `perf-harness.mjs`, `perf.ts`, `harness.ts`, `fixtures.ts` (Kopf erlaubt).
  - `naechsterSchritt` für V6/V7 nennt den richtigen Bericht.
  - `--grep '(?!)'` ist erklärt.
  - `budgets.mjs` ist formatiert, ohne Zeilen über etwa 100 Zeichen, und soll in der Biome-Prüfung liegen. Die Biome-Konfiguration selbst nicht ändern; liegt die Datei ausserhalb, melde das.
- **Verhalten sonst unverändert:**
  - keine Schwelle, kein Budget und keine Toleranz lockern;
  - keine Sonderzweige für Testnamen;
  - `budgets.json` nur lesen.

## Nicht ändern

- Jede andere Datei, insbesondere alle übrigen gesperrten Dateien (`docs/wap-planer/test-lock.json` zeigt sie).
- `scripts/wap/**`, `red-phase.mjs`, `trace.mjs`, `playwright.wap.config.ts`.
- Alle Tests.

Hältst du einen Test für falsch: Test-Einwand mit Vertragszitat in den Bericht schreiben, am Rest weiterarbeiten, diesen Test nicht umgehen.

## Umgebung und Befehle

Node 24.15.0, Windows.

**Vor jedem Testlauf prüfen:**
- Es gibt keine Datei `C:\Users\phili\source\repos\detachementsplaner-fdt\.git\wap-gate\sperre.json`.
- Es läuft höchstens ein fremder Testlauf.
- Beim Warten nur Shell- oder PowerShell-Prüfungen verwenden, keinen node-Prozess mit «gate» im Befehl.

**Für Vitest-Läufe:** `WAP_REFERENCE_DIR` auf einen fiktiven Ordner setzen, der eine `datenschutz-sperrliste.txt` mit genau einem erfundenen Namen enthält.

**Befehle:**
- Neue Tests: `$env:VITEST_MAX_WORKERS='4'; npx vitest run -c vitest.wap-gate.config.ts tests/wap-gate/nachtrag-c-r2.gate.ts`
- Gate-Teil: `$env:VITEST_MAX_WORKERS='4'; npx vitest run -c vitest.wap-gate.config.ts`
- Selbsttest-Teil, startet sichtbare Browser; währenddessen keine anderen Läufe: `$env:VITEST_MAX_WORKERS='1'; npx vitest run -c vitest.wap-selbsttest.config.ts tests/wap-gate/e2e-support-c.selbsttest.ts tests/wap-gate/stability-e2e-c.selbsttest.ts tests/wap-gate/gate-full-c.selbsttest.ts tests/wap-gate/red-phase-playwright.selbsttest.ts`
- Harness, WAP und Suite: wie in Runde 1.
- Typen und Lint: `node scripts/wap-gate/typecheck.mjs`, `npx biome check .`

`node scripts/wap-gate/gate.mjs fast` ist in diesem Zustand wegen F7 (entsperrte Dateien) rot. Das ist erwartet und kein Ziel für dich.

## Verboten

- Jeder Commit, merge, rebase, push.
- `git reset`, `git clean`, `git stash`.
- `--no-verify`.
- `scripts/wap/lock-update`.
- Änderungen an `.claude/`, an `test-lock.json` oder am Protokoll in `FINDINGS.md`.
- Netzzugriffe ausser zu `localhost`/`127.0.0.1` und `npm ci`.
- Neue Abhängigkeiten.

## Daten

- Weder `reference/` noch `.qa/` lesen, ausser den Code-Review-Bericht und deinen eigenen Bericht.
- Nur fiktive Inhalte.

## Am Ende

Bericht nach `C:\Users\phili\source\repos\detachementsplaner-fdt\.qa\e1-01c\codex-bericht-2.md`. Inhalt:
- «fertig ohne Commit»;
- Liste der geänderten Dateien (`git status --short`);
- umgesetzte Befunde;
- Testläufe mit Befehl und Auszug: neue Tests, Gate-Teil, Selbsttest-Teil, Harness, WAP, Suite, typecheck, biome;
- Test-Einwände;
- bestrittene Befunde;
- offene Punkte.

Keine echten Personennamen.
