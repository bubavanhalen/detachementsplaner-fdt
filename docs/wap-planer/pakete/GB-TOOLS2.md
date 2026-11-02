# GB-TOOLS2 – Paketzweig `wap/gb-tools2` (PDF-Goldens nach Gate-B-Entscheid 39 neu aufgenommen)

- Etappe: 1 (Nacharbeit Gate B).
- Anforderungen:
- Hinweis: keine neuen Tests; nachgeführt sind drei Baselines der PDF-Goldens (R-H-20); keine Neuzuordnung im
  Etappenplan.
- Worktree: `C:\Users\phili\source\repos\wap-wt\gb-tools2` · Zweig `wap/gb-tools2` ab `wap-codex` c29af99
- Bezug: Auftrag des Koordinators vom 29.10.2026 nach GB-DOKU (Gate-B-Entscheid 39: Kürzelbedeutungen ARK, BR 0–3 in
  der Kp-Vorlage, inhaltlich vom Auftraggeber geliefert).

## Prüfung und Neuaufnahme (29.10.2026)

1. V5-golden auf c29af99: 3 von 4 rot – kvk-woche-s1 und kvk-fortsetzung-s1 je 1534 Pixel, synth-woche-1-s1
   5151 Pixel; kvk-fortsetzung-s2 unverändert.
2. Lage der Abweichung (Pixelvergleich Vorher/Nachher bei 300 dpi): kvk-woche-s1 und kvk-fortsetzung-s1 nur im Rechteck
   x 2999–3200, y 1457–1477 (Bedeutung zu «BR 0»: «Bataillonsrapport KVK»); synth-woche-1-s1 nur im Rechteck
   x 2997–3275, y 1417–1508 (Bedeutungen zu ARK, BR 0, BR 1). Ausschnitte angesehen: ausschliesslich die
   Bedeutungsspalte der Kürzelliste; Kürzel, Raster, Blöcke und übrige Legende unverändert. Die Bedeutung von KR fehlt
   noch (folgt mit eigener kleiner Neuaufnahme).
3. `node scripts/wap-gate/golden-aufnahme.mjs --nur kvk-woche-s1,kvk-fortsetzung-s1,synth-woche-1-s1 --grund
   "Gate B 28.10.2026 Entscheid 39: …"`, danach Status der drei Bilder wieder «freigegeben» (Folge von Entscheid 39,
   Inhalt vom Auftraggeber), lock-update «Nachführung» der drei Bilder und des Manifests.
4. V5-golden danach zweimal grün (4/4, 0 Pixel). V6 (Bildschirm) unverändert und zweimal grün (18,5 s, 16,1 s); die
   Bildschirm-Goldens bleiben «vorläufig» (F-TOOLS5).

| Bild | SHA-256 (gekürzt) | Status |
| --- | --- | --- |
| `baselines/kvk-woche-s1.png` | 89be95a7 | freigegeben |
| `baselines/kvk-fortsetzung-s1.png` | 1fe534a8 | freigegeben |
| `baselines/kvk-fortsetzung-s2.png` | 4dd6f378 | freigegeben (unverändert) |
| `baselines/synth-woche-1-s1.png` | 360ee461 | freigegeben |

Vorher, Nachher, Differenz und Ausschnitte (nur fiktive bzw. pseudonymisierte Daten) liegen lokal unter
`.qa\gb-tools2\` des Haupt-Checkouts, nicht im Repo.
