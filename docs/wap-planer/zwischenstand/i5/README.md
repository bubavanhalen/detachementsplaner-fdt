# Zwischenstand I5 – Probierliste «Stand, Prüfregeln, PDF, Schutz vor Datenverlust»

HTML-Datei: [wap-planer-zwischenstand-i5.html](C:/Users/phili/source/repos/detachementsplaner-fdt/.qa/i5/wap-planer-zwischenstand-i5.html) (Einzeldatei der Suite, datenfrei). Nach dem Öffnen in der Navigation «WAP-Planer» wählen (Adresse endet auf `#/wap`).

Für die Probe höchstens **15 Minuten** einplanen; sie ist kein Abnahmebeleg. Alles aus I2 bis I4 gilt weiter. Nur fiktive oder pseudonymisierte Daten verwenden; Plan-Dateien und PDFs sind lokale, private Ausgaben.

1. **Erststart (1 Min):** Drei Karten «Neuer Plan aus Vorlage» (N), «Plan-Datei öffnen» (O), «Excel-WAP importieren» (I); Tab wechselt, Enter oder die Taste wählt. Einen Plan aus der Vorlage anlegen (Startdatum 28.09.2026) oder die eigene Mappe importieren.
2. **Leere Woche (½ Min):** Unten links steht der nächste Schritt («Einträge ins Raster ziehen …»; ohne Spaltensatz «Spaltensatz für … wählen …», der Knopf wählt die Tage und öffnet das Seitenfeld).
3. **Befunde (3 Min):** In der Werkzeugleiste zählt «Befunde» Fehler, Warnungen, Hinweise (Kreis «!», Raute, Kreis «i»). Am Montag elf Beso erfassen: Der elfte hat keine Nummer, der Zähler zeigt sofort P17. Einen Spaltensatz eines Tages wechseln: Einträge in fehlenden Spalten ergeben P1 (rote Marke am Eintrag, nur am Bildschirm). Einen Tag «ausgeblendet» stellen: P16. Zu lange Titel ergeben P8. Klick auf den Zähler oder **Ctrl+.** öffnet die Befundliste («Wo n | Ganzer Plan»), «Zur Stelle» wechselt die Woche und wählt den Eintrag, **F8 / Shift+F8** springen von überall. «Quittieren …» mit Grund: der Befund verschwindet aus dem Zähler und bleibt unter «Quittiert»; Ctrl+Z oder «Quittierung aufheben» holt ihn zurück.
4. **PDF-Export (2 Min):** «PDF …»: Umfang (Woche / ganzer Plan), Fassung (Arbeitsfassung / frühere Stände), Optionen «Status rot darstellen», «A3», «Änderungen markieren». Darunter die Befunde der betroffenen Woche; bei Fehlern ist «Abbrechen» vorgewählt und der Knopf heisst «Trotzdem exportieren». «Vorschau» zeigt die Seite wie im PDF. Der Schnellknopf «PDF dieser Woche» (Ctrl+P) bleibt vorerst und nennt offene Fehler in der Meldung (Test-Einwand TE-I5-01).
5. **Neuen Stand setzen (2 Min):** «Neuen Stand setzen …»: Datum (heute), Version (+1), Liste der Folgen (Nummern fixiert, gestrichene Einträge entfernt, «Nr … neu vergeben», Wiederherstellungspunkt). «Stand setzen» zeigt den modalen Fortschritt «Stand wird gesetzt …» (PDF Woche 1 von 4 …); bis zum Speichern wirkt «Abbrechen» und schreibt nichts, die Bearbeitung ist gesperrt. Danach zeigt die Werkzeugleiste «Stand dd.mm.yyyy · Vn»; Ctrl+Z nimmt den Stand zurück. Im PDF-Export ist der Stand als Fassung wählbar und kommt unverändert (A4, Status rot; A3 und Status gesperrt).
6. **Layout-Ergänzungen (2 Min):** Im Seitenfeld eines Blocks «Gemeinsame Leitung (zweite Kategorie)» wählen: diagonal geteilt am Bildschirm und im PDF. «Offenes Ende»: unterer Rand gewellt. Marker «als flacher Block». In den Plan-Einstellungen ein Unterschriftsbild wählen und einschalten: es erscheint im Unterschriftblock (Vorgabe aus). PDF mit «A3» erzeugen: gleiche Anordnung, grösser.
7. **Schutz vor Datenverlust – Beschrieb 5.6 Punkt für Punkt (3 Min):**
   1. *Sofort gespeichert:* Nach jeder Änderung «Gespeichert hh:mm» und «letzte Datei-Sicherung noch nie / heute / vor n Tagen» in der Kopfzeile.
   2. *Wiederherstellungspunkte:* «Wiederherstellungspunkte …»: Zeitpunkt, Grund («täglich», «vor Stand V2», «vor Import», …), Umfang; «Wiederherstellen» stellt den Zustand her und ist selbst rückgängig machbar (Punkt «vor Wiederherstellung»). Mindestens 30 Punkte bleiben.
   3. *Erinnerung beim Schliessen:* Sind Änderungen seit mehr als einem Arbeitstag nicht als Plan-Datei gesichert, fragt der Browser beim Schliessen nach; die Kopfzeile färbt «letzte Datei-Sicherung» und «Plan-Datei sichern» wird Primärknopf.
   4. *Speicherwarnung:* Ist der Speicher nicht dauerhaft, steht oben «▲ Speicher nicht dauerhaft» (schliessbar für die Sitzung, «Mehr erfahren»); ab 80 % Belegung «▲ Speicher fast voll» mit «Speicher verwalten …».
   5. *Nie still überschreiben:* Eine Plan-Datei desselben Plans erneut öffnen: Dialog «Lokalen Stand behalten», «Durch Datei ersetzen» (vorher Wiederherstellungspunkt, rückgängig machbar), «Als Kopie öffnen».
   6. *Rückgängig:* mindestens 200 Schritte, auch nach Neuladen (F5, dann Ctrl+Z).
   7. *Neuere Version:* Eine Plan-Datei mit höherer Formatversion wird mit Hinweis abgelehnt; Datei und Plan bleiben unverändert.
8. **Tastatur (½ Min):** «?» zeigt die Kürzel; alle neuen Befehle sind mit Tab und Enter erreichbar, Fokus sichtbar.

## Noch nicht

- «PDF dieser Woche» und Ctrl+P exportieren noch direkt, ohne Befundliste davor (eingefrorene I2/I3-Abläufe erwarten das; TE-I5-01). Der Weg mit Befunden ist «PDF …».
- A3 entsteht in der PDF-Ausgabe; die Layout-Funktion selbst meldet für A3 noch den Stub-Fehler, den ein eingefrorener E1-02e-Test verlangt (TE-I5-02).
- «Änderungen markieren» markiert ganze Einträge (neu oder geändert seit dem letzten Stand) rot; feldgenaue Markierung, entfernte Textteile und geänderte Beso-Nummern folgen in Etappe 2 (R-10-32 bis R-10-35).
- Status-Darstellung bleibt hinter dem Schalter `statusRendering` bis zum Entscheid TE-I3-01.
- «Ältere löschen …» bei den Wiederherstellungspunkten und der Abschnitt «Gelöschte Pläne» fehlen noch.
- Die Kp-Vorlage setzt bei «Neuer Plan aus Vorlage» an allen Tagen «KVK Stufen»; im A4-PDF passen die Köpfe dann nicht, deshalb meldet ein neuer Plan sieben P8 «zu viele Spalten» je Woche.
