# F-UX5 – Paketzweig `wap/f-ux5` (Produktfehler aus F-ABDECKUNG2)

- Etappe: 1 (vor Gate B).
- Anforderungen:
- Hinweis: Die Tests tragen nur IDs bereits eingefrorener Pakete (R-4.6-35, R-4.6-36, R-5.7-04, R-4.2-04, R-4.2-06);
  keine Neuzuordnung im Etappenplan.
- Bezug: FINDINGS Abschnitt F-ABDECKUNG2, Auftrag Koordinator 26.10.2026.
- Zweig ab `wap-codex` bfeb621, Worktree `C:\Users\phili\source\repos\wap-wt\f-ux5` (npm ci).

| Befund | Umsetzung |
| --- | --- |
| FA2-04 (hoch): mehrzeilige Felder lehnen jeden Zeilenumbruch ab | `panel/fields.tsx` `TextField`: in mehrzeiligen Feldern gilt die Glyphen-Prüfung je Zeile; ein Zeichen ohne Glyphe in einer Zeile bleibt abgelehnt. |
| FA2-03 (hoch): Datum einer Frist wird still verworfen | `parseSpec` liefert das Datum der Frist (`deadlineDate`); neuer Befehl `setWindowTime` (`commands/beso.ts`): eine Frist gilt am Tag des Eintrags, also rückt ein Beso mit einem Zeitfenster auf den Frist-Tag (Tag und Zeit ein Undo-Schritt). Mit mehreren Zeitfenstern Ablehnung: «Die Frist bis 02.10. liegt an einem anderen Tag als der Beso (Mo 28.09.); ein Beso mit mehreren Zeitfenstern bleibt an seinem Tag.» – «Eine Frist am 28.09. eingeben oder das Zeitfenster als eigenen Beso anlegen.» (Seitenfeld am Feld, Liste als Meldung). |

Tests auf das Soll umgestellt (rot gegen bfeb621, Nachführung per lock-update mit Grund «F-UX5: FA2-nn behoben
(Koordinator 26.10.2026)» und Befund): `tests/wap/unit/f-abdeckung2/liste-zelle.test.ts` und `seitenfeld-eintrag.test.ts`
(FA2-03; 3 Tests, davon einer neu: Ablehnung bei mehreren Zeitfenstern), `seitenfeld-woche.test.ts` (FA2-04).

Gezielte Läufe: Unit 2914 grün; E2E edge Seitenfeld, Feldtasten und Liste (13) grün.
