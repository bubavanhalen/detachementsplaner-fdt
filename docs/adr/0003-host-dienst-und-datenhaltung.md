# ADR-0003: Host-Dienst, Datenhaltung in SQLite und Auslieferung

- **Status:** Entwurf, 20.10.2026. Anlass: Der Owner stellt fest, dass sich die App zu einer Server-App entwickelt, und schlägt eine kleine Datenbank in einer Datei vor. Host ist der Heim-PC des Owners, erreichbar über Tailscale Funnel (ADR-0002).
- **Ersetzt:** den Auslieferungsvorschlag im ersten Entwurf von ADR-0002 (gehostete PWA auf GitHub Pages).

## Kontext

- Heute läuft alles im Browser: Projekt im localStorage, Archive daneben, TB-Bilder gerätweit, WAP-Pläne in IndexedDB. Ausgeliefert wird eine Einzeldatei mit CSP `connect-src 'none'`.
- Mit dem Teilen (ADR-0002) braucht es eine dauerhafte, gemeinsame Ablage beim Host. Dazu kommen Geräte, Einladungen, ein Zugriffsprotokoll und ein Änderungsjournal.
- Der WAP-Beschrieb 11 verlangt weiterhin: im Browser ohne Installation, nach dem ersten Öffnen ohne Netz voll nutzbar (Kaserne, Feld).

## Entscheid

### Zwei Betriebsarten, ein Code

| | Lokal (wie heute) | Host |
|---|---|---|
| Wo | Browser auf irgendeinem Gerät, auch Dienstlaptop | Host-Dienst auf dem Heim-PC |
| Ablage | Browser (heute localStorage, später IndexedDB) | eine SQLite-Datei |
| Netz | keines, keine einzige Anfrage | nur über Funnel zum Host-Dienst |
| Teilen | nein | ja (ADR-0002) |

- Die Oberfläche ist dieselbe React-App. Nur die Ablage-Schicht unterscheidet sich, hinter einer gemeinsamen Schnittstelle (`ProjectRepository`: lesen, Operation anwenden, Verlauf, Sicherung).
- Der lokale Betrieb bleibt vollwertig und offline. Er ist der Weg für Kaserne, Feld und Dienstlaptops.
- Die Projektdatei (`.json`) bleibt das Austauschformat zwischen beiden Betriebsarten: Import in den Host, Export aus dem Host, und als Sicherung.

### Host-Dienst

- **Laufzeit:** Node.js 24, die bereits vorgeschriebene Version des Repositorys (`engines`). Ein Prozess, keine weiteren Dienste.
- **Netz:** lauscht nur auf `127.0.0.1` (nicht im Heimnetz). Tailscale Funnel leitet HTTPS auf diesen Port; TLS endet in `tailscaled` auf dem PC.
- **Liefert:**
  - die gebaute App als datenfreie statische Dateien (PWA mit Service Worker);
  - den Anmeldeendpunkt (ADR-0002);
  - nach der Anmeldung eine WebSocket-Schnittstelle für Lesen, Operationen und Benachrichtigungen.
- **Ohne Anmeldung erreichbar:** nur App-Dateien und Anmeldung. Keine Verzeichnisanzeige, keine Fehlermeldungen mit Interna, strenge Sicherheits-Header (CSP, HSTS, `frame-ancestors 'none'`).
- **Betrieb:**
  - als Windows-Dienst unter einem eigenen Konto ohne Adminrechte, mit Zugriff nur auf seinen Datenordner;
  - Protokolle ohne Inhalte und ohne Personendaten;
  - Konfiguration (Port, Datenordner, Funnel-Adresse) in einer lokalen Datei ausserhalb des Repositorys.
- **Härtung des PC:**
  - Funnel gibt nur den Host-Dienst frei;
  - Kontosperre nach Fehlversuchen;
  - Laufwerksverschlüsselung (BitLocker);
  - automatische Updates für Windows, Node und Tailscale.

### Datenhaltung: eine SQLite-Datei

**Warum SQLite** statt einer JSON-Datei:
- Änderungen sind atomar (Transaktionen). Ein Absturz hinterlässt nie eine halb geschriebene Datei.
- Es wird nur geschrieben, was sich ändert, nicht das ganze Projekt.
- Projekt, Journal, Geräte, Zugriffsprotokoll und Bilder liegen in **einer** Datei.
- Eine Sicherung im laufenden Betrieb ist möglich (`VACUUM INTO`).

**Wie:**
- Mit `node:sqlite`, in Node 24 eingebaut. Keine native Zusatzabhängigkeit; am 20.10.2026 lokal mit Node 24.15.0 geprüft.
- WAL-Modus, `foreign_keys`, `secure_delete`.

| Tabelle | Inhalt |
|---|---|
| `meta` | Schemaversion, Projekt-JSON-Version |
| `project` | Projektkopf mit `stamm` (ADR-0001), Revision |
| `entity` | Personen, Detachemente, Events usw.: `(kind, id, revision, data JSON)`, Änderung je Objekt |
| `journal` | Operation, Gerät, Zeit, Basis-Revision; Grundlage für Rückgängig und Konflikte |
| `asset` | Unterschrift, Wappen: `(id, sha256, mime, bytes)` |
| `device`, `invitation` | öffentlicher Schlüssel, Passkey-ID, Rolle, Ablauf, Sperre (ADR-0002) |
| `access_log` | wer, wann, welche Aktion (inkl. Export), ohne Inhalte |

- Die Objekte bleiben in der Form des bestehenden Projektmodells (`src/model`). So bleiben Import und Export der Projektdatei verlustfrei, und die Modell-Logik wird nicht doppelt geschrieben.
- Die Datei liegt nur auf dem Heim-PC. Sicherungen sind lokale Kopien; sie werden nicht in Cloud-Ordner synchronisiert (OneDrive o.ä. ausschliessen).
- Die SQLite-Datei und Sicherungen davon gehören nie ins Repository. Tests verwenden fiktive Daten in temporären Dateien.

### Auslieferung

- **Host-Betrieb:** Der Host-Dienst liefert die App selbst aus. Gäste öffnen die Funnel-Adresse; die App kommt vom selben Ursprung wie die Daten. Es braucht kein GitHub Pages, und Passkeys funktionieren unter dieser Adresse.
- **Lokaler Betrieb:** Die von der Host-Adresse installierte PWA läuft dank Service Worker offline. Für Dienstlaptops ohne Zugriff auf die Host-Adresse bleibt die datenfreie Einzeldatei, solange sie gebraucht wird.
- **Export «HTML mit eingebetteten Daten» entfällt** zugunsten der Projektdatei (`.json`, wahlweise mit WAP-Plänen).
- Das ändert den Gate-0-Entscheid G-11 des WAP-Planers (ADR-007, Einzeldatei unter `file://`, CSP `worker-src 'none'`) und wird erst nach Gate B mit dem WAP-Orchestrator umgesetzt.

### Leistung

Die Auslieferungsform ist für die Leistung zweitrangig. Messung am 20.10.2026 (`vite build`, `main` 511beeb):
- Beim Start werden 2,41 MB JavaScript geladen, davon etwa 1,45 MB `xlsx` und `pdf-lib`. Gebraucht werden diese erst beim Import oder Export.
- Bei jeder Änderung wird das ganze Projekt dreimal zu Text umgewandelt und blockierend gespeichert.

Massnahmen:
1. Vergleich ohne Textumwandlung, möglichst nur Geändertes kopieren (z.B. mit Immer). Wird bereits umgesetzt, eigener Zweig.
2. Gebündelt speichern nach kurzer Pause, sofort beim Verlassen. Wird bereits umgesetzt, eigener Zweig.
3. `xlsx`/`pdf-lib` erst bei Bedarf laden; der Start wird etwa 60 % leichter.
4. PDF/Excel in einem Web Worker erzeugen.

Im Host-Betrieb überträgt der Gast nur Operationen, nicht das ganze Projekt. Die Last beim Speichern liegt im Host-Dienst (SQLite, je Objekt).

## Folgen und Risiken

- **Verfügbarkeit:** Ist der Heim-PC aus, im Ruhezustand oder ohne Internet, ist das Teilen unterbrochen. Energieoptionen anpassen; kein Datenverlust.
- **Abhängigkeit von Tailscale:** Tailscale sieht Metadaten. Ändert sich die Funnel-Adresse (Tailnet-Name), sind alle Passkeys ungültig und Geräte müssen neu eingeladen werden.
- **Angriffsfläche:** Der Heim-PC ist aus dem Internet erreichbar. Der Host-Dienst muss klein bleiben und vor dem Einsatz mit echten Daten unabhängig geprüft werden (ADR-0002 T5).
- **Kdt-Freigabe:** muss den privaten PC als Speicherort und Tailscale ausdrücklich umfassen.
- **Zwei Ablagen:** Lokaler Betrieb und Host-Betrieb sind getrennte Stände. Übergänge nur bewusst per Projektdatei (Import/Export), nie automatisch abgeglichen.
