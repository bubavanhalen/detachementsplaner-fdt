# GB-TOOLS3 – Paketzweig `wap/gb-tools3` (PDF-Goldens nach KR-Bedeutung, Gate-B-Entscheid 39)

- Etappe: 1 (Nacharbeit Gate B).
- Anforderungen:
- Hinweis: keine neuen Tests; nachgeführt sind drei Baselines der PDF-Goldens (R-H-20); keine Neuzuordnung im
  Etappenplan.
- Worktree: `C:\Users\phili\source\repos\wap-wt\gb-tools3` · Zweig `wap/gb-tools3` ab `wap-codex` 113ce22
- Bezug: Auftrag des Koordinators vom 29.10.2026 nach GB-DOKU2 (KR = «Kompanierapport» in der Kp-Vorlage), gleicher
  Ablauf wie GB-TOOLS2.

## Prüfung und Neuaufnahme (29.10.2026)

1. V5-golden auf 113ce22: 3 von 4 rot – kvk-woche-s1 und kvk-fortsetzung-s1 je 1200 Pixel, synth-woche-1-s1
   1207 Pixel; kvk-fortsetzung-s2 unverändert.
2. Lage der Abweichung (300 dpi): kvk-woche-s1 und kvk-fortsetzung-s1 nur im Rechteck x 2999–3157, y 1532–1551,
   synth-woche-1-s1 nur im Rechteck x 2999–3157, y 1561–1580; Ausschnitte angesehen: ausschliesslich «Kompanierapport»
   in der Bedeutungsspalte der Zeile KR, übrige Legende, Kürzel, Raster und Blöcke unverändert.
3. `node scripts/wap-gate/golden-aufnahme.mjs --nur kvk-woche-s1,kvk-fortsetzung-s1,synth-woche-1-s1 --grund
   "Gate B 28.10.2026 Entscheid 39: Kürzelbedeutung KR …"`, Status der drei Bilder wieder «freigegeben», lock-update
   «Nachführung» der drei Bilder und des Manifests.
4. V5-golden danach zweimal grün (4/4, 0 Pixel); V6 unverändert, zweimal grün; Bildschirm-Goldens bleiben
   «vorläufig» (F-TOOLS5).

| Bild | SHA-256 (gekürzt) | Status |
| --- | --- | --- |
| `baselines/kvk-woche-s1.png` | 68e35aa2 | freigegeben |
| `baselines/kvk-fortsetzung-s1.png` | ca2fadaf | freigegeben |
| `baselines/kvk-fortsetzung-s2.png` | 4dd6f378 | freigegeben (unverändert) |
| `baselines/synth-woche-1-s1.png` | 29b38c31 | freigegeben |

Vorher, Nachher, Differenz und Ausschnitte (nur fiktive bzw. pseudonymisierte Daten) lokal unter `.qa\gb-tools3\`
des Haupt-Checkouts, nicht im Repo.
