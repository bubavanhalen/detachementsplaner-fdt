# ADR-002: Datenmodell als einzige Quelle

- **Status:** Entwurf Runde 5 (01.10.2026, nach AR0-45, AR0-48). **Entschieden an Gate 0 (02.10.2026):** G-12 a (Gate-0-Entscheid 3) – je Stand nur A4 mit rotem Status gespeichert; A3 und «Status aus» sind für frühere Stände gesperrt (Punkt 6a unverändert; Schlüsselschema `weekId` bzw. `plan` ohne Format- und Statusteil).
- **Leitplanken:** 1 (ein Datenmodell), 5 (Undo, siehe ADR-006); Beschrieb 4, 5.3, 5.5, 7
- **Gate-0-Entscheid des Auftraggebers:** G-12 Varianten früherer Stände (Punkt 6a, Auslegung von Beschrieb 5.5 und 10, AR0-35); sonst betrifft das ADR nur den WAP-Planer.

## Kontext

- Leitplanke 1: Raster, Listenansicht, PDF, Prüfungen, Import-Ergebnis und Tagesbefehl-Lieferung sind Ableitungen **eines** Datenmodells.
- Beschrieb 4: «Das Tool speichert den WAP als Daten, nicht als Bild: jeder Eintrag kennt Tag, Zeit, Spalten, Leitung und Text, und das PDF wird daraus gezeichnet.» Beschrieb 7 schliesst «Abweichung zwischen Zeitfeld und Lage im Raster» und «Formen neben dem Raster» durch den Aufbau aus.
- Beschrieb 5.3: Beso-Kästchen und Termintext sind **ein** Objekt; Nummern sind vor dem ersten Stand laufend, danach fixiert.
- Beschrieb 5.5: «Jeder frühere Stand lässt sich jederzeit als identisches PDF ausgeben.»
- Beschrieb 5.6 Punkt 6: Undo über alle Änderungen inkl. Import, Übernahme, Spaltensatz und «auf alle Fundstellen anwenden».

## Geprüfte Optionen

| | Option | Bewertung |
| --- | --- | --- |
| A | **Normalisiertes, unveränderliches JSON-Dokument** (Plan → Wochen → Tage; Einträge, Spaltensätze, Kategorien, Personen in ID-Tabellen). Änderungen nur über **Befehle**, die das Dokument ersetzen und inverse Patches liefern. Alles Sichtbare sind reine Ableitungen `derive…(plan)` | Serialisierbar (Plan-Datei = Dokument), vergleichbar (Stände, Änderungsvergleich 6), Undo als Patch-Protokoll (ADR-006), Ableitungen rein testbar |
| B | Veränderliche Klassen-Objekte (OO-Modell mit Methoden) | Bequem im Code, aber Undo/Redo, Persistenz und Vergleich brauchen eigene Schnappschuss-Logik; schwerer rein zu testen |
| C | Geometrie-zentriert wie Excel (Formen mit Koordinaten, Zeit abgeleitet) | Widerspricht Beschrieb 4 und 7 (Lage und Zeit fallen auseinander); verworfen |

## Entscheid (Empfehlung)

**Option A.** Eckpunkte (Bezeichner gemäss künftigem `glossar.md`):

1. **Keine Positionen im Modell.** Zeit in Minuten ab 00:00 (ganzzahlig, Raster 5 Min, Beschrieb 4.5), Tag als Datum bzw. Tagesindex der Woche, Spalten als **stabile Spalten-IDs** (nicht Namen; Umbenennen bricht nichts). Positionen, Breiten, Umbrüche berechnet ausschliesslich die Layout-Schicht (ADR-004).
2. **Beso** ist ein Objekt mit einem oder mehreren Zeitfenstern (je Zeit, optional Spalte, optional Zusatz), Nummer, Fixierungsflag und Termintext-Feldern bzw. Freitext-Übersteuerung (Beschrieb 4.6, 5.3). Die Terminzeile ist eine Ableitung.
3. **Zeitformen** als Summentyp: Zeitpunkt, von–bis, ab X, bis X, Frist mit Datum; Sortierzeit als reine Funktion (Beschrieb 4.6).
4. **Querbalken** tragen Datum von–bis und liegen auf Plan-Ebene, nicht in einer Woche (Beschrieb 4.6: auch über Wochengrenzen).
5. **Verknüpfte Teilblöcke** (nicht benachbarte Spalten) als ein Eintrag mit mehreren Spaltenbereichen (Beschrieb 4.6).
6. **Stand (atomar, AR0-01):** «Neuen Stand setzen» ist ein einziger Vorgang:
   1. Aus dem Dokument im Zustand *nach* dem Stand-Befehl (berechnet, noch nicht gespeichert) werden **zuerst** alle garantierten PDF-Varianten erzeugt (Punkt 6a). Schlägt das fehl, entsteht kein Stand und nichts wird geschrieben (Meldung mit Ursache).
   2. Während Rendern und Schreiben ist die Bearbeitung gesperrt (modaler Fortschritt, «Abbrechen» schreibt nichts); die Transaktion prüft zusätzlich die Revision, aus der gerendert wurde (`expectedRevision`), und schreibt bei Abweichung nichts (`conflict`, ADR-006 Punkt 2a, AR0-25). Danach schreibt **eine** IndexedDB-Transaktion gemeinsam: Wiederherstellungspunkt «vor Stand», neues Dokument, Historienschritt und Stand-Aufzeichnung (Dokument-Schnappschuss + PDF-Bytes). Die Aufzeichnung trägt die Sequenznummer ihres Historienschritts.
   3. **Undo/Redo:** Eine Stand-Aufzeichnung gilt nur, solange ihr Historienschritt angewendet ist. Undo des Stands blendet sie aus (sie bleibt gespeichert, erscheint aber nicht in «Stand V‹n›» und im Export); Redo blendet sie wieder ein. Wird der Redo-Zweig durch eine neue Änderung verworfen, wird die ausgeblendete Aufzeichnung in derselben Transaktion gelöscht. **Kopplung (AR0-45):** Jede Aufzeichnung trägt `seq` (einblendender Schritt: Stand, Import oder Ersetzen; `seq = 0` = **ungekoppelt**, z.B. Stände aus einer Plan-Datei ohne lokalen Plan oder aus «Als Kopie öffnen», immer sichtbar) und `hiddenBySeq` (ausblendender Schritt «Ersetzen aus Datei», sonst leer). Sichtbar ist sie, wenn (`seq = 0` oder Schritt `seq` angewendet) und (`hiddenBySeq` leer oder Schritt `hiddenBySeq` nicht angewendet); die Sichtbarkeit wird berechnet, nicht gespeichert. Beim Verwerfen eines Redo-Zweigs werden daran gekoppelte Aufzeichnungen gelöscht und daran gekoppelte Ausblendungen aufgehoben; durch Kürzen dauerhaft ausgeblendete Aufzeichnungen werden gelöscht. Die Sequenznummern beginnen bei 1 und werden nie wiederverwendet (Zähler `nextSeq` in der Historie, AR0-48). Regeln im Einzelnen: Vertrag E1-04.
   4. **Import-Stand:** Der erste Stand beim Import (Beschrieb 8.2 Regel 10) entsteht im selben Ablauf mit PDF-Bytes (ADR-008).
   6a. **Garantierte Varianten (AR0-10):** Je Stand werden bytegleich garantiert und gespeichert: jede Woche und das Gesamt-PDF, je A4 mit roter Status-Darstellung (Standard, Beschrieb 10). Das Gesamt-PDF wird auf **einem** Weg erzeugt (`renderPlanPdf`) und als eigene Bytes gespeichert, nie aus Wochenseiten zusammengesetzt. Für frühere Stände bietet der Export nur diese Varianten an; A3 und «Status rot aus» sind dort gesperrt mit Hinweis. **Das ist eine Auslegung** von Beschrieb 5.5 («jederzeit als identisches PDF») zusammen mit 10 («optional A3», Status abschaltbar) und wird als **Gate-0-Frage G-12** vorgelegt: (a) nur A4 mit Status rot (Empfehlung: kleiner Speicher, eine Variante, klar); (b) zusätzlich A3 je Stand mitspeichern (je Woche und Gesamt-PDF, etwa doppelter Speicher, doppelte Renderzeit und damit doppelte Sperrdauer beim Stand); (c) alle vier Kombinationen A4/A3 × Status an/aus (vierfach). Bei b oder c ändern sich das Schlüsselschema der gespeicherten PDF zu `‹weekId|plan›/‹A4|A3›/‹rot|aus›` und die Verträge E1-04 (`StandSnapshotFile`) und E1-05 (`StandRecord`), und die Sperrdauer ist gegen das Budget zu messen (AR0-43). Vorgabe ohne Entscheid: a. So bleibt ein früherer Stand auch nach einer Tool-Aktualisierung bytegleich ausgebbar (Beschrieb 5.5).
7. **Befehle:** Jede Benutzeraktion, jeder Import und jede Übernahme ist genau **ein** Befehl (Transaktion) mit inversen Patches (JSON-Patch-artig). Massenänderungen sind ein Befehl. Umsetzung: eigene kleine Patch-Funktionen oder `immer` (MIT, `produceWithPatches`) – Entscheid im Etappenplan 1 nach Grössen- und Lizenzprüfung.
8. **Interne Notizen** und Pendenzen sind im Modell als solche markiert, damit Export zur Weitergabe (Beschrieb 8.1) sie zuverlässig entfernt.
8a. **Importbericht (AR0-12):** Der Bericht eines Imports wird je Plan mit der Sequenznummer des Import-Historienschritts in IndexedDB gespeichert (ADR-006), nach Neuladen wieder angezeigt und bei Undo des Imports ausgeblendet (Redo blendet ihn wieder ein). Er ist kein Teil des Dokuments und der Plan-Datei.
8b. **IDs (AR0-19, AR0-31):** Das Dokument führt einen Zähler `nextId`; jeder Befehl vergibt IDs daraus (Präfix je Art, z.B. `e412`). `nextId` ist **monoton über «Wiederherstellen» und «Ersetzen aus Datei»** (Maximum aus aktuellem Wert und Schnappschuss); ein Undo stellt den vorherigen Wert exakt her – unschädlich, weil der nächste Befehl den Redo-Zweig verwirft (AR0-41). Stand-IDs (`standId`) stammen nicht aus `nextId`, sondern werden in `src/io/` per `crypto.randomUUID()` vergeben (ADR-006 Punkt 2d). Eindeutigkeit über Neuladen gilt, weil der Zähler mit dem Dokument gespeichert wird; über Tabs, weil nur ein Tab schreibt (ADR-006 Punkt 4). «Als Kopie öffnen» vergibt eine neue Plan-ID (`crypto.randomUUID()` in `src/io/`), die Eintrags-IDs bleiben (sie sind nur innerhalb eines Plans eindeutig).
8c. **Vorlagen (AR0-18):** Vorlagen sind Daten, die als Parameter übergeben werden (`templates: ReadonlyMap<string, LevelTemplate>`); es gibt keine veränderliche globale Registry im Modell. Mitgelieferte Vorlagen liefert die reine Funktion `builtInTemplates()`.
9. **Personen** nur mit Grad, Name, Vorname, Funktion (Beschrieb 4.1, 11); das Modell hat keine Felder für weitere Personendaten.
10. **Formatversion** in jedem gespeicherten Dokument (`format`, `version`); Migrationen als reine Funktionen `vN → vN+1` (ADR-007).

## Folgen

- Prüfregeln (Beschrieb 7), Listenansicht, PDF und Tagesbefehl-Lieferung lesen nur das Dokument bzw. das Layout-Ergebnis; keine Komponente hält eigenen fachlichen Zustand.
- Das Import-Ergebnis ist ein Befehl auf dem Dokument plus ein Bericht (ADR-008); Undo nimmt einen Import als Ganzes zurück.
- Property-basierte Tests (Prompt §7) erzeugen zufällige Dokumente; die Invarianten (keine Überlappung, kein Text ausserhalb) prüfen das Layout-Ergebnis.
- Stand-Aufzeichnungen, Importberichte und Historienschritte sind über die Sequenznummer gekoppelt; ADR-006 legt die Transaktion fest.
- Speicherbedarf der Stände: je Stand Dokument (~0,2 MB bei 1000 Einträgen, Spike 3) plus PDF je Woche (Spike 2: 18,8 KB für eine Testseite mit 50 Kästchen; reale Wochenseite im Etappenplan zu messen).

## Beleg

- Spike 3 (`spikes/storage/probe.html`, `undoCost`): synthetischer Plan mit 1000 Einträgen = 202 KB JSON, `JSON.parse` 0,4–0,5 ms; Schreiben eines Schnappschusses in IndexedDB Median 0,7–0,9 ms, eines Patch-Eintrags 0,3 ms (Edge 155, headless).
- Spike 2: PDF bytegleich über Prozesse, Zeitzonen und Node/Edge (ADR-005) – Voraussetzung für Punkt 6.
