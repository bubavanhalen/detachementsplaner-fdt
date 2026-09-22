# Detachementsplaner · Einrückung & PISA

Eine lokale Browser-App für einen durchgehenden Ablauf: **Dienstleistung vorbereiten → mit PISA abgleichen → als Personenarchiv nachschlagen**. Die App arbeitet offline, ohne Server und ohne Datenbank.

## VERBINDLICHE GRENZE: ALLE NUTZERDATEN BLEIBEN OFFLINE

**Importierte Dateien, Personendaten, Projektstände, Archive und sämtliche erzeugten Ausgaben dürfen das Gerät nicht durch Uploads, Hosting, Synchronisation, Telemetrie oder Weitergabe an Dritte verlassen. Diese Grenze ist nicht verhandelbar.** «Datei hochladen/importieren» bedeutet hier ausschliesslich, eine lokale Datei im Browser einzulesen.

- Verarbeitung, Suche, Planung, Validierung und Exporte erfolgen lokal. Es gibt keinen Datenserver und keine geteilten Online-Projekte. Die App übermittelt nichts an PISA, Google oder andere Dienste.
- Keine Analyse-, Tracking-, Sitzungsaufzeichnungs-, Fehlerberichts- oder externen Logging-Dienste. Datei- und Projektinhalte sowie daraus abgeleitete Angaben gehören auch nicht in Konsolenlogs, URLs, Netzwerkaufrufe, Tool-Ausgaben, KI-Anfragen, Screenshots mit Echtdaten, Support-Tickets oder CI-Artefakte.
- Reale Eingaben und Ausgaben gehören nicht in Git, Pull Requests, Test-Fixtures oder Deployments. Für Entwicklung, Demonstrationen und Tests werden ausschliesslich erfundene Daten verwendet.
- Öffentlich verteilt werden darf nur die Anwendung mit datenfreien Assets. **Eine HTML-Datei mit eingebettetem Projekt ist ein privater lokaler Export und darf niemals als Website veröffentlicht werden.** Laufzeitbibliotheken und Assets werden lokal gebündelt; die Anwendung muss ohne externe Dienste und ohne Internetverbindung funktionieren.
- Kontakt-CSV, JSON, Excel und HTML werden ausschliesslich lokal erzeugt und gespeichert. Ein kompatibles Exportformat ist keine Erlaubnis, die enthaltenen Daten zu einem externen Dienst hochzuladen.

Diese Vorgabe gilt ebenso für Wartung, Coding-Agenten, Debugging, Tests, CI und Support. Sie ist in [AGENTS.md](AGENTS.md) verbindlich festgehalten. Bei Implementierungsänderungen sind Offline-Betrieb, ausbleibende Datenübertragung und datenfreie Veröffentlichungen mit fiktiven Daten zu prüfen; die Dokumentation allein ist kein technischer Nachweis.

## Start

Die fertige Anwendung liegt nach dem Build in `dist/index.html` (identisch: `dist/offline.html`). Diese Datei lässt sich lokal öffnen; alle Bibliotheken, Styles und Lizenztexte sind enthalten. Der Quelltext-`index.html` ist nur der Einstieg für Vite, kein fertiger Download.

Unter **Dateien & Archiv** eine bestehende JSON-Datei öffnen oder eine PISA-/MILOFFICE-Liste lokal einlesen. Alte v2/v3/v4-Projekte bleiben ladbar; neue Projekte verwenden v5. Personen, Rohdaten, unbekannte Felder und bisherige Zuteilungen bleiben erhalten. Unklare alte Zuordnungen werden angezeigt und nicht stillschweigend umgedeutet.

## Arbeitsablauf

1. **Planung:** «+ Detachement» erzeugt sofort eine Karte. Name und EC lassen sich direkt bearbeiten; Einrückungsdetails können später ergänzt werden. Personen im seitlichen Flyout suchen, kombinierte Mehrfachfilter verwenden, Treffer auswählen und zuweisen. Das Flyout überlagert die Planung; Ausschnitt und Zoom bleiben unverändert. Die Auswahl bleibt bei Filterwechseln erhalten. Anschliessend die übrigen Personen verteilen. Das X im Kartenkopf entfernt ein Detachement nach Bestätigung; die Personen bleiben erhalten.
2. **Auf derselben Seite verbinden:** Karten am Griff frei verschieben. Ihre Positionen bleiben lokal gespeichert und beeinflussen keine PISA-Daten. Verbindungspunkte ziehen oder «Verbinden» und die Zielkarte anklicken. Pfeile zeigen den anschliessenden Dienst; das Ziel unterscheidet direkte Personen und Personen aus Verbindungen. Konflikte und fehlende Angaben erscheinen direkt auf den betroffenen Karten. «Position ändern» und Pfeiltasten bieten Alternativen zum Ziehen. Rückgängig/Wiederholen umfasst die letzten 30 Änderungen der laufenden Sitzung, auch über Seitenwechsel hinweg; Projektwechsel, Archivierung und Neuladen beginnen eine neue Historie.
3. **In PISA übernehmen:** Die Vorschau erzeugt die erforderlichen Haupt-/Zusatz-Einträge. Ein reiner Zusatz erhält keine direkte Personenzuteilung; die Personen erscheinen bei ihrem zugehörigen Haupt-MB. Zusätzlich benötigte EC werden einmal vergeben und bleiben stabil. Änderungen machen frühere Abgleichsmarker ungültig.
4. **Archivieren:** Ein unveränderlicher lokaler Snapshot öffnet die Personensuche. Eine spätere Bearbeitung erstellt eine eigene Arbeitskopie. Unvollständig abgeglichene Stände bleiben als solche erkennbar.

**KVK/WK:** Die PAT widerspricht sich auf S. 85 und S. 93–94. Verbundene Aufgebote benötigen deshalb eine pro Dienstleistung dokumentierte KF-Auskunft: separate MB oder ein durchgehender MB. Bis dahin bleibt die Vorschau mit **Aufgebotsart noch bestätigen** gekennzeichnet und enthält keine verbindlichen Übertragungsanweisungen. Ein gewöhnliches Einzelaufgebot benötigt diese Auswahl nicht. Die App sendet nichts an PISA und erstellt keine amtlichen Marschbefehle.

Eine Verbindung hat aktuell ein Folgedetachement; mehrere Spezialdetachemente können dasselbe Ziel haben. Verbindungsketten werden mit einer verständlichen Meldung abgelehnt. Bereits explizit gespeicherte Haupt-/Zusatz-Gruppen aus alten Projekten bleiben erhalten, wenn eine Zusammenlegung ihre Bedeutung verändern könnte. Hinweise zeigen den Klärungsbedarf.

## Personen und Kontakte

**Personen** durchsucht Namen, Versicherten-Nummern, Funktionen, Gruppen und Orte. Das Dossier zeigt Aufgebote, Teilnahme, Kontaktangaben und Originaldaten. Eine eindeutige Nummer führt importierte Quellen zusammen; optionaler Namensabgleich markiert die Identität zur Nachkontrolle. Verschiedene Nummern werden nie aufgrund gleicher Namen zusammengeführt.

**Kontakt-CSV** zeigt eine lokale Vorschau im Google-Kontakte-Format. Geplante, erreichbare Personen sind vorausgewählt; Filter verändern die Anzeige, nicht die Auswahl. Grad und Detachements-Labels sind optional. CSV und alle anderen Exporte bleiben lokal. Formatkompatibilität ist keine Erlaubnis zur Weitergabe an einen externen Dienst.

## Sicherungen und Offline-Grenze

JSON, Excel-Arbeitsliste, Kontakt-CSV und HTML mit eingebetteten Daten werden auf dem Gerät erzeugt. Das HTML kann erneut geöffnet und exportiert werden. Browserablage ist geräte- und browsergebunden; für unabhängige Sicherungen lokale Projektdateien herunterladen. Bei Speicherfehlern bleibt die Arbeitskopie im Speicher, und eine dauerhafte Warnung fordert zum Sichern auf. Beschädigte Ablagen werden nicht automatisch überschrieben.

Die Produktionsdatei setzt eine Content Security Policy mit `connect-src 'none'`, enthält keine externen Laufzeitressourcen und entfernt Konsolenausgaben auch aus Abhängigkeiten. Release-Prüfungen verlangen einen leeren Anwendungscontainer ohne eingebettete Projektdaten, ein festes Dateiset und einen erfolgreichen Start mit gesperrten Netzwerk-APIs. Reale Daten dürfen auch während Entwicklung und Support niemals in Logs oder Artefakte gelangen.

## Entwicklung

Voraussetzung: **Node.js 24.15 oder neuer innerhalb Version 24** sowie Python 3 für die Oracle-Tests. Abhängigkeiten sind exakt versioniert und durch `package-lock.json` gesichert.

```sh
npm ci
npm run dev
npm run check
npm run test:oracle
npm run build
npm run preview
```

`npm run check` führt strikte TypeScript-Prüfung, Biome und Vitest aus. `npm run build` erzeugt den eigenständigen Offline-Build und prüft dessen Release-Inhalt und Startverhalten. `npm run dev` ist ausschliesslich für Entwicklung mit fiktiven Daten vorgesehen. HTML-Export mit Daten ist im Produktionsbuild verfügbar; im Entwicklungsmodus steht JSON bereit.

Die Anwendung verwendet **React 19, TypeScript 7, Vite 8, TanStack Router, Table 9, Form und Store**. TanStack übernimmt Navigation, Tabellen, Formulare und lokalen Zustand. **React Flow** zeichnet die verschiebbaren Detachement-Karten und Verbindungen; **Motion** animiert Karten, CSS die Seitenbereiche. Reduzierte Bewegung wird berücksichtigt. Es gibt keine Server-Komponente.

```text
src/model/       Reine Planungsregeln, Migration, PISA-Ableitung und Prüfung
src/io/          Lokale Dateien, Quellenimport, Browserablage und Exporte
src/components/  Wiederverwendbare Dialoge, Tabellen und Personenauswahl
src/pages/       Planung, PISA, Personen, Kontakte und Dateien/Archiv
src/store.ts     Lokaler Zustand und atomare Änderungen
src/App.tsx      Navigation und Anwendungshülle
src/theme.css    Responsive Oberfläche
tests/           Fiktive Domain-, Import-, Speicher-, UI- und Privacy-Regressionen
tools/           Offline-Build, Release-Prüfung und PISA-Oracle
```

Beitragshinweise stehen in [CONTRIBUTING.md](CONTRIBUTING.md), die verbindliche Agenten-Anleitung in [AGENTS.md](AGENTS.md). [Implementierungsplan](docs/implementation-plan.md) und [Entwurfsnotizen](docs/app-redesign.md) dokumentieren Entscheidungen. Änderungen werden in Pull Requests geprüft; GitHub Pages veröffentlicht ausschliesslich den geprüften, datenfreien `dist`-Inhalt von `main`.

## PISA-Oracle und Lizenz

Das [PISA-Oracle](docs/pisa/README.md) hält Regeln, Belegstellen und offene Quellenkonflikte zur PAT vom 12.02.2026 fest. Das Original-PDF und personenbezogene Dateien gehören nicht ins Repository. Das Oracle ist eine quellengebundene Erfassungshilfe, kein Nachweis aktueller PISA-Genehmigung oder Zustellung.

Die Anwendung steht unter der [MIT-Lizenz](LICENSE). Der Offline-Build enthält zusätzlich die Lizenzhinweise der gebündelten Abhängigkeiten.
