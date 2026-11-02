# Paket F-ABDECKUNG3 – Zweigabdeckung `src/pages` (Nachtrag zu F-ABDECKUNG2)

- Etappe: 1 (Schlussrunde vor Gate B)
- Anforderungen: (keine eigenen; die Tests tragen R-5.7-01 und R-11-07)
- Worktree: `C:\Users\phili\source\repos\wap-wt\f-abdeckung3` · Zweig `wap/f-abdeckung3` ab `wap-codex` 6674e0f (nach F-TOOLS4)
- Grundlage: Nachtrag des Koordinators (26.10.2026): `src/pages` nach F-TOOLS4 bei 4 / 7 Zweigorten (57,1 %, Schwelle 75 % unverändert); offen die Fälle «ohne Eigenschaft» und der Vorgabewert `= {}` in `WapPage`. Testpfad dauerhaft additiv nach Freigabe des Auftraggebers 13.10.2026 «ja dauerhaft».

Nur Tests, kein Produktcode. `tests/wap/unit/f-abdeckung3/wap-seite.test.ts` (jsdom, Testing-Library, leere lokale Datenbank über fake-indexeddb) rendert `WapPage` ohne Eigenschaftsobjekt (Vorgabe `= {}`), mit leerem Objekt und mit teilweisen Eigenschaften und prüft: Erststart «Neuer Plan aus Vorlage» und «Excel-WAP importieren» sichtbar, Hülle mit `--wap-i2-height: 100dvh`, keine Konsolenfehler; ohne Delegat öffnet «?» am Fenster die Tastenübersicht, mit Delegat nicht (nur über den Delegaten), Delegat und Palettenquelle werden beim Verlassen auf null gesetzt, Kopfwerkzeuge der Suite erscheinen nur, wenn übergeben.

## Messwerte

| Modulordner | vorher (F-TOOLS4) | nur dieser Test (Vitest) |
| --- | --- | --- |
| src/pages | 57,1 % (4 / 7) | 100 % (7 / 7) |

- [x] 1 Paket-Worktree angelegt und installiert (`git worktree add … -b wap/f-abdeckung3 6674e0f`, `npm ci`)
- [x] 3 Tests: 4 Tests in `tests/wap/unit/f-abdeckung3/wap-seite.test.ts`, jeder mit Anforderungs-ID
- [x] 6 eingefroren: Testdatei per lock-update gesperrt (Grund «F-ABDECKUNG3»), Testpfad in `scripts/wap-gate/testpfade.json` additiv registriert und nachgeführt
- [x] 7 Umsetzung: entfällt (nur Tests); alle Tests grün gegen den bestehenden Code, kein Produktfehler gefunden
- [ ] 9 Volle Schleuse (Orchestrator)
- [ ] 10 Prüfung: frischer `test-reviewer`

## Belege

| Schritt | Befehl / Commit | Auszug |
| --- | --- | --- |
| Messung | `npx vitest run -c vitest.wap.config.ts f-abdeckung3 --coverage.enabled=true …`, dann `node scripts/wap-gate/coverage-check.mjs --istanbul <datensatz>` | `src/pages` 7 / 7 = 100 % |
| Stabilität | derselbe Lauf dreimal ohne Abdeckung | 4 / 4 grün, ohne Konsolenausgaben |
| Lint, Typen | `npx biome check tests/wap/unit/f-abdeckung3`, `npx tsc --noEmit -p tsconfig.wap.json` | ohne Befund in der neuen Datei |
| Freeze und Test | 1a8652e (Hook: Schleuse fast grün, 14 Schritte) | Testpfad registriert, 1 Datei gesperrt (lock-update «F-ABDECKUNG3») |
| Merge wap-codex c4ab336 | 92e0fbf (Hook grün, 14 Schritte); Protokollzeilen F-ABDECKUNG3 zuerst, dann F-UX5 | `wap-seite.test.ts` danach 4 / 4 grün |
