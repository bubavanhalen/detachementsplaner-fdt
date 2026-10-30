# F-TOOLS5 – Paketzweig `wap/f-tools5` (Bildschirm-Goldens V6 nach F-UX3 neu aufgenommen)

- Etappe: 1 (vor Gate B).
- Anforderungen:
- Hinweis: keine neuen Tests; nachgeführt werden die Baselines der Kernzustände des Pakets F-TOOLS
  (`tests/wap-e2e/support/kernzustaende/f-tools.ts`, ID R-H-21); keine Neuzuordnung im Etappenplan.
- Worktree: `C:\Users\phili\source\repos\wap-wt\f-tools5` · Zweig `wap/f-tools5` ab `wap-codex` 5d81cf1
- Bezug: Auftrag des Koordinators vom 26.10.2026 vor dem Schluss-Gate (Chromium 1243 installiert, FT3-05).

- [x] 1 Paket-Worktree angelegt und installiert (`git worktree add … -b wap/f-tools5 5d81cf1`, `npm ci`)
- [x] 8 Bildschirm-Goldens neu aufgenommen, Status **vorläufig** (Freigabe durch den Auftraggeber an Gate B)
- [ ] 9 Volle Schleuse (Orchestrator)

## Neuaufnahme (26.10.2026, Rechner ruhig, Sperre frei)

1. Vergleich vorher: V6 rot, beide Kernzustände des Pakets F-TOOLS abweichend (KVK-Woche 5335 Pixel,
   Belastungstest 10205 Pixel, je rund 1 %); Abweichungen in Blockrahmen und Spaltenköpfen (Optik F-UX3).
2. `node scripts/wap-gate/e2e.mjs --project chromium-visual --baselines F-TOOLS --geaendert --grund "Bildschirm nach
   F-UX3 (Hover, Griffe, Optik), Chromium 1243 (Koordinator 26.10.2026)"` (die Kernzustände gehören zum Paket F-TOOLS;
   Zeile in `<git-common-dir>/wap-gate/protokoll.log`), danach lock-update «Nachführung» der beiden Bilder.
3. V6 danach zweimal grün (20,1 s und 15,2 s, Toleranz 0 Pixel); PDF-Goldens V5 unverändert 4/4.

| Bild | Pfad | Quelle | SHA-256 (gekürzt) | Status |
| --- | --- | --- | --- | --- |
| Standardansicht KVK-Woche | `tests/wap-e2e/__screenshots__/chromium-visual/f-tools-kvk-woche.png` | Chromium 1243, 1600 × 1000 | ddeeb975 | vorläufig |
| Belastungstest, erste Woche | `tests/wap-e2e/__screenshots__/chromium-visual/f-tools-belastung-woche.png` | Chromium 1243, 1600 × 1000 | c5c8b1ef | vorläufig |

Vorher, Nachher und Differenz (nur fiktive Daten) liegen lokal unter `.qa\f-tools5\` des Haupt-Checkouts
(`vorher/`, `nachher/`, `differenz/`), nicht im Repo.
