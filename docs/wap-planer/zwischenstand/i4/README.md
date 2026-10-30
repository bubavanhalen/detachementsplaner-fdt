# Zwischenstand I4 – Probierliste «Excel-Import Kp und Listenansicht»

HTML-Datei: [wap-planer-zwischenstand-i4.html](C:/Users/phili/source/repos/detachementsplaner-fdt/.qa/i4/wap-planer-zwischenstand-i4.html) (Einzeldatei der Suite, datenfrei). Nach dem Öffnen in der Navigation «WAP-Planer» wählen (Adresse endet auf `#/wap`).

Für die Probe höchstens **15 Minuten** einplanen; sie ist kein Abnahmebeleg. Die Excel-Datei wird nur auf diesem Gerät gelesen und nie verändert; nichts wird übertragen.

1. **Eigene Mappe importieren (2 Min):** «Excel-WAP importieren» (auch im Erststart) und die eigene Kp-Mappe wählen. Ein Fortschrittsfenster zeigt Lesen, Zuordnen, PDF des ersten Stands und Speichern; «Abbrechen» wirkt bis zum Speichern. Es entsteht ein neuer Plan mit allen Wochen, Spaltensätzen je Tag und dem Stand-Datum der Datei.
2. **Importbericht durchgehen (4 Min):** Der Bericht öffnet sich danach von selbst, später über «Importbericht». Oben die Bilanz je Blatt (gelesen = zugeordnet + nicht zugeordnet). Darunter die Meldungen nach Art, z.B. «Verdeckte Formen (nicht übernommen)», «Kästchen mehr als 15 Min neben dem Termintext» oder «Kanten neben der 15-Min-Linie» (aufklappbar). «Zur Stelle» zeigt den Eintrag im Raster und wählt ihn.
3. **In der Liste nacharbeiten (5 Min):** «Liste» (Ctrl+L) blendet die Listenansicht unter dem Raster ein. Mit den Pfeilen eine Zelle wählen. Tippen ersetzt den Wert, F2 oder Enter bearbeitet; Enter übernimmt und geht eine Zeile tiefer, Tab nach rechts, Esc verwirft. Zeit, Titel, Ltg, Ort, Kategorie und Status sind änderbar, und das Raster folgt sofort. Ctrl+Z macht jede Änderung rückgängig. Spaltenköpfe sortieren (Klick oder Enter, zweimal = absteigend). «Filter» (Ctrl+F) sucht in allen Spalten, «Ganzer Plan» zeigt alle Wochen. «Spalten …» blendet «Teilaufgaben» ein. Ctrl+Enter bzw. «Im Raster zeigen» springt zum Eintrag.
4. **Export (1 Min):** «Export …» speichert die Liste als CSV im Format der Soll-Listen; interne Notizen sind nie enthalten.
5. **Rückgängig (1 Min):** Ctrl+Z (oder «Import rückgängig machen» in der Meldung) nimmt den ganzen Import in einem Schritt zurück, auch nach Neuladen; der Bericht wird dann ausgeblendet. Vor dem Import entsteht ein Wiederherstellungspunkt.
6. **PDF (1 Min):** «PDF dieser Woche» zeigt eine importierte Woche als PDF.

Plan-Dateien, Listen und PDFs aus der eigenen Mappe sind private lokale Ausgaben: nicht hochladen, nicht weitergeben.

## Noch nicht

- Spalten, Tag und Zeitfenster eines Beso mit mehreren Zeitfenstern in der Liste bearbeiten (im Raster möglich); Auswahl wandert noch nicht von selbst zwischen Raster und Liste.
- Import in einen bestehenden Plan (der Import legt immer einen neuen Plan an); Bat-Mappen (Etappe 3).
- Unterschriftblock und Wappen der Seitenleiste werden nicht übernommen (im Bericht genannt).
- Ganz verdeckte Formen ergeben nach Gate S A2 keinen Eintrag; Anhang A ist dazu noch nicht angepasst (Q-043).
- Rückfallregel (Kürzungen «…») in den importierten Wochen, vor allem Wo 2 mit sechs Planungsspalten: Sache der Layout-Schicht (E1-02l).
- Leistungstest im Leistungsharness (R-11-17) und Claude-Review/Härtung vor Gate B.
