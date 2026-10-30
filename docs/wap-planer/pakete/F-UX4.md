# F-UX4 – Paketzweig `wap/f-ux4` (Restpunkte der Schluss-Nacharbeit SA-34)

- Etappe: 1 (vor Gate B).
- Anforderungen:
- Hinweis: Die Tests tragen nur IDs bereits eingefrorener Pakete (R-8.2-11, R-8.2-20, R-8.2-21, R-8.2-27, R-8.2-28,
  R-8.2-41 Importbericht; R-6-15 Listenansicht); keine Neuzuordnung im Etappenplan.
- Bezug: `.qa/e1-ab/sa34-final.md` (lokal), Auftrag Koordinator 23.10.2026. UX-AB-F-03 (Listenspalten) und
  UX-AB-F-08 (Import-Dialog) bleiben Etappe-2-Kandidaten.
- Zweig ab `wap-codex` 291a396, Worktree `C:\Users\phili\source\repos\wap-wt\f-ux4`.

| Befund | Umsetzung |
| --- | --- |
| UX-AB-F-02 (mittel): widersprüchliche nächste Schritte bei Termin ohne Zeit mit Kästchen | «Kästchen ohne Termintext» nennt in diesem Fall die Ursache (Text ohne Zeit, als ganztägige Bemerkung übernommen) und denselben Weg wie «Nummerierte Termine ohne Zeit»: «Keine Aktion nötig, wenn der Termin ganztägig gilt; gilt er zur Zeit des Kästchens, den Text der Bemerkung als Titel des Beso übernehmen und die Bemerkung löschen.» Kein Rat mehr zum Erfassen eines vorhandenen Textes. Ohne jeden Termintext bleibt «Termintext des Beso erfassen.». |
| UX-AB-F-06 (niedrig): Rapport in Rap- und Planungsspalte wird ohne Hinweis zu zwei Objekten | Weiterhin zwei Rapporte (keine Zusammenführung, Gate-B-Entscheid 12 offen). Neu: Meldung «Rapporte in Rap- und Planungsspalte» mit Sprung zum Rapport in der Planungsspalte: Ursache «… mit verschiedener Zeit; übernommen als zwei Rapporte», nächster Schritt «Prüfen, ob es derselbe Rapport ist; dann einen löschen und beim anderen in der Liste die Spalten «Rap, …» wählen. Sonst keine Aktion nötig.» |
| UX-AB-F-07 (niedrig): Spalten-Zelle der Liste schreibgeschützt | Auswahlzelle wie Kategorie und Status (Liste mit Tippsuche): Block «alle» und jede zusammenhängende Spanne der Planungsspalten des Tages; Rapport «Rap», «Rap, ‹Spanne›» (auch in Spalten) und «‹Spanne›» (nur in Spalten). Ein abweichender aktueller Wert (getrennte Teilblöcke, Nebenspalte) bleibt als Wahl erhalten. Marker bleiben «alle» fest (schreibgeschützt, Hinweis). Jede Wahl ist ein Befehl (Undo). |
| UX-AB-F-10 (niedrig): Kantengruppen zeigen nur «Zur Stelle 1 … n» | Je Stelle «Zur Stelle n: «Titel» 0805-0905 · Beginn 0805, Ende 0905», nach Beginn geordnet. Die Kante ergibt sich aus der übernommenen Zeit (auf 5 Min gerundet und damit neben der Linie); lag sie nur 2 Min daneben und liegt gerundet wieder auf der Linie: «Kante auf die Linie gerundet». Kein neues Feld im gespeicherten Bericht. |

Tests (eingefroren, Grund «F-UX4 Restpunkte SA-34»): `tests/wap/unit/f-ux4/schluss.test.ts` (10; 8 rot gegen
291a396, 2 Gegenproben grün).

Gezielte Läufe: Unit 2790 grün; E2E edge Importbericht und Liste (24) grün. Referenztests lokal: `nacharbeit.ref.ts`
R-14.1-02 scheitert schon auf 291a396 (KVK Mo Rapport, Wo1 Mo Marker), `importdauer.ref.ts` ohne Chromium 1243 auf
diesem Rechner; sonst grün.
