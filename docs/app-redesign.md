# Dienstleistung vorbereiten, danach nachschlagen

Die Neugestaltung folgt zwei Nutzerentscheidungen: Die Vorbereitung des nächsten Dienstes führt den Arbeitsablauf; Detachemente sind primär Einrückungsgruppen für PISA. Das Archiv ist der zweite Zustand derselben Dienstleistung.

## Arbeitsmodell

Eine Dienstleistung enthält Personalbestand, Teilnahmeentscheidungen und Einrückungsgruppen. Eine Person erhält ein Hauptdetachement. Eine Hauptgruppe kann bis zu fünf weitere EC als Zusatz-MB referenzieren; ihre direkt zugeteilten Personen erhalten diese Zusatz-MB gemeinsam. Unterschiedliche Zusatz-Kombinationen benötigen getrennte Hauptgruppen. Die App entscheidet KVK/WK-Sonderfälle nicht selbst.

Ein importierter Datensatz bedeutet zunächst «Teilnahme klären». Eine ausdrückliche Zuteilung setzt «Einplanen»; «Nicht einplanen» benötigt eine Begründung. DVM und die fachliche Einrückungspflicht werden weiterhin ausserhalb der App geprüft. Das ist eine lokale Arbeitsentscheidung, kein automatischer PISA-Status.

## Ziel und Einstieg

Das erste Ergebnis ist ein verständlicher Plan: welche Personen gehören zu welchen Einrückungsdetachementen? PISA-Detailangaben sind dafür noch nicht erforderlich. Ohne Personalbestand führt der Einstieg zuerst zum Import von PISA und/oder MILOFFICE. Danach werden Detachemente allein mit Namen angelegt. Projektbezeichnung, Dienstperiode, EC, Ort und Anzug sind keine Einstiegshürden.

Die Planung öffnet direkt als gemeinsame Arbeitsfläche für Detachemente und Personen. Eine PISA- oder MILOFFICE-Liste genügt als Startgrundlage. Import kehrt unmittelbar zur Verteilung zurück. Personen werden per Mehrfachauswahl zugeteilt, verschoben oder aus einer direkten Zuteilung genommen. Die Planung zeigt keine Warnungen für noch fehlende spätere MB-Felder.

## Vier Arbeitsschritte und ein Archiv

1. **Detachemente bilden:** Liste laden, Namen erfassen, zuerst Spezialpersonen mit kombinierbaren Filtern verteilen, dann den übrigen Bestand den Hauptdetachementen zuteilen.
2. **Marschbefehle zuordnen:** Haupt-/Zusatz-MB am Beispiel verstehen und die eigenen Gruppen verknüpfen. Die Vorschau zeigt die resultierenden Aufgebote pro Person. Ein reines Zusatzdetachement wird als solches angezeigt, ohne einen fiktiven eigenen Hauptmarschbefehl zu suggerieren. Beim Verbinden eines besetzten Spezialdetachements wird automatisch eine eigene Hauptgruppe mit dessen Zusatzverknüpfung erstellt. Die Spezialpersonen werden dorthin verschoben. Das gewählte ursprüngliche Hauptdetachement bleibt unverändert. Die neue Hauptgruppe benötigt einen eigenen EC; kopierte Details bleiben anschliessend unabhängig bearbeitbar. Mehrdeutige alte Zuteilungen müssen zuvor geklärt werden.
3. **Angaben ergänzen:** eigener Schritt für EC und sämtliche MB-Details; hier erscheinen die Vollständigkeitsprüfungen.
4. **In PISA übernehmen:** bestehende manuelle Erfassungs- und Abschlusskontrollen.

Personensuche, Datenquellen und Projektablage sind ergänzend erreichbar. Archivierung und unveränderte Snapshots bleiben erhalten.

Für die Erklärung gelten die Oracle-Belege MB-001/002 (PAT S. 85–89), FRACTION-002 (S. 96–98) und CONFLICT-001. Im konkreten Repetitorium-Beispiel liegt der Zusatz vor dem WK-Hauptmarschbefehl. Die zeitliche Reihenfolge allein definiert die Rollen nicht. KVK/WK-Sonderfälle werden nicht automatisch aufgelöst.

## Daten erhalten

v2/v3-Projekte werden beim Laden auf v4 ergänzt. Personen, Rohdaten, unbekannte Felder und bestehende Zuteilungen bleiben erhalten. Mehrere alte direkte Zuteilungen bleiben als Konflikt sichtbar, bis der Nutzer ein Hauptdetachement auswählt. Es findet keine automatische fachliche Umdeutung statt. Frühere manuelle PISA-Bestätigungen werden mit dem neuen Modell erneut abgeglichen.

Der Import ergänzt nur bei einer eindeutigen normalisierten Versicherten-Nr. automatisch. Ein optionaler eindeutiger Namensabgleich erzeugt einen Prüfhinweis. Abweichende Nummern verhindern diesen Namensabgleich. Mehrdeutige Nummern werden nicht automatisch aufgelöst; doppelte Nummern blockieren den lokalen Abschluss. Rohwerte bleiben pro Quelle verfügbar.

Archivieren speichert zuerst einen separaten lokalen Snapshot. Fehler beim Schreiben verhindern das Archivieren. Eine Arbeitskopie erhält eine neue Projekt-ID und lässt den Snapshot unverändert. Beim Projektwechsel kann der aktive Stand zuerst als Datei gesichert werden. Die Archivablage liegt im Browser und ist kein dauerhafter externer Speicher.

## Technische Form

Die verteilte App bleibt eine einzelne offline verwendbare `index.html`. Die Quellen liegen getrennt in `src/`; `python tools/build_app.py` bündelt Styles, XLSX-Bibliothek, Datenmodell, Import, Ansichten und Interaktionen. Es gibt weder externe Laufzeitabhängigkeiten noch einen Datenserver. Änderungen werden lokal gespeichert; für Gerätewechsel dienen JSON oder HTML mit eingebetteten Daten.

## Fachliche Grenze

Die [Oracle-Regeln](pisa/README.md) begründen die PISA-Begriffe und MB-Struktur. Zusätzliche Vollständigkeitsprüfungen sind lokale Qualitätskontrollen. Die App überträgt keine Daten, erzeugt keine amtlichen Marschbefehle und bestätigt keine tatsächliche Genehmigung, Verarbeitung oder Zustellung. Beilagen, Versandkontrolle und AO-Sonderabläufe bleiben in PISA bzw. mit dem zuständigen KF zu bearbeiten.

## Prüfung

`node tests/planner-model.cjs` prüft Migration, gleichnamige Personen, Suche, Haupt-/Zusatz-Zuteilung, EC-Regeln, Signaturänderungen, Abschlussvoraussetzungen, Import, Archivschutz, Speicherfehler und wiederholten HTML-Export. `python -m unittest discover -s tests -p "test_*.py"` prüft das Oracle. Browserprüfungen verwenden ausschliesslich fiktive Beispieldaten.
