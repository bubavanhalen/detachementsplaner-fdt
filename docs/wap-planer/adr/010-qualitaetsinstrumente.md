# ADR-010: Qualitätsinstrumente (Schleusen, Prüfungen, Messungen)

- **Status:** Entwurf Runde 7 (01.10.2026, nach AR0-44, AR0-46, PL0-38; Nachführung nach Eskalation 1 in H0, Option B: V11, §3.1, §3.2, §10, §12.1, §13; Runde 7: Drosselungsfaktor aus der Umgebungsprobe, §8, §12.1 G-11, §13 O-1, nach AR0-70, AR0-71). **Entschieden an Gate 0 (02.10.2026):** alle Empfehlungen (§12.2); Nachführung Runde 8 (02.10.2026): E4 b, E10 a, E11 a mit Vorab-Schritt E1-01a und Spike (§12.3), Entscheid 11 b in V11 (`privacy-names.mjs`, O-6). Nachführung 02.10.2026 (Entscheide Orchestrator): H0-Ergänzung A Variante A-1 (§3.1, O-5); Sperrzeitpunkt `vitest.wap-gate.config.ts` (§2, §13 Folgen). Einrichtung und Selbsttest in Paket E1-01 «Werkzeugkette und Schleusen» (Prompt §5.3 Punkt 2, `plan/etappe-1.md`).
- **Grundlage:** Prompt §7 (vollständig), §5.2 (Schritte 5, 6, 8, 9), §5.3 Punkt 2, §5.6, §6; Leitplanken 2–4 (Prompt §3); ADR-001 bis ADR-008; `pakete/H0.md` (Harness-Skripte, P1–P12); FINDINGS F-001 (Node 24).
- **Gate-0-Entscheide des Auftraggebers:** ja, siehe Abschnitt 12 (neue Abhängigkeiten, Suite-Dateien, Auslegungen).
- **Harness:** ADR-009 (Hook, Lock, Datenschutz-Scan, Commit-Hook) ist die Grundlage der Schritte F2, F3 und des Pre-commit.

## 1 Kontext

- Prompt §7 verlangt eine schnelle Schleuse vor jedem Commit und eine volle Schleuse vor und nach jedem Merge, «je ein Befehl», lokal. Die Suite hat heute: Vitest 5.0.1 (jsdom), Biome 2.5.14 (`noConsole: error`), `tsc` strict, `tests/privacy.test.ts`, eine GitHub-Action (`npm run check`, `test:oracle`, `build`, `check:release`) nur für `main` und Pull-Requests (`repo-analyse.md`). Nicht vorhanden: Playwright, Abdeckung, Mutationstests.
- H0 liefert: `scripts/wap/guard-edit.mjs` (Hook), `lock-check.mjs`, `lock-update.mjs`, `privacy-scan.mjs`, `pre-commit.mjs`, `install-hooks.mjs`; Tests `tests/wap-harness/*.harness.ts` mit eigener Konfiguration (H0 P11). Der Hook sperrt **alles unter `scripts/wap/`**, sobald ein Worktree eine `test-lock.json` hat (H0 P2).
- Spikes (ADR-003 bis ADR-008) belegen: `playwright-core` 1.63 steuert den installierten Edge 155.0.4283.24 (Kanal `msedge`) ohne Browser-Download; `pdfjs-dist` 6.3.289 liest das erzeugte PDF unabhängig (Text, Lage, Grösse, Schriften, Bilder); PDF bytegleich über Prozesse, Zeitzonen und Node/Edge.
- Lokale Umgebung (30.09.2026): globale Node-Version 22.19.0, Projekt verlangt `>=24.15.0 <25` (F-001); Python 2.7.18 (die Suite-CI nutzt Python 3.13 für `test:oracle`).
- `.gitignore` der Suite schliesst `*.xlsx`, `*.csv`, `FDT_*.json`, `*_FDT_*.json` aus. Pseudonymisierte Excel- und CSV-Fixtures würden damit still nicht versioniert.

## 2 Geprüfte Optionen (Überblick)

| Thema | Optionen | Entscheid (Empfehlung) | Grund |
| --- | --- | --- | --- |
| Ablage der Schleusen-Skripte | a) `scripts/wap/` · b) `scripts/wap-gate/` | **b** | Unter a) könnte der `implementer` von E1-01 nicht schreiben (Hook H0 P2 sperrt `scripts/wap/**` pauschal). b) wird nach dem Merge Datei für Datei per `lock-update --add` gesperrt (ebenso `vitest.wap-gate.config.ts`: Sperre erst beim Merge von E1-01, nicht beim Test-Freeze, Entscheid Orchestrator 02.10.2026); die Schleuse prüft zusätzlich, dass jede Datei unter `scripts/wap-gate/` gesperrt ist (Abschnitt 3.1 Schritt F7). |
| E2E-Werkzeug | a) `@playwright/test` · b) nur `playwright-core` mit eigenem Läufer | **a** | Läufer, Projekte, `forbidOnly`, `retries: 0`, JSON-Bericht, `toHaveScreenshot` sind eingebaut; die Installation lädt keinen Browser (kein `postinstall`, geprüft: `@playwright/test@1.63.0` ohne Skripte); ein Download nur bei Entscheid E4 b |
| Abdeckung | a) nur Vitest-V8 · b) Vitest-V8 plus E2E-V8 (CDP) zusammengeführt | **b** | Oberflächen-Anforderungen sind überwiegend E2E (78 von 424 IDs der Etappe 1, Stand Runde 5); ohne E2E-Anteil wäre die 75-%-Schwelle für die Oberfläche nicht messbar |
| Mutationstests | a) Stryker mit Vitest-Läufer · b) eigenes Werkzeug | **a** | Etabliert, Apache-2.0, Vitest-Läufer verlangt `vitest >=2.0.0` |
| Golden-Bilder PDF | a) Rendern in Edge · b) Rendern in Node mit `pdfjs-dist` + `@napi-rs/canvas` (Versionen fest) | **b** | Render-Kette unabhängig von Edge-Aktualisierungen, in `package-lock.json` fixiert |
| Bildschirm-Regression | a) Edge (Kanal `msedge`) · b) Playwright-Chromium (Download, fest) | **Entscheid E4**, entschieden an Gate 0: **b** | a) ohne Download, aber Edge aktualisiert sich selbst; b) fest, braucht Download |
| Barrierefreiheit | a) axe-core (MPL-2.0) · b) eigene Prüfungen | **Entscheid E3**, Empfehlung a) plus eigene Fokus-Prüfung; entschieden an Gate 0: **a** (Ausnahme erteilt) | axe ist Standard; MPL-2.0 steht nicht auf der Lizenzliste |
| Lizenzprüfung | a) Fremdwerkzeug · b) eigenes Skript über `package-lock.json` | **b** | Keine weitere Abhängigkeit; Regel «neu gegenüber `main`» ist projektspezifisch |
| Rückverfolgbarkeit | a) statische Suche in Testdateien · b) Testlisten der Läufer (JSON) | **b** (mit statischer Vorprüfung) | Erfasst auch parametrisierte Tests (`test.each`) |

## 3 Schleusen

Beide Schleusen sind je **ein Befehl** (Prompt §7 «Alles läuft lokal mit je einem Befehl»):

```
npm run wap:gate:fast      # node scripts/wap-gate/gate.mjs fast
npm run wap:gate:full      # node scripts/wap-gate/gate.mjs full
npm run wap:gate:selftest  # node scripts/wap-gate/selftest.mjs
```

Gemeinsame Regeln:

- Jeder Schritt meldet `OK <Schritt> (<Dauer>)` oder `ROT <Schritt>: <Ursache>. Nächster Schritt: <Hinweis>`; die Schleuse bricht nicht beim ersten roten Schritt ab, sondern führt alle unabhängigen Schritte aus und endet mit Exit 1 und einer Zusammenfassung (Ausnahme: Node-Prüfung und Lock-Prüfung brechen sofort ab).
- Kein Schritt ist überspringbar; es gibt keine Umgebungsvariable und keine Option zum Auslassen. Fehlt ein Werkzeug oder eine Datei, ist der Schritt rot.
- Ausgaben enthalten keine Personendaten und keine Inhalte aus `reference/` (Treffer maskiert wie H0 Klausel 5).
- Protokoll jedes Laufs: `test-results/wap/gate-<fast|full>-<zeitstempel>.json` (nicht versioniert; `test-results/` ist bereits in `.gitignore`).

### 3.1 Schnelle Schleuse (vor jedem Commit)

Prompt §7: «Lint, Typprüfung, Unit-Tests, Test-Lock, Datenschutz-Scan». Schritte in dieser Reihenfolge:

| Nr | Schritt | Werkzeug | Rot bei |
| --- | --- | --- | --- |
| F1 | Node-Version (F-001) | `scripts/wap-gate/node-check.mjs` | `process.versions.node` ausserhalb `engines.node` (`>=24.15.0 <25`) oder Hauptversion ≠ `.nvmrc`; Meldung nennt den Pfad `C:\Users\phili\AppData\Roaming\nvm\v24.15.0` |
| F2 | Lock-Prüfung | `scripts/wap/lock-check.mjs` (H0) | jede Abweichung (H0 Klausel 3) |
| F3 | Datenschutz-Scan | `scripts/wap/privacy-scan.mjs --staged` (H0) plus `scripts/wap-gate/privacy-deep.mjs --staged` | H0-Regeln; zusätzlich Inhalte von `.xlsx`, `.pdf`, `.docx` (entpackt bzw. per `pdfjs-dist` ausgelesen), die H0 nur per Pfad prüft |
| F4 | Verbotene Muster | `scripts/wap-gate/forbidden.mjs` | Abschnitt 4 |
| F5 | Lint | `npx biome check .` (nach Entscheid E11 mit LF im ganzen Repo; `files.includes` umfasst `scripts/wap*/**` und `tools/wap/**`, F-003) | jeder Befund (Suite-Regeln plus WAP-Überschreibungen, Abschnitt 4) |
| F6 | Typprüfung | `npx tsc --noEmit` (Suite) und `npx tsc -p tsconfig.wap.json --noEmit` | jeder Fehler der Suite-Prüfung; jeder Fehler der WAP-Prüfung in einer Datei der WAP-Pfadmenge (Abschnitt 4.2), **ausser** Meldungen zu Dateien der gesperrten Altmodul-Liste `scripts/wap-gate/legacy-modules.json`, solange deren SHA-256 dem eingefrorenen Wert entspricht (E12 c, AR0-44) |
| F7 | Grenzen | `scripts/wap-gate/module-boundaries.mjs`, `suite-boundary.mjs`, `lock-coverage.mjs` | Import gegen die Modulgrenzen (ADR-001, Abschnitt 4.4); geänderte Suite-Datei ausserhalb der freigegebenen Liste; ungesperrte Datei unter `scripts/wap-gate/` oder unter einer Testpfadmenge eines eingefrorenen Pakets |
| F8 | Unit-, Property-, Integrations- und PDF-Tests (Vitest, ohne Referenzen) | `npx vitest run -c vitest.wap.config.ts --reporter=json` | siehe Rot-Phase (3.3) |
| F9 | Rückverfolgbarkeit, statischer Teil | `scripts/wap-gate/trace.mjs --mode fast` | Test ohne ID; unbekannte ID; ID eines noch nicht eingefrorenen fremden Pakets (Abschnitt 5) |
| F10 | Lizenzen | `scripts/wap-gate/license-check.mjs` | Abschnitt 9 |

- Einbindung (**H0-Ergänzung A, Variante A-1, entschieden vom Orchestrator am 02.10.2026**; Vertrag E1-01 §1a, ADR-009 §3 Punkt 11): `scripts/wap/pre-commit.mjs` ruft nach grüner Lock-Prüfung, gestagtem Abgleich und Datenschutz-Scan `scripts/wap-gate/gate.mjs fast --pre-commit` auf, **sobald `scripts/wap-gate/gate.mjs` gesperrt ist** (Eintrag in `files` der `test-lock.json` des Worktrees, Arbeitsbaum oder gestagter Stand), nicht schon, wenn die Datei existiert (der Stub entsteht in E1-01 Schritt 2; sonst scheiterte jeder Commit von E1-01, auch der Freeze-Commit). Ohne Eintrag: Meldung «Schnelle Schleuse noch nicht eingerichtet …», sonst Verhalten wie bisher. Exit ≠ 0, Signal oder Startfehler → Commit abgebrochen (fail-closed). Wird `gate.mjs` nach der Sperrung gelöscht, meldet die Lock-Prüfung «fehlt» und der Commit ist rot; der Eintrag lässt sich nur per `lock-update --remove` mit Protokollzeile entfernen (Gate B). Aktiv ab dem Commit, mit dem der Orchestrator nach dem Merge von E1-01 die Dateien unter `scripts/wap-gate/` sperrt. Umsetzung in E1-01 als beschränkte, ausdrücklich beauftragte Ausnahme zu agent-regeln 5 nur für `scripts/wap/pre-commit.mjs` (per Befehl, `lock-update --refresh` mit Grund im selben Commit) und den neuen Test `tests/wap-harness/pre-commit-gate.harness.ts` (beim Freeze von E1-01 gesperrt); Kontrolle durch `git diff --name-only`, `code-reviewer` und die Gate-B-Liste.
- Zielzeit: ≤ 3 min; gemessen im Selbsttest von E1-01 und in `pakete/E1-01.md` belegt.
- **Welche Skripte prüfen** (analog H0 P26): Wenn der Orchestrator eine Schleuse als Beleg ausführt (Prompt §5.2 Schritt 9 und 13), ruft er die Skripte seines Arbeits-Checkouts auf den Paket-Worktree auf: `node <Arbeits-Checkout>/scripts/wap-gate/gate.mjs full --root <Paket-Worktree>`; `lock-check` läuft ebenso mit `--root`. Der Datenschutz-Scan als Nachweis läuft ebenfalls mit den Skripten des Arbeits-Checkouts, aber nur in den Objekt-Modi auf den Zweig: `privacy-scan --root <Arbeits-Checkout> --baum <zweig>` und `--commits <Basis>..<zweig>` mit `<zweig>` = `wap/<paket>` bzw. `wap-planer` (H0 P44, P46; ADR-009 §3 Punkt 10); dazu `lock-check --root <Arbeits-Checkout> --ref <zweig> [--gegen <Basis>]` (H0 P47). Die Refs sind allen Worktrees gemeinsam; Arbeitsbaum, Index-Flags und sparse checkout des Paket-Worktrees wirken auf diese Nachweise nicht. Der Pfad-Modus von `privacy-scan` ist kein Nachweis (H0 P46). So kann ein Paket die Schleuse nicht über seinen eigenen Stand abschwächen. Ausnahme ist E1-01 selbst (die Skripte entstehen erst dort): Beleg ist der Selbsttest im Paket-Worktree und danach die volle Schleuse aus dem Arbeits-Checkout nach dem Merge. Der Pre-commit-Aufruf im Worktree (H0-Ergänzung A) nutzt die gesperrten Skripte des Worktrees.

### 3.2 Volle Schleuse (vor dem Merge im Paket-Worktree und danach auf `wap-planer`)

Prompt §7: «alles, inkl. End-to-End, PDF-Prüfungen, Bildschirm-Regression, Leistung, `test:reference`». Schritte F1–F10, dann:

| Nr | Schritt | Befehl | Rot bei |
| --- | --- | --- | --- |
| V1 | Alle WAP-Vitest-Tests grün, zusätzlich unter `TZ=UTC` und `TZ=America/New_York` | `vitest run -c vitest.wap.config.ts` (dreimal) | jeder rote Test; jede Abweichung zwischen den Zeitzonen |
| V1a | Schleusen- und Harness-Selbsttests (Testart Integration-Gate) | `vitest run -c vitest.wap-gate.config.ts` und `vitest run -c vitest.wap-harness.config.ts` | jeder rote Test; ihre JSON-Berichte gehen in V9 ein |
| V2 | Abdeckung | Vitest-V8 + E2E-V8, zusammengeführt (Abschnitt 6) | Schwelle einer Pfadmenge oder eines Moduls unterschritten |
| V3 | Referenztests (`test:reference`) | `npm run test:reference` | fehlende Referenzdatei (nie «skip», Prompt §5.6), jeder rote Test |
| V4 | End-to-End (Edge) | `node scripts/wap-gate/e2e.mjs` → `playwright test -c playwright.wap.config.ts --project=edge --project=edge-tablet --project=edge-dist` | jeder rote Test; Konsolenfehler oder -warnungen der Seite (Prompt §6 «keine Konsolenfehler»); Netzanfrage ausser dem Laden der App |
| V5 | PDF Ebene 1 bis 3 und Parität | in V1, V3, V4 enthalten (Abschnitt 7) plus `vitest run -c vitest.wap-golden.config.ts` | jeder rote Test; Render-Kette geändert |
| V6 | Bildschirm-Regression | Playwright-Projekt gemäss Entscheid E4: `edge` (a) bzw. `chromium-visual` (b), Tests `*.visual.spec.ts` | Pixelabweichung > 0; Render-Kette geändert |
| V7 | Leistung | `playwright test -c playwright.wap.config.ts --project=perf` und `scripts/wap-gate/perf-compare.mjs` | Budget überschritten; Verschlechterung gegenüber `perf-baseline.json` (Abschnitt 8); Drosselungsfaktor nicht festgelegt |
| V8 | Mutationstests | `npx stryker run stryker.wap.conf.mjs --incremental` auf den im Paket geänderten Dateien der Mutations-Pfadmenge | Score < 80 % (Abschnitt 6.3) |
| V9 | Rückverfolgbarkeit, vollständig | `scripts/wap-gate/trace.mjs --mode full` (liest die JSON-Berichte aus V1, V1a, V3, V4, V5, V7) | Abschnitt 5 |
| V10 | Suite-Regression | `npm run check`, `npm run build`, `npm run check:release`, `npm run test:oracle` (Python 3, Entscheid E10 a) | jeder Fehler (Suite bleibt grün, Prompt §5.6); kein Python 3 → rot mit Hinweis (kein Überspringen). **Vor `test:oracle` (AR0-87):** `scripts/wap-gate/python-check.mjs` (Vertrag E1-01 §2 `checkPython`, Schritt «V10-python») wählt den Interpreter in der Reihenfolge `WAP_PYTHON` (gesetzt → nur dieser) → `py -3` → `python3` → `python`, verlangt Hauptversion ≥ 3 und startet `npm run test:oracle` mit dem Ordner des gewählten Interpreters **vorne** im PATH; sonst rot mit Ursache (gefundene Versionen) und nächstem Schritt (E10 a bzw. `WAP_PYTHON`). Grund ist die PATH-Reihenfolge unter Windows: System-PATH vor Benutzer-PATH, im Benutzer-PATH steht heute `C:\Python27` vor `…\Microsoft\WindowsApps` (dort `python3` nur als App-Ausführungsalias, Exit 9009); ein Python 3 hinter `C:\Python27` bliebe für `python` unsichtbar (Plan R-20) |
| V11 | Datenschutz über alle versionierten Dateien (Stand und alle Commits des Bereichs) und erzeugten Artefakte | H0 `privacy-scan.mjs --root <wt> --baum HEAD` **und** `privacy-scan.mjs --root <wt> --commits <Basis>..HEAD` (H0 P44; `<Basis>` wie beim Vergleichsstand unten) sowie `privacy-deep.mjs test-results/wap` | jeder Treffer (auch in Zwischencommits und in erzeugten PDF und Plan-Dateien); Exit 1 der Objekt-Modi (Gitlink, `info/grafts`, flaches Repo, ungültiger Ref oder Bereich); Einschränkung: die Objekt-Modi prüfen Inhalte nur in der WAP-Pfadmenge, alle übrigen Dateien nur am Pfad und auf `reference/` (H0 P35, P35b, P35c, P40, P44 c; ADR-009 §4); `privacy-deep.mjs` gleicht das nicht aus (O-6). Der Pfad-Modus (`privacy-scan.mjs .`) ist kein Nachweis (H0 P46). **Zusätzlich nach Gate-0-Entscheid 11 b (R-H-34):** `scripts/wap-gate/privacy-names.mjs --root <Arbeits-Checkout> --baum <zweig>` und `--commits <Basis>..<zweig>` prüft **alle** versionierten Textdateien, auch ausserhalb der WAP-Pfadmenge, nur gegen die Namen der Sperrliste (Vertrag E1-01 §2 `scanNames`); mit `--etappen-abschluss` zusätzlich `--commits $(git merge-base main <zweig>)..<zweig>`, also jeder Commit, den ein Merge nach `main` veröffentlichen würde. Vor jedem Merge nach `main` (erst nach Gate B) ist ein grüner Lauf `wap:gate:full --etappen-abschluss <N>` auf dem zu mergenden Stand Pflicht | jeder Namenstreffer ausserhalb der Freigaben `<Name>@<pfad>` von `scripts/wap/privacy-allow.txt` |

- **Vergleichsstand der Lock-Prüfung und des Datenschutz-Scans:** In der vollen Schleuse läuft F2 zusätzlich als `lock-check --root <Paket-Worktree bzw. Arbeits-Checkout> --gegen <Basis>` und aus Objekten als `lock-check --root <Arbeits-Checkout> --ref <zweig> --gegen <Basis>` (H0 P47; `<zweig>` = `wap/<paket>` vor bzw. `wap-planer` nach dem Merge, immer ein Zweigname, nie ein Hash, ADR-009 §4). `<Basis>` ist immer ein Stand vor einer Integration ohne Hook: vor dem Merge im Paket-Worktree die Merge-Basis mit `wap-planer` (`git merge-base HEAD wap-planer`), nach dem Merge auf `wap-planer` der Stand von `wap-planer` vor der Integration (bei `--no-ff` der erste Elternteil `HEAD^1`). Derselbe `<Basis>` gilt für `privacy-scan --commits <Basis>..HEAD` in V11 und nach jeder Integration ohne Hook (cherry-pick, `merge --ff-only`: `--commits <vorher>..<nachher>`, ADR-009 §4). Grund: Nach einem ungültigen Vergleichsstand schützt P27 nur den ersten Protokollblock (H0 P42b; Restrisiko CR-H0S-35 in ADR-009 §4); ein Scan nur des Endstands sieht Zwischencommits nicht (Eskalation 1, `probe-historie.txt`).
- Auf `wap/<paket>` vor Abschluss von Prompt §5.2 Schritt 7 wird die volle Schleuse nicht ausgeführt (sie verlangt ausnahmslos grüne Tests).
- Optionen: `--etappen-abschluss <N>` (V8 über die ganze Mutations-Pfadmenge statt inkrementell; V9 prüft alle IDs der Etappe ≤ N inklusive Auftraggeber-IDs gegen den Abnahmebericht; zusätzlich Stabilitätslauf 3.4). Keine Option verkleinert den Umfang.
- `test:oracle` der Suite (Python 3) läuft lokal nicht (nur Python 2.7 vorhanden). Die Suite-Grenzprüfung (F7) stellt sicher, dass keine PISA-Datei (`src/model/pisa.ts`, `tools/pisa_oracle.py`, `tests/test_pisa_oracle.py`) geändert wird. Offener Punkt O-3 (Abschnitt 13). **Entschieden an Gate 0 (02.10.2026): E10 a** – Python 3 als Benutzerinstallation ohne Adminrechte; danach ist `npm run test:oracle` Teil von V10 (Tabelle oben). Die Suite-Grenzprüfung bleibt zusätzlich bestehen.

### 3.3 Rot-Phase auf `wap/<paket>` (Prompt §7, §5.2 Schritt 5)

- Die Schleuse ermittelt das laufende Paket aus dem Zweignamen (`wap/<paket>`, z.B. `wap/e1-03`) und dessen IDs aus der Zuordnungstabelle in `plan/etappe-1.md` (Anhang A/B); `pakete/<paket>.md` muss dieselbe Menge nennen (sonst rot).
- Solange in `pakete/<paket>.md` das Kästchen 7 nicht angekreuzt ist, gilt: Jeder Test, der **mindestens eine ID des laufenden Pakets** trägt, muss ausführbar sein und **fachlich rot** sein; jeder andere Test muss grün sein. Danach und auf `wap-planer` müssen alle Tests grün sein.
- **Fachlich rot** heisst (Klassifikation aus den JSON-Berichten):
  1. Assertion-Fehler: Vitest `AssertionError` (auch `expect.soft`, `expect.poll`), Playwright-`expect`-Fehler (auch mit Wartezeit, z.B. «Timed out 5000ms waiting for expect(locator).toHaveText»).
  2. **Vertrags-Stub-Fehler** `Error('nicht implementiert: <name>')`, wenn `<name>` im Vertrag des laufenden Pakets (`plan/vertraege/<paket>.md`, Abschnitt «Stub-Namen») steht. **Auslegung, Entscheid E5.**
- **Nicht fachlich rot** (Schleuse rot): Import-, Syntax-, Typ- und Referenzfehler, Test-Zeitüberschreitung (ganzer Test), Fehler in `beforeAll`/`beforeEach`/Fixtures, Stub-Fehler eines fremden Pakets, Absturz des Läufers.
- Golden-Vergleiche sind ausgenommen (Prompt §5.2 Schritt 5); sie werden in Schritt 8 scharf geschaltet.

### 3.4 Flatternde Tests

- Keine automatische Wiederholung: Vitest `retry: 0`, Playwright `retries: 0`, Stryker ohne Wiederholung. Ein statischer Test (`tests/wap-gate/config.gate.ts`) prüft diese Werte in allen WAP-Konfigurationen.
- Stabilitätslauf `node scripts/wap-gate/stability.mjs` (an jeder Etappen-Abnahme, bei jedem Verdacht und im Selbsttest): WAP-Vitest dreimal, E2E mit `--repeat-each=3`. Jedes unterschiedliche Ergebnis ist ein blockierender Befund (Prompt §7).

### 3.5 Selbsttest der Schleusen (Prompt §5.3 Punkt 2)

`scripts/wap-gate/selftest.mjs` legt einen temporären Worktree des aktuellen Stands an (`git worktree add <tmp> HEAD --detach`), baut je Verstoss genau einen Fehler ein, führt die zuständige Schleuse aus und erwartet «rot» mit dem **richtigen Grund**; danach wird der Worktree entfernt. Ergebnis als Tabelle (Verstoss, Schleuse, Exit-Code, erkannter Grund).

| Nr | Verstoss | Erwartung |
| --- | --- | --- |
| S1 | übersprungener Test (`it.skip`, `test.skip`, `describe.skip`, `.todo`) | F4 und F5 rot |
| S2 | `TODO` in Produktcode (`src/model/wap/…`) | F4 rot |
| S3a | gesperrte Datei per Edit geändert | Hook `guard-edit.mjs` mit Hook-JSON aufgerufen → Exit 2; der echte Edit-Versuch durch einen Agenten ist Teil des Harness-Selbsttests R-H-09. **Auslegung (Entscheid E13):** Der Edit wird vom Hook verhindert, bevor die Schleuse etwas sehen kann; «Schleuse rot» heisst hier «Hook blockiert», der Befehlsweg ist durch S3b abgedeckt |
| S3b | gesperrte Datei per Befehl geändert | F2 rot («geändert») |
| S4 | AHV-Nummer in einer gestagten Datei | F3 rot (Ausgabe maskiert) |
| S5 | Test ohne ID | F9 rot |
| S6 | Schrift unter der Mindestgrösse im PDF (nachgeprüft am Ende von Paket 2, E1-02f) | V5 rot (Ebene-2-Prüfung) |
| S7 | Leistungsregression (nachgeprüft am Ende von Paket 2, E1-02f) | V7 rot (> 10 % gegenüber Baseline) |

Zusätzlich (nicht verlangt, aber zur Absicherung): `.only` im Test, `console.log` in Produktcode, `any` in Produktcode, `biome-ignore` ohne Begründung, geänderte Suite-Datei ausserhalb der Liste, fehlende Referenzdatei in `test:reference`, Test mit fremder Paket-ID, ungesperrte Datei unter `scripts/wap-gate/`.

Der Selbsttest läuft an jedem Gate B erneut (Prompt §5.3 Punkt 2) und bei jeder Änderung unter `scripts/wap-gate/`.

## 4 Codequalität (Prompt §7 «Weitere»)

### 4.1 Verbotene Muster (`forbidden.mjs`) und Lint

Geltungsbereich: WAP-Pfadmenge (4.2) und `scripts/wap*/**`, `tools/wap/**` (F-003). Rot bei:

- `.only`, `.skip`, `.todo`, `.fails`, `skipIf`, `runIf`, `test.fixme`, `test.fail` in Tests (auch `describe.*`, `it.*`); zusätzlich Biome `suspicious/noFocusedTests` und `suspicious/noSkippedTests` als Fehler (Überschreibung in `biome.json` nur für die WAP-Pfadmenge).
- `TODO`, `FIXME`, `XXX`, `HACK` in Produkt-, Test- und Skriptcode (Gross/Klein egal, als ganzes Wort).
- `console.` in Produktcode (Biome `noConsole` gilt bereits suiteweit); in Skripten unter `scripts/wap-gate/` nur über den Ausgabehelfer `lib/out.mjs`.
- `any` als Typ (Biome `suspicious/noExplicitAny: error`), `as any`, `<any>`; `@ts-ignore`, `@ts-nocheck`; `@ts-expect-error` nur mit Begründung (≥ 15 Zeichen) und nur in Tests.
- `biome-ignore` und `// Stryker disable` ohne Begründung von mindestens 15 Zeichen nach dem Doppelpunkt (Prompt §7 «kein Abschalten von Lint-Regeln ohne Begründung»). Jede Ausnahme erscheint in der Ausgabe der vollen Schleuse als Liste.
- Plattformabhängigkeit in WAP-Tests der Suite-Menge (4.5): absolute Pfade, `\\` in Pfad-Literalen, `process.platform`, Abhängigkeit von installierten Systemschriften (`local(`, `document.fonts.check` ohne eigene Schrift).
- Reinheit (Leitplanke 2, R-L-02) in `src/model/wap/**`: `document`, `window`, `navigator`, `localStorage`, `indexedDB`, `fetch`, `XMLHttpRequest`, `Math.random`, `Date.now`, `new Date()` ohne Argument, `performance.now`.
- Netz (R-11-03): `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`, `importScripts`, entfernte URLs in `src/**/wap*/**` (ergänzt `tests/privacy.test.ts`).
- WAP-Testdatei der Suite-Menge ohne Kopfzeile `// @vitest-environment node` oder `// @vitest-environment jsdom` (damit Suite-Lauf und WAP-Lauf dieselbe Umgebung nutzen).

### 4.2 Strikte Typprüfung (`tsconfig.wap.json`)

- `extends: ./tsconfig.json`, zusätzlich `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noImplicitReturns`.
- `include`: **WAP-Pfadmenge** `src/model/wap/**`, `src/io/wap-plan/**`, `src/io/wap-pdf/**`, `src/io/wap-import/**`, `src/io/wap-persons/**`, `src/io/xlsx-drawing/**`, `src/components/wap/**`, `src/pages/WapPage.tsx`, `src/assets/wap-fonts/**` (AR0-20), `tests/wap/**`, `tests/wap-e2e/**`, `tests/wap-perf/**`, `tests/wap-gate/**`; die Skripte `tools/wap/**` und `scripts/wap*/**` (ESM, JSDoc) prüft `tsc --checkJs` in derselben Konfiguration.
- **Altmodule (Entscheid E12, ADR-008):** Die fünf neutralen, unverändert aus `src/io/wap/` verschobenen Dateien (`zip`, `xml`, `sheet`, `colors`, `drawing`; `calibrate.ts` bleibt in `src/io/wap/`, AR0-38) unter `src/io/xlsx-drawing/` stehen in der gesperrten **Altmodul-Liste** `scripts/wap-gate/legacy-modules.json` (`{ "dateien": [{ "pfad", "sha256" }] }`, SHA-256 über den Inhalt mit LF-Zeilenenden, Werte in Vertrag E1-07 §1a, eingefroren beim ersten Lauf von E1-07). **Mechanismus (AR0-44):** `exclude` in `tsconfig.wap.json` allein genügt nicht, weil `tsc` jede importierte Datei mitprüft – die neuen strengen Dateien importieren `WapShape` und `SheetModel`, und die Probe des `code-reviewer` ergab damit 24 strenge Fehler in `colors.ts`, `sheet.ts`, `xml.ts`. Deshalb **verwirft F6 die Meldungen** zu Dateien dieser Liste, solange ihr SHA-256 dem eingefrorenen Wert entspricht; dieselbe Liste und dieselbe Bedingung gelten für die Ausnahme von der 90-%-Schwelle (`coverage-check.mjs`). Weicht der SHA-256 ab (Datei inhaltlich geändert), fällt die Datei aus beiden Ausnahmen und ist streng. Die Bedingung hängt nicht von `main` ab und gilt deshalb auch nach dem Merge und in der Suite-CI (AR0-46). Ein Test in E1-01 belegt die Filterung (Meldung in gelisteter, unveränderter Datei → verworfen; nach einer Änderung → rot). Die Suite-Typprüfung gilt für die Dateien unverändert. Alternative b (Umbau in E1-07) siehe ADR-008.
- Weil `tsc` auch importierte Suite-Dateien prüft, wertet F6 nur Meldungen zu Dateien der WAP-Pfadmenge; die Suite-Dateien prüft die Suite-Typprüfung mit ihren eigenen Regeln. Ein Test in E1-01 belegt die Filterung.

### 4.3 Rot-Nachweis für Querschnittsprüfungen (Entscheid E6)

Einige Anforderungen prüfen eine Eigenschaft über alle Oberflächen (R-2-01, R-3-02, R-5-03, R-9-01, R-11-03, R-11-06 bis R-11-10). Ihre Tests entstehen im letzten Oberflächenpaket (E1-17) und können dort bereits grün sein, weil frühere Pakete die Eigenschaft einhalten. Vorschlag: Für diese IDs ersetzt ein **Mutations-Rot-Nachweis** den Rot-Nachweis: Der `test-engineer` belegt je Test, dass er rot wird, wenn die geprüfte Eigenschaft gezielt verletzt wird (z.B. per injiziertem Stylesheet ohne Fokusrahmen, per Textersatz «Balken» statt «Querbalken», per zusätzlicher Netzanfrage im Testaufbau). Die Mutation liegt nur im Test-Worktree, nie im Produktcode. Vorgabe ohne Entscheid: dieser Vorschlag. **Entschieden an Gate 0 (02.10.2026): E6 a.**

### 4.4 Modulgrenzen (ADR-001, R-H-29)

`module-boundaries.mjs` liest alle statischen und dynamischen Importe (auch `import type`) der WAP-Pfadmenge und prüft:

| Modul | darf importieren |
| --- | --- |
| `src/model/wap/**` ausser `layout/`, `checks/` | nur `src/model/wap/**` ohne `layout/` und `checks/`, `immer` (`Rgb` liegt in `types.ts`, `FontWeight` in `layout/text/types.ts`, AR0-11) |
| `src/model/wap/layout/**` | `src/model/wap/**` ohne `checks/`, `hyphen`, generierte Metrik-Tabelle |
| `src/model/wap/checks/**` | `src/model/wap/**`; aus `layout/` nur `import type` (die Layout-Funktion wird als Parameter übergeben, Vertrag E1-06) |
| `src/io/xlsx-drawing/**` | `fflate`, eigene Dateien (nicht `model/tagesbefehl`, nicht `model/wap`) |
| `src/io/wap-import/**`, `src/io/wap-persons/**` | `src/io/xlsx-drawing/**`, `src/model/wap/**` |
| `src/io/wap-plan/**` | `src/model/wap/**` |
| `src/io/wap-pdf/**` | `src/model/wap/**`, `pdf-lib`, `fontkit`, `src/assets/wap-fonts/**` |
| `src/assets/wap-fonts/**` | nichts ausser eigenen Dateien und `src/model/wap/layout/text/types.ts` (nur `import type`) |
| `src/components/wap/**`, `src/pages/WapPage.tsx` | alles oben, `react`, `react-dom`, freigegebene Suite-Bausteine (Liste in `scripts/wap-gate/suite-allowlist.json`, Abschnitt «Importe») |
| Suite ausserhalb der WAP-Pfadmenge | WAP nur über `src/pages/WapPage.tsx` (Route, ADR-001) und über `src/io/xlsx-drawing/**` (ADR-008) |

### 4.5 Trennung von der Suite-CI (R-H-28)

**Entscheid:** Die WAP-Tests der Arten Unit, Property, Integration ohne Referenz und PDF (Dateien `tests/wap/{unit,property,integration,pdf}/**/*.test.ts`) **laufen im Suite-`npm test` mit** (sie passen auf das bestehende Muster `tests/**/*.test.{ts,tsx}` in `vitest.config.ts`; keine Änderung dieser Datei). Alle übrigen WAP-Tests haben eigene Endungen und laufen **nie** in der Suite-CI:

| Art | Muster | Konfiguration | Grund für den Ausschluss |
| --- | --- | --- | --- |
| Referenz | `tests/wap/reference/**/*.ref.ts` | `vitest.wap-reference.config.ts` | Referenzdateien fehlen in der CI und im Repo (Prompt §8); ohne sie schlägt die Suite fehl (Prompt §5.6) |
| Golden PDF | `tests/wap/golden/**/*.golden.ts` | `vitest.wap-golden.config.ts` | Pixelergebnis hängt von Betriebssystem und Skia-Binärdatei ab |
| E2E, Bildschirm, Leistung | `tests/wap-e2e/**/*.spec.ts`, `tests/wap-perf/**/*.perf.ts` | `playwright.wap.config.ts` | Edge und Windows vorausgesetzt |
| Schleusen und Harness | `tests/wap-gate/**/*.gate.ts`, `tests/wap-harness/**/*.harness.ts` | `vitest.wap-gate.config.ts`, `vitest.wap-harness.config.ts` | Git-Worktrees, Windows-Pfade (H0 P11) |

Begründung: Nach dem Merge nach `main` (erst nach Gate B) schützt die Suite-CI damit die Fachlogik und das gemeinsame Modul `src/io/xlsx-drawing/` (Tagesbefehl, ADR-008) gegen Änderungen anderer Werkzeuge. Bedingungen, damit das zulässig ist (Prompt-Auftrag «nur wenn grün und plattformunabhängig»):

1. Plattformneutralität: Musterregeln 4.1; V1 läuft in drei Zeitzonen; Zeilenenden nach Entscheid E11 (`.gitattributes`); Binär-Fixtures `-text`; Schrift aus dem Repo, nie aus dem System.
2. Laufzeit des WAP-Anteils im Suite-`npm test` ≤ 60 s lokal (V10 misst und meldet; Überschreitung ist rot). Property-Tests mit festem Startwert und begrenzter Laufzahl.
3. Auf `wap/<paket>` ist `npm test` während der Rot-Phase absichtlich rot; das betrifft nur Paketzweige, die nie gepusht werden (Prompt §5.6).
4. Restrisiko: Linux wird lokal nicht geprüft; der erste Linux-Lauf ist die Suite-CI beim Pull-Request nach `main` nach Gate B (Risiko R-10 in `plan/etappe-1.md`).
5. Die Typprüfung und Biome der Suite erfassen auch die ausgeschlossenen Dateien (`tests/**/*.ts`); `@playwright/test` ist deshalb Entwicklungs-Abhängigkeit (Typen ohne Browser).

## 5 Rückverfolgbarkeit (`trace.mjs`, R-H-15)

Eingaben:

- `docs/wap-planer/requirements.md`: alle Tabellenzeilen `| R-…` (ID, Etappe, Prüfart, Abnahmekriterium; «Verweis»-Ziele). **Nur der Katalog** gilt als Quelle gültiger IDs; die Werkzeug- und Leitplanken-IDs werden vor E1-01 über `plan/katalog-ergaenzung-e1.md` in den Katalog übernommen (PL0-17).
- `docs/wap-planer/plan/etappe-<N>.md`: Anhänge A und B mit fester Spaltenfolge `| ID | Paket | Testart | Verweis auf | Hinweis |`.
- `docs/wap-planer/pakete/<paket>.md`: Status (Kästchen 6 «Test-Freeze», 13 «Integration»).
- Testlisten: `vitest list --json` (alle WAP-Konfigurationen) und `playwright test --list --reporter=json` (schneller Modus); die JSON-Berichte der Läufe (voller Modus).

Regeln (rot bei Verstoss):

1. Jeder Testname enthält mindestens eine ID in eckigen Klammern (`[R-4.6-03]`); jede ID existiert im Katalog.
2. Die IDs eines Tests gehören zum laufenden Paket oder zu Paketen mit angekreuztem Kästchen 6. Tests für künftige Pakete sind verboten (sonst wären sie in der Rot-Phase nicht einzuordnen).
3. **Umfang** (Prompt §7 «laufende oder frühere Etappen»): im schnellen Modus alle IDs eingefrorener Pakete; im vollen Modus zusätzlich alle IDs des zu mergenden Pakets; mit `--etappen-abschluss N` alle IDs der Etappen ≤ N.
4. Jede ID im Umfang hat mindestens einen Test in einer Datei, deren Art zur Spalte «Testart» passt:

| Testart | zulässige Testdateien |
| --- | --- |
| Unit | `tests/wap/unit/**` |
| Property | `tests/wap/property/**` (Test nutzt `fc.assert` mit festem `seed`) |
| Integration | `tests/wap/integration/**`, `tests/wap/reference/**`, `tests/wap-e2e/**` (Integration im Browser, z.B. Parität, Determinismus Node/Edge, Netzprotokoll; PL0-02) |
| Integration-Gate | `tests/wap-gate/**`, `tests/wap-harness/**` (Lauf in V1a; PL0-01) |
| Integration-Referenz | `tests/wap/reference/**` |
| Integration-Leistung | `tests/wap-perf/**` |
| E2E | `tests/wap-e2e/**` |
| PDF | `tests/wap/pdf/**`, `tests/wap/reference/**` (bei B-Kp, F-51), `tests/wap-e2e/**` (PDF aus der Oberfläche) |
| Verweis | kein eigener Test; alle Ziel-IDs derselben oder früherer Etappen sind belegt; Ziele späterer Etappen werden ausgewiesen, nicht gefordert |
| Auftraggeber | kein Test; mit `--etappen-abschluss` muss die ID im Abnahmebericht im Teil «(b) durch den Auftraggeber zu bestätigen» stehen |

4a. **Eigener Test und Verweis** (PL0-25): Steht bei einer anderen Testart als «Verweis» ein Eintrag in der Spalte «Verweis auf» (z.B. R-1-08, R-5.2-10), braucht die ID einen eigenen Test gemäss Testart **und** alle Ziele der Etappe müssen belegt sein.
5. Prüfregeln (R-14.7-01): Für jede Regel der Etappe (Etappe 1: P1, P8, P16, P17 = R-7-10 bis R-7-13) gibt es mindestens einen Test mit `(positiv)` und einen mit `(negativ)` im Namen.
6. Die Zuordnungstabelle nennt jede ID der Etappe genau einmal, und `pakete/<paket>.md` nennt dieselbe Menge.

Ausgabe: `--out <datei>` schreibt die Matrix Anforderung → Tests (Markdown) und die Zahlen für die Gate-Vorlagen (Anforderungen, Tests, belegt/offen je Etappe und Paket). Im Repo landen nur Zusammenfassungen (`docs/wap-planer/zwischenstand/`, `abnahme/`), vollständige Matrizen in `.qa/<paket>/`.

## 6 Abdeckung und Mutationstests

### 6.1 Werkzeug

- Vitest: `@vitest/coverage-v8` **genau in der Version von `vitest`** (Peer-Abhängigkeit exakt; im Repo `vitest` 5.0.1). Abgefragt ist nur die neueste Fassung 5.0.3; ob 5.0.1 veröffentlicht ist, prüft E1-01 bei der Installation. Fehlt sie, werden `vitest` und `@vitest/coverage-v8` gemeinsam auf dieselbe Version gehoben (Suite-Datei `package.json`, Teil von E8, Suite-Regression V10).
- E2E: V8-Abdeckung über CDP (`page.coverage`, Edge ist Chromium-basiert) gegen den Vite-Entwicklungsserver (mit Quellzuordnung), umgerechnet mit `monocart-coverage-reports` (MIT); Zusammenführung beider Istanbul-Datensätze und Schwellenprüfung mit `scripts/wap-gate/coverage-check.mjs`.

### 6.2 Schwellen (Zweigabdeckung, Prompt §7)

| Pfadmenge | Schwelle | Dateien |
| --- | --- | --- |
| Fachlogik, Layout-Schicht, Prüfregeln, Import | ≥ 90 % | `src/model/wap/**`, `src/io/wap-import/**`, `src/io/xlsx-drawing/**` |
| Übriger WAP-Code | ≥ 75 % | `src/io/wap-plan/**`, `src/io/wap-pdf/**`, `src/io/wap-persons/**`, `src/components/wap/**`, `src/pages/WapPage.tsx`, `src/assets/wap-fonts/**`, `tools/wap/**` |

- Geprüft wird je Pfadmenge **und je Modulordner** (z.B. `src/model/wap/checks/`), damit gut abgedeckte grosse Module keine ungetesteten kleinen verdecken (strenger als Prompt §7, keine Lockerung).
- Ausgenommen sind nur reine Typdateien ohne ausführbaren Code (`types.ts`, `*.d.ts`), die generierte Metrik-Tabelle und die unverändert verschobenen Altmodule (Entscheid E12; dieselbe Liste `scripts/wap-gate/legacy-modules.json` und dieselbe SHA-256-Bedingung wie bei F6, AR0-44); die Liste steht in `coverage-check.mjs` bzw. `scripts/wap-gate/legacy-modules.json` und ist gesperrt. `src/assets/wap-fonts/**` und `tools/wap/**` gehören zur 75-%-Menge (AR0-20).
- Abdeckung ist nie ein Beleg (Prompt §7); sie ist nur eine Mindestbedingung.

### 6.3 Mutationstests

- Werkzeug: `@stryker-mutator/core` und `@stryker-mutator/vitest-runner` 10.0.0 (Apache-2.0), Konfiguration `stryker.wap.conf.mjs`, Läufer auf `vitest.wap.config.ts`.
- Pfadmenge (Prompt §7 «Fachlogik, Layout-Schicht, Prüfregeln, Beso-Nummerierung und Formtext-Zerlegung»): `src/model/wap/**` (ohne Typdateien) und `src/io/wap-import/formtext/**`, `src/io/wap-import/agenda-text/**`.
- Schwelle: `thresholds.break = 80`. Prompt §7 verlangt den Score an jeder Etappen-Abnahme; **zusätzlich** gilt er in jeder vollen Schleuse für die im Paket geänderten Dateien der Pfadmenge (inkrementell), damit überlebende Mutanten nicht erst am Etappenende auffallen (strenger als Prompt, keine Lockerung). Überlebende Mutanten werden begründet (Liste im Paketbericht, Kennzeichnung `// Stryker disable next-line <Mutator>: <Begründung>`) oder durch Tests getötet.
- **Rückfall (AR0-24, O-2):** Funktioniert der Vitest-Läufer mit Vitest 5 nicht, nutzt Stryker den Befehlsläufer (`testRunner: 'command'`, `commandRunner.command: 'npx vitest run -c vitest.wap.config.ts'`, ohne Testauswahl je Mutant, langsamer); die Schwelle bleibt.
- Laufzeit wird im Selbsttest von E1-01 an einem Beispielmodul gemessen; dauert ein Paketlauf > 30 min, legt der Orchestrator einen Vorschlag vor (keine stille Kürzung).

## 7 PDF und Bildschirm (Prompt §7, drei Ebenen)

### 7.1 Ebene 1 – Konformität mit Anhang B-Kp

- Tests lesen die Sollwerte (Ränder, Breitenverhältnisse, Zeit → Position, Linienarten und -dicken, Legendenfarben, Toleranzen) aus Anhang B-Kp und messen das erzeugte PDF mit den Prüfhilfen aus 7.2.
- Ablage der Sollwerte: Bis zum Entscheid F-51 liegt B-Kp nur in `reference/`; die Tests sind dann Referenztests (`*.ref.ts`, V3). Wird F-51 angenommen, liegt eine Fassung ohne Referenztexte in `docs/wap-planer/anhaenge/b-kp-masse.csv` (gesperrt) und die Tests laufen in `tests/wap/pdf/`. **Entschieden an Gate 0 (02.10.2026): F-51 und B-F-10 angenommen**; der Dateiname ist zur Vermeidung zweier Namen festgelegt auf **`docs/wap-planer/anhaenge/anhang-b-kp.csv`** (wie `normalisierung.md` Abschnitt 1 und N-03; ersetzt `b-kp-masse.csv`), einzige Testquelle der Ebene 1 (Vertrag E1-02e §4).
- Die Lock-Prüfung muss dafür auch Dateien ausserhalb des Worktrees sperren können: Einträge mit Präfix `@reference/` (aufgelöst über `WAP_REFERENCE_DIR`, sonst `<Haupt-Checkout>/reference/`). Das ist eine Erweiterung des H0-Vertrags (**Vorschlag H0-Ergänzung B**); bis dahin sichert E1-01 die bestätigten Anhänge mit `scripts/wap-gate/reference-lock.mjs` (gleiche Regeln, eigene Datei `docs/wap-planer/reference-lock.json`, in F2 ausgeführt) (R-14-01, R-14-03).

### 7.2 Ebene 2 – unabhängige Prüfung des fertigen PDF

- Prüfhilfen `tests/wap/support/pdf/` (in E1-01 vom `implementer` gebaut, per Selbsttest mit von Hand erzeugten PDF belegt): lesen mit `pdfjs-dist` 6.3.289 **nur das PDF**, nie das Layout-Modell.
  - `readPdf(bytes)`: Seiten mit Grösse; Textläufe mit Text, Grundlinie, Breite, Schriftgrösse, Schriftname, Füllfarbe, Drehung; Zeichenoperationen (Rechtecke, Linien, Pfade mit Strichstärke, Strichmuster, Farben) aus `getOperatorList`; eingebettete Schriften (`FontFile2`, `ToUnicode`), Bilder, Metadaten.
  - Prüfungen: `minFontSize(pdf) ≥ 4,5 pt` (R-10-38), `textInsideFrames` (kein Text ausserhalb seines Rahmens, Rahmen = das kleinste umgebende gezeichnete Rechteck des Eintrags), `noOverlaps`, `edgesOnTime(timeScale, tol)` (jede Blockkante auf ihrer Zeit), `fontsEmbedded`, `noImages`, `deterministicMetadata`.
  - Synthetische Leerzeichen-Stücke von pdfjs werden ignoriert (ADR-005).
- Zeichnet der PDF-Schreiber Text mit Clip-Pfaden oder Transformationsmatrizen, muss die Prüfhilfe diese auflösen; Selbsttest mit gedrehtem Text (ADR-004: Matrix `[0,5,-5,0,…]`).

### 7.3 Ebene 3 – Golden-Bilder mit fixierter Render-Kette

- PDF-Golden: `tests/wap/golden/**/*.golden.ts` rendern jede Seite in Node mit `pdfjs-dist` 6.3.289 und `@napi-rs/canvas` (Version in `package-lock.json` fest) bei **300 dpi** und vergleichen die dekodierten RGBA-Pixel **exakt** (0 abweichende Pixel) mit `tests/wap/golden/baselines/*.png`. Kein zusätzliches Vergleichswerkzeug nötig; das Differenzbild erzeugt `scripts/wap-gate/golden-report.mjs`.
- Bildschirm-Golden (Kernzustände, Prompt §7 «Bildschirm-Regression»): Playwright `toHaveScreenshot` mit `maxDiffPixels: 0`, `animations: 'disabled'`, `caret: 'hide'`, `deviceScaleFactor: 1`, fester Viewport, Schrift geladen (`document.fonts.ready` und Status der WAP-Schrift).
- **Render-Kette** in `tests/wap/golden/render-chain.json` (gesperrt), getrennt nach Art: PDF-Golden `pdfjs-dist`, `@napi-rs/canvas` (Skia fest eingebunden), SHA-256 der Schriftdateien; Bildschirm-Golden zusätzlich Browser und Version, Betriebssystem-Build und Anzeige-Skalierung (AR0-21). Jeder Golden-Test prüft zuerst die aktuelle Kette gegen die Datei; bei Abweichung ist er rot mit Grund «Render-Kette geändert» (nicht als Pixelfehler). Neue Baselines nach einer Kettenänderung sind eigene Commits (Prompt §5.6) mit Vorher/Nachher/Differenz an Gate B.
- Status je Bild in `tests/wap/golden/manifest.json` (gesperrt): `{ datei, sha256, status: "vorläufig" | "freigegeben", anforderungen, grund, commit }`. Aufnahme nur nach `visual-qa` (Prompt §5.2 Schritt 8), «freigegeben» nur durch den Auftraggeber.
- Golden-Bilder entstehen nur aus pseudonymisierten Fixtures; Vergleiche mit den Originalen liegen unter `reference/` und werden nur verlinkt (Prompt §7).

### 7.4 Paritätstest Bildschirm/PDF (R-5-01, Leitplanke 2)

- Eine Test-Harness-Seite (`tests/wap-e2e/harness/week.html`, Vite) zeichnet eine Woche mit dem Bildschirm-Zeichner; der Test liest jede Zeile aus dem DOM (Text, x, Breite, Grundlinie über einen Null-Marker wie im Spike, Drehung) und dieselbe Woche aus dem PDF (Prüfhilfe 7.2) und vergleicht **alle** Zeilen.
- Toleranz (ADR-004): x und Breite ≤ 0,05 pt; Grundlinie ≤ 0,6 px bei 1 px/pt; Text zeichengleich; gleiche Anzahl Zeilen; gleiche Umbrüche. Zusätzlich im Projekt `edge-dist` unter der Suite-CSP (FontFace aus ArrayBuffer, ADR-004 Option c).

## 8 Leistung (Prompt §7, Beschrieb 11)

- **Protokoll:** Edge (Chromium) mit CPU-Drosselung über CDP `Emulation.setCPUThrottlingRate`, Median aus 5 Läufen nach einem Aufwärmlauf, synthetischer Plan mit festem Startwert (4 Wochen, 1000 Einträge inklusive Beso und Querbalken; Generator `tests/wap/support/synthetic-plan.ts`, **E1-02a**, Verteilung im Vertrag E1-02a). Gemessen wird das **Produktions-Bundle** (`dist/index.html` bzw. die im Produktionsmodus gebaute Harness-Seite `tests/wap-perf/harness/`, **E1-01**, die je Paket eine Eintragsdatei `entries/<paket>.ts` lädt), nie der Entwicklungsserver (PL0-13).
- **Drosselungsfaktor: festgelegt, F = 1,5.** Er wird aus der Umgebungsprobe (Prompt §5.1 Schritt 3, R-H-01/R-H-02) abgeleitet: F = t(Dienstlaptop, Edge) / t(lokal, **im Browser des Leistungsprojekts** gemäss Entscheid E4), gleicher fester Benchmark, beide als Median; aufgerundet auf die nächste halbe Stufe, mindestens 1. Umgebungsprobe `umgebungsprobe-3` vom 01.10.2026 (Benchmark `bench-1`, Prüfsumme `e00aad5a`): Dienstlaptop Edge 155.0.4283.24 Median 132,7 ms; lokal Edge 155.0.4283.24 headless Median 90,6 ms (Kontrolllauf 89,6 ms); 132,7 / 90,6 = 1,46 → **1,5**. Kontrolle mit sichtbarem Fenster (Architektur-Review): Mediane 97,1 / 100,1 ms → 1,37 / 1,33 → ebenfalls 1,5. Ablage `docs/wap-planer/perf/drosselung.json` mit `faktor`, Herleitung, beiden Messwerten, Kontrolle, Browser und Prüfseite (`"status": "festgelegt"`). **Sperre (AR0-71):** Der Orchestrator sperrt die Datei mit dem ersten `lock-update --add` nach dem Merge von H0; danach ist sie gesperrt. Die Regel bleibt: Enthält die Datei `"faktor": null` oder `"status": "offen"`, ist V7 rot mit «Drosselungsfaktor nicht festgelegt (Umgebungsprobe ausstehend)» (Selbsttest R-H-22); es wird kein Ersatzwert angenommen. Mit dem festgelegten Faktor ist V7 nicht mehr aus diesem Grund rot; Pakete mit Leistungs-IDs (E1-02f, E1-06, E1-08, E1-11, E1-13) sind nicht mehr durch den Faktor blockiert. **Neumessung des lokalen Bezugswerts (AR0-70):** Der lokale Wert ist headless gemessen und liegt nahe an der Stufengrenze (ein lokaler Median unter 88,47 ms ergäbe 2,0). E1-01 misst ihn deshalb **unabhängig von E4** mit derselben Prüfseite unter den Bedingungen des Leistungsprojekts neu (sichtbares Fenster, Netzbetrieb; bei E4 b im Chromium des Leistungsprojekts). Ergibt sich nach der Rundung eine andere Stufe, wird `drosselung.json` per `lock-update` mit Grund nachgeführt.
- **Budgets** (harte Grenzen, Prompt §7): Ziehen p95-Bildzeit ≤ 16,7 ms und keine Aufgabe > 50 ms während 2 s Ziehen (R-11-11); Wochenwechsel ≤ 300 ms bis zur fertigen Darstellung (R-11-12; Marke `performance.mark('wap:weekRendered')`, Vertrag E1-11); Prüfungen ≤ 500 ms (R-11-14); PDF Woche ≤ 3 s, ganzer Plan ≤ 10 s (R-11-15, R-11-16); Import ≤ 15 s (R-11-17, Referenzdatei). Filter (R-11-13) ab Etappe 2.
- **Baseline** `docs/wap-planer/perf/perf-baseline.json` (gesperrt):

```json
{
  "version": 1,
  "protokoll": { "drosselung": "<aus drosselung.json>", "laeufe": 5, "aufwaermlaeufe": 1, "startwert": 20260928, "plan": { "wochen": 4, "eintraege": 1000 } },
  "umgebung": { "browser": "msedge 155.0.4283.24", "node": "24.15.0", "cpu": "<Modell>", "strom": "Netz" },
  "messwerte": {
    "pdfWoche": { "medianMs": 0, "budgetMs": 3000, "anforderung": "R-11-15", "gemessenAm": "dd.mm.yyyy", "commit": "<hash>" }
  }
}
```

  Die Werte (hier nur als Schema gezeigt) trägt der Orchestrator nach der ersten grünen Messung per `lock-update` ein; jede Messgrösse kommt mit dem Paket hinzu, das sie einführt.
- **Regression:** Median > 1,10 × Baseline ist blockierend (Prompt §7). Verbesserungen ändern die Baseline nicht automatisch. Änderungen der Baseline gelten als Lockerung, wenn sie Werte erhöhen (Zustimmung des Auftraggebers am nächsten Gate).
- **Kleine Messwerte (Entscheid E7):** Bei Medianwerten unter 20 ms liegt das Messrauschen über 10 %; ein flatternder Leistungstest wäre blockierend. Vorschlag: Regression = Median > max(1,10 × Baseline, Baseline + 2 ms). Vorgabe ohne Entscheid: reine 10-%-Regel. **Entschieden an Gate 0 (02.10.2026): E7 a** – `comparePerf` mit `regel: 'prozent10oder2ms'`.
- **Browser des Leistungsprojekts (Entscheid E4 b, Gate 0):** Das Projekt `perf` und die Bildschirm-Regression (`chromium-visual`) laufen im Playwright-Chromium der zu `@playwright/test` 1.63.0 gehörenden Fassung, nicht im installierten Edge; «Edge (Chromium)» im Protokoll oben ist für die Leistung so zu lesen. In `perf-baseline.json` steht unter `umgebung.browser` diese Chromium-Version mit Revision. Der lokale Bezugswert des Drosselungsfaktors wird in E1-01 in diesem Chromium neu gemessen (Absatz «Drosselungsfaktor»).
- Messbedingungen werden mitprotokolliert (Netzbetrieb, Fenster sichtbar, keine weiteren Läufe); `perf-compare.mjs` lehnt Läufe ab, die parallel zu einer anderen Schleuse laufen (Sperrdatei im gemeinsamen Git-Verzeichnis).

## 9 Lizenzprüfung (`license-check.mjs`, R-H-23)

- Liest `package-lock.json` (alle Pakete, auch transitiv) und die installierten `package.json`.
- Zulässig (Prompt §7): `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `0BSD`; Schriften `OFL-1.1`; SPDX-Ausdrücke mit `OR` sind zulässig, wenn eine Alternative zulässig ist.
- Geprüft werden alle Pakete, die gegenüber `git merge-base main HEAD` neu sind oder ihre Version geändert haben; bestehende Suite-Pakete werden aufgelistet, aber nicht bewertet (Suite-Entscheid, nicht WAP).
- Nicht-npm-Bestandteile in `scripts/wap-gate/license-assets.json` (gesperrt): Arimo Regular/Bold (OFL-1.1, SHA-256 aus ADR-003, `OFL.txt` neben den Dateien), deutsche Trennmuster (MIT, Quelle hyph-de-1996 der Trennmustermannschaft, im Paket `hyphen`).
- Ausnahmen nur mit Gate-Entscheid, je mit Paket, Version, Lizenz, «nur Entwicklung» und Datum in derselben Datei; Beispiel: `axe-core` (Entscheid E3).
- Zusätzlich: Jede Laufzeit-Abhängigkeit des WAP-Planers erscheint in der Lizenzliste des Builds (`<template id="application-licenses">`); für die Schrift und die Trennmuster mit ihrer eigenen Lizenz (ADR-003 Folgen, Änderung an `tools/build-offline.mjs`).

## 10 Weitere Instrumente

- **Datenschutz-Scan** (R-H-24): H0-Scanner in F3 (`--staged`) und V11 (Objekt-Modi `--baum`/`--commits`, H0 P44) plus `privacy-deep.mjs` für Container- und PDF-Inhalte (Fixtures `.xlsx`, erzeugte PDF und Plan-Dateien in `test-results/wap/`). Die Sperrliste bleibt lokal (H0 P8). Der H0-Scanner prüft Inhalte nur in der WAP-Pfadmenge (H0 P35/P40, ADR-009 §4); `privacy-deep.mjs` deckt nach diesem ADR nur Container- und PDF-Inhalte (F3: `--staged`; V11: nur `test-results/wap`), nicht Textdateien ausserhalb der Pfadmenge (offener Punkt O-6).
- **Migrations-Fixture** (Prompt §7, R-H-33): je Etappe eine Plan-Datei `tests/wap/fixtures/migration/etappe-<N>.wap.json` (gesperrt), die alle Eintragstypen und Felder der Etappe enthält. Test: Jede spätere Version öffnet sie verlustfrei (Rundreise ohne Feldverlust) und lehnt die um eins erhöhte Formatversion ab (R-5.6-17). Angelegt in E1-04, am Etappenende bei Formatänderung nachgeführt (eigener Commit, `lock-update` mit Grund).
- **Offline-Test** (R-H-25, verwendet von R-14.13-01): Playwright-Hilfe mit dauerhaftem Profil (`launchPersistentContext`, `acceptDownloads: true`, Download-Pfad gesetzt), Netz gesperrt (`context.setOffline(true)` und Abbruch jeder Anfrage ausser `file://`), Neustart durch Schliessen und erneutes Starten mit demselben Profil. Ziel ist `dist/index.html` über `file://` (ADR-007 Option A/D). Risiko: Im Spike wurden Downloads im dauerhaften Profil abgebrochen (ADR-006); der Selbsttest von E1-01 muss «Datei sichern» im dauerhaften Profil belegen.
- **Barrierefreiheit** (R-H-26): automatische Prüfung je Kernzustand (Entscheid E3) plus eigene Prüfungen: sichtbarer Fokus (jedes fokussierbare Element: Umriss- oder Schattenänderung beim Fokus, Kontrast ≥ 3:1 zum Hintergrund, R-11-08), zugängliche Namen über Rolle und Name, Tastatur-E2E je Standardaufgabe (R-11-07).
- **Netzprotokoll** (R-11-03): Jede E2E-Seite zeichnet alle Anfragen auf; ausser dem Laden der App (Ursprung des Servers bzw. `file://`) ist jede Anfrage ein Fehler.
- **Konsolenprüfung**: Jede E2E-Seite sammelt `console` und `pageerror`; jeder Eintrag der Stufe Warnung oder Fehler macht den Test rot (Prompt §6).
- **Ports und Parallelität** (Prompt §5.6): `scripts/wap-gate/e2e.mjs` wählt einen freien Port und setzt `WAP_E2E_PORT`; mehrere Worktrees laufen gleichzeitig. `WAP_REFERENCE_DIR` ist in Worktrees Pflicht (fehlt sie, ist V3 rot).
- **Node-Versionsprüfung** (R-H-27): F1, zusätzlich in `globalSetup` aller WAP-Vitest-Konfigurationen und in Playwright; so bricht auch ein Einzelaufruf unter Node 22 ab.

## 11 Abhängigkeiten (neu, alle Versionen exakt)

| Paket | Version | Lizenz | Art | Zweck | ADR |
| --- | --- | --- | --- | --- | --- |
| `@playwright/test` | 1.63.0 | Apache-2.0 | Entwicklung | E2E-Läufer, Edge über Kanal `msedge`; Browser-Download nur bei Entscheid E4 b – **E4 b entschieden (Gate 0):** einmaliger Download des zugehörigen Chromium mit `npx playwright install chromium` durch den Orchestrator im Paket-Worktree von E1-01, nachdem der `implementer` `@playwright/test` eingetragen hat (Netzzugriff ausserhalb der Paketinstallation, durch den Auftraggeber freigegeben; Ablage im gemeinsamen Browser-Ordner `%LOCALAPPDATA%\ms-playwright`, den alle Worktrees nutzen; keine Projektdaten im Netzverkehr) | 010 |
| `@vitest/coverage-v8` | = `vitest` (Abschnitt 6.1) | MIT | Entwicklung | Abdeckung Vitest | 010 |
| `monocart-coverage-reports` | 2.13.0 | MIT | Entwicklung | E2E-Abdeckung V8 → Istanbul | 010 |
| `@stryker-mutator/core` | 10.0.0 | Apache-2.0 | Entwicklung | Mutationstests | 010 |
| `@stryker-mutator/vitest-runner` | 10.0.0 | Apache-2.0 | Entwicklung | Vitest-Läufer für Stryker (`vitest >=2.0.0`) | 010 |
| `fast-check` | 4.10.2 | MIT | Entwicklung | Property-Tests (Prompt §7) | 010 |
| `fake-indexeddb` | 6.2.5 | Apache-2.0 | Entwicklung | IndexedDB in Vitest (E1-04) | 006, 010 |
| `pdfjs-dist` | 6.3.289 | Apache-2.0 | Entwicklung | PDF-Prüfung Ebene 2, Golden-Rendering | 005, 010 |
| `@napi-rs/canvas` | 1.0.9 (optionale Abhängigkeit von `pdfjs-dist`) | MIT | Entwicklung | Canvas für Golden-Rendering in Node | 010 |
| `axe-core` + `@axe-core/playwright` | 4.13.0 / passend | **MPL-2.0** | Entwicklung | Barrierefreiheit | Entscheid E3, entschieden a (Ausnahme, Gate 0) |
| `fontkit` | 2.0.4 | MIT | **Laufzeit** | Schrift-Teilmengen für pdf-lib (Adapter) | 005 |
| `immer` | 11.1.18 | MIT | **Laufzeit** | Befehle mit Patches und inversen Patches (ADR-002 Punkt 7) | 002 |
| `hyphen` | 1.14.1 | ISC (Muster de-1996: MIT) | **Laufzeit** | Deutsche Silbentrennung nur für zu lange Wörter (Beschrieb 15; ADR-004 offener Punkt) | 004 |
| Arimo Regular/Bold (Dateien, aus `@expo-google-fonts/arimo@0.4.3` kopiert) | 1.341 | OFL-1.1 | **Laufzeit** (Datei) | Schrift (ADR-003) | 003 |

- Transitive Abhängigkeiten (z.B. von Stryker, `fontkit`) prüft `license-check.mjs` bei der Installation in E1-01; eine unzulässige Lizenz ist ein Befund und kommt an das nächste Gate.
- Alle Abhängigkeiten der Etappe 1 installiert **nur E1-01** (Änderung an `package.json`/`package-lock.json` in genau einem Paket, sonst Konflikte paralleler Pakete). Später nötige Pakete brauchen einen eigenen kleinen Schritt des Orchestrators mit Lizenzprüfung.
- Keine Abhängigkeit wird zur Laufzeit aus dem Netz geladen; alle Laufzeit-Abhängigkeiten werden in die Einzeldatei gebündelt (Bundle-Zuwachs: ADR-001 Folgen; `immer` ≈ 5 KB gz, `hyphen` mit de-Mustern ≈ 30 KB, im Paket E1-02b gemessen).

## 12 Gate-0-Entscheide (für die Gate-Vorlage)

| Nr | Frage | Optionen | Empfehlung | Vorgabe ohne Entscheid |
| --- | --- | --- | --- | --- |
| E1 | Neue Entwicklungs-Abhängigkeiten (Abschnitt 11 ohne axe) | zustimmen / ablehnen | zustimmen (alle Lizenzen zulässig, nicht ausgeliefert) | keine Installation, E1-01 kann nicht beginnen |
| E2 | Neue Laufzeit-Abhängigkeiten `fontkit`, `immer`, `hyphen`, Arimo | zustimmen / einzeln ablehnen | zustimmen | ohne `immer`: eigene Patch-Funktionen (mehr Code, E1-03 grösser); ohne `hyphen`: kein Umbruch in Wörtern (Beschrieb 15 nicht erfüllbar) |
| E3 | Barrierefreiheit mit `axe-core` (MPL-2.0, nur Entwicklung, unverändert genutzt, nie ausgeliefert) | a) Ausnahme erteilen · b) eigene Prüfungen | a | b (Kontrast, Namen, Fokus selbst geprüft; geringere Abdeckung der WCAG-Regeln) |
| E4 | Browser für Bildschirm-Golden und Leistung | a) installierter Edge (Projekte `edge`, `perf` mit Kanal `msedge`), Version in der Render-Kette; bei Edge-Aktualisierung neue Baseline mit Vorher/Nachher an Gate B · b) Playwright-Chromium in fester Version (einmaliger Download ≈ 150 MB über `npx playwright install chromium`; **Netzzugriff ausserhalb der Paketinstallation, ausdrückliche Ausnahme** nach Prompt §5.4); dann heissen die Projekte `chromium-visual` und `perf`, der Drosselungsfaktor wird lokal im selben Chromium gemessen; funktionale E2E und Offline-Test bleiben in Edge (Zielumgebung) | b, weil Edge sich selbst aktualisiert | a |
| E5 | Rot-Nachweis: zählt der Vertrags-Stub-Fehler «nicht implementiert: …» als fachlich rot? (Prompt §5.2 Schritt 5 nennt «Assertion-Fehler», Schritt 2 verlangt Stubs, die diesen Fehler werfen) | a) ja, nur für Stubs des laufenden Pakets · b) nein, Tests müssen den Stub-Aufruf in eine Erwartung kapseln | a | a |
| E6 | Rot-Nachweis per Mutation für Querschnitts-IDs (Abschnitt 4.3) | a) ja · b) nein (dann müssen diese IDs vor dem jeweils ersten Oberflächenpaket getestet werden, was ohne Oberfläche nicht geht) | a | a |
| E7 | Leistungsregression bei Messwerten unter 20 ms | a) max(10 %, 2 ms) · b) nur 10 % | a | b |
| E8 | Änderungen an Suite-Dateien für die Werkzeugkette: `package.json` (Skripte, Abhängigkeiten), `package-lock.json`, `biome.json` (Überschreibungen nur für WAP-Pfade), `.gitignore` (Ausnahmen `!tests/wap/fixtures/**/*.xlsx`, `!tests/wap/fixtures/**/*.csv`), `.gitattributes` (Entscheid E11) | zustimmen / ablehnen | zustimmen | E1-01 kann nicht abgeschlossen werden |
| E9 | WAP-Unit-Tests im Suite-`npm test` (Abschnitt 4.5) | a) ja · b) nein | a | a |
| E10 | Python 3 für `test:oracle` lokal | a) Python 3 ohne Adminrechte installieren (Benutzerinstallation) · b) Ersatz durch Suite-Grenzprüfung (PISA-Dateien unverändert) | a | b |
| E11 | Zeilenenden (F-002, AR0-05, AR0-28): `biome check .` ist lokal rot (134 Fehler, CRLF durch `core.autocrlf=true`), F5 und V10 wären nie grün | a) `.gitattributes` `* text=auto eol=lf` für das **ganze Repo** plus einmalige Normalisierung (`git add --renormalize .`, ein Commit, Suite-Dateien betroffen); Binärdateien `-text`. Bestehende Arbeitskopien bleiben dabei CRLF (nachgestellt vom `code-reviewer`), und Neu-Auschecken per `git checkout -- .` oder `git reset --hard` ist gesperrt (Agenten-Regel 5). **Erlaubter Weg (AR0-39):** Nach dem Merge der Normalisierung prüft der Orchestrator, dass der alte Worktree sauber ist (`git status` leer), beendet seine Sitzung in diesem Worktree, entfernt ihn **von aussen** mit `git worktree remove <pfad>` (ohne `--force`; ignorierte Dateien stehen dem nicht entgegen) und legt ihn danach mit `git worktree add <pfad> <zweig>` neu an – in dieser Reihenfolge, weil derselbe Zweig nicht in zwei Worktrees ausgecheckt sein kann. Alternative: neuer Worktree mit `--detach`, alter entfernen, dann Zweig im neuen auschecken. Danach neue Sitzung im neuen Worktree. Der Haupt-Checkout des Auftraggebers wird nicht angefasst. Nachweis im Selbsttest von E1-01: `biome check .` grün im neu angelegten Arbeits-Checkout · b) Biome nur auf WAP-Pfaden prüfen und die Suite-Formatprüfung lokal auslassen (V10 nutzt dann `npm run typecheck && npm test` statt `npm run check`) | a (entspricht der Suite-CI unter Linux, eine Quelle der Wahrheit) | b |
| E12 | Strenge Prüfung der Altmodule (AR0-03, AR0-29, ADR-008 «Altmodule») – geänderte Altdateien sind immer streng und unter 90 % | a) Erweiterungen in den bestehenden Dateien → `calibrate.ts`, `sheet.ts`, `drawing.ts` (und `colors.ts`) werden streng: 36 bis 46 der 48 Fehler beheben, 90 % Zweigabdeckung; Umbau von Tagesbefehl-Code in E1-07 · b) alle sechs Module streng (Umbau aller) · c) nur die fünf neutralen Dateien unverändert verschieben, `calibrate.ts` bleibt in `src/io/wap/` (Tagesbefehl); alle Erweiterungen in **neue Dateien mit eigenen Typen**, darunter eine neutrale Kalibrierung (`calibration.ts`, befristete Doppelung bis Etappe 4). Mechanismus der Ausnahme: F6 und `coverage-check.mjs` verwerfen Meldungen zu den fünf Dateien, solange ihr SHA-256 dem eingefrorenen Wert in `scripts/wap-gate/legacy-modules.json` entspricht (`exclude` allein genügt nicht, AR0-44). Folge der Doppelung: Abweichungen zwischen `calibrate.ts` und `calibration.ts` fallen nur über die gemeinsamen synthetischen Arbeitsmappen auf (Risiko R-09) | c | c |
| E13 | Auslegung S3a (PL0-23): «gesperrte Datei per Edit» belegt der Hook (Exit 2), nicht eine rote Schleuse | a) so annehmen · b) zusätzlich verlangen, dass eine per Edit geänderte Datei (Hook abgeschaltet) die Schleuse rot macht – das ist S3b | a | a |

Nur zur Kenntnis (kein Entscheid nötig, weil strenger als der Prompt): Mutations-Schwelle je Paket (6.3), Abdeckung je Modul (6.2), Stabilitätslauf (3.4), Schleusen-Skripte unter `scripts/wap-gate/` statt `scripts/wap/` (Abschnitt 2), Vorschläge H0-Ergänzung A (Delegation im Pre-commit) und H0-Ergänzung B (`@reference/`-Einträge in der Lock-Prüfung) an den Orchestrator.

### 12.1 Übersicht aller Architektur-Entscheide an Gate 0 (ADR-001 bis ADR-010, inkl. H-1/H-2 aus ADR-009)

| Nr | ADR | Frage | Empfehlung | Vorgabe ohne Entscheid |
| --- | --- | --- | --- | --- |
| G-1 | 001 | Delegation der globalen Suite-Kürzel (Ctrl+S/Z/Y/Shift+Z, Ctrl+B, «?») über `setRouteKeyDelegate` in `Shell.tsx` statt `stopPropagation` (Suite-Änderung, UI-K-2/S-3) | ja; verbindlicher E2E «Suite-Undo/-Sicherung lösen auf /wap nie aus» | ohne Entscheid kein Merge von E1-11 |
| G-2 | 001 | Einbindung als Route `/wap` der Suite (Option A) mit Suite-Dateien gemäss Plan §9 | ja | Option A |
| G-3 | 003 | Schrift Arimo im Bundle (≈ 0,85 MB) | ja | Arimo |
| G-4 | 004 | Bildschirmschrift per FontFace aus ArrayBuffer (c) oder CSP `font-src data:` (a) | c | c |
| G-5 | 005 | `fontkit` 2 mit Adapter im Bundle (Option B, Spike AR0-08 belegt) | B | B; scheitert der Adapter-Test später, A |
| G-6 | 006 | IndexedDB `wap-planer` und `persist()` in der Suite | ja | ja |
| G-7 | 007 | «Lesen auf dem Tablet» = PDF (a) oder App (b, braucht Option C) | a | a |
| G-8 | 007 | Release-Datei mit Version im Namen (Suite-Build, Deploy; nach Gate B) | ja | unverändert |
| G-9 | 006 | Datenschutz unter `file://`: gemeinsamer Speicher aller lokalen HTML-Dateien hinnehmen (a), gehostet (b), Verschlüsselung (c) | a | a |
| G-10 | 008 | Gemeinsames XLSX-Modul, Tagesbefehl-Dateien werden Weiterleitungen | ja | ja |
| G-11 | 007 | Auslieferung Option D mit A als Arbeitsweg (Einzeldatei lokal; Tablet liest PDF), durch die Umgebungsprobe bestätigt (ADR-007); ein Service Worker (Option C) bräuchte `worker-src 'self'` für die ganze Suite | D/A | D/A |
| G-12 | 002 | Varianten früherer Stände (Auslegung Beschrieb 5.5 und 10): a) nur A4 mit Status rot gespeichert, A3 und «Status aus» für Stände gesperrt · b) zusätzlich A3 je Stand mitspeichern · c) alle vier Kombinationen; bei b/c neues Schlüsselschema `‹weekId|plan›/‹A4|A3›/‹rot|aus›` (Verträge E1-04, E1-05) und doppelte bzw. vierfache Sperrdauer beim Stand (AR0-43) | a | a |
| H-1 | 009 | Auswirkungen des Harness auf die Suite (Hooks im gemeinsamen Git-Verzeichnis, Erlaub- und Sperrliste, Agenten) | zur Kenntnis und Freigabe | – |
| H-2 | 009 | Bekannte Grenzen des Harness (cherry-pick/ff-merge, Umgehungen per Befehl, 8.3-Namen, Pfad-Modus von `privacy-scan` ohne Nachweischarakter nach Eskalation 1, Commit-Nachrichten ungeprüft, globale git-Konfiguration, `GIT_*` per Präfix, `lock-check --ref <hash>`) mit Ausgleich | annehmen | – |
| E1–E13 | 010 | siehe Tabelle oben (E11 mit erlaubtem Weg, E12 mit Option c) | – | – |

### 12.2 Ergebnis Gate 0 (02.10.2026)

Antwort des Auftraggebers (wörtlich, `PROGRESS.md` Freigabeprotokoll): «Zu deinen Befunden, alle Empfehlungen sind angenommen. Nr 12: zurückstellen (vermerken)». Damit gelten alle Empfehlungen der Tabellen 12 und 12.1: E1–E3 zustimmen/a, **E4 b** (Playwright-Chromium fest), E5 a, E6 a, E7 a, E8 zustimmen, E9 a, **E10 a** (Python 3 Benutzerinstallation), **E11 a** (`.gitattributes` ganzes Repo), **E12 c**, E13 a; G-1 bis G-12 gemäss Empfehlung (G-11 D/A, G-12 a); H-1 freigegeben, H-2 angenommen; Gate-0-Entscheid 11 b (Namensprüfung aller Textdateien in V11); Gate-0-Entscheid 12: CR-H0S-32/38/42/43 zurückgestellt.

### 12.3 Umsetzung von E11 a: Reihenfolge (architect, 02.10.2026)

**Spike** (lokaler Klon im Scratchpad, Wegwerf; Befehle in Abschnitt 14): Im Repo sind **alle** Textdateien im Index bereits LF (`git ls-files --eol`: 266 × `i/lf`, 6 leere Dateien, 1 Datei als Binär erkannt, `docs/wap-planer/pakete/H0.md` wegen eines einzelnen CR; 0 × `i/crlf`). CRLF entsteht nur im Arbeitsbaum durch `core.autocrlf=true` (Systemkonfiguration von Git für Windows). Ergebnisse:

| Frage | Messung |
| --- | --- |
| Was ändert `.gitattributes` + `git add --renormalize .`? | genau `A .gitattributes`; **0 geänderte Blobs** |
| Hashes der 28 gesperrten Dateien (`test-lock.json`) | 0 von 28 mit anderem Blob; `lock-check` «28 Dateien in Ordnung» im alten CRLF-Arbeitsbaum und in einem frischen LF-Worktree (Hash `sha256Lf`, H0 P1: CRLF → LF vor dem Hash) |
| Alter Arbeitsbaum nach dem Commit | `git status` leer, Dateien bleiben CRLF (266 × `w/crlf`) – bestätigt AR0-28 |
| Paralleler Paketzweig mit eigenem Commit vor der Normalisierung, danach Merge der Normalisierung | ohne Konflikt |
| Frischer Worktree nach der Normalisierung | 267 × `w/lf`, 0 × `w/crlf`; `biome check .` (Biome 2.5.14) Exit 0, «Checked 151 files»; im alten CRLF-Arbeitsbaum «Found 151 errors» |

**Entscheid (Reihenfolge):** Die Normalisierung ist ein **eigener Vorab-Schritt E1-01a** (Vertrag E1-01 §3a) und wird auf `wap-planer` committet, **bevor** irgendein Paket-Worktree der Etappe 1 angelegt wird (auch der von E1-01). Gründe: (1) Konflikte entstünden ohnehin nicht (0 Blobs), aber jeder vor dem Commit angelegte Worktree bliebe CRLF und F5 dort rot, bis seine Arbeitsdateien neu geschrieben werden – bei E1-02a, E1-02b, E1-07 also mitten in der Arbeit; (2) danach entsteht jeder Worktree von Anfang an LF, nur im Arbeits-Checkout werden die Arbeitsdateien einmal neu geschrieben (AR0-89, unten); (3) E1-01 kann F5 dann im eigenen Worktree selbst belegen. Kein `lock-update` nötig, weil kein gesperrter Blob und kein `sha256Lf`-Wert sich ändert.

**Wirkung auf andere Checkouts:** `.gitattributes` wirkt nur in Checkouts eines Zweigs, der die Datei enthält. Haupt-Checkout des Auftraggebers und die übrigen Worktrees der Suite (andere Zweige) sind bis zum Merge nach `main` nicht betroffen und werden nicht angefasst. Nach dem Merge nach `main` (nach Gate B) bleiben ihre Dateien CRLF und `git status` leer, bis Dateien neu ausgecheckt werden; es entsteht kein Diff und keine Pflicht zum Neu-Anlegen. Die Git-Hooks im gemeinsamen Git-Verzeichnis hängen nicht von `.gitattributes` ab.

**Reihenfolge des Commits (AR0-88):** `git add .gitattributes && git add --renormalize . && git diff --cached --name-status` → genau `A .gitattributes` → erst dann `git commit`; jede weitere Zeile → kein Commit, Vorlage an den `architect` (Vertrag E1-01 §3a).

**Arbeitsdateien mit LF neu schreiben (AR0-89, Entscheid des Orchestrators vom 02.10.2026), bevorzugter Weg ohne Neuanlage:** `test -z "$(git ls-files -v | grep -v '^H ')" && git diff --cached --quiet && git diff --quiet && git read-tree HEAD && git checkout-index -a -f -u` (Git Bash), nur durch den Orchestrator und nur als ganze Kette (bricht eine der drei Vorbedingungen mit Exit 1 ab, läuft nichts weiter). Die erste Vorbedingung (AR0-96) verlangt, dass jeder Index-Eintrag in `git ls-files -v` das Kennzeichen `H` trägt: Für Einträge mit `assume-unchanged` (Kleinbuchstabe) oder `skip-worktree` (`S`) melden beide `diff --quiet` Exit 0 trotz lokaler Änderung, und `read-tree HEAD` + `checkout-index -f` überschrieben sie ohne Meldung (Probe des `code-reviewer` Fall C, Spike AR0-96 in §14); ungelöste Konflikte (`M`) fallen ebenfalls heraus. Das ist eine ausdrückliche Ausnahme zu agent-regeln 5 (`git checkout -- .`): Sind alle drei Vorbedingungen erfüllt (nur `H`, Index und Arbeitsbaum sauber), stimmt jede versionierte Datei inhaltlich mit HEAD überein, `checkout-index -f` schreibt also nur die Zeilenenden neu; ignorierte und nicht versionierte Dateien bleiben unberührt. `read-tree HEAD` ist nötig, weil `checkout-index -a -f -u` allein Einträge mit gültigem Stat-Cache überspringt (Probe des `code-reviewer`: danach weiter `266 i/lf w/crlf`). Gilt ebenso für jeden vorbestehenden Paket-Worktree, nachdem dessen Zweig den Commit von E1-01a übernommen hat (Probe in einem verknüpften Worktree: `0 crlf, 267 lf, status 0`, Hauptklon unberührt). Unmittelbar vor der Kette belegt der Orchestrator `git ls-files -v | grep -vc '^H '` → `0` (Stand 762004e: 274 × `H`). Beleg in §14.

**Rückfall: Neu-Anlegen des Arbeits-Checkouts** (Weg AR0-39, ohne `--force`, ohne `reset`/`checkout -- .`), nur wenn der Weg oben scheitert: Vorher sichert der Orchestrator die nicht versionierten Inhalte, die noch gebraucht werden – insbesondere `spikes/umgebungsprobe/` (Prüfseite `umgebungsprobe-3`, SHA-256 aus ADR-006/007, gebraucht für die Neumessung des lokalen Bezugswerts in E1-01, §8) – nach `.qa/etappe0/` im Haupt-Checkout; `git worktree remove` löscht auch ignorierte Ordner, heute `spikes/umgebungsprobe`, `spikes/excel-import`, `spikes/fk2-vite`, `spikes/font-layout`, `spikes/storage` und `node_modules/` (danach `npm ci`).

## 13 Folgen und offene Punkte

- **Folgen:** E1-01 ändert Suite-Dateien (E8) und installiert alle Abhängigkeiten der Etappe 1 (E1, E2). Jede spätere Änderung an `scripts/wap-gate/`, an Konfigurationen, Schwellen, Baseline, Render-Kette und Golden-Manifest geht über `lock-update` mit Grund und erscheint an Gate B. **Sperrzeitpunkt (Entscheid Orchestrator 02.10.2026):** Die Dateien unter `scripts/wap-gate/` und `vitest.wap-gate.config.ts` sperrt der Orchestrator erst beim Merge von E1-01 per `lock-update --add`, nicht beim Test-Freeze von E1-01 (die Konfiguration entsteht in Schritt 2 als Gerüst und wird in der Umsetzung ergänzt, z.B. `globalSetup` mit Node-Prüfung, Vertrag E1-01 §3); beim Freeze gesperrt werden die Tests von E1-01, darunter `tests/wap-harness/pre-commit-gate.harness.ts` (O-5).
- **O-1 Drosselungsfaktor:** erledigt am 01.10.2026: F = 1,5 aus der Umgebungsprobe, `docs/wap-planer/perf/drosselung.json` (Abschnitt 8). Rest: Neumessung des lokalen Bezugswerts in E1-01 unter den Bedingungen des Leistungsprojekts, unabhängig von E4; Sperre nach dem H0-Merge (Abschnitt 8).
- **O-2 Stryker mit Vitest 5.0.1:** Peer-Bereich `>=2.0.0` erfüllt; die Funktion mit Vitest 5 ist erst im Selbsttest von E1-01 belegt. Rückfall: Befehlsläufer (Abschnitt 6.3).
- **O-3 `test:oracle`:** lokal nicht ausführbar (Entscheid E10). **Entschieden an Gate 0 (02.10.2026): E10 a** – Python 3 als Benutzerinstallation ohne Adminrechte; `npm run test:oracle` wird Teil von V10 (§3.2). Offen ist nur, wer installiert (Download ausserhalb der Paketinstallation, Agenten-Regel 4); ohne Python 3 ist V10 rot, damit auch der Merge von E1-01 blockiert.
- **O-4 Abdeckung aus E2E:** Die Zusammenführung Vite-Quellzuordnung → Istanbul ist im Selbsttest von E1-01 an einer Beispielkomponente zu belegen.
- **O-5 H0-Ergänzungen A/B:** vom Orchestrator im laufenden Paket H0 zu entscheiden (die Präzisierungen P13–P26 in `pakete/H0.md` sind bereits vergeben); ohne B gilt die Ersatzlösung `reference-lock.mjs` (7.1). Stand 02.10.2026 (kein Gate-0-Entscheid): H0 ist ohne A und B abgeschlossen. **A entschieden (Orchestrator, 02.10.2026): Variante A-1** (§3.1 «Einbindung», ADR-009 §3 Punkt 11, Vertrag E1-01 §1a): Umsetzung in E1-01; `pre-commit.mjs` ruft `gate.mjs fast --pre-commit` auf, sobald `scripts/wap-gate/gate.mjs` gesperrt ist; beschränkte Ausnahme zu agent-regeln 5 nur für `scripts/wap/pre-commit.mjs` und `tests/wap-harness/pre-commit-gate.harness.ts`, kontrolliert durch `git diff --name-only`, `lock-update --refresh` mit Grund, `code-reviewer` und Gate-B-Liste. Bis zur Sperre nach dem Merge von E1-01 läuft vor einem Commit nur Lock-Prüfung und Datenschutz-Scan (Prompt §7 «vor jedem Commit» ab dann erfüllt). **B offen**; bis dahin Ersatzlösung `reference-lock.mjs`.
- **O-6 Datenschutz ausserhalb der WAP-Pfadmenge:** `privacy-scan` prüft Inhalte nur in der WAP-Pfadmenge (H0 P35, P35b, P35c, P40); übrige Suite-Dateien, Umbenennungen aus der Menge heraus und Suite-Dateien in Merges nur am Pfad (ADR-009 §4). `privacy-deep.mjs` schliesst diese Lücke nach F3, V11 und Abschnitt 10 nicht: es prüft Inhalte von `.xlsx`/`.pdf`/`.docx` (`--staged`) und erzeugte Artefakte (`test-results/wap`), keine Textdateien ausserhalb der Pfadmenge. Ob V11 eine Inhaltsprüfung dieser Dateien braucht (z.B. nur gegen die Sperrliste, mit Positivliste für bekannte Suite-Treffer), entscheidet der Orchestrator; bis dahin gilt die Grenze aus ADR-009 §4. **Entschieden an Gate 0 (02.10.2026, Entscheid 11 b):** V11 prüft zusätzlich alle versionierten Textdateien gegen die Namen der Sperrliste (`privacy-names.mjs`, §3.2 V11, Vertrag E1-01 `scanNames`, Anforderung R-H-34, im Katalog übernommen (Runde 6b)); AHV-Nummern, Telefonnummern und E-Mail-Adressen ausserhalb der Pfadmenge bleiben bei der Grenze aus ADR-009 §4 (Fehlalarme durch fiktive Nummern in Suite-Tests). Der erste Lauf in E1-01 weist die Treffer im Bestand maskiert aus (Pfad, Anzahl); Freigaben nur über `scripts/wap/privacy-allow.txt` per `lock-update` mit Grund, aufgelistet an Gate B. Nach Eskalation 1 (H0 P44) unverändert: Auch die Objekt-Modi `--baum` und `--commits`, die V11 und die Schleuse nach einer Integration jetzt verwenden, prüfen Inhalte nur in der WAP-Pfadmenge (P44 c); sie schliessen die Lücken zu Arbeitsbaum, Index-Flags und Zwischencommits, nicht diese.
- **O-7 Objekt-Modi für `privacy-deep.mjs` (Vorschlag Eskalation 1, Bericht Abschnitt 4.4):** Vertrag E1-01 (`plan/vertraege/E1-01.md` §2) sieht heute `deepPrivacyScan(opts: { cwd: string; staged?: boolean; pfade?: string[] })` vor. Vorschlag: Optionen `baum?`/`commits?` analog H0 P44 ergänzen (Container-Inhalte von `.xlsx`/`.pdf`/`.docx` aus Blobs per `git cat-file`, `--root` bestätigt, `GIT_*` entfernt, `GIT_NO_REPLACE_OBJECTS=1`), damit V11 auch versionierte Container aus Objekten prüft; für `test-results/wap` (nicht versioniert) ohne Pfadmenge alle Inhalte prüfen, weil dort keine Fehlalarme aus Suite-Tests entstehen. Vertrag E1-01 bleibt bis zum Entscheid des Orchestrators unverändert; der Entscheid fällt vor dem Test-Freeze von E1-01.

## 14 Beleg

- Spikes (ADR-003 bis ADR-008): `playwright-core` 1.63 mit Kanal `msedge` (Edge 155.0.4283.24) in `spikes/font-layout/verify-screen.mjs`, `spikes/storage/run.mjs`, `spikes/excel-import/run-browser.mjs`; `pdfjs-dist` 6.3.289 als unabhängiger Leser (`node verify-pdf.mjs` → `textIdentisch 96/96`, `maxAbweichungPt 0`, `schriften … missingFile: false`); CDP-Drosselung ×4 in allen drei Spikes.
- Lizenzen und Versionen (npm-Registry, abgefragt am 30.09.2026): `@playwright/test` 1.63.0 Apache-2.0 ohne Installationsskript; `@vitest/coverage-v8` 5.0.3 MIT, Peer `vitest` exakt gleich; `@stryker-mutator/core` 10.0.0 Apache-2.0, Node ≥ 22; `@stryker-mutator/vitest-runner` 10.0.0 Apache-2.0, Peer `vitest >=2.0.0`; `fast-check` 4.10.2 MIT; `fake-indexeddb` 6.2.5 Apache-2.0; `monocart-coverage-reports` 2.13.0 MIT; `pdfjs-dist` 6.3.289 Apache-2.0 mit optionaler Abhängigkeit `@napi-rs/canvas` ^1.0.0 (1.0.9 MIT, Windows-x64-Binärdatei vorhanden); `immer` 11.1.18 MIT ohne Laufzeit-Abhängigkeiten; `hyphen` 1.14.1 ISC mit Mustern `de`/`de-1996`; `axe-core` 4.13.0 MPL-2.0. Trennmuster hyph-de-1996 (Quelle `hyphenation/tex-hyphen`): Kopf «Copyright (c) 2013-2024 … License: MIT».
- Spike AR0-89 (02.10.2026, Stand `wap-planer` 762004e; Wegwerf-Klon im Scratchpad des architect, kein Netz): `git clone -q --no-hardlinks --branch wap-planer <Arbeits-Checkout> repo`, `core.hooksPath` ins Leere; vorher `git ls-files --eol` → `267 w/crlf`, `6 w/none`, `1 w/-text`; `.gitattributes` nach Vertrag E1-01 §3a; `git add .gitattributes && git add --renormalize . && git diff --cached --name-status` → `A .gitattributes` (einzige Zeile); Commit; ignorierte bzw. nicht versionierte Proben `spikes/probe.txt`, `node_modules/x/a.txt`, `unversioniert.txt`; `git diff --cached --quiet && git diff --quiet && git read-tree HEAD && git checkout-index -a -f -u` → `268 w/lf`, `6 w/none`, `1 w/-text`, 0 × `w/crlf`; `git status --porcelain` → nur `?? unversioniert.txt`; alle drei Proben vorhanden; `node scripts/wap/lock-check.mjs --root .` → «Lock-Prüfung: 28 Dateien in Ordnung»; nach einer Änderung an `README.md` bricht die Kette bei `git diff --quiet` mit Exit 1 ab. Bestätigt die Probe des `code-reviewer` (Bericht Gate-0-Nachprüfung, `biome check .` danach Exit 0, verknüpfter Worktree ebenso).
- Spike AR0-87 (02.10.2026, Scratchpad, kein Netz): `python --version` → `Python 2.7.18` (`C:\Python27\python.exe`); `python3 --version` → Exit 9009 (App-Ausführungsalias `WindowsApps`); `py` → ENOENT; Benutzer-PATH: `C:\Python27` an Position 5, `…\Microsoft\WindowsApps` an Position 7; Mini-Projekt mit Skript `"v": "python --version"`: `npm run -s v` → `Python 2.7.18`; derselbe Aufruf mit einem Ordner mit gefälschtem `python.cmd` («Python 3.13.0») vorne im PATH → `Python 3.13.0 FAKE`, Exit 0. Damit wirkt der vorangestellte Ordner in `npm run` wie in `checkPython` vorgesehen.
- Spike AR0-97 (02.10.2026, kein Netz): Der frühere Probe-Befehl `python -c "import sys; print(*sys.version_info[:3]); print(sys.executable)"` endet unter dem lokalen Python 2.7.18 mit `SyntaxError: invalid syntax`, Exit 1 (echtes 2.7 also fälschlich als `exit` statt `version<3`). Der neue Probe-Befehl (Vertrag E1-01 §2 `PYTHON_PROBE`) `python -c "import sys; sys.stdout.write('%d %d %d\n%s\n' % (sys.version_info[0], sys.version_info[1], sys.version_info[2], sys.executable))"` → Exit 0, Ausgabe `2 7 18` / `C:\Python27\python.exe`; über `spawnSync` aus Node 24.15.0 (ohne Shell): `python` Status 0, stdout `"2 7 18\r\nC:\\Python27\\python.exe\r\n"` (CRLF, daher Trennung an `/\r?\n/`); `python3` Status 9009, stdout leer; `py -3` → `ENOENT`.
- Spike AR0-101/AR0-102 (02.10.2026, Node 24.15.0, Scratchpad des architect, kein Netz, danach gelöscht; Vertrag E1-01 §2, §6c): `PYTHON_PROBE` als `String.raw`-Literal → 128 Zeichen, kein CR/LF, Backslash+n 2-mal, SHA-256 `0585f6c7a1ea95689fe60773b3022b821f6a32e0f69f523d460de3142695e68c`, gleich dem Literal mit `\\n`; gegen das echte Python 2.7.18 über `spawnSync` ohne Shell → Status 0, `"2 7 18\r\nC:\\Python27\\python.exe\r\n"`. Fälschung als echtes Programm: `fake.cs` (C# 5) mit `%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe -nologo -out:fake.exe fake.cs` → Exit 0, 102 ms, 5 120 Bytes; Kopien `python.exe` (2.7), `python3.exe` (Exit 9009), `py.exe` (erwartet `-3`, meldet 3.13.0) in einem Ordner, `env = { PATH: <Ordner> }`, `spawnSync(<name>, args, { shell: false })`: `python -c PROBE` → 0, `"2 7 18\r\n…\r\n"`; `python3` → 9009; `py -3 -c PROBE` → 0, `"3 13 0\r\n<py3>\\python.exe\r\n"`; `py -c PROBE` → 2; absoluter Pfad (WAP_PYTHON) → 0; fehlende Datei → `ENOENT`; Probe mit echten Zeilenumbrüchen → 2 (von der Fälschung abgewiesen); Fälschung nur im cwd, nicht in PATH → `ENOENT` (libuv durchsucht das cwd nicht); PATH = `<py3>;<Ordner>` (V10-Umgebung) → `python` meldet 3.13.0, mit leerem Ordner vorne → 2.7.18; `npm run -s v` mit `"v": "python --version"` → V10-Umgebung stdout `Python 3.13.0`, ohne → stderr `Python 2.7.18`; doppelte Schlüssel `Path`/`PATH` in `env` → libuv nimmt unabhängig von der Reihenfolge der Schlüssel denselben Eintrag (Grund für `oracleUmgebung` mit genau einem Schlüssel); Gegenprobe zum alten §6c: `python.cmd` über PATH ohne Shell → `ENOENT`, direkt → `EINVAL`. Fälschung ohne `SystemRoot` in `env` → läuft (Status 0).
- Spike AR0-96 (02.10.2026, Stand `wap-planer` ac7d6f3; Wegwerf-Klon im Scratchpad des architect, `core.autocrlf=true`, Hooks ins Leere, kein Netz, danach gelöscht): vorher `267 w/crlf`; `.gitattributes` nach Vertrag E1-01 §3a, `git diff --cached --name-status` → `A .gitattributes`, Commit 1 Datei. Kette `test -z "$(git ls-files -v | grep -v '^H ')" && git diff --cached --quiet && git diff --quiet && git read-tree HEAD && git checkout-index -a -f -u` in `bash -c`: Fall C (`README.md` lokal geändert, `git update-index --assume-unchanged`) → `git ls-files -v` zeigt `h README.md`, `git diff --quiet` Exit 0, **Kette Exit 1**, Änderung erhalten; Fall D (`package.json` lokal geändert, `--skip-worktree`) → `S package.json`, `git diff --quiet` Exit 0, **Kette Exit 1**, Änderung erhalten; Normalfall (Kennzeichen aufgehoben, Dateien wiederhergestellt; `git ls-files -v`: 0 × nicht-`H`, 275 × `H`; Proben `spikes/probe.txt`, `node_modules/x/a.txt`, `unversioniert.txt`) → Kette Exit 0, `0 w/crlf`, `268 w/lf`, `git status --porcelain` nur `?? unversioniert.txt`, alle Proben vorhanden; Fall A (`README.md` geändert, ohne Kennzeichen) → Kette Exit 1, Änderung erhalten.
- Lokale Umgebung: `python --version` → `Python 2.7.18`; Edge-Installationsordner `155.0.4283.24`; `node --version` global `v22.19.0` (F-001).
- `.gitignore` der Suite: Muster `*.csv`, `*.xlsx`, `FDT_*.json`, `*_FDT_*.json` (Zeilen 1–10).
- Hook-Sperre `scripts/wap/**`: `pakete/H0.md` Präzisierung P2.
- Spike E11 (§12.3, 02.10.2026, Stand `wap-planer` 6730073; Wegwerf-Klon im Scratchpad des architect, nur Repo-Inhalt, kein Netz): `git clone --shared --branch wap-planer <Arbeits-Checkout> repo`; dort Paketzweig `wap/parallel` mit einem Commit; `.gitattributes` gemäss Vertrag E1-01 §3a (ohne `*.jpg`, `*.ico`, `*.docx`, `*.woff2`, die im Repo nicht vorkommen); `git add .gitattributes && git add --renormalize .` → `git diff --cached --name-status` = `A .gitattributes`; `git diff --name-only <vorher> <nachher> | grep -v .gitattributes | wc -l` → `0`; Blob-Vergleich aller 28 Einträge von `test-lock.json` → `28 Eintraege, 0 mit anderem Blob`; `git status --porcelain | wc -l` im alten Arbeitsbaum → `0`; `git merge --no-ff wap-planer` auf `wap/parallel` → ohne Konflikt; `git worktree add --detach ../frisch <nachher>` → `git ls-files --eol`: `267 w/lf`; `biome check .` (2.5.14) im frischen Worktree → Exit 0 «Checked 151 files», im alten → «Found 151 errors»; `node scripts/wap/lock-check.mjs --root .` im alten und im frischen Worktree → je «Lock-Prüfung: 28 Dateien in Ordnung».


## Änderungsnotiz AE-001 (04.10.2026, `architect`): Werkzeuge je Inkrement, Regelung E1-07-03

Grundlage ist `auftragsaenderungen/AE-001.md` §2; bei Widerspruch gilt diese Notiz. Die Pakete stehen im Plan Etappe 1 (Notiz), die Einzelheiten im Vertrag E1-01 (Notiz). Schwellwerte bleiben unverändert und gelten ab Einführung des jeweiligen Instruments.

**1 Werkzeuge je Inkrement**
- **E1-01-min, schnelle Schleuse:** F1–F9 und Rot-Phase §3.3.
  - `--pre-commit` beginnt mit `F0-arbeitsbaum`; F2 und der H0-Teil von F3 entfallen, weil `pre-commit.mjs` beide davor ausführt.
  - F10 Lizenzen kommt erst mit E1-01e.
- **E1-01-min, volle Schleuse:** F1–F9, V1, V1a (inkl. Selbsttest-Teil in jeder vollen Schleuse; Wiederverwendung nur nach Q-020), V3, V9, V10 mit `test:oracle` über `py -3` (PATH nur im Kindprozess) und V11.
- **Spätere Scheiben:**
  - E1-01b (I1): V4 und PDF-Ebene 2 mit Bildvergleich.
  - E1-01c (I2): V6, V7, Barrierefreiheit, Offline.
  - E1-01d (gleich nach Gate S): V5.
  - E1-01e (vor Gate B): V2, V8, F10.
  - Jede Scheibe nimmt ihren Schritt per `lock-update` in `gate.mjs` auf und bringt einen eigenen Selbsttest mit.
- **Selbsttests S6/S7 (Abweichung von §3.5):** S6 belegt zuerst E1-01b mit `[R-H-19]`; bei M2 wiederholt der Orchestrator ihn gegen das Produkt-Layout. S7 folgt mit E1-02g.
- **V9:** Pflicht sind nur die Berichte der eingeführten Schritte; ein fehlender Pflichtbericht ist rot.
  - E1-01-min: `vitest.json`, `vitest-gate.json`, `vitest-harness.json`, `vitest-selbsttest.json`, `vitest-reference.json`.
  - E1-01b und c: zusätzlich `playwright.json`.
  - E1-01d: zusätzlich `vitest-golden.json`.
- **Sperre der Konfigurationen:** Beim Merge einer Scheibe sperrt der Orchestrator ihre Skripte und Konfigurationen per `lock-update --add`; ihre Tests sperrt er beim Freeze.
  - F7 ist zusätzlich rot, wenn eine Datei `vitest.wap*.config.ts`, `playwright.wap.config.ts`, `stryker.wap.conf.mjs` oder `tsconfig.wap.json`, die schon in `git merge-base HEAD wap-planer` existiert, nicht gesperrt ist.
- **§4.5:** `*.selbsttest.ts` mit `vitest.wap-selbsttest.config.ts` gehört zur Zeile «Schleusen und Harness».

**2 Regelung E1-07-03**
- **Ursache: CPU-Überbelegung, keine Wettlaufsituation.**
  - Vitest 5 startet ohne Vorgabe 19 Worker (20 logische Kerne); alle roten Fälle sind Zeitüberschreitungen (5 s).
  - Standard-Workerzahl: ohne Last 0 rot (längster Test 3,8 s), mit 10 bzw. 20 Lastprozessen 2 bzw. 7–8 rot, zwei parallele Läufe je 4 rot.
  - 4 Worker: ohne Last 1,9 s, mit 10 Lastprozessen 3,9 s, gemischt 4,25 s, zwei parallele Läufe 2,2 s, drei 4,55 s, jeweils 0 rot; mit 20 Lastprozessen 1 rot.
  - Einzeln laufen die Tests in höchstens 1,4 s (`architect-r9/auswertung.mjs`).

- **Feste Workerzahl:** `testUmgebung` setzt `VITEST_MAX_WORKERS`.
  - Vitest: `4`.
  - Selbsttest-Teil: `1`. Die Variable übersteuert `fileParallelism: false`.
  - Stryker: Variable entfernt; der Läufer setzt selbst `maxWorkers: 1`, dazu `concurrency: 4`.
  - Konfigurationen: `maxWorkers: 4`; ausgenommen sind `vitest.wap-harness.config.ts` (gesperrt) und `vitest.wap-selbsttest.config.ts` (1).
  - Playwright `--workers=2`, für `perf` 1.
  - Suite-Dateien und Timeouts bleiben unverändert.
- **Exklusive Belegläufe:** volle Schleuse, Selbsttest, Stabilitätslauf und `wap:gate:fast` von Hand.
  - Sie belegen die Sperre `<git-common-dir>/wap-gate/sperre.json`. Ist sie belegt, ist der Lauf sofort rot; mit `--warten` wartet er.
  - `--pre-commit` prüft nur die Sperre, ohne F0-last.
  - Reihenfolge: F1, dann Sperre, dann F0-last.
- **F0-last:** Prüft auf fremde Test-, Build- und Browserprozesse sowie auf CPU-Last über 25 % beim Start. Während der vollen Schleuse prüft er alle 60 s erneut auf fremde Prozesse.
  - Funde sind rot. Ausgegeben werden nur Anzahlen und PIDs; nichts wird wiederholt.
  - CPU-Last, die erst während des Laufs entsteht, deckt nur das Profil «Grenzlast» ab.
- **Stabilitätslauf (R-H-18):** Suite-`npm test` und WAP-Vitest je 3 × «normal» und 3 × «Grenzlast» (⌈25 % der Kerne⌉ Lastthreads im eigenen Prozess). Jede Abweichung ist blockierend.
- **Parallelität:** Höchstens zwei Testläufe der Agents gleichzeitig; keiner während eines Beleglaufs (agent-regeln Regel 5).
- **«Behoben»:** Der Orchestrator weist exklusiv nach:
  - 10 × `VITEST_MAX_WORKERS=4 npx vitest run`: 0 rot, längster Test ≤ 2,5 s;
  - 5 × derselbe Lauf mit `grenzlast.mjs 5 120`: 0 rot, längster Test ≤ 4,0 s.
  - «Verifiziert» erst nach dem Merge von E1-01-min, mit V10 und Stabilitätslauf grün und Last-/CPU-Protokoll je Lauf (CR-AE001-11).
- **Beleg:** Spike `architect-r9/spike-maxworkers` (Vitest 5.0.1, Zählung der `VITEST_POOL_ID`):
  - ohne Vorgabe 19 Worker;
  - `VITEST_MAX_WORKERS=4` 4 Worker, auch mit `--maxWorkers=8` und über `npm run check`;
  - `--no-file-parallelism` 1 Worker, mit der Variable `4` aber 4.

## Änderungsnotiz E1-01-25 (04.10.2026, Orchestrator): Rot-Phase bei Eigenschaftstests

- Ergänzung zu §3.3: Bei fast-check-Eigenschaftstests zählt allein der eingebettete ursprüngliche Fehler, und zwar nur die erste Zeile `Got …` direkt nach `Shrunk … time(s)` in einem Bericht der festen Form (`Property failed after …`, `{ seed: … }`, `Counterexample: …`). Fachlich rot sind nur `Got AssertionError…`, `Got error: nicht implementiert: <name>` mit `<name>` aus «Stub-Namen» des laufenden Pakets und `Got error: Property failed by returning false` (verletzte Eigenschaft, gleichwertig zur Assertion). Alles andere, auch eine abweichende Form oder mehrere `Shrunk`-Zeilen, ist nicht fachlich rot (fail-closed).
- Voraussetzung: die WAP-Vitest-Hilfe setzt `includeErrorInReport: true` (fast-check 4); WAP-Tests überschreiben diese globale Einstellung nicht.
- Belege: Befund E1-01-25, Tests `tests/wap-gate/red-phase-eigenschaft.{gate,selbsttest}.ts`, Prüfberichte `.qa/e1-01/nachtrag-fastcheck/`.

## Änderungsnotiz E1-01c (07.10.2026, Orchestrator, AE-004): getrennte Playwright-Berichte

Vertrag E1-01c §2.1 und §6 Nr.8 präzisieren die Pflichtberichte für V9. Ein Pflichtbericht je Projektgruppe gilt nur, wenn die aktuelle Playwright-Testliste dort Tests nennt: funktionale Projekte verwenden `test-results/wap/playwright.json`, `chromium-visual` verwendet `test-results/wap/playwright-visual.json`, `perf` verwendet `test-results/wap/playwright-perf.json`. F9 listet weiterhin alle Projekte. Eine leere Gruppe verlangt keinen zusätzlichen Pflichtbericht; sie ist kein Grund, bestehende Tests oder Berichte anderer Gruppen auszunehmen.

V6 meldet fehlende Baselines und weitere Bildfehler gemeinsam, falls beide Ursachen vorliegen. Der Baseline-Befehl schreibt seine Änderungsprotokollzeile nur bei tatsächlichem Erfolg ohne Läuferfehler. V7-perf und V7-vergleich bleiben getrennte Schritte; Budgets und Regressionstoleranzen bleiben unverändert. Die nach Vertrag §6 vorgeschriebene lokale Bezugsneumessung und ihre notwendige dokumentierte Kalibrierung sind ein eigener Abnahmebeleg; ein Core-Checkpoint ist noch keine vollständige Abnahme. Unabhängiges Claude-Review nach AE-004 ausstehend.

## Änderungsnotiz R-H-36 / E1-01i (Auftraggeber 08.10.2026)

Der neue wörtliche Entscheid in auftragsaenderungen/steuerung-2026-10-08.md geht für V1a-selbsttest der bisherigen Wiederverwendungsbeschreibung vor. Dieser eine Schritt läuft echt, wenn git diff --name-only -z --no-renames gegen den letzten wirklich grünen Selbsttest-Commit eine Änderung in einem der vier benannten Verzeichnisse oder einer Gate-/Vitest-/Playwright-Konfiguration zeigt, an Gate B und bei fehlendem/ungültigem/rotem Beleg oder Gitfehler. Sonst steht WIEDERVERWENDET <commit> im Schrittbericht und als ausdrücklicher neuer Dokumenteintrag in der vorhandenen Claude-Review-Warteschlange. Produkt-/Dokumentdirty allein ist keine Sperre. Ein frischer Lauf erzeugt keinen falschen HEAD-Beleg, wenn relevante uncommittierte Eingaben geprüft wurden. V1a-gate/harness und alle übrigen Full-Schritte bleiben unverändert. Keine Hashes von Gesamtbaum, Abhängigkeiten, Browser, Node oder Referenzen; keine neue CLI-Option. Vertrag E1-01i präzisiert nur die erforderlichen Beleg-/Fehlergrenzen.
