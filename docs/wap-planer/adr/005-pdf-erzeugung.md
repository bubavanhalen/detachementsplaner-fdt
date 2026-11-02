# ADR-005: PDF-Erzeugung

- **Status:** Entwurf Runde 2 (01.10.2026, nach AR0-08, AR0-10, AR0-17). **Entschieden an Gate 0 (02.10.2026):** G-5 B (`fontkit` 2 mit Adapter im Bundle); E1 und E2 ja (`pdfjs-dist` als Entwicklungs-, `fontkit` als Laufzeit-Abhängigkeit).
- **Leitplanken:** 4 (vektoriell, Text markier- und durchsuchbar, Schrift eingebettet, offline, deterministisch), 2, 3; Beschrieb 5.5, 10, 11 (PDF einer Woche < 3 s, ganzer Plan < 10 s)
- **Gate-0-Entscheid des Auftraggebers:** G-5, ja (neue Laufzeit-Abhängigkeit fontkit im Suite-Bundle; neue Entwicklungs-Abhängigkeit pdfjs-dist)

## Kontext

- Die Suite nutzt `pdf-lib` 1.17.1 (MIT) mit den Standardschriften Helvetica/Helvetica-Bold (WinAnsi, nicht eingebettet). Für eine eingebettete Schrift braucht pdf-lib ein fontkit-Objekt (`registerFontkit`).
- Leitplanke 4: «gleicher Plan und Stand ergeben dasselbe PDF». Beschrieb 5.5: jeder frühere Stand als identisches PDF.
- Prompt §7, Ebene 2: Das fertige PDF wird unabhängig ausgelesen (Text, Positionen, Schriftgrössen, eingebettete Schriften, Linien).

## Geprüfte Optionen

| | Option | Grösse (minifiziert) | Befund |
| --- | --- | --- | --- |
| A | pdf-lib 1.17.1 + **`@pdf-lib/fontkit` 1.1.1** (MIT, offizielles Gegenstück) | 985 234 Byte (gzip 384 137); Auswertung 71 ms, CPU ×4: 338 ms | Funktioniert ohne Anpassung; bytegleich (siehe unten) |
| B | pdf-lib 1.17.1 + **`fontkit` 2.0.4** (MIT) über einen Adapter (≈ 15 Zeilen: `createSubset().encodeStream()` auf `encode()` abbilden) | 365 867 Byte | Funktioniert; Text extrahierbar; bytegleich bei zweimaliger Erzeugung |
| C | PDFKit bzw. jsPDF | – | Nicht gespikt: PDFKit braucht Node-Stream-/Buffer-Polyfills im Browser; jsPDF bettet ohne Teilmengen-Kontrolle ein und bringt eigene Textmessung mit (zweite Messquelle, widerspricht Leitplanke 2). Verworfen, weil pdf-lib bereits in der Suite ist |

## Messung (Spike 2, Testseite mit den 50 Kästchen aus Spike 1)

- **Determinismus:** SHA-256 `6d77309bd36cfd3d…` (18 840 Byte) identisch bei
  - zweimaliger Erzeugung im selben Prozess,
  - getrennten Node-Prozessen,
  - `TZ=America/New_York`,
  - Erzeugung **in Edge 155** (CPU ×1 und ×4, je zweimal).
  - Die schmale Variante (134 Zeilen) ebenso: `2a3d74c8deafdcce…`.
  - pdf-lib nutzt für Namenszusätze einen fest gesäten Zufallsgenerator (`SimpleRNG.withSeed(1)`); zusätzlich wird der Schriftname fest gesetzt (`customName`). Keine `/ID`, kein XMP, Datumsfelder fest.
- **Unabhängiger Leser** `pdfjs-dist` 6.3.289 (Apache-2.0):
  - Text: 96/96 bzw. 134/134 Zeilen textgleich (inkl. Umlaute), 0 nicht zugeordnete Textstücke.
  - Position: Abweichung x, Grundlinie und Breite je **0,0000 pt** zum Layout; Schriftgrösse 96/96 bzw. 134/134 exakt.
  - Schriften: 2 × CIDFontType2 mit `FontFile2` (Teilmenge 3 228 bzw. 3 871 Byte komprimiert, Original 318 KB), `missingFile: false`, 2 × `ToUnicode`.
  - Bilder: 0 (rein vektoriell).
  - pdfjs fügt beim Auslesen synthetische Leerzeichen-Stücke zwischen entfernten Textstücken ein; der Prüfer muss sie ignorieren.
- **Zeit:** Edge 155, 50 Kästchen, 96 Zeilen, zwei Schriften: 67 ms erster / 31 ms zweiter Lauf; CPU ×4: 273 / 181 ms. Node: 96–103 ms.
- **Gedrehter Text:** `rotate: degrees(90)` wird von pdfjs textgleich gelesen, Breite 50,032 pt = berechnet (Einzelprobe).

## Entscheid (Empfehlung)

1. **pdf-lib 1.17.1** (bereits Abhängigkeit) als PDF-Schreiber; jede Textzeile des Layout-Ergebnisses (ADR-004) wird als eigene Textzeile gezeichnet (`drawText`, ohne Kerning), Linien und Flächen als Vektoren; gemeinsame Leitung (diagonal geteilte Füllung) und offenes Ende (Wellenkante) über Pfade (`drawSvgPath` bzw. Clip-Operatoren) – im Etappenplan 1 als Testfall.
2. **fontkit: Option B (`fontkit` 2.0.4 mit Adapter)**, weil kleiner und schneller ausgewertet bei gleicher Funktion; mit Vite 8 gebündelt und in Edge **belegt** (Spike AR0-08, Beleg unten): Node und Edge erzeugen dieselben Bytes, das gebündelte IIFE (inkl. pdf-lib) ist 354 KB kleiner und wird in 35 ms statt 71 ms ausgewertet (CPU ×4: 148 statt 322 ms). Der Adapter ist Produktcode mit eigenem Test (Teilmenge, ToUnicode, Determinismus). Fällt der Adapter-Test in einer späteren Version, gilt Option A. fontkit wird erst beim ersten PDF geladen/ausgewertet (ADR-001).
3. **Feste Metadaten:** keine Datumsfelder (`updateMetadata: false`, kein `CreationDate`/`ModDate`), `Producer` und `Creator` fest «WAP-Planer» **ohne** Versionsnummer, `Title` aus der Dateinamen-Konvention (Beschrieb 6) ohne `.pdf`. Vor dem ersten Stand enthält der Titel **kein Datum** (`…_<Kurzname>_Entwurf`), damit derselbe Plan an jedem Tag dasselbe PDF ergibt (AR0-17; Vertrag E1-05). Schriftnamen fest mit deterministischem Teilmengen-Präfix (sechs Grossbuchstaben, aus der Glyphenmenge abgeleitet).
4. **Stand-PDF** werden beim Setzen des Stands gespeichert, in den garantierten Varianten (je Woche und Gesamt-PDF, A4, Status rot) und atomar mit dem Stand (ADR-002 Punkt 6 und 6a), damit sie auch nach Tool-Updates bytegleich bleiben. Das Gesamt-PDF hat genau einen Erzeugungsweg (`renderPlanPdf`).
5. **Prüfung Ebene 2** (Prompt §7) mit `pdfjs-dist` als Entwicklungs-Abhängigkeit (nicht im Bundle): Text, Position, Schriftgrösse (≥ 4,5 pt), eingebettete Schriften, keine Bilder, Linien.

## Folgen

- Neue Laufzeit-Abhängigkeit `fontkit` (MIT; Unterabhängigkeiten im Etappenplan 1 auf Lizenzen prüfen) im Bundle der Suite → Gate 0.
- Neue Entwicklungs-Abhängigkeit `pdfjs-dist` (Apache-2.0) → Gate 0 (Lizenz zulässig, nicht ausgeliefert).
- Golden-Bilder (Prompt §7 Ebene 3) brauchen eine fixierte Render-Kette; Vorschlag: pdfjs-dist in derselben Edge/Chromium-Version wie die E2E-Tests (Harness-ADR).
- Leistung einer realen Wochenseite (≈ 150 Kästchen, Termine, Seitenleiste) ist in Etappe 1 zu messen; die Spike-Werte (≤ 0,3 s bei CPU ×4) lassen Spielraum zum Budget von 3 s.

## Beleg

**Spike AR0-08 (01.10.2026, `spikes/fk2-vite/`, nicht versioniert, synthetische Texte):** gleiche Testseite (A4 quer, 150 Zeilen fett/normal 5/5,5 pt, 14 gedreht, 150 Rechtecke) mit Option A und B, je mit Vite 8.3.0 im Lib-Modus gebündelt (`iife` für Edge, `es` für Node), Node 24.15.0, Edge 155.0.4283.24 headless (`playwright-core` 1.63, Kanal `msedge`), Seite unter der Suite-CSP.

- `node build.mjs` → Bündel B-iife 779 345 Byte, A-iife 1 133 845 Byte (je inkl. pdf-lib).
- `node node-run.mjs B` → `{"bytes":18931,"sha":"a103ebca629fdcde","zweimalGleich":true,"ms":83}`; mit `TZ=America/New_York` (im Prozess gesetzt) gleiches `sha`.
- `node edge-run.mjs` → B: `{"cpuDrosselung":1,"bytes":18931,"sha":"a103ebca629fdcde","fuenfLaeufeGleich":true,"auswertungMedianMs":35,"pdfMedianMs":81}`, `{"cpuDrosselung":4,…,"sha":"a103ebca629fdcde","auswertungMedianMs":148,"pdfMedianMs":366}`; A: `{"cpuDrosselung":1,"bytes":18885,"sha":"1d4187385b504615","auswertungMedianMs":71,"pdfMedianMs":87}`, `{"cpuDrosselung":4,…,"auswertungMedianMs":322,"pdfMedianMs":349}`.
- `cmp out-node-B.pdf out-edge-B.pdf` → byte-identisch (ebenso A).
- `node verify3.mjs` (pdfjs-dist 6.3.289) → je Datei 150/150 Zeilen gelesen, Umlaute vorhanden, 144/150 zeichengleich in A und B gleichermassen (6 Zeilen ragen im Spike ohne Layout über ihr Kästchen und werden von pdfjs getrennt; kein Unterschied zwischen A und B).
- Folge: A und B erzeugen **verschiedene** Bytes (18 885 vs. 18 931); die Wahl ist vor den ersten Golden-Bildern und Ständen festzulegen. Ein späterer Wechsel ändert nur neu erzeugte PDF, nie gespeicherte Stände.


**Spikes 1 und 2 (30.09.2026)**, Arbeitsverzeichnis `spikes/font-layout/` (nicht versioniert):

- `node dist/spike1.mjs` → `"pdf": {"bytes": 18840, "sha256_1": "6d77309bd36cfd3d", "sha256_2": "6d77309bd36cfd3d", "identischImProzess": true, "erzeugungMs": 103}`; `TZ=America/New_York node dist/spike1.mjs` → `"sha256_1": "6d77309bd36cfd3d"`.
- `node dist/pdf-node.mjs` → `{"node":"6d77309bd36cfd3d","bytes":18840}`; `node pdf-browser-run.mjs` → `{"cpuDrosselung":1,"browserSha":"6d77309bd36cfd3d","ms":67,"zweiterLaufMs":31,"gleich":true}`, `{"cpuDrosselung":4,"browserSha":"6d77309bd36cfd3d","ms":273,"zweiterLaufMs":181,"gleich":true}`.
- `node verify-pdf.mjs` → `"zeilenErwartet": 96, "textItems": 96, "itemsNichtZugeordnet": 0, "textIdentisch": 96, "maxAbweichungPt": {"x": 0, "baseline": 0, "breite": 0}, "schriftgroesseIdentisch": 96, "bilder": 0, "schriften": [{"name": "WAPSUB+Arimo-Bold", "missingFile": false}, {"name": "WAPSUB+Arimo", "missingFile": false}], "fontFile2Bytes": [3228, 3871]`; Rohprüfung `ID: false XMP: false ToUnicode: 2 CIDFontType2: 2`.
- `node dist/fk2test.mjs` (fontkit 2 mit Adapter) → `{"bytes":3747,"deterministisch":true,"textOk":true}`.
- Ohne Datumsfelder: `PDFDocument.create({ updateMetadata: false })`, nur `setProducer`/`setCreator`, zwei Erzeugungen im Abstand von 1,1 s → `{"gleich":true,"creationDate":false,"modDate":false}`.
- Grössen: `esbuild --bundle --minify` → `fk.min.js 985234`, `fk2.min.js 365867`, `pl.min.js 431730` Byte.

## Änderungsnotiz E1-02c (04.10.2026, architect): Adapter, Teilmenge, Präfix

Präzisierung im Rahmen von Entscheid 2 und 3, kein Konflikt. Einzelheiten und Belege: Vertrag E1-02c §2, §6 (P-3, P-5 bis P-7) und dessen Änderungsnotiz Vertragsprüfung.

- **Adapter (Option B):** Er bildet nicht nur `encodeStream` auf `encode()` ab. Zusätzlich liefert `layout` je Codepunkt die cmap-Glyphe, ohne GSUB, GPOS und Kerning, wie die Messung in ADR-004 Punkt 2. Für die 8 geteilten Glyphen von Arimo setzt er `codePoints` fest auf den Hauptcodepunkt. Grund: fontkit-`layout` ersetzt 27 unsichtbare Codepunkte durch die Leerzeichen-Glyphe, und `ToUnicode` hing von der Reihenfolge im Dokument ab.
- **Teilmenge bleibt** (Entscheid 3). Befund E1-01b-03 beruhte auf fontkit 2 ohne Adapter. Mit Adapter liest pdfjs Text, Grössen, Breiten und Metriken (10 241 Byte gegenüber 470 393 Byte für die ganze Schrift).
- **Präfix:** sechs Buchstaben aus der **Codepunktmenge** je Schnitt (FNV-1a, Algorithmus im Vertrag E1-02c 2.3 Nr 6), nicht aus der Glyphenmenge.
- **Fehler:** Zeichen ohne Glyphe ergeben `missingGlyph`, weil die Teilmenge für .notdef keine Breite führt. Unsichtbare und Bidi-Zeichen ergeben `invalidItem`. JPEG wird vor dem Einbetten von APP1–APP13, APP15 und COM befreit, weil pdf-lib es roh übernimmt. PNG-Textblöcke übernimmt pdf-lib nicht.
