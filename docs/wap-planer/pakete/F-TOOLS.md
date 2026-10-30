# Paket F-TOOLS – Pflichtwerkzeuge vor Gate B (Abdeckung, Lizenzprüfung, Golden-Bilder, Mutationstests)

- Etappe: 1 (Schlussrunde vor Gate B, Schnellspur AE-005/AE-006)
- Anforderungen: R-H-16, R-H-17, R-H-20, R-H-23, R-H-32, R-H-36, R-H-37
- Worktree: `C:\Users\phili\source\repos\wap-wt\f-tools` · Zweig `wap/f-tools` ab `wap-codex` cd21877
- Grundlage: Auftrag F-TOOLS des Orchestrators (19.10.2026); Freigabe des Auftraggebers 19.10.2026 «7: ja» (Werkzeug-Stopp gelockert für Abdeckung, Lizenzprüfung, Golden-Bilder, Mutationstests; Freigabeprotokoll in `PROGRESS.md`); Prompt §5.3 Paket 1, §7; ADR-010 §3, §6, §7.3, §9; Vertrag E1-01 §2, §3, §6d, §9; Plan Etappe 1, Änderungsnotiz «AE-006 – Härtung F-TOOLS»; Q-019 (Lizenz-Ausnahmen «nurEntwicklung»).

Schnellspur: Werkzeug und Tests entstehen zusammen (Entwürfe `*.entwurf.ts` aus E1-01d/e übernommen und angepasst); am Ende eingefroren (Grund «F-TOOLS»).

- [x] 1 Paket-Worktree angelegt und installiert (`git worktree add … -b wap/f-tools cd21877`, `npm ci`)
- [x] 6 Test-Freeze: neue Tests (21, Grund «F-TOOLS») und Werkzeugdateien (18, Grund «F-TOOLS, Auftraggeber 19.10.2026 «7: ja»») per lock-update gesperrt; Testpfade in scripts/wap-gate/testpfade.json registriert
- [x] 7 Umsetzung nach Schnellspur AE-005/AE-006 (Werkzeug und Tests zusammen)
- [x] 8 Golden-Bilder: Erstaufnahme «vorläufig» auf dem Stand nach F-UX2/F-LAYOUT2 (wap-codex 6e5726f, Merge a415919), 4 PDF-Seiten und 2 Bildschirm-Kernzustände; V5-golden und V6 je zweimal grün (0 Pixel Abweichung)
- [ ] 9 Volle Schleuse (Orchestrator)

## Werkzeuge

| Werkzeug | Schritt | Dateien | Selbsttest «Verstoss eingebaut → rot» |
| --- | --- | --- | --- |
| Abdeckung (R-H-16) | V2-abdeckung | `scripts/wap-gate/coverage-check.mjs`, Schwellen `scripts/wap-gate/coverage-schwellen.json`, Abdeckung in `vitest.wap.config.ts`, Bericht `test-results/wap/coverage/bericht.md` | Z-abdeckung: neues Fachlogik-Modul ohne Test → V2 rot mit Modulordner |
| Lizenzprüfung (R-H-23) | F10-lizenzen, V10-lizenztexte | `scripts/wap-gate/license-check.mjs`, `scripts/wap-gate/license-assets.json` | Z-lizenz-gpl: neue GPL-Abhängigkeit → F10 rot; Z-lizenztext: Lizenztext aus der Einzeldatei entfernt → V10-lizenztexte rot |
| Golden-Bilder (R-H-20) | V5-golden | `scripts/wap-gate/golden.mjs`, `golden-report.mjs`, `golden-aufnahme.mjs`, `vitest-golden-setup.mjs`, `vitest.wap-golden.config.ts`, `tests/wap/golden/**` (Render-Kette, Manifest, Kandidaten), Bildschirm `tests/wap-e2e/support/kernzustaende/f-tools.ts` | Z-golden-kette: Render-Kette geändert → V5-golden rot «Render-Kette geändert»; Z-golden-pixel: abweichendes Bild → V5-golden rot |
| Mutationstests (R-H-17) | V8-mutation | `stryker.wap.conf.mjs`, `scripts/wap-gate/mutation.mjs`, Bericht `test-results/wap/stryker/bericht.md` | Z-mutation: Modul mit schwachem Test → V8 rot (Score unter 80 %) |

## Messwerte (20.10.2026, Stand 531e9f7)

**Abdeckung (V2, nur Vitest; Schwellen unverändert):** `node scripts/wap-gate/coverage-check.mjs` → ROT, 2228 Tests, 0 rot im Messlauf.

| Pfadmenge | Schwelle | gedeckt / gesamt | Prozent |
| --- | --- | --- | --- |
| Fachlogik, Layout, Prüfregeln, Import | 90 % | 4917 / 6018 | 81,7 % |
| übriger WAP-Code | 75 % | 2219 / 7256 | 30,5 % |

Module unter der Schwelle: `src/model/wap/checks` 74,5 %, `commands` 78,9 %, `layout/page` 87,4 %, `list` 43,0 %, `src/io/wap-import` 68,6 %, `agenda-text` 62,7 %, `formtext` 69,7 %, `src/io/wap-persons` 71,1 %, `src/components/wap/flows` 15,2 %, `i2` 27,9 %, `import` 0 %, `list` 0 %, `panel` 0 %, `render` 0,6 %, `settings` 0 %, `src/pages` 0 %, `tools/wap` 14,7 %. Über der Schwelle: `src/model/wap` 95,6 %, `derive` 98,6 %, `history` 90 %, `layout/entries` 93,5 %, `layout/grid` 100 %, `layout/text` 95,8 %, `stand` 100 %, `template` 90 %, `src/io/xlsx-drawing` 95,3 % (fünf Altmodule ausgenommen, SHA-256 unverändert), `src/io/wap-pdf` 93,5 %, `src/io/wap-plan` 88,4 %, `src/assets/wap-fonts` 100 %. E2E-Anteil fehlt (FT-A-02).

**Abdeckung mit E2E-Anteil (FT-A-02, 20.10.2026, Stand nach Merge a201b77):** Vitest `--maxWorkers=2` (2279 Tests grün) plus E2E Projekt edge `--workers=2` (180 Testdateien mit Abdeckung; 1 Lastfall rot, R-5.6-01), zusammengeführt für beide Pfadmengen (R-H-16).

| Pfadmenge | Schwelle | nur Vitest | Vitest + E2E |
| --- | --- | --- | --- |
| Fachlogik, Layout, Prüfregeln, Import | 90 % | 82,6 % | 84,0 % (5178 / 6163) |
| übriger WAP-Code | 75 % | 30,6 % | 73,4 % (5343 / 7279) |

Unter der Schwelle (zusammen): components/wap i2 74,5 %, import 73 %, list 55,7 %, panel 61,8 %, settings 36,5 %; io/wap-import 71,7 %, agenda-text 62,7 %, formtext 69,7 %; io/wap-persons 71,1 %; model/wap checks 79,5 %, commands 82,2 %, layout/page 87,6 %, list 69,1 %; src/pages 0 % (WapPage nur in der Einzeldatei geladen, edge-dist ohne Quellzuordnung); tools/wap 14,7 %. Neu über der Schwelle: components/wap flows 82,3 %, render 87,7 %, io/wap-plan 90,3 %.

**Lizenzen:** F10 grün: 229 neue oder geänderte Pakete bewertet, 208 Suite-Pakete aufgelistet, 5 Ausnahmen «nurEntwicklung» (axe-core, @axe-core/playwright: Gate 0 E3; caniuse-lite, minimatch, foreground-child: Q-019). V10-lizenztexte grün: 57 erwartete Blöcke (App, 54 npm-Pakete inkl. Ersatztexte Q-031, Arimo OFL-1.1, hyph-de-1996 MIT).

**Mutation (V8):** kein voller Lauf (Koordinator 20.10.2026). Teilmessungen mit Läufer `vitest-wap`: Beso-Nummerierung `src/model/wap/commands/numbering.ts` 88,1 % (142 Mutanten: 117 getötet, 1 Zeitüberschreitung, 16 überlebt, 8 statisch nicht gewertet; concurrency 1, 14 min 38 s); Formtext-Zerlegung `formtext/index.ts` Zeilen 37–130 55,5 % (86 getötet, 68 überlebt, 1 ohne Abdeckung). Übrige Bereiche (Fachlogik, Layout-Schicht, Prüfregeln, Rest Formtext) nicht gemessen; Trockenlauf je Bereich rund 6 min, Schätzung voller Lauf mehrere Stunden (FT-M-03).

**Golden (Erstaufnahme 20.10.2026, Status «vorläufig» bis zur Freigabe an Gate B):** `npm run wap:golden:aufnahme -- --grund "Golden-Erstaufnahme Schlussrunde nach F-UX2/F-LAYOUT2 (Koordinator 20.10.2026)"` und `node scripts/wap-gate/e2e.mjs --project chromium-visual --baselines F-TOOLS`; danach V5-golden (`vitest run -c vitest.wap-golden.config.ts`: 4/4) und V6 (`OK V6-visual`) je zweimal grün, Toleranz 0 Pixel.

| Bild | Pfad | Quelle | SHA-256 (gekürzt) |
| --- | --- | --- | --- |
| KVK-Woche, Wochenseite | `tests/wap/golden/baselines/kvk-woche-s1.png` | PDF, 300 dpi, 3508 × 2480 | 59cb07646319 |
| KVK mit 40 Tagesbemerkungen, Wochenseite | `tests/wap/golden/baselines/kvk-fortsetzung-s1.png` | PDF | b9564155bc89 |
| KVK mit 40 Tagesbemerkungen, Fortsetzungsseite | `tests/wap/golden/baselines/kvk-fortsetzung-s2.png` | PDF | 4dd6f3788fee |
| Synthetischer Plan, erste Woche | `tests/wap/golden/baselines/synth-woche-1-s1.png` | PDF | 4d82efd30cb4 |
| Bildschirm Standardansicht KVK-Woche | `tests/wap-e2e/__screenshots__/chromium-visual/f-tools-kvk-woche.png` | Chromium 1243, 1600 × 1000 | – |
| Bildschirm Belastungstest, erste Woche | `tests/wap-e2e/__screenshots__/chromium-visual/f-tools-belastung-woche.png` | Chromium 1243, 1600 × 1000 | – |

Manifest `tests/wap/golden/manifest.json`, Render-Kette `tests/wap/golden/render-chain.json`. Bericht Vorher/Nachher/Differenz (lokal, neu erzeugbar mit `npm run wap:golden:bericht`): `test-results/wap/golden/bericht/bericht.md` – 4 neu, 0 geändert.

## Belege

| Schritt | Befehl / Commit | Auszug |
| --- | --- | --- |
| Werkzeuge eingehängt | f4d9f09 | Pre-commit: `Schleuse fast: grün (13 Schritte)`, F10-lizenzen OK |
| Schleusen-Tests | `VITEST_MAX_WORKERS=4 npx vitest run -c vitest.wap-gate.config.ts` | 989 Tests: 982 grün; 7 rot, davon 4 durch V9 (behoben, trace-Tests danach 29/29 grün) und 3 vorbestehend auf cd21877 (FT-V-01) |
| Stryker-Korrektur | 3516611 | Mini-Repo: starker Test in describe 100 %, schwacher 9,5 % (Exit 1) |
| Selbsttest (Entwicklerprobe) | 531e9f7 | Z-lizenz-gpl F10, Z-lizenztext V10-lizenztexte, Z-abdeckung V2, Z-golden-kette und Z-golden-pixel V5-golden, Z-mutation V8: alle «erkannt» |
| FT-V-01 | 47e064d | build-offline-lizenz.gate.ts 5/5 grün; TE-FT-01 (reference-runner) gemeldet |
| FT-A-02 | (dieser Commit) | coverage-e2e.gate.ts 3/3; Zweigorte Vitest 13 824, davon in E2E wiedergefunden 13 824 |
| Runde 2 (SA-2-03/-04) | dieser Commit | R-H-32 S7, R-H-36 (45/45), R-H-37 F7-worker (4/4), CR-E101-P07 (8/8); Entwicklerprobe S6, S7, Z-suite-worker, Z-utf16 erkannt |
| CS-I5-B3-KONSOLE-01 | 3516611, `node scripts/wap-gate/e2e.mjs` | OK V4-e2e, 276 erwartet, 0 unerwartet; E2E-Seiten ohne `/@react-refresh` |
