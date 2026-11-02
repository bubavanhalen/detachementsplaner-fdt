# Paket F-ABDECKUNG – Zweigabdeckung der Fachlogik (Schlussrunde vor Gate B, Befund FT-A-01)

- Etappe: 1 (Schlussrunde vor Gate B)
- Anforderungen: (keine eigenen; die Tests tragen IDs eingefrorener Pakete aus Beschrieb 4.1–4.9, 5.1–5.6, 6, 7, 8.2, 10, 11 und Harness, z.B. R-6-16, R-7-11, R-8.2-04, R-4.7-01)
- Worktree: `C:\Users\phili\source\repos\wap-wt\f-abdeckung` · Zweig `wap/f-abdeckung` ab `wap-codex` a201b77
- Grundlage: Auftrag F-ABDECKUNG des Koordinators (20.10.2026); Befund FT-A-01 (F-TOOLS); Prompt §7 «Abdeckung» (90 % Zweigabdeckung Fachlogik, Layout-Schicht, Prüfregeln, Import); ADR-010 §6.2; gesperrte Schwellen `scripts/wap-gate/coverage-schwellen.json` unverändert. Testpfade dauerhaft additiv nach Freigabe des Auftraggebers 13.10.2026 «ja dauerhaft».

Nur Tests, kein Produktcode. Die Tests prüfen beobachtbares Verhalten mit konkreten Erwartungswerten (Meldungstexte mit Ursache und nächstem Schritt, Grenzwerte, Fehlerpfade, Rückgängig über inverse Patches) und nennen die Anforderung im Namen. Gefundene Produktfehler sind als Befunde FA-01 bis FA-08 in `FINDINGS.md` (Abschnitt «F-ABDECKUNG») erfasst; je Befund hält ein Test das heutige Verhalten mit der Kennung `[FA-nn]` und dem Soll im Kommentar fest (`it.fails` ist nach F4 verboten). Nach der Behebung ist dieser Test per lock-update auf das Soll umzustellen.

## Messwerte (Zweigabdeckung V2, nur Vitest, `--maxWorkers=2`)

| Modulordner | vorher (a201b77) | nachher | gedeckt / gesamt |
| --- | --- | --- | --- |
| src/model/wap/checks | 74,7 % | 94,4 % | 254 / 269 |
| src/model/wap/commands | 79,0 % | 91,7 % | 1366 / 1489 |
| src/model/wap/layout/page | 87,7 % | 90,1 % | 760 / 843 |
| src/model/wap/list | 52,8 % | 95,1 % | 117 / 123 |
| src/io/wap-import | 71,6 % | 90,5 % | 1099 / 1214 |
| src/io/wap-import/agenda-text | 62,8 % | 89,3 % | 84 / 94 (FA-09: höchstens 84 erreichbar) |
| src/io/wap-import/formtext | 69,7 % | 90,8 % | 168 / 185 |
| Pfadmenge fachlogik | 81,7 % | 92,5 % | 5704 / 6163 |

Messlauf: 2573 Tests (vorher 2279), 0 rot. V2 bleibt rot wegen der Oberfläche (Pfadmenge «übrig», FT-A-02, F-UX2) und `agenda-text` (FA-09).

- [x] 1 Paket-Worktree angelegt und installiert (`git worktree add … -b wap/f-abdeckung wap-codex`, `npm ci`)
- [x] 3 Tests: 294 Tests in 12 Dateien unter `tests/wap/unit/f-abdeckung/` (plus `support.ts`), jeder mit Anforderungs-ID
- [x] 6 eingefroren: Testdateien per lock-update gesperrt (Grund «F-ABDECKUNG»), Testpfad in `scripts/wap-gate/testpfade.json` additiv registriert und nachgeführt
- [x] 7 Umsetzung: entfällt (nur Tests); alle neuen Tests grün gegen den bestehenden Code, bekannte Fehler als `[FA-nn]` festgehalten
- [ ] 9 Volle Schleuse (Orchestrator)
- [ ] 10 Prüfung: frischer `test-reviewer`

## Belege

| Schritt | Befehl / Commit | Auszug |
| --- | --- | --- |
| Basis vorher | `npx vitest run -c vitest.wap.config.ts --maxWorkers=2 --coverage.enabled=true …`, dann `node scripts/wap-gate/coverage-check.mjs --istanbul …` | 2279 Tests, 0 rot; Werte Spalte «vorher» |
| Messlauf nachher | gleicher Befehl auf dem Stand vor dem Freeze-Commit | 2573 Tests, 0 rot; fachlogik 92,5 % ok; Module wie oben |
| Lint, Typen | `npx biome check tests/wap/unit/f-abdeckung`, `npx tsc --noEmit -p tsconfig.wap.json` | ohne Befund in den neuen Dateien |
| Freeze und Tests | 56ee202 (Hook: Schleuse fast grün, 13 Schritte) | Testpfad registriert, 13 Dateien gesperrt (lock-update «F-ABDECKUNG») |
| Merge wap-codex 0099370 | c3fec3e (Hook grün); Protokollzeilen F-ABDECKUNG zuerst, weil der Hook das Protokoll gegenüber HEAD nur anhängbar zulässt | – |
| Messlauf nach dem Merge | wie oben auf c3fec3e | 2573 Tests, 0 rot; Werte unverändert (fachlogik 92,5 %, agenda-text 89,3 %) |

Hinweis Rechnerlast: Vitest mit `--maxWorkers=2` ohne `VITEST_MAX_WORKERS` (die Konfiguration verlangt sonst 4; `npm run wap:test:coverage` setzt 4 fest). Das Ergebnis entspricht `wap:test:coverage` (gleiche Konfiguration, gleiche Prüfung `coverage-check.mjs`).
