# H-LAYOUT – Härtung Layout-Schicht, PDF und Vorlage (Schnellspur AE-005/AE-006)

- Etappe: 1 (Härtungsrunde)
- Anforderungen: R-10-47, R-10-48, R-10-49
- Zweig `wap/h-layout` ab `wap-codex` 59ffa1d, Worktree `C:\Users\phili\source\repos\wap-wt\h-layout`.
- Grundlage: Etappen-Audit `.qa/haertung/spec-auditor-1.md` (SA-H-01 blockierend, SA-H-14 hoch, SA-H-04 Analyse), Zusatzbefunde aus `.qa/haertung/visual-qa-1.md` (Auftrag Orchestrator 14.10.2026); Gate S A1; Beschrieb 4.4, 4.6, 10 (Rückfallregel, Schrift). Neuzuordnung von R-10-47 bis R-10-49 im Etappenplan (AE-006, Härtung H-LAYOUT). Weitere Tests tragen IDs eingefrorener Pakete (R-4.6-15, R-4.6-59, R-4.9-19, R-5.2-01, R-7-11, R-10-22, R-10-43, R-10-54, R-10-55).

| Punkt | Stand | Umsetzung |
| --- | --- | --- |
| SA-H-01 Teilaufgaben | ja | Blocktext: eigener Text, dann je Teilaufgabe Leerzeile, Titel fett, «Ltg (Ort)» im Format der Vorlage, zentriert ohne Einzug (Referenzblock lokal gemessen: alle Zeilen auf einer Mittelachse; Q-041). Rückfall nach R-10-48 (Leerzeilen, Tn/Tenue, Ort, Ltg der Teilaufgaben, Ltg/Ort/Zusatz des Blocks, Titel der Teilaufgaben, dann «…»), P8 «Teilaufgabe gekürzt/entfallen». Bildschirm (Raster, Wochenansicht) aus derselben Layout-Schicht; Spezifikation im Cache-Schlüssel. Terminzeile: Blöcke stehen nicht in den Terminen; Tagesbefehl-Lieferung gibt es noch nicht (Etappe 4). |
| SA-H-14 Vorlage | ja | Kp-Vorlage `newPlanDays` (Mo–Di «KVK Stufen», Mi–Fr «KVK Mi–Fr», Sa–So «Wochenende kompakt» kompakt, jede Woche), `applyNewPlanDays` in `usePlan.create` (Entscheid TE-HL-01); neuer Plan 0 Befunde, Beso 10–79 im Kästchen. Ursache der P8: «KVK Stufen» an sieben vollen Tagen. |
| VQA (a) Köpfe | teilweise | Im Kopfbereich, wenn alle überlaufenden Köpfe eines Tages Platz finden; sonst E1-02l R1. Frage Q-HL-01. |
| VQA (b) Marker | ja | Blocktext neben dem Markerfeld, wenn er dort besser passt. |
| VQA (c) Kürzel | ja | Kürzel nie gekürzt, Bedeutung rückt dahinter, P8 nennt das Kürzel (Entscheid TE-HL-02). |
| VQA (d) Träger | ja | Freie Lage nahe, dann im ganzen Tag; Blockfläche nur ohne freien Platz. |
| VQA (e) | ja / bestritten / H-DATEN | Titelzeile «Erhöhte Bereitschaft:»; B-Kp-90 in Toleranz; B-Kp-54 Textrichtung aus dem Import. |
| VQA (f) flacher Marker | ja | Block mit Dauer `Marker.flatBlockMinutes` (sonst 0,5 h), Beschriftung im Block, Hindernis für Felder anderer Marker (CR-TE-HL-03-01; Entscheid TE-HL-03). |
| SA-H-04 | Analyse | `.qa/haertung/rueckfaelle-echt.md` (vorher KVK 5, Wo1 6, Wo2 12, Wo3 3; nach Merge H-DATEN KVK 5, Wo1 6, Wo2 13, Wo3 3). |

Komponenten: `src/components/wap/i2/usePlan.ts` (Schleife durch `applyNewPlanDays` ersetzt). Gesperrte Tests nach Entscheid des test-reviewers korrigiert und per lock-update nachgeführt: `tests/wap-e2e/i3/support/ablauf.ts`, `tests/wap/pdf/page/nachtrag-rahmen.test.ts`, `tests/wap/pdf/i5/ergaenzungen.test.ts`, `tests/wap-e2e/i5/support/ablauf.ts`.

- [x] 1 Worktree angelegt, `npm ci`
- [x] 6 Neue Tests eingefroren per lock-update mit Grund «H-LAYOUT» (10 Dateien, 4fb3f2f; dazu kuerzel.test.ts und marker-flach.test.ts nach den Entscheiden); Testpfade additiv registriert (2ff372e)
- [x] 7 Umsetzung nach Schnellspur AE-005/AE-006 (Tests und Code zusammen, keine Rot-Phase)
