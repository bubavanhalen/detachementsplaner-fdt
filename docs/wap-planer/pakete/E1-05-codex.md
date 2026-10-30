# Codex-Auftrag E1-05, Runde 2

Du bist implementer für das Paket E1-05 (Stand atomar und Dateiname) des WAP-Planers, **Runde 2**. Lies zuerst vollständig: `AGENTS.md`, `docs/wap-planer/agent-regeln.md`, `docs/wap-planer/auftragsaenderungen/AE-002.md`, die Rolle in `.claude/agents/implementer.md`, die Paket-Checkliste `docs/wap-planer/pakete/E1-05.md` und im Vertrag `docs/wap-planer/plan/vertraege/E1-05.md` die **«Änderungsnotiz Runde 2 (06.10.2026, architect)»**, dort die Abschnitte **N2** und **N3**. N1 ist eingefroren und grün; N4 folgt später durch Claude und ist nicht Teil dieses Auftrags. Runde 1 (Commit 6e1be2c) ist geprüft und gemergt; der Auftrag Runde 1 steht in der Git-Geschichte dieser Datei. Diese Regeln gelten zwingend.

**Arbeitsort:** nur `C:\Users\phili\source\repos\wap-wt\e1-05`, Zweig `wap/e1-05`. Stand vor dem Auftrag: Commit dieser Datei auf `524adcb` (Nachtrag-Freeze N1).

**Ziel:** die zwei Befunde dieser Runde genau nach Vertrag beheben; alle eingefrorenen Tests bleiben grün, ohne Typ-, Lint- oder Konsolenfehler; schnelle Schleuse grün.

**Befunde dieser Runde:**
- **CR-E105-01** nach Vertrag **N2** (`src/io/wap-plan/standStore.ts`): nicht exportierte Konstante `PDF_ENDUNG = '.pdf'` und nicht exportierte Hilfe `titelOhneEndung(name: string): string` (Länge aus der Konstante, kein Literal 4; ohne Endung `RangeError('PDF-Name ohne Endung .pdf')`); sie ersetzt alle drei Stellen `pdfFileName(…).slice(0, -4)`. Beleg: `grep -c "slice(0, -4)" src/io/wap-plan/standStore.ts` = 0.
- **CR-E105-02** nach Vertrag **N3** (`src/model/wap/stand/stand.ts`, `applyStand`, D1 Fall 3): nicht exportierte Hilfe, die in **jedem** Feld (`cause` und `nextStep`) jedes Vorkommen von `{n1}` durch {n} + 1 und danach jedes Vorkommen von `{n}` durch {n} ersetzt. Die Ausgabe mit den heutigen Texten bleibt gleich.
- Verhalten sonst unverändert; keine neue öffentliche Signatur, kein neuer Test.

**Dateien:** nur `src/io/wap-plan/standStore.ts` und `src/model/wap/stand/stand.ts`, dazu die Belegzeile in `docs/wap-planer/pakete/E1-05.md`. Keine anderen Dateien, keine neuen Abhängigkeiten.

**Eingefrorene Tests** (122): `tests/wap/unit/stand/**`, `tests/wap/integration/stand/**` (inkl. `nachtrag-wappen.test.ts`), `tests/wap/pdf/stand/**`, Hilfen `tests/wap/support/stand/**`. Gesperrte Dateien (`docs/wap-planer/test-lock.json`) nie ändern, auch nicht per Befehl; `node scripts/wap/lock-check.mjs` muss «in Ordnung» melden. Hältst du einen Test für falsch: Test-Einwand mit Vertrags- bzw. Beschrieb-Zitat in den Bericht, am Rest weiterarbeiten, diesen Test nicht umgehen.

**Umgebung und Befehle** (Node 24.15.0; Windows):
- Vor jedem Testlauf prüfen: Es gibt keine Datei `C:\Users\phili\source\repos\detachementsplaner-fdt\.git\wap-gate\sperre.json` (sonst läuft gerade ein Beleglauf – warten), und es läuft höchstens ein fremder Testlauf.
- Für eigene Vitest-Läufe `WAP_REFERENCE_DIR` auf einen fiktiven Ordner setzen, der eine Datei `datenschutz-sperrliste.txt` mit genau einem erfundenen Namen enthält (ohne Sperrliste scheitert ein fremder Test an maskierten Pfaden).
- Paket-Tests: `$env:VITEST_MAX_WORKERS='4'; npx vitest run -c vitest.wap.config.ts tests/wap/unit/stand tests/wap/integration/stand tests/wap/pdf/stand`
- Alle WAP-Tests: `$env:VITEST_MAX_WORKERS='4'; npx vitest run -c vitest.wap.config.ts`
- Suite: `$env:VITEST_MAX_WORKERS='4'; npx vitest run`
- Typen/Lint: `npx tsc --noEmit`, `npx biome check src/model/wap/stand src/io/wap-plan`
- Die schnelle Schleuse läuft automatisch als Pre-Commit-Hook (`node scripts/wap-gate/gate.mjs fast`); für den Commit keinen fiktiven `WAP_REFERENCE_DIR` setzen.

**Verboten:** Commits auf `wap-planer`, merge, rebase, push, `git reset --hard`, `git clean`, `--no-verify`, Hooks umgehen, `scripts/wap/lock-update`, Änderungen an `.claude/`, Netzzugriffe ausser `npm ci`, neue Abhängigkeiten.

**Daten:** Das Paket braucht weder `reference/` noch `.qa/` (ausser für deinen Bericht); lies sie nicht. Keine Daten daraus in Dateien, Testnamen, Logs oder Ausgaben.

**Commit:** genau **ein** Commit, sobald alles grün ist (Kästchen 7 bleibt abgehakt; F8 verlangt alle Paket-Tests grün):
- Umsetzung N2 und N3;
- in `docs/wap-planer/pakete/E1-05.md` unter «Belege» eine Zeile «| Runde 2 Codex | N2 CR-E105-01, N3 CR-E105-02 | Paket 122/122, WAP …/…, Suite … |»;
- Nachricht «E1-05: Runde 2 (CR-E105-01, CR-E105-02) [R-6-10, R-5.5-03]», ohne Co-Authored-By-Zeile für Claude.
- Geht der Hook rot, Ursache beheben und neu committen (nie `--no-verify`).

**Am Ende:** Bericht nach `C:\Users\phili\source\repos\detachementsplaner-fdt\.qa\e1-05\codex-bericht-2.md` mit: umgesetzten Befunden, Commit-Hash, Testläufen (Befehl und Auszug: Paket, alle WAP, Suite, tsc, biome, `grep`-Beleg, Hook-Ausgabe), Test-Einwänden, bestrittenen Befunden, offenen Punkten.

Keine echten Personennamen.
