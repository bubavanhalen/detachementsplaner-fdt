# Plan Etappe 1 – Kern: Erfassen, PDF, eigener Import

- **Status:** Runde 6 (02.10.2026): Nachführung nach dem **Gate-0-Entscheid vom 02.10.2026** (= Gate A der Etappe 1 erteilt; Antwort wörtlich in `PROGRESS.md` Freigabeprotokoll: alle Empfehlungen angenommen, Nr 12 zurückgestellt). Runde 5 (01.10.2026) war nach Planprüfung PL0-01 bis PL0-38 und Architekturprüfung AR0-01 bis AR0-51 freigegeben. Änderungen in Runde 6: Vorab-Schritt E1-01a (Zeilenenden, E11 a), R-H-34 (Entscheid 11 b) in E1-01, R-L-09 (Hinweis gemeinsamer Speicher, Folge von Entscheid 2 = G-9 a) in E1-11, Regel 4 gruppiert (Entscheid 7 b) in E1-08, R-11-10 nur am PDF (Entscheid 1, G-7 a), Status aller offenen Punkte (Abschnitt 8). R-H-34 und R-L-09 sind im Katalog übernommen (Runde 6b); Zuordnung vom `spec-auditor` geprüft (Anhang C). Nachführung nach der Prüfung von Gate 0 (AR0-87 bis AR0-93, SA0-31, SA0-33): Python-Prüfung vor `test:oracle` (R-20, Vertrag E1-01 §2 `checkPython`, §6c), Reihenfolge und Neuschreiben der Arbeitsdateien in E1-01a (§3, M0, R-18), Tastenkürzel-Knopf in E1-11, Katalog-IDs für UI-F-3, UI-F-7, UI-F-10. **Nachführung 02.10.2026 (Entscheide Orchestrator):** H0-Ergänzung A Variante A-1 in E1-01 (§4.1, P-7); Sperre von `vitest.wap-gate.config.ts` erst beim Merge von E1-01 (§4.1); E1-02b Schritt 7 nach dem Merge von E1-02a (§3, Befund E1-02b-02); Zeichenprüfung (AR0-13) in E1-02b statt E1-02a (§4.2, §4.3, Befund E1-02a-03). **Nachführung Katalog Runde 6d (02.10.2026):** R-L-11 (gemeinsames XLSX-Lesemodul, Vertrag E1-07 §3 P13) in E1-07 (§2, §4.12, Anhang B); R-H-23 mit erweitertem Kriterium (2) – Lizenztexte in der ausgelieferten Einzeldatei, Befund E1-02b-03 – in E1-01 (§4.1, Anhang B); Etappe 1 = 432 (Anhang C). **Runde 7 (02.10.2026, Planänderung nach Gate A, Entscheid Orchestrator zum Schnitt der Pakete, Prompt §5.4):** Die Verweis-IDs R-4.9-17 (Ziel R-4.7-05) und R-5.4-08 (Ziele R-4.9-01, -03, -05, -07, -09, -11, -13, -16, -17) wechseln von E1-02a nach **E1-02e**. Grund: Ihre Ziele liegen in E1-02e (ausser dem früher eingefrorenen R-4.9-13); die Rückverfolgbarkeit (ADR-010 §5 Regel 3) wäre sonst beim Merge von E1-02a und in jeder schnellen Schleuse bis zum Merge von E1-02e rot. Vorbild R-14.2-02 (E1-02e, Verweis R-4.7-05); Grundlage Vertrag E1-02a P-18. Keine Ausnahmeregel im Trace-Werkzeug. Geändert: §2 (E1-02a 56 → 54, E1-02e 76 → 78), §4.2, §4.6, R-03, Anhang A, Anhang C (Summe 432 unverändert); `vertraege/E1-02e.md`, `pakete/E1-02a.md`.
- **Grundlage:** Beschrieb 13 (Etappe 1) und 14; `requirements.md` Stand nach Gate 0 (02.10.2026; Runde 6b: 570 IDs, Etappe 1 = 429 = 395 + 25 R-H + 9 R-L mit R-H-34 und R-L-09; nach SA0-33 zusätzlich R-5.6-18 und R-L-10: Katalog 572 IDs, Etappe 1 = 431; Runde 6d mit R-L-11: **Katalog 573 IDs, Etappe 1 = 432** = 396 aus dem Beschrieb + 25 R-H + 11 R-L; `plan/katalog-ergaenzung-e1.md`); Prompt §5.2, §5.3 Punkt 1 und 2, §5.6, §6, §7; ADR-001 bis ADR-010 (an Gate 0 entschieden); `pakete/H0.md`; `standardaufgaben.md`; `glossar.md`; `ui-richtlinie.md`; `QUESTIONS.md` (Q-006 bis Q-012 an Gate 0 entschieden); FINDINGS F-001 bis F-003.
- **Verträge:** `plan/vertraege/<paket>.md` und `plan/vertraege/_konventionen.md` (Entwürfe; Stubs entstehen je Paket in Prompt §5.2 Schritt 2 nach Gate 0).
- **Maschinenlesbare Zuordnung:** Anhang A (Katalog-IDs) und Anhang B (Werkzeug- und Leitplanken-IDs; Übernahme in den Katalog über `plan/katalog-ergaenzung-e1.md`), feste Spaltenfolge `| ID | Paket | Testart | Verweis auf | Hinweis |`, gelesen von `scripts/wap-gate/trace.mjs` (ADR-010 Abschnitt 5).

## 1 Grundsätze des Schnitts

0. **Vorab-Schritt E1-01a «Zeilenenden»** (Gate-0-Entscheid 4 a = E11 a): `.gitattributes` für das ganze Repo als eigener Commit auf `wap-planer`, **vor** dem Anlegen irgendeines Paket-Worktrees der Etappe 1; danach schreibt der Orchestrator die Arbeitsdateien des Arbeits-Checkouts einmal mit LF neu (`read-tree HEAD` + `checkout-index -a -f -u` bei sauberem Index und Arbeitsbaum, AR0-89; Rückfall Neuanlage) (ADR-010 §12.3, Vertrag E1-01 §3a). Die Normalisierung ändert keinen Blob (Spike), also keine Konflikte und kein `lock-update`.
1. **Paket 1 «Werkzeugkette und Schleusen» (E1-01)** zuerst, ohne Fachlogik, abgenommen per Selbsttest mit den fünf Verstössen aus Prompt §5.3 Punkt 2 (ADR-010 Abschnitt 3.5, S1–S5). **Vorbedingung:** Die IDs aus `plan/katalog-ergaenzung-e1.md` (R-H-10 bis R-H-33, R-L-01 bis R-L-08, alle übernommen, R-L-08 in Katalog Runde 5) stehen im Katalog, bevor E1-01 Schritt 3 (Tests) beginnt; `trace.mjs` liest nur den Katalog (PL0-17).
2. **Paket 2 «Durchstich» (E1-02a bis E1-02f)**: Datenmodell → Layout-Schicht → PDF und Bildschirm für die KVK-Woche aus einem von Hand erfassten, pseudonymisierten Fixture; Schrift, Linien, Farben, Seitenleiste und Terminbereich echt. Die KVK-Fixture und der synthetische Plan entstehen im ersten Teilpaket (E1-02a), damit die Seitenpakete die Referenzwoche früh prüfen (Früherkennung der Rückfallregel, Prompt §5.4). Der Durchstich endet mit der Nachprüfung von S6 und S7 und mit **Gate S**.
3. **Vor Gate S** laufen neben dem Durchstich nur optikunabhängige Pakete: E1-03 bis E1-09. Wo ein Test Layout-Ergebnisse liest (P8 in E1-06, R-14.3-03 in E1-08), steht «Gate S» im Hinweis; ändert Gate S die Schriftgrössen, laufen diese Tests erneut.
4. **Nach Gate S** folgen die optikabhängigen Pakete E1-10 bis E1-17, danach E1-AB.
5. **Jede ID der Etappe gehört genau einem Paket** (Anhang A, Prüfung Anhang C). Ein Test trägt nur IDs seines Pakets oder bereits eingefrorener Pakete (ADR-010 Abschnitt 5 Regel 2). Ein Test eines späteren Pakets darf die ID eines eingefrorenen Pakets zusätzlich nennen, wenn er auch eine eigene ID trägt (Beispiele: Befund-Teil von R-5.1-18 in E1-06, Undo des Imports R-5.6-14 in E1-08).
6. **Akzeptanz-IDs** liegen im Paket, das die Eigenschaft zuletzt ermöglicht, damit ihr Test vor der Umsetzung rot ist. Querschnitts-IDs in E1-17 erhalten einen Rot-Nachweis per Mutation (ADR-010 Abschnitt 4.3, Entscheid E6).
7. **Abhängigkeiten nur nach unten** (Modulgrenzen ADR-001 und ADR-010 §4.4). Parallele Pakete haben disjunkte Dateimengen (Abschnitt 4). Gemeinsam genutzte Dateien ändert nur ein Paket: `package.json`/`package-lock.json` nur E1-01; Baseline, Golden-Manifest und Render-Kette nur der Orchestrator per `lock-update`; es gibt keine gemeinsamen Sammeldateien (`index.ts`) unter `src/model/wap/commands/` – jedes Paket importiert Befehlsdateien direkt.
8. **Testorte** folgen der Tabelle in ADR-010 Abschnitt 5; jedes Paket besitzt die Testordner seiner IDs (Abschnitt 4).
9. **Zweig und Worktree:** Paket `E1-03` → Zweig `wap/e1-03`, Worktree `C:\Users\phili\source\repos\wap-wt\e1-03`, Checkliste `pakete/E1-03.md` (Prompt §5.2).

## 2 Paketliste

«vor S» = darf vor Gate S laufen. «parallel mit» nennt Pakete ohne gegenseitige Abhängigkeit und mit disjunkter Dateimenge (symmetrisch).

| Paket | Titel | IDs | hängt ab von | vor S | parallel mit | Vertrag |
| --- | --- | ---: | --- | --- | --- | --- |
| E1-01a | Vorab-Schritt: Zeilenenden (`.gitattributes`, Arbeitsdateien mit LF neu schreiben) | 0 | H0 gemergt, Gate 0 Nr 4 (entschieden a) | ja | – (vor allen Paket-Worktrees) | `vertraege/E1-01.md` §3a |
| E1-01 | Werkzeugkette und Schleusen | 2 (+ 23 R-H) | E1-01a, Gate 0 (E1, E4 b, E8, E10 a, Nr 11 b; entschieden), Katalog-Ergänzung (inkl. R-H-34) | ja | E1-02a, E1-02b, E1-07 (diese nur bis Schritt 4; ihr Merge erst nach E1-01) | `vertraege/E1-01.md` |
| E1-02a | Durchstich: Datenmodell-Kern, Kp-Vorlage, KVK-Fixture, synthetischer Plan | 54 | E1-01 | ja | E1-01 (bis Schritt 4), E1-02b, E1-07 | `vertraege/E1-02a.md` |
| E1-02b | Durchstich: Schrift und Textsatz | 1 (+ 1 R-L) | E1-01; Schritt 7 erst nach Merge E1-02a (`errors.ts`, Abschnitt 3) | ja | E1-01 (bis Schritt 4), E1-02a, E1-07 | `vertraege/E1-02b.md` |
| E1-02c | Durchstich: Seitenmodell, PDF-Schreiber, Bildschirm-Zeichner | 3 (+ 3 R-L) | E1-02a, E1-02b | ja | E1-03, E1-07 | `vertraege/E1-02c.md` |
| E1-02d | Durchstich: Layout Raster und Einträge | 40 (+ 1 R-L) | E1-02a, E1-02b, E1-02c | ja | E1-03, E1-04, E1-07 | `vertraege/E1-02d.md` |
| E1-02e | Durchstich: Layout Seite und PDF-Konformität | 78 | E1-02d | ja | E1-03, E1-04, E1-05, E1-07 | `vertraege/E1-02e.md` |
| E1-02f | Durchstich KVK: Wochenansicht, Parität, Golden, S6/S7, Gate-S-Vorlage | 4 (+ 1 R-H) | E1-02e | ja | E1-03, E1-04, E1-05, E1-06, E1-07 | `vertraege/E1-02f.md` |
| E1-03 | Befehle, Beso-Nummerierung | 25 | E1-02a | ja | E1-02c, E1-02d, E1-02e, E1-02f, E1-07 | `vertraege/E1-03.md` |
| E1-04 | Speicherung, Undo, Wiederherstellung, Plan-Datei | 5 (+ 1 R-H, + 1 R-L) | E1-03, E1-05 (Port `StandStore`, `Clock`) | ja | E1-02d, E1-02e, E1-02f, E1-06, E1-07 | `vertraege/E1-04.md` |
| E1-05 | Stand (atomar) und Dateiname | 11 | E1-02a, E1-03 | ja | E1-02e, E1-02f, E1-06, E1-07, E1-09 | `vertraege/E1-05.md` |
| E1-06 | Prüfregeln P1, P8, P16, P17 und Befunde | 8 | E1-03, E1-02e | ja | E1-02f, E1-04, E1-05, E1-07, E1-08, E1-09 | `vertraege/E1-06.md` |
| E1-07 | Gemeinsames XLSX-Lesemodul (Tagesbefehl-Regression) | 1 (+ 1 R-L) | E1-01a, Gate 0 (ADR-008, E12 c; entschieden) | ja | E1-01 (bis Schritt 4), E1-02a bis E1-02f, E1-03, E1-04, E1-05, E1-06, E1-09 | `vertraege/E1-07.md` |
| E1-08 | Excel-Import Kp, Bericht, Listen-Export | 48 | E1-07, E1-03, E1-04, E1-02e, E1-05 (PL0-30) | ja (R-14.3-03: Gate S) | E1-06, E1-09 | `vertraege/E1-08.md` |
| E1-09 | Personenliste aus Datei | 2 | E1-02a, E1-04, E1-02f | ja | E1-05, E1-06, E1-07, E1-08 | `vertraege/E1-09.md` |
| — | **Gate S** | – | E1-02f | – | – | `gates/gate-S.md` |
| E1-10 | Layout- und PDF-Ergänzungen (Status, Leitung geteilt, offenes Ende, A3, Unterschrift) | 9 | Gate S, E1-02f | nein | E1-11 bis E1-16 | `vertraege/E1-10.md` |
| E1-11 | App-Rahmen, Erststart, Wochen, Datei, Speicheranzeige | 25 (+ 3 R-L) | Gate S, Gate-0-Entscheide zu Q-009 und ADR-001 (entschieden: G-1, G-2, S-1 bis S-7), E1-02f, E1-04, E1-05 | nein | E1-10 | `vertraege/E1-11.md` |
| E1-12 | Raster: Auswahl, Zellzeiger, Erfassen, Direktbearbeitung, Feldbausteine, Detail | 18 | E1-11, E1-03 | nein | E1-10, E1-15, E1-16 | `vertraege/E1-12.md` |
| E1-13 | Raster: Verschieben, Mehrfachauswahl, Kopieren, Eintragsaktionen | 8 | E1-12 | nein | E1-10, E1-14, E1-15, E1-16 | `vertraege/E1-13.md` |
| E1-14 | Seitenfeld, Tag- und Plan-Einstellungen | 16 | E1-12, E1-03, E1-09 | nein | E1-10, E1-13, E1-15, E1-16 | `vertraege/E1-14.md` |
| E1-15 | Listenansicht | 4 | E1-11, E1-08 | nein | E1-10, E1-12, E1-13, E1-14, E1-16 | `vertraege/E1-15.md` |
| E1-16 | Abläufe: Befunde, Stand, PDF-Ausgabe, Import, Wiederherstellung, Offline | 18 | E1-11, E1-05, E1-06, E1-08 | nein | E1-10, E1-12, E1-13, E1-14, E1-15 | `vertraege/E1-16.md` |
| E1-17 | Querschnitt: Sprache, Tastatur, Fokus, Kontrast, Tablet, Netz, Leistung gesamt, Bearbeitungssperre | 10 (+ 1 R-L) | E1-10 bis E1-16 | nein | – | `vertraege/E1-17.md` |
| E1-AB | Abnahmevorbereitung und Nacharbeit 14.1 | 6 | alle | nein | – | `vertraege/E1-AB.md` |

Summe (per Skript, Anhang C): 396 Beschrieb-IDs in Anhang A (2+54+1+3+40+78+4+25+5+11+8+1+48+2+9+25+18+8+16+4+18+10+6) und 36 Werkzeug- und Leitplanken-IDs in Anhang B (R-H-10 bis R-H-34, R-L-01 bis R-L-11) = **432**. R-H-34 (Gate-0-Entscheid 11 b) und R-L-09 (Folge von Gate-0-Entscheid 2) sind im Katalog übernommen (Runde 6b); R-5.6-18 (Q-009 UI-F-10) und R-L-10 (Leitplanke 6, ADR-006 Punkt 2c) kamen nach der Prüfung von Gate 0 dazu (SA0-33), beide E1-11; R-L-11 (Vertrag E1-07 §3 P13, Katalog Runde 6d) gehört zu E1-07 (Anhang C: 432 = 432). Runde 7: R-4.9-17 und R-5.4-08 (Verweis) von E1-02a nach E1-02e (Abschnitt 4.2, 4.6; Summe unverändert 432).

## 3 Reihenfolge, Parallelität, Meilensteine

Abhängigkeiten vor Gate S (Pfeil = «hängt ab von»; Merge aller Pakete erst nach E1-01):

```
E1-01a ← H0, Gate 0                    (Commit auf wap-planer, Arbeitsdateien mit LF neu geschrieben)
E1-01  ← E1-01a                        E1-07  ← E1-01a (Worktree erst nach E1-01a)
E1-02a ← E1-01                         E1-02b ← E1-01; Schritt 7 ← Merge E1-02a (errors.ts)
E1-02c ← E1-02a, E1-02b                E1-03  ← E1-02a
E1-02d ← E1-02a, E1-02b, E1-02c        E1-04  ← E1-03, E1-05
E1-02e ← E1-02d                        E1-06  ← E1-03, E1-02e
E1-02f ← E1-02e   (M2: S6, S7 → Gate S)
E1-05  ← E1-02a, E1-03                 E1-09  ← E1-02a, E1-04, E1-02f
E1-07  ← Gate 0                        E1-08  ← E1-07, E1-03, E1-04, E1-02e, E1-05
```

Nach Gate S:

```
E1-10 ← Gate S, E1-02f
E1-11 ← Gate S, E1-02f, E1-04, E1-05
E1-12 ← E1-11, E1-03          E1-15 ← E1-11, E1-08          E1-16 ← E1-11, E1-05, E1-06, E1-08
E1-13 ← E1-12                 E1-14 ← E1-12, E1-03, E1-09
E1-17 ← E1-10 … E1-16         E1-AB ← alle  → Gate B
```

- **Kritischer Pfad:** E1-01 → E1-02a (parallel E1-02b) → E1-02c → E1-02d → E1-02e → E1-02f → Gate S → E1-11 → E1-12 → E1-13/E1-14 → E1-17 → E1-AB.
- E1-02d folgt auf E1-02c, weil es das Seitenmodell `pageModel.ts` (Besitz E1-02c) verwendet (PL0-07); E1-02c folgt auf E1-02a (`Id`, `Rgb` aus `types.ts`) und E1-02b (`FontWeight` aus `layout/text/types.ts`). E1-14 folgt auf E1-12, weil die Feldbausteine in E1-12 entstehen.
- **E1-02b Schritt 7 nach dem Merge von E1-02a** (Planänderung des Orchestrators vom 02.10.2026, Befund E1-02b-02): E1-02b wirft `WapError` aus `src/model/wap/errors.ts` (Besitz E1-02a, Vertrag E1-02b). E1-02a und E1-02b laufen bis Schritt 6 parallel; Schritt 7 (Umsetzung) von E1-02b startet erst, wenn E1-02a nach `wap-planer` gemergt ist und E1-02b diesen Stand übernommen hat. Bis dahin prüfen die Tests von E1-02b Fehler nur über das Feld `code` (z.B. `code: 'invalidTextBox'`), ohne `errors.ts` zu importieren, damit sie in der Rot-Phase an Assertion oder Stub-Fehler scheitern, nicht an einem fehlenden Import (ADR-010 §3.3). E1-02b ändert `errors.ts` nicht.
- E1-08 folgt auf E1-05, weil `runImport` den Import-Stand mit `prepareStandRecord` und `StandRenderers` aus E1-05 erzeugt (PL0-30); E1-08 bleibt vor Gate S, weil E1-05 nur von E1-02a und E1-03 abhängt (seit 06.10.2026, Vertrag E1-05 «Ausarbeitung Schritt 2» A; vorher E1-02f).
- **Höchstens vier Pakete gleichzeitig** in Arbeit; Merges seriell, nach jedem Merge volle Schleuse auf `wap-planer` (Prompt §5.2 Schritt 13).
- Vor dem Merge von E1-01 dürfen E1-02a, E1-02b und E1-07 bis Schritt 4 arbeiten; Rot-Nachweis (Schritt 5) und alles danach erst mit der Schleuse.
- **E1-01a vor jedem Worktree (ADR-010 §12.3):** Reihenfolge (1) E1-01a auf `wap-planer` committen, und zwar `git add .gitattributes && git add --renormalize . && git diff --cached --name-status` → genau `A .gitattributes` → erst dann `git commit` (AR0-88); (2) Arbeitsdateien des Arbeits-Checkouts mit LF neu schreiben, in Git Bash: `test -z "$(git ls-files -v | grep -v '^H ')" && git diff --cached --quiet && git diff --quiet && git read-tree HEAD && git checkout-index -a -f -u` (AR0-89, AR0-96, Entscheid des Orchestrators: nur durch den Orchestrator, nur wenn `git ls-files -v` ausschliesslich `H` zeigt – kein `assume-unchanged`, kein `skip-worktree`, kein Konflikt; Beleg unmittelbar vor der Kette – und bei sauberem Index und Arbeitsbaum, Ausnahme zu agent-regeln 5; ignorierte und nicht versionierte Inhalte wie `spikes/` und `node_modules/` bleiben erhalten, kein erneutes `npm ci` nötig); derselbe Befehl gilt für jeden vorbestehenden Paket-Worktree nach Übernahme des Commits. **Rückfall** nur, wenn (2) scheitert: nicht versionierte Inhalte sichern (`spikes/umgebungsprobe/` → `.qa/etappe0/`; `git worktree remove` löscht auch `spikes/excel-import`, `spikes/fk2-vite`, `spikes/font-layout`, `spikes/storage` und `node_modules/`), Arbeits-Checkout nach AR0-39 neu anlegen, `npm ci`; (3) erst dann die Paket-Worktrees `e1-01`, `e1-02a`, `e1-02b`, `e1-07` anlegen. Grund: Ein vor E1-01a angelegter Worktree bliebe ohne (2) CRLF; nach dem Merge von E1-01 wäre F5 (`biome check .`) dort rot. Konflikte entstehen nicht (0 geänderte Blobs).

| Meilenstein | erreicht, wenn | Zwischenstand in `zwischenstand/` | Prüfungen |
| --- | --- | --- | --- |
| M0 Zeilenenden | E1-01a committet (Prüfung vor dem Commit: genau `A .gitattributes`), unmittelbar davor `git ls-files -v` nur `H` (AR0-96), Arbeitsdateien des Arbeits-Checkouts mit der Kette aus Vertrag E1-01 §3a (`read-tree HEAD` + `checkout-index -a -f -u`) neu geschrieben (Rückfall: neu angelegt); dort `git ls-files --eol` ohne `w/crlf`, `spikes/umgebungsprobe/` vorhanden, `npx biome check .` Exit 0, `lock-check` 28 in Ordnung | – (Beleg in `pakete/E1-01.md`) | Orchestrator; `code-reviewer` mit E1-01 |
| M1 Werkzeugkette | E1-01 gemergt, Selbsttest S1–S5 rot wie erwartet, volle Schleuse auf `wap-planer` grün | Schleusen-Protokoll, Laufzeiten, O-2, O-4 | `code-reviewer` |
| M2 Durchstich | E1-02a bis E1-02f gemergt; S6 und S7 nachgeprüft; Golden «vorläufig» | **Gate-S-Vorlage** `gates/gate-S.md`: PDF der KVK-Fixture-Woche neben der Referenzseite (Vergleich in `reference/`, verlinkt), Screenshot, bekannte Abweichungen, Schriftgrössen 5 / 5,5 / 4,5 pt mit Messwerten, Statusrot (UI-F-1) | `visual-qa` (alle Regionen, ≥ 400 dpi), `code-reviewer` |
| **Gate S** | Auftraggeber gibt Optik und Schriftgrössen frei | Freigabeprotokoll | – |
| M3 Fachkern | E1-03 bis E1-09 gemergt | Importquote gegen Anhang A (nur Zahlen), Befund-Zählung, Leistungswerte | `code-reviewer`, `architect` Drift (Modell, Layout) |
| M4 Rahmen bedienbar | E1-10, E1-11 gemergt | Screenshots Erststart, Wochenleiste, Speicheranzeige | `ux-critic` SA-01, SA-17 |
| M5 Erfassen bedienbar | E1-12 bis E1-15 gemergt | Screenshots, Aktionszahlen | `ux-critic` gemäss Abschnitt 5 |
| M6 Abläufe | E1-16 gemergt | Befundliste, Export-Dialog, Importbericht | `ux-critic` SA-08, SA-09, SA-10, SA-18, SA-20 |
| M7 Etappenende | E1-17, E1-AB | Abnahmebericht-Entwurf | Prompt §5.3 Punkt 4: `spec-auditor`, `visual-qa` (alle Seiten), `ux-critic` (alle SA, Nacharbeit 14.1 = SA-34), `architect` Drift |

## 4 Pakete im Einzelnen

Für jedes Paket: Ziel, IDs (vollständig in Anhang A), Dateimenge (**besitzt** = nur dieses Paket ändert, solange es läuft), Testplan, Prüfer, Fragen. Jedes Oberflächenpaket besitzt zusätzlich seine Registry-Datei `tests/wap-e2e/support/kernzustaende/<paket>.ts` (Vertrag E1-17) und jedes Paket mit Leistungs-ID seine Harness-Datei `tests/wap-perf/harness/entries/<paket>.ts` (Vertrag E1-01).

### 4.1 E1-01 Werkzeugkette und Schleusen

- **Ziel:** Alle Instrumente aus ADR-010 eingerichtet und per Selbsttest belegt; keine Fachlogik.
- **IDs:** R-14-01, R-14-03; R-H-10 bis R-H-31; R-H-34 (Gate-0-Entscheid 11 b) – im Katalog übernommen (Runde 6b). **R-H-23 erweitert (Katalog Runde 6d, Befund E1-02b-03):** Kriterium (2) verlangt, dass die ausgelieferte Einzeldatei die Lizenztexte aller gebündelten Laufzeit-Abhängigkeiten und Schriften enthält (u.a. Arimo OFL-1.1, Trennmuster von `hyphen`), mit Selbsttest «Lizenztext entfernt → rot»; umgesetzt in `scripts/wap-gate/license-check.mjs` (`checkLicenses`, Vertrag E1-01 §2). Python-Prüfung vor `test:oracle` (V10, R-H-28): `checkPython` (Vertrag E1-01 §2, §6c; AR0-87).
- **Vorab-Schritt E1-01a** (Gate-0-Entscheid 4 a = E11 a; Vertrag E1-01 §3a; ADR-010 §12.3): Der Orchestrator committet `.gitattributes` (Inhalt wörtlich im Vertrag) auf `wap-planer`, prüft `git add --renormalize .` auf «keine weitere Änderung» und schreibt danach die Arbeitsdateien des Arbeits-Checkouts mit der Kette aus Vertrag §3a neu (AR0-89, AR0-96; Rückfall Neuanlage); erst dann entstehen die Paket-Worktrees. Konfigurationsdatei mit vertraglich festem Inhalt, kein Produkt- oder Testcode (Prompt §4.1); der `code-reviewer` von E1-01 prüft den Commit mit.
- **Gate-0-Entscheide mit Folgen für E1-01:** E4 b – Projekte `chromium-visual` und `perf` im Playwright-Chromium; der Orchestrator lädt es einmal mit `npx playwright install chromium` im Worktree von E1-01, nachdem `@playwright/test` 1.63.0 eingetragen ist (einziger freigegebener Netzzugriff ausserhalb `npm ci`); der lokale Bezugswert des Drosselungsfaktors wird in diesem Chromium gemessen (ADR-010 §8). E10 a – V10 führt `npm run test:oracle` mit Python 3 aus. 11 b – `scripts/wap-gate/privacy-names.mjs` (`scanNames`, Vertrag §2, §6b) in V11. 9 a – Node 24 global; die Node-Prüfung F1 (R-H-27) bleibt unverändert.
- **Besitzt:** `scripts/wap-gate/**`, `tests/wap-gate/**` (ausser `tests/wap-gate/selftest-s6s7.gate.ts`, E1-02f), `vitest.wap.config.ts`, `vitest.wap-reference.config.ts`, `vitest.wap-golden.config.ts`, `vitest.wap-gate.config.ts`, `playwright.wap.config.ts`, `stryker.wap.conf.mjs`, `tsconfig.wap.json`, `tests/wap/support/{pdf,common,golden}/**`, `tests/wap-e2e/support/**` (ohne `kernzustaende/<paket>.ts` der Oberflächenpakete), `tests/wap-perf/support/**`, `tests/wap-perf/harness/*` (ohne `entries/<paket>.ts`), `tests/wap/golden/{render-chain,manifest}.json`, `docs/wap-planer/perf/{drosselung,perf-baseline}.json`, `docs/wap-planer/reference-lock.json`; Suite-Dateien (E8): `package.json`, `package-lock.json`, `biome.json`, `.gitignore`. `.gitattributes` (E11) entsteht in E1-01a und wird von E1-01 nicht geändert. **H0-Ergänzung A (Variante A-1, Entscheid Orchestrator 02.10.2026; Vertrag E1-01 §1a, ADR-009 §3 Punkt 11, ADR-010 §3.1):** zusätzlich `scripts/wap/pre-commit.mjs` (nur die Änderung aus Vertrag §1a: Aufruf `gate.mjs fast --pre-commit`, sobald `scripts/wap-gate/gate.mjs` gesperrt ist) und der neue Test `tests/wap-harness/pre-commit-gate.harness.ts` – beschränkte, ausdrücklich beauftragte Ausnahme zu agent-regeln 5 nur für diese zwei Dateien; der `implementer` schreibt `pre-commit.mjs` per Befehl auf Auftrag des Orchestrators, der Orchestrator führt im selben Commit `lock-update --refresh scripts/wap/pre-commit.mjs` mit Grund aus; Kontrolle: `git diff --name-only` (unter `scripts/wap/` und `tests/wap-harness/` nur diese zwei Dateien), `code-reviewer`, Gate-B-Liste.
- **Sperrzeitpunkt (Entscheid Orchestrator 02.10.2026):** `vitest.wap-gate.config.ts` und die Dateien unter `scripts/wap-gate/` sperrt der Orchestrator erst beim Merge von E1-01 per `lock-update --add`, nicht beim Test-Freeze (ADR-010 §2, §13 Folgen); mit der Sperre von `gate.mjs` wird die schnelle Schleuse vor jedem Commit aktiv. Beim Freeze gesperrt: die Tests von E1-01, darunter `tests/wap-harness/pre-commit-gate.harness.ts` (`--add`, Grund «Test-Freeze E1-01, H0-Ergänzung A»).
- **Altmodul-Liste (AR0-44):** `scripts/wap-gate/legacy-modules.json` (gesperrt) mit den fünf SHA-256-Werten aus Vertrag E1-07 §1a; F6 (`checkTypes`) und `coverage-check.mjs` verwerfen Meldungen zu diesen Dateien, solange der SHA-256 stimmt; Test `[R-H-14]` (Vertrag E1-01 §6a).
- **Nicht:** `scripts/wap/**` (H0) ausser `scripts/wap/pre-commit.mjs` (nur die Änderung aus H0-Ergänzung A, siehe «Besitzt»); `tests/wap-harness/**` ausser dem neuen `pre-commit-gate.harness.ts`; insbesondere nicht `install-hooks.mjs`, `lib/common.mjs`, `.claude/settings.json`, `vitest.wap-harness.config.ts` und die bestehenden Harness-Tests.
- **Testplan:** Integration-Gate `tests/wap-gate/*.gate.ts` in echten temporären Git-Worktrees je Skript; PDF-Prüfhilfen gegen von Hand mit pdf-lib erzeugte PDF; Abdeckungs-Zusammenführung und Stryker an Beispielmodulen unter `tests/wap-gate/fixtures/`; Offline-Hilfe mit Download im dauerhaften Profil; Leistungs-Harness mit synthetischer Last; Namensprüfung `[R-H-34]` in temporären Repos mit fiktiver Sperrliste (Vertrag §6b); Selbsttest S1–S5 und Zusatzfall «Name in Suite-Textdatei → V11 rot». Rot-Nachweis über die Stubs der Skripte.
- **Prüfer:** `test-reviewer`, `code-reviewer`. **Risiken:** O-2, O-4, Download im dauerhaften Profil; Drosselungsfaktor 1,5 liegt vor (`drosselung.json`); lokalen Bezugswert unter den Bedingungen des Leistungsprojekts im Playwright-Chromium (E4 b) neu messen (ADR-010 §8); Python 3 muss vor der vollen Schleuse installiert sein (R-20); Treffer der Namensprüfung im Bestand der Suite (erster Lauf, R-21).

### 4.2 E1-02a Durchstich: Datenmodell-Kern, Kp-Vorlage, KVK-Fixture, synthetischer Plan

- **Ziel:** Unveränderliches Dokument (ADR-002) mit allen Eintragstypen der Etappe 1, Kalender, Zeitformen, Terminzeile, Ableitungen, Kp-Vorlage als Daten (Vorlagen als Parameter, keine globale Registry, AR0-18), ID-Zähler im Dokument (AR0-19), Fehlerklasse `WapError` in `src/model/wap/errors.ts` (auch von E1-02b verwendet, Abschnitt 3). Die Zeichenprüfung gegen die Schrift (AR0-13) liegt vertraglich in E1-02b (`isRenderable`, Abschnitt 4.3; Befund E1-02a-03).
- **IDs:** 54 (Anhang A). Die Verweis-IDs R-4.9-17 und R-5.4-08 liegen seit Runde 7 in E1-02e (Abschnitt 4.6; Vertrag E1-02a P-18); die Kp-Vorlage selbst ist über R-4.9-13, R-4.9-18, R-4.9-19 und R-4.7-07 bis -09 belegt.
- **Besitzt:** `src/model/wap/*.ts`, `src/model/wap/template/**`, `src/model/wap/derive/**`; Tests `tests/wap/unit/model/**`, `tests/wap/property/model/**`, `tests/wap/integration/model/**`; Hilfen `tests/wap/support/model/**`, `tests/wap/support/arbitraries/model.ts`, `tests/wap/support/synthetic-plan.ts`; Fixture `tests/wap/fixtures/durchstich/kvk.plan.json` (vom `test-engineer` von Hand aus dem Referenz-PDF erfasst, pseudonymisiert nach Prompt §8, Zuordnungstabelle nur in `reference/`).
- **Testplan:** Unit (Katalogfälle, KW 40 und KW 53), Property R-4.6-40; Plausibilität der KVK-Fixture (Anzahlen je Typ gegen `anhaenge/zaehlung-a.md`, nur Zahlen).
- **Fragen:** F-03, F-04, F-05, F-09, F-11, F-12, F-15, F-18, F-38, F-53, F-55, F-57. Glossar: `linkGroupId` gestrichen (P-5 erledigt, Glossar Stand 01.10.2026).

### 4.3 E1-02b Durchstich: Schrift und Textsatz

- **Ziel:** Arimo-Dateien, Metrik-Tabelle beim Build, Messung ohne Kerning, Umbruch an Leerzeichen und Bindestrichen, Silbentrennung nur für zu lange Wörter, Läufe fett/normal; Zeichenprüfung gegen die Schrift (AR0-13): Menge der verfügbaren Zeichen, `missingGlyphs` und `isRenderable` (Vertrag E1-02b; Befund E1-02a-03). Fehler als `WapError` aus `src/model/wap/errors.ts` (Besitz E1-02a, Abschnitt 3).
- **IDs:** R-15-06; R-L-03.
- **Besitzt:** `src/assets/wap-fonts/**`, `tools/wap/**`, `src/model/wap/layout/text/**`; Suite-Datei `tools/build-offline.mjs` (nur Lizenzeinträge); Tests `tests/wap/unit/text/**`, `tests/wap/property/text/**`.
- **Testplan:** Unit, Property (Zeilenbreite ≤ Maximum, verlustfrei), Metrik-Tabelle = fontkit für alle Glyphen.

### 4.4 E1-02c Durchstich: Seitenmodell, PDF-Schreiber, Bildschirm-Zeichner

- **Ziel:** `PageModel` als Schnittstelle Layout → Zeichner; PDF-Schreiber (pdf-lib + `fontkit` 2 mit Adapter, ADR-005, im Spike AR0-08 belegt); `PageView` (FontFace aus ArrayBuffer, Zeichnen in fester Auflösung mit CSS-Skalierung, AR0-13).
- **IDs:** R-10-01, R-10-05, R-10-36; R-L-01, R-L-04, R-L-05.
- **Besitzt:** `src/model/wap/layout/pageModel.ts`, `src/io/wap-pdf/{writer,fontkitAdapter,fonts,pdfColors}.ts`, `src/components/wap/render/{PageView.tsx,screenFont.ts,pageView.css}`; Tests `tests/wap/unit/pdf-writer/**`, `tests/wap/pdf/writer/**`, `tests/wap/integration/pdf-writer/**`, `tests/wap-e2e/render/**`, Harness `tests/wap-e2e/harness/page-view.{html,tsx}`.
- **Testplan:** PDF Ebene 2 mit handgebauten Seitenmodellen; Integration Determinismus (zwei Prozesse, Zeitzonen, Node und Edge gleiche Bytes); E2E PageView.

### 4.5 E1-02d Durchstich: Layout Raster und Einträge

- **Ziel:** Rein und deterministisch: Tages- und Spaltenbreiten, Zeit → y, Band, alle Eintragstypen, Beso-Bahnen, Kollisionen, Aussparungen, Marker, Textausrichtung, Rückfallregel im Block.
- **IDs:** 40 (darunter R-4.6-62 nach Gate 0: höchstens zwei Querbalken je Tag im Band, B-F-06); R-L-02.
- **Besitzt:** `src/model/wap/layout/grid/**`, `src/model/wap/layout/entries/**`; Tests `tests/wap/unit/grid/**`, `tests/wap/property/grid/**`, `tests/wap/support/arbitraries/grid.ts`.
- **Testplan:** Unit auf dem Raster-Ergebnis (Toleranz 0,01 pt), Property über zufällige Pläne; Prüfungen «im PDF» für Füllfarben, Kanten und Zeichenreihenfolge liegen in E1-02e (PL0-08).
- **Fragen:** F-02 (mit B-F-06), F-05, F-06, F-07, F-23, F-40, F-41, F-61 – an Gate 0 alle nach Vorschlag entschieden (Q-007, Q-008; B-F-06: Band = 0400–0500 statt eigenem Streifen).

### 4.6 E1-02e Durchstich: Layout Seite und PDF-Konformität

- **Ziel:** Seitenkomposition A4 quer (Kopf, Raster, Seitenleiste, Terminbereich, Fortsetzungsseite), Schriftgrössen, alle PDF-Anforderungen der Seite; Ebenen 1 und 2; `_SwissArmy` im Kopf wird durch «SCHWEIZER ARMEE» in Arimo fett ersetzt (Q-012, an Gate 0 entschieden; ADR-003, AR0-22).
- **IDs:** 78 (darunter R-4.6-54, R-4.6-59, R-4.7-04, R-7-06 als Prüfung im PDF; seit Runde 7 die Verweis-IDs R-4.9-17 → R-4.7-05 und R-5.4-08 → R-4.9-01, -03, -05, -07, -09, -11, -13, -16, -17, wie R-14.2-02; Vertrag E1-02a P-18). Beide haben keinen eigenen Test und sind belegt, wenn ihre Ziele der Etappe 1 belegt sind (ADR-010 §5 Regel 3); das Ziel R-4.9-13 liegt in E1-02a und ist beim Merge von E1-02e bereits eingefroren.
- **Besitzt:** `src/model/wap/layout/page/**`, `src/model/wap/layout/index.ts`; Tests `tests/wap/unit/page/**`, `tests/wap/pdf/page/**`, `tests/wap/property/page/**`, `tests/wap/reference/b-kp/**`. F-51 und B-F-10 sind an Gate 0 angenommen: Die pseudonymisierte Fassung von B-Kp (nur Masse, Farben, Elementnamen) liegt nach Übernahme durch den `spec-analyst` gesperrt in `docs/wap-planer/anhaenge/anhang-b-kp.csv`, die Konformitätstests laufen dann in `tests/wap/pdf/page/**` (ADR-010 §7.1); `tests/wap/reference/b-kp/**` bleibt nur für Prüfpunkte mit Referenztext.
- **Testplan:** PDF Ebene 1 und 2 an der **KVK-Fixture** (R-10-37 Referenzwoche, R-14.3-01/-02) und am synthetischen Plan; **Property** «kein Text ausserhalb seines Rahmens» über zufällige Pläne (R-14.3-02, Prompt §7, PL0-09) und Füllfarben/Kanten/Zeichenreihenfolge im PDF (R-4.7-04, R-7-06, R-4.6-54, R-4.6-59). Die importierten Referenzwochen Wo 1–3 prüft E1-08 mit R-14.3-03 (PL0-06).
- **Fragen:** F-10, F-27, F-38, F-42, F-51, F-60; B-F-01 bis B-F-10 (alle an Gate 0 nach Vorschlag entschieden); Gate S. Greift die Rückfallregel mit 5 / 5,5 / 4,5 pt bereits in der KVK-Fixture: anhalten (Prompt §5.4).

### 4.7 E1-02f Durchstich KVK: Wochenansicht, Parität, Golden, S6/S7, Gate-S-Vorlage

- **IDs:** R-5-01, R-10-03, R-11-15, R-11-16; R-H-32.
- **Besitzt:** `src/io/wap-pdf/{planPdf,index}.ts`, `src/components/wap/render/WeekPageView.tsx`; Tests `tests/wap/golden/durchstich/**`, `tests/wap/golden/baselines/kvk-*.png`, `tests/wap-e2e/parity/**`, `tests/wap-e2e/harness/week.{html,tsx}`, `tests/wap-perf/pdf/**`, `tests/wap-perf/harness/entries/e1-02f.ts`, `tests/wap-gate/selftest-s6s7.gate.ts`.
- **Testplan:** Integration Parität (alle Zeilen der KVK-Woche, auch unter Suite-CSP), PDF Gesamt-PDF, Integration-Leistung (PDF Woche ≤ 3 s, Plan ≤ 10 s), Golden (Schritt 8), Integration-Gate S6/S7.

### 4.8 E1-03 Befehle und Beso-Nummerierung

- **IDs:** 25.
- **Besitzt:** `src/model/wap/commands/{command,entries,columns,days,beso,numbering,refs}.ts` (keine anderen Dateien unter `commands/`, PL0-03); Tests `tests/wap/unit/commands/**`, `tests/wap/property/commands/**`, `tests/wap/support/arbitraries/commands.ts`.
- **Testplan:** Unit je Befehl, Property (Nummern lückenlos vor dem Stand, unverändert danach, Nummer ↔ Terminzeile 1:1, Inverse ∘ Befehl = Identität). Der Befund-Teil von R-5.1-18, R-5.2-09, R-5.3-10 (P1, P17) wird in E1-06 geprüft (PL0-10).
- **Fragen:** F-08, F-09, F-13, F-14, F-48, F-52, F-56.

### 4.9 E1-04 Speicherung, Undo, Wiederherstellung, Plan-Datei

- **IDs:** R-5.6-04, -08, -14, -15, -17; R-H-33; R-L-08 (seit 06.10.2026, Entscheid O-1; Test mit `fake-indexeddb` über `setNewStand`, Vertrag E1-04 Notiz aus E1-05).
- **Besitzt:** `src/model/wap/history/**`, `src/io/wap-plan/**` (ohne `standStore.ts`, E1-05); Tests `tests/wap/unit/storage/**`, `tests/wap/integration/storage/**` (mit `fake-indexeddb`), `tests/wap/fixtures/migration/etappe-1.wap.json`.
- **Testplan:** Unit, Integration (Undo/Redo je Änderungsart des Pakets: Einzel-, Massenänderung, Spaltensatz, Ersetzen aus Datei, Wiederherstellen; Undo stellt `nextId` exakt her, `seq` wird nie wiederverwendet (AR0-41); Undo/Redo des Imports prüft E1-08 mit `[R-5.6-05][R-5.6-14]`, PL0-12), Plan-Datei ohne lokalen Plan öffnen (`openFromFile`: Plan-ID und Stände sichtbar, Stand-PDF bytegleich, `[R-5.6-17]`, AR0-37), Stand-Regeln bei «Ersetzen» und «Als Kopie öffnen» mit `seq`/`hiddenBySeq` und berechneter Sichtbarkeit (Folge Ersetzen → Undo → Undo lokaler Stand → Redo ×2, Sonderfall gleiche `standId` im Redo-Zweig, Verwerfen, Kürzen; `nextSeq` ab 1; AR0-45, AR0-48), `restoreDeletedPlan` als Kopie bei belegter planId (AR0-51), Migration (Fixture verlustfrei, Version + 1 abgelehnt, Wiederherstellungspunkt im alten Format wird beim Zurückholen migriert; `runMigration` scheitert → `migrationFailed`, Datenbank unverändert, `migrationBackupFileName` nach Muster `[R-H-33]`), `listDeletedPlans` mit Frist 30 Tage `[R-5.6-08]` (PL0-36).
- **Fragen:** F-20; P-9 (Plan-Datei-Name) – an Gate 0 entschieden: Endung `.wap.json` (Q-010), Name gemäss Vertrag E1-04.

### 4.10 E1-05 Stand (atomar) und Dateiname

- **Ziel:** «Neuen Stand setzen» atomar (AR0-01): zuerst alle garantierten PDF-Varianten rendern, dann Dokument, Historienschritt und Stand-Aufzeichnung in **einer** IndexedDB-Transaktion mit Revisionsprüfung (`expectedRevision`, sonst `conflict`, AR0-25); Bearbeitung während des Vorgangs gesperrt (Oberfläche E1-16); `standId` per UUID (AR0-31); Undo/Redo des Stands über den Historienschritt; Dateiname nach Konvention; Arbeitsfassung ohne Datum im Titel (AR0-17).
- **IDs:** R-4.6-33, R-5.5-03 bis -06, R-5.6-07, R-6-10 bis -12, R-10-30, R-10-46 (R-L-08 seit 06.10.2026 bei E1-04; der E1-05-Anteil ist über `[R-5.5-04]` belegt).
- **Besitzt:** `src/model/wap/stand/**`, `src/io/wap-plan/standStore.ts`; Tests `tests/wap/unit/stand/**`, `tests/wap/pdf/stand/**`, `tests/wap/integration/stand/**`, `tests/wap/support/stand/**`.
- **Testplan:** Unit, Integration (Abbruch beim Rendern → kein Stand; **«Änderung während des Renderns geht nicht verloren»** `[R-5.5-04]` (AR0-25); Revisionsabweichung zwischen Lesen (Schritt 0) und Schreiben (Schritt 3) → `conflict`, nichts geschrieben (am Port-Double unter `[R-5.5-04]`; `[R-L-08]` mit `fake-indexeddb` in E1-04); Abbruch in Schritt 2 schreibt nichts, ab Schritt 3 ist «Abbrechen» wirkungslos `[R-5.5-04]` (AR0-40); Undo nach Stand → Aufzeichnung ausgeblendet, Redo → wieder sichtbar; Stand-PDF bytegleich nach weiteren Änderungen, Ständen und nach Plan-Datei-Rundreise einschliesslich Gesamt-PDF (AR0-26); zwei Stände nach «Wiederherstellen» mit verschiedenen `standId`, AR0-31), PDF.
- **Frage:** Gate-0-Frage G-12 (Varianten früherer Stände, AR0-35) – entschieden a (Gate-0-Entscheid 3): je Stand nur A4 mit rotem Status.
- **Fragen:** F-24, F-28, F-29, F-47, V-05-1 (Q-010) – an Gate 0 nach Vorschlag entschieden.

### 4.11 E1-06 Prüfregeln P1, P8, P16, P17 und Befunde

- **IDs:** R-7-08, R-7-10 bis -13, R-10-43, R-11-14, R-14.7-01.
- **Besitzt:** `src/model/wap/checks/**` ohne `acknowledge.ts`; Tests `tests/wap/unit/checks/**`, `tests/wap/property/checks/**`, `tests/wap-perf/checks/**`, `tests/wap-perf/harness/entries/e1-06.ts`.
- **Testplan:** Unit je Regel mit `(positiv)`/`(negativ)`; **Property** «Schrift unter Standardgrösse oder gekürzter Text ⇔ Befund P8» über zufällige Pläne (Prompt §7, PL0-09); Befund-Teil von R-5.1-18, R-5.2-09, R-5.3-10 zusammen mit R-7-10/R-7-13; Integration-Leistung.
- **Hinweis:** Gate S bei R-7-11, R-10-43. R-7-01 («ohne weitere Aktion») liegt in E1-16 (Anbindung an den Store, PL0-15).

### 4.12 E1-07 Gemeinsames XLSX-Lesemodul

- **Ziel:** ADR-008 Option B mit Entscheid E12 (ADR-008 «Altmodule»): an Gate 0 entschieden c – nur die fünf neutralen Dateien `zip`, `xml`, `sheet`, `colors`, `drawing` byteweise unverändert verschieben (ausgenommen von strenger Typprüfung und 90 %); `calibrate.ts` bleibt in `src/io/wap/` (hängt vom Tagesbefehl-Modell ab, Import-Analyse in ADR-008); alle Erweiterungen in **neue Dateien mit eigenen Typen** (`weekday.ts`, `calibration.ts`, `runs.ts`, `fills.ts`, `richText.ts`, `workbook.ts`), die streng sind; die neutrale Kalibrierung ist eine befristete Doppelung bis Etappe 4. Bei E12 a (Erweiterungen in `calibrate.ts`, `sheet.ts`, `drawing.ts`, `colors.ts`) wird E1-07 zum Umbau: 36 bis 46 der 48 strengen Typfehler und 90 % Zweigabdeckung für diese Dateien (AR0-29; Risiko R-09).
- **IDs:** R-8.2-22; R-L-11 (Leitplanke 7, Vertrag E1-07 §3 P13; Katalog Runde 6d). Testart von R-L-11 Unit; der Altmodul-Test mit `[R-L-11]` (SHA-256 der Altmodule, Weiterleitungen) liegt vertragsgemäss unter `tests/wap/integration/xlsx-drawing/` (Vertrag E1-07 §3).
- **Besitzt:** `src/io/xlsx-drawing/**`; Suite-Dateien `src/io/wap/{zip,xml,sheet,colors,drawing}.ts` (werden Weiterleitungen; `calibrate.ts` und die übrigen Tagesbefehl-Dateien bleiben unverändert); Tests `tests/wap/unit/xlsx-drawing/**`, `tests/wap/integration/xlsx-drawing/**`.
- **Testplan:** Unit je Erweiterung, Integration (Original unverändert, SHA-256). **Regressionsnachweis (AR0-04, AR0-30):** `tests/wap-parser.test.ts` und `tests/wap-real.test.ts` aus dem Code des Paket-Worktrees mit dem Haupt-Checkout als Arbeitsverzeichnis (Befehl und Ersatzweg in ADR-008), JSON-Bericht nach `.qa/e1-07/`, Protokoll nur mit Zahlen «n Tests ausgeführt, 0 übersprungen»; Hash-Vergleich der `parseWap`-Ausgabe auf den Referenzdateien vor und nach der Verschiebung (nur Hashes in `pakete/E1-07.md`).

### 4.13 E1-08 Excel-Import Kp, Bericht, Listen-Export

- **IDs:** 48 (nach Gate 0: R-6-40 statt R-6-09 – Notizen nie im Export der Listenansicht; R-6-09 ist Etappe 3, SA0-22).
- **Besitzt:** `src/io/wap-import/**`, `src/model/wap/list/**`; Tests `tests/wap/unit/import/**`, `tests/wap/integration/import/**`, `tests/wap/reference/import/**`, `tests/wap/fixtures/import/**`, `tests/wap/support/anhang-compare/**`, `tests/wap-perf/import/**`, `tests/wap-perf/harness/entries/e1-08.ts`.
- **Testplan:** Unit je Regel; Integration-Referenz (Quote ≥ 95 %, 14.5-Befunde, Formen-Bilanz); Import als Befehl mit Undo/Redo `[R-5.6-05][R-5.6-14]`; Importbericht gespeichert und nach Neuladen vorhanden, beim Undo ausgeblendet (AR0-12); Import-Stand mit PDF im selben Ablauf wie E1-05 (AR0-01), mit Revisionsprüfung und «Änderung während des Imports geht nicht verloren» `[R-5.6-05]` (AR0-25); R-14.3-03 über `WeekPageLayout.fallbacks` der importierten Referenzwochen (leer = keine Rückfallregel, kein P8; PL0-19) und R-14.3-01/-02 an denselben Wochen; Integration-Leistung über den **ganzen** Ablauf `runImport` einschliesslich Rendern aller Stand-Varianten (AR0-36).
- **Regel 4 (R-8.2-11):** an Gate 0 entschieden b (Q-006, Entscheid 7) – Kanten 2–4 Min neben der 15-Min-Linie als ein Sammeleintrag je Blatt und Tag, einzeln erst ab > 4 Min; vom Auftraggeber freigegebene Abweichung vom Wortlaut von Beschrieb 8.2 Regel 4. Präzisierung ADR-008 «Regel 4 – Meldung im Bericht», Vertrag E1-08 §1a; Unit-Test mit den Grenzfällen 0802/0803/0804/0805.
- **Fragen:** F-01, F-25, F-30, F-31, F-32, F-33, F-54 (an Gate 0 nach Vorschlag entschieden); Gate S bei R-14.3-03.

### 4.14 E1-09 Personenliste aus Datei

- **IDs:** R-4.1-11, R-11-05.
- **Besitzt:** `src/io/wap-persons/**`, `src/model/wap/commands/persons.ts`; Tests `tests/wap/unit/persons/**`, `tests/wap/integration/persons/**`, `tests/wap/fixtures/persons/**`.
- **Testplan:** Integration (Byte-Suche in Speicher, Historie, Plan-Datei und PDF; Datenschutz-Scan ohne Treffer). Abhängigkeit E1-02f für den PDF-Teil (PL0-11).

### 4.15 E1-10 Layout- und PDF-Ergänzungen (nach Gate S)

- **IDs:** R-4.1-08, R-4.6-15, R-4.7-03, R-4.7-13, R-10-04, R-10-27 bis -29, R-10-31.
- **Ändert** (seriell nach E1-02f): `src/model/wap/layout/**`, `src/io/wap-pdf/**`; besitzt Tests `tests/wap/unit/extras/**`, `tests/wap/pdf/extras/**`, `tests/wap/golden/extras/**`.
- **Fragen:** F-28, F-43, F-51, UI-F-1/UI-K-3.

### 4.16 E1-11 App-Rahmen, Erststart, Wochen, Datei, Speicheranzeige

- **Ziel** (UI-Richtlinie 2, 3, 4.1, 10, 11, 12, 13.2, 18): Kopfleiste, Werkzeugleiste, Seitenbereich, Statuszeile, WAP-Zustand, Erststart, Wochenbefehle, Plan-Datei sichern/öffnen (Ersetzen als Historienschritt mit Wiederherstellungspunkt, AR0-09), Plan löschen mit Wiederherstellungspunkt und Toast «Rückgängig», Speicherwarnungen, Erinnerung beim Verlassen, Meldungskatalog, route-weite Kürzel über die **Delegation der Shell** (ADR-001, AR0-02), Kürzelübersicht, Palette, Marke `wap:weekRendered`.
- **IDs:** 25 (inkl. R-4.1-16, PL0-14; R-5.6-18 nach SA0-33: Dialog «Sicherung vor dem Update» schliesst nicht mit Esc, UI-F-10); R-L-06; R-L-10 (Leitplanke 6, ADR-006 Punkt 2c: Sicherungen im alten Format und Wiederherstellungspunkt `migration` vor der Schema-Migration; Rollen, Texte und Testplan in Vertrag E1-11 §2c; E1-11 ist das zuletzt ermöglichende Paket, die Speicherfunktionen stammen aus E1-04); R-L-09 (nach Gate 0, G-9 a: Hinweis zum gemeinsamen Speicher unter `file://`; Ort und Text UI-Richtlinie 11.6: letzter Abschnitt `region` «Gemeinsamer Browserspeicher» der WAP-Übersicht «?», Erststart-Knopf und Palettenbefehl, nur bei `file:`; Rollen, Namen und Testplan inkl. Gegentest in Vertrag E1-11 §2b).
- **Besitz WAP-Übersicht «?» und Palettenbefehl:** E1-11 (`src/components/wap/shortcuts/**`, `app/commands.ts`); die Suite-Shell (S-4, Suite-Datei `Shell.tsx` im Besitz von E1-11) leitet «?» auf `/wap` nur weiter.
- **Besitzt:** `src/pages/WapPage.tsx`, `src/components/wap/wap.css`, `src/components/wap/{app,state,firstrun,weeks,files,messages,zoom,shortcuts}/**`, `src/model/wap/commands/weeks.ts`; Suite-Dateien (Gate 0): `src/App.tsx`, `src/components/Shell.tsx`, `src/components/CommandPalette.tsx`, `src/components/Icon.tsx`; Stubs der Andockpunkte (Vertrag E1-11 §4); Tests `tests/wap-e2e/app/**`, `tests/wap/unit/app/**`, `tests/wap-perf/week-switch/**`, `tests/wap-perf/harness/entries/e1-11.ts`, `tests/wap-e2e/visual/app/**`.
- **Schnittstellen zu späteren Paketen (PL0-33, PL0-35, PL0-37):** `createWapStore({ …, renderers? })` mit optionaler Abhängigkeit `WapRenderers` (Standard `defaultRenderers()`, Adapter auf `renderWeekPdf`/`renderPlanPdf` mit `RenderedPdf`; die Testharness von E1-17 übergibt verzögerbare); `WapStore.renderers` (nur lesen) – E1-16 verwendet für Export, Stand und Import ausschliesslich diese; `WapPage({ store? })`; `files/DeletedPlansSection.tsx` (Abschnitt «Gelöschte Pläne», eingebettet von E1-16 im Dialog «Wiederherstellungspunkte»); der `GridArea`-Stub ist ein fokussierbares `grid` (`tabindex="0"`), damit `[R-L-06]` «Fokus im Raster» schon in E1-11 prüfbar ist.
- **Testplan:** E2E (u.a. **verbindlich: «Suite-Undo und Suite-Sicherung lösen auf `/wap` nie aus»**, mit Fokus auf `body` und im Raster; andere Werkzeuge und Alt+1–8 unverändert), Integration-Leistung Wochenwechsel, Bildschirm-Regression, Unit (jsdom).
- **Fragen:** F-16, F-17, F-19, F-21, F-46; Q-009; P-9 – an Gate 0 nach Vorschlag entschieden. Zusätzlich: Hinweis in der Hilfe zum gemeinsamen Speicher unter `file://` (G-9 a, ADR-006 Folgen).

### 4.17 E1-12 Raster: Auswahl, Zellzeiger, Erfassen, Direktbearbeitung, Feldbausteine, Detail

- **IDs:** R-4.5-08, R-4.7-10, R-5.1-01 bis -04, -06 bis -11, -15, -23, -24, R-6-06, R-6-27, R-15-02 (R-5.1-24 Ziehen in Rap-/Beso-Spalte und Band, UI-F-8; R-6-27 Tab/Shift+Tab und Ctrl+Pfeile, UI-F-3; beide nach Gate 0).
- **Besitzt:** `src/components/wap/{grid,marks,inline,fields,goto}/**`; Tests `tests/wap-e2e/grid-create/**`, `tests/wap/unit/grid-ui/**`.
- **Testplan:** E2E Maus und nur Tastatur (Koordinaten aus `columnheader`/`rowheader`), Bildschirm-Regression, E2E Alt-Loslassen (UI-K-5); Eingabe eines Zeichens ohne Glyphe → Meldung, Wert nicht übernommen (AR0-13).
- **Fragen:** UI-K-1, UI-K-5, UI-F-3, UI-F-8.

### 4.18 E1-13 Raster: Verschieben, Mehrfachauswahl, Kopieren, Eintragsaktionen

- **IDs:** R-4.6-61, R-5.1-14, -16, -20 bis -22, R-6-01, R-11-11.
- **Ändert** (seriell nach E1-12): `src/components/wap/{grid,marks}/**`; besitzt `src/components/wap/{clipboard,dialogs/also-on-days}/**`; Tests `tests/wap-e2e/grid-move/**`, `tests/wap-perf/drag/**`, `tests/wap-perf/harness/entries/e1-13.ts`.
- **Fragen:** F-22, UI-F-6, UI-K-1.

### 4.19 E1-14 Seitenfeld, Tag- und Plan-Einstellungen

- **IDs:** R-4.1-02, -03, -05, -06, -10, -13, R-4.2-04, -08, -09, R-4.6-13, R-4.7-01, -16, R-4.8-11, R-5.1-12, R-5.2-07, -10.
- **Besitzt:** `src/components/wap/{panel,settings,dayheader}/**`, `src/model/wap/commands/settings.ts`; Tests `tests/wap-e2e/panel/**`, `tests/wap-e2e/settings/**`, `tests/wap/unit/settings/**`.
- **Fragen:** F-58.

### 4.20 E1-15 Listenansicht

- **IDs:** R-4-01, R-6-13 bis -15.
- **Besitzt:** `src/components/wap/list/**`; Tests `tests/wap-e2e/list/**`.
- **Testplan:** E2E; R-4-01 als Browser-Integration in `tests/wap-e2e/list/` (Änderung erscheint in Raster, Liste und PDF ohne weitere Aktion; zulässiger Testort gemäss ADR-010 §5).

### 4.21 E1-16 Abläufe

- **IDs:** R-1-03, R-1-07, R-1-08, R-5-03, R-5.3-08, R-5.5-01, -02, R-5.6-09, R-5.7-04, R-7-01, R-7-02 bis -05, R-7-34, R-8.2-21, R-11-02, R-14.13-01. R-L-07 liegt seit Runde 4 in E1-17 (PL0-32 b); E1-16 baut `BlockingProgress` (modaler Fortschritt, «Abbrechen» ab dem Schreibschritt deaktiviert).
- **Besitzt:** `src/components/wap/flows/**`, `src/model/wap/checks/acknowledge.ts`; Tests `tests/wap-e2e/flows/**`, `tests/wap-e2e/offline/**`, `tests/wap/unit/flows/**`.
- **Renderer (PL0-37):** Export, «Neuen Stand setzen» und Import verwenden ausschliesslich `store.renderers` (Vertrag E1-16 §2).
- **Testplan:** E2E; R-7-01 und R-5.7-04 als Browser-Integration; Export-Dialog bietet für frühere Stände nur die gespeicherten Varianten an (AR0-10, G-12); «Neuen Stand setzen» und Import zeigen `BlockingProgress` (Rollen und Texte gemäss Vertrag E1-16 §2a; die Sperrprüfung mit Eingaben im Raster und Seitenfeld folgt in E1-17 `[R-L-07]`); Offline im Projekt `edge-dist`.
- **Fragen:** F-14, F-37, UI-F-2, UI-F-5.

### 4.22 E1-17 Querschnitt

- **IDs:** R-2-01, R-3-02, R-9-01, R-11-03, R-11-06 bis -10, R-14.14-01; R-L-07 (Bearbeitungssperre bei «Stand setzen» und Import, AR0-25; hierher verschoben nach PL0-32 b, weil erst nach E1-12 und E1-14 im Raster und Seitenfeld eingegeben werden kann).
- **Ändert** (seriell, als letztes Oberflächenpaket): `src/components/wap/**`, `src/pages/WapPage.tsx`; Besitz `src/components/wap/reading/**`: entfällt (G-7 a); Tests `tests/wap-e2e/querschnitt/**` einschliesslich der Testharness `tests/wap-e2e/querschnitt/harness/app.{html,tsx}` (PL0-33: rendert `WapPage({ store })` mit `createWapStore({ renderers })`, deren Rendern bis `window.__wapTestGate.open()` wartet – deterministisch, ohne Zeitabhängigkeit; kein Testcode im Produkt).
- **R-11-10:** an Gate 0 entschieden G-7 a (Gate-0-Entscheid 1, ADR-007): Lesen auf dem Tablet = PDF. R-11-10 prüft das erzeugte PDF im Projekt `edge-tablet` (Viewport und Touch): Seite lesbar, zoombar, Text durchsuchbar; der Lesemodus der App entfällt in Etappe 1, ebenso die Vorführung auf dem echten Tablet. Rendert Edge das PDF im Testbrowser nicht im eingebauten Betrachter, prüft der Test die Seite über `pdfjs-dist` in einer Testharness-Seite im Tablet-Viewport (Risiko R-22).
- **Testplan:** E2E über alle Kernzustände; `[R-L-07]` je für «Neuen Stand setzen» und Import mit geschlossenem Gate: Eingaben in Raster und Seitenfeld wirkungslos (Revision und Dokument-Hash gleich), «Abbrechen» schreibt nichts, die vorher gespeicherte Änderung überlebt Abschluss, Abbruch und Neuladen; Negativfall gewöhnlicher PDF-Export; Rot-Nachweis per Mutation (E6).

### 4.23 E1-AB Abnahmevorbereitung und Nacharbeit 14.1

- **IDs:** R-1-02, R-1-06, R-14-04, R-14.1-02, R-14.2-05, R-14.15-01.
- **Ablauf (PL0-04):** Schritt 2 legt den Vertrag `vertraege/E1-AB.md` fest; Schritt 3: `test-engineer` schreibt `tests/wap/reference/abnahme/nacharbeit.ref.ts` `[R-14.1-02]`, der die Datei `$WAP_REFERENCE_DIR/nacharbeit/etappe-1/liste-kvk-wo1.csv` mit Anhang A (KVK, Wo1) vergleicht (Hilfe `anhang-compare`, E1-08) und 0 Abweichungen verlangt; Rot-Nachweis: die Datei fehlt noch → erste Erwartung `existsSync` scheitert (Assertion). «Umsetzung» (Schritt 7) ist die Nacharbeit des `ux-critic` über die Oberfläche (SA-34) und der Export der Listenansicht («Export …», E1-15) nach `reference/nacharbeit/etappe-1/`; danach ist der Test grün. Aktionen werden gezählt.
- **Weiter:** Seiten-an-Seiten-PDF je Woche (in `reference/`, verlinkt), Vorführskript 5.6 (R-14.15-01), Bitte um Excel-Ausgangsmessung Kp Wo 1 mit Messanleitung, Migrations-Fixture nachführen, Abnahmebericht `abnahme/etappe-1.md` mit Abweichungen und Einschränkungen (Abschnitt 6).
- **Besitzt:** `tests/wap/reference/abnahme/**`, `docs/wap-planer/abnahme/etappe-1.md`.

## 5 Teilabläufe für den `ux-critic`

Ein Teilablauf ist «durchgängig bedienbar», wenn alle Schritte der Standardaufgabe mit Maus und nur mit Tastatur ausführbar sind (Prompt §5.2 Schritt 10). Grundlage der Wege: UI-Richtlinie Abschnitt 17.

| Standardaufgabe | durchgängig nach | Prüfung ausgelöst bei |
| --- | --- | --- |
| SA-01 Neuen Plan aus Vorlage anlegen | E1-11 | Merge E1-11 |
| SA-17 Plan-Datei sichern und wieder öffnen | E1-11 | Merge E1-11 |
| SA-03 Block ziehen und betiteln | E1-12 | Merge E1-12 |
| SA-05 Beso mit drei Zeitfenstern | E1-12 | Merge E1-12 |
| SA-15 Ganztägige Bemerkung erfassen | E1-12 | Merge E1-12 |
| SA-04 «Auch an anderen Tagen» Di–Fr | E1-13 | Merge E1-13 |
| SA-11 Rückgängig nach Neuladen | E1-13 | Merge E1-13 |
| SA-02 Woche mit Spaltensatz einrichten | E1-14 | Merge E1-14 |
| SA-07 Querbalken über eine Wochengrenze | E1-14 | Merge E1-14 |
| SA-06 Beso verschieben und Nummern prüfen | E1-13 + E1-14 | Merge des späteren |
| SA-12 Rapport erfassen | E1-13 + E1-14 | Merge des späteren |
| SA-13 Mehrere Blöcke umfärben | E1-13 + E1-14 | Merge des späteren |
| SA-14 Eintrag auf Tag mit anderem Spaltensatz | E1-13 + E1-14 | Merge des späteren |
| SA-19 Eintrag als gestrichen markieren | E1-13 + E1-14 (+ E1-10 für die PDF-Sicht) | Merge des späteren |
| SA-16 In der Listenansicht korrigieren | E1-15 | Merge E1-15 |
| SA-08 Import-Bericht durchgehen | E1-16 | Merge E1-16 |
| SA-09 Stand setzen | E1-16 | Merge E1-16 |
| SA-10 PDF einer Woche erzeugen | E1-16 | Merge E1-16 |
| SA-18 Wiederherstellungspunkt zurückholen | E1-16 | Merge E1-16 |
| SA-20 Befund P1 finden und beheben | E1-13 + E1-14 + E1-16 | Merge E1-16 |
| SA-34 Nacharbeit nach Import (14.1) | E1-15 + E1-16 | E1-AB |

## 6 Testplan (übergreifend)

- **Prüfart je ID:** Spalte «Testart» in Anhang A. Verteilung Etappe 1 (per Skript, Anhang C): siehe Ausgabe dort. Testorte je Testart: ADR-010 Abschnitt 5.
- **Abweichungen von der Katalog-Prüfart (ausgewiesen, PL0-24):**
  - R-1-08: Katalog Property, eigener Test E2E (11. Beso → P17 vor dem Export) plus Verweis-Teil (Regel 4a).
  - R-14.3-03: Katalog PDF, Testart Integration-Referenz (die Referenzwochen entstehen nur über den Import); geprüft über `fallbacks` des Layouts und das erzeugte PDF.
  - R-14-03: Katalog Integration, Testart Integration-Gate (Schleusen-Selbsttest).
  - Verweis-IDs mit Zielen späterer Etappen: R-4.9-17 (R-4.7-06, Etappe 3), R-11-04 (R-8.1-04, Etappe 3), R-14.14-01 (R-11-13 Filter, Etappe 2). In Etappe 1 sind nur die Ziele der Etappe 1 belegt; der Abnahmebericht nennt die Einschränkung (14.14 ohne Filter-Messung).
- **Testnamen:** `[R-…]` am Anfang; Prüfregeln mit `(positiv)`/`(negativ)`; Fragen mit eindeutigem Präfix im Namen: `(F-05)`, `(B-F-06)`, `(UI-K-1)`, `(V-05-1)` (PL0-16).
- **Fixtures:** nur fiktiv oder pseudonymisiert; Namen ohne `FDT_`; `.xlsx`/`.csv` unter `tests/wap/fixtures/` per Ausnahme in `.gitignore`; verbotene Muster nur zur Laufzeit zusammengesetzt.
- **Referenztests:** über `WAP_REFERENCE_DIR`; fehlt eine in `required-files.json` genannte Datei, schlagen sie fehl (nie «skip»).
- **Zeit und Zufall:** Uhr in E2E gesteuert, Property-Tests mit festem `seed`, Zeitzonen-Läufe.
- **Oberfläche:** Rolle und Name; `data-testid` nur gemäss Vertrag.
- **Golden:** E1-02f, E1-10 und Bildschirm-Kernzustände; Aufnahme «vorläufig» nach `visual-qa`.

## 7 Risiken

| Nr | Risiko | Wirkung | Gegenmassnahme |
| --- | --- | --- | --- |
| R-01 | Drosselungsfaktor: **festgelegt** 1,5 aus der Umgebungsprobe (`docs/wap-planer/perf/drosselung.json`, ADR-010 §8). Rest: Die Probe-Ausgabe gilt laut Auftraggeber als Wert des Dienstlaptops; der lokale Wert ist in Edge headless gemessen | Wäre der Dienstlaptop langsamer, prüfen die Budgets von E1-02f, E1-06, E1-08, E1-11, E1-13 zu mild; unter anderen Messbedingungen (sichtbares Fenster, E4 b) weicht der lokale Bezug ab | Neumessung des lokalen Werts in E1-01 unter den Bedingungen des Leistungsprojekts (unabhängig von E4), Nachführung per `lock-update` bei anderer Stufe; Kontrolle mit sichtbarem Fenster (Architektur-Review) ergibt ebenfalls 1,5; kein Ersatzwert |
| R-02 | Rückfallregel greift mit 5 / 5,5 / 4,5 pt in Referenzwochen | 14.3 verletzt | Früherkennung in E1-02e (KVK-Fixture) und E1-08 (Wo 1–3); dann Prompt §5.4 |
| R-03 | E1-02e gross (78 IDs, davon 3 Verweis) | lange Review-Runden | zwei Test-Lieferungen, stabiles Seitenmodell |
| R-04 | Q-009 / Delegation der Shell-Kürzel anders entschieden | Suite-Undo/-Sicherung auf `/wap` | **erledigt:** G-1 an Gate 0 angenommen; verbindlicher E2E R-L-06 in E1-11 bleibt |
| R-05 | Edge aktualisiert sich selbst | Golden/Leistung nicht vergleichbar | **erledigt:** E4 b (Playwright-Chromium fest); funktionale E2E bleiben in Edge, eine Edge-Aktualisierung kann dort nur funktionale Abweichungen zeigen |
| R-06 | B-Kp nicht versioniert (F-51/B-F-10) | PDF-Konformität nur als Referenztest | **erledigt:** F-51 und B-F-10 angenommen; versionierte Fassung `anhaenge/anhang-b-kp.csv` durch den `spec-analyst` vor dem Test-Freeze von E1-02e |
| R-07 | Pseudonymisierte Fixtures aus echten Dateien | Datenschutz | `privacy-deep.mjs`, Sperrliste, Review der Fixtures |
| R-08 | Stryker mit Vitest 5, E2E-Abdeckung | Instrumente unvollständig | Selbsttest E1-01; Rückfall Stryker-Befehlsläufer |
| R-09 | Tagesbefehl-Regression durch E1-07; bei E12 a Umbau von `calibrate`/`sheet`/`drawing` (36–46 strenge Typfehler, 90 %); bei E12 c befristet doppelte Kalibrierung (`calibrate.ts` und `calibration.ts`) | fremdes Werkzeug beschädigt, E1-07 grösser, zwei Kalibrierungen laufen auseinander | Vorgabe E12 c: fünf neutrale Dateien unverändert, `calibrate.ts` unberührt; Nachweis mit `fixtures-private/` (ADR-008), Hash-Vergleich `parseWap`; unveränderte Verschiebung über eingefrorene SHA-256-Werte (E1-07 §1a, AR0-46) und F6-Filterung der Altmodul-Liste (AR0-44); Kalibrierungs-Tests der neuen Datei gegen dieselben synthetischen Arbeitsmappen wie `tests/wap-parser.test.ts`; Zusammenführung in Etappe 4 |
| R-10 | Linux wird lokal nicht geprüft | Suite-CI rot beim Pull-Request | Plattformregeln, Zeitzonen-Läufe, Zeilenenden (E11) |
| R-11 | Download im dauerhaften Playwright-Profil | Offline-Test «Datei sichern» nicht belegbar | Selbsttest E1-01; sonst `storageState` und Vorlage |
| R-12 | Q-006 (Regel 4) | Importbericht mit ≈ 35–39 % der Kanten | **entschieden b** (gruppiert, einzeln > 4 Min; Abweichung vom Beschrieb freigegeben); Restrisiko: Grenzfälle der Kalibrierung um 2 und 4 Min – Vergleich auf 0,01 Min gerundet, Unit-Test mit den Grenzfällen (Vertrag E1-08 §1a) |
| R-13 | Kollisionsauflösung bei 1000 Einträgen | Budgets | Messung ab E1-02f |
| R-14 | Glossar `linkGroupId` gegen ADR-002 | – | **erledigt:** im Glossar gestrichen (Stand 01.10.2026), P-5 |
| R-15 | Alt-Loslassen in Edge (UI-K-5) | R-5.1-04 nicht bedienbar | E2E in E1-12; sonst Vorlage |
| R-16 | Q-008 B-F-06 «Band = 0400–0500» | Geometrie ändert sich | **erledigt:** B-F-06 an Gate 0 angenommen, gilt ab Vertrag E1-02d |
| R-17 | Tablet ist iPad (kein `file://`) und «App» gewählt | R-11-10 nur mit Option C erfüllbar | **erledigt:** Tablet ist ein Android-Standardtablet, laut Auftraggeber vernachlässigbar (01.10.2026, ADR-007) |
| R-18 | Normalisierung auf LF (E11) wirkt nicht auf bestehende Arbeitskopien | `biome check .` bleibt rot | Vorab-Schritt E1-01a vor jedem Paket-Worktree (ADR-010 §12.3: 0 geänderte Blobs, kein Konflikt, kein `lock-update`); die Arbeitsdateien des Arbeits-Checkouts (und vorbestehender Paket-Worktrees) schreibt der Orchestrator einmal neu: `test -z "$(git ls-files -v | grep -v '^H ')" && git diff --cached --quiet && git diff --quiet && git read-tree HEAD && git checkout-index -a -f -u` (AR0-89, AR0-96: Abbruch bei `assume-unchanged`/`skip-worktree`, die beide `diff --quiet` verbergen; `checkout-index` allein wirkt nicht); Rückfall Neuanlage nach AR0-39 (sauber prüfen → nicht versionierte Inhalte sichern → Sitzung beenden → `git worktree remove` von aussen → `git worktree add` → `npm ci`); Nachweis M0 und Selbsttest E1-01 |
| R-19 | Bearbeitung während «Stand setzen» oder Import | stiller Verlust der Änderung | Sperre plus Revisionsprüfung `conflict` (ADR-006 2a), Tests `[R-5.5-04]` (E1-05), `[R-5.6-05]`, `[R-L-08]` (E1-04), `[R-L-07]` (E1-17) |
| R-20 | Python 3 fehlt lokal (heute `python` = 2.7.18 aus `C:\Python27`; `python3` nur der App-Ausführungsalias aus `WindowsApps` mit Exit 9009; `py` fehlt; 02.10.2026). PATH-Reihenfolge: Windows setzt den System-PATH vor den Benutzer-PATH, und im Benutzer-PATH steht `C:\Python27` vor `…\Microsoft\WindowsApps`; ein später ergänzter Benutzer-Eintrag für Python 3 kann also hinter `C:\Python27` liegen, und `python` bliebe 2.7 | V10 rot (`test:oracle`), Merge von E1-01 blockiert; ohne Prüfung nur unklare Syntaxfehler aus Python 2 | Installation nach E10 a vor der ersten vollen Schleuse von E1-01 (wer installiert: Frage an den Auftraggeber, Abschnitt 8 P-6). V10 wählt den Interpreter nicht über die PATH-Reihenfolge, sondern über `checkPython` (Vertrag E1-01 §2): `WAP_PYTHON` → `py -3` → `python3` → `python`, Hauptversion ≥ 3, sonst rot mit Ursache und nächstem Schritt; `test:oracle` läuft mit dem Ordner des gewählten Interpreters vorne im PATH (Spike: vorangestellter Ordner gewinnt im Skript `npm run`). Gate-Test mit gefälschtem `python` 2.7, das wie Python 2 antwortet → rot mit `version<3` (§6c); Probe-Befehl `PYTHON_PROBE` unter Python 2 und 3 gültig, einmalig gegen das echte 2.7.18 belegt (Spike AR0-97, ADR-010 §14; kein dauerhafter Test gegen Python 2, das jederzeit entfernt werden darf); dazu statischer Fall «keine nur-Python-3-Syntax» (§6c Fall 7) |
| R-21 | Namensprüfung (11 b) findet im Bestand der Suite Treffer, die bereits auf `main` veröffentlicht sind | V11 rot ab dem ersten Lauf | erster Lauf in E1-01 nur maskiert (Pfad, Anzahl); Freigabe je Pfad über `privacy-allow.txt` per `lock-update` mit Grund, an Gate B aufgelistet; kein Abschwächen der Regel |
| R-22 | Edge zeigt das PDF im Testbrowser nicht im eingebauten Betrachter | R-11-10 im Tablet-Format nicht prüfbar | Prüfung über `pdfjs-dist` in einer Testharness-Seite im Viewport `edge-tablet` (E1-17) |

## 8 Offene Punkte und betroffene Pakete

| Nr | Punkt | Entscheid an Gate 0 (02.10.2026) bzw. Stand | Pakete |
| --- | --- | --- | --- |
| P-1 | Q-009 UI-Richtlinie (S-1 bis S-7, UI-K-1 bis UI-K-5, UI-F-1 bis UI-F-10) | **entschieden:** alle Vorschläge der Richtlinie angenommen (Sammelentscheid Nr 10); UI-F-1 (Status-Rot) zusätzlich an Gate S | E1-10, E1-11 bis E1-17 |
| P-1a | Q-008 Anhang B-Kp (B-F-01 bis B-F-10) | **entschieden:** alle Vorschläge angenommen, darunter B-F-06 (Band = 0400–0500) und B-F-10 (pseudonymisierte Fassung versioniert, mit F-51) | E1-02d, E1-02e, E1-10 |
| P-2 | Umgebungsprobe (01.10.2026, ADR-006/007): **erledigt** Drosselungsfaktor (1,5), FontFace aus ArrayBuffer unter Suite-CSP (ok), `persist()` (nein). **Nicht gemessen:** Mindestschriftgrösse des Browsers, InPrivate/Gast, Datei sichern und öffnen (laut Auftraggeber erfolgreich; in der Ausgabe nicht belegt, `manuell: noch nichts ausgeführt`; Beleg für den Weg: lokale Spikes in Edge 155, ADR-006), Download-Richtlinien (Zielordner, OneDrive), Daten nach Geräte-Neustart (Schritt 6 laut Auftraggeber erfolgreich ausgeführt; Ergebnis der Markierung nicht übermittelt) und nach Abmelden, Offline-Test auf dem Gerät (nicht bestätigt), PDF-Lesbarkeit am Tablet | für die nicht gemessenen Punkte Restrisiko nach ADR-006/007: Bildschirm-Zeichner 4 px/pt (ADR-004), Warnung «Speicher nicht dauerhaft», Speichern-Anleitung ohne festen Zielordner. Kein Gate-0-Entscheid nötig; optional liefert der Auftraggeber den zweiten Lauf nach Neustart und den Offline-Test (PROGRESS.md) | E1-02c, E1-02f, E1-04, E1-06, E1-08, E1-11, E1-13, E1-16 |
| P-3 | Q-006 Import-Regel 4 | **entschieden b** (Entscheid 7): Kanten 2–4 Min als ein Sammeleintrag je Blatt und Tag, einzeln erst ab > 4 Min; vom Auftraggeber freigegebene Abweichung vom Wortlaut von Beschrieb 8.2 Regel 4. Umsetzung: ADR-008 «Regel 4 – Meldung im Bericht», Vertrag E1-08 §1a; Katalog-Wortlaut R-8.2-11 und Normalisierungsregel «`Kante <hhmm>`» passt der `spec-analyst` an | E1-08 |
| P-4 | Q-007 Katalogfragen F-01 bis F-62, N-01 bis N-04 | **entschieden:** alle Vorschläge angenommen (Sammelentscheid Nr 10) | wie Anhang A «Hinweis» |
| P-5 | Glossar: `linkGroupId` streichen | **erledigt** (Glossar Stand 01.10.2026) | – |
| P-6 | Gate-0-Entscheide (ADR-001, -006, -007, -008, -010 §12) | **entschieden:** alle Empfehlungen (G-1 bis G-12, H-1, H-2, E1 bis E13 mit E4 b, E10 a, E11 a, E12 c; Entscheide 1 bis 11; Entscheid 12: CR-H0S-32/38/42/43 zurückgestellt). Folgen: Vorab-Schritt E1-01a (E11 a), R-H-34 (11 b), R-L-09 (2 a = G-9 a), R-11-10 nur am PDF (1 = G-7 a). Offen nur die Ausführung: Python 3 installieren (E10 a, R-20) und Node 24 global (Entscheid 9 a) durch den Auftraggeber | alle |
| P-7 | H0-Ergänzungen A und B (ADR-009) | **kein Gate-0-Punkt.** H0 ist ohne A und B abgeschlossen. **A entschieden (Orchestrator, 02.10.2026): Variante A-1** – Umsetzung in E1-01; `pre-commit.mjs` ruft `gate.mjs fast --pre-commit` auf, sobald `scripts/wap-gate/gate.mjs` gesperrt ist (aktiv ab der Sperre nach dem Merge von E1-01); beschränkte Ausnahme zu agent-regeln 5 nur für `scripts/wap/pre-commit.mjs` und `tests/wap-harness/pre-commit-gate.harness.ts`, kontrolliert durch `git diff --name-only`, `lock-update --refresh` mit Grund, `code-reviewer` und Gate-B-Liste (Abschnitt 4.1, ADR-009 §3 Punkt 11, ADR-010 §3.1, §13 O-5, Vertrag E1-01 §1a). **B offen:** Ersatzlösung `reference-lock.mjs` | E1-01 |
| P-8 | Dateiformat Personenliste | **entschieden** (Entscheid 8): CSV (`;` oder `,`) oder `.xlsx` (erstes Blatt), Kopfzeile Pflicht mit `Grad`, `Name`, `Vorname`, `Funktion`; weitere Spalten werden verworfen, ohne gelesen oder zwischengespeichert zu werden; ohne Kopfzeile Ablehnung mit Meldung (Vertrag E1-09 §1) | E1-09 |
| P-9 | Dateiendung und Name der Plan-Datei | **entschieden:** `.wap.json` (Q-010), Name gemäss Vertrag E1-04 | E1-04, E1-11 |
| P-10 | Katalog-Ergänzung R-H-10 bis R-H-33, R-L-01 bis R-L-08: **erledigt** (Katalog Runde 3b; R-L-08 Runde 5). **Neu nach Gate 0:** R-H-34 und R-L-09 im Katalog übernommen (Runde 6b) | **erledigt** | E1-01, E1-02b, E1-02c, E1-02d, E1-02f, E1-04, E1-11 |
| P-11 | Q-010 (ADR-010 §12, V-05-1) und Q-011 (Anhang A) | **entschieden:** alle Empfehlungen E1 bis E13, V-05-1, `.wap.json`, Format Personenliste, R-H-10 bis R-H-33 / R-L-01 bis R-L-08 (Q-010); N-05 bis N-23 angenommen und Anhang A (Kandidat) bestätigt (Q-011) – Anhang A ändert sich nur noch mit Einzelbestätigung des Auftraggebers (Prompt §5.2 Schritt 6) | E1-01, E1-05, E1-08, E1-AB |

## 9 Änderungen an Dateien der Suite (Gate 0, freigegeben am 02.10.2026)

| Datei | Paket | Grund | ADR / Entscheid |
| --- | --- | --- | --- |
| `package.json`, `package-lock.json` | E1-01 | Skripte `wap:*`, `test:reference`; Abhängigkeiten der Etappe 1 | 010 (E1, E2, E8) |
| `biome.json` | E1-01 | Überschreibungen für WAP-Pfade; `scripts/wap*/**` und `tools/wap/**` in `files.includes` (F-003) | 010 (E8, E11) |
| `.gitattributes` (neu, ganzes Repo) und einmalige Normalisierung auf LF (ändert laut Spike keinen Blob); danach schreibt der Orchestrator die Arbeitsdateien des Arbeits-Checkouts mit der Kette aus Vertrag E1-01 §3a (Vorbedingung «nur `H` in `git ls-files -v`», `read-tree HEAD` + `checkout-index -a -f -u`) neu (AR0-89, AR0-96; Rückfall Neuanlage nach AR0-39), Paket-Worktrees entstehen erst danach (ADR-010 §12.3) | E1-01a (Vorab-Schritt, Orchestrator) | F-002: `biome check .` lokal rot wegen CRLF; bestehende Arbeitskopien bleiben CRLF (AR0-28) | 010 (E11 a, Gate 0 Nr 4) |
| `.gitignore` | E1-01 | Ausnahmen für Fixtures `.xlsx`/`.csv` | 010 (E8) |
| `src/io/wap/{zip,xml,sheet,colors,drawing}.ts` | E1-07 | gemeinsames Lesemodul, Weiterleitungen; `calibrate.ts` unverändert | 008 (G-10, E12) |
| `tools/build-offline.mjs` | E1-02b | Lizenzeinträge Schrift und Trennmuster | 003 |
| `tools/build-offline.mjs`, Deploy-Workflow | – (nach Gate B, eigene Freigabe) | Release-Datei mit Version im Namen (ADR-007 Punkt 1) | 007 (G-8) |
| `src/App.tsx` | E1-11 | Route `/wap` (S-1) | 001 |
| `src/components/Shell.tsx` | E1-11 | Werkzeug, Alt+9, Kopfleiste und Seitenleiste auf `/wap` (S-1, S-2), **Delegation der globalen Kürzel** (S-3, `setRouteKeyDelegate`), «?» (S-4) | 001 (G-1) |
| `src/components/CommandPalette.tsx` | E1-11 | Route-Befehle (S-7) | 001 |
| `src/components/Icon.tsx` | E1-11 | neun Ikonen (S-5) | – |
| Suite-Tests zu Werkzeugliste, Kürzeln, Palette (nur falls sie die Liste fest prüfen) | E1-11 | Anpassung ohne Abschwächung | – |
| keine (S-6) | E1-17 | Kontrast nur in der Route überschrieben; Hinweis an den Auftraggeber | – |

---
## Anhang A – Zuordnung Katalog-IDs der Etappe 1 (maschinenlesbar)

Feste Spaltenfolge für `scripts/wap-gate/trace.mjs`. «Testart» nach ADR-010 Abschnitt 5 (Katalog-Prüfart, verfeinert: «Integration-Referenz» = `test:reference`, «Integration-Leistung» = Leistungsprojekt, «Integration-Gate» = Schleusen-Selbsttests `tests/wap-gate/**`; «Verweis» = kein eigener Test, belegt durch die Ziel-IDs der Etappe 1). Steht bei einer anderen Testart ein Eintrag in «Verweis auf», gilt Regel 4a: eigener Test **und** alle Ziele belegt. «Hinweis»: offene Fragen mit eindeutigem Präfix – Katalog `F-nn`, Anhang B-Kp `B-F-nn` (Q-008), UI-Richtlinie `UI-F-n`/`UI-K-n` (Q-009), Verträge `V-nn-n` (Q-010) –, Anhang B-Kp (F-51), Gate-S-Abhängigkeit, Sonderregeln. Reihenfolge wie `requirements.md`.

| ID | Paket | Testart | Verweis auf | Hinweis |
| --- | --- | --- | --- | --- |
| R-1-02 | E1-AB | Auftraggeber | – | Vorbereitung im Abnahmebericht |
| R-1-03 | I5 | E2E | – | – |
| R-1-06 | E1-AB | Auftraggeber | – | Vorbereitung im Abnahmebericht |
| R-1-07 | I5 | E2E | – | – |
| R-1-08 | I5 | E2E | R-5.3-01, R-4.6-51, R-4.6-52, R-4.6-53, R-14.3-01 | eigener Test und Verweis (ADR-010 §5 Regel 4a); Katalog-Prüfart Property; Verweis-Teil R-5.3-01, R-4.6-51 bis R-4.6-53, R-14.3-01; eigener Test: 11. Beso → P17 vor dem Export; F-14 |
| R-2-01 | I5 | E2E | – | Rot-Nachweis per Mutation (ADR-010 §4.3) |
| R-2-02 | E1-02d | Unit | – | – |
| R-3-02 | I5 | E2E | – | Rot-Nachweis per Mutation (ADR-010 §4.3) |
| R-4-01 | I4 | Integration | – | – |
| R-4.1-01 | E1-02a | Unit | – | – |
| R-4.1-02 | I3 | Unit | – | – |
| R-4.1-03 | I3 | Unit | – | – |
| R-4.1-04 | E1-02a | Unit | – | – |
| R-4.1-05 | I3 | Unit | – | – |
| R-4.1-06 | I3 | Unit | – | – |
| R-4.1-07 | E1-02e | PDF | – | – |
| R-4.1-08 | I5 | PDF | – | Vorgabe offen (Beschrieb 15) |
| R-4.1-09 | E1-02a | Unit | – | – |
| R-4.1-10 | I3 | E2E | – | – |
| R-4.1-11 | I3 | Integration | – | – |
| R-4.1-13 | I3 | Unit | – | – |
| R-4.1-14 | E1-02a | Unit | – | – |
| R-4.1-15 | E1-02a | Unit | – | – |
| R-4.1-16 | I3 | Unit | – | – |
| R-4.2-01 | E1-02a | Unit | – | – |
| R-4.2-02 | E1-02a | Unit | – | F-15 |
| R-4.2-03 | E1-02a | Unit | – | – |
| R-4.2-04 | I3 | Unit | – | – |
| R-4.2-06 | E1-02e | PDF | – | – |
| R-4.2-07 | E1-02a | Unit | – | F-38 |
| R-4.2-08 | I3 | Unit | – | – |
| R-4.2-09 | I3 | Unit | – | – |
| R-4.2-10 | E1-02a | Unit | – | – |
| R-4.3-01 | E1-02a | Unit | – | – |
| R-4.3-02 | E1-02a | Unit | – | – |
| R-4.3-03 | E1-02d | Unit | – | F-41 |
| R-4.3-04 | E1-02e | PDF | – | – |
| R-4.4-01 | E1-02a | Unit | – | – |
| R-4.4-02 | E1-02e | PDF | – | – |
| R-4.4-03 | E1-03 | Verweis | R-4.7-11 | – |
| R-4.4-04 | E1-02a | Unit | – | – |
| R-4.4-05 | E1-02a | Unit | – | – |
| R-4.4-06 | E1-02a | Unit | – | – |
| R-4.4-07 | E1-02a | Unit | – | – |
| R-4.4-08 | E1-02e | PDF | – | F-42 |
| R-4.4-09 | E1-02a | Unit | – | – |
| R-4.4-10 | E1-02d | Property | – | – |
| R-4.4-11 | E1-02d | Unit | – | F-40 |
| R-4.4-12 | E1-02d | Property | – | – |
| R-4.4-13 | E1-02d | Unit | – | – |
| R-4.4-14 | E1-02e | PDF | – | – |
| R-4.5-01 | E1-02a | Unit | – | – |
| R-4.5-02 | E1-02d | Unit | – | – |
| R-4.5-03 | E1-02e | PDF | – | – |
| R-4.5-04 | E1-02e | PDF | – | B-Kp (F-51) |
| R-4.5-05 | E1-02e | PDF | – | B-Kp (F-51) |
| R-4.5-06 | E1-02e | PDF | – | – |
| R-4.5-07 | E1-02d | Unit | – | F-02; B-F-06 (Q-008) |
| R-4.5-08 | I2 | Unit | – | AE-005 §3: Einrasten als Unit-Pflicht; Mausablauf zusätzlich unter R-5.1-14 |
| R-4.5-09 | E1-02a | Unit | – | F-18; Vorgabe offen (Beschrieb 15) |
| R-4.5-10 | E1-02d | Unit | – | – |
| R-4.6-01 | E1-02a | Unit | – | F-03 |
| R-4.6-02 | E1-02a | Unit | – | – |
| R-4.6-03 | E1-02e | PDF | – | B-Kp (F-51) |
| R-4.6-04 | E1-02a | Unit | – | – |
| R-4.6-05 | E1-02d | Unit | – | – |
| R-4.6-06 | E1-02e | PDF | – | B-F-06 (Q-008) |
| R-4.6-07 | E1-02d | Unit | – | B-F-06 (Q-008): erster Querbalken unten (0430–0500), zweiter darüber |
| R-4.6-08 | E1-02e | PDF | – | – |
| R-4.6-09 | E1-02d | Unit | – | – |
| R-4.6-10 | E1-02e | PDF | – | – |
| R-4.6-11 | E1-02a | Unit | – | – |
| R-4.6-12 | E1-02e | PDF | – | B-Kp (F-51) |
| R-4.6-13 | I3 | E2E | – | – |
| R-4.6-14 | E1-02a | Unit | – | F-55 |
| R-4.6-15 | I5 | PDF | – | – |
| R-4.6-16 | E1-02a | Unit | – | F-04 |
| R-4.6-17 | E1-02a | Unit | – | – |
| R-4.6-18 | E1-03 | Unit | – | F-09 |
| R-4.6-19 | E1-02d | Unit | – | – |
| R-4.6-20 | E1-02e | PDF | – | – |
| R-4.6-21 | E1-02d | Unit | – | – |
| R-4.6-22 | E1-02d | Unit | – | – |
| R-4.6-23 | E1-02d | Unit | – | – |
| R-4.6-25 | E1-03 | Unit | – | F-56 |
| R-4.6-26 | E1-02a | Unit | – | – |
| R-4.6-27 | E1-02e | PDF | – | – |
| R-4.6-28 | E1-02a | Unit | – | F-57 |
| R-4.6-29 | E1-02a | Unit | – | – |
| R-4.6-30 | E1-02e | PDF | – | – |
| R-4.6-31 | E1-02e | PDF | – | F-38 |
| R-4.6-32 | E1-02a | Unit | – | – |
| R-4.6-33 | E1-05 | Unit | – | F-29; Import-Teil über R-8.2-07 (E1-08) |
| R-4.6-35 | E1-02a | Unit | – | F-04 |
| R-4.6-36 | E1-02a | Unit | – | F-05 |
| R-4.6-37 | E1-02a | Unit | – | – |
| R-4.6-38 | E1-02a | Unit | – | – |
| R-4.6-39 | E1-02a | Unit | – | – |
| R-4.6-40 | E1-02a | Property | – | – |
| R-4.6-41 | E1-02a | Unit | – | – |
| R-4.6-42 | E1-02d | Unit | – | – |
| R-4.6-43 | E1-02d | Unit | – | – |
| R-4.6-44 | E1-02d | Property | – | – |
| R-4.6-45 | E1-02d | Unit | – | F-05 |
| R-4.6-46 | E1-02d | Unit | – | – |
| R-4.6-47 | E1-02d | Unit | – | – |
| R-4.6-48 | E1-02d | Unit | – | – |
| R-4.6-49 | E1-02d | Unit | – | – |
| R-4.6-51 | E1-02d | Property | – | – |
| R-4.6-52 | E1-02d | Unit | – | – |
| R-4.6-53 | E1-02d | Unit | – | – |
| R-4.6-54 | E1-02e | Property | – | – |
| R-4.6-55 | E1-02d | Unit | – | – |
| R-4.6-56 | E1-02d | Unit | – | F-06 |
| R-4.6-57 | E1-02d | Unit | – | F-07 |
| R-4.6-58 | E1-02d | Unit | – | – |
| R-4.6-59 | E1-02e | Property | – | – |
| R-4.6-60 | E1-02d | Unit | – | – |
| R-4.6-61 | F-FIX | E2E | – | bisher E1-13a, umgehängt F-FIX (FD-02, Koordinator 20.10.2026) |
| R-4.6-62 | E1-02d | Unit | – | B-F-06 (Q-008): höchstens zwei Querbalken je Tag im Band; der dritte ergibt ein `FallbackEvent` `bandOverflow` (Vertrag E1-02d), Befund-Teil P8 in E1-06 mit `[R-7-11][R-4.6-62]`; Darstellung des dritten: F-63 (offen, Gate S) |
| R-4.6-63 | E1-02h | Unit | – | Gate S A1; Q-044 (a); Q-045 (a), (g) (Ltg optional, Abweichung); Q-041 (Einzug offen) (Katalog-Notiz I2) |
| R-4.6-64 | E1-02h | Unit | – | Q-038 Arbeitsannahme (Katalog-Notiz I2) |
| R-4.6-65 | E1-02h | Unit | – | Gate S A1; F-22 (Katalog-Notiz I2) |
| R-4.6-66 | E1-02h | Unit | – | Gate S A1 (Katalog-Notiz I2) |
| R-4.6-67 | F-DOKU | Unit | – | Q-026; Q-045 (f) (Katalog-Notiz I2); bisher E1-03b, umgehängt F-DOKU (SA-2-01) |
| R-4.7-01 | I3 | Unit | – | F-58 |
| R-4.7-02 | E1-02a | Unit | – | – |
| R-4.7-03 | I5 | PDF | – | – |
| R-4.7-04 | E1-02e | Property | – | Property auf dem PDF (synthetische Pläne) |
| R-4.7-05 | E1-02e | PDF | – | B-Kp (F-51) |
| R-4.7-07 | E1-02a | Unit | – | – |
| R-4.7-08 | E1-02a | Unit | – | – |
| R-4.7-09 | E1-02a | Unit | – | – |
| R-4.7-10 | I3 | E2E | – | – |
| R-4.7-11 | E1-03 | Unit | – | – |
| R-4.7-12 | E1-03 | Unit | – | F-08 |
| R-4.7-13 | I5 | PDF | – | – |
| R-4.7-14 | E1-02a | Unit | – | – |
| R-4.7-15 | E1-02e | PDF | – | – |
| R-4.7-16 | I3 | E2E | – | – |
| R-4.7-17 | E1-02d | Unit | – | – |
| R-4.7-18 | E1-02h | Unit | – | Q-023; Q-045 (c) (Abweichung: ausgeblendete Tage zählen); Neufreeze der Tests mit R-4.7-14 (Katalog-Notiz I2) |
| R-4.7-19 | E1-02h | Unit | – | Gate S A1 (Katalog-Notiz I2) |
| R-4.7-20 | E1-02h | Unit | – | V-02e-4; Q-045 (d); Freeze mit der Arbeitsannahme, bei anderer Antwort neue ID (SA-K-I2-12) (Katalog-Notiz I2) |
| R-4.7-21 | E1-02h | Unit | – | V-02e-4; Q-045 (h) (Katalog-Notiz I2) |
| R-4.7-22 | I3 | E2E | – | V-02e-4 (Katalog-Notiz I2) |
| R-4.8-01 | E1-02e | PDF | – | – |
| R-4.8-02 | E1-02e | PDF | – | F-10 |
| R-4.8-03 | E1-02e | PDF | – | – |
| R-4.8-04 | E1-02a | Unit | – | – |
| R-4.8-05 | E1-02a | Unit | – | – |
| R-4.8-06 | E1-02a | Verweis | R-4.6-28 | – |
| R-4.8-07 | E1-02e | PDF | – | – |
| R-4.8-08 | E1-02a | Unit | – | F-11 |
| R-4.8-09 | E1-02a | Unit | – | F-12 |
| R-4.8-11 | I3 | Unit | – | – |
| R-4.9-01 | E1-02e | PDF | – | – |
| R-4.9-03 | E1-02e | PDF | – | – |
| R-4.9-05 | E1-02e | PDF | – | – |
| R-4.9-07 | E1-02e | PDF | – | – |
| R-4.9-09 | E1-02e | PDF | – | – |
| R-4.9-11 | E1-02e | PDF | – | – |
| R-4.9-13 | E1-02a | Unit | – | – |
| R-4.9-16 | E1-02e | Unit | – | F-60 |
| R-4.9-17 | E1-02e | Verweis | R-4.7-05 | Ziel R-4.7-06 ab Etappe 3 |
| R-4.9-18 | E1-02a | Unit | – | F-09 |
| R-4.9-19 | E1-02a | Unit | – | F-53 |
| R-5-01 | E1-02f | Integration | – | – |
| R-5-02 | H-TESTS | E2E | – | – |
| R-5-03 | I5 | PDF | – | Rot-Nachweis per Mutation (ADR-010 §4.3) |
| R-5.1-01 | I2 | E2E | – | – |
| R-5.1-02 | I2 | E2E | – | UI-F-8 (Q-009) |
| R-5.1-03 | I2 | E2E | – | – |
| R-5.1-04 | H-TESTS | E2E | – | UI-K-5 (Q-009) |
| R-5.1-06 | H-TESTS | E2E | – | – |
| R-5.1-07 | H-TESTS | E2E | – | – |
| R-5.1-08 | I2 | E2E | – | – |
| R-5.1-09 | H-TESTS | E2E | – | – |
| R-5.1-10 | I2 | E2E | – | – |
| R-5.1-11 | I2 | E2E | – | – |
| R-5.1-12 | I3 | E2E | – | – |
| R-5.1-13 | E1-02e | PDF | – | – |
| R-5.1-14 | I2 | E2E | – | – |
| R-5.1-15 | I2 | E2E | – | – |
| R-5.1-16 | I2 | E2E | – | – |
| R-5.1-17 | E1-03 | Unit | – | – |
| R-5.1-18 | E1-03 | Unit | – | F-48; Befund-Teil P1 in E1-06 |
| R-5.1-19 | E1-03 | Unit | – | – |
| R-5.1-20 | I3 | E2E | – | UI-K-1 (Q-009) |
| R-5.1-21 | I3 | E2E | – | – |
| R-5.1-22 | I3 | E2E | – | UI-F-6 (Q-009) |
| R-5.1-23 | I3 | E2E | – | – |
| R-5.1-24 | I3 | E2E | – | UI-F-8 (Q-009): Ziehen in Rap-Spalte → Rapport, in Beso-Spalte → Beso, im Band → Querbalken |
| R-5.1-25 | I3 | E2E | – | Gate S A1 (Katalog-Notiz I2) |
| R-5.2-01 | I2 | E2E | – | – |
| R-5.2-02 | I3 | E2E | – | F-16 |
| R-5.2-03 | I3 | E2E | – | – |
| R-5.2-04 | I3 | E2E | – | – |
| R-5.2-05 | I3 | E2E | – | – |
| R-5.2-06 | I3 | E2E | – | F-17 |
| R-5.2-07 | I3 | E2E | – | – |
| R-5.2-08 | E1-03 | Unit | – | – |
| R-5.2-09 | E1-03 | Unit | – | Befund-Teil P1 in E1-06 |
| R-5.2-10 | I3 | E2E | R-4.3-02 | eigener Test und Verweis (ADR-010 §5 Regel 4a) |
| R-5.3-01 | E1-03 | Property | – | – |
| R-5.3-02 | E1-03 | Unit | – | – |
| R-5.3-03 | E1-03 | Unit | – | – |
| R-5.3-04 | E1-03 | Unit | – | – |
| R-5.3-05 | E1-03 | Unit | – | F-13 |
| R-5.3-06 | E1-03 | Unit | – | – |
| R-5.3-07 | E1-03 | Unit | – | F-13 |
| R-5.3-08 | I3 | E2E | – | – |
| R-5.3-09 | E1-03 | Unit | – | F-52 |
| R-5.3-10 | E1-03 | Unit | – | F-14; Befund-Teil P17 in E1-06 |
| R-5.3-11 | E1-03 | Unit | – | – |
| R-5.3-12 | E1-03 | Unit | – | – |
| R-5.3-13 | E1-03 | Unit | – | – |
| R-5.3-14 | E1-03 | Unit | – | – |
| R-5.4-08 | E1-02e | Verweis | R-4.9-01, R-4.9-03, R-4.9-05, R-4.9-07, R-4.9-09, R-4.9-11, R-4.9-13, R-4.9-16, R-4.9-17 | – |
| R-5.5-01 | I5 | E2E | – | UI-F-2 (Q-009) |
| R-5.5-02 | I5 | E2E | – | – |
| R-5.5-03 | E1-05 | Unit | – | F-47 |
| R-5.5-04 | E1-05 | Unit | – | – |
| R-5.5-05 | E1-05 | PDF | – | – |
| R-5.5-06 | E1-05 | Integration | – | – |
| R-5.5-07 | I2 | E2E | – | – |
| R-5.5-08 | I5 | E2E | – | F-64 (Q-016) (Katalog-Notiz I2) |
| R-5.6-01 | I2 | E2E | – | – |
| R-5.6-02 | I2 | E2E | – | – |
| R-5.6-03 | I5 | E2E | – | – |
| R-5.6-04 | E1-04 | Unit | – | F-20 |
| R-5.6-05 | I4 | Integration | – | – |
| R-5.6-07 | E1-05 | Unit | – | – |
| R-5.6-08 | E1-04 | Unit | – | – |
| R-5.6-09 | I5 | E2E | – | – |
| R-5.6-10 | I5 | E2E | – | F-19 |
| R-5.6-11 | I5 | E2E | – | – |
| R-5.6-12 | I5 | E2E | – | – |
| R-5.6-13 | I5 | E2E | – | F-21 |
| R-5.6-14 | E1-04 | Integration | – | – |
| R-5.6-15 | E1-04 | Unit | – | – |
| R-5.6-16 | I2 | E2E | – | – |
| R-5.6-17 | E1-04 | Integration | – | – |
| R-5.6-18 | F-DOKU | Integration | – | bisher E1-11 E2E, umgehängt F-DOKU (SA-2-01); Prüfart-Abweichung E2E → Integration (Katalog-Kriterium, FD-01: kein älteres Schema in der App); Esc-Teil E2E; Q-009 UI-F-10 (SA0-33): Dialog «Sicherung vor dem Update» schliesst nicht mit Esc, ohne Entscheid kein Plan, Neuladen → Dialog erneut (Vertrag E1-11 §2c; Grundlage `pendingMigration`/`runMigration` aus E1-04) |
| R-5.7-01 | I5 | E2E | – | – |
| R-5.7-02 | I5 | E2E | – | – |
| R-5.7-03 | I2 | E2E | – | – |
| R-5.7-04 | I5 | Integration | – | – |
| R-6-01 | I3 | E2E | – | F-22 |
| R-6-02 | E1-02d | Unit | – | F-23, Q-032, Q-035 |
| R-6-03 | E1-02d | Unit | – | – |
| R-6-04 | E1-02d | Verweis | R-4.6-51, R-4.6-52, R-4.6-53 | – |
| R-6-05 | E1-02e | Unit | – | – |
| R-6-06 | I3 | E2E | – | – |
| R-6-07 | E1-02a | Unit | – | – |
| R-6-08 | E1-02e | PDF | – | – |
| R-6-10 | E1-05 | Unit | – | F-24; V-05-1 (Q-010) |
| R-6-11 | E1-05 | Unit | – | – |
| R-6-12 | E1-05 | Unit | – | F-24 |
| R-6-13 | I4 | E2E | – | – |
| R-6-14 | I4 | E2E | – | – |
| R-6-15 | I4 | E2E | – | – |
| R-6-16 | I4 | Integration | – | F-25 |
| R-6-27 | H-TESTS | E2E | – | UI-F-3 (Q-009): Tab/Shift+Tab und Ctrl+Pfeile (Fokus, Auswahl bleibt) ausserhalb der Bearbeitung von Etappe 2 nach 1 vorgezogen; Pfeile/Shift+Pfeile auf Einträgen ohne Wirkung (Vertrag E1-12 §2, SA0-33) |
| R-6-39 | F-DOKU | E2E | – | F-46; bisher E1-11, umgehängt F-DOKU (SA-2-01) |
| R-6-40 | I4 | Integration | – | ersetzt R-6-09 in Etappe 1 (Katalog nach Gate 0, SA0-22): Notiz nie im Export der Listenansicht |
| R-6-41 | I3 | E2E | – | Gate S A1 (A1-ID Stufe A) (Katalog-Notiz I2) |
| R-6-42 | I4 | E2E | – | Gate S A1; Q-044 (c) (A1-ID Stufe A) (Katalog-Notiz I2) |
| R-7-01 | I5 | Integration | – | – |
| R-7-02 | I5 | E2E | – | – |
| R-7-03 | I5 | E2E | – | – |
| R-7-04 | I5 | E2E | – | – |
| R-7-05 | I5 | E2E | – | – |
| R-7-06 | E1-02e | Property | – | Property auf dem PDF (synthetische Pläne) |
| R-7-07 | E1-02d | Property | – | – |
| R-7-08 | I5 | Unit | – | – |
| R-7-10 | I5 | Unit | – | – |
| R-7-11 | I5 | Unit | – | Gate S |
| R-7-12 | I5 | Unit | – | – |
| R-7-13 | I5 | Unit | – | – |
| R-7-34 | I5 | E2E | – | F-37; UI-F-5 (Q-009) |
| R-8.2-01 | I4 | Integration-Referenz | – | – |
| R-8.2-02 | I4 | Verweis | R-14.1-01 | – |
| R-8.2-04 | I4 | Integration-Referenz | – | – |
| R-8.2-05 | I4 | Unit | – | – |
| R-8.2-06 | I4 | Unit | – | F-30 |
| R-8.2-07 | I4 | Unit | – | – |
| R-8.2-08 | I4 | Unit | – | – |
| R-8.2-09 | I4 | Unit | – | – |
| R-8.2-10 | I4 | Unit | – | – |
| R-8.2-11 | I4 | Unit | – | Q-006 b (Gate 0 Nr 7): gruppiert je Blatt und Tag, einzeln > 4 Min; Abweichung vom Beschrieb; Vertrag E1-08 §1a |
| R-8.2-12 | I4 | Unit | – | F-31 |
| R-8.2-13 | I4 | Unit | – | – |
| R-8.2-14 | I4 | Unit | – | – |
| R-8.2-15 | I4 | Unit | – | – |
| R-8.2-16 | I4 | Unit | – | – |
| R-8.2-17 | I4 | Unit | – | – |
| R-8.2-18 | I4 | Unit | – | – |
| R-8.2-19 | I4 | Unit | – | F-32 |
| R-8.2-20 | I4 | Integration-Referenz | – | – |
| R-8.2-21 | H-TESTS | E2E | – | – |
| R-8.2-22 | E1-07 | Integration | – | – |
| R-8.2-23 | I4 | Unit | – | – |
| R-8.2-24 | I4 | Integration | – | – |
| R-8.2-25 | I4 | Unit | – | – |
| R-8.2-26 | I4 | Unit | – | – |
| R-8.2-27 | I4 | Unit | – | – |
| R-8.2-28 | I4 | Unit | – | F-33 |
| R-8.2-29 | I4 | Unit | – | – |
| R-8.2-30 | I4 | Unit | – | – |
| R-8.2-31 | I4 | Unit | – | – |
| R-8.2-32 | I4 | Unit | – | – |
| R-8.2-33 | I4 | Unit | – | – |
| R-8.2-34 | I4 | Unit | – | – |
| R-8.2-35 | I4 | Unit | – | – |
| R-8.2-36 | I4 | Integration | – | F-54 |
| R-8.2-37 | I4 | Unit | – | Q-044 (a), (b) (Katalog-Notiz I2) |
| R-8.2-38 | I4 | Unit | – | Q-044 (b), (c); Q-045 (g) (Katalog-Notiz I2) |
| R-8.2-39 | I4 | Unit | – | Q-044 (d); Q-040 (Katalog-Notiz I2) |
| R-8.2-40 | I4 | Unit | – | Q-044 (d) (Katalog-Notiz I2) |
| R-8.2-41 | I4 | Unit | – | Q-042; Q-044 (d) (Katalog-Notiz I2) |
| R-8.2-42 | I4 | Unit | – | Q-044 (d); VQ-I2-01 (Katalog-Notiz I2) |
| R-8.2-43 | I4 | Integration-Referenz | – | Q-043 (Katalog-Notiz I2) |
| R-8.2-44 | F-FIX | Unit | – | VQ-I2-01 (Katalog-Notiz I2); bisher E1-07b, umgehängt F-FIX (FD-03, Koordinator 20.10.2026) |
| R-9-01 | I5 | E2E | – | Rot-Nachweis per Mutation (ADR-010 §4.3) |
| R-10-01 | E1-02c | PDF | – | – |
| R-10-02 | E1-02e | PDF | – | – |
| R-10-03 | E1-02f | PDF | – | – |
| R-10-04 | I5 | PDF | – | F-43 |
| R-10-05 | E1-02c | PDF | – | – |
| R-10-06 | E1-02e | PDF | – | B-Kp (F-51); B-F-01, B-F-08 (Q-008) |
| R-10-07 | E1-02e | PDF | – | B-Kp (F-51) |
| R-10-08 | E1-02e | PDF | – | B-F-02 (Q-008) |
| R-10-09 | E1-02e | PDF | – | – |
| R-10-10 | E1-02e | PDF | – | B-F-03 (Q-008) |
| R-10-11 | E1-02e | PDF | – | – |
| R-10-12 | E1-02e | PDF | – | – |
| R-10-13 | E1-02e | PDF | – | B-Kp (F-51); B-F-09 (Q-008) |
| R-10-14 | E1-02e | PDF | – | – |
| R-10-15 | E1-02e | PDF | – | B-Kp (F-51) |
| R-10-16 | E1-02e | PDF | – | B-Kp (F-51) |
| R-10-17 | E1-02e | PDF | – | – |
| R-10-18 | E1-02e | PDF | – | F-27 |
| R-10-19 | E1-02e | PDF | – | B-Kp (F-51); B-F-04 (Q-008) |
| R-10-20 | E1-02e | PDF | – | – |
| R-10-21 | E1-02e | PDF | – | B-Kp (F-51) |
| R-10-22 | E1-02e | PDF | – | B-Kp (F-51) |
| R-10-23 | E1-02e | PDF | – | – |
| R-10-24 | E1-02e | PDF | – | B-F-05 (Q-008) |
| R-10-25 | E1-02e | PDF | – | – |
| R-10-26 | E1-02e | PDF | – | – |
| R-10-27 | I3 | PDF | – | B-Kp (F-51); UI-F-1/UI-K-3 (Q-009) |
| R-10-28 | I3 | PDF | – | – |
| R-10-29 | I3 | PDF | – | UI-F-1/UI-K-3 (Q-009) |
| R-10-30 | E1-05 | PDF | – | F-28; UI-F-2 (Q-009) |
| R-10-31 | I3 | PDF | – | F-28 |
| R-10-36 | E1-02c | PDF | – | – |
| R-10-37 | E1-02e | PDF | – | Vorgabe offen (Beschrieb 15); Gate S; B-F-07 (Q-008) |
| R-10-38 | E1-02e | PDF | – | Vorgabe offen (Beschrieb 15); Gate S |
| R-10-39 | E1-02e | Property | – | Gate S |
| R-10-40 | E1-02d | Unit | – | F-61 |
| R-10-41 | E1-02d | Unit | – | – |
| R-10-42 | E1-02e | PDF | – | – |
| R-10-43 | I5 | Unit | – | Gate S |
| R-10-44 | E1-02e | PDF | – | – |
| R-10-45 | E1-02e | Verweis | R-10-14 | – |
| R-10-46 | E1-05 | Verweis | R-6-10 | – |
| R-10-47 | H-LAYOUT | PDF | – | Gate S A1; Q-041; Q-045 (e), (g) (Katalog-Notiz I2) |
| R-10-48 | H-LAYOUT | Unit | – | Q-045 (b) (Katalog-Notiz I2) |
| R-10-49 | H-LAYOUT | Integration | – | Parität (R-5-01) (Katalog-Notiz I2) |
| R-10-50 | E1-02k | PDF | – | Gate S A3; B-Kp-58 (Katalog-Notiz I2) |
| R-10-51 | E1-02k | PDF | – | Gate S A4 (Katalog-Notiz I2) |
| R-10-52 | E1-02k | PDF | – | Gate S A4; Stellen nach Vertrag E1-02k (Katalog-Notiz I2) |
| R-10-53 | E1-02k | PDF | – | V-02e-4; B-Kp-77 (Katalog-Notiz I2) |
| R-11-01 | I2 | E2E | – | – |
| R-11-02 | I5 | Verweis | R-14.13-01 | – |
| R-11-03 | I5 | Integration | – | Rot-Nachweis per Mutation (ADR-010 §4.3) |
| R-11-04 | E1-11 | Verweis | R-5.5-07 | Ziel R-8.1-04 ab Etappe 3 |
| R-11-05 | I3 | Integration | – | – |
| R-11-06 | I5 | E2E | – | Rot-Nachweis per Mutation (ADR-010 §4.3) |
| R-11-07 | I5 | E2E | – | Rot-Nachweis per Mutation (ADR-010 §4.3); UI-F-7 (SA0-33): Ctrl+L/O/P/G übersteuern die Browser-Tasten (`defaultPrevented`), Alt+D und F6 nicht (Vertrag E1-17 §4b) |
| R-11-08 | I5 | E2E | – | Rot-Nachweis per Mutation (ADR-010 §4.3) |
| R-11-09 | I5 | E2E | – | Rot-Nachweis per Mutation (ADR-010 §4.3) |
| R-11-10 | I5 | E2E | – | Rot-Nachweis per Mutation (ADR-010 §4.3); G-7 a (Gate 0 Nr 1): Prüfung am PDF im Projekt `edge-tablet`, kein Lesemodus |
| R-11-11 | F-DOKU | Integration-Leistung | – | bisher E1-13a, umgehängt F-DOKU (HT-08; Messmethode Ablaufverfolgung); Drosselungsfaktor (Umgebungsprobe) |
| R-11-12 | I5 | Integration-Leistung | – | Drosselungsfaktor (Umgebungsprobe) |
| R-11-14 | I5 | Integration-Leistung | – | Drosselungsfaktor (Umgebungsprobe) |
| R-11-15 | I5 | Integration-Leistung | – | Drosselungsfaktor (Umgebungsprobe) |
| R-11-16 | I5 | Integration-Leistung | – | Drosselungsfaktor (Umgebungsprobe) |
| R-11-17 | F-IMPORT2 | Integration-Referenz | – | Drosselungsfaktor (Umgebungsprobe); Referenzdatei; Messung im Entwicklungsserver in `test:reference` (F-IMPORT2, HT-05; Testort-Abweichung von Integration-Leistung) |
| R-14-01 | E1-01 | Auftraggeber | – | B-Kp (F-51); Vorbereitung im Abnahmebericht |
| R-14-03 | E1-01 | Integration-Gate | – | – |
| R-14-04 | E1-AB | Auftraggeber | – | Vorbereitung im Abnahmebericht |
| R-14.1-01 | I4 | Integration-Referenz | – | F-01 |
| R-14.1-02 | E1-AB | Integration-Referenz | – | Test tests/wap/reference/abnahme/nacharbeit.ref.ts |
| R-14.2-01 | E1-02e | PDF | – | B-Kp (F-51); B-F-10 (Q-008) |
| R-14.2-02 | E1-02e | Verweis | R-4.7-05 | – |
| R-14.2-03 | E1-02e | PDF | – | B-Kp (F-51) |
| R-14.2-04 | E1-02e | Verweis | R-10-38 | Gate S |
| R-14.2-05 | E1-AB | Auftraggeber | – | Vorbereitung im Abnahmebericht |
| R-14.3-01 | E1-02e | PDF | – | – |
| R-14.3-02 | E1-02e | PDF | – | – |
| R-14.3-03 | GB-DOKU | Integration-Referenz | – | Gate S; Katalog-Prüfart PDF; Test über layout.fallbacks der importierten Referenzwochen; bisher E1-08, umgehängt GB-DOKU (Gate B 28.10.2026 Nr 3 a) |
| R-14.4-01 | E1-03 | Property | – | F-13 |
| R-14.4-02 | E1-03 | Property | – | – |
| R-14.5-01 | I4 | Integration-Referenz | – | Q-011 N-09: Kriterium nach Gate 0 – Überlappung nur, wenn im massgebenden Excel überlagert (Anhang A) |
| R-14.5-02 | I4 | Integration-Referenz | – | Q-011 N-09: wie R-14.5-01 |
| R-14.5-03 | I4 | Integration-Referenz | – | Q-011 N-05: je Woche mit Box im massgebenden Excel ein Eintrag (Anhang A: KVK und Wo 1) |
| R-14.5-04 | I4 | Integration-Referenz | – | – |
| R-14.5-05 | I4 | Integration-Referenz | – | – |
| R-14.5-06 | I4 | Integration-Referenz | – | – |
| R-14.5-07 | I4 | Integration-Referenz | – | – |
| R-14.5-08 | I4 | Integration-Referenz | – | – |
| R-14.5-09 | I4 | Integration-Referenz | – | – |
| R-14.7-01 | I5 | Unit | – | – |
| R-14.13-01 | I5 | E2E | – | – |
| R-14.14-01 | E1-17 | Verweis | R-11-11, R-11-12, R-11-14, R-11-15, R-11-16, R-11-17 | Ziel R-11-13 ab Etappe 2 |
| R-14.15-01 | E1-AB | Auftraggeber | – | Vorbereitung im Abnahmebericht |
| R-15-01 | E1-02a | Unit | – | Vorgabe offen (Beschrieb 15) |
| R-15-02 | E1-12 | Verweis | R-4.5-08, R-4.5-09 | Vorgabe offen (Beschrieb 15) |
| R-15-03 | E1-02a | Unit | – | Vorgabe offen (Beschrieb 15) |
| R-15-04 | E1-02e | PDF | – | Vorgabe offen (Beschrieb 15) |
| R-15-05 | E1-02e | Verweis | R-10-37, R-10-38 | Vorgabe offen (Beschrieb 15); Gate S |
| R-15-06 | E1-02b | Unit | – | Vorgabe offen (Beschrieb 15) |
| R-15-08 | E1-02e | PDF | – | B-Kp (F-51) |

## Anhang B – Vorgeschlagene Werkzeug- und Leitplanken-IDs (Etappe 1)

Quelle Prompt §7 (R-H, Fortsetzung der Harness-IDs aus `pakete/H0.md`), Prompt §3 und §5.6 (R-L). R-H-10 bis R-H-33 und R-L-01 bis R-L-08 stehen im Katalog (R-L-06 und R-L-07 seit Runde 3b, R-L-08 seit Katalog Runde 5). R-H-34 und R-L-09 (nach Gate 0, `plan/katalog-ergaenzung-e1.md`): im Katalog übernommen (Runde 6b). R-L-10 (Leitplanke 6, ADR-006 Punkt 2c) hat der `spec-analyst` nach SA0-33 direkt im Katalog angelegt; R-L-11 (Vertrag E1-07 §3 P13) und das erweiterte Kriterium von R-H-23 seit Katalog Runde 6d. Diese Tabelle ist die Paketzuordnung für `trace.mjs`. Wortlaut im Hinweis; Details in ADR-010.

| ID | Paket | Testart | Verweis auf | Hinweis |
| --- | --- | --- | --- | --- |
| R-H-10 | E1-01 | Integration-Gate | – | Prompt §7 Schleusen: schnelle Schleuse als ein Befehl (`npm run wap:gate:fast`) mit Node-Prüfung, Lock-Prüfung, Datenschutz-Scan, verbotenen Mustern, Lint, Typprüfung, Grenzen, Vitest, statischer Rückverfolgbarkeit, Lizenzen; läuft vor jedem Commit (ADR-010 3.1) |
| R-H-11 | E1-01b | Integration-Gate | – | Prompt §7 Schleusen: volle Schleuse als ein Befehl (`npm run wap:gate:full`) mit allen Tests inkl. E2E, PDF, Bildschirm-Regression, Leistung, `test:reference`, Abdeckung, Mutation, Suite-Regression (ADR-010 3.2) |
| R-H-12 | E1-01 | Integration-Gate | – | Prompt §7, §5.2 Schritt 5: Rot-Phase auf `wap/<paket>`: Tests mit IDs des laufenden Pakets fachlich rot, übrige grün; Klassifikation Assertion/Vertrags-Stub gegen Import/Syntax/Timeout (ADR-010 3.3, Entscheid E5) |
| R-H-13 | E1-01 | Integration-Gate | – | Prompt §7 Codequalität: Lint gegen `.only`/`.skip`, `TODO`/`FIXME`, Konsolenausgaben, `any`, Regel-Abschaltung ohne Begründung (ADR-010 4.1) |
| R-H-14 | E1-01 | Integration-Gate | – | Prompt §7 Codequalität: strikte Typprüfung der WAP-Pfadmenge (`tsconfig.wap.json`, ADR-010 4.2) |
| R-H-15 | E1-01 | Integration-Gate | – | Prompt §7 Rückverfolgbarkeit: Matrix Anforderung → Tests; Abbruch bei ID ohne Test (Umfang laufende und frühere Etappen), Test ohne ID, unbekannter ID, fremder Paket-ID, fehlendem positiv/negativ je Prüfregel (ADR-010 5) |
| R-H-16 | F-TOOLS | Integration-Gate | – | Prompt §7 Abdeckung: Zweigabdeckung ≥ 90 % (Fachlogik, Layout, Prüfregeln, Import) bzw. ≥ 75 % (übriger Code), je Pfadmenge und Modul, Vitest und E2E zusammengeführt (ADR-010 6) |
| R-H-17 | F-TOOLS | Integration-Gate | – | Prompt §7 Mutationstests: Stryker-Score ≥ 80 % für Fachlogik, Layout, Prüfregeln, Beso-Nummerierung, Formtext-Zerlegung; je Paket inkrementell, an der Etappen-Abnahme vollständig (ADR-010 6.3) |
| R-H-18 | E1-01 | Integration-Gate | – | Prompt §7 flatternde Tests: keine automatischen Wiederholungen in allen Konfigurationen, Stabilitätslauf (ADR-010 3.4) |
| R-H-19 | E1-01b | Integration-Gate | – | Prompt §7 PDF Ebene 2: Prüfhilfen lesen Text, Positionen, Schriftgrössen, eingebettete Schriften und Linien aus dem fertigen PDF, nicht aus dem Layout-Modell (ADR-010 7.2) |
| R-H-20 | F-TOOLS | Integration-Gate | – | Prompt §7 PDF Ebene 3: Golden-Bilder mit fixierter Render-Kette (`render-chain.json`), Status vorläufig/freigegeben, Vorher/Nachher/Differenz (ADR-010 7.3) |
| R-H-21 | E1-01c | Integration-Gate | – | Prompt §7: Bildschirm-Regression der Kernzustände (Infrastruktur, Registry der Kernzustände) (ADR-010 7.3) |
| R-H-22 | E1-01c | Integration-Gate | – | Prompt §7 Leistung: Protokoll (Drosselung aus Umgebungsprobe, Median 5 nach Aufwärmlauf, synthetischer Plan mit festem Startwert), harte Budgets, `perf-baseline.json`, Verschlechterung > 10 % blockierend; ohne Faktor oder mit `status: "offen"` rot (ADR-010 8) |
| R-H-23 | F-TOOLS | Integration-Gate | – | Prompt §7 Codequalität: Lizenzprüfung MIT, Apache-2.0, BSD, ISC; Schriften OFL; Ausnahmen nur mit Gate-Entscheid (ADR-010 9); erweitert (Katalog Runde 6d, Befund E1-02b-03): die ausgelieferte Einzeldatei enthält die Lizenztexte aller gebündelten Laufzeit-Abhängigkeiten und Schriften, Selbsttest «Lizenztext entfernt → rot» (`license-check.mjs`) |
| R-H-24 | E1-01 | Integration-Gate | – | Prompt §7 Datenschutz-Scan in beiden Schleusen, auch über Inhalte von `.xlsx`/`.pdf`-Fixtures und erzeugte Artefakte (ADR-010 10) |
| R-H-25 | E1-01c | Integration-Gate | – | Prompt §7 Offline-Test: Hilfe für dauerhaftes Profil, gesperrtes Netz, Neustart, Download (ADR-010 10) |
| R-H-26 | E1-01c | Integration-Gate | – | Prompt §7 Barrierefreiheit: automatische Prüfung je Kernzustand plus Fokus-Sichtbarkeit (ADR-010 10, Entscheid E3) |
| R-H-27 | E1-01 | Integration-Gate | – | FINDINGS F-001, Prompt §7 «dieselbe Umgebung»: Node-Versionsprüfung in Schleusen, Vitest- und Playwright-Konfigurationen |
| R-H-28 | E1-01 | Integration-Gate | – | Prompt §5.6, §7: Trennung von der Suite-CI (nur plattformunabhängige WAP-Vitest-Tests im Suite-`npm test`), Suite-Regression grün (ADR-010 4.5); V10 mit `test:oracle` (E10 a) |
| R-H-29 | E1-01 | Integration-Gate | – | ADR-001 Modulgrenzen, Leitplanke 2: Importprüfung und Reinheitsregeln (ADR-010 4.4) |
| R-H-30 | E1-01 | Integration-Gate | – | Prompt §5.6 «Dateien anderer Suite-Werkzeuge nur nach Freigabe»: Suite-Grenzprüfung gegen die freigegebene Liste |
| R-H-31 | E1-01 | Integration-Gate | – | Prompt §5.3 Punkt 2: Selbsttest S1–S5 (übersprungener Test, TODO, gesperrte Datei per Edit und per Befehl, AHV-Nummer, Test ohne ID) macht die Schleuse rot; Wiederholung an jedem Gate B |
| R-H-32 | F-TOOLS | Integration-Gate | – | Prompt §5.3 Punkt 2: Selbsttest S6 (Schrift unter Mindestgrösse im PDF) und S7 (Leistungsregression); bisher E1-02g bzw. nach Etappe 2 verschoben (SA-2-03), zurück in Etappe 1 |
| R-H-36 | F-TOOLS | Integration-Gate | – | Auftraggeberentscheid 08.10.2026: V1a-selbsttest-Wiederverwendung nach Git-Diff; Umsetzung aus E1-01i (387ac7d, Test 37ad236) wiederhergestellt (SA-2-03) |
| R-H-37 | F-TOOLS | Integration-Gate | – | Q-021 (Gate S S-5): Suite-vitest.config.ts mit maxWorkers 4, Schritt F7-worker (SA-2-03) |
| R-H-33 | E1-04 | Integration | – | Prompt §7 Migration: Migrations-Fixture Etappe 1 wird von jeder späteren Version verlustfrei geöffnet; höhere Formatversion abgelehnt |
| R-H-34 | E1-01 | Integration-Gate | – | Gate-0-Entscheid 11 b, im Katalog übernommen (Runde 6b): V11 prüft alle versionierten Textdateien (Stand und Commits; vor dem Merge nach `main` alle Commits seit `main`) gegen die Namen der Sperrliste, Ausgabe ohne Namen (ADR-010 3.2 V11, Vertrag E1-01 §2 `scanNames`, §6b) |
| R-H-35 | E1-01c | Integration-Gate | – | E1-01-31 (Katalog-Notiz I2) |
| R-H-38 | E1-01h | Integration-Gate | – | E1-01-26; SA-I2-21 (Katalog-Notiz I2) |
| R-L-01 | E1-02c | Integration | – | Leitplanke 4: PDF deterministisch (feste Metadaten, keine Zeitstempel; gleiche Eingabe → gleiche Bytes über Prozesse, Zeitzonen, Node und Edge) |
| R-L-02 | E1-02d | Unit | – | Leitplanke 2: Layout-Schicht rein und deterministisch, ohne DOM, Uhr und Zufall; gleiche Eingabe → gleiches Ergebnis |
| R-L-03 | E1-02b | Unit | – | Leitplanken 2 und 3, ADR-004: Textmessung aus derselben Schriftdatei; Metrik-Tabelle stimmt für alle Glyphen mit fontkit überein; ohne Kerning |
| R-L-04 | E1-02c | E2E | – | Leitplanke 2: Der Browser bricht nie selbst um; jede vorberechnete Zeile ist ein Element mit `white-space: pre` an berechneter Position |
| R-L-05 | E1-02c | E2E | – | ADR-004 Punkt 4: Lädt die Bildschirmschrift nicht, erscheint eine Meldung mit Ursache und nächstem Schritt statt einer Ersatzschrift |
| R-L-06 | H-TESTS | E2E | – | Prompt §5.6, ADR-001 «Tastatur» (G-1): Auf `/wap` lösen Suite-Undo, Suite-Redo und die Suite-JSON-Sicherung nie aus (Fokus auf `body`, im Raster, im Textfeld, bei offenem Dialog; Suite-Projekt unverändert, kein Suite-Download) |
| R-L-07 | I5 | E2E | – | Leitplanke 5, ADR-006 Punkt 2a (AR0-25): Während «Neuen Stand setzen» und Import ist die Bearbeitung gesperrt (modaler Fortschritt, «Abbrechen» schreibt nichts); eine vorher gespeicherte Änderung geht nicht verloren; Negativfall: gewöhnlicher PDF-Export sperrt nicht (Paket E1-17 nach PL0-32 b) |
| R-L-08 | E1-04 | Integration | – | Leitplanke 5, ADR-006 Punkt 2a (AR0-40): Revisionsabweichung zwischen Lesen und atomarem Schreiben bei «Neuen Stand setzen» → `conflict`, nichts geschrieben, zuvor gespeicherte Änderung erhalten (Importpfad: E1-08 `[R-5.6-05]`) |
| R-L-09 | F-DOKU | E2E | – | bisher E1-11, umgehängt F-DOKU (SA-2-01); Gate-0-Entscheid 2 = G-9 a: Hinweis zum gemeinsamen Speicher nur unter `file:` – `region` «Gemeinsamer Browserspeicher» in der WAP-Übersicht «?», Erststart-Knopf, Palettenbefehl (UI-Richtlinie 11.6; Vertrag E1-11 §2b mit Gegentest im Projekt `edge`) |
| R-L-10 | F-DOKU | Integration | – | bisher E1-11 E2E, umgehängt F-DOKU (SA-2-01); Prüfart-Abweichung E2E → Integration (Katalog-Kriterium, FD-01); Leitplanke 6, ADR-006 Punkt 2c (nach SA0-33): Dialog «Sicherung vor dem Update» bietet je Plan eine Plan-Datei im alten Format an (Standardknopf, `migrationBackupFileName`), je Plan Wiederherstellungspunkt `migration`, Scheitern → Datenbank im alten Format und «Update gescheitert» (Vertrag E1-11 §2c; Speicherfunktionen E1-04) |
| R-L-11 | E1-07 | Unit | – | Leitplanke 7, ADR-008 (G-10, E12 c), Vertrag E1-07 §3 P13 (Katalog Runde 6d): Import liest über das gemeinsame Lesemodul `src/io/xlsx-drawing/`; fünf Altmodule byteweise unverändert (SHA-256 §1a), Weiterleitungen in `src/io/wap/`; Unit-Tests der neuen Dateien nach §2a–§2g, Gleichlauf `calibrateSheetTime` mit `calibrate.ts`; der Altmodul-Test mit `[R-L-11]` liegt vertragsgemäss unter `tests/wap/integration/xlsx-drawing/` (Vertrag E1-07 §3) |
| R-L-12 | E1-04b | Integration | – | CR-E104-01; Vertrag E1-04 Runde 2 R2-1: Plan-Datei mit Stand-PDF ab 4 MiB ohne Absturz gesichert, gelesen und geöffnet, PDF bytegleich; Base64-Prüfung linear (Katalog-Notiz E1-04b) |
| R-L-13 | E1-04b | Unit | – | CR-E104-02; Vertrag E1-04 Runde 2 R2-2: Kürzen und Verwerfen ohne gekoppelten Schritt lesen keine Stand-Aufzeichnung, das Kürzen auch nach Neuladen (Katalog-Notiz E1-04b, SA-E104b-04) |
| R-L-14 | E1-04b | Integration | – | CR-E104-05; Vertrag E1-04 Runde 2 R2-3: `restore`, `restoreDeletedPlan` und `runMigration` behandeln eigene Schlüssel mit Wert `undefined` wie fehlende (Katalog-Notiz E1-04b) |
| R-L-15 | E1-04b | Integration | – | CR-E104-06; Vertrag E1-04 Runde 2 R2-4: `pendingMigration` neben `runMigration` und geschlossene Verbindung → nur `StorageError`, nie Zielversion als Ausgangsversion (Katalog-Notiz E1-04b) |

| R-H-39 | AE004 | Integration-Gate | – | AE-004 §3: identische Commit- und Merge-Hooks sowie Lock-Prüfung auf dem exakten Integrationszweig wap-codex |

## Anhang C – Prüfung «jede Etappe-1-ID genau einmal» und Zählungen

Befehl (Git Bash, im Wurzelverzeichnis des Worktrees; Ausgaben nur nach `.qa/`, damit `git status` sauber bleibt; ersetzt durch `trace.mjs`, sobald E1-01 gemergt ist). Gezählt wird über **Anhang A und B** (PL0-31):

```sh
Q=/c/Users/phili/source/repos/detachementsplaner-fdt/.qa/etappe0/plan-check; mkdir -p $Q
awk -F'|' '/^\| R-/ {id=$2; gsub(/ /,"",id); et=$5; gsub(/ /,"",et); if (et=="1") print id}' docs/wap-planer/requirements.md | sort > $Q/soll.txt
sed -n '/^## Anhang A/,/^## Anhang C/p' docs/wap-planer/plan/etappe-1.md | awk -F'|' '/^\| R-/ {id=$2; gsub(/ /,"",id); print id}' | sort > $Q/ist.txt
echo "Soll: $(wc -l < $Q/soll.txt)  Ist: $(wc -l < $Q/ist.txt)  doppelt: $(uniq -d $Q/ist.txt | wc -l)  fehlend: $(comm -23 $Q/soll.txt $Q/ist.txt | wc -l)  zuviel: $(comm -13 $Q/soll.txt $Q/ist.txt | tr '\n' ' ')"
sed -n '/^## Anhang A/,/^## Anhang C/p' docs/wap-planer/plan/etappe-1.md | awk -F'|' '/^\| R-/ {p=$3; gsub(/ /,"",p); t=$4; gsub(/ /,"",t); c[p]++; d[t]++} END {n=asorti(c,k); for (i=1;i<=n;i++) printf "%s=%d ", k[i], c[k[i]]; print ""; n=asorti(d,k2); for (i=1;i<=n;i++) printf "%s=%d ", k2[i], d[k2[i]]; print ""}'
```

Erwartung (Katalog Runde 6d, nach Übernahme von R-L-11): Soll = Ist = 432, doppelt, fehlend und zuviel leer. Seit der Katalog-Notiz I2 (06.10.2026): Soll = Ist = 465 (Ergebnis in der «Änderungsnotiz Katalog I2» am Planende).

Ergebnis (vom Skript erzeugt, 04.10.2026, Änderungsnotiz AE-001: 21 Paket-Zellen auf E1-01b–e, E1-02g, E1-13a/b; Katalog Runde 6d mit 573 IDs):

```
Soll: 432  Ist: 432  doppelt: 0  fehlend: 0  zuviel: 
E1-01=15 E1-01b=2 E1-01c=4 E1-01d=1 E1-01e=3 E1-02a=54 E1-02b=2 E1-02c=6 E1-02d=41 E1-02e=78 E1-02f=2 E1-02g=3 E1-03=25 E1-04=7 E1-05=11 E1-06=8 E1-07=2 E1-08=48 E1-09=2 E1-10=9 E1-11=28 E1-12=18 E1-13a=4 E1-13b=4 E1-14=16 E1-15=4 E1-16=18 E1-17=11 E1-AB=6
Auftraggeber=6 E2E=83 Integration=19 Integration-Gate=25 Integration-Leistung=6 Integration-Referenz=15 PDF=81 Property=14 Unit=168 Verweis=15 
```

Nachführung 06.10.2026 (Notiz «Schnitt R-L-08 nach E1-04»): R-L-08 (Anhang B) von E1-05 nach E1-04, also E1-04 6 → 7 und E1-05 12 → 11; Summe 432 und Testarten unverändert.

Nachführung 06.10.2026 (Katalog-Notiz I2 und CR-E101c-V02): Soll = Ist = 465. R-H-35 gehört zu E1-01c, R-H-36 zu E1-01c2; damit E1-01c=5 und E1-01c2=1. Ergebnis des Laufs: «Änderungsnotiz Katalog I2» am Planende.

Nachführung 07.10.2026 (Katalog-Notiz E1-04b): Soll = Ist = 469. R-L-12 bis R-L-15 gehören zum Paket E1-04b (Anhang B); damit E1-04b=4, Integration +3, Unit +1. Ergebnis des Laufs: «Änderungsnotiz Katalog E1-04b» am Planende.

Zusatz (gleicher Lauf): Anhang A 396 Zeilen, Anhang B 36 Zeilen. Runde 7: gegenüber Runde 6d nur E1-02a 56 → 54 und E1-02e 76 → 78; Testarten unverändert (Verweis 15). Runde 6d: R-L-11 (E1-07, Anhang B, Unit) neu; gegenüber dem Lauf mit 431 nur E1-07 1 → 2 und Unit 167 → 168. Vorlauf (Katalog nach SA0-33, 572 IDs): Soll = Ist = 431. Nach SA0-33: R-5.6-18 (E1-11, Anhang A) und R-L-10 (E1-11, Anhang B) neu. Änderungen gegenüber Runde 5: R-6-09 (jetzt Etappe 3) entfernt, R-6-40 (E1-08) neu; R-4.6-62 (E1-02d), R-5.1-24 und R-6-27 (E1-12) neu; R-H-34 (E1-01) und R-L-09 (E1-11), vom `spec-analyst` in den Katalog übernommen.


## Änderungsnotiz AE-001 (04.10.2026, `architect`): Schnitt in Inkremente

Grundlage ist `auftragsaenderungen/AE-001.md` §1–§3, §5; bei Widerspruch gilt diese Notiz. Pakete und IDs bleiben, neu geschnitten sind Reihenfolge und Bündelung (Prompt §5.4). Die Zuordnung steht in Anhang A/B, die Zählung in Anhang C.

**Teilpakete und Besitz**
- **E1-01-min:** Besitz wie §4.1, ohne die Dateien von b–e (Vertrag E1-01, Notiz).
- **E1-01b** (R-H-11, R-H-19): PDF-Auslesung, Bildvergleich, Playwright-Grundlauf und Build-Hilfe für die Zwischenstände. Besitz: `tests/wap/support/pdf/**`, `tests/wap-e2e/support/fixtures.ts`, `playwright.wap.config.ts`, `e2e.mjs`.
- **E1-01c** (R-H-21, -22, -25, -26): `tests/wap-perf/{support,harness}/**` ohne `entries/`, `kernzustaende.visual.spec.ts`, `perf-*.mjs`.
- **E1-01d** (R-H-20):
  - Besitz: `tests/wap/golden/durchstich/**` und `tests/wap/golden/baselines/kvk-*.png` (bisher E1-02f), `vitest.wap-golden.config.ts`, `scripts/wap-gate/golden-report.mjs`.
  - `tests/wap/golden/{render-chain,manifest}.json` ändert nur der Orchestrator per `lock-update`.
  - E1-10 behält `tests/wap/golden/extras/**` und `tests/wap/golden/baselines/extras-*.png`.
- **E1-01e** (R-H-16, -17, -23): `coverage-check.mjs`, `stryker.wap.conf.mjs`, `license-check.mjs`.
- **Gemeinsam genutzte Dateien:** `package.json` und `package-lock.json` ändern E1-01-min und b–e nur nacheinander (§1 Nr 7).
- **E1-02g** (R-11-15, -16, R-H-32): `tests/wap-perf/pdf/**`, `entries/e1-02g.ts` (statt `e1-02f.ts`), `tests/wap-gate/selftest-s6s7.selbsttest.ts`. Das ist die Ausnahme vom Besitz `tests/wap-gate/**`.
- **E1-13a** (R-4.6-61, R-5.1-14, -16, R-11-11): Verschieben, Ziehen über Tage, «Entf/Löschen» eines Eintrags. Ändert `src/components/wap/{grid,marks}/**`; Tests `tests/wap-e2e/grid-move/**`, `tests/wap-perf/drag/**`, `entries/e1-13a.ts`.
- **E1-13b** (R-5.1-20, -21, -22, R-6-01): `src/components/wap/{clipboard,dialogs/also-on-days}/**`, Tests `tests/wap-e2e/grid-multi/**`. Vertrag E1-13 §1 und §4 teilt der `architect` in Schritt 2 von E1-13a nach Inhalt auf.
- **E1-02f** wird vor Gate S **ohne Schritt 8** gemergt. Die KVK-Golden-Bilder (Prompt §5.2 Schritt 8, `visual-qa`) entstehen in E1-01d; ihre Tests tragen `[R-H-20]` und dazu die IDs von E1-02f.
- **Weitere Stellen mit alten Paketnamen:**
  - SA-Auslöser «E1-13»: SA-04 und SA-13 lösen mit E1-13b aus, alle übrigen mit E1-13a.
  - Leistungsmessung «ab E1-02f» (§6, R-01, R-13) gilt ab E1-02g.
  - Golden «E1-02f» (§6) gilt als E1-01d.

**Inkremente** (Stufe A = voll streng, B = leicht; «B; … A» heisst: die genannten IDs in Stufe A; Auslegung vorläufig, Vorlage an Gate S. KI-Zeit in Wanduhr-Stunden inkl. Prüfrunden.)

| Inkrement | Pakete (Stufe) | KI-Zeit | Probierliste |
| --- | --- | --- | --- |
| vorab | E1-01-min (B; R-H-24, -34 A) | 12–16 h | – |
| I1 → Gate S | E1-02a–f (A), E1-01b (B; R-H-19 A); E1-07, E1-03 (A) laufen an | 50–70 h | Optik, Schriftgrössen, Seitenleiste |
| I2 | E1-01d (B, gleich nach Gate S), E1-03, E1-04, E1-05 (A), E1-01c (B), E1-02g (B; R-11-15/-16 A), E1-11 (A), E1-12 (B; R-5.1-10, -11 A), E1-13a (B) | 50–65 h | ziehen, betiteln, verschieben, löschen, sichern, Undo nach Neuladen |
| I3 | E1-09 (A), E1-13b (B; R-5.1-21, R-6-01 A), E1-14 (A) | 15–22 h | Beso, Rap, Querbalken, Marker, Seitenfeld |
| I4 | E1-07 Rest, E1-08 (A), E1-15 (B; R-6-15 A) | 20–28 h | Import Kp-Excel, Bericht, Liste |
| I5 → Gate B | E1-06, E1-10, E1-16, E1-17 (A), E1-01e, E1-AB (B) | 35–50 h | Stand, Befunde, Wiederherstellung, offline |

Grundlage der Schätzung: Stufe A etwa 1 h je 5 IDs plus 2–4 h Prüfung, Stufe B eine Runde; kritischer Pfad mit höchstens vier Paketen gleichzeitig.

**Abweichungen von der Richtschnur:**
1. E1-03 und E1-05 kommen nach I2: E1-04, E1-12, E1-11 und E1-08 hängen von ihnen ab (§3).
2. E1-09 kommt nach I3, weil E1-14 von ihm abhängt.
3. Der Playwright-Grundlauf kommt in I1: R-L-04, R-L-05 und R-5-01 sind Browser-Tests vor Gate S.
4. S7 und R-11-15/-16 wandern nach E1-02g (I2), weil die Leistungsmessung nach AE-001 in I2 kommt.
   - S6 bleibt vor Gate S. Der Selbsttest von E1-01b trägt `[R-H-19]`.
   - Nach dem Merge von E1-02f führt der Orchestrator bei M2 `wap:gate:selftest --nur S6` gegen das Produkt-Layout aus; der Beleg kommt in die Gate-S-Vorlage, S7 steht dort als offener Punkt.
5. Die Golden-Bilder von E1-02f entstehen in E1-01d.

**Zwischenstand:**
- Versioniert wird nur eine Einzeldatei mit dem synthetischen, fiktiven Plan.
- Die KVK-Ansicht gibt es nur in der Gate-S-Vorlage bzw. lokal in `.qa/`.
- Die Einstiegsseite für I1 gehört E1-02f, gebaut mit der Build-Hilfe aus E1-01b.

**Ausblick:** Die Etappen 2–4 werden ebenso in Inkremente geschnitten (Filter, Bat-Import, Tagesbefehl).

## Änderungsnotiz Vertrag E1-02f Schritt 2 (05.10.2026, architect) – eingetragen vom Orchestrator (CR-E102f-V19)

- **§4.7 E1-02f:** IDs R-5-01, R-10-03 (R-11-15, R-11-16, R-H-32 bei E1-02g, Notiz AE-001). Besitzt `src/io/wap-pdf/{planPdf,index}.ts`, `src/components/wap/render/{WeekPageView.tsx,weekPageView.css}`; Tests `tests/wap/pdf/plan/**` (mit `support/golden-kandidaten.mjs`), `tests/wap-e2e/parity/**`, `tests/wap-e2e/harness/week.*`, `tests/wap-e2e/harness/zwischenstand-i1.*` (Einstiegsseite I1). Nicht mehr: `tests/wap/golden/**` (E1-01d), `tests/wap-perf/**` und `tests/wap-gate/selftest-s6s7.*` (E1-02g). Testplan: Integration Parität in `edge` und `edge-dist` (Vertrag E1-02f G, J), PDF Gesamt-PDF (J), S6 am Produkt-PDF und V5-ebene2 bei M2 (H), Golden-Kandidaten per Skript vor Gate S (I). `testpfade.json` Eintrag «E1-02f» per `lock-update` beim Freeze.
- **§4.16 E1-11, Schnittstellen:** `createWapStore({ …, renderers? })` mit Standard `defaultRenderers(templates)` statt `defaultRenderers()`; `WapRenderers.exportWeek(plan, weekId, options, title)` und `exportPlan(plan, options, title)` liefern `RenderedPdf`; `StandRenderers.week(plan, weekId, title)` und `.plan(plan, title)` (E1-05); neu `WapStore.pageOptions` (stabiles `PageOptions`-Objekt für `GridArea` und die Bildschirmansicht). Grund: Vertrag E1-02f T-1, T-5 und Abschnitt R.
- **§4.10 E1-05:** zusätzlich `standsSameDayFor`, `nextStandsSameDay`, `exportTitle` und das Feld `StandRecord.standsSameDay` (Vertrag E1-02f R).

## Schnitt R-L-08 nach E1-04 (06.10.2026, Orchestrator-Entscheid O-1)

- **Grund:** Das Abnahmekriterium von R-L-08 verlangt `fake-indexeddb` und die Anzahl Datensätze je Speicherbereich; das ist `commitAtomic` von E1-04. Seit Vertrag E1-05 «Ausarbeitung Schritt 2» hängt E1-05 nur vom Port `StandStore` ab und läuft vor E1-04 (Codex-Probelauf, AE-002); nach §1 Nr 6 gehört die ID dem Paket, das die Eigenschaft zuletzt ermöglicht. Der E1-05-Anteil (Revision R0 unverändert übergeben, Konflikt weitergeben, nichts sonst schreiben) ist über `[R-5.5-04]` Fall (7) belegt (Vertrag E1-05 Abschnitt G).
- **Geändert:** Anhang B Zeile R-L-08 Paket E1-05 → E1-04; Anhang C E1-04 6 → 7, E1-05 12 → 11 (Summe 432 unverändert); `pakete/E1-05.md`; Verträge E1-04 und E1-05 (Notizen). ~~§2, §4.9, §4.10 und Risiko R-19 nennen R-L-08 noch bei E1-05; massgebend ist Anhang B.~~ *(Überholt: seit der Nachführung V03 unten nennen §2, §4.9, §4.10 und R-19 R-L-08 bei E1-04; Vertragsprüfung E1-05 R2, V13.)*
- **Notiz aus Vertrag E1-05 (J5, architect):** E1-05 hängt von E1-02a und E1-03 ab (nicht mehr von E1-04 und E1-02f); E1-04 hängt zusätzlich von E1-05 ab (Port `StandStore`, `Clock`); §4.10 Besitz zusätzlich `tests/wap/support/stand/**`. E1-08 hängt weiter von E1-04 und E1-05 ab.
- **Nachführung nach Vertragsprüfung E1-05 Runde 1 (06.10.2026, architect, V03):** §2 (Zeilen E1-02e, E1-02f, E1-04, E1-05: Abhängigkeiten, Zählung, Parallelität), §3 (Abhängigkeitsbild, Satz zu E1-08), §4.9 und §4.10 (IDs, Besitz `tests/wap/support/stand/**`, Testplan) und Risiko R-19 direkt angepasst, weil Tabellen und Bild maschinenlesbar bzw. sonst irreführend wären. Grund: Vertrag E1-05 «Ausarbeitung Schritt 2» Abschnitt A (Port `StandStore`) und Entscheid O-1.

## Änderungsnotiz Gate S / I2 (06.10.2026, `architect`; Runde 2 nach Planprüfung SA-I2-01..-19)

**Grundlagen**
- `gates/gate-S-entscheid.md`: S-1 b mit Auflagen A1–A4; «Umsetzung als Nachträge mit eigenem Vertrag und Tests (Stufe A). Golden-Aufnahme (E1-01d) erst nach A2 bis A4. Ergebnis im Zwischenstand I2 zeigen, kein neues Gate.» Dazu S-2 bis S-5.
- AE-001 §1/§3, AE-002 §3/§4, Prompt §5.2, §5.4.
- Referenzprüfung `.qa/i2/gate-s-auflagen/visual-qa-1.md`; Planprüfung `.qa/i2/spec-auditor-schnitt-1.md`; die Entscheide des Orchestrators zur Planprüfung vom 06.10.2026.

**Vorrang**
- Diese Notiz gilt vor §2–§4 und vor der Notiz AE-001, wo sie abweicht.
- Die beiden Orchestrator-Zusätze unter dieser Notiz gehen ihr vor. Ausnahme: der Halbsatz «die Darstellung (E1-02i) wartet auf Q-041»; er ist durch den Entscheid zu SA-I2-03 überholt (siehe E1-02i).
- Neue IDs kommen erst mit der Katalog-Änderungsnotiz (1.4) in Anhang A/B; Anhang C zählt das Skript.

### 1.1 Regel für die Rot-Phase der Nachträge

Gilt nach ADR-010 §3.3 für jeden Nachtrag dieser Notiz:
- Ein Nachtrag erhält für sein **neues oder geändertes Verhalten neue IDs** (1.4). Bestehende IDs bleiben bei ihrem Paket; ihr Wortlaut wird nur per Katalog-Notiz nachgeführt.
- Jeder Test, der vor der Umsetzung rot ist, trägt **mindestens eine neue ID des Nachtrags**. Neu eingefrorene Tests nennen die alte ID weiter (Plan §1 Nr 5).
- Jeder übrige Test bleibt grün. Sonst bricht F8: «Test des Pakets schon grün» bzw. «fremder Test rot».
- Ein Nachtrag ohne neues Produktverhalten (E1-02j) hat keine eigene ID. Bei ihm ist Kästchen 7 mit «entfällt» angekreuzt, und der Rot-Nachweis läuft ausserhalb des Commits als Gegenprobe.
- **Ausnahme E1-05 Runde 2** (Entscheid Orchestrator, SA-I2-09/-17):
  - Regressionstests zu bereits umgesetztem Verhalten sind dort grün und erhalten den Rot-Nachweis per protokollierter Mutation mit `fachlichRot`.
  - Kästchen 7 bleibt angekreuzt.
  - Runde 2 läuft im bestehenden Worktree; er wird danach entfernt.

### 1.2 Nachträge (Stufe A, Worktree `wap-wt/<id>`)

Im ganzen I2 ändert nur E1-02h `src/model/wap/types.ts` und `src/model/wap/template/**`.

**E1-02h – A1 Modell, V-02e-4 Modell, Q-023**
- **Ändert:**
  - `src/model/wap/{types,validate,factories}.ts`, `src/model/wap/template/**`, `src/model/wap/derive/**` (Kürzelliste);
  - `src/model/wap/commands/entries.ts` nur, wenn der Vertrag es verlangt.
- **Tests neu:** `tests/wap/unit/model/nachtrag-gate-s*.test.ts`, `tests/wap/property/model/nachtrag-gate-s.test.ts`, `tests/wap/unit/commands/nachtrag-teilaufgaben.test.ts`.
- **Neufreeze:** Tests der Kürzelliste mit R-4.7-14, deren Erwartung sich durch Q-023 ändert («nur gedruckte Felder»); sie tragen zusätzlich die neue Q-023-ID.
- **Inhalt:**
  - **A1:** `Block.subtasks` ist optional; leer heisst, das Feld fehlt (kanonisch). Eine Teilaufgabe ist ein Wert ohne ID: Titel (`RichText`), Ltg, Ort optional. **Kein Feld «Stufe»**, bis Q-041 entschieden ist.
  - **V-02e-4 (S-4):** `meaning` in `TemplateRapportCode`, Kp-Vorlage mit Bedeutungen; optionales Planfeld `abbreviationMeanings`.
  - Beides lässt `schemaVersion` bei 1, weil keine Etappe-1-Datei ausgeliefert ist, und braucht keinen Neufreeze der Block-Literale und Fabrik-Erwartungen in E1-02a–f und E1-03.
- **Arbeitsannahme bis zur Antwort auf Frage 1.5 (a):** Die erste Gruppe ist der Block selbst (Titel und Ltg des Blocks). Die weiteren Gruppen sind Teilaufgaben.
- **Hängt ab von:** Katalog-Notiz. **Vor:** E1-04 Schritt 2 (Felder, Schema) und Schritt 3 (Migrations-Fixture mit Teilaufgabe und `abbreviationMeanings`).
- **Testplan:**
  - Unit: Validierung; Kürzelliste mit Teilaufgaben und nach Q-023; Bedeutung Planfeld vor Vorlage; Kopieren und «auch an anderen Tagen» übernehmen die Teilaufgaben; Undo über `command`.
  - Property: Rundreise über JSON; Befehl ∘ Inverse = Identität.

**E1-02j – A2 KVK-Fixture** (nur Testdaten, keine eigene ID, Kästchen 7 «entfällt»)
- **Ändert:**
  - `tests/wap/fixtures/durchstich/kvk.plan.json`: e40, e56 und e82 entfallen; e54 → 0945–1200 und e73 → 0830–1200 nach Arbeitsannahme Q-042; übrige IDs und `nextId` bleiben;
  - nötigenfalls `tests/wap/support/page/varianten.ts`.
- **Neufreeze:** die Erwartungen, die die Einträge zählen oder nennen; sicher `tests/wap/integration/model/kvk-fixture.test.ts` (Zählungen) und `tests/wap/unit/page/nachtrag-s318.test.ts` (Rückfall-Liste). Die übrigen ermittelt ein Lauf; die Liste steht vor dem Freeze im Vertrag.
- **Hängt ab von:** – (die Fälle liefert visual-qa-1).
- **Testplan:** Gegenprobe: neue Erwartungen gegen die alte Fixture sind rot (Assertion). VQ-E102e-04 (NaE) neu messen. Die geänderte Rückfall-Liste (Q-032 A) im Zwischenstand I2 ausweisen.
- Antwortet der Auftraggeber zu Q-042 «nicht kürzen»: Neufreeze der Fixture und eigener Golden-Commit.

**E1-02k – A3, A4 und Bedeutungsspalte**
- **Ändert:**
  - `src/model/wap/layout/page/geometryKp.ts`: nur `rapportBorder` 0,96 → 0,48 (A3; übrige Rahmen nur melden, Q-039);
  - `src/model/wap/layout/page/**`: Seitenleiste, die 7 Abweichungen aus visual-qa-1 A4 nach «gleich behandeln», dazu die Bedeutungsspalte (V-02e-4);
  - `docs/wap-planer/anhaenge/anhang-b-kp.csv` (B-Kp-58, die Seitenleisten-Zeilen, neue Zeilen per `lock-update`);
  - Tests `tests/wap/{unit,pdf}/page/nachtrag-rahmen*.test.ts`.
- **Neufreeze:**
  - Tests mit B-Kp-58/R-10-19 (`pdf/page/eintraege.test.ts`, `pdf/page/b-kp/pruefer.ts`, `support/page/{bkp,stile}.ts`, `unit/page/geometrie.test.ts`);
  - Seitenleisten-Tests (per Lauf);
  - TR-E102e-31 und CR-E102e-14 (`pdf/page/raster.test.ts`, `unit/page/**`).
- **Hängt ab von:** Merge E1-02j (gemeinsame KVK-Erwartungen) und Merge E1-02h (Bedeutungen); Katalog-Notiz.
- **Testplan:**
  - PDF Ebene 1: Rapportrahmen = Blockrahmen 0,48 pt ± 0,12; je Abweichung 1–7 eine B-Kp-Zeile; Bedeutungsspalte gefüllt (Planfeld vor Vorlage).
  - PDF Ebene 2 und Parität.
  - Schliesst VQ-E102e-01 und VQ-E102f-04; prüft VQ-E102e-03 und VQ-E102f-03 (Seitenleiste) mit.

**E1-02i – A1 Darstellung** (Lesart (1), wie in der Referenz)
- **Darstellung:** je Gruppe Titel fett, darunter die Ltg normal (Format «Ltg (Ort)» nach B-Kp-53), eine Leerzeile zwischen den Gruppen, zentriert. **Kein Einzug**, bis Q-041 entschieden ist. Bei «ja» zu Lesart (2) folgt ein eigener Nachtrag.
- **Ändert:** `src/model/wap/layout/entries/{text,blocks,draft,layoutEntries}.ts`; Rückfallreihenfolge mit Teilaufgaben nach 1.4 (a).
- **Tests neu:** `tests/wap/{unit,property}/grid/nachtrag-teilaufgaben.test.ts`, `tests/wap/support/arbitraries/teilaufgaben.ts`, `tests/wap/pdf/page/nachtrag-teilaufgaben.test.ts`, `tests/wap-e2e/parity/nachtrag-teilaufgaben.spec.ts`, fiktive Beispielwoche `tests/wap/fixtures/teilaufgaben/beispiel.plan.json`.
- **Neufreeze:** `kvk.plan.json` (e35 mit Teilaufgaben, Ltg pseudonymisiert) und die davon betroffenen KVK-Erwartungen (per Lauf).
- **Hängt ab von:** Merge E1-02h und E1-02k.
- **Testplan:**
  - Unit: Zeilenfolge, Leerzeile, Rückfallreihenfolge.
  - Property: kein Text ausserhalb des Rahmens; Rückfall ⇔ P8.
  - PDF Ebene 1/2.
  - Parität.
  - Regression: Das KVK-PDF ist vor der Erweiterung von e35 bytegleich.

**E1-03b – Q-026 «geändert» automatisch** (neue ID)
- **Ändert:** `src/model/wap/commands/{command,beso}.ts`.
- **Tests:** `tests/wap/unit/commands/nachtrag-q026.test.ts`.
- Läuft parallel zu E1-02h, ausser der Vertrag von E1-02h ändert `entries.ts`; dann läuft E1-03b danach.
- **Testplan:** Unit: Beso-Bearbeitung nach dem Stand setzt `changed`; ohne Stand nicht; Undo stellt den alten Wert her; `applyStand` setzt zurück (E1-05 D1 c, unverändert).

**E1-07b – VQ-I2-01 Anker der Markerlinien** (bisher «E1-07-Nachtrag Einzug», umgewidmet; neue ID)
- **Ändert:** `src/io/xlsx-drawing/**`.
- **Tests:** `tests/wap/unit/xlsx-drawing/nachtrag-anker.test.ts`.
- **Zeitpunkt:** vor E1-08 Schritt 3; darf in I2 als Füller laufen.
- **Testplan:** Unit mit fiktiven Arbeitsmappen: die Lage der Linienform aus dem Anker entspricht der gerenderten Lage; lokal einmal gegen die Referenz (nur Zahlen).

### 1.3 Folgen in anderen Paketen (Testpläne, Stufe A für die A1/A2-Teile)

**E1-08** (A)
- **Regel 12:** Teilaufgaben werden an **fett/normal und Leerabsatz** erkannt, nicht am Einzug, weil die Quelle keinen Einzug hat. Merkmale nach Frage 1.5 (b).
- **Regeln 8 und 11:** ganz verdeckt → kein Eintrag, Bericht «verdeckt»; teilweise verdeckt → Eintrag und Bericht. Definition und Schwellen kommen als Notiz in ADR-008 nach Frage 1.5 (d).
- **Testplan:**
  - Unit: Gruppenbildung samt den 3 Grenzfällen als Gegenprobe; e35-Muster mit 3 Gruppen (2 mit Ltg); Schwellen-Grenzfälle 98,9/99,0 % und 4,9/5,0 %; nur deckende gefüllte Formen; Malreihenfolge mit Gruppen und Transformation; Linien nie «verdeckt».
  - Integration-Referenz gegen den nach Q-043 und 1.5 bestätigten Anhang A: die 16 ganz verdeckten Formen als Berichtseinträge, kein Eintrag.
- Der Anhang-A-Entscheid (Q-043, Frage 1.5) liegt **vor E1-08 Schritt 2** vor; das ist der einzige Zeitpunkt (SA-I2-15).

**E1-12** (B; A1-ID A)
- Hängt zusätzlich von E1-02h ab.
- E2E: Das Detail beim Überfahren (R-6-06) zeigt Teilaufgaben mit Titel, Ltg und Ort in der Reihenfolge, auch für Screenreader (`aria-describedby`).

**E1-14** (A)
- Im Seitenfeld ein `grid` «Teilaufgaben» (Titel, Ltg, Ort; hinzufügen, verschieben, entfernen) und ein Eingabefeld «Bedeutung» in der Kürzelliste (V-02e-4).
- E2E mit Maus und nur mit Tastatur: jede Aktion ist ein Undo-Schritt; Undo nach Neuladen; Raster und PDF zeigen die Änderung ohne weitere Aktion.

**E1-15** (B; A1-ID A)
- Spalte «Teilaufgaben» einblendbar; E2E.
- Die Exportfelder für Anhang A bleiben gleich, **unter Vorbehalt der Antwort zu Frage 1.5 (c)**.

**Weitere**
- UI-Richtlinie: `ui-designer`, Stufe B.
- Tagesbefehl-Lieferung: Etappe 4 (Beschrieb 13). Sie wird dem Auftraggeber mit Q-038 und im Zwischenstand I2 vorgelegt (SA-I2-12).

### 1.4 Lieferung `spec-analyst`

Katalog-Änderungsnotiz, Stufe B, eine Prüfrunde `spec-auditor`.

- **Neue IDs mit Paket und Testart:**
  - (a) A1: Modell, Validierung, Kopieren/Undo, Kürzelliste (E1-02h); Darstellung, Rückfallreihenfolge, Parität (E1-02i); Detail (E1-12), Seitenfeld (E1-14), Liste (E1-15), Regel 12 (E1-08); Tagesbefehl (Et. 4).
  - (b) A2: «verdeckt», «teilweise verdeckt» (E1-08).
  - (c) A3: Rapportrahmen dünn (E1-02k).
  - (d) A4: Seitenleisten-Rahmen (E1-02k).
  - (e) V-02e-4: Bedeutung Modell (E1-02h), Bedeutungsspalte PDF (E1-02k), Eingabe (E1-14).
  - (f) Q-023 (E1-02h).
  - (g) Q-026 (E1-03b).
  - (h) VQ-I2-01 (E1-07b).
  - (i) Werkzeug-IDs für E1-01-31 und Q-020 (E1-01c) und für Q-021 (E1-01e), in Anhang B.
- **Wortlaut nachführen:**
  - R-10-19: dünner Rahmen; Gate S A3; Abweichung von Beschrieb 10 und B-F-04; bleibt bei E1-02e;
  - R-4.7-14 (Q-023), R-10-21 (A4, bleibt bei E1-02e);
  - R-5.3-09: Fall (d) nach F-64 (Q-016 entschieden). Der Test kommt in E1-05 Runde 2, mit `[R-5.3-09][R-5.5-04]`.
- **Liste der Bedeutungen der Kp-Rapportkürzel** für die Vorlage: allgemeine Kürzel, keine Namen.
- **Anhang-A-Prüfung A1/A2:** Liste nur lokal, versioniert nur Zahlen; Vorlage nach Q-043 und Frage 1.5.

### 1.5 Vorschlag Frage an den Auftraggeber (A1, A2 und Anhang A; der Orchestrator trägt sie ein)

- **(a) Modell e35:** Die erste fette Gruppe mit ihrer Ltg-Zeile ist der Block selbst, die weiteren Gruppen sind Teilaufgaben.
  - Vorgabe: so.
  - Alternative: alle Gruppen sind Teilaufgaben, der Blocktitel ist leer.
- **(b) Regel 12:**
  - Teilaufgaben gibt es, wenn ein Block mindestens 2 durch einen Leerabsatz getrennte Gruppen hat (fette Zeile(n), dann direkt normale Zeile(n)), von denen mindestens 2 eine solche normale Zeile haben.
  - Die normale Zeile ist die Ltg der Gruppe, auch ohne Klammer; eine Klammer darin gilt als Ort. Das weicht ab vom Normalisierungsentscheid 6 («Kp: Text vor der Ortsklammer = Ltg»), nur für solche Blöcke.
  - Eine Gruppe ohne normale Zeile ist eine Teilaufgabe ohne Ltg.
  - Sonst gilt die Zerlegung wie bisher (Normalisierungsentscheid 5). Die 3 Grenzfälle (Wo1 So, Wo3 Do/Fr) bleiben damit ohne Teilaufgaben.
- **(c) Anhang A Z5:**
  - Titel und Ltg = erste Gruppe (statt 9 Wörtern), ohne «unsicher: Titel/Ltg».
  - Die Teilaufgaben werden nur als Hinweis geführt. Das Kriterium «korrekt erkannt» bleibt (Typ, Tag, Zeit, Spalten, Kategorie, Titel, Nr), ebenso die Exportfelder der Listenansicht.
  - Die Normalisierungsentscheide 5/6 erhalten die Ausnahme aus (b).
- **(d) Schwellen «verdeckt»** (Vorschlag aus visual-qa-1, A2):
  - Verdecken kann eine später gezeichnete, gefüllte Form ohne Transparenz (Dokumentreihenfolge mit Gruppen; Fläche nach Transformation).
  - ab 99 % → kein Eintrag, Bericht «verdeckt»;
  - 5 % bis unter 99 % → Eintrag (nach Q-042 auf die sichtbare Spanne gekürzt, wenn der verdeckte Teil an Anfang oder Ende liegt, sonst volle Zeit) und Bericht «teilweise verdeckt (n %)»;
  - unter 5 % → keine Meldung (24 Kantenfälle in der Mappe);
  - Linienformen gelten bis zur Klärung von VQ-I2-01 nie als verdeckt.
  - Alternative: ganz = 100 %, Meldung ab mehr als 0 %.

### 2 Reihenfolge I2 (seriell für Codex)

KI-Zeit = Wanduhrzeit inkl. Prüfrunden. «Codex» heisst: Codex übernimmt Schritt 7 und die Nachbesserung; die Schritte 1–6 und 9–13 macht Claude.

**Codex-Warteschlange** (Orchestrator, seriell): **E1-01c → E1-04 → E1-05 Runde 2 → E1-09 → E1-01d (Werkzeug) → E1-01e**.

| Stufe | Paket | wartet auf | KI-Zeit |
| --- | --- | --- | --- |
| 0 | Katalog-Notiz (B); Verträge E1-02h–k, E1-03b, E1-07b, ADR-008-Notiz, Notizen 1.3 (B) | – | 3–4 h; 5–7 h |
| 0 | E1-05 Kästchen 13 (volle Schleuse 07e10a4, PROGRESS) | läuft | – |
| 0 | E1-01c Schritte 1–6 (B; mit E1-01-31 und Q-020) | Katalog-Notiz (Werkzeug-IDs) | 6–8 h |
| 0 | E1-11 Schritte 1–4 (A) | – | 8–10 h |
| 1 | E1-02h (A) | Katalog-Notiz | 7–10 h |
| 1 | E1-02j (A) | Vertrag | 4–6 h |
| 1 | E1-04 (A): Schritt 1 sofort; Schritt 2 nach Vertrag E1-02h (Felder, Schema); Schritte 3–6 nach Merge E1-02h | E1-02h | 6–8 h |
| 1 | E1-03b (A) | Katalog-Notiz (E1-02h, falls `entries.ts`) | 4–6 h |
| 2 | E1-01c Codex, dann 9–13 | Schritt 6 | 6–9 h |
| 2 | E1-02k (A) | Merge E1-02j und E1-02h | 8–12 h |
| 2 | E1-04 Codex, dann 9–13 | E1-01c Codex fertig, E1-04 Schritt 6 | 6–10 h |
| 2 | E1-02g (B; R-11-15/-16 A; S7, CR-E102f-03, CR-E102d-Q2-02) | Merge E1-01c | 5–8 h |
| 3 | E1-11 Freeze, Umsetzung, Merge | Freeze: Merge E1-01c; Umsetzung: Merge E1-04 | 10–14 h |
| 3 | E1-02i (A) | Merge E1-02k | 10–14 h |
| 3 | E1-05 Runde 2 (A; N1 IHDR, N4 F-64, CR-E105-01/-02) | E1-04 Codex fertig | 4–6 h |
| 3 | E1-09 (A, Codex) | Merge E1-04, Runde 2 fertig | 7–9 h |
| 4 | E1-10 (A; S-3 #c00000) | Merge E1-02i (Layout seriell) | 10–14 h |
| 4 | E1-12 (B; A1-ID und R-5.1-10/-11 A) | Merge E1-11, E1-02h | 12–16 h |
| 4 | E1-01d Werkzeug (B, Codex) | E1-09 Codex fertig | 5–7 h |
| 5 | E1-01d Aufnahme KVK «vorläufig» (Schritt 8: Kandidaten, `visual-qa`, `lock-update`) | Merge E1-01d Werkzeug; frühestens nach Merge E1-02j und E1-02k | 2–3 h |
| 5 | E1-13a (B) | Merge E1-12 | 6–8 h |
| 5 | E1-01e (B, Codex; mit Q-021) | E1-01d Codex fertig | 9–11 h |
| 6 | Zwischenstand I2 (B) | E1-13a, E1-02i, Aufnahme | 3–4 h |

**Kritischer Pfad (seriell gerechnet)**
- Pfad: E1-02h → E1-04 Schritte 3–6 → [E1-01c Codex] → E1-04 Codex → E1-04 Merge → E1-11 Umsetzung → E1-12 → E1-13a → Zwischenstand.
- Etappen: E1-04 gemergt nach ≈ 18–25 h; E1-11 nach ≈ 28–39 h; E1-12 nach ≈ 40–55 h; E1-13a nach ≈ 46–63 h; Zwischenstand nach ≈ 50–67 h KI-Zeit.
- **R-I2-4:** Dazu kommen die Wartezeiten bis zum Start durch den Auftraggeber: mindestens 2 Codex-Starts auf dem Pfad (E1-01c, E1-04), dazu jede weitere Codex-Runde. Wanduhrzeit realistisch ≈ 60–80 h.
- **Nebenpfad Optik:** E1-02h ∥ E1-02j → E1-02k → E1-02i → E1-10, ≈ 35–50 h.
- Die Golden-Aufnahme folgt der Codex-Warteschlange (≈ 28–34 h) und nimmt den dann aktuellen Stand auf.

**Auslegung «Golden erst nach A2 bis A4»** (SA-I2-13)
- Gemeint sind die Optik-Nachträge E1-02j (A2 KVK) und E1-02k (A3, A4).
- Die Import-Teile von A2 (E1-08) berühren Golden nicht.
- Später gemergte Optik-Änderungen (E1-02i, E1-10 Statusrot, Q-042 abweichend) kommen als eigene Golden-Commits mit Vorher/Nachher/Differenz.

**Inkremente (Planänderung, protokolliert nach Prompt §5.4)**
- **I2:** E1-02h–k, E1-03b, E1-05 Runde 2, E1-01c, E1-01d, E1-01e (aus I5), E1-02g, E1-04, E1-09 (aus I3), E1-10 (aus I5), E1-11, E1-12, E1-13a; E1-06 und E1-07b als Füller.
- **I3:** E1-13b, E1-14.
- **I4:** E1-07b (falls nicht früher), E1-08, E1-15.
- **I5:** E1-06 (falls nicht früher), E1-16, E1-17, E1-AB.

**Zwischenstand I2** (kein Gate)
- Besitz: `tests/wap-e2e/harness/zwischenstand-i2.{html,tsx}` und `docs/wap-planer/zwischenstand/i2/**`.
- Einzeldatei lokal (Q-037 a): synthetischer Plan und die Beispielwoche aus E1-02i.
- Das README enthält einen Abschnitt «Gate-S-Auflagen» mit:
  - den 7 Seitenleisten-Abweichungen samt neuen B-Kp-Zeilen (Meldung A4 und Beleg der Einzelbestätigung, SA-I2-11);
  - der geänderten KVK-Rückfall-Liste;
  - der Verschiebung der Tagesbefehl-Teile nach Etappe 4.
- KVK neben der Referenz nur lokal unter `.qa/i2/`.

**Parallelität**
- Auf Claude-Seite höchstens vier Pakete gleichzeitig, dazu eine Codex-Sitzung; höchstens zwei Testläufe gleichzeitig, Codex mitgezählt.
- Belegläufe zwischen Codex-Commits, oder Codex nutzt `--warten`.

### 3 Codex-Aufträge

- **E1-01c:** besitzt zusätzlich `scripts/wap-gate/red-phase.mjs` (E1-01-31) und für Q-020 die betroffenen Dateien unter `scripts/wap-gate/`, dazu den neuen Gate-Test `tests/wap-gate/red-phase-playwright.gate.ts`.
  - Fall: Playwright `expect(x, 'Meldung')` gilt als fachlich rot.
  - Ändert er einen Fall in `red-phase.gate.ts`, wird diese Datei in den Schritten 3–6 neu eingefroren.
  - Gesperrte Werkzeugdateien entsperrt der Orchestrator vor dem Codex-Start einzeln und sperrt sie beim Merge wieder.
  - E1-01-31 ist vor dem Rot-Nachweis von E1-11 behoben.
- **E1-05 Runde 2:** nach Vertrag E1-05, Notiz «Runde 2» (N1–N4). Protokollierte Ausnahme im bestehenden Worktree, danach wird er entfernt.
- **E1-01d** in zwei Teilen: Werkzeug (Codex, Besitz nach Notiz AE-001) und Aufnahme (Schritt 8, nach Stufe 5).
- **E1-01e:** mit Q-021 (`vitest.config.ts`, an Gate S freigegeben).

### 4 Offene Befunde, zugeordnet (SA-I2-16)

| Paket | Befunde |
| --- | --- |
| E1-11 Schritt 2 | E1-02a-01, E1-02b-01, PL0-39, CR-E102f-02; IHDR über `defaultRenderers` (Notiz Vertrag E1-11) |
| E1-02g | CR-E102f-03, CR-E102d-Q2-02 (Stresswoche) |
| E1-02j | VQ-E102e-04, TR-E102a-10 (Abweichungen neu prüfen) |
| E1-02k | VQ-E102e-01, VQ-E102f-04, TR-E102e-31, CR-E102e-14; prüft VQ-E102e-03 und VQ-E102f-03 |
| E1-07b | VQ-I2-01 |
| E1-01c | E1-01-31 |
| E1-01d Aufnahme | VQ-E102f-07 |
| Entschieden an Gate S (D6 gezeigt, S-1 b) | VQ-E102f-02, VQ-E102f-06 (Hinweis im Zwischenstand) |

E1-01-26 (Rückmerge-Protokoll) trifft die Rückmerges von E1-02j, E1-02k und E1-05 Runde 2. Bis zur Behebung gilt die Umgehung wie bei E1-02b. Die Behebung betrifft `scripts/wap/lib/common.mjs` (H0) und braucht einen Entscheid des Orchestrators.

### 5 S-6 bis zur Lieferung (Restrisiko)

- **E1-04, E1-11:** Daten nach einem Neustart des Geräts (`persist()` = nein). Gegenmassnahmen: Warnung «Speicher nicht dauerhaft», Erinnerung an die Plan-Datei; «Undo nach Neuladen» ist nur lokal belegt.
- **E1-01c, E1-16, E1-17:** Offline nur lokal in `edge-dist` (14.13).
- **Mindestschriftgrösse:** Seite und Parität kaum betroffen (4,5 pt = 18 px, ADR-004); betroffen sind die Eingabefelder von E1-12.
- **Vorschlag:** S-6 mit der Einzeldatei des Zwischenstands I2; Folgen als Notiz zu E1-04, E1-11 und E1-12.

**Orchestrator, 06.10.2026 (Entscheide zu den Fragen des architect, Bericht `.qa/i2/architect-schnitt-1.md`):**
1. A1 gilt vorerst nur für Blöcke; ob Teilaufgaben auch für Beso bzw. die Terminzeile gelten, geht als Q-038 an den Auftraggeber (Arbeitsannahme: nur Blöcke; die Terminzeile bleibt unverändert, bis Q-038 entschieden ist).
2. A3: Der Auftraggeber hat auf die Frage «Gilt der dünne Rahmen für alle Rapporte oder nur für KR und DR?» geantwortet «Der Dunne rahmen gilt für alles» – gilt damit für **alle Rapporte**. Andere Elemente mit kräftigem Rahmen, der in der Referenz dünn ist, werden nach A3 nur **gemeldet** (Q-039), nicht geändert – auch dort nicht, wo es heute unsere eigene Linienwahl ist.
3. Codex-Sitzungen nacheinander (AE-002, ein Auftrag je Worktree); parallele Sitzungen nur, wenn der Auftraggeber es ausdrücklich will (Hinweis in der Meldung).
4. E1-05 Runde 2 als eigener Codex-Auftrag (E1-05-N01, CR-E105-01/-02).
5. «Trotzdem übernehmen» für verdeckte Formen im Importbericht: Produktvorschlag Q-040 (Arbeitsannahme: keine Aktion, nur Bericht nach Regel 8).
6. E1-10 nach I2 vorgezogen und fiktive Beispielwoche für den Zwischenstand: angenommen (Planänderung per diese Notiz).
7. Übergabe visual-qa → Verträge E1-02h–k: je Fall Tag, Spalte, Zeit und Fixture-ID (pseudonymisiert), keine Inhalte aus `reference/`.

**Orchestrator, 06.10.2026 (Referenzprüfung A1–A4, `.qa/i2/gate-s-auflagen/visual-qa-1.md`):** A1-Block = Fixture e35 (3 Teilaufgaben, keine Einzüge in der Quelle) → Bedeutung «Einrücken … Abstufungen» an den Auftraggeber (Q-041); das Modell der Teilaufgaben (E1-02h) läuft, die Darstellung (E1-02i) wartet auf Q-041 *(überholt durch Planprüfung SA-I2-03 und Notiz Runde 2: E1-02i setzt Lesart (1) wie Referenz um, nur Stufe/Einzug offen)*. A2: ganz verdeckt e40, e56, e82 (entfallen); teilweise e54, e73 nach Q-042 (Arbeitsannahme kürzen); Anhang-A-Abweichungen Q-043. A3: nur Rapporte (0,96 → 0,48 pt, 7 Vorkommen); übrige Rahmen wie Referenz; Kopfmitte/Klassifizierung 0,72 pt und ABV-Linien gemeldet (Q-039). A4: alle Seitenleisten-Abschnitte an die Referenz angleichen («gleich behandeln»; 7 Abweichungen im Bericht) und dem Auftraggeber melden. Markerlinien-Anker: Befund VQ-I2-01 vor E1-08.

**Orchestrator, 06.10.2026 (Fragen architect Runde 2, `.qa/i2/architect-schnitt-2.md`):** (1) Fragevorschlag 1.5 als Q-044 eingetragen, Arbeitsannahme (a)–(d) wie vorgeschlagen. (2) Die Notiz an E1-11 (IHDR über `defaultRenderers`, Platzhalter) kommt mit dem Merge von E1-05 Runde 2 auf `wap-planer`, spätestens vor E1-11 Schritt 2. (3) E1-01-26 (`scripts/wap/lib/common.mjs`) wird mit E1-01c behoben (Besitzerweiterung). (4) Neue Werkzeug-IDs für E1-01-31, Q-020, Q-021 nach Regel 1.1 per Katalog-Notiz (spec-analyst). (5) Q-020 als zweiter Teil von E1-01c nach dessen Merge, wenn der Freeze von E1-11 sonst wartet. (6) Rot-Nachweis per protokollierter Mutation für Nachtrags-Regressionstests, deren Verhalten bereits umgesetzt ist (E1-05 N1/N4, E1-02j Gegenprobe), ausdrücklich zugelassen (SA-I2-17); Belege mit `fachlichRot` unter `.qa/<paket>/`.

**Orchestrator, 06.10.2026 (Planprüfung Runde 2, `.qa/i2/spec-auditor-schnitt-2.md`, Freigabe ja; Restpunkte SA-I2-20..26):**
1. SA-I2-20: Die fehlenden Textstellen des dritten Zusatzes sind eingesetzt (Bericht `.qa/i2/architect-schnitt-2.md`, `defaultRenderers`, `wap-planer`, `scripts/wap/lib/common.mjs`, Belege mit `fachlichRot` unter `.qa/<paket>/`).
2. SA-I2-21: E1-01-26 (`scripts/wap/lib/common.mjs`, H0-Harness) wird **nicht** in E1-01c (Codex) behoben; Punkt (3) des dritten Zusatzes ist damit ersetzt. Bis dahin gilt die Umgehung wie bisher (der Orchestrator stellt beim Merge nach `wap-planer` die Protokollreihenfolge mit `wap-planer`-Präfix her und prüft sie per Skript). Behebung als eigener Claude-Nachtrag **E1-01h** vor Gate B mit: neuer Werkzeug-ID (Regel 1.1, Katalog-Notiz 1.4 (i)), Entsperren nur von `common.mjs` einzeln durch den Orchestrator und Wiedersperren beim Merge, Neufreeze der betroffenen `tests/wap-harness/**`-Tests, Lauf des Harness-Selbsttests R-H-09 vor dem Merge, Code-Review mit Schwerpunkt «Sperre nicht geschwächt».
3. SA-I2-22/-23: Massgebend sind die nachgerechneten Spannen des Reviewers: kritischer Pfad ≈ 49–70 h KI-Zeit (Verträge der Stufe 0 liegen vor E1-02h und kommen hinzu); E1-01d Werkzeug ≈ 34–50 h, Aufnahme ≈ 36–53 h. Der Satz «E1-02i … eigener Golden-Commit» gilt nur, falls E1-02i nach der Aufnahme gemergt wird; sonst nimmt die Aufnahme E1-02i mit.
4. SA-I2-24: Vierer-Grenze gilt. Reihenfolge in Stufe 0–1: E1-01c (1–6) → E1-02h (Vertrag) ∥ E1-11 (1–2) ∥ E1-04 (1–2); E1-02j und E1-03b als Füller, sobald ein Platz frei ist (nach E1-01c Schritt 6).
5. SA-I2-25: Die Notiz an E1-11 (IHDR-Fall über `defaultRenderers`, Platzhalter) wird unabhängig von E1-05 Runde 2 vor E1-11 Schritt 2 auf `wap-planer` eingetragen; mit dem Merge von Runde 2 wird nur der Verweis auf den Test nachgeführt. Punkt (2) des dritten Zusatzes ist damit ersetzt.
6. SA-I2-26: Q-044 um die Alternativen ergänzt, Q-038 um den Hinweis auf Etappe 4; PROGRESS §4/§5 nachgeführt; SA-I2-01..26 in FINDINGS.

## Änderungsnotiz Katalog I2 (06.10.2026, spec-analyst, im Auftrag des Orchestrators)

- **Grund:** Plan, Notiz Gate S / I2, «Vorrang» und 1.4 (a)–(i): neue IDs aus `requirements.md`, «Änderungsnotiz I2 nach Gate S».
- **Anhang A:** 29 neue Zeilen. Hinweis-Spalte «Katalog-Notiz I2».
  - E1-02h: R-4.6-63 bis -66, R-4.7-18 bis -21
  - E1-02i: R-10-47 bis -49
  - E1-02k: R-10-50 bis -53
  - E1-03b: R-4.6-67
  - E1-07b: R-8.2-44
  - E1-08: R-8.2-37 bis -43 (R-8.2-43 als Integration-Referenz)
  - E1-12: R-6-41
  - E1-14: R-4.7-22, R-5.1-25
  - E1-15: R-6-42
  - E1-16: R-5.5-08
- **Anhang B:** 4 neue Zeilen.
  - E1-01c: R-H-35
  - E1-01c2: R-H-36 (seit 06.10.2026, CR-E101c-V02)
  - E1-01e: R-H-37
  - E1-01h: R-H-38
- **Nicht im Plan:** R-9.2-08 gehört zu Etappe 4.
- **Anhang C:** Die Erwartung ist jetzt Soll = Ist = 465 (vorher 432); im Erwartungssatz von Anhang C nachgeführt. Das Ergebnis des Skripts steht unten.
- **Nachführung 06.10.2026 (CR-E101c-V02, Vertragsprüfung E1-01c):** R-H-36 (Q-020) gehört zum Paket E1-01c2, einem eigenen Paket nach dem Merge von E1-01c. Anhang B, Anhang C und das Ergebnis unten sind nachgeführt: E1-01c 6 → 5, E1-01c2 neu 1; Summe 465 und Testarten unverändert.
- **Nachführung nach Katalogprüfung Runde 1 (06.10.2026):** Die Hinweise zu R-4.6-63, R-4.7-18, R-4.7-20, R-4.7-21, R-8.2-38, R-8.2-41, R-10-47 und R-10-52 sind ergänzt (SA-K-I2-01, -02, -06, -07, -09, -10). Zuordnung und Zählung sind unverändert.

Ergebnis (Befehl aus Anhang C, Ausgaben nur in den Scratch-Ordner, 06.10.2026; Lauf nach CR-E101c-V02):

```
Soll: 465  Ist: 465  doppelt: 0  fehlend: 0  zuviel: 
E1-01=15 E1-01b=2 E1-01c=5 E1-01c2=1 E1-01d=1 E1-01e=4 E1-01h=1 E1-02a=54 E1-02b=2 E1-02c=6 E1-02d=41 E1-02e=78 E1-02f=2 E1-02g=3 E1-02h=8 E1-02i=3 E1-02k=4 E1-03=25 E1-03b=1 E1-04=7 E1-05=11 E1-06=8 E1-07=2 E1-07b=1 E1-08=55 E1-09=2 E1-10=9 E1-11=28 E1-12=19 E1-13a=4 E1-13b=4 E1-14=18 E1-15=5 E1-16=19 E1-17=11 E1-AB=6 
Auftraggeber=6 E2E=88 Integration=20 Integration-Gate=29 Integration-Leistung=6 Integration-Referenz=16 PDF=86 Property=14 Unit=185 Verweis=15
```

Gegenprobe mit `planZeilen` aus `scripts/wap-gate/trace.mjs`: 465 Zeilen, 0 doppelt, 0 fehlend, 0 zuviel.

**Orchestrator, 07.10.2026 (Freeze E1-04, Entscheid R-8):** §4.9 E1-04 «Besitzt» bei den Tests: `tests/wap/unit/storage/**`, `tests/wap/integration/storage/**`, `tests/wap/property/storage/**`, `tests/wap/support/storage/**` und `tests/wap/fixtures/migration/**` (statt nur der Fixture-Datei); Testpfadmenge «E1-04» in `scripts/wap-gate/testpfade.json`. Kein Besitz an `src/io/wap-plan/standStore.ts` und `tests/wap/**/stand/**` (E1-05).

**Orchestrator, 07.10.2026 (CR-E102j-04):** Für den Zwischenstand I2 (Abschnitt «Gate-S-Auflagen» im README) gilt neben der geänderten KVK-Rückfall-Liste auch der weitere Inhalt aus Vertrag E1-02j §4/§5: die fünf Änderungen der Fixture (mit Hinweis Q-042), der Rest von VQ-E102e-04 und F-1 (e46).

## Änderungsnotiz Katalog E1-04b (07.10.2026, spec-analyst, im Auftrag des Orchestrators)

- **Grund:** Vertrag E1-04, «Änderungsnotiz Runde 2 (07.10.2026, architect)», R2-0. Orchestrator-Antworten R2-F1 (Variante A, Nachtrag-Paket E1-04b) und R2-F2. Die neuen IDs stehen in `requirements.md`, «Katalog-Notiz E1-04b (07.10.2026)».
- **Anhang A:** unverändert.
- **Anhang B:** 4 neue Zeilen, Hinweis-Spalte «Katalog-Notiz E1-04b».
  - E1-04b: R-L-12 (Integration), R-L-13 (Unit), R-L-14 (Integration), R-L-15 (Integration).
  - Die Pflichtfälle tragen dazu eine alte ID von E1-04. Die Zuordnung von R-5.6-08, -14, -15, -17 und R-H-33 bleibt bei E1-04.
- **Anhang C:** Die Erwartung ist jetzt Soll = Ist = 469 (vorher 465). Sie steht als Nachführung in Anhang C.
- **Folgen für `trace.mjs`:**
  - Die Prüfung «ID ohne Test» zählt nur eingefrorene Pakete und, in der vollen Schleuse, das laufende Paket. Auf `wap-planer` liegen die vier IDs deshalb bis zum Freeze von E1-04b ausserhalb des Prüfumfangs.
  - Auf dem Zweig `wap/e1-04b` gilt E1-04b als laufendes Paket. Dort braucht `trace.mjs` die Checkliste `pakete/E1-04b.md` mit «Anforderungen: R-L-12, R-L-13, R-L-14, R-L-15».

Ergebnis (Befehl aus Anhang C, Ausgaben nur unter `.qa/e1-04/katalog-e1-04b/`, 07.10.2026):

```
Soll: 469  Ist: 469  doppelt: 0  fehlend: 0  zuviel: 
E1-01=15 E1-01b=2 E1-01c=5 E1-01c2=1 E1-01d=1 E1-01e=4 E1-01h=1 E1-02a=54 E1-02b=2 E1-02c=6 E1-02d=41 E1-02e=78 E1-02f=2 E1-02g=3 E1-02h=8 E1-02i=3 E1-02k=4 E1-03=25 E1-03b=1 E1-04=7 E1-04b=4 E1-05=11 E1-06=8 E1-07=2 E1-07b=1 E1-08=55 E1-09=2 E1-10=9 E1-11=28 E1-12=19 E1-13a=4 E1-13b=4 E1-14=18 E1-15=5 E1-16=19 E1-17=11 E1-AB=6 
Auftraggeber=6 E2E=88 Integration=23 Integration-Gate=29 Integration-Leistung=6 Integration-Referenz=16 PDF=86 Property=14 Unit=186 Verweis=15 
```

Gegenprobe mit `planZeilen` und `paketIdsAusPlan` aus `scripts/wap-gate/trace.mjs`: 469 Zeilen, 0 doppelt; E1-04b = R-L-12, R-L-13, R-L-14, R-L-15.

## Änderungsnotiz AE-004 (07.10.2026, Codex)

Integrationszweig wap-codex nach AE-004 §3. Vor Paketmerges wird AE004 als
Harness-Nachtrag mit R-H-39 ausgeführt: Vertrag, Tests, Rot-Nachweis und Freeze,
dann Zweigfilter erweitern. Unabhängiges Claude-Review bleibt ausstehend.
Bestehende Paketzweige werden mit erhaltenem Stand weitergeführt (AE-004 §5).


## Änderungsnotiz E1-01c Runde 2 (07.10.2026, Orchestrator, AE-004)

Zur Zuordnung «Offene Befunde» §4: E1-01-31/R-H-35 ist in E1-01c umgesetzt (Runde 1 de4943f, Runde 2 6ebfd8d). Codex-Selbstprüfung: Gate 910/910, vier Paket-Selbsttestdateien 32/32, einschliesslich echter Playwright-Assertion-Gegenfälle. Die unabhängige Claude-Prüfung und die vollständigen Abnahme-/Integrationsbelege bleiben ausstehend; dies ist keine Verifikation. CR-E101c-02/-03/-04 und der Lesbarkeitsteil von -05 sind in 6ebfd8d nachgeführt. Die normale Biome-Dateiauswahl erfasst budgets.mjs weiterhin nicht (CS-E101c-R2-02); der Auftrag verbietet eine Biome-Konfigurationsänderung in diesem Paket, die Einschränkung bleibt sichtbar.

Q-020/R-H-36 gehört weiterhin ausschliesslich zu E1-01c2; E1-01-26/R-H-38 zu E1-01h (SA-I2-21). Keine Besitzerweiterung nach common.mjs in E1-01c. Kernzustand-Registry, deren Baselines und tatsächliche Leistungseinträge werden von den jeweiligen späteren Produktpaketen geliefert; E1-01c liefert die Infrastruktur. Der Faktorwechsel aus der Bezugsneumessung ist noch offen, weil CS-E101c-KAL-01 eine ausdrückliche, genau begrenzte Ausnahme zu AE-004 §2 für einen bestehenden eingefrorenen Testfall benötigt. Andere Paketarbeit läuft weiter. Integration erfolgt ausschliesslich nach wap-codex mit vollen grünen Vor-/Nachbelegen; wap-planer bleibt bis Claude-Review unverändert.
## Änderungsnotiz E1-01h (07.10.2026, Codex-Orchestrator nach AE-004)

Root-Entscheid 08.10.2026 nach tatsächlichem Rotbeleg: E1-01h / R-H-38 besitzt common.mjs und die zwei
Vergleichs-Aufrufpfade in lock-check.mjs inklusive ausschliesslich notwendiger
lokaler Ref-Aufbewahrung. CLI, Objekt-/Dateihashprüfung, Index, pre-commit.mjs,
lock-update.mjs, Hooks und Frozen-Tests bleiben unverändert. Testpfad:
tests/wap-harness/rueckmerge-protokoll.harness.ts. Nur neue Tests erstmals
sperren; beide Quellen einzeln nach Test-Freeze entsperren und vor Integration
wieder sperren. StrictFallback gilt ohne frisch bestätigte echte Git-Provenienz.
74 aktive Vorschlagsfälle verlangen neue echte Ausnahme-/Datenbindung und
müssen im normalen Harness-JSONlauf und bestehenden V1a-harness-Klassifizierer
fachlich rot sein; schnelle F8 prüft Alt-WAP grün. Sieben reine Altregressionen
bleiben QA-only. Kein Config-/Gate-/ID-Bypass und keine neue Ownergrenze.
R-H-09 in vollem Umfang vor Merge, volle Schleusen vor/nach Merge nach
wap-codex und Claude-Review «Sperre nicht geschwächt» bleiben Pflicht.
Die Ausnahme dient erst dem Vergleich nach bestätigtem Rückmerge. Normale
pre-commit/pre-merge-commit bleiben beim strikten HEAD→Index-Zielpräfix;
MERGE_HEAD allein gewährt keine Ausnahme, Hooks/pre-commit bleiben unverändert.
Historische Quellen-Eltern sind gerichtet vom frisch aufgelösten aktuellen
exakten Integrationtip erreichbar; Tip-ID-Gleichheit ist nicht verlangt.
Volle Ref/ID/Blobbindung bleibt exakt frisch. Die echte ADR-010-Hashbasis stammt
aus git merge-base HEAD wap-planer, ersetzt aber keinen Rückmergebeleg.
Reine PROGRESS-Nachführung und normaler Paketappend bleiben zulässig.

## Root-Präzisierung zur Typdokumentation (08.10.2026, tatsächlicher F6)

Der unveränderte normale F6-Aufruf während der beiden Quellenunlocks hat56 gewertete Meldungen gezeigt:14 neue Guard-Indexstellen und42 unveränderte H0-Altstellen. Neue Guardstellen werden im bestehenden Besitz korrigiert. Bei den42 belegbar gebundenen Altzugriffen in genau common.mjs und lock-check.mjs sind ausschliesslich JSDoc-Typannotationskommentare und semantisch neutrale Klammerung vorhandener Ausdrücke zugelassen. Das ist Typdokumentation der bestehenden Operationen; Parser-, Hash-, Index-, Hook- und CLI-Runtime bleiben unverändert. Keine neuen Runtimevariablen, Kontrollflüsse, Defaults, optional chains, any, Unterdrückungen, Konfigurationen oder Altmodulausnahmen. Andere Quellen und eingefrorene Dateien bleiben geschützt.

Vor den Typkommentaren private bytegleiche Sicherung beider aktuellen Quellen; danach tatsächliche Gleichheit des normalisierten Runtime-JS-Syntaxbaums gegenüber dieser unmittelbar vorherigen Sicherung, ohne JSDoc/Positionsdaten und unter Auflösung rein semantisch neutraler Klammerknoten. Sichere Capture-/Indexbindung pro Altstelle dokumentieren. Normale F6-checkJs-Prüfung muss vor Wiedersperrung tatsächlich grün sein; gleiche gesperrte H0-SHAs werden instrumentseitig ausgenommen und dürfen keinen fehlenden Quellenbeleg verdecken. Keine Änderung des Test-Freezeumfangs oder Erlaubnis für Runtimeänderungen an Argumentparser/Hashprüfung.

## Änderungsnotiz E1-01i, Auftraggeberentscheid 08.10.2026

Stufe B, genau eine bestehende ID R-H-36, aktiv neu E1-01i statt E1-01c2; Gesamtzahlen unverändert. Besitz nur gate.mjs (V1a-selbsttest), eigene Gate-Testdatei v1a-wiederverwendung-i.gate.ts und die zugehörigen ungesperrten Formaldokumente/Reviewqueue. Genau ein gemeinsamer lokaler grüner Commitbeleg; kein alter Ganzbaum-/Abhängigkeits-/Browserhash-Scope. Alle anderen Full-Schritte unverändert. E1-04b ist während dieses ausdrücklich beauftragten kleinen Nachtrags pausiert; danach fortsetzen. E1-01c2 und alle übrigen ruhenden Pakete werden nicht aktiviert. Test vor Umsetzung, echter fachlicher Rotbeleg, Root-Freeze und normale Vor-/Nachprüfungen nach AE-004; unabhängiges Claude-Review ausstehend. Historische c2-Zuordnungsnotizen und deren Entwürfe bleiben Historie.


## Änderungsnotiz I1-Optik (09.10.2026, Auftraggeber)

Vorrang: `auftragsaenderungen/steuerung-2026-10-09-i1-optik.md` und Katalog-Änderungsnotiz vom 09.10.2026. Produktfolge nach E1-01i: E1-04b → E1-11 → E1-02l → E1-12 → E1-13a → I2. R1–R3 liegen damit nach E1-04b und vor E1-12. Höchstens zwei aktive Pakete; E1-02l ist bis dahin nur geplant. Alle ruhenden Worktrees bleiben erhalten. Der offene E1-01i-Initialisierungsentscheid wird durch die Optikrückmeldung nicht freigegeben.

E1-02l ist ein Produktnachtrag der Stufe A für ungekürzte Spaltenköpfe, Rapportkürzel/Beso-Nummern und semantische Kollisionsprüfung. Nach E1-11 folgen eigener Vertrag, Tests gegen die vorhandene Quelle, Review, fachlicher Rot-Nachweis und Freeze, erst dann Code. Mindestgrösse 4,5 pt, Leistungsbudgets und übrige Schwellwerte unverändert. Die Belastungsplan-Klassifikation und Details liegen ausschliesslich in main `.qa/`; bestehende eingefrorene Tests/Quellen werden in dieser Planung nicht geändert.

E1-11 bereitet die Zwischenstands-Demo mit zwei Modi vor: realistisch als Standard (pseudonymisierte KVK und realistische pseudonymisierte FDT-Woche im selben Plan), zweite Auswahl ausdrücklich «Belastungstest». Produktions-Erststart bleibt unverändert. I2 zeigt R1–R3 bereits; Optikprüfungen, Bilder und Probierliste beziehen sich auf realistische Daten. Unabhängiger Claude-Prüfauftrag bleibt erforderlich.

## Anhang A – Nachtrag I1-Optik, 09.10.2026

| ID | Paket | Testart | Verweis | Hinweis |
| --- | --- | --- | --- | --- |
| R-10-54 | E1-02l | Unit | – | Vollständige Spaltenköpfe, senkrecht vor Verkleinern, Fehler am Spaltensatz; zusätzlich PDF/Parität |
| R-10-55 | E1-02l | Unit | – | Vollständige Rapport-/Beso-Beschriftung, freier externer Trägerrahmen und P8; zusätzlich PDF/Parität |
| R-14.3-04 | E1-02l | Property | – | Klassifizierte Überlagerungen und geschärfte Kollisionsprüfung; Bericht nur main .qa/ |
| R-5.7-05 | I2 | E2E | – | Realistische Zwischenstands-Standarddaten; zweiter Modus Belastungstest |

## Nachführung Anhang C – I1-Optik, 09.10.2026

Soll = Ist = 474 (zuvor 470 einschliesslich AE004/R-H-39); vier neue Zuordnungen, keine Umnummerierung. Der Abgleich wird nach dieser Notiz unter main `.qa/steuerung-20261009-i1-optik/` belegt; diese Zählung ersetzt keine Produktabnahme.

## AE-005 – gemeinsamer Produktschnitt I2, 09.10.2026

Die oben I2 zugeordneten 18 Ziel-IDs werden gemeinsam auf wap/i2 bearbeitet. Keine bestehende eingefrorene ID wird umgehängt; Fachmodell und Speicherung bleiben unverändert. Der Rest von E1-11/E1-12/E1-13a folgt nach dem bedienbaren Zwischenstand. AE-005 ersetzt für diesen Umfang die alten Vorab-Vertrags-, Review- und Freeze-Schritte; Tests entstehen zusammen mit Code und werden am Ende eingefroren. E1-02l folgt nach I2.

## AE-006 – gemeinsamer Produktschnitt I4, 14.10.2026

Auftrag I4 (Orchestrator, 14.10.2026; Schnellspur nach AE-005/AE-006): E1-08 (Excel-Import Kp, Bericht, Listen-Export) und E1-15 (Listenansicht) werden gemeinsam auf `wap/i4` bearbeitet. Die 58 IDs in Anhang A mit Paket «I4» sind von E1-08 bzw. E1-15 umgehängt; Wortlaut, Prüfart und Abnahmekriterium bleiben unverändert. Bei E1-08 bleiben R-11-17 (Leistung über den Leistungsharness, Härtung) und R-14.3-03 (Rückfallliste der importierten Referenzwochen, Eintrag durch den Orchestrator) offen.

## AE-006 – Produktschnitt I3, 14.10.2026

Die oben I3 zugeordneten 40 IDs (aus E1-09, E1-10, E1-11, E1-12, E1-13b, E1-14, E1-16) werden gemeinsam auf wap/i3 bearbeitet (Auftrag I3 C1–C4, Schnellspur nach AE-005/AE-006). Keine eingefrorene ID wird umgehängt. Nicht übernommen, weil eingefrorene I2c-Tests anders lauten (Test-Einwand): R-5.1-06 und R-5.1-07 (Doppelklick in Rap-/Beso-Spalte erfasst 30 Min von–bis statt Zeitpunkt). Der Rest von E1-11, E1-12, E1-14 und E1-16 folgt.

## AE-006 – Produktschnitt I5, 14.10.2026

Die oben I5 zugeordneten 50 IDs (aus E1-06, E1-10, E1-16, E1-17, dazu aus E1-11 der Datenverlust-Schutz und Erststart der Oberfläche und aus E1-02g die PDF-Leistung) werden gemeinsam auf wap/i5 bearbeitet (Auftrag I5 D1–D5, Schnellspur nach AE-005/AE-006). Keine eingefrorene ID wird umgehängt. Nicht übernommen: R-8.2-21 (Sprung aus dem Importbericht, gehört zum Import I4), R-14.14-01 (Verweis auch auf R-11-11 und R-11-17 ausserhalb von I5), R-5-02, R-5.6-18, R-6-39, R-L-06, R-L-09, R-L-10 (übrige Oberfläche E1-11).

## AE-006 – Härtung H-LAYOUT, 14.10.2026

Auftrag H-LAYOUT (Orchestrator, 14.10.2026; Härtungsrunde nach AE-006, Befunde SA-H-01, SA-H-14 aus dem Etappen-Audit und Zusatzbefunde aus dem visual-qa-Bericht): R-10-47, R-10-48 und R-10-49 (Teilaufgaben in Layout, PDF und Bildschirm, bisher E1-02i, nie begonnen) werden auf `wap/h-layout` bearbeitet; Wortlaut, Prüfart und Abnahmekriterium bleiben unverändert. Keine eingefrorene ID wird umgehängt; weitere Tests tragen IDs eingefrorener Pakete.

## AE-006 – Härtung H-TESTS, 14.10.2026

Auftrag H-TESTS (Orchestrator, 14.10.2026; Härtungsrunde nach AE-006, Testlücken aus dem Test-Review TR-H-04 bis TR-H-18 und SA-H-12 aus dem Etappen-Audit): R-5-02, R-5.1-04, R-5.1-06, R-5.1-07, R-5.1-09, R-6-27, R-8.2-21 und R-L-06 (bisher E1-11, E1-12, E1-16, nie begonnen bzw. ruhend; das Verhalten liegt aus I2 bis I5 vor) werden auf `wap/h-tests` mit Tests belegt; Wortlaut, Prüfart und Abnahmekriterium bleiben unverändert. Keine eingefrorene ID wird umgehängt; weitere Tests tragen IDs eingefrorener Pakete.

Zurückgestellt nach Etappe 2 (TR-H-18; Werkzeug-Stopp nach AE-005 §1, Q-053 abgelehnt): Die folgenden Werkzeug-IDs gehören zu ruhenden Paketen (E1-01i, E1-02g, E1-01e) und haben nach der Rücknahme von E1-01i bzw. ohne Arbeitsbeginn keinen Test auf `wap-codex`. Sie werden aus Anhang B der Etappe 1 genommen und der Etappe 2 zugeordnet; Wortlaut und Abnahmekriterium im Katalog bleiben unverändert. Wiederaufnahme nur nach Aufhebung des Werkzeug-Stopps durch den Auftraggeber.

| ID | bisher Paket | Testart | Verweis | Hinweis |
| --- | --- | --- | --- | --- |
| R-H-32 | E1-02g | Integration-Gate | – | Prompt §5.3 Punkt 2: Selbsttest S6 (Schrift unter Mindestgrösse im PDF) und S7 (Leistungsregression) am Ende von Paket 2 |
| R-H-36 | E1-01i | Integration-Gate | – | Aktiver kleiner Git-Diff-Nachtrag nach Auftraggeberentscheid 08.10.2026; c2 ruht |
| R-H-37 | E1-01e | Integration-Gate | – | Q-021 (Katalog-Notiz I2) |

## AE-006 – Härtung F-TOOLS, 20.10.2026

Auftrag F-TOOLS (Orchestrator, 19.10.2026; Schlussrunde vor Gate B; Auftraggeber 19.10.2026 «7: ja» = Werkzeug-Stopp gelockert für Abdeckung, Lizenzprüfung, Golden-Bilder, Mutationstests): R-H-16 (bisher E1-01e), R-H-17 (E1-01e), R-H-20 (E1-01d) und R-H-23 (E1-01e) – nie begonnene bzw. ruhende Werkzeugpakete – werden auf `wap/f-tools` umgesetzt und in die volle Schleuse eingehängt (V2, V5-golden, V8, F10, V10-lizenztexte); Wortlaut, Prüfart, Abnahmekriterium und Schwellwerte (Prompt §7, ADR-010 §6, §7.3, §9) bleiben unverändert. R-H-37 (E1-01e, Q-021) bleibt der Etappe 2 zugeordnet. Keine eingefrorene ID wird umgehängt.

## F-IMPORT2 – Schlussrunde vor Gate B, 19.10.2026

Auftrag F-IMPORT2 (Orchestrator, 19.10.2026; Entscheide des Auftraggebers vom 19.10.2026 «3: ja / 4: ja / 5: ja / 9: ja», Q-042 bis Q-044): R-11-17 (bisher E1-08, offen nach Befund HT-05) wird auf `wap/f-import2` belegt. Entscheid des Orchestrators: Messung im Entwicklungsserver mit der echten Mappe in `test:reference` statt in der Einzeldatei der Leistungs-Harness; Testart im Plan deshalb Integration-Referenz statt Integration-Leistung (Testort `tests/wap/reference/**`, weil die Referenzdatei nötig ist und die Einzeldatei der Leistungs-Harness den Import nicht enthalten darf); Wortlaut, Prüfart des Katalogs (Integration) und Abnahmekriterium (Median ≤ 15 s, gedrosselt) bleiben unverändert. Alle übrigen Tests von F-IMPORT2 tragen IDs eingefrorener Pakete (I3, I4, E1-02a).

## F-DOKU – Rückverfolgbarkeit und Katalog vor Gate B, 20.10.2026

Auftrag F-DOKU (Koordinator, 20.10.2026; Befunde SA-2-01, SA-2-05, SA-2-06, SA-2-08, SA-2-10 bis SA-2-12 aus `.qa/haertung/spec-auditor-2.md` und TR-2-02 bis TR-2-09 aus `.qa/haertung/test-reviewer-2.md`, beide lokal). Planänderung nach Gate A (Schnitt, Prompt §5.4), keine andere Auslegung einer Anforderung ausser den als Vorschlag markierten Prüfart-Abweichungen:

- **Umgehängt auf F-DOKU** (Verhalten aus H-UI2/I2/I5 vorhanden, Tests bisher nur unter fremden IDs bzw. kein Test): R-4.6-67 (bisher E1-03b), R-5.6-18, R-6-39, R-L-09, R-L-10 (bisher E1-11), R-11-11 (bisher E1-13a; Messmethode nach HT-08). Wortlaut und Etappe unverändert.
- **Prüfart-Abweichung (Vorschlag spec-analyst, an Gate B):** R-5.6-18 und R-L-10 Testart Integration statt E2E, weil die App mit Formatversion 1 kein älteres Schema herstellen kann und die Sitzung keine Prüfnaht für das Format hat (Befund FD-01); Begründung im Abnahmekriterium (Katalog-Änderungsnotiz F-DOKU, Abschnitt 4).
- **Neue IDs für F-UX2** (Katalog-Änderungsnotiz F-DOKU, Abschnitt 2; Entscheid Auftraggeber 19.10.2026 Zusatzpunkte): R-5.1-26 bis R-5.1-29, R-5.2-11, R-5.2-12, Paket F-UX2 (eingefroren); Belege mit eigener ID unter `tests/wap/unit/f-doku/**` und `tests/wap-e2e/f-doku/**`.
- **Weiter ohne Test, nicht umgehängt:** R-4.6-61 (E1-13a; Verschieben eines verknüpften Teilblocks macht den Block zusammenhängend, Befund FD-02; Test als Rot-Nachweis lokal), R-8.2-44 (E1-07b; Lage der Linienformen nicht geklärt, VQ-I2-01/SA-2-07, Befund FD-03), R-14.1-02 (E1-AB, Nacharbeit 14.1), R-14.3-03 (E1-08, Liste der Rückfälle an Gate B, Entscheid 8, SA-2-09).

## Anhang A – Nachtrag F-DOKU, 20.10.2026

| ID | Paket | Testart | Verweis | Hinweis |
| --- | --- | --- | --- | --- |
| R-5.1-26 | F-UX2 | Unit | – | Treffer aus der Geometrie, Vorrang (N4); Beleg F-DOKU, zusätzlich F-UX2 treffen/treffer |
| R-5.1-27 | F-UX2 | Unit | – | Trefferzonen in px, Mindest-Trefferbreite 16 px (N4); Beleg F-DOKU, zusätzlich F-UX2 treffen/zonen |
| R-5.1-28 | F-UX2 | E2E | – | Auffüllen per Doppelklick, Ctrl+Shift+↑/↓, Kontextmenü (N5); zusätzlich Unit fillTarget |
| R-5.1-29 | F-UX2 | E2E | – | Direktbearbeitung im Block (N2); zusätzlich F-UX2 direkt/inline |
| R-5.2-11 | F-UX2 | E2E | – | Spaltenkopf-Menü und Tasten Einfg, Shift+Einfg, F2, Entf, Shift+F10 (N1) |
| R-5.2-12 | F-UX2 | Unit | – | Rückfrage «Nur dieser Tag / Alle Tage mit diesem Spaltensatz» (N1); zusätzlich E2E; FD-04 |

## Nachführung Anhang C – F-DOKU, 20.10.2026

Katalog Etappe 1: 480 IDs (zuvor 474); Zeilen der Anhänge A/B: 480 (auf wap/f-doku zunächst 477; nach dem Merge von wap-codex 8f129fd mit «F-TOOLS Runde 2», das R-H-32, R-H-36 und R-H-37 wieder in Anhang B der Etappe 1 führt, Soll = Ist = 480). Sechs neue Zuordnungen (F-UX2), sechs Zuordnungen umgehängt (E1-03b, E1-11, E1-13a → F-DOKU), keine Umnummerierung, keine doppelte Zuordnung. Gezählt per Skript über die Katalogzeilen und die Zeilen unter «## Anhang A/B» (dieselbe Lesart wie `trace.mjs`).

## F-TOOLS Runde 2 – R-H-32, R-H-36, R-H-37 zurück in Etappe 1, 20.10.2026

Folgeauftrag F-TOOLS Runde 2 (Koordinator 20.10.2026, Befund SA-2-03 aus spec-auditor-2): Die im Abschnitt «AE-006 – Härtung H-TESTS» ohne Entscheid des Auftraggebers nach Etappe 2 verschobenen IDs R-H-32, R-H-36 und R-H-37 sind wieder Etappe 1 (wie im Katalog) und in Anhang B dem Paket F-TOOLS zugeordnet; die dortige Tabelle «Zurückgestellt nach Etappe 2» gilt für diese drei IDs nicht mehr (R-H-38 unverändert). Wortlaut, Prüfart und Abnahmekriterium bleiben unverändert.

## F-FIX Runde 2 – R-4.6-61 und R-8.2-44 umgehängt, 20.10.2026

Folgeauftrag F-FIX Runde 2 (Koordinator 20.10.2026, Befunde FD-02 und FD-03 aus F-DOKU): R-4.6-61 (bisher E1-13a, nie als eigenes Paket begonnen) und R-8.2-44 (bisher E1-07b, nie begonnen) gehören zu F-FIX. Belege: `tests/wap-e2e/f-fix/teilbloecke.spec.ts` (R-4.6-61, E2E, aus F-DOKU übernommen) und `tests/wap/unit/f-fix/linienanker.test.ts` (R-8.2-44, Unit, fiktive Arbeitsmappen je Ankerart). Planänderung nach Gate A (Schnitt der Pakete, Prompt §5.4), an Gate B aufgelistet.

## GB-DOKU Runde 2 – R-14.3-03 umgehängt, 29.10.2026

Auftrag des Koordinators vom 29.10.2026 nach Gate B (Entscheid 3 a «18 Rückfälle der echten Wochen als bestätigte Liste»): R-14.3-03 (bisher E1-08; E1-08 lief als I4 ohne eigene Paketseite, die ID blieb ohne Test) gehört zu GB-DOKU. Beleg: `tests/wap/reference/gb-doku/rueckfaelle.ref.ts` (Integration-Referenz, `test:reference`, nur lokal mit der Referenzmappe und der bestätigten Liste als Schlüssel ohne Inhalte unter `reference/anhaenge/rueckfaelle/`). Wortlaut, Prüfart und Abnahmekriterium bleiben unverändert; Zählung unverändert (Etappe 1: 480).
