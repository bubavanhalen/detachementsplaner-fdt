# Paket GB-IMPORT – Gate-B-Entscheide 11 bis 15 (Import, Export, Anhang A)

- Etappe: 1 (Gate B)
- Anforderungen: (keine eigenen; die Tests tragen IDs eingefrorener Pakete, z.B. R-4.6-15, R-8.2-20, R-6-13, R-6-16)
- Worktree: `C:\Users\phili\source\repos\wap-wt\gb-import` · Zweig `wap/gb-import` ab `wap-codex` edd59b6
- Grundlage: Gate B Etappe 1 entschieden «All as recommended» (Auftraggeber 28.10.2026), Vorlage `.qa/gate-b/gate-b-vorlage-entwurf.md` (lokal), Entscheide 11 a, 12 a, 13 a, 14 b, 15 a; Auftrag GB-IMPORT des Koordinators (28.10.2026).

- [x] 1 Paket-Worktree angelegt und installiert (`git worktree add … -b wap/gb-import edd59b6`, `npm ci`)
- [x] 6 Eingefroren: `tests/wap/unit/gb-import/**` (lock-update --add, Testpfad «GB-IMPORT» additiv registriert); umgestellte F-FIX-Tests zu UX-AB-14/CR-5-04 per lock-update
- [x] 7 Umsetzung: Entscheide 11 a bis 15 a umgesetzt, alle Tests grün
- [ ] 9 Volle Schleuse (Orchestrator)
- [ ] 10 Prüfung: frischer `code-reviewer`

## Umsetzung

| Entscheid | Änderung | Beleg |
| --- | --- | --- |
| 11 a | Änderungsliste Anhang A vom 19.10.2026 in der lokalen Liste als «bestätigt Auftraggeber Gate B 28.10.2026» vermerkt | `reference/anhaenge/aenderungen-2026-10-19.md` (lokal) |
| 12 a | Anhang A Zeile 17 (KVK Mo Rapport) Spalten `Rap`; Zeile 16 trägt die Planungsspalte | Anhang lokal, reference-lock nachgeführt |
| 13 a | Anhang A Zeile 124 (Wo1 Mo, Linie ohne Beschriftung) Typ `Bericht` mit `Bericht: Linie ohne Beschriftung`. Die Vergleichshilfe sieht das vor: Zeilen vom Typ `Bericht` sind erwartete Berichtseinträge und nie Soll-Einheit (Q-043, `compare.ts`); der Import meldet die Linie (UX-AB-16) | Anhang lokal, reference-lock; normalisierung.md 5.3 |
| 14 b | Import (`sheet.ts`): Marker-Beschriftung mit Ortsklammer → Art frei mit der ganzen Beschriftung (Zeit und Klammer wie geschrieben), kein neues Feld; die Meldung aus UX-AB-14/CR-5-04 entfällt. Anhang A Zeilen 52, 72: Titel = ganze Beschriftung, Ort leer | `tests/wap/unit/gb-import/gate-b.test.ts` (rot → grün), F-FIX-Tests `bericht.test.ts`, `runde6.test.ts` umgestellt |
| 15 a | Export der Listenansicht (`csvValues`): Status `geändert` → `bestätigt`; Plan und Listenansicht behalten die Markierung. Der Vergleich liest den Export, er führt damit ebenfalls den Status | `tests/wap/unit/gb-import/gate-b.test.ts` (rot → grün); normalisierung.md 5.9 |

Rot-Beleg `.qa/gb-import/rot-14b-15a.txt` (lokal). Referenz: Quote gegen den neuen Anhang A 412/417 (98,8 %; vorher 411/418, 97,1 % bzw. 98,3 %), KVK Rapport 8/8, Wo1 Marker 11/11; Meldungen «unsicher zerlegt» 6 → 4. test:reference: Import- und Dauer-Tests grün, `abnahme/nacharbeit.ref.ts` rot bis zur neuen Nacharbeit (ux-critic).
