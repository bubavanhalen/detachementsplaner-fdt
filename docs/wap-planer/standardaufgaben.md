# WAP-Planer – Standardaufgaben für die UX-Prüfung

Stand 02.10.2026 · Etappe 0 (Prompt §5.1 Schritt 6) · erstellt durch `spec-analyst`; nachgeführt nach dem Gate-0-Entscheid vom 02.10.2026 (Q-009: Soll nur Tastatur SA-09, SA-16, SA-18 angehoben; K-1, UI-F-3, UI-F-8)

Grundlage: Beschrieb 5 (Kernfunktionen), 6 (Quick Wins), 14.6 (Tempo); Prompt §4.3 (`ux-critic`), §5.3 Schritt 4. Der `ux-critic` führt jede Aufgabe der laufenden und aller früheren Etappen im Browser aus (Playwright), einmal mit Maus und Tastatur und einmal «nur Tastatur», zählt die Aktionen und trägt sie unten in die Messreihe ein.

## Zählregeln

- **Eine Aktion** ist: ein Klick (einfach, doppelt oder Rechtsklick), ein Ziehen (Drücken – Bewegen – Loslassen, auch mit gehaltener Taste), ein Tastendruck oder eine Tastenkombination (Ctrl+Z = 1), eine zusammenhängende Texteingabe in ein Feld (unabhängig von der Zeichenzahl).
- **Keine Aktion** sind: Mausbewegung, Überfahren, Scrollen, Zoomen zum Lesen, Warten, Lesen.
- **Dateidialog des Betriebssystems** zählt pauschal 2 (Datei wählen, bestätigen); Speichern-Dialog 1.
- **Befehl per Tastatur**: direktes Kürzel = 1; über die Befehlspalette der Suite = 3 (öffnen, Suchtext, Enter).
- **Soll** ist eine Obergrenze. Die Begründung zählt jeden Schritt einzeln; Annahmen über die noch zu gestaltende Oberfläche (Tab-Reihenfolge, Kürzel) sind genannt und gelten als Vorgabe für die `ui-richtlinie.md`. Liegt der Ist-Wert über dem Soll, ist das ein Befund; über dem 1,5-Fachen ist er mindestens «hoch».
- **Daten**: nur pseudonymisierte oder fiktive Fixtures, nie Dateien aus `reference/`. Der `ux-critic` sieht Anhang A nicht.
- **Etappe** = ab wann die Aufgabe gemessen wird. Aufgaben mit Vorbedingungen aus späteren Etappen (z.B. Tastatur-Pfeile, Etappe 2) werden ab dann zusätzlich in der verbesserten Variante gemessen.

## Übersicht

| ID | Aufgabe | Etappe | Soll Maus/Tastatur | Soll nur Tastatur | Anforderungen |
| --- | --- | --- | ---: | ---: | --- |
| SA-01 | Neuen Plan aus Vorlage anlegen | 1 | 7 | 8 | R-5.2-01, R-5.7-01 |
| SA-02 | Woche mit Spaltensatz einrichten | 1 | 12 | 23 | R-5.2-07, R-5.2-10, R-4.3-02 |
| SA-03 | Block ziehen und betiteln | 1 | 9 | 16 | R-5.1-02, R-5.1-03, R-5.1-09, R-4.7-10 |
| SA-04 | «Auch an anderen Tagen» Di–Fr | 1 | 8 | 10 | R-6-01 |
| SA-05 | Beso mit drei Zeitfenstern | 1 | 23 | 25 | R-5.1-07, R-4.6-41, R-4.8-08 |
| SA-06 | Beso verschieben und Nummern prüfen | 1 | 1 | 7 | R-5.3-03, R-5.3-04, R-14.4-01 |
| SA-07 | Querbalken über eine Wochengrenze | 1 | 5 | 8 | R-4.6-04, R-4.6-10, R-5.1-24 |
| SA-08 | Import-Bericht durchgehen | 1 | 4 + n | 4 + 2n | R-5.7-01, R-8.2-20, R-8.2-21 |
| SA-09 | Stand setzen | 1 | 4 | 5 | R-5.5-03, R-5.3-06 |
| SA-10 | PDF einer Woche erzeugen | 1 | 3 | 4 | R-5.5-01, R-7-04, R-7-05 |
| SA-11 | Rückgängig nach Neuladen | 1 | 2 | 2 | R-5.6-16 |
| SA-12 | Rapport erfassen | 1 | 6 | 10 | R-5.1-06, R-4.6-16 |
| SA-13 | Mehrere Blöcke umfärben | 1 | 3 | 10 | R-5.1-20, R-5.1-21, R-6-27 |
| SA-14 | Eintrag auf einen Tag mit anderem Spaltensatz ziehen | 1 | 1 | 7 | R-5.1-16 bis R-5.1-18 |
| SA-15 | Ganztägige Bemerkung erfassen | 1 | 3 | 5 | R-4.6-29, R-4.6-30 |
| SA-16 | In der Listenansicht korrigieren | 1 | 4 | 9 | R-6-13 bis R-6-15 |
| SA-17 | Plan-Datei sichern und wieder öffnen | 1 | 5 | 7 | R-5.5-07, R-5.6-13 |
| SA-18 | Wiederherstellungspunkt zurückholen | 1 | 3 | 6 | R-5.6-09 |
| SA-19 | Eintrag als gestrichen markieren | 1 | 3 | 5 | R-4.6-32, R-10-29 |
| SA-20 | Befund P1 finden und beheben | 1 | 5 | 11 | R-7-02, R-7-03, R-7-10, R-5.2-09 |
| SA-21 | Block per Schnelleingabe | 2 | 3 | 3 | R-6-17 bis R-6-20 |
| SA-22 | Tagesablauf auf Mo–Fr anwenden | 2 | 4 | 8 | R-5.4-01 bis R-5.4-03 |
| SA-23 | Baustein ABV einsetzen | 2 | 2 | 5 | R-6-22 |
| SA-24 | Tempo-Aufgabe Kp Wo 1 (14.6) | 2 | 20 + 3e + 2z | 20 + 3e + 2z | R-14.6-01 |
| SA-25 | Schreibweise auf alle Fundstellen korrigieren | 2 | 3 | 5 | R-7-25, R-7-33 |
| SA-26 | Zwei Stände vergleichen | 2 | 3 | 5 | R-6-30, R-6-31 |
| SA-27 | «Was macht COBRA 10 diese Woche?» | 2 | 2 | 4 | R-6-29 |
| SA-28 | Zug-Auszug COBRA 10 als PDF | 2 | 3 | 5 | R-6-36 |
| SA-29 | Bat-Einträge übernehmen | 3 | 6 + a | 8 + a | R-8.3-01 bis R-8.3-10 |
| SA-30 | Neue Bat-Version nachführen | 3 | 4 + m | 6 + 2m | R-8.3-12, R-8.3-13 |
| SA-31 | Plan zur Weitergabe exportieren | 3 | 3 | 5 | R-8.1-04 |
| SA-32 | Tag an Tagesbefehle übergeben | 4 | 2 | 4 | R-9.2-02, R-9.2-03 |
| SA-33 | Spaltensatz-Vorschlag aus dem Detachementsplaner annehmen | 4 | 2 | 4 | R-9.1-04, R-14.11-02 |
| SA-34 | Nacharbeit nach Import (14.1) | 1 | 3 je Abweichung | 5 je Abweichung | R-14.1-02 |

n = Anzahl Berichtseinträge; e = Einträge der Woche ohne Tagesablauf-Einträge; z = zusätzliche Beso-Zeitfenster; a = abweichende Entscheide gegenüber der Vorauswahl; m = Meldungen der neuen Bat-Version.

## Aufgaben

### SA-01 Neuen Plan aus Vorlage anlegen (Etappe 1)

- **Ausgangszustand:** leerer lokaler Speicher; Erststart-Ansicht.
- **Ziel:** Kp-Plan mit Startdatum 28.09.2026 und 4 Wochen; KVK KW 40, Wo 1 KW 41, Wo 2 KW 42, Wo 3 KW 43 (R-5.2-01).
- **Soll Maus/Tastatur 7:** «Neuer Plan aus Vorlage» (1), Vorlage «Kp» wählen (1), Startdatum-Feld (1) + Eingabe (1), Anzahl Wochen (1) + Eingabe (1), «Anlegen» (1).
- **Soll nur Tastatur 8:** Enter auf der fokussierten ersten Erststart-Aktion (1), Vorlage mit ↓ (1), Tab (1), Datum (1), Tab (1), Anzahl (1), Tab (1), Enter (1). Annahme: Fokus liegt beim Erststart auf der ersten Aktion.

### SA-02 Woche mit Spaltensatz einrichten (Etappe 1)

- **Ausgangszustand:** Plan aus SA-01; Wo 1 ohne Spaltensatz; Spaltensätze «Woche mit FALCON/HAWK» und «Wochenende kompakt» (Kp, Beso) vorhanden.
- **Ziel:** Mo–Fr «Woche mit FALCON/HAWK»; Sa kompakt mit «Wochenende kompakt»; So ausgeblendet.
- **Soll Maus/Tastatur 12:** Tageskopf Mo (1), Shift-Klick Fr (1), Spaltensatz öffnen (1) und wählen (1); Tageskopf Sa (1), Spaltensatz öffnen und wählen (2), Darstellung «kompakt» öffnen und wählen (2); Tageskopf So (1), Darstellung «ausgeblendet» öffnen und wählen (2).
- **Soll nur Tastatur 23:** Mo–Fr: Tageskopf Mo fokussieren (≤ 2), Shift+→ ×4 (4), Spaltensatz-Menü (1), Wahl (≤ 2), Enter (1) = 10. Sa: fokussieren (≤ 2), Spaltensatz-Menü, Wahl, Enter (≤ 4), Darstellung-Menü, Wahl, Enter (3) = 9. So: fokussieren (1), Darstellung-Menü, Wahl, Enter (3) = 4. Annahme: Tagesköpfe sind per Tab und Pfeilen erreichbar.

### SA-03 Block ziehen und betiteln (Etappe 1)

- **Ausgangszustand:** Wo 1 Mo mit «Woche mit FALCON/HAWK», leer.
- **Ziel:** Block Mo 0800-1200 über COBRA 10–COBRA 20, Titel «Mö Sch», Ltg «Zfhr» (Kategorie Ltg Zfhr: Vorschlag per Aktion übernommen, R-4.7-10), Ort «Spl».
- **Soll Maus/Tastatur 9:** Ziehen 0800→1200 über zwei Spalten (1), Titel tippen (1, Fokus sofort, R-5.1-03), Tab bis Ltg (≤ 2), Ltg (1), Kategorie-Vorschlag übernehmen (1), Tab bis Ort (1), Ort (1), Enter (1). Annahme: Tab-Reihenfolge Titel → Zusatz → Ltg → Ort.
- **Soll nur Tastatur 16:** Zelle Mo 0800 COBRA 10 fokussieren (≤ 3), Befehl «Neuer Block» (1), Zeit «0800-1200» (1), Tab (1), Spalten (1), Tab (1), Titel (1), Tab bis Ltg (≤ 2), Ltg (1), Vorschlag übernehmen (1), Tab (1), Ort (1), Enter (1). Ab Etappe 2 zusätzlich über SA-21 (3).

### SA-04 «Auch an anderen Tagen» Di–Fr (Etappe 1)

- **Ausgangszustand:** Wo 1 mit Block «Tagwach/MoE» Mo 0600-0700 über alle Spalten; Di–Fr gleicher Spaltensatz, leer.
- **Ziel:** gleicher Block Di, Mi, Do, Fr (R-6-01); ein Undo-Schritt nimmt alle vier zurück.
- **Soll Maus/Tastatur 8:** Block wählen (1), Kontextmenü (1), «Auch an anderen Tagen» (1), Di, Mi, Do, Fr ankreuzen (4), «Übernehmen» (1).
- **Soll nur Tastatur 10:** Block fokussieren (≤ 2), Befehl (1), vier Tage (je Leertaste nach Pfeil: 4 + 2 Pfeile), Enter (1). Annahme: Kürzel für den Befehl.

### SA-05 Beso mit drei Zeitfenstern (Etappe 1)

- **Ausgangszustand:** Wo 2 Mo, Spaltensatz mit COBRA 10, COBRA 20, FALCON; keine Beso.
- **Ziel (fiktiv, nach dem Muster Beschrieb 4.6):** Beso «Vorrevisionen» mit 0900-1200 in COBRA 10 (Zusatz «Zug 1»), 1300-1600 in COBRA 20 («Zug 2»), 1600-1800 in FALCON («Zug 3»); Nummer 10; Terminzeile «10 Vorrevisionen: 0900-1200 Zug 1, 1300-1600 Zug 2, 1600-1800 Zug 3».
- **Soll Maus/Tastatur 23:** Doppelklick Beso-Spalte bei 0900 (1), Titel (1); Zeitfenster 1: Zeit (Tab 1 + Eingabe 1), Spalte (Tab 1 + Wahl 1), Zusatz (Tab 1 + Eingabe 1) = 6; Zeitfenster 2 und 3: «Zeitfenster hinzufügen» (1) + 6 = 7, zweimal 14; Enter (1).
- **Soll nur Tastatur 25:** wie oben, Beso-Befehl statt Doppelklick (Fokus auf Beso-Spalte ≤ 2, Befehl 1), «Zeitfenster hinzufügen» per Tastatur.
- **Hinweis:** höchste Soll-Zahl der Etappe 1; eine kompaktere Eingabe (z.B. Zeitfenster-Zeile «0900-1200 @COBRA 10 Zug 1») wäre eine Verbesserung und ist an Gate 0 als Vorschlag möglich, nicht Teil des Beschriebs.

### SA-06 Beso verschieben und Nummern prüfen (Etappe 1)

- **Ausgangszustand:** KVK Mo vor dem ersten Stand; Beso 10 (0800), 11 (1000), 12 (1400); Block mit Titel «Waffenplatzbegehung (12)».
- **Ziel:** Beso 12 auf 0700 verschoben; danach 10 = 0700, 11 = 0800, 12 = 1000; Terminbereich nach Nummer sortiert; Titelverweis zeigt «(10)» (R-5.3-12).
- **Soll Maus/Tastatur 1:** Ziehen des Kästchens auf 0700 (1). Prüfen ist Lesen (0).
- **Soll nur Tastatur 7:** Kästchen fokussieren (≤ 3), Seitenfeld Zeit (1), Eingabe (1), Enter (1), zurück (1). Pfeiltasten (Etappe 2) wären hier 28 Schritte und damit keine Alternative.

### SA-07 Querbalken über eine Wochengrenze (Etappe 1)

- **Ausgangszustand:** Wo 1 (05.10.–11.10.2026), keine Querbalken.
- **Ziel:** Querbalken «OLMA 08.10.–18.10.2026» über alle Spalten; erscheint Wo 1 Do–So und Wo 2 Mo–So mit vollem Titel (R-4.6-10).
- **Soll Maus/Tastatur 5:** Ziehen im Band von Do bis So (1), Titel (1), bis-Datum im Seitenfeld (Klick 1 + Eingabe 1), Enter (1). Ziehen im Band erzeugt einen Querbalken wie Ziehen im Raster einen Block (Gate-0-Entscheid 02.10.2026, Q-009 UI-F-8; R-5.1-24). Das Band ist die Stunde 0400–0500 (B-F-06, R-4.5-07).
- **Soll nur Tastatur 8:** Befehl «Neuer Querbalken» (1), Titel (1), Tab (1), von (1), Tab (1), bis (1), Enter (1), Rückkehr (1).

### SA-08 Import-Bericht durchgehen (Etappe 1)

- **Ausgangszustand:** Erststart; pseudonymisierte Kp-Fixture (Excel) mit n bekannten Berichtsfällen (z.B. zwei überlappende Kästchen, Beso in der Rap-Spalte, Termin ohne Zeit).
- **Ziel:** jeder Berichtseintrag einmal angesprungen, Stelle im Raster sichtbar und gewählt (R-8.2-21).
- **Soll Maus/Tastatur 4 + n:** «Excel-WAP importieren» (1), Dateidialog (2), Import bestätigen (1), je Berichtseintrag ein Klick (n). Annahme: der Bericht bleibt beim Sprung sichtbar (Seitenbereich), keine Rückkehr nötig.
- **Soll nur Tastatur 4 + 2n:** wie oben, je Eintrag ↓ und Enter.

### SA-09 Stand setzen (Etappe 1)

- **Ausgangszustand:** Plan ohne Stand, Beso-Nummern laufend; Uhr auf 17.09.2026.
- **Ziel:** Stand 17.09.2026, Version 1; Nummern fixiert (R-5.3-06); Wiederherstellungspunkt vorhanden (R-5.6-07).
- **Soll Maus/Tastatur 4:** «Neuen Stand setzen» (1), Datum prüfen, bei Abweichung Feld (1) und Eingabe (1), «Setzen» (1).
- **Soll nur Tastatur 5** (bisher 4; angehoben, Gate-0-Entscheid 02.10.2026, Q-009 UI-F-4; Bedienweg `ui-richtlinie.md` §17): Befehl über die Befehlspalette (3, kein eigenes Kürzel für «Neuen Stand setzen»), Datum nur bei Abweichung von heute (1), Enter (1). Mit dem Stand-Datum von heute (Vorgabe) sind es 4.

### SA-10 PDF einer Woche erzeugen (Etappe 1)

- **Ausgangszustand:** Wo 1 mit einem Befund der Stufe «Fehler» (P1).
- **Ziel:** PDF mit Dateiname nach Konvention (R-6-10) gespeichert, nach Anzeige des Befunds und Bestätigung (R-7-04, R-7-05).
- **Soll Maus/Tastatur 3:** «PDF Woche» (1), «Trotzdem exportieren» (1), Speichern-Dialog (1).
- **Soll nur Tastatur 4:** Kürzel (1), Tab zur Bestätigung (1), Enter (1), Speichern (1).

### SA-11 Rückgängig nach Neuladen (Etappe 1)

- **Ausgangszustand:** Block «Mö Sch» soeben gelöscht.
- **Ziel:** nach Neuladen der Seite ist der Block per Rückgängig wieder da (R-5.6-16).
- **Soll Maus/Tastatur 2:** Neuladen (F5, 1), Ctrl+Z (1).
- **Soll nur Tastatur 2:** gleich.

### SA-12 Rapport erfassen (Etappe 1)

- **Ausgangszustand:** Wo 1 Mo, Rap-Spalte leer.
- **Ziel:** Rapport «AR2» 1300-1400, Ort «Ukft», Kategorie Ltg Kp (Standard).
- **Soll Maus/Tastatur 6:** Doppelklick Rap-Spalte bei 1300 (1), Kürzel (1), Enter (1), unteren Rand auf 1400 ziehen (1), Ort im Seitenfeld (Klick 1 + Eingabe 1).
- **Soll nur Tastatur 10:** Rap-Spalte fokussieren (≤ 3), Befehl «Neuer Rapport» (1), Kürzel (1), Tab (1), bis-Zeit (1), Tab (1), Ort (1), Enter (1).

### SA-13 Mehrere Blöcke umfärben (Etappe 1)

- **Ausgangszustand:** Wo 1 Mo, drei Blöcke untereinander in COBRA 10, Kategorie Ltg Zfhr.
- **Ziel:** alle drei Kategorie «Extern»; ein Undo-Schritt.
- **Soll Maus/Tastatur 3:** Rahmen um die drei mit Shift+Ziehen (1; Ziehen mit gehaltener Taste = 1 Aktion; Q-009 K-1, R-5.1-20), Kategorie im Seitenfeld öffnen (1) und wählen (1).
- **Soll nur Tastatur 10:** ersten Block fokussieren (≤ 2), zweimal zum nächsten Eintrag und zur Auswahl hinzufügen (Tab + Ctrl+Leertaste, je 2 = 4), Seitenfeld Kategorie (1), Wahl (≤ 2), Enter (1). Annahme: Ctrl+Leertaste erweitert die Auswahl; Shift+Pfeile sind ab Etappe 2 für die Grösse belegt (R-6-24). Tab zum nächsten Eintrag gilt schon ab Etappe 1 (Q-009 UI-F-3, R-6-27).

### SA-14 Eintrag auf einen Tag mit anderem Spaltensatz ziehen (Etappe 1)

- **Ausgangszustand:** Wo 2 Mo (Sph Det 1–3) mit Block in «Sph Det 2»; Wo 2 Mi mit FALCON/HAWK.
- **Ziel:** Block am Mi in der Spalte an gleicher relativer Lage, Befund P1 (R-5.1-18).
- **Soll Maus/Tastatur 1:** Ziehen über die Tagesgrenze (1).
- **Soll nur Tastatur 7:** Block fokussieren (≤ 3), Seitenfeld Tag (1), Wahl (≤ 2), Enter (1).

### SA-15 Ganztägige Bemerkung erfassen (Etappe 1)

- **Ausgangszustand:** KVK Fr ohne Bemerkungen.
- **Ziel:** ganztägige Bemerkung «Retablierung» am Fr, im Terminbereich ohne Nummer (R-4.6-30).
- **Soll Maus/Tastatur 3:** Doppelklick in den Terminbereich des Tages (1), Text (1), Enter (1). Annahme: Doppelklick im Terminbereich erzeugt eine Bemerkung (Oberflächenentscheid des `ui-designer`).
- **Soll nur Tastatur 5:** Terminbereich des Tages fokussieren (≤ 2), Befehl (1), Text (1), Enter (1).

### SA-16 In der Listenansicht korrigieren (Etappe 1)

- **Ausgangszustand:** Wochenraster Wo 1; Block «Mö Sch» mit Ort «Spl».
- **Ziel:** Ort «Säntisalp»; Raster zeigt ihn sofort (R-6-15).
- **Soll Maus/Tastatur 4:** Umschalten auf Listenansicht (1), Doppelklick Zelle Ort (1), Eingabe (1), Enter (1).
- **Soll nur Tastatur 9** (bisher 8; angehoben, Gate-0-Entscheid 02.10.2026, Q-009 UI-F-4; Bedienweg `ui-richtlinie.md` §17): Ctrl+L Listenansicht (1), Ctrl+F Suche (1), Suchtext (1), Enter (1), zur Spalte Ort (→ ×3, nur wenn nach dem Titel gesucht wird; 0 bei Suche nach dem Ortswert), Eingabe (1), Enter (1). Bei Suche nach dem zu ändernden Wert («Spl») sind es 6.

### SA-17 Plan-Datei sichern und wieder öffnen (Etappe 1)

- **Ausgangszustand:** Plan mit Einträgen; zweites, leeres Browserprofil.
- **Ziel:** Plan im zweiten Profil identisch (R-5.5-07).
- **Soll Maus/Tastatur 5:** «Datei sichern» (1), Speichern-Dialog (1); im zweiten Profil «Plan-Datei öffnen» (1), Dateidialog (2).
- **Soll nur Tastatur 7:** Kürzel sichern (1), Speichern (1), Erststart-Aktion wählen (≤ 2), Enter (1), Dateidialog (2).

### SA-18 Wiederherstellungspunkt zurückholen (Etappe 1)

- **Ausgangszustand:** Plan mit mehreren Punkten; seit dem letzten Punkt versehentlich eine Woche geleert.
- **Ziel:** Zustand des gewählten Punkts wiederhergestellt; Wiederherstellung selbst rückgängig machbar (R-5.6-09).
- **Soll Maus/Tastatur 3:** Liste der Wiederherstellungspunkte öffnen (1), Punkt wählen (1), bestätigen (1).
- **Soll nur Tastatur 6** (bisher 5; angehoben, Gate-0-Entscheid 02.10.2026, Q-009 UI-F-4; Bedienweg `ui-richtlinie.md` §17): Befehl über die Befehlspalette (3, kein eigenes Kürzel), Punkt mit Pfeilen (≤ 2), Enter (1).

### SA-19 Eintrag als gestrichen markieren (Etappe 1)

- **Ausgangszustand:** Beso 21 Status bestätigt.
- **Ziel:** Status gestrichen; im PDF rot durchgestrichen (R-10-29); Nummer bleibt reserviert (R-5.3-09).
- **Soll Maus/Tastatur 3:** Kästchen wählen (1), Status im Seitenfeld öffnen (1) und «gestrichen» wählen (1).
- **Soll nur Tastatur 5:** Eintrag fokussieren (≤ 2), Status-Feld (1), Wahl (1), Enter (1).

### SA-20 Befund P1 finden und beheben (Etappe 1)

- **Ausgangszustand:** Spalte HAWK wurde aus dem Spaltensatz von Wo 1 Di entfernt; zwei Einträge mit P1.
- **Ziel:** beide Einträge in FALCON; Befundzähler 0.
- **Soll Maus/Tastatur 5:** Befundzähler (1), ersten Befund (1), Eintrag nach FALCON ziehen (1), zweiten Befund (1), ziehen (1).
- **Soll nur Tastatur 11:** Befundliste öffnen (1); je Befund ↓ und Enter (2), Seitenfeld Spalte (1), Wahl (1), Enter (1) = 5; zwei Befunde 10.

### SA-21 Block per Schnelleingabe (Etappe 2)

- **Ausgangszustand:** Wo 1 Mo, leer; Spalten COBRA 10–COBRA 20 markiert oder nicht.
- **Ziel:** wie SA-03 mit «0800-1200 Mö Sch @COBRA 10-COBRA 20 #Zfhr (Spl)» (R-6-17).
- **Soll Maus/Tastatur 3:** Schnelleingabe fokussieren (1), Zeile (1), Enter (1).
- **Soll nur Tastatur 3:** gleich (Kürzel für den Fokus).

### SA-22 Tagesablauf auf Mo–Fr anwenden (Etappe 2)

- **Ausgangszustand:** Wo 1 mit Spaltensatz, leer; Tagesablauf «Werktag» vorhanden.
- **Ziel:** Mo–Fr mit den Einträgen des Tagesablaufs über alle Planungsspalten (R-5.4-03).
- **Soll Maus/Tastatur 4:** Tageskopf Mo (1), Shift-Klick Fr (1), «Tagesablauf anwenden» (1), «Werktag» (1).
- **Soll nur Tastatur 8:** Mo fokussieren (≤ 2), Shift+→ ×4 (4), Befehl mit Wahl (≤ 2).

### SA-23 Baustein ABV einsetzen (Etappe 2)

- **Ausgangszustand:** Wo 1 Di ohne ABV.
- **Ziel:** Marker ABV 2200 über alle Planungsspalten.
- **Soll Maus/Tastatur 2:** Bausteinleiste öffnen (1), «ABV» auf Di 2200 ziehen (1).
- **Soll nur Tastatur 5:** Tag fokussieren (≤ 2), Baustein-Befehl (1), «ABV» wählen (1), Enter (1) mit Zeit aus dem Baustein.

### SA-24 Tempo-Aufgabe Kp Wo 1 (Beschrieb 14.6, Etappe 2)

- **Ausgangszustand:** Plan mit leerer Wo 1; Spaltensätze und Tagesablauf vorhanden (so verlangt 14.6); Vorlage zum Abschreiben: pseudonymisiertes Referenz-PDF der Wo 1 (für den `ux-critic`); für die Abnahme durch den Kp Kdt das Original.
- **Ziel:** Wo 1 inhaltlich gleich der Vorlage; PDF erzeugt.
- **Soll Zeit:** ≤ 0,5 × Excel-Ausgangszeit des Kp Kdt (R-14.6-01, R-15-07). Nur der Kp Kdt misst die Abnahmezeit.
- **Soll Aktionen 20 + 3e + 2z:** Spaltensätze und Tagesablauf zuweisen (SA-02 + SA-22 = 16, aufgerundet 20); je übriger Eintrag über Schnelleingabe 3 (SA-21); je zusätzliches Beso-Zeitfenster 2 (Zeit und Spalte). e und z zählt der `ux-critic` aus der Vorlage vor der Messung.
- **Messanleitung (Excel und Tool gleich):** Start = leere Woche ist geöffnet, Vorlage liegt daneben. Ende = PDF erzeugt und Sichtkontrolle abgeschlossen. Es zählt die ganze Zeit inklusive Korrekturen; nicht zählt das Einrichten von Spaltensätzen und Tagesabläufen, sofern diese vorher bestehen (gleich in Excel: Vorlage-Blatt mit Raster und Kopf vorhanden).

### SA-25 Schreibweise auf alle Fundstellen korrigieren (Etappe 2)

- **Ausgangszustand:** Wörterbuch «Tagwache» → «Tagwach»; drei Fundstellen, Befund P12.
- **Ziel:** alle drei korrigiert; ein Undo-Schritt (R-7-33).
- **Soll Maus/Tastatur 3:** Befundzähler (1), Befund P12 (1), «Auf alle Fundstellen anwenden» (1).
- **Soll nur Tastatur 5:** Befundliste (1), Wahl (≤ 2), Tab zur Aktion (1), Enter (1).

### SA-26 Zwei Stände vergleichen (Etappe 2)

- **Ausgangszustand:** zwei Stände mit je einer neuen, geänderten und gestrichenen Änderung.
- **Ziel:** Liste neu / geändert / gestrichen mit drei Einträgen; Markierung im Raster (R-6-30, R-6-31).
- **Soll Maus/Tastatur 3:** «Stände vergleichen» (1), Stand A (1), Stand B (1).
- **Soll nur Tastatur 5:** Befehl (1), zwei Auswahlen mit Pfeilen (≤ 3), Enter (1).

### SA-27 «Was macht COBRA 10 diese Woche?» (Etappe 2)

- **Ausgangszustand:** Wo 1 gefüllt.
- **Ziel:** nur Einträge mit COBRA 10 deckend, Rest blass (R-6-29).
- **Soll Maus/Tastatur 2:** Filter öffnen (1), «COBRA 10» wählen (1).
- **Soll nur Tastatur 4:** Kürzel Filter (1), Eingabe (1), Wahl (1), Enter (1).

### SA-28 Zug-Auszug COBRA 10 als PDF (Etappe 2)

- **Ausgangszustand:** Wo 1 gefüllt.
- **Ziel:** PDF nur mit COBRA 10 (R-6-36).
- **Soll Maus/Tastatur 3:** «Zug-Auszug» (1), Spalte wählen (1), Speichern (1).
- **Soll nur Tastatur 5:** Befehl (1), Wahl (≤ 2), Enter (1), Speichern (1).

### SA-29 Bat-Einträge übernehmen (Etappe 3)

- **Ausgangszustand:** Kp-Plan FDT 2026; pseudonymisierte Bat-Fixture.
- **Ziel:** alle vorausgewählten Einträge entschieden; übernommene mit Quelle und Kp-Kategorie (R-8.3-06, R-8.3-09).
- **Soll Maus/Tastatur 6 + a:** Übernahme starten (1), Dateidialog (2), Kategorien-Zuordnung bestätigen (1), «Vorauswahl übernehmen» (1), Abschluss (1); je Abweichung von der Vorauswahl 1 (a).
- **Soll nur Tastatur 8 + a:** zusätzlich zwei Tab-Schritte.

### SA-30 Neue Bat-Version nachführen (Etappe 3)

- **Ausgangszustand:** Kp-Plan mit übernommenen Bat-Einträgen; neue Bat-Fixture mit m Änderungen (14.9: m = 5).
- **Ziel:** alle m Meldungen nachgeführt oder bewusst belassen; P6 behoben.
- **Soll Maus/Tastatur 4 + m:** Import (1), Dateidialog (2), bestätigen (1), je Meldung ein Klick «nachführen» (m).
- **Soll nur Tastatur 6 + 2m:** je Meldung ↓ und Enter.

### SA-31 Plan zur Weitergabe exportieren (Etappe 3)

- **Ausgangszustand:** Plan mit internen Notizen, Pendenzen, quittierten Befunden.
- **Ziel:** Weitergabe-Datei ohne diese Inhalte (R-8.1-04).
- **Soll Maus/Tastatur 3:** «Zur Weitergabe exportieren» (1), Optionen bestätigen (1), Speichern (1).
- **Soll nur Tastatur 5:** Befehl (≤ 3 über Palette), Enter (1), Speichern (1).

### SA-32 Tag an Tagesbefehle übergeben (Etappe 4)

- **Ausgangszustand:** KVK Mo gefüllt; Suite mit Tagesbefehl-Werkzeug.
- **Ziel:** Lieferung im Tagesbefehl-Werkzeug ohne Dateiauswahl; Zeitpunkt vermerkt (R-9.2-03, R-9.2-05).
- **Soll Maus/Tastatur 2:** Tag wählen (1), «An Tagesbefehle übergeben» (1).
- **Soll nur Tastatur 4:** Tag fokussieren (≤ 2), Befehl (1), Enter (1).

### SA-33 Spaltensatz-Vorschlag aus dem Detachementsplaner annehmen (Etappe 4)

- **Ausgangszustand:** Suite mit Detachementsplaner-Fixture (Züge und Sph Det 1–3); Wo 2 ohne Spaltensätze.
- **Ziel:** Spaltensätze je Tag gemäss Vorschlag (R-14.11-02).
- **Soll Maus/Tastatur 2:** Woche wählen (1), «Vorschlag übernehmen» (1).
- **Soll nur Tastatur 4:** Befehl (≤ 3), Enter (1).

### SA-34 Nacharbeit nach Import (Beschrieb 14.1, Etappe 1)

- **Ausgangszustand:** Kp-Referenz importiert (nur lokal, `test:reference`); `ux-critic` hat nur Importbericht, Listenansicht und Referenz-PDF, nicht Anhang A (Prompt §5.3 Schritt 4).
- **Ziel:** Listenansicht stimmt für KVK und Wo 1 mit Anhang A zu 100 % überein (Skriptvergleich danach).
- **Soll 3 je Abweichung (Maus/Tastatur):** Berichtseintrag anspringen (1), Feld korrigieren (Wahl 1 + Eingabe 1). Soll nur Tastatur 5 je Abweichung. Anzahl Abweichungen = Einträge, die nach R-14.1-01 nicht korrekt erkannt sind.
- **Ausweis:** Gesamtzahl der Aktionen und Abweichungen im Abnahmebericht; keine echten Inhalte in `docs/`.

## Messreihe

Vom `ux-critic` je Etappe und Aufgabe nachgeführt. «Aktionen Ist» = Variante Maus/Tastatur, «Tastatur Ist» = Variante nur Tastatur; bei Formeln die eingesetzten Werte (n, e, z, a, m) in «Bemerkung».

| Etappe | Datum | Aufgabe | Aktionen Ist | Tastatur Ist | Bemerkung |
| --- | --- | --- | ---: | ---: | --- |
