# ADR-007: Auslieferung und Betrieb (Pflicht-ADR)

- **Status:** Entwurf Runde 4 (01.10.2026, nach AR0-33; Umgebungsprobe `umgebungsprobe-3` eingetragen). **Entschieden an Gate 0 (02.10.2026):** G-11 Option D mit A als Arbeitsweg (Gate-0-Entscheid 1), G-7 a (Lesen auf dem Tablet = PDF; kein Lesemodus der App), G-8 ja (Release-Datei mit Version im Namen, Umsetzung erst nach Gate B mit eigener Freigabe). Die Umgebungsprobe (Prompt §5.1 Schritt 3) bestätigt die Empfehlung Option D mit A als Arbeitsweg; nicht gemessene Punkte stehen als Restrisiko im Abschnitt «Abschluss mit der Umgebungsprobe».
- **Leitplanken:** 6 (Pflicht-ADR mit Spike-Beleg vor Gate 0); Beschrieb 3, 5.6, 11, 14.13
- **Gate-0-Entscheide des Auftraggebers:** **G-11 Auslieferung Option D mit A als Arbeitsweg (durch die Umgebungsprobe bestätigt)** (Auslieferungsart der Suite; ein Service Worker bräuchte eine CSP-Änderung `worker-src` für die ganze Suite); **G-7 «Lesen auf dem Tablet»**; **G-8 Release-Datei mit Version im Namen** (Suite-Änderung).

## Kontext

- Beschrieb 11: «Läuft im Browser ohne Installation und ist nach dem ersten Öffnen auch ohne Netzverbindung voll nutzbar (Kaserne, Feld).» Beschrieb 14.13: «einmal mit Netz geöffnet, danach ohne Netz und nach Browser-Neustart: öffnen, bearbeiten, PDF erzeugen, Datei sichern.»
- Zielumgebung: Microsoft Edge auf dem Dienstlaptop ohne Adminrechte; Lesen auf dem Tablet (Leitplanke 6, Beschrieb 3).
- Heute: eine HTML-Datei (`dist/index.html` = `dist/offline.html`), Deploy nach GitHub Pages nur von `main`; kein Service Worker; CSP `worker-src 'none'` (`repo-analyse.md`). Neue Versionen durch Neuladen der Pages-URL oder neue Datei.
- Der WAP-Planer wird Route der Suite (ADR-001) und erbt deren Auslieferung.

## Messung (Spike 3, Edge 155 headless, lokaler Server als «gehostet»)

| Szenario | Service Worker | Offline nach Browser-Neustart |
| --- | --- | --- |
| Gehostet, nur HTTP-Cache (`Cache-Control: max-age=600` wie GitHub Pages), Neustart innerhalb der Frist | – | geladen (Cache) |
| Gehostet, nur HTTP-Cache, **Frist abgelaufen** (`max-age=2`, 4 s gewartet) | – | **nicht geladen** (`ERR_CONNECTION_REFUSED`) |
| Gehostet mit Service Worker, CSP `worker-src 'none'` (heutige Suite) | Registrierung **scheitert** (`SecurityError`) | nur über HTTP-Cache (wie oben) |
| Gehostet mit Service Worker, CSP `worker-src 'self'` | aktiv | **geladen (Service Worker)** |
| Einzeldatei `file://` | nicht möglich (kein SW auf `file://`) | Datei liegt lokal → immer ladbar; IndexedDB und `localStorage` nach Neustart erhalten (ADR-006) |

Zusätzlich (ADR-006): Unter `file://` funktionieren IndexedDB, `localStorage`, Download, `<input type=file>`, `showSaveFilePicker`; alle lokalen HTML-Dateien teilen einen Speicher.

## Geprüfte Optionen

| | Option | 14.13 offline nach Neustart | Updates | Bemerkung |
| --- | --- | --- | --- | --- |
| A | **Einzeldatei** lokal (wie heute `offline.html`) | ja (belegt, sofern Edge-Richtlinien `file://` erlauben) | neue Datei ersetzen; Daten bleiben, weil der Speicher-Ursprung `file://` nicht vom Pfad abhängt (gemessen) | Kein Netz nötig; Tablet kann lokale HTML-Dateien meist nicht mit Skripten öffnen |
| B | Gehostet (GitHub Pages) nur mit HTTP-Cache | **nein** (nur innerhalb 10 Min nach letztem Laden) | automatisch beim Neuladen | Erfüllt 14.13 nicht |
| C | Gehostet mit **Service Worker** | ja (belegt) | SW-Update-Ablauf (Hinweis «neue Version – neu laden») | CSP der Suite: `worker-src 'self'` nötig (Gate 0); Speicher-Ursprung `<konto>.github.io` teilen alle Pages-Seiten des Kontos; Repo ist öffentlich |
| D | A für die Arbeit am Laptop, PDF (oder C) zum Lesen auf dem Tablet | wie A | wie A | Tablet liest das PDF (Beschrieb 3: «Lesen auf dem Tablet ist erwünscht») |

## Entscheid (Empfehlung, durch die Umgebungsprobe bestätigt)

**Option D mit A als Arbeitsweg:** Der WAP-Planer wird mit der Suite als Einzeldatei ausgeliefert und am Dienstlaptop lokal geöffnet (`file://`); zum Lesen auf dem Tablet dient das PDF. Gründe: 14.13 ist mit A ohne Änderung an CSP oder Hosting erfüllt (belegt in Edge 155), keine Laufzeitabhängigkeit von externen Diensten, Updates verlieren keine Daten.

### Lesen auf dem Tablet (Entscheid G-7, AR0-06)

Beschrieb 3 und 11 verlangen «Lesen auf dem Tablet». Mit Option D liest das Tablet **nur das PDF**; ein iPad öffnet kein `file://` mit Skripten (CR-H0-03), die App liefe dort nicht. Optionen:

| | Bedeutung | Folge für R-11-10 und E1-17 |
| --- | --- | --- |
| a | **Lesen = PDF** (Empfehlung) | Kein Lesemodus der App; R-11-10 wird am PDF geprüft (Seite im Tablet-Format lesbar, zoombar, Text durchsuchbar) |
| b | Lesen = App auf dem Tablet | braucht Option C (gehostet mit Service Worker, CSP `worker-src 'self'`) oder ein Tablet, das lokale HTML-Dateien mit Skripten öffnet (Android je nach Browser); Lesemodus gemäss UI-Richtlinie 15; Nachweis zusätzlich auf dem echten Gerät, weil der emulierte Test allein nicht genügt |

Vorgabe ohne Entscheid: a. **Entschieden an Gate 0 (02.10.2026): a.** Folge: R-11-10 wird in E1-17 am erzeugten PDF im Tablet-Format geprüft (Projekt `edge-tablet`); der Lesemodus der App (UI-Richtlinie 15, Ansicht `ui/12-tablet-lesemodus.html`) wird in Etappe 1 nicht gebaut. Tablet-Typ laut Auftraggeber (01.10.2026): Android-Standardtablet, «kann vernachlässigt werden». Die iPad-Einschränkung (kein `file://`) entfällt damit; b bliebe trotzdem nur mit eigenem Nachweis auf dem Gerät möglich.

Betrieb:

1. **Neue Versionen:** neue HTML-Datei (Dateiname mit Version, z.B. `WK-Util-Suite_<version>.html`; Änderung an `tools/build-offline.mjs` und am Deploy-Workflow der Suite, Entscheid **G-8**, Umsetzung erst nach Gate B mit eigener Freigabe, Plan §9); die App zeigt ihre Version und die Formatversion der Daten. Öffnet eine ältere App Daten einer neueren Version, lehnt sie mit Hinweis ab (Beschrieb 5.6 Punkt 7), ohne zu schreiben.
2. **Migration:** IndexedDB-Schema über `onupgradeneeded` mit Migrationsfunktionen; vor jeder Migration ein Wiederherstellungspunkt (ADR-006). Plan-Dateien tragen `format` und `version`; Migrationen `vN → vN+1` als reine Funktionen; pro Etappe ein eingefrorenes Migrations-Fixture (Prompt §7).
3. **Keine Netzanfragen** zur Laufzeit (bestehender Test `tests/privacy.test.ts` und Smoke-Test mit gesperrten Netz-APIs bleiben massgebend).
4. **Offline-Test** (Prompt §7): E2E in Edge/Chromium – Datei öffnen, Netz gesperrt, bearbeiten, PDF erzeugen, Datei sichern, Browser neu starten, Daten und Undo vorhanden.

Wird C gewünscht (z.B. weil das Tablet die App selbst öffnen soll), braucht es: Service Worker in der Suite, CSP `worker-src 'self'`, Update-Hinweis, und eine Entscheidung zum gemeinsamen Speicher-Ursprung auf GitHub Pages.

## Abschluss mit der Umgebungsprobe

Quelle: Prüfseite `umgebungsprobe-3` (SHA-256 `62c9acec572357497b2c27373d8f36d4cb05cd34a07b931646fd551e01febc9d`), Lauf am 01.10.2026 in Edge als lokale Datei (`file://`), Probe ohne Fehler; Ausgabe gilt laut Auftraggeber als Wert des Dienstlaptops. Schritte 4–6 der Anleitung vom 01.10.2026 laut Auftraggeber erfolgreich ausgeführt (4 Testdatei sichern und öffnen, in der Ausgabe nicht belegt: `manuell: noch nichts ausgeführt`; 5 Ausgabe kopieren; 6 Geräte-Neustart mit zweitem Lauf, Ergebnis der Markierung nicht übermittelt); Schritt 7 (Offline-Test) nicht bestätigt (Einzelheiten und Zitate in ADR-006, gleichnamiger Abschnitt; PROGRESS.md).

| Frage an die Umgebungsprobe | Ergebnis | Folge für diesen Entscheid |
| --- | --- | --- |
| Edge-Version Dienstlaptop | Microsoft Edge 155.0.4283.24 (Chromium 155.0.8059.12) | Bezugsversion für Betrieb und Tests ist Edge 155; ältere Versionen sind nicht geprüft und werden nicht zugesichert |
| Öffnet Edge eine lokale HTML-Datei mit Skripten (`file://`), ohne Richtlinien-Sperre? | ja (Prüfseite lief als lokale Datei vollständig, 0 Fehler; nicht in einem Rahmen; sicherer Kontext) | **Option A/D bestätigt**; Option C nicht nötig |
| Bleiben IndexedDB/`localStorage` nach Browser-Neustart und Abmelden erhalten? | Geräte-Neustart (umfasst Schliessen des Browsers): Schritt 6 laut Auftraggeber erfolgreich ausgeführt; Ergebnis der Markierung nicht übermittelt (Ausgabe des zweiten Laufs liegt nicht vor), also **nicht gemessen**. Abmelden ohne Neustart: **nicht gesondert geprüft** | IndexedDB bleibt Hauptspeicher (ADR-006 Option C); keine Datei als Hauptspeicher. Restrisiko bis zu einem gemessenen zweiten Lauf: Schutz ist die Datei-Sicherung mit Erinnerung |
| `persist()` unter `file://` gewährt? Kontingent? | **nein**; Kontingent 10 240 MiB, belegt 0,0 MiB | Warntexte: Warnung «Speicher nicht dauerhaft» ist auf dem Dienstlaptop der Normalfall (ADR-006 Punkt 3 und Folgen); Grenzwert 80 % unverändert |
| Offline (Beschrieb 14.13) | Einzeldatei ohne externe Ressourcen und ohne Netzanfragen (gemessen); Offline-Test (Schritt 7: Netz trennen, neu laden) vom Auftraggeber **nicht bestätigt**, also **nicht gemessen**; Service Worker unter `file://` nicht möglich | Unter `file://` ohne Netzanfragen ist das Erscheinen ohne Netz erwartet (Spike 3: lokale Datei immer ladbar), auf dem Dienstlaptop aber nicht belegt. Option A/D bleibt; kein Service Worker, keine CSP-Änderung. Restrisiko bis zum Offline-Test auf dem Gerät; der automatische Offline-Test (R-14.13-01, ADR-010 §10) prüft lokal in Edge, nicht auf dem Dienstlaptop |
| Download-Verhalten, `showSaveFilePicker` verfügbar? | `<a download>`, `<input type=file>`, `showSaveFilePicker`, `showOpenFilePicker` vorhanden (gemessen); Sichern und Öffnen (Schritt 4) laut Auftraggeber erfolgreich; in der Ausgabe nicht belegt (`manuell: noch nichts ausgeführt`), also **nicht gemessen** | Sichern-Dialog per Blob + `<a download>`, Öffnen per `<input type=file>` (ADR-006 Punkt 5) bleibt; Beleg sind die lokalen Spikes in Edge 155 (ADR-006 Beleg: `dltest.mjs`, `dlfile.mjs`), nicht der Dienstlaptop |
| FontFace aus ArrayBuffer unter Suite-CSP (ADR-004) | **ok** (Testschrift 1000,00 px = Soll); `@font-face` mit `data:`-URL unter Suite-CSP **blockiert**; CSP wirksam (`font-src`, `worker-src` verletzt und gemeldet). Ohne CSP laden beide Wege | **ADR-004 Option c bestätigt** (G-4); keine CSP-Änderung `font-src data:`. Systemschriften: Arial installiert, Arimo nicht; ohne Belang, weil Arimo im Bundle liegt (ADR-003) |
| Tablet: Browser/Version; öffnet es die gehostete Suite, das PDF? | **nicht gemessen**; Android-Standardtablet, laut Auftraggeber vernachlässigbar | **D bestätigt**, Tablet liest das PDF (G-7 a). Restrisiko: Lesbarkeit des PDF am Gerät nicht geprüft; R-11-10 wird am PDF geprüft |
| Rechen-Benchmark → Drosselungsfaktor | Median 132,7 ms (7 Läufe nach Aufwärmlauf, Netzbetrieb, ungestört); lokal 90,6 ms | **Faktor 1,5** festgelegt in `docs/wap-planer/perf/drosselung.json` (ADR-010 §8) |
| Weg zurück nach einer Migration: öffnet die vorige App-Version die vor dem Update gesicherte Plan-Datei? (AR0-14 a) | Vorgabe: ja, über die Sicherung vor dem Update (ADR-006 Punkt 2c) | sonst Update-Ablauf neu vorlegen |
| InPrivate- oder Gastprofil: bleibt nach dem Schliessen etwas? (AR0-14 b) | **nicht gemessen** | Restrisiko; Schutz nach Entscheidregel ADR-006: Warnung «Speicher nicht dauerhaft» und Datei-Sicherung |
| Download-Richtlinien, Rückfrage, Umleitung auf OneDrive (AR0-14 c) | **nicht gemessen** (Schritt 4 nur als «erfolgreich» gemeldet, in der Ausgabe nicht belegt) | Restrisiko; die Speichern-Anleitung kann keinen festen Zielordner und kein Verhalten bei OneDrive-Umleitung zusichern |
| Wiederherstellungspunkte im alten Format nach einer Migration (AR0-14 d) | Vorgabe: werden beim Zurückholen migriert (ADR-006) | – |
| Wirksame Mindestschriftgrösse des Browsers (ADR-004) | **nicht gemessen** (keine 6-px-Probe in der Ausgabe) | Auflösung des Bildschirm-Zeichners bleibt 4 px/pt nach ADR-004 Punkt 4; Restrisiko: eine Mindestgrösse über 20 px wäre nicht erkannt |
| Tablet-Typ (iPad oder Android) | Android-Standardtablet (Auftraggeber, 01.10.2026), «kann vernachlässigt werden» | G-7 a (PDF); Risiko «iPad ohne `file://`» entfällt |
| Gemeinsamer Speicher unter `file://` | 1 bestehender `localStorage`-Eintrag (rund 105 900 Zeichen; Herkunft nicht erhoben, möglicherweise Suite), dazu die Markierung der Probe, im selben Profil (Rohwert und Erklärung: ADR-006 Beleg) | G-9 (ADR-006 Folgen); keine Folge für die Auslieferungsart |

## Folgen

- Keine Änderung an CSP oder Deploy der Suite, solange A/D gilt.
- Der Nutzer muss die Datei selbst aktualisieren; die App zeigt ihre Version deutlich (Kopf oder Hilfe).
- Datenschutz unter `file://`: gemeinsamer Speicher aller lokalen HTML-Dateien (ADR-006).

## Beleg

Arbeitsverzeichnis `spikes/storage/` (nicht versioniert), synthetische Seite.

- `node offline.mjs` → `{"szenario":"http-cache","cspWorkerSrc":"'none'","serviceWorker":"keiner","offlineNachNeustart":"geladen (Cache)"}`, `{"szenario":"sw-csp-none","cspWorkerSrc":"'none'","serviceWorker":"fehler:SecurityError","offlineNachNeustart":"geladen (Cache)"}`, `{"szenario":"sw-csp-self","cspWorkerSrc":"'self'","serviceWorker":"aktiv","offlineNachNeustart":"geladen (Service Worker)"}`.
- `MAXAGE=2 WAIT=4000 node offline2.mjs` → `{"szenario":"http-cache",…,"offlineNachNeustart":"nicht geladen: page.goto: net::ERR_CONNECTION_REFUSED …"}`. Einschränkung: Der Spike simuliert «offline» durch einen beendeten Server, nicht durch einen getrennten Netzadapter.
- `node run.mjs` (ADR-006): `file://` Daten nach Neustart erhalten, anderer Pfad sieht dieselben Daten.
- Umgebungsprobe `umgebungsprobe-3` (Prüfseite in `spikes/umgebungsprobe/`, nicht versioniert; Ausgabe vom Auftraggeber am 01.10.2026, lokal abgelegt, nicht versioniert): `auslieferung.art: a) lokal gespeicherte Datei (file://)`, `probe.fehler: 0`, `browser.ua_data.versionen: Microsoft Edge 155.0.4283.24; Chromium 155.0.8059.12`, `offline.einzeldatei: ja`, `offline.service_worker_moeglich: nein`, `schrift.suite_csp.fontface_arraybuffer: ok (1000.00 px)`, `schrift.suite_csp.data_url: blockiert`, `benchmark.median_ms: 132.7`, `manuell: noch nichts ausgeführt`. Schritte 4–6: Aussage des Auftraggebers (PROGRESS.md Freigabeprotokoll 01.10.2026), Nummerierung nach der Anleitung des Orchestrators vom 01.10.2026 (PROGRESS.md, Stand); Ausgabe des zweiten Laufs und Offline-Test (Schritt 7) liegen nicht vor.

## Änderungsnotiz Vertrag E1-04 (07.10.2026, architect; Vertragsprüfung E1-04 R2, V16)

Zu Punkt 2 (Migration), Migrations-Checkliste je Etappe: Jede Migration eines Plan-Dokuments ist ein Schritt `FormatMigration` mit der Kennzeichnung `additive` (Vertrag E1-04 F1). `additive: true` heisst: Der Schritt fügt nur optionale Felder hinzu, deren Fehlen gültig bleibt, und ändert, entfernt oder verschiebt keinen bestehenden Wert; dann bleibt die Undo-Historie bei der Umstellung erhalten (Arbeitsannahme Q-047). **Pflicht** für das Paket, das eine solche Migration einführt: ein Test, der für jeden Schritt einer fiktiven Historie mit allen Eintragstypen zeigt, dass `undo` bzw. `redo` nach der Umstellung gleich der Umstellung des Ergebnisses vor der Umstellung ist, bis auf die neuen optionalen Felder. Ohne diesen Beleg gilt der Schritt als strukturell (`additive: false`; die Historie wird geschnitten, Weg zurück über den Punkt `migration`). Dazu weiterhin je Etappe die eingefrorene Migrations-Fixture (Prompt §7; Etappe 1: `tests/wap/fixtures/migration/etappe-1.wap.json`).
