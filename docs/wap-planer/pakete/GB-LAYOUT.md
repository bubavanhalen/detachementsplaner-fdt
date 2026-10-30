# GB-LAYOUT – Nachträge Layout aus Gate B (Punkte 17 a, 18 a)

- Etappe: 1 (Gate B, Nachtrag)
- Anforderungen: (keine eigenen; die Tests tragen IDs eingefrorener Pakete: R-4.6-12, R-4.6-15, R-4.6-59, R-14.3-01)
- Zweig `wap/gb-layout` ab `wap-codex` edd59b6, Worktree `C:\Users\phili\source\repos\wap-wt\gb-layout`.
- Grundlage: Gate B, Antwort Auftraggeber 28.10.2026 «All as recommended» (Vorlage lokal `.qa/gate-b/gate-b-vorlage-entwurf.md`, Punkte 17 a, 18 a, 3 a/4 a); VQA-2-04, VQA-3-02, VQA-3-03.

| Punkt | Stand | Umsetzung |
| --- | --- | --- |
| 17 a flacher Marker endet auf der Zeit | ja | `flatSpan`: von at − Dauer bis at, am Anfang des Zeitbereichs ab V0. Bildschirm und PDF aus derselben Layout-Schicht. Katalog-Notiz R-4.6-15. Gesperrter Test `tests/wap/unit/h-layout/marker-flach.test.ts` nachgeführt (GB-LAYOUT-01). |
| 18 a Markerfeld weicht Blöcken aus | ja | `placeField`: zuerst eine Lage ohne Blockfläche – unter der Linie, mittig auf der Linie, darüber; sonst wie bisher. Blockflächen des Tages aus `layoutEntries`. Katalog-Notiz R-4.6-12. |
| 3 a/4 a Rückfall-Listen | gezählt | Echte Wochen nach 17/18: 18 (KVK 8, Wo1 3, Wo2 5, Wo3 2), dieselben Stellen wie vorher; KVK-Fixture 4 (Test unverändert grün). Liste unverändert. |
| Golden | unverändert | Alle vier PDF-Goldens bitgleich (keine flachen Marker bzw. Markerfelder an Blöcken in den Golden-Plänen). |

Test `tests/wap/unit/gb-layout/marker.test.ts` vor der Änderung 5 von 8 rot (die drei Gegenproben grün), eingefroren (Grund «GB-LAYOUT»). Vorher/Nachher-Ausschnitte der 16 geänderten Marker der echten Wochen lokal `.qa/gb-layout/vorher-nachher.md`.

- [x] 1 Worktree angelegt, `npm ci`
- [x] 6 Neue Tests eingefroren per lock-update mit Grund «GB-LAYOUT»; Testpfade additiv registriert
- [x] 7 Umsetzung, je Punkt Test vorher rot (Beleg lokal `.qa/gb-layout/rot.txt`)
