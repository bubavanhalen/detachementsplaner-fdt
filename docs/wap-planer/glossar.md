# WAP-Planer – Glossar

Stand 02.10.2026 · Etappe 0 (Prompt §5.1 Schritt 6) · erstellt durch `spec-analyst`, nachgeführt nach ADR-002 und ADR-006 Runde 2 bis 5 (Verträge E1-04, E1-05, E1-11), nach dem Gate-0-Entscheid vom 02.10.2026 (B-F-05, B-F-06, Q-009 K-1 und UI-F-1) und mit der Code-Spalte an die Verträge der Etappe 1 angeglichen (E1-02a-02, Änderungsnotiz am Schluss)

Jeder Fachbegriff hat genau einen Bezeichner im Code und genau einen Text in der Oberfläche. Code-Reviews prüfen dagegen (Prompt §4.3 `code-reviewer`), R-2-01 prüft die Oberfläche.

## Namensregel

Grundlage ist die Konvention der Suite: Bezeichner auf Englisch, deutsche Fachbegriffe bleiben deutsch (`docs/wap-planer/repo-analyse.md`; `src/model/types.ts` führt z.B. `Detachment`, `Person` neben `grad`, `funktion`, `zug`, `ort`; `src/model/tagesbefehl/types.ts` führt `TbLeitung`, `TbWeekday = 'Mo' | … | 'So'`).

1. **Englisch** für alles Strukturelle und Technische: Plan, Woche, Tag, Spalte, Eintrag, Zeit, Status, Vorlage, Speicher, Prüfung, Bericht usw.
2. **Deutsch bleibt** ein Begriff nur, wenn er (a) ein Armee- oder WAP-Fachbegriff ist, der im PDF oder im Befehlswesen wörtlich so steht und keine eindeutige englische Entsprechung hat, oder (b) eine Armee-Abkürzung ist. Abschliessende Liste: **Beso, Rapport, Querbalken, Ltg, Tn, Tpt, Tenue, Beilage, Stand, Tagesbefehl, Detachementsplaner** sowie die Felder der Suite **grad, name, vorname, funktion, zug, ort** (wie in `src/model/types.ts`). Neue Einträge in dieser Liste nur per Glossar-Änderung.
3. **Schreibweise:** Typen, Klassen, Komponenten `PascalCase`; Felder, Funktionen, Variablen `camelCase`; feste Werte als Zeichenketten in `camelCase` (englisch) oder – bei Armee-Kürzeln und Wochentagen – exakt wie im Beschrieb (`'AV'`, `'ABV'`, `'Mo'`). Alle deutschen Begriffe der Liste sind umlautfrei; andere deutsche Wörter kommen in Bezeichnern nicht vor.
4. **Zusammensetzungen** aus englischem Strukturwort und deutschem Fachbegriff: `besoNumber`, `besoRef`, `printTenue`, `LtgCategory`.
5. **Oberflächentext** ist Deutsch (Schweiz, «ss»), genau wie im Beschrieb; Abkürzungen der Armee unverändert. Verbotene Synonyme stehen in der letzten Spalte und werden in R-2-01 geprüft.
6. **Prüfungen** heissen im Code `P1` … `P19` (Zeichenkette), Anforderungen `R-…`, Aufgaben `SA-…`.

## Begriffe aus Beschrieb 2

| Begriff (Beschrieb) | Stelle | Code | Oberfläche | Nicht verwenden |
| --- | --- | --- | --- | --- |
| Plan | 2; 4.1 | `Plan` | Plan | Projekt, Dienstplan |
| WAP (Arbeitsplan einer Woche) | 2; 4.2 | `Week` | Woche; im Titel «Arbeitsplan» | Blatt, Seite (für die Woche) |
| Stufe | 2; 4.9 | `PlanLevel = 'kp' \| 'bat'`, Feld `level` | Stufe: «Kp», «Bat» | Ebene |
| Vorlage (Stufe) | 2; 4.9 | `LevelTemplate` | Vorlage | Profil, Schema |
| Spalte | 2; 4.4 | `Column`, Feld `kind: 'planning' \| 'secondary' \| 'rap' \| 'beso'` | Spalte | Bahn (für Spalte) |
| Planungsspalte | 4.4 | `Column` mit `kind: 'planning'` | Planungsspalte | – |
| Nebenspalte | 2; 4.4 | `Column` mit `kind: 'secondary'` | Nebenspalte; Kopf gemäss Vorlage «Det» bzw. «Stab 2» | Zusatzspalte |
| Rap-Spalte | 2; 4.4 | `Column` mit `kind: 'rap'` | Rap-Spalte; Kopf «Rap» | Rapportspalte |
| Beso-Spalte | 2; 4.4 | `Column` mit `kind: 'beso'` | Beso-Spalte; Kopf «Beso» bzw. «Bes» | – |
| Block | 2; 4.6 | `Block` | Block | Termin, Kasten |
| Querbalken | 2; 4.6 | `Querbalken` | Querbalken | Balken, Banner |
| Marker | 2; 4.6 | `Marker`, Art `MarkerKind = 'AV' \| 'ABV' \| 'HV' \| 'custom'` | Marker; Art «AV», «ABV», «HV», «frei» | Linie |
| Rapport | 2; 4.6 | `Rapport`, Kürzel `code` | Rapport; Kürzel | Meeting |
| Beso | 2; 4.6 | `Beso` | Beso | Besonderes, Termin |
| Termine (Bereich) | 2; 4.8 | Layout `layoutAgenda()`, Bereich `WeekPageLayout.regions.agenda`; Überschrift `LevelTemplate.agendaHeading` | Kp «Termine», Bat «Termindetails» (gemäss Vorlage) | Fussnoten |
| Leitungskategorie | 2; 4.7 | `LtgCategory`, Felder `categoryId`, `secondCategoryId` | Leitungskategorie, kurz «Kategorie» | Farbe, Leitung (allein) |
| Ltg | 2 | Feld `ltg` | Ltg | Leitung, Verantwortlich |
| Tn | 2 | Feld `tn` | Tn | Teilnehmende |
| Tpt | 2 | Feld `tpt` | Tpt | Treffpunkt (ausgeschrieben nur im Tooltip) |
| Stand | 2; 5.5 | Feld `Plan.stand` (`{ date, version }` oder null), Eingabe `StandInput`, Befehl `setNewStand()` | Stand; Befehl «Neuen Stand setzen» | Version (allein), Release |
| Beilage | 2; 4.1 | Feld `beilage` | Beilage | Anhang |

## Weitere Fachbegriffe

### Plan, Woche, Tag

| Begriff (Beschrieb) | Stelle | Code | Oberfläche | Nicht verwenden |
| --- | --- | --- | --- | --- |
| Einheit | 4.1 | Feld `unit` | Einheit | – |
| Übergeordnete Einheit | 4.1 | Feld `parentUnit` | Übergeordnete Einheit | – |
| Dienst | 4.1 | Feld `service` | Dienst | – |
| Übungsname | 4.1 | Feld `exerciseName` | Übungsname | – |
| Klassifizierung | 4.1 | Feld `classification` | Klassifizierung | Geheimhaltung |
| Standort (Sonnenzeiten) | 4.1; 4.8 | Feld `sunLocation` | Standort | Ort (Ort ist ein Eintragsfeld) |
| Kommandant | 4.1 | Feld `commander` (`Commander` mit `nameOrder`) | Kommandant | – |
| Unterschriftblock | 10 | Felder `commander`, `signatureImage`, `signatureEnabled` (kein eigener Typ) | Unterschrift | – |
| Wappen | 4.1 | Feld `coatOfArms` | Wappen | Logo |
| Motto | 4.1 | Feld `motto` | Motto | Slogan |
| Personenliste | 4.1 | Feld `persons: Person[]` | Personenliste | Personalliste (so heisst die Quelldatei mit Personendaten) |
| Person (Grad, Name, Vorname, Funktion) | 4.1 | `Person` mit `grad`, `name`, `vorname`, `funktion` (Suite) | Grad, Name, Vorname, Funktion | Rang |
| Versionsnummer | 4.1; 5.5 | Feld `stand.version` | Version | – |
| Bezeichnung (Woche) | 4.2 | Feld `label` | Bezeichnung | Titel (Titel ist ein Eintragsfeld) |
| Kurzname | 4.2 | Feld `shortName` | Kurzname | – |
| Startdatum | 4.2 | Feld `startDate` (ISO-Datum, Montag) | Startdatum | – |
| KW | 4.2 | Funktion `isoWeek()` | KW | Woche Nr |
| Wochenziele | 4.2 | Feld `weekGoals` (`WeekGoal`), Bat mit `group` | Wochenziele | Ziele |
| Erhöhte Bereitschaft | 4.2 | Feld `heightenedReadiness` | Erhöhte Bereitschaft | – |
| Tag | 4.3 | `DayConfig` (Feld `days` der `Week`), Wochentag `Weekday = 'Mo' \| 'Di' \| 'Mi' \| 'Do' \| 'Fr' \| 'Sa' \| 'So'` | Mo … So; ausgeschrieben Montag … Sonntag | – |
| Darstellung (Tag) | 4.3 | `DayDisplay = 'full' \| 'compact' \| 'hidden'` | Darstellung: «voll», «kompakt», «ausgeblendet» | Ansicht, verborgen |
| Spaltensatz | 4.4 | `ColumnSet` | Spaltensatz | Spaltenvorlage, Layout |
| Gewicht (Spalte) | 4.4 | `ColumnWeight = 'narrow' \| 'normal' \| 'wide'` | Breite: «schmal», «normal», «breit» | – |
| Beschriftung waagrecht/senkrecht | 4.4 | `labelOrientation: 'horizontal' \| 'vertical'` | «waagrecht», «senkrecht» | horizontal, vertikal |
| Herkunft (Spalte) | 4.4 | `origin: 'manual' \| 'detachementsplaner'` | Herkunft: «frei», «Detachementsplaner» | – |
| Bahn (Beso-Spalte) | 4.4; 4.6 | Layout `ColumnGeometry.lanes` (Beso-Spalte: 2 Bahnen) | Bahn | Spur |
| Tagesbefehl-Zusatzangaben | 4.3; 9.2 | Feld `tagesbefehlInfo` am `DayConfig` | «Angaben für den Tagesbefehl» | – |

### Zeit

| Begriff (Beschrieb) | Stelle | Code | Oberfläche | Nicht verwenden |
| --- | --- | --- | --- | --- |
| Zeitraster | 4.5 | `TimeGrid` | Zeitraster | – |
| Anzeigebereich | 4.5 | Feld `displayRange` (`{ from, to }` in Minuten) | Anzeigebereich | Zeitfenster (ist Beso-Begriff) |
| Band (Querbalken) | 4.5 | Layout `GridLayout.band`: die erste Stunde des Anzeigebereichs, Standard 0400–0500, kein eigener Streifen (F-02 in der Fassung von B-F-06; R-4.5-07; anderer Anzeigebereich: F-63) | Band für Querbalken | Kopfzeile, Streifen |
| Einrasten | 4.5; 5.1 | Funktion `snap()` | – (Verhalten) | – |
| Zeitform | 4.6 | `TimeForm = 'point' \| 'range' \| 'from' \| 'until' \| 'deadline'` (= `TimeSpec['form']`; Zeitangabe `TimeSpec`) | Zeitform: «Zeitpunkt», «von–bis», «ab», «bis», «Frist» | – |
| Zeitpunkt | 4.6 | `TimeForm 'point'` | Zeitpunkt | – |
| von–bis | 4.6 | `TimeForm 'range'` | von–bis | – |
| ab X | 4.6 | `TimeForm 'from'` | ab | – |
| bis X | 4.6 | `TimeForm 'until'` | bis | – |
| Frist mit Datum | 4.6 | `TimeForm 'deadline'` | Frist | Deadline |
| Sortierzeit | 4.6 | Funktion `sortTime()` | – (intern) | – |
| Über Mitternacht (Fortsetzung) | 4.5 | Modell: `TimeSpec` `'range'` mit `to > 1440`; Layout `EntryGeometry.continuation` (`'fromPreviousDay' \| 'toNextDay'`) | «Fortsetzung vom Vortag» | – |
| Zeitangabe (militärisch) | 11 | `MilTime` (Minuten seit 0000), Formatierung `formatMilTime()` | 0700, 1300-1600 | 07:00 (ausser Speicher-Anzeige «gespeichert hh:mm», R-5.6-02) |

### Einträge

| Begriff (Beschrieb) | Stelle | Code | Oberfläche | Nicht verwenden |
| --- | --- | --- | --- | --- |
| Eintrag | 4.6 | `Entry` (Vereinigung aller Typen) | Eintrag | Element, Objekt |
| Eintragstyp | 4.6 | `EntryType = 'block' \| 'querbalken' \| 'marker' \| 'rapport' \| 'beso' \| 'dayRemark' \| 'multiDayRemark'` | Typ | – |
| Titel | 4.6 | Feld `title` (`RichText`: Liste von `TextRun { text, bold, besoRef? }`) | Titel | Name, Bezeichnung |
| Zusatz | 4.6 | Feld `supplement` | Zusatz | Untertitel |
| Ort | 4.6 | Feld `ort` (wie Suite `Detachment.ort`) | Ort | Location |
| Tenue | 4.6 | Feld `tenue` | Tenue | Anzug |
| Häkchen «drucken» (Tn, Tenue) | 10 | Felder `printTn`, `printTenue` | «drucken» | – |
| Textrichtung | 4.6; 6 | `textDirection: 'auto' \| 'horizontal' \| 'vertical'` | Textrichtung: «automatisch», «waagrecht», «senkrecht» | Ausrichtung |
| Offenes Ende | 4.7 | Feld `openEnd` | Offenes Ende | – |
| Gemeinsame Leitung | 4.7 | `secondCategoryId` gesetzt | Gemeinsame Leitung | Mischfarbe |
| Interne Notiz | 4.6; 6 | Feld `internalNote` (an `Entry` und `DayConfig`) | Interne Notiz | Kommentar, Bemerkung |
| Zeitfenster (Beso) | 4.6 | `BesoTimeWindow` mit `id`, `time`, `columnId` (oder null), `supplement`; Feld `windows` am `Beso` | Zeitfenster | Slot |
| Beso-Kästchen | 4.6 | Layout-Ergebnis ohne eigenen Typ: Zeitspanne `besoBoxSpan()`, Vorlage `LevelTemplate.besoBox` | Kästchen | Box |
| Beso-Nummer | 5.3 | Feld `besoNumber`, `numberFixed` | Nr | ID, Fussnote |
| Nummernkreis | 5.3 | Funktion `numberRange(weekday)` | Nummernkreis | – |
| Tag neu nummerieren | 5.3 | Befehl `renumberDay` | «Tag neu nummerieren» | – |
| Verweis auf Beso-Nummer | 5.3 | Feld `besoRef` eines `TextRun` im Titel; setzen `linkBesoRefs()`, auflösen `resolveTitle()` | – (Anzeige «(21)») | – |
| Terminzeile | 4.8 | Funktion `agendaLine()`, je Datum `agendaLinesForDate()` (Typ `AgendaLine`), Freitext `agendaOverride` | Terminzeile; «Freitext» | Fussnote |
| Ganztägige Bemerkung | 4.6 | `DayRemark` | Ganztägige Bemerkung | Notiz |
| Mehrtägige Bemerkung | 4.2; 4.6 | `MultiDayRemark` mit `scope: RemarkScope` (`{ kind: 'plan' }` = gilt für den ganzen Plan, F-38) | Kp «Bemerkung»; Bat «Mehrtägige Bemerkung» | – |
| Verweis-Kästchen | 4.2; 4.6 | Feld `refBoxColumnId` an `MultiDayRemark` | Verweis-Kästchen | – |
| Rapport-Anzeige | 4.6 | Feld `display` am `Rapport`, Typ `RapportDisplay = 'rapColumn' \| 'alsoInColumns' \| 'onlyInColumns'`; Spalten `displayColumns` | Anzeige: «nur Rap-Spalte», «auch in Spalten», «nur in Spalten» | – |
| Ausnahme (Aussparung) | 4.6 | abgeleitet, kein Feld im Modell; Layout: Teilstücke `EntryGeometry.pieces` | Ausnahme | Loch |
| Teilstück | 4.6 | Layout `EntryGeometry.pieces`, Teilstück mit Text `textPiece` | – | – |
| Verknüpfte Teilblöcke | 4.6 | ein `Block` mit `columns: ColumnSelection` (`kind: 'ids'`, nicht benachbarte Spalten-IDs; ADR-002 Punkt 5); kein eigenes Gruppenfeld | «verknüpft» | – |
| Status | 4.6 | `EntryStatus = 'confirmed' \| 'open' \| 'cancelled'` | Status: «bestätigt», «offen», «gestrichen» | storniert, gelöscht |
| Markierung «geändert» | 4.6 | Feld `changed` | «geändert» | modifiziert |
| Feldwert «offen» | 6; 10 | Konstante `OPEN_VALUE = 'offen'` | «offen» | TBD |
| Entfernter Textteil | 8.2; 10 | `removedText` | – (Darstellung rot durchgestrichen) | – |
| Quelle (übernommener Eintrag) | 8.3 | Feld `sourceRef` | Quelle | – |
| Lokal geändert (Tagesablauf) | 5.4 | Feld `localOverride` | «lokal geändert» | – |

### Legende, Vorlagen, Listen

| Begriff (Beschrieb) | Stelle | Code | Oberfläche | Nicht verwenden |
| --- | --- | --- | --- | --- |
| Legende | 4.7 | Feld `legend` (Liste von `LtgCategory`) an `Plan` und `LevelTemplate` | Legende (Kp-Überschrift der Kürzelliste siehe unten) | Farbschema |
| Neutrale Kategorie | 4.7 | `LtgCategory` mit `neutral: true` | neutral | – |
| Legendenbeschriftung | 4.7; 10 Seitenleiste; B-F-05 | Feld `legendLabel` von `LtgCategory`; vorbelegt aus der Vorlage (Kp: «Leitung Bat», «Leitung Kp», «Leitung Zfhr», «Extern», «Ltg S2»), frei änderbar; der Kategoriename (`name`, z.B. «Ltg Bat») bleibt davon unberührt (R-4.7-05, R-10-24) | «Beschriftung in der Legende» | Kategoriename (für die Beschriftung) |
| Funktionsliste | 4.7 | Feld `functionList` mit `FunctionEntry { code, categoryId, singleFunction }` (Vorlage: `TemplateFunctionEntry` mit `categoryName`) | Funktionsliste | Rollenliste |
| Einzelfunktion | 4.7; P5 | Feld `singleFunction` | Einzelfunktion | – |
| Abkürzungsliste / Kürzelliste | 4.7 | Feld `abbreviationsSelected` (gewählte Kürzel), Kürzel der Woche `abbreviationsForWeek()`, Überschrift `LevelTemplate.abbreviationHeading` | Kp «Legende», Bat «Abkürzungen» (Überschrift gemäss Vorlage); in Einstellungen «Kürzelliste» | Glossar |
| Tagesablauf | 5.4 | `DayRoutine` | Tagesablauf | Tagesvorlage, Routine |
| Plan-Vorlage | 5.4 | Befehl `createPlanFromPlan` | «Plan als Vorlage» | Kopie |
| Auf Vorlage zurücksetzen | 5.4 | Befehl `resetToRoutine` | «Auf Vorlage zurücksetzen» | – |
| Bausteine | 6 | `Snippet` | Bausteine | Vorlagen (Wort ist belegt) |
| Wörterbuch (P12) | 7 | `SpellingDictionary` mit Ausnahmen `exceptions` | Wörterbuch | – |
| Liste der Bat-Dokumente (P13) | 7 | `BatDocumentList` | Bat-Dokumente | – |
| Sonnenzeiten | 4.8 | Feld `sunOverride` der `Week` mit `sunrise`, `sunset` | Sonnenaufgang, Sonnenuntergang | – |

### Prüfungen, Speicher, Ausgabe

| Begriff (Beschrieb) | Stelle | Code | Oberfläche | Nicht verwenden |
| --- | --- | --- | --- | --- |
| Prüfung / Prüfregel | 7 | `RuleId = 'P1'` … `'P19'`, Stufe je Regel `RULE_SEVERITY`, Lauf `runChecks()` | Prüfung; Regel «P1» | Validierung |
| Befund | 7 | `Finding` | Befund | Fehler (für alle Stufen), Issue, Warnung (für alle Stufen) |
| Stufe (Befund) | 7 | `FindingSeverity = 'error' \| 'warning' \| 'hint'` | «Fehler», «Warnung», «Hinweis» | Stufe (ohne Zusatz, Verwechslung mit Bat/Kp) |
| Quittieren | 7 | Befehl `acknowledgeFinding`, Feld `acknowledged` | «quittieren»; Liste «quittiert» | ignorieren |
| Rückfallregel | 10 | Layout `FallbackEvent` mit `FallbackKind` | – (Befund P8) | – |
| Mindestschriftgrösse | 10 | Feld `fontSizes.min` der `LevelTemplate` (`FontSizes`, pt) | Mindestgrösse | – |
| Fortsetzungsseite | 10 | `FallbackKind 'continuationPage'`; Seiten in `WeekPageLayout.pages` | «Fortsetzung – \<Woche\>» | – |
| Seitenleiste (PDF) | 10 | Layout `layoutSidebar()`, Bereich `WeekPageLayout.regions.sidebar` | Seitenleiste | – |
| Seitenfeld (Bildschirm) | 5.1 | `DetailPanel` | Seitenfeld | Inspektor, Eigenschaften |
| Detail beim Überfahren | 6 | `HoverDetail` | – (Tooltip) | – |
| Hauptansicht / Wochenraster | 5 | Komponente `GridArea` | Wochenraster | Kalender |
| Mehrfachauswahl | 5.1 | `Selection` mit `kind: 'entries'` (Vertrag E1-11); Rahmen nur mit Shift+Ziehen, Ziehen ohne Taste erzeugt einen Eintrag (Q-009 K-1, R-5.1-20) | Mehrfachauswahl; Hilfe: «Shift+Ziehen: Rahmen» | Lasso |
| Listenansicht | 6 | `ListView` | Listenansicht | Tabelle (allein) |
| Schnelleingabe | 6 | `QuickEntry` | Schnelleingabe | Kommandozeile |
| Autovervollständigung | 6 | `autocomplete` | Vorschlag | – |
| Planübersicht | 6 | `PlanOverview` | Planübersicht | – |
| Zug-Auszug | 6; 10 | `ColumnExtract` | Zug-Auszug | – |
| Pendenzenliste | 6 | `PendingList` | Pendenzen | To-do |
| Filtern und Hervorheben | 6 | `highlightFilter` | Filter | – |
| Änderungsvergleich | 6 | `StandComparison` mit `'new' \| 'changed' \| 'cancelled'` | Vergleich: «neu», «geändert», «gestrichen» | Diff |
| Änderungen markieren | 10 | PDF-Option `markChanges` | «Änderungen markieren» | – |
| Status-Darstellung (rot) | 10 | PDF-Option `showStatus`; Rot = #c00000 in PDF und Bildschirm (Q-009 UI-F-1, R-10-27) | «Status rot darstellen» | – |
| Heute-Ansicht | 6 | `TodayView` | Heute | – |
| Schwarz-Weiss-Druck | 6 | PDF-Option `monochrome` | Schwarz-Weiss | Graustufen |
| Dateiname nach Konvention | 6 | Funktion `pdfFileName()` | – | – |
| Plan-Datei | 5.5; 11 | `PlanFile` mit `format`, `version` (`PLAN_FILE_FORMAT`, `PLAN_FILE_VERSION`) | Plan-Datei | Projektdatei, Backup |
| Plan-Datei öffnen (Befehl) | 5.6; Vertrag E1-11 | Befehl `app.files.openFile` (Ctrl+O): Datei wählen, `compareWithLocal()`, bei vorhandenem lokalem Plan Konfliktdialog | Menü «Plan-Datei öffnen …», Erststart-Karte «Plan-Datei öffnen»; Titel des Konfliktdialogs «Plan-Datei öffnen» (Optionen «Behalten», «Ersetzen», «Als Kopie öffnen») | Import (für die Plan-Datei), Laden |
| Plan-Datei öffnen (neu auf diesem Gerät) | 5.6; ADR-006 Punkt 2e; Vertrag E1-04 | Store-Methode `openFromFile()`; nur wenn `compareWithLocal()` `'noLocal'` ergibt: Plan neu auf diesem Gerät, Plan-ID und Revision aus der Datei, Stände der Datei sichtbar und ungekoppelt | «Plan-Datei öffnen (neu auf diesem Gerät)» | – |
| Ersetzen (Plan-Datei) | 5.6; ADR-006 Punkt 2b, 2e; Vertrag E1-04 | `replaceFromFile()`; nur bei vorhandenem lokalem Plan mit gleicher Plan-ID (Konfliktdialog «Plan-Datei öffnen»): Punkt `fileReplace`, dann Ersetzen als Historienschritt (rückgängig machbar), danach genau die Stände der Datei sichtbar | «Ersetzen» | Überschreiben |
| Als Kopie öffnen | 5.6; ADR-002 Punkt 8b; Vertrag E1-04 | `importAsCopy()`; neuer Plan mit neuer Plan-ID, Eintrags-IDs bleiben, Stände der Datei mit neuen IDs; der lokale Plan bleibt unverändert | «Als Kopie öffnen» | Duplizieren |
| Datei-Sicherung | 5.6 | Befehl `app.files.saveToFile`, Feld `lastFileSaveAt` | «Datei sichern»; «letzte Datei-Sicherung vor X Tagen» | Export (für Sicherung) |
| Lokaler Speicher | 5.6 | `PlanStore` (`openPlanStore()`) | lokaler Speicher | Cache |
| Speicherfehler | 5.6; Vertrag E1-04 | `StorageError` (Unterklasse von `WapError`, Feld `code`) | – (Meldung mit Ursache und nächstem Schritt) | – |
| Konflikt beim Stand-Setzen oder Import | ADR-006 Punkt 2a (AR0-25, AR0-40); R-L-08, R-5.6-05 | `StorageError` mit `code: 'conflict'`; gilt für jede Revisionsabweichung bei `commitAtomic` (bei «Neuen Stand setzen» R-L-08, beim Import R-5.6-05) | Titel: «Stand nicht gesetzt – Plan wurde geändert»; Meldungstext (Vertrag E1-05): «Der Plan wurde während des Stand-Setzens geändert. Kein Stand gesetzt; die Änderung ist gespeichert. Stand erneut setzen.» (beim Import sinngemäss mit nächstem Schritt «Import erneut starten») | – |
| Update gescheitert | ADR-006 Punkt 2c | `StorageError` mit `code: 'migrationFailed'` (`details.planName`) | Titel: «Update gescheitert»; Meldungstext (UI-Richtlinie 12): «Die Pläne wurden nicht ins neue Format umgestellt. Die Umstellung brach bei «‹Plan›» ab; alle Pläne sind unverändert im bisherigen Format. Seite neu laden (F5). Hilft das nicht: mit der vorherigen Version des WAP-Planers weiterarbeiten und die gesicherte Plan-Datei öffnen.» Knopf «Neu laden» | Migrationsfehler |
| Gelöschte Pläne | ADR-006 Punkt 2b; Vertrag E1-04 | `listDeletedPlans()` (Pläne mit Punkt `planDelete` der letzten 30 Tage), wiederherstellen mit `restoreDeletedPlan()`; besteht lokal inzwischen ein Plan mit derselben Plan-ID (z.B. per `openFromFile`), wird als Kopie mit neuer Plan-ID wiederhergestellt (Rückgabe `asCopy: true`, Meldung gemäss E1-11), der vorhandene Plan bleibt unverändert (AR0-51) | Abschnitt «Gelöschte Pläne» im Dialog «Wiederherstellungspunkte» (je Plan Name, gelöscht am, «Wiederherstellen»); Zugang auch über den Erststart-Link «Gelöschte Pläne (‹n›) …» (Vertrag E1-11) | Papierkorb |
| Wiederherstellungspunkt | 5.6 | `RestorePointInfo` mit `reason: RestoreReason` | Wiederherstellungspunkt | Snapshot, Backup |
| Grund (Wiederherstellungspunkt) | 5.6; ADR-006 Punkt 1, 2b, 2c | `RestoreReason = 'daily' \| 'import' \| 'adoption' \| 'stand' \| 'migration' \| 'restore' \| 'fileReplace' \| 'planDelete'` | «täglich», «vor Import», «vor Übernahme», «vor Stand V‹n›», «vor Update», «vor Wiederherstellung», «vor Ersetzen», «vor Löschen» | – |
| Stand-Aufzeichnung | 5.5; ADR-002 Punkt 6; ADR-006 Punkt 1 | `StandRecord` mit `recordId` (Schlüssel), `standId`, Dokument-Schnappschuss `plan` und PDF-Bytes `pdfs` der garantierten Varianten, `seq` (einblendender Historienschritt; 0 = ungekoppelt) und `hiddenBySeq` (ausblendender Schritt oder null); Sichtbarkeit wird nicht gespeichert, sondern mit `isRecordVisible(history, record)` berechnet (Verträge E1-04, E1-05; AR0-45, AR0-55); Speicherbereich `stands` | – (sichtbar als «Stand V‹n›» in Stand-Liste und Export) | Snapshot, Version (allein) |
| Importbericht (gespeichert) | 8.2; ADR-002 Punkt 8a; ADR-006 Punkt 1 | `ImportReportRecord` mit `planId`, `seq` (Import-Historienschritt, ≥ 1) und `report` (`ImportReport`); Sichtbarkeit wird nicht gespeichert, sondern mit `isStepApplied(history, seq)` berechnet (Vertrag E1-04; AR0-55); Speicherbereich `importReports`; nicht Teil von Dokument und Plan-Datei | Importbericht | Log, Protokoll |
| Rückgängig / Wiederholen | 5.6 | `undo`, `redo`, `HistoryState` mit `HistoryStep` | «Rückgängig», «Wiederholen» | Undo |
| Erststart | 5.7 | `FirstRunView` | – (Titel «WAP-Planer») | – |
| Weitergabe | 8.1 | Befehl `exportForSharing` | «Zur Weitergabe exportieren» | Veröffentlichen |
| Referenz (andere Stufe, schreibgeschützt) | 8.1 | `ReferencePlan`, Feld `readOnly` | «Referenz (schreibgeschützt)» | – |

### Import, Übernahme, Suite

| Begriff (Beschrieb) | Stelle | Code | Oberfläche | Nicht verwenden |
| --- | --- | --- | --- | --- |
| Excel-Import | 8.2 | Modul `src/io/wap-import/`, `runImport()` (mit Speicher), `importKpWorkbook()` (rein) | «Excel-WAP importieren» | Upload |
| Importbericht | 8.2 | `ImportReport` mit Einträgen `ImportReportItem` | Importbericht | Log, Protokoll |
| Form (Excel) | 8.2 | `WapShape` | Form | Shape |
| Nicht zugeordnete Form | 8.2 | `ImportReportKind 'unassignedShape'`, Anzahl `SheetBalance.unassigned` | «nicht zugeordnet» | – |
| Übernahme | 8.3 | `Adoption` | Übernahme | Import (für Übernahme) |
| Übernahme-Assistent | 8.3 | `AdoptionWizard` | Übernahme-Assistent | – |
| Entscheid pro Eintrag | 8.3 | `AdoptionDecision = 'adopt' \| 'ignore' \| 'later'` | «übernehmen», «ignorieren», «später» | – |
| Vorauswahl | 8.3 | `preselect()` | Vorauswahl | – |
| Bat-Ebene | 8.3 | `BatLayer` | Bat-Ebene | Overlay |
| Neue Bat-Version | 8.3 | `BatVersionDiff` | «Neue Bat-Version» | – |
| Nachführen | 8.3 | Befehl `applyBatChange` | «nachführen» | synchronisieren |
| Detachementsplaner | 9.1 | Modul `detachementsplanerLink` | Detachementsplaner | – |
| Zug / Element | 9.1 | `Person.zug` (Suite) | Zug / Element | – |
| Detachement | 9.1 | `Detachment` (Suite) | Detachement | Det (nur als Spaltenname) |
| Tagesbefehl | 9.2 | Modul `tagesbefehlDelivery` | Tagesbefehl | – |
| An Tagesbefehle übergeben | 9.2 | Befehl `deliverToTagesbefehl` | «An Tagesbefehle übergeben» | exportieren |
| Tagesbefehl veraltet | 9.2 | Feld `tagesbefehlStale` (abgeleitet aus `lastDeliveryAt`) | «Tagesbefehl veraltet» | – |

## Festgelegte Werte

| Bereich | Code | Oberfläche |
| --- | --- | --- |
| Wochentage | `'Mo' 'Di' 'Mi' 'Do' 'Fr' 'Sa' 'So'` (wie `TbWeekday`) | Mo … So; Tageskopf voll ausgeschrieben gemäss Anhang B-Kp |
| Nummernkreise | `numberRange('Mo') = 10..19` … `('So') = 70..79` | – |
| Marker-Arten | `'AV' 'ABV' 'HV' 'custom'` | AV, ABV, HV, frei |
| Rapportkürzel (Beispiele) | Zeichenkette wie erfasst (`'KR' 'DR' 'AR1' 'AR2' 'ARK' 'BR 1' 'SR'`) | gleich |
| Kategorien Kp (Vorgabe) | Legendeneinträge mit Namen wie Oberfläche | Ltg Bat, Ltg Kp, Ltg Zfhr, Extern, Ltg S2, neutral |
| Kategorien Bat (Vorgabe) | dito | Ltg Kp, Ltg Bat, Ltg Externe (Schreibweise F-39) |

## Änderungsnotiz

**02.10.2026 · Quelle E1-02a-02** (Befund des `architect` E1-02a; Vertrag E1-02a §1, §7, §8 P-1 sowie Verträge E1-02d, E1-02e, E1-03, E1-04, E1-05, E1-06, E1-07, E1-08, E1-11, E1-14). Nur die Spalte «Code» und die Beispiele der Namensregel 4 geändert; Begriffe, Oberflächentexte und verbotene Synonyme unverändert.

- Namensregel 4: Beispiele `standDate`, `querbalkenBand` (in keinem Vertrag) ersetzt durch `besoRef`, `printTenue`.
- Leitungskategorie, Gemeinsame Leitung, Funktionsliste: `category`/`secondCategory` → `categoryId`/`secondCategoryId` (Felder halten IDs); Funktionsliste `FunctionList` → Feld `functionList`, Vorlage `TemplateFunctionEntry`.
- Stand, Versionsnummer: `standDate`/`standVersion` → `Plan.stand` mit `date`/`version`; `StandInput`, `setNewStand()`.
- Tag, Interne Notiz, Tagesbefehl-Zusatzangaben: `Day` → `DayConfig`.
- Titel, Verweis auf Beso-Nummer: `BesoRef` → `TextRun.besoRef` in `RichText`; dazu `linkBesoRefs()`, `resolveTitle()`.
- Rapport-Anzeige: `rapportDisplay` → Feld `Rapport.display` vom Typ `RapportDisplay`.
- Zeitform: `TimeForm = TimeSpec['form']` vermerkt (E1-02a P-1); Terminzeile: `agendaLinesForDate()`, `AgendaLine` ergänzt.
- Kommandant `Commander`; Unterschriftblock `SignatureBlock` → `signatureImage`, `signatureEnabled`; Wochenziele `WeekGoal`; Sonnenzeiten `Week.sunOverride`; Zeitfenster `BesoTimeWindow` mit `id`, `columnId` (oder null), `supplement`; Mehrtägige Bemerkung `scope: RemarkScope`; Legende Feld `legend`; Kürzelliste `AbbreviationList` → `abbreviationsSelected`, `abbreviationsForWeek()`, `abbreviationHeading`; Termine `AgendaArea` → `layoutAgenda()`, `agendaHeading`.
- Layout: Bahn `lane` → `ColumnGeometry.lanes`; Band `querbalkenBand` → `GridLayout.band`; Über Mitternacht `continuesNextDay` → `TimeSpec` mit `to > 1440` und `EntryGeometry.continuation`; Ausnahme `cutout`/`exception` → abgeleitet, `EntryGeometry.pieces`; Teilstück `BlockPiece` → `pieces`, `textPiece`; Beso-Kästchen `BesoBox` → `besoBoxSpan()`, `LevelTemplate.besoBox`; Rückfallregel `fallback` → `FallbackEvent`, `FallbackKind`; Fortsetzungsseite `ContinuationPage` → `FallbackKind 'continuationPage'`; Seitenleiste `Sidebar` → `layoutSidebar()`; Mindestschriftgrösse `MIN_FONT_SIZE_PT` → `LevelTemplate.fontSizes.min`.
- Prüfung `CheckRule` → `RuleId`, `RULE_SEVERITY`, `runChecks()`; Wochenraster `WeekGrid` → `GridArea`.
- Speicher: `LocalStore` → `PlanStore`; `RestorePoint` → `RestorePointInfo`; `History` → `HistoryState`, `HistoryStep`; Plan-Datei `formatVersion` → `PlanFile.format`, `.version`; `lastFileSave` → `lastFileSaveAt`, Befehl `app.files.saveToFile`.
- Import: `wapImport`/`importExcel` → `src/io/wap-import/`, `runImport()`, `importKpWorkbook()`; Form `SourceShape` → `WapShape`; `unassignedShapes` → `ImportReportKind 'unassignedShape'`, `SheetBalance.unassigned`.

**06.10.2026 · Quelle Katalog-Änderungsnotiz I2** (`spec-analyst`, im Auftrag des Orchestrators; Gate S A1, A2, S-4 V-02e-4; `requirements.md` «Änderungsnotiz I2 nach Gate S»). Die vier Begriffe sind neu, bestehende Einträge bleiben unverändert.

Die Code-Namen sind Vorschläge für die Verträge E1-02h und E1-08:
- `Block.subtasks` sowie `meaning` und `abbreviationMeanings` stammen aus dem Plan, Notiz Gate S / I2 1.2.
- Die Berichtsarten sind neu, im Muster der bestehenden Arten von `ImportReportKind`.

Weicht ein Vertrag ab, gilt der Vertrag; das Glossar wird dann nachgeführt.

Nachgeführt am 06.10.2026 nach der Katalogprüfung Runde 1 (SA-K-I2-11):
- Bei «Teilaufgabe» ist «Subtask» nur in der Oberfläche verboten.
- Die Schwellen bei «verdeckt» und «teilweise verdeckt» sind als Arbeitsannahme Q-044 (d) gekennzeichnet.

Nachgeführt am 06.10.2026 nach der Vertragsprüfung E1-02h (CR-E102h-V09; Vertrag E1-02h K-2, 3b, 4a):
- **Teilaufgabe:**
  - `Subtask.ltg` und `Subtask.ort` sind Pflichtfelder mit `''` für leer, wie bei `Block`. Fachlich bleiben sie optional (Q-045 (g)). Damit ist die frühere Angabe «`ort` (optional)» ersetzt.
  - Befehlsmodul `src/model/wap/commands/subtasks.ts` mit den Befehlen `addSubtask`, `updateSubtask`, `moveSubtask` und `removeSubtask`.
  - Eingabetypen: `SubtaskDraft` (Titel; `ltg` und `ort` optional, fehlend = `''`) und `SubtaskChanges` (`Partial<Subtask>`).
- **Kürzelbedeutung:**
  - Gelesen wird über `abbreviationMeaning(plan, code, template)` in `src/model/wap/derive/`. Eine eigene, nicht leere Bedeutung des Plans geht vor, sonst gilt die Vorlage, sonst `''`.
  - Die Bedeutungen der Vorlage werden nicht in den Plan kopiert (V-02h-3, Arbeitsannahme Q-046).

| Begriff (Beschrieb) | Stelle | Code | Oberfläche | Nicht verwenden |
| --- | --- | --- | --- | --- |
| Teilaufgabe | Gate S A1; R-4.6-63 bis R-4.6-66, R-5.1-25, R-6-41, R-6-42, R-8.2-37, R-8.2-38, R-9.2-08, R-10-47 bis R-10-49 | Typ `Subtask` mit `title` (`RichText`), `ltg`, `ort` (Pflichtfelder, `''` = leer; früher «`ort` (optional)», ersetzt am 06.10.2026); Feld `Block.subtasks` (fehlt, wenn leer); Befehle in `commands/subtasks.ts` mit `SubtaskDraft`, `SubtaskChanges` | Teilaufgabe, Mehrzahl Teilaufgaben (Spalte und Tabelle «Teilaufgaben») | Unteraufgabe, Unterpunkt, Subtask (Oberfläche; im Code ist `Subtask` der Typ), Einrückung (Einzug/Stufe offen, Q-041) |
| Kürzelbedeutung | Q-033 V-02e-4; R-4.7-20 bis R-4.7-22, R-10-53 | Vorlage: Feld `meaning` in `TemplateRapportCode`; Plan: Feld `abbreviationMeanings` (Kürzel → Text; geht der Vorlage vor); gelesen mit `abbreviationMeaning(plan, code, template)` | Bedeutung (Spalte der Kürzelliste und Eingabefeld in den Einstellungen) | Beschreibung, Erklärung, Langform |
| verdeckt (Importbericht) | Gate S A2; R-8.2-39, R-8.2-42, R-8.2-43 | `ImportReportKind 'occludedShape'` (mindestens 99 % bedeckt, Arbeitsannahme Q-044 (d); kein Eintrag; zählt in `SheetBalance.unassigned`) | «verdeckt» | überdeckt (Überdeckung ist die Ausnahme-Regel für Blöcke, Beschrieb 4.6), versteckt, ausgeblendet |
| teilweise verdeckt (Importbericht) | Gate S A2; R-8.2-40, R-8.2-41 | `ImportReportKind 'partlyOccludedShape'` mit Anteil in ganzen Prozent (5 % bis unter 99 %, Arbeitsannahme Q-044 (d); Eintrag bleibt) | «teilweise verdeckt (‹n› %)» | halb verdeckt, überlagert (Überlagerung ist `'overlappingShapes'`, R-8.2-26) |
