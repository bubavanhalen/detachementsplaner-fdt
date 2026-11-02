# Gate 0 – Fundament (zugleich Gate A der Etappe 1)

**Status: entschieden, 02.10.2026.** Antwort des Auftraggebers (wörtlich): «Zu deinen Befunden, alle Empfehlungen sind angenommen. Nr 12: zurückstellen (vermerken)». Damit sind die Entscheide 1–11 gemäss Empfehlung entschieden und Entscheid 12 mit a (zurückstellen); Gate 0 gilt zugleich als Gate A der Etappe 1.

Vorlage vom 02.10.2026: Paket H0 ist integriert, der Harness-Selbsttest R-H-09 ist bestanden (Abschnitt D3). Das Ergebnis der Umgebungsprobe (Abschnitt D2) und die Antwort auf die Tablet-Frage liegen vor.

Antwortform: z.B. «1 ok, 2b, 3 ok mit Auflage …, 10 ok». Ich trage deine Antwort wörtlich in `PROGRESS.md` ein.

## 1 Entscheide

Die Punkte 1 bis 9, 11 und 12 brauchen deine Abwägung. Für alle übrigen genügt Punkt 10, ein Sammelentscheid.

| Nr | Frage | Optionen | Empfehlung (Grund) | Folge | Vorgabe ohne Entscheid |
| --- | --- | --- | --- | --- | --- |
| 1 | **Auslieferung** (G-11) und **Lesen auf dem Tablet** (G-7) | Auslieferung:<br>A) Einzeldatei lokal<br>C) gehostet mit Service Worker<br>D) Einzeldatei, Tablet liest das PDF<br><br>Lesen auf dem Tablet:<br>a) PDF<br>b) App | D, mit A als Arbeitsweg; Tablet a). Die Einzeldatei läuft offline ohne Server. Option C bräuchte `worker-src 'self'` für die ganze Suite. | R-11-10 prüft das PDF im Tablet-Viewer. | D/A, a. Durch die Umgebungsprobe bestätigt für `file://`; Offline-Test auf dem Gerät nicht bestätigt (optional, D2). Das Tablet ist ein Android-Standardtablet. |
| 2 | **Datenschutz unter `file://`** (G-9): Alle lokal geöffneten HTML-Dateien teilen denselben Browserspeicher (gemessen). Die Umgebungsprobe fand dort auf dem Dienstlaptop bereits 1 bestehenden `localStorage`-Eintrag (rund 105 900 Zeichen; Herkunft nicht erhoben, möglicherweise Suite), dazu die Markierung der Probe; der gemeinsame Speicher wird also tatsächlich mitbenutzt (D2). | a) hinnehmen<br>b) gehostet betreiben<br>c) Daten verschlüsseln | a. Der Dienstlaptop ist persönlich. Option c bringt ohne Passwort keinen echten Schutz. | Ein Hinweis erscheint in der Hilfe. | a |
| 3 | **Varianten früherer Stände** (G-12): Welche PDFs werden je Stand gespeichert? | a) nur A4 mit rotem Status<br>b) zusätzlich A3<br>c) alle vier Kombinationen | a (kürzeste Sperre beim Setzen eines Stands; Beschrieb 5.5) | Ein Neudruck früherer Stände gibt es nur als A4 mit rotem Status. | a |
| 4 | **Ganzes Repo auf LF-Zeilenenden** (E11, F-002): Lokal ist `biome check .` rot. | a) `.gitattributes` für das ganze Repo, ein Normalisierungs-Commit; betrifft Suite-Dateien<br>b) Lint nur auf WAP-Pfaden | a. Gleich wie die Suite-CI unter Linux, also eine einzige Quelle der Wahrheit. | Danach lege ich die Arbeits-Worktrees neu an. Deinen Haupt-Checkout fasse ich nicht an. | b |
| 5 | **Browser für Golden-Bilder und Leistungsmessung** (E4) | a) installiertes Edge<br>b) Playwright-Chromium in fester Version: ein Download von ≈ 150 MB, also Netzzugriff ausserhalb der Paketinstallation | b. Edge aktualisiert sich selbst, damit wären Baselines nicht vergleichbar. | Funktionale Tests bleiben in Edge. Paket E1-01 misst den lokalen Vergleichswert des Drosselungsfaktors ohnehin neu, mit derselben Prüfseite unter den Bedingungen des Leistungsprojekts (sichtbares Fenster, Netzbetrieb), bei b also im Chromium. Ergibt sich eine andere Stufe als 1,5, wird `perf/drosselung.json` mit Grund nachgeführt (ADR-010 §8). | a |
| 6 | **Python 3 für den Orakel-Test** (E10) | a) Benutzerinstallation ohne Adminrechte<br>b) Ersatz durch eine Grenzprüfung | a | Bei b fehlt eine unabhängige Gegenrechnung. | b |
| 7 | **Import-Regel 4** (Q-006): Bei 35–39 % der Blockkanten der Kp-Referenz liegt die Kante mehr als 2 Min neben der 15-Min-Linie. | a) Wortlaut: jede solche Kante einzeln melden<br>b) gruppiert melden (Anzahl je Blatt und Tag), einzeln erst ab > 4 Min | b. Sonst wird der Importbericht unlesbar. **Das ist eine Abweichung vom Beschrieb.** | betrifft nur R-8.2-11 | a |
| 8 | **Format der Personenliste** (Prompt §8, Vertrag E1-09 §1) | CSV (`;` oder `,`) oder `.xlsx`, erstes Blatt. Kopfzeile ist Pflicht und enthält `Grad`, `Name`, `Vorname`, `Funktion`. Weitere Spalten werden verworfen, ohne dass sie gelesen oder zwischengespeichert werden. | annehmen | Eine Liste ohne diese Kopfzeile wird mit Meldung abgelehnt. | annehmen |
| 9 | **Node-Version** (F-001, hoch): Global ist Node 22 installiert, das Projekt verlangt Node 24.15. | a) Du stellst global auf Node 24 um (`nvm use 24.15.0`)<br>b) Alle WAP-Läufe setzen Node 24 per `PATH` (so ist es heute) | a. Weniger Fehlerquellen, und die Suite verlangt ohnehin Node 24. | – | b |
| 10 | **Sammelentscheid:** alle übrigen Empfehlungen annehmen (Abschnitt D1):<br>G-1 bis G-6, G-8, G-10<br>H-1, H-2<br>E1 bis E3, E5 bis E9, E12 (Option c), E13<br>Q-007 (F-01 bis F-62, N-04)<br>Q-008 (B-F-01 bis B-F-10)<br>Q-009 (S-1 bis S-7, K-1 bis K-5, F-1 bis F-10)<br>Q-011 (N-05 bis N-23)<br>Q-012 (Arimo fett statt `_SwissArmy`)<br>Bestätigung von Anhang A | ok, oder einzelne Nummern abweichend | ok | Etappe 1 startet mit Paket E1-01. | Es gelten die jeweiligen Vorschläge, ausser bei Anhang A: Er wird erst nach deiner Bestätigung eingefroren. |
| 11 | **Datenschutz ausserhalb der WAP-Pfade** (ADR-010 O-6, ADR-009 §4): Der Commit-Scan prüft Inhalte nur in WAP-Dateien; die übrige Suite nur am Dateinamen (sonst Fehlalarme durch fiktive Nummern in Suite-Tests). | a) so lassen · b) zusätzlich in der Schleuse vor dem Merge nach `main` (V11) alle versionierten Textdateien gegen die Sperrliste (nur Namen) prüfen | b: Namen sind das Hauptrisiko, der Namensabgleich erzeugt kaum Fehlalarme | Paket E1-01 wird etwas grösser | a |
| 12 | **Vier blockierende Befunde zum Datenschutz-Scan zurückgestellt** (CR-H0S-32, -38, -42, -43; Eskalation 1, ADR-009 §4 Zeile «Pfad-Modus»): Wer den Arbeitsbaum gezielt manipuliert (gefälschtes `.git`, `git init` in Unterordnern, Gross/Klein-Umbenennung), kann den Scan im **Pfad-Modus** mit Exit 0 enden lassen. Einen blockierenden Befund darfst nur du zurückstellen oder ablehnen. | a) Zurückstellung bestätigen: Nachweise (Commit-Hook, Schleuse, Gate-Belege) laufen nur über die Objekt-Modi `--staged`, `--baum`, `--commits`, die solche Manipulationen nicht trifft; der Pfad-Modus gilt nie als Nachweis<br>b) Pfad-Modus in Paket E1-01 nachbessern | a. Die Objekt-Modi sind durch Proben belegt (ADR-009 §8, Eskalation 1); eine Nachbesserung des Pfad-Modus brachte in 4 Prüfrunden immer neue Randfälle. | Bei b wird E1-01 grösser, Harness-Änderung per `lock-update` | Befunde bleiben blockierend und offen; Etappe 1 nutzt den Pfad-Modus nicht |

## 2 Zahlen (Soll / Ist)

| Grösse | Soll | Ist |
| --- | --- | --- |
| Anforderungen im Katalog | Satz-Zuordnung vollständig | 566 IDs. 667 von 667 Sätzen des Beschriebs sind zugeordnet (`trace-beschrieb.md`). |
| Anforderungen Etappe 1 | jede genau einem Paket und Testplan zugeordnet | 424 von 424 (392 aus dem Beschrieb, 24 R-H, 8 R-L) in 23 Paketen plus E1-AB. Das Prüfskript meldet keine fehlenden und keine überzähligen IDs. |
| Harness-Tests H0 | alle grün | 1285 von 1285 in 12 Dateien (Stand cb993d6, 02.10.2026); `lock-check` 28 gesperrte Dateien in Ordnung; `privacy-scan --baum HEAD` ohne Befund |
| Harness-Selbsttest R-H-09 | alle Teile bestanden | 4 von 4 (Abschnitt D3) |
| Abdeckung, Mutationsscore, Leistung | ab Etappe 1 | – (Instrumente sind in ADR-010 festgelegt) |
| Anhang A (Kp) | zwei Zählungen, abgeglichen | Kandidat mit 412 Zeilen, davon 52 offen (Q-011) |
| Anhang B-Kp | Prüfpunkte mit Toleranz | 112 Prüfpunkte, davon 23 «Abweichung gewollt» (Q-008) |
| Befunde gesamt | – | 357: 331 verifiziert, 15 zurückgestellt, 7 offen, 2 behoben (AR0-84, -85: Texte in `PROGRESS.md`, Verifikation mit der nächsten Prüfung), 2 abgelehnt (gezählt per Skript über `FINDINGS.md`, 02.10.2026) |
| Offene Befunde nach Stufe | keine blockierenden | 0 blockierend offen (4 blockierende zurückgestellt, Entscheid 12)<br>1 hoch (F-001, siehe Entscheid 9)<br>2 mittel (F-002, F-003; Entscheid 4 bzw. E8)<br>4 niedrig (SA0-22, -23, -25 nach Q-007; CR-H0S-52 Laufzeit `--commits`, bei nächster Harness-Änderung) |

## 3 Abweichungen vom Beschrieb und zurückgestellte Befunde

**Abweichungen vom Beschrieb oder vom Auftrag:**
- Bat-Referenz ist V3 statt V2 (Q-001, entschieden).
- Der Abschnitt «Arbeit am WAP-Planer» steht in `AGENTS.md` statt in `CLAUDE.md` (Q-004, entschieden).
- Import-Regel 4, falls du Entscheid 7 mit b beantwortest.
- Auslegungen F-01 bis F-62 (Q-007): Wo der Beschrieb schweigt, gilt der Vorschlag.

**Zurückgestellte blockierende Befunde (deine Entscheidung, Entscheid 12):**
- CR-H0S-32, -38, -42, -43 → Pfad-Modus von `privacy-scan` ohne Nachweischarakter (Eskalation 1, ADR-009 §4)

**Zurückgestellte Befunde, niedrig:**
- PL0-39 → Paket E1-11
- AR0-52 → Paket E1-04
- AR0-53 → Paket E1-05
- AR0-54 → Paket E1-01
- CR-H0S-44, -46 → wie Entscheid 12 (Pfad-Modus)
- CR-H0S-60 (Speicherbedarf des Objekt-Scans, fail-closed), TR-H0-117, -118, -134, -135 (fehlende eingefrorene Tests zu bereits geprüften Korrekturen) → bei der nächsten Harness-Änderung per `lock-update`, spätestens E1-01

**Abgelehnt (niedrig):** CR-H0-18, CR-H0S-61 (Begründung in `FINDINGS.md`)

## 4 Top-5-Risiken

| Nr | Risiko | Gegenmassnahme |
| --- | --- | --- |
| 1 | Restpunkte der Umgebungsprobe: Der Drosselungsfaktor 1,5 ist festgelegt, beruht aber auf einer Ausgabe, die laut dir dem Dienstlaptop entspricht, und auf einem lokalen Vergleich in Edge headless. Nicht gemessen sind:<br>- die Mindestschriftgrösse des Browsers;<br>- InPrivate/Gast;<br>- Datei sichern und öffnen (laut dir erfolgreich; in der Ausgabe nicht belegt);<br>- die Download-Richtlinien (Zielordner, OneDrive);<br>- die Daten nach Geräte-Neustart (Schritt 6 laut dir erfolgreich ausgeführt; Ergebnis der Markierung nicht übermittelt) und nach Abmelden;<br>- der Offline-Test auf dem Gerät (nicht bestätigt);<br>- die PDF-Lesbarkeit am Tablet. | Paket E1-01 misst den lokalen Wert unter den Bedingungen des Leistungsprojekts neu (sichtbares Fenster, bei Entscheid 5 b in Chromium). Die Kontrollmessung mit sichtbarem Fenster ergibt ebenfalls 1,5. Für die nicht gemessenen Punkte gelten die Vorkehrungen aus ADR-004/006/007 (4 px/pt, Warnung, Datei-Sicherung). |
| 2 | `persist()` = false, im Spike 3 und auch auf dem Dienstlaptop (Umgebungsprobe). Der Browser könnte lokale Daten verwerfen. | Datei-Sicherung als zweite Säule (Beschrieb 5.6). Die Warnung «Speicher nicht dauerhaft» ist auf dem Dienstlaptop der Normalfall. |
| 3 | Die Rückfallregel (Schrift 5 / 5,5 / 4,5 pt) greift in Referenzwochen. Das verletzt 14.3. | Früherkennung in E1-02e (KVK) und E1-08 (Wo 1–3) |
| 4 | Regression im Tagesbefehl-Werkzeug durch das gemeinsame XLSX-Modul | E12 c: fünf Dateien werden unverändert verschoben (per SHA-256 eingefroren), `calibrate.ts` bleibt unberührt. Nachweis mit den privaten Fixtures. |
| 5 | Der Harness greift nur mit geladener Projektkonfiguration. Umgehungen per Befehl sind möglich; auch prüfende Agents haben Bash und könnten damit schreiben. | Hash-Abgleich in jeder Schleuse und im Commit-Hook; `git status` nach jedem Prüferlauf. Bekannte Grenzen in ADR-009 §4 (H-2). Der Selbsttest R-H-09 belegt Hook, Lock-Prüfung und Werkzeuglisten (D3). |

## 5 Was du prüfen sollst (Reihenfolge, Aufwand)

| Nr | Was | Wo | Aufwand |
| --- | --- | --- | --- |
| 1 | Diese Seite, Entscheide 1–12 | oben | 25 min |
| 2 | Anhang A, Prüfhilfe: die 52 offenen Zeilen und N-05 bis N-23 | lokal `reference/anhaenge/abgleich/pruefhilfe.md` | ≈ 3,4 h |
| 3 | Auslegungsfragen F-01 bis F-62. Am wichtigsten sind F-01, F-02 (zusammen mit B-F-06), F-14, F-24, F-28 und F-51. | `requirements.md`, Abschnitt «Fragen» | 60 min |
| 4 | UI-Richtlinie, Abschnitte 17 bis 19, und die Ansichten | `ui-richtlinie.md`, `ui/index.html` | 45 min |
| 5 | Anhang B-Kp, Fragen B-F-01 bis B-F-10 | lokal `reference/anhaenge/B-Kp/anhang-B-Kp.md` §6 | 30 min |
| 6 | Standardaufgaben und Soll-Aktionszahlen | `standardaufgaben.md` | 20 min |
| 7 | Glossar, als Stichprobe | `glossar.md` | 15 min |

Gesamt etwa 6 h 10 min. Die Punkte 1 und 2 sind zwingend für den Start der Etappe 1. Die Punkte 3 bis 7 können auch per Sammelentscheid angenommen werden.

---

# Details

## D1 Alle Architektur-Entscheide

Die vollständige Tabelle steht in `adr/010-qualitaetsinstrumente.md` §12 (E1–E13) und §12.1 (G-1–G-12, H-1/H-2). Die Suite-Dateien, die Etappe 1 ändern würde, stehen in `plan/etappe-1.md` §9:

- `package.json`, `package-lock.json`
- `biome.json`
- `.gitattributes`, `.gitignore`
- `src/io/wap/{zip,xml,sheet,colors,drawing}.ts` (werden zu Weiterleitungen)
- `tools/build-offline.mjs`
- `src/App.tsx`
- `src/components/Shell.tsx`
- `src/components/CommandPalette.tsx`
- `src/components/Icon.tsx`

Fragen und ihre Quellen:
- Q-007: `requirements.md` «Fragen» und `anhaenge/normalisierung.md`
- Q-008: Anhang B-Kp §6 (lokal)
- Q-009: `ui-richtlinie.md` §17–19
- Q-010: siehe E1–E13
- Q-011: Prüfhilfe Anhang A (lokal)
- Q-012: ADR-003 «Folgen»

## D2 Ergebnis der Umgebungsprobe

*Eingegangen am 01.10.2026.* Prüfseite `umgebungsprobe-3` mit SHA-256 `62c9acec572357497b2c27373d8f36d4cb05cd34a07b931646fd551e01febc9d`, gelaufen in Edge als lokale Datei, ohne Fehler. Nach deiner Aussage gilt die Ausgabe als Wert des Dienstlaptops, und die Schritte 4–6 der Anleitung vom 01.10.2026 hast du erfolgreich ausgeführt: 4 Testdatei sichern und öffnen, 5 Ausgabe kopieren, 6 Geräte-Neustart mit zweitem Lauf. Die kopierte Ausgabe enthält kein Ergebnis von Schritt 4 (`manuell: noch nichts ausgeführt`). Das Ergebnis der Markierung im zweiten Lauf ist nicht übermittelt. **Frage an dich:** Zeigte der zweite Lauf bei der Markierung «ja»? Den Offline-Test (Schritt 7) hast du nicht bestätigt. Das Tablet ist ein Android-Standardtablet und wird nach deiner Aussage nicht geprüft.
- **Browser und Version:** Edge 155.0.4283.24, gleich wie die lokalen Tests.
- **`persist()` und Kontingent:** `persist()` nicht gewährt; Kontingent 10 240 MiB. Die Warnung «Speicher nicht dauerhaft» ist damit der Normalfall (Risiko 2).
- **IndexedDB:** 20 MiB schreiben 90 ms, lesen 59 ms, Inhalt gleich. Daten nach Geräte-Neustart: Schritt 6 laut dir erfolgreich ausgeführt; Ergebnis der Markierung nicht übermittelt, also nicht gemessen.
- **Offline-Fähigkeit:** Die Einzeldatei hat keine externen Ressourcen und macht keine Netzanfragen (gemessen). Dass sie ohne Netz erscheint, ist daher zu erwarten, auf dem Gerät aber nicht gemessen (Schritt 7 nicht bestätigt). Ein Service Worker ist unter `file://` nicht möglich und nicht nötig. Auslieferung D/A bleibt die Empfehlung (Entscheid 1).
- **Datei sichern und öffnen:** Download, Datei-Auswahl und `showSaveFilePicker` vorhanden; Sichern und Öffnen (Schritt 4) laut dir erfolgreich; in der Ausgabe nicht belegt (`manuell: noch nichts ausgeführt`). Beleg für den Weg sind die lokalen Spikes in Edge 155 (ADR-006).
- **Schriftdarstellung:** Schrift aus ArrayBuffer unter der Suite-CSP lädt mit Sollbreite; `data:`-Schrift wird von der CSP blockiert. ADR-004 Option c ist bestätigt (G-4).
- **Gemeinsamer Speicher:** Im gemeinsamen Browserspeicher lag bereits 1 bestehender Eintrag (rund 105 900 Zeichen; Herkunft nicht erhoben, möglicherweise Suite), dazu die Markierung der Probe. Die Ausgabe meldet 2 Einträge, weil die Probe ihre eigene Markierung mitzählt. Das betrifft Entscheid 2 (G-9).
- **Benchmark:** Median 132,7 ms, lokal 90,6 ms. Drosselungsfaktor 1,5 (`perf/drosselung.json`).
- **Nicht gemessen:** Mindestschriftgrösse des Browsers, InPrivate/Gast, Datei sichern und öffnen (nur deine Aussage), Download-Richtlinien (Zielordner, OneDrive), Daten nach Geräte-Neustart (Ergebnis der Markierung nicht übermittelt) und nach Abmelden, Offline-Test auf dem Gerät, PDF-Lesbarkeit am Tablet (Risiko 1).

ADR-006 und ADR-007 sind damit abgeschlossen (Abschnitte «Abschluss mit der Umgebungsprobe»).

## D3 Harness-Konfiguration, Selbsttest, Auswirkungen auf die Suite

- **Aufbau und Grenzen:** `adr/009-harness.md` §3 und §4 (H-2).
- **Auswirkungen auf die Suite:** §5 (H-1).
- **Paket H0:**
  - Vertrag `pakete/H0.md`: Klauseln 1–8 und Präzisierungen P1–P47i; Eskalation 1 (Option B, Pfad-Modus ohne Nachweischarakter).
  - Code-Review der Skripte: 11 Runden, Freigabe in Runde 11 (5927ea0). Prüfseite: 3 Runden, Freigabe.
  - Tests: 33 Review-Runden, Freeze fffc856. Merge 673d8a2, Sperre 9752f2a (28 Dateien), Commit-Hooks `pre-commit`/`pre-merge-commit` installiert.
- **Selbsttest R-H-09: bestanden am 02.10.2026** (ADR-009 §6; Protokoll lokal `.qa/h0/selbsttest-r-h-09.md`):
  - (1) Alle 10 Agenten melden Namen und genau die Werkzeuge ihrer Positivliste, dazu nur das Harness-eigene Rückmeldewerkzeug `SubagentHandback`; keiner kann Agents starten.
  - (2) Der `code-reviewer` kann weder Write noch Edit noch Agent aufrufen; die Zieldatei wurde nicht angelegt.
  - (3a) Edit/Write auf gesperrte Dateien blockiert der Hook im Arbeits-Checkout (`vitest.wap-harness.config.ts`, `test-lock.json`) und im Paket-Worktree (`scripts/wap/privacy-allow.txt`).
  - (3b) Änderung per Befehl: `lock-check` meldet «geändert» (Exit 1), der Commit bricht ab (Exit 1), in beiden Checkouts.
  - Restrisiko: Prüfer haben Bash (ADR-009 §4, neue Zeile).

## D4 Spike-Ergebnisse (Kurzfassung, Einzelheiten in den ADRs)

| Spike | Ergebnis | ADR |
| --- | --- | --- |
| 1 Textmessung und Umbruch | Arimo und Arial sind metrisch gleich (0 % Abweichung), Umbrüche 50 von 50 identisch. Es fehlen keine Zeichen der Referenz. | 003, 004 |
| 2 PDF mit eingebetteter Schrift | Bytegleich bei zweimaliger Erzeugung, in getrennten Prozessen, in anderer Zeitzone und in Edge. Unabhängiger Leser `pdfjs-dist`: Text 96 von 96 identisch, Abweichung 0 pt. | 005 |
| 3 Speicherung | IndexedDB 100 MB in ≈ 230 ms. Kontingent 10 GB. `persist()` blieb headless false (siehe Risiko 2). | 006, 007 |
| 4 Kp-Woche aus Excel | KVK: 111 von 111 Rasterformen mit Tag, Spalte und Zeit. 21 von 21 Beso-Kästchen liegen innerhalb 15 Min ihrer Terminzeit. Gruppen und Rotation (34 gedrehte Formen) werden korrekt aufgelöst. | 008 |

## D5 Ergebnisse der Etappe 0 und ihre unabhängigen Prüfungen

Die Prüfberichte liegen lokal unter `.qa/etappe0/` und `.qa/h0/`.

| Ergebnis | Datei | Prüfung |
| --- | --- | --- |
| Anforderungskatalog | `requirements.md` | Katalogprüfung (spec-auditor), Freigabe |
| Satz-Zuordnung | `trace-beschrieb.md` | 667 von 667 |
| Glossar, Standardaufgaben, Normalisierung | `glossar.md`, `standardaufgaben.md`, `anhaenge/normalisierung.md` | mit dem Katalog geprüft |
| ADR-001 bis ADR-010 | `adr/` | Architektur-Review Runde 5: Freigabe |
| Qualitätsinstrumente | `adr/010-qualitaetsinstrumente.md` | wie oben |
| Plan Etappe 1 und Verträge | `plan/etappe-1.md`, `plan/vertraege/` | Planprüfung Runde 5: Freigabe |
| UI-Richtlinie und Ansichten | `ui-richtlinie.md`, `ui/` | Teil des Architektur-Reviews |
| Anhang A, B-Kp, Prüfhilfe | lokal `reference/anhaenge/` | zwei unabhängige Zählungen und Abgleich |
| Datenschutz-Sperrliste | lokal `reference/datenschutz-sperrliste.txt` | im Scan aktiv |
