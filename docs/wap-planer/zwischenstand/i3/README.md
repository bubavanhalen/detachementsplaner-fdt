# Zwischenstand I3 – Probierliste «Eine KVK-Woche mit allen Eintragstypen»

HTML-Datei: [wap-planer-zwischenstand-i3.html](C:/Users/phili/source/repos/detachementsplaner-fdt/.qa/i3/wap-planer-zwischenstand-i3.html)

Für die Probe höchstens **15 Minuten** einplanen. Sie prüft I3 (C1–C4) und ist kein Abnahmebeleg. Alles aus I2, I2b und
I2c gilt weiter (Klick wählt, Direktbearbeitung, flüssiges Ziehen, Nachbarblöcke «c», Zellzeiger, Mehrfachauswahl,
Kopieren/Einfügen). «?» zeigt jederzeit alle Tastenkürzel, «Seitenfeld» blendet das Seitenfeld ein und aus.

Für die Probe einen eigenen Plan anlegen: «Neuer Plan aus Vorlage», fiktiver Name wie «Probe I3», Vorlage Kp, Startdatum
**28.09.2026**, vier Wochen. Die Woche «KVK» ist dann Mo 28.09.–So 04.10.2026.

1. **Plan einrichten (2 Min):** «Plan-Einstellungen …»: Einheit, Dienst, Beilage, Kommandant (fiktiv, z.B. «Hptm Muster»)
   eintragen. Unter «Personenliste» zwei fiktive Personen von Hand erfassen oder eine CSV-Datei mit der Kopfzeile
   `Grad;Name;Vorname;Funktion` einlesen (weitere Spalten werden nicht übernommen und nirgends gespeichert). Unter
   «Kürzelliste» für KR eine Bedeutung eintragen. Esc schliesst den Dialog.
2. **Tage (1 Min):** Auf den Tageskopf «Mo» klicken, mit Shift auf «Fr»: Im Seitenfeld «5 Tage» den Spaltensatz wählen.
   Sa auswählen und «kompakt» stellen. Ein Rückgängig nimmt die Zuweisung für alle Tage zurück.
3. **Blöcke (2 Min):** Einen Block ziehen, «AVOR Fahne» tippen, Enter. Mit **E** öffnet das Seitenfeld: Zusatz, Ort, Ltg
   (tippen zeigt Vorschläge aus Personen- und Funktionsliste; bei «Zfhr» erscheint der Kategorie-Vorschlag, übernommen
   nur per Knopf), Tn/Tenue «drucken», Status, Textrichtung. Im Titel «AVOR» markieren und **Ctrl+B** (oder «F»):
   nur ein Teil ist fett. Unter «Teilaufgaben» zwei Teilaufgaben anlegen und eine nach oben schieben.
4. **Rapport und Beso (2 Min):** In der Spalte «Rap» von 1300 bis 1400 ziehen, «KR» tippen. Einen Rapport mit unbekanntem
   Kürzel (z.B. «XY») erfassen: Das Seitenfeld schlägt «in Abkürzungsliste aufnehmen» vor. Anzeige «auch in Spalten»
   zeigt ihn zusätzlich als Block. Doppelklick in die Spalte «Beso» erfasst einen Beso; im Seitenfeld ein zweites
   Zeitfenster hinzufügen, «Nummer fixieren» und Terminzeile «Freitext» ausprobieren.
5. **Marker, Querbalken, Bemerkungen (2 Min):** Zellzeiger setzen, **Shift+F10** (oder «Neuer Eintrag …»): Marker (M) mit
   Art «ABV» – die Beschriftung kommt aus der Art. Querbalken: im Band über 0500 von Do bis So ziehen, Titel tippen.
   Ganztägige Bemerkung (G). Im Seitenfeld «Woche» (nichts gewählt, Esc) eine Bemerkung «gilt durchgehend» und eine nur
   für diese Woche ergänzen, Wochenziele (eine Zeile je Ziel) und Sonnenzeiten von Hand.
6. **Terminbereich (1 Min):** Unter dem Raster steht der Terminbereich. Klick auf eine Terminzeile wählt den Beso,
   Doppelklick bearbeitet den Termintext. Mit ↓ unter der letzten Zeile gelangt der Zellzeiger in den Terminbereich.
   Rechtsklick auf den Tageskopf → «Tag neu nummerieren …» zeigt die Vorschau alt → neu.
7. **Status (1 Min):** Einen Block mit **X** streichen (rot durchgestrichen), einen anderen im Seitenfeld auf «offen»
   setzen (Titel rot). Ort «offen» färbt nur das Wort rot.
8. **Wochen (1 Min):** «Wochenbefehle»: nach «Wo 1» eine Woche einfügen (Vorschau der Folgewochen, verschieben nur mit
   Häkchen), duplizieren, umbenennen, löschen und über «Gelöschte Wochen» wiederherstellen.
9. **PDF (1 Min):** «PDF dieser Woche» für die KVK-Woche: Kopf mit Einheit und Beilage, Seitenleiste mit Wochenzielen,
   Bemerkungen, Kürzel mit Bedeutung, Sonnenzeiten; Terminbereich; Status rot. Mit abgewähltem «Status rot darstellen»
   erscheint dasselbe PDF ohne Rot.
10. **Rückgängig (1 Min):** Neu laden, mehrmals «Rückgängig»: Jede Feldänderung ist ein eigener Schritt.

Nur fiktive oder pseudonymisierte Daten verwenden. Plan-Dateien und PDFs sind lokale, private Ausgaben: nicht hochladen.
Die Personenliste bleibt auf diesem Gerät; die gewählte Datei wird nur gelesen.

## Noch nicht

- Angaben für den Tagesbefehl je Tag (Tagesoffizier, TB-Nr): brauchen ein neues Feld im Datenformat, folgen mit den
  Tagesbefehlen (Etappe 4). Die interne Tagesnotiz ist vorhanden.
- Unterschrift als Bild: wird gespeichert und ist schaltbar, das PDF zeichnet sie erst mit E1-10.
- Verweis-Kästchen mehrtägiger Bemerkungen: Spalte wählbar, gezeichnet ab der Bat-Darstellung (Etappe 3).
- Beso-Zeitfenster in Planungsspalten nur über das Seitenfeld (Spalte je Zeitfenster), nicht per Alt+Ziehen.
- Vorschläge für Ltg/Tn nur im Seitenfeld, nicht in der kleinen Karte der Direktbearbeitung.
- «Neuen Stand setzen» hat noch keinen Dialog; «Tag neu nummerieren» wirkt ab einem Stand (z.B. aus einer Plan-Datei).
- Status-Darstellung im PDF bleibt bis zur Bereinigung des Test-Einwands TE-I3-01 hinter einem Schalter der Layout-Schicht
  (die App setzt ihn immer).
