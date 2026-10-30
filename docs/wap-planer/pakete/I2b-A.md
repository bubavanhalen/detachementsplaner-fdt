# I2b Runde A «Handhabung» – Schnellspur nach AE-005

Grundlage: Rückmeldung des Auftraggebers zu I2 (13.10.2026), Entscheid Nachbarblöcke «c ist top!», ux-critic-Befunde B1, B2, H1–H3, H6, M1–M4, M9, N1. Zweig `wap/i2b`, Code-Commits `480f29b` und `fe6bcf2` (Vorauslaufprotokoll), Tests und Dokumente `f6e5b7d`.

| Punkt | Stand | Umsetzung |
| --- | --- | --- |
| A1 Auswahl und Fokus | ja | Klick wählt und fokussiert genau den Eintrag; Fokus per Tastatur wählt ebenfalls. F2, Entf und Tippen wirken auf ihn. Nach dem Löschen erscheint «‹Titel› gelöscht · Rückgängig» und der Fokus geht zum nächsten Eintrag bzw. zur Rasterzelle. Ein Klick auf die leere Fläche hebt die Auswahl auf. |
| A2 Direktbearbeitung | ja | Der Entwurf bleibt an seiner Stelle; das Titelfeld liegt im Block, darunter eine kleine Karte mit Zusatz, Ltg und Ort. Enter übernimmt, Esc verwirft, Tab geht weiter (nach Ort: übernehmen). Ein Klick ausserhalb übernimmt; ein ungültiger Wert wird verworfen und in der Statuszeile gemeldet. Tippen überschreibt den Titel. Ziehen übernimmt ein offenes Feld vorher. |
| A3 Flüssiges Ziehen | ja | Die Vorschau folgt dem Zeiger pixelgenau. Das eingerastete Ziel und die angepassten Nachbarn gleiten in 120 ms (ease-out). Am Zeiger steht das Zeitschild «Mo 05.10. · 0900-1000 · COBRA 10». Nach dem Loslassen steht der Block sofort am Ziel; gespeichert wird im Hintergrund, das Raster ist nie gesperrt. Esc bricht ab, gleitet zurück und wirkt unabhängig vom Fokus. Mit `prefers-reduced-motion` gibt es keine Animation. |
| A4 Autoscroll | ja | Innerhalb von 40 px vom Rand scrollt das Raster waagrecht und senkrecht, je näher, desto schneller. Verschieben über mehrere Tage ist möglich. |
| A5 Platz | ja | Kopf- und Werkzeugleiste: 44 + 40 px, das Raster beginnt bei 90 px (1366 × 768 und 1600 × 900). Nur das Raster scrollt; Tagesköpfe, Spaltenköpfe und Zeitachse bleiben fixiert. «Einpassen» (Taste 0) zeigt Mo–So und den ganzen Anzeigebereich. Volle Tage sind gleich breit, Spalten nach Gewicht (Beschrieb 4.4). Die Detailkarte erscheint direkt am Eintrag und bleibt im sichtbaren Bereich. |
| A6 Alle Typen | ja | Rapport: Zeit und Tag verschieben, Beginn und Ende ziehen (Höhe = Dauer, mindestens 30 Min). Beso-Kästchen: Zeitfenster mit Zeit und Spalte (Beso- bzw. Planungsspalte), Tag für den ganzen Beso; Nummern nach Beschrieb 5.3, die Statuszeile meldet «Nr 12 → 10». Marker: nur der Zeitpunkt. Querbalken: Tage verschieben, ersten und letzten Tag ziehen. Jeweils Einrasten und Undo. |
| A7 Nachbarblöcke c | ja | Nur Blöcke mit denselben Spalten; ein Block über alle Spalten nur, wenn er direkt angrenzt. Kante ohne Taste: Der angrenzende Nachbar folgt, mindestens 15 Min, sonst hält die Kante an. Shift: Folgende bzw. vorangehende Blöcke rücken nach. Verschieben und Erfassen: Überdecktes wird gekürzt oder ausgespart (Teilung in zwei Blöcke); bei breiteren Blöcken wird ausgespart (Teilstücke, Beschrieb 4.6). Alt: keine Anpassung. Die Vorschau zeigt die Nachbarn schon beim Ziehen; die ganze Geste ist ein Undo-Schritt. |
| A8 Spaltenkopf | ja | Doppelklick oder F2: direkt umbenennen (Enter, Esc, Tab). Wird der Satz an mehreren Tagen verwendet, fragt die App «Nur dieser Tag» (Kopie des Spaltensatzes) oder «Alle Tage mit diesem Spaltensatz». Die Spaltengrenze im Kopf rastet auf schmal, normal oder breit, mit Vorschau; Tastatur ←/→. Die Tagesbreite bleibt, Undo ist möglich. |

**Tests.** 30 Unit-Tests in `tests/wap/unit/i2b/`. 8 E2E-Abläufe (A1–A8, Maus und Tastatur) laufen im Entwicklungsserver und in der Einzeldatei, dazu ein Leistungstest mit Grenzwert. Registriert in `testpfade.json` («I2b-A»), eingefroren mit Grund «I2b-A». Belege (Merge-Schleuse im Zweig, nach `fe6bcf2`): `wap:gate:fast` grün (15 Schritte), `npm run wap:test` 1903/1903, `npm run wap:test:e2e` 84/84, Build und `check:release` grün.

**Messung A3** (Edge, CPU-Drosselung ×2 aus `perf/drosselung.json`, 60 Zeigerbewegungen, Hauptthread-Zeit je gezeichnetem Bild aus dem Browser-Trace): p95 6,5 ms im Plan «Realistisch» und 9,9 ms im «Belastungstest» (Messung vor der Integration: 7,5 bzw. 10,1 ms). Grenzwert 16,7 ms. Hinweis: Die Zeit vom Ereignis bis zum Bild (Messart der ux-critic-Skripte) liegt in I2 wie in I2b bei p95 ≈ 31 ms. Sie hängt an der Bildrate von 30 Hz des automatisierten Browsers, nicht an der Rechenzeit.

**Befund CS-I2-E2E-FLAKE-01.** Als Ursache wahrscheinlich: «Plan-Datei sichern» war während des Speicherns gesperrt (`disabled={busy}`). Ein Tastendruck zwischen Prüfung und Auslösen verpuffte deshalb still. Jetzt ist der Knopf nie durch Speichern gesperrt; die Sicherung reiht sich hinter das laufende Speichern ein und enthält den neuen Stand. Der Test `sichern.test.ts` war mit der alten Regel rot und ist jetzt grün.

**Datenschutz und Datenverlust (A3).** Die sofortige Anzeige vor dem Speichern hätte beim Neuladen mitten im Speichern einen angezeigten Schritt verlieren können: Der eingefrorene I2-Tastaturablauf war in der Merge-Schleuse einmal rot. Behoben mit einem Vorauslaufprotokoll in `usePlan.ts`. Ein angezeigter, noch nicht gespeicherter Befehl steht synchron im lokalen Speicher dieses Browsers. Nach dem Neuladen wird er nachgetragen, wenn der Plan noch dieselbe Revision hat; danach wird der Eintrag gelöscht. Nur dieses Gerät, keine Übertragung. Lässt sich das Protokoll nicht schreiben, zeigt die App wie in I2 erst nach dem Speichern an. Belege: `journal.test.ts`; der I2-Ablauf ist 30/30 grün (6 Wiederholungen).

**Abweichungen, Arbeitsannahmen.**
- Das Zeitschild verwendet den Bindestrich «0900-1000» (Beschrieb 11, eingefrorener I2-Test) statt «–».
- Die Code-Änderungen stehen in einem Commit, weil die Schleuse einen sauberen Arbeitsbaum verlangt.
- Das Tastaturformular («Neuer Block», «Block bearbeiten») passt Nachbarn nicht an.
- Auch beim Ziehen der Spaltenbreite fragt die App nach dem Geltungsbereich.
- `pakete/I2b.md` besteht nur, weil die unveränderte Schleuse die Checkliste aus dem Zweignamen ableitet. Die Tests tragen nur IDs eingefrorener Pakete; der Etappenplan ist unverändert.

**Folgt bzw. nicht enthalten:**
- Mehrfachauswahl, Kopieren und Einfügen
- Pfeiltasten zum Verschieben (Etappe 2)
- Grösse von Beso-Kästchen ändern (Kp: feste 30 Min)
- Rapport «auch in Spalten» im Raster
- Terminbereich im Editor
- Kürzungen der Zeitbox: keine
