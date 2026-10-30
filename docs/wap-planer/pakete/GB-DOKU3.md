# Paket GB-DOKU3 – Nachtrag Gate B: I3-Test zur Kürzelbedeutung mit Testtext

- Etappe: 1 (Gate B, Nachtrag)
- Anforderungen: (keine eigenen; der nachgeführte gesperrte Test trägt R-4.7-22 des eingefrorenen Pakets I3)
- Worktree: `C:\Users\phili\source\repos\wap-wt\gb-doku3` · Zweig `wap/gb-doku3` ab `wap-codex` 649cd64
- Rollen: `test-engineer` (gesperrter Test per lock-update); kein Produktcode.
- Grundlage: Auftrag GB-DOKU3 des Koordinators (29.10.2026): Die Merge-Schleuse zeigte I3 C3 [R-4.7-22] in edge und edge-dist rot, weil seit Gate B Nr 39 (GB-DOKU2) «Kompanierapport» als Bedeutung von KR schon in der Vorlage Kp steht und der Test nach Undo dessen Fehlen erwartete.

| Teil | Ergebnis |
| --- | --- |
| I3 C3 [R-4.7-22] | `tests/wap-e2e/i3/support/ablauf.ts`: Bedeutung KR auf den fiktiven Testtext «Kaderrapport Übung» (statt «Kompanierapport»); PDF enthält den Testtext und nicht die Vorlagenbedeutung; nach Undo (auch nach Neuladen) Feld leer, PDF ohne Testtext und wieder mit «Kompanierapport» aus der Vorlage. lock-update «Gate B 28.10.2026 Nr 39 (KR, 29.10.2026): Testtext statt Vorlagenwert» |
| Weitere gesperrte Tests | Suche nach «Bedeutung», «Kompanierapport», «Bataillonsrapport», «Ausbildungsrapport» in `tests/`: sonst nur die in GB-DOKU / GB-DOKU2 nachgeführten Tests (`template.test.ts`, `nachtrag-gate-s-bedeutung.test.ts`, `nachtrag-rahmen.test.ts` pdf/unit) und `tests/wap/golden/manifest.json`; `f-abdeckung2/plan-einstellungen.test.ts` nutzt nur ein fiktives Kürzel «KR1». Kein weiterer Test setzt eine leere Bedeutung von KR, ARK oder BR 0–3 voraus; die Vitest-Suite war nach GB-DOKU2 vollständig grün (2930) |

- [x] 1 Paket-Worktree angelegt und installiert (`git worktree add … -b wap/gb-doku3 649cd64`, `npm ci` Exit 0)
- [x] 3 Tests: keine neuen; ein gesperrter Test nachgeführt (ID unverändert)
- [x] 5 Rot-Nachweis: der Test war in der Merge-Schleuse rot (edge, edge-dist; Meldung Koordinator), nachgeführt grün
- [x] 6 Eigener Freeze entfällt (keine eigenen Testdateien; `tests/wap-e2e/i3/support/ablauf.ts` gehört zum registrierten Testpfad von I3): per lock-update neu eingefroren
- [x] 7 Umsetzung entfällt (kein Produktcode); I3 in edge und edge-dist grün (Belege unten)
- [ ] 9 Volle Schleuse (Orchestrator)
- [ ] 10 Prüfung: frischer `test-reviewer`

## Belege

| Schritt | Befehl | Ergebnis |
| --- | --- | --- |
| Einzeldatei | `node scripts/wap-gate/einzeldatei.mjs --entry tests/wap-e2e/harness/i3.tsx --out test-results/wap/einzeldatei/i3.html --titel i3` | OK |
| E2E | `npx playwright test -c playwright.wap.config.ts --project edge --project edge-dist --workers=1 tests/wap-e2e/i3/` (ruhiger Rechner, 29.10.2026) | edge 15/15, edge-dist 15/15 grün (darunter [R-4.7-22] beide); abhängiges Projekt edge-zeit: 2 zeitkritische Fälle fremder Pakete rot (Einzeldatei i2b nicht gebaut bzw. Last), nicht Teil des Pakets |
