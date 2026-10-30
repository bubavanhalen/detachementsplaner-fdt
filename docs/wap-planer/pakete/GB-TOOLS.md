# GB-TOOLS – Paketzweig `wap/gb-tools` (Gate-B-Entscheide 7b und 34c an den Werkzeugen)

- Etappe: 1 (Nacharbeit Gate B).
- Anforderungen:
- Hinweis: keine neuen Tests; angepasst sind die Prüfungen der Schwellendatei (R-H-16) an Entscheid 34c; keine
  Neuzuordnung im Etappenplan.
- Worktree: `C:\Users\phili\source\repos\wap-wt\gb-tools` · Zweig `wap/gb-tools` ab `wap-codex` edd59b6
- Bezug: Gate B 28.10.2026 «All as recommended» (Vorlage `.qa\gate-b\gate-b-vorlage-entwurf.md`), Auftrag des
  Koordinators vom 28.10.2026; lock-update mit Grund «Gate B 28.10.2026 Entscheid 7b/34c».

## Entscheid 34c – tools/wap aus «übriger WAP-Code»

- `scripts/wap-gate/coverage-schwellen.json`: `tools/wap/**` aus der Menge «uebrig» entfernt, Begründung und
  Entscheid-Verweis im Feld `entscheid` der Menge (Bauwerkzeug, kein ausgelieferter Code; belegt durch V10-build,
  V10-release (check:release), V10-lizenztexte und die Gate-Tests der Werkzeuge). Schwellen 90 / 75 % und alle
  übrigen Muster unverändert; `src/pages/WapPage.tsx` bleibt gemessen.
- `scripts/wap-gate/coverage-check.mjs`: Der Werkzeug-Messlauf (FT3-03) entfällt, solange `tools/wap/**` zu keiner
  Pfadmenge gehört; der Mechanismus bleibt erhalten.
- Tests nachgeführt: `config-f-tools.gate.ts` (Musterliste ohne tools/wap, Entscheid-Verweis vorhanden),
  `coverage-werkzeuge.gate.ts` (Muster in keiner Pfadmenge, im Arbeitsbaum kein Lauf).
- Messung (nur Vitest, ohne E2E-Anteil): `src/pages` 7 / 7 = 100 %, `tools/wap` nicht mehr im Bericht.
- Offen für den architect: ADR-010 §6.2 (Tabelle und AR0-20) nennt tools/wap noch in der 75-%-Menge.

## Entscheid 7b – Golden-Bilder

| Bild | Status | Bemerkung |
| --- | --- | --- |
| PDF `baselines/kvk-woche-s1.png` | freigegeben | |
| PDF `baselines/kvk-fortsetzung-s1.png` | freigegeben | |
| PDF `baselines/kvk-fortsetzung-s2.png` | freigegeben | |
| PDF `baselines/synth-woche-1-s1.png` | freigegeben | |
| Bildschirm `f-tools-kvk-woche.png` | vorläufig | nach F-UX3 neu aufgenommen (F-TOOLS5), Freigabe beim nächsten Gate |
| Bildschirm `f-tools-belastung-woche.png` | vorläufig | wie oben |

Abgrenzung zu GB-LAYOUT (flacher Marker, Entscheid 17): Keiner der vier PDF-Kandidaten enthält einen flachen
Marker (`asFlatBlock` ist in der KVK-Fixture `tests/wap/fixtures/durchstich/kvk.plan.json`, ihrer
Fortsetzungsvariante und im synthetischen Plan durchweg `false`); die Änderung des flachen Markers ändert diese Bilder
daher nicht, alle vier sind freigegeben. Ändert GB-LAYOUT dennoch ein Bild (z.B. über Entscheid 18
«Markerfeld weicht Blöcken aus»), nimmt GB-LAYOUT es neu auf; die Aufnahme setzt es wieder auf «vorläufig».
V5-golden auf edd59b6 vor und nach der Statusänderung grün (4/4, 0 Pixel).
