# Paket F-FLAKY3 – zeitkritische E2E exklusiv in wap:test:e2e

- Etappe: 1 (Merge-Schleuse vor dem Merge nach wap-planer)
- Anforderungen: (keine eigenen; die Tests tragen IDs eingefrorener Pakete)
- Worktree: `C:\Users\phili\source\repos\wap-wt\f-flaky3` · Zweig `wap/f-flaky3` ab `wap-codex` 801fa62
- Grundlage: Auftrag F-FLAKY3 des Koordinators (26.10.2026): I2b A3 allein 6/6 grün, im vollen Lauf mit zwei Workern rot (18,0 ms).

Nur Testkonfiguration und Markierungen, kein Produktcode; Grenzwerte unverändert.

Die zeitkritischen Tests tragen die Markierung `@zeitkritisch` (Titel unverändert). In `playwright.wap.config.ts` schliessen `edge` und `edge-dist` sie aus (`grepInvert`). Das Projekt `edge-zeit` führt nur sie aus (`grep`, `workers: 1`, Einzeldatei-Tests öffnen file://). Es ist der «teardown» des Auftakts `zeit-auftakt` (ohne Tests), von dem `edge` und `edge-dist` abhängen: Es startet erst, wenn beide fertig sind, und läuft – anders als bei «dependencies» – auch, wenn dort Tests rot sind (geprüft mit einem absichtlich roten Test; erste Fassung 530775a mit «dependencies» übersprang die vier Tests nach jedem fremden roten Test). `scripts/wap-gate/e2e.mjs` übernimmt die Projekte unverändert (alle ausser perf und chromium-visual).

| Test | Projekt |
| --- | --- |
| [R-5.1-14] I2b A3 p95 Bildzeit (`tests/wap-e2e/i2b/handhabung.dist.spec.ts`) | edge-zeit |
| [R-5.1-14] F-UX3 Runde 4 Shift und Alt im selben Bild (`tests/wap-e2e/f-ux3/support/runde4.ts`) | edge-zeit (beide Dateien) |
| [R-5.1-14][R-5.1-16] H-TESTS Rand-Autoscroll (`tests/wap-e2e/h-tests/verschieben.spec.ts`) | edge-zeit |

Geprüft und nicht markiert: [R-11-11] F-UX3 «Überfahren innerhalb derselben Zone» zählt Layoutabfragen und Stilschreibvorgänge, keine Zeit. R-11-11 im Sinne des Budgets misst nur das Leistungsprojekt (`tests/wap-perf/f-doku/ziehen.perf.ts`), das nicht Teil von wap:test:e2e ist.

## Belege

| Lauf | Stand | Ergebnis |
| --- | --- | --- |
| V1–V3 `npm run wap:test:e2e` (19:40–20:50, vor jedem Lauf CPU 1 %) | 530775a (dependencies) | je 462 Ergebnisse, 1401 / 1347 / 1314 s statt bisher 489–537 s; je ein fremder 30-s-Test rot (render/page-view EXIF, H-UI2 UX-H-10, F-DOKU Notiz), danach die vier zeitkritischen übersprungen. Alle Tests gleichmässig rund 2,5× langsamer (Median-Verhältnis je Test 2,54 gegenüber F-FLAKY2 V2); Sitzung des Auftraggebers getrennt («query user»: Disc) |
| T1 (absichtlich roter Probetest) | Teardown-Fassung | edge-zeit läuft nach dem roten Test; Shift/Alt und Rand grün; A3 rot mit Realistisch p95 42,0 ms (sonst 5–6 ms) – bei getrennter Sitzung ist die Bildzeit nicht aussagekräftig |

Offen: Beleg «3 × ganz grün» bei verbundener Sitzung.

## Kästchen

- [x] 1 Paket-Worktree angelegt und installiert (`git worktree add … -b wap/f-flaky3 801fa62`, `npm ci`)
- [x] 3 Tests: drei bestehende Tests markiert, keine neuen Testdateien
- [x] 6 Freeze entfällt (keine neuen Testdateien); Konfiguration und markierte Dateien per lock-update nachgeführt (Grund «F-FLAKY3: zeitkritische E2E exklusiv (Koordinator 26.10.2026)»)
- [x] 7 Umsetzung: entfällt (nur Testkonfiguration)
- [ ] 9 Merge-Schleuse (Koordinator)
- [ ] 10 Prüfung: frischer `test-reviewer`
