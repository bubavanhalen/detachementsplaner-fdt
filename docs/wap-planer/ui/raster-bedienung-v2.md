# Raster-Bedienung v2 (F-UX2, Schritt 0)

Stand 20.10.2026 · Grundlage: Rückmeldung Auftraggeber 19.10.2026 (N1–N5), Entscheid «Bildschirm: ja» (CR-H-U-02/-03), Beschrieb 4.4, 4.6, 5, 5.1, 5.2, 6, 11; UI-Richtlinie 4.1, 4.2, 5.1–5.5, 5.10, 13.3; ADR-004 Punkt 4. Ergänzt die UI-Richtlinie; wo sie abweicht, gilt diese Seite.

**1 Papier = PDF (P1).** Das Raster (Tage × Zeit), die Spaltenköpfe und der Terminbereich werden im Rahmen der PDF-Seite gelegt (`pageFrame`: Tagesbreiten, pt je Minute, Kopfhöhe) und nur mit **einem** Faktor *f* (px je pt) skaliert. 100 % = 0,8 px je Minute wie bisher (Kp ≈ 2,7 px/pt); Stufen 50–300 %; «Einpassen» = grösstes *f*, bei dem Breite **und** Höhe passen. Zoom und Einpassen ändern nur *f*, nie Umbrüche. Zeitachse und Tageszeile sind Bedienleisten fester Bildschirmgrösse (wie Marken).

**2 Trefferzonen (P4)** – in Bildschirm-px, unabhängig vom Zoom; Treffer werden aus der Geometrie berechnet, nicht aus der Stapelung der Elemente.

| Zone | Grösse | Wirkung | Zeiger |
| --- | --- | --- | --- |
| Körper | Fläche der Teilstücke (Aussparungen gehören nicht dazu) | wählen, verschieben | `grab` / beim Ziehen `grabbing` |
| obere/untere Kante | Band innen 8 px (Block ≥ 24 px), 4 px (12–23 px), sonst keine; am gewählten Eintrag (Griffe sichtbar) mind. ⅓ der Höhe | Beginn/Ende ändern; Doppelklick füllt auf | `ns-resize` |
| seitliche Kanten | 6 px innen, nur gewählter Block ≥ 24 px breit | Spaltenspanne | `ew-resize` |
| Marker | Linie (mind. ± 2 px), Beschriftungsfeld | Zeitpunkt verschieben | `row-resize` |
| leere Planungsfläche | Spalte unter dem Zeiger, schmale Spalten mit Mindest-Trefferbreite 16 px | Block aufziehen | `crosshair` |
| leere Rap-/Beso-Spalte | wie oben | aufziehen, Doppelklick erfasst | `cell` |

- **Vorrang bei Überlagerung:** Marker vor Kästchen und Blöcken; sonst der **kleinste** Eintrag, der den Punkt enthält (Beso-Kästchen vor dem Block darunter, Ausnahme vor dem breiten Block); bei gleicher Fläche der oberste. Die Auswahl hebt einen Eintrag nie über andere (kein Trefferraub durch z-Index).
- **Hover:** Der Eintrag, den ein Drücken treffen würde, trägt einen dünnen blauen Rahmen (1 px, #2d63b5, 60 %); in einer Kantenzone zusätzlich ein 3-px-Balken an der Kante. Gezeichnet ohne Neuzeichnen des Rasters.

**3 Ziehen, Grösse, Spalten.** Einrasten auf 15 Min (genaue Zeiten nur per Eingabe), Mindestdauer 15 Min. Spaltenziel = Spalte unter dem Zeiger mit Mindest-Trefferbreite 16 px (schmale Det-/Nebenspalte wird so in jeder Zoomstufe getroffen); ein Block über *n* Spalten wandert um die Spaltendifferenz unter dem Zeiger. Zeitschild und Geisterrahmen wie bisher; Esc bricht ab. **Variante c** (Nachbarn passen sich an) bleibt Vorgabe, Shift schiebt Folgeblöcke, Alt ohne Anpassung.

**4 Direktbearbeitung im Block (P2).** Kein sichtbares Eingabefeld. Tastatureingaben gehen in ein unsichtbares Eingabeelement je Feld (Titel, Zusatz, Ltg, Ort; Namen und Tab-Reihenfolge wie bisher); der Block zeigt live den Text aus der Layout-Schicht mit Schreibmarke (blinkend, 1 px) und Markierung (blau hinterlegt). Klick in den Text setzt die Marke, Ziehen markiert, Doppelklick wählt ein Wort. Ctrl+B fett/normal, Tab/Shift+Tab nächstes/voriges Feld, Enter übernimmt, Esc verwirft, Klick daneben übernimmt; IME/Umlaute, Ctrl+C/X/V (Text) wie im Eingabefeld. Ein Feld, dessen Text im Block keinen Platz hat (Text entfällt), zeigt seinen Wert in einer kleinen Feldanzeige an der Blockkante – sonst nur Feldname und Tasten. Eine Bearbeitung = ein Undo-Schritt.

**5 Doppelklick auf Kante (P5).** Doppelklick auf die obere (untere) Kantenzone eines Blocks verlängert ihn bis zum Ende des vorangehenden (Beginn des folgenden) Blocks, der mindestens eine seiner Spalten belegt, sonst bis zum Beginn des Rasters unter dem Band bzw. zum Ende des Anzeigebereichs; Nachbarn nach Variante c, ein Undo-Schritt. Tastatur: Ctrl+Shift+↑ / Ctrl+Shift+↓, Kontextmenü «Nach oben auffüllen» / «Nach unten auffüllen».

**6 Bündig (P3).** Spalten-, Tages-, Stunden- und Halbstundenlinien sowie Blockränder werden aus derselben Geometrie auf ganze Gerätepixel gerundet; eine Linie der Stärke *s* px liegt ab `round(x) − ⌊s/2⌋`, ein Blockrand beginnt bzw. endet genau bei `round(x)`. Strichstärken aus der Vorlage (pt × *f*, mindestens 1 px).

**7 Spaltenkopf-Menü (P6).** Rechtsklick, Menütaste oder Shift+F10 auf einem Spaltenkopf: «Spalte links einfügen» (Shift+Einfg), «Spalte rechts einfügen» (Einfg), «Umbenennen» (F2), «Spalte entfernen» (Entf). Wird der Spaltensatz an mehreren Tagen verwendet, fragt der Dialog «Nur dieser Tag / Alle Tage mit diesem Spaltensatz». Eine neue Spalte heisst «Neue Spalte» und öffnet sofort das Umbenennen. Entfernen löscht keine Einträge: sie tragen danach P1 (Beschrieb 5.2). Jede Änderung ein Undo-Schritt. Im Plan-Einstellungsdialog bleiben Hinzufügen und Entfernen im Spaltensatz; der Hinweis nennt P1.
