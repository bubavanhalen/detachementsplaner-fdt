# F-IMPORT2 – Import nach den Entscheiden vom 19.10.2026 (Schlussrunde vor Gate B; AE-005/AE-006)

- Etappe: 1 (Schlussrunde vor Gate B)
- Anforderungen: R-11-17
- Zweig `wap/f-import2` ab `cd21877`, Worktree `C:\Users\phili\source\repos\wap-wt\f-import2`.
- Grundlage: Entscheide des Auftraggebers vom 19.10.2026, wörtlich «3: ja / 4: ja / 5: ja / 9: ja» (Q-042, Q-043, Q-044, Wochenziele; `PROGRESS.md` Freigabeprotokoll); Beschrieb 4.2, 8.2 Regeln 8 und 12, 11 (Leistung), 14 und 14.1; ADR-008. R-11-17 ist im Etappenplan von E1-08 auf F-IMPORT2 umgehängt (Änderungsnotiz «F-IMPORT2»); alle übrigen Tests tragen IDs eingefrorener Pakete (I3, I4, E1-02a).

Je Punkt zuerst ein Test (rot), dann die Änderung (grün). Belege lokal `.qa/f-import2/belege/rot-gruen.txt`.

| Punkt | Test (rot vorher) | Änderung |
| --- | --- | --- |
| 3 Q-043 ganz verdeckt | `tests/wap/reference/import/kp.ref.ts` «R-8.2-43 … verdeckt» (gegen den unveränderten Anhang: 0 statt 16 Zeilen); `tests/wap/unit/f-import2/anhang-compare.test.ts` (3 von 3 rot) | Anhang A lokal: 16 Zeilen → Typ `Bericht` mit `Bericht: verdeckt`; Vergleich zählt `Bericht`-Zeilen nicht als Einheit |
| 4 Q-042 teilweise verdeckt | `kp.ref.ts` «R-8.2-43 … teilweise verdeckt» (rot); `tests/wap/unit/f-import2/rapport-verdeckt.test.ts` (1 von 2 rot) | Anhang A lokal: 11 Zeilen mit `Bericht: teilweise verdeckt`, davon 5 mit sichtbarer Zeit; Import: gekürzter Rapport der Planungsspalte nur bei gleicher Zeit mit dem Rap-Rapport zusammengefasst |
| 5 Q-044 Teilaufgaben | `kp.ref.ts` «R-8.2-37 R-8.2-38» (rot) | Anhang A lokal Zeile 5: Titel und Ltg der ersten fetten Gruppe, `Teilaufgaben: 2`; Normalisierungsentscheide 5/6 eingeschränkt (`anhaenge/normalisierung.md`, Änderungsnotiz 19.10.2026) |
| Bemerkungen Wo2/Wo3 | `kp.ref.ts` «R-4.2-07» (rot: Wo2, Wo3 ohne Bemerkungen) | Anhang A lokal: 22 Zeilen `MehrtagBemerkung` (je 11) |
| Quote | `kp.ref.ts` «R-14.1-01» ohne Abzug im Nenner (rot: 91,7 %) | – |
| 9 Wochenziele | `tests/wap/unit/f-import2/wochenziele.test.ts` (4 von 6 rot); `kp.ref.ts` «R-4.2-04» | Import übernimmt nur sichtbare Zeilen (Breite, Höhe, deckende Form); Rest als «nicht sichtbar, nicht übernommen» mit Anzahl Zeilen und Zeichen (neue Berichtsart `notVisible`) |
| R-11-17 Importdauer | `tests/wap/reference/f-import2/importdauer.ref.ts` (Mutationsprobe Budget 1 ms rot) | – (Messung im Entwicklungsserver, gedrosselt ×2) |

**Ergebnisse** (lokal gemessen, nur Zahlen; Vergleichsskript wie `tests/wap/support/anhang-compare/compare.ts`):

- Quote gegen den angepassten Anhang A ohne Abzug im Nenner: KVK 116/119 (97,5 %), Wo1 106/112 (94,6 %), Wo2 117/118 (99,2 %), Wo3 67/69 (97,1 %), gesamt 406/418 (97,1 %); 0 überzählige Ist-Einheiten. Vorher (Kandidat, ohne Abzug) 379/412 (92,0 %).
- Anhang A: 50 Änderungen (16 verdeckt, 11 teilweise verdeckt, 1 Teilaufgaben, 22 durchgehende Bemerkungen); 434 Zeilen, 418 Soll-Einheiten (`anhaenge/zaehlung-a.md`).
- Wochenziele vorher/nachher: KVK 4/4, Wo1 13/4, Wo2 11/2, Wo3 4/4; Bericht «nicht sichtbar, nicht übernommen» in Wo1 und Wo2 (je 9 Zeilen).
- Importdauer (R-11-17): Median 6,0 s gedrosselt ×2 (Läufe 6,0 / 5,7 / 7,6 / 5,3 / 6,8 s), Budget 15 s.

**Bekannte Mängel / offen.** FI2-01 bzw. Q-IM2-02 (Anhang A Zeile 17, Einzelbestätigung). Wochenziele: Sichtbarkeit geschätzt (Q-IM2-01), Druckbereich nicht gelesen. Ein fremder Test (H-DATEN `personen-zip`, R-5.7-04) lief unter Volllast zweimal in die 5-s-Grenze (allein 0,95 s grün).

- [x] 6 Neue Tests eingefroren per lock-update mit Grund «F-IMPORT2» (4 Dateien, 9c831ce); Testpfade additiv registriert (4d17258); privacy-scan über alle geänderten Dateien ohne Befund.
- [x] 7 Umsetzung je Punkt mit Rot-Nachweis vor der Änderung (4d17258).

## Belege

| Schritt | Befehl / Commit | Auszug |
| --- | --- | --- |
| Rot Anhang | `npm run test:reference` gegen den unveränderten Kandidaten | 5 failed, 13 passed (18) |
| Grün Anhang | `npm run test:reference` gegen `anhang-a-kp.csv` | 18 passed (18) |
| Rot/Grün Einheit | `npx vitest run -c vitest.wap.config.ts tests/wap/unit/f-import2/` | vorher 3+4+1 rot, nachher 11 passed |
| R-11-17 | `npx vitest run -c vitest.wap-reference.config.ts tests/wap/reference/f-import2/importdauer.ref.ts` | 1 passed; Mutationsprobe Budget 1 ms rot |
| WAP-Suite | `npm run wap:test` | 205 Dateien, 2247 Tests grün (vor dem ersten Commit) |
