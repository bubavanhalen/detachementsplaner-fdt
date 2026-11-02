# F-TOOLS3 – Paketzweig `wap/f-tools3` (Werkzeuge Runde 3: Selbsttest-Laufzeit, Abdeckung src/pages und tools/wap, Golden Bildschirm)

- Etappe: 1 (vor Gate B).
- Anforderungen:
- Hinweis: Die Tests tragen nur IDs bereits eingefrorener Pakete (R-H-16 aus E1-01/F-TOOLS); keine Neuzuordnung im
  Etappenplan.
- Worktree: `C:\Users\phili\source\repos\wap-wt\f-tools3` · Zweig `wap/f-tools3` ab `wap-codex` 291a396
- Bezug: Auftrag des Koordinators F-TOOLS Runde 3 (23.10.2026) nach der vollen Schleuse auf a8e2f1d
  (V1a-selbsttest «Zeitlimit von 7200 s überschritten»; V2-abdeckung src/pages 0 %, tools/wap 14,7 %).
  Befunde FT3-01 bis FT3-03 in `FINDINGS.md`, Abschnitt «F-TOOLS3».

## Aufträge

| Nr | Auftrag | Stand |
| --- | --- | --- |
| 1 | V1a-selbsttest: Ursache des Zeitlimits, kleinste Lösung ohne geringere Prüfwirkung | umgesetzt (FT3-01, FT3-04); Beleglauf 4020 s, grün erst mit Chromium 1243 (FT3-05) |
| 2 | src/pages: Abdeckung messbar machen (Messung, nicht Schwelle) | Ursache bestimmt, Vorschlag (FT3-02) |
| 3 | tools/wap: Gate-B-Entscheid 34 vorbereiten | Weg a umgesetzt (Messung, FT3-03), Weg c vorbereitet |
| 4 | Golden Bildschirm (V6) nach F-UX3 neu aufnehmen, PDF-Goldens prüfen | PDF-Goldens unverändert (4/4); Bildschirm blockiert (FT3-05) |

## 1 Selbsttest-Laufzeit (FT3-01)

Analyse ohne Volllauf (Code und Entwicklerprobe je Fall, `runSelftest` mit eigener Sperr-Ablage wie
`support/last.ts`). Kein Fall hängt; jeder Fall startet einen frischen Klon und genau eine Schleuse bzw. einen Schritt.
Die Laufzeit kam aus zwei Quellen:

- Die 11 Fälle der schnellen Schleuse (S1, S2, S4, S5, Z-only, Z-console, Z-any, Z-biome-ignore, Z-suite-datei,
  Z-fremde-id, Z-ungesperrt) liefen alle Schritte F3–F9, also je den ganzen Vitest-Lauf (F8, gut 85 s) und die
  Testlisten (F9, gut 80 s). Gewertet werden nur die erwarteten Schritte; jetzt läuft nur noch dieser.
- Z-abdeckung lief die ganze Stufe V2. Seit FT-A-02 gehört dazu die ganze E2E-Suite (V2-e2e, ruhig über 10 min), und
  der Fall läuft zweimal (Gesamtlauf in `selftest.selbsttest.ts` und `selftest-f-tools.selbsttest.ts`). Jetzt prüft
  er den Schritt V2-abdeckung direkt.

Entwicklerprobe nach der Änderung (Rechner durch andere Pakete 55–80 % belegt, Werte daher eher zu hoch):

| Fall | s | Fall | s | Fall | s |
| --- | --- | --- | --- | --- | --- |
| S1 | 15 | Z-biome-ignore | 8 | Z-lizenz-gpl | 6 |
| S2 | 10 | Z-suite-datei | 12 | Z-lizenztext | 11 |
| S3a | 9 | Z-referenz-fehlt | 6 | Z-abdeckung | 167 |
| S3b | 11 | Z-fremde-id | 147 | Z-golden-kette | 5 |
| S4 | 11 | Z-ungesperrt | 14 | Z-golden-pixel | 17 |
| S5 | 162 | Z-name-v11 | 8 | Z-mutation | 13 |
| Z-only | 12 | Z-python2 | 6 | S7 | 7 |
| Z-console | 12 | S6 | 18 | Z-suite-worker | 9 |
| Z-any | 11 | | | Z-utf16 | 6 |

Alle 26 Fälle erkannt, zusammen rund 700 s. Die Zeitgrenze 7200 s bleibt unverändert.

## 2 src/pages (FT3-02)

`src/pages/WapPage.tsx` ist die einzige Datei des Modulordners (7 Zweigorte). Kein WAP-Test lädt sie: Die
Einzeldateien entstehen aus `tests/wap-e2e/harness/*.tsx`, nicht aus `src/App.tsx`, und die Suite-Harnesse
`h-ui.tsx`/`h-ui2.tsx` bilden die Route ohne Excel-Import nach, weil WapPage das Import-Werk samt fflate einbindet und
Harness-Einzeldateien keinen Worker enthalten dürfen (`scripts/wap-gate/einzeldatei.mjs`). Eine Quellzuordnung der
Einzeldatei würde deshalb nichts messen. Die Umstellung der Harnesse auf WapPage ist verworfen: Sie bricht die
Worker-Regel, und die Suite übergibt immer alle Eigenschaften (höchstens 4 von 7 Zweigorten).

Vorschlag: ein Unit-Test (jsdom) rendert WapPage mit und ohne Eigenschaften; das deckt 7 von 7 Zweigorten. Er gehört
zum test-engineer bzw. zu F-ABDECKUNG2. Messung und Schwelle bleiben unverändert.

## 3 tools/wap – Gate-B-Entscheid 34 (FT3-03)

**Weg a (Tests/Messung) – umgesetzt, kein Entscheid nötig:** `tools/wap/npm-lizenz.mjs` ist durch
`tests/wap-gate/npm-lizenz.gate.ts` geprüft (62 Tests, Aufruf im eigenen Prozess). Diese Tests liegen in der
Gate-Konfiguration und fehlten im Messlauf. `messeAbdeckung` misst sie jetzt in einem zweiten Lauf nur für
`tools/wap/**` (`messeWerkzeuge`) und führt den Datensatz je Zweigort zusammen; ohne Datensatz rot. Probe:
`npm-lizenz.mjs` 68 / 74, zusammen mit `gen-font-metrics.mjs` (13 / 14 aus Vitest) **tools/wap 81 / 88 = 92,0 %**.
Damit liegt tools/wap über 75 %, ohne die Pfadmenge zu ändern.

**Weg c (Pfadmenge ohne Bau-Skripte) – nur vorbereitet, braucht deine Zustimmung (Prompt §7):**

- `scripts/wap-gate/coverage-schwellen.json`: in der Menge «uebrig» `"tools/wap/**"` streichen und eine Begründung
  ergänzen, z.B. `"begruendung": "tools/wap/** ist Bauwerkzeug, kein ausgelieferter Code; belegt durch Build,
  V10-lizenztexte und die Gate-Tests (Gate-B-Entscheid 34 c)"`.
- Folgeänderungen: `tests/wap-gate/config-f-tools.gate.ts` (prüft die Musterliste wörtlich; Test-Einwand nötig), ADR-010
  §6.2 (AR0-20 ordnet tools/wap der 75-%-Menge zu; architect).
- Mit Weg a ist Weg c für tools/wap nicht mehr nötig; für src/pages bleibt Entscheid 34 «messen» (FT3-02).

## 4 Golden-Bilder

- PDF (V5-golden, `vitest run -c vitest.wap-golden.config.ts`) auf 291a396: 4/4 grün, 0 Pixel Abweichung;
  F-UX3 ändert die PDF nicht.
- Bildschirm (V6): blockiert, Playwright-Chromium 1243 fehlt (FT3-05); Neuaufnahme mit
  `node scripts/wap-gate/e2e.mjs --project chromium-visual --baselines F-TOOLS --geaendert --grund …`, danach
  lock-update der beiden PNG, sobald der Orchestrator Chromium installiert hat.

## Beleglauf Selbsttest

`VITEST_MAX_WORKERS=1 npx vitest run -c vitest.wap-selbsttest.config.ts` auf 66be72e, Start 23.10.2026 16:34 bei
freier Sperre und bestandenem F0-last (Last unter 25 %): **4020 s** (Grenze 7200 s), 27 Dateien, 76 von 101 Tests grün.

| Datei | s | Datei | s |
| --- | --- | --- | --- |
| e2e-grundlauf | 1380 | selftest (Gesamtlauf aller 26 Fälle und --nur S5,S2) | 492 |
| gate-fast | 1009 | e2e-support-c | 103 |
| e2e-route | 491 | übrige 21 Dateien | je unter 135 |

Rot: 20 Fälle wegen fehlendem Chromium 1243 (FT3-05), 4 Testfehler eigener F-TOOLS-Selbsttests (FT3-04, behoben,
einzeln grün 5/5), 1 Fall in e2e-grundlauf (FT3-05, offen). Der Gesamtlauf aller Selbsttest-Fälle
(`selftest.selbsttest.ts`) ist grün. Wiederholung des vollständigen Beleglaufs nach der Installation von Chromium.
