# Paket F-FLAKY4 – A3 im exklusiven Lauf prüfen

- Etappe: 1 (Merge-Schleuse vor dem Merge nach wap-planer)
- Anforderungen: (keine eigenen; geprüft werden Tests eingefrorener Pakete)
- Worktree: `C:\Users\phili\source\repos\wap-wt\f-flaky4` · Zweig `wap/f-flaky4` ab `wap-codex` 649cd64; Vergleich im Worktree `f-flaky4-vorher` (601f64b, ohne Zweig)
- Grundlage: Auftrag F-FLAKY4 des Koordinators (29.10.2026); Befunde FL4-01, FL4-02 in `FINDINGS.md`.

Kein Code geändert (Prüfung und Messung). Läufe bei ruhigem Rechner nach Vorprüfung; Belege lokal.

## Belege

| Lauf | Auswahl | Ergebnis |
| --- | --- | --- |
| Bauart | Code-Lektüre `tests/wap-e2e/i2b/handhabung.dist.spec.ts`, `scripts/wap-gate/einzeldatei.mjs` | A3 öffnet immer die Einzeldatei (Produktionsbau); keine Änderung nötig |
| A3-Vergleich 22:51–23:07 | Messhilfe mit derselben Messung, 3 × abwechselnd je Stand | 601f64b: Belastungstest 23,5 / 26,6 / 24,8 ms, Realistisch 12,9 / 12,8 / 13,1 ms; 649cd64: 27,0 / 23,2 / 19,5 ms bzw. 12,6 / 11,6 / 11,3 ms |
| Kalibrierung | `parsePlanFile` × 20 (wie F-FLAKY 20.10.2026) | 40,1 / 42,7 / 48,1 ms (20.10.: 25 ms) |
| `npm run wap:test:e2e` 23:11–23:26 | 649cd64 | 892 s, 473 Ergebnisse, 4 rot: A3 (Belastungstest 25,8 ms), I3 C3 [R-4.7-22] edge und edge-dist (FL4-02), F-UX6 UX-AB-G-16 (30-s-Zeitüberschreitung) |
| I3 C3 einzeln | `--repeat-each=2`, edge und edge-dist, 601f64b und 649cd64 | je 4/4 rot |

## Kästchen

- [x] 1 Paket-Worktree angelegt und installiert (`git worktree add … -b wap/f-flaky4 649cd64`, `npm ci`)
- [x] 3 Tests: entfällt (nur Prüfung und Messung)
- [x] 6 Freeze entfällt (keine Testdateien geändert)
- [x] 7 Umsetzung: entfällt
- [ ] 9 Merge-Schleuse (Koordinator)
