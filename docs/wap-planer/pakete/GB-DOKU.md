# Paket GB-DOKU – Gate B Etappe 1 dokumentieren

- Etappe: 1 (Gate B)
- Anforderungen: R-14.3-03 (Runde 2, umgehängt von E1-08; der Test zur Zeitform trägt R-5.1-06 und R-5.1-07 des eingefrorenen Pakets H-TESTS)
- Worktree: `C:\Users\phili\source\repos\wap-wt\gb-doku` · Zweig `wap/gb-doku` ab `wap-codex` edd59b6
- Rollen: `spec-analyst` (Gate-B-Dokument, Abnahmebericht, Katalog, UI-Richtlinie, Fragen, Befunde, Etappe-2-Liste) und `test-engineer` (Tests zur Zeitform und zur Rückfallliste); Produktdaten nur in Runde 2 (Vorlage Kp, Entscheid 39, Auftrag Koordinator).
- Grundlage: Auftrag GB-DOKU des Koordinators (28.10.2026) nach dem Entscheid des Auftraggebers vom 28.10.2026 «All as recommended for gate-b» und der Antwort zu Entscheid 39; Vorlage und Abnahmebericht-Entwurf lokal `.qa/gate-b/`.

| Teil | Ergebnis |
| --- | --- |
| Gate-B-Dokument | `gates/gate-B.md`: Entscheid, Vorlage mit Spalte «Entscheid 28.10.2026» (43 Entscheide), Anhang 1 als Abweichungsliste nach Gate B |
| Abnahmebericht | `abnahme/etappe-1.md`: Status 14.1, 14.2, 14.3, 14.15 nach den Entscheiden 2, 3, 8, 11; Teil (b) mit den bestätigten IDs |
| Freigabeprotokoll | `PROGRESS.md` Zeile 28.10.2026 «Gate B Etappe 1» |
| Katalog | R-5.1-06, R-5.1-07 (20 a), R-6-27 (24 a), R-10-54 (Wortlaut nach «2 a»); Änderungsnotiz Gate B (14 b, 23 a, 26–29, 31–33, 38 a, 39 a, 40 a); Zählung unverändert 622 / 480 |
| UI-Richtlinie | 13.3: Tippen ersetzt den Text (23 a), Pfeile und Ctrl+←/→ in Etappe 1 (24 a) |
| Fragen | `QUESTIONS.md`: 20 Zeilen «entschieden Gate B 28.10.2026» (Arbeitsannahmen Nr 40, Q-041 Nr 38, Q-045 d Nr 39 mit KR offen) |
| Befunde | `FINDINGS.md`: 37 Zeilen von «offen – Gate B» bzw. «an Gate B» auf «entschieden (Gate B 28.10.2026, Nr …)» |
| Etappe 2 | `plan/etappe-2-kandidaten.md` (Entscheide 41, 43 und Folgen weiterer Entscheide) |
| Test | `tests/wap-e2e/gb-doku/doppelklick-zeitform.spec.ts`: Zeitform von–bis 0700-0730 bzw. 1400-1430 beim Doppelklick (R-5.1-06, R-5.1-07) |

**Nicht in GB-DOKU:** Import 12–15 (GB-IMPORT), Layout 17, 18 (GB-LAYOUT), Abdeckungspfad 34 c und Golden-Status 7 b (F-TOOLS). Entscheid 39: siehe Runde 2.

**Rot-Nachweis.** Der Test prüft vorhandenes Verhalten (Umsetzung seit I2b, Entscheid «2: ja»). Mutant im Paket-Worktree, danach verworfen (`git checkout`): Vorgabedauer beim Doppelklick in `src/components/wap/i2/GridEditor.tsx` (beide Stellen `to: cell.minute + 30`) auf 15 Min → beide Tests rot (`toHaveCount` 0700-0730 bzw. 1400-1430); unverändert beide grün.

- [x] 1 Paket-Worktree angelegt und installiert (`git worktree add … -b wap/gb-doku wap-codex`, `npm ci` Exit 0)
- [x] 3 Tests (`test-engineer`), jeder Test mit Anforderungs-ID im Namen (E2E 2 in `tests/wap-e2e/gb-doku/**`)
- [x] 5 Rot-Nachweis (siehe oben; Test auf vorhandenem Verhalten)
- [x] 6 Test-Freeze per lock-update mit Grund «GB-DOKU» (Testpfad additiv in `scripts/wap-gate/testpfade.json`, Freigabe Auftraggeber 13.10.2026 «ja dauerhaft»)
- [x] 7 Umsetzung entfällt (kein Produktcode; Test auf vorhandenem Verhalten), neuer E2E-Test grün (Belege unten)
- [ ] 9 Volle Schleuse (Orchestrator)
- [ ] 10 Prüfung: frischer `spec-auditor`

## Belege

| Schritt | Befehl | Ergebnis |
| --- | --- | --- |
| E2E | `WAP_E2E_PORT=47391 npx playwright test -c playwright.wap.config.ts --project edge --workers=1 tests/wap-e2e/gb-doku/doppelklick-zeitform.spec.ts` (ruhiger Rechner, 28.10.2026) | 2/2 grün (edge); abhängiges Projekt edge-zeit: 2 zeitkritische Fälle fremder Pakete rot (Einzeldatei nicht gebaut bzw. Last, FL-05/FL-07), nicht Teil des Pakets |
| Mutant | dito mit Vorgabedauer 15 Min | 2/2 rot (getötet) |
| Rückverfolgbarkeit | `node scripts/wap-gate/trace.mjs --mode fast` | OK F9-trace |
| Etappenabschluss | `node scripts/wap-gate/trace.mjs --mode fast --etappen-abschluss 1` | Teil (b) gefunden; rot nur R-14.3-03 (E1-08, Integration-Referenz) ohne Test (Runde 1); in Runde 2 behoben, siehe unten |

## Runde 2 (29.10.2026, Auftrag Koordinator nach dem Merge von GB-IMPORT)

- **Merge** `wap-codex` becf933 (GB-LAYOUT, GB-TOOLS, GB-IMPORT) nach `wap/gb-doku`: a6624d7 (Protokollzeilen GB-DOKU zuerst, testpfade additiv, test-lock per lock-update).
- **Entscheid 39:** Vorlage Kp `src/model/wap/template/kp.ts` mit Bedeutungen ARK «Ausbildungsrapport Kompanie», BR 0 «Bataillonsrapport KVK», BR 1–3 «Bataillonsrapport Wo 1–3»; KR ohne (Rückfrage offen). Gesperrte Tests per lock-update «Gate B 28.10.2026 Nr 39»: `tests/wap/unit/model/template.test.ts`, `tests/wap/unit/model/nachtrag-gate-s-bedeutung.test.ts`, `tests/wap/pdf/page/nachtrag-rahmen.test.ts` (P12: «BR 0» mit Bedeutung, «KR» ohne), `tests/wap/unit/page/nachtrag-rahmen.test.ts` (U5: zwei Bedeutungen in der KVK). PDF-Goldens: kvk-woche-s1, kvk-fortsetzung-s1 (je 1534 Pixel) und synth-woche-1-s1 (5151 Pixel) weichen nur in der Bedeutungsspalte der Kürzelliste ab, kvk-fortsetzung-s2 gleich → Neuaufnahme durch F-TOOLS.
- **R-14.3-03** (umgehängt von E1-08, Plan «GB-DOKU Runde 2»): `tests/wap/reference/gb-doku/rueckfaelle.ref.ts`, Integration-Referenz. Bestätigte Liste lokal `reference/anhaenge/rueckfaelle/rueckfaelle-etappe-1.csv` (18 Schlüssel Woche;Datum;Art;Bereich;Feld;Typ;Zeit, ohne Inhalte; aus dem Stand nach GB-LAYOUT erzeugt und gegen die Liste von F-LAYOUT2/GB-LAYOUT `.qa/f-layout2/liste-r2.json` abgeglichen: gleich nach Woche, Datum, Art und Zeit). Im Test eingefroren: Zahlen 8, 3, 5, 2.
- **Sammelbestätigung:** FUX3-01, -04, -05, -06 und CR-F3-04 «entschieden Gate B 28.10.2026 (Sammelbestätigung)».

| Schritt | Befehl | Ergebnis |
| --- | --- | --- |
| Vitest | `npx vitest run -c vitest.wap.config.ts` nach der Vorlagenänderung | vorher 4 gesperrte Fälle rot (die vier oben), nach lock-update 45/45 in den vier Dateien grün |
| Golden | `npx vitest run -c vitest.wap-golden.config.ts` | 3 von 4 rot wie erwartet (Kürzelliste), Neuaufnahme F-TOOLS |
| Referenz | `WAP_REFERENCE_DIR=… npx vitest run -c vitest.wap-reference.config.ts tests/wap/reference/gb-doku/rueckfaelle.ref.ts` | 5/5 grün |
| Mutant 1 | Mindestgrösse der Vorlage 4,5 → 4,75 pt | Zahl und Liste rot (2 von 5) |
| Mutant 2 | P8 ohne Befunde für Blöcke (`checks/p8.ts`) | «als Befund P8 sichtbar» rot |
| Etappenabschluss | `node scripts/wap-gate/trace.mjs --mode fast --etappen-abschluss 1` | OK F9-trace |
