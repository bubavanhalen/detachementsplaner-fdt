# ADR-004: Layout-Schicht, Textmessung, Umbruch und Bildschirmdarstellung

- **Status:** Entwurf Runde 2 (01.10.2026, nach AR0-13). **Entschieden an Gate 0 (02.10.2026):** G-4 c (Bildschirmschrift per FontFace aus ArrayBuffer, keine CSP-Änderung `font-src data:`); E2 ja (`hyphen` für die Silbentrennung, damit ist der offene Punkt «Trennbibliothek» in Entscheid Punkt 3 erledigt).
- **Leitplanken:** 2 (gemeinsame Layout-Schicht, Messung mit derselben Schriftdatei, Browser bricht nie selbst um), 3; Beschrieb 5 («dieselbe Anordnung wie das PDF (Lage, Farben, Umbrüche)»), 10, 15 (Umbruch an Wortgrenzen und Bindestrichen)
- **Gate-0-Entscheid des Auftraggebers:** G-4, ja – Schrift am Bildschirm unter der CSP der Suite (`font-src 'none'`)

## Kontext

- Leitplanke 2: Die Layout-Schicht ist rein, deterministisch und ohne Oberfläche testbar; Bildschirm und PDF zeichnen vorberechnete Umbrüche.
- Die CSP der Suite verbietet Schriften aus jeder Quelle (`font-src 'none'`, `tools/build-offline.mjs` Zeile 53). Eine per `@font-face` eingebundene Schrift wird blockiert.
- Beschrieb 15: «Umbruch an Wortgrenzen und Bindestrichen; deutsche Silbentrennung nur, wenn ein Wort sonst nicht passt.»
- Prompt §7: Paritätstest «Positionen und Umbrüche aller Texte einer Referenzwoche sind am Bildschirm und im PDF identisch».

## Aufbau des Spikes 1

- 50 Formtexte aus dem Kp-Referenz-WAP (Raster, mit Text, ohne reine Beso-Nummern; 22 davon senkrecht) mit ihren Kästchenbreiten (Blattbreite auf 812 pt skaliert; senkrecht: Kästchenhöhe als Zeilenbreite). Zwei Durchläufe: Originalbreite (96 Zeilen) und 45 % Breite (134 Zeilen, 22 Texte mehrzeilig durch Umbruch).
- Layout rein in TypeScript mit `@pdf-lib/fontkit` (dieselbe Bibliothek und Glyphenfolge wie der PDF-Zeichner): Breite = Summe der `advanceWidth` (ohne Kerning), Umbruch gierig an Leerzeichen und nach Bindestrich, Notfall zeichenweise (Platzhalter für Silbentrennung), erste Zeile fett 5,5 pt, übrige 5 pt, Zeilenhöhe aus hhea.
- PDF mit pdf-lib; Bildschirm in Edge 155 (headless, Playwright-Kanal `msedge`) in vier Varianten; Positionen per DOM gemessen, Grundlinie über einen Null-Marker `vertical-align: baseline`.

## Geprüfte Optionen (Bildschirm)

| | Option | CSP | Parität (max. Abweichung zum Layout) | Leistung 600 Zeilen (Median, synchron / CPU ×4) | Bemerkung |
| --- | --- | --- | --- | --- | --- |
| a | `@font-face` mit `data:`-URL | braucht **`font-src data:`** (Änderung für die ganze Suite) | Breite ≤ 0,021 pt, x ≤ 0,015 pt, Grundlinie ≤ 0,54 pt bei 1 px/pt, ≤ 0,034 pt bei 2 px/pt | wie c | Unter heutiger CSP: `font-src`-Verletzung, Ersatzschrift, Breiten bis 3,8 pt grösser, 41 von 96 bzw. 46 von 134 Zeilen breiter als berechnet (Überlauf) |
| b | Glyphen als SVG-Pfade aus der Schriftdatei | keine Änderung | exakt (Breite 0, Grundlinie 0) | 62 ms / 435 ms; 16 315 DOM-Knoten | Nicht markierbar, Text nur per `aria-label`; `<use>`-Variante langsamer (106 / 658 ms) |
| c | **FontFace-API aus ArrayBuffer** (`new FontFace(name, bytes)`, `document.fonts.add`), Zeilen als absolut positionierte `white-space: pre`-Elemente | keine Änderung, **keine Verletzung gemeldet** (kein Abruf über URL) | wie a | 5 ms / 20 ms; 600 Knoten | Text markierbar, Barrierefreiheit normal |
| d | Canvas (Path2D je Glyphe oder `fillText`) | keine Änderung | exakt bzw. wie c | 11 / 53 ms bzw. 1 / 9 ms | Kein DOM-Text: Treffer, Fokus, Tooltips, Bildschirmleser müssen separat gebaut werden |

Zoomstufen 1 / 1,333 / 2 / 3 px pro pt: in a und c jeweils alle Zeilen textgleich, x ≤ 0,015 pt, Breite ≤ 0,021 pt; die Grundlinie rastet auf ganze Pixel (≤ 0,54 pt bei 1 px/pt, ≤ 0,2 pt ab 2 px/pt).

## Entscheid (Empfehlung)

1. **Layout-Schicht** in `src/model/wap/layout/` (ADR-001), rein und deterministisch: Eingabe Datenmodell + Vorlage + Schrift-Metriken, Ausgabe Seitenmodell (Rechtecke, Linien, Textzeilen mit Position, Grösse, Gewicht, Farbe, Durchstreichung, Drehung). Keine DOM-API, keine Zufallszahlen, keine Uhrzeit.
2. **Messung:** Glyphbreiten aus der Arimo-Datei (ADR-003), **ohne Kerning**, keine Ligaturen-Abhängigkeit (Arimo hat für die Referenztexte keine). Die Metriken werden beim Build aus der TTF erzeugt (kleine Tabelle Codepunkt → Glyph → Breite in Font-Units); ein Test vergleicht die Tabelle für alle Glyphen mit fontkit. So braucht der Start der Oberfläche fontkit nicht (Auswertung 71 ms, ×4: 338 ms, ADR-001); fontkit wird erst beim PDF geladen.
3. **Umbruch:** an Leerzeichen und nach Bindestrich; Silbentrennung (Deutsch) nur, wenn ein Wort allein nicht passt (Beschrieb 15). Spike: 1 von 50 Texten bei Originalbreite, 16 von 50 bei 45 % Breite enthalten ein zu langes Wort. Die Trennbibliothek (Muster und Lizenz) wird im Etappenplan 1 gewählt – **offener Punkt**.
4. **Bildschirm: Option c** (FontFace aus ArrayBuffer). Jede Zeile ist ein eigenes, absolut positioniertes Element mit `white-space: pre; font-kerning: none`; die Grundlinie wird aus den Metriken gesetzt. Der Browser bricht nie um.
   - Lädt die Schrift nicht (`FontFace.status === 'error'`), zeigt der WAP-Planer eine Fehlermeldung mit Ursache und nächstem Schritt statt still mit Ersatzschrift zu zeichnen (Messung a unter Suite-CSP: Überlauf).
   - **Fehlende Glyphen (AR0-13 a):** Für ein Zeichen ohne Glyphe in Arimo würde der Browser eine Systemschrift mit anderer Breite nehmen, Layout und PDF aber die Breite von .notdef. Deshalb gelangen solche Zeichen nicht ins Dokument: Eingaben werden mit Meldung abgewiesen (Feldbausteine E1-12), der Import ersetzt sie durch «?» und meldet sie (ADR-003). Das Layout meldet verbliebene Fälle als Warnung `missingGlyph` (Vertrag E1-02e).
   - **Mindestschriftgrösse des Browsers (AR0-13 b):** Edge vergrössert Text unter einer eingestellten Mindestgrösse (Einstellung oder Richtlinie). Der Bildschirm-Zeichner setzt die Zeilen deshalb in einer festen Auflösung von 4 px pro pt (5 pt = 20 px, über jeder üblichen Mindestgrösse) und skaliert die ganze Seite per CSS-`transform: scale(zoom/4)`. Die Umgebungsprobe misst zusätzlich die wirksame Mindestschriftgrösse (6-px-Probe) auf dem Dienstlaptop; liegt sie über 20 px, wird neu vorgelegt. Die Parität bei 4 px/pt mit Skalierung ist im Spike nicht gemessen (dort 1 bis 3 px/pt) und wird in E1-02c/E1-02f mit dem Paritätstest belegt; scheitert sie, gilt Zeichnen in Zielauflösung mit Befund an Gate S.
   - Rückfallebene, falls der Auftraggeber c ablehnt: **a** mit CSP-Änderung `font-src data:` (Suite-weit) oder Auslieferung als eigene Datei (ADR-001 Option B).
5. **Paritätstest** (Prompt §7): Positionen und Texte aller Zeilen am Bildschirm (DOM) gegen das PDF (unabhängig ausgelesen, ADR-005) mit Toleranz x/Breite 0,05 pt und Grundlinie 0,6 px.

## Folgen

- **Gate 0:** Option c umgeht keine Prüfung der CSP, nutzt aber einen Weg, den `font-src 'none'` nicht erfasst (die Schrift liegt als Bytes im Skript). Der Auftraggeber entscheidet: c (keine CSP-Änderung) oder a (`font-src data:` für die Suite).
- Die Umgebungsprobe (Prompt §5.1 Schritt 3) muss **zusätzlich** zu `@font-face`/`data:` auch `new FontFace(name, ArrayBuffer)` unter der Suite-CSP und die gemessene Zeilenbreite prüfen (Edge Dienstlaptop, Tablet). **Ergebnis (Umgebungsprobe `umgebungsprobe-3`, 01.10.2026, ADR-007):** Auf dem Dienstlaptop (Edge 155.0.4283.24) lädt die Testschrift per FontFace aus ArrayBuffer unter der Suite-CSP mit Sollbreite (1000,00 px); `@font-face` mit `data:`-URL wird unter der Suite-CSP blockiert. Option c ist damit auf dem Dienstlaptop belegt. Das Tablet (Android-Standardtablet) wurde laut Auftraggeber nicht geprüft; es liest das PDF (G-7 a).
- Senkrechter Text (22 von 50 Texten) wird im Layout als gedrehte Zeile geführt; Bildschirm per CSS-Transform, PDF per `rotate: degrees(90)`. Einzelprobe (`node dist/rot.mjs`): pdfjs liest die gedrehte Zeile textgleich, Matrix `[0,5,-5,0,100,20]`, Breite 50,032 pt = berechnet. Die Parität gedrehter Zeilen am Bildschirm ist in Etappe 1 zu belegen (im Spike am Bildschirm waagrecht gezeichnet).
- Teilweise fette Titel (Beschrieb 5.1 «**AVOR** Fahne») erfordern Zeilen aus mehreren Läufen mit eigener Schrift; das Layout misst je Lauf.

## Beleg

Arbeitsverzeichnis `spikes/font-layout/` (nicht versioniert); Echttext-Artefakte nur in `.qa/etappe0-spikes/`.

- `npx esbuild spike1.ts --bundle --platform=node --format=esm --outfile=dist/spike1.mjs --external:pdf-lib --external:@pdf-lib/fontkit && node dist/spike1.mjs` und `FACTOR=0.45 node dist/spike1.mjs` → `zeilenTotalArimo 96 / 134`, `mehrzeiligDurchUmbruch 2 / 22`, `woerterZuLangSilbentrennungNoetig 1 / 16`, `layoutMs50Texte 2.4 / 2.7`.
- `node verify-screen.mjs` (Edge 155.0.4283.24) → z.B. `{"variante":"c-fontfaceapi-suitecsp","suf":"-f0.45","pxProPt":2,"zeilen":134,"gefunden":134,"textIdentisch":134,"maxAbwPt":{"x":0.008,"breite":0.008,"baseline":0.034},"breiterAlsBerechnet":0,"cspVerletzungen":[],"fontFaceApi":"ok"}`; `{"variante":"a-fontface-suitecsp",…,"maxAbwPt":{"x":0.007,"breite":3.817,…},"breiterAlsBerechnet":41,"cspVerletzungen":["font-src"]}`.
- `node dist/perf-screen.mjs && node perf-run.mjs` (synthetische Texte, 600 Zeilen, 15 714 Glyphen) → `{"cpuDrosselung":1,"spansFontFace":{"syncMedianMs":5},"svgPfade":{"syncMedianMs":62,"domKnoten":16315},"svgUse":{"syncMedianMs":106},"canvasPath2D":{"syncMedianMs":11},"canvasFillText":{"syncMedianMs":1}}`, `{"cpuDrosselung":4,"spansFontFace":{"syncMedianMs":20},"svgPfade":{"syncMedianMs":435},"svgUse":{"syncMedianMs":658},"canvasPath2D":{"syncMedianMs":53},"canvasFillText":{"syncMedianMs":9}}`. Werte mit zwei Animationsframes liegen bei ≥ 65 ms (Frame-Takt headless) und sind daher nur die synchronen Zeiten aussagekräftig.
- Screenshots: `.qa/etappe0-spikes/spike1-screen-*.png`.

## Offene Risiken

- Mindestschriftgrösse und Richtlinien des Dienstlaptops: von der Umgebungsprobe **nicht gemessen** (keine 6-px-Probe in der Ausgabe); die Vorkehr aus Entscheid Punkt 4 (4 px/pt, 5 pt = 20 px) bleibt. Restrisiko: eine Mindestgrösse über 20 px wäre nicht erkannt.
- Umgebungsprobe (01.10.2026): FontFace aus ArrayBuffer unter Suite-CSP auf dem Dienstlaptop belegt (siehe Folgen). Nicht gemessen: Pixel-Rasterung der Zeilen auf dem Dienstlaptop (Paritätstest E1-02c/E1-02f läuft lokal in Edge 155, gleiche Version); Tablet laut Auftraggeber vernachlässigbar.
- Silbentrennung: Paket `hyphen` 1.14.1 mit Mustern de-1996 (ADR-010 §11, Entscheid E2); Eignung für Schweizer Schreibung wird in E1-02b stichprobenweise geprüft.
- Grundlinien-Rasterung bei 1 px/pt (≤ 0,54 pt): am Bildschirm unsichtbar, im Paritätstest als Toleranz in Pixeln zu führen.

## Änderungsnotiz E1-02c Code-Review (05.10.2026, Orchestrator)

Punkt 4 (Grundlinie am Bildschirm): Statt die Grundlinie aus den Metriken zu setzen, darf die Zeile `line-height: 0` tragen und ein unsichtbarer Inline-Block der Höhe 1em mit `vertical-align: baseline` (`::before`) die Grundlinie genau 1em unter die Zeilenoberkante legen (Oberkante = baselineY − sizePt). Gemessen in Edge über 4,5–17,3 pt, Drehung 0/90/270, Zoom 0,5–3 und Gerätepixel 1–1,5: Abweichung ≤ 0,007 pt (Toleranz 0,15 pt). Bedingungen: `line-height: 0` auf Zeile und Läufen; Läufe ohne eigene `font-size` und ohne eigenes `vertical-align`; (Oberlänge − Unterlänge)/2 ≤ 1em (Arimo 0,327–0,347 em). Beleg `.qa/e1-02c/code-reviewer-1/edge-sonde-ergebnis.json` (nur lokal), Befund CR-E102c-01.

## Änderungsnotiz F-LAYOUT2 (19.10.2026, Entscheide Auftraggeber «11: ja», «12: ja», «13: ja»)

- Spaltengewichte (Layout-Schicht `grid/geometry.ts`): Nebenspalte 2 statt 1, bewusste Abweichung von Beschrieb 4.4 und B-Kp-37 (Q-HL-03 Kat. B).
- Seitenrahmen (`page/geometry.ts`, `page/headHeight.ts`): `pageFrame(geometry, plan, weekId, template)` bestimmt die Höhe der Spaltenkopfzeile je Woche; ohne Bedarf die Standardhöhe aus B-Kp-10. Bildschirm und PDF verwenden denselben Rahmen (Leitplanke 2), sobald der Bildschirm den Rahmen mit Vorlage abfragt.
- Beschriftung neben dem Kästchen (`entries/layoutEntries.ts`): zusätzlich der Ort eines Rapports, nur im freien Bereich (Q-HL-03 Kat. C).
