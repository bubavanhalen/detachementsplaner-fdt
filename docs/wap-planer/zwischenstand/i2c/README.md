# Zwischenstand I2c – Probierliste «Tastatur, Mehrfachauswahl, Feinschliff»

HTML-Datei: [wap-planer-zwischenstand-i2c.html](C:/Users/phili/source/repos/detachementsplaner-fdt/.qa/i2c/wap-planer-zwischenstand-i2c.html)

Für die Probe höchstens **15 Minuten** einplanen. Sie prüft I2b Runde B (B1–B8) und ist kein Abnahmebeleg. Alles aus I2b Runde A gilt weiter (Klick wählt, Direktbearbeitung, flüssiges Ziehen, Nachbarblöcke «c»).

Die Standardauswahl «Realistisch» enthält pseudonymisierte KVK-Daten und fiktive FDT-Wochen (wie I2b). «?» zeigt jederzeit alle Tastenkürzel.

1. **Nur Tastatur (3 Min):** Datei öffnen; der Fokus liegt im Raster. Alt+Bild↓ wechselt zur «Wo 1» (die Wochen stehen als Tabs oben). Der blaue Rahmen ist der Zellzeiger. Pfeile bewegen ihn, Bild↑/↓ springt eine Stunde, Ctrl+→ zum nächsten Tag. Shift+↓ dreimal und Enter: Ein Block über den Bereich entsteht; Titel tippen, Enter.
2. **Block per Tastatur ändern (2 Min):** Am gewählten Block verschieben Pfeile um 15 Minuten bzw. eine Spalte, Bild↓ um eine Stunde. Shift+↓ verlängert ihn. Ctrl+D dupliziert anschliessend. Entf löscht, und die Meldung bietet «Rückgängig». Esc führt zurück zum Zellzeiger.
3. **Direktbefehle (2 Min):** Am Block öffnen Z die Zeit, T den Tag und S die Spalten. Enter übernimmt; Zeiten dürfen auch «9», «9:30» oder «09.45» lauten. Im Feld «Spalte» ist ein Bereich bis zu einer zweiten Spalte wählbar.
4. **Mehrfachauswahl (2 Min):** Mit gedrückter Shift-Taste auf leerer Fläche einen Rahmen ziehen; Ctrl-Klick und Shift-Klick ergänzen. Ctrl+A wählt den Tag, ein zweites Ctrl+A die Woche. Die Auswahl gemeinsam ziehen oder mit Pfeilen verschieben. «Kategorie» in der Werkzeugleiste ändern. Jede Aktion ist ein einziger Rückgängig-Schritt.
5. **Kopieren und Einfügen (2 Min):** Einträge wählen und Ctrl+C drücken. Mit Alt+Bild↓ zur nächsten Woche wechseln, Ctrl+G öffnet «Gehe zu». «Di 1300» eingeben, Enter, dann Ctrl+V. Die relative Lage bleibt. Ctrl+X und Ctrl+V verschieben. A öffnet «Auch an anderen Tagen»: Ziffern 1–7 kreuzen Tage an, Enter übernimmt.
6. **Rap- und Beso-Spalte (1 Min):** Ein Doppelklick in die Spalte «Rap» erfasst einen Rapport (Kürzel tippen). In der Spalte «Beso» entsteht ein Beso mit offenem Termintext. Alt+Ziehen auf einem Block erzeugt einen parallelen Block.
7. **Datei und PDF (2 Min):** Mit Ctrl+S sichern; der Name enthält Planname, Datum und Uhrzeit, und die Kopfleiste zeigt «letzte Datei-Sicherung heute». Danach einen Titel ändern und die eben gesicherte Datei mit Ctrl+O öffnen. Wählbar sind «Lokalen Stand behalten», «Durch Datei ersetzen» (mit Rückgängig) und «Als Kopie öffnen». Ctrl+P erstellt das PDF der Woche (Name nach Konvention).
8. **Neuer Plan (1 Min):** «Neuer Plan aus Vorlage», ohne Namen «Anlegen»: Eine eigene Meldung erscheint. Als Startdatum 30.09.2026 eingeben: Der Hinweis bietet den Montag 28.09.2026 an.

Nur fiktive oder pseudonymisierte Daten verwenden. Plan-Dateien und PDFs sind lokale, private Ausgaben: nicht hochladen.

## Noch nicht

- Seitenfeld und Kontextmenü (Rechtsklick, Shift+F10); Z/T/S wirken nur auf Blöcke, die Leitungskategorie nur über die Werkzeugleiste.
- Querbalken, Marker und ganztägige Bemerkungen per Tastatur erfassen (N, Q, M, G); Zellzeiger im Band und im Terminbereich.
- Mehrere Blöcke verschieben sich ohne Vorschau der übrigen gewählten Einträge (nur der gezogene zeigt sie).
- Einfügen in einen anderen Plan; die Zwischenablage gilt nur in diesem Tab.
- Erinnerung beim Verlassen innerhalb der Suite als eigener Dialog (beim Schliessen nur der Browserdialog).
- Pixelgenaue Übereinstimmung mit dem PDF sowie Claude-Review und Härtung vor Gate B.
