# ADR-0002: Projekt teilen über Internet: Zugang, Rollen, Verschlüsselung

- **Status:** Entwurf, 20.10.2026. Entscheide des Owners am 20.10.2026:
  - Teilen auch über Internet, nur verschlüsselt.
  - Der Host ist der Heim-PC des Owners, erreichbar über Tailscale Funnel (bereits eingerichtet).
  - Freigabe für echte Daten durch den Kdt.
  - Alle Rollen dürfen exportieren.

  Die Grundregel in [AGENTS.md](../../AGENTS.md) und im [README](../../README.md) ist entsprechend eng angepasst.
- **Host-Dienst, Datenhaltung und Auslieferung:** [ADR-0003](0003-host-dienst-und-datenhaltung.md).
- **Voraussetzung:** ADR-0001, Etappe S2. Geteilt wird ein Projekt mit einer Quelle je Grunddatum.

## Ziel (Owner)

Teilnehmer und Bearbeiter melden sich an. Die Projektdatei bleibt beim **Host** auf dessen PC, ist aber für alle mit gültigem Zugang verfügbar. Der Zugang muss sicher sein und darf nicht nur aus einem Passwort bestehen. Ein Gerät wird für höchstens 2 Monate freigegeben.

## Verworfen: Freigabe über die MAC-Adresse

- Browser können die MAC-Adresse nicht lesen. Ein Host-Programm sieht sie nur im gleichen lokalen Netz; über Internet kommt nur die MAC des letzten Routers an.
- Sie ist in jedem Betriebssystem in Sekunden änderbar. Windows, Android und iOS verwenden im WLAN von sich aus zufällige MAC-Adressen. Sie ist also weder ein Geheimnis noch stabil.

Das Ziel «dieses Gerät, höchstens 2 Monate» wird stattdessen mit einem **Geräteschlüssel** erreicht (unten).

## Entscheid

### Topologie

```
Gast-Browser ── HTTPS/WSS ──> Tailscale Funnel ──> Heim-PC: tailscaled (TLS endet hier)
                              (sieht nur TLS-        └─> Host-Dienst auf 127.0.0.1
                               Chiffrat + Metadaten)     └─> SQLite-Datei (Projekt)
```

- Der **Host-Dienst** auf dem Heim-PC ist die einzige dauerhafte Ablage und die Autorität (ADR-0003). Läuft der PC oder der Dienst nicht, hat niemand Zugriff. Das ist gewollt, denn die Datei bleibt beim Host.
- **Tailscale Funnel** macht den Dienst unter einer festen HTTPS-Adresse erreichbar, ohne Portfreigabe am Router und ohne dass Gäste Software installieren.
  - TLS endet auf dem Heim-PC, nicht bei Tailscale.
  - Tailscale (Drittanbieter) sieht nur Chiffrat und Metadaten: IP-Adressen der Gäste, Zeitpunkte, Datenmengen.
  - Diesen Drittanbieter hat der Owner am 20.10.2026 ausdrücklich akzeptiert. Weitere Dritte sind nicht zugelassen.
- Damit entfallen WebRTC, eigene Signalisierung, STUN/TURN und ein eigener Vermittlungsserver.
- Die konkrete Funnel-Adresse ist Betriebskonfiguration auf dem Heim-PC und steht **nicht im öffentlichen Repository**. Eine dort veröffentlichte Adresse wäre ein Angriffsziel.
- Über Funnel läuft **ausschliesslich** der Host-Dienst; andere Dienste, z.B. der Remotedesktop, werden nicht öffentlich freigegeben.

### Zugang: zwei Faktoren, gerätgebunden, höchstens 60 Tage

1. **Einladung:** Der Host wählt Rolle und Ablauf (Vorgabe und Höchstwert 60 Tage). Die App zeigt einen QR-Code mit Adresse, Einladungs-ID, einmaligem 128-Bit-Geheimnis, Fingerabdruck des Host-Schlüssels und Gültigkeit von 15 Minuten. Übergabe persönlich oder über einen separaten sicheren Kanal.
2. **Geräteschlüssel:** Der Gast-Browser erzeugt ein Schlüsselpaar (WebCrypto, `extractable: false`, in IndexedDB). Der private Schlüssel verlässt das Gerät nie und lässt sich nicht kopieren.
3. **Person:** Zusätzlich registriert der Gast einen **Passkey mit Benutzerprüfung** (Windows Hello, Fingerabdruck oder Geräte-PIN). Die Passkeys sind an die Funnel-Adresse gebunden; ändert sie sich, müssen alle Geräte neu eingeladen werden.
4. **Vergleichscode:** Beide Bildschirme zeigen einen 6-stelligen Code, abgeleitet aus dem Handshake. Der Host bestätigt die Übereinstimmung und nimmt das Gerät auf. So kann eine weitergeleitete oder abgefangene Einladung niemandem sonst Zugang verschaffen.
5. **Jede Sitzung:**
   - Das Gerät signiert eine frische Herausforderung des Hosts mit dem Geräteschlüssel **und** bestätigt per Passkey mit Benutzerprüfung (Besitz + Wissen/Biometrie).
   - Umgekehrt beweist der Host den Besitz seines Schlüssels; der Gast prüft ihn gegen den Fingerabdruck aus der Einladung.
   - Die Sitzung ist an diese gegenseitige Prüfung gebunden. Sie läuft nach Inaktivität ab und wird sonst spätestens täglich erneuert.
6. **Ablauf und Sperre:**
   - Der Host speichert je Gerät nur den öffentlichen Schlüssel, die Passkey-ID, Rolle, Ablaufdatum und den letzten Zugriff.
   - Nach Ablauf wird abgelehnt; nur der Host kann verlängern, wieder höchstens 60 Tage.
   - Eine Sperre wirkt sofort und beendet laufende Sitzungen.
   - Fehlversuche werden je Gerät und je IP gebremst.
   - Das Zugriffsprotokoll liegt nur beim Host.

**Verschlüsselung:** TLS bis zum Heim-PC (endet in `tailscaled`, nicht bei Tailscale). Zusätzlich sind alle Nachrichten nach der Anmeldung an die Sitzung gebunden und authentisiert. Ein zusätzlicher Verschlüsselungs-Layer im Browser ist nicht vorgesehen, weil kein Dritter TLS beendet. Ändert sich das (z.B. anderer Tunnel), wird er nötig.

### Rollen und Datenumfang

| Rolle | Darf | Sieht |
|---|---|---|
| Host | alles, Geräte verwalten, exportieren | alles |
| Bearbeiter | Planung, Personenzuteilung, Detachemente bearbeiten, exportieren | Personen ohne Versicherten-Nr., Ausweise und Rohdaten; Tel./Mail nur mit Zusatzrecht «Kontaktdaten» |
| Leser | lesen, exportieren | wie Bearbeiter, ohne Kontaktdaten |

- Versicherten-Nr., Ausweise und importierte Rohdaten (`raw`) **verlassen den Host nie**. Der Host-Dienst filtert vor dem Senden, nicht der Gast.
- **Pendenzen** (Seite «Pendenzen», mit privater Kommunikation: Absender, Betreffs, Anrufnotizen) sind ebenfalls **nur für den Host** und werden vor dem Senden entfernt. Eine Freigabe für weitere Rollen braucht einen eigenen Entscheid des Owners. Den Austauschordner des Pendenzen-Agenten gibt es nur beim Host.
- Gäste halten das Projekt nur im Arbeitsspeicher; die App legt im Gast-Browser keine dauerhafte Kopie an.
- **Exporte (Entscheid Owner 20.10.2026):** Alle Rollen dürfen lokal exportieren (Excel, PDF/Druck, Kontakt-CSV, Projektdatei).
  - Ein Export enthält nur, was die Rolle sieht.
  - Er ist eine bewusst erzeugte lokale Datei auf dem Gast-Gerät, für die der Gast verantwortlich ist; die Exportansicht sagt das.
  - Der Host sieht im Zugriffsprotokoll, wer wann exportiert hat (ohne Inhalt).
- Was ein Gast sehen darf, kann er abschreiben oder fotografieren; die Zugangskontrolle schützt den Zugang, nicht die Weiterverbreitung.

### Gleichzeitiges Bearbeiten

Der Host-Dienst wendet Änderungen als Operationen mit Basis-Revision je Objekt an; es gibt keine zusammengeführten Kopien (kein CRDT in der ersten Fassung). Bei einem Konflikt erhält der zweite Bearbeiter einen Hinweis und den aktuellen Stand. Der Host führt ein Änderungsjournal (wer, wann, was) mit Rückgängig.

## Folgen

- Das Teilen ist **ausgeschaltet**, bis der Host es aktiv einschaltet. Im lokalen Betrieb (ADR-0003) gibt es wie heute keine einzige Netzanfrage.
- Pflichtprüfungen vor jeder Freigabe, nur mit fiktiven Daten:
  - Netzmitschnitt: Der Gast spricht nur mit der Host-Adresse; kein Klartext-Merkmal der Fixture ist ausserhalb von TLS sichtbar.
  - Abgelaufener, gesperrter oder fremder Geräteschlüssel wird abgelehnt, ebenso ein fehlender Passkey.
  - Ein Gast erhält nie Versicherten-Nr./Ausweise/Rohdaten, und ohne Recht «Kontaktdaten» auch nie Tel./Mail.
  - Ein falscher Host-Schlüssel wird erkannt.
  - Ohne gültige Anmeldung sind nur die datenfreien App-Dateien und der Anmeldeendpunkt erreichbar.
  - Keine Telemetrie und keine Logs mit Inhalten.
- Vor dem ersten Einsatz mit echten Daten: unabhängige Sicherheitsprüfung von Protokoll und Host-Dienst.

## Etappen (grob, Arbeitstage inkl. Tests)

| Etappe | Inhalt | Aufwand |
|---|---|---|
| T0 | Leistung (Speichern entlasten [läuft], Nachladen, Worker) und PWA | 3–5 |
| T1 | Host-Dienst mit SQLite, Auslieferung der App, WSS-Schnittstelle, Betrieb hinter Funnel (ADR-0003) | 5–7 |
| T2 | Einladung, Geräteschlüssel, Passkey, Vergleichscode, Ablauf, Sperre, Zugriffsprotokoll | 4–6 |
| T3 | Rollen und Feldfilter im Host-Dienst | 2–3 |
| T4 | Gleichzeitiges Bearbeiten: Operationen, Konflikte, Journal | 6–9 |
| T5 | Sicherheitsprüfung und Behebungen | 3–5 |

Zusammen ≈ 23–35 Tage; T1 ff. nach S2 (ADR-0001).

## Entschieden und offen

- **Host und Erreichbarkeit (Owner 20.10.2026):** Heim-PC des Owners über Tailscale Funnel.
- **Informationsschutz (Owner 20.10.2026):** Die Freigabe erteilt der **Kdt**. Sie muss die Speicherung auf einem privaten PC und die Erreichbarkeit über Tailscale ausdrücklich umfassen. Ohne schriftliche Freigabe bleibt das Teilen mit echten Daten gesperrt; Entwicklung und Tests laufen nur mit fiktiven Daten.
- **Exporte (Owner 20.10.2026):** Alle Rollen dürfen exportieren.
- **Offen: Härtung des Heim-PC** vor dem Einsatz: ausser dem Host-Dienst keine Funnel-Freigaben, Kontosperre nach Fehlversuchen, Laufwerksverschlüsselung, Dienst unter eigenem Konto ohne Adminrechte (ADR-0003).
