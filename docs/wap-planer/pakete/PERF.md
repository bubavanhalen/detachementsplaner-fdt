# PERF – Paketzweig `wap/perf` (Leistung beim Ziehen, Befund CS-PERF-DRAG-01; Schnellspur AE-005/AE-006)

- Etappe: 1 (zwischen I5 und Härtungsrunde).
- Anforderungen:
- Bezug: R-5.1-14 (Paket I2; Messung A3 «Ziehen mit gedrosselter CPU – p95 Bildzeit höchstens 16,7 ms», eingefroren in `tests/wap-e2e/i2b/handhabung.dist.spec.ts`) und das Budget Ziehen aus ADR-010 §8 (Paket E1-13a). Die Tests tragen nur IDs bereits eingefrorener Pakete; keine Neuzuordnung im Etappenplan.
- Grundlage: Auftrag PERF vom 14.10.2026; Beschrieb 11 «Ziehen folgt der Maus ohne sichtbare Verzögerung»; ADR-004 (Layout-Schicht, Leitplanke 2), ADR-010 §8. Zweig ab `wap-codex` 50247d7.

**Ursachen.** Jede Lageänderung beim Ziehen zeichnete das ganze Raster neu: alle Einträge, Tagesköpfe und Terminbereiche wurden neu erzeugt und von React verglichen und übernommen; die Terminzeilen wurden bei jedem Neuzeichnen neu berechnet; die angepassten Nachbarn (Variante c) liefen jedes Mal durch das volle Layout der Layout-Schicht für ihren Tag; das Autoscroll las bei jedem Bild die Lage des Rasters und erzwang damit eine sofortige Layout-Berechnung.

**Massnahmen.** (1) Zwischenspeicher der Rasterelemente (`renderCache.ts`): Ansichten, Tagesköpfe und Terminbereiche werden nur neu erzeugt, wenn sich ihre Daten oder ihr Zustand ändern; Handler laufen über `useLatest`. (2) Vorschau beim Ziehen ohne neues Layout (`preview.ts`): Nachbarn und Teilstücke an ihrer neuen Lage mit der bisherigen Zeichnung aus der Layout-Schicht, zugeschnitten; das volle Layout folgt beim Loslassen aus dem neuen Planstand. (3) `layoutViews` berechnet Ansichten nur für Tage mit geändertem Layout. (4) Terminzeilen einmal je Planstand. (5) Lage des Rasters und Fenstergrösse beim Beginn des Ziehens gelesen. (6) Ziel und Zeitschild beim Ziehen aus einem eigenen Speicher (`feedbackStore.ts`): das Raster zeichnet nur bei Beginn, Ende und geänderter Vorschau der Nachbarn neu.

**Messung** (Nachbau der Messroutine A3, Einzeldatei, Edge, CPU ×2, p95 Hauptthread-Zeit je Bild im «Belastungstest», Median der Läufe): 50247d7 ohne Last 17,1 ms (2/5 ≤ 16,7), unter Vitest-Last 28,7 ms (0/10); e4e86be (mit I5) 12,8 ms bzw. 20,5 ms (1/5); wap/perf 7088ae7 ohne Last 7,1 ms (10/10 ≤ 12 ms), unter Vitest-Last 11,6 ms (10/10 ≤ 16,7). Verlauf je Merge: `.qa/perf/verlauf.md` (Haupt-Checkout).

**Offen, bekannte Mängel.** Während des Ziehens zeigt ein angepasster Nachbar seine bisherige Zeichnung, zugeschnitten auf die neue Fläche (Umbrüche erst nach dem Loslassen neu).

- [x] 6 Neue Tests eingefroren per lock-update mit Grund «PERF» (4 Dateien, 61e0588); Testpfade additiv registriert (867a88d, nach Merge cad5824).
- [x] 7 Umsetzung nach Schnellspur AE-005/AE-006 (Tests und Code zusammen, keine Rot-Phase).
