# Paket F-FLAKY2 – zeitkritische E2E anzeigeunabhängig messen (Merge-Schleuse Etappe 1)

- Etappe: 1 (vor dem Merge nach wap-planer; Entscheid Auftraggeber 26.10.2026: Merge-Schleuse statt voller Schleuse)
- Anforderungen: (keine eigenen; die Tests tragen IDs eingefrorener Pakete)
- Worktree: `C:\Users\phili\source\repos\wap-wt\f-flaky2` · Zweig `wap/f-flaky2` ab `wap-codex` 21dc35a
- Grundlage: Auftrag F-FLAKY2 des Koordinators (26.10.2026); V4-e2e der vollen Schleuse 1dececb (3 rote Tests); Befunde FL2-01 bis FL2-05 in `FINDINGS.md`.

Nur Tests, kein Produktcode; Grenzwerte unverändert. Läufe nur bei ruhigem Rechner (CPU < 30 %, keine fremden Testprozesse), ohne künstliche Last. Belege lokal im Scratch-Ordner der Sitzung.

| Test | Ursache | Änderung | Befund |
| --- | --- | --- | --- |
| [R-5.1-14] F-UX3 Runde 4 Shift/Alt im selben Bild (`tests/wap-e2e/f-ux3/support/runde4.ts`) | Vergleich mit 1,6 × Bildabstand aus einer Ruhemessung; Takt in Ruhe ≠ Takt beim Ziehen (Anzeige 32 Hz, kopflos variabel) | Bildbezug über rAF-Zeitstempel: Anzeige im ersten Bild nach der Taste | FL2-01 |
| H-TESTS [R-5.1-14][R-5.1-16] Rand-Autoscroll (`tests/wap-e2e/h-tests/verschieben.spec.ts`) | Rollweite 215 px wird zwischen zwei Abfragen durchlaufen | scrollLeft je Bild im Browser aufgezeichnet, gleiche Bedingungen | FL2-02 |
| [R-5.1-14] F-UX3 Runde 4 «ohne Taste nie überlappen» (`tests/wap-e2e/f-ux3/support/runde4.ts`) | Fläche während des Gleitens nach dem Loslassen gelesen | Fläche erst nach zwei gleichen Bildern lesen | FL2-05 |
| [R-5.1-14] I2b A3 (`tests/wap-e2e/i2b/handhabung.dist.spec.ts`) | leere Bilder ohne Eingabe verdünnen das p95 je nach Bildtakt | nur Bilder mit Zeigerbewegung; 16,7 ms unverändert | FL2-03; Produkt FL2-04 |

## Belege

| Lauf | Befehl / Auswahl | Ergebnis |
| --- | --- | --- |
| R0 (vorher, 26.10.2026 1452) | die drei Tests, `--repeat-each=3`, edge und edge-dist | 7 rot: Shift/Alt edge 3/3 (24,4–28,5 ms > 16 ms bei bilder = 2), Rand-Autoscroll 3/3 (215 ≤ 265), A3 1/3 (17,0 ms) |
| Messhilfe P1 | Rollweite und Verlauf | scrollWidth − clientWidth = 215 px; scrollLeft nach 200 ms schon 215 |
| Messhilfen P2–P4 | A3-Varianten je 3 × | alle Bilder: 196–236 Bilder je 60 Bewegungen, p95 Belastungstest 8,7–15,0 ms; ohne Bildratenbegrenzung 2257–3004 Bilder, p95 1,6–2,2 ms (Verdünnung, verworfen); nur Bilder mit Eingabe: 60 Bilder, p95 14,9–19,0 ms |
| R1, R2 (nachher) | Shift/Alt und Rand-Autoscroll `--repeat-each=5` | 15/15 grün |
| R1 (nachher) | A3 `--repeat-each=3` | 3/3 rot: Belastungstest p95 17,1; 17,6; 29,8 ms → Produktbefund FL2-04 |
| V (1513–1540) | `npm run wap:test:e2e` 3 × (Stand 45755c3) | je 466 Ergebnisse; rot nur A3 (p95 29,0; 22,8; 20,9 ms, FL2-04) und in Lauf 2 zusätzlich F-UX3 «ohne Taste nie überlappen» (FL2-05) |
| N0 | «ohne Taste nie überlappen» `--repeat-each=10` (vorher, edge) | 0/10 rot (nur im vollen Lauf) |
| N1 | F-UX3 Runde 4 ganz `--repeat-each=5`, edge und edge-dist (nachher) | 40/40 grün |
| V2 (1547–1614) | `npm run wap:test:e2e` 3 × (Stand 729e55c) | je 466 Ergebnisse, 465 grün; rot nur A3 (p95 21,1; 21,0; 24,6 ms, Produktbefund FL2-04) |

## Kästchen

- [x] 1 Paket-Worktree angelegt und installiert (`git worktree add … -b wap/f-flaky2 21dc35a`, `npm ci`)
- [x] 3 Tests: drei bestehende E2E-Tests mit anzeigeunabhängiger Messung, ohne neue Testdateien
- [x] 6 Freeze entfällt (keine neuen Testdateien); geänderte gesperrte Dateien per lock-update nachgeführt (Grund «F-FLAKY2: Messung lastfest/anzeigeunabhängig (Koordinator 26.10.2026)»)
- [x] 7 Umsetzung: entfällt (nur Tests)
- [ ] 9 Merge-Schleuse (Koordinator)
- [ ] 10 Prüfung: frischer `test-reviewer`
