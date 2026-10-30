# I2c – Paketzweig `wap/i2c` (I2b Runde B, Schnellspur AE-005)

- Etappe: 1 (I2b, Runde B «Tastatur, Mehrfachauswahl, Feinschliff»).
- Anforderungen:
- Grundlage: Auftrag I2b-B (B1–B8) vom 13.10.2026; Beschrieb 5.1, 5.2, 5.6, 5.7, 6, 11; UI-Richtlinie 3, 5, 10, 11, 13, 17; ux-critic I2 (H4, H5, H7, M5–M8, M10, M11, N2–N5). Zweig ab `wap-codex` 552f462. Die Tests tragen nur IDs bereits eingefrorener Pakete (I2, E1-03); keine Neuzuordnung im Etappenplan.

| Punkt | Stand | Umsetzung |
| --- | --- | --- |
| B1 Zellzeiger, Tastatur | ja | Das Raster hat einen Tab-Stopp mit Zellzeiger (15 Min × Spalte). Pfeile, Bild↑/↓, Pos1/Ende und Ctrl+←/→ (Tag) bewegen ihn, Shift+Pfeile bilden einen Bereich. Enter oder Tippen erfasst einen Block, in der Rap- bzw. Beso-Spalte einen Rapport bzw. Beso. Am Eintrag verschieben Pfeile und Bild↑/↓ (Variante c), Shift+↑/↓ ändert die Dauer. Dazu Ctrl+D, Entf, F2/Enter, Esc, Tab/Shift+Tab und Ctrl+Pfeil. Namen wie «Mo 05.10. 0900 COBRA 10, leer» bzw. «…, Block ‹Titel› 0900-1000». |
| B2 Mehrfachauswahl | ja | Shift-Rahmen auf leerer Fläche, Ctrl- und Shift-Klick, Ctrl+Leertaste, Ctrl+A (Tag, zweimal Woche). Gemeinsam verschieben mit Maus und Tasten, Nachbarn nach Variante c; «Kategorie» und «Auswahl löschen». Je Aktion ein Undo-Schritt. |
| B3 Ablage | ja | Ctrl+C/X/V in einer internen Ablage (nie die des Betriebssystems), auch zwischen Wochen. Ziel: Zellzeiger, Mauszeiger oder gleicher Wochentag. Die relative Lage bleibt, Spalten werden nach Namen zugeordnet, sonst gleiche relative Lage mit Meldung «Befund P1». Ausschneiden verschiebt erst beim Einfügen. «Auch an anderen Tagen»: A, Ziffern 1–7, Mo–Fr, Enter. |
| B4 Wochen, Kürzel | ja | Wochen als Tabs, Alt+Bild↑/↓; dabei bleibt der Zellzeiger auf gleichem Wochentag, gleicher Zeit und Spalte. Ctrl+P PDF, Ctrl+O öffnen, Ctrl+S sichern, Ctrl+G «Gehe zu», «?» bzw. Knopf «Tastenkürzel». Die Suite-Shell überlässt Ctrl+G und «?» auf `/wap` dem WAP-Planer (S-3, S-4). |
| B5 Rückmeldungen, Fokus | ja | Meldung mit «… rückgängig machen» nach Löschen, Einfügen, Verschieben mehrerer, Kategorie, Kopien und Ersetzen; eine Meldung auch nach Datei sichern und PDF. Der Fokus geht nie auf body: Nach dem Löschen folgt der nächste Eintrag, nach Rückgängig der betroffene Eintrag (bei Bedarf in seiner Woche). Nach dem Öffnen, Anlegen und Ersetzen liegt er im Raster. Anzeige «Gespeichert hh:mm · letzte Datei-Sicherung …», ab 24 h mit ungesicherten Änderungen gewarnt. Erinnerung beim Schliessen nach mehr als einem Arbeitstag. |
| B6 Plan-Datei öffnen | ja | Liegt der Plan schon vor: «Lokalen Stand behalten», «Durch Datei ersetzen» (Wiederherstellungspunkt «vor Ersetzen», Rückgängig) und «Als Kopie öffnen». Der Dialog vergleicht beide Zeitpunkte. Anfangsfokus auf der sicheren Wahl; nie still. |
| B7 Eingaben | ja | Zeiten wie «900», «0900», «9:00», «9» oder «09.00»; bei Ungültigem `aria-invalid` und eine Meldung mit Feld, Ursache und Beispiel. Startdatum dd.mm.yyyy mit Montagshinweis und Knopf «Montag … übernehmen». Z/T/S öffnen Zeit, Tag und Spalten mit Fokus; Enter in Auswahlfeldern übernimmt. Spaltenbereich «Spalte» bis «bis Spalte». Wird der Beginn geändert, folgt das Ende mit gleicher Dauer. |
| B8 Kleinigkeiten | ja | Doppelklick in Rap-/Beso-Spalte: Rapport (Kürzel) bzw. Beso mit offenem Termintext; in Planungsspalten Hinweis «Zum Erfassen ziehen oder Enter». Alt+Ziehen auf einem Block erzeugt einen parallelen Block. Griffe 8 px über die ganze Kante, innen und durchsichtig. PDF `‹Beilage›_WAP_‹Dienst›_‹Kurzname›_Stand_‹Datum›.pdf` bzw. `_Entwurf`; ohne Dienst steht der Planname an seiner Stelle. Plan-Datei `…_‹Planname›_Plan_‹Datum›_‹hhmm›.wap.json`. Leerer Planname: eigene Meldung. |

**Tastatur-Aktionen (Ist/Soll, gemessen im E2E-Ablauf B1):** F3 Block erfassen 11/16 (SA-03), F5 auf Di 1100 verschieben 5/7 (SA-14), F6 andere Spalte 1/7, F7 Dauer 2/7 (SA-06), F8 Löschen 1/2 (SA-11), SA-13 drei Blöcke umfärben 8/10.

**Tests.** 35 Unit-Tests in `tests/wap/unit/i2c/` (Zeitparser, Einfügen mit Spaltenzuordnung, Mehrfachverschieben mit Variante c, Dateinamen, Zellzeiger). Dazu 10 E2E-Abläufe (B1–B8) im Entwicklungsserver und in der Einzeldatei. Registriert in `testpfade.json` («I2c», Freigabe «ja dauerhaft»), eingefroren mit Grund «I2b-B» (elf Dateien). Merge-Schleuse siehe Schlussmeldung.

**Abweichungen, Arbeitsannahmen.**
- Test-Einwand: Der eingefrorene I2-Ablauf verlangt das Auswahlfeld «Woche»; es bleibt neben den Tabs bestehen (B4: «statt Auswahlfeld»).
- Test-Einwand: Der eingefrorene I2-Ablauf verlangt den Dialog «Plan als Kopie öffnen». So heisst er, wenn lokal neuer; sonst «Plan-Datei öffnen» (UI-Richtlinie 10).
- Z, T, S, A und K sind am gewählten Block Befehle; Titel mit diesen Anfangsbuchstaben mit F2/Enter beginnen. Am Zellzeiger erzeugt jedes Zeichen einen Block (B1), N/B/R/Q/M/G gibt es nicht.
- Ctrl+Pfeil am Eintrag fokussiert den Nachbarn (UI-Richtlinie 13.3, SA-13); am Zellzeiger wechselt Ctrl+←/→ den Tag (B1).
- «Block verschieben» und «Grösse ändern» (öffneten dasselbe Formular wie «Block bearbeiten») entfallen.
- Die Code-Änderungen stehen im Wesentlichen in einem Commit, weil die Schleuse einen sauberen Arbeitsbaum verlangt.

**Folgt bzw. nicht enthalten:** Seitenfeld und Kontextmenü; P1-Marke im Raster (nur Meldung); Querbalken/Marker/Bemerkung per Tastatur; Vorschau der übrigen gewählten Einträge beim Ziehen; Einfügen in einen anderen Plan; Erinnerung beim Verlassen der Route als eigener Dialog. Kürzungen der Zeitbox: keine.

- [x] 6 I2c-Tests per lock-update mit Grund «I2b-B» eingefroren (elf Dateien).
- [x] 7 I2b-B (B1–B8) umgesetzt; Merge-Schleuse im Zweig grün, Merge nach wap-codex durch den Orchestrator.
