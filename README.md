# Detachementsplaner · Einrückung & PISA

Eine lokale Browser-App für einen durchgehenden Ablauf: **Dienstleistung vorbereiten → mit PISA abgleichen → als Personenarchiv nachschlagen**. Die App arbeitet offline, ohne Server und ohne Datenbank.

## Start

`index.html` im Browser öffnen. Unter **Projekte & Archiv → Projektdatei öffnen** lassen sich bestehende JSON-Projekte laden. v2/v3-Projekte bleiben ladbar; neue Dateien verwenden v4. Personen und bisherige Zuteilungen werden erhalten. Mehrfachzuteilungen und ungeklärte Teilnahmeentscheidungen bleiben sichtbar, bis sie ausdrücklich geklärt werden.

## Arbeitsablauf

1. **Bestand laden und Detachemente bilden:** PISA und/oder MILOFFICE importieren, dann Detachemente mit Namen anlegen. Zuerst Spezialpersonen mit kombinierbaren Filtern (Grad, Funktion, Fahrausweis, Zug, Einheit, Quelle) auswählen. Mehrere Werte pro Feld gelten als ODER, unterschiedliche Felder als UND. Schnellfilter unterscheiden Fahrer gemäss Funktion von Fahrausweisinhabern. Anschliessend die übrigen Personen auf die Hauptdetachemente verteilen; «Alle übrigen hier zuteilen» berücksichtigt alle freien, nicht ausgeschlossenen Personen unabhängig von Suchfiltern. EC, Datum und Ort kommen später.
2. **Spezial- und Hauptdetachemente verbinden:** Beim besetzten Spezialdetachement das Hauptaufgebot wählen. Die App erzeugt eine separate Hauptgruppe mit Zusatz-MB und verschiebt die Spezialpersonen dorthin. Die übrigen Personen bleiben im bisherigen Hauptdetachement ohne Zusatz; der reine Zusatz hat keine direkten Personen. Die Vorschau zeigt diese drei Ergebnisse vor dem Speichern. Die neue Hauptgruppe übernimmt die Angaben der gewählten Hauptgruppe und benötigt einen eigenen EC. Werden die Hauptangaben erst später ergänzt, werden sie beim ersten Bearbeiten der noch leeren Zusatz-Hauptgruppe vorgeschlagen. Alte direkte Zuteilungen derselben Person zum Spezialdetachement und zum gewählten Hauptdetachement werden beim Verbinden einmalig in die neue Hauptgruppe übernommen. Andere direkte Zuteilungen, ausgeschlossene Personen oder fehlende Personendatensätze erscheinen mit konkretem Grund im Dialog und verhindern das Verbinden. Bestehende Verknüpfungen lassen sich weiterhin direkt ändern.
3. **Angaben ergänzen:** Erst jetzt EC, Einrückdatum/-zeit/-ort, Treffpunkt, Anzug, Entlassungsdatum/-ort und Bemerkung vervollständigen. Die Dienstleistung kann hier ebenfalls benannt werden. Offene Detailangaben werden in diesem Schritt geprüft.
4. **In PISA übernehmen:** Zuerst Detailangaben MB erfassen. Danach je Haupt-EC die Zusatz-EC auswählen und ausschliesslich die angezeigten direkten Personen hinzufügen; reine Zusatz-EC zeigen ausdrücklich null hinzuzufügende Personen. Angaben bei Bedarf kopieren und den tatsächlichen manuellen Abgleich bestätigen. Relevante Planänderungen machen die Bestätigung ungültig. Der abschliessende lokale Kontrollmarker ist erst möglich, wenn Teilnahme, Identitäten, Zuteilungen und EC vollständig geklärt sind.
5. **Archivieren und nachschlagen:** Ein separater lokaler Snapshot öffnet direkt die Personensuche. Ein unvollständiger Stand lässt sich ausdrücklich archivieren und bleibt als solcher erkennbar. Eine spätere Bearbeitung erstellt eine Arbeitskopie; der Archivstand bleibt erhalten.

Eine eindeutige Versicherten-Nr. verbindet Quellen; der optionale Namensabgleich verlangt eine anschliessende Identitätsprüfung. Neue Personen beginnen mit «Teilnahme klären». Eine ausdrückliche Zuteilung setzt «Einplanen». Bis zu fünf Zusatz-EC können für eine Hauptgruppe verknüpft werden.

Der Quellenbestand bestätigt keine Einrückungspflicht. DVM, KVK/WK-Sonderfälle, Genehmigung, Verarbeitung, Versand und Beilagen werden in PISA bzw. mit dem KF geprüft. Die App übermittelt nichts an PISA und erstellt keine amtlichen Marschbefehle. Das lokale Archiv ist kein PISA-Einheitsarchiv.

## Personen finden

Die Suche in der Kopfzeile durchsucht alle Personen im aktiven Projekt nach Name, Versicherten-Nr., Funktion, EC, Gruppe und Ort. `/` fokussiert die Suche. Treffer und Dossier stehen nebeneinander; bei null Treffern bleibt kein fremdes Dossier sichtbar.

Das Dossier zeigt Haupt-/Zusatz-MB mit Einrückungs- und Entlassungsdetails sowie dem manuellen Abgleichsstand. Ergänzende Personendaten, Begründung und Quelldaten folgen darunter. Drucken ist auch im Archiv verfügbar. Unter **Projekte & Archiv** kann nach einer Person über alle lokal archivierten Dienstleistungen gesucht werden.

## Sichern und exportieren

**Projekt sichern** erzeugt eine JSON-Datei. Weitere Exporte sind eine eigenständige HTML-App mit eingebetteten Daten, eine Excel-Arbeitsliste mit Personal, MB-Angaben und einer eigenen Tabelle «PISA-Zuteilungen» sowie eine Kontakt-CSV. Die Browserablage ist geräte- und browsergebunden; für eine unabhängige Sicherung eine Projektdatei herunterladen. Archiv-Speicherfehler werden angezeigt und überschreiben die bestehende Ablage nicht.

## Google-Kontakte vorbereiten

Unter **Google-Kontakte** stehen Namen, Telefonnummern, E-Mail-Adressen und Detachemente in einer Exportvorschau. Eingeplante Personen mit Kontaktdaten sind beim ersten Öffnen vorausgewählt. Suche und Filter für Detachement (einschliesslich Zusatzzugehörigkeit), Teilnahme und fehlende Kontaktdaten ändern die Anzeige, nicht die Auswahl. Die Übersicht zeigt auch ausgewählte Personen ausserhalb des aktuellen Filters.

Kontaktdaten lassen sich direkt korrigieren; Rohdaten und Zuteilungen bleiben erhalten. Optional werden Grad als Namenspräfix, ein gemeinsames Label und Detachemente als Labels exportiert. Fehlende Daten, auffällige Formate und mehrfach verwendete Kontaktangaben werden angezeigt; verschiedene Personen werden nicht automatisch zusammengeführt. Im Archiv ist nur die Auswahl und der Export möglich.

**Google-CSV herunterladen** erstellt ausschliesslich die ausgewählten Kontakte mit den aktuellen [Google-Spaltenüberschriften](https://support.google.com/contacts/answer/15147365?hl=de). In Google Kontakte über **Importieren → Datei auswählen** öffnen. Pro Datei sind höchstens 3000 Kontakte möglich. Die App lädt nichts zu Google hoch; Versicherten-Nummern, Planungsnotizen und MB-Details sind nicht enthalten. Die CSV bewahrt Umlaute, Anführungszeichen und Telefonnummern als Text. Bei alten Datensätzen ohne verlässlich getrennte Namen bleibt der vollständige Name erhalten und kann vor dem Export aufgeteilt werden.

## Entwicklung und Prüfung

Die Quellen liegen in `src/`, die verteilte App bleibt eine Datei:

```text
python tools/build_app.py
node tests/planner-model.cjs
python -m unittest discover -s tests -p "test_*.py"
```

Der Node-Test benötigt keine zusätzlichen Pakete und prüft Datenintegrität, Migration, Import, Haupt-/Zusatz-MB, Suchverhalten, veraltete Abgleichsmarker, Archivschutz, Speicherfehler und wiederholten HTML-Export. `tests/planner-workflow.cjs` ist ein kompatibler Einstiegspunkt in dieselbe Suite; es ist kein Browser-End-to-End-Test. Browserabläufe werden mit fiktiven Daten zusätzlich geprüft. Die [Entwurfsnotizen](docs/app-redesign.md) erläutern Entscheidungen und Grenzen.

Nach Änderungen an `src/` muss `index.html` neu gebaut werden. Der bestehende GitHub-Pages-Workflow veröffentlicht nach einem Push auf `main` ausschliesslich `index.html` und `.nojekyll`. Die App benötigt keine externen Assets. Lokale Projektdateien werden nicht veröffentlicht.

## PISA-Oracle

Das [PISA-Oracle](docs/pisa/README.md) ist die quellengebundene Wissensbasis zur PAT vom 12.02.2026, mit Regeln, Quellenverweisen, Widersprüchen und [Planer-Abgleich](docs/pisa/planner-alignment.md). JSON-Regeln und das lokale Suchwerkzeug ermöglichen überprüfbare Antworten. Das Original-PDF und personenbezogene Projektdateien gehören nicht ins Repository.
