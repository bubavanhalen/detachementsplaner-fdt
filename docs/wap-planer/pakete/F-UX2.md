# F-UX2 – Paketzweig `wap/f-ux2` (Schlussrunde vor Gate B: Raster Bildschirm = PDF und Bedienung)

- Etappe: 1 (Schlussrunde vor Gate B).
- Anforderungen: R-5.1-26, R-5.1-27, R-5.1-28, R-5.1-29, R-5.2-11, R-5.2-12 (nachgetragen durch F-DOKU am 20.10.2026, Katalog-Änderungsnotiz F-DOKU «Entscheid Auftraggeber 19.10.2026 Zusatzpunkte», Befund SA-2-08/TR-2-06; Belege mit eigener ID unter `tests/wap/unit/f-doku/` und `tests/wap-e2e/f-doku/`)
- Bezug: Rückmeldung des Auftraggebers vom 19.10.2026 (N1–N5) und Entscheid «Bildschirm: ja» (CR-H-U-02/-03, Freigabeprotokoll 19.10.2026); Gestaltung `docs/wap-planer/ui/raster-bedienung-v2.md`. Die Tests von F-UX2 tragen nur IDs bereits eingefrorener Pakete (R-5-01, R-5-02, R-5.1-…, R-5.2-08/-09). Nachtrag F-DOKU (20.10.2026): Die neuen Funktionen haben eigene IDs (oben, `plan/etappe-1.md` Anhang A – Nachtrag F-DOKU); die F-UX2-Tests bleiben unverändert (gesperrt) und sind zusätzliche Belege, Zuordnung je ID in der Katalog-Änderungsnotiz F-DOKU.
- Grundlage: AE-006 §3; Beschrieb 4.4, 4.6, 5, 5.1, 5.2, 6, 11; UI-Richtlinie 4.1, 4.2, 5.1–5.5, 5.10, 13.3; ADR-004 Punkt 4. Zweig ab `wap-codex` cd21877, Worktree `C:\Users\phili\source\repos\wap-wt\f-ux2`.

| Punkt | Stand | Umsetzung |
| --- | --- | --- |
| P1 Bildschirm = PDF (CR-H-U-02/-03) | umgesetzt | Raster, Spaltenköpfe und Termine im Rahmen der PDF-Seite (`pageFrame` → `pageBasis`), ein Faktor px/pt in beiden Richtungen (`pageFactor`, `pageScaleOf`); 100 % = 0,8 px/min wie bisher; Einpassen = grösster Faktor für Breite und Höhe. Tageslayout in pt und zoomunabhängig zwischengespeichert (Zoom ohne neues Layout). |
| P2 Direktbearbeitung im Block (N2) | umgesetzt | Unsichtbare Eingabefelder (Namen, Tab-Reihenfolge wie bisher); Text, Schreibmarke und Markierung live aus der Layout-Schicht (`inlineText.ts`); Klick/Ziehen/Doppelklick im Text, Ziehen aus dem Block heraus übernimmt und verschiebt; Ctrl+B, IME, Kopieren/Einfügen, Ctrl+Z/Ctrl+Y innerhalb der Bearbeitung; Feldanzeige an der Blockkante für Felder ohne Platz im Block. |
| P3 Bündig (N3) | umgesetzt | Linien des Rasters wie im PDF (Stärken und Strichmuster der Vorlage) als eigene Ebene, Blockränder und Linien auf ganze Gerätepixel aus derselben Geometrie; Tagesbreite ohne Rahmen. |
| P4 Treffen, Ziehen, Grösse (N4) | umgesetzt | Treffer aus der Geometrie (`hitTest.ts`): Marker, sonst kleinster Eintrag; Aussparungen gehören nicht zum Block; Kantenzonen in px; Mindest-Trefferbreite 16 px für schmale Spalten; Mauszeiger je Zone, Hervorhebung des getroffenen Eintrags; Kontextmenü nach Treffer. |
| P5 Doppelklick auf Kante (N5) | umgesetzt | `fill.ts`: bis zum Nachbarblock mit gemeinsamer Spalte bzw. Rasterbeginn/-ende; Variante c, ein Undo-Schritt; Ctrl+Shift+↑/↓, Kontextmenü. |
| P6 Spalten hinzufügen/entfernen (N1) | umgesetzt | `insertOrRemoveDayColumn` (dayColumns.ts); Spaltenkopf-Menü (Rechtsklick, Shift+F10), Einfg/Shift+Einfg/Entf; Rückfrage «Nur dieser Tag / Alle Tage mit diesem Spaltensatz»; Entfernen löscht nichts (P1, Meldung mit Anzahl), neue Spalte sofort umbenennen; Plan-Einstellungen unverändert (Hinzufügen/Entfernen im Spaltensatz bestand). |

**Messwerte.** Fehltreffer (dichte fiktive Woche, 160 Klicks, 40 Züge, 8 Züge in die Det-Spalte bei 100/50 %): vor P4 (f3eeb9c) 5/160 Klicks, 1/40 Züge, 0/8 Det; nach P4 0/160, 0/40, 0/8. Parität Editor-Raster = PDF: alle Blockzeilen textgleich, Lage ≤ 0,05 pt bei 50/100/200 % und Einpassen (vorher bei cd21877: rot).

**Schleuse (29a7338, nach Merge wap-codex a201b77).** Schnelle Schleuse als Pre-commit grün (13 Schritte); `wap:gate:fast` von Hand wegen Fremdlast (F0-last, Mutationslauf F-TOOLS) nicht startbar; `wap:test` 2303/2303 grün; `wap:test:e2e` 304 grün, 2 rot unter Fremdlast (H-UI2 SA-H-07 Zeitlimit, I2b A3 Ziehen gedrosselt p95 30,9 ms – auf cd21877 unter gleicher Last ebenfalls rot: 34,3 ms); `build`, `check:release` grün. Neu auszuführen bei ruhigem Rechner.

**Tests.** Vitest `tests/wap/unit/f-ux2/` (Parität, Direktbearbeitung, Treffen/Auffüllen, Spalten); Playwright `tests/wap-e2e/f-ux2/` im Entwicklungsserver und in der Einzeldatei (Parität, Direktbearbeitung, Treffer-Messung, Zonen/Auffüllen, Bündig, Spalten). Rot-Nachweis gegen cd21877 (P1–P3, P5, P6) bzw. f3eeb9c (P4). Nur fiktive Daten.

- [x] 1 Worktree angelegt und installiert (`npm ci`, Exit 0).
- [x] 6 Neue Tests eingefroren per lock-update mit Grund «F-UX2» (23 Dateien unter `tests/wap/unit/f-ux2/`, `tests/wap-e2e/f-ux2/`); Testpfade additiv registriert (f3eeb9c).
- [x] 7 Umsetzung je Punkt: zuerst ein roter Test, dann die Korrektur (Commits f3eeb9c, 30e48a2; rot belegt gegen cd21877 bzw. f3eeb9c).

## Runde 2 (Befunde code-reviewer-ui-2 und visual-qa-2, Stand 5da6891)

| Befund | Stand | Umsetzung |
| --- | --- | --- |
| CR-U-2-01 (blockierend) | behoben | Fokus nach «Spalte entfernen» aus dem neuen Planstand: Kopf an derselben Stelle, sonst letzte Spalte, Rückfall Zellzeiger; kein hängender Fokusauftrag. |
| CR-U-2-02 | behoben | Ctrl+S/P/O/K/L in Direktbearbeitung, Spaltenname und Termintext: übernehmen und an die Route weitergeben (WAP-Funktion, kein Browserdialog). |
| CR-U-2-03 | behoben | Leere Fläche nach der Spalte unter dem Zeiger (Mindest-Trefferbreite): Drücken, Ziehen und Doppelklick wirken auf die angezeigte Spalte. |
| CR-U-2-04 | behoben | Doppelklick wertet die Zone des ersten Drückens (gleiche Stelle, ≤ 500 ms). |
| CR-U-2-05 | behoben | Rand der einfachen Blockdarstellung auf ganze Gerätepixel. |
| CR-U-2-06 | behoben | Kürzelübersicht: Auffüllen, Spaltenkopf-Tasten und -Menü, Doppelklick auf die Kante, Ctrl+Z/Y in der Bearbeitung. |
| CR-U-2-07 | behoben | Hervorhebung nach Planänderung, Zoom und Rollen aus der letzten Zeigerlage neu berechnet. |
| CR-U-2-08 | behoben | Leeres Feld: Schreibmarke in der Feldanzeige. |
| CR-U-2-09 | behoben | Enter/Esc/Tab während einer IME-Komposition ohne Wirkung. |
| CR-U-2-10 | behoben (ohne roten Test) | Palette bietet «PDF dieser Woche» ohne aktive Woche nicht an; der Fall war im Prüfstand ohne Plan nicht nachstellbar (Test war vorher grün, daher nicht aufgenommen). |
| VQA-2-01 (blockierend) | behoben | Spaltenköpfe am Bildschirm aus `layoutWeekPage` (dieselben Zeilen, Trennung, Grösse, Lage wie im PDF), einmal je Planstand. |
| VQA-2-02 | behoben | Terminbereich mit Termine-Oberlinie, «Was»-Zeile und -Linie und Tageskante; erste Terminzeile an der Lage der Wochenseite. |

Tests (eingefroren, Grund «F-UX2 Runde 2»): `tests/wap-e2e/f-ux2/runde2*`, `koepfe*`, `tests/wap/unit/f-ux2/koepfe-termine.test.ts`; Fixture `planKoepfe` in `support/plaene.ts` angehängt (nachgeführt). Rot gegen 5da6891 (runde2 8/8, koepfe E2E und Unit 6/6), danach grün; betroffene E2E (f-ux2, i2, i2b, i2c, h-tests/erfassen, h-ui, h-ui2, i3, e1-02l) 104 grün, Einzeldatei f-ux2 18 grün.

## Runde 3 (Befunde ux-critic-2, Stand 5da6891; nachgestellt auf 8f129fd)

| Befund | Stand | Umsetzung |
| --- | --- | --- |
| UX-2-01 (hoch) | behoben | Ctrl+P/S/K/L/O schon seit Runde 2 (CR-U-2-02, Test `runde2`); neu Ctrl+. (Befundliste) und F8/Shift+F8: Bearbeitung übernehmen, dann die Funktion. |
| UX-2-02 (hoch) | behoben | Verschieben eines mehrspaltigen Blocks am Tagesrand: Spaltenverschiebung auf die Planungsspalten begrenzt; Vorschau, Zeitschild («Trp–Det») und Ablage zeigen dasselbe Ziel, kein stilles Zurückfedern. |
| UX-2-03 | behoben | Schmaler gewählter Block (< 24 px): seitlicher Griff 4 px aussen an der Kante (Zeiger ew-resize); Shift+→/Shift+← ändern die rechte Spaltengrenze, am Rand Meldung mit dem Weg. |
| UX-2-04 | behoben | Liegt ein höher gestapelter Block bzw. Rapport (auch der gewählte) über einem Marker, gilt in dessen Kante oben/unten die Blockkante; im Innern bleibt der Marker vorn (R-5.1-26, eingefrorener F-DOKU-Test). Entscheid Koordinator 20.10.2026: Ausnahme Kantenzone als Änderungsnotiz zu R-5.1-26; Bestätigung an Gate B. |
| UX-2-05 | behoben | Ganze Blockfläche ausser den Kanten oben/unten ist Bearbeitungsfläche; Klick neben/unter den Text setzt die Marke ans Ende der nächstgelegenen Zeile; Ziehen aus dem Block bleibt Verschieben. |
| UX-2-06, FD-04 | behoben | Name der eben eingefügten Spalte übernimmt den Geltungsbereich des Einfügens (eine Rückfrage je Handlung); Fokus danach auf dem neuen Kopf; Anfangsfokus der Rückfrage «Nur dieser Tag». |
| UX-2-07, UX-H-05 | behoben | ←/→ am P1-Block setzt ihn von der gezeichneten Lage eine Spalte weiter in vorhandene Spalten (Befund weg). |
| UX-H-12 (SA-20) | behoben | Befundliste: Anfangsfokus auf der ersten offenen Meldung; Spalte entfernen und P1 beheben per Tastatur in 5 Tasten (Entf, Enter, Ctrl+., Enter, →). |
| UX-2-08 | schon behoben (Runde 2) | CR-U-2-06, Test `runde2`. |
| UX-2-09 | behoben | Meldung bei Ctrl+Z an der Grenze seit 8f129fd vorhanden (Speicher F-UX1, hier belegt); Tooltip des grauen Knopfs nennt Grund und «Wiederherstellungspunkte …». |
| UX-2-10 | behoben | Getipptes Startzeichen: Stand davor ist der erste Rückgängig-Schritt der Bearbeitung. |
| UX-2-11 | schon behoben (Runde 2) | CR-U-2-05, Test `runde2`. |
| UX-2-12 | unverändert | Gemäss Befund («sonst so lassen»): Zeitschild und Vorschau zeigen die Zielspalte. |
| UX-2-13 | behoben | Tag ohne Spaltensatz: Hinweis im Spaltenkopf (Tooltip mit ganzem Text), nicht im Raster. |
| UX-2-14 | behoben | Ursache: Leerzeichen zählten beim Abgleich doppelt, Felder mit Leerzeichen galten nie als ganz gezeichnet; Feldanzeige zeigt den Wert nur noch bei entfallenem Text. |
| UX-H-N2 Guillemets | behoben | Dialog «Plan-Datei öffnen»/«Plan als Kopie öffnen» und Meldung «nicht geöffnet»: Anzeigename trägt die Guillemets schon. |
| UX-H-N2 «Leitung Kp» | nicht geändert | Legendentext der Vorlage (`legendLabel`), durch eingefrorene Tests festgelegt; Test-Einwand TE-FUX2-01 an Gate B (FINDINGS). |
| UX-H-N2 P1-Marke nach Tageswechsel, Querbalken-Name nach Verlängern | nicht umgesetzt | Befund ohne Ablauf beschrieben, nicht nachstellbar. |

Tests (eingefroren, Grund «F-UX2 Runde 3»): `tests/wap-e2e/f-ux2/runde3*` (12 Fälle), `tests/wap/unit/f-ux2/runde3.test.ts` (4); Fixture `planDetRand` in `support/plaene.ts` angehängt (nachgeführt). Alle rot gegen 8f129fd, danach grün.

## Runde 4 (Befunde visual-qa-3 und code-reviewer-3, Stand 79bf4d5)

| Befund | Stand | Umsetzung |
| --- | --- | --- |
| VQA-3-04 (mittel) | behoben | Terminspalten am Bildschirm nach derselben Regel wie die Wochenseite (`agendaColumns`): zusammengefasstes Wochenende = eine Spalte Sa+So; der Sa zeigt die Termine beider Tage über die Breite Sa+So, der So keine eigenen; ← / → im Terminbereich überspringen die gemeinsame Spalte. |
| VQA-3-05 (niedrig) | behoben | Ursachen: Kopfzeilen relativ zum Kopfbereich gesetzt, dessen Unterkante wegen gerundeter Höhe und 1 px Rand über der Rasteroberkante lag (senkrecht ≈ 0,55 pt), und Tageslage auf Gerätepixel gerundet (waagrecht bis 0,16 pt). Köpfe jetzt relativ zur Rasteroberkante, Köpfe und Termine um die Rundung der Tageslage ausgeglichen; Abweichung ≤ 0,003 pt. |
| CR-3-01 (mittel) | behoben | Kantenzug links/rechts ändert nur die äussere Grenze; Lücken verknüpfter Teilblöcke bleiben (gleiche Regel wie Shift+→). |
| CR-3-02 (mittel) | behoben | Äusserer Griff am schmalen gewählten Block nur über leerer Fläche; ein anliegender Eintrag behält Klick und Zug (R-5.1-26). Der in Runde 3 eingefrorene Unit-Fall (Griff über dem Nachbarn) ist nach dem Auftrag des Koordinators angepasst (TE-FUX2-02). |
| CR-3-06 (niedrig) | behoben | Shift+→/Shift+← wirken auf alle gewählten Blöcke, ein Rückgängig-Schritt. |
| CR-3-05 (niedrig) | angenommen | Durch den Koordinator angenommen (Wochenseite je Planänderung neu gelegt, 7 ms). |

Tests (eingefroren, Grund «F-UX2 Runde 4»): `tests/wap-e2e/f-ux2/runde4*` (5 Fälle; Parität mit PDF aus dem Export, Bezug Blockzeilen), `tests/wap/unit/f-ux2/runde4.test.ts`; `tests/wap/unit/f-ux2/runde3.test.ts` nachgeführt (CR-3-02). Alle rot gegen 79bf4d5, danach grün.

## Runde 5 (Befunde ux-critic-3, Stand 79bf4d5; nachgestellt auf 79af7c4)

| Befund | Stand | Umsetzung |
| --- | --- | --- |
| UX-3-01 (mittel) | schon behoben (Runde 4, CR-3-02) | Auf 79af7c4 mit Test belegt: Klick und Zug 2 px im Nachbarn gehen an ihn, der gewählte schmale Block bleibt. |
| UX-3-02 (mittel) | behoben | Ursache: Wird eine Spalte im eigenen bzw. für alle Tage verwendeten Satz entfernt, verschwindet ihre ID aus allen Sätzen; der Eintrag hatte keine frühere Lage mehr und wurde nach O-1/Q-027 über die ganze Breite gezeichnet. Jetzt bleibt die frühere Spaltenfolge als ungenutzter Satz «‹Satz› (vor Entfernen von «‹Spalte›»)» erhalten, nur wenn Einträge in der Spalte liegen; der Eintrag steht wie bei einer fehlenden Spalte in der gleichen relativen Lage, ←/→ und Ziehen beheben P1. Für Einträge ohne bekannte Lage (ältere Pläne, ganze Breite): ←/→ setzt in die letzte bzw. erste Spalte (mit Meldung), Ziehen in die Spalte unter dem Zeiger. |
| UX-3-03 (niedrig) | behoben | Befundliste offen und Fokus ausserhalb (nach «Zur Stelle»): Ctrl+. setzt den Fokus auf die nächste offene Meldung; Esc schliesst die Liste. |

Tests (eingefroren, Grund «F-UX2 Runde 5»): `tests/wap-e2e/f-ux2/runde5*` (4 Fälle), `tests/wap/unit/f-ux2/runde5.test.ts` (2). Rot gegen 79af7c4 (UX-3-02, UX-3-03; UX-3-01 dort schon grün), danach grün.

Hinweis Grunddaten: Der aufbewahrte Satz ist kein neuer Speicherort, sondern ein gewöhnlicher (ungenutzter) Spaltensatz im Plan; er erscheint in den Plan-Einstellungen und kann dort entfernt werden, sobald keine Einträge mehr auf ihn verweisen.

## Runde 6 (Befunde code-reviewer-4 zum aufbewahrten Spaltensatz, Stand 966d848)

| Befund | Stand | Umsetzung |
| --- | --- | --- |
| CR-4-01 (mittel) | behoben | Name des aufbewahrten Satzes eindeutig wie bei den übrigen Befehlen («… (2)», «… (3)»); Umbenennen auf den eigenen Namen geht. |
| CR-4-02 (niedrig) | behoben | «Spaltensatz löschen» in den Plan-Einstellungen: verweisen Einträge auf Spalten des Satzes, Rückfrage mit Anzahl («n Einträge … verlieren ihre Lage»), «Behalten» vorgewählt. |
| CR-4-03 (niedrig) | behoben | Satz nur, wenn Einträge in der Spalte liegen (seit Runde 5); verweist kein Eintrag (auch gelöschter Wochen) mehr auf ihn, entfernt ihn jeder folgende Befehl der Sitzung im selben Rückgängig-Schritt (`tidyKeptColumnSets`). |
| CR-4-04 (niedrig) | behoben | Einträge gelöschter Wochen zählen mit: der Satz entsteht auch dann, nach «Woche wiederherstellen» liegt der Eintrag an seiner Stelle. |
| CR-4-05 | nicht F-UX2 | Import (sheet.ts), anderes Paket. |

Tests (eingefroren, Grund «F-UX2 Runde 6»): `tests/wap/unit/f-ux2/runde6.test.ts` (3, nach den Repros in `.qa/haertung/cr-4/`), `tests/wap-e2e/f-ux2/runde6*` (2). Rot gegen 966d848, danach grün.

## Runde 7 (Nacharbeit SA-34, Listenansicht und Liste ↔ Raster, Stand 682ccd5)

| Befund | Stand | Umsetzung |
| --- | --- | --- |
| UX-AB-02 (hoch) | behoben | Zeilenwechsel in der Liste wählt den Eintrag im Raster mit (Fokus bleibt in der Liste; das Raster rollt nur in sich, nie die Seite). «Im Raster zeigen» fokussiert den Eintrag, bei ganztägiger Bemerkung bzw. Beso im Terminbereich die Terminzeile. Löschen: Ctrl+Entf in der Zeile, Entf in Typ/Tag oder Knopf «Eintrag löschen», Meldung mit «Rückgängig». |
| UX-AB-03 | behoben | Entf bzw. Rücktaste leeren die Zelle (ein Befehl); nicht leerbare Zellen melden den Weg. |
| UX-AB-04 | behoben | Neuer Beso-Titel aus der Liste normal (Block und Querbalken fett), Teilfett bleibt erhalten. |
| UX-AB-05 | behoben (Oberfläche) | «geändert» ist eine Markierung (Beschrieb 4.6, R-4.6-33/-67), kein Status: in der Liste nicht wählbar, Statuswahl lässt die Markierung unverändert; Export unverändert nach normalisierung.md 5.9. Dass Beso nach dem Stand automatisch markiert werden, Blöcke nicht, ist die Katalogregel R-4.6-67 (Q-026) – unverändert, Frage an Gate B. |
| UX-AB-07 | behoben | «Zur Stelle» bei einer verdeckten Form: gestrichelter Geist an der Originallage mit Spanne und Text, Zellzeiger dort; der Text der verdeckten Form steht im Bericht unter «Nicht übernommener Text» (nur lokal, nie in der Meldung). |
| UX-AB-10 | behoben | Tottaste bzw. Komposition auf einer Zelle öffnet die Bearbeitung sofort mit fokussiertem Feld; das zusammengesetzte Zeichen geht nicht verloren. |
| UX-AB-11 | behoben | Ursache: der angedockte Bericht behielt die Mindestbreite des Dialogs (860 px) und wurde seitlich abgeschnitten. Angedockt passt er sich an; Seitenfeld, Befundliste und Bericht stehen bei mehreren offenen untereinander. |
| UX-AB-15 (blockierend) | behoben (kleinster Modellschritt) | Beso.categoryId darf null sein («keine»; Beschrieb 4.6 Feldtabelle Beso: Leitungskategorie optional). Plan-Datei: ältere Dateien unverändert lesbar (immer mit Kategorie). Liste und Seitenfeld bieten «keine», Liste und Export leer, Kästchen ohne Farbe wie neutral. Import unverändert (Zuordnung einer Kategorie bei Beso ohne Kästchen bleibt Sache des Imports). |
| UX-AB-17 | nicht umgesetzt (Test-Einwand TE-FUX2-03) | UI-Richtlinie 13.3 (N/B/R/Q/M/G am fokussierten Eintrag = neuer Eintrag) widerspricht dem gesperrten Test `tests/wap-e2e/i2b/support/handhabung.ts` («Tippen auf einen gewählten Block … überschreibt», tippt «Neu»). Entscheid an Gate B. |
| UX-AB-18 | behoben | Dialog «Neuer Marker» mit Feld «Tag» (vorbelegt, änderbar); anderer Tag → über alle Planungsspalten. |
| UX-AB-19 | behoben | Gemeinsame Terminspalte Sa+So: Doppelklick bzw. Kontextmenü in der Hälfte des So gilt dem So. |
| Regel 12 (Personen) | behoben | Excel-Import erhält die Personenliste des geöffneten Plans (nur Übergabe, keine Kopie in den neuen Plan); ohne Plan bzw. Personen leer. |
| UX-AB-06, -08, -09, -12 | Gate B / Etappe 2 | gemäss Koordinator nicht umgesetzt. |

Tests (eingefroren, Grund «F-UX2 Runde 7»): `tests/wap-e2e/f-ux2/runde7*` (9 Fälle, dazu `runde7-import.spec.ts` mit 3 im Entwicklungsserver), `tests/wap/unit/f-ux2/runde7.test.ts` (3). Rot gegen 682ccd5, danach grün.

## Runde 8 (Befunde code-reviewer-5, Stand 78a32d3)

| Befund | Stand | Umsetzung |
| --- | --- | --- |
| CR-5-05 (niedrig) | behoben | Eintrag löschen in der Liste nur mit Ctrl+Entf bzw. Knopf «Eintrag löschen»; Entf in Tag/Typ zeigt «… lässt sich nicht leeren. Ctrl+Entf löscht den Eintrag.». Der in Runde 7 eingefrorene E2E-Fall ist nach dem Auftrag nachgeführt (Grund «F-UX2 Runde 8: CR-5-05»). |
| CR-5-03 (niedrig) | behoben | Aufbewahrte Sätze am Aufbau erkannt (neuer, ungenutzter Satz mit der ID der eben entfernten Spalte; `createdKeptSets`) und von der Sitzung je Plan geführt; aufgeräumt werden nur diese, auch umbenannt. Benutzersätze mit passendem Namen bleiben; nach dem Neuladen wird nichts mehr automatisch aufgeräumt. Ohne Formatänderung. |

Tests (eingefroren, Grund «F-UX2 Runde 8»): `tests/wap/unit/f-ux2/runde8.test.ts` (2); `tests/wap-e2e/f-ux2/support/runde7.ts` nachgeführt. Rot gegen 78a32d3, danach grün.
